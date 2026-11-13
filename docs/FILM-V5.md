# Film d'accueil V5 — cahier des charges (validé le 13 novembre 2026)

Nouvelle vidéo d'accueil photoréaliste, générée par IA (Higgsfield, offre Ultra) à partir d'images
clés 3D (`scripts/film/`), puis montée, étalonnée et intégrée au site. Aucun crédit n'est dépensé
avant validation du storyboard en images.

## Décisions

| Sujet | Choix |
|---|---|
| Voiture | Porsche 911 GT3 RS **blanche** (blanc uni), **jantes noir satiné** |
| Marquage | Bande « GT3 RS » d'usine remplacée par le marquage **SOLAR CAR** (`scripts/film/livery.js`) : lettres graphite satiné dans la police du logo, fine bande effilée vers l'avant, filet doré — validé tel quel |
| Plaque | Plaque **SOLAR CAR 37** (blason) avant et arrière |
| Sol | **Dalles noires + cadre jaune** (le sol du vrai atelier) |
| Plafond / murs | **Néons linéaires blancs** au plafond et sur les murs sombres, mur d'outillage et jantes en arrière-plan |
| Lumière | **Blanc froid + touches dorées** |
| Atmosphère | **Légère brume** (faisceaux visibles, voiture nette) |
| Personnes | **Aucune** (ni mains ni silhouette) |
| Caméra | **Lente et fluide, type steadicam**, plan-séquence sans retour en arrière |
| Durée | **Environ 45 s** (8 plans de 5 à 6 s) |
| Défilement | **7 à 8 écrans**, la vidéo suit le défilement **1:1 et s'arrête net** (aucun lissage), **ordinateur et téléphone** |
| Textes | Titres et onglets des prestations **par-dessus la vidéo** (aucun texte généré dans l'image) ; cadrage qui laisse la place au texte |
| Formats | **Horizontal 16:9 en 4K** (ordinateur) + **vertical 9:16 dédié en 1080 × 1920** (téléphone) |
| Étoiles | **Blanc chaud scintillant**, quelques étoiles filantes |

## Plan-séquence (ordre validé)

| Plan | Prestation | Action | Image de départ → d'arrivée |
|---|---|---|---|
| 1 | Lavage | Un rideau d'eau tombe d'une rampe au plafond sur la GT3 RS poussiéreuse ; l'eau ruisselle, la peinture apparaît propre et brillante | K0 → K1 |
| 2 | Polissage (detailing) | La caméra longe le flanc ; un reflet passe de terne à miroir | K1 → K2 |
| 3 | Rénovation de phares | Gros plan sur le phare jauni qui redevient clair et s'allume | K2 → K3 |
| 4 | Covering | La caméra monte sur l'aile ; un film carbone se déroule sur le capot | K3 → K4 |
| 5 | Feux arrière teintés | Survol du toit vers l'arrière ; le bandeau de feux passe au fumé, allumé | K4 → K5 |
| 6 | Vitres teintées | Le long du flanc, la vitre arrière passe du clair au noir | K5 → K6 |
| 7 | Ciel étoilé | La caméra entre dans l'habitacle ; le pavillon s'illumine d'étoiles | K6 → K7 |
| 8 | Final | Sortie de l'habitacle, plan large de face, phares allumés, capot carbone | K7 → K8 |

Chaque plan est généré deux fois (horizontal et vertical), d'abord en brouillon, puis en version
finale une fois le mouvement validé.

## Déroulé

1. Storyboard en images 3D (9 images clés, horizontales et verticales) → validation.
2. Images clés rendues photoréalistes (modèle d'image Higgsfield) → validation.
3. Plans vidéo en brouillon (Seedance 2.5, image de départ + d'arrivée) → validation.
4. Versions finales (4K horizontal, 1080p vertical).
5. Montage, raccords, étalonnage, encodage pour le défilement 1:1, intégration au site.

## État d'avancement (13 novembre 2026)

- Storyboard v2 **validé** : 9 images clés horizontales et verticales (`scripts/film/keyframes.js`),
  garage habillé (Koch-Chemie, polisseuses, rouleaux de film), peinture terne sans rayures avant
  polissage, brillant miroir après.
- Rendu des images clés (4K horizontal et 1080 × 1920 vertical) :

  ```bash
  FILM_QUERY='paint=f2f2ee&metal=0.02&rough=0.2&livery=1&ceiling=leds&rims=17181a&exp=0.95&swirl=0&dullcoat=0.8' \
    node scripts/film/render.mjs <dossier> 3840 2160 --keys scripts/film/keyframes.js
  KEYS_SET=vertical FILM_QUERY='…même chose…' node scripts/film/render.mjs <dossier> 1080 1920 --keys scripts/film/keyframes.js
  ```

- Guide de l'étape 1 (photos réalistes, Nano Banana Pro, textes à copier) :
  https://claude.ai/artifact/PsFNVrYMhQurrzJwbt62Sa
- Higgsfield : offre Ultra active (3 010 crédits, aucun dépensé). Le connecteur de la session ne
  donnait que la lecture (crédits, modèles, galerie) ; pour générer directement depuis une session,
  autoriser les outils de génération du connecteur (claude.ai → Connecteurs → Higgsfield →
  permissions) puis ouvrir une nouvelle session.
- Étape 2 préparée (même page guide) : 8 plans Seedance 2.5 en mode image de départ + image de
  fin (photo Kn → photo Kn+1), son coupé, brouillon 480p puis finalisation du brouillon en 4K
  (16:9) ou 1080p (9:16). Durées : plan 1 lavage 7 s, 2 polissage 6 s, 3 phare 5 s, 4 capot
  carbone 5 s, 5 survol et feux arrière 7 s, 6 vitres 5 s, 7 ciel étoilé 6 s, 8 final 6 s
  (47 s). Commencer par le plan 1 en brouillon et noter son coût avant de continuer.

## Vidéos générées (13 novembre 2026, galerie Higgsfield)

16 versions finales, 24 images/s : horizontales 3840 × 2160, verticales 1080 × 1920.

| Plan | Horizontal (4K) | Vertical (1080 × 1920) |
|---|---|---|
| 1 Lavage (7 s) | `…144043_454ae77f` | `…150606_b8e93c2f` |
| 2 Polissage (6 s) | `…145019_8a8714a2` | `…150610_a48036e7` |
| 3 Phare (5 s) | `…150439_ddaa4573` (à refaire : raccord) | `…150613_2c2b4a1b` |
| 4 Carbone (5 s) | `…145031_b5acfc08` | `…150617_075d6aee` |
| 5 Feux arrière (7 s) | `…145034_d0c26851` (à refaire : raccord) | `…150620_cb7bed5e` |
| 6 Vitres (5 s) | `…145037_0374f534` | `…150623_07aa8e69` |
| 7 Ciel étoilé (6 s) | `…145219_35f4cc47` | `…150627_7521a12c` |
| 8 Final (6 s) | `…145222_26a7018e` (à refaire : lettrage « GT3 CAR ») | `…150630_f625d9d7` |

Raccords mesurés (écart moyen entre la dernière image d'un plan et la première du suivant, 0 = identique) :
verticales toutes ≤ 10 ; horizontales 2→3 = 65 et 4→5 = 66 (cadrages différents), 3→4 = 34, autres ≤ 7.
Kit de correction envoyé (images exactes extraites des plans voisins, photo finale retouchée avec le
vrai marquage SOLAR CAR) : plans 8, 3 et 5 à refaire dans cet ordre. Hôte des fichiers Higgsfield
(d8j0ntlcm91z4.cloudfront.net) autorisé dans l'environnement pour les télécharger.
