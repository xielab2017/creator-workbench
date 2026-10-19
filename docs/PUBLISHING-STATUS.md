# Publishing status — 2026-10-19

- Public repository: https://github.com/xielab2017/creator-workbench
- License: MIT, explicitly selected by the owner.
- GitHub release: https://github.com/xielab2017/creator-workbench/releases/tag/2.0.0
- Release state: published pre-release, not a draft. It is not yet a community-directory approval.
- Assets: separate `main.js`, `manifest.json`, `styles.css`, optional manual-install ZIP and SHA-256 checksums.
- Verification: all five GitHub server asset digests match local files. The downloaded runtime assets and ZIP also match local files byte-for-byte; ZIP CRC passes.
- Local checks: 9 pure-rule checks and 24 bundled DOM/HTTPS integration tests pass, plus the release contract and packaging checks.
- GitHub CI: not enabled because the publishing credential lacks `workflow` scope. An owner-enableable template is provided in `docs/ci-check.yml`.
- Community account: signed in and linked to the repository owner `xielab2017`. The new-plugin form contains the repository URL and owner selection.
- Official submission: not submitted yet. The form requires the owner to agree to Developer Policies and commit to continued maintenance or removal/transfer if maintenance stops. Those checkboxes remain unchecked pending the owner's explicit confirmation.
- Remaining validation: native clean-vault launch/dragging and version 2's independent live iCloud adapter are not confirmed. See `VALIDATION.md`.

No passwords, personal vault configuration, authentication screenshots or personal calendar URLs are included in this repository. Local verification records and the prepared test vault are excluded by `.gitignore`.
