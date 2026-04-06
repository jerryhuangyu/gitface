# ADR-20260228: Add `--scope` option for `gitface current`

## Context

`gitface current` currently reports the effective identity resolved by Git, but it
cannot explicitly inspect one scope (`local`, `global`, or `system`) on demand.

User and operations pain points:

- troubleshooting requires manual `git config --local/--global/--system` calls
  outside GitFace;
- automation cannot reliably ask GitFace for one specific scope in JSON;
- output can show `undefined` for missing `user.name` or `user.email`, which is
  less clear than an explicit unset state.

Baseline for this run (2026-02-28, local):

- `pnpm run lint`: pass (`real 0.49s`)
- `pnpm run typecheck`: pass (`real 1.52s`)
- `pnpm run test`: pass (`52 tests`, `real 4.75s`)
- `pnpm run build`: pass (`real 1.51s`)
- Build artifact: `dist/index.js` `79.75 kB` (gzip `17.24 kB`)

Repository docs/ADRs/workflows/recent commits were reviewed locally. Remote
issue/PR/hosted CI status is not queryable in this sandbox.

## Decision

Implement an additive MVP for `gitface current`:

1. Add `--scope <local|global|system>` option.
2. Keep existing behavior when `--scope` is omitted (effective identity
   resolution).
3. For scoped mode, return only values from the selected scope.
4. Add explicit scope validation and JSON error output for invalid values.
5. Standardize unset display in human mode to `<unset>` (for name, email,
   signing key).

Expected JSON contracts:

- `gitface current --json` (unchanged):
  `{ "gitName": "...", "email": "...", "signingKey": null }`
- `gitface current --scope global --json`:
  `{ "gitName": "...", "email": "...", "signingKey": null, "scope": "global" }`
- invalid scope JSON:
  `{ "status": "error", "reason": "Scope must be one of: local, global, system." }`

## Alternatives Considered

1. Keep current behavior without scoped reads.
- Pros: no implementation work.
- Cons: keeps troubleshooting and automation friction.

2. Add a separate command (for example `gitface current-scope`).
- Pros: avoids branching inside one command.
- Cons: larger command surface and weaker discoverability.

3. Add scope support only for human output (no JSON).
- Pros: smaller change.
- Cons: scripts still cannot consume stable scoped output.

## Consequences

Positive:

- Better UX for identity debugging in multi-scope setups.
- Better automation support via deterministic scoped JSON output.
- Reduced command-layer duplication by moving scoped identity read to
  `GitService`.

Negative / trade-offs:

- Additional command option and branching paths to maintain.
- One more JSON contract (`status:error` on invalid scope) to preserve.

Risks:

- `system` scope may fail on restricted environments.

Migration / rollback:

- Backward compatible (option is additive).
- Rollback by reverting `current` scope option and helper methods.

## Rollout Plan

1. Add scoped identity read helper in `GitService`.
2. Update `current` command option parsing and validation.
3. Update UI/JSON renderers for clearer unset values and scoped output.
4. Add e2e coverage for scoped JSON and invalid scope behavior.
5. Update README and CLI docs.
6. Run lint/typecheck/test/build quality gates.

Feature flag / config:

- Not required; additive low-risk behavior.

Rollback strategy:

- Revert this change set if scoped output causes contract regressions.

## Test Plan

- E2E:
  - `gitface current --scope local --json` returns scoped values.
  - `gitface current --scope global --json` returns scoped values when set.
  - `gitface current --scope nope --json` returns error JSON and exit code `1`.
- Regression:
  - existing `current` tests stay green.
- Quality gates:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

No external telemetry backend is configured. Use CLI-native observability:

- deterministic JSON payloads for scoped/current identity reads;
- exit-code tracking (`0` success, `1` invalid scope/failure);
- e2e coverage guarding success and failure contracts.

Key indicators:

- number of automation flows using `current --scope ... --json`;
- reduction in manual `git config` debugging commands for identity issues.

## Security/Privacy

- No new network calls or external integrations.
- Reads only existing Git config identity keys.
- Output remains limited to identity fields already surfaced by the CLI.

## Open Questions

- Should future JSON payloads include a stable `status` field even on success
  for all commands to normalize contracts?
- Should `current` support an explicit `--scope effective` alias for clarity?
