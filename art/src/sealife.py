# Open Waters (v1.15): scenery whales and dolphins (never caught, never clicked).
#   python3 art/src/sealife.py      -> art/sealife.blend + art/sealife.glb
#   node scripts/glb-to-js.mjs art/sealife.glb src/data/sealifeMesh.js SEALIFE
# Game axes here: x to the animal's right, y up, z forward (its nose). Each animal is two nodes: the body (origin
# mid-body) and the tail (origin at the tail root, so the code can beat it up and down, and lift the fluke to dive).
import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
import bpy, bmesh
from kit import Model, mat, reset, export

OUT = os.path.join(os.path.dirname(__file__), '..', 'sealife')
G = lambda x, y, z: (x, -z, y)
reset()
HB = mat('humpback_back', '#2c3138', 0.55)
HW = mat('humpback_white', '#d9dde0', 0.6)
HK = mat('humpback_knobs', '#3f454c', 0.8)
BW = mat('blue_back', '#56708a', 0.5)
BM = mat('blue_mottle', '#7d93a8', 0.6)
DG = mat('dolphin_grey', '#6d7a86', 0.35)
DL = mat('dolphin_light', '#c9d1d6', 0.4)
EYE = mat('eye', '#101214', 0.2)

def body(md, m_top, m_belly, pts, belly_split=0.0, ring=10, squash=0.82):
    """A tapered body: sweep rings, then colour the underside."""
    zs = [p[0] for p in pts]; rs = [p[1] for p in pts]; ys = [p[2] if len(p) > 2 else 0.0 for p in pts]
    md.part('sweep', m_top, points=[G(0, y, z) for z, y in zip(zs, ys)], r=rs, ring=ring, squash=squash)
    idx = md._slot(m_belly)
    for f in md.bm.faces:
        if f.material_index == md._slot(m_top) and f.calc_center_median().z < belly_split and f.normal.z < -0.25:
            f.material_index = idx
    return md

def flat(md, m, outline, y=0.0, th=0.06):
    """A flat fin lying in the x-z plane (outline is [(x, z)]), th thick."""
    bm = md.bm
    top = [bm.verts.new(G(x, y + th / 2, z)) for x, z in outline]
    bot = [bm.verts.new(G(x, y - th / 2, z)) for x, z in outline]
    faces = [bm.faces.new(top), bm.faces.new(bot[::-1])]
    n = len(outline)
    for i in range(n): faces.append(bm.faces.new((top[i], bot[i], bot[(i + 1) % n], top[(i + 1) % n])))
    idx = md._slot(m)
    for f in faces: f.material_index = idx; f.smooth = False
    return md

def upright(md, m, outline, x=0.0, th=0.06):
    """A flat fin standing up in the y-z plane (outline is [(z, y)])."""
    bm = md.bm
    a = [bm.verts.new(G(x - th / 2, y, z)) for z, y in outline]
    b = [bm.verts.new(G(x + th / 2, y, z)) for z, y in outline]
    faces = [bm.faces.new(a), bm.faces.new(b[::-1])]
    n = len(outline)
    for i in range(n): faces.append(bm.faces.new((a[i], b[i], b[(i + 1) % n], a[(i + 1) % n])))
    idx = md._slot(m)
    for f in faces: f.material_index = idx; f.smooth = False
    return md

# ------------------------------------------------------------------ humpback (about 14 m)
hb = Model('humpback_body')
body(hb, HB, HW, [(6.6, 0.25, -0.15), (6.0, 0.9, -0.05), (4.6, 1.45, 0.05), (2.5, 1.7, 0.1), (0.0, 1.6, 0.08), (-2.4, 1.25, 0.05), (-4.2, 0.8, 0.05), (-5.4, 0.5, 0.06)], belly_split=-0.2, ring=12)
for s in (-1, 1):  # the long white flippers, swept back
    flat(hb, HW, [(s * 1.2, 3.6), (s * 3.2, 2.4), (s * 4.9, 0.6), (s * 5.1, 0.2), (s * 3.0, 1.6), (s * 1.3, 2.6)], y=-0.75, th=0.14)
upright(hb, HB, [(-2.6, 1.0), (-3.4, 1.55), (-3.8, 0.95)], th=0.14)  # the small hump and fin
for k in range(6):  # knobs on the head
    hb.part('rock', HK, loc=G((k % 2 - 0.5) * 0.7, 0.85, 5.6 - k * 0.45), size=(0.16, 0.16, 0.12), sub=1)
for s in (-1, 1): hb.part('rock', EYE, loc=G(s * 1.05, -0.2, 4.9), size=(0.1, 0.1, 0.1), sub=1)
hb_b = hb.finish()
ht = Model('humpback_tail')
body(ht, HB, HW, [(0.2, 0.55, 0.0), (-1.2, 0.36, 0.0), (-2.4, 0.2, 0.0)], belly_split=-0.15, ring=10, squash=0.7)
flat(ht, HB, [(0, -2.2), (1.4, -2.5), (3.1, -3.3), (2.4, -3.75), (1.2, -3.5), (0, -3.05), (-1.2, -3.5), (-2.4, -3.75), (-3.1, -3.3), (-1.4, -2.5)], th=0.12)
for f in ht.bm.faces:  # the underside of the fluke is pale
    if f.normal.z < -0.5 and f.calc_center_median().y < -2.4: f.material_index = ht._slot(HW)
ht_b = ht.finish()

# ------------------------------------------------------------------ blue whale (about 24 m, slender)
bw = Model('bluewhale_body')
body(bw, BW, BM, [(11.0, 0.3, -0.1), (10.2, 1.05, 0.0), (8.0, 1.6, 0.05), (4.0, 1.9, 0.08), (0.0, 1.85, 0.06), (-4.0, 1.5, 0.04), (-7.2, 1.0, 0.04), (-9.2, 0.6, 0.05)], belly_split=-0.3, ring=12)
for s in (-1, 1): flat(bw, BW, [(s * 1.4, 5.8), (s * 2.6, 5.1), (s * 3.0, 4.2), (s * 1.5, 4.9)], y=-0.9, th=0.12)
upright(bw, BW, [(-6.0, 1.0), (-6.9, 1.38), (-7.2, 0.9)], th=0.1)
for s in (-1, 1): bw.part('rock', EYE, loc=G(s * 1.25, -0.25, 8.6), size=(0.11, 0.11, 0.11), sub=1)
bw_b = bw.finish()
bt = Model('bluewhale_tail')
body(bt, BW, BM, [(0.2, 0.62, 0.0), (-1.6, 0.4, 0.0), (-3.0, 0.22, 0.0)], belly_split=-0.15, ring=10, squash=0.7)
flat(bt, BW, [(0, -2.8), (1.5, -3.1), (3.4, -3.7), (2.8, -4.1), (0, -3.6), (-2.8, -4.1), (-3.4, -3.7), (-1.5, -3.1)], th=0.12)
bt_b = bt.finish()

# ------------------------------------------------------------------ bottlenose dolphin (about 2.6 m)
dp = Model('dolphin_body')
body(dp, DG, DL, [(1.35, 0.06, -0.04), (1.12, 0.1, -0.03), (0.95, 0.2, 0.0), (0.7, 0.28, 0.03), (0.2, 0.32, 0.03), (-0.35, 0.26, 0.02), (-0.75, 0.16, 0.02)], belly_split=-0.05, ring=10)
upright(dp, DG, [(-0.05, 0.22), (-0.35, 0.62), (-0.42, 0.6), (-0.5, 0.2)], th=0.04)
for s in (-1, 1): flat(dp, DG, [(s * 0.2, 0.55), (s * 0.55, 0.32), (s * 0.58, 0.24), (s * 0.24, 0.38)], y=-0.17, th=0.035)
for s in (-1, 1): dp.part('rock', EYE, loc=G(s * 0.2, 0.04, 0.88), size=(0.025, 0.025, 0.025), sub=1)
dp_b = dp.finish()
dt = Model('dolphin_tail')
body(dt, DG, DL, [(0.05, 0.15, 0.0), (-0.3, 0.09, 0.0), (-0.5, 0.05, 0.0)], belly_split=-0.04, ring=8, squash=0.75)
flat(dt, DG, [(0, -0.45), (0.25, -0.5), (0.42, -0.66), (0.32, -0.72), (0, -0.6), (-0.32, -0.72), (-0.42, -0.66), (-0.25, -0.5)], th=0.03)
dt_b = dt.finish()

export([hb_b, ht_b, bw_b, bt_b, dp_b, dt_b], OUT, spacing=26)
