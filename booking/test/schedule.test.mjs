import test from 'node:test';
import assert from 'node:assert/strict';
import { zonedToUtc, utcToZoned, frenchHolidays, jobSpan, freeStarts } from '../schedule.js';
import { bookingRules as rules, quote, amountDue } from '../../content/booking.js';

const TZ = 'Europe/Paris';

test('Paris time, winter and summer', () => {
  assert.equal(new Date(zonedToUtc('2026-11-20', '08:00', TZ)).toISOString(), '2026-11-20T07:00:00.000Z');
  assert.equal(new Date(zonedToUtc('2026-07-01', '08:00', TZ)).toISOString(), '2026-07-01T06:00:00.000Z');
  // the night of the change (29 March 2026 at 2:00 -> 3:00)
  assert.equal(new Date(zonedToUtc('2026-03-30', '08:00', TZ)).toISOString(), '2026-03-30T06:00:00.000Z');
  assert.deepEqual(utcToZoned(Date.UTC(2026, 10, 20, 7, 15), TZ), { date: '2026-11-20', time: '08:15', weekday: 5 });
});

test('French public holidays', () => {
  const h = frenchHolidays(2027);
  for (const d of ['2027-01-01', '2027-03-29', '2027-05-01', '2027-05-06', '2027-05-17', '2027-07-14', '2027-11-11', '2027-12-25']) assert.ok(h.has(d), d);
  assert.equal(h.size, 11);
});

test('a job runs over the lunch break, and must end the same day', () => {
  const s = jobSpan('2026-11-20', '11:00', 150, rules); // 11:00-12:00 then 13:00-14:30
  assert.equal(s.segments.length, 2);
  assert.equal(utcToZoned(s.end, TZ).time, '14:30');
  assert.equal(jobSpan('2026-11-20', '15:00', 150, rules), null); // would end after 17:00
  assert.equal(utcToZoned(jobSpan('2026-11-20', '14:30', 150, rules).end, TZ).time, '17:00');
  assert.equal(jobSpan('2026-11-20', '12:15', 45, rules), null); // lunch is not a start time
});

test('free start times: notice, weekends, holidays, busy calendars', () => {
  const now = zonedToUtc('2026-11-16', '09:00', TZ); // Monday
  const busy = [[zonedToUtc('2026-11-19', '10:00', TZ), zonedToUtc('2026-11-19', '11:00', TZ)]];
  const days = freeStarts({ from: '2026-11-16', days: 10, minutes: 120, busy, now, rules });
  const byDate = Object.fromEntries(days.map((d) => [d.date, d.times]));
  // 48 h notice: Wednesday 18 from 09:00
  assert.equal(byDate['2026-11-16'], undefined);
  assert.equal(byDate['2026-11-18'][0], '09:00');
  // Thursday 19: busy 10-11, a 2 h job cannot overlap it
  assert.ok(byDate['2026-11-19'].includes('08:00'));
  assert.ok(!byDate['2026-11-19'].includes('08:15'));
  assert.ok(byDate['2026-11-19'].includes('11:00'));
  // a 2 h job may start at 11:00 (11-12, 13-14) but not after 15:00
  assert.equal(byDate['2026-11-19'].at(-1), '15:00');
  // weekend
  assert.equal(byDate['2026-11-21'], undefined);
  assert.equal(byDate['2026-11-22'], undefined);
});

test('prices and durations of the bookable services', () => {
  const q = quote({ tint: { vehicle: 'berline', formula: 'full' }, lights: { pairs: 'rear' } });
  assert.equal(q.total, 270 + 50 + 120);
  assert.equal(q.minutes, 150 + 60);
  assert.equal(q.deposit, 132);
  assert.equal(amountDue(q, 'full'), 440);
  assert.equal(quote({ tint: { vehicle: 'citadine', formula: 'front-quarters' } }).total, 150);
  assert.equal(quote({ tint: { vehicle: 'suv', formula: 'rear', windshield: 'irise', color: 'rouge' } }).minutes, 210);
  assert.ok(quote({ tint: { vehicle: 'tesla', formula: 'rear' } }).error);
  assert.ok(quote({ tint: { vehicle: 'berline' } }).error);
  assert.ok(quote({}).error);
  assert.equal(quote({ lights: { pairs: 'both' } }).deposit, 72);
  // the shade is chosen at the workshop: none is asked
  assert.match(quote({ lights: { pairs: 'rear' } }).items[0].detail, /teinte choisie à l’atelier/);
});
