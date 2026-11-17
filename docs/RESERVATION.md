# Réservation en ligne — vitres teintées et feux teintés

Le client choisit sa prestation sur `/reservation/`, voit les créneaux réellement libres, paie un
acompte de 30 % ou la totalité, et le rendez-vous s'inscrit dans l'agenda **SOLAR CAR 37**.

## Ce qui est réglé (13 novembre 2026)

| Réglage | Valeur |
|---|---|
| Prestations | Vitres teintées : 3/4 arrière (2 h), complet (2 h 30), 2 vitres avant (45 min), 2 vitres avant + 2 custodes (1 h 15, 150 €), pare-brise en option (+1 h 30). Feux teintés vinyle : 120 € la paire, 1 h par paire. PPF et Tesla : sur devis |
| Prix | Ceux du site (`content/pricing.js`) ; le serveur recalcule tout, il ne croit jamais un montant envoyé par le navigateur |
| Créneaux | Lundi-vendredi, 8 h-12 h et 13 h-17 h, départs toutes les 15 min, une voiture à la fois, la pause de midi ne compte pas, fin le jour même ; jours fériés fermés |
| Délai | Au plus tôt 48 h à l'avance, au plus tard environ 6 mois (186 jours, `horizonDays` ; 2 mois jusqu'au 17 novembre 2026) |
| Agendas consultés | SOLAR CAR 37, SOLAR HOME 37 et PERSO : un créneau n'est proposé que s'il est libre dans les trois |
| Rendez-vous écrit dans | SOLAR CAR 37, couleur **Myrtille** (RDV client), avec le client, le véhicule, les prestations, le montant payé et le reste à régler |
| Paiement | Stripe Checkout (carte, Apple Pay, Google Pay) : acompte de 30 % ou totalité ; reçu envoyé par Stripe |
| Annulation | Remboursé si annulation au moins 72 h (3 jours) avant — 48 h jusqu'au 17 novembre 2026 ; acompte gardé en dessous ou si le client ne vient pas (`/conditions-reservation/`). Le droit de rétractation de 14 jours après la réservation reste prioritaire |
| Pendant le paiement | Le créneau est retenu 30 min (événement gris « ⏳ Paiement en cours » dans SOLAR CAR 37), libéré si le paiement n'aboutit pas |

Tout se règle dans `content/booking.js` (durées, horaires, délais, taux d'acompte) et
`content/pricing.js` (prix).

## Comment ça marche

```
navigateur ──► /reservation/ (site statique)
     │  créneaux, paiement
     ▼
serveur de réservation (Cloudflare Worker, dossier booking/)
     ├─► Google Agenda : disponibilités des 3 agendas, création du RDV (compte de service)
     └─► Stripe : page de paiement, puis notification signée « payé » ou « expiré »
```

- `booking/worker.js` : les 4 adresses (`/api/slots`, `/api/checkout`, `/api/stripe-webhook`,
  `/api/booking`).
- `booking/schedule.js` : créneaux libres (fuseau de Paris, changement d'heure, jours fériés).
- `booking/google.js`, `booking/stripe.js` : accès Google Agenda et Stripe, sans bibliothèque.
- `booking/stats.js`, `booking/stats-page.js` : statistiques de visite du site (`/api/stats`,
  page `/stats`), voir `docs/STATISTIQUES.md`.
- `src/js/booking.js` : les 4 étapes de la page, la page de confirmation (avec « Ajouter à mon agenda »).
- Tests : `npm run test:booking` (créneaux, prix, serveur complet avec un faux Google et un faux Stripe).
- Essai complet sans aucun compte : `npm run booking:dev` puis
  `BOOKING_API=http://localhost:8787 npm run build` et ouvrir `/reservation/` (paiement simulé).

## État (13 novembre 2026)

- Serveur en ligne : https://solarcar37-reservation.contact-solarcar37.workers.dev (compte
  Cloudflare de contact.solarcar37@gmail.com), secrets `CALENDARS_BUSY` et
  `GOOGLE_SERVICE_ACCOUNT` déposés ; il lit les trois agendas (vérifié).
- Compte de service Google : `reservation@solar-car-37-reservation.iam.gserviceaccount.com`,
  agendas partagés.
- Stripe branché en **mode test** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) : réservation
  d'essai réussie le 13 novembre 2026 (acompte payé, RDV confirmé en bleu dans SOLAR CAR 37 30 s
  après le paiement).
- Boutons « Prendre RDV » : accueil (haut de page, fin du film), Vitres teintées, Feux teintés,
  simulateurs, page Contact. La teinte n'est pas demandée : elle se choisit à l'atelier.
- Stripe en **mode réel** depuis le 14 novembre 2026 (paiement réel de 36 € réussi, remboursé).
- E-mails (`booking/mail.js`, Resend, compte contact.solarcar37@gmail.com, secret
  `RESEND_API_KEY`) : « Nouveau RDV » envoyé à contact.solarcar37@gmail.com à chaque réservation
  payée. La confirmation au client (`MAIL_CLIENTS = "1"`) attend la vérification du domaine
  solarcar37.fr dans Resend : le domaine est chez local.fr jusqu'à la fin du contrat (décembre
  2026) ; ensuite `MAIL_FROM = "SOLAR CAR 37 <reservation@solarcar37.fr>"` et redéployer.
- **Demandes de devis** (formulaire de la page Contact, depuis le 17 novembre 2026 ; avant :
  FormSubmit) : envoyées au serveur (`POST /api/demande`), traitées par la base de l'atelier
  (`booking/store.js`, `quote/submit` : un Durable Object, qui a le temps de calcul nécessaire aux
  photos). Deux e-mails (`sendQuoteMails` de `booking/mail.js`) :
  - à l'atelier (`NOTIFY_TO`), de « Prénom Nom via SOLAR CAR 37 », objet « Demande de devis —
    véhicule · prestation », les photos et PDF en pièces jointes. **Répondre** écrit au client
    (Reply-To), et la demande citée sous la réponse est en français, sans publicité ni mention
    interne : l'e-mail ne contient rien qui ne soit destiné au client ;
  - au client (`MAIL_CLIENTS = "1"`) : l'accusé de réception, avec le récapitulatif de sa demande,
    même objet. La réponse de l'atelier arrive chez le client en conversation séparée (« Re: » le
    même objet, sa demande citée dessous) : Resend remplace l'identifiant (`Message-ID`) de chaque
    e-mail, on ne peut donc pas la ranger sous l'accusé (vérifié le 17 novembre 2026).
  - Une seule fois : la même demande renvoyée dans les 30 minutes (double clic, réponse perdue) est
    répondue « reçue » sans nouvel e-mail ; le site bloque déjà un second envoi pendant 15 minutes.
    Si l'e-mail à l'atelier ne part pas, la demande n'est pas gardée et le visiteur peut la renvoyer.
  - Photos allégées par le navigateur avant l'envoi (2 000 px, JPEG ; position GPS retirée au
    passage) : une photo de téléphone de 9 Mo arrive à environ 1 Mo. 10 Mo maximum au total.
  - Sans JavaScript, le formulaire est envoyé tel quel au serveur, puis la page « Merci ».
  - Essai en local : `npm run booking:dev`, puis `BOOKING_API=http://localhost:8787 npm run build`
    et `npm run preview` ; les e-mails attrapés sont listés sur `http://localhost:8787/dev/mails`
    et chacun s'affiche sur `/dev/mail/<n>`.
- E-mails automatiques aux clients (`dailyMails` de `booking/worker.js`, tous les jours à 16 h UTC,
  soit 17 h l'hiver et 18 h l'été) : **la veille**, un rappel (heure, adresse, itinéraire, reste à
  régler) ; **une semaine après**, des nouvelles : « un souci ? répondez à cet e-mail », puis le
  lien d'avis Google, donné à tous les clients (Google interdit de ne le demander qu'aux clients
  satisfaits). Seulement pour les RDV réservés en ligne et encore dans l'agenda, à l'heure où ils y
  sont (un RDV déplacé garde le bon horaire, un RDV supprimé ne reçoit rien), une seule fois
  chacun. Ils partent avec la confirmation, quand `MAIL_CLIENTS` passe à `"1"`.
- Reste (ancien point, fait pour Stripe) : passer Stripe en réel (clé et webhook du mode réel dans Cloudflare), régénérer le jeton
  Cloudflare et la clé Google (passés dans une conversation), faire relire les conditions.

## Mise en service (à faire une fois)

Tant que `bookingRules.api` est vide dans `content/booking.js`, la page `/reservation/` affiche
« La réservation en ligne ouvre très bientôt » et renvoie vers le formulaire de contact ; elle
n'est ni référencée ni annoncée sur les pages des prestations.

### 1. Stripe (paiement)

1. Créer le compte sur stripe.com au nom de l'entreprise (SIRET, IBAN, pièce d'identité du
   dirigeant). Frais : environ 1,5 % + 0,25 € par paiement par carte européenne, sans abonnement.
2. Paramètres → E-mails clients : activer « Paiements réussis » (le client reçoit son reçu).
3. Développeurs → Clés API : garder la clé secrète (`sk_test_…` pour les essais, puis `sk_live_…`).
4. Développeurs → Webhooks → Ajouter un point de terminaison :
   `https://<adresse du serveur>/api/stripe-webhook`, événements `checkout.session.completed`,
   `checkout.session.expired`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`. Garder le secret de signature (`whsec_…`).

### 2. Google (lecture des agendas, écriture du RDV)

1. console.cloud.google.com → créer un projet « SOLAR CAR 37 Réservation » → activer
   **Google Calendar API**.
2. IAM → Comptes de service → créer « reservation » → Clés → Ajouter une clé → JSON (fichier à
   garder secret).
3. Dans Google Agenda, partager chaque agenda avec l'adresse du compte de service
   (`reservation@….iam.gserviceaccount.com`) :
   - **SOLAR CAR 37** : « Apporter des modifications aux événements » ;
   - **SOLAR HOME 37** et **PERSO** : « Voir uniquement les disponibilités (masquer les détails) ».
4. Pour être prévenu de chaque réservation : Google Agenda → paramètres de SOLAR CAR 37 →
   Autres notifications → « Nouveaux événements » : par e-mail.

### 3. Cloudflare (le serveur)

1. Créer un compte gratuit sur cloudflare.com (le plan gratuit suffit largement : 100 000
   demandes par jour).
2. Depuis le dossier `booking/` :

   ```bash
   npx wrangler login
   npx wrangler deploy
   npx wrangler secret put CALENDARS_BUSY        # contact.solarcar37@gmail.com,contact.solarhome37@gmail.com,<id de PERSO>
   npx wrangler secret put GOOGLE_SERVICE_ACCOUNT  # coller tout le contenu du fichier JSON
   npx wrangler secret put STRIPE_SECRET_KEY
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   ```

   L'identifiant de l'agenda PERSO se trouve dans Google Agenda → paramètres de PERSO →
   « Intégrer l'agenda » → ID de l'agenda.
3. Option : une adresse à soi, `reservation.solarcar37.fr`, dans Workers → Domaines.

### 4. Ouvrir la réservation sur le site

Mettre l'adresse du serveur dans `content/booking.js` (`api: 'https://…'`), reconstruire et
publier. La page est alors référencée, les pages Vitres teintées et Feux teintés affichent
« Réserver en ligne », le simulateur propose « Réserver en ligne » pour la configuration choisie
et la page Contact annonce la réservation.

Faire d'abord une réservation complète avec les clés de test Stripe (carte `4242 4242 4242 4242`),
vérifier le RDV dans SOLAR CAR 37, puis passer aux clés réelles (`sk_live_…` et le secret du
webhook en mode réel).

## Parrainage (16 novembre 2026)

- Chaque client reçoit **son code personnel** (ex. `JEAN-7K2QX`) : **20 € de remise**, à offrir à
  un proche ou à garder pour une autre voiture, **une seule fois**, pendant **6 mois**
  (`bookingRules.referral` dans `content/booking.js`).
- **Comment il le reçoit** : dans l'e-mail envoyé une semaine après son RDV en ligne, sous forme
  de carte cadeau avec un bouton « Réserver avec ce code » (le lien remplit le code tout seul) ;
  ou de la main de l'atelier, pour n'importe quel client, depuis la page Parrainage.
- **Comment il sert** : sur la page de réservation (étape 4 « Paiement », champ « Code de
  parrainage ») : le total baisse de 20 €, l'acompte de 30 % porte sur le reste ; le code est
  consommé quand le paiement est confirmé. Pour une prestation réservée par téléphone ou sur devis,
  l'atelier le marque « utilisé » sur la page Parrainage.
- **Dans l'espace atelier** (docs/ATELIER.md), onglet « Codes et promos » : chiffres, créer un
  code, vérifier ou utiliser un code, liste de tous les codes ; et depuis la fiche d'un client.
- Technique : `booking/store.js` (base de l'atelier : un code ne peut pas servir deux fois),
  `GET /api/code?code=…`, tests `booking/test/referral.test.mjs`.
- Codes promo (NOEL…) : même champ à la réservation, voir docs/ATELIER.md. Conditions : page « Conditions de réservation », section
  Parrainage.

## Au quotidien

- **Annulation ≥ 72 h** : rembourser depuis le tableau de bord Stripe (Paiements → le paiement →
  Rembourser) et supprimer l'événement dans SOLAR CAR 37.
- **Report** : déplacer l'événement dans l'agenda ; l'acompte reste valable.
- **Bloquer une journée** (congés, salon) : un événement « occupé » dans SOLAR CAR 37, SOLAR
  HOME 37 ou PERSO suffit, le site ne propose plus ces heures.

## À valider

- Le texte de `/conditions-reservation/` (acompte, annulation, rétractation de 14 jours avec
  demande d'exécution anticipée) : à faire relire par votre expert-comptable ou un juriste.
- Le médiateur de la consommation (obligatoire pour vendre à des particuliers), à indiquer dans
  les mentions légales.
- La notice de confidentialité (mentions légales) : ajouter les données de réservation (nom,
  contact, véhicule, rendez-vous) et leurs sous-traitants, Stripe (paiement), Google (agenda) et
  Cloudflare (serveur de réservation), comme pour le formulaire de devis.
