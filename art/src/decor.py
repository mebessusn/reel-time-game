# Builds art/decor.blend and art/decor.glb: the cottage furniture and wall pieces, one object each (decor_<id>).
#   python3 art/src/decor.py      (needs bpy: pip install bpy)
# Floor pieces stand on the origin with their footprint centred (sizes match MOVABLE in src/game/home.js). Wall
# pieces are centred on the origin with their back on the wall plane (Blender y = 0) and face Blender -Y.
# Material names the game treats specially: "glow" (lit, emissive), "fire" (stove window), "plaque_metal"
# (recoloured per lake plaque).
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import reset, mat, Model, ellipse, export
reset(); rnd = random.Random(11)
WOOD = lambda: mat('walnut', '#5a3a22', 0.7); IRON = lambda: mat('cast_iron', '#2a2a2e', 0.5, 0.75); BRASS = lambda: mat('brass', '#c8a040', 0.3, 0.9)

def rug():
    s = Model('decor_rug'); cols = [mat('braid_red', '#c8503a'), mat('braid_ochre', '#e8a050'), mat('braid_cream', '#f2e0b0'), mat('braid_teal', '#3f8a8a'), mat('braid_rust', '#a8442e')]
    order = [0, 1, 2, 0, 3, 2, 1, 4, 2, 0, 1, 2, 3, 0]
    s.part('rock', cols[2], (0, 0, 0.012), (0.55, 0.12, 0.012), sub=2)
    for k in range(1, 14):
        b = k * 0.108; a = b + 0.42; n = 28 + k * 3
        pts = [(a * math.cos(i / n * math.tau), b * math.sin(i / n * math.tau), 0.022) for i in range(n)]
        s.part('sweep', cols[order[k]], points=pts, r=0.056, closed=True, ring=4, squash=0.38)
    return s.finish()

def armchair():
    s = Model('decor_armchair'); fab = mat('chair_fabric', '#4a7a9a', 0.95); fab2 = mat('chair_cushion', '#5a8eb0', 0.95)
    btn = mat('chair_button', '#2a4a68', 0.6); throw = mat('throw_wool', '#e6d6b0'); stripe = mat('throw_stripe', '#c8503a'); pil = mat('pillow_mustard', '#e0a840')
    for x in (-0.56, 0.56):
        for y in (-0.48, 0.5): s.part('cyl', WOOD(), (x, y, 0.07), (0.04, 0.04, 0.07), seg=8, top=0.7)
    s.part('rbox', fab, (0, 0.02, 0.27), (0.68, 0.6, 0.13), r=0.05)
    s.part('rbox', fab2, (0, -0.06, 0.5), (0.46, 0.5, 0.09), r=0.07)
    s.part('rbox', fab, (0, 0.5, 0.86), (0.62, 0.13, 0.46), (-8, 0, 0), r=0.09)
    s.part('rbox', fab2, (0, 0.33, 0.86), (0.45, 0.07, 0.3), (-10, 0, 0), r=0.06)
    for x in (-0.25, 0, 0.25): s.part('rock', btn, (x, 0.26, 0.98), (0.018, 0.012, 0.018), sub=1)
    for sx in (-1, 1):
        s.part('rbox', fab, (sx * 0.58, 0.0, 0.5), (0.11, 0.58, 0.2), r=0.06)
        s.part('cyl', fab, (sx * 0.6, -0.02, 0.7), (0.13, 0.13, 0.58), (90, 0, 0), seg=12)
        s.part('cyl', fab2, (sx * 0.6, -0.61, 0.7), (0.1, 0.1, 0.012), (90, 0, 0), seg=12)
    s.part('rbox', throw, (0.62, -0.02, 0.84), (0.15, 0.32, 0.015), (0, 8, 0), r=0.012)
    s.part('rbox', throw, (0.74, -0.02, 0.62), (0.015, 0.32, 0.2), (0, 6, 0), r=0.012)
    for y in (-0.2, 0.16): s.part('box', stripe, (0.75, y, 0.62), (0.017, 0.035, 0.2), (0, 6, 0), smooth=False)
    s.part('rbox', pil, (-0.27, 0.26, 0.76), (0.2, 0.07, 0.17), (-18, 0, 22), r=0.07)
    return s.finish()

def lamp():
    s = Model('decor_lamp'); glow = mat('glow', '#ffd070', 0.4, emit='#f0a030'); iron = IRON()
    for i in range(3):
        a = i / 3 * math.tau + 0.5
        s.part('sweep', iron, points=[(0, 0, 0.18), (math.cos(a) * 0.12, math.sin(a) * 0.12, 0.08), (math.cos(a) * 0.22, math.sin(a) * 0.22, 0.02)], r=[0.025, 0.02, 0.018], ring=6)
        s.part('rock', iron, (math.cos(a) * 0.22, math.sin(a) * 0.22, 0.018), (0.03, 0.03, 0.018), sub=1)
    w = WOOD()
    for z0, z1, r in ((0.16, 0.3, 0.05), (0.3, 1.5, 0.028), (1.5, 1.6, 0.045), (1.6, 1.7, 0.03)):
        s.part('cyl', w, (0, 0, (z0 + z1) / 2), (r, r, (z1 - z0) / 2), seg=10)
    for z in (0.5, 0.9, 1.3): s.part('torus', w, (0, 0, z), (0.032, 0.032, 0.032), tube=0.35, seg=10, ring=4)
    s.part('cyl', iron, (0, 0, 1.73), (0.17, 0.17, 0.025), seg=8)
    for x in (-1, 1):
        for y in (-1, 1): s.part('box', iron, (x * 0.13, y * 0.13, 1.92), (0.014, 0.014, 0.17), smooth=False)
    s.part('cyl', glow, (0, 0, 1.92), (0.15, 0.15, 0.16), (0, 0, 45), seg=4, smooth=False)
    s.part('cyl', iron, (0, 0, 2.11), (0.19, 0.19, 0.025), (0, 0, 45), seg=4, smooth=False)
    s.part('cyl', iron, (0, 0, 2.2), (0.18, 0.18, 0.08), (0, 0, 45), seg=4, top=0.25, smooth=False)
    s.part('torus', iron, (0, 0, 2.33), (0.05, 0.05, 0.05), (90, 0, 0), tube=0.2, seg=10, ring=4)
    return s.finish()

def plant():
    s = Model('decor_plant'); pot = mat('terracotta', '#b8603a', 0.85); pot2 = mat('terracotta_dark', '#9a4c2c', 0.85); soil = mat('soil', '#4a3424')
    fern = [mat('fern_leaf', '#4a9a4a', 0.7), mat('fern_leaf_light', '#62b05a', 0.7), mat('fern_leaf_dark', '#3a7a3c', 0.7)]
    s.part('cyl', pot, (0, 0, 0.22), (0.27, 0.27, 0.22), seg=16, top=1.2)
    s.part('torus', pot2, (0, 0, 0.45), (0.33, 0.33, 0.33), tube=0.13, seg=16, ring=5)
    s.part('cyl', pot2, (0, 0, 0.12), (0.255, 0.255, 0.02), seg=16)
    s.part('cyl', soil, (0, 0, 0.44), (0.29, 0.29, 0.015), seg=16)
    for i in range(14):
        a = i / 14 * math.tau + rnd.uniform(-0.15, 0.15); L = rnd.uniform(0.5, 0.78); up = rnd.uniform(0.35, 0.65)
        pts = []
        for k in range(7):
            t = k / 6; r = 0.03 + t * L; z = 0.46 + math.sin(t * math.pi * 0.85) * up * L - t * t * 0.12
            pts.append((math.cos(a) * r, math.sin(a) * r, z))
        s.part('sweep', fern[i % 3], points=pts, r=[0.012, 0.06, 0.085, 0.085, 0.07, 0.045, 0.004], ring=6, squash=0.18)
    for i in range(5):  # a few young fronds standing up in the middle
        a = i / 5 * math.tau
        s.part('sweep', fern[1], points=[(0, 0, 0.45), (math.cos(a) * 0.08, math.sin(a) * 0.08, 0.75), (math.cos(a) * 0.16, math.sin(a) * 0.16, 1.0), (math.cos(a) * 0.2, math.sin(a) * 0.2, 1.12)], r=[0.01, 0.05, 0.04, 0.003], ring=6, squash=0.3)
    return s.finish()

def shelf():  # front faces +X (it stands against the left wall); 0.5 deep, 1.8 wide, 2.6 tall
    s = Model('decor_shelf'); w = mat('shelf_oak', '#6a4024', 0.75); w2 = mat('shelf_oak_dark', '#583420', 0.75)
    pal = [mat(f'book_{i}', c, 0.8) for i, c in enumerate(('#c8503a', '#4a7ab0', '#e8b040', '#5a9a5a', '#9b59d0', '#2e4a6e', '#8a2e2e', '#d8c8a0'))]
    gold = mat('gilt', '#d8b050', 0.35, 0.8); jar = mat('glass_jar', '#a8d8c8', 0.15); pot = mat('terracotta', '#b8603a', 0.85); leaf = mat('fern_leaf', '#4a9a4a', 0.7)
    for y in (-0.88, 0.88): s.part('box', w, (0, y, 1.3), (0.25, 0.025, 1.3), smooth=False)
    s.part('box', w2, (-0.235, 0, 1.3), (0.015, 0.86, 1.28), smooth=False)
    s.part('box', w, (0.01, 0, 2.62), (0.27, 0.93, 0.03), smooth=False)
    s.part('box', w2, (0.03, 0, 2.56), (0.255, 0.92, 0.03), smooth=False)
    s.part('box', w2, (0.0, 0, 0.06), (0.25, 0.9, 0.06), smooth=False)
    s.part('box', w, (0.255, 0, 0.06), (0.01, 0.86, 0.045), smooth=False)
    levels = (0.14, 0.76, 1.38, 2.0)
    for z in levels: s.part('box', w, (0, 0, z), (0.24, 0.86, 0.018), smooth=False)
    for li, z in enumerate(levels):
        y = -0.84; top = 0.56
        while y < 0.82:
            if li == 1 and -0.2 < y < 0.25:  # a stack lying flat, a jar
                for k in range(4): s.part('box', pal[(k + 3) % 8], (0.02, 0.0, z + 0.04 + k * 0.05), (0.15, 0.13 - k * 0.012, 0.024), (0, 0, k * 7), smooth=False)
                s.part('cyl', jar, (0.06, 0.2, z + 0.12), (0.06, 0.06, 0.1), seg=10); s.part('cyl', w2, (0.06, 0.2, z + 0.23), (0.065, 0.065, 0.015), seg=10)
                y = 0.3; continue
            if li == 3 and y > 0.35:  # a little fern on the top shelf
                s.part('cyl', pot, (0.04, 0.55, z + 0.1), (0.1, 0.1, 0.09), seg=10, top=1.2)
                for k in range(7):
                    a = k / 7 * math.tau
                    s.part('sweep', leaf, points=[(0.04, 0.55, z + 0.18), (0.04 + math.cos(a) * 0.1, 0.55 + math.sin(a) * 0.1, z + 0.3), (0.04 + math.cos(a) * 0.2, 0.55 + math.sin(a) * 0.2, z + 0.26)], r=[0.01, 0.035, 0.003], ring=5, squash=0.25)
                break
            bw = rnd.uniform(0.022, 0.04); h = rnd.uniform(0.32, 0.5) * (0.95 if li else 0.9); d = rnd.uniform(0.15, 0.2); c = rnd.randrange(8)
            lean = 14 if rnd.random() < 0.08 else 0
            s.part('box', pal[c], (0.24 - d, y + bw, z + 0.018 + h / 2), (d, bw, h / 2), (lean, 0, 0), smooth=False)
            if rnd.random() < 0.4: s.part('box', gold, (0.245 - d + d, y + bw, z + 0.02 + h * 0.8), (0.004, bw * 0.8, 0.012), (lean, 0, 0), smooth=False)
            y += bw * 2 + 0.006 + (0.05 if lean else 0)
    # a wooden duck decoy on top
    duck = mat('decoy_paint', '#7a5a3a', 0.6); duck2 = mat('decoy_green', '#2e6a4a', 0.5)
    s.part('rock', duck, (0.02, -0.35, 2.73), (0.16, 0.08, 0.07), sub=2)
    s.part('rock', duck2, (0.13, -0.35, 2.84), (0.055, 0.045, 0.055), sub=2)
    s.part('cyl', mat('decoy_bill', '#e0a030', 0.5), (0.2, -0.35, 2.83), (0.02, 0.012, 0.03), (0, 90, 0), seg=6, top=0.6)
    return s.finish()

def stove():  # the fire door faces Blender +Y (the game's -Z, into the room from the side wall)
    s = Model('decor_stove'); iron = IRON(); fire = mat('fire', '#ff8030', 0.5, emit='#ff6010'); brass = BRASS(); copper = mat('copper', '#b86a3a', 0.3, 0.85)
    for x in (-0.42, 0.42):
        for y in (-0.32, 0.32): s.part('cyl', iron, (x, y, 0.08), (0.05, 0.05, 0.08), seg=8, top=1.6)
    s.part('rbox', iron, (0, 0, 0.21), (0.54, 0.44, 0.04), r=0.02)
    s.part('rbox', iron, (0, 0, 0.58), (0.48, 0.38, 0.36), r=0.05)
    s.part('rbox', iron, (0, 0, 0.97), (0.56, 0.46, 0.035), r=0.02)
    for x in (-0.36, 0.36):
        for z in (0.35, 0.58, 0.8): s.part('box', iron, (x, 0.0, z), (0.12, 0.395, 0.012), smooth=False)  # cast fins on the sides
    s.part('rbox', iron, (0, 0.39, 0.6), (0.3, 0.04, 0.22), r=0.03)
    s.part('box', fire, (0, 0.42, 0.62), (0.22, 0.02, 0.14), smooth=False)
    for x in (-0.11, 0, 0.11): s.part('box', iron, (x, 0.445, 0.62), (0.012, 0.012, 0.15), smooth=False)
    s.part('sweep', brass, points=[(0.22, 0.43, 0.68), (0.27, 0.48, 0.66), (0.27, 0.48, 0.56), (0.22, 0.43, 0.54)], r=0.014, ring=5)
    s.part('box', iron, (0, 0.39, 0.3), (0.26, 0.03, 0.045), smooth=False)
    s.part('rock', brass, (0, 0.43, 0.3), (0.025, 0.02, 0.025), sub=1)
    s.part('cyl', iron, (0, -0.15, 1.08), (0.15, 0.15, 0.08), seg=12)
    s.part('cyl', iron, (0, -0.15, 2.18), (0.11, 0.11, 1.08), seg=12)
    for z in (1.5, 2.3): s.part('torus', iron, (0, -0.15, z), (0.115, 0.115, 0.115), tube=0.12, seg=12, ring=4)
    s.part('cyl', brass, (0.14, -0.15, 1.6), (0.012, 0.012, 0.03), (0, 90, 0), seg=6)
    s.part('rock', copper, (0.25, 0.15, 1.13), (0.17, 0.17, 0.13), sub=2)
    s.part('cyl', copper, (0.25, 0.15, 1.27), (0.07, 0.07, 0.025), seg=10)
    s.part('rock', brass, (0.25, 0.15, 1.31), (0.025, 0.025, 0.02), sub=1)
    s.part('cyl', copper, (0.1, 0.24, 1.18), (0.025, 0.025, 0.1), (-50, -40, 0), seg=6, top=0.5)
    s.part('torus', iron, (0.25, 0.15, 1.24), (0.14, 0.14, 0.14), (90, 0, 0), tube=0.08, seg=12, ring=4, closed=False)
    return s.finish()

def painting():
    s = Model('decor_painting'); fr = mat('frame_wood', '#5a3a22', 0.6); gilt = mat('gilt', '#d8b050', 0.35, 0.8)
    for x, z, hw, hh in ((0, 0.55, 0.9, 0.05), (0, -0.55, 0.9, 0.05), (-0.85, 0, 0.05, 0.6), (0.85, 0, 0.05, 0.6)):
        s.part('rbox', fr, (x, -0.04, z), (hw, 0.04, hh), r=0.02, segs=1)
    for x, z, hw, hh in ((0, 0.495, 0.8, 0.008), (0, -0.495, 0.8, 0.008), (-0.795, 0, 0.008, 0.5), (0.795, 0, 0.008, 0.5)):
        s.part('box', gilt, (x, -0.075, z), (hw, 0.006, hh), smooth=False)
    L = lambda name, c: mat(name, c, 0.9)
    s.part('box', L('paint_sky', '#9ccbe8'), (0, -0.02, 0.0), (0.8, 0.01, 0.5), smooth=False)
    s.part('poly', L('paint_glow', '#f6e8c0'), (0, -0.032, 0), points=ellipse(0.8, 0.12, 20, 0, -0.02), depth=0.002)
    s.part('poly', L('paint_sun', '#fff0a0'), (0, -0.034, 0), points=ellipse(0.075, 0.075, 16, 0.45, 0.28), depth=0.002)
    s.part('poly', L('paint_far', '#8a98b8'), (0, -0.036, 0), points=[(-0.8, -0.05), (-0.62, 0.22), (-0.45, 0.08), (-0.25, 0.32), (-0.05, 0.1), (0.15, 0.2), (0.35, 0.02), (0.8, 0.12), (0.8, -0.1), (-0.8, -0.1)], depth=0.002)
    s.part('poly', L('paint_snow', '#f4f6fa'), (0, -0.038, 0), points=[(-0.31, 0.24), (-0.25, 0.32), (-0.19, 0.25), (-0.22, 0.22), (-0.26, 0.26), (-0.28, 0.22)], depth=0.002)
    s.part('poly', L('paint_hill', '#6aa060'), (0, -0.04, 0), points=[(-0.8, -0.08), (-0.55, 0.02), (-0.3, -0.04), (0.1, 0.0), (0.45, -0.06), (0.8, -0.02), (0.8, -0.14), (-0.8, -0.14)], depth=0.002)
    s.part('poly', L('paint_lake', '#4a8ac0'), (0, -0.042, 0), points=[(-0.8, -0.12), (0.8, -0.12), (0.8, -0.34), (-0.8, -0.34)], depth=0.002)
    for x, z, w in ((-0.4, -0.18, 0.18), (0.2, -0.22, 0.26), (-0.1, -0.28, 0.12), (0.55, -0.16, 0.1)):
        s.part('box', L('paint_shine', '#9ad0f0'), (x, -0.045, z), (w, 0.001, 0.006), smooth=False)
    tree = L('paint_pine', '#2e5a3a')
    for x, h in ((-0.72, 0.26), (-0.64, 0.2), (0.62, 0.3), (0.71, 0.22), (-0.56, 0.16)):
        s.part('poly', tree, (0, -0.046, 0), points=[(x - 0.05, -0.1), (x, -0.1 + h), (x + 0.05, -0.1)], depth=0.002)
    s.part('poly', L('paint_boat', '#c8503a'), (0, -0.048, 0), points=[(-0.08, -0.2), (0.08, -0.2), (0.06, -0.23), (-0.06, -0.23)], depth=0.002)
    s.part('poly', L('paint_sail', '#f2ead8'), (0, -0.05, 0), points=[(0.0, -0.19), (0.0, -0.05), (0.06, -0.19)], depth=0.002)
    s.part('poly', L('paint_grass', '#5a9a5a'), (0, -0.052, 0), points=[(-0.8, -0.38), (-0.4, -0.33), (0.0, -0.37), (0.4, -0.32), (0.8, -0.36), (0.8, -0.5), (-0.8, -0.5)], depth=0.002)
    return s.finish()

def banner():
    s = Model('decor_banner'); cloth = mat('banner_red', '#c8503a', 0.95); trim = mat('banner_gold', '#f2c040', 0.6); cream = mat('banner_cream', '#f2e0b0', 0.9)
    s.part('cyl', WOOD(), (0, -0.09, 0.66), (0.025, 0.025, 0.56), (0, 90, 0), seg=8)
    for sx in (-1, 1): s.part('rock', BRASS(), (sx * 0.58, -0.09, 0.66), (0.04, 0.04, 0.04), sub=2)
    s.part('sweep', mat('cord', '#d8c08a'), points=[(-0.4, -0.09, 0.67), (0, -0.02, 0.85), (0.4, -0.09, 0.67)], r=0.008, ring=4)
    s.part('rock', BRASS(), (0, -0.015, 0.85), (0.02, 0.02, 0.02), sub=1)
    out = [(-0.45, 0.64), (0.45, 0.64), (0.45, -0.7), (0.0, -0.46), (-0.45, -0.7)]
    s.part('poly', trim, (0, -0.07, 0), points=out, depth=0.02)
    s.part('poly', cloth, (0, -0.082, 0), points=[(-0.4, 0.62), (0.4, 0.62), (0.4, -0.6), (0.0, -0.39), (-0.4, -0.6)], depth=0.012)
    fish = [(-0.22, 0.12), (-0.12, 0.2), (0.02, 0.23), (0.14, 0.18), (0.2, 0.12), (0.14, 0.06), (0.02, 0.02), (-0.12, 0.04), (-0.22, 0.12), (-0.3, 0.2), (-0.3, 0.04)]
    s.part('poly', trim, (0, -0.092, 0.02), points=[fish[i] for i in (10, 0, 1, 2, 3, 4, 5, 6, 7, 0, 9)][1:] , depth=0.006)
    s.part('cyl', mat('banner_eye', '#2a1a10'), (0.11, -0.097, 0.165), (0.016, 0.016, 0.003), (90, 0, 0), seg=8)
    for z in (-0.14, -0.22):
        s.part('poly', cream, (0, -0.092, 0), points=[(-0.3, z), (-0.15, z + 0.03), (0.0, z), (0.15, z + 0.03), (0.3, z), (0.3, z - 0.025), (0.15, z + 0.005), (0.0, z - 0.025), (-0.15, z + 0.005), (-0.3, z - 0.025)], depth=0.006)
    for x in (-0.45, 0.45):
        s.part('cyl', trim, (x, -0.08, -0.79), (0.03, 0.03, 0.08), seg=8, top=0.3)
        s.part('rock', trim, (x, -0.08, -0.7), (0.025, 0.025, 0.025), sub=1)
    return s.finish()

def mount():  # the game hangs the fish in front at +0.15
    s = Model('decor_mount'); w = mat('mount_wood', '#6a4024', 0.6); w2 = mat('mount_wood_light', '#8a5a32', 0.6)
    s.part('poly', w, (0, -0.035, 0), points=ellipse(0.8, 0.45, 32), depth=0.07)
    s.part('poly', w2, (0, -0.08, 0), points=ellipse(0.7, 0.36, 32), depth=0.02)
    s.part('poly', w, (0, -0.094, 0), points=ellipse(0.66, 0.32, 32), depth=0.006)
    s.part('rbox', BRASS(), (0, -0.095, -0.37), (0.16, 0.008, 0.035), r=0.006, segs=1)
    for x in (-0.13, 0.13): s.part('rock', mat('screw', '#8a7a50', 0.4, 0.8), (x, -0.105, -0.37), (0.008, 0.005, 0.008), sub=1)
    s.part('cyl', BRASS(), (0, -0.1, 0.0), (0.02, 0.02, 0.04), (90, 0, 0), seg=8)
    return s.finish()

def plaque():
    s = Model('decor_plaque'); w = mat('plaque_wood', '#6a4024', 0.6); metal = mat('plaque_metal', '#f2c040', 0.3, 0.85)
    pts = [(-0.3, 0.2), (-0.25, 0.25), (0.25, 0.25), (0.3, 0.2), (0.3, -0.2), (0.25, -0.25), (-0.25, -0.25), (-0.3, -0.2)]
    s.part('poly', w, (0, -0.03, 0), points=pts, depth=0.06)
    s.part('poly', mat('plaque_wood_light', '#8a5a32', 0.6), (0, -0.065, 0), points=[(x * 0.85, z * 0.85) for x, z in pts], depth=0.012)
    s.part('poly', metal, (0, -0.075, 0.03), points=ellipse(0.17, 0.075, 18, 0.03, 0.0), depth=0.012)
    s.part('poly', metal, (0, -0.075, 0.03), points=[(-0.12, 0.0), (-0.24, 0.08), (-0.21, 0.0), (-0.24, -0.08)], depth=0.012)
    s.part('poly', metal, (0, -0.075, 0.03), points=[(-0.02, 0.06), (0.06, 0.12), (0.1, 0.06)], depth=0.012)
    s.part('cyl', mat('plaque_eye', '#2a1a10', 0.5), (0.13, -0.083, 0.05), (0.012, 0.012, 0.003), (90, 0, 0), seg=8)
    s.part('rbox', metal, (0, -0.072, -0.16), (0.12, 0.006, 0.025), r=0.006, segs=1)
    return s.finish()

def catbed():
    s = Model('decor_catbed'); bed = mat('bed_rose', '#c87a9a', 0.95); rim = mat('bed_rose_dark', '#b0607f', 0.95); pad = mat('bed_pad', '#f0d0dc', 0.95)
    fur = mat('cat_ginger', '#e89a4a', 0.95); fur2 = mat('cat_stripe', '#c06a2a', 0.95); white = mat('cat_white', '#f6efe4', 0.95); dark = mat('cat_dark', '#3a2418', 0.6); pink = mat('cat_pink', '#e8a0a0', 0.6)
    s.part('rock', bed, (0, 0, 0.07), (0.48, 0.38, 0.07), sub=2)
    s.part('sweep', rim, points=[(0.4 * math.cos(i / 28 * math.tau), 0.3 * math.sin(i / 28 * math.tau), 0.15) for i in range(28)], r=0.1, closed=True, ring=8)
    s.part('rock', pad, (0, 0, 0.15), (0.36, 0.26, 0.04), sub=2)
    # a ginger cat curled up asleep, head on its tail
    s.part('rock', fur, (-0.02, 0.02, 0.27), (0.24, 0.17, 0.11), (0, 0, 10), sub=2)
    s.part('rock', fur, (-0.14, 0.05, 0.27), (0.12, 0.13, 0.1), sub=2)
    for x in (-0.12, -0.03, 0.06):
        s.part('rock', fur2, (x, 0.04, 0.35), (0.025, 0.12, 0.03), (0, 0, 10), sub=1)
    s.part('rock', fur, (0.17, -0.08, 0.29), (0.1, 0.095, 0.085), (0, 0, -20), sub=2)
    s.part('rock', white, (0.24, -0.12, 0.27), (0.045, 0.04, 0.035), (0, 0, -20), sub=2)
    s.part('rock', pink, (0.275, -0.14, 0.285), (0.01, 0.008, 0.008), sub=1)
    for dx in (-0.05, 0.05):
        s.part('cyl', fur, (0.15 + dx, -0.06 + dx * 0.4, 0.38), (0.035, 0.022, 0.045), (0, 0, -20 + dx * 200), seg=4, top=0.0, smooth=False)
        s.part('box', dark, (0.22 + dx * 0.3, -0.155 + dx * 0.25, 0.31), (0.018, 0.004, 0.003), (0, 0, -20), smooth=False)
    s.part('sweep', fur, points=[(-0.22, 0.1, 0.22), (-0.24, -0.06, 0.21), (-0.1, -0.16, 0.2), (0.06, -0.18, 0.2), (0.16, -0.17, 0.21)], r=[0.04, 0.038, 0.036, 0.032, 0.02], ring=6)
    s.part('rock', white, (0.12, -0.17, 0.215), (0.04, 0.03, 0.022), sub=1)
    s.part('rock', white, (0.03, -0.15, 0.2), (0.04, 0.03, 0.022), sub=1)
    s.part('rock', fur2, (0.16, -0.17, 0.215), (0.022, 0.022, 0.02), sub=1)
    return s.finish()


def tank(big):  # the aquarium's cabinet, gravel, plants and hood; the glass stays in the game (see home.js)
    W = 3.6 if big else 2.6; s = Model('decor_tank2' if big else 'decor_tank')
    w = mat('cabinet_wood', '#5a3a22', 0.7); w2 = mat('cabinet_panel', '#6e4628', 0.7); gravel = [mat('gravel_sand', '#e8d4a0'), mat('gravel_tan', '#c8b080'), mat('gravel_grey', '#a8a49a')]
    weed = [mat('aqua_plant', '#4a9a4a', 0.6), mat('aqua_plant_red', '#b05a48', 0.6), mat('aqua_plant_light', '#7ac060', 0.6)]
    rock = mat('aqua_rock', '#7a7a80'); glow = mat('glow', '#ffd070', 0.4, emit='#f0a030'); chest = mat('chest_wood', '#8a5a2a', 0.7)
    hw = (W + 0.3) / 2
    s.part('box', w, (0, 0, 0.05), (hw - 0.03, 0.62, 0.05), smooth=False)
    s.part('rbox', w, (0, 0, 0.47), (hw, 0.65, 0.4), r=0.02, segs=1)
    s.part('rbox', w, (0, 0, 0.88), (hw + 0.03, 0.68, 0.025), r=0.015, segs=1)
    n = 3 if big else 2; dw = (W - 0.1) / n
    for i in range(n):
        x = -W / 2 + 0.05 + dw * (i + 0.5)
        s.part('rbox', w2, (x, -0.655, 0.47), (dw / 2 - 0.04, 0.012, 0.3), r=0.01, segs=1)
        s.part('rbox', w, (x, -0.67, 0.47), (dw / 2 - 0.12, 0.008, 0.22), r=0.01, segs=1)
        s.part('rock', BRASS(), (x + (dw / 2 - 0.12) * (1 if i % 2 else -1) * 0.8, -0.69, 0.5), (0.025, 0.02, 0.025), sub=1)
    s.part('box', gravel[0], (0, 0, 0.94), (W / 2 - 0.03, 0.47, 0.04), smooth=False)
    for i in range(int(W * 16)):
        x = rnd.uniform(-W / 2 + 0.08, W / 2 - 0.08); y = rnd.uniform(-0.42, 0.42)
        s.part('rock', gravel[i % 3], (x, y, 0.985), (0.035, 0.03, 0.02), (0, 0, rnd.random() * 180), sub=1, smooth=False)
    for x, sz in ((-W / 2 + 0.4, 0.2), (W / 2 - 0.5, 0.16), (0.3, 0.12)):
        s.part('rock', rock, (x, 0.2, 1.0 + sz * 0.5), (sz * 1.3, sz, sz), amp=0.06, seed=int(x * 10) + 90, sub=2)
    for i in range(int(W * 4)):  # waving plants along the back
        x = -W / 2 + 0.15 + (W - 0.3) * (i + rnd.random() * 0.5) / (W * 4); h = rnd.uniform(0.35, 0.8)
        pts = [(x + math.sin(k * 1.3 + i) * 0.04 * k, 0.32 - rnd.random() * 0.1, 0.98 + h * k / 4) for k in range(5)]
        s.part('sweep', weed[i % 3], points=pts, r=[0.03, 0.035, 0.03, 0.02, 0.004], ring=5, squash=1.0)
    s.part('rbox', chest, (-0.25, -0.1, 1.06), (0.1, 0.07, 0.06), (0, 0, 15), r=0.01, segs=1)
    s.part('cyl', chest, (-0.25, -0.1, 1.12), (0.07, 0.07, 0.1), (0, 90, 15), seg=8)
    s.part('rock', mat('coin', '#f2c040', 0.3, 0.9), (-0.12, -0.18, 1.0), (0.035, 0.035, 0.01), sub=1)
    s.part('rbox', w, (0, 0, 2.5), (W / 2 + 0.08, 0.58, 0.07), r=0.025, segs=1)
    s.part('box', glow, (0, 0, 2.425), (W / 2 - 0.1, 0.25, 0.006), smooth=False)
    return s.finish()

def bench():  # the window seat: 2.6 wide, 0.7 deep, cushion on top
    s = Model('decor_bench'); w = mat('cabinet_wood', '#5a3a22', 0.7); w2 = mat('cabinet_panel', '#6e4628', 0.7)
    cush = mat('bench_cushion', '#c8503a', 0.95); pil = [mat('pillow_mustard', '#e0a840'), mat('pillow_teal', '#3f8a8a', 0.95)]
    s.part('rbox', w, (0, 0, 0.23), (1.3, 0.35, 0.22), r=0.02, segs=1)
    s.part('rbox', w, (0, -0.02, 0.46), (1.32, 0.37, 0.02), r=0.012, segs=1)
    for i in range(3):
        x = -0.86 + i * 0.86
        s.part('rbox', w2, (x, -0.355, 0.24), (0.38, 0.01, 0.15), r=0.01, segs=1)
        s.part('rock', BRASS(), (x, -0.375, 0.26), (0.03, 0.02, 0.018), sub=1)
    s.part('rbox', cush, (0, 0.01, 0.53), (1.22, 0.31, 0.06), r=0.05)
    s.part('rbox', pil[0], (-0.95, 0.22, 0.72), (0.2, 0.07, 0.16), (-15, 0, 10), r=0.07)
    s.part('rbox', pil[1], (0.98, 0.2, 0.7), (0.18, 0.07, 0.15), (-15, 0, -14), r=0.07)
    s.part('rbox', mat('throw_wool', '#e6d6b0'), (0.45, 0.05, 0.61), (0.22, 0.2, 0.025), (0, 0, 8), r=0.02)
    s.part('rbox', mat('throw_stripe', '#c8503a'), (0.45, 0.05, 0.64), (0.22, 0.2, 0.006), (0, 0, 8), r=0.005, segs=1)
    return s.finish()

obs = [f() for f in (rug, armchair, lamp, plant, shelf, stove, painting, banner, mount, plaque, catbed, bench)] + [tank(False), tank(True)]
export(obs, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'decor'), spacing=4.2)
