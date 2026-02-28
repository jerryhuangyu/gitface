# ADR-20260228: Add machine-readable JSON output for `gitface remove`

## Context

`gitface rm/remove <profile>` currently emits only human-readable text. This is
usable in terminal workflows, but automation and scripts cannot safely parse the
result because output is free-form and ANSI-styled.

Current pain points:

- CI or bootstrap scripts cannot deterministically read remove success/failure.
- `--force` behavior (missing profile is skipped) cannot be consumed as stable
  structured output.
- Remove flow currently loads the same profile before deletion in command action,
  then validates/deletes again in service, adding unnecessary profile-store I/O.

Baseline measured in this run (2026-02-28 local):

- `pnpm run lint`: pass (`real 0.37s`)
- `pnpm run typecheck`: pass (`real 0.89s`)
- `pnpm run test`: pass (`26 tests`, `real 2.21s`)
- `pnpm run build`: pass (`dist/index.js 63.80 kB`, gzip `14.71 kB`, `real 1.76s`)
- Coverage: statements `68.76%`, branches `47.11%`, functions `77.14%`, lines
  `69.14%`

Repo/CI context note:

- Local commit history and workflow files were reviewed.
- Remote issue/PR/CI run details are not queryable in this sandbox.

## Decision

Add an additive `--json` option to `gitface rm/remove` and refactor remove flow
to return the deleted profile from service in one path.

- New command form:
  - `gitface remove <profile> --json`
  - `gitface rm <profile> --json`
- JSON success output includes deleted profile fields and status.
- JSON failure output includes `status: "error"` and a stable reason string.
- JSON force-missing output includes `status: "skipped"` with `force: true`.
- Default human-readable output remains unchanged when `--json` is absent.

Implementation constraint for MVP:

- Introduce a service API that deletes and returns deleted profile snapshot in
  one operation (`removeProfile`), replacing command-level pre-read + delete.

Proposed JSON success shape:

```json
{
  "status": "removed",
  "name": "work",
  "gitName": "Work User",
  "email": "work@example.com",
  "signingKey": null
}
```

## Alternatives Considered

1. Keep text-only output and ask users to parse logs.
- Pros: zero code change.
- Cons: brittle automation and inconsistent with existing `--json` command
  pattern.

2. Add separate command `gitface remove-json`.
- Pros: explicit API split.
- Cons: larger command surface and weaker discoverability.

3. Add `--json` only, without refactoring remove path.
- Pros: smaller patch.
- Cons: keeps avoidable duplicated profile-store reads.

## Consequences

Positive:

- Enables deterministic automation for delete workflows.
- Preserves backward compatibility for interactive users.
- Simplifies command action by centralizing delete+return in service.

Negative / trade-offs:

- Adds one more JSON output contract to maintain.
- Requires tests for both human and JSON output modes.

Risks:

- Consumers may rely on JSON field names; contract becomes public surface.

Migration / rollback:

- Migration: none (additive option).
- Rollback: revert this change set; existing text mode remains intact.

## Rollout Plan

1. Add `--json` option to remove command.
2. Add service method to remove and return profile in one path.
3. Implement remove UI JSON renderers for success/skipped/error.
4. Add e2e tests for `remove --json` success and failure.
5. Update README and `docs/cli.md` command docs.
6. Validate with lint/typecheck/test/build quality gates.

Feature flag / config:

- Not required; change is additive and low risk.

## Test Plan

- E2E:
  - `gitface remove <name> --json` returns parseable success JSON and profile is
    deleted.
  - `gitface remove <missing> --json` sets exit code `1` and returns parseable
    error JSON.
- Regression:
  - Existing human-mode remove test remains passing.
- Quality gates:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

Current project has no external telemetry backend. Use these indicators:

- exit code trend for `remove --json` in scripts
- e2e pass/fail trend for remove command output modes
- parsing failures in downstream automation (expected to decrease)

## Security / Privacy

- No new network calls or permission surface.
- Output includes profile fields already visible in existing human-mode success
  output.
- No additional secret collection.

## Open Questions

- Should `clone`, `rename`, and `edit` also expose `--json` for output
  consistency across all mutating commands?
- Should GitFace publish a versioned JSON schema for command outputs?
