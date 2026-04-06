# ADR-20260228: Use atomic writes for profile and identity storage

## Context

GitFace persists two critical local artifacts:

- profile snapshots: `~/.config/gitface/profiles/<name>.json`
- generated include configs: `~/.config/gitface/identities/<name>.gitconfig`

Current implementation writes both files directly with `writeFile`. If a process is
interrupted during write (unexpected exit, OS crash, disk pressure), files can be
left partially written or empty. That failure mode directly affects core user flows:
`list`, `use`, `edit`, `clone`, and rule-based include configs.

Baseline for this run (local, 2026-02-28):

- `pnpm run lint`: pass (`real 0.36s`)
- `pnpm run typecheck`: pass (`real 0.77s`)
- `pnpm run test`: pass (`56` tests, `real 3.54s`)
- `pnpm run build`: pass (`dist/index.js 84.99 kB`, gzip `18.07 kB`, `real 1.08s`)
- Coverage snapshot: lines `78.77%`, branches `61.22%`

Repository docs/ADR history and recent commits were reviewed. Hosted issue/PR/CI
status are not directly queryable in this sandbox.

## Decision

Implement atomic file writes for profile and identity artifacts by introducing a
shared infra helper and migrating both stores to use it.

MVP scope:

1. Add `writeFileAtomic(filePath, content)` in infra:
   - write payload to a temp file in the same directory,
   - `rename` temp file onto target path for atomic replacement.
2. Use atomic writes in:
   - `FileProfileStore.save`
   - `FileProfileConfigStore.save`
3. Add unit tests for success and failure cleanup semantics.
4. Document atomic-write durability guarantee in profile storage docs.

Compatibility constraints:

- No CLI contract changes.
- No path changes.
- Existing JSON outputs and exit codes remain unchanged.

## Alternatives Considered

1. Keep direct `writeFile`
- Pros: zero change.
- Cons: leaves partial-write corruption risk in primary data path.

2. Add backup/restore files (`.bak`) without atomic replace
- Pros: can recover manually.
- Cons: adds cleanup complexity and still permits partial writes during replace.

3. Move to embedded DB (SQLite)
- Pros: stronger transactional semantics.
- Cons: much larger migration and operational scope than this round's MVP.

## Consequences

Positive:

- Greatly reduces risk of corrupt profile/config artifacts on interrupted writes.
- Centralizes write durability behavior in one infra utility.
- Improves reliability for both human and scripted command usage.

Negative / trade-offs:

- Slightly more filesystem operations per save (temp file + rename).
- Additional helper/test surface to maintain.

Risks:

- Temp-file cleanup must be correct on failures.
- Cross-device rename is unsupported, but writing temp in same directory avoids
  this in normal operation.

Migration / rollback:

- No data migration needed.
- Rollback is straightforward: switch stores back to direct `writeFile`.

## Rollout Plan

1. Add failing/guardrail tests for atomic helper behavior.
2. Introduce infra atomic-write helper.
3. Migrate profile/config stores to helper.
4. Update profile storage documentation.
5. Run lint/typecheck/test/build and compare baseline timings.

Feature flag / config:

- Not required for MVP; behavior is internal and backward-compatible.

Rollback strategy:

- Revert helper usage in both stores if runtime issues appear.

## Test Plan

- Unit:
  - atomic helper writes expected file content.
  - temp file is cleaned when rename fails.
- Regression:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

- Existing command-level error handling remains unchanged; failures surface as
  command errors with exit code `1`.
- New test coverage acts as reliability guardrail for write path behavior.

Key indicators:

- zero leftover temp files in atomic-write failure test;
- no regressions in save/update/clone/rename/remove E2E flows.

## Security/Privacy

- No new network behavior, permissions expansion, or PII handling.
- Atomic replacement lowers risk of malformed local config artifacts that could
  trigger confusing downstream behavior.

## Open Questions

- Should follow-up work add optional fsync for stricter durability guarantees on
  filesystems with aggressive write caching?
