import type { ReviewProvider, ReviewResult } from "./types.js";

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

export interface PrUrlParts {
  owner: string;
  repo: string;
  pullNumber: number;
}

/**
 * Extract owner, repo, and pull number from a GitHub PR URL.
 *
 * Accepted formats:
 *   https://github.com/owner/repo/pull/123
 *   https://github.com/owner/repo/pull/123/
 *   https://github.com/owner/repo/pull/123/files
 *   https://github.com/owner/repo/pull/123.diff
 */
export function parsePrUrl(url: string): PrUrlParts {
  // Match: github.com/{owner}/{repo}/pull/{number} with optional trailing segments
  const match = url.match(
    /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/,
  );
  if (!match) {
    throw new Error(`Not a valid GitHub PR URL: ${url}`);
  }
  return {
    owner: match[1]!,
    repo: match[2]!,
    pullNumber: Number(match[3]),
  };
}

// ---------------------------------------------------------------------------
// Payload building
// ---------------------------------------------------------------------------

export interface GitHubReviewPayload {
  body: string;
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
  comments: Array<{
    path: string;
    line: number;
    side: "LEFT" | "RIGHT";
    body: string;
  }>;
}

export interface BuildPayloadOptions {
  filterNitpicks?: boolean;
}

/**
 * Map a ReviewResult to the GitHub PR Reviews API request body.
 * Uses the `line` + `side` fields (not the deprecated `position` field).
 */
export function buildReviewPayload(
  review: ReviewResult,
  options?: BuildPayloadOptions,
): GitHubReviewPayload {
  const filterNitpicks = options?.filterNitpicks ?? false;

  const comments = review.comments
    .filter((c) => !filterNitpicks || c.severity !== "nitpick")
    .map((c) => ({
      path: c.path,
      line: c.line,
      side: c.side,
      body: c.body,
    }));

  return {
    body: review.summary,
    event: review.event,
    comments,
  };
}

// ---------------------------------------------------------------------------
// GitHub Review Provider
// ---------------------------------------------------------------------------

const GITHUB_API = "https://api.github.com";

type FetchFn = (url: string, opts?: RequestInit) => Promise<Response>;

/**
 * Create a ReviewProvider that talks to the GitHub API.
 *
 * @param githubFetchFn An authenticated fetch function that includes
 *   the Authorization header (installation token) and GitHub API headers.
 */
export function createGitHubReviewProvider(githubFetchFn: FetchFn): ReviewProvider {
  async function fetchDiff(prUrl: string): Promise<string> {
    const { owner, repo, pullNumber } = parsePrUrl(prUrl);
    const res = await githubFetchFn(
      `${GITHUB_API}/repos/${owner}/${repo}/pulls/${pullNumber}`,
      {
        headers: { Accept: "application/vnd.github.diff" },
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch PR diff: ${res.status} ${res.statusText}`);
    }
    return res.text();
  }

  async function fetchExistingReviews(prUrl: string): Promise<string> {
    const { owner, repo, pullNumber } = parsePrUrl(prUrl);

    // Fetch reviews (top-level review summaries)
    const reviewsRes = await githubFetchFn(
      `${GITHUB_API}/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`,
    );
    if (!reviewsRes.ok) {
      throw new Error(`Failed to fetch reviews: ${reviewsRes.status}`);
    }
    const reviews = (await reviewsRes.json()) as Array<{
      user?: { login?: string };
      state?: string;
      body?: string;
    }>;

    // Fetch review comments (inline)
    const commentsRes = await githubFetchFn(
      `${GITHUB_API}/repos/${owner}/${repo}/pulls/${pullNumber}/comments`,
    );
    if (!commentsRes.ok) {
      throw new Error(`Failed to fetch review comments: ${commentsRes.status}`);
    }
    const comments = (await commentsRes.json()) as Array<{
      user?: { login?: string };
      body?: string;
      path?: string;
      line?: number;
    }>;

    // Format into a readable string for agent consumption
    const parts: string[] = [];

    if (reviews.length > 0) {
      parts.push("## Existing Reviews\n");
      for (const r of reviews) {
        const author = r.user?.login ?? "unknown";
        const state = r.state ?? "UNKNOWN";
        parts.push(`### ${author} (${state})`);
        if (r.body) parts.push(r.body);
        parts.push("");
      }
    }

    if (comments.length > 0) {
      parts.push("## Inline Comments\n");
      for (const c of comments) {
        const author = c.user?.login ?? "unknown";
        const location = c.path ? `${c.path}:${c.line ?? "?"}` : "general";
        parts.push(`**${author}** on \`${location}\`:`);
        if (c.body) parts.push(c.body);
        parts.push("");
      }
    }

    return parts.join("\n");
  }

  async function submitReview(prUrl: string, review: ReviewResult): Promise<void> {
    const { owner, repo, pullNumber } = parsePrUrl(prUrl);
    const payload = buildReviewPayload(review);

    const res = await githubFetchFn(
      `${GITHUB_API}/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to submit review: ${res.status} ${text}`);
    }
  }

  async function compareDiff(
    prUrl: string,
    baseSha: string,
    headSha: string,
  ): Promise<string> {
    const { owner, repo } = parsePrUrl(prUrl);
    const res = await githubFetchFn(
      `${GITHUB_API}/repos/${owner}/${repo}/compare/${baseSha}...${headSha}`,
      {
        headers: { Accept: "application/vnd.github.diff" },
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to compare diffs: ${res.status} ${res.statusText}`);
    }
    return res.text();
  }

  return {
    fetchDiff,
    fetchExistingReviews,
    submitReview,
    compareDiff,
  };
}
