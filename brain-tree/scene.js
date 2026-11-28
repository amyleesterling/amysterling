// Brain Tree: the stage. One three.js scene that holds a pool of soft
// ellipsoids and a pool of glowing beads, and flows them from one stop's
// recipe to the next. See models.js for what the shapes mean.

import * as THREE from "./vendor/three/three.module.min.js";
import { REGION_COLORS } from "./models.js";

const MAX_BEADS = 1500;

const VERT = /* glsl */`
uniform float uTime, uGyri, uWobble, uSeed;
varying vec3 vN, vV, vO;
varying float vG;
void main() {
  vec3 p = position;
  float w = sin(p.x * 3.0 + uTime * 1.3 + uSeed) * sin(p.y * 3.4 + uTime * 1.1 + uSeed * 0.7)
          * sin(p.z * 2.8 + uTime * 0.9);
  p += normal * w * 0.045 * uWobble;
  float g = sin(p.x * 9.0 + sin(p.y * 7.0 + uSeed) * 2.0) * sin(p.y * 8.0 + sin(p.z * 6.0) * 2.0)
          * sin(p.z * 9.0 + sin(p.x * 5.0 + uSeed) * 2.0);
  p += normal * g * 0.028 * uGyri;
  vG = g; vO = position;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uTime, uGyri, uGlow, uAlpha, uGhost, uSeed;
varying vec3 vN, vV, vO;
varying float vG;
void main() {
  vec3 N = normalize(vN);
  float nv = clamp(abs(dot(N, vV)), 0.0, 1.0);
  float fres = pow(1.0 - nv, 2.0);
  // thin-film style rainbow that slides with the view angle and with time
  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (fres * 1.15 + vO.y * 0.18 + uTime * 0.045 + uSeed * 0.1
              + vec3(0.0, 0.33, 0.67)));
  float light = 0.62 + 0.38 * dot(N, normalize(vec3(-0.35, 0.8, 0.5)));
  vec3 base = uColor * light;
  float groove = smoothstep(-0.2, 0.3, vG);
  base *= mix(1.0, 0.5 + 0.5 * groove, uGyri);
  float pulse = 0.5 + 0.5 * sin(uTime * 2.2 + uSeed);
  vec3 col = mix(base, irid, fres * 0.6) + fres * 0.22;
  col += uColor * uGlow * (0.22 + 0.3 * pulse);
  col += irid * uGlow * fres * 0.5;
  float a = mix(uAlpha, 1.0, fres * 0.7);
  if (uGhost > 0.5) {
    col = mix(uColor, irid, 0.6) * (0.6 + fres);
    a = fres * 0.42 + 0.025;
  }
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;

export function createScene(canvas, opts = {}) {
  const reduced = !!opts.reduced;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  } catch (e) {
    return null;
  }
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const DIST = 9;
  camera.position.set(0, 0, DIST);

  const root = new THREE.Group();     // placed and sized to the stage frame
  const spin = new THREE.Group();     // user rotation
  root.add(spin);
  scene.add(root);

  // ---- blobs ----
  const sphere = new THREE.SphereGeometry(1, 56, 40);
  const blobs = new Map();
  const colorCache = {};
  const colorOf = r => colorCache[r] || (colorCache[r] = new THREE.Color(REGION_COLORS[r] || "#cfe"));

  function makeBlob(key) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uGyri: { value: 0 }, uWobble: { value: reduced ? 0 : 1 },
        uSeed: { value: (blobs.size * 1.618) % 6.28 }, uColor: { value: new THREE.Color("#fff") },
        uGlow: { value: 0 }, uAlpha: { value: 0.6 }, uGhost: { value: 0 },
      },
    });
    const mesh = new THREE.Mesh(sphere, mat);
    mesh.scale.setScalar(0.0001);
    mesh.userData.key = key;
    spin.add(mesh);
    const b = {
      key, mesh, mat, live: false, region: null, struct: null, ghost: false, inner: false,
      p: new THREE.Vector3(), s: new THREE.Vector3(0, 0, 0), pv: new THREE.Vector3(), sv: new THREE.Vector3(),
      tp: new THREE.Vector3(), ts: new THREE.Vector3(0, 0, 0), rz: 0, trz: 0,
      gyri: 0, tgyri: 0, glow: 0, tglow: 0, alpha: 0.6, talpha: 0.6, kick: 0,
      tcolor: new THREE.Color("#fff"), fresh: true,
    };
    blobs.set(key, b);
    return b;
  }

  // ---- beads ----
  const beadGeo = new THREE.IcosahedronGeometry(1, 1);
  const beadMat = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const beadMesh = new THREE.InstancedMesh(beadGeo, beadMat, MAX_BEADS);
  beadMesh.frustumCulled = false;
  beadMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BEADS * 3), 3);
  spin.add(beadMesh);
  const M = beadMesh.instanceMatrix.array;
  const C = beadMesh.instanceColor.array;
  for (let i = 0; i < MAX_BEADS; i++) { M[i * 16 + 15] = 1; }
  // current and target, flat for speed: x y z s r g b
  const cur = new Float32Array(MAX_BEADS * 7);
  const tgt = new Float32Array(MAX_BEADS * 7);
  const meta = new Array(MAX_BEADS).fill(null);
  for (let i = 0; i < MAX_BEADS; i++) {
    const a = i * 2.39996, r = 0.2 + (i % 17) / 17 * 0.6;
    cur[i * 7] = Math.cos(a) * r; cur[i * 7 + 1] = ((i * 0.618) % 1 - 0.5) * 1.6; cur[i * 7 + 2] = Math.sin(a) * r;
  }

  let featured = null;   // { structs:Set, regions:Set } pulsing softly at this stop
  let focus = null;      // { struct, region } lit hard, everything else dimmed
  let yaw = 0.4, pitch = 0.2, tyaw = 0.4, tpitch = 0.2, vyaw = 0, dragging = false;
  let frame = { cx: 0, cy: 0, size: 300 };
  let W = 1, H = 1;

  function hits(item) {
    if (!focus) return false;
    if (focus.struct && item.struct === focus.struct) return true;
    return !!focus.byRegion && item.region === focus.region;
  }
  function isFeatured(item) {
    if (!featured) return false;
    return (item.struct && featured.structs.has(item.struct)) || featured.regions.has(item.region);
  }

  function applyLook() {
    blobs.forEach(b => {
      if (!b.live) return;
      const hit = hits(b), feat = isFeatured(b);
      b.tglow = hit ? 1 : focus ? 0 : feat ? 0.32 : 0;
      const base = b.inner ? 0.78 : 0.5;
      b.talpha = focus ? (hit ? 0.92 : 0.1) : base;
    });
    for (let i = 0; i < MAX_BEADS; i++) {
      const m = meta[i];
      if (!m) continue;
      const hit = hits(m);
      m.gain = focus ? (hit ? 1.5 : 0.22) : 1;
    }
  }

  function setModel(model, instant) {
    const seen = new Set();
    for (const p of model.parts) {
      const b = blobs.get(p.key) || makeBlob(p.key);
      seen.add(p.key);
      b.live = true; b.region = p.region; b.struct = p.struct; b.ghost = p.ghost; b.inner = p.inner;
      b.tp.set(p.p[0], p.p[1], p.p[2]);
      b.ts.set(p.s[0], p.s[1], p.s[2]);
      b.trz = p.rz; b.tgyri = p.gyri;
      b.tcolor.copy(colorOf(p.region));
      b.mat.uniforms.uGhost.value = p.ghost ? 1 : 0;
      b.mesh.renderOrder = p.ghost ? 3 : p.inner ? 1 : 2;
      if (b.fresh) {            // a new part swells up in place, it does not fly in
        b.p.copy(b.tp); b.rz = b.trz; b.mat.uniforms.uColor.value.copy(b.tcolor); b.fresh = false;
      }
      if (b.s.lengthSq() < 1e-6) { b.p.copy(b.tp); b.rz = b.trz; b.mat.uniforms.uColor.value.copy(b.tcolor); }
    }
    blobs.forEach(b => { if (!seen.has(b.key)) { b.live = false; b.ts.set(0, 0, 0); } });

    const n = Math.min(model.beads.length, MAX_BEADS);
    for (let i = 0; i < MAX_BEADS; i++) {
      const o = i * 7;
      if (i < n) {
        const d = model.beads[i], c = colorOf(d.region);
        tgt[o] = d.x; tgt[o + 1] = d.y; tgt[o + 2] = d.z; tgt[o + 3] = d.s;
        tgt[o + 4] = c.r * d.dim; tgt[o + 5] = c.g * d.dim; tgt[o + 6] = c.b * d.dim;
        meta[i] = { region: d.region, struct: d.struct, w: d.w, g: d.g, gain: 1, cg: meta[i] ? meta[i].cg : 1 };
      } else {
        tgt[o + 3] = 0;
        meta[i] = null;
      }
    }
    tyaw = model.yaw; tpitch = model.pitch; vyaw = 0;
    focus = null;
    applyLook();
    if (instant || reduced) snap();
  }

  function snap() {
    blobs.forEach(b => {
      b.p.copy(b.tp); b.s.copy(b.ts); b.pv.set(0, 0, 0); b.sv.set(0, 0, 0); b.rz = b.trz;
      b.gyri = b.tgyri; b.glow = b.tglow; b.alpha = b.talpha; b.mat.uniforms.uColor.value.copy(b.tcolor);
    });
    cur.set(tgt);
    yaw = tyaw; pitch = tpitch;
  }

  // ---- interaction: drag to turn, tap to pick ----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  canvas.addEventListener("pointerdown", e => {
    down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
    dragging = true; vyaw = 0;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", e => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!down.moved && Math.hypot(dx, dy) > 6) down.moved = true;
    if (down.moved) {
      const k = 0.0075;
      tyaw += (e.clientX - (down.lx ?? down.x)) * k;
      tpitch = Math.max(-0.9, Math.min(0.9, tpitch + (e.clientY - (down.ly ?? down.y)) * k));
      vyaw = (e.clientX - (down.lx ?? down.x)) * k;
    }
    down.lx = e.clientX; down.ly = e.clientY;
  });
  function up(e) {
    if (!down) return;
    const tap = !down.moved && performance.now() - down.t < 500;
    dragging = false;
    if (tap && opts.onPick) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const list = [];
      blobs.forEach(b => { if (b.live && !b.ghost) list.push(b.mesh); });
      const found = ray.intersectObjects(list, false);
      // prefer a part that tells a story at this stop over the shell around it
      let pick = null;
      for (const f of found) {
        const b = blobs.get(f.object.userData.key);
        if (!pick) pick = b;
        if (b.struct || (featured && featured.regions.has(b.region))) { pick = b; break; }
      }
      if (pick) { pick.kick = 1; opts.onPick({ region: pick.region, struct: pick.struct }); }
      else opts.onPick(null);
    }
    down = null;
  }
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", () => { down = null; dragging = false; });

  // ---- layout ----
  function layout() {
    const wpp = 2 * DIST * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / H;
    root.position.set((frame.cx - W / 2) * wpp, -(frame.cy - H / 2) * wpp, 0);
    root.scale.setScalar(frame.size * 0.5 * wpp * 0.94);
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    layout();
  }
  function setFrame(f) { frame = f; layout(); }

  // ---- the loop ----
  let last = performance.now(), time = 0, raf = 0, running = true;
  const tmpC = new THREE.Color();
  function tick(now) {
    raf = running ? requestAnimationFrame(tick) : 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;

    if (!dragging && !reduced) {
      tyaw += vyaw; vyaw *= Math.pow(0.02, dt);
    }
    const idle = reduced ? 0 : Math.sin(time * 0.35) * 0.22;
    const e = 1 - Math.exp(-dt * 7);
    yaw += (tyaw - yaw) * e; pitch += (tpitch - pitch) * e;
    spin.rotation.set(pitch, yaw + idle, 0, "XYZ");
    spin.position.y = reduced ? 0 : Math.sin(time * 0.8) * 0.02;

    const damp = Math.exp(-dt * 11), kS = 90, kP = 60, eu = 1 - Math.exp(-dt * 6);
    blobs.forEach(b => {
      // spring, slightly under-damped, so parts settle with a soft overshoot
      b.sv.x = (b.sv.x + (b.ts.x - b.s.x) * kS * dt) * damp;
      b.sv.y = (b.sv.y + (b.ts.y - b.s.y) * kS * dt) * damp;
      b.sv.z = (b.sv.z + (b.ts.z - b.s.z) * kS * dt) * damp;
      b.s.addScaledVector(b.sv, dt);
      b.pv.x = (b.pv.x + (b.tp.x - b.p.x) * kP * dt) * damp;
      b.pv.y = (b.pv.y + (b.tp.y - b.p.y) * kP * dt) * damp;
      b.pv.z = (b.pv.z + (b.tp.z - b.p.z) * kP * dt) * damp;
      b.p.addScaledVector(b.pv, dt);
      b.rz += (b.trz - b.rz) * eu;
      b.gyri += (b.tgyri - b.gyri) * eu;
      b.glow += (b.tglow - b.glow) * eu;
      b.alpha += (b.talpha - b.alpha) * eu;
      b.kick *= Math.exp(-dt * 4.5);
      const k = 1 + Math.sin(b.kick * 9) * b.kick * 0.16;
      const sx = Math.max(b.s.x, 0.0001), sy = Math.max(b.s.y, 0.0001), sz = Math.max(b.s.z, 0.0001);
      b.mesh.visible = sx > 0.002;
      b.mesh.position.copy(b.p);
      b.mesh.scale.set(sx * k, sy * (2 - k), sz * k);
      b.mesh.rotation.z = b.rz;
      const u = b.mat.uniforms;
      u.uTime.value = time; u.uGyri.value = b.gyri; u.uGlow.value = b.glow; u.uAlpha.value = b.alpha;
      u.uColor.value.lerp(b.tcolor, eu);
    });

    for (let i = 0; i < MAX_BEADS; i++) {
      const o = i * 7, m = meta[i];
      const rate = 1 - Math.exp(-dt * (2.6 + (i % 9) * 0.45));
      for (let k = 0; k < 7; k++) cur[o + k] += (tgt[o + k] - cur[o + k]) * rate;
      let s = cur[o + 3], gain = 0.75, bx = 0, by = 0;
      if (m) {
        m.cg += (m.gain - m.cg) * eu;
        // a signal running along each strand, or out across a net
        let d = (time * 0.32 + m.g) % 1 - m.w;
        d -= Math.round(d);
        const pulse = reduced ? 0 : Math.exp(-d * d * 90);
        gain = (0.5 + pulse * 0.95) * m.cg;
        s *= 1 + pulse * 0.45;
        if (!reduced) { bx = Math.sin(time * 1.1 + i * 1.7) * 0.004; by = Math.cos(time * 0.9 + i * 2.3) * 0.004; }
      }
      const q = i * 16;
      M[q] = s; M[q + 5] = s; M[q + 10] = s;
      M[q + 12] = cur[o] + bx; M[q + 13] = cur[o + 1] + by; M[q + 14] = cur[o + 2];
      C[i * 3] = cur[o + 4] * gain; C[i * 3 + 1] = cur[o + 5] * gain; C[i * 3 + 2] = cur[o + 6] * gain;
    }
    beadMesh.instanceMatrix.needsUpdate = true;
    beadMesh.instanceColor.needsUpdate = true;

    renderer.render(scene, camera);
  }

  resize();
  raf = requestAnimationFrame(tick);
  let active = true;
  function updateVisibility() {
    running = active && !document.hidden;
    if (!running && raf) { cancelAnimationFrame(raf); raf = 0; }
    if (running && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  document.addEventListener("visibilitychange", updateVisibility);

  return {
    setActive(value) { active = value; updateVisibility(); },
    setModel, setFrame, resize,
    setFeatured(f) { featured = f; applyLook(); },
    setFocus(f) { focus = f; applyLook(); },
    kick(struct) { blobs.forEach(b => { if (b.live && b.struct === struct) b.kick = 1; }); },
  };
}
