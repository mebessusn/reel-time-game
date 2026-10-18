# Reel Time hero-fish voxel generator (pure Python; runs in Blender or plain python).
# Coordinates: x along the body (head toward +X), y across, z up. One unit = one voxel.
# Each builder returns {(x, y, z): '#rrggbb'}; Blender's rt['build'] turns it into a mesh.
import math


def _hex(c):
    c = c.lstrip('#')
    return [int(c[i:i + 2], 16) for i in (0, 2, 4)]


def mix(a, b, k):
    A, B = _hex(a), _hex(b)
    return '#%02x%02x%02x' % tuple(round(A[i] + (B[i] - A[i]) * k) for i in range(3))


def shade(c, k):
    return mix(c, '#000000', k) if k > 0 else mix(c, '#ffffff', -k)


def hsh(*a):
    h = 2166136261
    for v in a:
        h = ((h ^ (int(v) & 0xffffffff)) * 16777619) & 0xffffffff
    return (h % 1000) / 1000.0


def body(vox, L, H, W, col, zc=lambda t: 0.0, pattern=None, x0=0):
    """Elliptic cross-section body. H(t), W(t) are half sizes, t=0 tail end .. 1 nose."""
    for i in range(L):
        t = i / (L - 1)
        h, w, c0 = H(t), W(t), zc(t)
        if h <= 0 or w <= 0:
            continue
        ny, nz = math.ceil(w), math.ceil(h) + 1
        for yi in range(-ny, ny):
            yc = yi + 0.5
            for zi in range(-nz, nz):
                zcv = zi + 0.5
                if (yc / w) ** 2 + ((zcv - c0) / h) ** 2 > 1.0:
                    continue
                rel = (zcv - c0) / h  # -1 belly .. +1 back
                if rel > 0.45:
                    c = shade(col['base'], 0.18)
                elif rel > -0.15:
                    c = col['base']
                elif rel > -0.45:
                    c = mix(col['base'], col['belly'], 0.55)
                else:
                    c = col['belly']
                if pattern:
                    p = pattern(i + x0, yi, zi, t, rel)
                    if p:
                        c = p
                vox[(i + x0, yi, zi)] = c
    return vox


def top(vox, x):
    return max(z for (xx, y, z) in vox if xx == x and y in (-1, 0)) + 1


def bot(vox, x):
    return min(z for (xx, y, z) in vox if xx == x and y in (-1, 0)) - 1


def put(vox, pts, c, mirror=False):
    for (x, y, z) in pts:
        vox[(x, y, z)] = c
        if mirror:
            vox[(x, -y - 1, z)] = c


def eye(vox, x, z, y_half, white='#f4f0e6', pupil='#141018'):
    # 2x2 eye on each flank: pupil toward the front, a highlight dot behind.
    for s in (1, -1):
        y = y_half if s > 0 else -y_half - 1
        put(vox, [(x, y, z), (x, y, z + 1)], pupil)
        put(vox, [(x - 1, y, z + 1)], white)
        put(vox, [(x - 1, y, z)], pupil)


def tail_fork(vox, x_end, zc, span, depth, c, c2=None):
    """Forked tail behind x_end (exclusive), extending -X. span = half height at the tips."""
    for d in range(1, depth + 1):
        k = d / depth
        top = round(1 + span * k)
        notch = round(span * k * 0.55) if k > 0.45 else -1
        for z in range(-top, top):
            if abs(z + 0.5) < notch:
                continue
            for y in (-1, 0):
                vox[(x_end - d, y, round(zc) + z)] = c2 if (c2 and d == depth) else c


def fin_line(vox, xs, z_base, heights, c, up=True, y=(-1, 0), c_tip=None):
    for x, h in zip(xs, heights):
        zb = z_base if z_base is not None else (top(vox, x) if up else bot(vox, x))
        for k in range(h):
            z = zb + k if up else zb - k
            for yy in y:
                vox[(x, yy, z)] = c_tip if (c_tip and k == h - 1) else c


def pectoral(vox, x, z, y_half, length, c):
    for k in range(length):
        for s in (1, -1):
            y = (y_half + k) if s > 0 else (-y_half - 1 - k)
            vox[(x - k, y, z - (k // 2))] = c
            vox[(x - k - 1, y, z - (k // 2))] = c


# ---------------------------------------------------------------- species

def crystalpike():
    col = dict(base='#a8e0f0', belly='#f0faff', accent='#68c0e0', fin='#c8f0ff')
    L = 34
    H = lambda t: 1.2 + 2.4 * math.sin(min(1, t * 1.15) * math.pi) ** 0.7 if t < 0.86 else max(0.9, 3.0 - (t - 0.86) * 18)
    W = lambda t: 0.8 + 1.7 * math.sin(min(1, t * 1.1) * math.pi) ** 0.8 if t < 0.88 else max(0.7, 2.2 - (t - 0.88) * 12)

    def pat(x, y, z, t, rel):
        if abs(rel) < 0.18 and 0.15 < t < 0.85 and (x % 3 == 0):
            return '#e8fdff'  # glowing lateral dashes
        if rel > 0.3 and hsh(x, y, z) > 0.82:
            return col['accent']  # facet flecks
        return None
    v = body({}, L, H, W, col, pattern=pat)
    # long duckbill snout
    for k in range(5):
        put(v, [(L + k, -1, 0), (L + k, 0, 0), (L + k, -1, -1), (L + k, 0, -1)], shade(col['base'], 0.08) if k < 4 else '#5a90a8')
    put(v, [(L + k, y, -1) for k in range(5) for y in (-1, 0)], col['belly'])
    eye(v, L - 3, 0, 2, pupil='#1a3a58')
    # crystal shards along the back (pike dorsal is far back; crystals ride the ridge)
    shards = [(9, 4), (12, 6), (15, 5), (18, 3), (21, 2)]
    for x, h in shards:
        tz = top(v, x)
        for k in range(h):
            c = '#ffffff' if k == h - 1 else ('#d8f8ff' if k % 2 else '#88d8f0')
            v[(x, -1, tz + k)] = c
            v[(x, 0, tz + k)] = c
            if k < h - 2:
                v[(x + 1, -1, tz + k)] = '#68c0e0'
                v[(x + 1, 0, tz + k)] = '#68c0e0'
    # anal fin mirror below
    fin_line(v, range(7, 12), None, [2, 3, 3, 2, 1], col['fin'], up=False)
    pectoral(v, L - 8, -1, 2, 3, col['fin'])
    tail_fork(v, 0, 0, 4, 6, col['fin'], '#ffffff')
    return v


def stormsturgeon():
    col = dict(base='#3a4058', belly='#a8b0c8', accent='#f0e060', fin='#2a3048')
    L = 38
    H = lambda t: (1.0 + 2.6 * min(1, t * 2.2)) if t < 0.8 else max(1.0, 3.6 - (t - 0.8) * 13)
    W = lambda t: (0.9 + 2.4 * min(1, t * 2.0)) if t < 0.82 else max(0.8, 3.3 - (t - 0.82) * 12)
    zc = lambda t: -0.5 * max(0, t - 0.8) * 5

    def bolt(x):  # zigzag lightning stripe height along the flank
        return [0, 1, 2, 1, 0, -1, 0, 1, 2, 1][x % 10] - 0.5

    def pat(x, y, z, t, rel):
        if 0.12 < t < 0.8 and abs(abs(y + 0.5) - W(t)) < 1.2 and abs((z + 0.5) - bolt(x)) < 0.6:
            return col['accent']
        return None
    v = body({}, L, H, W, col, zc=zc, pattern=pat)
    # bony scutes: pale knobs along the back ridge and the flanks
    for x in range(6, L - 6, 3):
        tz = top(v, x)
        put(v, [(x, -1, tz), (x, 0, tz)], '#c8cfdc')
    # pointed, slightly upturned snout
    for k in range(6):
        z = -1 + (1 if k >= 4 else 0)
        put(v, [(L + k, -1, z), (L + k, 0, z)], shade(col['base'], -0.15))
    # barbels under the snout
    put(v, [(L + 1, -1, -2), (L + 1, -1, -3), (L + 1, 0, -2), (L + 1, 0, -3)], '#1e2236')
    eye(v, L - 4, 0, 2, pupil='#0e0e16', white='#f0e060')
    # dorsal far back
    fin_line(v, range(7, 12), None, [1, 2, 3, 2, 1], col['fin'])
    fin_line(v, range(7, 11), None, [1, 2, 2, 1], col['fin'], up=False)
    pectoral(v, L - 9, -2, 3, 4, col['fin'])
    # heterocercal tail: long upper lobe
    for d in range(1, 8):
        for z in range(0, 1 + d):
            for y in (-1, 0):
                v[(-d, y, z)] = col['fin'] if d < 7 else col['accent']
    for d in range(1, 5):
        for z in range(-d, 0):
            for y in (-1, 0):
                v[(-d, y, z)] = col['fin']
    return v


def lanternfish():
    col = dict(base='#2a1a40', belly='#5a3a80', accent='#ffd060', fin='#4a2a70')
    L = 24
    H = lambda t: 1.6 + 3.6 * (t ** 0.6) if t < 0.85 else 5.0 - (t - 0.85) * 12
    W = lambda t: 1.0 + 2.2 * (t ** 0.7) if t < 0.88 else 3.0 - (t - 0.88) * 10

    def pat(x, y, z, t, rel):
        if rel < -0.5 and x % 3 == 0 and 0.15 < t < 0.85:
            return '#ffe890'  # photophores along the belly
        if rel > 0.2 and hsh(x, y, z) > 0.88:
            return '#3a2858'
        return None
    v = body({}, L, H, W, col, pattern=pat)
    # big underslung jaw with teeth
    for y in range(-3, 3):
        put(v, [(L, y, -2), (L, y, -3), (L + 1, y, -3)], shade(col['base'], 0.2))
        if y in (-3, -1, 1):
            v[(L + 1, y, -2)] = '#f4efe0'
    # angler stalk curving forward with a glowing lantern
    tz = top(v, L - 4)
    stalk = [(L - 4, tz), (L - 4, tz + 1), (L - 3, tz + 2), (L - 2, tz + 3), (L - 1, tz + 4), (L, tz + 4), (L + 1, tz + 3)]
    for x, z in stalk:
        put(v, [(x, -1, z), (x, 0, z)], '#6a4a90')
    bx, bz = L + 2, tz + 1
    for dx in range(0, 2):
        for dz in range(0, 3):
            for y in (-2, -1, 0, 1):
                v[(bx + dx, y, bz + dz)] = '#ffd060' if (y in (-1, 0) or dz == 1) else '#ffb030'
    v[(bx + 1, -1, bz + 2)] = '#fff8d8'
    eye(v, L - 3, 1, 3, pupil='#ffd060', white='#fff8d8')
    fin_line(v, range(4, 10), None, [1, 2, 3, 3, 2, 1], col['fin'], c_tip='#8a5ac0')
    fin_line(v, range(4, 9), None, [1, 2, 2, 2, 1], col['fin'], up=False)
    pectoral(v, L - 8, -1, 3, 3, col['fin'])
    tail_fork(v, 0, 0, 3, 5, col['fin'], '#ffd060')
    return v


def paddlefish():
    col = dict(base='#7a8a9a', belly='#d8dee4', accent='#4a5a6a', fin='#6a7a8a')
    L = 28
    H = lambda t: 1.0 + 2.6 * math.sin(min(1, t * 1.1) * math.pi / 1.0) ** 0.6 if t < 0.85 else 2.8 - (t - 0.85) * 6
    W = lambda t: 0.8 + 2.2 * math.sin(min(1, t * 1.1) * math.pi) ** 0.6 if t < 0.85 else 2.4 - (t - 0.85) * 6

    def pat(x, y, z, t, rel):
        if rel > -0.2 and hsh(x, y, z, 7) > 0.84:
            return col['accent']
        return None
    v = body({}, L, H, W, col, pattern=pat)
    # the paddle: long flat rostrum, widening toward the tip
    for k in range(12):
        half = 1 if k < 5 else 2
        for y in range(-half, half):
            v[(L + k, y, 0)] = '#8a9aa8' if (k + y) % 4 else '#6a7a88'
    put(v, [(L + 11, y, 0) for y in (-2, 1)], '#5a6a78')
    # wide gaping mouth line
    put(v, [(L - 1, y, -2) for y in range(-3, 3)], '#3a4250')
    eye(v, L - 2, 0, 2)
    fin_line(v, range(8, 12), None, [1, 3, 2, 1], col['fin'])
    fin_line(v, range(7, 11), None, [1, 2, 2, 1], col['fin'], up=False)
    pectoral(v, L - 7, -1, 2, 3, col['fin'])
    # shark-like tail
    for d in range(1, 7):
        for z in range(0, d + 1):
            for y in (-1, 0):
                v[(-d, y, z)] = col['fin']
        for z in range(-max(1, d - 1), 0):
            for y in (-1, 0):
                v[(-d, y, z)] = col['fin']
    return v


def gloweel():
    col = dict(base='#2a5a5a', belly='#4ae0c0', accent='#8affe8', fin='#3a8a80')
    L = 44
    H = lambda t: 0.9 + 0.8 * min(1, t * 3) if t < 0.92 else 1.7 - (t - 0.92) * 8
    W = lambda t: 0.6 + 0.6 * min(1, t * 3)

    def pat(x, y, z, t, rel):
        if abs(rel) < 0.35 and x % 4 in (0, 1) and t < 0.9:
            return col['accent']
        return None
    v = body({}, L, H, W, col, pattern=pat)
    # continuous dorsal and anal ribbon fins, glowing edge
    xs = list(range(1, L - 10))
    fin_line(v, xs, None, [2] * len(xs), col['fin'], c_tip='#6affd8')
    fin_line(v, xs[:-6], None, [1] * (len(xs) - 6), col['fin'], up=False, c_tip='#6affd8')
    put(v, [(0, -1, z) for z in range(-2, 3)] + [(0, 0, z) for z in range(-2, 3)], '#6affd8')
    eye(v, L - 3, 0, 1, pupil='#0a1a1a', white='#aaffee')
    put(v, [(L, -1, 0), (L, 0, 0), (L, -1, -1), (L, 0, -1)], shade(col['base'], 0.1))
    pectoral(v, L - 6, 0, 1, 2, col['fin'])
    return v


def moonfin():
    col = dict(base='#c8d0f0', belly='#f0f4ff', accent='#8a9ae0', fin='#e0e8ff')
    L = 20
    H = lambda t: 2.0 + 6.0 * math.sin(min(1, t * 1.05) * math.pi) ** 0.55 if t < 0.95 else 3.0
    W = lambda t: 0.8 + 1.0 * math.sin(t * math.pi) ** 0.5

    cx, cz, r = 9, 0.5, 3.6  # crescent moon on the flank

    def pat(x, y, z, t, rel):
        d1 = math.hypot(x - cx, z + 0.5 - cz)
        d2 = math.hypot(x - cx - 1.6, z + 0.5 - cz - 1.0)
        if abs(y + 0.5) > 0.9 and d1 <= r and d2 > r * 0.85:
            return '#fff6c8'
        if rel > 0.5 and hsh(x, z) > 0.7:
            return col['accent']
        return None
    v = body({}, L, H, W, col, pattern=pat)
    body_only = dict(v)
    # tall sickle dorsal and anal fins sweeping back
    for i, h in enumerate([1, 2, 4, 5, 6, 5, 3, 2]):
        x = 6 + i
        tz, bz = top(body_only, x), bot(body_only, x)
        for k in range(h):
            for y in (-1, 0):
                v[(x - k // 2, y, tz + k)] = col['fin'] if k < h - 1 else '#ffffff'
                v[(x - k // 2, y, bz - k)] = col['fin'] if k < h - 1 else '#ffffff'
    eye(v, L - 3, 1, 1, pupil='#28305a')
    put(v, [(L, -1, 0), (L, 0, 0)], shade(col['base'], 0.2))
    pectoral(v, L - 7, 0, 2, 3, col['fin'])
    tail_fork(v, 0, 0.5, 4, 4, col['fin'], '#ffffff')
    return v


def ghostkoi():
    col = dict(base='#e8f0f8', belly='#ffffff', accent='#a8c8e8', fin='#d0e0f0')
    L = 28
    H = lambda t: 1.2 + 3.0 * math.sin(min(1, t * 1.05) * math.pi) ** 0.6 if t < 0.88 else 3.2 - (t - 0.88) * 10
    W = lambda t: 1.0 + 2.2 * math.sin(min(1, t * 1.05) * math.pi) ** 0.6 if t < 0.88 else 2.6 - (t - 0.88) * 8
    blobs = [(20, 2.5, 3.2), (12, 1.5, 3.4), (6, 1.0, 2.2)]

    def pat(x, y, z, t, rel):
        if rel < -0.3:
            return None
        for bx, bz, br in blobs:
            if math.hypot(x - bx, (z + 0.5) - bz) < br + (hsh(x, z) - 0.5):
                return '#9ab8e0' if hsh(x, y, z, 3) > 0.25 else '#b8d0f0'
        return None
    v = body({}, L, H, W, col, pattern=pat)
    # whisker barbels and lips
    put(v, [(L, -1, -1), (L, 0, -1)], '#f0d8e0')
    put(v, [(L, 1, -2), (L, 1, -3), (L, -2, -2), (L, -2, -3)], '#d8e4f0')
    eye(v, L - 3, 0, 2, pupil='#3a5a8a')
    # long flowing butterfly fins
    fin_line(v, range(8, 20), None, [1, 2, 2, 3, 3, 3, 3, 2, 2, 2, 1, 1], col['fin'], c_tip='#f8fcff')
    for k in range(5):
        for s in (1, -1):
            y = (2 + k) if s > 0 else (-3 - k)
            for dx in range(3):
                v[(L - 8 - k - dx, y, -2 - k // 2)] = col['fin'] if k < 4 else '#f8fcff'
    # veil tail: wide, long, gently forked
    for d in range(1, 10):
        top = min(6, 1 + d)
        for z in range(-top, top):
            if d > 6 and abs(z + 0.5) < 1.5:
                continue
            for y in (-1, 0):
                v[(-d, y, z)] = col['fin'] if d < 8 else '#f8fcff'
    return v


SPECIES = dict(crystalpike=crystalpike, stormsturgeon=stormsturgeon, lanternfish=lanternfish,
               paddlefish=paddlefish, gloweel=gloweel, moonfin=moonfin, ghostkoi=ghostkoi)

if __name__ == '__main__':
    for k, f in SPECIES.items():
        v = f()
        xs = [p[0] for p in v]; ys = [p[1] for p in v]; zs = [p[2] for p in v]
        print(k, len(v), 'x', min(xs), max(xs), 'y', min(ys), max(ys), 'z', min(zs), max(zs))
        # side silhouette (y=0 slice max), for a quick eyeball
        for z in range(max(zs), min(zs) - 1, -1):
            print(''.join('#' if any((x, y, z) in v for y in range(min(ys), max(ys) + 1)) else '.' for x in range(min(xs), max(xs) + 1)))
