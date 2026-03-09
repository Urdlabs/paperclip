# Domain Pitfalls

**Domain:** AI agent orchestration platform (Paperclip fork) -- token optimization, context management, integrations, scaling
**Researched:** 2026-03-09

## Critical Pitfalls

Mistakes that cause rewrites, runaway costs, or agent reliability failures.

### Pitfall 1: Token Optimization Without Cached Token Tracking

**What goes wrong:** The cost tracking system (`cost_events` table, `costService`) records `inputTokens` and `outputTokens` but does not separately track cached input tokens in the billing/cost layer. The `UsageSummary` type has an optional `cachedInputTokens` field, and adapters report it (Claude adapter parses `cache_read_input_tokens`), but this data flows into the `usageJson` JSONB column on `heartbeat_runs` -- it never reaches `cost_events`. When you start optimizing for prompt caching (the single highest-ROI token optimization), you have no way to measure whether caching is actually working. You cannot answer "what percentage of our input tokens are cache hits?" from the cost tables.

**Why it happens:** The cost event schema was designed for simple input/output accounting. Cached tokens are a different billing tier (90% cheaper on Anthropic) but the schema treats all input tokens as one bucket. The `agent_runtime_state` table tracks `totalCachedInputTokens` as a running counter, but `cost_events` (the detailed per-event audit trail) does not.

**Consequences:** You implement prompt caching optimizations but cannot measure their impact. You may believe caching is working when it is not (or vice versa). Budget calculations become inaccurate because cached tokens cost 10x less than uncached tokens but are counted at the same rate.

**Prevention:**
- Add `cachedInputTokens` column to `cost_events` table before starting any token optimization work.
- Update the cost summary and by-agent queries to report cache hit rates.
- Add a dashboard metric for cache hit percentage per agent.

**Detection:** Look for agents where `agent_runtime_state.totalCachedInputTokens` is growing but there is no corresponding detail in cost events. Compare `usageJson.cachedInputTokens` on `heartbeat_runs` against cost event records.

**Phase mapping:** Must be addressed in the first phase, before any token optimization work begins.

---

### Pitfall 2: Session Resumption Fragility Across Claude Auto-Compaction

**What goes wrong:** Paperclip persists Claude session IDs in `agent_task_sessions` and resumes them via the `--resume <sessionId>` flag. The Claude adapter already handles the case where a session is unavailable (retries with a fresh session). However, Claude Code's auto-compaction is lossy -- when a session compacts, the summary loses critical context about Paperclip-specific procedures (the SKILL.md instructions, API patterns, heartbeat procedure steps). The agent wakes up, resumes a compacted session, and silently ignores the Paperclip skill procedures it was following moments before. It may skip checkout, fail to update issue status, or not post comments -- all because the compacted summary compressed away the "how to be a Paperclip agent" instructions.

**Why it happens:** Claude Code's auto-compaction fires at ~80% context usage and creates a lossy summary. System prompts injected via `--append-system-prompt-file` are re-injected on each run, but the conversation history summary may contradict or override the system prompt. The post-compaction behavior aggressively resumes implementation without reassessing context (a known Claude Code issue: anthropics/claude-code#14941).

**Consequences:** Agents that worked correctly for the first few heartbeats start behaving erratically after their sessions accumulate enough context to trigger compaction. Debugging is difficult because the session appears to be "working" (no errors), but the agent's behavior drifts. Skill procedures are the first casualty since they are long and detailed, making them prime compaction targets.

**Prevention:**
- For long-running task sessions, consider proactive session rotation instead of relying on auto-compaction. Clear the session after N heartbeats or after a task completes.
- Use `maxTurnsPerRun` (already in adapter config) aggressively to keep per-run context usage low.
- Add a `clearSession: true` flag to the adapter result when the agent detects it is losing coherence (though this requires the agent to self-diagnose, which is unreliable).
- Consider writing a context recovery hook that detects compaction events in the Claude stream JSON and logs a warning.
- Re-evaluate whether session resumption provides net positive ROI: the cache hit savings must exceed the cost of compaction-induced failures.

**Detection:** Agents that stop following the heartbeat procedure (skip checkout, do not post comments, do not update status) despite having correct SKILL.md instructions. Run logs showing the agent reading files it should already have in context. Increasing failure rates on agents with high heartbeat counts per task.

**Phase mapping:** Should be addressed alongside token optimization. Do not optimize for session reuse without measuring compaction impact first.

---

### Pitfall 3: Heartbeat Service Refactoring Breaks Session State Machine

**What goes wrong:** The heartbeat service (`server/src/services/heartbeat.ts`, 2457 lines) contains the session management, execution locking, wakeup queuing, and run lifecycle in a single monolithic file. Token optimization necessarily touches this file (prompt construction, session handling, context snapshot enrichment). Refactoring this file while simultaneously adding token optimization features creates a high risk of breaking the session state machine -- specifically the `enqueueWakeup()` transaction (~200 lines with multiple branches for `isSameExecutionAgent`, `shouldQueueFollowupForCommentWake`, `bypassIssueExecutionLock`) and the `executeRun()` function (~530 lines with double-nested try/catch).

**Why it happens:** The file is the core engine with no direct unit tests for its critical paths (noted in CONCERNS.md). The `enqueueWakeup()` function requires a running database to test. Changes to session resolution (`resolveRuntimeSessionParamsForWorkspace`, `resolveNextSessionState`) can subtly alter which session ID gets passed to the adapter, which affects prompt caching, context continuity, and cost tracking.

**Consequences:** Regressions in run execution cause agents to never finish (stuck in "running" status), duplicate issue execution (broken execution locking), or lost session state (agent starts fresh sessions on every heartbeat, wasting all cached context).

**Prevention:**
- Extract sub-modules BEFORE adding token optimization features. The CONCERNS.md already recommends this: workspace resolution (~100 lines), session management (~150 lines), issue execution locking (~300 lines), wakeup queuing (~400 lines).
- Write integration tests for `enqueueWakeup()` and `executeRun()` before changing them. Use the existing `issues-checkout-wakeup.test.ts` as a template.
- Use a feature flag for new token optimization behavior so it can be toggled off without reverting code.

**Detection:** Agents stuck in "running" status. The orphan reaper (`reapOrphanedRuns()`) marking runs as `process_lost` when they should not be. Multiple runs for the same issue executing concurrently (broken execution lock).

**Phase mapping:** Infrastructure/refactoring phase should come before or run concurrently with token optimization. Do not add features to the monolithic heartbeat.ts.

---

### Pitfall 4: Prompt Template Optimization Without Measuring Baseline

**What goes wrong:** The prompt template system (`renderTemplate()` in `adapter-utils/server-utils.ts`) is simple string interpolation with `{{variable}}` syntax. The default Claude prompt is minimal: "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work." The real context cost comes from (a) the SKILL.md file injected via `--append-system-prompt-file`, (b) the conversation history from session resumption, and (c) tool call results within the Claude session. Teams optimize the part they can see (the prompt template) while the invisible parts (skill file, history, tool results) dominate token consumption.

**Why it happens:** The prompt template is directly configurable in the adapter config and feels like the obvious optimization target. But Anthropic's prompt caching means the system prompt (including SKILL.md) is likely already cached after the first call -- making it nearly free. The real token waste is in the conversation history and in agents making redundant API calls or reading the same files repeatedly.

**Consequences:** Engineering effort spent shrinking prompts by 50 tokens while agents waste 50,000 tokens per heartbeat on redundant tool calls. False sense of optimization progress.

**Prevention:**
- Instrument token usage BEFORE optimizing. Add logging that breaks down: (a) system prompt tokens, (b) cached vs. uncached input tokens, (c) output tokens, (d) total turns per run.
- The `usageJson` field on `heartbeat_runs` already captures input/output/cached tokens from the adapter. Build a dashboard or query that aggregates this data per agent, per task, over time.
- Focus optimization efforts on the highest token consumers: likely conversation history management and agent behavioral patterns (redundant file reads, excessive API calls), not prompt templates.

**Detection:** Cost per heartbeat not decreasing despite prompt "optimizations." Cache hit rates already high (indicating the system prompt is already cached). High variance in token usage between heartbeats for the same agent on similar tasks.

**Phase mapping:** Instrumentation must come first. Build observability before optimizing.

---

### Pitfall 5: Adding Integrations (Slack, Linear) Without Idempotent Webhook Processing

**What goes wrong:** The existing GitHub webhook integration (`server/src/services/github-app.ts`) creates Paperclip issues and triggers agent wakeups from webhook events. Adding Slack and Linear integrations follows the same pattern. But webhook delivery is at-least-once: providers retry on timeouts, network failures, or non-2xx responses. Without idempotent processing, a single Slack message or Linear issue update triggers multiple agent wakeups, creating duplicate runs that waste tokens and potentially create conflicting work.

**Why it happens:** The GitHub integration already has some protection via the `idempotencyKey` field on `agentWakeupRequests`, but the enforcement depends on the caller passing a key. New integrations may not consistently generate deterministic idempotency keys from webhook payloads. The `enqueueWakeup()` function does not enforce idempotency at the database level -- it checks agent state and issue execution locks, but a duplicate webhook arriving milliseconds apart can slip through.

**Consequences:** Agent wakes up twice for the same Slack message, does the work twice, posts duplicate comments, or creates conflicting branches. Token cost doubles for no value. Worse: two agents might pick up the same issue if the duplicate wakeup arrives between checkout and execution lock acquisition.

**Prevention:**
- Add a unique constraint on `(companyId, idempotencyKey)` in `agent_wakeup_requests` and use `ON CONFLICT DO NOTHING` for wakeup insertion. Make idempotency key generation mandatory for all webhook-triggered wakeups.
- For each new integration, define the idempotency key derivation: Slack = `slack:{workspace_id}:{channel_id}:{message_ts}`, Linear = `linear:{team_id}:{issue_id}:{action}:{updatedAt}`.
- Implement webhook signature verification for each provider (Slack signing secret, Linear webhook secret) to prevent replay attacks.
- Add a short deduplication window (e.g., 5 minutes) where duplicate idempotency keys are rejected even if the first request failed.

**Detection:** Multiple wakeup requests with the same effective trigger appearing within seconds. Agents posting duplicate comments. Multiple runs for the same external event in `heartbeat_runs`.

**Phase mapping:** Must be addressed before adding any new integration. The idempotency infrastructure benefits GitHub webhooks too.

## Moderate Pitfalls

### Pitfall 6: Context Snapshot Bloat in Wakeup Chain

**What goes wrong:** The `contextSnapshot` (a JSONB field on `heartbeat_runs`) accumulates fields through `enrichWakeContextSnapshot()`: issueId, taskId, taskKey, wakeReason, wakeSource, wakeTriggerDetail, commentId, wakeCommentId, plus workspace data injected during `executeRun()` (paperclipWorkspace, paperclipWorkspaces, projectId). As the system adds more integrations and context sources, this JSONB blob grows. It is passed to the adapter as the `context` parameter and some adapters include it in environment variables (`PAPERCLIP_WAKE_REASON`, `PAPERCLIP_TASK_ID`, etc.). Each additional field increases the size of every run record and the environment passed to child processes.

**Why it happens:** The context snapshot is a catch-all for "information this run might need." There is no schema validation -- it is `Record<string, unknown>`. New features add fields without removing old ones.

**Prevention:**
- Define a Zod schema for `contextSnapshot` that documents expected fields and their types.
- Separate "routing context" (used to decide what the agent works on) from "execution context" (passed to the adapter). Routing context stays in the wakeup request; execution context is computed at run time.
- Add size limits: if `contextSnapshot` exceeds N bytes, log a warning.

**Detection:** Growing `heartbeat_runs` table size. Context snapshot JSON exceeding 1KB for simple wakeups.

**Phase mapping:** Address when adding new integrations. Each new integration adds context fields.

---

### Pitfall 7: Budget Enforcement Race Condition Under Concurrent Runs

**What goes wrong:** The `costService.createEvent()` function atomically increments `agents.spentMonthlyCents`, then reads the agent back to check if it exceeded the budget, then pauses the agent. But if two runs for the same agent finish simultaneously, both increment the counter, both read the agent (now over budget), and both attempt to pause it. The pause itself is harmless (idempotent), but the real problem is: both runs already executed and consumed tokens BEFORE the budget check happened. Budget enforcement is post-hoc, not pre-emptive.

**Why it happens:** Cost events are only created after a run completes -- the cost is not known until the adapter returns usage data. There is no pre-run budget check that accounts for the estimated cost of the pending run.

**Prevention:**
- Add a pre-run budget check in `executeRun()`: if `agent.spentMonthlyCents` is within 90% of `agent.budgetMonthlyCents`, log a warning and optionally skip the run.
- For agents approaching their budget, reduce `maxTurnsPerRun` dynamically to limit potential overspend.
- Accept that post-hoc enforcement is inherent to pay-per-token models and document the expected overshoot margin.

**Detection:** Agents whose `spentMonthlyCents` significantly exceeds `budgetMonthlyCents` (more than one run's worth of overshoot).

**Phase mapping:** Address alongside token optimization and cost dashboard improvements.

---

### Pitfall 8: Adapter Interface Stability During Multi-Adapter Token Optimization

**What goes wrong:** Token optimization strategies differ by adapter. Claude Code uses `--resume` for session continuity and gets prompt caching automatically. Codex and Cursor have different session/context models. Optimizing token usage for Claude (the primary adapter) can inadvertently break the adapter interface contract, making other adapters incompatible. For example, adding a `cachedInputTokens` requirement to cost reporting, or making session rotation logic Claude-specific in the shared heartbeat code.

**Why it happens:** The `ServerAdapterModule` interface (`packages/adapter-utils/src/types.ts`) is the stability contract. The `AdapterExecutionResult` type already has optional fields (`usage?`, `sessionId?`, `sessionParams?`, `billingType?`, `costUsd?`). But optimization logic in the heartbeat service may start assuming these optional fields are present, or may add Claude-specific behavior (like `isClaudeMaxTurnsResult()` checks) directly in shared code paths.

**Consequences:** Adding a new adapter becomes harder. Existing adapters (Codex, Cursor, OpenCode, Pi) break silently -- they return null for fields the heartbeat now depends on. Upstream compatibility (a stated constraint) degrades.

**Prevention:**
- All adapter-specific optimization logic must go in the adapter package itself, not in heartbeat.ts. The heartbeat should only use the `ServerAdapterModule` interface.
- When adding new optional fields to `AdapterExecutionResult`, add them as optional with sensible defaults in the heartbeat consumer code.
- Write a simple adapter compliance test that verifies all registered adapters satisfy the `ServerAdapterModule` contract with representative inputs.

**Detection:** New adapter fields that are only populated by one adapter. Claude-specific logic in `heartbeat.ts` that is not gated by `if (agent.adapterType === "claude_local")`.

**Phase mapping:** Address at the start of token optimization. Define the adapter interface evolution strategy before changing it.

---

### Pitfall 9: Live Event Backpressure During High-Frequency Log Streaming

**What goes wrong:** The `onLog` callback in `executeRun()` broadcasts every stdout/stderr chunk as a `heartbeat.run.log` live event to all WebSocket subscribers for the company. During token optimization work, agents may become more verbose (more tool calls, more reasoning) or you may add instrumentation that increases log volume. The in-memory `EventEmitter` with `setMaxListeners(0)` has no backpressure (noted in CONCERNS.md). High-frequency events from multiple concurrent agents can overwhelm WebSocket connections, causing the Node.js event loop to block on broadcasting.

**Why it happens:** The live event system was designed for real-time UI updates, not high-throughput log streaming. Each log chunk is broadcast individually without batching. The `MAX_LIVE_LOG_CHUNK_BYTES` truncation helps but does not limit frequency.

**Prevention:**
- Batch log events: accumulate chunks for 100-200ms before broadcasting, send as a single batched event.
- Add a per-company event rate limiter that drops or samples log events when the rate exceeds a threshold.
- For the UI, implement client-side virtualization for live log display (the `AgentDetail.tsx` at 2593 lines suggests this may already be a problem).

**Detection:** Increasing WebSocket message queue depth. UI lag when viewing agent runs. Node.js event loop latency spikes during concurrent agent execution.

**Phase mapping:** Address before adding more concurrent agent capacity. The current single-process architecture limits how many agents can run simultaneously.

## Minor Pitfalls

### Pitfall 10: Stale Skill Files After Symlink-Based Injection

**What goes wrong:** The Claude adapter creates a temporary directory with symlinks to the `skills/` directory, passed via `--add-dir`. If skill files are updated (e.g., SKILL.md is modified for token optimization), running agents using cached session state may have the old skill content in their compacted context while new runs get the updated content. This creates inconsistent agent behavior across sessions.

**Prevention:** Version skill files and log which skill version was used in each run's `adapter.invoke` event. When skill content changes significantly, consider clearing all active sessions for agents using that skill.

**Detection:** Agents on the same task behaving differently depending on when their session was created.

**Phase mapping:** Minor -- address when making significant skill file changes.

---

### Pitfall 11: Cost Tracking Precision Loss With Integer Cents

**What goes wrong:** The `cost_events.costCents` column is an integer. Sub-cent costs (common for small agent interactions: a 500-token exchange costs ~$0.003) are rounded, potentially to zero. Many small interactions accumulate rounding errors.

**Prevention:** Either use a `numeric` type for cost tracking or track costs in microdollars (1/1,000,000 of a dollar) as integers. The `costUsd` field from adapters is a float that gets converted to cents somewhere in the pipeline.

**Detection:** Agents with many runs showing $0.00 cost. Total cost from cost_events diverging from the sum of `usageJson.costUsd` on heartbeat_runs.

**Phase mapping:** Address when improving cost dashboard. Low urgency but compounds over time.

---

### Pitfall 12: Missing Index on contextSnapshot JSONB Queries

**What goes wrong:** The orphan reaper and activity service query `heartbeat_runs` with `contextSnapshot ->> 'issueId' = ${issueId}` (a JSONB text extraction). The `enqueueWakeup()` legacy run detection also uses this pattern. Without a GIN or expression index on this JSONB path, these queries do full table scans as the `heartbeat_runs` table grows.

**Prevention:** Add an expression index: `CREATE INDEX ON heartbeat_runs ((context_snapshot->>'issueId')) WHERE status IN ('queued', 'running')`. This covers the most frequent query pattern.

**Detection:** Slow queries in the Pino logs during wakeup processing. `EXPLAIN ANALYZE` on the legacy run detection query showing sequential scans.

**Phase mapping:** Address in infrastructure phase. Becomes critical as run volume increases.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Token optimization | Optimizing prompts while ignoring session history costs (Pitfall 4) | Instrument first, optimize second |
| Token optimization | Breaking session state machine during heartbeat refactoring (Pitfall 3) | Extract sub-modules before adding features |
| Token optimization | No way to measure cache hit rates (Pitfall 1) | Add cachedInputTokens to cost_events schema |
| Session management | Compaction-induced skill amnesia (Pitfall 2) | Proactive session rotation, maxTurns limits |
| New integrations | Duplicate wakeups from webhook retries (Pitfall 5) | Idempotency key enforcement at DB level |
| New integrations | Context snapshot unbounded growth (Pitfall 6) | Schema validation, separate routing from execution context |
| Cost/budget | Budget overshoot from concurrent runs (Pitfall 7) | Pre-run budget proximity check |
| Adapter system | Claude-specific logic leaking into shared code (Pitfall 8) | Keep optimization in adapter packages |
| Infrastructure | WebSocket backpressure under load (Pitfall 9) | Event batching, rate limiting |
| Infrastructure | JSONB query performance degradation (Pitfall 12) | Expression indexes on frequently queried paths |

## Sources

- [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Factory.ai: The Context Window Problem: Scaling Agents Beyond Token Limits](https://factory.ai/news/context-window-problem)
- [JetBrains Research: Smarter Context Management for LLM-Powered Agents](https://blog.jetbrains.com/research/2025/12/efficient-context-management/)
- [Claude Code Docs: Manage costs effectively](https://code.claude.com/docs/en/costs)
- [Anthropic: Token-saving updates on the Anthropic API](https://www.anthropic.com/news/token-saving-updates)
- [Claude Code Issue #14941: Post-compaction behavior aggressively resumes without context assessment](https://github.com/anthropics/claude-code/issues/14941)
- [Claude Code Issue #13919: Skills context completely lost after auto-compaction](https://github.com/anthropics/claude-code/issues/13919)
- [Stevens Online: Hidden Economics of AI Agents: Token Costs and Latency Trade-offs](https://online.stevens.edu/blog/hidden-economics-ai-agents-token-costs-latency/)
- [Composio: Why AI Agent Pilots Fail in Production](https://composio.dev/blog/why-ai-agent-pilots-fail-2026-integration-roadmap)
- [Google Developers: Architecting efficient context-aware multi-agent framework for production](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/)
- [Nirdiamant: 5 Common Mistakes When Scaling AI Agents](https://medium.com/@nirdiamant21/5-common-mistakes-when-scaling-ai-agents-d64a6cdd04dd)
- [Claude Prompt Caching Documentation](https://docs.claude.com/en/docs/build-with-claude/prompt-caching)
- [Context Rot in Claude Code: How to Fix It](https://vincentvandeth.nl/blog/context-rot-claude-code-automatic-rotation)

---

*Pitfalls research: 2026-03-09*
