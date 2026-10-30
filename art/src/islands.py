# Open Waters stage 2: the island kit. Palms, rocks, huts, Kai's tiki bar, a jetty, beach furniture, a sea turtle and
# the smugglers' leftovers. Shared by all three islands (src/ocean/islands.js places them).
#   python3 art/src/islands.py      -> art/islands.blend + art/islands.glb
#   node scripts/glb-to-js.mjs art/islands.glb src/data/islandMesh.js ISLAND
# Game axes: x right, y up, z forward (the kit converts). Every piece stands on its origin.
import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
import bpy
from kit import Model, mat, reset, export

OUT = os.path.join(os.path.dirname(__file__), '..', 'islands')
G = lambda x, y, z: (x, -z, y)
reset()
TRUNK = mat('palm_trunk', '#8a6a46', 0.95)
RING = mat('palm_ring', '#6e5236', 0.95)
FROND = mat('palm_frond', '#3f8f3a', 0.85)
FROND2 = mat('palm_frond_dark', '#2f7230', 0.85)
NUT = mat('coconut', '#5a3e22', 0.8)
ROCK = mat('island_rock', '#857d70', 0.95)
ROCKD = mat('island_rock_dark', '#5e584e', 0.95)
THATCH = mat('thatch', '#c9a35a', 0.95)
THATCHD = mat('thatch_dark', '#a88440', 0.95)
WOOD = mat('island_wood', '#8a6a48', 0.9)
WOODD = mat('island_wood_dark', '#5c4632', 0.9)
BAMBOO = mat('bamboo', '#c8b070', 0.8)
CLOTH = mat('canvas_stripe', '#e0483a', 0.9)
CLOTHW = mat('canvas_white', '#f4efe2', 0.9)
TEAL = mat('paint_teal', '#2f9a9a', 0.7)
FLAME = mat('torch_flame', '#ffb040', 0.5, emit='#ff9020')
SHELL = mat('turtle_shell', '#5a6a3a', 0.6)
SKIN = mat('turtle_skin', '#8a9a6a', 0.7)
ROPE = mat('island_rope', '#d8c8a0', 0.95)
IRON = mat('rust_iron', '#6a4a36', 0.6, 0.6)
GOLD = mat('glint_gold', '#e8b830', 0.3, 0.9)
GLASS = mat('bottle_glass', '#3a8a5a', 0.15)

def palm(name, h=7.0, lean=1.6, fronds=7, seed=0):
    m = Model(name)
    pts = [G(lean * (k / 6) ** 1.6, h * k / 6, 0) for k in range(7)]
    m.part('sweep', TRUNK, points=pts, r=[0.26, 0.22, 0.2, 0.18, 0.17, 0.16, 0.15], ring=7)
    for k in range(1, 6):  # the ringed bark
        x, y = lean * (k / 6) ** 1.6, h * k / 6
        m.part('torus', RING, loc=G(x, y, 0), size=(0.2, 0.2, 0.2), tube=0.18, seg=8, ring=3)
    tx, ty = lean, h
    for i in range(fronds):
        a = i / fronds * math.tau + seed
        dx, dz = math.cos(a), math.sin(a)
        L = 3.2 + 0.4 * math.sin(i * 2.3 + seed)
        # a drooping frond: a narrow leaf shape along an arc, made of two flat strips
        for side in (-1, 1):
            pts2 = []
            for k in range(6):
                s = k / 5
                pts2.append(G(tx + dx * L * s - dz * side * 0.32 * math.sin(s * math.pi), ty + 0.5 * math.sin(s * 2.0) - 1.6 * s * s, tz := dz * L * s + dx * side * 0.32 * math.sin(s * math.pi)))
            m.part('sweep', FROND if i % 2 else FROND2, points=pts2, r=[0.05, 0.16, 0.18, 0.14, 0.09, 0.02], ring=3, squash=0.15)
    for i in range(3):
        a = i / 3 * math.tau + 0.4
        m.part('rock', NUT, loc=G(tx + math.cos(a) * 0.28, ty - 0.35, math.sin(a) * 0.28), size=(0.17, 0.17, 0.17), sub=1)
    return m.finish()

def rock(name, sx, sy, sz, seed, dark=False):
    m = Model(name)
    m.part('rock', ROCKD if dark else ROCK, loc=G(0, sy * 0.45, 0), size=(sx, sz, sy), sub=2, amp=0.25 * min(sx, sy, sz), freq=1.4, seed=seed, smooth=False)
    return m.finish()

objs = [palm('isle_palm_a', 7.2, 1.8, 7, 0.3), palm('isle_palm_b', 5.6, 0.9, 6, 1.1), palm('isle_palm_c', 8.4, 2.4, 8, 2.0)]
objs += [rock('isle_rock_a', 1.6, 1.1, 1.3, 1), rock('isle_rock_b', 3.2, 2.4, 2.6, 2, True), rock('isle_rock_c', 6.0, 7.5, 5.0, 3, True)]

# ---- v1.15.8: a beach hut on stilts: plank floor and porch, bamboo-slat walls with windows, an open door, a layered
# thatch roof, and steps that come down from the porch (front is +z)
hut = Model('isle_hut')
P = hut.part
BAMD = mat('bamboo_dark', '#a8904e', 0.8)
for x in (-1.7, 0.0, 1.7):
    for z in (-1.45, 1.45): P('cyl', WOODD, loc=G(x, 0.5, z), size=(0.1, 0.1, 0.55), seg=6)
for s in (-1, 1):
    P('cyl', WOODD, loc=G(s * 0.85, 0.45, -1.45), size=(0.035, 0.035, 0.95), seg=4, rot=(0, 62 * s, 0))  # cross braces
    P('cyl', WOODD, loc=G(s * 0.85, 0.45, 1.45), size=(0.035, 0.035, 0.95), seg=4, rot=(0, -62 * s, 0))
for k in range(9): P('box', WOOD if k % 2 else WOODD, loc=G(-1.8 + k * 0.45, 1.05, 0), size=(0.21, 1.6, 0.045))  # floor planks
for k in range(4): P('box', WOOD if k % 2 else WOODD, loc=G(0, 1.05, 1.75 + k * 0.2), size=(1.85, 0.095, 0.045))  # porch boards
for x in (-1.8, -0.5, 0.5, 1.8): P('cyl', WOODD, loc=G(x, 1.42, 2.3), size=(0.04, 0.04, 0.36), seg=5)
for x0, x1 in ((-1.8, -0.5), (0.5, 1.8)): P('box', BAMBOO, loc=G((x0 + x1) / 2, 1.74, 2.3), size=((x1 - x0) / 2, 0.025, 0.025))
for i in range(13):  # back wall: bamboo slats
    P('box', BAMBOO if i % 2 else BAMD, loc=G(-1.71 + i * 0.285, 1.95, -1.45), size=(0.13, 0.05, 0.86))
for sx in (-1, 1):  # side walls with a window
    for i in range(11):
        z = -1.35 + i * 0.27
        if -0.45 < z < 0.45: P('box', BAMBOO if i % 2 else BAMD, loc=G(sx * 1.72, 1.4, z), size=(0.05, 0.12, 0.3)); P('box', BAMBOO if i % 2 else BAMD, loc=G(sx * 1.72, 2.6, z), size=(0.05, 0.12, 0.2)); continue
        P('box', BAMBOO if i % 2 else BAMD, loc=G(sx * 1.72, 1.95, z), size=(0.05, 0.12, 0.86))
    P('box', WOODD, loc=G(sx * 1.75, 1.72, 0), size=(0.04, 0.5, 0.03)); P('box', WOODD, loc=G(sx * 1.75, 2.38, 0), size=(0.04, 0.5, 0.03))  # window frame
    P('box', WOOD, loc=G(sx * 1.85, 2.05, 0.62), size=(0.03, 0.18, 0.32), rot=(0, 0, 70 * sx))  # a shutter swung open
for i in range(13):  # front wall, with the doorway in the middle
    x = -1.71 + i * 0.285
    if abs(x) < 0.5: continue
    P('box', BAMBOO if i % 2 else BAMD, loc=G(x, 1.95, 1.45), size=(0.13, 0.05, 0.86))
P('box', BAMBOO, loc=G(0, 2.62, 1.45), size=(0.5, 0.05, 0.2))  # over the door
for x in (-0.48, 0.48): P('box', WOODD, loc=G(x, 1.85, 1.48), size=(0.04, 0.04, 0.78))
P('box', WOODD, loc=G(0.75, 1.82, 1.85), size=(0.03, 0.36, 0.72), rot=(0, 0, -60))  # the door, open
P('box', THATCHD, loc=G(0, 1.09, 1.95), size=(0.42, 0.28, 0.01))  # a woven mat
P('cyl', THATCH, loc=G(0, 3.45, 0), size=(2.75, 2.45, 0.8), seg=4, top=0.06, rot=(0, 0, 45))  # thatch, in layers
P('cyl', THATCHD, loc=G(0, 2.82, 0), size=(2.95, 2.65, 0.14), seg=4, top=0.82, rot=(0, 0, 45))
P('cyl', THATCH, loc=G(0, 3.0, 0), size=(2.35, 2.1, 0.12), seg=4, top=0.85, rot=(0, 0, 45))
P('cyl', WOODD, loc=G(0, 4.35, 0), size=(0.07, 0.07, 0.18), seg=6)  # the finial
P('cyl', BAMBOO, loc=G(0, 2.6, 2.25), size=(0.04, 0.04, 0.16), seg=5)  # the porch lantern
P('rock', FLAME, loc=G(0, 2.36, 2.25), size=(0.06, 0.06, 0.08), sub=1)
for k in range(4):  # steps: the top one at the porch edge, each lower one further out
    P('box', WOOD, loc=G(0, 0.86 - k * 0.24, 2.48 + k * 0.27), size=(0.42, 0.13, 0.035))
for x in (-0.45, 0.45): P('box', WOODD, loc=G(x, 0.5, 2.85), size=(0.035, 0.6, 0.05), rot=(-41, 0, 0))  # stringers
objs.append(hut.finish())


# ---- v1.15.8: Kai's tiki bar: a counter at chest height with a step behind it for Kai, carved tiki posts, shelves of
# bottles, coconut cups, stools, torches, a layered thatch roof, and a sign hung under the front eave (the game paints
# the name on it). Front is +z.
tk = Model('isle_tiki')
P = tk.part
BAMD = mat('bamboo_dark', '#a8904e', 0.8)
CARVE = mat('tiki_carve', '#6a4a2c', 0.9)
RED = mat('tiki_red', '#c8402a', 0.8)
for x in (-2.1, 2.1):  # back posts
    P('cyl', BAMBOO, loc=G(x, 1.25, -1.4), size=(0.11, 0.11, 1.25), seg=7)
    for y in (0.6, 1.3, 2.0): P('torus', BAMD, loc=G(x, y, -1.4), size=(0.115, 0.115, 0.115), tube=0.2, seg=8, ring=3)
for x in (-2.1, 2.1):  # front posts: carved tiki faces
    P('cyl', CARVE, loc=G(x, 1.25, 1.5), size=(0.17, 0.17, 1.25), seg=8)
    for y in (1.75, 0.95):
        for s in (-1, 1): P('rock', TEAL, loc=G(x + s * 0.07, y + 0.12, 1.66), size=(0.045, 0.02, 0.05), sub=1)  # eyes
        P('rbox', RED, loc=G(x, y - 0.06, 1.66), size=(0.09, 0.02, 0.04), r=0.015)  # mouth
        P('rbox', CARVE, loc=G(x, y + 0.24, 1.6), size=(0.19, 0.08, 0.03), r=0.02)  # brow
P('box', WOOD, loc=G(0, 2.45, 1.5), size=(2.3, 0.07, 0.07))  # front beam
P('box', WOOD, loc=G(0, 2.45, -1.4), size=(2.3, 0.07, 0.07))
P('cyl', THATCH, loc=G(0, 3.05, 0), size=(3.2, 2.6, 0.62), seg=4, top=0.05, rot=(0, 0, 45))
P('cyl', THATCHD, loc=G(0, 2.55, 0), size=(3.3, 2.7, 0.1), seg=4, top=0.86, rot=(0, 0, 45))
P('cyl', THATCH, loc=G(0, 2.7, 0), size=(2.8, 2.25, 0.1), seg=4, top=0.88, rot=(0, 0, 45))
# the counter: chest height for a customer, with a step behind for Kai
P('rbox', BAMBOO, loc=G(0, 0.43, 1.05), size=(1.95, 0.32, 0.43), r=0.05)
for i in range(14): P('cyl', BAMD if i % 2 else BAMBOO, loc=G(-1.85 + i * 0.285, 0.43, 1.38), size=(0.06, 0.06, 0.42), seg=6)  # bamboo front
P('rock', CARVE, loc=G(0, 0.5, 1.45), size=(0.22, 0.05, 0.3), sub=1)  # a tiki mask on the front
for s in (-1, 1): P('rock', TEAL, loc=G(s * 0.08, 0.6, 1.5), size=(0.04, 0.02, 0.05), sub=1)
P('rbox', RED, loc=G(0, 0.38, 1.5), size=(0.1, 0.02, 0.035), r=0.015)
P('rbox', WOOD, loc=G(0, 0.9, 1.08), size=(2.1, 0.48, 0.045), r=0.03)  # the bar top
P('rbox', WOODD, loc=G(0, 0.13, 0.35), size=(1.9, 0.5, 0.13), r=0.03)  # Kai's step (top at 0.26)
for i, x in enumerate((-1.4, -0.9, 0.9, 1.4)):  # coconut cups and a pineapple on the bar
    P('rock', NUT, loc=G(x, 1.02, 1.1), size=(0.09, 0.09, 0.08), sub=1)
    P('cyl', RED if i % 2 else TEAL, loc=G(x + 0.04, 1.14, 1.1), size=(0.008, 0.008, 0.09), seg=4, rot=(12, 0, 0))
P('rock', mat('pineapple', '#e0a830', 0.8), loc=G(-0.3, 1.05, 1.12), size=(0.08, 0.08, 0.12), sub=1)
P('cyl', FROND, loc=G(-0.3, 1.22, 1.12), size=(0.06, 0.06, 0.07), seg=5, top=0.1)
for y in (1.15, 1.6):  # back shelves of bottles
    P('rbox', WOODD, loc=G(0, y, -1.3), size=(1.8, 0.15, 0.03), r=0.02)
    for i in range(9): P('cyl', GLASS if i % 3 else TEAL, loc=G(-1.6 + i * 0.4, y + 0.14, -1.28), size=(0.05, 0.05, 0.11 + (i % 2) * 0.03), seg=6)
P('rbox', WOODD, loc=G(1.2, 1.9, -1.32), size=(0.45, 0.02, 0.3), r=0.02)  # a little menu board
P('rbox', CLOTHW, loc=G(1.2, 1.9, -1.3), size=(0.38, 0.01, 0.24), r=0.01)
for x in (-1.3, 0.0, 1.3):  # stools
    for a in range(3): P('cyl', BAMBOO, loc=G(x + math.cos(a * 2.1) * 0.12, 0.33, 1.95 + math.sin(a * 2.1) * 0.12), size=(0.025, 0.025, 0.33), seg=4)
    P('cyl', WOOD, loc=G(x, 0.68, 1.95), size=(0.2, 0.2, 0.04), seg=12)
    P('torus', BAMD, loc=G(x, 0.3, 1.95), size=(0.12, 0.12, 0.12), tube=0.15, seg=8, ring=3)
for x in (-2.8, 2.8):  # tiki torches
    P('cyl', BAMBOO, loc=G(x, 1.0, 1.9), size=(0.05, 0.05, 1.0), seg=5)
    P('cyl', WOODD, loc=G(x, 2.05, 1.9), size=(0.1, 0.07, 0.1), seg=6)
    P('rock', FLAME, loc=G(x, 2.3, 1.9), size=(0.1, 0.1, 0.18), sub=1)
for x in (-0.7, 0.7): P('sweep', ROPE, points=[G(x, 2.42, 1.62), G(x, 2.22, 1.66)], r=0.012, ring=4)  # the sign hangs on two ropes
P('rbox', WOODD, loc=G(0, 2.05, 1.66), size=(0.88, 0.035, 0.2), r=0.03)  # the sign board (the name is painted on in-game)
objs.append(tk.finish())


# ---- a short jetty (deck at y 0, out along +z), posts down into the water
jt = Model('isle_jetty')
P = jt.part
L = 9.0
for k in range(int(L / 0.45)): P('box', WOOD, loc=G(0, 0, 0.22 + k * 0.45), size=(1.1, 0.2, 0.05))
for x in (-1.0, 1.0):
    P('box', WOODD, loc=G(x, -0.12, L / 2), size=(0.08, L / 2, 0.06))
    for z in (0.4, L / 2, L - 0.3): P('cyl', WOODD, loc=G(x, -1.3, z), size=(0.12, 0.12, 1.4), seg=6)
    P('cyl', WOODD, loc=G(x, 0.3, L - 0.3), size=(0.12, 0.12, 0.3), seg=6)
    P('torus', ROPE, loc=G(x, 0.35, L - 0.3), size=(0.15, 0.15, 0.15), tube=0.25, seg=8, ring=3)
objs.append(jt.finish())

# ---- v1.15.8 beach furniture: a lounger with slats, a striped cushion and a pillow; an umbrella with ribs and a
# scalloped valance (lounger: head toward -z)
bc = Model('isle_lounger')
P = bc.part
STRIPE = mat('cushion_stripe', '#2f9a9a', 0.9)
for x in (-0.31, 0.31):
    P('box', WOODD, loc=G(x, 0.3, 0.15), size=(0.025, 0.72, 0.03))  # side rails
    for z in (-0.5, 0.75): P('cyl', WOODD, loc=G(x, 0.15, z), size=(0.03, 0.03, 0.15), seg=5)
    P('box', WOODD, loc=G(x, 0.58, -0.82), size=(0.025, 0.03, 0.38), rot=(-38, 0, 0))  # backrest rails
for k in range(9): P('box', WOOD, loc=G(0, 0.33, -0.45 + k * 0.15), size=(0.3, 0.05, 0.012))  # slats
for k in range(4): P('box', WOOD, loc=G(0, 0.58 - 0.0, -0.82), size=(0.3, 0.012, 0.36), rot=(-38, 0, 0))
P('rbox', CLOTHW, loc=G(0, 0.39, 0.2), size=(0.29, 0.6, 0.045), r=0.03)  # the seat cushion
for k in range(4): P('box', STRIPE, loc=G(0, 0.437, -0.25 + k * 0.3), size=(0.29, 0.06, 0.003))  # its stripes
P('rbox', CLOTHW, loc=G(0, 0.63, -0.78), size=(0.29, 0.045, 0.34), r=0.03, rot=(-38, 0, 0))  # the back cushion
P('rbox', STRIPE, loc=G(0, 0.88, -0.98), size=(0.22, 0.07, 0.07), r=0.06, rot=(-38, 0, 0))  # the pillow
P('rbox', CLOTH, loc=G(0.18, 0.44, 0.75), size=(0.12, 0.2, 0.012), r=0.01, rot=(0, 0, 8))  # a folded towel
objs.append(bc.finish())
um = Model('isle_umbrella')
P = um.part
P('cyl', WOODD, loc=G(0, 1.2, 0), size=(0.035, 0.035, 1.2), seg=6)
P('cyl', WOODD, loc=G(0, 0.05, 0), size=(0.16, 0.16, 0.05), seg=8, top=0.4)  # the sand anchor
P('cyl', CLOTH, loc=G(0, 2.38, 0), size=(1.45, 1.45, 0.3), seg=12, top=0.02)
P('cyl', CLOTHW, loc=G(0, 2.39, 0), size=(0.75, 0.75, 0.16), seg=12, top=0.02)  # a white crown
for i in range(12):  # scalloped valance, alternating colours
    a = i / 12 * math.tau
    P('rbox', CLOTHW if i % 2 else CLOTH, loc=G(math.cos(a) * 1.42, 2.03, math.sin(a) * 1.42), size=(0.37, 0.012, 0.07), r=0.03, rot=(0, 0, -math.degrees(a) + 90))
for i in range(6):  # ribs
    a = i / 6 * math.tau
    P('cyl', WOODD, loc=G(math.cos(a) * 0.72, 2.2, math.sin(a) * 0.72), size=(0.012, 0.012, 0.74), seg=4, rot=(0, -78, -math.degrees(a)))
P('rock', WOODD, loc=G(0, 2.72, 0), size=(0.05, 0.05, 0.06), sub=1)
objs.append(um.finish())


# ---- a sea turtle (scenery at Turtle Atoll), facing +z, origin mid-shell
tt = Model('isle_turtle')
P = tt.part
P('rock', SHELL, loc=G(0, 0.0, 0), size=(0.45, 0.6, 0.18), sub=2)
P('rock', SKIN, loc=G(0, -0.06, 0.66), size=(0.14, 0.18, 0.11), sub=2)
for s in (-1, 1):
    P('poly', SKIN, loc=G(0, -0.05, 0), points=[(s * 0.35, 0.3), (s * 0.95, 0.05), (s * 0.85, -0.05), (s * 0.35, 0.1)], depth=0.04, rot=(90, 0, 0))
    P('poly', SKIN, loc=G(0, -0.05, 0), points=[(s * 0.3, -0.4), (s * 0.55, -0.6), (s * 0.45, -0.68), (s * 0.25, -0.5)], depth=0.04, rot=(90, 0, 0))
objs.append(tt.finish())

# ---- Smuggler's Rock: a rock arch at the cave mouth, crates and barrels, an old chest
ar = Model('isle_arch')
P = ar.part
for x in (-3.0, 3.0): P('rock', ROCKD, loc=G(x, 2.5, 0), size=(1.6, 1.8, 2.8), sub=2, amp=0.35, freq=1.2, seed=x, smooth=False)
P('rock', ROCKD, loc=G(0, 5.4, 0), size=(4.4, 1.9, 1.3), sub=2, amp=0.35, freq=1.2, seed=7, smooth=False)
objs.append(ar.finish())
cr = Model('isle_crates')
P = cr.part
P('rbox', WOOD, loc=G(0, 0.4, 0), size=(0.42, 0.42, 0.4), r=0.03)
P('rbox', WOODD, loc=G(0.75, 0.35, 0.2), size=(0.35, 0.35, 0.35), r=0.03, rot=(0, 0, 12))
P('rbox', WOOD, loc=G(0.2, 1.12, 0.05), size=(0.3, 0.3, 0.3), r=0.03, rot=(0, 0, -20))
for i, (x, z) in enumerate(((-0.9, 0.3), (-0.9, -0.5))):
    P('cyl', WOODD, loc=G(x, 0.45, z), size=(0.3, 0.3, 0.45), seg=10)
    for y in (0.15, 0.75): P('torus', IRON, loc=G(x, y, z), size=(0.31, 0.31, 0.31), tube=0.06, seg=10, ring=3, rot=(90, 0, 0))
objs.append(cr.finish())
ch = Model('isle_chest')
P = ch.part
P('rbox', WOODD, loc=G(0, 0.25, 0), size=(0.45, 0.3, 0.25), r=0.03)
P('cyl', WOOD, loc=G(0, 0.5, 0), size=(0.3, 0.45, 0.3), seg=10, rot=(0, 90, 0))
for x in (-0.3, 0.3): P('box', IRON, loc=G(x, 0.4, 0), size=(0.04, 0.31, 0.3))
P('rock', GOLD, loc=G(0.1, 0.62, 0.1), size=(0.08, 0.08, 0.05), sub=1)
objs.append(ch.finish())

# ---- v1.15.5: a spotted eagle ray for Turtle Atoll's lagoon (flat wings, a long tail; the game flaps it)
ry = Model('isle_ray')
RAY = mat('ray_back', '#3a4a5e', 0.7); RAYS = mat('ray_spots', '#e8eef2', 0.6); RAYB = mat('ray_belly', '#d8dcd8', 0.7)
ry.part('poly', RAY, loc=G(0, 0.06, 0), points=[(0, 0.55), (0.95, -0.05), (0.2, -0.3), (0, -0.42), (-0.2, -0.3), (-0.95, -0.05)], depth=0.06, rot=(90, 0, 0))
ry.part('poly', RAYB, loc=G(0, 0.0, 0), points=[(0, 0.5), (0.9, -0.05), (0.18, -0.28), (0, -0.38), (-0.18, -0.28), (-0.9, -0.05)], depth=0.02, rot=(90, 0, 0))
ry.part('rock', RAY, loc=G(0, 0.1, 0.38), size=(0.14, 0.07, 0.16), sub=1)
for (x, z) in ((0.3, 0.05), (-0.3, 0.05), (0.55, -0.02), (-0.55, -0.02), (0.15, 0.25), (-0.15, 0.25)):
    ry.part('rock', RAYS, loc=G(x, 0.095, z), size=(0.035, 0.01, 0.035), sub=1)
ry.part('sweep', RAY, points=[G(0, 0.06, -0.38), G(0, 0.06, -0.9), G(0, 0.05, -1.5)], r=[0.03, 0.015, 0.004], ring=4)
objs.append(ry.finish())

# ---- v1.15.5: the smugglers' grotto behind the arch: a rock roof over a hidden pocket beach, and a lantern
gr = Model('isle_grotto')
gr.part('rock', ROCKD, loc=G(0, 4.6, 0), size=(9.0, 3.2, 8.0), sub=3, amp=0.6, freq=0.9, seed=5, smooth=False)
for a in range(5):
    ang = a / 5 * math.tau
    gr.part('cyl', ROCK, loc=G(math.cos(ang) * 3.2, 3.5, math.sin(ang) * 3.2), size=(0.25, 0.25, 0.9), seg=5, top=0.05, rot=(180, 0, 0))
objs.append(gr.finish())
ln = Model('isle_lantern')
ln.part('cyl', WOODD, loc=G(0, 0.6, 0), size=(0.05, 0.05, 0.6), seg=5)
ln.part('box', IRON, loc=G(0, 1.25, 0), size=(0.13, 0.13, 0.04))
ln.part('cyl', FLAME, loc=G(0, 1.38, 0), size=(0.08, 0.08, 0.1), seg=6)
ln.part('cyl', IRON, loc=G(0, 1.53, 0), size=(0.12, 0.12, 0.04), seg=6, top=0.3)
objs.append(ln.finish())

# ---- v1.15.5: the lock on Marlowe's pier below level 20: a chain between two posts and a padlock with a plate
lk = Model('isle_lockchain')
for x in (-1.15, 1.15): lk.part('cyl', WOODD, loc=G(x, 0.5, 0), size=(0.07, 0.07, 0.5), seg=6)
pts = [G(-1.1, 0.85, 0)] + [G(-1.1 + i * 0.275, 0.85 - math.sin(i / 8 * math.pi) * 0.25, 0) for i in range(1, 8)] + [G(1.1, 0.85, 0)]
lk.part('sweep', IRON, points=pts, r=0.025, ring=4)
lk.part('rbox', GOLD, loc=G(0, 0.47, 0.03), size=(0.11, 0.05, 0.12), r=0.02)
lk.part('torus', GOLD, loc=G(0, 0.62, 0.03), size=(0.07, 0.07, 0.07), rot=(90, 0, 0), tube=0.2, seg=10, ring=4)
lk.part('box', WOOD, loc=G(0, 0.25, 0.06), size=(0.3, 0.02, 0.12))
objs.append(lk.finish())

export(objs, OUT, spacing=9)
