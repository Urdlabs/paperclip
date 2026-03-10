# Phase 2: Context Optimization Pipeline - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Reduce agent token consumption through smarter context preparation, compression, budget enforcement, and cache-aware prompt structuring. Agents should do the same work with significantly fewer tokens. All improvements must be measurable via Phase 1's token analytics.

Requirements: TOPT-01, TOPT-02, TOPT-03, TOPT-04, TOPT-05

</domain>

<decisions>
## Implementation Decisions

### Serialization & Compression (TOPT-01, TOPT-04)
- Two-layer approach: Paperclip compacts initial context (structured brief), Anthropic compaction API handles conversation history
- Structured brief format for issue context:
  - Issue title (full)
  - Description truncated to ~2K chars
  - Last 3 comments, each truncated to ~500 chars
  - Triggering comment in full (the one that caused the agent to wake)
  - Strip orchestration metadata (internal fields, timestamps, IDs not needed by agent)
- Use Anthropic server-side compaction API (beta header `compact-2026-01-12`) for multi-turn conversation history management
  - Supported on Sonnet 4.6 and Opus 4.6
  - Auto-summarizes conversation when approaching context limits
  - No custom summarization logic needed
- Target: 40-70% reduction in formatting waste for initial context, Anthropic handles history compaction

### Token Budget Enforcement (TOPT-02)
- Three-tier budget hierarchy: per-run override > per-agent default > per-project default
- Plan-aware: if using a model/tool with external plan limits (e.g., Anthropic API plan token limits), respect those. No-limit plans = no budget cap unless explicitly set
- Graceful wind-down at ~90% of budget: inject system message telling agent to wrap up current work and commit
- Do NOT hard-kill mid-execution — let the agent finish its current step
- Live counter with budget bar in UI, extending Phase 1's live token counter:
  - Progress bar showing consumption vs budget
  - Yellow at 80%, red at 95%
  - "No budget" state when no limit is configured (show counter without bar)

### Task-Type Prompt Routing (TOPT-03)
- Task type determined from issue labels (bug, feature, review, refactor)
- Four task types at launch with distinct prompt templates:
  - **Bug fix**: Focus on reproduction steps, root cause analysis, minimal fix, test coverage
  - **Feature**: Focus on requirements, implementation plan, integration points, tests
  - **Review**: Focus on diff analysis, structured feedback, code quality, suggestions
  - **Refactor**: Focus on code structure, no behavior changes, preserve tests, improve readability
- Fallback: best-effort auto-detect from issue content when no label present; use generic (current full-context) template if detection is low confidence
- System-defined default templates + operator overrides per agent or per project
- Each template includes only context relevant to that task type (e.g., review template gets PR diff but not full issue history)

### Prompt Caching Strategy (TOPT-05)
- 4-layer prompt structure optimized for Anthropic prefix caching:
  1. Static system prompt + tool definitions (most stable, cached across all runs)
  2. Project context (agent instructions, skills — rarely changes, cached across runs for same agent)
  3. Task-type template + issue context (changes per issue, but stable within a run)
  4. Conversation messages (changes every turn, never cached except via compaction)
- Tool definitions sorted in stable order (alphabetical or by category) so tool block is identical across runs for same agent configuration
- Natural cache expiration (Anthropic's 5-minute TTL) — no proactive invalidation logic when instructions change
- Cache hit rates tracked and displayed as analytics dashboard metric on Costs page, extending Phase 1's existing cachedInputTokens tracking

### Claude's Discretion
- Exact serialization format details (JSON structure, field ordering, whitespace handling)
- Token estimation adjustments for compressed vs uncompressed content
- Auto-detection heuristics for task type inference from issue content
- How to structure the compaction API integration within the heartbeat loop

</decisions>

<specifics>
## Specific Ideas

- Reference: Thariq's article "Lessons from Building Claude Code" — prompt caching is prefix match, structure static content first. Claude Code achieves near-100% cache hits after turn 1 with this approach.
- Anthropic compaction API (beta `compact-2026-01-12`) handles conversation summarization server-side — no need to build custom summarization
- Cache reads cost 10% of input price — this is where the 90% savings come from
- Agents could help improve prompt templates over time (deferred to Phase 4 AGNT-02)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/services/token-estimation.ts`: estimateTokens, estimatePromptBreakdown, computeContextUtilization — extend for compressed context measurement
- `packages/shared/src/model-context-limits.ts`: Model context window sizes — use for budget percentage calculations
- `packages/shared/src/types/usage.ts`: TokenBreakdown and UsageJsonExtended — extend with budget fields
- `ui/src/components/ContextUtilizationBar.tsx`: Existing progress bar — adapt for budget visualization
- Phase 1 live token counter + WebSocket pipeline — extend for budget bar

### Established Patterns
- Token estimation uses ~4 chars/token heuristic (established in Phase 1)
- Live usage stored in React Query cache via setQueryData (no refetch storms)
- WebSocket heartbeat.run.usage event for real-time UI updates
- Cost service SQL aggregation with cachedInputTokens already tracked

### Integration Points
- `server/src/services/heartbeat.ts` (line ~1405): Single promptTemplate per agent — needs task-type routing
- `server/src/services/heartbeat.ts` (line ~1820): contextSnapshot built as Record<string, unknown> — apply serialization here
- `packages/adapters/claude-local/src/server/execute.ts` (line ~358): renderTemplate() — extend with task-type template selection
- `packages/adapter-utils/src/types.ts`: AdapterExecutionContext — extend with budget info
- `server/src/services/costs.ts`: Cost aggregation — extend with cache efficiency metrics

</code_context>

<deferred>
## Deferred Ideas

- Agents self-improving prompt templates based on run outcomes — fits Phase 4 AGNT-02 (skill profiles)
- A/B testing prompt templates for effectiveness comparison — v2 requirement TOPT-07
- Model routing by task complexity (cheaper models for simple tasks) — v2 requirement TOPT-06

</deferred>

---

*Phase: 02-context-optimization-pipeline*
*Context gathered: 2026-03-10*
