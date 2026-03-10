import { describe, expect, it, vi } from "vitest";
import type { Db } from "@paperclipai/db";
import { costService } from "../services/costs.js";

/**
 * Create a mock DB that returns configurable query results.
 * The mock follows the select().from().where() / leftJoin().where().groupBy().orderBy() chain patterns
 * used by costService.
 */
function createMockDb(options: {
  company?: { id: string; budgetMonthlyCents: number } | null;
  costSumTotal?: number;
  tokenStats?: { totalTokens: number; totalCached: number; totalInput: number; runCount: number };
  costByAgentRows?: Array<{
    agentId: string;
    agentName: string | null;
    agentStatus: string | null;
    costCents: number;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
  }>;
  runRows?: Array<{
    agentId: string;
    apiRunCount: number;
    subscriptionRunCount: number;
    subscriptionInputTokens: number;
    subscriptionOutputTokens: number;
  }>;
  byProjectRows?: Array<{
    projectId: string;
    projectName: string;
    costCents: number;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
  }>;
}): Db {
  let callCount = 0;

  const createChain = (result: unknown) => {
    const chain: Record<string, unknown> = {};
    const resolver = () => Promise.resolve(result);
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.leftJoin = vi.fn().mockReturnValue(chain);
    chain.innerJoin = vi.fn().mockReturnValue(chain);
    chain.groupBy = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockImplementation(resolver);
    chain.then = vi.fn().mockImplementation((cb: (v: unknown) => unknown) => Promise.resolve(result).then(cb));
    return chain;
  };

  return {
    select: vi.fn().mockImplementation(() => {
      callCount++;
      // summary() makes two queries:
      // 1st: cost sum total
      // 2nd: token stats
      if (callCount === 1 && options.company !== undefined) {
        // This is the company query
        return createChain([options.company]);
      }
      if (callCount === 2 && options.costSumTotal !== undefined) {
        // Cost sum query
        return createChain([{ total: options.costSumTotal }]);
      }
      if (callCount === 3 && options.tokenStats) {
        // Token stats query
        return createChain([options.tokenStats]);
      }
      // byAgent: first call returns costRows, second returns runRows
      if (options.costByAgentRows && callCount === 1) {
        return createChain(options.costByAgentRows);
      }
      if (options.runRows && callCount === 2) {
        return createChain(options.runRows);
      }
      return createChain([]);
    }),
    selectDistinctOn: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              as: vi.fn().mockReturnValue("run_project_links"),
            }),
          }),
        }),
      }),
    }),
  } as unknown as Db;
}

describe("costService.summary token analytics", () => {
  it("returns totalTokens, cacheHitRate, and avgTokensPerRun", async () => {
    const db = createMockDb({
      company: { id: "c1", budgetMonthlyCents: 10000 },
      costSumTotal: 500,
      tokenStats: {
        totalTokens: 5000,
        totalCached: 2000,
        totalInput: 5000,
        runCount: 10,
      },
    });

    const service = costService(db);
    const result = await service.summary("c1");

    expect(result).toHaveProperty("totalTokens");
    expect(result).toHaveProperty("cacheHitRate");
    expect(result).toHaveProperty("avgTokensPerRun");
    expect(result.totalTokens).toBe(5000);
    expect(result.avgTokensPerRun).toBe(500);
  });

  it("computes cacheHitRate correctly: 400/1000 = 40.0", async () => {
    const db = createMockDb({
      company: { id: "c1", budgetMonthlyCents: 10000 },
      costSumTotal: 100,
      tokenStats: {
        totalTokens: 2000,
        totalCached: 400,
        totalInput: 1000,
        runCount: 5,
      },
    });

    const service = costService(db);
    const result = await service.summary("c1");

    expect(result.cacheHitRate).toBe(40.0);
  });

  it("cacheHitRate is 0 when totalInput is 0", async () => {
    const db = createMockDb({
      company: { id: "c1", budgetMonthlyCents: 10000 },
      costSumTotal: 0,
      tokenStats: {
        totalTokens: 0,
        totalCached: 0,
        totalInput: 0,
        runCount: 0,
      },
    });

    const service = costService(db);
    const result = await service.summary("c1");

    expect(result.cacheHitRate).toBe(0);
    expect(result.avgTokensPerRun).toBe(0);
  });
});

describe("costService.byAgent cachedInputTokens", () => {
  it("returns objects with cachedInputTokens field", async () => {
    const db = createMockDb({
      costByAgentRows: [
        {
          agentId: "a1",
          agentName: "Agent 1",
          agentStatus: "active",
          costCents: 100,
          inputTokens: 500,
          outputTokens: 200,
          cachedInputTokens: 150,
        },
      ],
      runRows: [
        {
          agentId: "a1",
          apiRunCount: 3,
          subscriptionRunCount: 1,
          subscriptionInputTokens: 100,
          subscriptionOutputTokens: 50,
        },
      ],
    });

    const service = costService(db);
    const result = await service.byAgent("c1");

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("cachedInputTokens", 150);
    expect(result[0]).toHaveProperty("inputTokens", 500);
    expect(result[0]).toHaveProperty("outputTokens", 200);
  });
});

describe("costService.byProject cachedInputTokens", () => {
  it("returns objects with cachedInputTokens field", async () => {
    // byProject uses a complex subquery pattern with selectDistinctOn
    // We test that the select fields include cachedInputTokens
    // by verifying the service function can be called and the mock structure works
    const selectChain: Record<string, unknown> = {};
    const byProjectResults = [
      {
        projectId: "p1",
        projectName: "Project 1",
        costCents: 200,
        inputTokens: 1000,
        outputTokens: 500,
        cachedInputTokens: 300,
      },
    ];

    selectChain.from = vi.fn().mockReturnValue(selectChain);
    selectChain.innerJoin = vi.fn().mockReturnValue(selectChain);
    selectChain.where = vi.fn().mockReturnValue(selectChain);
    selectChain.groupBy = vi.fn().mockReturnValue(selectChain);
    selectChain.orderBy = vi.fn().mockResolvedValue(byProjectResults);

    const subqueryChain: Record<string, unknown> = {};
    subqueryChain.from = vi.fn().mockReturnValue(subqueryChain);
    subqueryChain.innerJoin = vi.fn().mockReturnValue(subqueryChain);
    subqueryChain.where = vi.fn().mockReturnValue(subqueryChain);
    subqueryChain.orderBy = vi.fn().mockReturnValue(subqueryChain);
    subqueryChain.as = vi.fn().mockReturnValue("run_project_links");

    const db = {
      select: vi.fn().mockReturnValue(selectChain),
      selectDistinctOn: vi.fn().mockReturnValue(subqueryChain),
    } as unknown as Db;

    const service = costService(db);
    const result = await service.byProject("c1");

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("cachedInputTokens", 300);
    expect(result[0]).toHaveProperty("inputTokens", 1000);
    expect(result[0]).toHaveProperty("outputTokens", 500);
  });
});
