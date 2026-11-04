from PIL import Image
import numpy as np
from collections import deque
from pathlib import Path
folder = Path('public/particles')
for path in folder.glob('*.png'):
    image = Image.open(path).convert('RGBA')
    a = np.array(image)
    # Remove green spill and stray disconnected pixels left by the green screen.
    
    mask = a[:, :, 3] > 35
    seen = np.zeros(mask.shape, bool)
    groups = []
    height, width = mask.shape
    for y in range(height):
        for x in range(width):
            if not mask[y, x] or seen[y, x]: continue
            queue = deque([(y, x)]); seen[y, x] = True; points = []
            while queue:
                cy, cx = queue.popleft(); points.append((cy, cx))
                for ny, nx in ((cy-1,cx),(cy+1,cx),(cy,cx-1),(cy,cx+1)):
                    if 0 <= ny < height and 0 <= nx < width and mask[ny,nx] and not seen[ny,nx]:
                        seen[ny,nx] = True; queue.append((ny,nx))
            groups.append(points)
    if groups:
        largest = max(groups, key=len)
        keep = np.zeros(mask.shape, bool)
        for y,x in largest: keep[y,x] = True
        # Keep anti-aliased border within two pixels of the principal motif.
        for _ in range(2):
            keep = keep | np.roll(keep,1,0) | np.roll(keep,-1,0) | np.roll(keep,1,1) | np.roll(keep,-1,1)
        a[~keep,3] = 0
    Image.fromarray(a).save(path,optimize=True)
print('Cleaned sprite edges and neighboring artifacts')

