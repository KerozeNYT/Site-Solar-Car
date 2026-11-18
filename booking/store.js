/**
 * The workshop's database (docs/ATELIER.md): one Durable Object (`Atelier`) with its own SQLite
 * storage, read and written by the booking server and the workshop's space (/atelier).
 *
 *   codes       referral codes: one per client, a fixed amount off, once (booking/worker.js)
 *   promos      promotion codes made by the workshop (NOEL…): a percentage or an amount, dates,
 *               services, how many uses (0 = no limit)
 *   banners     the bands at the top of the site: text, code, look, dates
 *   settings    what was seeded, and the like
 *   clients     the client file: from each online booking, each quote request, or added by hand
 *   bookings    the online bookings (paid), with their client
 *   requests    the quote requests sent from the site's form
 *   logins      the one-time codes e-mailed to sign in to the workshop's space
 *   links       the appointments taken by the workshop (on the phone): the payment link sent to
 *               the client, waiting, paid, expired or cancelled
 *   push_subs   the workshop's devices that receive its notifications (booking/push.js)
 *   gifts       the gift cards (content/offers.js): amount, balance, recipient, delivery, uses
 *   gift_holds  the part of a card set aside while its holder pays the rest on Stripe
 *   members     SOLAR CAR Premium: one row a person (e-mail), renewals extend it; tiers and gifts
 *   member_payments  each payment of a membership (once each: Stripe may notify twice)
 *
 * Each call is one request to the object, run on its own: a code checked and used, a client found
 * or added, can never be done twice at the same time.
 */
import { bookingRules as R, referralCode, howHeardText } from '../content/booking.js';
import { promoSeeds, bannerSeeds } from '../content/promos.js';
import { business as B, services as SERVICES } from '../content/site.js';
import { zonedToUtc, addDays, utcToZoned } from './schedule.js';
import { giftCard as G, premium as P, tierOf, nextTier, isGiftCode, isPremiumCode, GIFT_PREFIX, PREMIUM_PREFIX } from '../content/offers.js';
import { sendQuoteMails, sendToClient, notifyWorkshop, quoteSubject } from './mail.js';
import { parseMail, freshText, htmlToText, bytesOf } from './mime.js';

// no 0/O, 1/I: easy to read out and to type
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DAY = 86400000;
const KEEP_CLIENTS_DAYS = 3 * 365; // CNIL: 3 years after the last contact

/** JEAN-7K2QX: the first name (letters only, without accents) and 5 random characters */
export function newCode(firstName) {
  const name =
    String(firstName || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 10) || 'SOLAR';
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return `${name}-${[...bytes].map((b) => ALPHABET[b % 32]).join('')}`;
}

/** a day in Paris → its first and last instant */
export const dayStart = (date) => zonedToUtc(date, '00:00', R.timeZone);
export const dayEnd = (date) => zonedToUtc(addDays(date, 1), '00:00', R.timeZone) - 1;
/** the end (23:59:59, Paris) of the same day `months` months after `ms` (31 January + 1 → 28/29 February) */
export function monthsAfter(ms, months) {
  const [y, m, d] = utcToZoned(ms, R.timeZone).date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return dayEnd(`${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`);
}
/** CADEAU-7K2Q-X9M4, PREMIUM-7K2Q-X9M4: 8 random characters, easy to read out */
export function cardCode(prefix) {
  const c = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => ALPHABET[b % 32]).join('');
  return `${prefix}-${c.slice(0, 4)}-${c.slice(4)}`;
}
/** « j***@gmail.com » */
export const maskEmail = (e) => String(e || '').replace(/^(.)[^@]*(@.*)$/, '$1***$2');
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const jsonList = (s) => {
  try {
    const v = JSON.parse(s || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const stub = (env) => env.ATELIER.get(env.ATELIER.idFromName('solarcar37'));
/** a raw request to the database (files, multipart): booking/atelier.js */
export const atelierFetch = (env, path, init) => stub(env).fetch(`https://atelier/${path}`, init);
/** one call to the database: POST /<path> with a JSON body, answered in JSON */
export async function db(env, path, body = {}) {
  const res = await stub(env).fetch(`https://atelier/${path}`, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`atelier ${path} ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ---------------------------------------------------------------- shortcuts used by the server
/** the referral code of a client (the same one for the same origin: a booking, a client's card) */
export const referralFor = (env, { owner, email = '', origin, clientId = 0 }, now = Date.now()) => db(env, 'code/create', { owner, email, origin, clientId, now });
/** a code typed on the booking page: a promotion or a referral code; { ok, kind, … } or { ok: false, error } */
export const checkCode = (env, code, now = Date.now()) => db(env, 'code/check', { code: referralCode(code), now });
/** a referral code used (once); the same booking again is fine */
export const redeemReferral = (env, code, { by, ref, where }, now = Date.now()) => db(env, 'code/redeem', { code: referralCode(code), by, ref, where, now });
/** the band of the site, when one is on now */
export const publicBanner = (env, now = Date.now()) => db(env, 'banner/public', { now });

const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** bytes → base64 (native when the runtime has it) */
function toBase64(u8) {
  if (typeof u8.toBase64 === 'function') return u8.toBase64();
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * The request as the site's script sends it (JSON: { v: 2, firstName, …, files: [{ name, type,
 * data (base64) }] }), or the form itself posted without JavaScript (multipart, the same names
 * as its fields).
 */
async function readQuote(req) {
  const type = req.headers.get('content-type') || '';
  if (!/multipart\/form-data|application\/x-www-form-urlencoded/i.test(type)) return JSON.parse(await req.text());
  const f = await req.formData();
  const get = (k) => String(f.get(k) ?? '');
  const files = [];
  for (const v of f.getAll('attachment')) if (v && typeof v === 'object' && v.size) files.push({ name: v.name, type: v.type, data: toBase64(new Uint8Array(await v.arrayBuffer())) });
  const date = get('date_souhaitee');
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `à partir du ${date.split('-').reverse().join('/')}` : '';
  return {
    v: 2,
    firstName: get('prenom'),
    lastName: get('nom'),
    email: get('email'),
    phone: get('telephone'),
    make: get('marque'),
    model: get('modele'),
    year: get('annee'),
    services: f
      .getAll('prestations')
      .map((slug) => (slug === 'autre' ? 'Autre demande' : SERVICES.find((s) => s.slug === slug)?.name || String(slug)))
      .join(', '),
    wish: [day, get('moment')].filter(Boolean).join(', '),
    message: get('message'),
    source: { channels: f.getAll('connu').map(String), other: get('connu_autre') },
    code: get('code'),
    consent: get('consentement') === 'on',
    trap: get('_gotcha'),
    files,
  };
}

/** the photos and PDF of a request, ready to attach: at most 10, a safe name each */
function quoteFiles(list) {
  return (Array.isArray(list) ? list : [])
    .slice(0, 10)
    .map((f, i) => {
      const type = String(f?.type || '').toLowerCase();
      const content = String(f?.data || '').replace(/^data:[^,]*,/, '');
      if (!content || !(/^image\/[a-z0-9.+-]+$/.test(type) || type === 'application/pdf')) return null;
      const ext = type === 'application/pdf' ? 'pdf' : type.split('/')[1].replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
      let filename = String(f.name || '')
        .normalize('NFC')
        .replace(/[^\p{L}\p{N}._ -]/gu, '')
        .trim()
        .slice(0, 80);
      if (!filename || filename.startsWith('.')) filename = `photo-${i + 1}`;
      if (!/\.[a-z0-9]{2,5}$/i.test(filename)) filename += `.${ext}`;
      return { filename, type, content, size: Math.floor((content.length * 3) / 4) };
    })
    .filter(Boolean);
}

const digits = (p) => String(p || '').replace(/\D/g, '').slice(-9);

// ---------------------------------------------------------------- quote discussions
/** the statuses of a quote request, in the workshop's words, in the order of the work:
 *  nouveau (to answer) → envoye (the workshop answered, waiting for the client) → reponse (the
 *  client wrote back: to read and answer) → valide (accepted, or booked online); sans_suite (no
 *  answer from the client for QUOTE_DELAYS.close days, or by hand: back to « reponse » by itself
 *  when the client writes) */
export const QUOTE_STATUS = { nouveau: 'Nouveau', envoye: 'Devis envoyé', reponse: 'Réponse reçue', valide: 'Validé', sans_suite: 'Sans suite' };
/** days without news from the client after the workshop's last message: « à relancer » after
 *  `remind`, « Sans suite » after `close` (0: never); changed in the space (setting quoteDelays) */
export const QUOTE_DELAYS = { remind: 7, close: 14 };
/** files kept with a discussion (a SQLite value holds 2 MB at most); bigger ones are only named */
const MAX_FILE = 1.9 * 1024 * 1024;
/** bytes → a value for a BLOB column */
const blob = (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
/** the workshop's own addresses: its replies (from its Gmail) are passed on to the client */
const ownerAddresses = (env) =>
  String(env.ATELIER_EMAILS || env.NOTIFY_TO || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
/** the receiving server checked the sender's domain (DKIM or DMARC): a forged workshop address is not passed on */
function authenticated(lines, from) {
  const d = from.split('@')[1]?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!d) return false;
  return lines.some((l) => new RegExp(`dkim=pass[^;]*header\\.(d=${d}|i=[^\\s;]*@${d})\\b`, 'i').test(l) || new RegExp(`dmarc=pass[^;]*header\\.from=${d}\\b`, 'i').test(l));
}
const refsOf = (s) => String(s || '').split(' ').filter(Boolean);
/** the first words of a message, on one line (a notification) */
const snippetOf = (t) => {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  return s.length > 120 ? `${s.slice(0, 119)}…` : s;
};
/** « 1 190,50 € » → 1190.5; empty → null */
const amountOf = (v) => {
  const n = Number(String(v ?? '').replace(/[\s€]/g, '').replace(',', '.'));
  return String(v ?? '').trim() && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};
/** the page where the client accepts the quote (www.solarcar37.fr/devis/) */
const acceptUrl = (env, r) => `${String(env.SITE_URL || B.siteUrl).replace(/\/$/, '')}/devis/?n=${r.id}&t=${r.token}`;
/** what a booking covers, in the words of a quote request: tint (windows, windscreen), lights */
const kinds = (s) => {
  const t = String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return [/vitre|pare-brise/.test(t) && 'vitres', /feux/.test(t) && 'feux'].filter(Boolean);
};

export class Atelier {
  constructor(state, env) {
    // env: the server's settings and secrets (the e-mails of a quote request, quote/submit)
    this.env = env || {};
    this.sql = state.storage.sql;
    const x = (q) => this.sql.exec(q);
    x(`CREATE TABLE IF NOT EXISTS codes (code TEXT PRIMARY KEY, owner TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', origin TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, used_by TEXT NOT NULL DEFAULT '', used_ref TEXT NOT NULL DEFAULT '', used_where TEXT NOT NULL DEFAULT '')`);
    x('CREATE INDEX IF NOT EXISTS codes_origin ON codes (origin)');
    // added after the first codes were made (already there: the error is expected)
    try {
      x('ALTER TABLE codes ADD COLUMN client_id INTEGER NOT NULL DEFAULT 0');
    } catch {}
    x(`CREATE TABLE IF NOT EXISTS promos (code TEXT PRIMARY KEY, label TEXT NOT NULL DEFAULT '', percent REAL NOT NULL DEFAULT 0, amount REAL NOT NULL DEFAULT 0, services TEXT NOT NULL DEFAULT '', max_uses INTEGER NOT NULL DEFAULT 0, uses INTEGER NOT NULL DEFAULT 0, starts INTEGER NOT NULL, expires INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1, created INTEGER NOT NULL)`);
    x('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    x(`CREATE TABLE IF NOT EXISTS banners (id TEXT PRIMARY KEY, theme TEXT NOT NULL DEFAULT 'classique', title TEXT NOT NULL DEFAULT '', text TEXT NOT NULL, cta TEXT NOT NULL DEFAULT 'Réserver', code TEXT NOT NULL DEFAULT '', starts INTEGER NOT NULL, expires INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1, created INTEGER NOT NULL)`);
    x(`CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, first TEXT NOT NULL DEFAULT '', last TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', vehicles TEXT NOT NULL DEFAULT '', plate TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', origin TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, last_seen INTEGER NOT NULL)`);
    x('CREATE INDEX IF NOT EXISTS clients_email ON clients (email)');
    x(`CREATE TABLE IF NOT EXISTS bookings (session TEXT PRIMARY KEY, client_id INTEGER NOT NULL DEFAULT 0, event TEXT NOT NULL DEFAULT '', date TEXT NOT NULL, time TEXT NOT NULL, minutes INTEGER NOT NULL DEFAULT 0, items TEXT NOT NULL DEFAULT '[]', total REAL NOT NULL DEFAULT 0, discount REAL NOT NULL DEFAULT 0, code TEXT NOT NULL DEFAULT '', code_kind TEXT NOT NULL DEFAULT '', mode TEXT NOT NULL DEFAULT '', paid REAL NOT NULL DEFAULT 0, vehicle TEXT NOT NULL DEFAULT '', live INTEGER NOT NULL DEFAULT 1, created INTEGER NOT NULL)`);
    x('CREATE INDEX IF NOT EXISTS bookings_client ON bookings (client_id)');
    // payments after the booking (a deposit for services added at the workshop): [{ ref, amount, at }]
    try {
      x("ALTER TABLE bookings ADD COLUMN payments TEXT NOT NULL DEFAULT '[]'");
    } catch {}
    x('CREATE INDEX IF NOT EXISTS bookings_date ON bookings (date)');
    x(`CREATE TABLE IF NOT EXISTS requests (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL, services TEXT NOT NULL DEFAULT '', vehicle TEXT NOT NULL DEFAULT '', wish TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '')`);
    x('CREATE INDEX IF NOT EXISTS requests_client ON requests (client_id)');
    // the quote discussions (added later: columns of the requests, then messages and their files)
    const have = new Set(this.all("SELECT name FROM pragma_table_info('requests')").map((c) => c.name));
    for (const [col, def] of [
      ['status', "TEXT NOT NULL DEFAULT 'nouveau'"],
      ['status_at', 'INTEGER NOT NULL DEFAULT 0'],
      ['amount', 'REAL NOT NULL DEFAULT 0'],
      ['token', "TEXT NOT NULL DEFAULT ''"],
      ['booking', "TEXT NOT NULL DEFAULT ''"],
      ['unread', 'INTEGER NOT NULL DEFAULT 0'],
      ['last_at', 'INTEGER NOT NULL DEFAULT 0'],
      ['subject', "TEXT NOT NULL DEFAULT ''"],
      ['refs', "TEXT NOT NULL DEFAULT ''"],
      ['owner_refs', "TEXT NOT NULL DEFAULT ''"],
    ])
      if (!have.has(col)) x(`ALTER TABLE requests ADD COLUMN ${col} ${def}`);
    x(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, request_id INTEGER NOT NULL, at INTEGER NOT NULL, dir TEXT NOT NULL, via TEXT NOT NULL DEFAULT '', text TEXT NOT NULL DEFAULT '', files TEXT NOT NULL DEFAULT '[]', msgid TEXT NOT NULL DEFAULT '', sender TEXT NOT NULL DEFAULT '')`);
    x('CREATE INDEX IF NOT EXISTS messages_request ON messages (request_id)');
    x('CREATE INDEX IF NOT EXISTS messages_msgid ON messages (msgid)');
    x(`CREATE TABLE IF NOT EXISTS files (id INTEGER PRIMARY KEY AUTOINCREMENT, request_id INTEGER NOT NULL, name TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT '', size INTEGER NOT NULL DEFAULT 0, data BLOB)`);
    x('CREATE INDEX IF NOT EXISTS files_request ON files (request_id)');
    x('CREATE TABLE IF NOT EXISTS logins (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0)');
    // status: attente (the link sent, the slot held), paye, expire, annule, confirme (no payment online)
    x(`CREATE TABLE IF NOT EXISTS links (id INTEGER PRIMARY KEY AUTOINCREMENT, session TEXT NOT NULL DEFAULT '', client_id INTEGER NOT NULL DEFAULT 0, event TEXT NOT NULL DEFAULT '', date TEXT NOT NULL DEFAULT '', time TEXT NOT NULL DEFAULT '', minutes INTEGER NOT NULL DEFAULT 0, items TEXT NOT NULL DEFAULT '[]', total REAL NOT NULL DEFAULT 0, due REAL NOT NULL DEFAULT 0, mode TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '', expires INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'attente', vehicle TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL)`);
    x('CREATE INDEX IF NOT EXISTS links_session ON links (session)');
    // how it was taken (added later): 'telephone' or 'atelier'
    if (!this.all("SELECT name FROM pragma_table_info('links')").some((c) => c.name === 'canal')) x("ALTER TABLE links ADD COLUMN canal TEXT NOT NULL DEFAULT ''");
    x(`CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, p256dh TEXT NOT NULL, auth TEXT NOT NULL, label TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL)`);
    // ---- the gift cards and SOLAR CAR Premium (content/offers.js, docs/CARTES.md)
    x(`CREATE TABLE IF NOT EXISTS gifts (code TEXT PRIMARY KEY, token TEXT NOT NULL, amount REAL NOT NULL, balance REAL NOT NULL, look TEXT NOT NULL DEFAULT 'or', to_name TEXT NOT NULL DEFAULT '', to_email TEXT NOT NULL DEFAULT '', sender TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '', delivery TEXT NOT NULL DEFAULT 'moi', send_on TEXT NOT NULL DEFAULT '', sent INTEGER NOT NULL DEFAULT 0, buyer_first TEXT NOT NULL DEFAULT '', buyer_last TEXT NOT NULL DEFAULT '', buyer_email TEXT NOT NULL DEFAULT '', buyer_phone TEXT NOT NULL DEFAULT '', client_id INTEGER NOT NULL DEFAULT 0, session TEXT NOT NULL DEFAULT '', paid REAL NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'site', note TEXT NOT NULL DEFAULT '', live INTEGER NOT NULL DEFAULT 1, uses TEXT NOT NULL DEFAULT '[]', created INTEGER NOT NULL, expires INTEGER NOT NULL)`);
    x('CREATE INDEX IF NOT EXISTS gifts_session ON gifts (session)');
    x('CREATE TABLE IF NOT EXISTS gift_holds (ref TEXT PRIMARY KEY, code TEXT NOT NULL, amount REAL NOT NULL, expires INTEGER NOT NULL)');
    x(`CREATE TABLE IF NOT EXISTS members (number TEXT PRIMARY KEY, token TEXT NOT NULL, client_id INTEGER NOT NULL DEFAULT 0, first TEXT NOT NULL DEFAULT '', last TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', since INTEGER NOT NULL, starts INTEGER NOT NULL, expires INTEGER NOT NULL, news INTEGER NOT NULL DEFAULT 1, gifts TEXT NOT NULL DEFAULT '[]', reminded INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'site', live INTEGER NOT NULL DEFAULT 1, created INTEGER NOT NULL)`);
    x('CREATE INDEX IF NOT EXISTS members_email ON members (email)');
    x('CREATE INDEX IF NOT EXISTS members_client ON members (client_id)');
    x('CREATE TABLE IF NOT EXISTS member_payments (ref TEXT PRIMARY KEY, number TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0, at INTEGER NOT NULL, source TEXT NOT NULL DEFAULT \'site\')');
    // a promotion kept for the members (the e-mails to the members), a booking's gift card and member
    if (!this.all("SELECT name FROM pragma_table_info('promos')").some((c) => c.name === 'members')) x('ALTER TABLE promos ADD COLUMN members INTEGER NOT NULL DEFAULT 0');
    const bcols = new Set(this.all("SELECT name FROM pragma_table_info('bookings')").map((c) => c.name));
    for (const [col, def] of [
      ['gift', "TEXT NOT NULL DEFAULT ''"],
      ['gift_amount', 'REAL NOT NULL DEFAULT 0'],
      ['member', "TEXT NOT NULL DEFAULT ''"],
    ])
      if (!bcols.has(col)) x(`ALTER TABLE bookings ADD COLUMN ${col} ${def}`);
    x('CREATE INDEX IF NOT EXISTS bookings_member ON bookings (member)');
  }

  all(q, ...b) {
    return this.sql.exec(q, ...b).toArray();
  }
  one(q, ...b) {
    return this.all(q, ...b)[0] || null;
  }
  run(q, ...b) {
    this.sql.exec(q, ...b);
  }
  setting(key, fallback = null) {
    const r = this.one('SELECT value FROM settings WHERE key = ?', key);
    return r ? JSON.parse(r.value) : fallback;
  }
  set(key, value) {
    this.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', key, JSON.stringify(value));
  }

  /** the promotions of content/promos.js, written once each (then managed from /atelier) */
  seed(now) {
    for (const p of promoSeeds) {
      // a campaign changed in content/promos.js (`rev` raised): written once more over the database
      const rev = Number(p.rev) || 1;
      if (rev > 1 && this.setting(`seeded:promo:${p.code}`) && Number(this.setting(`seeded:promo:${p.code}:rev`, 1)) < rev) {
        this.run('UPDATE promos SET label = ?, percent = ?, amount = ?, services = ?, max_uses = ?, starts = ?, expires = ?, active = 1 WHERE code = ?', p.label || '', p.percent || 0, p.amount || 0, (p.services || []).join(','), p.maxUses || 0, dayStart(p.starts), dayEnd(p.ends), p.code);
        this.set(`seeded:promo:${p.code}:rev`, rev);
      }
      if (this.setting(`seeded:promo:${p.code}`)) continue;
      if (!this.one('SELECT code FROM promos WHERE code = ?', p.code))
        this.run('INSERT INTO promos (code, label, percent, amount, services, max_uses, starts, expires, active, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)', p.code, p.label || '', p.percent || 0, p.amount || 0, (p.services || []).join(','), p.maxUses || 0, dayStart(p.starts), dayEnd(p.ends), now);
      this.set(`seeded:promo:${p.code}`, now);
      this.set(`seeded:promo:${p.code}:rev`, rev);
    }
    // the single band of the first version (one setting): moved into the table
    const old = this.setting('banner', null);
    if (old) {
      const seed = bannerSeeds.find((x) => x.id === old.id);
      this.run('INSERT OR IGNORE INTO banners (id, theme, title, text, cta, code, starts, expires, active, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', old.id || `b${now}`, seed?.theme || 'classique', seed?.title || '', seed?.text || old.text, seed?.cta || old.cta || 'Réserver', old.code || '', old.starts, old.expires, old.active ? 1 : 0, now);
      this.run('DELETE FROM settings WHERE key = ?', 'banner');
    }
    for (const x of bannerSeeds) {
      const rev = Number(x.rev) || 1;
      if (rev > 1 && this.setting(`seeded:banner:${x.id}`) && Number(this.setting(`seeded:banner:${x.id}:rev`, 1)) < rev) {
        this.run('UPDATE banners SET theme = ?, title = ?, text = ?, cta = ?, code = ?, starts = ?, expires = ?, active = 1 WHERE id = ?', x.theme || 'classique', x.title || '', x.text, x.cta || 'Réserver', x.code || '', dayStart(x.starts), dayEnd(x.ends), x.id);
        this.set(`seeded:banner:${x.id}:rev`, rev);
      }
      if (this.setting(`seeded:banner:${x.id}`)) continue;
      this.run('INSERT OR IGNORE INTO banners (id, theme, title, text, cta, code, starts, expires, active, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)', x.id, x.theme || 'classique', x.title || '', x.text, x.cta || 'Réserver', x.code || '', dayStart(x.starts), dayEnd(x.ends), now);
      this.set(`seeded:banner:${x.id}`, now);
      this.set(`seeded:banner:${x.id}:rev`, rev);
    }
  }

  // ---------------------------------------------------------------- codes
  referralStatus(r, now) {
    if (!r) return null;
    if (r.used) return { ok: false, error: 'Ce code de parrainage a déjà été utilisé.' };
    if (r.expires < now) return { ok: false, error: 'Ce code de parrainage a expiré.' };
    return { ok: true, kind: 'parrainage', code: r.code, label: 'Parrainage', owner: r.owner, amount: R.referral.amount, expires: r.expires };
  }
  promoStatus(p, now) {
    if (!p) return null;
    if (!p.active) return { ok: false, error: 'Ce code promo n’est pas valable en ce moment.' };
    if (now < p.starts) {
      const d = (ms) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: R.timeZone }).format(new Date(ms)).replace(/ 1 (\p{L}+)$/u, ' 1er $1');
      return { ok: false, error: d(p.starts) === d(p.expires) ? `Le code ${p.code} est valable le ${d(p.starts)} seulement : réservez ce jour-là pour en profiter.` : `Le code ${p.code} sera valable à partir du ${d(p.starts)}.` };
    }
    if (p.expires < now) return { ok: false, error: 'Ce code promo a expiré.' };
    if (p.max_uses && p.uses >= p.max_uses) return { ok: false, error: 'Ce code promo a déjà été utilisé le nombre de fois prévu.' };
    return { ok: true, kind: 'promo', code: p.code, label: `Code ${p.code}`, percent: p.percent || 0, amount: p.amount || 0, services: p.services ? p.services.split(',') : [], expires: p.expires, members: !!p.members };
  }

  // ---------------------------------------------------------------- gift cards
  /** what is left on a card once the parts set aside by payments under way are taken off */
  available(g, now, except = '') {
    this.run('DELETE FROM gift_holds WHERE expires < ?', now);
    const held = this.one('SELECT COALESCE(SUM(amount), 0) AS n FROM gift_holds WHERE code = ? AND ref <> ?', g.code, String(except)).n;
    return Math.max(0, round2(g.balance - held));
  }
  giftStatus(g, now) {
    if (!g) return null;
    const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: R.timeZone }).format(new Date(g.expires));
    if (g.expires < now) return { ok: false, kind: 'cadeau', error: `Cette carte cadeau a expiré le ${day}.` };
    const balance = this.available(g, now);
    if (balance < 0.01) return { ok: false, kind: 'cadeau', error: g.balance < 0.01 ? 'Cette carte cadeau a déjà été entièrement utilisée.' : 'Cette carte cadeau sert déjà à un paiement en cours : réessayez dans une demi-heure.' };
    return { ok: true, kind: 'cadeau', code: g.code, label: 'Carte cadeau', balance, amount: g.amount, expires: g.expires };
  }
  /** a card as its holder sees it (the site's pages); the recipient's e-mail masked */
  publicCard(g, now) {
    const status = g.expires < now ? 'expiree' : g.balance < 0.01 ? 'epuisee' : 'active';
    const site = String(this.env.SITE_URL || B.siteUrl).replace(/\/$/, '');
    return { code: g.code, token: g.token, amount: g.amount, balance: round2(g.balance), look: g.look, toName: g.to_name, sender: g.sender, message: g.message, delivery: g.delivery, toEmail: maskEmail(g.to_email), sendOn: g.send_on, sent: !!g.sent, created: g.created, expires: g.expires, status, viewUrl: `${site}/carte-cadeau/voir/?c=${encodeURIComponent(g.code)}&t=${g.token}` };
  }
  /** a card used (once for each `ref`: a booking confirmed twice is counted once); its hold goes */
  giftUse(b, now) {
    const g = this.one('SELECT * FROM gifts WHERE code = ?', referralCode(b.code));
    if (!g) return { ok: false, error: 'Carte cadeau introuvable.' };
    const ref = clip(b.ref, 120);
    const uses = jsonList(g.uses);
    if (ref && uses.some((u) => u.ref === ref)) return { ok: true, again: true, balance: g.balance };
    this.run('DELETE FROM gift_holds WHERE ref = ?', ref);
    // a payment already made with the card set aside: honoured even past its date
    if (!b.held && g.expires < now) return { ok: false, error: 'Cette carte cadeau a expiré.' };
    const amount = Math.min(round2(b.amount), b.held ? g.balance : this.available(g, now));
    if (!(amount > 0)) return { ok: false, error: 'Plus rien sur cette carte cadeau.' };
    uses.push({ ref, amount, at: now, by: clip(b.by, 80), where: clip(b.where, 60) });
    const balance = round2(g.balance - amount);
    this.run('UPDATE gifts SET balance = ?, uses = ? WHERE code = ?', balance, JSON.stringify(uses).slice(0, 8000), g.code);
    return { ok: true, used: amount, balance };
  }

  // ---------------------------------------------------------------- SOLAR CAR Premium
  memberStatus(m, now) {
    if (!m) return null;
    if (m.expires < now) return { ok: false, kind: 'premium', error: `Cette carte Premium a expiré le ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: R.timeZone }).format(new Date(m.expires))} : renouvelez-la sur la page SOLAR CAR Premium.` };
    return { ok: true, kind: 'premium', code: m.number, label: 'Carte Premium', owner: m.first, percent: P.percent, amount: 0, services: [], expires: m.expires, members: true };
  }
  /** the member of an e-mail or a client (the most recent card), with `active` */
  memberOf({ email = '', clientId = 0 }, now) {
    const e = clip(email, 120).toLowerCase();
    const m = this.one('SELECT * FROM members WHERE (email <> \'\' AND email = ?) OR (client_id > 0 AND client_id = ?) ORDER BY expires DESC LIMIT 1', e || '#', Number(clientId) || -1);
    return m ? { ...m, active: m.expires >= now } : null;
  }
  /** the appointments made as a member, the tier, the next, the gifts */
  memberState(m) {
    const visits = this.one('SELECT COUNT(*) AS n FROM bookings WHERE member = ?', m.number).n;
    const tier = tierOf(visits);
    const next = nextTier(visits);
    const gifts = jsonList(m.gifts).map((x) => ({ ...x, label: P.tiers.find((t) => t.id === x.tier)?.label || x.tier, gift: P.tiers.find((t) => t.id === x.tier)?.gift || '' }));
    return { visits, tier: { id: tier.id, label: tier.label }, next: next ? { id: next.id, label: next.label, visits: next.visits, gift: next.gift } : null, gifts, pending: gifts.filter((x) => !x.given) };
  }
  /** the member's referral code (20 € to a relative): a fresh one once the last is used or over */
  memberReferral(m, now) {
    const base = `premium-${m.number}`;
    let r = this.one('SELECT * FROM codes WHERE origin LIKE ? AND used = 0 AND expires > ? ORDER BY created DESC LIMIT 1', `${base}%`, now);
    if (!r) {
      const n = this.one('SELECT COUNT(*) AS n FROM codes WHERE origin LIKE ?', `${base}%`).n;
      const c = this.route('code/create', { owner: m.first || m.last, email: m.email, origin: n ? `${base}-${n + 1}` : base, clientId: m.client_id }, now);
      r = { code: c.code, expires: c.expires };
    }
    return { code: r.code, amount: R.referral.amount, expires: r.expires };
  }
  /** a member as they see themselves (the site's pages: the card, « Mon espace Premium ») */
  publicMember(m, now, today) {
    const s = this.memberState(m);
    const site = String(this.env.SITE_URL || B.siteUrl).replace(/\/$/, '');
    const day = today || utcToZoned(now, R.timeZone).date;
    const bookings = this.all("SELECT * FROM bookings WHERE (client_id > 0 AND client_id = ?) OR (member <> '' AND member = ?) ORDER BY date DESC, time DESC LIMIT 50", m.client_id || -1, m.number).map((b) => ({
      date: b.date,
      time: b.time,
      items: jsonList(b.items).map((i) => i.label),
      total: b.total,
      paid: b.paid,
      left: Math.max(0, round2(b.total - b.paid)),
      upcoming: b.date >= day,
    }));
    const offers = this.all('SELECT * FROM promos WHERE members = 1 AND active = 1 AND starts <= ? AND expires >= ? AND (max_uses = 0 OR uses < max_uses) ORDER BY expires', now, now).map((p) => ({ code: p.code, label: p.label, percent: p.percent, amount: p.amount, expires: p.expires }));
    return {
      number: m.number,
      token: m.token,
      firstName: m.first,
      lastName: m.last,
      email: maskEmail(m.email),
      since: m.since,
      expires: m.expires,
      active: m.expires >= now,
      percent: P.percent,
      visits: s.visits,
      tier: s.tier,
      next: s.next,
      gifts: s.gifts.map((x) => ({ tier: x.tier, label: x.label, gift: x.gift, reached: x.reached, given: x.given || 0 })),
      referral: m.expires >= now ? this.memberReferral(m, now) : null,
      bookings,
      offers,
      cardUrl: `${site}/premium/carte/?n=${encodeURIComponent(m.number)}&t=${m.token}`,
    };
  }

  // ---------------------------------------------------------------- clients
  /** finds the client (same e-mail, else same phone number) or adds them; fills what was missing */
  upsertClient(c, now, origin) {
    const email = clip(c.email, 120).toLowerCase();
    const phone = clip(c.phone, 30);
    let row = email ? this.one('SELECT * FROM clients WHERE email = ? ORDER BY id LIMIT 1', email) : null;
    if (!row && digits(phone).length === 9) row = this.all('SELECT * FROM clients WHERE phone <> ?', '').find((r) => digits(r.phone) === digits(phone)) || null;
    const vehicle = clip(c.vehicle, 80);
    if (!row) {
      this.run('INSERT INTO clients (first, last, email, phone, vehicles, plate, source, notes, origin, created, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', clip(c.firstName, 60), clip(c.lastName, 60), email, phone, vehicle, clip(c.plate, 15).toUpperCase(), clip(c.source, 180), clip(c.notes, 2000), clip(origin, 40), now, now);
      return this.one('SELECT last_insert_rowid() AS id').id;
    }
    const vehicles = row.vehicles ? row.vehicles.split(' · ') : [];
    if (vehicle && !vehicles.some((v) => v.toLowerCase() === vehicle.toLowerCase())) vehicles.push(vehicle);
    this.run(
      'UPDATE clients SET first = ?, last = ?, email = ?, phone = ?, vehicles = ?, plate = ?, source = ?, last_seen = ? WHERE id = ?',
      row.first || clip(c.firstName, 60),
      row.last || clip(c.lastName, 60),
      row.email || email,
      phone || row.phone,
      vehicles.join(' · ').slice(0, 300),
      clip(c.plate, 15).toUpperCase() || row.plate,
      row.source || clip(c.source, 180),
      Math.max(now, row.last_seen),
      row.id
    );
    return row.id;
  }

  clientCard(id) {
    const c = this.one('SELECT * FROM clients WHERE id = ?', id);
    if (!c) return null;
    return {
      ...c,
      bookings: this.all('SELECT * FROM bookings WHERE client_id = ? ORDER BY date DESC, time DESC', id),
      requests: this.all('SELECT * FROM requests WHERE client_id = ? ORDER BY at DESC', id),
      codes: this.all('SELECT * FROM codes WHERE client_id = ? OR (email <> ? AND email = ?) ORDER BY created DESC', id, '', c.email || '#'),
      gifts: this.all("SELECT * FROM gifts WHERE client_id = ? OR (buyer_email <> '' AND buyer_email = ?) ORDER BY created DESC", id, c.email || '#'),
      member: (() => {
        const m = this.memberOf({ email: c.email, clientId: id }, Date.now());
        return m ? { ...m, ...this.memberState(m) } : null;
      })(),
    };
  }

  // ---------------------------------------------------------------- requests
  async fetch(req) {
    const path = new URL(req.url).pathname.slice(1);
    // a quote request from the site's form: its photos are heavy, read and sent from here
    if (path === 'quote/submit') return Response.json(await this.quote(req));
    // the workshop's answer written in its space (multipart, with files)
    if (path === 'quote/reply') return Response.json(await this.quoteReply(req));
    // an e-mail to the discussion relay (booking/worker.js, email handler)
    if (path === 'mail/in') return Response.json(await this.mailIn(req));
    // a file of a discussion, as it is
    if (path === 'file/raw') {
      const f = this.one('SELECT name, type, data FROM files WHERE id = ?', Number(new URL(req.url).searchParams.get('id')));
      return f ? new Response(f.data, { headers: { 'content-type': f.type || 'application/octet-stream', 'x-name': encodeURIComponent(f.name) } }) : new Response('not found', { status: 404 });
    }
    const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    if (path === 'quote/accept') return Response.json(await this.quoteAccept(b, Number(b.now) || Date.now()));
    const now = Number(b.now) || Date.now();
    this.seed(now);
    const out = this.route(path, b, now);
    return out === undefined ? new Response('not found', { status: 404 }) : Response.json(out);
  }

  /**
   * POST quote/submit (booking/worker.js, /api/demande): a quote request from the site's form.
   * Checked, written into the client file, then e-mailed (booking/mail.js): to the workshop, with
   * its photos, and an acknowledgment to the client. The same request sent again within 30 minutes
   * is answered « received » without a second e-mail. The request is removed again when the
   * workshop's e-mail cannot go out: the visitor is told so and can send it again.
   * Copies sent by an older page (no `v`, the form then went through FormSubmit): written only.
   * Answer: { ok, ack (the client got their acknowledgment), duplicate } or { ok: false, status, error }.
   */
  async quote(req) {
    const now = Number(req.headers.get('x-now')) || Date.now();
    this.seed(now);
    let d;
    try {
      d = await readQuote(req);
    } catch {
      return { ok: false, status: 400, error: 'Demande illisible.' };
    }
    if (!d || typeof d !== 'object') return { ok: false, status: 400, error: 'Demande illisible.' };
    // the field hidden from people, filled by robots: « received », nothing done
    if (String(d.trap || '').trim()) return { ok: true, ack: false };
    const email = clip(d.email, 120);
    const customer = { firstName: clip(d.firstName, 60), lastName: clip(d.lastName, 60), email, phone: clip(d.phone, 30), vehicle: [clip(d.make, 40), clip(d.model, 40), clip(d.year, 4)].filter(Boolean).join(' '), source: howHeardText(d.source?.channels, d.source?.other).slice(0, 180) };
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    if (!d.v) {
      if (validEmail && (customer.lastName || customer.firstName)) {
        const codeLine = await this.codeLine(d.code, now);
        this.route('request/add', { customer, services: d.services, wish: d.wish, message: `${codeLine ? `${codeLine}\n\n` : ''}${String(d.message || '').slice(0, 2000)}` }, now);
      }
      return { ok: true, silent: true };
    }
    const message = String(d.message ?? '').replace(/\r\n?/g, '\n').trim().slice(0, 2000);
    const services = clip(d.services, 300);
    const missing = [
      [customer.lastName, 'votre nom'],
      [customer.firstName, 'votre prénom'],
      [validEmail, 'une adresse e-mail valide'],
      [customer.phone.replace(/\D/g, '').length >= 10, 'un numéro de téléphone'],
      [clip(d.make, 40) && clip(d.model, 40), 'la marque et le modèle du véhicule'],
      [services, 'la prestation souhaitée'],
      [message, 'votre message'],
      [d.consent === true || d.consent === 'on', 'votre accord pour l’utilisation de vos données'],
    ]
      .filter(([ok]) => !ok)
      .map(([, what]) => what);
    if (missing.length) return { ok: false, status: 400, error: `Il manque ${missing.join(', ')}.` };
    const files = quoteFiles(d.files);
    if (files.reduce((a, f) => a + f.size, 0) > 10.5 * 1024 * 1024) return { ok: false, status: 413, error: 'Pièces jointes trop lourdes : 10 Mo maximum au total.' };
    const code = await this.codeLine(d.code, now);
    const wish = clip(d.wish, 120);
    const stored = `${code ? `${code}\n\n` : ''}${message}`.slice(0, 2000);
    // the same request again (a second tap, a retry after an answer that got lost): already here
    const twice = this.one(
      'SELECT r.id FROM requests r JOIN clients c ON c.id = r.client_id WHERE c.email = ? AND r.vehicle = ? AND r.services = ? AND r.message = ? AND r.at > ? LIMIT 1',
      email.toLowerCase(),
      clip(customer.vehicle, 80),
      services,
      stored,
      now - 30 * 60000
    );
    if (twice) return { ok: true, ack: false, duplicate: true };
    const { requestId } = this.route('request/add', { customer, services, wish, message: stored }, now);
    const env = this.env;
    const drop = () => this.forget([requestId]);
    if (!env.RESEND_API_KEY || !env.NOTIFY_TO) {
      drop();
      console.error('[quote] no e-mail settings (RESEND_API_KEY, NOTIFY_TO)');
      return { ok: false, status: 503, error: 'Envoi indisponible.' };
    }
    // the discussion: its number in the subject, the key of the accept link, the request as its first message
    const subject = quoteSubject({ id: requestId, vehicle: clip(customer.vehicle, 80), services });
    this.run('UPDATE requests SET token = ?, subject = ?, status = ?, status_at = ? WHERE id = ?', hex(16), subject, 'nouveau', now, requestId);
    this.addMessage(requestId, { at: now, dir: 'in', via: 'site', text: stored, files: files.map((f) => ({ filename: f.filename, type: f.type, bytes: bytesOf(f.content) })) });
    const q = { id: requestId, at: now, c: customer, vehicle: customer.vehicle, services, wish, code, source: customer.source, message, files };
    try {
      let sent;
      try {
        sent = await sendQuoteMails(env, q);
      } catch (err) {
        // attachments the sending service refuses: the request goes out without them
        if (!files.length || !/^resend 4\d\d/.test(err.message) || /429/.test(err.message)) throw err;
        console.error('[quote] attachments refused', err.message);
        sent = await sendQuoteMails(env, { ...q, files: [], message: `${message}\n\n(${files.length} pièce${files.length > 1 ? 's' : ''} jointe${files.length > 1 ? 's' : ''} n’${files.length > 1 ? 'ont' : 'a'} pas pu être transmise${files.length > 1 ? 's' : ''} : à redemander.)` });
      }
      return { ok: true, ack: sent.client, n: requestId, who: [customer.firstName, customer.lastName].filter(Boolean).join(' '), services };
    } catch (err) {
      console.error('[quote] workshop e-mail', err.message);
      drop();
      return { ok: false, status: 502, error: 'L’envoi n’a pas abouti.' };
    }
  }

  // ---------------------------------------------------------------- the discussions
  /** the request with its client */
  request(id) {
    return this.one('SELECT r.*, c.first, c.last, c.email, c.phone FROM requests r LEFT JOIN clients c ON c.id = r.client_id WHERE r.id = ?', Number(id) || 0);
  }
  /** requests, their messages and files gone (a request not sent, a client erased) */
  forget(ids) {
    for (const id of ids) {
      this.run('DELETE FROM files WHERE request_id = ?', id);
      this.run('DELETE FROM messages WHERE request_id = ?', id);
      this.run('DELETE FROM requests WHERE id = ?', id);
    }
  }
  /** a message of a discussion; files [{ filename, type, bytes }] kept when small enough */
  addMessage(requestId, { at, dir, via = '', text = '', files = [], msgid = '', sender = '' }) {
    const meta = files.map((f) => {
      const size = f.bytes?.length || 0;
      let id = 0;
      // kept to be shown: photos and PDF only (anything else stays in the e-mail)
      if (size && size <= MAX_FILE && /^image\/(jpeg|png|webp|gif|avif)$|^application\/pdf$/.test(f.type)) {
        this.run('INSERT INTO files (request_id, name, type, size, data) VALUES (?, ?, ?, ?, ?)', requestId, clip(f.filename, 120), clip(f.type, 80), size, blob(f.bytes));
        id = this.one('SELECT last_insert_rowid() AS id').id;
      }
      return { id, name: clip(f.filename, 120), type: clip(f.type, 80), size };
    });
    this.run('INSERT INTO messages (request_id, at, dir, via, text, files, msgid, sender) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', requestId, at, dir, via, String(text).slice(0, 20000), JSON.stringify(meta), clip(msgid, 300), clip(sender, 200));
    this.run('UPDATE requests SET last_at = ? WHERE id = ?', at, requestId);
    return meta;
  }
  /** a new status, said in the discussion */
  setStatus(id, status, now, note) {
    this.run('UPDATE requests SET status = ?, status_at = ? WHERE id = ?', status, now, id);
    if (note) this.addMessage(id, { at: now, dir: 'note', text: note });
  }
  /** the status the last message of a discussion calls for: the workshop answered → « Devis
   *  envoyé »; the client wrote after an answer → « Réponse reçue » (also out of « Sans suite »).
   *  A quote « Validé » stays so; `notes` = what is said in the discussion ({ out, in }) */
  follow(id, now, notes = {}) {
    const r = this.one('SELECT id, status FROM requests WHERE id = ?', id);
    const last = r && this.one("SELECT dir FROM messages WHERE request_id = ? AND dir IN ('in', 'out') ORDER BY at DESC, id DESC LIMIT 1", id);
    if (!last) return;
    if (last.dir === 'out' && (r.status === 'nouveau' || r.status === 'reponse')) this.setStatus(id, 'envoye', now, notes.out);
    else if (last.dir === 'in' && (r.status === 'envoye' || r.status === 'sans_suite')) {
      const answered = this.one("SELECT id FROM messages WHERE request_id = ? AND dir = 'out' LIMIT 1", id);
      this.setStatus(id, answered ? 'reponse' : 'nouveau', now, r.status === 'sans_suite' ? `Le client a écrit : la demande quitte « Sans suite » et revient en « ${answered ? QUOTE_STATUS.reponse : QUOTE_STATUS.nouveau} ».` : notes.in);
    }
  }
  /** the delays of the quotes (QUOTE_DELAYS, as changed in the space) */
  delays() {
    const d = this.setting('quoteDelays', {}) || {};
    const n = (v, def) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.max(0, Math.min(120, Math.round(Number(v)))) : def);
    return { remind: n(d.remind, QUOTE_DELAYS.remind), close: n(d.close, QUOTE_DELAYS.close) };
  }
  /** the quotes waiting for the client: « Sans suite » once nothing has happened for `close` days
   *  (the workshop's last message, or the status set by hand); they come back by themselves when
   *  the client writes. Run before the lists are read, and every day. Returns how many closed. */
  age(now) {
    // once: the discussions where the client had written after the quote, from before « Réponse reçue »
    if (!this.setting('statusReply')) {
      for (const r of this.all("SELECT id FROM requests WHERE status = 'envoye' AND unread > 0")) this.follow(r.id, now);
      this.set('statusReply', now);
    }
    const { close } = this.delays();
    if (!close) return 0;
    let n = 0;
    for (const r of this.all(`SELECT r.id, MAX(r.status_at, COALESCE((SELECT MAX(at) FROM messages m WHERE m.request_id = r.id AND m.dir IN ('in', 'out')), 0)) AS quiet FROM requests r WHERE r.status = 'envoye'`))
      if (now - r.quiet > close * DAY) {
        this.setStatus(r.id, 'sans_suite', now, `Pas de nouvelles du client depuis ${close} jours : passé en « Sans suite ». La demande revient toute seule s’il répond.`);
        n++;
      }
    return n;
  }
  /** what happened lately, newest first: quote requests, messages, status notes, online bookings */
  activity(limit = 20) {
    return this.all(
      `SELECT * FROM (
        SELECT 'demande' AS kind, 'r' || r.id AS key, r.at AS at, r.id AS request, r.services AS text, r.vehicle AS vehicle, c.first, c.last, r.client_id AS client FROM requests r LEFT JOIN clients c ON c.id = r.client_id
        UNION ALL SELECT m.dir, 'm' || m.id, m.at, m.request_id, substr(m.text, 1, 220), r.vehicle, c.first, c.last, r.client_id FROM messages m JOIN requests r ON r.id = m.request_id LEFT JOIN clients c ON c.id = r.client_id WHERE m.via <> 'site'
        UNION ALL SELECT 'rdv', 'b' || b.session, b.created, 0, b.items, b.date || ' ' || b.time, c.first, c.last, b.client_id FROM bookings b LEFT JOIN clients c ON c.id = b.client_id WHERE b.live = 1
      ) ORDER BY at DESC LIMIT ?`,
      Math.min(60, Number(limit) || 20)
    );
  }
  /** a Message-ID kept to thread the next e-mails (the client's in `refs`, the workshop's in `owner_refs`) */
  addRef(id, column, msgid) {
    if (!msgid) return;
    const r = this.one(`SELECT ${column} AS v FROM requests WHERE id = ?`, id);
    const list = refsOf(r?.v).filter((x) => x !== msgid);
    this.run(`UPDATE requests SET ${column} = ? WHERE id = ?`, [...list, msgid].slice(-10).join(' '), id);
  }
  /** a request made before the discussions: given its number, key and subject */
  ready(r) {
    if (r.token && r.subject) return r;
    const token = r.token || hex(16);
    const subject = r.subject || quoteSubject(r);
    this.run('UPDATE requests SET token = ?, subject = ? WHERE id = ?', token, subject, r.id);
    return { ...r, token, subject };
  }

  /** POST quote/reply (x-request, multipart: message, montant, accepter, fichiers): the workshop
   *  writes to the client from its space; a copy goes to the workshop's Gmail */
  async quoteReply(req) {
    const now = Number(req.headers.get('x-now')) || Date.now();
    let r = this.request(req.headers.get('x-request'));
    if (!r) return { ok: false, status: 404, error: 'Demande introuvable.' };
    r = this.ready(r);
    const f = await req.formData();
    const text = String(f.get('message') ?? '')
      .replace(/\r\n?/g, '\n')
      .trim()
      .slice(0, 10000);
    const files = [];
    for (const v of f.getAll('fichiers')) if (v && typeof v === 'object' && v.size) files.push({ filename: v.name || 'piece-jointe', type: v.type || 'application/octet-stream', bytes: new Uint8Array(await v.arrayBuffer()) });
    if (!text && !files.length) return { ok: false, status: 400, error: 'Écrivez un message ou joignez un fichier.' };
    if (files.reduce((a, x) => a + x.bytes.length, 0) > 20 * 1024 * 1024) return { ok: false, status: 413, error: 'Pièces jointes trop lourdes : 20 Mo maximum.' };
    if (!r.email) return { ok: false, status: 400, error: 'Ce client n’a pas d’adresse e-mail.' };
    if (!this.env.RESEND_API_KEY) return { ok: false, status: 503, error: 'Envoi d’e-mail non configuré.' };
    const amount = amountOf(f.get('montant'));
    if (amount !== null) {
      this.run('UPDATE requests SET amount = ? WHERE id = ?', amount, r.id);
      r.amount = amount;
    }
    const accept = f.get('accepter') === '1' && r.status !== 'valide';
    try {
      await sendToClient(this.env, r, { text, files: files.map((x) => ({ filename: x.filename, content: toBase64(x.bytes) })), acceptUrl: accept ? acceptUrl(this.env, r) : '', bcc: ownerAddresses(this.env), refs: refsOf(r.refs) });
    } catch (err) {
      console.error('[quote] reply', err.message);
      return { ok: false, status: 502, error: 'L’e-mail n’est pas parti : réessayez dans un instant.' };
    }
    this.addMessage(r.id, { at: now, dir: 'out', via: 'atelier', text, files });
    this.run('UPDATE requests SET unread = 0 WHERE id = ?', r.id);
    this.follow(r.id, now);
    return { ok: true };
  }

  /** the request an e-mail to the relay is about: its number in the subject, the e-mail it
   *  answers, else the sender's latest request */
  findRequest(m, from) {
    const n = Number((m.subject.match(/n°\s*(\d+)/i) || [])[1]);
    if (n && this.request(n)) return this.request(n);
    for (const id of [...m.inReplyTo, ...m.references].reverse()) {
      const x = this.one('SELECT request_id FROM messages WHERE msgid = ? LIMIT 1', id);
      if (x) return this.request(x.request_id);
    }
    const last = this.one('SELECT r.id FROM requests r JOIN clients c ON c.id = r.client_id WHERE c.email = ? ORDER BY r.at DESC LIMIT 1', from);
    return last ? this.request(last.id) : null;
  }

  /** POST mail/in (x-now, x-mail-from, x-auth; the raw e-mail): a reply to a quote discussion.
   *  From the workshop's Gmail: passed on to the client (« Devis envoyé »). From the client: kept,
   *  and told to the workshop by e-mail. { ok } or { ok: false, reject } (the sender is told) */
  async mailIn(req) {
    const now = Number(req.headers.get('x-now')) || Date.now();
    const m = parseMail(new Uint8Array(await req.arrayBuffer()));
    const from = m.from || String(req.headers.get('x-mail-from') || '').toLowerCase();
    const auth = [...m.auth, ...decodeURIComponent(req.headers.get('x-auth') || '').split('\n')].filter(Boolean);
    // never machines (out-of-office, bounces), never this site's own addresses: no loop
    if (m.autoReply || !from || /@(.+\.)?solarcar37\.fr$/i.test(from) || /^(mailer-daemon|postmaster|no-?reply)/i.test(from)) return { ok: true, ignored: 'auto' };
    const owner = ownerAddresses(this.env).includes(from);
    const verified = owner && authenticated(auth, from);
    const text = freshText(m.text || htmlToText(m.html));
    const files = m.attachments.filter((a) => !a.inline && a.bytes.length).map((a) => ({ filename: a.filename, type: a.type, bytes: a.bytes }));
    const asMail = () => files.map((x) => ({ filename: x.filename, content: toBase64(x.bytes) }));
    let r = this.findRequest(m, from);
    if (!r) {
      if (owner) return { ok: false, reject: 'Aucune demande de devis ne correspond : répondez depuis l’e-mail de la demande (son objet porte le n°).' };
      await notifyWorkshop(this.env, null, 'unknown', { text: text || m.text, files: asMail(), sender: { name: m.fromName, email: from, subject: m.subject } }).catch((err) => console.error('[quote] unknown', err.message));
      return { ok: true, unknown: true };
    }
    r = this.ready(r);
    // a discussion that floods: kept quiet
    if (this.one('SELECT COUNT(*) AS n FROM messages WHERE request_id = ? AND at > ?', r.id, now - 86400000).n >= 40) return { ok: true, ignored: 'flood' };
    if (owner) {
      if (!verified) {
        this.addMessage(r.id, { at: now, dir: 'note', text: 'Un e-mail à l’adresse de l’atelier n’a pas été transmis au client : son expéditeur n’a pas pu être vérifié. Répondez depuis l’espace atelier.' });
        return { ok: false, reject: 'Expéditeur non vérifié : message non transmis. Répondez depuis l’espace atelier.' };
      }
      if (!text && !files.length) return { ok: true, ignored: 'empty' };
      try {
        await sendToClient(this.env, r, { text: text || 'Voir la pièce jointe.', files: asMail(), acceptUrl: r.status !== 'valide' ? acceptUrl(this.env, r) : '', refs: refsOf(r.refs) });
      } catch (err) {
        console.error('[quote] relay to client', err.message);
        return { ok: false, reject: 'Le message n’a pas pu être transmis au client : réessayez, ou répondez depuis l’espace atelier.' };
      }
      this.addMessage(r.id, { at: now, dir: 'out', via: 'gmail', text, files, msgid: m.messageId });
      this.addRef(r.id, 'owner_refs', m.messageId);
      this.run('UPDATE requests SET unread = 0 WHERE id = ?', r.id);
      this.follow(r.id, now);
      return { ok: true, relayed: 'client' };
    }
    const client = from === String(r.email || '').toLowerCase();
    this.addMessage(r.id, { at: now, dir: 'in', via: 'mail', text: text || (files.length ? '' : '(message vide)'), files, msgid: m.messageId, sender: client ? '' : `${m.fromName ? `${m.fromName} ` : ''}<${from}>` });
    if (client) this.addRef(r.id, 'refs', m.messageId);
    this.run('UPDATE requests SET unread = unread + 1 WHERE id = ?', r.id);
    this.run('UPDATE clients SET last_seen = ? WHERE id = ?', now, r.client_id);
    this.follow(r.id, now);
    await notifyWorkshop(this.env, { ...r, ...(client ? {} : { first: m.fromName || from, last: '' }) }, 'message', { text: text || '(pièce jointe)', files: asMail(), refs: refsOf(r.owner_refs) }).catch((err) => console.error('[quote] notify', err.message));
    return { ok: true, relayed: 'workshop', n: r.id, who: client ? r.first || r.email : m.fromName || from, text: snippetOf(text) };
  }

  /** quote/accept { n, t }: the client accepts the quote from the link of the e-mail */
  async quoteAccept(b, now) {
    const r = this.request(b.n);
    if (!r || !r.token || String(b.t || '') !== r.token) return { ok: false, status: 404, error: 'Ce lien de devis n’est pas valable.' };
    if (r.status === 'valide') return { ok: true, already: true, firstName: r.first };
    this.setStatus(r.id, 'valide', now, 'Devis accepté par le client (bouton de l’e-mail).');
    this.run('UPDATE requests SET unread = unread + 1 WHERE id = ?', r.id);
    await notifyWorkshop(this.env, r, 'accepted', { refs: refsOf(r.owner_refs) }).catch((err) => console.error('[quote] accepted', err.message));
    return { ok: true, firstName: r.first };
  }

  /** the line written above a request about the code typed in it, checked the day it arrives */
  async codeLine(raw, now) {
    const code = referralCode(raw);
    if (!code) return '';
    const r = this.route('code/check', { code, now }, now);
    if (!r) return `Code ${code} : à vérifier`;
    if (!r.ok) return `Code ${code} non valable le jour de la demande : ${r.error}`;
    if (r.kind === 'cadeau') return `Carte cadeau ${r.code} : ${r.balance.toFixed(2).replace('.', ',').replace(',00', '')} € disponibles le jour de la demande (à déduire du règlement)`;
    if (r.kind === 'premium') return `Carte Premium ${r.code} (${r.owner}) valable le jour de la demande : −${r.percent} % sur le devis`;
    return r.kind === 'promo'
      ? `Code promo ${r.code}${r.members ? ' (réservé aux membres Premium)' : ''} valable le jour de la demande : ${r.percent ? `−${r.percent} %` : `−${r.amount} €`}`
      : `Code de parrainage ${r.code} (${r.owner}) valable le jour de la demande : −${r.amount} €`;
  }

  route(path, b, now) {
    switch (path) {
      // ------------------------------------------------ codes
      case 'code/create': {
        const origin = clip(b.origin, 120);
        const known = origin ? this.one('SELECT * FROM codes WHERE origin = ? ORDER BY created DESC LIMIT 1', origin) : null;
        if (known) return { ok: true, code: known.code, owner: known.owner, amount: R.referral.amount, expires: known.expires, used: known.used };
        let code = newCode(b.owner);
        while (this.one('SELECT code FROM codes WHERE code = ?', code) || this.one('SELECT code FROM promos WHERE code = ?', code)) code = newCode(b.owner);
        const expires = now + Math.round(R.referral.months * 30.44 * DAY);
        this.run('INSERT INTO codes (code, owner, email, origin, created, expires, client_id) VALUES (?, ?, ?, ?, ?, ?, ?)', code, clip(b.owner, 60), clip(b.email, 120).toLowerCase(), origin, now, expires, Number(b.clientId) || 0);
        return { ok: true, code, owner: clip(b.owner, 60), amount: R.referral.amount, expires };
      }
      case 'code/check': {
        const code = referralCode(b.code);
        if (isGiftCode(code)) return this.giftStatus(this.one('SELECT * FROM gifts WHERE code = ?', code), now) || { ok: false, error: 'Cette carte cadeau n’existe pas : vérifiez le code.' };
        if (isPremiumCode(code)) return this.memberStatus(this.one('SELECT * FROM members WHERE number = ?', code), now) || { ok: false, error: 'Ce numéro de carte Premium n’existe pas : vérifiez-le.' };
        return this.promoStatus(this.one('SELECT * FROM promos WHERE code = ?', code), now) || this.referralStatus(this.one('SELECT * FROM codes WHERE code = ?', code), now) || { ok: false, error: 'Ce code n’existe pas : vérifiez-le.' };
      }
      case 'code/redeem': {
        const r = this.one('SELECT * FROM codes WHERE code = ?', referralCode(b.code));
        // the same booking confirmed twice (Stripe may notify twice): already counted
        if (r?.used && r.used_ref && r.used_ref === clip(b.ref, 120)) return { ok: true, again: true };
        const s = this.referralStatus(r, now) || { ok: false, error: 'Ce code n’existe pas : vérifiez-le.' };
        if (!s.ok) return s;
        this.run('UPDATE codes SET used = ?, used_by = ?, used_ref = ?, used_where = ? WHERE code = ? AND used = 0', now, clip(b.by, 80), clip(b.ref, 120), clip(b.where, 40), r.code);
        return { ok: true };
      }
      case 'codes/list': {
        const n = this.one('SELECT COUNT(*) AS given, SUM(used > 0) AS used FROM codes');
        return { codes: this.all('SELECT * FROM codes ORDER BY created DESC LIMIT 300'), given: n.given || 0, used: n.used || 0, offered: (n.used || 0) * R.referral.amount, promos: this.all('SELECT * FROM promos ORDER BY created DESC') };
      }
      // ------------------------------------------------ promotions
      case 'promo/save': {
        const code = referralCode(b.code);
        if (!/^[A-Z0-9][A-Z0-9-]{2,19}$/.test(code)) return { ok: false, error: 'Le code doit faire de 3 à 20 lettres ou chiffres (ex. NOEL, PRINTEMPS27).' };
        if (this.one('SELECT code FROM codes WHERE code = ?', code)) return { ok: false, error: 'Ce code existe déjà comme code de parrainage.' };
        if (code.startsWith(`${GIFT_PREFIX}-`) || code.startsWith(`${PREMIUM_PREFIX}-`)) return { ok: false, error: `Les codes qui commencent par ${GIFT_PREFIX}- ou ${PREMIUM_PREFIX}- sont réservés aux cartes.` };
        const percent = Math.max(0, Math.min(90, Number(b.percent) || 0));
        const amount = Math.max(0, Math.min(1000, Number(b.amount) || 0));
        if (!percent && !amount) return { ok: false, error: 'Indiquez une remise : un pourcentage ou un montant.' };
        if (!b.starts || !b.ends || b.ends < b.starts) return { ok: false, error: 'Indiquez les dates : du … au … (la fin après le début).' };
        const services = (Array.isArray(b.services) ? b.services : []).filter((s) => ['tint', 'lights'].includes(s));
        const known = this.one('SELECT * FROM promos WHERE code = ?', code);
        if (known && !b.update) return { ok: false, error: `Le code ${code} existe déjà : modifiez-le dans la liste.` };
        const values = [clip(b.label, 60), percent, percent ? 0 : amount, services.join(','), Math.max(0, Math.floor(Number(b.maxUses) || 0)), dayStart(b.starts), dayEnd(b.ends), b.members ? 1 : 0];
        if (known) this.run('UPDATE promos SET label = ?, percent = ?, amount = ?, services = ?, max_uses = ?, starts = ?, expires = ?, members = ? WHERE code = ?', ...values, code);
        else this.run('INSERT INTO promos (label, percent, amount, services, max_uses, starts, expires, members, code, active, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)', ...values, code, now);
        return { ok: true, code };
      }
      case 'promo/active': {
        this.run('UPDATE promos SET active = ? WHERE code = ?', b.active ? 1 : 0, referralCode(b.code));
        return { ok: true };
      }
      case 'promo/use': {
        this.run('UPDATE promos SET uses = uses + 1 WHERE code = ?', referralCode(b.code));
        return { ok: true };
      }
      // ------------------------------------------------ the band of the site
      case 'banners/list':
        return { banners: this.all('SELECT * FROM banners ORDER BY starts DESC, created DESC') };
      // the band on now (or the next one), for the home of the workshop's space
      case 'banner/get':
        return { banner: this.one('SELECT * FROM banners WHERE active = 1 AND expires >= ? ORDER BY (starts <= ?) DESC, starts ASC LIMIT 1', now, now) };
      case 'banner/save': {
        if (!clip(b.text, 260)) return { ok: false, error: 'Écrivez le texte du bandeau.' };
        if (!b.starts || !b.ends || b.ends < b.starts) return { ok: false, error: 'Indiquez les dates du bandeau.' };
        const theme = ['classique', 'noel', 'neon'].includes(b.theme) ? b.theme : 'classique';
        const values = [theme, clip(b.title, 60), clip(b.text, 260), clip(b.cta, 30) || 'Réserver', referralCode(b.code), dayStart(b.starts), dayEnd(b.ends), b.active ? 1 : 0];
        if (b.id && this.one('SELECT id FROM banners WHERE id = ?', String(b.id))) this.run('UPDATE banners SET theme = ?, title = ?, text = ?, cta = ?, code = ?, starts = ?, expires = ?, active = ? WHERE id = ?', ...values, String(b.id));
        else this.run('INSERT INTO banners (theme, title, text, cta, code, starts, expires, active, id, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', ...values, `b${now}`, now);
        return { ok: true };
      }
      case 'banner/active':
        this.run('UPDATE banners SET active = ? WHERE id = ?', b.active ? 1 : 0, String(b.id));
        return { ok: true };
      case 'banner/delete':
        this.run('DELETE FROM banners WHERE id = ?', String(b.id));
        return { ok: true };
      // the band the site shows now: the most recent start among those on
      case 'banner/public': {
        // b.id: one band shown whatever its dates (« Voir sur le site » from the workshop's space)
        const x = b.id ? this.one('SELECT * FROM banners WHERE id = ?', String(b.id)) : this.one('SELECT * FROM banners WHERE active = 1 AND starts <= ? AND expires >= ? ORDER BY starts DESC, created DESC LIMIT 1', now, now);
        if (!x) return { banner: null };
        // the countdown of the band: the dates of its code (until its last day 23:59), else its own
        const p = x.code ? this.one('SELECT starts, expires FROM promos WHERE code = ? AND active = 1', x.code) : null;
        return { banner: { id: `${x.id}-${x.created}`, theme: x.theme, title: x.title, text: x.text, cta: x.cta, code: x.code, starts: p ? p.starts : x.starts, ends: (p ? p.expires : x.expires) + 1 } };
      }
      // ------------------------------------------------ clients, bookings, requests
      case 'booking/add': {
        if (this.one('SELECT session FROM bookings WHERE session = ?', clip(b.session, 120))) return { ok: true, again: true };
        const id = this.upsertClient(b.customer || {}, now, 'réservation en ligne');
        // a member (active the day of the booking): the appointment counts for their tiers
        const m = this.memberOf({ email: b.customer?.email, clientId: id }, now);
        const member = m?.active ? m : null;
        if (member && !member.client_id) this.run('UPDATE members SET client_id = ? WHERE number = ?', id, member.number);
        this.run(
          'INSERT INTO bookings (session, client_id, event, date, time, minutes, items, total, discount, code, code_kind, mode, paid, vehicle, live, created, gift, gift_amount, member) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          clip(b.session, 120), id, clip(b.event, 120), clip(b.date, 10), clip(b.time, 5), Number(b.minutes) || 0, JSON.stringify(b.items || []).slice(0, 2000), Number(b.total) || 0, Number(b.discount) || 0, referralCode(b.code), clip(b.codeKind, 20), clip(b.mode, 10), Number(b.paid) || 0, clip(b.customer?.vehicle, 80), b.live === false ? 0 : 1, Number(b.created) || now, b.gift ? referralCode(b.gift) : '', round2(b.giftAmount), member?.number || ''
        );
        // a tier reached with this appointment: its gift is waiting at the workshop
        let reached = [];
        if (member) {
          const visits = this.one('SELECT COUNT(*) AS n FROM bookings WHERE member = ?', member.number).n;
          const gifts = jsonList(member.gifts);
          reached = P.tiers.filter((t) => t.gift && visits >= t.visits && !gifts.some((x) => x.tier === t.id));
          if (reached.length) this.run('UPDATE members SET gifts = ? WHERE number = ?', JSON.stringify([...gifts, ...reached.map((t) => ({ tier: t.id, reached: now, given: 0, booking: clip(b.session, 120) }))]), member.number);
        }
        // a link sent by the workshop, now paid
        this.run("UPDATE links SET status = 'paye' WHERE session = ? AND session <> ''", clip(b.session, 120));
        // the client had asked for a quote for what they booked: that quote is « Validé »
        const booked = kinds((b.items || []).map((i) => i.label).join(' '));
        const when = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date)) ? `${String(b.date).split('-').reverse().join('/')} à ${String(b.time).replace(':', ' h ')}` : '';
        for (const r of this.all("SELECT id, services FROM requests WHERE client_id = ? AND status IN ('nouveau', 'envoye', 'reponse', 'sans_suite') AND at > ?", id, now - 180 * DAY))
          if (kinds(r.services).some((k) => booked.includes(k))) {
            this.run('UPDATE requests SET booking = ?, unread = unread + 1 WHERE id = ?', clip(b.session, 120), r.id);
            this.setStatus(r.id, 'valide', now, `Rendez-vous réservé et payé en ligne${when ? ` pour le ${when}` : ''}.`);
          }
        return { ok: true, clientId: id, member: member ? { number: member.number, token: member.token, first: member.first, email: member.email, ...this.memberState(this.one('SELECT * FROM members WHERE number = ?', member.number)), reached: reached.map((t) => ({ id: t.id, label: t.label, gift: t.gift, visits: t.visits })) } : null };
      }
      case 'request/add': {
        const id = this.upsertClient(b.customer || {}, now, 'demande de devis');
        this.run('INSERT INTO requests (client_id, at, services, vehicle, wish, message, source) VALUES (?, ?, ?, ?, ?, ?, ?)', id, now, clip(b.services, 300), clip(b.customer?.vehicle, 80), clip(b.wish, 120), String(b.message || '').trim().slice(0, 2000), clip(b.customer?.source, 180));
        return { ok: true, clientId: id, requestId: this.one('SELECT last_insert_rowid() AS id').id };
      }
      // ------------------------------------------------ quote discussions
      case 'quote/public': {
        const r = this.request(b.n);
        if (!r || !r.token || String(b.t || '') !== r.token) return { ok: false, error: 'Ce lien de devis n’est pas valable.' };
        return { ok: true, n: r.id, firstName: r.first, vehicle: r.vehicle, services: r.services, amount: r.amount, status: r.status, at: r.at };
      }
      case 'quotes/list': {
        this.age(now);
        const st = Object.hasOwn(QUOTE_STATUS, b.status) ? b.status : '';
        const rows = this.all(
          `SELECT r.id, r.at, r.status, r.status_at, r.amount, r.services, r.vehicle, r.unread, r.last_at, r.client_id, c.first, c.last, c.phone, c.email,
            (SELECT text FROM messages m WHERE m.request_id = r.id AND m.dir <> 'note' ORDER BY m.at DESC, m.id DESC LIMIT 1) AS last_text,
            (SELECT dir FROM messages m WHERE m.request_id = r.id AND m.dir <> 'note' ORDER BY m.at DESC, m.id DESC LIMIT 1) AS last_dir,
            MAX(r.status_at, COALESCE((SELECT MAX(at) FROM messages m WHERE m.request_id = r.id AND m.dir IN ('in', 'out')), 0)) AS quiet
           FROM requests r LEFT JOIN clients c ON c.id = r.client_id WHERE ? = '' OR r.status = ?
           ORDER BY (r.unread > 0) DESC, MAX(r.at, r.last_at) DESC LIMIT 300`,
          st,
          st
        );
        const counts = Object.fromEntries(Object.keys(QUOTE_STATUS).map((k) => [k, 0]));
        for (const x of this.all('SELECT status, COUNT(*) AS n FROM requests GROUP BY status')) counts[x.status] = x.n;
        const { remind } = this.delays();
        for (const q of rows) q.remind = !!(remind && q.status === 'envoye' && now - q.quiet > remind * DAY);
        return { quotes: rows, counts, unread: this.one('SELECT COUNT(*) AS n FROM requests WHERE unread > 0').n, delays: this.delays() };
      }
      case 'quote/get': {
        const r = this.request(b.id);
        if (!r) return { quote: null };
        let messages = this.all('SELECT * FROM messages WHERE request_id = ? ORDER BY at, id', r.id).map((x) => ({ ...x, files: JSON.parse(x.files || '[]') }));
        // a request made before the discussions: its message as the first one
        if (!messages.length) messages = [{ id: 0, at: r.at, dir: 'in', via: 'site', text: r.message, files: [] }];
        return { quote: this.ready(r), messages };
      }
      case 'quotes/badge':
        return { n: this.one("SELECT COUNT(*) AS n FROM requests WHERE unread > 0 OR status IN ('nouveau', 'reponse')").n };
      // the space open on a screen, every half minute: the figures that move, what happened lately,
      // and a version that changes with anything shown
      case 'live': {
        const closed = this.age(now);
        const { remind } = this.delays();
        const counts = Object.fromEntries(Object.keys(QUOTE_STATUS).map((k) => [k, 0]));
        for (const x of this.all('SELECT status, COUNT(*) AS n FROM requests GROUP BY status')) counts[x.status] = x.n;
        const q = this.one(
          `SELECT COUNT(*) AS n FROM requests r WHERE r.status = 'envoye' AND ? > 0 AND ? - MAX(r.status_at, COALESCE((SELECT MAX(at) FROM messages m WHERE m.request_id = r.id AND m.dir IN ('in', 'out')), 0)) > ?`,
          remind,
          now,
          remind * DAY
        );
        const v = this.one(`SELECT (SELECT COALESCE(MAX(id), 0) FROM requests) || '.' || (SELECT COALESCE(MAX(id), 0) FROM messages) || '.' || (SELECT COUNT(*) FROM requests) || '.' || (SELECT COUNT(*) FROM bookings) || '.' || (SELECT COALESCE(SUM(unread), 0) FROM requests) || '.' || (SELECT COALESCE(MAX(status_at), 0) FROM requests) || '.' || (SELECT COUNT(*) FROM clients) || '.' || (SELECT COUNT(*) FROM links) || '.' || (SELECT COUNT(*) FROM links WHERE status = 'attente') AS v`).v;
        return {
          v,
          closed,
          badge: this.one("SELECT COUNT(*) AS n FROM requests WHERE unread > 0 OR status IN ('nouveau', 'reponse')").n,
          counts,
          unread: this.one('SELECT COUNT(*) AS n FROM requests WHERE unread > 0').n,
          remind: q.n,
          events: this.activity(b.limit || 20),
        };
      }
      case 'activity':
        return { events: this.activity(b.limit) };
      case 'quotes/age':
        return { ok: true, closed: this.age(now) };
      case 'quotes/delays': {
        if (b.set) this.set('quoteDelays', { remind: b.set.remind, close: b.set.close });
        return { ok: true, delays: this.delays() };
      }
      case 'quote/seen':
        this.run('UPDATE requests SET unread = 0 WHERE id = ?', Number(b.id) || 0);
        return { ok: true };
      // a request deleted from the space (its messages and files with it; the client stays)
      case 'quote/delete': {
        const r = this.request(b.id);
        if (!r) return { ok: false, error: 'Demande introuvable.' };
        this.forget([r.id]);
        return { ok: true };
      }
      // ------------------------------------------------ Gmail (booking/gmail.js)
      // the quotes whose e-mails are read in Gmail: not closed, of the last 90 days, with an
      // e-mail address; and the Message-IDs already in their discussion
      case 'gmail/open': {
        // « Sans suite » for less than 30 days: still read, the client may come back
        const rows = this.all("SELECT r.id, r.at, c.email FROM requests r JOIN clients c ON c.id = r.client_id WHERE (r.status <> 'sans_suite' OR r.status_at > ?) AND r.at > ? AND c.email <> '' ORDER BY r.at DESC LIMIT 40", now - 30 * DAY, now - 90 * DAY);
        return { requests: rows.map((r) => ({ ...r, known: this.all("SELECT msgid FROM messages WHERE request_id = ? AND msgid <> ''", r.id).map((x) => x.msgid) })) };
      }
      // e-mails found in Gmail: into their discussion once each; a reply written from Gmail moves a
      // new quote to « Devis envoyé », an answer of the client is unread
      case 'gmail/import': {
        let imported = 0;
        // the clients' messages found: told to the workshop's devices (booking/push.js)
        const incoming = [];
        const items = (Array.isArray(b.items) ? b.items.slice(0, 200) : []).sort((x, y) => (Number(x.at) || 0) - (Number(y.at) || 0));
        for (const it of items) {
          const r = this.request(it.requestId);
          if (!r) continue;
          const key = clip(it.msgid, 300) || `gmail:${clip(it.gid, 60)}`;
          if (this.one('SELECT id FROM messages WHERE request_id = ? AND (msgid = ? OR msgid = ?)', r.id, key, `gmail:${clip(it.gid, 60)}`)) continue;
          const dir = it.dir === 'out' ? 'out' : 'in';
          this.addMessage(r.id, { at: Number(it.at) || now, dir, via: 'gmail', text: String(it.text || '').slice(0, 10000) || '(message sans texte)', msgid: key });
          imported++;
          if (dir === 'in') {
            this.run('UPDATE requests SET unread = unread + 1 WHERE id = ?', r.id);
            incoming.push({ n: r.id, who: r.first || r.email, text: snippetOf(it.text) });
          }
          this.follow(r.id, now, { out: 'Réponse envoyée depuis Gmail : devis passé en « Devis envoyé ».', in: 'Réponse du client lue dans Gmail : « Réponse reçue ».' });
        }
        return { ok: true, imported, incoming };
      }
      case 'quote/status': {
        const r = this.request(b.id);
        if (!r) return { ok: false, error: 'Demande introuvable.' };
        const amount = amountOf(b.amount);
        if (amount !== null && amount !== r.amount) this.run('UPDATE requests SET amount = ? WHERE id = ?', amount, r.id);
        if (Object.hasOwn(QUOTE_STATUS, b.status) && b.status !== r.status) this.setStatus(r.id, b.status, now, `Statut changé à l’atelier : ${QUOTE_STATUS[b.status]}.`);
        return { ok: true };
      }
      // ------------------------------------------------ one appointment, changed in the space
      case 'booking/get':
        return { booking: this.one('SELECT b.*, c.first, c.last, c.phone, c.email, c.vehicles AS client_vehicles FROM bookings b LEFT JOIN clients c ON c.id = b.client_id WHERE b.session = ?', clip(b.session, 120)) };
      // services added at the workshop (or taken off again): the total follows, what is paid stays
      case 'booking/lines': {
        const row = this.one('SELECT * FROM bookings WHERE session = ?', clip(b.session, 120));
        if (!row) return { ok: false, error: 'Rendez-vous introuvable.' };
        const items = (() => {
          try {
            return JSON.parse(row.items || '[]');
          } catch {
            return [];
          }
        })();
        if (b.add) {
          const label = clip(b.add.label, 80);
          const price = Math.round((Number(b.add.price) || 0) * 100) / 100;
          if (!label) return { ok: false, error: 'Écrivez la prestation ajoutée.' };
          if (!(price >= 0) || price > 20000) return { ok: false, error: 'Prix à vérifier.' };
          if (items.filter((i) => i.added).length >= 12) return { ok: false, error: 'Trop de prestations ajoutées.' };
          items.push({ label, detail: clip(b.add.detail, 80), price, added: now, minutes: Math.max(0, Math.min(600, Math.round(Number(b.add.minutes) || 0))), lengthened: !!b.add.lengthened });
        }
        let removed = null;
        if (b.remove != null) {
          const i = Number(b.remove);
          if (!items[i]?.added) return { ok: false, error: 'Seules les prestations ajoutées à l’atelier se retirent.' };
          removed = items.splice(i, 1)[0];
        }
        const total = Math.round(items.reduce((a, i) => a + (Number(i.price) || 0), 0) * 100) / 100 - (Number(row.discount) || 0);
        // the time of the appointment: what was added to it in the calendar, or taken back
        const minutes = Math.max(0, (Number(row.minutes) || 0) + (b.add?.lengthened ? Number(items.at(-1).minutes) || 0 : 0) - (removed?.lengthened ? Number(removed.minutes) || 0 : 0));
        this.run('UPDATE bookings SET items = ?, total = ?, minutes = ? WHERE session = ?', JSON.stringify(items).slice(0, 4000), Math.max(0, Math.round(total * 100) / 100), minutes, row.session);
        return { ok: true, removed, booking: this.one('SELECT b.*, c.first, c.last, c.phone, c.email FROM bookings b LEFT JOIN clients c ON c.id = b.client_id WHERE b.session = ?', row.session) };
      }
      // a deposit paid for the services added (Stripe, booking/worker.js): added once to what is paid
      case 'booking/payment': {
        const row = this.one('SELECT * FROM bookings WHERE session = ?', clip(b.session, 120));
        if (!row) return { ok: false, error: 'Rendez-vous introuvable.' };
        const payments = (() => {
          try {
            return JSON.parse(row.payments || '[]');
          } catch {
            return [];
          }
        })();
        if (payments.some((p) => p.ref === b.ref)) return { ok: true, again: true, booking: row };
        const amount = Math.round((Number(b.amount) || 0) * 100) / 100;
        payments.push({ ref: clip(b.ref, 120), amount, at: now });
        this.run('UPDATE bookings SET paid = ?, payments = ? WHERE session = ?', Math.round((row.paid + amount) * 100) / 100, JSON.stringify(payments), row.session);
        return { ok: true, booking: this.one('SELECT b.*, c.first, c.last, c.phone, c.email FROM bookings b LEFT JOIN clients c ON c.id = b.client_id WHERE b.session = ?', row.session) };
      }
      case 'bookings/list': {
        const where = b.from ? 'WHERE b.date BETWEEN ? AND ?' : '';
        const args = b.from ? [b.from, b.to] : [];
        return { bookings: this.all(`SELECT b.*, c.first, c.last, c.phone, c.email FROM bookings b LEFT JOIN clients c ON c.id = b.client_id ${where} ORDER BY b.date ${b.desc ? 'DESC' : 'ASC'}, b.time ${b.desc ? 'DESC' : 'ASC'} LIMIT ${Math.min(500, Number(b.limit) || 200)}`, ...args) };
      }
      case 'clients/list': {
        const q = `%${clip(b.q, 60).toLowerCase()}%`;
        const rows = this.all(
          `SELECT c.*, (SELECT COUNT(*) FROM bookings WHERE client_id = c.id) AS n_bookings, (SELECT COALESCE(SUM(paid), 0) FROM bookings WHERE client_id = c.id) AS paid, (SELECT COUNT(*) FROM requests WHERE client_id = c.id) AS n_requests, (SELECT code FROM codes WHERE client_id = c.id ORDER BY created DESC LIMIT 1) AS referral,
            (SELECT number FROM members m WHERE m.client_id = c.id OR (m.email <> '' AND m.email = c.email) ORDER BY m.expires DESC LIMIT 1) AS premium,
            (SELECT expires FROM members m WHERE m.client_id = c.id OR (m.email <> '' AND m.email = c.email) ORDER BY m.expires DESC LIMIT 1) AS premium_until
           FROM clients c WHERE ? = '%%' OR lower(c.first || ' ' || c.last || ' ' || c.email || ' ' || c.phone || ' ' || c.vehicles || ' ' || c.plate) LIKE ? ORDER BY c.last_seen DESC LIMIT ${b.all ? 5000 : 300}`,
          q,
          q
        );
        return { clients: rows, total: this.one('SELECT COUNT(*) AS n FROM clients').n };
      }
      case 'client/get':
        return { client: this.clientCard(Number(b.id)) };
      case 'client/save': {
        const c = b.client || {};
        if (!clip(c.firstName, 60) && !clip(c.lastName, 60)) return { ok: false, error: 'Indiquez au moins le prénom ou le nom.' };
        if (b.id) {
          this.run('UPDATE clients SET first = ?, last = ?, email = ?, phone = ?, vehicles = ?, plate = ?, source = ?, notes = ? WHERE id = ?', clip(c.firstName, 60), clip(c.lastName, 60), clip(c.email, 120).toLowerCase(), clip(c.phone, 30), clip(c.vehicles, 300), clip(c.plate, 15).toUpperCase(), clip(c.source, 180), String(c.notes || '').trim().slice(0, 2000), Number(b.id));
          return { ok: true, id: Number(b.id) };
        }
        this.run('INSERT INTO clients (first, last, email, phone, vehicles, plate, source, notes, origin, created, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', clip(c.firstName, 60), clip(c.lastName, 60), clip(c.email, 120).toLowerCase(), clip(c.phone, 30), clip(c.vehicles, 300), clip(c.plate, 15).toUpperCase(), clip(c.source, 180), String(c.notes || '').trim().slice(0, 2000), 'ajouté à l’atelier', now, now);
        return { ok: true, id: this.one('SELECT last_insert_rowid() AS id').id };
      }
      case 'client/delete': {
        const id = Number(b.id);
        this.forget(this.all('SELECT id FROM requests WHERE client_id = ?', id).map((r) => r.id));
        this.run('UPDATE bookings SET client_id = 0 WHERE client_id = ?', id);
        this.run('UPDATE codes SET client_id = 0, email = ? WHERE client_id = ?', '', id);
        this.run('DELETE FROM clients WHERE id = ?', id);
        return { ok: true };
      }
      case 'clients/purge': {
        // 3 years after the last contact (CNIL guidance for client files)
        const limit = now - KEEP_CLIENTS_DAYS * DAY;
        const old = this.all('SELECT id FROM clients WHERE last_seen < ?', limit);
        for (const { id } of old) this.route('client/delete', { id }, now);
        return { ok: true, removed: old.length };
      }
      case 'summary': {
        this.age(now);
        const from = String(b.from);
        const to = String(b.to);
        return {
          bookings: this.one('SELECT COUNT(*) AS n, COALESCE(SUM(paid), 0) AS paid, COALESCE(SUM(total - paid), 0) AS due, COALESCE(SUM(discount), 0) AS discount FROM bookings WHERE live = 1 AND date(created / 1000, ?) >= ? AND date(created / 1000, ?) <= ?', 'unixepoch', from, 'unixepoch', to),
          clients: this.one('SELECT COUNT(*) AS n FROM clients WHERE created BETWEEN ? AND ?', dayStart(from), dayEnd(to)).n,
          requests: this.one('SELECT COUNT(*) AS n FROM requests WHERE at BETWEEN ? AND ?', dayStart(from), dayEnd(to)).n,
          quotes: {
            open: this.one("SELECT COUNT(*) AS n FROM requests WHERE status = 'nouveau'").n,
            reply: this.one("SELECT COUNT(*) AS n FROM requests WHERE status = 'reponse'").n,
            sent: this.one("SELECT COUNT(*) AS n FROM requests WHERE status = 'envoye'").n,
            lost: this.one("SELECT COUNT(*) AS n FROM requests WHERE status = 'sans_suite' AND status_at BETWEEN ? AND ?", dayStart(from), dayEnd(to)).n,
            unread: this.one('SELECT COUNT(*) AS n FROM requests WHERE unread > 0').n,
            won: this.one("SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS amount FROM requests WHERE status = 'valide' AND status_at BETWEEN ? AND ?", dayStart(from), dayEnd(to)),
          },
          totalClients: this.one('SELECT COUNT(*) AS n FROM clients').n,
          promoUses: this.all("SELECT code, COUNT(*) AS n FROM bookings WHERE code_kind = 'promo' AND date(created / 1000, ?) BETWEEN ? AND ? GROUP BY code", 'unixepoch', from, to),
        };
      }
      // ------------------------------------------------ sign-in codes
      case 'login/new': {
        const recent = this.one('SELECT COUNT(*) AS n FROM logins WHERE created > ?', now - 3600000).n;
        if (recent >= 6) return { ok: false, error: 'Trop de codes demandés : réessayez dans une heure.' };
        this.run('INSERT INTO logins (hash, created, expires) VALUES (?, ?, ?)', String(b.hash), now, now + 10 * 60000);
        return { ok: true };
      }
      case 'login/check': {
        const r = this.one('SELECT * FROM logins WHERE used = 0 AND expires > ? ORDER BY created DESC LIMIT 1', now);
        if (!r) return { ok: false, error: 'Code expiré : demandez-en un nouveau.' };
        if (r.attempts >= 5) return { ok: false, error: 'Trop d’essais : demandez un nouveau code.' };
        if (r.hash !== String(b.hash)) {
          this.run('UPDATE logins SET attempts = attempts + 1 WHERE id = ?', r.id);
          return { ok: false, error: 'Code incorrect.' };
        }
        this.run('UPDATE logins SET used = 1 WHERE id = ?', r.id);
        this.run('DELETE FROM logins WHERE created < ?', now - 7 * DAY);
        return { ok: true };
      }
      // ------------------------------------------------ appointments taken by the workshop (links)
      case 'link/add': {
        const canal = b.canal === 'atelier' ? 'atelier' : 'telephone';
        const clientId = this.upsertClient(b.customer || {}, now, canal === 'atelier' ? 'RDV pris à l’atelier' : 'RDV pris par téléphone');
        this.run(
          'INSERT INTO links (session, client_id, event, date, time, minutes, items, total, due, mode, url, expires, status, vehicle, created, canal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          clip(b.session, 120), clientId, clip(b.event, 200), clip(b.date, 10), clip(b.time, 5), Number(b.minutes) || 0, JSON.stringify(b.items || []).slice(0, 2000), Number(b.total) || 0, Number(b.due) || 0, clip(b.mode, 10), clip(b.url, 1000), Number(b.expires) || 0, clip(b.status, 12) || 'attente', clip(b.customer?.vehicle, 80), now, canal
        );
        return { ok: true, id: this.one('SELECT last_insert_rowid() AS id').id, clientId };
      }
      case 'link/get':
        return { link: this.one('SELECT l.*, c.first, c.last, c.email, c.phone FROM links l LEFT JOIN clients c ON c.id = l.client_id WHERE l.id = ?', Number(b.id) || 0) };
      case 'links/list': {
        // the waiting links past their time: expired (the slot was freed by Stripe's notice)
        this.run("UPDATE links SET status = 'expire' WHERE status = 'attente' AND expires > 0 AND expires < ?", now);
        return { links: this.all('SELECT l.*, c.first, c.last, c.email, c.phone FROM links l LEFT JOIN clients c ON c.id = l.client_id ORDER BY l.created DESC LIMIT ?', Math.min(200, Number(b.limit) || 50)) };
      }
      case 'link/status':
        this.run('UPDATE links SET status = ? WHERE (id = ? OR (session = ? AND session <> \'\')) AND status = \'attente\'', clip(b.status, 12), Number(b.id) || 0, clip(b.session, 120));
        return { ok: true };
      // ------------------------------------------------ the workshop's devices (notifications)
      case 'push/add': {
        const endpoint = String(b.endpoint || '');
        if (!/^https:\/\/[^\s]+$/.test(endpoint) || endpoint.length > 1000 || !/^[A-Za-z0-9_-]{60,120}$/.test(String(b.p256dh || '')) || !/^[A-Za-z0-9_-]{12,40}$/.test(String(b.auth || ''))) return { ok: false, error: 'Abonnement illisible.' };
        this.run('INSERT INTO push_subs (endpoint, p256dh, auth, label, created) VALUES (?, ?, ?, ?, ?) ON CONFLICT (endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, label = excluded.label', endpoint, String(b.p256dh), String(b.auth), clip(b.label, 60), now);
        // 10 devices at most: the oldest go
        this.run('DELETE FROM push_subs WHERE endpoint NOT IN (SELECT endpoint FROM push_subs ORDER BY created DESC LIMIT 10)');
        return { ok: true, n: this.one('SELECT COUNT(*) AS n FROM push_subs').n };
      }
      case 'push/list':
        return { subs: this.all('SELECT * FROM push_subs ORDER BY created DESC') };
      case 'push/remove':
        this.run('DELETE FROM push_subs WHERE endpoint = ?', String(b.endpoint || ''));
        return { ok: true };
      // ------------------------------------------------ gift cards (content/offers.js)
      // a card paid (Stripe: once for each payment) or made at the workshop (sold at the counter, offered)
      case 'gift/create': {
        const session = clip(b.session, 120);
        const known = session ? this.one('SELECT * FROM gifts WHERE session = ?', session) : null;
        if (known) return { ok: true, again: true, card: this.publicCard(known, now), row: known };
        const amount = round2(b.amount);
        if (!(amount >= 1 && amount <= 5000)) return { ok: false, error: 'Montant de la carte à vérifier.' };
        let code = cardCode(GIFT_PREFIX);
        while (this.one('SELECT code FROM gifts WHERE code = ?', code)) code = cardCode(GIFT_PREFIX);
        const buyer = b.buyer || {};
        const clientId = buyer.email || buyer.phone ? this.upsertClient({ firstName: buyer.firstName, lastName: buyer.lastName, email: buyer.email, phone: buyer.phone }, now, 'carte cadeau') : 0;
        const look = G.looks.some((l) => l.id === b.look) ? b.look : G.looks[0].id;
        const delivery = b.delivery === 'destinataire' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clip(b.toEmail, 120)) ? 'destinataire' : 'moi';
        const sendOn = delivery === 'destinataire' && /^\d{4}-\d{2}-\d{2}$/.test(String(b.sendOn || '')) ? String(b.sendOn) : '';
        this.run(
          'INSERT INTO gifts (code, token, amount, balance, look, to_name, to_email, sender, message, delivery, send_on, buyer_first, buyer_last, buyer_email, buyer_phone, client_id, session, paid, source, note, live, created, expires) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          code, hex(12), amount, amount, look, clip(b.toName, 60), delivery === 'destinataire' ? clip(b.toEmail, 120).toLowerCase() : '', clip(b.sender, 80), String(b.message || '').replace(/\r\n?/g, '\n').trim().slice(0, G.messageMax),
          delivery, sendOn, clip(buyer.firstName, 60), clip(buyer.lastName, 60), clip(buyer.email, 120).toLowerCase(), clip(buyer.phone, 30), clientId, session, round2(b.paid ?? amount), clip(b.source, 20) || 'site', clip(b.note, 200), b.live === false ? 0 : 1, now, monthsAfter(now, G.months)
        );
        const row = this.one('SELECT * FROM gifts WHERE code = ?', code);
        return { ok: true, card: this.publicCard(row, now), row };
      }
      case 'gift/get': {
        const g = this.one('SELECT * FROM gifts WHERE code = ?', referralCode(b.code));
        return { gift: g ? { ...g, available: this.available(g, now), card: this.publicCard(g, now) } : null };
      }
      // the confirmation page after the payment, or the card's own page (its key)
      case 'gift/public': {
        const g = b.session ? this.one('SELECT * FROM gifts WHERE session = ?', clip(b.session, 120)) : this.one('SELECT * FROM gifts WHERE code = ?', referralCode(b.code));
        if (!g || (!b.session && String(b.t || '') !== g.token)) return { ok: false, error: 'Cette carte cadeau est introuvable : vérifiez le lien.' };
        return { ok: true, card: this.publicCard(g, now) };
      }
      // the part of a card set aside while its holder pays the rest (Stripe), until `expires`
      case 'gift/hold': {
        const g = this.one('SELECT * FROM gifts WHERE code = ?', referralCode(b.code));
        const st = this.giftStatus(g, now);
        if (!st?.ok) return st || { ok: false, error: 'Cette carte cadeau n’existe pas.' };
        const amount = round2(b.amount);
        if (amount > this.available(g, now, b.ref) + 0.001) return { ok: false, error: 'Le solde de la carte cadeau a changé : rechargez la page.' };
        this.run('INSERT INTO gift_holds (ref, code, amount, expires) VALUES (?, ?, ?, ?) ON CONFLICT (ref) DO UPDATE SET code = excluded.code, amount = excluded.amount, expires = excluded.expires', clip(b.ref, 120), g.code, amount, Number(b.expires) || now + 3600000);
        return { ok: true };
      }
      case 'gift/release':
        this.run('DELETE FROM gift_holds WHERE ref = ?', clip(b.ref, 120));
        return { ok: true };
      case 'gift/use':
        return this.giftUse(b, now);
      case 'gifts/list': {
        const rows = this.all('SELECT * FROM gifts ORDER BY created DESC LIMIT 500');
        const live = rows.filter((g) => g.live);
        return {
          gifts: rows.map((g) => ({ ...g, available: this.available(g, now), status: g.expires < now ? 'expiree' : g.balance < 0.01 ? 'epuisee' : 'active' })),
          sold: { n: live.length, amount: round2(live.reduce((a, g) => a + g.amount, 0)), paid: round2(live.reduce((a, g) => a + g.paid, 0)) },
          // still to be spent at the workshop (the cards not expired)
          outstanding: round2(live.filter((g) => g.expires >= now).reduce((a, g) => a + g.balance, 0)),
        };
      }
      // the cards to e-mail to their recipient today (the morning job, booking/worker.js)
      case 'gifts/due':
        return { gifts: this.all("SELECT * FROM gifts WHERE delivery = 'destinataire' AND sent = 0 AND to_email <> '' AND send_on <= ? ORDER BY created", String(b.date || '')) };
      case 'gift/sent':
        this.run('UPDATE gifts SET sent = ? WHERE code = ?', now, referralCode(b.code));
        return { ok: true };
      // ------------------------------------------------ SOLAR CAR Premium
      // a membership paid (Stripe, once for each payment) or taken at the workshop: a new card, or
      // the same one extended by a year (renewal)
      case 'member/join': {
        const ref = clip(b.ref, 120);
        const paid = ref ? this.one('SELECT * FROM member_payments WHERE ref = ?', ref) : null;
        if (paid) {
          const m = this.one('SELECT * FROM members WHERE number = ?', paid.number);
          return { ok: true, again: true, member: m, renewed: false };
        }
        const email = clip(b.email, 120).toLowerCase();
        if (!clip(b.firstName, 60) && !clip(b.lastName, 60)) return { ok: false, error: 'Indiquez le nom du membre.' };
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'Adresse e-mail à vérifier.' };
        const clientId = this.upsertClient({ firstName: b.firstName, lastName: b.lastName, email, phone: b.phone }, now, 'carte Premium');
        const known = this.memberOf({ email, clientId }, now);
        let number;
        let renewed = false;
        if (known) {
          number = known.number;
          renewed = true;
          this.run('UPDATE members SET starts = ?, expires = ?, reminded = 0, news = ?, client_id = ?, first = ?, last = ?, phone = ?, email = ?, live = ? WHERE number = ?', known.active ? known.starts : now, monthsAfter(Math.max(now, known.expires), P.months), b.news === false ? 0 : 1, clientId, clip(b.firstName, 60) || known.first, clip(b.lastName, 60) || known.last, clip(b.phone, 30) || known.phone, email || known.email, b.live === false ? 0 : 1, number);
        } else {
          number = cardCode(PREMIUM_PREFIX);
          while (this.one('SELECT number FROM members WHERE number = ?', number)) number = cardCode(PREMIUM_PREFIX);
          this.run('INSERT INTO members (number, token, client_id, first, last, email, phone, since, starts, expires, news, source, live, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', number, hex(12), clientId, clip(b.firstName, 60), clip(b.lastName, 60), email, clip(b.phone, 30), now, now, monthsAfter(now, P.months), b.news === false ? 0 : 1, clip(b.source, 20) || 'site', b.live === false ? 0 : 1, now);
        }
        this.run('INSERT INTO member_payments (ref, number, amount, at, source) VALUES (?, ?, ?, ?, ?)', ref || `atelier-${now}-${hex(3)}`, number, round2(b.amount), now, clip(b.source, 20) || 'site');
        return { ok: true, member: this.one('SELECT * FROM members WHERE number = ?', number), renewed };
      }
      // the member's card (the site), by the payment just made or by the card's own link
      case 'member/public': {
        const ref = b.session ? this.one('SELECT number FROM member_payments WHERE ref = ?', clip(b.session, 120)) : null;
        const m = ref ? this.one('SELECT * FROM members WHERE number = ?', ref.number) : !b.session ? this.one('SELECT * FROM members WHERE number = ?', referralCode(b.number)) : null;
        if (!m || (!b.session && String(b.t || '') !== m.token)) return { ok: false, error: 'Carte Premium introuvable : vérifiez le lien.' };
        return { ok: true, member: this.publicMember(m, now, b.today) };
      }
      case 'member/of': {
        const m = this.memberOf({ email: b.email, clientId: b.clientId }, now);
        return { member: m ? { ...m, ...this.memberState(m) } : null };
      }
      case 'members/list': {
        const rows = this.all('SELECT * FROM members ORDER BY expires DESC LIMIT 1000').map((m) => ({ ...m, active: m.expires >= now, ...this.memberState(m) }));
        const paid = this.one("SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS amount FROM member_payments WHERE ref NOT LIKE 'cs_test_%'");
        return { members: rows, active: rows.filter((m) => m.active).length, payments: { n: paid.n, amount: round2(paid.amount) } };
      }
      // how many gifts wait at the workshop (the home of the space)
      case 'members/pending':
        return { n: this.all("SELECT gifts FROM members WHERE gifts <> '[]'").reduce((a, m) => a + jsonList(m.gifts).filter((g) => !g.given).length, 0) };
      // a tier's gift handed over at the workshop (or taken back: given false)
      case 'member/gift': {
        const m = this.one('SELECT * FROM members WHERE number = ?', referralCode(b.number));
        if (!m) return { ok: false, error: 'Membre introuvable.' };
        const gifts = jsonList(m.gifts).map((x) => (x.tier === b.tier ? { ...x, given: b.given === false ? 0 : now } : x));
        this.run('UPDATE members SET gifts = ? WHERE number = ?', JSON.stringify(gifts), m.number);
        return { ok: true };
      }
      // the offers by e-mail: off from the link of an e-mail (its key), on or off from the space
      case 'member/news': {
        const m = this.one('SELECT * FROM members WHERE number = ?', referralCode(b.number));
        if (!m || (!b.workshop && String(b.t || '') !== m.token)) return { ok: false, error: 'Lien non valable.' };
        this.run('UPDATE members SET news = ? WHERE number = ?', b.on ? 1 : 0, m.number);
        return { ok: true, first: m.first };
      }
      // the members who get the offers by e-mail (active, not opted out)
      case 'members/mailing':
        return { members: this.all("SELECT number, token, first, last, email FROM members WHERE expires >= ? AND news = 1 AND email <> '' ORDER BY first", now) };
      // the cards ending within `days` days, not reminded yet (the morning job)
      case 'members/expiring':
        return { members: this.all("SELECT * FROM members WHERE expires >= ? AND expires < ? AND reminded = 0 AND email <> ''", now, now + (Number(b.days) || P.remindDays) * DAY) };
      case 'member/reminded':
        this.run('UPDATE members SET reminded = ? WHERE number = ?', now, referralCode(b.number));
        return { ok: true };
      // « Retrouver ma carte »: the member of an e-mail (the link is e-mailed to that address only)
      case 'member/find': {
        const m = this.memberOf({ email: b.email }, now);
        return { member: m ? { number: m.number, token: m.token, first: m.first, email: m.email, active: m.active, expires: m.expires } : null };
      }
      case 'setting/get':
        return { value: this.setting(String(b.key), null) };
      case 'setting/set':
        this.set(String(b.key), b.value);
        return { ok: true };
    }
    return undefined;
  }
}
