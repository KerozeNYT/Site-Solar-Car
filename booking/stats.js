/**
 * Visit statistics of the site, counted by the booking server (docs/STATISTIQUES.md).
 *
 * No cookie, nothing stored on the visitor's device, no IP address, no identifier: each page
 * view and each action (call, quote, form sent, 3D simulator, booking paid) is one row in the
 * SQLite database of a Durable Object (`Stats`). A visit is a page view reached from outside the
 * site (search engine, social network, another site, an app, a typed address): no visitor is
 * followed from page to page. Rows are deleted after 25 months (CNIL guidance on audience
 * measurement exempt from consent).
 *
 *   POST /api/stats              one page view or action, sent by the pages (src/js/main.js)
 *   GET  /stats?cle=…            the statistics page (booking/stats-page.js), key = STATS_KEY
 */
import { utcToZoned, addDays } from './schedule.js';

export const TZ = 'Europe/Paris';
const KEEP_DAYS = 761; // 25 months

/** the actions a page can report, with their name on the statistics page */
export const ACTIONS = {
  demande_envoyee: 'Demandes envoyées',
  rdv: 'RDV réservés en ligne',
  appel: 'Appels',
  email: 'E-mails',
  clic_devis: 'Clics « devis »',
  devis_simulateur: 'Devis depuis un simulateur',
  simulateur_3d: 'Simulateurs 3D ouverts',
  itineraire: 'Itinéraires',
  demande_erreur: 'Envois du formulaire en échec',
};
const FROM_PAGES = new Set(['page', ...Object.keys(ACTIONS).filter((k) => k !== 'rdv')]);

export const SOURCES = {
  moteurs: 'Moteurs de recherche',
  fiche: 'Fiche Google',
  direct: 'Accès direct',
  reseaux: 'Réseaux sociaux',
  sites: 'Autres sites',
};
const SEARCH = /(^|\.)(google\.[a-z.]{2,7}|bing\.com|qwant\.com|duckduckgo\.com|ecosia\.org|yahoo\.com|search\.brave\.com|yandex\.[a-z]{2,3}|startpage\.com|lilo\.org|baidu\.com)$/;
const SOCIAL = /(^|\.)(facebook\.com|fb\.com|fb\.me|instagram\.com|t\.co|x\.com|twitter\.com|linkedin\.com|lnkd\.in|tiktok\.com|pinterest\.[a-z.]{2,7}|youtube\.com|youtu\.be|snapchat\.com|whatsapp\.com|wa\.me|threads\.net|reddit\.com)$/;
// the website link of the Google Business Profile, when it carries ?utm_source=fiche-google
const PROFILE = /^(fiche[-_ ]?google|gbp|gmb|google[-_ ]?(my[-_ ]?)?business)$/i;

/** the referring site's name, without "www." or the mobile / link-shim prefixes */
export function hostOf(h) {
  const s = String(h || '').toLowerCase().trim();
  if (!/^[a-z0-9.-]{1,100}$/.test(s)) return '';
  return s.replace(/^(www|m|l|lm|mobile)\./, '');
}

/** where a visit comes from */
export function sourceOf(ref, utm = '') {
  if (utm && PROFILE.test(utm)) return 'fiche';
  if (!ref) return 'direct';
  // Google Maps (web or app): the profile's "Site web" button
  if (/^maps\.google\./.test(ref) || ref === 'com.google.android.apps.maps') return 'fiche';
  if (SEARCH.test(ref) || ref === 'com.google.android.googlequicksearchbox') return 'moteurs';
  if (SOCIAL.test(ref) || /^com\.(instagram|facebook|twitter|linkedin|zhiliaoapp)\./.test(ref)) return 'reseaux';
  return 'sites';
}

/** one hit sent by a page (JSON text), checked and bounded; null when unusable */
export function hitFromPage(text, site) {
  let h;
  try {
    h = JSON.parse(text);
  } catch {
    return null;
  }
  if (!h || typeof h !== 'object' || !FROM_PAGES.has(h.t)) return null;
  const row = {
    site,
    kind: h.t,
    page: typeof h.p === 'string' && /^\/[\w\-./%]{0,150}$/.test(h.p) ? h.p.toLowerCase() : '/',
    device: h.d === 'telephone' || h.d === 'ordinateur' ? h.d : '',
  };
  if (h.t === 'page') {
    row.entry = h.e ? 1 : 0;
    if (row.entry) {
      const ref = hostOf(h.r);
      row.source = sourceOf(ref, typeof h.u === 'string' ? h.u.slice(0, 40) : '');
      row.ref = row.source === 'direct' || row.source === 'fiche' ? '' : ref;
    }
  } else if (typeof h.x === 'string') {
    row.detail = h.x.replace(/[^\p{L}\p{N} +\-'’]/gu, '').trim().slice(0, 60);
  }
  return row;
}

/** stores rows ({ site, kind, page, entry, source, ref, device, detail, value }); never throws
 *  into the caller's work (a statistic is never worth a failed booking) */
export async function record(env, rows, now = Date.now()) {
  if (!env.STATS || !rows.length) return;
  const day = utcToZoned(now, TZ).date;
  const stub = env.STATS.get(env.STATS.idFromName('solarcar37'));
  const res = await stub.fetch('https://stats/add', { method: 'POST', body: JSON.stringify({ day, at: now, rows }) });
  if (!res.ok) throw new Error(`stats ${res.status}`);
}

/** the figures of a period (see Stats.report) */
export async function report(env, q) {
  const stub = env.STATS.get(env.STATS.idFromName('solarcar37'));
  const res = await stub.fetch(`https://stats/report?${new URLSearchParams(q)}`);
  if (!res.ok) throw new Error(`stats ${res.status}`);
  return res.json();
}

/** The statistics database: one Durable Object, its own SQLite storage. */
export class Stats {
  constructor(state) {
    this.sql = state.storage.sql;
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS hits (
        day TEXT NOT NULL,
        site TEXT NOT NULL,
        kind TEXT NOT NULL,
        page TEXT NOT NULL DEFAULT '',
        entry INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT '',
        ref TEXT NOT NULL DEFAULT '',
        device TEXT NOT NULL DEFAULT '',
        detail TEXT NOT NULL DEFAULT '',
        value REAL NOT NULL DEFAULT 0,
        at INTEGER NOT NULL
      )`
    );
    this.sql.exec('CREATE INDEX IF NOT EXISTS hits_site_day ON hits (site, day)');
    this.purged = '';
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/add') {
      const { day, at, rows } = await req.json();
      for (const r of rows || []) {
        this.sql.exec(
          'INSERT INTO hits (day, site, kind, page, entry, source, ref, device, detail, value, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          day,
          r.site === 'site' ? 'site' : 'apercu',
          String(r.kind),
          String(r.page || ''),
          r.entry ? 1 : 0,
          String(r.source || ''),
          String(r.ref || ''),
          String(r.device || ''),
          String(r.detail || ''),
          Number(r.value) || 0,
          Number(at) || 0
        );
      }
      // once a day: rows older than 25 months go
      if (this.purged !== day) {
        this.sql.exec('DELETE FROM hits WHERE day < ?', addDays(day, -KEEP_DAYS));
        this.purged = day;
      }
      return new Response(null, { status: 204 });
    }
    if (req.method === 'GET' && url.pathname === '/report') {
      const p = Object.fromEntries(url.searchParams);
      return Response.json(this.report(p));
    }
    return new Response('not found', { status: 404 });
  }

  /** everything the statistics page shows, for one site ("site" or "apercu"), the days
   *  from..to and the period before (pfrom..pto) */
  report({ site, from, to, pfrom, pto }) {
    const q = (s, ...b) => this.sql.exec(s, ...b).toArray();
    const W = 'site = ? AND day BETWEEN ? AND ?';
    const cur = [site, from, to];
    const totals = (a, b) => q(`SELECT kind, COUNT(*) AS n, SUM(entry) AS visits, SUM(value) AS value FROM hits WHERE ${W} GROUP BY kind`, site, a, b);
    return {
      first: q('SELECT MIN(day) AS day FROM hits WHERE site = ?', site)[0]?.day || null,
      totals: totals(from, to),
      previous: totals(pfrom, pto),
      days: q(`SELECT day, COUNT(*) AS views, SUM(entry) AS visits FROM hits WHERE ${W} AND kind = 'page' GROUP BY day`, ...cur),
      sources: q(`SELECT source, COUNT(*) AS n FROM hits WHERE ${W} AND kind = 'page' AND entry = 1 GROUP BY source`, ...cur),
      refs: q(`SELECT source, ref, COUNT(*) AS n FROM hits WHERE ${W} AND kind = 'page' AND entry = 1 AND ref <> '' GROUP BY source, ref ORDER BY n DESC LIMIT 12`, ...cur),
      pages: q(`SELECT page, COUNT(*) AS views, SUM(entry) AS entries FROM hits WHERE ${W} AND kind = 'page' GROUP BY page ORDER BY views DESC LIMIT 15`, ...cur),
      devices: q(`SELECT device, SUM(entry) AS visits FROM hits WHERE ${W} AND kind = 'page' GROUP BY device`, ...cur),
      actions: q(`SELECT kind, page, COUNT(*) AS n FROM hits WHERE ${W} AND kind NOT IN ('page', 'rdv') GROUP BY kind, page ORDER BY n DESC LIMIT 60`, ...cur),
      bookings: q(`SELECT detail, COUNT(*) AS n, SUM(value) AS value FROM hits WHERE ${W} AND kind = 'rdv' GROUP BY detail ORDER BY n DESC LIMIT 10`, ...cur),
    };
  }
}
