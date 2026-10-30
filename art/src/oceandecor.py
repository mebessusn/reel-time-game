# Open Waters stage 5: trophies for the cottage. A marlin's bill and a shark's jaw on wall boards, a giant squid in a
# v1.15.11: wall pieces fixed to hang flat on the wall (box sizes are x, depth, height in the kit; they had been x, height, depth).
# jar on a stand, and the ship in a bottle you get for catching every fish in Open Waters.
#   python3 art/src/oceandecor.py   -> art/oceandecor.blend + art/oceandecor.glb
#   node scripts/glb-to-js.mjs art/oceandecor.glb src/data/oceanDecorMesh.js OCEAN_DECOR
# Wall pieces are centred on their origin with their back on the wall, facing +Z (game axes); the jar stands on its
# origin. Glass uses the material named ow_glass (the game makes it see-through).
import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
import bpy
from kit import Model, mat, reset, export, ellipse

OUT = os.path.join(os.path.dirname(__file__), '..', 'oceandecor')
G = lambda x, y, z: (x, -z, y)
reset()
WOOD = mat('ow_board', '#6a4024', 0.6)
WOODL = mat('ow_board_light', '#8a5a32', 0.6)
BRASS = mat('ow_brass', '#d8a83a', 0.3, 0.85)
BILL = mat('ow_bill', '#2a3550', 0.5)
BILLD = mat('ow_bill_dark', '#1a2032', 0.5)
BONE = mat('ow_bone', '#ece4cc', 0.6)
GUM = mat('ow_gum', '#b86a6a', 0.7)
GLASS = mat('ow_glass', '#bfe6ee', 0.1)
CORK = mat('ow_cork', '#b88a5a', 0.9)
HULL = mat('ow_hull', '#7a4a26', 0.7)
SAIL = mat('ow_sail', '#f4efe2', 0.9)
SEA = mat('ow_sea', '#2f7f9a', 0.6)
SQUID = mat('ow_squid', '#d0705a', 0.5)
SQUIDL = mat('ow_squid_light', '#e8a090', 0.5)
EYE = mat('ow_eye', '#141414', 0.3)
WATER = mat('ow_jar_water', '#8ac8c0', 0.2)
RED = mat('ow_flag', '#c03a2a', 0.8)

def board(m, w, h, d=0.05, shape='rect'):
    if shape == 'oval':
        m.part('poly', WOOD, loc=G(0, 0, d / 2), points=ellipse(w, h, 24), depth=d)
        m.part('poly', WOODL, loc=G(0, 0, d + 0.006), points=ellipse(w * 0.88, h * 0.86, 24), depth=0.012)
    else:
        m.part('rbox', WOOD, loc=G(0, 0, d / 2), size=(w, d / 2, h), r=0.02)
        m.part('rbox', WOODL, loc=G(0, 0, d + 0.006), size=(w * 0.92, 0.006, h * 0.85), r=0.01)

objs = []
# ---- the marlin bill: a long tapered spike over a board, with a brass plate
m = Model('decor_ow_bill')
board(m, 0.75, 0.2)
m.part('cyl', BILL, loc=G(-0.05, 0.03, 0.12), size=(0.05, 0.05, 0.62), rot=(0, 90, 0), seg=10, top=0.06)
m.part('rock', BILLD, loc=G(0.52, 0.03, 0.12), size=(0.1, 0.075, 0.07), sub=2)
m.part('rbox', BRASS, loc=G(0.42, -0.12, 0.065), size=(0.14, 0.006, 0.03), r=0.006, segs=1)
objs.append(m.finish())

# ---- the shark jaw: two arcs of bone with rows of teeth on an oval board
m = Model('decor_ow_jaw')
board(m, 0.42, 0.4, shape='oval')
for s in (1, -1):
    arc = [(math.cos(a) * 0.3, s * math.sin(a) * 0.22) for a in [math.pi * k / 10 for k in range(11)]]
    m.part('sweep', BONE, points=[G(x, y, 0.1) for x, y in arc], r=0.032, ring=6)
    m.part('sweep', GUM, points=[G(x * 0.93, y * 0.84, 0.12) for x, y in arc], r=0.016, ring=5)
    for k in range(1, 10):
        a = math.pi * k / 10
        x, y = math.cos(a) * 0.29, s * math.sin(a) * 0.21
        m.part('cyl', BONE, loc=G(x, y - s * 0.035, 0.13), size=(0.016, 0.01, 0.03), rot=(0 if s > 0 else 180, 0, 0), seg=4, top=0.05)
m.part('rbox', BRASS, loc=G(0, -0.33, 0.065), size=(0.12, 0.006, 0.025), r=0.006, segs=1)
objs.append(m.finish())

# ---- the ship in a bottle, lying on a cradle on a board
m = Model('decor_ow_bottle')
board(m, 0.5, 0.24)
for x in (-0.22, 0.18): m.part('box', WOODL, loc=G(x, -0.1, 0.12), size=(0.03, 0.07, 0.04))
m.part('cyl', SEA, loc=G(-0.02, -0.06, 0.16), size=(0.07, 0.03, 0.3), rot=(0, 90, 0), seg=10)
m.part('box', HULL, loc=G(-0.02, -0.01, 0.16), size=(0.15, 0.035, 0.025))
m.part('cyl', HULL, loc=G(-0.02, 0.08, 0.16), size=(0.006, 0.006, 0.09), seg=4)
m.part('poly', SAIL, loc=G(-0.02, 0.0, 0.16), points=[(-0.11, 0.0), (0.09, 0.0), (-0.01, 0.15)], depth=0.004)
m.part('poly', RED, loc=G(-0.02, 0.17, 0.16), points=[(0, 0), (0.04, 0.01), (0, 0.02)], depth=0.003)
m.part('cyl', GLASS, loc=G(-0.02, 0.02, 0.16), size=(0.12, 0.12, 0.3), rot=(0, 90, 0), seg=14)
m.part('cyl', GLASS, loc=G(0.36, 0.02, 0.16), size=(0.045, 0.045, 0.08), rot=(0, 90, 0), seg=10)
m.part('cyl', CORK, loc=G(0.46, 0.02, 0.16), size=(0.04, 0.04, 0.03), rot=(0, 90, 0), seg=8)
m.part('rbox', BRASS, loc=G(0, -0.19, 0.065), size=(0.12, 0.006, 0.02), r=0.006, segs=1)
objs.append(m.finish())

# ---- the giant squid in a jar, on a stand
m = Model('decor_ow_squid')
m.part('cyl', WOOD, loc=G(0, 0.25, 0), size=(0.32, 0.32, 0.25), seg=10)
m.part('cyl', WOODL, loc=G(0, 0.51, 0), size=(0.34, 0.34, 0.02), seg=10)
m.part('cyl', WATER, loc=G(0, 0.95, 0), size=(0.27, 0.27, 0.41), seg=16)
m.part('rock', SQUID, loc=G(0, 1.15, 0), size=(0.08, 0.2, 0.08), sub=2)
m.part('cyl', SQUIDL, loc=G(0, 1.38, 0), size=(0.11, 0.03, 0.05), seg=3)
for s in (-1, 1): m.part('rock', EYE, loc=G(s * 0.07, 1.0, 0.04), size=(0.022, 0.022, 0.022), sub=1)
for k in range(8):
    a = k / 8 * math.tau
    pts = [G(math.cos(a) * 0.04, 0.95, math.sin(a) * 0.04), G(math.cos(a) * 0.12, 0.8, math.sin(a) * 0.12), G(math.cos(a + 0.5) * 0.18, 0.66, math.sin(a + 0.5) * 0.18), G(math.cos(a + 0.9) * 0.2, 0.58, math.sin(a + 0.9) * 0.2)]
    m.part('sweep', SQUID if k % 2 else SQUIDL, points=pts, r=[0.022, 0.016, 0.01, 0.005], ring=5)
m.part('cyl', GLASS, loc=G(0, 0.98, 0), size=(0.29, 0.29, 0.45), seg=16)
m.part('cyl', BRASS, loc=G(0, 1.46, 0), size=(0.27, 0.27, 0.04), seg=16)
m.part('rbox', BRASS, loc=G(0, 0.3, 0.32), size=(0.1, 0.006, 0.03), r=0.005, segs=1, rot=(0, 0, 0))
objs.append(m.finish())

# ---- v1.15.11: the Billfish Derby cup (a wall plaque with a gold cup on a little shelf)
m = Model('decor_ow_cup')
board(m, 0.42, 0.56, shape='oval')
m.part('box', WOODL, loc=G(0, -0.12, 0.1), size=(0.3, 0.12, 0.02))  # the shelf
m.part('cyl', BRASS, loc=G(0, -0.07, 0.11), size=(0.06, 0.06, 0.03), seg=12)  # foot
m.part('cyl', BRASS, loc=G(0, 0.0, 0.11), size=(0.02, 0.02, 0.05), seg=8)  # stem
m.part('cyl', BRASS, loc=G(0, 0.12, 0.11), size=(0.1, 0.1, 0.08), seg=14, top=1.35)  # the bowl, flaring up
for s in (-1, 1): m.part('torus', BRASS, loc=G(s * 0.13, 0.13, 0.11), size=(0.045, 0.045, 0.045), tube=0.25, seg=10, ring=4, rot=(90, 0, 0))
m.part('poly', BILL, loc=G(0, 0.12, 0.17), points=[(-0.06, -0.01), (0.03, -0.012), (0.08, 0.0), (0.03, 0.012), (-0.06, 0.01), (-0.08, 0.025), (-0.08, -0.025)], depth=0.004)  # a sailfish on the bowl
m.part('rbox', BRASS, loc=G(0, -0.21, 0.065), size=(0.11, 0.006, 0.02), r=0.006, segs=1)
objs.append(m.finish())

# ---- v1.15.11: a shadow box of tide-pool shells (all six kinds)
SHELLW = mat('ow_shell', '#f2e6d0', 0.6)
SHELLP = mat('ow_shell_pink', '#f0b4a0', 0.6)
SHELLB = mat('ow_shell_brown', '#a8764a', 0.6)
SAND = mat('ow_sand', '#e8d6a8', 0.95)
m = Model('decor_ow_shells')
board(m, 0.62, 0.46)
m.part('rbox', SAND, loc=G(0, 0, 0.07), size=(0.54, 0.01, 0.38), r=0.01)
for (x, y, mt, sz) in ((-0.18, 0.09, SHELLP, 0.07), (0.0, 0.1, SHELLW, 0.06), (0.18, 0.08, SHELLB, 0.065), (-0.17, -0.08, SHELLW, 0.06), (0.01, -0.09, SHELLB, 0.05), (0.18, -0.09, SHELLP, 0.055)):
    m.part('rock', mt, loc=G(x, y, 0.1), size=(sz, sz * 0.8, sz * 0.45), sub=1)
m.part('cyl', SHELLP, loc=G(0.0, 0.1, 0.12), size=(0.025, 0.025, 0.04), seg=8, top=0.1)  # a cone shell
for side in (-1, 1): m.part('box', WOOD, loc=G(side * 0.3, 0, 0.1), size=(0.02, 0.06, 0.44))
for side in (-1, 1): m.part('box', WOOD, loc=G(0, side * 0.22, 0.1), size=(0.62, 0.06, 0.02))
objs.append(m.finish())

# ---- v1.15.11: a jar of sea glass on a little stool (the floor)
GL = [mat('ow_glass_green', '#5ab88a', 0.2), mat('ow_glass_blue', '#4a90c8', 0.2), mat('ow_glass_brown', '#a8703a', 0.2), mat('ow_glass_white', '#e8f4f0', 0.2), mat('ow_glass_red', '#d84a4a', 0.2)]
m = Model('decor_ow_glassjar')
m.part('cyl', WOOD, loc=G(0, 0.2, 0), size=(0.22, 0.22, 0.2), seg=10)
m.part('cyl', WOODL, loc=G(0, 0.41, 0), size=(0.24, 0.24, 0.015), seg=10)
for k in range(14):
    a = k * 2.4; r = 0.05 + (k % 3) * 0.04
    m.part('rock', GL[k % 5], loc=G(math.cos(a) * r, 0.47 + (k // 5) * 0.06, math.sin(a) * r), size=(0.04, 0.035, 0.025), sub=1, seed=k)
m.part('cyl', GLASS, loc=G(0, 0.62, 0), size=(0.17, 0.17, 0.2), seg=14)
m.part('cyl', CORK, loc=G(0, 0.86, 0), size=(0.1, 0.1, 0.04), seg=10)
objs.append(m.finish())

export(objs, OUT, spacing=1.6)
