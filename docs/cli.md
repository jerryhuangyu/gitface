# CLI Reference

Need a task-oriented walkthrough first? See [GitFace 使用者手冊（繁體中文）](./user-manual.zh-TW.md).

Each command inherits global flags from Commander (`--help`, `--version`). Unless stated, commands exit with status code `0` on success and `1` on validation or runtime errors.

Profile names are validated across commands and storage paths: names must be
non-empty and must not contain path separators (`/`, `\`), NUL, or reserved
dot segments (`.`/`..`).

## `gitface new <name>`

- **Purpose** – create or overwrite a stored Git identity.
- **Interactive mode** – `gitface new work` opens an Ink wizard that:
  - pre-fills fields from an existing profile with the same name (if present),
  - validates required fields with `zod`,
  - saves the profile after the last step.
- **Non-interactive mode** – provide any of the following flags to skip the wizard:
  - `--git-name <value>` / `-n`
  - `--email <value>` / `-e`
  - `--signing-key <value>` / `-s`
  - `--force` overwrites an existing profile without prompting
- `--dry-run` previews the final profile payload without writing profile files.
- `--json` emits machine-readable output in non-interactive mode:
  `{ "status": "created", "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `--dry-run --json` emits machine-readable preview output:
  `{ "status": "dry-run", "name": "work", "overwrite": false, "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `--json` without non-interactive field flags returns:
  `{ "status": "error", "name": "work", "reason": "Non-interactive flags are required when using --json output mode." }` with exit code `1`.
- Non-interactive paths avoid loading Ink UI modules until interactive mode is needed.
- **Fallbacks** – missing `--git-name` or `--email` values pick up the current Git identity. Missing signing keys default to `null`.

## `gitface edit <name>`

- Launches an Ink interface that lets you update individual fields and toggle signing-key storage.
- Flags (`--git-name`, `--email`, `--signing-key`, `--unset-signing-key`) bypass the UI and perform immediate updates.
- `--dry-run` previews the final edited profile fields without modifying files.
- `--json` emits machine-readable output in non-interactive mode:
  `{ "status": "updated", "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `--dry-run --json` emits machine-readable preview output:
  `{ "status": "dry-run", "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `--json` without non-interactive field flags returns:
  `{ "status": "error", "name": "work", "reason": "Non-interactive flags are required when using --json output mode." }` with exit code `1`.
- Non-interactive paths avoid loading Ink UI modules until interactive mode is needed.
- Emits a friendly message if the profile does not exist, reminding the user to `gitface list`.

## `gitface clone <source-name> <target-name>`

- Clones an existing profile to a new profile name.
- `--force` allows overwriting an existing target profile.
- `--dry-run` previews clone metadata without modifying profile files.
- `--json` emits machine-readable output:
  `{ "status": "cloned", "sourceName": "source", "name": "target", "gitName": "Source User", "email": "source@example.com", "signingKey": null }`.
- `--dry-run --json` emits machine-readable preview output:
  `{ "status": "dry-run", "sourceName": "source", "targetName": "target", "overwrite": false, "gitName": "Source User", "email": "source@example.com", "signingKey": null }`.
- JSON failures return:
  `{ "status": "error", "sourceName": "source", "targetName": "target", "reason": "..." }` with exit code `1`.
- When source profile is missing, failure text appends up to 3 suggestions (for example `Did you mean 'work', 'work-admin'?`).

## `gitface rename <old-name> <new-name>`

- Alias: `gitface mv <old-name> <new-name>`.
- Renames an existing profile while keeping identity fields (`gitName`, `email`, `signingKey`) unchanged.
- Automatically migrates existing folder rules that reference `<old-name>` to `<new-name>`.
- `--force` allows overwriting an existing target profile.
- `--dry-run` previews rename metadata without modifying profile files.
- `--json` emits machine-readable output:
  `{ "status": "renamed", "oldName": "old", "name": "new", "rulesUpdated": 2, "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `--dry-run --json` emits machine-readable preview output:
  `{ "status": "dry-run", "oldName": "old", "newName": "new", "overwrite": false, "rulesToUpdate": 2, "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- JSON failures return:
  `{ "status": "error", "oldName": "old", "newName": "new", "reason": "..." }` with exit code `1`.
- When source profile is missing, failure text appends up to 3 suggestions.

## `gitface list`

- Fetches all profile snapshots, sorts them by `updatedAt`, and renders a table using box-drawing characters for clarity.
- `--query <text>` / `-q` filters by case-insensitive profile-name substring matching.
- `--limit <number>` caps returned rows after sorting/filtering (must be a positive integer).
- Empty states display guidance text instead of an empty table.
- Useful before CI runs to confirm the workspace is pre-seeded.
- Non-JSON mode auto-detects non-TTY stdout and falls back to deterministic plain-text output (script/log friendly).
- `gitface list --json` emits a machine-readable JSON array:
  `[{ "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null, "createdAt": "...", "updatedAt": "..." }]`.

## `gitface use <name>`

- Applies a profile to Git configuration using `simple-git addConfig`.
- Running `gitface use` without `<name>` resolves candidate profiles first, then:
  - `0` candidates: fails with guidance.
  - `1` candidate: auto-applies without opening UI.
  - `2+` candidates on TTY: opens an interactive selector for those candidates.
  - `2+` candidates on non-TTY: fails and asks for explicit `<name>`.
- Options:
  - `--scope <local|global|system>` / `-s` (defaults to `local`).
  - `--query <text>` / `-q` filters candidates by case-insensitive profile-name substring matching when `<name>` is omitted.
  - `--dry-run` previews planned writes/unsets for the target scope without mutating Git config.
- `--json` emits machine-readable output:
  `{ "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null, "scope": "local" }`.
- `--dry-run --json` emits a machine-readable change plan:
  `{ "status": "dry-run", "scope": "local", "hasChanges": true, "profile": { "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }, "current": { "gitName": "Current User", "email": "current@example.com", "signingKey": null }, "changes": [{ "key": "user.name", "action": "set", "before": "Current User", "after": "Work User" }] }`.
- Scoped reads for dry-run/no-op planning use one `git config --list` snapshot
  when available, with safe per-key fallback if listing fails.
- When the selected profile already matches the target scope, `use --json`
  returns:
  `{ "status": "unchanged", "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null, "scope": "local", "changes": [] }`.
- Dry-run output only lists effective changes; unchanged keys are omitted.
- When `<name>` is provided (including JSON mode), GitFace avoids loading the interactive selector UI.
- If no profiles exist in interactive mode, GitFace exits with code `1` and
  prints guidance to create one via `gitface new <name>`.
- If `--query` matches multiple profiles in non-TTY mode, GitFace exits with code `1` and asks for explicit `gitface use <name>`.
- Successful runs log the applied values so you can double-check before committing.
- Invalid scopes short-circuit the command with an error banner and status `1`.
- Missing-profile failures include best-effort suggestions to help recovery without leaving the command.

## `gitface current`

- Shows the identity resolved by Git in the active working directory (respects scope precedence).
- Helpful as a pre-push check or for debugging environment setup scripts.
- `--scope <local|global|system>` reads only that scope.
- Scoped reads use a single `git config --list` pass and map identity keys from
  that snapshot (with per-key fallback on list failures).
- `gitface current --json` emits machine-readable output:
  `{ "gitName": "Work User", "email": "work@example.com", "signingKey": "ABC123" }`.
- `gitface current --scope global --json` emits:
  `{ "gitName": "Work User", "email": "work@example.com", "signingKey": "ABC123", "scope": "global" }`.
- Invalid scopes return JSON with exit code `1` in JSON mode:
  `{ "status": "error", "reason": "Scope must be one of: local, global, system." }`.

## `gitface doctor`

- Runs health checks for common setup issues (Git availability, profile store access, global identity hints).
- Human mode prints pass/warn/fail lines plus a summary.
- `--strict` treats warnings as failures for automation/CI pipelines.
- The global identity check reads `user.name` and `user.email` from explicit
  global scope (`git config --global`) instead of local repository scope.
- `gitface doctor --json` emits machine-readable output:
  `{ "checks": [{ "status": "pass", "message": "..." }], "hasFailures": false, "hasWarnings": false }`.
- Exit behavior:
  - default mode: exit code `1` when any check fails.
  - strict mode: exit code `1` when any check fails or warns.

## `gitface export [file]`

- Exports all saved profile snapshots as JSON.
- When `file` is omitted, JSON is printed to stdout (useful for pipes/backups).
- When `file` is provided, GitFace writes a prettified JSON array to disk and
  prints a success summary.
- `--json` emits machine-readable output:
  - stdout mode: `{ "status": "exported", "count": 2, "profiles": [{ "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null, "createdAt": "...", "updatedAt": "..." }] }`
  - file mode: `{ "status": "exported", "count": 2, "file": "./profiles.json" }`
- JSON failures return:
  `{ "status": "error", "reason": "..." }` (and include `file` when provided) with exit code `1`.

## `gitface import <file>`

- Imports profile snapshots from a JSON array file.
- `--overwrite` replaces existing profile names instead of skipping them.
- `--dry-run` validates payload/duplicates and reports outcomes without writing
  any profile files.
- `--json` emits machine-readable import results:
  `{ "dryRun": false, "total": 2, "imported": 1, "failed": 1, "results": [{ "name": "work", "status": "failed", "message": "Profile already exists. Use --overwrite to replace." }] }`.
- Import continues entry-by-entry: one bad profile does not stop the entire run.

## `gitface rm <name>`

- Alias: `gitface remove <name>`.
- Deletes the JSON file for a profile and echoes the removed values.
- `--dry-run` previews which profile would be removed and does not delete files.
- `--force` turns missing-profile errors into informational messages, making it safe to run in automation loops.
- `--json` emits machine-readable output:
  `{ "status": "removed", "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `--dry-run --json` emits machine-readable preview output:
  `{ "status": "dry-run", "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- Missing-profile failures (except `--force`) append best-effort suggestions in the `reason` message.

## `gitface rules <subcommand>`

- Manage folder-based profile rules through:
  - `gitface rules add <directory> <profile>`
  - `gitface rules remove <directory>`
  - `gitface rules resolve [directory]`
  - `gitface rules apply [directory]`
  - `gitface rules doctor`
  - `gitface rules prune`
  - `gitface rules list` (human-readable)
- `rules add/remove --dry-run` previews mutation results without changing global Git config.
- `gitface rules list --query <text>` filters by case-insensitive substring
  match on `directory` and `profileName`.
- `gitface rules list --limit <number>` caps result rows (must be a positive integer).
- Rules are rendered in deterministic `directory` ascending order before query/limit.
- `gitface rules add <directory> <profile> --json` emits:
  `{ "status": "added", "directory": "/abs/path/", "profileName": "work" }`.
- `gitface rules add <directory> <profile> --dry-run --json` emits:
  `{ "status": "dry-run", "directory": "/abs/path/", "profileName": "work", "overwrite": false }`.
- `gitface rules add <directory> <profile> --json` failures emit:
  `{ "status": "error", "directory": "/abs/path/", "profileName": "work", "reason": "..." }` with exit code `1`.
- Missing-profile failures append best-effort profile suggestions in `reason`.
- `gitface rules remove <directory> --json` emits:
  `{ "status": "removed", "directory": "/abs/path/" }`.
- `gitface rules remove <directory> --dry-run --json` emits:
  `{ "status": "dry-run", "directory": "/abs/path/", "exists": true }`.
- `gitface rules remove <directory> --json` failures emit:
  `{ "status": "error", "directory": "/abs/path/", "reason": "..." }` with exit code `1`.
- `gitface rules list --json` emits a machine-readable JSON array:
  `[{ "directory": "/abs/path/", "profileName": "work" }]`.
- `gitface rules list --query work --limit 2 --json` applies filter + cap and
  returns the same JSON object shape.
- `gitface rules resolve [directory]` resolves the most specific matching
  directory rule (longest prefix wins). `directory` defaults to current working
  directory.
- `gitface rules resolve [directory] --json` emits:
  `{ "status": "matched", "directory": "/abs/path/repo/", "matchedRule": { "directory": "/abs/path/", "profileName": "work" }, "profileExists": true }`.
- `gitface rules resolve [directory] --strict` treats unmatched results and
  missing matched profiles (`profileExists: false`) as failures (`exit code 1`)
  while keeping the same output shape.
- No-match output remains successful and emits:
  `{ "status": "unmatched", "directory": "/abs/path/repo/", "matchedRule": null, "profileExists": null }`.
- `gitface rules apply [directory]` resolves the most specific matching rule and
  applies the matched profile to Git config in one step. `directory` defaults
  to current working directory.
- Local-scope apply targets the resolved `directory` directly and does not
  change the caller process working directory.
- `gitface rules apply [directory] --scope <local|global|system>` controls
  target scope (`local` default).
- `gitface rules apply [directory] --fallback-profile <name>` applies the
  named profile when no folder rule matches.
- `gitface rules apply [directory] --dry-run` previews planned writes/unsets and
  does not mutate Git config.
- `gitface rules apply [directory] --json` emits:
  `{ "status": "applied", "directory": "/abs/path/repo/", "scope": "local", "matchedRule": { "directory": "/abs/path/", "profileName": "work" }, "profile": { "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null } }`.
- `gitface rules apply [directory] --dry-run --json` emits:
  `{ "status": "dry-run", "directory": "/abs/path/repo/", "scope": "local", "matchedRule": { "directory": "/abs/path/", "profileName": "work" }, "profile": { "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }, "current": { "gitName": "Current User", "email": "current@example.com", "signingKey": null }, "hasChanges": true, "changes": [{ "key": "user.name", "action": "set", "before": "Current User", "after": "Work User" }] }`.
- `gitface rules apply [directory] --json` when no rule matches emits:
  `{ "status": "unmatched", "directory": "/abs/path/repo/", "scope": "local", "matchedRule": null }`.
- `gitface rules apply [directory] --fallback-profile work --json` when no rule
  matches emits:
  `{ "status": "applied", "resolution": "fallback", "directory": "/abs/path/repo/", "scope": "local", "matchedRule": null, "fallbackProfileName": "work", "profile": { "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null } }`.
- `gitface rules apply [directory] --strict` treats unmatched results as
  failures (`exit code 1`) for CI gating.
- `gitface rules doctor` checks all folder rules for stale profile references
  and missing directories.
- `gitface rules doctor --json` emits:
  `{ "status": "issues", "strict": false, "summary": { "total": 2, "pass": 1, "warn": 1, "fail": 0 }, "results": [{ "directory": "/abs/path/", "profileName": "work", "status": "warn", "profileExists": true, "directoryExists": false }] }`.
- `gitface rules doctor --strict` treats `warn` and `fail` as failures (exit code `1`) for CI gating.
- `gitface rules doctor --concurrency <number>` limits concurrent integrity checks (default `8`; positive integer only).
- `gitface rules prune --dry-run` scans stale rules (missing profile only) without mutating global config.
- `gitface rules prune --dry-run --include-missing-directory` additionally scans rules whose target directory no longer exists.
- `gitface rules prune --strict` enables CI gating:
  - dry-run mode fails (`exit code 1`) when `summary.prunable > 0`.
  - apply mode fails (`exit code 1`) when `summary.skipped > 0`.
- `gitface rules prune --concurrency <number>` limits concurrent integrity checks (default `8`; positive integer only).
- `gitface rules prune --dry-run --json` emits:
  `{ "status": "dry-run", "dryRun": true, "strict": false, "summary": { "scanned": 3, "prunable": 1, "pruned": 0, "skipped": 0 }, "results": [{ "directory": "/abs/path/stale/", "profileName": "old-profile", "profileExists": false, "status": "candidate" }] }`.
- `gitface rules prune --dry-run --strict --json` emits:
  `{ "status": "dry-run", "dryRun": true, "strict": true, "summary": { "scanned": 3, "prunable": 1, "pruned": 0, "skipped": 0 }, "results": [{ "directory": "/abs/path/stale/", "profileName": "old-profile", "profileExists": false, "status": "candidate" }] }` and exits with code `1`.
- `gitface rules prune --dry-run --include-missing-directory --json` may emit:
  `{ "status": "dry-run", "dryRun": true, "strict": false, "summary": { "scanned": 3, "prunable": 1, "pruned": 0, "skipped": 0 }, "results": [{ "directory": "/abs/path/deleted/", "profileName": "work", "profileExists": true, "directoryExists": false, "staleReason": "missing-directory", "status": "candidate" }] }`.
- `gitface rules prune --json` removes stale rules and emits:
  `{ "status": "pruned", "dryRun": false, "strict": false, "summary": { "scanned": 3, "prunable": 1, "pruned": 1, "skipped": 0 }, "results": [{ "directory": "/abs/path/stale/", "profileName": "old-profile", "profileExists": false, "status": "pruned" }] }`.
- Empty JSON output is `[]`, which is safe for CI/script parsing.

## `gitface completion <topic>`

- Internal helper used by shell snippets.
- `gitface completion profiles --prefix <value>` emits newline-delimited profile
  names filtered by case-insensitive prefix.
- `gitface completion profiles --prefix <value> --limit <number>` caps returned
  suggestions to a positive integer.
- `gitface completion profiles --json` emits machine-readable output:
  `{ "topic": "profiles", "prefix": "wo", "limit": 5, "count": 1, "names": ["work-admin"] }`.
- `--json` mode always prints valid JSON (including no-match case as
  `{ "topic": "profiles", "prefix": "none", "limit": null, "count": 0, "names": [] }`).
- Completion suggestions are derived from local profile filenames (name index),
  so unrelated malformed profile JSON content does not block completion output.
- `gitface completion snippet --shell <bash|zsh>` prints a shell script that
  completes source-profile arguments for:
  - `use`
  - `rm` / `remove`
  - `edit`
  - `clone` (source argument only)
  - `rename` / `mv` (source argument only)
  - `rules add` (profile argument only)

## Exit Codes & Troubleshooting

- Profile validation failures (`InvalidProfileError`) set `process.exitCode = 1`.
- Domain-specific messages bubble up as chalk-coloured ✖ lines.
- Unexpected errors surface their message; set `GITFACE_LOG_LEVEL=debug` (or `GITFACE_DEBUG=1`) to append stack traces.
