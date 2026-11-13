# Réservation en ligne — vitres teintées et feux teintés

Le client choisit sa prestation sur `/reservation/`, voit les créneaux réellement libres, paie un
acompte de 30 % ou la totalité, et le rendez-vous s'inscrit dans l'agenda **SOLAR CAR 37**.

## Ce qui est réglé (13 novembre 2026)

| Réglage | Valeur |
|---|---|
| Prestations | Vitres teintées : 3/4 arrière (2 h), complet (2 h 30), 2 vitres avant (45 min), 2 vitres avant + 2 custodes (1 h 15, 150 €), pare-brise en option (+1 h 30). Feux teintés vinyle : 120 € la paire, 1 h par paire. PPF et Tesla : sur devis |
| Prix | Ceux du site (`content/pricing.js`) ; le serveur recalcule tout, il ne croit jamais un montant envoyé par le navigateur |
| Créneaux | Lundi-vendredi, 8 h-12 h et 13 h-17 h, départs toutes les 15 min, une voiture à la fois, la pause de midi ne compte pas, fin le jour même ; jours fériés fermés |
| Délai | Au plus tôt 48 h à l'avance, au plus tard environ 2 mois |
| Agendas consultés | SOLAR CAR 37, SOLAR HOME 37 et PERSO : un créneau n'est proposé que s'il est libre dans les trois |
| Rendez-vous écrit dans | SOLAR CAR 37, couleur **Myrtille** (RDV client), avec le client, le véhicule, les prestations, le montant payé et le reste à régler |
| Paiement | Stripe Checkout (carte, Apple Pay, Google Pay) : acompte de 30 % ou totalité ; reçu envoyé par Stripe |
| Annulation | Remboursé si annulation au moins 48 h avant ; acompte gardé en dessous ou si le client ne vient pas (`/conditions-reservation/`) |
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
- Reste : passer Stripe en réel (clé et webhook du mode réel dans Cloudflare), régénérer le jeton
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

## Au quotidien

- **Annulation ≥ 48 h** : rembourser depuis le tableau de bord Stripe (Paiements → le paiement →
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
