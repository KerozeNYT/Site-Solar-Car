# SOLAR CAR 37 — site vitrine

Site statique optimisé SEO, thème sombre « garage de nuit », visite 3D pilotée au scroll (Three.js) : vitres teintées, feux teintés, detailing, covering et déchromage, ciel étoilé, rénovation de phares. Simulateurs 3D : vitres teintées, feux, detailing, ciel étoilé.

## Commandes

```bash
npm install
npm run dev        # serveur de développement : http://localhost:5173
npm run build      # site de production dans dist/
npm run stills     # régénère les images fixes (posters, cartes, image sociale) depuis la scène 3D
npm run posters    # régénère les aperçus des simulateurs (images affichées avant le chargement de la 3D)
npm run preview    # sert dist/ sur http://localhost:4173
```

`npm run stills` et `npm run posters` utilisent Playwright/Chromium et le dossier `dist/` : lancer `npm run build`, puis le script, puis à nouveau `npm run build`.

## Où modifier quoi

| Fichier | Contenu |
|---|---|
| `content/site.js` | Coordonnées, textes, SEO, FAQ, pages prestations (champs `null` = à compléter, non affichés) |
| `content/pricing.js` | Tarifs des simulateurs (`validated: false` = tarifs d’exemple, signalés comme tels) |
| `content/flight.js` | Vol de la caméra : images clés, temps forts du scroll (`beats`), effets |
| `content/car.js` | Voiture du studio (visite 3D, feux, phares, ciel étoilé, detailing) et correspondance de ses pièces |
| `content/vehicles.js` | Voiture 3D de chaque catégorie du simulateur de vitres teintées (`config: null` = silhouette provisoire) ; `parked` = voitures garées en décor dans le studio et l’atelier (ordinateur uniquement) |
| `src/js/tour/props.js` | Équipement de l’atelier : sol polydalle (dalles noires, anneau jaune autour de la voiture), rouleaux de film, tableau d’outils, polisseuses, étagère Koch-Chemie |
| `content/cars/*.js` | Configuration des voitures du simulateur (A 45, A5 Sportback, CLA Shooting Brake, X6 M, Crafter) ; `covering` dans `x6.js` = zones du simulateur de covering |
| `content/covering.js` | Covering & déchromage : textes de la page, finitions et effets (rendu), films par défaut, mention « simulation indicative » |
| `content/films/` | Nuancier : un fichier par marque et gamme (`3m-2080.js`), `index.js` liste les gammes intégrées |
| `assets-src/models/*.prep.json` | Préparation de chaque modèle 3D (découpe des vitres, renommage, allègement) |
| `design/logo/official/` | Logo officiel fourni ; `scripts/logo-assets.mjs` en dérive les versions web (dont `*-clair-*`, logotype ivoire pour le fond sombre : `node scripts/logo-assets.mjs --only=reversed`) |
| `src/styles/main.css` | Charte V3 « garage de nuit » : jetons de couleur et polices en tête de fichier, fond animé dans la section « garage ambience » |
| `src/js/ambient.js` | Fond animé : néons, sol mouillé, fumée et poussière dessinés sur place (rien à télécharger) |
| `content/film.js` | Vidéo d'accueil au défilement : versions (1080p, 1440p, 4K, téléphone 9:16), durée, moments de chaque prestation et onglets |
| `content/sections/` | Sections longues des pages de prestations (forfaits, tableaux, étapes) et questions ajoutées à leur FAQ, une page par fichier ; `content/sections/dechromage.js` porte toute la page Déchromage |
| `content/tint-photos.js` | Photos du simulateur simple des vitres teintées et contour de leurs vitres ; images sources dans `assets-src/vitres/`, puis `node scripts/tint-photos.mjs` |
| `assets-src/partners/` | Logos officiels des marques partenaires (`<marque>.svg` ou `.png`) : `node scripts/partner-logos.mjs` en fait des silhouettes dans `public/img/partners/`, que la page peint en doré ; le chemin se renseigne dans `partners` de `content/site.js` |
| `scripts/film/` | Le film lui-même : décor, trajectoire de la caméra et effets (`shots.js`), rendu image par image en 4K (`node scripts/film/render.mjs <dossier> 3840 2160`), puis `node scripts/film-assets.mjs '<dossier>/f%04d.jpg'` pour fabriquer toutes les versions |
| `scripts/reel/` | Réel « nouveau site » pour les réseaux sociaux (9:16, musique comprise) : `bash scripts/reel/make.sh`, détails dans `docs/REEL.md` |

## Plan d’accès

Le plan (« Venir à l’atelier ») est dessiné à partir de données ouvertes, sans serveur de cartes : deux images vectorielles (`public/map/plan.svg`, vue d’ensemble depuis Tours, et `public/map/plan-zoom.svg`, l’arrivée dans la zone d’activités), avec les noms de lieux et de rues écrits par la page dans ses propres polices (`content/plan.json`, `accessPlan` dans `src/templates/pages.js`). Net à toutes les tailles, quelques dizaines de Ko.

- Données : `pip install shapely pyproj pyarrow requests`, puis `python scripts/map/plan_data.py` (eau, routes, zones bâties et bâtiments Overture Maps / OpenStreetMap, limites communales IGN, dans `.cache/plan/`).
- Dessin : `python scripts/map/plan.py` (cadrage, couleurs, zoom). Le trajet depuis le centre de Tours et les lieux viennent de `public/map/map.json` (`scripts/map/bake.py`, qui calcule l’itinéraire sur le réseau routier).

## Aperçu en ligne (GitHub Pages)

`.github/workflows/apercu-pages.yml` construit le site à chaque push et le publie sur la branche `gh-pages`, servie à l’adresse `https://kerozenyt.github.io/Site-Solar-Car/`. Réglage unique : *Settings → Pages → Source : Deploy from a branch → gh-pages / (root)*.

Le build d’aperçu utilise `SITE_BASE=/Site-Solar-Car/` (préfixe de toutes les adresses) et `PREVIEW=1` (pages en `noindex`, `robots.txt` fermé). Pour la mise en ligne sur le vrai domaine, construire sans ces variables (`npm run build`) et renseigner `siteUrl` dans `content/site.js`.

## Photos de réalisations (galerie, en-têtes des prestations)

1. Déposer les photos d'origine dans `assets-src/photos/originals/` (dossier hors dépôt : plaques et position GPS).
2. Décrire chaque photo dans `assets-src/photos/photos.json` (détail des options en tête de `scripts/photos.mjs`) :
   - `plate` : coins de la plaque (fractions de la largeur et de la hauteur, dans l'ordre haut-gauche, haut-droite, bas-droite, bas-gauche), recouverte par le cache-plaque SOLAR CAR 37 ;
   - `hide` : plaques d'autres véhicules à pixeliser ; `blur` : lettrages en arrière-plan à flouter ;
   - `fill` : enseigne d'une autre entreprise à masquer (le panneau est repeint de sa propre couleur sombre) ;
   - `wide` : version 16:9 pour l'en-tête d'une prestation (`{ "y", "h" }` place la voiture à droite, le titre se lit sur la gauche) ; une version téléphone est écrite en même temps ;
   - `grade: false` pour une photo déjà retouchée, `denoise: false` pour les photos de ciel étoilé (petits points lumineux).
3. `node scripts/photos.mjs --debug` écrit les versions web sans métadonnées dans `public/img/realisations/` (320, 960 et 1280 px, en-têtes) et un contrôle des coins dans `.cache/photos/`.
4. Déclarer la réalisation dans `content/realisations.js` : elle apparaît dans la galerie `/realisations/` (avec son petit texte), sur l'accueil (les trois premières) et sur la page de la prestation ; `heroPhoto` (dans `content/site.js`) choisit la photo d'en-tête d'une prestation, `cardPhoto` celle de sa carte sur l'accueil, `photo` (dans `content/guides.js`) celle d'un guide, `feature` (dans `content/covering.js`) la réalisation racontée en détail sur la page covering.

Ne publier que des photos de véhicules dont le propriétaire est d'accord.

## Covering : ajouter une référence ou une marque

Tout est décrit dans `docs/COVERING.md`. En bref :

- **Une référence** : copier une ligne de `content/films/3m-2080.js`, lui donner un `id` nouveau (jamais réutilisé ni renommé : les liens partagés et les réglages mémorisés y renvoient), le code et le nom officiel tels qu’ils figurent sur la fiche 3M France, l’adresse de cette fiche et la date de vérification. La couleur d’aperçu reste une approximation.
- **Une marque ou une gamme** : créer `content/films/<marque>-<gamme>.js` avec les mêmes champs et l’ajouter dans `content/films/index.js`. Seules les gammes listées là s’affichent.
- Une référence vue seulement sur un site étranger va dans `pending` (jamais affichée) jusqu’à confirmation par le fournisseur.

## Ajouter ou remplacer une voiture du simulateur

1. Déposer le fichier dans `assets-src/models/` (un `.usdz` se convertit d’abord : `node scripts/convert-usdz.mjs fichier.usdz sortie.glb`).
2. Lister ses pièces : `node scripts/inspect-model.mjs assets-src/models/<fichier>.glb`.
3. Écrire `assets-src/models/<nom>.prep.json` (voir les exemples) : `rename` donne un nom court aux vitres et aux feux, `split` découpe un maillage qui regroupe plusieurs vitres, `materialNames` / `groups` retrouvent la peinture et les LED d’un modèle sans noms, `join` et `simplifyAll` allègent le fichier.
4. `npm run model -- assets-src/models/<nom>.prep.json` écrit `public/models/<nom>.glb`.
5. Créer `content/cars/<nom>.js` (même format que `content/car.js`) et le brancher dans `content/vehicles.js`.

Les fichiers sources (`.glb`, `.usdz`) restent hors du dépôt ; seuls les modèles optimisés de `public/models/` sont publiés. Vérifier la licence de chaque modèle et compléter son crédit (`credit` dans sa configuration) : les crédits s’affichent dans les mentions légales.

`content/lastmod.json` : empreinte du contenu de chaque page, mise à jour par le build ; la commiter avec le contenu (le sitemap date ainsi les vraies modifications).

Sécurité : `scripts/security.mjs` écrit au build la Content-Security-Policy de chaque page (balise meta) et, pour la production, `_headers` (Netlify, Cloudflare Pages), les en-têtes de `.htaccess` (Apache, OVH) et `/.well-known/security.txt` ; un service externe ajouté dans `content/site.js` (réservation, flux Instagram) y est autorisé automatiquement. Détails et actions hors code : `docs/SECURITE.md`. Référencement local hors du site (fiche Google, avis, annuaires) : `docs/SEO-LOCAL.md`.

Mise en production : `docs/MIGRATION-DOMAINE.md`. Suivi de la V2 : `docs/V2-ROADMAP.md` (tableau de bord), `docs/V2-AUDIT.md` (audit initial) et `docs/CHANGELOG.md` (journal des changements).
