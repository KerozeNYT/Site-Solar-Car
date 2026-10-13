/**
 * Latest Instagram posts, newest first, from a JSON feed set in content/site.js
 * (business.instagramFeed.feedUrl): a Behold feed ({ posts: [...] }) or a JSON shaped like the
 * Instagram API answer ({ data: [...] }). Images come from the feed's servers; each tile opens
 * the post on Instagram. Nothing is stored by the site.
 */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const https = (u) => typeof u === 'string' && u.startsWith('https://');

function normalise(json) {
  const list = Array.isArray(json) ? json : json?.posts || json?.data || [];
  return list
    .map((p) => {
      const type = p.mediaType || p.media_type || 'IMAGE';
      const sizes = p.sizes || {};
      const still = type === 'VIDEO' ? p.thumbnailUrl || p.thumbnail_url : p.mediaUrl || p.media_url;
      return {
        img: sizes.medium?.mediaUrl || sizes.small?.mediaUrl || still || p.thumbnailUrl || p.thumbnail_url,
        link: p.permalink,
        type,
        caption: (p.prunedCaption || p.caption || '').trim(),
        time: p.timestamp ? new Date(p.timestamp) : null,
      };
    })
    .filter((p) => https(p.img) && https(p.link));
}

export async function showInstagram(section) {
  const list = section.querySelector('[data-insta-list]');
  const res = await fetch(section.dataset.insta, { credentials: 'omit' });
  if (!res.ok) throw new Error(`feed ${res.status}`);
  const posts = normalise(await res.json())
    .sort((a, b) => (b.time || 0) - (a.time || 0))
    .slice(0, Number(section.dataset.count) || 5);
  if (!posts.length) throw new Error('empty feed');
  const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  list.innerHTML = posts
    .map((p) => {
      const when = p.time && !Number.isNaN(+p.time) ? day.format(p.time) : '';
      const short = p.caption.length > 140 ? `${p.caption.slice(0, 137).trimEnd()}…` : p.caption;
      const alt = short || `Publication Instagram${when ? ` du ${when}` : ''}`;
      const badge = p.type === 'VIDEO' ? 'Vidéo' : p.type === 'CAROUSEL_ALBUM' ? 'Album' : '';
      return `<li class="insta__item"><a href="${esc(p.link)}" target="_blank" rel="noopener">
        <img src="${esc(p.img)}" alt="${esc(alt)}" width="400" height="400" loading="lazy" decoding="async" referrerpolicy="no-referrer">
        ${badge ? `<span class="insta__badge">${badge}</span>` : ''}
        <span class="insta__caption">${when ? `<small>${esc(when)}</small>` : ''}${esc(short)}</span>
      </a></li>`;
    })
    .join('');
  list.removeAttribute('aria-busy');
}
