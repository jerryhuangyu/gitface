# ADR-20260228: Add machine-readable JSON output for `gitface doctor`

## Context

`gitface doctor` currently emits only human-friendly text with icons and ANSI
styles. This is good for terminal users but hard to consume in scripts and CI.

Current pain points:

- Automation cannot reliably parse doctor status without brittle text matching.
- Command output consistency is incomplete: `list`, `rules list`, and `current`
  already support `--json`, but `doctor` does not.
- Operations teams cannot easily persist doctor diagnostics as structured
  artifacts.

Baseline measured in this run (2026-02-28 local):

- `pnpm run lint`: pass
- `pnpm run typecheck`: pass
- `pnpm run test`: pass (`21 tests`)
- `pnpm run build`: pass (`dist/index.js 60.38 kB`, gzip `14.02 kB`)
- Coverage baseline: statements `67.08%`, branches `43.7%`, functions `75%`,
  lines `67.42%`

Repo/CI context note:

- Local git history and workflow files were reviewed.
- Remote issue/PR/CI lists were not queryable in this environment (`gh` is not
  installed).

## Decision

Add an additive `--json` option to `gitface doctor`.

- New command form: `gitface doctor --json`
- Output shape:
  ```json
  {
    "checks": [
      { "status": "pass|warn|fail", "message": "..." }
    ],
    "hasFailures": false
  }
  ```
- Keep existing human-readable output as the default when `--json` is absent.
- Keep existing exit behavior: `process.exitCode = 1` when any check fails.

Implementation includes a small internal refactor: separate diagnosis execution
from presentation so both text and JSON output share one result model.

## Alternatives Considered

1. Add a separate command `gitface doctor-json`.
- Pros: explicit command split.
- Cons: larger command surface and weaker discoverability than a format flag.

2. Replace default doctor output with JSON.
- Pros: one canonical format.
- Cons: worsens interactive UX and breaks current user expectations.

3. Keep text-only output and advise users to parse strings.
- Pros: no implementation effort.
- Cons: fragile parsing, inconsistent API, poor automation ergonomics.

## Consequences

Positive:

- Makes diagnostics scriptable for CI and local automation.
- Aligns output contract pattern across core read/report commands.
- Maintains backward compatibility for existing users.

Negative / trade-offs:

- Adds one more stable JSON contract to maintain.
- Requires regression tests for both output modes.

Risks:

- Downstream automation may couple to exact field names.

Migration / rollback:

- Migration: none required.
- Rollback: revert this change set; text mode remains intact.

## Rollout Plan

1. Add `--json` flag to `doctor` command.
2. Refactor doctor action to produce one structured result object.
3. Implement JSON renderer for doctor results.
4. Add e2e coverage for JSON output shape and exit behavior.
5. Update README and `docs/cli.md`.
6. Run lint/typecheck/test/build before merge.

Feature flag / config:

- Not required; change is additive and low risk.

## Test Plan

- E2E:
  - Add test for `gitface doctor --json` asserting JSON parseability and fields.
- Regression:
  - Keep existing human-mode doctor test.
- Quality gates:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

Current project has no runtime telemetry backend; use these indicators:

- exit code trend for `gitface doctor --json`
- e2e pass/fail trend for doctor command
- user-reported parsing errors in automation scripts

## Security / Privacy

- No new network calls or external persistence.
- Output includes only already-readable local environment diagnostics.
- No token/PII expansion beyond current doctor messages.

## Open Questions

- Should JSON command outputs share a documented schema-version field?
- Should `doctor` checks include machine-readable `code` fields in a follow-up?
