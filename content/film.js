/**
 * Home page film: a video that the scroll moves forward and back (src/js/film.js), with the
 * service chapters of content/site.js (`home.tour.chapters`) laid over it at the right moment.
 *
 * Film V5 (docs/FILM-V5.md): a one-take of the white Porsche 911 GT3 RS through the workshop,
 * generated shot by shot, joined by scripts/film/assemble.mjs into a 16:9 4K master and a 9:16
 * 1080 × 1920 master on the same timeline. `node scripts/film-assets.mjs <wide.mp4>
 * --tall=<tall.mp4>` encodes every version for scrolling (public/video/) and extracts the
 * chapter images (public/img/film/) at the `still` second of each chapter. Chapter times below
 * are seconds of that timeline (shots start at 0, 7.04, 12.54, 17.58, 22.08, 29.13, 34.13 and
 * 40.13 s): move them together, check in the browser and rebuild.
 */
export const film = {
  // length of the video (s) and second shown at the very top of the page
  duration: 46.125,
  start: 0,
  // the home page's share card (public/img/film/og.jpg, 1200×630): a second of the film, or a
  // picture file. For now the retouched last picture: the wide shot 8 shows a wrong « GT3 CAR »
  // lettering (docs/FILM-V5.md); back to a second (45) once shot 8 is generated again
  share: 'assets-src/film/final-corrige.jpg',
  // pictures per second of the film (the generated shots are 24)
  fps: 24,
  // a key frame every `gop` pictures: stepping back costs at most that many decoded pictures
  // (src/js/film-frames.js), and the <video> fallback seeks faster
  gop: 8,
  // scroll pace, in screen heights: the first `hold` keeps the opening still, then the film
  // follows the scroll at one steady rate (`rate` screens per second of film: 0.16 → about
  // 7.5 screens for the whole film). `glide` (s): with a mouse, the picture follows the wheel
  // with that lag, so it keeps moving gently a moment after the last notch and settles; under
  // the finger (phones, tablets) it follows the scroll exactly, the touch scroll having its own
  // momentum
  pace: { hold: 0.15, rate: 0.16, glide: 0.3 },
  // the light version (540p) answers the scroll within a second or two, then the sharpest version
  // the screen can show takes over once downloaded (src/js/film.js picks it from the width drawn ×
  // pixel density, and downloads it at once on computers, at the first scroll on phones): 1080p, 1440p or 4K on wide
  // screens; tall screens (phones, tablets upright) get the 9:16 film, the 720p version unless
  // the browser reports a fast connection. `crf`: encoding quality used by
  // scripts/film-assets.mjs (lower = sharper and heavier). File names carry the film version:
  // a new film never comes from a visitor's cache of the previous one.
  sources: {
    preview: '/video/accueil-v5-540p.mp4',
    wide: [
      { src: '/video/accueil-v5-1080p.mp4', w: 1920, crf: 25 },
      { src: '/video/accueil-v5-1440p.mp4', w: 2560, crf: 27 },
      { src: '/video/accueil-v5-2160p.mp4', w: 3840, crf: 29 },
    ],
    previewTall: '/video/accueil-v5-mobile-540.mp4',
    tall: [
      { src: '/video/accueil-v5-mobile-720.mp4', w: 720, h: 1280, crf: 26 },
      { src: '/video/accueil-v5-mobile-1080.mp4', w: 1080, h: 1920, crf: 26 },
    ],
  },
  // chapters in the order they appear. from / to: when the copy is on screen (s); still: the
  // second used for the chapter's image (static page, posters), `alt` its description. `tab`:
  // label of the tab in the bar under the film (none for the opening and the closing copy).
  // `readout`: a figure that follows the picture (keys [second, value]: numbers interpolated,
  // words switched halfway between two keys).
  chapters: [
    // the wash: the dusty car under the ceiling spray bar, a curtain of water, the paint shines
    { id: 'hero', from: 0, to: 5, still: 0, alt: 'Porsche 911 GT3 RS blanche poussiéreuse de trois quarts arrière sous la rampe de lavage du garage de SOLAR CAR 37, dalles noires encadrées de jaune, néons au plafond' },
    { id: 'detailing', tab: 'Detailing', from: 7.3, to: 12, still: 8.6, alt: 'Flanc de la Porsche blanche marqué SOLAR CAR : une ligne de lumière dorée sépare la peinture polie, brillante, de la partie encore terne' },
    {
      id: 'headlights',
      tab: 'Phares',
      from: 12.8,
      to: 17.2,
      still: 16.8,
      alt: 'Avant de la Porsche 911 GT3 RS blanche, phare rénové redevenu clair et allumé',
      readout: { label: 'Optique', keys: [[15, 'Avant'], [15.9, 'Après']] },
    },
    {
      id: 'covering',
      tab: 'Covering',
      from: 17.9,
      to: 21.8,
      still: 21.4,
      alt: 'Capot de la Porsche 911 GT3 RS blanche recouvert d’un film effet carbone, phare allumé',
      readout: { label: 'Capot', keys: [[19.2, 'Peinture'], [20.6, 'Carbone']] },
    },
    { id: 'tail', tab: 'Feux teintés', from: 23, to: 28.9, still: 28.6, alt: 'Arrière de la Porsche 911 GT3 RS blanche, aileron col de cygne, bandeau de feux fumé allumé' },
    {
      id: 'tint',
      tab: 'Vitres teintées',
      from: 29.5,
      to: 34,
      still: 33.6,
      alt: 'Profil arrière de la Porsche 911 GT3 RS blanche marquée SOLAR CAR : la vitre de custode est devenue noire',
      readout: { label: 'Lumière transmise à l’arrière', unit: '%', keys: [[30.4, 70], [33.2, 5]] },
    },
    { id: 'stars', tab: 'Ciel étoilé', from: 37.7, to: 41.6, still: 40, alt: 'Habitacle de la Porsche sous un ciel étoilé en fibre optique, sièges baquets au premier plan, étoiles filantes' },
    // wideStill: the retouched last picture (true SOLAR CAR lettering) until shot 8 is redone
    { id: 'final', from: 43, to: 46.125, still: 45, wideStill: 'assets-src/film/final-corrige.jpg', alt: 'Porsche 911 GT3 RS blanche de trois quarts avant dans le garage, phares allumés, capot carbone, marquage SOLAR CAR et plaque SOLAR CAR 37' },
  ],
};

/** total scroll length of the film (screen heights), as src/js/film.js lays it out */
export const filmTravel = (f = film) => {
  const p = f.pace;
  // one steady rate (film V5); the end stops 0.05 s short of the last picture, as in src/js/film.js
  if (p.rate) return p.hold + (f.duration - 0.05 - f.start) * p.rate;
  const services = f.chapters.slice(1, -1).reduce((a, c) => a + (c.scroll ?? p.chapter), 0);
  return p.hold + p.opening + services + p.closing + (f.chapters.length - 1) * p.gap;
};
