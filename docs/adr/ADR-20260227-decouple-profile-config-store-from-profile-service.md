# ADR-20260227: Decouple profile config file management from ProfileService

## Context

GitFace persists profile JSON records in `~/.config/gitface/profiles/*.json` and also writes Git include-compatible identity files in `~/.config/gitface/identities/*.gitconfig`.

Current `ProfileService` owns both domain orchestration and direct filesystem writes for identity config files. This creates two concrete pains:

- Reliability issue in tests and sandboxed runs: unit tests that use an in-memory `ProfileStore` still fail because `ProfileService` writes identity files into the real OS config directory.
- Architectural coupling: profile business logic cannot be tested in isolation because side effects are hard-coded in `ProfileService`.

Measured baseline (this run, 2026-02-27):

- `pnpm lint`: failed (existing repo-wide lint/format issues).
- `pnpm test`: failed with 5 failures in `tests/index.test.ts` due to `EPERM` writing `~/.config/gitface/identities/*.gitconfig`.
- `pnpm build`: build artifacts are produced successfully, but command wrapper timing in sandbox reports a non-zero status.

## Decision

Introduce a dedicated `ProfileConfigStore` abstraction and inject it into `ProfileService`.

- Add `ProfileConfigStore` interface for:
  - resolving profile config path
  - saving identity config
  - removing identity config
- Add `FileProfileConfigStore` default implementation that keeps current behavior and paths.
- Update `ProfileService` constructor to accept `ProfileConfigStore` as a third dependency.
- Keep `ProfileService.create()` backward-compatible by wiring default `FileProfileStore + GitService + FileProfileConfigStore`.
- Update unit tests to pass a no-op/in-memory config store so business logic tests do not write to user directories.

This preserves user-facing behavior while isolating filesystem side effects behind an interface.

## Alternatives Considered

1. Keep current design and patch tests by mocking `osPaths`/`fs` globally.
- Pros: smallest code changes.
- Cons: brittle and leaks implementation details into tests; does not solve architecture coupling.

2. Add env var override only (for identities path) and set it in tests.
- Pros: moderate changes; easy migration.
- Cons: still couples `ProfileService` to filesystem concerns and external env; weaker domain isolation.

3. Move identity file writes into `FileProfileStore`.
- Pros: fewer dependencies in `ProfileService`.
- Cons: mixes two persistence concerns (profile JSON vs git include config), making store responsibilities unclear.

## Consequences

Positive:

- Unit tests become deterministic and sandbox-safe.
- `ProfileService` becomes easier to test and refactor.
- Clear boundary for future storage strategies (remote sync, encrypted store, dry-run mode).

Negative / trade-offs:

- Additional abstraction and constructor parameter increase code surface.
- Need to update call sites/tests that instantiate `ProfileService` directly.

Risks:

- Path behavior regressions if `FileProfileConfigStore` differs from previous path logic.
- `RuleService` relies on profile config paths; integration points must stay aligned.

Migration cost:

- Low; default factory preserves current runtime behavior.

Rollback difficulty:

- Low; can revert to previous `ProfileService` internal fs logic in one change set.

## Rollout Plan

1. Add new abstraction and default implementation behind existing behavior.
2. Wire `ProfileService.create()` to new default implementation.
3. Update unit tests to use no-op/recording config store.
4. Verify with existing command/e2e tests and build.
5. If regressions occur, rollback by restoring inline fs logic in `ProfileService` while keeping interface files for staged adoption.

Feature flag/config:

- Not required for MVP because behavior is unchanged for production users.

## Test Plan

- Unit:
  - `ProfileService` tests with in-memory `ProfileStore` + no-op config store (no disk writes).
  - Add assertion test that config store save/remove is called for create/update/clone/rename/delete flows.
- Integration/E2E:
  - Existing CLI e2e tests continue to run with real `FileProfileConfigStore` and temp config root via `XDG_CONFIG_HOME`.
- Regression:
  - `pnpm test`, `pnpm build`, and spot-check rule command path behavior.

## Observability

- Add/keep structured logs for config store actions:
  - save config (profile name + file path)
  - remove config (profile name + file path)
- Key signals:
  - test pass rate for `tests/index.test.ts`
  - runtime errors around identity file write/remove

## Security / Privacy

- No new external I/O or permissions.
- Identity content remains local filesystem only.
- Keeps least-privilege path by supporting controlled/no-op implementations in restricted runtimes.

## Open Questions

- Should we add a user-facing flag/env to redirect identity config directory explicitly?
- Should profile JSON and identity files eventually share a unified storage root abstraction?
