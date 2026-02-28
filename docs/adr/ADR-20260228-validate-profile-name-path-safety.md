# ADR-20260228: Validate profile names for path-safe storage

## Context

GitFace currently uses profile names directly to build storage paths:

- `profiles/<name>.json`
- `identities/<name>.gitconfig`

There is no central validation on `name` before path construction. In this
run's local baseline, `gitface new ../escaped --git-name Esc --email esc@example.com`
successfully created files outside the intended `profiles/` and `identities/`
subdirectories, demonstrating a path traversal class risk.

Operationally and from UX/security perspectives, this leads to:

- unsafe write targets when malformed names are accepted;
- harder debugging when profile artifacts are not in expected folders;
- inconsistent error behavior across commands that rely on profile names.

Baseline for this run (2026-02-28, local):

- `pnpm run lint`: pass (`real 0.31s`)
- `pnpm run test`: pass (`54` tests, `real 4.17s`)
- `pnpm run build`: pass (`dist/index.js 83.06 kB`, gzip `17.82 kB`, `real 1.52s`)
- Coverage snapshot: lines `79.74%`, branches `61.83%`

Repository structure, README/docs, ADR history, local workflows, and recent
commits were reviewed. Remote issue/PR/hosted CI details are not directly
queryable in this sandbox.

## Decision

Implement an additive MVP that enforces path-safe profile names centrally:

1. Introduce domain-level profile name validation used by all profile
   lifecycle paths.
2. Reject invalid names with `InvalidProfileError` when names:
   - are empty/whitespace-only,
   - equal `.` or `..`,
   - contain `/`, `\\`, or NUL.
3. Apply validation in service/store/config-path access points so command
   handlers cannot bypass checks.
4. Preserve backward-compatible command contracts: invalid input remains exit
   code `1`; JSON-capable commands should continue producing structured errors.
5. Document the naming constraints in README and CLI reference.

## Alternatives Considered

1. Validate only in CLI command argument handlers
- Pros: small code delta.
- Cons: weak guarantees; programmatic/service paths and import flows can bypass
  protections.

2. Sanitize names automatically (replace forbidden characters)
- Pros: fewer hard failures.
- Cons: silent mutation surprises users, can cause collisions, and weakens
  deterministic automation behavior.

3. Keep current behavior and rely on user discipline
- Pros: zero implementation effort.
- Cons: leaves confirmed path traversal risk unresolved.

## Consequences

Positive:

- Blocks confirmed unsafe write paths.
- Improves consistency for all command/service/profile-store entry points.
- Makes profile storage location predictable for support and operations.

Negative / trade-offs:

- Some previously accepted edge-case names will now fail validation.
- Slightly more validation code in domain/service/store layers.

Risks:

- Existing users with legacy invalid names may need manual migration/rename.

Migration / rollback:

- No automatic migration in MVP.
- Rollback path: remove central validation and restore previous permissive
  behavior.

## Rollout Plan

1. Add failing tests for invalid names and path traversal attempts.
2. Implement centralized name validation and wire it into service/store/config
   path generation.
3. Ensure JSON and non-JSON command paths report deterministic failures.
4. Update README and CLI docs with naming constraints.
5. Run lint/test/build gates and verify no regression in existing command flows.

Feature flag / config:

- Not required for MVP.

## Test Plan

- Unit: invalid names are rejected by domain/service validation.
- E2E: CLI `new --json` rejects traversal names with structured error and exit
  code `1`.
- Regression: `pnpm run lint`, `pnpm run test`, `pnpm run build`.

## Observability

- Existing command error paths emit user-visible failures and non-zero exits.
- JSON mode exposes machine-readable error payloads for automation logs.
- Tests provide executable guardrails for path-safety behavior.

Key indicators:

- invalid-name attempts rejected (counted via scripted test assertions);
- no profile writes outside `profiles/` and `identities/` in regression tests.

## Security/Privacy

- Directly mitigates path traversal style writes in local storage paths.
- Does not add network calls, credentials, or PII handling.
- Maintains least-privilege local file writes within expected config folders.

## Open Questions

- Should a follow-up add an explicit `gitface doctor` check that reports legacy
  invalid profile filenames on disk and offers migration hints?
