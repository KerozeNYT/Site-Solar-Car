/**
 * Home page film: a video that the scroll moves forward and back (src/js/film.js), with the
 * service chapters of content/site.js (`home.tour.chapters`) laid over it at the right moment.
 *
 * Replace the film: `node scripts/film-assets.mjs <video-1080p.mp4> [video-720p.mp4]` re-encodes
 * it for scrolling (public/video/) and extracts the chapter images (public/img/film/) at the
 * `still` second of each chapter. Then set `duration` and the chapter times below (seconds of
 * the video), check them in the browser and rebuild.
 */
export const film = {
  // length of the video (s) and second shown at the very top of the page (the first frames are dark)
  duration: 30,
  start: 1.6,
  // scroll pace, in screen heights: the opening holds a moment, each service gets the same
  // length whatever its duration in the video, and the film speeds through the passages in
  // between (the page stays short)
  pace: { hold: 0.45, opening: 0.45, chapter: 0.55, closing: 0.5, gap: 0.08 },
  // the light version answers the scroll within a second, the sharp one (phone or computer)
  // takes over once downloaded
  sources: {
    preview: '/video/accueil-360p.mp4',
    mobile: '/video/accueil-720p.mp4',
    desktop: '/video/accueil-900p.mp4',
  },
  // chapters in the order they appear. from / to: when the copy is on screen (s); still: the
  // second used for the chapter's image (static page, posters), `alt` its description. `tab`: label of the tab
  // in the bar under the film (none for the opening and the closing copy).
  chapters: [
    { id: 'hero', from: 0, to: 3.0, still: 2.4, alt: 'Porsche 911 GT3 RS noire dans le studio sombre de SOLAR CAR 37, feux de jour allumés, entre fumée et néons' },
    { id: 'headlights', tab: 'Phares', from: 3.3, to: 5.8, still: 4.2, alt: 'Face avant de la Porsche noire, phares et feux de jour allumés' },
    { id: 'detailing', tab: 'Detailing', from: 6.0, to: 8.1, still: 7.4, alt: 'Trois-quarts avant de la Porsche noire : reflets des néons sur la peinture lustrée' },
    { id: 'tint', tab: 'Vitres teintées', from: 8.4, to: 11.0, still: 9.6, alt: 'Profil de la Porsche noire aux vitres sombres, jantes cuivre et bande orange' },
    { id: 'tail', tab: 'Feux teintés', from: 11.4, to: 15.3, still: 14.2, alt: 'Arrière de la Porsche avec son bandeau de feux rouges allumé' },
    { id: 'covering', tab: 'Covering', from: 15.6, to: 17.6, still: 16.4, alt: 'Gros plan sur la carrosserie noire et la ligne de toit de la Porsche' },
    { id: 'stars', tab: 'Ciel étoilé', from: 18.3, to: 23.6, still: 20.4, alt: 'Habitacle de la Porsche illuminé par un ciel étoilé en fibre optique' },
    { id: 'final', from: 24.8, to: 30, still: 26.5, alt: 'Profil de la Porsche noire dans le studio, néons verticaux et fumée' },
  ],
};

/** total scroll length of the film (screen heights), as src/js/film.js lays it out */
export const filmTravel = (f = film) => {
  const p = f.pace;
  const services = f.chapters.length - 2;
  return p.hold + p.opening + services * p.chapter + p.closing + (f.chapters.length - 1) * p.gap;
};
