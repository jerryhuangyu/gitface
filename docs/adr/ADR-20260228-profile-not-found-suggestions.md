# ADR-20260228: Add profile-not-found suggestions for command recovery

## Context

GitFace has complete profile lifecycle commands, but the missing-profile failure path is still terse in multiple workflows (`use`, `clone`, `rename`, `remove`, `rules add`).

Current user-facing error payloads usually return only "not found" without any recovery hint. In practice, profile names are user-entered strings and typos/case mistakes are common. This causes avoidable retries and context switches to `gitface list`.

Baseline from this run (local, 2026-02-28):

- `pnpm run lint`: pass (`real 0.44s`)
- `pnpm run typecheck`: pass (`real 1.52s`)
- `pnpm run test`: pass (`65 tests`, `real 4.26s`)
- `pnpm run build`: pass (`real 1.75s`)
- Coverage: statements `77.39%`, branches `61.62%`, functions `85.83%`, lines `77.79%`

Repository docs/ADRs and recent commits were reviewed locally. Remote PR/issue/CI status could not be queried because `gh` is unavailable in this environment.

## Decision

Implement an additive recovery feature: when a command fails due to missing profile, append up to three suggested existing profile names.

MVP scope:

1. Add a reusable profile-name suggestion module in core logic.
2. Reuse it in missing-profile paths for:
   - `gitface use`
   - `gitface clone`
   - `gitface rename`
   - `gitface remove`
   - `gitface rules add`
3. Keep output backward compatible:
   - JSON schema unchanged (`status`/`reason` fields remain), only `reason` text gains suggestion suffix.
   - Human mode remains text-first, with clearer recovery hint.
4. Ranking strategy for suggestions:
   - prioritize exact prefix, then substring, then edit-distance proximity.

## Alternatives Considered

1. Keep current behavior and rely on `gitface list`
- Pros: no implementation cost.
- Cons: higher friction, no guided recovery in the failing command.

2. Add interactive correction prompt when profile is missing
- Pros: potentially fastest human recovery.
- Cons: breaks non-interactive/script workflows and increases complexity.

3. Use only strict prefix matching for suggestions
- Pros: simpler implementation.
- Cons: weaker typo recovery (e.g., transposed/near-miss names).

## Consequences

Positive:

- Better UX in high-frequency failure mode.
- Fewer retry commands for typo/case mismatch scenarios.
- Reusable suggestion logic lowers duplication in command handlers.

Negative / Risks:

- Slightly longer error messages.
- Suggestion ranking may occasionally feel non-intuitive for edge cases.

Migration / Rollback:

- No migration needed; behavior is additive.
- Rollback is one commit revert (remove suggestion module + call sites).

Maintenance:

- Low ongoing cost; single shared suggestion utility with unit coverage.

## Rollout Plan

1. Add unit tests for suggestion ranking and limit behavior.
2. Add/adjust e2e tests for JSON failure payloads in scoped commands.
3. Wire suggestion enrichment into selected command error paths.
4. Update README and CLI docs with sample output.
5. Run lint/typecheck/test/build gates.
6. If regressions appear, revert this ADR implementation commit.

Feature flag / config:

- Not needed; change is safe and additive.

## Test Plan

- Unit tests:
  - prefix/substring/edit-distance ordering.
  - top-N limiting and dedup behavior.
- E2E tests:
  - `clone --json` missing source returns enriched reason.
  - `rename --json` missing source returns enriched reason.
  - `remove --json` missing source returns enriched reason.
  - `rules add --json` missing profile returns enriched reason.
  - `use` missing profile prints enriched recovery text.
- Regression gates:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

GitFace has no telemetry backend; observability is command output + tests.

Key indicators for this decision:

- e2e pass rate for missing-profile recovery paths.
- reduction in follow-up `list` commands during manual workflows (qualitative for now).

## Security/Privacy

- No network calls added.
- Suggestions only expose locally stored profile names already readable by the same user context.
- No new token/secret handling paths introduced.

## Open Questions

- Should future JSON error payloads expose structured `suggestions: string[]` (instead of embedding in `reason` text) for machine consumers?
- Should we add a `--no-suggest` switch for strict/minimal output modes?
