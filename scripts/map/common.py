"""Shared settings of the map bake: area, local projection, output grid."""
import os

# local transverse Mercator centred on the area (metres, x east, y north)
LON0, LAT0 = 0.745, 47.41
PROJ = f'+proj=tmerc +lat_0={LAT0} +lon_0={LON0} +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +units=m +no_defs'
# extent: Tours (west, south of the Loire and the Cher) to Vernou-sur-Brenne (east), the
# Vouvray business park (north)
X0, X1, Y0, Y1 = -8400.0, 8400.0, -5000.0, 6800.0
TEX_W, TEX_H = 2048, 1438  # satellite texture (~8.2 m per pixel)
DEM_W, DEM_H = 512, 360  # height grid (~33 m)

# the workshop: national address point (BAN via Overture addresses) for 395 rue des
# Entrepreneurs, ZA de l'Étang Vignon, Vouvray
WORKSHOP = (0.797154, 47.436104)

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'map')

def gdal_env():
    """GDAL behind the proxy of the build machine (no-op elsewhere)."""
    p = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
    env = {'GDAL_DISABLE_READDIR_ON_OPEN': 'EMPTY_DIR', 'CPL_VSIL_CURL_ALLOWED_EXTENSIONS': '.tif'}
    if p:
        env['GDAL_HTTP_PROXY'] = p
    ca = '/root/.ccr/ca-bundle.crt'
    if os.path.exists(ca):
        env['CURL_CA_BUNDLE'] = ca
    return env
