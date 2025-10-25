# [GitFace](https://github.com/jerryhuangyu/gitface) · [![npm version](https://img.shields.io/npm/v/gitface.svg?style=flat)](https://www.npmjs.com/package/gitface) [![npm total downloads](https://img.shields.io/npm/dt/gitface.svg?style=flat)](https://www.npmjs.com/package/gitface) [![Test](https://github.com/jerryhuangyu/gitface/actions/workflows/test.yml/badge.svg)](https://github.com/jerryhuangyu/gitface/actions/workflows/test.yml) [![Release](https://github.com/jerryhuangyu/gitface/actions/workflows/release.yml/badge.svg)](https://github.com/jerryhuangyu/gitface/actions/workflows/release.yml)

GitFace is a tiny CLI that saves your favorite Git identities and applies them to any repository with a single command. Keep personal, work, OSS, or throwaway personas organized without hand-editing `git config`.

## Features

- Built for frantic context switches—capture work/personal/OSS personas once and swap in under a second.
- Profiles live in plain JSON under `~/.config/gitface/profiles`, so they are portable, auditable, and Git-friendly.
- Scope-aware applies (`local`, `global`, or `system`) keep dotfiles honest without hand-editing `git config`.
- One command (`gitface current`) confirms the active identity before you commit, preventing wrong-address mistakes.
- Optional signing-key storage keeps GPG/SSH signing aligned with each persona.

## Install

```sh
npm install --global gitface
```

Prefer not to install? Use `npx gitface --help` whenever you need it.

## Quickstart

```bash
# Capture the current repo identity
gitface new work

# Or create one from scratch
gitface new work -n "Company" -e "company@example.com"

# See what you have stored
gitface list

# Apply it to the repo you are standing in (default: local scope)
gitface use work

# Double-check the active config
gitface current

# Help for more details
gitface
gitface [command] --help
```

## Development

GitFace uses TypeScript, Vitest, tsdown, and Biome. CI mirrors the commands above, so keep them green before opening a PR.

## Release workflow

1. Run `make bump` to:
   - generate the changelog entry via `git-cliff`
   - bump `package.json` (no tag yet)
   - commit the version bump
   - push the bump commit and wait for ci to pass
2. Run `make release` to:
   - create an annotated git tag from the latest commit
   - push the tag to GitHub
3. GitHub Actions picks up the tag and publishes the package to npm.

If you need to dry-run a global install locally, `make link` (or `npm link`) exposes `gitface` from your workspace.
