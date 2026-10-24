# v1.14.10 The Wild Woods: your camp, in more detail. An A-frame canvas tent (ridge pole, guy ropes and stakes, the door
# flap rolled up and tied, a groundsheet, a bedroll and pillow inside, a lantern on the front pole), a fire ring of
# stones with a log teepee, embers and a cooking tripod with a pot, two camp chairs, a woodpile, a cooler and a pack.
# Placed by src/game/wildwoods.js (buildCamp); the flames themselves are the game's (they flicker).
#   python3 art/src/camp.py      -> art/camp.blend + art/camp.glb
#   node scripts/glb-to-js.mjs art/camp.glb src/data/campMesh.js CAMP
# Game axes: x right, y up, z forward (G converts). Every piece stands on its origin.
import os, sys, math, random
sys.path.insert(0, os.path.dirname(__file__))
from kit import Model, mat, reset, export
smooth = lambda a, b, x: max(0.0, min(1.0, (x - a) / (b - a))) ** 2 * (3 - 2 * max(0.0, min(1.0, (x - a) / (b - a))))

OUT = os.path.join(os.path.dirname(__file__), '..', 'camp')
G = lambda x, y, z: (x, -z, y)
reset()
random.seed(7)
CANVAS = mat('cp_canvas', '#d9773a', 0.95)
CANVASD = mat('cp_canvas_dark', '#a8562a', 0.95)
CANVASL = mat('cp_canvas_light', '#eeb07a', 0.95)
SEAM = mat('cp_seam', '#f2e2c4', 0.9)
GROUND = mat('cp_groundsheet', '#3e6a5a', 0.9)
BEDROLL = mat('cp_bedroll', '#4a6a9a', 0.95)
BEDROLLB = mat('cp_bedroll_band', '#c8b080', 0.9)
PILLOW = mat('cp_pillow', '#f0ece0', 0.95)
POLE = mat('cp_pole', '#b89a6a', 0.8)
ROPE = mat('cp_rope', '#e0d0a8', 0.95)
STAKE = mat('cp_stake', '#8a8a90', 0.5, 0.6)
STONE = mat('cp_stone', '#8f8a80', 0.95)
STONED = mat('cp_stone_dark', '#6a655c', 0.95)
STONEL = mat('cp_stone_light', '#a8a296', 0.95)
BARK = mat('cp_bark', '#5c4030', 0.95)
WOODCUT = mat('cp_wood_cut', '#d8b880', 0.9)
CHAR = mat('cp_char', '#2a2420', 0.95)
EMBER = mat('cp_ember', '#ff6a20', 0.6, emit='#ff4a10')
ASH = mat('cp_ash', '#7a746c', 0.95)
IRON = mat('cp_iron', '#3e3a36', 0.5, 0.7)
LAMP = mat('cp_lamp_glow', '#ffd890', 0.4, emit='#ffb040')
BRASS = mat('cp_brass', '#c8a040', 0.4, 0.8)
CHAIRF = mat('cp_chair_frame', '#2e3236', 0.5, 0.5)
CHAIRC = mat('cp_chair_cloth', '#3a7a5a', 0.95)
CHAIRC2 = mat('cp_chair_cloth_red', '#b8483a', 0.95)
COOLER = mat('cp_cooler', '#2f8aa8', 0.7)
COOLERL = mat('cp_cooler_lid', '#f2f0ea', 0.7)
PACK = mat('cp_pack', '#7a8a3a', 0.9)
PACKD = mat('cp_pack_dark', '#4a5a2a', 0.9)
objs = []

def cloth(m, pos, nu, nv, mat_at, thick=0.012):
    """A sheet of canvas: pos(u, v) -> game (x, y, z) for u, v in 0..1, two-sided (a thin shell), each face's material
    from mat_at(i, j) (so seams and hems are stripes of the same cloth)."""
    from mathutils import Vector
    bm = m.bm
    P = [[Vector(G(*pos(i / nu, j / nv))) for j in range(nv + 1)] for i in range(nu + 1)]
    def nrm(i, j):
        a = P[min(i + 1, nu)][j] - P[max(i - 1, 0)][j]; b = P[i][min(j + 1, nv)] - P[i][max(j - 1, 0)]
        n = a.cross(b); return n.normalized() if n.length > 1e-9 else Vector((0, 0, 1))
    top = [[bm.verts.new(P[i][j] + nrm(i, j) * thick / 2) for j in range(nv + 1)] for i in range(nu + 1)]
    bot = [[bm.verts.new(P[i][j] - nrm(i, j) * thick / 2) for j in range(nv + 1)] for i in range(nu + 1)]
    for i in range(nu):
        for j in range(nv):
            k = m._slot(mat_at(i, j))
            f = bm.faces.new((top[i][j], top[i + 1][j], top[i + 1][j + 1], top[i][j + 1])); f.material_index = k; f.smooth = True
            f = bm.faces.new((bot[i][j + 1], bot[i + 1][j + 1], bot[i + 1][j], bot[i][j])); f.material_index = k; f.smooth = True


# ---- the tent: 2.4 m long, 2.1 m wide, 1.55 m to the ridge; the door faces +z
m = Model('camp_tent')
L, W, H = 2.4, 1.05, 1.55
m.part('box', GROUND, loc=G(0, 0.01, 0.1), size=(1.12, 1.32, 0.01))
NU, NV = 24, 10
for s in (-1, 1):  # the two roof panels: canvas that sags between the poles, a scalloped hem, seams where panels meet
    def roof(u, v, s=s):
        z = -L / 2 + u * L
        billow = 0.07 * math.sin(math.pi * v) * (0.55 + 0.45 * math.sin(math.pi * u))
        hem = 0.03 * math.sin(u * math.pi * 8) ** 2 * smooth(0.85, 1.0, v)
        return (s * W * v, H * (1 - v) - billow - hem + 0.02, z)
    def pick(i, j):
        if j >= NV - 1: return CANVASD  # the hem
        if i in (NU // 3, 2 * NU // 3): return SEAM  # stitched seams between the three panels
        return CANVAS if (i // 2) % 2 == 0 else CANVASL  # a hint of weave
    cloth(m, roof, NU, NV, pick)
# a fly-sheet ridge strip with toggles
m.part('box', CANVASD, loc=G(0, H + 0.035, 0), size=(0.07, L / 2 + 0.03, 0.012))
for z in (-0.8, 0, 0.8): m.part('cyl', POLE, loc=G(0, H + 0.05, z), size=(0.015, 0.015, 0.04), seg=5, rot=(0, 90, 0))
# the back wall (a triangle) and the front, with the door flaps rolled up and tied to the sides
m.part('poly', CANVASD, points=[(-W, 0.02), (W, 0.02), (0, H)], depth=0.02, loc=G(0, 0, -L / 2))
m.part('poly', GROUND, points=[(-0.22, 0.55), (0.22, 0.55), (0.22, 0.85), (-0.22, 0.85)], depth=0.03, loc=G(0, 0, -L / 2))  # a mesh window
for k in range(5): m.part('box', SEAM, loc=G(-0.22 + k * 0.11, 0.7, -L / 2 - 0.02), size=(0.004, 0.004, 0.15))
for s in (-1, 1):
    m.part('poly', CANVAS, points=[(s * W, 0.02), (s * 0.36, 0.02), (s * 0.1, H * 0.86), (0, H)], depth=0.02, loc=G(0, 0, L / 2))
    m.part('sweep', CANVASL, points=[G(s * 0.4, 0.05, L / 2 + 0.04), G(s * 0.33, 0.4, L / 2 + 0.05), G(s * 0.25, 0.75, L / 2 + 0.05), G(s * 0.15, 1.05, L / 2 + 0.04)], r=[0.03, 0.045, 0.04, 0.02], ring=7, squash=0.6)
    m.part('torus', ROPE, loc=G(s * 0.29, 0.58, L / 2 + 0.05), size=(0.05, 0.05, 0.05), tube=0.25, seg=10, ring=4, rot=(90, 0, 0))
# poles: front and back uprights, the ridge pole
for z in (-L / 2 - 0.02, L / 2 + 0.05): m.part('cyl', POLE, loc=G(0, H / 2 + 0.04, z), size=(0.03, 0.03, H / 2 + 0.06), seg=8)
m.part('cyl', POLE, loc=G(0, H + 0.02, 0), size=(0.025, 0.025, L / 2 + 0.1), seg=8, rot=(90, 0, 0))
m.part('rock', POLE, loc=G(0, H + 0.12, L / 2 + 0.05), size=(0.04, 0.04, 0.04), sub=1)
# guy ropes out to stakes, front and back, and the eaves pegged down
for z, dz in ((L / 2 + 0.05, 1), (-L / 2 - 0.02, -1)):
    for s in (-0.6, 0.6):
        sx, sz = s, z + dz * 0.75
        m.part('sweep', ROPE, points=[G(0, H + 0.05, z), G(sx, 0.03, sz)], r=0.008, ring=3)
        m.part('cyl', STAKE, loc=G(sx, 0.08, sz), size=(0.018, 0.018, 0.1), seg=5, rot=(dz * 20, 0, -s * 20))
for s in (-1, 1):
    for z in (-1.0, 0, 1.0): m.part('cyl', STAKE, loc=G(s * (W + 0.12), 0.05, z), size=(0.015, 0.015, 0.07), seg=5, rot=(0, 0, -s * 30))
# inside: a bedroll with two bands and a pillow, seen through the door
m.part('cyl', BEDROLL, loc=G(0.22, 0.12, -0.2), size=(0.12, 0.12, 0.8), seg=12, rot=(90, 0, 0))
m.part('rbox', BEDROLL, loc=G(-0.2, 0.05, 0.0), size=(0.32, 0.85, 0.04), r=0.03)
for z in (-0.55, 0.15): m.part('cyl', BEDROLLB, loc=G(0.22, 0.12, z), size=(0.125, 0.125, 0.03), seg=12, rot=(90, 0, 0))
m.part('rbox', PILLOW, loc=G(-0.2, 0.11, -0.8), size=(0.24, 0.13, 0.06), r=0.05)
# the lantern on the front pole
m.part('cyl', IRON, loc=G(0.06, 1.18, L / 2 + 0.12), size=(0.07, 0.07, 0.015), seg=8)
m.part('cyl', LAMP, loc=G(0.06, 1.08, L / 2 + 0.12), size=(0.055, 0.055, 0.09), seg=8)
m.part('cyl', IRON, loc=G(0.06, 0.98, L / 2 + 0.12), size=(0.07, 0.07, 0.015), seg=8)
m.part('torus', BRASS, loc=G(0.06, 1.24, L / 2 + 0.12), size=(0.04, 0.04, 0.04), tube=0.2, seg=8, ring=3, rot=(90, 0, 0))
objs.append(m.finish())

# ---- the fire: a ring of stones, a bed of embers and ash, a log teepee, and a tripod with a pot
m = Model('camp_fire')
for i in range(11):
    a = i / 11 * math.tau + random.uniform(-0.1, 0.1); r = 0.58 + random.uniform(-0.04, 0.05)
    m.part('rock', (STONE, STONED, STONEL)[i % 3], loc=G(math.cos(a) * r, 0.09, math.sin(a) * r), size=(0.16 + random.uniform(0, 0.05), 0.13, 0.11 + random.uniform(0, 0.04)), rot=(0, 0, random.uniform(0, 360)), sub=2, amp=0.03, freq=4, seed=i)
m.part('cyl', ASH, loc=G(0, 0.02, 0), size=(0.46, 0.46, 0.02), seg=16)
for i in range(9):
    a = i / 9 * math.tau
    m.part('rock', EMBER if i % 2 else CHAR, loc=G(math.cos(a) * 0.2, 0.05, math.sin(a) * 0.2), size=(0.07, 0.07, 0.05), sub=1, amp=0.02, freq=6, seed=i + 20)
for i in range(6):  # the teepee: logs leaning in, charred at the top, cut ends pale
    a = i / 6 * math.tau + 0.3
    bx, bz = math.cos(a) * 0.36, math.sin(a) * 0.36
    m.part('sweep', BARK, points=[G(bx, 0.04, bz), G(bx * 0.45, 0.32, bz * 0.45)], r=[0.05, 0.045], ring=7)
    m.part('sweep', CHAR, points=[G(bx * 0.45, 0.32, bz * 0.45), G(bx * 0.12, 0.5, bz * 0.12)], r=[0.045, 0.03], ring=7)
    m.part('cyl', WOODCUT, loc=G(bx * 1.02, 0.035, bz * 1.02), size=(0.05, 0.05, 0.006), seg=8, rot=(0, 90 - math.degrees(math.atan2(0.28, 0.2)), math.degrees(-a)))
for i in range(3):  # tripod and a pot on a chain
    a = i / 3 * math.tau + 0.5
    m.part('sweep', IRON, points=[G(math.cos(a) * 0.75, 0.0, math.sin(a) * 0.75), G(0, 1.3, 0)], r=0.018, ring=4)
m.part('sweep', IRON, points=[G(0, 1.3, 0), G(0, 0.85, 0)], r=0.006, ring=3)
m.part('cyl', IRON, loc=G(0, 0.75, 0), size=(0.17, 0.17, 0.11), seg=14, top=0.85)
m.part('torus', IRON, loc=G(0, 0.86, 0), size=(0.13, 0.13, 0.13), tube=0.12, seg=14, ring=4)
m.part('sweep', IRON, points=[G(-0.13, 0.86, 0), G(0, 0.98, 0), G(0.13, 0.86, 0)], r=0.006, ring=3)
objs.append(m.finish())

# ---- camp chairs: folding frames with a sling seat, angled toward the fire
for name, cloth in (('camp_chair', CHAIRC), ('camp_chair_red', CHAIRC2)):
    m = Model(name)
    for s in (-1, 1):
        m.part('cyl', CHAIRF, loc=G(s * 0.26, 0.24, 0), size=(0.015, 0.015, 0.33), seg=5, rot=(28, 0, 0))
        m.part('cyl', CHAIRF, loc=G(s * 0.26, 0.24, 0), size=(0.015, 0.015, 0.33), seg=5, rot=(-28, 0, 0))
        m.part('cyl', CHAIRF, loc=G(s * 0.27, 0.62, -0.2), size=(0.015, 0.015, 0.3), seg=5, rot=(-15, 0, 0))
        m.part('rbox', cloth, loc=G(s * 0.3, 0.5, 0.0), size=(0.03, 0.18, 0.02), r=0.01)  # armrest
    m.part('sweep', cloth, points=[G(0, 0.44, 0.22), G(0, 0.36, 0.0), G(0, 0.42, -0.18)], r=0.26, ring=8, squash=0.08)
    m.part('box', cloth, loc=G(0, 0.68, -0.24), size=(0.26, 0.015, 0.2), rot=(-15, 0, 0))
    objs.append(m.finish())

# ---- a woodpile, a cooler and a backpack
m = Model('camp_woodpile')
for row in range(3):
    for k in range(4 - row):
        x = -0.36 + k * 0.24 + row * 0.12
        m.part('cyl', BARK, loc=G(x, 0.08 + row * 0.15, 0), size=(0.075, 0.075, 0.4), seg=8, rot=(90, 0, random.uniform(-6, 6)))
        for dz in (-0.4, 0.4): m.part('cyl', WOODCUT, loc=G(x, 0.08 + row * 0.15, dz), size=(0.07, 0.07, 0.005), seg=8, rot=(90, 0, 0))
m.part('cyl', BARK, loc=G(0.75, 0.2, 0.1), size=(0.17, 0.17, 0.2), seg=10)  # a chopping block with an axe in it
m.part('cyl', WOODCUT, loc=G(0.75, 0.405, 0.1), size=(0.16, 0.16, 0.005), seg=10)
m.part('cyl', POLE, loc=G(0.75, 0.6, 0.12), size=(0.02, 0.02, 0.22), seg=5, rot=(0, 0, 30))
m.part('box', IRON, loc=G(0.83, 0.44, 0.12), size=(0.07, 0.01, 0.05), rot=(0, 0, 30))
objs.append(m.finish())
m = Model('camp_cooler')
m.part('rbox', COOLER, loc=G(0, 0.2, 0), size=(0.32, 0.2, 0.18), r=0.03)
m.part('rbox', COOLERL, loc=G(0, 0.4, 0), size=(0.33, 0.21, 0.04), r=0.03)
for s in (-1, 1): m.part('box', COOLERL, loc=G(s * 0.33, 0.3, 0), size=(0.015, 0.06, 0.03))
m.part('rbox', PACK, loc=G(0.75, 0.3, 0.05), size=(0.2, 0.13, 0.3), r=0.06)
m.part('rbox', PACKD, loc=G(0.75, 0.22, 0.2), size=(0.15, 0.05, 0.13), r=0.04)
m.part('cyl', BEDROLL, loc=G(0.75, 0.66, 0.05), size=(0.07, 0.07, 0.2), seg=10, rot=(0, 90, 0))
objs.append(m.finish())

export(objs, OUT, spacing=3.5)
