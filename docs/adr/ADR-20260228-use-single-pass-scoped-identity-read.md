# ADR-20260228: Align `use` scoped identity planning with single-pass reads

## Context

- GitFace already introduced single-pass scoped identity reads in `GitService.getScopedIdentity(scope)` (one `git config --list` call + per-key fallback).
- `gitface current --scope` uses this path, but `gitface use` dry-run/no-op planning still called `git config --get` for each key (`user.name`, `user.email`, `user.signingkey`) via a local helper.
- This creates avoidable process overhead and inconsistent behavior between `current` and `use`.
- Baseline on this repo before change:
  - `pnpm -s lint`: pass (~1s wall time)
  - `pnpm -s test`: pass (16 files / 72 tests, ~3s wall time)
  - `pnpm -s build`: pass (~1s wall time)
  - coverage lines: `78.84%`

## Decision

- Refactor `src/commands/use/action.tsx` to call `ProfileService.getScopedIdentity(scope)` directly during planning.
- Remove duplicate local scoped-read helper from `use` action.
- Add a focused unit test to guarantee `runUseAction` uses `ProfileService.getScopedIdentity()` for dry-run planning.
- Update CLI docs to state that `use` planning follows single-pass scoped reads with fallback.

## Alternatives Considered

1. Keep current behavior (3 per-key `git config --get` calls in `use`).
   - Rejected: keeps extra process cost and diverges from existing architecture.
2. Re-implement single-pass logic inside `use` action.
   - Rejected: duplicates infrastructure logic and increases maintenance risk.
3. Introduce caching at command level for each `use` invocation.
   - Rejected for MVP: extra state complexity; unnecessary when service method already provides an efficient path.

## Consequences

### Positive

- Fewer subprocess calls in normal path for `use` planning.
- Consistent scoped identity semantics across commands.
- Lower maintenance cost by centralizing scope-read behavior in `GitService`.

### Negative / Risks

- `use` planning now depends on `ProfileService.getScopedIdentity` contract.
- Potential regression risk if service method changes shape in future.

### Migration / Rollback

- No data migration needed.
- Rollback is low-risk: restore removed helper and previous call site in `use` action.

## Rollout Plan

1. Add unit test that verifies `runUseAction` uses `ProfileService.getScopedIdentity`.
2. Switch `use` action to service-based scoped read.
3. Update CLI reference docs.
4. Run lint/test/build gates.
5. If issues appear, revert `use` action call-site change only.

## Test Plan

- Unit:
  - New test `tests/use.action.test.ts` asserts `runUseAction(..., { dryRun: true, json: true })` calls `ProfileService.getScopedIdentity("global")` exactly once.
- Regression:
  - Existing `tests/use.e2e.test.ts` dry-run and unchanged scenarios.
  - Existing `tests/git-service.test.ts` single-pass + fallback behavior.
- CI gates:
  - `pnpm -s lint`
  - `pnpm -s test`
  - `pnpm -s build`

## Observability

- Reuse existing structured logs from `profile-service:getScopedIdentity` and `git-service:getScopedIdentity`.
- Watch for:
  - error/warn spikes around scoped reads,
  - dry-run latency for `gitface use --dry-run` in local manual benchmarks.

## Security / Privacy

- No new permissions or data sinks.
- No token/PII surface changes; identity reads remain local git config access.

## Open Questions

- Should we add an explicit command-level latency benchmark harness for key CLI flows (`use`, `current`, `doctor`) in CI?
