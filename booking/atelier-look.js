/**
 * The look of the workshop's space (booking/atelier.js): its style sheet and its one script,
 * served at /atelier/app.css and /atelier/app.js (cached for a year, the address carries their
 * fingerprint).
 *
 * The site's night garage under every page, as on www.solarcar37.fr (src/js/ambient.js): ceiling
 * tubes in perspective, their reflection on the wet floor, slow smoke, dust in the light, a light
 * that sweeps the room; the tubes take the colours of the site's seasonal look (content/themes.js).
 * Over it, smoked glass panels, gold and ivory, Geist and Instrument Serif.
 *
 * The script (progressive: every page works without it):
 *   - draws the garage (canvases, at idle time, never before the page is shown)
 *   - counts the figures up, keeps « il y a 5 min » and the progress of the appointment of the
 *     moment up to date
 *   - keeps the space live: /atelier/live every 30 s while the page is in sight (the badges, the
 *     page itself redrawn when something changed, unless something is being typed), and a toast
 *     for what just happened (a quote request, a client's message, a paid booking)
 * Written without template literals: it is itself held in one (String.raw).
 */

export const CSS = String.raw`@font-face{font-family:'Geist';src:url('/stats/f/geist.woff2') format('woff2-variations');font-weight:100 900;font-display:swap}
@font-face{font-family:'Geist Mono';src:url('/stats/f/geist-mono.woff2') format('woff2-variations');font-weight:100 900;font-display:swap}
@font-face{font-family:'Instrument Serif';src:url('/stats/f/serif.woff2') format('woff2');font-style:italic;font-weight:400;font-display:swap}
:root{color-scheme:dark;
  --bg:#050608;--glass:rgba(16,17,22,.58);--glass-2:rgba(24,25,31,.74);--line:rgba(255,255,255,.075);--line-2:rgba(255,255,255,.14);
  --gold:#e3c27a;--gold-2:#f1dca2;--gold-rgb:227,194,122;--gold-soft:rgba(227,194,122,.12);
  --text:#f3f0ea;--text-2:#c9c5bc;--dim:#8f8b83;
  --ok:#7fd49b;--err:#ff8a7a;--blue:#8fb8ff;--violet:#c7a8ff;--amber:#ffb067;--teal:#7fd8d2;
  --tube-rgb:236,242,255;--tube-rgb-2:236,242,255;
  --font:'Geist',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--serif:'Instrument Serif',Georgia,serif;--mono:'Geist Mono',ui-monospace,Menlo,Consolas,monospace;
  --ease:cubic-bezier(.2,.75,.2,1);--r:22px;--rail:250px}
/* the site's seasonal looks: the tubes of the garage take their colours */
html[data-saison=neon]{--tube-rgb:255,92,190;--tube-rgb-2:82,240,255}
html[data-saison=noel]{--tube-rgb:255,228,190;--tube-rgb-2:255,120,120}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;background:var(--bg)}
body{margin:0;background:transparent;color:var(--text);font:15px/1.5 var(--font);-webkit-font-smoothing:antialiased;min-height:100vh;font-variant-numeric:tabular-nums}
a{color:var(--gold-2)}
::selection{background:rgba(var(--gold-rgb),.35)}
[hidden]{display:none!important}

/* ---------------------------------------------------------------- the garage */
.amb{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;contain:strict;
  background:radial-gradient(120% 60% at 50% -8%,rgba(150,160,180,.11),transparent 62%),radial-gradient(80% 50% at 50% 112%,rgba(var(--gold-rgb),.09),transparent 70%),radial-gradient(48% 38% at 6% 0,rgba(var(--gold-rgb),.08),transparent 70%),var(--bg)}
.amb__room{position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity 1.6s ease}
.amb.is-on .amb__room{opacity:.46}
.amb.is-live .amb__room{animation:amb-tubes 7s ease-in-out infinite alternate}
.amb__haze{position:absolute;inset:0;opacity:0;transition:opacity 3s ease}
.amb.is-on .amb__haze{opacity:1}
.amb__smoke{position:absolute;left:-30%;top:0;width:160%;height:100%;opacity:.3;transform:translate3d(-7%,3%,0) scale(1.05)}
.amb__smoke--b{opacity:.22;transform:scaleX(-1) translate3d(-6%,-2%,0) scale(1.12)}
.amb.is-live .amb__smoke{animation:amb-smoke-a 26s ease-in-out infinite alternate,amb-breathe 9s ease-in-out infinite alternate}
.amb.is-live .amb__smoke--b{animation:amb-smoke-b 34s ease-in-out infinite alternate,amb-breathe 12s ease-in-out -4s infinite alternate}
.amb__dust{position:absolute;left:0;top:0;width:100%;height:200%;opacity:0;transition:opacity 2s ease}
.amb.is-live .amb__dust{opacity:.75;animation:amb-dust 46s linear infinite}
.amb__sweep{position:absolute;inset:-10% -70%;background:linear-gradient(102deg,transparent 44%,rgba(255,248,232,.045) 50%,transparent 56%);transform:translate3d(-60%,0,0);animation:amb-sweep 18s ease-in-out 4s infinite}
.amb__veil{position:absolute;inset:0;background:radial-gradient(120% 95% at 50% 38%,transparent 48%,rgba(0,0,0,.6)),linear-gradient(180deg,rgba(5,6,8,0) 55%,rgba(5,6,8,.55))}
@keyframes amb-tubes{from{opacity:.36}to{opacity:.5}}
@keyframes amb-breathe{from{opacity:.18}to{opacity:.38}}
@keyframes amb-smoke-a{from{transform:translate3d(-11%,4%,0) scale(1.05)}to{transform:translate3d(11%,-4%,0) scale(1.22)}}
@keyframes amb-smoke-b{from{transform:scaleX(-1) translate3d(-10%,-3%,0) scale(1.16)}to{transform:scaleX(-1) translate3d(12%,5%,0) scale(1.02)}}
@keyframes amb-dust{to{transform:translate3d(0,-50%,0)}}
@keyframes amb-sweep{0%{transform:translate3d(-60%,0,0)}55%,100%{transform:translate3d(60%,0,0)}}

/* ---------------------------------------------------------------- the frame: a rail on a wide screen, a dock on a phone */
.shell{display:grid;grid-template-columns:var(--rail) minmax(0,1fr);min-height:100vh}
.rail{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;gap:4px;padding:22px 16px 18px;border-right:1px solid var(--line);background:linear-gradient(180deg,rgba(9,10,13,.78),rgba(9,10,13,.55));-webkit-backdrop-filter:blur(20px) saturate(1.2);backdrop-filter:blur(20px) saturate(1.2);z-index:5}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--text);flex:none}
.brand img{height:42px;width:auto;display:block}
.brand__tag{font:italic 400 24px/1 var(--serif);color:var(--gold);padding-left:12px;border-left:1px solid var(--line-2)}
.rail .brand{padding:2px 8px 18px;margin-bottom:6px;border-bottom:1px solid var(--line)}
.nav{display:grid;gap:2px}
.nav a{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:14px;color:var(--text-2);text-decoration:none;font-weight:600;font-size:14.5px;position:relative;transition:background .25s,color .25s}
.nav a:hover{background:rgba(255,255,255,.045);color:var(--text)}
.nav a[aria-current]{color:var(--gold-2);background:linear-gradient(90deg,rgba(var(--gold-rgb),.17),rgba(var(--gold-rgb),.03));box-shadow:inset 0 0 0 1px rgba(var(--gold-rgb),.2)}
.nav a[aria-current]::before{content:'';position:absolute;left:-16px;top:9px;bottom:9px;width:3px;border-radius:0 3px 3px 0;background:var(--gold);box-shadow:0 0 14px rgba(var(--gold-rgb),.9)}
.nav a[aria-current] .ico{stroke:var(--gold)}
.nav .badge{margin-left:auto}
.nav__sep{height:1px;background:var(--line);margin:10px 8px}
.rail__foot{margin-top:auto;display:grid;gap:12px;padding-top:14px}
.rail__foot .out{justify-self:start}
.live{display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--dim);white-space:nowrap}
.live i{width:8px;height:8px;border-radius:50%;background:var(--ok);flex:none;box-shadow:0 0 0 0 rgba(127,212,155,.55);animation:ping 2.6s ease-out infinite}
.live.is-off i{background:var(--dim);animation:none}
@keyframes ping{0%{box-shadow:0 0 0 0 rgba(127,212,155,.55)}70%,100%{box-shadow:0 0 0 9px rgba(127,212,155,0)}}
.ico{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.badge{min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:linear-gradient(180deg,var(--gold-2),var(--gold));color:#0a0a0b;font-size:11.5px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 0 16px -2px rgba(var(--gold-rgb),.75)}
.out{color:var(--dim);display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:12px;text-decoration:none;font-size:13px;font-weight:600}
.out:hover{color:var(--text);background:rgba(255,255,255,.05)}
/* « + Nouveau »: a menu that works without the script */
.pop{position:relative}
.pop>summary{list-style:none;cursor:pointer}.pop>summary::-webkit-details-marker{display:none}
.pop__menu{position:absolute;z-index:30;min-width:240px;padding:8px;border-radius:18px;background:rgba(18,19,24,.96);border:1px solid var(--line-2);box-shadow:0 30px 80px -20px rgba(0,0,0,.9),0 0 0 1px rgba(0,0,0,.4);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);animation:pop-in .22s var(--ease)}
.rail .pop__menu{left:0;right:0;bottom:calc(100% + 8px)}
.top .pop__menu{right:0;top:calc(100% + 10px)}
.pop__menu a{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:12px;color:var(--text);text-decoration:none;font-weight:600;font-size:14px}
.pop__menu a:hover{background:rgba(var(--gold-rgb),.1);color:var(--gold-2)}
.pop__menu a small{display:block;color:var(--dim);font-weight:500;font-size:12px}
.pop__menu .soon{opacity:.45;pointer-events:none}
@keyframes pop-in{from{opacity:0;transform:translateY(6px) scale(.98)}}
.newbtn{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;padding:12px 16px;border-radius:999px;font-weight:700;color:#0a0a0b;background:linear-gradient(180deg,var(--gold-2),var(--gold));box-shadow:0 10px 30px -12px rgba(var(--gold-rgb),.9),inset 0 1px 0 rgba(255,255,255,.5)}
.newbtn .ico{stroke-width:2.2}
.top,.dock{display:none}
main{width:100%;max-width:1240px;margin:0 auto;padding:30px clamp(18px,3vw,44px) 80px;min-width:0}
main>*{animation:rise .7s var(--ease) both}
main>:nth-child(2){animation-delay:.04s}main>:nth-child(3){animation-delay:.08s}main>:nth-child(4){animation-delay:.12s}main>:nth-child(5){animation-delay:.16s}main>:nth-child(6){animation-delay:.2s}main>:nth-child(n+7){animation-delay:.24s}
.no-rise main>*{animation:none}
@keyframes rise{from{opacity:0;transform:translate3d(0,14px,0)}}

@media (max-width:1000px){
  .shell{display:block}
  .rail{display:none}
  .top{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:12px;padding:10px 14px;padding-top:max(10px,env(safe-area-inset-top));background:rgba(7,8,10,.72);-webkit-backdrop-filter:blur(16px) saturate(1.2);backdrop-filter:blur(16px) saturate(1.2);border-bottom:1px solid var(--line)}
  .top .brand img{height:30px}.top .brand__tag{font-size:19px;padding-left:10px}
  .top .live{margin-left:auto}.top .live span{display:none}
  .top .newbtn{width:40px;height:40px;padding:0;border-radius:50%}
  .top .newbtn span{display:none}
  main{padding:20px 16px calc(100px + env(safe-area-inset-bottom))}
  .dock{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:20;display:grid;grid-template-columns:repeat(5,1fr);padding:6px;border-radius:24px;background:rgba(12,13,17,.82);-webkit-backdrop-filter:blur(20px) saturate(1.3);backdrop-filter:blur(20px) saturate(1.3);border:1px solid var(--line-2);box-shadow:0 20px 50px -18px rgba(0,0,0,.95)}
  .dock a{display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 0 5px;color:var(--dim);text-decoration:none;font-size:10.5px;font-weight:650;position:relative;border-radius:18px;transition:color .2s,background .2s}
  .dock a[aria-current]{color:var(--gold-2);background:rgba(var(--gold-rgb),.1)}
  .dock a[aria-current] .ico{stroke:var(--gold)}
  .dock .badge{position:absolute;top:1px;left:calc(50% + 4px);min-width:18px;height:18px;font-size:10.5px}
}

/* ---------------------------------------------------------------- type */
h1{font-size:clamp(28px,3.4vw,38px);line-height:1.12;font-weight:650;letter-spacing:-.02em;margin:2px 0 10px}
h1 em,h2 em,.serif{font:italic 400 1.14em/1 var(--serif);color:var(--gold);letter-spacing:0}
h2{font-size:16.5px;margin:0 0 14px;font-weight:650;display:flex;align-items:center;gap:9px;flex-wrap:wrap;letter-spacing:-.005em}
h2 .ico{color:var(--gold)}
h3{font-size:11px;margin:26px 0 12px;color:var(--dim);font-weight:700;letter-spacing:.16em;text-transform:uppercase;display:flex;align-items:center;gap:10px}
h3::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,var(--line-2),transparent)}
.lead{color:var(--text-2);margin:0 0 24px;max-width:72ch}
.dim{color:var(--dim);font-size:12.5px}.empty{color:var(--dim)}
.right{margin-left:auto;font-size:13px;font-weight:600}
.err{color:var(--err)}

/* ---------------------------------------------------------------- panels */
.card{position:relative;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.012)),var(--glass);border:1px solid var(--line);border-radius:var(--r);padding:22px;margin:0 0 18px;-webkit-backdrop-filter:blur(18px) saturate(1.25);backdrop-filter:blur(18px) saturate(1.25);box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 30px 60px -45px rgba(0,0,0,.95)}
.grid{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));margin:0 0 18px}.grid>.card{margin:0}
.figs{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:0 0 18px}
.fig{position:relative;display:block;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.012)),var(--glass);border:1px solid var(--line);border-radius:20px;padding:16px 18px;text-decoration:none;color:inherit;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);transition:transform .35s var(--ease),border-color .3s}
.fig b{display:block;font-size:28px;font-weight:650;color:var(--gold-2);line-height:1.2;letter-spacing:-.02em}
.fig span{color:var(--dim);font-size:13px}
a.fig:hover{border-color:rgba(var(--gold-rgb),.45);transform:translateY(-2px)}
.fig--hot{border-color:rgba(var(--gold-rgb),.5);box-shadow:0 14px 34px -22px rgba(var(--gold-rgb),.8)}

/* ---------------------------------------------------------------- forms and buttons */
label{display:block;font-size:13px;color:var(--dim);margin:0 0 6px}
input,select,textarea{width:100%;padding:12px 14px;border-radius:14px;border:1px solid var(--line-2);background:rgba(0,0,0,.38);color:var(--text);font:inherit;margin:0 0 12px;transition:border-color .2s,background .2s}
input:hover,select:hover,textarea:hover{border-color:rgba(255,255,255,.22)}
input:focus,select:focus,textarea:focus{outline:2px solid rgba(var(--gold-rgb),.55);outline-offset:1px;border-color:transparent;background:rgba(0,0,0,.5)}
input[type=file]{padding:8px;font-size:13px;color:var(--text-2)}
input[type=file]::file-selector-button{font:inherit;font-weight:700;border:0;border-radius:999px;padding:7px 13px;margin-right:10px;background:var(--gold-soft);color:var(--gold-2);box-shadow:inset 0 0 0 1px rgba(var(--gold-rgb),.45);cursor:pointer}
textarea{min-height:110px;resize:vertical;line-height:1.55}
.row{display:grid;gap:0 14px;grid-template-columns:repeat(2,minmax(0,1fr))}.row3{display:grid;gap:0 14px;grid-template-columns:repeat(3,minmax(0,1fr))}
.checks{display:flex;gap:14px;flex-wrap:wrap;margin:0 0 14px}.checks label{display:flex;gap:9px;align-items:center;color:var(--text);margin:0;font-size:14px}.checks input{width:18px;height:18px;margin:0;accent-color:var(--gold)}
.btns{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
button,.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:999px;padding:11px 20px;font:inherit;font-weight:700;cursor:pointer;background:linear-gradient(180deg,var(--gold-2),var(--gold));color:#0a0a0b;text-decoration:none;box-shadow:0 10px 26px -14px rgba(var(--gold-rgb),.85),inset 0 1px 0 rgba(255,255,255,.45);transition:transform .2s var(--ease),filter .2s,box-shadow .2s}
button:hover,.btn:hover{filter:brightness(1.07);transform:translateY(-1px)}
button:active,.btn:active{transform:translateY(0) scale(.98)}
button .ico,.btn .ico{width:18px;height:18px}
button.ghost,.btn.ghost{background:rgba(255,255,255,.02);color:var(--gold-2);box-shadow:inset 0 0 0 1px rgba(var(--gold-rgb),.42)}
button.ghost:hover,.btn.ghost:hover{background:rgba(var(--gold-rgb),.08)}
button.danger{background:transparent;color:var(--err);box-shadow:inset 0 0 0 1px var(--err)}
button.small,.btn.small{padding:7px 14px;font-size:13px}
.danger-link{cursor:pointer;color:var(--err);font-weight:600;list-style:none;display:inline-flex;align-items:center;gap:8px}.danger-link::-webkit-details-marker{display:none}details[open] .danger-link{margin-bottom:8px}
.gmail p{margin:0 0 6px}.gmail p b{display:inline-flex;align-items:center;gap:8px}.gmail .btns form{margin:0}
.msg{display:flex;align-items:center;gap:10px;padding:13px 16px;border-radius:16px;margin:0 0 18px;font-weight:600;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.msg--ok{background:rgba(127,212,155,.12);color:var(--ok);border:1px solid rgba(127,212,155,.28)}
.msg--err{background:rgba(255,138,122,.1);color:var(--err);border:1px solid rgba(255,138,122,.28)}
.msg--warn{background:rgba(255,176,103,.09);color:var(--amber);border:1px solid rgba(255,176,103,.3);font-weight:500}.msg--link{background:rgba(127,216,210,.09);color:var(--teal);border:1px solid rgba(127,216,210,.28);font-weight:500}.msg--link a{color:inherit}.msg .ico{flex:none}

/* ---------------------------------------------------------------- lists and tags */
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:12px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--dim);font-size:12px;font-weight:600}
tbody tr{transition:background .2s}tbody tr:hover{background:rgba(255,255,255,.025)}
td small,.dim{color:var(--dim);font-size:12.5px}td small{display:block}
.acts td{border-top:0;padding-top:0}tr:has(+ .acts) td{border-bottom:0}.n{text-align:right;white-space:nowrap}
.code{font-family:var(--mono);letter-spacing:.06em;color:var(--gold-2);white-space:nowrap}
.tag{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;border-radius:999px;padding:3px 10px;white-space:nowrap;--c:var(--dim);color:var(--c);background:color-mix(in srgb,var(--c) 14%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--c) 22%,transparent)}
.tag--ok{--c:var(--ok)}.tag--gold{--c:var(--gold-2)}.tag--off{--c:var(--dim)}.tag--err{--c:var(--err)}.tag--new{--c:var(--blue)}.tag--reply{--c:var(--violet)}.tag--warn{--c:var(--amber)}.tag--link{--c:var(--teal)}
.tag--premium{--c:#f3d98e;background:linear-gradient(100deg,rgba(233,205,130,.22),rgba(233,205,130,.06) 60%,rgba(255,255,255,.12));letter-spacing:.08em;text-transform:uppercase;font-size:11px}
.lvl{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--c);border:1px solid color-mix(in srgb,var(--c) 55%,transparent);border-radius:999px;padding:3px 10px;box-shadow:0 0 14px color-mix(in srgb,var(--c) 30%,transparent),inset 0 0 8px color-mix(in srgb,var(--c) 18%,transparent);white-space:nowrap}
.lvl::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--c);box-shadow:0 0 8px var(--c)}
.giftdue{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;justify-content:space-between;border:1px solid color-mix(in srgb,var(--c,#e9cd82) 55%,transparent);background:color-mix(in srgb,var(--c,#e9cd82) 10%,transparent);border-radius:16px;padding:12px 14px;margin:0 0 12px}
.giftdue b{display:block}.giftdue small{color:var(--dim)}
.track{display:flex;gap:4px;margin:8px 0 2px}.track i{flex:1;height:5px;border-radius:9px;background:rgba(255,255,255,.08)}.track i.on{background:var(--c);box-shadow:0 0 10px var(--c)}
.list{list-style:none;margin:0;padding:0}.list li{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}.list li:last-child{border:0}.list a{text-decoration:none}
.band{border:1px solid rgba(var(--gold-rgb),.45);border-radius:16px;padding:12px 14px;background:rgba(0,0,0,.3);margin:0 0 12px}
.search{display:flex;gap:8px}.search input{margin:0}
.theme{display:inline-block;font-size:11px;font-weight:700;border-radius:6px;padding:1px 6px;margin-right:4px;vertical-align:1px}.theme--classique{background:var(--gold-soft);color:var(--gold-2)}.theme--noel{background:#b3121b;color:#fff}.theme--neon{background:linear-gradient(90deg,#ff2e88,#ff8a3d);color:#14001f}
.big{font:800 26px/1.2 var(--mono);letter-spacing:.12em;color:var(--gold-2)}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 18px}
.chips a{display:inline-flex;align-items:center;gap:8px;padding:8px 15px;border-radius:999px;border:1px solid var(--line-2);background:rgba(0,0,0,.25);color:var(--text-2);text-decoration:none;font-size:13.5px;font-weight:600;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);transition:border-color .2s,color .2s}
.chips a:hover{color:var(--text);border-color:rgba(255,255,255,.25)}
.chips a[aria-current]{background:var(--gold-soft);border-color:rgba(var(--gold-rgb),.5);color:var(--gold-2)}
.chips b{font-weight:700;color:var(--dim)}.chips i{width:7px;height:7px;border-radius:50%;background:var(--c,var(--dim))}

/* ---------------------------------------------------------------- the quotes */
.qlist{display:grid;gap:10px}
.q{position:relative;display:grid;grid-template-columns:auto 1fr auto;gap:2px 16px;align-items:start;padding:16px 18px 16px 20px;border-radius:20px;border:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.01)),var(--glass);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);text-decoration:none;color:inherit;overflow:hidden;transition:transform .3s var(--ease),border-color .25s}
.q::before{content:'';position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:0 3px 3px 0;background:var(--c,transparent)}
.q:hover{border-color:rgba(var(--gold-rgb),.45);transform:translateY(-1px)}
.q__n{font:italic 400 24px/1.1 var(--serif);color:var(--gold);min-width:52px}
.q__who{display:block;font-weight:650}.q__what{display:block;color:var(--text-2);font-size:13.5px}
.q__last{grid-column:2/4;color:var(--dim);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:4px}
.q__side{display:flex;flex-wrap:wrap;gap:5px 6px;justify-content:flex-end;align-items:center;text-align:right;max-width:220px}.q__side small{flex-basis:100%;color:var(--dim);font-size:12px}
.q--unread{border-color:rgba(var(--gold-rgb),.55);box-shadow:0 0 0 1px rgba(var(--gold-rgb),.16),0 16px 36px -24px rgba(var(--gold-rgb),.85)}.q--unread .q__last{color:var(--text)}
.q--nouveau{--c:var(--blue)}.q--envoye{--c:var(--gold)}.q--reponse{--c:var(--violet)}.q--lien{--c:var(--teal)}.q--valide{--c:var(--ok)}.q--sans_suite{--c:rgba(255,255,255,.18)}.q--remind{--c:var(--amber)}
.dot{width:8px;height:8px;border-radius:50%;background:var(--gold);display:inline-block;margin-right:7px;vertical-align:2px;box-shadow:0 0 10px rgba(var(--gold-rgb),.8)}
.crumb{display:inline-flex;align-items:center;gap:4px;color:var(--dim);text-decoration:none;font-size:14px;margin:0 0 12px}.crumb:hover{color:var(--text)}.crumb .ico{width:16px;height:16px}
.qhead{display:flex;flex-wrap:wrap;gap:12px 16px;align-items:center;margin:0 0 20px}.qhead h1{margin:0}.qhead .tag{font-size:13px;padding:5px 12px}
.avatar{width:46px;height:46px;flex:none;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 30% 25%,rgba(var(--gold-rgb),.35),rgba(var(--gold-rgb),.08));color:var(--gold-2);font-weight:700;border:1px solid rgba(var(--gold-rgb),.4);font-size:15px}
.avatar--s{width:36px;height:36px;font-size:12.5px}
.dgrid{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:18px;align-items:start}.dgrid>aside .card:last-child{margin:0}
.thread{display:flex;flex-direction:column;gap:14px;margin:0 0 18px}
.b{max-width:min(640px,88%);padding:13px 16px;border-radius:22px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.b--in{align-self:flex-start;background:rgba(28,29,35,.82);border:1px solid var(--line);border-bottom-left-radius:7px}
.b--out{align-self:flex-end;background:linear-gradient(180deg,rgba(241,220,162,.17),rgba(227,194,122,.08)),rgba(20,18,12,.6);border:1px solid rgba(var(--gold-rgb),.38);border-bottom-right-radius:7px}
.b__meta{display:block;font-size:12px;color:var(--dim);margin-top:8px;white-space:normal}.b--out .b__meta{text-align:right}
.note{align-self:center;max-width:92%;font-size:12.5px;color:var(--text-2);background:rgba(0,0,0,.35);border:1px solid var(--line);border-radius:999px;padding:6px 14px;text-align:center;margin:0}
.files{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;white-space:normal}.files img{width:150px;height:112px;object-fit:cover;border-radius:14px;border:1px solid var(--line-2);display:block}
.file{display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border-radius:12px;background:rgba(0,0,0,.3);border:1px solid var(--line-2);color:var(--text);text-decoration:none;font-size:13px}.file .ico{width:16px;height:16px}
.composer textarea{min-height:150px}.hint{font-size:12.5px;color:var(--dim);margin:10px 0 0}
.facts{margin:0;display:grid;gap:10px}.facts dt{font-size:12px;color:var(--dim)}.facts dd{margin:0;font-weight:600}

/* ---------------------------------------------------------------- home */
.hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:18px;align-items:stretch;margin:0 0 18px}
.hello{padding:8px 4px 0}
.hello h1{font-size:clamp(34px,4.6vw,54px);margin:0 0 6px}
.hello__date{color:var(--text-2);font-size:15px;margin:0 0 18px}
.hello__sum{display:flex;flex-wrap:wrap;gap:8px;margin:0}
.pill{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;font-size:13.5px;font-weight:650;text-decoration:none;color:var(--c,var(--text));background:color-mix(in srgb,var(--c,#fff) 11%,rgba(0,0,0,.35));border:1px solid color-mix(in srgb,var(--c,#fff) 26%,transparent);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.pill i{width:7px;height:7px;border-radius:50%;background:var(--c,var(--ok));box-shadow:0 0 10px var(--c,var(--ok))}
.pill--calm{--c:var(--ok)}
.now{display:flex;flex-direction:column;justify-content:space-between;gap:14px;margin:0;overflow:hidden}
.now::after{content:'';position:absolute;inset:auto -30% -60% auto;width:70%;aspect-ratio:1;background:radial-gradient(circle,rgba(var(--gold-rgb),.16),transparent 65%);pointer-events:none}
.now__k{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--gold)}
.now__k i{width:8px;height:8px;border-radius:50%;background:var(--gold);box-shadow:0 0 12px var(--gold);animation:ping-gold 2.4s ease-out infinite}
@keyframes ping-gold{0%{box-shadow:0 0 0 0 rgba(var(--gold-rgb),.6)}70%,100%{box-shadow:0 0 0 10px rgba(var(--gold-rgb),0)}}
.now__t{font-size:22px;font-weight:650;line-height:1.25;letter-spacing:-.01em;margin:0}
.now__t small{display:block;font-size:14px;font-weight:500;color:var(--text-2);margin-top:4px}
.now__when{display:flex;align-items:baseline;justify-content:space-between;gap:12px;color:var(--text-2);font-size:13.5px}
.now__when b{font:italic 400 30px/1 var(--serif);color:var(--gold-2)}
.bar{height:6px;border-radius:9px;background:rgba(255,255,255,.08);overflow:hidden}
.bar i{display:block;height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,var(--gold),var(--gold-2));box-shadow:0 0 16px rgba(var(--gold-rgb),.7);transition:width 1s var(--ease)}
.pipe{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:0 0 18px}
.st{position:relative;display:flex;flex-direction:column;gap:6px;padding:16px 16px 15px;border-radius:20px;text-decoration:none;color:inherit;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.01)),var(--glass);border:1px solid var(--line);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);transition:transform .35s var(--ease),border-color .3s,box-shadow .3s}
.st::before{content:'';position:absolute;inset:0 0 auto;height:2px;background:linear-gradient(90deg,transparent,var(--c),transparent);opacity:.5}
.st:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--c) 50%,transparent)}
.st__k{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:650;color:var(--text-2)}
.st__k .ico{width:17px;height:17px;color:var(--c)}
.st b{font-size:38px;line-height:1;font-weight:650;letter-spacing:-.03em;color:var(--text)}
.st small{color:var(--dim);font-size:12px;line-height:1.35}
.st--hot{border-color:color-mix(in srgb,var(--c) 45%,transparent);box-shadow:0 18px 40px -26px var(--c),inset 0 0 40px -28px var(--c)}
.st--hot b{color:var(--c);text-shadow:0 0 22px color-mix(in srgb,var(--c) 55%,transparent)}
.st--hot::after{content:'';position:absolute;top:14px;right:14px;width:8px;height:8px;border-radius:50%;background:var(--c);box-shadow:0 0 10px var(--c);animation:blink 1.8s ease-in-out infinite}
@keyframes blink{50%{opacity:.25}}
.st--new{--c:var(--blue)}.st--reply{--c:var(--violet)}.st--sent{--c:var(--gold)}.st--remind{--c:var(--amber)}.st--won{--c:var(--ok)}
.two{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:18px;margin:0 0 18px;align-items:start}.two>.card{margin:0}
.todo{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.todo a{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 12px;border-radius:16px;text-decoration:none;color:inherit;background:rgba(0,0,0,.22);border:1px solid var(--line);transition:border-color .25s,background .25s,transform .3s var(--ease)}
.todo a:hover{border-color:rgba(var(--gold-rgb),.42);background:rgba(var(--gold-rgb),.05);transform:translateX(3px)}
.todo b{display:block;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.todo span.dim{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.todo__side{display:grid;gap:5px;justify-items:end}.todo__side time{color:var(--dim);font-size:12px;white-space:nowrap}
.feed{list-style:none;margin:0;padding:0;position:relative}
.feed::before{content:'';position:absolute;left:17px;top:8px;bottom:8px;width:1px;background:linear-gradient(180deg,var(--line-2),transparent)}
.feed li{position:relative;display:grid;grid-template-columns:36px minmax(0,1fr);gap:10px;padding:7px 0}
.feed__i{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;color:var(--c);background:color-mix(in srgb,var(--c) 14%,rgba(10,11,14,.9));border:1px solid color-mix(in srgb,var(--c) 32%,transparent);position:relative;z-index:1}
.feed__i .ico{width:16px;height:16px}
.feed a{text-decoration:none;color:inherit;display:block;padding-top:1px}
.feed b{font-weight:650;font-size:14px}
.feed p{margin:1px 0 0;color:var(--text-2);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.feed time{color:var(--dim);font-size:12px}
.feed--demande{--c:var(--blue)}.feed--in{--c:var(--violet)}.feed--out{--c:var(--gold)}.feed--note{--c:var(--dim)}.feed--rdv{--c:var(--ok)}.feed--won{--c:var(--ok)}
.week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}
.day{min-height:132px;padding:12px 10px;border-radius:16px;background:rgba(0,0,0,.24);border:1px solid var(--line);display:flex;flex-direction:column;gap:6px}
.day__h{display:flex;align-items:baseline;gap:6px;font-size:12px;color:var(--dim);text-transform:capitalize;margin-bottom:2px}
.day__h b{font-size:20px;color:var(--text);font-weight:650}
.day--today{border-color:rgba(var(--gold-rgb),.5);background:linear-gradient(180deg,rgba(var(--gold-rgb),.1),rgba(0,0,0,.2))}
.day--today .day__h,.day--today .day__h b{color:var(--gold-2)}
.day--off{opacity:.55}
.ev{display:block;padding:6px 8px;border-radius:10px;font-size:12px;line-height:1.3;text-decoration:none;color:var(--text);background:rgba(143,184,255,.12);border-left:3px solid var(--blue);overflow:hidden}
.ev b{display:block;font-weight:700;font-size:11.5px;color:var(--blue)}
.ev span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ev--hold{background:repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 6px,transparent 6px 12px);border-left-color:var(--dim);color:var(--text-2)}.ev--hold b{color:var(--dim)}
.ev--online{background:rgba(var(--gold-rgb),.1);border-left-color:var(--gold)}.ev--online b{color:var(--gold-2)}
.ev--depot{background:transparent;border-left:3px dotted var(--dim);color:var(--text-2)}.ev--depot b{color:var(--dim)}
.day__none{color:rgba(255,255,255,.18);font-size:12px;margin:auto 0}
.month{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0 0 18px}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;margin:0 0 18px}
.tile{display:flex;gap:14px;align-items:flex-start;padding:18px;border-radius:20px;text-decoration:none;color:inherit;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.01)),var(--glass);border:1px solid var(--line);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);transition:transform .35s var(--ease),border-color .3s}
.tile:hover{transform:translateY(-2px);border-color:rgba(var(--gold-rgb),.45)}
.tile .ico{width:22px;height:22px;color:var(--gold);margin-top:2px}
.tile b{display:block;font-weight:650}.tile span{display:block;color:var(--dim);font-size:13px;margin-top:2px}

/* ---------------------------------------------------------------- Nouveau RDV */
.rdvgrid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:18px;align-items:start}
.rdvgrid>aside{position:sticky;top:20px}
/* a long strip of days scrolls inside its panel: it never widens the page */
.rdvgrid>*,.slotbox,.pick{min-width:0}
.rdvgrid h3{margin-top:18px}
.xrow{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.6fr) 96px 84px;gap:8px}
.xrow input,.xrow select{margin-bottom:8px}
.slots__list{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}
.slot{padding:7px 12px;font-size:13px;font-weight:650;border-radius:999px;background:rgba(0,0,0,.3);color:var(--text-2);box-shadow:inset 0 0 0 1px var(--line-2)}
.slot:hover{color:var(--text);box-shadow:inset 0 0 0 1px rgba(var(--gold-rgb),.5)}
.slot.is-on{background:linear-gradient(180deg,var(--gold-2),var(--gold));color:#0a0a0b;box-shadow:0 8px 20px -10px rgba(var(--gold-rgb),.9)}
.slots .dim{margin:0 0 10px}
.seg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 16px}
.seg label{margin:0;cursor:pointer}
.seg input{position:absolute;opacity:0;pointer-events:none}
.seg span{display:block;padding:12px 14px;border-radius:16px;border:1px solid var(--line-2);background:rgba(0,0,0,.28);transition:border-color .2s,background .2s}
.seg b{display:block;color:var(--text);font-size:14px}.seg b .ico{width:16px;height:16px;vertical-align:-3px;margin-right:3px}.seg small{color:var(--dim);font-size:12px}
.seg input:checked+span{border-color:rgba(var(--gold-rgb),.6);background:rgba(var(--gold-rgb),.1);box-shadow:inset 0 0 0 1px rgba(var(--gold-rgb),.3)}
.seg input:checked+span b{color:var(--gold-2)}
.seg input:focus-visible+span{outline:2px solid rgba(var(--gold-rgb),.6);outline-offset:2px}
.recap{list-style:none;margin:0;padding:0}
.recap li{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line);font-size:14px}
.recap li small{display:block;color:var(--dim);font-size:12px}.recap li b{white-space:nowrap}
.recap__tot,.recap__due{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding-top:12px}
.recap__tot b{font-size:24px;color:var(--gold-2);letter-spacing:-.02em}
.recap__due{color:var(--text-2);font-size:14px;padding-top:6px}.recap__due b{color:var(--text)}
.recap--edit li{align-items:center}.recap--edit li>span{flex:1}.recap--edit form{margin:0}.recap--edit button{padding:6px 9px}
.recap__left{margin-top:8px;padding:12px 14px;border-radius:14px;background:rgba(var(--gold-rgb),.08);border:1px solid rgba(var(--gold-rgb),.3)}.recap__left b{font-size:26px}
.seg--2{grid-template-columns:repeat(2,minmax(0,1fr))}
/* how the appointment was taken (three, always side by side); the payment (four) */
.seg__q{margin:0 0 8px;font-size:13px;font-weight:650;color:var(--text-2)}
.seg--4{grid-template-columns:repeat(4,minmax(0,1fr))}
/* the payment link's life, or the amount paid at the card terminal: after the payment chosen */
html.js #rdv:has([name=mode][value=tpe]:checked) .linkbox,html.js #rdv:has([name=mode][value=none]:checked) .linkbox{display:none}
html.js #rdv:not(:has([name=mode][value=tpe]:checked)) .tpebox{display:none}
/* the professionals: their cards, their logo on white */
.prolist{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr));gap:12px}
.pro{display:flex;gap:14px;align-items:center;padding:14px;border-radius:18px;border:1px solid var(--line-2);background:rgba(0,0,0,.28);color:inherit;text-decoration:none;min-width:0}
.pro:hover{border-color:rgba(var(--gold-rgb),.5)}.pro>span:last-child{min-width:0}.pro b{display:block;color:var(--text)}.pro small{display:block;color:var(--dim);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pro__logo,.avatar--logo{width:60px;height:60px;border-radius:14px;background:#fff;display:grid;place-items:center;overflow:hidden;flex:none;color:#111}
.pro__logo img,.avatar--logo img{max-width:52px;max-height:52px;object-fit:contain}
.remise.remise--btn{grid-template-columns:minmax(0,1fr) auto}.remise--btn button{white-space:nowrap;padding-left:16px;padding-right:18px;border-radius:14px}
/* the companies found by name: one to choose */
.hits{display:grid;gap:8px;margin-top:14px}.hit{text-align:left;font:inherit;font-weight:400;width:100%;cursor:pointer;display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:12px;padding:12px 14px;border-radius:14px;border:1px solid var(--line-2);background:rgba(0,0,0,.28);color:inherit;text-decoration:none}
.hit:hover{border-color:rgba(var(--gold-rgb),.55)}.hit b{grid-column:1;color:var(--text)}.hit small{grid-column:1;color:var(--dim);font-size:12px}.hit__go{grid-column:2;grid-row:1/4;align-self:center;color:var(--gold-2);font-weight:700;font-size:13px}
/* the partnership agreement and its signatures; the signature pad */
.conv h3{font-size:14px;margin:16px 0 4px;color:var(--gold-2)}.conv p{margin:0;color:var(--text-2);font-size:14px}
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}.sigs>div{background:#fff;color:#111;border-radius:14px;padding:12px;min-height:110px}.sigs img{display:block;width:100%;height:70px;object-fit:contain}.sigs small{display:block;color:#555;font-size:11px}
.pad{display:block;width:100%;height:170px;background:#fff;border-radius:16px;touch-action:none;margin:6px 0 8px}
.canalfix{margin-top:16px;padding-top:14px;border-top:1px solid var(--line)}.canalfix .remise{grid-template-columns:minmax(0,1fr) auto}
.push__state{font-weight:650;margin:0 0 14px}
.remise{display:grid;grid-template-columns:minmax(0,1fr) 76px;gap:8px}
.notehead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 6px}.notehead label{margin:0}
html:not(.js) #note-auto{display:none}
/* the slot: the agenda's free slots, as on the site's booking page, or a date and a time typed
   (without the script: the date and the time only) */
html:not(.js) .seg--mode,html:not(.js) .pick{display:none}
html.js .slotbox:has([name=creneau][value=agenda]:checked) .manual{display:none}
html.js .slotbox:has([name=creneau][value=libre]:checked) .pick{display:none}
.pick__nav{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px}
.pick__nav b{font-size:14px;font-weight:650;text-align:center}
.pick__nav button{width:38px;height:38px;padding:0;border-radius:50%;font-size:20px;line-height:1}
.pick__nav button:disabled{opacity:.3;cursor:default;transform:none}
.days{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(84px,1fr);gap:8px;overflow-x:auto;scroll-snap-type:x proximity;padding:2px 2px 8px;scrollbar-width:thin}
.dayb{display:flex;flex-direction:column;align-items:center;gap:1px;padding:10px 6px;border-radius:16px;background:rgba(0,0,0,.32);color:var(--text);box-shadow:inset 0 0 0 1px var(--line-2);scroll-snap-align:start;font-weight:500}
.dayb:hover{box-shadow:inset 0 0 0 1px rgba(var(--gold-rgb),.5);filter:none}
.dayb small{font-size:11.5px;color:var(--dim)}
.dayb b{font-size:22px;line-height:1.1;font-weight:650}
.dayb i{font-style:normal;font-size:11px;color:var(--ok);margin-top:4px;white-space:nowrap}
.dayb.is-on{background:linear-gradient(180deg,rgba(var(--gold-rgb),.24),rgba(var(--gold-rgb),.07));box-shadow:inset 0 0 0 1px rgba(var(--gold-rgb),.65),0 10px 24px -16px rgba(var(--gold-rgb),.9)}
.dayb.is-on b{color:var(--gold-2)}
.pick__day{margin:14px 0 4px;font-weight:650;font-size:15px}
.pick h4{font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin:12px 0 8px;font-weight:700}
.picked{display:flex;align-items:center;gap:8px;margin:14px 0 0;padding:11px 14px;border-radius:14px;background:rgba(127,212,155,.1);border:1px solid rgba(127,212,155,.3);color:var(--ok);font-weight:650;font-size:14px}
@media (max-width:1000px){.rdvgrid{grid-template-columns:minmax(0,1fr)}.rdvgrid>aside{position:static}}
@media (max-width:640px){.xrow{grid-template-columns:repeat(2,minmax(0,1fr));padding-bottom:8px;border-bottom:1px solid var(--line);margin-bottom:8px}.xrow select,.xrow [name=x_label]{grid-column:1/3}.seg{grid-template-columns:minmax(0,1fr)}.seg--2,.seg--4{grid-template-columns:repeat(2,minmax(0,1fr))}.seg--3{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.seg--2 span,.seg--4 span{padding:10px 12px}.seg--3 span{padding:10px 8px}.seg--3 b{font-size:13px}.seg--3 small{font-size:11px}.days{grid-auto-columns:76px;margin:0 -17px;padding:2px 17px 8px}}

/* ---------------------------------------------------------------- toasts */
.toasts{position:fixed;right:22px;bottom:22px;z-index:60;display:grid;gap:10px;width:min(380px,calc(100vw - 32px))}
.toast{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:center;padding:14px 16px;border-radius:18px;text-decoration:none;color:var(--text);background:rgba(18,19,24,.94);border:1px solid color-mix(in srgb,var(--c,var(--gold)) 45%,transparent);box-shadow:0 24px 60px -18px rgba(0,0,0,.95),0 0 30px -12px var(--c,var(--gold));-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);animation:toast-in .5s var(--ease)}
.toast i{grid-row:span 2;width:10px;height:10px;border-radius:50%;background:var(--c,var(--gold));box-shadow:0 0 12px var(--c,var(--gold))}
.toast b{font-size:14px}.toast span{grid-column:2;color:var(--text-2);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.toast.is-out{opacity:0;transform:translateY(8px);transition:opacity .5s,transform .5s}
@keyframes toast-in{from{opacity:0;transform:translateY(16px) scale(.97)}}
.fresh{position:fixed;left:50%;top:18px;z-index:55;transform:translateX(-50%);padding:9px 16px;font-size:13px}

/* ---------------------------------------------------------------- sign-in */
.login{max-width:430px;margin:12vh auto 0;padding:0 16px}
.login__card{text-align:center;padding:34px 26px}
.login__logo{width:min(260px,70%);height:auto;margin:0 auto 12px;display:block}
.login form{text-align:left}.login .lead{text-align:center;margin-left:auto;margin-right:auto}

@media (max-width:1100px){.pipe{grid-template-columns:repeat(3,minmax(0,1fr))}.hero,.two{grid-template-columns:minmax(0,1fr)}}
@media (max-width:900px){.dgrid{grid-template-columns:minmax(0,1fr)}.dgrid>aside{order:-1}
  .week{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -22px;padding:0 22px 4px;scrollbar-width:none}.week::-webkit-scrollbar{display:none}.day{flex:0 0 46%;scroll-snap-align:start}}
@media (max-width:640px){.row,.row3{grid-template-columns:minmax(0,1fr)}.hide-s{display:none}th,td{padding:10px 6px}.card{padding:17px;border-radius:20px}
  .q{grid-template-columns:1fr auto;padding:14px 14px 14px 18px}.q__n{display:none}.q__last{grid-column:1/3}.b{max-width:94%}
  .pipe{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -16px 18px;padding:2px 16px 6px;scrollbar-width:none}.pipe::-webkit-scrollbar{display:none}.st{flex:0 0 42%;scroll-snap-align:start}
  .week{margin:0 -17px;padding:0 17px 4px}.day{flex:0 0 64%}
  .toasts{left:16px;right:16px;bottom:calc(92px + env(safe-area-inset-bottom));width:auto}}
/* phones: no blur behind the panels over the moving garage (the GPU and the battery), a denser glass instead */
@media (max-width:1000px){.card,.fig,.q,.st,.tile,.chips a,.b,.pill{-webkit-backdrop-filter:none;backdrop-filter:none}:root{--glass:rgba(15,16,20,.84)}.b--in{background:rgba(28,29,35,.94)}}
@media (prefers-reduced-motion:reduce){*,::before,::after{animation:none!important;transition:none!important}}
`;

export const JS = String.raw`(function () {
  'use strict';
  var d = document, w = window;
  d.documentElement.classList.add('js');
  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var idle = function (fn) { return 'requestIdleCallback' in w ? w.requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200); };

  // ------------------------------------------------------------ the garage (as src/js/ambient.js)
  function drawGarage(c) {
    var dpr = Math.min(w.devicePixelRatio || 1, 2), W = w.innerWidth, H = w.innerHeight;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    var g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    var vx = W / 2, vy = H * 0.36, f = Math.max(W, H * 1.2) * 0.62, ceil = 1, z0 = (f * ceil) / vy;
    var px = function (X, z) { return vx + (f * X) / z; };
    var pyC = function (z) { return vy - (f * ceil) / z; };
    var pyF = function (z) { return vy + (f * ceil * 1.6) / z; };
    var quad = function (x1a, x1b, y1, x2a, x2b, y2) { g.beginPath(); g.moveTo(x1a, y1); g.lineTo(x1b, y1); g.lineTo(x2b, y2); g.lineTo(x2a, y2); g.closePath(); g.fill(); };
    var css = getComputedStyle(d.documentElement);
    var tube1 = css.getPropertyValue('--tube-rgb').trim() || '236, 242, 255';
    var tube2 = css.getPropertyValue('--tube-rgb-2').trim() || tube1;
    var rows = [-4.5, -3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5, 4.5];
    for (var r = 0; r < rows.length; r++) {
      var X = rows[r] * 0.62, rgb = r % 2 ? tube2 : tube1;
      for (var z = z0 * 0.8; z < 16; z += 2.4) {
        var z1 = z, z2 = z + 1.65, fade = Math.pow(Math.max(0, 1 - z / 15), 1.4);
        var layers = [[0.11, 0.05], [0.045, 0.16], [0.014, 0.9]];
        for (var k = 0; k < layers.length; k++) {
          var hw = layers[k][0], a = layers[k][1];
          g.fillStyle = 'rgba(' + rgb + ', ' + (a * fade).toFixed(3) + ')';
          quad(px(X - hw, z1), px(X + hw, z1), pyC(z1), px(X - hw, z2), px(X + hw, z2), pyC(z2));
          g.fillStyle = 'rgba(' + rgb + ', ' + (a * fade * 0.16).toFixed(3) + ')';
          quad(px(X - hw * 2.2, z1), px(X + hw * 2.2, z1), pyF(z1), px(X - hw * 2.2, z2), px(X + hw * 2.2, z2), pyF(z2));
        }
      }
    }
  }
  function noise2(seed) {
    var N = 256, perm = new Uint8Array(N * 2), val = new Float32Array(N), s = seed * 9301 + 49297, i, j, t;
    var rnd = function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (i = 0; i < N; i++) { perm[i] = i; val[i] = rnd(); }
    for (i = N - 1; i > 0; i--) { j = Math.floor(rnd() * (i + 1)); t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (i = 0; i < N; i++) perm[N + i] = perm[i];
    var at = function (x, y) { return val[perm[(perm[x & 255] + y) & 511]]; };
    return function (x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      var a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), e = at(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v;
    };
  }
  function smoke(seed) {
    var w0 = 200, h0 = 112, n = noise2(seed);
    var fbm = function (x, y) { var sum = 0, amp = 0.5; for (var o = 0; o < 5; o++) { sum += amp * n(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 3.7; amp *= 0.5; } return sum; };
    var c = d.createElement('canvas'); c.width = w0; c.height = h0;
    var g = c.getContext('2d'), img = g.createImageData(w0, h0), px = img.data;
    for (var y = 0; y < h0; y++) {
      var fy = y / h0;
      var profile = Math.max(Math.exp(-Math.pow(fy - 0.72, 2) / 0.05), 0.55 * Math.exp(-Math.pow(fy - 0.22, 2) / 0.02));
      for (var x = 0; x < w0; x++) {
        var fx = x / w0;
        var wx = fbm(fx * 3 + 5.2, fy * 4 + 1.3), wy = fbm(fx * 3 + 1.7, fy * 4 + 9.2);
        var v = fbm(fx * 2.6 + wx * 1.6, fy * 5.2 + wy * 1.2);
        var a = Math.min(1, Math.max(0, (v - 0.42) * 2.6)) * profile;
        var edge = Math.min(1, fx * 6, (1 - fx) * 6), i = (y * w0 + x) * 4;
        px[i] = 206; px[i + 1] = 212; px[i + 2] = 222; px[i + 3] = Math.round(a * edge * 255);
      }
    }
    g.putImageData(img, 0, 0);
    c.className = 'amb__smoke';
    return c;
  }
  function drawDust(c) {
    var W = w.innerWidth, H = w.innerHeight; c.width = W; c.height = H * 2;
    var g = c.getContext('2d'), s = 11;
    var rnd = function () { s = (s * 16807) % 2147483647; return s / 2147483647; };
    var n = Math.round((W * H) / 7000);
    for (var i = 0; i < n; i++) {
      var x = rnd() * W, y = rnd() * H, r = 0.5 + rnd() * rnd() * 1.6, a = 0.08 + rnd() * 0.3;
      for (var k = 0; k < 2; k++) {
        var dy = k * H, grad = g.createRadialGradient(x, y + dy, 0, x, y + dy, r * 2.4);
        grad.addColorStop(0, 'rgba(255, 244, 222, ' + a.toFixed(3) + ')');
        grad.addColorStop(1, 'rgba(255, 244, 222, 0)');
        g.fillStyle = grad; g.fillRect(x - r * 2.4, y + dy - r * 2.4, r * 4.8, r * 4.8);
      }
    }
  }
  function backdrop() {
    var host = d.querySelector('.amb');
    if (!host || host.getAttribute('data-on')) return;
    host.setAttribute('data-on', '1');
    var room = d.createElement('canvas');
    room.className = 'amb__room';
    drawGarage(room);
    host.insertBefore(room, host.firstChild);
    var t = 0, lastW = w.innerWidth;
    w.addEventListener('resize', function () {
      // the phone's address bar coming and going changes only the height: not redrawn for that
      if (Math.abs(w.innerWidth - lastW) < 2 && !t) return;
      clearTimeout(t);
      t = setTimeout(function () { t = 0; lastW = w.innerWidth; drawGarage(room); }, 250);
    }, { passive: true });
    requestAnimationFrame(function () { host.classList.add('is-on'); });
    idle(function () {
      var haze = host.querySelector('.amb__haze');
      haze.appendChild(smoke(7));
      idle(function () {
        var b = smoke(23); b.className += ' amb__smoke--b'; haze.appendChild(b);
        var dust = d.createElement('canvas'); dust.className = 'amb__dust'; drawDust(dust);
        haze.parentNode.insertBefore(dust, haze.nextSibling);
        if (!reduce) host.classList.add('is-live');
      });
    });
  }

  // ------------------------------------------------------------ figures, times
  var nf = new Intl.NumberFormat('fr-FR');
  var euro = function (v, dec) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v); };
  function countUp(root, animate) {
    var els = root.querySelectorAll('[data-n]');
    Array.prototype.forEach.call(els, function (el) {
      var end = Number(el.getAttribute('data-n')) || 0, eur = el.hasAttribute('data-eur');
      var dec = eur && Math.round(end) !== end ? 2 : 0;
      var fmt = function (v) { return eur ? euro(v, dec) : nf.format(Math.round(v)); };
      if (!animate || reduce || !end) { el.textContent = fmt(end); return; }
      var t0 = performance.now(), dur = 1100;
      el.textContent = fmt(0);
      var step = function (t) {
        var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(dec ? Math.round(end * e * 100) / 100 : Math.round(end * e));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  function ago(ms) {
    var s = Math.round((Date.now() - ms) / 1000);
    if (s < 50) return 'à l’instant';
    var m = Math.round(s / 60); if (m < 60) return 'il y a ' + m + ' min';
    var h = Math.round(m / 60); if (h < 24) return 'il y a ' + h + ' h';
    var j = Math.round(h / 24); if (j < 2) return 'hier'; if (j < 7) return 'il y a ' + j + ' j';
    return new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  function until(ms) {
    var m = Math.round((ms - Date.now()) / 60000);
    if (m <= 0) return 'maintenant';
    if (m < 60) return 'dans ' + m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    if (h < 24) return 'dans ' + h + ' h' + (r ? ' ' + (r < 10 ? '0' : '') + r : '');
    var j = Math.round(h / 24);
    return j < 2 ? 'demain' : 'dans ' + j + ' jours';
  }
  function tick() {
    Array.prototype.forEach.call(d.querySelectorAll('[data-ago]'), function (el) { el.textContent = ago(Number(el.getAttribute('data-ago'))); });
    Array.prototype.forEach.call(d.querySelectorAll('[data-until]'), function (el) { el.textContent = until(Number(el.getAttribute('data-until'))); });
    Array.prototype.forEach.call(d.querySelectorAll('[data-span]'), function (el) {
      var p = el.getAttribute('data-span').split('-'), a = Number(p[0]), b = Number(p[1]);
      var x = Math.max(0, Math.min(1, (Date.now() - a) / (b - a)));
      el.style.width = (x * 100).toFixed(1) + '%';
    });
  }

  // ------------------------------------------------------------ live
  var V = null, busy = false, off = false, pending = false;
  var KEY = 'sc37-atelier-vu';
  var seen = function () { try { return Number(localStorage.getItem(KEY)) || 0; } catch (e) { return -1; } };
  var setSeen = function (v) { try { localStorage.setItem(KEY, String(v)); } catch (e) {} };
  function label(ok, text) {
    Array.prototype.forEach.call(d.querySelectorAll('[data-live-label]'), function (el) {
      el.classList.toggle('is-off', !ok);
      var s = el.querySelector('span');
      if (s) s.textContent = text;
    });
  }
  function who(e) { return [e.first, e.last].filter(Boolean).join(' ') || 'Un client'; }
  function toast(e) {
    var t = { demande: ['Nouvelle demande de devis', 'var(--blue)'], 'in': ['Message de ' + (e.first || 'un client'), 'var(--violet)'], rdv: ['Rendez-vous réservé et payé', 'var(--ok)'], note: ['Devis n°' + e.request, 'var(--ok)'] }[e.kind];
    if (!t || (e.kind === 'note' && !/accept/i.test(e.text || ''))) return;
    var box = d.querySelector('.toasts');
    if (!box) { box = d.createElement('div'); box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); d.body.appendChild(box); }
    var a = d.createElement('a');
    a.className = 'toast';
    a.style.setProperty('--c', t[1]);
    a.href = e.request ? '/atelier/devis/' + e.request : e.client ? '/atelier/clients/' + e.client : '/atelier';
    var i = d.createElement('i'), b = d.createElement('b'), s = d.createElement('span');
    b.textContent = t[0];
    s.textContent = e.kind === 'demande' ? who(e) + (e.text ? ' · ' + e.text : '') : e.kind === 'rdv' ? who(e) : (e.text || '').replace(/\s+/g, ' ');
    a.appendChild(i); a.appendChild(b); a.appendChild(s);
    box.appendChild(a);
    setTimeout(function () { a.classList.add('is-out'); }, 8000);
    setTimeout(function () { a.remove(); }, 8600);
  }
  function editing() {
    var a = d.activeElement;
    return (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || d.querySelector('form[data-dirty]');
  }
  function freshPill() {
    if (d.querySelector('.fresh')) return;
    var b = d.createElement('button');
    b.className = 'fresh small';
    b.type = 'button';
    b.textContent = 'Du nouveau : actualiser';
    b.onclick = function () { b.remove(); refresh(true); };
    d.body.appendChild(b);
  }
  function refresh(force) {
    if (!force && editing()) { pending = true; freshPill(); return; }
    fetch(location.pathname + location.search, { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { if (!r.ok || r.redirected) throw 0; return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var m = doc.querySelector('main'), main = d.querySelector('main');
        if (!m || !main) return;
        d.body.classList.add('no-rise');
        var y = w.scrollY;
        main.innerHTML = m.innerHTML;
        w.scrollTo(0, y);
        boot(main, false);
        pending = false;
      })
      .catch(function () {});
  }
  function apply(j) {
    label(true, 'En direct · ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    Array.prototype.forEach.call(d.querySelectorAll('[data-badge]'), function (el) { el.textContent = j.badge; el.hidden = !j.badge; });
    d.title = d.title.replace(/^\(\d+\) /, '');
    if (j.badge) d.title = '(' + j.badge + ') ' + d.title;
    var s = seen(), max = s, ev = j.events || [];
    for (var i = 0; i < ev.length; i++) if (ev[i].at > max) max = ev[i].at;
    if (s > 0) ev.filter(function (e) { return e.at > s; }).slice(0, 3).reverse().forEach(toast);
    if (max > s && s !== -1) setSeen(max);
    if (V !== null && j.v !== V && d.body.hasAttribute('data-refresh')) refresh(false);
    V = j.v;
  }
  function poll(force) {
    if (busy || off || (d.hidden && !force)) return;
    busy = true;
    fetch('/atelier/live', { headers: { accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) {
        if (r.status === 401) { off = true; label(false, 'Session expirée'); throw 0; }
        if (!r.ok) throw 0;
        return r.json();
      })
      .then(apply)
      .catch(function () { if (!off) label(false, 'Hors ligne'); })
      .then(function () { busy = false; });
  }

  // ------------------------------------------------------------ « Nouveau RDV »: price and free slots as the form is filled
  function rdvForm() {
    var form = d.getElementById('rdv');
    if (!form) return;
    var recap = d.getElementById('recap'), slots = d.getElementById('slots'), t = 0, lastSlots = '';
    var presets = JSON.parse(form.getAttribute('data-presets') || '{}');
    var prices = JSON.parse(form.getAttribute('data-prices') || '{}');
    var el = function (n) { return form.elements[n]; };
    function mark() {
      Array.prototype.forEach.call(slots.querySelectorAll('.slot'), function (b) { b.classList.toggle('is-on', b.getAttribute('data-t') === el('heure').value); });
    }
    function say(text) { slots.innerHTML = ''; var p = d.createElement('p'); p.className = 'dim'; p.textContent = text; slots.appendChild(p); }
    function loadSlots() {
      var date = el('date').value, m = Number(form.getAttribute('data-minutes')) || 0;
      if (!date) return;
      if (!m) { say('Choisissez d’abord les prestations : les créneaux libres dépendent de la durée.'); return; }
      var key = date + '/' + m;
      if (key === lastSlots) return;
      lastSlots = key;
      say('Lecture de vos agendas…');
      fetch('/atelier/creneaux?date=' + encodeURIComponent(date) + '&minutes=' + m, { credentials: 'same-origin', cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.error) return say(j.error);
          if (!j.times.length) return say('Aucun créneau libre ce jour-là pour cette durée. Tapez l’heure vous-même si besoin (et cochez « Garder ce créneau »).');
          say('Créneaux libres ce jour-là :');
          var box = d.createElement('div');
          box.className = 'slots__list';
          j.times.forEach(function (tm) {
            var b = d.createElement('button');
            b.type = 'button'; b.className = 'slot'; b.textContent = tm.replace(/^0/, '').replace(':', ' h ');
            b.setAttribute('data-t', tm);
            b.onclick = function () { el('heure').value = tm; mark(); clearTimeout(t); t = setTimeout(price, 50); };
            box.appendChild(b);
          });
          slots.appendChild(box);
          mark();
        })
        .catch(function () { say('Agenda indisponible : tapez l’heure vous-même.'); });
    }
    // the agenda's free slots over the days to come, as on the site's booking page
    var pick = d.getElementById('pick'), today = pick ? pick.getAttribute('data-today') : '';
    var SPAN = 30, pFrom = today, pKey = '', pDays = [], pSel = '', pScroll = 0;
    var fmt = function (date, o) { return new Date(date + 'T12:00:00Z').toLocaleDateString('fr-FR', Object.assign({ timeZone: 'UTC' }, o)); };
    var addD = function (date, n) { var x = new Date(date + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
    var hm = function (tm) { return tm.replace(/^0/, '').replace(':', '\u00a0h\u00a0'); };
    var cap = function (t) { return t.charAt(0).toUpperCase() + t.slice(1); };
    function pickSay(text) { pick.innerHTML = ''; var p = d.createElement('p'); p.className = 'dim'; p.textContent = text; pick.appendChild(p); }
    function loadDays(force) {
      if (!pick) return;
      var m = Number(form.getAttribute('data-minutes')) || 0;
      if (!m) { pKey = ''; pickSay('Choisissez d’abord les prestations : les créneaux libres dépendent de la durée.'); return; }
      var key = pFrom + '/' + m;
      if (key === pKey && !force) return;
      pKey = key;
      pickSay('Lecture de vos agendas…');
      fetch('/atelier/creneaux?from=' + pFrom + '&days=' + SPAN + '&minutes=' + m, { credentials: 'same-origin', cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.error) return pickSay(j.error);
          pDays = j.days || [];
          var has = function (date) { return pDays.some(function (x) { return x.date === date; }); };
          if (!has(pSel)) pSel = has(el('date').value) ? el('date').value : pDays.length ? pDays[0].date : '';
          pScroll = 0;
          renderPick();
        })
        .catch(function () { pickSay('Agenda indisponible : passez en « Date et heure au choix ».'); });
    }
    function button(text, cls, label) {
      var b = d.createElement('button');
      b.type = 'button';
      if (cls) b.className = cls;
      b.textContent = text;
      if (label) b.setAttribute('aria-label', label);
      return b;
    }
    function renderPick() {
      var old = pick.querySelector('.days');
      if (old) pScroll = old.scrollLeft;
      pick.innerHTML = '';
      var nav = d.createElement('div');
      nav.className = 'pick__nav';
      var prev = button('‹', 'ghost', 'Jours précédents'), next = button('›', 'ghost', 'Jours suivants');
      prev.disabled = pFrom <= today;
      prev.onclick = function () { pFrom = addD(pFrom, -SPAN); if (pFrom < today) pFrom = today; loadDays(); };
      next.onclick = function () { pFrom = addD(pFrom, SPAN); loadDays(); };
      var lab = d.createElement('b');
      lab.textContent = 'Du ' + fmt(pFrom, { day: 'numeric', month: 'long' }) + ' au ' + fmt(addD(pFrom, SPAN - 1), { day: 'numeric', month: 'long' });
      nav.appendChild(prev); nav.appendChild(lab); nav.appendChild(next);
      pick.appendChild(nav);
      if (!pDays.length) {
        var none = d.createElement('p');
        none.className = 'dim';
        none.textContent = 'Aucun créneau libre sur ces jours pour cette durée : voyez les jours suivants, ou passez en « Date et heure au choix ».';
        pick.appendChild(none);
      } else {
        var strip = d.createElement('div');
        strip.className = 'days';
        pDays.forEach(function (x) {
          var b = button('', 'dayb' + (x.date === pSel ? ' is-on' : ''));
          var parts = [['small', cap(fmt(x.date, { weekday: 'short' }).replace('.', ''))], ['b', String(Number(x.date.slice(8)))], ['small', fmt(x.date, { month: 'short' }).replace('.', '')], ['i', x.times.length + ' créneau' + (x.times.length > 1 ? 'x' : '')]];
          parts.forEach(function (pt) { var e = d.createElement(pt[0]); e.textContent = pt[1]; b.appendChild(e); });
          b.onclick = function () { pSel = x.date; renderPick(); };
          strip.appendChild(b);
        });
        pick.appendChild(strip);
        strip.scrollLeft = pScroll;
        var day = pDays.filter(function (x) { return x.date === pSel; })[0];
        if (day) {
          var title = d.createElement('p');
          title.className = 'pick__day';
          title.textContent = cap(fmt(day.date, { weekday: 'long', day: 'numeric', month: 'long' }));
          pick.appendChild(title);
          [['Matin', function (t) { return t < '12:00'; }], ['Après-midi', function (t) { return t >= '12:00'; }]].forEach(function (g) {
            var ts = day.times.filter(g[1]);
            if (!ts.length) return;
            var h = d.createElement('h4');
            h.textContent = g[0];
            pick.appendChild(h);
            var box = d.createElement('div');
            box.className = 'slots__list';
            ts.forEach(function (tm) {
              var s = button(hm(tm), 'slot' + (el('date').value === day.date && el('heure').value === tm ? ' is-on' : ''));
              s.onclick = function () { el('date').value = day.date; el('heure').value = tm; lastSlots = ''; renderPick(); clearTimeout(t); t = setTimeout(price, 50); };
              box.appendChild(s);
            });
            pick.appendChild(box);
          });
        }
      }
      if (el('date').value && el('heure').value) {
        var ok = d.createElement('p');
        ok.className = 'picked';
        ok.textContent = '✓ Créneau choisi : ' + fmt(el('date').value, { weekday: 'long', day: 'numeric', month: 'long' }) + ' à ' + hm(el('heure').value);
        pick.appendChild(ok);
      }
    }
    function price() {
      fetch('/atelier/rdv/prix', { method: 'POST', body: new FormData(form), credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j) return;
          recap.innerHTML = j.html;
          var note = el('note');
          if (note && note.hasAttribute('data-auto') && j.draft != null) note.value = j.draft;
          if (String(j.minutes) !== form.getAttribute('data-minutes')) { form.setAttribute('data-minutes', String(j.minutes)); lastSlots = ''; }
          loadSlots();
          loadDays();
        })
        .catch(function () {});
    }
    function relabel() {
      var p = prices[el('vt_vehicule').value] || {};
      Array.prototype.forEach.call(el('vt_formule').options, function (o) {
        if (o.value && p[o.value] != null) o.textContent = o.textContent.replace(/ · .*$/, '') + ' · ' + euro(p[o.value], 0);
      });
    }
    form.addEventListener('change', function (e) {
      var x = e.target;
      if (x.hasAttribute('data-preset')) {
        var row = x.parentNode, o = presets[x.value];
        if (o) {
          row.querySelector('[name=x_label]').value = o.label;
          row.querySelector('[name=x_prix]').value = o.price == null ? '' : String(o.price).replace('.', ',');
          row.querySelector('[name=x_min]').value = o.minutes;
          if (o.price == null || !o.label) row.querySelector(o.label ? '[name=x_prix]' : '[name=x_label]').focus();
        }
      }
      if (x.name === 'vt_vehicule') relabel();
      if (x.name === 'heure') { mark(); clearTimeout(t); t = setTimeout(price, 120); return; }
      if (x.name === 'creneau') { if (x.value === 'agenda') { if (pDays.length) renderPick(); else loadDays(true); } return; }
      clearTimeout(t); t = setTimeout(price, 120);
    });
    form.addEventListener('input', function (e) {
      // the note written by hand: no longer redrafted
      if (e.target.name === 'note') { e.target.removeAttribute('data-auto'); return; }
      if (e.target.name === 'heure' || e.target.tagName === 'SELECT') return;
      clearTimeout(t); t = setTimeout(price, 400);
    });
    // « Message automatique »: the note drafted again from the form
    var redo = d.getElementById('note-auto');
    if (redo) redo.onclick = function () { el('note').setAttribute('data-auto', '1'); price(); };
    loadSlots();
    loadDays();
  }
  // « Trouver la société »: the public directory read from this browser (the server's shared
  // addresses are rate-limited there); a SIRET fills the card, a name lists the companies; when the
  // browser cannot reach it, the form goes to the server as before
  (function () {
    var f = d.querySelector('form[data-annuaire]');
    if (!f || !window.fetch) return;
    var LEGAL = JSON.parse(f.getAttribute('data-legal') || '{}'), NAF = JSON.parse(f.getAttribute('data-naf') || '{}');
    var out = f.querySelector('[data-annuaire-msg]');
    var API = 'https://recherche-entreprises.api.gouv.fr/search?';
    function ask(params) {
      params.page = '1';
      return fetch(API + new URLSearchParams(params), { headers: { accept: 'application/json' } }).then(function (r) { if (!r.ok) throw new Error('annuaire ' + r.status); return r.json(); }).then(function (j) { return j.results || []; });
    }
    function company(r, id) {
      var list = r.matching_etablissements || [], et = null, i;
      for (i = 0; i < list.length; i++) if (id && list[i].siret === id) et = list[i];
      if (!et && !id && list.length) et = list[0];
      et = et || r.siege || {};
      var naf = et.activite_principale || r.activite_principale || '';
      var name = r.nom_raison_sociale || r.nom_complet || '';
      var brand = ((et.liste_enseignes || (r.siege && r.siege.liste_enseignes) || [])[0]) || '';
      return {
        name: brand && name && brand.toUpperCase() !== name.toUpperCase() ? brand + ' (' + name + ')' : brand || name,
        legal: LEGAL[r.nature_juridique] || '',
        address: et.adresse || (r.siege && r.siege.adresse) || '',
        activity: NAF[naf] ? NAF[naf] + ' (' + naf + ')' : naf,
        siret: et.siret || (id && id.length === 14 ? id : (r.siege && r.siege.siret) || '')
      };
    }
    function fill(c) {
      var map = { name: c.name, legal: c.legal, address: c.address, activity: c.activity, siret: c.siret };
      Object.keys(map).forEach(function (k) { var el = d.getElementById('p-' + k); if (el && map[k]) el.value = map[k]; });
      out.textContent = '✓ ' + c.name + ' : fiche remplie. Complétez le contact et le logo, puis « Enregistrer ».';
      var first = d.getElementById('p-contact');
      if (first) first.focus();
    }
    function list(cs, q) {
      var old = f.querySelector('.hits');
      if (old) old.remove();
      var box = d.createElement('div');
      box.className = 'hits';
      cs.forEach(function (c) {
        var b = d.createElement('button');
        b.type = 'button';
        b.className = 'hit';
        [['b', c.name], ['small', c.address], ['small', 'SIRET ' + c.siret + (c.activity ? ' · ' + c.activity : '')], ['span', 'Choisir']].forEach(function (x, i) { var e = d.createElement(x[0]); e.textContent = x[1]; if (i === 3) e.className = 'hit__go'; b.appendChild(e); });
        b.addEventListener('click', function () { box.remove(); fill(c); });
        box.appendChild(b);
      });
      f.appendChild(box);
      out.textContent = cs.length + (cs.length > 1 ? ' sociétés' : ' société') + ' pour « ' + q + ' » : touchez la bonne.';
    }
    f.addEventListener('submit', function (e) {
      var q = (f.elements.q.value || '').trim(), id = q.replace(/[\s.]/g, '');
      var byNumber = /^\d{9}$|^\d{14}$/.test(id);
      if (!byNumber && q.replace(/\d/g, '').trim().length < 2) return;
      e.preventDefault();
      out.textContent = 'Recherche dans l’annuaire…';
      var go = byNumber
        ? ask({ q: id, per_page: '1' }).then(function (rs) { return rs.map(function (r) { return company(r, id); }); })
        : ask({ q: q, per_page: '8', departement: '37', etat_administratif: 'A' }).catch(function () { return []; }).then(function (rs) { return rs.length ? rs : ask({ q: q, per_page: '8', etat_administratif: 'A' }); }).then(function (rs) { return rs.map(function (r) { return company(r, ''); }); });
      go.then(function (cs) {
        if (!cs.length) { out.textContent = byNumber ? 'Aucune entreprise pour ce numéro : vérifiez le SIRET (14 chiffres) ou le SIREN (9).' : 'Aucune société trouvée pour « ' + q + ' » : essayez un autre mot du nom, ou le SIRET.'; return; }
        if (byNumber) fill(cs[0]); else list(cs, q);
      }).catch(function () { out.textContent = 'Recherche par le serveur…'; f.submit(); });
    });
  })();
  // the signature pad (a partnership agreement countersigned by the workshop)
  Array.prototype.forEach.call(d.querySelectorAll('canvas.pad'), function (cv) {
    var x = cv.getContext('2d'), r = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight, dirty = false, last = null;
    cv.width = w * r; cv.height = h * r; x.scale(r, r); x.lineWidth = 2.4; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#111';
    function at(e) { var b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; }
    cv.addEventListener('pointerdown', function (e) { last = at(e); e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) { if (!last) return; var q = at(e); x.beginPath(); x.moveTo(last[0], last[1]); x.lineTo(q[0], q[1]); x.stroke(); last = q; dirty = true; e.preventDefault(); });
    ['pointerup', 'pointercancel'].forEach(function (k) { window.addEventListener(k, function () { last = null; }); });
    var f = cv.closest('form'), clr = f.querySelector('[data-clear]');
    if (clr) clr.addEventListener('click', function () { x.clearRect(0, 0, w, h); dirty = false; });
    f.addEventListener('submit', function (e) { if (!dirty) { e.preventDefault(); alert('Signez dans le cadre blanc.'); return; } f.querySelector('[name=image]').value = cv.toDataURL('image/png'); });
  });
  // « Ajouter une prestation » to an appointment: the preset fills the line, the price after discount shown
  (function () {
    var form = d.getElementById('ajout');
    if (!form) return;
    var presets = JSON.parse(form.getAttribute('data-presets') || '{}');
    var net = d.getElementById('a-net');
    var num = function (v) { return Number(String(v || '').replace(/\s/g, '').replace(',', '.')); };
    var show = function () {
      var p = num(form.elements.prix.value), r = num(form.elements.remise.value) || 0;
      net.textContent = p >= 0 && form.elements.prix.value ? 'Ajouté au total : ' + euro(Math.round(p * (1 - Math.min(100, Math.max(0, r)) / 100) * 100) / 100, 2) : '';
    };
    form.addEventListener('input', show);
    form.addEventListener('change', function (e) {
      if (!e.target.hasAttribute('data-preset')) return;
      var o = presets[e.target.value];
      if (!o) return;
      form.elements.label.value = o.label;
      form.elements.prix.value = o.price == null ? '' : String(o.price).replace('.', ',');
      form.elements.minutes.value = o.minutes || '';
      (o.label ? form.elements.prix : form.elements.label).focus();
      show();
    });
  })();
  // a link to copy (the payment link of an appointment)
  d.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-copy]');
    if (!b) return;
    var text = b.getAttribute('data-copy'), done = function () { b.textContent = 'Copié ✓'; setTimeout(function () { b.textContent = 'Copier le lien'; }, 2500); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done).catch(function () {});
  });
  d.addEventListener('focusin', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-select')) e.target.select(); });

  // ------------------------------------------------------------ notifications on this device (booking/push.js)
  function pushSetup() {
    var box = d.querySelector('[data-push]');
    if (!box) return;
    var key = box.getAttribute('data-push');
    var state = box.querySelector('[data-push-state]'), on = box.querySelector('[data-push-on]'), off = box.querySelector('[data-push-off]'), test = box.querySelector('[data-push-test]');
    var say = function (t) { state.textContent = t; };
    var ua = navigator.userAgent;
    var ios = /iPhone|iPad|iPod/.test(ua);
    var standalone = navigator.standalone || (w.matchMedia && w.matchMedia('(display-mode: standalone)').matches);
    if (!('serviceWorker' in navigator) || !('PushManager' in w) || !('Notification' in w)) {
      say(ios && !standalone ? 'Sur iPhone : ajoutez d’abord l’espace à l’écran d’accueil (Safari → Partager → « Sur l’écran d’accueil »), puis ouvrez-le depuis son icône.' : 'Ce navigateur ne gère pas les notifications : essayez Chrome, Edge, Firefox ou Safari à jour.');
      on.hidden = true;
      return;
    }
    var label = ios ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'PC Windows' : 'Ordinateur';
    var bytes = function (s) { var p = s.replace(/-/g, '+').replace(/_/g, '/'); var raw = atob(p + '==='.slice((p.length + 3) % 4)); var out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out; };
    var post = function (path, body) { return fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }).then(function (r) { return r.json(); }); };
    function show(sub) {
      on.hidden = !!sub;
      off.hidden = test.hidden = !sub;
      say(sub ? '✓ Activées sur cet appareil (' + label + ').' : Notification.permission === 'denied' ? 'Bloquées par ce navigateur : autorisez les notifications pour ce site dans ses réglages, puis réessayez.' : 'Pas encore activées sur cet appareil.');
    }
    navigator.serviceWorker.register('/atelier/sw.js', { scope: '/atelier/' }).catch(function () {});
    navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(show).catch(function () {});
    on.onclick = function () {
      say('Activation…');
      Notification.requestPermission().then(function (perm) {
        if (perm !== 'granted') return show(null);
        return navigator.serviceWorker.ready
          .then(function (reg) { return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(key) }); })
          .then(function (sub) {
            var j = sub.toJSON();
            return post('/atelier/push/abonner', { endpoint: j.endpoint, keys: j.keys, label: label }).then(function (r) {
              if (!r.ok) throw new Error(r.error || 'refusé');
              show(sub);
              return post('/atelier/push/test');
            });
          });
      }).catch(function (e) { say('Activation impossible : ' + (e && e.message ? e.message : 'réessayez')); });
    };
    test.onclick = function () {
      say('Envoi de l’essai…');
      post('/atelier/push/test').then(function (r) { say(r.sent ? '✓ Essai envoyé à ' + r.sent + ' appareil' + (r.sent > 1 ? 's' : '') + '.' : 'L’essai n’est pas parti : désactivez puis réactivez.'); });
    };
    off.onclick = function () {
      navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
        if (!sub) return show(null);
        return post('/atelier/push/desabonner', { endpoint: sub.endpoint }).then(function () { return sub.unsubscribe(); }).then(function () { show(null); });
      });
    };
  }

  // ------------------------------------------------------------ start
  function boot(root, first) { countUp(root, first); tick(); }
  backdrop();
  boot(d, true);
  rdvForm();
  pushSetup();
  setInterval(tick, 20000);
  // a message shown once: not again when the page is redrawn or reloaded
  if (/[?&](ok|err)=/.test(location.search) && w.history.replaceState) {
    var u = new URL(location.href);
    u.searchParams.delete('ok'); u.searchParams.delete('err');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
    var flash = d.querySelector('.msg--ok');
    if (flash) setTimeout(function () { flash.style.transition = 'opacity .6s'; flash.style.opacity = '0'; setTimeout(function () { flash.remove(); }, 700); }, 6000);
  }
  // menus: closed by a click elsewhere or Escape
  d.addEventListener('click', function (e) { Array.prototype.forEach.call(d.querySelectorAll('details.pop[open]'), function (x) { if (!x.contains(e.target)) x.open = false; }); });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape') Array.prototype.forEach.call(d.querySelectorAll('details.pop[open]'), function (x) { x.open = false; }); });
  // a form being filled is never redrawn under the fingers
  d.addEventListener('input', function (e) { if (e.target.form) e.target.form.setAttribute('data-dirty', '1'); });
  if (d.body.hasAttribute('data-live')) {
    setTimeout(function () { poll(true); }, 1200);
    setInterval(poll, 30000);
    d.addEventListener('visibilitychange', function () { if (!d.hidden) poll(true); });
    d.addEventListener('focusout', function () { if (pending) setTimeout(function () { if (pending && !editing()) refresh(false); }, 400); });
  }
})();
`;

/** a short fingerprint of a text (FNV-1a), for the addresses of the files: a new version is a new address */
export function fingerprint(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
export const CSS_V = fingerprint(CSS);
export const JS_V = fingerprint(JS);
