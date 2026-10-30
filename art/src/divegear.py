# Open Waters v1.15.7: dive gear you can see on a swimmer. A mask on the face, a scuba tank on the back, fins on the
# feet, and the two spearguns in the hand. Authored in the avatar's own units (before its 1.08 scale), each piece at
# the origin of the avatar part it hangs from (src/game/actor.js attaches them):
#   dive_mask   -> the head group (the face is at z = +0.27, the eyes at y = 0.255)
#   dive_tank   -> the body group (the torso runs y 0..0.44, its back at z = -0.16)
#   dive_fin    -> a foot (origin at the sole's centre, pointing +z)
#   gun_pole, gun_band -> the right hand's rod socket (grip at the origin, the barrel along +y like a rod)
#   python3 art/src/divegear.py      -> art/divegear.blend + art/divegear.glb
#   node scripts/glb-to-js.mjs art/divegear.glb src/data/diveGearMesh.js DIVEGEAR
import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
from kit import Model, mat, reset, export

OUT = os.path.join(os.path.dirname(__file__), '..', 'divegear')
G = lambda x, y, z: (x, -z, y)
reset()
RUBBER = mat('dg_rubber', '#1e2a32', 0.8)
FRAME = mat('dg_frame', '#f0c030', 0.6)
LENS = mat('dg_lens', '#9ad8ee', 0.1)
TANK = mat('dg_tank', '#f2f0ea', 0.45, 0.3)
TANKB = mat('dg_tank_band', '#e8642a', 0.6)
STEEL = mat('dg_steel', '#b8c0c8', 0.35, 0.8)
STRAP = mat('dg_strap', '#2a3a48', 0.85)
FIN = mat('dg_fin', '#2fa8d8', 0.6)
FINE = mat('dg_fin_edge', '#1b6a8e', 0.6)
WOOD = mat('dg_wood', '#8a5a34', 0.8)
BAND = mat('dg_band', '#c8402a', 0.7)
objs = []

# ---- mask: a yellow frame round two lenses, a nose pocket, a black strap round the head
m = Model('dive_mask')
m.part('rbox', FRAME, loc=G(0, 0.24, 0.285), size=(0.24, 0.015, 0.075), r=0.012)
for s in (-1, 1): m.part('rbox', LENS, loc=G(s * 0.105, 0.245, 0.335), size=(0.085, 0.005, 0.058), r=0.004)
m.part('rbox', FRAME, loc=G(0, 0.17, 0.3), size=(0.045, 0.03, 0.04), r=0.012)  # nose pocket
m.part('torus', RUBBER, loc=G(0, 0.24, 0.0), size=(0.31, 0.3, 0.3), tube=0.06, seg=20, ring=4)  # the strap
m.part('cyl', RUBBER, loc=G(0.16, 0.37, 0.18), size=(0.022, 0.022, 0.14), seg=6)  # a snorkel up the side
m.part('cyl', RUBBER, loc=G(0.16, 0.52, 0.18), size=(0.03, 0.03, 0.02), seg=6)
objs.append(m.finish())

# ---- tank: a white cylinder with an orange band and a valve, on a harness
m = Model('dive_tank')
m.part('cyl', TANK, loc=G(0, 0.25, -0.28), size=(0.11, 0.11, 0.23), seg=14)
for y in (0.48, 0.02): m.part('rock', TANK, loc=G(0, y, -0.28), size=(0.11, 0.11, 0.05), sub=2)
m.part('cyl', TANKB, loc=G(0, 0.3, -0.28), size=(0.112, 0.112, 0.04), seg=14)
m.part('cyl', STEEL, loc=G(0, 0.55, -0.28), size=(0.035, 0.035, 0.04), seg=8)
m.part('cyl', STEEL, loc=G(0.06, 0.56, -0.28), size=(0.02, 0.02, 0.05), seg=6, rot=(0, 90, 0))
m.part('sweep', RUBBER, points=[G(0.08, 0.56, -0.28), G(0.2, 0.55, -0.1), G(0.24, 0.42, 0.12), G(0.12, 0.36, 0.2)], r=0.014, ring=5)  # the hose
for x in (-0.13, 0.13): m.part('sweep', STRAP, points=[G(x, 0.44, -0.18), G(x, 0.47, 0.0), G(x * 1.05, 0.38, 0.17), G(x * 1.05, 0.1, 0.17)], r=0.018, ring=4, squash=0.5)
m.part('rbox', STRAP, loc=G(0, 0.09, 0.0), size=(0.28, 0.17, 0.03), r=0.02)  # the waist strap
objs.append(m.finish())

# ---- fin: a foot pocket and a long flexible blade
m = Model('dive_fin')
m.part('rbox', FINE, loc=G(0, 0.06, 0.02), size=(0.13, 0.15, 0.07), r=0.04)
m.part('poly', FIN, loc=G(0, 0.025, 0), points=[(-0.12, 0.1), (0.12, 0.1), (0.2, 0.55), (0.06, 0.5), (0, 0.56), (-0.06, 0.5), (-0.2, 0.55)], depth=0.02, rot=(90, 0, 0))
for s in (-1, 1): m.part('sweep', FINE, points=[G(s * 0.12, 0.03, 0.1), G(s * 0.2, 0.03, 0.55)], r=0.015, ring=4)
objs.append(m.finish())

# ---- spearguns: grip at the origin, the barrel and spear along +y
m = Model('gun_pole')
m.part('cyl', WOOD, loc=G(0, 0.5, 0), size=(0.022, 0.022, 0.75), seg=6)
m.part('cyl', STEEL, loc=G(0, 1.32, 0), size=(0.012, 0.012, 0.08), seg=6, top=0.1)
for a in (0, 120, 240): m.part('cyl', STEEL, loc=G(math.sin(math.radians(a)) * 0.02, 1.28, math.cos(math.radians(a)) * 0.02), size=(0.006, 0.006, 0.07), seg=4, rot=(math.cos(math.radians(a)) * 15, 0, -math.sin(math.radians(a)) * 15))
m.part('torus', BAND, loc=G(0, -0.2, 0), size=(0.05, 0.05, 0.05), tube=0.3, seg=10, ring=4, rot=(90, 0, 0))
objs.append(m.finish())
m = Model('gun_band')
m.part('rbox', WOOD, loc=G(0, 0.42, 0), size=(0.03, 0.045, 0.42), r=0.012)  # the stock
m.part('rbox', WOOD, loc=G(0, -0.02, -0.06), size=(0.025, 0.03, 0.07), r=0.01, rot=(-20, 0, 0))  # pistol grip
m.part('cyl', STEEL, loc=G(0, 0.6, 0.06), size=(0.009, 0.009, 0.62), seg=6)  # the spear
m.part('cyl', STEEL, loc=G(0, 1.25, 0.06), size=(0.014, 0.014, 0.05), seg=6, top=0.05)
for s in (-1, 1): m.part('sweep', BAND, points=[G(s * 0.03, 0.82, 0.0), G(s * 0.05, 0.6, 0.02), G(0, 0.36, 0.07)], r=0.012, ring=4)
objs.append(m.finish())

export(objs, OUT, spacing=1.5)
