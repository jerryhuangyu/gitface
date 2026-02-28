# CLI Reference

Each command inherits global flags from Commander (`--help`, `--version`). Unless stated, commands exit with status code `0` on success and `1` on validation or runtime errors.

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
- **Fallbacks** – missing `--git-name` or `--email` values pick up the current Git identity. Missing signing keys default to `null`.

## `gitface edit <name>`

- Launches an Ink interface that lets you update individual fields and toggle signing-key storage.
- Flags (`--git-name`, `--email`, `--signing-key`, `--unset-signing-key`) bypass the UI and perform immediate updates.
- Emits a friendly message if the profile does not exist, reminding the user to `gitface list`.

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
- `gitface list --json` emits a machine-readable JSON array:
  `[{ "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null, "createdAt": "...", "updatedAt": "..." }]`.

## `gitface use <name>`

- Applies a profile to Git configuration using `simple-git addConfig`.
- Options:
  - `--scope <local|global|system>` / `-s` (defaults to `local`).
- `--json` emits machine-readable output:
  `{ "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null, "scope": "local" }`.
- Successful runs log the applied values so you can double-check before committing.
- Invalid scopes short-circuit the command with an error banner and status `1`.

## `gitface current`

- Shows the identity resolved by Git in the active working directory (respects scope precedence).
- Helpful as a pre-push check or for debugging environment setup scripts.
- `gitface current --json` emits machine-readable output:
  `{ "gitName": "Work User", "email": "work@example.com", "signingKey": "ABC123" }`.

## `gitface doctor`

- Runs health checks for common setup issues (Git availability, profile store access, global identity hints).
- Human mode prints pass/warn/fail lines plus a summary.
- `gitface doctor --json` emits machine-readable output:
  `{ "checks": [{ "status": "pass", "message": "..." }], "hasFailures": false }`.
- Exit behavior is unchanged: if any check fails, command exit code is `1`.

## `gitface export [file]`

- Exports all saved profile snapshots as JSON.
- When `file` is omitted, JSON is printed to stdout (useful for pipes/backups).
- When `file` is provided, GitFace writes a prettified JSON array to disk and
  prints a success summary.

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
- `gitface rules list --json` emits a machine-readable JSON array:
  `[{ "directory": "/abs/path/", "profileName": "work" }]`.
- Empty JSON output is `[]`, which is safe for CI/script parsing.

## Exit Codes & Troubleshooting

- Profile validation failures (`InvalidProfileError`) set `process.exitCode = 1`.
- Domain-specific messages bubble up as chalk-coloured ✖ lines.
- Unexpected errors surface their message; set `GITFACE_LOG_LEVEL=debug` (or `GITFACE_DEBUG=1`) to append stack traces.
