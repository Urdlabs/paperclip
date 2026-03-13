import { describe, expect, it } from "vitest";
import type { ReviewResult } from "../services/review-providers/types.js";
import { parsePrUrl, buildReviewPayload } from "../services/review-providers/github.js";
import type { PrUrlParts, GitHubReviewPayload } from "../services/review-providers/github.js";

/**
 * Integration tests for code review service contracts.
 *
 * Complements existing unit tests in code-review.test.ts by verifying
 * the return type shapes and contract guarantees of parsePrUrl and
 * buildReviewPayload -- the two pure functions exported from the
 * GitHub review provider.
 */

describe("v1.0 integration: code review service contracts", () => {
  describe("parsePrUrl return shape contract", () => {
    it("returns an object with owner, repo, and pullNumber fields", () => {
      const result: PrUrlParts = parsePrUrl(
        "https://github.com/acme/widget/pull/42",
      );

      // Verify the shape has exactly the expected keys
      expect(result).toHaveProperty("owner");
      expect(result).toHaveProperty("repo");
      expect(result).toHaveProperty("pullNumber");

      // Verify types
      expect(typeof result.owner).toBe("string");
      expect(typeof result.repo).toBe("string");
      expect(typeof result.pullNumber).toBe("number");
    });

    it("returns integer pullNumber (not float)", () => {
      const result = parsePrUrl("https://github.com/org/repo/pull/999");
      expect(Number.isInteger(result.pullNumber)).toBe(true);
    });

    it("strips no extra fields (contract stability)", () => {
      const result = parsePrUrl("https://github.com/org/repo/pull/1");
      const keys = Object.keys(result).sort();
      expect(keys).toEqual(["owner", "pullNumber", "repo"]);
    });

    it("throws Error (not other types) for invalid URLs", () => {
      expect(() => parsePrUrl("https://bitbucket.org/org/repo/pull/1")).toThrow(
        Error,
      );
      expect(() =>
        parsePrUrl("https://bitbucket.org/org/repo/pull/1"),
      ).toThrow(/not a valid github pr url/i);
    });
  });

  describe("buildReviewPayload return shape contract", () => {
    const sampleReview: ReviewResult = {
      event: "COMMENT",
      summary: "Overall code quality is good",
      comments: [
        {
          path: "src/main.ts",
          line: 10,
          side: "RIGHT",
          body: "Consider using a constant",
          severity: "suggestion",
        },
        {
          path: "src/utils.ts",
          line: 25,
          side: "LEFT",
          body: "Critical null check missing",
          severity: "critical",
        },
      ],
    };

    it("returns an object with body, event, and comments fields", () => {
      const payload: GitHubReviewPayload = buildReviewPayload(sampleReview);

      expect(payload).toHaveProperty("body");
      expect(payload).toHaveProperty("event");
      expect(payload).toHaveProperty("comments");

      expect(typeof payload.body).toBe("string");
      expect(typeof payload.event).toBe("string");
      expect(Array.isArray(payload.comments)).toBe(true);
    });

    it("maps summary to body field", () => {
      const payload = buildReviewPayload(sampleReview);
      expect(payload.body).toBe("Overall code quality is good");
    });

    it("preserves event type from ReviewResult", () => {
      const payload = buildReviewPayload(sampleReview);
      expect(payload.event).toBe("COMMENT");
    });

    it("maps each comment to path, line, side, body (no severity)", () => {
      const payload = buildReviewPayload(sampleReview);

      expect(payload.comments).toHaveLength(2);

      for (const comment of payload.comments) {
        expect(comment).toHaveProperty("path");
        expect(comment).toHaveProperty("line");
        expect(comment).toHaveProperty("side");
        expect(comment).toHaveProperty("body");
        // severity should NOT leak into the GitHub API payload
        expect(comment).not.toHaveProperty("severity");
      }
    });

    it("produces valid GitHub API event values", () => {
      const events: ReviewResult["event"][] = [
        "APPROVE",
        "REQUEST_CHANGES",
        "COMMENT",
      ];

      for (const event of events) {
        const review: ReviewResult = { event, summary: "test", comments: [] };
        const payload = buildReviewPayload(review);
        expect(["APPROVE", "REQUEST_CHANGES", "COMMENT"]).toContain(
          payload.event,
        );
      }
    });

    it("returns empty comments array when review has no comments", () => {
      const review: ReviewResult = {
        event: "APPROVE",
        summary: "LGTM",
        comments: [],
      };

      const payload = buildReviewPayload(review);
      expect(payload.comments).toEqual([]);
    });

    it("preserves comment line and side values exactly", () => {
      const payload = buildReviewPayload(sampleReview);

      expect(payload.comments[0]!.line).toBe(10);
      expect(payload.comments[0]!.side).toBe("RIGHT");
      expect(payload.comments[1]!.line).toBe(25);
      expect(payload.comments[1]!.side).toBe("LEFT");
    });
  });
});
