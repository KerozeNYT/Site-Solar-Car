# SOLAR CAR 37 — site vitrine

Site statique optimisé SEO avec visite 3D pilotée au scroll (Three.js) : vitres teintées, feux teintés, detailing, ciel étoilé, rénovation de phares.

## Commandes

```bash
npm install
npm run dev        # serveur de développement : http://localhost:5173
npm run build      # site de production dans dist/
npm run stills     # régénère les images fixes (posters, cartes, image sociale) depuis la scène 3D
npm run preview    # sert dist/ sur http://localhost:4173
```

`npm run stills` utilise Playwright/Chromium et le dossier `dist/` : lancer `npm run build`, puis `npm run stills`, puis à nouveau `npm run build`.

## Où modifier quoi

| Fichier | Contenu |
|---|---|
| `content/site.js` | Coordonnées, textes, SEO, FAQ, pages prestations (champs `null` = à compléter, non affichés) |
| `content/pricing.js` | Tarifs des simulateurs (`validated: false` = tarifs d’exemple, signalés comme tels) |
| `content/flight.js` | Vol de la caméra : images clés, temps forts du scroll (`beats`), effets |
| `content/car.js` | Modèle 3D utilisé et correspondance de ses pièces (vitres, feux, phares…) |
| `design/logo/official/` | Logo officiel fourni ; `scripts/logo-assets.mjs` en dérive les versions web |

Voir `docs/PRODUCTION.md` pour les notes de production (route, choix, limites).
