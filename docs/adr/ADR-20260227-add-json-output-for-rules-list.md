# ADR-20260227: Add machine-readable JSON output for `gitface rules list`

## Context

`gitface rules list` currently prints only colorized human-readable text. This
works for interactive use, but blocks automation use cases such as:

- validating include rules in CI scripts
- piping into `jq` for audits
- comparing rule states before/after maintenance tasks

Baseline on 2026-02-27 (UTC):

- `pnpm run lint`: pass
- `pnpm run typecheck`: pass
- `pnpm run test`: pass (18 tests)
- `pnpm run build`: pass
- Current command output for rules is not machine-parseable.

## Decision

Add a `--json` option to `gitface rules list` that emits a stable JSON array:

- Command: `gitface rules list --json`
- Output shape: `[{ "directory": "...", "profileName": "..." }]`
- Keep existing default output unchanged for human users.
- Return `[]` when no rules exist (instead of textual empty-state copy).

This is a backward-compatible MVP that adds scriptability without changing
current interactive behavior.

## Alternatives Considered

1. Add a separate subcommand `gitface rules list-json`.
- Pros: explicit command split.
- Cons: unnecessary command surface growth and discoverability overhead.

2. Replace default output with JSON always.
- Pros: single format and simpler implementation.
- Cons: degrades UX for humans and breaks existing expectations.

3. Add table output first and postpone JSON.
- Pros: potentially nicer readability for humans.
- Cons: still does not solve automation/API use cases.

## Consequences

Positive:

- Enables scripts and CI checks to consume folder-rule state reliably.
- Reduces ad-hoc parsing of ANSI output.
- Minimal scope and low regression risk.

Negative / trade-offs:

- Slightly larger CLI option surface.
- Need to preserve output contract for both human and JSON modes.

Risks:

- Consumers may assume ordering; implementation should keep service order stable.

Migration / rollback:

- No migration needed.
- Rollback is simple by reverting this change set.

## Rollout Plan

1. Add `--json` flag on `rules list`.
2. Implement branching output logic in list action.
3. Add e2e coverage for JSON output.
4. Update README + CLI docs.
5. Run lint/typecheck/test/build and merge.

Feature flag / config:

- Not required; this is additive and backward compatible.

## Test Plan

- E2E:
  - Add a test that creates a profile + rule, runs `rules list --json`, and
    asserts parseable JSON with expected directory/profile.
- Regression:
  - Re-run existing rules add/remove e2e flow.
- Quality gates:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

Key indicators:

- command success/failure rate for `rules list --json`
- parsing failures in downstream scripts (should drop vs ANSI parsing)
- support requests related to rule export visibility

Current repo does not include production telemetry; for now use command exit code
and test coverage as observability proxies.

## Security / Privacy

- No new external network calls.
- No additional data collection; JSON output only exposes existing local config
  mappings already visible via Git configuration.
- Maintains local-first data handling.

## Open Questions

- Should profile list command also gain `--json` for output consistency?
- Should future JSON outputs include schema versioning for long-term contracts?
