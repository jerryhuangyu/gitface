# ADR-20260228: Add safe preview mode for `gitface import` (`--dry-run`)

## Context

`gitface import <file>` currently writes profiles immediately after parsing the
JSON file. This is efficient for happy paths, but risky for bulk migration and
automation because users cannot verify impact before mutation.

Current pain points:

- No preflight mode to validate import payloads without changing local profile
  storage.
- Operators cannot safely answer "what would change?" before running import.
- Existing output is human-readable only, making dry-run style checks impossible
  in CI guardrails.

Baseline measured in this run (2026-02-28 local):

- `pnpm run lint`: pass (0s)
- `pnpm run typecheck`: pass (1s)
- `pnpm run test`: pass (`23 tests`, duration ~2s)
- `pnpm run build`: pass (`dist/index.js 61.50 kB`, gzip `14.23 kB`)
- Coverage baseline: statements `67.04%`, branches `44.63%`, functions `75%`,
  lines `67.4%`

## Decision

Add an additive `--dry-run` option to `gitface import`.

- New command form: `gitface import <file> --dry-run`
- Behavior:
  - Parse and validate import payload exactly as normal import.
  - Evaluate overwrite and duplicate rules exactly as normal import.
  - Do **not** persist any profile changes.
  - Emit a clear summary that this was a preview.
- Existing `gitface import <file>` behavior remains unchanged.

Implementation detail:

- Refactor import action to share one import evaluation path for both normal and
  dry-run modes.
- Keep current warning/error reporting style for consistency.

## Alternatives Considered

1. Add a separate command (`gitface import-preview`).
- Pros: explicit separation.
- Cons: extra command surface and duplicated logic.

2. Keep current behavior and ask users to manually back up before import.
- Pros: zero code change.
- Cons: poor UX and higher accidental mutation risk.

3. Add interactive confirmation prompt before every import.
- Pros: safer for humans.
- Cons: weak for CI/non-interactive usage, does not expose full impact summary.

## Consequences

Positive:

- Safer bulk operations and onboarding migrations.
- Better automation ergonomics via deterministic preflight mode.
- Backward compatible; existing workflows continue to work.

Negative / trade-offs:

- Slightly more branching logic in import command.
- Need to maintain parity between dry-run and real import validation behavior.

Risks:

- Divergence between preview and real import behavior if logic drifts.

Migration / rollback:

- Migration: none required.
- Rollback: remove `--dry-run` option and associated action branch.

## Rollout Plan

1. Add `--dry-run` option to import command.
2. Refactor import action to produce unified per-entry outcome results.
3. Ensure dry-run path performs validation without persistence.
4. Add e2e coverage proving no writes in dry-run mode.
5. Update README and `docs/cli.md` docs.
6. Run lint/typecheck/test/build.

Feature flag / config:

- Not required; change is additive and low risk.

## Test Plan

- E2E:
  - Add coverage for `gitface import --dry-run` with mixed valid/duplicate
    entries.
  - Assert summary output indicates preview and that no profiles are created.
- Regression:
  - Keep existing export/import happy-path test.
- Quality gates:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

Current project has no external telemetry backend. Track with:

- command exit codes in CI scripts using `--dry-run`
- e2e stability for import command
- user-reported accidental mutation incidents (expected to decrease)

## Security / Privacy

- No new network access.
- No additional data exposure beyond existing import payload handling.
- Dry-run reduces operational risk by avoiding unintended writes.

## Open Questions

- Should `gitface import` also support a machine-readable `--json` report for
  automated preflight pipelines?
