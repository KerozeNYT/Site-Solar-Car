# Fiche Google : une photo publiée automatiquement chaque semaine

Chaque **mardi matin** (8 h 17 UTC, soit 9 h 17 en hiver et 10 h 17 en été à Paris), le serveur
de réservation publie sur la fiche Google la prochaine photo des réalisations du site. Personne n'a
rien à faire : il suffit d'ajouter des réalisations au site.

```
réalisation ajoutée au site (content/realisations.js, plaques masquées par scripts/photos.mjs)
   │  build du site : JPG + liste dans /fiche-google/photos.json
   ▼
serveur de réservation (Cloudflare), chaque mardi
   │  prend la 1re photo de la liste pas encore envoyée
   ▼
fiche Google (API Business Profile, au nom du compte Google propriétaire)
   + e-mail « nouvelle photo publiée » (ou « problème ») à l'atelier
```

## L'ordre des photos

- La file d'attente, ce sont les **photos des réalisations du site** (`content/realisations.js`),
  plus les photos de `extra` dans `content/fiche-google.js`.
- Ordre : la 1re photo de chaque réalisation, puis la 2e de chacune, etc. Deux photos de la même
  voiture ne se suivent jamais. Une réalisation ajoutée **en haut** de `content/realisations.js`
  part donc dès le mardi suivant.
- `sentByHand` (dans `content/fiche-google.js`) liste les photos déjà mises sur la fiche à la main :
  elles ne sont jamais renvoyées.
- Au 16 novembre 2026 : **21 photos en attente**, soit environ 5 mois de publications.
- Quand la file est vide, l'atelier reçoit **un** e-mail « plus de photo en attente » (puis un
  rappel au plus toutes les 4 semaines).

Ne mettre dans la file que de **vraies photos de chantiers**, avec l'accord du client : jamais de
rendu 3D ni d'image générée (interdit sur une fiche Google), et jamais deux fois la même photo
(Google ne repère pas les doublons).

## La page de suivi

`https://solarcar37-reservation.contact-solarcar37.workers.dev/fiche-google?cle=<clé>`

La **clé est la même que celle des statistiques** (`STATS_KEY`) : prendre le lien de la page
statistiques et remplacer `/stats` par `/fiche-google`. La page montre :

- le compte Google connecté et la fiche trouvée ;
- le dernier passage du robot (réussi, en attente de Google, ou l'erreur exacte) ;
- la prochaine photo, sa date de publication, les suivantes ;
- les photos déjà publiées par le robot ;
- un bouton **« Publier cette photo maintenant »** (sans attendre mardi).

Le robot n'envoie jamais deux photos à moins de 5 jours d'écart, sauf avec ce bouton.

## E-mails

- `FICHE_MAILS = "tout"` (dans `booking/wrangler.toml`) : un e-mail à chaque photo publiée, avec la
  photo. `"erreurs"` : seulement les problèmes.
- Un même problème n'est signalé qu'une fois toutes les 4 semaines (par exemple pendant l'attente de
  l'accord de Google).

## Mise en route (une seule fois)

Le prompt `docs/fiche-google/PROMPT-CONFIG-ROBOT.md` fait faire les étapes 1 à 4 par Claude
navigateur.

1. **Demande d'accès à l'API** (Google l'examine sous 14 jours ; l'accord n'est pas garanti) :
   formulaire https://support.google.com/business/contact/api_default, choix « Application for
   Basic API Access », avec le numéro du projet Google Cloud de l'atelier. Tant que Google n'a pas
   répondu, le quota de l'API est à 0 : le robot attend sans rien casser.
2. **Projet Google Cloud** (celui du compte de service des agendas) :
   - activer « My Business Account Management API » et « My Business Business Information API » ;
   - écran de consentement OAuth : type « Externe », publié **en production** (en mode « Test »,
     Google coupe l'accès au bout de 7 jours), avec le champ d'accès
     `https://www.googleapis.com/auth/business.manage` ;
   - identifiants : « ID client OAuth », type **Application Web**, URI de redirection autorisée
     `https://solarcar37-reservation.contact-solarcar37.workers.dev/fiche-google/retour`.
3. **Secrets du serveur Cloudflare** (Workers et Pages → `solarcar37-reservation` → Paramètres →
   Variables et secrets, type **Secret**) : `GOOGLE_OAUTH_CLIENT_ID` et
   `GOOGLE_OAUTH_CLIENT_SECRET`. Ou en ligne de commande :
   `cd booking && npx wrangler secret put GOOGLE_OAUTH_CLIENT_ID` (puis `..._SECRET`).
4. **Connexion** : page de suivi → « Connecter le compte Google de la fiche » → choisir le compte
   **propriétaire de la fiche**. Google affiche « Google n'a pas validé cette application » :
   « Paramètres avancés » → « Accéder à… », puis autoriser. La page confirme « Fiche trouvée »
   (ou indique qu'elle attend l'accord de Google).
5. **Quand Google accepte la demande** (e-mail de Google) : activer aussi « **Google My Business
   API** » dans le projet (elle n'apparaît dans la bibliothèque qu'après l'accord). Le robot
   démarre seul le mardi suivant ; le bouton de la page de suivi permet de tester tout de suite.

## Si quelque chose ne va pas

| Message sur la page de suivi | Quoi faire |
|---|---|
| Paramétrage à finir : identifiants Google… | Étape 3 |
| Aucun compte Google connecté | Étape 4 |
| … quota à 0 : en attente de la réponse à la demande d'accès | Rien : attendre l'accord de Google (étape 1) |
| Une API Google n'est pas activée dans le projet… | Ouvrir le lien donné par Google dans le message et cliquer sur « Activer » |
| Google a retiré l'autorisation du robot… | Étape 4 à nouveau (mot de passe changé, accès retiré, application repassée en « Test ») |
| Aucune fiche « SOLAR CAR 37 » sur ce compte | Se reconnecter avec le compte propriétaire de la fiche |
| Liste des photos illisible sur le site | Le site publié n'a pas encore `/fiche-google/photos.json` : le reconstruire (`SITE_URL` de `booking/wrangler.toml` doit être l'adresse du site) |
| Google a refusé l'envoi : … | Lire le message de Google ; le robot réessaie le mardi suivant |

Envoi d'une photo : le robot donne d'abord à Google l'adresse du JPG sur le site ; si Google ne
peut pas la lire (par exemple sur l'aperçu, fermé aux robots), il envoie le fichier lui-même.

## Après la mise en ligne sur www.solarcar37.fr

Passer `SITE_URL` de `booking/wrangler.toml` sur `https://www.solarcar37.fr`, puis redéployer
(`cd booking && npx wrangler deploy`). La file reste la même : les photos déjà publiées sont
mémorisées par le serveur.

## Fichiers

- `content/fiche-google.js` : la file (ordre, photos déjà envoyées, catégories Google).
- `scripts/fiche-google.mjs` : écrit `dist/fiche-google/*.jpg` et `photos.json` au build.
- `booking/fiche-google.js` : connexion Google, recherche de la fiche, envoi, page de suivi,
  e-mails, objet de stockage `Fiche` (jeton d'accès, photos envoyées).
- `booking/test/fiche.test.mjs` : les tests (`npm run test:booking`).
