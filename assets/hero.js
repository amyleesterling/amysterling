// The hero cell: Lightning Tree, a real MICrONS pyramidal neuron, drag to turn.
// Same material recipe as Inner Cosmos: emissive surface plus a faint additive wireframe.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const host = document.getElementById("cell");
const COLOR = 0x7ee0ff;
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

function supportsWebGL() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

if (host && supportsWebGL()) start();

function start() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
  camera.position.set(0, 0.1, 4.4);

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2, 3, 4); scene.add(key);
  const fill = new THREE.DirectionalLight(COLOR, 0.9); fill.position.set(-3, -1, 2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xb18cff, 0.9); rim.position.set(0, 2, -4); scene.add(rim);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = !still;
  controls.autoRotateSpeed = 0.9;
  controls.minPolarAngle = Math.PI * 0.2;
  controls.maxPolarAngle = Math.PI * 0.8;

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host);
  resize();

  new GLTFLoader().load("media/mesh/lightning-tree.glb", (gltf) => {
    const root = gltf.scene;
    // Collect meshes first; adding children during traverse() recurses forever.
    const meshes = [];
    root.traverse((o) => { if (o.isMesh) meshes.push(o); });
    for (const m of meshes) {
      m.material = new THREE.MeshStandardMaterial({
        color: COLOR, emissive: COLOR, emissiveIntensity: 0.22,
        roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide,
        transparent: true, opacity: 0.94,
      });
      const wire = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({
        color: COLOR, wireframe: true, transparent: true, opacity: 0.1,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      m.add(wire);
    }
    // Center on the bounding box and fit the tallest side to the frame.
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);
    const s = 2.3 / Math.max(size.x, size.y, size.z);
    const pivot = new THREE.Group();
    pivot.scale.setScalar(s);
    pivot.add(root);
    scene.add(pivot);
    host.classList.add("ready");
  });

  // Only draw while the hero is on screen and the tab is visible.
  let visible = true;
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(host);
  renderer.setAnimationLoop(() => {
    if (!visible || document.hidden) return;
    controls.update();
    renderer.render(scene, camera);
  });
}
