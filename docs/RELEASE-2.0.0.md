Creator Workbench 2.0.0 introduces a standalone, six-view creation workspace with bundled templates and an original local banner. First-run setup supports a chosen vault folder and optional examples, and skips existing files.

Calendar sync is optional and uses an independent plugin-owned SecretStorage entry and iCloud CalDAV connection. The plugin does not read or modify Full Calendar's configuration or credentials. Legacy connections are paused on upgrade; configure the new connection before enabling sync.

Current interface: Chinese. Desktop Obsidian 1.14.4 or later. MIT license.

Validation: 9 pure-rule checks and 24 bundled DOM/HTTPS integration tests pass, including persisted card/date dragging, non-overwriting initialization and a simulated create/reschedule/cancel lifecycle. Metadata, private-data exclusions and installation ZIP integrity are checked. Clean native-vault launch, native drag and the independent adapter's live iCloud writes remain pending; see docs/VALIDATION.md. This release is marked pre-release while those checks are outstanding. Publishing this GitHub release does not mean community-directory approval.
