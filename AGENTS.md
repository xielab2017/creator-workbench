# Creation Studio

- Keep the Chinese interface and six linked views. Work notes are the source of truth.
- Never overwrite existing vault notes during setup. Never read other plugins' configuration or credentials.
- Calendar sync is opt-in, one-way and limited to a user-selected iCloud calendar. Store passwords only in this plugin's SecretStorage entry.
- Exclude all demo works from real metrics and calendar writes. Preserve missing metrics as null.
- Run `npm run check` before release. Keep manifest, package, versions and release tags consistent.
- Do not commit personal vault data, screenshots containing unrelated notes, credentials or local connection state.
