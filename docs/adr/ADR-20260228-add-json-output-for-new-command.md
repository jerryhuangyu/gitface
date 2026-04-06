# ADR-20260228: Add machine-readable JSON output for `gitface new`

## Context

`gitface new <profile>` currently emits only human-readable text after profile
creation. This is friendly for terminal users, but automation workflows cannot
reliably parse command outcomes or created profile fields.

Current baseline from this run:

- Quality gates pass: `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`,
  `pnpm run build`.
- Test suite: 44 tests passing.
- Coverage pain point: `src/commands/new` is still low (statements ~42.18%,
  branches ~13.33%).
- Build artifact: `dist/index.js` 70.53 kB (gzip 15.61 kB).

GitFace already supports `--json` for core operational commands (`list`, `use`,
`current`, `doctor`, `import`, `export`, `clone`, `rename`, `remove`, and
`rules` subcommands). `new` remains a core command without equivalent
machine-readable output.

## Decision

Add an additive `--json` option to `gitface new`.

- Keep default behavior unchanged for existing users.
- In JSON mode, support non-interactive creation path and return stable JSON.
- Guard JSON mode from interactive wizard usage by requiring non-interactive
  field flags when `--json` is enabled.
- Return structured JSON on known failures in JSON mode.

MVP JSON contract:

Success:

```json
{
  "status": "created",
  "name": "work",
  "gitName": "Work User",
  "email": "work@example.com",
  "signingKey": null
}
```

Failure:

```json
{
  "status": "error",
  "name": "work",
  "reason": "Profile 'work' already exists."
}
```

## Alternatives Considered

1. Keep text-only output and let scripts parse terminal logs.
- Pros: no implementation work.
- Cons: brittle parsing and inconsistent with existing `--json` design.

2. Add separate command `gitface new:json`.
- Pros: explicit mode separation.
- Cons: command surface bloat and inconsistent UX with current flag-based API.

3. Emit both text and JSON in default mode.
- Pros: no flag required.
- Cons: breaks human readability and backward compatibility for text parsers.

## Consequences

Positive:

- Makes profile bootstrapping automation-friendly.
- Improves parity across command-level machine-readable outputs.
- Enables precise assertions in CI scripts and integration tooling.

Negative / Risks:

- Minor implementation complexity due to dual-mode rendering.
- Risk of contract drift if JSON fields are changed without tests/docs updates.
- JSON mode intentionally disallows interactive wizard in MVP, which may
  surprise users if not documented.

Migration / rollback:

- No migration required; default text mode remains.
- Rollback by reverting this commit returns command to prior behavior.

## Rollout Plan

1. Add `--json` option and rendering helpers for success/failure payloads.
2. Implement JSON-mode guard against interactive wizard path.
3. Add e2e tests for JSON success and JSON error behavior.
4. Update `README.md` and `docs/cli.md`.
5. Run full quality gates before merge.

Rollback strategy:

- Revert the implementation commit; no data migration needed.

## Test Plan

- E2E:
  - `gitface new <name> --git-name ... --email ... --json` prints expected JSON.
  - `gitface new <name> --json` exits with code `1` and JSON error.
  - Existing human-readable non-JSON flow remains valid.
- Regression:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

- Reuse existing command logger scope `command:new`.
- Track success/failure via exit codes in CI and script logs.
- JSON consumers can log parse failures to detect contract mismatches.

## Security/Privacy

- No new network, filesystem, or permission scope is added.
- Output contains Git identity values already shown in human-readable mode.
- No token/secret handling changes.

## Open Questions

- Should JSON mode eventually support non-TTY fallback to bypass wizard
  automatically when no flags are provided?
- Should we standardize command error payloads into a shared schema across all
  commands in a future refactor?
