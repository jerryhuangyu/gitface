# ADR-20260227: Add machine-readable JSON output for `gitface import`

## Context

`gitface import <file>` currently supports human-readable output and `--dry-run`,
but automation still cannot reliably consume import outcomes because warnings and
summaries are plain text.

Current pain points:

- CI scripts cannot deterministically know which profiles were imported,
  skipped, or failed.
- Dry-run preflight (`--dry-run`) cannot be consumed as structured artifacts.
- Core read/apply flows already expose JSON modes (`list`, `rules list`,
  `current`, `doctor`, `use`), but `import` is a key gap in end-to-end
  automation.

Baseline measured in this run (2026-02-27 UTC):

- `pnpm run lint`: pass (`0s` command elapsed)
- `pnpm run typecheck`: pass (`1s` command elapsed)
- `pnpm run test`: pass (`24 tests`, command elapsed `2s`)
- `pnpm run build`: pass (`dist/index.js 62.91 kB`, gzip `14.52 kB`, command elapsed `2s`)
- Coverage: statements `68.71%`, branches `46.8%`, functions `76.81%`, lines
  `69.1%`

Repo/CI context note:

- Local git history and workflow files were reviewed.
- Remote issue/PR/run state is not queryable from this sandboxed environment.

## Decision

Add an additive `--json` option to `gitface import` for both normal and dry-run
modes.

- New command forms:
  - `gitface import <file> --json`
  - `gitface import <file> --dry-run --json`
- Keep existing default text output unchanged when `--json` is absent.
- Produce stable JSON object with aggregate counts and per-entry outcomes.

Proposed JSON shape:

```json
{
  "dryRun": true,
  "total": 2,
  "imported": 1,
  "failed": 1,
  "results": [
    {
      "name": "work",
      "status": "failed",
      "message": "Profile already exists. Use --overwrite to replace."
    },
    {
      "name": "personal",
      "status": "imported",
      "message": "Validated for import."
    }
  ]
}
```

Status values are constrained to `imported` or `failed` to keep MVP scope tight
and compatible with current import semantics.

## Alternatives Considered

1. Add a separate command (`gitface import-json`).
- Pros: explicit split.
- Cons: command-surface growth and inconsistent with existing `--json` pattern.

2. Replace default output with JSON always.
- Pros: single output mode.
- Cons: breaks current UX and backward compatibility.

3. Keep text-only output and ask users to parse logs.
- Pros: no implementation cost.
- Cons: brittle automation and poor observability.

## Consequences

Positive:

- Enables deterministic CI and scripting around imports.
- Makes dry-run outcomes auditable and storable.
- Aligns import command with existing JSON-capable command family.

Negative / trade-offs:

- Adds one more JSON contract to maintain.
- Introduces small refactor in import action to keep text/JSON parity.

Risks:

- Contract drift if text and JSON paths diverge in future changes.

Migration / rollback:

- Migration: none required (additive option).
- Rollback: revert this change set; existing text mode remains.

## Rollout Plan

1. Add `--json` option to import command.
2. Refactor import flow to produce one canonical result model.
3. Render result model as either text (existing behavior) or JSON.
4. Add e2e coverage for `import --json` and `import --dry-run --json`.
5. Update README and `docs/cli.md`.
6. Validate with lint/typecheck/test/build.

Feature flag / config:

- Not required; change is additive and low risk.

## Test Plan

- E2E:
  - `gitface import <file> --json` returns parseable JSON with expected counts.
  - `gitface import <file> --dry-run --json` validates without mutating profile
    store and returns structured outcomes.
- Regression:
  - Existing text-mode export/import and dry-run tests remain passing.
- Quality gates:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

Current project has no external telemetry backend. Use these indicators:

- CLI exit code for `import --json` runs
- e2e pass/fail trend for import modes
- script/CI parsing failures (expected to decrease)

## Security / Privacy

- No new network access.
- Output includes profile identity data already provided in existing import
  input/output flows.
- No additional persistence beyond current profile store writes (and none in
  dry-run mode).

## Open Questions

- Should a future revision introduce a `warnings` state separate from `failed`
  for duplicate-without-overwrite outcomes?
- Should all write commands (`new`, `edit`, `clone`, `rename`, `remove`) expose
  a consistent JSON result envelope?
