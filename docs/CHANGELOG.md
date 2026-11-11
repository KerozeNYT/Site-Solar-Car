# Journal des changements

## V3 — refonte (sombre, moderne, moins de simulateurs)

### Photos de réalisations
- 15 réalisations réelles et 32 photos, triées parmi plus de 80 envoyées (seulement les plus
  belles et les plus parlantes) : vitres teintées (Panamera 4, Cayenne Coupé, A7 Sportback,
  C 63 Break, A 45), covering (McLaren 720S, BMW M2 violette, BMW or chromé, A6 Allroad kaki,
  Classe A), detailing (BMW M2, Porsche 911, Mazda 3), ciel étoilé (BMW Série 2, Audi S1).
- Toutes les plaques recouvertes du cache-plaque SOLAR CAR 37 (en perspective), plaques
  d'autres voitures pixelisées, enseignes et plaques « Even Parc » masquées (panneau repeint
  de sa propre couleur sombre), lettrages d'arrière-plan floutés, métadonnées supprimées.
- Légère retouche commune (contraste, couleurs, coins assombris) et débruitage : 7,9 Mo pour
  toutes les versions web (vignettes 320 px, cartes 960 px, plein écran téléphone 1280 px).
- En-têtes en vraies photos : Panamera (vitres teintées), BMW M2 (detailing), BMW Série 2
  (ciel étoilé), McLaren 720S (covering), avec une version écran large (voiture à droite,
  titre lisible à gauche) et une version téléphone ; la voiture est nommée dans la légende.
- Page covering : la McLaren 720S racontée en détail (de l'orange d'origine au noir satiné,
  photo pendant la pose), puis les autres réalisations covering.
- Galerie `/realisations/` avec filtre par prestation ; ailleurs, les cartes restent courtes
  (pas de texte répété d'une page à l'autre).

### Textes sans répétitions entre pages
- Analyse de toutes les pages indexables (phrases de 8 mots ou plus présentes sur plusieurs
  pages, similarité deux à deux) : 34 phrases répétées → 1 (un titre de guide repris dans ses
  liens, normal).
- Pages de communes : introduction et FAQ construites à partir du trajet réel de chaque commune,
  liste des prestations resserrée ; similarité maximale entre deux communes 0,64 → 0,44 (ce
  qui reste : la fin du trajet, commune à toutes, et les noms et prix des prestations).
- Liens croisés entre prestations : une courte accroche par prestation (`tagline`) au lieu de la
  même phrase partout ; appel à l'action des guides propre à chaque guide (`simPitch`).
- Index des guides : le résumé de chaque guide, plus la copie de son introduction ; encart
  « guide » des prestations sans recopie du texte du guide.

### Vidéo d'accueil au défilement
- La visite 3D de l'accueil est remplacée par une vidéo que le défilement fait avancer et
  reculer (`src/js/film.js`, réglages dans `content/film.js`), gardée en mémoire après
  l'affichage de la page (avance et retour instantanés). Encodage dédié, sans images B.
- Chargement rapide : une version légère (360p, 0,9 Mo) répond au défilement en 1 à 2 s, la
  version nette (900p ordinateur 4,5 Mo, 720p téléphone 3,1 Mo, au lieu de 1080p 12 Mo) se
  télécharge derrière et prend le relais en fondu, au même instant du film.
- Textes des prestations et barre d'onglets (Phares, Detailing, Vitres teintées, Feux teintés,
  Covering, Ciel étoilé) calés sur la vidéo ; un onglet amène au bon moment du film.
- Rythme : chaque prestation a la même longueur de défilement, les passages entre deux
  prestations sont franchis vite (parcours total ≈ 5 écrans au lieu de 7,5).
- Sans JavaScript, avec mouvements réduits ou économiseur de données : les chapitres l'un sous
  l'autre sur leur image tirée de la vidéo (`public/img/film/`).
- `node scripts/film-assets.mjs <vidéo-1080p> [vidéo-720p]` prépare une nouvelle vidéo.
- La visite 3D reste disponible sur `/design/visite-3d/` (non indexée) ; `npm run stills` s'en sert.

### Fond animé plus vivant
- Le fond bouge dès que la page est chargée : fumée qui dérive et respire, poussière qui monte
  dans la lumière, néons qui respirent, balayage de lumière toutes les 9 s.

### Design « garage de nuit »
- Thème sombre sur tout le site (noir profond, cartes en verre fumé, or du blason pour les
  accents), logo en version claire pour l'en-tête et le pied de page.
- Polices : Geist (texte, titres serrés), Instrument Serif italique pour le mot fort des titres
  (`*mot*` dans `content/site.js`), Geist Mono pour surtitres, chiffres et prix.
- Fond animé commun (`src/js/ambient.js` + section « garage ambience » de `main.css`) : néons du
  plafond en perspective, sol mouillé, fumée dessinée sur place, balayage de lumière, grain.
  Pause pendant la visite 3D, immobile si l'utilisateur réduit les animations.

### SEO et contrôles
- Titres ramenés à 60 caractères et descriptions à 160 au plus (affichage complet dans Google),
  pages de communes comprises.
- Manifeste : l'icône `favicon.svg` (absente, erreur 404 dans la console) est retirée.
- Carte 3D : libellés à 12 px minimum (lisibilité mobile) ; surtitres à 12 px.
- Correctif : la carte de l'atelier débordait de l'écran sur ordinateur ; un bouton au libellé
  long dépassait sur les écrans de 360 px (les boutons peuvent maintenant passer à la ligne).
- Contrôle des 37 pages (animations figées) : aucune erreur, aucun lien cassé, aucune page
  orpheline, aucune violation d'accessibilité (axe, WCAG 2.2 AA), aucun débordement mobile.
  Lighthouse : SEO 100 et accessibilité 100 sur les pages mesurées.

### Vitesse (mesures Lighthouse mobile, conteneur sans carte graphique)
- Néons du plafond et reflets du sol dessinés une fois sur un canevas (au lieu de plans 3D en
  CSS, coûteux à peindre) ; la fumée et le balayage de lumière ne bougent qu'après le premier
  geste du visiteur (défilement, toucher, souris, clavier).
- Test de prise en charge de la 3D (contexte WebGL) fait au moment de lancer une scène, plus au
  chargement : plusieurs secondes gagnées sur les appareils sans carte graphique.
- Simulateurs sur ordinateur : la 3D démarre quand la vue est vraiment à l'écran ; carte 3D :
  près de l'écran et après un premier geste (image fixe avant).
- Contact 38 → 77, vitres teintées 58 → 93, page Tours 62 → 95 (même machine de mesure).

### Moins de simulateurs
- Simulateur covering retiré : la page `/covering-dechromage/` garde ses offres, le nuancier
  3M™ Série 2080 (tableau des références vérifiées), la préparation, la FAQ et le devis.
- Simulateur de rénovation de phares retiré : la page `/renovation-phares/` affiche un tableau de
  tarifs (rénovation des deux phares, option céramique) et les limites de la rénovation.
- Accueil : le point interactif covering de la visite 3D est retiré ; les chapitres covering et
  phares n'annoncent plus de simulateur. Le guide « phares jaunis » renvoie vers la prestation.
- Code et images supprimés : `src/js/sim/covering.js`, `src/js/sim/headlights.js`,
  `src/js/tour/covering-spot.js`, aperçus `sim-covering-*` et `sim-headlights-*`, zones covering
  du X6 et styles associés. Simulateurs conservés : vitres teintées, feux, detailing, ciel étoilé.

## V2 — en cours

### Phase 1 — Audit initial
- Audit complet : `docs/V2-AUDIT.md` (build, 32 pages, accessibilité, performance, conformité).
- Tableau de bord : `docs/V2-ROADMAP.md`.

### Phase 2 — Fiabilité commerciale et conformité
- `content/pricing.js` devient la source unique des prix : titres SEO, descriptions, FAQ, guides,
  gabarits et données structurées lisent `priceText` (plus aucun prix recopié en dur).
- Prix en attente de validation (`validated: false`) jamais affichés : PPF teinté, fourchettes
  ciel étoilé et detailing préparées mais remplacées par « sur devis ».
- `content/regulation.js` : seuil de 70 % (vitrage + film), sanctions, dérogations exactes (véhicules
  blindés homologués, 3 affections listées par l'arrêté du 18 octobre 2016), règle des feux.
- Simulateur de vitres : statut routier sous chaque zone (autorisé, conformité à vérifier, sous le
  seuil dans la plupart des cas, visualisation esthétique) ; plus de « film 70 % conforme » ; la case
  « j'en accepte la responsabilité » est retirée (l'accord du client ne remplace pas la règle) ;
  la demande de devis transmet le statut de chaque zone.
- Simulateur de feux : choix covering / PPF teinté, avec description factuelle de chaque matériau.
- Allégations retirées ou corrigées : « films homologués », « le film protège l'optique »,
  « protection céramique longue durée », dépose du film avant contrôle technique.
- Mentions légales : section tarifs (indicatifs), médiation de la consommation (à compléter),
  notice RGPD complète (finalité, base légale, destinataires et transfert hors UE, durée, droits, CNIL).

### Correctifs prioritaires (P0/P1 de l'audit)
- Accueil : titre, texte et boutons lisibles et cliquables dès l'ouverture, pendant le chargement
  de la 3D (ils attendaient auparavant le téléchargement de la voiture, ~5,8 Mo).
- En-tête mobile : bouton « Devis » et bouton d'appel toujours visibles, hors du menu (la barre
  d'actions du bas est masquée pendant la visite 3D).
- Indicateur de chargement de la 3D déplacé en haut sur mobile (il chevauchait un bouton).

### Phase 3 — Design premium (accueil, accessibilité)
- Accueil : « SOLAR CAR 37 » en grand (reflet doré lent), « Esthétique & personnalisation
  automobile », « Atelier à Vouvray — Tours (37) », deux actions (« Demander un devis »,
  « Découvrir l'expérience » qui fait entrer la caméra dans l'atelier), accès direct aux cinq
  prestations, indication « faites défiler » quand la 3D est active.
- « Passer la visite » devient « Aller aux prestations ».
- Débordement horizontal mobile de l'accueil corrigé.
- Accessibilité : contrastes des pastilles inactives conformes (4,5:1), `aside` imbriqués remplacés
  (axe-core : 0 violation sur les 32 pages).

### Phase 4 — Visite immersive
- Parcours raccourci : 6,3 écrans de défilement sur ordinateur (13,4 auparavant), 5,3 sur mobile
  (`mobileScale` 0,85), même trajectoire de caméra ; fondus des chapitres ajustés.
- « Découvrir l'expérience » fait voler la caméra jusqu'au premier chapitre ; repères cliquables
  sur la ligne de progression (un par chapitre, zone tactile 24 px).
- Rendu à la demande : pleine cadence pendant les mouvements, ~20 i/s quand seuls les étoiles ou
  le trafic extérieur bougent, aucun rendu quand tout est immobile (reprise au défilement).
  Mesure : 2 rendus en 3 s immobile au lieu d'environ 180.

### Phase 5 — Simulateurs
- Communs : bouton « Réinitialiser » ; réglages mémorisés 14 jours sur l'appareil et repris au
  retour (avec « Repartir de zéro ») ; sur téléphone et en économie de données, la 3D ne se
  télécharge qu'au toucher de « Lancer la vue 3D » (l'aperçu fixe reste affiché avant).
- Feux : bouton « Avant / après » (mêmes feux sans film, allumés ou au freinage).
- Ciel étoilé : réglage d'intensité, bouton « Éteindre / Allumer », note sur les options selon le kit.
- Rénovation de phares : six étapes pédagogiques le long du curseur et de la démonstration
  (optique ternie → préparation → polissage → transparence → protection → résultat) et limites
  de la rénovation affichées.
- Detailing : différence entre entretien, polissage, correction et protection céramique expliquée.

### Phase 6 — Conversion
- Pièces jointes : envoi classique multipart (méthode documentée par FormSubmit pour les fichiers)
  puis page de confirmation `/contact/merci/` (non indexée) ; sans fichier, l'envoi rapide (AJAX)
  est conservé. Testé avec un FormSubmit simulé ; le vrai service reste à tester après activation.
- Formulaire : rendez-vous souhaité facultatif (date, matin/après-midi), clairement présenté comme
  une demande et non une réservation ; consigne « inutile d'envoyer une carte grise complète ».
- Suivi de conversion sans traceur ni cookie ni donnée personnelle (`window.sc37Events`, événement
  `sc37:event`) : clics devis, appel, itinéraire, devis depuis un simulateur, 3D lancée, demande
  envoyée ou en erreur. Prêt pour un outil de mesure sans cookie s'il est choisi plus tard.
- Architecture de la future réservation en ligne : `docs/RESERVATION.md`.

### Phase 7 — Réalisations
- `content/realisations.js` : liste administrable des vraies réalisations (photos clients uniquement,
  jamais de rendu 3D présenté comme une réalisation). Vide pour l'instant : la galerie, son lien de
  menu, son entrée de sitemap et ses blocs ne sont pas générés tant qu'elle est vide.
- Dès la première réalisation : page `/realisations/` filtrable par prestation, bloc « dernières
  réalisations » sur l'accueil et sur chaque page de prestation, bouton « Demander une prestation
  similaire », comparateur avant/après accessible (clavier, toucher, souris).
- Testé avec des données temporaires (non publiées).

### Phase 8 — Performance, résilience
- Accueil sur téléphone : la 3D se charge après l'affichage de la page, quand le téléphone est
  disponible (LCP labo 38,4 s → 2,3 s ; ordinateur 7,5 s → 1,3 s).
- Connexion lente (2G/3G), économie de données ou mouvements réduits : accueil en image fixe, avec
  un bouton « Lancer la visite 3D » si l'appareil en est capable.
- Paramètre `?static` réparé (l'expression régulière était cassée par un échappement).
- Pages de simulateurs sur mobile : 312 Kio au lieu de 6,8 Mio avant interaction.
- Carte 3D : plus de tentative (ni d'erreur console) sans WebGL, l'image fixe reste.
- Constat : modèles 3D déjà compressés (meshopt, quantification, textures WebP).

### Phase 9 — SEO
- Sitemap : `lastmod` = date de la dernière modification réelle du contenu de chaque page
  (empreinte dans `content/lastmod.json`), plus la date du build.
- Trois guides factuels : prix des vitres teintées près de Tours (depuis la grille centrale), choix
  de la teinte (5 % à 70 %), film nano-céramique (principe, sans chiffres non sourcés).
- Chaque page de prestation renvoie vers tous ses guides.
- Plan de mise en production et de migration du domaine : `docs/MIGRATION-DOMAINE.md` (aucun DNS
  modifié).

### Phase 10 — Tests finaux
- Prix de la configuration par défaut écrits dans le HTML des simulateurs (visibles avant le script
  et sans JavaScript).
- `scripts/serve.mjs` : chemin servi normalisé (un chemin avec « .. » était refusé).
- Tests exécutés : audit des 36 pages (0 erreur, 0 lien cassé, 0 violation axe-core), 4 scénarios
  clients (citadine 5 %, phares, ciel étoilé, mobile sans GPU), aperçu GitHub Pages simulé en
  sous-dossier (visite, simulateur, formulaire avec photo, aucune ressource en erreur), lecture
  complète du detailing en 3D, Lighthouse avant/après.

### Modèles 3D : Volkswagen Crafter et cache-plaques
- Catégorie « utilitaire » du simulateur de vitres : Volkswagen Crafter fourni par l'atelier
  (`.usdz` converti, 84 Mo → 2,9 Mo), peinture, vitres (pare-brise, portes avant, vitres
  latérales, porte coulissante, portes arrière) et feux arrière nommés
  (`assets-src/models/crafter.prep.json`, `content/cars/crafter.js`). Plus de silhouette provisoire.
- Cache-plaque SOLAR CAR 37 posé sur la plaque d'origine de toutes les voitures 3D (A 45, A5,
  CLA, X6, Crafter, en plus de la Porsche), hauteur relevée par balayage de chaque modèle ;
  visible aussi sur les voitures garées en décor.
- Aperçus des simulateurs vitres et feux régénérés (cache-plaque visible).

### Photos de réalisations (chaîne prête, en attente des fichiers)
- `scripts/photos.mjs` : pose du cache-plaque SOLAR CAR 37 en perspective sur la plaque, plaques
  d'autres véhicules pixelisées, métadonnées retirées (position GPS des iPhone), versions web.
- Dessin du cache-plaque partagé entre la 3D et les photos (`src/js/plate-art.js`).
- Réalisations déclarées : Audi A5 Coupé S line (3 photos) et Volvo V60 ; elles s'affichent dès
  que leurs photos retouchées existent. La photo de trois quarts arrière de l'Audi devient l'en-tête
  de la page vitres teintées (avec la mention « Réalisation de l'atelier ») et son image de partage.
- Cartes de la galerie : vignettes pour passer d'une photo à l'autre.

### Formulaire : aucune demande perdue si l'envoi échoue
- Si le service d'envoi refuse la demande (formulaire pas encore activé, panne, réseau), le visiteur
  voit « Envoyer ma demande par e-mail » (sa messagerie s'ouvre avec toute la demande rédigée) et
  « Appeler l'atelier », au lieu d'un simple message d'erreur.

### Covering & déchromage
- Nouvelle prestation et page `/covering-dechromage/` (H1 « Covering et déchromage automobile près de
  Tours ») : trois offres (complet, partiel, déchromage) « Sur devis », simulateur, films, finitions et
  préparation, tableau des références, réalisations (bloc prêt, vide pour l'instant), FAQ, devis.
- Partout dans le site : menu « Nos prestations », cartes de l'accueil, accès direct, pied de page, cases
  du formulaire, prestations liées, données structurées, sitemap.
- Nuancier 3M™ Série 2080 : 29 références vérifiées sur 3M France (fiche et date pour chacune),
  recherche par nom ou code, filtres famille / finition / effet, pastilles accessibles au clavier (une
  seule tabulation, flèches), état choisi signalé par un anneau et une coche. 2080-HG61 et 2080-S327 :
  vues seulement sur le site américain, non intégrées.
- Simulateur sur le BMW X6 M déjà présent (pièces renommées, géométrie identique) : covering complet
  (17 pièces peintes), partiel (toit, capot, coques de rétroviseurs, becquet, une référence chacun),
  déchromage des vraies pièces chromées (calandre, ouïes d'ailes) en noir brillant, satiné ou mat,
  combinable. Vitrages, pneus, jantes, optiques, grilles et joints jamais modifiés.
- Vues 3/4 avant, profil, 3/4 arrière, toit ; « Voir l'origine » / « Voir ma configuration » ;
  « Réinitialiser » ; récapitulatif copiable ; lien partageable (identifiants seulement, validés) ;
  « Demander un devis pour cette configuration » préremplit le formulaire.
- Performance : code et catalogue chargés à l'approche du simulateur ; sur téléphone et en mouvements
  réduits, 3D au toucher de « Activer le simulateur 3D » ; un matériau par zone, aucun shader recréé au
  changement de film (40 changements mesurés) ; densité de pixels 1 (téléphone) / 1,5 ; pas de voitures
  garées ; relance contrôlée après perte du contexte 3D (tous les simulateurs).
- Accueil : chapitre « 04 — Covering & déchromage » dans la visite (6,9 écrans au lieu de 6,3, autres
  chapitres inchangés), point interactif sur la portière (clavier, toucher) : la caméra s'approche, un
  film 3M™ 2080-M21 se pose sur la carrosserie, la peinture d'origine revient en sortie. JS ajouté :
  1,6 Ko gzip ; aucun téléchargement covering à l'accueil.
- Formulaire : protection contre les doublons (double clic, renvoi de la même demande dans les 15 min).
- Détails, sources, mesures et procédure d'ajout d'une référence : `docs/COVERING.md`.

### Correctif : éléments de la visite qui disparaissaient après des allers-retours
- Cause : le régulateur de performance retirait des éléments dès que la médiane dépassait 30 ms
  entre deux images ; un écran à 60 Hz qui tourne à 30 images/s donne 33 ms, donc chaque série de
  mouvements retirait quelque chose (netteté, voitures garées, puis tous les reflets du sol).
- Désormais : deux fenêtres lentes consécutives sont nécessaires, les à-coups isolés (compilation,
  allers-retours rapides) sont ignorés, la netteté baisse d'abord (sous ~25 images/s), les voitures
  garées ne partent que sous ~18 images/s et les reflets sous ~15 images/s soutenues. Même règle
  pour les simulateurs.

### Correctif : textes de la visite invisibles après la perte de la 3D (téléphones)
- Cause : quand le navigateur retire la mémoire graphique de la page (deuxième scène 3D comme la
  carte, autre application, onglet en arrière-plan), la visite passait en version fixe sans remettre
  ses chapitres d'aplomb : titres, textes et boutons restaient invisibles.
- Désormais : la visite attend que le navigateur rende la 3D et reprend là où elle était ; sinon
  elle se relance une fois sur une nouvelle zone de dessin (modèle repris du cache) quand elle est à
  l'écran ; en dernier recours, version fixe avec tous les chapitres lisibles.
- Le régulateur de la visite ne retire plus jamais d'élément visible : seule la netteté baisse.
- Téléphone : sur l'accueil, la carte 3D démarre au toucher (« Afficher la carte 3D ») pour ne
  jamais avoir deux scènes 3D en même temps.
