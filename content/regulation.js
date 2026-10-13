/**
 * French rules quoted on the site (window film, tinted lights), kept in one place so that every
 * page, simulator and FAQ says exactly the same thing.
 *
 * Checked in October 2026 (see docs/V2-AUDIT.md for the sources); re-read the texts in force on
 * Légifrance before going live: articles R316-3 and R316-3-1 of the Code de la route, décret
 * n° 2016-448 of 13 April 2016, arrêté of 18 October 2016.
 *
 * Key point: the 70 % threshold applies to the glazing WITH its film. A film's own percentage
 * never makes a window compliant: the total is roughly glass × film (85 % × 70 % ≈ 60 %).
 */
export const glazing = {
  frontMin: 70, // % of visible light, windscreen and front side windows, film included
  since: '1er janvier 2017',
  article: 'article R316-3 du Code de la route',
  decree: 'décret n° 2016-448 du 13 avril 2016',
  fine: 135, // € (amende forfaitaire, 4e classe)
  points: 3,
  // typical factory glass, only to explain the arithmetic (never presented as a measurement)
  typicalGlass: 85,
  exemptions:
    'véhicules blindés homologués, et véhicules transportant une personne atteinte de l’une des affections listées par l’arrêté du 18 octobre 2016 (protoporphyrie érythropoïétique, porphyrie érythropoïétique congénitale, xeroderma pigmentosum)',
};

/** Rough total transmission of a film on typical factory glass (explanation only). */
export const onTypicalGlass = (filmVlt) => Math.round((filmVlt * glazing.typicalGlass) / 100);

/**
 * Road status of a film on a zone ('rear' | 'front' | 'windshield'), as shown by the simulator:
 * - ok:    allowed (rear windows have no threshold when the car has two exterior mirrors)
 * - check: may stay above the threshold on clear glass: only a measurement on the car can tell
 * - risk:  below the threshold on most factory glass (e.g. a "70 %" film)
 * - no:    below the threshold whatever the glass: visual preview only, not for public roads
 */
export function roadStatus(zone, filmVlt) {
  if (zone === 'rear') {
    return { id: 'ok', label: 'Autorisé sur route', note: 'Pas de seuil pour les vitres arrière et la lunette (véhicule équipé de deux rétroviseurs extérieurs).' };
  }
  const where = zone === 'windshield' ? 'Le pare-brise' : 'Les vitres avant';
  if (filmVlt < glazing.frontMin) {
    return {
      id: 'no',
      label: 'Visualisation esthétique',
      note: `${where} doivent laisser passer au moins ${glazing.frontMin} % de la lumière, film compris : un film à ${filmVlt} % n’est pas autorisé sur la voie publique (hors dérogations).`,
    };
  }
  const total = onTypicalGlass(filmVlt);
  if (total < glazing.frontMin) {
    return {
      id: 'risk',
      label: 'Sous le seuil dans la plupart des cas',
      note: `Le seuil de ${glazing.frontMin} % s’applique au vitrage complet : un film annoncé à ${filmVlt} % sur une vitre d’origine à ~${glazing.typicalGlass} % donne environ ${total} %. Seule une mesure sur le véhicule permet de conclure.`,
    };
  }
  return {
    id: 'check',
    label: 'Conformité à vérifier par mesure',
    note: `Avec un film aussi clair (${filmVlt} %), le vitrage peut rester au-dessus de ${glazing.frontMin} % : la transmission se vérifie sur le véhicule, film posé.`,
  };
}

/** One-paragraph reminder used under the simulator and on the service page. */
export const glazingReminder = `Depuis le ${glazing.since} (${glazing.decree}), le pare-brise et les vitres latérales avant doivent laisser passer au moins ${glazing.frontMin} % de la lumière, mesurés sur la vitre et son film ensemble. En dessous : amende de ${glazing.fine} €, retrait de ${glazing.points} points et immobilisation possible. Seules dérogations : ${glazing.exemptions}. L’accord du client ne remplace pas cette règle.`;

export const lightsRule =
  'Les feux sont des dispositifs homologués : leur couleur et leur intensité sont encadrées. Un film modifie la lumière émise et peut rendre un feu non conforme pour circuler sur la voie publique, surtout à l’avant. Le simulateur montre un rendu, il ne prouve pas la conformité.';
