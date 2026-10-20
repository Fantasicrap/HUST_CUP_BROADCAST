"""Explicit one-time model setup. Network access is confined to this installer."""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

folder = Path(sys.argv[1]).resolve()
folder.mkdir(parents=True, exist_ok=True)
model = folder / 'u2net_human_seg.onnx'
url = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_human_seg.onnx'
expected = 'c09ddc2e0104f800e3e1bb4652583d1f'
if not model.exists() or hashlib.md5(model.read_bytes()).hexdigest() != expected:
    print('Downloading the optional human segmentation model (~176 MB)...', flush=True)
    temp = model.with_suffix('.download')
    urllib.request.urlretrieve(url, temp)
    if hashlib.md5(temp.read_bytes()).hexdigest() != expected:
        temp.unlink(missing_ok=True)
        raise RuntimeError('Model checksum mismatch; original assets are unchanged.')
    temp.replace(model)
from rembg import new_session
new_session('u2net_custom', model_path=str(model), providers=['CPUExecutionProvider'])
(folder / 'ready.json').write_text(json.dumps({'model':'u2net_human_seg','md5':expected}), encoding='utf-8')
print('Local portrait removal ready. No network is used during photo processing.', flush=True)
