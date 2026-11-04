from pathlib import Path
from PIL import Image
import numpy as np

SOURCE = Path(r'C:\Users\Miku\AppData\Local\Temp\codex-clipboard-63eab979-4c2d-4c4b-a891-df9194c37064.png')
DEST = Path(__file__).resolve().parent.parent / 'public' / 'particles'
# Coordinates mark isolated objects in the supplied 1536 x 1024 source sheet.
SPRITES = {
    'petal-01': (112, 174, 274, 294), 'petal-02': (436, 78, 561, 195),
    'petal-03': (485, 186, 731, 388), 'petal-04': (1167, 180, 1343, 359),
    'petal-05': (1298, 409, 1505, 573), 'petal-06': (835, 488, 964, 608),
    'petal-07': (382, 515, 560, 631), 'petal-08': (108, 611, 350, 812),
    'petal-09': (1045, 677, 1195, 811), 'petal-10': (1162, 798, 1401, 947),
    'petal-11': (707, 838, 835, 937), 'petal-12': (1374, 57, 1459, 153),
    'snow-01': (288, 29, 375, 120), 'snow-02': (809, 9, 928, 132),
    'snow-03': (983, 107, 1108, 240), 'snow-04': (379, 256, 492, 373),
    'snow-05': (1119, 456, 1232, 589), 'snow-06': (538, 633, 635, 749),
    'snow-07': (1225, 616, 1330, 719), 'snow-08': (997, 817, 1110, 934),
    'snow-09': (294, 843, 383, 947), 'snow-10': (1141, 39, 1222, 121),
    'snow-11': (663, 349, 758, 438), 'snow-12': (55, 239, 125, 313),
}

rgb = np.asarray(Image.open(SOURCE).convert('RGB'), dtype=np.float32)
# Chromakey based on green dominance; retain anti-aliased outlines while removing lime spill.
green_excess = rgb[:, :, 1] - np.maximum(rgb[:, :, 0], rgb[:, :, 2])
alpha = np.clip((105 - green_excess) / 65, 0, 1)
alpha[green_excess > 70] = 0
alpha[alpha < .15] = 0
# Unblend green from soft edges to keep the pink/white outline clean on blue backgrounds.
clean = rgb.copy()
clean[:, :, 1] = np.minimum(clean[:, :, 1], np.maximum(clean[:, :, 0], clean[:, :, 2]) + 6)
rgba = np.dstack((clean, alpha * 255)).astype('uint8')
image = Image.fromarray(rgba, 'RGBA')
for name, box in SPRITES.items():
    tile = image.crop(box)
    trim = tile.getchannel('A').getbbox()
    if trim:
        tile = tile.crop(trim)
        tile.thumbnail((240, 200), Image.Resampling.LANCZOS)
        tile.save(DEST / f'{name}.png', optimize=True)
print(f'Wrote {len(SPRITES)} transparent sprites to {DEST}')




