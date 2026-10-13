# SOLAR CAR 37 — site vitrine

Site statique optimisé SEO avec visite 3D pilotée au scroll (Three.js) : vitres teintées, feux teintés, detailing, ciel étoilé, rénovation de phares.

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
| `content/cars/*.js` | Configuration des voitures du simulateur (A 45, A5 Sportback, CLA Shooting Brake, X6 M) |
| `assets-src/models/*.prep.json` | Préparation de chaque modèle 3D (découpe des vitres, renommage, allègement) |
| `design/logo/official/` | Logo officiel fourni ; `scripts/logo-assets.mjs` en dérive les versions web |

## Carte 3D de l’accès

La carte (« Venir à l’atelier ») est une scène 3D servie par le site lui-même, sans serveur de cartes : `src/js/map3d.js` lit les fichiers de `public/map/`, produits par `scripts/map/bake.py` à partir de données ouvertes (image Sentinel-2 Copernicus, relief Copernicus DEM, eau ESA WorldCover, routes et lieux Overture Maps / OpenStreetMap, limites communales IGN). Le trajet depuis le centre de Tours est calculé sur le réseau routier.

- Refaire les données : `pip install rasterio numpy pillow shapely pyproj pyarrow requests`, puis `python scripts/map/bake.py` (zone, scène satellite et point de l’atelier dans `scripts/map/common.py` et `bake.py`).
- Refaire l’image fixe (affichée avant la 3D et sans WebGL) : `npm run build`, `node scripts/render-map-poster.mjs`, puis `npm run build`.

## Aperçu en ligne (GitHub Pages)

`.github/workflows/apercu-pages.yml` construit le site à chaque push et le publie sur la branche `gh-pages`, servie à l’adresse `https://kerozenyt.github.io/Site-Solar-Car/`. Réglage unique : *Settings → Pages → Source : Deploy from a branch → gh-pages / (root)*.

Le build d’aperçu utilise `SITE_BASE=/Site-Solar-Car/` (préfixe de toutes les adresses) et `PREVIEW=1` (pages en `noindex`, `robots.txt` fermé). Pour la mise en ligne sur le vrai domaine, construire sans ces variables (`npm run build`) et renseigner `siteUrl` dans `content/site.js`.

## Ajouter ou remplacer une voiture du simulateur

1. Déposer le fichier dans `assets-src/models/` (un `.usdz` se convertit d’abord : `node scripts/convert-usdz.mjs fichier.usdz sortie.glb`).
2. Lister ses pièces : `node scripts/inspect-model.mjs assets-src/models/<fichier>.glb`.
3. Écrire `assets-src/models/<nom>.prep.json` (voir les exemples) : `rename` donne un nom court aux vitres et aux feux, `split` découpe un maillage qui regroupe plusieurs vitres, `materialNames` / `groups` retrouvent la peinture et les LED d’un modèle sans noms, `join` et `simplifyAll` allègent le fichier.
4. `npm run model -- assets-src/models/<nom>.prep.json` écrit `public/models/<nom>.glb`.
5. Créer `content/cars/<nom>.js` (même format que `content/car.js`) et le brancher dans `content/vehicles.js`.

Les fichiers sources (`.glb`, `.usdz`) restent hors du dépôt ; seuls les modèles optimisés de `public/models/` sont publiés. Vérifier la licence de chaque modèle et compléter son crédit (`credit` dans sa configuration) : les crédits s’affichent dans les mentions légales.

Voir `docs/PRODUCTION.md` pour les notes de production (route, choix, limites).
