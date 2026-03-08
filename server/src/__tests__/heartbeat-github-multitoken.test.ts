import { describe, expect, it } from "vitest";

/**
 * Tests for the multi-token git credential injection logic.
 *
 * These are pure-function tests that verify the env-var construction
 * algorithm without needing the full heartbeat service wiring.
 */

interface InstallationToken {
  token: string;
  accountLogin: string;
  installationId: number;
}

/**
 * Extracted logic that mirrors what heartbeat.ts does when building
 * the GIT_CONFIG_* env patch from installation tokens.
 */
function buildGitConfigEnvPatch(tokens: InstallationToken[]): Record<string, string> {
  if (tokens.length === 0) return {};

  const envPatch: Record<string, string> = {
    GITHUB_TOKEN: tokens[0]!.token,
    GH_TOKEN: tokens[0]!.token,
    GIT_ASKPASS: "/usr/local/bin/paperclip-git-askpass",
  };

  let configIdx = 0;
  for (const t of tokens) {
    // HTTPS rewrite
    envPatch[`GIT_CONFIG_KEY_${configIdx}`] =
      `url.https://x-access-token:${t.token}@github.com/${t.accountLogin}/.insteadOf`;
    envPatch[`GIT_CONFIG_VALUE_${configIdx}`] =
      `https://github.com/${t.accountLogin}/`;
    configIdx++;
    // SSH rewrite
    envPatch[`GIT_CONFIG_KEY_${configIdx}`] =
      `url.https://x-access-token:${t.token}@github.com/${t.accountLogin}/.insteadOf`;
    envPatch[`GIT_CONFIG_VALUE_${configIdx}`] =
      `git@github.com:${t.accountLogin}/`;
    configIdx++;
  }
  envPatch.GIT_CONFIG_COUNT = String(configIdx);

  return envPatch;
}

describe("buildGitConfigEnvPatch", () => {
  it("returns empty object when no tokens", () => {
    expect(buildGitConfigEnvPatch([])).toEqual({});
  });

  it("sets GITHUB_TOKEN and GH_TOKEN to first token", () => {
    const tokens: InstallationToken[] = [
      { token: "tok-a", accountLogin: "orgA", installationId: 1 },
      { token: "tok-b", accountLogin: "orgB", installationId: 2 },
    ];
    const env = buildGitConfigEnvPatch(tokens);
    expect(env.GITHUB_TOKEN).toBe("tok-a");
    expect(env.GH_TOKEN).toBe("tok-a");
  });

  it("creates HTTPS and SSH insteadOf rules for each token", () => {
    const tokens: InstallationToken[] = [
      { token: "tok-a", accountLogin: "orgA", installationId: 1 },
    ];
    const env = buildGitConfigEnvPatch(tokens);

    // HTTPS rule (index 0)
    expect(env.GIT_CONFIG_KEY_0).toBe(
      "url.https://x-access-token:tok-a@github.com/orgA/.insteadOf",
    );
    expect(env.GIT_CONFIG_VALUE_0).toBe("https://github.com/orgA/");

    // SSH rule (index 1)
    expect(env.GIT_CONFIG_KEY_1).toBe(
      "url.https://x-access-token:tok-a@github.com/orgA/.insteadOf",
    );
    expect(env.GIT_CONFIG_VALUE_1).toBe("git@github.com:orgA/");
  });

  it("sets GIT_CONFIG_COUNT to total number of rules (2 per token)", () => {
    const tokens: InstallationToken[] = [
      { token: "tok-a", accountLogin: "orgA", installationId: 1 },
      { token: "tok-b", accountLogin: "orgB", installationId: 2 },
      { token: "tok-c", accountLogin: "personal", installationId: 3 },
    ];
    const env = buildGitConfigEnvPatch(tokens);

    expect(env.GIT_CONFIG_COUNT).toBe("6"); // 3 tokens * 2 rules each
  });

  it("indexes rules sequentially across multiple tokens", () => {
    const tokens: InstallationToken[] = [
      { token: "tok-a", accountLogin: "orgA", installationId: 1 },
      { token: "tok-b", accountLogin: "orgB", installationId: 2 },
    ];
    const env = buildGitConfigEnvPatch(tokens);

    // orgA HTTPS = 0, orgA SSH = 1, orgB HTTPS = 2, orgB SSH = 3
    expect(env.GIT_CONFIG_KEY_0).toContain("orgA");
    expect(env.GIT_CONFIG_VALUE_0).toBe("https://github.com/orgA/");
    expect(env.GIT_CONFIG_KEY_1).toContain("orgA");
    expect(env.GIT_CONFIG_VALUE_1).toBe("git@github.com:orgA/");
    expect(env.GIT_CONFIG_KEY_2).toContain("orgB");
    expect(env.GIT_CONFIG_VALUE_2).toBe("https://github.com/orgB/");
    expect(env.GIT_CONFIG_KEY_3).toContain("orgB");
    expect(env.GIT_CONFIG_VALUE_3).toBe("git@github.com:orgB/");
    expect(env.GIT_CONFIG_COUNT).toBe("4");
  });

  it("always includes GIT_ASKPASS as fallback", () => {
    const tokens: InstallationToken[] = [
      { token: "tok-a", accountLogin: "orgA", installationId: 1 },
    ];
    const env = buildGitConfigEnvPatch(tokens);
    expect(env.GIT_ASKPASS).toBe("/usr/local/bin/paperclip-git-askpass");
  });

  it("uses correct token per org in the insteadOf URL", () => {
    const tokens: InstallationToken[] = [
      { token: "secret-for-orgA", accountLogin: "orgA", installationId: 1 },
      { token: "secret-for-orgB", accountLogin: "orgB", installationId: 2 },
    ];
    const env = buildGitConfigEnvPatch(tokens);

    // orgA's HTTPS rule should have orgA's token
    expect(env.GIT_CONFIG_KEY_0).toContain("secret-for-orgA@github.com/orgA/");
    // orgB's HTTPS rule should have orgB's token
    expect(env.GIT_CONFIG_KEY_2).toContain("secret-for-orgB@github.com/orgB/");
  });
});
