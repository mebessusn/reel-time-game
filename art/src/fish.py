# Builds every Reel Time fish (v1.13.12): art/fish.blend (one object per species, to look at and tweak) and
# art/_build/fish.json, which scripts/fish-to-js.mjs turns into src/data/fishMesh.js.
#   python3 art/src/fish.py            (needs bpy: pip install bpy)   or, inside Blender: exec(open(path).read())
#
# Every fish is made of GRID parts (a body loft, fin membranes, eyes, barbels, teeth, scutes...). A grid is rows x cols
# of vertices with a colour each; the game rebuilds the triangles from the grid shape, so the shipped data is just
# quantised positions and palette indices (no index lists, no normals).
# Fish space (the game's): nose toward +X, y up, z across; body length about 1. Blender gets (x, -z, y).
import math, json, os, sys, random

try:
    import bpy, bmesh
    HAVE_BPY = True
except ImportError:
    HAVE_BPY = False

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.getcwd()
ART = os.path.dirname(HERE)
OUT_JSON = os.path.join(ART, '_build', 'fish.json')
OUT_BLEND = os.path.join(ART, 'fish.blend')
SPECIES_JSON = os.path.join(ART, '_build', 'species.json')  # written by scripts/fish-to-js.mjs --species

# ------------------------------------------------------------------------------------------------ small math
def lerp(a, b, t): return a + (b - a) * t
def clamp(v, a=0.0, b=1.0): return max(a, min(b, v))
def smooth(e0, e1, x):
    t = clamp((x - e0) / (e1 - e0)) if e1 != e0 else (1.0 if x >= e1 else 0.0)
    return t * t * (3 - 2 * t)
def v_add(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def v_sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def v_mul(a, s): return (a[0] * s, a[1] * s, a[2] * s)
def v_len(a): return math.sqrt(a[0] ** 2 + a[1] ** 2 + a[2] ** 2)
def v_norm(a):
    l = v_len(a) or 1.0
    return (a[0] / l, a[1] / l, a[2] / l)
def v_cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def rot_y(p, a):
    c, s = math.cos(a), math.sin(a)
    return (p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c)
def rot_z(p, a):
    c, s = math.cos(a), math.sin(a)
    return (p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2])
def rot_x(p, a):
    c, s = math.cos(a), math.sin(a)
    return (p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c)

def hexrgb(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255)
def rgbhex(c): return '#%02x%02x%02x' % tuple(int(round(clamp(x) * 255)) for x in c)
def mixc(a, b, t): return (lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t))
def tone(c, k):  # k > 0 lighter, < 0 darker
    return mixc(c, (1, 1, 1), k) if k > 0 else mixc(c, (0, 0, 0), -k)

def hash2(x, y, s=0):
    n = (int(x) * 374761393 + int(y) * 668265263 + s * 2147483647) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffff) / 65535.0
def vnoise(x, y, s=0):  # smooth value noise 0..1
    xi, yi = math.floor(x), math.floor(y); xf, yf = x - xi, y - yi
    u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    a, b = hash2(xi, yi, s), hash2(xi + 1, yi, s)
    c, d = hash2(xi, yi + 1, s), hash2(xi + 1, yi + 1, s)
    return lerp(lerp(a, b, u), lerp(c, d, u), v)

# ------------------------------------------------------------------------------------------------ grids
class Grid:
    """rows x cols vertices. wrap: the cols close into a ring. glow: drawn unlit (lures, glow spots)."""
    def __init__(self, name, pts, cols_rgb, wrap=False, glow=False, cap0=False, cap1=False):
        self.name, self.pts, self.rgb, self.wrap, self.glow = name, pts, cols_rgb, wrap, glow
        self.cap0, self.cap1 = cap0, cap1  # fan the first / last row shut (rows that are rings)
        self.rows, self.cols = len(pts), len(pts[0])

class Fish:
    def __init__(self, sid):
        self.id, self.grids = sid, []
    def add(self, g): self.grids.append(g); return g

# ------------------------------------------------------------------------------------------------ presets
# Body profile: D depth/length, W width/length, peak (where the body is deepest, 0 nose .. 1 tail root), ped
# (tail-root depth as a fraction of D), blunt (nose roundness, higher = blunter), hump (back arches above the
# midline), sag (belly hangs), sq (cross-section squareness, 2 = oval), flat (head flattened, wider than tall).
BASE = dict(D=0.30, W=0.15, peak=0.34, ped=0.32, blunt=0.62, hump=0.06, sag=0.0, sq=2.0, flat=0.0, Lb=0.80,
            mouth='terminal', mouthW=0.5, jaw=0.0, eye=0.055, eyeX=0.12, eyeY=0.32, snout=0.0,
            dorsal=[dict(a=0.36, b=0.64, h=0.17, kind='round')], anal=dict(a=0.62, b=0.80, h=0.11, kind='round'),
            caudal=dict(kind='fork', h=0.42, span=0.20), pect=dict(len=0.13, w=0.06), pelv=dict(len=0.09, a=0.42),
            adipose=False, barbels=None, teeth=None, extras=[])
SHAPES = {
    'tiny': dict(D=0.27, W=0.13, peak=0.36, ped=0.36, blunt=0.6, eye=0.07, eyeX=0.11,
                 dorsal=[dict(a=0.42, b=0.58, h=0.14, kind='pointed')], anal=dict(a=0.62, b=0.76, h=0.09, kind='pointed'),
                 caudal=dict(kind='fork', h=0.40, span=0.19)),
    'slim': dict(D=0.24, W=0.13, peak=0.38, ped=0.34, blunt=0.55, eye=0.05,
                 dorsal=[dict(a=0.40, b=0.58, h=0.14, kind='pointed')], anal=dict(a=0.64, b=0.78, h=0.09, kind='pointed'),
                 caudal=dict(kind='fork', h=0.40, span=0.20)),
    'round': dict(D=0.52, W=0.14, peak=0.40, ped=0.20, blunt=0.75, hump=0.10, eye=0.065, eyeX=0.12, eyeY=0.30,
                  dorsal=[dict(a=0.26, b=0.48, h=0.13, kind='spiny'), dict(a=0.48, b=0.70, h=0.18, kind='round')],
                  anal=dict(a=0.56, b=0.78, h=0.15, kind='round'), caudal=dict(kind='fan', h=0.44, span=0.17),
                  pect=dict(len=0.15, w=0.07), pelv=dict(len=0.11, a=0.36)),
    'big': dict(D=0.33, W=0.18, peak=0.36, ped=0.30, blunt=0.7, hump=0.10, eye=0.045, mouth='inferior',
                dorsal=[dict(a=0.32, b=0.72, h=0.13, kind='long')], anal=dict(a=0.66, b=0.80, h=0.10, kind='round'),
                caudal=dict(kind='fork', h=0.44, span=0.20), barbels=dict(kind='carp')),
    'bass': dict(D=0.33, W=0.17, peak=0.38, ped=0.30, blunt=0.6, hump=0.05, mouth='big', jaw=0.03, eye=0.05,
                 dorsal=[dict(a=0.30, b=0.52, h=0.15, kind='spiny'), dict(a=0.53, b=0.72, h=0.15, kind='round')],
                 anal=dict(a=0.62, b=0.78, h=0.12, kind='round'), caudal=dict(kind='fan', h=0.42, span=0.18)),
    'long': dict(D=0.17, W=0.12, peak=0.45, ped=0.48, blunt=0.42, hump=0.0, snout=0.07, mouth='duck', eye=0.04, eyeX=0.15, eyeY=0.36,
                 dorsal=[dict(a=0.66, b=0.84, h=0.15, kind='round')], anal=dict(a=0.68, b=0.86, h=0.13, kind='round'),
                 caudal=dict(kind='fork', h=0.36, span=0.18), pelv=dict(len=0.08, a=0.55)),
    'cat': dict(D=0.22, W=0.22, peak=0.30, ped=0.36, blunt=0.85, hump=0.07, sag=0.02, flat=0.45, sq=2.3, mouth='wide', eye=0.03, eyeX=0.08, eyeY=0.40,
                dorsal=[dict(a=0.28, b=0.38, h=0.18, kind='spine')], anal=dict(a=0.56, b=0.86, h=0.09, kind='long'),
                caudal=dict(kind='fork', h=0.34, span=0.16), adipose=True, barbels=dict(kind='cat', len=0.22),
                pect=dict(len=0.13, w=0.06, spine=True)),
    'puff': dict(D=0.62, W=0.52, peak=0.42, ped=0.22, blunt=0.95, hump=0.05, sq=2.0, eye=0.08, eyeX=0.10, eyeY=0.25, mouth='beak',
                 dorsal=[dict(a=0.70, b=0.82, h=0.13, kind='round')], anal=dict(a=0.72, b=0.84, h=0.11, kind='round'),
                 caudal=dict(kind='fan', h=0.30, span=0.13), pect=dict(len=0.11, w=0.08), pelv=None, extras=['spikes']),
    'sturgeon': dict(D=0.17, W=0.17, peak=0.30, ped=0.34, blunt=0.30, hump=0.04, flat=0.25, sq=2.4, snout=0.10, mouth='under', eye=0.025, eyeY=0.40,
                     dorsal=[dict(a=0.72, b=0.82, h=0.12, kind='round')], anal=dict(a=0.74, b=0.84, h=0.10, kind='round'),
                     caudal=dict(kind='hetero', h=0.42, span=0.22), pect=dict(len=0.14, w=0.06), barbels=dict(kind='sturgeon'), extras=['scutes']),
    'eel': dict(D=0.10, W=0.09, peak=0.30, ped=0.10, blunt=0.50, hump=0.0, eye=0.03, eyeX=0.06, eyeY=0.40, Lb=1.0,
                dorsal=[dict(a=0.32, b=1.0, h=0.05, kind='eel')], anal=dict(a=0.50, b=1.0, h=0.05, kind='eel'),
                caudal=dict(kind='none'), pect=dict(len=0.06, w=0.04), pelv=None),
    'gar': dict(D=0.14, W=0.11, peak=0.50, ped=0.55, blunt=0.30, snout=0.20, mouth='needle', eye=0.035, eyeX=0.10, eyeY=0.36,
                dorsal=[dict(a=0.74, b=0.86, h=0.13, kind='round')], anal=dict(a=0.72, b=0.86, h=0.12, kind='round'),
                caudal=dict(kind='round', h=0.30, span=0.16), teeth=dict(kind='needle')),
    'paddle': dict(D=0.20, W=0.17, peak=0.34, ped=0.32, blunt=0.40, mouth='wide', eye=0.018, eyeX=0.07, eyeY=0.20,
                   dorsal=[dict(a=0.58, b=0.70, h=0.14, kind='pointed')], anal=dict(a=0.62, b=0.74, h=0.12, kind='pointed'),
                   caudal=dict(kind='fork', h=0.46, span=0.22), extras=['paddle']),
    'lantern': dict(D=0.44, W=0.24, peak=0.30, ped=0.24, blunt=0.95, hump=0.04, mouth='gape', jaw=0.06, eye=0.05, eyeX=0.16, eyeY=0.36,
                    dorsal=[dict(a=0.50, b=0.72, h=0.11, kind='round')], anal=dict(a=0.60, b=0.80, h=0.10, kind='round'),
                    caudal=dict(kind='fan', h=0.36, span=0.16), teeth=dict(kind='fangs', n=7), extras=['lure']),
}

# Per-species changes on top of the shape, so no two fish look the same.
SPECIES = {
    'bluegill': dict(extras=['earflap'], eye=0.07),
    'pumpkinseed': dict(D=0.50, extras=['earflap_red', 'cheeklines']),
    'crappie': dict(D=0.46, mouth='super', jaw=0.025, dorsal=[dict(a=0.40, b=0.66, h=0.24, kind='spiny')], anal=dict(a=0.46, b=0.78, h=0.22, kind='round'), eye=0.075),
    'perch': dict(D=0.27, dorsal=[dict(a=0.28, b=0.50, h=0.16, kind='spiny'), dict(a=0.53, b=0.70, h=0.13, kind='round')], pelv=dict(len=0.09, a=0.33)),
    'minnow': dict(D=0.24, blunt=0.85, eye=0.065),
    'shiner': dict(D=0.30, blunt=0.5, mouth='super', anal=dict(a=0.58, b=0.80, h=0.10, kind='pointed'), extras=['lateral_bright']),
    'bullhead': dict(D=0.24, caudal=dict(kind='square', h=0.32, span=0.15), barbels=dict(kind='cat', len=0.16)),
    'rockbass': dict(D=0.42, eye=0.075, mouth='big', dorsal=[dict(a=0.26, b=0.50, h=0.14, kind='spiny'), dict(a=0.50, b=0.70, h=0.17, kind='round')]),
    'cod': dict(D=0.26, blunt=0.65, mouth='terminal', jaw=-0.02, dorsal=[dict(a=0.28, b=0.42, h=0.13, kind='round'), dict(a=0.46, b=0.62, h=0.11, kind='round'), dict(a=0.66, b=0.80, h=0.10, kind='round')],
                anal=dict(a=0.50, b=0.80, h=0.09, kind='long'), caudal=dict(kind='square', h=0.36, span=0.16), barbels=dict(kind='chin'), extras=['lateral_pale']),
    'carp': dict(D=0.36, hump=0.16, extras=['scales']),
    'largemouth': dict(jaw=0.04, mouthW=0.75),
    'smallmouth': dict(D=0.30, mouthW=0.6, eye=0.055, extras=['eyebars']),
    'rainbowtrout': dict(adipose=True, eye=0.045, caudal=dict(kind='fork', h=0.40, span=0.18), extras=['pepper']),
    'browntrout': dict(adipose=True, D=0.25, caudal=dict(kind='square', h=0.38, span=0.18), extras=['halo_spots']),
    'walleye': dict(D=0.22, eye=0.07, eyeY=0.36, mouth='big', teeth=dict(kind='canine'), dorsal=[dict(a=0.30, b=0.50, h=0.15, kind='spiny'), dict(a=0.54, b=0.70, h=0.13, kind='round')], extras=['glass_eye', 'tail_white']),
    'pike': dict(teeth=dict(kind='needle'), extras=['bean_spots']),
    'catfish': dict(caudal=dict(kind='fork', h=0.40, span=0.18)),
    'puffer': dict(),
    'salmon': dict(adipose=True, D=0.30, hump=0.16, jaw=0.035, mouth='kype', extras=['green_head']),
    'muskie': dict(D=0.18, teeth=dict(kind='needle')),
    'sturgeon': dict(),
    'koi': dict(extras=['veil'], barbels=dict(kind='carp')),
    'char': dict(adipose=True, extras=['white_edges']),
    'gar': dict(),
    'paddlefish': dict(),
    'gloweel': dict(extras=['glow_line', 'ribbon']),
    'moonfin': dict(D=0.52, dorsal=[dict(a=0.30, b=0.62, h=0.22, kind='sail')], anal=dict(a=0.50, b=0.80, h=0.19, kind='sail'), caudal=dict(kind='lunate', h=0.50, span=0.17), extras=['crescent', 'glow_belly']),
    'ghostkoi': dict(extras=['veil', 'translucent'], barbels=dict(kind='carp')),
    'oldwhiskers': dict(D=0.25, W=0.25, flat=0.55, eye=0.025, barbels=dict(kind='cat', len=0.62), extras=['scars', 'warts']),
    'crystalpike': dict(teeth=dict(kind='needle'), extras=['shards']),
    'stormsturgeon': dict(extras=['lightning']),
    'greyling': dict(adipose=True, dorsal=[dict(a=0.30, b=0.64, h=0.26, kind='sail')], eye=0.06, extras=['sail_spots']),
    'drizzledace': dict(D=0.22, blunt=0.5, extras=['rain_drops']),
    'rainspot': dict(adipose=True, snout=0.0, mouth='terminal', D=0.22, dorsal=[dict(a=0.40, b=0.58, h=0.14, kind='pointed')], anal=dict(a=0.64, b=0.78, h=0.10, kind='pointed'), caudal=dict(kind='fork', h=0.38, span=0.18)),
    'thunderbass': dict(D=0.46, extras=['lightning', 'glow_stripe']),
    'cavefish': dict(eye=0.0, extras=['translucent', 'pink_gills']),
    'glowloach': dict(D=0.12, barbels=dict(kind='loach'), dorsal=[dict(a=0.45, b=0.60, h=0.08, kind='round')], anal=dict(a=0.68, b=0.80, h=0.06, kind='round'),
                      caudal=dict(kind='round', h=0.22, span=0.12), pelv=dict(len=0.05, a=0.50), extras=['glow_dots']),
    'albinocat': dict(eye=0.03, extras=['pink_eye']),
    'geodecarp': dict(D=0.36, hump=0.14, extras=['geodes']),
    'echoeel': dict(D=0.12, extras=['glow_rings', 'ribbon']),
    'piranha': dict(D=0.56, peak=0.44, blunt=0.85, hump=0.16, mouth='underbite', jaw=0.06, teeth=dict(kind='saw'), adipose=True,
                    dorsal=[dict(a=0.44, b=0.62, h=0.14, kind='round')], anal=dict(a=0.56, b=0.84, h=0.12, kind='long'), caudal=dict(kind='fork', h=0.40, span=0.16), extras=['glitter']),
    'blackpiranha': dict(D=0.52, peak=0.44, blunt=0.85, hump=0.14, mouth='underbite', jaw=0.06, teeth=dict(kind='saw'), adipose=True, eye=0.07,
                         dorsal=[dict(a=0.44, b=0.62, h=0.14, kind='round')], anal=dict(a=0.56, b=0.84, h=0.12, kind='long'), caudal=dict(kind='fork', h=0.40, span=0.16), extras=['red_eye', 'tail_band']),
    'snakehead': dict(D=0.15, W=0.14, flat=0.25, Lb=0.88, mouth='big', jaw=0.02, eye=0.035, eyeX=0.08,
                      dorsal=[dict(a=0.30, b=0.92, h=0.07, kind='long')], anal=dict(a=0.52, b=0.92, h=0.06, kind='long'), caudal=dict(kind='round', h=0.26, span=0.14), pelv=dict(len=0.05, a=0.32), extras=['blotches']),
    'vampirefish': dict(D=0.22, snout=0.0, mouth='big', jaw=0.04, teeth=dict(kind='vampire'), dorsal=[dict(a=0.50, b=0.62, h=0.13, kind='pointed')], anal=dict(a=0.58, b=0.86, h=0.12, kind='long'),
                        caudal=dict(kind='fork', h=0.46, span=0.20), pect=dict(len=0.16, w=0.06), extras=['red_fins', 'shoulder_spot']),
    'crimsonwolf': dict(D=0.28, W=0.17, blunt=0.85, mouth='gape', jaw=0.05, teeth=dict(kind='fangs', n=6), barbels=None,
                        dorsal=[dict(a=0.26, b=0.86, h=0.11, kind='long')], anal=dict(a=0.52, b=0.86, h=0.09, kind='long'), caudal=dict(kind='round', h=0.30, span=0.15), extras=['scars', 'glow_veins']),
    'millsunfish': dict(D=0.50, extras=['earflap', 'teal_lines']),
    'racerchub': dict(D=0.24, blunt=0.65, mouth='terminal', extras=['red_fins']),
    'pondsage': dict(D=0.36, hump=0.14, extras=['veil', 'beard', 'glow_belly'], barbels=dict(kind='sage')),
    'reedbowfin': dict(D=0.19, W=0.14, peak=0.35, ped=0.55, Lb=0.84, snout=0.0, mouth='terminal', blunt=0.75,
                       dorsal=[dict(a=0.36, b=0.92, h=0.09, kind='long')], anal=dict(a=0.76, b=0.90, h=0.08, kind='round'), caudal=dict(kind='round', h=0.28, span=0.15), extras=['tail_eyespot']),
    'wreckeel': dict(D=0.11, extras=['barnacles']),
    'bogking': dict(D=0.17, extras=['crown', 'moss']),
    'icefin': dict(D=0.24, blunt=0.42, eye=0.06, mouth='inferior', adipose=True, extras=['frost_fins']),
    'burbot': dict(D=0.16, W=0.15, flat=0.3, Lb=0.86, eye=0.03, mouth='wide', barbels=dict(kind='chin'), adipose=False,
                   dorsal=[dict(a=0.30, b=0.40, h=0.06, kind='round'), dict(a=0.42, b=0.92, h=0.08, kind='long')], anal=dict(a=0.52, b=0.92, h=0.07, kind='long'), caudal=dict(kind='round', h=0.24, span=0.13), extras=['marbled']),
    'heir': dict(D=0.36, extras=['frills', 'glow_stripe', 'ice_spines']),
    'slatebass': dict(D=0.32, extras=['slate_plates']),
    'pitlurker': dict(D=0.24, eye=0.022, barbels=dict(kind='cat', len=0.32), extras=['gold_flecks']),
    'crystaltetra': dict(D=0.32, adipose=True, extras=['glow_stripe', 'translucent']),
    'grottoghost': dict(D=0.16, snout=0.04, teeth=None, eye=0.0, extras=['translucent', 'glow_line']),
    'lanternfish': dict(),
}

def spec_for(sp):
    s = dict(BASE); s.update(SHAPES.get(sp['shape'], {})); s.update(SPECIES.get(sp['id'], {}))
    s['extras'] = list(SHAPES.get(sp['shape'], {}).get('extras', [])) + list(SPECIES.get(sp['id'], {}).get('extras', []))
    return s

# ------------------------------------------------------------------------------------------------ the body
class Body:
    """Analytic body: centreline, half-height above and below, half-width at each t (0 nose .. 1 tail root)."""
    def __init__(self, s):
        self.s = s; self.Lb = s['Lb']; self.x0 = self.Lb / 2  # nose x; tail root at x0 - Lb
    def x(self, t): return self.x0 - t * self.Lb
    def t_of(self, x): return (self.x0 - x) / self.Lb
    def depth(self, t):
        s = self.s; D, pk, ped = s['D'], s['peak'], s['ped']
        if t <= pk:
            u = t / pk
            return D * (math.sin(u * math.pi / 2) ** (0.35 + (1 - s['blunt']) * 1.1)) * (0.25 + 0.75 * s['blunt'] if u < 1e-6 else 1)
        v = (t - pk) / (1 - pk)
        return D * (ped + (1 - ped) * (math.cos(v * math.pi / 2) ** 1.25))
    def width(self, t):
        s = self.s; W = s['W']; pk = s['peak'] * 0.85
        if t <= pk:
            u = t / pk
            w = W * (math.sin(u * math.pi / 2) ** (0.42 + (1 - s['blunt']) * 0.9))
        else:
            v = (t - pk) / (1 - pk); w = W * (0.30 + 0.70 * (math.cos(v * math.pi / 2) ** 1.1))
        if s['flat']: w *= 1 + s['flat'] * (1 - smooth(0.0, 0.45, t))  # wide flat head
        return w
    def top(self, t):  # half-height above the centreline
        s = self.s; d = self.depth(t)
        h = d * (0.5 + s['hump'] * math.sin(clamp(t / 0.9) * math.pi))
        if s['flat']: h *= 1 - s['flat'] * 0.35 * (1 - smooth(0.0, 0.4, t))
        return h
    def bot(self, t):
        s = self.s; d = self.depth(t)
        return d * (0.5 - s['hump'] * 0.5 * math.sin(clamp(t / 0.9) * math.pi) + s['sag'] * math.sin(clamp(t / 0.7) * math.pi))
    def cy(self, t):  # centreline height: the snout sits a little low or high with the mouth
        s = self.s; m = {'super': 0.02, 'inferior': -0.04, 'under': -0.06, 'beak': -0.02, 'kype': 0.0, 'underbite': 0.03}.get(s['mouth'], 0.0)
        return m * s['D'] * (1 - smooth(0.0, 0.3, t))
    def surf(self, t, phi):
        """Point on the skin. phi: 0 top, pi/2 the +z side, pi belly."""
        s = self.s; n = s['sq']
        c, sn = math.cos(phi), math.sin(phi)
        se = lambda v: math.copysign(abs(v) ** (2 / n), v)
        y = se(c) * (self.top(t) if c >= 0 else self.bot(t))
        z = se(sn) * self.width(t) / 2
        return (self.x(t), self.cy(t) + y, z)
    def top_y(self, t): return self.cy(t) + self.top(t)
    def bot_y(self, t): return self.cy(t) - self.bot(t)

# ------------------------------------------------------------------------------------------------ colour
class Skin:
    def __init__(self, sp, s, body):
        c = sp['colors']; self.sp, self.s, self.b = sp, s, body
        self.base, self.belly, self.acc, self.fin = hexrgb(c['base']), hexrgb(c['belly']), hexrgb(c['accent']), hexrgb(c['fin'])
        self.back = tone(self.base, -0.22); self.glow = hexrgb(sp.get('glow') or c['accent'])
        self.pat = sp.get('pattern', 'none'); self.ex = set(s['extras']); self.seed = sum(ord(ch) for ch in sp['id'])
        self.eyec = hexrgb(sp['eye']) if sp.get('eye') else None
    def body(self, t, phi, p):
        """Colour of the skin at body param t, angle phi, world point p. Returns (rgb, glow?)."""
        ex, pat, sd = self.ex, self.pat, self.seed
        rel = math.cos(phi)  # +1 back .. -1 belly
        side = math.sin(phi)
        c = mixc(self.belly, self.base, smooth(-0.55, -0.05, rel))
        c = mixc(c, self.back, smooth(0.35, 0.85, rel))
        x, y = t * 40, (phi / math.pi) * 14
        glow = False
        if pat == 'bars':
            nb = 6.5; f = (t * nb + 0.15 * math.sin(phi * 3)) % 1.0
            if 0.12 < t < 0.95 and f < 0.38 and rel > -0.45: c = mixc(c, self.acc, 0.78 * smooth(-0.45, -0.1, rel))
        elif pat == 'stripes':
            if 'lightning' in ex:
                zig = 0.16 * (abs(((t * 9) % 2) - 1) * 2 - 1)
                if abs(rel - 0.05 - zig) < 0.10 and 0.15 < t < 0.98: c, glow = (self.glow if 'glow_stripe' in ex else self.acc), 'glow_stripe' in ex
            else:
                w = 0.13 + 0.05 * vnoise(t * 14, 0, sd)
                if abs(rel - 0.08) < w and 0.18 < t < 0.98: c = mixc(c, self.acc, 0.85)
        elif pat == 'spots':
            n = vnoise(t * 26, phi * 5.5, sd)
            if n > 0.70 and rel > -0.35 and t > 0.15: c = mixc(c, self.acc, 0.9)
            if 'halo_spots' in ex and 0.64 < n <= 0.70 and rel > -0.35 and t > 0.15: c = tone(self.belly, 0.2)
        elif pat == 'speckle':
            n = hash2(t * 90, phi * 22, sd)
            if n > 0.80: c = tone(c, -0.22)
            elif n > 0.965: c = self.acc
        elif pat == 'koi':
            n = 0.6 * vnoise(t * 7 + 3, phi * 2.2 + 1, sd) + 0.4 * vnoise(t * 15, phi * 4.4, sd + 1)
            if n > 0.52 and rel > -0.5: c = self.acc
            if self.sp['id'] == 'koi' and vnoise(t * 9 + 11, phi * 3, sd + 5) > 0.72 and rel > 0: c = (0.08, 0.08, 0.1)
        elif pat == 'glow':
            if abs(rel + 0.02) < 0.06 and (t * 30) % 2 < 1.2 and t > 0.18: c, glow = self.glow, True
            if rel < -0.55 and (t * 24) % 2 < 0.7 and t > 0.2: c, glow = self.glow, True
        # extras painted on the skin
        if 'lateral_bright' in ex and abs(rel - 0.02) < 0.05 and t > 0.2: c = tone(self.acc, 0.35)
        if 'lateral_pale' in ex and abs(rel - 0.15 - 0.12 * math.sin(t * 3)) < 0.035 and t > 0.2: c = tone(self.belly, 0.25)
        if 'glow_line' in ex and abs(rel - 0.0) < 0.05 and t > 0.12: c, glow = self.glow, True
        if 'glow_belly' in ex and rel < -0.6 and t > 0.15 and t < 0.85: c, glow = mixc(c, self.glow, 0.7), True
        if 'glow_rings' in ex and (t * 16) % 1 < 0.18 and t > 0.1: c, glow = self.glow, True
        if 'glow_dots' in ex and hash2(t * 40, phi * 8, sd + 3) > 0.86 and rel < 0.4: c, glow = self.glow, True
        if 'glow_veins' in ex and abs(vnoise(t * 12, phi * 3, sd + 9) - 0.5) < 0.025 and rel > -0.4: c, glow = self.glow, True
        if 'pepper' in ex and hash2(t * 120, phi * 30, sd + 2) > 0.9 and rel > -0.2: c = (0.12, 0.12, 0.14)
        if 'bean_spots' in ex:
            n = vnoise(t * 22, phi * 4, sd + 4)
            if n > 0.62 and rel > -0.4 and t > 0.12: c = mixc(c, self.acc, 0.85)
        if 'scales' in ex:  # a fine scale net: the rear edge of each scale darker
            u, v = t * 34, phi * 7 + (math.floor(t * 34) % 2) * 0.5
            if (u % 1) > 0.78 or (v % 1) > 0.85: c = tone(c, -0.12)
        if 'slate_plates' in ex and ((t * 18) % 1 > 0.85 or ((phi * 5) % 1) > 0.88): c = tone(c, -0.15)
        if 'marbled' in ex and vnoise(t * 16, phi * 5, sd) > 0.55: c = mixc(c, self.acc, 0.65)
        if 'blotches' in ex and vnoise(t * 10, phi * 2.6, sd + 6) > 0.62 and rel > -0.5: c = mixc(c, self.acc, 0.8)
        if 'gold_flecks' in ex and hash2(t * 70, phi * 18, sd + 8) > 0.93: c = self.acc
        if 'glitter' in ex and hash2(t * 80, phi * 20, sd + 7) > 0.94 and rel > -0.3: c = tone(c, 0.45)
        if 'rain_drops' in ex and vnoise(t * 30, phi * 7, sd + 2) > 0.78 and rel > 0.0: c = tone(self.acc, 0.3)
        if 'teal_lines' in ex and t < 0.3 and abs(((rel * 6 + t * 10) % 1) - 0.5) < 0.12: c = self.acc
        if 'cheeklines' in ex and t < 0.3 and abs(((rel * 5 + t * 8) % 1) - 0.5) < 0.13 and rel > -0.4: c = (0.3, 0.6, 0.85)
        if 'green_head' in ex and t < 0.27: c = mixc(c, self.acc, 0.85 * smooth(0.27, 0.2, t))
        if 'moss' in ex and rel > 0.45 and vnoise(t * 18, phi * 6, sd + 1) > 0.5: c = (0.28, 0.42, 0.16)
        if 'warts' in ex and hash2(t * 60, phi * 16, sd + 1) > 0.95: c = tone(c, 0.2)
        if 'scars' in ex and abs(vnoise(t * 5, phi * 1.5, sd + 12) - 0.5) < 0.012: c = tone(self.belly, 0.25)
        if 'shoulder_spot' in ex and abs(t - 0.28) < 0.05 and abs(rel - 0.2) < 0.18: c = (0.1, 0.1, 0.12)
        if 'tail_eyespot' in ex:
            if math.hypot((t - 0.93) * 3, rel - 0.25) < 0.22: c = (0.05, 0.05, 0.05)
            if 0.22 <= math.hypot((t - 0.93) * 3, rel - 0.25) < 0.30: c = (0.9, 0.62, 0.15)
        if 'crescent' in ex:
            a = math.hypot((t - 0.42) * 2.2, rel - 0.1); b = math.hypot((t - 0.38) * 2.2, rel - 0.22)
            if a < 0.42 and b > 0.36 and side > 0.2: c, glow = (1.0, 0.97, 0.78), True
        if 'translucent' in ex: c = mixc(c, (1, 1, 1), 0.15)
        # head: gill-cover edge, cheek, a slightly darker snout
        tg = self.gill_t()
        if abs(t - tg - 0.02 * rel) < 0.008 and abs(rel) < 0.8: c = tone(c, -0.35)
        if 'pink_gills' in ex and abs(t - tg) < 0.03: c = (0.95, 0.55, 0.6)
        if t < tg * 0.55 and rel > 0.1: c = tone(c, -0.08)
        if 'earflap' in ex and abs(t - tg) < 0.04 and abs(rel - 0.15) < 0.18: c = (0.06, 0.06, 0.12)
        if 'earflap_red' in ex:
            d = math.hypot((t - tg) * 3, rel - 0.15)
            if d < 0.16: c = (0.06, 0.06, 0.1)
            if 0.16 <= d < 0.22: c = (0.9, 0.2, 0.15)
        if 'eyebars' in ex and t < tg and abs(((t * 22 - rel * 2) % 3) - 1.5) < 0.3 and rel > -0.4: c = tone(self.acc, -0.2)
        return c, glow
    def gill_t(self): return {'gar': 0.30, 'paddle': 0.28, 'sturgeon': 0.24, 'eel': 0.10, 'long': 0.22}.get(self.sp['shape'], 0.24)
    def finc(self, s, r, kind='fin'):
        """Fin colour at (s along the base, r out from the base 0..1). Rays are drawn by the fin builder."""
        ex = self.ex; c = mixc(self.fin, tone(self.fin, 0.32), r * 0.7)  # fins thin out toward a paler edge
        if 'red_fins' in ex: c = mixc(c, (0.85, 0.25, 0.15), 0.75)
        if 'white_edges' in ex and kind in ('pelv', 'pect', 'anal') and s < 0.12: c = (0.95, 0.95, 0.92)
        if 'frost_fins' in ex and r > 0.6: c = mixc(c, (0.92, 0.97, 1), 0.7)
        if 'tail_white' in ex and kind == 'caudal' and r > 0.82 and s < 0.18: c = (0.95, 0.95, 0.9)
        if 'tail_band' in ex and kind == 'caudal' and r > 0.82: c = (0.04, 0.04, 0.05)
        if 'sail_spots' in ex and kind == 'dorsal' and hash2(s * 18, r * 7, self.seed) > 0.78: c = (0.95, 0.45, 0.65)
        if self.pat == 'koi' and kind in ('caudal', 'dorsal'): c = mixc(c, (1, 1, 1), 0.35)
        if 'veil' in ex: c = mixc(c, (1, 1, 1), 0.3 * r)
        return c

# ------------------------------------------------------------------------------------------------ builders
def build_body(f, b, skin, R=28, S=18):
    pts, rgb, glowmask = [], [], []
    ts = [((i / (R - 1)) ** 1.35) for i in range(R)]  # rings bunch up toward the head
    for t in ts:
        row, crow, grow = [], [], []
        for j in range(S):
            phi = j / S * math.tau
            p = b.surf(t, phi)
            row.append(p); col, gl = skin.body(t, phi if phi <= math.pi else math.tau - phi, p); crow.append(col); grow.append(gl)
        pts.append(row); rgb.append(crow); glowmask.append(grow)
    f.add(Grid('body', pts, rgb, wrap=True, cap0=True, cap1=True))
    # glowing skin (lines, spots, rings) is laid over as thin patches drawn unlit
    patch = [[(gl and 1) for gl in r] for r in glowmask]
    return ts, patch

def membrane(f, name, base, edge, colfn, rays=8, rows=5, cols=None, th=0.006, glow=False, wave=0.0, ray_dark=0.22):
    """A fin: base(s) and edge(s) give 3-D points for s in 0..1. One sheet (the game draws fins from both sides),
    ridged along each ray so the light catches the rays."""
    cols = cols or max(6, rays * 2 + 1)
    pts, rgb = [], []
    for i in range(rows):
        r = i / (rows - 1)
        row, crow = [], []
        for j in range(cols):
            s = j / (cols - 1)
            a, e = base(s), edge(s)
            p = (lerp(a[0], e[0], r), lerp(a[1], e[1], r), lerp(a[2], e[2], r))
            ray = abs(math.cos(s * rays * math.pi))
            nrm = fin_normal(base, edge, s, r)
            span_s = v_len(v_sub(base(1.0), base(0.0))) / max(1, rays)
            w = wave * math.sin(s * 9 + r * 3) * r
            row.append(v_add(p, v_mul(nrm, w)))
            c = colfn(s, r)
            if ray > 0.8: c = tone(c, -ray_dark)
            crow.append(c)
        pts.append(row); rgb.append(crow)
    g = f.add(Grid(name, pts, rgb, glow=glow)); g.fin = True

def fin_normal(base, edge, s, r):
    e = 0.01
    a0, a1 = base(clamp(s - e)), base(clamp(s + e))
    u = v_sub(a1, a0)
    v = v_sub(edge(s), base(s))
    n = v_cross(u, v)
    return v_norm(n) if v_len(n) > 1e-9 else (0, 0, 1)

def median_fin(f, b, skin, name, a, bb, h, kind, rays=None, below=False, z=0.0):
    """Dorsal / anal fin along the back (or belly) from t=a to t=bb."""
    sgn = -1 if below else 1
    rays = rays or max(4, min(12, int((bb - a) * 30)))
    def base(s):
        t = lerp(a, bb, s)
        y = b.bot_y(t) if below else b.top_y(t)
        return (b.x(t), y - sgn * 0.004, z)
    def height(s):
        if kind == 'spiny': return h * (0.55 + 0.45 * math.sin(clamp(s * 1.3) * math.pi * 0.8)) * (0.78 + 0.22 * abs(math.cos(s * rays * math.pi)))
        if kind == 'spine': return h * (1 - s) ** 0.6
        if kind == 'sail': return h * (0.3 + 0.7 * math.sin(clamp(s) * math.pi) ** 0.7) * (1.0 + 0.15 * s)
        if kind == 'pointed': return h * (1 - s) ** 0.8 * (0.35 + 0.65 * smooth(0, 0.18, s)) + h * 0.15
        if kind in ('long', 'eel'): return h * (0.35 + 0.65 * smooth(0, 0.2, s)) * (1 - 0.45 * smooth(0.75, 1.0, s)) * (0.9 + 0.1 * math.sin(s * 14))
        return h * math.sin(clamp(s) * math.pi) ** 0.6 * 0.9 + h * 0.1  # round
    def edge(s):
        p = base(s); hh = height(s)
        rake = {'pointed': 0.45, 'spiny': 0.25, 'spine': 0.5, 'sail': 0.25}.get(kind, 0.15)
        return (p[0] - hh * rake, p[1] + sgn * hh, z)
    def col(s, r): return skin.finc(s, r, 'anal' if below else 'dorsal')
    membrane(f, name, base, edge, col, rays=rays, rows=3, cols=min(13, rays * 2 + 1), th=0.007 if kind != 'spine' else 0.01)

def caudal_fin(f, b, skin, c):
    kind = c['kind']
    if kind == 'none': return
    t1 = 1.0; x1 = b.x(t1); top, bot = b.top_y(t1), b.bot_y(t1); cy = (top + bot) / 2
    H, span = c['h'], c['span']
    rays = 14
    def base(s):  # up the tail root
        return (x1 + 0.01, lerp(bot, top, s), 0.0)
    def edge(s):
        u = s * 2 - 1  # -1 bottom lobe .. +1 top lobe
        if kind == 'fork':
            depth = span * (0.45 + 0.55 * abs(u) ** 0.8)
            return (x1 - depth, cy + u * H / 2, 0.0)
        if kind == 'lunate':
            depth = span * (0.25 + 0.75 * abs(u) ** 1.6) + 0.03
            return (x1 - depth, cy + u * H / 2 * (1 + 0.2 * abs(u)), 0.0)
        if kind == 'fan':
            depth = span * (1 - 0.12 * u * u)
            return (x1 - depth, cy + u * H / 2, 0.0)
        if kind == 'square':
            depth = span * (0.88 + 0.12 * abs(u))
            return (x1 - depth, cy + u * H / 2 * 0.95, 0.0)
        if kind == 'round':
            a = u * math.pi / 2 * 0.95
            return (x1 - span * math.cos(a) - 0.01, cy + math.sin(a) * H / 2, 0.0)
        if kind == 'hetero':  # sturgeon / paddlefish: long upper lobe
            if u > 0: return (x1 - span * (0.4 + 0.9 * u), cy + u * H * 0.62, 0.0)
            return (x1 - span * (0.4 + 0.25 * -u), cy + u * H * 0.32, 0.0)
        if kind == 'veil':
            return (x1 - span * (0.8 + 0.35 * abs(u) ** 1.5 + 0.15 * (1 - abs(u))), cy + u * H / 2 * 1.15, 0.0)
    veil = 'veil' in skin.ex
    if veil and kind in ('fork', 'fan'): kind = 'veil'; H *= 1.05; span *= 1.35
    col = lambda s, r: skin.finc(s, r, 'caudal')
    membrane(f, 'caudal', base, edge, col, rays=rays, rows=4, cols=15, th=0.008, wave=0.012 if veil else 0.0)

def paired_fin(f, b, skin, name, t, y_rel, length, width, down, back, side, kind='pect', spine=False, veil=False):
    """Pectoral / pelvic fin on each side: a fan whose base runs down the body, swept back and a little out."""
    for sz in (1, -1):
        p0 = b.surf(t, math.acos(clamp(y_rel, -1, 1)))
        root = (p0[0], p0[1], sz * abs(p0[2]) * 0.97)
        L = length * (1.45 if veil else 1.0)
        def base(s, root=root):  # a short base, mostly up-and-down
            return (root[0] - s * width * 0.25, root[1] - s * width, root[2])
        def edge(s, root=root, sz=sz):
            u = s * 2 - 1
            reach = L * (0.62 + 0.38 * math.cos(u * math.pi / 2) ** 0.6)
            spread = (-u) * 0.45  # the fan opens up and down
            d = v_norm((-back, -down + spread, sz * side))
            b0 = base(s)
            return (b0[0] + d[0] * reach, b0[1] + d[1] * reach, b0[2] + d[2] * reach)
        col = lambda s, r: skin.finc(s, r, kind)
        membrane(f, '%s_%d' % (name, sz), base, edge, col, rays=6, rows=3, cols=9, th=0.005, wave=0.01 if veil else 0.0)
        if spine:
            s0 = base(0.0); e0 = edge(0.0)
            tube(f, 'spine', [s0, e0], [0.008, 0.002], tone(skin.fin, -0.3), ring=5)

def tube(f, name, pts, radii, color, ring=6, glow=False, color_tip=None):
    rows, rgb = [], []
    N = len(pts)
    for i, p in enumerate(pts):
        t = v_sub(pts[min(i + 1, N - 1)], pts[max(i - 1, 0)]); t = v_norm(t)
        ref = (0, 1, 0) if abs(t[1]) < 0.9 else (1, 0, 0)
        n1 = v_norm(v_cross(t, ref)); n2 = v_norm(v_cross(t, n1))
        r = radii[i] if isinstance(radii, (list, tuple)) and len(radii) == N else lerp(radii[0], radii[-1], i / (N - 1))
        row = []
        for j in range(ring):
            a = j / ring * math.tau
            row.append(v_add(p, v_add(v_mul(n1, math.cos(a) * r), v_mul(n2, math.sin(a) * r))))
        rows.append(row)
        c = mixc(color, color_tip, i / (N - 1)) if color_tip else color
        rgb.append([c] * ring)
    f.add(Grid(name, rows, rgb, wrap=True, glow=glow, cap0=True, cap1=True))

def sphere(f, name, c, r, colfn, lat=8, lon=12, squash=(1, 1, 1), glow=False):
    rows, rgb = [], []
    for i in range(lat + 1):
        th = i / lat * math.pi
        row, crow = [], []
        for j in range(lon):
            ph = j / lon * math.tau
            d = (math.cos(th), math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph))  # pole toward +x
            row.append((c[0] + d[0] * r * squash[0], c[1] + d[1] * r * squash[1], c[2] + d[2] * r * squash[2]))
            crow.append(colfn(d))
        rows.append(row); rgb.append(crow)
    f.add(Grid(name, rows, rgb, wrap=True, glow=glow))

def cone(f, name, base_c, tip, r, color, ring=5, color_tip=None, glow=False):
    tube(f, name, [base_c, tip], [r, r * 0.05], color, ring=ring, color_tip=color_tip, glow=glow)

# ------------------------------------------------------------------------------------------------ head parts
def eyes(f, b, s, skin):
    if s['eye'] <= 0: return
    t = s['eyeX']; r = max(0.016, min(0.055, s['eye'] * (0.85 if s['D'] < 0.3 else 0.75)))
    iris = skin.eyec or ((0.93, 0.80, 0.38) if 'glass_eye' not in skin.ex else (0.88, 0.92, 0.78))
    if 'pink_eye' in skin.ex: iris = (0.95, 0.5, 0.55)
    if 'red_eye' in skin.ex: iris = (0.85, 0.12, 0.1)
    for sz in (1, -1):
        p = b.surf(t, math.acos(clamp(s['eyeY'] * 2, -1, 1)))
        c = (p[0], p[1], sz * (abs(p[2]) - r * 0.55))
        def col(d, sz=sz):
            k = d[2] * sz  # 1 = straight out of the head
            if k > 0.9: cc = (0.02, 0.02, 0.03)
            elif k > 0.62: cc = iris
            elif k > 0.5: cc = tone(iris, -0.5)
            else: cc = tone(skin.base, -0.35)  # the rim, set into the head
            if 0.7 < k < 0.97 and d[0] > 0.12 and d[1] > 0.12: cc = (1, 1, 1)  # a glint toward the nose
            return cc
        # pole straight out of the head, so the iris rings are round
        rows, rgb = [], []
        lat, lon = 6, 10
        for i in range(lat + 1):
            th = i / lat * math.pi
            row, crow = [], []
            for j in range(lon):
                ph = j / lon * math.tau
                d = (math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph), sz * math.cos(th))
                row.append((c[0] + d[0] * r, c[1] + d[1] * r, c[2] + d[2] * r * 0.8))
                crow.append(col(d))
            rows.append(row); rgb.append(crow)
        f.add(Grid('eye', rows, rgb, wrap=True))

def mouth(f, b, s, skin):
    """Lips: a dark crease around the snout tip, and a lower jaw that sticks out for some fish."""
    m = s['mouth']; D = s['D']
    tip = b.surf(0.0, math.pi / 2)
    jaw = s['jaw']
    lipc = tone(skin.base, -0.45)
    wide = s['mouthW'] * (1.6 if m in ('big', 'wide', 'gape') else 1.0)
    if m in ('needle', 'duck', 'beak', 'under'): return
    # a lip band: tube from one corner, round the snout, to the other corner
    pts = []
    corner_t = min(0.12, 0.05 + 0.06 * wide)
    for k in range(9):
        a = (k / 8 - 0.5) * math.pi * 0.95
        t = corner_t * abs(math.sin(a)) ** 1.2
        z = math.sin(a) * b.width(max(t, 0.02)) * 0.52
        yb = b.cy(t) - b.bot(t) * (0.12 if m != 'inferior' else 0.55) + (0.0 if m != 'super' else b.top(t) * 0.25)
        pts.append((b.x(t) + 0.002, yb, z))
    tube(f, 'lip', pts, [0.006] * len(pts), lipc, ring=4)
    if jaw > 0 or m in ('underbite', 'kype', 'gape'):  # lower jaw jutting forward
        jw = max(jaw, 0.03)
        jp = []
        for k in range(7):
            a = (k / 6 - 0.5) * math.pi * 0.9
            t = corner_t * 0.9 * abs(math.sin(a)) ** 1.1
            z = math.sin(a) * b.width(max(t, 0.02)) * 0.5
            jp.append((b.x(t) + jw * 0.25 * math.cos(a) ** 2, b.cy(t) - b.bot(t) * 0.3, z))
        tube(f, 'jaw', jp, [0.008] * len(jp), mixc(skin.belly, skin.base, 0.5), ring=5)


def teeth(f, b, s, skin):
    T = s.get('teeth')
    if not T: return
    k = T['kind']; white = (0.97, 0.96, 0.9)
    if k == 'needle':  # along both long jaws
        n = 12
        for i in range(n):
            t = 0.02 + i / n * 0.16
            for sz in (1, -1):
                p = b.surf(t, math.pi * 0.62); p = (p[0], p[1], sz * abs(p[2]) * 0.8)
                cone(f, 'tooth', p, (p[0] - 0.002, p[1] - 0.012, p[2]), 0.0035, white, ring=4)
    elif k in ('fangs', 'vampire', 'canine', 'saw'):
        n = {'fangs': T.get('n', 6), 'vampire': 2, 'canine': 4, 'saw': 8}[k]
        L = {'fangs': 0.06, 'vampire': 0.10, 'canine': 0.02, 'saw': 0.018}[k]
        for i in range(n):
            u = (i / max(1, n - 1)) * 2 - 1
            t = 0.01 + abs(u) * 0.05
            z = u * b.width(0.05) * 0.38
            y0 = b.cy(t) - b.bot(t) * 0.2
            up = k == 'vampire' or (k == 'fangs' and i % 2 == 0)
            base = (b.x(t) + s['jaw'] * 0.3, y0, z)
            tipp = (base[0] - 0.006, y0 + (L if up else -L) * (1.0 if k != 'saw' else 0.8), z * 1.05)
            cone(f, 'tooth', base, tipp, L * (0.18 if k != 'vampire' else 0.12), white, ring=4)

def barbels(f, b, s, skin):
    B = s.get('barbels')
    if not B: return
    k = B['kind']; c = tone(skin.base, -0.25); tipc = tone(skin.base, 0.15)
    def whisker(start, dirv, L, droop, r=0.006, curl=0.0):
        pts = []
        for i in range(6):
            u = i / 5
            p = v_add(start, v_mul(dirv, L * u))
            p = (p[0], p[1] - droop * u * u, p[2] + curl * u * u)
            pts.append(p)
        tube(f, 'barbel', pts, [r, r * 0.25], c, ring=4, color_tip=tipc)
    nose = b.surf(0.02, math.pi / 2)
    if k == 'cat':
        L = B.get('len', 0.2)
        for sz in (1, -1):
            whisker((b.x(0.03), b.cy(0.03) - 0.005, sz * b.width(0.03) * 0.5), v_norm((0.2, -0.05, sz)), L, L * 0.5, 0.007)  # maxillary
            whisker((b.x(0.01), b.cy(0.01) + b.top(0.01) * 0.6, sz * b.width(0.02) * 0.25), v_norm((0.5, 0.6, sz * 0.4)), L * 0.25, 0.0, 0.004)  # nasal
            for q in (0.3, 0.6):
                whisker((b.x(0.05), b.bot_y(0.05) + 0.004, sz * b.width(0.05) * q * 0.5), v_norm((0.3, -1, sz * 0.2)), L * 0.32, -0.01, 0.004)  # chin
    elif k == 'sturgeon':
        for q in (-0.6, -0.2, 0.2, 0.6):
            whisker((b.x(0.06), b.bot_y(0.06) + 0.003, q * b.width(0.06) * 0.4), (0.15, -1, 0), 0.045, 0.0, 0.004)
    elif k == 'carp':
        for sz in (1, -1): whisker((b.x(0.02), b.cy(0.02) - 0.01, sz * b.width(0.02) * 0.4), v_norm((0.3, -0.4, sz)), 0.05, 0.01, 0.004)
    elif k == 'sage':
        for sz in (1, -1): whisker((b.x(0.02), b.cy(0.02) - 0.01, sz * b.width(0.02) * 0.4), v_norm((0.2, -0.3, sz)), 0.22, 0.12, 0.006, curl=sz * 0.04)
    elif k == 'chin':
        whisker((b.x(0.05), b.bot_y(0.05) + 0.004, 0.0), (0.25, -1, 0), 0.06, -0.01, 0.005)
    elif k == 'loach':
        for sz in (1, -1):
            for q in (0.0, 0.5, 1.0): whisker((b.x(0.02), b.cy(0.02) - 0.006, sz * b.width(0.02) * (0.15 + 0.3 * q)), v_norm((0.6, -0.5, sz * (0.2 + q))), 0.04, 0.01, 0.003)

# ------------------------------------------------------------------------------------------------ extras
def extras(f, b, s, skin, sp):
    ex = skin.ex; rnd = random.Random(skin.seed)
    if 'spikes' in ex:  # puffer
        for i in range(70):
            t = 0.12 + rnd.random() * 0.75; phi = rnd.random() * math.tau
            p = b.surf(t, phi if phi <= math.pi else math.tau - phi)
            p = (p[0], p[1], p[2] if phi <= math.pi else -p[2])
            n = v_norm(v_sub(p, (b.x(t), b.cy(t), 0)))
            cone(f, 'spike', v_sub(p, v_mul(n, 0.004)), v_add(p, v_mul(n, 0.035)), 0.007, tone(skin.base, -0.2), ring=4, color_tip=(0.95, 0.92, 0.8))
    if 'scutes' in ex:  # sturgeon bony plates: back row and two side rows
        for row_phi in (0.0, 1.15, -1.15, 2.1, -2.1):
            n = 13 if row_phi == 0 else 18
            for i in range(n):
                t = 0.22 + i / n * 0.7
                ph = abs(row_phi); p = b.surf(t, ph); p = (p[0], p[1], p[2] if row_phi >= 0 else -p[2])
                nrm = v_norm(v_sub(p, (b.x(t), b.cy(t), 0)))
                cone(f, 'scute', v_sub(p, v_mul(nrm, 0.004)), v_add(v_add(p, v_mul(nrm, 0.016)), (-0.008, 0, 0)), 0.012, tone(skin.base, 0.22), ring=4, color_tip=tone(skin.base, 0.45))
    if 'paddle' in ex:  # paddlefish rostrum
        rows, rgb = [], []
        x0 = b.x(0.0)
        for i in range(10):
            u = i / 9; L = 0.36 * u
            w = 0.022 + 0.035 * math.sin(u * math.pi * 0.9) ** 0.8 * (0.6 + 0.4 * u)
            row, crow = [], []
            for j in range(10):
                a = j / 10 * math.tau
                row.append((x0 + L, b.cy(0) + 0.002 + math.sin(a) * 0.016, math.cos(a) * w))
                crow.append(tone(skin.base, -0.05) if hash2(i * 3, j * 5, 4) > 0.3 else tone(skin.base, -0.3))
            rows.append(row); rgb.append(crow)
        f.add(Grid('paddle', rows, rgb, wrap=True, cap1=True))
    if 'lure' in ex:  # lanternfish: a stalk from the forehead to a glowing bulb
        st = (b.x(0.12), b.top_y(0.12) - 0.004, 0)
        pts = [st, (st[0] + 0.03, st[1] + 0.09, 0), (st[0] + 0.12, st[1] + 0.13, 0), (st[0] + 0.19, st[1] + 0.07, 0)]
        tube(f, 'lure_stalk', pts, [0.008, 0.007, 0.006, 0.005], tone(skin.base, 0.1), ring=5)
        sphere(f, 'lure', pts[-1], 0.03, lambda d: skin.glow, lat=7, lon=10, glow=True)
    if 'shards' in ex:  # crystal pike
        for i in range(9):
            t = 0.25 + i * 0.07; p = (b.x(t), b.top_y(t) - 0.006, 0)
            h = 0.05 + 0.03 * math.sin(i * 1.7)
            cone(f, 'shard', p, (p[0] - 0.02, p[1] + h, (i % 3 - 1) * 0.01), 0.016, (0.75, 0.95, 1.0), ring=4, color_tip=(1, 1, 1), glow=i % 2 == 0)
    if 'geodes' in ex:
        for i in range(14):
            t = 0.25 + rnd.random() * 0.55; phi = 0.3 + rnd.random() * 1.2
            p = b.surf(t, phi); p = (p[0], p[1], p[2] * (1 if i % 2 else -1))
            n = v_norm(v_sub(p, (b.x(t), b.cy(t), 0)))
            cone(f, 'geode', p, v_add(p, v_mul(n, 0.022)), 0.011, (0.65, 0.95, 0.9), ring=5, color_tip=(0.85, 0.7, 1.0), glow=True)
    if 'crown' in ex:  # bog king: a bony crown of points on the head
        for i in range(5):
            u = i / 4 * 2 - 1
            p = (b.x(0.17) - abs(u) * 0.02, b.top_y(0.17) - 0.004, u * 0.03)
            cone(f, 'crown', p, (p[0] - 0.005, p[1] + 0.04 - abs(u) * 0.012, p[2] * 1.3), 0.01, (0.9, 0.75, 0.25), ring=4, color_tip=(1, 0.92, 0.5))
    if 'barnacles' in ex:
        for i in range(16):
            t = 0.15 + rnd.random() * 0.7; phi = rnd.random() * 1.4
            p = b.surf(t, phi); p = (p[0], p[1], p[2] * (1 if i % 2 else -1))
            n = v_norm(v_sub(p, (b.x(t), b.cy(t), 0)))
            tube(f, 'barnacle', [v_sub(p, v_mul(n, 0.002)), v_add(p, v_mul(n, 0.008))], [0.008, 0.005], (0.78, 0.74, 0.62), ring=5)
    if 'frills' in ex or 'ice_spines' in ex:  # leviathan's heir: icy spines down the back and frilled gill
        for i in range(10):
            t = 0.2 + i * 0.07; p = (b.x(t), b.top_y(t) - 0.004, 0)
            cone(f, 'icespine', p, (p[0] - 0.03, p[1] + 0.06 - abs(i - 4) * 0.004, 0), 0.01, (0.7, 0.92, 1.0), ring=4, color_tip=(1, 1, 1), glow=i % 3 == 0)
    if 'beard' in ex:
        for i in range(5):
            u = (i / 4) * 2 - 1
            st = (b.x(0.04), b.bot_y(0.04) + 0.004, u * 0.02)
            tube(f, 'beard', [st, (st[0] - 0.01, st[1] - 0.05, st[2]), (st[0] - 0.03, st[1] - 0.09, st[2] * 1.2)], [0.004, 0.003, 0.0015], (0.95, 0.92, 0.82), ring=4)
    if 'ribbon' in ex:  # a little ribbon fin over the head of the eels
        pass
    if 'earflap' in ex or 'earflap_red' in ex:
        pass

# ------------------------------------------------------------------------------------------------ one fish
def build_fish(sp):
    s = spec_for(sp); b = Body(s); skin = Skin(sp, s, b); f = Fish(sp['id'])
    f.paint = {'ex': sorted(skin.ex), 'gt': round(skin.gill_t(), 3), 'R': 28}  # what the game's texture painter needs
    ts, patch = build_body(f, b, skin)
    # fins
    for k, d in enumerate(s['dorsal'] or []):
        median_fin(f, b, skin, 'dorsal%d' % k, d['a'], d['b'], d['h'], d['kind'])
    if s['anal']:
        a = s['anal']; median_fin(f, b, skin, 'anal', a['a'], a['b'], a['h'], a['kind'], below=True)
    if s['adipose']:
        median_fin(f, b, skin, 'adipose', 0.80, 0.88, 0.05, 'round', rays=1)
    caudal_fin(f, b, skin, s['caudal'])
    veil = 'veil' in skin.ex
    if s['pect']:
        p = s['pect']; paired_fin(f, b, skin, 'pect', skin.gill_t() + 0.035, -0.25, p['len'] * 1.1, p['w'] * 0.9, 0.3, 1.0, 0.35, 'pect', p.get('spine', False), veil)
    if s.get('pelv'):
        p = s['pelv']; paired_fin(f, b, skin, 'pelv', p['a'], -0.85, p['len'], 0.03, 0.55, 1.0, 0.3, 'pelv', False, veil)
    if 'shards' in skin.ex or 'frills' in skin.ex: pass
    eyes(f, b, s, skin)
    mouth(f, b, s, skin)
    teeth(f, b, s, skin)
    barbels(f, b, s, skin)
    extras(f, b, s, skin, sp)
    if s['snout'] > 0: snout(f, b, s, skin)
    # glowing skin is painted into the body texture by the game (src/entities/fishSkin.js)
    return f

def snout(f, b, s, skin):
    """Long jaws for gar, pike, paddle and sturgeon: a tapered beak in front of the head."""
    L = s['snout']; x0 = b.x(0.0)
    rows, rgb = [], []
    R, S = 10, 12
    tb = 0.10  # the snout grows out of the head (its root is buried inside it)
    w0, h0 = b.width(tb) * 0.42, (b.top(tb) + b.bot(tb)) * 0.36
    x0 = b.x(tb)
    for i in range(R):
        u = i / (R - 1)
        w = w0 * (1 - 0.62 * u ** 1.1); h = h0 * (1 - 0.6 * u ** 1.1) * (0.7 if s['mouth'] == 'duck' else 1)
        if s['mouth'] == 'duck': w *= 1 + 0.25 * math.sin(u * math.pi)
        row, crow = [], []
        for j in range(S):
            a = j / S * math.tau
            y = math.cos(a) * h; z = math.sin(a) * w
            row.append((x0 + (L + tb * b.Lb) * u, b.cy(0.0) + y - (0.004 if s['mouth'] == 'under' else 0), z))
            cc = tone(skin.back, -0.05) if math.cos(a) > -0.1 else skin.belly
            if abs(math.cos(a) + 0.1) < 0.2: cc = tone(skin.base, -0.45)  # the mouth line
            crow.append(cc)
        rows.append(row); rgb.append(crow)
    f.add(Grid('snout', rows, rgb, wrap=True, cap1=True))

# ------------------------------------------------------------------------------------------------ output
ALPHA = ''.join(chr(c) for c in range(35, 127) if chr(c) not in '\\')  # printable, JSON-safe: palette index -> one char

def enc_deltas(ds):
    """Small deltas (-44..44) are one character; bigger ones an escape '~' then two base-91 characters of d + 4096."""
    out = []
    for d in ds:
        if -44 <= d <= 44: out.append(ALPHA[d + 44])
        else:
            v = d + 4096; out.append('~' + ALPHA[v // 91] + ALPHA[v % 91])
    return ''.join(out)

def palette_encode(f):
    """Quantise colours to a per-fish palette (merging near-identical ones) so each vertex stores a small index."""
    pal, index = [], {}
    def key(c): return tuple(int(round(clamp(x) * 255 / 4)) for x in c)  # 64 levels per channel
    def idx(c):
        k = key(c)
        if k not in index: index[k] = len(pal); pal.append(rgbhex(tuple(v * 4 / 255 for v in k)))
        return index[k]
    return pal, idx

def to_json(fishes):
    out = {}
    for f in fishes:
        allp = [p for g in f.grids for row in g.pts for p in row]
        mn = [min(p[k] for p in allp) for k in range(3)]; mx = [max(p[k] for p in allp) for k in range(3)]
        span = max(mx[k] - mn[k] for k in range(3)) or 1
        Q = 4095 / span
        pal, idx = palette_encode(f)
        parts = []
        for g in f.grids:
            pos = [int(round((p[k] - mn[k]) * Q)) for row in g.pts for p in row for k in range(3)]
            # delta-encode along the vertex order: neighbours are close, so the numbers stay small
            d = enc_deltas([pos[i] - (pos[i - 3] if i >= 3 else 0) for i in range(len(pos))])
            cols = ''.join(ALPHA[idx(c)] for row in g.rgb for c in row)  # one character per vertex
            part = {'n': g.name, 'r': g.rows, 'c': g.cols, 'p': d, 'k': cols}
            if getattr(g, 'fin', False): part['f'] = 1
            if g.wrap: part['w'] = 1
            if g.glow: part['g'] = 1
            if g.cap0: part['c0'] = 1
            if g.cap1: part['c1'] = 1
            if getattr(g, 'mask', None): part['m'] = [1 if v else 0 for row in g.mask for v in row]
            parts.append(part)
        out[f.id] = {'min': [round(v, 4) for v in mn], 'q': round(1 / Q, 7), 'pal': pal, 'parts': parts, 'paint': f.paint}
    return out

def to_blender(fishes):
    if not HAVE_BPY: return
    if bpy.app.background or not bpy.data.filepath:
        for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    coll = bpy.data.collections.get('ReelTimeFish') or bpy.data.collections.new('ReelTimeFish')
    if coll.name not in bpy.context.scene.collection.children: bpy.context.scene.collection.children.link(coll)
    for o in list(coll.objects): bpy.data.objects.remove(o, do_unlink=True)
    m_skin = bpy.data.materials.get('fish_skin') or bpy.data.materials.new('fish_skin')
    m_glow = bpy.data.materials.get('fish_glow') or bpy.data.materials.new('fish_glow')
    for m, glow in ((m_skin, False), (m_glow, True)):
        m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
        outp = nt.nodes.new('ShaderNodeOutputMaterial'); attr = nt.nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Col'
        if glow:
            em = nt.nodes.new('ShaderNodeEmission'); nt.links.new(attr.outputs['Color'], em.inputs['Color']); em.inputs['Strength'].default_value = 2.0
            nt.links.new(em.outputs[0], outp.inputs['Surface'])
        else:
            bs = nt.nodes.new('ShaderNodeBsdfPrincipled'); nt.links.new(attr.outputs['Color'], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = 0.42
            nt.links.new(bs.outputs[0], outp.inputs['Surface'])
    cols_per_row = 10
    for n, f in enumerate(fishes):
        bm = bmesh.new(); col_layer = bm.loops.layers.color.new('Col')
        for g in f.grids:
            mask = getattr(g, 'mask', None)
            V = [[bm.verts.new((p[0], -p[2], p[1])) for p in row] for row in g.pts]
            C = g.rgb
            cc = g.cols if g.wrap else g.cols - 1
            for i in range(g.rows - 1):
                for j in range(cc):
                    j2 = (j + 1) % g.cols
                    if mask and not (mask[i][j] and mask[i][j2] and mask[i + 1][j] and mask[i + 1][j2]): continue
                    quad = (V[i][j], V[i][j2], V[i + 1][j2], V[i + 1][j])
                    try: face = bm.faces.new(quad)
                    except ValueError: continue
                    face.material_index = 1 if g.glow else 0; face.smooth = True
                    for loop, (a, bb2) in zip(face.loops, ((i, j), (i, j2), (i + 1, j2), (i + 1, j))):
                        c = C[a][bb2]; lin = tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)
                        loop[col_layer] = (*lin, 1.0)
        me = bpy.data.meshes.new('fish_' + f.id); bm.to_mesh(me); bm.free()
        me.materials.append(m_skin); me.materials.append(m_glow)
        ob = bpy.data.objects.new('fish_' + f.id, me); coll.objects.link(ob)
        ob.location = ((n % cols_per_row) * 1.5, 0, -(n // cols_per_row) * 1.0)

def main(only=None):
    with open(SPECIES_JSON) as fh: species = json.load(fh)
    fishes = [build_fish(sp) for sp in species if not sp.get('shell') and (not only or sp['id'] in only)]
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    data = to_json(fishes)
    with open(OUT_JSON, 'w') as fh: json.dump(data, fh, separators=(',', ':'))
    print('fish.json: %d fish, %d KB' % (len(data), os.path.getsize(OUT_JSON) // 1024))
    if HAVE_BPY:
        to_blender(fishes)
        if bpy.app.background: bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND); print('saved', OUT_BLEND)
    return fishes

if __name__ == '__main__':
    only = [a for a in sys.argv[1:] if not a.startswith('-')] if '--' not in sys.argv else sys.argv[sys.argv.index('--') + 1:]
    main(only or None)
