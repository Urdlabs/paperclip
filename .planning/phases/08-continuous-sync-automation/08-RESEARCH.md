# Phase 8: Continuous Sync Automation - Research

**Researched:** 2026-03-13
**Domain:** GitHub Actions workflow automation, git rerere, shields.io dynamic badges
**Confidence:** HIGH

## Summary

Phase 8 implements a GitHub Actions workflow that automates fork-to-upstream synchronization. The workflow runs on a weekly cron schedule (Monday mornings) and via manual dispatch. It fetches upstream commits, attempts a merge, and either creates a sync PR (clean merge) or files a GitHub issue (conflicts). It also regenerates the pnpm lockfile, seeds git rerere from the Phase 6 merge commit's 16 conflict resolutions, and maintains a shields.io dynamic badge in the README showing commits-behind count and last sync date.

This is fundamentally a shell-scripting-in-YAML problem. All 5 existing workflows in the repo provide strong patterns for pnpm setup (version 9.15.4, Node 20), git configuration, PR creation via `gh` CLI, and concurrency control. The `refresh-lockfile.yml` workflow is the closest template -- it creates branches, commits, and opens PRs using `GITHUB_TOKEN` and `gh pr create`.

**Primary recommendation:** Build a single workflow file `.github/workflows/upstream-sync.yml` with one job containing sequential shell steps. Use `git/contrib/rerere-train.sh` logic (adapted inline) to seed the rr-cache from commit `8c83b0d`. Store sync state in `.github/sync-status.json` for the shields.io endpoint badge.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Weekly cron schedule (Monday morning) + workflow_dispatch for on-demand sync
- Track upstream/master branch (hardcoded, not configurable)
- Skip silently when no new upstream commits exist (exit early, no artifacts)
- Clean merge -> auto-create a PR with the merge commit ready for review
- Conflicts -> create a GitHub issue listing conflicting files grouped by area (server, UI, packages, infra)
- No effort estimation in conflict reports -- just list the files
- PR body contains upstream changelog grouped by area (server, UI, packages, infra, CLI) using file path analysis
- Delete pnpm-lock.yaml + run `pnpm install` to regenerate (same as phase 6 approach)
- Seed git rerere with the 16 conflict resolutions from phase 6's merge commit
- Enable rerere auto-resolve in the sync workflow -- recognized conflicts get resolved and staged automatically
- Shows both commits-behind count AND last sync date
- Generated via shields.io dynamic badge pointing to a JSON file in the repo (e.g., `.github/sync-status.json`)
- Workflow updates the JSON on each run, shields.io reads it dynamically
- Badge placed in top badges row of README alongside license, stars, discord badges

### Claude's Discretion
- Exact cron expression timing (which hour Monday morning)
- How to extract area grouping from commit file paths
- rerere seeding technique (replay merge or extract from existing commit)
- JSON schema for sync-status.json
- Workflow YAML structure and job organization

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SYNC-01 | GitHub Action detects new upstream commits on a weekly schedule | Cron schedule + workflow_dispatch trigger; `git fetch upstream` + `git rev-list` comparison for detection |
| SYNC-02 | Sync PR is auto-created with upstream changelog grouped by area in PR body | `gh pr create` with body built from `git log --name-only` file path analysis and area mapping |
| SYNC-03 | Sync PR includes conflict area categorization and estimated resolution effort | `git merge --no-commit` dry-run; parse `git diff --name-only --diff-filter=U` for conflicting files; group by area; create GitHub issue (no effort estimation per user decision) |
| SYNC-04 | Lockfile is auto-regenerated in the sync workflow | Delete pnpm-lock.yaml + `pnpm install` following existing `refresh-lockfile.yml` pattern |
| SYNC-05 | git rerere is enabled to auto-apply previous conflict resolutions | `git config rerere.enabled true` + `git config rerere.autoUpdate true`; seed rr-cache from merge commit `8c83b0d` using rerere-train.sh logic |
| SYNC-06 | README displays sync health badge showing commits behind upstream | shields.io endpoint badge pointing to `.github/sync-status.json`; workflow updates JSON on each run |

</phase_requirements>

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| GitHub Actions | v2 (workflow syntax) | CI/CD automation | Native to GitHub, already in use in 5 workflows |
| actions/checkout | v4 | Repository checkout | Standard across all 5 existing workflows |
| pnpm/action-setup | v4 | pnpm installation | Standard across all existing workflows, version 9.15.4 |
| actions/setup-node | v4 | Node.js setup with pnpm cache | Standard across all existing workflows, Node 20 |
| gh CLI | built-in | PR/issue creation | Already used in refresh-lockfile.yml, pre-installed on ubuntu-latest |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| shields.io endpoint badge | current | Dynamic badge rendering | For the sync health badge in README |
| git rerere | built-in | Conflict resolution reuse | Auto-resolve known conflicts from Phase 6 merge |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom shell script | aormsby/Fork-Sync-With-Upstream-action | Marketplace action adds external dependency; user explicitly excluded third-party sync tools |
| shields.io endpoint badge | GitHub API custom badge | Endpoint badge is simpler and requires no server; just a JSON file in the repo |
| Inline rerere seed | Ship `.git/rr-cache` as repo artifact | rr-cache is inside .git and not portable; runtime seeding from merge commit is more robust |

## Architecture Patterns

### New Files
```
.github/
  workflows/
    upstream-sync.yml     # The sync workflow (new)
  sync-status.json        # Badge data file (new, committed to repo)
README.md                 # Badge addition (modify existing badges row)
```

### Pattern 1: Workflow Structure (Single Job, Sequential Steps)
**What:** One workflow file with a single job containing ordered shell steps.
**When to use:** When all steps depend on the previous step's git state and there is no parallelism opportunity.
**Example:**
```yaml
# Source: Adapted from existing refresh-lockfile.yml pattern
name: Upstream Sync

on:
  schedule:
    - cron: '0 8 * * 1'  # Monday 08:00 UTC
  workflow_dispatch:

concurrency:
  group: upstream-sync
  cancel-in-progress: false

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: write
      pull-requests: write
      issues: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history needed for merge + rerere

      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.4
          run_install: false

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      # Step 1: Fetch upstream and check for new commits
      # Step 2: Seed rerere from Phase 6 merge
      # Step 3: Attempt merge
      # Step 4: Handle clean merge (PR) or conflicts (issue)
      # Step 5: Regenerate lockfile
      # Step 6: Update sync status badge
```

### Pattern 2: Upstream Detection and Early Exit
**What:** Fetch upstream, compare rev-lists, exit early if no new commits.
**When to use:** Every sync run -- skip silently when upstream has not moved.
**Example:**
```bash
# Source: Standard git rev-list comparison
git remote add upstream https://github.com/paperclipai/paperclip.git 2>/dev/null || true
git fetch upstream master

LOCAL_UPSTREAM=$(git rev-parse FETCH_HEAD)
LAST_MERGED=$(git merge-base HEAD FETCH_HEAD)

if [ "$LOCAL_UPSTREAM" = "$LAST_MERGED" ]; then
  echo "Already up to date with upstream. Nothing to do."
  exit 0
fi

BEHIND_COUNT=$(git rev-list --count HEAD..FETCH_HEAD)
echo "Found $BEHIND_COUNT new upstream commits."
```

### Pattern 3: Area Grouping from File Paths
**What:** Categorize changed files into areas (server, UI, packages, infra, CLI, DB) based on path prefixes.
**When to use:** For both the sync PR changelog body and conflict issue file listing.
**Example:**
```bash
# Source: Derived from CONFLICT-MAP.md area categories
classify_area() {
  local file="$1"
  case "$file" in
    packages/db/*|*/migrations/*) echo "DB" ;;
    server/*)                     echo "Server" ;;
    ui/*)                         echo "UI" ;;
    packages/*)                   echo "Packages" ;;
    cli/*)                        echo "CLI" ;;
    Dockerfile*|docker-compose*|.github/*|*.yml|*.yaml) echo "Infrastructure" ;;
    *)                            echo "Other" ;;
  esac
}
```

### Pattern 4: Rerere Seeding from Existing Merge Commit
**What:** Replay the Phase 6 merge commit to populate the rr-cache with known conflict resolutions.
**When to use:** Once at the start of each sync run, before attempting the upstream merge.
**Example:**
```bash
# Source: Adapted from git/contrib/rerere-train.sh
# The key merge commit that resolved 16 conflicts
MERGE_COMMIT="8c83b0d"

git config rerere.enabled true
git config rerere.autoUpdate true

# Save current position
ORIG_HEAD=$(git rev-parse HEAD)

# Checkout first parent (fork side) of the merge
git checkout -q "${MERGE_COMMIT}^1"

# Attempt the merge that originally produced conflicts
git merge --no-commit "${MERGE_COMMIT}^2" 2>/dev/null || true

# Let rerere record the conflict state
git rerere

# Now show rerere the resolution by checking out the actual merge result
git checkout "${MERGE_COMMIT}" -- .

# Let rerere record the resolution
git rerere

# Clean up and return to original position
git checkout -f -q "$ORIG_HEAD"
```

### Pattern 5: shields.io Endpoint Badge
**What:** A JSON file in the repo that shields.io reads via its endpoint badge feature.
**When to use:** For the sync health badge displayed in README.
**Example:**
```json
{
  "schemaVersion": 1,
  "label": "upstream sync",
  "message": "0 behind | 2026-03-13",
  "color": "brightgreen"
}
```

Badge markdown in README:
```markdown
<a href="https://github.com/Urdlabs/paperclip/actions/workflows/upstream-sync.yml">
  <img src="https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Urdlabs/paperclip/master/.github/sync-status.json" alt="Upstream Sync" />
</a>
```

### Anti-Patterns to Avoid
- **Using `git push` directly to master from the workflow:** Always create a PR for review. The user explicitly stated "auto-create a PR with the merge commit ready for review."
- **Hardcoding `origin` remote URL with SSH in CI:** GitHub Actions uses HTTPS tokens; use `https://github.com/paperclipai/paperclip.git` for upstream, not `git@github.com:`.
- **Running `pnpm install --frozen-lockfile` after merge:** The lockfile will be stale after merging upstream changes. Must delete and regenerate with `pnpm install`.
- **Caching `.git/rr-cache` between runs:** GitHub Actions runners are ephemeral. Seed rerere fresh each run from the merge commit.
- **Using `git merge --strategy-option ours` globally:** Only appropriate for specific files like lockfiles. The sync should attempt a real merge to detect genuine conflicts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PR creation | Custom GitHub API calls | `gh pr create` CLI | Already used in refresh-lockfile.yml, handles auth automatically |
| Issue creation | Custom GitHub API calls | `gh issue create` CLI | Same auth pattern, simpler than raw API |
| Badge rendering | Custom badge server | shields.io endpoint badge | Zero infrastructure, reads JSON from repo |
| pnpm setup | Manual Node/pnpm install | pnpm/action-setup@v4 + actions/setup-node@v4 | Handles caching, version pinning, PATH setup |
| Upstream detection | Complex diff analysis | `git rev-list --count HEAD..FETCH_HEAD` | One-liner that gives exact commit count |
| Conflict file listing | Parse merge output text | `git diff --name-only --diff-filter=U` | Reliable machine-readable list of conflicting files |

**Key insight:** This entire phase is shell scripting in GitHub Actions YAML. All building blocks exist as standard git commands and gh CLI operations. The only novel part is the rerere seeding logic and the area-grouping helper function.

## Common Pitfalls

### Pitfall 1: GitHub Actions HTTPS vs SSH for Upstream Remote
**What goes wrong:** Workflow fails to fetch upstream because it tries to use SSH (`git@github.com:...`) which requires deploy keys.
**Why it happens:** The repo's local `.git/config` has `upstream` configured with SSH, but CI runners only have HTTPS tokens.
**How to avoid:** Always use `https://github.com/paperclipai/paperclip.git` when adding the upstream remote in the workflow.
**Warning signs:** "Permission denied (publickey)" errors in the fetch step.

### Pitfall 2: PR Policy Blocks Lockfile in Sync PR
**What goes wrong:** The `pr-policy.yml` workflow blocks PRs that contain `pnpm-lock.yaml` changes, unless the branch is `chore/refresh-lockfile`.
**Why it happens:** The sync PR will include a regenerated lockfile, but comes from a different branch name.
**How to avoid:** Either exempt the sync branch in `pr-policy.yml` (add `github.head_ref != 'chore/upstream-sync'` to the lockfile check) or have the sync PR not include lockfile changes and let the `refresh-lockfile.yml` handle it separately. The cleaner approach is to exempt the sync branch since the lockfile regeneration is integral to the sync.
**Warning signs:** Sync PRs failing CI with "Do not commit pnpm-lock.yaml in pull requests."

### Pitfall 3: Rerere Cache Not Persisting Between Steps
**What goes wrong:** The rerere cache seeded in one step is lost in a later step.
**Why it happens:** This does NOT actually happen -- steps within a single job share the same filesystem and `.git` directory. This is a non-issue but worth documenting to prevent unnecessary caching complexity.
**How to avoid:** Keep all steps in a single job. The `.git/rr-cache` directory persists across steps within the same job.

### Pitfall 4: Merge Commit Already Exists on Sync Branch
**What goes wrong:** Running the workflow multiple times creates duplicate sync PRs or pushes conflicting branch history.
**Why it happens:** The sync branch from a previous run still exists.
**How to avoid:** Check for existing sync PRs before creating new ones (same pattern as `refresh-lockfile.yml`). Force-push the sync branch to update it, or close the existing PR first.
**Warning signs:** Multiple open sync PRs, or "non-fast-forward" push errors.

### Pitfall 5: Cron Schedule Only Runs on Default Branch
**What goes wrong:** Scheduled workflows only trigger on the default branch (master).
**Why it happens:** GitHub Actions limitation -- `schedule` events only run on the default branch.
**How to avoid:** This is actually what we want. The workflow file must be on master to run on schedule. During development, test via `workflow_dispatch`.
**Warning signs:** Schedule never triggers if the workflow file is only on a feature branch.

### Pitfall 6: fetch-depth: 0 Required for Merge Operations
**What goes wrong:** Merge fails or produces incorrect results with shallow clone.
**Why it happens:** Default `actions/checkout` uses `fetch-depth: 1` (shallow clone).
**How to avoid:** Use `fetch-depth: 0` to get full history, which is required for `git merge`, `git merge-base`, `git rev-list`, and rerere seeding.
**Warning signs:** "fatal: refusing to merge unrelated histories" or incorrect commit counts.

### Pitfall 7: Workflow Permissions for Issue Creation
**What goes wrong:** `gh issue create` fails with permission error.
**Why it happens:** The `permissions` block only specifies `contents: write` and `pull-requests: write`, but creating issues requires `issues: write`.
**How to avoid:** Include `issues: write` in the permissions block since the conflict path creates a GitHub issue.
**Warning signs:** "Resource not accessible by integration" error when creating issues.

## Code Examples

### Complete Upstream Detection Step
```bash
# Source: Standard git operations, verified against git documentation
git remote add upstream https://github.com/paperclipai/paperclip.git 2>/dev/null || true
git fetch upstream master --quiet

UPSTREAM_HEAD=$(git rev-parse upstream/master)
MERGE_BASE=$(git merge-base HEAD upstream/master)

if [ "$UPSTREAM_HEAD" = "$MERGE_BASE" ]; then
  echo "up_to_date=true" >> "$GITHUB_OUTPUT"
  echo "No new upstream commits. Exiting."
  exit 0
fi

BEHIND_COUNT=$(git rev-list --count HEAD..upstream/master)
echo "behind_count=$BEHIND_COUNT" >> "$GITHUB_OUTPUT"
echo "up_to_date=false" >> "$GITHUB_OUTPUT"
echo "Fork is $BEHIND_COUNT commits behind upstream."
```

### Complete Rerere Seed Step
```bash
# Source: Adapted from git/contrib/rerere-train.sh (https://github.com/git/git/blob/master/contrib/rerere-train.sh)
MERGE_COMMIT="8c83b0d"

git config rerere.enabled true
git config rerere.autoUpdate true

# Save current state
ORIG_HEAD=$(git rev-parse HEAD)

# Detach to first parent of the merge (fork side before merge)
git checkout --detach "${MERGE_COMMIT}^1" --quiet

# Attempt the same merge that originally conflicted
if ! git merge --no-commit --no-ff "${MERGE_COMMIT}^2" >/dev/null 2>&1; then
  echo "Conflicts detected in training merge -- recording conflict state..."
  git rerere

  # Apply the known resolution from the actual merge commit
  git checkout "${MERGE_COMMIT}" -- . 2>/dev/null
  git rerere

  echo "Rerere trained with Phase 6 conflict resolutions."
else
  echo "Training merge was clean -- no rerere entries needed."
fi

# Return to original position
git checkout --force --quiet "$ORIG_HEAD"
echo "Rerere cache seeded."
```

### Complete Area-Grouped Changelog Generator
```bash
# Source: Derived from CONFLICT-MAP.md area categories and git log
generate_changelog() {
  local base_commit="$1"

  declare -A area_commits
  local areas=("DB" "Server" "UI" "Packages" "CLI" "Infrastructure" "Other")

  # Get commits with their changed files
  while IFS= read -r line; do
    if [[ "$line" =~ ^[a-f0-9]+ ]]; then
      current_hash="${line%% *}"
      current_msg="${line#* }"
      current_areas=()
    elif [[ -n "$line" ]]; then
      case "$line" in
        packages/db/*|*/migrations/*)  current_areas+=("DB") ;;
        server/*)                       current_areas+=("Server") ;;
        ui/*)                           current_areas+=("UI") ;;
        packages/*)                     current_areas+=("Packages") ;;
        cli/*)                          current_areas+=("CLI") ;;
        Dockerfile*|docker-compose*|.github/*) current_areas+=("Infrastructure") ;;
        *)                              current_areas+=("Other") ;;
      esac
    else
      # Blank line separator -- assign commit to detected areas
      if [[ ${#current_areas[@]} -eq 0 ]]; then
        current_areas=("Other")
      fi
      # Deduplicate areas for this commit
      local unique_areas=($(printf '%s\n' "${current_areas[@]}" | sort -u))
      for area in "${unique_areas[@]}"; do
        area_commits["$area"]+="- ${current_msg} (\`${current_hash:0:7}\`)\n"
      done
    fi
  done < <(git log --oneline --name-only "${base_commit}..upstream/master" && echo "")

  # Build markdown body
  local body="## Upstream Changes\n\n"
  for area in "${areas[@]}"; do
    if [[ -n "${area_commits[$area]}" ]]; then
      body+="### ${area}\n${area_commits[$area]}\n"
    fi
  done

  echo -e "$body"
}
```

### Complete Sync Status JSON Update
```bash
# Source: shields.io endpoint badge documentation (https://shields.io/badges/endpoint-badge)
update_sync_status() {
  local behind_count="$1"
  local status="$2"  # "synced", "pending", "conflicts"
  local today=$(date -u +%Y-%m-%d)
  local color

  if [ "$behind_count" -eq 0 ]; then
    color="brightgreen"
  elif [ "$behind_count" -lt 10 ]; then
    color="green"
  elif [ "$behind_count" -lt 50 ]; then
    color="yellow"
  else
    color="red"
  fi

  if [ "$status" = "conflicts" ]; then
    color="red"
  fi

  cat > .github/sync-status.json << EOF
{
  "schemaVersion": 1,
  "label": "upstream sync",
  "message": "${behind_count} behind | ${today}",
  "color": "${color}"
}
EOF
}
```

### Conflict Report Issue Creation
```bash
# Source: gh CLI documentation + CONFLICT-MAP.md area patterns
create_conflict_issue() {
  local conflict_files
  conflict_files=$(git diff --name-only --diff-filter=U)

  # Group by area
  declare -A area_files
  while IFS= read -r file; do
    local area
    case "$file" in
      packages/db/*|*/migrations/*)  area="DB Migrations" ;;
      server/*)                       area="Server" ;;
      ui/*)                           area="UI" ;;
      packages/*)                     area="Shared Packages" ;;
      Dockerfile*|docker-compose*|.github/*) area="Infrastructure" ;;
      *)                              area="Other" ;;
    esac
    area_files["$area"]+="- \`${file}\`\n"
  done <<< "$conflict_files"

  # Build issue body
  local body="## Upstream Sync Conflicts\n\n"
  body+="Automated sync detected merge conflicts with upstream/master.\n\n"
  body+="**Conflicting files by area:**\n\n"
  for area in "${!area_files[@]}"; do
    body+="### ${area}\n${area_files[$area]}\n"
  done
  body+="\n---\n*Auto-generated by upstream-sync workflow*"

  echo -e "$body" | gh issue create \
    --title "Upstream sync: merge conflicts detected ($(date -u +%Y-%m-%d))" \
    --body-file - \
    --label "upstream-sync"
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual fork sync | GitHub "Sync fork" button | 2022 | Only works for fast-forward; no good for forks with custom commits |
| Third-party sync actions | Custom workflow with `gh` CLI | 2024+ | Full control over merge strategy, PR content, conflict handling |
| Static badges | shields.io endpoint/dynamic badges | 2023+ | Badge content driven by repo JSON, no external server needed |
| Per-repo rerere setup | rerere-train.sh from merge history | Long-standing | Seeds rr-cache programmatically from existing merge commits |

**Deprecated/outdated:**
- GitHub's built-in "Sync fork" button: Does not handle merge conflicts or provide changelog; only works for fast-forward syncs
- Third-party sync services (Mergify, Kodiak): Excluded per project requirements (Out of Scope)

## Open Questions

1. **PR Policy Exemption for Sync Branch**
   - What we know: `pr-policy.yml` blocks PRs that include `pnpm-lock.yaml` changes unless branch is `chore/refresh-lockfile`
   - What's unclear: Whether to exempt the sync branch or split lockfile into a separate step
   - Recommendation: Exempt the sync branch name (e.g., `chore/upstream-sync`) in `pr-policy.yml` -- this is a one-line change and keeps the lockfile regeneration atomic with the merge

2. **Rerere Training Scope**
   - What we know: Commit `8c83b0d` has 16 conflict resolutions. The rerere-train.sh approach replays the merge to seed the cache.
   - What's unclear: Whether future merges will encounter the exact same conflict hunks (rerere matches on conflict content, not file paths)
   - Recommendation: Seed from `8c83b0d` as a best-effort optimization. If upstream changes the same areas, rerere will handle identical hunks automatically. Novel conflicts will still need manual resolution.

3. **GitHub Labels for Issues**
   - What we know: `gh issue create --label "upstream-sync"` requires the label to exist
   - What's unclear: Whether the `upstream-sync` label exists in the repo
   - Recommendation: Create the label in the workflow if it does not exist, or create it manually before the first run

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | GitHub Actions (workflow_dispatch manual testing) |
| Config file | `.github/workflows/upstream-sync.yml` |
| Quick run command | `gh workflow run upstream-sync.yml` (manual dispatch) |
| Full suite command | Manual dispatch + verify PR/issue creation + badge update |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-01 | Detects new upstream commits on schedule | manual/smoke | `gh workflow run upstream-sync.yml` then check run logs | No -- Wave 0 |
| SYNC-02 | Sync PR created with grouped changelog | manual/smoke | Verify PR body after workflow run | No -- Wave 0 |
| SYNC-03 | Conflict report issue with area grouping | manual/smoke | Force conflict scenario, verify issue | No -- Wave 0 |
| SYNC-04 | Lockfile auto-regenerated | manual/smoke | Check sync PR includes fresh lockfile | No -- Wave 0 |
| SYNC-05 | git rerere seeds and auto-resolves | manual/smoke | Check workflow logs for rerere output | No -- Wave 0 |
| SYNC-06 | README badge shows sync status | manual/smoke | Verify badge URL resolves, JSON file committed | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** Manual dispatch + check workflow run status via `gh run view`
- **Per wave merge:** Full manual dispatch with upstream ahead state
- **Phase gate:** Successful workflow run with PR or issue created

### Wave 0 Gaps
- [ ] `.github/workflows/upstream-sync.yml` -- the main workflow file (this IS the deliverable)
- [ ] `.github/sync-status.json` -- initial badge data file
- [ ] README.md badge row -- add sync badge alongside existing badges
- [ ] `pr-policy.yml` update -- exempt sync branch from lockfile check
- [ ] `upstream-sync` label -- create if not exists (can be done in workflow)

Note: This phase is primarily infrastructure/workflow code. The "tests" are manual dispatch runs that validate the workflow produces the expected artifacts (PR, issue, badge JSON). There are no unit tests to write -- the workflow itself is the deliverable.

## Sources

### Primary (HIGH confidence)
- [git-scm.com/docs/git-rerere](https://git-scm.com/docs/git-rerere) -- rerere command reference, configuration options, cache mechanics
- [shields.io/badges/endpoint-badge](https://shields.io/badges/endpoint-badge) -- Endpoint badge JSON schema (schemaVersion, label, message, color fields)
- [git/contrib/rerere-train.sh](https://github.com/git/git/blob/master/contrib/rerere-train.sh) -- Official git contrib script for seeding rerere from merge history
- Existing workflows in `.github/workflows/` -- refresh-lockfile.yml (PR creation pattern), pr-policy.yml (lockfile policy), pr-verify.yml (CI pattern)
- [GitHub CLI: gh pr create](https://cli.github.com/manual/gh_pr_create) -- PR creation options and flags
- [GitHub Actions: Automatic token authentication](https://docs.github.com/actions/security-guides/automatic-token-authentication) -- GITHUB_TOKEN permissions

### Secondary (MEDIUM confidence)
- [GitHub Actions events that trigger workflows](https://docs.github.com/actions/learn-github-actions/events-that-trigger-workflows) -- schedule + workflow_dispatch combined triggers
- [Fix conflicts only once with git rerere](https://medium.com/@porteneuve/fix-conflicts-only-once-with-git-rerere-7d116b2cec67) -- rerere.autoUpdate behavior explanation
- [aormsby/Fork-Sync-With-Upstream-action](https://github.com/aormsby/Fork-Sync-With-Upstream-action) -- Reference implementation (not used, but validates approach patterns)

### Tertiary (LOW confidence)
- None -- all findings verified with primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All tools (GitHub Actions, gh CLI, shields.io, git rerere) are well-documented and in active use across the project's existing workflows
- Architecture: HIGH -- Pattern directly follows existing `refresh-lockfile.yml` workflow; shell commands are standard git operations
- Pitfalls: HIGH -- PR policy conflict identified by reading existing `pr-policy.yml`; SSH/HTTPS issue is well-known in CI contexts; permissions verified against GitHub docs

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable tools, 30-day validity)
