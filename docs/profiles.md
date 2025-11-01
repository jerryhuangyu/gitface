# Profile Storage

## Location

- GitFace follows the XDG base directory spec. Profiles live in:
  - `$XDG_CONFIG_HOME/gitface/profiles` when the env var is set, or
  - `~/.config/gitface/profiles` otherwise.
- Each profile maps to `<profile-name>.json`.

## File Structure

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

### Field Notes

- `name` – canonical identifier; matches the filename and Commander argument.
- `gitName` / `email` – required values enforced by `Profile.ensureValid()`.
- `signingKey` – optional; stored as `null` when unset so the serializer always includes the field.
- `createdAt` / `updatedAt` – ISO timestamps managed by `Profile` to track history. `list` uses `updatedAt` for sorting.

## Lifecycle

1. **Creation** – `ProfileService.createProfile` composes a `ProfileInput`, applies defaults from the current Git identity, and saves the snapshot through `FileProfileStore`.
2. **Updates** – Mutations go through `Profile.update`, which refreshes `updatedAt` and re-validates required fields.
3. **Deletion** – Profiles are removed via `FileProfileStore.remove`; missing profiles raise `ProfileNotFoundError` unless `--force` is supplied.
4. **Listing** – `FileProfileStore.list` lazily reads each JSON file, skipping invalid payloads instead of failing wholesale.

## Custom Directories

While the CLI defaults to the config directory above, `ProfileService` accepts a custom store for tests. Vitest suites inject an in-memory or tmp directory-backed store to avoid polluting user state.

If you need GitFace to read from a non-default location at runtime, set `XDG_CONFIG_HOME` before invoking the CLI.
