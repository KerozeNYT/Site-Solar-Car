// Style tile: the live design tokens, logo and components on one board (noindex).
import { esc } from './pages.js';

export function styleTilePage(ctx) {
  const swatches = [
    ['Noir garage', '--bg', '#07080a', 'Fond de toutes les pages'],
    ['Surface', '--surface-solid', '#121317', 'Cartes, panneaux, menus'],
    ['Ivoire', '--text', '#f3f0ea', 'Textes et titres'],
    ['Gris chaud', '--text-3', '#9b978e', 'Textes secondaires, légendes'],
    ['Or clair', '--accent', '#e3c27a', 'Surtitres, mots en italique, chiffres'],
    ['Or 500', '--gold-500', '#c9a253', 'Filets, cases cochées'],
  ];
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Style tile | ${esc(ctx.business.name)}</title>
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="${ctx.assets.css}">
<style>
  .tile{padding:48px 0 80px}
  .tile h1{font-size:2.2rem}
  .tile-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:24px;margin-top:28px}
  .tile-card{border:1px solid var(--border);border-radius:var(--radius);padding:22px;background:var(--surface)}
  .tile-card h2{font-size:1rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
  .sw{display:grid;grid-template-columns:56px 1fr;gap:12px;align-items:center;margin:10px 0}
  .sw i{width:56px;height:56px;border-radius:12px;border:1px solid rgba(255,255,255,.14)}
  .sw small{display:block;color:var(--muted)}
  .metal{height:56px;border-radius:12px;background:var(--gold-metal)}
  .dark{background:var(--bg);color:var(--on-dark)}
  .dark h2{color:var(--on-dark-muted)}
</style>
</head>
<body>
<main class="container tile">
  <p class="kicker">Planche de style</p>
  <h1>${esc(ctx.business.name)} — identité web</h1>
  <p class="lead">Charte V3 « garage de nuit » : logo officiel (logotype passé en ivoire sur fond sombre, blason inchangé), noir profond, or du blason. Polices Geist (texte et titres), Instrument Serif italique (mot mis en valeur), Geist Mono (surtitres et chiffres). Tous les éléments ci-dessous utilisent les vrais jetons CSS du site.</p>
  <div class="tile-grid">
    <section class="tile-card">
      <h2>Logo officiel</h2>
      <img src="/img/brand/logo-officiel-clair-480.webp" width="240" height="258" alt="Logo officiel ${esc(ctx.business.name)}">
      <p class="price-note">Version horizontale (en-tête) composée du blason et du logotype officiels, logotype en ivoire :</p>
      <img src="/img/brand/logo-horizontal-clair-400.webp" width="260" height="100" alt="">
    </section>
    <section class="tile-card">
      <h2>Couleurs</h2>
      ${swatches.map(([n, v, hex, use]) => `<div class="sw"><i style="background:var(${v})"></i><div><strong>${n}</strong> <code>${hex}</code><small>${use}</small></div></div>`).join('')}
      <div class="sw"><i class="metal"></i><div><strong>Or métallisé</strong> <code>--gold-metal</code><small>Boutons principaux, chiffres clés</small></div></div>
    </section>
    <section class="tile-card">
      <h2>Typographie</h2>
      <p class="kicker">Surtitre · Geist Mono 500</p>
      <h2 style="font-size:2.4rem;letter-spacing:-.038em;text-transform:none;color:var(--text)">Titre Geist 600, <em>mot en italique</em></h2>
      <p style="font-size:1.4rem;font-weight:600;letter-spacing:-.02em">Sous-titre Geist 600</p>
      <p>Texte courant Geist 400, 17 px, interligne 1,62 : lisible sur mobile comme sur grand écran. <a href="#">Lien souligné or</a>.</p>
    </section>
    <section class="tile-card">
      <h2>Boutons</h2>
      <div class="ctas"><a class="btn btn--primary" href="#">Demander un devis</a><a class="btn btn--ghost" href="#">Voir les prestations</a></div>
      <div class="ctas"><span class="badge-demo">Tarif indicatif</span></div>
    </section>
    <section class="tile-card dark">
      <h2>Sur fond immersif</h2>
      <p class="kicker" style="color:var(--gold-300)">01 — Vitres teintées</p>
      <p style="font-size:1.8rem;font-weight:600;letter-spacing:-.035em;color:var(--text);line-height:1.05">Des films solaires <em class="title-em">posés dans les règles</em></p>
      <p class="readout"><span class="readout__label">Transmission lumineuse arrière</span> <span class="readout__value">35</span><span class="readout__unit"> %</span></p>
      <div class="ctas"><a class="btn btn--primary" href="#">Demander un devis</a><a class="btn btn--ghost" href="#">Voir les prestations</a></div>
    </section>
    <section class="tile-card">
      <h2>Carte prestation</h2>
      <ul class="service-grid" style="grid-template-columns:1fr"><li class="service-card"><a class="service-card__link" href="#"><div class="service-card__media"><img src="/stills/tint-960.webp" alt="" width="960" height="540"></div><div class="service-card__body"><p class="kicker">01</p><h3>Vitres teintées</h3><p>Films solaires de 5 % à 70 %, simulateur 3D et prix en direct.</p><span class="service-card__more">Découvrir →</span></div></a></li></ul>
    </section>
    <section class="tile-card">
      <h2>Direction des images</h2>
      <p>Garage de nuit : néons linéaires au plafond, sol mouillé, fumée lente, lumière froide et accents or. Studio 3D au plafond LED hexagonal et sol en polydalles noires et jaunes.</p>
      <img src="/stills/detailing-960.webp" alt="" width="960" height="540" loading="lazy">
    </section>
  </div>
</main>
</body>
</html>
`;
}
