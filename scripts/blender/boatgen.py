# Reel Time boat-skin voxel generator. Game coordinates: x across, y up, z along (bow toward +Z).
# Voxel size 0.125 game units: 28 long x ~15 wide, so a hull is 3.5 x 1.9 blocks like the procedural boat.
# to_blender() maps to Blender axes (bow toward -Y) so glTF export lands bow-forward in three.js.
import math

L = 28


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


def hw(z, pointed_stern=False):
    u = z / (L - 1)
    if pointed_stern:
        s = math.sin(math.pi * (u * 0.9 + 0.05))
    else:
        s = math.sin(math.pi * min(1.0, u * 0.62 + 0.38))
    return 7.0 * max(0.0, s) ** 0.6


def sheer(z, rise=1.6, stern_rise=0.5):
    u = z / (L - 1)
    return 4 + rise * u ** 4 + stern_rise * (1 - u) ** 4


def hull(v, cols, plank=None, pointed_stern=False, rise=1.6, stern_rise=0.5, floor=None, keel=None):
    """cols: dict(hull, trim, seat). plank(x,y,z) may return an override colour for the outer skin."""
    body, trim, seat = cols['hull'], cols['trim'], cols['seat']
    floor = floor or shade(seat, 0.12)
    keel = keel or shade(body, 0.35)
    tops = {}
    for z in range(L):
        H = round(sheer(z, rise, stern_rise))
        tops[z] = H
        prev = None
        for y in range(0, H + 1):
            half = max(1, round(hw(z, pointed_stern) * (0.6 + 0.4 * y / H)))
            lo = half if prev is None else min(prev, half)
            for x in range(-half, half + 1):
                wall = abs(x) >= lo or y == 0 or (z == 0 and not pointed_stern) or z == L - 1
                if not wall:
                    continue
                if y == H:
                    c = trim
                elif y == 0:
                    c = keel if abs(x) <= 1 else shade(body, 0.12)
                else:
                    c = (plank and plank(x, y, z)) or (body if (y % 2) else shade(body, 0.07))
                v[(x, y, z)] = c
            prev = half
        # floorboards
        half1 = max(1, round(hw(z, pointed_stern) * (0.6 + 0.4 / H)))
        for x in range(-half1 + 1, half1):
            if 0 < z < L - 1:
                v[(x, 1, z)] = floor if (x % 3) else shade(floor, 0.1)
    return tops


def thwart(v, z, y, c, pointed_stern=False, depth=2):
    for dz in range(depth):
        H = round(sheer(z + dz))
        half = round(hw(z + dz, pointed_stern) * (0.6 + 0.4 * y / H))
        for x in range(-half + 1, half):
            v[(x, y, z + dz)] = c if dz == 0 else shade(c, 0.08)


def oarlocks(v, tops, c, pointed_stern=False):
    z = 15
    H = tops[z]
    half = round(hw(z, pointed_stern))
    for s in (-1, 1):
        v[(s * half, H + 1, z)] = c
        v[(s * half, H + 2, z - 1)] = c
        v[(s * half, H + 2, z + 1)] = c


def side_stripe(v, y, c, pointed_stern=False):
    for (x, yy, z) in list(v.keys()):
        if yy == y and abs(x) == max(1, round(hw(z, pointed_stern) * (0.6 + 0.4 * y / round(sheer(z))))):
            v[(x, yy, z)] = c


def rowboat(cols, plank=None, lock=None, **kw):
    v = {}
    tops = hull(v, cols, plank=plank, **kw)
    thwart(v, 8, 3, cols['seat'])
    thwart(v, 17, 3, cols['seat'])
    oarlocks(v, tops, lock or shade(cols['trim'], 0.25))
    return v, tops


# ----------------------------------------------------------- skins

def boat_oak():
    cols = dict(hull='#a0703e', trim='#7a5230', seat='#c8a070')
    def plank(x, y, z):
        if (z + y * 7) % 11 == 0:
            return '#8a5e32'  # plank butt joints
        return '#a87843' if hsh(y, z // 5) > 0.5 else None
    v, tops = rowboat(cols, plank)
    # rope coil and a little lantern hook at the bow
    for (x, z) in [(-2, 22), (-1, 22), (-2, 23), (-1, 23)]:
        v[(x, 2, z)] = '#d8c090'
    v[(0, tops[L - 1] + 1, L - 1)] = '#7a5230'
    return v


def boat_blue():
    cols = dict(hull='#4a7ac0', trim='#f0f0f0', seat='#a0703e')
    def plank(x, y, z):
        if y == 1:
            return '#f0f0f0'  # white waterline band
        if y == 2:
            return '#c04030' if (z % 2 == 0) else '#c84838'
        return None
    v, tops = rowboat(cols, plank)
    # name plate on the transom: tiny white anchor
    for (x, y) in [(0, 3), (0, 2), (-1, 2), (1, 2), (0, 4), (-1, 4), (1, 4)]:
        v[(x, y, -1)] = '#f0f0f0'
    return v


def boat_birch():
    cols = dict(hull='#e8e0d0', trim='#f08ab0', seat='#c8b890')
    def plank(x, y, z):
        h = hsh(x, y, z)
        if h > 0.86:
            return '#2a2620'  # birch bark dashes
        if h > 0.78:
            return '#b8b0a0'
        return None
    v, tops = rowboat(cols, plank)
    # flowers along the gunwale
    for (s, z, c) in [(-1, 4, '#f08ab0'), (1, 7, '#f8e070'), (-1, 12, '#a070e0'), (1, 20, '#f08ab0'), (-1, 23, '#ffffff')]:
        H = tops[z]; half = round(hw(z))
        x = s * half
        v[(x, H + 1, z)] = '#4a8a30'
        v[(x, H + 2, z)] = c
        v[(x - s, H + 2, z)] = c
        v[(x, H + 2, z + 1)] = c
        v[(x, H + 2, z - 1)] = c
        v[(x, H + 3, z)] = '#f8e070'
    return v


def boat_canoe():
    cols = dict(hull='#d04a30', trim='#f0e0c0', seat='#8a4a20')
    v = {}
    tops = hull(v, cols, pointed_stern=True, rise=3.2, stern_rise=3.2)
    thwart(v, 9, 3, cols['seat'], pointed_stern=True)
    thwart(v, 18, 3, cols['seat'], pointed_stern=True)
    oarlocks(v, tops, '#6a3a18', pointed_stern=True)
    # two cream stripes and a zigzag band
    for (x, y, z) in list(v.keys()):
        half = max(1, round(hw(z, True) * (0.6 + 0.4 * y / round(sheer(z, 3.2, 3.2)))))
        if abs(x) == half and 0 < y < tops[z]:
            if y == 2:
                v[(x, y, z)] = '#f0e0c0'
            elif y == 3 and z % 4 in (0, 1):
                v[(x, y, z)] = '#2a2a2a'
    return v


def boat_duck():
    cols = dict(hull='#f0d030', trim='#f08020', seat='#f8f0c0')
    def plank(x, y, z):
        # wing feathers on the flanks
        if 8 <= z <= 19 and y >= 2 and (z - 8) % 4 == 0:
            return '#d8b020'
        return None
    v, tops = rowboat(cols, plank)
    for (x, y, z), c in list(v.items()):
        if y == tops[z]:
            v[(x, y, z)] = '#f8e060'
    # neck and head at the bow
    zb = L - 1
    H = tops[zb]
    for y in range(H + 1, H + 7):
        for x in (-1, 0, 1):
            for dz in (0, 1):
                v[(x, y, zb - 1 + dz + (1 if y > H + 4 else 0))] = '#f0d030'
    for x in (-2, -1, 0, 1, 2):
        for y in range(H + 6, H + 10):
            for dz in range(0, 4):
                v[(x, y, zb - 1 + dz)] = '#f0d030'
    for x in (-1, 0, 1):
        for dz in (4, 5):
            v[(x, H + 7, zb - 1 + dz)] = '#f08020'
            v[(x, H + 8, zb - 1 + 4)] = '#f08020'
    for s in (-1, 1):
        v[(s * 2 + s, H + 8, zb + 1)] = '#1a1a1a'
        v[(s * 2 + s, H + 9, zb + 1)] = '#ffffff'
    # perky tail at the stern
    for i, y in enumerate(range(tops[0] + 1, tops[0] + 4)):
        for x in (-1, 0, 1):
            v[(x, y, -1 - i)] = '#f0d030'
    return v


def boat_lily():
    v = {}
    pad, vein, dark = '#5ab040', '#7ad060', '#3a8a30'
    R = 12.5
    for x in range(-13, 14):
        for z in range(-13, 14):
            d = math.hypot(x, z)
            if d > R:
                continue
            ang = math.atan2(x, -z)  # notch pointing toward the stern
            if abs(ang) < 0.28 and d > 1.5:
                continue
            c = pad
            if abs(x) <= 0 or abs(abs(ang) - 1.4) < 0.05 or abs(abs(ang) - 2.4) < 0.05:
                c = vein
            if d > R - 1.2:
                c = dark
            v[(x, 0, z + 14)] = c
            if d > R - 1.2:
                v[(x, 1, z + 14)] = dark  # upturned rim
    # lotus flower on the bow side
    fx, fz = 6, 22
    for (dx, dz) in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)]:
        v[(fx + dx, 1, fz + dz)] = '#f0a0c0'
    for (dx, dz) in [(1, 1), (-1, -1), (1, -1), (-1, 1)]:
        v[(fx + dx, 2, fz + dz)] = '#f8c8d8'
    v[(fx, 2, fz)] = '#f8e070'
    # a little frog friend at the stern
    for (x, y, z, c) in [(-4, 1, 6, '#3a9a30'), (-3, 1, 6, '#3a9a30'), (-4, 1, 7, '#3a9a30'), (-3, 1, 7, '#3a9a30'),
                         (-4, 2, 7, '#4aaa40'), (-3, 2, 7, '#4aaa40'), (-4, 3, 7, '#ffffff'), (-3, 3, 7, '#ffffff')]:
        v[(x, y, z)] = c
    # cushion seat in the middle
    for x in range(-2, 3):
        for z in range(12, 16):
            v[(x, 1, z)] = '#f0a0c0' if (x + z) % 2 else '#f8b8d0'
    return v


def boat_pirate():
    cols = dict(hull='#3a2a20', trim='#c8a040', seat='#a02020')
    def plank(x, y, z):
        if y == 3 and z % 5 == 2 and 4 < z < 24:
            return '#1a1a1a'  # gun ports
        return '#4a3628' if hsh(y, z // 4) > 0.6 else None
    v, tops = rowboat(cols, plank, lock='#c8a040')
    # mast
    for y in range(2, 22):
        v[(0, y, 21)] = '#4a3020'
    # square sail with a red stripe
    for y in range(9, 19):
        for x in range(-5, 6):
            if abs(x) == 5 and y in (9, 18):
                continue
            c = '#e0e0d0' if y not in (13, 14) else '#a02020'
            v[(x, y, 20)] = c
    for x in range(-6, 7):
        v[(x, 19, 21)] = '#4a3020'
    # flag
    for y in (21, 22):
        for z in (22, 23, 24):
            v[(0, y, z)] = '#1a1a1a'
    v[(0, 22, 23)] = '#f0f0f0'
    # bowsprit
    for k in range(4):
        v[(0, tops[L - 1] + (k // 2), L + k)] = '#4a3020'
    return v


def _swan(cols, neck, wing, head, beak, eye, crystal=False):
    def plank(x, y, z):
        if crystal:
            h = hsh(x, y, z)
            return '#d8f8ff' if h > 0.8 else ('#80d8f0' if h > 0.65 else None)
        return '#e8b030' if (z + y) % 6 == 0 else None
    v, tops = rowboat(cols, plank, lock=cols['trim'])
    zb = L - 1
    H = tops[zb]
    # graceful S neck rising from the bow
    path = [(0, 0), (1, 0), (2, 0), (3, -1), (4, -1), (5, -1), (6, 0), (7, 0), (8, 1), (9, 2), (10, 2), (11, 2)]
    for (dy, dz) in path:
        for x in (-1, 0, 1):
            for t in (0, 1):
                v[(x, H + 1 + dy, zb - 1 + dz + t)] = neck
    # head and beak
    for x in (-1, 0, 1):
        for y in (H + 11, H + 12, H + 13):
            for dz in (1, 2, 3):
                v[(x, y, zb + dz)] = head
        v[(x, H + 12, zb + 4)] = beak
        v[(x, H + 12, zb + 5)] = beak
    v[(0, H + 11, zb + 5)] = beak
    for s in (-1, 1):
        v[(s * 2, H + 12, zb + 3)] = eye
    # raised wings along both sides
    for s in (-1, 1):
        for z in range(6, 22):
            hgt = round(2 + 4 * math.sin(math.pi * (z - 6) / 16) ** 1.4 * (1 - (z - 6) / 26))
            base = tops[z]
            half = round(hw(z))
            for k in range(hgt):
                c = wing if (k < hgt - 1) else cols['trim']
                if crystal and (z + k) % 3 == 0:
                    c = '#ffffff'
                v[(s * (half - (k // 3)), base + 1 + k, z)] = c
    # tail tuft
    for i in range(3):
        for x in range(-2 + i, 3 - i):
            v[(x, tops[0] + 1 + i, -1 - i)] = wing
    return v


def boat_swan():
    cols = dict(hull='#f2c040', trim='#fff0c0', seat='#c08a20')
    return _swan(cols, '#f2c040', '#f8d870', '#f2c040', '#e07020', '#1a1a1a')


def boat_crystal():
    cols = dict(hull='#a0f0ff', trim='#ffffff', seat='#60c0e0')
    v = _swan(cols, '#b8f4ff', '#d8faff', '#c8f8ff', '#60c0e0', '#205a80', crystal=True)
    # crystal shards rising from the stern quarter
    for (x, z, h) in [(-3, 3, 4), (3, 4, 3), (0, 2, 5)]:
        for k in range(h):
            v[(x, 5 + k, z)] = '#ffffff' if k == h - 1 else '#88e0f8'
    return v


def boat_oars_gold():
    cols = dict(hull='#a0703e', trim='#f2c040', seat='#c8a070')
    def plank(x, y, z):
        if y == 2:
            return '#f2c040'  # gold band
        return '#a87843' if hsh(y, z // 5) > 0.5 else None
    v, tops = rowboat(cols, plank, lock='#ffe080')
    # gold bow cap and stern plate
    for x in (-1, 0, 1):
        v[(x, tops[L - 1] + 1, L - 1)] = '#f2c040'
    for (x, y) in [(-1, 3), (0, 3), (1, 3), (0, 2)]:
        v[(x, y, -1)] = '#ffe080'
    return v


BOATS = dict(boat_oak=boat_oak, boat_blue=boat_blue, boat_birch=boat_birch, boat_canoe=boat_canoe,
             boat_duck=boat_duck, boat_lily=boat_lily, boat_pirate=boat_pirate, boat_swan=boat_swan,
             boat_crystal=boat_crystal, boat_oars_gold=boat_oars_gold)


def to_blender(v):
    # game (x, y up, z bow) -> Blender (x, -z, y): bow toward -Y, which glTF export maps back to +Z.
    return {(x, -z, y): c for (x, y, z), c in v.items()}


if __name__ == '__main__':
    for k, f in BOATS.items():
        v = f()
        xs = [p[0] for p in v]; ys = [p[1] for p in v]; zs = [p[2] for p in v]
        print(k, len(v), 'x', min(xs), max(xs), 'y', min(ys), max(ys), 'z', min(zs), max(zs))
