import { specimenRecords, models } from "./species.js";
import { buildModel } from "./models.js";

const $ = (id) => document.getElementById(id);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const slug = (e) => e.scientific.toLowerCase().replaceAll(" ", "-");
const href = (s, e) => "#" + s.id + (e ? "/" + slug(e) : "");
let stops,
  sources,
  byId,
  stop,
  animal,
  view = "Discoveries",
  scene,
  scenePromise,
  generation = 0,
  schematic = false;
const trail = new Set();
function citations(r) {
  const ids = [
    ...new Set(
      [
        ...(r.source_ids || []),
        ...(r.additional_evidence || []).map((x) => x.source_id),
      ].filter(Boolean),
    ),
  ];
  return ids
    .map((id) => sources.get(id))
    .filter(Boolean)
    .map(
      (s) =>
        '<li><a target="_blank" rel="noopener" href="' +
        esc(s.doi ? "https://doi.org/" + s.doi : s.url) +
        '">' +
        esc(s.citation) +
        "</a></li>",
    )
    .join("");
}
function evidence(r) {
  const links = citations(r);
  if (!links && !r.evidence_quote) return "";
  return (
    "<details><summary>How do we know?</summary>" +
    (r.confidence ? '<p class="small">' + esc(r.confidence) + "</p>" : "") +
    (r.method ? "<p>" + esc(r.method) + "</p>" : "") +
    (r.evidence_quote
      ? "<blockquote>“" + esc(r.evidence_quote) + "”</blockquote>"
      : "") +
    (links ? "<ul>" + links + "</ul>" : "") +
    "</details>"
  );
}
function card(title, body, r, tag = "") {
  return (
    '<article class="card"><h3>' +
    esc(title) +
    "</h3>" +
    (tag ? '<span class="tag">' + esc(tag) + "</span>" : "") +
    "<p>" +
    esc(body) +
    "</p>" +
    evidence(r) +
    "</article>"
  );
}
function matching(r) {
  return (r.species || "")
    .split(";")
    .some(
      (name) =>
        name.trim() === animal.scientific ||
        name.trim().startsWith(animal.scientific + " ("),
    );
}
function figures() {
  return stop.references
    .filter(matching)
    .map((r) => card(r.figure, r.shows, r, r.stage || r.view))
    .join("");
}
function number(v) {
  if (typeof v === "number")
    return v.toLocaleString("en-US", { maximumFractionDigits: 8 });
  if (v.min != null && v.max != null)
    return number(v.min) + "–" + number(v.max);
  return Object.entries(v)
    .map(([k, n]) => k.replaceAll("_", " ") + " " + number(n))
    .join(", ");
}
function measurements() {
  const counts = stop.neuron_counts
    .filter(matching)
    .filter((r) => r.value != null || r.estimate_text);
  const countCards = counts
    .map((r) => {
      const title =
        r.value == null
          ? r.estimate_text
          : number(r.value) + " " + (r.unit || "neurons");
      const subject = animal.common + " · " + r.region;
      return card(
        title,
        subject +
          (r.value != null && r.estimate_text ? ". " + r.estimate_text : ""),
        r,
      );
    })
    .join("");
  const dims = stop.brain_dimensions
    .filter(matching)
    .map((r) => {
      const fields = [
        ["length_mm", "Length", "mm"],
        ["width_mm", "Width", "mm"],
        ["height_mm", "Height", "mm"],
        ["thickness_mm", "Thickness", "mm"],
        ["depth_mm", "Depth", "mm"],
        ["mass_g", "Mass", "g"],
        ["volume_mm3", "Volume", "mm³"],
      ];
      const values = fields
        .filter(([k]) => r[k] != null)
        .map(([k, label, unit]) => label + " " + number(r[k]) + " " + unit);
      return values.length
        ? card(
            r.region,
            values.join(" · "),
            r,
            [r.stage, r.source_location].filter(Boolean).join(" · "),
          )
        : "";
    })
    .join("");
  return (
    (countCards ||
      '<p class="card">A verified neuron count for this specimen is unavailable here.</p>') +
    dims
  );
}
function renderCards(selected) {
  const tabs = ["Discoveries", "Anatomy", "Measurements"];
  $("tabs").innerHTML = tabs
    .map(
      (t) =>
        '<button data-tab="' +
        t +
        '" aria-pressed="' +
        (view === t) +
        '">' +
        t +
        "</button>",
    )
    .join("");
  const anatomy = specimenRecords(stop, animal, "structures"),
    abilities = specimenRecords(stop, animal, "abilities");
  if (view === "Measurements") $("cards").innerHTML = measurements();
  else if (view === "Anatomy") {
    const ordered = selected
      ? [...anatomy].sort(
          (a, b) => Number(b.name === selected) - Number(a.name === selected),
        )
      : anatomy;
    const origins = {
      new: "New in this lineage",
      elaborated: "Elaborated from an inherited structure",
      convergent: "Evolved independently",
    };
    $("cards").innerHTML =
      ordered
        .map((r) =>
          card(
            r.name,
            r.description,
            r,
            origins[r.origin] || "Origin unresolved",
          ),
        )
        .join("") + figures();
  } else {
    $("cards").innerHTML =
      abilities
        .map((r) =>
          card(
            r.name,
            r.description,
            r,
            (r.linked_structures || []).join(" · "),
          ),
        )
        .join("") ||
      anatomy.map((r) => card(r.name, r.description, r)).join("") ||
      figures();
  }
  if (!$("cards").innerHTML)
    $("cards").innerHTML =
      '<p class="card">See the branch research below for comparative evidence.</p>';
}
function branchContext() {
  const d = stop.diverged_mya,
    c = stop.connectome,
    q = stop.open_question;
  const content =
    card(
      "When the lineages split",
      d.node +
        " · " +
        number(d.min) +
        "–" +
        number(d.max) +
        " million years ago",
      d,
    ) +
    "<h3>What was inherited</h3>" +
    stop.inherited.map((r) => card(r.name, "", r)).join("") +
    "<h3>Across this branch</h3>" +
    [...stop.structures, ...stop.abilities]
      .map((r) => card(r.name, r.description, r))
      .join("") +
    stop.nuances.map((r) => card(r.claim, r.reality, r, r.type)).join("") +
    card("Synaptic mapping", c.description, c) +
    (c.projects || [])
      .map(
        (p) =>
          '<p><a href="' +
          esc(p.url) +
          '">' +
          esc(p.name) +
          " " +
          esc(p.year) +
          "</a></p>",
      )
      .join("") +
    card("Open question", q.text, q) +
    "<h3>Published anatomical figures</h3>" +
    stop.references.map((r) => card(r.figure, r.shows, r, r.species)).join("") +
    "<details><summary>Sources for the branch summary</summary><ul>" +
    citations(stop.summary_evidence || {}) +
    "</ul></details>";
  $("branch").innerHTML =
    "<details><summary>Branch research · " +
    esc(stop.title) +
    '</summary><div class="overview">' +
    content +
    "</div></details>";
}
function layoutScene() {
  if (!scene || !schematic) return;
  const f = $("frame").getBoundingClientRect();
  scene.resize();
  scene.setFrame({
    cx: f.width / 2,
    cy: f.height / 2,
    size: Math.min(f.width, f.height) * 0.94,
  });
}
function plate() {
  schematic = false;
  scene?.setActive(false);
  $("stage").hidden = true;
  $("animal").hidden = false;
  $("mode").textContent = "View schematic";
  $("stage-note").textContent =
    animal.illustration.view_note || "Whole-animal illustration";
}
async function toggleModel() {
  if (schematic) {
    plate();
    return;
  }
  const token = ++generation;
  const key = models[animal.scientific];
  if (!key) return;
  $("stage").hidden = false;
  try {
    scenePromise ||= import("./scene.js").then((m) =>
      m.createScene($("stage"), {
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
        onPick(hit) {
          if (
            !hit?.struct ||
            !specimenRecords(stop, animal, "structures").some(
              (r) => r.name === hit.struct,
            )
          )
            return;
          view = "Anatomy";
          renderCards(hit.struct);
          scene.setFocus({ struct: hit.struct, byRegion: false });
        },
      }),
    );
    scene = await scenePromise;
    if (token !== generation) return;
    if (!scene) throw Error("WebGL unavailable");
    const model = buildModel(key),
      allowed = new Set(
        specimenRecords(stop, animal, "structures").map((r) => r.name),
      );
    for (const p of [...model.parts, ...model.beads])
      if (!allowed.has(p.struct)) p.struct = null;
    schematic = true;
    $("animal").hidden = true;
    scene.setActive(true);
    scene.setModel(model, true);
    scene.setFeatured({ structs: allowed, regions: new Set() });
    layoutScene();
    $("mode").textContent = "View animal";
    $("stage-note").textContent =
      key === "comb-net-detail"
        ? "Larval nerve net · conceptual detail of a shared membrane"
        : "Anatomical schematic · drag to rotate";
  } catch {
    if (token !== generation) return;
    plate();
    $("mode").hidden = true;
    $("stage-note").textContent =
      "3D unavailable on this device · anatomical figures under Anatomy";
  }
}
function jump(s, e) {
  location.hash = href(s, e);
}
function showLocation() {
  const [id, sp] = location.hash.slice(1).split("/");
  const next = byId.get(id) || stops[0],
    pick = next.exemplars.find((e) => slug(e) === sp) || next.exemplars[0];
  const moved = next !== stop;
  stop = next;
  animal = pick;
  ++generation;
  view = "Discoveries";
  plate();
  const parent = byId.get(stop.parent),
    children = stops.filter((s) => s.parent === stop.id);
  $("title").textContent = stop.title;
  document.title = animal.common + " · Brain Tree";
  $("summary").textContent = stop.summary;
  $("branch-label").textContent = trail.has(stop.id)
    ? "Guided trail"
    : "Side branch";
  $("fork").hidden = !parent;
  $("fork").textContent = parent ? "↶ " + parent.title : "";
  $("picker").innerHTML = stop.exemplars
    .map(
      (e) =>
        '<button data-species="' +
        slug(e) +
        '" aria-pressed="' +
        (e === animal) +
        '"><img src="' +
        esc(e.illustration.path) +
        '" alt="">' +
        esc(e.common) +
        "</button>",
    )
    .join("");
  $("animal").src = animal.illustration.path;
  $("animal").alt = animal.common + " (" + animal.scientific + ")";
  $("latin").textContent = animal.scientific;
  $("species").textContent = animal.common;
  $("mode").hidden = !models[animal.scientific];
  renderCards();
  branchContext();
  const forward = children
    .slice()
    .sort((a, b) => Number(trail.has(b.id)) - Number(trail.has(a.id)));
  $("routes").innerHTML =
    forward
      .map(
        (s) =>
          '<a href="' +
          href(s) +
          '">' +
          (trail.has(s.id) ? "Continue" : "Explore") +
          " · " +
          esc(s.title) +
          " →</a>",
      )
      .join("") +
    (parent
      ? '<a href="' +
        href(parent) +
        '">↶ Return to ' +
        esc(parent.title) +
        "</a>"
      : "");
  if (moved) window.scrollTo(0, 0);
}
function treeNode(s) {
  const children = stops.filter((r) => r.parent === s.id);
  return (
    '<li><a href="' +
    href(s) +
    '" ' +
    (s === stop ? 'aria-current="page"' : "") +
    ">" +
    esc(s.title) +
    "</a>" +
    (children.length
      ? "<ul>" + children.map(treeNode).join("") + "</ul>"
      : "") +
    "</li>"
  );
}
async function start() {
  const response = await fetch("data.json");
  if (!response.ok) throw Error("Research data unavailable");
  const data = await response.json();
  stops = data.stops;
  byId = new Map(stops.map((s) => [s.id, s]));
  sources = new Map(data.sources.map((s) => [s.id, s]));
  for (let s = byId.get("primates-and-humans"); s; s = byId.get(s.parent))
    trail.add(s.id);
  $("tree-open").onclick = () => {
    $("tree-list").innerHTML =
      "<ul>" +
      stops
        .filter((s) => !s.parent)
        .map(treeNode)
        .join("") +
      "</ul>";
    $("tree").showModal();
  };
  $("tree-list").onclick = (e) => {
    if (e.target.closest("a")) $("tree").close();
  };
  $("close").onclick = () => $("tree").close();
  $("picker").onclick = (e) => {
    const b = e.target.closest("[data-species]");
    if (b)
      jump(
        stop,
        stop.exemplars.find((a) => slug(a) === b.dataset.species),
      );
  };
  $("tabs").onclick = (e) => {
    const b = e.target.closest("[data-tab]");
    if (b) {
      view = b.dataset.tab;
      renderCards();
      $("tabs").querySelector("[aria-pressed=true]").focus();
      scene?.setFocus(null);
    }
  };
  $("fork").onclick = () => jump(byId.get(stop.parent));
  $("mode").onclick = toggleModel;
  new ResizeObserver(layoutScene).observe($("frame"));
  window.addEventListener("hashchange", showLocation);
  showLocation();
}
start().catch(() => {
  $("summary").textContent =
    "The collection could not load. Refresh to try again.";
});
