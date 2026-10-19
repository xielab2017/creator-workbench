#!/usr/bin/env python3
"""Create a deterministic manual-install archive with only the release assets."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'manifest.json').read_text())
plugin_id = manifest['id']
target = root / 'dist'
target.mkdir(exist_ok=True)
archive = target / f"{plugin_id}-{manifest['version']}.zip"
assets = ['main.js', 'manifest.json', 'styles.css']
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
    for name in assets:
        info = zipfile.ZipInfo(plugin_id + '/' + name, date_time=(1980, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        bundle.writestr(info, (root / name).read_bytes())
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    assert sorted(bundle.namelist()) == [plugin_id + '/' + name for name in sorted(assets)]
    for name in assets:
        assert bundle.read(plugin_id + '/' + name) == (root / name).read_bytes()
checksums = {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in assets}
checksums[archive.name] = hashlib.sha256(archive.read_bytes()).hexdigest()
(target / 'checksums.sha256').write_text(''.join(f'{digest}  {name}\n' for name, digest in checksums.items()))
print(f'Packaged {archive.name}: 3 release assets; CRC and byte comparison passed.')
