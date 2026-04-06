# ADR-20260228: Add machine-readable JSON output for `gitface clone`

## Context

`gitface clone <source> <target>` currently emits only human-readable text.
That works in terminal usage, but automation cannot reliably parse outcomes.

Current pain points:

- Scripts cannot deterministically inspect clone success/failure and resulting
  profile fields.
- Core command family has expanded JSON support (`list`, `rules list`, `use`,
  `current`, `doctor`, `import`, `remove`, `rename`), but `clone` is still a
  gap in profile lifecycle automation.
- Failure paths (`source` missing, `target` exists) currently rely on generic
  error rendering, which is harder for machine consumers.

Baseline measured in this run (2026-02-28 local):

- `pnpm run lint`: pass (`real 0.48s`)
- `pnpm run typecheck`: pass (`real 0.81s`)
- `pnpm run test`: pass (`32 tests`, `real 1.94s`)
- `pnpm run build`: pass (`dist/index.js 66.22 kB`, gzip `15.00 kB`, `real 0.98s`)
- Coverage: statements `69.8%`, branches `48.57%`, functions `77.06%`,
  lines `70.19%`

Repo/CI context note:

- Local git history and workflow files were reviewed.
- Remote issue/PR/CI run lists are not queryable in this sandboxed run.

## Decision

Add an additive `--json` option to `gitface clone`.

- New command form:
  - `gitface clone <source> <target> --json`
- JSON success payload includes status and cloned profile fields.
- JSON failure payload includes stable input names and reason:
  - source missing
  - target already exists
- Keep existing human-readable output as default when `--json` is absent.
- Keep existing exit behavior: failures set exit code `1`.

Proposed JSON success shape:

```json
{
  "status": "cloned",
  "sourceName": "source",
  "name": "target",
  "gitName": "Source User",
  "email": "source@example.com",
  "signingKey": null
}
```

## Alternatives Considered

1. Keep text-only clone output.
- Pros: zero implementation cost.
- Cons: blocks robust scripting and keeps command parity incomplete.

2. Add a separate command (for example `clone-json`).
- Pros: explicit machine mode.
- Cons: command-surface growth and inconsistent with existing `--json` pattern.

3. Always output JSON for clone.
- Pros: one canonical output format.
- Cons: breaks current human UX and backward compatibility.

## Consequences

Positive:

- Enables deterministic automation for clone workflows.
- Keeps CLI UX backward compatible.
- Aligns clone behavior with existing machine-readable command family.

Negative / trade-offs:

- Adds one more JSON output contract to maintain.
- Adds explicit error handling branch in clone action for JSON mode.

Risks:

- Downstream scripts may couple to field names and reason strings.

Migration / rollback:

- Migration: none (additive option).
- Rollback: revert this patch set; existing text output remains.

## Rollout Plan

1. Add `--json` option to clone command definition.
2. Add clone UI helpers for text + JSON success/failure rendering.
3. Handle `ProfileNotFoundError` and `ProfileAlreadyExistsError` in clone action
   with JSON and non-JSON branches.
4. Add e2e tests for clone JSON success and key failure paths.
5. Update README and `docs/cli.md`.
6. Validate with `lint/typecheck/test/build`.

Feature flag / config:

- Not required; additive and low-risk.

## Test Plan

- E2E:
  - `gitface clone source target --json` returns parseable success JSON and
    writes the cloned profile.
  - `gitface clone missing target --json` returns parseable error JSON and sets
    exit code `1`.
  - `gitface clone source target --json` with existing target returns parseable
    error JSON and sets exit code `1`.
- Regression:
  - Existing human-output clone test remains passing.
- Quality gates:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

No external telemetry backend is configured. Use:

- command exit code trend for clone in automation
- e2e pass/fail trend for clone JSON mode
- parse failures in downstream scripts (expected to decrease)

## Security / Privacy

- No new network access or permission surface.
- JSON output includes profile identity values already accessible in existing
  profile flows.
- No additional token/PII collection.

## Open Questions

- Should `new`, non-interactive `edit`, and `clone` converge on one shared JSON
  envelope (`status`, `reason`, optional `code`)?
- Should GitFace publish lightweight schema notes for all JSON command outputs?
