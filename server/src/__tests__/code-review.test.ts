import { describe, expect, it } from "vitest";
import type { ReviewComment, ReviewResult } from "../services/review-providers/types.js";
import { parsePrUrl, buildReviewPayload } from "../services/review-providers/github.js";

describe("ReviewComment type", () => {
  it("includes path, line, side, body, severity fields", () => {
    const comment: ReviewComment = {
      path: "src/index.ts",
      line: 42,
      side: "RIGHT",
      body: "Consider using a constant here",
      severity: "suggestion",
    };
    expect(comment.path).toBe("src/index.ts");
    expect(comment.line).toBe(42);
    expect(comment.side).toBe("RIGHT");
    expect(comment.body).toBe("Consider using a constant here");
    expect(comment.severity).toBe("suggestion");
  });
});

describe("ReviewResult type", () => {
  it("includes event, summary, comments fields", () => {
    const result: ReviewResult = {
      event: "COMMENT",
      summary: "Looks good overall with minor suggestions",
      comments: [
        {
          path: "src/index.ts",
          line: 10,
          side: "RIGHT",
          body: "Unused import",
          severity: "nitpick",
        },
      ],
    };
    expect(result.event).toBe("COMMENT");
    expect(result.summary).toBe("Looks good overall with minor suggestions");
    expect(result.comments).toHaveLength(1);
  });

  it("supports APPROVE, REQUEST_CHANGES, and COMMENT events", () => {
    const events: ReviewResult["event"][] = ["APPROVE", "REQUEST_CHANGES", "COMMENT"];
    for (const event of events) {
      const result: ReviewResult = { event, summary: "test", comments: [] };
      expect(result.event).toBe(event);
    }
  });
});

describe("parsePrUrl", () => {
  it("extracts owner, repo, pullNumber from standard GitHub PR URL", () => {
    const result = parsePrUrl("https://github.com/octocat/hello-world/pull/42");
    expect(result).toEqual({ owner: "octocat", repo: "hello-world", pullNumber: 42 });
  });

  it("handles URL with trailing slash", () => {
    const result = parsePrUrl("https://github.com/org/repo/pull/123/");
    expect(result).toEqual({ owner: "org", repo: "repo", pullNumber: 123 });
  });

  it("handles URL with .diff suffix", () => {
    const result = parsePrUrl("https://github.com/org/repo/pull/99.diff");
    expect(result).toEqual({ owner: "org", repo: "repo", pullNumber: 99 });
  });

  it("handles URL with extra path segments (files, commits)", () => {
    const result = parsePrUrl("https://github.com/org/repo/pull/55/files");
    expect(result).toEqual({ owner: "org", repo: "repo", pullNumber: 55 });
  });

  it("throws on non-GitHub URL", () => {
    expect(() => parsePrUrl("https://gitlab.com/org/repo/merge_requests/1")).toThrow();
  });

  it("throws on malformed URL without pull segment", () => {
    expect(() => parsePrUrl("https://github.com/org/repo/issues/42")).toThrow();
  });
});

describe("buildReviewPayload", () => {
  it("maps ReviewResult to GitHub API format with line+side fields", () => {
    const review: ReviewResult = {
      event: "REQUEST_CHANGES",
      summary: "Several issues need addressing",
      comments: [
        {
          path: "src/auth.ts",
          line: 15,
          side: "RIGHT",
          body: "Missing null check",
          severity: "critical",
        },
        {
          path: "src/utils.ts",
          line: 30,
          side: "LEFT",
          body: "Consider refactoring this",
          severity: "suggestion",
        },
      ],
    };

    const payload = buildReviewPayload(review);
    expect(payload.event).toBe("REQUEST_CHANGES");
    expect(payload.body).toBe("Several issues need addressing");
    expect(payload.comments).toHaveLength(2);
    expect(payload.comments[0]).toEqual({
      path: "src/auth.ts",
      line: 15,
      side: "RIGHT",
      body: "Missing null check",
    });
    expect(payload.comments[1]).toEqual({
      path: "src/utils.ts",
      line: 30,
      side: "LEFT",
      body: "Consider refactoring this",
    });
  });

  it("filters out nitpick comments when configured", () => {
    const review: ReviewResult = {
      event: "COMMENT",
      summary: "Minor feedback",
      comments: [
        {
          path: "src/index.ts",
          line: 5,
          side: "RIGHT",
          body: "Critical issue",
          severity: "critical",
        },
        {
          path: "src/index.ts",
          line: 10,
          side: "RIGHT",
          body: "Nitpick about naming",
          severity: "nitpick",
        },
        {
          path: "src/index.ts",
          line: 20,
          side: "RIGHT",
          body: "Consider this approach",
          severity: "suggestion",
        },
      ],
    };

    const payload = buildReviewPayload(review, { filterNitpicks: true });
    expect(payload.comments).toHaveLength(2);
    expect(payload.comments.every((c: { body: string }) => !c.body.includes("Nitpick"))).toBe(true);
  });

  it("includes all comments when filterNitpicks is false", () => {
    const review: ReviewResult = {
      event: "COMMENT",
      summary: "Feedback",
      comments: [
        {
          path: "src/a.ts",
          line: 1,
          side: "RIGHT",
          body: "Nitpick",
          severity: "nitpick",
        },
      ],
    };

    const payload = buildReviewPayload(review, { filterNitpicks: false });
    expect(payload.comments).toHaveLength(1);
  });

  it("includes all comments when no options provided", () => {
    const review: ReviewResult = {
      event: "COMMENT",
      summary: "Feedback",
      comments: [
        {
          path: "src/a.ts",
          line: 1,
          side: "RIGHT",
          body: "Nitpick",
          severity: "nitpick",
        },
      ],
    };

    const payload = buildReviewPayload(review);
    expect(payload.comments).toHaveLength(1);
  });
});
