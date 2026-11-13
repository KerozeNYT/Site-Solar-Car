# Sécurité du site et des comptes

## Ce que le site fait déjà (dans le code)

| Protection | Où | Effet |
|---|---|---|
| Content-Security-Policy dans chaque page | `scripts/security.mjs` (balise meta, ajoutée par `npm run build`) | Le navigateur refuse tout script, style, image ou connexion qui ne vient pas du site, de FormSubmit ou de Google (avis). Le seul script écrit dans les pages est autorisé par son empreinte. |
| En-têtes HTTP complets | `_headers` (Netlify, Cloudflare Pages) et `.htaccess` (Apache, OVH), écrits par le build de production | HTTPS imposé (HSTS), interdiction d'afficher le site dans un cadre (clickjacking), `nosniff`, `Referrer-Policy`, caméra / micro / géolocalisation désactivés, isolation de la fenêtre (COOP), CSP complète. |
| `/.well-known/security.txt` | build de production | Indique où signaler un problème de sécurité (RFC 9116), valable un an après chaque build. |
| Contenus externes échappés | `src/js/reviews.js`, `src/js/instagram.js` | Un avis ou une légende piégés ne peuvent pas injecter de code. |
| Formulaire | `src/templates/pages.js` | Champ piège anti-robots, aucune donnée stockée sur le site. |
| Photos sans métadonnées | `scripts/photos.mjs` | Ni position GPS ni appareil dans les images publiées ; plaques recouvertes. |
| Dépendances | `package.json` (`overrides`), Dependabot (`.github/dependabot.yml`) | 0 vulnérabilité connue (`npm audit`) ; mises à jour proposées chaque mois. |
| Workflow de publication | `.github/workflows/apercu-pages.yml` | Actions épinglées à un commit précis, identifiants non conservés après le checkout, audit npm à chaque publication. |

Sur l'aperçu GitHub Pages, seule la CSP en balise meta s'applique (GitHub Pages n'accepte pas
d'en-têtes personnalisés). Les autres en-têtes s'activeront sur l'hébergeur de production.

Si le site ajoute un service externe (réservation en ligne, flux Instagram…), le renseigner dans
`content/site.js` suffit : la politique l'autorise automatiquement au build suivant.

## À faire par l'atelier (hors code, par ordre d'importance)

1. **Double authentification (2FA)** sur : le compte GitHub, le compte Google (fiche Google et
   Google Cloud), le compte du registraire du nom de domaine, la boîte `contact@solarcar37.fr`.
   Pour un site statique, la prise de contrôle d'un de ces comptes est le vrai risque.
2. **Nom de domaine** : verrou de transfert activé chez le registraire, renouvellement
   automatique, DNSSEC s'il est proposé.
3. **E-mail du domaine** : enregistrements SPF, DKIM et DMARC (au moins `p=quarantine`) pour
   qu'on ne puisse pas envoyer de faux e-mails « de » `solarcar37.fr`. À vérifier lors de la
   bascule DNS (`docs/MIGRATION-DOMAINE.md`).
4. **Clé Google Maps** (avis en direct, `content/site.js`, `google.mapsApiKey`) : elle est
   publique par nature, mais doit rester limitée dans
   [Google Cloud → Identifiants](https://console.cloud.google.com/apis/credentials) :
   - restriction « Sites web » : `https://www.solarcar37.fr/*`, `https://solarcar37.fr/*` et,
     tant que l'aperçu sert, `https://kerozenyt.github.io/Site-Solar-Car/*` ;
   - restriction d'API : Maps JavaScript API et Places API (New) uniquement ;
   - quota journalier plafonné et alerte de budget (Facturation → Budgets et alertes).
   Vérifié le 13 novembre 2026 : depuis l'adresse de l'aperçu, les avis se chargent bien
   (note 5,0, 302 avis).
5. **FormSubmit** : après activation, FormSubmit envoie un alias aléatoire (une suite de
   caractères à la place de l'adresse). Le mettre dans `formEndpoint` (`content/site.js`) :
   l'adresse e-mail n'apparaît plus dans le formulaire et ne peut plus être réutilisée par des
   robots via FormSubmit.
6. **Après la mise en ligne** : tester `https://www.solarcar37.fr` sur
   [securityheaders.com](https://securityheaders.com) et
   [MDN HTTP Observatory](https://developer.mozilla.org/fr/observatory). Une fois sûr que tous
   les sous-domaines de `solarcar37.fr` sont en HTTPS, on pourra ajouter `includeSubDomains`
   (et éventuellement `preload`) à HSTS dans `scripts/security.mjs`.
