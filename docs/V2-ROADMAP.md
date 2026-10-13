# SOLAR CAR 37 — Tableau de bord V2

Point de retour arrière : commit **`96a3590`** (état stable avant V2).
Branche de travail : `claude/solar-car-37-website-ib2326` (chaque push republie l'aperçu
https://kerozenyt.github.io/Site-Solar-Car/, non indexé).

Statuts : À faire · En cours · Terminé et testé · Bloqué · En attente de validation.

| Phase | Statut | Modifications | Tests | Blocages |
|---|---|---|---|---|
| 1. Audit initial | Terminé et testé | `docs/V2-AUDIT.md` (23 constats P0→P3), tableau de bord, journal | Build, 32 pages (Playwright), axe-core, Lighthouse | Pas de GPU ni de vrai mobile ; services tiers bloqués |
| 2. Fiabilité commerciale | En attente de validation | Tarifs centralisés (`content/pricing.js` → `priceText`), règles centralisées (`content/regulation.js`), statut routier par zone dans le simulateur (autorisé / à vérifier / sous le seuil / visualisation esthétique), décharge de responsabilité retirée, covering et PPF distincts, dérogations exactes, notice RGPD complétée, mentions tarifs et médiation | Build, audit 32 pages (0 erreur), panneaux vitres/feux testés (citadine 220 € + avant 50 € = 270 €) | Tarifs feux/break/ciel étoilé/detailing, TVA, médiateur, crédits 3D, durée de conservation |
| 3. Design premium | À faire | — | — | — |
| 4. Visite immersive | À faire | — | — | — |
| 5. Simulateurs | À faire | — | — | — |
| 6. Conversion | À faire | — | — | Activation FormSubmit (clic sur l'e-mail) |
| 7. Réalisations | À faire | — | — | Photos réelles, Place ID Google, flux Instagram |
| 8. Performance | À faire | — | — | — |
| 9. SEO | À faire | — | — | Inventaire des URL de l'ancien site |
| 10. Tests et livraison | À faire | — | — | — |

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
