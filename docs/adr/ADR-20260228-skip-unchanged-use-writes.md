# ADR-20260228: Skip unchanged writes in `gitface use`

## Context

`gitface use <profile>` currently writes `user.name`, `user.email`, and
`user.signingkey` every time it runs (unless `--dry-run` is used). When the
active scoped identity already matches the selected profile, these writes are
unnecessary.

From a user and operations perspective this causes avoidable cost:

- users cannot clearly tell whether `use` actually changed anything;
- automation runs perform redundant git config writes;
- dry-run output is noisy because it reports all keys rather than actual deltas.

Baseline for this run (2026-02-28, local):

- `pnpm run lint`: pass
- `pnpm run typecheck`: pass
- `pnpm run test`: pass (`50` tests)
- `pnpm run build`: pass (`dist/index.js` `78.43 kB`, gzip `17.04 kB`)

Repository structure, README/docs, ADR history, local workflows, and recent
commits were reviewed. Remote issue/PR/hosted CI details are not directly
queryable in this sandbox.

## Decision

Implement an additive MVP for `gitface use`:

1. Before applying a profile, compute a scope-aware change plan between current
   git identity and target profile.
2. If no effective changes exist, short-circuit as success without mutating git
   config (`no-op`).
3. Keep existing success output contract for normal changed writes.
4. Improve `--dry-run` output to report only effective changes.
5. For no-op runs in JSON mode, return explicit machine-readable status:
   `status: "unchanged"`.

## Alternatives Considered

1. Keep always-write behavior
- Pros: no implementation work.
- Cons: unnecessary writes persist; user intent remains unclear.

2. Add a separate `gitface diff <profile>` command
- Pros: explicit preview workflow.
- Cons: larger command surface; still leaves `use` doing redundant writes.

3. Hide optimization inside git layer only
- Pros: command UX unchanged.
- Cons: still no explicit no-op feedback; dry-run remains noisy.

## Consequences

Positive:

- Faster and cleaner repeated `use` runs in scripts and local workflows.
- Better UX via explicit no-op messaging.
- Dry-run output becomes easier to reason about and parse.

Negative / trade-offs:

- Slightly more logic in `use` command path.
- Additional JSON status branch (`unchanged`) to document and maintain.

Risks:

- Scope-aware identity reads may differ on some environments (especially
  `system` scope permissions).

Migration / rollback:

- No migration needed (additive behavior).
- Rollback: remove no-op branch and restore prior dry-run plan rendering.

## Rollout Plan

1. Add tests that lock no-op and dry-run delta behavior.
2. Implement command + output changes.
3. Update README and CLI docs for new semantics.
4. Run `lint`, `typecheck`, `test`, and `build` gates.
5. If regressions occur, revert this change set.

Feature flag / config:

- Not required. Behavior is automatic and backward-compatible.

## Test Plan

- E2E: when current scoped identity equals target profile, `gitface use` exits
  successfully with no-op message/JSON status.
- E2E: `gitface use <profile> --dry-run --json` returns `changes: []` for
  no-op and only changed keys otherwise.
- Regression: run lint, typecheck, test, and build scripts.

## Observability

Observability remains CLI-native:

- human output contains explicit no-op information;
- JSON output contains deterministic `status` and `changes` fields;
- e2e tests guard both write and no-op paths.

Key indicators for follow-up:

- percentage of `use` invocations returning `status: "unchanged"` in scripted
  automation logs;
- reduction of unnecessary identity-write operations in repeated setup scripts.

## Security/Privacy

- No additional permissions, network calls, or data stores.
- Only reads/writes existing git config identity keys.
- JSON output does not introduce new secret categories.

## Open Questions

- Should a future release emit a `--json` no-op status for changed writes as
  well (`status: "applied"`) to normalize contracts across all branches?
