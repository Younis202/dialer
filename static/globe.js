/* DIALR — 3D Globe (Three.js, no external loaders).
 * Renders a wireframe glowing earth + arcs from a fixed origin
 * (your country) to every recent call destination. */
(() => {
"use strict";

const VERTEX_SHADER = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }`;
const ATMO_SHADER = `
  varying vec3 vNormal;
  void main() {
    float intensity = pow(0.65 - dot(vNormal, vec3(0,0,1.0)), 2.0);
    gl_FragColor = vec4(0.0, 0.9, 0.7, 1.0) * intensity;
  }`;

const State = {
  scene: null, camera: null, renderer: null, globe: null, group: null,
  arcs: [], pins: [], raf: null, mounted: false,
  origin: { lat: 30.04, lng: 31.24 },   // Cairo by default
  rotateY: 0,
};

function latLngToVec3(lat, lng, radius) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta),
  );
}

function makeArc(from, to, color = 0x00e5b0) {
  const start = latLngToVec3(from.lat, from.lng, 1.01);
  const end   = latLngToVec3(to.lat, to.lng, 1.01);
  const mid   = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(1.5);
  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  const geometry = new THREE.TubeGeometry(curve, 64, 0.005, 8, false);
  const material = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = { age: 0, life: 220, color };
  return mesh;
}

function makePin(lat, lng, color = 0x00e5b0, size = 0.012) {
  const v = latLngToVec3(lat, lng, 1.01);
  const geo = new THREE.SphereGeometry(size, 12, 12);
  const mat = new THREE.MeshBasicMaterial({ color });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(v);
  m.userData = { age: 0, lat, lng };
  return m;
}

function buildGraticule() {
  const group = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: 0x00e5b0, transparent: true, opacity: 0.18 });
  // latitudes
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts = [];
    for (let lng = 0; lng <= 360; lng += 4) pts.push(latLngToVec3(lat, lng - 180, 1.0));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    group.add(new THREE.Line(geo, mat));
  }
  // longitudes
  for (let lng = 0; lng < 360; lng += 30) {
    const pts = [];
    for (let lat = -90; lat <= 90; lat += 4) pts.push(latLngToVec3(lat, lng - 180, 1.0));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    group.add(new THREE.Line(geo, mat));
  }
  return group;
}

function buildContinents() {
  // Sample dense pin pattern shaped vaguely like land — using known capital cities for performance
  const group = new THREE.Group();
  if (!window.__DIALR_COUNTRIES) return group;
  const mat = new THREE.MeshBasicMaterial({ color: 0x1a8068 });
  for (const code in window.__DIALR_COUNTRIES) {
    const c = window.__DIALR_COUNTRIES[code];
    const v = latLngToVec3(c.lat, c.lng, 1.0);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), mat);
    dot.position.copy(v);
    group.add(dot);
  }
  return group;
}

function init(container) {
  if (State.mounted) return;
  State.mounted = true;
  const w = container.clientWidth, hgt = container.clientHeight;
  State.scene = new THREE.Scene();
  State.camera = new THREE.PerspectiveCamera(45, w / hgt, 0.1, 100);
  State.camera.position.z = 3.2;
  State.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  State.renderer.setPixelRatio(window.devicePixelRatio || 1);
  State.renderer.setSize(w, hgt);
  State.renderer.setClearColor(0x000000, 0);
  container.appendChild(State.renderer.domElement);

  State.group = new THREE.Group();
  State.scene.add(State.group);

  // Core sphere
  const coreGeo = new THREE.SphereGeometry(0.99, 64, 64);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x0a1218 });
  const core = new THREE.Mesh(coreGeo, coreMat);
  State.group.add(core);

  // Continent dots
  State.group.add(buildContinents());

  // Graticule
  State.group.add(buildGraticule());

  // Atmosphere glow
  const atmoGeo = new THREE.SphereGeometry(1.1, 64, 64);
  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER, fragmentShader: ATMO_SHADER,
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending,
  });
  State.scene.add(new THREE.Mesh(atmoGeo, atmoMat));

  // Origin pin
  State.group.add(makePin(State.origin.lat, State.origin.lng, 0xfbbf24, 0.02));

  // Drag to rotate
  let dragging = false, lastX = 0, lastY = 0, rotX = 0, rotY = 0, autoRotate = true;
  State.renderer.domElement.style.cursor = "grab";
  State.renderer.domElement.addEventListener("mousedown", e => { dragging = true; lastX = e.clientX; lastY = e.clientY; State.renderer.domElement.style.cursor = "grabbing"; autoRotate = false; });
  window.addEventListener("mouseup", () => { dragging = false; State.renderer.domElement.style.cursor = "grab"; });
  window.addEventListener("mousemove", e => {
    if (!dragging) return;
    rotY += (e.clientX - lastX) * 0.005;
    rotX += (e.clientY - lastY) * 0.005;
    rotX = Math.max(-1.4, Math.min(1.4, rotX));
    lastX = e.clientX; lastY = e.clientY;
  });
  State.renderer.domElement.addEventListener("wheel", e => {
    e.preventDefault();
    State.camera.position.z = Math.max(1.6, Math.min(6, State.camera.position.z + e.deltaY * 0.002));
  }, { passive: false });

  // Animation loop
  const tick = () => {
    State.raf = requestAnimationFrame(tick);
    if (autoRotate) rotY += 0.0015;
    State.group.rotation.y = rotY;
    State.group.rotation.x = rotX;

    // Animate arcs
    for (let i = State.arcs.length - 1; i >= 0; i--) {
      const a = State.arcs[i];
      a.userData.age += 1;
      const t = a.userData.age / a.userData.life;
      a.material.opacity = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 0.3) / 0.7);
      if (t > 1) {
        State.group.remove(a); a.geometry.dispose(); a.material.dispose(); State.arcs.splice(i, 1);
      }
    }
    // Pulse pins
    State.pins.forEach(p => {
      p.userData.age += 1;
      const s = 1 + 0.4 * Math.sin(p.userData.age * 0.06);
      p.scale.set(s, s, s);
    });

    State.renderer.render(State.scene, State.camera);
  };
  tick();

  // Resize
  window.addEventListener("resize", onResize);
}

function onResize() {
  const c = State.renderer && State.renderer.domElement.parentElement;
  if (!c) return;
  const w = c.clientWidth, h = c.clientHeight;
  State.camera.aspect = w / h; State.camera.updateProjectionMatrix();
  State.renderer.setSize(w, h);
}

function setOrigin(lat, lng) { State.origin = { lat, lng }; }

function addCallArc(toLat, toLng, color) {
  if (!State.group) return;
  const arc = makeArc(State.origin, { lat: toLat, lng: toLng }, color);
  State.group.add(arc); State.arcs.push(arc);
  // also add a small pin if not already present
  const pin = makePin(toLat, toLng, color || 0x00e5b0, 0.015);
  State.group.add(pin); State.pins.push(pin);
  if (State.pins.length > 60) {
    const old = State.pins.shift(); State.group.remove(old);
    old.geometry.dispose(); old.material.dispose();
  }
}

function loadFromCallsData(calls) {
  if (!State.group) return;
  // clear existing arcs/pins
  State.arcs.forEach(a => { State.group.remove(a); a.geometry.dispose(); a.material.dispose(); });
  State.pins.forEach(p => { State.group.remove(p); p.geometry.dispose(); p.material.dispose(); });
  State.arcs = []; State.pins = [];
  calls.forEach(c => addCallArc(c.lat, c.lng, 0x00e5b0));
}

function destroy() {
  if (State.raf) cancelAnimationFrame(State.raf);
  if (State.renderer) {
    State.renderer.dispose();
    State.renderer.domElement.parentElement && State.renderer.domElement.parentElement.removeChild(State.renderer.domElement);
  }
  State.mounted = false;
  State.scene = null; State.camera = null; State.renderer = null; State.group = null;
  State.arcs = []; State.pins = [];
}

window.DialrGlobe = { init, addCallArc, loadFromCallsData, setOrigin, destroy };
})();
