/**
 * Promo codes of a campaign (an ad video, a post…): `percent` off any service of the workshop, for
 * an online booking paid (deposit or total) or a quote requested from `from` 0:00 to `to` 23:59
 * (Paris time), whatever the date of the appointment. `uses`: how many times in all, the online
 * bookings and the uses noted by the workshop together (null: unlimited). Window tint and tinted
 * lights: the code is typed on the booking page; the other services: in the quote request, the
 * workshop then lowers the quote (booking/promo.js, docs/RESERVATION.md). One code per booking or
 * quote: a promo code and a referral code never add up.
 *
 * The countdown (src/js/countdown.js): « Plus que 5 jours », then on the last day « plus que
 * 2 h 48 min 12 s ». It shows on the booking page and the quote form once the code is applied,
 * and on every page for a visitor who came by a link carrying the code (an ad: ?code=NOEL15);
 * `everyone: true` shows it to every visitor during the offer.
 *
 * A small module of its own: every page's script reads it (no prices in it).
 */
export const promos = [{ code: 'NOEL15', percent: 15, from: '2026-12-01', to: '2026-12-24', uses: null, label: 'Noël 2026', everyone: false }];
