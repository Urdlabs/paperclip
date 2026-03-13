# Requirements: Paperclip (Urdlabs Fork)

**Defined:** 2026-03-12
**Core Value:** Agents that do more with less -- smarter context management, lower token cost, better results -- in a tool that fits exactly how I work.

## v1.1 Requirements

Requirements for upstream sync and continuous integration. Each maps to roadmap phases.

### Merge Preparation

- [ ] **PREP-01**: All upstream conflicts are mapped and categorized by area (DB, server, UI, infra) before merge begins
- [ ] **PREP-02**: Fork state is tagged as rollback point before any merge work
- [ ] **PREP-03**: Drizzle migration collision is resolved -- fork migrations renumbered to avoid overlap with upstream 0026-0027
- [ ] **PREP-04**: Fork feature manifest documents all v1.0-specific code paths for post-merge verification

### Incremental Merge

- [x] **MERGE-01**: Shared packages and DB layer merged first with CI verification passing
- [ ] **MERGE-02**: Server and adapter layers merged with CI verification passing
- [ ] **MERGE-03**: UI and infrastructure layers merged with CI verification passing
- [ ] **MERGE-04**: pnpm lockfile regenerated cleanly after each merge chunk
- [ ] **MERGE-05**: All 226 upstream commits are merged into fork master via merge commits (not rebase)

### Post-Merge Verification

- [ ] **VERIFY-01**: Full test suite passes after merge (411+ tests)
- [ ] **VERIFY-02**: TypeScript compilation succeeds with zero errors across all packages
- [ ] **VERIFY-03**: Docker build completes successfully
- [ ] **VERIFY-04**: All v1.0 features verified working -- token analytics, context optimization, webhooks, traces, activity feeds, task decomposition, skill profiles, code review

### Continuous Sync Automation

- [ ] **SYNC-01**: GitHub Action detects new upstream commits on a weekly schedule
- [ ] **SYNC-02**: Sync PR is auto-created with upstream changelog grouped by area in PR body
- [ ] **SYNC-03**: Sync PR includes conflict area categorization and estimated resolution effort
- [ ] **SYNC-04**: Lockfile is auto-regenerated in the sync workflow (no manual lockfile conflicts)
- [ ] **SYNC-05**: git rerere is enabled to auto-apply previous conflict resolutions
- [ ] **SYNC-06**: README displays sync health badge showing commits behind upstream

## Future Requirements

### Advanced Sync

- **ASYNC-01**: Selective sync mode -- cherry-pick specific upstream commits instead of full merge
- **ASYNC-02**: AI-assisted conflict resolution for routine conflicts
- **ASYNC-03**: Real-time sync (webhook-triggered on upstream push)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Rebase-based sync | Rewrites 120 fork commits, forces force-push, breaks rollback with git revert |
| Auto-merge sync PRs without review | 16 files have real conflicts in critical areas -- always require human review |
| Cherry-pick individual commits | Slower for 226 commits, loses merge marker, each commit can conflict |
| Third-party sync services (Mergify, Kodiak) | External dependency for a problem solved by 30 lines of GitHub Actions |
| Separate tracking branch mirroring upstream | Adds cognitive overhead, two sources of truth |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PREP-01 | Phase 5 | Pending |
| PREP-02 | Phase 5 | Pending |
| PREP-03 | Phase 5 | Pending |
| PREP-04 | Phase 5 | Pending |
| MERGE-01 | Phase 6 | Complete |
| MERGE-02 | Phase 7 | Pending |
| MERGE-03 | Phase 7 | Pending |
| MERGE-04 | Phase 7 | Pending |
| MERGE-05 | Phase 7 | Pending |
| VERIFY-01 | Phase 7 | Pending |
| VERIFY-02 | Phase 7 | Pending |
| VERIFY-03 | Phase 7 | Pending |
| VERIFY-04 | Phase 7 | Pending |
| SYNC-01 | Phase 8 | Pending |
| SYNC-02 | Phase 8 | Pending |
| SYNC-03 | Phase 8 | Pending |
| SYNC-04 | Phase 8 | Pending |
| SYNC-05 | Phase 8 | Pending |
| SYNC-06 | Phase 8 | Pending |

**Coverage:**
- v1.1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-03-12*
*Last updated: 2026-03-12 after roadmap creation*
