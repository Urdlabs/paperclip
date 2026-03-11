# Requirements: Paperclip (Urdlabs Fork)

**Defined:** 2026-03-09
**Core Value:** Agents that do more with less — smarter context, lower cost, better results

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Token Analytics

- [x] **TOKN-01**: System tracks input/output/cached tokens per run, broken down by phase (system prompt, issue context, tool calls, conversation history)
- [x] **TOKN-02**: Dashboard shows token usage per agent, per project, and per run with cost attribution
- [x] **TOKN-03**: Context window utilization metrics show percentage breakdown of what fills the context (system prompt, issue context, files, history)
- [x] **TOKN-04**: Real-time token counter displays live token consumption during active runs via WebSocket

### Token Optimization

- [x] **TOPT-01**: Data serialization optimization compacts issue context, file summaries, and conversation history before sending to agents (targeting 40-70% reduction in formatting waste)
- [x] **TOPT-02**: Per-run token budget cap with graceful early termination when budget is reached
- [x] **TOPT-03**: Smart prompt templates per task type (bug fix, feature, review, etc.) that include only relevant context for that task
- [x] **TOPT-04**: Context compression pipeline with deduplication, rolling summaries, and history compaction (targeting 40-60% token reduction)
- [x] **TOPT-05**: Prompt caching awareness — structure prompts to maximize Anthropic prompt cache hits (90% savings on cached input)

### Notifications

- [ ] **NOTF-01**: Outgoing webhook system allows users to configure arbitrary HTTP endpoints that receive structured event payloads
- [ ] **NOTF-02**: Run failure alerting pushes notifications when agent runs fail or error, via configured webhook endpoints
- [ ] **NOTF-03**: Webhook event types include: run.completed, run.failed, run.started, approval.requested, issue.created, issue.updated

### Monitoring UX

- [ ] **MNTR-01**: Trace visualization shows structured execution path (prompt → tool calls → responses → decisions) with timing and nesting, similar to Langfuse traces
- [ ] **MNTR-02**: Filtered activity feeds allow filtering by agent, project, event type, and severity on the activity page
- [ ] **MNTR-03**: Token analytics dashboard with charts for token usage trends, cost per agent, cost per project, and context composition breakdown (research: Builderz Mission Control for UX patterns)

### Agent Capabilities

- [ ] **AGNT-01**: Task decomposition allows breaking complex issues into subtasks with parent-child relationships and dependency ordering
- [ ] **AGNT-02**: Agent skills/persona library provides predefined skill profiles (refactor, test-writer, reviewer, debugger) that shape agent prompt and behavior
- [ ] **AGNT-03**: Dedicated code review workflow where review-assigned agents receive PR diffs, produce structured feedback, and post review comments

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Advanced Token Optimization

- **TOPT-06**: Model routing by task complexity — use cheaper models for simple tasks, frontier models for complex reasoning
- **TOPT-07**: Automated prompt A/B testing to compare template effectiveness

### Integrations

- **INTG-01**: Slack integration (bidirectional) — send notifications, receive commands
- **INTG-02**: Linear/Jira bidirectional issue sync
- **INTG-03**: Email notifications for approvals and failures
- **INTG-04**: MCP server support — expose Paperclip as MCP tools
- **INTG-05**: MCP client support — let agents use MCP servers as tool providers

### Monitoring UX

- **MNTR-04**: Historical run comparison — side-by-side diff of two runs
- **MNTR-05**: Agent timeline view — Gantt-chart view of agent activity over time
- **MNTR-06**: Run replay / time-travel debugging

### Agent Capabilities

- **AGNT-04**: Parallel agent coordination on single issue
- **AGNT-05**: Spec-driven development integration
- **AGNT-06**: Automated test running and structured result parsing

## Out of Scope

| Feature | Reason |
|---------|--------|
| Built-in IDE / code editor | Agents work in repos via CLI. Users have their own IDEs |
| Custom LLM hosting | Use provider APIs. Let users bring their own keys |
| Visual agent builder (drag-and-drop) | Config-driven simplicity is the strength |
| Multi-tenant SaaS billing | Self-hosted tool, not a SaaS product |
| Mobile app | Web works on mobile browsers. PWA if needed |
| Chat-with-agent interface | Task-based orchestration, not conversational. Issue comments serve as async communication |
| Plugin marketplace | Adapter system is the extension point. Community shares via npm |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TOKN-01 | Phase 1 | Complete |
| TOKN-02 | Phase 1 | Complete |
| TOKN-03 | Phase 1 | Complete |
| TOKN-04 | Phase 1 | Complete |
| TOPT-01 | Phase 2 | Complete |
| TOPT-02 | Phase 2 | Complete |
| TOPT-03 | Phase 2 | Complete |
| TOPT-04 | Phase 2 | Complete |
| TOPT-05 | Phase 2 | Complete |
| NOTF-01 | Phase 4 | Pending |
| NOTF-02 | Phase 4 | Pending |
| NOTF-03 | Phase 4 | Pending |
| MNTR-01 | Phase 3 | Pending |
| MNTR-02 | Phase 3 | Pending |
| MNTR-03 | Phase 3 | Pending |
| AGNT-01 | Phase 4 | Pending |
| AGNT-02 | Phase 4 | Pending |
| AGNT-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after roadmap creation*
