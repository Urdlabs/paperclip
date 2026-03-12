import { eq, and, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { issues, agents, heartbeatRuns, githubAppInstallations } from "@paperclipai/db";
import type { ReviewContext, ReviewProvider, ReviewResult } from "./review-providers/types.js";
import { createGitHubReviewProvider, parsePrUrl } from "./review-providers/github.js";
import { logger as rootLogger } from "../middleware/logger.js";

const logger = rootLogger.child({ service: "code-review" });

/**
 * Code review orchestration service.
 *
 * Prepares review context (diff + existing reviews + incremental data)
 * and submits structured reviews via the appropriate provider.
 */
export function codeReviewService(db: Db) {
  // Lazy import to avoid circular dependency with github-app.ts
  let _githubApp: Awaited<ReturnType<typeof import("./github-app.js").githubAppService>> | null = null;
  async function getGitHubApp() {
    if (!_githubApp) {
      const { githubAppService } = await import("./github-app.js");
      _githubApp = githubAppService(db);
    }
    return _githubApp;
  }

  /**
   * Create an authenticated fetch function for the GitHub API
   * using the installation token for the given repo's organization.
   */
  async function getAuthenticatedGithubFetch(
    companyId: string,
    repoOwner: string,
  ): Promise<typeof fetch> {
    const ghApp = await getGitHubApp();

    // Find installation for this org/user
    const installations = await db
      .select()
      .from(githubAppInstallations)
      .where(eq(githubAppInstallations.accountLogin, repoOwner));

    if (installations.length === 0) {
      throw new Error(`No GitHub App installation found for "${repoOwner}"`);
    }

    const installation = installations[0]!;
    const token = await ghApp.generateInstallationToken({
      installationId: installation.installationId,
      companyId,
    });

    if (!token) {
      throw new Error(`Failed to generate installation token for "${repoOwner}"`);
    }

    // Return a fetch wrapper with the authorization header
    return (url: string | URL | Request, opts?: RequestInit) => {
      const headers = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${token}`,
        ...(opts?.headers as Record<string, string> | undefined),
      };
      return fetch(typeof url === "string" ? url : url, { ...opts, headers });
    };
  }

  /**
   * Get the appropriate ReviewProvider for a PR URL.
   * Currently only GitHub is supported.
   */
  async function getReviewProvider(
    prUrl: string,
    companyId: string,
  ): Promise<ReviewProvider> {
    if (prUrl.includes("github.com")) {
      const { owner } = parsePrUrl(prUrl);
      const authenticatedFetch = await getAuthenticatedGithubFetch(companyId, owner);
      return createGitHubReviewProvider(authenticatedFetch);
    }
    throw new Error(`No review provider available for URL: ${prUrl}`);
  }

  /**
   * Prepare the full review context for an issue (PR review task).
   *
   * Fetches the PR diff, existing reviews, and for incremental reviews
   * includes the previous review summary and diff since last review.
   */
  async function prepareReviewContext(issueId: string): Promise<ReviewContext> {
    // Load the issue
    const [issue] = await db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId));

    if (!issue) {
      throw new Error(`Issue not found: ${issueId}`);
    }

    const prUrl = issue.externalUrl;
    if (!prUrl) {
      throw new Error(`Issue ${issueId} has no external URL (PR link)`);
    }

    const provider = await getReviewProvider(prUrl, issue.companyId);

    // Fetch diff and existing reviews in parallel
    const [diff, existingReviews] = await Promise.all([
      provider.fetchDiff(prUrl),
      provider.fetchExistingReviews(prUrl),
    ]);

    const context: ReviewContext = {
      prUrl,
      prDescription: issue.description ?? "",
      diff,
      existingReviews,
    };

    // Check for incremental review: look for previous completed runs for this issue
    if (issue.assigneeAgentId) {
      const previousRuns = await db
        .select()
        .from(heartbeatRuns)
        .where(
          and(
            eq(heartbeatRuns.agentId, issue.assigneeAgentId),
            eq(heartbeatRuns.status, "succeeded"),
          ),
        )
        .orderBy(desc(heartbeatRuns.finishedAt))
        .limit(5);

      // Find a previous run that has review result data in contextSnapshot
      const previousReviewRun = previousRuns.find(
        (run) =>
          run.contextSnapshot &&
          (run.contextSnapshot as Record<string, unknown>).issueId === issueId &&
          (run.contextSnapshot as Record<string, unknown>).reviewSummary,
      );

      if (previousReviewRun) {
        const snapshot = previousReviewRun.contextSnapshot as Record<string, unknown>;
        context.previousReviewSummary = snapshot.reviewSummary as string;

        // Get incremental diff if we have the previous head SHA
        const previousHeadSha = snapshot.headSha as string | undefined;
        if (previousHeadSha) {
          try {
            // Parse the current PR to get the latest head SHA from the diff URL
            const { owner, repo, pullNumber } = parsePrUrl(prUrl);
            // Use the compare endpoint for incremental diff
            // The current head SHA would ideally come from the PR API,
            // but for now we use compareDiff if we have a base SHA
            context.diffSinceLastReview = await provider.compareDiff(
              prUrl,
              previousHeadSha,
              "HEAD",
            );
          } catch (err) {
            logger.warn(
              { err, issueId },
              "Failed to fetch incremental diff, falling back to full diff",
            );
          }
        }
      }
    }

    return context;
  }

  /**
   * Submit a review for an issue's PR.
   * Auto-posts directly to the platform (no approval gate).
   */
  async function submitReview(
    issueId: string,
    review: ReviewResult,
  ): Promise<void> {
    // Load the issue to get the PR URL
    const [issue] = await db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId));

    if (!issue) {
      throw new Error(`Issue not found: ${issueId}`);
    }

    const prUrl = issue.externalUrl;
    if (!prUrl) {
      throw new Error(`Issue ${issueId} has no external URL (PR link)`);
    }

    const provider = await getReviewProvider(prUrl, issue.companyId);
    await provider.submitReview(prUrl, review);

    logger.info(
      {
        issueId,
        prUrl,
        event: review.event,
        commentCount: review.comments.length,
      },
      "Review submitted to GitHub",
    );
  }

  return {
    prepareReviewContext,
    submitReview,
    getReviewProvider,
  };
}

export type CodeReviewServiceInstance = ReturnType<typeof codeReviewService>;
