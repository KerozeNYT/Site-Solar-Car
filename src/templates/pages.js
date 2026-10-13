import { simFor } from './sims.js';

/**
 * Static HTML templates. Every page is rendered at build time from content/*.js so search
 * engines get complete, semantic HTML; JavaScript only adds the 3D tour and small comforts.
 */

export const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
  const same = [...Object.values(b.social || {}), b.google?.profileUrl].filter(Boolean);
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

const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

// ------------------------------------------------------------------------- shared chrome
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
<link rel="preload" href="${ctx.assets.font}" as="font" type="font/woff2" crossorigin>
${preload}
<link rel="stylesheet" href="${ctx.assets.css}">
<script>(function(d){var c=d.documentElement.classList,n=navigator.connection;c.add('js');if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&!(n&&n.saveData)&&!/[?&]static\b/.test(location.search))c.add('tour-live')})(document)</script>
${extra}
</head>`;
}

const CHEVRON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg>';

function header(ctx, current = '') {
  const items = ctx.nav
    .map((n) => {
      if (!n.services) return `<li><a href="${n.href}"${current === n.href ? ' aria-current="page"' : ''}>${esc(n.label)}</a></li>`;
      const inside = ctx.services.some((s) => current === `/${s.slug}/`);
      const links = ctx.services
        .map((s) => `<li><a href="/${s.slug}/"${current === `/${s.slug}/` ? ' aria-current="page"' : ''}><strong>${esc(s.name)}</strong><span>${esc(s.short)}</span></a></li>`)
        .join('');
      return `<li class="site-nav__group${inside ? ' is-current' : ''}" data-submenu><button class="site-nav__trigger" type="button" aria-expanded="false" aria-controls="menu-prestations">${esc(n.label)} ${CHEVRON}</button><ul class="site-nav__sub" id="menu-prestations">${links}</ul></li>`;
    })
    .join('');
  return `<a class="skip-link" href="#contenu">Aller au contenu</a>
<header class="site-header" data-header>
  <a class="site-header__logo" href="/" aria-label="${esc(ctx.business.name)} — accueil"><img src="/img/brand/logo-horizontal-200.webp" srcset="/img/brand/logo-horizontal-200.webp 200w, /img/brand/logo-horizontal-400.webp 400w" sizes="114px" width="114" height="44" alt="${esc(ctx.business.name)}"></a>
  <nav class="site-nav" aria-label="Navigation principale">
    <button class="site-nav__toggle" type="button" aria-expanded="false" aria-controls="menu-principal" data-nav-toggle>
      <span class="site-nav__bars" aria-hidden="true"></span><span class="visually-hidden">Menu</span>
    </button>
    <ul class="site-nav__list" id="menu-principal">${items}<li class="site-nav__cta"><a class="btn btn--primary btn--sm" href="/contact/">Devis</a></li></ul>
  </nav>
  ${ctx.business.phone ? `<a class="site-header__phone" href="${telHref(ctx.business.phone)}">${ICONS.phone}<span>${esc(ctx.business.phone)}</span></a>` : ''}
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
      <a class="site-footer__logo" href="/" aria-label="${esc(b.name)} — accueil"><img src="/img/brand/logo-officiel-240.webp" srcset="/img/brand/logo-officiel-240.webp 240w, /img/brand/logo-officiel-480.webp 480w" sizes="132px" width="132" height="142" alt="Logo ${esc(b.name)}" loading="lazy"></a>
      <p class="site-footer__tag">${esc(b.tagline)} — ${esc(b.address?.city || b.department)}, près de Tours (${esc(b.departmentCode)}).</p>
      ${contactLines(b)}
      ${socialLinks(b, 'social social--footer')}
    </div>
    <nav aria-label="Prestations">
      <h2 class="site-footer__title">Prestations</h2>
      <ul>${ctx.services.map((s) => `<li><a href="/${s.slug}/">${esc(s.name)}</a></li>`).join('')}</ul>
    </nav>
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

/** Partner brands: an accessible list, doubled into a slow scrolling band (logos when supplied). */
function partnersBlock(ctx) {
  const p = ctx.partners;
  if (!p?.brands?.length) return '';
  // logos are painted in gold through a CSS mask (any single-colour SVG / transparent PNG)
  const item = (x) =>
    `<li class="brands__item">${x.logo ? `<i class="brands__logo" style="--logo:url(${esc(x.logo)})" role="img" aria-label="${esc(x.name)}"></i>` : `<span>${esc(x.name)}</span>`}</li>`;
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

function page(ctx, opts, body) {
  return `${head(ctx, opts)}
<body class="${opts.bodyClass || ''}">
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

const ctaLinks = (ctas = []) =>
  ctas.length
    ? `<div class="ctas">${ctas
        .map((c) => `<a class="btn ${c.primary ? 'btn--primary' : 'btn--ghost'}" href="${c.href}"${c.href.startsWith('#') ? ' data-scroll' : ''}>${esc(c.label)}</a>`)
        .join('')}</div>`
    : '';

const still = (id, alt, { sizes = '100vw', eager = false, cls = '' } = {}) =>
  `<img class="${cls}" src="/stills/${id}-960.webp" srcset="/stills/${id}-960.webp 960w, /stills/${id}-1600.webp 1600w" sizes="${sizes}" width="1600" height="900" alt="${esc(alt)}" ${eager ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"'}>`;

function ctaBand(ctx) {
  const c = ctx.home.ctaBand;
  return `<section class="cta-band">
  <div class="container cta-band__inner">
    <div><h2>${esc(c.title)}</h2><p>${esc(c.text)}</p></div>
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
export function homePage(ctx) {
  const { home, services, business: b } = ctx;
  const ch = home.tour.chapters;
  const altFor = {
    hero: `Façade de l’atelier ${b.name} de nuit, porte ouverte sur le studio éclairé et la voiture`,
    tint: 'Voiture de sport dans le studio : lunette et vitres arrière teintées, vitres avant claires',
    tail: 'Arrière de la voiture avec feux arrière teintés par film fumé',
    detailing: 'Flanc de la voiture pendant le polissage : peinture terne à droite, corrigée à gauche',
    stars: 'Pavillon intérieur de la voiture illuminé par un ciel étoilé en fibre optique',
    headlights: 'Phares avant rénovés et allumés, optiques redevenues transparentes',
    final: `Vue aérienne de nuit de l’atelier ${b.name}, de ses abords et de la route`,
  };
  const order = Object.keys(ch);
  const chapters = order
    .map((id, i) => {
      const c = ch[id];
      const H = i === 0 ? 'h1' : 'h2';
      const link = c.link ? `<p class="chapter__link"><a href="${c.link.href}">${esc(c.link.label)} <span aria-hidden="true">→</span></a></p>` : '';
      const readout =
        c.readout === 'vlt'
          ? `<p class="readout" aria-live="off"><span class="readout__label">Transmission lumineuse arrière</span> <span class="readout__value" data-readout="vlt">70</span><span class="readout__unit"> %</span></p>`
          : c.readout === 'beforeAfter'
            ? `<p class="readout readout--ba" aria-live="off"><span class="readout__label">Optiques</span> <span class="readout__value" data-readout="beforeAfter">Avant</span></p>`
            : '';
      const contact = c.contact ? contactLines(b, { compact: true }) : '';
      return `<article class="chapter chapter--${c.side || 'left'}${i === 0 ? ' is-active' : ''}" data-chapter="${id}" id="chapitre-${id}">
        <div class="chapter__still">${still(id, altFor[id] || '', { eager: i === 0 })}</div>
        <div class="chapter__copy">
          <p class="kicker">${esc(c.kicker)}</p>
          <${H} class="chapter__title">${esc(c.title)}</${H}>
          <p class="chapter__text">${esc(c.text)}</p>
          ${readout}${contact}${ctaLinks(c.ctas)}${link}
        </div>
      </article>`;
    })
    .join('\n      ');

  const cards = services
    .map(
      (s, i) => `<li class="service-card">
        <a href="/${s.slug}/" class="service-card__link">
          <div class="service-card__media">${still(s.still, '', { sizes: '(min-width: 900px) 33vw, 100vw' })}</div>
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
  <section class="tour" id="visite" aria-label="${esc(home.tour.label)}" style="--travel:${ctx.flightTotal}" data-tour>
    <div class="tour__stage" data-stage>
      <canvas class="tour__canvas" aria-hidden="true" data-canvas></canvas>
      <div class="tour__chapters">
      ${chapters}
      </div>
      <div class="tour__hud" aria-hidden="true">
        <div class="tour__progress"><span data-progress></span></div>
        <p class="tour__label"><span data-chapter-index>01</span> / 0${order.length} <span class="tour__name" data-chapter-name></span></p>
      </div>
      <p class="tour__loading" data-loading hidden><span class="tour__spinner" aria-hidden="true"></span><span>${esc(home.tour.loading)}</span> <span data-loading-pct></span></p>
      <a class="tour__skip btn btn--ghost btn--sm" href="#prestations" data-scroll>${esc(home.tour.skip)} <span aria-hidden="true">↓</span></a>
    </div>
  </section>

  <div class="marquee" aria-hidden="true"><div class="marquee__track">${Array.from({ length: 2 }, () => services.map((s) => `<span>${esc(s.name)}</span>`).join('<i>◆</i>') + '<i>◆</i>').join('')}</div></div>

  <section class="section intro" id="prestations" aria-labelledby="prestations-title">
    <div class="container">
      <div class="section-head">
        <p class="kicker">${esc(b.name)}</p>
        <h2 id="prestations-title">${esc(home.servicesTitle)}</h2>
        <p class="lead">${esc(home.intro.text)}</p>
      </div>
      <ul class="service-grid">
      ${cards}
      </ul>
    </div>
  </section>

  <section class="section section--paper process" aria-labelledby="process-title">
    <div class="container">
      <h2 id="process-title">${esc(home.process.title)}</h2>
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
  ${partnersBlock(ctx)}
  ${reviewsBlock(ctx)}
  ${faqBlock(home.faq)}
  ${ctaBand(ctx)}`;

  const poster = `<link rel="preload" as="image" href="/stills/hero-1600.webp" imagesrcset="/stills/hero-960.webp 960w, /stills/hero-1600.webp 1600w" imagesizes="100vw" fetchpriority="high">`;
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
function offersFor(ctx, slug) {
  const { tint, vehicleTypes, lights, headlights } = ctx.pricing;
  const ttc = { '@type': 'PriceSpecification', priceCurrency: 'EUR', valueAddedTaxIncluded: true };
  if (slug === 'feux-arriere-teintes')
    return {
      offers: { '@type': 'AggregateOffer', priceCurrency: 'EUR', lowPrice: String(lights.perPair.min), highPrice: String(lights.perPair.max), offerCount: '2', description: 'Prix TTC par paire de feux, selon le véhicule' },
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

export function servicePage(ctx, s) {
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
    image: abs(b, `/stills/${s.still}-1600.jpg`),
    ...offersFor(ctx, s.slug),
  };
  const body = `
  <article class="service">
    <header class="service-hero">
      <div class="service-hero__media">${still(s.still, `${s.name} — ${b.name}`, { eager: true })}</div>
      <div class="container service-hero__copy">
        <nav class="breadcrumb" aria-label="Fil d’Ariane"><ol><li><a href="/">Accueil</a></li><li aria-current="page">${esc(s.name)}</li></ol></nav>
        <p class="kicker">${esc(b.name)} · ${esc(placeLabel(b))}</p>
        <h1>${esc(s.h1)}</h1>
        <p class="lead">${esc(s.intro)}</p>
        <div class="ctas"><a class="btn btn--primary" href="#simulateur" data-scroll>Simuler en 3D et voir le prix</a><a class="btn btn--ghost" href="/contact/?prestation=${s.slug}">Demander un devis</a></div>
      </div>
    </header>
    ${simFor(ctx, s.slug)}

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
    ${law}
    ${faqBlock(s.faq)}
  </article>

  ${guideFor(ctx, s.slug)}
  ${partnersBlock(ctx)}
  ${visitBlock(ctx, { title: `${s.name} à ${b.address?.city || b.department}, près de Tours`, id: 'atelier', map: false })}
  <section class="section related" aria-labelledby="related-title">
    <div class="container">
      <h2 id="related-title">Nos autres prestations</h2>
      <ul class="related__list">${others.map((o) => `<li><a href="/${o.slug}/"><strong>${esc(o.name)}</strong><span>${esc(o.short)}</span></a></li>`).join('')}</ul>
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
      image: `/stills/${s.still}-1600.jpg`,
      bodyClass: 'page-service',
      extra: [ld(serviceLd), ld(faqLd(s.faq)), ld(breadcrumbLd(b, [{ name: 'Accueil', path: '/' }, { name: s.name, path: `/${s.slug}/` }]))].join('\n'),
      preload: `<link rel="preload" as="image" href="/stills/${s.still}-1600.webp" imagesrcset="/stills/${s.still}-960.webp 960w, /stills/${s.still}-1600.webp 1600w" imagesizes="100vw" fetchpriority="high">`,
    },
    body
  );
}

/** "Bon à savoir" teaser linking a service page to its guide */
function guideFor(ctx, slug) {
  const g = (ctx.guides || []).find((x) => x.service === slug);
  if (!g) return '';
  return `<section class="section section--tight guide-teaser">
  <div class="container container--narrow">
    <a class="guide-teaser__card reveal-up" href="/guides/${g.slug}/">
      <span class="kicker">Guide · ${esc(g.kicker)}</span>
      <strong>${esc(g.title)}</strong>
      <span>${esc(g.intro)}</span>
      <span class="guide-teaser__more">Lire le guide <span aria-hidden="true">→</span></span>
    </a>
  </div>
</section>`;
}

// ------------------------------------------------------------------------- contact
export function contactPage(ctx) {
  const { contactPage: c, business: b, services } = ctx;
  const demo = !b.formEndpoint;
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
      <form class="form" data-form ${demo ? `data-mailto="${esc(b.email || '')}"` : `action="${esc(b.formEndpoint)}" method="post" data-fallback="${esc(b.email || '')}"`} novalidate>
        ${demo ? `<p class="form__demo" role="note">Votre demande s’ouvre dans votre messagerie, adressée à ${esc(b.email)} : il ne reste qu’à l’envoyer. Vous pouvez aussi nous appeler au ${esc(b.phone)}.</p>` : ''}
        <p class="form__req">Tous les champs sont obligatoires.</p>
        <div class="form__row form__row--2">
          <div><label for="f-last">Nom</label><input id="f-last" name="nom" autocomplete="family-name" required></div>
          <div><label for="f-first">Prénom</label><input id="f-first" name="prenom" autocomplete="given-name" required></div>
        </div>
        <div class="form__row form__row--2">
          <div><label for="f-email">E-mail</label><input id="f-email" name="email" type="email" autocomplete="email" required></div>
          <div><label for="f-phone">Téléphone</label><input id="f-phone" name="telephone" type="tel" autocomplete="tel" inputmode="tel" pattern="[0-9+().\s\-]{10,20}" title="Un numéro de téléphone, par exemple 06 12 34 56 78" required></div>
        </div>
        <div class="form__row form__row--3">
          <div><label for="f-make">Marque du véhicule</label><input id="f-make" name="marque" placeholder="ex. Peugeot" required></div>
          <div><label for="f-model">Modèle du véhicule</label><input id="f-model" name="modele" placeholder="ex. 308 SW" required></div>
          <div><label for="f-year">Année du véhicule</label><input id="f-year" name="annee" type="number" inputmode="numeric" min="1950" max="${new Date().getFullYear() + 1}" placeholder="ex. 2019" required></div>
        </div>
        <fieldset class="form__row" data-required-group>
          <legend>Prestation(s) souhaitée(s)</legend>
          <div class="choices">${services.map((s) => `<label class="choice"><input type="checkbox" name="prestations" value="${s.slug}"> ${esc(s.name)}</label>`).join('')}<label class="choice"><input type="checkbox" name="prestations" value="autre"> Autre demande</label></div>
        </fieldset>
        <div class="form__row">
          <label for="f-msg">Votre message</label>
          <textarea id="f-msg" name="message" rows="5" required></textarea>
        </div>
        <div class="form__row form__consent">
          <label class="choice"><input type="checkbox" name="consentement" required> J’accepte que mes données soient utilisées pour répondre à ma demande (voir <a href="/mentions-legales/#confidentialite">confidentialité</a>).</label>
        </div>
        <input type="text" name="${formsubmit ? '_honey' : '_gotcha'}" class="visually-hidden" tabindex="-1" autocomplete="off" aria-hidden="true">
        ${formsubmit ? '<input type="hidden" name="_subject" value="Demande de devis depuis le site"><input type="hidden" name="_template" value="table">' : ''}
        <button class="btn btn--primary" type="submit">${demo ? 'Préparer l’e-mail de demande' : 'Envoyer la demande'}</button>
        <p class="form__status" role="status" aria-live="polite" data-form-status></p>
      </form>
      <aside class="contact-card">
        <h2>Nous joindre</h2>
        <p>${esc(b.name)} — ${esc(b.address?.city || '')} (${esc(b.departmentCode)})</p>
        ${contactLines(b)}
        ${socialLinks(b, 'social')}
      </aside>
    </div>
  </section>
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
      <p>Les textes, visuels et le logo de ${esc(b.name)} sont protégés. Les marques et modèles de véhicules apparaissant sur le site appartiennent à leurs propriétaires respectifs ; leur présence n’implique aucun partenariat.</p>
      ${(ctx.credits || []).length ? `<p>Modèles 3D utilisés sur le site :</p><ul>${ctx.credits.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
      <h2 id="confidentialite">Confidentialité</h2>
      <p>Les informations transmises via le formulaire de contact servent uniquement à répondre à votre demande (devis, prise de rendez-vous) et ne sont ni vendues ni cédées. Responsable du traitement : ${esc(b.owner || b.name)}.</p>
      ${b.google?.placeId && b.google?.mapsApiKey ? '<p>Les avis Google affichés sur le site sont chargés depuis Google Maps Platform (Google Ireland Ltd) au moment de la visite ; Google reçoit alors l’adresse IP du visiteur.</p>' : ''}
      ${b.formEndpoint && /formsubmit\.co/.test(b.formEndpoint) ? '<p>Le formulaire est acheminé par le service FormSubmit (formsubmit.co), qui transmet votre demande par e-mail à l’atelier sans la publier. Elle est ensuite conservée dans notre messagerie le temps nécessaire au suivi de votre demande.</p>' : ''}
      <p>Vous pouvez demander la consultation, la rectification ou la suppression de vos données en nous écrivant${b.email ? ` à ${esc(b.email)}` : ''}.</p>
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
      <ul class="related__list">${services.map((s) => `<li><a href="/${s.slug}/"><strong>${esc(s.name)}</strong><span>${esc(s.short)}</span></a></li>`).join('')}</ul>
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
          (x) => `<li class="guide-card reveal-up"><a href="/guides/${x.slug}/">
          <div class="guide-card__media">${still(x.still, '', { sizes: '(min-width: 900px) 33vw, 100vw' })}</div>
          <div class="guide-card__body"><p class="kicker">${esc(x.kicker)}</p><h2>${esc(x.title)}</h2><p>${esc(x.intro)}</p><span class="service-card__more">Lire <span aria-hidden="true">→</span></span></div>
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
    image: abs(b, `/stills/${x.still}-1600.jpg`),
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
    <div class="guide__media container">${still(x.still, x.title, { eager: true })}</div>
    <div class="section section--tight">
      <div class="container container--narrow prose">
        ${x.sections.map(section).join('\n        ')}
        ${service ? `<aside class="guide__cta"><p><strong>${esc(service.name)} à ${esc(b.address?.city || '')}, près de Tours.</strong> Essayez le simulateur 3D et obtenez votre tarif en direct.</p><div class="ctas"><a class="btn btn--primary" href="/${service.slug}/#simulateur">Ouvrir le simulateur</a><a class="btn btn--ghost" href="/contact/?prestation=${service.slug}">Demander un devis</a></div></aside>` : ''}
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
      image: `/stills/${x.still}-1600.jpg`,
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
