/**
 * The countdown of a promo code: its last day ends at 23:59 in Paris (at midnight the booking
 * server refuses the code).
 *   « Plus que 5 jours » (days left, today included), then on the last day « Dernier jour : plus
 *   que 2 h 48 min 12 s », to the second.
 * `end`: the first instant after the offer (UTC ms; the code's `expires` + 1, its last day + 1 at 0:00).
 */
const TZ = 'Europe/Paris';
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
// no line break inside "23 h 59", "7 jours", "48 min 12 s"
const NB = ' ';

/** "24 décembre à 23 h 59" (the last minute of the offer) */
export function deadlineText(end) {
  const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: TZ }).format(new Date(end - 60000));
  const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ }).format(new Date(end - 60000));
  return `${day.replace(/^1 /, '1er ').replace(' ', NB)} à ${time.replace(/^0(\d)/, '$1').replace(':', `${NB}h${NB}`)}`;
}

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
 * Keeps `el`'s text on the time left until `end` (every second on the last day, at each new day
 * before); `onEnd` once it is over. Returns a function that stops it. `el` should carry
 * role="timer" (never read aloud at each change).
 */
export function runCountdown(el, end, onEnd) {
  let timer = 0;
  const tick = () => {
    const left = end - Date.now();
    el.textContent = leftText(left);
    if (left <= 0) return onEnd?.();
    // the next change: the next second on the last day, else the next day (or the last day's start)
    const wait = left <= DAY ? (left % 1000 || 1000) + 5 : ((left - 1) % DAY) + 1 + 5;
    timer = setTimeout(tick, Math.min(wait, 3600000));
  };
  tick();
  return () => clearTimeout(timer);
}
