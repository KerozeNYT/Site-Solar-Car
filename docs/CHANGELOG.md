# Journal des changements

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
