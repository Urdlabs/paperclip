import { api } from "./client";
import type { GitHubAppStatus, GitHubAppInstallation } from "@paperclipai/shared";

export const githubApi = {
  /** Get the GitHub App manifest and redirect URL. */
  getManifest: (opts?: { org?: string; companyId?: string }) => {
    const params = new URLSearchParams();
    if (opts?.org) params.set("org", opts.org);
    if (opts?.companyId) params.set("companyId", opts.companyId);
    const qs = params.toString();
    return api.get<{ manifest: Record<string, unknown>; redirectUrl: string }>(
      qs ? `/github/manifest?${qs}` : "/github/manifest",
    );
  },

  /** Get the current GitHub App status (all apps). */
  getStatus: (companyId?: string) => {
    const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
    return api.get<GitHubAppStatus>(`/github/status${qs}`);
  },

  /** List all GitHub App installations (flat, across all apps). */
  getInstallations: () =>
    api.get<{ installations: GitHubAppInstallation[] }>("/github/installations"),

  /** Sync installations for a specific app from GitHub API. */
  syncInstallations: (appId: string) =>
    api.post<{ installations: GitHubAppInstallation[] }>(`/github/installations/${appId}/sync`, {}),

  /** Get the URL to install a specific app on repos. */
  getInstallUrl: (appId: string) => api.get<{ url: string }>(`/github/install-url/${appId}`),

  /** Remove a specific GitHub App configuration. */
  deleteApp: (appId: string) => api.delete<{ ok: boolean }>(`/github/app/${appId}`),
};
