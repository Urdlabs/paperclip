export interface GitHubAppConfig {
  id: string;
  githubAppId: number;
  githubAppSlug: string;
  appName: string;
  htmlUrl: string | null;
  permissions: Record<string, string> | null;
  events: string[] | null;
  createdAt: Date;
}

export interface GitHubAppInstallation {
  id: string;
  installationId: number;
  accountLogin: string;
  accountType: string;
  repositorySelection: string | null;
  suspendedAt: Date | null;
  createdAt: Date;
}

export interface GitHubAppStatus {
  configured: boolean;
  appName: string | null;
  appSlug: string | null;
  htmlUrl: string | null;
  installationCount: number;
}
