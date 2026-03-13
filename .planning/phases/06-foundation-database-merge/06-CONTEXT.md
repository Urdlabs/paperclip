# Phase 6: Foundation & Database Merge - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Merge upstream's shared packages (`packages/shared`, `packages/adapter-utils`) and database layer (`packages/db`) into the fork using the conflict map from phase 5 as a playbook. Verify the full CI suite passes after merge. This is the first merge chunk — server, UI, and infrastructure merges happen in phase 7.

</domain>

<decisions>
## Implementation Decisions

### Merge Technique
- Single merge with staged resolution: run `git merge --no-ff --no-commit upstream/master`, resolve only DB + shared package conflicts in this phase
- One merge commit for all foundation files (DB + shared + adapter-utils resolved together)
- For DB migration meta conflicts (_journal.json, 0026_snapshot, 0027_snapshot): keep ours — renumbering already handled in phase 5
- Run migration compat script (`scripts/check-migration-compat.ts`) against a test database if one is available
- Phase 7 continuation technique: Claude's discretion (abort and re-merge vs keep state)

### Verification Depth
- Full CI suite must pass after foundation merge: typecheck + full test suite (455 tests) + build
- Fix forward on test failures — patch until green, even if it means touching server code earlier than planned
- v1.0 canary tests (export canary + API smoke) must pass as part of verification
- Regenerate pnpm lockfile in this phase (delete + `pnpm install`), then regenerate again in phase 7 after all deps are final

### Error Handling
- If conflict resolution produces broken code: rollback to `pre-upstream-sync` tag, analyze, try again
- Create `post-foundation-merge` tag after successful foundation merge — gives phase 7 its own rollback point
- Recovery preference: rollback over fix-forward for merge errors; fix-forward for test failures

### Claude's Discretion
- Exact technique for phase 7 continuation (abort+re-merge vs staged working tree)
- Order of conflict resolution within the foundation chunk
- How to handle upstream TypeScript schema additions that may need stub types temporarily

</decisions>

<specifics>
## Specific Ideas

- Conflict map at `.planning/CONFLICT-MAP.md` is the merge playbook — follow its resolution strategies
- Phase 5 already created renumbered migrations (0031-0032), snapshot chain is verified continuous
- The 3 DB migration meta file conflicts should be trivial — just keep ours during merge
- `packages/adapter-utils/src/index.ts` conflict is EASY per conflict map — both sides added exports, combine both

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.planning/CONFLICT-MAP.md`: Per-file conflict analysis with resolution strategies for all 16 files
- `scripts/check-migration-compat.ts`: Dry-run migration compatibility checker
- `server/src/__tests__/v1-feature-exports.test.ts`: Canary export tests (32 exports)
- `server/src/__tests__/v1-api-smoke.test.ts`: API smoke tests (4 route groups)
- Git tag `pre-upstream-sync` and branch `pre-upstream-sync-backup`: Rollback safety net

### Established Patterns
- pnpm workspace dependency order: shared → db → adapter-utils → server → UI → CLI
- Drizzle migration chain: fork 0000-0030, upstream renumbered to 0031-0032
- Monorepo typecheck: `pnpm -r typecheck` or per-package `pnpm --filter @paperclipai/db typecheck`

### Integration Points
- Foundation conflicts in scope: `_journal.json`, `0026_snapshot.json`, `0027_snapshot.json` (DB), `packages/adapter-utils/src/index.ts` (shared)
- Non-conflicting upstream changes in foundation packages will auto-merge cleanly
- 459 files changed in upstream — most are non-conflicting additions that merge automatically

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-foundation-database-merge*
*Context gathered: 2026-03-12*
