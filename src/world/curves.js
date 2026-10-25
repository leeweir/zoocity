// 弧形大道：打破正交路网，参考 GTA 城市里斜穿街区的弧形主干道 / 盘山路。
// 在各地区建造之前登记「走廊」，建造期间落在走廊里的高出地面的几何体与碰撞体会被剔除（见 main.js），
// 然后在走廊里铺设真正的曲线道路：路面、路缘、人行道、车道线、路灯、行道树，并提供车流采样。
import * as THREE from 'three';

const ROAD_TOP = 0.17;       // 路面高度：略高于原路网人行道，交叉处无缝覆盖
const ROAD_W = 16;           // 机动车道宽
const WALK_W = 3.4;          // 两侧人行道
export const CORRIDOR = ROAD_W / 2 + WALK_W + 2.2;   // 走廊半宽（含行道树带）

function arc(cx, cz, r, a0, a1, step = 10) {
  const n = Math.max(4, Math.round(Math.abs(a1 - a0) * r / step));
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
  return pts;
}
function wave(x0, x1, zc, amp, period, phase = 0, step = 10) {
  const pts = [];
  for (let x = x0; x <= x1 + 0.01; x += step) pts.push([x, zc + Math.sin((x - x0) / period * Math.PI * 2 + phase) * amp]);
  return pts;
}

// 圆心放在街区角上，半径 200：经计算避开了 ZPD、车站、车管所、市政厅、博物馆、冰淇淋店与啮齿镇
export const CURVES = [
  { key: 'nwArc', name: '月牙大道', pts: arc(-280, -280, 168, 0, Math.PI / 2), color: '#ffffff' },
  { key: 'swArc', name: '日落弧线大道', pts: arc(-280, 280, 200, -Math.PI / 2, 0), color: '#ffffff' },
  { key: 'seArc', name: '湖畔弧线大道', pts: arc(280, 280, 200, Math.PI, Math.PI * 1.5), color: '#ffffff' },
  { key: 'jungle', name: '雨林盘山路', pts: wave(-880, -420, 214, 28, 300, 0.4), color: '#ffffff' },
  { key: 'dune', name: '沙丘弯道', pts: wave(420, 840, -410, 18, 260, 1.2), color: '#ffffff' },
].map(c => {
  // 预计算累积里程
  const cum = [0];
  for (let i = 1; i < c.pts.length; i++) cum.push(cum[i - 1] + Math.hypot(c.pts[i][0] - c.pts[i - 1][0], c.pts[i][1] - c.pts[i - 1][1]));
  return { ...c, cum, length: cum[cum.length - 1] };
});

// 点到折线距离
function distToCurve(c, x, z) {
  let best = Infinity;
  const p = c.pts;
  for (let i = 0; i < p.length - 1; i++) {
    const ax = p[i][0], az = p[i][1], bx = p[i + 1][0], bz = p[i + 1][1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) best = d;
  }
  return best;
}

// 轴对齐矩形是否与某条走廊相交（用矩形内采样点 + 折线点落入矩形两种检测）
export function corridorHits(x0, z0, x1, z1) {
  for (const c of CURVES) {
    // 快速包围盒剔除
    if (!c.bb) {
      let a = Infinity, b = Infinity, d = -Infinity, e = -Infinity;
      for (const [x, z] of c.pts) { a = Math.min(a, x); b = Math.min(b, z); d = Math.max(d, x); e = Math.max(e, z); }
      c.bb = [a - CORRIDOR, b - CORRIDOR, d + CORRIDOR, e + CORRIDOR];
    }
    if (x1 < c.bb[0] || x0 > c.bb[2] || z1 < c.bb[1] || z0 > c.bb[3]) continue;
    // 折线点落在（扩展后的）矩形内
    for (const [x, z] of c.pts) if (x > x0 - CORRIDOR && x < x1 + CORRIDOR && z > z0 - CORRIDOR && z < z1 + CORRIDOR) {
      // 精确：矩形最近点到该点距离
      const cx = Math.max(x0, Math.min(x1, x)), cz = Math.max(z0, Math.min(z1, z));
      if (Math.hypot(cx - x, cz - z) < CORRIDOR) return true;
    }
    // 大矩形：采样网格点
    const nx = Math.min(12, Math.ceil((x1 - x0) / 8)), nz = Math.min(12, Math.ceil((z1 - z0) / 8));
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
      const x = x0 + (x1 - x0) * i / Math.max(1, nx), z = z0 + (z1 - z0) * j / Math.max(1, nz);
      if (distToCurve(c, x, z) < CORRIDOR) return true;
    }
  }
  return false;
}

export function curveAt(x, z) {
  for (const c of CURVES) if (distToCurve(c, x, z) < CORRIDOR) return c;
  return null;
}

// 沿曲线 s 米处采样
export function sampleCurve(c, s) {
  s = Math.max(0, Math.min(c.length, s));
  let i = 1;
  while (i < c.cum.length - 1 && c.cum[i] < s) i++;
  const a = c.pts[i - 1], b = c.pts[i];
  const seg = c.cum[i] - c.cum[i - 1] || 1;
  const t = (s - c.cum[i - 1]) / seg;
  const dx = (b[0] - a[0]) / seg, dz = (b[1] - a[1]) / seg;
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, y: ROAD_TOP, tanx: dx, tanz: dz, nx: -dz, nz: dx };
}

// 建造期间的剔除钩子：高出地面的物体若压在走廊上则丢弃
export function shouldReject(x0, z0, x1, z1, top) {
  return top > 0.32 && corridorHits(x0, z0, x1, z1);
}

// 点是否落在原正交路网的车道上（路灯/行道树要避开交叉口）
function onGridRoad(layout, x, z) {
  const hw = layout.ROAD_W / 2 + 1.2;
  for (const D of Object.values(layout.DISTRICTS)) {
    const r = D.rect;
    if (x < r.x0 - 2 || x > r.x1 + 2 || z < r.z0 - 2 || z > r.z1 + 2) continue;
    if (D.roadsX.some(v => Math.abs(x - v) < hw) || D.roadsZ.some(v => Math.abs(z - v) < hw)) return true;
  }
  return [...layout.CONNECTORS, ...(layout.FRONTAGE || [])].some(c => Math.abs(c.x1 - c.x2) < 1 ? Math.abs(x - c.x1) < hw && z > Math.min(c.z1, c.z2) && z < Math.max(c.z1, c.z2) : Math.abs(z - c.z1) < hw && x > Math.min(c.x1, c.x2) && x < Math.max(c.x1, c.x2));
}

export function buildCurves(ctx) {
  const { b, col, layout } = ctx;
  const ASPH = 0x3f4248, WALK = 0xc9c2b2, CURB = 0xe9e4d6;
  for (const c of CURVES) {
    const p = c.pts;
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = p[i], [bx, bz] = p[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const ry = Math.atan2(bx - ax, bz - az);
      const nx = Math.cos(ry), nz = -Math.sin(ry);           // 右法线
      const L = len + 1.2;                                   // 稍长一点，拐角处不留缝
      // 路基 + 沥青
      b.box(ROAD_W + WALK_W * 2 + 1, ROAD_TOP - 0.02, L, mx, 0, mz, 0x8f8a7c, { ry, shadow: false });
      b.box(ROAD_W, 0.04, L, mx, ROAD_TOP - 0.03, mz, ASPH, { ry, shadow: false });
      // 双黄中线
      for (const o of [-0.18, 0.18]) b.box(0.14, 0.02, L, mx + nx * o, ROAD_TOP + 0.01, mz + nz * o, 0xf2c94c, { ry, shadow: false });
      // 白色虚线车道分隔
      if (i % 2 === 0) for (const o of [-ROAD_W / 4, ROAD_W / 4]) b.box(0.14, 0.02, len * 0.55, mx + nx * o, ROAD_TOP + 0.01, mz + nz * o, 0xf4f4f4, { ry, shadow: false });
      // 两侧路缘 + 人行道
      for (const sg of [-1, 1]) {
        const ox = nx * sg, oz = nz * sg;
        b.box(0.4, 0.14, L, mx + ox * (ROAD_W / 2 + 0.2), ROAD_TOP - 0.02, mz + oz * (ROAD_W / 2 + 0.2), CURB, { ry, shadow: false });
        b.box(WALK_W, 0.1, L, mx + ox * (ROAD_W / 2 + WALK_W / 2 + 0.3), ROAD_TOP, mz + oz * (ROAD_W / 2 + WALK_W / 2 + 0.3), WALK, { ry, shadow: false, jitter: 0.06 });
        // 外侧绿化带
        b.box(2.2, 0.12, L, mx + ox * (ROAD_W / 2 + WALK_W + 1.4), 0, mz + oz * (ROAD_W / 2 + WALK_W + 1.4), c.key === 'dune' ? 0xd8b878 : 0x6e9b4f, { ry, shadow: false });
      }
      // 路灯（交错）与行道树
      if (i % 3 === 0) {
        const sg = (i / 3) % 2 ? 1 : -1;
        const lx = mx + nx * sg * (ROAD_W / 2 + 0.9), lz = mz + nz * sg * (ROAD_W / 2 + 0.9);
        if (!onGridRoad(layout, lx, lz)) {
        b.cyl(0.12, 0.16, 7, lx, ROAD_TOP, lz, 0x5b6068, { mat: 'metal', seg: 8 });
        b.box(0.25, 0.18, 2.6, lx - nx * sg * 1.1, ROAD_TOP + 6.9, lz - nz * sg * 1.1, 0x5b6068, { ry: ry + Math.PI / 2, shadow: false });
        b.sphere(0.35, lx - nx * sg * 2.2, ROAD_TOP + 6.75, lz - nz * sg * 2.2, 0xfff0c0, { mat: 'glow', seg: 8 });
        col.circle(lx, lz, 0.25, { yMax: 7 });
        }
      }
      if (i % 2 === 1) for (const sg of [-1, 1]) {
        const tx = mx + nx * sg * (ROAD_W / 2 + WALK_W + 1.4), tz = mz + nz * sg * (ROAD_W / 2 + WALK_W + 1.4);
        if (onGridRoad(layout, tx, tz)) continue;
        if (c.key === 'dune') {
          b.cyl(0.25, 0.35, 6, tx, 0, tz, 0x8a6a45, { seg: 6, rz: 0.08 * sg });
          for (let k = 0; k < 6; k++) b.box(0.4, 0.1, 3.2, tx + Math.cos(k) * 1.2, 6, tz + Math.sin(k) * 1.2, 0x4f8f3a, { ry: k, rx: 0.4, mat: 'leaf', shadow: false });
        } else {
          b.cyl(0.25, 0.32, 3.4, tx, 0.1, tz, 0x6b4a2e, { seg: 6 });
          b.sphere(2.1, tx, 4.6, tz, c.key === 'jungle' ? 0x2f7a3a : 0x5d9a48, { mat: 'leaf', seg: 7, sy: 0.85 });
        }
        col.circle(tx, tz, 0.4, { yMax: 4 });
      }
      // 可站立路面
      col.slab(ax, az, ROAD_TOP, bx, bz, ROAD_TOP, ROAD_W + WALK_W * 2 + 0.6);
    }
    // 起止端与中点立路牌
    const mid = sampleCurve(c, c.length / 2);
    ctx.addLabel(mid.x, 6, mid.z, c.name, '#ffd34d');
    for (const s of [6, c.length - 6]) {
      const q = sampleCurve(c, s);
      const sx = q.x + q.nx * (ROAD_W / 2 + 1.2), sz = q.z + q.nz * (ROAD_W / 2 + 1.2);
      b.cyl(0.08, 0.08, 3.4, sx, ROAD_TOP, sz, 0x6b7078, { mat: 'metal', seg: 6 });
      if (ctx.tex?.signMesh) {
        const m = ctx.tex.signMesh(c.name, 3.2, { bg: '#1f6b3a', fg: '#ffffff', border: '#ffffff' });
        m.position.set(sx, ROAD_TOP + 3.8, sz);
        m.rotation.y = Math.atan2(q.tanx, q.tanz) + Math.PI / 2;
        ctx.scene.add(m);
      }
    }
  }
}
