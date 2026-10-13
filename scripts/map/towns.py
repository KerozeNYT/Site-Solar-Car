"""
Road routes from nearby towns to the workshop, for the local pages (content/zones-data.js):
distance by road, direction, and the main roads taken, computed on the Overture Maps road
network (OpenStreetMap data). Town centres = Overture locality points.

Usage: python scripts/map/towns.py
"""
import heapq, json, math, os, sys, time
import numpy as np
from shapely import wkb
from shapely.geometry import LineString

sys.path.insert(0, os.path.dirname(__file__))
from common import WORKSHOP  # noqa
from overture import scan, REL

TOWNS = [
    'Tours', 'Joué-lès-Tours', 'Saint-Cyr-sur-Loire', 'Saint-Pierre-des-Corps', 'Saint-Avertin', 'Chambray-lès-Tours',
    'La Riche', 'Fondettes', 'Montlouis-sur-Loire', 'Amboise', 'Rochecorbon', 'Vernou-sur-Brenne', 'Monnaie', 'Parçay-Meslay',
]
BBOX = (0.45, 47.25, 1.05, 47.56)
SPEED = {'motorway': 110, 'trunk': 90, 'primary': 70, 'secondary': 60, 'tertiary': 50, 'unclassified': 40, 'residential': 30, 'living_street': 15, 'service': 15}
LAT0 = 47.42
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110574  # metres per degree
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'content', 'zones-data.js')


def main():
    t0 = time.time()
    div = scan(f'{REL}/theme=divisions/type=division/', BBOX, columns=['names', 'subtype', 'geometry', 'population'])
    centres = {}
    for r in div.to_pylist():
        n = (r['names'] or {}).get('primary')
        if r['subtype'] == 'locality' and n in TOWNS and r.get('population') and n not in centres:
            g = wkb.loads(r['geometry'])
            centres[n] = (g.x, g.y, r['population'])
    print('towns', len(centres), sorted(set(TOWNS) - set(centres)))

    seg = scan(f'{REL}/theme=transportation/type=segment/', BBOX, columns=['subtype', 'class', 'geometry', 'connectors', 'routes', 'names'])
    graph, coord = {}, {}
    for r in seg.to_pylist():
        if r['subtype'] != 'road' or r['class'] not in SPEED or not r['connectors']:
            continue
        line = wkb.loads(r['geometry'])
        pts = [((x - BBOX[0]) * KX, (y - BBOX[1]) * KY) for x, y in line.coords]
        loc = LineString(pts)
        refs = sorted({(x.get('ref') or '').replace(' ', '') for x in (r['routes'] or []) if x.get('ref')})
        name = (r['names'] or {}).get('primary') or ''
        label = name or (refs[0] if refs else '')
        cons = sorted(r['connectors'], key=lambda c: c['at'])
        for a, b in zip(cons, cons[1:]):
            d0, d1 = a['at'] * loc.length, b['at'] * loc.length
            if d1 - d0 < 0.01:
                continue
            pa, pb = loc.interpolate(d0), loc.interpolate(d1)
            cost = (d1 - d0) / (SPEED[r['class']] / 3.6)
            ida, idb = a['connector_id'], b['connector_id']
            coord[ida], coord[idb] = (pa.x, pa.y), (pb.x, pb.y)
            e = (cost, d1 - d0, label, refs, r['class'])
            graph.setdefault(ida, []).append((idb,) + e)
            graph.setdefault(idb, []).append((ida,) + e)
    keys = list(coord)
    arr = np.array([coord[k] for k in keys])
    deg = np.array([len(graph.get(k, [])) for k in keys])
    print('graph', len(graph), round(time.time() - t0), 's')

    def nearest(lon, lat):
        p = np.array([(lon - BBOX[0]) * KX, (lat - BBOX[1]) * KY])
        d = ((arr - p) ** 2).sum(1) + (deg < 2) * 1e9
        return keys[int(d.argmin())]

    dst = nearest(*WORKSHOP)
    # one Dijkstra from the workshop (roads are taken both ways)
    dist, prev = {dst: 0.0}, {}
    pq = [(0.0, dst)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist.get(u, 1e18):
            continue
        for v, cost, length, label, refs, cls in graph.get(u, []):
            nd = d + cost
            if nd < dist.get(v, 1e18):
                dist[v], prev[v] = nd, (u, length, label, refs, cls)
                heapq.heappush(pq, (nd, v))

    out = {}
    wx, wy = (WORKSHOP[0] - BBOX[0]) * KX, (WORKSHOP[1] - BBOX[1]) * KY
    for town, (lon, lat, pop) in centres.items():
        src = nearest(lon, lat)
        if src not in prev and src != dst:
            print('no route', town)
            continue
        legs, metres, v = [], 0.0, src
        while v != dst:
            u, length, label, refs, cls = prev[v]
            metres += length
            if legs and legs[-1]['name'] == label:
                legs[-1]['m'] += length
            else:
                legs.append({'name': label, 'refs': refs, 'cls': cls, 'm': length})
            v = u
        # main roads: named stretches of 400 m or more, in driving order, merged when repeated
        main = []
        for l in legs:
            if l['m'] >= 400 and l['name'] and (not main or main[-1]['name'] != l['name']):
                main.append({'name': l['name'], 'refs': l['refs'], 'km': round(l['m'] / 1000, 1)})
        tx, ty = (lon - BBOX[0]) * KX, (lat - BBOX[1]) * KY
        bearing = (math.degrees(math.atan2(wx - tx, wy - ty)) + 360) % 360
        crow = math.hypot(wx - tx, wy - ty) / 1000
        out[town] = {
            'lon': round(lon, 5), 'lat': round(lat, 5), 'population': pop,
            'roadKm': round(metres / 1000, 1), 'crowKm': round(crow, 1), 'bearing': round(bearing),
            'roads': main[:6],
        }
        print(f"{town:24s} {metres / 1000:5.1f} km  {[m['name'] for m in main[:6]]}")
    with open(OUT, 'w') as f:
        f.write('// Generated by scripts/map/towns.py: road routes from nearby towns to the workshop\n')
        f.write('// (Overture Maps / OpenStreetMap road network). Do not edit by hand.\n')
        f.write('export default ' + json.dumps(out, ensure_ascii=False, indent=2) + ';\n')
    print('done', round(time.time() - t0), 's')


if __name__ == '__main__':
    main()
