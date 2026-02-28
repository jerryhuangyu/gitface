# ADR-20260228: Add dry-run preview mode for `gitface use`

## Context

`gitface use <profile>` is the most critical workflow in GitFace because it
changes active Git identity settings. Today, users can only execute the write
path directly. There is no built-in way to preview which values would change
before writing to local/global/system git config.

This creates avoidable risk in script and human workflows:

- accidental scope mistakes (`local` vs `global`) are hard to validate safely;
- signing key removal is implicit when target profile has no `signingKey`;
- CI/bootstrap scripts cannot assert intended mutations without writing first.

Baseline for this run (2026-02-28, local environment):

- `pnpm run lint`: pass (`real 0.39s`)
- `pnpm run typecheck`: pass (`real 3.00s`)
- `pnpm run test`: pass (`49 tests`, `real 3.90s`)
- `pnpm run build`: pass (`real 1.30s`)
- bundle size: `dist/index.js` `76.11 kB`, gzip `16.54 kB`

Repository-level context (README, docs, ADRs, workflows, recent commits) was
reviewed locally. Remote issue/PR/CI run statuses are not queryable from this
sandbox.

## Decision

Introduce additive `--dry-run` support for `gitface use` as an MVP:

1. Add `gitface use <profile> --dry-run` option.
2. In dry-run mode, do not mutate Git config.
3. Resolve current scoped identity values (`user.name`, `user.email`,
   `user.signingkey`) and target profile values, then emit a change plan.
4. Support both output modes:
   - human-readable diff summary for terminal users;
   - machine-readable JSON payload for automation (`--json --dry-run`).
5. Preserve backward compatibility for existing `use` behavior and exit codes.

## Alternatives Considered

1. No dry-run support (status quo)
- Pros: zero code changes.
- Cons: keeps unsafe blind-write workflow in the highest-impact command.

2. External shell-only preview wrappers
- Pros: avoids CLI feature expansion.
- Cons: fragmented behavior and no stable output contract for scripts.

3. Add an interactive confirmation prompt before writes
- Pros: safer for humans.
- Cons: poor fit for non-interactive automation and does not provide reusable
  machine-readable preview data.

## Consequences

Positive:

- Safer identity switching with explicit preview before writes.
- Better automation ergonomics: scripts can validate intended changes.
- Clearer behavior for signing key unset cases.

Negative / trade-offs:

- Slightly larger command surface in `use`.
- Additional output schema to maintain for JSON contracts.

Risks:

- Users may misread unchanged values if output is not clear.
- Scope-specific reads can vary by environment (especially `system` scope).

Migration / rollback:

- No migration required (additive).
- Rollback is straightforward by removing `--dry-run` path and docs entries.

## Rollout Plan

1. Add e2e tests for dry-run JSON behavior and no-write guarantee.
2. Implement dry-run planning logic in `use` command.
3. Add human/json output renderers for plan results.
4. Update CLI docs and README examples.
5. Run `lint`, `typecheck`, `test`, `build`.
6. If regressions appear, revert this change set to restore prior behavior.

Feature flag / config:

- Not required for MVP; behavior is opt-in via CLI flag.

## Test Plan

- E2E:
  - `gitface use <profile> --dry-run --json` returns a stable plan payload.
  - Dry-run does not modify git config values on disk.
  - Existing `gitface use <profile>` still applies values normally.

- Regression gates:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

No telemetry backend exists in GitFace; observability for this decision is via:

- command exit codes;
- deterministic JSON dry-run payload in automation logs;
- e2e tests asserting write/no-write behavior.

Key indicators:

- dry-run execution success rate;
- mismatch/defect reports where dry-run plan diverges from actual apply.

## Security / Privacy

- No additional network calls or external services.
- Reads existing local git config values only.
- JSON output may contain identity data already available through existing
  commands; no new secret categories introduced.

## Open Questions

- Should future iterations add `--confirm` that consumes a dry-run plan hash to
  prevent TOCTOU drift in critical automation?
