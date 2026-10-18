# Builds Reel Time's plants (v1.13.13 foliage uplift): art/foliage.blend (one object per model) and
# art/_build/foliage.json, which scripts/foliage-to-js.mjs turns into src/data/foliageMesh.js.
#   python3 art/src/foliage.py            (needs bpy: pip install bpy)   or, inside Blender: exec(open(path).read())
#
# Detail lives in a texture atlas the game paints in code (src/world/foliageAtlas.js): bark, leaf clusters with veins,
# needle sprays, grass blades, fern fronds, petals, lily pads. The geometry is cheap: tapered trunks and branches,
# and alpha-cut cards (crossed quads, strips) that carry the painted leaves.
# Every model is a list of GRID parts like the fish (art/src/fish.py): rows x cols of vertices, each with a position,
# a tint (multiplied with the texture; darker inside canopies) and a UV inside one atlas region.
# Model space: y up, standing on y = 0, about game units (a pine is ~4.5 tall). Blender gets (x, -z, y).
import math, json, os, sys, random

try:
    import bpy, bmesh
    HAVE_BPY = True
except ImportError:
    HAVE_BPY = False

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.getcwd()
ART = os.path.dirname(HERE)
OUT_JSON = os.path.join(ART, '_build', 'foliage.json')
OUT_BLEND = os.path.join(ART, 'foliage.blend')

# ------------------------------------------------------------------------------------------------ math
def lerp(a, b, t): return a + (b - a) * t
def clamp(v, a=0.0, b=1.0): return max(a, min(b, v))
def v_add(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def v_sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def v_mul(a, s): return (a[0] * s, a[1] * s, a[2] * s)
def v_len(a): return math.sqrt(a[0] ** 2 + a[1] ** 2 + a[2] ** 2)
def v_norm(a):
    l = v_len(a) or 1.0
    return (a[0] / l, a[1] / l, a[2] / l)
def v_cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def v_lerp(a, b, t): return (lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t))
def hexrgb(h):
    h = h.lstrip('#'); return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255)
def rgbhex(c): return '#%02x%02x%02x' % tuple(int(round(clamp(x) * 255)) for x in c)
def mixc(a, b, t): return (lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t))
def shade(k): return (k, k, k)  # a grey tint: 1 = the texture as painted

# ------------------------------------------------------------------------------------------------ grids
class Grid:
    def __init__(self, name, region, pts, uvs, tints, wrap=False, cap1=False):
        self.name, self.region, self.pts, self.uvs, self.tints = name, region, pts, uvs, tints
        self.wrap, self.cap1 = wrap, cap1
        self.rows, self.cols = len(pts), len(pts[0])

class Model:
    def __init__(self, name): self.name, self.grids = name, []
    def add(self, g): self.grids.append(g); return g

def frame(t):
    """Two unit vectors at right angles to direction t."""
    t = v_norm(t); ref = (0, 1, 0) if abs(t[1]) < 0.92 else (1, 0, 0)
    n1 = v_norm(v_cross(t, ref)); n2 = v_norm(v_cross(t, n1))
    return n1, n2

def tube(m, name, region, pts, radii, ring=7, tint=(1, 1, 1), tint_top=None, vrep=1.0, cap=True):
    """A tapered tube along pts (trunks, branches, stems). UVs: u around, v along (vrep times up the region)."""
    rows, uvs, tints = [], [], []
    N = len(pts); acc = [0.0]
    for i in range(1, N): acc.append(acc[-1] + v_len(v_sub(pts[i], pts[i - 1])))
    total = acc[-1] or 1
    for i, p in enumerate(pts):
        t = v_sub(pts[min(i + 1, N - 1)], pts[max(i - 1, 0)])
        n1, n2 = frame(t)
        r = radii[i] if len(radii) == N else lerp(radii[0], radii[-1], i / (N - 1))
        row, urow, trow = [], [], []
        for j in range(ring + 1):  # one extra column: the UV seam
            a = j / ring * math.tau
            row.append(v_add(p, v_add(v_mul(n1, math.cos(a) * r), v_mul(n2, math.sin(a) * r))))
            urow.append((j / ring, min(1.0, acc[i] / total * vrep)))
            trow.append(mixc(tint, tint_top, i / (N - 1)) if tint_top else tint)
        rows.append(row); uvs.append(urow); tints.append(trow)
    m.add(Grid(name, region, rows, uvs, tints, wrap=False, cap1=cap))

def card(m, name, region, center, right, up, w, h, tint=(1, 1, 1), bend=0.0, segs=1, tint_bottom=None, uv=(0, 0, 1, 1)):
    """A textured quad (optionally a curved strip): centre at the bottom edge middle, growing along `up`."""
    rows, uvs, tints = [], [], []
    rn, un = v_norm(right), v_norm(up)
    for i in range(segs + 1):
        v = i / segs
        droop = (0, -bend * v * v, 0)
        base = v_add(v_add(center, v_mul(un, h * v)), droop)
        row, urow, trow = [], [], []
        for j in range(2):
            u = j
            row.append(v_add(base, v_mul(rn, (u - 0.5) * w)))
            urow.append((lerp(uv[0], uv[2], u), lerp(uv[1], uv[3], v)))
            trow.append(mixc(tint_bottom, tint, v) if tint_bottom else tint)
        rows.append(row); uvs.append(urow); tints.append(trow)
    m.add(Grid(name, region, rows, uvs, tints))

def clump(m, region, c, size, rnd, tint, n=3, tilt=0.0, inner=0.86):
    """A leaf clump: n crossed cards through one centre, each a little turned and tilted, darker toward the middle."""
    a0 = rnd.random() * math.pi
    for k in range(n):
        a = a0 + k * math.pi / n
        right = (math.cos(a), 0, math.sin(a))
        tip = 0.5 if k == 0 else tilt * (rnd.random() - 0.5)  # the first card leans well back, so the clump reads from above too
        up = v_norm((math.sin(a) * tip, 1, -math.cos(a) * tip))
        bottom = v_add(c, v_mul(up, -size * 0.5))
        card(m, 'leaves', region, bottom, right, up, size * (0.9 + rnd.random() * 0.25), size, tint=tint, tint_bottom=v_mul(tint, inner))

# ------------------------------------------------------------------------------------------------ trees
def branch_path(start, direction, length, rise, segs=4, curl=0.0):
    pts = [start]
    d = v_norm(direction)
    for i in range(1, segs + 1):
        t = i / segs
        p = v_add(start, v_mul(d, length * t))
        p = (p[0] + curl * t * t * d[2], p[1] + rise * math.sin(t * math.pi / 2) * length, p[2] - curl * t * t * d[0])
        pts.append(p)
    return pts

def pine(name, seed, snow=False, height=4.6):
    m = Model(name); rnd = random.Random(seed)
    trunk = [(0, y, 0) for y in (0.0, 0.5, 1.2, 2.0, 2.9, 3.7, height * 0.98)]
    tube(m, 'trunk', 'bark_pine', [trunk[0], trunk[2], trunk[4], trunk[6]], [0.2, 0.14, 0.09, 0.02], ring=5, vrep=1.0)
    tiers = 8
    for i in range(tiers):
        t = i / (tiers - 1)
        y = 0.9 + t * (height - 1.1)
        reach = lerp(1.75, 0.45, t ** 0.85) * (0.9 + rnd.random() * 0.2)
        n = 7 if t < 0.6 else 6 if t < 0.85 else 4
        a0 = rnd.random() * math.tau
        for k in range(n):
            a = a0 + k * math.tau / n + (rnd.random() - 0.5) * 0.4
            out = (math.cos(a), 0, math.sin(a))
            # a needle spray: a strip from the trunk out and down, wide in the middle, bending under its own weight
            up = v_norm((out[0], 0.42 - t * 0.25, out[2]))
            right = (-out[2], 0, out[0])
            tint = mixc((1.0, 1.04, 1.0), (1.18, 1.18, 1.1), t) if not snow else (1.12, 1.12, 1.14)
            card(m, 'needles', 'needles_snow' if snow else 'needles', (0, y + 0.05, 0), right, up, reach * 1.05, reach, tint=tint, tint_bottom=v_mul(tint, 0.85), bend=0.42 * reach, segs=2)
        for k in range(n if i % 2 == 0 else 0):  # an inner ring on every other tier, shorter and steeper, filling the gaps
            a = a0 + (k + 0.5) * math.tau / n
            out = (math.cos(a), 0, math.sin(a))
            card(m, 'needles', 'needles_snow' if snow else 'needles', (0, y + 0.18, 0), (-out[2], 0, out[0]), v_norm((out[0], 0.8, out[2])), reach * 0.7, reach * 0.62,
                 tint=mixc((0.92, 0.96, 0.92), (1.15, 1.15, 1.08), t), tint_bottom=shade(0.8), bend=0.12 * reach, segs=1)
    # the top: a small upright spray
    for k in range(3):
        a = k * math.tau / 3
        card(m, 'needles', 'needles_snow' if snow else 'needles', (0, height - 0.75, 0), (math.cos(a), 0, math.sin(a)), (0, 1, 0), 0.5, 0.85, tint=(1.05, 1.05, 1.0))
    return m

def broadleaf(name, seed, kind='oak', height=3.6):
    """Oak, autumn and apple trees: a trunk splitting into boughs, leaf clumps at the bough ends and along them."""
    m = Model(name); rnd = random.Random(seed)
    region = {'oak': 'leaf_oak', 'autumn': 'leaf_autumn', 'apple': 'leaf_apple'}[kind]
    th = height * (0.42 if kind != 'apple' else 0.34)
    trunk = [(0, 0, 0), (0.02, th * 0.4, 0.01), (-0.03, th * 0.8, 0.02), (0.0, th, 0.0)]
    tube(m, 'trunk', 'bark_oak', trunk, [0.26, 0.2, 0.17, 0.15], ring=6)
    # roots flare
    for k in range(4):
        a = k * math.tau / 4 + 0.4
        tube(m, 'root', 'bark_oak', [(math.cos(a) * 0.05, 0.25, math.sin(a) * 0.05), (math.cos(a) * 0.32, 0.02, math.sin(a) * 0.32)], [0.1, 0.04], ring=3, cap=False)
    boughs = 4 if kind != 'apple' else 5
    tips = []
    for k in range(boughs):
        a = k * math.tau / boughs + rnd.random() * 0.6
        out = (math.cos(a), 0, math.sin(a))
        L = height * (0.38 + rnd.random() * 0.12) * (1.15 if kind == 'apple' else 1)
        rise = 0.75 if kind != 'apple' else 0.5
        pts = branch_path((0, th * 0.92, 0), (out[0], 0.9, out[2]), L, rise * 0.3, segs=3, curl=0.15 * (rnd.random() - 0.5))
        tube(m, 'bough', 'bark_oak', pts, [0.12, 0.08, 0.05, 0.03], ring=4)
        tips.append(pts[-1]); tips.append(v_lerp(pts[1], pts[2], 0.5))
        # a side twig
        mid = pts[2]; side = (-out[2], 0.6, out[0]) if k % 2 else (out[2], 0.6, -out[0])
        tw = branch_path(mid, side, L * 0.45, 0.2, segs=2)
        tube(m, 'twig', 'bark_oak', tw, [0.04, 0.025, 0.012], ring=3)
        tips.append(tw[-1])
    tips.append((0, height * 0.92, 0))
    # canopy: clumps at the tips plus a few to fill the dome
    crown_c = (0, height * 0.68, 0); R = height * 0.36
    for k in range(9):
        a = rnd.random() * math.tau; e = rnd.random() * 0.9 - 0.2
        tips.append(v_add(crown_c, (math.cos(a) * R * math.cos(e) * 0.85, math.sin(e) * R * 0.75, math.sin(a) * R * math.cos(e) * 0.85)))
    for p in tips:
        d = v_len(v_sub(p, crown_c)) / R  # outer clumps brighter
        size = height * (0.36 if kind != 'apple' else 0.32) * (0.85 + rnd.random() * 0.3)
        k = 0.86 + 0.26 * clamp(d) + 0.12 * clamp((p[1] - crown_c[1]) / R)
        clump(m, region, p, size * 1.12, rnd, shade(k), n=2, tilt=0.6)
    return m

def birch(name, seed, height=4.4):
    m = Model(name); rnd = random.Random(seed)
    stems = 2 if seed % 2 else 1
    for s in range(stems):
        lean = (0.18 * (s - 0.5) * 2 if stems > 1 else 0.06, 0, 0.05 * (rnd.random() - 0.5))
        pts = [(lean[0] * y / height + (s - 0.5) * 0.18 * (stems > 1), y, lean[2] * y / height) for y in (0, 0.9, 1.8, 2.7, 3.5, height)]
        tube(m, 'trunk', 'bark_birch', [pts[0], pts[2], pts[4], pts[5]], [0.12, 0.085, 0.05, 0.02], ring=6, vrep=1.0)
        top = pts[-1]
        for k in range(7 if stems == 1 else 4):
            y = lerp(1.9, height - 0.2, k / 6)
            a = rnd.random() * math.tau
            base = (lean[0] * y / height + (s - 0.5) * 0.18 * (stems > 1), y, lean[2] * y / height)
            out = (math.cos(a), 0.0, math.sin(a))
            tw = branch_path(base, (out[0], 0.5, out[2]), 0.7 + rnd.random() * 0.5, -0.25, segs=2)
            tube(m, 'twig', 'bark_birch', tw, [0.025, 0.015, 0.008], ring=4, cap=False)
            clump(m, 'leaf_birch', tw[-1], 0.85 + rnd.random() * 0.3, rnd, shade(0.85 + 0.25 * (k / 8)), n=2, tilt=0.4)
        clump(m, 'leaf_birch', top, 0.9, rnd, shade(1.1), n=3)
    return m

def willow(name, seed, height=4.2):
    m = Model(name); rnd = random.Random(seed)
    trunk = [(0, 0, 0), (0.1, 1.0, 0.05), (0.05, 2.0, -0.05), (0, 2.6, 0)]
    tube(m, 'trunk', 'bark_oak', trunk, [0.32, 0.24, 0.2, 0.16], ring=6)
    for k in range(7):
        a = k * math.tau / 7 + rnd.random() * 0.4
        out = (math.cos(a), 0, math.sin(a))
        pts = branch_path((0, 2.4, 0), (out[0], 0.9, out[2]), 1.8 + rnd.random() * 0.4, 0.15, segs=4)
        pts = [(p[0], p[1] - 0.6 * (i / 4) ** 2, p[2]) for i, p in enumerate(pts)]  # arching over
        tube(m, 'bough', 'bark_oak', pts, [0.1, 0.07, 0.05, 0.03, 0.015], ring=4)
        # hanging curtains: strips falling from points along the bough
        for j in (2, 3, 4):
            p = pts[j]
            drop = 1.6 + 0.9 * (j / 4) + rnd.random() * 0.5
            for q in range(2):
                ang = a + (q - 0.5) * 0.9 + rnd.random() * 0.3
                right = (math.cos(ang + math.pi / 2), 0, math.sin(ang + math.pi / 2))
                card(m, 'curtain', 'leaf_willow', v_add(p, (0, 0.05, 0)), right, (0, -1, 0), 0.6, drop, tint=shade(0.95), tint_bottom=shade(1.12), segs=3)
        clump(m, 'leaf_willow_top', pts[2], 1.0, rnd, shade(0.9), n=2)
    return m

# ------------------------------------------------------------------------------------------------ small plants
def bush(name, seed, berries=None):
    m = Model(name); rnd = random.Random(seed)
    region = 'leaf_bush' if not berries else 'leaf_bush_' + berries
    for k in range(7):
        a = k * math.tau / 7 + rnd.random() * 0.5
        r = 0.25 + rnd.random() * 0.2
        c = (math.cos(a) * r, 0.45 + rnd.random() * 0.25, math.sin(a) * r)
        clump(m, region, c, 0.8 + rnd.random() * 0.25, rnd, shade(0.8 + 0.3 * rnd.random()), n=2, tilt=0.5, inner=0.6)
    clump(m, region, (0, 0.75, 0), 0.9, rnd, shade(1.1), n=3)
    return m

def fern(name, seed, fronds=8, size=1.0):
    m = Model(name); rnd = random.Random(seed)
    for k in range(fronds):
        a = k * math.tau / fronds + (rnd.random() - 0.5) * 0.4
        out = (math.cos(a), 0, math.sin(a))
        L = size * (0.8 + rnd.random() * 0.3)
        up = v_norm((out[0] * 0.75, 0.9, out[2] * 0.75))
        right = (-out[2], 0, out[0])
        card(m, 'frond', 'fern', (0, 0.02, 0), right, up, L * 0.46, L, tint=shade(1.1), tint_bottom=shade(0.8), bend=0.38 * L, segs=4)
    return m

def grass(name, seed):
    m = Model(name); rnd = random.Random(seed)
    for k in range(3):
        a = k * math.pi / 3 + rnd.random() * 0.3
        card(m, 'blades', 'grass', (0, 0, 0), (math.cos(a), 0, math.sin(a)), (0.05 * (rnd.random() - 0.5), 1, 0.05 * (rnd.random() - 0.5)), 0.5, 0.3 + rnd.random() * 0.08, tint=shade(1.15), tint_bottom=shade(0.85), bend=0.03)
    return m

def reeds(name, seed, cattail=False):
    m = Model(name); rnd = random.Random(seed)
    for k in range(3):
        a = k * math.pi / 3 + rnd.random() * 0.4
        card(m, 'reeds', 'reeds', (0, 0, 0), (math.cos(a), 0, math.sin(a)), (0, 1, 0), 0.8, 1.35 + rnd.random() * 0.25, tint=shade(1.08), tint_bottom=shade(0.82), segs=2, bend=0.06)
    if cattail:
        for k in range(4):
            x, z = (rnd.random() - 0.5) * 0.4, (rnd.random() - 0.5) * 0.4
            h = 1.3 + rnd.random() * 0.35
            tube(m, 'stalk', 'stem', [(x, 0, z), (x * 1.1, h * 0.6, z * 1.1), (x * 1.15, h, z * 1.15)], [0.016, 0.013, 0.01], ring=4, cap=False)
            tube(m, 'head', 'cattail', [(x * 1.15, h - 0.02, z * 1.15), (x * 1.15, h + 0.24, z * 1.15)], [0.04, 0.035], ring=6)
            tube(m, 'spike', 'stem', [(x * 1.15, h + 0.24, z * 1.15), (x * 1.15, h + 0.36, z * 1.15)], [0.008, 0.002], ring=3)
    return m

def flowers(name, seed, region):
    m = Model(name); rnd = random.Random(seed)
    for k in range(2):
        a = k * math.pi / 2 + rnd.random() * 0.4
        card(m, 'flowers', region, (0, 0, 0), (math.cos(a), 0, math.sin(a)), (0, 1, 0), 0.75, 0.6, tint=shade(1.15), tint_bottom=shade(0.85))
    return m

def mushroom(name, seed, cap_region='shroom_red'):
    m = Model(name); rnd = random.Random(seed)
    for k in range(3 if seed % 2 else 2):
        x, z = (rnd.random() - 0.5) * 0.3, (rnd.random() - 0.5) * 0.3
        h = 0.14 + rnd.random() * 0.12; r = 0.07 + rnd.random() * 0.06
        tube(m, 'stem', 'shroom_stem', [(x, 0, z), (x, h, z)], [r * 0.45, r * 0.35], ring=5, cap=False)
        # the cap: a lathe from the rim up to the crown, UV v from rim (0) to crown (1)
        rows, uvs, tints = [], [], []
        prof = [(1.0, -0.1), (1.0, 0.08), (0.75, 0.36), (0.38, 0.52), (0.0, 0.58)]
        for i, (pr, py) in enumerate(prof):
            row, urow, trow = [], [], []
            for j in range(8):
                a = j / 7 * math.tau
                row.append((x + math.cos(a) * pr * r, h + py * r, z + math.sin(a) * pr * r))
                urow.append((j / 7, i / (len(prof) - 1)))
                trow.append(shade(0.8 + 0.25 * i / 4))
            rows.append(row); uvs.append(urow); tints.append(trow)
        m.add(Grid('cap', cap_region, rows, uvs, tints))
    return m

def lilypad(name, seed, bloom=False):
    m = Model(name); rnd = random.Random(seed)
    # a round pad with a notch: rows from the centre out, cols around the gap
    rows, uvs, tints = [], [], []
    gap = 0.35
    for i in range(4):
        rr = i / 3
        row, urow, trow = [], [], []
        for j in range(17):
            a = gap / 2 + (math.tau - gap) * j / 16
            wob = 1 + 0.03 * math.sin(a * 5 + seed)
            x, z = math.cos(a) * rr * 0.42 * wob, math.sin(a) * rr * 0.42 * wob
            row.append((x, 0.01 + 0.015 * rr * rr, z))
            urow.append((0.5 + math.cos(a) * rr * 0.5, 0.5 + math.sin(a) * rr * 0.5))
            trow.append(shade(0.9 + 0.12 * rr))
        rows.append(row); uvs.append(urow); tints.append(trow)
    m.add(Grid('pad', 'lilypad', rows, uvs, tints))
    if bloom:
        for ring_i, (n, lift, w, h) in enumerate(((7, 0.25, 0.13, 0.17), (5, 0.55, 0.1, 0.14))):
            for k in range(n):
                a = k * math.tau / n + ring_i * 0.4
                out = (math.cos(a), 0, math.sin(a))
                up = v_norm((out[0] * (1 - lift), 0.6 + lift, out[2] * (1 - lift)))
                card(m, 'petal', 'petal', (out[0] * 0.03, 0.03, out[2] * 0.03), (-out[2], 0, out[0]), up, w, h, tint=shade(1.0), tint_bottom=shade(0.85), bend=-0.02)
        tube(m, 'centre', 'pollen', [(0, 0.02, 0), (0, 0.07, 0)], [0.035, 0.03], ring=6)
    return m

MODELS = []
def build_all():
    out = []
    for i in range(3): out.append(pine('pine%d' % i, 11 + i, height=4.3 + i * 0.35))
    for i in range(3): out.append(pine('pine%d_snow' % i, 11 + i, snow=True, height=4.3 + i * 0.35))
    for i in range(3): out.append(broadleaf('oak%d' % i, 21 + i, 'oak', 3.5 + i * 0.25))
    for i in range(3): out.append(broadleaf('autumn%d' % i, 31 + i, 'autumn', 3.4 + i * 0.2))
    for i in range(2): out.append(broadleaf('apple%d' % i, 41 + i, 'apple', 3.0 + i * 0.25))
    for i in range(2): out.append(birch('birch%d' % i, 51 + i, 4.2 + i * 0.4))
    out.append(willow('willow0', 61))
    for i in range(3): out.append(bush('bush%d' % i, 71 + i))
    for b in ('red', 'purple', 'orange'): out.append(bush('bush_' + b, 81, b))
    out.append(fern('fern0', 91)); out.append(fern('fern_giant', 92, fronds=11, size=1.8))
    for i in range(2): out.append(grass('grass%d' % i, 101 + i))
    out.append(reeds('reeds0', 111)); out.append(reeds('cattails0', 112, cattail=True))
    for i, c in enumerate(('yellow', 'pink', 'violet', 'white', 'orange')): out.append(flowers('flowers_' + c, 121 + i, 'flower_' + c))
    out.append(mushroom('shroom_red', 131, 'shroom_red')); out.append(mushroom('shroom_brown', 132, 'shroom_brown'))
    out.append(lilypad('lilypad0', 141)); out.append(lilypad('lilypad_bloom', 142, bloom=True))
    return out

# ------------------------------------------------------------------------------------------------ output
ALPHA = ''.join(chr(c) for c in range(35, 127) if chr(c) != '\\')
def enc_deltas(ds):
    out = []
    for d in ds:
        if -44 <= d <= 44: out.append(ALPHA[d + 44])
        else: v = d + 4096; out.append('~' + ALPHA[v // 91] + ALPHA[v % 91])
    return ''.join(out)

def to_json(models):
    data = {}
    for mdl in models:
        allp = [p for g in mdl.grids for row in g.pts for p in row]
        mn = [min(p[k] for p in allp) for k in range(3)]; mx = [max(p[k] for p in allp) for k in range(3)]
        span = max(mx[k] - mn[k] for k in range(3)) or 1
        Q = 4095 / span
        pal, index = [], {}
        def idx(c):
            k = tuple(int(round(clamp(x / 1.25) * 63)) for x in c)  # tints up to 1.25 (brighter than painted)
            if k not in index: index[k] = len(pal); pal.append(rgbhex(tuple(v / 63 for v in k)))
            return index[k]
        parts = []
        for g in mdl.grids:
            pos = [int(round((p[k] - mn[k]) * Q)) for row in g.pts for p in row for k in range(3)]
            part = {'n': g.name, 'g': g.region, 'r': g.rows, 'c': g.cols,
                    'p': enc_deltas([pos[i] - (pos[i - 3] if i >= 3 else 0) for i in range(len(pos))]),
                    'k': ''.join(ALPHA[idx(c)] for row in g.tints for c in row),
                    't': ''.join(ALPHA[int(round(clamp(u) * 90))] + ALPHA[int(round(clamp(v) * 90))] for row in g.uvs for (u, v) in row)}
            if g.cap1: part['c1'] = 1
            parts.append(part)
        data[mdl.name] = {'min': [round(v, 4) for v in mn], 'q': round(1 / Q, 7), 'pal': pal, 'parts': parts}
    return data

def to_blender(models):
    if not HAVE_BPY: return
    # its own scene, so an open Blender session keeps everything else it has; re-running replaces only this collection
    scene = bpy.data.scenes.get('Reel Time Foliage') or bpy.data.scenes.new('Reel Time Foliage')
    coll = bpy.data.collections.get('ReelTimeFoliage') or bpy.data.collections.new('ReelTimeFoliage')
    if coll.name not in scene.collection.children: scene.collection.children.link(coll)
    for o in list(coll.objects): bpy.data.objects.remove(o, do_unlink=True)
    if bpy.context.window: bpy.context.window.scene = scene
    mat = bpy.data.materials.get('foliage') or bpy.data.materials.new('foliage')
    for n, mdl in enumerate(models):
        old_me = bpy.data.meshes.get(mdl.name)
        if old_me and old_me.users == 0: bpy.data.meshes.remove(old_me)
        bm = bmesh.new(); cl = bm.loops.layers.color.new('Col'); uvl = bm.loops.layers.uv.new('UVMap')
        for g in mdl.grids:
            V = [[bm.verts.new((p[0], -p[2], p[1])) for p in row] for row in g.pts]
            for i in range(g.rows - 1):
                for j in range(g.cols - 1):
                    q = [(i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j)]
                    try: f = bm.faces.new([V[a][b] for a, b in q])
                    except ValueError: continue
                    f.smooth = True
                    for loop, (a, b) in zip(f.loops, q):
                        loop[cl] = (*g.tints[a][b], 1.0); loop[uvl].uv = g.uvs[a][b]
        me = bpy.data.meshes.new(mdl.name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
        ob = bpy.data.objects.new(mdl.name, me); coll.objects.link(ob); ob.location = ((n % 8) * 6, -(n // 8) * 6, 0)

def main():
    models = build_all()
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    data = to_json(models)
    with open(OUT_JSON, 'w') as fh: json.dump(data, fh, separators=(',', ':'))
    tris = {m.name: sum((g.rows - 1) * (g.cols - 1) * 2 for g in m.grids) for m in models}
    print('foliage.json: %d models, %d KB' % (len(data), os.path.getsize(OUT_JSON) // 1024))
    print(' '.join('%s:%d' % kv for kv in tris.items()))
    if HAVE_BPY:
        to_blender(models)
        if bpy.app.background: bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)

if __name__ == '__main__':
    main()
