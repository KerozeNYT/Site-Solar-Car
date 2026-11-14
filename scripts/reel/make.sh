#!/usr/bin/env bash
# Réel « notre nouveau site » (Instagram, TikTok, Facebook, LinkedIn) : 1080 × 1920, 30 i/s.
#
#   bash scripts/reel/make.sh          → .cache/reel/final/ (MP4 avec musique, sans musique, couverture)
#   SKIP_CAPTURE=1 bash scripts/reel/make.sh   (garde les captures déjà faites, refait le montage)
#
# 1. le site est construit avec le serveur de réservation local (agendas en mémoire, paiement
#    simulé : aucun vrai rendez-vous), servi sur :4190 ;
# 2. capture.cjs filme le site sur un téléphone (390 × 760, ×2) image par image : accueil et film,
#    simulateur 3D des vitres, réservation ;
# 3. compose.html + render.cjs montent le réel (accroche sur le film, téléphone, écran final) ;
# 4. audio.py compose la musique et les bruitages (synthèse, aucun droit à payer), ffmpeg encode.
#
# Prérequis : npm install, Playwright avec Chromium, ffmpeg, Python 3 avec numpy.
set -euo pipefail
cd "$(dirname "$0")/../.."
REPO=$PWD
HERE=$REPO/scripts/reel
WORK=${WORK:-$REPO/.cache/reel}
mkdir -p "$WORK/assets" "$WORK/final"

if [ -z "${SKIP_CAPTURE:-}" ]; then
  BOOKING_API=http://localhost:8787 node scripts/build.mjs >/dev/null
  rm -rf "$WORK/site" && cp -r dist "$WORK/site"
  node scripts/build.mjs >/dev/null # dist/ back to the real booking server
  node booking/dev-server.mjs >/dev/null 2>&1 &
  BOOK=$!
  node scripts/serve.mjs "$WORK/site" 4190 >/dev/null 2>&1 &
  SERVE=$!
  trap 'kill $BOOK $SERVE 2>/dev/null || true' EXIT
  sleep 1
  node "$HERE/capture.cjs" "$WORK/cap"
fi

# film pictures (the vertical home film), fonts and logos of the site
V=public/video/accueil-v5-mobile-1080.mp4
if [ ! -d "$WORK/film-blur" ]; then
  mkdir -p "$WORK/film-sharp" "$WORK/film-blur"
  ffmpeg -v error -y -i "$V" -t 8 -q:v 2 -start_number 0 "$WORK/film-sharp/f%04d.jpg"
  ffmpeg -v error -y -ss 6 -i "$V" -t 26 -vf "scale=360:640,gblur=sigma=9,eq=brightness=-0.04:saturation=1.1" -q:v 3 -start_number 0 "$WORK/film-blur/f%04d.jpg"
fi
cp node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2 \
   node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2 \
   node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2 \
   public/img/brand/logo-officiel-clair-480.webp public/img/film/final-tall-1080.webp "$WORK/assets/"
cp "$HERE/compose.html" "$WORK/"

rm -rf "$WORK/out"
WORK="$WORK" node "$HERE/render.cjs" cap "$WORK/out"
python3 "$HERE/audio.py" "$WORK/out/timeline.json" "$WORK/final/music.wav" "$WORK/final/sfx.wav"

VIDEO=(-framerate 30 -i "$WORK/out/f%04d.jpg")
ENC=(-map 0:v -map 1:a -c:v libx264 -preset slow -crf 17 -maxrate 18M -bufsize 36M -pix_fmt yuv420p -profile:v high -level 4.2
     -r 30 -g 60 -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest)
ffmpeg -v error -y "${VIDEO[@]}" -i "$WORK/final/music.wav" -af "loudnorm=I=-14:TP=-1.5:LRA=11" "${ENC[@]}" \
  -metadata title="SOLAR CAR 37 — notre nouveau site" "$WORK/final/solarcar37-reel-nouveau-site.mp4"
ffmpeg -v error -y "${VIDEO[@]}" -i "$WORK/final/sfx.wav" -af "volume=-4dB" "${ENC[@]}" \
  -metadata title="SOLAR CAR 37 — notre nouveau site (sans musique)" "$WORK/final/solarcar37-reel-sans-musique.mp4"
cp "$WORK/out/f0048.jpg" "$WORK/final/solarcar37-reel-couverture.jpg"
ls -la "$WORK/final"
