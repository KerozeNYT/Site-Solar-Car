/**
 * The countdown of a promo campaign (content/promos.js): the offer ends on its last day at 23:59
 * in Paris (midnight: the code is no longer accepted by the booking server).
 *   « Plus que 5 jours » (days left, today included), then on the last day « Dernier jour : plus
 *   que 2 h 48 min 12 s », to the second.
 */
import { zonedToUtc, addDays } from '../../booking/schedule.js';
import { promos } from '../../content/promos.js';

const TZ = 'Europe/Paris';
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
// no line break inside "23 h 59", "7 jours", "48 min 12 s"
const NB = '\u00a0';

export const promoOf = (code) => promos.find((p) => p.code === String(code || '').toUpperCase().replace(/[^A-Z0-9-]/g, '')) || null;
/** the first and the last instant of the offer (UTC ms): its first day 0:00, the day after its last day 0:00 */
export const promoStart = (p) => zonedToUtc(p.from, '00:00', TZ);
export const promoEnd = (p) => zonedToUtc(addDays(p.to, 1), '00:00', TZ);
/** "24 décembre à 23 h 59" */
export const deadlineText = (p) => `${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${p.to}T12:00:00Z`)).replace(/^1 /, '1er ').replace(' ', NB)} à 23${NB}h${NB}59`;

/** the time left, in words: « Plus que 5 jours », « Dernier jour : plus que 2 h 48 min 12 s », '' once over */
export function leftText(left) {
  if (left <= 0) return '';
  if (left > DAY) return `Plus que ${Math.ceil(left / DAY)}${NB}jours`;
  const s = Math.ceil(left / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const t = h ? `${h} h ${pad(m)} min ${pad(sec)} s` : m ? `${m} min ${pad(sec)} s` : `${sec} s`;
  return `Dernier jour${NB}: plus que ${t.replace(/ /g, NB)}`;
}

/**
 * Keeps `el`'s text on the time left until the end of offer `p` (every second on the last day,
 * at each new day before); `onEnd` once it is over. Returns a function that stops it.
 * `el` should carry role="timer" (never read aloud at each change).
 */
export function runCountdown(el, p, onEnd) {
  const end = promoEnd(p);
  let timer = 0;
  const tick = () => {
    const left = end - Date.now();
    el.textContent = leftText(left);
    if (left <= 0) return onEnd?.();
    // the next change: the next second on the last day, else the next day (or the last day's start)
    const wait = left <= DAY ? (left % 1000 || 1000) + 5 : Math.min(left - DAY, ((left - 1) % DAY) + 1) + 5;
    timer = setTimeout(tick, Math.min(wait, 3600000));
  };
  tick();
  return () => clearTimeout(timer);
}
