"""Optional local CPU inference. This worker never downloads models or sends photographs."""
import json
import os
import sys
from pathlib import Path

def main():
    from PIL import Image, ImageOps
    from rembg import new_session, remove
    source, output, model = map(Path, sys.argv[1:4])
    if not model.is_file():
        raise RuntimeError('MODEL_MISSING')
    # A custom local session bypasses all model download code during a photo job.
    session = new_session('u2net_custom', model_path=str(model), providers=['CPUExecutionProvider'])
    Image.MAX_IMAGE_PIXELS = 24_000_000
    with Image.open(source) as image:
        if image.width * image.height > 24_000_000:
            raise ValueError('IMAGE_TOO_LARGE')
        image = ImageOps.exif_transpose(image).convert('RGB')
        image.thumbnail((2000, 2000), Image.Resampling.LANCZOS)
        cutout = remove(image, session=session).convert('RGBA')
    alpha = cutout.getchannel('A')
    bbox = alpha.point(lambda n: 255 if n > 16 else 0).getbbox()
    if bbox is None:
        raise ValueError('NO_PERSON')
    # Trim empty margin with a small breathing space; never crop into the detected body.
    pad = max(8, round(max(bbox[2]-bbox[0], bbox[3]-bbox[1]) * .035))
    bbox = (max(0,bbox[0]-pad),max(0,bbox[1]-pad),min(cutout.width,bbox[2]+pad),min(cutout.height,bbox[3]+pad))
    cutout = cutout.crop(bbox)
    cutout.save(output, format='PNG')
    print(json.dumps({'width':cutout.width,'height':cutout.height}))

if __name__ == '__main__':
    main()
