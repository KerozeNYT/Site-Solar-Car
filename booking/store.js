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
 *
 * Each call is one request to the object, run on its own: a code checked and used, a client found
 * or added, can never be done twice at the same time.
 */
import { bookingRules as R, referralCode, howHeardText } from '../content/booking.js';
import { promoSeeds, bannerSeeds } from '../content/promos.js';
import { services as SERVICES } from '../content/site.js';
import { zonedToUtc, addDays } from './schedule.js';
import { sendQuoteMails } from './mail.js';

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

const stub = (env) => env.ATELIER.get(env.ATELIER.idFromName('solarcar37'));
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
      return { filename, content, size: Math.floor((content.length * 3) / 4) };
    })
    .filter(Boolean);
}

const digits = (p) => String(p || '').replace(/\D/g, '').slice(-9);

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
    x('CREATE INDEX IF NOT EXISTS bookings_date ON bookings (date)');
    x(`CREATE TABLE IF NOT EXISTS requests (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL, services TEXT NOT NULL DEFAULT '', vehicle TEXT NOT NULL DEFAULT '', wish TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '')`);
    x('CREATE INDEX IF NOT EXISTS requests_client ON requests (client_id)');
    x('CREATE TABLE IF NOT EXISTS logins (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0)');
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
    return { ok: true, kind: 'promo', code: p.code, label: `Code ${p.code}`, percent: p.percent || 0, amount: p.amount || 0, services: p.services ? p.services.split(',') : [], expires: p.expires };
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
    };
  }

  // ---------------------------------------------------------------- requests
  async fetch(req) {
    const path = new URL(req.url).pathname.slice(1);
    // a quote request from the site's form: its photos are heavy, read and sent from here
    if (path === 'quote/submit') return Response.json(await this.quote(req));
    const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
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
    if (!env.RESEND_API_KEY || !env.NOTIFY_TO) {
      this.run('DELETE FROM requests WHERE id = ?', requestId);
      console.error('[quote] no e-mail settings (RESEND_API_KEY, NOTIFY_TO)');
      return { ok: false, status: 503, error: 'Envoi indisponible.' };
    }
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
      return { ok: true, ack: sent.client };
    } catch (err) {
      console.error('[quote] workshop e-mail', err.message);
      this.run('DELETE FROM requests WHERE id = ?', requestId);
      return { ok: false, status: 502, error: 'L’envoi n’a pas abouti.' };
    }
  }

  /** the line written above a request about the code typed in it, checked the day it arrives */
  async codeLine(raw, now) {
    const code = referralCode(raw);
    if (!code) return '';
    const r = this.route('code/check', { code, now }, now);
    if (!r) return `Code ${code} : à vérifier`;
    if (!r.ok) return `Code ${code} non valable le jour de la demande : ${r.error}`;
    return r.kind === 'promo'
      ? `Code promo ${r.code} valable le jour de la demande : ${r.percent ? `−${r.percent} %` : `−${r.amount} €`}`
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
        const percent = Math.max(0, Math.min(90, Number(b.percent) || 0));
        const amount = Math.max(0, Math.min(1000, Number(b.amount) || 0));
        if (!percent && !amount) return { ok: false, error: 'Indiquez une remise : un pourcentage ou un montant.' };
        if (!b.starts || !b.ends || b.ends < b.starts) return { ok: false, error: 'Indiquez les dates : du … au … (la fin après le début).' };
        const services = (Array.isArray(b.services) ? b.services : []).filter((s) => ['tint', 'lights'].includes(s));
        const known = this.one('SELECT * FROM promos WHERE code = ?', code);
        if (known && !b.update) return { ok: false, error: `Le code ${code} existe déjà : modifiez-le dans la liste.` };
        const values = [clip(b.label, 60), percent, percent ? 0 : amount, services.join(','), Math.max(0, Math.floor(Number(b.maxUses) || 0)), dayStart(b.starts), dayEnd(b.ends)];
        if (known) this.run('UPDATE promos SET label = ?, percent = ?, amount = ?, services = ?, max_uses = ?, starts = ?, expires = ? WHERE code = ?', ...values, code);
        else this.run('INSERT INTO promos (label, percent, amount, services, max_uses, starts, expires, code, active, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)', ...values, code, now);
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
        this.run(
          'INSERT INTO bookings (session, client_id, event, date, time, minutes, items, total, discount, code, code_kind, mode, paid, vehicle, live, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          clip(b.session, 120), id, clip(b.event, 120), clip(b.date, 10), clip(b.time, 5), Number(b.minutes) || 0, JSON.stringify(b.items || []).slice(0, 2000), Number(b.total) || 0, Number(b.discount) || 0, referralCode(b.code), clip(b.codeKind, 20), clip(b.mode, 10), Number(b.paid) || 0, clip(b.customer?.vehicle, 80), b.live === false ? 0 : 1, Number(b.created) || now
        );
        return { ok: true, clientId: id };
      }
      case 'request/add': {
        const id = this.upsertClient(b.customer || {}, now, 'demande de devis');
        this.run('INSERT INTO requests (client_id, at, services, vehicle, wish, message, source) VALUES (?, ?, ?, ?, ?, ?, ?)', id, now, clip(b.services, 300), clip(b.customer?.vehicle, 80), clip(b.wish, 120), String(b.message || '').trim().slice(0, 2000), clip(b.customer?.source, 180));
        return { ok: true, clientId: id, requestId: this.one('SELECT last_insert_rowid() AS id').id };
      }
      case 'bookings/list': {
        const where = b.from ? 'WHERE b.date BETWEEN ? AND ?' : '';
        const args = b.from ? [b.from, b.to] : [];
        return { bookings: this.all(`SELECT b.*, c.first, c.last, c.phone, c.email FROM bookings b LEFT JOIN clients c ON c.id = b.client_id ${where} ORDER BY b.date ${b.desc ? 'DESC' : 'ASC'}, b.time ${b.desc ? 'DESC' : 'ASC'} LIMIT ${Math.min(500, Number(b.limit) || 200)}`, ...args) };
      }
      case 'clients/list': {
        const q = `%${clip(b.q, 60).toLowerCase()}%`;
        const rows = this.all(
          `SELECT c.*, (SELECT COUNT(*) FROM bookings WHERE client_id = c.id) AS n_bookings, (SELECT COALESCE(SUM(paid), 0) FROM bookings WHERE client_id = c.id) AS paid, (SELECT COUNT(*) FROM requests WHERE client_id = c.id) AS n_requests, (SELECT code FROM codes WHERE client_id = c.id ORDER BY created DESC LIMIT 1) AS referral
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
        this.run('DELETE FROM requests WHERE client_id = ?', id);
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
        const from = String(b.from);
        const to = String(b.to);
        return {
          bookings: this.one('SELECT COUNT(*) AS n, COALESCE(SUM(paid), 0) AS paid, COALESCE(SUM(total - paid), 0) AS due, COALESCE(SUM(discount), 0) AS discount FROM bookings WHERE live = 1 AND date(created / 1000, ?) >= ? AND date(created / 1000, ?) <= ?', 'unixepoch', from, 'unixepoch', to),
          clients: this.one('SELECT COUNT(*) AS n FROM clients WHERE created BETWEEN ? AND ?', dayStart(from), dayEnd(to)).n,
          requests: this.one('SELECT COUNT(*) AS n FROM requests WHERE at BETWEEN ? AND ?', dayStart(from), dayEnd(to)).n,
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
      case 'setting/get':
        return { value: this.setting(String(b.key), null) };
      case 'setting/set':
        this.set(String(b.key), b.value);
        return { ok: true };
    }
    return undefined;
  }
}
