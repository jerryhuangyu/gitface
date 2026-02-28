# ADR-20260228: Use single-pass scoped identity reads in `GitService`

## Context

`GitService.getScopedIdentity(scope)` is used by user-facing paths such as:

- `gitface current --scope <local|global|system>`
- `gitface use <profile>` (for dry-run/no-op planning)
- `gitface doctor` global identity check

Today, `getScopedIdentity` executes three separate `git config --get` commands
(one each for `user.name`, `user.email`, `user.signingkey`). This adds avoidable
process startup overhead and repeated Git invocation latency on hot paths.

Baseline (local run, 2026-02-28):

- `pnpm run lint`: pass (`real 0.44s`)
- `pnpm run typecheck`: pass (`real 1.21s`)
- `pnpm run test`: pass (`61` tests, `real 4.24s`)
- `pnpm run build`: pass (`real 1.40s`, `dist/index.js 86.19 kB`, gzip `18.37 kB`)
- Repeated command timing: `node dist/index.js current --scope global --json`
  run 30 times: `real 9.56s`

Pain point:

- The same scoped read needs only one config snapshot, but currently pays for
  three Git subprocess calls.

## Decision

Refactor `GitService.getScopedIdentity(scope)` to prefer a single
`git config --list` call (`getAllConfig(scope)`) and derive identity keys from
that snapshot.

MVP scope:

1. Change `getScopedIdentity` to parse `user.name`, `user.email`, and
   `user.signingkey` from one scoped config listing.
2. Preserve compatibility by falling back to per-key `getConfig` calls if the
   single-pass read fails.
3. Add unit tests proving:
   - single-pass path uses one raw git invocation,
   - fallback path still resolves values correctly when list fails.
4. Update docs to note scoped identity reads are single-pass.

## Alternatives Considered

1. Keep existing 3x `--get` implementation
- Pros: no code change, behavior is known.
- Cons: unnecessary process overhead on frequently used commands.

2. Introduce in-memory cache for scoped identity
- Pros: potentially faster repeated reads in one process.
- Cons: cache invalidation complexity and stale-data risk for little gain.

3. Implement one custom multi-key git command using shell scripting
- Pros: fewer subprocesses.
- Cons: platform quoting complexity and lower maintainability than using
  existing `getAllConfig` abstraction.

## Consequences

Positive:

- Fewer subprocess calls on scoped identity paths (3 -> 1 on success path).
- Lower latency for `current --scope`, `use` planning, and doctor checks.
- Cleaner central implementation in `GitService`.

Negative / trade-offs:

- `getScopedIdentity` now depends on `getAllConfig` parsing behavior.
- Additional fallback branch increases code-path count slightly.

Risks:

- Scoped `--list` behavior can vary in constrained environments.
- Mitigation: fallback to previous per-key strategy on error.

Migration / rollback:

- No data migration.
- Rollback is revert of `GitService` change and related tests/docs.

## Rollout Plan

1. Add unit tests for single-pass + fallback behavior.
2. Refactor `GitService.getScopedIdentity` implementation.
3. Update docs (`README` and CLI reference) with implementation note.
4. Run `lint`, `typecheck`, `test`, `build`.
5. Ship as one backward-compatible patch.

Feature flag / config:

- Not required. CLI contract and output schema stay unchanged.

Rollback strategy:

- Revert this commit to restore previous per-key behavior.

## Test Plan

- Unit:
  - `getScopedIdentity("global")` calls one `git.raw` and maps keys correctly.
  - when `--list` fails, fallback uses per-key lookups and returns expected
    values.
- Regression:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

- Existing command logs remain unchanged.
- New debug/warn logs in `GitService.getScopedIdentity` indicate:
  - when single-pass read succeeds,
  - when fallback is activated.
- Performance indicator: scoped identity read subprocess count reduced from
  three to one in unit tests; repeated command wall time monitored in this run.

## Security/Privacy

- No additional external access.
- Reads only local git configuration via existing git invocation path.
- No profile schema or on-disk format changes.

## Open Questions

- Should we apply the same single-pass pattern to other multi-key lookups (for
  example future doctor checks) for consistent performance characteristics?
