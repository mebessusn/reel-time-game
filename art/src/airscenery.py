# Skye's Air Races (v1.17.1): the land circuits' scenery. Detailed rocks for every biome, and the buildings that put
# people in the landscape: farms (farmhouse, barn, silo, hay, fences), cottages and a chapel in the valley, log
# cabins and red fishing huts on stilts in the fjords and the taiga, adobe houses and wind pumps in the desert, stilt
# huts, canoes and jetties in the tropics, a water tower and a windmill for the mixed country.
#   python3 art/src/airscenery.py      -> art/airscenery.blend + art/airscenery.glb
#   node scripts/glb-to-js.mjs art/airscenery.glb src/data/airsceneryMesh.js AIRSCENERY
# Game axes: x right, y up, z forward (a building's front). Sizes passed to the kit are half extents in Blender order
# (game x, game z, game y). Everything stands on its origin.
import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
import bpy
from kit import Model, mat, reset, export

OUT = os.path.join(os.path.dirname(__file__), '..', 'airscenery')
G = lambda x, y, z: (x, -z, y)
T = math.tau
reset()
objs = []

# ------------------------------------------------------------------ materials
GRANITE = mat('as_granite', '#8a8a86', 0.95); GRANITE2 = mat('as_granite_dark', '#6a6a68', 0.95); GRANITE3 = mat('as_granite_light', '#a8a6a0', 0.95)
MOSS = mat('as_moss', '#5a7a3a', 0.98); LICHEN = mat('as_lichen', '#b0a858', 0.98)
SNOWC = mat('as_snow', '#f4f8fc', 0.6)
SANDST = mat('as_sandstone', '#c0683a', 0.95); SANDST2 = mat('as_sandstone_dark', '#94482a', 0.95); SANDST3 = mat('as_sandstone_pale', '#dca070', 0.95)
BASALT = mat('as_basalt', '#4a4644', 0.9); BASALT2 = mat('as_basalt_dark', '#33302e', 0.9)
WHITEW = mat('as_white_wood', '#ece6d8', 0.75); CREAM = mat('as_cream', '#e8d8b0', 0.8)
REDW = mat('as_barn_red', '#a8322a', 0.8); REDF = mat('as_falu_red', '#8a2a20', 0.85)
ROOFG = mat('as_roof_grey', '#5a5c62', 0.8); ROOFR = mat('as_roof_red', '#8a3a2a', 0.8); ROOFB = mat('as_roof_brown', '#6a4a32', 0.85)
THATCH = mat('as_thatch', '#c8a85a', 0.95); THATCHD = mat('as_thatch_dark', '#9a7a3a', 0.95)
SOD = mat('as_sod', '#6a8a44', 0.95)
WOOD = mat('as_wood', '#8a5e38', 0.9); WOODD = mat('as_wood_dark', '#5a3a22', 0.9); LOG = mat('as_log', '#7a5232', 0.9); LOGE = mat('as_log_end', '#c8a070', 0.9)
STONEW = mat('as_stone_wall', '#9a9488', 0.95); STONEW2 = mat('as_stone_wall_dark', '#7a746a', 0.95)
ADOBE = mat('as_adobe', '#d0a070', 0.95); ADOBE2 = mat('as_adobe_dark', '#b08050', 0.95)
GLASS = mat('as_glass', '#3a5468', 0.1); GLASSL = mat('as_glass_lit', '#ffe0a0', 0.3, emit='#ffc060')
STEEL = mat('as_steel', '#9aa2ac', 0.4, 0.7); METAL = mat('as_metal_roof', '#a8acb0', 0.5, 0.6)
HAY = mat('as_hay', '#e0c068', 0.95); HAYD = mat('as_hay_dark', '#b8984a', 0.95)
GREENP = mat('as_paint_green', '#3a6a4a', 0.8); BLUEP = mat('as_paint_blue', '#3a6a9a', 0.8); YELP = mat('as_paint_yellow', '#e0b030', 0.8)
PALM = mat('as_palm_leaf', '#4a8a3a', 0.9)
DARK = mat('as_dark', '#2a2a2e', 0.8)

# ================================================================== rocks
def boulder(name, parts, sub=3):
    """parts: (material, loc, size, rot, amp, freq, seed) noise-displaced icospheres, merged into one rock."""
    md = Model(name)
    for m, loc, size, rot, amp, freq, seed in parts: md.part('rock', m, loc=G(*loc), size=size, rot=rot, sub=sub, amp=amp, freq=freq, seed=seed, smooth=False)
    return md.finish()

# granite: big rounded blocks, a darker split block, lichen and moss on the top (valley, taiga, mixed)
objs.append(boulder('as_rock_g1', [(GRANITE, (0, 1.1, 0), (2.2, 1.8, 1.5), (0, 0, 12), 0.28, 0.9, 1), (GRANITE2, (1.4, 0.7, 0.5), (1.2, 1.1, 1.0), (0, 0, -20), 0.2, 1.3, 2),
                                   (MOSS, (-0.2, 2.25, 0), (1.6, 1.2, 0.5), (0, 0, 10), 0.18, 1.6, 3), (LICHEN, (1.2, 1.55, 0.6), (0.6, 0.5, 0.25), (0, 0, -15), 0.1, 2.5, 4)]))
objs.append(boulder('as_rock_g2', [(GRANITE3, (0, 0.8, 0), (1.5, 1.3, 1.1), (5, 0, 30), 0.22, 1.1, 5), (GRANITE, (-1.1, 0.5, -0.6), (0.9, 0.8, 0.7), (0, 0, 0), 0.18, 1.5, 6),
                                   (GRANITE2, (0.9, 0.35, 0.9), (0.6, 0.6, 0.45), (0, 0, 0), 0.15, 1.8, 7), (LICHEN, (0.1, 1.75, 0.1), (0.9, 0.7, 0.25), (0, 0, 30), 0.12, 2.2, 8)]))
objs.append(boulder('as_rock_g3', [(GRANITE, (0, 1.6, 0), (1.3, 1.2, 2.0), (8, -6, 0), 0.25, 1.0, 9), (GRANITE2, (0.2, 3.3, 0.1), (0.8, 0.8, 0.7), (0, 0, 20), 0.2, 1.4, 10),
                                   (MOSS, (0, 0.25, 0), (2.0, 1.8, 0.45), (0, 0, 0), 0.2, 1.2, 11)]))
# a scatter of small stones and a slab (in clusters along the corridor)
objs.append(boulder('as_stones', [(GRANITE, (-0.8, 0.25, 0.3), (0.45, 0.4, 0.3), (0, 0, 20), 0.1, 2.0, 12), (GRANITE2, (0.6, 0.2, -0.4), (0.35, 0.3, 0.25), (0, 0, 0), 0.1, 2.0, 13),
                                  (GRANITE3, (0.1, 0.12, 0.9), (0.5, 0.25, 0.14), (0, 0, 40), 0.08, 2.0, 14), (GRANITE, (1.3, 0.15, 0.6), (0.22, 0.2, 0.18), (0, 0, 0), 0.06, 2.4, 15)], sub=3))
# snow-capped (the fjords)
objs.append(boulder('as_rock_s1', [(GRANITE2, (0, 1.3, 0), (2.4, 2.0, 1.7), (0, 0, 18), 0.3, 0.8, 16), (GRANITE, (-1.5, 0.6, 0.8), (1.1, 1.0, 0.8), (0, 0, 0), 0.2, 1.3, 17),
                                   (SNOWC, (0.1, 2.5, -0.1), (2.0, 1.6, 0.6), (0, 0, 18), 0.15, 1.1, 18), (SNOWC, (-1.5, 1.35, 0.8), (0.9, 0.8, 0.3), (0, 0, 0), 0.08, 1.6, 19)]))
objs.append(boulder('as_rock_s2', [(GRANITE, (0, 2.2, 0), (1.4, 1.2, 2.6), (6, 4, 0), 0.3, 0.9, 20), (GRANITE2, (0.6, 0.8, 0.9), (1.0, 0.9, 1.0), (0, 0, 0), 0.2, 1.2, 21),
                                   (SNOWC, (0.0, 4.6, 0.0), (0.9, 0.8, 0.45), (0, 0, 0), 0.12, 1.4, 22), (SNOWC, (0, 0.2, 0), (2.2, 1.9, 0.4), (0, 0, 0), 0.1, 0.9, 23)]))
# sandstone: stacked, eroded slabs in bands (the desert)
def sandstack(name, seed, n, w):
    parts = []
    for k in range(n):
        m = [SANDST, SANDST2, SANDST3][(k + seed) % 3]
        parts.append((m, (math.sin(k * 1.7 + seed) * 0.25 * w, 0.45 + k * 0.82, math.cos(k * 2.3 + seed) * 0.2 * w), (w * (1.0 - k * 0.08), w * 0.8 * (1.0 - k * 0.06), 0.46), (0, 0, k * 17 + seed * 9), 0.14, 1.1, seed * 10 + k))
    return boulder(name, parts)
objs += [sandstack('as_rock_r1', 1, 4, 2.0), sandstack('as_rock_r2', 2, 6, 1.4)]
# basalt: dark, columnar (the tropic islands)
md = Model('as_rock_v1')
for k in range(9):
    a = k / 9 * T; r = 0.9 if k else 0
    md.part('cyl', BASALT if k % 2 else BASALT2, loc=G(math.cos(a) * r, 1.1 + (k % 3) * 0.35, math.sin(a) * r), size=(0.5, 0.5, 1.1 + (k % 3) * 0.35), seg=6, amp=0.05, freq=2, seed=k, smooth=False)
md.part('rock', MOSS, loc=G(0, 0.15, 0), size=(1.8, 1.8, 0.35), sub=3, amp=0.15, freq=1.4, seed=40)
objs.append(md.finish())
objs.append(boulder('as_rock_v2', [(BASALT, (0, 1.0, 0), (2.0, 1.5, 1.3), (0, 0, 25), 0.35, 1.1, 41), (BASALT2, (1.2, 0.5, 0.6), (0.9, 0.8, 0.7), (0, 0, 0), 0.25, 1.6, 42),
                                   (MOSS, (-0.3, 1.95, 0), (1.2, 0.9, 0.35), (0, 0, 25), 0.15, 1.8, 43)]))

# ================================================================== building helpers
def gable(md, m, cx, cz, w, d, y, h, over=0.35, th=0.12):
    """A pitched roof: two slabs meeting at the ridge (along z), w and d the walls' half extents."""
    a = math.degrees(math.atan2(h, w)); L = math.hypot(w, h) + over
    for s in (-1, 1):
        md.part('box', m, loc=G(cx + s * (w / 2), y + h / 2, cz), size=(L / 2, d + over, th), rot=(0, s * a, 0))
    md.part('box', m, loc=G(cx, y + h + 0.02, cz), size=(0.12, d + over, 0.08))

def gable_end(md, m, cx, cz, w, y, h, d):
    """The triangle of wall under each end of a gable."""
    for s in (-1, 1): md.part('poly', m, loc=G(cx, y, cz + s * d), points=[(-w, 0), (w, 0), (0, h)], depth=0.2)

def windows(md, xs, y, z, w=0.45, h=0.6, frame=WHITEW, glass=GLASS, face=1):
    for x in xs:
        md.part('box', frame, loc=G(x, y, z + face * 0.02), size=(w + 0.08, 0.05, h + 0.08))
        md.part('box', glass, loc=G(x, y, z + face * 0.06), size=(w, 0.04, h))
        md.part('box', frame, loc=G(x, y, z + face * 0.09), size=(0.03, 0.03, h))

def side_windows(md, zs, y, x, s, w=0.45, h=0.6, frame=WHITEW, glass=GLASS):
    for z in zs:
        md.part('box', frame, loc=G(x + s * 0.02, y, z), size=(0.05, w + 0.08, h + 0.08))
        md.part('box', glass, loc=G(x + s * 0.06, y, z), size=(0.04, w, h))

def clapboard(md, m, mline, cx, cz, w, d, y0, y1):
    """A box of walls with the boards' shadow lines on the front and sides."""
    md.part('box', m, loc=G(cx, (y0 + y1) / 2, cz), size=(w, d, (y1 - y0) / 2))
    y = y0 + 0.3
    while y < y1 - 0.1:
        md.part('box', mline, loc=G(cx, y, cz + d + 0.01), size=(w, 0.012, 0.015)); md.part('box', mline, loc=G(cx, y, cz - d - 0.01), size=(w, 0.012, 0.015))
        for s in (-1, 1): md.part('box', mline, loc=G(cx + s * (w + 0.01), y, cz), size=(0.012, d, 0.015))
        y += 0.3

# ================================================================== the valley: a farm
md = Model('as_farmhouse')  # a two-storey white farmhouse with a porch, a chimney and green shutters (10 x 7 m)
CRE = mat('as_board_line', '#cfc8b8', 0.8)
clapboard(md, WHITEW, CRE, 0, 0, 5, 3.5, 0, 5.6)
md.part('box', STONEW2, loc=G(0, 0.25, 0), size=(5.1, 3.6, 0.25))
gable_end(md, WHITEW, 0, 0, 5, 5.6, 2.8, 3.5)
gable(md, ROOFG, 0, 0, 5, 3.5, 5.6, 2.8)
md.part('box', STONEW, loc=G(3.2, 7.2, -1.2), size=(0.45, 0.45, 1.9)); md.part('box', STONEW2, loc=G(3.2, 9.1, -1.2), size=(0.55, 0.55, 0.12))
windows(md, (-3.2, -1.2, 1.2, 3.2), 4.2, 3.5); windows(md, (-3.2, 3.2), 1.9, 3.5)
for x in (-3.2, -1.2, 1.2, 3.2):
    for s in (-1, 1): md.part('box', GREENP, loc=G(x + s * 0.68, 4.2, 3.56), size=(0.18, 0.04, 0.38))
md.part('box', GREENP, loc=G(0, 1.25, 3.53), size=(0.6, 0.05, 1.2)); md.part('box', WOODD, loc=G(0.4, 1.2, 3.6), size=(0.05, 0.05, 0.05))
md.part('box', WOOD, loc=G(0, 0.55, 4.7), size=(4.6, 1.2, 0.1))  # the porch
for x in (-4.4, -1.5, 1.5, 4.4): md.part('cyl', WHITEW, loc=G(x, 1.85, 5.7), size=(0.1, 0.1, 1.25), seg=8)
md.part('box', ROOFG, loc=G(0, 3.2, 4.8), size=(4.9, 1.4, 0.08), rot=(-12, 0, 0))
for x in [-4.4 + i * 0.4 for i in range(23)]:
    if abs(x) > 0.8: md.part('box', WHITEW, loc=G(x, 1.05, 5.75), size=(0.03, 0.03, 0.4))
md.part('box', WHITEW, loc=G(0, 1.45, 5.75), size=(4.5, 0.05, 0.04))
side_windows(md, (-1.5, 1.5), 4.2, 5, 1); side_windows(md, (-1.5, 1.5), 4.2, -5, -1); side_windows(md, (0,), 1.9, 5, 1)
objs.append(md.finish())

md = Model('as_barn')  # a red barn with a gambrel roof, white trim, the big doors and a hay loft (14 x 10 m)
BL = mat('as_barn_line', '#8a2620', 0.8)
clapboard(md, REDW, BL, 0, 0, 5, 7, 0, 5.0)
md.part('box', STONEW2, loc=G(0, 0.3, 0), size=(5.1, 7.1, 0.3))
# the gambrel: steep lower slopes, shallow upper ones
for s in (-1, 1):
    md.part('box', ROOFG, loc=G(s * 4.35, 6.4, 0), size=(1.6, 7.4, 0.12), rot=(0, s * 62, 0))
    md.part('box', ROOFG, loc=G(s * 1.9, 8.25, 0), size=(2.15, 7.4, 0.12), rot=(0, s * 24, 0))
for s in (-1, 1): md.part('poly', REDW, loc=G(0, 5.0, s * 7), points=[(-5, 0), (5, 0), (3.7, 2.8), (0, 4.1), (-3.7, 2.8)], depth=0.2)
md.part('box', ROOFG, loc=G(0, 9.18, 0), size=(0.15, 7.5, 0.1))
for s in (-1, 1):  # the big doors, with their white X braces
    md.part('box', REDF, loc=G(s * 1.3, 1.9, 7.05), size=(1.25, 0.08, 1.9))
    md.part('box', WHITEW, loc=G(s * 1.3, 1.9, 7.12), size=(1.3, 0.04, 0.08)); md.part('box', WHITEW, loc=G(s * 1.3, 3.8, 7.12), size=(1.3, 0.04, 0.08))
    for a in (-56, 56): md.part('box', WHITEW, loc=G(s * 1.3, 1.9, 7.13), size=(0.06, 0.03, 2.2), rot=(0, a, 0))
md.part('box', WHITEW, loc=G(0, 6.8, 7.12), size=(0.95, 0.05, 0.9)); md.part('box', REDF, loc=G(0, 6.8, 7.16), size=(0.8, 0.05, 0.75))  # the loft door
md.part('box', WOOD, loc=G(0, 8.0, 7.6), size=(0.12, 0.8, 0.12))  # the hay hoist beam
for z in (-4, 0, 4): side_windows(md, (z,), 2.8, 5, 1, 0.4, 0.4, WHITEW); side_windows(md, (z,), 2.8, -5, -1, 0.4, 0.4, WHITEW)
md.part('cyl', METAL, loc=G(0, 9.6, 0), size=(0.45, 0.45, 0.5), seg=8); md.part('cyl', METAL, loc=G(0, 10.3, 0), size=(0.6, 0.6, 0.25), seg=8, top=0.1)  # the cupola
objs.append(md.finish())

md = Model('as_silo')  # a tall silo with a domed cap and hoops (3.2 m across, 14 m)
md.part('cyl', STONEW, loc=G(0, 6.5, 0), size=(1.6, 1.6, 6.5), seg=20)
for k in range(9): md.part('torus', STEEL, loc=G(0, 1.2 + k * 1.45, 0), size=(1.62, 1.62, 1.62), seg=20, ring=4, tube=0.025)
md.part('rock', METAL, loc=G(0, 13.0, 0), size=(1.7, 1.7, 1.2), sub=3)
md.part('box', STEEL, loc=G(1.62, 6.5, 0), size=(0.05, 0.25, 6.5)); [md.part('box', STEEL, loc=G(1.7, 0.6 + k * 0.6, 0), size=(0.04, 0.25, 0.02)) for k in range(21)]
objs.append(md.finish())

md = Model('as_haybales')  # round bales in a field (a cluster of five)
for i, (x, z, a) in enumerate([(0, 0, 0), (1.7, 0.3, 20), (-1.6, 0.6, -10), (0.4, 1.9, 80), (2.6, 2.4, 45)]):
    md.part('cyl', HAY, loc=G(x, 0.75, z), size=(0.75, 0.75, 0.65), seg=16, rot=(0, 90, a), amp=0.03, freq=4, seed=i)
    for s in (-1, 1): md.part('cyl', HAYD, loc=G(x + s * 0.66 * math.cos(math.radians(a)), 0.75, z - s * 0.66 * math.sin(math.radians(a))), size=(0.6, 0.6, 0.02), seg=16, rot=(0, 90, a))
objs.append(md.finish())

md = Model('as_fence')  # a post-and-rail fence, 12 m along x
for k in range(7): md.part('box', WOODD, loc=G(-6 + k * 2, 0.6, 0), size=(0.08, 0.08, 0.6))
for y in (0.45, 0.95): md.part('box', WOOD, loc=G(0, y, 0), size=(6.05, 0.04, 0.06))
objs.append(md.finish())

md = Model('as_cottage')  # a stone cottage with a thatched roof, a chimney and a blue door (8 x 5 m)
md.part('rbox', STONEW, loc=G(0, 1.5, 0), size=(4, 2.5, 1.5), r=0.15, amp=0.04, freq=3, seed=1)
for k in range(30): md.part('box', STONEW2, loc=G(-3.6 + (k * 1.37) % 7.2, 0.4 + (k * 0.53) % 2.4, 2.52), size=(0.28, 0.03, 0.14))
md.part('rbox', THATCH, loc=G(0, 3.6, 0), size=(4.6, 3.1, 1.0), r=0.5, segs=3, amp=0.08, freq=2, seed=2)
md.part('rbox', THATCHD, loc=G(0, 4.55, 0), size=(4.3, 0.5, 0.25), r=0.2)
for s in (-1, 1): md.part('poly', STONEW, loc=G(0, 3.0, s * 2.5), points=[(-4, 0), (4, 0), (2.5, 1.2), (-2.5, 1.2)], depth=0.2)
md.part('box', STONEW2, loc=G(-3.2, 4.6, 0), size=(0.45, 0.45, 1.3))
md.part('box', BLUEP, loc=G(0.8, 1.05, 2.53), size=(0.5, 0.05, 1.05))
windows(md, (-2.2, 2.6), 1.5, 2.5, 0.5, 0.45, WHITEW, GLASSL)
for x in (-2.2, 2.6): md.part('box', WOOD, loc=G(x, 0.95, 2.7), size=(0.6, 0.18, 0.12))  # window boxes
for x in (-2.2, 2.6): md.part('rock', mat('as_flowers', '#e04a6a', 0.9), loc=G(x, 1.12, 2.72), size=(0.55, 0.14, 0.12), sub=1)
objs.append(md.finish())

md = Model('as_chapel')  # a white chapel with a steeple and a bell (7 x 12 m, 19 m to the cross)
clapboard(md, WHITEW, CRE, 0, 0, 3.5, 6, 0, 5.2)
gable_end(md, WHITEW, 0, 0, 3.5, 5.2, 3.2, 6); gable(md, ROOFG, 0, 0, 3.5, 6, 5.2, 3.2)
md.part('box', WHITEW, loc=G(0, 7.2, 5.0), size=(1.3, 1.3, 2.0)); md.part('box', WHITEW, loc=G(0, 9.8, 5.0), size=(1.0, 1.0, 0.7))
for s in (-1, 1): md.part('box', DARK, loc=G(s * 1.01, 9.8, 5.0), size=(0.02, 0.45, 0.45)); md.part('box', DARK, loc=G(0, 9.8, 5.0 + s * 1.01), size=(0.45, 0.02, 0.45))
md.part('cyl', ROOFG, loc=G(0, 12.6, 5.0), size=(1.1, 1.1, 2.1), seg=4, top=0.02, rot=(0, 0, 45))
md.part('box', STEEL, loc=G(0, 15.5, 5.0), size=(0.06, 0.06, 0.8)); md.part('box', STEEL, loc=G(0, 15.7, 5.0), size=(0.35, 0.06, 0.06))
md.part('cyl', mat('as_bronze', '#b08a3a', 0.4, 0.8), loc=G(0, 9.6, 5.0), size=(0.4, 0.4, 0.35), seg=10, top=0.5)
md.part('box', WOODD, loc=G(0, 1.6, 6.05), size=(0.8, 0.05, 1.6)); md.part('cyl', WOODD, loc=G(0, 3.2, 6.05), size=(0.8, 0.8, 0.05), seg=12, rot=(90, 0, 0))
for z in (-3.5, -1, 1.5): side_windows(md, (z,), 2.8, 3.5, 1, 0.45, 1.0, WHITEW, GLASSL); side_windows(md, (z,), 2.8, -3.5, -1, 0.45, 1.0, WHITEW, GLASSL)
objs.append(md.finish())

# ================================================================== the fjords and the taiga
md = Model('as_logcabin')  # a log cabin with a snowy (or sod) roof, a stone chimney and a little porch (7 x 5 m)
for k in range(9):
    y = 0.25 + k * 0.42
    for s in (-1, 1):
        md.part('cyl', LOG, loc=G(0, y, s * 2.5), size=(0.22, 0.22, 3.75), seg=8, rot=(0, 90, 0))
        md.part('cyl', LOG, loc=G(s * 3.5, y + 0.21, 0), size=(0.22, 0.22, 2.75), seg=8, rot=(90, 0, 0))
    for sx in (-1, 1):
        for sz in (-1, 1): md.part('cyl', LOGE, loc=G(sx * 3.76, y, sz * 2.5), size=(0.2, 0.2, 0.03), seg=8, rot=(0, 90, 0))
md.part('box', LOG, loc=G(0, 1.9, 0), size=(3.4, 2.4, 1.8))
gable_end(md, LOG, 0, 0, 3.5, 3.95, 2.0, 2.5)
gable(md, SNOWC, 0, 0, 3.6, 2.6, 3.95, 2.0, over=0.5, th=0.22); gable(md, ROOFB, 0, 0, 3.6, 2.6, 3.8, 2.0, over=0.45, th=0.1)
md.part('box', STONEW, loc=G(-3.9, 2.7, -0.8), size=(0.5, 0.5, 2.7)); md.part('box', SNOWC, loc=G(-3.9, 5.45, -0.8), size=(0.55, 0.55, 0.08))
md.part('box', WOODD, loc=G(1.0, 1.1, 2.75), size=(0.55, 0.05, 1.05)); windows(md, (-1.6,), 1.8, 2.72, 0.5, 0.45, LOGE, GLASSL)
md.part('box', WOOD, loc=G(0, 0.2, 3.5), size=(3.4, 1.0, 0.08))
for x in (-3.2, 3.2): md.part('cyl', LOG, loc=G(x, 1.5, 4.3), size=(0.12, 0.12, 1.4), seg=6)
md.part('box', ROOFB, loc=G(0, 2.95, 3.6), size=(3.6, 1.1, 0.06), rot=(-14, 0, 0))
objs.append(md.finish())

md = Model('as_rorbu')  # a red fishing hut on stilts at the water's edge, white trim, a sod roof (6 x 9 m)
for x in (-2.6, 0, 2.6):
    for z in (-3.8, -1.3, 1.3, 3.8): md.part('cyl', WOODD, loc=G(x, 0.9, z), size=(0.16, 0.16, 1.8), seg=6)
md.part('box', WOOD, loc=G(0, 1.9, 0), size=(3.1, 4.6, 0.15))
clapboard(md, REDF, mat('as_falu_line', '#6a1e18', 0.85), 0, 0, 3, 4.5, 2.0, 5.0)
gable_end(md, REDF, 0, 0, 3, 5.0, 2.4, 4.5)
gable(md, SOD, 0, 0, 3.1, 4.6, 5.0, 2.4, over=0.3, th=0.25)
for s in (-1, 1): md.part('box', WHITEW, loc=G(s * 1.55, 6.2, 4.75), size=(1.75, 0.05, 0.08), rot=(0, 0 if s < 0 else 0, -s * 38))
windows(md, (-1.5, 1.5), 3.6, 4.5, 0.5, 0.55, WHITEW, GLASS); md.part('box', WHITEW, loc=G(0, 3.1, 4.52), size=(0.7, 0.05, 1.1)); md.part('box', REDF, loc=G(0, 3.0, 4.56), size=(0.55, 0.05, 0.95))
side_windows(md, (-2, 2), 3.6, 3, 1, 0.45, 0.5, WHITEW); side_windows(md, (-2, 2), 3.6, -3, -1, 0.45, 0.5, WHITEW)
objs.append(md.finish())

md = Model('as_jetty')  # a wooden jetty on piles with a bollard and a little boat tied up (16 m along +z)
for z in range(0, 17, 4):
    for s in (-1, 1): md.part('cyl', WOODD, loc=G(s * 1.1, -0.6, z), size=(0.16, 0.16, 1.6), seg=6)
for k in range(32): md.part('box', WOOD, loc=G(0, 1.0, k * 0.5 + 0.25), size=(1.3, 0.22, 0.05))
md.part('cyl', DARK, loc=G(1.0, 1.25, 15.5), size=(0.12, 0.12, 0.22), seg=8)
md.part('sweep', BLUEP, points=[G(2.6, 0.35, 11), G(2.7, 0.3, 13), G(2.7, 0.3, 15), G(2.6, 0.35, 17)], r=[0.2, 0.75, 0.75, 0.2], ring=10, squash=0.6)
md.part('box', WOOD, loc=G(2.7, 0.45, 14), size=(0.6, 0.08, 0.04))
objs.append(md.finish())

# ================================================================== the desert
md = Model('as_adobe')  # a flat-roofed adobe house with roof beams sticking out, a ladder and a blue door (8 x 6 m)
md.part('rbox', ADOBE, loc=G(0, 1.6, 0), size=(4, 3, 1.6), r=0.25, amp=0.05, freq=2, seed=3)
md.part('rbox', ADOBE2, loc=G(-1.5, 3.9, -1), size=(2.2, 1.8, 0.8), r=0.2, amp=0.04, freq=2, seed=4)
md.part('box', ADOBE2, loc=G(0, 3.25, 0), size=(4.05, 3.05, 0.08))
for x in (-3.2, -1.6, 0, 1.6, 3.2): md.part('cyl', WOODD, loc=G(x, 2.8, 3.1), size=(0.12, 0.12, 0.45), seg=6, rot=(90, 0, 0))
md.part('box', BLUEP, loc=G(1.2, 1.0, 3.02), size=(0.5, 0.05, 1.0)); windows(md, (-1.8,), 1.7, 3.0, 0.4, 0.4, WOODD, GLASS)
for s in (-1, 1): md.part('box', WOOD, loc=G(3.2 + s * 0.3, 2.6, 3.4), size=(0.05, 0.05, 2.0), rot=(10, 0, 0))
for k in range(6): md.part('box', WOOD, loc=G(3.2, 1.0 + k * 0.6, 3.5 - k * 0.1), size=(0.32, 0.04, 0.03))
md.part('rock', mat('as_chili', '#b8281e', 0.8), loc=G(-3.0, 2.2, 3.1), size=(0.12, 0.12, 0.6), sub=1)
objs.append(md.finish())

md = Model('as_windpump')  # a farm wind pump: a steel lattice tower, a many-bladed wheel and a tail vane (11 m)
for sx in (-1, 1):
    for sz in (-1, 1): md.part('sweep', STEEL, points=[G(sx * 1.4, 0, sz * 1.4), G(sx * 0.25, 9.0, sz * 0.25)], r=0.06, ring=5)
for k in range(5):
    y = 1.2 + k * 1.7; w = 1.4 - (1.15 * y / 9.0)
    for a, b in [((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1))]: md.part('sweep', STEEL, points=[G(a[0] * w, y, a[1] * w), G(b[0] * w, y, b[1] * w)], r=0.03, ring=4)
md.part('box', STEEL, loc=G(0, 9.3, 0), size=(0.3, 0.6, 0.25))
for k in range(16):
    a = k / 16 * T; md.part('box', METAL, loc=G(math.cos(a) * 1.0, 9.4 + math.sin(a) * 1.0, 0.75), size=(0.6, 0.02, 0.12), rot=(0, 25, math.degrees(a)))
md.part('torus', STEEL, loc=G(0, 9.4, 0.75), size=(1.6, 1.6, 1.6), seg=20, ring=4, tube=0.02, rot=(90, 0, 0))
md.part('box', STEEL, loc=G(0, 9.4, -1.0), size=(0.04, 1.2, 0.04)); md.part('poly', METAL, loc=G(0, 9.0, -2.2), points=[(-0.6, 0), (0.6, 0), (0.8, 0.9), (-0.8, 0.9)], depth=0.03, rot=(0, 0, 90))
md.part('cyl', mat('as_tank', '#7a8a8a', 0.6, 0.5), loc=G(3.2, 0.6, 0), size=(1.6, 1.6, 0.6), seg=20)
objs.append(md.finish())

# ================================================================== the tropics
md = Model('as_stilthut')  # a stilt hut over the shallows: bamboo legs, a woven floor, a steep palm-thatch roof (6 x 6 m)
for x in (-2.4, 0, 2.4):
    for z in (-2.4, 0, 2.4): md.part('cyl', THATCHD, loc=G(x, 0.4, z), size=(0.12, 0.12, 1.8), seg=6)
md.part('box', WOOD, loc=G(0, 2.2, 0), size=(2.8, 2.8, 0.12))
md.part('box', THATCH, loc=G(0, 3.3, 0), size=(2.4, 2.4, 1.0))
for k in range(8): md.part('box', THATCHD, loc=G(-2.4 + k * 0.68, 3.3, 2.42), size=(0.03, 0.02, 1.0))
md.part('cyl', PALM, loc=G(0, 5.9, 0), size=(3.6, 3.6, 1.7), seg=4, top=0.04, rot=(0, 0, 45), amp=0.12, freq=1.5, seed=5)
md.part('cyl', THATCH, loc=G(0, 5.4, 0), size=(3.7, 3.7, 1.2), seg=4, top=0.3, rot=(0, 0, 45))
md.part('box', DARK, loc=G(0.6, 3.1, 2.44), size=(0.5, 0.04, 0.8))
for k in range(5): md.part('box', WOOD, loc=G(0.6, 0.4 + k * 0.4, 3.2 + k * 0.05), size=(0.45, 0.06, 0.03))
for s in (-1, 1): md.part('box', WOOD, loc=G(0.6 + s * 0.48, 1.2, 3.3), size=(0.04, 0.04, 1.1), rot=(-8, 0, 0))
objs.append(md.finish())

md = Model('as_canoe')  # an outrigger canoe pulled up on the beach (7 m)
md.part('sweep', mat('as_canoe_red', '#a8442a', 0.8), points=[G(0, 0.5, -3.5), G(0, 0.35, -2.5), G(0, 0.3, 0), G(0, 0.35, 2.5), G(0, 0.5, 3.5)], r=[0.05, 0.38, 0.45, 0.38, 0.05], ring=10, squash=0.7)
md.part('box', DARK, loc=G(0, 0.5, 0), size=(0.3, 2.6, 0.04))
for z in (-1.2, 1.2): md.part('box', WOOD, loc=G(1.0, 0.55, z), size=(1.1, 0.05, 0.04))
md.part('sweep', WOOD, points=[G(2.0, 0.25, -2.0), G(2.0, 0.22, 0), G(2.0, 0.25, 2.0)], r=[0.04, 0.13, 0.04], ring=6)
md.part('box', WOOD, loc=G(-0.2, 0.55, 1.6), size=(0.06, 0.8, 0.02), rot=(0, 0, 15)); md.part('box', WOOD, loc=G(-0.2, 0.55, 2.4), size=(0.15, 0.2, 0.02), rot=(0, 0, 15))
objs.append(md.finish())

# ================================================================== mixed country
md = Model('as_watertower')  # a wooden water tank on a steel frame (15 m)
for sx in (-1, 1):
    for sz in (-1, 1): md.part('sweep', STEEL, points=[G(sx * 2.2, 0, sz * 2.2), G(sx * 1.6, 10, sz * 1.6)], r=0.12, ring=6)
for y in (3.4, 6.8): md.part('torus', STEEL, loc=G(0, y, 0), size=(2.6 - y * 0.06, 2.6 - y * 0.06, 2.6 - y * 0.06), seg=4, ring=4, tube=0.03, rot=(0, 0, 45))
md.part('cyl', WOOD, loc=G(0, 12.0, 0), size=(2.6, 2.6, 2.0), seg=20)
for k in range(4): md.part('torus', DARK, loc=G(0, 10.5 + k * 1.0, 0), size=(2.62, 2.62, 2.62), seg=20, ring=4, tube=0.015)
md.part('cyl', ROOFR, loc=G(0, 14.8, 0), size=(2.9, 2.9, 0.8), seg=20, top=0.05)
md.part('box', STEEL, loc=G(2.65, 7.0, 0), size=(0.04, 0.25, 7.0))
objs.append(md.finish())

md = Model('as_cart')  # a farm cart with a load of hay
md.part('box', WOOD, loc=G(0, 0.9, 0), size=(0.9, 1.6, 0.1))
for s in (-1, 1): md.part('box', WOOD, loc=G(s * 0.9, 1.25, 0), size=(0.05, 1.6, 0.3))
for s in (-1, 1): md.part('cyl', WOODD, loc=G(s * 1.0, 0.65, -0.4), size=(0.62, 0.62, 0.06), seg=14, rot=(0, 90, 0))
md.part('rbox', HAY, loc=G(0, 1.5, 0), size=(0.85, 1.5, 0.5), r=0.3, amp=0.06, freq=3, seed=7)
for s in (-1, 1): md.part('box', WOODD, loc=G(s * 0.4, 0.8, 2.5), size=(0.05, 1.0, 0.05))
objs.append(md.finish())

export(objs, OUT, spacing=14)
