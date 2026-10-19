Creation Studio 2.0.1 uses the independent plugin ID `xielab-creation-studio`. The earlier `creator-workbench` ID was rejected by the community directory because an unrelated author's plugin already owns it. The repository URL remains unchanged; this is original code and not a fork of that plugin.

The release bundles a six-view creation workspace, templates, Bases views and an original local banner. Setup supports a chosen vault folder, optional examples and non-overwriting repair. Existing note types and legacy `creator-hub` dashboards remain readable; new pages use `creation-studio` and independently scoped UI styles.

Disable the earlier local workbench plugin before enabling Creation Studio. Keep existing work notes in place. Calendar credentials are not imported from the previous ID or Full Calendar; configure this plugin's own optional iCloud connection before enabling sync.

Current interface: Chinese. Desktop Obsidian 1.14.4 or later. MIT license.

Validation: 9 pure-rule checks and 25 bundled DOM/HTTPS integration tests pass, including persisted card/date dragging, legacy fence support, non-overwriting initialization and a simulated create/reschedule/cancel lifecycle. Metadata, private-data exclusions and installation ZIP integrity are checked. Native clean-vault launch/dragging and live iCloud writes remain pending. This is a pre-release while those checks are outstanding; GitHub publication is separate from community-directory approval. See docs/VALIDATION.md.
