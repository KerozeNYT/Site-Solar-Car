"""
Fetches the open data of the access plan (scripts/map/plan.py) into .cache/plan/, in local
metres (scripts/map/common.py: x east, y north). Run once; plan.py then draws from the cache.

  - Overture Maps (ODbL / CDLA), s3://overturemaps-us-west-2: water, roads, land use, buildings
    around the workshop
  - Commune outlines: github.com/gregoiredavid/france-geojson (IGN ADMIN EXPRESS, Licence Ouverte)

Usage: python scripts/map/plan_data.py   (needs: pyarrow shapely pyproj requests)
"""
import json, os, sys
import requests
from pyproj import Transformer
from shapely import wkb
from shapely.geometry import shape, mapping, box
from shapely.ops import transform

sys.path.insert(0, os.path.dirname(__file__))
from common import PROJ, WORKSHOP  # noqa
from overture import scan, REL

CACHE = os.path.join(os.path.dirname(__file__), '..', '..', '.cache', 'plan')
os.makedirs(CACHE, exist_ok=True)
T = Transformer.from_crs('EPSG:4326', PROJ, always_xy=True)
local = lambda g: transform(lambda x, y, z=None: T.transform(x, y), g)
WX, WY = T.transform(*WORKSHOP)

# the overview: Tours to Vouvray; the zoom: the business park around the workshop
LL_BBOX = (0.62, 47.35, 0.86, 47.47)
ZOOM_M = 700  # half-size of the zoom (m)
ZX0, ZY0, ZX1, ZY1 = WX - ZOOM_M, WY - ZOOM_M, WX + ZOOM_M, WY + ZOOM_M
IT = Transformer.from_crs(PROJ, 'EPSG:4326', always_xy=True)
zl0 = IT.transform(ZX0, ZY0)
zl1 = IT.transform(ZX1, ZY1)
ZOOM_LL = (zl0[0], zl0[1], zl1[0], zl1[1])


def save(name, feats):
    with open(os.path.join(CACHE, name + '.geojson'), 'w') as f:
        json.dump({'type': 'FeatureCollection', 'features': feats}, f)
    print(name, len(feats))


def name_of(n):
    return (n or {}).get('primary') if isinstance(n, dict) else None


# ----------------------------------------------------------------- water
t = scan(f'{REL}/theme=base/type=water/', LL_BBOX, columns=['subtype', 'class', 'names', 'geometry'])
feats = []
for r in t.to_pylist():
    g = local(wkb.loads(r['geometry']))
    feats.append({'type': 'Feature', 'properties': {'subtype': r['subtype'], 'class': r['class'], 'name': name_of(r['names'])}, 'geometry': mapping(g)})
save('water', feats)

# ----------------------------------------------------------------- roads
t = scan(f'{REL}/theme=transportation/type=segment/', LL_BBOX, columns=['subtype', 'class', 'names', 'routes', 'geometry', 'road_flags'])
feats = []
zoom = box(ZX0, ZY0, ZX1, ZY1)
MAJOR = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary'}
for r in t.to_pylist():
    if r['subtype'] != 'road':
        continue
    g = local(wkb.loads(r['geometry']))
    if r['class'] not in MAJOR and not g.intersects(zoom):
        continue
    refs = sorted({(x.get('ref') or '').replace(' ', '') for x in (r['routes'] or []) if x.get('ref')})
    feats.append({'type': 'Feature', 'properties': {'class': r['class'], 'name': name_of(r['names']), 'refs': refs}, 'geometry': mapping(g)})
save('roads', feats)

# ----------------------------------------------------------------- land use (built-up areas)
t = scan(f'{REL}/theme=base/type=land_use/', LL_BBOX, columns=['subtype', 'class', 'geometry'])
feats = []
for r in t.to_pylist():
    if r['subtype'] not in ('residential', 'developed', 'commercial', 'industrial', 'education', 'medical', 'transportation'):
        continue
    g = local(wkb.loads(r['geometry']))
    if g.geom_type not in ('Polygon', 'MultiPolygon') or g.area < 2000:
        continue
    feats.append({'type': 'Feature', 'properties': {'subtype': r['subtype'], 'class': r['class']}, 'geometry': mapping(g)})
save('landuse', feats)

# ----------------------------------------------------------------- buildings of the zoom
t = scan(f'{REL}/theme=buildings/type=building/', ZOOM_LL, columns=['names', 'class', 'geometry'])
feats = []
for r in (t.to_pylist() if t is not None else []):
    g = local(wkb.loads(r['geometry']))
    if not g.intersects(zoom):
        continue
    feats.append({'type': 'Feature', 'properties': {'name': name_of(r['names']), 'class': r['class']}, 'geometry': mapping(g)})
save('buildings', feats)

# ----------------------------------------------------------------- communes
COMMUNES = 'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements/37-indre-et-loire/communes-37-indre-et-loire.geojson'
gj = requests.get(COMMUNES, timeout=60).json()
area = box(*T.transform(LL_BBOX[0], LL_BBOX[1]), *T.transform(LL_BBOX[2], LL_BBOX[3]))
feats = []
for f in gj['features']:
    g = local(shape(f['geometry']))
    if g.intersects(area):
        feats.append({'type': 'Feature', 'properties': {'name': f['properties'].get('nom')}, 'geometry': mapping(g)})
save('communes', feats)
print('workshop', round(WX, 1), round(WY, 1))
