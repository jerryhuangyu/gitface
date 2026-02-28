# ADR-20260228: Add machine-readable JSON output for `gitface edit`

## Context

`gitface edit <profile>` currently supports interactive editing and
non-interactive field updates, but only emits human-readable terminal messages.
Automation scripts cannot reliably parse outcomes or updated profile values.

Baseline from this run:

- Quality gates are green: `pnpm run lint`, `pnpm run typecheck`,
  `pnpm run test`, `pnpm run build`.
- Test suite: 46 passing tests.
- Runtime snapshot: lint ~307ms, typecheck ~895ms, test ~1786ms, build ~1042ms.
- Build artifact: `dist/index.js` 71.44 kB (gzip 15.71 kB).
- Coverage hotspot: `src/commands/edit` is low (statements 23.07%, branches
  8.33%, functions 27.27%, lines 23.07%).

GitFace already ships `--json` mode on most core commands (`new`, `list`,
`use`, `current`, `doctor`, `import`, `export`, `clone`, `rename`, `remove`,
`rules`). `edit` is the main remaining profile mutation path without equivalent
structured output.

## Decision

Add an additive `--json` option to `gitface edit`.

- Keep existing interactive UX and human-readable output unchanged by default.
- In non-interactive update mode, emit stable JSON payloads for success/failure.
- In JSON mode, require non-interactive update flags and reject interactive mode
  with a structured JSON error.
- Preserve backward compatibility: no existing flag semantics are removed.

MVP JSON contract:

Success:

```json
{
  "status": "updated",
  "name": "work",
  "gitName": "New Name",
  "email": "new@example.com",
  "signingKey": "NEWKEY"
}
```

Failure:

```json
{
  "status": "error",
  "name": "work",
  "reason": "Non-interactive flags are required when using --json output mode."
}
```

## Alternatives Considered

1. Keep text-only output and let scripts parse logs.
- Pros: zero implementation effort.
- Cons: brittle parsing and inconsistent API surface across commands.

2. Add separate command (for example, `gitface edit:json`).
- Pros: explicit command split.
- Cons: larger command surface, inconsistent with existing `--json` pattern.

3. Auto-enable JSON only in non-TTY environments.
- Pros: fewer flags for scripts.
- Cons: surprising behavior changes and harder contract discovery.

## Consequences

Positive:

- Improves scriptability for profile maintenance workflows.
- Aligns `edit` with existing command-level JSON conventions.
- Increases testability and expected coverage for `src/commands/edit`.

Negative / Risks:

- Dual-mode output paths add conditional complexity.
- JSON schema drift risk if fields change without test/docs updates.
- Users may expect interactive JSON mode unless guardrails are documented.

Migration / rollback:

- No data migration required.
- Rollback is a clean revert of this change set.

## Rollout Plan

1. Add `--json` flag to `edit` command options.
2. Implement UI helpers for JSON success/error payloads.
3. Update `edit` action error handling for JSON mode and interactive guardrails.
4. Add e2e tests for JSON success and JSON failure behavior.
5. Update `README.md` and `docs/cli.md`.
6. Run full quality gates before merge.

Rollback strategy:

- Revert commit; behavior returns to prior text-only output.

## Test Plan

- E2E:
  - `gitface edit work --git-name ... --email ... --json` returns success JSON.
  - `gitface edit missing --git-name ... --json` returns error JSON and exit code
    `1`.
  - `gitface edit work --json` returns error JSON (interactive disabled in JSON
    mode) and exit code `1`.
- Regression:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

- Reuse existing command logger scope `command:edit`.
- JSON consumers can track `status` and `reason` fields for alerting/parsing.
- Exit code remains the coarse failure signal (`0` success, `1` failure).

## Security/Privacy

- No new permissions, network calls, or secret material handling.
- JSON output includes the same identity fields already available in text mode.
- No additional PII beyond existing Git identity profile fields.

## Open Questions

- Should we standardize all command JSON outputs with a shared schema helper?
- Should interactive mode eventually expose a `--json` result summary after UI
  completion (without changing interaction model)?
