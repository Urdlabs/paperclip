export interface ReviewComment {
  path: string;          // file path relative to repo root
  line: number;          // file line number
  side: "LEFT" | "RIGHT"; // LEFT = deletion line, RIGHT = addition/context
  body: string;          // comment text (markdown)
  severity: "critical" | "suggestion" | "nitpick";
}

export interface ReviewResult {
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
  summary: string;
  comments: ReviewComment[];
}

export interface ReviewContext {
  prUrl: string;
  prDescription: string;
  diff: string;
  existingReviews: string;     // previous review comments for context
  previousReviewSummary?: string; // agent's previous review (for incremental)
  diffSinceLastReview?: string;   // incremental diff
}

export interface ReviewProvider {
  fetchDiff(prUrl: string): Promise<string>;
  fetchExistingReviews(prUrl: string): Promise<string>;
  submitReview(prUrl: string, review: ReviewResult): Promise<void>;
  compareDiff(prUrl: string, baseSha: string, headSha: string): Promise<string>;
}
