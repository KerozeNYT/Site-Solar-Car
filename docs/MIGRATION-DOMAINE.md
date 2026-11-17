# Mise en production sur www.solarcar37.fr — plan préparé, rien n'est exécuté

Le domaine revient de local.fr en fin d'année. **Aucun DNS ni domaine n'a été modifié** : chaque étape
ci-dessous se fait sur décision de SOLAR CAR 37.

## 0. Méthode retenue (17 novembre 2026) : les serveurs DNS chez Cloudflare

Constat : www.solarcar37.fr et solarcar37.fr pointent aujourd'hui vers un serveur de local.fr
(213.32.5.6, serveur Apache hébergé chez OVH). Le domaine reste enregistré chez local.fr jusqu'à son
transfert ; on peut pourtant mettre le site en ligne **avant**, en faisant pointer le domaine vers
Cloudflare (même compte que le serveur de réservation).

1. **Message à local.fr** (SOLAR CAR 37) : titulaire du domaine (doit être Nicolas MALAGA / SOLAR CAR
   37, pas local.fr), bureau d'enregistrement, **liste complète de la zone DNS** (surtout la
   messagerie : MX, SPF, DKIM), **boîte contact@solarcar37.fr** (hébergée chez eux ? jusqu'à quand ?
   comment récupérer les e-mails ?), possibilité de **remplacer les serveurs DNS**, **code de
   transfert** (AUTH-INFO) et déverrouillage.
2. **Cloudflare** (Claude) : ajouter le domaine (offre gratuite) → Cloudflare donne **deux serveurs
   DNS** (`xxx.ns.cloudflare.com`, `yyy.ns.cloudflare.com`) ; recopier les enregistrements de la
   messagerie à l'identique ; publier le site de production sur **Cloudflare Pages** et le tester sur
   son adresse technique (`….pages.dev`), avec `www` et le domaine nu (redirigé vers `www`), HTTPS.
3. **local.fr** remplace les serveurs DNS du domaine par les deux de Cloudflare → le nouveau site
   répond sur www.solarcar37.fr en quelques heures (jusqu'à 24-48 h pour tout le monde), l'ancien
   s'arrête, les anciennes adresses sont redirigées (§3), l'e-mail continue de marcher.
4. **Après** (Claude) : vérifications (pages, redirections, HTTPS, formulaire, réservation, e-mail),
   `SITE_URL` du serveur de réservation sur le domaine, domaine vérifié dans Resend puis
   `MAIL_CLIENTS = "1"` (confirmations, rappels, nouvelles et parrainage aux clients), Search Console,
   lien de la fiche Google, statistiques (§5).
5. **Avant le 27 décembre** : transfert du domaine (code AUTH-INFO) vers un bureau
   d'enregistrement choisi par SOLAR CAR 37 (ex. OVHcloud, Gandi) ; les serveurs DNS restent ceux de
   Cloudflare, rien ne s'interrompt. Si la boîte contact@ était chez local.fr : la remplacer avant
   (renvoi gratuit vers Gmail par Cloudflare Email Routing, ou vraie boîte).

**En ligne le 17 novembre 2026** (zone Cloudflare active à 10 h 08 UTC) : www.solarcar37.fr sert
le site définitif ; solarcar37.fr et http:// redirigés en 301 vers https://www.solarcar37.fr ; les
anciennes adresses de local.fr redirigées ; messagerie OVH inchangée (MX, SPF, DMARC, SRV) ;
serveur de réservation : `SITE_URL` sur https://www.solarcar37.fr. Le même jour : domaine vérifié
dans Resend, e-mails envoyés par reservation@solarcar37.fr et e-mails aux clients activés
(`MAIL_CLIENTS = "1"` : confirmation, rappel de la veille, nouvelles à une semaine avec la carte de
parrainage), essai reçu dans la boîte de réception Gmail ; Search Console vérifiée (TXT
google-site-verification). Reste : transfert du domaine avant le 27 décembre, boîte OVH.

État au 17 novembre 2026 :
- **Site définitif publié sur Cloudflare Pages** (projet `solarcar37`, adresse technique
  https://solarcar37.pages.dev, non indexée) : construit par Cloudflare depuis GitHub (branche
  `claude/solar-car-37-website-ib2326`, `npm run build`, Node 22 ; chaque envoi sur cette branche
  republie le site, l'application GitHub de Cloudflare ayant accès au dépôt), 9 redirections et en-têtes de
  sécurité acceptés. Les versions 1440p et 4K du film sont découpées en morceaux (limite de 25 Mo
  par fichier de Cloudflare Pages, `scripts/media-parts.mjs`).
- **Domaine ajouté à Cloudflare** (offre Free, zone `solarcar37.fr`, en attente) : serveurs de noms
  **lilith.ns.cloudflare.com** et **woz.ns.cloudflare.com**. Aujourd'hui : enregistré chez **OVH**
  (bureau d'enregistrement), DNS chez OVH (`dns17.ovh.net`, `ns17.ovh.net`), messagerie OVH
  (`mx1/mx2/mx3.mail.ovh.net`), envois Brevo (DKIM `brevo1/brevo2._domainkey`).
- Enregistrements recopiés et réglés : messagerie (MX, SPF, DMARC, SRV, autoconfig, autodiscover),
  Brevo (DKIM, code de vérification) et `crm` en « DNS uniquement » comme chez OVH ; `ftp` vers
  l'ancien serveur ; `www` et le domaine nu vers Cloudflare Pages (domaines personnalisés du projet
  `solarcar37`), `solarcar37.fr` et `m.solarcar37.fr` redirigés en 301 vers `https://www.solarcar37.fr`
  (même page), HTTPS forcé, TLS 1.2 minimum.
- Reste : local.fr (ou le titulaire du compte OVH) remplace les serveurs DNS ; vérifier s'il existe
  un DKIM OVH non détecté ; après la bascule, `SITE_URL`, Resend, Search Console (§5).

Avant la bascule : le **médiateur de la consommation** doit être renseigné (sinon « à compléter »
apparaît dans les mentions légales).

## 1. Avant la bascule

| Étape | Détail | Qui |
|---|---|---|
| Inventaire des anciennes URL | Fait le 12 novembre 2026 (plan du site : 10 pages), complété le 16 novembre par l'exploration de tous les liens du site : 3 adresses de plus (politique de confidentialité, ancienne adresse du nettoyage, lien cassé de la page feux) | fait |
| Correspondances | Tableau du §3, dans `content/redirects.js` | fait, à valider |
| Hébergeur | Choisir l'hébergement de production. **Conseillé : Cloudflare Pages ou Netlify** (gratuits ici) : ils appliquent `_headers` (en-têtes de sécurité, cache) et `_redirects` (vraies 301). OVH / Apache : `.htaccess` fait de même. GitHub Pages avec domaine personnalisé : ni en-têtes ni 301 (seule la CSP en balise meta s'applique) | SOLAR CAR 37 |
| E-mail | **Ne pas casser contact@solarcar37.fr** : relever les enregistrements MX, SPF, DKIM, DMARC actuels avant tout changement de DNS et les recopier à l'identique | SOLAR CAR 37 |
| Informations légales | Hébergeur réel, médiateur de la consommation, mention TVA, crédits des modèles 3D (voir `docs/V2-ROADMAP.md`) | SOLAR CAR 37 |

## 2. Build de production

```bash
npm ci
npm run build          # sans SITE_BASE ni PREVIEW : pages indexables, robots.txt ouvert
```

- `content/site.js` : `siteUrl: 'https://www.solarcar37.fr'` (déjà renseigné) ; canonicals, sitemap
  et données structurées l'utilisent déjà.
- L'aperçu GitHub Pages (`/Site-Solar-Car/`, `noindex`) reste séparé et non indexé.

## 3. Redirections 301 (à compléter)

Liste unique : `content/redirects.js`. Le build de production (`npm run build`, sans `PREVIEW`)
écrit `_redirects` (Netlify, Cloudflare Pages), `.htaccess` (Apache, OVH : HTTPS, `www`, puis ces
pages, puis en-têtes de sécurité, cache et compression) et, pour un hébergeur sans règles (GitHub
Pages), une page relais à chaque ancienne adresse (redirection immédiate + canonical). Il écrit
aussi `_headers` (en-têtes de sécurité et cache pour Netlify / Cloudflare Pages) et
`/.well-known/security.txt` (`scripts/security.mjs`, voir `docs/SECURITE.md`).

| Ancienne URL (local.fr) | Nouvelle URL |
|---|---|
| `/` | `/` |
| `/renovation-des-optiques-de-phares` | `/renovation-phares/` |
| `/feux-teintes` | `/feux-arriere-teintes/` |
| `/detailing` | `/detailing-carrosserie/` |
| `/nettoyage-automobile-` | `/detailing-carrosserie/` (le forfait Essentiel) |
| `/covering-stickage-publicitaire-et-dechromage` | `/covering-dechromage/` |
| `/eclairage-d-ambiance-interieur-` | `/ciel-etoile/` (prestation la plus proche) |
| `/politique-de-confidentialite` | `/mentions-legales/` (section « Données personnelles ») |
| `/nettoyage-automobile` | `/detailing-carrosserie/` (renvoyait déjà vers l'accueil) |
| `/covering-et-dechromage` | `/covering-dechromage/` (lien cassé de l'ancienne page feux) |
| `/vitres-teintees`, `/contact`, `/mentions-legales` | les mêmes pages, avec la barre finale |

Le nettoyage automobile, le stickage publicitaire et l'éclairage d'ambiance intérieur ne sont plus
proposés (confirmé par SOLAR CAR 37) : leurs anciennes adresses renvoient vers la page voisine.

Nouvelles URL indexables (sitemap) : `/`, `/vitres-teintees/`, `/feux-arriere-teintes/`,
`/detailing-carrosserie/`, `/covering-dechromage/`, `/ciel-etoile/`, `/renovation-phares/`, `/atelier-vouvray/`, `/contact/`,
`/guides/` et ses 8 guides, `/zones-intervention/` et ses 8 pages locales (Tours, Joué-lès-Tours,
Saint-Cyr-sur-Loire, Saint-Pierre-des-Corps, Saint-Avertin, Chambray-lès-Tours, Montlouis-sur-Loire,
Amboise), `/mentions-legales/`, `/realisations/` : 30 adresses.

Mise en œuvre selon l'hébergeur : fichier `_redirects` (Netlify, Cloudflare Pages), `.htaccess`
(Apache/OVH) ou règles de l'hébergeur. GitHub Pages ne sait pas faire de vraies 301 : à éviter s'il
y a beaucoup d'anciennes URL à rediriger.

Prévoir aussi : `solarcar37.fr` → `https://www.solarcar37.fr` et `http://` → `https://` (301).

## 4. Bascule

1. Déployer le build de production chez l'hébergeur et le tester sur son adresse technique.
2. Modifier les DNS (enregistrements `A`/`AAAA` ou `CNAME` de `www` et de la racine) **sans toucher
   aux enregistrements e-mail**.
3. Activer le certificat HTTPS de l'hébergeur et forcer HTTPS.
4. Vérifier : pages principales, redirections, formulaire (FormSubmit activé sur
   contact@solarcar37.fr), pièces jointes, téléphone, itinéraire.

## 5. Après la bascule

- Google Search Console : valider la propriété `https://www.solarcar37.fr`, envoyer `/sitemap.xml`,
  suivre l'indexation et les erreurs pendant plusieurs semaines.
- Fiche Google Business Profile : mettre à jour l'adresse du site, avec
  `https://www.solarcar37.fr/?utm_source=fiche-google` pour la reconnaître dans les statistiques.
- Statistiques (`docs/STATISTIQUES.md`) : ouvrir `https://www.solarcar37.fr/?stats=off` sur ses
  propres appareils ; Cloudflare Web Analytics : jeton dans `content/site.js` (fait le
  17 novembre), installation automatique coupée ; passer `SITE_URL` de `booking/wrangler.toml` sur le domaine.
- En-têtes de sécurité : déjà prêts (`_headers`, `.htaccess`, `scripts/security.mjs`). Vérifier
  qu'ils arrivent bien sur [securityheaders.com](https://securityheaders.com) et
  [MDN HTTP Observatory](https://developer.mozilla.org/fr/observatory).
- Mesures réelles : PageSpeed Insights et le rapport Core Web Vitals de la Search Console.
- Référencement local hors du site (fiche Google, avis, annuaires, marques partenaires) :
  `docs/SEO-LOCAL.md`.
