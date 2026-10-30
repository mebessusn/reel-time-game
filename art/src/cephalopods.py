# Open Waters (v1.15): the giant squid and the reef octopus (fish.py can't build them: no fins, lots of arms).
#   python3 art/src/cephalopods.py      -> art/cephalopods.blend + art/cephalopods.glb
#   node scripts/glb-to-js.mjs art/cephalopods.glb src/data/cephMesh.js CEPH
# Like the shellfish, each is one node named by species id, "nose" along +X (the squid's mantle tip, the octopus's
# head), about 1 unit long; the game scales them by weight.
import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
import bpy
from kit import Model, mat, reset, export

OUT = os.path.join(os.path.dirname(__file__), '..', 'cephalopods')
reset()
SQ = mat('squid_skin', '#b8443a', 0.45)
SQL = mat('squid_light', '#e8b0a0', 0.5)
OC = mat('octo_skin', '#b06a4a', 0.6)
OCS = mat('octo_suckers', '#efd2c0', 0.6)
EYE = mat('ceph_eye', '#111418', 0.15)
EYEW = mat('ceph_eye_white', '#e8e0c8', 0.4)

# ---- giant squid: a long mantle with fins at the tip, a head with dinner-plate eyes, eight arms and two long tentacles
sq = Model('giantsquid')
sq.part('sweep', SQ, points=[(0.62, 0, 0), (0.5, 0, 0), (0.25, 0, 0), (0.0, 0, 0), (-0.12, 0, 0)], r=[0.01, 0.06, 0.1, 0.11, 0.09], ring=10)
sq.part('poly', SQ, loc=(0.48, 0, 0), points=[(0.16, 0), (0.0, 0.14), (-0.1, 0), (0.0, -0.14)], depth=0.012, rot=(90, 0, 0))  # the fins
sq.part('rock', SQL, loc=(-0.17, 0, 0), size=(0.07, 0.085, 0.08), sub=2)  # head
for s in (-1, 1):
    sq.part('rock', EYEW, loc=(-0.16, s * 0.075, 0.01), size=(0.035, 0.012, 0.035), sub=2)
    sq.part('rock', EYE, loc=(-0.16, s * 0.083, 0.01), size=(0.02, 0.008, 0.02), sub=1)
for i in range(8):
    a = i / 8 * math.tau
    pts = [(-0.22 - k * 0.06, math.cos(a) * (0.04 + k * 0.012) + math.sin(k * 0.9 + i) * 0.01 * k, math.sin(a) * (0.04 + k * 0.012)) for k in range(6)]
    sq.part('sweep', SQ if i % 2 else SQL, points=pts, r=[0.016, 0.014, 0.011, 0.008, 0.005, 0.002], ring=5)
for s in (-1, 1):
    pts = [(-0.22 - k * 0.11, s * (0.02 + math.sin(k * 0.6) * 0.03), -0.01 * k) for k in range(8)]
    sq.part('sweep', SQ, points=pts, r=[0.01, 0.008, 0.007, 0.006, 0.006, 0.006, 0.014, 0.004], ring=5)  # club at the end
sq_o = sq.finish()

# ---- reef octopus: a soft head, eyes on top, eight curling arms
oc = Model('octopus')
oc.part('rock', OC, loc=(0.1, 0, 0.05), size=(0.13, 0.1, 0.095), sub=3, amp=0.01, freq=6)
for s in (-1, 1):
    oc.part('rock', EYEW, loc=(0.02, s * 0.075, 0.1), size=(0.03, 0.02, 0.03), sub=2)
    oc.part('rock', EYE, loc=(0.0, s * 0.09, 0.1), size=(0.015, 0.008, 0.02), sub=1)
for i in range(8):
    a = (i + 0.5) / 8 * math.tau
    pts = []
    for k in range(7):
        rr = 0.06 + k * 0.055
        curl = a + k * 0.18 * (1 if i % 2 else -1)
        pts.append((-0.02 + math.cos(curl) * rr * 0.5 - k * 0.03, math.sin(curl) * rr, -0.02 - k * 0.006 + (0.04 if k == 6 else 0)))
    oc.part('sweep', OC, points=pts, r=[0.04, 0.034, 0.027, 0.02, 0.014, 0.008, 0.003], ring=6)
    for k in (1, 2, 3):
        x, y, z = pts[k]
        oc.part('rock', OCS, loc=(x, y, z - 0.018 + 0.004 * k), size=(0.008, 0.008, 0.004), sub=1)
oc_o = oc.finish()

export([sq_o, oc_o], OUT, spacing=1.6)
