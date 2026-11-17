# Espace atelier — plan de la refonte (17 novembre 2026)

Demande de l'atelier : un espace vivant, immersif, moderne et pratique, au décor du site, où tout
se met à jour seul (Gmail, agenda, paiements), pour ne plus avoir à réfléchir. Suivi phase par
phase ; chaque phase est mise en ligne dès qu'elle est prête.

| Phase | Contenu | État |
|---|---|---|
| 1. Décor, accueil vivant, suivi des devis | Garage animé du site, barre latérale / dock, « + Nouveau », accueil (RDV en cours, 5 cases, à traiter, en direct, 7 jours, mois), mise à jour en direct et notifications, statuts Nouveau → Devis envoyé → Réponse reçue → Validé, « à relancer » 7 j, « Sans suite » 14 j avec retour automatique | **Fait** (17/11/2026) |
| Logo de l'application | Icône de l'écran d'accueil propre à l'atelier (différente du CRM) | En cours : 3 propositions |
| 2. Gmail branché à fond | Lecture toutes les 10 min même espace fermé ; « E-mails à trier » (un e-mail direct d'un client devient une demande) ; relais `devis@reponse.solarcar37.fr` | À faire. **Atelier** : identifiants OAuth Google (docs/ATELIER.md, « Gmail dans l'espace ») ; règle Cloudflare Email Routing `devis@reponse.solarcar37.fr` → Worker `solarcar37-reservation` (DNS déjà en place) |
| 3. Agenda et RDV par téléphone | Vue jour / semaine (SOLAR CAR en détail, SOLAR HOME et perso en « occupé ») ; « Nouveau RDV » : fiche client complète, catalogue complet (vitres par catégorie et formule, pare-brise, feux, ligne libre), créneau libre ou saisi, e-mail + lien Stripe (acompte 30 % ou totalité, lien valable 24 h max, créneau bloqué pendant ce temps), envoi aussi par SMS / WhatsApp depuis le téléphone ; paiement → RDV confirmé dans l'agenda + e-mails | À faire |
| 4. Le jour J | Carte « En cours » ; attestation de pose des vitres teintées (film, référence, % par vitre) ; information et décharge feux teintés signée au doigt (pas de « certificat de conformité » pour des feux teintés : le site dit lui-même qu'un film peut les rendre non conformes) ; photos avant / après ; « Terminé » : encaissement, facture PDF numérotée (mention TVA art. 293 B), remerciement | À faire. **Atelier** : modèles actuels des documents s'il y en a, films posés (marques, références) |
| 5. Clients | Import Excel (fichier ou copier-coller, aperçu), cases à cocher pour supprimer plusieurs clients, ajout rapide, export | À faire |
| 6. Promos et e-mails | Code cadeau 100 % en 2 clics (RDV à 0 € confirmé sans Stripe) ; campagnes e-mail aux clients (modèles, destinataires filtrés, essai, désinscription en un clic) par Resend, déjà branché | À faire |
| 7. Idées | Notifications sur le téléphone même espace fermé (Web Push), recherche globale (nom, téléphone, plaque), photos de fin de RDV vers les réalisations et la fiche Google | À proposer |

Facturation électronique : réception obligatoire depuis le 1er septembre 2026, émission et
e-reporting au 1er septembre 2027 (docs/ATELIER.md, « Pour la gestion 2027 ») : les factures de
l'espace (phase 4) seront à relier à une plateforme agréée d'ici là.
