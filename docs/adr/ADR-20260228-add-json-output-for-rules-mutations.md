# ADR-20260228: Add JSON output for `rules add/remove` and align rules command handling

## Context

GitFace has standardized machine-readable `--json` output for most profile-centric commands (`use`, `list`, `clone`, `rename`, `remove`, `import`, `export`, `doctor`, `current`). However, the folder-rules workflow is inconsistent:

- `gitface rules list --json` exists, but `rules add` and `rules remove` only emit human text.
- automation scripts cannot reliably parse success/failure metadata for rule mutations.
- `rules` command files still use direct `process.exit(1)` and inline `console` formatting instead of the shared command handling style used by newer commands.

Baseline from this run:

- `pnpm run lint`: pass.
- `pnpm run typecheck`: pass.
- `pnpm run test`: pass (42 tests).
- `pnpm run build`: pass.
- Coverage hotspots in rules command files remain low (`src/commands/rules` statements ~50%, branch ~16.66%).

User/ops pain point:

- CI or bootstrap scripts that set or remove folder rules must parse colored human output and cannot distinguish status types safely.
- Error handling behavior for rules commands is less consistent than other commands, increasing maintenance overhead.

## Decision

Implement an MVP that adds structured output for rules mutations and unifies command-layer behavior:

1. Add `--json` option to `gitface rules add <directory> <profile>` and `gitface rules remove <directory>`.
2. Emit compact machine-readable payloads:
   - `rules add --json` success: `{ "status": "added", "directory": "...", "profileName": "..." }`
   - `rules remove --json` success: `{ "status": "removed", "directory": "..." }`
   - failures: `{ "status": "error", ... , "reason": "..." }` with exit code `1`.
3. Refactor rules command actions to use `withCommandHandling` and dedicated UI helpers (separate human and JSON renderers).
4. Add/extend e2e tests for the new JSON contracts and failure path.
5. Update README and CLI docs with the new options and response shapes.

## Alternatives Considered

1. Keep human-only output for `rules add/remove`.
   - Pros: no code changes.
   - Cons: keeps automation gap and inconsistent CLI contract; rejected.

2. Add a separate command such as `rules mutate --json` for scripts.
   - Pros: avoids changing existing subcommands.
   - Cons: API surface grows, duplicates logic, and worsens discoverability; rejected.

3. Add JSON only for success, keep text errors.
   - Pros: minimal implementation.
   - Cons: still not machine-reliable for failure handling; rejected.

## Consequences

Positive:

- Improves automation reliability for rule management workflows.
- Aligns CLI behavior with the rest of GitFace JSON-capable commands.
- Raises test coverage for currently weak rules command paths.

Negative / Risks:

- Additional command options increase CLI surface slightly.
- JSON schema is now a compatibility contract and must be preserved.

Migration and rollback:

- Backward compatible: default human output unchanged unless `--json` is provided.
- Rollback path: remove `--json` flags and UI helpers from rules commands; no data migration needed.

Maintenance cost:

- Low: follows existing command/UI pattern already used by other commands.

## Rollout Plan

1. Phase 1 (this PR): add `--json` flags, action logic, tests, and docs.
2. Phase 2 (future): evaluate adding `--json` for any remaining commands lacking machine output parity.
3. Guardrails:
   - Keep existing human output untouched.
   - Set `process.exitCode = 1` on all JSON failure paths.
4. Rollback strategy:
   - Revert this commit if downstream scripts detect schema mismatch.

## Test Plan

- Unit/command-level behavior covered via e2e command tests:
  - `rules add --json` returns `status=added` payload.
  - `rules remove --json` returns `status=removed` payload.
  - `rules add --json` with missing profile returns `status=error` and non-zero exit code.
- Regression:
  - existing rules add/remove/list human behavior continues to pass.
- Full gate:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

- Continue structured logger events from `RuleService` operations.
- Add deterministic JSON command payloads for script-level observability.
- Key indicators:
  - % of automation scripts using `rules add/remove --json` (if measured externally).
  - command failure parsing errors in CI logs (expected to decrease).

## Security / Privacy

- No new sensitive data introduced.
- JSON output includes only directory path and profile name already visible in human output.
- No changes to permission scope (still relies on git global config writes by existing command).

## Open Questions

1. Should `rules list --json` remain pretty-printed while add/remove use compact JSON, or should all JSON outputs be normalized to one style?
2. Should future `rules add/remove` JSON include timestamp metadata for auditing?
