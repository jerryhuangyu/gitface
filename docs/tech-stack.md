# Tech Stack

## Runtime

- **Node.js ≥ 18** – the CLI targets modern Node (ESM + `fs/promises`).
- **pnpm** – package manager used in CI and the Makefile targets.

## CLI & Terminal UI

- **[commander](https://github.com/tj/commander.js)** – command parsing, help
  text, argument validation.
- **[Ink](https://github.com/vadimdemedes/ink)** – React primitives for
  interactive prompts and tables.
- **ink-text-input & ink-select-input** – terminal widgets used by the `new` and
  `edit` flows.
- **[chalk](https://github.com/chalk/chalk)** – consistent color output across
  commands.

## Core Services

- **[simple-git](https://github.com/steveukx/git-js)** – thin wrapper over `git`
  for reading and writing config.
- **[zod](https://github.com/colinhacks/zod)** – lightweight validation for
  interactive prompts.

## Build & Tooling

- **TypeScript** – strict typing across CLI, services, and Ink components.
- **[tsdown](https://github.com/rolldown/tsdown)** – bundler that emits the
  distributable under `dist/`.
- **Vitest + @vitest/coverage-v8** – unit tests and coverage tracking.
- **Biome** – formatting + linting enforced locally and in CI.
- **Makefile** – wraps pnpm scripts and automates version bumping and releases.
