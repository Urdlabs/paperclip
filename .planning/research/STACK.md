# Technology Stack: Token Optimization & Observability

**Project:** Paperclip (Urdlabs Fork) - AI Agent Token Optimization Milestone
**Researched:** 2026-03-09
**Overall Confidence:** MEDIUM-HIGH

## Context

Paperclip already has a working cost tracking system: `cost_events` table storing per-run `inputTokens`, `outputTokens`, `costCents`, plus `usageJson` in `heartbeat_runs`. The Claude adapter parses `cache_read_input_tokens` from Claude's stream JSON output. The system tracks spending and enforces budgets per agent and per company.

What is **missing**: pre-invocation token estimation, prompt optimization before sending, context compression, detailed observability dashboards, and cross-adapter token analytics. This stack addresses those gaps.

## Recommended Stack

### Token Counting & Estimation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@anthropic-ai/sdk` | ^0.78.0 | Server-side exact token counting for Claude models | Already available in the ecosystem. The `client.messages.countTokens()` API is free, accurate, and supports tools/images/PDFs. Matches billing exactly. No offline tokenizer needed for Claude since the server can call this before invocation. | HIGH |
| `gpt-tokenizer` | ^3.4.0 | Offline token estimation for OpenAI-family models (Codex adapter) | Pure JS, fastest tokenizer on npm, supports all OpenAI encodings (o200k_base for GPT-4o/Codex). No WASM needed, tiny footprint, synchronous `isWithinTokenLimit()` for fast budget checks. | HIGH |

**Rationale:** Paperclip orchestrates multiple AI backends. Claude gets exact counts via API (free, rate-limited at 100-8000 RPM by tier). OpenAI-family models get offline estimation via `gpt-tokenizer`. This dual approach avoids adding a network call for Codex/OpenCode while maintaining accuracy for Claude.

**Do NOT use:**
- `tiktoken` (WASM) -- heavier, requires WASM runtime, no advantage over `gpt-tokenizer` for counting
- `js-tiktoken` -- slower than `gpt-tokenizer`, fewer features, less actively maintained
- Offline approximations for Claude (e.g., tiktoken with p50k_base) -- inaccurate for billing, Anthropic's API is free

### Context Management & Prompt Optimization

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `web-tree-sitter` | ^0.26.6 | AST-based code summarization for reducing context sent to agents | Proven approach used by Aider and Cline. Parse code into AST, extract function/class signatures, build repo maps. Achieves 4-50x context reduction while preserving structural awareness. WASM-based, works in Node.js. | HIGH |
| Custom prompt template engine (built-in) | N/A | Dynamic prompt assembly with cacheable prefixes | Extend existing `renderTemplate()` in adapter-utils. Structure prompts with static content (system instructions, skills) first, dynamic content (task, context) last. Maximizes prompt cache hit rate. | HIGH |
| Anthropic prompt caching (API-level) | N/A | 90% cost reduction on repeated prompt prefixes | Claude already supports `cache_control: { type: "ephemeral" }`. 5-minute TTL is free refresh; 1-hour TTL costs 2x base but avoids repeated cache writes. Paperclip's heartbeat loop (agents run repeatedly) is ideal for caching -- same system prompt + skills on every beat. | HIGH |

**Rationale:** The biggest token savings come from three layers: (1) sending less context via tree-sitter code summarization, (2) structuring prompts so prefixes cache, and (3) compressing/summarizing conversation history. These are complementary, not competing.

**Do NOT use:**
- LLMLingua / prompt compression models -- requires a separate ML model runtime (Python-based, needs GPU or significant CPU). Overkill for a TypeScript monorepo. The tree-sitter approach gives comparable context reduction for code-focused agents without ML overhead.
- LangChain / LlamaIndex -- massive frameworks that don't fit Paperclip's lean adapter architecture. Would introduce Python dependencies or heavy JS bundles for features Paperclip doesn't need.
- Vector databases for RAG -- the agents already operate within Git repos with file system access. Tree-sitter indexing with PageRank-style relevance (Aider's approach) is more appropriate for code context than embedding-based retrieval.

### Observability & Monitoring

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `prom-client` | ^16.0.0 | Prometheus metrics for token usage, cost, and run performance | Lightweight, battle-tested, Node.js native. Paperclip already uses Pino for structured logging; adding Prometheus metrics for token usage/cost is the natural next step. Exposes `/metrics` endpoint for scraping. | HIGH |
| `@opentelemetry/sdk-metrics` | ^2.6.0 | OTel-native metrics aligned with GenAI semantic conventions | Future-proof alignment with the OpenTelemetry GenAI spec (`gen_ai.client.token.usage`, `gen_ai.client.operation.duration`). Experimental but rapidly stabilizing. Can export to Prometheus via `@opentelemetry/exporter-prometheus`. | MEDIUM |
| `@opentelemetry/exporter-prometheus` | ^0.213.0 | Bridge OTel metrics to Prometheus format | Allows using OTel semantic conventions while still scraping with Prometheus. Single `/metrics` endpoint. | MEDIUM |

**Recommendation:** Start with `prom-client` for immediate, reliable metrics. Layer in OTel GenAI conventions later as the spec stabilizes. The two are compatible -- `prom-client` supports OTel exemplars ({traceId, spanId}).

**Key metrics to expose:**
- `paperclip_agent_tokens_total` (counter, labels: agent_id, model, direction=input|output|cached)
- `paperclip_agent_cost_cents_total` (counter, labels: agent_id, model, billing_type)
- `paperclip_agent_run_duration_seconds` (histogram, labels: agent_id, adapter_type, status)
- `paperclip_agent_context_utilization_ratio` (gauge, estimated tokens / context window size)
- `paperclip_prompt_cache_hit_ratio` (gauge, cached_input_tokens / total_input_tokens)

**Do NOT use:**
- Datadog/New Relic/commercial APM -- unnecessary cost for a self-hosted tool. Prometheus + Grafana (or just the built-in UI) is sufficient.
- Langfuse/Helicone/other LLM observability SaaS -- adds external dependency. Paperclip already has its own cost tracking; extend it rather than duplicate with third-party.

### Visualization (UI)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `recharts` | ^3.8.0 | Token usage and cost dashboard charts | Lightweight, React-native, composable components. The existing ActivityCharts.tsx uses hand-built SVG bars -- recharts provides proper tooltips, responsive layouts, and area/line/bar charts with minimal bundle size. Better than hand-rolling for the token dashboard. | MEDIUM |

**Rationale:** The existing UI uses custom div-based bar charts which work for simple activity counts but lack the interactivity needed for token analytics (tooltips showing exact counts, zoom/pan over time ranges, stacked area for input/output/cached breakdown). Recharts is the lightest-weight option that integrates cleanly with the existing Tailwind + Radix UI setup.

**Alternative considered:**
- Nivo -- more beautiful defaults but heavier bundle, more opinionated theming that may conflict with existing Tailwind/Radix design system.
- Keep hand-rolling -- viable for simple cases but doesn't scale to the 5-6 chart types needed for a proper token analytics dashboard (time series, breakdowns by model, by agent, budget utilization gauges).

### Database Schema Extensions

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Drizzle ORM (existing) | 0.38.4 | New tables/columns for granular token tracking | Already the ORM. Add `cached_input_tokens` to `cost_events`, add a `token_optimization_events` table for before/after metrics, and time-series aggregation materialized views in PostgreSQL. | HIGH |
| PostgreSQL `pg_stat_statements` + materialized views | N/A (built-in PG) | Efficient time-series token aggregation | Hourly/daily rollups of token usage by agent/model/project. Avoids expensive real-time aggregation queries on the growing `cost_events` table. | HIGH |

**Schema changes needed:**
1. Add `cachedInputTokens integer DEFAULT 0` to `cost_events` -- Claude adapter already parses `cache_read_input_tokens` but it is not persisted separately
2. Add `contextTokensBefore integer` and `contextTokensAfter integer` to `heartbeat_runs` -- track optimization effectiveness
3. Create `token_usage_hourly` materialized view for dashboard queries
4. Add `promptTemplateHash text` to `heartbeat_runs` -- track which prompt versions produce better token efficiency

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Token counting (Claude) | `@anthropic-ai/sdk` countTokens | Offline tiktoken approximation | Inaccurate (different tokenizer), API is free |
| Token counting (OpenAI) | `gpt-tokenizer` | `tiktoken` (WASM) | Heavier, WASM complexity, gpt-tokenizer is faster |
| Code context reduction | `web-tree-sitter` | Embedding-based RAG | Tree-sitter is deterministic, no ML infra needed |
| Prompt compression | Structured caching + summarization | LLMLingua | Requires Python ML runtime, heavy for JS monorepo |
| Metrics | `prom-client` | Custom DB-only metrics | No standard format, no Grafana integration |
| Charting | `recharts` | Hand-built SVG (current approach) | Doesn't scale to interactive token analytics |
| LLM proxy | None (direct adapter calls) | LiteLLM proxy | Python dependency, 3-5ms overhead per call, Paperclip's adapter system already does routing |

## Installation

```bash
# Token counting & estimation
pnpm add -w gpt-tokenizer
pnpm --filter @paperclipai/server add @anthropic-ai/sdk

# Code context (AST parsing)
pnpm --filter @paperclipai/server add web-tree-sitter

# Tree-sitter language grammars (install as needed per supported languages)
# These are .wasm files loaded at runtime by web-tree-sitter
# Download from https://github.com/nicolo-ribaudo/tree-sitter-wasm-pack/releases
# or build from individual tree-sitter-* grammar repos

# Observability
pnpm --filter @paperclipai/server add prom-client

# Charting (UI)
pnpm --filter @paperclipai/ui add recharts

# Optional: OTel (add when ready to adopt GenAI semantic conventions)
# pnpm --filter @paperclipai/server add @opentelemetry/sdk-metrics @opentelemetry/exporter-prometheus
```

## Architecture Integration Points

### Where token optimization hooks into existing code

1. **Pre-invocation estimation** -- In `heartbeat.ts` before calling `adapter.execute()`, call token counting API to estimate prompt size. If over budget threshold, trigger context compression.

2. **Prompt structure optimization** -- In each adapter's `execute()` function (e.g., `claude-local/execute.ts`), restructure the prompt so static content (system instructions, skills, tool definitions) comes first for cache hits. The `promptTemplate` + `instructionsFilePath` already flow through `renderTemplate()` -- extend this to be cache-aware.

3. **Context compression** -- New module in `packages/shared/` or a new package `packages/context-optimizer/` that uses `web-tree-sitter` to build repo maps and summarize code files before injecting them as agent context.

4. **Post-invocation recording** -- In `heartbeat.ts` after `execute()` returns, record `cachedInputTokens` from `UsageSummary` into both `cost_events` and `heartbeat_runs.usageJson`. The Claude adapter already parses this (line 62 of `parse.ts`: `cachedInputTokens: asNumber(usageObj.cache_read_input_tokens, 0)`).

5. **Metrics exposure** -- New Express middleware in `server/src/middleware/` that initializes `prom-client` and exposes `/metrics`. Record counters/histograms on every heartbeat run completion.

6. **Dashboard UI** -- New page or tab in the existing Org/Dashboard views using `recharts` to visualize token usage trends, cache hit rates, and cost breakdowns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Token counting approach | HIGH | Anthropic API verified via official docs. gpt-tokenizer verified on npm. |
| Prompt caching strategy | HIGH | Anthropic caching is production-ready, well-documented. Paperclip's heartbeat loop is ideal for it. |
| Tree-sitter for context | HIGH | Proven by Aider (4.3-6.5% context utilization) and Cline. Multiple independent implementations validate the approach. |
| Prometheus metrics | HIGH | prom-client is the standard for Node.js. Well-established pattern. |
| OTel GenAI conventions | MEDIUM | Spec is experimental (not yet stable). Worth aligning with but don't depend on it being final. |
| Recharts for dashboards | MEDIUM | Good fit but the existing hand-rolled charts may suffice if dashboard scope is small. Add recharts only when building the full analytics view. |
| Schema changes | HIGH | Straightforward Drizzle migration. No exotic features needed. |

## Sources

- [Anthropic Token Counting API](https://platform.claude.com/docs/en/build-with-claude/token-counting) -- Official docs, verified 2026-03-09
- [Anthropic Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) -- Official docs
- [gpt-tokenizer npm](https://www.npmjs.com/package/gpt-tokenizer) -- v3.4.0, verified on npm
- [web-tree-sitter npm](https://www.npmjs.com/package/web-tree-sitter) -- v0.26.6, verified on npm
- [prom-client GitHub](https://github.com/siimon/prom-client) -- Standard Prometheus client for Node.js
- [@opentelemetry/sdk-metrics npm](https://www.npmjs.com/package/@opentelemetry/sdk-metrics) -- v2.6.0
- [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/) -- Experimental spec
- [recharts npm](https://www.npmjs.com/package/recharts) -- v3.8.0, verified on npm
- [Aider repo map with tree-sitter](https://aider.chat/2023/10/22/repomap.html) -- Implementation details
- [Context Engineering for Agents](https://rlancemartin.github.io/2025/06/23/context_engineering/) -- Patterns and techniques
- [Spotify Background Coding Agents: Context Engineering](https://engineering.atspotify.com/2025/11/context-engineering-background-coding-agents-part-2) -- Production patterns
- [Context Window Management Strategies](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/) -- Overview
- [Prompt Caching Guide 2025](https://promptbuilder.cc/blog/prompt-caching-token-economics-2025) -- Cross-provider comparison
- [LLM Observability with OpenTelemetry and Grafana](https://grafana.com/blog/a-complete-guide-to-llm-observability-with-opentelemetry-and-grafana-cloud/) -- Architecture patterns
