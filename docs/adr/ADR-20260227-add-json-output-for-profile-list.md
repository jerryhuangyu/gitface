# ADR-20260227: Add machine-readable JSON output for `gitface list`

## Context

`gitface list` currently renders an Ink table designed for humans. This is good
for interactive use, but automation users cannot safely parse it because output
includes ANSI color and box-drawing characters.

Operational pain:

- CI/bootstrap scripts cannot consume profile inventory directly.
- Users must read profile JSON files from disk manually for audits.
- Output format consistency is uneven: `gitface rules list` already supports
  `--json`, while `gitface list` does not.

Baseline measured on 2026-02-27:

- `pnpm run lint`: pass (`real 0.25s`)
- `pnpm run typecheck`: pass (`real 0.72s`)
- `pnpm run test`: pass (`19 tests`, duration `1.12s`, command `real 1.54s`)
- `pnpm run build`: pass (`59.76 kB` bundle, command `real 0.89s`)

## Decision

Add an additive `--json` option to `gitface list`:

- New command form: `gitface list --json`
- Output: stable JSON array of profile records, sorted by `updatedAt` descending
  for recency-first scripting:
  `[{ name, gitName, email, signingKey, createdAt, updatedAt }]`
- Keep current Ink table output as default when `--json` is not provided.
- Empty state in JSON mode returns `[]`.

This preserves backward compatibility while making profile listing scriptable.

## Alternatives Considered

1. Add a separate command `gitface profiles export`.
- Pros: explicit API boundary.
- Cons: command-surface growth and discoverability overhead for a simple list
  format toggle.

2. Always output JSON from `gitface list`.
- Pros: simpler implementation and parser-friendly.
- Cons: breaks current terminal UX and existing user expectations.

3. Ask users to parse profile files in `~/.config/gitface/profiles`.
- Pros: no code changes.
- Cons: pushes storage-layout coupling to users and blocks portable scripts.

## Consequences

Positive:

- Enables reliable automation with `jq`/CI pipelines.
- Aligns UX pattern with `rules list --json`.
- No migration required for existing interactive users.

Negative / trade-offs:

- Adds one more CLI option and output contract to maintain.
- Requires tests for both human and JSON paths.

Risks:

- Downstream scripts may rely on sort order; this ADR fixes explicit recency
  order to avoid accidental drift.

Migration / rollback:

- Migration: none.
- Rollback: revert this patch set; default table output remains available.

## Rollout Plan

1. Add `--json` flag to `list` command.
2. Branch list action into JSON output vs existing Ink UI.
3. Add e2e coverage for JSON output parse and ordering.
4. Update README and CLI docs.
5. Validate with lint/typecheck/test/build quality gates.

Feature flag:

- Not required; change is additive and low risk.

## Test Plan

- E2E:
  - Add test that creates profiles and verifies `gitface list --json` emits
    parseable JSON with expected fields and recency order.
- Regression:
  - Keep existing list UI test to ensure table output remains intact.
- Quality gates:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

Project has no production telemetry pipeline today; use these proxies:

- command exit code for `gitface list --json`
- e2e pass/fail trend for list command behavior
- issue volume related to profile export/list scripting

## Security / Privacy

- No new network calls.
- Output only includes profile data already stored locally by user action.
- No additional sensitive data collection or persistence.

## Open Questions

- Should `gitface current` also support `--json` for machine-readable parity?
- Should we publish a JSON schema version for CLI automation consumers?
