# Changelog

## 2.0.1

- Rename the public plugin to Creation Studio with unique ID `xielab-creation-studio` after the community directory reported the old ID occupied by an unrelated plugin.
- Scope UI styles and internal calendar events to the independent plugin identity.
- Use the `creation-studio` Markdown fence for new pages while supporting existing `creator-hub` dashboards and work-note types.
- Keep the repository URL and existing work data unchanged; calendar credentials require independent setup under the new ID.

## 2.0.0

- Bundle the six workspace pages, templates, Bases views and original banner into a standalone installable plugin.
- Add first-run setup, configurable vault folder, optional examples and non-overwriting repair.
- Add independent, opt-in iCloud CalDAV settings and a plugin-owned SecretStorage entry.
- Remove all automatic Full Calendar configuration, credential reuse and plugin-manager access.
- Add explicit HTTPS/host checks, controlled redirects, conflict protection and separate event maps per sync target.
- Validate card/date drag persistence, setup and calendar lifecycle through automated tests.
- Set the supported baseline to desktop Obsidian 1.14.4; pause the legacy sync connection during migration.
