# ADR-20260228: Fix interactive `use` flow to apply selection and fail fast on empty profiles

## Context

`gitface use` supports two paths:

- explicit profile: `gitface use <name>`
- interactive selector: `gitface use` (without `<name>`)

In the current implementation (`src/commands/use/action.tsx`), the interactive
path resolves a selected profile name but immediately returns from the command
handler before applying the profile. This creates a UX mismatch: users can pick
an item, but Git config is not updated.

There is also an empty-state reliability issue in interactive mode: when no
profiles exist, the selector UI can remain open without a deterministic exit,
which is problematic for terminal automation and TTY sessions.

Baseline (local run, 2026-02-28):

- `pnpm run lint`: pass
- `pnpm run typecheck`: pass
- `pnpm run test`: pass (`59` tests)
- `pnpm run build`: pass (`dist/index.js 85.67 kB`, gzip `18.25 kB`)
- Coverage snapshot: lines `78.92%`, branches `61.29%`
- Existing pain point: interactive `use` selection does not complete the core
  action (apply profile), violating user expectation in the main flow.

Repo structure, README/docs, existing ADR history, recent commits, and local CI
workflow definitions were reviewed. Hosted issue/PR runtime status is not
queryable from this sandbox.

## Decision

Implement a deterministic interactive `use` control flow that always resolves to
one of two outcomes:

1. **Profile selected**: continue the command and apply the selected profile
   using the same validation/output logic as `gitface use <name>`.
2. **No profiles available**: exit interactive mode immediately, print a clear
   remediation message, and set exit code `1`.

MVP scope:

1. Update `src/commands/use/action.tsx` to continue execution after interactive
   selection instead of returning early.
2. Extend `src/commands/use/select-profile.tsx` with an explicit empty-state
   callback (`onEmpty`) so the action can fail fast without hanging.
3. Add tests covering interactive selection success and empty-state failure.
4. Update CLI docs/README behavior notes for interactive `use`.

Compatibility constraints:

- Keep current flags and JSON contracts unchanged.
- Do not alter explicit-name path behavior.
- Preserve backward-compatible exit code semantics (`0` success, `1` failure).

## Alternatives Considered

1. Keep current behavior and rely on `gitface use <name>` only
- Pros: no code changes.
- Cons: interactive UX remains misleading and can appear broken.

2. Remove interactive mode from `use`
- Pros: simplifies command control flow.
- Cons: regression in discoverability and convenience for human users.

3. Auto-create a profile when none exist
- Pros: avoids empty selector state.
- Cons: unexpectedly broadens scope and mutates data in a read/selection flow.

## Consequences

Positive:

- Interactive `use` now completes the same core action users expect from explicit
  mode.
- Empty profile state becomes deterministic and actionable.
- Improves trust in CLI behavior for both manual and scripted usage.

Negative / trade-offs:

- Slightly more branching in interactive command flow.
- Additional test/mocking surface for dynamic `ink` imports.

Risks:

- Interactive callback wiring (`onSelect`/`onEmpty`) must avoid double-resolve.
- Error messaging must stay consistent with existing command style.

Migration / rollback:

- No data migration required.
- Rollback is straightforward by reverting the flow changes.

## Rollout Plan

1. Add focused tests for interactive selection and empty-state behavior.
2. Implement `action.tsx` flow change (selection continues into apply branch).
3. Implement empty-state callback/exit in `select-profile.tsx`.
4. Update README and `docs/cli.md` interactive behavior notes.
5. Validate with lint/typecheck/test/build.

Feature flag / config:

- Not required; this is a backward-compatible behavior correction.

Rollback strategy:

- Revert the changed `use` action and selector callback wiring if regressions are
  discovered.

## Test Plan

- Unit/integration-style command tests:
  - interactive selection resolves and applies chosen profile.
  - interactive mode with zero profiles exits with code `1` and helpful message.
- Regression suite:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

- Reuse existing command error channel (`sendProfileUseFailedMsg` + exit code
  `1`) for empty-state failures.
- Track via automated tests for both outcomes (selected vs empty).

Key indicators:

- interactive run modifies Git config when selection is made;
- interactive run exits promptly with guidance when no profiles exist;
- no regressions in existing `use` command E2E tests.

## Security/Privacy

- No new network operations or permission scope changes.
- No new credential/token handling.
- Behavior change is limited to command control flow and user feedback.

## Open Questions

- Should a future release add an explicit non-zero code taxonomy (for example,
  validation vs runtime) to make shell automation even more expressive?
