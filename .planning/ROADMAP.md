# Roadmap: Paperclip Token Optimization & Observability

## Overview

This milestone transforms Paperclip from a functional agent orchestrator into one that is measurably efficient. The arc is: instrument what agents consume (Phase 1), reduce that consumption through a context pipeline (Phase 2), make the improvements visible through monitoring dashboards and traces (Phase 3), then round out the platform with notifications and richer agent capabilities (Phase 4). Every phase produces a deployable increment. The ordering follows the research principle: observe, optimize, visualize.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Token Analytics Foundation** - Instrument token consumption per run with cost attribution and real-time visibility
- [x] **Phase 2: Context Optimization Pipeline** - Reduce agent token consumption through serialization, compression, caching, and budgets (completed 2026-03-11)
- [ ] **Phase 3: Observability & Monitoring UX** - Trace visualization, filtered activity feeds, and analytics dashboards
- [ ] **Phase 4: Notifications & Agent Capabilities** - Outgoing webhooks, failure alerting, task decomposition, skills, and code review workflows

## Phase Details

### Phase 1: Token Analytics Foundation
**Goal**: Operators can see exactly where every token goes -- per run, per agent, per project -- with live visibility during execution
**Depends on**: Nothing (first phase)
**Requirements**: TOKN-01, TOKN-02, TOKN-03, TOKN-04
**Success Criteria** (what must be TRUE):
  1. After any agent run completes, the operator can view a breakdown of input/output/cached tokens split by phase (system prompt, issue context, tool calls, conversation history)
  2. The dashboard shows token usage and cost attribution filterable by agent, project, and individual run
  3. Context window utilization is displayed as a percentage breakdown showing what fills the context for each run
  4. During an active run, a live token counter updates in real-time showing current consumption
**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md -- Schema extension, shared types, token estimation service, cost service extension, heartbeat integration
- [x] 01-02-PLAN.md -- Real-time Claude usage stream parsing, debounced WebSocket event emission
- [x] 01-03-PLAN.md -- UI: Costs page token metrics, run detail token breakdown, context utilization bar, live counter

### Phase 2: Context Optimization Pipeline
**Goal**: Agent runs consume significantly fewer tokens through smarter context preparation, compression, and budget enforcement
**Depends on**: Phase 1
**Requirements**: TOPT-01, TOPT-02, TOPT-03, TOPT-04, TOPT-05
**Success Criteria** (what must be TRUE):
  1. Issue context, file summaries, and conversation history are serialized in a compact format, with measurable reduction visible in Phase 1 analytics (targeting 40-70% formatting waste reduction)
  2. An operator can set a token budget on a run, and the agent terminates gracefully when the budget is reached rather than continuing to burn tokens
  3. Different task types (bug fix, feature, review) use tailored prompt templates that include only context relevant to that task
  4. Conversation history is compressed through deduplication and rolling summaries, with measurable reduction in analytics (targeting 40-60% token reduction)
  5. Prompts are structured to maximize Anthropic prompt cache hits, and cache hit rates are visible in analytics
**Plans:** 3/3 plans complete

Plans:
- [x] 02-01-PLAN.md -- Context pipeline core: shared types, pipeline runner, 4 processors (task-type resolver, context serializer, deduplicator, prompt reorderer)
- [x] 02-02-PLAN.md -- Token budget resolution service (three-tier hierarchy) and usage tracker budget warning extension
- [x] 02-03-PLAN.md -- Heartbeat integration, adapter compaction env var, budget bar UI, compression metrics display

### Phase 3: Observability & Monitoring UX
**Goal**: Operators can deeply inspect agent execution and understand system behavior through traces, filtered feeds, and rich analytics charts
**Depends on**: Phase 1, Phase 2
**Requirements**: MNTR-01, MNTR-02, MNTR-03
**Success Criteria** (what must be TRUE):
  1. For any completed run, the operator can view a structured trace showing the execution path (prompt, tool calls, responses, decisions) with timing and nesting depth
  2. The activity page supports filtering by agent, project, event type, and severity -- and the filters persist across page navigation
  3. A dedicated token analytics dashboard displays interactive charts for token usage trends over time, cost per agent, cost per project, and context composition breakdown
**Plans:** 2/3 plans executed

Plans:
- [ ] 03-01-PLAN.md -- Trace visualization: tree transformation utility, TraceView/TraceNode components, run detail integration
- [ ] 03-02-PLAN.md -- Activity feed filtering: severity derivation, backend filter extensions, multi-filter bar with URL param sync
- [ ] 03-03-PLAN.md -- Analytics dashboard: Recharts installation, time-series backend endpoint, 4 interactive charts on Costs page

### Phase 4: Notifications & Agent Capabilities
**Goal**: The platform notifies operators of important events via webhooks and agents can handle more complex work through task decomposition, skill profiles, and code review
**Depends on**: Phase 1
**Requirements**: NOTF-01, NOTF-02, NOTF-03, AGNT-01, AGNT-02, AGNT-03
**Success Criteria** (what must be TRUE):
  1. An operator can configure outgoing webhook endpoints that receive structured JSON payloads for configurable event types (run.completed, run.failed, run.started, approval.requested, issue.created, issue.updated)
  2. When an agent run fails, a notification is automatically pushed to all configured webhook endpoints within seconds
  3. An operator can break a complex issue into subtasks with parent-child relationships and dependency ordering, and agents process subtasks in the correct order
  4. An operator can assign a skill profile (refactor, test-writer, reviewer, debugger) to an agent, and the agent's prompt and behavior change accordingly
  5. A code review workflow exists where review-assigned agents receive PR diffs, produce structured feedback, and post review comments to the PR
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Token Analytics Foundation | 3/3 | Complete | 2026-03-10 |
| 2. Context Optimization Pipeline | 3/3 | Complete   | 2026-03-11 |
| 3. Observability & Monitoring UX | 2/3 | In Progress|  |
| 4. Notifications & Agent Capabilities | 0/0 | Not started | - |
