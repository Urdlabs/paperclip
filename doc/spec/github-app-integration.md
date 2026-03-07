# GitHub App Integration

## Overview

Paperclip agents need access to private GitHub repositories to clone code, push
changes, create pull requests, and interact with issues. Today this requires
manually generating a Personal Access Token and setting it as `GITHUB_TOKEN` in
the container environment.

This spec defines a GitHub App integration that replaces manual token management
with a one-click setup flow using the **GitHub App Manifest** pattern. The
instance admin creates a GitHub App by clicking a button in the Paperclip UI,
installs it on their repos/orgs, and agents automatically receive short-lived
installation tokens for every run.

## Goals

1. **Zero-friction setup.** Admin clicks "Connect GitHub" → creates a GitHub App
   → installs on repos. No tokens to copy, rotate, or manage.
2. **Least-privilege tokens.** Installation tokens are scoped to the repos the
   app is installed on, not the entire account.
3. **Auto-rotating credentials.** Installation tokens expire after 1 hour and
   are generated fresh per agent run. No long-lived secrets to leak.
4. **Adapter-agnostic.** Works for all agent types (Claude, Codex, Cursor, etc.)
   without adapter-specific code.
5. **Backward-compatible.** Static `GITHUB_TOKEN` / `GH_TOKEN` env var still
   works. The GitHub App is an opt-in upgrade.

## Non-Goals

- GitHub OAuth login for Paperclip users (use email/password via Better Auth).
- Webhook-driven CI/CD pipelines (Paperclip is a control plane, not a CI
  system).
- Multi-provider support (GitLab, Bitbucket) — future work.

---

## Architecture

### Instance-Level GitHub App

The GitHub App is created and owned at the **instance level**, not per-company.
A self-hosted Paperclip instance is a single deployment; one GitHub App covers
all companies and agents within it.

The instance admin creates the app. Any agent in any company can receive
installation tokens for repos the app has access to.

### Token Lifecycle

```
┌────────────┐   manifest   ┌────────┐   code    ┌───────────┐
│ Paperclip  │ ──────────── │ GitHub │ ────────  │ Paperclip │
│ UI         │  redirect    │        │ callback  │ Server    │
└────────────┘              └────────┘           └─────┬─────┘
                                                       │
                                              store credentials
                                              (app_id, pem, etc.)
                                                       │
┌────────────┐  install app  ┌────────┐  webhook  ┌────┴──────┐
│ Admin      │ ──────────── │ GitHub │ ────────  │ Paperclip │
│            │  on repos     │        │           │ Server    │
└────────────┘              └────────┘           └─────┬─────┘
                                                       │
                                              store installation_id
                                                       │
                                              ┌────────┴────────┐
                                              │ Per agent run:   │
                                              │ 1. Generate JWT  │
                                              │ 2. Request token │
                                              │ 3. Inject into   │
                                              │    agent env     │
                                              └─────────────────┘
```

1. **App creation** (once): Admin clicks "Connect GitHub". Paperclip generates a
   manifest and redirects to GitHub. GitHub creates the app and redirects back
   with a `code`. Paperclip exchanges the code for credentials (app ID, private
   key, client ID, client secret, webhook secret) and stores them encrypted.

2. **App installation** (once per org/user): Admin clicks "Install on repos".
   Redirected to GitHub to choose which repos. GitHub sends an `installation`
   webhook. Paperclip stores the `installation_id`.

3. **Token generation** (per agent run): Before spawning an agent process, the
   heartbeat service generates a JWT signed with the app's private key,
   exchanges it for a 1-hour installation access token via the GitHub API, and
   injects it as `GITHUB_TOKEN` + `GH_TOKEN` in the agent's environment.

---

## Data Model

### `github_apps` table (instance-level)

Stores the GitHub App credentials created via the manifest flow. At most one
active row exists per instance.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `github_app_id` | integer | GitHub's numeric app ID |
| `github_app_slug` | text | URL-safe name (e.g. `paperclip-acme`) |
| `app_name` | text | Human-readable name |
| `client_id` | text | OAuth client ID |
| `client_secret_encrypted` | text | Encrypted with instance secrets provider |
| `private_key_encrypted` | text | PEM private key, encrypted |
| `webhook_secret_encrypted` | text | Encrypted |
| `permissions` | jsonb | Permissions the app was created with |
| `events` | jsonb | Events the app subscribes to |
| `html_url` | text | URL to the app's GitHub page |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `github_app_installations` table

Stores each installation of the GitHub App (one per org or user account).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `github_app_id` | uuid FK → github_apps | |
| `installation_id` | integer | GitHub's numeric installation ID |
| `account_login` | text | GitHub org or user login |
| `account_type` | text | `Organization` or `User` |
| `repository_selection` | text | `all` or `selected` |
| `suspended_at` | timestamptz | Null if active |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

## API Endpoints

### App Manifest & Creation

#### `GET /api/github/manifest`

Returns the GitHub App manifest JSON. The UI uses this to build the redirect URL.

**Auth:** Board (instance admin only).

**Response:**
```json
{
  "manifest": { ... },
  "redirectUrl": "https://github.com/settings/apps/new"
}
```

**Manifest contents:**
```json
{
  "name": "Paperclip (<instance-id>)",
  "url": "<PAPERCLIP_PUBLIC_URL>",
  "hook_attributes": {
    "url": "<PAPERCLIP_PUBLIC_URL>/api/github/webhook",
    "active": true
  },
  "redirect_url": "<PAPERCLIP_PUBLIC_URL>/api/github/callback",
  "setup_url": "<PAPERCLIP_PUBLIC_URL>/github/setup-complete",
  "callback_urls": ["<PAPERCLIP_PUBLIC_URL>/api/github/callback"],
  "public": false,
  "default_permissions": {
    "contents": "write",
    "pull_requests": "write",
    "issues": "write",
    "metadata": "read"
  },
  "default_events": ["installation", "installation_repositories"]
}
```

#### `GET /api/github/callback?code=<code>`

GitHub redirects here after the admin creates the app. Exchanges the `code` for
app credentials via `POST https://api.github.com/app-manifests/{code}/conversions`.

**Auth:** Board (instance admin only, via session cookie).

**Side effects:**
- Stores credentials in `github_apps` table (encrypted).
- Redirects to the UI setup-complete page.

#### `DELETE /api/github/app`

Removes the GitHub App configuration from Paperclip (does not delete the app
from GitHub — the admin should do that manually).

**Auth:** Board (instance admin only).

### Installations

#### `GET /api/github/installations`

Lists all known installations of the GitHub App.

**Auth:** Board.

**Response:**
```json
{
  "installations": [
    {
      "id": "<uuid>",
      "installationId": 12345,
      "accountLogin": "acme-corp",
      "accountType": "Organization",
      "repositorySelection": "selected",
      "suspendedAt": null
    }
  ]
}
```

#### `POST /api/github/installations/sync`

Fetches the current installation list from GitHub API and reconciles with the
local DB. Useful if webhooks were missed.

**Auth:** Board (instance admin only).

#### `GET /api/github/install-url`

Returns the URL the admin should visit to install the app on new repos/orgs.

**Auth:** Board.

**Response:**
```json
{
  "url": "https://github.com/apps/<slug>/installations/new"
}
```

### Webhook

#### `POST /api/github/webhook`

Receives GitHub webhook events. Verifies the signature using the stored webhook
secret.

**Auth:** GitHub webhook signature (HMAC SHA-256).

**Handled events:**
- `installation` → created/deleted/suspended/unsuspended — upsert/update
  `github_app_installations`.
- `installation_repositories` → added/removed — update installation metadata.

### Status

#### `GET /api/github/status`

Returns whether a GitHub App is configured and how many installations exist.

**Auth:** Board.

**Response:**
```json
{
  "configured": true,
  "appName": "Paperclip (default)",
  "appSlug": "paperclip-default",
  "installationCount": 2,
  "totalRepos": 15
}
```

---

## Agent Token Injection

### Injection Point

The token is injected in the **heartbeat service** (`server/src/services/heartbeat.ts`),
between secret resolution and `adapter.execute()` (currently around line 1246).

```typescript
// After resolveAdapterConfigForRuntime (line 1246)
const resolvedConfig = await secretsSvc.resolveAdapterConfigForRuntime(...);

// NEW: inject GitHub installation token if app is configured
const githubToken = await githubAppService.generateInstallationToken();
if (githubToken && !resolvedConfig.env?.GITHUB_TOKEN) {
  resolvedConfig.env = {
    ...resolvedConfig.env,
    GITHUB_TOKEN: githubToken,
    GH_TOKEN: githubToken,
  };
}

// Then adapter.execute(resolvedConfig) as before
```

This approach is:
- **Adapter-agnostic** — works for Claude, Codex, Cursor, etc.
- **Non-breaking** — explicit `GITHUB_TOKEN` in `adapterConfig.env` takes
  precedence.
- **Centralized** — one injection point, not N adapter implementations.

### Token Generation Service

The `githubAppService` exposes:

```typescript
interface GitHubAppService {
  /** Generate a short-lived installation token. Returns null if no app configured. */
  generateInstallationToken(opts?: {
    installationId?: number;  // specific installation; defaults to first active
    repositoryIds?: number[]; // scope to specific repos (optional)
  }): Promise<string | null>;

  /** Check if a GitHub App is configured and has active installations. */
  isConfigured(): Promise<boolean>;
}
```

**Token generation steps:**
1. Load the app's private key from DB (decrypt).
2. Generate a JWT (iat, exp=10min, iss=app_id) signed with RS256.
3. `POST https://api.github.com/app/installations/{installation_id}/access_tokens`
   with the JWT as Bearer token.
4. GitHub returns a token valid for 1 hour.
5. Cache the token in memory until 5 minutes before expiry to avoid redundant
   API calls for concurrent runs.

### Fallback Behavior

| Scenario | Result |
|---|---|
| GitHub App configured + installations active | Fresh installation token injected |
| GitHub App configured but no installations | No token injected; warning logged |
| No GitHub App configured + `GITHUB_TOKEN` env var set | Static token used (current behavior) |
| No GitHub App + no env var + `adapterConfig.env.GITHUB_TOKEN` set | Secret-resolved token used |
| Nothing configured | No GitHub token; agents can only access public repos |

---

## UI

### Settings Page: GitHub Integration

Located at `/settings/github` (or a tab within instance settings).

**States:**

1. **Not configured:** Shows "Connect GitHub" button. Clicking it:
   - Fetches manifest from `GET /api/github/manifest`.
   - Redirects to `https://github.com/settings/apps/new?state=<state>` with the
     manifest as a form POST (hidden form technique).

2. **App created, no installations:** Shows the app name and a prominent
   "Install on repositories" link pointing to `GET /api/github/install-url`.

3. **App created + installations active:** Shows:
   - App name and slug.
   - List of installations (org/user, repo count, status).
   - "Install on more repositories" link.
   - "Disconnect" button (calls `DELETE /api/github/app`).

### Setup Complete Page

Located at `/github/setup-complete`. Shown after the GitHub callback redirects
the user. Displays a success message and prompts the user to install the app
on repos.

---

## Entrypoint Changes

The `docker/entrypoint.sh` git credential helper setup remains as-is for the
`GITHUB_TOKEN` env var fallback. When a GitHub App is configured, the token is
injected at the application layer (heartbeat service), not the entrypoint.

The entrypoint credential helper will pick up the injected `GITHUB_TOKEN`
automatically because it's in the agent's process environment, and `git
credential.helper store` reads from the environment's credential store. However,
per-run tokens are injected directly into the agent child process env, bypassing
the credential store file entirely — `git` will use the `GITHUB_TOKEN` env var
through the `x-access-token` mechanism when the credential helper is configured.

Actually, the simplest approach is for the entrypoint to only set up the store
credential helper when a static `GITHUB_TOKEN` is provided. For GitHub App
tokens (injected per-run), the adapter should also set:
```
GIT_CONFIG_COUNT=2
GIT_CONFIG_KEY_0=credential.helper
GIT_CONFIG_VALUE_0=!f() { echo "username=x-access-token"; echo "password=$GITHUB_TOKEN"; }; f
GIT_CONFIG_KEY_1=safe.directory
GIT_CONFIG_VALUE_1=*
```

Or more simply, set `GIT_ASKPASS` to a script that echoes the token.

**Recommended approach:** Inject a small `GIT_ASKPASS` script into the agent env
alongside `GITHUB_TOKEN`:

```typescript
env.GIT_ASKPASS = "/usr/local/bin/paperclip-git-askpass";
```

Where `/usr/local/bin/paperclip-git-askpass` is:
```sh
#!/bin/sh
echo "$GITHUB_TOKEN"
```

This script is baked into the Docker image. Combined with `GITHUB_TOKEN` in the
env, all `git` HTTPS operations authenticate automatically without needing a
credential store file.

---

## Security Considerations

1. **Private key encryption.** The GitHub App's PEM private key is encrypted at
   rest using the same secrets provider as company secrets (AES-256-GCM by
   default).

2. **Webhook signature verification.** All incoming webhooks are verified using
   HMAC SHA-256 with the stored webhook secret before processing.

3. **Token scope.** Installation tokens are scoped to the repos the app is
   installed on. They cannot access repos outside the installation.

4. **Token TTL.** Installation tokens expire after 1 hour. Even if leaked, the
   blast radius is time-limited.

5. **Instance admin only.** Only instance admins can create, configure, or
   remove the GitHub App. Regular users cannot modify the integration.

6. **No token logging.** The existing `redactEnvForLogs` function in the adapter
   utils already redacts `GITHUB_TOKEN` and `GH_TOKEN` from logs.

---

## Migration Path

1. **Phase 1 (backend):** DB schema, server endpoints, token generation
   service, webhook handler, heartbeat integration.

2. **Phase 2 (UI):** Settings page, manifest redirect flow, setup-complete
   page, installation management.

3. **Phase 3 (polish):** Per-company installation scoping (optional), repo
   picker in project workspace UI, installation health monitoring.

The static `GITHUB_TOKEN` env var continues to work throughout all phases and
is not deprecated. It serves as the simple fallback for users who don't want
to create a GitHub App.

---

## Open Questions

1. **Per-company installation scoping.** Should different companies within the
   same instance have access to different installations? The current design
   gives all companies access to all installations. Per-company scoping would
   require a mapping table.

2. **GitHub Enterprise Server.** The manifest flow and API endpoints assume
   `github.com`. GHE support would require configurable base URLs. Defer to
   future work.

3. **Token caching strategy.** Should we cache installation tokens in memory
   (current design) or in the DB? Memory caching is simpler but doesn't survive
   restarts. DB caching adds complexity but is more durable. Given the 1-hour
   TTL, memory caching is sufficient.
