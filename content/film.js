/**
 * Home page film: a video that the scroll moves forward and back (src/js/film.js), with the
 * service chapters of content/site.js (`home.tour.chapters`) laid over it at the right moment.
 *
 * Replace the film: `node scripts/film-assets.mjs <video-1080p.mp4>` re-encodes
 * it for scrolling (public/video/) and extracts the chapter images (public/img/film/) at the
 * `still` second of each chapter. Then set `duration` and the chapter times below (seconds of
 * the video), check them in the browser and rebuild.
 */
export const film = {
  // length of the video (s) and second shown at the very top of the page (the first frames are dark)
  duration: 36,
  start: 1.6,
  // scroll pace, in screen heights: the opening holds a moment, each service gets the same
  // length whatever its duration in the video, and the film speeds through the passages in
  // between (the page stays short)
  pace: { hold: 0.45, opening: 0.45, chapter: 0.55, closing: 0.5, gap: 0.08 },
  // the light version answers the scroll within a second, the sharp one takes over once
  // downloaded; tall screens (phones, tablets upright) get the centre of the picture in 3:4
  sources: {
    preview: '/video/accueil-360p.mp4',
    desktop: '/video/accueil-1080p.mp4',
    previewPortrait: '/video/accueil-portrait-640.mp4',
    portrait: '/video/accueil-portrait.mp4',
  },
  // chapters in the order they appear. from / to: when the copy is on screen (s); still: the
  // second used for the chapter's image (static page, posters), `alt` its description. `tab`: label of the tab
  // in the bar under the film (none for the opening and the closing copy). `readout`: a figure
  // that follows the picture (keys [second, value]: numbers interpolated, words switched).
  chapters: [
    { id: 'hero', from: 0, to: 4.4, still: 3.8, alt: 'Porsche 911 GT3 RS noire de face dans le studio sombre de SOLAR CAR 37, phares allumés' },
    {
      id: 'headlights',
      tab: 'Phares',
      from: 4.8,
      to: 9.3,
      still: 8.6,
      alt: 'Gros plan sur le phare avant de la Porsche, optique redevenue claire après rénovation',
      readout: { label: 'Optique', keys: [[6.7, 'Avant'], [8.0, 'Après']] },
    },
    { id: 'detailing', tab: 'Detailing', from: 9.8, to: 14.2, still: 12.5, alt: 'Flanc de la Porsche noire : une ligne de lumière sépare la peinture polie de la partie encore terne' },
    {
      id: 'tint',
      tab: 'Vitres teintées',
      from: 14.8,
      to: 19.3,
      still: 18.6,
      alt: 'Profil de la Porsche 911 GT3 RS : vitres arrière teintées, vitre avant restée claire',
      readout: { label: 'Lumière transmise à l’arrière', unit: '%', keys: [[15.9, 70], [17.9, 5]] },
    },
    { id: 'tail', tab: 'Feux teintés', from: 19.9, to: 24.2, still: 23.6, alt: 'Arrière de la Porsche, bandeau de feux fumé allumé' },
    { id: 'stars', tab: 'Ciel étoilé', from: 25.2, to: 31.4, still: 28.8, alt: 'Habitacle de la Porsche sous un ciel étoilé en fibre optique, sièges baquets au premier plan' },
    { id: 'final', from: 32.4, to: 36, still: 34.2, alt: 'Porsche 911 GT3 RS noire de trois quarts avant dans le studio, phares allumés' },
  ],
};

/** total scroll length of the film (screen heights), as src/js/film.js lays it out */
export const filmTravel = (f = film) => {
  const p = f.pace;
  const services = f.chapters.length - 2;
  return p.hold + p.opening + services * p.chapter + p.closing + (f.chapters.length - 1) * p.gap;
};
