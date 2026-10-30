# Open Waters stage 4: Beach Games on Palm Key. The lobby board, the volleyball court, the crab race track and four
# racing crabs, the coconut toss buckets, sandcastle plots and pieces, the diving tower off the jetty, and a hammock.
# Placed by src/ocean/games/*.js.
#   python3 art/src/beachgames.py   -> art/beachgames.blend + art/beachgames.glb
#   node scripts/glb-to-js.mjs art/beachgames.glb src/data/beachMesh.js BEACH
# Game axes: x right, y up, z forward. Every piece stands on its origin (the sand).
import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
import bpy
from kit import Model, mat, reset, export

OUT = os.path.join(os.path.dirname(__file__), '..', 'beachgames')
G = lambda x, y, z: (x, -z, y)
reset()
WOOD = mat('bg_wood', '#a07448', 0.85)
WOODD = mat('bg_wood_dark', '#6e4c2e', 0.85)
BOARD = mat('bg_board', '#e8dcb8', 0.9)
TEAL = mat('bg_teal', '#2fa8a0', 0.7)
CORAL = mat('bg_coral', '#f07860', 0.7)
SUN = mat('bg_sun', '#f2c84a', 0.7)
WHITE = mat('bg_white', '#f4f2ea', 0.7)
ROPE = mat('bg_rope', '#d8c49a', 0.95)
NET = mat('bg_net', '#3a3a3a', 0.9)
LINE = mat('bg_line', '#f8f4e8', 0.9)
SAND = mat('bg_sand', '#e2cf98', 0.95)
WETS = mat('bg_wet_sand', '#c4ae78', 0.95)
SHELLC = mat('bg_shell', '#f6d8d0', 0.5)
COCO = mat('bg_coconut', '#6a4a2a', 0.9)
COCOH = mat('bg_coconut_hair', '#8a6a40', 1.0)
PAIL_R = mat('bg_pail_red', '#e04a3a', 0.5)
PAIL_B = mat('bg_pail_blue', '#3a7ad0', 0.5)
PAIL_Y = mat('bg_pail_yellow', '#f0c030', 0.5)
EYE = mat('bg_eye', '#1a1a1a', 0.3)
EYEW = mat('bg_eye_white', '#ffffff', 0.4)
CRABS = {'red': mat('bg_crab_red', '#e2483a', 0.6), 'blue': mat('bg_crab_blue', '#3a78d8', 0.6),
         'yellow': mat('bg_crab_yellow', '#f0b830', 0.6), 'purple': mat('bg_crab_purple', '#9a58c8', 0.6)}
CANVAS = mat('bg_canvas', '#f0e4c4', 0.95)
CANVAS2 = mat('bg_canvas_stripe', '#e8705a', 0.95)
METAL = mat('bg_metal', '#c8ccd0', 0.35, 0.8)

objs = []

# ---- the lobby board: two posts, a painted board with four coloured panels, a thatched roof and bunting
m = Model('bg_board')
for s in (-1, 1): m.part('cyl', WOODD, loc=G(s * 1.1, 1.2, 0), size=(0.08, 0.08, 1.2), seg=6)
m.part('rbox', BOARD, loc=G(0, 1.55, 0), size=(1.05, 0.04, 0.6), r=0.03)
for i, (c, x, y) in enumerate(((TEAL, -0.5, 1.8), (CORAL, 0.5, 1.8), (SUN, -0.5, 1.3), (WHITE, 0.5, 1.3))):
    m.part('box', c, loc=G(x, y, 0.05), size=(0.42, 0.01, 0.2))
m.part('box', CORAL, loc=G(0, 2.28, 0.0), size=(1.2, 0.12, 0.08))  # the header plank
for s in (-1, 1): m.part('box', WOODD, loc=G(0, 2.5, s * 0.2), size=(1.3, 0.26, 0.025), rot=(25 * s, 0, 0))  # a little gable roof
for i in range(9):
    x = -1.1 + i * 0.275
    m.part('poly', [TEAL, CORAL, SUN][i % 3], loc=G(x, 2.15, 0.12), points=[(-0.1, 0), (0.1, 0), (0, -0.16)], depth=0.01)
objs.append(m.finish())

# ---- volleyball: posts, the net, the ball, and the court's lines (14 x 7 m, the net across the middle, along z)
m = Model('bg_vb_net')
for s in (-1, 1): m.part('cyl', WOOD, loc=G(0, 1.25, s * 3.9), size=(0.07, 0.07, 1.25), seg=6)
m.part('box', NET, loc=G(0, 1.95, 0), size=(0.01, 3.85, 0.45))
m.part('box', WHITE, loc=G(0, 2.42, 0), size=(0.02, 3.9, 0.04))
for s in (-1, 1): m.part('sweep', ROPE, points=[G(0, 2.45, s * 3.9), G(0, 0.02, s * 5.2)], r=0.012, ring=4)
objs.append(m.finish())
m = Model('bg_vb_lines')
for (x, z, sx, sz) in ((0, 3.5, 7, 0.05), (0, -3.5, 7, 0.05), (7, 0, 0.05, 3.5), (-7, 0, 0.05, 3.5), (0, 0, 0.05, 3.5)):
    m.part('box', LINE, loc=G(x, 0.015, z), size=(sx, sz, 0.015))
objs.append(m.finish())
m = Model('bg_ball')
m.part('rock', WHITE, loc=G(0, 0, 0), size=(0.11, 0.11, 0.11), sub=2)
for i, c in enumerate((SUN, TEAL)):
    m.part('torus', c, loc=G(0, 0, 0), size=(0.108, 0.108, 0.108), rot=(0, 90 * i, 30 + 60 * i), tube=0.12, seg=16, ring=4)
objs.append(m.finish())

# ---- crab races: four crabs (one per shell colour), the track (lane ropes, start and finish lines)
def crab(name, shell):
    m = Model(name)
    m.part('rock', shell, loc=G(0, 0.09, 0), size=(0.16, 0.13, 0.07), sub=2, amp=0.01, freq=6)
    for s in (-1, 1):
        for k in range(3):
            a = (k - 1) * 0.45
            m.part('sweep', shell, points=[G(s * 0.12, 0.08, a * 0.2), G(s * 0.24, 0.1, a * 0.3), G(s * 0.3, 0.0, a * 0.36)], r=0.014, ring=4)
        m.part('sweep', shell, points=[G(s * 0.1, 0.09, 0.08), G(s * 0.16, 0.12, 0.18)], r=0.018, ring=4)
        m.part('rock', shell, loc=G(s * 0.18, 0.13, 0.24), size=(0.06, 0.05, 0.04), sub=1)
        m.part('cyl', shell, loc=G(s * 0.04, 0.17, 0.08), size=(0.008, 0.008, 0.04), seg=4)
        m.part('rock', EYEW, loc=G(s * 0.04, 0.22, 0.08), size=(0.022, 0.022, 0.022), sub=1)
        m.part('rock', EYE, loc=G(s * 0.04, 0.225, 0.096), size=(0.011, 0.011, 0.011), sub=1)
    return m.finish()
for k, c in CRABS.items(): objs.append(crab('bg_crab_' + k, c))
m = Model('bg_track')  # 4 lanes 0.8 m wide, 10 m long along +z, centred
for i in range(5):
    x = -1.6 + i * 0.8
    for z in (-5, 5): m.part('cyl', WOODD, loc=G(x, 0.2, z), size=(0.03, 0.03, 0.2), seg=5)
    m.part('sweep', ROPE, points=[G(x, 0.32, -5), G(x, 0.26, 0), G(x, 0.32, 5)], r=0.01, ring=4)
m.part('box', LINE, loc=G(0, 0.012, -5), size=(1.65, 0.04, 0.012))
for i in range(8):
    m.part('box', WOODD if i % 2 else LINE, loc=G(-1.6 + 0.2 + i * 0.4, 0.013, 5), size=(0.2, 0.08, 0.013))
for s in (-1, 1): m.part('cyl', WOOD, loc=G(s * 1.9, 0.9, 5), size=(0.05, 0.05, 0.9), seg=6)
m.part('box', CANVAS2, loc=G(0, 1.75, 5), size=(1.9, 0.02, 0.12))
objs.append(m.finish())

# ---- coconut toss: a coconut, a bucket (scaled per distance in code), the throwing line, and a pile of spares
m = Model('bg_coconut')
m.part('rock', COCO, loc=G(0, 0, 0), size=(0.1, 0.09, 0.1), sub=2, amp=0.008, freq=8)
objs.append(m.finish())
m = Model('bg_bucket')
m.part('cyl', PAIL_B, loc=G(0, 0.22, 0), size=(0.32, 0.32, 0.22), seg=12, top=1.25)
m.part('torus', METAL, loc=G(0, 0.44, 0), size=(0.4, 0.4, 0.4), tube=0.05, seg=16, ring=4)
m.part('cyl', WETS, loc=G(0, 0.36, 0), size=(0.37, 0.37, 0.01), seg=12)
objs.append(m.finish())
m = Model('bg_coco_pile')
for i, (x, z, y) in enumerate(((0, 0, 0.09), (0.18, 0.05, 0.09), (0.08, 0.17, 0.09), (0.09, 0.07, 0.24))):
    m.part('rock', COCO, loc=G(x, y, z), size=(0.1, 0.09, 0.1), sub=2, amp=0.008, freq=8, seed=i)
m.part('box', LINE, loc=G(0.0, 0.012, -0.6), size=(1.4, 0.05, 0.012))
objs.append(m.finish())

# ---- sandcastles: a plot (raked sand inside a rope), and the pieces players stack on its 3x3 grid
m = Model('bg_plot')
m.part('box', SAND, loc=G(0, 0.02, 0), size=(1.5, 1.5, 0.02))
for (x, z) in ((-1.6, -1.6), (1.6, -1.6), (1.6, 1.6), (-1.6, 1.6)): m.part('cyl', WOODD, loc=G(x, 0.18, z), size=(0.03, 0.03, 0.18), seg=5)
m.part('sweep', ROPE, points=[G(-1.6, 0.3, -1.6), G(1.6, 0.3, -1.6), G(1.6, 0.3, 1.6), G(-1.6, 0.3, 1.6)], r=0.01, ring=4, closed=True)
objs.append(m.finish())
m = Model('bg_tower')  # a round tower with crenellations, 0.5 m tall
m.part('cyl', SAND, loc=G(0, 0.25, 0), size=(0.22, 0.22, 0.25), seg=10, top=0.85, amp=0.01, freq=9)
for i in range(6):
    a = i / 6 * math.tau
    m.part('box', SAND, loc=G(math.cos(a) * 0.17, 0.53, math.sin(a) * 0.17), size=(0.04, 0.04, 0.04))
objs.append(m.finish())
m = Model('bg_wall')
m.part('box', SAND, loc=G(0, 0.15, 0), size=(0.45, 0.12, 0.15), amp=0.01, freq=8)
for i in range(4): m.part('box', SAND, loc=G(-0.33 + i * 0.22, 0.33, 0), size=(0.05, 0.1, 0.04))
objs.append(m.finish())
m = Model('bg_keep')  # a bucket-shaped mound
m.part('cyl', WETS, loc=G(0, 0.2, 0), size=(0.36, 0.36, 0.2), seg=12, top=0.7, amp=0.012, freq=7)
objs.append(m.finish())
m = Model('bg_moat')
m.part('torus', WETS, loc=G(0, 0.0, 0), size=(0.36, 0.36, 0.36), tube=0.18, seg=16, ring=5)
objs.append(m.finish())
m = Model('bg_flag')
m.part('cyl', WOODD, loc=G(0, 0.3, 0), size=(0.01, 0.01, 0.3), seg=4)
m.part('poly', CORAL, loc=G(0.0, 0.5, 0), points=[(0, 0), (0.2, 0.05), (0, 0.1)], depth=0.008)
objs.append(m.finish())
m = Model('bg_shells')
for i in range(5):
    a = i / 5 * math.tau
    m.part('rock', SHELLC, loc=G(math.cos(a) * 0.14, 0.02, math.sin(a) * 0.14), size=(0.05, 0.035, 0.02), sub=1, rot=(0, 0, i * 40))
objs.append(m.finish())
m = Model('bg_pail')  # the decorative spade-and-pail by each plot
m.part('cyl', PAIL_R, loc=G(0, 0.13, 0), size=(0.14, 0.14, 0.13), seg=10, top=1.25)
m.part('sweep', METAL, points=[G(-0.17, 0.26, 0), G(0, 0.42, 0), G(0.17, 0.26, 0)], r=0.008, ring=4)
m.part('box', PAIL_Y, loc=G(0.3, 0.02, 0.05), size=(0.05, 0.12, 0.012))
m.part('cyl', PAIL_Y, loc=G(0.3, 0.02, 0.27), size=(0.012, 0.012, 0.12), rot=(90, 0, 0), seg=4)
objs.append(m.finish())

# ---- cannonball: a diving tower (4 m platform with a ladder and a springboard lip)
m = Model('bg_dive_tower')
for (x, z) in ((-0.8, -0.8), (0.8, -0.8), (0.8, 0.8), (-0.8, 0.8)): m.part('cyl', WOODD, loc=G(x, 1.6, z), size=(0.09, 0.09, 2.3), seg=6)
for y in (1.2, 2.6):
    for (x, z, sx, sz) in ((0, -0.8, 0.8, 0.04), (0, 0.8, 0.8, 0.04), (-0.8, 0, 0.04, 0.8), (0.8, 0, 0.04, 0.8)):
        m.part('box', WOOD, loc=G(x, y, z), size=(sx, sz, 0.04))
m.part('box', WOOD, loc=G(0, 3.9, 0.2), size=(0.95, 1.15, 0.06))  # the platform (y = 3.96 top)
m.part('box', TEAL, loc=G(0, 3.97, 1.45), size=(0.35, 0.3, 0.03))  # the springboard lip
for s in (-1, 1):
    m.part('cyl', METAL, loc=G(s * 0.9, 4.4, -0.3), size=(0.025, 0.025, 0.45), seg=5)
    m.part('cyl', METAL, loc=G(s * 0.9, 4.85, 0.2), size=(0.025, 0.025, 0.5), seg=5, rot=(90, 0, 0))
for s in (-1, 1): m.part('cyl', METAL, loc=G(s * 0.28, 2.0, -0.95), size=(0.025, 0.025, 2.0), seg=5)
for k in range(9): m.part('cyl', METAL, loc=G(0, 0.3 + k * 0.42, -0.95), size=(0.02, 0.02, 0.28), seg=4, rot=(0, 90, 0))
m.part('box', CORAL, loc=G(0, 4.4, -0.85), size=(0.6, 0.02, 0.15))
objs.append(m.finish())

# ---- a hammock between two posts
m = Model('bg_hammock')
for s in (-1, 1): m.part('cyl', WOODD, loc=G(s * 1.5, 0.75, 0), size=(0.07, 0.07, 0.75), seg=6)
pts = [G(-1.45, 1.15, 0)] + [G(-1.1 + i * 0.275, 0.62 - math.sin(i / 8 * math.pi) * 0.12, 0) for i in range(9)] + [G(1.45, 1.15, 0)]
m.part('sweep', CANVAS, points=pts, r=0.42, ring=8, squash=0.08)
for s in (-1, 1): m.part('sweep', ROPE, points=[G(s * 1.45, 1.15, 0), G(s * 1.1, 0.68, 0.3)], r=0.012, ring=4)
for s in (-1, 1): m.part('sweep', ROPE, points=[G(s * 1.45, 1.15, 0), G(s * 1.1, 0.68, -0.3)], r=0.012, ring=4)
m.part('sweep', CANVAS2, points=[G(-1.0 + i * 0.25, 0.6 - math.sin((i + 0.5) / 8 * math.pi) * 0.12, 0.0) for i in range(9)], r=0.12, ring=6, squash=0.1)
objs.append(m.finish())

export(objs, OUT, spacing=3)
