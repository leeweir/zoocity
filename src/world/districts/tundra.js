// 冰川镇 Tundratown —— 俄式 / 北欧风雪城
//
// 地区 rect：x -700..300, z -950..-330（DISTRICTS.tundra），道路来自 roadsX / roadsZ。
// 主要地标：
//   冰川镇广场 tundraPlaza  中心 (-105,-500)  北极熊冰雕 + 集市摊位 + 洋葱顶大教堂，南侧拱门，front (-105,-435)
//   冰湖 iceLake            中心 (-105,-660)  椭圆冰面（可行走，rx70 × rz50），溜冰场围栏（东南西北四个开口）+ 冰钓小屋，3 个动画滑冰者
//   大先生庄园 mrBig        中心 (-315,-810)  黑色宅邸 + 白色柱廊，铁栅围墙，大门 (-315,-762)，北极熊警卫亭，雪中花园，front (-315,-755)
//   冰棍工厂 iceFactory     中心 (100,-500)   主厂房 + 冷库大门 (100,-460)，三根烟囱（动画蒸汽），屋顶旋转冰棍招牌，front (100,-435)
//   气候墙 climate wall     z -345..-330 全长，高 28m，6 座 42m 造雪塔（动画雪雾喷口）；
//                          x=0 处 x -11..11 完全通畅（仅 22m 高处有门楣），其他道路处为拱门（拱底 16m）
// 动画：降雪 Points（跟随相机，限制在地区内）、造雪喷雾 Points、15 个蒸汽团、3 个滑冰者、1 个旋转冰棍。
// 给案件系统的有趣地点见 POI（所有点周围 3m 无碰撞体）。
import * as THREE from 'three';

export const POI = {
  plazaSculpture: { x: -105, y: 0, z: -484, label: '冰川镇广场 · 北极熊冰雕前' },
  plazaMarket:    { x: -158, y: 0, z: -500, label: '冰川镇广场 · 集市摊位' },
  plazaGate:      { x: -105, y: 0, z: -447, label: '冰川镇广场 · 拱门下' },
  iceLakeCenter:  { x: -105, y: 0.07, z: -660, label: '冰湖 · 湖心' },
  skateRental:    { x: -160, y: 0, z: -608, label: '冰湖 · 冰鞋租赁小屋' },
  cocoaHut:       { x: -50, y: 0, z: -608, label: '冰湖 · 热可可小屋' },
  fishingHut:     { x: -127, y: 0.07, z: -687, label: '冰湖 · 冰钓小屋' },
  mrBigGate:      { x: -315, y: 0, z: -770, label: '大先生庄园 · 大门内' },
  mrBigGarden:    { x: -345, y: 0, z: -775, label: '大先生庄园 · 雪中花园' },
  mrBigDoor:      { x: -315, y: 0, z: -790, label: '大先生庄园 · 正门台阶前' },
  factoryDoor:    { x: 100, y: 0, z: -452, label: '冰棍工厂 · 冷库大门' },
  factoryVent:    { x: 80, y: 0, z: -437, label: '冰棍工厂 · 暖风出风口' },
  factoryLoading: { x: 165, y: 0, z: -452, label: '冰棍工厂 · 装卸区' },
  climateGate:    { x: 0, y: 0, z: -352, label: '气候墙 · 冰川镇入口' },
  climateVent:    { x: -110, y: 0, z: -356, label: '气候墙 · 造雪塔下' },
};

const WHITE = 0xf4f8fc, SNOW = 0xeaf2f9, GOLD = 0xd9a520, WOOD = 0x6b4628, DARK = 0x23262d;
const ICE = 0xbfe8f7, ROAD = 0x3f4248, WALK = 0xc3ccd6;
const WALLS = [0x2f8f8a, 0xb8322f, 0xefe3c4, 0x6aa6c9, 0xd9a441, 0xd99aa0, 0x2d4a6b, 0x8cc7b5, 0xf2efe6, 0x9b4a6e];
const DOMES = [GOLD, 0x2f8f8a, 0xc0392b, 0x3d6fb6, 0x3f8f5f, 0xe8e8e8];

// 圆形柔边雪花贴图
function snowDot() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new ctx_THREE.CanvasTexture(c);
}
let ctx_THREE = null;

export function build(ctx) {
  ctx_THREE = ctx.THREE;
  const { b, col, layout, scene } = ctx;
  const { DISTRICTS, ROAD_W, SIDEWALK_W: SW, LANDMARKS, blocksOf } = layout;
  const D = DISTRICTS.tundra, R = D.rect, hw = ROAD_W / 2;
  const rnd = ctx.rng(73019);
  const rr = (a, c) => a + (c - a) * rnd();
  const pick = (arr) => arr[(rnd() * arr.length) | 0];

  // —— 必须保持空旷的点（地标 front + POI）
  const clearPts = Object.values(POI).map(p => ({ x: p.x, z: p.z }));
  for (const L of Object.values(LANDMARKS)) if (L.district === 'tundra' && L.front) clearPts.push(L.front);
  // 案件系统已知的 NPC / 线索偏移点（相对 front）
  for (const [k, dx, dz] of [['mrBig', 6, 4], ['iceFactory', 4, 3], ['iceFactory', -10, 4], ['iceFactory', -14, 5], ['iceFactory', 10, 6], ['iceFactory', -2, 9], ['iceFactory', -18, 8], ['tundraPlaza', -8, 3], ['tundraPlaza', -12, 6]]) {
    const f = LANDMARKS[k].front; clearPts.push({ x: f.x + dx, z: f.z + dz });
  }
  const isClear = (x, z, rad = 1) => clearPts.every(p => Math.hypot(p.x - x, p.z - z) > rad + 3.2);

  // —— 几何辅助
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const M = (x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => {
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
    return _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  };
  const triShape = new THREE.Shape();
  triShape.moveTo(-0.5, 0); triShape.lineTo(0.5, 0); triShape.lineTo(0, 1); triShape.closePath();
  const prismGeo = new THREE.ExtrudeGeometry(triShape, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
  // 三棱柱：三角形在局部 xy 平面（宽 sx、高 h），沿局部 z 拉伸 sz（屋脊沿局部 z）
  const prism = (sx, h, sz, x, y, z, ry, color, o = {}) => b.add(prismGeo, M(x, y, z, sx, h, sz, ry), color, o);
  const onionGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0.72, 0), new THREE.Vector2(0.92, 0.12), new THREE.Vector2(1.0, 0.28), new THREE.Vector2(0.9, 0.46),
    new THREE.Vector2(0.6, 0.66), new THREE.Vector2(0.28, 0.82), new THREE.Vector2(0.08, 0.95), new THREE.Vector2(0.0, 1.02),
  ], 10);
  const onion = (x, y, z, r, h, color) => {
    b.add(onionGeo, M(x, y, z, r, h, r), color, { mat: 'shiny' });
    b.cyl(r * 0.05, r * 0.09, h * 0.45, x, y + h * 0.95, z, GOLD, { mat: 'metal', seg: 6 });
    b.sphere(r * 0.09, x, y + h * 1.42, z, GOLD, { mat: 'metal', seg: 6 });
  };
  const icicles = (x0, z0, x1, z1, y, n) => {
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n + (rnd() - 0.5) * 0.4 / n;
      b.cone(rr(0.08, 0.2), rr(0.4, 1.6), x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t, ICE, { mat: 'ice', rx: Math.PI, seg: 4, shadow: false });
    }
  };
  const snowPile = (x, z, r) => b.sphere(r, x, 0, z, WHITE, { sy: 0.42, seg: 8, shadow: false });
  const pine = (x, z, s = 1) => {
    b.cyl(0.22 * s, 0.32 * s, 1.6 * s, x, 0, z, 0x5a3c26, { seg: 6 });
    const tiers = [[2.6, 3.2, 1.1], [2.0, 2.8, 2.9], [1.3, 2.4, 4.5]];
    for (const [cr, ch, cy] of tiers) {
      b.cone(cr * s, ch * s, x, cy * s, z, 0x2f5a46, { mat: 'leaf', seg: 8 });
      b.cone(cr * s * 0.62, ch * s * 0.5, x, (cy + ch * 0.52) * s, z, WHITE, { seg: 8 });
    }
    col.circle(x, z, 0.5 * s, { yMax: 7 * s });
  };
  const bench = (x, z, alongX) => {
    const [w, d] = alongX ? [2.2, 0.6] : [0.6, 2.2];
    b.box(w, 0.1, d, x, 0.45, z, WOOD);
    b.box(w, 0.06, d, x, 0.55, z, WHITE, { shadow: false });
    for (const s of [-0.8, 0.8]) b.box(alongX ? 0.1 : 0.5, 0.45, alongX ? 0.5 : 0.1, x + (alongX ? s : 0), 0, z + (alongX ? 0 : s), DARK);
  };
  const lamp = (x, z, alongX = true) => {
    b.box(0.5, 0.5, 0.5, x, 0.15, z, DARK);
    b.cyl(0.09, 0.14, 5.2, x, 0.6, z, 0x24343a, { seg: 8, mat: 'metal' });
    b.box(alongX ? 1.9 : 0.12, 0.12, alongX ? 0.12 : 1.9, x, 5.6, z, 0x24343a, { mat: 'metal' });
    for (const s of [-0.85, 0.85]) {
      const lx = x + (alongX ? s : 0), lz = z + (alongX ? 0 : s);
      b.box(0.36, 0.55, 0.36, lx, 5.0, lz, 0xffe2a0, { mat: 'glow', shadow: false });
      b.box(0.52, 0.14, 0.52, lx, 5.58, lz, WHITE, { shadow: false });
    }
    b.cone(0.3, 0.35, x, 5.72, z, WHITE, { seg: 6, shadow: false });
    col.circle(x, z, 0.3, { yMax: 5.8 });
  };
  const iceSculpture = (x, z, kind, s = 1) => {
    b.box(2.6 * s, 1.0, 2.6 * s, x, 0, z, 0xdfe7ee);
    const y0 = 1.0;
    const o = { mat: 'ice', seg: 10 };
    if (kind === 0) { // 北极熊
      b.sphere(1.0 * s, x, y0 + 0.9 * s, z, ICE, { ...o, sx: 1.3, sz: 0.8 });
      b.sphere(0.55 * s, x + 1.2 * s, y0 + 1.5 * s, z, ICE, o);
      b.sphere(0.2 * s, x + 1.7 * s, y0 + 1.4 * s, z, ICE, o);
      for (const sz of [-0.3, 0.3]) b.sphere(0.16 * s, x + 1.1 * s, y0 + 2.0 * s, z + sz * s, ICE, o);
    } else if (kind === 1) { // 天鹅
      b.sphere(0.9 * s, x, y0 + 0.7 * s, z, ICE, { ...o, sx: 1.4, sy: 0.7 });
      b.cyl(0.18 * s, 0.25 * s, 1.8 * s, x + 0.9 * s, y0 + 0.8 * s, z, ICE, { ...o, rz: 0.35 });
      b.sphere(0.3 * s, x + 0.35 * s, y0 + 2.5 * s, z, ICE, o);
    } else if (kind === 2) { // 冰晶簇
      for (let k = 0; k < 5; k++) b.cone(0.45 * s, rr(1.5, 3.2) * s, x + rr(-0.6, 0.6) * s, y0, z + rr(-0.6, 0.6) * s, ICE, { mat: 'ice', seg: 5, rx: rr(-0.3, 0.3), rz: rr(-0.3, 0.3) });
    } else { // 雪花
      b.cyl(0.12 * s, 0.12 * s, 1.2 * s, x, y0, z, ICE, o);
      for (let k = 0; k < 3; k++) b.box(3.0 * s, 0.25 * s, 0.25 * s, x, y0 + 2.4 * s, z, ICE, { mat: 'ice', rz: k * Math.PI / 3 });
    }
    col.circle(x, z, 1.5 * s, { yMax: 4 * s });
  };
  // 面向某一侧（s/n/e/w）的立面坐标
  const onFace = (cx, cz, w, d, face, u, out) => {
    if (face === 's') return { x: cx + u, z: cz + d / 2 + out, ax: true, len: w };
    if (face === 'n') return { x: cx - u, z: cz - d / 2 - out, ax: true, len: w };
    if (face === 'e') return { x: cx + w / 2 + out, z: cz - u, ax: false, len: d };
    return { x: cx - w / 2 - out, z: cz + u, ax: false, len: d };
  };
  const faceBox = (f, fw, fh, ft, y, color, o) => b.box(f.ax ? fw : ft, fh, f.ax ? ft : fw, f.x, y, f.z, color, o);
  const faceIcicles = (cx, cz, w, d, face, y, n) => {
    const L = face === 's' || face === 'n' ? w : d;
    const a = onFace(cx, cz, w, d, face, -L / 2 + 0.4, 0.2), c = onFace(cx, cz, w, d, face, L / 2 - 0.4, 0.2);
    icicles(a.x, a.z, c.x, c.z, y, n);
  };
  const signs = [];
  const addSign = (text, width, x, y, z, ry, opts = {}) => {
    const m = ctx.tex.signMesh(text, width, opts);
    m.position.set(x, y, z); m.rotation.y = ry;
    scene.add(m); signs.push(m);
    return m;
  };

  // ———————————————————— 地面 / 道路 / 标线 ————————————————————
  const W = R.x1 - R.x0, Dd = R.z1 - R.z0, CX = (R.x0 + R.x1) / 2, CZ = (R.z0 + R.z1) / 2;
  b.box(W, 0.008, Dd, CX, 0, CZ, D.ground, { shadow: false });
  for (const x of D.roadsX) b.box(ROAD_W, 0.02, Dd, x, 0, CZ, ROAD, { shadow: false });
  for (const z of D.roadsZ) b.box(W, 0.02, ROAD_W, CX, 0, z, ROAD, { shadow: false });

  const intervals = (a0, a1, crosses) => {
    const cs = [...crosses].sort((p, q) => p - q);
    const out = []; let s = a0;
    for (const c of cs) { if (c - hw - 5 > s) out.push([s, c - hw - 5]); s = c + hw + 5; }
    if (a1 > s) out.push([s, a1]);
    return out;
  };
  const MK = { shadow: false };
  for (const x of D.roadsX) for (const [a, c] of intervals(R.z0, R.z1, D.roadsZ)) {
    for (let z = a + 2; z + 4 < c; z += 9) {
      b.box(0.25, 0.01, 4, x, 0.02, z + 2, 0xf2c230, MK);
      for (const s of [-3.5, 3.5]) b.box(0.15, 0.01, 3, x + s, 0.02, z + 2, 0xf4f4f4, MK);
    }
  }
  for (const z of D.roadsZ) for (const [a, c] of intervals(R.x0, R.x1, D.roadsX)) {
    for (let x = a + 2; x + 4 < c; x += 9) {
      b.box(4, 0.01, 0.25, x + 2, 0.02, z, 0xf2c230, MK);
      for (const s of [-3.5, 3.5]) b.box(3, 0.01, 0.15, x + 2, 0.02, z + s, 0xf4f4f4, MK);
    }
  }
  // 斑马线
  for (const x of D.roadsX) for (const z of D.roadsZ) {
    for (const sgn of [-1, 1]) {
      for (let k = -hw + 1; k <= hw - 1; k += 1.4) {
        b.box(0.7, 0.01, 3.2, x + k, 0.02, z + sgn * (hw + 2.4), 0xf4f4f4, MK);
        b.box(3.2, 0.01, 0.7, x + sgn * (hw + 2.4), 0.02, z + k, 0xf4f4f4, MK);
      }
    }
  }

  // ———————————————————— 街区 ————————————————————
  const blocks = blocksOf('tundra');
  for (const bk of blocks) {
    const roadN = bk.z0 > R.z0 + 1, roadS = bk.z1 < R.z1 - 1, roadW = bk.x0 > R.x0 + 1, roadE = bk.x1 < R.x1 - 1;
    // 人行道（高 0.15，可站立）
    const strip = (cx, cz, w, d) => { b.box(w, 0.15, d, cx, 0, cz, WALK, { shadow: false }); col.box(cx, cz, w, d, { yMax: 0.15, walkable: true }); };
    if (roadN) strip(bk.cx, bk.z0 + SW / 2, bk.w, SW);
    if (roadS) strip(bk.cx, bk.z1 - SW / 2, bk.w, SW);
    if (roadW) strip(bk.x0 + SW / 2, bk.cz, SW, bk.d);
    if (roadE) strip(bk.x1 - SW / 2, bk.cz, SW, bk.d);
    // 路灯 + 街角雪堆
    const lampOK = (x, z) => z < -352 && isClear(x, z, 0.5);
    for (let x = bk.x0 + 9; x < bk.x1 - 8; x += 34) {
      if (roadN && lampOK(x, bk.z0 + 0.9)) lamp(x, bk.z0 + 0.9, true);
      if (roadS && lampOK(x, bk.z1 - 0.9)) lamp(x, bk.z1 - 0.9, true);
    }
    for (let z = bk.z0 + 26; z < bk.z1 - 8; z += 34) {
      if (roadW && lampOK(bk.x0 + 0.9, z)) lamp(bk.x0 + 0.9, z, false);
      if (roadE && lampOK(bk.x1 - 0.9, z)) lamp(bk.x1 - 0.9, z, false);
    }
    for (const [x, z] of [[bk.x0 + 2.2, bk.z0 + 2.2], [bk.x1 - 2.2, bk.z0 + 2.2], [bk.x0 + 2.2, bk.z1 - 2.2], [bk.x1 - 2.2, bk.z1 - 2.2]]) {
      if (z < -350) snowPile(x, z, rr(0.9, 1.5));
    }
    const a = {
      x0: bk.x0 + (roadW ? SW : 0) + 2, x1: bk.x1 - (roadE ? SW : 0) - 2,
      z0: bk.z0 + (roadN ? SW : 0) + 2, z1: bk.z1 - (roadS ? SW : 0) - 2,
      roadN, roadS, roadW, roadE,
    };
    if (!roadS) a.z1 = Math.min(a.z1, -364); // 气候墙前留出维护通道
    if (bk.landmark === 'tundraPlaza') buildPlaza();
    else if (bk.landmark === 'iceLake') buildLake();
    else if (bk.landmark === 'mrBig') buildMrBig();
    else if (bk.landmark === 'iceFactory') buildFactory();
    else fillBlock(a);
  }

  // —— 普通街区：网格分格，周边建楼、内部做小公园
  function fillBlock(a) {
    const w = a.x1 - a.x0, d = a.z1 - a.z0;
    if (w < 10 || d < 10) return;
    const nx = Math.max(1, Math.round(w / 38)), nz = Math.max(1, Math.round(d / 36));
    const cw = w / nx, cd = d / nz;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x0 = a.x0 + i * cw, z0 = a.z0 + j * cd;
      const cx = x0 + cw / 2, cz = z0 + cd / 2;
      const faces = [];
      if (j === 0 && a.roadN) faces.push('n');
      if (j === nz - 1 && a.roadS) faces.push('s');
      if (i === 0 && a.roadW) faces.push('w');
      if (i === nx - 1 && a.roadE) faces.push('e');
      const perim = faces.length > 0;
      const face = perim ? pick(faces) : pick(['n', 's', 'e', 'w']);
      if ((!perim && rnd() < 0.7) || (perim && rnd() < 0.1)) { park(x0 + 1, z0 + 1, x0 + cw - 1, z0 + cd - 1); continue; }
      const bw = Math.max(8, cw - rr(3, 9)), bd = Math.max(8, cd - rr(3, 9));
      building(cx, cz, bw, bd, face);
    }
  }

  function park(x0, z0, x1, z1) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const sculpt = rnd() < 0.35 && w > 14 && d > 14;
    if (sculpt) iceSculpture(cx, cz, (rnd() * 4) | 0, rr(1, 1.6));
    const n = Math.min(9, Math.max(2, (w * d / 180) | 0));
    for (let k = 0; k < n; k++) {
      const x = rr(x0 + 2, x1 - 2), z = rr(z0 + 2, z1 - 2);
      if (sculpt && Math.hypot(x - cx, z - cz) < 6) continue;
      if (isClear(x, z, 2.6)) pine(x, z, rr(0.8, 1.5));
    }
    for (let k = 0; k < 3; k++) snowPile(rr(x0 + 2, x1 - 2), rr(z0 + 2, z1 - 2), rr(1, 2.4));
    if (rnd() < 0.5) bench(cx + rr(-3, 3), z1 - 1.5, true);
  }

  function building(cx, cz, w, d, face) {
    const t = rnd();
    const color = pick(WALLS);
    const f0 = onFace(cx, cz, w, d, face, 0, 0.2);
    if (t < 0.1 && w < 30 && d < 30) { // 冰屋商店
      const r = Math.min(w, d) * 0.45;
      b.sphere(r, cx, 0, cz, 0xe6f1f8, { sy: 0.78, seg: 12, mat: 'shiny' });
      for (let k = 1; k < 4; k++) b.cyl(r * Math.sqrt(1 - (k / 4.2) ** 2) + 0.05, r * Math.sqrt(1 - (k / 4.2) ** 2) + 0.05, 0.12, cx, k / 4.2 * r * 0.78, cz, 0xcfe0ec, { seg: 12, shadow: false });
      const ent = onFace(cx, cz, 0, 0, face, 0, r * 0.85);
      const ry = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[face];
      b.box(4.2, 3.8, 3.4, ent.x, 0, ent.z, 0xe6f1f8, { ry });
      const door = onFace(cx, cz, 0, 0, face, 0, r * 0.85 + 1.75);
      b.box(2.4, 2.8, 0.2, door.x, 0, door.z, 0x3a5a7a, { ry });
      b.box(3.6, 0.7, 0.25, door.x, 3.0, door.z, pick([0xff7f50, 0x5fd3ff, 0xffd34d, 0xff88c8]), { ry, mat: 'glow', shadow: false });
      col.circle(cx, cz, r * 0.95, { yMax: r * 0.78 });
      col.box(ent.x, ent.z, 4.2, 3.4, { ry, yMax: 3.8 });
      return;
    }
    let h, roofTop;
    if (t < 0.5) { // 洋葱顶楼
      h = rr(10, 22) + (rnd() < 0.15 ? rr(10, 18) : 0);   // 冰川镇以 3–6 层俄式街屋为主
      const mat = h > 34 ? 'facadeBig' : 'facade';
      b.box(w, h, d, cx, 0, cz, color, { mat });
      b.box(w + 0.8, 0.8, d + 0.8, cx, h, cz, 0xefe3c4);
      b.box(w + 0.4, 0.6, d + 0.4, cx, h + 0.8, cz, WHITE);
      b.box(w + 0.3, 0.9, d + 0.3, cx, 0, cz, 0x8a8f96);
      roofTop = h + 1.4;
      const r = Math.min(w, d) * rr(0.18, 0.3), dc = pick(DOMES);
      b.cyl(r, r, r * 1.2, cx, roofTop, cz, 0xefe3c4, { seg: 10, mat: 'facade' });
      onion(cx, roofTop + r * 1.2, cz, r * 1.25, r * 2.6, dc);
      if (rnd() < 0.45 && w > 16 && d > 16) {
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const px = cx + sx * (w / 2 - 2.5), pz = cz + sz * (d / 2 - 2.5);
          b.cyl(1.4, 1.4, 3, px, roofTop, pz, 0xefe3c4, { seg: 8 });
          onion(px, roofTop + 3, pz, 1.7, 3.4, pick(DOMES));
        }
      }
      faceIcicles(cx, cz, w, d, face, h, Math.round(w / 3));
      col.box(cx, cz, w, d, { yMax: roofTop + r * 4 });
      faceBox(f0, 3.2, 5, 0.4, 0, WOOD);
      faceBox(onFace(cx, cz, w, d, face, 0, 0.25), 4.4, 0.6, 0.6, 5, 0xefe3c4);
    } else if (t < 0.75) { // 坡顶小楼
      h = rr(8, 18);
      b.box(w, h, d, cx, 0, cz, color, { mat: 'facade' });
      const ax = face === 's' || face === 'n';
      const rh = Math.min(w, d) * 0.38;
      const roofC = pick([0xb8322f, 0x2f8f8a, 0x2d4a6b, 0x5a3c2c]);
      prism((ax ? d : w) + 1.2, rh, (ax ? w : d) + 1.2, cx, h - 0.25, cz, ax ? Math.PI / 2 : 0, roofC);
      prism((ax ? d : w) + 1.0, rh, (ax ? w : d) + 0.8, cx, h + 0.05, cz, ax ? Math.PI / 2 : 0, WHITE);
      const chx = cx + (ax ? w * 0.25 : 0), chz = cz + (ax ? 0 : d * 0.25);
      b.box(1.4, rh + 2, 1.4, chx, h, chz, 0x8a5a44);
      b.box(1.7, 0.4, 1.7, chx, h + rh + 2, chz, WHITE);
      faceIcicles(cx, cz, w, d, face, h - 0.25, Math.round(w / 2.5));
      faceBox(f0, 2.8, 4.2, 0.4, 0, WOOD);
      col.box(cx, cz, w, d, { yMax: h + rh });
    } else { // 北极熊尺度大楼
      h = rr(24, 50);
      b.box(w, h, d, cx, 0, cz, color, { mat: 'facadeBig' });
      b.box(w + 0.6, 1.2, d + 0.6, cx, h, cz, 0xefe3c4);
      b.box(w + 0.4, 0.7, d + 0.4, cx, h + 1.2, cz, WHITE);
      if (rnd() < 0.5) {
        b.box(w * 0.5, 6, d * 0.5, cx, h + 1.2, cz, color, { mat: 'facade' });
        b.box(w * 0.5 + 0.4, 0.5, d * 0.5 + 0.4, cx, h + 7.2, cz, WHITE);
      }
      // 大门：6×10m + 门框 + 门檐
      faceBox(f0, 6, 10, 0.5, 0, 0x4a2e1c);
      faceBox(onFace(cx, cz, w, d, face, 0, 0.15), 8, 11.2, 0.3, 0, 0xefe3c4);
      faceBox(onFace(cx, cz, w, d, face, 0, 1.4), 10, 0.6, 3, 11.2, 0x2d4a6b);
      faceBox(onFace(cx, cz, w, d, face, 0, 1.4), 10.2, 0.35, 3.2, 11.8, WHITE);
      faceIcicles(cx, cz, w, d, face, h, Math.round(w / 2.5));
      col.box(cx, cz, w, d, { yMax: h + 8 });
    }
  }

  // ———————————————————— 冰川镇广场 ————————————————————
  function buildPlaza() {
    const L = LANDMARKS.tundraPlaza, cx = L.x, cz = L.z;
    b.box(178, 0.04, 128, cx, 0, cz, 0xd3dce6, { shadow: false });
    b.cyl(30, 30, 0.05, cx, 0, cz, 0xbac8d6, { seg: 24, shadow: false });
    b.cyl(24, 24, 0.06, cx, 0, cz, 0xe2e9f0, { seg: 24, shadow: false });
    // 中央冰雕：台阶 + 直立北极熊托举雪花 + 冰晶
    b.cyl(10, 10, 0.5, cx, 0, cz, 0xc9d3dd, { seg: 16 });
    b.cyl(8.5, 8.5, 1.1, cx, 0, cz, 0xb6c2ce, { seg: 16 });
    col.circle(cx, cz, 10, { yMax: 0.5, walkable: true });
    col.circle(cx, cz, 8.5, { yMax: 1.1, walkable: true });
    const io = { mat: 'ice', seg: 12 };
    const y0 = 1.1;
    b.cyl(3.2, 3.6, 1.5, cx, y0, cz, ICE, io);
    for (const s of [-1, 1]) b.cyl(0.9, 1.1, 3.2, cx + s * 1.2, y0 + 1.2, cz, ICE, io);
    b.sphere(2.6, cx, y0 + 6.5, cz, ICE, { ...io, sy: 1.5, sz: 0.85 });
    b.sphere(1.5, cx, y0 + 10.6, cz + 0.3, ICE, io);
    b.sphere(0.6, cx, y0 + 10.3, cz + 1.7, ICE, io);
    for (const s of [-1, 1]) {
      b.sphere(0.5, cx + s * 1.0, y0 + 11.9, cz, ICE, io);
      b.cyl(0.6, 0.7, 4.2, cx + s * 2.2, y0 + 7.5, cz, ICE, { ...io, rz: -s * 0.35 });
    }
    for (let k = 0; k < 3; k++) b.box(5.5, 0.4, 0.4, cx, y0 + 15.2, cz, 0xdff6ff, { mat: 'ice', rz: k * Math.PI / 3 });
    b.sphere(0.8, cx, y0 + 15.4, cz, 0xdff6ff, io);
    for (let k = 0; k < 10; k++) {
      const an = k / 10 * Math.PI * 2, rd = rr(4.5, 7);
      b.cone(rr(0.5, 0.9), rr(2, 4.5), cx + Math.cos(an) * rd, y0, cz + Math.sin(an) * rd, ICE, { mat: 'ice', seg: 5, rx: Math.sin(an) * 0.3, rz: -Math.cos(an) * 0.3 });
    }
    col.circle(cx, cz, 3.8, { yMax: 17 });
    // 集市摊位：东西两排
    const stall = (x, z, faceE) => {
      const c = pick([0xc0392b, 0x2f8f8a, 0x3d6fb6, 0xd9a441]);
      b.box(2.4, 1.1, 4, x, 0, z, WOOD);
      for (const sz of [-1.8, 1.8]) for (const sx of [-1, 1]) b.box(0.15, 2.8, 0.15, x + sx * 1.1, 0, z + sz, DARK);
      for (let k = 0; k < 4; k++) b.box(3.2, 0.15, 1.2, x, 2.8, z - 1.8 + k * 1.2, k % 2 ? 0xf2efe6 : c);
      b.box(3.3, 0.2, 4.9, x, 2.95, z, WHITE, { shadow: false });
      for (let k = 0; k < 4; k++) b.sphere(0.2, x + (faceE ? 0.6 : -0.6), 1.3, z - 1.2 + k * 0.8, pick([0xff6b6b, 0xffd34d, 0x8fd16a, 0xffffff]), { seg: 6, shadow: false });
      col.box(x, z, 2.6, 4.2, { yMax: 3.1 });
    };
    for (let z = cz - 40; z <= cz + 34; z += 9) { stall(cx - 66, z, true); stall(cx + 66, z, false); }
    // 北侧洋葱顶大教堂
    const kx = cx, kz = cz - 56;
    b.box(44, 18, 20, kx, 0, kz, 0xefe3c4, { mat: 'facade' });
    b.box(44.6, 0.8, 20.6, kx, 18, kz, 0xb8322f);
    b.box(44.4, 0.5, 20.4, kx, 18.8, kz, WHITE);
    b.box(14, 10, 14, kx, 19, kz, 0x2f8f8a, { mat: 'facade' });
    b.box(14.4, 0.5, 14.4, kx, 29, kz, WHITE);
    b.cyl(5, 5, 4, kx, 29.5, kz, 0xefe3c4, { seg: 12 });
    onion(kx, 33.5, kz, 6.2, 12, GOLD);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const px = kx + sx * 17, pz = kz + sz * 6.5;
      b.cyl(2.6, 2.6, 8, px, 19, pz, 0xb8322f, { seg: 10, mat: 'facade' });
      onion(px, 27, pz, 3.1, 6.5, pick([0x2f8f8a, 0x3d6fb6, 0xc0392b]));
    }
    b.box(7, 10, 0.6, kx, 0, kz + 10.2, 0x4a2e1c);
    b.box(9, 1, 1.4, kx, 10, kz + 10.4, GOLD, { mat: 'metal' });
    icicles(kx - 21, kz + 10.4, kx + 21, kz + 10.4, 18, 16);
    col.box(kx, kz, 44, 20, { yMax: 46 });
    // 四角钟塔
    for (const [px, pz] of [[cx - 86, cz - 58], [cx + 86, cz - 58], [cx - 86, cz + 56], [cx + 86, cz + 56]]) {
      b.cyl(3.6, 4, 20, px, 0, pz, pick([0x2f8f8a, 0xb8322f, 0xefe3c4]), { seg: 10, mat: 'facade' });
      b.cyl(4.3, 4.3, 0.6, px, 20, pz, WHITE, { seg: 10 });
      onion(px, 20.6, pz, 4.2, 8, pick(DOMES));
      col.circle(px, pz, 4.1, { yMax: 32 });
    }
    // 南侧拱门 + 招牌
    for (const s of [-1, 1]) {
      b.box(3, 12, 3, cx + s * 16, 0, cz + 60, 0x2f8f8a);
      b.box(3.6, 0.5, 3.6, cx + s * 16, 12, cz + 60, WHITE);
      onion(cx + s * 16, 12.5, cz + 60, 1.8, 3.6, GOLD);
      col.box(cx + s * 16, cz + 60, 3, 3, { yMax: 16 });
    }
    b.box(29, 2.4, 2, cx, 10, cz + 60, 0xb8322f);
    b.box(29.4, 0.4, 2.4, cx, 12.4, cz + 60, WHITE);
    col.box(cx, cz + 60, 29, 2, { yMin: 10, yMax: 12.8 });
    icicles(cx - 13, cz + 61.1, cx + 13, cz + 61.1, 10, 14);
    addSign('冰川镇广场', 11, cx, 11.2, cz + 61.05, 0, { bg: '#b8322f', fg: '#fff6dc', border: '#d9a520' });
    // 广场内路灯、树、长椅、雪堆
    for (let k = 0; k < 8; k++) {
      const an = (k + 0.5) / 8 * Math.PI * 2;
      const lx = cx + Math.cos(an) * 28, lz = cz + Math.sin(an) * 28;
      if (isClear(lx, lz, 0.5)) lamp(lx, lz, Math.abs(Math.cos(an)) < 0.7);
    }
    for (let z = cz - 50; z <= cz + 50; z += 14) { pine(cx - 84, z, 1.2); pine(cx + 84, z, 1.2); }
    for (const s of [-1, 1]) for (const dz of [-14, 14]) bench(cx + s * 36, cz + dz, false);
    for (let k = 0; k < 10; k++) {
      const x = cx + rr(-80, 80), z = cz + rr(-45, 50);
      if (Math.hypot(x - cx, z - cz) > 32 && isClear(x, z, 2)) snowPile(x, z, rr(0.8, 1.6));
    }
    ctx.addLabel(cx, 20, cz, L.name, D.color);
  }

  // ———————————————————— 冰湖 ————————————————————
  function buildLake() {
    const L = LANDMARKS.iceLake, cx = L.x, cz = L.z, RX = 70, RZ = 50;
    b.cyl(1, 1, 0.03, cx, 0, cz, 0x2d5d7e, { sx: RX, sz: RZ, seg: 40, shadow: false });
    b.cyl(1, 1, 0.04, cx, 0.03, cz, ICE, { sx: RX - 0.5, sz: RZ - 0.5, seg: 40, mat: 'ice' });
    // 冰面划痕（溜冰轨迹）
    for (let k = 0; k < 14; k++) {
      const an = rnd() * Math.PI * 2, rd = rr(0.2, 0.75);
      b.box(rr(6, 16), 0.005, 0.12, cx + Math.cos(an) * RX * rd, 0.071, cz + Math.sin(an) * RZ * rd, 0xeefaff, { ry: rnd() * Math.PI, shadow: false });
    }
    // 围栏：红白相间护板，东南西北各留开口
    const N = 64, FR = 1.05;
    for (let k = 0; k < N; k++) {
      const midA = (k + 0.5) / N * Math.PI * 2;
      const gap = [0, Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI * 2].some(g => Math.abs(midA - g) < 0.09);
      if (gap) continue;
      const a0 = k / N * Math.PI * 2, a1 = (k + 1) / N * Math.PI * 2;
      const x0 = cx + Math.cos(a0) * RX * FR, z0 = cz + Math.sin(a0) * RZ * FR;
      const x1 = cx + Math.cos(a1) * RX * FR, z1 = cz + Math.sin(a1) * RZ * FR;
      const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0);
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      b.box(len, 1.0, 0.22, mx, 0, mz, k % 2 ? 0xc0392b : 0xf4f4f4, { ry });
      b.box(len, 0.12, 0.34, mx, 1.0, mz, WHITE, { ry, shadow: false });
      b.box(0.3, 1.25, 0.3, x0, 0, z0, 0x2d4a6b);
      col.box(mx, mz, len, 0.3, { ry, yMax: 1.15 });
    }
    // 冰钓小屋（冰面上）
    const hut = (x, z, w, d, h, c, ry = 0) => {
      b.box(w, h, d, x, 0, z, c, { ry });
      prism(w + 0.5, h * 0.45, d + 0.5, x, h, z, ry, WHITE);
      const dx = Math.sin(ry), dz = Math.cos(ry);
      b.box(w * 0.4, h * 0.75, 0.1, x + dx * (d / 2 + 0.05), 0, z + dz * (d / 2 + 0.05), 0x3a2a1c, { ry });
      col.box(x, z, w, d, { ry, yMax: h * 1.45 });
    };
    hut(-134, -680, 2.6, 2.6, 2.4, 0xc0392b);
    hut(-72, -638, 2.4, 2.4, 2.2, 0x2f8f8a, 0.4);
    hut(-62, -688, 2.6, 2.4, 2.3, 0xd9a441, -0.3);
    hut(-142, -640, 2.2, 2.4, 2.2, 0x3d6fb6, 0.8);
    for (const [x, z] of [[-130, -684], [-69, -642], [-60, -692]]) b.cyl(0.4, 0.4, 0.02, x, 0.07, z, 0x1d3f58, { seg: 10, shadow: false });
    // 岸边：冰鞋租赁、热可可、取暖屋
    const shore = (x, z, w, d, h, c, text, bg) => {
      b.box(w, h, d, x, 0, z, c, { mat: 'facade' });
      prism(w + 1, h * 0.5, d + 1, x, h, z, 0, 0x8a3b2e);
      prism(w + 0.8, h * 0.5, d + 0.6, x, h + 0.25, z, 0, WHITE);
      b.box(2.2, 3, 0.2, x, 0, z - d / 2 - 0.1, WOOD);
      icicles(x - w / 2, z - d / 2 - 0.4, x + w / 2, z - d / 2 - 0.4, h, 8);
      col.box(x, z, w, d, { yMax: h * 1.5 });
      if (text) addSign(text, Math.min(w - 1, 6), x, h - 1.0, z - d / 2 - 0.25, Math.PI, { bg, fg: '#ffffff' });
    };
    shore(-160, -598, 8, 5, 4.2, 0x2f8f8a, '冰鞋租赁', '#1d5b7a');
    shore(-50, -598, 8, 5, 4.2, 0xb8322f, '热可可', '#7a2a1a');
    shore(-189, -660, 7, 9, 4, 0xefe3c4, null);
    b.cone(0.9, 1.4, -184, 0, -660, 0xff9a40, { mat: 'glow', seg: 6, shadow: false }); // 篝火
    b.cyl(1.2, 1.3, 0.3, -184, 0, -660, 0x555555, { seg: 8 });
    col.circle(-184, -660, 1.3, { yMax: 1.4 });
    // 树、长椅、灯、雪堆
    for (const [x, z] of [[-192, -722], [-180, -726], [-20, -722], [-30, -727], [-192, -600], [-18, -600], [-15, -640], [-16, -690]]) pine(x, z, rr(1.1, 1.6));
    for (let k = 0; k < 10; k++) {
      const an = (k + 0.25) / 10 * Math.PI * 2;
      const lx = cx + Math.cos(an) * (RX + 6), lz = cz + Math.sin(an) * (RZ + 6);
      if (isClear(lx, lz, 0.5) && lx > -197 && lx < -13 && lz > -727 && lz < -593) lamp(lx, lz, Math.abs(Math.sin(an)) > 0.7);
    }
    for (let k = 0; k < 28; k++) {
      const an = rnd() * Math.PI * 2;
      const x = cx + Math.cos(an) * (RX + 3), z = cz + Math.sin(an) * (RZ + 3);
      if (isClear(x, z, 1.5) && x > -197 && x < -13) snowPile(x, z, rr(0.8, 1.5));
    }
    bench(-120, -603, true); bench(-90, -603, true);
    // 动画：滑冰者
    const coatG = new THREE.CylinderGeometry(0.22, 0.34, 0.8, 8).translate(0, 0.75, 0);
    const legG = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 6).translate(0, 0.2, 0);
    const headG = new THREE.SphereGeometry(0.24, 10, 7);
    const earG = new THREE.ConeGeometry(0.07, 0.22, 5);
    const furM = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.9 });
    const skaters = [];
    const paths = [[52, 34, 0.32, 0], [38, 26, -0.42, 2], [22, 15, 0.55, 4]];
    for (const [a, c, w, ph] of paths) {
      const g = new THREE.Group();
      const coat = new THREE.MeshStandardMaterial({ color: pick([0xc0392b, 0x2f8f8a, 0x3d6fb6, 0xd9a441]), roughness: 0.7 });
      g.add(new THREE.Mesh(coatG, coat));
      for (const s of [-0.1, 0.1]) { const l = new THREE.Mesh(legG, furM); l.position.x = s; g.add(l); }
      const hd = new THREE.Mesh(headG, furM); hd.position.y = 1.35; g.add(hd);
      for (const s of [-0.12, 0.12]) { const e = new THREE.Mesh(earG, furM); e.position.set(s, 1.6, 0); g.add(e); }
      g.traverse(o => { if (o.isMesh) o.castShadow = true; });
      scene.add(g);
      skaters.push({ g, a, c, w, ph });
    }
    ctx.animate((dt, t) => {
      for (const s of skaters) {
        const an = t * s.w + s.ph;
        s.g.position.set(cx + Math.cos(an) * s.a, 0.07, cz + Math.sin(an) * s.c);
        const vx = -Math.sin(an) * s.a * s.w, vz = Math.cos(an) * s.c * s.w;
        s.g.rotation.y = Math.atan2(vx, vz);
        s.g.rotation.z = Math.sin(t * 3 + s.ph) * 0.12;
      }
    });
    ctx.addLabel(cx, 6, cz, L.name, D.color);
  }

  // ———————————————————— 大先生庄园 ————————————————————
  function buildMrBig() {
    const L = LANDMARKS.mrBig, cx = L.x;
    const fx0 = cx - 90, fx1 = cx + 90, fz0 = -865, fz1 = -762;
    // 围墙：石基 + 铁栏 + 石柱，南侧大门开口 x -324..-306
    const fenceSeg = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      const ax = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      b.box(ax ? len : 0.8, 0.9, ax ? 0.8 : len, mx, 0, mz, 0x4a4d55);
      b.box(ax ? len : 0.9, 0.15, ax ? 0.9 : len, mx, 0.9, mz, WHITE, { shadow: false });
      b.box(ax ? len : 0.12, 2.2, ax ? 0.12 : len, mx, 0.9, mz, 0x15171c, { mat: 'metal' });
      b.box(ax ? len : 0.2, 0.15, ax ? 0.2 : len, mx, 3.0, mz, 0x15171c, { mat: 'metal' });
      const n = Math.floor(len / 10);
      for (let k = 0; k <= n; k++) {
        const t = n ? k / n : 0.5;
        const px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t;
        b.box(1.2, 3.6, 1.2, px, 0, pz, 0x3a3d45);
        b.box(1.5, 0.35, 1.5, px, 3.6, pz, WHITE, { shadow: false });
      }
      col.box(mx, mz, ax ? len : 0.9, ax ? 0.9 : len, { yMax: 3.6 });
    };
    fenceSeg(fx0, fz0, fx1, fz0);
    fenceSeg(fx0, fz0, fx0, fz1);
    fenceSeg(fx1, fz0, fx1, fz1);
    fenceSeg(fx0, fz1, cx - 11, fz1);
    fenceSeg(cx + 11, fz1, fx1, fz1);
    // 大门柱 + 敞开的铁门
    for (const s of [-1, 1]) {
      const px = cx + s * 10.5;
      b.box(2.6, 6, 2.6, px, 0, fz1, 0x2f3238);
      b.box(3.0, 0.5, 3.0, px, 6, fz1, WHITE);
      b.sphere(0.7, px, 7.1, fz1, 0x2f3238, { seg: 8 });
      b.box(0.5, 0.7, 0.5, px, 4.6, fz1 + 1.5, 0xffe2a0, { mat: 'glow', shadow: false });
      col.box(px, fz1, 2.6, 2.6, { yMax: 6.5 });
      // 门扇向内敞开
      const hx = cx + s * 9, ry = -s * 1.2;
      const lx = hx - s * Math.cos(1.2) * 3.5, lz = fz1 - Math.sin(1.2) * 3.5;
      b.box(7, 4, 0.15, lx, 0, lz, 0x15171c, { mat: 'metal', ry });
      b.box(7, 0.3, 0.3, lx, 4, lz, GOLD, { mat: 'metal', ry });
      col.box(lx, lz, 7, 0.3, { ry, yMax: 4.3 });
    }
    // 警卫亭 + 北极熊保镖
    for (const s of [-1, 1]) {
      const gx = cx + s * 21, gz = fz1 - 6;
      b.box(4, 4.2, 4, gx, 0, gz, 0x23262d, { mat: 'facade' });
      b.box(4.6, 0.5, 4.6, gx, 4.2, gz, 0x111111);
      b.box(4.8, 0.45, 4.8, gx, 4.7, gz, WHITE);
      b.box(2.6, 1.0, 0.1, gx, 2.2, gz + 2.05, 0xffe2a0, { mat: 'glow', shadow: false });
      col.box(gx, gz, 4, 4, { yMax: 5.2 });
      const bx = gx - s * 4, bz = gz + 1;
      b.cyl(0.8, 0.95, 2.3, bx, 0, bz, 0x111216, { seg: 10 });
      b.sphere(0.95, bx, 2.9, bz, 0xf5f2ea, { seg: 10 });
      b.sphere(0.4, bx, 2.8, bz + 0.85, 0xf5f2ea, { seg: 8 });
      b.sphere(0.12, bx, 2.85, bz + 1.22, 0x111111, { seg: 6 });
      for (const e of [-0.6, 0.6]) b.sphere(0.25, bx + e, 3.7, bz, 0xf5f2ea, { seg: 6 });
      b.box(1.3, 0.12, 0.1, bx, 3.05, bz + 0.85, 0x111111);
      col.circle(bx, bz, 1.0, { yMax: 3.9 });
    }
    // 车道
    b.box(12, 0.03, 38, cx, 0, -781, 0x6b7078, { shadow: false });
    // 车道两侧矮树篱
    for (const s of [-1, 1]) for (let z = -790; z <= -768; z += 7.5) {
      b.box(1.4, 1.2, 6, cx + s * 8, 0, z, 0x234a37, { mat: 'leaf' });
      b.box(1.6, 0.3, 6.2, cx + s * 8, 1.2, z, WHITE, { shadow: false });
      col.box(cx + s * 8, z, 1.4, 6, { yMax: 1.5 });
    }
    // 结冰的喷泉
    for (const s of [-1, 1]) {
      const px = cx + s * 50, pz = -782;
      b.cyl(4.5, 4.8, 0.9, px, 0, pz, 0x8a8f96, { seg: 16 });
      b.cyl(4.1, 4.1, 0.1, px, 0.85, pz, ICE, { seg: 16, mat: 'ice' });
      b.cyl(0.6, 0.9, 2.8, px, 0.9, pz, 0x8a8f96, { seg: 10 });
      b.cyl(2.0, 1.4, 0.4, px, 3.7, pz, 0x8a8f96, { seg: 12 });
      icicles(px - 1.8, pz, px + 1.8, pz, 4.1, 6);
      icicles(px, pz - 1.8, px, pz + 1.8, 4.1, 6);
      b.cone(0.5, 2.2, px, 4.1, pz, ICE, { mat: 'ice', seg: 8 });
      col.circle(px, pz, 4.8, { yMax: 1.0, walkable: true });
      col.circle(px, pz, 1.0, { yMax: 6.3 });
    }
    // 修剪成圆锥形的雪中灌木
    for (const [x, z] of [[-375, -770], [-255, -770], [-385, -795], [-245, -795], [-365, -800], [-265, -800]]) {
      b.cyl(0.25, 0.25, 0.6, x, 0, z, 0x5a3c26, { seg: 6 });
      b.cone(1.4, 3.6, x, 0.5, z, 0x234a37, { mat: 'leaf', seg: 8 });
      b.cone(0.9, 1.6, x, 2.5, z, WHITE, { seg: 8 });
      col.circle(x, z, 1.2, { yMax: 4 });
    }
    // 宅邸主体
    const mz0 = -850, mz1 = -805, mw = 90, mh = 26;
    const mcz = (mz0 + mz1) / 2;
    const dark = 0x2b2b35;
    b.box(mw, mh, mz1 - mz0, cx, 0, mcz, dark, { mat: 'facadeBig' });
    b.box(mw + 1.2, 1.2, mz1 - mz0 + 1.2, cx, mh, mcz, 0xd8d3c4);
    prism(mz1 - mz0 + 1, 8, mw + 1, cx, mh + 1.2, mcz, Math.PI / 2, 0x1c1d22);
    prism(mz1 - mz0 + 0.6, 7.4, mw + 0.4, cx, mh + 1.8, mcz, Math.PI / 2, WHITE);
    for (const s of [-1, 1]) { // 两翼
      const wx = cx + s * 62.5;
      b.box(35, 18, 35, wx, 0, -827.5, dark, { mat: 'facadeBig' });
      b.box(36, 1, 36, wx, 18, -827.5, 0xd8d3c4);
      b.box(35.6, 0.7, 35.6, wx, 19, -827.5, WHITE);
      icicles(wx - 17, -809.6, wx + 17, -809.6, 18, 14);
      col.box(wx, -827.5, 35, 35, { yMax: 20 });
      for (const c of [-8, 8]) { // 烟囱
        b.box(2.2, 10, 2.2, cx + s * 30 + c, mh, mcz - 10, 0x3a2c2a);
        b.box(2.6, 0.5, 2.6, cx + s * 30 + c, mh + 10, mcz - 10, WHITE);
      }
    }
    col.box(cx, mcz, mw, mz1 - mz0, { yMax: mh + 10 });
    icicles(cx - 44, mz1 + 0.6, cx + 44, mz1 + 0.6, mh, 30);
    // 台阶
    b.box(52, 0.45, 12, cx, 0, -801, 0xbfc3c9);
    b.box(49, 0.45, 9, cx, 0.45, -802.5, 0xc9cdd3);
    b.box(46, 0.45, 6, cx, 0.9, -804, 0xd3d7dd);
    col.box(cx, -801, 52, 12, { yMax: 0.45, walkable: true });
    col.box(cx, -802.5, 49, 9, { yMax: 0.9, walkable: true });
    col.box(cx, -804, 46, 6, { yMax: 1.35, walkable: true });
    // 柱廊
    for (let k = 0; k < 6; k++) {
      const px = cx - 20 + k * 8, pz = -802.2;
      b.box(2.6, 0.6, 2.6, px, 1.35, pz, 0xe8e4da);
      b.cyl(1.0, 1.15, 15, px, 1.95, pz, 0xf2efe6, { seg: 12 });
      b.box(2.6, 0.8, 2.6, px, 16.95, pz, 0xe8e4da);
      col.circle(px, pz, 1.3, { yMax: 18 });
    }
    b.box(48, 2.4, 7, cx, 17.75, -803.5, 0xe8e4da);
    prism(48, 6, 7, cx, 20.15, -803.5, 0, 0xe8e4da);
    prism(48.6, 6.3, 6, cx, 20.35, -804, 0, WHITE);
    b.box(2.4, 2.4, 0.3, cx, 21.5, -799.9, GOLD, { mat: 'metal' }); // 门楣徽章
    icicles(cx - 23, -799.8, cx + 23, -799.8, 17.75, 22);
    // 大门（双开）
    b.box(7, 10, 0.4, cx, 1.35, mz1 + 0.2, 0x4a1e1a);
    b.box(0.1, 10, 0.5, cx, 1.35, mz1 + 0.25, 0x2a0e0a);
    for (const s of [-0.6, 0.6]) b.sphere(0.2, cx + s, 6, mz1 + 0.5, GOLD, { mat: 'metal', seg: 6 });
    b.box(9, 1, 0.7, cx, 11.35, mz1 + 0.35, 0xd8d3c4);
    // 台阶两侧北极熊石像
    for (const s of [-1, 1]) {
      const px = cx + s * 30, pz = -796;
      b.box(3, 1.8, 4, px, 0, pz, 0x8a8f96);
      b.sphere(1.2, px, 3.0, pz, 0xb9bcc2, { sx: 1, sy: 1.2, sz: 1.5, seg: 10 });
      b.sphere(0.8, px, 4.3, pz + 1.6, 0xb9bcc2, { seg: 10 });
      b.sphere(0.35, px, 4.1, pz + 2.4, 0xb9bcc2, { seg: 6 });
      b.box(3.2, 0.3, 4.2, px, 1.8, pz, WHITE, { shadow: false });
      col.box(px, pz, 3, 4, { yMax: 5.2 });
    }
    // 花园灯、松树
    for (const [x, z] of [[-340, -770], [-290, -770], [-340, -793], [-290, -793]]) if (isClear(x, z, 0.5)) lamp(x, z, true);
    for (let x = fx0 + 5; x <= fx1 - 5; x += 12) pine(x, fz0 + 5, rr(1.3, 1.8));
    for (let z = -800; z <= fz1 - 8; z += 12) { pine(fx0 + 5, z, rr(1.2, 1.6)); pine(fx1 - 5, z, rr(1.2, 1.6)); }
    for (let k = 0; k < 16; k++) {
      const x = rr(fx0 + 8, fx1 - 8), z = rr(-800, -766);
      if (Math.abs(x - cx) > 12 && isClear(x, z, 2)) snowPile(x, z, rr(0.8, 1.8));
    }
    ctx.addLabel(cx, 34, mcz, L.name, D.color);
  }

  // ———————————————————— 冰棍工厂 ————————————————————
  function buildFactory() {
    const L = LANDMARKS.iceFactory, cx = L.x;
    // 围栏（铁丝网），南侧大门 x 70..130
    const chain = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, ax = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      b.box(ax ? len : 0.08, 2.6, ax ? 0.08 : len, mx, 0, mz, 0x9aa3ad, { mat: 'metal', shadow: false });
      const n = Math.max(1, Math.floor(len / 6));
      for (let k = 0; k <= n; k++) b.cyl(0.08, 0.08, 2.9, x0 + (x1 - x0) * k / n, 0, z0 + (z1 - z0) * k / n, 0x6c747d, { seg: 6 });
      col.box(mx, mz, ax ? len : 0.3, ax ? 0.3 : len, { yMax: 2.9 });
    };
    chain(15, -446, 70, -446); chain(130, -446, 185, -446);
    chain(15, -565, 185, -565); chain(15, -565, 15, -446); chain(185, -565, 185, -446);
    for (const px of [68.5, 131.5]) {
      b.box(1.6, 4, 1.6, px, 0, -446, 0x2d4a6b);
      b.box(1.9, 0.35, 1.9, px, 4, -446, WHITE);
      col.box(px, -446, 1.6, 1.6, { yMax: 4.3 });
    }
    // 门卫亭
    b.box(3.4, 3.2, 3.4, 63, 0, -452, 0x6aa6c9, { mat: 'facade' });
    b.box(4, 0.4, 4, 63, 3.2, -452, WHITE);
    col.box(63, -452, 3.4, 3.4, { yMax: 3.6 });
    // 主厂房
    const hz0 = -520, hz1 = -460, hh = 20, hcz = (hz0 + hz1) / 2;
    b.box(120, hh, hz1 - hz0, cx, 0, hcz, 0xa9c4d3, { mat: 'facadeBig' });
    b.box(120.6, 1, 60.6, cx, hh, hcz, 0x2d4a6b);
    b.box(120.4, 0.5, 60.4, cx, hh + 1, hcz, WHITE);
    for (let k = 0; k < 6; k++) { // 锯齿屋顶
      const sx = cx - 50 + k * 20;
      prism(18, 5, 58, sx, hh + 1.5, hcz, 0, 0xdfe8ee);
      b.box(0.3, 4.2, 56, sx + 4.6, hh + 1.5, hcz, 0x6fa8c8, { mat: 'glass', rz: 0.55 });
    }
    b.box(120.2, 2.2, 0.3, cx, 6, hz1 + 0.1, 0xf2c230, { shadow: false });
    col.box(cx, hcz, 120, 60, { yMax: hh + 7 });
    icicles(cx - 59, hz1 + 0.5, cx + 59, hz1 + 0.5, hh, 40);
    // 冷库大门
    b.box(12, 10, 0.5, cx, 0, hz1 + 0.25, 0x223344);
    for (let k = 0; k < 8; k++) b.box(1.5, 0.8, 0.55, cx - 5.25 + k * 1.5, 10, hz1 + 0.3, k % 2 ? 0x111111 : 0xf2c230, { shadow: false });
    for (const s of [-1, 1]) b.box(0.8, 10, 0.55, cx + s * 6.4, 0, hz1 + 0.3, 0xf2c230, { shadow: false });
    b.box(3.2, 1, 0.2, cx, 11.2, hz1 + 0.4, 0x5fd3ff, { mat: 'glow', shadow: false });
    addSign('冰棍工厂', 22, cx, 15.8, hz1 + 0.6, 0, { bg: '#ff6fa3', fg: '#ffffff', border: '#ffffff' });
    // 装卸平台（东侧前部）
    b.box(20, 1.2, 6, 145, 0, hz1 + 3, 0x8a8f96);
    col.box(145, hz1 + 3, 20, 6, { yMax: 1.2, walkable: true });
    for (const s of [-1, 1]) b.box(5, 6, 0.3, 145 + s * 5, 1.2, hz1 + 0.2, 0x6c747d);
    // 冷藏卡车
    const truck = (x, z) => {
      b.box(2.8, 3.4, 7, x, 0.8, z - 1.5, 0xf4f7fa, { mat: 'shiny' });
      b.box(2.9, 1.2, 3.2, x, 1.6, z - 1.5, 0xff6fa3, { shadow: false });
      b.box(2.6, 2.4, 2.4, x, 0.8, z + 3.3, 0x3d6fb6, { mat: 'shiny' });
      b.box(2.4, 0.9, 0.1, x, 2.0, z + 4.52, 0x223344, { mat: 'glass' });
      for (const wz of [-4, 0.5, 3.3]) for (const s of [-1, 1]) b.cyl(0.55, 0.55, 0.4, x + s * 1.35, 0.55, z + wz, 0x1b1d22, { rz: Math.PI / 2, seg: 10 });
      col.box(x, z, 2.9, 9.6, { yMax: 4.2 });
    };
    truck(52, -455); truck(124, -453);
    // 锅炉房 + 三根烟囱
    b.box(100, 14, 34, cx, 0, -543, 0x8f6f5e, { mat: 'facade' });
    b.box(100.4, 0.6, 34.4, cx, 14, -543, WHITE);
    col.box(cx, -543, 100, 34, { yMax: 15 });
    const stacks = [70, 100, 130].map(x => ({ x, z: -541, top: 46 }));
    for (const s of stacks) {
      b.cyl(2.4, 3.3, s.top, s.x, 0, s.z, 0x9a3b2e, { seg: 12 });
      for (const y of [18, 30, 40]) b.cyl(3.0 - y * 0.012, 3.0 - y * 0.012, 1.4, s.x, y, s.z, WHITE, { seg: 12 });
      b.cyl(2.7, 2.7, 1, s.x, s.top - 1, s.z, 0x3a3d45, { seg: 12 });
      col.circle(s.x, s.z, 3.3, { yMax: s.top });
    }
    // 储罐
    for (const z of [-482, -500, -518, -536]) {
      b.cyl(5.5, 5.5, 15, 172, 0, z, 0xe8eef2, { seg: 12, mat: 'shiny' });
      b.cyl(5.6, 5.6, 1.5, 172, 9, z, 0x3d6fb6, { seg: 12 });
      b.sphere(5.5, 172, 15, z, WHITE, { sy: 0.3, seg: 12 });
      col.circle(172, z, 5.6, { yMax: 17 });
    }
    b.cyl(0.6, 0.6, 9, 166.4, 12, -482, 0x9aa3ad, { rz: Math.PI / 2, seg: 8, mat: 'metal' }); // 管道接主厂房
    // 西侧仓库
    b.box(22, 11, 66, 28, 0, -505, 0xefe3c4, { mat: 'facade' });
    prism(66, 5, 22.6, 28, 11, -505, Math.PI / 2, WHITE);
    col.box(28, -505, 22, 66, { yMax: 16 });
    // 暖风出风口（案件线索：围栏外墙机 + 人行道上的地面格栅）
    b.box(3, 2, 1.5, 80, 0, -443, 0x6c747d);
    b.box(2.4, 1.2, 0.1, 80, 0.4, -442.2, 0xff8a3d, { mat: 'glow', shadow: false });
    for (let k = 0; k < 4; k++) b.box(2.5, 0.08, 0.15, 80, 0.55 + k * 0.28, -442.1, 0x333333, { shadow: false });
    col.box(80, -443, 3, 1.5, { yMax: 2 });
    b.box(3, 0.02, 1.4, 80, 0.15, -429.4, 0x2a2d33, { shadow: false });
    for (let k = 0; k < 6; k++) b.box(0.18, 0.02, 1.2, 78.8 + k * 0.48, 0.16, -429.4, 0xff6a2a, { mat: 'glow', shadow: false });
    // 厂区雪堆
    for (const [x, z] of [[20, -452], [180, -452], [182, -560], [20, -560], [150, -560]]) snowPile(x, z, rr(1.4, 2.4));
    lamp(40, -452, true); lamp(160, -470, false);

    // 动画：烟囱蒸汽
    const puffG = new THREE.SphereGeometry(1, 10, 7);
    const puffs = [];
    for (const s of stacks) for (let k = 0; k < 5; k++) {
      const m = new THREE.Mesh(puffG, new THREE.MeshStandardMaterial({ color: 0xf5f7fa, roughness: 1, transparent: true, opacity: 0.7, depthWrite: false }));
      scene.add(m);
      puffs.push({ m, s, ph: k / 5, jx: rr(-1, 1), jz: rr(-1, 1) });
    }
    // 动画：屋顶旋转冰棍招牌
    const pop = new THREE.Group();
    const pink = new THREE.MeshStandardMaterial({ color: 0xff7fa8, roughness: 0.4 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x5fc8ff, roughness: 0.4 });
    const stickM = new THREE.MeshStandardMaterial({ color: 0xe0b87a, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(7, 9, 1.6), pink); body.position.y = 9.5; pop.add(body);
    const band = new THREE.Mesh(new THREE.BoxGeometry(7.05, 2.2, 1.65), blue); band.position.y = 7; pop.add(band);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 1.6, 16), pink); top.rotation.x = Math.PI / 2; top.position.y = 14; pop.add(top);
    const stick = new THREE.Mesh(new THREE.BoxGeometry(1.4, 5.5, 0.8), stickM); stick.position.y = 2.75; pop.add(stick);
    for (const s of [1, -1]) {
      const t = ctx.tex.signMesh('爪爪冰棍', 6, { bg: '#ff7fa8', fg: '#ffffff' });
      t.position.set(0, 10.8, s * 0.82); t.rotation.y = s > 0 ? 0 : Math.PI; pop.add(t); signs.push(t);
    }
    pop.traverse(o => { if (o.isMesh) o.castShadow = true; });
    pop.position.set(cx, hh + 6.5, hcz);
    scene.add(pop);
    ctx.animate((dt, t) => {
      pop.rotation.y += dt * 0.5;
      for (const p of puffs) {
        const f = (t * 0.22 + p.ph) % 1;
        p.m.position.set(p.s.x + f * 7 + p.jx * f * 2, p.s.top + f * 16, p.s.z + p.jz * f * 3);
        p.m.scale.setScalar(1.6 + f * 5.5);
        p.m.material.opacity = 0.75 * (1 - f) * Math.min(1, f * 8);
      }
    });
    ctx.addLabel(cx, 30, -500, L.name, D.color);
  }

  // ———————————————————— 气候墙 ————————————————————
  const WZ0 = -345, WZ1 = -330, WCZ = (WZ0 + WZ1) / 2, WH = 28, OPEN = 11;
  const openX = [...D.roadsX].sort((p, q) => p - q);
  const segs = []; let sx0 = R.x0;
  for (const x of openX) { segs.push([sx0, x - OPEN]); sx0 = x + OPEN; }
  segs.push([sx0, R.x1]);
  const WALLC = 0xc9d6df;
  for (const [a, c] of segs) {
    const len = c - a, mx = (a + c) / 2;
    if (len <= 0) continue;
    b.box(len, WH, WZ1 - WZ0, mx, 0, WCZ, WALLC);
    b.box(len + 0.1, 1.6, WZ1 - WZ0 + 0.3, mx, 20, WCZ, 0x2f8f8a);
    b.box(len + 0.2, 0.7, WZ1 - WZ0 + 0.6, mx, WH, WCZ, WHITE);
    b.cyl(1, 1, len, c, WH + 0.7, WCZ - 3, 0x9aa3ad, { rz: Math.PI / 2, seg: 8, mat: 'metal' });
    for (let x = a + 6; x < c - 3; x += 12) {
      b.box(1.2, 26, 1, x, 0, WZ0 - 0.5, 0xaebcc6);
      b.box(1.2, 26, 1, x, 0, WZ1 + 0.5, 0xaebcc6);
    }
    for (const ex of [a + 1.6, c - 1.6]) if (ex > R.x0 + 2 && ex < R.x1 - 2) b.box(3.2, WH + 4, WZ1 - WZ0 + 0.6, ex, 0, WCZ, 0x2d4a6b);
    icicles(a + 1, WZ0 - 0.4, c - 1, WZ0 - 0.4, WH, Math.round(len / 4));
    col.box(mx, WCZ, len, WZ1 - WZ0, { yMax: WH + 4 });
  }
  for (const x of openX) {
    const yb = x === 0 ? 22 : 16;
    b.box(OPEN * 2, WH - yb, WZ1 - WZ0, x, yb, WCZ, x === 0 ? 0x2d4a6b : WALLC);
    b.box(OPEN * 2 + 0.2, 0.7, WZ1 - WZ0 + 0.6, x, WH, WCZ, WHITE);
    icicles(x - OPEN + 1, WZ0 - 0.2, x + OPEN - 1, WZ0 - 0.2, yb, 8);
    icicles(x - OPEN + 1, WZ1 + 0.2, x + OPEN - 1, WZ1 + 0.2, yb, 8);
    col.box(x, WCZ, OPEN * 2, WZ1 - WZ0, { yMin: yb, yMax: WH + 1 });
  }
  addSign('冰川镇  TUNDRATOWN', 18, 0, 25, WZ1 + 0.1, 0, { bg: '#1d5b7a', fg: '#ffffff', border: '#9fd3f5' });
  addSign('撒瓦纳中央区  →', 16, 0, 25, WZ0 - 0.1, Math.PI, { bg: '#c98a2a', fg: '#ffffff' });
  // 造雪塔
  const towerXs = [-660, -510, -315, -110, 100, 255].filter(x => openX.every(o => Math.abs(x - o) > 24) && x > R.x0 + 10 && x < R.x1 - 10);
  const nozzles = [];
  const NRX = -1.0, ncos = Math.cos(NRX), nsin = Math.sin(NRX);
  for (const x of towerXs) {
    b.cyl(9, 10, 42, x, 0, WCZ, 0xe2ebf1, { seg: 12, mat: 'shiny' });
    for (const y of [10, 32]) b.cyl(10.3, 10.3, 1.6, x, y, WCZ, 0x2f8f8a, { seg: 12 });
    b.cyl(10.2, 10.2, 0.6, x, 24, WCZ, 0x9fe3ff, { seg: 12, mat: 'glow', shadow: false });
    b.sphere(9, x, 42, WCZ, WHITE, { sy: 0.45, seg: 12 });
    b.cyl(0.4, 0.4, 6, x, 45.5, WCZ, 0x9aa3ad, { seg: 6 });
    for (const s of [-4, 4]) {
      const bx = x + s, by = 33, bz = WZ0 - 1.5;
      b.cyl(2.2, 3, 7, bx, by, bz, 0x9aa3ad, { rx: NRX, seg: 10, mat: 'metal' });
      const mx = bx, my = by + 7 * ncos, mz = bz + 7 * nsin;
      b.cyl(2.0, 2.0, 0.3, mx, my, mz, 0x2a2d33, { rx: NRX, seg: 10, shadow: false });
      nozzles.push({ x: mx, y: my, z: mz });
    }
    col.circle(x, WCZ, 10, { yMax: 46 });
  }
  ctx.addLabel(0, 34, WCZ, '气候墙', D.color);

  // ———————————————————— 降雪 & 造雪喷雾（Points） ————————————————————
  {
    const N = 3000, S = 200, H = 60;
    const wx = new Float32Array(N), wy = new Float32Array(N), wz = new Float32Array(N), sp = new Float32Array(N);
    for (let i = 0; i < N; i++) { wx[i] = rnd() * S; wy[i] = rnd() * H; wz[i] = rnd() * S; sp[i] = rr(1.0, 2.2); }
    const pos = new Float32Array(N * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const snow = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0.9, depthWrite: false, map: snowDot(), alphaTest: 0.01 }));
    snow.frustumCulled = false;
    let camX = CX, camZ = CZ;
    snow.onBeforeRender = (r, s, cam) => { camX = cam.position.x; camZ = cam.position.z; };
    scene.add(snow);
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const half = S / 2;
    ctx.animate((dt, t) => {
      // 降雪体积跟随相机，但限制在地区 rect 内，不会飘到别的地区
      const cx = clamp(camX, R.x0 + half, R.x1 - half), cz = clamp(camZ, R.z0 + half, R.z1 - half);
      const wind = Math.sin(t * 0.3) * 0.8;
      for (let i = 0; i < N; i++) {
        wy[i] -= sp[i] * dt; if (wy[i] < 0) wy[i] += H;
        wx[i] += (wind + Math.sin(t + i) * 0.4) * dt;
        const lx = (((wx[i] - cx + half) % S) + S) % S - half;
        const lz = (((wz[i] - cz + half) % S) + S) % S - half;
        pos[i * 3] = cx + lx; pos[i * 3 + 1] = wy[i]; pos[i * 3 + 2] = cz + lz;
      }
      g.attributes.position.needsUpdate = true;
    });

    if (nozzles.length) {
      const PN = 50 * nozzles.length;
      const pp = new Float32Array(PN * 3);
      const info = [];
      for (let i = 0; i < PN; i++) info.push({ n: nozzles[i % nozzles.length], ph: rnd(), sx: rr(-1, 1), sy: rr(-0.5, 1), sz: rr(-1, 1) });
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
      const plume = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, transparent: true, opacity: 0.8, depthWrite: false }));
      plume.frustumCulled = false;
      scene.add(plume);
      ctx.animate((dt, t) => {
        for (let i = 0; i < PN; i++) {
          const p = info[i], f = (t * 0.35 + p.ph) % 1, d = f * 30;
          pp[i * 3] = p.n.x + p.sx * f * 6;
          pp[i * 3 + 1] = p.n.y + d * ncos * 0.6 + p.sy * f * 4 - f * f * 14;
          pp[i * 3 + 2] = p.n.z + d * nsin + p.sz * f * 5;
        }
        pg.attributes.position.needsUpdate = true;
      });
    }
  }

  return { signs };
}
