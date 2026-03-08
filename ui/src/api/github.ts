import { api } from "./client";
import type { GitHubAppStatus, GitHubAppInstallation } from "@paperclipai/shared";

export const githubApi = {
  /** Get the GitHub App manifest and redirect URL. */
  getManifest: () =>
    api.get<{ manifest: Record<string, unknown>; redirectUrl: string }>("/github/manifest"),

  /** Get the current GitHub App status. */
  getStatus: () => api.get<GitHubAppStatus>("/github/status"),

  /** List all GitHub App installations. */
  getInstallations: () =>
    api.get<{ installations: GitHubAppInstallation[] }>("/github/installations"),

  /** Sync installations from GitHub API. */
  syncInstallations: () =>
    api.post<{ installations: GitHubAppInstallation[] }>("/github/installations/sync", {}),

  /** Get the URL to install the app on repos. */
  getInstallUrl: () => api.get<{ url: string }>("/github/install-url"),

  /** Remove the GitHub App configuration. */
  deleteApp: () => api.delete<{ ok: boolean }>("/github/app"),
};
