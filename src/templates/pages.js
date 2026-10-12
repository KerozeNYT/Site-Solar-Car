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

/** Location phrase for titles: the city once known, otherwise the department. */
export function placeLabel(b) {
  return b.address?.city ? `${b.address.city} (${b.departmentCode})` : `${b.department} (${b.departmentCode})`;
}

// ------------------------------------------------------------------------- structured data
function localBusiness(ctx) {
  const b = ctx.business;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'AutoBodyShop',
    '@id': abs(b, '/#entreprise'),
    name: b.name,
    description: ctx.home.seo.description,
    url: abs(b, '/'),
    logo: abs(b, '/img/brand/logo-officiel-480.png'),
    image: abs(b, '/stills/og.jpg'),
    areaServed: { '@type': 'AdministrativeArea', name: `${b.department} (${b.departmentCode})` },
    makesOffer: ctx.services.map((s) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: s.name, url: abs(b, `/${s.slug}/`) },
    })),
  };
  if (b.legalName) data.legalName = b.legalName;
  if (b.phone) data.telephone = b.phone;
  if (b.email) data.email = b.email;
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
  const same = Object.values(b.social || {}).filter(Boolean);
  if (same.length) data.sameAs = same;
  return data;
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

function header(ctx, current = '') {
  const items = ctx.nav
    .map((n) => `<li><a href="${n.href}"${current === n.href ? ' aria-current="page"' : ''}>${esc(n.label)}</a></li>`)
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
</header>`;
}

function contactLines(b, { compact = false } = {}) {
  const rows = [];
  const addr = addressLine(b);
  if (addr) rows.push(`<li><span class="label">Adresse</span> ${esc(addr)}</li>`);
  if (b.phone) rows.push(`<li><span class="label">Téléphone</span> <a href="${telHref(b.phone)}">${esc(b.phone)}</a></li>`);
  if (b.email) rows.push(`<li><span class="label">E-mail</span> <a href="mailto:${esc(b.email)}">${esc(b.email)}</a></li>`);
  if (!rows.length && !compact)
    rows.push(`<li class="todo">Coordonnées de l’atelier à compléter (adresse, téléphone, e-mail).</li>`);
  return rows.length ? `<ul class="contact-lines">${rows.join('')}</ul>` : '';
}

function footer(ctx) {
  const b = ctx.business;
  const social = Object.entries(b.social || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `<li><a href="${esc(v)}" rel="noopener" target="_blank">${esc(k[0].toUpperCase() + k.slice(1))}</a></li>`)
    .join('');
  const credit = ctx.car.credit
    ? `<p class="site-footer__credit">${ctx.car.credit.url ? `<a href="${esc(ctx.car.credit.url)}" rel="noopener">${esc(ctx.car.credit.text)}</a>` : esc(ctx.car.credit.text)}</p>`
    : '';
  return `<footer class="site-footer">
  <div class="container site-footer__grid">
    <div>
      <a class="site-footer__logo" href="/" aria-label="${esc(b.name)} — accueil"><img src="/img/brand/logo-officiel-240.webp" srcset="/img/brand/logo-officiel-240.webp 240w, /img/brand/logo-officiel-480.webp 480w" sizes="132px" width="132" height="142" alt="Logo ${esc(b.name)}" loading="lazy"></a>
      <p class="site-footer__tag">${esc(b.tagline)} — ${esc(b.department)} (${esc(b.departmentCode)}).</p>
      ${contactLines(b)}
    </div>
    <nav aria-label="Prestations">
      <h2 class="site-footer__title">Prestations</h2>
      <ul>${ctx.services.map((s) => `<li><a href="/${s.slug}/">${esc(s.name)}</a></li>`).join('')}</ul>
    </nav>
    <nav aria-label="Informations">
      <h2 class="site-footer__title">Informations</h2>
      <ul><li><a href="/contact/">Contact &amp; devis</a></li><li><a href="/mentions-legales/">Mentions légales</a></li>${social}</ul>
    </nav>
  </div>
  <div class="container site-footer__bottom">
    <p>© <span data-year>${new Date().getFullYear()}</span> ${esc(b.name)}</p>
    ${credit}
  </div>
</footer>`;
}

function page(ctx, opts, body) {
  return `${head(ctx, opts)}
<body class="${opts.bodyClass || ''}">
${header(ctx, opts.path)}
<main id="contenu">
${body}
</main>
${footer(ctx)}
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
      extra: [ld(localBusiness(ctx)), ld(faqLd(home.faq)), ld({ '@context': 'https://schema.org', '@type': 'WebSite', name: b.name, url: abs(b, '/') })].join('\n'),
    },
    body
  );
}

// ------------------------------------------------------------------------- service
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
    areaServed: { '@type': 'AdministrativeArea', name: `${b.department} (${b.departmentCode})` },
    url: abs(b, `/${s.slug}/`),
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
        <div class="ctas"><a class="btn btn--primary" href="/contact/?prestation=${s.slug}">Demander un devis</a><a class="btn btn--ghost" href="/#chapitre-${s.chapter}">Voir dans la visite 3D</a></div>
      </div>
    </header>

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

  <section class="section related" aria-labelledby="related-title">
    <div class="container">
      <h2 id="related-title">Nos autres prestations</h2>
      <ul class="related__list">${others.map((o) => `<li><a href="/${o.slug}/"><strong>${esc(o.name)}</strong><span>${esc(o.short)}</span></a></li>`).join('')}</ul>
    </div>
  </section>
  ${ctaBand(ctx)}`;
  const title = b.address?.city ? s.seo.title.replace(`Indre-et-Loire (${b.departmentCode})`, placeLabel(b)) : s.seo.title;
  return page(
    ctx,
    {
      title,
      description: s.seo.description,
      path: `/${s.slug}/`,
      image: `/stills/${s.still}-1600.jpg`,
      bodyClass: 'page-service',
      extra: [ld(serviceLd), ld(faqLd(s.faq)), ld(breadcrumbLd(b, [{ name: 'Accueil', path: '/' }, { name: s.name, path: `/${s.slug}/` }]))].join('\n'),
    },
    body
  );
}

// ------------------------------------------------------------------------- contact
export function contactPage(ctx) {
  const { contactPage: c, business: b, services } = ctx;
  const demo = !b.formEndpoint;
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
      <form class="form" data-form ${demo ? 'data-demo' : `action="${esc(b.formEndpoint)}" method="post"`} novalidate>
        ${demo ? '<p class="form__demo" role="note"><strong>Formulaire de démonstration.</strong> Aucun message n’est envoyé tant que l’adresse de réception n’est pas configurée (<code>business.formEndpoint</code> dans <code>content/site.js</code>).</p>' : ''}
        <div class="form__row">
          <label for="f-name">Nom et prénom</label>
          <input id="f-name" name="nom" autocomplete="name" required>
        </div>
        <div class="form__row form__row--2">
          <div><label for="f-email">E-mail</label><input id="f-email" name="email" type="email" autocomplete="email" required></div>
          <div><label for="f-phone">Téléphone <span class="optional">(facultatif)</span></label><input id="f-phone" name="telephone" type="tel" autocomplete="tel"></div>
        </div>
        <div class="form__row">
          <label for="f-car">Véhicule (marque, modèle, année)</label>
          <input id="f-car" name="vehicule" required>
        </div>
        <fieldset class="form__row">
          <legend>Prestation(s) souhaitée(s)</legend>
          <div class="choices">${services.map((s) => `<label class="choice"><input type="checkbox" name="prestations" value="${s.slug}"> ${esc(s.name)}</label>`).join('')}</div>
        </fieldset>
        <div class="form__row">
          <label for="f-msg">Votre message</label>
          <textarea id="f-msg" name="message" rows="5"></textarea>
        </div>
        <div class="form__row form__consent">
          <label class="choice"><input type="checkbox" name="consentement" required> J’accepte que mes données soient utilisées pour répondre à ma demande (voir <a href="/mentions-legales/#confidentialite">confidentialité</a>).</label>
        </div>
        <input type="text" name="_gotcha" class="visually-hidden" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="btn btn--primary" type="submit">Envoyer la demande</button>
        <p class="form__status" role="status" aria-live="polite" data-form-status></p>
      </form>
      <aside class="contact-card">
        <h2>L’atelier</h2>
        <p>${esc(b.name)} — ${esc(b.department)} (${esc(b.departmentCode)})</p>
        ${contactLines(b)}
        ${b.openingHours ? `<h3>Horaires</h3><ul class="hours">${b.openingHours.map((h) => `<li>${esc(h.days.join(', '))} : ${esc(h.opens)} – ${esc(h.closes)}</li>`).join('')}</ul>` : ''}
      </aside>
    </div>
  </section>`;
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
      <p>${todo(b.legalName || b.name, 'Raison sociale')}<br>${todo(addressLine(b), 'Adresse du siège')}<br>SIRET : ${todo(b.siret, 'SIRET')}<br>Contact : ${todo(b.email || b.phone, 'E-mail ou téléphone')}</p>
      <p>Directeur de la publication : ${todo(l.publisher, 'Nom')}</p>
      <h2>Hébergement</h2>
      <p>${todo(l.host?.name, 'Hébergeur')}<br>${todo(l.host?.address, 'Adresse de l’hébergeur')}</p>
      <h2>Propriété intellectuelle</h2>
      <p>Les textes, visuels et le logo de ${esc(b.name)} sont protégés. Les marques et modèles de véhicules apparaissant sur le site appartiennent à leurs propriétaires respectifs ; leur présence n’implique aucun partenariat.</p>
      ${ctx.car.credit ? `<p>${esc(ctx.car.credit.text)}.</p>` : ''}
      <h2 id="confidentialite">Confidentialité</h2>
      <p>Les informations transmises via le formulaire de contact servent uniquement à répondre à votre demande et ne sont ni vendues ni cédées. Vous pouvez demander leur consultation, rectification ou suppression en nous écrivant.</p>
      <p>Ce site n’utilise pas de cookie publicitaire ni d’outil de mesure d’audience tiers. Les polices de caractères sont hébergées sur le site lui-même.</p>
    </div>
  </section>`;
  return page(ctx, { title: l.seo.title, description: l.seo.description, path: '/mentions-legales/', bodyClass: 'page-legal' }, body);
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
