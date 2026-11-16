# Statistiques de visite

Le site compte lui-même ses visites et les actions des visiteurs, **sans cookie**, les affiche
sur une page réservée à l'atelier et envoie un bilan par e-mail le 1er de chaque mois. En service
depuis le 14 novembre 2026.

## Lire les statistiques

- Adresse : `https://solarcar37-reservation.contact-solarcar37.workers.dev/stats?cle=<clé>`.
  La clé est le secret `STATS_KEY` du serveur de réservation : elle n'est pas dans le dépôt.
  Garder le lien complet en favori (ou sur l'écran d'accueil du téléphone).
- Changer la clé (l'ancien lien cesse aussitôt de marcher) : `cd booking && npx wrangler secret put STATS_KEY`.
- Périodes : 7 jours, 30 jours, 3 mois (13 semaines), 12 mois. Chaque chiffre est comparé à la
  période précédente de même durée, dès qu'elle est entièrement comptée.
- **Site public** : les visiteurs de www.solarcar37.fr. **Aperçu** : l'adresse d'essai GitHub
  Pages, et les RDV payés en mode test Stripe. Les deux ne se mélangent jamais.
- En haut : une phrase de bilan (en hausse, en baisse ou stable, à ±5 % près) ; la courbe des
  visites avec la période précédente en gris (survol ou flèches du clavier pour lire chaque point) ;
  les chiffres clés avec leur petite tendance ; « Sur 100 visites » (simulateurs, clics vers un
  devis, contacts, demandes et RDV) ; les sources ; « Mois par mois » (12 derniers mois, évolution
  de chaque mois par rapport au précédent) ; appareils ; pages ; pages d'où partent les contacts.
- En bas de page : les moyennes par jour à côté de celles de l'ancien site local.fr
  (`content/stats.js`).
- Style « garage de nuit » du site (noir, or du blason, polices Geist et Instrument Serif servies
  par le serveur lui-même). Sans le petit script de la page, tous les chiffres restent lisibles ;
  chaque courbe a son tableau (« Voir les chiffres »).

## Bilan mensuel par e-mail

- Le 1er de chaque mois vers 8 h (heure de Paris), le serveur envoie à l'adresse `NOTIFY_TO`
  (contact.solarcar37@gmail.com) le bilan du mois écoulé : visites, pages vues, demandes, RDV et
  montant payé en ligne, appels, taux de contact, comparés au mois précédent et au même mois de
  l'année d'avant, avec les sources et les pages les plus vues, et un bouton vers le tableau de bord.
- Rien n'est envoyé tant que le site public n'a eu aucune visite (avant la mise en ligne sur
  solarcar37.fr) : le premier bilan arrive le 1er du mois qui suit la mise en ligne.
- Voir un bilan dans le navigateur : bouton « Bilan de … » du tableau de bord, ou
  `/stats/bilan?cle=…&mois=2026-11` (`&site=apercu` pour l'aperçu). Un `POST` sur la même adresse
  l'envoie tout de suite, marqué « [Essai] » (essai fait le 15 novembre 2026).
- Envoi par Resend, comme les e-mails de réservation (`booking/mail.js`). Tant que l'expéditeur
  est l'adresse d'essai de Resend, il ne peut écrire qu'à l'adresse du compte Resend.

## Ce qui est compté

| Chiffre | Ce qu'il mesure |
|---|---|
| Visites | Une page atteinte depuis l'extérieur : moteur de recherche, réseau social, autre site, application, adresse tapée. Un rechargement, une page suivante ou le retour depuis le paiement n'en sont pas. |
| Pages vues | Chaque page affichée. |
| Sources | **Moteurs de recherche** (Google, Bing, Qwant, DuckDuckGo, Ecosia…), **Publicité** (clic sur une annonce Google Ads, reconnu au `gclid` que Google ajoute à l'adresse, ou `utm_medium=cpc` ; affichée dès la première), **Fiche Google** (voir plus bas), **Accès direct** (aucune provenance connue : adresse tapée, favori, lien ouvert depuis une messagerie, QR code), **Réseaux sociaux**, **Autres sites** (leur nom est affiché). Seule la présence d'un identifiant de clic est transmise, jamais l'identifiant lui-même. |
| Demandes envoyées | Formulaire de contact envoyé avec succès (avec pièces jointes : au moment de l'envoi). |
| RDV réservés en ligne | Comptés par le serveur quand Stripe confirme le paiement, avec le montant payé. |
| Appels, e-mails | Clics sur le numéro de téléphone, sur l'adresse e-mail. |
| Clics « devis », devis depuis un simulateur, simulateurs 3D, itinéraires | Les autres gestes qui mènent à un contact. |
| Taux de contact | (demandes + RDV + appels + e-mails) pour 100 visites. |
| Appareils | Écran de 760 px de large ou moins = téléphone. |
| Comment ils vous ont connus | Les cases cochées dans « Comment nous avez-vous connus ? » (formulaire de devis envoyé, RDV payé en ligne) : Recherche Internet, Réseaux sociaux, Bouche-à-oreille, Déjà client, Autre (avec le texte saisi), ou « Sans réponse ». Plusieurs cases possibles ; triées de la plus fréquente à la moins fréquente, aussi dans le bilan mensuel. Comptées depuis le 16 novembre 2026. |

Ne sont pas comptés : les robots, les outils de test (Lighthouse, PageSpeed, navigateurs pilotés),
les appareils désactivés (`?stats=off`). Un bloqueur de publicité peut parfois arrêter l'envoi :
les chiffres sont un minimum.

## Ne pas compter ses propres visites

Ouvrir une fois `https://www.solarcar37.fr/?stats=off` sur chaque appareil et chaque navigateur
utilisé (avant la mise en ligne : `https://kerozenyt.github.io/Site-Solar-Car/?stats=off`).
`?stats=on` annule. Le même lien est proposé aux visiteurs dans les mentions légales.

## Visiteurs venus de la fiche Google

Dans la fiche Google Business Profile, mettre comme site web
`https://www.solarcar37.fr/?utm_source=fiche-google` : ces visiteurs apparaissent alors à part
(« Fiche Google ») au lieu d'être mêlés aux moteurs de recherche. L'adresse canonique des pages
reste sans ce paramètre : aucun effet sur le référencement.

## Vie privée

Pas de cookie, rien d'enregistré sur l'appareil du visiteur (sauf le choix `?stats=off`, fait par
la personne elle-même), ni adresse IP ni identifiant conservés, aucun suivi d'une personne de page
en page ; seulement des lignes « telle page, tel jour, venue de tel site, téléphone ou ordinateur ».
Effacement au bout de 25 mois. Les mentions légales (`/mentions-legales/#confidentialite`)
décrivent le comptage. C'est le cadre des mesures d'audience que la CNIL dispense de consentement ;
le faire relire en même temps que les autres mentions si besoin.

## Cloudflare Web Analytics (à faire à la mise en ligne)

En complément, pour la **vitesse réelle des pages** chez les visiteurs (Core Web Vitals), les pays
et les navigateurs. Gratuit, sans cookie. Le jeton Cloudflare utilisé ici ne permet pas de le
créer : à faire dans le tableau de bord du compte contact.solarcar37@gmail.com.

1. Cloudflare → Analytics & Logs → Web Analytics → Add a site → `www.solarcar37.fr`.
2. Choisir l'extrait JavaScript manuel ; copier le jeton (`"token": "…"` dans le code affiché).
3. Le coller dans `content/site.js` → `business.stats.cloudflareToken`, puis `npm run build`.
   Le script n'est ajouté qu'au build de production (jamais à l'aperçu) et la
   Content-Security-Policy l'autorise d'elle-même.
4. Ne pas activer l'installation automatique de Cloudflare Pages : la politique de sécurité la
   bloquerait, et les visites seraient comptées deux fois.

## Technique

| Fichier | Rôle |
|---|---|
| `src/js/main.js` | Envoi depuis chaque page (`navigator.sendBeacon`, texte simple, sans requête préalable) |
| `booking/stats.js` | Contrôle de ce qui arrive (`/api/stats`), base SQLite d'un Durable Object (`Stats`), requêtes de la page |
| `booking/stats-page.js` | La page `/stats` : un seul script (autorisé par un nonce), CSP stricte, jamais indexée ni mise en cache |
| `booking/stats-report.js` | Le bilan mensuel : chiffres du mois, e-mail, adresse `/stats/bilan` |
| `booking/stats-fonts.js` | Les polices du site servies à `/stats/f/…` (modules binaires, règle `[[rules]]` de `wrangler.toml`) |
| `booking/worker.js` | Adresses `/api/stats` et `/stats` ; comptage du RDV à la confirmation du paiement |
| `booking/wrangler.toml` | Liaison `STATS`, migration `v1` (Durable Object SQLite, offre gratuite), envoi mensuel (`[triggers] crons`), `STATS_PREVIEW_ORIGINS`, `STATS_PAGE` (lien de l'e-mail) |
| `content/site.js` | `business.stats` : adresse d'envoi, jeton Cloudflare Web Analytics |
| `content/stats.js` | Chiffres de l'ancien site (local.fr) pour la comparaison |

- Seules les origines de `ALLOWED_ORIGINS` sont comptées ; celles de `STATS_PREVIEW_ORIGINS` vont
  dans « Aperçu ». Toute autre réponse est un 204 silencieux.
- Tests : `npm run test:booking` (base SQLite en mémoire, `booking/test/fake-stats.mjs`).
- Essai local : `npm run booking:dev`, puis `BOOKING_API=http://localhost:8787 npm run build` ;
  la page est sur `http://localhost:8787/stats?cle=dev`.
- À la bascule sur le domaine : rien à changer pour le comptage (www.solarcar37.fr est déjà
  autorisé). `SITE_URL` dans `booking/wrangler.toml` (déjà à changer pour les e-mails) sert aussi
  au lien « ne pas compter mes visites » de la page.
