# ADR-20260228: Add list query filtering and non-TTY plain output fallback

## Context

`gitface list` currently supports two modes:

- Human mode: always renders an Ink table UI.
- Machine mode: `--json` prints a JSON array.

This leaves two user pain points:

1. There is no built-in way to quickly filter profiles by name in large local stores.
2. Human mode still boots Ink in non-interactive contexts (for example, piping output), which adds startup overhead and can produce terminal-unfriendly output in automation logs.

Current baseline from this run:

- `pnpm run lint`: pass, total wall time around `0.27s`.
- `pnpm run typecheck`: pass, total wall time around `0.81s`.
- `pnpm run test`: pass (`63` tests), total wall time around `3.86s`.
- `pnpm run build`: pass, total wall time around `1.49s`, bundle `dist/index.js` about `86.84 kB` (`18.50 kB` gzip).
- Coverage: statements `79.01%`, branches `63.03%`, functions `86.44%`, lines `79.47%`.

## Decision

Implement an MVP enhancement for `gitface list`:

1. Add `--query <text>` to filter profiles by case-insensitive substring matching on profile name.
2. Apply the same filter behavior to both human mode and `--json` mode.
3. In non-JSON mode, auto-detect non-TTY stdout and render a deterministic plain-text list instead of Ink.
4. Keep existing sort order (`updatedAt` descending) before filtering and rendering.
5. Keep backward compatibility: when `--query` is omitted and output is interactive TTY, behavior remains the same.

## Alternatives Considered

1. Add a brand-new command (for example `gitface search`) instead of extending `list`.
   - Rejected: more command-surface complexity for a narrow use case.
2. Keep Ink always-on and only add `--query`.
   - Rejected: does not solve non-interactive UX/performance pain.
3. Add regex filtering and multi-field filters now.
   - Rejected: larger validation and UX complexity than needed for MVP.

## Consequences

Positive:

- Faster profile lookup in daily usage (`list --query work`).
- Better script/log friendliness for non-TTY output.
- Reduced unnecessary UI module cost in non-interactive list scenarios.

Negative / Risks:

- Output format in non-TTY human mode changes from Ink table to plain text.
- Users depending on old non-TTY formatting may need adjustments.

Migration / Compatibility:

- No breaking API changes for existing flags.
- `--json` output remains machine-readable array and backward compatible.

Maintenance cost:

- Small: one additional option path and a simple rendering helper.

## Rollout Plan

1. Add command option and list action plumbing.
2. Add filtering utility and non-TTY plain renderer.
3. Add/adjust e2e coverage for:
   - `--query` filtering in JSON mode.
   - plain-text fallback behavior in non-TTY mode.
4. Update README and CLI docs for the new option and fallback behavior.
5. Run lint/typecheck/test/build and verify no regressions.

Rollback strategy:

- Revert this commit to restore previous always-Ink list behavior and remove `--query`.

## Test Plan

- Unit-level behavior through existing command tests:
  - ensure `--json --query` only returns matching profiles.
  - ensure sort order remains `updatedAt desc` within filtered results.
- E2E-style behavior:
  - run CLI with non-TTY stdout and verify plain text output contains expected names.
- Regression gates:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run build`

## Observability

- CLI output is the primary observable channel for this command.
- Success signals:
  - expected filtered profile count in JSON output.
  - absence of Ink control output when stdout is non-TTY.
- Existing debug logging can still be enabled via `GITFACE_LOG_LEVEL=debug`.

## Security/Privacy

- No new external I/O, network, or credential handling.
- Filtering only operates on locally stored profile names already accessible to the current user.

## Open Questions

- Should future iterations support filtering by email/signing key and exact-match mode?
- Should we add an explicit `--plain` flag to force plain output even on TTY?
