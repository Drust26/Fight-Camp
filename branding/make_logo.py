"""Builds the Fight Camp logo files (text outlined from the bundled Oswald/Inter fonts, so no font is needed to view them)."""
import math, os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.dirname(os.path.abspath(__file__))
NM = os.path.join(ROOT, '..', 'node_modules', '@fontsource')
OSWALD = TTFont(os.path.join(NM, 'oswald', 'files', 'oswald-latin-700-normal.woff'))
INTER = TTFont(os.path.join(NM, 'inter', 'files', 'inter-latin-700-normal.woff'))
ORANGE, RED = '#ff5a36', '#c81e1e'

def text_path(font, s, size, x, y, tracking=0.0, skew=0.0):
    """Outline `s` with its baseline at (x, y); returns (path d, advance width)."""
    gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font['head'].unitsPerEm
    k = size / upm; pen = SVGPathPen(gs); cx = 0.0
    for ch in s:
        g = cmap.get(ord(ch))
        if g is None: cx += size * 0.3; continue
        # font units → svg: scale, flip y, shear for italics
        t = TransformPen(pen, (k, 0, k * skew, -k, x + cx, y))
        gs[g].draw(t)
        cx += gs[g].width * k + tracking * size
    return pen.getCommands(), cx - tracking * size

def width(font, s, size, tracking=0.0):
    return text_path(font, s, size, 0, 0, tracking)[1]

def octagon(cx, cy, r):
    pts = [(cx + r * math.cos(math.radians(22.5 + 45 * i)), cy + r * math.sin(math.radians(22.5 + 45 * i))) for i in range(8)]
    return ' '.join(f'{px:.1f},{py:.1f}' for px, py in pts)

def icon_body(rounded=True, simple=False):
    """512×512 icon: dark tile, cage octagon, chain-link inside, 'FC' monogram over a hand-wrap band."""
    fc_size = 280 if simple else 250
    w = width(OSWALD, 'FC', fc_size, -0.01)
    d, _ = text_path(OSWALD, 'FC', fc_size, 256 - w / 2 - 0.14 * fc_size * 0.36, 256 + fc_size * 0.36, -0.01, skew=0.14)
    mesh = []
    for i in range(-12, 13):
        o = i * 26
        mesh.append(f'M{256 + o - 300},{256 - 300} l600,600')
        mesh.append(f'M{256 + o + 300},{256 - 300} l-600,600')
    return f'''
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2230"/><stop offset="1" stop-color="#07080c"/></linearGradient>
    <linearGradient id="wrap" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{RED}"/><stop offset="1" stop-color="{ORANGE}"/></linearGradient>
    <linearGradient id="ink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9dee8"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.6"><stop offset="0" stop-color="{ORANGE}" stop-opacity="0.28"/><stop offset="1" stop-color="{ORANGE}" stop-opacity="0"/></radialGradient>
    <clipPath id="cage"><polygon points="{octagon(256, 256, 196)}"/></clipPath>
  </defs>
  <rect width="512" height="512" rx="{112 if rounded else 0}" fill="url(#tile)"/>
  <rect width="512" height="512" rx="{112 if rounded else 0}" fill="url(#glow)"/>
  {'' if simple else f"""<g clip-path="url(#cage)"><path d="{' '.join(mesh)}" stroke="#ffffff" stroke-opacity="0.07" stroke-width="3" fill="none"/></g>"""}
  <polygon points="{octagon(256, 256, 220 if simple else 214)}" fill="none" stroke="{ORANGE}" stroke-width="{36 if simple else 22}" stroke-linejoin="round"/>
  {'' if simple else f"""<polygon points="{octagon(256, 256, 188)}" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="4" stroke-linejoin="round"/>"""}
  <g clip-path="url(#cage)"><polygon points="40,330 472,222 472,284 40,392" fill="url(#wrap)" opacity="0.95"/></g>
  <path d="{d}" fill="url(#ink)" stroke="#07080c" stroke-width="10" stroke-linejoin="round" paint-order="stroke"/>'''

def icon_svg(rounded=True, simple=False):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">{icon_body(rounded, simple)}\n</svg>\n'

def wordmark_svg(dark_text=False):
    """Horizontal lockup: icon + FIGHT CAMP + CAREER MODE."""
    size = 150
    d1, w1 = text_path(OSWALD, 'FIGHT', size, 0, 0, 0.02, skew=0.12)
    d2, w2 = text_path(OSWALD, 'CAMP', size, 0, 0, 0.02, skew=0.12)
    gap = 34
    tx = 560
    fd, fw = text_path(OSWALD, 'FIGHT', size, tx, 300, 0.02, skew=0.12)
    cd, cw = text_path(OSWALD, 'CAMP', size, tx + fw + gap, 300, 0.02, skew=0.12)
    total = fw + gap + cw
    tag_size = 34
    tw = width(INTER, 'CAREER MODE', tag_size, 0.42)
    td, _ = text_path(INTER, 'CAREER MODE', tag_size, tx + 6, 382, 0.42)
    W = int(tx + total + 50)
    fg = '#0b0d12' if dark_text else '#ffffff'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} 512" width="{W}" height="512">
  <g transform="translate(24,24) scale(0.906)">{icon_body(True)}</g>
  <path d="{fd}" fill="{fg}"/>
  <path d="{cd}" fill="{ORANGE}"/>
  <rect x="{tx + 8}" y="330" width="{total - 8}" height="8" fill="{ORANGE}" opacity="0.9" transform="skewX(-7)" transform-origin="{tx} 334"/>
  <path d="{td}" fill="{'#5b6372' if dark_text else '#9aa3b2'}"/>
</svg>
'''

out = sys.argv[1] if len(sys.argv) > 1 else ROOT
open(os.path.join(out, 'logo-icon.svg'), 'w').write(icon_svg(True))
open(os.path.join(out, 'logo-icon-square.svg'), 'w').write(icon_svg(False))
open(os.path.join(out, 'logo-icon-small.svg'), 'w').write(icon_svg(True, True))
open(os.path.join(out, 'logo-wordmark.svg'), 'w').write(wordmark_svg(False))
open(os.path.join(out, 'logo-wordmark-light.svg'), 'w').write(wordmark_svg(True))
print('written to', out)
