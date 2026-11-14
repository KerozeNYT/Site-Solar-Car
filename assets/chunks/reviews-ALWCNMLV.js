function m(s){return window.google?.maps?.importLibrary?Promise.resolve():new Promise((a,n)=>{let r=`__gm${Date.now()}`;window[r]=()=>a();let i=document.createElement("script");i.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(s)}&v=weekly&loading=async&language=fr&region=FR&callback=${r}`,i.async=!0,i.onerror=n,document.head.append(i)})}var o=s=>String(s??"").replace(/[&<>"]/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[a]),g=s=>{let a=Math.round((s||0)*2)/2;return`<span class="stars" role="img" aria-label="${String(a).replace(".",",")} sur 5">${[1,2,3,4,5].map(n=>`<i class="${a>=n?"on":a>=n-.5?"half":""}"></i>`).join("")}</span>`};async function w(s){let a=s.querySelector("[data-reviews-list]");await m(s.dataset.key);let{Place:n}=await window.google.maps.importLibrary("places"),r=new n({id:s.dataset.place,requestedLanguage:"fr"});await r.fetchFields({fields:["displayName","rating","userRatingCount","reviews","googleMapsURI"]});let i=[...r.reviews||[]].sort((e,t)=>new Date(t.publishTime||0)-new Date(e.publishTime||0)).slice(0,5);if(!i.length)return;let u=r.userRatingCount||0,c=i.map(e=>{let t=e.authorAttribution||{},l=o(t.displayName||"Client Google"),p=o(e.text||e.originalText||"");return`<li class="review-card">
      <div class="review-card__head">
        ${t.photoURI?`<img src="${o(t.photoURI)}" alt="" width="40" height="40" loading="lazy" referrerpolicy="no-referrer" data-initial="${l.charAt(0)}">`:`<span class="review-card__initial" aria-hidden="true">${l.charAt(0)}</span>`}
        <div><strong>${t.uri?`<a href="${o(t.uri)}" target="_blank" rel="noopener">${l}</a>`:l}</strong><small>${o(e.relativePublishTimeDescription||"")}</small></div>
      </div>
      ${g(e.rating)}
      ${p?`<p>${p}</p>`:""}
    </li>`}).join("");a.innerHTML=`
    <div class="reviews__summary">
      ${r.rating?`<strong class="reviews__score">${String(r.rating.toFixed(1)).replace(".",",")}</strong>${g(r.rating)}`:""}
      <span>${u} avis sur Google</span>
      ${r.googleMapsURI?`<a href="${o(r.googleMapsURI)}" target="_blank" rel="noopener">Voir tous les avis</a>`:""}
    </div>
    <div class="reviews__band">
      <ul class="reviews__track" aria-label="Avis Google de nos clients">${c}</ul>
      <ul class="reviews__track" aria-hidden="true" inert>${c}</ul>
    </div>
    <p class="reviews__attribution">Avis fournis par Google</p>`;for(let e of a.querySelectorAll(".review-card__head img"))e.addEventListener("error",()=>{let t=document.createElement("span");t.className="review-card__initial",t.setAttribute("aria-hidden","true"),t.textContent=e.dataset.initial,e.replaceWith(t)},{once:!0});let d=a.querySelector(".reviews__band");d.addEventListener("pointerdown",e=>e.pointerType!=="mouse"&&d.classList.toggle("is-paused")),a.hidden=!1}export{w as showReviews};
