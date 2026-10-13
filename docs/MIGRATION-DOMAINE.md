# Mise en production sur www.solarcar37.fr — plan préparé, rien n'est exécuté

Le domaine revient de local.fr en fin d'année. **Aucun DNS ni domaine n'a été modifié** : chaque étape
ci-dessous se fait sur décision de SOLAR CAR 37.

## 1. Avant la bascule

| Étape | Détail | Qui |
|---|---|---|
| Inventaire des anciennes URL | Exporter la liste des pages du site local.fr (plan du site, Search Console « Pages », ou un crawl). L'environnement de travail n'a pas pu y accéder | SOLAR CAR 37 |
| Correspondances | Remplir le tableau du §3 : chaque ancienne URL vers la nouvelle page la plus proche | à faire ensemble |
| Hébergeur | Choisir l'hébergement de production (GitHub Pages avec domaine personnalisé, Netlify, Cloudflare Pages, OVH…) : il conditionne les redirections et les en-têtes de sécurité | SOLAR CAR 37 |
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

| Ancienne URL (local.fr) | Nouvelle URL |
|---|---|
| … | `/` |
| … | `/vitres-teintees/` |
| … | `/contact/` |

Nouvelles URL indexables (sitemap) : `/`, `/vitres-teintees/`, `/feux-arriere-teintes/`,
`/detailing-carrosserie/`, `/ciel-etoile/`, `/renovation-phares/`, `/atelier-vouvray/`, `/contact/`,
`/guides/` et ses 8 guides, `/zones-intervention/` et ses 14 pages locales, `/mentions-legales/`
(et `/realisations/` dès la première réalisation).

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
- Fiche Google Business Profile : mettre à jour l'adresse du site.
- En-têtes de sécurité recommandés chez l'hébergeur : `Strict-Transport-Security`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` (caméra, micro, géolocalisation désactivés), et une
  `Content-Security-Policy` listant les seuls services utilisés (FormSubmit ; Google Maps et le flux
  Instagram s'ils sont activés).
- Mesures réelles : PageSpeed Insights et le rapport Core Web Vitals de la Search Console.
