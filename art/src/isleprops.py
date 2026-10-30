# Open Waters v1.15.6: island dressing. Torches, canoes, a net rack, towels, a hammock, a research tent, the lookout
# ruin and a cannon on Smuggler's Rock, signposts, tropical plants (banana, hibiscus, sea grape), driftwood, shells,
# coconuts, a fire pit, stepping stones, a rope fence and tide pools. Placed by src/ocean/islands.js.
#   python3 art/src/isleprops.py      -> art/isleprops.blend + art/isleprops.glb
#   node scripts/glb-to-js.mjs art/isleprops.glb src/data/islePropsMesh.js ISLEPROP
# Game axes: x right, y up, z forward (G converts). Every piece stands on its origin.
import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
from kit import Model, mat, reset, export

OUT = os.path.join(os.path.dirname(__file__), '..', 'isleprops')
G = lambda x, y, z: (x, -z, y)
reset()
WOOD = mat('ip_wood', '#8a6a48', 0.9)
WOODD = mat('ip_wood_dark', '#5c4632', 0.9)
DRIFT = mat('ip_driftwood', '#b8aa92', 0.95)
BAMBOO = mat('ip_bamboo', '#c8b070', 0.8)
THATCH = mat('ip_thatch', '#c9a35a', 0.95)
FLAME = mat('ip_flame', '#ffb040', 0.5, emit='#ff9020')
EMBER = mat('ip_ember', '#ff6a20', 0.5, emit='#ff4a10')
STONE = mat('ip_stone', '#8f8a80', 0.95)
STONED = mat('ip_stone_dark', '#6a655c', 0.95)
MOSS = mat('ip_moss', '#5f8a42', 0.95)
CANVAS = mat('ip_canvas', '#e6dcc0', 0.9)
CANVASG = mat('ip_canvas_green', '#6f8a5a', 0.9)
RED = mat('ip_red', '#d8483a', 0.85)
TEAL = mat('ip_teal', '#2f9a9a', 0.8)
YELLOW = mat('ip_yellow', '#f0c040', 0.85)
WHITE = mat('ip_white', '#f4efe2', 0.85)
NET = mat('ip_net', '#c8b890', 0.95)
FLOAT = mat('ip_float', '#e86a30', 0.7)
IRON = mat('ip_iron', '#3e3a36', 0.5, 0.7)
RUST = mat('ip_rust', '#6a4a36', 0.6, 0.5)
LEAF = mat('ip_leaf', '#4a9a3a', 0.8)
LEAFD = mat('ip_leaf_dark', '#2f7a30', 0.8)
LEAFL = mat('ip_leaf_light', '#7ab84a', 0.8)
STEM = mat('ip_stem', '#7a8a4a', 0.8)
PINK = mat('ip_flower_pink', '#f05a8a', 0.7)
PETAL = mat('ip_flower_red', '#e8303a', 0.7)
POLLEN = mat('ip_pollen', '#ffd040', 0.7)
SHELL = mat('ip_shell', '#f2e2cc', 0.6)
SHELLP = mat('ip_shell_pink', '#f0b8a8', 0.6)
NUT = mat('ip_coconut', '#5a3e22', 0.8)
NUTG = mat('ip_coconut_green', '#7a8a3a', 0.8)
ROPE = mat('ip_rope', '#d8c8a0', 0.95)
GLASS = mat('ip_glass', '#7ac0d0', 0.15)
objs = []

# ---- a tiki torch (flame lit at night by the game: the flame material glows)
m = Model('isle_torch')
m.part('cyl', BAMBOO, loc=G(0, 0.95, 0), size=(0.045, 0.045, 0.95), seg=6)
for y in (0.4, 0.9, 1.4): m.part('torus', WOODD, loc=G(0, y, 0), size=(0.05, 0.05, 0.05), tube=0.3, seg=8, ring=3)
m.part('cyl', WOODD, loc=G(0, 1.98, 0), size=(0.1, 0.1, 0.1), seg=8, top=0.75)
m.part('cyl', THATCH, loc=G(0, 2.1, 0), size=(0.12, 0.12, 0.04), seg=8)
m.part('rock', FLAME, loc=G(0, 2.33, 0), size=(0.1, 0.1, 0.2), sub=1)
objs.append(m.finish())

# ---- an outrigger canoe pulled up on the sand, with a paddle
m = Model('isle_canoe')
hull = [G(0, 0.28, z) for z in (-2.3, -1.6, -0.6, 0.6, 1.6, 2.3)]
m.part('sweep', WOOD, points=hull, r=[0.04, 0.26, 0.34, 0.34, 0.26, 0.04], ring=10, squash=0.75)
m.part('sweep', WOODD, points=[G(0, 0.5, z) for z in (-1.9, 0, 1.9)], r=[0.2, 0.27, 0.2], ring=10, squash=0.08)  # the open top
for z in (-0.7, 0.7): m.part('cyl', WOODD, loc=G(0.75, 0.5, z), size=(0.03, 0.03, 0.8), seg=5, rot=(0, 90, 0))
m.part('sweep', DRIFT, points=[G(1.5, 0.16, z) for z in (-1.3, 0, 1.3)], r=[0.03, 0.09, 0.03], ring=6)  # the float
for z in (-0.7, 0.7): m.part('cyl', WOODD, loc=G(1.5, 0.32, z), size=(0.025, 0.025, 0.18), seg=5)
m.part('cyl', WOOD, loc=G(-0.6, 0.12, 0.4), size=(0.025, 0.025, 0.7), seg=5, rot=(90, 0, 20))  # paddle
m.part('rbox', WOOD, loc=G(-0.85, 0.06, -0.3), size=(0.11, 0.25, 0.015), r=0.01, rot=(90, 0, 20))
objs.append(m.finish())

# ---- a net rack: two poles, a sagging net, orange floats
m = Model('isle_netrack')
for x in (-1.6, 1.6): m.part('cyl', DRIFT, loc=G(x, 1.0, 0), size=(0.06, 0.06, 1.0), seg=6)
m.part('cyl', DRIFT, loc=G(0, 1.95, 0), size=(0.04, 0.04, 1.7), seg=6, rot=(0, 90, 0))
for i in range(9):
    x = -1.5 + i * 0.375
    m.part('sweep', NET, points=[G(x, 1.95, 0), G(x, 1.3, 0.05), G(x * 0.95, 0.5, 0.1)], r=0.008, ring=3)
for j in range(5):
    y = 1.85 - j * 0.3
    m.part('sweep', NET, points=[G(-1.5, y, 0.02 * j), G(0, y - 0.12, 0.03 * j), G(1.5, y, 0.02 * j)], r=0.008, ring=3)
for x in (-1.1, -0.35, 0.4, 1.15): m.part('rock', FLOAT, loc=G(x, 1.9, 0.06), size=(0.08, 0.08, 0.08), sub=1)
objs.append(m.finish())

# ---- a beach towel, a bag and a pair of flip-flops
m = Model('isle_towel')
for i, c in enumerate((TEAL, WHITE, TEAL, WHITE, TEAL)): m.part('box', c, loc=G(-0.32 + i * 0.16, 0.01, 0), size=(0.08, 0.85, 0.008))
m.part('rbox', YELLOW, loc=G(0.65, 0.16, 0.4), size=(0.18, 0.16, 0.1), r=0.04)
for x in (0.6, 0.72): m.part('rbox', RED, loc=G(x, 0.015, -0.6), size=(0.045, 0.12, 0.012), r=0.005)
objs.append(m.finish())

# ---- a hammock between two posts
m = Model('isle_hammock')
for x in (-1.7, 1.7): m.part('cyl', DRIFT, loc=G(x, 0.9, 0), size=(0.07, 0.07, 0.9), seg=6)
pts = [G(-1.6, 1.4, 0)] + [G(-1.2 + i * 0.4, 1.4 - math.sin(i / 6 * math.pi) * 0.6 - 0.15, 0) for i in range(7)] + [G(1.6, 1.4, 0)]
m.part('sweep', CANVASG, points=pts, r=0.35, ring=10, squash=0.06)
for s in (-1, 1): m.part('sweep', ROPE, points=[G(s * 1.65, 1.42, 0), G(s * 1.25, 1.25, 0)], r=0.015, ring=3)
objs.append(m.finish())

# ---- Turtle Atoll's research tent: canvas A-frame, a table with jars and a clipboard, a crate
m = Model('isle_tent')
for s in (-1, 1): m.part('box', CANVAS, loc=G(s * 0.8, 0.95, 0), size=(1.12, 1.4, 0.03), rot=(0, s * 45, 0))
m.part('cyl', WOODD, loc=G(0, 1.75, 0), size=(0.03, 0.03, 1.5), seg=5, rot=(90, 0, 0))
for z in (-1.4, 1.4): m.part('cyl', WOODD, loc=G(0, 0.9, z), size=(0.03, 0.03, 0.9), seg=5)
m.part('rbox', WOOD, loc=G(0, 0.75, 2.2), size=(0.7, 0.35, 0.04), r=0.02)
for x in (-0.6, 0.6):
    for z in (1.9, 2.5): m.part('cyl', WOODD, loc=G(x, 0.37, z), size=(0.025, 0.025, 0.37), seg=4)
for i, x in enumerate((-0.45, -0.25, -0.05)): m.part('cyl', GLASS, loc=G(x, 0.87, 2.3), size=(0.06, 0.06, 0.09), seg=8)
m.part('box', WHITE, loc=G(0.3, 0.8, 2.15), size=(0.12, 0.16, 0.005), rot=(0, 0, 15))
m.part('rbox', WOODD, loc=G(1.4, 0.3, 1.6), size=(0.32, 0.3, 0.3), r=0.03)
objs.append(m.finish())

# ---- Smuggler's Rock: the old lookout, a ruined round stone tower with a flagpole and a tattered flag
m = Model('isle_lookout')
for ring in range(5):
    y = 0.25 + ring * 0.5
    for k in range(14):
        a = k / 14 * math.tau + (ring % 2) * 0.22
        if ring >= 3 and 0.9 < a < 2.6: continue  # a broken gap in the top courses
        if ring >= 1 and 4.3 < a < 5.2: continue  # the doorway
        m.part('box', STONE if (k + ring) % 3 else STONED, loc=G(math.cos(a) * 1.8, y, math.sin(a) * 1.8), size=(0.38, 0.24, 0.24), rot=(0, 0, -math.degrees(a)))
m.part('cyl', STONED, loc=G(0, 0.05, 0), size=(1.75, 1.75, 0.05), seg=16)
m.part('rock', MOSS, loc=G(1.2, 2.55, 0.9), size=(0.5, 0.35, 0.12), sub=1)
m.part('cyl', WOODD, loc=G(-0.9, 2.6, -0.9), size=(0.05, 0.05, 2.6), seg=6)
m.part('poly', RED, loc=G(-0.9, 0, -0.9), points=[(0.0, 4.6), (1.1, 4.45), (0.85, 4.25), (1.05, 4.0), (0.0, 4.0)], depth=0.02)
for k in range(3): m.part('rbox', STONE, loc=G(2.6 + k * 0.6, 0.15, 0.4 - k * 0.5), size=(0.3, 0.15, 0.25), r=0.05, rot=(0, 0, k * 20))  # fallen blocks
objs.append(m.finish())

# ---- an old cannon on a wooden carriage, aimed out to sea (+z)
m = Model('isle_cannon')
m.part('rbox', WOODD, loc=G(0, 0.3, -0.1), size=(0.38, 0.6, 0.16), r=0.04)
for x in (-0.42, 0.42):
    for z in (-0.5, 0.35): m.part('cyl', WOODD, loc=G(x, 0.22, z), size=(0.2, 0.2, 0.05), seg=10, rot=(0, 90, 0))
m.part('cyl', IRON, loc=G(0, 0.6, 0.1), size=(0.2, 0.2, 0.75), seg=12, top=0.75, rot=(90, 0, 0))
m.part('torus', IRON, loc=G(0, 0.6, 0.83), size=(0.17, 0.17, 0.17), tube=0.2, seg=12, ring=4, rot=(90, 0, 0))
m.part('rock', IRON, loc=G(0, 0.6, -0.7), size=(0.14, 0.14, 0.14), sub=1)
for k in range(4): m.part('rock', RUST, loc=G(0.6 + (k % 2) * 0.17, 0.09 + (k // 3) * 0.15, -0.3 + (k % 3) * 0.15), size=(0.09, 0.09, 0.09), sub=1)
objs.append(m.finish())

# ---- a signpost with two arrow boards (the game writes nothing on them: the shapes say "this way")
m = Model('isle_signpost')
m.part('cyl', DRIFT, loc=G(0, 1.0, 0), size=(0.06, 0.06, 1.0), seg=6)
m.part('poly', WOOD, loc=G(0, 0, 0.05), points=[(0.0, 1.75), (0.75, 1.75), (0.9, 1.62), (0.75, 1.5), (0.0, 1.5)], depth=0.04)
m.part('poly', WOODD, loc=G(0, 0, -0.05), points=[(0.0, 1.38), (-0.7, 1.38), (-0.85, 1.25), (-0.7, 1.12), (0.0, 1.12)], depth=0.04)
objs.append(m.finish())

# ---- tropical plants
def banana(name, h=2.2, leaves=6, seed=0.0):
    m = Model(name)
    m.part('cyl', STEM, loc=G(0, h / 2, 0), size=(0.12, 0.12, h / 2), seg=7, top=0.7)
    for i in range(leaves):
        a = i / leaves * math.tau + seed
        dx, dz = math.cos(a), math.sin(a)
        L = 1.5 + 0.3 * math.sin(i * 1.7 + seed)
        for side in (-1, 1):
            pts = []
            for k in range(6):
                s = k / 5
                pts.append(G(dx * L * s - dz * side * 0.22 * math.sin(s * math.pi), h + 0.5 * math.sin(s * 1.6) - 0.9 * s * s, dz * L * s + dx * side * 0.22 * math.sin(s * math.pi)))
            m.part('sweep', LEAF if i % 2 else LEAFL, points=pts, r=[0.04, 0.2, 0.24, 0.2, 0.12, 0.02], ring=3, squash=0.12)
    return m.finish()
objs += [banana('isle_banana_a', 2.2, 6, 0.2), banana('isle_banana_b', 1.6, 5, 1.3)]

def shrub(name, flower, r=0.7, seed=0):
    m = Model(name)
    for k in range(4):
        a = k / 4 * math.tau + seed
        m.part('rock', LEAFD if k % 2 else LEAF, loc=G(math.cos(a) * r * 0.45, r * 0.55 + (k % 2) * 0.15, math.sin(a) * r * 0.45), size=(r * 0.62, r * 0.62, r * 0.5), sub=2, amp=0.12, freq=2.0, seed=seed + k, smooth=False)
    m.part('rock', LEAF, loc=G(0, r * 0.95, 0), size=(r * 0.55, r * 0.55, r * 0.45), sub=2, amp=0.12, freq=2.0, seed=seed + 9, smooth=False)
    if flower:
        for k in range(9):
            a = k * 2.399 + seed; rr = r * (0.55 + 0.35 * ((k * 37) % 10) / 10); y = r * (0.55 + 0.6 * ((k * 53) % 10) / 10)
            x, z = math.cos(a) * rr, math.sin(a) * rr
            m.part('rock', flower, loc=G(x, y, z), size=(0.11, 0.11, 0.05), sub=1)
            m.part('rock', POLLEN, loc=G(x * 1.04, y + 0.02, z * 1.04), size=(0.03, 0.03, 0.03), sub=1)
    return m.finish()
objs += [shrub('isle_hibiscus', PETAL, 0.75, 1), shrub('isle_hibiscus_pink', PINK, 0.6, 4), shrub('isle_seagrape', None, 0.9, 7)]

# ---- driftwood, shells, coconuts
m = Model('isle_driftwood')
m.part('sweep', DRIFT, points=[G(-1.4, 0.15, -0.2), G(-0.4, 0.18, 0.05), G(0.6, 0.16, -0.05), G(1.5, 0.12, 0.25)], r=[0.09, 0.16, 0.15, 0.06], ring=7)
m.part('sweep', DRIFT, points=[G(0.2, 0.2, 0.0), G(0.5, 0.3, 0.45), G(0.65, 0.34, 0.8)], r=[0.07, 0.05, 0.02], ring=5)
m.part('sweep', DRIFT, points=[G(-1.0, 0.2, -0.1), G(-1.2, 0.45, -0.3)], r=[0.06, 0.02], ring=5)
objs.append(m.finish())
m = Model('isle_shells')
for k in range(7):
    a = k * 2.1; rr = 0.25 + (k % 3) * 0.2
    x, z = math.cos(a) * rr, math.sin(a) * rr
    if k % 2: m.part('cyl', SHELL if k % 3 else SHELLP, loc=G(x, 0.06, z), size=(0.05, 0.05, 0.08), seg=6, top=0.05, rot=(80, 0, k * 40))
    else: m.part('rock', SHELLP if k % 4 else SHELL, loc=G(x, 0.02, z), size=(0.09, 0.08, 0.03), sub=1)
objs.append(m.finish())
m = Model('isle_coconuts')
for k, (x, y, z) in enumerate(((0, 0.12, 0), (0.24, 0.12, 0.05), (0.1, 0.12, 0.24), (0.12, 0.32, 0.1), (-0.22, 0.12, 0.12))):
    m.part('rock', NUT if k % 2 else NUTG, loc=G(x, y, z), size=(0.14, 0.14, 0.12), sub=1)
objs.append(m.finish())

# ---- a fire pit: a ring of stones, crossed logs, embers (glowing)
m = Model('isle_firepit')
for k in range(9):
    a = k / 9 * math.tau
    m.part('rock', STONE if k % 2 else STONED, loc=G(math.cos(a) * 0.7, 0.1, math.sin(a) * 0.7), size=(0.2, 0.18, 0.14), sub=1, amp=0.03, seed=k, smooth=False)
for k in range(3):
    a = k / 3 * math.pi
    m.part('cyl', WOODD, loc=G(0, 0.14, 0), size=(0.06, 0.06, 0.45), seg=6, rot=(90, 0, math.degrees(a)))
m.part('rock', EMBER, loc=G(0, 0.08, 0), size=(0.3, 0.3, 0.06), sub=1)
for k in range(3): m.part('rock', DRIFT, loc=G(-1.0 + k * 0.05, 0.2, -0.9 + k * 0.9), size=(0.5, 0.18, 0.16), sub=1)  # log seats
objs.append(m.finish())

# ---- path stones, a rope fence along the cliff top, a tide pool
m = Model('isle_stepstone')
m.part('rock', STONE, loc=G(0, 0.02, 0), size=(0.45, 0.38, 0.06), sub=1, amp=0.02, seed=3, smooth=False)
objs.append(m.finish())
m = Model('isle_fence')
for x in (-2.0, 0.0, 2.0): m.part('cyl', DRIFT, loc=G(x, 0.55, 0), size=(0.06, 0.06, 0.55), seg=6)
for y in (0.95, 0.6): m.part('sweep', ROPE, points=[G(-2.0, y, 0), G(-1.0, y - 0.12, 0), G(0, y, 0), G(1.0, y - 0.12, 0), G(2.0, y, 0)], r=0.02, ring=4)
objs.append(m.finish())
m = Model('isle_tidepool')
for k in range(11):
    a = k / 11 * math.tau
    m.part('rock', STONED if k % 3 else MOSS, loc=G(math.cos(a) * 1.3, 0.1, math.sin(a) * 1.0), size=(0.42, 0.34, 0.22), sub=1, amp=0.06, seed=k, smooth=False)
m.part('cyl', GLASS, loc=G(0, 0.06, 0), size=(1.15, 0.9, 0.01), seg=16)
m.part('rock', PINK, loc=G(0.3, 0.05, 0.2), size=(0.08, 0.08, 0.04), sub=1)  # an anemone
m.part('rock', YELLOW, loc=G(-0.4, 0.05, -0.1), size=(0.07, 0.07, 0.03), sub=1)  # a starfish (roughly)
objs.append(m.finish())

# ---- v1.15.10: a split-log bench for the fire pits (seat top at 0.42), and a standing drum for the fireside player
m = Model('isle_logbench')
m.part('cyl', WOOD, loc=G(0, 0.3, 0), size=(0.2, 0.2, 0.75), seg=10, rot=(0, 90, 0))  # the half log, lying along x
m.part('box', WOODD, loc=G(0, 0.405, 0), size=(1.48, 0.3, 0.03))  # its sawn flat top
for sx in (-0.75, 0.75): m.part('cyl', WOODD, loc=G(sx, 0.3, 0), size=(0.19, 0.19, 0.012), seg=10, rot=(0, 90, 0))  # end grain
for sx in (-0.5, 0.5):
    m.part('box', WOODD, loc=G(sx, 0.1, 0), size=(0.1, 0.42, 0.2))  # chocks
objs.append(m.finish())
m = Model('isle_drum')
m.part('cyl', WOOD, loc=G(0, 0.42, 0), size=(0.16, 0.16, 0.3), seg=12, top=0.85)  # the body, waisted at the foot
m.part('cyl', WOODD, loc=G(0, 0.1, 0), size=(0.2, 0.2, 0.1), seg=12, top=0.7)  # the carved foot
m.part('cyl', CANVAS, loc=G(0, 0.73, 0), size=(0.17, 0.17, 0.015), seg=12)  # the skin head
for k in range(8):
    a = k / 8 * math.tau
    m.part('sweep', ROPE, points=[G(math.cos(a) * 0.17, 0.72, math.sin(a) * 0.17), G(math.cos(a + 0.4) * 0.15, 0.45, math.sin(a + 0.4) * 0.15), G(math.cos(a) * 0.16, 0.2, math.sin(a) * 0.16)], r=0.008, ring=3)  # lashings
m.part('torus', RED, loc=G(0, 0.62, 0), size=(0.165, 0.165, 0.165), tube=0.06, seg=14, ring=4)  # a painted band
objs.append(m.finish())

export(objs, OUT, spacing=6)
