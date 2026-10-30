# Frostmere (map 3): Hearthwick, the ice-fishing village. The Hearth Lodge, Pell's Trading Post, the smokehouse, the
# sauna, painted cabins, a stilt cache, the bell tower, Mira's carving shed, the kennels, the ice shanties, tip-ups,
# lamp posts, the bonfire, rink boards, ice sculptures, the dog sled and the sled dogs.
#   python3 art/src/hearthwick.py      -> art/hearthwick.blend + art/hearthwick.glb
#   node scripts/glb-to-js.mjs art/hearthwick.glb src/data/hearthwickMesh.js HEARTHWICK
# Game axes: x right, y up, z forward (the front door faces +z). Every piece stands on its origin. Sizes passed to the
# kit are half extents in Blender order (game x, game z, game y).
import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
import bpy
from kit import Model, mat, reset, export

OUT = os.path.join(os.path.dirname(__file__), '..', 'hearthwick')
G = lambda x, y, z: (x, -z, y)
reset()
LOG = mat('hw_log', '#7c5434', 0.95)
LOGD = mat('hw_log_dark', '#5c3d26', 0.95)
LOGL = mat('hw_log_light', '#956a42', 0.95)
END = mat('hw_log_end', '#c49a6a', 0.9)  # cut log ends
SNOW = mat('hw_snow', '#f3f7fb', 0.75)
SHINGLE = mat('hw_shingle', '#4a3c38', 0.9)
SLATE = mat('hw_roof_slate', '#3e4a56', 0.8)
STONE = mat('hw_stone', '#8c8e92', 0.95)
STONED = mat('hw_stone_dark', '#6a6c72', 0.95)
CREAM = mat('hw_cream', '#ece2c8', 0.8)
OXBLOOD = mat('hw_oxblood', '#8c2f28', 0.75)
MUSTARD = mat('hw_mustard', '#d29b2e', 0.75)
TEAL = mat('hw_teal', '#2c7c78', 0.75)
FOREST = mat('hw_forest', '#2f5c3c', 0.75)
NAVY = mat('hw_navy', '#2c4060', 0.75)
WIN = mat('hw_window', '#ffd890', 0.4, emit='#f0a850')
GLASS = mat('hw_glass_dark', '#2a3a48', 0.1)
IRON = mat('hw_iron', '#3a3c40', 0.5, 0.6)
BRASS = mat('hw_brass', '#c9a24a', 0.3, 0.9)
CEDAR = mat('hw_cedar', '#a8683e', 0.85)
CEDARD = mat('hw_cedar_dark', '#7e4a2a', 0.85)
PLANK = mat('hw_plank', '#8a6a48', 0.95)
FUR = mat('hw_fur', '#8a6a4a', 1.0)
FURW = mat('hw_fur_white', '#e8e4dc', 1.0)
FISH = mat('hw_fish_smoked', '#c8763a', 0.6)
CLOTHR = mat('hw_cloth_red', '#b8322c', 0.9)
CLOTHB = mat('hw_cloth_blue', '#2f5f9a', 0.9)
ICE = mat('hw_ice', '#a8dcf0', 0.12)
ICED = mat('hw_ice_deep', '#6ab2d8', 0.1)
FLAME = mat('hw_flame', '#ffb040', 0.5, emit='#ff8a20')
EMBER = mat('hw_ember', '#ff6a20', 0.5, emit='#ff4a10')
ORANGE = mat('hw_orange', '#f06a20', 0.7)
ROPE = mat('hw_rope', '#d8c8a0', 0.95)
DOGG = mat('hw_dog_grey', '#7a7e86', 1.0)
DOGW = mat('hw_dog_white', '#f0eee8', 1.0)
DOGB = mat('hw_dog_black', '#2a2a2e', 1.0)
DOGN = mat('hw_dog_nose', '#1a1a1a', 0.4)
DOGE = mat('hw_dog_eye', '#6ab0e8', 0.3)
HARN = mat('hw_harness', '#c8302a', 0.7)
objs = []

# ------------------------------------------------------------------ building helpers
def logs_x(md, x0, x1, z, y0, n, r=0.17, over=0.35, mats=(LOG, LOGD, LOGL)):
    """A log wall running along x at depth z, n logs high from y0; the log ends poke out past the corners."""
    for k in range(n):
        m = mats[k % len(mats)]
        y = y0 + r + k * r * 1.85
        md.part('cyl', m, loc=G((x0 + x1) / 2, y, z), size=(r, r, (x1 - x0) / 2 + over), seg=8, rot=(0, 90, 0))
        for xe in (x0 - over, x1 + over): md.part('cyl', END, loc=G(xe, y, z), size=(r * 0.92, r * 0.92, 0.012), seg=8, rot=(0, 90, 0))
def logs_z(md, z0, z1, x, y0, n, r=0.17, over=0.35, mats=(LOGD, LOG, LOGL)):
    for k in range(n):
        m = mats[k % len(mats)]
        y = y0 + r * 1.9 + k * r * 1.85  # (half a log up from the x walls: the corners interlock)
        md.part('cyl', m, loc=G(x, y, (z0 + z1) / 2), size=(r, r, (z1 - z0) / 2 + over), seg=8, rot=(90, 0, 0))
        for ze in (z0 - over, z1 + over): md.part('cyl', END, loc=G(x, y, ze), size=(r * 0.92, r * 0.92, 0.012), seg=8, rot=(90, 0, 0))
def gable_logs(md, x0, x1, z, y0, rise, r=0.17):
    """A gable end filled with logs that shorten toward the ridge (the roof runs along z)."""
    n = int(rise / (r * 1.85))
    for k in range(n):
        y = y0 + r + k * r * 1.85
        half = ((x1 - x0) / 2) * (1 - (k + 0.6) / (n + 0.4))
        if half < 0.2: break
        cx = (x0 + x1) / 2
        md.part('cyl', LOG if k % 2 else LOGD, loc=G(cx, y, z), size=(r, r, half), seg=8, rot=(0, 90, 0))
def roof(md, x0, x1, z0, z1, y0, rise, over=0.6, m=SHINGLE, snow=True, thick=0.12):
    """A gable roof whose ridge runs along z (slopes fall to x0 and x1), with an overhang and snow lying on it."""
    W = (x1 - x0) / 2; cx = (x0 + x1) / 2; L = math.hypot(W + over, rise + over * rise / W)
    ang = math.degrees(math.atan2(rise, W))
    for s in (-1, 1):
        mx = cx + s * (W + over) / 2; my = y0 + rise - (rise + over * rise / W) / 2 + 0.05
        md.part('box', m, loc=G(mx, my, (z0 + z1) / 2), size=(L / 2, (z1 - z0) / 2 + over, thick), rot=(0, s * ang, 0))
        if snow:
            md.part('rbox', SNOW, loc=G(mx - s * 0.02, my + thick + 0.08, (z0 + z1) / 2), size=(L / 2 - 0.05, (z1 - z0) / 2 + over - 0.05, 0.12), r=0.1, rot=(0, s * ang, 0))
            md.part('cyl', SNOW, loc=G(mx + s * (L / 2 - 0.1) * math.cos(math.radians(ang)), my - (L / 2 - 0.1) * math.sin(math.radians(ang)) + thick + 0.06, (z0 + z1) / 2), size=(0.14, 0.14, (z1 - z0) / 2 + over), seg=6, rot=(90, 0, 0))
    md.part('cyl', m, loc=G(cx, y0 + rise + 0.05, (z0 + z1) / 2), size=(0.14, 0.14, (z1 - z0) / 2 + over + 0.05), seg=6, rot=(90, 0, 0))
    if snow: md.part('cyl', SNOW, loc=G(cx, y0 + rise + 0.18, (z0 + z1) / 2), size=(0.2, 0.2, (z1 - z0) / 2 + over), seg=8, rot=(90, 0, 0))
def window(md, x, y, z, w=0.55, h=0.6, face='z', trim=CREAM, shutters=None):
    """A lit window (four panes) with a cream frame; face 'z' (in the x-y plane) or 'x' (in the z-y plane)."""
    if face == 'z':
        md.part('box', WIN, loc=G(x, y, z), size=(w, 0.03, h))
        for dx in (-w, w): md.part('box', trim, loc=G(x + dx, y, z + 0.02), size=(0.06, 0.06, h + 0.06))
        for dy in (-h, h): md.part('box', trim, loc=G(x, y + dy, z + 0.02), size=(w + 0.06, 0.06, 0.06))
        md.part('box', trim, loc=G(x, y, z + 0.03), size=(0.03, 0.04, h)); md.part('box', trim, loc=G(x, y, z + 0.03), size=(w, 0.04, 0.03))
        md.part('box', trim, loc=G(x, y - h - 0.1, z + 0.08), size=(w + 0.14, 0.12, 0.05))  # the sill
        if shutters:
            for s in (-1, 1): md.part('box', shutters, loc=G(x + s * (w + 0.3), y, z + 0.04), size=(0.24, 0.04, h + 0.04))
    else:
        md.part('box', WIN, loc=G(x, y, z), size=(0.03, w, h))
        for dz in (-w, w): md.part('box', trim, loc=G(x + 0.02, y, z + dz), size=(0.06, 0.06, h + 0.06))
        for dy in (-h, h): md.part('box', trim, loc=G(x + 0.02, y + dy, z), size=(0.06, w + 0.06, 0.06))
        md.part('box', trim, loc=G(x + 0.03, y, z), size=(0.04, 0.03, h)); md.part('box', trim, loc=G(x + 0.03, y, z), size=(0.04, w, 0.03))
        if shutters:
            for s in (-1, 1): md.part('box', shutters, loc=G(x + 0.04, y, z + s * (w + 0.3)), size=(0.04, 0.24, h + 0.04))
def door(md, x, y, z, w=0.55, h=1.05, m=OXBLOOD, face='z'):
    if face == 'z':
        md.part('box', m, loc=G(x, y + h, z), size=(w, 0.05, h))
        md.part('box', CREAM, loc=G(x, y + 2 * h + 0.08, z + 0.04), size=(w + 0.12, 0.08, 0.08))
        for dx in (-w - 0.06, w + 0.06): md.part('box', CREAM, loc=G(x + dx, y + h, z + 0.04), size=(0.06, 0.06, h + 0.04))
        md.part('rock', BRASS, loc=G(x + w * 0.7, y + h, z + 0.08), size=(0.05, 0.05, 0.05), sub=1)
        for dy in (0.35, 1.0, 1.65): md.part('box', IRON, loc=G(x - w * 0.3, y + dy, z + 0.06), size=(w * 0.55, 0.02, 0.03))
    else:
        md.part('box', m, loc=G(x, y + h, z), size=(0.05, w, h))
        md.part('rock', BRASS, loc=G(x + 0.08, y + h, z + w * 0.7), size=(0.05, 0.05, 0.05), sub=1)
def chimney(md, x, z, y0, y1, w=0.45):
    md.part('rbox', STONE, loc=G(x, (y0 + y1) / 2, z), size=(w, w, (y1 - y0) / 2), r=0.05, amp=0.03, freq=4)
    for k in range(int((y1 - y0) / 0.5)):
        md.part('box', STONED, loc=G(x, y0 + 0.25 + k * 0.5, z), size=(w + 0.02, w + 0.02, 0.03))
    md.part('rbox', STONED, loc=G(x, y1 + 0.08, z), size=(w + 0.08, w + 0.08, 0.08), r=0.03)
    md.part('rbox', SNOW, loc=G(x, y1 + 0.2, z), size=(w + 0.05, w + 0.05, 0.05), r=0.04)
def stovepipe(md, x, z, y0, y1):
    md.part('cyl', IRON, loc=G(x, (y0 + y1) / 2, z), size=(0.11, 0.11, (y1 - y0) / 2), seg=10)
    md.part('cyl', IRON, loc=G(x, y1 + 0.12, z), size=(0.24, 0.24, 0.03), seg=10, top=0.2)
def woodpile(md, x, z, n=3, rows=3, ry=0):
    for r_ in range(rows):
        for k in range(n - (r_ % 2)):
            md.part('cyl', LOGL if (k + r_) % 2 else LOG, loc=G(x + (k - n / 2 + 0.5 + (r_ % 2) * 0.5) * 0.3, 0.15 + r_ * 0.26, z), size=(0.14, 0.14, 0.45), seg=7, rot=(90, 0, ry))
            md.part('cyl', END, loc=G(x + (k - n / 2 + 0.5 + (r_ % 2) * 0.5) * 0.3, 0.15 + r_ * 0.26, z + 0.46), size=(0.13, 0.13, 0.01), seg=7, rot=(90, 0, ry))
    md.part('rbox', SNOW, loc=G(x, 0.17 + rows * 0.26, z), size=(n * 0.15, 0.45, 0.06), r=0.05)
def porch(md, x0, x1, z0, z1, y, roof_y, posts=4):
    md.part('box', PLANK, loc=G((x0 + x1) / 2, y, (z0 + z1) / 2), size=((x1 - x0) / 2, (z1 - z0) / 2, 0.08))
    for k in range(posts):
        x = x0 + 0.15 + k * (x1 - x0 - 0.3) / (posts - 1)
        md.part('cyl', LOGL, loc=G(x, (y + roof_y) / 2, z1 - 0.15), size=(0.1, 0.1, (roof_y - y) / 2), seg=7)
    md.part('box', SHINGLE, loc=G((x0 + x1) / 2, roof_y + 0.06, (z0 + z1) / 2 + 0.1), size=((x1 - x0) / 2 + 0.25, (z1 - z0) / 2 + 0.35, 0.07), rot=(-10, 0, 0))
    md.part('rbox', SNOW, loc=G((x0 + x1) / 2, roof_y + 0.17, (z0 + z1) / 2 + 0.1), size=((x1 - x0) / 2 + 0.2, (z1 - z0) / 2 + 0.3, 0.07), r=0.05, rot=(-10, 0, 0))
    for k in range(3): md.part('box', PLANK, loc=G((x0 + x1) / 2, y - 0.12 - k * 0.14, z1 + 0.18 + k * 0.28), size=(0.8, 0.14, 0.05))  # steps

# ------------------------------------------------------------------ the Hearth Lodge: two storeys of logs, a stone chimney, a porch
md = Model('hw_lodge')
W, D = 8.0, 5.5  # half width (x), half depth (z)
md.part('box', STONED, loc=G(0, 0.25, 0), size=(W + 0.3, D + 0.3, 0.3))  # the stone footing
logs_x(md, -W, W, D, 0.5, 15); logs_x(md, -W, W, -D, 0.5, 15)
logs_z(md, -D, D, -W, 0.5, 15); logs_z(md, -D, D, W, 0.5, 15)
WH = 0.5 + 15 * 0.17 * 1.85 + 0.2  # wall top
# the roof's ridge runs along x here (gables at the sides): build it as the z-ridge helper turned by swapping axes
def roof_x(md, x0, x1, z0, z1, y0, rise, over=0.7, m=SHINGLE):
    Dh = (z1 - z0) / 2; cz = (z0 + z1) / 2; L = math.hypot(Dh + over, rise + over * rise / Dh); ang = math.degrees(math.atan2(rise, Dh))
    for s in (-1, 1):
        mz = cz + s * (Dh + over) / 2; my = y0 + rise - (rise + over * rise / Dh) / 2 + 0.05
        md.part('box', m, loc=G((x0 + x1) / 2, my, mz), size=((x1 - x0) / 2 + over, L / 2, 0.12), rot=(s * ang, 0, 0))
        md.part('rbox', SNOW, loc=G((x0 + x1) / 2, my + 0.2, mz - s * 0.02), size=((x1 - x0) / 2 + over - 0.05, L / 2 - 0.05, 0.13), r=0.1, rot=(s * ang, 0, 0))
        md.part('cyl', SNOW, loc=G((x0 + x1) / 2, my - (L / 2 - 0.1) * math.sin(math.radians(ang)) + 0.18, mz + s * (L / 2 - 0.1) * math.cos(math.radians(ang))), size=(0.15, 0.15, (x1 - x0) / 2 + over), seg=6, rot=(0, 90, 0))
    md.part('cyl', SNOW, loc=G((x0 + x1) / 2, y0 + rise + 0.2, cz), size=(0.22, 0.22, (x1 - x0) / 2 + over), seg=8, rot=(0, 90, 0))
roof_x(md, -W, W, -D, D, WH, 4.2)
for s in (-1, 1):  # gable ends (logs shortening toward the ridge), with a round window in each
    n = 11
    for k in range(n):
        y = WH + 0.17 + k * 0.17 * 1.85; half = D * (1 - (k + 0.6) / (n + 0.4))
        if half < 0.25: break
        md.part('cyl', LOG if k % 2 else LOGD, loc=G(s * W, y, 0), size=(0.17, 0.17, half), seg=8, rot=(90, 0, 0))
    md.part('cyl', WIN, loc=G(s * (W + 0.18), WH + 1.6, 0), size=(0.45, 0.45, 0.03), seg=16, rot=(0, 90, 0))
    md.part('torus', CREAM, loc=G(s * (W + 0.2), WH + 1.6, 0), size=(0.47, 0.47, 0.47), tube=0.12, seg=16, ring=4, rot=(0, 90, 0))
# windows: ground floor either side of the door, upper floor across the front; the back and sides too
for x in (-5.5, -3.2, 3.2, 5.5): window(md, x, 1.9, D + 0.2, shutters=FOREST)
for x in (-5.5, -2.8, 0, 2.8, 5.5): window(md, x, 4.4, D + 0.2, w=0.45, h=0.5, shutters=FOREST)
for x in (-4.5, 0, 4.5): window(md, x, 1.9, -D - 0.2); window(md, x, 4.4, -D - 0.2, w=0.45, h=0.5)
for z in (-2.5, 2.5): window(md, -W - 0.2, 1.9, z, face='x'); window(md, W + 0.2, 1.9, z, face='x')
# the big double door, the porch along the front, the chimney on the east gable, antlers over the door
door(md, -0.62, 0.5, D + 0.18, w=0.6, h=1.15, m=OXBLOOD); door(md, 0.62, 0.5, D + 0.18, w=0.6, h=1.15, m=OXBLOOD)
porch(md, -6.5, 6.5, D, D + 2.4, 0.55, 3.0, posts=6)
chimney(md, W + 0.85, 0, 0.3, WH + 6.0, w=0.75)
md.part('sweep', CREAM, points=[G(-0.5, 3.6, D + 0.3), G(-0.9, 3.95, D + 0.35), G(-1.2, 4.3, D + 0.3)], r=0.05, ring=5)
md.part('sweep', CREAM, points=[G(0.5, 3.6, D + 0.3), G(0.9, 3.95, D + 0.35), G(1.2, 4.3, D + 0.3)], r=0.05, ring=5)
for s in (-1, 1):
    md.part('sweep', CREAM, points=[G(s * 0.8, 3.9, D + 0.33), G(s * 0.95, 4.25, D + 0.4)], r=0.035, ring=4)
    md.part('sweep', CREAM, points=[G(s * 1.05, 4.15, D + 0.33), G(s * 1.25, 4.4, D + 0.38)], r=0.03, ring=4)
md.part('rbox', OXBLOOD, loc=G(0, 3.3, D + 0.25), size=(2.0, 0.06, 0.32), r=0.04)  # the sign board (lettering by the game)
woodpile(md, -W - 1.2, -2.0, n=5, rows=4)
objs.append(md.finish())

# ------------------------------------------------------------------ Pell's Trading Post: a false front, a porch of goods
md = Model('hw_tradingpost')
W, D = 4.6, 3.6
md.part('box', STONED, loc=G(0, 0.2, 0), size=(W + 0.2, D + 0.2, 0.2))
logs_x(md, -W, W, -D, 0.4, 10); logs_z(md, -D, D, -W, 0.4, 10); logs_z(md, -D, D, W, 0.4, 10)
WH = 0.4 + 10 * 0.17 * 1.85 + 0.2
roof(md, -W, W, -D, D - 0.75, WH, 2.4)  # (v1.17.1: the roof stops behind the false front, never in front of the sign)
# the painted false front (planks, teal with cream trim), standing clear above the roof: a proper frontier storefront
md.part('box', TEAL, loc=G(0, (WH + 3.2) / 2, D - 0.02), size=(W, 0.04, (WH + 3.2) / 2))  # backing: no gaps between the planks
for s in (-1, 1): md.part('box', TEAL, loc=G(s * (W - 0.04), WH + 1.6, D - 0.45), size=(0.05, 0.45, 1.6))  # short side returns, so it reads as a solid front
md.part('box', CREAM, loc=G(0, WH + 3.42, D + 0.05), size=(W + 0.35, 0.32, 0.1))  # the cornice
for k in range(9): md.part('box', CREAM, loc=G(-W + 0.2 + k * (2 * W - 0.4) / 8, WH + 3.17, D + 0.16), size=(0.07, 0.12, 0.16))  # its brackets
md.part('box', CREAM, loc=G(0, WH + 3.85, D + 0.02), size=(1.1, 0.06, 0.32))  # a little pediment on top
md.part('box', SNOW, loc=G(0, WH + 3.78, D + 0.05), size=(W + 0.3, 0.3, 0.05))  # snow on the cornice
for k in range(18): md.part('box', TEAL, loc=G(-W + 0.26 + k * (2 * W - 0.5) / 17, (WH + 3.2) / 2, D + 0.05), size=(0.25, 0.05, (WH + 3.2) / 2 - 0.05))
md.part('box', CREAM, loc=G(0, WH + 3.25, D + 0.1), size=(W + 0.2, 0.1, 0.12))
for s in (-1, 1): md.part('box', CREAM, loc=G(s * W, (WH + 3.2) / 2, D + 0.1), size=(0.12, 0.1, (WH + 3.2) / 2))
md.part('rbox', CREAM, loc=G(0, WH + 1.9, D + 0.14), size=(W - 0.6, 0.06, 0.75), r=0.05)  # the sign board
window(md, -2.6, 1.6, D + 0.12, w=0.85, h=0.65, trim=CREAM); window(md, 2.6, 1.6, D + 0.12, w=0.85, h=0.65, trim=CREAM)
door(md, 0, 0.4, D + 0.12, w=0.55, h=1.1, m=MUSTARD)
porch(md, -W, W, D, D + 2.0, 0.45, 2.7, posts=4)
# goods on the porch: crates, a barrel of ice augers, furs hanging, a pair of snowshoes on the wall
for k, (x, z) in enumerate(((-3.6, D + 1.1), (-3.0, D + 1.5), (-3.3, D + 0.8))):
    md.part('rbox', PLANK if k % 2 else LOGL, loc=G(x, 0.75 + (0.45 if k == 2 else 0), z), size=(0.3, 0.3, 0.28), r=0.02)
md.part('cyl', LOGD, loc=G(3.4, 0.95, D + 1.2), size=(0.32, 0.32, 0.45), seg=12)
for k in range(4): md.part('cyl', IRON, loc=G(3.3 + (k % 2) * 0.18, 1.6, D + 1.1 + (k // 2) * 0.18), size=(0.03, 0.03, 0.5), seg=6, rot=(8, 0, k * 20))
for k, m in enumerate((FUR, FURW, FUR)):
    md.part('rbox', m, loc=G(-1.5 + k * 0.45, 2.0, D + 0.22), size=(0.18, 0.03, 0.42), r=0.08, amp=0.02, freq=4, seed=k)
for s in (-1, 1): md.part('torus', LOGD, loc=G(1.4 + s * 0.3, 2.1, D + 0.22), size=(0.2, 0.2, 0.38), tube=0.1, seg=12, ring=4, rot=(90, 0, 0))
stovepipe(md, -2.0, -1.0, WH + 1.0, WH + 2.8)
objs.append(md.finish())

# ------------------------------------------------------------------ the smokehouse, with its fish racks
md = Model('hw_smokehouse')
W, D = 2.4, 2.2
logs_x(md, -W, W, D, 0.0, 8, mats=(LOGD, LOG)); logs_x(md, -W, W, -D, 0.0, 8, mats=(LOGD, LOG)); logs_z(md, -D, D, -W, 0.0, 8); logs_z(md, -D, D, W, 0.0, 8)
WH = 8 * 0.17 * 1.85 + 0.25
roof(md, -W, W, -D, D, WH, 1.8)
md.part('rbox', SHINGLE, loc=G(0, WH + 2.0, 0), size=(0.45, 0.6, 0.3), r=0.05)  # the smoke vent on the ridge
md.part('rbox', SNOW, loc=G(0, WH + 2.35, 0), size=(0.5, 0.65, 0.06), r=0.04)
door(md, 0, 0.0, D + 0.18, w=0.45, h=0.95, m=LOGD)
for s in (-1, 1):  # a drying rack either side of the door, hung with split fish
    x = s * 2.2
    for z in (D + 0.8, D + 2.4): md.part('cyl', LOGL, loc=G(x, 0.95, z), size=(0.06, 0.06, 0.95), seg=6)
    md.part('cyl', LOGL, loc=G(x, 1.85, D + 1.6), size=(0.05, 0.05, 0.85), seg=6, rot=(90, 0, 0))
    for k in range(5): md.part('rbox', FISH, loc=G(x, 1.45, D + 0.95 + k * 0.33), size=(0.03, 0.11, 0.35), r=0.03)
objs.append(md.finish())

# ------------------------------------------------------------------ the sauna: cedar boards, a stovepipe, a bench, a bucket
md = Model('hw_sauna')
W, D = 2.2, 1.9
for k in range(22): md.part('box', CEDAR if k % 2 else CEDARD, loc=G(-W + 0.1 + k * (2 * W - 0.2) / 21, 1.2, D), size=(0.1, 0.04, 1.2))
for k in range(22): md.part('box', CEDAR if k % 2 else CEDARD, loc=G(-W + 0.1 + k * (2 * W - 0.2) / 21, 1.2, -D), size=(0.1, 0.04, 1.2))
for z in range(19):
    zz = -D + 0.1 + z * (2 * D - 0.2) / 18
    for s in (-1, 1): md.part('box', CEDAR if z % 2 else CEDARD, loc=G(s * W, 1.2, zz), size=(0.04, 0.1, 1.2))
roof(md, -W, W, -D, D, 2.4, 1.3, m=SLATE)
# v1.17.1: the gable ends under the roof, front and back (boards cut to the slope), with a little vent in each
for zs in (D, -D):
    for k in range(21):
        x = -W + 0.1 + k * (2 * W - 0.2) / 20; h = max(0.02, 1.3 * (1 - abs(x) / W))
        md.part('box', CEDAR if k % 2 else CEDARD, loc=G(x, 2.4 + h / 2, zs), size=(0.11, 0.04, h / 2))
    md.part('box', CEDARD, loc=G(0, 2.95, zs + (0.05 if zs > 0 else -0.05)), size=(0.22, 0.03, 0.1))
    md.part('box', CREAM, loc=G(0, 2.95, zs + (0.07 if zs > 0 else -0.07)), size=(0.25, 0.02, 0.025))
door(md, -0.8, 0.0, D + 0.05, w=0.4, h=0.95, m=CEDARD)
window(md, 0.9, 1.5, D + 0.06, w=0.35, h=0.25)
stovepipe(md, 1.2, -1.0, 2.6, 4.8)
md.part('box', PLANK, loc=G(0, 0.06, D + 0.9), size=(W, 0.8, 0.06))  # a little deck out front
md.part('box', CEDARD, loc=G(1.2, 0.45, D + 1.25), size=(0.8, 0.2, 0.05)); md.part('box', CEDARD, loc=G(1.2, 0.22, D + 1.25), size=(0.06, 0.15, 0.2))
md.part('cyl', CEDAR, loc=G(-1.6, 0.25, D + 1.2), size=(0.22, 0.22, 0.25), seg=12, top=1.15)
md.part('torus', BRASS, loc=G(-1.6, 0.4, D + 1.2), size=(0.24, 0.24, 0.24), tube=0.08, seg=12, ring=4)
woodpile(md, -W - 0.8, 0.0, n=4, rows=3)
objs.append(md.finish())

# ------------------------------------------------------------------ cabins, in three paint schemes
def cabin(name, trim, door_m):
    md = Model(name)
    W, D = 3.0, 2.4
    md.part('box', STONED, loc=G(0, 0.15, 0), size=(W + 0.1, D + 0.1, 0.15))
    logs_x(md, -W, W, D, 0.3, 9); logs_x(md, -W, W, -D, 0.3, 9); logs_z(md, -D, D, -W, 0.3, 9); logs_z(md, -D, D, W, 0.3, 9)
    WH = 0.3 + 9 * 0.17 * 1.85 + 0.2
    roof(md, -W, W, -D, D, WH, 2.2)
    for s in (-1, 1):  # the gable ends: painted boards in the trim colour
        md.part('poly', trim, loc=G(0, WH, s * (D + 0.05)), points=[(-W, 0), (W, 0), (0, 2.1)], depth=0.08)
        md.part('box', CREAM, loc=G(0, WH + 0.02, s * (D + 0.1)), size=(W, 0.03, 0.05))
    window(md, 1.6, 1.6, D + 0.18, w=0.45, h=0.45, shutters=trim)
    window(md, -W - 0.18, 1.6, 0.6, w=0.45, h=0.45, face='x', shutters=trim)
    window(md, 0, WH + 0.8, D + 0.14, w=0.3, h=0.3)
    door(md, -1.0, 0.3, D + 0.18, w=0.45, h=0.95, m=door_m)
    md.part('box', PLANK, loc=G(-1.0, 0.25, D + 0.65), size=(0.8, 0.45, 0.06))
    stovepipe(md, 1.6, -0.8, WH + 1.0, WH + 2.6)
    woodpile(md, W + 0.7, -1.0, n=3, rows=3)
    return md.finish()
objs += [cabin('hw_cabin_red', OXBLOOD, MUSTARD), cabin('hw_cabin_yellow', MUSTARD, TEAL), cabin('hw_cabin_teal', TEAL, OXBLOOD), cabin('hw_cabin_green', FOREST, OXBLOOD)]

md = Model('hw_cache')  # a little storehouse up on stilts (away from the bears)
for x in (-0.9, 0.9):
    for z in (-0.8, 0.8): md.part('cyl', LOGD, loc=G(x, 1.3, z), size=(0.12, 0.12, 1.3), seg=7)
md.part('box', PLANK, loc=G(0, 2.65, 0), size=(1.2, 1.1, 0.08))
logs_x(md, -1.0, 1.0, 0.85, 2.7, 4, r=0.13, over=0.15); logs_x(md, -1.0, 1.0, -0.85, 2.7, 4, r=0.13, over=0.15)
logs_z(md, -0.85, 0.85, -1.0, 2.7, 4, r=0.13, over=0.15); logs_z(md, -0.85, 0.85, 1.0, 2.7, 4, r=0.13, over=0.15)
roof(md, -1.0, 1.0, -0.85, 0.85, 3.75, 0.9, over=0.35)
door(md, 0, 2.75, 0.97, w=0.3, h=0.42, m=OXBLOOD)
for k in range(7): md.part('cyl', LOGL, loc=G(0.2, 0.2 + k * 0.38, 1.6 - k * 0.12), size=(0.03, 0.03, 0.3), seg=5, rot=(0, 90, 0))
for s in (-1, 1): md.part('cyl', LOGL, loc=G(0.2 + s * 0.3, 1.35, 1.25), size=(0.04, 0.04, 1.45), seg=5, rot=(-15, 0, 0))
objs.append(md.finish())

md = Model('hw_belltower')  # a timber bell tower on the green
for x in (-1.0, 1.0):
    for z in (-1.0, 1.0): md.part('cyl', LOGD, loc=G(x, 3.5, z), size=(0.16, 0.16, 3.5), seg=8, top=0.85)
for y in (1.2, 3.0, 5.2):
    for s in (-1, 1):
        md.part('box', LOG, loc=G(0, y, s * 1.0), size=(1.15, 0.08, 0.08)); md.part('box', LOG, loc=G(s * 1.0, y, 0), size=(0.08, 1.15, 0.08))
for s in (-1, 1):
    md.part('sweep', LOG, points=[G(-1.0, 1.25, s * 1.0), G(1.0, 2.95, s * 1.0)], r=0.06, ring=5)
    md.part('sweep', LOG, points=[G(s * 1.0, 1.25, -1.0), G(s * 1.0, 2.95, 1.0)], r=0.06, ring=5)
md.part('box', PLANK, loc=G(0, 5.3, 0), size=(1.2, 1.2, 0.08))
md.part('cyl', BRASS, loc=G(0, 6.0, 0), size=(0.45, 0.45, 0.5), seg=16, top=0.55)
md.part('torus', BRASS, loc=G(0, 5.55, 0), size=(0.47, 0.47, 0.47), tube=0.08, seg=16, ring=4)
md.part('rock', IRON, loc=G(0, 5.55, 0), size=(0.1, 0.1, 0.1), sub=1)
md.part('box', LOGD, loc=G(0, 6.65, 0), size=(0.7, 0.08, 0.08))
roof(md, -1.3, 1.3, -1.3, 1.3, 7.0, 1.4, over=0.25)
md.part('cyl', ROPE, loc=G(0.2, 3.0, 0), size=(0.02, 0.02, 2.6), seg=4)
objs.append(md.finish())

md = Model('hw_carvingshed')  # Mira's open-fronted carving shed
for x in (-2.4, 2.4):
    for z in (-1.6, 1.6): md.part('cyl', LOGD, loc=G(x, 1.3, z), size=(0.12, 0.12, 1.3), seg=7)
for k in range(10): md.part('box', PLANK if k % 2 else LOG, loc=G(-2.2 + k * 0.49, 1.2, -1.65), size=(0.24, 0.04, 1.2))
for s in (-1, 1):
    for k in range(7): md.part('box', PLANK if k % 2 else LOG, loc=G(s * 2.45, 1.2, -1.4 + k * 0.42), size=(0.04, 0.2, 1.2))
roof(md, -2.4, 2.4, -1.6, 1.6, 2.6, 1.1, m=SLATE)
md.part('rbox', LOGL, loc=G(0, 0.85, -0.6), size=(1.6, 0.5, 0.06), r=0.02)  # the bench
for x in (-1.3, 1.3): md.part('box', LOGD, loc=G(x, 0.4, -0.6), size=(0.06, 0.4, 0.4))
md.part('rbox', ICE, loc=G(-0.5, 1.2, -0.6), size=(0.3, 0.25, 0.3), r=0.06)  # a block of ice being carved
for k in range(4): md.part('box', IRON, loc=G(0.6 + k * 0.18, 0.95, -0.7), size=(0.02, 0.18, 0.015))
md.part('cyl', LOG, loc=G(1.8, 0.35, 0.8), size=(0.35, 0.35, 0.35), seg=10)
md.part('cyl', END, loc=G(1.8, 0.71, 0.8), size=(0.33, 0.33, 0.01), seg=10)
objs.append(md.finish())

# ------------------------------------------------------------------ the ice shanties (four colours) and tip-ups
def shanty(name, paint, trim):
    md = Model(name)
    md.part('box', LOGD, loc=G(-0.85, 0.08, 0), size=(0.07, 1.3, 0.07))  # runners
    md.part('box', LOGD, loc=G(0.85, 0.08, 0), size=(0.07, 1.3, 0.07))
    for s in (-1, 1): md.part('sweep', LOGD, points=[G(s * 0.85, 0.08, 1.3), G(s * 0.85, 0.2, 1.45), G(s * 0.85, 0.4, 1.5)], r=0.06, ring=5)
    md.part('box', PLANK, loc=G(0, 0.22, 0), size=(1.05, 1.25, 0.06))
    md.part('rbox', paint, loc=G(0, 1.25, 0), size=(1.0, 1.2, 1.0), r=0.04)
    for k in range(6): md.part('box', trim, loc=G(-1.0, 0.5 + k * 0.32, 0), size=(0.012, 1.2, 0.012))  # siding lines
    md.part('box', trim, loc=G(0, 2.28, 0), size=(1.08, 1.28, 0.06))
    md.part('box', SLATE, loc=G(0, 2.42, 0), size=(1.12, 1.32, 0.08), rot=(0, 0, 4))
    md.part('rbox', SNOW, loc=G(0, 2.55, -0.05), size=(1.05, 1.22, 0.06), r=0.05, rot=(0, 0, 4))
    door(md, 0.2, 0.25, 1.22, w=0.38, h=0.82, m=trim)
    window(md, -1.03, 1.45, -0.3, w=0.28, h=0.22, face='x', trim=trim)
    stovepipe(md, -0.55, -0.6, 2.4, 3.4)
    md.part('cyl', LOGL, loc=G(0.7, 2.9, -0.8), size=(0.025, 0.025, 0.55), seg=5)
    md.part('poly', CLOTHR if paint != OXBLOOD else MUSTARD, loc=G(0.72, 3.3, -0.8), points=[(0, 0), (0.42, -0.1), (0, -0.22)], depth=0.01)
    return md.finish()

md = Model('hw_shanty_inside')  # a shanty with the roof and the top of the walls cut away (the game shows it while you're inside)
# v1.17.1: rebuilt (the old one had its sizes in the wrong axes: walls lying flat, the floor standing up). Kit sizes are
# half extents in Blender order: (game x, game z, game y). Inside: 2.0 x 2.4, walls cut off at 1.35 m.
WH_ = 1.35
# the floor, with a square cut out where the hole is (local 0.15, 0.35: the game draws the hole in the ice below)
for (x0, x1, z0, z1) in ((-1.0, -0.3, -1.2, 1.2), (0.6, 1.0, -1.2, 1.2), (-0.3, 0.6, -1.2, -0.1), (-0.3, 0.6, 0.8, 1.2)):
    md.part('box', PLANK, loc=G((x0 + x1) / 2, 0.07, (z0 + z1) / 2), size=((x1 - x0) / 2, (z1 - z0) / 2, 0.05))
    md.part('box', LOGD, loc=G((x0 + x1) / 2, 0.03, (z0 + z1) / 2), size=((x1 - x0) / 2 + 0.02, (z1 - z0) / 2 + 0.02, 0.03))
for k in range(4): md.part('box', LOGD, loc=G(-0.86 + k * 0.19, 0.125, 0), size=(0.006, 1.2, 0.006))  # board lines
for (x0, x1, z0, z1) in ((-0.3, 0.6, -0.1, -0.06), (-0.3, 0.6, 0.76, 0.8), (-0.3, -0.26, -0.1, 0.8), (0.56, 0.6, -0.1, 0.8)):  # the hatch frame
    md.part('box', LOGL, loc=G((x0 + x1) / 2, 0.13, (z0 + z1) / 2), size=((x1 - x0) / 2, (z1 - z0) / 2, 0.02))
for s_ in (-1, 1): md.part('box', PLANK, loc=G(s_ * 0.98, WH_ / 2 + 0.1, 0), size=(0.04, 1.2, WH_ / 2))  # side walls
md.part('box', PLANK, loc=G(0, WH_ / 2 + 0.1, -1.18), size=(1.0, 0.04, WH_ / 2))                    # the back wall
for s_ in (-1, 1): md.part('box', PLANK, loc=G(s_ * 0.66, WH_ / 2 + 0.1, 1.18), size=(0.34, 0.04, WH_ / 2))  # the front, either side of the door
for x_ in [-0.95 + k * 0.19 for k in range(11)]:                                                    # wainscot battens round the walls
    md.part('box', LOGD, loc=G(x_, 0.45, -1.15), size=(0.012, 0.012, 0.32))
for z_ in [-1.1 + k * 0.22 for k in range(11)]:
    for s_ in (-1, 1): md.part('box', LOGD, loc=G(s_ * 0.95, 0.45, z_), size=(0.012, 0.012, 0.32))
md.part('box', CREAM, loc=G(0, 0.8, -1.15), size=(0.98, 0.02, 0.02)); [md.part('box', CREAM, loc=G(s_ * 0.95, 0.8, 0), size=(0.02, 1.18, 0.02)) for s_ in (-1, 1)]  # the chair rail
md.part('box', CREAM, loc=G(0, WH_ + 0.1, -1.18), size=(1.02, 0.06, 0.03))                           # cut wall caps
for s_ in (-1, 1): md.part('box', CREAM, loc=G(s_ * 0.98, WH_ + 0.1, 0), size=(0.06, 1.22, 0.03)); md.part('box', CREAM, loc=G(s_ * 0.66, WH_ + 0.1, 1.18), size=(0.36, 0.06, 0.03))
# the bench along the back with a cushion and a blanket
md.part('rbox', LOGL, loc=G(0, 0.48, -0.88), size=(0.88, 0.22, 0.04), r=0.02)
for x_ in (-0.75, 0.75): md.part('box', LOGD, loc=G(x_, 0.27, -0.88), size=(0.04, 0.18, 0.2))
md.part('rbox', CLOTHR, loc=G(-0.25, 0.54, -0.88), size=(0.45, 0.2, 0.03), r=0.02)
md.part('rbox', CLOTHB, loc=G(0.55, 0.55, -0.9), size=(0.25, 0.18, 0.05), r=0.04)
# the stove in the front corner: a box stove, its door glowing, a kettle, the pipe up and out
md.part('rbox', IRON, loc=G(-0.68, 0.4, 0.62), size=(0.2, 0.2, 0.24), r=0.03)
md.part('box', EMBER, loc=G(-0.68, 0.36, 0.83), size=(0.1, 0.01, 0.07))
md.part('cyl', IRON, loc=G(-0.68, 1.0, 0.55), size=(0.05, 0.05, 0.38), seg=8)
md.part('cyl', BRASS, loc=G(-0.62, 0.72, 0.66), size=(0.08, 0.08, 0.07), seg=10, top=0.7)
md.part('rbox', IRON, loc=G(-0.68, 0.2, 0.62), size=(0.24, 0.28, 0.02), r=0.01)                     # the hearth plate
# shelves on the side wall: a lantern, jars, a radio; hooks with a jig rod and a scoop
md.part('box', LOGL, loc=G(0.88, 1.05, -0.3), size=(0.1, 0.5, 0.02))
md.part('cyl', BRASS, loc=G(0.86, 1.15, -0.6), size=(0.05, 0.05, 0.08), seg=8); md.part('rock', WIN, loc=G(0.86, 1.16, -0.6), size=(0.04, 0.04, 0.05), sub=1)
for k in range(3): md.part('cyl', WIN if k == 1 else CREAM, loc=G(0.86, 1.12, -0.35 + k * 0.12), size=(0.035, 0.035, 0.06), seg=8)
md.part('rbox', OXBLOOD, loc=G(0.86, 1.13, 0.0), size=(0.06, 0.1, 0.06), r=0.01)
md.part('cyl', LOGL, loc=G(0.9, 0.95, 0.5), size=(0.012, 0.012, 0.4), seg=5, rot=(0, 0, 0))
md.part('cyl', CREAM, loc=G(0.86, 0.7, 0.75), size=(0.07, 0.07, 0.02), seg=10, rot=(0, 90, 0))
# the rug, the tackle box open, a bucket for the catch, a thermos
md.part('cyl', CLOTHB, loc=G(0.1, 0.13, -0.45), size=(0.42, 0.24, 0.01), seg=18)
md.part('rbox', LOGD, loc=G(0.62, 0.22, -0.45), size=(0.18, 0.12, 0.1), r=0.02); md.part('box', ORANGE, loc=G(0.62, 0.33, -0.45), size=(0.17, 0.11, 0.01))
md.part('cyl', IRON, loc=G(-0.45, 0.28, -0.5), size=(0.13, 0.13, 0.15), seg=12, top=1.15); md.part('torus', IRON, loc=G(-0.45, 0.44, -0.5), size=(0.15, 0.15, 0.15), tube=0.06, seg=12, ring=3)
md.part('cyl', CLOTHR, loc=G(-0.2, 0.25, -0.65), size=(0.04, 0.04, 0.12), seg=8)
# the window in the back wall (cut in half by the wall's top) and a calendar
md.part('box', CREAM, loc=G(0.3, 1.1, -1.16), size=(0.26, 0.02, 0.2)); md.part('box', WIN, loc=G(0.3, 1.1, -1.15), size=(0.22, 0.02, 0.16))
md.part('box', CREAM, loc=G(-0.45, 1.05, -1.16), size=(0.12, 0.01, 0.15)); md.part('box', OXBLOOD, loc=G(-0.45, 1.16, -1.155), size=(0.12, 0.01, 0.03))
objs.append(md.finish())

objs += [shanty('hw_shanty_red', OXBLOOD, CREAM), shanty('hw_shanty_yellow', MUSTARD, OXBLOOD), shanty('hw_shanty_blue', NAVY, CREAM), shanty('hw_shanty_green', FOREST, MUSTARD)]

md = Model('hw_tipup')  # a tip-up: crossed sticks over the hole, a spool under, the flag arm (hinged separately)
md.part('box', LOGL, loc=G(0, 0.05, 0), size=(0.55, 0.04, 0.03), rot=(0, 0, 0))
md.part('box', LOGL, loc=G(0, 0.08, 0), size=(0.04, 0.5, 0.03))
md.part('cyl', LOGL, loc=G(0, 0.25, 0), size=(0.025, 0.025, 0.2), seg=6)
md.part('cyl', ORANGE, loc=G(0, -0.05, 0), size=(0.06, 0.06, 0.05), seg=8, rot=(0, 0, 90))
objs.append(md.finish())
md = Model('hw_tipup_flag')  # hinged at its foot (origin); laid flat it points along +z, up it stands along +y
md.part('cyl', IRON, loc=G(0, 0, 0.45), size=(0.012, 0.012, 0.45), seg=5, rot=(90, 0, 0))
md.part('box', ORANGE, loc=G(0, 0.1, 0.78), size=(0.01, 0.12, 0.1))
objs.append(md.finish())

# ------------------------------------------------------------------ street furniture
md = Model('hw_lamppost')
md.part('cyl', IRON, loc=G(0, 1.3, 0), size=(0.05, 0.05, 1.3), seg=8)
md.part('cyl', IRON, loc=G(0, 0.08, 0), size=(0.16, 0.16, 0.08), seg=8)
md.part('box', IRON, loc=G(0, 2.62, 0), size=(0.16, 0.16, 0.02))
md.part('rbox', WIN, loc=G(0, 2.82, 0), size=(0.12, 0.12, 0.17), r=0.02)
for dx, dz in ((-0.13, -0.13), (0.13, -0.13), (-0.13, 0.13), (0.13, 0.13)): md.part('box', IRON, loc=G(dx, 2.82, dz), size=(0.012, 0.012, 0.18))
md.part('cyl', IRON, loc=G(0, 3.06, 0), size=(0.2, 0.2, 0.06), seg=8, top=0.3)
md.part('rbox', SNOW, loc=G(0, 3.13, 0), size=(0.14, 0.14, 0.04), r=0.03)
objs.append(md.finish())
md = Model('hw_bench')
md.part('rbox', LOGL, loc=G(0, 0.48, 0), size=(1.0, 0.22, 0.05), r=0.02)
md.part('rbox', LOGL, loc=G(0, 0.85, -0.2), size=(1.0, 0.04, 0.2), r=0.02, rot=(-10, 0, 0))
for x in (-0.85, 0.85): md.part('box', IRON, loc=G(x, 0.42, -0.05), size=(0.04, 0.24, 0.42))
md.part('rbox', SNOW, loc=G(0, 0.56, 0), size=(0.9, 0.18, 0.03), r=0.03)
objs.append(md.finish())
md = Model('hw_bonfire')  # a ring of stones and a log tipi (the flames are particles and a glow, in the game)
for k in range(12):
    a = k / 12 * math.tau
    md.part('rock', STONE if k % 2 else STONED, loc=G(math.cos(a) * 1.1, 0.12, math.sin(a) * 1.1), size=(0.28, 0.24, 0.18), sub=1, amp=0.06, freq=3, seed=k)
for k in range(7):
    a = k / 7 * math.tau
    md.part('sweep', LOG if k % 2 else LOGD, points=[G(math.cos(a) * 0.7, 0.05, math.sin(a) * 0.7), G(math.cos(a) * 0.1, 1.15, math.sin(a) * 0.1)], r=[0.09, 0.06], ring=6)
md.part('rock', EMBER, loc=G(0, 0.1, 0), size=(0.5, 0.5, 0.12), sub=2, amp=0.05, freq=4)
md.part('cyl', FLAME, loc=G(0, 0.55, 0), size=(0.35, 0.35, 0.45), seg=8, top=0.1)
objs.append(md.finish())
md = Model('hw_rinkwall')  # a 4 m section of rink boards (white, with a red kick strip)
md.part('box', CREAM, loc=G(0, 0.5, 0), size=(2.0, 0.05, 0.5))
md.part('box', OXBLOOD, loc=G(0, 0.12, 0.03), size=(2.0, 0.04, 0.11))
md.part('box', LOGL, loc=G(0, 1.02, 0), size=(2.02, 0.08, 0.04))
for x in (-1.95, 1.95): md.part('box', LOGD, loc=G(x, 0.5, -0.08), size=(0.06, 0.06, 0.55))
objs.append(md.finish())
md = Model('hw_skatehut')  # the skate rental booth by the rink
for k in range(12): md.part('box', MUSTARD if k % 2 else OXBLOOD, loc=G(-1.1 + k * 0.2, 1.1, -1.0), size=(0.1, 0.04, 1.1))
for s in (-1, 1):
    for k in range(10): md.part('box', MUSTARD if k % 2 else OXBLOOD, loc=G(s * 1.2, 1.1, -0.9 + k * 0.2), size=(0.04, 0.1, 1.1))
md.part('box', CREAM, loc=G(0, 0.5, 1.0), size=(1.2, 0.06, 0.5))
md.part('rbox', LOGL, loc=G(0, 1.05, 1.1), size=(1.25, 0.18, 0.05), r=0.02)
roof(md, -1.2, 1.2, -1.0, 1.0, 2.2, 0.8, over=0.35, m=SLATE)
for k in range(5):  # skates hanging inside
    md.part('box', IRON, loc=G(-0.8 + k * 0.4, 1.6, -0.9), size=(0.02, 0.14, 0.01))
    md.part('rbox', CREAM, loc=G(-0.8 + k * 0.4, 1.75, -0.9), size=(0.06, 0.12, 0.08), r=0.02)
md.part('rbox', CREAM, loc=G(0, 2.6, 1.05), size=(0.9, 0.04, 0.22), r=0.03)
objs.append(md.finish())
md = Model('hw_sign')  # the village sign on two posts
for x in (-1.1, 1.1): md.part('cyl', LOGD, loc=G(x, 1.1, 0), size=(0.1, 0.1, 1.1), seg=7)
md.part('rbox', OXBLOOD, loc=G(0, 1.75, 0.02), size=(1.3, 0.06, 0.38), r=0.04)
md.part('rbox', SNOW, loc=G(0, 2.17, 0), size=(1.35, 0.1, 0.05), r=0.04)
objs.append(md.finish())
# v1.17.1: the ice sculptures, carved properly: chiselled facets (flat shaded), three shades of ice for the light
# catching the cuts, frosted plinths of packed snow on a slab of clear ice, chips round the foot and a name plaque.
ICEL = mat('hw_ice_light', '#d6f2fc', 0.08); ICEF = mat('hw_ice_frost', '#e8f6fc', 0.6)
def plinth(md, w, d, h, title_w=0.5):
    md.part('rbox', ICED, loc=G(0, 0.06, 0), size=(w + 0.18, d + 0.18, 0.06), r=0.04)                     # a slab of clear ice
    md.part('rbox', SNOW, loc=G(0, 0.12 + h / 2, 0), size=(w, d, h / 2), r=0.06, amp=0.015, freq=6, seed=3)  # packed snow
    md.part('rbox', ICEF, loc=G(0, 0.14 + h, 0), size=(w + 0.05, d + 0.05, 0.035), r=0.02)                   # a frosted cap
    md.part('box', PLANK, loc=G(0, 0.12 + h * 0.55, d + 0.01), size=(title_w, 0.015, 0.09))                  # the plaque
    md.part('box', BRASS, loc=G(0, 0.12 + h * 0.55, d + 0.025), size=(title_w * 0.8, 0.008, 0.035))
    for k in range(7):  # chips of ice in the snow round the foot
        a = k / 7 * math.tau + 0.4; rr = max(w, d) + 0.32 + (k % 3) * 0.08
        md.part('rock', ICEL if k % 2 else ICE, loc=G(math.cos(a) * rr, 0.04, math.sin(a) * rr), size=(0.07 + (k % 3) * 0.03, 0.06, 0.04), sub=1, smooth=False)
    return 0.15 + h

def chisel(md, m, loc, size, rot=(0, 0, 0), sub=2, amp=0.03, seed=0):
    md.part('rock', m, loc=G(*loc), size=size, rot=rot, sub=sub, amp=amp, freq=3.0, seed=seed, smooth=False)

# --- a trout leaping out of a curling wave
md = Model('hw_icesculpt_fish')
top = plinth(md, 0.55, 0.42, 0.62)
for k in range(6):  # the wave: a crest curling up round the tail, in tongues of ice
    a = k / 6 * math.pi
    md.part('cyl', ICE if k % 2 else ICED, loc=G(-0.35 + k * 0.14, top + 0.25 + math.sin(a) * 0.12, -0.15 + (k % 2) * 0.12), size=(0.12, 0.12, 0.3 + math.sin(a) * 0.15), seg=6, top=0.15, rot=(-20 + k * 4, 0, -30 + k * 12), smooth=False)
chisel(md, ICEL, (0, top + 0.12, 0), (0.42, 0.32, 0.14), sub=2, amp=0.04, seed=1)  # foam at the wave's foot
# the body: a curve of flattened ovals rising from the tail to the head (thin side to side)
import math as _m
arc = [(-0.05, top + 0.42, -0.45, 0.06, 0.09), (0.0, top + 0.68, -0.35, 0.1, 0.17), (0.0, top + 0.98, -0.18, 0.13, 0.24), (0.0, top + 1.28, 0.02, 0.14, 0.26), (0.0, top + 1.55, 0.25, 0.13, 0.23), (0.0, top + 1.76, 0.5, 0.11, 0.18), (0.0, top + 1.9, 0.74, 0.08, 0.12)]
for i, (x, y, z, rx, rz) in enumerate(arc):
    tilt = 55 - i * 12
    chisel(md, ICE if i % 2 else ICEL, (x, y, z), (rx, rz * 1.45, rz), rot=(tilt, 0, 0), sub=2, amp=0.015, seed=10 + i)
chisel(md, ICED, (0, top + 1.25, 0.1), (0.09, 0.33, 0.15), rot=(40, 0, 0), sub=2, amp=0.01, seed=20)  # the belly line, deeper
# the tail: a forked fin of two lobes at the bottom of the arc
for s in (-1, 1): md.part('poly', ICEL, loc=G(0, top + 0.3, -0.52), points=[(0, 0), (0.42 * s, -0.08), (0.3 * s, 0.14)], depth=0.04, rot=(90, 0, 90 + s * 35))
# dorsal fin, adipose, pectorals, anal fin
md.part('poly', ICED, loc=G(0, top + 1.42, 0.0), points=[(-0.22, 0), (0.18, 0), (-0.08, 0.26)], depth=0.025, rot=(0, 0, 90))
md.part('poly', ICED, loc=G(0, top + 1.12, -0.32), points=[(-0.06, 0), (0.08, 0), (0.0, 0.1)], depth=0.02, rot=(0, 0, 90))
for s in (-1, 1): md.part('poly', ICEL, loc=G(s * 0.1, top + 1.62, 0.42), points=[(0, 0), (0.22 * s, -0.1), (0.16 * s, 0.06)], depth=0.02, rot=(0, -30 * s, 0))
md.part('poly', ICED, loc=G(0, top + 0.9, -0.05), points=[(-0.1, 0), (0.1, 0), (0.0, -0.16)], depth=0.02, rot=(0, 0, 90))
# the head: gill cover, open jaw, eyes cut in
chisel(md, ICEL, (0, top + 1.88, 0.68), (0.085, 0.14, 0.1), rot=(-25, 0, 0), sub=2, amp=0.01, seed=30)
md.part('box', ICED, loc=G(0, top + 1.98, 0.86), size=(0.05, 0.1, 0.018), rot=(-35, 0, 0))   # upper jaw
md.part('box', ICED, loc=G(0, top + 1.86, 0.86), size=(0.045, 0.09, 0.016), rot=(-5, 0, 0))   # lower jaw, open
for s in (-1, 1):
    md.part('rock', ICED, loc=G(s * 0.085, top + 1.95, 0.72), size=(0.025, 0.025, 0.025), sub=1)
    md.part('torus', ICED, loc=G(s * 0.105, top + 1.82, 0.6), size=(0.12, 0.12, 0.12), seg=10, ring=3, tube=0.08, rot=(0, 90, 0))  # the gill line
for k in range(8):  # scales: a few cut diamonds catching the light along the flank
    y = top + 0.8 + k * 0.12; z = -0.3 + k * 0.12
    for s in (-1, 1): md.part('box', ICEL, loc=G(s * 0.125, y, z), size=(0.012, 0.04, 0.04), rot=(45, 0, 0))
for k in range(5):  # drops flying off it
    md.part('rock', ICEL, loc=G(0.25 - k * 0.12, top + 1.0 + k * 0.22, -0.55 + k * 0.05), size=(0.035, 0.035, 0.05), sub=1, smooth=False)
objs.append(md.finish())

# --- a polar bear on the prowl, one paw raised
md = Model('hw_icesculpt_bear')
top = plinth(md, 0.95, 0.55, 0.4, 0.6)
chisel(md, ICE, (0, top + 0.95, -0.25), (0.42, 0.55, 0.45), sub=2, amp=0.04, seed=40)          # the rump
chisel(md, ICEL, (0, top + 0.92, 0.25), (0.4, 0.5, 0.42), sub=2, amp=0.04, seed=41)           # the barrel
chisel(md, ICE, (0, top + 1.05, 0.62), (0.36, 0.4, 0.42), sub=2, amp=0.035, seed=42)          # the shoulders
chisel(md, ICED, (0, top + 0.68, 0.1), (0.3, 0.6, 0.22), sub=2, amp=0.03, seed=43)            # the belly, in shadow
chisel(md, ICEL, (0, top + 1.0, 0.98), (0.2, 0.28, 0.22), rot=(-25, 0, 0), sub=2, amp=0.02, seed=44)   # the long neck
chisel(md, ICE, (0, top + 0.95, 1.28), (0.17, 0.22, 0.17), sub=2, amp=0.02, seed=45)          # the head
chisel(md, ICEL, (0, top + 0.88, 1.47), (0.1, 0.14, 0.09), sub=2, amp=0.01, seed=46)          # the muzzle
md.part('rock', ICED, loc=G(0, top + 0.9, 1.6), size=(0.045, 0.035, 0.035), sub=1)           # the nose
md.part('box', ICED, loc=G(0, top + 0.8, 1.5), size=(0.06, 0.04, 0.01))                      # the mouth line
for s in (-1, 1):
    md.part('rock', ICED, loc=G(s * 0.08, top + 1.04, 1.38), size=(0.025, 0.02, 0.022), sub=1)  # eyes
    chisel(md, ICEL, (s * 0.11, top + 1.13, 1.2), (0.05, 0.035, 0.05), sub=1, seed=47)            # round ears
# legs: front left raised mid-step, the others planted; paws with cut claws
for sx, z0, raised in ((-1, 0.62, True), (1, 0.62, False), (-1, -0.42, False), (1, -0.42, False)):
    x0 = sx * 0.24
    if raised:
        chisel(md, ICE, (x0, top + 0.62, z0 + 0.12), (0.13, 0.3, 0.13), rot=(-45, 0, 0), sub=2, amp=0.02, seed=50)
        chisel(md, ICEL, (x0, top + 0.42, z0 + 0.35), (0.13, 0.17, 0.08), sub=2, amp=0.01, seed=51)
        py, pz = top + 0.36, z0 + 0.43
    else:
        md.part('cyl', ICE, loc=G(x0, top + 0.3, z0), size=(0.14, 0.14, 0.32), seg=7, top=1.25, smooth=False)
        chisel(md, ICEL, (x0, top + 0.06, z0 + 0.05), (0.15, 0.2, 0.07), sub=2, amp=0.01, seed=52 + int(z0 * 10))
        py, pz = top + 0.03, z0 + 0.22
    for c in (-0.08, 0, 0.08): md.part('cyl', ICED, loc=G(x0 + c, py, pz), size=(0.015, 0.015, 0.045), seg=4, top=0.1, rot=(80, 0, 0))
chisel(md, ICEL, (0, top + 1.05, -0.72), (0.08, 0.08, 0.07), sub=1, seed=55)                  # the tail stub
for k in range(10):  # fur cut in strokes along the back and flanks
    z = -0.5 + k * 0.13
    for s in (-1, 1): md.part('box', ICEL, loc=G(s * 0.36, top + 1.05 - abs(z - 0.2) * 0.2, z), size=(0.012, 0.06, 0.012), rot=(0, 0, s * 25))
objs.append(md.finish())

# --- a snowy owl, wings half spread, on a carved branch
md = Model('hw_icesculpt_owl')
top = plinth(md, 0.42, 0.42, 0.75, 0.42)
md.part('cyl', ICED, loc=G(0, top + 0.12, 0), size=(0.07, 0.07, 0.55), seg=7, rot=(0, 0, 90), smooth=False)   # the branch
for s in (-1, 1): md.part('cyl', ICED, loc=G(s * 0.42, top + 0.2, 0.05), size=(0.035, 0.035, 0.16), seg=5, top=0.3, rot=(0, 0, 90 - s * 40))
chisel(md, ICE, (0, top + 0.55, 0), (0.24, 0.22, 0.36), sub=2, amp=0.03, seed=60)             # the body
chisel(md, ICEL, (0, top + 0.5, 0.08), (0.17, 0.12, 0.26), sub=2, amp=0.015, seed=61)         # the breast
chisel(md, ICE, (0, top + 0.98, 0.02), (0.21, 0.19, 0.19), sub=2, amp=0.02, seed=62)          # the head
md.part('cyl', ICEL, loc=G(0, top + 0.98, 0.12), size=(0.15, 0.15, 0.06), seg=12, rot=(90, 0, 0), smooth=False)  # the facial disc
for s in (-1, 1):
    md.part('torus', ICED, loc=G(s * 0.07, top + 1.0, 0.18), size=(0.045, 0.045, 0.045), seg=10, ring=4, tube=0.3, rot=(90, 0, 0))  # eye rims
    md.part('rock', ICED, loc=G(s * 0.07, top + 1.0, 0.18), size=(0.022, 0.022, 0.015), sub=1)
    # the wings: layered feathers fanning out, half spread
    for f in range(6):
        a = math.radians(25 + f * 11)
        md.part('poly', ICEL if f % 2 else ICE, loc=G(s * (0.2 + f * 0.04), top + 0.72 - f * 0.05, -0.02 - f * 0.02), points=[(0, 0), (0.52 - f * 0.04, -0.05), (0.48 - f * 0.05, 0.1), (0.05, 0.1)], depth=0.03, rot=(0, -s * (30 + f * 8), s * (20 + f * 6) + (0 if s > 0 else 180)))
    for t in (-0.05, 0.05): md.part('cyl', ICED, loc=G(s * 0.09 + t, top + 0.2, 0.06), size=(0.012, 0.012, 0.06), seg=4, top=0.1, rot=(70, 0, 0))  # talons
md.part('cyl', ICED, loc=G(0, top + 0.93, 0.2), size=(0.03, 0.03, 0.05), seg=4, top=0.05, rot=(100, 0, 0))   # the beak
for f in range(5): md.part('poly', ICEL, loc=G(-0.12 + f * 0.06, top + 0.32, -0.3), points=[(0, 0), (0.05, 0), (0.025, -0.25)], depth=0.02, rot=(25, 0, 0))  # tail feathers
for k in range(14):  # the speckle: little cut chevrons over the back
    a = k * 2.399; md.part('box', ICED, loc=G(math.cos(a) * 0.15, top + 0.5 + (k % 5) * 0.08, -0.3 + math.sin(a) * 0.04), size=(0.03, 0.01, 0.012), rot=(0, 0, 30 * (1 if k % 2 else -1)))
objs.append(md.finish())
md = Model('hw_crates')
md.part('rbox', PLANK, loc=G(0, 0.3, 0), size=(0.35, 0.35, 0.3), r=0.02); md.part('rbox', LOGL, loc=G(0.5, 0.25, 0.1), size=(0.28, 0.28, 0.25), r=0.02)
md.part('rbox', PLANK, loc=G(0.15, 0.85, 0.05), size=(0.28, 0.28, 0.25), r=0.02); md.part('rbox', SNOW, loc=G(0.15, 1.12, 0.05), size=(0.26, 0.26, 0.04), r=0.02)
objs.append(md.finish())

# ------------------------------------------------------------------ the kennels and the sled
md = Model('hw_doghouse')
md.part('box', PLANK, loc=G(0, 0.5, 0), size=(0.55, 0.65, 0.5))
roof(md, -0.55, 0.55, -0.65, 0.65, 1.0, 0.45, over=0.12)
md.part('rbox', DOGB, loc=G(0, 0.4, 0.66), size=(0.22, 0.02, 0.28), r=0.1)
md.part('rbox', OXBLOOD, loc=G(0, 0.9, 0.67), size=(0.2, 0.02, 0.06), r=0.02)
objs.append(md.finish())
md = Model('hw_fence')  # a 2 m section of split-rail fence
for x in (-1.0, 1.0): md.part('cyl', LOGD, loc=G(x, 0.55, 0), size=(0.07, 0.07, 0.55), seg=6)
for y in (0.45, 0.85): md.part('cyl', LOGL, loc=G(0, y, 0), size=(0.05, 0.05, 1.05), seg=6, rot=(0, 90, 0))
md.part('rbox', SNOW, loc=G(0, 0.92, 0), size=(1.0, 0.06, 0.03), r=0.02)
objs.append(md.finish())
md = Model('hw_sled')  # a dog sled: runners, a slatted bed, the handlebar, a bag
for s in (-1, 1):
    md.part('sweep', IRON, points=[G(s * 0.35, 0.02, -1.2), G(s * 0.35, 0.02, 0.9), G(s * 0.35, 0.18, 1.2), G(s * 0.35, 0.45, 1.25)], r=0.025, ring=5)
    for z in (-0.9, 0.0, 0.8): md.part('cyl', LOGL, loc=G(s * 0.35, 0.2, z), size=(0.025, 0.025, 0.18), seg=5)
    md.part('cyl', LOGL, loc=G(s * 0.35, 0.75, -1.1), size=(0.03, 0.03, 0.55), seg=5, rot=(-12, 0, 0))
for k in range(9): md.part('box', LOGL, loc=G(0, 0.38, -0.95 + k * 0.23), size=(0.42, 0.06, 0.02))
md.part('cyl', LOGD, loc=G(0, 1.3, -1.22), size=(0.035, 0.035, 0.42), seg=6, rot=(0, 90, 0))
md.part('rbox', CLOTHB, loc=G(0, 0.62, 0.1), size=(0.36, 0.55, 0.22), r=0.12)
md.part('cyl', ROPE, loc=G(0, 0.3, 1.5), size=(0.015, 0.015, 0.3), seg=4, rot=(90, 0, 0))
objs.append(md.finish())
# a sled dog (husky): body, head and tail as one; legs separate (the game swings them as it runs). v1.17.1: a proper
# husky: deep chest and tucked waist, a ruff at the neck, a wedge of a head with a stop, erect triangular ears with
# pale insides, the white mask with a dark cap and the line between the eyes, a bushy tail curled over the back.
# The grey parts take each dog's coat colour; the white stays white. Legs: front (straight, a pastern and a paw)
# and hind (a thigh, the hock angled back, a paw), both hinged at the hip/shoulder (origin) and hanging down.
DOGP = mat('hw_dog_pad', '#3a3230', 0.8)
md = Model('hw_dog')
md.part('rock', DOGG, loc=G(0, 0.66, 0.16), size=(0.19, 0.26, 0.23), sub=3, amp=0.015, freq=6, seed=1)    # the chest
md.part('rock', DOGG, loc=G(0, 0.68, -0.12), size=(0.16, 0.24, 0.17), sub=3, amp=0.015, freq=6, seed=2)   # the loin (tucked)
md.part('rock', DOGG, loc=G(0, 0.68, -0.3), size=(0.18, 0.17, 0.19), sub=3, amp=0.015, freq=6, seed=3)   # the haunches
md.part('rock', DOGW, loc=G(0, 0.55, 0.2), size=(0.15, 0.2, 0.15), sub=2)                                 # the pale chest and belly
md.part('rock', DOGW, loc=G(0, 0.56, -0.05), size=(0.11, 0.2, 0.1), sub=2)
md.part('rock', DOGG, loc=G(0, 0.83, 0.33), size=(0.15, 0.14, 0.17), rot=(-35, 0, 0), sub=2, amp=0.02, freq=7, seed=4)  # the neck and ruff
md.part('rock', DOGW, loc=G(0, 0.72, 0.42), size=(0.12, 0.08, 0.12), sub=2, amp=0.02, freq=8, seed=5)   # the ruff's pale front
md.part('rock', DOGG, loc=G(0, 0.98, 0.46), size=(0.12, 0.12, 0.11), sub=3)                               # the skull
md.part('rock', DOGW, loc=G(0, 0.93, 0.53), size=(0.105, 0.09, 0.08), sub=2)                             # the white cheeks
md.part('cyl', DOGW, loc=G(0, 0.92, 0.62), size=(0.055, 0.05, 0.08), seg=8, top=0.75, rot=(90, 0, 0))    # the muzzle
md.part('rock', DOGN, loc=G(0, 0.935, 0.705), size=(0.03, 0.022, 0.022), sub=1)                         # the nose
md.part('box', DOGN, loc=G(0, 0.885, 0.64), size=(0.035, 0.05, 0.006))                                   # the mouth line
md.part('box', DOGG, loc=G(0, 1.03, 0.55), size=(0.012, 0.05, 0.035), rot=(-20, 0, 0))                  # the dark line down between the eyes
for s_ in (-1, 1):
    md.part('cyl', DOGG, loc=G(s_ * 0.065, 1.12, 0.44), size=(0.045, 0.025, 0.07), seg=3, top=0.02, rot=(-10, 0, s_ * -12))  # ears
    md.part('cyl', DOGW, loc=G(s_ * 0.065, 1.11, 0.452), size=(0.028, 0.012, 0.05), seg=3, top=0.02, rot=(-10, 0, s_ * -12))  # their pale insides
    md.part('rock', DOGE, loc=G(s_ * 0.05, 1.0, 0.56), size=(0.02, 0.018, 0.012), sub=1)               # ice-blue eyes
    md.part('rock', DOGN, loc=G(s_ * 0.05, 1.0, 0.553), size=(0.026, 0.024, 0.01), sub=1)              # dark rims
    md.part('rock', DOGW, loc=G(s_ * 0.055, 1.045, 0.54), size=(0.02, 0.012, 0.012), sub=1)            # the pale brows
md.part('sweep', DOGG, points=[G(0, 0.78, -0.42), G(0, 0.98, -0.52), G(0, 1.08, -0.4), G(0, 1.04, -0.24)], r=[0.06, 0.085, 0.08, 0.05], ring=7)  # the tail curled up over the back
md.part('rock', DOGW, loc=G(0, 1.03, -0.27), size=(0.045, 0.04, 0.04), sub=1)                         # its pale tip
md.part('rbox', HARN, loc=G(0, 0.7, 0.18), size=(0.2, 0.05, 0.27), r=0.04)                               # the harness round the chest
md.part('rbox', HARN, loc=G(0, 0.9, -0.05), size=(0.04, 0.3, 0.03), r=0.02)                               # and along the back
objs.append(md.finish())
md = Model('hw_dog_leg')  # a front leg: shoulder at the origin
md.part('cyl', DOGG, loc=G(0, -0.12, 0), size=(0.055, 0.06, 0.12), seg=7, top=0.8)
md.part('cyl', DOGW, loc=G(0, -0.33, 0.01), size=(0.04, 0.04, 0.11), seg=6, top=0.9)
md.part('rock', DOGW, loc=G(0, -0.45, 0.035), size=(0.045, 0.04, 0.03), sub=1)
md.part('box', DOGP, loc=G(0, -0.478, 0.035), size=(0.035, 0.035, 0.006))
objs.append(md.finish())
md = Model('hw_dog_hind')  # a hind leg: hip at the origin; the thigh forward, the hock angled back
md.part('rock', DOGG, loc=G(0, -0.09, 0.02), size=(0.07, 0.09, 0.13), rot=(15, 0, 0), sub=2)
md.part('cyl', DOGG, loc=G(0, -0.25, -0.03), size=(0.045, 0.045, 0.1), seg=6, rot=(-25, 0, 0))
md.part('cyl', DOGW, loc=G(0, -0.39, -0.04), size=(0.036, 0.036, 0.08), seg=6, rot=(15, 0, 0))
md.part('rock', DOGW, loc=G(0, -0.45, 0.0), size=(0.043, 0.04, 0.028), sub=1)
md.part('box', DOGP, loc=G(0, -0.478, 0.0), size=(0.033, 0.035, 0.006))
objs.append(md.finish())

# ------------------------------------------------------------------ ice fishing gear (held and set down)
import math as _m
def _helix(y0, y1, r, turns, n=40):
    return [G(r * _m.cos(t / n * turns * 6.2832), y0 + (y1 - y0) * t / n, r * _m.sin(t / n * turns * 6.2832)) for t in range(n + 1)]
STEEL = mat('hw_steel', '#b4bcc6', 0.25, 0.9)
RUBBER = mat('hw_rubber', '#1e2024', 0.9)
ENGINE_RED = mat('hw_engine_red', '#b8322a', 0.5)
def _flight(y0, y1, ri, ro, turns, th=0.006, n=120):
    """A real auger flight: a thick helicoid ribbon wound round the shaft (game coords, converted by G)."""
    V, F = [], []
    for k in range(n + 1):
        a = k / n * turns * 6.2832; y = y0 + (y1 - y0) * k / n
        for r_, dy in ((ri, -th), (ro, -th), (ro, th), (ri, th)):
            V.append(G(r_ * _m.cos(a), y + dy, r_ * _m.sin(a)))
    for k in range(n):
        b, c = k * 4, (k + 1) * 4
        for q in range(4): F.append((b + q, b + (q + 1) % 4, c + (q + 1) % 4, c + q))
    F.append((3, 2, 1, 0)); e = n * 4; F.append((e, e + 1, e + 2, e + 3))
    return V, F
md = Model('hw_auger')  # a Swedish-style hand auger, origin at the cutting tip: the flight, the shaft, the brace crank
# the cutting head: a cast hub, the centre point and two curved steel blades
md.part('cyl', IRON, loc=G(0, 0.035, 0), size=(0.085, 0.085, 0.025), seg=18, top=0.75)
md.part('cyl', STEEL, loc=G(0, 0.0, 0), size=(0.012, 0.012, 0.025), seg=8, top=0.1)
for s_ in (-1, 1):
    md.part('poly', STEEL, loc=G(0, 0.02, 0), rot=(0, s_ * 18, 90 + s_ * 90), points=[(0.0, -0.012), (0.085, -0.004), (0.095, 0.012), (0.0, 0.012)], depth=0.004)
# the flight, the shaft and a coupling collar
fv, ff = _flight(0.06, 0.62, 0.016, 0.074, 3.6)
md.part('mesh', STEEL, verts=fv, faces=ff, smooth=False)
md.part('cyl', STEEL, loc=G(0, 0.66, 0), size=(0.016, 0.016, 0.62), seg=10)
md.part('cyl', IRON, loc=G(0, 0.66, 0), size=(0.024, 0.024, 0.04), seg=10)
md.part('cyl', IRON, loc=G(0, 0.66, 0), size=(0.006, 0.006, 0.03), seg=6, rot=(90, 0, 0))  # the coupling pin
# the brace: up from the shaft, out, a spinning wooden grip, back in, and the top knob you lean on
md.part('sweep', STEEL, points=[G(0, 1.2, 0), G(0, 1.26, 0), G(0.03, 1.29, 0), G(0.17, 1.29, 0), G(0.2, 1.32, 0), G(0.2, 1.52, 0), G(0.17, 1.55, 0), G(0.03, 1.55, 0), G(0, 1.58, 0), G(0, 1.62, 0)], r=0.013, ring=8)
md.part('cyl', LOGL, loc=G(0.2, 1.42, 0), size=(0.028, 0.028, 0.085), seg=12)
md.part('cyl', LOGD, loc=G(0.2, 1.335, 0), size=(0.032, 0.032, 0.008), seg=12)
md.part('cyl', LOGD, loc=G(0.2, 1.505, 0), size=(0.032, 0.032, 0.008), seg=12)
md.part('rock', LOGL, loc=G(0, 1.67, 0), size=(0.055, 0.035, 0.055), sub=2)  # the mushroom knob
md.part('cyl', LOGD, loc=G(0, 1.635, 0), size=(0.03, 0.03, 0.012), seg=12)
objs.append(md.finish())

md = Model('hw_auger_power')  # a petrol power auger: a big flight under the powerhead, two handlebars and the pull-start
md.part('cyl', IRON, loc=G(0, 0.04, 0), size=(0.11, 0.11, 0.03), seg=20, top=0.75)
md.part('cyl', STEEL, loc=G(0, 0.0, 0), size=(0.014, 0.014, 0.03), seg=8, top=0.1)
for s_ in (-1, 1):
    md.part('poly', STEEL, loc=G(0, 0.025, 0), rot=(0, s_ * 18, 90 + s_ * 90), points=[(0.0, -0.014), (0.11, -0.005), (0.12, 0.014), (0.0, 0.014)], depth=0.005)
fv, ff = _flight(0.07, 0.8, 0.02, 0.098, 4.4, th=0.007)
md.part('mesh', STEEL, verts=fv, faces=ff, smooth=False)
md.part('cyl', STEEL, loc=G(0, 0.5, 0), size=(0.02, 0.02, 0.48), seg=10)
md.part('cyl', IRON, loc=G(0, 0.93, 0), size=(0.04, 0.04, 0.05), seg=12)  # the gearbox neck
# the powerhead: gearbox, engine block with cooling fins, fuel tank, recoil starter, muffler
md.part('rbox', IRON, loc=G(0, 1.02, 0), size=(0.09, 0.08, 0.05), r=0.025)
md.part('rbox', ORANGE, loc=G(0, 1.13, -0.02), size=(0.12, 0.1, 0.07), r=0.035)
for k in range(5): md.part('cyl', IRON, loc=G(0.0, 1.07 + k * 0.025, 0.1), size=(0.06, 0.06, 0.004), seg=14, rot=(90, 0, 0))
md.part('rbox', ENGINE_RED, loc=G(0, 1.22, -0.06), size=(0.1, 0.07, 0.04), r=0.025)  # the fuel tank
md.part('cyl', RUBBER, loc=G(0, 1.265, -0.06), size=(0.018, 0.018, 0.01), seg=10)  # its cap
md.part('cyl', RUBBER, loc=G(-0.13, 1.13, -0.02), size=(0.065, 0.065, 0.025), seg=16, rot=(0, 0, 90))  # the recoil starter
md.part('rbox', RUBBER, loc=G(-0.165, 1.13, -0.02), size=(0.012, 0.03, 0.012), r=0.006)  # its pull handle
md.part('cyl', IRON, loc=G(0.13, 1.08, 0.05), size=(0.03, 0.03, 0.06), seg=12, rot=(0, 0, 90))  # the muffler
# the handlebars: a bent tube each side with a rubber grip, and the throttle lever on the right
for s_ in (-1, 1):
    md.part('sweep', STEEL, points=[G(s_ * 0.08, 1.02, 0), G(s_ * 0.18, 1.02, 0), G(s_ * 0.28, 1.06, 0), G(s_ * 0.36, 1.12, 0)], r=0.014, ring=8)
    md.part('cyl', RUBBER, loc=G(s_ * 0.42, 1.15, 0), size=(0.022, 0.022, 0.07), seg=10, rot=(0, 0, s_ * -57))
md.part('rbox', IRON, loc=G(0.4, 1.1, 0.03), size=(0.04, 0.008, 0.012), r=0.004)
objs.append(md.finish())
md = Model('hw_slush')  # the slush ring round a fresh hole (flat, at the ice surface)
for k in range(10):
    a = k / 10 * 6.2832
    md.part('rock', SNOW, loc=G(0.55 * _m.cos(a), 0.02, 0.55 * _m.sin(a)), size=(0.14, 0.04, 0.1), sub=1)
objs.append(md.finish())

# ------------------------------------------------------------------ v1.16.2 the Hearth Lodge, inside
# (the room's log walls, floor and ceiling are drawn by the game, inward-facing; these are the things in it)
RUG = mat('hw_rug_red', '#9c3a2e', 1.0)
RUG2 = mat('hw_rug_cream', '#e4d4b0', 1.0)
EMBER = mat('hw_ember', '#ff7a2a', 0.6, emit='#ff6a1a')
CANDLE = mat('hw_candle', '#f4ecd8', 0.8)
FLAME = mat('hw_flame', '#ffd46a', 0.5, emit='#ffb040')
BOOKS = [mat('hw_book_' + str(i), c, 0.9) for i, c in enumerate(['#8c2f28', '#2c4060', '#2f5c3c', '#d29b2e', '#5a3a6a'])]
CORK = mat('hw_cork', '#c89a5a', 1.0)
BOARD_BLACK = mat('hw_board_black', '#1e2422', 0.95)
CREAMW = mat('hw_cream_wool', '#efe6d0', 1.0)
md = Model('hw_li_fireplace')  # a great stone fireplace: the hearth, the firebox, a log mantel, the chimney breast to the ceiling
for k in range(7):
    for c in range(8 - (k % 2)):
        md.part('rock', STONE if (k + c) % 3 else STONED, loc=G(-1.75 + c * 0.5 + (k % 2) * 0.25, 0.22 + k * 0.32, 0), size=(0.27, 0.22, 0.18), sub=1, amp=0.03, seed=k * 9 + c)
md.part('rbox', STONED, loc=G(0, 3.4, -0.05), size=(1.5, 0.35, 1.4), r=0.05)  # the chimney breast (above the mantel)
md.part('box', BOARD_BLACK, loc=G(0, 0.62, 0.17), size=(0.85, 0.05, 0.52))  # the firebox's dark mouth
md.part('box', LOGD, loc=G(0, 1.36, 0.28), size=(1.95, 0.22, 0.09))  # the mantel beam
md.part('rbox', STONE, loc=G(0, 0.06, 0.75), size=(1.9, 0.55, 0.06), r=0.03)  # the hearth stone
for i_, x_ in enumerate((-0.35, 0.0, 0.35)):
    md.part('cyl', LOG, loc=G(x_, 0.32, 0.28), size=(0.07, 0.07, 0.42), seg=8, rot=(90, 0, 20 * (i_ - 1)))
md.part('rock', EMBER, loc=G(0, 0.24, 0.3), size=(0.5, 0.3, 0.06), sub=1, amp=0.03, seed=3)
for x_ in (-0.9, 0.9): md.part('cyl', CANDLE, loc=G(x_, 1.6, 0.28), size=(0.04, 0.04, 0.1), seg=8); md.part('rock', FLAME, loc=G(x_, 1.74, 0.28), size=(0.02, 0.02, 0.04), sub=1)
md.part('rbox', BRASS, loc=G(0.3, 1.5, 0.28), size=(0.07, 0.07, 0.07), r=0.02)  # a kettle on the mantel
objs.append(md.finish())
md = Model('hw_li_bar')  # Astrid's counter: a log-fronted bar 5 m long, a plank top, the back shelf with jars and mugs
md.part('rbox', LOG, loc=G(0, 0.52, 0), size=(2.5, 0.3, 0.5), r=0.05)
for k in range(4): md.part('cyl', LOGD, loc=G(0, 0.15 + k * 0.25, 0.32), size=(0.11, 0.11, 2.48), seg=8, rot=(0, 0, 90))
md.part('rbox', PLANK, loc=G(0, 1.07, 0.02), size=(2.6, 0.38, 0.05), r=0.02)
md.part('rbox', LOGD, loc=G(0, 1.2, -1.05), size=(2.4, 0.15, 0.04), r=0.01)  # the back shelf
md.part('rbox', LOGD, loc=G(0, 1.75, -1.05), size=(2.4, 0.15, 0.04), r=0.01)
for k in range(9):
    md.part('cyl', GLASS if k % 2 else CREAM, loc=G(-2.0 + k * 0.5, 1.37 + (k % 3) * 0.02, -1.05), size=(0.07, 0.07, 0.12), seg=10)
    md.part('cyl', BOOKS[k % 5], loc=G(-2.0 + k * 0.5 + 0.2, 1.92, -1.05), size=(0.06, 0.06, 0.1), seg=10)
for k in range(4): md.part('cyl', CREAM, loc=G(-1.5 + k * 0.9, 1.16, 0.1), size=(0.05, 0.05, 0.06), seg=10)  # mugs on the bar
md.part('rbox', BRASS, loc=G(1.9, 1.24, -0.1), size=(0.18, 0.12, 0.12), r=0.05)  # the cocoa pot
objs.append(md.finish())
md = Model('hw_li_table')  # a long trestle table and two benches
md.part('rbox', PLANK, loc=G(0, 0.78, 0), size=(1.6, 0.45, 0.05), r=0.02)
for x_ in (-1.25, 1.25): md.part('box', LOGD, loc=G(x_, 0.38, 0), size=(0.07, 0.35, 0.38))
md.part('box', LOGD, loc=G(0, 0.2, 0), size=(1.25, 0.05, 0.05))
for z_ in (-0.78, 0.78):
    md.part('rbox', PLANK, loc=G(0, 0.44, z_), size=(1.55, 0.16, 0.04), r=0.015)
    for x_ in (-1.2, 1.2): md.part('box', LOGD, loc=G(x_, 0.21, z_), size=(0.06, 0.12, 0.21))
for k in range(3):
    md.part('cyl', CREAM, loc=G(-0.9 + k * 0.9, 0.86, -0.2 + 0.4 * (k % 2)), size=(0.05, 0.05, 0.06), seg=10)
    md.part('cyl', CREAMW, loc=G(-0.6 + k * 0.7, 0.84, 0.15 - 0.3 * (k % 2)), size=(0.12, 0.12, 0.012), seg=14)
md.part('cyl', CANDLE, loc=G(0, 0.92, 0), size=(0.04, 0.04, 0.09), seg=8); md.part('rock', FLAME, loc=G(0, 1.05, 0), size=(0.02, 0.02, 0.035), sub=1)
objs.append(md.finish())
md = Model('hw_li_armchair')  # a deep armchair with a knitted throw
md.part('rbox', OXBLOOD, loc=G(0, 0.3, 0), size=(0.42, 0.4, 0.14), r=0.06)
md.part('rbox', OXBLOOD, loc=G(0, 0.75, -0.33), size=(0.42, 0.08, 0.36), r=0.06)
for x_ in (-0.4, 0.4): md.part('rbox', OXBLOOD, loc=G(x_, 0.52, 0.0), size=(0.09, 0.38, 0.12), r=0.05)
md.part('rbox', CREAMW, loc=G(0.1, 0.8, -0.3), size=(0.3, 0.1, 0.26), r=0.04, rot=(0, 0, 8))
for x_ in (-0.35, 0.35):
    for z_ in (-0.3, 0.3): md.part('cyl', LOGD, loc=G(x_, 0.08, z_), size=(0.035, 0.035, 0.08), seg=6)
objs.append(md.finish())
md = Model('hw_li_rug')  # a braided oval rug
for k in range(6): md.part('torus', RUG if k % 2 else RUG2, loc=G(0, 0.012, 0), size=(1.6 - k * 0.24, 1.0 - k * 0.15, 0.06), seg=40, ring=4, tube=0.12)
md.part('cyl', RUG, loc=G(0, 0.008, 0), size=(0.2, 0.12, 0.008), seg=20)
objs.append(md.finish())
md = Model('hw_li_dartboard')  # a dartboard on a cabinet, with the chalk score board beside it (faces +z, on the wall)
md.part('rbox', LOGD, loc=G(0, 0, -0.04), size=(0.55, 0.55, 0.04), r=0.02)
for k, (r_, m_) in enumerate(((0.42, BOARD_BLACK), (0.38, CREAM), (0.3, OXBLOOD), (0.22, CREAM), (0.12, FOREST), (0.05, OXBLOOD), (0.02, BOARD_BLACK))):
    md.part('cyl', m_, loc=G(0, 0, 0.005 + k * 0.004), size=(r_, r_, 0.004), seg=40, rot=(90, 0, 0))
md.part('rbox', BOARD_BLACK, loc=G(0.9, 0, -0.02), size=(0.3, 0.42, 0.02), r=0.02)
md.part('rbox', LOGD, loc=G(0.9, 0, -0.03), size=(0.34, 0.46, 0.015), r=0.01)
objs.append(md.finish())
md = Model('hw_li_antlers')  # a big set of antlers on a wooden shield (on the wall, faces +z)
md.part('poly', LOGD, loc=G(0, 0, 0), points=[(-0.22, -0.3), (0.22, -0.3), (0.26, 0.05), (0, 0.3), (-0.26, 0.05)], depth=0.05)
for s_ in (-1, 1):
    pts = [G(s_ * 0.08, 0.05, 0.08), G(s_ * 0.35, 0.18, 0.12), G(s_ * 0.6, 0.42, 0.1), G(s_ * 0.7, 0.75, 0.05)]
    md.part('sweep', CREAM, points=pts, r=[0.04, 0.035, 0.025, 0.012], ring=6)
    for t_ in range(3):
        b = pts[t_ + 1]; md.part('sweep', CREAM, points=[b, (b[0] + s_ * 0.05, b[1], b[2] + 0.22 + t_ * 0.03)], r=[0.02, 0.008], ring=5)
objs.append(md.finish())
md = Model('hw_li_plaque')  # a trophy plaque (a fish goes on it in the game; faces +z, on the wall)
md.part('poly', LOG, loc=G(0, 0, 0), points=[(-0.45, -0.18), (0.45, -0.18), (0.5, 0), (0.45, 0.18), (-0.45, 0.18), (-0.5, 0)], depth=0.04)
md.part('rbox', BRASS, loc=G(0, -0.13, 0.025), size=(0.16, 0.035, 0.005), r=0.004)
objs.append(md.finish())
md = Model('hw_li_shelf')  # a tall bookshelf, full
md.part('rbox', LOGD, loc=G(0, 1.0, 0), size=(0.6, 0.18, 1.0), r=0.02)
for k in range(5):
    md.part('box', PLANK, loc=G(0, 0.08 + k * 0.45, 0.02), size=(0.56, 0.16, 0.015))
    for b in range(9):
        if k == 4: break
        h_ = 0.13 + ((b * 7 + k * 3) % 5) * 0.02
        md.part('box', BOOKS[(b + k) % 5], loc=G(-0.5 + b * 0.12, 0.1 + k * 0.45 + h_, 0.04), size=(0.05, 0.13, h_))
objs.append(md.finish())
md = Model('hw_li_chandelier')  # an antler chandelier with candles (hangs from its origin)
md.part('torus', LOGD, loc=G(0, -0.9, 0), size=(0.7, 0.7, 0.7), seg=24, ring=5, tube=0.06)
for k in range(6):
    a = k / 6 * 6.2832
    md.part('cyl', CANDLE, loc=G(_m.cos(a) * 0.7, -0.8, _m.sin(a) * 0.7), size=(0.035, 0.035, 0.08), seg=8)
    md.part('rock', FLAME, loc=G(_m.cos(a) * 0.7, -0.68, _m.sin(a) * 0.7), size=(0.02, 0.02, 0.035), sub=1)
    md.part('sweep', CREAM, points=[G(_m.cos(a) * 0.68, -0.92, _m.sin(a) * 0.68), G(_m.cos(a) * 0.4, -1.05, _m.sin(a) * 0.4), G(0, -1.1, 0)], r=0.02, ring=5)
md.part('sweep', IRON, points=[G(0, 0, 0), G(0, -0.9, 0)], r=0.012, ring=5)
objs.append(md.finish())
md = Model('hw_li_window')  # a frosted window with a warm sill (on the wall, faces +z)
md.part('rbox', LOG, loc=G(0, 0, 0), size=(0.7, 0.07, 0.6), r=0.03)
md.part('box', mat('hw_frost_glass', '#b8d8ec', 0.2, emit='#8ab8d8'), loc=G(0, 0, 0.03), size=(0.6, 0.01, 0.5))
md.part('box', LOGD, loc=G(0, 0, 0.05), size=(0.03, 0.02, 0.5)); md.part('box', LOGD, loc=G(0, 0, 0.05), size=(0.6, 0.02, 0.03))
md.part('rbox', PLANK, loc=G(0, -0.62, 0.1), size=(0.78, 0.12, 0.04), r=0.015)
objs.append(md.finish())
md = Model('hw_li_barrel')  # a barrel with a lantern on top
md.part('cyl', LOG, loc=G(0, 0.42, 0), size=(0.32, 0.32, 0.42), seg=16)
for y_ in (0.12, 0.72): md.part('torus', IRON, loc=G(0, y_, 0), size=(0.33, 0.33, 0.33), seg=20, ring=4, tube=0.05)
md.part('rbox', IRON, loc=G(0, 0.98, 0), size=(0.09, 0.09, 0.12), r=0.02); md.part('rock', FLAME, loc=G(0, 0.98, 0), size=(0.05, 0.05, 0.07), sub=1)
objs.append(md.finish())

# ------------------------------------------------------------------ v1.17.1: a pop-up ice tent and a bucket stool by each drilled hole
TENT = mat('hw_tent_red', '#c23a2e', 0.85)
TENTD = mat('hw_tent_red_dark', '#8e2820', 0.85)
SLED = mat('hw_sled_black', '#26282c', 0.6)
BUCKET = mat('hw_bucket_orange', '#e07a24', 0.6)
CUSH = mat('hw_cushion', '#3a4a5c', 0.9)
def arch_shell(rx, ry, z0, z1, n=16, th=0.03):
    V, F = [], []
    for k in range(n + 1):
        a = k / n * math.pi
        for z in (z0, z1):
            for rr in (1.0, 1.0 - th / rx):
                V.append(G(rx * rr * math.cos(a), ry * rr * math.sin(a), z))
    for k in range(n):
        b, c = k * 4, (k + 1) * 4
        F.append((b, c, c + 1, b + 1)); F.append((b + 2, b + 3, c + 3, c + 2)); F.append((b, b + 2, c + 2, c)); F.append((b + 1, c + 1, c + 3, b + 3))
    return V, F
md = Model('hw_icetent')  # a flip-over shelter on its sled: open to the front (+z), where the hole is
md.part('rbox', SLED, loc=G(0, 0.07, -0.45), size=(0.98, 0.85, 0.07), r=0.04)
for s_ in (-1, 1): md.part('rbox', SLED, loc=G(s_ * 0.98, 0.16, -0.45), size=(0.04, 0.85, 0.1), r=0.02)
tv, tf = arch_shell(0.95, 1.45, -1.25, 0.32)
md.part('mesh', TENT, loc=G(0, 0.12, 0), verts=tv, faces=tf, smooth=True)
md.part('poly', TENTD, loc=G(0, 0.12, -1.24), points=[(0.95 * math.cos(k / 14 * math.pi), 1.45 * math.sin(k / 14 * math.pi)) for k in range(15)], depth=0.02)
for z_ in (-1.2, -0.45, 0.3):  # the poles
    md.part('sweep', IRON, points=[G(0.97 * math.cos(k / 10 * math.pi), 0.12 + 1.47 * math.sin(k / 10 * math.pi), z_) for k in range(11)], r=0.018, ring=5)
for k in range(3): md.part('box', TENTD, loc=G(0, 0.12 + 1.47 * math.sin((k + 1) / 4 * math.pi) , -0.47), size=(0.97 * abs(math.cos((k + 1) / 4 * math.pi)) + 0.02, 0.8, 0.012))  # seam bands
md.part('rbox', SNOW, loc=G(0.1, 1.55, -0.6), size=(0.5, 0.6, 0.04), r=0.03)
md.part('box', CREAM, loc=G(-0.55, 0.85, -1.27), size=(0.18, 0.005, 0.12))  # a window flap
for s_ in (-1, 1):  # guy lines to stakes in the ice
    md.part('sweep', CREAM, points=[G(s_ * 0.9, 0.9, -0.2), G(s_ * 1.5, 0.02, 0.1)], r=0.006, ring=3)
    md.part('cyl', IRON, loc=G(s_ * 1.5, 0.05, 0.1), size=(0.015, 0.015, 0.06), seg=5)
objs.append(md.finish())
md = Model('hw_icestool')  # a bucket seat with a padded lid, and a little tackle box
md.part('cyl', BUCKET, loc=G(0, 0.2, 0), size=(0.17, 0.17, 0.2), seg=16, top=1.12)
md.part('torus', BUCKET, loc=G(0, 0.39, 0), size=(0.19, 0.19, 0.19), seg=16, ring=5, tube=0.1)
md.part('cyl', CUSH, loc=G(0, 0.43, 0), size=(0.185, 0.185, 0.035), seg=16)
md.part('sweep', IRON, points=[G(-0.18, 0.36, 0), G(0, 0.48, 0.02), G(0.18, 0.36, 0)], r=0.008, ring=4)
md.part('rbox', NAVY, loc=G(0.38, 0.09, 0.05), size=(0.13, 0.08, 0.09), r=0.015)
md.part('box', IRON, loc=G(0.38, 0.185, 0.05), size=(0.05, 0.01, 0.01))
objs.append(md.finish())

export(objs, OUT)
