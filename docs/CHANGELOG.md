# Journal des changements

## V2 — en cours

### Phase 1 — Audit initial
- Audit complet : `docs/V2-AUDIT.md` (build, 32 pages, accessibilité, performance, conformité).
- Tableau de bord : `docs/V2-ROADMAP.md`.

### Phase 2 — Fiabilité commerciale et conformité
- `content/pricing.js` devient la source unique des prix : titres SEO, descriptions, FAQ, guides,
  gabarits et données structurées lisent `priceText` (plus aucun prix recopié en dur).
- Prix en attente de validation (`validated: false`) jamais affichés : PPF teinté, fourchettes
  ciel étoilé et detailing préparées mais remplacées par « sur devis ».
- `content/regulation.js` : seuil de 70 % (vitrage + film), sanctions, dérogations exactes (véhicules
  blindés homologués, 3 affections listées par l'arrêté du 18 octobre 2016), règle des feux.
- Simulateur de vitres : statut routier sous chaque zone (autorisé, conformité à vérifier, sous le
  seuil dans la plupart des cas, visualisation esthétique) ; plus de « film 70 % conforme » ; la case
  « j'en accepte la responsabilité » est retirée (l'accord du client ne remplace pas la règle) ;
  la demande de devis transmet le statut de chaque zone.
- Simulateur de feux : choix covering / PPF teinté, avec description factuelle de chaque matériau.
- Allégations retirées ou corrigées : « films homologués », « le film protège l'optique »,
  « protection céramique longue durée », dépose du film avant contrôle technique.
- Mentions légales : section tarifs (indicatifs), médiation de la consommation (à compléter),
  notice RGPD complète (finalité, base légale, destinataires et transfert hors UE, durée, droits, CNIL).
