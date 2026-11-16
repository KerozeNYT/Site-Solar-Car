# Espace atelier — le back-office de SOLAR CAR 37

Adresse : **https://solarcar37-reservation.contact-solarcar37.workers.dev/atelier**
(à mettre en favori, ou « Ajouter à l'écran d'accueil » sur le téléphone : il s'ouvre comme une
application).

## Connexion

Pas de mot de passe : « Recevoir mon code par e-mail » envoie un code à 6 chiffres à
contact.solarcar37@gmail.com (variable `ATELIER_EMAILS`, sinon `NOTIFY_TO`), valable 10 minutes.
On reste ensuite connecté **30 jours** sur l'appareil. « Se déconnecter » en haut à droite.
Sécurité : 5 essais par code, 6 codes par heure au plus, session signée (secret `ATELIER_SECRET`),
cookie `HttpOnly`, `Secure`, `SameSite=Strict`, formulaires acceptés seulement depuis l'espace
lui-même, aucune page indexée.

## Les onglets

| Onglet | Ce qu'on y fait |
|---|---|
| **Accueil** | Le mois en chiffres (RDV en ligne, encaissé, reste à encaisser, demandes de devis, nouveaux clients, visites), les RDV des 14 prochains jours, l'état du bandeau, des raccourcis |
| **Rendez-vous** | Les RDV réservés en ligne : à venir (lus dans l'agenda, à l'heure où ils y sont), retirés de l'agenda (penser au remboursement Stripe), passés |
| **Clients** | Le fichier clients : recherche (nom, téléphone, e-mail, véhicule, immatriculation), fiche de chaque client (coordonnées, véhicules, notes, RDV, demandes de devis, code de parrainage), ajout à la main, suppression, **export pour Excel** |
| **Codes et promos** | Le **bandeau** du site, les **codes promo**, le **parrainage** |
| **Statistiques** | La page de statistiques détaillée (docs/STATISTIQUES.md) |
| **Fiche Google** | Le robot qui publie une photo chaque mardi (docs/FICHE-GOOGLE-AUTO.md) |

## Le fichier clients

- Il se remplit **tout seul** : chaque réservation payée en ligne et chaque demande de devis envoyée
  depuis le site y ajoute le client (ou complète sa fiche : un même client est reconnu à son e-mail,
  sinon à son téléphone ; un nouveau véhicule s'ajoute à sa liste).
- Les clients venus par téléphone ou à l'atelier : « Ajouter un client ».
- **Télécharger pour Excel** : un fichier `.csv` (séparateur « ; », accents conservés) avec
  coordonnées, véhicules, source, nombre de RDV, montant payé en ligne, demandes, code de parrainage,
  dates de premier et dernier contact, notes. À importer aussi dans le logiciel de facturation.
- RGPD : une fiche sans contact depuis **3 ans** est effacée automatiquement (chaque nuit) ; un
  client qui le demande est supprimé depuis sa fiche (les RDV payés restent, sans son nom, pour la
  comptabilité). La politique de confidentialité du site le mentionne.

## Codes promo et bandeau

- **Code promo** : un nom libre (NOEL, PRINTEMPS27…), une remise en % ou en €, les prestations
  concernées (vitres et pare-brise, feux), le nombre d'utilisations (vide = illimité), les dates.
  « Mettre en pause » l'arrête tout de suite. Le client le tape à l'étape du paiement de la
  réservation (même champ que le parrainage, un seul code par réservation) ; l'acompte de 30 % porte
  sur le prix remisé.
- **Bandeaux** : une banderole **animée en haut de toutes les pages** du site, juste sous l'en-tête
  (elle descend comme une pop-up, son texte défile, le titre et le bouton bougent), affichée toute
  seule entre ses deux dates ; on peut en programmer plusieurs (si deux se chevauchent, la plus
  récente passe devant). Chacun a un **style** : Classique (noir et or), **Noël** (rouge, or, neige
  qui tombe), **Néon** (coucher de soleil, palmiers, néons : un dessin original, sans image ni logo
  d'un jeu). Un titre court, un texte, un bouton qui ouvre la réservation avec le code déjà rempli.
  « Voir sur le site » montre un bandeau quelles que soient ses dates. Le visiteur peut le fermer
  (il ne revient pas pendant sa visite). Les mouvements s'arrêtent pour les visiteurs qui ont
  demandé à leur appareil de réduire les animations.
- **Sortie de GTA 6** (préparé dans `content/promos.js`) : code **GTA6**, −15 % sur les vitres
  teintées et les feux teintés, pour toute réservation en ligne **faite le jeudi 19 novembre 2026**
  (de 0 h à minuit) ; bandeau Néon du 17 au 19 novembre. Avant le 19, le code répond « valable le
  jeudi 19 novembre seulement ».
- **Noël 2026** : code **NOEL**, −15 % sur les vitres teintées et les feux teintés réservés en
  ligne, du **1er au 31 décembre 2026**, utilisations illimitées ; bandeau Noël sur la même période.
  Tout se modifie dans l'espace.
- Les bandeaux et les codes servent sur le **nouveau site** : tant qu'il n'est pas sur
  www.solarcar37.fr, le partager par son lien (réseaux sociaux, SMS) pour que les clients en
  profitent.
- Annonce de réduction : le prix barré de référence doit être le prix le plus bas des 30 jours
  précédents (règle européenne « Omnibus ») ; les prix du site ne bougeant pas, c'est le cas.

## Parrainage

Voir docs/RESERVATION.md, section Parrainage : codes créés dans l'e-mail envoyé une semaine après le
RDV, ou depuis la fiche d'un client, ou dans « Codes et promos » ; utilisés en ligne ou marqués
« utilisés » à l'atelier.

## Pour la gestion 2027

- **Facturation électronique** : les micro-entreprises doivent pouvoir **recevoir** des factures
  électroniques depuis le 1er septembre 2026, et au **1er septembre 2027** **émettre** leurs
  factures entre professionnels sous forme électronique et transmettre les données de leurs ventes
  aux particuliers (**e-reporting**), par une plateforme agréée. L'espace atelier ne fait pas de
  factures : choisir au premier semestre 2027 un logiciel de devis / facturation relié à une
  plateforme agréée (beaucoup sont gratuits ou peu chers pour une micro-entreprise), y importer le
  fichier clients (export Excel).
- **Mention TVA** : `vatNote` dans `content/pricing.js` (« TVA non applicable, art. 293 B du CGI »).
  La numérotation des articles du CGI sur la TVA est en cours de refonte : faire confirmer la
  mention exacte à jour par l'expert-comptable ou le service des impôts début 2027, et la changer à
  ce seul endroit.
- Une application à installer n'apporterait rien de plus : l'espace s'ajoute à l'écran d'accueil du
  téléphone et fonctionne comme une application, sans store ni mise à jour.

## Technique

- Serveur : `booking/atelier.js` (pages, connexion), `booking/store.js` (base : Durable Object
  `Atelier`, SQLite ; tables clients, bookings, requests, codes, promos, settings, logins),
  `content/promos.js` (promotions préparées), `content/booking.js` (`discountFor`, `withDiscount`).
- Site : `src/js/main.js` (bandeau, copie des demandes de devis vers `/api/demande`),
  `src/js/booking.js` (champ code), `src/templates/pages.js`.
- API publique : `GET /api/code?code=…`, `GET /api/promo`, `POST /api/demande` (origines du site
  seulement).
- Secret : `npx wrangler secret put ATELIER_SECRET` (une longue valeur aléatoire ; la changer
  déconnecte tous les appareils).
- Tests : `booking/test/atelier.test.mjs`, `booking/test/referral.test.mjs` (`npm run test:booking`).
- Essai sur cette machine : `npm run booking:dev`, puis http://localhost:8787/atelier (le code de
  connexion s'affiche dans la console).
