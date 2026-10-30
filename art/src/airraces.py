# Skye's Air Races (frostmere branch): the race planes and the circuits' set pieces.
#   python3 art/src/airraces.py      -> art/airraces.blend + art/airraces.glb
#   node scripts/glb-to-js.mjs art/airraces.glb src/data/airracesMesh.js AIRRACES
# Game axes: x right (starboard), y up, z forward (a plane's nose). Sizes passed to the kit are half extents in
# Blender order (game x, game z, game y). Every set piece stands on its origin; planes sit on their wheels/floats.
# Moving parts are separate nodes modelled about their own pivot at the origin:
#   pl_*_prop          spins about z          ar_turbine_rotor   spins about z (the hub at the origin)
#   ar_crane_jib       turns about y          ar_drawbridge_leaf hinged along x at the origin, the deck along +z
#   ar_millwheel_wheel spins about x          ar_blimp           drifts as a whole
# Planes: the paint is the material named '<plane>_paint' and the trim '<plane>_trim' (the game recolours them).
import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
import bpy
from kit import Model, mat, reset, export

OUT = os.path.join(os.path.dirname(__file__), '..', 'airraces')
G = lambda x, y, z: (x, -z, y)
T = math.tau
reset()
objs = []

# ------------------------------------------------------------------ materials
WHITE = mat('ar_white', '#f2f0ea', 0.5)
OFFW = mat('ar_offwhite', '#dcd6c8', 0.7)
RED = mat('ar_red', '#c8342c', 0.5)
ORANGE = mat('ar_orange', '#f07020', 0.5)
YELLOW = mat('ar_yellow', '#f2c21a', 0.5)
BLUE = mat('ar_blue', '#2a5ea8', 0.5)
NAVY = mat('ar_navy', '#1e2c48', 0.55)
GREEN = mat('ar_green', '#2f7a44', 0.6)
BLACK = mat('ar_black', '#1c1e22', 0.6)
DARK = mat('ar_dark', '#34383e', 0.6)
STEEL = mat('ar_steel', '#9aa2ac', 0.35, 0.8)
ALU = mat('ar_alu', '#c4c9cf', 0.3, 0.85)
GLASS = mat('ar_glass', '#2a3c4c', 0.08)
STONE = mat('ar_stone', '#9a9488', 0.95)
STONED = mat('ar_stone_dark', '#726c62', 0.95)
CONC = mat('ar_concrete', '#b4b2aa', 0.9)
WOOD = mat('ar_wood', '#8a5e38', 0.9)
WOODD = mat('ar_wood_dark', '#5c3c22', 0.9)
ROOF = mat('ar_roof', '#7a3a2c', 0.8)
RUST = mat('ar_rust', '#9a5232', 0.8)
ROCKR = mat('ar_rock_red', '#b05a36', 0.95)
ROCKR2 = mat('ar_rock_red_dark', '#8a3e26', 0.95)
ROCKT = mat('ar_rock_tan', '#d09a62', 0.95)
ROCKG = mat('ar_rock_grey', '#7c7a74', 0.95)
GRASS = mat('ar_grass', '#5a9a44', 0.95)
SAND = mat('ar_sand', '#e2cf98', 0.95)
LAMP = mat('ar_lamp', '#ffe2a0', 0.4, emit='#ffc860')
REDLIGHT = mat('ar_redlight', '#ff3a2a', 0.4, emit='#ff2010')
CANVAS1 = mat('ar_canvas_a', '#e84a3a', 0.8)
CANVAS2 = mat('ar_canvas_b', '#f2c21a', 0.8)
CANVAS3 = mat('ar_canvas_c', '#3a8ad0', 0.8)
CHECKW = WHITE; CHECKB = BLACK

def ring(md, m, y, r, tube=0.1, seg=24, z=0.0, rot=(0, 0, 0)):
    md.part('torus', m, loc=G(0, y, z), size=(r, r, r), seg=seg, ring=6, tube=tube / max(r, 1e-3), rot=rot)

# ================================================================== the planes
def wing(md, m, y, z, span, chord, th=0.06, dihedral=2.0, tipm=None):
    for s in (-1, 1):
        md.part('rbox', m, loc=G(s * span / 2, y + span / 2 * math.tan(math.radians(dihedral)) * 0.5, z), size=(span / 2, chord / 2, th), r=th * 0.9, rot=(0, s * dihedral, 0))
        if tipm: md.part('rbox', tipm, loc=G(s * (span - 0.15), y + span * math.tan(math.radians(dihedral)) * 0.5, z), size=(0.15, chord / 2 + 0.01, th + 0.01), r=th * 0.9)

def gear(md, y_axle, z, track, r=0.22):
    for s in (-1, 1):
        md.part('cyl', BLACK, loc=G(s * track, r, z), size=(r, r, 0.07), seg=14, rot=(0, 90, 0))
        md.part('cyl', ALU, loc=G(s * track, r, z), size=(r * 0.45, r * 0.45, 0.08), seg=10, rot=(0, 90, 0))
        md.part('sweep', DARK, points=[G(s * track, r, z), G(s * track * 0.4, y_axle, z)], r=0.035, ring=6)

# --- the Cub: a little yellow high-wing taildragger (nimble)
P = mat('pl_cub_paint', '#f2c21a', 0.45); TR = mat('pl_cub_trim', '#1c1e22', 0.5)
md = Model('pl_cub')
md.part('sweep', P, points=[G(0, 1.15, 2.2), G(0, 1.25, 1.4), G(0, 1.3, 0.2), G(0, 1.25, -1.4), G(0, 1.3, -3.2)], r=[0.42, 0.52, 0.55, 0.42, 0.14], ring=12, squash=1.15)
md.part('rbox', GLASS, loc=G(0, 1.75, 0.65), size=(0.42, 0.7, 0.3), r=0.12)
md.part('cyl', TR, loc=G(0, 1.15, 2.25), size=(0.36, 0.36, 0.1), seg=16, rot=(90, 0, 0))  # cowl ring
md.part('sweep', TR, points=[G(-0.55, 1.2, 1.1), G(0.55, 1.2, 1.1)], r=0.03, ring=5)  # lightning stripe stand-in
for s in (-1, 1): md.part('sweep', TR, points=[G(0, 1.18, 2.0), G(s * 0.5, 1.1, -2.9)], r=0.03, ring=5)  # the side stripes
wing(md, P, 2.12, 0.5, 10.6, 1.6, th=0.07, dihedral=1.0, tipm=TR)
for s in (-1, 1): md.part('sweep', ALU, points=[G(s * 0.45, 1.0, 0.4), G(s * 2.6, 2.05, 0.5)], r=0.035, ring=5)  # struts
md.part('rbox', P, loc=G(0, 1.32, -3.25), size=(1.6, 0.55, 0.04), r=0.03)  # tailplane
md.part('poly', P, loc=G(0, 1.3, -3.25), points=[(0, 0), (0.0, 1.05), (-0.45, 1.0), (-0.8, 0.0)], depth=0.06, rot=(0, 0, 0))
gear(md, 0.95, 1.1, 0.85, r=0.26)
md.part('cyl', BLACK, loc=G(0, 0.12, -3.0), size=(0.1, 0.1, 0.04), seg=10, rot=(0, 90, 0))
objs.append(md.finish())
md = Model('pl_cub_prop')
md.part('cyl', TR, loc=G(0, 0, 0.12), size=(0.16, 0.16, 0.14), seg=14, top=0.2, rot=(90, 0, 0))
for a in (0, 180): md.part('rbox', DARK, loc=G(0.42 * math.cos(math.radians(a)), 0.42 * math.sin(math.radians(a)), 0), size=(0.42, 0.04, 0.07), r=0.03, rot=(0, 0, a + 8))
objs.append(md.finish())

# --- the Biplane: a red stunt biplane on floats (tricks)
P = mat('pl_biplane_paint', '#c8342c', 0.45); TR = mat('pl_biplane_trim', '#f2f0ea', 0.5)
md = Model('pl_biplane')
md.part('sweep', P, points=[G(0, 1.75, 2.4), G(0, 1.85, 1.6), G(0, 1.9, 0.0), G(0, 1.8, -1.8), G(0, 1.9, -3.4)], r=[0.5, 0.58, 0.55, 0.4, 0.12], ring=12)
md.part('cyl', DARK, loc=G(0, 1.75, 2.45), size=(0.48, 0.48, 0.12), seg=18, rot=(90, 0, 0))
for k in range(7): a = k / 7 * T; md.part('cyl', ALU, loc=G(math.cos(a) * 0.42, 1.75 + math.sin(a) * 0.42, 2.3), size=(0.08, 0.08, 0.1), seg=8, rot=(90, 0, 0))  # radial engine cylinders
md.part('rbox', DARK, loc=G(0, 2.3, -0.2), size=(0.32, 0.4, 0.12), r=0.08)  # the open cockpit
md.part('rbox', GLASS, loc=G(0, 2.45, 0.25), size=(0.3, 0.04, 0.12), r=0.03, rot=(-20, 0, 0))
wing(md, P, 3.05, 0.7, 8.6, 1.45, th=0.07, dihedral=0.5, tipm=TR)
wing(md, TR, 1.55, 0.45, 8.0, 1.35, th=0.07, dihedral=3.0)
for s in (-1, 1):
    for z_ in (0.15, 1.15): md.part('sweep', WOODD, points=[G(s * 2.9, 1.65, z_), G(s * 2.9, 3.0, z_ + 0.1)], r=0.04, ring=5)  # interplane struts
    md.part('sweep', STEEL, points=[G(s * 0.4, 1.65, 0.5), G(s * 2.9, 3.0, 0.6)], r=0.015, ring=4)  # wires
md.part('rbox', P, loc=G(0, 1.95, -3.45), size=(1.4, 0.5, 0.04), r=0.03)
md.part('poly', TR, loc=G(0, 1.95, -3.45), points=[(0, 0), (0.0, 1.0), (-0.5, 0.95), (-0.75, 0.0)], depth=0.06)
for s in (-1, 1):  # the floats
    md.part('sweep', WHITE, points=[G(s * 1.05, 0.28, 2.3), G(s * 1.05, 0.25, 1.4), G(s * 1.05, 0.25, -0.8), G(s * 1.05, 0.33, -2.0)], r=[0.12, 0.27, 0.27, 0.08], ring=10)
    for z_ in (1.0, -0.4): md.part('sweep', STEEL, points=[G(s * 1.05, 0.45, z_), G(s * 0.35, 1.5, z_)], r=0.03, ring=5)
objs.append(md.finish())
md = Model('pl_biplane_prop')
md.part('cyl', TR, loc=G(0, 0, 0.12), size=(0.17, 0.17, 0.16), seg=14, top=0.15, rot=(90, 0, 0))
for a in (0, 180): md.part('rbox', WOODD, loc=G(0.55 * math.cos(math.radians(a)), 0.55 * math.sin(math.radians(a)), 0), size=(0.55, 0.05, 0.08), r=0.03, rot=(0, 0, a + 10))
objs.append(md.finish())

# --- the Racer: a sleek low-wing air racer (fast, wide turns)
P = mat('pl_racer_paint', '#2a5ea8', 0.3); TR = mat('pl_racer_trim', '#f2f0ea', 0.35)
md = Model('pl_racer')
md.part('sweep', P, points=[G(0, 1.1, 2.9), G(0, 1.15, 2.1), G(0, 1.2, 0.6), G(0, 1.25, -1.2), G(0, 1.35, -3.6)], r=[0.3, 0.5, 0.55, 0.42, 0.1], ring=14, squash=1.1)
md.part('sweep', GLASS, points=[G(0, 1.55, 0.6), G(0, 1.72, 0.0), G(0, 1.62, -0.9)], r=[0.12, 0.3, 0.12], ring=12)  # bubble canopy
md.part('sweep', TR, points=[G(0, 1.3, 2.6), G(0, 1.55, -0.4), G(0, 1.6, -3.4)], r=0.05, ring=6)  # the spine stripe
for s in (-1, 1):
    md.part('rbox', P, loc=G(s * 2.0, 0.85, 0.2), size=(2.0, 0.85, 0.06), r=0.05, rot=(0, s * 6, 0))
    md.part('rbox', TR, loc=G(s * 3.9, 1.05, 0.15), size=(0.12, 0.7, 0.065), r=0.05)
    md.part('rbox', P, loc=G(s * 0.9, 1.45, -3.4), size=(0.9, 0.35, 0.04), r=0.03)
    md.part('cyl', BLACK, loc=G(s * 1.1, 0.25, 0.6), size=(0.22, 0.22, 0.06), seg=14, rot=(0, 90, 0))
    md.part('rbox', P, loc=G(s * 1.1, 0.55, 0.6), size=(0.05, 0.25, 0.3), r=0.03)  # wheel spats
md.part('poly', P, loc=G(0, 1.45, -3.35), points=[(0, 0), (0.0, 0.95), (-0.5, 0.9), (-0.9, 0.0)], depth=0.06)
md.part('cyl', TR, loc=G(0, 1.1, 2.95), size=(0.24, 0.24, 0.12), seg=16, top=0.1, rot=(90, 0, 0))
for s in (-1, 1): md.part('cyl', DARK, loc=G(s * 0.35, 1.0, 2.0), size=(0.05, 0.05, 0.12), seg=8, rot=(90, 0, 0))  # exhaust stacks
objs.append(md.finish())
md = Model('pl_racer_prop')
for a in (0, 120, 240): md.part('rbox', DARK, loc=G(0.5 * math.cos(math.radians(a)), 0.5 * math.sin(math.radians(a)), 0), size=(0.5, 0.045, 0.07), r=0.03, rot=(0, 0, a + 10))
objs.append(md.finish())

# ================================================================== start/finish and racing markers
md = Model('ar_start_arch')  # 44 m wide, 26 m tall: two chequered towers, a banner beam with lights, flags
for s in (-1, 1):
    for k in range(10):
        for c in range(2):
            md.part('box', CHECKW if (k + c) % 2 else CHECKB, loc=G(s * 22 + (c - 0.5) * 1.2, 1.2 + k * 2.4, 0), size=(0.6, 1.2, 1.2))
    md.part('cyl', STEEL, loc=G(s * 22, 25.0, 0), size=(0.12, 0.12, 2.0), seg=6)
    md.part('poly', RED, loc=G(s * 22 + 0.1, 26.2, 0), points=[(0, 0), (2.4, 0.6), (0, 1.2)], depth=0.05)
md.part('rbox', NAVY, loc=G(0, 23.4, 0), size=(21.4, 0.9, 2.0), r=0.2)
for k in range(12): md.part('rock', LAMP if k % 2 else REDLIGHT, loc=G(-19 + k * 3.45, 21.5, 0.95), size=(0.35, 0.35, 0.35), sub=1)
objs.append(md.finish())
md = Model('ar_pylon')  # an air-race pylon: a tall striped inflatable cone, 18 m
for k in range(6):
    md.part('cyl', RED if k % 2 else WHITE, loc=G(0, 1.5 + k * 3.0, 0), size=(2.3 - k * 0.32, 2.3 - k * 0.32, 1.5), seg=20, top=(2.3 - (k + 1) * 0.32) / (2.3 - k * 0.32))
md.part('rock', REDLIGHT, loc=G(0, 18.2, 0), size=(0.35, 0.35, 0.35), sub=1)
objs.append(md.finish())
md = Model('ar_grandstand')  # a grandstand of seats with a striped awning and a crowd of coloured dots (30 m)
for k in range(6): md.part('box', CONC, loc=G(0, 0.5 + k * 1.0, -k * 1.4), size=(15, 0.7, 0.5))
# (v1.17.1: the crowd is the game's own animated spectators now; the stand has a back wall, aisles, rails and bunting)
md.part('box', CONC, loc=G(0, 3.6, -8.1), size=(15.2, 0.3, 3.6))  # the back wall
for s in (-1, 1): md.part('poly', CONC, loc=G(s * 15.1, 0, 0), points=[(-0.7, 0), (-0.7, 1.4), (7.7, 7.2), (7.7, 0)], depth=0.3, rot=(0, 0, 90))  # the side walls
for x in (-7.5, 0, 7.5):  # aisle steps
    for k in range(6): md.part('box', STONED, loc=G(x, 0.55 + k * 1.0, -k * 1.4 + 0.45), size=(0.45, 0.25, 0.52))
for x in [-15 + i * 1.5 for i in range(21)]: md.part('cyl', STEEL, loc=G(x, 1.55, 0.62), size=(0.035, 0.035, 0.55), seg=5)  # the front rail
md.part('sweep', STEEL, points=[G(-15, 2.1, 0.62), G(15, 2.1, 0.62)], r=0.05, ring=6)
for i in range(16): md.part('poly', [RED, YELLOW, BLUE, GREEN][i % 4], loc=G(-14.5 + i * 1.93, 6.35, -0.6), points=[(-0.55, 0), (0.55, 0), (0, -0.85)], depth=0.03)  # bunting
md.part('sweep', DARK, points=[G(-15, 6.4, -0.6), G(15, 6.4, -0.6)], r=0.03, ring=4)
for x in (-9, 9): md.part('box', NAVY, loc=G(x, 0.62, 0.72), size=(4.2, 0.03, 0.5))  # banners on the front wall
for i in range(8): md.part('box', RED if i % 2 else WHITE, loc=G(-13.1 + i * 3.75, 8.5, -3.6), size=(1.875, 4.4, 0.06), rot=(-14, 0, 0))
for s in (-1, 1): md.part('cyl', STEEL, loc=G(s * 14.8, 4.3, -0.6), size=(0.12, 0.12, 4.3), seg=6)
objs.append(md.finish())

# ================================================================== land set pieces
md = Model('ar_bridge_stone')  # a three-arch stone viaduct, 120 m long, arches 30 m wide and 26 m tall (fly under)
L, HT = 120, 34
for x0 in (-60, -20, 20, 60):  # the piers
    md.part('rbox', STONE, loc=G(x0, HT / 2 - 2, 0), size=(5, 4.5, HT / 2 + 2), r=0.6)
    md.part('rbox', STONED, loc=G(x0, 1.5, 0), size=(6, 5.5, 3.0), r=0.6)
for x0 in (-40, 0, 40):  # the arches, springing from the piers and rising to just under the deck
    pts = [G(x0 + 15 * math.cos(a), 18 + 11 * math.sin(a), 0) for a in [k / 16 * math.pi for k in range(17)]]
    md.part('sweep', STONED, points=pts, r=[3.2, 2.6, 2.2, 2.0, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 2.0, 2.2, 2.6, 3.2], ring=8, squash=2.2)
    for s_ in (-1, 1): md.part('box', STONE, loc=G(x0 + s_ * 12.5, 26, 0), size=(3.5, 3.6, 5))  # the spandrels
md.part('rbox', STONE, loc=G(0, HT, 0), size=(L / 2 + 6, 4.6, 2.2), r=0.4)
for k in range(30): md.part('box', STONED, loc=G(-63 + k * 4.35, HT + 2.8, s * 4.2 if False else 4.2), size=(0.5, 0.3, 0.6))
for k in range(30): md.part('box', STONED, loc=G(-63 + k * 4.35, HT + 2.8, -4.2), size=(0.5, 0.3, 0.6))
objs.append(md.finish())
md = Model('ar_rock_arch')  # a great natural rock arch, 70 m span, 50 m tall (fly through)
pts = [G(40 * math.cos(a), 46 * math.sin(a), 0) for a in [k / 20 * math.pi for k in range(21)]]
md.part('sweep', ROCKR, points=pts, r=[12, 10, 9, 8.5, 8, 8, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 8, 8, 8.5, 9, 10, 11, 12], ring=12, squash=1.4, amp=0.8, freq=0.15, seed=3)
for s in (-1, 1): md.part('rock', ROCKR2, loc=G(s * 40, 5, 0), size=(15, 14, 8), sub=3, amp=1.0, freq=0.2, seed=s + 5)
objs.append(md.finish())
md = Model('ar_mesa')  # a layered red mesa, 80 m across and 60 m tall
for k, (r_, m_) in enumerate(((40, ROCKR2), (37, ROCKR), (35, ROCKT), (33, ROCKR), (30, ROCKR2))):
    md.part('cyl', m_, loc=G(0, 6 + k * 12, 0), size=(r_, r_ * 0.85, 6), seg=18, amp=0.9, freq=0.1, seed=k, top=0.96)
md.part('cyl', ROCKT, loc=G(0, 61, 0), size=(29, 25, 1.2), seg=14, amp=1.2, freq=0.15, seed=9)
objs.append(md.finish())
md = Model('ar_hoodoo')  # a hoodoo: a tall rock column with a cap stone, 30 m
for k in range(6): md.part('rock', ROCKT if k % 2 else ROCKR, loc=G(0, 2.5 + k * 4.4, 0), size=(4.2 - k * 0.3, 4.2 - k * 0.3, 2.6), sub=2, amp=0.5, freq=0.5, seed=k)
md.part('rock', ROCKR2, loc=G(0.4, 29, 0), size=(5.5, 5.0, 2.2), sub=2, amp=0.5, freq=0.4, seed=11)
objs.append(md.finish())
md = Model('ar_seastack')  # a sea stack: a tall rock pillar in the sea with a grassy top and birds' ledges, 45 m
for k in range(7): md.part('rock', ROCKG, loc=G(0, 3 + k * 6.2, 0), size=(9 - k * 0.6, 8.5 - k * 0.5, 4.2), sub=2, amp=1.0, freq=0.25, seed=k + 20)
md.part('rock', GRASS, loc=G(0, 44.5, 0), size=(5.5, 5.0, 1.2), sub=2, amp=0.4, freq=0.4, seed=40)
objs.append(md.finish())
md = Model('ar_turbine')  # a wind turbine tower and nacelle, 60 m (the rotor is ar_turbine_rotor, hub at y 62)
md.part('cyl', WHITE, loc=G(0, 30, 0), size=(1.6, 1.6, 30), seg=16, top=0.55)
md.part('rbox', WHITE, loc=G(0, 62, -1.2), size=(1.5, 3.8, 1.6), r=0.6)
md.part('rock', REDLIGHT, loc=G(0, 63.9, -3.0), size=(0.3, 0.3, 0.3), sub=1)
md.part('cyl', CONC, loc=G(0, 0.4, 0), size=(3.5, 3.5, 0.4), seg=16)
objs.append(md.finish())
md = Model('ar_turbine_rotor')  # three 28 m blades round a hub (spins about z)
md.part('rock', WHITE, loc=G(0, 0, 0.9), size=(1.3, 1.6, 1.3), sub=2)
for k in range(3):
    a = k / 3 * T
    md.part('sweep', WHITE, points=[(math.cos(a) * 1.2, 0, math.sin(a) * 1.2), (math.cos(a) * 10, 0, math.sin(a) * 10), (math.cos(a) * 28, 0, math.sin(a) * 28)], r=[0.9, 0.7, 0.15], ring=6, squash=0.35)
objs.append(md.finish())
md = Model('ar_crane')  # a tower crane mast, 55 m (the jib is ar_crane_jib, turning at y 55)
for k in range(11):
    y = k * 5
    for s1 in (-1, 1):
        for s2 in (-1, 1): md.part('box', YELLOW, loc=G(s1 * 1.1, y + 2.5, s2 * 1.1), size=(0.15, 0.15, 2.5))
    md.part('sweep', YELLOW, points=[G(-1.1, y, -1.1), G(1.1, y + 5, -1.1)], r=0.08, ring=4)
    md.part('sweep', YELLOW, points=[G(1.1, y, 1.1), G(-1.1, y + 5, 1.1)], r=0.08, ring=4)
md.part('box', CONC, loc=G(0, 0.8, 0), size=(3.5, 3.5, 0.8))
objs.append(md.finish())
md = Model('ar_crane_jib')  # the jib (60 m out along +z), the counter-jib, the cab, a hook block on a cable
md.part('box', YELLOW, loc=G(0, 1.0, 22), size=(0.9, 30, 0.9))
md.part('box', YELLOW, loc=G(0, 1.0, -9), size=(0.9, 9, 0.9))
md.part('box', CONC, loc=G(0, 0.0, -15), size=(1.8, 2.5, 1.6))
md.part('rbox', BLUE, loc=G(1.6, -1.0, 1.0), size=(1.1, 1.2, 1.2), r=0.2)
md.part('box', YELLOW, loc=G(0, 5.0, 0), size=(0.6, 0.6, 4.0))
md.part('sweep', STEEL, points=[G(0, 9, 0), G(0, 1.6, 50)], r=0.06, ring=4); md.part('sweep', STEEL, points=[G(0, 9, 0), G(0, 1.6, -16)], r=0.06, ring=4)
md.part('sweep', STEEL, points=[G(0, 0.5, 38), G(0, -20, 38)], r=0.05, ring=4)
md.part('rbox', RED, loc=G(0, -21.5, 38), size=(1.2, 1.2, 1.4), r=0.2)
objs.append(md.finish())
md = Model('ar_drawbridge')  # the towers and the fixed spans of a bascule bridge, 90 m (the lifting leaves are separate)
for s in (-1, 1):
    md.part('rbox', STONE, loc=G(s * 18, 16, 0), size=(5, 7, 16), r=0.5)
    md.part('cyl', ROOF, loc=G(s * 18, 34, 0), size=(5.6, 5.6, 2.5), seg=4, top=0.05, rot=(0, 0, 45))
    md.part('box', DARK, loc=G(s * 32, 12.0, 0), size=(9, 5.5, 1.0))
    for k in range(4): md.part('box', STONED, loc=G(s * (24 + k * 6), 5.5, 0), size=(1.0, 4.5, 6.0))
for k in range(6): md.part('rock', LAMP, loc=G(-17 + (k // 3) * 34 + (k % 3 - 1) * 2.5, 22, 7.2), size=(0.6, 0.6, 0.9), sub=1)
objs.append(md.finish())
md = Model('ar_drawbridge_leaf')  # one lifting leaf: hinged along x at the origin, the deck running 13 m along +z
md.part('box', DARK, loc=G(0, 0, 6.5), size=(5.5, 6.5, 0.7))
for s in (-1, 1): md.part('box', RED, loc=G(s * 5.4, 1.0, 6.5), size=(0.15, 6.5, 0.6))
objs.append(md.finish())
md = Model('ar_blimp')  # a cargo blimp, 60 m long, with fins, a gondola and a banner
md.part('sweep', OFFW, points=[G(0, 0, 30), G(0, 0, 22), G(0, 0, 0), G(0, 0, -20), G(0, 0, -30)], r=[0.5, 9, 11, 8, 0.5], ring=18)
for a in (0, 90, 180, 270):
    md.part('poly', RED, loc=G(0, 0, -24), rot=(0, 0, a), points=[(0, 0), (0, 9), (-7, 6.5), (-7, 0)], depth=0.3)
md.part('rbox', DARK, loc=G(0, -11.5, 3), size=(2.2, 6.0, 1.5), r=0.5)
for k in range(5): md.part('box', LAMP, loc=G(2.25, -11.3, 6 - k * 2.4), size=(0.05, 0.8, 0.4))
md.part('box', RED, loc=G(0, -2.0, 2), size=(10.4, 9, 2.4))
objs.append(md.finish())
md = Model('ar_trestle')  # a 40 m section of wooden railway trestle, 30 m high, with the rails on top
for k in range(5):
    z = -20 + k * 10
    for s in (-1, 1): md.part('box', WOODD, loc=G(s * 3.0, 15, z), size=(0.4, 0.4, 15), rot=(0, 0, s * 5))
    for h_ in (6, 14, 22): md.part('box', WOOD, loc=G(0, h_, z), size=(4.0, 0.3, 0.3))
    md.part('sweep', WOOD, points=[G(-3.6, 1, z), G(2.6, 29, z)], r=0.18, ring=4)
md.part('box', WOODD, loc=G(0, 30.2, 0), size=(3.0, 20, 0.4))
for s in (-1, 1): md.part('box', STEEL, loc=G(s * 0.75, 30.7, 0), size=(0.07, 20, 0.1))
objs.append(md.finish())
md = Model('ar_train')  # a little steam engine and two cars, 30 m (rides along +z)
md.part('cyl', BLACK, loc=G(0, 2.6, 8), size=(1.3, 1.3, 4.0), seg=14, rot=(90, 0, 0))
md.part('rbox', RED, loc=G(0, 3.0, 3.2), size=(1.6, 1.6, 1.8), r=0.2)
md.part('cyl', BLACK, loc=G(0, 4.6, 11), size=(0.4, 0.4, 0.9), seg=10, top=1.5)
md.part('box', REDLIGHT, loc=G(0, 2.6, 12.1), size=(0.3, 0.05, 0.3))
for z in (-4.5, -12.5):
    md.part('rbox', [BLUE, GREEN][int(z < -8)], loc=G(0, 2.6, z), size=(1.6, 3.6, 1.6), r=0.2)
    md.part('rbox', ROOF, loc=G(0, 4.35, z), size=(1.75, 3.7, 0.2), r=0.1)
for z in (10, 7.5, 5, 2, -2, -7, -10, -15):
    for s in (-1, 1): md.part('cyl', DARK, loc=G(s * 1.1, 0.55, z), size=(0.55, 0.55, 0.12), seg=12, rot=(0, 90, 0))
objs.append(md.finish())
md = Model('ar_dam')  # a curved concrete dam, 160 m wide and 50 m tall, with a spillway notch (a shortcut) and towers
for k in range(16):
    a = (k - 7.5) / 16 * 1.1
    x, z = math.sin(a) * 100, -math.cos(a) * 100 + 100
    if k in (7, 8): continue  # the spillway gap
    md.part('box', CONC, loc=G(x, 25, z), size=(3.9, 3.5, 25), rot=(0, 0, -math.degrees(a)))
for k in (7, 8):
    a = (k - 7.5) / 16 * 1.1; x, z = math.sin(a) * 100, -math.cos(a) * 100 + 100
    md.part('box', CONC, loc=G(x, 7, z), size=(3.9, 3.5, 7), rot=(0, 0, -math.degrees(a)))
for s in (-1, 1): md.part('rbox', CONC, loc=G(s * 14, 54, 0.5), size=(3, 3, 4), r=0.3); md.part('rbox', ROOF, loc=G(s * 14, 58.5, 0.5), size=(3.4, 3.4, 0.6), r=0.2)
objs.append(md.finish())
def half_tube(rx, ry, z0, z1, n=24, th=0.4):
    """A half-cylinder shell (an arch roof) along z, open at both ends; outer and inner faces."""
    V, F = [], []
    for k in range(n + 1):
        a = k / n * math.pi
        for z in (z0, z1):
            for rr in (1.0, 1.0 - th / rx):
                V.append(G(rx * rr * math.cos(a), ry * rr * math.sin(a), z))
    for k in range(n):
        b, c = k * 4, (k + 1) * 4
        F.append((b, c, c + 1, b + 1)); F.append((b + 2, b + 3, c + 3, c + 2))  # outer, inner
        F.append((b, b + 2, c + 2, c)); F.append((b + 1, c + 1, c + 3, b + 3))  # the two rims
    return V, F
md = Model('ar_hangar_big')  # a big hangar open at both ends: 34 m wide, 24 m tall, 70 m long (fly through it)
hv, hf = half_tube(17, 23, -35, 35)
md.part('mesh', ALU, loc=G(0, 1, 0), verts=hv, faces=hf, smooth=False)
for k in range(9):
    z = -35 + k * 8.75
    pts = [G(17.1 * math.cos(a), 1 + 23.1 * math.sin(a), z) for a in [i / 12 * math.pi for i in range(13)]]
    md.part('sweep', RUST, points=pts, r=0.45, ring=5)
for s in (-1, 1): md.part('box', CONC, loc=G(0, 0.15, s * 36), size=(18, 1.5, 0.15))
md.part('box', RED, loc=G(0, 24.6, 35.3), size=(8, 0.1, 1.2))
for k in range(4): md.part('rock', LAMP, loc=G(0, 22.5, -26 + k * 17.5), size=(0.7, 0.7, 0.4), sub=1)
objs.append(md.finish())
md = Model('ar_lighthouse')  # a tall lighthouse on a rock, 48 m, with a gallery to fly round
for k in range(8): md.part('cyl', RED if k % 2 else WHITE, loc=G(0, 6 + k * 4.5, 0), size=(4.4 - k * 0.25, 4.4 - k * 0.25, 2.25), seg=18, top=(4.4 - (k + 1) * 0.25) / (4.4 - k * 0.25))
md.part('cyl', DARK, loc=G(0, 42, 0), size=(3.6, 3.6, 0.4), seg=18)
ring(md, DARK, 43.2, 3.6, tube=0.12)
md.part('cyl', LAMP, loc=G(0, 44.3, 0), size=(1.8, 1.8, 1.9), seg=12)
md.part('cyl', RED, loc=G(0, 47, 0), size=(2.3, 2.3, 1.0), seg=12, top=0.1)
md.part('rock', ROCKG, loc=G(0, 2, 0), size=(9, 8, 4), sub=3, amp=1.0, freq=0.3, seed=2)
objs.append(md.finish())
md = Model('ar_mill')  # a water mill with a big wheel (ar_millwheel_wheel at x 9, y 9)
md.part('rbox', STONE, loc=G(0, 7, 0), size=(7, 6, 7), r=0.3)
md.part('cyl', ROOF, loc=G(0, 17, 0), size=(8.5, 7.5, 3.5), seg=4, top=0.05, rot=(0, 0, 45))
for k in range(4): md.part('box', WOODD, loc=G(-7.05, 6 + (k // 2) * 5, -3 + (k % 2) * 6), size=(0.05, 1.2, 1.5))
md.part('box', WOODD, loc=G(8.2, 9, 0), size=(1.2, 1.0, 1.0))
objs.append(md.finish())
md = Model('ar_millwheel_wheel')  # a 16 m water wheel (spins about x)
for s in (-1, 1): md.part('torus', WOODD, loc=G(s * 1.6, 0, 0), size=(8, 8, 8), seg=32, ring=5, tube=0.04, rot=(0, 90, 0))
for k in range(16):
    a = k / 16 * T
    md.part('box', WOOD, loc=G(0, math.sin(a) * 7.8, math.cos(a) * 7.8), size=(1.7, 0.12, 0.9), rot=(math.degrees(a), 0, 0))
    if k % 2 == 0: md.part('box', WOODD, loc=G(1.6, math.sin(a) * 4, math.cos(a) * 4), size=(0.12, 0.15, 4.0), rot=(math.degrees(a) - 90, 0, 0))
md.part('cyl', IRON := DARK, loc=G(0, 0, 0), size=(0.6, 0.6, 2.2), seg=10, rot=(0, 90, 0))
objs.append(md.finish())
md = Model('ar_mast')  # a lattice radio mast, 90 m, with red bands and lights (guy wires drawn by the game)
for k in range(18):
    y = k * 5; m_ = RED if (k // 3) % 2 else WHITE
    for a in (0, 120, 240): md.part('box', m_, loc=G(1.3 * math.cos(math.radians(a)), y + 2.5, 1.3 * math.sin(math.radians(a))), size=(0.12, 0.12, 2.5))
    for a in (0, 120, 240):
        a1, a2 = math.radians(a), math.radians(a + 120)
        md.part('sweep', m_, points=[G(1.3 * math.cos(a1), y, 1.3 * math.sin(a1)), G(1.3 * math.cos(a2), y + 5, 1.3 * math.sin(a2))], r=0.05, ring=3)
for y in (30, 60, 90): md.part('rock', REDLIGHT, loc=G(0, y + 0.5, 0), size=(0.5, 0.5, 0.5), sub=1)
objs.append(md.finish())
md = Model('ar_lookout')  # a fire lookout: a tall timber tower with a cabin on top, 28 m
for s1 in (-1, 1):
    for s2 in (-1, 1): md.part('sweep', WOODD, points=[G(s1 * 3.5, 0, s2 * 3.5), G(s1 * 2, 24, s2 * 2)], r=0.25, ring=5)
for y in (6, 12, 18):
    w_ = 3.5 - y / 24 * 1.5
    for s in (-1, 1): md.part('box', WOOD, loc=G(0, y, s * w_), size=(w_, 0.15, 0.15)); md.part('box', WOOD, loc=G(s * w_, y, 0), size=(0.15, w_, 0.15))
md.part('rbox', WOOD, loc=G(0, 25.5, 0), size=(2.6, 2.6, 1.5), r=0.1)
md.part('box', GLASS, loc=G(0, 25.9, 0), size=(2.65, 2.65, 0.8))
md.part('cyl', ROOF, loc=G(0, 28, 0), size=(3.6, 3.6, 1.1), seg=4, top=0.05, rot=(0, 0, 45))
objs.append(md.finish())
for nm, m_, m2 in (('ar_balloon_a', CANVAS1, CANVAS2), ('ar_balloon_b', CANVAS3, WHITE), ('ar_balloon_c', CANVAS2, CANVAS1)):
    md = Model(nm)  # a hot-air balloon, 22 m tall: striped envelope, basket and burner
    for k in range(8):
        y0 = 8 + k * 1.75; r0 = math.sin((k + 0.5) / 8 * math.pi * 0.95 + 0.25) * 8.5
        md.part('cyl', m_ if k % 2 else m2, loc=G(0, y0 + 0.875, 0), size=(r0, r0, 0.875), seg=20, top=max(0.2, math.sin((k + 1.5) / 8 * math.pi * 0.95 + 0.25)) / max(0.2, math.sin((k + 0.5) / 8 * math.pi * 0.95 + 0.25)))
    md.part('cyl', m2, loc=G(0, 22.2, 0), size=(3.5, 3.5, 0.8), seg=20, top=0.2)
    md.part('cyl', m_, loc=G(0, 7.0, 0), size=(2.2, 2.2, 1.0), seg=16, top=1.8)
    for a in range(4): md.part('sweep', DARK, points=[G(1.6 * math.cos(a * T / 4), 6.0, 1.6 * math.sin(a * T / 4)), G(0.8 * math.cos(a * T / 4), 2.4, 0.8 * math.sin(a * T / 4))], r=0.04, ring=4)
    md.part('rbox', WOOD, loc=G(0, 1.2, 0), size=(1.1, 1.1, 1.0), r=0.15)
    md.part('rock', LAMP, loc=G(0, 3.3, 0), size=(0.4, 0.4, 0.5), sub=1)
    objs.append(md.finish())
md = Model('ar_geyser')  # a geyser's vent: a mound of pale mineral rock with a steaming pool
md.part('rock', ROCKT, loc=G(0, 1.2, 0), size=(7, 7, 2.2), sub=3, amp=0.5, freq=0.3, seed=4)
md.part('cyl', mat('ar_pool', '#3ab0c0', 0.1, emit='#1a6070'), loc=G(0, 3.1, 0), size=(2.4, 2.4, 0.15), seg=18)
objs.append(md.finish())
md = Model('ar_floating_isle')  # a floating island for the sky circuits: grass on top, rock hanging below, 40 m across
md.part('cyl', GRASS, loc=G(0, 0, 0), size=(20, 18, 1.5), seg=18, amp=1.0, freq=0.15, seed=1)
md.part('cyl', ROCKG, loc=G(0, -6, 0), size=(19, 17, 5), seg=18, top=0.75, amp=1.5, freq=0.2, seed=2)
md.part('cyl', ROCKG, loc=G(0, -16, 0), size=(14, 12, 6), seg=14, top=0.35, amp=1.8, freq=0.2, seed=3)
md.part('cyl', ROCKG, loc=G(0, -26, 0), size=(5, 4, 5), seg=10, top=0.15, amp=1.0, freq=0.3, seed=4)
for k in range(9):
    a = k / 9 * T; md.part('rock', GREEN, loc=G(math.cos(a) * 11, 3.2, math.sin(a) * 10), size=(2.6, 2.6, 3.5), sub=2, amp=0.3, freq=0.6, seed=k)
    md.part('cyl', WOODD, loc=G(math.cos(a) * 11, 1.2, math.sin(a) * 10), size=(0.4, 0.4, 1.2), seg=6)
objs.append(md.finish())
md = Model('ar_blimp_dock')  # a blimp dock for Sky Harbour: a ring platform hanging under struts, with a mooring mast
ring(md, STEEL, 0, 14, tube=1.0, seg=36)
md.part('cyl', WOOD, loc=G(0, 0.3, 0), size=(14, 14, 0.4), seg=36)
md.part('cyl', STEEL, loc=G(0, 14, 0), size=(0.8, 0.8, 14), seg=8)
md.part('cyl', RED, loc=G(0, 28.5, 0), size=(1.6, 1.6, 0.6), seg=12)
for k in range(6):
    a = k / 6 * T; md.part('sweep', STEEL, points=[G(math.cos(a) * 13.5, 0.5, math.sin(a) * 13.5), G(0, 26, 0)], r=0.18, ring=4)
    md.part('rock', LAMP, loc=G(math.cos(a) * 14, 1.6, math.sin(a) * 14), size=(0.5, 0.5, 0.5), sub=1)
objs.append(md.finish())
md = Model('ar_waterfall_cliff')  # a cliff face with a cave behind where a waterfall would pour (the falls are drawn by the game)
md.part('rock', ROCKG, loc=G(-42, 25, 0), size=(24, 14, 28), sub=3, amp=3.0, freq=0.09, seed=6)
md.part('rock', ROCKG, loc=G(42, 25, 0), size=(24, 14, 28), sub=3, amp=3.0, freq=0.09, seed=7)
md.part('rock', ROCKG, loc=G(0, 50, 0), size=(46, 14, 10), sub=3, amp=2.5, freq=0.1, seed=8)  # (the gap: 36 m wide, 40 tall)
objs.append(md.finish())

export(objs, OUT, spacing=90)
