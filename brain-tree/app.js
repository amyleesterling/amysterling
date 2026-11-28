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
const shortTitle = stop => stop.title.split(":")[0];
function mass(g) {
  if (g >= 1000) return trim(g / 1000) + " kg";
  if (g >= 1) return trim(g) + " g";
  return trim(g * 1000) + " mg";
}
function brainMass(stop) {
  const m = (stop.brain_dimensions || []).find(d => d.mass_g != null);
  return m ? `brain ≈ ${mass(m.mass_g)} · ${commonName(stop, m.species).toLowerCase()}` : "";
}
const thumbOf = path => path.replace("illustrations/", "illustrations/thumbs/");

// Stops are walked in tree order. Optional side branches added later carry
// high order numbers, so they are slotted in beside their sister branches
// rather than after the last stop on the trail.
function sequence(all) {
  const base = all.filter(s => !isExtra(s)).sort((a, b) => a.order - b.order);
  all.filter(isExtra).sort((a, b) => a.order - b.order).forEach(x => {
    let i = -1;
    base.forEach((s, k) => { if (s.parent === x.parent && s.branch === "side") i = k; });
    if (i < 0) i = base.findIndex(s => s.id === x.parent);
    base.splice(i + 1, 0, x);
  });
  base.forEach((s, k) => { s.seq = k; });
  return base;
}
let trailLength = 0;
const isExtra = s => s.order >= trailLength;

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
  const all = model.parts.concat(model.beads);
  if (all.some(p => p.struct === structure.name)) return { struct: structure.name, region: structure.region, byRegion: false };
  // nothing drawn for it: leave the model as it is rather than dim everything
  if (!all.some(p => p.region === structure.region)) return null;
  return { struct: structure.name, region: structure.region, byRegion: true };
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
  $("title").textContent = shortTitle(stop);
  closePlate();
  $("who").innerHTML = stop.exemplars.map((e, i) => e.illustration
    ? `<button type="button" class="bt-thumb" data-plate="${i}" aria-label="Show the ${esc(e.common)}">
        <img src="${esc(thumbOf(e.illustration.path))}" alt="" loading="lazy" decoding="async"><span>${esc(e.common)}</span></button>`
    : `<span class="bt-thumb bt-thumb-text"><span>${esc(e.common)}</span></span>`).join("");
  $("who").scrollLeft = 0;

  drawCount(stop, instant || !moved);
  if (moved) tab = "story";
  drawTabs();
  drawCards(stop);

  $("prev").disabled = at === 0;
  $("next").disabled = at === stops.length - 1;
  const rail = $("rail");
  if (rail.holobar && rail.holobar.step !== at + 1) rail.holobar.step = at + 1;
  if (location.hash.slice(1) !== stop.id) history.replaceState(null, "", "#" + stop.id);
  document.title = shortTitle(stop) + " · Brain Tree";

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
      ${brainMass(stop) ? `<p class="bt-tags"><span class="bt-tag">${esc(brainMass(stop))}</span></p>` : ""}
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

// the species plates: tap a thumbnail and the animal takes the stage
let plateOn = -1;
function openPlate(i) {
  const e = stops[at].exemplars[i];
  if (!e || !e.illustration) return;
  if (plateOn === i) return closePlate();
  plateOn = i;
  const img = $("plate-img");
  img.classList.remove("is-in");
  img.onload = () => img.classList.add("is-in");
  img.src = e.illustration.path;
  img.alt = e.common + ", " + e.scientific;
  $("plate-cap").innerHTML = `<b>${esc(e.common)}</b> <i>${esc(e.scientific)}</i><small>${esc(e.illustration.medium || "Illustration")}</small>`;
  $("plate").hidden = false;
  document.body.classList.add("plate-open");
  $("who").querySelectorAll(".bt-thumb").forEach(t => t.classList.toggle("is-on", +t.dataset.plate === i));
}
function closePlate() {
  if (plateOn < 0) return;
  plateOn = -1;
  $("plate").hidden = true;
  document.body.classList.remove("plate-open");
  $("who").querySelectorAll(".bt-thumb").forEach(t => t.classList.remove("is-on"));
}

function pickTab(id) {
  tab = id;
  drawTabs();
  drawCards(stops[at]);
}

// tapping a part on the model opens its card
function onPick(hit) {
  if (!hintGone) { hintGone = true; $("hint").classList.add("is-gone"); }
  if (plateOn >= 0) return closePlate();
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
  // the trail runs up the left and every side branch steps out to the right
  const col = {};
  stops.forEach(s => { col[s.id] = main.has(s.id) ? 0 : main.has(s.parent) ? 1 : col[s.parent]; });
  const W = 340, rowH = 50, H = stops.length * rowH + 24, x0 = 26, dx = 96;
  const X = s => x0 + col[s.id] * dx;
  const Y = s => H - 30 - s.seq * rowH;
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
    nodes += `<g class="bt-node${s.seq === at ? " is-here" : ""}" data-go="${s.seq}" tabindex="0" role="button" aria-label="${esc(s.title)}">
      <circle cx="${x}" cy="${y}" r="20" class="hit"/><circle cx="${x}" cy="${y}" r="${s.seq === at ? 9 : 6.5}" class="pip"/>
      <text x="${tx}" y="${y - 2}" text-anchor="${anchor}">${esc(shortTitle(s))}</text>
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
  $("src-note").textContent = `${list.length} papers behind “${shortTitle(stop)}”.`;
  const refs = stop.references || [];
  $("refs-h").hidden = !refs.length;
  $("refs").innerHTML = refs.map(r => `<li><b>${esc(r.figure)}</b>, ${esc(r.species)}: ${esc(r.shows)} ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">paper</a>` : ""}</li>`).join("");
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
  trailLength = Math.max(...data.stops.filter(s => s.branch === "trunk").map(s => s.order)) + 1;
  stops = sequence(data.stops.slice());
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

  $("who").addEventListener("click", e => {
    const t = e.target.closest("[data-plate]");
    if (t) openPlate(+t.dataset.plate);
  });
  $("plate").addEventListener("click", closePlate);

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
