# Frostmere (map 3): Skye Halloran's bush plane, the Snow Goose, plus both airbases (Frostpine Seaplane Base in the
# valley and the Hearthwick ice strip) and Frostmere's first scenery set.
#   python3 art/src/snowgoose.py      -> art/snowgoose.blend + art/snowgoose.glb
#   node scripts/glb-to-js.mjs art/snowgoose.glb src/data/snowgooseMesh.js SNOWGOOSE
# Game axes in this file: x starboard, y up, z toward the nose (G converts to Blender). Sizes passed to the kit are
# half extents in Blender order (game x, game z, game y).
#
# The plane: a red-and-cream high-wing single-engine bush plane on floats (they double as skis on the ice). Its origin
# is on the floats' keels, midships. The moving parts are separate nodes, each modelled about its own hinge at the
# origin (src/north/plane.js puts them back on the plane at the hinge points listed there):
#   sg_prop        spinner and three blades, spinning about z
#   sg_aileron_l/r hinge along x, the surface trailing back (-z)
#   sg_elevator    hinge along x, trailing back
#   sg_rudder      hinge along y, trailing back
import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
import bpy, bmesh
from mathutils import Vector
from kit import Model, mat, reset, export

OUT = os.path.join(os.path.dirname(__file__), '..', 'snowgoose')
G = lambda x, y, z: (x, -z, y)

reset()
RED = mat('sg_red', '#b3302a', 0.42)
CREAM = mat('sg_cream', '#efe7d2', 0.45)
DARK = mat('sg_dark', '#262a30', 0.6)
GLASS = mat('sg_glass', '#223442', 0.08)
ALU = mat('sg_alu', '#b9bec3', 0.3, 0.85)
BLACK = mat('sg_black', '#1d1f23', 0.55)
YELLOW = mat('sg_yellow', '#e8c030', 0.5)
SEAT = mat('sg_seat', '#6a4630', 0.8)
NAVR = mat('sg_nav_red', '#ff3a2a', 0.4, emit='#ff2a1a')
NAVG = mat('sg_nav_green', '#3aff6a', 0.4, emit='#1aff4a')
LAMPW = mat('sg_lamp', '#fff2c8', 0.3, emit='#ffe8a0')
TIRE = mat('sg_rubber', '#2a2a2a', 0.9)

def loft(md, m, secs, closed_ends=True, smooth=True):
    """secs: list of rings, each a list of game-space (x, y, z) points (same count). Quads between rings, fans at the ends."""
    bm = md.bm
    rings = [[bm.verts.new(G(*p)) for p in ring] for ring in secs]
    n = len(secs[0]); faces = []
    for a, b in zip(rings, rings[1:]):
        for j in range(n): faces.append(bm.faces.new((a[j], a[(j + 1) % n], b[(j + 1) % n], b[j])))
    if closed_ends:
        for ring, flip in ((rings[0], True), (rings[-1], False)):
            c = Vector((0, 0, 0))
            for v in ring: c += v.co
            cv = bm.verts.new(c / n)
            for j in range(n):
                f = (ring[j], ring[(j + 1) % n], cv) if not flip else (ring[(j + 1) % n], ring[j], cv)
                faces.append(bm.faces.new(f))
    idx = md._slot(m)
    for f in faces: f.material_index = idx; f.smooth = smooth
    return md

def rrect(w, ybot, ytop, r, n=20):
    """A rounded-rectangle cross-section (x, y) points, counter-clockwise from the right side."""
    pts = []; cy = (ybot + ytop) / 2; h = (ytop - ybot) / 2
    r = min(r, w * 0.95, h * 0.95)
    corners = [(w - r, ytop - r, 0), (-w + r, ytop - r, math.pi / 2), (-w + r, ybot + r, math.pi), (w - r, ybot + r, 1.5 * math.pi)]
    k = n // 4
    for cx_, cy_, a0 in corners:
        for i in range(k):
            a = a0 + i / (k - 1) * math.pi / 2
            pts.append((cx_ + r * math.cos(a), cy_ + r * math.sin(a)))
    return pts

def airfoil(chord, t, z_le, y0, n=14, camber=0.03):
    """Airfoil points (z, y) for a section whose leading edge is at z_le (it trails toward -z)."""
    pts = []
    for i in range(n):
        s = i / (n - 1); x = (1 - math.cos(s * math.pi)) / 2  # 0 at LE .. 1 at TE, clustered at the ends
        yt = 5 * t * (0.2969 * math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4)
        yc = camber * 4 * x * (1 - x)
        pts.append((z_le - x * chord, y0 + (yc + yt) * chord))
    for i in range(n - 2, 0, -1):
        s = i / (n - 1); x = (1 - math.cos(s * math.pi)) / 2
        yt = 5 * t * (0.2969 * math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4)
        yc = camber * 4 * x * (1 - x)
        pts.append((z_le - x * chord, y0 + (yc - yt) * chord))
    return pts

def wing_panel(md, m, xs, chord_at, z_le_at, y_at, t=0.15, trim=0.0):
    secs = []
    for x in xs:
        c = chord_at(x) - trim
        secs.append([(x, y, z) for z, y in airfoil(c, t * chord_at(x) / max(c, 0.1), z_le_at(x), y_at(x))])
    return loft(md, m, secs)

objs = []

# ------------------------------------------------------------------ the fuselage
FZ0, FZ1 = -5.7, 2.35  # tail, firewall
def fus_w(z):
    if z > -1.4: return 0.73 - max(0.0, z - 1.6) * 0.05
    return 0.73 + (0.17 - 0.73) * ((-1.4 - z) / (-1.4 - FZ0)) ** 1.1
def fus_bot(z): return 1.85 + max(0.0, (-1.3 - z) / (-1.3 - FZ0)) ** 1.3 * 1.28
def fus_top(z):
    if z > 1.9: return 3.55 - (z - 1.9) * 0.55
    return 3.56 - max(0.0, (-2.0 - z) / (-2.0 - FZ0)) * 0.2
def fus_r(z): return 0.22 if z > -1.4 else 0.12

md = Model('sg_body')
zs = [FZ0 + (FZ1 - FZ0) * (i / 26) for i in range(27)]
loft(md, RED, [[(x, y, z) for x, y in rrect(fus_w(z), fus_bot(z), fus_top(z), fus_r(z), 24)] for z in zs])
# the cowling and spinner mount: a round nose
cz = [2.33, 2.6, 2.9, 3.15, 3.3]
cr = [0.70, 0.72, 0.71, 0.66, 0.58]
loft(md, RED, [[(math.cos(a) * r, 2.66 + math.sin(a) * r * 0.97, z) for a in [i / 24 * math.tau for i in range(24)]] for z, r in zip(cz, cr)])
md.part('cyl', DARK, loc=G(0, 2.66, 3.31), size=(0.42, 0.42, 0.02), seg=24, rot=(90, 0, 0))  # the dark air intake inside the cowl lip
for i in range(9):  # cooling louvres along the cowl's flanks
    a = -0.7 + i * 0.17
    md.part('box', DARK, loc=G(math.cos(a) * 0.715, 2.66 + math.sin(a) * 0.70, 2.45), size=(0.01, 0.16, 0.025), rot=(0, 0, -math.degrees(a)))
# the cream cheat line and belly
for s in (-1, 1):
    pts = [(s * (fus_w(z) + 0.004), fus_bot(z) + (fus_top(z) - fus_bot(z)) * 0.32, z) for z in zs[2:]]
    md.part('sweep', CREAM, points=[G(*p) for p in pts], r=0.055, ring=6, squash=1.0)
loft(md, CREAM, [[(x, y, z) for x, y in rrect(fus_w(z) * 1.006, fus_bot(z) - 0.006, fus_bot(z) + 0.26, 0.2, 16)] for z in zs[3:24]])
# windows: windscreen, cabin sides, a little rear window
md.part('rbox', GLASS, loc=G(0, 3.24, 2.08), size=(0.62, 0.05, 0.27), r=0.03, rot=(-48, 0, 0))
for s in (-1, 1):
    for z0, z1 in ((1.45, 2.05), (0.35, 1.3), (-0.8, 0.2)):
        md.part('rbox', GLASS, loc=G(s * (fus_w((z0 + z1) / 2) + 0.005), 2.95, (z0 + z1) / 2), size=(0.012, (z1 - z0) / 2, 0.24), r=0.05)
    md.part('rbox', GLASS, loc=G(s * (fus_w(-1.55) + 0.003), 2.98, -1.55), size=(0.01, 0.22, 0.17), r=0.05)
    # the door outline and handle, a step plate
    md.part('box', DARK, loc=G(s * (fus_w(0.8) + 0.008), 2.45, 0.8), size=(0.005, 0.5, 0.012))
    md.part('box', DARK, loc=G(s * (fus_w(0.8) + 0.008), 2.45, 0.30), size=(0.005, 0.012, 0.62))
    md.part('box', ALU, loc=G(s * (fus_w(0.8) + 0.03), 2.6, 0.45), size=(0.02, 0.07, 0.02))
    md.part('rbox', ALU, loc=G(s * 0.88, 1.95, 0.9), size=(0.16, 0.12, 0.015), r=0.01)
# two seats seen through the windscreen
for s in (-0.32, 0.32):
    md.part('rbox', SEAT, loc=G(s, 2.35, 1.0), size=(0.22, 0.22, 0.08), r=0.04)
    md.part('rbox', SEAT, loc=G(s, 2.75, 0.8), size=(0.22, 0.06, 0.34), r=0.04, rot=(-12, 0, 0))
md.part('rbox', DARK, loc=G(0, 2.85, 1.85), size=(0.6, 0.18, 0.08), r=0.03)  # the instrument panel
# exhaust stacks, the oil cooler scoop, a whip antenna
md.part('cyl', ALU, loc=G(0.52, 2.15, 2.0), size=(0.07, 0.07, 0.32), seg=8, rot=(90, 0, 0))
md.part('rbox', DARK, loc=G(0, 1.98, 2.7), size=(0.28, 0.24, 0.1), r=0.06)
md.part('cyl', BLACK, loc=G(0, 3.95, -2.3), size=(0.012, 0.012, 0.4), seg=4, rot=(-12, 0, 0))
# a tail lamp
md.part('rock', LAMPW, loc=G(0, 3.3, FZ0 + 0.02), size=(0.05, 0.05, 0.05), sub=1)

# ------------------------------------------------------------------ the wing (fixed part)
WY = 3.58; WZLE = 1.4; ROOTC = 1.78; TIPC = 1.5; SPAN = 6.7
chord = lambda x: ROOTC + (TIPC - ROOTC) * max(0.0, (abs(x) - 0.8) / (SPAN - 0.8))
zle = lambda x: WZLE - max(0.0, (abs(x) - 0.8)) * 0.02
wy = lambda x: WY + max(0.0, abs(x) - 0.8) * 0.035  # a touch of dihedral
AIL = 0.44  # aileron and flap chord
for s in (-1, 1):
    xs_in = [s * 0.0, s * 0.8]
    wing_panel(md, RED, xs_in if s > 0 else xs_in[::-1], chord, zle, wy)
    xs = [s * (0.8 + (SPAN - 0.8) * i / 8) for i in range(9)]
    wing_panel(md, RED, xs if s > 0 else xs[::-1], chord, zle, wy, trim=AIL)
    # flaps (fixed, inboard): the trailing strip from x 0.8 to 3.6
    fx = [s * (0.85 + 2.7 * i / 3) for i in range(4)]
    secs = []
    for x in (fx if s > 0 else fx[::-1]):
        c = chord(x); z0 = zle(x) - (c - AIL) - 0.02
        secs.append([(x, y, z) for z, y in airfoil(AIL, 0.1, z0, wy(x) - 0.01, n=8, camber=0.0)])
    loft(md, CREAM, secs)
    # the wingtip: a rounded cream cap, with its nav light
    tx = s * (SPAN + 0.02)
    md.part('rbox', CREAM, loc=G(tx, wy(SPAN) + 0.03, zle(SPAN) - TIPC / 2), size=(0.05, TIPC / 2, 0.1), r=0.04)
    md.part('rock', NAVG if s > 0 else NAVR, loc=G(tx + s * 0.04, wy(SPAN) + 0.05, zle(SPAN) - 0.15), size=(0.06, 0.06, 0.06), sub=1)
    # the wing strut, root on the fuselage's lower side, out to the wing's underside
    md.part('sweep', ALU, points=[G(s * 0.72, 2.12, 0.65), G(s * 2.0, 2.9, 0.62), G(s * 3.35, 3.5, 0.58)], r=0.05, ring=6, squash=0.45)
    md.part('sweep', ALU, points=[G(s * 1.6, 2.65, 0.63), G(s * 1.75, 3.52, 0.62)], r=0.025, ring=5)  # jury strut
    # a cream band near the tip
    md.part('box', CREAM, loc=G(s * (SPAN - 0.75), wy(SPAN - 0.75) + 0.105, zle(SPAN) - chord(SPAN - 0.75) / 2 + 0.2), size=(0.18, (chord(SPAN) - AIL) / 2 - 0.05, 0.006))
# a landing light in the left wing's leading edge
md.part('rock', LAMPW, loc=G(-2.6, WY - 0.02, WZLE - 0.02), size=(0.08, 0.04, 0.05), sub=1)

# ------------------------------------------------------------------ the tail (fixed parts)
TZ = FZ0 + 0.35  # the stabiliser's hinge line
for s in (-1, 1):
    xs = [s * (0.12 + 2.0 * i / 4) for i in range(5)]
    secs = []
    for x in (xs if s > 0 else xs[::-1]):
        c = 1.0 - abs(x) * 0.12
        secs.append([(x, y, z) for z, y in airfoil(c, 0.09, TZ + c, 3.22, n=10, camber=0.0)])
    loft(md, RED, secs)
    md.part('sweep', ALU, points=[G(s * 0.15, 2.95, TZ + 0.5), G(s * 1.0, 3.2, TZ + 0.55)], r=0.018, ring=4)  # bracing wire
# the fin: a swept fin with a dorsal fillet (the rudder hinges at TZ - 0.05)
fin_pts = []
for i in range(6):
    t = i / 5; y = 3.2 + t * 1.85
    zl = TZ + 1.05 - t * 0.95; zt = TZ - 0.02
    fin_pts.append((y, zl, zt))
fin_secs = []
for y, zl, zt in fin_pts:
    c = max(0.2, zl - zt); ring = []
    for z, th in airfoil(c, 0.1, zl, 0.0, n=10, camber=0.0):
        ring.append((th, y, z))
    fin_secs.append(ring)
loft(md, RED, fin_secs)
md.part('sweep', RED, points=[G(0, 3.1, TZ + 2.6), G(0, 3.25, TZ + 1.6), G(0, 3.45, TZ + 0.9)], r=[0.03, 0.1, 0.14], ring=6, squash=1.0)  # dorsal fillet
md.part('rbox', CREAM, loc=G(0, 4.97, TZ + 0.12), size=(0.05, 0.18, 0.06), r=0.03)  # cream fin cap

# ------------------------------------------------------------------ the floats (they double as skis on the ice)
FX = 1.38
def float_secs():
    out = []
    zs_f = [-3.7 + 7.6 * i / 20 for i in range(21)]
    for z in zs_f:
        u = (z + 3.7) / 7.6
        top = 0.55 + (0.05 if u > 0.85 else 0) + (0.22 * ((u - 0.88) / 0.12) ** 2 if u > 0.88 else 0)
        bot = 0.02 + (0.32 * ((u - 0.86) / 0.14) ** 1.6 if u > 0.86 else 0) + (0.06 * (0.45 - u) / 0.45 if u < 0.45 else 0)
        w = 0.36 * (1 - max(0.0, (u - 0.8) / 0.2) ** 2 * 0.75) * (1 - max(0.0, (0.06 - u) / 0.06) * 0.5)
        out.append((z, w, bot, top))
    return out
for s in (-1, 1):
    secs = [[(s * FX + x, y, z) for x, y in rrect(max(w, 0.04), bot, max(top, bot + 0.05), 0.13, 16)] for z, w, bot, top in float_secs()]
    loft(md, CREAM, secs)
    # a red stripe along each float's top, bumpers, cleats and a water rudder
    md.part('sweep', RED, points=[G(s * FX, 0.57, z) for z in (-3.5, 0.0, 2.6)], r=0.045, ring=5, squash=0.5)
    md.part('rbox', DARK, loc=G(s * FX, 0.42, 3.42), size=(0.2, 0.06, 0.05), r=0.02)
    for z in (-2.8, 2.9): md.part('cyl', ALU, loc=G(s * FX, 0.6, z), size=(0.03, 0.03, 0.04), seg=6)
    md.part('box', DARK, loc=G(s * FX, 0.15, -3.75), size=(0.015, 0.14, 0.18))
    # the struts up to the fuselage: a V pair forward, a V pair aft, and a spreader bar between the floats
    for z in (1.5, -0.9):
        md.part('sweep', ALU, points=[G(s * FX, 0.55, z + 0.25), G(s * 0.55, 1.88, z)], r=0.045, ring=6, squash=0.5)
        md.part('sweep', ALU, points=[G(s * FX, 0.55, z - 0.25), G(s * 0.55, 1.88, z)], r=0.035, ring=6, squash=0.5)
for z in (1.5, -0.9):
    md.part('sweep', ALU, points=[G(-FX, 0.58, z), G(FX, 0.58, z)], r=0.035, ring=6)
objs.append(md.finish())

# ------------------------------------------------------------------ the moving parts (each about its own hinge)
md = Model('sg_prop')
md.part('cyl', RED, loc=G(0, 0, 0.1), size=(0.3, 0.3, 0.2), seg=20, top=0.82, rot=(90, 0, 0))
md.part('cyl', RED, loc=G(0, 0, 0.42), size=(0.245, 0.245, 0.14), seg=20, top=0.05, rot=(90, 0, 0))
for i in range(3):
    a = math.radians(i * 120)
    for k in range(6):  # each blade: segments that twist and taper toward the tip
        r0 = 0.26 + k * 0.17; r1 = r0 + 0.17; rc = (r0 + r1) / 2
        tw = 32 - k * 4.5; wdt = 0.13 - k * 0.012
        x, y = math.cos(a) * rc, math.sin(a) * rc
        md.part('rbox', BLACK if k < 5 else YELLOW, loc=G(x, y, 0.2), size=(0.085, 0.014, wdt), r=0.006, rot=(tw, -math.degrees(a), 0))
objs.append(md.finish())

def surface(name, m, span_x0, span_x1, chord_c, t=0.09, n=6):
    md = Model(name)
    xs = [span_x0 + (span_x1 - span_x0) * i / n for i in range(n + 1)]
    secs = [[(x, y, z) for z, y in airfoil(chord_c, t, 0.0, 0.0, n=8, camber=0.0)] for x in (xs if span_x1 > span_x0 else xs)]
    if span_x1 < span_x0: secs = secs[::-1]
    loft(md, m, secs)
    return md
objs.append(surface('sg_aileron_r', RED, 3.65, 6.62, AIL).finish())
objs.append(surface('sg_aileron_l', RED, -6.62, -3.65, AIL).finish())
md = Model('sg_elevator')
for s in (-1, 1):
    xs = [s * (0.12 + 2.05 * i / 4) for i in range(5)]
    secs = [[(x, y, z) for z, y in airfoil(0.48 - abs(x) * 0.05, 0.08, 0.0, 0.0, n=8, camber=0.0)] for x in (xs if s > 0 else xs[::-1])]
    loft(md, RED, secs)
objs.append(md.finish())
md = Model('sg_rudder')
secs = []
for i in range(6):
    y = -0.08 + i / 5 * 1.82
    c = 0.55 - abs(i - 2.5) * 0.04
    secs.append([(th, y, z) for z, th in airfoil(c, 0.09, 0.0, 0.0, n=8, camber=0.0)])
loft(md, RED, secs)
md.part('rbox', CREAM, loc=G(0, 1.55, -0.2), size=(0.05, 0.2, 0.15), r=0.02)  # a cream stripe on the rudder
objs.append(md.finish())

# ------------------------------------------------------------------ the airbases (Frostpine and Hearthwick)
TIMBER = mat('ab_timber', '#7a5236', 0.95)
TIMBERD = mat('ab_timber_dark', '#4e3322', 0.95)
ROOF = mat('ab_roof', '#5a6a74', 0.6, 0.4)
RUST = mat('ab_rust', '#8a4a30', 0.8)
SNOW = mat('ab_snow', '#f4f8fc', 0.7)
PLANK = mat('ab_plank', '#8a6a48', 0.95)
ORANGE = mat('ab_orange', '#ee6a24', 0.7)
WHITE = mat('ab_white', '#f2f0ea', 0.7)
WINDOW = mat('ab_window', '#ffd890', 0.4, emit='#e8a050')
DRUM = mat('ab_drum', '#2f6a4a', 0.6, 0.3)
SIGNP = mat('ab_sign', '#e9dcc0', 0.9)
SIGNR = mat('ab_sign_red', '#a8322c', 0.8)

def hangar(name, snowy):
    md = Model(name)
    W, D, H, R = 8.5, 7.0, 4.6, 2.4  # half width, half depth, wall height, roof rise
    for s in (-1, 1):  # side walls of logs
        for k in range(9): md.part('cyl', TIMBER if k % 2 else TIMBERD, loc=G(s * W, 0.25 + k * 0.5, 0), size=(0.26, 0.26, D), seg=8, rot=(90, 0, 0))
    for k in range(9): md.part('cyl', TIMBER if k % 2 else TIMBERD, loc=G(0, 0.25 + k * 0.5, -D), size=(0.26, 0.26, W), seg=8, rot=(0, 90, 0))
    # the gable at the back and the open front's header beam, the big sliding doors pushed aside
    md.part('poly', TIMBERD, loc=G(0, H, -D), points=[(-W, 0), (W, 0), (0, R)], depth=0.3)
    md.part('poly', TIMBERD, loc=G(0, H, D), points=[(-W, 0), (-W + 1.2, 0), (0, R - 0.5), (W - 1.2, 0), (W, 0), (0, R)], depth=0.3)
    md.part('box', TIMBERD, loc=G(0, H - 0.2, D), size=(W, 0.3, 0.25))
    for s in (-1, 1):
        md.part('box', TIMBER, loc=G(s * (W + 2.2), H / 2 - 0.1, D + 0.35), size=(2.1, 0.12, H / 2 - 0.1))
        for k in range(4): md.part('box', TIMBERD, loc=G(s * (W + 2.2), 0.4 + k * 1.2, D + 0.48), size=(2.15, 0.03, 0.06))
        md.part('box', ALU, loc=G(s * (W + 2.2), H, D + 0.3), size=(2.6, 0.06, 0.05))
    # the roof: two slopes of ribbed metal
    sl = math.atan2(R, W); L = math.hypot(W, R) + 0.6
    for s in (-1, 1):
        cx_, cy_ = s * W / 2, H + R / 2
        md.part('box', ROOF, loc=G(cx_, cy_ + 0.05, 0), size=(L / 2, D + 0.6, 0.06), rot=(0, s * math.degrees(sl), 0))
        for k in range(10):
            md.part('box', ROOF, loc=G(cx_, cy_ + 0.11, -D + 0.3 + k * (2 * D) / 9.5), size=(L / 2, 0.03, 0.03), rot=(0, s * math.degrees(sl), 0))
        if snowy: md.part('rbox', SNOW, loc=G(cx_ * 0.95, cy_ + 0.2, 0), size=(L / 2 - 0.2, D + 0.4, 0.12), r=0.1, rot=(0, s * math.degrees(sl), 0))
    # inside: a workbench, an engine stand, oil drums; outside: a lamp over the door and a windows row
    md.part('rbox', TIMBERD, loc=G(-W + 1.2, 0.9, -D + 2.5), size=(0.5, 2.2, 0.06), r=0.02)
    for z in (-D + 1.0, -D + 4.0): md.part('box', TIMBERD, loc=G(-W + 1.2, 0.45, z), size=(0.06, 0.06, 0.45))
    for k, (x, z) in enumerate(((W - 1.2, -D + 1.0), (W - 1.9, -D + 1.1), (W - 1.4, -D + 1.8))):
        md.part('cyl', DRUM if k != 1 else RUST, loc=G(x, 0.45, z), size=(0.3, 0.3, 0.45), seg=12)
    md.part('rock', WINDOW, loc=G(0, H + 0.5, D + 0.35), size=(0.2, 0.15, 0.14), sub=1)
    md.part('cyl', BLACK, loc=G(0, H + 0.75, D + 0.35), size=(0.32, 0.32, 0.05), seg=10, top=0.4)
    for s in (-1, 1):
        for k in range(3): md.part('rbox', WINDOW, loc=G(s * (W + 0.27), 2.4, -D + 2.0 + k * 2.6), size=(0.02, 0.6, 0.45), r=0.03)
    # the sign board over the door: painted plank (the lettering is drawn by plane.js on a canvas)
    md.part('rbox', SIGNP, loc=G(0, H + 1.45, D + 0.2), size=(2.6, 0.08, 0.42), r=0.04)
    md.part('rbox', SIGNR, loc=G(0, H + 1.45, D + 0.17), size=(2.75, 0.06, 0.5), r=0.05)
    return md.finish()
objs.append(hangar('ab_hangar', False))
objs.append(hangar('ab_hangar_snow', True))

md = Model('ab_dock')  # a float dock, 3 m wide, 16 long, along +z from the shore
for k in range(32): md.part('box', PLANK if k % 3 else TIMBER, loc=G(0, 0.62, 0.25 + k * 0.5), size=(1.5, 0.23, 0.04))
for s in (-1, 1):
    md.part('box', TIMBERD, loc=G(s * 1.45, 0.5, 8.0), size=(0.08, 8.0, 0.12))
    for z in (1.0, 5.0, 9.0, 13.0): md.part('cyl', TIRE, loc=G(s * 1.58, 0.45, z), size=(0.24, 0.24, 0.1), seg=12, rot=(0, 90, 0)); md.part('cyl', ALU, loc=G(s * 1.3, 0.72, z + 1.5), size=(0.05, 0.05, 0.06), seg=6)
    for z in (0.0, 16.0): md.part('cyl', TIMBERD, loc=G(s * 1.35, 0.4, z), size=(0.15, 0.15, 0.7), seg=8)
md.part('rbox', DRUM, loc=G(0, 0.25, 4.0), size=(1.2, 3.5, 0.25), r=0.1)  # the floats under the deck
md.part('rbox', DRUM, loc=G(0, 0.25, 12.0), size=(1.2, 3.5, 0.25), r=0.1)
objs.append(md.finish())

md = Model('ab_windsock_pole')
md.part('cyl', WHITE, loc=G(0, 3.0, 0), size=(0.07, 0.07, 3.0), seg=8)
md.part('cyl', ORANGE, loc=G(0, 1.4, 0), size=(0.075, 0.075, 0.3), seg=8)
md.part('cyl', ORANGE, loc=G(0, 3.2, 0), size=(0.075, 0.075, 0.3), seg=8)
md.part('torus', ALU, loc=G(0, 5.9, 0.2), size=(0.3, 0.3, 0.3), tube=0.12, seg=12, ring=4, rot=(90, 0, 0))
md.part('rbox', TIMBERD, loc=G(0, 0.15, 0), size=(0.5, 0.5, 0.15), r=0.04)
objs.append(md.finish())
md = Model('ab_windsock')  # hinged at the ring (origin); it streams out along +z, and plane.js swings it with the wind
for k in range(5):
    r0 = 0.3 - k * 0.04
    md.part('cyl', ORANGE if k % 2 == 0 else WHITE, loc=G(0, -k * 0.03, 0.2 + k * 0.42), size=(r0, r0, 0.21), seg=14, top=(r0 - 0.04) / r0, rot=(90, 0, 0))
objs.append(md.finish())

md = Model('ab_fuelshed')
md.part('rbox', TIMBER, loc=G(0, 1.1, 0), size=(1.3, 1.1, 1.1), r=0.04)
md.part('rbox', ROOF, loc=G(0, 2.35, 0), size=(1.55, 1.35, 0.08), r=0.03, rot=(8, 0, 0))
md.part('rbox', TIMBERD, loc=G(0, 0.9, 1.11), size=(0.45, 0.02, 0.8), r=0.02)
md.part('rbox', SIGNR, loc=G(0, 1.9, 1.13), size=(0.7, 0.02, 0.18), r=0.02)
for k, (x, z) in enumerate(((1.75, 0.5), (1.75, -0.2), (2.35, 0.15))):
    md.part('cyl', DRUM if k else SIGNR, loc=G(x, 0.45, z), size=(0.3, 0.3, 0.45), seg=12)
md.part('cyl', ALU, loc=G(-1.6, 0.6, 0.6), size=(0.06, 0.06, 0.6), seg=8)
md.part('rbox', SIGNR, loc=G(-1.6, 1.25, 0.6), size=(0.18, 0.14, 0.2), r=0.04)
objs.append(md.finish())

md = Model('ab_cone')
md.part('cyl', ORANGE, loc=G(0, 0.32, 0), size=(0.2, 0.2, 0.32), seg=10, top=0.12)
md.part('cyl', WHITE, loc=G(0, 0.38, 0), size=(0.13, 0.13, 0.06), seg=10)
md.part('box', ORANGE, loc=G(0, 0.02, 0), size=(0.26, 0.26, 0.02))
objs.append(md.finish())
md = Model('ab_striplamp')
md.part('cyl', BLACK, loc=G(0, 0.3, 0), size=(0.03, 0.03, 0.3), seg=6)
md.part('rock', LAMPW, loc=G(0, 0.65, 0), size=(0.08, 0.08, 0.08), sub=1)
md.part('cyl', BLACK, loc=G(0, 0.75, 0), size=(0.1, 0.1, 0.02), seg=8)
objs.append(md.finish())

# ------------------------------------------------------------------ Frostmere's first scenery set
BARK = mat('nf_bark', '#4a3626', 0.95)
NEEDLE = mat('nf_needle', '#2f6650', 0.95)
NEEDLE2 = mat('nf_needle_dark', '#26584a', 0.95)
SNOWT = mat('nf_snow', '#f2f6fb', 0.75)
ROCK = mat('nf_rock', '#7a7e86', 0.95)
ROCKD = mat('nf_rock_dark', '#5e626a', 0.95)
ICEB = mat('nf_ice', '#9fd4ea', 0.15)
ICED = mat('nf_ice_deep', '#5fa8d0', 0.12)
GRASS = mat('nf_grass', '#a89868', 0.95)

def spruce(name, h, seed):
    md = Model(name)
    md.part('cyl', BARK, loc=G(0, h * 0.2, 0), size=(0.16 * h / 6, 0.16 * h / 6, h * 0.2), seg=7, top=0.6)
    tiers = 6
    for k in range(tiers):
        t = k / (tiers - 1)
        y = h * (0.16 + 0.74 * t); r = h * (0.3 - 0.24 * t) + 0.15
        thick = h * 0.13 * (1 - 0.4 * t)
        md.part('cyl', NEEDLE if k % 2 else NEEDLE2, loc=G(0, y, 0), size=(r, r, thick), seg=9, top=0.18, amp=0.06 * r, freq=1.6, seed=seed + k)
        # snow lying on each tier: a flattened white cone a touch smaller, sitting on top
        md.part('cyl', SNOWT, loc=G(0, y + thick * 0.45, 0), size=(r * 0.86, r * 0.86, thick * 0.55), seg=9, top=0.1, amp=0.05 * r, freq=1.8, seed=seed + 20 + k)
    md.part('cyl', SNOWT, loc=G(0, h * 1.0, 0), size=(0.09, 0.09, h * 0.07), seg=6, top=0.1)
    return md.finish()
NEEDLE3 = mat('nf_needle_blue', '#2c4f52', 0.95)
NEEDLE4 = mat('nf_needle_olive', '#3c5a36', 0.95)
NEEDLE5 = mat('nf_needle_deep', '#1f4636', 0.95)
SNOWB = mat('nf_snow_blue', '#dfeaf4', 0.8)
import random as _rnd
def spruce2(name, h, seed, tiers=6, width=1.0, snow=1.0, wind=0.0, lean=0.0, broken=False, needles=(NEEDLE, NEEDLE2), clumps=4):
    """v1.17.1: a spruce with a ragged silhouette: tiers of branch clumps round a core cone, uneven, with snow lying on
    the clumps (snow 0 = a dusting, 1 = laden; wind piles it on one side), an optional lean and a broken top."""
    R = _rnd.Random(seed); md = Model(name)
    lx = lambda y: lean * y  # (lean along x)
    md.part('cyl', BARK, loc=G(lx(h * 0.2), h * 0.2, 0), size=(0.15 * h / 6 + 0.04, 0.15 * h / 6 + 0.04, h * 0.2), seg=7, top=0.6, rot=(0, math.degrees(lean) * -1, 0))
    top_t = 0.86 if broken else 1.0
    # v1.17.1b: one tree, not floating discs: a solid core cone runs the whole height, each tier is a skirt (a cone
    # sloping down and out) that reaches up under the tier above, so the branches overlap; clumps droop at the skirts'
    # edges and the snow lies on the skirts' upper slopes, not in flat plates
    y0 = h * 0.15; gap = h * 0.75 * top_t / max(1, tiers - 1)
    r0 = (h * 0.3 + 0.15) * width
    md.part('cyl', needles[1 % len(needles)], loc=G(lx((y0 + h * top_t) / 2), (y0 + h * top_t) / 2, 0), size=(r0 * 0.42, r0 * 0.42, (h * top_t - y0) / 2), seg=8, top=0.08, amp=0.05 * r0, freq=1.4, seed=seed + 3)
    for k in range(tiers):
        t = k / (tiers - 1) * top_t
        y = y0 + h * 0.75 * t; r = (h * (0.3 - 0.25 * t) + 0.15) * width * (0.9 + R.random() * 0.2)
        span = gap * 1.45 + h * 0.03  # (each skirt rises past the next tier's foot)
        nm = needles[k % len(needles)]
        md.part('cyl', nm, loc=G(lx(y + span / 2), y + span / 2, 0), size=(r, r, span / 2), seg=9, top=0.3, amp=0.07 * r, freq=1.7, seed=seed + k)
        n = clumps + 1 if t < 0.8 else 3
        for j in range(n):
            a = (j + R.random() * 0.6) / n * math.tau + k * 0.9; rr = r * (0.78 + R.random() * 0.14)
            cx, cz = lx(y) + math.cos(a) * rr, math.sin(a) * rr; cy = y + span * 0.08
            sz = r * (0.3 + R.random() * 0.12)
            md.part('rock', needles[(j + k) % len(needles)], loc=G(cx, cy, cz), size=(sz, sz, span * 0.28), sub=1, amp=0.1 * sz, freq=2.0, seed=seed * 7 + k * 13 + j)
        if snow > 0.15:
            sk = min(1.0, 0.45 + snow * 0.45)
            md.part('cyl', SNOWT, loc=G(lx(y + span * 0.62) + wind * r * 0.08, y + span * 0.62, 0), size=(r * 0.84 * sk, r * 0.84 * sk, span * 0.3), seg=9, top=0.32, amp=0.06 * r, freq=1.8, seed=seed + 20 + k)
            for j in range(n):
                a = (j + 0.3) / n * math.tau + k * 0.9; side = 1.0 + wind * math.cos(a)
                if snow * side > 0.5 and R.random() < 0.35 + snow * 0.3:
                    rr = r * 0.8; ss = r * 0.22 * min(1.3, snow * side)
                    md.part('rock', SNOWT if (j + k) % 3 else SNOWB, loc=G(lx(y) + math.cos(a) * rr, y + span * 0.22, math.sin(a) * rr), size=(ss, ss, span * 0.12), sub=1, amp=0.1 * ss, freq=2.2, seed=seed * 11 + k * 5 + j)
    if broken:
        md.part('cyl', BARK, loc=G(lx(h * 0.95), h * 0.95, 0), size=(0.07, 0.07, h * 0.07), seg=5, top=0.5)
    else:
        md.part('cyl', needles[0], loc=G(lx(h * 0.97), h * 0.97, 0), size=(0.22 * width, 0.22 * width, h * 0.06), seg=6, top=0.05)
        if snow > 0.4: md.part('cyl', SNOWT, loc=G(lx(h), h * 1.0, 0), size=(0.09, 0.09, h * 0.05), seg=6, top=0.1)
    return md.finish()
# ten spruce: laden, dusted, wind-blown, slender firs, broad old spruce, a leaner, a broken top, three colours of needle
objs += [spruce2('nf_spruce_a', 7.5, 1), spruce2('nf_spruce_b', 10.0, 7, tiers=8, needles=(NEEDLE2, NEEDLE5)), spruce2('nf_spruce_c', 5.2, 13, tiers=5, snow=1.2),
         spruce2('nf_spruce_d', 9.0, 21, tiers=8, width=0.62, snow=0.6, needles=(NEEDLE3, NEEDLE5)),
         spruce2('nf_spruce_e', 11.5, 29, tiers=9, width=1.15, snow=0.9, needles=(NEEDLE5, NEEDLE2), clumps=5),
         spruce2('nf_spruce_f', 6.5, 37, tiers=6, snow=0.35, needles=(NEEDLE4, NEEDLE)),
         spruce2('nf_spruce_g', 8.0, 43, tiers=7, snow=1.0, wind=0.9, needles=(NEEDLE, NEEDLE3)),
         spruce2('nf_spruce_h', 7.0, 51, tiers=7, width=0.8, lean=0.06, snow=0.8),
         spruce2('nf_spruce_i', 8.5, 59, tiers=7, broken=True, snow=0.7, needles=(NEEDLE2, NEEDLE4)),
         spruce2('nf_spruce_j', 3.4, 67, tiers=4, width=1.1, snow=1.3, needles=(NEEDLE, NEEDLE5))]
md = Model('nf_spruce_bare')  # a dead snag
md.part('cyl', BARK, loc=G(0, 2.8, 0), size=(0.18, 0.18, 2.8), seg=7, top=0.35, amp=0.03, freq=3, seed=4)
for k in range(5):
    a = k * 73.0; y = 2.0 + k * 0.7
    md.part('sweep', BARK, points=[G(0, y, 0), G(math.cos(math.radians(a)) * 0.9, y + 0.25, math.sin(math.radians(a)) * 0.9)], r=[0.06, 0.01], ring=4)
md.part('cyl', SNOWT, loc=G(0, 5.65, 0), size=(0.1, 0.1, 0.06), seg=6)
objs.append(md.finish())

def rock(name, sx, sy, sz, seed):
    md = Model(name)
    md.part('rock', ROCK if seed % 2 else ROCKD, loc=G(0, sy * 0.55, 0), size=(sx, sz, sy), sub=3, amp=0.18, freq=1.1, seed=seed)
    md.part('rock', SNOWT, loc=G(0, sy * 1.05, 0), size=(sx * 0.95, sz * 0.95, sy * 0.55), sub=3, amp=0.12, freq=1.3, seed=seed + 9)
    return md.finish()
objs += [rock('nf_rock_a', 1.2, 0.8, 1.0, 3), rock('nf_rock_b', 2.4, 1.5, 1.9, 6), rock('nf_rock_c', 0.6, 0.4, 0.55, 11)]
md = Model('nf_drift')
md.part('rock', SNOWT, loc=G(0, 0.0, 0), size=(2.4, 1.4, 0.55), sub=3, amp=0.15, freq=0.8, seed=21)
objs.append(md.finish())
md = Model('nf_ice_chunk')  # a slab of shoved-up lake ice (the pressure ridge, the floe edge)
md.part('rbox', ICEB, loc=G(0, 0.6, 0), size=(1.1, 0.25, 0.7), r=0.12, rot=(0, 0, 0), amp=0.05, freq=2, seed=2)
md.part('rbox', ICED, loc=G(0.2, 0.55, 0.05), size=(0.9, 0.2, 0.55), r=0.1)
md.part('rbox', SNOWT, loc=G(0, 1.25, 0), size=(1.0, 0.2, 0.06), r=0.05)
objs.append(md.finish())
md = Model('nf_ice_spire')
md.part('cyl', ICEB, loc=G(0, 1.5, 0), size=(0.55, 0.45, 1.5), seg=6, top=0.08, amp=0.06, freq=2, seed=5)
md.part('cyl', ICED, loc=G(0.3, 0.9, 0.2), size=(0.35, 0.3, 0.9), seg=6, top=0.1)
objs.append(md.finish())
md = Model('nf_grass')  # dry tundra grass poking up through the snow
for k in range(9):
    a = k * 40.0; r = 0.12 + (k % 3) * 0.05
    md.part('sweep', GRASS, points=[G(math.cos(math.radians(a)) * r * 0.3, 0, math.sin(math.radians(a)) * r * 0.3), G(math.cos(math.radians(a)) * r, 0.35 + (k % 2) * 0.15, math.sin(math.radians(a)) * r)], r=[0.02, 0.003], ring=3)
objs.append(md.finish())

export(objs, OUT)
