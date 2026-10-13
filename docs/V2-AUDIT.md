# SOLAR CAR 37 — Audit initial V2 (phase 1)

Audit réalisé le 13 octobre 2026 sur la branche `claude/solar-car-37-website-ib2326`, commit de référence
**`96a3590`** (état stable avant V2 : c'est le point de retour arrière).

## Méthode et limites

| Contrôle | Outil | Résultat |
|---|---|---|
| Build de référence | `npm run build` (Node 22) | OK, 2 s, 32 pages, `dist/` = 22 Mo (dont 15 Mo de modèles 3D) |
| Build d'aperçu | `SITE_BASE=/Site-Solar-Car/ PREVIEW=1` (workflow `apercu-pages.yml`) | OK : pages en `noindex, nofollow`, canonicals sur `www.solarcar37.fr` |
| Les 32 pages | Script Playwright (Chromium, sans WebGL) : erreurs console, requêtes en échec, titres, descriptions, H1, hiérarchie des titres, `alt`, liens internes, JSON-LD, débordement à 360 px | 0 erreur JS, 0 lien interne cassé, 0 image sans `alt`, 1 H1 par page, aucun saut de niveau de titre, aucun débordement horizontal mobile |
| Accessibilité | axe-core 4.10 (WCAG 2.0/2.1/2.2 A-AA + bonnes pratiques) | 2 règles en échec (voir P2/P3) |
| Performance | Lighthouse 12.6 (mobile et ordinateur, throttling simulé) | voir tableau ci-dessous |
| 3D | Chromium + SwiftShader (rendu **logiciel**, sans carte graphique) | fonctionne ; les temps d'image ne sont **pas** représentatifs d'un vrai téléphone |

**Limites** : pas de vrai téléphone ni de GPU dans l'environnement ; FormSubmit, Google et Instagram sont
inaccessibles depuis le conteneur (formulaire non testé de bout en bout) ; aucun accès à l'ancien site
(local.fr) pour inventorier ses URL.

### Mesures Lighthouse initiales (labo, conteneur sans GPU)

| Page | Forme | Perf. | Access. | SEO | LCP | TBT | Poids |
|---|---|---|---|---|---|---|---|
| `/` | mobile | 28 | 100 | 100 | 38,4 s | 16 640 ms | 6 770 Kio |
| `/vitres-teintees/` | mobile | 67 | 96 | 100 | 2,4 s | 4 490 ms | 6 856 Kio |
| `/contact/` | mobile | 99 | 100 | 100 | 2,1 s | 0 ms | 190 Kio |
| `/guides/vitres-teintees-loi/` | mobile | 98 | 100 | 100 | 2,3 s | 0 ms | 219 Kio |
| `/` | ordinateur | 35 | 96 | 100 | 7,5 s | 7 630 ms | 6 805 Kio |
| `/vitres-teintees/` | ordinateur | 64 | 93 | 100 | 1,6 s | 1 140 ms | 6 903 Kio |
| `/contact/` | ordinateur | 100 | 96 | 100 | 0,5 s | 0 ms | 294 Kio |

Le TBT de l'accueil et des simulateurs est gonflé par le rendu logiciel (SwiftShader) ; le **LCP de 38 s**
de l'accueil, lui, est un vrai problème : le texte d'accueil attend le téléchargement de la voiture 3D.

## Architecture constatée

- Site **statique** généré par Node : `content/*.js` (données) → `src/templates/*.js` (HTML) → `dist/`.
  Bundles esbuild (code splitting : la 3D n'est chargée que là où elle sert). Une seule dépendance
  d'exécution : `three@0.186.1`. Architecture saine : **aucune migration de framework n'est justifiée**.
- Visite 3D : `src/js/tour/` (scène, studio, voiture, matériaux, vol de caméra piloté par le scroll natif).
- Simulateurs : `src/js/sim/` (un module par prestation, visionneuse commune `viewer.js`).
- Tarifs : `content/pricing.js` (source principale), mais des prix sont **recopiés en dur** ailleurs.
- Formulaire : FormSubmit (AJAX), pièces jointes facultatives.
- Préproduction : GitHub Pages (`gh-pages`) republiée à chaque push de la branche ; `noindex` actif.

## Problèmes détectés

Importance : **P0** critique · **P1** important · **P2** amélioration · **P3** confort.

| # | Élément | Problème | Imp. | Conséquence utilisateur | Conséquence commerciale | Fichier(s) | Solution |
|---|---|---|---|---|---|---|---|
| 1 | Pare-brise (simulateur, FAQ, tarifs) | « Film athermique 70 % = conforme / légal » : faux en général. Le seuil de 70 % (art. R316-3 C. route) porte sur la transmission **totale** vitrage + film ; un film à 70 % sur un pare-brise d'origine (~75-85 %) donne ~50-60 %. | **P0** | Client induit en erreur, risque d'amende (135 €, 3 points) | Responsabilité de l'atelier engagée, crédibilité | `content/pricing.js`, `src/templates/sims.js`, `content/site.js` | Retirer toute conformité automatique ; afficher « conformité à vérifier sur le vitrage » et distinguer *visualisation esthétique* / *configuration autorisée sur route* |
| 2 | Accueil | Titre, texte et boutons d'accueil masqués (`visibility:hidden`) jusqu'au chargement complet de la voiture 3D (5,8 Mo) | **P0** | Sur mobile lent : rien à lire ni à cliquer pendant de longues secondes | Rebond, devis perdus ; LCP 38 s en labo | `src/styles/main.css`, `src/js/tour/index.js` | Afficher le chapitre d'accueil dès le HTML, la 3D prend le relais ensuite |
| 3 | Vitres teintées (pages + pages locales) | « Films solaires **homologués** » : allégation non vérifiée | **P0** | Promesse inexacte | Risque de pratique commerciale trompeuse | `content/site.js`, `src/templates/pages.js` | Formulation factuelle (« films solaires professionnels posés dans le respect de la réglementation ») |
| 4 | Tarifs feux | Projet : 100–120 € la paire (fumé 50/80 %). Repères V2 : covering 120 €/paire, PPF teinté 190 €/paire | **P1** | Prix affiché possiblement faux | Devis contestés | `content/pricing.js` | **Contradiction à faire valider** ; structure covering/PPF préparée, PPF « sur devis » tant que non validé |
| 5 | Tarifs en double | Prix recopiés en dur dans ~20 textes (titres SEO, FAQ, guides, gabarits) | **P1** | Incohérences futures entre pages | Erreur de prix à la première hausse | `content/site.js`, `content/guides.js`, `src/templates/*.js` | Générer ces textes depuis `content/pricing.js` (une seule source de vérité) |
| 6 | Dérogation médicale | « Dérogation pour raison médicale, sur justificatif » : trop large ; l'arrêté du 18/10/2016 vise une liste limitative d'affections | **P1** | Fausse attente | Risque de conseil erroné | `content/site.js`, `content/guides.js` | Reformuler en citant l'arrêté et la liste limitative |
| 7 | Confidentialité | Pas de base légale, durée de conservation imprécise, pas de mention CNIL ni du transfert hors UE (FormSubmit, États-Unis) | **P1** | Information RGPD incomplète | Non-conformité RGPD (art. 13) | `src/templates/pages.js` (mentions) | Compléter la notice (base légale, durée proposée, droits, CNIL, sous-traitants) |
| 8 | Mentions légales | Médiateur de la consommation absent ; crédits des modèles 3D « à compléter » ; mention TVA à confirmer ; hébergeur de production inconnu | **P1** | — | Obligations légales B2C | `content/site.js` | **Informations à fournir** ; emplacements prévus et signalés |
| 9 | Devis sur mobile | Pendant la visite 3D, la barre d'actions est masquée et « Devis » est caché dans le menu | **P1** | Doit chercher comment demander un devis | Conversion perdue | `src/templates/pages.js`, `src/js/main.js`, CSS | Bouton « Devis » compact toujours visible dans l'en-tête mobile |
| 10 | Simulateurs sur mobile | La 3D (~6,8 Mo) démarre seule dès que le simulateur approche de l'écran | **P1** | Données mobiles consommées, page lourde | Lenteur perçue | `src/js/sim/index.js` | Sur mobile / économie de données : aperçu fixe puis lancement au toucher |
| 11 | Visite 3D | Rendu continu à 60 i/s même quand rien ne bouge | **P1** | Batterie, chauffe des téléphones | — | `src/js/tour/index.js` | Rendu à la demande quand la caméra est immobile |
| 12 | Visite 3D | ~13,4 hauteurs d'écran de défilement | **P1** | Parcours long, surtout sur mobile | Les prestations et le devis arrivent tard | `content/flight.js` | Raccourcir le parcours, accès direct aux prestations |
| 13 | Formulaire | Pièces jointes envoyées en AJAX à FormSubmit : non vérifiable ici, la doc FormSubmit ne garantit pas l'AJAX avec fichiers | **P1** | Envoi possiblement en échec avec photos | Demande perdue | `src/js/main.js` | Avec pièce jointe : envoi classique (multipart) + page de confirmation ; à tester après activation |
| 14 | Sitemap | `lastmod` = date du build pour toutes les pages | **P2** | — | Signal de fraîcheur artificiel | `src/templates/*`, build | `lastmod` = date réelle de modification du contenu (empreinte par page) |
| 15 | Pages locales | 14 pages « vitres-teintees-<ville> » similaires à ~59 % (n-grammes de 5 mots) | **P2** | — | Risque de pages satellites | `content/zones*.js` | Enrichir les communes prioritaires, regrouper ou désindexer les plus faibles (**décision à prendre**) |
| 16 | Carte 3D | Sans WebGL, three.js écrit 2 erreurs console avant le repli | **P2** | — | — | `src/js/map3d.js` | Tester WebGL avant de créer le rendu |
| 17 | Ciel étoilé | Contraste insuffisant des pastilles désactivées (axe `color-contrast`, 18 nœuds) | **P2** | Lisibilité | — | CSS simulateur | Contraste ≥ 4,5:1 |
| 18 | Conversion | Aucun suivi (clics devis, téléphone, démarrage simulateur) | **P2** | — | Impossible de mesurer | `src/js/main.js` | Événements internes sans donnée personnelle, désactivés par défaut |
| 19 | Preuves | Aucune galerie de réalisations réelles ; avis Google et Instagram en attente de configuration | **P2** | Moins de confiance | Conversion | — | Galerie administrable (photos réelles à fournir) |
| 20 | Feux / detailing | « Le film protège l'optique », « protection céramique longue durée » : allégations produit non sourcées | **P2** | — | Promesse non prouvée | `content/site.js`, `content/pricing.js` | Formulations neutres ou propres au PPF |
| 21 | Accessibilité | `aside` imbriqué dans un repère (axe `landmark-complementary-is-top-level`, 6 pages) | **P3** | Lecteurs d'écran | — | `src/templates/pages.js` | Utiliser `div` ou sortir l'`aside` |
| 22 | Documentation | Le README cite `docs/PRODUCTION.md`, absent du dépôt | **P3** | — | — | `README.md` | Corriger la référence |
| 23 | Robots d'aperçu | `robots.txt` d'aperçu servi sous `/Site-Solar-Car/` : ignoré par les robots (il doit être à la racine du domaine). Le `noindex` des pages suffit | **P3** | — | — | `scripts/rebase.mjs` | Garder le `noindex` (efficace) ; documenter |

## Points sains (à préserver)

- Base SEO technique propre sur toutes les pages (titres ≤ 70 caractères, descriptions ~150, 1 H1,
  canonicals, Open Graph, JSON-LD `AutoBodyShop`/`Service`/`FAQPage`/`BreadcrumbList`/`Article`).
- Aucune erreur JavaScript sur les 32 pages ; repli sans WebGL fonctionnel (images fixes, textes, liens).
- Formulaire : champs obligatoires, anti-spam (champ piège), contrôle type/taille des fichiers.
- Préproduction protégée de l'indexation.
- Code de la 3D structuré, chargé à la demande ; gouverneur de performance déjà en place.

## Sources réglementaires consultées

- Questions écrites à l'Assemblée nationale sur le seuil de 70 % (art. R316-3) et le surteintage :
  [QE 57669](https://www.assemblee-nationale.fr/dyn/14/questions/QANR5L14QE57669.pdf),
  [QE 91529](https://www.assemblee-nationale.fr/dyn/14/questions/QANR5L14QE91529.pdf),
  [QE 1920 (15e législature)](https://questions.assemblee-nationale.fr/dyn/15/questions/QANR5L15QE1920.pdf).
- Le texte en vigueur (Légifrance) reste à relire avant mise en production : l'environnement de travail
  n'a pas pu y accéder directement.

## Mesures après les phases 2 à 8 (même protocole, labo sans GPU)

| Page | Forme | Perf. avant → après | Access. | LCP avant → après | TBT avant → après | Poids avant → après |
|---|---|---|---|---|---|---|
| `/` | mobile | 28 → 60 | 100 | 38,4 s → 2,3 s | 16 640 → 20 300 ms* | 6 770 → 6 783 Kio |
| `/vitres-teintees/` | mobile | 67 → 80 | 96 → 100 | 2,4 → 2,6 s | 4 490 → 690 ms | 6 856 → 312 Kio |
| `/contact/` | mobile | 99 → 99 | 100 | 2,1 → 2,2 s | 0 ms | 190 → 201 Kio |
| `/` | ordinateur | 35 → 58 | 96 → 100 | 7,5 s → 1,3 s | 7 630 → 10 420 ms* | 6 805 → 6 818 Kio |
| `/vitres-teintees/` | ordinateur | 64 → 72 | 93 → 100 | 1,6 → 0,6 s | 1 140 → 970 ms | stable (3D chargée sur ordinateur) |

\* Le TBT de l'accueil mesure surtout le rendu 3D **logiciel** (SwiftShader) qui démarre pendant la
mesure : il n'est pas représentatif d'un téléphone avec GPU. Le LCP, lui, ne dépend plus de la 3D.
À mesurer sur de vrais appareils (PageSpeed Insights / Search Console) une fois le site publié.
