# CLI Reference

Each command inherits global flags from Commander (`--help`, `--version`). Unless stated, commands exit with status code `0` on success and `1` on validation or runtime errors.

Profile names are validated across commands and storage paths: names must be
non-empty and must not contain path separators (`/`, `\`), NUL, or reserved
dot segments (`.`/`..`).

## `gitface new <name>`

- **Purpose** – create or overwrite a stored Git identity.
- **Interactive mode** – `gitface new work` opens an Ink wizard that:
  - seeds inputs from the current `git config` values,
  - validates required fields with `zod`,
  - saves the profile after the last step.
- **Non-interactive mode** – provide any of the following flags to skip the wizard:
  - `--git-name <value>` / `-n`
  - `--email <value>` / `-e`
  - `--signing-key <value>` / `-s`
  - `--force` overwrites an existing profile without prompting
- `--json` emits machine-readable output in non-interactive mode:
  `{ "status": "created", "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `--json` without non-interactive field flags returns:
  `{ "status": "error", "name": "work", "reason": "Non-interactive flags are required when using --json output mode." }` with exit code `1`.
- Non-interactive paths avoid loading Ink UI modules until interactive mode is needed.
- **Fallbacks** – missing `--git-name` or `--email` values pick up the current Git identity. Missing signing keys default to `null`.

## `gitface edit <name>`

- Launches an Ink interface that lets you update individual fields and toggle signing-key storage.
- Flags (`--git-name`, `--email`, `--signing-key`, `--unset-signing-key`) bypass the UI and perform immediate updates.
- `--json` emits machine-readable output in non-interactive mode:
  `{ "status": "updated", "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `--json` without non-interactive field flags returns:
  `{ "status": "error", "name": "work", "reason": "Non-interactive flags are required when using --json output mode." }` with exit code `1`.
- Non-interactive paths avoid loading Ink UI modules until interactive mode is needed.
- Emits a friendly message if the profile does not exist, reminding the user to `gitface list`.

## `gitface clone <source-name> <target-name>`

- Clones an existing profile to a new profile name.
- `--force` allows overwriting an existing target profile.
- `--json` emits machine-readable output:
  `{ "status": "cloned", "sourceName": "source", "name": "target", "gitName": "Source User", "email": "source@example.com", "signingKey": null }`.
- JSON failures return:
  `{ "status": "error", "sourceName": "source", "targetName": "target", "reason": "..." }` with exit code `1`.

## `gitface rename <old-name> <new-name>`

- Alias: `gitface mv <old-name> <new-name>`.
- Renames an existing profile while keeping identity fields (`gitName`, `email`, `signingKey`) unchanged.
- `--force` allows overwriting an existing target profile.
- `--json` emits machine-readable output:
  `{ "status": "renamed", "oldName": "old", "name": "new", "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- JSON failures return:
  `{ "status": "error", "oldName": "old", "newName": "new", "reason": "..." }` with exit code `1`.

## `gitface list`

- Fetches all profile snapshots, sorts them by `updatedAt`, and renders a table using box-drawing characters for clarity.
- Empty states display guidance text instead of an empty table.
- Useful before CI runs to confirm the workspace is pre-seeded.
- Non-interactive JSON mode lazy-loads the Ink table UI, avoiding unnecessary TUI startup work.
- `gitface list --json` emits a machine-readable JSON array:
  `[{ "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null, "createdAt": "...", "updatedAt": "..." }]`.

## `gitface use <name>`

- Applies a profile to Git configuration using `simple-git addConfig`.
- Running `gitface use` without `<name>` opens an interactive selector; after
  selection GitFace applies the chosen profile immediately.
- Options:
  - `--scope <local|global|system>` / `-s` (defaults to `local`).
  - `--dry-run` previews planned writes/unsets for the target scope without mutating Git config.
- `--json` emits machine-readable output:
  `{ "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null, "scope": "local" }`.
- `--dry-run --json` emits a machine-readable change plan:
  `{ "status": "dry-run", "scope": "local", "hasChanges": true, "profile": { "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }, "current": { "gitName": "Current User", "email": "current@example.com", "signingKey": null }, "changes": [{ "key": "user.name", "action": "set", "before": "Current User", "after": "Work User" }] }`.
- When the selected profile already matches the target scope, `use --json`
  returns:
  `{ "status": "unchanged", "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null, "scope": "local", "changes": [] }`.
- Dry-run output only lists effective changes; unchanged keys are omitted.
- When `<name>` is provided (including JSON mode), GitFace avoids loading the interactive selector UI.
- If no profiles exist in interactive mode, GitFace exits with code `1` and
  prints guidance to create one via `gitface new <name>`.
- Successful runs log the applied values so you can double-check before committing.
- Invalid scopes short-circuit the command with an error banner and status `1`.

## `gitface current`

- Shows the identity resolved by Git in the active working directory (respects scope precedence).
- Helpful as a pre-push check or for debugging environment setup scripts.
- `--scope <local|global|system>` reads only that scope.
- `gitface current --json` emits machine-readable output:
  `{ "gitName": "Work User", "email": "work@example.com", "signingKey": "ABC123" }`.
- `gitface current --scope global --json` emits:
  `{ "gitName": "Work User", "email": "work@example.com", "signingKey": "ABC123", "scope": "global" }`.
- Invalid scopes return JSON with exit code `1` in JSON mode:
  `{ "status": "error", "reason": "Scope must be one of: local, global, system." }`.

## `gitface doctor`

- Runs health checks for common setup issues (Git availability, profile store access, global identity hints).
- Human mode prints pass/warn/fail lines plus a summary.
- The global identity check reads `user.name` and `user.email` from explicit
  global scope (`git config --global`) instead of local repository scope.
- `gitface doctor --json` emits machine-readable output:
  `{ "checks": [{ "status": "pass", "message": "..." }], "hasFailures": false }`.
- Exit behavior is unchanged: if any check fails, command exit code is `1`.

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
- `--force` turns missing-profile errors into informational messages, making it safe to run in automation loops.
- `--json` emits machine-readable output:
  `{ "status": "removed", "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.

## `gitface rules <subcommand>`

- Manage folder-based profile rules through:
  - `gitface rules add <directory> <profile>`
  - `gitface rules remove <directory>`
  - `gitface rules list` (human-readable)
- `gitface rules add <directory> <profile> --json` emits:
  `{ "status": "added", "directory": "/abs/path/", "profileName": "work" }`.
- `gitface rules add <directory> <profile> --json` failures emit:
  `{ "status": "error", "directory": "/abs/path/", "profileName": "work", "reason": "..." }` with exit code `1`.
- `gitface rules remove <directory> --json` emits:
  `{ "status": "removed", "directory": "/abs/path/" }`.
- `gitface rules remove <directory> --json` failures emit:
  `{ "status": "error", "directory": "/abs/path/", "reason": "..." }` with exit code `1`.
- `gitface rules list --json` emits a machine-readable JSON array:
  `[{ "directory": "/abs/path/", "profileName": "work" }]`.
- Empty JSON output is `[]`, which is safe for CI/script parsing.

## `gitface completion <topic>`

- Internal helper used by shell snippets.
- `gitface completion profiles --prefix <value>` emits newline-delimited profile
  names filtered by prefix.
- `gitface completion snippet --shell <bash|zsh>` prints a shell script that
  completes source-profile arguments for:
  - `use`
  - `rm` / `remove`
  - `edit`
  - `clone` (source argument only)
  - `rename` / `mv` (source argument only)

## Exit Codes & Troubleshooting

- Profile validation failures (`InvalidProfileError`) set `process.exitCode = 1`.
- Domain-specific messages bubble up as chalk-coloured ✖ lines.
- Unexpected errors surface their message; set `GITFACE_LOG_LEVEL=debug` (or `GITFACE_DEBUG=1`) to append stack traces.
