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
  // four starts a day (8, 10, 13, 15 h); 48 h notice: Wednesday 18 from 10:00
  assert.equal(byDate['2026-11-16'], undefined);
  assert.deepEqual(byDate['2026-11-18'], ['10:00', '13:00', '15:00']);
  assert.deepEqual(byDate['2026-11-20'], ['08:00', '10:00', '13:00', '15:00']);
  // Thursday 19: busy 10-11, a 2 h job cannot overlap it (8-10 h just fits)
  assert.deepEqual(byDate['2026-11-19'], ['08:00', '13:00', '15:00']);
  // a longer job takes the next slot too: a complete tint (2 h 30) booked at 8:00 ends at 10:30,
  // so the next start is 13:00; and another 2 h 30 job cannot start at 15:00 (past 17:00)
  const long = freeStarts({ from: '2026-11-20', days: 1, minutes: 150, busy: [[zonedToUtc('2026-11-20', '08:00', TZ), zonedToUtc('2026-11-20', '10:30', TZ)]], now, rules });
  assert.deepEqual(long[0].times, ['13:00']);
  // tinted lights (1 h) fill what is left of a slot already partly taken: a car lengthened to
  // 8:00-11:00 leaves 11:00-12:00; a whole slot keeps its fixed start (no 9:00 on an empty morning)
  const at = (t) => zonedToUtc('2026-11-20', t, TZ);
  const hour = (b) => freeStarts({ from: '2026-11-20', days: 1, minutes: 60, busy: b, now, rules })[0].times;
  assert.deepEqual(hour([]), ['08:00', '10:00', '13:00', '15:00']);
  assert.deepEqual(hour([[at('08:00'), at('11:00')]]), ['11:00', '13:00', '15:00']);
  // a pair of lights booked at 8:00: the 9:00 hour is offered to another one
  assert.deepEqual(hour([[at('08:00'), at('09:00')]]), ['09:00', '10:00', '13:00', '15:00']);
  // a 2 h job never goes there
  assert.deepEqual(freeStarts({ from: '2026-11-20', days: 1, minutes: 120, busy: [[at('08:00'), at('11:00')]], now, rules })[0].times, ['13:00', '15:00']);
  // weekend
  assert.equal(byDate['2026-11-21'], undefined);
  assert.equal(byDate['2026-11-22'], undefined);
  // without fixed starts: every `step` minutes
  const quarter = freeStarts({ from: '2026-11-19', days: 1, minutes: 120, busy, now, rules: { ...rules, starts: [] } })[0].times;
  assert.ok(quarter.includes('08:00') && !quarter.includes('08:15') && quarter.includes('11:00'));
  assert.equal(quarter.at(-1), '15:00');
});

test('prices and durations of the bookable services', () => {
  const q = quote({ tint: { vehicle: 'berline', formula: 'full' }, lights: { pairs: 'rear' } });
  assert.equal(q.total, 270 + 50 + 120);
  // one slot of 2 h for any appointment of the catalogue
  assert.equal(q.minutes, 120);
  assert.equal(quote({ tint: { vehicle: 'citadine', formula: 'front' } }).minutes, 120);
  assert.equal(q.deposit, 132);
  assert.equal(amountDue(q, 'full'), 440);
  assert.equal(quote({ tint: { vehicle: 'citadine', formula: 'front-quarters' } }).total, 150);
  assert.equal(quote({ tint: { vehicle: 'suv', formula: 'rear', windshield: 'irise', color: 'rouge' } }).minutes, 120);
  assert.ok(quote({ tint: { vehicle: 'tesla', formula: 'rear' } }).error);
  assert.ok(quote({ tint: { vehicle: 'berline' } }).error);
  assert.ok(quote({}).error);
  assert.equal(quote({ lights: { pairs: 'both' } }).deposit, 72);
  // tinted lights alone: 1 h a pair; with window tint: the 2 h slot
  assert.equal(quote({ lights: { pairs: 'rear' } }).minutes, 60);
  assert.equal(quote({ lights: { pairs: 'both' } }).minutes, 120);
  assert.equal(quote({ tint: { vehicle: 'berline', formula: 'rear' }, lights: { pairs: 'both' } }).minutes, 120);
  // the shade is chosen at the workshop: none is asked
  assert.match(quote({ lights: { pairs: 'rear' } }).items[0].detail, /teinte choisie à l’atelier/);
});
