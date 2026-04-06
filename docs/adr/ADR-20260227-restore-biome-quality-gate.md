# ADR-20260227: Restore Biome quality gate to keep CI releasable

## Context

GitFace CI requires Biome quality checks before running tests in pull requests.
Current baseline (2026-02-27 UTC) shows:

- `pnpm run typecheck`: pass (`1.758s`)
- `pnpm run test`: pass (`18/18`, total `2.047s`)
- `pnpm run build`: pass (`1.920s`, bundle `59.47 kB`)
- `pnpm run lint`: fail (`13 errors`, `2 warnings`, `0.337s`)

The lint failure blocks the `quality` job, which also blocks the full
`test-and-coverage` CI workflow. This creates operational pain:

- Contributors cannot rely on PR checks to merge safely.
- Real regressions can be hidden behind persistent formatting/lint noise.
- Team velocity drops because every branch inherits a red baseline.

## Decision

Adopt a narrow MVP to restore the Biome gate to green immediately:

- Fix all current Biome violations surfaced in the baseline run.
- Replace `any`-based git error inspection with type-safe error narrowing in
  `GitService`.
- Keep behavior unchanged (no CLI contract changes), focusing only on
  maintainability and CI reliability.
- Validate with `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, and
  `pnpm run build`.

## Alternatives Considered

1. Relax CI by making `quality` non-blocking.
- Pros: fastest temporary unblock.
- Cons: allows style/type hygiene to degrade and increases long-term cost.

2. Auto-fix formatting only and ignore semantic lint warnings.
- Pros: smaller patch.
- Cons: keeps `noExplicitAny` and related correctness warnings unresolved.

3. Large-scale lint cleanup across all files and rules.
- Pros: strongest long-term baseline.
- Cons: wider risk/scope than this round's MVP and harder to review/rollback.

## Consequences

Positive:

- CI quality gate becomes reliable again.
- PR feedback signal improves because lint output is actionable.
- Removes unsafe `any` usage in git error-path handling.

Negative:

- Touches multiple files for formatting/import ordering.
- Adds small helper logic for error narrowing that must be maintained.

Risks:

- Behavior regression in `unsetConfig` if error-code parsing is incorrect.

Migration / rollback:

- Migration cost is low (no user-facing config change).
- Rollback is straightforward by reverting this patch set.

## Rollout Plan

1. Land formatting/import-order updates and type-safe error handling.
2. Run local quality/test/build validation.
3. Merge once checks are green.
4. If regression appears, rollback by reverting this ADR patch commit.

No feature flag is needed because behavior should remain equivalent.

## Test Plan

- Unit/regression:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`
- Coverage sanity:
  - Confirm no test-count regression from baseline (`18 tests`).
- Manual behavior check:
  - Confirm rule command and CLI startup still execute in existing e2e tests.

## Observability

Track these indicators in CI and local runs:

- Biome status (`pass/fail`, error count)
- Pipeline progression from `quality` to `test-and-coverage`
- Any increase in git-config related runtime errors logged by `git-service`

## Security / Privacy

- No new external dependencies.
- No new data collection or network access.
- Type-safety improvement reduces risk of hidden error-path bugs.

## Open Questions

- Should we add a pre-commit hook (Biome + typecheck) to prevent red baseline
  drift?
- Should we add a CI metric trend (lint count over time) for hygiene visibility?
