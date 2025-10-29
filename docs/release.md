# Release workflow

1. Run `make bump` to:
   - generate the changelog entry via `git-cliff`
   - bump `package.json` (no tag yet)
   - commit the version bump
   - push the bump commit and wait for ci to pass
2. Run `make release` to:
   - create an annotated git tag from the latest commit
   - push the tag to GitHub
3. GitHub Actions picks up the tag and publishes the package to npm.

> note: CI token will expire periodically. If the release step fails due to authentication, regenerate the `NPM_TOKEN` secret in GitHub repo settings.
