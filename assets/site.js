// amysterling.org: live GitHub data, the embed player, the gallery, the papers.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const fmt = (n) => n.toLocaleString("en-US");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// The player list. url overrides the live URL from GitHub; note overrides the description.
const PLAY = [
  { group: "What's a brain?" },
  { name: "wab-tracks", title: "White matter explorer", url: "https://whatisabrain.com/tracks/", note: "All 360 areas of the human cortex and the measured white matter cables that reach each one. Click any part of the cortex." },
  { name: "wab-hippocampus", title: "Human hippocampus", url: "https://whatisabrain.com/human/hippocampus/", note: "A human hippocampus scanned at fifty micrometers, the finest diffusion MRI of a human brain reported so far." },
  { name: "wab-mouse", title: "Mouse brain", url: "https://whatisabrain.com/mouse/", note: "30,000 neurons of 70 million. Watch a signal leave a cell body and reach every region its axon touches." },
  { name: "wab-fly", title: "Fly brain", url: "https://whatisabrain.com/fly/", note: "The FlyWire connectome in 3D: every neuron and synapse of the fruit fly brain." },
  { name: "inner_cosmos", title: "Inner Cosmos", url: "https://whatisabrain.com/explore/explore", note: "Zoom from a whole mouse brain down to a single dendrite, through real reconstructed cells." },
  { group: "Brains" },
  { name: "neuron-game", title: "Neuron Snake", url: "https://neuronsnake.com/", note: "Snake, but you are a growing neuron. Arrow keys or swipe." },
  { name: "banc-explorer", title: "Be the Fly", note: "A fruit fly simulation built on BANC, the brain and nerve cord connectome." },
  { name: "ca3", title: "CA3 renderings" },
  { name: "retina", title: "Retina, with calcium imaging" },
  { name: "microns", title: "MICrONS cortex" },
  { name: "banc", title: "BANC renderings" },
  { name: "flywire-neuron-gallery", title: "FlyWire neuron gallery" },
  { name: "seunglabdata", title: "connectome.quest", url: "https://connectome.quest/" },
  { name: "eyewire-ii-tutorial", title: "EyeWire II tutorial" },
  { name: "connectome", title: "What is connectomics?" },
  { name: "the650", title: "The 650" },
  { group: "The world" },
  { name: "human-history-map", title: "Human History Map", url: "https://humanhistorymap.com/" },
  { name: "radiotogamma", title: "Radio to Gamma", url: "https://radiotogamma.com/" },
  { name: "track-a-toy", title: "Track a Toy" },
  { name: "hurricane", title: "Hurricanes" },
  { name: "build-a-planet", title: "Build a planet" },
  { name: "name-of-the-wind", title: "The name of the wind" },
  { group: "Sophia & Cora" },
  { name: "sophia-funny-dragon", title: "Funny Dragons", note: "By Sophia. Collect the gems while evading the flames of these four funny dragons!" },
  { name: "cocos-pooping-unicorn-game", title: "Pooping Unicorn", note: "By Coco. A magical unicorn. Infinite rainbow poop." },
  { name: "sophie-shark-game", title: "Shark & Fish", note: "By Sophia. Collect gems, dodge sharks, and find the bedazzled octopus!" },
  { name: "cocos-mythic-meadow", title: "Unicorn & Wolf", note: "By Coco. Explore Magic Meadow. Collect stars. Watch out for the wolf!" },
  { name: "sc-reading", title: "Reading Adventure", url: "https://sophieandcora.com/learn/", note: "Build words, read words, find rhymes, and pop sight words. Ages 4 to 8." },
  { name: "sc-books", title: "Little Books", url: "https://sophieandcora.com/learn/#books", note: "Thirty stories to read all by yourself. Ages 5 to 8." },
  { name: "sc-letters", title: "Letter Sounds", url: "https://sophieandcora.com/learn/#letters", note: "Every letter with its pictures, and a game about first sounds. Ages 3 to 5." },
  { name: "sc-math", title: "Math Arcade", url: "https://sophieandcora.com/learn/#math", note: "Block Math and Ten Drop. Ages 4 to 8." },
  { name: "sc-mountain", title: "Math Mountain", url: "https://sophieandcora.com/learn/#mountain", note: "Under construction. From number lines to the maths behind AI." },
  { name: "the-animal-game", title: "Sophia's Wild World" },
  { group: "Toys and minds" },
  { name: "pottery-wheel", title: "Throwing Light" },
  { name: "scifi-ui", title: "scifi-ui" },
  { name: "zui", title: "ZUI" },
  { name: "experimental-UI", title: "Experimental UI" },
  { name: "artforagents", title: "Art for Agents", url: "https://www.artforagents.com/" },
  { name: "atlas-of-the-unseen", title: "Atlas of the Unseen" },
  { name: "museum-of-almost", title: "Museum of Almost" },
];

// Journals with their own wordmark; the rest are set as text.
const JOURNAL_LOGOS = {
  "Nature": { src: "media/journals/nature.svg", w: 131 },
  "Nature Neuroscience": { src: "media/journals/nature-neuroscience.svg", w: 272 },
  "Nature Methods": { src: "media/journals/nature-methods.svg", w: 260 },
};

let DATA = null;
const byName = new Map();

/* ---------- top nav highlight ---------- */
function navSpy() {
  const links = new Map($$(".top nav a").map((a) => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) {
      links.forEach((a) => a.classList.remove("on"));
      links.get(e.target.id)?.classList.add("on");
    }
  }, { rootMargin: "-45% 0px -50% 0px" });
  links.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
}

/* ---------- hero stats ---------- */
function heroStats() {
  const repos = DATA.repos;
  const commits = repos.reduce((s, r) => s + r.commits, 0);
  const live = repos.filter((r) => r.live).length;
  $('[data-stat="repos"]').textContent = fmt(repos.length);
  $('[data-stat="commits"]').textContent = fmt(commits);
  $('[data-stat="live"]').textContent = fmt(live);
  $$("#hero-stats dt")[1].textContent = `Commits in ${DATA.year}`;
  const d = new Date(DATA.updated);
  $("#hero-updated").textContent = `Counted from GitHub on ${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`;
}

/* ---------- player ---------- */
const stage = { current: null };
function playItems() { return PLAY.filter((p) => p.name); }
function playUrl(p) { return p.url || byName.get(p.name)?.live || ""; }
function playDesc(p) { return p.note || byName.get(p.name)?.description || ""; }

function buildPlaylist() {
  const ol = $("#playlist");
  ol.innerHTML = PLAY.map((p) => {
    if (p.group) return `<li class="group" aria-hidden="true">${esc(p.group)}</li>`;
    if (!playUrl(p)) return "";
    const d = playDesc(p);
    return `<li><button type="button" data-play="${esc(p.name)}">${esc(p.title)}<small>${esc(d.length > 70 ? d.slice(0, 68).replace(/\s+\S*$/, "") + "…" : d)}</small></button></li>`;
  }).join("");
}

function load(name, { scroll = false } = {}) {
  let p = playItems().find((x) => x.name === name);
  if (!p) {
    const r = byName.get(name);
    if (!r || !r.live) return;
    p = { name, title: r.title, url: r.live };
  }
  const url = playUrl(p);
  if (!url) return;
  stage.current = p;
  const box = $("#stage");
  $("#stage-idle")?.remove();
  let f = $("iframe", box);
  if (!f) {
    f = document.createElement("iframe");
    f.setAttribute("allow", "fullscreen; autoplay; accelerometer; gyroscope; xr-spatial-tracking; clipboard-write; web-share");
    f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    box.appendChild(f);
  }
  f.title = `${p.title}, running live`;
  f.src = url;
  $("#stage-title").textContent = `${p.title}  ·  ${url.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  $("#stage-open").href = url;
  $("#stage-desc").textContent = playDesc(p);
  $$("#playlist button").forEach((b) => b.setAttribute("aria-current", String(b.dataset.play === name)));
  $(`#playlist button[data-play="${CSS.escape(name)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  if (scroll) document.getElementById("play").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  history.replaceState(null, "", `#play=${encodeURIComponent(name)}`);
}

function wirePlayer() {
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-play]");
    if (!b) return;
    e.preventDefault();
    load(b.dataset.play, { scroll: !b.closest("#playlist") });
  });
  $("#stage-reload").onclick = () => { const f = $("#stage iframe"); if (f) f.src = f.src; };
  $("#stage-full").onclick = () => { const s = $("#stage"); (s.requestFullscreen || s.webkitRequestFullscreen)?.call(s); };
  $("#stage-open").addEventListener("click", (e) => { if (!stage.current) e.preventDefault(); });

  const m = location.hash.match(/^#play=(.+)$/);
  if (m) { load(decodeURIComponent(m[1])); setTimeout(() => document.getElementById("play").scrollIntoView(), 50); return; }
  // Start Neuron Snake once the player comes into view, so nothing heavy loads before it is wanted.
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { io.disconnect(); if (!stage.current) load("neuron-game"); history.replaceState(null, "", location.pathname); }
  }, { rootMargin: "0px 0px -30% 0px" });
  io.observe($("#stage"));
}

/* ---------- activity ---------- */
function activity() {
  const now = new Date(DATA.updated);
  const thisMonth = now.getUTCFullYear() === DATA.year ? now.getUTCMonth() : 11;
  const months = Array(12).fill(0);
  DATA.repos.forEach((r) => r.months.forEach((n, i) => (months[i] += n)));
  const max = Math.max(...months, 1);
  $("#chart-title").textContent = `Commits per month, ${DATA.year}`;
  $("#chart-note").textContent = `${MONTHS[thisMonth]} is partway through`;
  $("#bars").innerHTML = months.map((n, i) => {
    const future = i > thisMonth;
    const h = future ? 0 : Math.max(1, (n / max) * 100);
    const label = future ? `${MONTHS[i]}: not yet` : `${MONTHS[i]}: ${fmt(n)} commits`;
    return `<div class="bar${future ? " future" : ""}" title="${label}"><span class="n">${future ? "" : fmt(n)}</span><span class="fill" style="height:${future ? 8 : h * 0.78}%"></span><span class="m">${MONTHS[i]}</span></div>`;
  }).join("");
  $("#bars").setAttribute("aria-label", months.slice(0, thisMonth + 1).map((n, i) => `${MONTHS[i]} ${n}`).join(", "));

  const top = [...DATA.repos].sort((a, b) => b.commits - a.commits).slice(0, 8);
  const tmax = top[0]?.commits || 1;
  $("#leaders").innerHTML = top.map((r) => `
    <li><a href="${esc(r.live || r.repo)}">${esc(r.title)}</a><span class="num">${fmt(r.commits)}</span>
    <span class="track"><i style="width:${(r.commits / tmax) * 100}%"></i></span></li>`).join("");
}

/* ---------- gallery ---------- */
async function gallery() {
  const items = await fetch("data/gallery.json").then((r) => r.json());
  $("#masonry").innerHTML = items.map((g, i) => {
    const w = 720, h = Math.round((g.h / g.w) * 720);
    return `<button type="button" data-i="${i}" aria-label="View ${esc(g.title)}"><img src="media/thumb/${g.slug}.webp" alt="${esc(g.title)}" loading="lazy" width="${w}" height="${h}"><span class="cap">${esc(g.title)}</span></button>`;
  }).join("");
  const lb = $("#lightbox"), img = $("img", lb), cap = $("figcaption", lb);
  let at = 0, opener = null;
  const show = (i) => { at = (i + items.length) % items.length; const g = items[at]; img.src = `media/full/${g.slug}.webp`; img.alt = g.title; cap.textContent = `${g.title}  ·  ${at + 1} of ${items.length}`; };
  const close = () => { lb.hidden = true; delete lb.dataset.single; document.body.style.overflow = ""; opener?.focus(); };
  $("#masonry").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; opener = b; show(+b.dataset.i); lb.hidden = false; document.body.style.overflow = "hidden"; $(".lb-close", lb).focus(); };
  $(".lb-close", lb).onclick = close;
  $(".lb-prev", lb).onclick = () => show(at - 1);
  $(".lb-next", lb).onclick = () => show(at + 1);
  lb.addEventListener("click", (e) => { if (e.target === lb || e.target.tagName === "FIGURE") close(); });
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    if (lb.dataset.single) return;
    if (e.key === "ArrowLeft") show(at - 1);
    if (e.key === "ArrowRight") show(at + 1);
  });
  let x0 = null;
  lb.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  // Covers open one at a time in the same viewer, with no previous or next.
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".single-view button[data-full]"); if (!b) return;
    opener = b; lb.dataset.single = "1";
    img.src = b.dataset.full; img.alt = b.dataset.title; cap.textContent = b.dataset.title;
    lb.hidden = false; document.body.style.overflow = "hidden"; $(".lb-close", lb).focus();
  });
  lb.addEventListener("touchend", (e) => { if (lb.dataset.single) return; if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) show(at + (dx < 0 ? 1 : -1)); x0 = null; });
}

/* ---------- YouTube, loaded only on click ---------- */
function wireYouTube() {
  $$(".yt").forEach((el) => {
    $("button", el).onclick = () => {
      el.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${el.dataset.yt}?autoplay=1&rel=0" title="TEDxKyoto talk" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    };
  });
}

/* ---------- publications ---------- */
async function papers() {
  let data;
  try { data = await fetch("data/publications.json").then((r) => r.json()); } catch { return; }
  const works = data.works;
  const nPapers = works.filter((w) => w.kind === "paper").length;
  const nNature = works.filter((w) => w.venue === "Nature").length;
  $("#papers-intro").textContent = `${nPapers} papers and ${works.length - nPapers} preprints, ${nNature} of them in Nature. From my ORCID record, with the journal version of each paper in place of its preprint. Connectomics papers have long author lists, so each shows its first author.`;
  let kind = "all";
  const kinds = [["all", "All", works.length], ["paper", "Papers", nPapers], ["preprint", "Preprints", works.length - nPapers]];
  $("#paper-kinds").innerHTML = kinds.map(([k, label, n]) => `<button class="chip" type="button" data-kind="${k}" aria-pressed="${k === kind}">${label}<span class="k">${n}</span></button>`).join("");
  const render = () => {
    let year = null, out = "";
    for (const w of works.filter((w) => kind === "all" || w.kind === kind)) {
      if (w.year !== year) { year = w.year; out += `<li class="yr" aria-hidden="true">${year}</li>`; }
      out += `<li class="paper"><a class="t" href="https://doi.org/${esc(w.doi)}">${esc(w.title)}</a>
        <span class="venue">${JOURNAL_LOGOS[w.venue]
          ? `<img class="jlogo" src="${JOURNAL_LOGOS[w.venue].src}" alt="${esc(w.venue)}" width="${JOURNAL_LOGOS[w.venue].w}" height="32" loading="lazy">`
          : `<span class="jtext">${esc(w.venue)}</span>`}${w.kind === "preprint" ? `<span class="pre">Preprint</span>` : ""}</span>
        <span class="by">${esc(w.first_author)} et al., ${year}</span></li>`;
    }
    $("#paper-list").innerHTML = out;
  };
  $("#paper-kinds").onclick = (e) => {
    const b = e.target.closest("[data-kind]"); if (!b) return;
    kind = b.dataset.kind;
    $$("#paper-kinds .chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    render();
  };
  render();
}

/* ---------- boot ---------- */
async function boot() {
  navSpy();
  wireYouTube();
  gallery();
  papers();
  try {
    DATA = await fetch("data/github.json").then((r) => r.json());
  } catch {
    $("#projects-intro").textContent = "The GitHub data didn't load. Every project is still on github.com/amyleesterling.";
    return;
  }
  DATA.repos.forEach((r) => byName.set(r.name, r));
  heroStats();
  buildPlaylist();
  wirePlayer();
  activity();
}
boot();
