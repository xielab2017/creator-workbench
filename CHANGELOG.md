# Changelog

## 2.0.0

- Bundle the six workspace pages, templates, Bases views and original banner into a standalone installable plugin.
- Add first-run setup, configurable vault folder, optional examples and non-overwriting repair.
- Add independent, opt-in iCloud CalDAV settings and a plugin-owned SecretStorage entry.
- Remove all automatic Full Calendar configuration, credential reuse and plugin-manager access.
- Add explicit HTTPS/host checks, controlled redirects, conflict protection and separate event maps per sync target.
- Validate card/date drag persistence, setup and calendar lifecycle through automated tests.
- Set the supported baseline to desktop Obsidian 1.14.4; pause the legacy sync connection during migration.
