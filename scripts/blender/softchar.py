# Reel Time "soft-block" character look test (Blender).
# Chunky, stout parts with rounded edges and corners, wrapped in 16-bit style pixel textures.
# Each part is an analytically rounded box (exact smooth normals) whose six faces are painted into one
# per-character atlas image (Closest filtering keeps the pixels crisp on the soft shapes).
# Run inside Blender: exec(open(r'<path>/softchar.py').read())
import bpy, bmesh, math
from mathutils import Vector

D = 32          # texels per world unit (the "16-bit" pixel density)
ATLAS = 256

# ---------------------------------------------------------------- colour helpers
def _rgb(h):
    h = h.lstrip('#'); return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
def _hex(c):
    return '#%02x%02x%02x' % tuple(max(0, min(255, round(v * 255))) for v in c)
def tone(h, k):
    a = _rgb(h); b = [1, 1, 1] if k > 0 else [0.1, 0.063, 0.125]; k = abs(k)
    return _hex([a[i] + (b[i] - a[i]) * k for i in range(3)])
def mix(h1, h2, k):
    a, b = _rgb(h1), _rgb(h2); return _hex([a[i] + (b[i] - a[i]) * k for i in range(3)])
def hsh(x, y, s=0):
    h = (x * 374761393 + y * 668265263 + s * 1274126177) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffffffff) / 4294967296

# ---------------------------------------------------------------- atlas + face painter
class Atlas:
    def __init__(self, size=ATLAS):
        self.size = size
        self.px = [[None] * size for _ in range(size)]  # hex or 'clear' / None, [y][x], y down
        self.x = 1; self.y = 1; self.row = 0
    def alloc(self, w, h):
        if self.x + w + 2 > self.size:
            self.x = 1; self.y += self.row + 2; self.row = 0
        r = (self.x, self.y, w, h)
        self.x += w + 2; self.row = max(self.row, h)
        assert self.y + h < self.size, 'atlas full'
        return r
    def image(self, name):
        S = self.size
        img = bpy.data.images.get(name) or bpy.data.images.new(name, S, S, alpha=True)
        if img.size[0] != S: img.scale(S, S)
        buf = [0.0] * (S * S * 4)
        for y in range(S):
            row = self.px[y]
            for x in range(S):
                c = row[x]
                if c is None or c == 'clear':
                    continue
                r, g, b = _rgb(c)
                i = ((S - 1 - y) * S + x) * 4
                buf[i:i + 4] = (r, g, b, 1.0)
        img.pixels.foreach_set(buf)
        img.update()
        img.pack()
        return img

class Face:
    def __init__(self, atlas, r):
        self.a = atlas; self.rx, self.ry, self.w, self.h = r
    def px(self, x, y, c):
        if c is None or x < 0 or y < 0 or x >= self.w or y >= self.h: return
        self.a.px[self.ry + y][self.rx + x] = c
    def get(self, x, y): return self.a.px[self.ry + y][self.rx + x]
    def rect(self, x, y, w, h, c):
        for j in range(y, y + h):
            for i in range(x, x + w): self.px(i, j, c)
    def fill(self, fn):
        for y in range(self.h):
            for x in range(self.w): self.px(x, y, fn(x, y) if callable(fn) else fn)
    def shade(self, side):
        # soft baked ramp: slight top-to-bottom darkening and darker rims
        for y in range(self.h):
            for x in range(self.w):
                c = self.get(x, y)
                if c is None or c == 'clear': continue
                k = 0.0
                if side not in ('top', 'bottom'): k -= 0.12 * (y / max(1, self.h - 1)) - 0.03
                if x in (0, self.w - 1) or y in (0, self.h - 1): k -= 0.08 if side != 'top' else 0.04
                if side == 'bottom': k -= 0.18
                if k: self.px(x, y, tone(c, k))
    def gutter(self):
        A = self.a.px; x0, y0, w, h = self.rx, self.ry, self.w, self.h
        for i in range(w):
            A[y0 - 1][x0 + i] = A[y0][x0 + i]; A[y0 + h][x0 + i] = A[y0 + h - 1][x0 + i]
        for j in range(-1, h + 1):
            A[y0 + j][x0 - 1] = A[y0 + j][x0]; A[y0 + j][x0 + w] = A[y0 + j][x0 + w - 1]

SIDES = ('right', 'left', 'top', 'bottom', 'front', 'back')
# Blender is Z-up; the character faces -Y (so glTF export lands facing +Z in three.js).
# Local box axes here: X = across, Y = depth (front is -Y), Z = up.
def rbox(atlas, name, w, h, d, r, paint, seg=3, shade=True):
    """Rounded box w (x) by h (z) by d (y) with painted faces. Returns a mesh object at the origin."""
    r = min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)
    dims = {'front': (w, h), 'back': (w, h), 'right': (d, h), 'left': (d, h), 'top': (w, d), 'bottom': (w, d)}
    regions = {}
    for s in SIDES:
        fw, fh = dims[s]
        reg = atlas.alloc(max(2, round(fw * D)), max(2, round(fh * D)))
        regions[s] = reg
        f = Face(atlas, reg)
        fn = paint.get(s) or paint.get('all')
        if fn: fn(f, s)
        if shade: f.shade(s)
        f.gutter()
    hx, hy, hz = w / 2, d / 2, h / 2
    inner = (hx - r, hy - r, hz - r)
    def coords(L):
        half = L / 2
        a = [-half + r * i / seg for i in range(seg + 1)]
        b = [half - r + r * i / seg for i in range(seg + 1)]
        out = sorted(set([round(v, 6) for v in a + b]))
        return out
    def project(q):
        c = Vector((max(-inner[0], min(inner[0], q[0])), max(-inner[1], min(inner[1], q[1])), max(-inner[2], min(inner[2], q[2]))))
        n = (Vector(q) - c)
        n.normalize()
        return c + n * r
    verts, faces, uvs = [], [], []
    S = atlas.size
    # each side: (fixed axis, sign, u axis, u sign, v axis) with front = -Y
    spec = {
        'front': (1, -1), 'back': (1, 1), 'right': (0, 1), 'left': (0, -1), 'top': (2, 1), 'bottom': (2, -1),
    }
    lens = (w, d, h)
    for s in SIDES:
        ax, sg = spec[s]
        others = [i for i in range(3) if i != ax]
        A, B = coords(lens[others[0]]), coords(lens[others[1]])
        base = len(verts)
        grid = []
        for ia, a in enumerate(A):
            for ib, b in enumerate(B):
                q = [0, 0, 0]; q[ax] = sg * lens[ax] / 2; q[others[0]] = a; q[others[1]] = b
                verts.append(tuple(project(q)))
        nb = len(B)
        rx, ry, rw, rh = regions[s]
        for ia in range(len(A) - 1):
            for ib in range(nb - 1):
                quad = [base + ia * nb + ib, base + (ia + 1) * nb + ib, base + (ia + 1) * nb + ib + 1, base + ia * nb + ib + 1]
                # outward winding
                p0, p1, p3 = Vector(verts[quad[0]]), Vector(verts[quad[1]]), Vector(verts[quad[3]])
                nrm = (p1 - p0).cross(p3 - p0)
                out = Vector((0, 0, 0)); out[ax] = sg
                if nrm.dot(out) < 0: quad = quad[::-1]
                faces.append((s, quad))
    # planar UVs per side (face-local u to the viewer's right, v up)
    def uv_of(s, p):
        x, y, z = p
        if s == 'front': u, v = (x + hx) / w, (z + hz) / h
        elif s == 'back': u, v = (hx - x) / w, (z + hz) / h
        elif s == 'right': u, v = (y + hy) / d, (z + hz) / h
        elif s == 'left': u, v = (hy - y) / d, (z + hz) / h
        elif s == 'top': u, v = (x + hx) / w, (y + hy) / d
        else: u, v = (x + hx) / w, (hy - y) / d
        u = min(0.999, max(0.001, u)); v = min(0.999, max(0.001, v))
        rx, ry, rw, rh = regions[s]
        return ((rx + u * rw) / S, 1 - (ry + (1 - v) * rh) / S)
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], [q for _, q in faces])
    uvl = me.uv_layers.new(name='UVMap')
    for poly, (s, q) in zip(me.polygons, faces):
        for li, vi in zip(poly.loop_indices, q):
            uvl.data[li].uv = uv_of(s, verts[vi])
    # weld the side grids, then exact rounded-box normals
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    normals = []
    for loop in me.loops:
        p = Vector(me.vertices[loop.vertex_index].co)
        c = Vector((max(-inner[0], min(inner[0], p.x)), max(-inner[1], min(inner[1], p.y)), max(-inner[2], min(inner[2], p.z))))
        n = p - c
        n.normalize()
        normals.append(n)
    me.normals_split_custom_set(normals)
    ob = bpy.data.objects.new(name, me)
    return ob

# ---------------------------------------------------------------- face painting (16 px tall face)
EYE_COLORS = ['#3a2a1a', '#5a3a1a', '#3a6a9a', '#3a8a5a', '#7a8a8a', '#8a5aa0', '#c08a2a', '#1a1a1a']

def paint_face(f, cfg, skin):
    eye = cfg.get('eyeColor', '#3a2a1a'); hair = cfg['hairColor']; ex = set(cfg.get('extras', []))
    f.fill(lambda x, y: tone(skin, -0.03) if hsh(x, y, 3) > 0.93 else skin)
    W = f.w; cx = W // 2
    eyeY = round(f.h * 0.44)
    eL, eR = cx - 6, cx + 3
    lash = tone(eye, -0.55)
    def draw_eye(x0, style):
        if style == 'happy':
            f.px(x0, eyeY + 2, lash); f.px(x0 + 1, eyeY + 1, lash); f.px(x0 + 2, eyeY + 1, lash); f.px(x0 + 3, eyeY + 2, lash)
        elif style == 'sleepy':
            f.rect(x0, eyeY + 1, 3, 1, lash); f.rect(x0, eyeY + 2, 3, 1, eye)
        else:  # round: tall glossy 3x4 eye with a lash line and two highlights
            f.rect(x0, eyeY, 3, 4, eye)
            f.rect(x0, eyeY, 3, 1, lash); f.px(x0 - 1, eyeY, lash) if cfg.get('lashes') else None
            f.px(x0 + 1, eyeY + 2, tone(eye, -0.35)); f.px(x0 + 1, eyeY + 3, tone(eye, -0.2))
            f.px(x0, eyeY + 1, '#ffffff'); f.px(x0 + 2, eyeY + 3, tone(eye, 0.45))
    if cfg.get('eyes') == 'wink':
        draw_eye(eL, 'round'); draw_eye(eR, 'happy')
    else:
        draw_eye(eL, cfg.get('eyes', 'round')); draw_eye(eR, cfg.get('eyes', 'round'))
    bc = tone(hair, -0.18); by = eyeY - 2
    if cfg.get('brows') == 'bold':
        f.rect(eL, by - 1, 3, 1, bc); f.rect(eL - 1, by, 3, 1, bc)
        f.rect(eR, by - 1, 3, 1, bc); f.rect(eR + 1, by, 3, 1, bc)
    else:
        f.rect(eL, by, 3, 1, tone(bc, 0.2)); f.rect(eR, by, 3, 1, tone(bc, 0.2))
    # nose and cheeks
    f.px(cx - 1, eyeY + 4, tone(skin, -0.12)); f.px(cx, eyeY + 4, tone(skin, -0.06))
    blush = mix(skin, '#f06070', 0.5 if 'blush' in ex else 0.18)
    f.rect(eL - 1, eyeY + 4, 3, 1, blush); f.rect(eR + 1, eyeY + 4, 3, 1, blush)
    if 'blush' in ex:
        f.px(eL, eyeY + 5, mix(skin, '#f06070', 0.3)); f.px(eR + 2, eyeY + 5, mix(skin, '#f06070', 0.3))
    if 'freckles' in ex:
        for x, y in [(eL - 1, 5), (eL + 1, 6), (eL, 7), (eR + 1, 6), (eR + 3, 5), (eR + 2, 7)]: f.px(x, eyeY + y, tone(skin, -0.3))
    my = eyeY + 6; lip = tone(skin, -0.42); inner = '#7a2e36'
    m = cfg.get('mouth', 'smile')
    if m == 'toothy':
        f.rect(cx - 2, my, 4, 2, inner); f.rect(cx - 1, my, 2, 1, '#ffffff'); f.px(cx - 2, my, lip); f.px(cx + 1, my, lip); f.rect(cx - 1, my + 2, 2, 1, tone(skin, -0.15))
    elif m == 'grin':
        f.rect(cx - 2, my, 4, 1, lip); f.rect(cx - 1, my + 1, 2, 1, inner); f.px(cx - 3, my - 1, lip); f.px(cx + 2, my - 1, lip)
    else:
        f.px(cx - 2, my, lip); f.rect(cx - 1, my + 1, 2, 1, lip); f.px(cx + 1, my, lip)
    fh = tone(hair, -0.04)
    if cfg.get('facialHair') == 'beard':
        for y in range(my - 3, f.h):
            for x in range(W):
                if my - 1 <= y <= my + 1 and cx - 3 <= x <= cx + 2: continue  # keep the mouth clear
                if y < my - 1 and 2 < x < W - 3: continue  # only sideburns up the cheeks
                if y == my - 1 and 3 < x < W - 4 and not (cx - 4 <= x <= cx + 3): continue
                f.px(x, y, tone(fh, 0.12) if hsh(x, y, 4) > 0.72 else fh)
        f.rect(cx - 3, my - 1, 6, 1, fh)  # moustache line
        f.px(cx - 2, my, lip); f.rect(cx - 1, my + 1, 2, 1, lip); f.px(cx + 1, my, lip)
    if 'glassesRound' in ex:
        fc = '#6a4024'
        for x0 in (eL, eR):
            f.rect(x0 - 1, eyeY - 1, 5, 1, fc); f.rect(x0 - 1, eyeY + 4, 5, 1, fc)
            f.rect(x0 - 2, eyeY, 1, 4, fc); f.rect(x0 + 3, eyeY, 1, 4, fc)
        f.rect(eL + 3, eyeY, eR - eL - 3, 1, fc)

def paint_side_head(f, skin, side):
    f.fill(lambda x, y: tone(skin, -0.03) if hsh(x, y, 7) > 0.94 else skin)
    ex = round(f.w * 0.5) - 2 if side == 'right' else round(f.w * 0.5) - 1
    ey = round(f.h * 0.48)
    f.rect(ex, ey, 3, 4, tone(skin, -0.08)); f.rect(ex + 1, ey + 1, 1, 2, tone(skin, -0.22))

# ---------------------------------------------------------------- hair
def hair_strand(hair):
    hl, sh, dp = tone(hair, 0.24), tone(hair, -0.22), tone(hair, -0.4)
    def fn(x, y):
        r = hsh(x, 0, 21)
        if y == 2 and r > 0.3: return hl
        if y == 3 and r > 0.65: return hl
        if r > 0.8: return sh
        if hsh(x, y, 22) > 0.9: return dp
        return hair
    return fn, sh

def build_hair(atlas, cfg, head, add):
    hair = cfg['hairColor']; style = cfg['hair']
    strand, sh = hair_strand(hair)
    HW, HH, HD = head
    capW, capD = HW + 0.05, HD + 0.05
    capH = 0.32
    fringe = {
        'buns': lambda x, w: 3 if x % 4 == 0 else 2,
        'crop': lambda x, w: 3 if x % 5 == 2 else 2,
        'messy': lambda x, w: [3, 1, 4, 2, 3, 1, 2, 4, 1, 3][x % 10],
    }.get(style, lambda x, w: 2)
    def front(f, s):
        f.fill(strand)
        for x in range(f.w):
            keep = round(f.h * 0.42) + fringe(x, f.w)
            for y in range(keep, f.h): f.px(x, y, 'clear')
            f.px(x, keep - 1, sh)
    def side(f, s):
        f.fill(strand)
        # keep a sideburn by the face (front is low u on the right side, high u on the left)
        fr = (lambda x: x < f.w * 0.38) if s == 'right' else (lambda x: x > f.w * 0.62)
        for y in range(round(f.h * 0.55), f.h):
            for x in range(f.w):
                if not fr(x) or y > f.h * 0.82: f.px(x, y, 'clear')
    cap = rbox(atlas, 'hair_cap', capW, capH, capD, 0.09, {'all': lambda f, s: f.fill(strand), 'front': front, 'right': side, 'left': side})
    add(cap, (0, 0, HH - capH / 2 + 0.07))
    # nape: hair down the back of the head to just above the neck
    napeH = HH * 0.62
    def nape_side(f, s):
        f.fill(strand)
        cut = (lambda x: x < f.w * 0.45) if s == 'right' else (lambda x: x > f.w * 0.55)
        for y in range(f.h):
            for x in range(f.w):
                if cut(x): f.px(x, y, 'clear')
    def nape_back(f, s):
        f.fill(strand)
        for x in range(f.w):
            for y in range(f.h - (1 if x % 3 else 2), f.h): f.px(x, y, 'clear')
    nape = rbox(atlas, 'hair_nape', HW - 0.03, napeH, 0.1, 0.045, {'all': lambda f, s: f.fill(strand), 'back': nape_back})
    add(nape, (0, HD / 2 - 0.03, HH - napeH / 2 - 0.1))
    if style == 'buns':
        for sx in (-1, 1):
            b = rbox(atlas, 'bun', 0.21, 0.2, 0.21, 0.095, {'all': lambda f, s: f.fill(strand)})
            add(b, (sx * (HW / 2 - 0.03), 0.02, HH + 0.1))
            tie = rbox(atlas, 'tie', 0.12, 0.05, 0.12, 0.022, {'all': lambda f, s: f.fill(lambda x, y: '#f4c040' if (x + y) % 3 else '#d89a20')})
            add(tie, (sx * (HW / 2 - 0.05), 0.02, HH + 0.005))
    if style == 'messy':
        for (x, y, s, rot) in [(-0.13, -0.06, 0.12, (0.5, 0.15, 0.6)), (0.12, 0.04, 0.13, (-0.45, 0.25, -0.5)), (0.0, -0.16, 0.11, (0.7, 0, 0.15)), (0.05, 0.16, 0.1, (-0.6, 0, 0.3))]:
            t = rbox(atlas, 'tuft', s * 0.7, s * 0.45, s * 1.5, s * 0.2, {'all': lambda f, s_: f.fill(strand)})
            t.rotation_euler = rot
            add(t, (x, y, HH + 0.1))
    if style == 'crop':
        pass

# ---------------------------------------------------------------- hats
def build_hat(atlas, cfg, head, add):
    HW, HH, HD = head
    if cfg.get('hat') == 'bucket':
        c = '#5f8050'
        def band(f, s):
            f.fill(lambda x, y: tone(c, -0.06) if hsh(x, y, 31) > 0.85 else c)
            f.rect(0, f.h - 2, f.w, 2, tone(c, -0.2))
            if s == 'front': f.rect(f.w - 5, f.h - 4, 3, 2, '#e8c040')  # little lure pin
        add(rbox(atlas, 'hat_crown', HW + 0.08, 0.22, HD + 0.08, 0.1, {'all': band}), (0, 0, HH + 0.06))
        add(rbox(atlas, 'hat_brim', HW + 0.32, 0.05, HD + 0.32, 0.025, {'all': lambda f, s: f.fill(lambda x, y: tone(c, -0.12) if (x + y) % 5 == 0 else tone(c, -0.06))}), (0, 0, HH - 0.04))

# ---------------------------------------------------------------- clothes
def shirt_pattern(kind, c):
    dark, light, deep = tone(c, -0.25), tone(c, 0.2), tone(c, -0.42)
    if kind == 'flannel':
        def fn(x, y):
            vx, hy = (x % 6) < 2, (y % 6) < 2
            if vx and hy: return deep
            if vx or hy: return dark
            return light if (x + y) % 6 == 3 else c
        return fn
    return lambda x, y: tone(c, -0.05) if hsh(x, y, 41) > 0.9 else c

def paint_torso(f, side, cfg, skin):
    c = cfg['shirtColor']; kind = cfg['shirt']; pants = cfg['pantsColor']
    pat = shirt_pattern(kind, c); dark = tone(c, -0.25)
    f.fill(pat)
    W, H, cx = f.w, f.h, f.w // 2
    front = side == 'front'
    if side == 'top':
        if kind == 'tee': f.rect(cx - 3, f.h // 2 - 2, 6, 4, skin)
        return
    if kind == 'tee':
        f.rect(0, H - 3, W, 3, pants); f.rect(0, H - 3, W, 1, tone(pants, -0.2))
        f.rect(0, H - 4, W, 1, '#5a3a20')
        if front:
            f.rect(cx - 1, H - 4, 2, 1, '#e0b840')
            f.rect(cx - 2, 0, 4, 2, skin); f.px(cx - 3, 0, tone(c, -0.18)); f.px(cx + 2, 0, tone(c, -0.18))
            # tiny fish print
            for (x, y, col) in [(-2, 5, '#f4f0e0'), (-1, 5, '#f4f0e0'), (0, 5, '#f4f0e0'), (-1, 4, '#f4f0e0'), (-1, 6, '#f4f0e0'), (1, 4, '#f4f0e0'), (1, 6, '#f4f0e0'), (-2, 5, '#2a2a2a')]:
                f.px(cx + x, y, col)
    elif kind == 'hoodie':
        f.rect(0, H - 2, W, 2, dark)
        if front:
            f.rect(cx - 4, H - 7, 8, 4, dark); f.rect(cx - 4, H - 7, 8, 1, tone(dark, -0.15))
            f.rect(cx - 2, 0, 1, 6, '#f0f0f0'); f.rect(cx + 1, 0, 1, 6, '#f0f0f0'); f.px(cx - 2, 6, '#c0c0c0'); f.px(cx + 1, 6, '#c0c0c0')
            f.rect(cx - 3, 0, 6, 1, dark)
    elif kind == 'flannel':
        if front:
            f.rect(cx, 0, 1, H - 1, tone(c, -0.45))
            for y in range(2, H - 1, 3): f.px(cx - 1, y, '#f0ead8')
            f.rect(cx - 3, 0, 2, 2, tone(c, 0.15)); f.rect(cx + 1, 0, 2, 2, tone(c, 0.15))
            f.rect(2, 4, 4, 3, tone(c, -0.3)); f.rect(2, 4, 4, 1, tone(c, -0.12))  # pocket
    if cfg.get('accessory') == 'acc_vest' and side in ('front', 'left', 'right'):
        v = '#7a8a5a'
        for y in range(1, H - 1):
            for x in range(W):
                if not front or abs(x - cx + 0.5) > 2.5: f.px(x, y, tone(v, -0.1) if hsh(x, y, 5) > 0.85 else v)
        if front:
            for x0 in (1, W - 6):
                f.rect(x0, round(H * 0.45), 5, 4, tone(v, -0.2)); f.rect(x0, round(H * 0.45), 5, 1, tone(v, 0.1)); f.px(x0 + 2, round(H * 0.45) + 1, '#d8c060')
            f.px(cx + 4, 3, '#e8c040'); f.px(cx + 5, 3, '#c03030')  # a lure clipped to the vest

def paint_arm(f, side, cfg, skin):
    c = cfg['shirtColor']; kind = cfg['shirt']
    pat = shirt_pattern(kind, c)
    short = kind == 'tee'
    if side == 'top': f.fill(pat); return
    if side == 'bottom': f.fill(skin); return
    H = f.h
    end = round(H * 0.32) if short else H - 3
    f.fill(lambda x, y: pat(x, y) if y < end else skin)
    f.rect(0, end - 1, f.w, 1, tone(c, -0.28 if not short else -0.15))
    f.rect(0, H - 1, f.w, 1, tone(skin, -0.12))

def paint_leg(f, side, cfg, skin):
    pants = cfg['pantsColor']; kind = cfg['pants']; H = f.h
    rows = 0 if kind == 'skirt' else H
    def pat(x, y):
        if kind == 'jeans': return tone(pants, 0.12) if (x + y * 2) % 7 == 0 else (tone(pants, -0.08) if hsh(x, y, 51) > 0.85 else pants)
        return tone(pants, -0.06) if hsh(x, y, 52) > 0.88 else pants
    if side == 'top': f.fill(pants); return
    f.fill(lambda x, y: pat(x, y) if y < rows else skin)
    if kind == 'jeans' and side in ('left', 'right'): f.rect(f.w // 2, 0, 1, rows, tone(pants, -0.18))
    if kind == 'cargo' and side in ('left', 'right'):
        f.rect(1, round(H * 0.3), f.w - 2, 4, tone(pants, -0.15)); f.rect(1, round(H * 0.3), f.w - 2, 1, tone(pants, 0.1))
    if kind == 'skirt' and side == 'front':  # socks peeking over the boots
        f.rect(0, H - 4, f.w, 3, '#f4f0e8'); f.rect(0, H - 4, f.w, 1, '#d84a5a')

SHOES = {
    'boots': {'c': '#3e6a3a', 'sole': '#2a2a2a', 'h': 0.17},
    'sneakers': {'c': '#f2f2f0', 'sole': '#c0392b', 'h': 0.11},
    'hiking': {'c': '#6a4a2a', 'sole': '#2a2a2a', 'h': 0.14, 'lace': '#d8c090'},
}
def paint_shoe(f, side, cfg):
    s = SHOES[cfg['shoes']]
    if side == 'bottom': f.fill(s['sole']); return
    f.fill(lambda x, y: tone(s['c'], -0.08) if hsh(x, y, 61) > 0.88 else s['c'])
    if side != 'top':
        f.rect(0, f.h - 2, f.w, 2, s['sole']); f.rect(0, 0, f.w, 1, tone(s['c'], 0.18))
    if side == 'top' and s.get('lace'):
        for y in range(1, f.h - 2, 2): f.rect(f.w // 2 - 1, y, 2, 1, s['lace'])
    if cfg['shoes'] == 'sneakers' and side in ('left', 'right'):
        f.rect(2, f.h // 2 - 1, f.w - 4, 1, '#c0392b')

# ---------------------------------------------------------------- material
def make_material(name, img):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img; tex.interpolation = 'Closest'
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
    bsdf.inputs['Roughness'].default_value = 0.8
    if 'Specular IOR Level' in bsdf.inputs: bsdf.inputs['Specular IOR Level'].default_value = 0.25
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    try: m.surface_render_method = 'DITHERED'
    except Exception: pass
    return m

# ---------------------------------------------------------------- character
def build_character(cfg, name, location=(0, 0, 0)):
    coll = bpy.data.collections.get('SoftStyle') or bpy.data.collections.new('SoftStyle')
    if coll.name not in bpy.context.scene.collection.children: bpy.context.scene.collection.children.link(coll)
    old = bpy.data.objects.get(name)
    if old:
        for ch in list(old.children_recursive): bpy.data.objects.remove(ch, do_unlink=True)
        bpy.data.objects.remove(old, do_unlink=True)
    atlas = Atlas()
    skin = cfg['skin']
    TW = {'broad': 0.6, 'standard': 0.54, 'slim': 0.48}[cfg.get('frame', 'standard')]
    TH, TD = 0.44, 0.32
    AW = {'broad': 0.19, 'standard': 0.17, 'slim': 0.15}[cfg.get('frame', 'standard')]
    AH = 0.4
    LW, LD = 0.21, 0.23
    LH = {'short': 0.24, 'medium': 0.3, 'tall': 0.38}[cfg.get('height', 'medium')]
    head = (0.6, 0.54, 0.54)
    root = bpy.data.objects.new(name, None)
    root.empty_display_size = 0.3
    coll.objects.link(root)
    parts = []
    def add(ob, loc, parent=root):
        coll.objects.link(ob)
        ob.parent = parent
        ob.location = loc
        parts.append(ob)
        return ob
    shoe = SHOES[cfg['shoes']]
    for sx in (-1, 1):
        x = sx * (LW / 2 + 0.015)
        add(rbox(atlas, 'leg', LW, LH, LD, 0.06, {'all': lambda f, s: paint_leg(f, s, cfg, skin)}), (x, 0, LH / 2))
        add(rbox(atlas, 'shoe', LW + 0.03, shoe['h'], LD + 0.08, min(0.06, shoe['h'] / 2.2), {'all': lambda f, s: paint_shoe(f, s, cfg)}), (x, -0.04, shoe['h'] / 2 - 0.01))
    by = LH
    add(rbox(atlas, 'torso', TW, TH, TD, 0.08, {'all': lambda f, s: paint_torso(f, s, cfg, skin)}), (0, 0, by + TH / 2))
    if cfg['pants'] == 'skirt':
        p = cfg['pantsColor']
        def skirt(f, s):
            f.fill(lambda x, y: tone(p, -0.14) if x % 3 == 0 else (tone(p, 0.08) if y == 0 else p))
            f.rect(0, f.h - 1, f.w, 1, tone(p, -0.25))
        add(rbox(atlas, 'skirt', TW + 0.1, 0.2, TD + 0.12, 0.07, {'all': skirt}), (0, 0, by + 0.02))
    if cfg['shirt'] == 'hoodie':
        add(rbox(atlas, 'hood', TW * 0.78, 0.17, 0.13, 0.055, {'all': lambda f, s: f.fill(tone(cfg['shirtColor'], -0.12))}), (0, TD / 2 + 0.03, by + TH - 0.02))
    if cfg.get('accessory') == 'acc_backpack':
        def bp(f, s):
            f.fill(lambda x, y: '#b86a30' if hsh(x, y, 71) > 0.88 else '#c87a3a')
            f.rect(0, 0, f.w, 2, '#8a5a2a')
            if s == 'back':
                f.rect(2, f.h // 2, f.w - 4, round(f.h * 0.35), '#a85e28'); f.rect(2, f.h // 2, f.w - 4, 1, '#d89050')
                f.px(f.w // 2, f.h // 2 + 1, '#e0c040')
        add(rbox(atlas, 'backpack', TW * 0.8, TH * 0.84, 0.19, 0.07, {'all': bp}), (0, TD / 2 + 0.09, by + TH * 0.5))
        for sx in (-1, 1):
            add(rbox(atlas, 'strap', 0.05, TH * 0.9, 0.03, 0.012, {'all': lambda f, s: f.fill('#8a5a2a')}), (sx * TW * 0.25, -TD / 2 - 0.005, by + TH * 0.5))
    for sx in (-1, 1):
        add(rbox(atlas, 'arm', AW, AH, AW, 0.06, {'all': lambda f, s: paint_arm(f, s, cfg, skin)}), (sx * (TW / 2 + AW / 2 + 0.005), 0, by + TH - 0.04 - AH / 2))
    hz = by + TH - 0.02
    headroot = bpy.data.objects.new(name + '_head', None)
    coll.objects.link(headroot); headroot.parent = root; headroot.location = (0, 0, hz)
    def addh(ob, loc): return add(ob, loc, headroot)
    def head_all(f, s): f.fill(lambda x, y: tone(skin, -0.03) if hsh(x, y, 8) > 0.94 else skin)
    addh(rbox(atlas, 'head', head[0], head[1], head[2], 0.1, {
        'front': lambda f, s: paint_face(f, cfg, skin),
        'right': lambda f, s: paint_side_head(f, skin, 'right'),
        'left': lambda f, s: paint_side_head(f, skin, 'left'),
        'all': head_all}), (0, 0, head[1] / 2))
    if cfg.get('facialHair') == 'beard':
        hair = cfg['hairColor']
        addh(rbox(atlas, 'jaw', head[0] * 0.78, 0.11, 0.1, 0.045, {'all': lambda f, s: f.fill(lambda x, y: tone(hair, 0.1) if hsh(x, y, 4) > 0.7 else tone(hair, -0.05))}), (0, -head[2] / 2 + 0.035, 0.0))
    build_hair(atlas, cfg, head, addh)
    build_hat(atlas, cfg, head, addh)
    img = atlas.image(name + '_atlas')
    mat = make_material(name + '_mat', img)
    for ob in parts:
        ob.data.materials.clear(); ob.data.materials.append(mat)
    root.location = location
    return root

SAMPLES = {
    # the player's own current look (Misty Newt)
    'soft_misty': dict(frame='slim', height='medium', skin='#f7d0b0', hair='buns', hairColor='#8a2a1a', eyes='wink', eyeColor='#3a2a1a',
                       brows='bold', mouth='toothy', extras=['blush'], shirt='tee', shirtColor='#4aa0a0', pants='skirt', pantsColor='#3a5a8a', shoes='boots'),
    'soft_angler': dict(frame='broad', height='tall', skin='#b4784a', hair='crop', hairColor='#2a1c14', eyes='round', eyeColor='#5a3a1a', brows='bold',
                        mouth='smile', facialHair='beard', hat='bucket', shirt='flannel', shirtColor='#c0392b', pants='jeans', pantsColor='#3a5a8a',
                        shoes='hiking', accessory='acc_vest'),
    'soft_drifter': dict(frame='standard', height='short', skin='#e4ac84', hair='messy', hairColor='#40c0c0', eyes='round', eyeColor='#3a6a9a',
                         brows='soft', mouth='grin', extras=['glassesRound', 'freckles'], shirt='hoodie', shirtColor='#8a4aa0', pants='cargo',
                         pantsColor='#5a4a32', shoes='sneakers', accessory='acc_backpack'),
}

def build_all():
    out = []
    for i, (n, cfg) in enumerate(SAMPLES.items()):
        out.append(build_character(cfg, n, location=((i - 1) * 1.15, 0, 0)))
    return out


# ---------------------------------------------------------------- look-test renders
def render_views(out_dir, names, prefix='softstyle'):
    import os
    scene = bpy.context.scene
    cam = bpy.data.objects.get('SoftCam')
    if not cam:
        cam = bpy.data.objects.new('SoftCam', bpy.data.cameras.new('SoftCam'))
        scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.lens = 70
    scene.render.resolution_x, scene.render.resolution_y = 1400, 900
    scene.render.film_transparent = False
    hide = [o for o in bpy.data.objects if o.type in ('MESH', 'EMPTY') and not o.name.startswith('soft_') and not (o.parent and o.parent.name.startswith('soft_'))]
    keep = {}
    for o in bpy.data.objects:
        if o.type == 'MESH':
            top = o
            while top.parent: top = top.parent
            keep[o.name] = o.hide_render
            o.hide_render = not top.name.startswith('soft_')
    def shot(fname, loc, target):
        cam.location = loc
        d = (Vector(target) - Vector(loc)); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(out_dir, fname)
        bpy.ops.render.render(write_still=True)
    shot(prefix + '_lineup.png', (1.9, -5.6, 1.9), (0, 0, 0.75))
    shot(prefix + '_closeup.png', (0.55, -2.3, 1.45), (0, 0, 1.08))
    shot(prefix + '_back.png', (-1.9, 5.6, 1.9), (0, 0, 0.75))
    for n, h in keep.items():
        o = bpy.data.objects.get(n)
        if o: o.hide_render = h
