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

### Enable Shell Completion

To make it persistent, add one of these lines to your shell rc:

```sh
# ~/.zshrc
eval "$(gitface completion snippet --shell zsh)"
```

For Bash:

```sh
# ~/.bashrc
eval "$(gitface completion snippet --shell bash)"
```

## Documentation

- [User Manual (Traditional Chinese)](./docs/user-manual.zh-TW.md) –
  step-by-step onboarding and common workflows.
- [CLI Reference](./docs/cli.md) – full command/flag behavior and JSON outputs.
- [Profiles & Storage Notes](./docs/profiles.md) – persistence layout and
  implementation notes.

## Tab Completion

- Generate shell snippets from the CLI to stay in sync with new releases:
  - Zsh: `gitface completion snippet --shell zsh`
  - Bash: `gitface completion snippet --shell bash`
- Append the snippet to your shell rc (or source it) and reload your terminal.
- Snippets complete three things: top-level command names, `rules` subcommand
  names, and profile arguments for `use`, `rm/remove`, `edit`, `clone`,
  `rename/mv`, plus the `rules add` profile argument.
- Completion data comes from `gitface completion <topic>` with topics
  `profiles`, `commands`, and `rules-commands`; snippets call it with
  `--limit 50` to keep completion responsive for large profile sets.
- `gitface completion profiles --prefix <value>` uses case-insensitive prefix
  matching, so `wo` can match `Work` / `work-admin`. `--delimiter` customizes
  the separator between suggestions (default: newline).
- `gitface completion profiles --json` emits machine-readable payload:
  `{ "topic": "profiles", "prefix": "wo", "limit": 5, "count": 1, "names": ["work-admin"] }`.
- `gitface completion profiles --json-envelope` emits Result Envelope output for
  automation/CI observability:
  `{ "status": "success", "code": "COMPLETION_PROFILES_OK", "message": "Completion profiles resolved.", "data": { "topic": "profiles", "prefix": "wo", "limit": 5, "count": 1, "names": ["work-admin"] }, "errors": [], "meta": { "schemaVersion": "1.0.0", "durationMs": 2, "traceId": "..." } }`.
- `gitface completion profiles` reads profile names from local profile
  filenames, so unrelated malformed profile JSON payloads do not block tab
  completion.

## Command Reference

| Command                      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`gitface new <profile>`](./docs/cli.md#gitface-new-name) | Create a profile from prompts or flags (`--git-name`, `--email`, `--signing-key`, `--force`, `--dry-run`, `--json`).                                                                                                                                                                                                                                                                                                                                                                      |
| [`gitface edit <profile>`](./docs/cli.md#gitface-edit-name) | Update a stored profile via flags or an interactive editor; supports `--dry-run` and `--json` output.                                                                                                                                                                                                                                                                                                                                                                                     |
| [`gitface list`](./docs/cli.md#gitface-list) | Render saved profiles (alias: `ls`; Ink on TTY, plain text on non-TTY), filter with `--query`, sort with `--sort` (`updated`/`name`), cap output with `--limit`, or use `list --json` / `list --json-envelope`.                                                                                                                                                                                                                                                                                        |
| [`gitface use <profile>`](./docs/cli.md#gitface-use-name) | Apply a profile to Git config; supports `--scope`, `--query`, `--dry-run`, plus `use --json` and `use --json-envelope` output.                                                                                                                                                                                                                                                                                                                                                            |
| [`gitface current`](./docs/cli.md#gitface-current) | Display active Git identity; supports `--scope`, `current --json`, and `current --json-envelope` machine-readable output.                                                                                                                                                                                                                                                                                                                                                                 |
| [`gitface doctor`](./docs/cli.md#gitface-doctor) | Run environment diagnostics; checks Git install, profile store, and explicit **global** Git identity (`--json`, `--json-envelope`, `--strict` available).                                                                                                                                                                                                                                                                                                                                 |
| [`gitface export [file]`](./docs/cli.md#gitface-export-file) | Export all profiles as JSON to stdout or a file; supports legacy `--json` summary and `--json-envelope` unified output.                                                                                                                                                                                                                                                                                                                                                                   |
| [`gitface import <file>`](./docs/cli.md#gitface-import-file) | Import profiles from JSON; supports `--dry-run`, `--strict`, `--atomic`, plus `--json` / `--json-envelope` for automation and CI gating.                                                                                                                                                                                                                                                                                                                                                  |
| [`gitface clone <src> <tgt>`](./docs/cli.md#gitface-clone-source-name-target-name) | Clone a profile to a new name; supports `--force` overwrite, `--dry-run`, and `--json` output.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [`gitface rename <old> <new>`](./docs/cli.md#gitface-rename-old-name-new-name) | Rename a profile (alias: `mv`); supports `--dry-run`, `rename --json`, and `rename --json-envelope` for safer automation.                                                                                                                                                                                                                                                                                                                                                                 |
| [`gitface rm <profile>`](./docs/cli.md#gitface-rm-name) | Remove a profile; supports `--dry-run`, `--force`, plus `remove --json` and `remove --json-envelope` for safer automation.                                                                                                                                                                                                                                                                                                                                                                |
| [`gitface rules <subcommand>`](./docs/cli.md#gitface-rules-subcommand) | Manage folder rules (`list`/`ls`, `add`, `remove`/`rm`, `resolve`, `apply`, `doctor`, `prune`) with optional `--json`; `rules add/remove/resolve/apply` also support `--json-envelope`; mutations support `--dry-run`; `rules list` supports `--query`, `--limit`, and `--health` (`--concurrency` in health mode); `rules apply` supports `--scope` and `--fallback-profile`; `rules resolve/apply/doctor/prune --strict` support CI gating; `rules doctor/prune --concurrency` tune integrity scan parallelism. |
| [`gitface completion`](./docs/cli.md#gitface-completion-topic) | Emit completion data (`profiles`, `commands`, `rules-commands` topics; `--prefix`, `--limit`, `--delimiter`, `--json`, `--json-envelope`) and shell snippets via `completion snippet --shell <bash\|zsh>`.                                                                                                                                                                                                                                                                                  |

## Profiles & Storage

- Files are saved as prettified JSON in
  `~/.config/gitface/profiles/<profile>.json` (respects `$XDG_CONFIG_HOME`).
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
- Missing-profile failures in `use`/`clone`/`rename`/`remove`/`rules add`
  include best-effort `Did you mean ...` suggestions.

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
  machines; `system` forwards to the system config for admin setups.
- GitFace automatically wipes `user.signingkey` when the target profile has no
  key.
- `gitface use` without `<profile>` opens an interactive selector; `--query`
  narrows candidates and auto-applies on a unique match. In non-TTY or JSON
  mode, ambiguous matches fail fast with exit code `1` instead of prompting.
- Mutating commands support `--dry-run` previews; dry-run lists only effective
  changes and never writes.
- `gitface use` guards multi-key writes with rollback: if any write fails,
  GitFace restores the previous scoped identity before exiting.
- `gitface doctor --strict` (and `rules resolve/apply/doctor/prune --strict`)
  turn warnings into exit code `1` for CI gating.
- Every command's `--json` / `--json-envelope` payload shapes are documented in
  the [CLI Reference](./docs/cli.md).

Set `GITFACE_LOG_LEVEL=debug` (or `GITFACE_DEBUG=1`) to print stack traces and
additional diagnostics. Supported levels: `critical`, `error`, `warn`, `info`,
`debug` (default: `error`; unknown values fall back to `error`).

## Development

```bash
pnpm install          # install dependencies
pnpm run lint         # Biome checks
pnpm run typecheck    # tsc --noEmit
pnpm run test         # Vitest (coverage enabled)
pnpm run build        # tsc + tsdown bundle
```

- `pnpm run dev` runs tsdown in watch mode for local hacking.
- CI runs typecheck and Biome (`biome ci .`) as separate jobs; both must pass
  before the test-and-coverage job runs. Use `pnpm exec biome check --write .`
  for safe auto-fixes.
- Biome configuration is pinned to the local CLI schema and includes both
  `src/**` and `tests/**` TypeScript files so test code also stays under the
  same quality gate.
- Vitest is configured with serial file execution (`fileParallelism: false`)
  because E2E tests intentionally mutate process globals (`cwd/env/argv`) and
  parallel file runs can produce flaky timeouts.
- `make link` (or `npm link`) exposes the CLI globally for manual testing.
- Non-interactive paths (for example `list --json`, `use <name> --json`,
  `new --json`, and `edit --json`) lazy-load Ink UI modules to keep script
  startup lean.
- Release automation lives in [docs/release.md](./docs/release.md); keep CI
  green before tagging.
