// The network map of public repos, drawn from the same data/github.json as the rest
// of the page. Same idea as the repository mapper: projects that share words in
// their names and descriptions pull together, and each room has its own pull.
// Dot size is this year's commits. Drag a dot, hover to read, click to open.
const d3 = window.d3;
const svgEl = document.getElementById("net-svg");
if (d3 && svgEl) boot();

const ROOM_COLORS = ["#7cc4ff", "#4d8dff", "#a9dbff", "#7c93ff", "#5fd0e6", "#9fb4ff", "#3e6fd8"];
const STOP = new Set(("a an and are as at be by for from in into is it its of on or that the this to with your you my me our we " +
  "app site page web tool tools game games project projects repo built made make using use new one all about every real " +
  "how what who why when where can than then their them they so not but just like more most very also each own via").split(" "));

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const words = (r) => new Set(`${r.title} ${r.name.replace(/[-_]/g, " ")} ${r.description}`.toLowerCase()
  .replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w)));

async function boot() {
  const data = await fetch("data/github.json").then((r) => r.json());
  const roomIds = Object.keys(data.rooms);
  const color = (id) => ROOM_COLORS[roomIds.indexOf(id) % ROOM_COLORS.length];

  // ---- links: shared rare words, each repo keeps its three strongest ----
  const nodes = data.repos.map((r) => ({ ...r, w: words(r) }));
  const df = new Map();
  nodes.forEach((n) => n.w.forEach((w) => df.set(w, (df.get(w) || 0) + 1)));
  const idf = (w) => Math.log(nodes.length / (df.get(w) || 1));
  const best = new Map();
  for (let i = 0; i < nodes.length; i++) {
    const cand = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      let s = 0;
      for (const w of nodes[i].w) if (nodes[j].w.has(w) && df.get(w) > 1) s += idf(w);
      if (nodes[i].room === nodes[j].room) s += 0.4;
      if (s > 1.6) cand.push([j, s]);
    }
    cand.sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([j, s]) => {
      const k = i < j ? `${i}-${j}` : `${j}-${i}`;
      best.set(k, Math.max(best.get(k) || 0, s));
    });
  }
  const links = [...best].map(([k, s]) => { const [a, b] = k.split("-").map(Number); return { source: a, target: b, s }; });

  // ---- layout ----
  const svg = d3.select(svgEl);
  const box = () => svgEl.getBoundingClientRect();
  let { width: W, height: H } = box();
  const radius = (n) => 4 + Math.min(18, Math.sqrt(n.commits) * 0.75);
  const centre = (id) => {
    const a = (roomIds.indexOf(id) / roomIds.length) * Math.PI * 2 - Math.PI / 2;
    return [W / 2 + Math.cos(a) * W * 0.28, H / 2 + Math.sin(a) * H * 0.28];
  };
  const sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).distance(42).strength((l) => Math.min(0.5, l.s / 12)))
    .force("charge", d3.forceManyBody().strength(-38))
    .force("x", d3.forceX((n) => centre(n.room)[0]).strength(0.07))
    .force("y", d3.forceY((n) => centre(n.room)[1]).strength(0.09))
    .force("collide", d3.forceCollide((n) => radius(n) + 2));

  const gLinks = svg.append("g").attr("class", "net-links");
  const gNodes = svg.append("g").attr("class", "net-nodes");
  const line = gLinks.selectAll("line").data(links).join("line").attr("stroke-width", (l) => Math.min(2, 0.5 + l.s / 8));
  const node = gNodes.selectAll("g").data(nodes).join("g").attr("class", "net-node").attr("tabindex", 0)
    .attr("role", "button").attr("aria-label", (n) => `${n.title}: ${n.description}`);
  node.append("circle").attr("r", radius).attr("fill", (n) => color(n.room));
  const top = new Set([...nodes].sort((a, b) => b.commits - a.commits).slice(0, 16).map((n) => n.name));
  node.append("text").text((n) => n.title).attr("dy", (n) => -radius(n) - 4).attr("class", (n) => top.has(n.name) ? "lab on" : "lab");

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (n) => { const r = radius(n) + 2; n.x = Math.max(r, Math.min(W - r, n.x)); n.y = Math.max(r + 14, Math.min(H - r, n.y)); };
  const draw = () => {
    nodes.forEach(clamp);
    line.attr("x1", (l) => l.source.x).attr("y1", (l) => l.source.y).attr("x2", (l) => l.target.x).attr("y2", (l) => l.target.y);
    node.attr("transform", (n) => `translate(${n.x},${n.y})`);
  };
  if (reduced) { sim.stop(); for (let i = 0; i < 300; i++) sim.tick(); draw(); } else sim.on("tick", draw);

  // ---- drag ----
  node.call(d3.drag()
    .on("start", (e, n) => { if (!e.active && !reduced) sim.alphaTarget(0.25).restart(); n.fx = n.x; n.fy = n.y; })
    .on("drag", (e, n) => { n.fx = e.x; n.fy = e.y; if (reduced) { n.x = e.x; n.y = e.y; draw(); } })
    .on("end", (e, n) => { if (!e.active) sim.alphaTarget(0); n.fx = null; n.fy = null; }));

  // ---- hover card ----
  const tip = document.getElementById("net-tip");
  const neighbours = (n) => new Set(links.filter((l) => l.source === n || l.target === n).flatMap((l) => [l.source.name, l.target.name]));
  const focus = (n) => {
    const near = neighbours(n);
    node.classed("dim", (m) => !near.has(m.name) && m !== n).classed("hot", (m) => m === n);
    line.classed("hot", (l) => l.source === n || l.target === n);
    const room = data.rooms[n.room]?.short || "";
    tip.innerHTML = `<p class="tag">${esc(room)}</p><h3>${esc(n.title)}</h3><p>${esc(n.description || "")}</p>
      <p class="fine">${n.commits.toLocaleString("en-US")} commits in ${data.year}${n.language ? " · " + esc(n.language) : ""}</p>
      <p class="fine">${n.live ? "Click to play it here" : "Click for the code"}</p>`;
    tip.hidden = false;
    const r = box(), x = n.x, y = n.y;
    tip.style.left = `${Math.min(Math.max(8, x + 18), r.width - tip.offsetWidth - 8)}px`;
    tip.style.top = `${Math.min(Math.max(48, y - 20), r.height - tip.offsetHeight - 8)}px`;
  };
  const blur = () => { tip.hidden = true; node.classed("dim", false).classed("hot", false); line.classed("hot", false); applyRoom(); };
  node.on("pointerenter focus", (e, n) => focus(n)).on("pointerleave blur", blur);
  node.on("click", (e, n) => {
    if (e.defaultPrevented) return; // a drag, not a click
    if (n.live && window.__play) window.__play(n.name);
    else window.open(n.repo, "_blank", "noopener");
  });
  node.on("keydown", (e, n) => { if (e.key === "Enter") node.filter((m) => m === n).dispatch("click"); });

  // ---- room chips ----
  let room = "all";
  const chips = document.getElementById("net-rooms");
  const counts = {};
  nodes.forEach((n) => (counts[n.room] = (counts[n.room] || 0) + 1));
  chips.innerHTML = [["all", "All", nodes.length], ...roomIds.filter((id) => counts[id]).map((id) => [id, data.rooms[id].short, counts[id]])]
    .map(([id, label, n]) => `<button class="chip" type="button" data-room="${id}" aria-pressed="${id === "all"}">${id === "all" ? "" : `<i style="background:${color(id)}"></i>`}${esc(label)}<span class="k">${n}</span></button>`).join("");
  function applyRoom() {
    node.classed("off", (n) => room !== "all" && n.room !== room);
    line.classed("off", (l) => room !== "all" && (l.source.room !== room || l.target.room !== room));
    node.select("text").classed("on", (n) => room === "all" ? top.has(n.name) : n.room === room);
  }
  chips.addEventListener("click", (e) => {
    const b = e.target.closest("[data-room]"); if (!b) return;
    room = b.dataset.room;
    chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    applyRoom();
  });

  // ---- private repos, in totals only ----
  const p = data.private, note = (await fetch("data/curation.json").then((r) => r.json()).catch(() => ({}))).private_note;
  if (p) {
    const rooms = Object.entries(p.rooms).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${n} ${data.rooms[id]?.short || id}`).join(", ");
    document.getElementById("net-private").innerHTML =
      `<strong>Plus ${p.repos} private repos</strong> not on the map, with ${p.commits.toLocaleString("en-US")} commits of mine this year: ${esc(note || "work in progress")}. By room: ${esc(rooms)}.`;
  }

  // ---- resize ----
  new ResizeObserver(() => {
    const r = box(); if (Math.abs(r.width - W) < 4 && Math.abs(r.height - H) < 4) return;
    W = r.width; H = r.height;
    sim.force("x", d3.forceX((n) => centre(n.room)[0]).strength(0.07)).force("y", d3.forceY((n) => centre(n.room)[1]).strength(0.09));
    if (reduced) { for (let i = 0; i < 120; i++) sim.tick(); draw(); } else sim.alpha(0.5).restart();
  }).observe(svgEl);
}
