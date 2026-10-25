// 主角模型：朱迪·霍普斯（Judy Hopps）与尼克·王尔德（Nick Wilde），程序化高细节版本。
//
// 用法：
//   import { createJudy, createNick } from './chars/heroes.js';
//   const judy = createJudy(); scene.add(judy);
//   judy.rotation.y = Math.atan2(dirX, dirZ);   // 模型正面朝本地 +Z
//   judy.userData.update(dt, horizontalSpeed);  // 每帧；0 待机，~3 走，~7 跑，10 冲刺
//   judy.userData.setPose('idle'|'walk'|'run'|'jump'|'talk'|'sit');
//   nick.userData.setSunglasses(true);          // 尼克墨镜（默认隐藏）
//
// 约定：原点在脚底，前方 = 本地 +Z，上 = +Y，角色左侧 = +X。
// 'walk'/'run' 的步频完全由 update 的 speed 决定（pose 只区分 idle/talk/jump/sit 等特殊动作）。
// userData.height = 身体高度（头顶，不含耳朵）；userData.totalHeight = 含耳朵。
// 骨骼：userData.bones = { hips, torso, neck, head, arms:[{upper,lower,hand,side}], legs:[{thigh,shin,foot,side}], ears:[{base,tip,side}], tail:[...] }
import * as THREE from 'three';
import { makeRigAnimator } from './animals.js';

// ---------------------------------------------------------------------------
// 共享几何体 / 材质
// ---------------------------------------------------------------------------
const GEO = {
  sph: new THREE.SphereGeometry(1, 20, 14),
  sphMid: new THREE.SphereGeometry(1, 14, 10),
  sphLo: new THREE.SphereGeometry(1, 10, 8),
  hemi: new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  cylThin: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 14),
  box: new THREE.BoxGeometry(1, 1, 1),
  torus: new THREE.TorusGeometry(1, 0.22, 8, 20),
};
const _caps = new Map();
function capsule(r, len) {
  const k = `${r}|${len}`;
  let g = _caps.get(k);
  if (!g) { g = new THREE.CapsuleGeometry(r, len, 6, 14); _caps.set(k, g); }
  return g;
}
// 圆角盒（护甲板等），用 ExtrudeGeometry
const _rb = new Map();
function roundedPanel(w, h, d, r) {
  const k = `${w}|${h}|${d}|${r}`;
  let g = _rb.get(k);
  if (g) return g;
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: d * 0.4, bevelSize: Math.min(r, d) * 0.6, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -d / 2);
  _rb.set(k, g);
  return g;
}

const _mats = new Map();
function mat(color, rough = 0.85, metal = 0, extra = {}) {
  const k = `${new THREE.Color(color).getHexString()}|${rough}|${metal}|${JSON.stringify(extra)}`;
  let m = _mats.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }); _mats.set(k, m); }
  return m;
}
const _basic = new Map();
function basic(color) {
  let m = _basic.get(color);
  if (!m) { m = new THREE.MeshBasicMaterial({ color }); _basic.set(color, m); }
  return m;
}

function M(parent, geo, material, p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0], shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(p[0], p[1], p[2]);
  if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(s[0], s[1], s[2]);
  m.rotation.set(r[0], r[1], r[2]);
  m.castShadow = shadow; m.receiveShadow = shadow;
  parent.add(m);
  return m;
}
function Grp(parent, p = [0, 0, 0], r = [0, 0, 0], name = '') {
  const g = new THREE.Group();
  g.position.set(p[0], p[1], p[2]); g.rotation.set(r[0], r[1], r[2]);
  g.name = name;
  parent.add(g);
  return g;
}
// 两点之间放一根圆柱/胶囊（局部坐标）
const _up = new THREE.Vector3(0, 1, 0);
function between(parent, geo, material, a, b, rad) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const d = B.clone().sub(A); const len = d.length();
  const m = new THREE.Mesh(geo, material);
  m.position.copy(A.add(B).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(_up, d.normalize());
  m.scale.set(rad, len, rad);
  m.castShadow = true;
  parent.add(m);
  return m;
}
// 躯干用车削体：profile = [[r, y], ...]
function lathe(profile, seg = 20) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

const hasDOM = typeof document !== 'undefined' && typeof document.createElement === 'function';

// ---------------------------------------------------------------------------
// 共同的眼睛构造（返回可眨眼的 group）
// ---------------------------------------------------------------------------
function makeEye(head, { p, r, iris, irisDark, yaw, lidColor, lidDrop = 0 }) {
  const eg = Grp(head, p, [0, yaw, 0], 'eye');
  M(eg, GEO.sphMid, mat('#fbfbf8', 0.3), [0, 0, 0], [r, r * 1.08, r * 0.55], [0, 0, 0], false);
  M(eg, GEO.sphMid, mat(irisDark, 0.25), [0, -r * 0.05, r * 0.36], [r * 0.74, r * 0.8, r * 0.3], [0, 0, 0], false);
  M(eg, GEO.sphMid, mat(iris, 0.25), [0, -r * 0.02, r * 0.4], [r * 0.6, r * 0.66, r * 0.28], [0, 0, 0], false);
  M(eg, GEO.sphLo, mat('#0b0710', 0.2), [0, -r * 0.04, r * 0.5], [r * 0.32, r * 0.36, r * 0.12], [0, 0, 0], false);
  M(eg, GEO.sphLo, basic('#ffffff'), [r * 0.22, r * 0.26, r * 0.58], [r * 0.14, r * 0.14, r * 0.06], [0, 0, 0], false);
  M(eg, GEO.sphLo, basic('#ffffff'), [-r * 0.18, -r * 0.24, r * 0.58], [r * 0.07, r * 0.07, r * 0.04], [0, 0, 0], false);
  if (lidDrop > 0) {
    // 半闭眼皮（尼克的狡黠眼神）：一块毛色半球压在眼睛上部
    M(eg, GEO.hemi, mat(lidColor, 0.8), [0, r * (0.25 - lidDrop), r * 0.05], [r * 1.08, r * 0.9, r * 0.66], [0.35, 0, 0], false);
  }
  eg.userData.baseSY = 1;
  return eg;
}

// ---------------------------------------------------------------------------
// 朱迪
// ---------------------------------------------------------------------------
export function createJudy() {
  const C = {
    fur: mat('#8f8a99', 0.95), furLight: mat('#d9d3de', 0.95), furDark: mat('#5d5866', 0.95),
    innerEar: mat('#e9a3b5', 0.8), earTip: mat('#1c1a20', 0.9), nose: mat('#e47f97', 0.45),
    shirt: mat('#1f2a44', 0.75), shirtLight: mat('#2c3a5c', 0.75), armor: mat('#121318', 0.45, 0.1),
    pants: mat('#191c26', 0.8), belt: mat('#0c0c0e', 0.5, 0.1), gold: mat('#d9b13b', 0.3, 0.85),
    pouch: mat('#1a1b20', 0.6), carrot: mat('#f07f1e', 0.5), carrotTop: mat('#3fa34d', 0.6),
    tail: mat('#f4f2f5', 1.0), teeth: mat('#fffdf5', 0.3), mouth: mat('#3a1f26', 0.6),
    whisker: mat('#3a3640', 0.6), padGrey: mat('#2a2c33', 0.5, 0.1), metal: mat('#a5a9b2', 0.35, 0.8),
  };
  const root = new THREE.Group(); root.name = 'Judy';
  const hipY = 0.38;
  const hips = Grp(root, [0, hipY, 0], [0, 0, 0], 'hips');

  // 胯 / 裤子
  M(hips, GEO.sph, C.pants, [0, 0.0, -0.005], [0.105, 0.08, 0.09]);
  // 尾巴：毛球团
  const tail = Grp(hips, [0, 0.02, -0.085], [-1.57, 0, 0], 'tail'); tail.rotation.order = 'YXZ';
  M(tail, GEO.sphMid, C.tail, [0, 0.035, 0], 0.048);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; M(tail, GEO.sphLo, C.tail, [Math.cos(a) * 0.03, 0.04 + Math.sin(a * 2) * 0.01, Math.sin(a) * 0.03], 0.03); }

  // 躯干
  const torso = Grp(hips, [0, 0.02, 0], [0, 0, 0], 'torso');
  const shirtG = lathe([[0.0, -0.02], [0.098, -0.015], [0.106, 0.04], [0.098, 0.12], [0.104, 0.2], [0.11, 0.25], [0.09, 0.29], [0.05, 0.31], [0.0, 0.315]]);
  M(torso, shirtG, C.shirt, [0, 0, 0], [1, 1, 0.82]);
  // 护甲：胸前、背后、肩
  M(torso, roundedPanel(0.15, 0.13, 0.02, 0.03), C.armor, [0, 0.2, 0.078], [1, 1, 1], [-0.12, 0, 0]);
  M(torso, roundedPanel(0.13, 0.08, 0.02, 0.025), C.armor, [0, 0.1, 0.082], [1, 1, 1], [0.08, 0, 0]);
  M(torso, roundedPanel(0.16, 0.18, 0.02, 0.03), C.armor, [0, 0.17, -0.078], [1, 1, 1], [0.1, 0, 0]);
  for (const sd of [1, -1]) {
    M(torso, GEO.sphMid, C.armor, [sd * 0.088, 0.262, 0], [0.042, 0.03, 0.05], [0, 0, sd * 0.4]); // 护肩
    M(torso, GEO.box, C.armor, [sd * 0.095, 0.13, 0.0], [0.012, 0.1, 0.07]); // 侧扣带
  }
  // 衣领
  for (const sd of [1, -1]) M(torso, GEO.box, C.shirtLight, [sd * 0.025, 0.298, 0.046], [0.04, 0.018, 0.03], [-0.5, sd * 0.4, sd * 0.3]);
  // 警徽（左胸 = +X）
  const badge = Grp(torso, [0.04, 0.225, 0.103], [-0.12, 0, 0], 'badge');
  M(badge, GEO.cyl, C.gold, [0, 0, 0], [0.019, 0.006, 0.019], [Math.PI / 2, 0, 0]);
  M(badge, GEO.cone, C.gold, [0, 0.0, 0.002], [0.012, 0.006, 0.012], [Math.PI / 2, 0, 0]);
  M(badge, GEO.box, C.gold, [0, -0.026, 0.0], [0.03, 0.008, 0.004]);
  // 胡萝卜录音笔（右胸口袋 = -X）
  M(torso, GEO.box, C.armor, [-0.045, 0.2, 0.1], [0.035, 0.035, 0.008], [-0.12, 0, 0]);
  const pen = Grp(torso, [-0.045, 0.235, 0.102], [-0.12, 0, 0.12], 'carrotPen');
  M(pen, GEO.cone, C.carrot, [0, -0.02, 0], [0.007, 0.05, 0.007], [Math.PI, 0, 0]);
  M(pen, GEO.cone, C.carrotTop, [0, 0.011, 0], [0.006, 0.014, 0.006]);
  M(pen, GEO.cone, C.carrotTop, [0.003, 0.012, 0], [0.004, 0.012, 0.004], [0, 0, -0.5]);
  // 腰带 + 工具
  M(torso, GEO.cyl, C.belt, [0, 0.02, 0], [0.108, 0.026, 0.09]);
  M(torso, roundedPanel(0.03, 0.024, 0.006, 0.005), C.gold, [0, 0.02, 0.092]);
  for (const [x, z, ry] of [[0.07, 0.062, 0.7], [-0.07, 0.062, -0.7], [0.1, 0, 1.57], [-0.1, -0.01, -1.57]]) {
    M(torso, roundedPanel(0.032, 0.036, 0.02, 0.006), C.pouch, [x, 0.015, z], [1, 1, 1], [0, ry, 0]);
  }
  // 腰侧：麻醉枪套 + 手铐
  M(torso, GEO.box, C.pouch, [-0.06, -0.005, -0.075], [0.03, 0.05, 0.02], [0, -0.5, 0]);
  M(torso, GEO.torus, C.metal, [0.065, -0.005, -0.07], [0.012, 0.012, 0.012], [0, 0.5, 0]);
  M(torso, GEO.torus, C.metal, [0.075, -0.012, -0.06], [0.012, 0.012, 0.012], [0, 0.5, 0.5]);
  // 对讲机（左肩）
  M(torso, GEO.box, C.armor, [0.07, 0.25, 0.06], [0.02, 0.035, 0.012], [-0.2, 0, -0.2]);

  // 脖子 + 头
  const neck = Grp(torso, [0, 0.3, 0], [0, 0, 0], 'neck');
  M(neck, GEO.cyl, C.fur, [0, 0.015, -0.005], [0.045, 0.05, 0.04]);
  M(neck, GEO.sphLo, C.furLight, [0, 0.01, 0.025], [0.04, 0.03, 0.025]);
  const head = Grp(neck, [0, 0.03, 0], [0, 0, 0], 'head');
  const hc = 0.12; // 头心高度
  M(head, GEO.sph, C.fur, [0, hc, 0], [0.122, 0.118, 0.115]);
  // 脸颊绒毛（浅色）
  for (const sd of [1, -1]) M(head, GEO.sphMid, C.furLight, [sd * 0.055, hc - 0.045, 0.06], [0.06, 0.05, 0.055], [0, 0, sd * 0.3]);
  for (const sd of [1, -1]) M(head, GEO.cone, C.fur, [sd * 0.11, hc - 0.04, 0.0], [0.02, 0.05, 0.015], [0, 0, sd * 2.2]); // 腮边毛尖
  M(head, GEO.sphMid, C.furLight, [0, hc - 0.05, 0.085], [0.045, 0.04, 0.04]);
  M(head, GEO.sphMid, C.furLight, [0, hc - 0.085, 0.06], [0.04, 0.03, 0.04]); // 下巴
  // 额头浅色斑
  M(head, GEO.sphLo, C.furDark, [0, hc + 0.085, 0.07], [0.03, 0.025, 0.02]);
  // 鼻子、嘴、门牙
  M(head, GEO.sphLo, C.nose, [0, hc - 0.025, 0.122], [0.014, 0.01, 0.009]);
  M(head, GEO.box, C.mouth, [0, hc - 0.058, 0.118], [0.003, 0.018, 0.003]);
  for (const sd of [1, -1]) M(head, GEO.box, C.mouth, [sd * 0.011, hc - 0.067, 0.114], [0.022, 0.003, 0.003], [0, 0, sd * 0.35]);
  M(head, GEO.box, C.teeth, [0, hc - 0.076, 0.114], [0.016, 0.012, 0.004]);
  // 胡须
  for (const sd of [1, -1]) for (let i = 0; i < 3; i++) {
    between(head, GEO.cylThin, C.whisker, [sd * 0.025, hc - 0.035 - i * 0.006, 0.118], [sd * 0.085, hc - 0.025 - i * 0.018, 0.1], 0.0012);
  }
  // 大紫色眼睛
  const eyes = [];
  for (const sd of [1, -1]) {
    eyes.push(makeEye(head, { p: [sd * 0.05, hc + 0.015, 0.097], r: 0.033, iris: '#8a5fd0', irisDark: '#4b2b86', yaw: sd * 0.38 }));
    M(head, GEO.box, C.furDark, [sd * 0.05, hc + 0.058, 0.1], [0.032, 0.006, 0.006], [0, sd * 0.35, sd * 0.12]); // 眉毛
  }
  // 长耳朵（两节，可甩动）
  const ears = [];
  for (const sd of [1, -1]) {
    const base = Grp(head, [sd * 0.042, hc + 0.095, -0.025], [-0.12, 0, -sd * 0.12], 'ear'); base.rotation.order = 'XZY';
    M(base, GEO.sph, C.fur, [0, 0.115, 0], [0.042, 0.13, 0.017]);
    M(base, GEO.sphMid, C.innerEar, [0, 0.125, 0.009], [0.027, 0.11, 0.009]);
    const tip = Grp(base, [0, 0.215, 0], [-0.05, 0, 0], 'earTip');
    M(tip, GEO.sph, C.fur, [0, 0.085, 0], [0.038, 0.105, 0.016]);
    M(tip, GEO.sphMid, C.innerEar, [0, 0.065, 0.008], [0.023, 0.07, 0.008]);
    M(tip, GEO.sphMid, C.earTip, [0, 0.145, 0.0], [0.028, 0.05, 0.017]);
    ears.push({ base, tip, side: sd });
  }

  // 手臂：长袖制服 + 黑色护腕
  const arms = [];
  for (const sd of [1, -1]) {
    const upper = Grp(torso, [sd * 0.112, 0.255, 0], [0.05, 0, sd * 0.1], 'upperArm');
    M(upper, capsule(0.03, 0.085), C.shirt, [0, -0.06, 0]);
    const lower = Grp(upper, [0, -0.125, 0], [-0.15, 0, 0], 'lowerArm');
    M(lower, capsule(0.026, 0.08), C.shirt, [0, -0.055, 0]);
    M(lower, GEO.cyl, C.armor, [0, -0.085, 0], [0.03, 0.04, 0.03]);
    const hand = Grp(lower, [0, -0.115, 0.004], [0, 0, 0], 'hand');
    M(hand, GEO.sphMid, C.fur, [0, -0.012, 0], [0.026, 0.03, 0.022]);
    M(hand, capsule(0.008, 0.012), C.fur, [sd * -0.002, -0.006, 0.02], [1, 1, 1], [0.8, 0, 0]); // 拇指
    arms.push({ upper, lower, hand, side: sd });
  }
  // 腿：黑裤 + 护膝 + 大兔脚
  const legs = [];
  for (const sd of [1, -1]) {
    const thigh = Grp(hips, [sd * 0.058, -0.01, 0], [0, 0, 0], 'thigh');
    M(thigh, capsule(0.052, 0.09), C.pants, [0, -0.075, 0.005]);
    const shin = Grp(thigh, [0, -0.17, 0], [0, 0, 0], 'shin');
    M(shin, capsule(0.038, 0.1), C.pants, [0, -0.07, 0]);
    M(shin, roundedPanel(0.05, 0.055, 0.016, 0.014), C.padGrey, [0, -0.01, 0.036], [1, 1, 1], [-0.1, 0, 0]); // 护膝
    M(shin, GEO.cyl, C.armor, [0, -0.135, 0], [0.04, 0.02, 0.04]); // 裤脚
    const foot = Grp(shin, [0, -0.16, 0], [0, 0, 0], 'foot');
    M(foot, GEO.sph, C.fur, [0, -0.018, 0.06], [0.048, 0.03, 0.115]);
    M(foot, GEO.sphMid, C.furLight, [0, -0.032, 0.07], [0.04, 0.012, 0.1]); // 脚底浅色
    for (let i = -1; i <= 1; i++) M(foot, GEO.sphLo, C.fur, [i * 0.018, -0.014, 0.16], [0.016, 0.017, 0.018]); // 脚趾
    legs.push({ thigh, shin, foot, side: sd });
  }

  const rig = { root, hips, torso, head, arms, legs, ears, tail: [tail], eyes };
  const anim = makeRigAnimator(rig, { hipY, legLen: hipY, scale: 1, sitY: 0.2, earFlop: 1.3, tailSway: 0.6, armOut: 0.04 });
  root.userData = {
    name: 'Judy Hopps', height: 1.0, totalHeight: 1.35, sitHipY: 0.2,
    bones: { hips, torso, neck, head, arms, legs, ears, tail: [tail] },
    update: anim.update, setPose: anim.setPose, getPose: anim.getPose,
  };
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  anim.update(0.016, 0);
  return root;
}

// ---------------------------------------------------------------------------
// 尼克的夏威夷衬衫纹理
// ---------------------------------------------------------------------------
let _shirtTex = null;
function hawaiianTexture() {
  if (_shirtTex || !hasDOM) return _shirtTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#4f9a48'; g.fillRect(0, 0, 256, 256);
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const leaf = (x, y, len, ang, col) => {
    g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = col;
    g.beginPath(); g.moveTo(0, 0);
    g.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0); g.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0); g.fill();
    g.strokeStyle = 'rgba(20,50,20,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(len, 0); g.stroke();
    g.restore();
  };
  for (let i = 0; i < 40; i++) {
    const x = r() * 256, y = r() * 256, a = r() * Math.PI * 2, l = 22 + r() * 30;
    const col = ['#2f6e33', '#76b85a', '#3d8a3e', '#9bd06b'][Math.floor(r() * 4)];
    for (const [dx, dy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) leaf(x + dx, y + dy, l, a, col);
  }
  // 小花
  for (let i = 0; i < 10; i++) {
    const x = r() * 256, y = r() * 256;
    for (const [dx, dy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
      g.fillStyle = i % 2 ? '#f2d04a' : '#e9eccf';
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; g.beginPath(); g.arc(x + dx + Math.cos(a) * 5, y + dy + Math.sin(a) * 5, 4, 0, 7); g.fill(); }
      g.fillStyle = '#d0702a'; g.beginPath(); g.arc(x + dx, y + dy, 2.5, 0, 7); g.fill();
    }
  }
  _shirtTex = new THREE.CanvasTexture(cv);
  _shirtTex.wrapS = _shirtTex.wrapT = THREE.RepeatWrapping;
  _shirtTex.repeat.set(3, 1.5);
  _shirtTex.colorSpace = THREE.SRGBColorSpace;
  _shirtTex.anisotropy = 4;
  return _shirtTex;
}
// 无 DOM 时：用顶点色画叶子斑块
function paintLeafVertexColors(geo) {
  const pos = geo.attributes.position, n = pos.count;
  const col = new Float32Array(n * 3);
  const base = new THREE.Color('#4f9a48'), a = new THREE.Color('#2f6e33'), b = new THREE.Color('#9bd06b'), tmp = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const v = Math.sin(x * 61 + y * 23) * Math.sin(z * 57 - y * 41) + Math.sin(y * 90 + x * 30) * 0.4;
    tmp.copy(base);
    if (v > 0.45) tmp.copy(a); else if (v < -0.6) tmp.copy(b);
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
let _shirtMat = null;
function shirtMaterial() {
  if (_shirtMat) return _shirtMat;
  const tex = hawaiianTexture();
  _shirtMat = tex ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  return _shirtMat;
}
function shirtGeo(geo) { if (!hasDOM) paintLeafVertexColors(geo); return geo; }

// ---------------------------------------------------------------------------
// 尼克
// ---------------------------------------------------------------------------
export function createNick() {
  const C = {
    fur: mat('#d8722c', 0.95), furLight: mat('#f2dfc0', 0.95), furDark: mat('#8e4a20', 0.95), earTip: mat('#3b2418', 0.9),
    nose: mat('#151012', 0.35), mouth: mat('#3a1f1a', 0.6), pants: mat('#b9a37a', 0.85), pantsDark: mat('#9c875f', 0.85),
    tieA: mat('#6a3d9a', 0.6), tieB: mat('#2f5fa8', 0.6), whisker: mat('#3a2a20', 0.6), belt: mat('#4a3626', 0.6),
    glass: mat('#0d0f12', 0.08, 0.6), frame: mat('#1a1a1a', 0.3, 0.5), button: mat('#efe8d4', 0.4), paw: mat('#5a3420', 0.9),
  };
  const shirt = shirtMaterial();
  const root = new THREE.Group(); root.name = 'Nick';
  const NS = 1.08; // 整体缩放：耳尖 ≈ 1.25m
  const body = Grp(root, [0, 0, 0], [0, 0, 0], 'body'); body.scale.setScalar(NS);
  const hipY = 0.5;
  const hips = Grp(body, [0, hipY, 0], [0, 0, 0], 'hips');
  M(hips, GEO.sph, C.pants, [0, 0.0, 0], [0.11, 0.085, 0.09]);

  // 蓬松大尾巴（三节，末端奶油色）
  const tail0 = Grp(hips, [0, 0.0, -0.08], [-2.05, 0, 0], 'tail'); tail0.rotation.order = 'YXZ';
  M(tail0, GEO.sph, C.fur, [0, 0.08, 0], [0.05, 0.11, 0.055]);
  const tail1 = Grp(tail0, [0, 0.16, 0], [0.25, 0, 0], 'tail1'); tail1.rotation.order = 'YXZ';
  M(tail1, GEO.sph, C.fur, [0, 0.1, 0], [0.085, 0.14, 0.09]);
  const tail2 = Grp(tail1, [0, 0.2, 0], [0.25, 0, 0], 'tail2'); tail2.rotation.order = 'YXZ';
  M(tail2, GEO.sph, C.fur, [0, 0.03, 0], [0.075, 0.08, 0.08]);
  M(tail2, GEO.sph, C.furLight, [0, 0.1, 0], [0.06, 0.085, 0.065]);
  M(tail2, GEO.cone, C.furLight, [0, 0.19, 0], [0.035, 0.06, 0.035]);

  // 躯干：衬衫（车削体 + 夏威夷纹理）
  const torso = Grp(hips, [0, 0.02, 0], [0, 0, 0], 'torso');
  const sg = shirtGeo(lathe([[0.0, -0.06], [0.1, -0.055], [0.11, -0.02], [0.104, 0.08], [0.108, 0.18], [0.12, 0.27], [0.1, 0.32], [0.055, 0.345], [0.0, 0.35]], 24));
  M(torso, sg, shirt, [0, 0, 0], [1, 1, 0.8]);
  // 衬衫下摆（没塞进裤子）
  const hem = shirtGeo(new THREE.CylinderGeometry(0.112, 0.118, 0.05, 24, 1, true));
  M(torso, hem, shirt, [0, -0.06, 0], [1, 1, 0.82]);
  // 敞开的领口露出奶油色胸毛
  M(torso, GEO.sphMid, C.furLight, [0, 0.3, 0.06], [0.045, 0.045, 0.03], [-0.3, 0, 0]);
  for (const sd of [1, -1]) {
    M(torso, GEO.box, shirt, [sd * 0.04, 0.322, 0.062], [0.05, 0.012, 0.04], [-0.6, sd * 0.5, sd * 0.4]); // 翻领
    M(torso, GEO.box, shirt, [sd * 0.008, 0.15, 0.087], [0.006, 0.26, 0.004]); // 门襟
  }
  for (let i = 0; i < 4; i++) M(torso, GEO.cylThin, C.button, [0.012, 0.03 + i * 0.065, 0.088 - (i > 2 ? 0.003 : 0)], [0.005, 0.003, 0.005], [Math.PI / 2, 0, 0], false);
  // 领带：紫蓝条纹，松垮的结
  const tie = Grp(torso, [0, 0.305, 0.072], [-0.1, 0, 0.06], 'tie');
  M(tie, GEO.box, C.tieA, [0, 0, 0.005], [0.03, 0.022, 0.014], [0, 0, 0.1]); // 结
  const stripes = 7;
  for (let i = 0; i < stripes; i++) {
    const w = 0.026 + i * 0.0035;
    M(tie, GEO.box, i % 2 ? C.tieB : C.tieA, [0, -0.02 - i * 0.022, 0.012 + i * 0.0018], [w, 0.022, 0.004], [-0.06, 0, 0]);
  }
  M(tie, GEO.cone, C.tieA, [0, -0.02 - stripes * 0.022 + 0.004, 0.025], [0.034, 0.025, 0.003], [Math.PI, Math.PI / 4, 0]);
  // 裤腰带
  M(torso, GEO.cyl, C.belt, [0, -0.07, 0], [0.108, 0.018, 0.088]);

  // 脖子 + 头
  const neck = Grp(torso, [0, 0.33, 0], [0, 0, 0], 'neck');
  M(neck, GEO.cyl, C.fur, [0, 0.02, -0.005], [0.045, 0.06, 0.04]);
  M(neck, GEO.sphLo, C.furLight, [0, 0.015, 0.025], [0.04, 0.04, 0.025]);
  const head = Grp(neck, [0, 0.04, 0], [0, 0, 0], 'head');
  const hc = 0.1;
  M(head, GEO.sph, C.fur, [0, hc, -0.005], [0.1, 0.092, 0.1]);
  // 脸颊奶油色 + 腮毛
  for (const sd of [1, -1]) {
    M(head, GEO.sphMid, C.furLight, [sd * 0.05, hc - 0.04, 0.045], [0.05, 0.042, 0.05], [0, 0, sd * 0.3]);
    M(head, GEO.cone, C.furLight, [sd * 0.09, hc - 0.045, 0.01], [0.018, 0.05, 0.016], [0, 0, sd * 2.0]);
  }
  // 长吻：上半橙、下半奶油
  M(head, GEO.cone, C.fur, [0, hc - 0.012, 0.12], [0.05, 0.13, 0.04], [Math.PI / 2, 0, 0]);
  M(head, GEO.cone, C.furLight, [0, hc - 0.035, 0.11], [0.046, 0.11, 0.028], [Math.PI / 2, 0, 0]);
  M(head, GEO.sphMid, C.fur, [0, hc + 0.0, 0.07], [0.055, 0.04, 0.06]); // 吻根
  M(head, GEO.sphMid, C.nose, [0, hc - 0.006, 0.185], [0.017, 0.013, 0.013]);
  M(head, GEO.sphLo, C.furDark, [0, hc + 0.022, 0.1], [0.015, 0.01, 0.04], [0.2, 0, 0]); // 鼻梁深色
  // 坏笑：嘴角上扬（右侧更高）
  M(head, GEO.box, C.mouth, [0.0, hc - 0.045, 0.125], [0.05, 0.003, 0.003], [0, 0, 0]);
  M(head, GEO.box, C.mouth, [-0.03, hc - 0.04, 0.11], [0.018, 0.003, 0.003], [0, 0.6, 0.45]);
  M(head, GEO.box, C.mouth, [0.028, hc - 0.043, 0.112], [0.012, 0.003, 0.003], [0, -0.6, -0.2]);
  for (const sd of [1, -1]) for (let i = 0; i < 3; i++) {
    between(head, GEO.cylThin, C.whisker, [sd * 0.02, hc - 0.012 - i * 0.006, 0.155], [sd * 0.075, hc - 0.002 - i * 0.016, 0.13], 0.0011);
  }
  // 绿眼睛 + 半闭眼皮
  const eyes = [];
  for (const sd of [1, -1]) {
    eyes.push(makeEye(head, { p: [sd * 0.04, hc + 0.025, 0.083], r: 0.024, iris: '#5fb04a', irisDark: '#2c6a2a', yaw: sd * 0.42, lidColor: '#d8722c', lidDrop: 0.32 }));
    M(head, GEO.box, C.furDark, [sd * 0.042, hc + 0.05, 0.088], [0.03, 0.006, 0.007], [0, sd * 0.4, sd * (sd > 0 ? -0.05 : 0.18)]); // 一高一低的挑眉
  }
  // 三角耳：深色耳尖，奶油色内耳
  const ears = [];
  for (const sd of [1, -1]) {
    const base = Grp(head, [sd * 0.05, hc + 0.06, -0.02], [-0.1, 0, -sd * 0.28], 'ear'); base.rotation.order = 'XZY';
    M(base, GEO.cone, C.fur, [0, 0.045, 0], [0.042, 0.1, 0.018]);
    M(base, GEO.cone, C.furLight, [0, 0.04, 0.008], [0.028, 0.075, 0.008]);
    const tip = Grp(base, [0, 0.07, 0], [0, 0, 0], 'earTip');
    M(tip, GEO.cone, C.earTip, [0, 0.012, 0], [0.016, 0.044, 0.016]);
    ears.push({ base, tip, side: sd });
  }
  // 墨镜（默认隐藏）
  const shades = Grp(head, [0, hc + 0.027, 0.103], [0, 0, 0], 'sunglasses');
  for (const sd of [1, -1]) {
    M(shades, GEO.cyl, C.glass, [sd * 0.033, 0, 0], [0.024, 0.005, 0.019], [Math.PI / 2, 0, 0]);
    M(shades, GEO.box, C.frame, [sd * 0.072, 0.003, -0.04], [0.004, 0.005, 0.08], [0, -sd * 0.15, 0]);
  }
  M(shades, GEO.box, C.frame, [0, 0.008, 0], [0.025, 0.005, 0.005]);
  shades.visible = false;

  // 手臂：短袖衬衫
  const arms = [];
  for (const sd of [1, -1]) {
    const upper = Grp(torso, [sd * 0.122, 0.285, 0], [0.05, 0, sd * 0.09], 'upperArm');
    M(upper, capsule(0.028, 0.11), C.fur, [0, -0.08, 0]);
    const sl = shirtGeo(new THREE.CylinderGeometry(0.04, 0.045, 0.1, 16, 1, false));
    M(upper, sl, shirt, [0, -0.04, 0]);
    const lower = Grp(upper, [0, -0.16, 0], [-0.15, 0, 0], 'lowerArm');
    M(lower, capsule(0.025, 0.1), C.fur, [0, -0.06, 0]);
    const hand = Grp(lower, [0, -0.14, 0.004], [0, 0, 0], 'hand');
    M(hand, GEO.sphMid, C.furDark, [0, -0.01, 0], [0.026, 0.032, 0.021]);
    M(hand, capsule(0.008, 0.014), C.furDark, [sd * -0.004, -0.004, 0.02], [1, 1, 1], [0.8, 0, 0]);
    arms.push({ upper, lower, hand, side: sd });
  }
  // 腿：卡其裤（卷到脚踝）+ 赤脚深色爪
  const legs = [];
  for (const sd of [1, -1]) {
    const thigh = Grp(hips, [sd * 0.055, -0.01, 0], [0, 0, 0], 'thigh');
    M(thigh, capsule(0.046, 0.15), C.pants, [0, -0.1, 0]);
    const shin = Grp(thigh, [0, -0.22, 0], [0, 0, 0], 'shin');
    M(shin, capsule(0.04, 0.15), C.pants, [0, -0.095, 0]);
    M(shin, GEO.cyl, C.pantsDark, [0, -0.18, 0], [0.043, 0.03, 0.043]); // 卷边
    M(shin, GEO.cyl, C.paw, [0, -0.21, 0], [0.025, 0.04, 0.025]); // 脚踝
    const foot = Grp(shin, [0, -0.22, 0], [0, 0, 0], 'foot');
    M(foot, GEO.sph, C.paw, [0, -0.025, 0.035], [0.04, 0.028, 0.075]);
    for (let i = -1; i <= 1; i++) M(foot, GEO.sphLo, C.paw, [i * 0.016, -0.03, 0.1], [0.014, 0.014, 0.016]);
    legs.push({ thigh, shin, foot, side: sd });
  }

  const rig = { root, hips, torso, head, arms, legs, ears, tail: [tail0, tail1, tail2], eyes };
  const anim = makeRigAnimator(rig, { hipY, legLen: hipY, scale: NS, sitY: 0.27, earFlop: 0.6, tailSway: 0.9, armOut: 0.03 });
  root.userData = {
    name: 'Nick Wilde', height: 1.17, totalHeight: 1.25, sitHipY: 0.29,
    bones: { hips, torso, neck, head, arms, legs, ears, tail: [tail0, tail1, tail2] },
    update: anim.update, setPose: anim.setPose, getPose: anim.getPose,
    setSunglasses(on) { shades.visible = !!on; },
  };
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  anim.update(0.016, 0);
  return root;
}
