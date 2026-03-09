# Feature Landscape

**Domain:** AI Agent Orchestration Platform (Coding Agents)
**Researched:** 2026-03-09
**Overall confidence:** MEDIUM-HIGH

## Table Stakes

Features users expect from an AI agent orchestration platform for coding agents. Missing any of these and the product feels incomplete or unprofessional.

| Feature | Why Expected | Complexity | Paperclip Status | Notes |
|---------|--------------|------------|-----------------|-------|
| Multi-agent execution with heartbeat loop | Core value prop -- agents must run autonomously on schedules | High | **Exists** | Heartbeat-driven with max 10 concurrent runs per agent |
| Issue/task tracker with assignment | Agents need work items to pick up | Medium | **Exists** | Full issue tracker with comments, labels, attachments, approvals |
| Real-time run output streaming | Users need to see what agents are doing right now | Medium | **Exists** | WebSocket live events + LiveRunWidget with transcript entries |
| Cost tracking per agent and per project | Without cost visibility, token spend spirals | Medium | **Exists** | Cost events table, by-agent and by-project breakdowns, budget caps |
| Budget caps with auto-pause | Runaway agents are the #1 fear; must have hard stops | Low | **Exists** | Agent auto-pauses when budget exceeded |
| Session resume across runs | Starting fresh each time wastes tokens on re-reading context | High | **Exists** | Session codec system with cwd-aware resume across all adapters |
| Human-in-the-loop approvals | Agents making unsupervised changes is unacceptable for many workflows | Medium | **Exists** | Approval workflow with pending/approved/rejected states |
| GitHub integration (issues, PRs, webhooks) | GitHub is where code lives; agents must interact with it natively | High | **Exists** | Full GitHub App with webhook automation |
| Dashboard with health overview | Operators need a single pane of glass | Medium | **Exists** | MetricCards, charts for run activity, priority, success rate |
| Agent configuration and status management | Must be able to configure, pause, resume, terminate agents | Medium | **Exists** | Full CRUD with config revisions and status transitions |
| Activity log / audit trail | Need to know what happened and when for debugging and accountability | Medium | **Exists** | Activity log with entity type tracking |
| Pluggable adapter system | Must support multiple AI backends (Claude, Codex, Cursor, etc.) | High | **Exists** | 6 adapters + 2 built-in transports |
| Token usage tracking (input/output) | Granular token metrics are essential for optimization | Low | **Exists** | Input/output tokens tracked per cost event and per run |
| Outgoing notifications (Slack/Discord/webhooks) | Users must be alerted when agents complete, fail, or need attention | Medium | **Missing** | No outgoing webhooks or notification channels exist |
| Run failure alerting | Silent failures are the worst UX -- users must know when things break | Low | **Missing** | Errors visible in dashboard but no push notifications |

## Differentiators

Features that set Paperclip apart from competitors. Not expected but highly valued. These are where investment yields outsized returns.

### Token Optimization Features

| Feature | Value Proposition | Complexity | Paperclip Status | Notes |
|---------|-------------------|------------|-----------------|-------|
| Context compression / rolling summaries | Factory.ai's approach: persist anchored summaries, compress dropped spans. Cuts token use 40-60% without quality loss | High | **Missing** | Adapters currently delegate compaction to agent runtimes (Claude Code, Codex). No Paperclip-level compression |
| Smart prompt templating per task type | Different task types (bug fix, feature, review) need different prompt structures. Optimized templates reduce wasted tokens | Medium | **Missing** | Agents get the same generic prompt structure regardless of task type |
| Model routing by task complexity | Use cheaper models (Haiku, GPT-4o-mini) for simple tasks, frontier models for complex reasoning. Can save 70-90% on routine tasks | High | **Missing** | Each agent is locked to one adapter type. No per-task model selection |
| Token budget per run with early termination | Set a max token budget per run and gracefully stop before blowing it | Medium | **Missing** | Budget caps exist at monthly level but not per-run |
| Prompt caching awareness | Anthropic prompt caching saves 90% on cached input tokens. Platform should structure prompts to maximize cache hits | Medium | **Missing** | No prompt caching strategy. Each adapter invokes CLI tools that manage their own caching |
| Data serialization optimization | Poor JSON/XML formatting wastes 40-70% of context window. Compact serialization for issue context, codebase summaries | Low | **Missing** | Issue context passed as-is; no serialization optimization |
| Run-level token analytics with cost attribution | Show tokens consumed per run, per tool call, per turn -- enabling optimization decisions | Medium | **Partial** | Usage tracked at run level (usageJson) but not broken down by tool call or turn |
| Context window utilization metrics | Show what percentage of available context window is system prompt, issue context, file content, conversation history | Medium | **Missing** | No visibility into context composition |

### Agent Monitoring UX Features

| Feature | Value Proposition | Complexity | Paperclip Status | Notes |
|---------|-------------------|------------|-----------------|-------|
| Trace visualization (execution DAG) | Show the full execution path: prompt -> tool calls -> responses -> decisions. Like Langfuse traces | High | **Missing** | LiveRunWidget shows transcript entries but not structured traces with timing and nesting |
| Split-screen run view (code + agent output) | See what the agent is doing alongside the code it's modifying | High | **Missing** | No code diff preview during or after runs |
| Agent "thought process" display | Show thinking/reasoning steps prominently, not just tool calls | Medium | **Partial** | Thinking entries are shown in transcript but as `[thinking]` text, not first-class UI |
| Historical run comparison | Compare two runs side-by-side to understand performance changes | Medium | **Missing** | Individual run history exists but no comparison view |
| Real-time token counter during runs | Show tokens being consumed live, like a fuel gauge | Low | **Missing** | Token totals shown after completion, not during |
| Agent timeline view | Gantt-chart-like view showing what each agent was doing over time | Medium | **Missing** | Run activity chart exists but no per-agent timeline |
| Filtered activity feeds | Filter activity by agent, project, event type, severity | Low | **Partial** | Activity page exists but limited filtering |
| Run replay / time-travel debugging | Replay a completed run step-by-step to understand agent behavior | High | **Missing** | Run events stored but no replay UI |

### Integration Ecosystem Features

| Feature | Value Proposition | Complexity | Paperclip Status | Notes |
|---------|-------------------|------------|-----------------|-------|
| Slack integration (bidirectional) | Send notifications to Slack, receive commands from Slack. Table stakes for team use | Medium | **Missing** | No Slack integration |
| Linear/Jira sync | Sync issues bidirectionally with external project trackers | High | **Missing** | Only GitHub issues synced inbound via webhooks |
| Outgoing webhook system (generic) | Let users configure arbitrary webhook endpoints for events | Medium | **Missing** | Only incoming GitHub webhooks exist |
| MCP server support | Expose Paperclip capabilities as MCP tools so agents in other environments can interact | Medium | **Missing** | No MCP server. Agents use CLI tools |
| MCP client support for agent tools | Let agents use MCP servers as tool providers, accessing databases, APIs, etc. | Medium | **Missing** | Agent tools are adapter-specific CLI flags |
| Email notifications for approvals/failures | Low-friction notification channel for non-Slack users | Low | **Missing** | No email integration |
| Custom event triggers (cron, webhook, API) | Trigger agent work from external events beyond GitHub | Medium | **Partial** | GitHub webhook triggers exist; API-based wakeup exists; no cron scheduling |

### Agent Capability Features

| Feature | Value Proposition | Complexity | Paperclip Status | Notes |
|---------|-------------------|------------|-----------------|-------|
| Task decomposition with dependency graph | Break complex issues into subtasks and execute them in dependency order | High | **Missing** | Issues are flat; no parent-child decomposition |
| Parallel agent coordination on single issue | Multiple agents working on different parts of the same task | High | **Missing** | One agent per issue assignment |
| Agent skills/persona library | Predefined skill sets (refactor, test-writer, reviewer) that shape agent behavior | Medium | **Partial** | Agent roles exist (developer, reviewer, etc.) but not deep skill profiles |
| Spec-driven development integration | Use requirements.md / design.md as source of truth for agent behavior, per Kiro/Tessl pattern | Medium | **Missing** | No spec-driven workflow |
| Automated test running and result parsing | Agent runs tests, parses failures, and iterates -- closing the feedback loop | Medium | **Missing** | Agents can run tests via CLI tools but no structured test result parsing |
| Code review agent workflow | Dedicated agent workflow for reviewing PRs with structured feedback | Medium | **Missing** | Agents can be assigned review tasks but no specialized review workflow |

## Anti-Features

Features to explicitly NOT build. These are tempting but counterproductive.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Built-in IDE / code editor | Massive scope creep. Agents work in repos via CLI tools. Users have their own IDEs | Link to external tools. Show diffs and logs, not an editor |
| Custom LLM hosting | Managing model infrastructure is a full company's worth of work. Use provider APIs | Support adapter plugins for any provider. Let users bring their own API keys |
| Visual agent builder (drag-and-drop) | Low-code agent builders produce brittle, hard-to-debug workflows. Paperclip's strength is config-driven simplicity | Keep declarative YAML/JSON config. Add better templates and presets instead |
| Multi-tenant SaaS billing | Adds enormous complexity (payments, plans, quotas, tenant isolation) for a personal/team tool | Keep self-hosted. If billing needed later, integrate Stripe minimally |
| Mobile app | Small screen is wrong surface for agent monitoring. Web works on mobile browsers | Ensure responsive web design. Add push notifications via PWA if needed |
| Chat-with-agent interface | Tempting but fundamentally different from task-based orchestration. Chat encourages vague requests; tasks enforce structure | Improve issue templates and context fields instead. Agent comments on issues serve as async "chat" |
| Plugin marketplace | Premature abstraction. The adapter system is the extension point | Keep adapter plugin interface clean. Document how to create adapters. Community can share via npm |
| Real-time collaborative editing of agent configs | Overkill for team sizes that use this tool. Config revisions handle versioning | Config revision history with rollback is sufficient |

## Feature Dependencies

```
Outgoing webhooks -> Slack integration (Slack uses webhooks)
Outgoing webhooks -> Email notifications (email is a notification channel)
Outgoing webhooks -> Run failure alerting (alerts need a delivery channel)

Token budget per run -> Real-time token counter (need live tracking to enforce budgets)
Context window utilization metrics -> Context compression (need visibility before optimization)
Run-level token analytics -> Context window utilization metrics (analytics feed visibility)

Trace visualization -> Run replay (traces are the data source for replay)
Historical run comparison -> Run-level token analytics (comparison needs per-run metrics)

Task decomposition -> Parallel agent coordination (decomposed tasks enable parallelism)
Task decomposition -> Spec-driven development (specs define decomposition structure)

Model routing by task complexity -> Smart prompt templating (routing and templates work together)

MCP client support -> Agent skills library (MCP servers expand available skills)

Linear/Jira sync -> Outgoing webhooks (sync often built on webhook primitives)
```

## MVP Recommendation for Next Milestone

### Priority 1: Token Optimization (Highest ROI)

The project explicitly identifies token optimization as the top priority. Start here.

1. **Data serialization optimization** (Low complexity, immediate impact) -- Compact the issue context, file summaries, and conversation history that get stuffed into agent prompts. WebSearch sources suggest 40-70% of context is wasted on formatting.
2. **Run-level token analytics** (Medium complexity) -- You cannot optimize what you cannot measure. Break down token usage by run phase (system prompt, issue context, tool calls, conversation).
3. **Token budget per run** (Medium complexity) -- Prevent individual runs from consuming disproportionate tokens. Monthly budgets exist but per-run caps are missing.
4. **Smart prompt templating** (Medium complexity) -- Different task types (bug fix vs. feature vs. review) should use different prompt structures, including only relevant context.

### Priority 2: Notification Infrastructure (Unblocks everything)

5. **Outgoing webhook system** (Medium complexity) -- Generic event webhook that delivers structured payloads to user-configured URLs. This unblocks Slack, Discord, email, and any custom integration.
6. **Slack notifications** (Medium complexity, builds on webhooks) -- Agent completions, failures, approval requests sent to Slack channels.

### Priority 3: Monitoring UX (Compound value)

7. **Trace visualization** (High complexity) -- Transform the existing transcript/event data into a structured execution trace view. This is what Langfuse and AgentOps offer and what distinguishes a platform from a task runner.
8. **Filtered activity feeds** (Low complexity) -- Simple but high-impact UX improvement for the existing activity page.
9. **Real-time token counter** (Low complexity) -- Show token consumption live during runs, leveraging existing WebSocket infrastructure.

### Defer

- **Model routing by task complexity**: High complexity, requires changes to the adapter interface. Tackle after token analytics shows where routing would help most.
- **Task decomposition with dependency graph**: Architecturally complex. The current one-issue-one-agent model works for most tasks.
- **MCP server/client support**: Important for ecosystem integration but not urgent for a personal/team tool. Monitor MCP ecosystem maturity.
- **Linear/Jira sync**: Bidirectional sync is notoriously hard to get right. GitHub is the primary integration point.
- **Run replay / time-travel debugging**: Powerful but high complexity. Trace visualization is the prerequisite.
- **Parallel agent coordination**: Requires task decomposition first. Sequential execution is fine for most workflows.

## Sources

- [Deloitte - AI Agent Orchestration](https://www.deloitte.com/us/en/insights/industry/technology/technology-media-and-telecom-predictions/2026/ai-agent-orchestration.html) -- MEDIUM confidence, industry analysis
- [Redis - AI Agent Orchestration Platforms](https://redis.io/blog/ai-agent-orchestration-platforms/) -- MEDIUM confidence, platform comparison
- [Redis - LLM Token Optimization](https://redis.io/blog/llm-token-optimization-speed-up-apps/) -- MEDIUM confidence, techniques overview
- [Obvious Works - Token Optimization Saves 80%](https://www.obviousworks.ch/en/token-optimization-saves-up-to-80-percent-llm-costs/) -- LOW confidence, single source for specific numbers
- [Factory.ai - Compressing Context](https://factory.ai/news/compressing-context) -- MEDIUM confidence, specific implementation detail from a competitor
- [SitePoint - Context Compression Techniques](https://www.sitepoint.com/optimizing-token-usage-context-compression-techniques/) -- MEDIUM confidence, technique catalog
- [Agenta - Context Length Management](https://agenta.ai/blog/top-6-techniques-to-manage-context-length-in-llms) -- MEDIUM confidence
- [arxiv - Prompt Caching for Agentic Tasks](https://arxiv.org/html/2601.06007v1) -- HIGH confidence, academic paper with benchmarks
- [Langfuse - Agent Observability](https://langfuse.com/blog/2024-07-ai-agent-observability-with-langfuse) -- HIGH confidence, official product docs
- [Langfuse - Token and Cost Tracking](https://langfuse.com/docs/observability/features/token-and-cost-tracking) -- HIGH confidence, official docs
- [AIMultiple - Agentic Monitoring Tools](https://research.aimultiple.com/agentic-monitoring/) -- MEDIUM confidence, tool comparison
- [Mike Mason - AI Coding Agents 2026](https://mikemason.ca/writing/ai-coding-agents-jan-2026/) -- MEDIUM confidence, industry perspective
- [Augment Code - Devin Alternatives](https://www.augmentcode.com/tools/best-devin-alternatives) -- MEDIUM confidence, competitive analysis
- [Verdent - AI Coding Tools Comparison 2026](https://www.verdent.ai/guides/ai-coding-tools-comparison-2026) -- MEDIUM confidence
- [LogRocket - AI Agent Task Queues](https://blog.logrocket.com/ai-agent-task-queues) -- MEDIUM confidence, architecture patterns
- [liteLLM - Alerting/Webhooks](https://docs.litellm.ai/docs/proxy/alerting) -- HIGH confidence, official docs showing webhook alert patterns
- [Model Context Protocol Specification](https://modelcontextprotocol.io/specification/2025-11-25) -- HIGH confidence, official spec
- [Riloworks - Dependency Graph Agent Architecture](https://blog.riloworks.com/its-the-dependency-graph-stupid-a-guide-to-agent-architecture/) -- MEDIUM confidence
- [Permit.io - Human in the Loop Best Practices](https://www.permit.io/blog/human-in-the-loop-for-ai-agents-best-practices-frameworks-use-cases-and-demo) -- MEDIUM confidence
