# Privacy and data handling

The core workflow is local and offline. There is no telemetry, advertising, analytics SDK, payment requirement, external backend, content-platform integration or automatic update installer.

## Local data

- Work notes, goals, account snapshots, guides, optional demo notes, Bases views and a banner are written only inside the folder selected in the vault.
- Initialization creates missing files and skips existing files. It does not overwrite user notes.
- Plugin `data.json` contains the chosen root, calendar connection settings, Apple account identifier, calendar collection URL, a SecretStorage key ID and managed event mappings. Mappings include the fields already sent to iCloud and local note links. Treat this file as personal configuration; it is not a release asset.
- The app-specific password is stored under a plugin-generated `creator-workbench-…` SecretStorage ID. It is not logged or stored in notes or plugin JSON. The plugin never automatically retrieves another plugin's credentials.
- The plugin does not read arbitrary files outside the vault. It uses Obsidian's SecretStorage API for its own password and Node HTTPS for the optional connection.

## Optional remote service

Only explicit iCloud setup and opt-in sync use the network. Authenticated CalDAV requests go to HTTPS hosts under `icloud.com` or `icloud.com.cn`, including allowed iCloud redirects. TLS verification is enabled. Discovery reads the account's calendar metadata to locate the named calendar. It does not import unrelated events or copy unrelated calendar content into notes.

Published schedule fields are: work title, platform, production stage, work ID, planned or actual publication date/time and an Obsidian note link. That link reveals the vault name and note path. Drafts, media bytes, platform metrics and unrelated notes are not sent. iCloud's own service terms and data handling apply to the calendar account.

The connection is one-way. Edits in Mac Calendar or another CalDAV client do not write back into notes. Previously managed events are cancelled rather than deleted when a work loses its schedule. A version conflict stops the write; it is not bypassed.

## Disable and remove

Turn off automatic sync to stop new requests. A request already in flight may finish. Close Obsidian or disable the plugin to stop subsequent processing. Use the plugin setting to clear its own saved password. Existing vault notes and cloud events are retained after disabling/uninstalling. Remove unwanted cloud events manually in your calendar client and remove unwanted notes with Obsidian's normal file controls.

Version 2 does not read, modify, reload, install or configure Full Calendar. Users may configure Full Calendar themselves to display the same iCloud calendar.
