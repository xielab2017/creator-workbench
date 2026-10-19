# Release procedure

## Prepare

1. Review the [developer policies](https://docs.obsidian.md/community-directory/developer-policies), [submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins) and [official submission guide](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin).
2. Confirm ownership, MIT license, public repository contents and the unique plugin ID `xielab-creation-studio`.
3. Update `package.json`, `manifest.json`, `versions.json`, the changelog and release notes together. The release tag must exactly match the manifest's `x.y.z`, without an added `v` prefix.
4. Run `npm ci --ignore-scripts`, `npm run check` and `npm run release:zip` (the last command also requires Python 3).
5. Test the three release assets in a clean desktop vault. First-run setup should create the pages without relying on a copied template folder. Verify the stage drag and calendar-date drag both persist to the work note.
6. Verify the opt-in connection with an iCloud account before claiming live calendar coverage. The automated lifecycle tests use mocked HTTPS; they are not a live-service test.
7. Confirm that no `data.json`, local test vault, credentials, personal calendar URLs or unrelated screenshots are tracked. The installation ZIP must contain only the plugin directory and the three release assets.

## GitHub

Create the public source repository under the chosen owner and push the reviewed commit. The CI template is currently stored at `docs/ci-check.yml` because the publishing credential lacks the `workflow` scope. An authorized owner can enable it by copying it to `.github/workflows/check.yml` and then wait for its Check run to pass. Until that happens, report local validation explicitly instead of claiming CI passed. Create a release using the exact version tag and attach `main.js`, `manifest.json` and `styles.css` as separate assets; the manual-install ZIP is optional. Do not attach personal configuration. The root manifest must match the release tag and assets.

## Community directory

Sign in to [Obsidian Community](https://community.obsidian.md) with the author's Obsidian account and link the corresponding GitHub account. Add the repository using the directory's submission UI. Resolve scanner feedback by updating source and publishing a new, incremented release. GitHub publication does not itself mean acceptance into the community directory.

If sign-in, account linking, or new terms require the account owner's action, keep the reviewed repository, release assets and submission text ready, and let the owner complete that step.

Suggested listing text is in [SUBMISSION.md](SUBMISSION.md). Check `docs/VALIDATION.md` for the exact tested scope before publishing claims.
