/**
 * Referral codes (« parrainage »): each client gets a personal code, worth
 * bookingRules.referral.amount EUR off one service for a friend (or for another car), usable once,
 * within bookingRules.referral.months months:
 *   - created for the client of an online booking with the e-mail sent a week after (booking/worker.js,
 *     dailyMails), or by the workshop for any client on its page (booking/referral-page.js);
 *   - used on the booking page (checked by GET /api/referral, kept when the payment is confirmed),
 *     or at the workshop (marked on its page).
 * One Durable Object (`Parrainage`) with its own SQLite database: a code is checked and used in one
 * step, so it can never be used twice.
 */
import { bookingRules as R, referralCode } from '../content/booking.js';

// no 0/O, 1/I: easy to read out and to type
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DAY = 86400000;

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

const stub = (env) => env.PARRAINAGE.get(env.PARRAINAGE.idFromName('solarcar37'));
async function call(env, path, body) {
  const res = await stub(env).fetch(`https://parrainage${path}`, body ? { method: 'POST', body: JSON.stringify(body) } : undefined);
  if (!res.ok) throw new Error(`parrainage ${res.status}`);
  return res.json();
}

/** the code of a client (the same one if it was already given for this origin: a booking's
 *  payment session, or « atelier-… » for a code made by the workshop) */
export const referralFor = (env, { owner, email = '', origin }, now = Date.now()) => call(env, '/create', { owner, email, origin, now });
/** { ok, code, owner, amount, expires } or { ok: false, error } */
export const checkReferral = (env, code, now = Date.now()) => call(env, '/check', { code: referralCode(code), now });
/** uses the code (once): { ok } or { ok: false, error }; using it again for the same booking is fine */
export const redeemReferral = (env, code, { by, ref, where }, now = Date.now()) => call(env, '/redeem', { code: referralCode(code), by, ref, where, now });
/** every code, newest first, with the figures */
export const listReferrals = (env) => call(env, '/list');

export class Parrainage {
  constructor(state) {
    this.sql = state.storage.sql;
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS codes (
        code TEXT PRIMARY KEY,
        owner TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        origin TEXT NOT NULL DEFAULT '',
        created INTEGER NOT NULL,
        expires INTEGER NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        used_by TEXT NOT NULL DEFAULT '',
        used_ref TEXT NOT NULL DEFAULT '',
        used_where TEXT NOT NULL DEFAULT ''
      )`
    );
    this.sql.exec('CREATE INDEX IF NOT EXISTS codes_origin ON codes (origin)');
  }

  row(code) {
    return this.sql.exec('SELECT * FROM codes WHERE code = ?', code).toArray()[0] || null;
  }

  status(r, now) {
    if (!r) return { ok: false, error: 'Ce code de parrainage n’existe pas : vérifiez-le.' };
    if (r.used) return { ok: false, error: 'Ce code de parrainage a déjà été utilisé.' };
    if (r.expires < now) return { ok: false, error: 'Ce code de parrainage a expiré.' };
    return { ok: true, code: r.code, owner: r.owner, amount: R.referral.amount, expires: r.expires };
  }

  async fetch(req) {
    const url = new URL(req.url);
    const b = req.method === 'POST' ? await req.json() : {};
    const now = Number(b.now) || Date.now();
    const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
    if (url.pathname === '/create') {
      const origin = clip(b.origin, 120);
      const known = origin ? this.sql.exec('SELECT * FROM codes WHERE origin = ? ORDER BY created DESC LIMIT 1', origin).toArray()[0] : null;
      if (known) return Response.json({ ok: true, code: known.code, owner: known.owner, amount: R.referral.amount, expires: known.expires, used: known.used });
      let code = newCode(b.owner);
      while (this.row(code)) code = newCode(b.owner);
      const expires = now + Math.round(R.referral.months * 30.44 * DAY);
      this.sql.exec('INSERT INTO codes (code, owner, email, origin, created, expires) VALUES (?, ?, ?, ?, ?, ?)', code, clip(b.owner, 60), clip(b.email, 120).toLowerCase(), origin, now, expires);
      return Response.json({ ok: true, code, owner: clip(b.owner, 60), amount: R.referral.amount, expires });
    }
    if (url.pathname === '/check') return Response.json(this.status(this.row(b.code), now));
    if (url.pathname === '/redeem') {
      const r = this.row(b.code);
      // the same booking confirmed twice (Stripe may notify twice): already counted, fine
      if (r?.used && r.used_ref && r.used_ref === clip(b.ref, 120)) return Response.json({ ok: true, again: true });
      const s = this.status(r, now);
      if (!s.ok) return Response.json(s);
      this.sql.exec('UPDATE codes SET used = ?, used_by = ?, used_ref = ?, used_where = ? WHERE code = ? AND used = 0', now, clip(b.by, 80), clip(b.ref, 120), clip(b.where, 40), r.code);
      return Response.json({ ok: true });
    }
    if (url.pathname === '/list') {
      const codes = this.sql.exec('SELECT * FROM codes ORDER BY created DESC LIMIT 300').toArray();
      const n = this.sql.exec('SELECT COUNT(*) AS given, SUM(used > 0) AS used, SUM(CASE WHEN used > 0 THEN 1 ELSE 0 END) * ? AS offered FROM codes', R.referral.amount).toArray()[0];
      return Response.json({ codes, given: n.given || 0, used: n.used || 0, offered: n.offered || 0 });
    }
    return new Response('not found', { status: 404 });
  }
}
