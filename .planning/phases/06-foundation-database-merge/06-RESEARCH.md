# Phase 6: Foundation & Database Merge - Research

**Researched:** 2026-03-12
**Domain:** Git merge conflict resolution, Drizzle ORM migration merging, pnpm monorepo dependency management
**Confidence:** HIGH

## Summary

Phase 6 executes the actual upstream merge (`git merge --no-ff --no-commit upstream/master`) and resolves all 16 conflicting files to produce a single merge commit. The "foundation & database" framing reflects the PRIMARY verification focus: `packages/shared`, `packages/adapter-utils`, and `packages/db` must compile and function correctly. However, due to git merge mechanics, ALL 16 conflicts must be resolved in this single merge commit -- git does not allow committing with unresolved conflicts.

The key technical constraint verified during research: `git commit` during a merge state fails with "Committing is not possible because you have unmerged files" if any conflicts remain unresolved. This means phase 6 must resolve every conflict, not just the foundation subset. The conflict map from phase 5 provides resolution strategies for all 16 files, making this feasible in a single operation. Foundation conflicts (4 files: 3 DB meta + 1 adapter-utils) are EASY. Server conflicts (4 files) include 2 HARD ones requiring careful manual merge. UI conflicts (5 files) are MEDIUM. Infrastructure conflicts (2 files) are EASY/MEDIUM. Lockfile is always regenerated.

Post-merge, the full CI suite (typecheck + 455 tests + build) must pass. The migration compatibility script (`scripts/check-migration-compat.ts`) should be run if a database is available. The v1.0 canary tests (32 export assertions + 4 API smoke tests) provide the critical regression safety net.

**Primary recommendation:** Execute the merge as a single `git merge --no-ff --no-commit upstream/master`, resolve all 16 conflicts following the conflict map strategies, regenerate the lockfile, verify CI passes, then commit and tag as `post-foundation-merge`. Phase 7 performs deeper server/UI/infra verification and fix-forward.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single merge with staged resolution: run `git merge --no-ff --no-commit upstream/master`, resolve only DB + shared package conflicts in this phase
- One merge commit for all foundation files (DB + shared + adapter-utils resolved together)
- For DB migration meta conflicts (_journal.json, 0026_snapshot, 0027_snapshot): keep ours -- renumbering already handled in phase 5
- Run migration compat script (`scripts/check-migration-compat.ts`) against a test database if one is available
- Full CI suite must pass after foundation merge: typecheck + full test suite (455 tests) + build
- Fix forward on test failures -- patch until green, even if it means touching server code earlier than planned
- v1.0 canary tests (export canary + API smoke) must pass as part of verification
- Regenerate pnpm lockfile in this phase (delete + `pnpm install`), then regenerate again in phase 7 after all deps are final
- If conflict resolution produces broken code: rollback to `pre-upstream-sync` tag, analyze, try again
- Create `post-foundation-merge` tag after successful foundation merge -- gives phase 7 its own rollback point
- Recovery preference: rollback over fix-forward for merge errors; fix-forward for test failures

### Claude's Discretion
- Exact technique for phase 7 continuation (abort+re-merge vs staged working tree)
- Order of conflict resolution within the foundation chunk
- How to handle upstream TypeScript schema additions that may need stub types temporarily

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MERGE-01 | Shared packages and DB layer merged first with CI verification passing | Full merge commit resolves all 16 conflicts; foundation packages (shared, adapter-utils, db) are verified via typecheck, test suite, and build. Conflict map provides resolution strategies for all files. |
</phase_requirements>

## Critical Technical Insight: Git Merge Mechanics

**Git does not allow partial conflict resolution in a merge commit.** Verified experimentally: attempting `git commit` during a merge with any unresolved conflicts fails with `error: Committing is not possible because you have unmerged files`. This means:

1. The `git merge --no-ff --no-commit upstream/master` command starts the merge and reports all 16 conflicts
2. ALL 16 conflicts must be resolved (via `git add`) before the merge commit can be created
3. There is no way to create a "foundation-only" merge commit that leaves server/UI conflicts for later

**Implication for phase 6:** The merge commit must resolve all 16 conflicts. The conflict map provides strategies for every file. Foundation conflicts are the primary focus, but server/UI/infra conflicts must also be resolved using the conflict map playbook. Phase 7 then focuses on deeper verification and fix-forward for any issues in the server/UI/infra areas.

**Recommendation for phase 7 continuation:** Since all conflicts are resolved in this phase's merge commit, phase 7 should focus on:
- Deeper testing of server-specific functionality
- Deeper testing of UI-specific functionality
- Infrastructure (Docker) verification
- Any fix-forward patches needed

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| git | system | Merge execution, conflict resolution, tagging | Already configured with `upstream` remote at `paperclipai/paperclip` |
| pnpm | workspace | Lockfile regeneration, monorepo builds | Project uses pnpm workspaces; lockfile must be regenerated after merge |
| TypeScript | ^5.7.3 | Typecheck verification | All packages use `tsc --noEmit` for typechecking |
| Vitest | ^3.0.5 | Test suite execution | 455 tests across server (374+) and UI (37+) |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `pnpm -r typecheck` | Verify all packages compile | After merge commit, before tagging |
| `pnpm test:run` | Run full test suite (vitest run) | After typecheck passes |
| `pnpm -r build` | Build all packages | After tests pass |
| `scripts/check-migration-compat.ts` | Dry-run migrations against test DB | If DATABASE_URL is available |

### Conflict Resolution Tools
| Git Command | Purpose | When to Use |
|-------------|---------|-------------|
| `git checkout --ours <file>` | Keep fork version entirely | DB migration meta files (3 files) |
| `git checkout --theirs <file>` | Accept upstream version entirely | Not needed for any file in this merge |
| Manual edit + `git add` | Hand-merge both sides | adapter-utils, server files, UI files |
| Delete + `pnpm install` | Regenerate from scratch | pnpm-lock.yaml (always) |

## Architecture Patterns

### Merge Execution Sequence

```
1. SAFETY: Verify pre-upstream-sync tag exists
2. MERGE: git merge --no-ff --no-commit upstream/master
3. RESOLVE: Foundation conflicts (DB meta x3, adapter-utils x1)
4. RESOLVE: Server conflicts (app.ts, index.ts, heartbeat.ts, issues.ts)
5. RESOLVE: UI conflicts (App.tsx, AgentDetail.tsx, Costs.tsx, agent-config-primitives.tsx, queryKeys.ts)
6. RESOLVE: Infrastructure conflicts (Dockerfile, ui/package.json)
7. LOCKFILE: Delete pnpm-lock.yaml, run pnpm install
8. STAGE: git add all resolved files
9. VERIFY: pnpm -r typecheck && pnpm test:run && pnpm -r build
10. COMMIT: git commit (creates merge commit)
11. TAG: git tag post-foundation-merge
```

### Conflict Resolution Order (Recommended)

Resolve in dependency order -- packages that others depend on first:

1. **packages/shared** (auto-merged, no conflicts -- but verify)
2. **packages/db** (3 conflicts: `_journal.json`, `0026_snapshot.json`, `0027_snapshot.json`)
3. **packages/adapter-utils** (1 conflict: `src/index.ts`)
4. **server** (4 conflicts: `app.ts`, `issues.ts`, `heartbeat.ts`, `index.ts`)
5. **ui** (5 conflicts: `queryKeys.ts`, `agent-config-primitives.tsx`, `App.tsx`, `Costs.tsx`, `AgentDetail.tsx`)
6. **infrastructure** (2 conflicts: `Dockerfile`, `ui/package.json`)
7. **lockfile** (1 conflict: `pnpm-lock.yaml` -- delete and regenerate)

Within each group, resolve easiest first, hardest last.

### Auto-Merged Files to Verify

The merge auto-resolves many files. Foundation-scope auto-merged files that must be verified:
- `packages/adapter-utils/src/types.ts` (auto-merged)
- `packages/db/src/schema/index.ts` (auto-merged)
- `packages/db/src/schema/issues.ts` (auto-merged)
- `packages/shared/src/constants.ts` (auto-merged)
- `packages/shared/src/index.ts` (auto-merged)
- `packages/shared/src/types/index.ts` (auto-merged)
- `packages/shared/src/types/issue.ts` (auto-merged)
- `packages/shared/src/validators/index.ts` (auto-merged)
- `packages/shared/src/validators/issue.ts` (auto-merged)

These auto-merge successfully (git's 3-way merge handles them), but typecheck will catch any issues.

### Per-File Resolution Strategies

**From CONFLICT-MAP.md (verified current):**

| File | Strategy | Complexity |
|------|----------|------------|
| `_journal.json` | `git checkout --ours` | Trivial -- renumbering already handled in phase 5 |
| `0026_snapshot.json` | `git checkout --ours` | Trivial -- upstream's 0026 was renumbered to 0031 |
| `0027_snapshot.json` | `git checkout --ours` | Trivial -- upstream's 0027 was renumbered to 0032 |
| `adapter-utils/src/index.ts` | Combine both export sets | Easy -- both sides added different exports |
| `server/src/app.ts` | Accept both imports + routes | Easy -- additive imports |
| `server/src/services/issues.ts` | Accept both additions | Medium -- fork added webhook dispatch, upstream added workspace policy |
| `server/src/services/heartbeat.ts` | Manual merge (6 conflict zones) | HARD -- see conflict map deep-dive |
| `server/src/index.ts` | Manual merge (3 conflict zones) | HARD -- see conflict map deep-dive |
| `ui/src/lib/queryKeys.ts` | Combine both key sets | Easy -- additive |
| `ui/src/components/agent-config-primitives.tsx` | Accept both form fields | Medium -- both added config fields |
| `ui/src/App.tsx` | Accept both routes | Medium -- both added route imports |
| `ui/src/pages/Costs.tsx` | Accept both visualizations | Medium -- complementary views |
| `ui/src/pages/AgentDetail.tsx` | Manual merge (tab integration) | Medium-Hard -- fork tabs into upstream layout |
| `Dockerfile` | `git checkout --ours` | Easy -- fork is superset |
| `ui/package.json` | Combine both dependency additions | Easy -- then lockfile regenerates |
| `pnpm-lock.yaml` | Delete and regenerate | Special -- always `rm && pnpm install` |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conflict resolution | Custom merge scripts | `git checkout --ours`, manual edit with conflict markers, `git add` | Git's merge machinery handles the 3-way merge; manual editing of conflict markers is the standard approach for the remaining zones |
| Lockfile merge | Attempt to hand-merge lockfile diff | `rm pnpm-lock.yaml && pnpm install` | Lockfiles are generated artifacts; regeneration is authoritative |
| Migration chain verification | Custom snapshot chain validator | `pnpm --filter @paperclipai/db typecheck` + `scripts/check-migration-compat.ts` | Existing tools already verify the migration chain |
| Export verification | Manual import checks | Existing canary tests at `server/src/__tests__/v1-feature-exports.test.ts` | Phase 5 created 32 export assertions covering all fork-only exports |
| API endpoint verification | Manual curl testing | Existing smoke tests at `server/src/__tests__/v1-api-smoke.test.ts` | Phase 5 created 4 route group smoke tests |

**Key insight:** Phase 5 already built the safety net (conflict map, canary tests, smoke tests, migration compat script). Phase 6 executes the merge using those tools -- no new tooling needed.

## Common Pitfalls

### Pitfall 1: Attempting Partial Merge Commit
**What goes wrong:** Trying to create a merge commit with only foundation conflicts resolved while leaving server/UI conflicts unresolved.
**Why it happens:** The CONTEXT.md says "resolve only DB + shared package conflicts in this phase" which suggests partial resolution.
**How to avoid:** Resolve ALL 16 conflicts in the merge commit. Git requires all conflicts resolved before commit. Use conflict map strategies for non-foundation files too.
**Warning signs:** `git commit` during merge fails with "Committing is not possible because you have unmerged files."

### Pitfall 2: Losing Fork Additions During Server Conflict Resolution
**What goes wrong:** While resolving the 2 HARD server conflicts (`index.ts` and `heartbeat.ts`), fork-only features (webhook dispatcher, token tracking, GitHub App integration) are accidentally dropped.
**Why it happens:** Both files have heavily divergent function bodies. The conflict markers interleave fork and upstream code, making it easy to accidentally choose one side and lose the other.
**How to avoid:** Follow the conflict map deep-dive analysis. Start with fork's version as base and layer upstream additions on top. The canary tests (32 export assertions) catch dropped exports after merge.
**Warning signs:** `v1-feature-exports.test.ts` fails with "expected undefined to be defined" after merge.

### Pitfall 3: Broken Snapshot Chain After Merge
**What goes wrong:** After `git checkout --ours` on DB meta files, the snapshot chain breaks because upstream's conflicting snapshots are discarded.
**Why it happens:** Phase 5 already renumbered upstream's migrations to 0031-0032 with correct prevId chains. But the merge might overwrite those files if not careful.
**How to avoid:** The 0031 and 0032 snapshot files were created in phase 5 and are NOT in the conflict list. The conflicts are on 0026 and 0027 snapshots where `git checkout --ours` keeps the fork versions. Phase 5's renumbered files (0031, 0032) are untouched by the merge since they only exist on the fork side.
**Warning signs:** `pnpm --filter @paperclipai/db typecheck` fails, or migration compat script reports chain errors.

### Pitfall 4: Lockfile Regeneration Before Conflict Resolution
**What goes wrong:** Running `pnpm install` to regenerate the lockfile while package.json conflicts are still unresolved.
**Why it happens:** The lockfile is a conflict too, and it's tempting to handle it early.
**How to avoid:** Resolve ALL package.json conflicts first (`ui/package.json` and any auto-merged package.json changes). Then delete `pnpm-lock.yaml` and run `pnpm install`. The lockfile must be the LAST conflict resolved.
**Warning signs:** `pnpm install` fails with parse errors or unresolvable version conflicts.

### Pitfall 5: Merge Commit Has Wrong Parents
**What goes wrong:** Using `git merge --squash` instead of `git merge --no-ff` creates a regular commit without merge parents, preventing per-chunk revert with `git revert -m 1`.
**Why it happens:** Confusion between merge strategies.
**How to avoid:** Always use `git merge --no-ff --no-commit upstream/master`. The `--no-ff` flag ensures a merge commit with two parents. The `--no-commit` flag gives control over when to commit.
**Warning signs:** `git log --merges` shows no merge commits. `git revert -m 1` fails.

### Pitfall 6: Upstream DB Schema Changes Not In Scope Files
**What goes wrong:** Upstream added new DB schema files and table exports that auto-merge cleanly but reference types that don't exist yet, causing typecheck failures.
**Why it happens:** Upstream's changes to `packages/db/src/schema/index.ts` and `packages/db/src/schema/issues.ts` auto-merge (not in conflict list) but may depend on upstream's new service/type files that are also auto-added.
**How to avoid:** Run `pnpm --filter @paperclipai/db typecheck` immediately after resolving foundation conflicts, before tackling server/UI. This surfaces missing types early.
**Warning signs:** TypeScript errors about unknown types in auto-merged schema files.

## Code Examples

### Example 1: DB Meta Conflict Resolution (Trivial)

```bash
# All 3 DB migration meta conflicts use the same strategy
git checkout --ours packages/db/src/migrations/meta/_journal.json
git checkout --ours packages/db/src/migrations/meta/0026_snapshot.json
git checkout --ours packages/db/src/migrations/meta/0027_snapshot.json
git add packages/db/src/migrations/meta/_journal.json \
      packages/db/src/migrations/meta/0026_snapshot.json \
      packages/db/src/migrations/meta/0027_snapshot.json
```

### Example 2: adapter-utils Export Combination

```typescript
// packages/adapter-utils/src/index.ts
// Both sides added exports -- combine all of them
export type {
  // ... existing shared types (both sides agree) ...
  AdapterAgent,
  AdapterRuntime,
  // etc.
} from "./types.js";

export { buildBrowserConfig } from "./types.js";

// Fork additions (context pipeline, token estimation):
// [fork-specific exports here]

// Upstream additions (workspace runtime types):
// [upstream-specific exports here]
```

### Example 3: Lockfile Regeneration

```bash
# MUST be done LAST, after all package.json conflicts are resolved
rm pnpm-lock.yaml
pnpm install
git add pnpm-lock.yaml
```

### Example 4: Full Verification Sequence

```bash
# Step 1: Typecheck all packages
pnpm -r typecheck

# Step 2: Run full test suite (455+ tests including canary tests)
pnpm test:run

# Step 3: Build all packages
pnpm -r build

# Step 4: (Optional) Run migration compat check if DB available
# DATABASE_URL=postgres://... npx tsx scripts/check-migration-compat.ts
```

### Example 5: Rollback If Merge Fails

```bash
# If conflict resolution produces broken code:
git merge --abort  # If merge not yet committed
# OR
git reset --hard pre-upstream-sync  # If merge was committed but broken
```

### Example 6: Post-Merge Tagging

```bash
# After successful merge commit and CI verification:
git tag post-foundation-merge
```

## State of the Art

| Aspect | Current State | Impact |
|--------|---------------|--------|
| Fork divergence | 139 commits ahead, 230 behind upstream | 16 file conflicts across 6 areas |
| Phase 5 deliverables | Conflict map, renumbered migrations (0031-0032), canary tests, smoke tests, migration compat script | All tools ready for merge execution |
| Pre-merge safety | `pre-upstream-sync` tag + `pre-upstream-sync-backup` branch | Clean rollback point exists |
| Migration state | Fork 0000-0030 + upstream renumbered 0031-0032 | Snapshot prevId chain verified continuous |
| Test baseline | 455 tests passing (including 8 canary/smoke from phase 5) | Regression detection ready |
| Conflict difficulty | 6 EASY, 6 MEDIUM, 1 MEDIUM-HARD, 2 HARD, 1 SPECIAL | 2 HARD files (server index.ts + heartbeat.ts) are the main risk |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.5 |
| Config file | `server/vitest.config.ts` (node env), `ui/vitest.config.ts` (jsdom env) |
| Quick run command | `pnpm test:run` |
| Full suite command | `pnpm test:run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MERGE-01 | Shared packages compile post-merge | integration | `pnpm --filter @paperclipai/shared typecheck && pnpm --filter @paperclipai/adapter-utils typecheck` | N/A (built-in) |
| MERGE-01 | DB compiles post-merge | integration | `pnpm --filter @paperclipai/db typecheck` | N/A (built-in) |
| MERGE-01 | Migration set applies cleanly | integration | `DATABASE_URL=... npx tsx scripts/check-migration-compat.ts` | scripts/check-migration-compat.ts |
| MERGE-01 | All fork exports intact | unit | `pnpm test:run -- --grep "v1.0 fork feature"` | server/src/__tests__/v1-feature-exports.test.ts |
| MERGE-01 | All fork API endpoints intact | smoke | `pnpm test:run -- --grep "v1.0 API smoke"` | server/src/__tests__/v1-api-smoke.test.ts |
| MERGE-01 | Full CI suite passes | integration | `pnpm -r typecheck && pnpm test:run && pnpm -r build` | N/A (built-in) |

### Sampling Rate
- **Per task commit:** `pnpm -r typecheck && pnpm test:run`
- **Per wave merge:** `pnpm -r typecheck && pnpm test:run && pnpm -r build`
- **Phase gate:** Full CI suite green + canary tests pass + `post-foundation-merge` tag created

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. Phase 5 created the canary tests, smoke tests, and migration compat script. No new test files needed.

## Open Questions

1. **Phase 7 continuation technique**
   - What we know: All conflicts are resolved in phase 6's single merge commit. Phase 7 does not need to re-merge.
   - What's unclear: Whether phase 7 will find issues in server/UI areas that require fix-forward patches.
   - Recommendation: Phase 7 should perform targeted verification of server and UI functionality. If issues found, create fix-forward commits (not re-merge). The `post-foundation-merge` tag gives a rollback point if fix-forward fails.

2. **Upstream TypeScript additions requiring stub types**
   - What we know: Upstream added new types/services (workspace-runtime, execution-workspace-policy) that auto-merge into the codebase. These may reference each other.
   - What's unclear: Whether all upstream type dependencies are self-contained or if any reference types that don't exist yet.
   - Recommendation: Run `pnpm -r typecheck` early in the process (after foundation conflicts resolved, before server/UI). If type errors appear in auto-merged files, add minimal type stubs or fix imports.

3. **Database availability for migration compat check**
   - What we know: `scripts/check-migration-compat.ts` requires a running PostgreSQL instance with fork migrations applied.
   - What's unclear: Whether a test database is available in the CI/development environment.
   - Recommendation: Run the migration compat script if DATABASE_URL is set. If not, rely on typecheck + snapshot chain verification. The script was designed as an optional safety check.

## Sources

### Primary (HIGH confidence)
- Direct git merge dry-run on repository -- confirmed exactly 16 conflicts (re-verified during this research)
- `.planning/CONFLICT-MAP.md` -- 341 lines of per-file analysis with deep-dive for 2 HARD conflicts
- Phase 5 verification report (`05-VERIFICATION.md`) -- all 4 PREP requirements satisfied, all artifacts verified
- Experimental verification of git merge partial-commit behavior -- confirmed partial resolution is impossible

### Secondary (MEDIUM confidence)
- Phase 5 research (`05-RESEARCH.md`) -- migration renumbering pattern, snapshot chain analysis, feature manifest

### Tertiary (LOW confidence)
- None -- all findings verified against actual codebase state

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already in use, no new dependencies
- Architecture: HIGH -- merge sequence verified against actual git behavior; conflict list confirmed current
- Pitfalls: HIGH -- primary risk (partial merge impossibility) experimentally verified; canary tests provide regression safety net
- Resolution strategies: HIGH -- from phase 5 conflict map, verified against current conflict list

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable -- upstream ref and fork state frozen until merge executes)
