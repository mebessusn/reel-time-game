# Contact sheet of the fish in art/fish.blend: python3 art/src/fish_render.py <out.png> [ids...] [--view side|three]
import bpy, sys, os, math
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
out = args[0]; view = 'three'
ids = []
for a in args[1:]:
    if a.startswith('--view='): view = a.split('=')[1]
    else: ids.append(a)
ART = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=os.path.join(ART, 'fish.blend'))
sc = bpy.context.scene
fish = [o for o in bpy.data.objects if o.name.startswith('fish_') and (not ids or o.name[5:] in ids)]
cols = min(6, len(fish)); rows = math.ceil(len(fish) / cols)
for o in bpy.data.objects:
    if o.name.startswith('fish_'): o.hide_render = o not in fish
for n, o in enumerate(fish):
    o.location = ((n % cols) * 1.35, 0, -(n // cols) * 0.8)
    o.rotation_euler = (0, 0, 0)
    if view == 'three': o.rotation_euler = (math.radians(12), 0, math.radians(-28))
    if view == 'top': o.rotation_euler = (math.radians(90), 0, 0)
cam_d = bpy.data.cameras.new('cam'); cam_d.type = 'ORTHO'
cam_d.ortho_scale = max(cols * 1.35, rows * 0.8 * 1.6) + 0.2
cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
cx, cz = (cols - 1) * 1.35 / 2, -(rows - 1) * 0.8 / 2
cam.location = (cx, -10, cz); cam.rotation_euler = (math.radians(90), 0, 0)
for l in [o for o in bpy.data.objects if o.type == 'LIGHT']: bpy.data.objects.remove(l)
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(50), math.radians(-20), math.radians(-30)); sun.data.energy = 3.2
fill = bpy.data.objects.new('fill', bpy.data.lights.new('fill', 'SUN')); sc.collection.objects.link(fill)
fill.rotation_euler = (math.radians(-60), math.radians(30), math.radians(150)); fill.data.energy = 1.0
w = sc.world or bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.68, 0.72, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.6
sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.device = 'CPU'
sc.render.resolution_x = 300 * cols; sc.render.resolution_y = int(300 * cols * (rows * 0.8 * 1.6 + 0.2) / (cols * 1.35 + 0.2) / 1.6) if cols * 1.35 >= rows * 0.8 * 1.6 else 300 * rows
sc.render.resolution_y = max(200, int(sc.render.resolution_x * (rows * 0.8 + 0.25) / (cols * 1.35 + 0.1)))
cam_d.ortho_scale = cols * 1.35 + 0.1
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('wrote', out)
