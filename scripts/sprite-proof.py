from PIL import Image, ImageDraw
from pathlib import Path
items = [Path('public/particles') / f'{kind}-{n:02}.png' for kind in ('petal','snow') for n in range(1,13)]
out = Image.new('RGB',(1200,500),'#84abd6')
for i,p in enumerate(items):
    im = Image.open(p).convert('RGBA'); im.thumbnail((130,100)); x=(i%8)*150+10; y=(i//8)*160+10; out.paste(im,(x,y),im)
    ImageDraw.Draw(out).text((x,y+107),p.stem,fill='white')
out.save('sprite-proof.png')
