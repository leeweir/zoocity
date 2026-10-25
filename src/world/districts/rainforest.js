// 雨林区 Rainforest District —— build(ctx) + POI
//
// 主要地标：
//   climateTower  雨林气候控制塔  中心 (-660, -80)，塔高 ~80m，入口广场 front (-660, -15)
//   canopyMarket  树冠集市        巨树 (-500, 75)；一层平台 y=8 (x -518..-482, z 57..93)，
//                                 二层平台 y=16 (x -511..-489, z 64..86)；
//                                 地面坡道 x -515..-509, z 27→57；二层坡道 z 87..92, x -484→-502；
//                                 吊桥（可行走）一层东侧 (-482,70) → 卫星树台 (-448,100) y=8
// 其它：瀑布 (-810, z -380)、英雄巨树树屋 (-810, 70)、东侧气候墙 x -345..-330（z=0 处 ±10m 开口）
//
// 注意：本区 rect 与冰川镇 rect 在 x>-700, z<-330 重叠，该重叠区留给冰川镇（本模块不建地面/道路/建筑）。
//       东西向道路 z=-300/-140/140 止于气候墙（x=-345），只有 z=0 穿过气候墙通道连接撒瓦纳。
//
// POI（给案件系统用，均为可站立、周围 3m 无碰撞体的点）：
//   climateTower  (-660, 0, -15)    气候塔入口广场
//   towerPlaza    (-645, 0, -44)    气候塔广场东侧
//   canopyMarket  (-500, 8, 63)     集市一层平台南侧（y=8）
//   marketTop     (-507, 16, 68)    集市二层平台西南角（y=16）
//   marketGate    (-500, 0, 15)     集市入口（front）
//   ropeBridge    (-465, 8, 85)     吊桥中段（y=8）
//   waterfall     (-810, 0, -345)   瀑布水潭前
//   bigTreeHouse  (-810, 0, 87)     英雄巨树脚下
//   mistyGrove    (-660, 0, 152)    迷雾树林路边
//   gate          (-355, 0, 0)      气候墙通道（道路上）

import * as THREE from 'three';

export const POI = {
  climateTower: { x: -660, y: 0, z: -15, label: '雨林气候控制塔' },
  towerPlaza: { x: -645, y: 0, z: -44, label: '气候塔广场' },
  canopyMarket: { x: -500, y: 8, z: 63, label: '树冠集市' },
  marketTop: { x: -507, y: 16, z: 68, label: '树冠集市·二层' },
  marketGate: { x: -500, y: 0, z: 15, label: '树冠集市入口' },
  ropeBridge: { x: -465, y: 8, z: 85, label: '树冠吊桥' },
  waterfall: { x: -810, y: 0, z: -345, label: '雨林瀑布' },
  bigTreeHouse: { x: -810, y: 0, z: 87, label: '巨树树屋' },
  mistyGrove: { x: -660, y: 0, z: 152, label: '迷雾树林' },
  gate: { x: -355, y: 0, z: 0, label: '雨林气候墙通道' },
};

const TAU = Math.PI * 2;

// —— 小工具纹理（DataTexture，不依赖 document）——
function dataTex(w, h, fn) {
  const d = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const [r, g, b, a] = fn(i, j);
    const k = (j * w + i) * 4;
    d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = a;
  }
  const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat);
  t.needsUpdate = true;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  return t;
}

export function build(ctx) {
  const { scene, b, col, layout } = ctx;
  const { DISTRICTS, LANDMARKS, ROAD_W, SIDEWALK_W } = layout;
  const D = DISTRICTS.rainforest;
  const R = D.rect;
  const HW = ROAD_W / 2;
  const SW = SIDEWALK_W;
  const rand = ctx.rng(7319);
  const rr = (a, c) => a + (c - a) * rand();
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const TUNDRA_X = -700, TUNDRA_Z = -330; // 与冰川镇重叠区
  const WALL_X0 = -345;
  const inOverlap = (x, z) => x > TUNDRA_X && z < TUNDRA_Z;
  const label = (x, y, z, t) => ctx.addLabel && ctx.addLabel(x, y, z, t, D.color);

  // ---------- 几何助手 ----------
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
  function addGeo(geo, x, y, z, sx, sy, sz, color, o = {}) {
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); _q.setFromEuler(_e);
    _m4.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
    b.add(geo, _m4, color, o);
  }
  // 两点之间的圆柱（p 端半径 rP，q 端半径 rQ）
  function seg(p, q, rP, rQ, color, o = {}) {
    const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-3) return;
    const rx = Math.acos(Math.max(-1, Math.min(1, dy / len)));
    const ry = Math.atan2(dx, dz);
    b.cyl(rQ, rP, len, p[0], p[1], p[2], color, { seg: 8, ...o, rx, ry });
  }
  // 局部坐标 → 世界（与 Builder / Colliders 的 ry 约定一致）
  function toW(x, z, ry, lx, lz) {
    const c = Math.cos(ry), s = Math.sin(ry);
    return [x + lx * c + lz * s, z - lx * s + lz * c];
  }
  // 朝向法线 (nx,nz) 的圆窗
  function roundWindow(x, y, z, nx, nz, r, frameCol) {
    const a = Math.atan2(nx, nz);
    b.cyl(r + 0.18, r + 0.18, 0.12, x, y, z, frameCol, { rx: Math.PI / 2, ry: a, seg: 8 });
    b.cyl(r, r, 0.2, x, y, z, 0x7fb4c8, { rx: Math.PI / 2, ry: a, seg: 8, mat: 'glass' });
  }
  const pyrG = new THREE.ConeGeometry(Math.SQRT2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0);
  const torusG = new THREE.TorusGeometry(1, 0.08, 6, 14);

  // 障碍记录（用于摆放植被/房屋时避让）
  const obst = []; // {x,z,r}
  const freeAt = (x, z, r) => {
    for (const o of obst) { const dx = x - o.x, dz = z - o.z; if (dx * dx + dz * dz < (r + o.r) ** 2) return false; }
    return true;
  };
  const keepClear = []; // 地标 front / POI 周围
  for (const p of Object.values(POI)) if (p.y === 0) keepClear.push({ x: p.x, z: p.z, r: 4 });
  const clearOK = (x, z, r) => keepClear.every(k => (x - k.x) ** 2 + (z - k.z) ** 2 > (r + k.r) ** 2);

  let animCount = 0;
  const anim = (fn) => { animCount++; ctx.animate(fn); };

  // ================= 地面 =================
  const GROUND = D.ground;
  // 西半部（x<-700）整段；东半部从 z=-330 开始（避开冰川镇重叠区）
  b.box(TUNDRA_X - R.x0, 0.012, R.z1 - R.z0, (R.x0 + TUNDRA_X) / 2, 0, (R.z0 + R.z1) / 2, GROUND, { jitter: 0.1 });
  b.box(R.x1 - TUNDRA_X, 0.012, R.z1 - TUNDRA_Z, (TUNDRA_X + R.x1) / 2, 0, (TUNDRA_Z + R.z1) / 2, GROUND, { jitter: 0.1 });

  // ================= 道路（湿润沥青） =================
  const ASPH = 0x2b2f33;
  // 与冰川镇重叠区内（x>-700, z<-330）的南北路段由冰川镇负责，这里从 z=-330 开始画
  for (const x of D.roadsX) {
    const rz0 = x > TUNDRA_X ? TUNDRA_Z : R.z0;
    b.box(ROAD_W, 0.022, R.z1 - rz0, x, 0, (rz0 + R.z1) / 2, ASPH, { mat: 'shiny', shadow: false });
    for (let z = rz0 + 3; z < R.z1 - 5; z += 9) {
      if (D.roadsZ.some(zr => Math.abs(z + 2 - zr) < HW + 3)) continue;
      b.box(0.25, 0.012, 4, x, 0.022, z + 2, 0xf2c94c, { shadow: false });
    }
  }
  // 东西向道路：只有 z=0 穿过气候墙通道，其余止于气候墙 (x=-345)
  for (const z of D.roadsZ) {
    const rx1 = z === 0 ? R.x1 : WALL_X0;
    b.box(rx1 - R.x0, 0.022, ROAD_W, (R.x0 + rx1) / 2, 0, z, ASPH, { mat: 'shiny', shadow: false });
    for (let x = R.x0 + 3; x < rx1 - 5; x += 9) {
      if (D.roadsX.some(xr => Math.abs(x + 2 - xr) < HW + 3)) continue;
      b.box(4, 0.012, 0.25, x + 2, 0.022, z, 0xf2c94c, { shadow: false });
    }
  }
  // 路口斑马线
  for (const x of D.roadsX) for (const z of D.roadsZ) {
    for (let k = -2; k <= 2; k++) {
      for (const s of [-1, 1]) {
        b.box(1.2, 0.012, 3, x + k * 2.4, 0.022, z + s * (HW + 1.8), 0xe8eee8, { shadow: false });
        b.box(3, 0.012, 1.2, x + s * (HW + 1.8), 0.022, z + k * 2.4, 0xe8eee8, { shadow: false });
      }
    }
  }

  // ================= 街区 =================
  const blocksRaw = layout.blocksOf('rainforest');
  const blocks = [];
  for (const bk of blocksRaw) {
    const c = { ...bk, roadW: bk.x0 > R.x0, roadE: bk.x1 < R.x1, roadN: bk.z0 > R.z0, roadS: bk.z1 < R.z1 };
    if (c.x1 > TUNDRA_X && c.z0 < TUNDRA_Z) { c.z0 = TUNDRA_Z + 4; c.roadN = false; }
    if (c.z1 - c.z0 < 10) continue;
    c.cx = (c.x0 + c.x1) / 2; c.cz = (c.z0 + c.z1) / 2; c.w = c.x1 - c.x0; c.d = c.z1 - c.z0;
    // 可建造区域（扣除人行道 / 边界 / 气候墙）
    c.ux0 = c.x0 + (c.roadW ? SW + 1.5 : 4);
    c.ux1 = c.roadE ? c.x1 - SW - 1.5 : WALL_X0 - 8;
    c.uz0 = c.z0 + (c.roadN ? SW + 1.5 : 4);
    c.uz1 = c.z1 - (c.roadS ? SW + 1.5 : 4);
    blocks.push(c);
  }

  // 人行道（高 0.15，可站立）+ 路灯
  const SIDE = 0x7d8a72, CURB = 0x9aa391;
  function lamp(x, z) {
    if (!clearOK(x, z, 3)) return;
    b.cyl(0.12, 0.18, 6.2, x, 0.15, z, 0x2f4a3a, { seg: 6, mat: 'metal' });
    b.box(0.12, 0.12, 1.4, x, 6.2, z, 0x2f4a3a, { mat: 'metal' });
    b.cone(0.9, 0.5, x, 6.2, z, 0x3f7a3a, { seg: 6, mat: 'leaf' });
    b.box(0.45, 0.4, 0.45, x, 5.8, z, 0xffe1a0, { mat: 'glow' });
    col.circle(x, z, 0.25, { yMax: 6.5 });
  }
  function sidewalk(x0, z0, x1, z1, curbSide) {
    const w = x1 - x0, d = z1 - z0;
    b.box(w, 0.15, d, (x0 + x1) / 2, 0, (z0 + z1) / 2, SIDE, { jitter: 0.06, shadow: false });
    col.box((x0 + x1) / 2, (z0 + z1) / 2, w, d, { yMax: 0.15, walkable: true });
    // 路缘石 + 路灯
    if (curbSide === 'x0' || curbSide === 'x1') {
      const cx = curbSide === 'x0' ? x0 + 0.15 : x1 - 0.15;
      b.box(0.3, 0.17, d, cx, 0, (z0 + z1) / 2, CURB, { shadow: false });
      const lx = curbSide === 'x0' ? x0 + 0.8 : x1 - 0.8;
      for (let z = z0 + 12; z < z1 - 6; z += 40) lamp(lx, z);
    } else {
      const cz = curbSide === 'z0' ? z0 + 0.15 : z1 - 0.15;
      b.box(w, 0.17, 0.3, (x0 + x1) / 2, 0, cz, CURB, { shadow: false });
      const lz = curbSide === 'z0' ? z0 + 0.8 : z1 - 0.8;
      for (let x = x0 + 12; x < x1 - 6; x += 40) lamp(x, lz);
    }
  }
  for (const c of blocks) {
    const ex1 = c.roadE ? c.x1 : WALL_X0;
    if (c.roadW) sidewalk(c.x0, c.z0, c.x0 + SW, c.z1, 'x0');
    if (c.roadE) sidewalk(c.x1 - SW, c.z0, c.x1, c.z1, 'x1');
    if (c.roadN) sidewalk(c.x0, c.z0, ex1, c.z0 + SW, 'z0');
    if (c.roadS) sidewalk(c.x0, c.z1 - SW, ex1, c.z1, 'z1');
  }

  // ================= 植物 & 道具 =================
  const LEAVES = [0x2f7d32, 0x3e8e3a, 0x2a6b2e, 0x4d9a3c, 0x1f5e2a, 0x5aa845];
  const BARK = [0x6b4a2f, 0x5d4030, 0x7a5636, 0x584231];
  const MOSS = 0x5f8f3a;

  function fern(x, z, s = 1) {
    const n = 6, a0 = rand() * TAU, col0 = pick(LEAVES);
    for (let i = 0; i < n; i++) {
      const a = a0 + i * TAU / n, len = 1.6 * s * rr(0.8, 1.2), tilt = 0.45;
      const ux = Math.sin(a), uz = Math.cos(a);
      b.box(0.45 * s, 0.04, len, x + ux * len * 0.45, 0.1 + len * 0.5 * Math.sin(tilt) - 0.2 * s, z + uz * len * 0.45, col0, { ry: a, rx: -tilt, mat: 'leaf', shadow: false });
    }
  }
  function elephantEar(x, z, s = 1) {
    const n = 3, c0 = pick(LEAVES);
    for (let i = 0; i < n; i++) {
      const a = rand() * TAU, h = rr(0.8, 2.2) * s, out = rr(0.6, 1.4) * s;
      const lx = x + Math.sin(a) * out, lz = z + Math.cos(a) * out;
      seg([x, 0, z], [lx, h, lz], 0.06 * s, 0.04 * s, 0x4c7d2c, { seg: 3 });
      b.sphere(1, lx + Math.sin(a) * 0.9 * s, h + 0.1, lz + Math.cos(a) * 0.9 * s, c0, { sx: 0.8 * s, sy: 0.06, sz: 1.4 * s, ry: a, rx: 0.35, mat: 'leaf', seg: 4 });
    }
  }
  function mushroom(x, z, s = 1, glow = false) {
    const h = rr(0.3, 0.9) * s;
    b.cyl(0.08 * s, 0.11 * s, h, x, 0, z, 0xeee2c8, { seg: 4 });
    b.sphere(rr(0.25, 0.45) * s, x, h, z, glow ? pick([0x6ff0ff, 0xc77dff, 0x9dff6a]) : pick([0xd9502f, 0xe7a03c, 0xb98a5e]), { sy: 0.5, seg: 6, mat: glow ? 'glow' : 'solid' });
  }
  function bush(x, z, s = 1) {
    const c0 = pick(LEAVES);
    for (let i = 0; i < 2; i++) b.sphere(rr(0.9, 1.5) * s, x + rr(-1, 1) * s, rr(0.4, 0.9) * s, z + rr(-1, 1) * s, c0, { seg: 6, mat: 'leaf', sy: 0.75 });
  }
  function rock(x, z, s = 1, collide = false) {
    b.sphere(s, x, s * 0.25, z, pick([0x6f7468, 0x5d6b56, 0x7c7f72]), { sy: 0.6, seg: 6, jitter: 0.2 });
    b.sphere(s * 0.7, x, s * 0.62, z, MOSS, { sy: 0.25, seg: 6, mat: 'leaf' });
    if (collide) col.circle(x, z, s * 0.9, { yMax: s * 0.8, walkable: true });
  }
  function smallPalm(x, z, h = 4) {
    const lean = rr(-0.15, 0.15);
    seg([x, 0, z], [x + lean * h, h, z], 0.22, 0.16, 0x8a6a45, { seg: 6 });
    const tx = x + lean * h;
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 + rand();
      b.sphere(1, tx + Math.sin(a) * 1.4, h - 0.2, z + Math.cos(a) * 1.4, pick(LEAVES), { sx: 0.35, sy: 0.05, sz: 1.8, ry: a, rx: 0.4, seg: 4, mat: 'leaf' });
    }
    col.circle(x, z, 0.3, { yMax: h });
  }

  // —— 巨树 ——
  function rAt(t, y) { // 树干在高度 y 处的半径
    const k = Math.min(1, y / t.h);
    return k < 0.5 ? t.r * (1 - 0.44 * k) : t.r * (0.78 - 0.56 * (k - 0.5));
  }
  function giantTree(x, z, r, h, opts = {}) {
    const bark = pick(BARK);
    const t = { x, z, r, h };
    b.cyl(r * 0.78, r, h * 0.5, x, 0, z, bark, { seg: 10, jitter: 0.12 });
    b.cyl(r * 0.5, r * 0.78, h * 0.5, x, h * 0.5, z, bark, { seg: 10, jitter: 0.12 });
    // 板根
    const a0 = rand() * TAU;
    for (let i = 0; i < 5; i++) {
      const a = a0 + i * TAU / 5 + rr(-0.2, 0.2);
      seg([x + Math.cos(a) * r * 0.55, r * 1.9, z + Math.sin(a) * r * 0.55], [x + Math.cos(a) * r * 2.2, 0, z + Math.sin(a) * r * 2.2], r * 0.42, r * 0.1, bark, { seg: 6 });
    }
    // 苔藓环
    for (let i = 0; i < 3; i++) {
      const y = rr(2, h * 0.6), rad = rAt(t, y);
      b.cyl(rad * 1.04, rad * 1.06, rr(0.6, 1.6), x, y, z, MOSS, { seg: 10, mat: 'leaf' });
    }
    // 枝干 + 树冠
    const nB = opts.branches || (4 + Math.floor(rand() * 3));
    const ends = [];
    for (let i = 0; i < nB; i++) {
      const a = (i / nB) * TAU + rr(-0.3, 0.3), yb = h * rr(0.55, 0.85);
      const reach = r * 1.6 + rr(8, 15), ey = Math.min(h + 4, yb + rr(4, 10));
      const ex = x + Math.cos(a) * reach, ez = z + Math.sin(a) * reach;
      seg([x + Math.cos(a) * rAt(t, yb) * 0.4, yb, z + Math.sin(a) * rAt(t, yb) * 0.4], [ex, ey, ez], r * 0.32, r * 0.12, bark, { seg: 6 });
      ends.push([ex, ey, ez, a]);
      const lc = pick(LEAVES);
      for (let k = 0; k < 2; k++) b.sphere(rr(7, 11) + r * 0.6, ex + rr(-4, 4), ey + rr(0, 3), ez + rr(-4, 4), lc, { sy: 0.42, mat: 'leaf', seg: 8 });
      // 下垂大叶
      for (let k = 0; k < 2; k++) {
        const la = a + rr(-1, 1), lr = rr(6, 11);
        b.sphere(1, ex + Math.cos(la) * lr, ey - 1.5, ez + Math.sin(la) * lr, pick(LEAVES), { sx: 1.4, sy: 0.08, sz: 3.6, ry: Math.atan2(Math.cos(la), Math.sin(la)), rx: 0.6, mat: 'leaf', seg: 4 });
      }
      // 藤蔓
      for (let k = 0; k < 1 + (rand() < 0.5); k++) {
        const vx = ex + rr(-5, 5), vz = ez + rr(-5, 5), L = rr(8, Math.max(9, ey - 6));
        seg([vx, ey - 1, vz], [vx + rr(-0.6, 0.6), ey - 1 - L, vz + rr(-0.6, 0.6)], 0.12, 0.07, 0x3d6b2a, { seg: 4 });
        b.sphere(0.6, vx, ey - 1 - L * 0.5, vz, 0x3f8a35, { seg: 4, mat: 'leaf' });
        b.sphere(0.5, vx, ey - 1 - L * 0.9, vz, 0x4f9a3a, { seg: 4, mat: 'leaf' });
      }
    }
    // 顶冠
    const tc = pick(LEAVES);
    b.sphere(r * 2 + 8, x, h + 2, z, tc, { sy: 0.45, mat: 'leaf', seg: 10 });
    b.sphere(r + 6, x + rr(-4, 4), h + 6, z + rr(-4, 4), pick(LEAVES), { sy: 0.5, mat: 'leaf', seg: 8 });
    // 脚下植物
    for (let i = 0; i < 5; i++) {
      const a = rand() * TAU, d = r * 2.4 + rr(0.5, 4);
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (!clearOK(px, pz, 1.5)) continue;
      if (i % 2) fern(px, pz, rr(0.8, 1.3)); else elephantEar(px, pz, rr(0.9, 1.5));
    }
    col.circle(x, z, r * 1.12, { yMax: h });
    obst.push({ x, z, r: r * 2.3 });
    t.ends = ends;
    t.houses = [];
    return t;
  }

  // —— 环树树屋 ——
  const WALLS = [0xd9c49a, 0x8fb7a0, 0xc98b5a, 0xe0b06a, 0x9fb36a, 0xb7795a];
  const ROOFS = [0x5c7f3a, 0x7a4a2e, 0x3f6f5f, 0x8a5a33, 0x4e7a33];
  const WOOD = 0x8a6239, WOOD_D = 0x5e4127;
  function treeHouse(t, y, stairs) {
    const rT = rAt(t, y), rh = rT + 3.2, rd = rh + 2.4;
    const { x, z } = t;
    // 平台 + 支撑
    b.cyl(rd, rd, 0.4, x, y - 0.4, z, WOOD, { seg: 12 });
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6;
      seg([x + Math.cos(a) * rAt(t, y - 5), y - 5, z + Math.sin(a) * rAt(t, y - 5)], [x + Math.cos(a) * (rd - 0.4), y - 0.4, z + Math.sin(a) * (rd - 0.4)], 0.22, 0.18, WOOD_D, { seg: 5 });
    }
    // 栏杆
    const nP = 10;
    for (let i = 0; i < nP; i++) {
      const a = i * TAU / nP, a2 = (i + 1) * TAU / nP;
      const px = x + Math.cos(a) * (rd - 0.2), pz = z + Math.sin(a) * (rd - 0.2);
      b.box(0.15, 1.1, 0.15, px, y, pz, WOOD_D);
      const qx = x + Math.cos(a2) * (rd - 0.2), qz = z + Math.sin(a2) * (rd - 0.2);
      seg([px, y + 1.05, pz], [qx, y + 1.05, qz], 0.06, 0.06, WOOD_D, { seg: 4 });
    }
    // 房身
    const wc = pick(WALLS);
    b.cyl(rh, rh, 4.2, x, y, z, wc, { seg: 12, jitter: 0.08 });
    b.cyl(rh + 0.1, rh + 0.1, 0.35, x, y + 4.0, z, WOOD_D, { seg: 12 });
    // 屋顶（茅草）+ 苔藓
    b.cone(rh + 1.8, 3.6, x, y + 4.3, z, pick(ROOFS), { seg: 12, mat: 'leaf' });
    for (let i = 0; i < 4; i++) {
      const a = rand() * TAU;
      b.sphere(1.1, x + Math.cos(a) * (rh + 0.6), y + 4.8, z + Math.sin(a) * (rh + 0.6), MOSS, { sy: 0.35, seg: 6, mat: 'leaf' });
    }
    // 圆窗 + 门
    const nW = 5, wa0 = rand() * TAU;
    for (let i = 0; i < nW; i++) {
      const a = wa0 + i * TAU / (nW + 1);
      roundWindow(x + Math.cos(a) * rh, y + 2.3, z + Math.sin(a) * rh, Math.cos(a), Math.sin(a), 0.55, WOOD_D);
    }
    const da = wa0 + nW * TAU / (nW + 1);
    b.box(1.3, 2.4, 0.3, x + Math.cos(da) * rh, y, z + Math.sin(da) * rh, 0x4a3020, { ry: Math.atan2(Math.cos(da), Math.sin(da)) });
    b.sphere(0.22, x + Math.cos(da) * (rh + 0.5), y + 2.9, z + Math.sin(da) * (rh + 0.5), 0xffd080, { seg: 6, mat: 'glow' });
    // 螺旋楼梯（视觉）
    if (stairs) {
      const n = Math.ceil(y / 0.55), th0 = rand() * TAU;
      for (let i = 0; i < n; i++) {
        const th = th0 + i * 0.22, hy = i * (y / n);
        const rs = Math.max(rAt(t, hy), t.r * 0.9) + 0.9 + (hy < t.r * 1.9 ? t.r * 1.1 * (1 - hy / (t.r * 1.9)) : 0);
        b.box(1.7, 0.14, 0.65, t.x + Math.cos(th) * rs, hy, t.z + Math.sin(th) * rs, WOOD, { ry: -th });
      }
    }
    t.houses.push({ y, rd });
  }

  // —— 吊桥（视觉，可选 sag） ——
  function ropeBridge(p, q, y1, y2, sag = 1.2, width = 2.2) {
    const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len, nx = -uz, nz = ux;
    const heading = Math.atan2(dx, dz);
    const n = Math.ceil(len / 0.65);
    const Y = (t) => y1 + (y2 - y1) * t - sag * 4 * t * (1 - t);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      b.box(width, 0.1, 0.45, p[0] + dx * t, Y(t) - 0.1, p[1] + dz * t, i % 3 ? WOOD : 0x9b7444, { ry: heading, shadow: false });
    }
    const S = 10;
    for (const side of [-1, 1]) {
      const ox = nx * side * width * 0.5, oz = nz * side * width * 0.5;
      for (let i = 0; i < S; i++) {
        const t0 = i / S, t1 = (i + 1) / S;
        const a = [p[0] + dx * t0 + ox, Y(t0) + 1.1 + sag * 0.15 * 4 * t0 * (1 - t0), p[1] + dz * t0 + oz];
        const c = [p[0] + dx * t1 + ox, Y(t1) + 1.1 + sag * 0.15 * 4 * t1 * (1 - t1), p[1] + dz * t1 + oz];
        seg(a, c, 0.05, 0.05, 0xc9b38a, { seg: 4, shadow: false });
        seg([a[0], Y(t0), a[2]], [a[0], a[1], a[2]], 0.03, 0.03, 0xc9b38a, { seg: 3, shadow: false });
      }
      // 桥头柱
      b.cyl(0.18, 0.22, 1.6, p[0] + ox, y1 - 0.1, p[1] + oz, WOOD_D, { seg: 6 });
      b.cyl(0.18, 0.22, 1.6, q[0] + ox, y2 - 0.1, q[1] + oz, WOOD_D, { seg: 6 });
    }
    // 桥上小灯笼
    for (let t = 0.25; t < 0.9; t += 0.25) b.sphere(0.2, p[0] + dx * t + nx * width * 0.5, Y(t) + 0.95, p[1] + dz * t + nz * width * 0.5, 0xffc36b, { seg: 6, mat: 'glow' });
  }

  // —— 高脚木屋 ——
  function stiltHouse(x, z, w, d, ry) {
    const sh = rr(2.2, 3.2), hh = rr(3.6, 5), rh = rr(2.4, 3.4);
    const wc = pick(WALLS), rc = pick(ROOFS);
    // 高脚
    for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) {
      if (sz === 0 && w < 9) continue;
      const [px, pz] = toW(x, z, ry, sx * (w / 2 - 0.4), sz * (d / 2 - 0.4));
      b.cyl(0.22, 0.26, sh, px, 0, pz, WOOD_D, { seg: 6 });
    }
    b.box(w + 0.6, 0.35, d + 0.6, x, sh - 0.35, z, WOOD, { ry });
    b.box(w, hh, d, x, sh, z, wc, { ry, jitter: 0.06 });
    // 木框
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const [px, pz] = toW(x, z, ry, sx * w / 2, sz * d / 2);
      b.box(0.3, hh, 0.3, px, sh, pz, WOOD_D, { ry });
    }
    // 屋顶 + 苔藓
    addGeo(pyrG, x, sh + hh, z, w / 2 * 1.18, rh, d / 2 * 1.18, rc, { ry, mat: 'leaf' });
    for (let i = 0; i < 5; i++) {
      const [px, pz] = toW(x, z, ry, rr(-w / 2, w / 2) * 0.7, rr(-d / 2, d / 2) * 0.7);
      b.sphere(rr(0.6, 1.2), px, sh + hh + rh * 0.35, pz, MOSS, { sy: 0.3, seg: 6, mat: 'leaf' });
    }
    // 圆窗（四面）
    const wy = sh + hh * 0.55;
    const faces = [[0, d / 2, 0], [0, -d / 2, Math.PI], [w / 2, 0, Math.PI / 2], [-w / 2, 0, -Math.PI / 2]];
    faces.forEach(([lx, lz, fa], fi) => {
      const span = fi < 2 ? w : d;
      const nwin = Math.max(1, Math.floor(span / 3.5));
      for (let k = 0; k < nwin; k++) {
        const off = (k - (nwin - 1) / 2) * 3.2;
        if (fi === 0 && Math.abs(off) < 1.2 && nwin % 2) continue; // 门的位置
        const llx = fi < 2 ? off : lx, llz = fi < 2 ? lz : off;
        const [px, pz] = toW(x, z, ry, llx, llz);
        const a = ry + fa;
        roundWindow(px, wy, pz, Math.sin(a), Math.cos(a), 0.55, WOOD_D);
      }
    });
    // 门 + 门廊 + 台阶
    const [dx0, dz0] = toW(x, z, ry, 0, d / 2 + 0.05);
    b.box(1.2, 2.3, 0.2, dx0, sh, dz0, 0x4a3020, { ry });
    const [lpx, lpz] = toW(x, z, ry, 0.9, d / 2 + 0.35);
    b.sphere(0.2, lpx, sh + 2.6, lpz, 0xffd27a, { seg: 6, mat: 'glow' });
    const nS = Math.ceil(sh / 0.35);
    for (let i = 0; i < nS; i++) {
      const [px, pz] = toW(x, z, ry, 0, d / 2 + 0.6 + (nS - 1 - i) * 0.35);
      b.box(1.4, 0.12, 0.4, px, i * (sh / nS), pz, WOOD, { ry });
    }
    col.box(x, z, w + 0.6, d + 0.6, { ry, yMax: sh + hh + rh });
    obst.push({ x, z, r: Math.hypot(w, d) / 2 + 2.5 });
  }

  // —— 洒水塔（顶部旋转，独立动画对象） ——
  const sprayMat = new THREE.MeshBasicMaterial({ color: 0xcfefff, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x5d7f86, roughness: 0.35, metalness: 0.8 });
  const sprayG = new THREE.ConeGeometry(1, 1, 8, 1, true);
  function sprinklerTower(x, z, h = 20) {
    const C = 0x587a7e;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      seg([x + sx * 2.2, 0, z + sz * 2.2], [x + sx * 0.8, h, z + sz * 0.8], 0.18, 0.14, C, { seg: 5, mat: 'metal' });
    }
    for (let y = 4; y < h; y += 5) {
      const k = 2.2 - 1.4 * (y / h);
      b.box(k * 2, 0.15, 0.15, x, y, z - k, C, { mat: 'metal' });
      b.box(k * 2, 0.15, 0.15, x, y, z + k, C, { mat: 'metal' });
      b.box(0.15, 0.15, k * 2, x - k, y, z, C, { mat: 'metal' });
      b.box(0.15, 0.15, k * 2, x + k, y, z, C, { mat: 'metal' });
    }
    b.cyl(0.4, 0.4, h, x, 0, z, 0x4a6670, { seg: 6, mat: 'metal' });
    b.cyl(1.6, 1.6, 0.4, x, h, z, C, { seg: 10, mat: 'metal' });
    b.box(0.6, 0.4, 0.6, x, h + 0.4, z, 0x7fe0ff, { mat: 'glow' });
    col.box(x, z, 5, 5, { yMax: h });
    obst.push({ x, z, r: 5 });
    const g = new THREE.Group();
    g.position.set(x, h + 0.4, z);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 8), metalMat);
    hub.position.y = 0.5; g.add(hub);
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 0.25), metalMat);
      arm.position.set(Math.cos(a) * 3, 0.9, Math.sin(a) * 3); arm.rotation.y = -a; g.add(arm);
      const sp = new THREE.Mesh(sprayG, sprayMat);
      sp.scale.set(2.5, 7, 2.5);
      sp.position.set(Math.cos(a) * 6, 0.9 - 3.5, Math.sin(a) * 6);
      g.add(sp);
    }
    scene.add(g);
    const spd = rr(0.6, 1.1);
    anim((dt) => { g.rotation.y += dt * spd; });
  }

  // ================= 气候墙（东边界） =================
  {
    const xc = (WALL_X0 + R.x1) / 2; // -337.5
    const segs = [[TUNDRA_Z, -10], [10, R.z1]];
    for (const [za, zb] of segs) {
      const len = zb - za, zc = (za + zb) / 2;
      b.box(15, 4, len, xc, 0, zc, 0x6e7a70, { jitter: 0.05 });
      b.box(6, 54, len, xc + 1, 4, zc, 0x4f6466, { mat: 'metal' });
      b.box(8, 2, len, xc + 1, 58, zc, 0x6a8084, { mat: 'metal' });
      b.box(0.3, 0.6, len, xc - 2.2, 18, zc, 0x6ff0e8, { mat: 'glow' });
      b.box(0.3, 0.6, len, xc - 2.2, 42, zc, 0x6ff0e8, { mat: 'glow' });
      for (let z = za + 8; z < zb - 4; z += 16) {
        b.box(2.2, 54, 1.6, xc - 2.6, 4, z, 0x3d5254, { mat: 'metal' });
        b.cyl(0.9, 0.9, 50, xc - 4.4, 4, z + 6, 0x6b8a8e, { seg: 8, mat: 'metal' });
        // 雾化喷口
        b.cyl(1.4, 1.4, 0.8, xc - 2.4, 30, z + 6, 0x2d3a3c, { rx: Math.PI / 2, ry: -Math.PI / 2, seg: 10, mat: 'metal' });
      }
      // 墙脚藤蔓
      for (let z = za + 3; z < zb - 2; z += 7) {
        const L = rr(6, 20);
        seg([xc - 3.2, 4 + L, z], [xc - 3.4, 3, z + rr(-1, 1)], 0.15, 0.1, 0x3d6b2a, { seg: 4 });
        b.sphere(1.2, xc - 4.5, 0.6, z, pick(LEAVES), { seg: 6, mat: 'leaf', sy: 0.7 });
      }
      col.box(xc, zc, 15, len, { yMax: 60 });
    }
    // 通道门楼
    for (const s of [-1, 1]) {
      b.box(12, 26, 5, xc, 0, s * 12.5, 0x5a7072, { mat: 'metal' });
      b.box(12.4, 1, 5.4, xc, 26, s * 12.5, 0x6ff0e8, { mat: 'glow' });
    }
    b.box(12, 6, 30, xc, 20, 0, 0x4a5f62, { mat: 'metal' });
    b.box(0.3, 0.5, 30, xc - 6.1, 20.4, 0, 0x6ff0e8, { mat: 'glow' });
    if (ctx.tex && ctx.tex.signMesh) {
      const s1 = ctx.tex.signMesh('雨林区  RAINFOREST DISTRICT', 20, { bg: '#1f5e3a', fg: '#e8ffe0', w: 1024, h: 128, font: 'bold 64px "PingFang SC","Microsoft YaHei",sans-serif' });
      s1.position.set(xc + 6.15, 23, 0); s1.rotation.y = Math.PI / 2; scene.add(s1);
      const s2 = ctx.tex.signMesh('欢迎来到动物城 · 雨林区', 20, { bg: '#1f5e3a', fg: '#e8ffe0', w: 1024, h: 128 });
      s2.position.set(xc - 6.15, 23, 0); s2.rotation.y = -Math.PI / 2; scene.add(s2);
    }
  }

  // ================= 地标：气候控制塔 =================
  {
    const L = LANDMARKS.climateTower;
    const TX = L.x, TZ = -80;
    // 广场（铺装）
    b.box(70, 0.06, 44, TX, 0, -33, 0x8f9a88, { jitter: 0.08, shadow: false });
    b.cyl(24, 24, 0.07, TX, 0, TZ, 0x7f8a7a, { seg: 16, shadow: false });
    for (let i = -3; i <= 3; i++) b.box(0.4, 0.075, 44, TX + i * 9, 0, -33, 0x6f7a6a, { shadow: false });
    // 底座
    b.cyl(16, 18, 14, TX, 0, TZ, 0x6b8f88, { seg: 8, mat: 'facadeBig' });
    b.cyl(18.5, 18.5, 1.2, TX, 13.6, TZ, 0x3e5a5c, { seg: 8, mat: 'metal' });
    col.circle(TX, TZ, 18.2, { yMax: 90 });
    // 主塔
    b.cyl(6, 8, 60, TX, 14, TZ, 0x5f8486, { seg: 12, mat: 'metal' });
    for (const y of [30, 50, 68]) b.cyl(8.6 - (y - 14) * 0.033, 8.6 - (y - 14) * 0.033, 0.8, TX, y, TZ, 0x6ff0e8, { seg: 12, mat: 'glow' });
    b.cyl(11, 11, 0.7, TX, 45, TZ, 0x4a6466, { seg: 12, mat: 'metal' });
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12; b.box(0.15, 1.1, 0.15, TX + Math.cos(a) * 10.8, 45.7, TZ + Math.sin(a) * 10.8, 0x2f3d3e); }
    addGeo(torusG, TX, 46.7, TZ, 10.8, 10.8, 10.8, 0x2f3d3e, { rx: Math.PI / 2 });
    // 竖向管道
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4 + Math.PI / 4;
      b.cyl(0.8, 0.8, 58, TX + Math.cos(a) * 8.2, 14, TZ + Math.sin(a) * 8.2, 0x86a7a0, { seg: 8, mat: 'metal' });
    }
    // 顶部穹顶
    b.sphere(9, TX, 74, TZ, 0x5f8f8a, { sy: 0.5, seg: 12, mat: 'metal' });
    b.cyl(1.2, 1.5, 4, TX, 77, TZ, 0x3e5a5c, { seg: 8, mat: 'metal' });
    // 储水罐 + 管道
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4 + Math.PI / 4;
      const px = TX + Math.cos(a) * 30, pz = TZ + Math.sin(a) * 30;
      b.cyl(6, 6, 9, px, 0, pz, 0x7aa39b, { seg: 12, mat: 'shiny' });
      b.sphere(6, px, 9, pz, 0x7aa39b, { sy: 0.45, seg: 12, mat: 'shiny' });
      b.cyl(6.1, 6.1, 0.5, px, 3, pz, 0x3e5a5c, { seg: 12, mat: 'metal' });
      b.cyl(6.1, 6.1, 0.5, px, 7, pz, 0x3e5a5c, { seg: 12, mat: 'metal' });
      col.circle(px, pz, 6.2, { yMax: 12 });
      const sx = TX + Math.cos(a) * 7.5, sz = TZ + Math.sin(a) * 7.5;
      seg([px - Math.cos(a) * 3, 11, pz - Math.sin(a) * 3], [sx + Math.cos(a) * 1.5, 34, sz + Math.sin(a) * 1.5], 1.1, 1.1, 0x9bb8ae, { seg: 8, mat: 'metal' });
      b.sphere(1.5, sx + Math.cos(a) * 1.5, 34, sz + Math.sin(a) * 1.5, 0x3e5a5c, { seg: 8, mat: 'metal' });
      // 地面管道（通向角落洒水塔方向）
      const ex = px + Math.cos(a) * 16, ez = pz + Math.sin(a) * 16;
      seg([px + Math.cos(a) * 6, 1.4, pz + Math.sin(a) * 6], [ex, 1.4, ez], 1.0, 1.0, 0x9bb8ae, { seg: 8, mat: 'metal' });
      const mx = (px + Math.cos(a) * 6 + ex) / 2, mz = (pz + Math.sin(a) * 6 + ez) / 2;
      col.box(mx, mz, 10, 2.2, { ry: Math.atan2(-Math.sin(a), Math.cos(a)), yMax: 2.4 });
      for (const k of [0.25, 0.75]) b.box(2.6, 1.2, 1.2, px + Math.cos(a) * (6 + 10 * k), 0, pz + Math.sin(a) * (6 + 10 * k), 0x3e5a5c, { ry: Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI / 2 });
    }
    obst.push({ x: TX, z: TZ, r: 52 });
    // 招牌
    if (ctx.tex && ctx.tex.signMesh) {
      const s = ctx.tex.signMesh('雨林气候控制中心\nCLIMATE CONTROL', 16, { bg: '#18454a', fg: '#bff8ff', w: 512, h: 192, font: 'bold 52px "PingFang SC","Microsoft YaHei",sans-serif' });
      s.position.set(TX, 10, TZ + 17.4); scene.add(s);
    }
    // 广场两侧花坛
    for (const sx of [-1, 1]) {
      const px = TX + sx * 22, pz = -30;
      b.box(8, 0.6, 8, px, 0, pz, 0x7d6a55);
      bush(px, pz, 1.2); elephantEar(px + 2, pz + 2, 1.2);
      col.box(px, pz, 8, 8, { yMax: 0.6, walkable: true });
    }
    // 旋转喷淋冠（动画）
    const crown = new THREE.Group();
    crown.position.set(TX, 81, TZ);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.4, 2.5, 10), metalMat); crown.add(hub);
    const nozMat = new THREE.MeshStandardMaterial({ color: 0x2f3d3e, roughness: 0.4, metalness: 0.7 });
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(18, 0.6, 0.6), metalMat);
      arm.position.set(Math.cos(a) * 9, 0.4, Math.sin(a) * 9); arm.rotation.y = -a; crown.add(arm);
      const noz = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 8), nozMat);
      noz.position.set(Math.cos(a) * 18, -0.3, Math.sin(a) * 18); noz.rotation.x = Math.PI; crown.add(noz);
      const sp = new THREE.Mesh(sprayG, sprayMat);
      sp.scale.set(7, 26, 7);
      sp.position.set(Math.cos(a) * 19, -14, Math.sin(a) * 19); crown.add(sp);
    }
    scene.add(crown);
    anim((dt) => { crown.rotation.y += dt * 0.35; });
    // 涡轮风扇（两侧，绕水平轴旋转）
    for (const s of [-1, 1]) {
      addGeo(torusG, TX + s * 9.5, 40, TZ, 4.6, 4.6, 4.6, 0x3e5a5c, { ry: Math.PI / 2, mat: 'metal' });
      b.box(3, 0.8, 0.8, TX + s * 7.5, 39.6, TZ, 0x3e5a5c, { mat: 'metal' });
      const fan = new THREE.Group();
      fan.position.set(TX + s * 9.8, 40, TZ);
      for (let k = 0; k < 5; k++) {
        const bl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 1.1), metalMat);
        bl.position.y = 2.1; const piv = new THREE.Group(); piv.rotation.x = k * TAU / 5; bl.rotation.y = 0.4; piv.add(bl); fan.add(piv);
      }
      scene.add(fan);
      anim((dt) => { fan.rotation.x += dt * 2.2 * s; });
    }
    // 角落洒水塔
    for (const [px, pz] of [[-722, -122], [-598, -122], [-722, -30], [-598, -30]]) sprinklerTower(px, pz, 22);
    // 背后几棵树
    giantTree(-715, -100, 3, 52);
    giantTree(-603, -100, 2.6, 46);
    label(TX, 88, TZ, L.name);
  }

  // ================= 地标：树冠集市 =================
  {
    const L = LANDMARKS.canopyMarket;
    const MX = -500, MZ = 75;
    const DECK = 0x9b6e3e, DECK2 = 0xa8794a, RAIL = 0x5e4127;
    const main = giantTree(MX, MZ, 5, 86, { branches: 7 });
    obst.pop(); obst.push({ x: MX, z: MZ, r: 26 });
    // 地面铺装（入口广场）
    b.box(60, 0.05, 40, MX, 0, 31, 0x8d7f63, { jitter: 0.1, shadow: false });

    // —— 一层平台 y=8 ——
    const T1 = { x0: -518, x1: -482, z0: 57, z1: 93, y: 8 };
    b.box(36, 0.5, 36, MX, 7.5, MZ, DECK, { jitter: 0.1 });
    for (let i = -17; i <= 17; i += 2) b.box(0.08, 0.02, 36, MX + i, 8.0, MZ, 0x7a5430, { shadow: false });
    col.box(MX, MZ, 36, 36, { yMin: 7.4, yMax: 8, walkable: true });
    for (const px of [-517.5, -506, -494, -482.5]) for (const pz of [57.5, 69, 81, 92.5]) {
      if (Math.abs(px - MX) < 8 && Math.abs(pz - MZ) < 8) continue;
      b.cyl(0.4, 0.45, 7.5, px, 0, pz, WOOD_D, { seg: 6 });
      col.circle(px, pz, 0.45, { yMax: 7.4 });
    }
    // 一层栏杆（留出坡道/吊桥/二层坡道口）
    const railSeg = (xa, za, xb, zb, y) => {
      const len = Math.hypot(xb - xa, zb - za), cx = (xa + xb) / 2, cz = (za + zb) / 2;
      const ry = Math.atan2(-(zb - za) / len, (xb - xa) / len);
      b.box(len, 0.12, 0.15, cx, y + 1.0, cz, RAIL, { ry });
      b.box(len, 0.08, 0.1, cx, y + 0.5, cz, RAIL, { ry });
      const n = Math.max(1, Math.round(len / 2));
      for (let i = 0; i <= n; i++) b.box(0.14, 1.1, 0.14, xa + (xb - xa) * i / n, y, za + (zb - za) * i / n, RAIL);
      col.box(cx, cz, len, 0.3, { ry, yMin: y, yMax: y + 1.15 });
    };
    railSeg(-518, 57, -515.5, 57, 8); railSeg(-508.5, 57, -482, 57, 8);   // 南（坡道口 x -515..-509）
    railSeg(-518, 93, -482, 93, 8);                                          // 北
    railSeg(-518, 57, -518, 93, 8);                                          // 西
    railSeg(-482, 57, -482, 67, 8); railSeg(-482, 73, -482, 93, 8);         // 东（吊桥口 z 67..73）
    // 地面 → 一层坡道（实心台阶）
    {
      const x0 = -515, x1 = -509, za = 27, zb = 57, n = 16;
      for (let i = 0; i < n; i++) {
        const h = (i + 1) * 8 / n, z = za + (i + 0.5) * (zb - za) / n;
        b.box(6, h, (zb - za) / n, (x0 + x1) / 2, 0, z, i % 2 ? 0x8a6239 : 0x946a3f);
      }
      col.ramp(x0, za, x1, zb, 0, 8, 'z');
      // 侧面阻挡：每级台阶一个盒子，顶部低于台阶面 0.8m，站在坡道上时不会被挡
      for (let i = 0; i < n; i++) {
        const top = (i + 1) * 8 / n - 0.8;
        if (top < 0.3) continue;
        col.box((x0 + x1) / 2, za + (i + 0.5) * (zb - za) / n, 6, (zb - za) / n, { yMax: top });
      }
      for (const sx of [x0 - 0.1, x1 + 0.1]) {
        for (let i = 0; i <= 6; i++) { const z = za + i * 5, h = (z - za) * 8 / 30; b.box(0.14, 1.1, 0.14, sx, h, z, RAIL); }
        seg([sx, 1.0, za], [sx, 9.0, zb], 0.07, 0.07, RAIL, { seg: 4 });
      }
      // 入口拱门 + 招牌
      for (const sx of [x0 - 0.8, x1 + 0.8]) { b.cyl(0.35, 0.4, 6, sx, 0, za - 1, WOOD_D, { seg: 6 }); col.circle(sx, za - 1, 0.4, { yMax: 6 }); }
      b.box(8.4, 0.6, 0.6, (x0 + x1) / 2, 6, za - 1, WOOD_D);
      for (let k = 0; k < 5; k++) b.sphere(0.25, x0 - 0.4 + k * 1.7, 5.6, za - 1, pick([0xffb347, 0xff7b54, 0xffd56b]), { seg: 6, mat: 'glow' });
      if (ctx.tex && ctx.tex.signMesh) {
        const s = ctx.tex.signMesh('树冠集市 CANOPY MARKET', 8, { bg: '#5a3a1e', fg: '#ffe3a3', w: 768, h: 128, font: 'bold 60px "PingFang SC","Microsoft YaHei",sans-serif' });
        s.position.set((x0 + x1) / 2, 7.4, za - 1.35); scene.add(s);
      }
    }
    // —— 二层平台 y=16 ——
    b.box(22, 0.5, 22, MX, 15.5, MZ, DECK2, { jitter: 0.1 });
    col.box(MX, MZ, 22, 22, { yMin: 15.4, yMax: 16, walkable: true });
    for (const [px, pz] of [[-510.5, 64.5], [-489.5, 64.5], [-510.5, 85.5], [-489.5, 85.5]]) {
      b.cyl(0.35, 0.4, 7.4, px, 8, pz, WOOD_D, { seg: 6 });
      col.circle(px, pz, 0.4, { yMin: 8, yMax: 15.4 });
    }
    railSeg(-511, 64, -489, 64, 16); railSeg(-511, 64, -511, 86, 16); railSeg(-489, 64, -489, 86, 16);
    railSeg(-511, 86, -506.5, 86, 16); railSeg(-499.5, 86, -489, 86, 16); // 北侧留坡道口 x -506..-500
    // 一层 → 二层坡道（沿 x，北侧 z 87..92，x -484 h8 → x -502 h16）
    {
      const z0 = 87, z1 = 92, xa = -484, xb = -502, n = 18;
      for (let i = 0; i < n; i++) {
        const h = (i + 1) * 8 / n, x = xa + (i + 0.5) * (xb - xa) / n;
        b.box(Math.abs(xb - xa) / n, h, z1 - z0, x, 8, (z0 + z1) / 2, i % 2 ? 0x8a6239 : 0x946a3f);
      }
      col.ramp(xa, z0, xb, z1, 8, 16, 'x');
      for (let i = 0; i < n; i++) {
        const top = 8 + (i + 1) * 8 / n - 0.8;
        if (top < 8.3) continue;
        col.box(xa + (i + 0.5) * (xb - xa) / n, (z0 + z1) / 2, Math.abs(xb - xa) / n, z1 - z0, { yMin: 8, yMax: top });
      }
      b.box(5, 0.5, 7.5, -504.5, 15.5, 89, DECK2);
      col.box(-504.5, 89, 5, 7.5, { yMin: 15.4, yMax: 16, walkable: true });
      // 坡道顶端与二层平台之间的连接板（z 85.5..87）
      b.box(7.5, 0.5, 1.6, -503.25, 15.5, 86.2, DECK2);
      col.box(-503.25, 86.25, 7.5, 1.5, { yMin: 15.4, yMax: 16, walkable: true });
      railSeg(-507, 86, -507, 92.7, 16); railSeg(-507, 92.7, -502, 92.7, 16);
      seg([xa, 9, z0 - 0.1], [xb, 17, z0 - 0.1], 0.07, 0.07, RAIL, { seg: 4 });
      for (let i = 0; i <= 6; i++) { const x = xa + (xb - xa) * i / 6; b.box(0.14, 1.1, 0.14, x, 8 + 8 * i / 6, z0 - 0.1, RAIL); }
    }
    // 摊位（一层）
    const stallColors = [0xe85d4a, 0xf2a541, 0x3fa7a0, 0xc06bd6, 0x6cbf4a, 0xef7fa0];
    const goods = [0xff8c42, 0xffd23f, 0x9bd15a, 0xd94f5c, 0x7a4fd1, 0xfff1a8];
    const stallNames = ['芒果冰沙', '雨林咖啡', '香蕉干货', '雨伞出租', '花卉种子', '树懒茶摊'];
    const stalls = [
      [-515, 67, Math.PI / 2], [-515, 78, Math.PI / 2], [-515, 88, Math.PI / 2],
      [-510, 90.2, Math.PI], [-492, 59.8, 0], [-485.2, 80, -Math.PI / 2],
    ];
    let signCount = 0;
    stalls.forEach(([sx, sz, ry], i) => {
      const w = 4, d = 2.6, y = 8;
      const c = stallColors[i % stallColors.length];
      b.box(w, 1.0, d, sx, y, sz, 0x7a5430, { ry });
      const [gx, gz] = toW(sx, sz, ry, 0, 0.3);
      for (let k = 0; k < 4; k++) {
        const [px, pz] = toW(gx, gz, ry, -1.4 + k * 0.95, 0);
        b.sphere(0.28, px, y + 1.2, pz, goods[(i + k) % goods.length], { seg: 6 });
      }
      for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
        const [px, pz] = toW(sx, sz, ry, lx * 0.95, lz * 0.95);
        b.box(0.12, 2.6, 0.12, px, y, pz, WOOD_D);
      }
      // 条纹遮阳篷
      for (let k = 0; k < 4; k++) {
        const [px, pz] = toW(sx, sz, ry, -w / 2 + (k + 0.5) * w / 4, 0.2);
        b.box(w / 4, 0.12, d + 0.8, px, y + 2.6, pz, k % 2 ? c : 0xfaf3e0, { ry, rx: -0.18 });
      }
      // 灯笼
      for (const lx of [-w / 2 + 0.2, w / 2 - 0.2]) {
        const [px, pz] = toW(sx, sz, ry, lx, d / 2 + 0.5);
        b.box(0.03, 0.4, 0.03, px, y + 2.1, pz, 0x333333);
        b.sphere(0.28, px, y + 1.95, pz, pick([0xffb347, 0xff6b6b, 0xffe066]), { seg: 8, mat: 'glow', sy: 1.2 });
      }
      col.box(sx, sz, w, d, { ry, yMin: 8, yMax: 10.8 });
      if (ctx.tex && ctx.tex.signMesh && signCount < 6) {
        const s = ctx.tex.signMesh(stallNames[i], 2.6, { bg: '#3d2614', fg: '#ffe7b0', w: 384, h: 96, font: 'bold 54px "PingFang SC","Microsoft YaHei",sans-serif' });
        const [px, pz] = toW(sx, sz, ry, 0, d / 2 + 0.75);
        s.position.set(px, y + 2.3, pz); s.rotation.y = ry; scene.add(s);
        signCount++;
      }
    });
    // 一层围绕树干的灯笼串
    for (let i = 0; i < 16; i++) {
      const a = i * TAU / 16, r1 = 7.5;
      b.sphere(0.3, MX + Math.cos(a) * r1, 13.2 + Math.sin(i * 1.7) * 0.3, MZ + Math.sin(a) * r1, pick([0xffb347, 0xff6b6b, 0xffe066, 0x8ef0c0]), { seg: 6, mat: 'glow' });
      seg([MX + Math.cos(a) * r1, 13.5, MZ + Math.sin(a) * r1], [MX + Math.cos(a + TAU / 16) * r1, 13.5, MZ + Math.sin(a + TAU / 16) * r1], 0.02, 0.02, 0x333333, { seg: 3, shadow: false });
    }
    // 二层：咖啡座
    for (const [tx, tz] of [[-493, 68], [-507, 82], [-493, 82]]) {
      b.cyl(0.9, 0.9, 0.08, tx, 16.8, tz, 0xd9b38c, { seg: 10 });
      b.cyl(0.1, 0.1, 0.8, tx, 16, tz, WOOD_D, { seg: 5 });
      b.cyl(0.55, 0.55, 0.45, tx + 1.4, 16, tz, 0x7aa36a, { seg: 8 });
      b.cyl(0.55, 0.55, 0.45, tx - 1.4, 16, tz, 0x7aa36a, { seg: 8 });
      b.sphere(0.18, tx, 17.05, tz, 0xffd27a, { seg: 6, mat: 'glow' });
      col.circle(tx, tz, 0.9, { yMin: 16, yMax: 16.9 });
    }
    // —— 卫星树 + 平台 + 吊桥（可行走） ——
    const SX = -448, SZ = 100;
    giantTree(SX, SZ, 3, 60);
    b.box(14, 0.5, 14, SX, 7.5, SZ, DECK, { jitter: 0.1 });
    col.box(SX, SZ, 14, 14, { yMin: 7.4, yMax: 8, walkable: true });
    for (const [px, pz] of [[-454.5, 93.5], [-441.5, 93.5], [-454.5, 106.5], [-441.5, 106.5]]) {
      b.cyl(0.35, 0.4, 7.5, px, 0, pz, WOOD_D, { seg: 6 }); col.circle(px, pz, 0.4, { yMax: 7.4 });
    }
    railSeg(-455, 107, -441, 107, 8); railSeg(-441, 93, -441, 107, 8); railSeg(-447, 93, -441, 93, 8);
    railSeg(-455, 98.5, -455, 107, 8);
    // 卫星台上的瞭望摊
    b.box(3, 1, 2, -444, 8, 104, 0x7a5430); col.box(-444, 104, 3, 2, { yMin: 8, yMax: 10.5 });
    b.cone(2.4, 1.6, -444, 10.6, 104, 0x3fa7a0, { seg: 8 });
    for (const [px, pz] of [[-445.3, 103.2], [-442.7, 104.8]]) b.box(0.1, 2.6, 0.1, px, 8, pz, WOOD_D);
    b.sphere(0.3, -444, 10.2, 105.3, 0xffd56b, { seg: 6, mat: 'glow' });
    // 吊桥：一层东 (-481,70) → 卫星台西南 (-456,96)
    {
      const p = [-480.5, 70], q = [-455.5, 95.5];
      ropeBridge(p, q, 8, 8, 0.25, 2.4);
      const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
      const ux = dx / len, uz = dz / len;
      col.box((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, len + 4, 2.6, { ry: Math.atan2(-uz, ux), yMin: 7.4, yMax: 8, walkable: true });
    }
    // 集市下方：板条箱、蕨类
    for (let i = 0; i < 10; i++) {
      const x = rr(-516, -484), z = rr(60, 92);
      if (Math.hypot(x - MX, z - MZ) < 13 || (x < -508 && z < 60)) continue;
      b.box(1.2, 1.2, 1.2, x, 0, z, 0xa07848, { ry: rand() * 3 });
      col.box(x, z, 1.2, 1.2, { yMax: 1.2, walkable: true });
    }
    // 地面摊位（入口广场东侧）
    for (let i = 0; i < 3; i++) {
      const sx = -485 + i * 9, sz = 30;
      b.box(4, 1, 2.4, sx, 0, sz, 0x7a5430);
      b.cone(3.2, 1.8, sx, 2.6, sz, stallColors[(i + 2) % 6], { seg: 8 });
      for (const [lx, lz] of [[-1.8, -1], [1.8, -1], [-1.8, 1], [1.8, 1]]) b.box(0.1, 2.6, 0.1, sx + lx, 0, sz + lz, WOOD_D);
      b.sphere(0.3, sx, 2.3, sz + 1.3, 0xffc36b, { seg: 6, mat: 'glow' });
      for (let k = 0; k < 3; k++) b.sphere(0.3, sx - 1 + k, 1.25, sz, goods[(i * 2 + k) % 6], { seg: 6 });
      col.box(sx, sz, 4, 2.4, { yMax: 2.6 });
    }
    obst.push({ x: -478, z: 30, r: 16 }, { x: SX, z: SZ, r: 12 }, { x: -468, z: 84, r: 10 }, { x: -512, z: 30, r: 8 });
    label(MX, 32, MZ, L.name);
    void main;
  }

  // ================= 瀑布 =================
  const WF = { x: -810, z: -381 };
  {
    // 悬崖
    for (let i = 0; i < 14; i++) {
      const x = -852 + i * 6.2, hgt = Math.abs(x - WF.x) < 8 ? 30 : rr(26, 38);
      b.box(rr(7, 10), hgt, rr(14, 20), x, 0, -392 + rr(-2, 2), pick([0x6a7366, 0x5e6a5b, 0x747c6c]), { jitter: 0.2, ry: rr(-0.15, 0.15) });
      b.sphere(rr(3, 5), x, hgt, -390, MOSS, { sy: 0.4, seg: 6, mat: 'leaf' });
      if (rand() < 0.6) { const L = rr(6, 16); seg([x + rr(-2, 2), hgt, -383], [x, hgt - L, -382.5], 0.1, 0.07, 0x3d6b2a, { seg: 4 }); }
    }
    for (let i = 0; i < 6; i++) b.sphere(rr(4, 7), -850 + i * 16, rr(4, 10), -383, pick([0x5e6a5b, 0x6a7366]), { seg: 6, jitter: 0.2 });
    col.box(-810, -391, 92, 22, { yMax: 38 });
    // 顶部溪流
    b.box(12, 0.4, 16, WF.x, 30, -391, 0x6fb6c9, { mat: 'water' });
    // 水潭
    b.cyl(17, 17, 0.12, WF.x, 0, -364, 0x4f9fb5, { seg: 16, mat: 'water' });
    for (let i = 0; i < 16; i++) {
      const a = i * TAU / 16; if (a > 0.9 && a < 2.25) continue; // 南侧留口
      rock(WF.x + Math.cos(a) * 17.5, -364 + Math.sin(a) * 17.5, rr(1.2, 2.2), true);
    }
    // 瀑布水幕（滚动纹理）
    const wtex = dataTex(16, 64, (i, j) => {
      const s = (Math.sin(i * 2.7 + j * 0.15) * 0.5 + 0.5) * (Math.sin(i * 7.3) * 0.25 + 0.75);
      const v = 200 + s * 55;
      return [v, v + 5 > 255 ? 255 : v + 5, 255, 130 + s * 110];
    });
    wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping; wtex.repeat.set(2, 3);
    const wmat = new THREE.MeshBasicMaterial({ map: wtex, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, color: 0xe6f7ff });
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(11, 30, 1, 6), wmat);
    // 让水幕略向外弯
    const pa = sheet.geometry.attributes.position;
    for (let k = 0; k < pa.count; k++) { const y = pa.getY(k); pa.setZ(k, Math.pow((15 - y) / 30, 2) * 2.2); }
    pa.needsUpdate = true;
    sheet.position.set(WF.x, 15, WF.z + 0.2);
    scene.add(sheet);
    anim((dt) => { wtex.offset.y += dt * 1.4; });
    // 水花
    const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
    const foam = new THREE.Group();
    const fg = new THREE.SphereGeometry(1, 8, 6);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(fg, foamMat);
      m.position.set(WF.x + (i - 2.5) * 1.8, 0.4, WF.z + 3 + rand() * 1.5);
      m.userData.ph = rand() * TAU; foam.add(m);
    }
    scene.add(foam);
    anim((dt, t) => {
      for (const m of foam.children) { const s = 1.3 + Math.sin(t * 5 + m.userData.ph) * 0.4; m.scale.set(s, s * 0.6, s); }
    });
    obst.push({ x: WF.x, z: -372, r: 26 });
  }

  // ================= 英雄巨树树屋（POI bigTreeHouse） =================
  {
    const t = giantTree(-810, 70, 5, 88, { branches: 6 });
    treeHouse(t, 12, true);
    treeHouse(t, 26, false);
    treeHouse(t, 40, false);
    t.hero = true;
    var heroTree = t; // eslint-disable-line no-var
  }

  // ================= 普通街区：巨树、树屋、吊桥、高脚屋、植被 =================
  let extraSprinklers = 0;
  const allTrees = [heroTree];
  for (const c of blocks) {
    if (c.landmark === 'climateTower' || c.landmark === 'canopyMarket') {
      // 地标街区只撒植被
    } else {
      const area = (c.ux1 - c.ux0) * (c.uz1 - c.uz0);
      if (area < 200) continue;
      const misty = c.cx < -587 && c.cx > -733 && c.cz > 140;
      const nT = Math.min(misty ? 8 : 6, Math.max(1, Math.round(area / (misty ? 2000 : 3200))));
      const trees = c.x0 < -800 && c.z0 < 140 && c.z1 > 0 ? [heroTree] : [];
      for (let k = 0, tries = 0; k < nT && tries < 60; tries++) {
        const r = rr(2, 5), h = Math.min(90, 40 + r * 8 + rr(0, 12));
        const m = r * 2.3 + 1;
        if (c.ux1 - c.ux0 < 2 * m || c.uz1 - c.uz0 < 2 * m) continue;
        const x = rr(c.ux0 + m, c.ux1 - m), z = rr(c.uz0 + m, c.uz1 - m);
        if (!freeAt(x, z, r * 2.3 + 6) || !clearOK(x, z, r * 2.4)) continue;
        const t = giantTree(x, z, r, h);
        trees.push(t); allTrees.push(t); k++;
        if (rand() < 0.65) {
          const y1 = rr(9, 16);
          treeHouse(t, y1, true);
          if (h > 60 && rand() < 0.6) treeHouse(t, y1 + rr(10, 16), false);
        }
      }
      // 树间吊桥
      let nb = 0;
      for (let i = 0; i < trees.length && nb < 2; i++) for (let j = i + 1; j < trees.length && nb < 2; j++) {
        const A = trees[i], B = trees[j];
        if (!A.houses.length || !B.houses.length) continue;
        const dx = B.x - A.x, dz = B.z - A.z, dd = Math.hypot(dx, dz);
        if (dd > 60) continue;
        const ha = A.houses[0], hb = B.houses[0];
        const ux = dx / dd, uz = dz / dd;
        const p = [A.x + ux * (ha.rd - 0.3), A.z + uz * (ha.rd - 0.3)], q = [B.x - ux * (hb.rd - 0.3), B.z - uz * (hb.rd - 0.3)];
        if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 6) continue;
        ropeBridge(p, q, ha.y, hb.y, Math.min(2.5, dd * 0.04));
        nb++;
      }
      // 高脚屋
      const nH = Math.round(area / 2600);
      for (let k = 0, tries = 0; k < nH && tries < 50; tries++) {
        const w = rr(7, 12), d = rr(6, 9), rad = Math.hypot(w, d) / 2 + 2;
        if (c.ux1 - c.ux0 < 2 * rad || c.uz1 - c.uz0 < 2 * rad) break;
        const x = rr(c.ux0 + rad, c.ux1 - rad), z = rr(c.uz0 + rad, c.uz1 - rad);
        if (!freeAt(x, z, rad + 1) || !clearOK(x, z, rad)) continue;
        // 面向最近的道路
        const dW = c.roadW ? x - c.x0 : 1e9, dE = c.roadE ? c.x1 - x : 1e9, dN = c.roadN ? z - c.z0 : 1e9, dS = c.roadS ? c.z1 - z : 1e9;
        const mn = Math.min(dW, dE, dN, dS);
        const ry = (mn === dS ? 0 : mn === dN ? Math.PI : mn === dE ? Math.PI / 2 : -Math.PI / 2) + rr(-0.2, 0.2);
        stiltHouse(x, z, w, d, ry);
        k++;
      }
      // 洒水塔
      if (extraSprinklers < 4 && area > 9000) {
        for (let tries = 0; tries < 20; tries++) {
          const x = rr(c.ux0 + 4, c.ux1 - 4), z = rr(c.uz0 + 4, c.uz1 - 4);
          if (freeAt(x, z, 6) && clearOK(x, z, 5)) { sprinklerTower(x, z, rr(18, 24)); extraSprinklers++; break; }
        }
      }
      // 小棕榈
      for (let k = 0; k < Math.round(area / 2200); k++) {
        const x = rr(c.ux0 + 1, c.ux1 - 1), z = rr(c.uz0 + 1, c.uz1 - 1);
        if (freeAt(x, z, 1.5) && clearOK(x, z, 1)) { smallPalm(x, z, rr(3.5, 6)); obst.push({ x, z, r: 1 }); }
      }
    }
    // 地面植被（所有街区）
    const area2 = (c.ux1 - c.ux0) * (c.uz1 - c.uz0);
    if (area2 < 50) continue;
    const nV = Math.round(area2 / 450);
    for (let k = 0; k < nV; k++) {
      const x = rr(c.ux0, c.ux1), z = rr(c.uz0, c.uz1);
      if (!freeAt(x, z, 1.2)) continue;
      if (!clearOK(x, z, 1.5)) continue;
      const roll = rand();
      if (roll < 0.38) fern(x, z, rr(0.8, 1.5));
      else if (roll < 0.6) elephantEar(x, z, rr(0.8, 1.6));
      else if (roll < 0.74) bush(x, z, rr(0.8, 1.4));
      else if (roll < 0.86) { const gl = rand() < 0.4; for (let m = 0; m < 2; m++) mushroom(x + rr(-0.8, 0.8), z + rr(-0.8, 0.8), rr(0.7, 1.6), gl); }
      else if (roll < 0.93) rock(x, z, rr(0.6, 1.4));
      else b.box(rr(2, 4), 0.03, rr(2, 4), x, 0.012, z, pick([0x3d6b2a, 0x4f7f33, 0x355f27]), { ry: rand() * 3, mat: 'leaf', shadow: false });
    }
  }

  // ================= 雾气（Sprites） =================
  {
    const mtex = dataTex(64, 64, (i, j) => {
      const dx = (i - 31.5) / 32, dy = (j - 31.5) / 32, d = Math.min(1, Math.hypot(dx, dy));
      return [235, 245, 240, Math.round(255 * Math.pow(1 - d, 2) * 0.9)];
    });
    const mmat = new THREE.SpriteMaterial({ map: mtex, transparent: true, opacity: 0.35, depthWrite: false, color: 0xe6f2ea });
    const spots = [[-810, -350, 1.4], [-800, -365, 1.0], [-660, 200, 1.6], [-700, 160, 1.3], [-620, 230, 1.2], [-500, 60, 1.0],
      [-660, -110, 1.2], [-900, 100, 1.2], [-820, -180, 1.1], [-380, -200, 1.0]];
    for (const [x, z, s] of spots) {
      const sp = new THREE.Sprite(mmat);
      sp.scale.set(60 * s, 14 * s, 1);
      sp.position.set(x, 5 * s, z);
      sp.userData = { bx: x, bz: z, ph: rand() * TAU };
      scene.add(sp);
      anim((dt, t) => {
        sp.position.x = sp.userData.bx + Math.sin(t * 0.05 + sp.userData.ph) * 10;
        sp.position.z = sp.userData.bz + Math.cos(t * 0.04 + sp.userData.ph) * 6;
      });
    }
  }

  // ================= 雨（THREE.Points，跟随相机，世界坐标环绕） =================
  {
    const N = 4000, SPAN = 140, H = 55;
    const pos = new Float32Array(N * 3);
    const spd = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = -640 + (rand() - 0.5) * SPAN;
      pos[i * 3 + 1] = rand() * H;
      pos[i * 3 + 2] = (rand() - 0.5) * SPAN;
      spd[i] = 22 + rand() * 10;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const streak = dataTex(8, 32, (i, j) => {
      const a = Math.max(0, 1 - Math.abs(i - 3.5) / 1.6) * (0.35 + 0.65 * (j / 31));
      return [220, 238, 255, Math.round(a * 255)];
    });
    const mat = new THREE.PointsMaterial({ color: 0xb8dcff, size: 0.35, map: streak, transparent: true, opacity: 0.7, depthWrite: false, sizeAttenuation: true });
    const rain = new THREE.Points(geo, mat);
    rain.frustumCulled = false;
    const cam = new THREE.Vector3(1e6, 0, 1e6);
    rain.onBeforeRender = (r, s, camera) => { cam.setFromMatrixPosition(camera.matrixWorld); };
    scene.add(rain);
    geo.setDrawRange(0, 0);
    const half = SPAN / 2;
    anim((dt) => {
      const inside = cam.x > R.x0 - 30 && cam.x < R.x1 + 10 && cam.z > R.z0 - 30 && cam.z < R.z1 + 30 && cam.y < 120;
      if (!inside) { geo.setDrawRange(0, 0); return; }
      geo.setDrawRange(0, N);
      const d = Math.min(dt, 0.1);
      const top = Math.max(0, cam.y - 15) + H;
      for (let i = 0; i < N; i++) {
        const k = i * 3;
        let y = pos[k + 1] - spd[i] * d;
        if (y < 0 || y > top) y = top - rand() * 6;
        pos[k + 1] = y;
        let x = pos[k] - cam.x; if (x > half) pos[k] -= SPAN; else if (x < -half) pos[k] += SPAN;
        let z = pos[k + 2] - cam.z; if (z > half) pos[k + 2] -= SPAN; else if (z < -half) pos[k + 2] += SPAN;
      }
      geo.attributes.position.needsUpdate = true;
    });
  }

  return { animated: animCount, trees: allTrees.length };
}
