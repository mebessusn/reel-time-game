# Shared modelling kit for the art/src/*.py Blender build scripts (bpy as a Python module).
# A Model is one mesh object built from parts; every part gets a material slot. Blender axes: X right, -Y front
# (the game's +Z), Z up. Export with export_yup so the game sees Y up.
import bpy, bmesh, math
from mathutils import Vector, Matrix, Euler, noise

MATS = {}
def mat(name, hexc, rough=0.9, metal=0.0, emit=None):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    lin = lambda h: tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)))
    b.inputs['Base Color'].default_value = (*lin(hexc), 1); b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*lin(emit), 1); b.inputs['Emission Strength'].default_value = 1.0
    MATS[name] = m; return m

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True); MATS.clear()

class Model:
    def __init__(self, name):
        self.name, self.bm, self.slots = name, bmesh.new(), []
    def _slot(self, m):
        if m not in self.slots: self.slots.append(m)
        return self.slots.index(m)
    def _ring(self, c, t, r, n, squash):
        t = t.normalized(); ref = Vector((0, 0, 1)) if abs(t.z) < 0.95 else Vector((1, 0, 0))
        n1 = t.cross(ref).normalized(); n2 = t.cross(n1).normalized(); out = []
        for j in range(n):
            a = j / n * math.tau; o = (n1 * math.cos(a) + n2 * math.sin(a)) * r; o.z *= squash
            out.append(self.bm.verts.new(c + o))
        return out
    def part(self, kind, m, loc=(0, 0, 0), size=(1, 1, 1), rot=(0, 0, 0), smooth=True, amp=0.0, freq=2.0, seed=0, **kw):
        bm = self.bm; pre = Matrix.Diagonal((*size, 1))
        if kind == 'rock': verts = bmesh.ops.create_icosphere(bm, subdivisions=kw.get('sub', 3), radius=1.0)['verts']
        elif kind == 'box': verts = bmesh.ops.create_cube(bm, size=2.0)['verts']
        elif kind == 'rbox':  # rounded box: size = half extents, r = edge radius
            verts = bmesh.ops.create_cube(bm, size=2.0)['verts']
            for v in verts: v.co = pre @ v.co
            pre = Matrix.Identity(4)
            edges = list({e for v in verts for e in v.link_edges})
            res = bmesh.ops.bevel(bm, geom=verts + edges, offset=kw.get('r', 0.05), segments=kw.get('segs', 2), profile=0.5, affect='EDGES', clamp_overlap=True)
            verts = list({v for f in res['faces'] for v in f.verts} | set(v for v in verts if v.is_valid))
        elif kind == 'cyl': verts = bmesh.ops.create_cone(bm, cap_ends=True, segments=kw.get('seg', 8), radius1=1.0, radius2=kw.get('top', 1.0), depth=2.0)['verts']
        elif kind == 'torus':
            seg, ring, rr = kw.get('seg', 12), kw.get('ring', 5), kw.get('tube', 0.15); grid = []; verts = []
            for i in range(seg):
                a = i / seg * math.tau; row = []
                for j in range(ring):
                    b = j / ring * math.tau
                    row.append(bm.verts.new(((1 + rr * math.cos(b)) * math.cos(a), (1 + rr * math.cos(b)) * math.sin(a), rr * math.sin(b))))
                grid.append(row); verts += row
            for i in range(seg if kw.get('closed', True) else seg - 1):
                for j in range(ring): bm.faces.new((grid[i][j], grid[(i + 1) % seg][j], grid[(i + 1) % seg][(j + 1) % ring], grid[i][(j + 1) % ring]))
        elif kind == 'sweep':  # a tube along points; r is a number or one radius per point
            pts = [Vector(p) for p in kw['points']]; closed = kw.get('closed', False); n = kw.get('ring', 6)
            rs = kw.get('r', 0.05); rs = rs if isinstance(rs, (list, tuple)) else [rs] * len(pts)
            rings = []; N = len(pts)
            for i, p in enumerate(pts):
                a = pts[(i - 1) % N] if (closed or i > 0) else p; b = pts[(i + 1) % N] if (closed or i < N - 1) else p
                rings.append(self._ring(p, b - a, max(rs[i], 1e-4), n, kw.get('squash', 1.0)))
            verts = [v for r_ in rings for v in r_]
            for i in range(N if closed else N - 1):
                A, B = rings[i], rings[(i + 1) % N]
                for j in range(n): bm.faces.new((A[j], B[j], B[(j + 1) % n], A[(j + 1) % n]))
            if not closed:
                for r_, p in ((rings[0], pts[0]), (rings[-1], pts[-1])):
                    c = bm.verts.new(p); verts.append(c)
                    for j in range(n): bm.faces.new((r_[j], r_[(j + 1) % n], c))
        elif kind == 'poly':  # a flat shape in the XZ plane (points are (x, z)), extruded along Y by depth
            d = kw.get('depth', 0.02); P = kw['points']
            f = [bm.verts.new((x, -d / 2, z)) for x, z in P]; bk = [bm.verts.new((x, d / 2, z)) for x, z in P]
            verts = f + bk; n = len(P)
            bm.faces.new(f[::-1]); bm.faces.new(bk)
            for i in range(n): bm.faces.new((f[i], f[(i + 1) % n], bk[(i + 1) % n], bk[i]))
            smooth = False
        if amp:
            o = Vector((seed * 7.1, seed * 3.3, seed * 5.7))
            for v in verts:
                nrm = v.co.normalized() if v.co.length > 1e-6 else Vector((0, 0, 1))
                v.co += nrm * noise.fractal(v.co * freq + o, 0.6, 2.0, 3) * amp
        M = Matrix.Translation(loc) @ Euler([math.radians(a) for a in rot]).to_matrix().to_4x4() @ pre
        for v in verts: v.co = M @ v.co
        idx = self._slot(m)
        for f in {f for v in verts for f in v.link_faces}: f.material_index = idx; f.smooth = smooth
        return self
    def finish(self):
        me = bpy.data.meshes.new(self.name)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        self.bm.to_mesh(me); self.bm.free()
        for m in self.slots: me.materials.append(m)
        ob = bpy.data.objects.new(self.name, me); bpy.context.scene.collection.objects.link(ob)
        return ob

def ellipse(a, b, n=24, cx=0.0, cz=0.0):
    return [(cx + a * math.cos(i / n * math.tau), cz + b * math.sin(i / n * math.tau)) for i in range(n)]

def export(obs, base, spacing=2.6):
    import os
    for i, ob in enumerate(obs): ob.location = ((i - (len(obs) - 1) / 2) * spacing, 0, 0)
    bpy.ops.wm.save_as_mainfile(filepath=base + '.blend')
    for ob in obs: ob.location = (0, 0, 0)
    bpy.ops.export_scene.gltf(filepath=base + '.glb', export_format='GLB', export_apply=True, export_materials='EXPORT', export_yup=True)
    for ob in obs: print(ob.name, len(ob.data.vertices), 'verts')
