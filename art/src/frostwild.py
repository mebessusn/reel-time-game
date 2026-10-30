# Frostmere (map 3): the wild north. The animals (polar bear, arctic fox, caribou, musk ox, the Frost Stag, ringed seal,
# walrus, narwhal, snowy owl, raven) and the landmarks (the wreck of the Valiant, standing stones and an inukshuk,
# Skyward Station's hut, dome and weather mast, the trapper's fur rack and woodpile, a bear den, the mammoth in the
# glacier, the blue ice arch, frozen falls columns, icicles, a signpost).
#   python3 art/src/frostwild.py      -> art/frostwild.blend + art/frostwild.glb
#   node scripts/glb-to-js.mjs art/frostwild.glb src/data/frostwildMesh.js FROSTWILD
# Game axes: x right, y up, z forward (an animal's nose points +z). Walking animals come as a body (with head and
# tail) and one leg hinged at the hip (origin), hanging down; the game places four. Sizes passed to the kit are half
# extents in Blender order (game x, game z, game y).
import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
import bpy
from kit import Model, mat, reset, export

OUT = os.path.join(os.path.dirname(__file__), '..', 'frostwild')
G = lambda x, y, z: (x, -z, y)
reset()

FURW = mat('fw_fur_white', '#f2ede2', 1.0)
FURC = mat('fw_fur_cream', '#e2d6bc', 1.0)
BLACK = mat('fw_black', '#16161a', 0.4)
EYE = mat('fw_eye', '#0c0c10', 0.2)
FOX = mat('fw_fox', '#f4f2ee', 1.0)
CARI = mat('fw_caribou', '#7c6650', 1.0)
CARID = mat('fw_caribou_dark', '#4a3c30', 1.0)
CARIW = mat('fw_caribou_white', '#e8e2d4', 1.0)
ANTLER = mat('fw_antler', '#c8b48e', 0.8)
OX = mat('fw_muskox', '#3a2a20', 1.0)
OXL = mat('fw_muskox_light', '#8a7458', 1.0)
HORN = mat('fw_horn', '#cfc2a4', 0.6)
STAG = mat('fw_stag', '#f6f8fa', 0.9)
STAGG = mat('fw_stag_glow', '#9af8d8', 0.3, emit='#5affc0')
SEAL = mat('fw_seal', '#6e737a', 0.6)
SEALS = mat('fw_seal_spot', '#4a4e54', 0.6)
WAL = mat('fw_walrus', '#8a5e44', 0.85)
WALD = mat('fw_walrus_dark', '#6a4632', 0.85)
IVORY = mat('fw_ivory', '#efe6cc', 0.5)
NAR = mat('fw_narwhal', '#8c9298', 0.5)
NARD = mat('fw_narwhal_dark', '#4e545a', 0.5)
OWL = mat('fw_owl', '#fbfaf6', 1.0)
OWLF = mat('fw_owl_fleck', '#3a3632', 1.0)
OWLE = mat('fw_owl_eye', '#f2c21a', 0.3)
RAVEN = mat('fw_raven', '#1c1c24', 0.5)
BEAK = mat('fw_beak', '#2a2a2e', 0.5)
# landmarks
HULL = mat('fp_hull', '#4a3426', 0.9)
HULLD = mat('fp_hull_dark', '#2e2018', 0.9)
DECK = mat('fp_deck', '#8a6c4c', 0.95)
REDP = mat('fp_red_paint', '#7a2a24', 0.8)
CANVAS = mat('fp_canvas', '#d8ccb0', 1.0)
ROPE = mat('fp_rope', '#bfae88', 1.0)
IRON = mat('fp_iron', '#3a3c40', 0.5, 0.6)
SNOW = mat('fp_snow', '#f3f7fb', 0.75)
ICE = mat('fp_ice', '#a8dcf0', 0.12)
ICED = mat('fp_ice_deep', '#5aa6d4', 0.1)
ICEG = mat('fp_ice_glow', '#bfeeff', 0.1, emit='#4ab8e8')
STONE = mat('fp_stone', '#7a7c82', 0.95)
STONED = mat('fp_stone_dark', '#55585e', 0.95)
LICHEN = mat('fp_lichen', '#c8a84a', 1.0)
WOOD = mat('fp_wood', '#7c5434', 0.95)
WOODL = mat('fp_wood_light', '#9c7448', 0.95)
NAVY = mat('fp_navy', '#2c4060', 0.7)
ORANGE = mat('fp_orange', '#e8641e', 0.6)
WHITE = mat('fp_white', '#eef2f4', 0.6)
GLASS = mat('fp_glass', '#2a3a48', 0.1)
WIN = mat('fp_window', '#ffd890', 0.4, emit='#f0a850')
STEEL = mat('fp_steel', '#9aa2aa', 0.4, 0.7)
SOLAR = mat('fp_solar', '#1a2a4a', 0.2, 0.4)
HIDE = mat('fp_hide', '#a8805a', 1.0)
HIDED = mat('fp_hide_dark', '#6a4a30', 1.0)
MAMM = mat('fp_mammoth', '#5a3a24', 1.0)
MAMMD = mat('fp_mammoth_dark', '#3a2416', 1.0)

objs = []
def leg(name, m, length, r, paw_m=None, paw=None):
    md = Model(name)
    md.part('cyl', m, loc=G(0, -length / 2, 0), size=(r, r, length / 2), seg=7, top=0.8)
    if paw: md.part('rock', paw_m or m, loc=G(0, -length + paw[2] * 0.5, paw[1] * 0.4), size=paw, sub=1)
    return md.finish()

# ------------------------------------------------------------------ polar bear (cubs and Old Whitepaw are scaled copies)
md = Model('fw_bear')
md.part('rock', FURW, loc=G(0, 1.0, -0.05), size=(0.5, 0.95, 0.5), sub=2)
md.part('rock', FURW, loc=G(0, 0.98, -0.62), size=(0.5, 0.55, 0.52), sub=2)
md.part('rock', FURC, loc=G(0, 0.82, -0.1), size=(0.4, 0.8, 0.3), sub=2)  # the belly, a shade warmer
md.part('rock', FURW, loc=G(0, 1.12, 0.48), size=(0.46, 0.5, 0.46), sub=2)
md.part('rock', FURW, loc=G(0, 1.05, 0.95), size=(0.3, 0.42, 0.32), sub=2)  # the long neck
md.part('rock', FURW, loc=G(0, 1.0, 1.36), size=(0.25, 0.3, 0.24), sub=2)
md.part('rock', FURC, loc=G(0, 0.9, 1.62), size=(0.14, 0.17, 0.13), sub=2)
md.part('rock', BLACK, loc=G(0, 0.94, 1.78), size=(0.065, 0.04, 0.05), sub=1)
for s in (-1, 1):
    md.part('rock', EYE, loc=G(s * 0.12, 1.1, 1.5), size=(0.03, 0.025, 0.03), sub=1)
    md.part('rock', FURW, loc=G(s * 0.15, 1.24, 1.28), size=(0.065, 0.04, 0.06), sub=1)
md.part('rock', FURW, loc=G(0, 1.08, -1.12), size=(0.1, 0.08, 0.1), sub=1)
objs.append(md.finish())
objs.append(leg('fw_bear_leg', FURW, 0.85, 0.15, FURC, (0.17, 0.2, 0.08)))

# ------------------------------------------------------------------ arctic fox (white winter coat, a huge tail)
md = Model('fw_fox')
md.part('rock', FOX, loc=G(0, 0.36, 0), size=(0.12, 0.28, 0.13), sub=2)
md.part('rock', FOX, loc=G(0, 0.44, 0.3), size=(0.11, 0.12, 0.11), sub=2)
md.part('rock', FOX, loc=G(0, 0.42, 0.42), size=(0.05, 0.07, 0.05), sub=1)
md.part('rock', BLACK, loc=G(0, 0.43, 0.49), size=(0.02, 0.015, 0.018), sub=1)
for s in (-1, 1):
    md.part('cyl', FOX, loc=G(s * 0.06, 0.56, 0.27), size=(0.04, 0.03, 0.05), seg=4, top=0.1)
    md.part('rock', EYE, loc=G(s * 0.05, 0.48, 0.39), size=(0.014, 0.012, 0.014), sub=1)
md.part('sweep', FOX, points=[G(0, 0.36, -0.26), G(0, 0.3, -0.45), G(0, 0.34, -0.62), G(0, 0.44, -0.7)], r=[0.07, 0.1, 0.09, 0.04], ring=7)
objs.append(md.finish())
objs.append(leg('fw_fox_leg', FOX, 0.24, 0.025, FOX, (0.03, 0.04, 0.02)))

# ------------------------------------------------------------------ caribou (antlered, a pale neck ruff)
def antlers(md, m, base_y, base_z, span=1.0, glow=None):
    for s in (-1, 1):
        root = G(s * 0.1, base_y, base_z)
        main = [root, G(s * 0.35 * span, base_y + 0.35 * span, base_z - 0.15), G(s * 0.5 * span, base_y + 0.8 * span, base_z - 0.1), G(s * 0.45 * span, base_y + 1.15 * span, base_z + 0.15)]
        md.part('sweep', m, points=main, r=[0.04, 0.035, 0.03, 0.015], ring=5)
        for k, (a, b) in enumerate([(0.35, 0.25), (0.6, 0.3), (0.85, 0.25)]):
            px, py = s * (0.35 + 0.15 * k) * span, base_y + (0.35 + 0.3 * k) * span
            md.part('sweep', m, points=[G(px, py, base_z - 0.12), G(px + s * 0.08 * span, py + b * span, base_z + a * 0.6 * span)], r=[0.022, 0.01], ring=4)
        md.part('sweep', m, points=[G(s * 0.15, base_y + 0.1, base_z + 0.02), G(s * 0.12, base_y + 0.2 * span, base_z + 0.3 * span)], r=[0.02, 0.008], ring=4)  # the brow tine
        if glow:
            for k in range(5): md.part('rock', glow, loc=G(s * (0.3 + 0.05 * k) * span, base_y + (0.4 + 0.18 * k) * span, base_z - 0.1), size=(0.03, 0.03, 0.03), sub=1)
md = Model('fw_caribou')
md.part('rock', CARI, loc=G(0, 1.05, 0), size=(0.3, 0.75, 0.36), sub=2)
md.part('rock', CARIW, loc=G(0, 1.1, 0.62), size=(0.24, 0.3, 0.34), sub=2)  # the pale neck and ruff
md.part('rock', CARID, loc=G(0, 0.86, 0), size=(0.26, 0.6, 0.18), sub=2)
md.part('rock', CARI, loc=G(0, 1.38, 0.88), size=(0.13, 0.26, 0.15), sub=2, rot=(-25, 0, 0))
md.part('rock', CARID, loc=G(0, 1.28, 1.08), size=(0.08, 0.1, 0.08), sub=1)
md.part('rock', CARIW, loc=G(0, 1.02, -0.72), size=(0.12, 0.1, 0.12), sub=1)  # the white rump and tail
for s in (-1, 1): md.part('rock', EYE, loc=G(s * 0.1, 1.45, 0.95), size=(0.02, 0.02, 0.02), sub=1)
antlers(md, ANTLER, 1.55, 0.82, 0.8)
objs.append(md.finish())
objs.append(leg('fw_caribou_leg', CARID, 0.78, 0.045, BLACK, (0.05, 0.06, 0.04)))

# ------------------------------------------------------------------ musk ox (a shaggy skirt, swept horns)
md = Model('fw_muskox')
md.part('rock', OX, loc=G(0, 0.95, 0), size=(0.45, 0.75, 0.5), sub=2, amp=0.04, freq=6)
md.part('rock', OX, loc=G(0, 0.7, 0), size=(0.5, 0.78, 0.35), sub=2, amp=0.05, freq=7)  # the long skirt of hair
md.part('rock', OXL, loc=G(0, 1.25, 0.1), size=(0.36, 0.45, 0.22), sub=2)  # the pale saddle
md.part('rock', OX, loc=G(0, 0.92, 0.78), size=(0.24, 0.26, 0.26), sub=2)
md.part('rock', OXL, loc=G(0, 0.86, 1.0), size=(0.12, 0.08, 0.1), sub=1)
for s in (-1, 1):
    md.part('sweep', HORN, points=[G(s * 0.04, 1.14, 0.8), G(s * 0.28, 1.12, 0.78), G(s * 0.36, 0.9, 0.86), G(s * 0.3, 0.8, 1.0)], r=[0.07, 0.06, 0.035, 0.015], ring=6)
    md.part('rock', EYE, loc=G(s * 0.17, 0.98, 0.9), size=(0.025, 0.02, 0.025), sub=1)
objs.append(md.finish())
objs.append(leg('fw_muskox_leg', OXL, 0.5, 0.08, OX, (0.09, 0.1, 0.05)))

# ------------------------------------------------------------------ the Frost Stag (a great white elk, antlers lit like the aurora)
md = Model('fw_stag')
md.part('rock', STAG, loc=G(0, 1.35, 0), size=(0.36, 0.9, 0.42), sub=2)
md.part('rock', STAG, loc=G(0, 1.5, 0.78), size=(0.27, 0.36, 0.36), sub=2)
md.part('rock', STAG, loc=G(0, 1.85, 1.12), size=(0.15, 0.32, 0.17), sub=2, rot=(-25, 0, 0))
md.part('rock', STAGG, loc=G(0, 1.75, 1.38), size=(0.05, 0.04, 0.04), sub=1)
for s in (-1, 1): md.part('rock', STAGG, loc=G(s * 0.11, 1.95, 1.2), size=(0.025, 0.025, 0.025), sub=1)
antlers(md, STAG, 2.05, 1.02, 1.3, glow=STAGG)
objs.append(md.finish())
objs.append(leg('fw_stag_leg', STAG, 1.0, 0.055, STAGG, (0.06, 0.07, 0.04)))

# ------------------------------------------------------------------ ringed seal (lying out on the ice), walrus, narwhal
md = Model('fw_seal')
md.part('rock', SEAL, loc=G(0, 0.25, 0), size=(0.3, 0.7, 0.25), sub=2)
md.part('rock', SEAL, loc=G(0, 0.32, 0.62), size=(0.18, 0.2, 0.17), sub=2)
for k in range(9): md.part('rock', SEALS, loc=G(((k * 37) % 7 - 3) * 0.06, 0.45, ((k * 53) % 11 - 5) * 0.1), size=(0.05, 0.04, 0.02), sub=1)
for s in (-1, 1):
    md.part('rock', EYE, loc=G(s * 0.08, 0.38, 0.76), size=(0.03, 0.025, 0.03), sub=1)
    md.part('rock', SEAL, loc=G(s * 0.24, 0.1, 0.25), size=(0.14, 0.08, 0.03), sub=1, rot=(0, 0, s * 20))
    md.part('rock', SEAL, loc=G(s * 0.1, 0.18, -0.78), size=(0.12, 0.16, 0.03), sub=1, rot=(0, 0, s * 30))
objs.append(md.finish())
md = Model('fw_walrus')
md.part('rock', WAL, loc=G(0, 0.55, 0), size=(0.65, 1.2, 0.55), sub=2, amp=0.04, freq=4)
md.part('rock', WALD, loc=G(0, 0.3, 0), size=(0.62, 1.1, 0.3), sub=2)
md.part('rock', WAL, loc=G(0, 0.75, 1.1), size=(0.4, 0.38, 0.4), sub=2)
md.part('rock', WALD, loc=G(0, 0.62, 1.38), size=(0.3, 0.16, 0.2), sub=2)  # the whiskered muzzle
for s in (-1, 1):
    md.part('sweep', IVORY, points=[G(s * 0.1, 0.55, 1.45), G(s * 0.12, 0.2, 1.55), G(s * 0.11, 0.0, 1.6)], r=[0.04, 0.03, 0.012], ring=5)
    md.part('rock', EYE, loc=G(s * 0.22, 0.9, 1.3), size=(0.025, 0.02, 0.025), sub=1)
    md.part('rock', WALD, loc=G(s * 0.5, 0.12, 0.55), size=(0.3, 0.14, 0.04), sub=1, rot=(0, 0, s * 15))
md.part('rock', WALD, loc=G(0, 0.15, -1.2), size=(0.35, 0.25, 0.05), sub=1)
objs.append(md.finish())
md = Model('fw_narwhal')  # swims at the surface: the back, the head and the tusk above the water
md.part('rock', NAR, loc=G(0, 0, 0), size=(0.45, 1.8, 0.42), sub=2)
md.part('rock', NARD, loc=G(0, 0.1, -0.4), size=(0.35, 1.0, 0.35), sub=2)
md.part('rock', NAR, loc=G(0, 0.02, 1.6), size=(0.35, 0.4, 0.33), sub=2)
for k in range(14): md.part('rock', NARD, loc=G(((k * 37) % 9 - 4) * 0.08, 0.38, ((k * 53) % 15 - 7) * 0.2), size=(0.06, 0.08, 0.03), sub=1)
md.part('sweep', IVORY, points=[G(0.05, 0.05, 1.9), G(0.08, 0.1, 2.6), G(0.1, 0.15, 3.4)], r=[0.05, 0.03, 0.008], ring=5)
for s in (-1, 1): md.part('rock', NARD, loc=G(s * 0.5, -0.15, -1.75), size=(0.42, 0.18, 0.04), sub=1, rot=(0, 0, s * 10))
objs.append(md.finish())

# ------------------------------------------------------------------ snowy owl (sitting) and raven (body, and a wing that flaps)
md = Model('fw_owl')
md.part('rock', OWL, loc=G(0, 0.26, 0), size=(0.16, 0.15, 0.24), sub=2)
md.part('rock', OWL, loc=G(0, 0.52, 0.02), size=(0.13, 0.12, 0.12), sub=2)
for k in range(12): md.part('rock', OWLF, loc=G(((k * 37) % 7 - 3) * 0.04, 0.18 + (k % 4) * 0.06, -0.1 - (k % 3) * 0.02), size=(0.02, 0.01, 0.012), sub=1)
for s in (-1, 1):
    md.part('rock', OWLE, loc=G(s * 0.05, 0.55, 0.12), size=(0.03, 0.015, 0.03), sub=1)
    md.part('rock', EYE, loc=G(s * 0.05, 0.55, 0.135), size=(0.014, 0.01, 0.014), sub=1)
md.part('cyl', BEAK, loc=G(0, 0.5, 0.14), size=(0.015, 0.015, 0.025), seg=4, top=0.1, rot=(90, 0, 0))
objs.append(md.finish())
md = Model('fw_raven')
md.part('rock', RAVEN, loc=G(0, 0.15, 0), size=(0.09, 0.2, 0.09), sub=2)
md.part('rock', RAVEN, loc=G(0, 0.22, 0.2), size=(0.07, 0.08, 0.07), sub=2)
md.part('cyl', BEAK, loc=G(0, 0.21, 0.31), size=(0.022, 0.022, 0.06), seg=4, top=0.1, rot=(90, 0, 0))
md.part('poly', RAVEN, loc=G(0, 0.16, -0.22), points=[(-0.08, 0), (0.08, 0), (0.05, -0.16), (-0.05, -0.16)], depth=0.01, rot=(90, 0, 0))
objs.append(md.finish())
md = Model('fw_raven_wing')  # hinged at the shoulder (origin), spreading out along +x
md.part('poly', RAVEN, loc=G(0, 0, 0), points=[(0, 0.08), (0.2, 0.06), (0.36, 0.0), (0.32, -0.06), (0.15, -0.08), (0, -0.06)], depth=0.012, rot=(90, 0, 0))
objs.append(md.finish())

# ------------------------------------------------------------------ the wreck of the Valiant: a two-masted schooner, iced in
md = Model('fp_valiant')
hull_top = [(0, 7.2), (0.9, 6.2), (1.6, 4.4), (1.85, 1.5), (1.85, -2.5), (1.6, -5.0), (1.1, -6.4), (-1.1, -6.4), (-1.6, -5.0), (-1.85, -2.5), (-1.85, 1.5), (-1.6, 4.4), (-0.9, 6.2)]
hull_low = [(x * 0.62, z * 0.9) for x, z in hull_top]
md.part('poly', HULL, loc=G(0, 0.9, 0), points=hull_top, depth=1.4, rot=(90, 0, 0))  # (rot: a poly lies flat, extruded up)
md.part('poly', HULLD, loc=G(0, -0.4, 0), points=hull_low, depth=1.4, rot=(90, 0, 0))
md.part('box', HULLD, loc=G(0, -1.2, 0.3), size=(0.12, 6.0, 0.35))  # the keel
md.part('poly', REDP, loc=G(0, 1.55, 0), points=[(x * 1.01, z * 1.005) for x, z in hull_top], depth=0.12, rot=(90, 0, 0))  # the painted sheer strake
md.part('poly', DECK, loc=G(0, 1.62, 0), points=[(x * 0.93, z * 0.95) for x, z in hull_top], depth=0.06, rot=(90, 0, 0))
md.part('rbox', SNOW, loc=G(0.3, 1.72, 1.2), size=(1.3, 3.5, 0.1), r=0.08)  # snow drifted on deck
md.part('rbox', SNOW, loc=G(-0.4, 1.72, -3.6), size=(1.0, 1.4, 0.12), r=0.1)
for s in (-1, 1):  # the rails, and icicles hanging off them
    for k in range(9):
        z = -5.6 + k * 1.4
        x = s * (1.8 if -2.5 < z < 1.5 else 1.55 if z > 1.5 else 1.55)
        md.part('box', HULLD, loc=G(x, 1.95, z), size=(0.05, 0.05, 0.35))
        for j in range(3): md.part('cyl', ICE, loc=G(x + s * 0.06, 1.3 - j * 0.08, z + j * 0.35 - 0.3), size=(0.035, 0.035, 0.28 + j * 0.1), seg=5, top=0.0, rot=(180, 0, 0))
    md.part('box', HULLD, loc=G(s * 1.72, 2.3, -0.5), size=(0.06, 5.6, 0.04))
md.part('rbox', WOODL, loc=G(0, 2.1, -4.0), size=(1.0, 1.4, 0.5), r=0.06)  # the deckhouse aft
md.part('rbox', SNOW, loc=G(0, 2.65, -4.0), size=(1.05, 1.45, 0.08), r=0.06)
md.part('rbox', GLASS, loc=G(0, 2.15, -2.58), size=(0.3, 0.02, 0.2), r=0.03)
# the masts: the foremast standing, the mainmast snapped and leaning
md.part('cyl', WOODL, loc=G(0, 6.2, 2.5), size=(0.13, 0.13, 4.6), seg=8, top=0.7)
md.part('cyl', WOODL, loc=G(0, 9.0, 2.5), size=(0.05, 0.05, 1.6), seg=6, rot=(0, 90, 0))  # the yard
md.part('cyl', WOODL, loc=G(0, 3.3, -1.2), size=(0.15, 0.15, 1.7), seg=8)
md.part('cyl', WOODL, loc=G(1.6, 3.6, -2.6), size=(0.12, 0.12, 2.6), seg=8, top=0.7, rot=(-40, 0, -62))  # the broken top, fallen across the rail
md.part('cyl', WOODL, loc=G(0, 2.6, 6.8), size=(0.08, 0.08, 1.6), seg=6, rot=(-70, 0, 0))  # the bowsprit
md.part('poly', CANVAS, loc=G(0.05, 4.2, 2.5), points=[(0, 0), (0, 3.9), (-2.6, 0.2)], depth=0.02, rot=(0, 0, 90))  # a tattered staysail
for p0, p1 in [((0, 10.7, 2.5), (0, 2.0, 7.4)), ((0, 10.7, 2.5), (1.7, 2.1, 2.0)), ((0, 10.7, 2.5), (-1.7, 2.1, 2.0)), ((0, 10.7, 2.5), (0, 2.0, -6.2))]:
    a, b = G(*p0), G(*p1)
    md.part('sweep', ROPE, points=[a, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 - 0.2), b], r=0.018, ring=4)
for k in range(10): md.part('cyl', ICE, loc=G(0.06, 6.0 - k * 0.12, 2.5 + (k % 3 - 1) * 0.08), size=(0.02, 0.02, 0.2 + (k % 4) * 0.06), seg=4, top=0.0, rot=(180, 0, k * 36))
objs.append(md.finish())

# ------------------------------------------------------------------ standing stones and an inukshuk (Aurora Hill)
for i, (sx, sy, sz, lean) in enumerate([(0.55, 0.4, 1.5, 4), (0.45, 0.35, 1.2, -6), (0.6, 0.45, 1.8, 2)]):
    md = Model(f'fp_stone{i}')
    md.part('rock', STONE, loc=G(0, sz * 0.92, 0), size=(sx, sy, sz), sub=3, amp=0.08, freq=2.5, seed=i + 1, rot=(lean, 0, 0))
    md.part('rock', LICHEN, loc=G(sx * 0.6, sz * 1.1, sy * 0.4), size=(0.18, 0.06, 0.14), sub=1, rot=(lean, 0, 0))
    md.part('rock', SNOW, loc=G(0, sz * 1.82, 0), size=(sx * 0.7, sy * 0.7, 0.08), sub=2)
    objs.append(md.finish())
md = Model('fp_inukshuk')
for s in (-1, 1): md.part('rock', STONED, loc=G(s * 0.32, 0.45, 0), size=(0.18, 0.2, 0.45), sub=2, amp=0.03, seed=4)
md.part('rock', STONE, loc=G(0, 1.02, 0), size=(0.7, 0.25, 0.12), sub=2, amp=0.03, seed=5)
md.part('rock', STONED, loc=G(0, 1.36, 0), size=(0.32, 0.22, 0.22), sub=2, amp=0.03, seed=6)
md.part('rock', STONE, loc=G(0, 1.66, 0), size=(0.85, 0.22, 0.1), sub=2, amp=0.03, seed=7)
md.part('rock', STONED, loc=G(0, 1.98, 0), size=(0.22, 0.2, 0.2), sub=2, amp=0.03, seed=8)
md.part('rock', SNOW, loc=G(0, 2.15, 0), size=(0.18, 0.16, 0.05), sub=1)
objs.append(md.finish())

# ------------------------------------------------------------------ Skyward Station: the hut, the radar dome, the weather mast
md = Model('fp_station_hut')
md.part('box', STONED, loc=G(0, 0.25, 0), size=(3.2, 2.2, 0.25))
md.part('rbox', NAVY, loc=G(0, 1.6, 0), size=(3.0, 2.0, 1.1), r=0.12)
md.part('rbox', ORANGE, loc=G(0, 2.82, 0), size=(3.1, 2.1, 0.12), r=0.06)
md.part('rbox', SNOW, loc=G(0, 2.98, 0), size=(3.0, 2.0, 0.08), r=0.06)
for x in (-2.0, 0.0, 2.0):
    md.part('cyl', WHITE, loc=G(x, 1.8, 2.02), size=(0.36, 0.36, 0.04), seg=14, rot=(90, 0, 0))
    md.part('cyl', WIN, loc=G(x, 1.8, 2.05), size=(0.28, 0.28, 0.02), seg=14, rot=(90, 0, 0))
md.part('rbox', WHITE, loc=G(3.02, 1.35, 0.6), size=(0.04, 0.45, 0.85), r=0.03)  # the door, on the east end
md.part('box', STEEL, loc=G(3.4, 0.35, 0.6), size=(0.4, 0.6, 0.06))
md.part('cyl', STEEL, loc=G(-2.4, 3.6, -1.2), size=(0.02, 0.02, 0.7), seg=5)
md.part('cyl', STEEL, loc=G(-2.4, 4.25, -1.2), size=(0.25, 0.25, 0.02), seg=10, top=0.1)
objs.append(md.finish())
md = Model('fp_station_dome')
md.part('cyl', STONED, loc=G(0, 0.6, 0), size=(1.7, 1.7, 0.6), seg=16)
md.part('rock', WHITE, loc=G(0, 1.4, 0), size=(1.6, 1.6, 1.6), sub=1)
md.part('rbox', SNOW, loc=G(0, 2.9, 0), size=(0.6, 0.6, 0.1), r=0.1)
objs.append(md.finish())
md = Model('fp_mast')
for k in range(3):
    a = k / 3 * math.tau
    md.part('cyl', STEEL, loc=G(math.cos(a) * 0.22, 4.5, math.sin(a) * 0.22), size=(0.025, 0.025, 4.5), seg=5)
for j in range(9):
    for k in range(3):
        a0, a1 = k / 3 * math.tau, (k + 1) / 3 * math.tau
        p0, p1 = G(math.cos(a0) * 0.22, 0.5 + j, math.sin(a0) * 0.22), G(math.cos(a1) * 0.22, 1.0 + j, math.sin(a1) * 0.22)
        md.part('sweep', STEEL, points=[p0, p1], r=0.012, ring=3)
md.part('box', ORANGE, loc=G(0, 7.4, 0), size=(0.3, 0.3, 0.06))
md.part('cyl', STEEL, loc=G(0, 9.15, 0), size=(0.03, 0.03, 0.15), seg=5)
md.part('box', STEEL, loc=G(0, 8.6, 0.0), size=(0.6, 0.02, 0.02))  # the vane's arm
md.part('poly', ORANGE, loc=G(0.6, 8.6, 0), points=[(0, 0), (0.25, 0.12), (0.25, -0.12)], depth=0.01)
md.part('rbox', SOLAR, loc=G(0, 5.0, 0.6), size=(0.5, 0.04, 0.35), r=0.01, rot=(-30, 0, 0))
objs.append(md.finish())
md = Model('fp_anemometer')  # three cups on a hub that spins (the game turns it)
md.part('cyl', STEEL, loc=G(0, 0, 0), size=(0.04, 0.04, 0.05), seg=6)
for k in range(3):
    a = k / 3 * math.tau
    md.part('box', STEEL, loc=G(math.cos(a) * 0.2, 0, math.sin(a) * 0.2), size=(0.2, 0.01, 0.01), rot=(0, 0, -math.degrees(a)))
    md.part('rock', ORANGE, loc=G(math.cos(a) * 0.4, 0, math.sin(a) * 0.4), size=(0.07, 0.07, 0.07), sub=1)
objs.append(md.finish())

# ------------------------------------------------------------------ the trapper's place: a fur rack, a woodpile, snowshoes
md = Model('fp_furrack')
for x in (-1.0, 1.0): md.part('cyl', WOOD, loc=G(x, 1.0, 0), size=(0.05, 0.05, 1.0), seg=6)
md.part('cyl', WOOD, loc=G(0, 1.9, 0), size=(0.04, 0.04, 1.1), seg=6, rot=(0, 90, 0))
for k, (m, w) in enumerate([(HIDE, 0.32), (HIDED, 0.28), (FURW, 0.3)]):
    x = -0.6 + k * 0.6
    md.part('poly', m, loc=G(x, 1.85, 0.02), points=[(-w, 0), (w, 0), (w * 0.8, -0.5), (w * 0.3, -0.9), (-w * 0.3, -0.9), (-w * 0.8, -0.5)], depth=0.015)
objs.append(md.finish())
md = Model('fp_woodpile')
for row in range(3):
    for k in range(6 - row):
        md.part('cyl', WOOD if (k + row) % 2 else WOODL, loc=G(-0.75 + k * 0.3 + row * 0.15, 0.15 + row * 0.27, 0), size=(0.14, 0.14, 0.6), seg=8, rot=(90, 0, 0))
md.part('rbox', SNOW, loc=G(0, 0.95, 0), size=(0.8, 0.6, 0.06), r=0.05)
objs.append(md.finish())
md = Model('fp_snowshoes')
for s in (-1, 1):
    md.part('torus', WOOD, loc=G(s * 0.18, 0.5, 0), size=(0.16, 0.42, 0.02), rot=(90, 0, 0)) if False else md.part('sweep', WOOD, points=[G(s * 0.18, 0.05, 0), G(s * 0.18 + 0.15, 0.4, 0), G(s * 0.18, 0.95, 0), G(s * 0.18 - 0.15, 0.4, 0), G(s * 0.18, 0.05, 0)], r=0.02, ring=4)
    for j in range(5): md.part('box', ROPE, loc=G(s * 0.18, 0.25 + j * 0.13, 0), size=(0.12, 0.005, 0.005))
objs.append(md.finish())

# ------------------------------------------------------------------ a bear den, the mammoth in the glacier, the blue ice arch
md = Model('fp_den')
md.part('rock', SNOW, loc=G(0, 0.6, 0), size=(2.6, 2.2, 1.6), sub=3, amp=0.18, freq=1.2, seed=3)
md.part('rock', STONED, loc=G(1.6, 0.6, 1.0), size=(0.9, 0.7, 0.7), sub=2, amp=0.1, seed=4)
md.part('rock', STONE, loc=G(-1.8, 0.4, -0.6), size=(0.8, 0.8, 0.6), sub=2, amp=0.1, seed=5)
md.part('rock', GLASS, loc=G(0, 0.55, 1.62), size=(0.85, 0.3, 0.65), sub=2)  # the dark mouth
objs.append(md.finish())
md = Model('fp_mammoth')  # half out of the ice wall: the head, trunk and tusks, a shaggy shoulder
md.part('rock', MAMM, loc=G(0, 2.6, -0.6), size=(1.5, 1.6, 1.6), sub=2, amp=0.1, freq=5)
md.part('rock', MAMMD, loc=G(0, 2.4, 0.6), size=(0.9, 0.8, 1.0), sub=2, amp=0.06, freq=5)
md.part('rock', MAMM, loc=G(0, 3.6, 0.5), size=(0.7, 0.6, 0.6), sub=2)  # the domed head
md.part('sweep', MAMMD, points=[G(0, 2.6, 1.3), G(0, 1.6, 1.6), G(0, 0.8, 1.5), G(0, 0.5, 1.2)], r=[0.25, 0.18, 0.12, 0.08], ring=8)
for s in (-1, 1):
    md.part('sweep', IVORY, points=[G(s * 0.35, 2.3, 1.2), G(s * 0.8, 1.3, 2.0), G(s * 0.9, 1.5, 2.9), G(s * 0.5, 2.3, 3.2)], r=[0.13, 0.11, 0.08, 0.03], ring=7)
    md.part('rock', EYE, loc=G(s * 0.45, 3.0, 1.15), size=(0.06, 0.05, 0.06), sub=1)
    md.part('rock', MAMMD, loc=G(s * 0.85, 3.0, 0.55), size=(0.1, 0.5, 0.45), sub=2)
objs.append(md.finish())
# v1.17.1: the whole beast, frozen standing in the Blue Caves' ice: about 6 m long, 3.8 m at the hump. Shaggy:
# layered skirts of fur clumps over the belly and legs, a domed head, small ears, a trunk curled at the tip, long
# spiralling tusks, eyes closed. Head along +z.
FUR2 = mat('fp_mammoth_fur', '#6e4a2c', 1.0); FUR3 = mat('fp_mammoth_tips', '#8a6440', 1.0); HIDE = mat('fp_mammoth_hide', '#2e1e14', 0.9)
md = Model('fp_mammoth_full')
md.part('rock', MAMM, loc=G(0, 2.35, -0.3), size=(1.35, 2.3, 1.3), sub=3, amp=0.08, freq=3, seed=1)       # the barrel of the body
md.part('rock', MAMM, loc=G(0, 2.9, 0.9), size=(1.25, 1.2, 1.3), sub=3, amp=0.08, freq=3, seed=2)        # the shoulders
md.part('rock', MAMMD, loc=G(0, 3.55, 0.75), size=(0.8, 0.9, 0.55), sub=3, amp=0.06, freq=4, seed=3)     # the hump
md.part('rock', MAMM, loc=G(0, 2.15, -2.05), size=(1.05, 0.8, 1.0), sub=3, amp=0.08, freq=3, seed=4)     # the sloping rump
md.part('rock', MAMM, loc=G(0, 3.55, 2.05), size=(0.75, 0.85, 0.85), sub=3, amp=0.05, freq=4, seed=5)    # the head
md.part('rock', MAMMD, loc=G(0, 4.3, 1.9), size=(0.5, 0.5, 0.35), sub=2, amp=0.05, freq=5, seed=6)       # the domed crown
md.part('rock', FUR3, loc=G(0, 4.55, 1.85), size=(0.35, 0.35, 0.12), sub=2, amp=0.06, freq=6, seed=7)    # a topknot
for s_ in (-1, 1):
    md.part('rock', MAMMD, loc=G(s_ * 0.62, 3.7, 1.85), size=(0.1, 0.35, 0.4), sub=2, rot=(0, 0, s_ * 15))  # small ears
    md.part('box', HIDE, loc=G(s_ * 0.5, 3.6, 2.62), size=(0.09, 0.02, 0.015), rot=(0, 0, s_ * -10))       # eyes shut
    md.part('sweep', IVORY, points=[G(s_ * 0.38, 3.0, 2.55), G(s_ * 0.6, 2.1, 3.1), G(s_ * 0.95, 1.6, 3.9), G(s_ * 1.0, 1.9, 4.7), G(s_ * 0.6, 2.6, 5.0), G(s_ * 0.2, 2.9, 4.75)], r=[0.16, 0.15, 0.13, 0.1, 0.07, 0.03], ring=9)
md.part('sweep', MAMMD, points=[G(0, 3.2, 2.7), G(0, 2.6, 3.05), G(0, 1.8, 3.15), G(0, 1.0, 3.0), G(0, 0.6, 2.75), G(0, 0.62, 2.45), G(0, 0.85, 2.4)], r=[0.32, 0.26, 0.21, 0.17, 0.13, 0.1, 0.08], ring=10)
for k in range(14):  # wrinkles round the trunk
    t = k / 13; md.part('torus', HIDE, loc=G(0, 3.0 - t * 2.1, 2.85 + math.sin(t * 2.5) * 0.25), size=(0.27 - t * 0.12, 0.27 - t * 0.12, 0.27 - t * 0.12), seg=10, ring=3, tube=0.06, rot=(70 + t * 20, 0, 0))
for sx in (-1, 1):  # four pillar legs with round feet and toenails
    for sz, z0 in ((1, 1.0), (-1, -1.7)):
        x0 = sx * 0.78
        md.part('cyl', MAMM, loc=G(x0, 1.0, z0), size=(0.42, 0.42, 1.0), seg=10, top=1.15, amp=0.04, freq=4, seed=int(10 + sx * 3 + sz))
        md.part('cyl', HIDE, loc=G(x0, 0.12, z0), size=(0.47, 0.47, 0.13), seg=12)
        for a in (-0.5, 0, 0.5): md.part('rock', IVORY, loc=G(x0 + math.sin(a) * 0.42, 0.1, z0 + math.cos(a) * 0.42), size=(0.08, 0.05, 0.06), sub=1)
md.part('sweep', MAMMD, points=[G(0, 2.6, -2.85), G(0, 2.1, -3.05), G(0, 1.7, -3.0)], r=[0.09, 0.06, 0.04], ring=6)  # the tail
md.part('rock', FUR3, loc=G(0, 1.55, -3.0), size=(0.12, 0.12, 0.2), sub=1)
# the shaggy coat: skirts of long fur clumps hanging from the flanks and the belly, and a beard of it under the chin
import random as _r
_r.seed(42)
for k in range(150):
    side = _r.choice((-1, 1)); z = _r.uniform(-2.5, 1.9); top = 3.2 - abs(z - 0.6) * 0.32 + _r.uniform(-0.3, 0.3); ln = _r.uniform(0.8, 1.5)
    x = side * (1.15 - 0.12 * abs(z) * 0.3 + _r.uniform(-0.1, 0.08))
    m_ = (MAMM, FUR2, FUR3, MAMMD)[k % 4]
    md.part('sweep', m_, points=[G(x, top, z), G(x * 1.05, top - ln * 0.5, z + _r.uniform(-0.1, 0.1)), G(x * 1.02, top - ln, z + _r.uniform(-0.15, 0.15))], r=[0.16, 0.12, 0.03], ring=5)
for k in range(40):  # belly fringe
    z = _r.uniform(-2.2, 1.6); x = _r.uniform(-0.9, 0.9)
    md.part('sweep', (FUR2, MAMMD)[k % 2], points=[G(x, 1.25, z), G(x, 0.85, z + 0.05), G(x * 1.05, 0.55, z)], r=[0.15, 0.1, 0.03], ring=5)
for k in range(18):  # the beard and throat fur
    x = _r.uniform(-0.55, 0.55); z = _r.uniform(1.9, 2.5)
    md.part('sweep', (MAMM, FUR3)[k % 2], points=[G(x, 3.0, z), G(x, 2.4, z + 0.1), G(x, 1.95, z + 0.05)], r=[0.13, 0.09, 0.03], ring=5)
objs.append(md.finish())
md = Model('fp_icearch')  # the mouth of the blue caves: a great arch of glacier ice
pts = [G(-4.5 * math.cos(a / 10 * math.pi), 5.2 * math.sin(a / 10 * math.pi), 0) for a in range(11)]
md.part('sweep', ICE, points=pts, r=[1.6, 1.5, 1.3, 1.2, 1.1, 1.1, 1.1, 1.2, 1.3, 1.5, 1.6], ring=8)
md.part('sweep', ICED, points=[(x, y - 0.6, z + 0.2) for x, y, z in pts], r=[1.4, 1.3, 1.1, 1.0, 0.9, 0.9, 0.9, 1.0, 1.1, 1.3, 1.4], ring=8)
for k in range(14):
    a = (k + 0.5) / 14 * math.pi
    x, y = -4.0 * math.cos(a), 4.4 * math.sin(a)
    md.part('cyl', ICEG, loc=G(x, y - 0.5, 0.8 * ((k % 3) - 1)), size=(0.06, 0.06, 0.4 + (k % 4) * 0.2), seg=5, top=0.0, rot=(180, 0, 0))
md.part('rbox', SNOW, loc=G(0, 6.15, 0), size=(2.6, 1.6, 0.3), r=0.3)
objs.append(md.finish())
md = Model('fp_icecolumn')  # a column of frozen waterfall: fat icy drips fused together
for k, (x, z, r, hgt, m) in enumerate([(0, 0, 0.55, 7.0, ICE), (0.45, 0.2, 0.38, 6.2, ICED), (-0.4, 0.15, 0.4, 6.6, ICE), (0.15, 0.45, 0.3, 5.4, ICEG), (-0.2, -0.35, 0.32, 5.9, ICED)]):
    md.part('cyl', m, loc=G(x, hgt / 2, z), size=(r, r, hgt / 2), seg=9, top=1.35)
    md.part('rock', m, loc=G(x, 0.25, z), size=(r * 1.5, r * 1.5, 0.35), sub=2)
objs.append(md.finish())
md = Model('fp_icicles')  # a fringe of icicles (hang it under an edge)
for k in range(9): md.part('cyl', ICE, loc=G(-0.8 + k * 0.2, -0.25 - (k % 3) * 0.12, (k % 2) * 0.06), size=(0.04, 0.04, 0.25 + (k % 3) * 0.12), seg=5, top=0.0, rot=(180, 0, 0))
objs.append(md.finish())
md = Model('fp_signpost')
md.part('cyl', WOOD, loc=G(0, 1.3, 0), size=(0.07, 0.07, 1.3), seg=6)
for k, (h, a) in enumerate([(2.2, 30), (1.85, -50), (1.5, 160)]):
    md.part('box', WOODL, loc=G(0.45 * math.cos(math.radians(a)), h, 0.45 * math.sin(math.radians(a))), size=(0.5, 0.03, 0.11), rot=(0, 0, -a))
md.part('rbox', SNOW, loc=G(0, 2.62, 0), size=(0.1, 0.1, 0.05), r=0.04)
objs.append(md.finish())

export(objs, OUT)
