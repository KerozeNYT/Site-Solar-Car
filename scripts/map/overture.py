"""Minimal Overture reader: S3 listing + HTTP range reads, row groups filtered by bbox stats."""
import re, io, requests, pyarrow as pa, pyarrow.parquet as pq
from concurrent.futures import ThreadPoolExecutor
BUCKET = 'https://overturemaps-us-west-2.s3.amazonaws.com'
REL = 'release/2026-09-23.1'
S = requests.Session()

def keys(prefix):
    out, token = [], None
    while True:
        url = f'{BUCKET}/?list-type=2&prefix={prefix}' + (f'&continuation-token={requests.utils.quote(token)}' if token else '')
        x = S.get(url, timeout=60).text
        out += re.findall(r'<Key>([^<]+\.parquet)</Key>', x)
        m = re.search(r'<NextContinuationToken>([^<]+)</NextContinuationToken>', x)
        if not m: return out
        token = m.group(1)

class RangeFile(io.RawIOBase):
    def __init__(self, url):
        self.url, self.pos = url, 0
        self.size = int(S.head(url, timeout=60).headers['Content-Length'])
        self.cache = {}
    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.pos
    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos
    def read(self, n=-1):
        if n < 0: n = self.size - self.pos
        if n == 0: return b''
        end = min(self.size, self.pos + n) - 1
        key = (self.pos, end)
        if key not in self.cache:
            for attempt in range(4):
                try:
                    r = S.get(self.url, headers={'Range': f'bytes={self.pos}-{end}'}, timeout=120)
                    self.cache[key] = r.content
                    break
                except Exception:
                    if attempt == 3: raise
        b = self.cache[key]
        self.pos += len(b)
        return b
    def readinto(self, buf):
        b = self.read(len(buf)); buf[:len(b)] = b; return len(b)

def _stats(md, rg, name):
    g = md.row_group(rg)
    for c in range(g.num_columns):
        col = g.column(c)
        if col.path_in_schema == name and col.statistics is not None and col.statistics.has_min_max:
            return col.statistics.min, col.statistics.max
    return None

def scan(prefix, bbox, columns=None, workers=16):
    """bbox = (xmin, ymin, xmax, ymax); returns a pyarrow Table of rows in matching row groups."""
    ks = keys(prefix)
    def one(k):
        f = pa.PythonFile(RangeFile(f'{BUCKET}/{k}'), mode='r')
        pf = pq.ParquetFile(f)
        md = pf.metadata
        hits = []
        for rg in range(md.num_row_groups):
            xs = _stats(md, rg, 'bbox.xmin'); xe = _stats(md, rg, 'bbox.xmax')
            ys = _stats(md, rg, 'bbox.ymin'); ye = _stats(md, rg, 'bbox.ymax')
            if not (xs and xe and ys and ye): continue
            if xs[0] > bbox[2] or xe[1] < bbox[0] or ys[0] > bbox[3] or ye[1] < bbox[1]: continue
            hits.append(rg)
        if not hits: return None
        return pf.read_row_groups(hits, columns=columns)
    with ThreadPoolExecutor(workers) as ex:
        tabs = [t for t in ex.map(one, ks) if t is not None]
    return pa.concat_tables(tabs) if tabs else None
