"""
Draws the access plan of the workshop (src/templates/pages.js, visitBlock) from the open data
fetched by scripts/map/plan_data.py (.cache/plan/):
  public/map/plan.svg       overview, Tours to Vouvray: the Loire and the Cher, built-up areas,
                            main roads, the commune of Vouvray, the road route from the centre of
                            Tours (public/map/map.json), the frame of the zoom
  public/map/plan-zoom.svg  the arrival: the streets and buildings of the business park around
                            395 rue des Entrepreneurs
  content/plan.json         where the page lays its labels over them (percent of each picture):
                            towns, rivers, roads, the workshop, the start of the route, scales

Plain shapes in the site's colours, no text inside the pictures: the page writes the labels in
its own fonts, sharp at every size, readable by screen readers and search engines.

Usage: python scripts/map/plan.py   (needs: shapely)
"""
import json, math, os, sys
from shapely.geometry import shape, box, LineString, Point, MultiLineString
from shapely.ops import unary_union, linemerge

sys.path.insert(0, os.path.dirname(__file__))
from common import OUT  # noqa

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
CACHE = os.path.join(ROOT, '.cache', 'plan')
load = lambda n: json.load(open(os.path.join(CACHE, n + '.geojson')))['features']
DATA = json.load(open(os.path.join(OUT, 'map.json')))
WX, WY = DATA['workshop']['x'], DATA['workshop']['y']

# ------------------------------------------------------------------ colours (site palette)
BG = '#0b0c0f'
URBAN = '#17191e'
WATER = '#1d3044'
WATER_EDGE = '#2b4258'
ROAD = {'motorway': ('#8d8f97', 3.6), 'trunk': ('#74767e', 3), 'primary': ('#5c5e66', 2.4), 'secondary': ('#45474e', 1.8), 'tertiary': ('#303238', 1.3)}
GOLD = '#e3c27a'

# ------------------------------------------------------------------ overview frame (16:11)
W, H = 1600, 1100
X0, X1 = -6900.0, 6900.0
SCALE = W / (X1 - X0)  # px per metre
Y1 = 5150.0  # top
Y0 = Y1 - H / SCALE
FRAME = box(X0, Y0, X1, Y1)
MARGIN = FRAME.buffer(400, join_style=2)


def px(x, y):
    return (x - X0) * SCALE, (Y1 - y) * SCALE


def pct(x, y, w=W, h=H, f=px):
    a, b = f(x, y)
    return round(a / w * 100, 2), round(b / h * 100, 2)


def path(geom, f=px, closed=True):
    """SVG path data of a (multi) polygon or (multi) line string"""
    out = []

    def ring(coords, close):
        pts = [f(x, y) for x, y, *_ in coords]
        if not pts:
            return
        s = 'M' + ' '.join(f'{a:.1f},{b:.1f}' for a, b in pts[:1])
        prev = pts[0]
        for a, b in pts[1:]:
            # relative moves: shorter
            s += f'l{a - prev[0]:.1f},{b - prev[1]:.1f}'
            prev = (a, b)
        out.append(s + ('z' if close else ''))

    def walk(g):
        t = g.geom_type
        if t == 'Polygon':
            ring(g.exterior.coords, True)
            for i in g.interiors:
                ring(i.coords, True)
        elif t == 'LineString':
            ring(g.coords, False)
        elif t in ('MultiPolygon', 'MultiLineString', 'GeometryCollection'):
            for p in g.geoms:
                walk(p)

    walk(geom)
    return ''.join(out).replace('.0,', ',').replace('.0l', 'l').replace('.0z', 'z')


# ------------------------------------------------------------------ overview layers
print('built-up areas…')
urban = []
for f in load('landuse'):
    g = shape(f['geometry'])
    if g.intersects(MARGIN):
        urban.append(g.intersection(MARGIN))
urban = unary_union(urban).buffer(25, join_style=2).buffer(-25, join_style=2).simplify(12)
urban = unary_union([p for p in getattr(urban, 'geoms', [urban]) if p.area > 60000])

print('water…')
water = []
for f in load('water'):
    p = f['properties']
    g = shape(f['geometry'])
    if not g.geom_type.endswith('Polygon') or not g.intersects(MARGIN):
        continue
    keep = p['subtype'] == 'river' or (p['subtype'] in ('lake', 'water', 'reservoir') and g.area > 40000)
    if keep:
        water.append(g.intersection(MARGIN))
water = unary_union(water).buffer(4).buffer(-4).simplify(5)

print('communes…')
vouvray = None
communes = []
for f in load('communes'):
    g = shape(f['geometry'])
    if f['properties']['name'] == 'Vouvray':
        vouvray = g
    communes.append(g.boundary.intersection(MARGIN))
communes = unary_union(communes).simplify(10)

print('roads…')
lines = {k: [] for k in ROAD}
for f in load('roads'):
    c = f['properties']['class']
    if c not in lines:
        continue
    g = shape(f['geometry'])
    if g.intersects(MARGIN):
        lines[c].append(g.intersection(MARGIN))
roads = {}
for c, ls in lines.items():
    u = unary_union(ls) if ls else None
    m = linemerge(u) if u is not None and u.geom_type == 'MultiLineString' else u
    roads[c] = m.simplify(6) if m is not None else None

route = LineString([(x, y) for x, y, _ in DATA['route']['pts']])
start = route.coords[0]

# the zoom: its frame on the overview
Z = 450.0  # half-size (m)
ZFRAME = box(WX - Z, WY - Z, WX + Z, WY + Z)

svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
       f'<rect width="{W}" height="{H}" fill="{BG}"/>',
       f'<path d="{path(urban)}" fill="{URBAN}"/>']
if vouvray is not None:
    svg.append(f'<path d="{path(vouvray.intersection(MARGIN).simplify(8))}" fill="{GOLD}" fill-opacity=".045" stroke="{GOLD}" stroke-opacity=".35" stroke-width="1.6" stroke-dasharray="7 6"/>')
svg.append(f'<path d="{path(communes)}" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="1.2" stroke-dasharray="3 5"/>')
svg.append(f'<path d="{path(water)}" fill="{WATER}" stroke="{WATER_EDGE}" stroke-width="1"/>')
for c in ['tertiary', 'secondary', 'primary', 'trunk', 'motorway']:
    if roads.get(c) is None:
        continue
    col, wd = ROAD[c]
    svg.append(f'<path d="{path(roads[c])}" fill="none" stroke="{col}" stroke-width="{wd}" stroke-linecap="round" stroke-linejoin="round"/>')
# the route from Tours: a soft glow under a gold line
rd = path(route.simplify(3))
svg.append(f'<path d="{rd}" fill="none" stroke="{GOLD}" stroke-opacity=".18" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>')
svg.append(f'<path d="{rd}" fill="none" stroke="{GOLD}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>')
sx, sy = px(*start)
svg.append(f'<circle cx="{sx:.1f}" cy="{sy:.1f}" r="10" fill="{BG}" stroke="{GOLD}" stroke-width="4"/>')
# the frame of the zoom around the workshop
zx0, zy0 = px(WX - Z, WY + Z)
zx1, zy1 = px(WX + Z, WY - Z)
svg.append(f'<rect x="{zx0:.1f}" y="{zy0:.1f}" width="{zx1 - zx0:.1f}" height="{zy1 - zy0:.1f}" rx="6" fill="none" stroke="{GOLD}" stroke-opacity=".7" stroke-width="2"/>')
svg.append('</svg>')
open(os.path.join(OUT, 'plan.svg'), 'w').write('\n'.join(svg))

# ------------------------------------------------------------------ zoom (square)
ZW = 1000
ZS = ZW / (2 * Z)
zf = lambda x, y: ((x - (WX - Z)) * ZS, ((WY + Z) - y) * ZS)
ZBOX = ZFRAME.buffer(60, join_style=2)
zsvg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {ZW} {ZW}" width="{ZW}" height="{ZW}">', f'<rect width="{ZW}" height="{ZW}" fill="{BG}"/>']
fields = [shape(f['geometry']).intersection(ZBOX) for f in load('landuse') if shape(f['geometry']).intersects(ZBOX)]
if fields:
    zsvg.append(f'<path d="{path(unary_union(fields).simplify(1), zf)}" fill="{URBAN}"/>')
blds = [shape(f['geometry']) for f in load('buildings')]
blds = [b for b in blds if b.intersects(ZBOX)]
zsvg.append(f'<path d="{path(unary_union(blds).simplify(0.6), zf)}" fill="#24262c" stroke="#33353c" stroke-width="1.5"/>')
ZROAD = {'secondary': ('#4d4e55', 13), 'tertiary': ('#45464d', 11), 'unclassified': ('#3c3d44', 9), 'residential': ('#3c3d44', 8), 'service': ('#2e2f35', 5), 'unknown': ('#2e2f35', 5), 'track': ('#2a2b30', 3)}
streets = {}
zl = {k: [] for k in ZROAD}
for f in load('roads'):
    p = f['properties']
    if p['class'] not in ZROAD:
        continue
    g = shape(f['geometry'])
    if not g.intersects(ZBOX):
        continue
    g = g.intersection(ZBOX)
    zl[p['class']].append(g)
    if p['name']:
        streets.setdefault(p['name'], []).append(g)
for c in ['track', 'service', 'unknown', 'residential', 'unclassified', 'tertiary', 'secondary']:
    if not zl[c]:
        continue
    col, wd = ZROAD[c]
    dash = ' stroke-dasharray="8 8"' if c == 'track' else ''
    zsvg.append(f'<path d="{path(unary_union(zl[c]).simplify(0.8), zf)}" fill="none" stroke="{col}" stroke-width="{wd}" stroke-linecap="round" stroke-linejoin="round"{dash}/>')
# the last metres of the route, from where it enters the zoom
inside = route.intersection(ZFRAME.buffer(60))
if not inside.is_empty:
    d = path(inside, zf)
    zsvg.append(f'<path d="{d}" fill="none" stroke="{GOLD}" stroke-opacity=".2" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>')
    zsvg.append(f'<path d="{d}" fill="none" stroke="{GOLD}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>')
zsvg.append('</svg>')
open(os.path.join(OUT, 'plan-zoom.svg'), 'w').write('\n'.join(zsvg))


# ------------------------------------------------------------------ labels
def street_label(name, geoms):
    """the middle of the longest stretch of a street, and its angle (degrees, kept readable)"""
    u = unary_union(geoms)
    m = linemerge(u) if u.geom_type == 'MultiLineString' else u
    parts = [g for g in getattr(m, 'geoms', [m]) if g.geom_type == 'LineString']
    if not parts:
        return None
    best = max(parts, key=lambda g: g.length)
    if best.length < 120:
        return None
    mid = best.interpolate(0.5, normalized=True)
    a = best.interpolate(max(0, best.length / 2 - 40))
    b = best.interpolate(min(best.length, best.length / 2 + 40))
    ang = math.degrees(math.atan2(-(b.y - a.y), b.x - a.x))
    if ang > 90:
        ang -= 180
    if ang < -90:
        ang += 180
    x, y = pct(mid.x, mid.y, ZW, ZW, zf)
    return {'name': name, 'x': x, 'y': y, 'angle': round(ang, 1)}


STREETS = ['Rue des Entrepreneurs', 'Route de Monnaie', "Rue de l'Étang Vignon"]
labels = {
    'route': {'km': DATA['route']['km'], 'from': DATA['route']['from']},
    'start': dict(zip(('x', 'y'), pct(*start))),
    'workshop': dict(zip(('x', 'y'), pct(WX, WY))),
    'zoomWorkshop': dict(zip(('x', 'y'), pct(WX, WY, ZW, ZW, zf))),
    'zoomFrame': {'x': round(zx0 / W * 100, 2), 'y': round(zy0 / H * 100, 2), 'w': round((zx1 - zx0) / W * 100, 2), 'h': round((zy1 - zy0) / H * 100, 2)},
    # one kilometre on each picture, in percent of its width
    'scale': {'overview': round(1000 * SCALE / W * 100, 3), 'zoom': round(100 * ZS / ZW * 100, 3)},
    'places': [],
    # the streets that lead to the workshop (the others would crowd the zoom)
    'streets': [s for s in (street_label(n, streets[n]) for n in STREETS if n in streets) if s and 8 < s['x'] < 92 and 8 < s['y'] < 92],
}
for l in DATA['labels']:
    # the zoom sits over the top left corner: nothing to label there (the airport)
    if not FRAME.contains(Point(l['x'], l['y'])) or l['kind'] in ('road', 'poi'):
        continue
    x, y = pct(l['x'], l['y'])
    # near an edge, the label runs inwards from its point; the small towns give way on phones
    align = 'start' if x < 14 else 'end' if x > 86 else 'middle'
    minor = l['kind'] == 'town' and l['name'] not in ('Rochecorbon',)
    labels['places'].append({'name': l['name'], 'kind': l['kind'], 'x': x, 'y': y, 'align': align, 'minor': minor})
# the A10, where it crosses the north of the map
if roads.get('motorway') is not None:
    mw = roads['motorway']
    parts = list(getattr(mw, 'geoms', [mw]))
    best = max(parts, key=lambda g: g.length)
    p = best.interpolate(0.62, normalized=True)
    labels['places'].append({'name': 'A10', 'kind': 'road', 'x': pct(p.x, p.y)[0], 'y': pct(p.x, p.y)[1], 'align': 'middle', 'minor': False})
json.dump(labels, open(os.path.join(ROOT, 'content', 'plan.json'), 'w'), ensure_ascii=False, indent=1)
for n in ('plan.svg', 'plan-zoom.svg'):
    print(n, round(os.path.getsize(os.path.join(OUT, n)) / 1024, 1), 'Ko')
print(json.dumps(labels, ensure_ascii=False)[:1500])
