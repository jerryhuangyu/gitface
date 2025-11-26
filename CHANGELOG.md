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
