# Open Waters (v1.15): Captain Marlowe's charter boat, its fighting chair, and the charter pier and sign at Cozy Cove.
#   python3 art/src/charter.py      -> art/charter.blend + art/charter.glb
#   node scripts/glb-to-js.mjs art/charter.glb src/data/charterMesh.js CHARTER
# Sizes passed to the kit are half extents in Blender order: (game x, game z, game y).
# Game axes in this file: x starboard, y up, z toward the bow (the kit converts to Blender's X right, -Y front, Z up).
# The boat's origin is on the still waterline, midships. The cockpit floor is at y 1.2, the side decks and foredeck
# at about 1.5-1.75, the flybridge deck at 2.95. src/ocean/charterBoat.js holds the same numbers for walking.
import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
import bpy, bmesh
from mathutils import Vector
from kit import Model, mat, reset, export

OUT = os.path.join(os.path.dirname(__file__), '..', 'charter')
G = lambda x, y, z: (x, -z, y)  # game -> Blender

reset()
WHITE = mat('hull_white', '#f2f0ea', 0.35)
CREAM = mat('deck_cream', '#e6dfcf', 0.8)
NAVY = mat('boot_navy', '#1e3550', 0.4)
RED = mat('antifoul', '#8e2a26', 0.9)
TEAK = mat('teak', '#a9774a', 0.85)
GLASS = mat('glass', '#24343e', 0.15)
STEEL = mat('steel', '#c8ccd0', 0.25, 0.9)
BLACK = mat('black', '#2a2a2c', 0.6)
BLUE = mat('canvas_blue', '#2f5f8a', 0.9)
GOLD = mat('brass', '#c9a24a', 0.3, 0.9)
WOOD = mat('pier_wood', '#8a6a48', 0.95)
POST = mat('pier_post', '#5c4632', 0.95)
SIGN = mat('sign_paint', '#e9dcc0', 0.9)
SIGNBLUE = mat('sign_blue', '#2d6a96', 0.8)
ROPE = mat('rope', '#d8c8a0', 0.95)
PAINT = mat('hull_paint', '#f2f0ea', 0.35)  # v1.15.13: the hull sides (an owner's boat repaints these, the stripe and the cushions)
WELLB = mat('livewell_water', '#3a8aa0', 0.2)

# ------------------------------------------------------------------ the hull (lofted sections)
Z0, Z1 = -7.4, 7.6  # transom, stem
def half_beam(z):
    if z <= 0: return 2.25 + 0.08 * (1 - (z / Z0) ** 2)
    return max(0.06, 2.33 * (1 - (z / Z1) ** 1.9))
def sheer(z):  # gunwale top
    return 1.95 + 0.38 * max(0.0, z / Z1) ** 1.6 + (0.0 if z > -2.2 else 0.0)
def deck_y(z):
    if z < -2.3: return 1.2
    if z < -1.8: return 1.2 + (z + 2.3) / 0.5 * 0.3
    return 1.5 + 0.25 * max(0.0, z / Z1)
def keel(z):
    if z < 0: return 0.62 + 0.13 * (1 - (z / Z0) ** 2) - 0.1 * (z / Z0) ** 2
    u = z / Z1
    return 0.75 * (1 - u ** 2.2) - 0.5 * u ** 3  # rises to the stem

def hull_part(md):
    bm = md.bm; secs = 30; rings = []
    for i in range(secs + 1):
        z = Z0 + (Z1 - Z0) * (i / secs) ** 1.05
        hb = half_beam(z); sh = sheer(z); dk = deck_y(z); kl = keel(z)
        t = 0.12 if hb > 0.4 else hb * 0.3
        chy = 0.12 + 0.25 * max(0.0, z / Z1) ** 2
        pts = [
            (hb, sh), (hb * 0.99, (sh + chy) / 2), (hb * 0.95, chy), (hb * 0.55, -kl * 0.55), (0.0, -kl),
            (-hb * 0.55, -kl * 0.55), (-hb * 0.95, chy), (-hb * 0.99, (sh + chy) / 2), (-hb, sh),
            (-hb + t, sh), (-hb + t, dk), (0.0, dk), (hb - t, dk), (hb - t, sh),
        ]
        rings.append([bm.verts.new(G(x, y, z)) for x, y in pts])
    n = len(rings[0]); idx = md._slot(WHITE)
    faces = []
    for i in range(secs):
        A, B = rings[i], rings[i + 1]
        for j in range(n):
            f = bm.faces.new((A[j], B[j], B[(j + 1) % n], A[(j + 1) % n])); faces.append((f, j))
    tr = bm.faces.new(rings[0][::-1]); faces.append((tr, -1))
    st = bm.faces.new(rings[-1]); faces.append((st, -2))
    for f, j in faces:
        c = f.calc_center_median(); y = c.z  # Blender Z is game y
        if j in (9, 10, 11, 12): m = TEAK if (j in (10, 11)) else WHITE
        else: m = RED if y < 0.02 else NAVY if y < 0.24 else PAINT
        if j in (10, 11): m = TEAK  # the deck floor
        f.material_index = md._slot(m); f.smooth = j not in (8, 9, 12, 13, -1, -2)
    return md

boat = Model('charter_boat')
hull_part(boat)
P = boat.part
# rub rail along the sheer, both sides
for s in (-1, 1):
    pts = [G(s * (half_beam(z) + 0.03), sheer(z) - 0.06, z) for z in [Z0 + (Z1 - 0.3 - Z0) * k / 16 for k in range(17)]]
    P('sweep', STEEL, points=pts, r=0.05, ring=5)
# cap rail on the cockpit gunwales (teak)
for s in (-1, 1):
    P('box', TEAK, loc=G(s * 2.2, 1.98, -4.8), size=(0.16, 2.6, 0.04))
# transom: swim platform and door
P('rbox', TEAK, loc=G(0, 0.38, -7.75), size=(2.0, 0.4, 0.06), r=0.04)
P('box', CREAM, loc=G(0, 1.55, -7.33), size=(0.55, 0.04, 0.33))
# ---- the salon (cabin) with windows
P('rbox', WHITE, loc=G(0, 2.12, 0.6), size=(1.55, 2.7, 0.62), r=0.18, segs=2)
P('rbox', GLASS, loc=G(0, 2.25, 3.3), size=(1.2, 0.08, 0.32), rot=(18, 0, 0), r=0.06)  # windscreen
for s in (-1, 1):
    P('rbox', GLASS, loc=G(s * 1.56, 2.28, 0.9), size=(0.03, 1.8, 0.26), r=0.04)
P('rbox', GLASS, loc=G(0.55, 2.15, -2.12), size=(0.55, 0.03, 0.42), r=0.05)  # aft window
P('rbox', BLACK, loc=G(-0.6, 1.95, -2.12), size=(0.42, 0.04, 0.75), r=0.04)  # salon door
P('box', GOLD, loc=G(-0.28, 1.95, -2.17), size=(0.03, 0.03, 0.08))
# ---- flybridge (over the salon, overhanging the cockpit) and its helm
P('rbox', WHITE, loc=G(0, 2.86, 0.0), size=(1.65, 2.75, 0.1), r=0.06)
P('rbox', WHITE, loc=G(0, 3.25, 1.95), size=(1.1, 0.5, 0.32), r=0.12)  # console
P('rbox', GLASS, loc=G(0, 3.5, 2.15), size=(1.0, 0.25, 0.08), rot=(-35, 0, 0), r=0.03)
P('torus', BLACK, loc=G(0.35, 3.45, 1.6), size=(0.22, 0.22, 0.22), rot=(-60, 0, 0), tube=0.12, seg=14, ring=4)  # wheel
P('box', BLACK, loc=G(-0.4, 3.5, 1.72), size=(0.04, 0.12, 0.04))  # throttles
for x in (-0.55, 0.55):  # helm seats
    P('rbox', CREAM, loc=G(x, 3.25, 0.95), size=(0.32, 0.3, 0.1), r=0.05)
    P('rbox', CREAM, loc=G(x, 3.55, 0.68), size=(0.32, 0.06, 0.28), r=0.05)
    P('cyl', STEEL, loc=G(x, 3.05, 0.95), size=(0.05, 0.05, 0.12), seg=8)
P('rbox', CREAM, loc=G(0, 3.15, -1.4), size=(1.2, 0.3, 0.12), r=0.06)  # aft bench
# flybridge rail
rail = [G(1.6, 3.45, -2.6), G(1.62, 3.45, 2.4), G(-1.62, 3.45, 2.4), G(-1.6, 3.45, -2.6)]
P('sweep', STEEL, points=rail, r=0.035, ring=5)
for x, z in ((1.6, -2.6), (1.61, -0.6), (1.62, 1.4), (-1.6, -2.6), (-1.61, -0.6), (-1.62, 1.4)):
    P('cyl', STEEL, loc=G(x, 3.18, z), size=(0.025, 0.025, 0.27), seg=6)
# hardtop on four legs
for x, z in ((1.35, -0.3), (-1.35, -0.3), (1.35, 1.7), (-1.35, 1.7)):
    P('cyl', STEEL, loc=G(x, 4.0, z), size=(0.04, 0.04, 0.95), seg=8)
P('rbox', WHITE, loc=G(0, 4.98, 0.7), size=(1.55, 1.45, 0.08), r=0.06)
P('cyl', STEEL, loc=G(0, 5.35, 0.3), size=(0.04, 0.04, 0.35), seg=6)  # radar mast
P('rbox', WHITE, loc=G(0, 5.7, 0.3), size=(0.6, 0.12, 0.06), r=0.03)
# ladder from the cockpit up to the flybridge (port side, aft)
for k in range(6):
    P('box', STEEL, loc=G(-1.2, 1.45 + k * 0.29, -2.4 - k * 0.06), size=(0.28, 0.04, 0.03))
for x in (-1.48, -0.92):
    P('sweep', STEEL, points=[G(x, 1.2, -2.25), G(x, 3.0, -2.62)], r=0.025, ring=5)
# rod holders on the gunwales, rods standing in them
for s in (-1, 1):
    for z in (-6.6, -5.2, -3.8):
        P('cyl', STEEL, loc=G(s * 2.2, 2.02, z), size=(0.04, 0.04, 0.06), seg=6)
        P('cyl', BLACK, loc=G(s * 2.32, 2.85, z - 0.08), size=(0.018, 0.012, 0.85), rot=(4, 0, s * -12), seg=5, top=0.4)
        P('rbox', GOLD, loc=G(s * 2.24, 2.18, z), size=(0.06, 0.06, 0.08), r=0.02)
# rocket launchers along the hardtop's aft edge
for x in (-1.0, -0.35, 0.35, 1.0):
    P('cyl', STEEL, loc=G(x, 5.1, -0.75), size=(0.03, 0.03, 0.12), rot=(-20, 0, 0), seg=6)
# cockpit: fish box in the sole, a bait station, cooler
P('box', CREAM, loc=G(0, 1.22, -6.3), size=(0.55, 0.5, 0.02))
P('box', STEEL, loc=G(0, 1.24, -6.3), size=(0.04, 0.2, 0.01))
P('rbox', WHITE, loc=G(1.55, 1.6, -2.6), size=(0.5, 0.3, 0.4), r=0.06)  # bait station
P('rbox', STEEL, loc=G(1.55, 2.02, -2.6), size=(0.45, 0.26, 0.02), r=0.02)
P('rbox', BLUE, loc=G(-1.55, 1.45, -3.3), size=(0.32, 0.28, 0.25), r=0.08)  # cooler
P('rbox', WHITE, loc=G(-1.55, 1.72, -3.3), size=(0.33, 0.29, 0.03), r=0.03)
# seats: a transom bench across the stern (two places), and two cushioned seats on the foredeck facing the bow
P('rbox', TEAK, loc=G(0, 1.5, -6.92), size=(1.6, 0.26, 0.05), r=0.03)
P('rbox', CREAM, loc=G(0, 1.58, -6.92), size=(1.5, 0.24, 0.05), r=0.04)
P('rbox', CREAM, loc=G(0, 1.92, -7.17), size=(1.5, 0.05, 0.28), rot=(-8, 0, 0), r=0.04)
for x in (-1.3, 1.3): P('box', WHITE, loc=G(x, 1.35, -6.92), size=(0.05, 0.22, 0.15))
for x in (-0.5, 0.5):
    P('rbox', CREAM, loc=G(x, deck_y(5.1) + 0.18, 5.1), size=(0.32, 0.3, 0.1), r=0.06)
    P('rbox', CREAM, loc=G(x, deck_y(5.1) + 0.42, 4.78), size=(0.32, 0.06, 0.22), rot=(14, 0, 0), r=0.05)
    P('rbox', TEAK, loc=G(x, deck_y(5.1) + 0.06, 5.1), size=(0.34, 0.32, 0.05), r=0.02)
# foredeck: rail and stanchions, anchor
for s in (-1, 1):
    zs = [-1.6 + k * 1.1 for k in range(9)]
    pts = [G(s * max(0.15, half_beam(z) - 0.18), deck_y(z) + 0.62, z) for z in zs] + [G(0, deck_y(Z1 - 0.7) + 0.62, Z1 - 0.55)]
    P('sweep', STEEL, points=pts, r=0.03, ring=5)
    for z in zs[::2]:
        P('cyl', STEEL, loc=G(s * max(0.15, half_beam(z) - 0.18), deck_y(z) + 0.31, z), size=(0.022, 0.022, 0.31), seg=6)
P('rbox', STEEL, loc=G(0, deck_y(6.2) + 0.08, 6.4), size=(0.12, 0.35, 0.08), r=0.03)
P('rbox', TEAK, loc=G(0, deck_y(3.8) + 0.02, 4.4), size=(0.55, 0.5, 0.02), r=0.02)  # hatch
boat_ob = boat.finish()

# ---- v1.15.13: the owner's upgrades, each its own object (Marlowe's boat always has the outriggers)
og = Model('charter_outriggers')
for s in (-1, 1):
    og.part('sweep', STEEL, points=[G(s * 1.4, 4.95, 0.5), G(s * 2.6, 6.2, -0.8), G(s * 4.2, 7.6, -2.2)], r=[0.05, 0.04, 0.025], ring=5)
    og.part('cyl', STEEL, loc=G(s * 1.42, 5.05, 0.5), size=(0.08, 0.08, 0.08), seg=8)  # the base
    og.part('sweep', ROPE, points=[G(s * 4.2, 7.6, -2.2), G(s * 3.0, 4.0, -6.0), G(s * 2.2, 2.1, -7.2)], r=0.008, ring=3)  # the halyard down to the cockpit
outrig_ob = og.finish()
lw = Model('charter_livewell')
lw.part('cyl', WHITE, loc=G(0, 1.55, 0), size=(0.42, 0.42, 0.35), seg=16)  # a round bait well in the transom corner
lw.part('cyl', WELLB, loc=G(0, 1.88, 0), size=(0.36, 0.36, 0.03), seg=16)
lw.part('torus', STEEL, loc=G(0, 1.91, 0), size=(0.4, 0.4, 0.4), tube=0.05, seg=16, ring=4)
lw.part('cyl', GLASS, loc=G(0, 1.97, -0.05), size=(0.38, 0.38, 0.015), rot=(-12, 0, 0), seg=16)  # the clear lid, propped
livewell_ob = lw.finish()

# ------------------------------------------------------------------ the fighting chair (swivels; its own object)
ch = Model('charter_chair')
C = ch.part
C('cyl', STEEL, loc=G(0, 0.28, 0), size=(0.11, 0.11, 0.28), seg=10)
C('cyl', STEEL, loc=G(0, 0.03, 0), size=(0.32, 0.32, 0.03), seg=12)
C('rbox', TEAK, loc=G(0, 0.62, 0), size=(0.42, 0.4, 0.07), r=0.05)
C('rbox', CREAM, loc=G(0, 0.72, 0.02), size=(0.38, 0.36, 0.06), r=0.05)
C('rbox', TEAK, loc=G(0, 1.15, -0.36), size=(0.42, 0.06, 0.42), rot=(-8, 0, 0), r=0.05)
C('rbox', CREAM, loc=G(0, 1.15, -0.3), size=(0.36, 0.04, 0.36), rot=(-8, 0, 0), r=0.04)
for s in (-1, 1):
    C('rbox', TEAK, loc=G(s * 0.46, 0.92, 0.0), size=(0.06, 0.32, 0.05), r=0.03)
    C('cyl', STEEL, loc=G(s * 0.46, 0.8, 0.18), size=(0.025, 0.025, 0.12), seg=6)
C('sweep', STEEL, points=[G(-0.3, 0.42, 0.75), G(0, 0.38, 0.85), G(0.3, 0.42, 0.75)], r=0.03, ring=5)  # footrest
C('sweep', STEEL, points=[G(-0.3, 0.42, 0.75), G(-0.22, 0.6, 0.3)], r=0.025, ring=5)
C('sweep', STEEL, points=[G(0.3, 0.42, 0.75), G(0.22, 0.6, 0.3)], r=0.025, ring=5)
C('cyl', GOLD, loc=G(0, 0.68, 0.38), size=(0.05, 0.05, 0.08), rot=(30, 0, 0), seg=8)  # gimbal
chair_ob = ch.finish()

# ------------------------------------------------------------------ the charter pier and sign at Cozy Cove
pr = Model('charter_pier')
Q = pr.part
L, W = 12.0, 2.4  # along +z, out over the water; deck at y 0 (the game places it)
for k in range(int(L / 0.4)):
    z = 0.2 + k * 0.4
    Q('box', WOOD, loc=G(0, 0.0, z), size=(W / 2, 0.18, 0.05))
for x in (-W / 2 + 0.1, W / 2 - 0.1):
    Q('box', POST, loc=G(x, -0.12, L / 2), size=(0.08, L / 2, 0.06))
    for z in (0.3, L / 3, 2 * L / 3, L - 0.3):
        Q('cyl', POST, loc=G(x, -1.2, z), size=(0.13, 0.13, 1.35), seg=8)
for x in (-W / 2 + 0.1, W / 2 - 0.1):
    Q('cyl', POST, loc=G(x, 0.35, L - 0.3), size=(0.13, 0.13, 0.35), seg=8, top=0.85)  # bollards at the end
    Q('torus', ROPE, loc=G(x, 0.4, L - 0.3), size=(0.17, 0.17, 0.17), tube=0.25, seg=10, ring=4)
pier_ob = pr.finish()

sg = Model('charter_sign')
S = sg.part
for x in (-0.75, 0.75):
    S('cyl', POST, loc=G(x, 1.1, 0), size=(0.07, 0.07, 1.1), seg=8)
S('rbox', SIGN, loc=G(0, 1.75, 0), size=(1.0, 0.05, 0.42), r=0.04)
S('rbox', SIGNBLUE, loc=G(0, 1.75, 0.05), size=(0.92, 0.01, 0.34), r=0.03)
# a leaping marlin, cut from a plank: body, bill, sail and tail as flat shapes
marlin = [(-0.55, 1.68), (-0.3, 1.82), (0.1, 1.88), (0.38, 1.84), (0.52, 1.78), (0.38, 1.72), (0.05, 1.66), (-0.3, 1.64)]
S('poly', SIGN, loc=G(0, 0, 0.075), points=[(x, y) for x, y in marlin], depth=0.02)
S('poly', SIGN, loc=G(0, 0, 0.075), points=[(0.5, 1.79), (0.82, 1.83), (0.52, 1.77)], depth=0.02)  # bill
S('poly', SIGN, loc=G(0, 0, 0.075), points=[(-0.2, 1.85), (-0.05, 2.03), (0.22, 2.0), (0.28, 1.86)], depth=0.02)  # sail
S('poly', SIGN, loc=G(0, 0, 0.075), points=[(-0.52, 1.7), (-0.72, 1.92), (-0.62, 1.73), (-0.74, 1.52)], depth=0.02)  # tail
S('rbox', GOLD, loc=G(0, 2.22, 0), size=(0.18, 0.05, 0.05), r=0.02)
sign_ob = sg.finish()

export([boat_ob, chair_ob, pier_ob, sign_ob, outrig_ob, livewell_ob], OUT, spacing=10)
