# Réservation en ligne — architecture prévue (non activée)

Aujourd'hui le site propose une **demande** de rendez-vous : date souhaitée et moment de la journée,
facultatifs, envoyés avec la demande de devis. L'atelier confirme lui-même le créneau. Aucune
disponibilité n'est affichée et aucun agenda n'est simulé.

## Ce qu'il faudra pour une vraie réservation

| Besoin | Où le prévoir |
|---|---|
| Durée indicative par prestation (vitres, feux, detailing, ciel étoilé, phares) | `content/pricing.js`, champ `duration` par prestation, **à fournir par l'atelier** |
| Jours et horaires d'ouverture | déjà dans `content/site.js` (`openingHours`) |
| Disponibilités réelles | un agenda tenu par l'atelier (Google Agenda, Cal.com, Calendly…) : seule source de vérité |
| Créneaux proposés | calculés par le service d'agenda à partir des disponibilités et de la durée |
| Confirmation, modification, annulation | e-mails envoyés par le service d'agenda |
| Pas de double réservation | garanti par le service d'agenda (verrouillage du créneau) |
| Coordonnées client | même notice RGPD que le formulaire (à compléter avec le nouveau sous-traitant) |

## Intégration envisagée

1. L'atelier choisit un service d'agenda et y saisit ses disponibilités et les durées.
2. La page contact garde le formulaire de devis ; un bouton « Réserver un créneau » s'ajoute pour les
   prestations à durée connue (rénovation de phares, vitres, feux), en lien ou en intégration du
   service choisi, chargé seulement au clic (performance, consentement).
3. Les prestations sur devis (detailing, ciel étoilé) restent en demande de rendez-vous.

Tant que ces éléments ne sont pas fournis, le parcours reste une demande explicite.
