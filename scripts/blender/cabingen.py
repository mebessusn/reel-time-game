# Reel Time: Gus's Tackle & Tide cabin and Gus the heron. Game axes: x east, y up, z south.
# Cabin voxels are 0.25 units and keep the procedural cabin's footprint (walls x 0..27, z 0..23,
# door on the east wall at z 10..13, porch east of it) so collisions and the door spot still line up.
import math

WOOD, WOOD_L, WOOD_D = '#8a5a34', '#a06c40', '#5e3c22'
LOG_END, LOG_RING = '#c89a62', '#a07848'
STONE, STONE_D, STONE_L = '#8a8a84', '#6a6a66', '#a8a8a0'
ROOF, ROOF_D, ROOF_L = '#7a3a2a', '#5e2a1e', '#94503a'
PLANK, PLANK_D = '#b08458', '#94683e'
GLASS, GLASS_L = '#a8d8e8', '#f8e8a0'
W, D, H = 28, 24, 15  # wall footprint and eave height


def hsh(*a):
    h = 2166136261
    for v in a:
        h = ((h ^ (int(v) & 0xffffffff)) * 16777619) & 0xffffffff
    return (h % 1000) / 1000.0


def box(v, x0, y0, z0, x1, y1, z1, c):
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            for z in range(z0, z1 + 1):
                v[(x, y, z)] = c(x, y, z) if callable(c) else c


def cabin():
    v = {}
    # stone foundation, a little wider than the walls
    box(v, -1, 0, -1, W, 1, D, lambda x, y, z: STONE_D if hsh(x, y, z) > 0.7 else (STONE_L if hsh(z, x, y) > 0.8 else STONE))
    # log walls: each log is 2 voxels tall, alternating tone, log ends poke out at the corners
    for y in range(2, H + 1):
        log = (y - 2) // 2
        tone = WOOD if log % 2 else WOOD_L
        top = (y - 2) % 2 == 1
        for x in range(W):
            for z in (0, D - 1):
                v[(x, y, z)] = shade_log(tone, top, x)
        for z in range(D):
            for x in (0, W - 1):
                v[(x, y, z)] = shade_log(tone, top, z)
        # corner log ends (alternate courses run long in x or z)
        for (cx, cz) in [(0, 0), (W - 1, 0), (0, D - 1), (W - 1, D - 1)]:
            if log % 2 == 0:
                v[(cx + (-1 if cx == 0 else 1), y, cz)] = LOG_RING if top else LOG_END
            else:
                v[(cx, y, cz + (-1 if cz == 0 else 1))] = LOG_RING if top else LOG_END
    # floor
    box(v, 1, 1, 1, W - 2, 1, D - 2, lambda x, y, z: PLANK if x % 4 else PLANK_D)
    # windows with frames, glow panes and flower boxes on north and south walls
    for wx in (5, 18):
        for z, out in ((0, -1), (D - 1, 1)):
            box(v, wx - 1, 6, z, wx + 4, 6, z, WOOD_D)
            box(v, wx - 1, 11, z, wx + 4, 11, z, WOOD_D)
            box(v, wx - 1, 6, z, wx - 1, 11, z, WOOD_D)
            box(v, wx + 4, 6, z, wx + 4, 11, z, WOOD_D)
            box(v, wx, 7, z, wx + 3, 10, z, lambda x, y, zz: GLASS_L if y in (8, 9) and x in (wx + 1, wx + 2) else GLASS)
            for x in range(wx, wx + 4):
                v[(x, 8, z)] = WOOD_D  # transom bar
            # flower box
            box(v, wx - 1, 5, z + out, wx + 4, 5, z + out, '#6a4024')
            for i, x in enumerate(range(wx - 1, wx + 5)):
                v[(x, 6, z + out)] = ['#f08ab0', '#f8e070', '#ffffff', '#a070e0', '#f08ab0', '#f8e070'][i] if i % 2 == 0 else '#4a8a30'
    # west wall: round window
    for (dy, dz) in [(0, 0), (1, 0), (0, 1), (1, 1), (-1, 0), (-1, 1), (2, 0), (2, 1), (0, -1), (1, -1), (0, 2), (1, 2)]:
        v[(0, 9 + dy, 11 + dz)] = GLASS if abs(dy - 0.5) + abs(dz - 0.5) < 1.5 else WOOD_D
    # east wall door with frame, step and a brass knob
    box(v, W - 1, 2, 10, W - 1, 11, 13, WOOD_D)
    box(v, W - 1, 2, 11, W - 1, 10, 12, lambda x, y, z: '#6a4024' if y % 3 else '#5a361e')
    v[(W - 1, 6, 11)] = '#e0b040'
    v[(W, 6, 11)] = '#e0b040'
    # gable roof along x with overhang, shingle courses
    ridge = D // 2
    for i in range(ridge + 2):
        y = H + 1 + i
        za, zb = -2 + i, D + 1 - i
        if za > zb:
            break
        for x in range(-2, W + 2):
            c = ROOF_D if i % 2 else (ROOF_L if hsh(x // 2, i) > 0.75 else ROOF)
            v[(x, y, za)] = c
            v[(x, y, zb)] = c
            if za == zb or za + 1 == zb:
                v[(x, y, za)] = ROOF_D
        # gable end walls (planked) under the roof
        for z in range(max(0, za + 1), min(D, zb)):
            for x in (0, W - 1):
                v[(x, y, z)] = PLANK if (z % 3) else PLANK_D
    # ridge cap
    for x in range(-2, W + 2):
        v[(x, H + ridge + 1, ridge - 1)] = ROOF_D
        v[(x, H + ridge + 1, ridge)] = ROOF_D
    # gable vent window
    for (x, dy, z) in [(W - 1, 0, ridge - 1), (W - 1, 0, ridge), (W - 1, 1, ridge - 1), (W - 1, 1, ridge)]:
        v[(x, H + 4 + dy, z)] = GLASS_L
    # stone chimney on the north slope
    box(v, 6, 2, 16, 9, H + ridge + 5, 19, lambda x, y, z: STONE_D if hsh(x, y, z) > 0.72 else STONE)
    box(v, 5, H + ridge + 5, 15, 10, H + ridge + 5, 20, STONE_D)
    box(v, 7, H + ridge + 5, 17, 8, H + ridge + 5, 18, '#2a2a28')
    # porch deck with posts, rail and an awning over the shop counter
    box(v, W, 1, 6, W + 5, 1, 17, lambda x, y, z: PLANK if z % 3 else PLANK_D)
    for (x, z) in [(W + 5, 6), (W + 5, 17)]:
        box(v, x, 2, z, x, 14, z, WOOD_D)
    # awning: striped canvas sloping down to the east
    for i in range(6):
        y = 15 - (i // 2)
        for z in range(5, 19):
            v[(W + i, y, z)] = '#3a7ab8' if (z // 2) % 2 else '#f0ead8'
    for z in range(5, 19):
        v[(W + 6, 12, z)] = '#3a7ab8' if (z // 2) % 2 else '#f0ead8'
    # shop counter on the porch, south of the door (Gus stands behind it)
    box(v, W + 4, 2, 14, W + 4, 3, 17, '#7a5230')
    box(v, W + 3, 4, 13, W + 5, 4, 17, PLANK_D)
    # bait jar and a fish on the counter
    v[(W + 4, 5, 17)] = '#a8d8c8'
    v[(W + 4, 6, 17)] = '#c8a070'
    for z, c in [(14, '#4a90e2'), (15, '#6ab0f0'), (13, '#4a90e2')]:
        v[(W + 4, 5, z)] = c
    # hanging sign: a fish board on a bracket
    box(v, W + 1, 13, 8, W + 3, 13, 8, WOOD_D)
    box(v, W + 2, 9, 7, W + 2, 12, 9, '#e8d090')
    for (y, z) in [(10, 7), (11, 7), (10, 8), (11, 8), (10, 9), (11, 9)]:
        v[(W + 3, y, z)] = '#4a90e2'
    v[(W + 3, 11, 9)] = '#1a1a1a'
    # barrels and a crate by the porch
    for (bx, bz) in [(W + 1, 4), (W + 1, 2)]:
        box(v, bx, 2, bz, bx + 1, 4, bz + 1, lambda x, y, z: '#5a5a58' if y == 3 else '#8a5a34')
    box(v, W + 4, 2, 3, W + 6, 3, 4, lambda x, y, z: '#c09060' if (x + y) % 2 else '#a07848')
    # fishing net draped on the south wall
    for x in range(10, 16):
        for y in range(4, 9):
            if (x + y) % 2 == 0:
                v[(x, y, D)] = '#d8c8a0'
    # lantern by the door
    v[(W, 11, 9)] = '#2a2a2a'
    v[(W, 10, 9)] = '#ffd060'
    v[(W, 9, 9)] = '#2a2a2a'
    return v


def shade_log(tone, top, along):
    if top:
        return tone
    return WOOD_D if along % 9 == 4 else (tone if hsh(along) > 0.3 else '#94603a')


# ---------------------------------------------------------------- Gus the heron (1/16 voxels, faces +X)

def gus():
    v = {}
    BODY, BODY_D, BELLY = '#a8bccc', '#8098ac', '#eef2f5'
    LEG, BEAK, CREST = '#d8a840', '#e8b830', '#1e2430'
    APRON, APRON_D = '#3a8a5a', '#2a6a44'
    # legs (thin, with knees)
    for s in (-1, 1):
        z = s * 1 - (1 if s < 0 else 0)
        for y in range(0, 10):
            v[(0, y, z)] = LEG
        v[(1, 0, z)] = LEG
        v[(2, 0, z)] = LEG
        v[(-1, 0, z)] = LEG
    # body: an egg tilted forward
    for x in range(-6, 5):
        for y in range(9, 19):
            for z in range(-3, 3):
                cx, cy = x + 0.5 + 0.6, y + 0.5 - 14
                if (cx / 5.2) ** 2 + (cy / 4.6) ** 2 + ((z + 0.5) / 3.2) ** 2 <= 1:
                    c = BELLY if (x >= 1 and y < 15) else (BODY_D if y > 16 or x < -3 else BODY)
                    v[(x, y, z)] = c
    # folded wings with dark tips
    for x in range(-7, 2):
        for y in range(12, 17):
            if x - y > -10 - 4 and (x + 7) + (17 - y) > 2:
                for z in (-4, 3):
                    v[(x, y, z)] = CREST if x < -4 else BODY_D
    # apron (shopkeeper!) with a pocket and strap
    for y in range(9, 15):
        for z in range(-2, 2):
            x = max(k[0] for k in v if k[1] == y and k[2] == z and k[0] > -1) if any(k[1] == y and k[2] == z and k[0] > -1 for k in v) else None
            if x is not None:
                v[(x + 1, y, z)] = APRON if y > 9 else APRON_D
    v[(5, 11, -1)] = '#f0ead8'
    v[(5, 11, 0)] = '#f0ead8'
    # S-curved neck
    neck = [(2, 18), (2, 19), (3, 20), (3, 21), (2, 22), (1, 23), (1, 24), (2, 25), (3, 26)]
    for (x, y) in neck:
        for z in (-1, 0):
            v[(x, y, z)] = BELLY if x >= 3 else BODY
            v[(x - 1, y, z)] = BODY
    # head
    for x in range(1, 6):
        for y in range(26, 30):
            for z in (-2, -1, 0, 1):
                if (x in (1, 5) and y in (26, 29)) or (z in (-2, 1) and (x in (1, 5) or y in (26, 29))):
                    continue
                v[(x, y, z)] = BELLY if y < 28 else BODY
    # dark stripe over the eye and crest plume trailing back
    for x in range(1, 6):
        for z in (-2, 1):
            v[(x, 29, z)] = CREST
    for (x, y) in [(0, 29), (-1, 29), (-2, 28), (-3, 28), (-4, 27)]:
        v[(x, y, -1)] = CREST
        v[(x, y, 0)] = CREST
    # eyes with spectacles (round gold frames)
    for z in (-3, 2):
        v[(4, 28, z)] = '#1a1a1a'
        v[(3, 28, z)] = '#ffffff'
        for (x, y) in [(5, 28), (4, 27), (3, 27), (4, 29), (3, 29), (2, 28)]:
            v[(x, y, z)] = '#c8a040'
    # long dagger beak
    for i in range(9):
        y = 27 if i < 6 else 27 - (i - 6) // 2
        v[(6 + i, y, -1)] = BEAK
        v[(6 + i, y, 0)] = BEAK
        if i < 4:
            v[(6 + i, y + 1, -1)] = BEAK
            v[(6 + i, y + 1, 0)] = BEAK
    v[(14, 26, -1)] = '#c09020'
    v[(14, 26, 0)] = '#c09020'
    # little bow tie
    for (y, z) in [(19, -2), (19, 1), (20, -2), (20, 1), (19, -1), (19, 0)]:
        v[(4, y, z)] = '#c03030'
    # tail feathers
    for (x, y) in [(-7, 13), (-8, 12), (-8, 13), (-9, 12)]:
        for z in (-1, 0):
            v[(x, y, z)] = BODY_D
    return v


MODELS = dict(cabin=(cabin, 0.25), gus=(gus, 0.0625))


def to_blender(v):
    return {(x, -z, y): c for (x, y, z), c in v.items()}


if __name__ == '__main__':
    for k, (f, s) in MODELS.items():
        v = f()
        mins = [min(p[a] for p in v) for a in range(3)]
        maxs = [max(p[a] for p in v) for a in range(3)]
        print(k, len(v), mins, maxs)
