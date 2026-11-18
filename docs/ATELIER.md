# Espace atelier — le back-office de SOLAR CAR 37

Adresse : **https://atelier.solarcar37.fr** (depuis le 17 novembre 2026 ; l'ancienne
https://solarcar37-reservation.contact-solarcar37.workers.dev/atelier marche toujours ; on se
reconnecte une fois sur la nouvelle adresse)
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
| **Accueil** | Le RDV en cours (barre d'avancement, reste à encaisser) ou le prochain (compte à rebours), le suivi des devis en 5 cases (à répondre, réponse reçue, en attente, à relancer, validés du mois), « À traiter », le fil « En direct », les 7 prochains jours de l'agenda SOLAR CAR 37, le mois en chiffres, le bandeau |
| **Devis** | Les demandes de devis en discussions : répondre (montant, PDF, bouton « J'accepte »), statuts Nouveau / Devis envoyé / Réponse reçue / Validé / Sans suite, et « à relancer » (voir plus bas) |
| **Rendez-vous** | **Nouveau RDV** (un client au téléphone, voir plus bas), les liens de paiement envoyés, les RDV réservés : à venir (lus dans l'agenda, à l'heure où ils y sont), retirés de l'agenda (penser au remboursement Stripe), passés |
| **Clients** | Le fichier clients : recherche (nom, téléphone, e-mail, véhicule, immatriculation), fiche de chaque client (coordonnées, véhicules, notes, RDV, demandes de devis, code de parrainage), ajout à la main, suppression, **export pour Excel** |
| **Codes et promos** | Le **bandeau** du site, les **codes promo**, le **parrainage** |
| **Cartes & Premium** | Les **cartes cadeaux** (solde, envoi, débiter, créer), les **membres SOLAR CAR Premium** (niveaux, cadeaux à remettre, ajouter), **écrire aux membres** (docs/CARTES.md) |
| **Statistiques** | La page de statistiques détaillée (docs/STATISTIQUES.md) |
| **Fiche Google** | Le robot qui publie une photo chaque mardi (docs/FICHE-GOOGLE-AUTO.md) |
| **Réglages** (« Plus » sur téléphone) | Les autres espaces, et les délais du suivi des devis (« à relancer », « sans suite ») |

## L'allure

Le garage de nuit du site sous chaque page (refonte du 17 novembre 2026) : néons du plafond en
perspective, reflets sur le sol mouillé, fumée lente, poussière dans la lumière, un balayage de
lumière ; les néons prennent les couleurs de l'habillage saisonnier du site (`content/themes.js` :
Néon, Noël). Par-dessus, des panneaux de verre fumé, noir, or et ivoire, polices Geist et
Instrument Serif, des chiffres qui défilent à l'ouverture.

- **Ordinateur** : une barre à gauche (Accueil, Devis, Rendez-vous, Clients ; Codes et promos,
  Statistiques, Fiche Google, Réglages), le bouton **+ Nouveau** (client, code promo, parrainage,
  export) et l'état « En direct ».
- **Téléphone** : une barre en bas (Accueil, Devis, RDV, Clients, Plus), le **+** en haut à droite.
  « Ajouter à l'écran d'accueil » (Safari : bouton Partager ; Chrome : menu ⋮) l'installe comme une
  application. Pas de flou derrière les panneaux sur téléphone (batterie).
- **Icône** (choisie le 17 novembre 2026) : le blason dans un engrenage noir sur fond or, pour la
  distinguer au premier coup d'œil des autres applications au blason sur fond noir (le CRM).
  Fabriquée par `node scripts/logo-atelier.mjs` (proposition B, `design/logo/atelier/`), copiée dans
  `booking/assets/icone-512.png` et `icone-180.png`. Après un changement d'icône, supprimer le
  raccourci de l'écran d'accueil et l'ajouter de nouveau (le téléphone garde l'ancienne).
- **En direct** : la page ouverte se met à jour toute seule toutes les 30 secondes (et dès qu'on
  revient dessus) : pastilles, accueil et liste des devis redessinés quand quelque chose change
  (jamais pendant qu'on écrit : un bouton « Du nouveau : actualiser » apparaît), et une
  notification en bas à droite pour une nouvelle demande, un message d'un client, un devis accepté,
  un RDV payé.
- Code : `booking/atelier-look.js` (la feuille de style et le script, servis à `/atelier/app.css`
  et `/atelier/app.js`), `booking/atelier.js` (les pages), `/atelier/live` (les nouvelles, en JSON).
  Toutes les pages marchent sans le script. Les images de marque viennent de `public/img/brand/`
  (copies dans `booking/assets/`).
- Essai avec des exemples : `DEMO=1 npm run booking:dev`, puis http://localhost:8787/atelier.

## Notifications sur le téléphone et l'ordinateur

**Réglages** (« Plus » sur téléphone) → **Notifications** → « Activer sur cet appareil » : une
notification arrive pour chaque **nouvelle demande de devis**, **message d'un client** (relais
e-mail ou lu dans Gmail), **devis accepté** et **RDV payé** (en ligne ou acompte d'un RDV pris par
téléphone), même l'espace fermé ; la toucher ouvre la bonne page de l'espace.

- **iPhone** (iOS 16.4 ou plus récent) : ouvrir l'espace dans Safari → Partager → « Sur l'écran
  d'accueil », l'ouvrir depuis son icône, puis « Activer » et accepter. Apple n'autorise les
  notifications qu'aux applications web posées sur l'écran d'accueil.
- **Ordinateur** : « Activer » et accepter dans le navigateur (Chrome, Edge, Firefox, Safari).
- **Journaux du serveur** (Workers Logs, `[observability]` dans `booking/wrangler.toml`) : chaque
  requête et chaque ligne d'erreur, gardées 3 jours sur Cloudflare, pour contrôler un parcours.
- « Envoyer un essai » vérifie ; « Désactiver ici » arrête sur cet appareil ; 10 appareils au plus.
- Technique : `booking/push.js` (Web Push : clés VAPID faites une fois et gardées dans la base,
  messages chiffrés pour chaque appareil, aucun service extérieur), service worker
  `/atelier/sw.js`, table `push_subs`. Tests : `booking/test/push.test.mjs`.

## Nouveau rendez-vous (au téléphone ou à l'atelier)

Un client appelle ou passe à l'atelier : **+ Nouveau → Nouveau rendez-vous** (ou Rendez-vous →
« Nouveau RDV », ou depuis sa fiche client, déjà remplie).

0. **Par téléphone** ou **À l'atelier** : comment le RDV a été pris ; c'est écrit dans l'e-mail
   « Nouveau RDV » (« pris par téléphone · acompte payé en ligne »), dans l'agenda (« Pris à
   l'atelier le … ») et dans la liste des RDV, et le message au client commence par « Merci pour
   votre appel ! » ou « Merci pour votre visite à l'atelier ! ». Les RDV du site restent « réservés
   en ligne ».
1. **Client** : prénom, nom, téléphone, e-mail (il faut l'e-mail pour le lien de paiement),
   véhicule, année, immatriculation. Un client déjà connu (même e-mail ou même téléphone) est
   retrouvé dans le fichier.
2. **Prestations**, prix déjà réglés :
   - vitres teintées : la catégorie du véhicule (petite citadine, citadine, berline, cabriolet,
     coupé, break, monospace, SUV, utilitaire) et la formule (3/4 arrière, complet, 2 vitres avant,
     2 vitres avant + custodes) ;
   - pare-brise (athermique, teinté 50 %, irisé et sa couleur), avec ou sans vitres ;
   - feux teintés vinyle (arrière, avant, les deux) ;
   - jusqu'à 3 autres lignes : rénovation de phares (79 €, + céramique 109 €), feux en PPF teinté,
     ciel étoilé, detailing (Essentiel, Éclat, Signature), covering, déchromage, ou une ligne libre.
     Prix et durée se remplissent et se modifient ; pour une prestation sur devis, taper le prix
     convenu. Les durées proposées sont une première estimation (`atelierExtras` dans
     `content/booking.js`).
   - Le récapitulatif (total, durée, acompte) se calcule à mesure.
3. **Créneau**, deux façons :
   - **Créneaux libres de l'agenda** (comme la page de réservation du site) : les jours du mois à
     venir avec leur nombre de créneaux libres dans vos trois agendas (SOLAR CAR, SOLAR HOME,
     perso ; sans le délai de 48 h du site), flèches pour le mois suivant ; un jour, puis l'heure
     (matin, après-midi).
   - **Date et heure au choix** : la date, l'heure tapée (les créneaux libres du jour s'affichent
     aussi). Un créneau qui chevauche l'agenda est refusé, sauf en cochant « Garder ce créneau
     quand même ».
4. **Paiement** :
   - **Le mot pour le client** se remplit tout seul d'après la page (prénom, date, voiture,
     prestations, total, acompte et reste à régler) tant que vous ne l'avez pas modifié ;
     « ↺ Message automatique » le refait. Il ouvre l'e-mail du client.
   - **Acompte 30 %** ou **Totalité** : le client reçoit aussitôt un e-mail (votre mot,
     récapitulatif, bouton « Régler … et confirmer ») ; le créneau est bloqué dans l'agenda (« ⏳
     Paiement en cours ») exactement pendant la durée du lien : 2 h, 6 h ou **24 h** (le maximum de
     Stripe).
     La page du lien permet aussi de l'envoyer **par SMS ou WhatsApp** et de l'**annuler** (le
     créneau se libère).
   - Dès que le client a payé : comme une réservation en ligne, le RDV est confirmé dans l'agenda,
     vous recevez l'e-mail « Nouveau RDV » (et la notification Stripe), le client sa confirmation,
     l'espace affiche « RDV réservé et payé ». Sans paiement à temps, le créneau se libère tout seul
     (« Lien expiré ») : refaire un RDV pour lui renvoyer un lien.
   - **Sur place** (sans paiement en ligne), ou un code qui couvre tout : le RDV est inscrit tout de
     suite dans l'agenda, le client reçoit sa confirmation s'il a donné son e-mail.
   - Un code promo ou de parrainage se tape comme en ligne.
   - **Remise (cas exceptionnel)** : en % ou en €, sans créer de code ; elle s'ajoute au code s'il y
     en a un (calculée sur ce qu'il laisse), jamais plus que le total. Elle figure sur sa ligne
     « Remise » dans le récapitulatif, l'e-mail, l'agenda et la confirmation ; à 100 %, le RDV est
     inscrit sans paiement.
5. Rendez-vous → « Pris à l'atelier » : les liens des deux dernières semaines et leur état
   (en attente, payé, expiré, annulé, sur place).

**Modifier un RDV confirmé** (une prestation demandée en plus) : Rendez-vous → la date du RDV (ou
sa fiche client, ou « Ouvrir le RDV » sur la page du lien) → **Ajouter une prestation** : libellé
(ou une prestation de la liste), prix, remise en % (le prix net s'affiche), durée, case « Allonger
le RDV dans l'agenda ». Le total et le **reste à régler à l'atelier** se recalculent (ce qui est payé
ne bouge pas), l'agenda reçoit un bloc « Ajouts à l'atelier » ; rien ne part au client. Une
prestation ajoutée par erreur se retire (la corbeille) ; celles réservées au départ ne se retirent
pas d'ici. Puis **Prévenir le client** : mot facultatif, case **« Demander un acompte en ligne »**
(30 % des ajouts proposés, modifiable, lien Stripe de 2 h à 24 h), **« M'envoyer un aperçu »** (à vous
seul, aucun paiement créé) et **« Envoyer la mise à jour au client »**. L'acompte payé s'ajoute au
« déjà réglé » (notification, agenda à jour). Les rappels de la veille reprennent les prestations
ajoutées et ce qui reste vraiment à régler (y compris pour les RDV réglés sur place).

Code : `booking/worker.js` (`atelierBooking`, `atelierSlots`, `atelierCancel`, `atelierBookingChange`), `booking/atelier.js`
(le formulaire, la page du lien), table `links` (`booking/store.js`), e-mail `sendPaymentLink`
(`booking/mail.js`). Tests : `booking/test/rdv.test.mjs`.

## Devis : les discussions

Onglet **Devis** (pastille = demandes nouvelles ou avec un message non lu) :

- Chaque demande de devis du site ouvre une **discussion** numérotée (n°12), avec les photos du
  client affichées. Filtres par statut : **Nouveau**, **Devis envoyé**, **Validé**, **Sans suite**.
- **Répondre** depuis la discussion : message, montant du devis (facultatif), pièces jointes (devis
  PDF, photos), case « bouton J'accepte ce devis » (cochée tant que le devis n'est pas validé).
  L'e-mail part de contact@solarcar37.fr, mis en page aux couleurs de l'atelier, avec un rappel de
  la demande ; une copie arrive dans le Gmail de l'atelier.
- **Ou depuis Gmail**, comme avant : répondre à l'e-mail « Demande de devis n°… » (ou à une
  notification « Message de … ») passe par le site, qui envoie au client un e-mail propre et range
  la réponse dans la discussion. Les réponses du client arrivent dans la discussion **et** dans
  Gmail (« Message de Prénom Nom »), dans la même conversation que votre réponse.
- **Statuts automatiques** :
  - **Nouveau** : la demande arrive, à répondre.
  - **Devis envoyé** : dès votre réponse (atelier ou Gmail) ; c'est au client de répondre.
  - **Réponse reçue** : le client a écrit après votre devis ; à lire et à répondre (votre
    réponse le repasse en « Devis envoyé »).
  - **Validé** : le client clique « J'accepte ce devis » (vous recevez « Devis n°… accepté » avec
    son téléphone) ou réserve et paie en ligne la même prestation (vitres, feux).
  - **À relancer** (repère, pas un statut) : « Devis envoyé » sans nouvelles depuis **7 jours** ;
    la discussion affiche un message de relance prêt à envoyer.
  - **Sans suite** : sans nouvelles depuis **14 jours**, tout seul (une note le dit dans la
    discussion), ou à la main. Si le client écrit ensuite, la demande revient d'elle-même en
    « Réponse reçue ». Gmail continue d'être lu 30 jours pour ces demandes.
  - Délais réglables : **Réglages** (« Plus » sur téléphone) ; 0 = jamais « Sans suite ».
  - Corrections : à la main, encadré « Suivi » de la discussion.
- L'accueil montre le suivi en 5 cases (à répondre, réponse reçue, en attente, à relancer,
  validés du mois avec leur montant) et « À traiter » : les clients qui ont écrit d'abord, puis les
  nouvelles demandes, puis les relances.
- Les réponses par Gmail passent par l'adresse `devis@reponse.solarcar37.fr` (réglage
  `QUOTE_REPLY`, docs/RESERVATION.md) ; tant qu'elle n'est pas en service, répondre depuis Gmail
  écrit directement au client (comme avant) et seule la réponse depuis l'atelier est suivie.

## Gmail dans l'espace (onglet Devis)

« Connecter Gmail » (onglet Devis) relie le Gmail de l'atelier : les réponses écrites **depuis
Gmail** à un client dont le devis est ouvert, et les réponses du client, arrivent dans la
discussion du devis (« depuis Gmail »), et le statut passe à « Devis envoyé » à la première réponse.
Gmail est relu à chaque ouverture de l'onglet Devis ou de l'accueil (une fois par minute au plus),
avec « Actualiser », et chaque jour à 16 h UTC. Seuls les e-mails échangés avec l'adresse d'un client
dont la demande a moins de 90 jours et n'est pas « Sans suite » sont lus (`in:sent to:…` et
`from:…`, après la date de la demande) ; chaque e-mail une seule fois (son Message-ID).
« Déconnecter » oublie l'accès (le retirer aussi chez Google : myaccount.google.com → Sécurité →
Applications tierces). Code : `booking/gmail.js`, tests `booking/test/gmail.test.mjs`.

Mise en service (une fois) :
1. Projet Google Cloud de l'atelier (celui du compte de service des agendas) : activer **Gmail API** ;
   écran de consentement OAuth « Externe », **publié en production** (en mode Test, Google coupe
   l'accès tous les 7 jours), accès `https://www.googleapis.com/auth/gmail.readonly` (et
   `business.manage` pour le robot de la fiche Google) ; identifiant **ID client OAuth**,
   « Application Web », URI de redirection `https://atelier.solarcar37.fr/atelier/gmail/retour` et
   `https://solarcar37-reservation.contact-solarcar37.workers.dev/fiche-google/retour`.
2. Cloudflare → Workers → `solarcar37-reservation` → Paramètres → Variables et secrets : secrets
   `GOOGLE_OAUTH_CLIENT_ID` et `GOOGLE_OAUTH_CLIENT_SECRET` (les mêmes servent au robot de la fiche).
3. Espace atelier → Devis → « Connecter Gmail » → compte contact.solarcar37@gmail.com → Google
   affiche « application non validée » → « Paramètres avancés » → « Accéder à… » → autoriser.

Supprimer une demande : dans la discussion, colonne de droite, « Supprimer cette demande » (case
de confirmation) ; la demande, ses messages et ses photos sont effacés, la fiche client reste.

## Le fichier clients

- Sa fiche liste ses demandes de devis (avec leur statut, un clic ouvre la discussion).
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
- **Noël 2026** (réglé le 17 novembre 2026) : code **NOEL**, **−15 % sur toutes les prestations**,
  utilisations illimitées, pour une réservation en ligne réglée ou une demande de devis envoyée **du
  1er décembre au 24 décembre à 23 h 59**, quelle que soit la date du rendez-vous (l'agenda en
  ligne va jusqu'à environ 6 mois). Vitres et feux teintés : code saisi au paiement ; autres
  prestations : code saisi dans la demande de devis, vérifié par le serveur le jour de la demande et
  noté en tête de la demande dans le fichier clients (et dans l'e-mail de la demande). Bandeau Noël du
  1er au 24 décembre. Tout se modifie dans l'espace.
- **Compte à rebours** (`src/js/countdown.js`) : le bandeau affiche « Jusqu'au 24 décembre à
  23 h 59 » et « Plus que 7 jours », puis le dernier jour « plus que 2 h 48 min 12 s » à la seconde
  (les dates du code du bandeau, sinon celles du bandeau) ; même chose sous le champ du code à la
  réservation et dans la demande de devis. À minuit, le bandeau s'en va et la remise disparaît de la
  page de réservation.
- **Changer une campagne déjà écrite dans la base** depuis `content/promos.js` : modifier la
  campagne et augmenter son `rev` ; au déploiement suivant, elle est réécrite une fois (une
  modification faite entre-temps dans l'espace est alors remplacée). NOEL est en `rev: 2` (passage
  du réglage « tout décembre, vitres et feux » au réglage ci-dessus).
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
