# Mission : brancher le robot « une photo par semaine » sur ma fiche Google

Tu es mon assistant dans mon navigateur. Mon serveur Cloudflare (celui des réservations de mon
atelier SOLAR CAR 37) contient maintenant un robot qui publie chaque mardi une photo de mes
réalisations sur ma fiche Google. Il est déjà installé : il lui manque l'accès à Google.
Ta mission : faire la configuration chez Google et chez Cloudflare, puis le connecter.

Je suis connecté dans Chrome au compte Google de l'atelier (contact.solarcar37@gmail.com,
propriétaire de la fiche « SOLAR CAR 37 ») et à mon compte Cloudflare.

---

## Règles à respecter absolument

1. **Secrets** : le « code secret du client » OAuth ne doit **jamais** apparaître dans notre
   conversation, ni dans un document, un e-mail ou un fichier. Quand il faut le recopier dans
   Cloudflare, prépare le champ, puis **laisse-moi coller la valeur moi-même**.
2. Ne modifie, ne supprime et ne désactive **rien d'autre** dans Google Cloud et Cloudflare : ni
   les autres API, ni le compte de service des agendas, ni la clé Google Maps, ni les autres
   secrets du serveur (CALENDARS_BUSY, GOOGLE_SERVICE_ACCOUNT, STRIPE…, RESEND_API_KEY,
   STATS_KEY).
3. Si Google demande d'**activer la facturation**, une carte bancaire ou une **vérification
   payante** : arrête-toi et demande-moi.
4. Avant d'**envoyer le formulaire de demande d'accès** (étape 5), montre-moi ce que tu as rempli
   et attends mon « OK ».
5. Si une page ne ressemble pas à ce qui est décrit (l'interface de Google change souvent),
   cherche l'équivalent, et en cas de doute demande-moi.

---

## Étape 1 : trouver le projet Google Cloud

Va sur https://console.cloud.google.com. Le bon projet est celui qui contient le **compte de
service des agendas** de la réservation (IAM et administration → Comptes de service) et la clé
Google Maps du site. S'il y a plusieurs projets et que tu hésites, montre-les-moi.
Note son **nom**, son **ID** et son **numéro de projet** (page « Tableau de bord » ou
« Paramètres du projet ») : le numéro sert à l'étape 5.

## Étape 2 : activer les API

Dans « API et services » → « Bibliothèque », active :
- **My Business Account Management API**
- **My Business Business Information API**
- **Google My Business API** : elle n'apparaît en général qu'**après** l'accord de Google
  (étape 5). Si tu ne la trouves pas, ce n'est pas grave : dis-le-moi simplement.

## Étape 3 : l'écran de consentement OAuth

Dans « API et services » → « Écran de consentement OAuth » (ou « Google Auth Platform ») :
- type d'utilisateurs : **Externe** ;
- nom de l'application : `SOLAR CAR 37 – robot fiche Google` ;
- e-mail d'assistance et e-mail du développeur : contact.solarcar37@gmail.com ;
- champs d'application (« Accès aux données ») : ajoute
  `https://www.googleapis.com/auth/business.manage` ;
- état de publication (« Audience ») : **Publier l'application → En production**. Important : en
  mode « Test », Google coupe l'accès du robot au bout de 7 jours. Si Google annonce qu'une
  validation est nécessaire, c'est normal pour une application à usage privé : on peut continuer
  sans (un avertissement s'affichera seulement à la connexion). Si Google **bloque** la mise en
  production, laisse en « Test », ajoute contact.solarcar37@gmail.com comme utilisateur test et
  préviens-moi.

## Étape 4 : l'identifiant OAuth du robot

Dans « API et services » → « Identifiants » → « Créer des identifiants » → **ID client OAuth** :
- type d'application : **Application Web** ;
- nom : `Robot fiche Google` ;
- URI de redirection autorisée (exactement) :
  `https://solarcar37-reservation.contact-solarcar37.workers.dev/fiche-google/retour`
- crée-le. Google affiche l'**ID client** et le **code secret du client** (souvent une seule
  fois). **Ne ferme pas cette fenêtre.**

Ensuite, dans un **nouvel onglet**, va sur https://dash.cloudflare.com → « Workers et Pages »
→ **solarcar37-reservation** → « Paramètres » → « Variables et secrets » → « Ajouter » :
1. type **Secret**, nom `GOOGLE_OAUTH_CLIENT_ID` : dis-moi quand le champ « Valeur » est prêt,
   je colle l'ID client moi-même ;
2. type **Secret**, nom `GOOGLE_OAUTH_CLIENT_SECRET` : pareil, je colle le code secret moi-même ;
3. enregistre / déploie. Vérifie que la liste des secrets contient bien les deux nouveaux, en plus
   des six qui existaient déjà (ne touche pas à ceux-là).

## Étape 5 : la demande d'accès à l'API

Ouvre https://support.google.com/business/contact/api_default et choisis
**« Application for Basic API Access »**. Remplis avec :
- nom : Nicolas MALAGA ;
- e-mail : contact.solarcar37@gmail.com (le compte qui gère la fiche) ; si un champ demande un
  e-mail professionnel distinct : contact@solarcar37.fr ;
- entreprise : SOLAR CAR 37 ; site web : https://www.solarcar37.fr ;
- numéro du projet Google Cloud : celui de l'étape 1 ;
- nombre d'établissements : 1 ; je suis le propriétaire de l'entreprise et de la fiche ;
- description de l'usage (en anglais, à coller) :

> SOLAR CAR 37 is a car window tinting, detailing and wrapping workshop in Vouvray, France, run by its owner. We manage only our own single, verified Business Profile with this Google account. We want to use the Business Profile APIs for that one location only: once a week, a small server we host on Cloudflare uploads one real photo of a completed job from our own website's gallery to our profile (Media API), and reads our location details to keep them consistent with our website. No third-party profiles, no reviews automation, no resale of data.

**Montre-moi le formulaire rempli et attends mon « OK » avant d'envoyer.** Google répond par
e-mail sous 14 jours environ.

## Étape 6 : connecter le robot

Ouvre la page de suivi du robot. C'est le lien de ma page statistiques
(`https://solarcar37-reservation.contact-solarcar37.workers.dev/stats?cle=…`) avec
**`/fiche-google` à la place de `/stats`** : demande-moi ce lien, je te le donne.
- clique sur **« Connecter le compte Google de la fiche »** ;
- choisis contact.solarcar37@gmail.com ;
- si Google affiche « Google n'a pas validé cette application » : c'est mon application,
  clique sur « Paramètres avancés » → « Accéder à SOLAR CAR 37 – robot fiche Google » ;
- coche l'accès à la gestion de la fiche d'établissement et valide.

La page doit afficher « Compte Google connecté ». Elle dira soit « Fiche trouvée », soit que le
robot **attend l'accord de Google** (normal tant que la demande de l'étape 5 n'est pas acceptée).

## Étape 7 : bilan

Récapitule : le projet utilisé (nom et numéro), les API activées (et celle qui manque, s'il y en
a), l'état de l'écran de consentement (production ou test), les deux secrets ajoutés dans
Cloudflare, la demande d'accès envoyée (date), l'état affiché par la page de suivi.

Rappelle-moi la **dernière action** à faire quand Google enverra son accord : activer
« Google My Business API » dans le projet (étape 2). Ensuite, le robot démarre tout seul le
mardi suivant ; le bouton « Publier cette photo maintenant » de la page de suivi permet de
tester tout de suite.
