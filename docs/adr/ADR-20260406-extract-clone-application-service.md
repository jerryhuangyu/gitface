# ADR-20260406: Extract a dedicated application service for `gitface clone`

## Context

`gitface clone` currently works, but its command action has become the wrong
place for clone semantics.

Current state inspected on 2026-04-06:

- [`src/commands/clone/action.ts`](/Users/jerry/code/me/gitface/src/commands/clone/action.ts#L20)
  mixes command orchestration, dry-run planning, conflict validation, output
  mode branching, and error translation in one function.
- The dry-run path in
  [`src/commands/clone/action.ts`](/Users/jerry/code/me/gitface/src/commands/clone/action.ts#L24)
  manually re-implements clone preconditions by calling `getProfile()` and
  `findProfile()` directly, while the real write path delegates to
  [`cloneProfile()`](/Users/jerry/code/me/gitface/src/core/profile-service.ts#L240).
- That creates split ownership for the same rule set:
  - source profile must exist;
  - target profile conflict depends on `--force`;
  - cloned profile payload must mirror the source identity fields.
- Neighboring commands have already moved toward dedicated application services:
  - [`ProfileRenameService`](/Users/jerry/code/me/gitface/src/core/profile-rename-service.ts)
    owns rename preview and execution;
  - [`ProfileRemoveService`](/Users/jerry/code/me/gitface/src/core/profile-remove-service.ts)
    owns remove result semantics.
- `clone` is now the outlier, which makes future additions like
  `--json-envelope`, richer preview metadata, or shared failure contracts more
  likely to duplicate logic again.

This is primarily a `Single Responsibility Principle` and `Divergent Change`
smell:

1. The command action changes for domain-rule changes, output changes, and
   error-contract changes.
2. The same clone rule is expressed in more than one place.
3. The command layer knows too much about how to preview clone semantics.

Baseline from this planning pass (2026-04-06 local):

- `pnpm run typecheck`: pass
- `pnpm run lint`: fail due existing repository formatting drift reported by
  Biome (`93` diagnostics, not limited to clone files)
- `pnpm run test`: not run in this planning-only ADR pass
- `pnpm run build`: not run in this planning-only ADR pass

## Decision

Introduce a dedicated `ProfileCloneService` as the application boundary for
clone preview and execution.

The new service should own:

1. Clone preview semantics for `--dry-run`.
2. Clone execution semantics for real writes.
3. Conflict/overwrite calculation.
4. A stable result shape that the command can render in text or JSON without
   re-deriving domain facts.

Proposed API shape:

```ts
interface ClonePreview {
  sourceName: string;
  targetName: string;
  overwrite: boolean;
  profile: Profile;
}

interface CloneResult {
  sourceName: string;
  targetName: string;
  overwrite: boolean;
  profile: Profile;
}

class ProfileCloneService {
  async previewClone(
    sourceName: string,
    targetName: string,
  ): Promise<ClonePreview> {}

  async cloneProfile(
    sourceName: string,
    targetName: string,
    force: boolean,
  ): Promise<CloneResult> {}
}
```

Command-layer responsibilities after refactor:

- parse CLI options;
- resolve output mode;
- call `previewClone()` or `cloneProfile()`;
- render the returned result;
- translate expected domain errors into user-facing failure output.

Non-goals for this ADR:

- redesign all command error handling;
- introduce `--json-envelope` for clone in the same change;
- change the existing user-visible clone payload unless required for
  consistency.

## Alternatives Considered

1. Keep `clone/action.ts` as-is and only factor private helper functions.
- Pros: low immediate cost.
- Cons: reduces file length but does not fix ownership; preview logic remains in
  the command layer.

2. Move preview helpers into `ProfileService`.
- Pros: avoids creating a new service.
- Cons: pushes more application-flow concerns into a general-purpose service
  that is already broad; it also does not model clone-specific results clearly.

3. Introduce a generic command/result framework for all profile commands first.
- Pros: higher consistency in the long term.
- Cons: scope is too large for this issue and would delay a focused cleanup.

## Consequences

Positive:

- Clone semantics live in one place instead of being split between command and
  service layers.
- Dry-run and real-run can share the same source of truth for overwrite and
  profile projection.
- `src/commands/clone/action.ts` becomes smaller and easier to extend.
- Future output modes can depend on structured clone results instead of
  re-fetching or re-deriving data in the command.

Negative / trade-offs:

- Adds one more application service to the codebase.
- Some duplication may remain across commands until other command actions adopt
  the same result-oriented pattern.

Risks:

- If preview and execute paths diverge inside the new service, the refactor only
  moves the smell instead of removing it.
- Existing uncommitted clone changes in the working tree will need careful
  merge discipline during implementation.

## Rollout Plan

1. Add `src/core/profile-clone-service.ts` with `previewClone()` and
   `cloneProfile()` result types.
2. Keep validation inside the service by delegating shared write rules to
   `ProfileService` where appropriate.
3. Refactor
   [`src/commands/clone/action.ts`](/Users/jerry/code/me/gitface/src/commands/clone/action.ts)
   to call the new service and remove direct `getProfile()` / `findProfile()`
   orchestration from the command.
4. Add a small output-mode helper in clone action if needed to flatten repeated
   `if (options.json)` branching.
5. Preserve current text and JSON payload contracts unless a separate ADR
   explicitly changes them.
6. Add or update tests for:
   - dry-run success;
   - dry-run conflict;
   - real clone success;
   - source-not-found failure;
   - target-exists failure with and without `--force`.
7. Run `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, and
   `pnpm run build` once the implementation is complete.

## Test Plan

- Unit or focused integration tests for `ProfileCloneService`:
  - preview returns source-derived profile data;
  - preview reports `overwrite` when target exists;
  - execute clones the profile correctly;
  - execute respects `force`.
- Command-level regression tests:
  - text dry-run output still reports source, target, and overwrite state;
  - JSON success/failure payloads stay backward compatible;
  - exit code remains `1` for expected clone failures.

## Observability

No new telemetry is required for the refactor itself. Existing command logs
should continue to show:

- clone start/completion;
- expected domain failures;
- unexpected errors that escape the command action.

If clone later adopts a result envelope, the new service boundary should make it
straightforward to attach operation codes without reworking clone semantics
again.

## Open Questions

1. Should `ProfileCloneService` expose separate `previewClone()` and
   `cloneProfile()` methods, or one `executeClone({ dryRun, force })` API with a
   discriminated result?
2. Should clone adopt the same `OutputMode` helper pattern already used by
   `remove`, `rename`, and `import` in the same refactor, or keep that as a
   follow-up cleanup?
3. After clone is extracted, should `new` and `edit` receive the same treatment
   so profile lifecycle commands share one architectural pattern?
