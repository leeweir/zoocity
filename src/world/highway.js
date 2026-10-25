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
export function sampleLoop(sMeters) {
  const total = loopLength();
  let s = ((sMeters % total) + total) % total;
  const step = 24;
  const i = Math.floor(s / step) % LOOP.length;
  const j = (i + 1) % LOOP.length;
  const a = LOOP[i], b = LOOP[j];
  const t = (s - Math.floor(s / step) * step) / Math.max(0.001, a.distanceTo(new THREE.Vector3(b.x, a.y, b.z)));
  const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.y + (b.y - a.y) * t;
  const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
  return { x, z, y, tanx: dx / l, tanz: dz / l, nx: -dz / l, nz: dx / l };
}
let _len = 0;
export function loopLength() {
  if (_len) return _len;
  for (let i = 0; i < LOOP.length; i++) _len += LOOP[i].distanceTo(LOOP[(i + 1) % LOOP.length]);
  return _len;
}

// 匝道定义：从环线某处（s 米）分出，斜向下坡到地面。
// side: +1 表示沿环线外侧（远离城市中心）方向。
export const RAMPS = [
  { s: 0.13, side: -1, name: 'ZPD 北匝道' },
  { s: 0.37, side: -1, name: '撒哈拉东匝道' },
  { s: 0.62, side: -1, name: '南岸匝道' },
  { s: 0.87, side: -1, name: '雨林西匝道' },
];

export function buildHighway(ctx) {
  const { b, col } = ctx;
  const total = loopLength();
  const rand = rng(20242);
  const w2 = DECK_W / 2;

  // ── 桥面：分段薄板 + 顶点色 ──
  for (let i = 0; i < LOOP.length; i++) {
    const a = LOOP[i], bb = LOOP[(i + 1) % LOOP.length];
    const len = a.distanceTo(bb);
    const mx = (a.x + bb.x) / 2, mz = (a.z + bb.z) / 2, my = (a.y + bb.y) / 2;
    const ry = Math.atan2(bb.x - a.x, bb.z - a.z);
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

  // ── 匝道：从桥面斜下到地面 ──
  for (const r of RAMPS) {
    const s0 = r.s * total;
    const p = sampleLoop(s0);
    const side = r.side;
    const outX = p.nx * side, outZ = p.nz * side;
    const segN = 14, rampLen = 95;
    let prev = { x: p.x + outX * (w2 - 2), z: p.z + outZ * (w2 - 2), y: p.y };
    for (let k = 1; k <= segN; k++) {
      const t = k / segN;
      const dist = t * rampLen;
      const x = prev.x + (p.tanx * 0.55 + outX * 0.85) * (rampLen / segN);
      const z = prev.z + (p.tanz * 0.55 + outZ * 0.85) * (rampLen / segN);
      const y = p.y * (1 - t) * (1 - t) - 0.2 + 0.2;
      const yy = Math.max(0, p.y * Math.pow(1 - t, 1.6));
      const ry = Math.atan2(x - prev.x, z - prev.z);
      const L = Math.hypot(x - prev.x, z - prev.z);
      const mx = (x + prev.x) / 2, mz = (z + prev.z) / 2, my = (y + prev.y) / 2;
      b.box(9, 0.5, L + 0.4, mx, my - 0.5, mz, 0x54565e, { ry, shadow: false });
      b.box(8.4, 0.07, L + 0.4, mx, my, mz, 0x35373d, { ry, shadow: false });
      col.slab(prev.x, prev.z, prev.y, x, z, yy, 8);
      // 侧护栏
      for (const sgn of [-1, 1]) {
        const px = mx + Math.sin(ry + Math.PI / 2) * sgn * 4.2;
        const pz = mz + Math.cos(ry + Math.PI / 2) * sgn * 4.2;
        b.box(0.3, RAIL_H, L + 0.4, px, my, pz, 0xd8dde3, { ry, mat: 'metal', shadow: false });
        col.box(px, pz, 0.5, L * 1.05, { ry, yMin: my - 0.3, yMax: my + RAIL_H });
      }
      prev = { x, z, y: yy };
    }
    // 匝道口的指示牌
    ctx.addLabel(p.x + outX * (w2 + 24), p.y + 8, p.z + outZ * (w2 + 24), r.name, '#f07f2a');
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
