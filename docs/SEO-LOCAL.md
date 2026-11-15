# Référencement local : ce qui se joue hors du site

Le site est prêt techniquement : 30 pages indexables (titres, descriptions et H1 uniques, données
structurées, plan du site avec 131 photos réelles), Lighthouse mobile à 100 en accessibilité,
bonnes pratiques et SEO sur chaque page.
Pour « vitres teintées Tours » et la carte Google, la suite se gagne surtout **hors du code** :
la fiche Google, les avis, les sites qui citent l'atelier. Cette liste est à suivre dans l'ordre.

## 1. Mise en ligne (bloquant : rien n'est indexé tant que ce n'est pas fait)

1. Suivre `docs/MIGRATION-DOMAINE.md` (redirections, DNS en préservant l'e-mail, HTTPS).
2. Hébergeur conseillé : **Cloudflare Pages** ou **Netlify** (gratuits pour ce site). Ils lisent
   les fichiers `_headers` et `_redirects` produits par `npm run build` : en-têtes de sécurité,
   cache long et vraies redirections 301. GitHub Pages ne sait faire ni l'un ni l'autre.
3. Dès la bascule :
   - [Google Search Console](https://search.google.com/search-console) : propriété « Domaine »
     `solarcar37.fr` (validation par un enregistrement DNS TXT), envoyer `/sitemap.xml`,
     puis « Inspection de l'URL » → « Demander une indexation » pour l'accueil et les 7 pages
     de prestations.
   - [Bing Webmaster Tools](https://www.bing.com/webmasters) : « Importer depuis Google Search
     Console » (l'index de Bing sert aussi à Copilot et à d'autres moteurs de réponse).
   - Fiche Google : remplacer le lien du site par
     `https://www.solarcar37.fr/?utm_source=fiche-google` (les visiteurs venus de la fiche sont
     alors comptés à part dans les statistiques, `docs/STATISTIQUES.md`).

## 2. Fiche Google (le premier levier de la carte Google)

- **Catégorie principale** : la teinte de vitres automobiles (« Window tinting service » dans
  la liste anglaise). **Catégories secondaires** : detailing automobile, covering (vehicle
  wrapping), rénovation / accessoires automobiles selon ce que propose la liste.
- **Services** : les 7 prestations du site, avec les prix affichés sur le site (mêmes chiffres :
  vitres teintées dès 210 € TTC, feux 100 à 120 € la paire, phares 79 €).
- **Nom, adresse, téléphone identiques partout** (fiche, site, annuaires, réseaux) :
  `SOLAR CAR 37 — 395 rue des Entrepreneurs, 37210 Vouvray — 06 12 04 57 00`.
- **Photos** : une ou deux par semaine, de vrais chantiers (les mêmes que la galerie du site
  conviennent), plus l'atelier, la façade et l'enseigne.
- **Avis** : en demander un à **chaque** client, le jour de la restitution (le lien direct est
  sur le site : `https://g.page/r/CV6TtSL2JvXAEAE/review` ; un QR code imprimé au comptoir
  aide beaucoup). Répondre à chaque avis, en citant naturellement la prestation et la
  voiture. Ne jamais acheter ni échanger d'avis (sanctions de Google et de la DGCCRF).
- **Publications** : une par semaine ou deux (réalisation, offre, conseil), avec un lien vers
  la page de la prestation sur le site.
- Horaires à jour (jours fériés, congés) : la fiche et le site doivent dire la même chose.

## 3. Annuaires et citations (à faire une fois, avec exactement le même nom/adresse/téléphone)

- [Apple Business Connect](https://businessconnect.apple.com) (Plans d'Apple, Siri)
- [Bing Places](https://www.bingplaces.com) (import possible depuis la fiche Google)
- PagesJaunes (fiche gratuite)
- Annuaire des entreprises de la commune de Vouvray / de Touraine-Est Vallées, si la
  commune en tient un
- Chambre de Métiers et de l'Artisanat d'Indre-et-Loire, CCI Touraine (annuaires des membres)
- Page Facebook (si elle est créée : la renseigner dans `content/site.js`, `social.facebook`)

## 4. Liens depuis les marques partenaires (les liens les plus utiles)

Plusieurs fabricants publient une carte de leurs **installateurs agréés** : un lien depuis
leur site vers `www.solarcar37.fr` pèse lourd. Demander l'inscription **seulement là où
l'atelier est réellement installateur référencé, certifié ou client** :

- STEK, 3M (films vitrage et covering), Solar Screen, Avery Dennison, TeckWrap, Oracal
- Koch-Chemie, RUPES (pages « où nous trouver », revendeurs, ateliers partenaires)

Autres liens locaux naturels : clubs et rassemblements automobiles de Touraine, concessions,
carrossiers et garages partenaires, presse locale (une réalisation marquante — McLaren,
Porsche — est un bon sujet).

## 5. Contenu à faire vivre

- **Une réalisation par semaine** dans `content/realisations.js` (voiture, prestation, une
  phrase ; voir le README) : c'est le contenu qui se référence le mieux, et il alimente
  l'accueil, la page de la prestation et les pages locales.
- Un guide par saison sur une vraie question de client (ex. « film solaire et chaleur en été »,
  « préparer sa voiture pour l'hiver »), toujours relié à sa prestation.
- Instagram et TikTok : lien vers le site dans la bio, et vers la page de la prestation dans
  les publications quand c'est possible.

## 6. Suivi (une fois par mois)

- Search Console : requêtes et pages qui montent, erreurs d'indexation, rapport « Signaux Web
  essentiels » (vrais visiteurs).
- Fiche Google : appels, itinéraires, clics vers le site.
- [PageSpeed Insights](https://pagespeed.web.dev) sur l'accueil et une page de prestation.
- En-têtes de sécurité : [securityheaders.com](https://securityheaders.com) et
  [MDN HTTP Observatory](https://developer.mozilla.org/fr/observatory) sur
  `https://www.solarcar37.fr` (objectif A+ / A une fois sur Cloudflare Pages ou Netlify).
