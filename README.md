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
# Create a profile using the current repo identity as defaults
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

## Tab Completion

- Generate shell snippets from the CLI to stay in sync with new releases:
  - Zsh: `gitface completion snippet --shell zsh`
  - Bash: `gitface completion snippet --shell bash`
- Append the snippet to your shell rc (or source it) and reload your terminal.
- Completion is scoped to source-profile arguments for `use`, `rm/remove`,
  `edit`, `clone`, and `rename/mv`.

## Command Reference

| Command                  | Description                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `gitface new <profile>`  | Create a profile from prompts or flags (`--git-name`, `--email`, `--signing-key`, `--force`, `--json`). |
| `gitface edit <profile>` | Update a stored profile via flags or an interactive editor; supports `--json` output.         |
| `gitface list`           | Render saved profiles in an Ink table, or use `list --json` for machine-readable output.      |
| `gitface use <profile>`  | Apply a profile to Git config; supports `--scope`, `--dry-run`, and `use --json` output.      |
| `gitface current`        | Display active Git identity; use `current --json` for machine-readable output.                |
| `gitface doctor`         | Run environment diagnostics; use `doctor --json` for machine-readable output.                  |
| `gitface export [file]`  | Export all profiles as JSON to stdout or a file; supports `--json` summary output.              |
| `gitface import <file>`  | Import profiles from JSON; supports `--dry-run` and `--json` for structured results.            |
| `gitface clone <src> <tgt>` | Clone a profile to a new name; supports `--json` output.                                     |
| `gitface rename <old> <new>` | Rename a profile (alias: `mv`); use `rename --json` for machine-readable output.            |
| `gitface rm <profile>`   | Remove a profile; add `--force` to ignore missing entries, or `--json` for structured output. |
| `gitface rules <subcommand>` | Manage folder rules (`list`, `add`, `remove`) with optional `--json` output for all subcommands. |

## Profiles & Storage

- Files are saved as prettified JSON in
  `~/.config/gitface/profiles/<profile>.json`.
- Git include files are generated in
  `~/.config/gitface/identities/<profile>.gitconfig` for folder rules and
  advanced git config workflows.
- When you omit `--git-name` or `--email`, GitFace falls back to the identity
  reported by `git config`.
- Created profiles capture `createdAt` and `updatedAt` ISO timestamps for
  auditing.
- `--signing-key` values map to `user.signingkey`; use
  `gitface edit <name> --unset-signing-key` to remove it.
- `gitface new <name> --git-name <value> --email <value> --json` emits:
  `{ "status": "created", "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `gitface new <name> --json` without non-interactive field flags emits:
  `{ "status": "error", "name": "work", "reason": "Non-interactive flags are required when using --json output mode." }`.
- `gitface edit <name> --git-name <value> --json` emits:
  `{ "status": "updated", "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `gitface edit <name> --json` without non-interactive field flags emits:
  `{ "status": "error", "name": "work", "reason": "Non-interactive flags are required when using --json output mode." }`.
- `gitface import <file> --dry-run` validates payload and duplicate handling
  without changing local profile files.
- `gitface import <file> --json` emits machine-readable summary:
  `{ "dryRun": false, "total": 2, "imported": 2, "failed": 0, "results": [{ "name": "work", "status": "imported", "message": "Imported." }] }`.
- `gitface remove <name> --json` emits machine-readable status:
  `{ "status": "removed", "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `gitface use <profile> --dry-run --json` previews scope-specific git config changes without writing:
  `{ "status": "dry-run", "scope": "local", "profile": { "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }, "current": { "gitName": "Current User", "email": "current@example.com", "signingKey": null }, "changes": [{ "key": "user.name", "action": "set", "before": "Current User", "after": "Work User" }] }`.
- `gitface rules add <dir> <profile> --json` emits machine-readable status:
  `{ "status": "added", "directory": "/abs/path/", "profileName": "work" }`.
- `gitface rules remove <dir> --json` emits machine-readable status:
  `{ "status": "removed", "directory": "/abs/path/" }`.
- `gitface rename <old> <new> --json` emits machine-readable status:
  `{ "status": "renamed", "oldName": "old", "name": "new", "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
- `gitface clone <src> <tgt> --json` emits machine-readable status:
  `{ "status": "cloned", "sourceName": "work", "name": "work-copy", "gitName": "Work User", "email": "work@example.com", "signingKey": null }`.
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
- `gitface use <profile> --dry-run` previews planned scoped config updates and
  does not mutate `.git/config`.

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
- Non-interactive paths (for example `list --json`, `use <name> --json`) lazy-load Ink UI modules to keep script startup lean.
- Release automation lives in `docs/release.md`; keep CI green before tagging.
