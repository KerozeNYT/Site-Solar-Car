/**
 * Booking server: which start times are free. Times are kept as UTC milliseconds; the workshop
 * lives in Europe/Paris (summer and winter time handled through Intl, no library).
 */

const pad = (n) => String(n).padStart(2, '0');

/** offset of a time zone from UTC at a given instant (minutes, +60 in Paris in winter) */
export function zoneOffset(ms, timeZone) {
  const s = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(new Date(ms)).find((p) => p.type === 'timeZoneName').value;
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(s);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0)) : 0;
}

/** UTC milliseconds of a local date ('2026-11-20') and time ('08:15') in a time zone */
export function zonedToUtc(date, time, timeZone) {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const local = Date.UTC(y, mo - 1, d, h, mi);
  let ms = local - zoneOffset(local, timeZone) * 60000;
  ms = local - zoneOffset(ms, timeZone) * 60000; // second pass: the offset at the real instant
  return ms;
}

/** the local date and time of an instant: { date: '2026-11-20', time: '08:15', weekday: 1-7 } */
export function utcToZoned(ms, timeZone) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value])
  );
  const weekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, weekday };
}

/** add days to a local date string */
export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

const weekdayOf = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1; // 1 = Monday
};

/** French public holidays of a year ('YYYY-MM-DD'), Easter by the anonymous Gregorian algorithm */
export function frenchHolidays(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = `${year}-${pad(month)}-${pad(day)}`;
  return new Set([
    `${year}-01-01`,
    addDays(easter, 1), // lundi de Pâques
    `${year}-05-01`,
    `${year}-05-08`,
    addDays(easter, 39), // Ascension
    addDays(easter, 50), // lundi de Pentecôte
    `${year}-07-14`,
    `${year}-08-15`,
    `${year}-11-01`,
    `${year}-11-11`,
    `${year}-12-25`,
  ]);
}

const minutesOf = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const timeOf = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/**
 * The working time of a job starting at `time` on `date`: segments inside the opening periods
 * (the lunch break is skipped), or null if it does not fit in that day.
 * Returns { segments: [[startMs, endMs]], start, end } (UTC ms; end = end of the last segment).
 */
export function jobSpan(date, time, minutes, rules) {
  const periods = rules.periods.map(([a, b]) => [minutesOf(a), minutesOf(b)]);
  let t = minutesOf(time);
  let left = minutes;
  const segments = [];
  let i = periods.findIndex(([a, b]) => t >= a && t < b);
  if (i < 0) return null;
  while (left > 0) {
    if (i >= periods.length) return null;
    const [a, b] = periods[i];
    if (t < a) t = a;
    const take = Math.min(left, b - t);
    if (take > 0) segments.push([zonedToUtc(date, timeOf(t), rules.timeZone), zonedToUtc(date, timeOf(t + take), rules.timeZone)]);
    left -= take;
    t += take;
    if (left > 0) i += 1;
  }
  return { segments, start: segments[0][0], end: segments[segments.length - 1][1] };
}

const overlaps = (a0, a1, busy) => busy.some(([b0, b1]) => a0 < b1 && b0 < a1);

/**
 * Free start times: for each local date from `from` over `days` days, the times at which a job
 * of `minutes` fits in the opening hours without touching a busy interval ([startMs, endMs]),
 * at least rules.noticeHours after `now` and within rules.horizonDays.
 * Returns [{ date, times: ['08:00', …] }] (days without any time are left out).
 */
export function freeStarts({ from, days, minutes, busy, now, rules }) {
  const earliest = now + rules.noticeHours * 3600000;
  const latest = now + rules.horizonDays * 86400000;
  const out = [];
  const holidays = new Map();
  for (let n = 0; n < days; n++) {
    const date = addDays(from, n);
    const year = Number(date.slice(0, 4));
    if (!holidays.has(year)) holidays.set(year, frenchHolidays(year));
    if (!rules.days.includes(weekdayOf(date)) || holidays.get(year).has(date)) continue;
    const times = [];
    const first = minutesOf(rules.periods[0][0]);
    const last = minutesOf(rules.periods[rules.periods.length - 1][1]);
    for (let t = first; t < last; t += rules.step) {
      const span = jobSpan(date, timeOf(t), minutes, rules);
      if (!span || span.start < earliest || span.start > latest) continue;
      if (span.segments.some(([a, b]) => overlaps(a, b, busy))) continue;
      times.push(timeOf(t));
    }
    if (times.length) out.push({ date, times });
  }
  return out;
}
