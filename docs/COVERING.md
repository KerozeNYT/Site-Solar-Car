# Covering & déchromage — fonctionnement, sources, mesures

Prestation ajoutée le 13 octobre 2026 : page `/covering-dechromage/`, chapitre 04 de la visite 3D
de l'accueil avec un point interactif, simulateur 3D avec nuancier 3M™ Série 2080.

## 1. Ce qui a été ajouté ou modifié

| Fichier | Rôle |
|---|---|
| `content/films/3m-2080.js` | Nuancier 3M™ Série 2080 : 29 références vérifiées (champs ci-dessous), références en attente (`pending`, jamais affichées) |
| `content/films/index.js` | Gammes intégrées (seules celles-ci s'affichent), index par identifiant |
| `content/covering.js` | Textes de la page (offres, films, préparation), finitions et effets (paramètres de rendu), films par défaut, mention « simulation indicative », couleur de l'aperçu de l'accueil |
| `content/site.js` | Prestation (menus, cartes, accès direct, pied de page, formulaire, FAQ, SEO), chapitre `covering` de la visite et son point interactif |
| `content/flight.js` | Temps fort `covering` (60 vh) après le detailing, côté passager ; images clés et effets suivants décalés de 5 s d'horloge (rendu des autres chapitres inchangé, vérifié image par image) |
| `content/cars/x6.js` | `covering` : pièces de carrosserie, zones du partiel, pièces chromées, remarques |
| `assets-src/models/x6.prep.json`, `public/models/x6.glb` | Pièces du X6 M renommées (`paint_hood`, `paint_roof`, `paint_mirror_L`, `chrome_grille`…) : même géométrie, 1,43 Mo |
| `src/js/sim/covering.js` | Simulateur : modes, nuancier, matériaux par zone, origine, réinitialisation, récapitulatif, lien partageable |
| `src/js/sim/index.js`, `src/js/sim/viewer.js` | Simulateurs : préparation asynchrone (catalogue chargé à part), mouvements réduits, relance après perte du contexte 3D, options sans voitures garées et densité de pixels plafonnée |
| `src/js/tour/covering-spot.js`, `src/js/tour/index.js`, `src/js/tour/car-model.js`, `src/js/tour/materials.js` | Accueil : point sur la portière, approche caméra, film posé en balayage par uniformes du shader de peinture existant, restauration |
| `src/js/main.js` | Chargement du simulateur à l'approche (`data-sim-lazy`) ; formulaire protégé contre les doublons |
| `src/templates/pages.js`, `src/templates/sims.js`, `src/styles/main.css` | Page, panneau du simulateur, nuancier, point interactif |
| `scripts/render-sim-posters.mjs`, `public/stills/covering-*`, `public/stills/sim-covering-*` | Image de la carte et de l'en-tête (rendu 3D, signalé comme tel), aperçu fixe du simulateur |

## 2. Références 3M : sources et limites de la vérification

- **29 références intégrées**, toutes de la gamme 3M™ Wrap Film Series 2080 (« Films de covering 3M™
  Série 2080 », page de gamme : https://www.3mfrance.fr/3M/fr_FR/p/d/b5005081006/).
- Chacune renvoie à **sa fiche sur 3mfrance.fr** (champ `source`), vérifiée le **13 octobre 2026**
  (champ `verified`). Le code et le nom officiel sont ceux du titre de la fiche
  (« Film de covering 3M™ 2080-G12, Gloss Black, 1524 mm x 45.72 m… »).
- 2080-M12 Matte Black : listé sur la page catalogue 3M France filtrée « Noir mat » (3M ID 7100308564),
  sans fiche individuelle trouvée.
- **Limites** : l'environnement de travail n'a pas pu ouvrir les sites 3M (réseau filtré) ; les titres des
  fiches ont été relevés par moteur de recherche, limité au domaine 3mfrance.fr. Une fiche présente sur
  3M France n'est pas une garantie de stock chez le fournisseur de l'atelier : à confirmer à la commande.
- **Couleurs d'aperçu** : approximations (3M ne publie pas de valeur de couleur) ; signalées comme telles
  dans le nuancier, la fiche de chaque référence et la mention « Simulation indicative ».
- **Non intégrées** (`pending`) : 2080-HG61 High Gloss Nardo Gray et 2080-S327 Satin Ocean Shimmer,
  trouvées seulement sur 3m.com (États-Unis) ; 3M France montre à la place un PWF-G61 (autre gamme,
  Protection Wrap) et un 1080-S327 (ancienne gamme 1080). Aucun catalogue étranger n'est pris comme preuve.
- Répartition : noir 5, blanc et ivoire 7, gris et argent 3, bleu 5, rouge 5, vert 2, violet 1, or 1 ;
  finitions High Gloss 7, brillant 6, satiné 9, mat 7 ; effets métallisé 6, nacré 2, color flip 4,
  carbone 1. Pas de jaune, orange ni brossé vérifiés sur 3M France à cette date.

Champs d'une référence : `id` (stable), `brand`, `range`, `code`, `name` (nom officiel), `label`
(libellé français), `family`, `finish`, `effects`, `preview` (couleur d'aperçu approximative), `approx`,
`visual` (métal, couleur de reflet des films à effet), `source`, `verified`.

## 3. Zones prises en charge (BMW X6 M de démonstration)

Le simulateur utilise le BMW X6 M déjà présent dans le projet (simulateurs de feux et de vitres) : ses
pièces sont séparées et ses chromes sont un matériau distinct. La Porsche GT3 RS de l'accueil n'a pas de
chrome à habiller (contours de vitres déjà noirs, seuls les échappements sont en métal poli), elle sert
donc à l'aperçu de l'accueil mais pas au déchromage.

| Mode | Pièces modifiées |
|---|---|
| Complet | 17 pièces peintes : capot, toit, ailes avant G/D, portes avant G/D, portes et ailes arrière, bas d'ailes arrière, hayon, becquet, boucliers avant et arrière, bas de caisse, diffuseur (2 pièces), coques de rétroviseurs |
| Partiel | Toit, capot, coques de rétroviseurs, becquet de hayon — une référence par zone |
| Déchromage | Calandre (entourage chromé), ouïes d'ailes avant — noir brillant 2080-G12, satiné 2080-S12 ou mat 2080-M12 ; combinable avec le complet ou le partiel |
| Jamais modifiés | Vitrages, pneus, jantes, optiques, grilles plastiques, joints (matériau « plastique noir rugueux » distinct), logos |

Signalés dans le panneau : contours de vitres noir brillant d'origine sur ce modèle (rien à déchromer) ;
sorties d'échappement non traitées par film (chaleur). Une zone dont les pièces manqueraient dans le
modèle est désactivée et marquée « indisponible » (aucune commande sans effet).

Passage Complet → Partiel : le film du complet est gardé de côté (message affiché) et le toit est coché
pour commencer ; retour au Complet : il réapparaît. Les zones du partiel sont gardées de la même façon.

## 4. Poids et performances (avant / après)

Conditions : laboratoire, conteneur sans GPU (rendu 3D logiciel SwiftShader), Chromium 141, serveur local
gzip + `max-age=600` comme GitHub Pages ; Lighthouse 12.6 en throttling simulé (mobile : Moto G Power,
4G lente ; ordinateur : profil desktop). Les chiffres de cadence d'image ne sont pas significatifs sans GPU.

| Mesure | Avant | Après |
|---|---|---|
| JS de l'accueil (gzip) : `main` + visite | 4,57 + 4,16 Ko | 5,01 + 5,28 Ko (**+1,56 Ko**, budget 20 Ko) |
| Accueil, transfert total à froid (ordinateur, labo) | 6 145 Ko, 60 requêtes | 6 151 Ko, 61 requêtes ; aucune ressource covering, aucune voiture en plus |
| Accueil, cache chaud | 0 Ko transféré | 0 Ko transféré |
| CSS partagée (gzip) | 12,8 Ko | 14,7 Ko |
| Page covering avant le simulateur | — | HTML 12,5 Ko gzip + image d'en-tête (35 Ko mobile / 78 Ko ordinateur) + aperçu 40 Ko ; aucun JS covering |
| Code du simulateur covering (gzip) | — | 7,1 Ko + chargeur 1,5 Ko (budget 150 Ko) ; moteur 3D partagé avec l'accueil et les autres simulateurs (three.js 156 Ko, chargement des modèles et scène) déjà en cache après l'accueil |
| Catalogue | — | 4,7 Ko (1,8 Ko gzip), fichier à part, chargé avec le simulateur (budget 100 Ko) |
| Activation du simulateur à froid / à chaud | — | 241 Ko de JS gzip + modèle 1,43 Mo / 0 Ko ; prêt en 1,4 à 2,2 s (labo) |
| 40 changements de référence | — | 44 programmes de shader avant et après, géométries 317 → 317, textures 36 → 36, modèle téléchargé une fois |
| Lighthouse page covering | — | mobile : perf 96, LCP 2,6 s, CLS 0, TBT 0 ms ; ordinateur : perf 100, LCP 0,6 s, CLS 0 |
| Lighthouse accueil (médiane de 3, A/B même machine) | voir ci-dessous | voir ci-dessous |

Lighthouse de l'accueil, version précédente (commit 71733a4) et nouvelle, construites et servies côte à
côte, passages alternés :

| Accueil | Avant | Après |
|---|---|---|
| Mobile, LCP des 3 passages | 2,41 s · 6,69 s · 6,69 s | 2,55 s · 6,76 s · 2,48 s |
| Mobile, CLS | 0 | 0 |
| Ordinateur, LCP des 3 passages | 0,55 s · 0,62 s · 0,57 s | 0,79 s · 0,93 s · 1,29 s |
| Ordinateur, passage apparié avec détail des requêtes | FCP 0,76 s, LCP 1,28 s | FCP 0,76 s, LCP 1,28 s |
| Ordinateur, CLS | 0,002 | 0,002 |

Les deux versions alternent entre ~2,5 s et ~6,7 s sur mobile et varient du simple au double sur
ordinateur : sans GPU, la 3D (calculée par le processeur) occupe le même processeur que la page (TBT
10 à 20 s dans les deux versions). Le passage apparié, avec les mêmes requêtes dans le même ordre et les
mêmes priorités, donne des temps identiques : l'ajout ne change pas le chemin critique (HTML +4 Ko, CSS
+10 Ko non compressés, aucune requête nouvelle avant l'affichage). Le LCP ≤ 2,5 s et l'INP ≤ 200 ms sont
à confirmer sur vrais appareils.

Réglages de performance : rendu à la demande (aucune image calculée à l'arrêt, ni hors écran, ni onglet
caché), densité de pixels 1 sur téléphone et 1,5 sur ordinateur, `MeshStandardMaterial` sur téléphone et
appareil modeste (`MeshPhysicalMaterial` avec vernis sinon), pas de voitures garées dans le simulateur, pas
de post-traitement, motif carbone calculé dans le shader (aucune texture téléchargée), un seul shader pour
tous les films. INP : non mesurable en labo sans interaction réelle ; les changements de film ne font que
modifier des valeurs (pas de rechargement ni de compilation). À mesurer sur vrais appareils après
publication (PageSpeed Insights, rapport Core Web Vitals).

## 5. Dépendances (déploiement, formulaire)

- **Aucun serveur ni service ajouté** : site statique, catalogue statique versionné (nom de fichier haché),
  calcul côté navigateur. Le lien partageable ne contient que des identifiants (`?cfg=…`), validés à
  l'ouverture puis retirés de l'adresse.
- **Formulaire** : même service qu'avant (FormSubmit vers contact@solarcar37.fr) ; la configuration arrive
  dans le message, la case « Covering & déchromage » est cochée. Succès affiché seulement après réponse
  confirmée du service. Nouveau : une demande identique renvoyée dans les 15 minutes n'est pas renvoyée
  sans confirmation (double clic, retour arrière, rechargement).
- **Aperçu GitHub Pages** : testé en sous-dossier `/Site-Solar-Car/` (accès direct, rechargement avec lien
  partagé, devis, aucune ressource en erreur).
- **Production** : `/covering-dechromage/` est dans le sitemap ; canonical sur www.solarcar37.fr.

## 6. Ajouter une référence ou une marque

1. Ouvrir la fiche du film sur le site 3M France (ou du fabricant, pour une autre marque).
2. Dans `content/films/3m-2080.js`, ajouter une ligne : identifiant **nouveau** (`3m-2080-…`, jamais
   réutilisé), code et nom officiel recopiés de la fiche, libellé français, famille, finition
   (`high-gloss`, `gloss`, `satin`, `matte`), effets (`metallic`, `pearl`, `flip`, `carbon`), couleur
   d'aperçu (approximative), chemin de la fiche, date de vérification.
3. Autre marque ou gamme : créer `content/films/<marque>-<gamme>.js` (mêmes champs, plus `range` :
   marque, gamme, page de gamme) et l'ajouter dans `content/films/index.js`. Elle apparaît alors dans le
   nuancier, le filtre et le tableau des références de la page.
4. `npm run build`, vérifier le nuancier, commiter.

Une référence retirée du catalogue : la supprimer de la liste suffit, les liens et réglages qui la citaient
reviennent au film par défaut avec un message.

## 7. À valider par l'atelier

- Disponibilité des 29 références chez le fournisseur ; ajout éventuel d'autres gammes (TeckWrap,
  Coverstyl' figurent parmi les marques partenaires).
- Prix : tout est « Sur devis » tant qu'aucun tarif n'est validé.
- Photos de vraies réalisations covering (bloc prêt, vide pour l'instant).
