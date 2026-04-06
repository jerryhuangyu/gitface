# ADR-20260228: Lazy-load Ink for new/edit non-interactive paths

## Context

GitFace has expanded machine-readable (`--json`) support across profile lifecycle commands. `gitface new` and `gitface edit` are commonly used in scripts and automation, but both commands still load interactive Ink/React modules at module import time.

Current baseline (measured on 2026-02-28 in local workspace, 30 runs per command):

- `node dist/index.js new speed --git-name ... --email ... --force --json`: **6.55s total** (~218ms/run)
- `node dist/index.js edit speed --git-name ... --email ... --unset-signing-key --json`: **6.44s total** (~215ms/run)

Pain points:

- Non-interactive script runs pay interactive UI startup cost repeatedly.
- Interactive concerns (Ink components) and output concerns (`--json`/CLI messaging) are tightly coupled in one module.
- Performance optimization is harder because output helpers are not separable from UI imports.

## Decision

Implement an MVP refactor that keeps command behavior unchanged while removing eager Ink UI loading from non-interactive `new/edit` paths.

Scope:

1. Split `new` output helpers from interactive UI component:
   - Move JSON/human output helpers to `src/commands/new/output.ts`.
   - Keep interactive component in `src/commands/new/ui.tsx`.
2. Split `edit` output helpers from interactive UI component:
   - Move JSON/human output helpers to `src/commands/edit/output.ts`.
   - Keep interactive component in `src/commands/edit/ui.tsx`.
3. In `new/action.tsx` and `edit/action.tsx`, dynamically import `ink` and UI modules only when entering interactive mode.

No CLI contract changes (`flags`, exit codes, JSON payload shape) are introduced.

## Alternatives Considered

1. Keep eager imports as-is.
   - Pros: no refactor effort.
   - Cons: repeated startup overhead remains for automation-heavy usage.

2. Remove interactive mode entirely and require full flag-based flows.
   - Pros: simplest runtime path.
   - Cons: major UX regression and backward compatibility break.

3. Lazy-load all remaining interactive commands in one larger refactor.
   - Pros: bigger immediate performance gain.
   - Cons: wider blast radius and harder regression isolation in one iteration.

## Consequences

Positive:

- Faster non-interactive `new/edit` command startup.
- Cleaner separation of responsibilities (output vs UI).
- Lower maintenance cost for future automation-oriented features.

Negative / tradeoffs:

- Adds extra module files (`output.ts`) and dynamic import boundaries.
- First interactive render may pay a small one-time dynamic import cost.

Migration and compatibility:

- No data migration required.
- No profile schema or storage path changes.
- Backward compatible at CLI level.

## Rollout Plan

1. Add `output.ts` for `new` and `edit` and wire existing output calls to new files.
2. Convert interactive branches to lazy-load `ink` + UI component modules.
3. Update docs to note lazy-load behavior for non-interactive paths.
4. Run lint/typecheck/test/build.
5. Re-measure 30-run local timing for affected commands.

Feature flag:

- Not required for this MVP due to backward-compatible behavior and limited scope.

Rollback strategy:

- Revert the refactor commit to restore eager import behavior.

## Test Plan

- Regression coverage via existing E2E suites:
  - `tests/new.e2e.test.ts`
  - `tests/edit.e2e.test.ts`
- Full validation pipeline:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`
- Performance check (same machine/config):
  - 30-run timing loop for `new --json`
  - 30-run timing loop for `edit --json`

## Observability

Track non-interactive command latency using repeatable local timing loops:

- total wall-clock time over 30 runs for `new --json`
- total wall-clock time over 30 runs for `edit --json`

Correctness guardrails:

- Existing E2E payload assertions for `--json` outputs remain unchanged.
- Exit code behavior remains identical in success and error paths.

## Security/Privacy

- No new network calls, file locations, or permissions.
- No changes to how profile data or optional signing keys are stored.
- Refactor reduces eager module initialization without widening data exposure.

## Open Questions

- Should we add a lightweight benchmark script under `scripts/` to standardize latency regression checks?
- Should we extend this pattern to any future command that combines TUI + non-interactive JSON paths?
