// Motor 3D do vídeo "E se um meteoro caísse na terra do Evangelista".
// Tudo é função pura do tempo t (segundos) -> permite renderizar qualquer frame isolado.
import * as THREE from './vendor/three.module.js';

// ---------------------------------------------------------------- utilidades
const PI = Math.PI, TAU = PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const eOut = t => 1 - Math.pow(1 - clamp(t), 3);
const eIn = t => Math.pow(clamp(t), 3);
const eIO = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const fract = x => x - Math.floor(x);
const hash = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const vn = (t, s = 0) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return lerp(hash(i + s * 57.31), hash(i + 1 + s * 57.31), u) * 2 - 1; };
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const mat = (c, o = {}) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 8, ...o });
const basic = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o });
function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
function ctex(w, h, draw) { const t = new THREE.CanvasTexture(canvas(w, h, draw)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };

let W, H, renderer, out, ctx, FALAS = [];
const FONT = '"TitleFont", "Inter", "DejaVu Sans", "IPAGothic", sans-serif';

// ---------------------------------------------------------------- texturas base
let GLOW, SPARK;
function baseTextures() {
  GLOW = ctex(128, 128, (g, w) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.6)'); r.addColorStop(.6, 'rgba(255,255,255,.15)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
  SPARK = ctex(64, 64, (g, w) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.5, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
}
function sprite(color, scale, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.setScalar(scale); return s;
}

// ---------------------------------------------------------------- partículas
function particles(N) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), siz = new Float32Array(N), alp = new Float32Array(N);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('pcolor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('psize', new THREE.BufferAttribute(siz, 1));
  g.setAttribute('palpha', new THREE.BufferAttribute(alp, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { map: { value: SPARK }, uScale: { value: 500 } },
    vertexShader: `attribute vec3 pcolor; attribute float psize; attribute float palpha; uniform float uScale; varying vec3 vC; varying float vA;
      void main(){ vC=pcolor; vA=palpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=clamp(psize*uScale/max(-mv.z,0.05),0.0,260.0); gl_Position=projectionMatrix*mv; if(palpha<0.002) gl_PointSize=0.0; }`,
    fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ float a=texture2D(map,gl_PointCoord).a*vA; if(a<0.004) discard; gl_FragColor=vec4(vC,a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 5;
  const r = rng(N * 13 + 7);
  const rnd = Array.from({ length: N }, () => [r(), r(), r(), r(), r()]);
  return {
    pts, N, pos, col, siz, alp, rnd,
    set(i, x, y, z, s, a, cr, cg, cb) { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; siz[i] = s; alp[i] = a; col[i * 3] = cr; col[i * 3 + 1] = cg; col[i * 3 + 2] = cb; },
    commit(cam) { for (const k of ['position', 'pcolor', 'psize', 'palpha']) g.attributes[k].needsUpdate = true; m.uniforms.uScale.value = H / (2 * Math.tan(cam.fov * PI / 360)); },
    hide() { alp.fill(0); g.attributes.palpha.needsUpdate = true; },
  };
}
function unitRand(r) { const u = r[0] * 2 - 1, th = r[1] * TAU, s = Math.sqrt(1 - u * u); return [s * Math.cos(th), u, s * Math.sin(th)]; }

// fitas (relâmpagos/rachaduras) — quads voltados para a câmera/chão
function ribbonMesh(maxSeg, color, additive = true) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(maxSeg * 6 * 3);
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const o = new THREE.Mesh(g, m); o.frustumCulled = false; o.renderOrder = 6;
  let n = 0; const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), q = new THREE.Vector3();
  return {
    o, begin() { n = 0; },
    seg(A, B, w, view) { // view: vetor (direção da câmera) ou 'up'
      if (n >= maxSeg) return; d.subVectors(B, A); q.crossVectors(d, view).normalize().multiplyScalar(w / 2);
      const i = n * 18; const P = [A.x - q.x, A.y - q.y, A.z - q.z, A.x + q.x, A.y + q.y, A.z + q.z, B.x + q.x, B.y + q.y, B.z + q.z, A.x - q.x, A.y - q.y, A.z - q.z, B.x + q.x, B.y + q.y, B.z + q.z, B.x - q.x, B.y - q.y, B.z - q.z];
      for (let k = 0; k < 18; k++) p[i + k] = P[k]; n++;
    },
    end() { g.setDrawRange(0, n * 6); g.attributes.position.needsUpdate = true; },
  };
}

// ---------------------------------------------------------------- céu
function makeSky() {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() } },
    vertexShader: `varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform vec3 top,mid,bot; varying vec3 vP; void main(){ float h=vP.y; vec3 c = h>0.0 ? mix(mid,top,pow(clamp(h*1.4,0.0,1.0),0.7)) : mix(mid,bot,clamp(-h*5.0,0.0,1.0)); gl_FragColor=vec4(c,1.0);
      #include <colorspace_fragment>
    }`,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(3500, 32, 16), m); s.renderOrder = -10; s.frustumCulled = false;
  s.setColors = (t, m2, b) => { m.uniforms.top.value.set(t); m.uniforms.mid.value.set(m2); m.uniforms.bot.value.set(b); };
  return s;
}
function makeStars(N, R, seed, size = 2.2) {
  const r = rng(seed), p = new Float32Array(N * 3), c = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const [x, y, z] = unitRand([r(), r()]); p.set([x * R, y * R, z * R], i * 3); const b = .5 + r() * .5, w = r(); c.set([b, b * (.85 + w * .15), b * (.8 + (1 - w) * .2)], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const o = new THREE.Points(g, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false }));
  o.frustumCulled = false; o.renderOrder = -9; return o;
}

// ---------------------------------------------------------------- personagem low-poly
function nameTex(text, num) {
  return ctex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = 92; g.font = `900 ${fs}px ${FONT}`; while (g.measureText(text).width > w * .94) { fs -= 2; g.font = `900 ${fs}px ${FONT}`; }
    g.fillText(text, w / 2, 70);
    if (num) { g.font = `900 300px ${FONT}`; g.fillText(num, w / 2, 300); }
  });
}
function makePerson(o) {
  const P = {}; const root = new THREE.Group(); const body = new THREE.Group(); body.position.y = .95; root.add(body);
  const hips = new THREE.Group(); body.add(hips); const torso = new THREE.Group(); hips.add(torso);
  Object.assign(P, { root, body, hips, torso });
  const M = { shirt: mat(o.shirt), det: mat(o.detail), skin: mat(o.skin), shorts: mat(o.shorts), sock: mat(o.socks), boot: mat(o.boots), hair: mat(o.hair, { emissive: 0x000000 }), eye: basic(0x111111), mouth: basic(0x5a1a1a) };
  P.M = M;
  hips.add(mesh(new THREE.BoxGeometry(.42, .22, .27), M.shorts, 0, -.02, 0));
  const chestG = new THREE.CylinderGeometry(.28, .22, .64, 8); chestG.rotateY(PI / 8);
  const chest = mesh(chestG, M.shirt, 0, .38, 0); chest.scale.z = .56; torso.add(chest); P.chest = chest;
  // detalhes brancos (gola e faixa lateral)
  const collar = mesh(new THREE.CylinderGeometry(.1, .12, .05, 8), M.det, 0, .71, 0); collar.scale.z = .8; torso.add(collar);
  if (!o.suit) {
    for (const s of [-1, 1]) { const st = mesh(new THREE.BoxGeometry(.03, .5, .16), M.det, s * .245, .38, 0); st.rotation.z = s * .09; torso.add(st); }
    const crest = mesh(new THREE.CircleGeometry(.045, 8), basic(0xffffff), .1, .55, .158); crest.rotation.x = -.09; torso.add(crest);
  } else {
    const tie = mesh(new THREE.BoxGeometry(.06, .34, .02), mat(o.tie || 0xaa1111), 0, .5, .16); torso.add(tie);
    const shirtV = mesh(new THREE.BoxGeometry(.14, .2, .02), mat(0xf2f2f2), 0, .6, .15); torso.add(shirtV);
  }
  if (o.name) {
    const back = mesh(new THREE.PlaneGeometry(.4, .4), new THREE.MeshBasicMaterial({ map: nameTex(o.name, o.num), transparent: true, depthWrite: false }), 0, .43, -.152);
    back.rotation.y = PI; back.rotation.x = -.05; torso.add(back); P.back = back;
  }
  torso.add(mesh(new THREE.CylinderGeometry(.06, .07, .1, 6), M.skin, 0, .76, 0));
  const head = new THREE.Group(); head.position.y = .8; torso.add(head); P.head = head;
  const skull = mesh(new THREE.IcosahedronGeometry(.14, 1), M.skin, 0, .13, 0); skull.scale.set(.92, 1.12, 1); head.add(skull);
  const hair = mesh(new THREE.IcosahedronGeometry(.148, 1), M.hair, 0, .19, -.02); hair.scale.set(.98, .62, 1.0); head.add(hair); P.hair = hair;
  const hairB = mesh(new THREE.IcosahedronGeometry(.14, 1), M.hair, 0, .13, -.035); hairB.scale.set(.96, .9, .9); head.add(hairB);
  for (const s of [-1, 1]) {
    const e = mesh(new THREE.BoxGeometry(.035, .022, .01), M.eye, s * .048, .14, .132); head.add(e); (P.eyes = P.eyes || []).push(e);
    const b = mesh(new THREE.BoxGeometry(.05, .014, .012), M.hair, s * .05, .175, .13); b.rotation.z = -s * .12; head.add(b);
    head.add(mesh(new THREE.BoxGeometry(.03, .06, .04), M.skin, s * .13, .12, 0));
  }
  head.add(mesh(new THREE.BoxGeometry(.03, .05, .04), M.skin, 0, .1, .14));
  const mouth = mesh(new THREE.BoxGeometry(.06, .016, .01), M.mouth, 0, .045, .13); head.add(mouth); P.mouth = mouth;
  if (o.beard) { const bd = mesh(new THREE.BoxGeometry(.2, .05, .06), M.hair, 0, .02, .1); head.add(bd); }
  for (const [side, k] of [[1, 'L'], [-1, 'R']]) {
    const arm = new THREE.Group(); arm.position.set(side * .31, .62, 0); torso.add(arm); P['arm' + k] = arm;
    arm.add(mesh(new THREE.SphereGeometry(.085, 6, 4), M.shirt, 0, -.02, 0));
    arm.add(mesh(new THREE.CylinderGeometry(.08, .072, .2, 6), M.shirt, 0, -.1, 0));
    if (o.suit) arm.add(mesh(new THREE.CylinderGeometry(.07, .065, .14, 6), M.shirt, 0, -.25, 0));
    else { arm.add(mesh(new THREE.CylinderGeometry(.081, .081, .03, 6), M.det, 0, -.19, 0)); arm.add(mesh(new THREE.CylinderGeometry(.06, .055, .14, 6), M.skin, 0, -.26, 0)); }
    const fore = new THREE.Group(); fore.position.y = -.32; arm.add(fore); P['fore' + k] = fore;
    fore.add(mesh(new THREE.CylinderGeometry(.055, .045, .27, 6), o.suit ? M.shirt : M.skin, 0, -.13, 0));
    fore.add(mesh(new THREE.BoxGeometry(.08, .1, .06), M.skin, 0, -.31, 0));
    const leg = new THREE.Group(); leg.position.set(side * .11, -.06, 0); hips.add(leg); P['leg' + k] = leg;
    leg.add(mesh(new THREE.CylinderGeometry(.11, .1, .22, 6), M.shorts, 0, -.1, 0));
    leg.add(mesh(new THREE.CylinderGeometry(.085, .07, .24, 6), o.suit ? M.shorts : M.skin, 0, -.32, 0));
    const shin = new THREE.Group(); shin.position.y = -.44; leg.add(shin); P['shin' + k] = shin;
    shin.add(mesh(new THREE.CylinderGeometry(.068, .05, .4, 6), M.sock, 0, -.2, 0));
    shin.add(mesh(new THREE.BoxGeometry(.11, .08, .26), M.boot, 0, -.44, .05));
  }
  return P;
}
function setPose(P, p) {
  P.body.position.set(p.x || 0, .95 + (p.y || 0), p.z || 0); P.body.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
  P.torso.rotation.set(p.tx || 0, p.ty || 0, p.tz || 0); P.head.rotation.set(p.hx || 0, p.hy || 0, p.hz || 0);
  P.armL.rotation.set(p.aLx || 0, p.aLy || 0, p.aLz ?? .12); P.armR.rotation.set(p.aRx || 0, p.aRy || 0, p.aRz ?? -.12);
  P.foreL.rotation.x = p.fLx ?? -.15; P.foreR.rotation.x = p.fRx ?? -.15;
  P.legL.rotation.set(p.lLx || 0, 0, p.lLz || 0); P.legR.rotation.set(p.lRx || 0, 0, p.lRz || 0);
  P.shinL.rotation.x = p.sLx || 0; P.shinR.rotation.x = p.sRx || 0;
  P.mouth.scale.y = p.mouth || 1;
}
function mix(a, b, t) { const r = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = (k === 'aLz') ? .12 : (k === 'aRz') ? -.12 : (k === 'fLx' || k === 'fRx') ? -.15 : (k === 'mouth' ? 1 : 0); r[k] = lerp(a[k] ?? d, b[k] ?? d, t); } return r; }
const POSE = {
  stand: {},
  sit: { y: -.45, lLx: -1.5, lRx: -1.5, sLx: 1.5, sRx: 1.5, aLx: -.5, aRx: -.5, fLx: -.6, fRx: -.6, tx: -.1 },
  lean: { y: -.45, lLx: -1.5, lRx: -1.5, sLx: 1.5, sRx: 1.5, aLx: -.8, aRx: -.8, fLx: -.9, fRx: -.9, tx: .35, hx: -.3 },
  fist: { aRx: -.5, aRz: -.2, fRx: -1.9, aLz: .25, fLx: -.3, hx: -.05 },
  lookUp: { hx: -.6, aLz: .2, aRz: -.2 },
  crouch: { y: -.38, lLx: -1.1, lRx: -1.1, sLx: 1.7, sRx: 1.7, tx: .55, aLx: .9, aRx: .9, fLx: -.3, fRx: -.3, hx: -.5 },
  fly: { aRx: -3.0, aRz: -.1, fRx: -.1, aLx: .3, aLz: .35, lLx: .1, lRx: -.25, sRx: .5, hx: -.2 },
  bike0: { rx: -1.2, lRx: .7, sRx: .6, lLx: -.9, sLx: .5, aLz: 1.2, aRz: -1.2, aLx: -.3, aRx: -.3, hx: .4 },
  bike1: { rx: -2.0, lRx: -1.45, sRx: 0, lLx: .5, sLx: .9, aLz: 1.4, aRz: -1.4, aLx: .3, aRx: .3, hx: .6 },
  power: { y: -.12, lLz: .25, lRz: -.25, sLx: .25, sRx: .25, lLx: -.12, lRx: -.12, aLz: .55, aRz: -.55, aLx: .15, aRx: .15, fLx: -.9, fRx: -.9, tx: .1, hx: .05 },
  powerUp: { y: -.05, lLz: .2, lRz: -.2, aLz: .9, aRz: -.9, aLx: .3, aRx: .3, fLx: -.4, fRx: -.4, tx: -.15, hx: -.35 },
};

// ---------------------------------------------------------------- meteoro
function makeMeteor(R) {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(R, 2); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = V3(p.getX(i), p.getY(i), p.getZ(i)); const k = hash(Math.round(v.x * 50) * 3.1 + Math.round(v.y * 50) * 7.7 + Math.round(v.z * 50) * 1.3); v.multiplyScalar(.82 + k * .3); p.setXYZ(i, v.x, v.y, v.z); }
  const cols = new Float32Array(p.count * 3); const r = rng(5);
  for (let f = 0; f < p.count / 3; f++) { const lava = r() < .28; const c = lava ? [1, .35 + r() * .3, .05] : [.16 + r() * .08, .11, .09]; for (let k = 0; k < 3; k++) cols.set(c, (f * 3 + k) * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
  const rock = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, emissive: 0x551100, shininess: 4, fog: false }));
  g.add(rock);
  const s1 = sprite(0xff7a1a, R * 3.4, .9), s2 = sprite(0xff3000, R * 6, .55), s3 = sprite(0xffe08a, R * 2.3, .7);
  g.add(s2, s1, s3);
  const trail = particles(900);
  return { g, rock, glows: [s1, s2, s3], trail, R };
}
function updateMeteor(M, pos, back, t, cam, k = 1, len = 10, sc = 1) {
  M.g.position.copy(pos); M.g.scale.setScalar(sc); M.rock.rotation.set(t * .7, t * 1.1, t * .3);
  M.glows[0].material.opacity = .6 * k * (1 + .1 * Math.sin(t * 31)); M.glows[1].material.opacity = .3 * k; M.glows[2].material.opacity = .35 * k;
  const R = M.R * sc, T = M.trail; const up = Math.abs(back.y) > .9 ? V3(1, 0, 0) : V3(0, 1, 0); const s1 = V3().crossVectors(back, up).normalize(), s2 = V3().crossVectors(back, s1);
  for (let i = 0; i < T.N; i++) {
    const r = T.rnd[i]; const age = fract(t * 1.9 + r[0]); const d = R * (.2 + age * len); const sp = R * (.55 + age * 1.6) * Math.sqrt(r[1]); const a = r[2] * TAU;
    const ox = Math.cos(a) * sp, oy = Math.sin(a) * sp;
    const x = pos.x + back.x * d + s1.x * ox + s2.x * oy, y = pos.y + back.y * d + s1.y * ox + s2.y * oy, z = pos.z + back.z * d + s1.z * ox + s2.z * oy;
    const c = age < .2 ? [1, .92, .55] : age < .5 ? [1, .5, .12] : [.75, .16, .05];
    T.set(i, x, y, z, R * (1.6 * (1 - age) + .4) * (.6 + r[3] * .8), Math.pow(1 - age, 1.6) * .16 * k, ...c);
  }
  T.commit(cam);
}

// ---------------------------------------------------------------- planetas
function planetTex(kind) {
  return ctex(512, 256, (g, w, h) => {
    const r = rng(kind.length * 99 + kind.charCodeAt(0));
    const blob = (x, y, rad, c) => { g.fillStyle = c; g.beginPath(); for (let k = 0; k < 14; k++) { const a = k / 14 * TAU, rr = rad * (.7 + r() * .5); g.lineTo(x + Math.cos(a) * rr * 1.6, y + Math.sin(a) * rr); } g.fill(); };
    if (kind === 'moon') { g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) blob(r() * w, r() * h, 6 + r() * 26, r() < .5 ? '#7d7d7d' : '#b2b2b2'); for (let i = 0; i < 50; i++) { g.strokeStyle = 'rgba(60,60,60,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(r() * w, r() * h, 3 + r() * 12, 0, TAU); g.stroke(); } }
    if (kind === 'mars') { g.fillStyle = '#c1502a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 30; i++) blob(r() * w, 40 + r() * (h - 80), 10 + r() * 30, r() < .5 ? '#8f3418' : '#d9733e'); g.fillStyle = '#f3e7dc'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 12, w, 12); }
    if (kind === 'jupiter') { const cs = ['#d8b88a', '#b98a5e', '#efe0c4', '#a5714a', '#e2c79c', '#c49565', '#f1e3c8']; let y = 0; while (y < h) { const bh = 8 + r() * 26; g.fillStyle = cs[Math.floor(r() * cs.length)]; g.fillRect(0, y, w, bh); y += bh; } g.fillStyle = '#b5482a'; g.beginPath(); g.ellipse(w * .62, h * .64, 34, 18, 0, 0, TAU); g.fill(); }
    if (kind === 'saturn') { const cs = ['#e8d3a0', '#d6bb82', '#f2e4bf', '#c9a76a']; let y = 0; while (y < h) { const bh = 10 + r() * 30; g.fillStyle = cs[Math.floor(r() * cs.length)]; g.fillRect(0, y, w, bh); y += bh; } }
    if (kind === 'earth') { g.fillStyle = '#1d5fb8'; g.fillRect(0, 0, w, h); for (let i = 0; i < 9; i++) { const x = r() * w, y = 50 + r() * (h - 100); for (let k = 0; k < 6; k++) blob(x + (r() - .5) * 80, y + (r() - .5) * 50, 12 + r() * 22, r() < .7 ? '#3f9a45' : '#a98c52'); } g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, 16); g.fillRect(0, h - 16, w, 16); g.globalAlpha = .55; for (let i = 0; i < 40; i++) blob(r() * w, r() * h, 6 + r() * 16, '#ffffff'); g.globalAlpha = 1; }
    if (kind === 'sun') { g.fillStyle = '#ffb21c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++) blob(r() * w, r() * h, 4 + r() * 18, r() < .5 ? '#ff8a10' : '#ffe066'); }
  });
}
function planet(kind, R, seg = 20) { return new THREE.Mesh(new THREE.SphereGeometry(R, seg, Math.round(seg * .6)), new THREE.MeshPhongMaterial({ map: planetTex(kind), flatShading: true, shininess: 2 })); }

// ---------------------------------------------------------------- mundos
const WORLD = {};
const COUNTRIES = [
  { k: 'br', name: 'BRASIL', bg: '#0b6b37', bg2: '#03301a', acc: '#ffd400', tag: 'URGENTE', head: 'METEORO GIGANTE A CAMINHO DA TERRA', tick: 'AO VIVO  •  CIENTISTAS CONFIRMAM ROTA DE COLISÃO  •  POPULAÇÃO EM ALERTA  •  ', ch: 'TV NOTÍCIAS 24', suit: 0x1c2a44, tie: 0x0b8a3a, skin: 0xc68b5e, hair: 0x2a1a10 },
  { k: 'us', name: 'EUA', bg: '#1b2f6b', bg2: '#08122e', acc: '#e52b2b', tag: 'BREAKING NEWS', head: 'GIANT METEOR HEADING FOR EARTH', tick: 'LIVE  •  NASA CONFIRMS IMPACT TRAJECTORY  •  STAY TUNED  •  ', ch: 'WORLD NEWS 24', suit: 0x2b2b30, tie: 0xc21d1d, skin: 0xf0c8a0, hair: 0xd9b25a },
  { k: 'jp', name: 'JAPÃO', bg: '#7a1020', bg2: '#2a0308', acc: '#ffffff', tag: '速報', head: '巨大隕石が地球に接近中', tick: 'ライブ  •  衝突コースを確認  •  最新情報  •  ', ch: 'ニュース 24', suit: 0x1a1a22, tie: 0x2a4fae, skin: 0xf1d0a8, hair: 0x0e0e12 },
  { k: 'fr', name: 'FRANÇA', bg: '#1d3a8a', bg2: '#091740', acc: '#ffffff', tag: 'URGENT', head: 'UNE MÉTÉORITE GÉANTE FONCE VERS LA TERRE', tick: 'EN DIRECT  •  TRAJECTOIRE DE COLLISION CONFIRMÉE  •  ', ch: 'INFO 24', suit: 0x3a2a2a, tie: 0x1d3a8a, skin: 0xe9c09a, hair: 0x5a3a1e },
  { k: 'eg', name: 'EGITO', bg: '#7a5a0e', bg2: '#2a1c02', acc: '#ce1126', tag: 'عاجل', head: 'نيزك عملاق يقترب من الأرض', tick: 'مباشر  •  تأكيد مسار الاصطدام  •  ', ch: 'أخبار 24', suit: 0x222222, tie: 0xce1126, skin: 0xb98058, hair: 0x15100c },
];
function drawFlag(g, k, x, y, w, h) {
  g.save(); g.translate(x, y);
  if (k === 'br') { g.fillStyle = '#009c3b'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffdf00'; g.beginPath(); g.moveTo(w * .08, h / 2); g.lineTo(w / 2, h * .1); g.lineTo(w * .92, h / 2); g.lineTo(w / 2, h * .9); g.fill(); g.fillStyle = '#002776'; g.beginPath(); g.arc(w / 2, h / 2, h * .25, 0, TAU); g.fill(); }
  if (k === 'us') { for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#fff' : '#b22234'; g.fillRect(0, i * h / 13, w, h / 13 + 1); } g.fillStyle = '#3c3b6e'; g.fillRect(0, 0, w * .42, h * 7 / 13); g.fillStyle = '#fff'; for (let i = 0; i < 4; i++)for (let j = 0; j < 5; j++) g.fillRect(w * .04 + j * w * .075, h * .06 + i * h * .12, 2, 2); }
  if (k === 'jp') { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#bc002d'; g.beginPath(); g.arc(w / 2, h / 2, h * .3, 0, TAU); g.fill(); }
  if (k === 'fr') { ['#0055a4', '#fff', '#ef4135'].forEach((c, i) => { g.fillStyle = c; g.fillRect(i * w / 3, 0, w / 3 + 1, h); }); }
  if (k === 'eg') { ['#ce1126', '#fff', '#000'].forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * h / 3, w, h / 3 + 1); }); g.fillStyle = '#c09300'; g.beginPath(); g.arc(w / 2, h / 2, h * .1, 0, TAU); g.fill(); }
  g.restore();
}
function fitFont(g, text, maxW, size, weight = 900) { let s = size; g.font = `${weight} ${s}px ${FONT}`; while (g.measureText(text).width > maxW && s > 8) { s -= 1; g.font = `${weight} ${s}px ${FONT}`; } return s; }

function buildStudio() {
  const S = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(38, 4 / 3, .1, 50); S.add(cam);
  cam.position.set(.2, 1.55, 4.0); cam.lookAt(.2, 1.45, 0);
  S.add(new THREE.HemisphereLight(0xffffff, 0x404050, 1.6)); const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(2, 4, 5); S.add(dl);
  const C = COUNTRIES.map(c => {
    const wall = ctex(1024, 640, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, c.bg); gr.addColorStop(1, c.bg2); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2; for (let i = 0; i < 20; i++) { g.beginPath(); g.moveTo(i * 60, 0); g.lineTo(i * 60 - 200, h); g.stroke(); }
      // quadro com o meteoro
      const X = 560, Y = 90, BW = 400, BH = 300; g.fillStyle = '#05050c'; g.fillRect(X, Y, BW, BH); g.strokeStyle = c.acc; g.lineWidth = 6; g.strokeRect(X, Y, BW, BH);
      const e = g.createRadialGradient(X + 120, Y + 230, 10, X + 120, Y + 230, 110); e.addColorStop(0, '#4aa3ff'); e.addColorStop(.7, '#1a4f9a'); e.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = e; g.fillRect(X, Y, BW, BH);
      g.strokeStyle = 'rgba(255,120,30,.9)'; g.lineWidth = 18; g.lineCap = 'round'; g.beginPath(); g.moveTo(X + 380, Y + 30); g.lineTo(X + 290, Y + 100); g.stroke();
      const m = g.createRadialGradient(X + 280, Y + 108, 2, X + 280, Y + 108, 40); m.addColorStop(0, '#fff3c0'); m.addColorStop(.4, '#ff8a1a'); m.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = m; g.beginPath(); g.arc(X + 280, Y + 108, 40, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.font = `900 34px ${FONT}`; g.textAlign = 'left'; g.fillText(c.ch, 40, 70);
      drawFlag(g, c.k, 40, 100, 120, 80);
    });
    const banner = ctex(1024, 200, (g, w, h) => {
      g.fillStyle = '#d0021b'; g.fillRect(0, 0, w * .42, 70); g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left';
      fitFont(g, c.tag, w * .38, 52); g.fillText(c.tag, 20, 37);
      g.fillStyle = 'rgba(10,10,18,.92)'; g.fillRect(0, 70, w, 90); drawFlag(g, c.k, 14, 82, 96, 64);
      g.fillStyle = '#fff'; fitFont(g, c.head, w - 150, 50); g.fillText(c.head, 128, 116);
      g.fillStyle = c.acc; g.fillRect(0, 160, w, 6);
    });
    const tick = ctex(1024, 48, (g, w, h) => { g.fillStyle = '#ffd400'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.textBaseline = 'middle'; g.font = `800 30px ${FONT}`; let x = 10; while (x < w) { g.fillText(c.tick, x, 26); x += g.measureText(c.tick).width; } });
    tick.wrapS = THREE.RepeatWrapping;
    const anchor = makePerson({ shirt: c.suit, detail: 0xffffff, skin: c.skin, hair: c.hair, shorts: c.suit, socks: c.suit, boots: 0x111111, suit: true, tie: c.tie });
    return { ...c, wall, banner, tick, anchor };
  });
  const wall = mesh(new THREE.PlaneGeometry(7.2, 4.5), new THREE.MeshBasicMaterial({ map: C[0].wall }), 0, 1.9, -2.2); S.add(wall);
  const deskM = mat(0x222831); const desk = mesh(new THREE.BoxGeometry(2.6, .95, 1), deskM, -.25, .47, .35); S.add(desk);
  const deskStripe = mesh(new THREE.BoxGeometry(2.62, .12, 1.02), mat(0xffffff, { emissive: 0x333333 }), -.25, .82, .35); S.add(deskStripe);
  S.add(mesh(new THREE.BoxGeometry(12, .1, 8), mat(0x15151b), 0, 0, 0));
  const ban = mesh(new THREE.PlaneGeometry(1, .195), new THREE.MeshBasicMaterial({ map: C[0].banner, transparent: true, depthTest: false }), 0, -.19, -.75); ban.scale.setScalar(.75); cam.add(ban); ban.renderOrder = 10;
  const tk = mesh(new THREE.PlaneGeometry(1, .047), new THREE.MeshBasicMaterial({ map: C[0].tick, depthTest: false }), 0, -.245, -.75); tk.scale.setScalar(.75); cam.add(tk); tk.renderOrder = 10;
  const live = ctex(256, 80, (g) => { g.fillStyle = '#d0021b'; g.fillRect(0, 0, 256, 80); g.fillStyle = '#fff'; g.font = `900 48px ${FONT}`; g.textBaseline = 'middle'; g.fillText('● LIVE', 18, 42); });
  const liveM = mesh(new THREE.PlaneGeometry(.12, .0375), new THREE.MeshBasicMaterial({ map: live, depthTest: false }), .28, .24, -.75); cam.add(liveM); liveM.renderOrder = 10;
  for (const c of C) { c.anchor.root.position.set(-.55, -.05, -.1); S.add(c.anchor.root); }
  const rts = C.map(() => { const rt = new THREE.WebGLRenderTarget(480, 360, { samples: 0 }); rt.texture.colorSpace = THREE.SRGBColorSpace; return rt; });
  WORLD.studio = { S, cam, C, wall, ban, tk, rts, deskStripe };
}
function speakingAmp(i, t) { // apresentador i fala?
  const f = FALAS.find(f => f.cena === 1 && f.id === String(i + 1).padStart(2, '0'));
  const s = f ? f.inicio : 1.8 + i * 2, e = f ? f.fim - .2 : s + 1.8;
  return (t > s && t < e) ? .5 + .5 * Math.abs(vn(t * 9, i)) : 0;
}
function renderStudio(i, t) {
  const st = WORLD.studio, c = st.C[i];
  st.wall.material.map = c.wall; st.ban.material.map = c.banner; st.tk.material.map = c.tick; c.tick.offset.x = t * .12;
  st.deskStripe.material.color.set(c.acc === '#ffffff' ? c.bg : c.acc);
  st.C.forEach((o, j) => o.anchor.root.visible = j === i);
  const amp = speakingAmp(i, t);
  setPose(c.anchor, { aLx: -.55, aRx: -.55, fLx: -.9, fRx: -.9, aLz: .15, aRz: -.15, hx: .05 + vn(t * 1.3, i) * .05, hy: vn(t * .7, i + 3) * .12, tz: vn(t * .5, i) * .03, mouth: 1 + amp * 3.5, fRy: 0 });
  c.anchor.foreR.rotation.x = -.9 + amp * vn(t * 3, i) * .3;
  renderer.setRenderTarget(st.rts[i]); renderer.setClearColor(0x000000); renderer.render(st.S, st.cam); renderer.setRenderTarget(null);
  return st.rts[i].texture;
}

// mundo 1: parede de TVs
function buildTVWall() {
  const S = new THREE.Scene(); S.background = new THREE.Color(0x020205); S.fog = new THREE.Fog(0x020205, 4, 16);
  S.add(new THREE.AmbientLight(0x6070a0, .35)); const tvL = new THREE.PointLight(0x8aa0ff, 6, 0, 0); tvL.position.set(0, 1.6, 2.5); S.add(tvL);
  S.add(mesh(new THREE.BoxGeometry(14, 9, .2), mat(0x16161f), 0, 1.5, -.45));
  S.add(mesh(new THREE.BoxGeometry(14, .2, 6), mat(0x0d0d12), 0, -2.0, 1.5));
  const slots = [[-.98, 2.8], [.98, 2.8], [-.98, 1.4], [.98, 1.4], [-.98, 0], [.98, 0]];
  const tvs = slots.map(([x, y], i) => {
    const g = new THREE.Group(); g.position.set(x, y, 0); g.rotation.y = -x * .04 + (hash(i) - .5) * .05; S.add(g);
    g.add(mesh(new THREE.BoxGeometry(1.86, 1.38, .32), mat(i % 2 ? 0x1b1b1f : 0x26262c), 0, 0, -.12));
    const scr = mesh(new THREE.PlaneGeometry(1.68, 1.26), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0, .045); g.add(scr);
    g.add(mesh(new THREE.BoxGeometry(.08, .04, .02), basic(0x33ff55), .78, -.66, .05));
    return { g, scr };
  });
  // 6ª TV: radar ao vivo (canvas 2D atualizado por frame)
  const radarC = canvas(320, 240, () => { }); const radar = new THREE.CanvasTexture(radarC); radar.colorSpace = THREE.SRGBColorSpace;
  tvs[5].scr.material.map = radar;
  for (let i = 0; i < 5; i++) tvs[i].scr.material.map = WORLD.studio.rts[i].texture;
  WORLD.tv = { S, tvs, radarC, radar, slots };
}
function drawRadar(t) {
  const { radarC: c, radar } = WORLD.tv; const g = c.getContext('2d'), w = c.width, h = c.height;
  g.fillStyle = '#021006'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(60,255,120,.35)'; g.lineWidth = 1;
  for (let r = 30; r < 200; r += 30) { g.beginPath(); g.arc(w / 2, h / 2, r, 0, TAU); g.stroke(); }
  g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
  const a = t * 2.4; g.fillStyle = 'rgba(60,255,120,.25)'; g.beginPath(); g.moveTo(w / 2, h / 2); g.arc(w / 2, h / 2, 200, a, a + .5); g.fill();
  g.fillStyle = '#3aa0ff'; g.beginPath(); g.arc(w / 2, h / 2, 14, 0, TAU); g.fill();
  const d = lerp(150, 40, t / 12), mx = w / 2 + d * .8, my = h / 2 - d * .55;
  g.fillStyle = (Math.floor(t * 4) % 2) ? '#ff5020' : '#ffd040'; g.beginPath(); g.arc(mx, my, 7, 0, TAU); g.fill();
  g.fillStyle = '#ff5020'; g.font = `900 22px ${FONT}`; g.fillText('IMPACTO: ' + Math.max(0, 12 - t).toFixed(1) + 's', 12, 28);
  g.fillStyle = 'rgba(255,255,255,.08)'; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
  radar.needsUpdate = true;
}

// mundo 2: sala
function buildRoom() {
  const S = new THREE.Scene(); S.background = new THREE.Color(0x05060a); S.fog = new THREE.Fog(0x05060a, 6, 20);
  S.add(new THREE.AmbientLight(0x404a70, .5));
  const tvLight = new THREE.PointLight(0x9fb4ff, 10, 0, 0); tvLight.position.set(0, 1.4, -2.5); S.add(tvLight);
  const lamp = new THREE.PointLight(0xffa860, 4, 0, 0); lamp.position.set(-2.6, 1.8, 1.5); S.add(lamp);
  S.add(mesh(new THREE.BoxGeometry(10, .1, 10), mat(0x3a2a20), 0, -.05, 0));
  S.add(mesh(new THREE.BoxGeometry(10, 4, .1), mat(0x2d3346), 0, 2, -3.6));
  S.add(mesh(new THREE.BoxGeometry(.1, 4, 10), mat(0x283042), -4, 2, 0));
  S.add(mesh(new THREE.BoxGeometry(.1, 4, 10), mat(0x283042), 4, 2, 0));
  const door = mesh(new THREE.BoxGeometry(.05, 2.2, 1), mat(0x6a4a30), 3.94, 1.1, 2); S.add(door);
  // sofá (de frente para a TV, -z)
  const sofa = new THREE.Group(); sofa.position.set(0, 0, .6); S.add(sofa); const sm = mat(0x7a2a2a);
  sofa.add(mesh(new THREE.BoxGeometry(2.4, .45, .9), sm, 0, .25, 0)); sofa.add(mesh(new THREE.BoxGeometry(2.4, .8, .25), sm, 0, .7, .45));
  sofa.add(mesh(new THREE.BoxGeometry(.25, .65, .9), sm, -1.25, .35, 0)); sofa.add(mesh(new THREE.BoxGeometry(.25, .65, .9), sm, 1.25, .35, 0));
  // TV + rack
  S.add(mesh(new THREE.BoxGeometry(2.4, .5, .5), mat(0x1a1a1a), 0, .25, -3.2));
  S.add(mesh(new THREE.BoxGeometry(2.3, 1.35, .08), mat(0x111111), 0, 1.3, -3.3));
  const scr = mesh(new THREE.PlaneGeometry(2.16, 1.22), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 1.3, -3.25); S.add(scr);
  // luminária, planta, quadro
  S.add(mesh(new THREE.CylinderGeometry(.04, .04, 1.6, 6), mat(0x222222), -2.6, .8, 1.5)); S.add(mesh(new THREE.ConeGeometry(.3, .35, 8, 1, true), mat(0xffe2b0, { emissive: 0xaa7030, side: THREE.DoubleSide }), -2.6, 1.75, 1.5));
  S.add(mesh(new THREE.CylinderGeometry(.2, .15, .4, 6), mat(0x8a5a3a), 2.6, .2, -2.6)); S.add(mesh(new THREE.IcosahedronGeometry(.45, 0), mat(0x2f7a3a), 2.6, .8, -2.6));
  const frame = mesh(new THREE.PlaneGeometry(1.2, .8), new THREE.MeshPhongMaterial({ map: ctex(240, 160, (g, w, h) => { g.fillStyle = '#0b6b37'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = `900 40px ${FONT}`; g.textAlign = 'center'; g.fillText('CAMPEÃO', w / 2, 95); g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12); }) }), -3.94, 2.2, -.5); frame.rotation.y = PI / 2; S.add(frame);
  WORLD.room = { S, scr, tvLight };
}

// mundo 3: exterior (Terra)
function buildGround() {
  const S = new THREE.Scene(); const sky = makeSky(); S.add(sky); const stars = makeStars(900, 3000, 11, 2); stars.renderOrder = -9; S.add(stars);
  S.fog = new THREE.Fog(0x000000, 60, 900);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x223322, 1); S.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1); sun.position.set(-50, 80, -100); S.add(sun);
  const fireL = new THREE.PointLight(0xff6a20, 0, 0, 0); S.add(fireL);
  const auraL = new THREE.PointLight(0xffd040, 0, 0, 1.4); auraL.position.set(0, 1.4, 0); S.add(auraL);
  // chão
  const gg = new THREE.PlaneGeometry(1600, 1600, 70, 70); gg.rotateX(-PI / 2); const gp = gg.attributes.position; const r = rng(3);
  for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), z = gp.getZ(i), d = Math.hypot(x, z); gp.setY(i, d < 30 ? 0 : (r() * 2 + Math.max(0, d - 120) * .06 * (.5 + .5 * Math.sin(x * .01) * Math.cos(z * .013)))); }
  const ng = gg.toNonIndexed(); const cc = new Float32Array(ng.attributes.position.count * 3);
  for (let f = 0; f < cc.length / 9; f++) { const k = r(); const c = [.17 + k * .08, .38 + k * .12, .14 + k * .04]; for (let j = 0; j < 3; j++) cc.set(c, (f * 3 + j) * 3); }
  ng.setAttribute('color', new THREE.BufferAttribute(cc, 3)); ng.computeVertexNormals();
  const ground = new THREE.Mesh(ng, new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 0 })); S.add(ground);
  // campinho: linhas brancas
  const lineM = basic(0xdddddd); for (const [w, d, x, z] of [[24, .15, 0, -14], [24, .15, 0, 14], [.15, 28, -12, 0], [.15, 28, 12, 0], [24, .15, 0, 0]]) S.add(mesh(new THREE.BoxGeometry(w, .02, d), lineM, x, .02, z));
  const circ = mesh(new THREE.RingGeometry(2.9, 3.05, 32), basic(0xdddddd, { side: THREE.DoubleSide }), 0, .03, 0); circ.rotation.x = -PI / 2; S.add(circ);
  for (const z of [-14, 14]) { const gl = new THREE.Group(); gl.position.set(0, 0, z); const pm = mat(0xffffff); gl.add(mesh(new THREE.BoxGeometry(.12, 2.4, .12), pm, -3.6, 1.2, 0), mesh(new THREE.BoxGeometry(.12, 2.4, .12), pm, 3.6, 1.2, 0), mesh(new THREE.BoxGeometry(7.3, .12, .12), pm, 0, 2.4, 0)); S.add(gl); }
  // árvores, casas, postes
  const tr = rng(9); const trunkM = mat(0x5a3b22), leafM = [mat(0x1f6a2a), mat(0x2d7f33), mat(0x3a8f3a)];
  for (let i = 0; i < 70; i++) { const a = tr() * TAU, d = 24 + tr() * 160; const x = Math.cos(a) * d, z = Math.sin(a) * d; const s = 1 + tr() * 1.6; const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(s); t.add(mesh(new THREE.CylinderGeometry(.2, .3, 2, 5), trunkM, 0, 1, 0)); t.add(mesh(new THREE.ConeGeometry(1.4, 3, 6), leafM[i % 3], 0, 3, 0)); t.add(mesh(new THREE.ConeGeometry(1.0, 2.2, 6), leafM[(i + 1) % 3], 0, 4.3, 0)); S.add(t); }
  const houseCols = [0xe8d6b0, 0xc9e0f0, 0xf0c0a0, 0xd8e8c0];
  for (let i = 0; i < 10; i++) { const a = -PI / 2 + (i - 4.5) * .22 + PI, d = 40 + (i % 3) * 14; const h = new THREE.Group(); h.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); h.rotation.y = -a + PI / 2; h.add(mesh(new THREE.BoxGeometry(6, 4, 5), mat(houseCols[i % 4]), 0, 2, 0)); const roof = mesh(new THREE.ConeGeometry(4.6, 2.4, 4), mat(0x9a3a2a), 0, 5.2, 0); roof.rotation.y = PI / 4; roof.scale.z = .85; h.add(roof); h.add(mesh(new THREE.BoxGeometry(1, 2, .1), mat(0x4a2a1a), 0, 1, 2.52)); for (const s of [-1, 1]) h.add(mesh(new THREE.BoxGeometry(1, 1, .1), basic(0xffd890), s * 1.8, 2.5, 2.52)); S.add(h); }
  // nuvens
  const clouds = new THREE.Group(); S.add(clouds); const cr = rng(21); const cm = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9a7a70, flatShading: true, transparent: true, opacity: .9 });
  for (let i = 0; i < 70; i++) { const c = new THREE.Group(); const a = cr() * TAU, d = 6 + cr() * 140; c.position.set(Math.cos(a) * d, 80 + cr() * 50, Math.sin(a) * d); for (let k = 0; k < 5; k++) { const p = mesh(new THREE.IcosahedronGeometry(4 + cr() * 6, 1), cm, (cr() - .5) * 18, (cr() - .5) * 4, (cr() - .5) * 12); p.scale.y = .6; c.add(p); } clouds.add(c); }
  // rachaduras (fitas no chão, reveladas por raio)
  const cracks = ribbonMesh(900, 0xffc840); S.add(cracks.o); const crackSegs = []; const kr = rng(31);
  function grow(x, z, a, len, depth) { let px = x, pz = z; for (let s = 0; s < len; s++) { a += (kr() - .5) * .7; const nx = px + Math.cos(a) * .45, nz = pz + Math.sin(a) * .45; crackSegs.push([px, pz, nx, nz, Math.hypot(nx, nz), .09 * (1 - s / len * .7) * (depth ? .6 : 1)]); px = nx; pz = nz; if (depth < 2 && kr() < .12) grow(px, pz, a + (kr() - .5) * 1.8, len - s, depth + 1); } }
  for (let i = 0; i < 14; i++) grow(Math.cos(i / 14 * TAU) * .5, Math.sin(i / 14 * TAU) * .5, i / 14 * TAU, 26, 0);
  const aura = particles(700), dust = particles(260), bolts = ribbonMesh(500, 0xc8ffb0);
  S.add(aura.pts, dust.pts, bolts.o);
  const auraGlow = [sprite(0xffcc33, 5, .0), sprite(0x44ff88, 7, 0), sprite(0xffffff, 2.6, 0)]; auraGlow.forEach(s => { s.position.set(0, 1.1, 0); S.add(s); });
  const debris = new THREE.Group(); S.add(debris); const dr = rng(41); for (let i = 0; i < 26; i++) { const m = mesh(new THREE.IcosahedronGeometry(.04 + dr() * .07, 0), mat(0x5a4a3a)); m.userData = { a: dr() * TAU, d: 1 + dr() * 1.8, sp: .3 + dr() * .9, ph: dr() }; debris.add(m); }
  const beamG = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true); beamG.translate(0, .5, 0);
  const beam = new THREE.Group(); const b1 = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0xffd040, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })); const b2 = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); b2.scale.set(.45, 1, .45); const b3 = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0x40ff80, transparent: true, opacity: .25, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })); b3.scale.set(1.8, 1, 1.8); b1.scale.set(.8, 1, .8); beam.add(b3, b1, b2); S.add(beam);
  const sunDisc = new THREE.Group(); sunDisc.add(mesh(new THREE.CircleGeometry(55, 24), basic(0xfff2c0, { fog: false })), sprite(0xffc060, 520, .45), sprite(0xffffff, 170, .6)); S.add(sunDisc);
  const shock = mesh(new THREE.RingGeometry(.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); S.add(shock);
  WORLD.ground = { S, sky, stars, hemi, sun, fireL, auraL, clouds, cracks, crackSegs, aura, dust, bolts, auraGlow, debris, beam, sunDisc, shock };
}

// mundo 4: espaço
const SUN_R = 150;
function meteorZ(t) { return 210 - 165 * (t - 28); }
function buildSpace() {
  const S = new THREE.Scene(); S.background = new THREE.Color(0x000004);
  const stars = makeStars(3000, 6000, 77, 2.4); S.add(stars);
  const amb = new THREE.AmbientLight(0x8090b0, .25); S.add(amb);
  const sunPos = V3(0, 0, meteorZ(40) - SUN_R);
  const sunL = new THREE.PointLight(0xfff0d0, 3.2, 0, 0); sunL.position.copy(sunPos); S.add(sunL);
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 24, 16), new THREE.MeshBasicMaterial({ map: planetTex('sun'), transparent: true })); sunMesh.position.copy(sunPos); S.add(sunMesh);
  const sunGlow = [sprite(0xffb030, SUN_R * 3.4, .9), sprite(0xff6010, SUN_R * 6, .6), sprite(0xfff4c0, SUN_R * 2.4, .7)]; sunGlow.forEach(s => { s.position.copy(sunPos); S.add(s); });
  const P = {
    moon: planet('moon', 13), mars: planet('mars', 17), jupiter: planet('jupiter', 62, 26), saturn: planet('saturn', 55, 24), earth: planet('earth', 40, 26),
  };
  P.moon.position.set(-30, -34, meteorZ(29.9)); P.mars.position.set(32, -38, meteorZ(32.1)); P.jupiter.position.set(-75, -115, meteorZ(34.4)); P.saturn.position.set(80, -95, meteorZ(36.6)); P.saturn.scale.setScalar(.75); P.earth.position.set(0, -30, 270);
  const ring = new THREE.Group(); [[75, 92, 0xd8c08a, .9], [95, 118, 0xbfa070, .8], [121, 132, 0xe0d0a8, .6]].forEach(([a, b, c, o]) => ring.add(new THREE.Mesh(new THREE.RingGeometry(a, b, 48, 1), new THREE.MeshPhongMaterial({ color: c, side: THREE.DoubleSide, transparent: true, opacity: o, flatShading: true }))));
  ring.rotation.x = -PI / 2 + .45; ring.rotation.y = .25; P.saturn.add(ring);
  const atm = sprite(0x4aa8ff, 110, .45); P.earth.add(atm);
  for (const k in P) S.add(P[k]);
  const burst = particles(2600); S.add(burst.pts);
  const beamG = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true); beamG.translate(0, .5, 0); beamG.rotateX(-PI / 2); // aponta para -z
  const beam = new THREE.Group(); const bb1 = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0xffd040, transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); bb1.scale.set(5, 5, 1); const bb2 = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false })); bb2.scale.set(2, 2, 1); const bb3 = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0x40ff80, transparent: true, opacity: .25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); bb3.scale.set(12, 12, 1); beam.add(bb3, bb1, bb2); S.add(beam);
  const tip = [sprite(0xffe070, 40, 1), sprite(0x60ff90, 80, .45)]; tip.forEach(s => S.add(s));
  const shock = mesh(new THREE.RingGeometry(.85, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffd090, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); S.add(shock);
  WORLD.space = { S, stars, amb, sunPos, sunL, sunMesh, sunGlow, P, burst, beam, tip, shock };
}

// ---------------------------------------------------------------- herói e câmera
let HERO, MET, CAM, FX;
function camLook(cam, p, target, fov = 50, roll = 0) { cam.fov = fov; cam.aspect = W / H; cam.updateProjectionMatrix(); cam.position.copy(p); cam.up.set(0, 1, 0); cam.lookAt(target); if (roll) cam.rotateZ(roll); }
function shake(cam, amt, t, freq = 18) { if (amt <= 0) return; cam.position.x += vn(t * freq, 1) * amt; cam.position.y += vn(t * freq, 2) * amt; cam.rotateZ(vn(t * freq * .8, 3) * amt * .08); cam.rotateX(vn(t * freq * .9, 4) * amt * .05); }
function place(world, obj) { if (obj.parent !== world) world.add(obj); }

// ---------------------------------------------------------------- CENAS
// cena 1 — parede de TVs (0–12)
const TV_SHOTS = [[0, 1.6, -1], [1.6, 3.6, 0], [3.6, 5.6, 1], [5.6, 7.6, 2], [7.6, 9.6, 3], [9.6, 11.2, 4], [11.2, 12, -2]];
function cena1(t) {
  const { S, tvs, slots } = WORLD.tv; drawRadar(t);
  const shot = TV_SHOTS.find(s => t >= s[0] && t < s[1]) || TV_SHOTS[6]; const lt = t - shot[0], dur = shot[1] - shot[0];
  const need = shot[2] >= 0 ? [shot[2]] : [0, 1, 2, 3, 4];
  for (let i = 0; i < 5; i++) { if (need.includes(i)) tvs[i].scr.material.map = renderStudio(i, t); tvs[i].scr.material.needsUpdate = true; }
  for (let i = 0; i < 6; i++) { const fl = .85 + .15 * vn(t * 20, i); tvs[i].scr.material.color.setScalar(fl); }
  if (shot[2] === -1) { camLook(CAM, V3(lerp(.6, .2, eIO(lt / dur)), 1.4, lerp(9.5, 7.6, eOut(lt / dur))), V3(0, 1.4, 0), 50, .03); }
  else if (shot[2] === -2) { const k = eOut(lt / dur); camLook(CAM, V3(0, 1.4, lerp(4.5, 9, k)), V3(0, 1.4, 0), 50, lerp(-.06, 0, k)); }
  else { const [x, y] = slots[shot[2]]; const drift = lt / dur; const side = shot[2] % 2 ? -1 : 1; camLook(CAM, V3(x + side * lerp(.35, .1, drift), y + lerp(-.12, .08, drift), lerp(3.9, 3.35, eOut(drift))), V3(x, y, 0), 50, side * .05); }
  shake(CAM, .02 + (t > 11.2 ? .05 : 0), t, 9);
  FX.noise = Math.max(...TV_SHOTS.map(s => t >= s[0] ? clamp(1 - (t - s[0]) / .18) : 0)) * .7 + .05;
  FX.vignette = 1; FX.fade = clamp(1 - t / .6);
  FX.urgent = t > 11.2 ? 1 : 0;
  return S;
}
// cena 2 — Evangelista na sala (12–20)
function cena2(t) {
  const R = WORLD.room; place(R.S, HERO.root);
  R.scr.material.map = renderStudio(0, t); R.scr.material.needsUpdate = true; R.tvLight.intensity = 9 + 3 * vn(t * 12, 7);
  const up = ss(15.2, 16.3, t); HERO.root.position.set(0, lerp(.12, 0, up), lerp(.5, -.25, up)); HERO.root.rotation.y = PI; // de frente para a TV (-z)
  let pose;
  if (t < 15.2) pose = mix(POSE.sit, POSE.lean, ss(13.4, 14.6, t));
  else if (t < 16.3) pose = mix(POSE.lean, POSE.stand, eIO((t - 15.2) / 1.1));
  else pose = mix(POSE.stand, POSE.fist, ss(16.8, 17.6, t));
  const f6 = FALAS.find(f => f.arquivo === 'fala_evangelista.mp3'); const ls = f6 ? f6.inicio : 16.8;
  const talking = t > ls && t < ls + 1.6;
  pose = { ...pose, mouth: talking ? 1 + 2.6 * Math.abs(vn(t * 10, 9)) : 1 };
  if (t >= 16.3) pose.hy = (pose.hy || 0) + vn(t * .5, 5) * .04;
  if (t > 19.2) { const k = ss(19.2, 19.7, t); HERO.root.rotation.y = lerp(PI, PI / 2, k); pose = mix(pose, { aLx: .5, aRx: -.5, lLx: -.5, lRx: .3, sRx: .6 }, k); HERO.root.position.x = lerp(0, 1.2, ss(19.4, 20, t)); }
  setPose(HERO, pose);
  if (t < 15.2) camLook(CAM, V3(lerp(.9, .5, (t - 12) / 3.2), 1.55, lerp(3.4, 2.6, eOut((t - 12) / 3.2))), V3(0, 1.1, -2), 52); // atrás do sofá
  else if (t < 16.6) camLook(CAM, V3(3.6, 1.3, -1.3), V3(0, 1.1 + (t - 15.2) * .3, 0), 50); // lateral levantando
  else if (t < 19.2) { const k = (t - 16.6) / 2.6; camLook(CAM, V3(.3, 1.25, lerp(-2.9, -2.5, k)), V3(0, 1.62, -.25), 44); } // frente (de baixo)
  else camLook(CAM, V3(-1.2, 1.6, -1.8), V3(1, 1.2, 1.5), 55);
  FX.vignette = 1; FX.noise = t < 12.15 ? .5 : 0;
  return R.S;
}
// cena 3 — meteoro, super pulo e bicicleta (20–28)
const YK = 190; // altura do chute
function story3(t) { if (t < 25.6) return t; if (t < 26.9) return 25.6 + (t - 25.6) * .25; return 25.925 + (t - 26.9); }
function cena3(t) {
  const G = WORLD.ground, S = G.S; place(S, HERO.root); place(S, MET.g); place(S, MET.trail.pts);
  G.sky.setColors('#1a0710', '#c2401a', '#3a1208'); S.fog.color.set('#5a1a0c'); S.fog.near = 80; S.fog.far = 1100;
  G.hemi.intensity = .8; G.hemi.color.set('#ff9a70'); G.hemi.groundColor.set('#301810'); G.sun.intensity = .6; G.sun.color.set('#ff8050');
  G.stars.visible = false; G.sunDisc.visible = false; G.beam.visible = false; G.aura.hide(); G.dust.hide(); G.bolts.o.visible = false; G.cracks.o.visible = false; G.auraGlow.forEach(s => s.material.opacity = 0); G.debris.visible = false; G.auraL.intensity = 0;
  const s = story3(t);
  // meteoro
  const C = V3(0, YK + 1.9 + MET.R * .92, -.6);
  const dirIn = V3(.12, .5, -1).normalize();
  let mp, back; const msc = lerp(3.2, 1, ss(22.6, 25.0, s));
  if (s < 25.8) { mp = C.clone().addScaledVector(dirIn, (25.8 - s) * 230); back = dirIn.clone(); }
  else { const u = s - 25.8; const outD = V3(-.15, 1, -.35).normalize(); mp = C.clone().addScaledVector(outD, u * 60 + u * u * 500); back = outD.clone().negate(); }
  const camRef = CAM;
  // herói
  HERO.root.rotation.y = PI; HERO.root.position.set(0, 0, 0);
  let hy = 0, pose = POSE.stand;
  if (s < 21.8) pose = mix(POSE.stand, POSE.lookUp, ss(20.2, 20.9, s));
  else if (s < 22.8) pose = mix(POSE.lookUp, POSE.crouch, ss(22.2, 22.8, s));
  else if (s < 25.2) { hy = YK * eOut((s - 22.8) / 3.0); pose = mix(POSE.crouch, POSE.fly, ss(22.8, 23.1, s)); }
  else if (s < 25.8) { hy = YK * eOut((s - 22.8) / 3.0); pose = mix(mix(POSE.fly, POSE.bike0, ss(25.2, 25.6, s)), POSE.bike1, ss(25.6, 25.8, s)); }
  else { const u = s - 25.8; hy = YK - u * u * 30; pose = mix(POSE.bike1, { rx: -3.4, lRx: -1.9, lLx: .7, aLz: 1.5, aRz: -1.5 }, ss(0, 1.2, u)); }
  HERO.root.position.y = hy; setPose(HERO, pose);
  const hp = V3(0, hy + 1, 0);
  // câmera
  const shots = [];
  if (t < 21.8) { const k = (t - 20) / 1.8; camLook(CAM, V3(1.2, .45, lerp(5.6, 4.6, k)), mp.clone().lerp(V3(0, 1.4, 0), .72), 62); }
  else if (t < 22.8) { const k = (t - 21.8); camLook(CAM, V3(.7, .9, -3.4 + k * .4), V3(0, 1.45 - k * .3, 0), 46); }
  else if (t < 25.2) { const k = (s - 22.8) / 2.4; const lag = Math.max(0, hy - 6 * (1 - k)); camLook(CAM, V3(4.5 - k * 1.5, lag - 1.5 + k * 1, 5 - k), V3(0, hy + 2.5, 0), lerp(55, 62, k)); }
  else if (t < 27.0) { const k = (t - 25.2) / 1.8; camLook(CAM, V3(lerp(3.5, 2.5, k), YK - 5, lerp(8, 7, k)), V3(0, YK + 6, -4), 62); }
  else { const k = t - 27; camLook(CAM, V3(3, YK - 2 - k * 4, 6), mp.clone().lerp(V3(0, YK, 0), .2 * (1 - k)), 58); }
  // céu / brilho
  const near = clamp(1 - mp.distanceTo(CAM.position) / 900);
  G.fireL.position.copy(mp); G.fireL.intensity = 2 + near * 40;
  MET.g.visible = true; MET.trail.pts.visible = true; G.clouds.visible = true;
  updateMeteor(MET, mp, back, t, CAM, 1, s > 25.8 ? 16 : 9, msc);
  // efeitos
  const tc = 26.4;
  FX.flash = (t >= tc ? clamp(1 - (t - tc) / .35) : clamp(1 - (tc - t) / .06)) * 1.0 + (t > 22.8 && t < 23.0 ? .25 : 0);
  let sh = .02 + near * .15; if (t > 22.75 && t < 23.4) sh += .35 * (1 - (t - 22.75) / .65); if (t > tc && t < tc + 1.4) sh += 1.2 * (1 - (t - tc) / 1.4);
  if (t >= 25.2 && t < 27) sh *= .5;
  shake(CAM, sh, t, 16);
  G.shock.visible = t > tc && t < tc + 1.2; if (G.shock.visible) { const u = (t - tc) / 1.2; G.shock.position.set(0, YK + 2.2, -.4); G.shock.lookAt(CAM.position); G.shock.scale.setScalar(2 + eOut(u) * 60); G.shock.material.opacity = 1 - u; }
  if (t > 22.8 && t < 24.5) { // poeira do pulo
    const u = t - 22.8; G.dust.pts.visible = true; for (let i = 0; i < G.dust.N; i++) { const r = G.dust.rnd[i]; const a = r[0] * TAU, d = .5 + eOut(u * 1.5) * (3 + r[1] * 8); G.dust.set(i, Math.cos(a) * d, .2 + r[2] * 1.5 * eOut(u), Math.sin(a) * d, 1.2 + r[3] * 1.5, (1 - u / 1.7) * .25, .8, .6, .45); } G.dust.commit(CAM);
  }
  FX.vignette = 1; FX.slowmo = t > 25.7 && t < 26.9 ? 1 : 0;
  FX.fade = ss(27.65, 28, t) * .0;
  return S;
}
// cena 4 — viagem pelo sistema solar (28–38)  + cena 5 (38–44)
function spaceCommon(t, sunAlive = 1) {
  const SP = WORLD.space; place(SP.S, MET.g); place(SP.S, MET.trail.pts);
  SP.P.moon.rotation.y = t * .1; SP.P.jupiter.rotation.y = t * .15; SP.P.saturn.rotation.y = t * .05; SP.P.earth.rotation.y = t * .08; SP.P.mars.rotation.y = t * .12;
  SP.stars.position.copy(CAM.position);
  SP.sunGlow.forEach((s, i) => s.material.opacity = [.7, .15, .5][i] * (.92 + .08 * Math.sin(t * 7 + i)) * sunAlive);
  SP.sunMesh.visible = sunAlive > 0.01; SP.sunMesh.material.opacity = clamp(sunAlive * 1.2); SP.sunL.intensity = 3.2 * sunAlive; SP.amb.intensity = .08 + .2 * sunAlive;
  SP.beam.visible = false; SP.tip.forEach(s => s.visible = false); SP.burst.pts.visible = false; SP.shock.visible = false;
  SP.sunMesh.rotation.y = t * .05; SP.sunMesh.scale.setScalar(1);
  return SP;
}
function cena4(t) {
  const SP = spaceCommon(t); MET.g.visible = true; MET.trail.pts.visible = true;
  const mp = V3(0, 0, meteorZ(t)); const back = V3(0, 0, 1);
  if (t < 29) { const k = t - 28; camLook(CAM, V3(34, 12, 30), mp, 50 - k * 6); }
  else if (t < 37.6) { // tomadas de passagem por cada planeta
    const SH = [[29, 31, 'moon'], [31, 33.2, 'mars'], [33.2, 35.5, 'jupiter'], [35.5, 37.6, 'saturn']].find(q => t >= q[0] && t < q[1]);
    const pl = SP.P[SH[2]]; const pp = pl.position; const pr = pl.geometry.parameters.radius * pl.scale.x; const k = (t - SH[0]) / (SH[1] - SH[0]);
    const cp = V3(pp.x * .55, pp.y * .3 + 4, pp.z - 95 - pr * 1.2 - k * 25);
    camLook(CAM, cp, pp.clone().lerp(mp, lerp(.35, .7, k)), 60);
  }
  else { const k = (t - 37.6) / .4; camLook(CAM, mp.clone().add(V3(-28, 10, lerp(-4, 6, k))), mp.clone().add(V3(10, -10, -120)), 58); }
  shake(CAM, .25, t, 12);
  updateMeteor(MET, mp, back, t, CAM, 1, 9, t < 29 ? 1 : .75);
  FX.vignette = 1; FX.flash = clamp(1 - Math.abs(t - 28.0) / .2) * .6;
  return SP.S;
}
function cena5(t) {
  if (t >= 42.3) { FX.black = 1; return null; }
  const SP = spaceCommon(t, t < 40 ? 1 : 1 - ss(40, 41.6, t));
  const mp = V3(0, 0, meteorZ(Math.min(t, 40))); const sp = SP.sunPos;
  MET.g.visible = t < 40; MET.trail.pts.visible = t < 40.1;
  if (t < 39.6) { const k = (t - 38) / 1.6; camLook(CAM, mp.clone().add(V3(lerp(-28, -40, k), lerp(10, 18, k), lerp(6, 30, k))), mp.clone().add(V3(10, -10, -120)), 58); }
  else if (t < 40) camLook(CAM, sp.clone().add(V3(520, 90, 620)), sp.clone().add(V3(0, 0, 120)), 55);
  else { const k = (t - 40) / 2.3; camLook(CAM, sp.clone().add(V3(lerp(520, 640, k), lerp(90, 120, k), lerp(620, 900, k))), sp, 55); }
  if (t < 40) updateMeteor(MET, mp, V3(0, 0, 1), t, CAM, 1, 9); else MET.trail.hide();
  if (t >= 40) { // explosão
    const u = t - 40; SP.sunMesh.scale.setScalar(Math.max(.01, 1 - eOut(u / .35) * .4 + (u > .35 ? -1 : 0))); if (u > .35) SP.sunMesh.visible = false;
    const B = SP.burst; B.pts.visible = true;
    for (let i = 0; i < B.N; i++) { const r = B.rnd[i]; const [x, y, z] = unitRand(r); const d = SUN_R * (.9 + eOut(u / 1.8) * (2 + r[2] * 6)); const age = clamp(u / (1.6 + r[3] * 1.2)); const c = age < .2 ? [1, .95, .7] : age < .55 ? [1, .55, .12] : [.7, .15, .05]; B.set(i, sp.x + x * d, sp.y + y * d, sp.z + z * d, (10 + r[4] * 26) * (1 + u), (1 - age) * .3, ...c); }
    B.commit(CAM);
    SP.shock.visible = true; SP.shock.position.copy(sp); SP.shock.lookAt(CAM.position); SP.shock.scale.setScalar(SUN_R * (1 + eOut(u / 1.5) * 8)); SP.shock.material.opacity = clamp(1 - u / 1.5);
  }
  FX.flash = t >= 40 ? clamp(1 - (t - 40) / .45) : 0; shake(CAM, t > 40 ? 6 * (1 - ss(40, 42, t)) : .4, t, 14);
  FX.fade = ss(41.6, 42.3, t); FX.vignette = 1;
  return SP.S;
}
// cena 6 — o PRIME (44–55)
function auraFX(t, k, cam, big = 1, nb = 6) { // k: intensidade 0..1
  const G = WORLD.ground; const A = G.aura;
  A.pts.visible = k > 0; G.bolts.o.visible = k > 0.05;
  for (let i = 0; i < A.N; i++) {
    const r = A.rnd[i]; const age = fract(t * (.7 + r[0] * .8) + r[1]); const a = r[2] * TAU + t * (1 + r[3]); const rad = (.35 + r[3] * .55 + age * .4) * big;
    const gold = r[4] < .6; const c = gold ? [1, .78, .22] : r[4] < .9 ? [.35, 1, .5] : [1, 1, 1];
    A.set(i, Math.cos(a) * rad, age * 3.2 * big, Math.sin(a) * rad, (.1 + r[0] * .18) * big, k * Math.sin(age * PI) * .32, ...c);
  }
  A.commit(cam);
  G.auraGlow[0].material.opacity = .22 * k * (1 + .2 * Math.sin(t * 23)); G.auraGlow[0].scale.setScalar(5 * big * (1 + .08 * Math.sin(t * 17)));
  G.auraGlow[1].material.opacity = .14 * k; G.auraGlow[1].scale.setScalar(8 * big);
  G.auraGlow[2].material.opacity = .12 * k;
  G.auraL.intensity = 9 * k * (1 + .25 * vn(t * 20, 3)); G.auraL.color.setHSL(.13 + .1 * (.5 + .5 * Math.sin(t * 6)), 1, .6);
  // relâmpagos
  const B = G.bolts; B.begin(); const fr = Math.floor(t * 15); const view = V3().subVectors(cam.position, V3(0, 1, 0)).normalize();
  if (k > .05) for (let b = 0; b < nb; b++) { const r = rng(fr * 31 + b); if (r() > k) continue; let p = V3((r() - .5) * .8, r() * 2.2, (r() - .5) * .8); for (let s = 0; s < 7; s++) { const q = p.clone().add(V3((r() - .5) * .55, (r() - .3) * .5, (r() - .5) * .55).multiplyScalar(big)); B.seg(p, q, .022 * big, view); p = q; } }
  B.end(); B.o.material.color.setHSL(.25 + .1 * Math.sin(t * 9), 1, .75);
  // hero glow
  HERO.M.hair.emissive.setRGB(k * .9, k * .7, k * .1); HERO.M.eye.color.setRGB(lerp(.07, 1, k), lerp(.07, 1, k), lerp(.07, .6, k));
}
function groundNight(G, t) {
  G.sky.setColors('#000004', '#07090f', '#020203'); G.S.fog.color.set('#020306'); G.S.fog.near = 60; G.S.fog.far = 700;
  G.hemi.intensity = .25; G.hemi.color.set('#5060a0'); G.hemi.groundColor.set('#101010'); G.sun.intensity = 0; G.fireL.intensity = 0; G.stars.visible = true;
  G.sunDisc.visible = false; G.beam.visible = false; G.shock.visible = false; G.dust.hide(); G.debris.visible = false; G.cracks.o.visible = false; G.clouds.visible = false;
}
function drawCracks(G, R) {
  const C = G.cracks; C.o.visible = R > 0; C.begin(); const up = V3(0, 1, 0);
  for (const [x1, z1, x2, z2, d, w] of G.crackSegs) if (d < R) C.seg(V3(x1, .04, z1), V3(x2, .04, z2), w * (1.4 + .4 * Math.sin(d * 3)), up);
  C.end();
}
function cena6(t) {
  const G = WORLD.ground;
  if (t < 50.4) {
    place(G.S, HERO.root); MET.g.visible = false; MET.trail.pts.visible = false; groundNight(G, t);
    HERO.root.position.set(0, 0, 0); HERO.root.rotation.y = PI;
    let pose = mix(POSE.lookUp, POSE.stand, ss(45.6, 46.4, t)); let k = 0;
    if (t >= 46.2) { pose = mix(pose, POSE.power, ss(46.2, 46.8, t)); k = ss(46.6, 47.0, t); }
    if (t >= 48.6) pose = mix(pose, POSE.powerUp, ss(48.6, 49.6, t));
    // tecido balançando
    pose = { ...pose, tz: (pose.tz || 0) + k * vn(t * 14, 1) * .04, aLz: (pose.aLz ?? .12) + k * vn(t * 16, 2) * .06, aRz: (pose.aRz ?? -.12) + k * vn(t * 16, 3) * .06 };
    setPose(HERO, pose); HERO.chest.scale.x = 1 + k * .05 * vn(t * 22, 5); HERO.chest.scale.z = .56 * (1 + k * .07 * vn(t * 19, 6));
    auraFX(t, k, CAM, 1 + ss(48.6, 49.6, t) * .4);
    drawCracks(G, k > 0 ? eOut((t - 46.8) / 1.7) * 12 : 0);
    G.debris.visible = k > 0; G.debris.children.forEach((m, i) => { const u = m.userData; const y = ((t - 46.8) * u.sp * 1.4 + u.ph * 2) % 3.5; m.position.set(Math.cos(u.a + t * .3) * u.d, y, Math.sin(u.a + t * .3) * u.d); m.rotation.set(t * 2 + i, t * 3, 0); });
    G.hemi.intensity = .25 + k * .3; G.hemi.color.set('#ffe6a0');
    if (t < 46.2) camLook(CAM, V3(.6, .7, 3.6 - (t - 44) * .3), V3(-.7, 6, -12), 56);
    else if (t < 47.6) { const k2 = (t - 46.2) / 1.4; camLook(CAM, V3(.3 + k2 * .4, 1.5, lerp(-1.4, -2.2, eOut(k2 * 2))), V3(0, 1.55, 0), 46); }
    else if (t < 48.6) { const a = PI + (t - 47.6) * .6; camLook(CAM, V3(Math.sin(a) * -4.5, 1.2, Math.cos(a) * -4.5), V3(0, 1.3, 0), 52); }
    else if (t < 49.6) { const k2 = (t - 48.6); camLook(CAM, V3(7 - k2, .6, -7 + k2), V3(0, 2.2, 0), 55); }
    else { const k2 = (t - 49.6) / .8; camLook(CAM, V3(5, .8, 6), V3(0, lerp(4, 60, eIn(k2)), 0), 60); }
    G.beam.visible = t >= 49.6; if (G.beam.visible) { const L = 4000 * eIn((t - 49.6) / .5); G.beam.scale.set(1, Math.max(.01, L), 1); G.beam.position.set(0, 0, 0); }
    FX.flash = clamp(1 - Math.abs(t - 46.8) / .25) * .9 + clamp(1 - Math.abs(t - 49.7) / .2) * .6;
    shake(CAM, k * (.08 + (t > 46.8 && t < 47.5 ? .4 : 0)) + (t > 49.6 ? .3 : 0), t, 20);
    FX.vignette = 1; return G.S;
  }
  // espaço: feixe atravessa o sistema solar e reconstrói o Sol
  const SP = WORLD.space; MET.g.visible = false; MET.trail.pts.visible = false;
  const sp = SP.sunPos; const earthP = SP.P.earth.position; const startZ = earthP.z - 40;
  if (t < 53.6) {
    const rebuild = ss(52.6, 53.2, t);
    spaceCommon(t, rebuild);
    const tipZ = lerp(startZ, sp.z, eIn(clamp((t - 50.4) / 1.2)) * .3 + eIO(clamp((t - 50.4) / 1.2)) * .7);
    SP.beam.visible = true; const bk = 1 - ss(52.8, 53.5, t); SP.beam.position.set(0, 0, startZ); SP.beam.scale.set(1, 1, 1); SP.beam.children.forEach((m, i) => { m.scale.z = Math.max(.01, startZ - tipZ); m.material.opacity = [.25, .6, .9][i] * bk; });
    SP.tip.forEach(s => { s.visible = true; s.position.set(0, 0, tipZ); s.material.opacity = bk; });
    if (t < 51.6) camLook(CAM, V3(90, 30, tipZ + 140), V3(0, 0, tipZ - 60), 58);
    else { const k = (t - 51.6) / 2; camLook(CAM, sp.clone().add(V3(lerp(260, 120, k), lerp(70, 30, k), lerp(900, 720, eOut(k)))), sp, 55); }
    // partículas voltando
    if (t > 51.4) {
      const B = SP.burst; B.pts.visible = true; const u = clamp((t - 51.4) / 1.6);
      for (let i = 0; i < B.N; i++) { const r = B.rnd[i]; const [x, y, z] = unitRand(r); const uu = clamp(u * 1.15 - r[3] * .15); const d = SUN_R * (1 + (1 - eIO(uu)) * (2 + r[2] * 6)); const c = uu > .8 ? [1, .95, .6] : [1, .7 + r[4] * .3 * (1 - uu), .2]; B.set(i, sp.x + x * d, sp.y + y * d, sp.z + z * d, (16 + r[4] * 30), (.2 + uu * .5) * (1 - ss(53.1, 53.6, t)), ...c); }
      B.commit(CAM);
    }
    SP.sunMesh.scale.setScalar(.6 + .4 * eOut(rebuild));
    FX.flash = clamp(1 - Math.abs(t - 53.15) / .3) * .9 + clamp(1 - Math.abs(t - 50.4) / .15) * .5; shake(CAM, t < 51.6 ? .8 : .3, t, 12);
    FX.vignette = 1; return SP.S;
  }
  // Terra sendo iluminada
  spaceCommon(t, 1); const k = ss(53.7, 54.6, t);
  SP.sunL.intensity = 3.2 * k; SP.amb.intensity = .02 + .06 * k;
  const ep = earthP; const kk = (t - 53.6) / 1.4; camLook(CAM, ep.clone().add(V3(lerp(-125, -110, kk), 22, lerp(30, 20, kk))), ep.clone().add(V3(0, 0, -25)), 50);
  SP.sunGlow.forEach((s, i) => s.material.opacity = [.7, .15, .5][i] * (.3 + .7 * k));
  FX.vignette = 1; return SP.S;
}
// cena 7 — final (55–60)
function cena7(t) {
  const G = WORLD.ground; place(G.S, HERO.root); MET.g.visible = false; MET.trail.pts.visible = false;
  const day = ss(55, 57, t);
  const lerpC = (a, b) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), day).getHexString();
  G.sky.setColors(lerpC('#0a1a3a', '#2a64b8'), lerpC('#ff8a3a', '#ffc070'), '#2a1a10'); G.S.fog.color.set(lerpC('#a05a30', '#e0a070')); G.S.fog.near = 80; G.S.fog.far = 1000;
  G.hemi.intensity = .9 + .4 * day; G.hemi.color.set('#ffe0b0'); G.hemi.groundColor.set('#304020'); G.sun.intensity = 1.6; G.sun.color.set('#ffd090'); G.sun.position.set(0, 60, -200); G.fireL.intensity = 0; G.stars.visible = false;
  G.beam.visible = false; G.shock.visible = false; G.dust.hide(); G.debris.visible = false; G.clouds.visible = false;
  G.sunDisc.visible = true; G.sunDisc.position.set(150, 700 + day * 150, -2200); G.sunDisc.lookAt(0, 0, 0);
  drawCracks(G, 12);
  HERO.root.position.set(0, 0, 0); HERO.root.rotation.y = PI;
  setPose(HERO, { ...mix(POSE.powerUp, POSE.lookUp, .5), aLz: .45 + vn(t * 10, 2) * .04, aRz: -.45 + vn(t * 10, 3) * .04, hx: -.25, mouth: 1 });
  auraFX(t, .6, CAM, 1.0, 3);
  if (t < 57.5) { const k = (t - 55) / 2.5; camLook(CAM, V3(lerp(1.0, .8, k), .6, lerp(3.6, 3.0, k)), V3(-1.2, lerp(3, 4.5, k), -12), 55); }
  else { const k = (t - 57.5) / 2.5; camLook(CAM, V3(lerp(-1.9, -1.6, k), .9, lerp(-2.8, -2.4, k)), V3(0, 1.6, 0), 42); }
  shake(CAM, .03, t, 8); FX.vignette = 1;
  return G.S;
}

// ---------------------------------------------------------------- overlay 2D (título, legendas, efeitos)
let NOISE = [], VIG;
function overlay(t) {
  const w = W, h = H; ctx.save();
  if (FX.noise > 0) { ctx.globalAlpha = clamp(FX.noise); ctx.globalCompositeOperation = 'screen'; ctx.drawImage(NOISE[Math.floor(t * 30) % NOISE.length], 0, 0, w, h); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  if (FX.vignette) ctx.drawImage(VIG, 0, 0, w, h);
  if (FX.slowmo) { ctx.fillStyle = 'rgba(255,240,200,.06)'; ctx.fillRect(0, 0, w, h); }
  if (FX.urgent) { const on = Math.floor(t * 6) % 2; ctx.fillStyle = on ? 'rgba(200,0,20,.85)' : 'rgba(120,0,10,.85)'; const y = h * .44; ctx.fillRect(0, y, w, h * .09); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `900 ${Math.round(w * .085)}px ${FONT}`; ctx.fillText('⚠ ALERTA MUNDIAL ⚠', w / 2, y + h * .047); }
  if (FX.flash > 0) { ctx.fillStyle = `rgba(255,250,235,${clamp(FX.flash)})`; ctx.fillRect(0, 0, w, h); }
  if (FX.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${clamp(FX.fade)})`; ctx.fillRect(0, 0, w, h); }
  // legendas
  const sub = FALAS.filter(f => t >= f.inicio && t < f.fim).pop();
  if (sub) {
    const a = clamp((t - sub.inicio) / .12) * clamp((sub.fim - t) / .12); ctx.globalAlpha = a;
    let txt = sub.legenda, tag = null; const m = txt.match(/^([A-ZÃÇÉÍ]+):\s*(.*)$/); if (m) { tag = m[1]; txt = m[2]; }
    const fs = Math.round(w * .056); ctx.font = `900 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const lines = wrap(txt, w * .86); let y = h * .79 - (lines.length - 1) * fs * 1.15;
    if (tag) { const tf = Math.round(w * .036); ctx.font = `900 ${tf}px ${FONT}`; const tw = ctx.measureText(tag).width + tf; ctx.fillStyle = '#d0021b'; ctx.fillRect(w / 2 - tw / 2, y - fs * 1.05 - tf * 1.05, tw, tf * 1.4); ctx.fillStyle = '#fff'; ctx.fillText(tag, w / 2, y - fs * 1.05 - tf * .05); ctx.font = `900 ${fs}px ${FONT}`; }
    const yellow = /Evangelista/i.test(sub.quem);
    for (const L of lines) { strokeText(L, w / 2, y, fs, yellow ? '#ffe14a' : '#ffffff'); y += fs * 1.15; }
    ctx.globalAlpha = 1;
  }
  // título fixo
  const tfs = Math.round(w * .074); ctx.font = `900 ${tfs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const tl = ['E SE UM METEORO CAÍSSE', 'NA TERRA DO', 'EVANGELISTA']; let ty = h * .085;
  for (const L of tl) { let s = tfs; ctx.font = `900 ${s}px ${FONT}`; while (ctx.measureText(L).width > w * .92) { s--; ctx.font = `900 ${s}px ${FONT}`; } strokeText(L, w / 2, ty, s, '#ffffff'); ty += tfs * 1.1; }
  ctx.restore();
}
function wrap(text, maxW) { const words = text.split(' '); const lines = []; let cur = ''; for (const wd of words) { const tst = cur ? cur + ' ' + wd : wd; if (ctx.measureText(tst).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = tst; } if (cur) lines.push(cur); return lines; }
function strokeText(s, x, y, fs, fill) { ctx.lineJoin = 'round'; ctx.miterLimit = 2; ctx.strokeStyle = '#000'; ctx.lineWidth = fs * .2; ctx.strokeText(s, x, y); ctx.fillStyle = fill; ctx.fillText(s, x, y); }

// ---------------------------------------------------------------- API
window.init = async (w, h, falas) => {
  W = w; H = h; FALAS = falas || [];
  const ff = new FontFace('TitleFont', 'url(fonts/Inter-Black.otf)', { weight: '900' }); await ff.load(); document.fonts.add(ff);
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  out = document.createElement('canvas'); out.width = W; out.height = H; ctx = out.getContext('2d');
  baseTextures(); buildStudio(); buildTVWall(); buildRoom(); buildGround(); buildSpace();
  HERO = makePerson({ shirt: 0x006b3a, detail: 0xffffff, skin: 0xa86b45, hair: 0x1a120c, shorts: 0xffffff, socks: 0x006b3a, boots: 0x111111, name: 'EVANGELISTA', beard: true });
  MET = makeMeteor(12);
  CAM = new THREE.PerspectiveCamera(50, W / H, .05, 14000);
  const r = rng(99); for (let i = 0; i < 6; i++) NOISE.push(canvas(Math.round(W / 4), Math.round(H / 4), (g, w, h) => { const d = g.createImageData(w, h); for (let k = 0; k < d.data.length; k += 4) { const v = r() * 255; d.data[k] = d.data[k + 1] = d.data[k + 2] = v; d.data[k + 3] = 255; } g.putImageData(d, 0, 0); for (let y = 0; y < h; y += 3) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y, w, 1); } }));
  VIG = canvas(W, H, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, h * .25, w / 2, h / 2, h * .62); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  return true;
};
export const CENAS = [[0, 12, cena1], [12, 20, cena2], [20, 28, cena3], [28, 38, cena4], [38, 44, cena5], [44, 55, cena6], [55, 60.001, cena7]];
window.renderFrame = (t, quality = .9) => {
  FX = { flash: 0, fade: 0, noise: 0, vignette: 0, black: 0, urgent: 0, slowmo: 0 };
  HERO.M.hair.emissive.setRGB(0, 0, 0); HERO.M.eye.color.setRGB(.07, .07, .07); HERO.chest.scale.set(1, 1, .56);
  const c = CENAS.find(c => t >= c[0] && t < c[1]) || CENAS[6];
  const scene = c[2](t);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (scene && !FX.black) { renderer.setRenderTarget(null); renderer.render(scene, CAM); ctx.drawImage(renderer.domElement, 0, 0); }
  overlay(t);
  return out.toDataURL('image/jpeg', quality);
};
window.READY = true;
