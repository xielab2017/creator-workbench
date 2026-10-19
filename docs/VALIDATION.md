# Validation

## Automated checks

Run `npm run check`. The suite uses the actual bundled `main.js` with a simulated Obsidian API, a DOM, an in-memory vault and a mocked HTTPS boundary. It checks persisted note changes rather than only calling isolated drag callbacks.

- 9 pure data-rule checks: missing/zero metrics, complete rates, demo exclusion, month boundaries, schedule/stage independence and input validation.
- 11 workspace/UI integration tests: first-run setup, bundled assets, resolved internal links, Bases YAML, no-overwrite repair, path rejection, examples, all six views, card and date drag persistence, publication-date gates, legacy migration and workspace switching.
- 13 calendar tests: UTC/all-day encoding, UTF-8 folding, CR escaping, explicit real-work eligibility, no inferred publication time, independent credentials, CalDAV discovery, property/XML rejection, HTTPS host validation, controlled redirects, conditional writes, conflicts, complete create/reschedule/cancel lifecycle and pause/unload handling.
- Release contract checks: metadata/version consistency, supported runtime imports, required documentation/license and private-data exclusions.
- Packaging checks: ZIP CRC, expected asset list and byte-for-byte asset comparison.

The build is unminified and source is included in the repository. Development dependencies are pinned in `package-lock.json`. The production bundle has no third-party runtime dependencies; it imports Obsidian and built-in Node HTTPS.

Local validation used Node 26.7.0. GitHub CI has not run: the current publishing credential lacks `workflow` scope. An enableable CI template is provided in `docs/ci-check.yml`; this is not an active workflow or a passing CI result.

## Manual and live-service checks

An isolated desktop test vault was prepared using only the three release assets. Native automation could not complete the macOS folder-selection dialog, so a clean-vault launch and native drag checks remain pending. Automated DOM/HTTPS tests are not a claim that native dragging or real iCloud writes have been verified. No personal-vault screenshots are included in this repository.

The earlier local bundle displayed all six views on macOS / Obsidian 1.14.4 and discovered the dedicated iCloud calendar, but it used a different calendar adapter. Those connection results do not validate version 2's independent connection. No real calendar creation, rescheduling or cancellation has yet been executed with the version 2 adapter. Account authentication is required for that test.

Mobile is not supported in this release. Performance on large vaults, other desktop operating systems and long-running network outages has not been validated.
