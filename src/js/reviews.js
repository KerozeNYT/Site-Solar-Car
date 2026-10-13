/**
 * Live Google reviews: up to 5 reviews of the Google profile (as many as Google returns),
 * newest first, fetched on every visit with the Maps JavaScript API (Places). Configured in
 * content/site.js (business.google.placeId / mapsApiKey). Reviews are shown as Google gives
 * them, with the author's name and Google's attribution; nothing is stored by the site.
 */
function loadMaps(key) {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cb = `__gm${Date.now()}`;
    window[cb] = () => resolve();
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&language=fr&region=FR&callback=${cb}`;
    s.async = true;
    s.onerror = reject;
    document.head.append(s);
  });
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const stars = (n) => {
  const r = Math.round((n || 0) * 2) / 2;
  return `<span class="stars" role="img" aria-label="${String(r).replace('.', ',')} sur 5">${[1, 2, 3, 4, 5]
    .map((i) => `<i class="${r >= i ? 'on' : r >= i - 0.5 ? 'half' : ''}"></i>`)
    .join('')}</span>`;
};

export async function showReviews(section) {
  const list = section.querySelector('[data-reviews-list]');
  await loadMaps(section.dataset.key);
  const { Place } = await window.google.maps.importLibrary('places');
  const place = new Place({ id: section.dataset.place, requestedLanguage: 'fr' });
  await place.fetchFields({ fields: ['displayName', 'rating', 'userRatingCount', 'reviews', 'googleMapsURI'] });
  const reviews = [...(place.reviews || [])].sort((a, b) => new Date(b.publishTime || 0) - new Date(a.publishTime || 0)).slice(0, 5);
  if (!reviews.length) return;
  const count = place.userRatingCount || 0;
  list.innerHTML = `
    <div class="reviews__summary">
      ${place.rating ? `<strong class="reviews__score">${String(place.rating.toFixed(1)).replace('.', ',')}</strong>${stars(place.rating)}` : ''}
      <span>${count} avis sur Google</span>
      ${place.googleMapsURI ? `<a href="${esc(place.googleMapsURI)}" target="_blank" rel="noopener">Voir tous les avis</a>` : ''}
    </div>
    <ul class="reviews__cards">${reviews
      .map((r) => {
        const a = r.authorAttribution || {};
        const name = esc(a.displayName || 'Client Google');
        const text = esc(r.text || r.originalText || '');
        return `<li class="review-card">
        <div class="review-card__head">
          ${a.photoURI ? `<img src="${esc(a.photoURI)}" alt="" width="40" height="40" loading="lazy" referrerpolicy="no-referrer">` : `<span class="review-card__initial" aria-hidden="true">${name.charAt(0)}</span>`}
          <div><strong>${a.uri ? `<a href="${esc(a.uri)}" target="_blank" rel="noopener">${name}</a>` : name}</strong><small>${esc(r.relativePublishTimeDescription || '')}</small></div>
        </div>
        ${stars(r.rating)}
        ${text ? `<p>${text}</p>` : ''}
      </li>`;
      })
      .join('')}</ul>
    <p class="reviews__attribution">Avis fournis par Google</p>`;
  list.hidden = false;
}
