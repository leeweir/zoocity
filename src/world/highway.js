// 高架快速路（GTA 风格的城市环线）：沿城市外圈铺设，圆角转弯、匝道上下、跨运河、桥墩，
// 桥上/桥下都有车流。
import * as THREE from 'three';
import { Builder, rng } from '../core/builder.js';

export const DECK_W = 20;      // 桥面宽（双向四车道）
const DECK_T = 0.6;            // 桥面板厚
const RAIL_H = 1.1;

// 圆角矩形环线：半边长 R，圆角半径 C
function loopPoints() {
  const R = 322, C = 70;
  const pts = [];
  let n = 0;
  const push = (x, z) => pts.push(new THREE.Vector3(x, 0, z));
  const line = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), segs = Math.max(1, Math.round(len / 24));
    for (let i = 0; i < segs; i++) push(x0 + (x1 - x0) * i / segs, z0 + (z1 - z0) * i / segs);
  };
  const arc = (cx, cz, a0, a1) => {
    const segs = Math.max(2, Math.round(Math.abs(a1 - a0) * C / 24));
    for (let i = 0; i < segs; i++) {
      const a = a0 + (a1 - a0) * i / segs;
      push(cx + Math.cos(a) * C, cz + Math.sin(a) * C);
    }
  };
  const H = Math.PI / 2;
  line(-R + C, -R, R - C, -R);            // 北：向东
  arc(R - C, -R + C, -H, 0);
  line(R, -R + C, R, R - C);              // 东：向南
  arc(R - C, R - C, 0, H);
  line(R - C, R, -R + C, R);              // 南：向西
  arc(-R + C, R - C, H, 2 * H);
  line(-R, R - C, -R, -R + C);            // 西：向北
  arc(-R + C, -R + C, 2 * H, 3 * H);
  // 高度起伏（整圈平滑）
  const total = pts.length;
  pts.forEach((p, i) => { p.y = 10 + Math.sin(i / total * Math.PI * 4) * 1.6 + Math.cos(i / total * Math.PI * 6) * 0.6; });
  return pts;
}

export const LOOP = (() => {
  const pts = loopPoints();
  // 采样为等距折线
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = a.distanceTo(b);
    const n = Math.max(1, Math.round(len / 24));
    for (let k = 0; k < n; k++) out.push(a.clone().lerp(b, k / n));
  }
  // 高度轻微平滑
  for (let pass = 0; pass < 3; pass++) {
    const hs = out.map(p => p.y);
    out.forEach((p, i) => { p.y = (hs[(i + out.length - 1) % out.length] + hs[i] * 2 + hs[(i + 1) % out.length]) / 4; });
  }
  return out;
})();

// 沿环线在第 t 米处采样 {x,z,y,tanx,tanz}
let _cum = null, _len = 0;
function cum() {
  if (_cum) return _cum;
  _cum = [0];
  for (let i = 0; i < LOOP.length; i++) _cum.push(_cum[i] + Math.hypot(LOOP[(i + 1) % LOOP.length].x - LOOP[i].x, LOOP[(i + 1) % LOOP.length].z - LOOP[i].z));
  _len = _cum[_cum.length - 1];
  return _cum;
}
export function loopLength() { cum(); return _len; }

// 沿环线（水平）里程 s 处采样，返回位置、高度、切线和法线
export function sampleLoop(sMeters) {
  const C = cum(), total = _len;
  const s = ((sMeters % total) + total) % total;
  let lo = 0, hi = LOOP.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (C[m] <= s) lo = m; else hi = m - 1; }
  const i = lo, j = (i + 1) % LOOP.length;
  const a = LOOP[i], b = LOOP[j];
  const seg = C[i + 1] - C[i] || 1, t = (s - C[i]) / seg;
  const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
  return { x: a.x + dx * t, z: a.z + dz * t, y: a.y + (b.y - a.y) * t, tanx: dx / l, tanz: dz / l, nx: -dz / l, nz: dx / l };
}

// 出入口（互通）：每边 2 个，固定在直线段上，坡道沿桥平行内侧落地，落点正好接外环辅路。
// at: 环线上直线段的投影坐标；dir: 下坡方向（沿环线 +1/-1）。
// 起点用 (x,z) 指定，运行时换算成环线里程。
export const EXITS = [
  { x: -150, z: -322, dir: 1, name: '北一出口 · 车站 / 车管所' },
  { x: 110, z: -322, dir: 1, name: '北二出口 · ZPD / 冰川镇' },
  { x: 322, z: -160, dir: 1, name: '东一出口 · 撒哈拉北' },
  { x: 322, z: 110, dir: 1, name: '东二出口 · 撒哈拉南 / 啮齿镇' },
  { x: 150, z: 322, dir: 1, name: '南一出口 · 博物馆 / 兔窝镇' },
  { x: -110, z: 322, dir: 1, name: '南二出口 · 市政厅' },
  { x: -322, z: 190, dir: 1, name: '西一出口 · 雨林南' },
  { x: -322, z: -110, dir: 1, name: '西二出口 · 雨林北 / 冰川镇' },
];
export const RAMPS = EXITS;
const RAMP_LEN = 110;

// 环线上离 (x,z) 最近点的里程
export function loopSAt(x, z) {
  let best = 0, bd = Infinity, acc = 0;
  for (let i = 0; i < LOOP.length; i++) {
    const a = LOOP[i], b = LOOP[(i + 1) % LOOP.length];
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1e-6, l = Math.sqrt(l2);
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
    const d = (a.x + dx * t - x) ** 2 + (a.z + dz * t - z) ** 2;
    if (d < bd) { bd = d; best = acc + l * t; }
    acc += l;
  }
  return best;
}

// 出口坡道中线（地面落点 + 桥面起点），供建造、地图、车流共用
export function exitPath(e) {
  const s0 = loopSAt(e.x, e.z);
  const p = sampleLoop(s0);
  // 内侧（朝城市中心）法线
  const inSign = (p.nx * -p.x + p.nz * -p.z) > 0 ? 1 : -1;
  const ix = p.nx * inSign, iz = p.nz * inSign;
  // 坡道落点正好在外环辅路上：北/东/西 15m；南侧桥在运河上方，落到滨河路（36m）
  const south = Math.abs(p.z - 322) < 5;
  const off = south ? 36 : 15;
  const merge = south ? 0.45 : 0.2;
  const pts = [];
  const N = 18;
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const q = sampleLoop(s0 + e.dir * RAMP_LEN * t);
    const start = DECK_W / 2 - 4.5;
    const lat = start + (off - start) * THREE.MathUtils.smoothstep(t, 0, merge);
    const y = p.y * (1 - THREE.MathUtils.smootherstep(t, 0.08, 1));
    pts.push({ x: q.x + ix * lat, z: q.z + iz * lat, y: Math.max(0.03, y) });
  }
  return { pts, inX: ix, inZ: iz, s0 };
}

export function buildHighway(ctx) {
  const { b, col } = ctx;
  const total = loopLength();
  const rand = rng(20242);
  const w2 = DECK_W / 2;

  // 出口并入段（里程区间）：这些段的内侧护栏不建，坡道从这里分流
  const gaps = EXITS.map(e => { const s0 = loopSAt(e.x, e.z); return e.dir > 0 ? [s0 - 6, s0 + RAMP_LEN * 0.5] : [s0 - RAMP_LEN * 0.5, s0 + 6]; });
  let accS = 0;
  // ── 桥面：分段薄板 + 顶点色 ──
  for (let i = 0; i < LOOP.length; i++) {
    const a = LOOP[i], bb = LOOP[(i + 1) % LOOP.length];
    const len = a.distanceTo(bb);
    const mx = (a.x + bb.x) / 2, mz = (a.z + bb.z) / 2, my = (a.y + bb.y) / 2;
    const ry = Math.atan2(bb.x - a.x, bb.z - a.z);
    const hl = Math.hypot(bb.x - a.x, bb.z - a.z);
    const segS0 = accS, segS1 = accS + hl; accS += hl;
    const inGap = gaps.some(([g0, g1]) => segS1 > g0 && segS0 < g1);
    b.box(DECK_W, DECK_T, len + 0.6, mx, my - DECK_T, mz, 0x54565e, { ry, mat: 'solid', shadow: false });
    // 沥青面
    b.box(DECK_W - 1.2, 0.08, len + 0.6, mx, my, mz, 0x35373d, { ry, shadow: false });
    // 可站立碰撞面
    col.slab(a.x, a.z, a.y, bb.x, bb.z, bb.y, DECK_W - 1.6);
    // 中央分隔带 + 车道线
    b.box(0.7, 0.22, len + 0.6, mx, my + 0.08, mz, 0xe8e4d8, { ry, shadow: false });
    for (const off of [-2.6, 2.6]) {
      const nx = -Math.cos(ry), nz = Math.sin(ry);
      b.box(0.16, 0.03, len * 0.5, mx + nx * off * 2.2, my + 0.09, mz + nz * off * 2.2, 0xf2c94c, { ry, shadow: false, mat: 'glow' });
    }
    // 护栏（两侧）：梁 + 立柱
    for (const sgn of [-1, 1]) {
      const nx = -Math.cos(ry) * 0, nz = 0;
      const ox = Math.cos(ry) * 0, oz = 0;
      const px = mx + Math.sin(ry + Math.PI / 2) * sgn * (w2 - 0.5);
      const pz = mz + Math.cos(ry + Math.PI / 2) * sgn * (w2 - 0.5);
      const inner = (px * px + pz * pz) < (mx * mx + mz * mz);
      if (inGap && inner) continue;
      b.box(0.35, RAIL_H, len + 0.6, px, my, pz, 0xd8dde3, { ry, mat: 'metal', shadow: false });
      b.box(0.5, 0.16, len + 0.6, px, my + RAIL_H, pz, 0xf07f2a, { ry, shadow: false });
      // 护栏做碰撞（玩家/车不会从桥上掉下去）
      col.box(px, pz, 0.6, len * 1.02, { ry, yMin: my - 0.4, yMax: my + RAIL_H });
      // 灯柱
      if (i % 3 === 0) {
        b.cyl(0.16, 0.2, 5.2, px, my + 0.1, pz, 0x8a9099, { mat: 'metal', seg: 8 });
        b.sphere(0.42, px, my + 5.3, pz, 0xfff0b8, { mat: 'glow', seg: 8 });
        b.box(0.9, 0.14, 1.5, px - Math.sin(ry + Math.PI / 2) * sgn * 0.4, my + 5.5, pz - Math.cos(ry + Math.PI / 2) * sgn * 0.4, 0x5a5f66, { ry, shadow: false });
      }
    }
    // 桥墩：每 3 段一个；避开主干道（x≈0 / z≈0 以及各区间连接路）
    const onMainRoad = Math.abs(mx) < 12 || Math.abs(mz) < 12 || Math.abs(mx) > 300 || Math.abs(mz) > 300;
    if (i % 3 === 1 && my > 0.5 && !onMainRoad) {
      b.box(3.2, my - 0.6, 2.2, mx, 0, mz, 0x9a9d9f, { ry, shadow: false });
      b.box(5.0, 0.9, 3.0, mx, my - 1.5, mz, 0x9a9d9f, { ry, shadow: false });
      col.box(mx, mz, 3.4, 2.4, { ry, yMin: 0, yMax: my - 0.5 });
      // 桥墩上的涂鸦条
      b.box(3.22, 0.5, 2.24, mx, 1.6, mz, 0xc94b7a, { ry, shadow: false, jitter: 0.3 });
    }
  }

  // ── 出口坡道 + 指示牌 ──
  for (const e of EXITS) {
    const { pts, inX, inZ, s0 } = exitPath(e);
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], c = pts[k + 1];
      const L = Math.hypot(c.x - a.x, c.z - a.z);
      const ry = Math.atan2(c.x - a.x, c.z - a.z);
      const mx = (a.x + c.x) / 2, mz = (a.z + c.z) / 2, my = (a.y + c.y) / 2;
      b.box(9, 0.5, L + 0.5, mx, my - 0.5, mz, 0x54565e, { ry, shadow: false });
      b.box(8.4, 0.07, L + 0.5, mx, my, mz, 0x35373d, { ry, shadow: false });
      col.slab(a.x, a.z, a.y, c.x, c.z, c.y, 8.2);
      // 坡道上的发光箭头（每隔两段）
      if (k % 2 === 0 && k > 1) b.box(1.2, 0.03, 2.8, mx, my + 0.06, mz, 0x6fe36f, { ry, mat: 'glow', shadow: false });
      // 外侧护栏（靠桥一侧前段与桥面相连不加）
      for (const sg of [-1, 1]) {
        if (k < 3 && sg * ((Math.cos(ry) * inX) - (Math.sin(ry) * inZ)) < 0) continue;
        const px = mx + Math.cos(ry) * sg * 4.3, pz = mz - Math.sin(ry) * sg * 4.3;
        b.box(0.3, RAIL_H, L + 0.5, px, my, pz, 0xd8dde3, { ry, mat: 'metal', shadow: false });
        b.box(0.4, 0.14, L + 0.5, px, my + RAIL_H, pz, 0x2f9e44, { ry, shadow: false });
        if (my > 1.2) col.box(px, pz, 0.5, L * 1.05, { ry, yMin: my - 0.3, yMax: my + RAIL_H });
      }
      // 坡道支柱
      if (k % 3 === 1 && my > 2) b.box(1.6, my - 0.5, 1.6, mx, 0, mz, 0x9a9d9f, { shadow: false });
    }
    // 桥上提前 120m 和 40m 的绿色门架式指示牌（GTA 风格）
    for (const ahead of [120, 40]) {
      const q = sampleLoop(s0 - e.dir * ahead);
      const ry = Math.atan2(q.tanx * e.dir, q.tanz * e.dir);
      for (const sg of [-1, 1]) b.box(0.4, 7.4, 0.4, q.x + q.nx * sg * (DECK_W / 2 - 0.4), q.y, q.z + q.nz * sg * (DECK_W / 2 - 0.4), 0x7b828a, { mat: 'metal' });
      b.box(DECK_W, 0.5, 0.5, q.x, q.y + 7.2, q.z, 0x7b828a, { ry: ry + Math.PI / 2, mat: 'metal' });
      if (ctx.tex?.signMesh) {
        const txt = (ahead > 60 ? '前方 120m  ' : '出口 ↘  ') + e.name;
        const m = ctx.tex.signMesh(txt, 10, { bg: '#1f7a3a', fg: '#ffffff', border: '#ffffff', w: 1024, h: 160, font: 'bold 64px "PingFang SC","Microsoft YaHei",sans-serif' });
        m.position.set(q.x + inX * 4.5, q.y + 6.4, q.z + inZ * 4.5);
        m.rotation.y = ry + Math.PI;
        ctx.scene.add(m);
      }
    }
    // 地面入口也立一块牌
    const g = pts[pts.length - 1];
    if (ctx.tex?.signMesh) {
      const m = ctx.tex.signMesh('↗ 上环城高架', 4.5, { bg: '#1f7a3a', fg: '#ffffff', border: '#ffffff', w: 512, h: 128 });
      m.position.set(g.x + inX * 6, 3.4, g.z + inZ * 6);
      m.rotation.y = Math.atan2(-inX, -inZ);
      ctx.scene.add(m);
      b.cyl(0.1, 0.1, 3, g.x + inX * 6, 0, g.z + inZ * 6, 0x7b828a, { mat: 'metal', seg: 6 });
    }
    ctx.addLabel(g.x, 6, g.z, e.name, '#2f9e44');
  }

  // ── 桥下阴影感的支撑梁与围栏（防止玩家从下面穿模时看到空洞） ──
  b.userData = b.userData || {};

  // ── 环线上的任务/观景点标记 ──
  for (const [i, name] of [[0.06, '环城高架·北'], [0.3, '环城高架·东'], [0.55, '环城高架·南'], [0.8, '环城高架·西']]) {
    const p = sampleLoop(i * total);
    ctx.addLabel(p.x, p.y + 7, p.z, name, '#8fd3ff');
  }
  return { total };
}
