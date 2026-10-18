// The hero: the same real human brain whatisabrain.com opens on, read live from
// that site so this page can never drift from it. Its module uses paths relative
// to its own site, so we fetch the source and point those paths at whatisabrain.com.
// "Explore" swaps the brain for the live Inner Cosmos guided zoom.
const SITE = "https://whatisabrain.com/";
const MODULE = SITE + "js/hero-brain.js";
const EXPLORE = SITE + "explore/explore";

const box = document.getElementById("brain");
const canvasHost = document.getElementById("brain-canvas");
const go = document.getElementById("brain-go");
const back = document.getElementById("brain-back");
const cap = document.getElementById("brain-cap");
const capBrain = cap.innerHTML;
const capExplore = `<span class="tag">Inner Cosmos</span><strong>Zoom into a brain.</strong> Every cell on screen is a real reconstructed mesh from the MICrONS mouse visual cortex. Use the arrows to move between stages. <a href="${EXPLORE}" target="_blank" rel="noopener">Open full screen ↗</a>`;

let moduleUrl = null;

async function loadModule() {
  if (moduleUrl) return moduleUrl;
  const src = await fetch(MODULE).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); });
  const patched = src
    .replace('const BASE = "tracks/";', `const BASE = "${SITE}tracks/";`)
    .replace('setDecoderPath("mouse/', `setDecoderPath("${SITE}mouse/`)
    .replace("function animate(now) {", "function animate(now) {\n    if (window.__brainStop) return;")
    // This frame is smaller than the hub's full screen, so more cables overlap per pixel
    // and the additive glow blows out to white. Scale the module's own gain down.
    .replace("const gain = 1.4 / Math.sqrt", "const gain = (window.__brainGain || 1) * 1.4 / Math.sqrt")
    // and bring the camera in, so the brain fills this frame the way it fills the hub
    .replace("const d = 330 *", "const d = (window.__brainDist || 1) * 330 *");
  // If whatisabrain changes its module, fail visibly rather than half drawing.
  if (!patched.includes(`${SITE}tracks/`) || !patched.includes("__brainStop") || !patched.includes("__brainGain") || !patched.includes("__brainDist")) throw new Error("hero-brain.js changed shape");
  moduleUrl = URL.createObjectURL(new Blob([patched], { type: "text/javascript" }));
  return moduleUrl;
}

async function showBrain() {
  window.__brainStop = false;
  window.__brainGain = 0.45;
  window.__brainDist = 0.76;
  canvasHost.innerHTML = "";
  canvasHost.style.opacity = "0";
  box.classList.remove("exploring", "failed");
  try {
    const m = await import(await loadModule());
    // Lite draws every third streamline: in a frame this size the full set sums to white.
    m.startHero(canvasHost, { lite: true });
  } catch (e) {
    console.warn("brain", e);
    box.classList.add("failed");
  }
}

function explore() {
  window.__brainStop = true;
  canvasHost.innerHTML = "";
  const f = document.createElement("iframe");
  f.src = EXPLORE;
  f.title = "Inner Cosmos: zoom from a mouse brain to a single dendrite";
  f.allow = "fullscreen; autoplay";
  canvasHost.appendChild(f);
  canvasHost.style.opacity = "1";
  box.classList.add("exploring");
  back.hidden = false;
  cap.innerHTML = capExplore;
  f.focus();
}

go.addEventListener("click", explore);
back.addEventListener("click", () => { back.hidden = true; cap.innerHTML = capBrain; showBrain(); });

if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
  box.classList.add("still");
} else {
  showBrain();
}
