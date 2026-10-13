# SOLAR CAR 37 — Tableau de bord V2

Point de retour arrière : commit **`96a3590`** (état stable avant V2).
Branche de travail : `claude/solar-car-37-website-ib2326` (chaque push republie l'aperçu
https://kerozenyt.github.io/Site-Solar-Car/, non indexé).

Statuts : À faire · En cours · Terminé et testé · Bloqué · En attente de validation.

| Phase | Statut | Modifications | Tests | Blocages |
|---|---|---|---|---|
| 1. Audit initial | Terminé et testé | `docs/V2-AUDIT.md` (23 constats P0→P3), tableau de bord, journal | Build, 32 pages (Playwright), axe-core, Lighthouse | Pas de GPU ni de vrai mobile ; services tiers bloqués |
| 2. Fiabilité commerciale | En attente de validation | Tarifs centralisés (`content/pricing.js` → `priceText`), règles centralisées (`content/regulation.js`), statut routier par zone dans le simulateur (autorisé / à vérifier / sous le seuil / visualisation esthétique), décharge de responsabilité retirée, covering et PPF distincts, dérogations exactes, notice RGPD complétée, mentions tarifs et médiation | Build, audit 32 pages (0 erreur), panneaux vitres/feux testés (citadine 220 € + avant 50 € = 270 €) | Tarifs feux/break/ciel étoilé/detailing, TVA, médiateur, crédits 3D, durée de conservation |
| 3. Design premium | En cours | Accueil de marque (qui/quoi/où/devis), accès direct aux 5 prestations, devis et appel visibles sur mobile, contrastes et repères corrigés | Captures 360/390/1366 px, axe-core 0 violation | Photos réelles de l'atelier pour remplacer les rendus |
| 4. Visite immersive | Terminé et testé (périmètre de la session) | Parcours 6,3 écrans (mobile 5,3), saut vers les chapitres, repères cliquables, rendu à la demande | Playwright + SwiftShader : sauts, chapitres actifs, comptage des rendus à l'arrêt | Réalisme matière/caméra à évaluer sur vrai GPU ; vidéos réelles à fournir |
| 5. Simulateurs | Terminé et testé (périmètre de la session) | Statuts routiers (vitres), covering/PPF et avant/après (feux), intensité et éteint/allumé (ciel étoilé), étapes et limites (phares), légende (detailing), réinitialisation, mémoire des réglages, 3D au toucher sur mobile | Playwright : mémoire/réinitialisation, étapes phares, lancement mobile, avant/après feux mesuré | Toutes les catégories ont maintenant un modèle réaliste (Crafter pour l'utilitaire) |
| 6. Conversion | Terminé, test réel en attente | Préremplissage depuis les simulateurs (avec statut routier), pièces jointes en envoi classique + page merci, rendez-vous souhaité (demande), suivi sans traceur, architecture de réservation documentée | Playwright avec FormSubmit simulé : envoi JSON, envoi multipart avec photo, redirection vers la page merci | Activation FormSubmit (clic sur l'e-mail reçu) puis test réel, y compris depuis un iPhone |
| 7. Réalisations | Prêt, en attente de contenus | Galerie administrable (`content/realisations.js`), filtres, comparateur avant/après, blocs accueil/prestations ; avis Google et Instagram prêts (configuration à fournir) | Playwright avec données temporaires : filtre, comparateur au clavier, bloc par prestation | Vraies photos (avec accord des clients), Place ID + clé Google, URL de flux Instagram |
| 8. Performance | Terminé et testé (labo) | 3D d'accueil différée sur mobile, image fixe + lancement volontaire sur connexion lente, 3D des simulateurs au toucher sur mobile, rendu à la demande, carte sans erreur sans WebGL | Lighthouse avant/après (LCP accueil mobile 38,4 s → 2,3 s ; page vitres mobile 6,8 Mio → 312 Kio) | Mesures sur vrais appareils après publication |
| 9. SEO | Terminé (préproduction protégée) | `lastmod` réel par empreinte de contenu, 3 nouveaux guides factuels (prix, choix de teinte, nano-céramique), maillage prestation → tous ses guides, plan de migration `docs/MIGRATION-DOMAINE.md` | Audit 36 pages : 0 erreur, 0 lien cassé, 1 H1, titres ≤ 70 car., axe 0 | Inventaire des URL de l'ancien site, décision sur les pages locales |
| 10. Tests et livraison | Terminé et testé (périmètre de la session) | Prix par défaut dans le HTML, serveur de test robuste, journal des tests | 36 pages (0 erreur, 0 lien cassé, axe 0), 4 scénarios clients, aperçu en sous-dossier simulé, lecture 3D du detailing, Lighthouse avant/après ; publications GitHub Pages vérifiées dans les Actions | Vrais téléphones, vrai GPU, formulaire réel (FormSubmit à activer) |

## Informations en attente de validation

| Sujet | État actuel du site | Proposition / question |
|---|---|---|
| Feux teintés | Covering 100 à 120 € la paire ; PPF teinté affiché « sur devis » (190 € préparé, `validated: false`) | Repères V2 : covering 120 €, PPF 190 € la paire. Confirmer pour activer |
| Film de pare-brise | « Athermique 70 % » 290 € ; statut affiché : sous le seuil dans la plupart des cas | Quelle référence et quelle transmission réelle ? Un film très clair (≥ 82 %) peut rester au-dessus de 70 % une fois posé |
| Break | 280 € (forfait arrière) | Repère V2 : 280 à 300 €. Fourchette à afficher ? |
| Ciel étoilé | Sur devis | Repère V2 : 1 090 à 1 490 €. Afficher « indicatif, selon configuration » ? |
| Detailing | Sur devis | Repère V2 : 590 à 1 090 €. Afficher une fourchette indicative ? |
| TVA | Prix affichés « TTC » | Franchise en base (micro-entreprise) ? Si oui : « TVA non applicable, art. 293 B du CGI » |
| Médiateur de la consommation | Absent | Nom et coordonnées du médiateur choisi (obligatoire pour les clients particuliers) |
| Crédits modèles 3D | « à compléter selon la licence » | Licence et auteur de chaque modèle |
| Hébergeur de production | GitHub Pages (aperçu) | Hébergeur retenu pour www.solarcar37.fr |
| Conservation des demandes | « le temps nécessaire » | Proposition : 3 ans après le dernier contact (prospects), durée légale pour les clients |
| Pages locales | 14 communes | Garder les 14, ou se concentrer sur 6 à 8 communes prioritaires enrichies ? |

## Avant la mise en production (rappel)

1. Valider les informations du tableau ci-dessus (tarifs, TVA, médiateur, crédits 3D, conservation).
2. Activer FormSubmit (clic sur l'e-mail reçu à contact@solarcar37.fr) puis tester un envoi réel,
   avec et sans photo, depuis un ordinateur et un iPhone.
3. Fournir les vraies photos de réalisations (`content/realisations.js`), le Place ID + la clé
   Google (avis) et, si souhaité, l'URL du flux Instagram.
4. Relire la réglementation sur Légifrance (articles R316-3 et R316-3-1, arrêté du 18 octobre 2016).
5. Suivre `docs/MIGRATION-DOMAINE.md` (inventaire des anciennes URL, redirections, DNS en
   préservant l'e-mail, HTTPS, Search Console).
6. Mesurer sur de vrais appareils (PageSpeed Insights, rapport Core Web Vitals).
