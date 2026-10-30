# Open Waters v1.15.20: Coralhaven's furniture, the town under the sea. A shell fountain with a giant clam, shop
# counters with shell inlays, wave-ended benches, cafe tables and coral stools, beds, a scuba-tank rack, kelp planters,
# shelves of jars, a fish stall on ice, jellyfish lamps and the airlock hatch. Placed by src/ocean/coralhaven.js.
#   python3 art/src/coralhaven.py      -> art/coralhaven.blend + art/coralhaven.glb
#   node scripts/glb-to-js.mjs art/coralhaven.glb src/data/coralhavenMesh.js CORALHAVEN
# Game axes: x right, y up, z forward (G converts). Every piece stands on its origin, and faces +z (toward the viewer).
import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
from kit import Model, mat, reset, export, ellipse

OUT = os.path.join(os.path.dirname(__file__), '..', 'coralhaven')
G = lambda x, y, z: (x, -z, y)
reset()
STONE = mat('ch_stone', '#d8ccb4', 0.9)
STONED = mat('ch_stone_dark', '#9a8e7a', 0.9)
SHELL = mat('ch_shell', '#f2e6d4', 0.55)
SHELLP = mat('ch_shell_pink', '#f0b8a8', 0.55)
SHELLL = mat('ch_shell_lilac', '#c8a8d8', 0.55)
NACRE = mat('ch_nacre', '#e8f0f4', 0.25)
PEARL = mat('ch_pearl', '#f8f4ff', 0.2, emit='#a8a0c8')
CORALO = mat('ch_coral_orange', '#e8805a', 0.8)
CORALP = mat('ch_coral_pink', '#f2a0b4', 0.8)
CORALV = mat('ch_coral_violet', '#b088d0', 0.8)
WOOD = mat('ch_wood', '#9a7048', 0.85)
WOODD = mat('ch_wood_dark', '#5e4128', 0.85)
TEAK = mat('ch_teak', '#b8864e', 0.8)
BRASS = mat('ch_brass', '#c8a040', 0.35, 0.8)
IRON = mat('ch_iron', '#4a5258', 0.45, 0.7)
KELP = mat('ch_kelp', '#4a8a4a', 0.8)
KELPL = mat('ch_kelp_light', '#7ab05a', 0.8)
TEAL = mat('ch_teal', '#2f9aa0', 0.7)
MOSAIC = mat('ch_mosaic', '#5ab8c0', 0.6)
QUILT = mat('ch_quilt', '#d8705a', 0.95)
QUILTB = mat('ch_quilt_blue', '#5a8ab8', 0.95)
LINEN = mat('ch_linen', '#f2eee2', 0.95)
ICE = mat('ch_ice', '#dff4fa', 0.3)
YELLOW = mat('ch_tank_yellow', '#e8c030', 0.5, 0.3)
ORANGE = mat('ch_tank_orange', '#e8602a', 0.5, 0.3)
RUBBER = mat('ch_rubber', '#2a2e34', 0.8)
JELLY = mat('ch_jelly_glow', '#bff0ff', 0.3, emit='#5ad0f0')
JELLYP = mat('ch_jelly_pink', '#ffd0e8', 0.3, emit='#f080c0')
LAMP = mat('ch_lamp_glow', '#ffe2a0', 0.4, emit='#ffb040')
GLASSG = mat('ch_jar_green', '#9adfc8', 0.2)
GLASSB = mat('ch_jar_blue', '#6a9ad8', 0.2)
GLASSR = mat('ch_jar_red', '#d86a6a', 0.2)
objs = []

def scallop(m, mt, cx, cy, cz, r, ribs=9, rise=0.0, tilt=0.0, yaw=0.0):
    """A scallop shell: ribs fanning out from a hinge (game coords; opens toward +z, tilted up by tilt degrees)."""
    ca, sa, ct, st = math.cos(math.radians(yaw)), math.sin(math.radians(yaw)), math.cos(math.radians(tilt)), math.sin(math.radians(tilt))
    def P(x, y, z):  # local -> game: tilt about x, then yaw about y
        y2, z2 = y * ct - z * st, y * st + z * ct
        return G(cx + x * ca + z2 * sa, cy + y2, cz - x * sa + z2 * ca)
    for i in range(ribs):
        a = math.radians(-70 + 140 * i / (ribs - 1))
        pts = [P(0, 0, 0)] + [P(math.sin(a) * r * k, math.sin(k * math.pi) * r * 0.18 + rise * k, math.cos(a) * r * k) for k in (0.35, 0.7, 1.0)]
        m.part('sweep', mt, points=pts, r=[0.02 * r, 0.09 * r, 0.12 * r, 0.06 * r], ring=6, squash=0.45)

# ---- the Grand Hall's fountain: a stone basin with a scalloped rim, a coral-wrapped column, and a giant clam on top
#      holding a glowing pearl (the water in the basin is the game's own: it ripples)
m = Model('ch_fountain')
m.part('cyl', STONED, loc=G(0, 0.12, 0), size=(3.9, 3.9, 0.12), seg=32)
m.part('cyl', STONE, loc=G(0, 0.45, 0), size=(3.7, 3.7, 0.33), seg=32, top=0.97)
m.part('torus', STONE, loc=G(0, 0.8, 0), size=(3.55, 3.55, 3.55), tube=0.05, seg=32, ring=6)
for i in range(16):
    a = i / 16 * math.tau
    scallop(m, SHELL if i % 2 else SHELLP, math.sin(a) * 3.6, 0.55, math.cos(a) * 3.6, 0.45, ribs=7, tilt=-75, yaw=math.degrees(a))
m.part('cyl', STONE, loc=G(0, 1.2, 0), size=(0.7, 0.7, 0.6), seg=16, top=0.7)
m.part('cyl', STONED, loc=G(0, 2.4, 0), size=(0.42, 0.42, 1.2), seg=12, top=0.85)
for k, c in enumerate((CORALO, CORALP, CORALV)):  # coral climbing the column
    pts = [G(math.sin(t * 0.9 + k * 2.1) * 0.48, 1.0 + t * 0.32, math.cos(t * 0.9 + k * 2.1) * 0.48) for t in range(0, 9)]
    m.part('sweep', c, points=pts, r=[0.12, 0.1, 0.11, 0.09, 0.1, 0.08, 0.09, 0.07, 0.05], ring=6, amp=0.03, freq=4, seed=k)
    for t in (2, 5, 7):
        x, y, z = math.sin(t * 0.9 + k * 2.1) * 0.5, 1.0 + t * 0.32, math.cos(t * 0.9 + k * 2.1) * 0.5
        m.part('sweep', c, points=[G(x, y, z), G(x * 1.6, y + 0.25, z * 1.6), G(x * 1.9, y + 0.55, z * 1.9)], r=[0.06, 0.045, 0.02], ring=5)
# the clam: a lower valve like a bowl, the upper valve hinged open behind, with a fluted lip
m.part('rock', SHELLL, loc=G(0, 3.75, 0.1), size=(1.6, 1.25, 0.45), sub=3, amp=0.04, freq=3)
m.part('rock', NACRE, loc=G(0, 3.95, 0.1), size=(1.35, 1.05, 0.22), sub=2)
# the upper valve, hinged open at the back (the same shape as the lower one, swung up 70 degrees), with ridges on it
m.part('rock', SHELLL, loc=G(0, 5.0, -0.72), size=(1.6, 1.25, 0.4), rot=(110, 0, 0), sub=3, amp=0.05, freq=3)
m.part('rock', NACRE, loc=G(0, 4.95, -0.6), size=(1.35, 1.05, 0.2), rot=(110, 0, 0), sub=2)
for i in range(9):
    a = math.radians(-64 + 128 * i / 8)
    m.part('sweep', SHELLL, points=[G(0, 3.95, -1.15), G(math.sin(a) * 0.9, 4.55 + math.cos(a) * 0.55, -1.05), G(math.sin(a) * 1.5, 5.15 + math.cos(a) * 1.0, -0.62)], r=[0.05, 0.1, 0.06], ring=5, squash=0.6)
m.part('rock', PEARL, loc=G(0, 4.25, 0.15), size=(0.42, 0.42, 0.42), sub=3)
objs.append(m.finish())

# ---- a shop counter (5 m): rounded teak top, panelled front with shell inlays, brass foot rail and a bell
m = Model('ch_counter')
m.part('rbox', WOOD, loc=G(0, 0.52, 0), size=(2.45, 0.42, 0.5), r=0.06)
m.part('rbox', TEAK, loc=G(0, 1.07, 0.04), size=(2.6, 0.52, 0.05), r=0.04)
for i in range(5):
    x = -2.0 + i
    m.part('rbox', WOODD, loc=G(x, 0.55, 0.43), size=(0.4, 0.02, 0.34), r=0.02)
    scallop(m, SHELLP if i % 2 else SHELL, x, 0.38, 0.46, 0.28, ribs=7, tilt=-90)
m.part('cyl', BRASS, loc=G(0, 0.14, 0.62), size=(0.03, 0.03, 2.4), seg=6, rot=(0, 90, 0))
for x in (-2.2, 0, 2.2): m.part('cyl', BRASS, loc=G(x, 0.08, 0.55), size=(0.02, 0.02, 0.08), seg=5, rot=(90, 0, 0))
m.part('cyl', BRASS, loc=G(1.7, 1.16, 0.15), size=(0.09, 0.09, 0.04), seg=10, top=0.3)
m.part('rock', BRASS, loc=G(1.7, 1.22, 0.15), size=(0.025, 0.025, 0.025), sub=1)
objs.append(m.finish())

# ---- a bench whose ends curl like breaking waves
m = Model('ch_bench')
for s in (-1, 1):
    pts = [G(s * 1.15, 0.0, 0.2), G(s * 1.2, 0.35, 0.25), G(s * 1.15, 0.6, 0.05), G(s * 1.05, 0.9, -0.25), G(s * 1.2, 1.05, -0.05), G(s * 1.25, 0.95, 0.12)]
    m.part('sweep', TEAL, points=pts, r=[0.09, 0.08, 0.07, 0.07, 0.06, 0.03], ring=8, squash=0.55)
for i in range(4): m.part('rbox', TEAK, loc=G(0, 0.47, 0.25 - i * 0.14), size=(1.15, 0.055, 0.025), r=0.015)
for i in range(3): m.part('rbox', TEAK, loc=G(0, 0.62 + i * 0.13, -0.25 - i * 0.03), size=(1.12, 0.02, 0.05), r=0.015, rot=(-12, 0, 0))
objs.append(m.finish())

# ---- a cafe table with a mosaic top on a coral stem, and a sponge stool
m = Model('ch_table')
m.part('cyl', STONE, loc=G(0, 0.76, 0), size=(0.68, 0.68, 0.04), seg=20)
m.part('cyl', MOSAIC, loc=G(0, 0.8, 0), size=(0.55, 0.55, 0.01), seg=20)
for i in range(8):
    a = i / 8 * math.tau
    m.part('cyl', SHELL if i % 2 else CORALP, loc=G(math.sin(a) * 0.38, 0.815, math.cos(a) * 0.38), size=(0.07, 0.07, 0.006), seg=6)
m.part('sweep', CORALO, points=[G(0, 0, 0), G(0.05, 0.25, 0.02), G(-0.04, 0.5, -0.03), G(0, 0.74, 0)], r=[0.2, 0.08, 0.07, 0.12], ring=7, amp=0.02, freq=5)
m.part('sweep', CORALO, points=[G(0.02, 0.3, 0), G(0.25, 0.45, 0.05), G(0.32, 0.62, 0.08)], r=[0.05, 0.035, 0.015], ring=5)
objs.append(m.finish())
m = Model('ch_stool')
m.part('rock', CORALV, loc=G(0, 0.42, 0), size=(0.3, 0.3, 0.12), sub=2, amp=0.03, freq=6)
m.part('cyl', CORALV, loc=G(0, 0.2, 0), size=(0.11, 0.11, 0.2), seg=8, top=1.4, amp=0.02, freq=6)
objs.append(m.finish())

# ---- a bed: a dark wood frame, a headboard with a porthole, a patchwork quilt and pillows
m = Model('ch_bed')
m.part('rbox', WOODD, loc=G(0, 0.22, 0), size=(0.7, 1.15, 0.12), r=0.04)
m.part('rbox', LINEN, loc=G(0, 0.42, 0), size=(0.65, 1.08, 0.1), r=0.06)
for i in range(4):
    for j in range(3): m.part('rbox', QUILT if (i + j) % 2 else QUILTB, loc=G(-0.43 + j * 0.43, 0.53, 0.65 - i * 0.36), size=(0.2, 0.17, 0.02), r=0.015)
m.part('rbox', LINEN, loc=G(0, 0.58, -0.85), size=(0.45, 0.18, 0.08), r=0.06)
m.part('rbox', WOODD, loc=G(0, 0.75, -1.15), size=(0.72, 0.06, 0.6), r=0.05)
m.part('torus', BRASS, loc=G(0, 1.0, -1.08), size=(0.22, 0.22, 0.22), tube=0.18, seg=16, ring=5, rot=(90, 0, 0))
m.part('cyl', TEAL, loc=G(0, 1.0, -1.09), size=(0.2, 0.2, 0.01), seg=16, rot=(90, 0, 0))
for x in (-0.68, 0.68): m.part('cyl', WOODD, loc=G(x, 0.2, 1.1), size=(0.05, 0.05, 0.2), seg=6)
objs.append(m.finish())

# ---- a scuba rack: a frame, three tanks (yellow and orange) with valves, and two sets of fins
m = Model('ch_tankrack')
for x in (-0.9, 0.9): m.part('rbox', WOODD, loc=G(x, 0.8, 0), size=(0.05, 0.25, 0.8), r=0.015)
for y in (0.45, 1.25): m.part('rbox', WOODD, loc=G(0, y, -0.12), size=(0.95, 0.05, 0.03), r=0.01)
for i, c in enumerate((YELLOW, ORANGE, YELLOW)):
    x = -0.55 + i * 0.55
    m.part('cyl', c, loc=G(x, 0.75, 0), size=(0.17, 0.17, 0.6), seg=14)
    m.part('rock', c, loc=G(x, 1.35, 0), size=(0.17, 0.17, 0.12), sub=2)
    m.part('cyl', IRON, loc=G(x, 1.5, 0), size=(0.04, 0.04, 0.06), seg=6)
    m.part('cyl', IRON, loc=G(x + 0.05, 1.52, 0), size=(0.03, 0.03, 0.06), seg=6, rot=(0, 90, 0))
    m.part('torus', RUBBER, loc=G(x, 0.95, 0), size=(0.18, 0.18, 0.18), tube=0.15, seg=14, ring=4)
for s in (-1, 1): m.part('poly', RUBBER, points=[(-0.08, 0), (0.08, 0), (0.14, 0.55), (-0.14, 0.55)], depth=0.02, loc=G(s * 0.65 + 0.9, 0.05, 0.3), rot=(80, 0, s * 8))
objs.append(m.finish())

# ---- a stone planter of kelp
m = Model('ch_planter')
m.part('cyl', STONED, loc=G(0, 0.35, 0), size=(0.6, 0.6, 0.35), seg=12, top=1.15)
m.part('torus', STONE, loc=G(0, 0.7, 0), size=(0.68, 0.68, 0.68), tube=0.08, seg=14, ring=5)
for i in range(7):
    a, r = i * 2.4, 0.15 + (i % 3) * 0.12
    x, z, hgt = math.sin(a) * r, math.cos(a) * r, 2.2 + (i % 4) * 0.45
    pts = [G(x, 0.6 + k * hgt / 6, z + math.sin(k * 1.3 + i) * 0.15) for k in range(7)]
    m.part('sweep', KELP if i % 2 else KELPL, points=pts, r=[0.07, 0.09, 0.09, 0.08, 0.07, 0.05, 0.02], ring=5, squash=0.25)
objs.append(m.finish())

# ---- shelves of jars (sea glass sorted by colour) and shells
m = Model('ch_shelf')
for x in (-1.5, 1.5): m.part('rbox', WOODD, loc=G(x, 1.15, 0), size=(0.05, 0.22, 1.15), r=0.015)
for k in range(4): m.part('rbox', WOOD, loc=G(0, 0.2 + k * 0.7, 0), size=(1.5, 0.22, 0.025), r=0.01)
for k in range(3):
    for i in range(6):
        c = (GLASSG, GLASSB, GLASSR)[(i + k) % 3]
        m.part('cyl', c, loc=G(-1.2 + i * 0.48, 0.38 + k * 0.7, 0), size=(0.11, 0.11, 0.16), seg=10)
        m.part('cyl', WOOD, loc=G(-1.2 + i * 0.48, 0.56 + k * 0.7, 0), size=(0.07, 0.07, 0.025), seg=8)
scallop(m, SHELLP, -0.6, 2.32, 0.05, 0.22, ribs=7, tilt=-60)
scallop(m, SHELL, 0.4, 2.32, 0.05, 0.25, ribs=7, tilt=-60)
objs.append(m.finish())

# ---- a fish stall: a crate table with a bed of ice (the game lays real fish on it)
m = Model('ch_icetable')
m.part('rbox', WOODD, loc=G(0, 0.42, 0), size=(1.2, 0.55, 0.42), r=0.03)
for i in range(3): m.part('box', WOOD, loc=G(0, 0.2 + i * 0.25, 0.56), size=(1.18, 0.01, 0.06))
m.part('rbox', ICE, loc=G(0, 0.9, 0), size=(1.12, 0.48, 0.06), r=0.04)
for i in range(14):
    m.part('rock', ICE, loc=G(-1.0 + (i % 7) * 0.33, 0.97, -0.25 + (i // 7) * 0.5), size=(0.11, 0.1, 0.06), sub=1, amp=0.02, freq=8, seed=i)
m.part('rbox', TEAL, loc=G(0, 1.25, 0.56), size=(0.4, 0.02, 0.12), r=0.02)
objs.append(m.finish())

# ---- a jellyfish lamp: a glowing bell with frilled skirt and trailing tendrils (hangs from its top, origin at the top)
for name, glow in (('ch_jellylamp', JELLY), ('ch_jellylamp_pink', JELLYP)):
    m = Model(name)
    m.part('cyl', BRASS, loc=G(0, -0.35, 0), size=(0.012, 0.012, 0.35), seg=4)
    m.part('rock', glow, loc=G(0, -0.95, 0), size=(0.42, 0.42, 0.3), sub=3)
    m.part('torus', glow, loc=G(0, -1.12, 0), size=(0.38, 0.38, 0.38), tube=0.1, seg=16, ring=4, amp=0.03, freq=6)
    for i in range(8):
        a = i / 8 * math.tau
        pts = [G(math.sin(a) * 0.25, -1.15 - k * 0.22, math.cos(a) * 0.25 + math.sin(k + i) * 0.05) for k in range(6)]
        m.part('sweep', glow, points=pts, r=[0.03, 0.025, 0.02, 0.015, 0.01, 0.005], ring=4)
    objs.append(m.finish())

# ---- the airlock hatch: a heavy round door in a bolted frame, a locking wheel, warning stripes round the rim
m = Model('ch_hatch')
# v1.15.23: a clean round hatch: iron ring and door, brass rivets, and one ship's wheel dead centre (no hazard blocks)
m.part('torus', IRON, loc=G(0, 1.6, 0), size=(1.45, 1.45, 1.45), tube=0.16, seg=32, ring=8, rot=(90, 0, 0))
m.part('cyl', IRON, loc=G(0, 1.6, -0.05), size=(1.28, 1.28, 0.08), seg=32, rot=(90, 0, 0))
m.part('torus', BRASS, loc=G(0, 1.6, 0.04), size=(1.0, 1.0, 1.0), tube=0.035, seg=32, ring=5, rot=(90, 0, 0))
for i in range(12):
    a = i / 12 * math.tau
    m.part('rock', BRASS, loc=G(math.sin(a) * 1.45, 1.6 + math.cos(a) * 1.45, 0.2), size=(0.06, 0.06, 0.06), sub=1)
# the wheel: rim, six spokes from a hub, a handle poking out past the rim at each spoke
m.part('torus', BRASS, loc=G(0, 1.6, 0.3), size=(0.52, 0.52, 0.52), tube=0.06, seg=28, ring=8, rot=(90, 0, 0))
m.part('cyl', BRASS, loc=G(0, 1.6, 0.3), size=(0.12, 0.12, 0.1), seg=14, rot=(90, 0, 0))
m.part('cyl', BRASS, loc=G(0, 1.6, 0.14), size=(0.06, 0.06, 0.16), seg=8, rot=(90, 0, 0))
for i in range(6):
    a = i / 6 * math.tau
    m.part('cyl', BRASS, loc=G(math.sin(a) * 0.26, 1.6 + math.cos(a) * 0.26, 0.3), size=(0.028, 0.028, 0.26), seg=6, rot=(0, math.degrees(a), 0))
    m.part('cyl', BRASS, loc=G(math.sin(a) * 0.66, 1.6 + math.cos(a) * 0.66, 0.3), size=(0.04, 0.04, 0.1), seg=6, rot=(0, math.degrees(a), 0))
m.part('rock', LAMP, loc=G(0, 3.4, 0.15), size=(0.18, 0.18, 0.18), sub=2)
objs.append(m.finish())

export(objs, OUT, spacing=5)
