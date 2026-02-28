# ADR-20260228: Improve `rules list` with query, limit, and stable ordering

## Context

`gitface rules list` currently prints all rules without filtering or bounding output. For users with many `includeIf.gitdir` entries, this creates noisy output and slower inspection in CI logs.

Current pain points:

- No `--query` to quickly find a target directory/profile mapping.
- No `--limit` to bound output size for scripts and terminals.
- Ordering depends on git config entry traversal, so output is not guaranteed deterministic for humans/tests.

Baseline from this run (2026-02-28, local environment):

- Repo/docs/ADR/recent commits scanned locally.
- Remote issue/PR/hosted CI status could not be queried in this sandbox.
- `pnpm run lint`: pass (`286 ms`)
- `pnpm run typecheck`: pass (`804 ms`)
- `pnpm run test`: pass (`16 files / 68 tests`, `3980 ms`)
- `pnpm run build`: pass (`1429 ms`, bundle `dist/index.js 91.45 kB`, gzip `19.58 kB`)
- Coverage from baseline run: statements `77.17%`, branches `62.66%`, functions `85.71%`, lines `77.49%`

## Decision

Implement an additive MVP for `gitface rules list`:

1. Add `--query <text>` filter for case-insensitive matching over `directory` and `profileName`.
2. Add `--limit <number>` to cap returned rows in both human and JSON modes.
3. Sort output deterministically by `directory` (ascending) before filtering/limiting.
4. Validate `--limit` strictly (`>= 1`, integer), fail with clear message and exit code `1` on invalid input.
5. Keep output contract backward compatible when flags are not provided.

## Alternatives Considered

1. Keep current behavior (no filter/limit)
- Pros: zero implementation cost.
- Cons: poor usability for large rule sets and noisy CI logs.

2. Add interactive fuzzy finder only
- Pros: good human UX on TTY.
- Cons: no value for scripts/non-TTY; higher complexity and extra dependencies.

3. Add pagination instead of limit
- Pros: supports full browsing with chunks.
- Cons: more UI/state complexity than needed for current CLI use cases.

## Consequences

Positive:

- Faster rule lookup and cleaner CI/script output.
- Deterministic ordering improves readability and test stability.
- Additive flags keep existing workflows intact.

Negative / Risks:

- Slightly larger command surface (`--query`, `--limit`).
- Users may expect regex query; MVP supports substring only.

Migration / Rollback:

- No migration required.
- Rollback is single commit revert (remove new options + filtering/limiting helpers).

Maintenance:

- Low ongoing cost; logic isolated in list command helpers with tests.

## Rollout Plan

1. Add helper functions for sort/filter/limit and limit validation.
2. Wire commander options (`--query`, `--limit`) in `rules list`.
3. Add e2e tests for JSON and human-mode behaviors.
4. Update README + CLI docs + zh-TW manual.
5. Run lint/typecheck/test/build.
6. Roll back by reverting commit if any regression appears.

Feature flag / config:

- Not needed (safe additive change).

## Test Plan

- E2E:
  - `rules list --json --query <text>` returns filtered rows.
  - `rules list --json --limit <n>` returns bounded, sorted rows.
  - `rules list --limit <n>` human mode prints bounded rows.
  - `rules list --limit 0` exits with code `1` and clear error.
- Regression gates:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

No telemetry backend exists. Validation signals are:

- Deterministic command output in tests.
- Exit-code correctness for invalid limit input.
- Manual spot-check of reduced output size using `--limit`.

## Security/Privacy

- No new network calls.
- No new secret/token paths.
- Query/limit operate only on local rule data already readable by the user.

## Open Questions

- Should `rules list --json` eventually expose metadata (`total`, `filtered`, `returned`) for automation dashboards?
- Should future query mode support regex or glob, or keep substring-only for predictability?
