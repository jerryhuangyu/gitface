# ADR-20260228: Lazy-load interactive UI modules for non-interactive commands

## Context

GitFace has expanded machine-readable (`--json`) support across commands for automation use-cases. However, several commands still import Ink/React interactive UI modules at file load time, even when running in non-interactive mode.

Current baseline (measured on 2026-02-28 in local workspace, 25 runs average):

- `node dist/index.js list --json`: **174.41ms**
- `node dist/index.js use bench --json`: **353.53ms**

In automation scenarios, this startup overhead is paid repeatedly and does not provide user value because no TUI is rendered.

Pain points:

- Script/CI feedback loop feels slower than necessary.
- Command startup includes unnecessary dependency initialization.
- Interactive and non-interactive concerns are coupled, increasing maintenance cost.

## Decision

Implement an MVP that lazy-loads interactive UI modules only when needed, while keeping all user-facing behavior backward compatible.

Scope for this ADR:

1. `gitface use`
   - Split human/json output helpers from Ink interactive selector.
   - Dynamically import interactive selector module only when `<name>` is omitted.
2. `gitface list`
   - Dynamically import Ink renderer/UI table only for human-readable mode.
   - Keep `--json` path free from eager interactive UI imports.

No CLI surface changes in this iteration.

## Alternatives Considered

1. Keep current architecture and accept overhead.
   - Pros: zero implementation effort.
   - Cons: repeated unnecessary startup cost for automation remains.

2. Remove Ink UIs entirely and make all flows purely flag-driven.
   - Pros: maximal startup simplicity.
   - Cons: major UX regression for interactive users; out of scope and not backward compatible.

3. Lazy-load all interactive commands (`new/edit/list/use`) in one large change.
   - Pros: larger immediate performance win.
   - Cons: wider blast radius and review complexity; harder to isolate regressions.

## Consequences

Positive:

- Faster non-interactive command startup for affected commands.
- Cleaner separation of concerns (output vs interactive view).
- Lower maintenance risk when extending automation-oriented features.

Negative / tradeoffs:

- Slightly more module structure complexity.
- First interactive render may pay a small dynamic-import cost.

Risk and migration:

- No data migration required.
- Runtime risk is limited to command routing paths and import boundaries.
- Rollback is straightforward by restoring eager imports.

## Rollout Plan

1. Refactor `use` command output/UI boundaries.
2. Refactor `list` command to lazy-load interactive UI.
3. Update CLI docs with implementation note about lazy loading.
4. Validate with lint/typecheck/test/build.
5. Measure before/after timings on the same local harness.

Feature flag:

- Not required because behavior remains backward compatible and scope is limited.

Rollback strategy:

- Revert the commit to restore previous import behavior.

## Test Plan

- Unit/integration: rely on existing command action tests and command-runner behavior.
- E2E regression:
  - `tests/list.e2e.test.ts` (including JSON output path)
  - `tests/use.e2e.test.ts` (including JSON output path)
- Full regression suite:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`
- Performance sanity:
  - Compare average startup times before/after for:
    - `node dist/index.js list --json`
    - `node dist/index.js use bench --json`

## Observability

Track command latency via repeatable local measurements (avg ms over N runs) for non-interactive flows:

- `list --json` average runtime
- `use <profile> --json` average runtime

Guardrail signals:

- Exit code parity and JSON payload compatibility in E2E tests.
- No increase in command error rate in local smoke runs.

## Security/Privacy

- No new permissions, network access, or external integrations introduced.
- No change to profile data shape, storage paths, or secret handling.
- Reduced eager module loading does not expand attack surface.

## Open Questions

- Should we apply the same lazy-loading pattern to `new` and `edit` in a follow-up ADR for larger performance gains?
- Should latency checks be added as a lightweight benchmark script in CI to detect regressions over time?
