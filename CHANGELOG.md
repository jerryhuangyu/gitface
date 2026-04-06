## [0.8.0] - 2026-04-06

### 🚀 Features

- Support tab completion for profile options
- Add rules management commands and logic
- *(rules)* Add json output mode for rules list
- *(list)* Add --json output for profile listing
- *(current)* Add --json output mode
- *(doctor)* Add --json output mode
- *(use)* Add --json output mode
- *(import)* Add --dry-run preflight mode
- *(import)* Add machine-readable --json output
- *(remove)* Add --json output and streamline delete flow
- *(rename)* Add --json output mode
- *(clone)* Add --json output mode
- *(export)* Add --json output mode
- *(completion)* Expand profile completion coverage
- *(rules)* Add json output for add/remove commands
- *(new)* Add json output mode
- *(edit)* Add --json output mode
- *(use)* Add dry-run preview and lazy-load interactive UI
- *(use)* Skip unchanged profile writes and tighten dry-run diff
- *(current)* Add scoped identity output
- *(list)* Add query filtering and non-tty plain output
- *(ux)* Suggest similar profiles for not-found failures
- *(rules)* Add query and limit options for rules list
- *(doctor)* Add strict mode for CI gating
- *(list)* Add limit option for bounded output
- *(remove)* Add dry-run preview mode
- *(completion)* Add rules add profile shell completion
- *(completion)* Add suggestion limit for profile completions
- *(rename)* Add dry-run preview mode
- *(clone)* Add dry-run preview mode
- *(rules)* Add dry-run preview mode
- *(new)* Add dry-run preview mode
- *(completion)* Make prefix matching case-insensitive
- *(edit)* Add dry-run preview mode
- *(completion)* Add json output for profiles topic
- *(rules)* Add resolve command for effective profile
- *(rules)* Add strict mode for resolve command
- *(rename)* Migrate folder rules on profile rename
- *(rules)* Add apply command for rule-driven profile switching
- *(rules)* Add doctor command for rule health checks
- *(use)* Add query-assisted profile selection
- *(rules)* Add fallback profile for apply unmatched
- *(rules)* Add prune command for stale profile mappings
- *(rules)* Optionally prune rules with missing directories
- *(rules)* Add strict mode for prune CI gating
- *(rules)* Add concurrent integrity scan for doctor/prune
- *(rules)* Add scan metrics for doctor and prune outputs
- *(rules)* Add health mode for list command
- *(import)* Add strict mode for CI-safe failure gating
- *(import)* Add atomic precheck mode
- *(list)* Add sortable output mode
- *(use)* Rollback scoped identity on apply failure
- *(use)* Support query-based selection in json mode
- *(use)* Unify json error contract
- *(use)* Add applied status and change summary for json output
- *(completion)* Add json-envelope result contract (ADR-20260302)
- *(use)* Add json-envelope result contract (ADR-20260302)
- *(current)* Add json-envelope result contract (ADR-20260302)
- *(list)* Add json-envelope and core query service (ADR-20260302)
- *(rules)* Add apply json-envelope result contract (ADR-20260302)
- *(import)* Add json-envelope and core import service (ADR-20260302)
- *(export)* Add json-envelope and core export service (ADR-20260302)
- *(doctor)* Add json-envelope result contract (ADR-20260302)
- *(rename)* Add json-envelope and core rename service (ADR-20260302)
- *(rules)* Add json-envelope for add/remove/resolve (ADR-20260302)
- *(remove)* Add json-envelope and core remove service (ADR-20260302)
- *(completion)* Add completion service for  commands

### 🐛 Bug Fixes

- *(security)* Validate profile names to block path traversal
- *(reliability)* Use atomic writes for profile storage
- *(use)* Apply interactive selection and fail fast on empty profiles
- *(doctor)* Enforce global-scope identity checks
- *(completion)* Avoid zsh parse error in snippet guards
- *(use)* Ignore commander context in query selection
- *(rules)* Match resolve/apply directories case-insensitively on macOS/windows

### 🚜 Refactor

- *(rules)* Remove process chdir side effects in apply
- Extract a dedicated application service for `gitface clone`

### 📚 Documentation

- *(README)* Update quick start instructions and add documentation links
- *(adr)* Localize section headings to Chinese

### ⚡ Performance

- *(new,edit)* Lazy-load interactive UI for noninteractive paths
- *(core)* Use single-pass scoped identity reads
- *(use)* Reuse scoped identity snapshot for planning
- *(completion)* Use profile name index for suggestions
- *(rules)* Use targeted includeIf config scan

### 🧪 Testing

- Stabilize e2e by disabling vitest file parallelism

### ⚙️ Miscellaneous Tasks

- Update packages with mjs
- Align tooling quality gates and stabilize store init
## [0.7.0] - 2025-11-30

### 🚀 Features

- Support doctor command that reports git install, profile store access, and global identity checks
- Support interaction way of choosing the profile to use
- Support profile export and import

### 🚜 Refactor

- Use iterable callback pattern

### 🧪 Testing

- Add end-to-end tests for CLI commands
## [0.6.0] - 2025-11-26

### 🚀 Features

- Support profile renaming functionality with new CLI commands
- Support profile cloning functionality with new CLI commands

### 📚 Documentation

- Update readme with demo gif
- Update new command: clone, rename

### ⚙️ Miscellaneous Tasks

- Update dependencies version
- Update biome config schema
## [0.5.0] - 2025-11-01

### 🚀 Features

- Implement new remove profile command with feedback
- Implement new use profile command with align ux
- Add OS path utilities for config file resolution
- Implement logging with configurable levels
- Enhance debug logging in commands

### 🐛 Bug Fixes

- Avoid crash when new a profile
- Show single error message and exit with code 1 on removal failure

### 🚜 Refactor

- Clarify and polish success message when creating profiles
- Align current identity display message with other outputs

### 📚 Documentation

- Update README and add CLI reference documentation

### ⚙️ Miscellaneous Tasks

- Update build script to include type checking
## [0.4.0] - 2025-10-29

### 🚀 Features

- Add interactive UI for new profile creation command

### ⚙️ Miscellaneous Tasks

- Format code
## [0.3.0] - 2025-10-29

### 🚀 Features

- Improve ui for current, edit, list commands with ink

### 📚 Documentation

- Update README and workflow name for clarity
## [0.2.0] - 2025-10-25

### 🚀 Features

- Add versioning to gitface --version

### ⚙️ Miscellaneous Tasks

- Add version bump for npm package
## [0.1.1] - 2025-10-25

### ⚙️ Miscellaneous Tasks

- Add --no-git-checks to npm publish command
## [0.1.0] - 2025-10-25

### 🚀 Features

- Add CLI commands skelton for git profile management
- Integrate simple-git for show current git profile
- Implement CLI commands for Git profile management
- Add CI workflow for type checking, quality, and tests (#1)

### 🚜 Refactor

- Update tech stack documentation and refactor imports

### ⚙️ Miscellaneous Tasks

- Add GitHub Actions workflow for npm release
