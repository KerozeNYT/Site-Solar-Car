/**
 * Promo codes of a campaign (`promos` of content/booking.js, e.g. NOEL15: 15 % off, 1st to 24
 * December): checked by the booking page and the quote form (GET /api/code), counted when a booking
 * is paid, or noted by the workshop for a service quoted with the code (booking/referral-page.js).
 *
 * The uses are kept in the referral codes' Durable Object (`Parrainage`, booking/referral.js), in
 * their own table: a booking whose payment page is open holds one use until the payment page
 * expires, so that a code limited to N uses can never be used N + 1 times.
 *
 * The dates are those of the booking (the payment page opened) or of the quote request, never of
 * the appointment: booked on 24 December for March, the discount is kept.
 */
import { bookingRules as R, promos, promoOf, referralCode, dayText } from '../content/booking.js';
import { utcToZoned } from './schedule.js';

/** is this campaign open on that day (`count`: its uses so far) */
export function promoState(p, now, count = 0) {
  if (!p) return { ok: false, error: 'Ce code n’existe pas : vérifiez-le.' };
  const today = utcToZoned(now, R.timeZone).date;
  if (today < p.from) return { ok: false, error: `Le code ${p.code} sera valable à partir du ${dayText(p.from)}.` };
  if (today > p.to) return { ok: false, error: `Le code ${p.code} n’est plus valable : l’offre s’est terminée le ${dayText(p.to)} à 23 h 59.` };
  if (p.uses != null && count >= p.uses) return { ok: false, error: `Le code ${p.code} a déjà servi ${p.uses} fois : l’offre est épuisée.` };
  return { ok: true, kind: 'promo', code: p.code, percent: p.percent, label: p.label, from: p.from, to: p.to, left: p.uses == null ? null : p.uses - count };
}

/** the table of the uses, in the Durable Object's database */
export function promoTable(sql) {
  sql.exec(
    `CREATE TABLE IF NOT EXISTS promo_uses (
      ref TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      state TEXT NOT NULL,
      until INTEGER NOT NULL DEFAULT 0,
      at INTEGER NOT NULL,
      who TEXT NOT NULL DEFAULT '',
      place TEXT NOT NULL DEFAULT '',
      detail TEXT NOT NULL DEFAULT '',
      total REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0
    )`
  );
  sql.exec('CREATE INDEX IF NOT EXISTS promo_uses_code ON promo_uses (code)');
}

/**
 * The Durable Object's promo routes (POST, JSON):
 *   /promo/check {code}                          valid now? (nothing kept)
 *   /promo/hold  {code, ref, until}              valid now: one use held until `until` (payment page open)
 *   /promo/use   {code, ref, who, place, detail, total, discount}
 *                                                a paid booking, or a use noted by the workshop
 *   /promo/list                                  every campaign with its figures and last uses
 */
export function promoRoute(sql, path, b, now) {
  const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const count = (code) => sql.exec("SELECT COUNT(*) AS n FROM promo_uses WHERE code = ? AND (state = 'used' OR until > ?)", code, now).toArray()[0].n;
  const p = promoOf(b.code);
  if (path === '/promo/check') return promoState(p, now, p ? count(p.code) : 0);
  if (path === '/promo/hold') {
    const ref = clip(b.ref, 120);
    if (!ref) return { ok: false, error: 'ref' };
    // payment pages that expired long ago are forgotten
    sql.exec("DELETE FROM promo_uses WHERE state = 'held' AND until < ?", now - 86400000);
    const s = promoState(p, now, p ? count(p.code) : 0);
    if (!s.ok) return s;
    sql.exec("INSERT OR REPLACE INTO promo_uses (ref, code, state, until, at) VALUES (?, ?, 'held', ?, ?)", ref, p.code, Number(b.until) || now, now);
    return s;
  }
  if (path === '/promo/use') {
    // no check of the dates here: a booking's price was set when its payment page opened, and the
    // workshop notes a use for a quote requested during the offer
    if (!p) return { ok: false, error: 'Ce code promo n’existe pas : vérifiez-le.' };
    const ref = clip(b.ref, 120);
    if (!ref) return { ok: false, error: 'ref' };
    sql.exec(
      `INSERT INTO promo_uses (ref, code, state, until, at, who, place, detail, total, discount) VALUES (?, ?, 'used', 0, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (ref) DO UPDATE SET state = 'used', until = 0, at = excluded.at, who = excluded.who, place = excluded.place, detail = excluded.detail, total = excluded.total, discount = excluded.discount`,
      ref,
      p.code,
      now,
      clip(b.who, 80),
      clip(b.place, 40),
      clip(b.detail, 160),
      Math.max(0, Number(b.total) || 0),
      Math.max(0, Number(b.discount) || 0)
    );
    return { ok: true, code: p.code, percent: p.percent };
  }
  if (path === '/promo/list') {
    return {
      promos: promos.map((x) => {
        const n = sql.exec("SELECT COUNT(*) AS used, SUM(place = 'réservation en ligne') AS online, SUM(total) AS total, SUM(discount) AS discount FROM promo_uses WHERE code = ? AND state = 'used'", x.code).toArray()[0];
        const last = sql.exec("SELECT * FROM promo_uses WHERE code = ? AND state = 'used' ORDER BY at DESC LIMIT 100", x.code).toArray();
        return { ...x, used: n.used || 0, online: n.online || 0, total: Math.round((n.total || 0) * 100) / 100, discount: Math.round((n.discount || 0) * 100) / 100, state: promoState(x, now, count(x.code)), last };
      }),
    };
  }
  return null;
}

// ------------------------------------------------------------------ the calls, from the worker
const stub = (env) => env.PARRAINAGE.get(env.PARRAINAGE.idFromName('solarcar37'));
async function call(env, path, body) {
  const res = await stub(env).fetch(`https://parrainage${path}`, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`promo ${res.status}`);
  return res.json();
}

/** { ok, kind: 'promo', code, percent, label, from, to, left } or { ok: false, error } */
export const checkPromo = (env, code, now = Date.now()) => call(env, '/promo/check', { code: referralCode(code), now });
/** the same, and one use held until `until` (the payment page's end) */
export const holdPromo = (env, code, { ref, until }, now = Date.now()) => call(env, '/promo/hold', { code: referralCode(code), ref, until, now });
/** a use counted (a paid booking: `ref` = its held use; at the workshop: a new ref) */
export const usePromo = (env, code, { ref, who, place, detail, total, discount }, now = Date.now()) => call(env, '/promo/use', { code: referralCode(code), ref, who, place, detail, total, discount, now });
/** every campaign with its figures */
export const listPromos = (env, now = Date.now()) => call(env, '/promo/list', { now });
