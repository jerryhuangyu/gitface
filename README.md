![Gitface](https://raw.githubusercontent.com/jerryhuangyu/gitface/refs/heads/main/gif/demo.gif)

# [GitFace](https://github.com/jerryhuangyu/gitface) · [![npm version](https://img.shields.io/npm/v/gitface.svg?style=flat)](https://www.npmjs.com/package/gitface) [![npm total downloads](https://img.shields.io/npm/dt/gitface.svg?style=flat)](https://www.npmjs.com/package/gitface) [![Test](https://github.com/jerryhuangyu/gitface/actions/workflows/test.yml/badge.svg)](https://github.com/jerryhuangyu/gitface/actions/workflows/test.yml) [![Release](https://github.com/jerryhuangyu/gitface/actions/workflows/release.yml/badge.svg)](https://github.com/jerryhuangyu/gitface/actions/workflows/release.yml)

> Commit with the right face, every time.

GitFace keeps your Git personas in sync. Capture each identity once, store it as
JSON, and apply it to any repository without touching `git config`.

## Why GitFace?

- **Frictionless switching** – apply profiles to any repo with
  `gitface use <profile>`.
- **Delightful UX** – flags for scripts, Interactive prompts for human.
- **Local first** – profiles live right on your machine.
- **Safety rails** – default scope is local, never pollute your global config by
  mistake.

## Install

```sh
npm install --global gitface
```

Prefer one-off use? Run `npx gitface --help`.

## Quick Start

```bash
# Create a profile interactively
gitface new work

# Non-interactive creation (useful for CI scripts)
gitface new oss --git-name "Open Source" --email "oss@example.com"

# See what is saved (sorted by last update)
gitface list

# Apply a profile to the current repo (local scope is the default)
gitface use work

# Inspect the active Git identity
gitface current
```

Run `gitface <command> --help` to see all flags and examples.

## Documentation

- [User Manual (Traditional Chinese)](./docs/user-manual.zh-TW.md) – step-by-step onboarding and common workflows.
- [CLI Reference](./docs/cli.md) – full command/flag behavior and JSON outputs.
- [Profiles & Storage Notes](./docs/profiles.md) – persistence layout and implementation notes.

## Tab Completion

- Generate shell snippets from the CLI to stay in sync with new releases:
  - Zsh: `gitface completion snippet --shell zsh`
  - Bash: `gitface completion snippet --shell bash`
- Append the snippet to your shell rc (or source it) and reload your terminal.
- Generated snippets use `gitface completion profiles --limit 50` to keep
  completion responsive for large profile sets.
- `gitface completion profiles --prefix <value>` uses case-insensitive prefix
  matching, so `wo` can match `Work` / `work-admin`.
- `gitface completion profiles --json` emits machine-readable payload:
  `{ "topic": "profiles", "prefix": "wo", "limit": 5, "count": 1, "names": ["work-admin"] }`.
- `gitface completion profiles` reads profile names from local profile filenames,
  so unrelated malformed profile JSON payloads do not block tab completion.
- Completion is scoped to source-profile arguments for `use`, `rm/remove`,
  `edit`, `clone`, and `rename/mv`, plus `rules add` profile argument.

## Command Reference

| Command                  | Description                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `gitface new <profile>`  | Create a profile from prompts or flags (`--git-name`, `--email`, `--signing-key`, `--force`, `--dry-run`, `--json`). |
| `gitface edit <profile>` | Update a stored profile via flags or an interactive editor; supports `--dry-run` and `--json` output. |
| `gitface list`           | Render saved profiles (Ink on TTY, plain text on non-TTY), filter with `--query`, cap output with `--limit`, or use `list --json`. |
| `gitface use <profile>`  | Apply a profile to Git config; supports `--scope`, `--query`, `--dry-run`, and `use --json` output.      |
| `gitface current`        | Display active Git identity; supports `--scope` and `current --json` for machine-readable output. |
| `gitface doctor`         | Run environment diagnostics; checks Git install, profile store, and explicit **global** Git identity (`--json`, `--strict` available). |
| `gitface export [file]`  | Export all profiles as JSON to stdout or a file; supports `--json` summary output.              |
| `gitface import <file>`  | Import profiles from JSON; supports `--dry-run` and `--json` for structured results.            |
| `gitface clone <src> <tgt>` | Clone a profile to a new name; supports `--dry-run` and `--json` output.                     |
| `gitface rename <old> <new>` | Rename a profile (alias: `mv`); supports `--dry-run` and `rename --json` for safer automation. |
| `gitface rm <profile>`   | Remove a profile; supports `--dry-run`, `--force`, and `--json` for safer automation. |
| `gitface rules <subcommand>` | Manage folder rules (`list`, `add`, `remove`, `resolve`, `apply`, `doctor`) with optional `--json`; mutations support `--dry-run`; `rules list` supports `--query` and `--limit`; `rules apply` supports `--fallback-profile`; `rules resolve/apply/doctor --strict` support CI gating. |

## Profiles & Storage

- Files are saved as prettified JSON in
  `~/.config/gitface/profiles/<profile>.json`.
- Git include files are generated in
  `~/.config/gitface/identities/<profile>.gitconfig` for folder rules and
  advanced git config workflows.
- Profile and identity files are written with atomic replace semantics (temp
  file + rename) to reduce partial-write corruption risk.
- Profile names must be non-empty and must not contain path separators (`/`,
  `\`), NUL, or reserved dot segments (`.`/`..`).
- When you omit `--git-name` or `--email`, GitFace falls back to the identity
  reported by `git config`.
- Created profiles capture `createdAt` and `updatedAt` ISO timestamps for
  auditing.
- `--signing-key` values map to `user.signingkey`; use
  `gitface edit <name> --unset-signing-key` to remove it.
- `gitface new <name> --git-name <value> --email <value> --json` emits:
  `{ "status": "created", "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `gitface new <name> --git-name <value> --email <value> --dry-run --json` previews creation without writing:
  `{ "status": "dry-run", "name": "work", "overwrite": false, "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `gitface new <name> --json` without non-interactive field flags emits:
  `{ "status": "error", "name": "work", "reason": "Non-interactive flags are required when using --json output mode." }`.
- `gitface edit <name> --git-name <value> --json` emits:
  `{ "status": "updated", "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `gitface edit <name> --git-name <value> --dry-run --json` previews updates without writing:
  `{ "status": "dry-run", "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `gitface edit <name> --json` without non-interactive field flags emits:
  `{ "status": "error", "name": "work", "reason": "Non-interactive flags are required when using --json output mode." }`.
- `gitface import <file> --dry-run` validates payload and duplicate handling
  without changing local profile files.
- `gitface import <file> --json` emits machine-readable summary:
  `{ "dryRun": false, "total": 2, "imported": 2, "failed": 0, "results": [{ "name": "work", "status": "imported", "message": "Imported." }] }`.
- `gitface remove <name> --json` emits machine-readable status:
  `{ "status": "removed", "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `gitface remove <name> --dry-run --json` previews deletion without writing:
  `{ "status": "dry-run", "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- Missing-profile failures in `use`/`clone`/`rename`/`remove`/`rules add` now include best-effort `Did you mean ...` suggestions.
- `gitface use <profile> --dry-run --json` previews scope-specific git config changes without writing:
  `{ "status": "dry-run", "scope": "local", "hasChanges": true, "profile": { "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }, "current": { "gitName": "Current User", "email": "current@example.com", "signingKey": null }, "changes": [{ "key": "user.name", "action": "set", "before": "Current User", "after": "Work User" }] }`.
- `gitface use <profile> --json` returns an explicit no-op payload when the
  active scope already matches the profile:
  `{ "status": "unchanged", "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null, "scope": "local", "changes": [] }`.
- `gitface list --query wor` filters profiles by case-insensitive name
  substring matching (works in both human and JSON modes).
- `gitface list --limit 10` caps displayed/JSON rows after sorting and query filtering.
- `gitface list` automatically falls back to deterministic plain-text output
  when stdout is not a TTY (for example when piped in scripts).
- `gitface rules add <dir> <profile> --json` emits machine-readable status:
  `{ "status": "added", "directory": "/abs/path/", "profileName": "work" }`.
- `gitface rules add <dir> <profile> --dry-run --json` previews add/update without writing:
  `{ "status": "dry-run", "directory": "/abs/path/", "profileName": "work", "overwrite": false }`.
- `gitface rules remove <dir> --json` emits machine-readable status:
  `{ "status": "removed", "directory": "/abs/path/" }`.
- `gitface rules remove <dir> --dry-run --json` previews removal without writing:
  `{ "status": "dry-run", "directory": "/abs/path/", "exists": true }`.
- `gitface rules list --query work --limit 10 --json` filters by
  directory/profile substring, returns deterministic directory-sorted rows, and
  caps output size for scripts.
- `gitface rules resolve [dir] --json` resolves the most specific matching rule for a target directory:
  `{ "status": "matched", "directory": "/abs/path/repo/", "matchedRule": { "directory": "/abs/path/", "profileName": "work" }, "profileExists": true }`.
- `gitface rules resolve [dir] --json` when no rule matches:
  `{ "status": "unmatched", "directory": "/abs/path/repo/", "matchedRule": null, "profileExists": null }`.
- `gitface rules resolve [dir] --strict` treats `unmatched` and `matched + profileExists=false` as non-zero exit results for CI gating.
- `gitface rules apply [dir] --json` resolves and applies matched profile in one step:
  `{ "status": "applied", "directory": "/abs/path/repo/", "scope": "local", "matchedRule": { "directory": "/abs/path/", "profileName": "work" }, "profile": { "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null } }`.
- `gitface rules apply [dir] --dry-run --json` previews scope-specific changes without writing:
  `{ "status": "dry-run", "directory": "/abs/path/repo/", "scope": "local", "matchedRule": { "directory": "/abs/path/", "profileName": "work" }, "profile": { "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }, "current": { "gitName": "Current User", "email": "current@example.com", "signingKey": null }, "hasChanges": true, "changes": [{ "key": "user.name", "action": "set", "before": "Current User", "after": "Work User" }] }`.
- `gitface rules apply [dir] --json` when no rule matches:
  `{ "status": "unmatched", "directory": "/abs/path/repo/", "scope": "local", "matchedRule": null }`.
- `gitface rules apply [dir] --fallback-profile work --json` applies fallback profile when no rule matches:
  `{ "status": "applied", "resolution": "fallback", "directory": "/abs/path/repo/", "scope": "local", "matchedRule": null, "fallbackProfileName": "work", "profile": { "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null } }`.
- `gitface rules apply [dir] --dry-run --fallback-profile work --json` previews fallback application without writing:
  `{ "status": "dry-run", "resolution": "fallback", "directory": "/abs/path/repo/", "scope": "local", "matchedRule": null, "fallbackProfileName": "work", "profile": { "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }, "current": { "gitName": "Current User", "email": "current@example.com", "signingKey": null }, "hasChanges": true, "changes": [{ "key": "user.name", "action": "set", "before": "Current User", "after": "Work User" }] }`.
- `gitface rules apply [dir] --strict` treats `unmatched` as non-zero exit results for CI gating.
- `gitface rules doctor --json` checks every rule for missing profile/directory and emits:
  `{ "status": "issues", "strict": false, "summary": { "total": 2, "pass": 1, "warn": 1, "fail": 0 }, "results": [{ "directory": "/abs/path/", "profileName": "work", "status": "warn", "profileExists": true, "directoryExists": false }] }`.
- `gitface rules doctor --strict` treats both `warn` and `fail` as non-zero exit results for CI gating.
- `gitface rename <old> <new> --json` emits machine-readable status:
  `{ "status": "renamed", "oldName": "old", "name": "new", "rulesUpdated": 2, "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `gitface rename <old> <new> --dry-run --json` previews rename metadata without writing:
  `{ "status": "dry-run", "oldName": "old", "newName": "new", "overwrite": false, "rulesToUpdate": 2, "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `gitface rename` automatically migrates folder rules that reference the old profile name.
- `gitface clone <src> <tgt> --json` emits machine-readable status:
  `{ "status": "cloned", "sourceName": "work", "name": "work-copy", "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `gitface clone <src> <tgt> --dry-run --json` previews clone metadata without writing:
  `{ "status": "dry-run", "sourceName": "work", "targetName": "work-copy", "overwrite": false, "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `gitface export --json` emits machine-readable summary:
  `{ "status": "exported", "count": 2, "profiles": [{ "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null, "createdAt": "...", "updatedAt": "..." }] }`.
- `gitface export ./profiles.json --json` emits machine-readable file result:
  `{ "status": "exported", "count": 2, "file": "./profiles.json" }`.

### Example profile file

```json
{
  "name": "work",
  "gitName": "Company Dev",
  "email": "dev@company.com",
  "signingKey": "ABC123",
  "createdAt": "2024-12-01T17:33:14.023Z",
  "updatedAt": "2024-12-01T17:33:14.023Z"
}
```

## Scopes & Safety

- `local` scope updates `.git/config` in the current repo (default).
- `global` writes to your user config (`~/.gitconfig`), handy when you swap
  machines.
- `system` forwards to the system config for admin setups.
- GitFace automatically wipes `user.signingkey` when the target profile has no
  key.
- `gitface use <profile> --json` emits machine-readable output:
  `{ "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null, "scope": "local" }`.
- `gitface use` (without `<profile>`) opens an interactive selector and applies
  the selected profile immediately.
- `gitface use --query <text>` pre-filters profile candidates by case-insensitive
  substring matching when `<profile>` is omitted.
- `gitface use --query <text>` auto-applies directly when exactly one profile
  matches.
- `gitface use --query <text>` in non-TTY mode fails fast when multiple profiles
  match and asks for an explicit profile name.
- `gitface current --scope global --json` inspects one scope and emits:
  `{ "gitName": "Work User", "email": "work@example.com", "signingKey": "ABC123", "scope": "global" }`.
- Scoped identity reads (`current --scope`, `use` planning, and doctor global checks)
  use a single `git config --list` snapshot per scope by default, with safe
  fallback behavior when listing fails.
- `gitface doctor --strict` treats warnings as CI-failing results (exit code `1`)
  while keeping default doctor behavior unchanged.
- `gitface use <profile> --dry-run` previews planned scoped config updates and
  does not mutate `.git/config`; dry-run output only lists effective changes.
- `gitface remove <name> --dry-run` previews profile deletion and does not
  mutate `~/.config/gitface/profiles/*.json`.
- `gitface use` exits with code `1` and a guidance message when no profiles are
  available to select.

Set `GITFACE_LOG_LEVEL=debug` (or `GITFACE_DEBUG=1`) to print stack traces and
additional diagnostics. Supported levels: `critical`, `error`, `warn`, `info`,
`debug`, `trace`, `silent`.

## Development

```bash
pnpm install          # install dependencies
pnpm run lint         # Biome checks
pnpm run typecheck    # tsc --noEmit
pnpm run test         # Vitest (coverage enabled)
pnpm run build        # tsc + tsdown bundle
```

- `pnpm run dev` runs tsdown in watch mode for local hacking.
- CI requires `pnpm run lint` to pass before test workflow continues. Use
  `pnpm exec biome check --write .` for safe auto-fixes.
- `make link` (or `npm link`) exposes the CLI globally for manual testing.
- Non-interactive paths (for example `list --json`, `use <name> --json`,
  `new --json`, and `edit --json`) lazy-load Ink UI modules to keep script
  startup lean.
- Release automation lives in `docs/release.md`; keep CI green before tagging.
