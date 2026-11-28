// Brain Tree: the interface. Reads data.json (the sourced research), draws
// the stop you are on, and tells the stage what to light.

import { buildModel, REGION_COLORS } from "./models.js";
import { createScene } from "./scene.js";

const $ = id => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const TABS = [
  { id: "story", label: "Story" },
  { id: "new", label: "Parts" },
  { id: "does", label: "Powers" },
  { id: "twist", label: "Plot twists" },
  { id: "map", label: "Mapped?" },
];
const ORIGIN = {
  new: "new here",
  elaborated: "built on older parts",
  convergent: "evolved separately",
};
const TWIST = { myth: "myth", debate: "open debate", exception: "exception" };
const MAPPED = { complete: "Fully mapped", partial: "Partly mapped", none: "Not mapped yet" };

let data, stops, sources, scene, model;
let at = 0, tab = "story", finaleDone = false, hintGone = false;

// ---------- formatting ----------
function bigNumber(v) {
  if (v >= 1e9) return trim(v / 1e9) + " billion";
  if (v >= 1e6) return trim(v / 1e6) + " million";
  return Math.round(v).toLocaleString("en-US");
}
function trim(n) {
  return (n >= 100 ? Math.round(n) : n >= 10 ? Math.round(n * 10) / 10 : Math.round(n * 100) / 100).toLocaleString("en-US");
}
function era(mya) {
  const v = mya >= 100 ? Math.round(mya / 10) * 10 : Math.round(mya);
  return "≈ " + v.toLocaleString("en-US") + " million years ago";
}
function commonName(stop, scientific) {
  const hit = stop.exemplars.find(e => e.scientific === scientific);
  return hit ? hit.common : scientific;
}
function headline(stop) {
  const withValue = stop.neuron_counts.find(n => n.value != null);
  if (withValue) return withValue;
  return stop.neuron_counts.find(n => n.estimate_text) || null;
}

// ---------- the stop ----------
function featuredFor(stop) {
  const structs = new Set(stop.structures.map(s => s.name));
  const tagged = new Set(model.parts.map(p => p.struct).concat(model.beads.map(b => b.struct)).filter(Boolean));
  const regions = new Set();
  stop.structures.forEach(s => {
    if (!tagged.has(s.name) && s.region !== "other" && s.region !== "cellular") regions.add(s.region);
  });
  return { structs, regions };
}
function focusFor(structure) {
  if (!structure) return null;
  const tagged = model.parts.some(p => p.struct === structure.name) || model.beads.some(b => b.struct === structure.name);
  return { struct: structure.name, region: structure.region, byRegion: !tagged };
}

function go(i, instant) {
  i = Math.max(0, Math.min(stops.length - 1, i));
  const moved = i !== at;
  at = i;
  const stop = stops[at];
  model = buildModel(stop.id);
  if (scene) {
    scene.setModel(model, instant);
    scene.setFeatured(featuredFor(stop));
  }
  document.documentElement.style.setProperty("--bt-progress", (at / (stops.length - 1)).toFixed(3));
  document.body.dataset.stop = stop.id;

  const head = $("head");
  head.classList.remove("is-in");
  void head.offsetWidth;
  head.classList.add("is-in");
  $("era").textContent = era(stop.diverged_mya.value);
  $("title").textContent = stop.title;
  $("who").textContent = stop.exemplars.map(e => e.common).join(" · ");

  drawCount(stop, instant || !moved);
  if (moved) tab = "story";
  drawTabs();
  drawCards(stop);

  $("prev").disabled = at === 0;
  $("next").disabled = at === stops.length - 1;
  const rail = $("rail");
  if (rail.holobar && rail.holobar.step !== at + 1) rail.holobar.step = at + 1;
  if (location.hash.slice(1) !== stop.id) history.replaceState(null, "", "#" + stop.id);
  document.title = stop.title + " · Brain Tree";

  if (at === stops.length - 1 && !finaleDone && moved && !instant && window.holoburst) {
    finaleDone = true;
    setTimeout(() => window.holoburst("default", 2), 650);
  }
}

let countRaf = 0;
function drawCount(stop, instant) {
  const h = headline(stop);
  const n = $("count-n"), l = $("count-l"), mag = $("mag");
  cancelAnimationFrame(countRaf);
  if (!h) {
    n.textContent = "not counted";
    l.textContent = "no whole-brain neuron count yet";
    mag.innerHTML = "";
    return;
  }
  const who = commonName(stop, h.species);
  const where = (h.region || "").split(";")[0].trim();
  l.innerHTML = "neurons · " + esc(who) + (where ? " · " + esc(where) : "");
  if (h.value == null) {
    n.textContent = "a few thousand";
    if (!/few thousand/.test(h.estimate_text || "")) n.textContent = "uncounted";
    l.innerHTML = esc(h.estimate_text || "");
    mag.innerHTML = "";
    return;
  }
  const approx = h.estimate_text || h.value >= 1e6 ? "≈ " : "";
  const digits = h.value > 0 ? Math.floor(Math.log10(h.value)) + 1 : 0;
  mag.innerHTML = Array.from({ length: 12 }, (_, i) => `<i${i < digits ? ' class="on"' : ""} style="--i:${i}"></i>`).join("");
  mag.title = digits + " digits";
  if (instant || reduced || h.value === 0) { n.textContent = approx + bigNumber(h.value); return; }
  const t0 = performance.now(), dur = 900, top = Math.log10(h.value + 1);
  (function step(now) {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    n.textContent = approx + bigNumber(k === 1 ? h.value : Math.pow(10, top * e) - 1);
    if (k < 1) countRaf = requestAnimationFrame(step);
  })(t0);
}

function drawTabs() {
  $("tabs").innerHTML = TABS.map(t =>
    `<button type="button" role="tab" class="bt-tab" data-tab="${t.id}" aria-selected="${t.id === tab}">${t.label}</button>`).join("");
}

function conf(c) {
  if (!c || c === "settled" || c === "well supported") return "";
  return `<span class="bt-conf bt-conf-${c === "disputed" ? "d" : "s"}">${c === "disputed" ? "scientists disagree" : "one study so far"}</span>`;
}
function dot(region) {
  return `<i class="bt-dot" style="--c:${REGION_COLORS[region] || "#cfe"}"></i>`;
}

function cardsFor(stop) {
  if (tab === "story") {
    const d = stop.diverged_mya;
    return [`<article class="holopanel bt-card bt-card-story">
      <p class="bt-lede">${esc(stop.summary)}</p>
      <p class="bt-fine">The date is for this branch point: ${esc(d.node)}, ${Math.round(d.min)} to ${Math.round(d.max)} million years ago.</p>
    </article>`];
  }
  if (tab === "new") {
    return stop.structures.map((s, i) => `<article class="holopanel bt-card" data-struct="${i}">
      <h3>${dot(s.region)}${esc(s.name)}</h3>
      <p>${esc(s.description)}</p>
      <p class="bt-tags">${s.origin ? `<span class="bt-tag bt-tag-${s.origin}">${ORIGIN[s.origin]}</span>` : `<span class="bt-tag">origin unknown</span>`}${conf(s.confidence)}</p>
    </article>`);
  }
  if (tab === "does") {
    return stop.abilities.map(a => {
      const linked = (a.linked_structures || []).map(n => stop.structures.findIndex(s => s.name === n)).filter(i => i >= 0);
      const first = linked.length ? stop.structures[linked[0]] : null;
      return `<article class="holopanel bt-card"${linked.length ? ` data-struct="${linked[0]}"` : ""}>
        <h3>${first ? dot(first.region) : ""}${esc(a.name)}</h3>
        <p>${esc(a.description)}</p>
        <p class="bt-tags">${first ? `<span class="bt-tag">uses: ${esc(first.name.toLowerCase())}</span>` : ""}${conf(a.confidence)}</p>
      </article>`;
    });
  }
  if (tab === "twist") {
    return stop.nuances.map(n => `<article class="holopanel bt-card bt-card-twist">
      <p class="bt-kicker">${TWIST[n.type] || n.type}</p>
      <h3>${n.type === "debate" ? esc(n.claim) : "“" + esc(n.claim) + "”"}</h3>
      <p>${esc(n.reality)}</p>
    </article>`);
  }
  const c = stop.connectome, q = stop.open_question, out = [];
  out.push(`<article class="holopanel bt-card">
    <p class="bt-kicker">wiring diagram</p>
    <h3>${MAPPED[c.status] || "Mapping status unclear"}</h3>
    <p>${esc(c.description || "")}</p>
    <p class="bt-tags">${(c.projects || []).map(p => `<a class="bt-tag bt-link" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)} ${p.year || ""}</a>`).join("")}</p>
  </article>`);
  if (q && q.text) out.push(`<article class="holopanel bt-card bt-card-twist">
    <p class="bt-kicker">still unknown</p>
    <h3>${esc(q.text)}</h3>
  </article>`);
  return out;
}

function drawCards(stop) {
  const box = $("cards");
  const list = cardsFor(stop);
  box.innerHTML = list.join("") || `<article class="holopanel bt-card"><p>Nothing recorded here yet.</p></article>`;
  box.dataset.count = list.length;
  box.scrollLeft = 0;
  box.querySelectorAll(".bt-card").forEach((c, i) => c.style.setProperty("--i", i));
  syncFocus();
}

// whichever card sits in the middle of the carousel lights its part
function syncFocus() {
  if (!scene) return;
  const box = $("cards"), stop = stops[at];
  const cards = [...box.querySelectorAll(".bt-card")];
  if (!cards.length) return;
  const mid = box.getBoundingClientRect().left + box.clientWidth / 2;
  let best = cards[0], bd = 1e9;
  cards.forEach(c => {
    const r = c.getBoundingClientRect(), d = Math.abs((r.left + r.right) / 2 - mid);
    if (d < bd) { bd = d; best = c; }
  });
  cards.forEach(c => c.classList.toggle("is-on", c === best));
  const idx = best.dataset.struct;
  scene.setFocus(idx != null && tab !== "story" ? focusFor(stop.structures[+idx]) : null);
}

function pickTab(id) {
  tab = id;
  drawTabs();
  drawCards(stops[at]);
}

// tapping a part on the model opens its card
function onPick(hit) {
  if (!hintGone) { hintGone = true; $("hint").classList.add("is-gone"); }
  if (!hit) { if (tab !== "story") pickTab("story"); return; }
  const stop = stops[at];
  let i = hit.struct ? stop.structures.findIndex(s => s.name === hit.struct) : -1;
  if (i < 0) i = stop.structures.findIndex(s => s.region === hit.region);
  if (i < 0) return;
  if (tab !== "new") pickTab("new");
  const card = $("cards").querySelector(`[data-struct="${i}"]`);
  if (card) card.scrollIntoView({ behavior: reduced ? "auto" : "smooth", inline: "center", block: "nearest" });
}

// ---------- the tree sheet ----------
function drawTree() {
  const byId = Object.fromEntries(stops.map(s => [s.id, s]));
  const main = new Set();
  for (let s = stops[stops.length - 1]; s; s = byId[s.parent]) main.add(s.id);
  // the trail runs up the left; side branches step out to the right, and a
  // second branch off the same stop steps out further so the two do not overlap
  const col = {}, used = {};
  stops.forEach(s => {
    if (main.has(s.id)) col[s.id] = 0;
    else if (main.has(s.parent)) { used[s.parent] = (used[s.parent] || 0) + 1; col[s.id] = used[s.parent]; }
    else col[s.id] = col[s.parent];
  });
  const W = 340, rowH = 58, H = stops.length * rowH + 24, x0 = 26, dx = 84;
  const X = s => x0 + col[s.id] * dx;
  const Y = s => H - 30 - s.order * rowH;
  let paths = "", nodes = "";
  stops.forEach(s => {
    const p = byId[s.parent];
    if (p) {
      const x1 = X(p), y1 = Y(p), x2 = X(s), y2 = Y(s);
      paths += `<path d="M${x1} ${y1} C${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2 + 14}, ${x2} ${y2}" class="${main.has(s.id) ? "trunk" : "twig"}"/>`;
    }
  });
  stops.forEach(s => {
    const x = X(s), y = Y(s), anchor = "start", tx = x + 16;
    nodes += `<g class="bt-node${s.order === at ? " is-here" : ""}" data-go="${s.order}" tabindex="0" role="button" aria-label="${esc(s.title)}">
      <circle cx="${x}" cy="${y}" r="20" class="hit"/><circle cx="${x}" cy="${y}" r="${s.order === at ? 9 : 6.5}" class="pip"/>
      <text x="${tx}" y="${y - 2}" text-anchor="${anchor}">${esc(s.title)}</text>
      <text x="${tx}" y="${y + 12}" text-anchor="${anchor}" class="sub">${esc(s.exemplars[0].common.toLowerCase())}</text></g>`;
  });
  $("tree").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Branching tree of the stops">
    <defs><linearGradient id="bt-grad" gradientUnits="userSpaceOnUse" x1="0" y1="${H}" x2="0" y2="0">
      <stop offset="0" stop-color="#5fe6d2"/><stop offset=".45" stop-color="#8fe38a"/>
      <stop offset=".75" stop-color="#ffd166"/><stop offset="1" stop-color="#ff8fbf"/></linearGradient></defs>
    ${paths}${nodes}</svg>`;
}

function drawSources() {
  const stop = stops[at], ids = new Set();
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o.source_ids)) o.source_ids.forEach(i => ids.add(i));
    if (o.source_id) ids.add(o.source_id);
    Object.values(o).forEach(walk);
  })(stop);
  const byId = Object.fromEntries(sources.map(s => [s.id, s]));
  const list = [...ids].map(i => byId[i]).filter(Boolean).sort((a, b) => a.citation.localeCompare(b.citation));
  $("src-note").textContent = `${list.length} papers behind “${stop.title}”.`;
  $("sources").innerHTML = list.map(s => {
    const href = s.doi ? "https://doi.org/" + s.doi : s.url;
    return `<li>${esc(s.citation)} ${href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${s.doi ? "doi" : "link"}</a>` : ""}</li>`;
  }).join("");
}

// ---------- wiring ----------
function measure() {
  if (!scene) return;
  const f = $("frame").getBoundingClientRect();
  scene.resize();
  scene.setFrame({ cx: f.left + f.width / 2, cy: f.top + f.height / 2, size: Math.min(f.width * 0.96, f.height * 1.02) });
}

async function start() {
  const res = await fetch("data.json");
  data = await res.json();
  stops = data.stops.slice().sort((a, b) => a.order - b.order);
  sources = data.sources;

  scene = createScene($("stage"), { reduced, onPick });
  if (!scene) document.body.classList.add("no-webgl");

  const rail = $("rail");
  rail.setAttribute("data-steps", stops.length);
  rail.addEventListener("holobar:change", e => {
    const n = (e.detail && e.detail.step) || +rail.getAttribute("data-step");
    if (n - 1 !== at) go(n - 1);
  });

  $("prev").addEventListener("click", () => go(at - 1));
  $("next").addEventListener("click", () => go(at + 1));
  $("tabs").addEventListener("click", e => {
    const b = e.target.closest("[data-tab]");
    if (b) pickTab(b.dataset.tab);
  });
  let scrollT = 0;
  $("cards").addEventListener("scroll", () => {
    cancelAnimationFrame(scrollT);
    scrollT = requestAnimationFrame(syncFocus);
  }, { passive: true });
  $("cards").addEventListener("click", e => {
    const c = e.target.closest(".bt-card");
    if (!c || e.target.closest("a")) return;
    c.scrollIntoView({ behavior: reduced ? "auto" : "smooth", inline: "center", block: "nearest" });
    if (c.dataset.struct != null && scene) scene.kick(stops[at].structures[+c.dataset.struct].name);
  });

  // swipe the title block sideways to change stop
  let sx = null;
  const head = $("head");
  head.addEventListener("pointerdown", e => { sx = e.clientX; });
  head.addEventListener("pointerup", e => {
    if (sx == null) return;
    const d = e.clientX - sx; sx = null;
    if (Math.abs(d) > 44) go(at + (d < 0 ? 1 : -1));
  });

  document.addEventListener("keydown", e => {
    if (e.target.closest && e.target.closest(".holobar, dialog, .bt-cards")) return;
    if (e.key === "ArrowRight") go(at + 1);
    else if (e.key === "ArrowLeft") go(at - 1);
  });

  $("open-tree").addEventListener("click", () => { drawTree(); $("tree-sheet").showModal(); });
  $("open-sources").addEventListener("click", () => { drawSources(); $("sources-sheet").showModal(); });
  $("tree").addEventListener("click", e => {
    const g = e.target.closest("[data-go]");
    if (g) { $("tree-sheet").close(); go(+g.dataset.go); }
  });
  $("tree").addEventListener("keydown", e => {
    const g = e.target.closest("[data-go]");
    if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); $("tree-sheet").close(); go(+g.dataset.go); }
  });
  document.querySelectorAll("dialog.bt-sheet").forEach(d => {
    d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
  });

  window.addEventListener("hashchange", () => {
    const i = stops.findIndex(s => s.id === location.hash.slice(1));
    if (i >= 0 && i !== at) go(i);
  });
  new ResizeObserver(measure).observe($("frame"));
  window.addEventListener("resize", measure);

  const first = stops.findIndex(s => s.id === location.hash.slice(1));
  at = -1;
  go(first >= 0 ? first : 0, true);
  measure();
  document.body.classList.add("is-ready");
}

// hologram.js builds the step rail on load, and is deferred; wait for it
if (document.readyState === "complete") start();
else window.addEventListener("load", start);
