"""
Bakes the data of the 3D access map (src/js/map3d.js) into public/map/:
  sat.webp / sat-1024.webp  Sentinel-2 true colour (Copernicus), graded
  dem.png                   relief (Copernicus DEM GLO-30), height = (R * 256 + G) / 100 m
  mask.png                  R = water (ESA WorldCover), G = commune of Vouvray
  map.json                  extent, workshop, labels, route from Tours, Vouvray outline, credits

Open data only, read straight from their public buckets (no API key):
  - Sentinel-2 L2A COGs, s3://sentinel-cogs (Copernicus Sentinel data, free and open)
  - Copernicus DEM GLO-30, s3://copernicus-dem-30m
  - ESA WorldCover 2021 v200, s3://esa-worldcover (CC BY 4.0)
  - Overture Maps (places, divisions, roads; ODbL / CDLA), s3://overturemaps-us-west-2
  - Commune outlines: github.com/gregoiredavid/france-geojson (IGN ADMIN EXPRESS, Licence Ouverte)

Usage: python scripts/map/bake.py   (needs: rasterio numpy pillow shapely pyproj pyarrow requests)
"""
import heapq, json, math, os, sys, time
import numpy as np, rasterio, requests
from PIL import Image, ImageFilter
from pyproj import Transformer
from rasterio.transform import from_bounds
from rasterio.warp import reproject, Resampling
from rasterio.features import rasterize
from shapely import wkb
from shapely.geometry import shape, LineString, mapping
import shapely

sys.path.insert(0, os.path.dirname(__file__))
from common import *  # noqa
from overture import scan, REL

os.makedirs(OUT, exist_ok=True)
T = Transformer.from_crs('EPSG:4326', PROJ, always_xy=True)
to_local = lambda lon, lat: T.transform(lon, lat)
LL_BBOX = (0.60, 47.34, 0.90, 47.49)  # lon/lat box comfortably around the extent

SCENE = 'sentinel-s2-l2a-cogs/31/T/CN/2025/7/S2B_31TCN_20250701_0_L2A'  # cloud cover 0.002 %
DEM = 'https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N47_00_E000_00_DEM/Copernicus_DSM_COG_10_N47_00_E000_00_DEM.tif'
WORLDCOVER = 'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N45E000_Map.tif'
COMMUNES = 'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements/37-indre-et-loire/communes-37-indre-et-loire.geojson'


def warp(url, w, h, bands=(1,), resampling=Resampling.bilinear, dtype=np.float32):
    out = np.zeros((len(bands), h, w), dtype)
    with rasterio.Env(**gdal_env()):
        with rasterio.open('/vsicurl/' + url) as src:
            for i, b in enumerate(bands):
                reproject(rasterio.band(src, b), out[i], dst_transform=from_bounds(X0, Y0, X1, Y1, w, h), dst_crs=PROJ, resampling=resampling)
    return out


def grade(rgb):
    """Sentinel TCI is flat and hazy: lift contrast, a touch of saturation, warm late light."""
    x = rgb.astype(np.float32) / 255.0
    lo, hi = np.percentile(x, 0.6), np.percentile(x, 99.6)
    x = np.clip((x - lo) / (hi - lo), 0, 1)
    x = x ** 0.92
    lum = (0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2])[None]
    x = np.clip(lum + (x - lum) * 1.22, 0, 1)
    x = x * np.array([1.03, 1.0, 0.95], np.float32)[:, None, None]
    # gentle S-curve
    x = np.clip(x, 0, 1)
    x = x * x * (3 - 2 * x) * 0.35 + x * 0.65
    return (np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8)


def main():
    t0 = time.time()
    # ------------------------------------------------------------- satellite
    sat = warp('https://sentinel-cogs.s3.us-west-2.amazonaws.com/' + SCENE + '/TCI.tif', TEX_W, TEX_H, bands=(1, 2, 3), resampling=Resampling.lanczos, dtype=np.uint8)
    img = Image.fromarray(np.moveaxis(grade(sat), 0, -1))
    img.save(os.path.join(OUT, 'sat.webp'), quality=84, method=6)
    img.resize((1024, round(1024 * TEX_H / TEX_W)), Image.LANCZOS).save(os.path.join(OUT, 'sat-1024.webp'), quality=82, method=6)
    print('satellite', round(time.time() - t0), 's')

    # ------------------------------------------------------------- relief
    dem = warp(DEM, DEM_W, DEM_H)[0]
    dem = np.nan_to_num(dem, nan=float(np.nanmedian(dem)))
    cm = np.clip(np.round(dem * 100), 0, 65535).astype(np.uint32)
    enc = np.stack([(cm >> 8).astype(np.uint8), (cm & 255).astype(np.uint8), np.zeros_like(cm, np.uint8)], -1)
    Image.fromarray(enc, 'RGB').save(os.path.join(OUT, 'dem.png'), optimize=True)
    print('relief', round(float(dem.min()), 1), '→', round(float(dem.max()), 1), 'm')

    def height(x, y):
        c = (x - X0) / (X1 - X0) * (DEM_W - 1)
        r = (Y1 - y) / (Y1 - Y0) * (DEM_H - 1)
        c0, r0 = int(np.clip(math.floor(c), 0, DEM_W - 2)), int(np.clip(math.floor(r), 0, DEM_H - 2))
        fc, fr = c - c0, r - r0
        a, b, cc, d = dem[r0, c0], dem[r0, c0 + 1], dem[r0 + 1, c0], dem[r0 + 1, c0 + 1]
        return float((a * (1 - fc) + b * fc) * (1 - fr) + (cc * (1 - fc) + d * fc) * fr)

    # ------------------------------------------------------------- masks
    MW, MH = 1024, round(1024 * TEX_H / TEX_W)
    wc = warp(WORLDCOVER, MW * 2, MH * 2, resampling=Resampling.nearest, dtype=np.uint8)[0]
    water = Image.fromarray(((wc == 80) * 255).astype(np.uint8)).resize((MW, MH), Image.BOX).filter(ImageFilter.GaussianBlur(0.6))
    gj = requests.get(COMMUNES, timeout=120).json()
    comm = {f['properties']['nom']: shape(f['geometry']) for f in gj['features']}
    vouv = shapely.transform(comm['Vouvray'], lambda c: np.column_stack(T.transform(c[:, 0], c[:, 1])))
    vmask = rasterize([(mapping(vouv), 255)], out_shape=(MH * 2, MW * 2), transform=from_bounds(X0, Y0, X1, Y1, MW * 2, MH * 2), dtype=np.uint8)
    vmask = Image.fromarray(vmask).resize((MW, MH), Image.BOX)
    Image.merge('RGB', (water, vmask, Image.new('L', (MW, MH)))).save(os.path.join(OUT, 'mask.png'), optimize=True)
    outline = max(vouv.geoms, key=lambda g: g.area) if vouv.geom_type == 'MultiPolygon' else vouv
    outline = outline.exterior.simplify(12)
    # river labels: the middle of the water inside a search box
    wa = np.asarray(water, np.float32)
    def water_point(bx0, bx1, by0, by1):
        cols = lambda x: int((x - X0) / (X1 - X0) * MW)
        rows = lambda y: int((Y1 - y) / (Y1 - Y0) * MH)
        sub = wa[rows(by1):rows(by0), cols(bx0):cols(bx1)]
        rr, cc = np.nonzero(sub > 200)
        r, c = np.median(rr) + rows(by1), np.median(cc) + cols(bx0)
        return X0 + (c + 0.5) / MW * (X1 - X0), Y1 - (r + 0.5) / MH * (Y1 - Y0)
    rivers = [('La Loire',) + water_point(-1500, 500, -1500, 0), ('Le Cher',) + water_point(-4500, -2500, -5000, -3600)]
    print('masks')

    # ------------------------------------------------------------- places
    keep = {
        'Tours': 'city', 'Vouvray': 'home', 'Rochecorbon': 'town', 'Saint-Cyr-sur-Loire': 'town', 'Saint-Pierre-des-Corps': 'town',
        'Montlouis-sur-Loire': 'town', 'Vernou-sur-Brenne': 'town', 'Parçay-Meslay': 'town', 'La Ville-aux-Dames': 'town',
    }
    labels = []
    t = scan(f'{REL}/theme=divisions/type=division/', LL_BBOX, columns=['names', 'subtype', 'geometry', 'population'])
    seen = set()
    for r in t.to_pylist():
        n = (r['names'] or {}).get('primary')
        if r['subtype'] == 'locality' and n in keep and r.get('population') and n not in seen:
            seen.add(n)
            g = wkb.loads(r['geometry'])
            x, y = to_local(g.x, g.y)
            labels.append({'name': n, 'kind': keep[n], 'x': round(x, 1), 'y': round(y, 1), 'h': round(height(x, y), 1)})
    tp = scan(f'{REL}/theme=places/type=place/', LL_BBOX, columns=['names', 'geometry'])
    for r in tp.to_pylist():
        n = (r['names'] or {}).get('primary') or ''
        if n.lower() in ('aéroport de tours val de loire', 'aéroport tours val de loire', 'tours val de loire airport'):
            g = wkb.loads(r['geometry'])
            x, y = to_local(g.x, g.y)
            labels.append({'name': 'Aéroport de Tours', 'kind': 'poi', 'x': round(x, 1), 'y': round(y, 1), 'h': round(height(x, y), 1)})
            break
    print('labels', [l['name'] for l in labels])

    # ------------------------------------------------------------- roads + route from Tours
    seg = scan(f'{REL}/theme=transportation/type=segment/', LL_BBOX, columns=['id', 'subtype', 'class', 'geometry', 'connectors', 'routes', 'names', 'bbox'])
    SPEED = {'motorway': 110, 'trunk': 90, 'primary': 70, 'secondary': 60, 'tertiary': 50, 'unclassified': 40, 'residential': 30, 'living_street': 15, 'service': 15}
    graph, coord = {}, {}
    a10 = []
    for r in seg.to_pylist():
        if r['subtype'] != 'road' or r['class'] not in SPEED or not r['connectors']:
            continue
        line = wkb.loads(r['geometry'])
        loc = LineString([to_local(*c) for c in line.coords])
        refs = sorted({(x.get('ref') or '').replace(' ', '') for x in (r['routes'] or []) if x.get('ref')})
        if r['class'] == 'motorway' and 'A10' in refs:
            a10 += [(x, y) for x, y in loc.coords if X0 < x < X1 and Y0 < y < Y1]
        cons = sorted(r['connectors'], key=lambda c: c['at'])
        for a, b in zip(cons, cons[1:]):
            d0, d1 = a['at'] * loc.length, b['at'] * loc.length
            if d1 - d0 < 0.01:
                continue
            piece = [loc.interpolate(d0)] + [loc.interpolate(d) for d in np.linspace(d0, d1, max(2, int((d1 - d0) / 25)))[1:-1]] + [loc.interpolate(d1)]
            cost = (d1 - d0) / (SPEED[r['class']] / 3.6)
            ida, idb = a['connector_id'], b['connector_id']
            coord[ida], coord[idb] = (piece[0].x, piece[0].y), (piece[-1].x, piece[-1].y)
            pts = [(p.x, p.y) for p in piece]
            graph.setdefault(ida, []).append((idb, cost, d1 - d0, pts, refs))
            graph.setdefault(idb, []).append((ida, cost, d1 - d0, pts[::-1], refs))
    print('graph', len(graph), 'nodes')

    def nearest(x, y, minimum=None):
        best, bd = None, 1e18
        for k, (cx, cy) in coord.items():
            d = (cx - x) ** 2 + (cy - y) ** 2
            if d < bd and len(graph.get(k, [])) >= (minimum or 1):
                best, bd = k, d
        return best

    tours = next(l for l in labels if l['name'] == 'Tours')
    wx, wy = to_local(*WORKSHOP)
    src, dst = nearest(tours['x'], tours['y'], 2), nearest(wx, wy)
    dist, prev = {src: 0.0}, {}
    pq = [(0.0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == dst:
            break
        if d > dist.get(u, 1e18):
            continue
        for v, c, length, pts, refs in graph.get(u, []):
            nd = d + c
            if nd < dist.get(v, 1e18):
                dist[v], prev[v] = nd, (u, length, pts, refs)
                heapq.heappush(pq, (nd, v))
    path, metres, ref_len = [], 0.0, {}
    v = dst
    while v != src:
        u, length, pts, refs = prev[v]
        path = pts[:-1] + path if path else pts
        metres += length
        for rf in refs:
            ref_len[rf] = ref_len.get(rf, 0) + length
        v = u
    route = LineString(path).simplify(4)
    rpts = [[round(x, 1), round(y, 1), round(height(x, y), 1)] for x, y in route.coords]
    print('route', round(metres / 1000, 2), 'km', sorted(ref_len.items(), key=lambda kv: -kv[1])[:5])
    for name, x, y in rivers:
        labels.append({'name': name, 'kind': 'water', 'x': round(x, 1), 'y': round(y, 1), 'h': round(height(x, y), 1)})
    # motorway label north of the Loire, where it heads to Paris
    north = [p for p in a10 if 1500 < p[1] < 3500]
    if north:
        x, y = north[len(north) // 2]
        labels.append({'name': 'A10', 'kind': 'road', 'x': round(x, 1), 'y': round(y, 1), 'h': round(height(x, y), 1)})

    data = {
        'extent': [X0, X1, Y0, Y1],
        'proj': PROJ,
        'tex': [TEX_W, TEX_H],
        'dem': [DEM_W, DEM_H],
        'workshop': {'x': round(wx, 1), 'y': round(wy, 1), 'h': round(height(wx, wy), 1), 'lon': WORKSHOP[0], 'lat': WORKSHOP[1]},
        'labels': labels,
        'route': {'from': 'Tours', 'km': round(metres / 1000, 1), 'refs': [k for k, _ in sorted(ref_len.items(), key=lambda kv: -kv[1]) if k][:3], 'pts': rpts},
        'vouvray': [[round(x, 1), round(y, 1), round(height(x, y), 1)] for x, y in outline.coords],
        'credits': 'Image satellite : données Copernicus Sentinel modifiées (2025) · Relief : Copernicus DEM GLO-30 · Eau : ESA WorldCover 2021 · Routes et lieux : © contributeurs OpenStreetMap, Overture Maps · Limites communales : IGN ADMIN EXPRESS',
    }
    with open(os.path.join(OUT, 'map.json'), 'w') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print('done', round(time.time() - t0), 's', {k: os.path.getsize(os.path.join(OUT, k)) for k in os.listdir(OUT)})


if __name__ == '__main__':
    main()
