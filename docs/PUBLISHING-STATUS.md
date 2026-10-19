# Publishing status — 2026-10-19

- Public repository: https://github.com/xielab2017/creator-workbench
- License: MIT, explicitly selected by the owner.
- Current plugin identity: Creation Studio (`xielab-creation-studio`), version 2.0.1.
- GitHub release target: https://github.com/xielab2017/creator-workbench/releases/tag/2.0.1
- Release state: 2.0.1 prepared for publication; the earlier 2.0.0 pre-release is superseded. GitHub publication is separate from community-directory approval.
- Assets: separate `main.js`, `manifest.json`, `styles.css`, optional manual-install ZIP and SHA-256 checksums.
- Verification: local 2.0.1 ZIP CRC and asset byte comparisons pass. Remote 2.0.1 assets have not yet been checked.
- Local checks: 9 pure-rule checks and 25 bundled DOM/HTTPS integration tests pass, plus the release contract and packaging checks.
- GitHub CI: not enabled because the publishing credential lacks `workflow` scope. An owner-enableable template is provided in `docs/ci-check.yml`.
- Community account: signed in and linked to the repository owner `xielab2017`. The new-plugin form contains the repository URL and owner selection.
- Official submission: the owner explicitly approved the Developer Policies and continued-maintenance commitments and authorized submission. The first attempt was rejected because the unrelated plugin by Yao3596 already owns `creator-workbench`. Version 2.0.1 uses the independent ID above and is being prepared for resubmission. No directory approval has been received.
- Remaining validation: native clean-vault launch/dragging and version 2's independent live iCloud adapter are not confirmed. See `VALIDATION.md`.

No passwords, personal vault configuration, authentication screenshots or personal calendar URLs are included in this repository. Local verification records and the prepared test vault are excluded by `.gitignore`.
