# ADR-20260228: Expand shell completion coverage for profile-based commands

## Context

GitFace already supports shell snippet generation via:

- `gitface completion profiles`
- `gitface completion snippet --shell <bash|zsh>`

But current snippet behavior only autocompletes profile names for `use`, `rm`, and
`remove`. This causes UX friction and command inconsistency:

- `edit <name>`, `clone <source> <target>`, `rename/mv <old> <new>` all consume
  profile names but have no completion support.
- Users must remember exact names for these commands, increasing typo retries.
- `completion` command help text still says `profiles|rm|remove`, while runtime
  only accepts `profiles`, causing misleading CLI guidance.

Baseline measured in this run (2026-02-28 UTC):

- `pnpm run lint`: pass (`real 0.38s`)
- `pnpm run typecheck`: pass (`real 0.76s`)
- `pnpm run test`: pass (`38 tests`, `real 1.81s`)
- `pnpm run build`: pass (`dist/index.js 68.57 kB`, gzip `15.30 kB`, `real 0.94s`)
- Coverage hotspots remain in completion module (`src/commands/completion`), indicating missing regression tests for completion UX contracts.

Repo/CI context note:

- Local repository structure, ADRs, workflow files, and recent commits were reviewed.
- Remote issue/PR/CI run details are not queryable from this sandbox.

## Decision

Deliver an additive UX + reliability MVP for shell completion.

1. Expand profile-name completion coverage in generated snippets:
- Keep existing completion for `use`, `rm`, `remove`.
- Add completion for `edit` first argument.
- Add completion for `clone`, `rename`, and `mv` source argument only.

2. Avoid over-completing target names:
- For `clone`/`rename`/`mv`, only complete when cursor is on the source profile
  argument position, not the target position.

3. Correct command metadata:
- Update `gitface completion <topic>` argument help text to reflect supported
  topic (`profiles`) and remove stale references.

4. Add e2e coverage for completion behavior:
- `completion profiles --prefix` filtering contract.
- unsupported topic exit behavior.
- snippet content assertions for bash and zsh command/position guards.

This is backward compatible and keeps the existing internal completion protocol.

## Alternatives Considered

1. Keep current completion scope (`use/rm/remove`) only.
- Pros: zero implementation effort.
- Cons: ongoing UX inconsistency and unnecessary typing errors.

2. Implement dynamic completion for all argument positions.
- Pros: broad coverage.
- Cons: higher complexity and risk of suggesting invalid targets for rename/clone.

3. Replace shell snippets with external completion framework/tooling.
- Pros: potentially richer shell integration.
- Cons: larger dependency and maintenance surface; exceeds MVP scope.

## Consequences

Positive:

- Improves command discoverability and typing speed in common profile workflows.
- Reduces user error rate for profile-name commands by surfacing exact names.
- Adds tests for currently under-covered completion paths.

Negative / trade-offs:

- Slightly larger snippet logic for shell-specific positional checks.
- Completion behavior remains shell-snippet-based (no runtime capability discovery).

Risks:

- Positional assumptions (`CURRENT`/`COMP_CWORD`) may vary with advanced shell setups.

Migration / rollback:

- Migration: users can regenerate snippets using existing command.
- Rollback: revert snippet updates; previous behavior remains intact.

## Rollout Plan

1. Add e2e tests covering completion output and snippet guards.
2. Update snippet templates for bash/zsh with positional checks and new commands.
3. Update completion command help text.
4. Update README and CLI docs tab-completion guidance.
5. Run lint/typecheck/test/build quality gates.
6. If regressions appear, rollback by reverting this change set.

Feature flag / config:

- Not required; feature is additive and low-risk.

## Test Plan

- E2E:
  - `gitface completion profiles --prefix <prefix>` returns newline-delimited,
    filtered names.
  - `gitface completion <unsupported-topic>` sets exit code `1`.
  - `gitface completion snippet --shell bash` includes guarded completion for
    `use/rm/remove/edit/clone/rename/mv` at source-argument position.
  - `gitface completion snippet --shell zsh` includes equivalent guards.

- Regression / quality gates:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

Current project has no production telemetry backend; use these proxies:

- e2e pass/fail trend for completion command.
- downstream automation/shell setup reports about missing or incorrect completions.
- command exit code behavior for invalid completion topics.

## Security / Privacy

- No new network calls.
- Completion output exposes only local profile names already retrievable via
  existing local commands.
- No additional secret or PII collection.

## Open Questions

- Should future rounds add fish shell snippet support?
- Should completion topics expand beyond profiles (for rules or scopes) with
  a versioned completion protocol?
