#!/usr/bin/env python3
"""Validate the archived router UI without contacting Mihomo."""
import hashlib
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'router-ui'
expected = {}
for line in (root / 'SHA256SUMS').read_text().splitlines():
    digest, name = line.split('  ', 1)
    path = Path(name)
    assert not path.is_absolute() and '..' not in path.parts, name
    assert name not in expected, name
    expected[name] = digest
actual = {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and p != root / 'SHA256SUMS'}
assert actual == set(expected), f'File list differs: {actual ^ set(expected)}'
for name, digest in expected.items():
    path = root / name
    assert not path.is_symlink(), name
    assert hashlib.sha256(path.read_bytes()).hexdigest() == digest, name
marker = json.loads((root / 'rey-policy-picker.json').read_text())
assert marker == {'baseVersion': '1.261.3', 'customization': 'rey-policy-picker', 'revision': 1}
for name in ('index.html', '200.html', '404.html'):
    html = (root / name).read_text()
    assert '<title>MetaCubeXD</title>' in html, name
    for url in re.findall(r'(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"', html):
        if url.startswith(('http:', 'https:', 'data:', '//', '#')):
            continue
        assert (root / url.removeprefix('./').lstrip('/')).exists(), (name, url)
config = (root / 'config.js').read_text()
assert "defaultBackendURL: ''" in config
print(f'PASS: {len(expected)} router files, hashes, version marker and HTML resources')
