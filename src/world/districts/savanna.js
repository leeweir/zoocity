// 撒瓦纳中央区（Savanna Central）—— 动物城市中心
//
// 范围：DISTRICTS.savanna.rect = x/z -280..280，道路 x/z = ±40, ±120, ±200（宽 14）。
// 另外为 CONNECTORS 修了 4 条入城林荫道：x=0（南北两端，接冰川镇 / 大桥）与 z=0（东西两端，接撒哈拉 / 雨林）。
// 小型啮齿镇街区（x/z 207..280）完全留空，由 rodentia.js 建造。
//
// 主要地标：
//   撒瓦纳中央广场   (0, 0)      三层大喷泉（动画水柱）、金合欢树、长椅、大屏广告牌
//   ZPD 第一分局     (80, -80)   砂岩两翼 + 蓝色玻璃圆柱中庭 + 「ZPD」招牌，门前停放警车，入口 (80, -52)
//   动物城中央车站   (-80, -80)  拱形玻璃大厅（沿 z 方向），两座站台 + 列车，入口 (-80, -52)，可以走进去
//   市政厅           (-80, 80)   高台 + 台阶 + 柱廊 + 山花 + 铜绿穹顶，入口 (-80, 52)
//   自然历史博物馆   (80, 80)    宽大砂岩楼 + 圆厅穹顶 + 猛犸象雕塑，入口 (80, 52)
//   大象冰淇淋店     (160, -80)  Jumbeaux's Café，屋顶巨型冰淇淋甜筒招牌，入口 (160, -52)
//   车管所 DMV       (-160, -80) 灰色办公楼 + 排队护栏，入口 (-160, -52)
// 所有地标 front 点及 POI 周围 3m 无碰撞体；道路上无碰撞体。
import * as THREE from 'three';
import { DISTRICTS, LANDMARKS, ROAD_W, SIDEWALK_W, blocksOf } from '../layout.js';

const D = DISTRICTS.savanna;
const RECT = D.rect;
const HW = ROAD_W / 2;
const SW = 0.15;                 // 人行道 / 街区地台高度
const ROD = DISTRICTS.rodentia.rect;
// 入城林荫道（连接 CONNECTORS）
const ACCESS = [
  { v: true, c: 0, a0: RECT.z0, a1: -200 },
  { v: true, c: 0, a0: 200, a1: RECT.z1 },
  { v: false, c: 0, a0: RECT.x0, a1: -200 },
  { v: false, c: 0, a0: 200, a1: RECT.x1 },
];
// 公交车站：{ x, z, nx, nz }，(nx,nz) 指向街区内部，(x,z) 为路缘线上的中点
const BUS = [
  { x: 18, z: -47, nx: 0, nz: -1 },
  { x: -18, z: -33, nx: 0, nz: 1 },
  { x: -150, z: 47, nx: 0, nz: 1 },
  { x: 150, z: 47, nx: 0, nz: 1 },
];
const FRONTS = ['zpd', 'station', 'cityHall', 'museum', 'jumbeaux', 'dmv'].map(k => LANDMARKS[k].front);

export const POI = {
  plazaFountain: { x: 0, y: SW, z: 14, label: '中央广场喷泉南侧' },
  plazaBench:    { x: -12.5, y: SW, z: -12.5, label: '广场长椅' },
  plazaScreen:   { x: 21, y: SW, z: -16, label: '广场大屏广告牌下' },
  zpdFront:      { x: 80, y: SW, z: -52, label: 'ZPD 第一分局门口' },
  zpdParking:    { x: 62, y: SW, z: -52.5, label: 'ZPD 警车停车场' },
  stationFront:  { x: -80, y: SW, z: -52, label: '中央车站入口' },
  stationPlatform: { x: -80, y: 1.25, z: -84, label: '中央车站岛式站台' },
  stationHall:   { x: -80, y: SW, z: -64, label: '中央车站候车大厅' },
  cityHallFront: { x: -80, y: SW, z: 52, label: '市政厅台阶下' },
  cityHallPortico: { x: -80, y: 2.15, z: 61.6, label: '市政厅柱廊' },
  museumFront:   { x: 80, y: SW, z: 52, label: '博物馆门口' },
  mammoth:       { x: 66, y: SW, z: 52.5, label: '猛犸象雕塑旁' },
  jumbeauxFront: { x: 160, y: SW, z: -52, label: '大象冰淇淋店门口' },
  jumbeauxTables:{ x: 138, y: SW, z: -52.5, label: '冰淇淋店露天座位' },
  dmvFront:      { x: -160, y: SW, z: -52, label: '车管所门口' },
  dmvQueue:      { x: -144, y: SW, z: -52, label: '车管所排队处' },
  busStopZPD:    { x: 25, y: SW, z: -48.2, label: '公交站（ZPD 附近）' },
  busStopPlaza:  { x: -25, y: SW, z: -31.8, label: '公交站（广场北）' },
  busStopWest:   { x: -157, y: SW, z: 48.2, label: '公交站（西区）' },
  busStopEast:   { x: 157, y: SW, z: 48.2, label: '公交站（东区）' },
  northGate:     { x: 10, y: SW, z: -272, label: '北入城大道（往冰川镇）' },
  southGate:     { x: 10, y: SW, z: 272, label: '南入城大道（往大桥）' },
};

// 三角棱柱（山花 / 坡屋顶）：x∈[-.5,.5]，y∈[0,1]，z∈[-.5,.5]，屋脊沿 x
function prismGeo() {
  const p = [
    -0.5, 0, 0.5, -0.5, 1, 0, -0.5, 0, -0.5,
    0.5, 0, -0.5, 0.5, 1, 0, 0.5, 0, 0.5,
    -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0, -0.5, 0, 0.5, 0.5, 1, 0, -0.5, 1, 0,
    0.5, 0, -0.5, -0.5, 0, -0.5, -0.5, 1, 0, 0.5, 0, -0.5, -0.5, 1, 0, 0.5, 1, 0,
    -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}
const PRISM = prismGeo();
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
function addGeo(b, geo, x, y, z, sx, sy, sz, ry, color, opts = {}) {
  _q.setFromEuler(_e.set(0, ry, 0));
  _m4.compose(_v1.set(x, y, z), _q, _v2.set(sx, sy, sz));
  b.add(geo, _m4, color, opts);
}

// 快速图元：Builder.add 内部会 clone() 几何体，而 SphereGeometry/CylinderGeometry 的 clone 会先按默认 32 段重建一次，
// 非常慢。这里缓存「纯 BufferGeometry」版本并自己算矩阵，语义与 b.box/cyl/sphere/cone 完全一致。
function fastPrims(b) {
  const cache = new Map();
  const plain = (key, make) => { let g = cache.get(key); if (!g) { g = new THREE.BufferGeometry().copy(make()); cache.set(key, g); } return g; };
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const mat = (x, y, z, sx, sy, sz, o) => { q.setFromEuler(e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')); return m.compose(p.set(x, y, z), q, s.set(sx, sy, sz)); };
  return {
    box(w, h, d, x, y, z, c, o = {}) {
      const g = plain('b', () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
      return b.add(g, mat(x, y, z, w, h, d, o), c, o);
    },
    cyl(rT, rB, h, x, y, z, c, o = {}) {
      const seg = o.seg || 12, k = rT / rB;
      const g = plain(`c${k}|${seg}`, () => new THREE.CylinderGeometry(k, 1, 1, seg).translate(0, 0.5, 0));
      return b.add(g, mat(x, y, z, rB * (o.sx || 1), h, rB * (o.sz || 1), o), c, o);
    },
    sphere(r, x, y, z, c, o = {}) {
      const seg = o.seg || 12;
      const g = plain(`s${seg}`, () => new THREE.SphereGeometry(1, seg, Math.max(6, seg * 0.66 | 0)));
      return b.add(g, mat(x, y, z, r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1), o), c, o);
    },
    cone(r, h, x, y, z, c, o = {}) {
      const seg = o.seg || 12;
      const g = plain(`k${seg}`, () => new THREE.ConeGeometry(1, 1, seg).translate(0, 0.5, 0));
      return b.add(g, mat(x, y, z, r * (o.sx || 1), h, r * (o.sz || 1), o), c, o);
    },
    add: (g, mm, c, o) => b.add(g, mm, c, o),
  };
}

const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
const FACADE_C = [0xe8c99a, 0xf0b98a, 0xe89f7a, 0xd98c6a, 0xf2d6a2, 0xbfd8c2, 0x9cc9c0, 0xf3e3c3, 0xe7b0a0, 0xd7c08a, 0xc9a27a, 0xf1cfa0, 0xa8c8d8, 0xe6a66e];
const BIG_C = [0xb9a68e, 0xc8b496, 0xa8977f, 0x9e9a8f, 0xc7b8a3, 0xb3a089];
const GLASS_C = [0x7fb7d8, 0x8fc4d8, 0x9fd0c8, 0x6fa8c0, 0xb5d4e0, 0x8ac0b4, 0xd9b77a, 0xc8a0c8];
const AWN_C = [0xd9534f, 0x2e8b57, 0x2a6fb5, 0xf0ad4e, 0x8e44ad, 0xe67e22, 0x16a085, 0xc0392b, 0x34495e];
const SIGN_C = [0xffd166, 0xff7aa2, 0x7ae7ff, 0x9dff8a, 0xffffff, 0xffa94d, 0xc9a0ff];
const BILLBOARDS = [
  ['动物城 · 一切皆有可能', '#1d3b6e', '#ffd166'],
  ['ZOOTOPIA\nAnyone can be anything', '#e85d75', '#ffffff'],
  ['夏奇羊 Gazelle 演唱会', '#7b2cbf', '#ffe066'],
  ['胡萝卜手机 · 一按就通', '#f28c28', '#ffffff'],
  ['爪爪冰棍 Pawpsicle', '#ff6b6b', '#fff3b0'],
  ['动物城警察局 · 招募中', '#2c4a8a', '#ffffff'],
  ['鼠鼠快递 · 小件急送', '#2a9d8f', '#ffffff'],
  ['兔窝镇胡萝卜 · 新鲜直达', '#2d6a4f', '#ffd166'],
];

// 点到矩形距离
// 反转几何体朝向（用于从内部也能看到的拱顶）
function flipGeo(geo) {
  const g = geo.clone();
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  const n = g.attributes.normal.array;
  for (let i = 0; i < n.length; i++) n[i] = -n[i];
  return g;
}

function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return c.getHex(); }
function distRect(px, pz, x0, z0, x1, z1) {
  const dx = Math.max(x0 - px, 0, px - x1), dz = Math.max(z0 - pz, 0, pz - z1);
  return Math.hypot(dx, dz);
}

export function build(ctx) {
  const { col, scene, tex } = ctx;
  const b = fastPrims(ctx.b);
  const r = ctx.rng(4242);
  let signCount = 0;
  const signMesh = (text, width, opts, x, y, z, ry = 0) => {
    if (signCount >= 28) return null;
    signCount++;
    const m = tex.signMesh(text, width, opts);
    m.position.set(x, y, z); m.rotation.y = ry;
    scene.add(m);
    return m;
  };
  // 需要保持空旷的点（地标入口、公交站区）
  const CLEAR = FRONTS.map(f => ({ x: f.x, z: f.z, r: 3.5 }));
  for (const s of BUS) CLEAR.push({ x: s.x + s.nx * 2.5, z: s.z + s.nz * 2.5, r: 9 });
  for (const p of Object.values(POI)) CLEAR.push({ x: p.x, z: p.z, r: 3.2 });
  const isClear = (x, z, rad = 0.5) => CLEAR.every(c => Math.hypot(c.x - x, c.z - z) > c.r + rad);

  // ---------- 1. 道路：沥青、车道线、斑马线 ----------
  const ASPH = 0x3f4248, LINE_W = 0xf2f2f2, LINE_Y = 0xf2c230;
  const vRoads = D.roadsX.map(c => ({ v: true, c, a0: RECT.z0, a1: RECT.z1 }));
  const hRoads = D.roadsZ.map(c => ({ v: false, c, a0: RECT.x0, a1: RECT.x1 }));
  const allR = [...vRoads, ...hRoads, ...ACCESS];
  const inter = new Map();
  // 沿道路方向画盒子：along 为道路方向坐标中心，across 为横向坐标
  const rbox = (R, len, wid, h, along, across, y, color, o = { shadow: false }) => {
    if (R.v) b.box(wid, h, len, across, y, along, color, o);
    else b.box(len, h, wid, along, y, across, color, o);
  };
  for (const R of allR) {
    const cross = allR
      .filter(o => o.v !== R.v && o.a0 - 0.1 <= R.c && o.a1 + 0.1 >= R.c && o.c >= R.a0 - HW && o.c <= R.a1 + HW)
      .map(o => o.c).sort((a, b2) => a - b2);
    for (const c of cross) {
      const k = R.v ? `${R.c},${c}` : `${c},${R.c}`;
      if (!inter.has(k)) inter.set(k, R.v ? [R.c, c] : [c, R.c]);
    }
    const segs = [];
    let s = R.a0, sX = false;
    for (const c of cross) {
      if (c - HW > s + 0.5) segs.push([s, c - HW, sX, true]);
      s = c + HW; sX = true;
    }
    if (R.a1 > s + 0.5) segs.push([s, R.a1, sX, false]);
    for (const [s0, s1, x0, x1] of segs) {
      const L = s1 - s0, m = (s0 + s1) / 2;
      rbox(R, L, ROAD_W, 0.02, m, R.c, 0, ASPH);
      const m0 = s0 + (x0 ? 6.5 : 0), m1 = s1 - (x1 ? 6.5 : 0);
      if (m1 - m0 > 1) {
        // 中央双黄线
        for (const o of [-0.2, 0.2]) rbox(R, m1 - m0, 0.14, 0.012, (m0 + m1) / 2, R.c + o, 0.02, LINE_Y);
        // 白色车道虚线
        for (const o of [-3.5, 3.5]) for (let t = m0 + 1; t + 3 < m1; t += 9) rbox(R, 3, 0.14, 0.012, t + 1.5, R.c + o, 0.02, LINE_W);
      }
      // 路口斑马线 + 停车线
      const zebra = (edge, dir) => {
        for (let k = -6; k <= 6.01; k += 1.4) rbox(R, 3.6, 0.65, 0.012, edge + dir * 2.6, R.c + k, 0.02, LINE_W);
        rbox(R, 0.4, ROAD_W / 2 - 0.3, 0.012, edge + dir * 5.4, R.c + (dir > 0 ? -1 : 1) * ROAD_W / 4, 0.02, LINE_W);
      };
      if (x0) zebra(s0, 1);
      if (x1) zebra(s1, -1);
    }
  }
  for (const [x, z] of inter.values()) b.box(ROAD_W, 0.02, ROAD_W, x, 0, z, ASPH, { shadow: false });

  // ---------- 2. 街区：人行道地台、路缘石 ----------
  const SIDE_C = 0xcfc8bb, CURB_C = 0x8f8a82, LOT_C = 0xbdb4a4;
  const rawBlocks = blocksOf('savanna');
  const blocks = [];
  for (const blk of rawBlocks) {
    if (blk.landmark === 'rodentia' || (blk.x0 >= ROD.x0 - 1 && blk.z0 >= ROD.z0 - 1)) continue;
    let parts = [{ x0: blk.x0, x1: blk.x1, z0: blk.z0, z1: blk.z1 }];
    for (const A of ACCESS) {
      const nxt = [];
      for (const p of parts) {
        if (A.v && p.x0 < A.c && p.x1 > A.c && p.z1 > A.a0 && p.z0 < A.a1) {
          nxt.push({ ...p, x1: A.c - HW }, { ...p, x0: A.c + HW });
        } else if (!A.v && p.z0 < A.c && p.z1 > A.c && p.x1 > A.a0 && p.x0 < A.a1) {
          nxt.push({ ...p, z1: A.c - HW }, { ...p, z0: A.c + HW });
        } else nxt.push(p);
      }
      parts = nxt;
    }
    for (const p of parts) {
      p.landmark = blk.landmark;
      // 哪几条边面向道路（不是地区外缘）
      p.road = {
        W: p.x0 > RECT.x0 + 0.5, E: p.x1 < RECT.x1 - 0.5,
        N: p.z0 > RECT.z0 + 0.5, S: p.z1 < RECT.z1 - 0.5,
      };
      // 东南角挨着啮齿镇的两块：靠啮齿镇一侧也算人行道边
      blocks.push(p);
    }
  }
  for (const p of blocks) {
    const w = p.x1 - p.x0, d = p.z1 - p.z0, cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
    b.box(w, SW, d, cx, 0, cz, SIDE_C, { shadow: false, jitter: 0.04 });
    col.box(cx, cz, w, d, { yMax: SW, walkable: true });
    if (p.road.W) b.box(0.3, SW + 0.01, d, p.x0 + 0.15, 0, cz, CURB_C, { shadow: false });
    if (p.road.E) b.box(0.3, SW + 0.01, d, p.x1 - 0.15, 0, cz, CURB_C, { shadow: false });
    if (p.road.N) b.box(w, SW + 0.01, 0.3, cx, 0, p.z0 + 0.15, CURB_C, { shadow: false });
    if (p.road.S) b.box(w, SW + 0.01, 0.3, cx, 0, p.z1 - 0.15, CURB_C, { shadow: false });
    // 人行道铺装分隔缝（每 6m 一道浅线）
    const seam = (horiz, pos, from, to) => horiz
      ? b.box(to - from, 0.004, 0.08, (from + to) / 2, SW, pos, 0xb7b0a3, { shadow: false })
      : b.box(0.08, 0.004, to - from, pos, SW, (from + to) / 2, 0xb7b0a3, { shadow: false });
    if (p.road.N) for (let t = p.x0 + 6; t < p.x1 - 1; t += 6) seam(false, t, p.z0, p.z0 + SIDEWALK_W);
    if (p.road.S) for (let t = p.x0 + 6; t < p.x1 - 1; t += 6) seam(false, t, p.z1 - SIDEWALK_W, p.z1);
    if (p.road.W) for (let t = p.z0 + 6; t < p.z1 - 1; t += 6) seam(true, t, p.x0, p.x0 + SIDEWALK_W);
    if (p.road.E) for (let t = p.z0 + 6; t < p.z1 - 1; t += 6) seam(true, t, p.x1 - SIDEWALK_W, p.x1);
    // 内部地块（扣除人行道）
    p.in = {
      x0: p.x0 + (p.road.W ? SIDEWALK_W : 2), x1: p.x1 - (p.road.E ? SIDEWALK_W : 2),
      z0: p.z0 + (p.road.N ? SIDEWALK_W : 2), z1: p.z1 - (p.road.S ? SIDEWALK_W : 2),
    };
  }

  // ---------- 3. 街道家具：路灯、行道树、长椅、消防栓、垃圾桶 ----------
  const lampPost = (x, z, nx, nz) => {
    // (nx,nz)：灯臂伸向道路的方向
    b.cyl(0.09, 0.13, 6.2, x, SW, z, 0x3a4048, { mat: 'metal', seg: 6 });
    b.cyl(0.2, 0.22, 0.5, x, SW, z, 0x3a4048, { mat: 'metal', seg: 6 });
    const ax = x + nx * 0.9, az = z + nz * 0.9;
    b.box(nx ? 1.9 : 0.1, 0.1, nz ? 1.9 : 0.1, ax, SW + 6.1, az, 0x3a4048, { mat: 'metal' });
    b.box(nx ? 0.7 : 0.45, 0.16, nz ? 0.7 : 0.45, x + nx * 1.7, SW + 5.95, z + nz * 1.7, 0x2b2f35, { mat: 'metal' });
    b.box(nx ? 0.6 : 0.36, 0.06, nz ? 0.6 : 0.36, x + nx * 1.7, SW + 5.9, z + nz * 1.7, 0xfff1c9, { mat: 'glow' });
    col.circle(x, z, 0.18, { yMax: 6.5 });
  };
  const tree = (x, z, planter = true) => {
    if (planter) {
      b.box(1.6, 0.45, 1.6, x, SW, z, 0x9b8f80);
      b.box(1.3, 0.02, 1.3, x, SW + 0.45, z, 0x5b4636, { shadow: false });
      col.box(x, z, 1.6, 1.6, { yMax: SW + 0.45, walkable: true });
    }
    const h = 2.6 + r() * 1.6;
    b.cyl(0.12, 0.18, h, x, SW, z, 0x6b4f3a, { seg: 6 });
    col.circle(x, z, 0.22, { yMax: SW + h });
    const leaf = pick(r, [0x5f9e4a, 0x6aa84f, 0x4f8a3c, 0x7fae55]);
    if (r() < 0.5) {
      // 金合欢式扁平树冠
      b.sphere(2.0, x, SW + h + 0.5, z, leaf, { mat: 'leaf', seg: 8, sy: 0.38 });
      b.sphere(1.3, x + 0.6, SW + h + 0.9, z - 0.3, leaf, { mat: 'leaf', seg: 6, sy: 0.4 });
    } else {
      b.sphere(1.5, x, SW + h + 0.6, z, leaf, { mat: 'leaf', seg: 8 });
      b.sphere(1.0, x - 0.5, SW + h + 1.4, z + 0.3, leaf, { mat: 'leaf', seg: 6 });
    }
  };
  const bench = (x, z, alongX) => {
    const w = alongX ? 2.0 : 0.6, d = alongX ? 0.6 : 2.0;
    b.box(w, 0.08, d, x, SW + 0.45, z, 0x8a5a36);
    b.box(alongX ? 2.0 : 0.08, 0.5, alongX ? 0.08 : 2.0, x + (alongX ? 0 : 0.28), SW + 0.53, z + (alongX ? 0.28 : 0), 0x8a5a36);
    for (const s of [-0.8, 0.8]) b.box(alongX ? 0.08 : 0.5, 0.45, alongX ? 0.5 : 0.08, x + (alongX ? s : 0), SW, z + (alongX ? 0 : s), 0x2f3338, { mat: 'metal' });
    col.box(x, z, w, d, { yMax: SW + 0.55, walkable: true });
  };
  const hydrant = (x, z) => {
    b.cyl(0.16, 0.18, 0.6, x, SW, z, 0xd8342c, { mat: 'shiny', seg: 8 });
    b.sphere(0.17, x, SW + 0.6, z, 0xd8342c, { mat: 'shiny', seg: 8 });
    b.box(0.5, 0.1, 0.1, x, SW + 0.38, z, 0xb02a24, { mat: 'shiny' });
    col.circle(x, z, 0.22, { yMax: SW + 0.75 });
  };
  const bin = (x, z) => {
    b.cyl(0.26, 0.22, 0.85, x, SW, z, 0x2f6b4f, { seg: 8 });
    col.circle(x, z, 0.28, { yMax: SW + 0.9 });
  };
  for (const p of blocks) {
    if (p.landmark === 'plaza') continue; // 广场自己布置
    const sides = [];
    // 每条面向道路的边：起点、终点、路缘方向、家具所在的横向坐标
    if (p.road.N) sides.push({ ax: 'x', a0: p.x0, a1: p.x1, c: p.z0 + 1.0, nx: 0, nz: -1 });
    if (p.road.S) sides.push({ ax: 'x', a0: p.x0, a1: p.x1, c: p.z1 - 1.0, nx: 0, nz: 1 });
    if (p.road.W) sides.push({ ax: 'z', a0: p.z0, a1: p.z1, c: p.x0 + 1.0, nx: -1, nz: 0 });
    if (p.road.E) sides.push({ ax: 'z', a0: p.z0, a1: p.z1, c: p.x1 - 1.0, nx: 1, nz: 0 });
    for (const s of sides) {
      const L = s.a1 - s.a0;
      const n = Math.max(1, Math.floor((L - 6) / 11));
      const step = (L - 6) / n;
      for (let i = 0; i <= n; i++) {
        const a = s.a0 + 3 + i * step;
        const x = s.ax === 'x' ? a : s.c, z = s.ax === 'x' ? s.c : a;
        if (!isClear(x, z, 1)) continue;
        if (i % 2 === 0) lampPost(x, z, s.nx, s.nz);
        else {
          const tx = x - s.nx * 0.6, tz = z - s.nz * 0.6;
          tree(tx, tz);
        }
        // 两灯之间偶尔放长椅 / 垃圾桶 / 消防栓
        if (i < n) {
          const a2 = a + step / 2, ch = r();
          const x2 = s.ax === 'x' ? a2 : s.c - s.nx * 1.4, z2 = s.ax === 'x' ? s.c - s.nz * 1.4 : a2;
          if (!isClear(x2, z2, 1.5)) continue;
          if (ch < 0.25) bench(x2, z2, s.ax === 'x');
          else if (ch < 0.4) hydrant(s.ax === 'x' ? a2 : s.c, s.ax === 'x' ? s.c : a2);
          else if (ch < 0.55) bin(x2, z2);
        }
      }
    }
  }

  // ---------- 4. 公交车站 ----------
  for (const s of BUS) {
    const cx = s.x + s.nx * 2.6, cz = s.z + s.nz * 2.6;
    const alongX = s.nx === 0;
    const L = 7, Dp = 1.6;
    const w = alongX ? L : Dp, d = alongX ? Dp : L;
    // 背板（远离道路一侧）
    const bx = cx + s.nx * (Dp / 2), bz = cz + s.nz * (Dp / 2);
    b.box(alongX ? L : 0.08, 2.6, alongX ? 0.08 : L, bx, SW, bz, 0x9fd3f5, { mat: 'glass' });
    b.box(w + 0.3, 0.15, d + 0.3, cx, SW + 2.8, cz, 0x2a6fb5, { mat: 'shiny' });
    for (const k of [-1, 1]) {
      const px = cx + (alongX ? k * L / 2 : 0) + s.nx * 0.7, pz = cz + (alongX ? 0 : k * L / 2) + s.nz * 0.7;
      b.box(0.12, 2.8, 0.12, px, SW, pz, 0x3a4048, { mat: 'metal' });
    }
    b.box(alongX ? L - 2 : 0.45, 0.08, alongX ? 0.45 : L - 2, cx + s.nx * 0.45, SW + 0.45, cz + s.nz * 0.45, 0x8a5a36);
    // 广告灯箱（侧板）
    const ex = cx + (alongX ? L / 2 : 0), ez = cz + (alongX ? 0 : L / 2);
    b.box(alongX ? 0.15 : 1.3, 1.9, alongX ? 1.3 : 0.15, ex, SW + 0.4, ez, 0xffe8b0, { mat: 'glow' });
    col.box(bx, bz, alongX ? L : 0.2, alongX ? 0.2 : L, { yMax: SW + 2.6 });
    col.box(ex, ez, alongX ? 0.2 : 1.3, alongX ? 1.3 : 0.2, { yMax: SW + 2.3 });
    // 站牌杆
    const px = s.x - s.nx * 0.2 + (alongX ? -L / 2 - 1.5 : 0), pz = s.z - s.nz * 0.2 + (alongX ? 0 : -L / 2 - 1.5);
    b.cyl(0.06, 0.06, 3, px + s.nx * 1, SW, pz + s.nz * 1, 0x3a4048, { mat: 'metal', seg: 6 });
    b.box(0.7, 0.5, 0.05, px + s.nx * 1, SW + 2.6, pz + s.nz * 1, 0x2a6fb5, { mat: 'glow', ry: alongX ? 0 : Math.PI / 2 });
  }

  // ---------- 5. 撒瓦纳中央广场 + 三层大喷泉 ----------
  const animated = [];
  {
    const P = blocks.find(p => p.landmark === 'plaza');
    const half = Math.min(P.x1 - P.x0, P.z1 - P.z0) / 2 - 1;
    // 铺装：外圈浅砂岩，内圈放射状深色环
    b.box(half * 2, 0.02, half * 2, 0, SW, 0, 0xe3d6bd, { shadow: false });
    b.cyl(16, 16, 0.02, 0, SW + 0.005, 0, 0xcdb48c, { seg: 16, shadow: false });
    b.cyl(12.5, 12.5, 0.02, 0, SW + 0.01, 0, 0xe8dcc5, { seg: 16, shadow: false });
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      b.box(0.5, 0.02, half - 16, Math.sin(a) * (16 + (half - 16) / 2), SW + 0.004, Math.cos(a) * (16 + (half - 16) / 2), 0xcdb48c, { ry: a, shadow: false });
    }
    // 底层水池（矮池沿可以站上去）
    b.cyl(9.4, 9.6, 0.65, 0, SW, 0, 0xd9cbb0, { seg: 16 });
    b.cyl(8.9, 8.9, 0.02, 0, SW + 0.55, 0, 0x4aa3c9, { mat: 'water', seg: 16, shadow: false });
    col.circle(0, 0, 9.6, { yMax: SW + 0.65, walkable: true });
    // 第二层：立柱 + 大碗
    b.cyl(1.6, 2.1, 3.0, 0, SW + 0.55, 0, 0xd2c2a4, { seg: 12 });
    b.cyl(5.2, 2.0, 0.9, 0, SW + 3.5, 0, 0xd9cbb0, { seg: 16 });
    b.cyl(4.9, 4.9, 0.02, 0, SW + 4.3, 0, 0x4aa3c9, { mat: 'water', seg: 16, shadow: false });
    // 第三层
    b.cyl(0.9, 1.2, 2.6, 0, SW + 4.4, 0, 0xd2c2a4, { seg: 10 });
    b.cyl(2.7, 1.0, 0.6, 0, SW + 6.8, 0, 0xd9cbb0, { seg: 14 });
    b.cyl(2.5, 2.5, 0.02, 0, SW + 7.35, 0, 0x4aa3c9, { mat: 'water', seg: 14, shadow: false });
    // 顶部：金色球 + 尖顶
    b.cyl(0.4, 0.6, 1.6, 0, SW + 7.4, 0, 0xd2c2a4, { seg: 8 });
    b.sphere(0.65, 0, SW + 9.4, 0, 0xd4a64a, { mat: 'metal', seg: 10 });
    col.circle(0, 0, 2.1, { yMax: SW + 9.5 });
    // 动物雕像（四只喷水的小象头，围绕第二层立柱）
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      const x = Math.sin(a) * 2.2, z = Math.cos(a) * 2.2;
      b.sphere(0.6, x, SW + 2.7, z, 0xa7a7a0, { seg: 8 });
      b.sphere(0.35, x * 1.3, SW + 2.9, z * 1.3, 0xa7a7a0, { seg: 8, sx: 0.4 });
    }
    // 动画水：顶部水柱、三层溢流水幕、四个象鼻水柱
    const wMat = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
    const jetTop = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.35, 1, 8, 1, true).translate(0, 0.5, 0), wMat);
    jetTop.position.set(0, SW + 10.0, 0); scene.add(jetTop);
    const curtains = [[2.65, SW + 6.8, 2.6], [5.1, SW + 3.5, 3.0]].map(([rad, y, h]) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.25, h, 16, 1, true).translate(0, -h / 2, 0), wMat);
      m.position.set(0, y + 0.85, 0); scene.add(m); return m;
    });
    const trunkJets = [];
    const arcGeo = new THREE.TorusGeometry(1.4, 0.07, 4, 10, Math.PI * 0.75);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      const m = new THREE.Mesh(arcGeo, wMat);
      m.position.set(Math.sin(a) * 4.2, SW + 2.6, Math.cos(a) * 4.2);
      m.rotation.y = a - Math.PI / 2;
      scene.add(m); trunkJets.push(m);
    }
    animated.push(jetTop, ...curtains, ...trunkJets);
    ctx.animate((dt, t) => {
      jetTop.scale.set(1, 2.4 + Math.sin(t * 3.1) * 0.6 + Math.sin(t * 7.3) * 0.2, 1);
      curtains.forEach((c, i) => { c.scale.x = c.scale.z = 1 + Math.sin(t * 4 + i) * 0.015; });
      trunkJets.forEach((m, i) => { const s = 1 + Math.sin(t * 2.5 + i * 1.7) * 0.12; m.scale.set(s, s, 1); });
    });

    // 广场树阵（四角）、长椅、报刊亭、大屏幕
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      for (const [ox, oz] of [[24, 12], [12, 24], [24, 24]]) tree(sx * ox, sz * oz);
      bench(sx * 16, sz * 16.2, true);
      bench(sx * 16.2, sz * 9.5, false);
    }
    // 报刊亭 / 咖啡亭（kiosk）
    const kiosk = (x, z, color, roofC) => {
      b.box(3.2, 2.6, 2.4, x, SW, z, color);
      b.box(3.0, 0.9, 0.05, x, SW + 1.0, z + 1.21, 0x2b2f35);
      b.box(3.8, 0.2, 3.0, x, SW + 2.6, z, roofC, { mat: 'shiny' });
      addGeo(b, PRISM, x, SW + 2.8, z, 3.8, 0.8, 3.0, 0, roofC, { mat: 'shiny' });
      b.box(3.0, 0.4, 0.05, x, SW + 2.15, z + 1.23, 0xffe28a, { mat: 'glow' });
      col.box(x, z, 3.2, 2.4, { yMax: SW + 3.6 });
    };
    kiosk(-26, 20, 0x2e8b57, 0xd9534f);
    kiosk(26, 20, 0x2a6fb5, 0xf0ad4e);
    kiosk(-26, -20, 0x8e44ad, 0xf2f2f2);
    // 大屏广告牌（广场东北角），屏幕本身是招牌 Mesh，双面
    {
      const x = 27.5, z = -24;
      for (const s of [-2.6, 2.6]) {
        b.box(0.6, 7.5, 0.6, x + s, SW, z, 0x3a4048, { mat: 'metal' });
        col.box(x + s, z, 0.6, 0.6, { yMax: SW + 7.5 });
      }
      b.box(7.2, 4.0, 0.5, x, SW + 6.2, z, 0x22262c, { mat: 'metal' });
      signMesh('动物城 · 一切皆有可能\nZOOTOPIA', 6.6, { bg: '#1d3b6e', fg: '#ffd166', w: 512, h: 288, font: 'bold 56px "PingFang SC","Microsoft YaHei",sans-serif' }, x, SW + 8.2, z + 0.27, 0);
    }
    // 广场边缘矮花坛（只在角部，四个方向留出入口）
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      b.box(1.2, 0.5, 10, sx * (half - 1), SW, sz * 22, 0xa89a86);
      b.box(1.0, 0.25, 9.6, sx * (half - 1), SW + 0.5, sz * 22, 0x5f9e4a, { mat: 'leaf' });
      col.box(sx * (half - 1), sz * 22, 1.2, 10, { yMax: SW + 0.6, walkable: true });
    }
    ctx.addLabel(0, 12, 0, LANDMARKS.plaza.name, D.color);
  }

  // ---------- 6. 通用工具：警车、立柱、穹顶 ----------
  const car = (x, z, ry, body, police = false) => {
    const o = { mat: 'shiny', ry };
    const ax = Math.sin(ry), az = Math.cos(ry); // 车头方向
    b.box(2.0, 0.75, 4.4, x, 0.3 + SW, z, body, o);
    b.box(1.8, 0.65, 2.3, x - ax * 0.2, 1.05 + SW, z - az * 0.2, police ? 0x1d2a44 : 0x9fc4dc, { mat: 'glass', ry });
    if (police) {
      b.box(2.02, 0.35, 1.6, x, 0.55 + SW, z, 0x111111, o); // 车门黑色涂装
      b.box(1.2, 0.18, 0.35, x - ax * 0.2, 1.7 + SW, z - az * 0.2, 0xff2a2a, { mat: 'glow', ry });
      b.box(0.6, 0.19, 0.36, x - ax * 0.2 + Math.cos(ry) * 0.3, 1.7 + SW, z - az * 0.2 - Math.sin(ry) * 0.3, 0x2a6bff, { mat: 'glow', ry });
    }
    for (const [lx, lz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
      const wx = x + lx * Math.cos(ry) + lz * ax, wz = z - lx * Math.sin(ry) + lz * az;
      b.cyl(0.38, 0.38, 0.25, wx, SW + 0.38, wz, 0x1b1b1b, { seg: 8, rz: Math.PI / 2, ry });
    }
    col.box(x, z, 2.0, 4.4, { ry, yMax: SW + 1.75 });
  };
  const column = (x, z, y0, h, rad, color = 0xf1e6cf) => {
    b.box(rad * 2.6, 0.4, rad * 2.6, x, y0, z, color);
    b.cyl(rad * 0.88, rad, h - 0.8, x, y0 + 0.4, z, color, { seg: 10 });
    b.box(rad * 2.6, 0.4, rad * 2.6, x, y0 + h - 0.4, z, color);
    col.circle(x, z, rad, { yMin: y0, yMax: y0 + h });
  };
  const HEMI = new THREE.BufferGeometry().copy(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  const dome = (x, y, z, rad, color, sy = 1) => {
    _m4.compose(_v1.set(x, y, z), _q.identity(), _v2.set(rad, rad * sy, rad));
    b.add(HEMI, _m4, color, { mat: 'shiny' });
  };
  const sandstone = 0xe6d3ae, cream = 0xf1e6cf;

  // ---------- 7. ZPD 第一分局 ----------
  {
    const L = LANDMARKS.zpd;
    const zb = -106, zf = -72, H = 22;
    for (const [x0, x1] of [[52, 72], [88, 108]]) {
      const cx = (x0 + x1) / 2, cz = (zb + zf) / 2;
      b.box(x1 - x0, H, zf - zb, cx, SW, cz, sandstone, { mat: 'facadeBig' });
      b.box(x1 - x0 + 0.8, 1.0, zf - zb + 0.8, cx, SW + H, cz, 0xd2bd93);
      b.box(x1 - x0 - 6, 3.5, zf - zb - 8, cx, SW + H + 1, cz, 0xcfc4b0, { mat: 'facade' }); // 屋顶设备层
      b.box(x1 - x0, 1.2, 0.6, cx, SW + 6.2, zf + 0.3, 0xd2bd93); // 腰线
      col.box(cx, cz, x1 - x0, zf - zb, { yMax: SW + H + 4.5 });
    }
    // 后部高塔
    b.box(24, 40, 14, 80, SW, -101, 0xdcc7a0, { mat: 'facadeBig' });
    b.box(25, 1.2, 15, 80, SW + 40, -101, 0xc8b28a);
    b.cyl(0.25, 0.4, 12, 80, SW + 41.2, -101, 0x8a9099, { mat: 'metal', seg: 6 });
    b.sphere(0.5, 80, SW + 53.4, -101, 0xff3030, { mat: 'glow', seg: 8 });
    col.box(80, -101, 24, 14, { yMax: SW + 54 });
    // 蓝色玻璃中庭（圆柱 + 顶环）
    b.cyl(10, 10, 30, 80, SW, -82, 0x3f86c6, { mat: 'glass', seg: 16 });
    for (let y = 6; y < 30; y += 6) b.cyl(10.15, 10.15, 0.35, 80, SW + y, -82, 0xe8eef3, { mat: 'metal', seg: 16 });
    b.cyl(10.6, 10.6, 1.2, 80, SW + 30, -82, 0xd2bd93, { seg: 16 });
    dome(80, SW + 31.2, -82, 7, 0x6aa0d0, 0.35);
    col.circle(80, -82, 10, { yMax: SW + 33 });
    // 入口雨棚 + 大小门
    b.box(14, 0.6, 4, 80, SW + 7.5, -70, 0x2c4a8a, { mat: 'shiny' });
    for (const s of [-6.5, 6.5]) b.box(0.6, 7.5, 0.6, 80 + s, SW, -68.5, 0xd2bd93);
    b.box(5, 7, 0.4, 80, SW, -72.1, 0x1d2a44, { mat: 'glass' });   // 大象门
    b.box(1.6, 2.6, 0.4, 75.5, SW, -72.1, 0x1d2a44, { mat: 'glass' }); // 普通门
    b.box(0.45, 0.65, 0.4, 73.8, SW, -72.1, 0x1d2a44, { mat: 'glass' }); // 鼠门
    signMesh('ZPD', 9, { bg: '#2c4a8a', fg: '#ffffff', w: 512, h: 192, font: 'bold 150px "Arial Black",sans-serif' }, 80, SW + 22, -71.6, 0);
    signMesh('动物城警察局 · 第一分局', 12, { bg: '#f1e6cf', fg: '#2c4a8a', w: 1024, h: 112 }, 80, SW + 9.6, -67.9, 0);
    // 前广场：铺装、旗杆、停车位与警车
    b.box(60, 0.02, 18, 80, SW, -61, 0xd8ccb5, { shadow: false });
    for (const s of [-1, 1]) {
      const fx = 80 + s * 9, fz = -60;
      b.cyl(0.12, 0.15, 12, fx, SW, fz, 0xdadfe4, { mat: 'metal', seg: 6 });
      b.box(0.05, 1.6, 2.6, fx, SW + 10, fz + 1.3, s < 0 ? 0x2c4a8a : 0xf2c230, { ry: Math.PI / 2 });
      col.circle(fx, fz, 0.2, { yMax: SW + 12 });
    }
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const px = 80 + side * (18 + k * 3.4), pz = -63.5;
        b.box(0.12, 0.01, 5.2, px - 1.7, SW + 0.02, pz, 0xffffff, { shadow: false });
        if (k === 3) b.box(0.12, 0.01, 5.2, px + 1.7, SW + 0.02, pz, 0xffffff, { shadow: false });
        if (k !== 1 || side > 0) car(px, pz, 0, 0xf4f6f8, true);
      }
    }
    ctx.addLabel(L.x, 36, L.z, L.name, '#4f8fe0');
  }

  // ---------- 8. 动物城中央车站：拱形玻璃大厅（可以走进去） ----------
  {
    const L = LANDMARKS.station;
    const cx = -80, z0 = -106, z1 = -58, R = 22, len = z1 - z0, cz = (z0 + z1) / 2;
    // 半圆拱顶（沿 z），外表面玻璃 + 内表面翻转
    const arch = new THREE.BufferGeometry().copy(new THREE.CylinderGeometry(R, R, len, 16, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2));
    _m4.compose(_v1.set(cx, SW + 4, cz), _q.setFromEuler(_e.set(0, 0, 0)), _v2.set(1, 0.75, 1));
    b.add(arch, _m4, 0x8fc0dc, { mat: 'glass' });
    b.add(flipGeo(arch), _m4, 0x6b7a88, { mat: 'metal', shadow: false });
    // 拱肋（钢架）
    for (let z = z0; z <= z1 + 0.01; z += 6) {
      for (let k = 0; k <= 12; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 12;
        const x = cx + Math.sin(a) * (R + 0.15), y = SW + 4 + Math.cos(a) * R * 0.75;
        b.box(1.8, 0.4, 0.4, x, y - 0.2, z, 0x51606e, { mat: 'metal', rz: -a });
      }
    }
    // 两侧 4m 高砂岩基座墙（候车区侧墙）+ 端头山墙
    for (const s of [-1, 1]) {
      b.box(1.2, 4, len, cx + s * (R - 0.6), SW, cz, sandstone, { mat: 'facade' });
      col.box(cx + s * (R - 0.6), cz, 1.2, len, { yMax: SW + 4 + R * 0.5 });
    }
    // 北端封闭（玻璃半圆用盒子近似）
    b.box(2 * R, 4, 1.2, cx, SW, z0, sandstone, { mat: 'facade' });
    for (let k = 0; k < 8; k++) {
      const hw = R * Math.cos(Math.asin((k + 0.5) / 8)), y = SW + 4 + k * R * 0.75 / 8;
      b.box(2 * hw, R * 0.75 / 8, 0.3, cx, y, z0, 0x8fc0dc, { mat: 'glass' });
    }
    col.box(cx, z0, 2 * R, 1.2, { yMax: SW + 4 + R * 0.75 });
    // 南端入口立面：砂岩拱门框 + 大钟 + 招牌（中间 16m 开口，可进入）
    const zf = z1;
    for (const s of [-1, 1]) {
      b.box(R - 8, 9, 2, cx + s * (8 + (R - 8) / 2), SW, zf, cream, { mat: 'facadeBig' });
      col.box(cx + s * (8 + (R - 8) / 2), zf, R - 8, 2, { yMax: SW + 9 });
      b.box(3, 24, 3, cx + s * 9.5, SW, zf + 1, cream);
      col.box(cx + s * 9.5, zf + 1, 3, 3, { yMax: SW + 24 });
      b.cone(2.2, 4, cx + s * 9.5, SW + 24, zf + 1, 0x4f8a7c, { seg: 8 });
    }
    b.box(16, 3, 2, cx, SW + 9, zf, cream);
    b.cyl(3, 3, 0.5, cx, SW + 15, zf + 1.3, 0xf7f2e8, { seg: 16, rx: Math.PI / 2 });
    b.box(0.25, 2.4, 0.1, cx, SW + 15, zf + 1.6, 0x222222);
    b.box(1.8, 0.25, 0.1, cx + 0.8, SW + 15, zf + 1.6, 0x222222);
    signMesh('动物城中央车站 ZOOTOPIA CENTRAL', 15, { bg: '#2d3e50', fg: '#ffd166', w: 1024, h: 96 }, cx, SW + 10.5, zf + 1.05, 0);
    // 室内：站台（高 1.1m，可站立）+ 轨道 + 列车
    const PH = 1.1;
    // 侧站台（x: -91..-87 与 -73..-69）与中央岛式站台（-83..-77）
    for (const [px, pw] of [[cx - 9, 4], [cx + 9, 4], [cx, 6]]) {
      b.box(pw, PH, len - 14, px, SW, cz - 5, 0xc9bfae);
      for (const e of (px === cx ? [-1, 1] : [px < cx ? 1 : -1])) b.box(0.4, 0.02, len - 14, px + e * (pw / 2 - 0.3), SW + PH, cz - 5, 0xf2c230, { shadow: false });
      col.box(px, cz - 5, pw, len - 14, { yMax: SW + PH, walkable: true });
      // 南端坡道（从候车大厅走上站台）
      const zs = cz - 5 + (len - 14) / 2;
      for (let k = 0; k < 4; k++) b.box(pw, PH * (4 - k) / 4, 0.75, px, SW, zs + 0.375 + k * 0.75, 0xbdb3a2); // 台阶外观（碰撞用斜坡）
      col.ramp(px - pw / 2, zs + 3, px + pw / 2, zs, SW, SW + PH, 'z');
    }
    // 轨道（两条）
    for (const tx of [cx - 5, cx + 5]) {
      b.box(3.2, 0.12, len - 4, tx, SW, cz, 0x6b5b4b, { shadow: false });
      for (const o of [-0.75, 0.75]) b.box(0.12, 0.12, len - 4, tx + o, SW + 0.12, cz, 0x9aa3ad, { mat: 'metal', shadow: false });
    }
    // 列车（西侧轨道，3 节车厢，流线车头）
    const tx = cx - 5;
    for (let k = 0; k < 3; k++) {
      const zc = z0 + 7 + k * 11.5;
      b.box(3.0, 3.4, 11, tx, SW + 0.5, zc, 0xf4f4f0, { mat: 'shiny' });
      b.box(3.05, 0.9, 11, tx, SW + 2.4, zc, 0x3f86c6, { mat: 'glass' });
      b.box(3.06, 0.3, 11, tx, SW + 1.3, zc, 0xe85d75, { mat: 'shiny' });
      col.box(tx, zc, 3.0, 11, { yMax: SW + 3.9 });
    }
    b.sphere(1.6, tx, SW + 2.0, z0 + 7 + 2 * 11.5 + 5.5, 0xf4f4f0, { mat: 'shiny', sx: 0.94, sy: 1.05, sz: 2.2, seg: 12 });
    // 候车大厅：长椅 + 售票亭 + 信息屏
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) bench(cx + s * 15, z1 - 6 - k * 4.5, false);
    b.box(6, 3, 3, cx - 15, SW, z0 + 6, 0x8a5a36);
    col.box(cx - 15, z0 + 6, 6, 3, { yMax: SW + 3 });
    b.box(7, 1.4, 0.3, cx, SW + 6, z1 - 10, 0x101820, { mat: 'metal' });
    b.box(6.6, 1.1, 0.05, cx, SW + 6.15, z1 - 9.84, 0xffa94d, { mat: 'glow' });
    for (const s of [-3.3, 3.3]) b.box(0.2, 6, 0.2, cx + s, SW + PH, z1 - 10, 0x51606e, { mat: 'metal' });
    // 前广场出租车候车带
    b.box(40, 0.02, 3, cx, SW, -53.8, 0xf2c230, { shadow: false });
    ctx.addLabel(L.x, 24, L.z, L.name, '#6fb7e0');
  }

  // ---------- 9. 市政厅：高台 + 台阶 + 柱廊 + 山花 + 穹顶 ----------
  {
    const L = LANDMARKS.cityHall;
    const cx = -80, PZ0 = 60, PZ1 = 104, PH = 2.0;
    // 高台（walkable）
    b.box(56, PH, PZ1 - PZ0, cx, SW, (PZ0 + PZ1) / 2, 0xd8ccb5);
    col.box(cx, (PZ0 + PZ1) / 2, 56, PZ1 - PZ0, { yMax: SW + PH, walkable: true });
    // 台阶（z 55..60，从 front 点往南上）
    for (let k = 0; k < 5; k++) b.box(30, (k + 1) * PH / 5, 1, cx, SW, 55.5 + k, 0xe3d8c2);
    col.ramp(cx - 15, 55, cx + 15, 60, SW, SW + PH, 'z');
    const top = SW + PH;
    // 主楼
    b.box(48, 18, 30, cx, top, 88, cream, { mat: 'facadeBig' });
    b.box(49, 1.4, 31, cx, top + 18, 88, 0xe0d2b4);
    col.box(cx, 88, 48, 30, { yMax: top + 19.4 });
    // 柱廊：8 根柱子 + 檐口 + 山花
    for (let k = 0; k < 8; k++) column(cx - 17.5 + k * 5, 66.5, top, 14, 0.8, cream);
    b.box(40, 1.6, 7, cx, top + 14, 69.5, 0xe8dcc4);
    addGeo(b, PRISM, cx, top + 15.6, 69.5, 40, 4.5, 7, 0, 0xe8dcc4);
    // 大门（大象门 + 普通门 + 鼠门）
    b.box(6, 9, 0.4, cx, top, 72.9, 0x5a3a24);
    b.box(1.6, 2.6, 0.4, cx - 5, top, 72.9, 0x5a3a24);
    b.box(0.4, 0.6, 0.4, cx - 6.4, top, 72.9, 0x5a3a24);
    // 鼓座 + 穹顶 + 灯笼塔
    b.cyl(10, 10, 6, cx, top + 19.4, 88, cream, { seg: 16, mat: 'facade' });
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8;
      b.cyl(0.4, 0.4, 6, cx + Math.sin(a) * 10.3, top + 19.4, 88 + Math.cos(a) * 10.3, 0xf7efdc, { seg: 6 });
    }
    b.cyl(10.8, 10.8, 0.8, cx, top + 25.4, 88, 0xe0d2b4, { seg: 16 });
    dome(cx, top + 26.2, 88, 10, 0x6fae9a, 0.9);
    b.cyl(1.4, 1.6, 3, cx, top + 35, 88, cream, { seg: 8 });
    b.cone(1.6, 3, cx, top + 38, 88, 0x6fae9a, { seg: 8 });
    b.sphere(0.4, cx, top + 41.3, 88, 0xd4a64a, { mat: 'metal', seg: 8 });
    // 旗杆 + 台阶两侧石狮（狮子市长）
    for (const s of [-1, 1]) {
      b.box(2.4, 1.6, 3.2, cx + s * 17.5, SW, 57, 0xd8ccb5);
      b.sphere(0.9, cx + s * 17.5, SW + 2.5, 57, 0xc9a86a, { seg: 8, sz: 1.4 });
      b.sphere(0.85, cx + s * 17.5, SW + 3.3, 56, 0xb08848, { seg: 8 });
      col.box(cx + s * 17.5, 57, 2.4, 3.2, { yMax: SW + 4 });
      b.cyl(0.12, 0.15, 14, cx + s * 24, top, 63, 0xdadfe4, { mat: 'metal', seg: 6 });
      b.box(0.05, 1.8, 3, cx + s * 24, top + 11.8, 64.5, s < 0 ? 0xe8c872 : 0x2c4a8a, { ry: Math.PI / 2 });
      col.circle(cx + s * 24, 63, 0.2, { yMax: top + 14 });
    }
    signMesh('市政厅 CITY HALL', 14, { bg: '#e8dcc4', fg: '#5a3a24', w: 1024, h: 112 }, cx, top + 14.8, 66.0, 0);
    ctx.addLabel(L.x, 46, L.z, L.name, '#e8c872');
  }

  // ---------- 10. 自然历史博物馆 ----------
  {
    const L = LANDMARKS.museum;
    const cx = 80;
    // 主楼（宽、矮、厚重）+ 两翼
    b.box(54, 16, 26, cx, SW, 92, 0xd9c29a, { mat: 'facadeBig' });
    b.box(55, 1.2, 27, cx, SW + 16, 92, 0xc5ad83);
    col.box(cx, 92, 54, 26, { yMax: SW + 17.2 });
    for (const s of [-1, 1]) {
      b.box(12, 12, 12, cx + s * 21, SW, 73, 0xd9c29a, { mat: 'facadeBig' });
      b.box(12.6, 1, 12.6, cx + s * 21, SW + 12, 73, 0xc5ad83);
      col.box(cx + s * 21, 73, 12, 12, { yMax: SW + 13 });
    }
    // 中央圆厅 + 穹顶
    b.cyl(9, 9, 20, cx, SW, 82, 0xe6d3ae, { seg: 16, mat: 'facade' });
    dome(cx, SW + 20, 82, 9.4, 0xb87333, 0.75);
    b.sphere(0.6, cx, SW + 27.4, 82, 0xd4a64a, { mat: 'metal', seg: 8 });
    col.circle(cx, 82, 9, { yMax: SW + 27 });
    // 入口柱廊（6 柱）+ 台阶
    for (let k = 0; k < 6; k++) column(cx - 10 + k * 4, 69.5, SW + 1.2, 11, 0.7, cream);
    b.box(24, 1.2, 6, cx, SW, 70.5, 0xd8ccb5);
    col.box(cx, 70.5, 24, 6, { yMax: SW + 1.2, walkable: true });
    for (let k = 0; k < 3; k++) b.box(24, (k + 1) * 0.4, 1, cx, SW, 66.5 + k, 0xe3d8c2);
    col.ramp(cx - 12, 66, cx + 12, 67.5, SW, SW + 1.2, 'z');
    b.box(22, 1.4, 5, cx, SW + 12.2, 70.5, 0xe8dcc4);
    addGeo(b, PRISM, cx, SW + 13.6, 70.5, 22, 3, 5, 0, 0xe8dcc4);
    b.box(5, 7, 0.4, cx, SW + 1.2, 73.2, 0x4a3020);
    signMesh('自然历史博物馆', 12, { bg: '#5a3a24', fg: '#f1e6cf', w: 1024, h: 112 }, cx, SW + 12.9, 67.95, 0);
    // 门前猛犸象雕塑（基座 + 身体 + 象牙）
    {
      const mx = 62, mz = 60;
      b.box(6, 1.2, 4, mx, SW, mz, 0x9b8f80);
      b.sphere(2.2, mx, SW + 3.8, mz, 0x6b4f3a, { sx: 1.4, sy: 1.1, seg: 10 });
      b.sphere(1.3, mx + 2.8, SW + 4.6, mz, 0x6b4f3a, { seg: 8 });
      for (const [lx, lz] of [[-1.6, -0.9], [-1.6, 0.9], [1.4, -0.9], [1.4, 0.9]]) b.cyl(0.45, 0.5, 2.2, mx + lx, SW + 1.2, mz + lz, 0x5e4430, { seg: 8 });
      b.cyl(0.3, 0.4, 2.4, mx + 3.6, SW + 2.0, mz, 0x6b4f3a, { seg: 6 });
      for (const s of [-0.6, 0.6]) b.cyl(0.08, 0.18, 2.6, mx + 3.6, SW + 3.2, mz + s, 0xf3ead8, { seg: 6, rz: -1.1 });
      col.box(mx, mz, 6, 4, { yMax: SW + 7 });
    }
    // 广场铺装 + 两侧花坛
    b.box(50, 0.02, 12, cx, SW, 60, 0xd8ccb5, { shadow: false });
    for (const s of [-1, 1]) {
      b.box(6, 0.6, 3, cx + s * 20, SW, 63, 0xa89a86);
      b.box(5.6, 0.3, 2.6, cx + s * 20, SW + 0.6, 63, 0xd9534f, { mat: 'leaf' });
      col.box(cx + s * 20, 63, 6, 3, { yMax: SW + 0.9, walkable: true });
    }
    ctx.addLabel(L.x, 30, L.z, L.name, '#c5ad83');
  }

  // ---------- 11. 大象冰淇淋店 Jumbeaux's Café ----------
  {
    const L = LANDMARKS.jumbeaux;
    const cx = 160;
    // 大象尺度的店面（门高 7m）+ 楼上公寓
    b.box(40, 12, 22, cx, SW, -72, 0xf6d6e0, { mat: 'facadeBig' });
    b.box(41, 1, 23, cx, SW + 12, -72, 0xffffff);
    b.box(34, 20, 18, cx, SW + 13, -84, 0xe9d8c3, { mat: 'facade' });
    col.box(cx, -72, 40, 22, { yMax: SW + 13 });
    col.box(cx, -84, 34, 18, { yMax: SW + 33 });
    // 条纹遮阳篷
    for (let k = 0; k < 10; k++) b.box(4, 0.2, 4, cx - 18 + k * 4, SW + 8.2, -59, k % 2 ? 0xffffff : 0xf48fb1, { rx: -0.35 });
    b.box(6, 7.5, 0.4, cx, SW, -60.9, 0x8fc0dc, { mat: 'glass' });
    b.box(1.6, 2.6, 0.4, cx + 5.5, SW, -60.9, 0x8fc0dc, { mat: 'glass' });
    for (const s of [-1, 1]) b.box(9, 5, 0.3, cx + s * 12, SW + 1, -60.9, 0xfff3e0, { mat: 'glow' });
    // 屋顶巨型冰淇淋甜筒（倒锥 + 三个球）
    const ix = cx + 12, iz = -66;
    b.cyl(2.6, 0.3, 9, ix, SW + 13, iz, 0xd9a35a, { seg: 10 });
    b.sphere(2.9, ix, SW + 22.6, iz, 0xfff1d6, { seg: 12 });
    b.sphere(2.6, ix, SW + 25.4, iz, 0xf48fb1, { seg: 12 });
    b.sphere(2.2, ix, SW + 27.8, iz, 0x7b4a2a, { seg: 12 });
    b.sphere(0.6, ix, SW + 30.2, iz, 0xd32f2f, { mat: 'shiny', seg: 8 });
    col.circle(ix, iz, 3, { yMin: SW + 13, yMax: SW + 31 });
    signMesh("Jumbeaux's Café\n大象冰淇淋店", 14, { bg: '#f48fb1', fg: '#ffffff', w: 1024, h: 224, font: 'bold 76px "PingFang SC","Microsoft YaHei",sans-serif' }, cx - 4, SW + 10.3, -60.75, 0);
    // 露天座位（大圆桌 + 遮阳伞）
    for (const [tx, tz] of [[132, -56.5], [144, -56.5], [176, -56.5], [188, -56.5]]) {
      b.cyl(1.1, 1.1, 0.08, tx, SW + 0.9, tz, 0xffffff, { seg: 12 });
      b.cyl(0.08, 0.1, 2.6, tx, SW, tz, 0x888888, { mat: 'metal', seg: 6 });
      b.cone(2.2, 0.9, tx, SW + 2.6, tz, 0xf48fb1, { seg: 8 });
      col.circle(tx, tz, 1.1, { yMax: SW + 1 });
    }
    ctx.addLabel(L.x, 34, L.z, L.name, '#f48fb1');
  }

  // ---------- 12. 车管所 DMV（树懒职员） ----------
  {
    const L = LANDMARKS.dmv;
    const cx = -160;
    b.box(44, 14, 24, cx, SW, -76, 0xb9b6ae, { mat: 'facadeBig' });
    b.box(45, 1, 25, cx, SW + 14, -76, 0x8f8c86);
    b.box(30, 10, 16, cx, SW + 15, -82, 0xa9a6a0, { mat: 'facade' });
    col.box(cx, -76, 44, 24, { yMax: SW + 15 });
    col.box(cx, -82, 30, 16, { yMax: SW + 25 });
    // 入口（大门 + 小门）+ 蓝色雨棚
    b.box(20, 0.5, 4, cx, SW + 7, -62, 0x2a6fb5, { mat: 'shiny' });
    for (const s of [-9.5, 9.5]) b.box(0.4, 7, 0.4, cx + s, SW, -60.5, 0x8f8c86, { mat: 'metal' });
    b.box(5, 6.5, 0.4, cx, SW, -63.9, 0x8fc0dc, { mat: 'glass' });
    b.box(1.6, 2.6, 0.4, cx + 4.5, SW, -63.9, 0x8fc0dc, { mat: 'glass' });
    signMesh('车管所 DMV', 12, { bg: '#2a6fb5', fg: '#ffffff', w: 768, h: 128 }, cx, SW + 10, -63.75, 0);
    // 排队护栏（东侧，蛇形）
    for (let row = 0; row < 3; row++) {
      const z = -57 - row * 1.6;
      for (let k = 0; k <= 4; k++) b.cyl(0.06, 0.08, 1, cx + 14 + k * 1.5, SW, z, 0xb0b5bb, { mat: 'metal', seg: 6 });
      b.box(6, 0.06, 0.06, cx + 17, SW + 0.9, z, 0xd32f2f);
    }
    // 门前的蜗牛速度提示牌（矮）
    b.box(0.1, 1.2, 0.1, cx - 6, SW, -58, 0x666666, { mat: 'metal' });
    b.box(1.2, 0.8, 0.05, cx - 6, SW + 1.2, -58, 0xf2c230, { mat: 'glow' });
    col.circle(cx - 6, -58, 0.2, { yMax: SW + 2 });
    ctx.addLabel(L.x, 28, L.z, L.name, '#9fb3c8');
  }

  // ---------- 13. 普通街区：程序化楼宇 ----------
  let bbIdx = 0, towers = 0;
  // 楼顶细节：水塔、空调、天线、屋顶花园
  const roof = (x, z, w, d, y) => {
    const ch = r();
    if (ch < 0.3) {
      const tx = x + (r() - 0.5) * w * 0.5, tz = z + (r() - 0.5) * d * 0.5;
      for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) b.box(0.2, 2, 0.2, tx + lx, y, tz + lz, 0x5a4a3a);
      b.cyl(1.4, 1.4, 2.6, tx, y + 2, tz, 0x8a6a4a, { seg: 10 });
      b.cone(1.5, 0.9, tx, y + 4.6, tz, 0x6a5a4a, { seg: 10 });
    } else if (ch < 0.55) {
      for (let k = 0; k < 3; k++) b.box(1.8, 1.1, 1.4, x + (r() - 0.5) * w * 0.6, y, z + (r() - 0.5) * d * 0.6, 0xb8bec4, { mat: 'metal' });
    } else if (ch < 0.75) {
      b.box(w * 0.7, 0.4, d * 0.7, x, y, z, 0x6b4f3a);
      b.box(w * 0.66, 0.3, d * 0.66, x, y + 0.4, z, 0x6aa84f, { mat: 'leaf' });
      for (let k = 0; k < 3; k++) b.sphere(1 + r(), x + (r() - 0.5) * w * 0.5, y + 1.2, z + (r() - 0.5) * d * 0.5, 0x4f8a3c, { mat: 'leaf', seg: 6 });
    } else {
      b.box(w * 0.4, 3, d * 0.4, x, y, z, 0xcfc6b8, { mat: 'facade' });
      b.cyl(0.08, 0.15, 6 + r() * 8, x, y + 3, z, 0x9aa3ad, { mat: 'metal', seg: 4 });
    }
  };
  // 底商：遮阳篷 + 招牌条 + 大小两种门（ fx,fz 为立面中心，(nx,nz) 指向道路）
  const shopfront = (fx, fz, nx, nz, len) => {
    const alongX = nz !== 0, n = Math.max(1, Math.floor(len / 9));
    for (let k = 0; k < n; k++) {
      const off = (k - (n - 1) / 2) * (len / n);
      const x = fx + (alongX ? off : 0), z = fz + (alongX ? 0 : off);
      const sw = len / n - 1.2, awC = pick(r, AWN_C);
      const ox = nx * 1.0, oz = nz * 1.0;
      b.box(alongX ? sw : 2.2, 0.15, alongX ? 2.2 : sw, x + ox, SW + 3.6, z + oz, awC, { rx: nz * 0.25, rz: -nx * 0.25 });
      b.box(alongX ? sw : 0.1, 0.7, alongX ? 0.1 : sw, x + nx * 0.06, SW + 4.0, z + nz * 0.06, pick(r, SIGN_C), { mat: 'glow' });
      b.box(alongX ? sw * 0.6 : 0.1, 2.4, alongX ? 0.1 : sw * 0.6, x + nx * 0.05, SW + 0.5, z + nz * 0.05, 0x9fc4dc, { mat: 'glass' });
      // 多尺度门：大门(大型动物) / 普通门 / 小门(鼩鼱)
      const dside = alongX ? [sw * 0.38, 0] : [0, sw * 0.38];
      b.box(alongX ? 1.4 : 0.1, 2.4, alongX ? 0.1 : 1.4, x + dside[0] + nx * 0.06, SW, z + dside[1] + nz * 0.06, 0x5a3a24);
      b.box(alongX ? 0.3 : 0.1, 0.45, alongX ? 0.1 : 0.3, x + dside[0] * 1.25 + nx * 0.06, SW, z + dside[1] * 1.25 + nz * 0.06, 0x5a3a24);
    }
  };
  const building = (x0, z0, x1, z1, faces) => {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const k = r();
    let type, H;
    // 参考电影：市中心（广场一圈）是少量标志性高塔，往外迅速降为 3–8 层的暖色街屋；
    // 长颈鹿细高塔只在中心环零星出现，整片城区以中低层、圆角、暖色为主。
    const near = Math.hypot(cx, cz);
    const core = Math.max(0, 1 - near / 170);          // 0..1：越靠近中心越大
    const ring = near > 90 && near < 200;               // 次中心环
    if (core > 0.25 && k < 0.1 && w > 10 && d > 10) { type = 'giraffe'; H = 55 + r() * 35; }
    else if (core > 0.15 && k < 0.32) { type = 'glass'; H = 26 + r() * 40 * core; }
    else if (w > 18 && d > 14 && k < 0.5) { type = 'big'; H = 10 + r() * (ring ? 16 : 10); }
    else { type = 'facade'; H = 8 + r() * (ring ? 18 : 10); }
    H = Math.min(95, H);
    let top;
    if (type === 'giraffe') {
      // 长颈鹿细高塔：底座 + 细长塔身 + 顶冠
      b.box(w, 8, d, cx, SW, cz, pick(r, FACADE_C), { mat: 'facade' });
      const tw = Math.min(w, d) * 0.55;
      b.box(tw, H - 8, tw, cx, SW + 8, cz, pick(r, GLASS_C), { mat: 'glass' });
      for (let y = 20; y < H - 8; y += 16) b.box(tw + 0.4, 0.5, tw + 0.4, cx, SW + 8 + y, cz, 0xe8e0d0);
      b.box(tw * 0.7, 4, tw * 0.7, cx, SW + H, cz, 0xe8e0d0);
      b.cyl(0.1, 0.3, 10, cx, SW + H + 4, cz, 0x9aa3ad, { mat: 'metal', seg: 4 });
      b.sphere(0.4, cx, SW + H + 14, cz, 0xff3030, { mat: 'glow', seg: 6 });
      col.box(cx, cz, w, d, { yMax: SW + 8 });
      col.box(cx, cz, tw, tw, { yMax: SW + H + 4 });
      top = 8; towers++;
    } else if (type === 'big') {
      b.box(w, H, d, cx, SW, cz, pick(r, BIG_C), { mat: 'facadeBig' });
      b.box(w + 0.6, 0.8, d + 0.6, cx, SW + H, cz, 0x9e937f);
      col.box(cx, cz, w, d, { yMax: SW + H + 0.8 });
      roof(cx, cz, w, d, SW + H + 0.8); top = H;
    } else {
      // 带退台的塔楼：两到三段
      const mat = type === 'glass' ? 'glass' : 'facade';
      const c1 = type === 'glass' ? pick(r, GLASS_C) : pick(r, FACADE_C);
      const tiers = H > 40 ? 3 : H > 20 ? 2 : 1;
      let tw = w, td = d, y = 0;
      const podium = type === 'glass' ? 6 : 0;
      if (podium) { b.box(w, podium, d, cx, SW, cz, pick(r, FACADE_C), { mat: 'facade' }); y = podium; tw = w * 0.85; td = d * 0.85; }
      col.box(cx, cz, w, d, { yMax: SW + (podium || H) });
      for (let t = 0; t < tiers; t++) {
        const hseg = (H - y) / (tiers - t) * (t === tiers - 1 ? 1 : 0.8 + r() * 0.3);
        b.box(tw, hseg, td, cx, SW + y, cz, t === 0 ? c1 : (r() < 0.5 ? c1 : pick(r, FACADE_C)), { mat });
        b.box(tw + 0.4, 0.5, td + 0.4, cx, SW + y + hseg, cz, 0xe8e0d0);
        if (podium || t > 0) col.box(cx, cz, tw, td, { yMax: SW + y + hseg + 0.5 });
        y += hseg; tw *= 0.78; td *= 0.78;
      }
      if (tiers === 1 && H < 22 && r() < 0.55) {
        // 坡屋顶 + 老虎窗：街屋感
        const rc = pick(r, [0xb5523b, 0x7a4a3a, 0x3f6f6a, 0x8a5a3a, 0x5a6f8a]);
        const ridge = Math.min(w, d) * 0.32;
        const alongX = w > d;
        b.box(alongX ? w + 0.8 : d * 0.75, ridge * 0.9, alongX ? d * 0.75 : d + 0.8, cx, SW + y + 0.5, cz, rc, { rx: alongX ? 0 : 0, mat: 'solid' });
        b.box(alongX ? w + 1.0 : 0.6, ridge * 0.35, alongX ? 0.6 : d + 1.0, cx, SW + y + 0.5 + ridge * 0.85, cz, shade(rc, 0.8));
        for (let k2 = -1; k2 <= 1; k2 += 2) b.box(2.2, 1.8, 1.4, cx + (alongX ? k2 * w * 0.22 : (d * 0.36)), SW + y + 0.6, cz + (alongX ? d * 0.36 : k2 * d * 0.22), 0xf3e3c3, { mat: 'facade' });
      } else roof(cx, cz, tw / 0.78, td / 0.78, SW + y + 0.5);
      // 每层阳台条（立面层次）
      if (type === 'facade' && H < 30) for (let yy = 8; yy < H - 2; yy += 7.2) {
        if (faces.S) b.box(w * 0.86, 0.25, 1.2, cx, SW + yy, z1 + 0.5, 0xf6ecd8);
        if (faces.N) b.box(w * 0.86, 0.25, 1.2, cx, SW + yy, z0 - 0.5, 0xf6ecd8);
      }
      top = y;
    }
    // 底商（面向道路的立面）
    if (top >= 6) {
      if (faces.S) shopfront(cx, z1, 0, 1, w);
      if (faces.N) shopfront(cx, z0, 0, -1, w);
      if (faces.E) shopfront(x1, cz, 1, 0, d);
      if (faces.W) shopfront(x0, cz, -1, 0, d);
    }
    // 楼顶广告牌（少量）
    if (bbIdx < BILLBOARDS.length && top >= 10 && top <= 40 && type !== 'giraffe' && r() < 0.35 && (faces.S || faces.N)) {
      const [txt, bg, fg] = BILLBOARDS[bbIdx++];
      const zf = faces.S ? z1 - 1 : z0 + 1, yb = SW + top + 1;
      for (const s of [-3, 3]) b.box(0.3, 2.5, 0.3, cx + s, yb - 1, zf, 0x3a4048, { mat: 'metal' });
      b.box(10.4, 3.4, 0.3, cx, yb + 1.3, zf, 0x22262c, { mat: 'metal' });
      signMesh(txt, 10, { bg, fg, w: 768, h: 256, font: 'bold 64px "PingFang SC","Microsoft YaHei",sans-serif' }, cx, yb + 3.0, zf + (faces.S ? 0.2 : -0.2), faces.S ? 0 : Math.PI);
    }
  };
  for (const p of blocks) {
    if (p.landmark) continue;
    const I = p.in;
    const W = I.x1 - I.x0, Dd = I.z1 - I.z0;
    if (W < 6 || Dd < 6) continue;
    // 切成 2×2 或 3×2 的地块（中间留 2m 小巷）
    const nx = W > 50 ? 3 : W > 22 ? 2 : 1, nz = Dd > 50 ? 3 : Dd > 22 ? 2 : 1;
    const lw = (W - (nx - 1) * 2) / nx, ld = (Dd - (nz - 1) * 2) / nz;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x0 = I.x0 + i * (lw + 2), z0 = I.z0 + j * (ld + 2), x1 = x0 + lw, z1 = z0 + ld;
      if (!CLEAR.every(c => distRect(c.x, c.z, x0, z0, x1, z1) > c.r)) continue;
      if (r() < 0.07 && lw < 30) {
        // 小口袋公园
        b.box(lw, 0.05, ld, (x0 + x1) / 2, SW, (z0 + z1) / 2, 0x7fae55, { shadow: false });
        tree((x0 + x1) / 2, (z0 + z1) / 2, false);
        continue;
      }
      building(x0, z0, x1, z1, {
        N: j === 0 && p.road.N, S: j === nz - 1 && p.road.S, W: i === 0 && p.road.W, E: i === nx - 1 && p.road.E,
      });
    }
  }

  return { towers, signs: signCount, animated: animated.length };
}
