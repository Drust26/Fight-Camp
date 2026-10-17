"""Renders the logo SVGs to PNG (Chromium via Playwright) and packs the Windows .ico."""
import os, pathlib, time
from playwright.sync_api import sync_playwright
from PIL import Image
B = pathlib.Path(__file__).parent
OUT = B / 'png'; OUT.mkdir(exist_ok=True)
jobs = [('logo-icon-small.svg', s) for s in (16, 24, 32)] + [('logo-icon.svg', s) for s in (48, 64, 128, 256, 512, 1024)]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    for name, size in jobs + [('logo-wordmark.svg', 0), ('logo-wordmark-light.svg', 0)]:
        svg = (B / name).read_text()
        if size:
            pg.set_viewport_size({'width': size, 'height': size})
            pg.set_content(f"<style>html,body{{margin:0;background:transparent}}svg{{width:{size}px;height:{size}px;display:block}}</style>{svg}")
            dst = OUT / f'icon-{size}.png'
        else:
            pg.set_viewport_size({'width': 1600, 'height': 400})
            pg.set_content(f"<style>html,body{{margin:0;background:transparent}}svg{{height:400px;width:auto;display:block}}</style>{svg}")
            dst = OUT / name.replace('.svg', '.png')
        time.sleep(0.1)
        pg.locator('svg').screenshot(path=str(dst), omit_background=True)
    b.close()
imgs = {s: Image.open(OUT / f'icon-{s}.png').convert('RGBA') for s in (16, 24, 32, 48, 64, 128, 256)}
imgs[256].save(B / 'icon.ico', format='ICO', sizes=[(s, s) for s in imgs], append_images=[imgs[s] for s in (16, 24, 32, 48, 64, 128)])
print('ico', os.path.getsize(B / 'icon.ico'), 'bytes')
