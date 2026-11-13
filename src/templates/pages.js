import fs from 'node:fs';
import path from 'node:path';
import { simFor } from './sims.js';
import { priceText } from '../../content/pricing.js';
import { coveringPage as CP, FINISHES, EFFECTS } from '../../content/covering.js';
import { filmTravel } from '../../content/film.js';
import { films as coveringFilms, ranges as filmRanges } from '../../content/films/index.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

/**
 * Static HTML templates. Every page is rendered at build time from content/*.js so search
 * engines get complete, semantic HTML; JavaScript only adds the 3D tour and small comforts.
 */

export const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** a title from the content: escaped, *mot* set in the italic serif (<em>) */
export const rich = (s = '') => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
/** the same title as plain text (meta tags, labels) */
export const plain = (s = '') => String(s).replace(/\*([^*]+)\*/g, '$1');

const abs = (site, p) => site.siteUrl.replace(/\/$/, '') + p;
const telHref = (phone) => 'tel:' + String(phone).replace(/[^\d+]/g, '').replace(/^0/, '+33');

function addressLine(b) {
  const a = b.address || {};
  return [a.street, [a.postalCode, a.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

/** +33 6 12 04 57 00 */
export const intlPhone = (phone) => String(phone).replace(/[^\d]/g, '').replace(/^0/, '+33 ').replace(/^(\+33 )(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1$2 $3 $4 $5 $6');

const fullAddress = (b) => `${b.name}, ${addressLine(b)}`;
const enc = encodeURIComponent;
/** Google Maps / Waze / Apple Plans links to the workshop (no API key, no cookie on our side). */
export function placeLinks(b) {
  const q = enc(fullAddress(b));
  const a = enc(addressLine(b));
  return {
    maps: b.google?.profileUrl || `https://www.google.com/maps/search/?api=1&query=${q}`,
    review: b.google?.reviewUrl || b.google?.profileUrl || `https://www.google.com/maps/search/?api=1&query=${q}`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    waze: `https://waze.com/ul?q=${a}&navigate=yes`,
    apple: `https://maps.apple.com/?daddr=${a}`,
  };
}

// small brand glyphs (inline SVG, currentColor)
const ICONS = {
  instagram:
    '<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path fill="currentColor" d="M12 7.3A4.7 4.7 0 1 0 16.7 12 4.7 4.7 0 0 0 12 7.3Zm0 7.8A3.1 3.1 0 1 1 15.1 12 3.1 3.1 0 0 1 12 15.1Zm6-8a1.1 1.1 0 1 1-1.1-1.1A1.1 1.1 0 0 1 18 7.1ZM21.1 8.2a5.4 5.4 0 0 0-1.5-3.8 5.4 5.4 0 0 0-3.8-1.5c-1.5-.1-6-.1-7.5 0a5.4 5.4 0 0 0-3.8 1.5A5.4 5.4 0 0 0 2.9 8.2c-.1 1.5-.1 6 0 7.5a5.4 5.4 0 0 0 1.5 3.8 5.4 5.4 0 0 0 3.8 1.5c1.5.1 6 .1 7.5 0a5.4 5.4 0 0 0 3.8-1.5 5.4 5.4 0 0 0 1.5-3.8c.1-1.5.1-6 0-7.5Zm-1.9 9.1a3.1 3.1 0 0 1-1.7 1.7c-1.2.5-4 .4-5.5.4s-4.3.1-5.5-.4a3.1 3.1 0 0 1-1.7-1.7c-.5-1.2-.4-4-.4-5.3s-.1-4.1.4-5.3a3.1 3.1 0 0 1 1.7-1.7c1.2-.5 4-.4 5.5-.4s4.3-.1 5.5.4a3.1 3.1 0 0 1 1.7 1.7c.5 1.2.4 4 .4 5.3s.1 4.1-.4 5.3Z"/></svg>',
  tiktok:
    '<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path fill="currentColor" d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6 2.5 2.5 0 0 1 .8.1V9.7a5.8 5.8 0 0 0-.8-.1 5.7 5.7 0 1 0 5.7 5.7V9a7.3 7.3 0 0 0 4.3 1.4V7.3a4.3 4.3 0 0 1-3.2-1.5Z"/></svg>',
  google:
    '<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path fill="currentColor" d="M21.6 10.2H12v3.9h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3a10 10 0 0 0 2.8-7.6 11.7 11.7 0 0 0 0-2Zm-9.6 11.8a9.8 9.8 0 0 0 6.8-2.5l-3.3-2.6a6.1 6.1 0 0 1-9.1-3.2H3v2.6A10 10 0 0 0 12 22ZM6.4 13.7a6 6 0 0 1 0-3.8V7.3H3a10 10 0 0 0 0 9ZM12 6a5.5 5.5 0 0 1 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10 10 0 0 0-9 5.3l3.4 2.6A6 6 0 0 1 12 6Z"/></svg>',
  phone:
    '<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.2 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .6 3.6 1 1 0 0 1-.3 1Z"/></svg>',
  route:
    '<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5Z"/></svg>',
  mail:
    '<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path fill="currentColor" d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4-8 5-8-5V6l8 5 8-5Z"/></svg>',
};
const SOCIAL_NAMES = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' };
function socialLinks(b, cls = 'social') {
  const items = Object.entries(b.social || {}).filter(([, v]) => v);
  if (!items.length) return '';
  return `<ul class="${cls}">${items
    .map(([k, v]) => `<li><a href="${esc(v)}" rel="noopener" target="_blank" aria-label="${esc(b.name)} sur ${SOCIAL_NAMES[k] || k}">${ICONS[k] || ''}<span>${SOCIAL_NAMES[k] || k}</span></a></li>`)
    .join('')}</ul>`;
}

/** Location phrase for titles: the city once known, otherwise the department. */
export function placeLabel(b) {
  return b.address?.city ? `${b.address.city} (${b.departmentCode})` : `${b.department} (${b.departmentCode})`;
}

// ------------------------------------------------------------------------- structured data
function localBusiness(ctx) {
  const b = ctx.business;
  const links = placeLinks(b);
  const data = {
    '@context': 'https://schema.org',
    '@type': 'AutoBodyShop',
    '@id': abs(b, '/#entreprise'),
    name: b.name,
    description: ctx.home.seo.description,
    url: abs(b, '/'),
    logo: abs(b, '/img/brand/logo-officiel-480.png'),
    image: [abs(b, '/stills/og.jpg'), abs(b, '/stills/hero-1600.jpg'), abs(b, '/stills/detailing-1600.jpg')],
    slogan: b.tagline,
    hasMap: links.maps,
    priceRange: b.priceRange || undefined,
    currenciesAccepted: 'EUR',
    areaServed: [
      { '@type': 'AdministrativeArea', name: `${b.department} (${b.departmentCode})` },
      ...(b.address?.city ? [{ '@type': 'City', name: b.address.city }] : []),
      ...(b.nearby || []).map((n) => ({ '@type': 'City', name: n })),
    ],
    knowsAbout: ctx.services.map((s) => s.name),
    makesOffer: ctx.services.map((s) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: s.name, url: abs(b, `/${s.slug}/`) },
      ...offerPrice(ctx, s.slug),
    })),
  };
  if (b.legalName) data.legalName = b.legalName;
  if (b.phone) data.telephone = intlPhone(b.phone);
  if (b.email) data.email = b.email;
  if (b.siret) data.identifier = { '@type': 'PropertyValue', propertyID: 'SIRET', value: b.siret.replace(/\s/g, '') };
  if (b.phone || b.email)
    data.contactPoint = {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: b.phone ? intlPhone(b.phone) : undefined,
      email: b.email || undefined,
      areaServed: 'FR',
      availableLanguage: 'French',
    };
  const a = b.address || {};
  if (a.street || a.city) {
    data.address = {
      '@type': 'PostalAddress',
      streetAddress: a.street || undefined,
      postalCode: a.postalCode || undefined,
      addressLocality: a.city || undefined,
      addressRegion: b.region,
      addressCountry: 'FR',
    };
  }
  if (b.geo) data.geo = { '@type': 'GeoCoordinates', latitude: b.geo.lat, longitude: b.geo.lng };
  if (b.openingHours)
    data.openingHoursSpecification = b.openingHours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes,
    }));
  const same = [...new Set([...Object.values(b.social || {}), b.google?.mapsUrl, b.google?.profileUrl].filter(Boolean))];
  if (b.google?.mapsUrl) data.hasMap = b.google.mapsUrl;
  if (same.length) data.sameAs = same;
  return data;
}

/** price (or range) of a service as schema.org fields, from content/pricing.js */
function offerPrice(ctx, slug) {
  const P = ctx.pricing;
  const spec = (min, max) => ({
    priceSpecification: { '@type': 'PriceSpecification', priceCurrency: 'EUR', minPrice: min, maxPrice: max, valueAddedTaxIncluded: true },
  });
  if (slug === 'vitres-teintees') {
    const v = Object.values(P.tint.rearPackage);
    return spec(Math.min(P.tint.frontOnly, ...v), Math.max(...v) + P.tint.frontWithRear);
  }
  if (slug === 'feux-arriere-teintes') return spec(P.lights.perPair.min, P.lights.perPair.max * 2);
  if (slug === 'renovation-phares') return spec(P.headlights.renovation, P.headlights.renovation + P.headlights.options.reduce((a, o) => a + o.price, 0));
  return {};
}

const faqLd = (faq) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});

const breadcrumbLd = (b, items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(b, it.path) })),
});

/** service pages that carry a 3D simulator (src/templates/sims.js) */
const SIMS = new Set(['vitres-teintees', 'feux-arriere-teintes', 'ciel-etoile']);

const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

// ------------------------------------------------------------------------- shared chrome
// <head> of every page. The speculation rules ask Chrome / Edge to fetch a page of the site as
// soon as the visitor hovers its link (or presses it on a phone): the next page opens at once.
// Both inline scripts are allowed by their hash in the Content-Security-Policy (scripts/security.mjs).
function head(ctx, { title, description, path, image = '/stills/og.jpg', preload = '', noindex = false, extra = '' }) {
  const b = ctx.business;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(abs(b, path))}">
${noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large">'}
<meta name="theme-color" content="#07080a">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="${esc(b.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(abs(b, path))}">
<meta property="og:image" content="${esc(abs(b, image))}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon-48.png" sizes="48x48" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
${(ctx.assets.fonts || [ctx.assets.font]).map((f) => `<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>`).join('\n')}
${preload}
<link rel="stylesheet" href="${ctx.assets.css}">
<script>(function(d){var c=d.documentElement.classList,n=navigator.connection;c.add('js');if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&!(n&&(n.saveData||/2g|3g/.test(n.effectiveType||'')))&&!/[?&]static\\b/.test(location.search))c.add('tour-live')})(document)</script>
<script type="speculationrules">{"prefetch":[{"where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":"/design/*"}}]},"eagerness":"moderate"}]}</script>
${extra}
</head>`;
}

const CHEVRON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg>';

function header(ctx, current = '') {
  const items = ctx.nav
    .map((n, idx) => {
      if (!n.services) return `<li style="--i:${idx}"><a href="${n.href}"${current === n.href ? ' aria-current="page"' : ''}>${esc(n.label)}</a></li>`;
      const inside = ctx.services.some((s) => current === `/${s.slug}/`);
      const links = ctx.services
        .map((s, i) => `<li style="--i:${i}"><a href="/${s.slug}/"${current === `/${s.slug}/` ? ' aria-current="page"' : ''}><strong>${esc(s.name)}</strong><span>${esc(s.short)}</span></a></li>`)
        .join('');
      return `<li class="site-nav__group${inside ? ' is-current' : ''}" style="--i:${idx}" data-submenu><button class="site-nav__trigger" type="button" aria-expanded="false" aria-controls="menu-prestations">${esc(n.label)} ${CHEVRON}</button><ul class="site-nav__sub" id="menu-prestations">${links}</ul></li>`;
    })
    .join('');
  return `<a class="skip-link" href="#contenu">Aller au contenu</a>
<header class="site-header" data-header>
  <a class="site-header__logo" href="/" aria-label="${esc(ctx.business.name)} — accueil"><img src="/img/brand/logo-horizontal-clair-200.webp" srcset="/img/brand/logo-horizontal-clair-200.webp 200w, /img/brand/logo-horizontal-clair-400.webp 400w" sizes="114px" width="114" height="44" alt="${esc(ctx.business.name)}"></a>
  <nav class="site-nav" aria-label="Navigation principale">
    <button class="site-nav__toggle" type="button" aria-expanded="false" aria-controls="menu-principal" data-nav-toggle>
      <span class="site-nav__bars" aria-hidden="true"></span><span class="visually-hidden">Menu</span>
    </button>
    <ul class="site-nav__list" id="menu-principal">${items}<li class="site-nav__cta" style="--i:${ctx.nav.length}"><a class="btn btn--primary btn--sm" href="/contact/">Devis</a></li></ul>
  </nav>
  <a class="btn btn--primary btn--sm site-header__quote" href="/contact/"${current === '/contact/' ? ' aria-current="page"' : ''}>Devis</a>
  ${ctx.business.phone ? `<a class="site-header__phone" href="${telHref(ctx.business.phone)}" aria-label="Appeler l’atelier : ${esc(ctx.business.phone)}">${ICONS.phone}<span>${esc(ctx.business.phone)}</span></a>` : ''}
</header>`;
}

function contactLines(b, { compact = false } = {}) {
  const rows = [];
  const addr = addressLine(b);
  if (addr) rows.push(`<li><span class="label">Adresse</span> ${esc(addr)}</li>`);
  if (b.phone) rows.push(`<li><span class="label">Téléphone</span> <a href="${telHref(b.phone)}">${esc(b.phone)}</a></li>`);
  if (b.email) rows.push(`<li><span class="label">E-mail</span> <a href="mailto:${esc(b.email)}">${esc(b.email)}</a>${b.emailAlt && !compact ? `<br><a href="mailto:${esc(b.emailAlt)}">${esc(b.emailAlt)}</a>` : ''}</li>`);
  if (b.hoursText && !compact) rows.push(`<li><span class="label">Horaires</span> ${esc(b.hoursText)}</li>`);
  if (!rows.length && !compact)
    rows.push(`<li class="todo">Coordonnées de l’atelier à compléter (adresse, téléphone, e-mail).</li>`);
  return rows.length ? `<ul class="contact-lines">${rows.join('')}</ul>` : '';
}

function footer(ctx) {
  const b = ctx.business;
  const links = placeLinks(b);
  const credit = ctx.car.credit
    ? `<p class="site-footer__credit">${ctx.car.credit.url ? `<a href="${esc(ctx.car.credit.url)}" rel="noopener">${esc(ctx.car.credit.text)}</a>` : esc(ctx.car.credit.text)}</p>`
    : '';
  return `<footer class="site-footer">
  <div class="container site-footer__grid">
    <div>
      <a class="site-footer__logo" href="/" aria-label="${esc(b.name)} — accueil"><img src="/img/brand/logo-officiel-clair-240.webp" srcset="/img/brand/logo-officiel-clair-240.webp 240w, /img/brand/logo-officiel-clair-480.webp 480w" sizes="132px" width="132" height="142" alt="Logo ${esc(b.name)}" loading="lazy"></a>
      <p class="site-footer__tag">${esc(b.tagline)} — ${esc(b.address?.city || b.department)}, près de Tours (${esc(b.departmentCode)}).</p>
      ${contactLines(b)}
      ${socialLinks(b, 'social social--footer')}
    </div>
    <nav aria-label="Prestations">
      <h2 class="site-footer__title">Prestations</h2>
      <ul>${ctx.services.map((s) => `<li><a href="/${s.slug}/">${esc(s.name)}</a></li>`).join('')}</ul>
    </nav>
    ${ctx.zones?.length ? `<nav aria-label="Zones d’intervention">
      <h2 class="site-footer__title">Zones d’intervention</h2>
      <ul class="site-footer__zones">${ctx.zones.map((z) => `<li><a href="/${z.slug}/">${esc(z.town)}</a></li>`).join('')}<li><a href="${ctx.zonesPage.path}">Toutes les communes</a></li></ul>
    </nav>` : ''}
    <nav aria-label="Informations">
      <h2 class="site-footer__title">Informations</h2>
      <ul><li><a href="/contact/">Contact &amp; devis</a></li><li><a href="/atelier-vouvray/">L’atelier à ${esc(b.address?.city || '')}</a></li><li><a href="/guides/">Guides pratiques</a></li><li><a href="${esc(links.maps)}" rel="noopener" target="_blank">Nos avis Google</a></li><li><a href="/mentions-legales/">Mentions légales</a></li></ul>
    </nav>
  </div>
  <div class="container site-footer__bottom">
    <p>© <span data-year>${new Date().getFullYear()}</span> ${esc(b.name)}${b.siret ? ` · SIRET ${esc(b.siret)}` : ''} · Prix TTC</p>
    ${credit}
  </div>
</footer>`;
}

/** phone-size quick actions, always within thumb reach: call, directions, quote */
function actionBar(ctx) {
  const b = ctx.business;
  const links = placeLinks(b);
  return `<nav class="action-bar" aria-label="Actions rapides">
  ${b.phone ? `<a href="${telHref(b.phone)}">${ICONS.phone}<span>Appeler</span></a>` : ''}
  <a href="${esc(links.google)}" rel="noopener" target="_blank">${ICONS.route}<span>Itinéraire</span></a>
  <a class="action-bar__main" href="/contact/">${ICONS.mail}<span>Devis</span></a>
</nav>`;
}

/** The workshop: address, hours, live map and directions (home, services, contact, atelier). */
export function visitBlock(ctx, { title = 'L’atelier', id = 'atelier', headingLevel = 2, map = true } = {}) {
  const b = ctx.business;
  const links = placeLinks(b);
  const H = `h${headingLevel}`;
  const near = (b.nearby || []).slice(0, 6);
  return `<section class="section visit" id="${id}" aria-labelledby="${id}-title">
  <div class="container visit__grid">
    <div class="visit__info reveal-up">
      <p class="kicker">${esc(b.address?.city || '')} · ${esc(b.department)} (${esc(b.departmentCode)})</p>
      <${H} id="${id}-title">${esc(title)}</${H}>
      <address class="visit__address">${esc(b.name)}<br>${esc(b.address?.street || '')}<br>${esc(b.address?.postalCode || '')} ${esc(b.address?.city || '')}</address>
      ${b.hoursText ? `<p class="visit__hours"><span class="label">Horaires</span> ${esc(b.hoursText)}</p>` : ''}
      ${near.length ? `<p class="visit__near">À une dizaine de kilomètres de Tours, facile d’accès depuis ${esc(near.slice(1).join(', '))}…</p>` : ''}
      <div class="visit__actions">
        <a class="btn btn--primary" href="${esc(links.google)}" rel="noopener" target="_blank">${ICONS.route} Itinéraire</a>
        ${b.phone ? `<a class="btn btn--ghost" href="${telHref(b.phone)}">${ICONS.phone} ${esc(b.phone)}</a>` : ''}
      </div>
      <p class="visit__apps">Ouvrir dans <a href="${esc(links.maps)}" rel="noopener" target="_blank">Google Maps</a> · <a href="${esc(links.waze)}" rel="noopener" target="_blank">Waze</a> · <a href="${esc(links.apple)}" rel="noopener" target="_blank">Plans</a></p>
    </div>
    ${map ? `<div class="visit__map" data-map data-address="${esc(addressLine(b))}" data-name="${esc(b.name)}">
      <img class="visit__map-poster" src="/map/poster-960.webp" srcset="/map/poster-960.webp 960w, /map/poster-1600.webp 1600w" sizes="(min-width: 900px) 640px, 100vw" width="1600" height="1100" loading="lazy" decoding="async" alt="Carte de l’accès à l’atelier ${esc(b.name)} à Vouvray : le trajet depuis le centre de Tours, au nord de la Loire">
      <a class="visit__map-open btn btn--sm" href="${esc(links.maps)}" rel="noopener" target="_blank">${ICONS.route} Ouvrir dans Google Maps</a>
    </div>` : ''}
  </div>
</section>`;
}

/**
 * Width / height of a partner logo (public/img/partners/, made by scripts/partner-logos.mjs),
 * read from the PNG header or the SVG viewBox; null when unknown.
 */
function logoRatio(logo) {
  try {
    const buf = fs.readFileSync(path.join(ROOT, 'public', logo));
    if (/\.png$/i.test(logo)) return buf.readUInt32BE(16) / buf.readUInt32BE(20);
    const vb = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(buf.toString('utf8'));
    return vb ? Number(vb[1]) / Number(vb[2]) : null;
  } catch {
    return null;
  }
}

/** Partner brands: an accessible list, doubled into a slow scrolling band (logos when supplied). */
function partnersBlock(ctx) {
  const p = ctx.partners;
  if (!p?.brands?.length) return '';
  // logos are painted in gold through a CSS mask (any single-colour SVG / transparent PNG), all
  // with about the same area so that a long thin wordmark and a compact one weigh the same
  const size = (logo) => {
    const r = logoRatio(logo);
    if (!r) return '';
    const w = Math.min(170, Math.sqrt(3300 * r), 58 * r);
    return `;--w:${Math.round(w)}px;--h:${Math.round(w / r)}px`;
  };
  const item = (x) =>
    `<li class="brands__item">${x.logo ? `<i class="brands__logo" style="--logo:url(${esc(x.logo)})${size(x.logo)}" role="img" aria-label="${esc(x.name)}"></i>` : `<span>${esc(x.name)}</span>`}</li>`;
  const list = p.brands.map(item).join('');
  return `<section class="section brands" aria-labelledby="marques-title">
  <div class="container brands__head reveal-up">
    <p class="kicker">Partenaires</p>
    <h2 id="marques-title">${esc(p.title)}</h2>
    <p>${esc(p.text)}</p>
  </div>
  <div class="brands__band">
    <ul class="brands__track">${list}</ul>
    <ul class="brands__track" aria-hidden="true">${list}</ul>
  </div>
</section>`;
}

/** Google reviews: links to the real profile, never a made-up rating. */
function reviewsBlock(ctx) {
  const b = ctx.business;
  const r = ctx.reviews;
  const links = placeLinks(b);
  const live = b.google?.placeId && b.google?.mapsApiKey;
  return `<section class="section reviews" aria-labelledby="avis-title"${live ? ` data-reviews data-place="${esc(b.google.placeId)}" data-key="${esc(b.google.mapsApiKey)}"` : ''}>
  <div class="container reviews__inner reveal-up">
    <div class="reviews__badge" aria-hidden="true">${ICONS.google}</div>
    <div>
      <h2 id="avis-title">${esc(r.title)}</h2>
      <p>${esc(r.text)}</p>
      <div class="ctas">
        <a class="btn btn--primary" href="${esc(links.review)}" rel="noopener" target="_blank">Laisser un avis Google</a>
        <a class="btn btn--ghost" href="${esc(links.maps)}" rel="noopener" target="_blank">Lire les avis</a>
      </div>
    </div>
    <div class="reviews__social">
      <p class="kicker">Suivez l’atelier</p>
      ${socialLinks(b, 'social social--big')}
    </div>
  </div>
  ${live ? '<div class="container reviews__live" data-reviews-list hidden></div>' : ''}
</section>`;
}

/** Instagram: the latest posts once a feed is set up, otherwise a link to the profile. */
function instagramBlock(ctx) {
  const b = ctx.business;
  const url = b.social?.instagram;
  if (!url) return '';
  const handle = `@${url.replace(/\/+$/, '').split('/').pop()}`;
  const feed = b.instagramFeed?.feedUrl;
  const n = b.instagramFeed?.count || 5;
  return `<section class="section insta" aria-labelledby="insta-title"${feed ? ` data-insta="${esc(feed)}" data-count="${n}"` : ''}>
  <div class="container">
    <div class="insta__head reveal-up">
      <div>
        <p class="kicker">Instagram ${esc(handle)}</p>
        <h2 id="insta-title">Les dernières sorties d’atelier</h2>
        <p>Vitres teintées, feux, detailing, ciel étoilé : les voitures qui passent à l’atelier, en photos et en vidéos.</p>
      </div>
      <a class="btn btn--primary" href="${esc(url)}" rel="noopener" target="_blank">${ICONS.instagram} Suivre ${esc(handle)}</a>
    </div>
    ${feed ? `<ul class="insta__grid" data-insta-list aria-busy="true">${'<li class="insta__item is-skel"></li>'.repeat(n)}</ul>` : ''}
  </div>
</section>`;
}

/** the workshop's crest in the backdrop: the official emblem stacked into a thin gold coin that
 * turns slowly, a light sweeping its face, a few sparks (CSS only, src/styles/main.css "crest") */
// the emblem turning in the backdrop: built by src/js/ambient.js once the page has loaded (it
// shows only then), from these files; nothing of it is downloaded before
const CREST = '<div class="crest-wrap" data-crest data-src="/img/brand/embleme-256.webp" data-srcset="/img/brand/embleme-256.webp 256w, /img/brand/embleme-512.webp 512w" data-emblem="/img/brand/embleme-512.webp"></div>';

function page(ctx, opts, body) {
  return `${head(ctx, opts)}
<body class="${opts.bodyClass || ''}">
<div class="ambient" data-ambient aria-hidden="true"><div class="ambient__haze" data-haze></div><div class="ambient__sweep"></div>${CREST}</div>
${header(ctx, opts.path)}
<main id="contenu">
${body}
</main>
${footer(ctx)}
${actionBar(ctx)}
<script type="module" src="${ctx.assets.js}"></script>
</body>
</html>
`;
}

/** call-to-action links; `tour` = a chapter to jump to: `jump(id)` gives the attribute (the film's
 *  second, data-film-at, or the 3D tour's scroll position, data-tour-at) */
const ctaLinks = (ctas = [], jump = () => '') =>
  ctas.length
    ? `<div class="ctas">${ctas
        .map((c) => {
          const at = c.tour ? jump(c.tour) : '';
          return `<a class="btn ${c.primary ? 'btn--primary' : 'btn--ghost'}" href="${c.href}"${c.href.startsWith('#') ? ' data-scroll' : ''}${at}>${esc(c.label)}${c.tour ? ' <span class="btn__arrow" aria-hidden="true">↓</span>' : ''}</a>`;
        })
        .join('')}</div>`
    : '';

const still = (id, alt, { sizes = '100vw', eager = false, cls = '' } = {}) =>
  `<img class="${cls}" src="/stills/${id}-960.webp" srcset="/stills/${id}-960.webp 960w, /stills/${id}-1600.webp 1600w" sizes="${sizes}" width="1600" height="900" alt="${esc(alt)}" ${eager ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"'}>`;

/** a real photo prepared by scripts/photos.mjs (public/img/realisations/<id>-320|960|1280.webp) */
const RP = '/img/realisations/';
const photo = (p, { sizes = '100vw', eager = false, cls = '' } = {}) =>
  `<img class="${cls}" src="${RP}${p.id}-960.webp" srcset="${RP}${p.id}-960.webp 960w, ${RP}${p.id}-1280.webp 1280w" sizes="${sizes}" width="1200" height="1600" alt="${esc(p.alt || '')}"${p.focus ? ` style="object-position:${esc(p.focus)}"` : ''} ${eager ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"'}>`;

/** the job (content/realisations.js) a published photo belongs to, with the photo itself */
const jobOf = (ctx, photoId) => {
  for (const r of ctx.realisations || []) {
    const p = (r.photos || []).find((x) => x.id === photoId);
    if (p) return { job: r, photo: p };
  }
  return null;
};
/** page header photo: its 16:9 crop on wide screens, the full photo on phones */
const heroPicture = (p) =>
  p.wide
    ? `<picture><source media="(min-width: 761px)" srcset="${RP}${p.id}-wide-960.webp 960w, ${RP}${p.id}-wide-1600.webp 1600w" sizes="100vw" width="1600" height="900"><source media="(max-width: 760px)" srcset="${RP}${p.id}-phone.webp" width="750" height="1200">${photo(p, { eager: true })}</picture>`
    : photo(p, { eager: true });
const heroPreload = (p) =>
  p.wide
    ? `<link rel="preload" as="image" media="(min-width: 761px)" href="${RP}${p.id}-wide-1600.webp" imagesrcset="${RP}${p.id}-wide-960.webp 960w, ${RP}${p.id}-wide-1600.webp 1600w" imagesizes="100vw" fetchpriority="high">\n<link rel="preload" as="image" media="(max-width: 760px)" href="${RP}${p.id}-phone.webp" fetchpriority="high">`
    : `<link rel="preload" as="image" href="${RP}${p.id}-1280.webp" imagesrcset="${RP}${p.id}-960.webp 960w, ${RP}${p.id}-1280.webp 1280w" imagesizes="100vw" fetchpriority="high">`;
/** a real photo for a card or a page when its web version exists ({ id, focus, alt }), else the
 * 3D still (`fallback`) */
const realOr = (ctx, p, fallback, opts = {}) =>
  p && ctx.photoIds?.has(p.id) ? photo({ ...p, alt: opts.alt ?? p.alt ?? '' }, opts) : fallback();
/** share image (16:9 JPEG) of a header photo, else the 3D still */
const shareImage = (hero, s) => (hero?.wide ? `${RP}${hero.id}-wide-1600.jpg` : `/stills/${s.still}-1600.jpg`);

function ctaBand(ctx) {
  const c = ctx.home.ctaBand;
  return `<section class="cta-band">
  <div class="container cta-band__inner">
    <div><h2>${rich(c.title)}</h2><p>${esc(c.text)}</p></div>
    <a class="btn btn--primary" href="${c.cta.href}">${esc(c.cta.label)}</a>
  </div>
</section>`;
}

function faqBlock(faq, title = 'Questions fréquentes') {
  return `<section class="faq section" aria-labelledby="faq-title">
  <div class="container container--narrow">
    <h2 id="faq-title">${esc(title)}</h2>
    ${faq.map((f) => `<details class="faq__item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n    ')}
  </div>
</section>`;
}

// ------------------------------------------------------------------------- home
/** image of a film chapter (public/img/film/, extracted by scripts/film-assets.mjs) */
const filmStill = (id, alt, { eager = false } = {}) =>
  `<picture><source media="(max-aspect-ratio: 2/3)" srcset="/img/film/${id}-tall-720.webp 720w, /img/film/${id}-tall-1080.webp 1080w" sizes="max(100vw, 56.25vh)" width="1080" height="1920"><img src="/img/film/${id}-960.webp" srcset="/img/film/${id}-960.webp 960w, /img/film/${id}-1600.webp 1600w, /img/film/${id}-2560.webp 2560w" sizes="max(100vw, 177.7vh)" width="1600" height="900" alt="${esc(alt)}" ${eager ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"'}></picture>`;

/**
 * The chapters laid over the home film (or the 3D tour demo): kicker (numbered in the order
 * shown), title (h1 for the first), text, links. `image(id, i)` gives the chapter's picture,
 * `jump(id)` the attribute of the in-page links to a chapter, `attrs(id)` extra attributes.
 */
function chapterArticles(ctx, order, { image, jump, attrs = () => '', hint = null, tour = false, extra = () => '' }) {
  const { home, services, business: b } = ctx;
  const ch = home.tour.chapters;
  let n = 0;
  return order
    .map((id, i) => {
      const c = ch[id];
      const H = i === 0 ? 'h1' : 'h2';
      const numbered = /^\d+\s*—\s*/.test(c.kicker);
      const kicker = numbered ? `${String(++n).padStart(2, '0')} — ${c.kicker.replace(/^\d+\s*—\s*/, '')}` : c.kicker;
      const link = c.link
        ? `<p class="chapter__link"><a class="btn btn--primary chapter__cta" href="${c.link.href}">${esc(c.link.label)} <span class="chapter__arrow" aria-hidden="true">→</span></a><span class="chapter__hint">${esc(c.linkHint || 'Simulateur · tarifs · questions fréquentes')}</span></p>`
        : '';
      const readout =
        tour && c.readout === 'vlt'
          ? `<p class="readout" aria-live="off"><span class="readout__label">Transmission lumineuse arrière</span> <span class="readout__value" data-readout="vlt">70</span><span class="readout__unit"> %</span></p>`
          : tour && c.readout === 'beforeAfter'
            ? `<p class="readout readout--ba" aria-live="off"><span class="readout__label">Optiques</span> <span class="readout__value" data-readout="beforeAfter">Avant</span></p>`
            : '';
      const contact = c.contact ? contactLines(b, { compact: true }) : '';
      const heading = c.brand ? `<span class="chapter__brand">${esc(c.brand)}</span> <span class="chapter__line">${esc(plain(c.title))}</span>` : rich(c.title);
      const quick = c.quick
        ? `<nav class="hero-quick" aria-label="Accès direct aux prestations"><span class="hero-quick__label">${esc(c.quick)}</span><ul>${services.map((s) => `<li><a href="/${s.slug}/">${esc(s.shortName || s.name)}</a></li>`).join('')}</ul></nav>`
        : '';
      const hintText = c.hint ? hint || c.hint : '';
      const hintHtml = hintText ? `<p class="hero-hint" aria-hidden="true"><span class="hero-hint__mouse"></span>${esc(hintText)}</p>` : '';
      return `<article class="chapter chapter--${c.side || 'left'}${i === 0 ? ' is-active' : ''}" data-chapter="${id}" id="chapitre-${id}"${attrs(id)}>
        <div class="chapter__still">${image(id, i)}</div>
        <div class="chapter__copy">
          <p class="kicker">${esc(kicker)}</p>
          <${H} class="chapter__title${c.brand ? ' chapter__title--brand' : ''}">${heading}</${H}>
          <p class="chapter__text">${esc(c.text)}</p>
          ${readout}${extra(id)}${contact}${ctaLinks(c.ctas, jump)}${quick}${link}${hintHtml}${i === 0 && tour ? '<p class="tour__opt-in" data-tour-start hidden><button type="button" class="btn btn--ghost btn--sm">Lancer la visite 3D</button> <span>(données mobiles : quelques Mo)</span></p>' : ''}
        </div>
      </article>`;
    })
    .join('\n      ');
}

/** The 3D tour (studio flight driven by the scroll): now on a demo page, it renders the stills. */
function tourSection(ctx) {
  const { home, business: b } = ctx;
  const ch = home.tour.chapters;
  const altFor = {
    hero: `Façade de l’atelier ${b.name} de nuit, porte ouverte sur le studio éclairé et la voiture`,
    tint: 'Voiture de sport dans le studio : lunette et vitres arrière teintées, vitres avant claires',
    tail: 'Arrière de la voiture avec feux arrière teintés par film fumé',
    detailing: 'Flanc de la voiture pendant le polissage : peinture terne à droite, corrigée à gauche',
    stars: 'Pavillon intérieur de la voiture illuminé par un ciel étoilé en fibre optique',
    covering: 'Rendu 3D : la voiture du studio habillée d’un film argent métallisé mat, vue de trois quarts avant',
    headlights: 'Phares avant rénovés et allumés, optiques redevenues transparentes',
    final: `Vue aérienne de nuit de l’atelier ${b.name}, de ses abords et de la route`,
  };
  const order = Object.keys(ch);
  const jump = (id) => (ctx.flightAt[id] != null ? ` data-tour-at="${ctx.flightAt[id] + 22}"` : '');
  const chapters = chapterArticles(ctx, order, { image: (id, i) => still(id, altFor[id] || '', { eager: i === 0 }), jump, tour: true });
  return `<section class="tour" id="visite" aria-label="${esc(home.tour.label)}" style="--travel:${ctx.flightTotal}" data-tour>
    <div class="tour__stage" data-stage>
      <canvas class="tour__canvas" aria-hidden="true" data-canvas></canvas>
      <div class="tour__chapters">
      ${chapters}
      </div>
      <div class="tour__hud">
        <div class="tour__track">
        <div class="tour__progress" aria-hidden="true"><span data-progress></span></div>
        <nav class="tour__marks" aria-label="Chapitres de la visite">${order
          .filter((id) => ctx.flightAt[id] != null)
          .map((id) => {
            const at = id === 'hero' ? 0 : ctx.flightAt[id] + 22;
            const name = (ch[id].kicker || '').replace(/^\d+\s*—\s*/, '');
            return `<a href="#chapitre-${id}" data-scroll data-tour-at="${at}" style="left:${((at / ctx.flightTotal) * 100).toFixed(2)}%" title="${esc(name)}"><span class="visually-hidden">${esc(name)}</span></a>`;
          })
          .join('')}</nav>
        </div>
        <p class="tour__label" aria-hidden="true"><span data-chapter-index>01</span> / 0${order.length} <span class="tour__name" data-chapter-name></span></p>
      </div>
      <p class="tour__loading" data-loading hidden><span class="tour__spinner" aria-hidden="true"></span><span>${esc(home.tour.loading)}</span> <span data-loading-pct></span></p>
      <a class="tour__skip btn btn--ghost btn--sm" href="#prestations" data-scroll>${esc(home.tour.skip)} <span aria-hidden="true">↓</span></a>
    </div>
  </section>`;
}

/**
 * The home film (content/film.js): a video moved by the scroll (src/js/film.js), the service
 * chapters over it at their moment, a bar of tabs to jump to each service. Without JavaScript
 * or with reduced motion: the chapters one under the other over their images.
 */
function filmSection(ctx) {
  const { home, film } = ctx;
  const byId = Object.fromEntries(film.chapters.map((c) => [c.id, c]));
  const order = film.chapters.map((c) => c.id).filter((id) => home.tour.chapters[id]);
  const at = (id) => (byId[id] ? Math.max(film.start, byId[id].from + 0.45).toFixed(2) : null);
  const jump = (id) => (at(id) ? ` data-film-at="${at(id)}"` : '');
  const chapters = chapterArticles(ctx, order, {
    image: (id, i) => filmStill(id, byId[id].alt || '', { eager: i === 0 }),
    jump,
    attrs: (id) => ` data-from="${byId[id].from}" data-to="${byId[id].to}"${byId[id].scroll ? ` data-scroll="${byId[id].scroll}"` : ''}`,
    hint: home.film.hint,
    // a figure that follows the picture (content/film.js `readout`: keys [second, value])
    extra: (id) => {
      const r = byId[id].readout;
      if (!r) return '';
      return `<p class="readout${typeof r.keys[0][1] === 'string' ? ' readout--ba' : ''}" aria-live="off"><span class="readout__label">${esc(r.label)}</span> <span class="readout__value" data-film-readout="${esc(JSON.stringify(r.keys))}">${esc(String(r.keys[0][1]))}</span>${r.unit ? `<span class="readout__unit"> ${esc(r.unit)}</span>` : ''}</p>`;
    },
  });
  const tabs = film.chapters
    .filter((c) => c.tab)
    .map((c) => `<li><a href="#chapitre-${c.id}" data-film-at="${at(c.id)}" data-tab="${c.id}">${esc(c.tab)}</a></li>`)
    .join('');
  return `<section class="tour film" id="visite" aria-label="${esc(home.film.label)}" style="--travel:${Math.round(filmTravel(film) * 100)}" data-film data-duration="${film.duration}" data-start="${film.start}" data-pace="${esc(JSON.stringify(film.pace))}" data-src-preview="${film.sources.preview}" data-wide-srcset="${film.sources.wide.map((v) => `${v.src} ${v.w}w`).join(', ')}" data-src-preview-tall="${film.sources.previewTall}" data-tall-srcset="${film.sources.tall.map((v) => `${v.src} ${v.w}w`).join(', ')}">
    <div class="tour__stage" data-stage>
      <video class="tour__video" muted playsinline preload="none" disablepictureinpicture aria-hidden="true" tabindex="-1" data-video></video>
      <div class="tour__chapters">
      ${chapters}
      </div>
      <div class="tour__hud film__hud">
        <nav class="film__tabs" aria-label="Prestations présentées dans la vidéo"><ul>${tabs}</ul></nav>
        <div class="tour__progress" aria-hidden="true"><span data-progress></span></div>
      </div>
      <p class="tour__loading" data-loading hidden><span class="tour__spinner" aria-hidden="true"></span><span>${esc(home.film.loading)}</span> <span data-loading-pct></span></p>
      <a class="tour__skip btn btn--ghost btn--sm" href="#prestations" data-scroll>${esc(home.tour.skip)} <span aria-hidden="true">↓</span></a>
    </div>
  </section>`;
}

/** The 3D tour on its own page (noindex): a showcase, and the scene `npm run stills` films. */
export function tourDemoPage(ctx) {
  const body = `
  ${tourSection(ctx)}
  <section class="section" id="prestations"><div class="container"><p><a href="/">Retour à l’accueil</a></p></div></section>`;
  return page(ctx, { title: `Visite 3D de l’atelier | ${ctx.business.name}`, description: ctx.home.seo.description, path: '/design/visite-3d/', noindex: true, bodyClass: 'page-home' }, body);
}

export function homePage(ctx) {
  const { home, services, business: b } = ctx;
  const cards = services
    .filter((s) => !s.sub)
    .map(
      (s, i) => `<li class="service-card">
        <a href="/${s.slug}/" class="service-card__link">
          <div class="service-card__media">${realOr(ctx, s.cardPhoto, () => still(s.still, '', { sizes: '(min-width: 960px) 33vw, (min-width: 600px) 50vw, 100vw' }), { alt: '', sizes: '(min-width: 960px) 33vw, (min-width: 600px) 50vw, 100vw' })}</div>
          <div class="service-card__body">
            <p class="kicker">0${i + 1}</p>
            <h3>${esc(s.name)}</h3>
            <p>${esc(s.short)}</p>
            <span class="service-card__more">Découvrir <span aria-hidden="true">→</span></span>
          </div>
        </a>
      </li>`
    )
    .join('\n      ');

  const body = `
  ${filmSection(ctx)}

  <div class="marquee" aria-hidden="true"><div class="marquee__track">${Array.from({ length: 2 }, () => services.filter((s) => !s.sub).map((s) => `<span>${esc(s.name)}</span>`).join('<i>◆</i>') + '<i>◆</i>').join('')}</div></div>

  <section class="section intro" id="prestations" aria-labelledby="prestations-title">
    <div class="container">
      <div class="section-head">
        <p class="kicker">${esc(b.name)}</p>
        <h2 id="prestations-title">${rich(home.servicesTitle)}</h2>
        <p class="lead">${esc(home.intro.text)}</p>
      </div>
      <ul class="service-grid">
      ${cards}
      </ul>
    </div>
  </section>

  <section class="section section--paper process" aria-labelledby="process-title">
    <div class="container">
      <h2 id="process-title">${rich(home.process.title)}</h2>
      <ol class="steps">${home.process.steps.map((s) => `<li><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join('')}</ol>
    </div>
  </section>

  <section class="section section--paper law" aria-labelledby="law-title">
    <div class="container law__inner">
      <h2 id="law-title">${esc(home.law.title)}</h2>
      <div>
        <ul class="checklist">${home.law.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        <p class="law__note">${esc(home.law.note)} <a href="/vitres-teintees/">En savoir plus sur les vitres teintées</a>.</p>
      </div>
    </div>
  </section>

  ${visitBlock(ctx, { title: `Votre atelier à ${b.address?.city || b.department}, près de Tours` })}
  ${realisationsBlock(ctx)}
  ${partnersBlock(ctx)}
  ${reviewsBlock(ctx)}
  ${instagramBlock(ctx)}
  ${faqBlock(home.faq)}
  ${ctaBand(ctx)}`;

  // the first image of the film, the one each screen shape will show (see filmStill)
  const poster =
    `<link rel="preload" as="image" href="/img/film/hero-1600.webp" imagesrcset="/img/film/hero-960.webp 960w, /img/film/hero-1600.webp 1600w, /img/film/hero-2560.webp 2560w" imagesizes="max(100vw, 177.7vh)" media="(min-aspect-ratio: 2/3)" fetchpriority="high">` +
    `<link rel="preload" as="image" href="/img/film/hero-tall-720.webp" imagesrcset="/img/film/hero-tall-720.webp 720w, /img/film/hero-tall-1080.webp 1080w" imagesizes="max(100vw, 56.25vh)" media="(max-aspect-ratio: 2/3)" fetchpriority="high">`;
  return page(
    ctx,
    {
      title: home.seo.title,
      description: home.seo.description,
      path: '/',
      bodyClass: 'page-home',
      preload: poster,
      extra: [ld(localBusiness(ctx)), ld(faqLd(home.faq)), ld({ '@context': 'https://schema.org', '@type': 'WebSite', name: b.name, url: abs(b, '/'), inLanguage: 'fr-FR', publisher: { '@id': abs(b, '/#entreprise') } })].join('\n'),
    },
    body
  );
}

// ------------------------------------------------------------------------- service
/** Structured prices, only for grids validated by the business (never the example prices). */
// ------------------------------------------------------------------------- rich service sections
/** text with *emphasis* and [internal links](/path/) */
const inline = (t = '') => rich(t).replace(/\[([^\]]+)\]\((\/[^)\s]*)\)/g, '<a href="$2">$1</a>');
const cell = (v) => (v === true ? '<span class="yes" aria-label="oui">✓</span>' : v === false ? '<span class="no" aria-label="non">—</span>' : inline(String(v)));

/**
 * The long-form sections of a service page (content: `sections` of a service), between the
 * simulator and the benefits. Types:
 * - prose    { id, kicker?, title, text: [], points? }        a few paragraphs, an optional list
 * - blocks   { id, title, lead?, items: [{ title, text: [] }] } short explanations side by side
 * - packages { id, title, lead?, items: [{ id, label, tagline?, includes: [], forWho?, price? }], note? }
 * - compare  { id, title, lead?, caption?, head: [], rows: [[label, ...cells]], note? }  ✓ / — / text
 * - steps    { id, title, lead?, items: [{ title, text }] }   the work, step by step
 * Text accepts *emphasis* and [links](/path/).
 */
function richSections(ctx, s) {
  if (!s.sections) return '';
  return s.sections
    .map((x, i) => {
      const paper = i % 2 === 0 ? ' section--paper' : '';
      const head = `${x.kicker ? `<p class="kicker">${esc(x.kicker)}</p>` : ''}<h2 id="${x.id}-title">${rich(x.title)}</h2>${x.lead ? `<p class="lead">${inline(x.lead)}</p>` : ''}`;
      const note = x.note ? `<p class="rich__note">${inline(x.note)}</p>` : '';
      let inner = '';
      if (x.type === 'prose')
        inner = `<div class="container container--narrow">${head}${x.text.map((t) => `<p>${inline(t)}</p>`).join('')}${x.points ? `<ul class="checklist">${x.points.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>` : ''}${note}</div>`;
      else if (x.type === 'blocks')
        inner = `<div class="container"><div class="section-head">${head}</div><div class="cov-films__grid">${x.items.map((b) => `<div class="cov-films__block"><h3>${rich(b.title)}</h3>${b.text.map((t) => `<p>${inline(t)}</p>`).join('')}</div>`).join('')}</div>${note}</div>`;
      else if (x.type === 'packages')
        inner = `<div class="container"><div class="section-head">${head}</div><ul class="cov-offers__list packages-list">${x.items
          .map(
            (p) => `<li class="cov-offer" id="forfait-${p.id}">
          <p class="kicker">${esc(p.kicker || 'Forfait')}</p>
          <h3>${esc(p.label)}</h3>
          ${p.tagline ? `<p>${inline(p.tagline)}</p>` : ''}
          <ul class="checklist">${p.includes.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>
          ${p.forWho ? `<p class="package__for"><strong>Pour qui :</strong> ${inline(p.forWho)}</p>` : ''}
          <p class="cov-offer__price"><span>Tarif</span> <strong>${esc(p.price || 'Sur devis')}</strong></p>
          <a class="btn btn--ghost btn--sm" href="/contact/?prestation=${s.slug}&amp;forfait=${p.id}">Demander un devis</a>
        </li>`
          )
          .join('')}</ul>${note}</div>`;
      else if (x.type === 'compare')
        inner = `<div class="container"><div class="section-head">${head}</div><div class="compare"><table class="compare__table">${x.caption ? `<caption>${inline(x.caption)}</caption>` : ''}<thead><tr>${x.head.map((h, j) => `<th scope="col"${j === 0 ? ' class="compare__corner"' : ''}>${inline(h)}</th>`).join('')}</tr></thead><tbody>${x.rows
          .map((r) => `<tr><th scope="row">${inline(r[0])}</th>${r.slice(1).map((v) => `<td>${cell(v)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>${note}</div>`;
      else if (x.type === 'steps')
        inner = `<div class="container container--narrow">${head}<ol class="rich-steps">${x.items.map((st) => `<li><h3>${rich(st.title)}</h3><p>${inline(st.text)}</p></li>`).join('')}</ol>${note}</div>`;
      return `<section class="section rich rich--${x.type}${paper}" id="${x.id}" aria-labelledby="${x.id}-title">${inner}</section>`;
    })
    .join('\n');
}

function offersFor(ctx, slug) {
  const { tint, vehicleTypes, lights, headlights } = ctx.pricing;
  const ttc = { '@type': 'PriceSpecification', priceCurrency: 'EUR', valueAddedTaxIncluded: true };
  if (slug === 'feux-arriere-teintes')
    return {
      offers: { '@type': 'AggregateOffer', priceCurrency: 'EUR', lowPrice: String(lights.perPair.min), highPrice: String(lights.perPair.max), offerCount: '2', description: 'Covering fumé : prix TTC indicatif par paire de feux, selon le véhicule' },
    };
  if (slug === 'renovation-phares')
    return {
      offers: [
        { '@type': 'Offer', name: 'Rénovation des deux phares', price: String(headlights.renovation), priceCurrency: 'EUR', priceSpecification: { ...ttc, price: headlights.renovation } },
        ...headlights.options.map((o) => ({ '@type': 'Offer', name: `Option : ${o.label}`, price: String(o.price), priceCurrency: 'EUR', priceSpecification: { ...ttc, price: o.price } })),
      ],
    };
  if (slug !== 'vitres-teintees' || !tint.validated) return {};
  const offer = (name, price) => ({ '@type': 'Offer', name, price: String(price), priceCurrency: tint.currency, availability: 'https://schema.org/InStock', priceSpecification: { ...ttc, price } });
  const items = [
    ...vehicleTypes.map((v) => offer(`Vitres teintées 3/4 arrière — ${v.label}`, tint.rearPackage[v.id])),
    ...vehicleTypes.map((v) => offer(`Vitres teintées véhicule complet — ${v.label}`, tint.rearPackage[v.id] + tint.frontWithRear)),
    offer('Vitres avant seules', tint.frontOnly),
  ];
  const prices = items.map((o) => Number(o.price));
  return {
    offers: { '@type': 'AggregateOffer', priceCurrency: tint.currency, lowPrice: String(Math.min(...prices)), highPrice: String(Math.max(...prices)), offerCount: String(items.length) },
    hasOfferCatalog: { '@type': 'OfferCatalog', name: 'Tarifs de pose de films teintés', itemListElement: items },
  };
}

/** the two buttons under a service page's title (s.cta overrides: { label, href } for the second) */
function heroCtas(s) {
  const quote = `<a class="btn btn--primary" href="/contact/?prestation=${s.slug}">Demander un devis</a>`;
  if (s.heroCta) return `${quote}<a class="btn btn--ghost" href="${esc(s.heroCta.href)}" data-scroll>${esc(s.heroCta.label)}</a>`;
  if (s.slug === 'renovation-phares') return `${quote}<a class="btn btn--ghost" href="#tarifs" data-scroll>Voir les tarifs</a>`;
  return `<a class="btn btn--primary" href="#simulateur" data-scroll>Simuler et voir le prix</a><a class="btn btn--ghost" href="/contact/?prestation=${s.slug}">Demander un devis</a>`;
}

export function servicePage(ctx, s) {
  if (s.slug === 'covering-dechromage') return coveringServicePage(ctx, s);
  // a real job photo for the header when one is published (content/realisations.js), else the 3D still
  const heroJob = s.heroPhoto ? jobOf(ctx, s.heroPhoto) : null;
  const hero = heroJob?.photo || null;
  const b = ctx.business;
  const others = ctx.services.filter((o) => o.slug !== s.slug);
  const law = s.law
    ? `<section class="section section--paper" aria-labelledby="law-${s.slug}"><div class="container container--narrow">
        <h2 id="law-${s.slug}">Bon à savoir</h2>
        <ul class="checklist">${s.law.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      </div></section>`
    : '';
  const serviceLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: s.name,
    serviceType: s.name,
    description: s.seo.description,
    provider: { '@id': abs(b, '/#entreprise') },
    areaServed: [{ '@type': 'City', name: b.address?.city }, { '@type': 'City', name: 'Tours' }, { '@type': 'AdministrativeArea', name: `${b.department} (${b.departmentCode})` }],
    url: abs(b, `/${s.slug}/`),
    image: abs(b, shareImage(hero, s)),
    ...offersFor(ctx, s.slug),
  };
  const body = `
  <article class="service">
    <header class="service-hero">
      <div class="service-hero__media">${hero ? `${heroPicture(hero)}<p class="service-hero__credit">${esc(heroJob.job.vehicle)} · réalisation ${esc(b.name)}</p>` : still(s.still, `${s.name} — ${b.name}`, { eager: true })}</div>
      <div class="container service-hero__copy">
        <nav class="breadcrumb" aria-label="Fil d’Ariane"><ol><li><a href="/">Accueil</a></li><li aria-current="page">${esc(s.name)}</li></ol></nav>
        <p class="kicker">${esc(b.name)} · ${esc(placeLabel(b))}</p>
        <h1>${rich(s.h1)}</h1>
        <p class="lead">${esc(s.intro)}</p>
        <div class="ctas">${heroCtas(s)}</div>
      </div>
    </header>
    ${simFor(ctx, s.slug)}
    ${richSections(ctx, s)}

    <section class="section" aria-labelledby="benefits-${s.slug}">
      <div class="container">
        <h2 id="benefits-${s.slug}">Ce que vous y gagnez</h2>
        <ul class="benefits">${s.benefits.map((x) => `<li><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></li>`).join('')}</ul>
      </div>
    </section>

    ${
      (s.sections || []).some((x) => x.type === 'steps')
        ? '' // the page already tells the work step by step
        : `<section class="section section--paper" aria-labelledby="steps-${s.slug}">
      <div class="container container--narrow">
        <h2 id="steps-${s.slug}">Déroulé de la prestation</h2>
        <ol class="numbered">${s.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      </div>
    </section>`
    }
    ${law}
    ${realisationsBlock(ctx, { service: s.slug, title: `${s.name} : nos réalisations`, exclude: heroJob?.job.id })}
    ${faqBlock(s.faq)}
  </article>

  ${guideFor(ctx, s.slug)}
  ${partnersBlock(ctx)}
  ${visitBlock(ctx, { title: `${s.name} à ${b.address?.city || b.department}, près de Tours`, id: 'atelier', map: false })}
  <section class="section related" aria-labelledby="related-title">
    <div class="container">
      <h2 id="related-title">Nos autres prestations</h2>
      <ul class="related__list">${others.map((o) => `<li><a href="/${o.slug}/"><strong>${esc(o.name)}</strong><span>${esc(o.tagline || o.short)}</span></a></li>`).join('')}</ul>
    </div>
  </section>
  ${ctaBand(ctx)}`;
  const title = s.seo.title;
  return page(
    ctx,
    {
      title,
      description: s.seo.description,
      path: `/${s.slug}/`,
      image: shareImage(hero, s),
      bodyClass: 'page-service',
      extra: [ld(serviceLd), ld(faqLd(s.faq)), ld(breadcrumbLd(b, [{ name: 'Accueil', path: '/' }, { name: s.name, path: `/${s.slug}/` }]))].join('\n'),
      preload: hero
        ? heroPreload(hero)
        : `<link rel="preload" as="image" href="/stills/${s.still}-1600.webp" imagesrcset="/stills/${s.still}-960.webp 960w, /stills/${s.still}-1600.webp 1600w" imagesizes="100vw" fetchpriority="high">`,
    },
    body
  );
}

// ------------------------------------------------------------------------- covering & déchromage
/** frDate for an ISO day (2026-10-13 -> 13 octobre 2026) */
const frDay = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function coveringServicePage(ctx, s) {
  const b = ctx.business;
  const heroJob = s.heroPhoto ? jobOf(ctx, s.heroPhoto) : null;
  const hero = heroJob?.photo || null;
  // the job shown in full under the header (content/covering.js, feature)
  const F = CP.feature;
  const fJob = F && (ctx.realisations || []).find((r) => r.id === F.job);
  const fPhoto = (id) => fJob?.photos.find((p) => p.id === id);
  const fMain = fJob && fPhoto(F.main);
  const feature = fMain
    ? `<section class="section cov-feature" aria-labelledby="feature-title">
      <div class="container">
        <div class="cov-feature__grid">
          <figure class="cov-feature__main">${photo(fMain, { sizes: '(min-width: 900px) 56vw, 100vw' })}</figure>
          <div class="cov-feature__copy">
            <p class="kicker">${esc(F.kicker)}</p>
            <h2 id="feature-title">${rich(F.title)}</h2>
            ${F.text.map((t) => `<p>${esc(t)}</p>`).join('')}
            <dl class="cov-feature__facts">${F.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
            <a class="btn btn--primary" href="/contact/?prestation=${s.slug}">${esc(F.cta)}</a>
          </div>
        </div>
        <ul class="cov-feature__strip">${F.strip
          .map((x) => ({ ...x, p: fPhoto(x.id) }))
          .filter((x) => x.p)
          .map((x) => `<li><figure>${photo(x.p, { sizes: '(min-width: 900px) 45vw, 100vw' })}<figcaption>${esc(x.caption)}</figcaption></figure></li>`)
          .join('')}</ul>
      </div>
    </section>`
    : '';
  const others = ctx.services.filter((o) => o.slug !== s.slug);
  const works = (ctx.realisations || []).filter((r) => r.service === s.slug);
  const insta = b.social?.instagram;
  const range = filmRanges[0];
  const verified = [...new Set(coveringFilms.map((f) => f.verified))].sort().pop();
  const offers = CP.offers.items
    .map(
      (o) => `<li class="cov-offer" id="offre-${o.id}">
        <h3>${esc(o.title)}</h3>
        <p>${esc(o.text)}</p>
        <ul class="checklist">${o.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <p class="cov-offer__price"><span>Tarif</span> <strong>${esc(CP.offers.price)}</strong></p>
        <a class="btn btn--ghost btn--sm" href="/contact/?prestation=${s.slug}">Demander un devis</a>
      </li>`
    )
    .join('');
  const table = `<details class="cov-refs">
          <summary>Les ${coveringFilms.length} références du nuancier (${esc(range.label)})</summary>
          <div class="cov-refs__scroll"><table>
            <caption>Références proposées à l’atelier, vérifiées sur le site de 3M France le ${esc(frDay(verified))}. Couleurs d’aperçu approximatives : le choix se fait sur l’échantillon réel.</caption>
            <thead><tr><th scope="col">Référence</th><th scope="col">Nom officiel</th><th scope="col">Teinte</th><th scope="col">Finition</th><th scope="col">Effet</th><th scope="col">Fiche</th></tr></thead>
            <tbody>${coveringFilms
              .map(
                (f) =>
                  `<tr><th scope="row"><i class="swatch" style="background:${f.preview}" aria-hidden="true"></i> ${esc(f.code)}</th><td lang="en">${esc(f.name)}</td><td>${esc(f.label)}</td><td>${esc(FINISHES[f.finish]?.label || f.finish)}</td><td>${esc(f.effects.map((e) => EFFECTS[e]?.label || e).join(', ') || '—')}</td><td><a href="${esc(f.source)}" rel="noopener" target="_blank">3M France<span class="visually-hidden"> : ${esc(f.code)}</span></a></td></tr>`
              )
              .join('')}</tbody>
          </table></div>
        </details>`;
  const serviceLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: s.name,
    serviceType: 'Covering automobile et déchromage',
    description: s.seo.description,
    provider: { '@id': abs(b, '/#entreprise') },
    areaServed: [{ '@type': 'City', name: b.address?.city }, { '@type': 'City', name: 'Tours' }, { '@type': 'AdministrativeArea', name: `${b.department} (${b.departmentCode})` }],
    url: abs(b, `/${s.slug}/`),
    image: abs(b, shareImage(hero, s)),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Covering et déchromage',
      itemListElement: CP.offers.items.map((o) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: o.title, description: o.text } })),
    },
  };
  const body = `
  <article class="service service--covering">
    <header class="service-hero service-hero--light">
      <div class="service-hero__media">${hero ? `${heroPicture(hero)}<p class="service-hero__credit">${esc(heroJob.job.vehicle)} · réalisation ${esc(b.name)}</p>` : `${still(s.still, CP.heroAlt, { eager: true })}<p class="service-hero__credit">Rendu 3D indicatif</p>`}</div>
      <div class="container service-hero__copy">
        <nav class="breadcrumb" aria-label="Fil d’Ariane"><ol><li><a href="/">Accueil</a></li><li aria-current="page">${esc(s.name)}</li></ol></nav>
        <p class="kicker">${esc(b.name)} · ${esc(placeLabel(b))}</p>
        <h1>${rich(s.h1)}</h1>
        <p class="lead">${esc(s.intro)}</p>
        <div class="ctas"><a class="btn btn--primary" href="/contact/?prestation=${s.slug}">Demander un devis</a><a class="btn btn--ghost" href="#offres-title" data-scroll>Voir les offres</a></div>
      </div>
    </header>
    ${feature}

    <section class="section cov-offers" aria-labelledby="offres-title">
      <div class="container">
        <div class="section-head"><h2 id="offres-title">${esc(CP.offers.title)}</h2><p class="lead">${esc(CP.offers.priceNote)}</p></div>
        <ul class="cov-offers__list">${offers}</ul>
      </div>
    </section>

    <section class="section section--paper cov-films" aria-labelledby="films-title">
      <div class="container">
        <h2 id="films-title">${esc(CP.films.title)}</h2>
        <div class="cov-films__grid">${CP.films.blocks.map((x) => `<div class="cov-films__block"><h3>${esc(x.title)}</h3>${x.text.map((t) => `<p>${esc(t)}</p>`).join('')}</div>`).join('')}</div>
        ${table}
      </div>
    </section>

    ${richSections(ctx, s)}

    <section class="section" aria-labelledby="benefits-${s.slug}">
      <div class="container">
        <h2 id="benefits-${s.slug}">Ce que vous y gagnez</h2>
        <ul class="benefits">${s.benefits.map((x) => `<li><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></li>`).join('')}</ul>
      </div>
    </section>

    <section class="section section--paper" aria-labelledby="steps-${s.slug}">
      <div class="container container--narrow">
        <h2 id="steps-${s.slug}">Déroulé de la prestation</h2>
        <ol class="numbered">${s.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      </div>
    </section>

    ${
      works.length
        ? realisationsBlock(ctx, { service: s.slug, title: CP.works.title, exclude: fMain ? F.job : null })
        : `<section class="section section--tight" aria-labelledby="works-cov"><div class="container container--narrow"><h2 id="works-cov">${esc(CP.works.title)}</h2><p>${esc(CP.works.empty)}</p>${insta ? `<p><a class="btn btn--ghost" href="${esc(insta)}" rel="noopener" target="_blank">Voir l’atelier sur Instagram</a></p>` : ''}</div></section>`
    }
    ${faqBlock(s.faq)}
  </article>

  <section class="cta-band">
    <div class="container cta-band__inner">
      <div><h2>Un projet de covering ou de déchromage ?</h2><p>Décrivez votre véhicule et votre idée : nous étudions le projet et revenons vers vous avec un devis.</p></div>
      <a class="btn btn--primary" href="/contact/?prestation=${s.slug}">Demander un devis</a>
    </div>
  </section>
  ${partnersBlock(ctx)}
  ${visitBlock(ctx, { title: `${s.name} à ${b.address?.city || b.department}, près de Tours`, id: 'atelier', map: false })}
  <section class="section related" aria-labelledby="related-title">
    <div class="container">
      <h2 id="related-title">Nos autres prestations</h2>
      <ul class="related__list">${others.map((o) => `<li><a href="/${o.slug}/"><strong>${esc(o.name)}</strong><span>${esc(o.tagline || o.short)}</span></a></li>`).join('')}</ul>
    </div>
  </section>`;
  return page(
    ctx,
    {
      title: s.seo.title,
      description: s.seo.description,
      path: `/${s.slug}/`,
      image: shareImage(hero, s),
      bodyClass: 'page-service page-covering',
      extra: [ld(serviceLd), ld(faqLd(s.faq)), ld(breadcrumbLd(b, [{ name: 'Accueil', path: '/' }, { name: s.name, path: `/${s.slug}/` }]))].join('\n'),
      preload: hero
        ? heroPreload(hero)
        : `<link rel="preload" as="image" href="/stills/${s.still}-1600.webp" imagesrcset="/stills/${s.still}-960.webp 960w, /stills/${s.still}-1600.webp 1600w" imagesizes="100vw" fetchpriority="high">`,
    },
    body
  );
}

/** "Bon à savoir" teaser linking a service page to its guide */
function guideFor(ctx, slug) {
  const related = (ctx.guides || []).filter((x) => x.service === slug);
  const g = related[0];
  if (!g) return '';
  const more = related.slice(1);
  return `<section class="section section--tight guide-teaser">
  <div class="container container--narrow">
    <a class="guide-teaser__card reveal-up" href="/guides/${g.slug}/">
      <span class="kicker">Guide · ${esc(g.kicker)}</span>
      <strong>${esc(g.title)}</strong>
      <span class="guide-teaser__more">Lire le guide <span aria-hidden="true">→</span></span>
    </a>
    ${more.length ? `<ul class="guide-teaser__list">${more.map((m) => `<li><a href="/guides/${m.slug}/">${esc(m.title)}</a></li>`).join('')}</ul>` : ''}
  </div>
</section>`;
}

// ------------------------------------------------------------------------- contact
/** a required form field: label with its star, the control, the red line shown when it is missing */
const field = (id, label, open, error, tag = 'input') =>
  `<label for="${id}">${esc(label)} <span class="req" aria-hidden="true">*</span></label>${open} aria-describedby="err-${id}">${tag === 'textarea' ? '</textarea>' : ''}<p class="form__error" id="err-${id}" data-error-for="${id}" hidden>${esc(error)}</p>`;

export function contactPage(ctx) {
  const { contactPage: c, business: b, services } = ctx;
  const formsubmit = /formsubmit\.co/.test(b.formEndpoint || '');
  const body = `
  <section class="section page-intro">
    <div class="container container--narrow">
      <nav class="breadcrumb" aria-label="Fil d’Ariane"><ol><li><a href="/">Accueil</a></li><li aria-current="page">Contact</li></ol></nav>
      <h1>${esc(c.h1)}</h1>
      <p class="lead">${esc(c.intro)}</p>
    </div>
  </section>
  <section class="section section--tight">
    <div class="container contact-grid">
      <form class="form" data-form action="${esc(b.formEndpoint || '')}" method="post" novalidate>
        <p class="form__req">Champs obligatoires marqués d’un <span class="req" aria-hidden="true">*</span> ; la photo et le rendez-vous sont facultatifs.</p>
        <div class="form__summary" role="alert" data-form-summary hidden></div>
        <div class="form__row form__row--2">
          <div>${field('f-last', 'Nom', '<input id="f-last" name="nom" autocomplete="family-name" required', 'Indiquez votre nom.')}</div>
          <div>${field('f-first', 'Prénom', '<input id="f-first" name="prenom" autocomplete="given-name" required', 'Indiquez votre prénom.')}</div>
        </div>
        <div class="form__row form__row--2">
          <div>${field('f-email', 'E-mail', '<input id="f-email" name="email" type="email" autocomplete="email" required', 'Indiquez une adresse e-mail valide, par exemple prenom.nom@exemple.fr.')}</div>
          <div>${field('f-phone', 'Téléphone', '<input id="f-phone" name="telephone" type="tel" autocomplete="tel" inputmode="tel" pattern="[0-9+().\s\-]{10,20}" required', 'Indiquez un numéro de téléphone, par exemple 06 12 34 56 78.')}</div>
        </div>
        <div class="form__row form__row--3">
          <div>${field('f-make', 'Marque du véhicule', '<input id="f-make" name="marque" placeholder="ex. Peugeot" required', 'Indiquez la marque du véhicule.')}</div>
          <div>${field('f-model', 'Modèle du véhicule', '<input id="f-model" name="modele" placeholder="ex. 308 SW" required', 'Indiquez le modèle du véhicule.')}</div>
          <div>${field('f-year', 'Année du véhicule', `<input id="f-year" name="annee" type="number" inputmode="numeric" min="1950" max="${new Date().getFullYear() + 1}" placeholder="ex. 2019" required`, `Indiquez l’année du véhicule (entre 1950 et ${new Date().getFullYear() + 1}).`)}</div>
        </div>
        <fieldset class="form__row" data-required-group aria-describedby="err-presta">
          <legend>Prestation(s) souhaitée(s) <span class="req" aria-hidden="true">*</span></legend>
          <div class="choices">${services.map((s) => `<label class="choice"><input type="checkbox" name="prestations" value="${s.slug}"> ${esc(s.name)}</label>`).join('')}<label class="choice"><input type="checkbox" name="prestations" value="autre"> Autre demande</label></div>
          <p class="form__error" id="err-presta" data-error-for="prestations" hidden>Choisissez au moins une prestation (ou « Autre demande »).</p>
        </fieldset>
        <div class="form__row">
          ${field('f-msg', 'Votre message', '<textarea id="f-msg" name="message" rows="5" required', 'Écrivez votre message : ce que vous souhaitez faire sur le véhicule.', 'textarea')}
        </div>
        ${`<div class="form__row">
          <label for="f-files">Photos ou documents <span class="optional">(facultatif)</span></label>
          <input id="f-files" name="attachment" type="file" accept="image/*,.pdf" multiple data-max-mb="10">
          <p class="form__hint">Photos du véhicule, des vitres, des phares ou de la carrosserie. Images (JPG, PNG, HEIC…) ou PDF, 10 Mo maximum au total. Inutile d’envoyer une carte grise complète.</p>
        </div>`}
        <fieldset class="form__row form__row--2 form__slot">
          <legend>Rendez-vous souhaité <span class="optional">(facultatif)</span></legend>
          <div><label for="f-date">À partir du</label><input id="f-date" name="date_souhaitee" type="date"></div>
          <div><label for="f-slot">Moment</label><select id="f-slot" name="moment"><option value="">Indifférent</option><option>Matin (8 h – 12 h)</option><option>Après-midi (13 h – 17 h)</option></select></div>
          <p class="form__hint">Atelier ouvert du lundi au vendredi. Ce n’est pas une réservation : nous vous confirmons le créneau.</p>
        </fieldset>
        <div class="form__row form__consent">
          <label class="choice"><input type="checkbox" name="consentement" required aria-describedby="err-consent"> J’accepte que mes données soient utilisées pour répondre à ma demande (voir <a href="/mentions-legales/#confidentialite">confidentialité</a>). <span class="req" aria-hidden="true">*</span></label>
          <p class="form__error" id="err-consent" data-error-for="consentement" hidden>Cochez cette case pour que nous puissions vous répondre.</p>
        </div>
        <input type="text" name="${formsubmit ? '_honey' : '_gotcha'}" class="visually-hidden" tabindex="-1" autocomplete="off" aria-hidden="true">
        ${formsubmit ? '<input type="hidden" name="_subject" value="Nouvelle demande de devis"><input type="hidden" name="_template" value="table">' : ''}
        <button class="btn btn--primary" type="submit">Envoyer la demande</button>
        <p class="form__status" role="status" aria-live="polite" data-form-status></p>
      </form>
      <div class="contact-card">
        <h2>Nous joindre</h2>
        <p>${esc(b.name)} — ${esc(b.address?.city || '')} (${esc(b.departmentCode)})</p>
        ${contactLines(b)}
        ${socialLinks(b, 'social')}
      </div>
    </div>
  </section>
  ${
    b.bookingUrl
      ? `<section class="section section--paper booking" id="rendez-vous" aria-labelledby="booking-title">
    <div class="container">
      <div class="section-head"><h2 id="booking-title">Réserver un créneau</h2><p class="lead">Choisissez directement un créneau libre de l’atelier : seuls les moments réellement disponibles sont proposés. Vous recevez une confirmation par e-mail.</p></div>
      <div class="booking__frame"><iframe src="${esc(b.bookingUrl)}${b.bookingUrl.includes('?') ? '&' : '?'}embed=true&amp;theme=dark" title="Réservation d’un créneau à l’atelier" loading="lazy" allow="clipboard-write"></iframe></div>
      <p class="price-note">Un créneau réservé n’engage ni prix ni prestation : nous confirmons le détail avec vous. Un empêchement ? Le lien de la confirmation permet de déplacer ou d’annuler.</p>
    </div>
  </section>`
      : ''
  }
  ${visitBlock(ctx, { title: 'Venir à l’atelier' })}`;
  return page(ctx, { title: c.seo.title, description: c.seo.description, path: '/contact/', bodyClass: 'page-contact', extra: ld(localBusiness(ctx)) }, body);
}

// ------------------------------------------------------------------------- legal
export function legalPage(ctx) {
  const { legalPage: l, business: b } = ctx;
  const todo = (v, label) => (v ? esc(v) : `<span class="todo">${esc(label)} à compléter</span>`);
  const body = `
  <section class="section page-intro">
    <div class="container container--narrow prose">
      <h1>Mentions légales</h1>
      <h2>Éditeur du site</h2>
      <p><strong>${esc(b.name)}</strong>${b.legalName ? ` — nom commercial de ${esc(b.legalName)}` : ''}<br>${b.legalForm ? `${esc(b.legalForm)}<br>` : ''}${todo(addressLine(b), 'Adresse du siège')}<br>SIRET : ${todo(b.siret, 'SIRET')}<br>Téléphone : ${todo(b.phone, 'Téléphone')}<br>E-mail : ${todo(b.email, 'E-mail')}</p>
      <p>Directeur de la publication : ${todo(l.publisher, 'Nom')}</p>
      <h2>Hébergement</h2>
      <p>${todo(l.host?.name, 'Hébergeur')}<br>${todo(l.host?.address, 'Adresse de l’hébergeur')}</p>
      <h2>Propriété intellectuelle</h2>
      <p>Les textes, visuels et le logo de ${esc(b.name)} sont protégés. Les marques et logos des fabricants cités (films, outillage, produits) ainsi que les marques et modèles de véhicules apparaissant sur le site appartiennent à leurs propriétaires respectifs ; la présence d’un véhicule n’implique aucun partenariat avec son constructeur.</p>
      ${(ctx.credits || []).length ? `<p>Modèles 3D utilisés sur le site :</p><ul>${ctx.credits.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
      <h2>Tarifs</h2>
      <p>Les prix affichés sur le site et dans les simulateurs sont indicatifs, toutes taxes comprises, et confirmés par un devis après examen du véhicule. Les rendus 3D sont des simulations : ils ne valent ni mesure ni garantie de résultat.</p>
      <h2>Médiation de la consommation</h2>
      <p>${l.mediator ? `En cas de litige non résolu avec l’atelier, vous pouvez recourir gratuitement au médiateur de la consommation : ${esc(l.mediator.name)}${l.mediator.url ? ` (<a href="${esc(l.mediator.url)}" rel="noopener">${esc(l.mediator.url.replace(/^https?:\/\//, ''))}</a>)` : ''}${l.mediator.address ? `, ${esc(l.mediator.address)}` : ''}.` : todo(null, 'Médiateur de la consommation')}</p>
      <h2 id="confidentialite">Données personnelles</h2>
      <p><strong>Responsable du traitement :</strong> ${esc(b.owner || b.name)}, ${esc(b.name)}${b.email ? `, ${esc(b.email)}` : ''}.</p>
      <p><strong>Données et finalité :</strong> les informations saisies dans le formulaire (identité, coordonnées, véhicule, prestation, message et éventuelles photos) servent uniquement à répondre à votre demande de devis ou de rendez-vous et à son suivi. Elles ne sont ni vendues ni cédées. N’envoyez que les photos utiles à la demande (inutile, par exemple, de joindre une carte grise complète).</p>
      <p><strong>Base légale :</strong> les mesures précontractuelles prises à votre demande (article 6.1.b du RGPD).</p>
      <p><strong>Destinataires :</strong> l’atelier uniquement.${b.formEndpoint && /formsubmit\.co/.test(b.formEndpoint) ? ' Le formulaire est acheminé par le service FormSubmit (formsubmit.co), prestataire établi hors de l’Union européenne, qui transmet votre demande par e-mail à l’atelier sans la publier.' : ''}</p>
      ${b.google?.placeId && b.google?.mapsApiKey ? '<p>Les avis Google affichés sur le site sont chargés depuis Google Maps Platform (Google Ireland Ltd) au moment de la visite ; Google reçoit alors l’adresse IP du visiteur.</p>' : ''}
      ${b.instagramFeed?.feedUrl ? '<p>Les dernières publications Instagram sont chargées depuis le service de flux qui les met à disposition ; ce service reçoit alors l’adresse IP du visiteur.</p>' : ''}
      <p><strong>Durée de conservation :</strong> ${l.retention ? esc(l.retention) : 'le temps nécessaire pour répondre à votre demande et en assurer le suivi'}.</p>
      <p><strong>Vos droits :</strong> vous pouvez demander l’accès à vos données, leur rectification, leur effacement, la limitation du traitement, vous y opposer ou demander leur portabilité en écrivant${b.email ? ` à ${esc(b.email)}` : ' à l’atelier'}. Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL (<a href="https://www.cnil.fr" rel="noopener">cnil.fr</a>).</p>
      <p>Ce site n’utilise pas de cookie publicitaire ni d’outil de mesure d’audience tiers. Les polices de caractères sont hébergées sur le site lui-même.</p>
    </div>
  </section>`;
  return page(ctx, { title: l.seo.title, description: l.seo.description, path: '/mentions-legales/', bodyClass: 'page-legal' }, body);
}

// ------------------------------------------------------------------------- atelier (local page)
export function atelierPage(ctx) {
  const { atelierPage: a, business: b, services } = ctx;
  const body = `
  <section class="section page-intro page-intro--atelier">
    <div class="container">
      <nav class="breadcrumb" aria-label="Fil d’Ariane"><ol><li><a href="/">Accueil</a></li><li aria-current="page">L’atelier</li></ol></nav>
      <p class="kicker">${esc(a.kicker)} · ${esc(b.address?.city || '')} (${esc(b.address?.postalCode || '')})</p>
      <h1>${esc(a.h1)}</h1>
      <p class="lead">${esc(a.intro)}</p>
    </div>
  </section>
  ${visitBlock(ctx, { title: 'Adresse, horaires et itinéraire', id: 'acces' })}
  <section class="section section--paper">
    <div class="container container--narrow prose">
      <h2>Venir depuis Tours et la Touraine</h2>
      <p>${esc(a.access)}</p>
      ${(b.nearby || []).length ? `<p>Nos clients viennent notamment de ${esc(b.nearby.slice(0, -1).join(', '))} et ${esc(b.nearby[b.nearby.length - 1])}.</p>` : ''}
    </div>
  </section>
  <section class="section" aria-labelledby="atelier-services">
    <div class="container">
      <h2 id="atelier-services">Ce que nous faisons à l’atelier</h2>
      <ul class="related__list">${services.map((s) => `<li><a href="/${s.slug}/"><strong>${esc(s.name)}</strong><span>${esc(s.tagline || s.short)}</span></a></li>`).join('')}</ul>
    </div>
  </section>
  ${partnersBlock(ctx)}
  ${reviewsBlock(ctx)}
  ${faqBlock(a.faq, 'Questions pratiques')}
  ${ctaBand(ctx)}`;
  return page(
    ctx,
    {
      title: a.seo.title,
      description: a.seo.description,
      path: '/atelier-vouvray/',
      image: '/stills/hero-1600.jpg',
      bodyClass: 'page-atelier',
      extra: [ld(localBusiness(ctx)), ld(faqLd(a.faq)), ld(breadcrumbLd(b, [{ name: 'Accueil', path: '/' }, { name: 'L’atelier', path: '/atelier-vouvray/' }]))].join('\n'),
    },
    body
  );
}

// ------------------------------------------------------------------------- guides
const frDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function guidesIndexPage(ctx) {
  const { guidesPage: g, guides, business: b } = ctx;
  const body = `
  <section class="section page-intro">
    <div class="container">
      <nav class="breadcrumb" aria-label="Fil d’Ariane"><ol><li><a href="/">Accueil</a></li><li aria-current="page">Guides</li></ol></nav>
      <h1>${esc(g.h1)}</h1>
      <p class="lead">${esc(g.intro)}</p>
    </div>
  </section>
  <section class="section section--tight">
    <div class="container">
      <ul class="guide-grid">${guides
        .map(
          // the first card's picture is the page's main one: loaded at once, first
          (x, i) => `<li class="guide-card reveal-up"><a href="/guides/${x.slug}/">
          <div class="guide-card__media">${realOr(ctx, x.photo, () => still(x.still, '', { sizes: '(min-width: 960px) 33vw, (min-width: 600px) 50vw, 100vw', eager: i === 0 }), { alt: '', sizes: '(min-width: 960px) 33vw, (min-width: 600px) 50vw, 100vw', eager: i === 0 })}</div>
          <div class="guide-card__body"><p class="kicker">${esc(x.kicker)}</p><h2>${esc(x.title)}</h2><p>${esc(x.summary || x.seo.description)}</p><span class="service-card__more">Lire <span aria-hidden="true">→</span></span></div>
        </a></li>`
        )
        .join('')}</ul>
    </div>
  </section>
  ${ctaBand(ctx)}`;
  return page(
    ctx,
    {
      title: g.seo.title,
      description: g.seo.description,
      path: '/guides/',
      bodyClass: 'page-guides',
      extra: ld(breadcrumbLd(b, [{ name: 'Accueil', path: '/' }, { name: 'Guides', path: '/guides/' }])),
    },
    body
  );
}

/** the service's pitch under a guide; with several wordings, each guide of the service its own */
function pitchFor(ctx, service, guide) {
  const p = service.simPitch;
  if (!Array.isArray(p)) return p;
  const i = (ctx.guides || []).filter((g) => g.service === service.slug).findIndex((g) => g.slug === guide.slug);
  return p[Math.max(0, i) % p.length];
}

/** share image of a guide: its photo's share card, else the 3D still */
const guideImage = (ctx, x) => (x.photo && ctx.ogIds?.has(x.photo.id) ? `${RP}${x.photo.id}-og.jpg` : `/stills/${x.still}-1600.jpg`);

export function guidePage(ctx, x) {
  const { business: b, services, guides } = ctx;
  const service = services.find((s) => s.slug === x.service);
  const others = guides.filter((o) => o.slug !== x.slug);
  const section = (sec) =>
    `<h2>${esc(sec.h2)}</h2>${(sec.p || []).map((t) => `<p>${esc(t)}</p>`).join('')}${sec.list ? `<ul>${sec.list.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}`;
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: x.title,
    description: x.seo.description,
    image: abs(b, guideImage(ctx, x)),
    datePublished: x.updated,
    dateModified: x.updated,
    inLanguage: 'fr-FR',
    author: { '@type': 'Organization', name: b.name, url: abs(b, '/') },
    publisher: { '@id': abs(b, '/#entreprise') },
    mainEntityOfPage: abs(b, `/guides/${x.slug}/`),
    about: service ? { '@type': 'Service', name: service.name, url: abs(b, `/${service.slug}/`) } : undefined,
  };
  const body = `
  <article class="guide">
    <header class="section page-intro guide__head">
      <div class="container container--narrow">
        <nav class="breadcrumb" aria-label="Fil d’Ariane"><ol><li><a href="/">Accueil</a></li><li><a href="/guides/">Guides</a></li><li aria-current="page">${esc(x.title)}</li></ol></nav>
        <p class="kicker">${esc(x.kicker)} · mis à jour le <time datetime="${x.updated}">${frDate(x.updated)}</time></p>
        <h1>${esc(x.title)}</h1>
        <p class="lead">${esc(x.intro)}</p>
      </div>
    </header>
    <div class="guide__media container">${realOr(ctx, x.photo, () => still(x.still, x.title, { eager: true }), { eager: true, sizes: '(min-width: 1200px) 1200px, 100vw' })}</div>
    <div class="section section--tight">
      <div class="container container--narrow prose">
        ${x.sections.map(section).join('\n        ')}
        ${service ? `<div class="guide__cta"><p><strong>${esc(service.name)} à ${esc(b.address?.city || '')}, près de Tours.</strong> ${SIMS.has(service.slug) ? esc(pitchFor(ctx, service, x) || 'Essayez le simulateur 3D et obtenez votre tarif en direct.') : esc(`${service.tagline || service.name} : tarifs, déroulé et questions fréquentes sur la page de la prestation.`)}</p><div class="ctas">${SIMS.has(service.slug) ? `<a class="btn btn--primary" href="/${service.slug}/#simulateur">Ouvrir le simulateur</a>` : `<a class="btn btn--primary" href="/${service.slug}/">Voir la prestation</a>`}<a class="btn btn--ghost" href="/contact/?prestation=${service.slug}">Demander un devis</a></div></div>` : ''}
      </div>
    </div>
    ${x.faq?.length ? faqBlock(x.faq) : ''}
  </article>
  <section class="section related" aria-labelledby="more-guides">
    <div class="container">
      <h2 id="more-guides">Autres guides</h2>
      <ul class="related__list">${others.map((o) => `<li><a href="/guides/${o.slug}/"><strong>${esc(o.title)}</strong><span>${esc(o.kicker)}</span></a></li>`).join('')}</ul>
    </div>
  </section>
  ${ctaBand(ctx)}`;
  return page(
    ctx,
    {
      title: x.seo.title,
      description: x.seo.description,
      path: `/guides/${x.slug}/`,
      image: guideImage(ctx, x),
      bodyClass: 'page-guide',
      extra: [
        ld(article),
        x.faq?.length ? ld(faqLd(x.faq)) : '',
        ld(breadcrumbLd(b, [{ name: 'Accueil', path: '/' }, { name: 'Guides', path: '/guides/' }, { name: x.title, path: `/guides/${x.slug}/` }])),
      ].join('\n'),
    },
    body
  );
}

// ------------------------------------------------------------------------- realisations
/** before / after comparison of two real photos (same angle, same light) */
function beforeAfter(ba, caption = '') {
  return `<figure class="ba" data-ba>
      <div class="ba__frame" style="--pos:50%">
        <img class="ba__img" src="${esc(ba.after)}" alt="Après : ${esc(ba.alt || '')}" loading="lazy" decoding="async">
        <img class="ba__img ba__before" src="${esc(ba.before)}" alt="Avant : ${esc(ba.alt || '')}" loading="lazy" decoding="async">
        <span class="ba__tag ba__tag--before" aria-hidden="true">Avant</span><span class="ba__tag ba__tag--after" aria-hidden="true">Après</span>
        <span class="ba__handle" aria-hidden="true"></span>
        <input class="ba__range" type="range" min="0" max="100" value="50" aria-label="Comparer avant et après${ba.alt ? ` : ${esc(ba.alt)}` : ''}">
      </div>
      ${caption ? `<figcaption>${caption}</figcaption>` : ''}
    </figure>`;
}

/** one job: photos or a before / after, the car, the work, a link to ask for the same. The short
 * story (`text`) is only told on /realisations/: elsewhere the card stays short (no repeated copy) */
function realisationCard(ctx, r, { story = true, eager = false } = {}) {
  const s = ctx.services.find((x) => x.slug === r.service);
  const shots = r.photos || [];
  const media = r.beforeAfter
    ? beforeAfter(r.beforeAfter)
    : shots[0]
      ? `<div class="work__media">${photo({ ...shots[0], alt: shots[0].alt || r.vehicle }, { sizes: '(min-width: 900px) 33vw, 100vw', cls: 'work__img', eager })}${
          shots.length > 1
            ? `<div class="work__thumbs" role="group" aria-label="Autres photos">${shots
                .map(
                  (p, i) =>
                    `<a href="${RP}${p.id}-1280.webp" data-work-photo="${p.id}" data-alt="${esc(p.alt || r.vehicle)}" data-focus="${esc(p.focus || '')}"${i === 0 ? ' aria-current="true"' : ''}><img src="${RP}${p.id}-320.webp" alt="" width="96" height="128" loading="lazy" decoding="async"${p.focus ? ` style="object-position:${esc(p.focus)}"` : ''}><span class="visually-hidden">Photo ${i + 1}</span></a>`
                )
                .join('')}</div>`
            : ''
        }</div>`
      : '';
  return `<li class="work" id="realisation-${esc(r.id)}" data-service="${esc(r.service)}">
      ${media}
      <div class="work__body">
        <p class="kicker">${esc(s?.shortName || s?.name || '')}${r.date ? ` · ${esc(r.date)}` : ''}</p>
        <h3>${esc(r.vehicle)}</h3>
        ${r.finish ? `<p class="work__finish">${esc(r.finish)}</p>` : ''}
        ${story && r.text ? `<p>${esc(r.text)}</p>` : ''}
        <a class="work__cta" href="/contact/?prestation=${esc(r.service)}">Demander une prestation similaire <span aria-hidden="true">→</span></a>
      </div>
    </li>`;
}

/** latest jobs (all, or one service); nothing at all while there is none */
function realisationsBlock(ctx, { service = null, limit = 3, title = 'Nos dernières réalisations', exclude = null } = {}) {
  const list = (ctx.realisations || []).filter((r) => (!service || r.service === service) && r.id !== exclude).slice(0, limit);
  if (!list.length) return '';
  return `<section class="section works-block" aria-labelledby="works-${service || 'all'}">
  <div class="container">
    <div class="section-head"><h2 id="works-${service || 'all'}">${esc(title)}</h2></div>
    <ul class="works">${list.map((r) => realisationCard(ctx, r, { story: false })).join('')}</ul>
    <p><a class="btn btn--ghost" href="/realisations/">Voir toutes les réalisations</a></p>
  </div>
</section>`;
}

export function realisationsPage(ctx) {
  const p = ctx.realisationsPage;
  const b = ctx.business;
  const used = ctx.services.filter((s) => ctx.realisations.some((r) => r.service === s.slug));
  const body = `
  <section class="section page-intro">
    <div class="container">
      <nav class="breadcrumb" aria-label="Fil d’Ariane"><ol><li><a href="/">Accueil</a></li><li aria-current="page">Réalisations</li></ol></nav>
      <h1>${esc(p.h1)}</h1>
      <p class="lead">${esc(p.intro)}</p>
      ${used.length > 1 ? `<div class="works-filter" role="group" aria-label="Filtrer par prestation" data-works-filter><button type="button" aria-pressed="true" data-filter="">Toutes</button>${used.map((s) => `<button type="button" aria-pressed="false" data-filter="${s.slug}">${esc(s.shortName || s.name)}</button>`).join('')}</div>` : ''}
      <h2 class="visually-hidden">Véhicules passés par l’atelier</h2>
      <ul class="works" data-works>${ctx.realisations.map((r, i) => realisationCard(ctx, r, { eager: i === 0 })).join('')}</ul>
    </div>
  </section>
  ${ctaBand(ctx)}`;
  return page(ctx, { title: p.seo.title, description: p.seo.description, path: '/realisations/', extra: ld(breadcrumbLd(b, [{ name: 'Accueil', path: '/' }, { name: 'Réalisations', path: '/realisations/' }])) }, body);
}

/** after a request sent with attachments (FormSubmit redirects the visitor here) */
export function thanksPage(ctx) {
  const t = ctx.contactPage.thanks;
  const b = ctx.business;
  const body = `
  <section class="section page-intro">
    <div class="container container--narrow">
      <p class="kicker">Devis</p>
      <h1>${esc(t.h1)}</h1>
      <p class="lead">${esc(t.text)}</p>
      <ul class="checklist">${t.next.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      <p>Une question en attendant ? ${b.phone ? `<a href="${telHref(b.phone)}">${esc(b.phone)}</a>` : ''}${b.phone && b.email ? ' · ' : ''}${b.email ? `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a>` : ''}</p>
      <div class="ctas"><a class="btn btn--primary" href="/">Retour à l’accueil</a><a class="btn btn--ghost" href="/atelier-vouvray/">Venir à l’atelier</a></div>
    </div>
  </section>`;
  return page(ctx, { title: t.title, description: ctx.contactPage.seo.description, path: '/contact/merci/', noindex: true }, body);
}

export function notFoundPage(ctx) {
  const body = `
  <section class="section page-intro">
    <div class="container container--narrow">
      <h1>Page introuvable</h1>
      <p class="lead">Cette page n’existe pas ou a été déplacée.</p>
      <div class="ctas"><a class="btn btn--primary" href="/">Retour à l’accueil</a><a class="btn btn--ghost" href="/contact/">Nous contacter</a></div>
    </div>
  </section>`;
  return page(ctx, { title: `Page introuvable | ${ctx.business.name}`, description: ctx.home.seo.description, path: '/404.html', noindex: true }, body);
}

// ------------------------------------------------------------------------- local pages (towns)
const DIRS = ['au nord', 'au nord-est', 'à l’est', 'au sud-est', 'au sud', 'au sud-ouest', 'à l’ouest', 'au nord-ouest'];
const dirFrom = (bearing) => DIRS[Math.round(bearing / 45) % 8];
const kmFr = (n) => String(n).replace('.', ',');
const deTown = (t) => (/^[AEIOUYÉÈ]/i.test(t) ? `d’${t}` : /^Le /.test(t) ? `du ${t.slice(3)}` : `de ${t}`);

/** short price line per service, from content/pricing.js */
function priceHint(ctx, slug) {
  const P = ctx.pricing;
  const f = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  if (slug === 'vitres-teintees') return `dès ${f(Math.min(...Object.values(P.tint.rearPackage)))} TTC`;
  if (slug === 'feux-arriere-teintes') return `${P.lights.perPair.min} à ${f(P.lights.perPair.max)} TTC la paire`;
  if (slug === 'renovation-phares') return `${f(P.headlights.renovation)} TTC les deux phares`;
  return 'sur devis';
}

export function zonePage(ctx, z) {
  const { business: b, services, zonesPage: zp } = ctx;
  const town = z.town;
  const dir = dirFrom(z.bearing);
  const from = deTown(town);
  const route = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${town}, France`)}&destination=${encodeURIComponent(addressLine(b))}`;
  // the A10 is named « L’Aquitaine » in the road data
  const roadName = (r) => (r.refs?.includes('A10') || r.name === 'L\'Aquitaine' ? `l’A10 (${r.name.replace(/^L'/, 'L’')})` : r.name);
  // every answer comes from this town's own route (scripts/map/towns.py): no sentence shared by all
  // the town pages
  const steps = z.roads.map((r) => `${roadName(r)} (${kmFr(r.km)} km)`);
  const faq = [
    {
      q: `Quelle distance entre ${town} et l’atelier ?`,
      a: `Environ ${kmFr(z.roadKm)} km par la route depuis le centre ${from} (${kmFr(z.crowKm)} km à vol d’oiseau) : l’atelier est ${dir} ${from}, à Vouvray, ${b.address.street}.`,
    },
    {
      q: `Par où partir de ${town} ?`,
      a: `Prenez ${steps[0]} ; le trajet compte ${z.roads.length} étape${z.roads.length > 1 ? 's' : ''} jusqu’à l’atelier, détaillées ci-dessus avec leur longueur.`,
    },
  ];
  const others = ctx.zones.filter((o) => o.slug !== z.slug).sort((a, c) => Math.abs(a.roadKm - z.roadKm) - Math.abs(c.roadKm - z.roadKm)).slice(0, 6);
  // two real jobs of the workshop, different on each town page (one window tinting job, one
  // other service); shown as the workshop's work, never as a job done for this town
  const i = Math.max(0, ctx.zones.indexOf(z));
  const jobs = ctx.realisations || [];
  const tintJobs = jobs.filter((r) => r.service === 'vitres-teintees');
  const otherJobs = jobs.filter((r) => r.service !== 'vitres-teintees');
  const picked = [tintJobs[i % (tintJobs.length || 1)], otherJobs[i % (otherJobs.length || 1)]].filter(Boolean);
  const body = `
  <section class="section page-intro">
    <div class="container">
      <nav class="breadcrumb" aria-label="Fil d’Ariane"><ol><li><a href="/">Accueil</a></li><li><a href="${zp.path}">Zones d’intervention</a></li><li aria-current="page">${esc(town)}</li></ol></nav>
      <p class="kicker">${esc(town)} · à ${kmFr(z.roadKm)} km de l’atelier</p>
      <h1>Vitres teintées, detailing et rénovation de phares près ${esc(from)}</h1>
      <p class="lead">Vous êtes à ${esc(town)} ? L’atelier ${esc(b.name)} est à ${kmFr(z.roadKm)} km par la route, ${esc(dir)} ${esc(from)} : on y arrive par ${esc(roadName(z.roads[0]))}${z.roads[1] ? `, puis ${esc(roadName(z.roads[1]))}` : ''}, jusqu’à la rue des Entrepreneurs à Vouvray.</p>
      <div class="ctas"><a class="btn btn--primary" href="/contact/">Demander un devis</a><a class="btn btn--ghost" href="${esc(route)}" rel="noopener" target="_blank">${ICONS.route} Itinéraire depuis ${esc(town)}</a></div>
    </div>
  </section>
  <section class="section section--paper" aria-labelledby="trajet-title">
    <div class="container container--narrow">
      <h2 id="trajet-title">Venir ${esc(from)} à l’atelier</h2>
      ${z.intro ? `<p>${esc(z.intro)}</p>` : ''}
      <p>Environ <strong>${kmFr(z.roadKm)} km</strong> par la route depuis le centre ${esc(from)}. Le trajet le plus direct :</p>
      <ol class="route-steps">${z.roads.map((r) => `<li><strong>${esc(roadName(r))}</strong><span>${kmFr(r.km)} km</span></li>`).join('')}<li><strong>${esc(b.address.street)}</strong><span>ZA de l’Étang Vignon, ${esc(b.address.postalCode)} Vouvray</span></li></ol>
      <p class="price-note">Itinéraire indicatif (réseau routier OpenStreetMap). ${esc(b.hoursText)} : <a href="/atelier-vouvray/">plan d’accès et horaires</a>.</p>
    </div>
  </section>
  <section class="section" aria-labelledby="zone-services">
    <div class="container">
      <h2 id="zone-services">Nos prestations pour les conducteurs ${esc(from)}</h2>
      <ul class="related__list">${services.map((s) => `<li><a href="/${s.slug}/"><strong>${esc(s.name)}</strong><span>${esc(s.tagline || s.short)} <em class="zone-price">${esc(priceHint(ctx, s.slug))}</em></span></a></li>`).join('')}</ul>
    </div>
  </section>
  ${
    picked.length
      ? `<section class="section works-block" aria-labelledby="zone-works">
    <div class="container">
      <div class="section-head"><h2 id="zone-works">Des réalisations de l’atelier</h2></div>
      <ul class="works">${picked.map((r) => realisationCard(ctx, r)).join('')}</ul>
      <p><a class="btn btn--ghost" href="/realisations/">Voir toutes les réalisations</a></p>
    </div>
  </section>`
      : ''
  }
  ${faqBlock(faq, `Questions de nos clients ${from}`)}
  <section class="section related" aria-labelledby="zones-near">
    <div class="container">
      <h2 id="zones-near">Nous accueillons aussi les conducteurs de…</h2>
      <ul class="zone-links">${others.map((o) => `<li><a href="/${o.slug}/">${esc(o.town)} <span>${kmFr(o.roadKm)} km</span></a></li>`).join('')}<li><a href="${zp.path}">Toutes les communes</a></li></ul>
    </div>
  </section>
  ${ctaBand(ctx)}`;
  const path = `/${z.slug}/`;
  const serviceLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `Vitres teintées, detailing et rénovation de phares près ${from}`,
    serviceType: 'Pose de films solaires, detailing automobile',
    provider: { '@id': abs(b, '/#entreprise') },
    areaServed: { '@type': 'City', name: town, address: { '@type': 'PostalAddress', addressRegion: b.department, addressCountry: 'FR' } },
    url: abs(b, path),
  };
  return page(
    ctx,
    {
      // titles kept under ~65 characters, descriptions under ~160
      title: (`Vitres teintées & detailing près ${from} | SOLAR CAR 37`.length > 60 ? `Vitres teintées près ${from} | SOLAR CAR 37` : `Vitres teintées & detailing près ${from} | SOLAR CAR 37`),
      description: [`${town} : atelier SOLAR CAR 37 à ${kmFr(z.roadKm)} km par la route (Vouvray).`, `Vitres teintées dès ${priceText.tintFrom} TTC, feux teintés, phares ${priceText.headlights}, detailing.`, 'Trajet et devis.']
        .reduce((acc, part) => ((acc + ' ' + part).trim().length <= 160 ? (acc + ' ' + part).trim() : acc), ''),
      path,
      image: '/stills/hero-1600.jpg',
      bodyClass: 'page-zone',
      extra: [ld(localBusiness(ctx)), ld(serviceLd), ld(faqLd(faq)), ld(breadcrumbLd(b, [{ name: 'Accueil', path: '/' }, { name: 'Zones d’intervention', path: zp.path }, { name: town, path }]))].join('\n'),
    },
    body
  );
}

export function zonesIndexPage(ctx) {
  const { business: b, zonesPage: zp } = ctx;
  const sorted = [...ctx.zones].sort((a, c) => a.roadKm - c.roadKm);
  const body = `
  <section class="section page-intro">
    <div class="container container--narrow">
      <nav class="breadcrumb" aria-label="Fil d’Ariane"><ol><li><a href="/">Accueil</a></li><li aria-current="page">Zones d’intervention</li></ol></nav>
      <h1>${esc(zp.h1)}</h1>
      <p class="lead">${esc(zp.intro)}</p>
    </div>
  </section>
  <section class="section section--tight">
    <div class="container">
      <ul class="zone-grid">${sorted
        .map(
          (z) => `<li><a href="/${z.slug}/"><strong>${esc(z.town)}</strong><span>${kmFr(z.roadKm)} km par la route · ${esc(dirFrom((z.bearing + 180) % 360).replace(/^(au|à l’) ?/, ''))} de l’atelier</span></a></li>`
        )
        .join('')}</ul>
      ${
        ctx.zonesListed?.length
          ? `<h2 class="zone-grid__title">Et tout près de l’atelier</h2>
      <ul class="zone-grid zone-grid--plain">${[...ctx.zonesListed]
        .sort((a, c) => a.roadKm - c.roadKm)
        .map((z) => `<li><strong>${esc(z.town)}</strong><span>${kmFr(z.roadKm)} km par la route · ${esc(dirFrom((z.bearing + 180) % 360).replace(/^(au|à l’) ?/, ''))} de l’atelier</span></li>`)
        .join('')}</ul>`
          : ''
      }
    </div>
  </section>
  ${visitBlock(ctx, { title: 'L’atelier, à Vouvray', id: 'atelier' })}
  ${ctaBand(ctx)}`;
  return page(
    ctx,
    {
      title: zp.seo.title,
      description: zp.seo.description,
      path: zp.path,
      bodyClass: 'page-zones',
      extra: [ld(localBusiness(ctx)), ld(breadcrumbLd(b, [{ name: 'Accueil', path: '/' }, { name: 'Zones d’intervention', path: zp.path }]))].join('\n'),
    },
    body
  );
}

