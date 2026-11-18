# Carte cadeau et SOLAR CAR Premium

Décidé avec l'atelier le 18 novembre 2026. Tous les chiffres sont dans **`content/offers.js`** :
le site, le serveur de réservation, les e-mails et l'espace atelier les lisent tous là. Un prix ou
un cadeau change à un seul endroit.

## La carte cadeau

- **Montants** : 50, 100, 150, 250 € ou un montant libre de 20 à 1 000 € (`giftCard.amounts`,
  `min`, `max`).
- **Finitions** : Or, Carbone, Noël (`giftCard.looks`). La face de chaque finition est une image
  (`public/img/cartes/cadeau-<finition>.jpg`, faite par `node scripts/cartes.mjs`) : la page 3D, les
  e-mails et la carte imprimée l'utilisent.
- **Valable 12 mois** à partir de l'achat, sur **toutes les prestations**, en **une ou plusieurs
  fois** (le solde reste sur la carte). Ni remboursable, ni échangeable contre de l'argent.
- **Envoi** : l'acheteur la reçoit tout de suite par e-mail (à imprimer ou à transférer), ou la
  fait envoyer au destinataire **le jour de son choix** (jusqu'à un an plus tard), vers 8 h. Il est
  prévenu quand elle est arrivée.
- **Code** : `CADEAU-XXXX-XXXX`. Chaque carte a aussi sa page (`/carte-cadeau/voir/?c=…&t=…`, la
  clé `t` est secrète) : carte en 3D, solde, impression, « Réserver avec cette carte ».

### Comment elle se dépense

- **En ligne** (vitres teintées, feux teintés) : champ « Carte cadeau » à l'étape du paiement. La
  carte paie d'abord ce qui est dû maintenant (l'acompte ou le total), puis le reste du total.
  - Si elle couvre l'acompte (ou le total choisi), **le RDV est confirmé tout de suite, sans page
    de paiement**.
  - Sinon le client paie la différence sur Stripe. Pendant ce temps, la part de la carte est
    **mise de côté** (personne ne peut la dépenser deux fois). Si le paiement échoue ou expire,
    elle revient sur la carte.
  - Elle se cumule avec un code promo, un parrainage ou la carte Premium : c'est un moyen de
    paiement, pas une remise.
- **À l'atelier** : page du RDV → « Régler avec une carte cadeau » (le reste à régler baisse), ou
  **Cartes & Premium → Débiter** pour une prestation sur devis.

## SOLAR CAR Premium

- **19,99 € pour 12 mois**, payés une fois. **Pas de renouvellement automatique** : un e-mail
  prévient 15 jours avant la fin (`premium.remindDays`). Renouveler avec la même adresse e-mail
  prolonge la même carte d'un an, et le niveau est gardé.
- **Nominative** : le membre seul, pour toutes ses voitures. Pas de « Premium+ » pour les proches
  (choix du 18 novembre 2026 : trop de remises sans nouveaux clients, impossible à contrôler au
  comptoir). Pour les proches : chaque membre a son **code de parrainage** (20 € offerts sur la
  première prestation), sur sa carte et dans son e-mail de bienvenue. Un nouveau code est créé dès
  que le précédent est utilisé.
- **−10 % sur toutes les prestations** (`premium.percent`). Non cumulable avec un autre code : un
  seul code par réservation.
  - En ligne : le numéro `PREMIUM-XXXX-XXXX` se tape dans le champ « Code », avec l'e-mail de la
    carte (sinon il est refusé).
  - À l'atelier (« Nouveau RDV ») : si l'e-mail du client est celui d'un membre, les −10 %
    s'appliquent tout seuls.
  - Sur devis : le badge Premium s'affiche, la remise s'applique au devis.
- **Un niveau par prestation** (`premium.tiers`) : Membre → Ignition (1re prestation) → Turbo (2e) →
  Nitro (3e) → Hyper (4e) → Légende (5e). Chaque RDV pris en tant que membre fait monter d'un niveau
  et débloque un cadeau, remis le jour de ce RDV. Le membre reçoit un e-mail « Niveau … débloqué »,
  l'atelier une notification « Cadeau Premium à remettre ». Les cadeaux proposés sont **à
  valider** :
  | Niveau | Cadeau proposé |
  |---|---|
  | Ignition (1re) | Microfibre premium et parfum d'habitacle SOLAR CAR |
  | Turbo (2e) | Kit d'entretien : nettoyant vitres teintées et microfibre vitres |
  | Nitro (3e) | Traitement déperlant du pare-brise, posé pendant le RDV |
  | Hyper (4e) | Rénovation de phares offerte (79 €) |
  | Légende (5e) | Une paire de feux teintés (120 €) et l'année Premium suivante offerte |
- **Offres réservées aux membres** : dans **Codes et promos**, cocher « Réservé aux membres SOLAR CAR
  Premium » (le code n'est accepté qu'avec l'e-mail d'un membre actif). Puis **Cartes & Premium →
  Écrire aux membres** : un e-mail à chaque membre qui accepte les offres (« Bonjour Prénom », le code
  en avant, le bouton « J'en profite »). « M'envoyer un aperçu » d'abord. Chaque e-mail a son lien
  « Ne plus recevoir les offres » (obligatoire), et la carte reste valable.
- **Mon espace Premium** (`/premium/carte/`) : une petite application web, à ajouter à l'écran
  d'accueil du téléphone. Dedans : la carte en 3D, tous les rendez-vous (à venir, passés, reste à
  régler), le niveau et le prochain cadeau, les offres membres du moment, le code de parrainage.
  Pas de mot de passe : le lien arrive par e-mail, et « Retrouver ma carte » le renvoie à l'adresse
  de la carte (une fois toutes les 10 minutes au plus).

## Dans l'espace atelier

- **Cartes & Premium** (nouvel onglet, « Plus » sur téléphone) :
  - les chiffres : membres actifs, adhésions encaissées, cartes vendues, reste à dépenser sur les
    cartes ;
  - **Cadeaux à remettre** (« Remis » les range) ;
  - la liste des membres (niveau, prestations, fin de carte, offres oui/non) et « Ajouter un membre
    (adhésion payée à l'atelier) » ;
  - « Écrire aux membres » ;
  - la liste des cartes cadeaux (solde, acheteur → destinataire, envoi, utilisations), avec
    « Débiter », « Renvoyer », et « Créer une carte » (vendue au comptoir ou offerte).
- **Badge Premium** et niveau : liste des clients, fiche client (avec « Passer Premium » ou
  « Renouveler »), liste et page des RDV.
- Le menu **+ Nouveau** propose aussi : carte cadeau, membre Premium, écrire aux membres.

## Technique

- Base de l'atelier (`booking/store.js`) : tables `gifts`, `gift_holds` (la part mise de côté
  pendant un paiement), `members`, `member_payments` ; colonnes `gift`, `gift_amount`, `member` des
  RDV ; `members` des codes promo.
- Serveur (`booking/worker.js`) :
  - `POST /api/cadeau/checkout` et `GET /api/cadeau` ;
  - `POST /api/premium/checkout`, `GET /api/premium`, `POST /api/premium/lien`,
    `GET|POST /api/premium/offres` ;
  - `GET /api/code` répond aussi `kind: 'cadeau'` (solde) et `kind: 'premium'` ;
  - `POST /api/checkout` accepte `gift`.
  - Les paiements passent par le **même webhook Stripe** (`checkout.session.completed` et
    `expired`) : rien à changer chez Stripe. Si le webhook arrive après le client, la page de
    remerciement crée la carte ou l'adhésion elle-même, une seule fois.
- Tâche du matin (`morningMails`, 7 h UTC tous les jours) : les cartes du jour vers leur
  destinataire, et les rappels Premium. Le 1er du mois, la même tâche envoie le bilan des
  statistiques (un seul déclencheur pour les deux : `crons` de `booking/wrangler.toml`).
- E-mails (`booking/mail.js`) : enveloppe sombre et dorée (`luxShell`). La carte y est dessinée en
  HTML sur sa face (`public/img/cartes/*.jpg`), donc lisible même sans les images.
- Tests : `booking/test/offers.test.mjs` (achat, envoi programmé, carte qui paie seule ou avec
  Stripe, mise de côté puis libération, Premium −10 % réservé au titulaire, niveaux, renouvellement,
  offres membres, désinscription, rappel, espace atelier).

## Mise en ligne (à faire par l'atelier, après validation)

1. Valider les cadeaux des niveaux, les textes et les prix (`content/offers.js`).
2. Comptabilité : une carte cadeau vendue est un encaissement à l'avance. Voir avec le comptable
   comment la déclarer (micro-entreprise : recette encaissée), et si la vente de produits (kits
   d'entretien) change quelque chose.
3. `cd booking && npx wrangler deploy` (nouvelles routes et déclencheur du matin).
4. Publier le site (pages `/carte-cadeau/` et `/premium/`, champ « Carte cadeau » de la réservation).
5. Faire un achat test en mode test Stripe (carte cadeau, puis Premium), puis une vraie carte à 20 €.
