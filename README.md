# Creation Studio

A six-view creation workflow for Obsidian: dashboard, ideas, production board, publication calendar, work library and performance review. Each work is a single Markdown note; all views use its properties.

**Current interface language: Chinese. Desktop only. Requires Obsidian 1.14.4 or later.**

## Features

- One-time setup creates linked pages, templates, Bases views and a bundled banner in a vault folder you choose. Existing files are skipped, never overwritten.
- Track idea → writing → recording → editing → ready to publish → review → archived. Image/text work can skip recording and editing.
- Drag cards between stages and scheduled work between calendar dates. Moving a date preserves its production stage.
- Set monthly goals and record work metrics and account snapshots. Missing values remain missing, rather than becoming zero.
- Optional examples show the workflow. They are excluded from real totals and all calendar writes.
- Optional one-way iCloud CalDAV sync shares publication schedules with Mac Calendar. Full Calendar can separately display the same iCloud calendar.

## Install and start

Until this plugin is approved in the community directory, download `main.js`, `manifest.json` and `styles.css` from a GitHub release into `<vault>/.obsidian/plugins/xielab-creation-studio/`. Enable **Creation Studio** in Obsidian's Community plugins settings.

1. Click the workbench ribbon icon, or run **Creation Studio: 打开创作工作台** from the command palette.
2. Choose a vault-relative folder. Example works are optional and off by default.
3. Select **创建并打开** to initialize the six pages.
4. Use **新建作品** to create your first real work. Fill in the original angle, draft, media links, next action and publication schedule in the same note.

Settings → **Creation Studio** lets you initialize another folder or fill in missing files. Selecting a different folder pauses cloud sync. The basic workflow needs no external account, network access, Dataview or other community plugin. Enable the built-in **Bases** plugin only if you use the backup `.base` tables.

The plugin stores title, draft, production checklists, media links and review notes in your vault. It does not publish posts to any content platform or retrieve platform analytics; enter observed metrics yourself.

## Optional iCloud calendar sync

1. In Mac Calendar, create a dedicated calendar named **创作排期** under your iCloud account.
2. In the plugin settings, save your Apple account and an [app-specific password](https://support.apple.com/en-us/102654).
3. Use **测试连接** to discover and check the named calendar. This does not create an event.
4. Explicitly enable **自动同步排期**. Only real works with `is_demo: false`, a valid work ID and a publication date are eligible.

The default server is `https://caldav.icloud.com/`. Mainland China accounts can use `https://caldav.icloud.com.cn/`. Advanced settings accept a specific iCloud CalDAV calendar collection URL. All transport targets and redirects must use HTTPS on an `icloud.com` or `icloud.com.cn` host; certificate verification remains enabled.

**Network and account disclosure:** Optional calendar sync sends the Apple account authentication and the work title, platform, production stage, publication date/time, unique work ID and an Obsidian note link to the selected iCloud calendar. The link contains the vault name and work file path. It does not send the draft, media contents, platform metrics or unrelated vault notes. The app-specific password is stored only under this plugin's independent Obsidian SecretStorage key, not in `data.json` or generated notes. No telemetry, ads, paid features, external backend or remote image requests are included. Runtime access outside the vault is limited to Obsidian's SecretStorage API; the plugin does not read arbitrary external files.

**Direction and limits:** Obsidian notes → iCloud calendar. Mac Calendar and any separately configured Full Calendar instance read that same calendar. Their edits do not update work properties. Calendar sync runs only while Obsidian and the plugin are open. Full Calendar is not required, and this plugin never reads or changes its settings, credentials or installation.

- A fixed UID/resource is used for each work; rescheduling updates the same event.
- No time means an all-day event. A specified Shanghai time reserves 30 minutes as a publication reminder, not production duration. Published works use the actual publication day as an all-day event.
- Removing a schedule, parking a work or deleting its note marks only previously managed events cancelled; no event is deleted.
- Writes use conditional creation and ETags. Conflicts stop the write and require review/retry.
- Pausing sync or uninstalling retains existing cloud events and vault notes. Changing account/calendar/folder keeps the old target's event mapping separate and leaves its events intact.

See [privacy details](docs/PRIVACY.md), [Chinese guide](docs/使用说明.md) and [validation scope](docs/VALIDATION.md).

## Upgrading from the local template bundle

Version 2.0.1 is named **Creation Studio**, with plugin ID `xielab-creation-studio`, because `creator-workbench` is already used by an unrelated community plugin. The repository URL stays the same. Use 2.0.1 or later rather than the superseded 2.0.0 preview.

Disable the earlier local workbench plugin before enabling Creation Studio. Keep your existing workspace folder. Existing work-note types and the older `creator-hub` dashboard fence remain supported; new pages use `creation-studio` and scoped UI styles. Configure this plugin's own calendar connection before enabling sync. Credentials are not imported from the previous plugin ID or Full Calendar. You do not need to re-import the old template ZIP. Initialization skips existing notes; use the updated guide in this repository for the current calendar settings.

## Development

```bash
npm ci --ignore-scripts
npm run check
```

Node.js 22.13 or later is required for development (the provided CI template targets Node 24 LTS). Runtime only requires the desktop Obsidian app. The build bundles source modules, templates and the local PNG into `main.js`; only `obsidian` and Node's built-in `node:https` remain external. No runtime code is downloaded.

Local checks passed on Node 26.7.0. GitHub CI is not enabled yet: the publishing credential does not have the `workflow` scope. The owner can copy [docs/ci-check.yml](docs/ci-check.yml) to `.github/workflows/check.yml` using an authorized GitHub session. The template pins the official checkout/setup-node actions and runs the same checks.

See [release procedure](docs/RELEASING.md). Releases attach `main.js`, `manifest.json` and `styles.css` with a tag exactly matching `manifest.json.version`. Community directory approval is separate from publishing a GitHub release.

## Credits and license

MIT; see [LICENSE](LICENSE). The warm paper/banner artwork was generated with the built-in OpenAI image tool; [prompt](assets/banner-prompt.txt). It is bundled locally. No images or code from the inspiration post were copied. The six-section workflow was inspired by [Xuan子's creator dashboard explanation](https://www.xiaohongshu.com/explore/6ac273e7000000000a026c73). UI icons use Obsidian's built-in icon API. Obsidian is a trademark of Dynalist Inc.; this is an independent community plugin.
