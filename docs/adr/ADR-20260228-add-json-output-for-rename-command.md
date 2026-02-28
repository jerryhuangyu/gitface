# ADR-20260228: Add machine-readable JSON output for `gitface rename`

## Context

`gitface rename <old> <new>` currently emits only human-readable output. This
works for interactive usage, but automation cannot parse rename outcomes safely.

Current pain points:

- Rename success/failure cannot be consumed as stable structured output in CI or
  scripts.
- Existing JSON support already covers multiple commands (`list`, `use`,
  `current`, `doctor`, `import`, `remove`, `rules list`), so rename is now a
  parity gap in mutating workflows.
- Rename failure paths currently rely on generic error output only; automation
  cannot distinguish profile-not-found and target-already-exists outcomes by a
  stable shape.

Baseline measured in this run (2026-02-28 local):

- `pnpm run lint`: pass (`real 0.35s`)
- `pnpm run typecheck`: pass (`real 0.73s`)
- `pnpm run test`: pass (`29 tests`, `real 1.71s`)
- `pnpm run build`: pass (`dist/index.js 64.70 kB`, gzip `14.84 kB`, `real 0.87s`)
- Coverage: statements `69.28%`, branches `47.62%`, functions `77.1%`, lines
  `69.66%`

Repo/CI context note:

- Local workflows and recent commits were reviewed.
- Remote issue/PR/CI run statuses are not queryable in this sandbox.

## Decision

Add an additive `--json` option to `gitface rename`/`gitface mv` that emits
stable machine-readable success and failure payloads.

- New command form:
  - `gitface rename <old-name> <new-name> --json`
  - `gitface mv <old-name> <new-name> --json`
- JSON success output includes status and resulting profile fields.
- JSON failure output includes `status: "error"`, input names, and reason.
- Default human-readable output remains unchanged when `--json` is absent.

Proposed JSON success shape:

```json
{
  "status": "renamed",
  "oldName": "old",
  "name": "new",
  "gitName": "Work User",
  "email": "work@example.com",
  "signingKey": null
}
```

## Alternatives Considered

1. Keep text-only output for rename.
- Pros: zero implementation cost.
- Cons: blocks deterministic automation and keeps command parity inconsistent.

2. Add a separate command (for example `rename-json`).
- Pros: avoids optional-mode branching in one command.
- Cons: larger command surface and poorer discoverability.

3. Return only `{ "ok": true }` for JSON success.
- Pros: minimal payload.
- Cons: downstream scripts often need resulting profile identity, forcing extra
  read calls.

## Consequences

Positive:

- Improves scriptability and CI reliability for profile lifecycle automation.
- Preserves backward compatibility for existing terminal users.
- Brings mutating-command JSON behavior closer to parity.

Negative / trade-offs:

- Adds another JSON contract that must remain stable.
- Introduces command-level error branching for JSON mode.

Risks:

- Automation may assume reason strings are immutable.

Migration / rollback:

- Migration: none; flag is additive.
- Rollback: revert rename `--json` changes, leaving text output intact.

## Rollout Plan

1. Add `--json` option to `rename` command definition.
2. Add rename JSON output helpers for success and failure.
3. Handle `ProfileNotFoundError` and `ProfileAlreadyExistsError` in command
   action with JSON and non-JSON branches.
4. Add e2e tests for JSON success and JSON failure paths.
5. Update README and `docs/cli.md` command docs.
6. Validate with lint/typecheck/test/build.

Feature flag / config:

- Not required; low-risk additive change.

## Test Plan

- E2E:
  - `gitface rename old new --json` returns parseable success JSON and renames
    profile.
  - `gitface rename missing new --json` sets exit code `1` and returns parseable
    error JSON.
  - `gitface rename old existing --json` sets exit code `1` and returns parseable
    error JSON.
- Regression:
  - Existing text-mode rename test remains passing.
- Quality gates:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

No external telemetry backend is configured. Track these indicators:

- e2e pass/fail trend for rename JSON mode
- parse failures in downstream scripts consuming rename output
- non-zero exit-code rate for rename in CI automation

## Security / Privacy

- No additional permissions, network calls, or storage locations.
- JSON payload includes only profile fields already available in human output.
- No new token or PII collection beyond existing profile data.

## Open Questions

- Should `clone` and non-interactive `edit` adopt the same JSON response
  envelope (`status`, `reason`, `code`) in the next iterations?
- Should GitFace formalize command JSON schema versioning?
