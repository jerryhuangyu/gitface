# ADR-20260228: Add machine-readable JSON output for `gitface use`

## Context

`gitface use <profile>` currently prints only human-readable success/failure text.
This works well for interactive usage, but automation scripts cannot reliably parse
whether a profile was applied, which scope was used, and which identity values
were written to Git config.

Current baseline (before this ADR implementation):

- Quality gates are green (`pnpm run lint`, `pnpm run typecheck`,
  `pnpm run test`, `pnpm run build`).
- Test suite: 22 tests passing.
- Build artifact: `dist/index.js` about 60.77 kB (gzip about 14.09 kB).

GitFace already added `--json` support for `list`, `rules list`, `current`, and
`doctor`, so `use` is now the most important remaining command in the core flow
without a first-class machine-readable output mode.

## Decision

Add an additive `--json` option to `gitface use`.

- Default behavior remains unchanged: existing human-readable output is still the
  default when `--json` is not provided.
- With `--json`, command prints a stable JSON object with the applied profile
  data and selected scope.
- Keep existing exit-code behavior:
  - success -> exit code `0`
  - validation/runtime failure -> exit code `1`
- Keep MVP scope narrow:
  - support non-interactive `gitface use <profile> --json`
  - no interactive picker output changes in this round

Proposed JSON shape:

```json
{
  "name": "work",
  "gitName": "Work User",
  "email": "work@example.com",
  "signingKey": "WORKKEY",
  "scope": "local"
}
```

When `signingKey` is not set, return `null`.

## Alternatives Considered

1. Keep text-only output and ask scripts to parse logs.
- Pros: zero implementation effort.
- Cons: brittle parsing; locale/style changes break automation; inconsistent with
  other commands that already support `--json`.

2. Add a dedicated `gitface use:json` subcommand.
- Pros: explicit command surface.
- Cons: API sprawl and inconsistent CLI design vs existing `--json` pattern.

3. Emit both text and JSON simultaneously in default mode.
- Pros: no new flag required.
- Cons: breaks backward compatibility for humans and existing parsers expecting
  plain text output.

## Consequences

Positive:

- Improves automation ergonomics for the most common command in the workflow.
- Aligns `use` behavior with existing machine-readable command family.
- Backward-compatible for current interactive users.

Negative / Risks:

- Small bundle increase due to new rendering function and option wiring.
- Risk of JSON contract drift if field names change later.

Migration and maintenance:

- No migration needed for existing users.
- Need to document JSON shape in README/CLI docs and keep tests guarding output.

## Rollout Plan

1. Introduce `--json` option on `gitface use` while preserving default text mode.
2. Add/extend e2e tests for JSON mode.
3. Update docs (`README.md`, `docs/cli.md`).
4. Run full quality gates locally.
5. Rollback strategy: revert the implementation commit; text mode remains intact.

## Test Plan

- Unit/command-level: option wiring for `--json` path.
- Integration/e2e:
  - `gitface use <profile> --json` returns valid JSON and applies Git config.
  - Existing text mode behavior still works.
  - Failure path keeps non-zero exit code.
- Regression: run full suite (`pnpm run test`) plus lint/typecheck/build.

## Observability

- Reuse existing command logger (`command:use`) to trace start/completion/failure.
- Monitor:
  - command success/failure rate (via exit codes in automation scripts)
  - parse errors in downstream consumers (indirect signal from CI failures)

## Security/Privacy

- No new network or permission surface.
- JSON output contains identity fields already shown in existing text output.
- Continue to avoid printing secrets beyond configured Git identity values.

## Open Questions

- Should future rounds add structured JSON errors for all command failures to
  improve machine handling further?
- Should interactive mode eventually support `--json` in a non-TTY fallback path?
