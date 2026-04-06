# ADR-20260228: Make `doctor` global-identity check scope-correct

## Context

`gitface doctor` currently reports a check named "Global Git identity is set".
In `src/commands/doctor/action.ts`, that check uses `simple-git` `getConfig`
without forcing global scope, so values from repository/local config can be
mistakenly treated as global.

User-facing impact:

- False positives: users can see a passing "global identity" check even when
  `~/.gitconfig` (or `GIT_CONFIG_GLOBAL`) has no identity.
- Lower trust in diagnostics, especially for onboarding and CI scripts that use
  `doctor --json` as a gate.

Baseline (local run, 2026-02-28):

- `pnpm run lint`: pass
- `pnpm run typecheck`: pass
- `pnpm run test`: pass (`61` tests)
- `pnpm run build`: pass (`dist/index.js 86,206 bytes`, gzip `18,444 bytes`)
- Coverage snapshot: lines `79.28%`, branches `62.01%`
- Pain point: `doctor` check semantics and implementation are inconsistent for
  global scope.

Repo structure, README/docs, ADR history, CI workflows, and recent commits were
reviewed. Hosted issue/PR status is not accessible from this sandbox.

## Decision

Refactor `doctor` to read identity through `GitService.getScopedIdentity("global")`
instead of unscoped `simple-git` config reads.

MVP scope:

1. Update `checkGlobalConfig` in `src/commands/doctor/action.ts` to use
   `GitService` with explicit `global` scope.
2. Keep existing output contract (`pass`/`warn`/`fail`, JSON schema) unchanged.
3. Add E2E tests that prove local-only identity no longer passes global check,
   and global-config identity still passes.
4. Update README and CLI reference to document that `doctor` reads global scope
   explicitly for this check.

## Alternatives Considered

1. Keep existing implementation
- Pros: no code changes.
- Cons: ongoing false positives and unreliable diagnostics.

2. Rename check to "Git identity is set" (scope-agnostic)
- Pros: aligns wording with current behavior.
- Cons: removes valuable signal about global setup and keeps ambiguity.

3. Add a separate local + global pair of checks immediately
- Pros: richer visibility.
- Cons: larger scope for this round; would alter output payload shape and test
  expectations.

## Consequences

Positive:

- Diagnostic meaning matches implementation for global identity.
- Reduces setup confusion and hidden misconfiguration.
- Improves confidence for automation that parses `doctor --json`.

Negative / trade-offs:

- Slightly more coupling between `doctor` and core Git abstraction.
- Existing tests that implicitly depended on local fallback behavior need
  updates.

Risks:

- Environments with unusual global config permissions could produce `fail`
  where they previously produced `warn`/`pass`; this is more accurate but may
  reveal latent environment issues.

Migration / rollback:

- No data migration.
- Rollback is a simple revert of `doctor` check implementation/tests.

## Rollout Plan

1. Add/adjust E2E tests for explicit global-scope behavior.
2. Refactor doctor check to use `GitService` global scope.
3. Update README and `docs/cli.md` semantics.
4. Run lint/typecheck/test/build.
5. Ship in a single backward-compatible patch.

Feature flag / config:

- Not required; output schema and command signature remain stable.

Rollback strategy:

- Revert doctor check refactor + accompanying test/doc changes.

## Test Plan

- E2E:
  - local-only repo identity should yield global-identity `warn` (not `pass`).
  - explicit global identity should yield `pass` and include expected values.
  - `doctor --json` payload remains parseable and stable.
- Regression suite:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

- Continue using current doctor check payload (`checks[]`, `hasFailures`) so
  existing parsing remains valid.
- Key indicator for this change: number of false-positive "global identity set"
  reports should drop to zero in local-only setups.
- Validation signal is encoded in new E2E assertions.

## Security/Privacy

- No new external IO or secrets usage.
- Reads only Git config through existing local CLI calls.
- No changes to profile data model or on-disk schema.

## Open Questions

- Next round: should `doctor` add a separate explicit local identity check to
  surface scope precedence more clearly without requiring manual `git config`
  commands?
