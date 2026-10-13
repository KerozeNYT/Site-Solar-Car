function d(s){return window.google?.maps?.importLibrary?Promise.resolve():new Promise((a,n)=>{let e=`__gm${Date.now()}`;window[e]=()=>a();let r=document.createElement("script");r.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(s)}&v=weekly&loading=async&language=fr&region=FR&callback=${e}`,r.async=!0,r.onerror=n,document.head.append(r)})}var o=s=>String(s??"").replace(/[&<>"]/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[a]),p=s=>{let a=Math.round((s||0)*2)/2;return`<span class="stars" role="img" aria-label="${String(a).replace(".",",")} sur 5">${[1,2,3,4,5].map(n=>`<i class="${a>=n?"on":a>=n-.5?"half":""}"></i>`).join("")}</span>`};async function u(s){let a=s.querySelector("[data-reviews-list]");await d(s.dataset.key);let{Place:n}=await window.google.maps.importLibrary("places"),e=new n({id:s.dataset.place,requestedLanguage:"fr"});await e.fetchFields({fields:["displayName","rating","userRatingCount","reviews","googleMapsURI"]});let r=[...e.reviews||[]].sort((t,i)=>new Date(i.publishTime||0)-new Date(t.publishTime||0)).slice(0,5);if(!r.length)return;let g=e.userRatingCount||0;a.innerHTML=`
    <div class="reviews__summary">
      ${e.rating?`<strong class="reviews__score">${String(e.rating.toFixed(1)).replace(".",",")}</strong>${p(e.rating)}`:""}
      <span>${g} avis sur Google</span>
      ${e.googleMapsURI?`<a href="${o(e.googleMapsURI)}" target="_blank" rel="noopener">Voir tous les avis</a>`:""}
    </div>
    <ul class="reviews__cards">${r.map(t=>{let i=t.authorAttribution||{},l=o(i.displayName||"Client Google"),c=o(t.text||t.originalText||"");return`<li class="review-card">
        <div class="review-card__head">
          ${i.photoURI?`<img src="${o(i.photoURI)}" alt="" width="40" height="40" loading="lazy" referrerpolicy="no-referrer">`:`<span class="review-card__initial" aria-hidden="true">${l.charAt(0)}</span>`}
          <div><strong>${i.uri?`<a href="${o(i.uri)}" target="_blank" rel="noopener">${l}</a>`:l}</strong><small>${o(t.relativePublishTimeDescription||"")}</small></div>
        </div>
        ${p(t.rating)}
        ${c?`<p>${c}</p>`:""}
      </li>`}).join("")}</ul>
    <p class="reviews__attribution">Avis fournis par Google</p>`,a.hidden=!1}export{u as showReviews};
