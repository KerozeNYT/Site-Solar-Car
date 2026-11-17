# Mission : brancher Gmail et les réponses aux devis sur mon espace atelier

Tu es mon assistant dans mon navigateur. Mon atelier SOLAR CAR 37 a un espace de gestion
(https://atelier.solarcar37.fr), hébergé sur mon serveur Cloudflare `solarcar37-reservation`.
Les demandes de devis y arrivent en discussions. Il faut maintenant deux branchements :

- **A. Le relais des réponses** : quand je réponds à un devis depuis Gmail, ou quand un client
  répond, l'e-mail passe par l'adresse `devis@reponse.solarcar37.fr`, que Cloudflare doit remettre
  à mon serveur.
- **B. La lecture de Gmail** : mon espace lit (en lecture seule) les e-mails échangés avec mes
  clients en attente de devis, pour mettre à jour les discussions et les statuts tout seul.

Je suis connecté dans Chrome au compte Google de l'atelier (contact.solarcar37@gmail.com) et à mon
compte Cloudflare.

---

## Règles à respecter absolument

1. **Mes e-mails sur OVH** : la boîte contact@solarcar37.fr est chez OVH. Dans Cloudflare, ne
   touche **jamais** aux enregistrements MX ni SPF du domaine principal `solarcar37.fr`. Si
   Cloudflare propose « Ajouter les enregistrements et activer », « Activer le routage des
   e-mails » ou de remplacer les MX de `solarcar37.fr` : **refuse et demande-moi**. Seul le
   sous-domaine `reponse.solarcar37.fr` est concerné (ses enregistrements existent déjà).
2. **Secrets** : le « code secret du client » OAuth ne doit **jamais** apparaître dans notre
   conversation, ni dans un document, un e-mail ou un fichier. Quand il faut le recopier dans
   Cloudflare, prépare le champ, puis **laisse-moi coller la valeur moi-même**.
3. Ne modifie, ne supprime et ne désactive **rien d'autre** dans Google Cloud et Cloudflare : ni
   les autres API, ni le compte de service des agendas, ni la clé Google Maps, ni les autres
   secrets du serveur (ATELIER_SECRET, CALENDARS_BUSY, GOOGLE_SERVICE_ACCOUNT, RESEND_API_KEY,
   STATS_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET), ni les autres règles de routage.
4. Si Google demande d'**activer la facturation**, une carte bancaire ou une **vérification
   payante** : arrête-toi et demande-moi.
5. Si une page ne ressemble pas à ce qui est décrit (les interfaces changent souvent), cherche
   l'équivalent, et en cas de doute demande-moi.

---

## Partie A : le relais des réponses (Cloudflare, 5 minutes)

1. Va sur https://dash.cloudflare.com → le domaine **solarcar37.fr** → **Email** → **Email Routing**.
2. Onglet **Paramètres** (Settings) → **Sous-domaines** : vérifie que `reponse.solarcar37.fr` y
   figure. S'il n'y est pas, ajoute-le : Cloudflare doit afficher que ses enregistrements MX
   (route1/2/3.mx.cloudflare.net) et SPF existent déjà. **Ne touche pas au domaine principal**
   (règle 1). Le domaine principal peut apparaître comme « mal configuré » : c'est normal (ses
   e-mails vont chez OVH) et il ne faut pas le « réparer ».
3. Onglet **Règles de routage** (Routing rules) → **Créer une adresse** (Custom address) :
   - adresse : `devis`, sur le domaine **reponse.solarcar37.fr** (pas solarcar37.fr) ;
   - action : **Envoyer à un Worker** (Send to a Worker) ;
   - Worker : **solarcar37-reservation** ;
   - enregistre, et vérifie que la règle est **active**.
4. Ne crée aucune autre règle, ne change pas la règle « catch-all ».

## Partie B : l'accès Gmail (Google Cloud, 10 à 15 minutes)

### B1. Le projet Google Cloud

Va sur https://console.cloud.google.com. Le bon projet est celui qui contient le **compte de
service des agendas** de la réservation (IAM et administration → Comptes de service) et la clé
Google Maps du site. S'il y a plusieurs projets et que tu hésites, montre-les-moi.

### B2. Activer l'API Gmail

« API et services » → « Bibliothèque » → **Gmail API** → **Activer**.

### B3. L'écran de consentement (« Google Auth Platform »)

Il existe peut-être déjà (préparé pour le robot de la fiche Google). S'il existe, garde-le et
complète-le ; sinon crée-le :
- type d'utilisateurs : **Externe** ;
- nom de l'application : `SOLAR CAR 37 – Atelier` (si un nom existe déjà, garde-le) ;
- e-mail d'assistance et e-mail du développeur : contact.solarcar37@gmail.com ;
- domaines autorisés, si Google en demande : `solarcar37.fr` (et `contact-solarcar37.workers.dev`
  s'il l'accepte) ;
- **Accès aux données** (champs d'application) : ajoute
  `https://www.googleapis.com/auth/gmail.readonly` (lecture seule de Gmail) et, s'il n'y est pas
  déjà, `https://www.googleapis.com/auth/business.manage` (pour le robot de la fiche Google) ;
- **Audience** (état de publication) : **Publier l'application → En production**. Important : en
  mode « Test », Google coupe l'accès au bout de 7 jours. Google annonce qu'une validation est
  nécessaire : c'est normal pour une application à usage privé, on continue **sans** demander de
  validation (un avertissement s'affichera seulement à la connexion). Si Google **bloque** la mise
  en production, laisse en « Test », ajoute contact.solarcar37@gmail.com comme utilisateur test et
  préviens-moi.

### B4. L'identifiant OAuth

« Identifiants » (ou « Clients » dans Google Auth Platform) :
- s'il existe déjà un **ID client OAuth** de type « Application Web » pour SOLAR CAR 37 (par
  exemple « Robot fiche Google »), **modifie-le** ; sinon **crée** un ID client OAuth, type
  **Application Web**, nom `SOLAR CAR 37 – Atelier` ;
- **URI de redirection autorisés** : il doit y avoir exactement ces trois-là (ajoute ceux qui
  manquent, ne retire rien) :
  - `https://atelier.solarcar37.fr/atelier/gmail/retour`
  - `https://solarcar37-reservation.contact-solarcar37.workers.dev/atelier/gmail/retour`
  - `https://solarcar37-reservation.contact-solarcar37.workers.dev/fiche-google/retour`
- enregistre ;
- il me faut l'**ID client** et le **code secret du client**. Google n'affiche le code secret
  qu'une seule fois, à la création : si le client existait déjà et que je n'ai pas son code, clique
  sur **« Ajouter un code secret »** pour en créer un nouveau. **Ne ferme pas cette fenêtre.**

### B5. Les deux secrets dans Cloudflare

Dans un **nouvel onglet** : https://dash.cloudflare.com → « Workers et Pages » →
**solarcar37-reservation** → « Paramètres » → « Variables et secrets » → « Ajouter » :
1. type **Secret**, nom `GOOGLE_OAUTH_CLIENT_ID` : dis-moi quand le champ « Valeur » est prêt, je
   colle l'ID client moi-même ;
2. type **Secret**, nom `GOOGLE_OAUTH_CLIENT_SECRET` : pareil, je colle le code secret moi-même ;
3. enregistre / déploie. Vérifie que la liste contient les deux nouveaux secrets **en plus** des
   sept qui existaient (ne touche pas à ceux-là).

### B6. Connecter Gmail à l'espace atelier

1. Ouvre https://atelier.solarcar37.fr/atelier/devis. Si la page demande de se connecter, clique
   sur « Recevoir mon code par e-mail » et **laisse-moi taper le code moi-même**.
2. En haut de la liste des devis : **« Connecter Gmail »** (si l'encadré dit encore « À activer :
   identifiants Google à ajouter au serveur », attends une minute et recharge la page).
3. Choisis **contact.solarcar37@gmail.com**.
4. Si Google affiche « Google n'a pas validé cette application » : c'est mon application,
   clique sur « Paramètres avancés » → « Accéder à SOLAR CAR 37 – … ».
5. **Coche** l'accès en lecture à Gmail, puis « Continuer ».
6. L'espace doit afficher **« Gmail connecté (contact.solarcar37@gmail.com) »**.

## Bilan

Récapitule-moi :
- Partie A : la règle `devis@reponse.solarcar37.fr` → Worker `solarcar37-reservation` (active ?),
  et la confirmation que les MX de `solarcar37.fr` n'ont pas bougé (toujours OVH) ;
- le projet Google Cloud utilisé, l'API Gmail activée, l'état de l'écran de consentement
  (production ou test) et ses deux champs d'application ;
- l'ID client utilisé (nouveau ou existant), ses trois URI de redirection ;
- les deux secrets ajoutés dans Cloudflare ;
- ce qu'affiche l'espace atelier après « Connecter Gmail ».

Ensuite je préviens Claude Code que c'est fait : il active l'adresse de relais dans le serveur
(réglage `QUOTE_REPLY`) et vérifie le tout.
