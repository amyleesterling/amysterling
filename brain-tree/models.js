// Brain Tree: schematic nervous systems, one recipe per stop.
//
// Every model here is a SCHEMATIC, built from two primitives so that any stop
// can flow into any other:
//
//   parts  soft ellipsoids, one per brain region. Keys are shared between
//          stops on purpose: the fish "cb" and the human "cb" are the same
//          object, so walking the trail grows one cerebellum instead of
//          swapping pictures.
//   beads  small glowing dots for anything that is a net, a cord or a nerve.
//
// Axes: +x is the front of the animal, +y is up, z is left and right.
// Proportions follow standard comparative-anatomy figures but nothing here is
// measured. The page labels the stage "schematic" for that reason. A real
// mesh dropped into assets/<stop>/brain.glb is meant to replace these.

export const REGION_COLORS = {
  nerve_net: "#5fe6d2",
  cerebral_ganglia: "#6cb6ff",
  nerve_cord: "#8fe38a",
  mushroom_body: "#ff9ecb",
  central_complex: "#ffd166",
  optic_lobe: "#7be0ff",
  vertical_lobe: "#c9a2ff",
  hindbrain: "#3fb6b0",
  cerebellum: "#c9a2ff",
  midbrain_tectum: "#ffd166",
  diencephalon: "#7bd88f",
  basal_ganglia: "#9b8cff",
  pallium: "#58a6ff",
  hippocampus: "#ffe08a",
  olfactory_bulb: "#ffb86b",
  neocortex: "#ff8fbf",
  cellular: "#ffd27d",
  other: "#f6b6ff",
  body: "#9fd8e8",
};

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Catmull-Rom through a list of points, t in 0..1
function spline(pts, t) {
  const n = pts.length - 1;
  const f = Math.min(Math.max(t, 0), 1) * n;
  const i = Math.min(Math.floor(f), n - 1);
  const u = f - i;
  const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, n)];
  const out = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    out[k] = 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u +
      (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u +
      (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u);
  }
  return out;
}

function builder() {
  const parts = [], beads = [];
  let group = 0;
  const api = {
    parts, beads,
    part(key, region, p, s, o = {}) {
      parts.push({ key, region, p, s, rz: o.rz || 0, ghost: !!o.ghost, gyri: o.gyri || 0,
        inner: !!o.inner, struct: o.struct || null, alpha: o.alpha });
    },
    pair(key, region, p, s, o = {}) {
      api.part(key + "L", region, [p[0], p[1], p[2]], s, o);
      api.part(key + "R", region, [p[0], p[1], -p[2]], s, { ...o, rz: o.rz || 0 });
    },
    strand(pts, n, size, region, o = {}) {
      const g = (group++ * 0.137) % 1;
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1);
        const p = spline(pts, t);
        const taper = o.taper ? 1 - t * o.taper : 1;
        const knot = o.knot && i % o.knot === 0 ? 1.7 : 1;
        beads.push({ x: p[0], y: p[1], z: p[2], s: size * taper * knot, region,
          struct: o.struct || null, w: t, g: o.g != null ? o.g : g, dim: o.dim || 1, nofit: !!o.nofit });
      }
    },
    ring(c, r, n, size, region, o = {}) {
      // a ring in the plane whose normal is o.axis ("x", "y" or "z")
      const g = (group++ * 0.137) % 1;
      const axis = o.axis || "y";
      const ry = o.ry || r;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const u = Math.cos(a) * r, v = Math.sin(a) * ry;
        const p = axis === "y" ? [c[0] + u, c[1], c[2] + v]
          : axis === "x" ? [c[0], c[1] + u, c[2] + v] : [c[0] + u, c[1] + v, c[2]];
        beads.push({ x: p[0], y: p[1], z: p[2], s: size, region, struct: o.struct || null,
          w: i / n, g, dim: o.dim || 1, loop: true });
      }
    },
    dot(p, size, region, o = {}) {
      beads.push({ x: p[0], y: p[1], z: p[2], s: size, region, struct: o.struct || null,
        w: o.w || 0, g: o.g || 0, dim: o.dim || 1 });
    },
  };
  return api;
}

// The shared vertebrate plan. Each stop passes its own proportions, and any
// region it leaves out shrinks away to nothing.
function vertebrate(b, v) {
  if (v.ob) b.pair("ob", "olfactory_bulb", v.ob[0], v.ob[1], v.obO);
  if (v.pal) b.pair("pal", "pallium", v.pal[0], v.pal[1], v.palO);
  if (v.ncx) b.pair("ncx", "neocortex", v.ncx[0], v.ncx[1], v.ncxO);
  if (v.bg) b.pair("bg", "basal_ganglia", v.bg[0], v.bg[1], { inner: true, ...v.bgO });
  if (v.hip) b.pair("hip", "hippocampus", v.hip[0], v.hip[1], { inner: true, ...v.hipO });
  if (v.di) b.part("di", "diencephalon", v.di[0], v.di[1], { inner: v.diInner });
  if (v.tec) b.pair("tec", "midbrain_tectum", v.tec[0], v.tec[1], v.tecO);
  if (v.cb) b.part("cb", "cerebellum", v.cb[0], v.cb[1], v.cbO);
  if (v.hb) b.part("hb", "hindbrain", v.hb[0], v.hb[1], v.hbO);
  // a spinal cord trails out of frame unless the stop asks to fit it
  if (v.cord) b.strand(v.cord, v.cordN || 40, v.cordS || 0.036, "hindbrain",
    { taper: 0.8, dim: 0.8, nofit: !v.cordFit, struct: v.cordStruct, ...(v.cordO || {}) });
}

function beadsPush(b, p, size, region, t) {
  b.beads.push({ x: p[0], y: p[1], z: p[2], s: size, region, struct: "Myelin", w: t, g: 0.3, dim: 0.8, nofit: true });
}

const RECIPES = {
  // A sponge: cells that talk, and no neurons. Loose cells on a vase, with
  // the slow squeeze the research describes travelling up it, and a
  // placozoan disc gliding beside it.
  "before-neurons"(b) {
    const r = rng(11);
    b.part("hull", "body", [0, 0, 0], [0.62, 1.12, 0.62], { ghost: true });
    for (let i = 0; i < 340; i++) {
      const y = r() * 2 - 1;
      const rad = (0.34 + 0.2 * Math.sin((y + 1) * 1.7)) * (0.94 + r() * 0.1);
      const a = r() * Math.PI * 2;
      b.dot([Math.cos(a) * rad, y * 1.0, Math.sin(a) * rad], 0.013 + r() * 0.014,
        i % 5 === 0 ? "nerve_cord" : "cellular",
        { w: (y + 1) / 2, g: 0, struct: i % 3 === 0 ? "Contractile sheets" : "Digestive-chamber signaling" });
    }
    b.ring([0, 1.0, 0], 0.3, 34, 0.018, "cellular", { struct: "Contractile sheets" });
    for (let i = 0; i < 150; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.42;
      b.dot([1.25 + Math.cos(a) * d, -0.95 + (r() - 0.5) * 0.04, Math.sin(a) * d], 0.012 + r() * 0.01,
        "cellular", { w: d / 0.42, g: 0.4, struct: i % 2 ? "Gliding hairs" : "Digestive secretory cells" });
    }
    return { yaw: 0.35, pitch: 0.3 };
  },

  // A box jellyfish: a net over the bell, a ring nerve, four eye-bearing
  // sensory centres on the rim, tentacles below.
  "nerve-nets"(b) {
    const r = rng(23);
    b.part("hull", "body", [0, 0.25, 0], [1.0, 0.9, 1.0], { ghost: true });
    for (let i = 0; i < 560; i++) {
      const u = r(), a = r() * Math.PI * 2;
      const ph = Math.acos(1 - u * 0.98);               // crown down to the rim
      const x = Math.sin(ph) * Math.cos(a) * 0.98, z = Math.sin(ph) * Math.sin(a) * 0.98;
      const y = 0.25 + Math.cos(ph) * 0.88;
      b.dot([x, y, z], 0.016 + r() * 0.016, "nerve_net",
        { w: ph / (Math.PI / 2), g: 0, struct: i % 2 ? "Continuous nerve net" : "Body-wide activity networks" });
    }
    b.ring([0, 0.27, 0], 0.99, 110, 0.03, "nerve_net", { struct: "Body-wide activity networks" });
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      const x = Math.cos(a) * 0.99, z = Math.sin(a) * 0.99;
      b.part("rh" + k, "other", [x, 0.2, z], [0.1, 0.1, 0.1], { struct: "Eye-bearing sensory centers" });
      const c = Math.cos(a + Math.PI / 4) * 0.99, s = Math.sin(a + Math.PI / 4) * 0.99;
      b.strand([[c, 0.25, s], [c * 1.05, -0.3, s * 1.05], [c * 0.9 + 0.12, -0.85, s * 0.9],
        [c * 1.0 - 0.1, -1.4, s * 1.0 + 0.08], [c * 0.85, -1.9, s * 0.85]], 52, 0.024, "nerve_net",
        { taper: 0.5, dim: 0.75 });
    }
    return { yaw: 0.5, pitch: 0.22 };
  },

  // A planarian: two brain lobes at the front and a ladder of nerve cords.
  "heads"(b) {
    b.part("hull", "body", [-0.1, 0, 0], [1.85, 0.1, 0.42], { ghost: true });
    b.pair("cg", "cerebral_ganglia", [1.25, 0.0, 0.13], [0.26, 0.085, 0.13], { struct: "Planarian brain" });
    b.pair("eye", "other", [1.42, 0.07, 0.1], [0.045, 0.035, 0.045], { struct: "Search circuit" });
    for (const s of [1, -1]) {
      b.strand([[1.15, 0, 0.16 * s], [0.5, 0, 0.21 * s], [-0.5, 0, 0.21 * s], [-1.4, 0, 0.13 * s], [-1.8, 0, 0.03 * s]],
        84, 0.03, "nerve_cord", { taper: 0.4, struct: "Longitudinal nerve bundles", g: 0.1 });
    }
    for (let i = 0; i < 15; i++) {
      const x = 0.95 - i * 0.18, half = 0.2 * (1 - Math.pow(Math.max(0, i - 8) / 8, 2) * 0.6);
      b.strand([[x, 0, -half], [x, 0, 0], [x, 0, half]], 7, 0.017, "nerve_cord",
        { struct: "Longitudinal nerve bundles", dim: 0.7, g: 0.1 + i * 0.02 });
    }
    return { yaw: 0.55, pitch: 0.55 };
  },

  // A fruit fly: wide brain, big visual lobes, mushroom bodies, and the ring
  // that carries the heading signal.
  "arthropod-brains"(b) {
    b.part("cg", "cerebral_ganglia", [0, 0, 0], [0.3, 0.44, 0.56]);
    b.pair("opt", "optic_lobe", [0, 0, 0.9], [0.27, 0.42, 0.3], { struct: "Visual lobes" });
    b.pair("mb", "mushroom_body", [-0.1, 0.2, 0.3], [0.13, 0.2, 0.12], { inner: true, struct: "Mushroom bodies" });
    b.pair("mbl", "mushroom_body", [0.1, 0.02, 0.17], [0.16, 0.06, 0.06], { inner: true, struct: "Mushroom bodies" });
    b.part("cx", "central_complex", [0.02, 0.06, 0], [0.06, 0.07, 0.17], { inner: true, struct: "Heading compass" });
    b.ring([0.14, 0.06, 0], 0.15, 26, 0.028, "central_complex", { axis: "x", struct: "Heading compass" });
    b.strand([[-0.2, -0.38, 0], [-0.6, -0.55, 0], [-1.2, -0.6, 0], [-1.9, -0.55, 0]], 44, 0.04, "nerve_cord", { taper: 0.4 });
    for (let k = 0; k < 3; k++) {
      b.part("vg" + k, "nerve_cord", [-0.75 - k * 0.38, -0.58, 0], [0.17 - k * 0.02, 0.11, 0.17 - k * 0.02]);
    }
    return { yaw: 1.05, pitch: 0.12 };
  },

  // An octopus: a central brain between the eyes, and eight arm cords that
  // hold most of the neurons.
  "cephalopods"(b) {
    b.part("hull", "body", [-0.95, 0.42, 0], [0.75, 0.58, 0.55], { ghost: true });
    b.part("cg", "cerebral_ganglia", [0, 0.1, 0], [0.27, 0.2, 0.25]);
    b.part("vl", "vertical_lobe", [0, 0.3, 0], [0.17, 0.09, 0.15], { struct: "Vertical lobe" });
    b.pair("opt", "optic_lobe", [0, 0.1, 0.45], [0.18, 0.18, 0.2]);
    for (let i = 0; i < 8; i++) {
      const a = (i + 0.5) / 8 * Math.PI * 2;
      const cy = Math.cos(a), cz = Math.sin(a);
      const curl = i % 2 ? 0.35 : -0.25;
      b.strand([
        [0.18, -0.08 + cy * 0.08, cz * 0.08],
        [0.55, -0.15 + cy * 0.4, cz * 0.4],
        [1.0, -0.35 + cy * 0.8, cz * 0.85],
        [1.25 + curl * 0.3, -0.75 + cy * 1.0, cz * 1.15],
        [1.1 + curl, -1.15 + cy * 0.85, cz * 1.35 + curl * 0.3],
        [0.8 + curl, -1.2 + cy * 0.6, cz * 1.5],
      ], 74, 0.036, "nerve_cord", { taper: 0.72, knot: 6, struct: "Arm nerve cords", g: i * 0.11 });
    }
    // the skin is run straight from the brain: pigment organs and bump muscles
    const r = rng(41);
    for (let i = 0; i < 150; i++) {
      const u = r() * 2 - 1, a = r() * Math.PI * 2, q = Math.sqrt(1 - u * u);
      b.dot([-0.95 + q * Math.cos(a) * 0.75, 0.42 + u * 0.58, q * Math.sin(a) * 0.55], 0.014 + r() * 0.012,
        i % 3 ? "cellular" : "other",
        { w: (u + 1) / 2, g: 0.6, dim: 0.8, struct: i % 3 ? "Skin pigment organs" : "Skin bump muscles and nerves" });
    }
    return { yaw: 0.35, pitch: 0.18 };
  },

  // A lancelet: one hollow nerve tube along the back, barely swollen at the
  // front, with a single frontal eye.
  "chordate-origins"(b) {
    b.part("hull", "body", [-0.05, -0.05, 0], [1.9, 0.3, 0.13], { ghost: true });
    b.strand([[1.55, 0.1, 0], [0.8, 0.13, 0], [-0.3, 0.13, 0], [-1.3, 0.08, 0], [-1.85, 0, 0]],
      120, 0.036, "nerve_cord", { taper: 0.45, struct: "Dorsal nerve tube" });
    b.part("cv", "nerve_cord", [1.5, 0.1, 0], [0.13, 0.065, 0.06], { struct: "Dorsal nerve tube" });
    b.part("fe", "other", [1.66, 0.1, 0], [0.045, 0.045, 0.045], { struct: "Frontal eye" });
    b.pair("vr", "other", [1.45, 0.1, 0.05], [0.05, 0.035, 0.03], { inner: true, struct: "Two visual routes" });
    for (let i = 0; i < 22; i++) {
      const x = 1.2 - i * 0.135;
      for (const s of [1, -1]) {
        b.strand([[x, 0.12, 0.02 * s], [x - 0.05, -0.02, 0.1 * s], [x - 0.09, -0.18, 0.09 * s]], 5, 0.016,
          "nerve_cord", { dim: 0.6, g: i * 0.03 });
      }
    }
    return { yaw: 0.25, pitch: 0.2 };
  },

  // A lamprey: the vertebrate plan, all in a row and all small.
  "first-vertebrates"(b) {
    vertebrate(b, {
      ob: [[1.3, 0.0, 0.16], [0.22, 0.17, 0.15]],
      pal: [[0.92, 0.05, 0.17], [0.2, 0.17, 0.15]],
      bg: [[0.9, -0.05, 0.1], [0.11, 0.09, 0.08]], bgO: { struct: "Basal ganglia" },
      di: [[0.56, 0, 0], [0.22, 0.2, 0.2]],
      tec: [[0.2, 0.1, 0.15], [0.24, 0.17, 0.16]], tecO: { struct: "Visual orienting center" },
      hb: [[-0.36, -0.02, 0], [0.5, 0.2, 0.22]], hbO: { struct: "Descending movement pathways" },
      cord: [[-0.8, -0.03, 0], [-1.3, -0.04, 0], [-1.9, -0.04, 0]], cordStruct: "Descending movement pathways",
    });
    return { yaw: 0.45, pitch: 0.2 };
  },

  // A fish: a real cerebellum arrives, the visual lobes swell, and the long
  // fibres get their insulating wrap.
  "jawed-fish"(b) {
    vertebrate(b, {
      ob: [[1.55, 0.0, 0.14], [0.16, 0.13, 0.12]], obO: { struct: "Paired smell inputs" },
      pal: [[1.02, 0.05, 0.2], [0.3, 0.24, 0.2]], palO: { struct: "Spatial-memory forebrain" },
      bg: [[0.98, -0.08, 0.12], [0.14, 0.1, 0.1]],
      di: [[0.62, -0.1, 0], [0.24, 0.22, 0.22]],
      tec: [[0.3, 0.18, 0.24], [0.38, 0.3, 0.26]],
      cb: [[-0.25, 0.28, 0], [0.34, 0.32, 0.3]], cbO: { struct: "Layered cerebellum", gyri: 0.25 },
      hb: [[-0.5, -0.08, 0], [0.55, 0.22, 0.24]], hbO: { struct: "Electric-sense lobe" },
    });
    for (const s of [1, -1]) {
      b.strand([[1.42, 0, 0.14 * s], [1.3, 0.02, 0.17 * s], [1.2, 0.04, 0.19 * s]], 6, 0.022,
        "olfactory_bulb", { struct: "Paired smell inputs" });
    }
    // the cord, wrapped: fat insulated stretches with gaps between them
    const cord = [[-0.95, -0.1, 0], [-1.45, -0.12, 0], [-2.0, -0.1, 0]];
    for (let i = 0; i < 44; i++) {
      const t = i / 43, p = spline(cord, t);
      const gap = i % 5 === 4;
      beadsPush(b, p, gap ? 0.016 : 0.04 * (1 - t * 0.7), gap ? "hindbrain" : "cellular", t);
    }
    return { yaw: 0.45, pitch: 0.2 };
  },

  // A frog: long forebrain, a cerebellum reduced to a thin plate.
  "onto-land"(b) {
    vertebrate(b, {
      ob: [[1.5, 0.0, 0.13], [0.2, 0.15, 0.13]],
      pal: [[0.98, 0.05, 0.19], [0.42, 0.22, 0.19]],
      bg: [[0.95, -0.07, 0.12], [0.16, 0.1, 0.09]],
      di: [[0.46, 0, 0], [0.22, 0.2, 0.2]],
      tec: [[0.1, 0.15, 0.2], [0.28, 0.24, 0.22]], tecO: { struct: "Visual orienting center" },
      cb: [[-0.22, 0.2, 0], [0.08, 0.16, 0.3]],
      hb: [[-0.56, -0.02, 0], [0.46, 0.2, 0.24]], hbO: { struct: "Swimming command neurons" },
      cord: [[-0.98, -0.03, 0], [-1.5, -0.05, 0], [-2.1, -0.05, 0]], cordStruct: "Midbrain steering pathways",
    });
    return { yaw: 0.45, pitch: 0.2 };
  },

  // A lizard: the forebrain thickens, with a thin three-layer cortex on top.
  "reptiles"(b) {
    vertebrate(b, {
      ob: [[1.72, 0.0, 0.1], [0.16, 0.12, 0.1]],
      pal: [[0.86, 0.12, 0.24], [0.46, 0.32, 0.26]], palO: { struct: "Medial cortex" },
      bg: [[0.84, -0.06, 0.15], [0.2, 0.13, 0.12]],
      hip: [[0.7, 0.3, 0.1], [0.24, 0.07, 0.08]], hipO: { struct: "Medial cortex" },
      di: [[0.44, 0, 0], [0.22, 0.2, 0.2]],
      tec: [[0.15, 0.2, 0.2], [0.26, 0.22, 0.2]],
      cb: [[-0.2, 0.25, 0], [0.16, 0.22, 0.26]],
      hb: [[-0.56, 0, 0], [0.46, 0.2, 0.22]],
      cord: [[-0.98, -0.02, 0], [-1.5, -0.04, 0], [-2.1, -0.04, 0]],
    });
    for (const s of [1, -1]) {
      b.strand([[1.58, 0, 0.1 * s], [1.42, 0.02, 0.13 * s], [1.27, 0.05, 0.17 * s]], 8, 0.02, "olfactory_bulb");
    }
    return { yaw: 0.45, pitch: 0.2 };
  },

  // A crow: a big round forebrain packed with neurons, visual lobes pushed
  // down and out, a large cerebellum.
  "birds"(b) {
    vertebrate(b, {
      ob: [[1.22, -0.12, 0.06], [0.08, 0.06, 0.05]],
      pal: [[0.55, 0.2, 0.3], [0.62, 0.48, 0.36]], palO: { struct: "Crow and parrot pallium" },
      bg: [[0.5, 0.0, 0.2], [0.25, 0.18, 0.16]],
      hip: [[0.2, 0.52, 0.12], [0.2, 0.06, 0.1]],
      di: [[0.1, -0.1, 0], [0.2, 0.18, 0.2]],
      tec: [[0.05, -0.22, 0.42], [0.26, 0.22, 0.18]],
      cb: [[-0.45, 0.12, 0], [0.3, 0.4, 0.3]], cbO: { gyri: 0.7, struct: "Tool-related circuits" },
      hb: [[-0.42, -0.4, 0], [0.34, 0.2, 0.22]],
      cord: [[-0.7, -0.5, 0], [-1.1, -0.75, 0], [-1.5, -1.15, 0]], cordN: 26, cordFit: true,
    });
    b.pair("voc", "pallium", [0.72, 0.16, 0.34], [0.12, 0.1, 0.09], { inner: true, struct: "Parrot vocal core and shell" });
    return { yaw: 0.5, pitch: 0.16 };
  },

  // A mouse: a smooth six-layer neocortex caps the older forebrain, the
  // smell bulbs are huge, and a bridge joins the two halves.
  "early-mammals"(b) {
    vertebrate(b, {
      ob: [[1.36, 0.0, 0.13], [0.3, 0.2, 0.16]],
      ncx: [[0.4, 0.22, 0.26], [0.62, 0.3, 0.3]], ncxO: { struct: "Six-layer neocortex" },
      pal: [[0.5, -0.1, 0.3], [0.5, 0.18, 0.2]],
      hip: [[0.1, 0.1, 0.2], [0.22, 0.14, 0.12]],
      bg: [[0.55, 0.02, 0.16], [0.2, 0.14, 0.12]],
      di: [[0.2, -0.05, 0], [0.24, 0.2, 0.24]], diInner: true,
      tec: [[-0.3, 0.2, 0.12], [0.14, 0.12, 0.12]],
      cb: [[-0.65, 0.15, 0], [0.26, 0.3, 0.42]], cbO: { gyri: 0.7 },
      hb: [[-0.75, -0.18, 0], [0.4, 0.18, 0.24]],
      cord: [[-1.1, -0.22, 0], [-1.5, -0.26, 0], [-2.0, -0.26, 0]], cordN: 30,
    });
    b.pair("s1", "neocortex", [0.62, 0.36, 0.3], [0.16, 0.08, 0.13], { struct: "Whisker touch area" });
    b.strand([[0.45, 0.24, -0.24], [0.45, 0.34, -0.1], [0.45, 0.36, 0], [0.45, 0.34, 0.1], [0.45, 0.24, 0.24]],
      26, 0.028, "other", { struct: "Corpus callosum" });
    b.strand([[0.72, 0.0, -0.22], [0.72, 0.06, 0], [0.72, 0.0, 0.22]], 14, 0.022, "other",
      { struct: "Anterior commissure", dim: 0.8 });
    return { yaw: 0.5, pitch: 0.24 };
  },

  // An elephant: a folded cortex, and a cerebellum that holds most of the
  // neurons in the brain.
  "mammal-radiations"(b) {
    vertebrate(b, {
      ob: [[1.12, -0.36, 0.2], [0.26, 0.12, 0.14]],
      ncx: [[0.25, 0.3, 0.42], [0.98, 0.72, 0.5]], ncxO: { gyri: 1 },
      hip: [[0.0, -0.08, 0.3], [0.3, 0.12, 0.12]], hipO: { struct: "Three-dimensional place cells" },
      bg: [[0.35, 0.08, 0.22], [0.26, 0.2, 0.16]],
      di: [[0.05, -0.05, 0], [0.24, 0.2, 0.24]], diInner: true,
      tec: [[-0.4, -0.12, 0.1], [0.11, 0.1, 0.1]],
      cb: [[-0.78, -0.24, 0], [0.5, 0.46, 0.78]], cbO: { gyri: 1, struct: "Neuron-rich cerebellum" },
      hb: [[-0.42, -0.58, 0], [0.36, 0.2, 0.25]], hbO: { struct: "Echo-ranging system" },
      cord: [[-0.75, -0.72, 0], [-1.1, -0.95, 0], [-1.45, -1.35, 0]], cordN: 24, cordS: 0.045, cordFit: true,
    });
    return { yaw: 0.5, pitch: 0.16 };
  },

  // A ragworm larva, three days old: a small brain with eyespots, a short
  // ladder of nerve cords, and bands of beating hairs around the body.
  "annelid-ragworm"(b) {
    const r = rng(57);
    b.part("hull", "body", [0, 0, 0], [1.05, 0.56, 0.56], { ghost: true });
    b.pair("cg", "cerebral_ganglia", [0.62, 0.12, 0.16], [0.22, 0.17, 0.17]);
    b.pair("eye", "other", [0.8, 0.2, 0.3], [0.06, 0.06, 0.06], { struct: "Larval eyespots" });
    b.pair("uv", "cellular", [0.6, 0.16, 0.1], [0.07, 0.06, 0.06], { inner: true, struct: "Ultraviolet-sensitive cells" });
    for (const s of [1, -1]) {
      b.strand([[0.45, -0.1, 0.14 * s], [0.1, -0.3, 0.16 * s], [-0.5, -0.32, 0.14 * s], [-0.95, -0.2, 0.05 * s]],
        46, 0.03, "nerve_cord", { taper: 0.4, g: 0.2 });
    }
    for (let i = 0; i < 7; i++) {
      const x = 0.15 - i * 0.16;
      b.strand([[x, -0.31, -0.15], [x, -0.33, 0], [x, -0.31, 0.15]], 6, 0.017, "nerve_cord", { dim: 0.7, g: 0.2 + i * 0.03 });
    }
    for (const [x, rad] of [[0.38, 0.52], [-0.2, 0.55], [-0.7, 0.4]]) {
      b.ring([x, 0, 0], rad, 44, 0.02, "body", { axis: "x", dim: 0.7 });
    }
    for (let i = 0; i < 46; i++) {
      const a = r() * Math.PI * 2, x = 0.9 - r() * 1.7, rad = 0.56 * Math.sqrt(Math.max(0.05, 1 - (x / 1.05) ** 2));
      b.dot([x, Math.cos(a) * rad, Math.sin(a) * rad], 0.022, "cellular",
        { w: (0.9 - x) / 1.7, g: 0.5, struct: "Water-motion receptors" });
    }
    return { yaw: 0.45, pitch: 0.2 };
  },

  // A sea urchin: no brain at all. A nerve ring around the mouth and five
  // radial nerves, on a body covered in light-sensitive tube feet.
  "echinoderm-sea-urchin"(b) {
    const r = rng(71);
    b.part("hull", "body", [0, 0, 0], [0.8, 0.66, 0.8], { ghost: true });
    b.ring([0, -0.6, 0], 0.26, 54, 0.032, "nerve_net", { struct: "Mouth nerve ring" });
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      b.strand([[c * 0.26, -0.6, sn * 0.26], [c * 0.62, -0.42, sn * 0.62], [c * 0.8, 0, sn * 0.8],
        [c * 0.6, 0.44, sn * 0.6], [c * 0.16, 0.65, sn * 0.16]], 58, 0.034, "nerve_cord",
        { taper: 0.5, struct: "Radial nerves", g: k * 0.2 });
    }
    for (let i = 0; i < 170; i++) {
      const u = r() * 2 - 1, a = r() * Math.PI * 2, q = Math.sqrt(1 - u * u);
      b.dot([q * Math.cos(a) * 0.82, u * 0.68, q * Math.sin(a) * 0.82], 0.012 + r() * 0.008, "cellular",
        { w: (u + 1) / 2, g: 0.5, dim: 0.7, struct: "Body-surface light sensors" });
    }
    for (let i = 0; i < 70; i++) {
      const u = r() * 1.7 - 0.7, a = r() * Math.PI * 2, q = Math.sqrt(Math.max(0, 1 - u * u));
      const d = [q * Math.cos(a), u, q * Math.sin(a)], len = 1.3 + r() * 0.3;
      b.strand([[d[0] * 0.82, d[1] * 0.68, d[2] * 0.82], [d[0] * 0.82 * len, d[1] * 0.68 * len, d[2] * 0.82 * len]],
        6, 0.011, "body", { taper: 0.7, dim: 0.3, g: r() });
    }
    return { yaw: 0.3, pitch: -0.42 };
  },

  // An acorn worm: a nerve net under the skin, densest at the base of the
  // snout, and two cords along the trunk.
  "hemichordate-acorn-worm"(b) {
    const r = rng(83);
    b.part("hull", "body", [1.15, 0.05, 0], [0.5, 0.3, 0.3], { ghost: true });
    b.part("hull2", "body", [0.55, 0.02, 0], [0.2, 0.32, 0.32], { ghost: true });
    b.part("hull3", "body", [-0.75, 0, 0], [1.25, 0.24, 0.24], { ghost: true });
    for (let i = 0; i < 300; i++) {
      // crowded toward the base of the snout
      const t = Math.pow(r(), 2.2), x = 0.68 + t * 0.95, a = r() * Math.PI * 2;
      const rad = 0.3 * Math.sqrt(Math.max(0.02, 1 - ((x - 1.15) / 0.5) ** 2));
      b.dot([x, 0.05 + Math.cos(a) * rad, Math.sin(a) * rad], 0.014 + r() * 0.012, "nerve_net",
        { w: t, g: 0, struct: "Snout nerve network" });
    }
    b.ring([0.55, 0.02, 0], 0.32, 40, 0.024, "nerve_net", { axis: "x", struct: "Snout nerve network" });
    for (const y of [0.22, -0.22]) {
      b.strand([[0.5, y * 1.2, 0], [0, y, 0], [-1.0, y, 0], [-1.95, y * 0.5, 0]], 90, 0.032, "nerve_cord",
        { taper: 0.45, struct: "Back and belly nerve cords", g: y > 0 ? 0.1 : 0.55 });
    }
    for (let i = 0; i < 150; i++) {
      const x = 0.4 - r() * 2.2, a = r() * Math.PI * 2;
      const rad = 0.24 * Math.sqrt(Math.max(0.05, 1 - ((x + 0.75) / 1.25) ** 2));
      b.dot([x, Math.cos(a) * rad, Math.sin(a) * rad], 0.012 + r() * 0.008, "nerve_net", { w: r(), g: 0.3, dim: 0.6 });
    }
    b.ring([-1.7, 0, 0], 0.17, 30, 0.02, "cellular", { axis: "x", struct: "Hatchling swimming band" });
    return { yaw: 0.35, pitch: 0.22 };
  },

  // A human: the same parts as the mouse, with cortex over everything.
  "primates-and-humans"(b) {
    vertebrate(b, {
      ob: [[0.78, -0.24, 0.08], [0.1, 0.03, 0.04]],
      ncx: [[0.1, 0.3, 0.37], [0.98, 0.72, 0.42]], ncxO: { gyri: 1 },
      hip: [[-0.05, -0.1, 0.26], [0.26, 0.09, 0.09]],
      bg: [[0.2, 0.12, 0.2], [0.22, 0.17, 0.13]],
      di: [[0.0, 0.0, 0], [0.2, 0.16, 0.2]], diInner: true,
      tec: [[-0.22, -0.2, 0.06], [0.07, 0.06, 0.06]],
      cb: [[-0.6, -0.36, 0], [0.36, 0.26, 0.56]], cbO: { gyri: 1 },
      hb: [[-0.2, -0.58, 0], [0.17, 0.36, 0.18]], hbO: { rz: -0.2 },
      cord: [[-0.26, -0.92, 0], [-0.32, -1.3, 0], [-0.34, -1.75, 0]], cordN: 22, cordS: 0.05, cordFit: true,
    });
    b.pair("m1", "neocortex", [0.12, 0.74, 0.3], [0.08, 0.17, 0.2], { inner: true, struct: "Action-responsive motor cortex", rz: -0.15 });
    b.pair("par", "neocortex", [-0.34, 0.54, 0.4], [0.18, 0.16, 0.1], { inner: true, struct: "Speech-sensitive parietal cortex" });
    b.pair("it", "other", [0.2, -0.1, 0.46], [0.3, 0.09, 0.08], { inner: true, struct: "Identity-sensitive temporal neurons" });
    return { yaw: 0.5, pitch: 0.12 };
  },
};

// Builds one stop, centred and scaled to fit a unit stage.
export function buildModel(id) {
  const recipe = RECIPES[id];
  const b = builder();
  const view = recipe ? recipe(b) : { yaw: 0.4, pitch: 0.2 };
  // centre on the box of everything that is meant to fit, then size it by how
  // wide and tall it is once turned to its starting view
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  const pts = [];
  const grow = (p, s) => {
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], p[k] - s[k]);
      hi[k] = Math.max(hi[k], p[k] + s[k]);
    }
    for (let k = 0; k < 3; k++) for (const sg of [1, -1]) {
      const q = p.slice(); q[k] += s[k] * sg; pts.push(q);
    }
  };
  b.parts.forEach(p => grow(p.p, p.s));
  b.beads.forEach(d => { if (!d.nofit) grow([d.x, d.y, d.z], [d.s, d.s, d.s]); });
  const c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  let half = 0.001;
  for (const sway of [-0.22, 0, 0.22]) {
    const cy = Math.cos(view.yaw + sway), sy = Math.sin(view.yaw + sway);
    const cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
    for (const q of pts) {
      const x = q[0] - c[0], y = q[1] - c[1], z = q[2] - c[2];
      const xr = x * cy + z * sy, zr = -x * sy + z * cy;
      const yr = y * cp - zr * sp;
      half = Math.max(half, Math.abs(xr), Math.abs(yr) * 1.12);
    }
  }
  const k = 1 / half;
  b.parts.forEach(p => {
    p.p = [(p.p[0] - c[0]) * k, (p.p[1] - c[1]) * k, (p.p[2] - c[2]) * k];
    p.s = [p.s[0] * k, p.s[1] * k, p.s[2] * k];
  });
  b.beads.forEach(d => {
    d.x = (d.x - c[0]) * k; d.y = (d.y - c[1]) * k; d.z = (d.z - c[2]) * k;
    d.s = Math.max(d.s * k, 0.011);
  });
  return { parts: b.parts, beads: b.beads, yaw: view.yaw, pitch: view.pitch };
}
