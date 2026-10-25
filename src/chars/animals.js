// 拟人动物 NPC：程序化低模（每只 ≤ 4k 三角形），双足直立、穿衣服。
//
// 用法：
//   import { createAnimal, SPECIES } from './chars/animals.js';
//   const npc = createAnimal('elephant', { outfit: 'suit', seed: 42 });
//   scene.add(npc);
//   npc.rotation.y = Math.atan2(dirX, dirZ);      // 模型正面朝本地 +Z
//   npc.userData.update(dt, speedMetersPerSec);    // 每帧调用
//   npc.userData.setPose('idle' | 'walk' | 'talk' | 'sit');
//   npc.userData.height                            // 身高（米，不含耳朵/角）
//
// 原点在脚底，前方 = 本地 +Z，上 = +Y，角色左手 = +X。
// opts: { color: 毛色覆盖, outfit: 'casual'|'suit'|'police'|'worker'|'dress', outfitColor, seed }
//
// 性能设计：
//   - 每个骨骼（hips/torso/head/上臂/前臂/大腿/小腿/尾巴）只有 1 个网格，所有零件合并、颜色走顶点色，
//     → 每只 NPC 约 12 个 draw call，全部共用同一个 MeshStandardMaterial。
//   - 合并后的几何体按「物种 + 毛色 + 服装配色」缓存，相同外观的实例共享几何体（不要 dispose 它们）。
//   - 内部 rig 组按身高缩放（建模单位：头顶 = 1）。
//
// 另外导出 makeRigAnimator(rig, cfg)：通用的程序化骨骼动画器（heroes.js 也使用它）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '../core/builder.js';

// ---------------------------------------------------------------------------
// 通用程序化动画器
// rig: {
//   root, hips, torso, head,
//   arms: [{ upper, lower, side }], legs: [{ thigh, shin, foot?, side }],   side: +1 左 / -1 右
//   ears?: [{ base, tip?, side }], tail?: [Group...], eyes?: [Group...]
// }
// cfg: { hipY, legLen (rig 本地单位), scale (本地单位→米), sitY, earFlop, tailSway, armOut }
// ---------------------------------------------------------------------------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function makeRigAnimator(rig, cfg) {
  const st = {
    pose: 'idle', phase: Math.random() * 6.28, t: Math.random() * 100,
    walk: 0, run: 0, blinkT: 1 + Math.random() * 3, blink: 0,
    twitchT: 2 + Math.random() * 4, twitch: [0, 0], twitchV: [0, 0], speed: 0,
  };
  const all = [];
  const rest = new Map();
  const reg = (o) => { if (o && !rest.has(o)) { rest.set(o, o.rotation.clone()); all.push(o); } };
  [rig.hips, rig.torso, rig.head].forEach(reg);
  (rig.arms || []).forEach(a => { reg(a.upper); reg(a.lower); });
  (rig.legs || []).forEach(l => { reg(l.thigh); reg(l.shin); reg(l.foot); });
  (rig.ears || []).forEach(e => { reg(e.base); reg(e.tip); });
  (rig.tail || []).forEach(reg);
  const tgt = new Map();
  for (const o of all) tgt.set(o, new THREE.Vector3());
  const T = (o, x = 0, y = 0, z = 0) => { if (!o) return; const v = tgt.get(o); v.x += x; v.y += y; v.z += z; };
  const earFlop = cfg.earFlop ?? 1, tailSway = cfg.tailSway ?? 1, armOut = cfg.armOut ?? 0;

  function update(dt, speed = 0) {
    dt = Math.min(dt || 0, 0.1);
    st.t += dt; const t = st.t;
    st.speed += (speed - st.speed) * (1 - Math.exp(-dt * 10));
    const sp = Math.max(0, st.speed);
    const pose = st.pose;
    const special = pose === 'jump' || pose === 'sit';
    const moving = !special && speed > 0.15;
    st.walk += ((moving ? 1 : 0) - st.walk) * (1 - Math.exp(-dt * 8));
    const runT = clamp((sp - 3.2) / 3.5, 0, 1) * st.walk;
    st.run += (runT - st.run) * (1 - Math.exp(-dt * 6));
    const W = st.walk, R = st.run, S = clamp((sp - 7) / 3, 0, 1) * W;
    const legM = Math.max(0.02, cfg.legLen * (cfg.scale || 1));
    const stride = legM * 2.6 + Math.min(sp, 14) * 0.08 * Math.min(1, legM / 0.35);
    if (W > 0.01) st.phase += (Math.PI * 2 * sp / stride) * dt;
    const ph = st.phase;
    for (const v of tgt.values()) v.set(0, 0, 0);

    const s = Math.sin(ph), c = Math.cos(ph);
    // --- 腿 ---
    const legAmp = (0.5 + 0.4 * R + 0.15 * S) * W;
    for (const L of rig.legs || []) {
      const p = L.side > 0 ? 0 : Math.PI;
      const ls = Math.sin(ph + p), lc = Math.cos(ph + p);
      const th = -ls * legAmp;
      const kn = (Math.max(0, lc) * (0.7 + 0.9 * R) + 0.08) * W;
      T(L.thigh, th); T(L.shin, kn); T(L.foot, -(th + kn) * 0.6 + Math.max(0, -lc) * 0.25 * W);
    }
    // --- 胯 / 躯干 ---
    const bob = cfg.legLen * (0.035 + 0.06 * R) * W;
    let hipY = cfg.hipY + (Math.abs(c) - 0.25) * bob;
    T(rig.hips, 0, s * 0.08 * W, 0);
    const lean = (0.04 + 0.22 * R + 0.1 * S) * W;
    T(rig.torso, lean + Math.sin(t * 2.1) * 0.018 * (1 - W), -s * 0.12 * W, 0);
    T(rig.head, -lean * 0.6 + Math.abs(s) * 0.04 * W, s * 0.05 * W);
    // --- 手臂 ---
    const armAmp = (0.45 + 0.6 * R) * W;
    for (const A of rig.arms || []) {
      const p = A.side > 0 ? 0 : Math.PI;
      const as = Math.sin(ph + p);
      T(A.upper, as * armAmp, 0, A.side * (armOut + 0.06 * R + Math.sin(t * 2.1) * 0.015));
      T(A.lower, -(0.15 + 0.25 * W + 0.9 * R) - Math.max(0, as) * 0.3 * W);
    }
    // --- 耳朵 ---
    for (let i = 0; i < (rig.ears || []).length; i++) {
      const E = rig.ears[i];
      // 随机抖耳
      const tw = st.twitch[i] || 0;
      T(E.base, (-0.25 * R + Math.sin(ph * 2) * 0.08 * W) * earFlop + tw, 0, E.side * tw * 0.5);
      T(E.tip, (-0.35 * R + Math.sin(ph * 2 - 0.9) * 0.18 * W - Math.sin(t * 1.3 + i) * 0.03) * earFlop);
    }
    // --- 尾巴 ---
    (rig.tail || []).forEach((g, i) => {
      T(g, (Math.sin(ph * 2 + i) * 0.1 * W - 0.1 * R) * tailSway,
        (Math.sin(t * 1.6 - i * 0.7) * 0.22 * (1 - W) + s * 0.3 * W) * tailSway);
    });

    // --- 特殊姿势 ---
    if (pose === 'talk' && !moving) {
      T(rig.head, Math.sin(t * 6.5) * 0.06, Math.sin(t * 0.9) * 0.15, Math.sin(t * 1.3) * 0.07);
      T(rig.torso, 0, Math.sin(t * 0.7) * 0.06);
      const A = (rig.arms || []).find(a => a.side < 0) || (rig.arms || [])[0];
      if (A) { T(A.upper, -0.55 + Math.sin(t * 2.7) * 0.25, 0, A.side * 0.15); T(A.lower, -0.8 + Math.sin(t * 3.9) * 0.25); }
      const B = (rig.arms || []).find(a => a !== A);
      if (B) { T(B.upper, -0.15 + Math.sin(t * 1.9 + 1) * 0.12); T(B.lower, -0.35); }
    } else if (pose === 'jump') {
      for (const L of rig.legs || []) { T(L.thigh, -1.05 - (L.side > 0 ? 0.15 : 0)); T(L.shin, 1.55); T(L.foot, 0.35); }
      for (const A of rig.arms || []) { T(A.upper, -1.1, 0, A.side * 0.5); T(A.lower, -0.5); }
      T(rig.torso, 0.18); T(rig.head, -0.2);
      for (const E of rig.ears || []) { T(E.base, -0.55 * earFlop); T(E.tip, -0.4 * earFlop); }
      (rig.tail || []).forEach(g => T(g, 0.25 * tailSway));
    } else if (pose === 'sit') {
      for (const L of rig.legs || []) { T(L.thigh, -1.5); T(L.shin, 1.45); T(L.foot, 0.05); }
      for (const A of rig.arms || []) { T(A.upper, -0.35, 0, A.side * 0.12); T(A.lower, -0.6); }
      T(rig.torso, -0.08);
      hipY = cfg.sitY ?? cfg.hipY * 0.55;
      T(rig.head, Math.sin(t * 0.8) * 0.04, Math.sin(t * 0.5) * 0.2);
    } else if (!moving) {
      // 待机：偶尔左右看
      T(rig.head, Math.sin(t * 0.37) * 0.04, Math.sin(t * 0.23) * 0.25 * (1 - W), 0);
    }

    // 抖耳计时
    st.twitchT -= dt;
    if (st.twitchT < 0 && (rig.ears || []).length) {
      st.twitchT = 1.5 + Math.random() * 4;
      st.twitchV[Math.random() < 0.5 ? 0 : 1] = 1;
    }
    for (let i = 0; i < 2; i++) {
      if (st.twitchV[i] > 0) { st.twitchV[i] -= dt * 5; st.twitch[i] = Math.sin((1 - st.twitchV[i]) * Math.PI) * 0.35; }
      else st.twitch[i] = 0;
    }

    // 平滑应用
    const k = 1 - Math.exp(-dt * (moving ? 18 : 10));
    for (const o of all) {
      const r0 = rest.get(o), v = tgt.get(o);
      o.rotation.x += (r0.x + v.x - o.rotation.x) * k;
      o.rotation.y += (r0.y + v.y - o.rotation.y) * k;
      o.rotation.z += (r0.z + v.z - o.rotation.z) * k;
    }
    if (rig.hips) rig.hips.position.y += (hipY - rig.hips.position.y) * k;

    // 眨眼
    st.blinkT -= dt;
    if (st.blinkT < 0) { st.blinkT = 2 + Math.random() * 4; st.blink = 0.14; }
    let eyeS = 1;
    if (st.blink > 0) { st.blink -= dt; eyeS = 0.12 + Math.abs(st.blink / 0.14 - 0.5) * 1.76; }
    for (const e of rig.eyes || []) e.scale.y = (e.userData.baseSY || 1) * Math.min(1, eyeS);
  }

  return {
    update,
    setPose(name) { st.pose = name || 'idle'; },
    getPose: () => st.pose,
    state: st,
  };
}

// ---------------------------------------------------------------------------
// 物种表
// ---------------------------------------------------------------------------
export const SPECIES = [
  { key: 'rabbit', name: '兔子', height: 1.0 },
  { key: 'fox', name: '狐狸', height: 1.25 },
  { key: 'elephant', name: '大象', height: 3.8 },
  { key: 'giraffe', name: '长颈鹿', height: 5.5 },
  { key: 'polarbear', name: '北极熊', height: 3.0 },
  { key: 'lion', name: '狮子', height: 2.2 },
  { key: 'sheep', name: '绵羊', height: 1.3 },
  { key: 'cheetah', name: '猎豹', height: 1.9 },
  { key: 'sloth', name: '树懒', height: 1.4 },
  { key: 'mouse', name: '老鼠', height: 0.15 },
  { key: 'shrew', name: '鼩鼱', height: 0.15 },
  { key: 'otter', name: '水獭', height: 0.9 },
  { key: 'hippo', name: '河马', height: 2.8 },
  { key: 'zebra', name: '斑马', height: 2.2 },
  { key: 'wolf', name: '狼', height: 1.8 },
  { key: 'pig', name: '猪', height: 1.4 },
  { key: 'camel', name: '骆驼', height: 2.6 },
  { key: 'tiger', name: '老虎', height: 2.2 },
  { key: 'buffalo', name: '水牛', height: 2.6 },
  { key: 'weasel', name: '黄鼠狼', height: 1.0 },
  { key: 'beaver', name: '河狸', height: 1.0 },
  { key: 'koala', name: '考拉', height: 1.0 },
  { key: 'meerkat', name: '狐獴', height: 0.6 },
];
const HEIGHT = Object.fromEntries(SPECIES.map(s => [s.key, s.height]));

// 比例单位：头顶 = 1。leg = 胯高，neck = 脖子长，head = 头半径，bw/bd = 躯干半宽/半厚
// snout: short|canine|cat|horse|broad|disc|bear|trunk|pointy|beaver|flat
// ears: long|pointy|round|big|side|flap|tiny|horse
// tail: puff|bushy|long|thin|tuft|flat|curly|none|stub
// feet: paw|big|hoof
const SP = {
  rabbit:   { fur: '#9b96a3', light: '#d8d2dc', inner: '#e8a5b4', leg: .33, neck: .02, head: .13, bw: .14, bd: .11, snout: 'short', nose: '#e58a9c', ears: 'long', earLen: 2.6, tail: 'puff', feet: 'big', arm: .27 },
  fox:      { fur: '#d9752e', light: '#f3e1c4', dark: '#3b2418', leg: .38, neck: .02, head: .1, bw: .13, bd: .1, snout: 'canine', ears: 'pointy', earLen: 1.5, tail: 'bushy', feet: 'paw', arm: .3, darkLimbs: true },
  wolf:     { fur: '#7d8088', light: '#d4d6da', dark: '#3e4048', leg: .45, neck: .03, head: .085, bw: .12, bd: .095, sw: .14, snout: 'canine', ears: 'pointy', earLen: 1.3, tail: 'bushy', feet: 'paw', arm: .33 },
  lion:     { fur: '#d9a54e', light: '#f0d9a8', mane: '#8c4f1e', leg: .44, neck: .03, head: .085, bw: .13, bd: .1, sw: .15, snout: 'cat', nose: '#6b3a2a', ears: 'round', tail: 'tuft', tuft: '#8c4f1e', feet: 'paw', arm: .34, extra: ['mane'] },
  tiger:    { fur: '#e8822a', light: '#fbf0e0', stripe: '#1d1410', leg: .44, neck: .03, head: .09, bw: .13, bd: .1, sw: .15, snout: 'cat', nose: '#c76a5a', ears: 'round', tail: 'long', feet: 'paw', arm: .34, extra: ['stripes'] },
  cheetah:  { fur: '#e9b54a', light: '#fbecc8', spot: '#3a2a1a', leg: .35, neck: .02, head: .125, bw: .17, bd: .15, belly: 1.0, snout: 'cat', nose: '#3a2a1a', ears: 'round', tail: 'long', feet: 'paw', arm: .29, extra: ['spots', 'tearline'] },
  zebra:    { fur: '#f4f4f0', light: '#d8d8d4', stripe: '#1d1d1d', leg: .47, neck: .08, head: .07, hsy: 1.1, bw: .11, bd: .09, snout: 'horse', snoutCol: '#2a2a2a', ears: 'horse', tail: 'tuft', tuft: '#1d1d1d', feet: 'hoof', arm: .34, extra: ['stripes', 'maneStrip'] },
  buffalo:  { fur: '#4f4a48', light: '#6e6662', leg: .42, neck: .02, head: .085, bw: .16, bd: .12, sw: .2, snout: 'broad', snoutCol: '#2f2b2a', ears: 'side', tail: 'tuft', tuft: '#2b2725', feet: 'hoof', arm: .33, extra: ['horns'], horn: '#cfc6b8' },
  polarbear:{ fur: '#f2f0ea', light: '#fbfaf6', leg: .38, neck: .02, head: .08, bw: .18, bd: .15, sw: .19, belly: .7, snout: 'bear', nose: '#222222', ears: 'round', tail: 'stub', feet: 'paw', arm: .33 },
  hippo:    { fur: '#8f7f95', light: '#d8a7a0', leg: .3, neck: .01, head: .11, hsx: 1.05, bw: .22, bd: .18, belly: 1.0, snout: 'broad', snoutCol: '#a8949e', snoutBig: 1.35, ears: 'tiny', tail: 'tuft', tuft: '#6e5f74', feet: 'hoof', arm: .27 },
  elephant: { fur: '#8e9196', light: '#a8abb0', leg: .38, neck: .01, head: .1, bw: .19, bd: .15, sw: .2, belly: .6, snout: 'trunk', ears: 'flap', tail: 'tuft', tuft: '#55585c', feet: 'hoof', hoof: '#c9c6bd', arm: .3, extra: ['tusks'] },
  giraffe:  { fur: '#e8b65c', light: '#f4e2b8', spot: '#9a5a24', leg: .33, neck: .3, neckR: .022, head: .045, hsy: 1.1, bw: .1, bd: .08, snout: 'horse', snoutCol: '#d9a24c', ears: 'side', tail: 'tuft', tuft: '#5a3418', feet: 'hoof', arm: .27, extra: ['spots', 'ossicones', 'maneStrip'], maneCol: '#9a5a24' },
  camel:    { fur: '#c9a06a', light: '#e6caa0', leg: .44, neck: .08, head: .065, hsy: 1.05, bw: .13, bd: .1, snout: 'horse', snoutCol: '#b8905c', ears: 'tiny', tail: 'tuft', tuft: '#8a6a40', feet: 'hoof', arm: .33, extra: ['humps'] },
  sheep:    { fur: '#f2ead8', light: '#f7f1e4', wool: '#fbf8f0', leg: .36, neck: .02, head: .1, hsy: 1.05, bw: .14, bd: .12, snout: 'short', nose: '#c98a8a', ears: 'side', tail: 'puff', feet: 'hoof', hoof: '#3a3330', arm: .29, extra: ['wool'] },
  sloth:    { fur: '#8b7a62', light: '#c9b896', mask: '#4a3b2a', leg: .35, neck: .02, head: .11, bw: .14, bd: .11, snout: 'flat', nose: '#2a2018', ears: 'tiny', tail: 'none', feet: 'paw', arm: .42, extra: ['mask', 'claws'] },
  mouse:    { fur: '#a89a8c', light: '#e8d8cc', inner: '#e8a5b4', leg: .33, neck: .02, head: .14, bw: .14, bd: .11, snout: 'pointy', nose: '#e58a9c', ears: 'big', tail: 'thin', tailCol: '#d8a8a8', feet: 'paw', arm: .27 },
  shrew:    { fur: '#b9a48c', light: '#e6d6c2', leg: .33, neck: .02, head: .12, bw: .14, bd: .11, snout: 'pointy', snoutLen: 1.5, nose: '#e58a9c', ears: 'tiny', tail: 'thin', tailCol: '#c8a898', feet: 'paw', arm: .27 },
  otter:    { fur: '#7a5434', light: '#c8a580', leg: .32, neck: .03, head: .1, bw: .14, bd: .12, snout: 'bear', nose: '#2a1a12', ears: 'tiny', tail: 'long', tailThick: 1.8, feet: 'paw', arm: .27 },
  weasel:   { fur: '#8a5a32', light: '#ead8b8', leg: .34, neck: .05, head: .08, hsz: 1.15, bw: .11, bd: .09, snout: 'canine', snoutLen: .8, ears: 'round', tail: 'long', tailThick: 1.4, feet: 'paw', arm: .27 },
  beaver:   { fur: '#7a4e2c', light: '#a07650', leg: .3, neck: .02, head: .11, bw: .16, bd: .14, belly: .6, snout: 'beaver', nose: '#2a1a12', ears: 'tiny', tail: 'flat', tailCol: '#3a2a20', feet: 'paw', arm: .26 },
  koala:    { fur: '#9a9aa0', light: '#d8d8dc', leg: .33, neck: .02, head: .14, bw: .15, bd: .13, belly: .5, snout: 'flat', nose: '#222222', noseBig: 1.6, ears: 'big', earFluff: true, tail: 'none', feet: 'paw', arm: .27 },
  meerkat:  { fur: '#c9a273', light: '#e8d2a8', mask: '#4a3420', leg: .35, neck: .04, head: .085, bw: .11, bd: .1, snout: 'pointy', snoutLen: 1.0, nose: '#2a1a12', ears: 'tiny', tail: 'thin', tailCol: '#8a6a40', feet: 'paw', arm: .27, extra: ['mask'] },
  pig:      { fur: '#f0aeb0', light: '#f7c9c9', leg: .33, neck: .01, head: .11, bw: .16, bd: .14, belly: .8, snout: 'disc', snoutCol: '#e88d92', ears: 'pig', tail: 'curly', feet: 'hoof', hoof: '#8a5a5a', arm: .27 },
};

// ---------------------------------------------------------------------------
// 共享几何体 & 材质
// ---------------------------------------------------------------------------
function strip(g) { g.deleteAttribute('uv'); return g; }
const G = {
  sph: strip(new THREE.SphereGeometry(1, 8, 6)),
  sphLo: strip(new THREE.SphereGeometry(1, 6, 4)),
  hemi: strip(new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2)),
  cyl: strip(new THREE.CylinderGeometry(1, 1, 1, 8)),
  cylLo: strip(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true)),
  frustum: strip(new THREE.CylinderGeometry(0.62, 1, 1, 8)),
  cone: strip(new THREE.ConeGeometry(1, 1, 8)),
  cone4: strip(new THREE.ConeGeometry(1, 1, 5)),
  box: strip(new THREE.BoxGeometry(1, 1, 1)),
  torus: strip(new THREE.TorusGeometry(1, 0.35, 4, 8)),
};

let _npcMat = null;
export function npcMaterial() {
  if (!_npcMat) _npcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.0 });
  return _npcMat;
}
// 需要单色材质时使用（按颜色缓存）
const _colMats = new Map();
export function colorMaterial(color, rough = 0.8) {
  const key = `${new THREE.Color(color).getHexString()}|${rough}`;
  let m = _colMats.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: rough }); _colMats.set(key, m); }
  return m;
}

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);

class Parts {
  constructor() { this.b = {}; }
  // p: [x,y,z], s: [sx,sy,sz], r: [rx,ry,rz] 或 THREE.Quaternion
  add(bone, geo, color, p, s, r) {
    (this.b[bone] ||= []).push({ geo, color, p, s, r });
  }
  // 椭球/锥等「沿本地 +Y 延伸」的零件：底端在 base，长度 len，横截面半径 rx/rz，朝向 euler
  along(bone, geo, color, base, len, rx, rz, euler = [0, 0, 0], centered = true) {
    _e.set(euler[0], euler[1], euler[2], 'XYZ');
    const q = new THREE.Quaternion().setFromEuler(_e);
    const off = new THREE.Vector3(0, centered ? len / 2 : 0, 0).applyQuaternion(q);
    this.add(bone, geo, color, [base[0] + off.x, base[1] + off.y, base[2] + off.z], [rx, len / 2 * (centered ? 1 : 2), rz], q);
  }
  // 两点之间的柱/椭球
  between(bone, geo, color, a, b, rad, halfScale = 0.5) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const d = B.clone().sub(A); const len = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(_up, d.normalize());
    const mid = A.add(B).multiplyScalar(0.5);
    this.add(bone, geo, color, [mid.x, mid.y, mid.z], [rad, len * halfScale, rad], q);
  }
  build() {
    const out = {};
    for (const [bone, items] of Object.entries(this.b)) {
      const list = [];
      for (const it of items) {
        const g = it.geo.clone();
        if (it.r instanceof THREE.Quaternion) _q.copy(it.r);
        else { _e.set(...(it.r || [0, 0, 0]), 'XYZ'); _q.setFromEuler(_e); }
        _m4.compose(_v.set(...it.p), _q, _s.set(...it.s));
        g.applyMatrix4(_m4);
        _c.set(it.color);
        const n = g.attributes.position.count;
        const col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        list.push(g);
      }
      const merged = mergeGeometries(list, false);
      list.forEach(g => g.dispose());
      merged.computeBoundingSphere();
      out[bone] = merged;
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// 服装
// ---------------------------------------------------------------------------
const PAL = {
  casualTop: ['#d9534f', '#5bc0de', '#f0ad4e', '#5cb85c', '#9b59b6', '#ecf0f1', '#34495e', '#e67e22', '#1abc9c', '#f4d03f', '#c0392b', '#7f8c8d'],
  pants: ['#2c3e66', '#3b5998', '#c8b48a', '#4a4a4a', '#6b4f3a', '#556b2f'],
  suit: ['#2b2f3a', '#3c3f48', '#4a3b2f', '#1f2a44', '#5a5f6b', '#6d2e2e', '#2e4a3a'],
  tie: ['#b03030', '#2f5fa8', '#d4a020', '#6a3d9a', '#2a8a5a', '#222222'],
  workerVest: ['#ff7a1a', '#e8d020'],
  workerShirt: ['#4a6fa5', '#7a7a7a', '#c9c2b0'],
  dress: ['#e05a8a', '#f2a65a', '#8e6bd8', '#4fb0c6', '#e8d35a', '#d64545', '#6cc28a', '#f0f0f0'],
};
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

function resolveOutfit(species, opts, r) {
  let outfit = opts.outfit;
  if (!outfit) {
    const x = r();
    outfit = x < 0.48 ? 'casual' : x < 0.68 ? 'suit' : x < 0.8 ? 'worker' : 'dress';
  } else r();
  const o = { outfit };
  if (outfit === 'casual') {
    o.top = opts.outfitColor || pick(r, PAL.casualTop); o.pants = pick(r, PAL.pants); o.sleeve = 'short'; o.shorts = r() < 0.3;
  } else if (outfit === 'suit') {
    o.top = opts.outfitColor || pick(r, PAL.suit); o.pants = o.top; o.sleeve = 'long'; o.tie = pick(r, PAL.tie); r();
  } else if (outfit === 'police') {
    o.top = opts.outfitColor || '#1f2a44'; o.pants = '#1a2030'; o.sleeve = 'long'; o.vest = '#15171c'; r(); r();
  } else if (outfit === 'worker') {
    o.top = pick(r, PAL.workerShirt); o.vest = opts.outfitColor || pick(r, PAL.workerVest); o.pants = pick(r, ['#2c3e66', '#3b5998', '#5a4a3a']); o.sleeve = 'long'; o.hat = r() < 0.75;
  } else { // dress
    o.top = opts.outfitColor || pick(r, PAL.dress); o.pants = o.top; o.sleeve = 'none'; r(); r();
  }
  return o;
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.r = clamp(c.r * k, 0, 1); c.g = clamp(c.g * k, 0, 1); c.b = clamp(c.b * k, 0, 1);
  return '#' + c.getHexString();
}

// ---------------------------------------------------------------------------
// 模型构建（单位：头顶 = 1）
// ---------------------------------------------------------------------------
function buildGeometry(key, sp, fur, light, ot) {
  const P = new Parts();
  const L = sp.leg, hr = sp.head, hsx = sp.hsx ?? 1, hsy = sp.hsy ?? 1, hsz = sp.hsz ?? 1;
  const neck = sp.neck, footH = 0.03;
  const T = 1 - L - neck - 2 * hr * hsy;
  const bw = sp.bw, bd = sp.bd, sw = sp.sw ?? bw * 0.95;
  const legSeg = (L - footH) / 2;
  const lr = sp.legR ?? bw * 0.36;
  const ar = sp.armR ?? bw * 0.27;
  const upLen = sp.arm * 0.48, loLen = sp.arm * 0.42;
  const ex = new Set(sp.extra || []);
  const dark = sp.dark || shade(fur, 0.55);
  const limbFur = sp.darkLimbs ? dark : fur;
  const isHoof = sp.feet === 'hoof';
  const hoofCol = sp.hoof || '#2e2826';
  const stripe = sp.stripe, spot = sp.spot;

  // ---- 胯（裤子/裙子） ----
  P.add('hips', G.sph, ot.pants, [0, 0.01, 0], [bw * 0.93, T * 0.22, bd * 0.93]);
  if (ot.outfit === 'dress') P.add('hips', G.frustum, ot.top, [0, -T * 0.12, 0], [bw * 1.25, T * 0.55, bd * 1.25]);

  // ---- 躯干 ----
  P.add('torso', G.sph, ot.top, [0, T * 0.45, 0], [bw, T * 0.55, bd]);
  P.add('torso', G.sph, ot.vest || ot.top, [0, T * 0.74, 0], [sw, T * 0.3, bd * 0.95]);
  if (sp.belly) P.add('torso', G.sph, ot.vest && ot.outfit === 'police' ? ot.top : ot.top, [0, T * 0.32, bd * 0.35], [bw * 0.9, T * 0.36 * (0.8 + sp.belly * 0.25), bd * (0.7 + sp.belly * 0.25)]);
  // 腰带
  if (ot.outfit !== 'dress') {
    P.add('torso', G.cyl, ot.outfit === 'police' ? '#111111' : '#3a2a1e', [0, T * 0.06, 0], [bw * 1.0, T * 0.05, bd * (sp.belly ? 1.08 : 1.0)]);
    P.add('torso', G.box, '#d4af37', [0, T * 0.06, bd * (sp.belly ? 1.06 : 0.98)], [bw * 0.25, T * 0.06, 0.008]);
  }
  const chestZ = bd * 0.93 + (sp.belly ? 0.01 : 0);
  if (ot.outfit === 'suit') {
    P.add('torso', G.cone4, '#f4f4f4', [0, T * 0.8, chestZ * 0.9], [sw * 0.4, T * 0.28, 0.02], [Math.PI, 0, 0]);
    P.add('torso', G.box, ot.tie, [0, T * 0.68, chestZ + 0.012], [bw * 0.13, T * 0.36, 0.01], [-0.12, 0, 0]);
  } else if (ot.outfit === 'police') {
    P.add('torso', G.sphLo, '#d4af37', [sw * 0.45, T * 0.82, chestZ * 0.98], [bw * 0.11, bw * 0.13, 0.012]);
  } else if (ot.outfit === 'worker') {
    P.add('torso', G.cyl, '#e8e8d0', [0, T * 0.62, 0], [sw * 1.01, T * 0.05, bd * 0.98]);
    P.add('torso', G.cyl, '#e8e8d0', [0, T * 0.38, 0], [bw * 1.02, T * 0.05, bd * 1.02]);
  } else if (ot.outfit === 'casual') {
    P.add('torso', G.cyl, shade(ot.top, 0.8), [0, T * 0.97, 0], [sw * 0.5, T * 0.04, bd * 0.55]); // 领口
  } else if (ot.outfit === 'dress') {
    P.add('torso', G.torus, '#f4f0e0', [0, T * 0.96, 0.0], [sw * 0.42, sw * 0.42, sw * 0.3], [Math.PI / 2 - 0.25, 0, 0]); // 项链
  }
  // 驼峰（衣服包着）
  if (ex.has('humps')) {
    P.add('torso', G.sph, ot.top, [0, T * 0.88, -bd * 0.75], [bw * 0.6, T * 0.25, bd * 0.6]);
    P.add('torso', G.sph, ot.top, [0, T * 0.55, -bd * 0.82], [bw * 0.55, T * 0.22, bd * 0.55]);
  }
  // 脖子
  const neckR = sp.neckR ?? hr * 0.5 * Math.min(hsx, 1.0);
  const neckTop = T + neck + hr * hsy * 0.5;
  P.add('torso', G.cyl, fur, [0, (T * 0.85 + neckTop) / 2, -0.005], [neckR, neckTop - T * 0.85, neckR * 0.95]);
  if (ex.has('wool')) {
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; P.add('torso', G.sphLo, sp.wool, [Math.sin(a) * neckR * 1.3, T * 0.98, Math.cos(a) * neckR * 1.2], [neckR * 0.55, neckR * 0.5, neckR * 0.55]); }
  }
  if (ex.has('stripes') && neck > 0.02) {
    for (let i = 0; i < 4; i++) { const y = T + 0.01 + (neck + hr * 0.4) * (i + 0.5) / 4; P.add('torso', G.cylLo, stripe, [0, y, -0.005], [neckR * 1.04, 0.012, neckR * 1.0], [0.25, 0, 0]); }
  }
  if (ex.has('spots') && neck > 0.1) {
    const rr = rng(7);
    for (let i = 0; i < 26; i++) {
      const y = T + 0.02 + (neck + hr * 0.3) * rr(); const a = rr() * Math.PI * 2;
      P.add('torso', G.sphLo, spot, [Math.sin(a) * neckR * 0.96, y, Math.cos(a) * neckR * 0.92 - 0.005], [neckR * 0.38, neckR * 0.38, neckR * 0.38]);
    }
  }
  if (ex.has('maneStrip')) {
    const mc = sp.maneCol || stripe || dark;
    const n = 6;
    for (let i = 0; i < n; i++) { const y = T * 0.95 + (neck + hr * hsy * 1.4) * i / (n - 1); P.add('torso', G.box, mc, [0, y, -neckR * 0.95], [neckR * 0.25, (neck + hr * 2) / n * 1.3, neckR * 0.5]); }
  }

  // ---- 头 ----
  const hc = [0, hr * hsy, 0];
  P.add('head', G.sph, fur, hc, [hr * hsx, hr * hsy, hr * hsz]);
  // 脸颊
  P.add('head', G.sph, light, [0, hc[1] - hr * hsy * 0.3, hr * hsz * 0.4], [hr * hsx * 0.72, hr * hsy * 0.55, hr * hsz * 0.62]);
  // 眼睛
  const eyeR = hr * (sp.snout === 'horse' || sp.snout === 'broad' ? 0.15 : 0.17);
  for (const sd of [1, -1]) {
    const ep = [sd * hr * hsx * 0.4, hc[1] + hr * hsy * 0.18, hr * hsz * 0.8];
    P.add('head', G.sphLo, '#ffffff', ep, [eyeR, eyeR * 1.1, eyeR * 0.8]);
    P.add('head', G.sphLo, '#1a1410', [ep[0] + sd * eyeR * 0.05, ep[1], ep[2] + eyeR * 0.55], [eyeR * 0.6, eyeR * 0.7, eyeR * 0.4]);
    // 眉毛
    P.add('head', G.box, shade(fur, 0.6), [ep[0], ep[1] + eyeR * 1.4, ep[2] + eyeR * 0.1], [eyeR * 1.4, eyeR * 0.3, eyeR * 0.4], [0, 0, -sd * 0.15]);
    if (ex.has('mask')) P.add('head', G.sph, sp.mask, [ep[0] + sd * eyeR * 0.3, ep[1] - eyeR * 0.3, ep[2] - eyeR * 0.3], [eyeR * 1.6, eyeR * 1.3, eyeR * 0.9], [0, 0, sd * 0.5]);
    if (ex.has('tearline')) P.add('head', G.box, sp.spot, [ep[0] + sd * eyeR * 0.2, ep[1] - eyeR * 1.6, ep[2] + eyeR * 0.1], [eyeR * 0.25, eyeR * 1.8, eyeR * 0.3], [0.3, 0, -sd * 0.15]);
  }
  // 口鼻
  const sz = hr * hsz, sy = hc[1] - hr * hsy * 0.25;
  const nose = sp.nose || '#1a1410';
  switch (sp.snout) {
    case 'short':
      P.add('head', G.sph, light, [0, sy, sz * 0.82], [hr * 0.38, hr * 0.3, hr * 0.3]);
      P.add('head', G.sphLo, nose, [0, sy + hr * 0.14, sz * 1.08], [hr * 0.1, hr * 0.08, hr * 0.07]);
      break;
    case 'canine': {
      const ln = hr * (sp.snoutLen ?? 1.2);
      P.add('head', G.cone, fur, [0, sy + hr * 0.08, sz * 0.7 + ln * 0.45], [hr * 0.42, ln, hr * 0.36], [Math.PI / 2, 0, 0]);
      P.add('head', G.cone, light, [0, sy - hr * 0.08, sz * 0.62 + ln * 0.42], [hr * 0.4, ln * 0.95, hr * 0.28], [Math.PI / 2, 0, 0]);
      P.add('head', G.sphLo, nose, [0, sy + hr * 0.12, sz * 0.7 + ln * 0.95], [hr * 0.12, hr * 0.1, hr * 0.1]);
      break;
    }
    case 'cat':
      for (const sd of [1, -1]) P.add('head', G.sph, light, [sd * hr * 0.2, sy, sz * 0.85], [hr * 0.26, hr * 0.22, hr * 0.22]);
      P.add('head', G.sphLo, light, [0, sy - hr * 0.2, sz * 0.8], [hr * 0.2, hr * 0.14, hr * 0.15]);
      P.add('head', G.sphLo, nose, [0, sy + hr * 0.15, sz * 1.02], [hr * 0.14, hr * 0.09, hr * 0.08]);
      break;
    case 'horse': {
      const sc = sp.snoutCol || light;
      P.add('head', G.sph, fur, [0, sy + hr * 0.05, sz * 0.75], [hr * 0.5 * hsx, hr * 0.5, hr * 0.9]);
      P.add('head', G.sph, sc, [0, sy - hr * 0.1, sz * 1.45], [hr * 0.5 * hsx, hr * 0.45, hr * 0.42]);
      for (const sd of [1, -1]) P.add('head', G.sphLo, '#1a1410', [sd * hr * 0.2, sy - hr * 0.02, sz * 1.82], [hr * 0.08, hr * 0.06, hr * 0.05]);
      break;
    }
    case 'broad': {
      const k = sp.snoutBig ?? 1;
      const sc = sp.snoutCol || light;
      P.add('head', G.sph, sc, [0, sy - hr * 0.08 * k, sz * 0.78], [hr * 0.75 * k, hr * 0.5 * k, hr * 0.55 * k]);
      for (const sd of [1, -1]) P.add('head', G.sphLo, '#1a1410', [sd * hr * 0.28 * k, sy + hr * 0.12 * k, sz * 0.78 + hr * 0.5 * k], [hr * 0.08, hr * 0.06, hr * 0.05]);
      if (k > 1.2) for (const sd of [1, -1]) P.add('head', G.cone4, '#f4f0e0', [sd * hr * 0.35, sy - hr * 0.35, sz * 1.1], [hr * 0.06, hr * 0.14, hr * 0.06], [Math.PI, 0, 0]);
      break;
    }
    case 'disc':
      P.add('head', G.cyl, sp.snoutCol, [0, sy, sz * 0.98], [hr * 0.36, hr * 0.3, hr * 0.28], [Math.PI / 2, 0, 0]);
      for (const sd of [1, -1]) P.add('head', G.sphLo, '#7a3a40', [sd * hr * 0.12, sy, sz * 0.98 + hr * 0.15], [hr * 0.06, hr * 0.09, hr * 0.03]);
      break;
    case 'bear':
      P.add('head', G.sph, light, [0, sy - hr * 0.05, sz * 0.82], [hr * 0.45, hr * 0.36, hr * 0.45]);
      P.add('head', G.sphLo, nose, [0, sy + hr * 0.12, sz * 1.22], [hr * 0.17, hr * 0.12, hr * 0.1]);
      break;
    case 'pointy': {
      const ln = hr * (sp.snoutLen ?? 0.9);
      P.add('head', G.cone, fur, [0, sy, sz * 0.7 + ln * 0.45], [hr * 0.38, ln, hr * 0.3], [Math.PI / 2, 0, 0]);
      P.add('head', G.sphLo, nose, [0, sy, sz * 0.7 + ln * 0.95], [hr * 0.09, hr * 0.08, hr * 0.08]);
      break;
    }
    case 'beaver':
      P.add('head', G.sph, light, [0, sy, sz * 0.82], [hr * 0.45, hr * 0.32, hr * 0.32]);
      P.add('head', G.sphLo, nose, [0, sy + hr * 0.16, sz * 1.12], [hr * 0.14, hr * 0.09, hr * 0.07]);
      P.add('head', G.box, '#fff4d0', [0, sy - hr * 0.3, sz * 1.08], [hr * 0.26, hr * 0.26, hr * 0.06]);
      break;
    case 'flat': {
      const k = sp.noseBig ?? 1;
      P.add('head', G.sph, light, [0, sy - hr * 0.02, sz * 0.7], [hr * 0.5, hr * 0.4, hr * 0.35]);
      P.add('head', G.sph, nose, [0, sy + hr * 0.08, sz * 0.98], [hr * 0.13 * k, hr * 0.15 * k, hr * 0.09 * k]);
      break;
    }
    case 'trunk': {
      // 象鼻：一串递减的椭球沿曲线
      const pts = [[0, sy + hr * 0.05, sz * 0.82], [0, sy - hr * 0.35, sz * 1.05], [0, sy - hr * 0.85, sz * 1.12], [0, sy - hr * 1.3, sz * 1.05], [0, sy - hr * 1.65, sz * 1.15], [0, sy - hr * 1.85, sz * 1.38]];
      for (let i = 0; i < pts.length - 1; i++) {
        const rad = hr * (0.3 - i * 0.04);
        P.between('head', G.sph, fur, pts[i], pts[i + 1], rad, 0.62);
      }
      P.add('head', G.cyl, shade(fur, 0.8), pts[pts.length - 1], [hr * 0.1, hr * 0.06, hr * 0.1], [-0.9, 0, 0]);
      break;
    }
  }
  // 嘴巴
  if (sp.snout !== 'trunk' && sp.snout !== 'beaver') P.add('head', G.box, '#4a2a2a', [0, sy - hr * 0.22, sz * 0.92], [hr * 0.25, hr * 0.03, hr * 0.05]);
  if (ex.has('tusks')) for (const sd of [1, -1]) {
    P.along('head', G.cone, '#f4f0e0', [sd * hr * 0.32, sy - hr * 0.25, sz * 0.75], hr * 0.75, hr * 0.08, hr * 0.08, [1.2, 0, sd * 0.15]);
  }

  // 耳朵
  const topY = hc[1] + hr * hsy;
  const ey = hc[1] + hr * hsy * 0.75;
  const inner = sp.inner || light;
  for (const sd of [1, -1]) {
    switch (sp.ears) {
      case 'long': {
        const ln = hr * sp.earLen;
        P.along('head', G.sph, fur, [sd * hr * 0.35, topY - hr * 0.15, -hr * 0.1], ln, hr * 0.22, hr * 0.09, [-0.12, 0, -sd * 0.15]);
        P.along('head', G.sph, inner, [sd * hr * 0.35, topY - hr * 0.05, -hr * 0.03], ln * 0.85, hr * 0.13, hr * 0.05, [-0.12, 0, -sd * 0.15]);
        break;
      }
      case 'pointy': {
        const ln = hr * sp.earLen;
        P.along('head', G.cone, fur, [sd * hr * 0.5, ey, -hr * 0.1], ln, hr * 0.32, hr * 0.12, [-0.1, 0, -sd * 0.3]);
        P.along('head', G.cone, inner, [sd * hr * 0.5, ey, -hr * 0.03], ln * 0.8, hr * 0.2, hr * 0.06, [-0.1, 0, -sd * 0.3]);
        if (sp.dark) P.along('head', G.cone, sp.dark, [sd * (hr * 0.5 + Math.sin(sd * 0.3) * ln * 0.62), ey + ln * 0.62 * Math.cos(0.3), -hr * 0.1 - ln * 0.06], ln * 0.4, hr * 0.14, hr * 0.13, [-0.1, 0, -sd * 0.3]);
        break;
      }
      case 'horse':
        P.along('head', G.cone, fur, [sd * hr * 0.45, ey, -hr * 0.15], hr * 1.0, hr * 0.25, hr * 0.12, [-0.1, 0, -sd * 0.45]);
        break;
      case 'round':
        P.add('head', G.sph, fur, [sd * hr * 0.62 * hsx, ey + hr * 0.12, -hr * 0.1], [hr * 0.28, hr * 0.28, hr * 0.1], [0, 0, -sd * 0.4]);
        P.add('head', G.sphLo, sp.stripe || dark, [sd * hr * 0.62 * hsx, ey + hr * 0.12, -hr * 0.15], [hr * 0.22, hr * 0.22, hr * 0.06], [0, 0, -sd * 0.4]);
        break;
      case 'big':
        P.add('head', G.sph, fur, [sd * hr * 0.8, ey + hr * 0.15, -hr * 0.1], [hr * 0.55, hr * 0.55, hr * 0.14], [0, -sd * 0.2, -sd * 0.3]);
        P.add('head', G.sph, sp.earFluff ? '#f0f0f2' : inner, [sd * hr * 0.82, ey + hr * 0.15, -hr * 0.02], [hr * 0.4, hr * 0.4, hr * 0.08], [0, -sd * 0.2, -sd * 0.3]);
        break;
      case 'side':
        P.add('head', G.sph, fur, [sd * hr * 1.0 * hsx, ey - hr * 0.05, -hr * 0.1], [hr * 0.38, hr * 0.13, hr * 0.12], [0, 0, sd * 0.35]);
        P.add('head', G.sphLo, inner, [sd * hr * 1.05 * hsx, ey - hr * 0.05, -hr * 0.04], [hr * 0.28, hr * 0.08, hr * 0.06], [0, 0, sd * 0.35]);
        break;
      case 'pig':
        P.along('head', G.cone, fur, [sd * hr * 0.55, ey, 0], hr * 0.55, hr * 0.28, hr * 0.08, [0.7, 0, -sd * 0.5]);
        break;
      case 'flap':
        P.add('head', G.sph, fur, [sd * hr * 1.05, hc[1] - hr * 0.05, -hr * 0.25], [hr * 0.12, hr * 1.0, hr * 0.8], [0, sd * 0.5, sd * 0.1]);
        P.add('head', G.sph, '#c9a0a8', [sd * hr * 1.08, hc[1] - hr * 0.05, -hr * 0.18], [hr * 0.05, hr * 0.8, hr * 0.62], [0, sd * 0.5, sd * 0.1]);
        break;
      case 'tiny':
        P.add('head', G.sphLo, fur, [sd * hr * 0.75 * hsx, ey, -hr * 0.15], [hr * 0.16, hr * 0.16, hr * 0.08], [0, 0, -sd * 0.5]);
        break;
    }
  }
  // 头部特征
  if (ex.has('mane')) {
    const mc = sp.mane;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      P.add('head', G.sph, mc, [Math.sin(a) * hr * 0.95, hc[1] + Math.cos(a) * hr * 0.95, -hr * 0.35], [hr * 0.55, hr * 0.55, hr * 0.5]);
    }
    P.add('head', G.sph, mc, [0, hc[1] - hr * 0.2, -hr * 0.6], [hr * 1.35, hr * 1.4, hr * 0.7]);
    P.add('head', G.sph, mc, [0, hc[1] + hr * 0.75, hr * 0.3], [hr * 0.45, hr * 0.3, hr * 0.45]);
    P.add('head', G.sph, mc, [0, -hr * 0.2, -hr * 0.1], [hr * 0.9, hr * 0.5, hr * 0.7]);
  }
  if (ex.has('stripes')) {
    for (let i = 0; i < 3; i++) P.add('head', G.box, stripe, [0, topY - hr * (0.08 + i * 0.22), hr * hsz * (0.55 - i * 0.05)], [hr * 0.12, hr * 0.06, hr * 0.5], [0.6 + i * 0.3, 0, 0]);
    for (const sd of [1, -1]) for (let i = 0; i < 3; i++) P.add('head', G.box, stripe, [sd * hr * hsx * 0.92, hc[1] + hr * (0.3 - i * 0.28), hr * 0.05], [hr * 0.25, hr * 0.06, hr * 0.5], [0, 0, sd * 0.4]);
  }
  if (ex.has('spots') && sp.spot) {
    const rr = rng(13);
    for (let i = 0; i < 14; i++) {
      const th = rr() * Math.PI * 2, ph = rr() * Math.PI * 0.6 + 0.2;
      const dz = Math.cos(th) * Math.sin(ph); if (dz > 0.75) continue;
      P.add('head', G.sphLo, sp.spot, [Math.sin(th) * Math.sin(ph) * hr * hsx * 0.97, hc[1] + Math.cos(ph) * hr * hsy * 0.97, dz * hr * hsz * 0.97], [hr * 0.08, hr * 0.08, hr * 0.08]);
    }
  }
  if (ex.has('ossicones')) for (const sd of [1, -1]) {
    P.along('head', G.cyl, fur, [sd * hr * 0.3, topY - hr * 0.1, -hr * 0.1], hr * 0.7, hr * 0.09, hr * 0.09, [-0.2, 0, -sd * 0.15]);
    P.add('head', G.sphLo, '#5a3418', [sd * (hr * 0.3 + hr * 0.1), topY + hr * 0.55, -hr * 0.22], [hr * 0.14, hr * 0.14, hr * 0.14]);
  }
  if (ex.has('horns')) for (const sd of [1, -1]) {
    // 角根 → 向外 → 向上弯
    P.add('head', G.sph, sp.horn, [sd * hr * 0.35, topY - hr * 0.1, -hr * 0.05], [hr * 0.38, hr * 0.2, hr * 0.3]);
    const a = [sd * hr * 0.5, topY - hr * 0.1, -hr * 0.05], b = [sd * hr * 1.25, topY - hr * 0.2, -hr * 0.1], c = [sd * hr * 1.55, topY + hr * 0.45, -hr * 0.15];
    P.between('head', G.cyl, sp.horn, a, b, hr * 0.17, 1);
    P.add('head', G.sph, sp.horn, b, [hr * 0.17, hr * 0.17, hr * 0.17]);
    P.between('head', G.cone, shade(sp.horn, 0.9), b, c, hr * 0.17, 1);
  }
  if (ex.has('wool')) {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      P.add('head', G.sphLo, sp.wool, [Math.sin(a) * hr * 0.55, topY - hr * 0.05 + Math.cos(a) * hr * 0.12, Math.cos(a) * hr * 0.4 - hr * 0.1], [hr * 0.38, hr * 0.32, hr * 0.38]);
    }
  }
  if (ot.hat) {
    P.add('head', G.hemi, ot.vest === '#e8d020' ? '#ff9a20' : '#f2d22a', [0, topY - hr * 0.25, 0], [hr * 1.08 * hsx, hr * 0.75, hr * 1.08 * hsz]);
    P.add('head', G.cyl, ot.vest === '#e8d020' ? '#ff9a20' : '#f2d22a', [0, topY - hr * 0.25, hr * 0.15], [hr * 1.15 * hsx, hr * 0.05, hr * 1.25 * hsz]);
  }

  // ---- 手臂 ----
  const sleeveUp = ot.sleeve === 'none' ? fur : (ot.outfit === 'worker' ? ot.top : ot.top);
  const sleeveLo = ot.sleeve === 'long' ? (ot.outfit === 'worker' ? ot.top : ot.top) : limbFur;
  P.add('upperArm', G.sph, sleeveUp, [0, -upLen / 2, 0], [ar * 1.05, upLen / 2 + ar * 0.5, ar * 1.05]);
  P.add('upperArm', G.sph, sleeveUp, [0, -ar * 0.2, 0], [ar * 1.25, ar * 1.2, ar * 1.25]); // 肩
  P.add('lowerArm', G.sph, sleeveLo, [0, -loLen / 2, 0], [ar * 0.92, loLen / 2 + ar * 0.4, ar * 0.92]);
  const handCol = isHoof ? hoofCol : (sp.darkLimbs ? dark : fur);
  P.add('lowerArm', G.sph, handCol, [0, -loLen - ar * 0.3, ar * 0.1], [ar * 1.1, ar * 1.25, ar * 0.95]);
  if (ex.has('claws')) for (let i = -1; i <= 1; i++) P.along('lowerArm', G.cone4, '#e8e0cc', [i * ar * 0.5, -loLen - ar * 1.2, ar * 0.3], ar * 1.4, ar * 0.15, ar * 0.15, [Math.PI - 0.4, 0, 0]);
  if (stripe && ot.sleeve !== 'long') for (let i = 0; i < 3; i++) {
    const f = -0.5 + (i + 0.5) / 3 * 0.9; const hl = loLen / 2 + ar * 0.4;
    P.add('lowerArm', G.cylLo, stripe, [0, -loLen / 2 + f * hl, 0], [ar * 0.95 * Math.sqrt(1 - f * f) + ar * 0.03, ar * 0.25, ar * 0.95 * Math.sqrt(1 - f * f) + ar * 0.03], [0.3, 0, 0]);
  }
  if (spot && ot.sleeve !== 'long') {
    const rr = rng(21);
    for (let i = 0; i < 5; i++) { const a = rr() * Math.PI * 2, f = rr() * 1.2 - 0.6; const hl = loLen / 2 + ar * 0.4; const rad = ar * 0.92 * Math.sqrt(1 - f * f); P.add('lowerArm', G.sphLo, spot, [Math.sin(a) * rad, -loLen / 2 + f * hl, Math.cos(a) * rad], [ar * 0.22, ar * 0.22, ar * 0.22]); }
  }

  // ---- 腿 ----
  const thighCol = ot.outfit === 'dress' ? limbFur : ot.pants;
  const shinCol = (ot.outfit === 'dress' || ot.shorts) ? limbFur : ot.pants;
  P.add('thigh', G.sph, thighCol, [0, -legSeg / 2, 0], [lr, legSeg / 2 + lr * 0.4, lr]);
  P.add('shin', G.sph, shinCol, [0, -legSeg / 2, 0], [lr * 0.82, legSeg / 2 + lr * 0.3, lr * 0.82]);
  if (ot.shorts) P.add('thigh', G.cyl, ot.pants, [0, -legSeg * 0.85, 0], [lr * 0.95, lr * 0.5, lr * 0.95]);
  if (stripe && (ot.outfit === 'dress' || ot.shorts)) for (let i = 0; i < 3; i++) {
    const f = -0.5 + (i + 0.5) / 3 * 0.9;
    P.add('shin', G.cylLo, stripe, [0, -legSeg / 2 + f * (legSeg / 2 + lr * 0.3), 0], [lr * 0.84 * Math.sqrt(1 - f * f) + 0.002, lr * 0.25, lr * 0.84 * Math.sqrt(1 - f * f) + 0.002], [0.3, 0, 0]);
  }
  // 脚（挂在小腿下，脚踝 y = -legSeg）
  const ay = -legSeg;
  if (sp.feet === 'hoof') {
    P.add('shin', G.cyl, hoofCol, [0, ay - footH * 0.3, lr * 0.15], [lr * 0.85, footH * 1.4, lr * 0.95]);
  } else {
    const flen = sp.feet === 'big' ? 0.24 : 0.13;
    const fcol = ot.outfit === 'suit' ? '#1a1a1a' : (sp.darkLimbs ? dark : fur);
    P.add('shin', G.sph, fcol, [0, ay - footH * 0.25, flen * 0.32], [lr * 0.85, footH * 0.95, flen * 0.55]);
  }

  // ---- 尾巴（挂在胯后方，沿 +Y 建，骨骼旋转使其朝后下方） ----
  const tc = sp.tailCol || fur;
  switch (sp.tail) {
    case 'puff': P.add('tail', G.sph, sp.wool || '#f4f2f0', [0, 0.02, 0], [0.05, 0.05, 0.05]); break;
    case 'bushy':
      P.along('tail', G.sph, fur, [0, 0, 0], 0.22, 0.055, 0.06, [0, 0, 0]);
      P.along('tail', G.sph, fur, [0, 0.12, 0], 0.22, 0.08, 0.085, [0.2, 0, 0]);
      P.along('tail', G.sph, light, [0, 0.3, 0.035], 0.12, 0.055, 0.06, [0.35, 0, 0]);
      break;
    case 'long': {
      const k = sp.tailThick ?? 1;
      P.along('tail', G.sph, fur, [0, 0, 0], 0.3, 0.02 * k, 0.02 * k, [0, 0, 0]);
      P.along('tail', G.sph, stripe ? stripe : fur, [0, 0.27, 0], 0.18, 0.017 * k, 0.017 * k, [0.6, 0, 0]);
      if (stripe) for (let i = 0; i < 3; i++) P.add('tail', G.cylLo, stripe, [0, 0.06 + i * 0.07, 0], [0.021 * k, 0.012, 0.021 * k]);
      if (spot) for (let i = 0; i < 3; i++) P.add('tail', G.cylLo, spot, [0, 0.06 + i * 0.07, 0], [0.021 * k, 0.01, 0.021 * k]);
      break;
    }
    case 'thin':
      P.along('tail', G.cyl, tc, [0, 0, 0], 0.32, 0.012, 0.012, [0, 0, 0]);
      P.along('tail', G.cyl, tc, [0, 0.31, 0], 0.22, 0.008, 0.008, [0.7, 0, 0]);
      break;
    case 'tuft':
      P.along('tail', G.cyl, fur, [0, 0, 0], 0.22, 0.012, 0.012, [0, 0, 0]);
      P.add('tail', G.sph, sp.tuft || dark, [0, 0.24, 0], [0.025, 0.045, 0.025]);
      break;
    case 'flat':
      P.along('tail', G.sph, tc, [0, 0, 0], 0.26, 0.07, 0.022, [0, 0, 0]);
      break;
    case 'curly':
      P.add('tail', G.torus, fur, [0, 0.04, 0], [0.025, 0.025, 0.025], [0, Math.PI / 2, 0]);
      break;
    case 'stub':
      P.add('tail', G.sph, fur, [0, 0.02, 0], [0.035, 0.04, 0.035]);
      break;
  }

  return {
    geos: P.build(),
    dims: { L, T, hr, hsy, neck, bw, bd, sw, legSeg, lr, ar, upLen, loLen, footH },
  };
}

const _geoCache = new Map();

/**
 * 创建一个动物 NPC。
 * @param {string} species SPECIES 中的 key
 * @param {{color?:string|number, outfit?:'casual'|'suit'|'police'|'worker'|'dress', outfitColor?:string|number, seed?:number}} opts
 */
export function createAnimal(species, opts = {}) {
  const sp = SP[species] || SP.rabbit;
  const key = SP[species] ? species : 'rabbit';
  const h = HEIGHT[key];
  const seed = opts.seed ?? ((Math.random() * 1e9) | 0);
  const r = rng(seed * 2654435761 + 17);
  r(); r();
  // 毛色：覆盖或在 3 档明暗里取（保证缓存命中率）
  const furShade = [0.9, 1.0, 1.08][Math.floor(r() * 3)];
  const fur = opts.color != null ? '#' + new THREE.Color(opts.color).getHexString() : shade(sp.fur, furShade);
  const light = opts.color != null ? shade(fur, 1.25) : sp.light;
  const outfitColor = opts.outfitColor != null ? '#' + new THREE.Color(opts.outfitColor).getHexString() : undefined;
  const ot = resolveOutfit(key, { ...opts, outfitColor }, r);

  const ck = `${key}|${fur}|${light}|${JSON.stringify(ot)}`;
  let built = _geoCache.get(ck);
  if (!built) { built = buildGeometry(key, sp, fur, light, ot); _geoCache.set(ck, built); }
  const { geos, dims } = built;
  const mat = npcMaterial();
  const mk = (bone) => {
    const m = new THREE.Mesh(geos[bone], mat);
    m.castShadow = true; m.receiveShadow = false;
    return m;
  };

  const root = new THREE.Group();
  root.name = `animal_${key}`;
  const rig = new THREE.Group();
  rig.scale.setScalar(h);
  root.add(rig);

  const hips = new THREE.Group(); hips.position.y = dims.L; rig.add(hips);
  hips.add(mk('hips'));
  const torso = new THREE.Group(); hips.add(torso);
  torso.add(mk('torso'));
  const head = new THREE.Group(); head.position.set(0, dims.T + dims.neck, 0); torso.add(head);
  head.add(mk('head'));

  const arms = [];
  for (const side of [1, -1]) {
    const upper = new THREE.Group();
    upper.position.set(side * (dims.sw * 0.98 + dims.ar * 0.3), dims.T * 0.82, 0);
    upper.rotation.z = side * (0.07 + (sp.belly ? 0.12 * sp.belly : 0));
    torso.add(upper); upper.add(mk('upperArm'));
    const lower = new THREE.Group(); lower.position.y = -dims.upLen; lower.rotation.x = -0.12; upper.add(lower);
    lower.add(mk('lowerArm'));
    arms.push({ upper, lower, side });
  }
  const legs = [];
  for (const side of [1, -1]) {
    const thigh = new THREE.Group(); thigh.position.set(side * dims.bw * 0.5, 0, 0); hips.add(thigh);
    thigh.add(mk('thigh'));
    const shin = new THREE.Group(); shin.position.y = -dims.legSeg; thigh.add(shin);
    shin.add(mk('shin'));
    legs.push({ thigh, shin, side });
  }
  const tail = [];
  if (geos.tail) {
    const tg = new THREE.Group();
    tg.position.set(0, dims.T * 0.02, -dims.bd * 0.88);
    tg.rotation.x = sp.tail === 'flat' ? -2.55 : sp.tail === 'puff' || sp.tail === 'stub' || sp.tail === 'curly' ? -1.57 : sp.tail === 'bushy' ? -2.1 : -2.3;
    hips.add(tg); tg.add(mk('tail'));
    tail.push(tg);
  }

  const anim = makeRigAnimator({ root, hips, torso, head, arms, legs, tail }, {
    hipY: dims.L, legLen: dims.L, scale: h, sitY: dims.legSeg + dims.footH, armOut: 0.0, tailSway: 1,
  });

  root.userData = {
    species: key,
    name: SPECIES.find(s => s.key === key).name,
    height: h,
    outfit: ot.outfit,
    seed,
    bones: { rig, hips, torso, head, arms, legs, tail },
    update: anim.update,
    setPose: anim.setPose,
    getPose: anim.getPose,
  };
  anim.update(0.016, 0);
  return root;
}
