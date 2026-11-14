# Réel « Notre nouveau site est en ligne »

Vidéo verticale de présentation du site pour Instagram, TikTok, Facebook et LinkedIn :
1080 × 1920, 30 images/s, environ 27 s, H.264 + AAC, son à -14 LUFS.

## Déroulé

| Temps | Plan |
|---|---|
| 0 – 3 s | Accroche : le film de l'accueil (lavage de la Porsche) en plein écran, « Notre nouveau site est *en ligne* » |
| 3 – 11 s | 01 · Le film : le téléphone arrive, on fait défiler l'accueil, le film avance (detailing, phares, covering, feux, vitres et leur compteur de lumière) |
| 11 – 17 s | 02 · Simulateur 3D : teinte 35 % puis 5 %, vue arrière, prix, « Avant / après » (zoom sur la voiture) |
| 17 – 23 s | 03 · Réservation : un jour, une heure, le récapitulatif avec l'acompte |
| 23 – 27 s | Écran final : logo, **solarcar37.fr**, « Atelier à Vouvray, près de Tours », les prestations, « Réservez en ligne · lien en bio » |

Tout ce qui apparaît dans le téléphone est le vrai site, filmé image par image. La réservation est
filmée avec le serveur de réservation local (`booking/dev-server.mjs` : agendas en mémoire,
paiement simulé) : aucun rendez-vous n'est créé dans les vrais agendas.

La musique et les bruitages sont synthétisés par `scripts/reel/audio.py` (aucun morceau ni
échantillon extérieur, donc aucun droit à payer). Deux versions :

- `solarcar37-reel-nouveau-site.mp4` : avec musique (LinkedIn, Facebook, ou partout) ;
- `solarcar37-reel-sans-musique.mp4` : bruitages seuls, pour ajouter un son tendance dans
  Instagram ou TikTok (ces sons tendance aident la diffusion du réel).

`solarcar37-reel-couverture.jpg` : image de couverture (titre d'ouverture sur la Porsche).

## Régénérer

```bash
bash scripts/reel/make.sh
```

Résultat dans `.cache/reel/final/`. Prérequis : `npm install`, Playwright avec Chromium, ffmpeg,
Python 3 avec numpy. Compter une dizaine de minutes (la 3D est rendue sans carte graphique).
`SKIP_CAPTURE=1` refait seulement le montage à partir des captures existantes.

| Fichier | Rôle |
|---|---|
| `scripts/reel/capture.cjs` | Les trois parcours filmés sur le téléphone (taps, défilements, durées) |
| `scripts/reel/compose.html` | Mise en page : accroche, téléphone, titres, écran final (polices et couleurs du site) |
| `scripts/reel/render.cjs` | Titres des trois parties et réglages de la chronologie |
| `scripts/reel/audio.py` | Musique (120 BPM, la mineur) et bruitages calés sur la chronologie |

## Avant de publier

- Le réel affiche **solarcar37.fr** : le publier une fois le domaine basculé sur le nouveau site
  (`docs/MIGRATION-DOMAINE.md`), sinon le lien mène à l'ancien site.
- Mettre le lien du site dans la bio Instagram et TikTok (« lien en bio »).
- Les textes importants restent dans la zone visible des applications (ni sous les boutons de
  droite, ni sous la légende en bas).
