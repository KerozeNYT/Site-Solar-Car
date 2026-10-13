/**
 * The SOLAR CAR 37 plate cover, drawn on a canvas at 2 px per millimetre (520 × 110 mm plate):
 * shared by the 3D cars (src/js/tour/car-model.js) and the photo retouching script
 * (scripts/photos.mjs), so the plate looks the same everywhere.
 */
export const PLATE_PX = { w: 1040, h: 220 };

export const PLATE_TEXT = { text: 'SOLAR CAR 37', sub: 'VITRES TEINTÉES · DETAILING · VOUVRAY' };

/** load the gold emblem drawn on the left of the plate (null if it cannot load) */
export function loadEmblem(src = '/img/brand/embleme-256.webp') {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

/** draw the plate on a new canvas and return it */
export function drawPlate({ emblem = null, text = PLATE_TEXT.text, sub = PLATE_TEXT.sub } = {}) {
  const { w: W, h: H } = PLATE_PX;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const round = (x, y0, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y0);
    g.arcTo(x + w, y0, x + w, y0 + h, r);
    g.arcTo(x + w, y0 + h, x, y0 + h, r);
    g.arcTo(x, y0 + h, x, y0, r);
    g.arcTo(x, y0, x + w, y0, r);
    g.closePath();
  };
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#13234a');
  bg.addColorStop(1, '#070f22');
  round(0, 0, W, H, 22);
  g.fillStyle = bg;
  g.fill();
  const gold = g.createLinearGradient(0, 0, W, H);
  gold.addColorStop(0, '#e5b445');
  gold.addColorStop(0.3, '#a8691f');
  gold.addColorStop(0.55, '#f1da93');
  gold.addColorStop(0.8, '#b9792a');
  gold.addColorStop(1, '#e9c56c');
  round(9, 9, W - 18, H - 18, 16);
  g.lineWidth = 6;
  g.strokeStyle = gold;
  g.stroke();
  if (emblem) g.drawImage(emblem, 34, 28, 164, 164);
  g.textBaseline = 'alphabetic';
  g.fillStyle = gold;
  g.font = '800 96px Archivo, "Arial Black", Arial, sans-serif';
  g.fillText(text, 226, 128, W - 260);
  g.fillStyle = '#e9edf5';
  g.font = '600 27px Archivo, Arial, sans-serif';
  g.fillText(sub.split('').join(String.fromCharCode(8202)), 230, 178, W - 270);
  return c;
}
