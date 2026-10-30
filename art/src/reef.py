# Open Waters stage 3: the reef kit for diving. Corals, a sea fan, an anemone, kelp, a sponge, a giant clam, and the
# spear for the speargun. Placed on the reefs at Turtle Atoll, Reef Edge and round Palm Key by src/ocean/dive.js.
#   python3 art/src/reef.py      -> art/reef.blend + art/reef.glb
#   node scripts/glb-to-js.mjs art/reef.glb src/data/reefMesh.js REEF
# Game axes: x right, y up, z forward. Every piece stands on its origin (the sea floor).
import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
import bpy
from kit import Model, mat, reset, export

OUT = os.path.join(os.path.dirname(__file__), '..', 'reef')
G = lambda x, y, z: (x, -z, y)
reset()
BRAIN = mat('coral_brain', '#c98a5a', 0.85)
PINK = mat('coral_pink', '#e0708a', 0.8)
PURP = mat('coral_purple', '#8a5ab8', 0.8)
ORNG = mat('coral_orange', '#e88a3a', 0.8)
YEL = mat('coral_yellow', '#e2c84a', 0.8)
FAN = mat('sea_fan', '#b8406a', 0.8)
KELP = mat('kelp', '#4a7a2a', 0.8)
KELP2 = mat('kelp_dark', '#3a5e22', 0.8)
SPONGE = mat('sponge', '#d0a030', 0.9)
ANEM = mat('anemone', '#e8a0c0', 0.6)
ANEMB = mat('anemone_base', '#a05a7a', 0.8)
CLAM = mat('clam_shell', '#c8c0a8', 0.6)
CLAMM = mat('clam_mantle', '#3a8ab0', 0.4)
STEEL = mat('spear_steel', '#d0d4d8', 0.25, 0.9)
WOODG = mat('spear_wood', '#7a5a3a', 0.7)

objs = []
# brain coral: a lumpy dome with grooves
m = Model('reef_brain')
m.part('rock', BRAIN, loc=G(0, 0.35, 0), size=(0.8, 0.75, 0.5), sub=3, amp=0.07, freq=7, seed=2)
objs.append(m.finish())
# branching (staghorn) coral
m = Model('reef_branch')
import random
rnd = random.Random(4)
def branch(md, matx, x, y, z, ang, tilt, L, depth):
    ex = x + math.cos(ang) * math.sin(tilt) * L; ez = z + math.sin(ang) * math.sin(tilt) * L; ey = y + math.cos(tilt) * L
    md.part('sweep', matx, points=[G(x, y, z), G(ex, ey, ez)], r=[0.06 * (depth + 1) * 0.5 + 0.02, 0.03], ring=5)
    if depth > 0:
        for k in range(2): branch(md, matx, ex, ey, ez, ang + rnd.uniform(-1.2, 1.2), min(1.2, tilt + rnd.uniform(0.1, 0.5)), L * 0.72, depth - 1)
for i in range(4): branch(m, PINK if i % 2 else ORNG, rnd.uniform(-0.2, 0.2), 0, rnd.uniform(-0.2, 0.2), i * 1.6, 0.35, 0.55, 3)
objs.append(m.finish())
# table coral
m = Model('reef_table')
m.part('cyl', YEL, loc=G(0, 0.3, 0), size=(0.12, 0.12, 0.3), seg=6)
m.part('cyl', YEL, loc=G(0, 0.62, 0), size=(0.9, 0.85, 0.05), seg=12, amp=0.04, freq=3)
objs.append(m.finish())
# sea fan: a flat lacy fan on a stalk
m = Model('reef_fan')
m.part('cyl', FAN, loc=G(0, 0.15, 0), size=(0.05, 0.05, 0.15), seg=5)
pts = [(math.cos(a) * 0.65, 0.3 + math.sin(a) * 0.75) for a in [math.pi * k / 10 for k in range(11)]] + [(0, 0.3)]
m.part('poly', FAN, loc=G(0, 0, 0), points=pts, depth=0.03)
objs.append(m.finish())
# anemone: a soft base and a crown of tentacles (clownfish live here)
m = Model('reef_anemone')
m.part('cyl', ANEMB, loc=G(0, 0.12, 0), size=(0.32, 0.32, 0.12), seg=10, top=0.85)
for i in range(18):
    a = i / 18 * math.tau; r0 = 0.12 + (i % 3) * 0.06
    m.part('sweep', ANEM, points=[G(math.cos(a) * r0, 0.22, math.sin(a) * r0), G(math.cos(a) * (r0 + 0.12), 0.48, math.sin(a) * (r0 + 0.12))], r=[0.03, 0.02], ring=4)
objs.append(m.finish())
# kelp: tall swaying strands (the code sways them)
m = Model('reef_kelp')
for i in range(5):
    x, z = math.cos(i * 1.3) * 0.3, math.sin(i * 1.3) * 0.3
    pts = [G(x + math.sin(k * 0.7 + i) * 0.15, k * 0.6, z + math.cos(k * 0.5 + i) * 0.1) for k in range(8)]
    m.part('sweep', KELP if i % 2 else KELP2, points=pts, r=0.05, ring=3, squash=0.25)
objs.append(m.finish())
# tube sponge
m = Model('reef_sponge')
for i, (x, z, h) in enumerate(((0, 0, 0.9), (0.25, 0.1, 0.65), (-0.2, 0.18, 0.5))):
    m.part('cyl', SPONGE, loc=G(x, h / 2, z), size=(0.12, 0.12, h / 2), seg=8, top=1.15)
objs.append(m.finish())
# giant clam
m = Model('reef_clam')
m.part('rock', CLAM, loc=G(0, 0.18, 0), size=(0.55, 0.35, 0.2), sub=2, amp=0.03, freq=6)
m.part('box', CLAMM, loc=G(0, 0.36, 0), size=(0.48, 0.05, 0.03))
objs.append(m.finish())
# the spear (it flies nose-first along +z)
m = Model('reef_spear')
m.part('cyl', STEEL, loc=G(0, 0, 0), size=(0.012, 0.012, 0.8), rot=(90, 0, 0), seg=5)
m.part('cyl', STEEL, loc=G(0, 0, 0.86), size=(0.03, 0.03, 0.07), rot=(90, 0, 0), seg=5, top=0.05)
for s in (-1, 1): m.part('box', STEEL, loc=G(s * 0.03, 0, 0.72), size=(0.03, 0.005, 0.01))
objs.append(m.finish())

export(objs, OUT, spacing=3)
