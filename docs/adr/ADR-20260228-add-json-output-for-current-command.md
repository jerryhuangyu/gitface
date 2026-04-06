# ADR-20260228: Add machine-readable JSON output for `gitface current`

## Context

`gitface current` currently prints a human-friendly, colorized summary only. This
is useful interactively, but automation users cannot reliably parse it due to
ANSI styling and free-form text.

Current pain points:

- Shell scripts cannot safely read active identity fields without brittle text
  parsing.
- Output format parity is inconsistent: `gitface list --json` and
  `gitface rules list --json` already exist, while `current` does not.
- Operational checks (pre-commit/pre-push identity guards) require machine
  output.

Baseline measured in this run (2026-02-28 local time):

- `pnpm run lint`: pass
- `pnpm run typecheck`: pass
- `pnpm run test`: pass (`20 tests`)
- `pnpm run build`: pass (`dist/index.js 60.03 kB`, gzip `13.95 kB`)

Repo/CI context note:

- Local Git history and workflow files were reviewed.
- `gh` CLI is unavailable in this environment, so remote issue/PR/run lists
  were not queryable from this run.

## Decision

Add an additive `--json` option to `gitface current`.

- New command form: `gitface current --json`
- Output shape:
  `{ "gitName": "...", "email": "...", "signingKey": "..." | null }`
- Keep existing colorized output as default when `--json` is absent.
- Keep command semantics and exit behavior unchanged.

This is a backward-compatible MVP that makes identity inspection scriptable.

## Alternatives Considered

1. Introduce a separate command `gitface current-json`.
- Pros: explicit API separation.
- Cons: command-surface growth and weaker discoverability than a format flag.

2. Change `gitface current` to always return JSON.
- Pros: single stable machine format.
- Cons: breaks current interactive UX and user expectations.

3. Require users to call `git config user.*` directly.
- Pros: no GitFace changes.
- Cons: loses GitFace abstraction consistency and requires multiple calls.

## Consequences

Positive:

- Enables robust scripting and CI checks for active Git identity.
- Aligns output contract pattern across `list`, `rules list`, and `current`.
- No migration required for current interactive users.

Negative / trade-offs:

- Adds one more CLI output contract to maintain.
- Requires tests for both JSON and human output paths.

Risks:

- Downstream scripts may rely on field names; these become part of the public
  contract.

Migration / rollback:

- Migration: none.
- Rollback: revert this ADR patch; default text output remains.

## Rollout Plan

1. Add `--json` flag to `current` command.
2. Branch `current` action to JSON vs existing UI rendering.
3. Add e2e coverage for JSON output parse/shape.
4. Update README and CLI docs.
5. Validate with lint/typecheck/test/build.

Feature flag / config:

- Not required; change is additive and low risk.

## Test Plan

- E2E:
  - Add test for `gitface current --json` asserting parseable JSON shape and
    field values.
- Regression:
  - Keep existing `gitface current` text-output e2e behavior.
- Quality gates:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

Current repo has no runtime telemetry backend; use these proxies:

- command exit code of `gitface current --json`
- e2e pass/fail trend for current command output modes
- user-reported parsing errors in automation scripts

## Security / Privacy

- No new network calls or external persistence.
- Output only includes identity values already accessible via local Git config.
- No additional sensitive data collection.

## Open Questions

- Should `doctor` also gain `--json` to complete machine-output coverage for
  diagnostics?
- Should we publish a lightweight schema note for all JSON command outputs?
