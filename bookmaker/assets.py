from PIL import Image, ImageDraw
from pathlib import Path
import sys
root = Path(__file__).resolve().parent.parent / 'web' / 'bookmaker'
if len(sys.argv) > 1:
    Image.open(Path(sys.argv[1])).convert('RGB').save(root / 'background.webp', quality=85, method=6)
for size in (192, 512):
    im = Image.new('RGB', (size, size), '#254b40')
    d = ImageDraw.Draw(im)
    def coords(points): return [(int(x*size), int(y*size)) for x,y in points]
    d.polygon(coords([(.25,.28),(.43,.31),(.5,.37),(.57,.31),(.75,.28),(.75,.69),(.57,.73),(.5,.79),(.43,.73),(.25,.69)]), fill='#ecf0da')
    d.line(coords([(.5,.38),(.5,.72)]),fill='#789b7f',width=max(2,int(size*.015)))
    for y in (.42,.51,.6):
        d.line(coords([(.3,y),(.43,y+.025)]),fill='#a2b79a',width=max(2,int(size*.011)))
        d.line(coords([(.57,y+.025),(.7,y)]),fill='#a2b79a',width=max(2,int(size*.011)))
    im.save(root / f'icon-{size}.png')
