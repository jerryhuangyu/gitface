# [GitFace](https://github.com/jerryhuangyu/gitface) · [![npm version](https://img.shields.io/npm/v/gitface.svg?style=flat)](https://www.npmjs.com/package/gitface) [![npm total downloads](https://img.shields.io/npm/dt/gitface.svg?style=flat)](https://www.npmjs.com/package/gitface) [![Test](https://github.com/jerryhuangyu/gitface/actions/workflows/test.yml/badge.svg)](https://github.com/jerryhuangyu/gitface/actions/workflows/test.yml) [![Release](https://github.com/jerryhuangyu/gitface/actions/workflows/release.yml/badge.svg)](https://github.com/jerryhuangyu/gitface/actions/workflows/release.yml)

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

## Command Reference

| Command                  | Description                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `gitface new <profile>`  | Create a profile from prompts or flags (`--git-name`, `--email`, `--signing-key`, `--force`). |
| `gitface edit <profile>` | Update a stored profile via flags or an interactive editor.                                   |
| `gitface list`           | Render the saved profiles in an Ink table with relative timestamps.                           |
| `gitface use <profile>`  | Apply a profile to Git config; supports `--scope local                                        |
| `gitface current`        | Display the Git identity currently resolved from config.                                      |
| `gitface rm <profile>`   | Remove a profile; add `--force` to ignore missing entries.                                    |

## Profiles & Storage

- Files are saved as prettified JSON in
  `~/.config/gitface/profiles/<profile>.json`.
- When you omit `--git-name` or `--email`, GitFace falls back to the identity
  reported by `git config`.
- Created profiles capture `createdAt` and `updatedAt` ISO timestamps for
  auditing.
- `--signing-key` values map to `user.signingkey`; use
  `gitface edit <name> --unset-signing-key` to remove it.

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

Set `GITFACE_LOG_LEVEL=debug` (or `GITFACE_DEBUG=1`) to print stack traces and additional diagnostics. Supported levels: `critical`, `error`, `warn`, `info`, `debug`, `trace`, `silent`.

## Development

```bash
pnpm install          # install dependencies
pnpm run lint         # Biome checks
pnpm run typecheck    # tsc --noEmit
pnpm run test         # Vitest (coverage enabled)
pnpm run build        # tsc + tsdown bundle
```

- `pnpm run dev` runs tsdown in watch mode for local hacking.
- `make link` (or `npm link`) exposes the CLI globally for manual testing.
- Release automation lives in `docs/release.md`; keep CI green before tagging.
