// Style tile: the live design tokens, logo and components on one board (noindex).
import { esc } from './pages.js';

export function styleTilePage(ctx) {
  const swatches = [
    ['Bleu nuit 900', '--navy-900', '#07111f', 'Logotype, textes, fonds immersifs'],
    ['Bleu nuit 950', '--navy-950', '#040a14', 'Studio 3D, simulateurs'],
    ['Or 300', '--gold-300', '#e9cd82', 'Accents sur fond sombre'],
    ['Or 500', '--gold-500', '#c48b2e', 'Liens, filets'],
    ['Or 700', '--gold-700', '#7a4e17', 'Ombres du métal'],
    ['Ivoire', '--ivory', '#f8f5ee', 'Sections claires, pied de page'],
    ['Blanc', '--white', '#ffffff', 'Fond principal'],
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
  .tile-card{border:1px solid var(--line);border-radius:var(--radius);padding:22px;background:var(--white)}
  .tile-card h2{font-size:1rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
  .sw{display:grid;grid-template-columns:56px 1fr;gap:12px;align-items:center;margin:10px 0}
  .sw i{width:56px;height:56px;border-radius:12px;border:1px solid rgba(0,0,0,.08)}
  .sw small{display:block;color:var(--muted)}
  .metal{height:56px;border-radius:12px;background:var(--gold-metal)}
  .dark{background:var(--navy-900);color:var(--on-dark)}
  .dark h2{color:var(--on-dark-muted)}
</style>
</head>
<body>
<main class="container tile">
  <p class="kicker">Planche de style</p>
  <h1>${esc(ctx.business.name)} — identité web</h1>
  <p class="lead">Logo officiel fourni par le client, couleurs relevées sur le blason et le logotype, typographie Archivo (élargie pour les titres, comme le logotype). Tous les éléments ci-dessous utilisent les vrais jetons CSS du site.</p>
  <div class="tile-grid">
    <section class="tile-card">
      <h2>Logo officiel</h2>
      <img src="/img/brand/logo-officiel-480.webp" width="240" height="258" alt="Logo officiel ${esc(ctx.business.name)}">
      <p class="price-note">Version horizontale (en-tête) composée du blason et du logotype officiels, sans retouche :</p>
      <img src="/img/brand/logo-horizontal-400.webp" width="260" height="100" alt="">
    </section>
    <section class="tile-card">
      <h2>Couleurs</h2>
      ${swatches.map(([n, v, hex, use]) => `<div class="sw"><i style="background:var(${v})"></i><div><strong>${n}</strong> <code>${hex}</code><small>${use}</small></div></div>`).join('')}
      <div class="sw"><i class="metal"></i><div><strong>Or métallisé</strong> <code>--gold-metal</code><small>Boutons principaux, chiffres clés</small></div></div>
    </section>
    <section class="tile-card">
      <h2>Typographie</h2>
      <p class="kicker">Surtitre · Archivo 700</p>
      <p style="font-size:2.4rem;font-weight:800;font-stretch:118%;line-height:1.05;margin:0 0 .3em">Titre Archivo élargi 800</p>
      <p style="font-size:1.5rem;font-weight:800;font-stretch:112%">Sous-titre 800</p>
      <p>Texte courant Archivo 400, 17 px, interligne 1,65 : lisible sur mobile comme sur grand écran. <a href="#">Lien souligné or</a>.</p>
    </section>
    <section class="tile-card">
      <h2>Boutons</h2>
      <div class="ctas"><a class="btn btn--primary" href="#">Demander un devis</a><a class="btn btn--ghost" href="#">Voir les prestations</a></div>
      <div class="ctas"><span class="badge-demo">Tarif indicatif</span></div>
    </section>
    <section class="tile-card dark">
      <h2>Sur fond immersif</h2>
      <p class="kicker" style="color:var(--gold-300)">01 — Vitres teintées</p>
      <p style="font-size:1.8rem;font-weight:800;font-stretch:118%;color:#fff;line-height:1.1">Des films solaires posés dans les règles</p>
      <p class="readout"><span class="readout__label">Transmission lumineuse arrière</span> <span class="readout__value">35</span><span class="readout__unit"> %</span></p>
      <div class="ctas"><a class="btn btn--primary" href="#">Demander un devis</a><a class="btn btn--ghost" href="#" style="color:#fff">Voir les prestations</a></div>
    </section>
    <section class="tile-card">
      <h2>Carte prestation</h2>
      <ul class="service-grid" style="grid-template-columns:1fr"><li class="service-card"><a class="service-card__link" href="#"><div class="service-card__media"><img src="/stills/tint-960.webp" alt="" width="960" height="540"></div><div class="service-card__body"><p class="kicker">01</p><h3>Vitres teintées</h3><p>Films solaires de 5 % à 70 %, simulateur 3D et prix en direct.</p><span class="service-card__more">Découvrir →</span></div></a></li></ul>
    </section>
    <section class="tile-card">
      <h2>Direction des images</h2>
      <p>Studio de detailing de nuit : plafond LED hexagonal, sol époxy miroir, lumière froide et accents or. Caméra en vol continu type drone FPV, voiture réelle mise en scène sans artifice graphique superflu.</p>
      <img src="/stills/detailing-960.webp" alt="" width="960" height="540" loading="lazy">
    </section>
  </div>
</main>
</body>
</html>
`;
}
