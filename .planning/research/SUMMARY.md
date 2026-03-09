# Project Research Summary

**Project:** Paperclip (Urdlabs Fork) - Token Optimization & Observability Milestone
**Domain:** AI Agent Orchestration Platform (Coding Agents)
**Researched:** 2026-03-09
**Confidence:** MEDIUM-HIGH

## Executive Summary

Paperclip is a working AI agent orchestration platform with a heartbeat-driven execution loop, multi-adapter support, issue tracking, and cost management already in place. The next milestone -- token optimization and observability -- is not a greenfield build but an augmentation of a functioning system. The expert consensus is clear: instrument before optimizing, compress context not prompts, and keep the adapter interface untouched. The recommended approach inserts a **Context Pipeline** into the existing `executeRun()` codepath (between context resolution and adapter invocation) and adds an **Analytics Collector** after execution completes, requiring fewer than 15 new lines in the core heartbeat service.

The technology choices are straightforward and high-confidence. Anthropic's free `countTokens()` API handles Claude estimation; `gpt-tokenizer` handles OpenAI-family models offline. `web-tree-sitter` provides AST-based code summarization (proven by Aider and Cline to achieve 4-50x context reduction). `prom-client` exposes Prometheus metrics. No new frameworks, no Python dependencies, no external SaaS -- everything integrates into the existing TypeScript monorepo. The architecture is deliberately additive: a new `run_analytics` table, a new context pipeline module, and new API routes following existing patterns. No existing tables or interfaces are modified.

The primary risks are operational, not technical. The heartbeat service is a 2,400-line monolith with no direct unit tests on critical paths -- modifying it for token optimization without first extracting sub-modules invites regressions in session management and execution locking (Pitfall 3). Claude's auto-compaction silently degrades agent behavior after sessions grow large (Pitfall 2), which directly undermines session-reuse-based token savings. And the cost tracking schema does not separately persist cached tokens (Pitfall 1), meaning cache optimization work cannot be measured without a schema migration first. All three risks have concrete mitigations and must be addressed in the first phase.

## Key Findings

### Recommended Stack

The stack is lean and fits the existing monorepo with no architectural disruption. Two token counting approaches handle the two adapter families. Context optimization uses AST parsing rather than ML-based compression, avoiding Python dependencies. Observability uses the Prometheus ecosystem rather than commercial APM.

**Core technologies:**
- `@anthropic-ai/sdk` countTokens API: free, exact Claude token counting pre-invocation -- matches billing precisely
- `gpt-tokenizer`: offline OpenAI-family tokenizer -- pure JS, fastest on npm, supports o200k_base encoding
- `web-tree-sitter`: AST-based code summarization -- proven 4-50x context reduction for code-focused agents
- Anthropic prompt caching (`cache_control`): 90% cost reduction on repeated prompt prefixes -- ideal for heartbeat loop where system prompt repeats
- `prom-client`: Prometheus metrics for token/cost/run observability -- standard Node.js pattern
- `recharts`: lightweight React charting -- replaces hand-rolled SVG bars for interactive token analytics
- Drizzle ORM (existing): new `run_analytics` table and materialized views for time-series aggregation

**Critical version notes:** `gpt-tokenizer` v3.4+ for o200k_base support. `web-tree-sitter` v0.26+ for stable WASM in Node.js.

**What to avoid:** tiktoken (WASM overhead), LLMLingua (Python ML runtime), LangChain/LlamaIndex (framework bloat), vector databases for code RAG (tree-sitter indexing is better for code context), commercial APM/observability SaaS (extend existing cost tracking instead).

### Expected Features

**Must have (table stakes -- mostly already exist):**
- Multi-agent execution with heartbeat loop (exists)
- Cost tracking per agent/project with budget caps (exists)
- Session resume across runs (exists)
- Real-time run output streaming (exists)
- Human-in-the-loop approvals (exists)
- **Outgoing notifications (Slack/Discord/webhooks)** -- MISSING, prerequisite for team use
- **Run failure alerting** -- MISSING, silent failures are unacceptable

**Should have (differentiators for this milestone):**
- Context compression / rolling summaries (40-60% token reduction)
- Run-level token analytics with cost attribution (per-run, per-tool-call breakdown)
- Token budget per run with early termination
- Prompt caching awareness (structure prompts for maximum cache hits)
- Data serialization optimization (compact issue context formatting)
- Smart prompt templating per task type
- Context window utilization metrics
- Trace visualization (execution DAG like Langfuse)
- Real-time token counter during runs

**Defer (v2+):**
- Model routing by task complexity -- high complexity, needs analytics data first to know where routing helps
- Task decomposition with dependency graph -- architectural overhaul of the one-issue-one-agent model
- MCP server/client support -- ecosystem still maturing
- Linear/Jira sync -- bidirectional sync is notoriously hard
- Run replay / time-travel debugging -- requires trace visualization first
- Parallel agent coordination -- requires task decomposition first

### Architecture Approach

The architecture inserts two new subsystems into the existing execution flow without modifying the adapter interface. A **Context Pipeline** (ordered processor chain) transforms context and config before adapter execution. An **Analytics Collector** captures pre-run estimates and post-run actuals into a dedicated `run_analytics` table. Both hook into `executeRun()` at well-defined insertion points.

**Major components:**
1. **Context Pipeline** (`server/src/context-pipeline/`) -- ordered chain of processors (deduplicator, template optimizer, history summarizer, budget enforcer) that transform context before adapter execution
2. **Analytics Collector** (`server/src/analytics/`) -- captures pre-execution estimates and post-execution actuals, writes to `run_analytics`
3. **Token Analytics Service** (`server/src/services/token-analytics.ts`) -- aggregation, trends, efficiency scoring following the existing `xxxService(db)` factory pattern
4. **Analytics API Routes** (`server/src/routes/token-analytics.ts`) -- REST endpoints for per-agent, per-model, and time-series analytics
5. **Analytics Dashboard** (UI) -- token usage visualization, cache hit rates, cost breakdowns using `recharts`
6. **Prometheus Metrics Middleware** (`server/src/middleware/`) -- exposes `/metrics` endpoint with `paperclip_agent_tokens_total`, `paperclip_prompt_cache_hit_ratio`, etc.

**Key design constraint:** The adapter interface (`ServerAdapterModule`, `AdapterExecutionResult`) must not change. All optimization is invisible to adapters -- they receive pre-optimized context and return the same result structure.

### Critical Pitfalls

1. **No cached token tracking in cost_events (Pitfall 1)** -- The `cachedInputTokens` field exists in `UsageSummary` and is parsed by the Claude adapter but is never persisted in `cost_events`. Cache optimization cannot be measured. **Fix:** Add `cachedInputTokens` column to `cost_events` in Phase 1 before any optimization work.

2. **Session compaction destroys skill context (Pitfall 2)** -- Claude Code's auto-compaction at ~80% context usage creates lossy summaries that drop Paperclip skill procedures. Agents silently stop following heartbeat procedures. **Fix:** Proactive session rotation, aggressive `maxTurnsPerRun` limits, compaction detection logging. Measure compaction impact before investing in session-reuse optimization.

3. **Heartbeat monolith refactoring risk (Pitfall 3)** -- The 2,400-line `heartbeat.ts` contains session management, execution locking, and wakeup queuing with no unit tests. Modifying it for token optimization risks breaking the state machine. **Fix:** Extract sub-modules (workspace resolution, session management, issue execution locking, wakeup queuing) before adding features. Write integration tests first.

4. **Optimizing prompts instead of actual token consumers (Pitfall 4)** -- The prompt template is tiny; the real cost is conversation history and redundant tool calls. Teams waste effort on the visible 50-token prompt while agents burn 50,000 tokens on redundant file reads. **Fix:** Instrument token breakdown first, then optimize the largest consumers.

5. **Duplicate wakeups from webhook retries (Pitfall 5)** -- Adding Slack/Linear integrations without idempotent webhook processing causes duplicate agent runs. **Fix:** Enforce idempotency keys at DB level with unique constraint before adding any new integrations.

## Implications for Roadmap

Based on research, the milestone naturally divides into 5 phases with clear dependencies. The ordering follows the principle of "observe, then optimize, then visualize."

### Phase 1: Analytics Foundation & Schema Hardening
**Rationale:** You cannot optimize what you cannot measure. Every subsequent phase depends on having baseline analytics. Schema gaps (no cached tokens in cost_events) must be fixed before optimization work begins. This phase also extracts heartbeat sub-modules to reduce regression risk for later phases.
**Delivers:** `run_analytics` table, analytics collector integrated into `executeRun()`, `cachedInputTokens` column on `cost_events`, basic token analytics service and API routes, heartbeat sub-module extraction.
**Addresses:** Run-level token analytics (FEATURES), context window utilization metrics (FEATURES)
**Avoids:** Pitfall 1 (no cached token tracking), Pitfall 3 (monolith refactoring risk), Pitfall 4 (optimizing without baseline)
**Stack:** Drizzle ORM migrations, existing Express patterns

### Phase 2: Context Pipeline & First Processors
**Rationale:** With analytics in place, build the optimization infrastructure. The pipeline framework is lightweight (no-op at first) and processors can be added incrementally. Start with simple processors (deduplication, template optimization) that do not require external dependencies.
**Delivers:** Context pipeline module with processor chain, `ContextDeduplicator`, `PromptTemplateOptimizer`, per-run compression metrics, token budget config on agents.
**Addresses:** Data serialization optimization (FEATURES), prompt caching awareness (FEATURES), token budget per run (FEATURES)
**Avoids:** Pitfall 4 (now guided by Phase 1 analytics data), Pitfall 8 (adapter interface stays untouched)
**Stack:** Custom pipeline module, character-based token estimation

### Phase 3: Advanced Context Optimization
**Rationale:** With the pipeline proven and analytics showing where tokens are wasted, add the heavy-lifting processors: history summarization (biggest savings opportunity identified by research) and tree-sitter code context reduction.
**Delivers:** `HistorySummarizer` processor, `TokenBudgetEnforcer`, tree-sitter code summarization, prompt caching structure optimization (cache_control headers), session rotation strategy.
**Addresses:** Context compression / rolling summaries (FEATURES), smart prompt templating (FEATURES)
**Avoids:** Pitfall 2 (session compaction addressed via rotation strategy), Pitfall 4 (optimization targets validated by analytics)
**Stack:** `web-tree-sitter`, Anthropic prompt caching API, `gpt-tokenizer`

### Phase 4: Observability Dashboard & Metrics
**Rationale:** By Phase 4, rich analytics data exists from Phases 1-3. Build the visualization layer that makes token usage, cache hit rates, and optimization impact visible to operators. Add Prometheus metrics for external monitoring.
**Delivers:** Token analytics dashboard page, per-agent/per-model charts, cache hit rate visualization, cost trend analysis, Prometheus `/metrics` endpoint, real-time token counter during runs.
**Addresses:** Trace visualization (FEATURES), real-time token counter (FEATURES), filtered activity feeds (FEATURES)
**Avoids:** Pitfall 9 (event batching for live updates)
**Stack:** `recharts`, `prom-client`, existing LiveUpdatesProvider

### Phase 5: Notification Infrastructure & Integrations
**Rationale:** This is the only missing table-stakes feature set (outgoing notifications). Deferred to Phase 5 because it is independent of token optimization -- the core milestone focus -- and requires idempotency infrastructure that benefits from the schema hardening in Phase 1.
**Delivers:** Outgoing webhook system, Slack notifications for completions/failures/approvals, run failure alerting, idempotent webhook processing.
**Addresses:** Outgoing notifications (FEATURES table stakes), Slack integration (FEATURES), run failure alerting (FEATURES)
**Avoids:** Pitfall 5 (idempotent webhook processing), Pitfall 6 (context snapshot schema validation)
**Stack:** Existing Express routes, webhook delivery with retry

### Phase Ordering Rationale

- **Phase 1 before everything:** Analytics data is required to validate every optimization. Schema gaps block measurement. Heartbeat refactoring reduces risk for all later phases.
- **Phases 2-3 sequential:** The pipeline framework (Phase 2) must exist before advanced processors (Phase 3) can be built. Simple processors first validates the architecture.
- **Phase 4 after 3:** The dashboard is most valuable when there is optimization data to display. Building it earlier means empty charts.
- **Phase 5 independent:** Notifications are orthogonal to token optimization but included in this milestone. Can run in parallel with Phase 4 if resources allow.
- **Dependency chain mirrors architecture:** Each phase produces a testable, deployable increment. No phase depends on a later phase.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Advanced Context Optimization):** Tree-sitter WASM integration in Node.js has edge cases. History summarization strategy (LLM-based vs. heuristic) needs prototyping. Prompt caching header placement across different Claude API versions needs validation.
- **Phase 5 (Notifications):** Slack App vs. incoming webhook architecture decision. Linear API webhook format research needed if Linear sync is included.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Analytics Foundation):** Standard Drizzle migrations, Express routes, and service factory patterns. Well-documented in the existing codebase.
- **Phase 2 (Context Pipeline):** Middleware/processor chain pattern is well-established. No external dependencies.
- **Phase 4 (Dashboard):** Standard React + recharts + REST API pattern. Existing UI patterns in the codebase provide clear templates.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommended libraries verified on npm with current versions. Anthropic API docs confirmed. No speculative choices. |
| Features | MEDIUM-HIGH | Table stakes validated against competitor landscape. Differentiator priorities align with PROJECT.md goals. Some feature complexity estimates may be optimistic. |
| Architecture | HIGH | Context pipeline insertion point verified against codebase (`heartbeat.ts` lines ~1327-1344). Additive schema changes. No interface modifications. Follows existing patterns. |
| Pitfalls | HIGH | All critical pitfalls derived from codebase analysis and confirmed by external sources (Claude Code GitHub issues, production agent failure reports). Specific line numbers and code paths referenced. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **History summarization strategy:** Research identifies this as the highest-value optimization but does not resolve whether to use LLM-based summarization (more accurate, costs tokens) or heuristic truncation (free, lossy). Prototype both in Phase 3.
- **Tree-sitter language grammar coverage:** The codebase agents work on may use languages without well-maintained tree-sitter grammars. Audit supported languages before committing to tree-sitter in Phase 3.
- **Prompt caching effectiveness measurement:** Anthropic cache TTL is 5 minutes (free refresh) or 1 hour (paid). Need to measure actual cache hit rates with Paperclip's heartbeat intervals to determine if the timing aligns.
- **OTel GenAI conventions stability:** The OpenTelemetry GenAI semantic conventions are experimental. Deferred to post-milestone but should be monitored. If the spec stabilizes during development, align Prometheus metrics with OTel names.
- **Budget enforcement precision:** The integer cents cost tracking loses sub-cent precision (Pitfall 11). Not blocking for this milestone but will compound. Evaluate switching to microdollars during Phase 1 schema work.
- **Heartbeat sub-module extraction scope:** Pitfall 3 recommends extracting ~950 lines into sub-modules. The exact extraction boundaries need careful planning to avoid breaking the session state machine. Use integration tests as the safety net.

## Sources

### Primary (HIGH confidence)
- [Anthropic Token Counting API](https://platform.claude.com/docs/en/build-with-claude/token-counting) -- free countTokens endpoint, rate limits
- [Anthropic Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) -- cache_control headers, TTL, billing
- [Claude Code Docs: Manage costs](https://code.claude.com/docs/en/costs) -- auto-compaction behavior
- [Claude Code Issue #14941](https://github.com/anthropics/claude-code/issues/14941) -- post-compaction skill loss
- [Langfuse Agent Observability](https://langfuse.com/blog/2024-07-ai-agent-observability-with-langfuse) -- trace visualization patterns
- [arxiv: Prompt Caching for Agentic Tasks](https://arxiv.org/html/2601.06007v1) -- benchmarks on caching effectiveness
- [MCP Specification](https://modelcontextprotocol.io/specification/2025-11-25) -- protocol spec for future integration

### Secondary (MEDIUM confidence)
- [Aider repo map with tree-sitter](https://aider.chat/2023/10/22/repomap.html) -- implementation details, context reduction ratios
- [Context Engineering for Agents](https://rlancemartin.github.io/2025/06/23/context_engineering/) -- patterns and techniques
- [Spotify: Context Engineering for Background Coding Agents](https://engineering.atspotify.com/2025/11/context-engineering-background-coding-agents-part-2) -- production patterns
- [JetBrains: Efficient Context Management](https://blog.jetbrains.com/research/2025/12/efficient-context-management/) -- pipeline architecture
- [Google Developers: Context-Aware Multi-Agent Framework](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/) -- processor patterns
- [Factory.ai: Compressing Context](https://factory.ai/news/compressing-context) -- rolling summary approach, 40-60% reduction claims
- [prom-client GitHub](https://github.com/siimon/prom-client) -- standard Prometheus client for Node.js
- [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/) -- experimental metric naming spec

### Tertiary (LOW confidence)
- [Obvious Works: Token Optimization Saves 80%](https://www.obviousworks.ch/en/token-optimization-saves-up-to-80-percent-llm-costs/) -- single source for specific cost reduction numbers
- [Redis: LLM Token Optimization](https://redis.io/blog/llm-token-optimization-speed-up-apps/) -- general techniques overview

---
*Research completed: 2026-03-09*
*Ready for roadmap: yes*
