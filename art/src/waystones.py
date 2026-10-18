# Builds art/waystones.blend and art/waystones.glb: one unique, hand-shaped waystone per place.
#   python3 art/src/waystones.py        (needs the bpy module: pip install bpy)
# Each stone is one object (ws_<id>) with its base at the origin, front facing Blender -Y (the game's +Z).
# Every glowing part uses the material named "rune"; the game swaps its colour when the stone is lit.
import bpy, bmesh, math, os, random
from mathutils import Vector, Matrix, Euler, noise

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
bpy.ops.wm.read_factory_settings(use_empty=True)

MATS = {}
def mat(name, hexc, rough=0.9, metal=0.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    c = tuple(int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5))
    lin = tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)
    b.inputs['Base Color'].default_value = (*lin, 1); b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    MATS[name] = m; return m

class Stone:
    def __init__(self, name):
        self.name, self.bm, self.slots = name, bmesh.new(), []
    def _slot(self, m):
        if m not in self.slots: self.slots.append(m)
        return self.slots.index(m)
    def part(self, kind, m, loc=(0, 0, 0), size=(1, 1, 1), rot=(0, 0, 0), smooth=True, amp=0.0, freq=2.0, seed=0, **kw):
        bm = self.bm
        if kind == 'rock': r = bmesh.ops.create_icosphere(bm, subdivisions=kw.get('sub', 3), radius=1.0)
        elif kind == 'box': r = bmesh.ops.create_cube(bm, size=2.0)
        elif kind == 'cyl': r = bmesh.ops.create_cone(bm, cap_ends=True, segments=kw.get('seg', 8), radius1=1.0, radius2=kw.get('top', 1.0), depth=2.0)
        elif kind == 'torus':
            r = {'verts': []}; seg, ring, rr = kw.get('seg', 12), kw.get('ring', 5), kw.get('tube', 0.15)
            grid = []
            for i in range(seg):
                a = i / seg * math.tau; row = []
                for j in range(ring):
                    b = j / ring * math.tau
                    row.append(bm.verts.new(((1 + rr * math.cos(b)) * math.cos(a), (1 + rr * math.cos(b)) * math.sin(a), rr * math.sin(b))))
                grid.append(row); r['verts'] += row
            for i in range(seg):
                for j in range(ring):
                    bm.faces.new((grid[i][j], grid[(i + 1) % seg][j], grid[(i + 1) % seg][(j + 1) % ring], grid[i][(j + 1) % ring]))
        verts = r['verts']
        if amp:
            o = Vector((seed * 7.1, seed * 3.3, seed * 5.7))
            for v in verts:
                n = v.co.normalized() if v.co.length > 1e-6 else Vector((0, 0, 1))
                v.co += n * noise.fractal(v.co * freq + o, 0.6, 2.0, 3) * amp
        M = Matrix.Translation(loc) @ Euler([math.radians(a) for a in rot]).to_matrix().to_4x4() @ Matrix.Diagonal((*size, 1))
        for v in verts: v.co = M @ v.co
        faces = {f for v in verts for f in v.link_faces}
        idx = self._slot(m)
        for f in faces: f.material_index = idx; f.smooth = smooth
        return self
    def finish(self):
        me = bpy.data.meshes.new(self.name)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        self.bm.to_mesh(me); self.bm.free()
        for m in self.slots: me.materials.append(m)
        ob = bpy.data.objects.new(self.name, me); bpy.context.scene.collection.objects.link(ob)
        return ob

RUNE = mat('rune', '#4a5a7a', 0.5)
rnd = random.Random(7)

def cove():
    s = Stone('ws_cove'); rock = mat('sea_rock', '#7d8890'); dark = mat('wet_rock', '#5d666e')
    bar = mat('barnacle', '#e6dfcf', 0.8); weed = mat('kelp', '#3f6b3a', 0.6); drift = mat('driftwood', '#b49a78')
    shell = mat('shell', '#e8b4a2', 0.4); rope = mat('rope', '#c8ac74')
    s.part('rock', dark, (0, 0, 0.2), (0.62, 0.5, 0.3), amp=0.12, seed=1)
    s.part('rock', rock, (0, 0, 1.0), (0.42, 0.33, 0.95), (0, 4, 6), amp=0.1, freq=2.4, seed=2)
    s.part('rock', rock, (0.05, 0.02, 1.95), (0.28, 0.24, 0.22), (10, -8, 30), amp=0.06, seed=3, sub=2)
    for i in range(14):  # barnacles round the waterline
        a = rnd.random() * math.tau; z = 0.35 + rnd.random() * 0.45
        s.part('cyl', bar, (math.cos(a) * 0.43, math.sin(a) * 0.35, z), (0.035, 0.035, 0.025), (math.degrees(math.sin(a)) * 0, 90, math.degrees(a)), seg=6, top=0.5, smooth=False)
    for i, a in enumerate((-2.0, -1.2, 0.4, 1.6, 2.6)):  # kelp strands draped from the shoulder
        s.part('cyl', weed, (math.cos(a) * 0.38, math.sin(a) * 0.3, 0.75), (0.035, 0.012, 0.42), (math.sin(a) * 12, math.cos(a) * 12, 0), seg=5, top=0.2)
    s.part('cyl', drift, (0.15, 0.32, 0.12), (0.09, 0.09, 0.7), (6, 90, 18), amp=0.02, seed=4, seg=8)
    s.part('torus', rope, (0, 0, 1.32), (0.4, 0.33, 0.4), (0, 0, 0), tube=0.07, seg=14, ring=5)
    s.part('cyl', shell, (-0.36, -0.42, 0.06), (0.09, 0.07, 0.04), (80, 0, 20), seg=8, top=0.15)
    s.part('cyl', shell, (0.42, -0.25, 0.05), (0.06, 0.05, 0.03), (75, 0, -40), seg=8, top=0.15)
    # rune: a ring and three drops, set into the front face
    s.part('torus', RUNE, (0, -0.37, 1.05), (0.14, 0.14, 0.14), (90, 0, 0), tube=0.18, seg=14, ring=4)
    for z in (0.74, 1.36): s.part('rock', RUNE, (0, -0.37, z), (0.035, 0.03, 0.05), sub=2)
    s.part('rock', RUNE, (0, -0.39, 1.05), (0.045, 0.03, 0.045), sub=2)
    return s.finish()

def frost():
    s = Stone('ws_frost'); ice = mat('frost_stone', '#9aa8b8', 0.55); base = mat('granite', '#767c86')
    snow = mat('snow', '#f2f6fb', 0.95); icicle = mat('icicle', '#cfe6f2', 0.2)
    s.part('rock', base, (0, 0, 0.18), (0.6, 0.55, 0.28), amp=0.1, seed=11)
    s.part('cyl', ice, (0, 0, 1.15), (0.36, 0.3, 1.0), (0, 0, 15), seg=6, top=0.35, smooth=False)
    s.part('cyl', ice, (0, 0, 2.3), (0.13, 0.11, 0.18), (0, 0, 15), seg=6, top=0.0, smooth=False)
    s.part('cyl', ice, (0.38, 0.12, 0.65), (0.15, 0.13, 0.55), (0, 22, 40), seg=6, top=0.25, smooth=False)
    s.part('cyl', ice, (-0.35, 0.18, 0.55), (0.12, 0.1, 0.42), (0, -26, -10), seg=6, top=0.2, smooth=False)
    s.part('rock', snow, (0, 0.02, 2.06), (0.2, 0.17, 0.08), amp=0.03, seed=12, sub=2)
    s.part('rock', snow, (0.1, 0.05, 0.38), (0.62, 0.55, 0.12), amp=0.05, seed=13)
    s.part('rock', snow, (0.46, 0.13, 1.08), (0.09, 0.08, 0.05), (0, 22, 40), sub=2)
    for x, z, h in ((-0.22, 1.98, 0.18), (-0.06, 1.99, 0.26), (0.12, 1.98, 0.14), (0.26, 1.97, 0.2), (-0.3, 0.92, 0.12), (0.4, 1.05, 0.15)):
        s.part('cyl', icicle, (x, -0.26, z - h), (0.032, 0.032, h), (180, 0, 0), seg=5, top=0.0)
    for z in (0.85, 1.2, 1.55):  # rune: three diamonds stacked
        s.part('box', RUNE, (0, -0.31, z), (0.07, 0.03, 0.07), (0, 45, 0), smooth=False)
    s.part('box', RUNE, (0, -0.305, 1.2), (0.012, 0.02, 0.45), smooth=False)
    return s.finish()

def pond():
    s = Stone('ws_pond'); st = mat('river_stone', '#8a877c'); st2 = mat('river_stone_dark', '#6e6c64')
    moss = mat('moss', '#5c8a3c'); fern = mat('fern', '#4f8f3f', 0.7); stem = mat('mushroom_stem', '#efe6d4'); cap = mat('mushroom_cap', '#b0583a', 0.6)
    z = 0.0
    for i, (w, h, m, sd) in enumerate(((0.55, 0.3, st2, 21), (0.46, 0.32, st, 22), (0.38, 0.3, st2, 23), (0.3, 0.27, st, 24), (0.2, 0.18, st2, 25))):
        z += h * (0.85 if i else 0.75)
        s.part('rock', m, ((i % 2) * 0.04 - 0.02, 0, z), (w, w * 0.85, h), (0, 0, i * 37), amp=0.07, seed=sd)
        if i < 4: s.part('rock', moss, ((i % 2) * 0.04 + 0.03, 0.06, z + h * 0.78), (w * 0.75, w * 0.62, h * 0.3), amp=0.06, seed=sd + 50, sub=2)
        z += h * 0.85
    for i in range(7):  # fern fronds fanning out at the foot
        a = i / 7 * math.tau + 0.3
        s.part('cyl', fern, (math.cos(a) * 0.62, math.sin(a) * 0.56, 0.2), (0.02, 0.09, 0.3), (0, 68, math.degrees(a)), seg=6, top=0.0)
    for x, y, k in ((0.45, -0.38, 1.0), (0.56, -0.24, 0.7), (-0.5, -0.36, 0.85)):
        s.part('cyl', stem, (x, y, 0.07 * k), (0.022 * k, 0.022 * k, 0.07 * k), seg=6)
        s.part('cyl', cap, (x, y, 0.16 * k), (0.07 * k, 0.07 * k, 0.035 * k), seg=10, top=0.25)
    s.part('torus', RUNE, (0, -0.4, 0.82), (0.13, 0.13, 0.13), (90, 0, 0), tube=0.16, seg=14, ring=4)
    s.part('cyl', RUNE, (0, -0.4, 0.82), (0.05, 0.05, 0.02), (90, 0, 0), seg=8)
    for a in (0, 120, 240):
        r = math.radians(a + 90); s.part('box', RUNE, (math.cos(r) * 0.2, -0.36, 0.82 + math.sin(r) * 0.2), (0.025, 0.02, 0.05), (0, -a, 0), smooth=False)
    return s.finish()

def marsh():
    s = Stone('ws_marsh'); slab = mat('marsh_stone', '#6f7466'); lich = mat('lichen', '#9aa868'); mud = mat('mud', '#54473a')
    wood = mat('old_wood', '#6b5136'); rope = mat('rope', '#c8ac74'); reed = mat('reed', '#7a9a4a', 0.7); tail = mat('cattail', '#5a3a22')
    pad = mat('lily_pad', '#4a8a46', 0.5); bloom = mat('lily_bloom', '#f0a8c0', 0.5)
    s.part('rock', mud, (0, 0.05, 0.02), (0.75, 0.65, 0.12), amp=0.05, seed=31)
    s.part('rock', slab, (0, 0, 0.95), (0.36, 0.13, 0.95), (0, 7, 0), amp=0.05, freq=3, seed=32)
    s.part('rock', lich, (0.18, -0.08, 1.5), (0.12, 0.05, 0.09), (0, 7, 0), sub=2, amp=0.02, seed=33)
    s.part('rock', lich, (-0.2, -0.09, 0.6), (0.1, 0.05, 0.14), (0, 7, 0), sub=2, amp=0.02, seed=34)
    s.part('cyl', wood, (0.05, 0.38, 0.85), (0.06, 0.06, 0.9), (-22, 4, 0), seg=7, amp=0.015, seed=35)
    s.part('torus', rope, (0.08, 0.15, 1.3), (0.4, 0.17, 0.4), (0, 7, 0), tube=0.06, seg=14, ring=4)
    for i in range(9):  # reeds and cattails
        a = rnd.uniform(0.6, 2.6) if i % 2 else rnd.uniform(-2.8, -0.4); r = rnd.uniform(0.45, 0.7); h = rnd.uniform(0.6, 1.05)
        x, y = math.cos(a) * r, math.sin(a) * r * 0.9
        tilt = (rnd.uniform(-8, 8), rnd.uniform(-8, 8), 0)
        s.part('cyl', reed, (x, y, h / 2), (0.012, 0.012, h / 2), tilt, seg=4)
        if i % 3 == 0: s.part('cyl', tail, (x + math.sin(math.radians(tilt[1])) * h, y - math.sin(math.radians(tilt[0])) * h, h), (0.03, 0.03, 0.08), tilt, seg=6)
    for x, y, r in ((-0.55, -0.45, 0.16), (0.5, -0.5, 0.12), (0.7, 0.1, 0.14)):
        s.part('cyl', pad, (x, y, 0.015), (r, r, 0.008), seg=10)
    s.part('cyl', bloom, (-0.55, -0.45, 0.06), (0.05, 0.05, 0.04), seg=6, top=1.6, smooth=False)
    # rune: a crescent moon over two bars
    s.part('torus', RUNE, (0.0, -0.14, 1.28), (0.12, 0.12, 0.12), (90, 7, 0), tube=0.2, seg=10, ring=4)
    s.part('rock', slab, (0.06, -0.15, 1.31), (0.09, 0.03, 0.09), (0, 7, 0), sub=2)  # hides half the ring
    for z in (0.95, 0.82): s.part('box', RUNE, (0.0 - (1.2 - z) * 0.12, -0.14, z), (0.12, 0.02, 0.022), (0, 7, 0), smooth=False)
    return s.finish()

def quarry():
    s = Stone('ws_quarry'); cut = mat('cut_granite', '#b4aea4', 0.85); plinth = mat('plinth_stone', '#9a948a')
    iron = mat('iron', '#3c3c42', 0.45, 0.8); handle = mat('handle_wood', '#8a6a44'); chip = mat('rubble', '#a8a298')
    s.part('box', plinth, (0, 0, 0.16), (0.55, 0.45, 0.16), smooth=False)
    s.part('box', plinth, (0, 0, 0.36), (0.45, 0.37, 0.05), smooth=False)
    s.part('cyl', cut, (0, 0, 1.22), (0.4, 0.4, 0.82), (0, 0, 45), seg=4, top=0.66, smooth=False)
    s.part('cyl', cut, (0, 0, 2.17), (0.27, 0.27, 0.13), (0, 0, 45), seg=4, top=0.0, smooth=False)
    for z, w in ((0.7, 0.275), (1.7, 0.215)):
        s.part('box', iron, (0, 0, z), (w, w, 0.035), smooth=False)
        for x in (-1, 1):
            for y in (-1, 1): s.part('rock', iron, (x * w * 0.7, y * w * 1.0, z), (0.018, 0.018, 0.018), sub=2)
    s.part('cyl', handle, (0.5, -0.2, 0.42), (0.025, 0.025, 0.45), (0, -28, 0), seg=6)
    s.part('cyl', iron, (0.29, -0.2, 0.82), (0.03, 0.03, 0.16), (0, 62, 0), seg=6, top=0.1)
    s.part('cyl', iron, (0.29, -0.2, 0.82), (0.03, 0.03, 0.16), (0, 242, 0), seg=6, top=0.1)
    for i in range(6):
        a = rnd.random() * math.tau; r = rnd.uniform(0.6, 0.8)
        s.part('rock', chip, (math.cos(a) * r, math.sin(a) * r, 0.04), (0.07, 0.06, 0.05), (0, 0, rnd.random() * 90), smooth=False, amp=0.03, seed=40 + i, sub=2)
    # rune: a square seal with a chevron above and below
    s.part('box', RUNE, (0, -0.24, 1.2), (0.11, 0.02, 0.11), smooth=False)
    s.part('box', cut, (0, -0.25, 1.2), (0.06, 0.02, 0.06), smooth=False)
    for z, d in ((1.45, 1), (0.95, -1)):
        for sx in (-1, 1): s.part('box', RUNE, (sx * 0.05, -0.235 - (1.45 - z) * 0.03, z), (0.06, 0.02, 0.015), (0, sx * d * 30, 0), smooth=False)
    return s.finish()

def lodge():
    s = Stone('ws_lodge'); base = mat('field_stone', '#7e7a72'); log = mat('pine_log', '#7a5232'); bark = mat('bark', '#4e3420')
    roof = mat('shingle', '#5a3e2e'); antler = mat('antler', '#e2d6ba', 0.6); iron = mat('iron', '#3c3c42', 0.45, 0.8)
    s.part('rock', base, (0, 0, 0.16), (0.55, 0.5, 0.24), amp=0.1, seed=51)
    for i, a in enumerate((0.3, 2.0, 3.9, 5.2)): s.part('rock', base, (math.cos(a) * 0.5, math.sin(a) * 0.45, 0.08), (0.16, 0.14, 0.11), amp=0.04, seed=52 + i, sub=2)
    s.part('cyl', log, (0, 0, 1.15), (0.2, 0.2, 1.0), seg=10, amp=0.012, freq=6, seed=56)
    for z in (0.45, 1.0, 1.65, 1.95): s.part('torus', bark, (0, 0, z), (0.2, 0.2, 0.2), tube=0.12, seg=12, ring=4)
    s.part('box', roof, (0, -0.18, 2.24), (0.32, 0.22, 0.025), (35, 0, 0), smooth=False)
    s.part('box', roof, (0, 0.18, 2.24), (0.32, 0.22, 0.025), (-35, 0, 0), smooth=False)
    s.part('cyl', bark, (0, 0, 2.36), (0.03, 0.03, 0.34), (0, 90, 0), seg=6)
    for sx in (-1, 1):  # a small set of antlers on the front
        s.part('cyl', antler, (sx * 0.12, -0.19, 1.86), (0.018, 0.018, 0.14), (0, sx * 35, 0), seg=5, top=0.6)
        s.part('cyl', antler, (sx * 0.2, -0.19, 1.98), (0.013, 0.013, 0.08), (0, sx * 10, 0), seg=5, top=0.3)
        s.part('cyl', antler, (sx * 0.24, -0.19, 1.88), (0.012, 0.012, 0.07), (0, sx * 70, 0), seg=5, top=0.3)
    s.part('rock', antler, (0, -0.2, 1.8), (0.06, 0.04, 0.05), sub=2)
    # an arm with a lantern; the lantern glass is rune, so it lights with the stone
    s.part('box', log, (0.3, 0, 1.55), (0.18, 0.035, 0.035), smooth=False)
    s.part('cyl', iron, (0.44, 0, 1.47), (0.006, 0.006, 0.06), seg=4)
    s.part('box', iron, (0.44, 0, 1.4), (0.065, 0.065, 0.012), smooth=False)
    s.part('box', RUNE, (0.44, 0, 1.31), (0.05, 0.05, 0.075), smooth=False)
    s.part('box', iron, (0.44, 0, 1.225), (0.06, 0.06, 0.012), smooth=False)
    for x in (-1, 1):
        for y in (-1, 1): s.part('box', iron, (0.44 + x * 0.05, y * 0.05, 1.31), (0.007, 0.007, 0.08), smooth=False)
    # rune stone set into the post
    s.part('rock', RUNE, (0, -0.19, 1.3), (0.09, 0.05, 0.12), sub=2)
    s.part('torus', iron, (0, -0.19, 1.3), (0.1, 0.12, 0.1), (90, 0, 0), tube=0.15, seg=12, ring=4)
    return s.finish()

def camp():
    s = Stone('ws_camp'); st = mat('camp_stone', '#8a847a'); ring = mat('ring_stone', '#6e6a62'); pole = mat('crook_wood', '#5a4632')
    iron = mat('iron', '#3c3c42', 0.45, 0.8); cone = mat('pine_cone', '#7a5232'); moss = mat('moss', '#5c8a3c'); cloth = mat('ribbon', '#c8503a', 0.7)
    s.part('rock', st, (0, 0, 0.8), (0.32, 0.26, 0.82), (0, -5, 10), amp=0.09, freq=2.2, seed=61)
    s.part('rock', moss, (-0.05, 0.05, 1.5), (0.22, 0.18, 0.1), amp=0.05, seed=62, sub=2)
    for i in range(8):
        a = i / 8 * math.tau + 0.2
        s.part('rock', ring, (math.cos(a) * 0.72, math.sin(a) * 0.62, 0.07), (0.13, 0.11, 0.09), (0, 0, math.degrees(a)), amp=0.04, seed=63 + i, sub=2)
    s.part('cyl', pole, (-0.42, 0.1, 0.95), (0.03, 0.03, 0.95), (0, 3, 0), seg=6, amp=0.01, seed=72)
    s.part('cyl', pole, (-0.3, 0.1, 1.93), (0.025, 0.025, 0.14), (0, 60, 0), seg=6)
    s.part('cyl', pole, (-0.16, 0.1, 1.9), (0.022, 0.022, 0.06), (0, 150, 0), seg=6)
    s.part('cyl', cloth, (-0.42, 0.1, 1.55), (0.033, 0.033, 0.04), seg=6)
    s.part('box', cloth, (-0.42, 0.06, 1.42), (0.012, 0.004, 0.12), (6, 0, 4), smooth=False)
    s.part('cyl', iron, (-0.16, 0.1, 1.76), (0.006, 0.006, 0.09), seg=4)
    s.part('cyl', iron, (-0.16, 0.1, 1.65), (0.06, 0.06, 0.025), seg=8, top=0.4)
    s.part('cyl', RUNE, (-0.16, 0.1, 1.55), (0.05, 0.05, 0.07), seg=8)
    s.part('cyl', iron, (-0.16, 0.1, 1.47), (0.055, 0.055, 0.012), seg=8)
    for x, y in ((0.45, -0.45), (0.55, -0.3), (-0.6, -0.35)):
        s.part('rock', cone, (x, y, 0.05), (0.035, 0.035, 0.055), (80, 0, rnd.random() * 180), sub=2, smooth=False)
    s.part('cyl', pole, (0.25, 0.55, 0.09), (0.09, 0.09, 0.35), (0, 90, 25), seg=8)
    # rune: three claw marks
    for i, x in enumerate((-0.08, 0, 0.08)):
        s.part('box', RUNE, (x, -0.27, 0.92 + (i == 1) * 0.04), (0.018, 0.02, 0.16), (0, 12, 0), smooth=False)
    s.part('box', RUNE, (0, -0.27, 0.65), (0.11, 0.02, 0.018), smooth=False)
    return s.finish()

def river():
    s = Stone('ws_river'); st = mat('bridge_stone', '#9a958c', 0.85); st2 = mat('bridge_stone_dark', '#837e75', 0.85)
    peb = mat('pebble', '#7a8a8a', 0.7); ivy = mat('ivy', '#5f9442', 0.7); moss = mat('moss', '#5c8a3c')
    for sx in (-1, 1):
        for i, (h, w) in enumerate(((0.36, 0.2), (0.34, 0.18), (0.32, 0.17))):
            z = sum((0.36, 0.34, 0.32)[:i]) + h / 2
            s.part('box', (st, st2)[(i + (sx > 0)) % 2], (sx * 0.55, 0, z), (w, w * 0.9, h / 2 - 0.006), (0, 0, (i * 7 - 6) * sx), smooth=False)
    R = 0.55
    for k in range(7):  # the arch: voussoirs round a half circle, the middle one is the keystone
        a = math.pi * (k + 0.5) / 7
        x, z = math.cos(a) * R, 1.02 + math.sin(a) * R
        m = RUNE if k == 3 else (st, st2)[k % 2]
        s.part('box', m, (x, 0, z), (0.118 if k != 3 else 0.13, 0.17, 0.12 if k != 3 else 0.15), (0, -(math.degrees(a) - 90), 0), smooth=False)
    for x in (-0.3, -0.12, 0.16, 0.34):  # ivy hanging from the arch
        L = rnd.uniform(0.25, 0.5)
        s.part('cyl', ivy, (x, -0.16, 1.02 + math.sqrt(max(0.0, R * R - x * x)) - L / 2), (0.012, 0.012, L / 2), seg=4)
        for j in range(3): s.part('rock', ivy, (x + rnd.uniform(-0.03, 0.03), -0.17, 1.02 + math.sqrt(max(0.0, R * R - x * x)) - L * (j + 0.6) / 3), (0.035, 0.012, 0.03), sub=2, smooth=False)
    s.part('rock', moss, (-0.55, 0, 1.03), (0.17, 0.16, 0.04), amp=0.03, seed=81, sub=2)
    for i in range(9):
        a = rnd.random() * math.tau; r = rnd.uniform(0.2, 0.85)
        s.part('rock', peb, (math.cos(a) * r, math.sin(a) * r * 0.5, 0.03), (0.07, 0.055, 0.035), (0, 0, rnd.random() * 180), amp=0.02, seed=82 + i, sub=2)
    return s.finish()

obs = [f() for f in (cove, frost, pond, marsh, quarry, lodge, camp, river)]
for i, ob in enumerate(obs): ob.location = ((i - 3.5) * 2.2, 0, 0)  # laid out in a row in the .blend
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'waystones.blend'))
for ob in obs: ob.location = (0, 0, 0)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'waystones.glb'), export_format='GLB', export_apply=True, export_materials='EXPORT', export_yup=True)
for ob in obs: print(ob.name, len(ob.data.vertices), 'verts', len(ob.data.polygons), 'faces')
