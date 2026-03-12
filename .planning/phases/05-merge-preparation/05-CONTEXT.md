# Phase 5: Merge Preparation - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Prepare the fork for a safe, reversible upstream merge. Map all 16 file conflicts with resolution strategies, resolve Drizzle migration numbering collision, establish rollback safety net, and document all v1.0-specific code paths with canary tests. No actual merging happens in this phase.

</domain>

<decisions>
## Implementation Decisions

### Migration Renumbering
- Renumber upstream's migrations (0026-0027) to 0031-0032, keeping fork's deployed migrations (0026-0030) untouched
- Auto-regenerate Drizzle journal and snapshot files, then verify with `drizzle-kit generate` producing no diff
- Generate a migration compatibility check script that verifies upstream's new tables/columns don't conflict with fork's existing schema on deployed databases
- Deployed production/staging databases exist with fork migrations already applied -- no destructive changes to migration numbering on fork side

### Rollback Strategy
- Create both a git tag (`pre-upstream-sync`) AND a branch (`pre-upstream-sync-backup`) before any merge work
- Tag each merge chunk for granular rollback (e.g., `post-chunk-1-db`, `post-chunk-2-server`)
- Use merge commits throughout so both per-chunk revert (`git revert -m 1`) and full reset to tag are available
- Recovery decision (revert chunk vs. start over) made at the time based on severity

### Feature Manifest
- Markdown checklist of all v1.0-specific routes, services, DB exports, and UI components grouped by feature area
- Canary tests covering both import/export verification (all v1.0 modules export expected symbols) AND API endpoint smoke tests (hit each v1.0 endpoint, verify 200 + correct response shape)
- Canary tests integrated into existing test suite as permanent regression tests (not a separate file)

### Conflict Resolution Documentation
- Per-file strategy notes for all 16 conflicting files: area category, what fork changed, what upstream changed, resolution strategy (keep ours/theirs/manual merge)
- Deep-dive line-by-line analysis for the 2-3 hardest conflicts: `server/src/index.ts` (upstream restructured into `startServer()` export) and `server/src/services/heartbeat.ts` (both sides heavily modified)
- Conflict map stored at `.planning/CONFLICT-MAP.md` for easy access during merge phases 6-7

### Claude's Discretion
- Exact format and grouping of the conflict map document
- Which v1.0 API endpoints are most critical for canary smoke tests
- Level of detail in per-file strategy notes for non-critical conflicts

</decisions>

<specifics>
## Specific Ideas

- Migration compatibility check script should run against a real database connection to verify schema compatibility
- Conflict map should be actionable enough that phases 6-7 can follow it as a merge playbook
- Hard conflict deep-dives should identify exactly which fork code to preserve and which upstream changes to accept

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- 3 existing GitHub Actions workflows (`pr-policy.yml`, `pr-verify.yml`, `refresh-lockfile.yml`) -- verify they still work post-merge
- 411 existing tests (374 server, 37 UI) -- baseline for post-merge verification
- Drizzle ORM migration infrastructure in `packages/db/src/migrations/`

### Established Patterns
- Drizzle migration naming: `NNNN_adjective_name.sql` with sequential numbering and `meta/_journal.json` index
- pnpm workspace monorepo structure: shared packages -> db -> server -> adapters -> UI -> CLI

### Integration Points
- Fork migrations 0026-0030: `rainy_blade`, `simple_toxin`, `swift_wonder_man`, `common_sheva_callister`, `sharp_korath`
- Upstream migrations 0026-0027: `lying_pete_wisdom`, `tranquil_tenebrous`
- Divergence point: both histories share idx 0-25 (`nasty_salo` is last common migration)

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 05-merge-preparation*
*Context gathered: 2026-03-12*
