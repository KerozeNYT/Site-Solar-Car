# Pub de Noël — TikTok, Instagram Reels et Stories (17 novembre 2026)

Une vidéo **verticale 9:16** d'environ **20 s** pour une publicité sponsorisée : la Porsche
SOLAR CAR du site, **emballée comme un cadeau** dans l'atelier décoré pour Noël ; le ruban se
défait, puis chaque prestation apparaît (vitres teintées, feux teintés, ciel étoilé) ; carton final
avec l'offre. Les textes sont ajoutés **au montage**, jamais générés par l'IA (elle écorche les
lettres).

## L'offre (réglée le 17 novembre 2026)

- Code **NOEL** : **−15 % sur toutes les prestations**, utilisations illimitées.
- Valable pour une réservation en ligne réglée (acompte ou totalité) ou une demande de devis
  envoyée **du 1er décembre au 24 décembre à 23 h 59**, quelle que soit la date du rendez-vous
  (agenda en ligne ouvert environ 6 mois à l'avance).
- Vitres et feux teintés : code saisi au paiement ; autres prestations : code dans la demande de
  devis. Un seul code par réservation (jamais cumulé avec un parrainage).
- Urgence **réelle** : la date et l'heure limites, avec le compte à rebours du site (bandeau, page
  de réservation, devis). Ne jamais annoncer un nombre limité (« 10 premiers ») qui ne serait pas
  appliqué : pratique commerciale trompeuse (Code de la consommation, L121-4).

## Storyboard (images clés 3D : `scripts/film/keyframes-noel.js`)

| Image | Ce qu'on voit |
|---|---|
| N0 | Trois-quarts avant : la GT3 RS blanche emballée d'un ruban de satin rouge (en travers du toit et sur toute la longueur), grand nœud sur le toit ; sapins éclairés et guirlandes derrière ; phares éteints |
| N1 | Même vue, un peu plus près : ruban parti, phares allumés |
| N2 | Flanc arrière droit : vitres arrière teintées noires |
| N3 | Arrière : bandeau de feux fumé, allumé |
| N4 | Habitacle : ciel étoilé |
| N5 | Trois-quarts avant large, tout allumé : place en haut et en bas pour le texte |

Rendu (1080 × 1920) :

```bash
PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright/index.mjs \
FILM_QUERY='paint=f2f2ee&metal=0.02&rough=0.2&livery=1&ceiling=leds&rims=17181a&exp=0.95&swirl=0&dullcoat=0.8&fog=0.005&xmas=1' \
  node scripts/film/render.mjs <dossier> 1080 1920 --keys scripts/film/keyframes-noel.js
```

Le décor de Noël (ruban et nœud qui épousent la carrosserie, guirlandes de sapin éclairées, quatre
sapins avec étoile, paquets cadeaux au sol) est dans `scripts/film/christmas.js` (option `xmas=1`
de la scène). Images rendues : `assets-src/pub-noel/N0v.jpg` à `N5v.jpg`. Texte complet pour
Claude dans Chrome : `docs/pub-noel/PROMPT-CLAUDE-NAVIGATEUR.md`.

## Plans vidéo (de l'image Nk à l'image Nk+1)

| Plan | De → à | Durée | Action |
|---|---|---|---|
| 1 | N0 → N1 | 5 s | Le nœud se défait, le ruban glisse et tombe, les phares s'allument |
| 2 | N1 → N2 | 4 s | La caméra longe le flanc droit ; les vitres arrière passent au noir |
| 3 | N2 → N3 | 4 s | La caméra contourne l'arrière ; le bandeau de feux devient fumé et s'allume |
| 4 | N3 → N4 | 4 s | La caméra entre dans l'habitacle ; le pavillon s'illumine d'étoiles |
| 5 | N4 → N5 | 4 s | La caméra ressort et recule jusqu'au plan large final |

Total environ 21 s. Pour une version 15 s : retirer le plan 4 (passer de N3 à N5).

## Textes à l'écran (au montage)

| Moment | Texte |
|---|---|
| 0–2 s | 🎁 **Votre cadeau de Noël** |
| Ruban qui part | **−15 % sur toutes les prestations** |
| Vitres | Vitres teintées |
| Feux | Feux teintés |
| Ciel étoilé | Ciel étoilé |
| Carton final | **Code NOEL · −15 %** · Jusqu'au **24 décembre à 23 h 59** · Réservez en ligne · SOLAR CAR 37, Vouvray (Tours) |

Variante possible pour relancer la pub en fin de campagne : carton « Plus que 3 jours », « Dernier
jour ». Ne pas écrire d'adresse de site tant que solarcar37.fr ne pointe pas vers le nouveau site
(docs/MIGRATION-DOMAINE.md) : le lien est celui de la publicité.

## Sur les réseaux

- **Lien de la pub** : la page de réservation avec le code, `…/reservation/?code=NOEL` (le code se
  remplit tout seul) ; pour Instagram et Facebook ajouter `&utm_source=instagram&utm_medium=cpc`
  (comptée « Publicité » dans les statistiques ; TikTok est reconnu seul, au `ttclid`).
- **Musique** : uniquement la bibliothèque musicale commerciale de TikTok ou de Meta (une musique
  « tendance » est interdite en publicité).
- **Contenu généré par IA** : cocher la mention prévue par TikTok et Meta.
- **Ciblage** : environ 30 km autour de Vouvray, 25-55 ans, intérêts automobile ; petit budget
  quotidien, du 1er au 24 décembre.

## Fabrication sur Higgsfield

Même méthode que le film d'accueil (docs/FILM-V5.md) : images clés 3D → photos réalistes (modèle
d'image) → plans vidéo Seedance 2.5 en image de départ + image de fin, **son coupé**, **brouillon
480p d'abord** (noter le coût), puis finalisation en 1080 × 1920 → montage et textes. Le connecteur
Higgsfield des sessions Claude Code ne fait que lire (crédits, modèles, galerie) : la génération se
fait sur higgsfield.ai, à la main ou avec Claude dans Chrome (textes prêts dans la page guide).
Crédits le 17 novembre 2026 : 313 (offre Ultra).
