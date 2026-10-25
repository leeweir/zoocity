// 小型啮齿镇（Little Rodentia）—— 撒瓦纳中央区东南角的微缩小镇
//
// 范围：DISTRICTS.rodentia.rect = x 207..280, z 207..280。外圈是与撒瓦纳一致的人行道（高 0.15m），
// 内部由 1.2m 高的围墙圈起（墙中线 x/z = 211 与 277），北墙在 spots.gate (244,212) 处开 4m 宽的门洞。
// 建筑 0.6–3m 高，facadeSmall 材质；朱迪（1m）在这里像个巨人。
// 所有小楼都有碰撞体（walkable，矮楼可以踩上去）；微型道路无碰撞体。
//
// 主要地标 / 地点：
//   北门 + 拱门招牌          (244, 211)
//   中心广场                 (244, 244)  方形广场 237..251，北侧小喷泉 (244, 249.2)
//   微型珠宝店（Fru Fru 系列） (231.6, 258.6)，门口 spots.jeweler (228, 262)
//   Fru Fru 婚纱精品店        (258.6, 231.4)，门口 spots.fruFru (262, 228)
//   仓鼠管道（西墙 + 北墙内侧，离地 1.75m，滚动仓鼠球动画）
// spots 周围 1.5m 内无碰撞体（微缩尺度）。
import * as THREE from 'three';
import { LANDMARKS } from '../layout.js';

const S = LANDMARKS.rodentia.spots;
const BASE = 0.15;              // 整个街区铺一层人行道高度的地台
const R0 = 207, R1 = 280;       // 街区边界
const W0 = 211, W1 = 277;       // 围墙中线
const IN0 = 212.6, IN1 = 275.4; // 墙内环形步道以内的可建区
const SQ = { x0: 237, x1: 251, z0: 237, z1: 251 }; // 中心广场
const VROADS = [{ c: 225, w: 2 }, { c: 244, w: 3 }, { c: 263, w: 2 }]; // 南北向微型路（x 坐标）
const HROADS = [{ c: 225, w: 2 }, { c: 244, w: 3 }, { c: 263, w: 2 }]; // 东西向微型路（z 坐标）
const CLEAR_R = 1.5;

export const POI = {
  gate:     { x: S.gate.x, y: BASE, z: S.gate.z, label: '小型啮齿镇北门' },
  square:   { x: S.square.x, y: BASE, z: S.square.z, label: '啮齿镇中心广场' },
  jeweler:  { x: S.jeweler.x, y: BASE, z: S.jeweler.z, label: '微型珠宝店门口' },
  fruFru:   { x: S.fruFru.x, y: BASE, z: S.fruFru.z, label: 'Fru Fru 婚纱精品店门口' },
  outside:  { x: 244, y: BASE, z: 208.5, label: '啮齿镇门外人行道' },
};

// 三角棱柱（坡屋顶）：x∈[-.5,.5]，y∈[0,1]，z∈[-.5,.5]，屋脊沿 x
function prismGeo() {
  const p = [
    // 两个山墙三角
    -0.5, 0, 0.5, -0.5, 1, 0, -0.5, 0, -0.5,
    0.5, 0, -0.5, 0.5, 1, 0, 0.5, 0, 0.5,
    // 南坡
    -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0, -0.5, 0, 0.5, 0.5, 1, 0, -0.5, 1, 0,
    // 北坡
    0.5, 0, -0.5, -0.5, 0, -0.5, -0.5, 1, 0, 0.5, 0, -0.5, -0.5, 1, 0, 0.5, 1, 0,
    // 底
    -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}
const PRISM = prismGeo();
// 四坡屋顶：底面正好是 [-.5,.5]²
const PYR = new THREE.BufferGeometry().copy(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0));
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function addGeo(b, geo, x, y, z, sx, sy, sz, ry, color, opts = {}) {
  _q.setFromEuler(_e.set(0, ry, 0));
  _m4.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
  b.add(geo, _m4, color, opts);
}

// 点到矩形的距离
function distRect(px, pz, x0, z0, x1, z1) {
  const dx = Math.max(x0 - px, 0, px - x1), dz = Math.max(z0 - pz, 0, pz - z1);
  return Math.hypot(dx, dz);
}
function overlap(a, b, m = 0) {
  return a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.z0 < b.z1 + m && a.z1 > b.z0 - m;
}

const PASTEL = [0xf6c9c4, 0xf9e2ae, 0xc8e6c9, 0xbfd7ea, 0xe3c8f0, 0xffd8a8, 0xf4f1de, 0xd7ccc8, 0xb2dfdb, 0xffccbc, 0xfff0c2, 0xcfd8dc];
const ROOFS = [0xc0504d, 0x8d5a3b, 0x3f6e8c, 0x5b7f4a, 0x9c4f7a, 0x6d4c41, 0xd9822b];
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

export function build(ctx) {
  const { col, scene, tex } = ctx;
  const b = fastPrims(ctx.b);
  const r = ctx.rng(20160304);
  const spots = [S.jeweler, S.fruFru, S.square, S.gate];
  const clearOK = (x0, z0, x1, z1, extra = 0.2) =>
    spots.every(s => distRect(s.x, s.z, x0, z0, x1, z1) > CLEAR_R + extra);

  // ---------- 地台、人行道、内部地面 ----------
  b.box(R1 - R0, BASE, R1 - R0, (R0 + R1) / 2, 0, (R0 + R1) / 2, 0xc7beac, { shadow: false });
  col.box((R0 + R1) / 2, (R0 + R1) / 2, R1 - R0, R1 - R0, { yMax: BASE, walkable: true });
  // 路缘石（朝向撒瓦纳道路的西、北两侧）
  b.box(0.3, BASE + 0.01, R1 - R0, R0 + 0.15, 0, (R0 + R1) / 2, 0x9a958c, { shadow: false });
  b.box(R1 - R0, BASE + 0.01, 0.3, (R0 + R1) / 2, 0, R0 + 0.15, 0x9a958c, { shadow: false });
  // 墙内草地底色
  b.box(W1 - W0 - 0.3, 0.01, W1 - W0 - 0.3, (W0 + W1) / 2, BASE, (W0 + W1) / 2, 0x9ccf7a, { shadow: false });
  // 墙内环形步道（浅色石板）
  const ringC = 0xe0d6c2, ry0 = BASE + 0.012;
  b.box(W1 - W0, 0.012, IN0 - W0, (W0 + W1) / 2, ry0, (W0 + IN0) / 2, ringC, { shadow: false });
  b.box(W1 - W0, 0.012, W1 - IN1, (W0 + W1) / 2, ry0, (W1 + IN1) / 2, ringC, { shadow: false });
  b.box(IN0 - W0, 0.012, W1 - W0, (W0 + IN0) / 2, ry0, (W0 + W1) / 2, ringC, { shadow: false });
  b.box(W1 - IN1, 0.012, W1 - W0, (W1 + IN1) / 2, ry0, (W0 + W1) / 2, ringC, { shadow: false });

  // ---------- 围墙 + 北门 ----------
  const wallH = 1.2, wallT = 0.3, wallC = 0xc98b5e, capC = 0xeadbc4;
  const gx0 = 242, gx1 = 246;
  const wall = (x0, z0, x1, z1) => {
    const w = Math.max(wallT, x1 - x0), d = Math.max(wallT, z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    b.box(w, wallH, d, cx, BASE, cz, wallC, { jitter: 0.08 });
    b.box(w + 0.1, 0.1, d + 0.1, cx, BASE + wallH, cz, capC);
    col.box(cx, cz, w, d, { yMax: BASE + wallH + 0.1 });
  };
  wall(W0, W0, gx0 - 0.4, W0);
  wall(gx1 + 0.4, W0, W1, W0);
  wall(W0, W1, W1, W1);
  wall(W0, W0, W0, W1);
  wall(W1, W0, W1, W1);
  // 墙上小立柱
  for (let t = W0; t <= W1 + 0.01; t += 6) {
    for (const [px, pz] of [[t, W1], [W0, t], [W1, t]]) b.box(0.45, wallH + 0.25, 0.45, px, BASE, pz, capC);
    if (t < gx0 - 1 || t > gx1 + 1) b.box(0.45, wallH + 0.25, 0.45, t, BASE, W0, capC);
  }
  // 门柱 + 拱梁（梁离地 2.25m，朱迪可通过）
  for (const px of [gx0 - 0.3, gx1 + 0.3]) {
    b.box(0.7, 2.5, 0.7, px, BASE, W0, 0xf2e6d0);
    b.box(0.85, 0.15, 0.85, px, BASE + 2.5, W0, 0xd4a64a, { mat: 'shiny' });
    b.sphere(0.22, px, BASE + 2.8, W0, 0xf28bb5, { mat: 'shiny', seg: 8 });
    col.box(px, W0, 0.7, 0.7, { yMax: BASE + 2.65 });
  }
  b.box(gx1 - gx0 + 1.4, 0.45, 0.5, (gx0 + gx1) / 2, BASE + 2.25, W0, 0xf28bb5, { mat: 'shiny' });
  for (const sgn of [-1, 1]) {
    const m = tex.signMesh('小型啮齿镇 · LITTLE RODENTIA', 4.6, { bg: '#f28bb5', fg: '#ffffff', w: 1024, h: 128, font: 'bold 64px "PingFang SC","Microsoft YaHei",sans-serif' });
    m.position.set((gx0 + gx1) / 2, BASE + 2.475, W0 + sgn * 0.26);
    m.rotation.y = sgn > 0 ? 0 : Math.PI;
    scene.add(m);
  }
  // 门口斑马线（墙外人行道上画装饰）
  for (let i = 0; i < 5; i++) b.box(0.35, 0.01, 2.4, gx0 + 0.4 + i * 0.8, BASE, 209, 0xffffff, { shadow: false });

  // ---------- 微型道路 ----------
  const asphalt = 0x55585e, sideC = 0xd8d0c0, ry = BASE + 0.014;
  const roadSeg = (vertical, c, w, a0, a1) => {
    if (a1 - a0 < 0.05) return;
    const m = (a0 + a1) / 2, L = a1 - a0;
    if (vertical) b.box(w, 0.012, L, c, ry, m, asphalt, { shadow: false });
    else b.box(L, 0.012, w, m, ry, c, asphalt, { shadow: false });
    // 中线虚线
    for (let t = a0 + 0.6; t < a1 - 0.6; t += 1.0) {
      if (vertical) b.box(0.05, 0.006, 0.45, c, ry + 0.012, t + 0.22, 0xf5d142, { shadow: false });
      else b.box(0.45, 0.006, 0.05, t + 0.22, ry + 0.012, c, 0xf5d142, { shadow: false });
    }
    // 两侧窄人行道（0.5m，略高）
    for (const s of [-1, 1]) {
      const o = c + s * (w / 2 + 0.25);
      if (vertical) b.box(0.5, 0.04, L, o, BASE, m, sideC, { shadow: false });
      else b.box(L, 0.04, 0.5, m, BASE, o, sideC, { shadow: false });
    }
  };
  // 竖向道路：从墙到墙，跨过广场时断开
  for (const R of VROADS) {
    const a0 = R.c === 244 ? W0 : IN0, a1 = IN1;
    if (R.c > SQ.x0 && R.c < SQ.x1) { roadSeg(true, R.c, R.w, a0, SQ.z0); roadSeg(true, R.c, R.w, SQ.z1, a1); }
    else roadSeg(true, R.c, R.w, a0, a1);
  }
  for (const R of HROADS) {
    if (R.c > SQ.z0 && R.c < SQ.z1) { roadSeg(false, R.c, R.w, IN0, SQ.x0); roadSeg(false, R.c, R.w, SQ.x1, IN1); }
    else roadSeg(false, R.c, R.w, IN0, IN1);
  }

  // ---------- 中心广场 ----------
  b.box(SQ.x1 - SQ.x0, 0.02, SQ.z1 - SQ.z0, 244, BASE, 244, 0xe9dcc3, { shadow: false });
  // 棋盘格铺装
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
    if ((i + j) % 2) continue;
    b.box(2, 0.006, 2, SQ.x0 + 1 + i * 2, BASE + 0.02, SQ.z0 + 1 + j * 2, 0xd3bf9c, { shadow: false });
  }
  // 小喷泉（广场南侧，离 square 点 5m）
  const fx = 244, fz = 249.2;
  b.cyl(0.95, 1.0, 0.25, fx, BASE, fz, 0xcfc6b8, { seg: 12 });
  b.cyl(0.85, 0.85, 0.02, fx, BASE + 0.23, fz, 0x5fb3d9, { mat: 'water', seg: 12 });
  b.cyl(0.12, 0.16, 0.6, fx, BASE + 0.25, fz, 0xcfc6b8, { seg: 8 });
  b.cyl(0.4, 0.3, 0.08, fx, BASE + 0.85, fz, 0xcfc6b8, { seg: 10 });
  b.sphere(0.12, fx, BASE + 1.0, fz, 0xf28bb5, { mat: 'shiny', seg: 8 });
  col.circle(fx, fz, 1.0, { yMax: BASE + 0.25, walkable: true });
  const jetMat = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.6, roughness: 0.1 });
  const jet = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.45, 10, 1, true), jetMat);
  jet.position.set(fx, BASE + 0.62 + 0.225, fz); jet.rotation.x = Math.PI;
  scene.add(jet);
  // 广场四角的长椅（微缩，0.25m 高）与小树
  for (const [bx, bz, rr] of [[239, 239.4, 0], [249, 239.4, 0], [239, 248.6, 0], [249, 248.6, 0]]) {
    b.box(1.0, 0.04, 0.3, bx, BASE + 0.2, bz, 0x8d5a3b, { ry: rr });
    b.box(1.0, 0.25, 0.04, bx, BASE + 0.2, bz + (bz < 244 ? -0.15 : 0.15), 0x8d5a3b);
    for (const s of [-0.4, 0.4]) b.box(0.05, 0.2, 0.26, bx + s, BASE, bz, 0x333333, { mat: 'metal' });
  }
  for (const [tx, tz] of [[237.8, 237.8], [250.2, 237.8], [237.8, 250.2], [250.2, 250.2]]) {
    b.cyl(0.07, 0.09, 0.6, tx, BASE, tz, 0x6d4c41, { seg: 6 });
    b.sphere(0.55, tx, BASE + 0.95, tz, 0x5fae4e, { mat: 'leaf', seg: 8 });
    col.circle(tx, tz, 0.12, { yMax: BASE + 0.6 });
  }
  // 广场旗杆 + 小镇雕像（老鼠站在奶酪上）
  {
    const sx = 247.5, sz = 241;
    b.box(0.8, 0.35, 0.8, sx, BASE, sz, 0xd8cdb8);
    b.box(0.5, 0.25, 0.4, sx, BASE + 0.35, sz, 0xf5c542, { mat: 'shiny' });
    b.sphere(0.12, sx, BASE + 0.72, sz, 0x9e9e9e, { sy: 1.3, seg: 8 });
    b.sphere(0.07, sx, BASE + 0.9, sz - 0.04, 0x9e9e9e, { seg: 8 });
    for (const s of [-1, 1]) b.sphere(0.045, sx + s * 0.06, BASE + 0.98, sz, 0xf3b6c4, { seg: 6, sz: 0.4 });
    col.box(sx, sz, 0.8, 0.8, { yMax: BASE + 0.6, walkable: true });
  }

  // ---------- 地标：微型珠宝店（门朝南，正对 spots.jeweler） ----------
  const reserved = [];
  {
    const x0 = 226.8, x1 = 232.4, z0 = 255.4, z1 = 260.2, h = 2.6;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    b.box(x1 - x0, h, z1 - z0, cx, BASE, cz, 0xf3e3ec, { mat: 'facadeSmall' });
    b.box(x1 - x0 + 0.2, 0.15, z1 - z0 + 0.2, cx, BASE + h, cz, 0xd4a64a, { mat: 'shiny' });
    addGeo(b, PYR, cx, BASE + h + 0.15, cz, x1 - x0, 0.9, z1 - z0, 0, 0x7b4fa0, { mat: 'shiny' });
    b.sphere(0.25, cx, BASE + h + 1.15, cz, 0x9fe8ff, { mat: 'glow', seg: 8, sy: 1.4 }); // 屋顶大钻石
    // 橱窗 + 小门 + 遮阳篷
    b.box(1.5, 0.8, 0.05, cx - 1.6, BASE + 0.25, z1 + 0.01, 0xfff6d8, { mat: 'glow' });
    b.box(1.5, 0.8, 0.05, cx + 1.6, BASE + 0.25, z1 + 0.01, 0xfff6d8, { mat: 'glow' });
    b.box(0.6, 0.9, 0.06, cx, BASE, z1 + 0.01, 0x5a2d6e);
    for (let i = 0; i < 6; i++) b.box(0.9, 0.05, 0.7, x0 + 0.45 + i * 0.93, BASE + 1.2, z1 + 0.3, i % 2 ? 0xffffff : 0xb06ad1, { rx: 0.35 });
    col.box(cx, cz, x1 - x0, z1 - z0, { yMax: BASE + h + 0.15, walkable: true });
    const m = tex.signMesh('珠宝 · JEWELRY', 3.6, { bg: '#5a2d6e', fg: '#ffe9a8', w: 512, h: 96, font: 'bold 56px "PingFang SC","Microsoft YaHei",sans-serif' });
    m.position.set(cx, BASE + 1.75, z1 + 0.03);
    scene.add(m);
    reserved.push({ x0, x1, z0, z1 });
    ctx.addLabel(cx, BASE + h + 1.5, cz, '微型珠宝店', '#b06ad1');
  }
  // ---------- 地标：Fru Fru 婚纱精品店（门朝西，正对 spots.fruFru） ----------
  {
    const x0 = 264.2, x1 = 269.6, z0 = 227.4, z1 = 233.4, h = 2.9;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    b.box(x1 - x0, h, z1 - z0, cx, BASE, cz, 0xfde2ef, { mat: 'facadeSmall' });
    b.box(x1 - x0 + 0.2, 0.12, z1 - z0 + 0.2, cx, BASE + h, cz, 0xffffff, { mat: 'shiny' });
    addGeo(b, PRISM, cx, BASE + h + 0.12, cz, z1 - z0, 1.0, x1 - x0, Math.PI / 2, 0xf06292, { mat: 'shiny' });
    // 塔楼
    b.cyl(0.55, 0.55, h + 0.6, x1 - 0.6, BASE, z0 + 0.6, 0xfff0f6, { mat: 'facadeSmall', seg: 10 });
    b.cone(0.7, 1.0, x1 - 0.6, BASE + h + 0.6, z0 + 0.6, 0xf06292, { seg: 10, mat: 'shiny' });
    b.box(0.05, 0.9, 1.4, x0 - 0.01, BASE + 0.25, cz - 1.6, 0xfff6d8, { mat: 'glow' });
    b.box(0.05, 0.9, 1.4, x0 - 0.01, BASE + 0.25, cz + 1.6, 0xfff6d8, { mat: 'glow' });
    b.box(0.06, 1.0, 0.7, x0 - 0.01, BASE, cz, 0xb0306a);
    col.box(cx, cz, x1 - x0, z1 - z0, { yMax: BASE + h + 0.12, walkable: true });
    col.circle(x1 - 0.6, z0 + 0.6, 0.55, { yMax: BASE + h + 0.6 });
    const m = tex.signMesh('Fru Fru 婚纱', 3.2, { bg: '#f06292', fg: '#ffffff', w: 512, h: 112, font: 'bold 60px "PingFang SC","Microsoft YaHei",sans-serif' });
    m.position.set(x0 - 0.03, BASE + 1.85, cz); m.rotation.y = -Math.PI / 2;
    scene.add(m);
    reserved.push({ x0: x0, x1: x1, z0: z0, z1: z1 });
    ctx.addLabel(cx, BASE + h + 1.5, cz, 'Fru Fru 婚纱精品店', '#f06292');
  }

  // ---------- 街区地块：把道路之间的格子切成小地块，填满微缩房屋 ----------
  const edges = (roads) => {
    const cuts = [IN0];
    for (const R of roads) cuts.push(R.c - R.w / 2 - 0.55, R.c + R.w / 2 + 0.55);
    cuts.push(IN1);
    const out = [];
    for (let i = 0; i < cuts.length; i += 2) out.push([cuts[i], cuts[i + 1]]);
    return out;
  };
  const xs = edges(VROADS), zs = edges(HROADS);
  const sqM = { x0: SQ.x0 - 0.4, x1: SQ.x1 + 0.4, z0: SQ.z0 - 0.4, z1: SQ.z1 + 0.4 };
  let houses = 0;
  const parks = [];
  for (const [cx0, cx1] of xs) for (const [cz0, cz1] of zs) {
    const nx = Math.max(1, Math.round((cx1 - cx0) / 2.9)), nz = Math.max(1, Math.round((cz1 - cz0) / 2.9));
    const sw = (cx1 - cx0) / nx, sd = (cz1 - cz0) / nz;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const lx0 = cx0 + i * sw, lz0 = cz0 + j * sd;
      const lot = { x0: lx0, x1: lx0 + sw, z0: lz0, z1: lz0 + sd };
      if (overlap(lot, sqM)) continue;
      if (reserved.some(rv => overlap(lot, rv, 0.5))) continue;
      const edge = i === 0 || j === 0 || i === nx - 1 || j === nz - 1;
      // 内部地块有一定概率是小公园
      if (!edge && r() < 0.5 || r() < 0.08) { parks.push(lot); continue; }
      // 房屋尺寸（留 0.15–0.35m 的缝当小巷）
      const g = 0.15 + r() * 0.2;
      const bx0 = lot.x0 + g, bx1 = lot.x1 - g, bz0 = lot.z0 + g, bz1 = lot.z1 - g;
      if (bx1 - bx0 < 0.8 || bz1 - bz0 < 0.8) continue;
      if (!clearOK(bx0, bz0, bx1, bz1)) { parks.push(lot); continue; }
      // 门朝最近的格子边（即道路方向）
      const dW = i, dE = nx - 1 - i, dN = j, dS = nz - 1 - j;
      const mn = Math.min(dW, dE, dN, dS);
      const face = mn === dS ? 'S' : mn === dN ? 'N' : mn === dE ? 'E' : 'W';
      house(bx0, bz0, bx1, bz1, face);
      houses++;
    }
  }

  function house(x0, z0, x1, z1, face) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const tall = r() < 0.18;
    let h = tall ? 2.2 + r() * 0.8 : 0.6 + r() * 1.6;
    const wallC = pick(r, PASTEL), roofC = pick(r, ROOFS);
    const style = r();
    let top = h;
    if (tall && w > 1.4 && d > 1.4) {
      // 两段退台小高楼
      const h1 = h * 0.6;
      b.box(w, h1, d, cx, BASE, cz, wallC, { mat: 'facadeSmall' });
      b.box(w * 0.7, h - h1, d * 0.7, cx, BASE + h1, cz, pick(r, PASTEL), { mat: 'facadeSmall' });
      b.box(w * 0.74, 0.06, d * 0.74, cx, BASE + h, cz, 0xffffff);
      if (r() < 0.6) b.cyl(0.015, 0.015, 0.5, cx + w * 0.2, BASE + h, cz, 0x666666, { mat: 'metal', seg: 4 });
      top = h + 0.06;
    } else {
      b.box(w, h, d, cx, BASE, cz, wallC, { mat: 'facadeSmall' });
      if (style < 0.45) {
        const ry = w >= d ? 0 : Math.PI / 2;
        const rh = 0.35 + r() * 0.35;
        addGeo(b, PRISM, cx, BASE + h, cz, (w >= d ? w : d) + 0.1, rh, (w >= d ? d : w) + 0.14, ry, roofC);
        top = h + rh * 0.5;
        if (r() < 0.4) b.box(0.12, rh * 0.9, 0.12, cx + w * 0.25, BASE + h, cz + d * 0.15, 0x8d6e63); // 小烟囱
      } else if (style < 0.65) {
        const rh = 0.3 + r() * 0.4;
        addGeo(b, PYR, cx, BASE + h, cz, w + 0.1, rh, d + 0.1, 0, roofC);
        top = h + rh * 0.4;
      } else {
        // 平屋顶 + 女儿墙 + 屋顶小物件
        b.box(w + 0.06, 0.08, d + 0.06, cx, BASE + h, cz, 0xeeeeee);
        if (r() < 0.5) b.cyl(0.12, 0.12, 0.22, cx - w * 0.2, BASE + h + 0.08, cz, 0x9e7b5a, { seg: 8 }); // 小水塔
        else b.box(0.25, 0.12, 0.2, cx + w * 0.2, BASE + h + 0.08, cz - d * 0.15, 0xb0bec5, { mat: 'metal' }); // 空调
        top = h + 0.08;
      }
    }
    // 小门 + 门头遮阳篷 + 招牌条
    const dw = 0.22, dh = Math.min(0.42, h * 0.6);
    const awC = pick(r, [0xe53935, 0x43a047, 0x1e88e5, 0xfdd835, 0x8e24aa, 0xff7043]);
    const shop = h > 0.9 && r() < 0.45;
    if (face === 'S' || face === 'N') {
      const s = face === 'S' ? 1 : -1, fz = cz + s * (d / 2 + 0.01);
      b.box(dw, dh, 0.03, cx, BASE, fz, 0x5d4037);
      if (shop) {
        b.box(Math.min(w * 0.9, 1.4), 0.03, 0.22, cx, BASE + dh + 0.05, fz + s * 0.1, awC, { rx: s * 0.3 });
        b.box(Math.min(w * 0.7, 1.1), 0.12, 0.02, cx, BASE + dh + 0.12, fz, 0xfff3c4, { mat: 'glow' });
      }
    } else {
      const s = face === 'E' ? 1 : -1, fx = cx + s * (w / 2 + 0.01);
      b.box(0.03, dh, dw, fx, BASE, cz, 0x5d4037);
      if (shop) {
        b.box(0.22, 0.03, Math.min(d * 0.9, 1.4), fx + s * 0.1, BASE + dh + 0.05, cz, awC, { rz: -s * 0.3 });
        b.box(0.02, 0.12, Math.min(d * 0.7, 1.1), fx, BASE + dh + 0.12, cz, 0xfff3c4, { mat: 'glow' });
      }
    }
    col.box(cx, cz, w, d, { yMax: BASE + top, walkable: true });
  }

  // 小公园：草坪 + 1–3 棵小树 + 花
  for (const p of parks) {
    const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
    b.box(p.x1 - p.x0 - 0.2, 0.03, p.z1 - p.z0 - 0.2, cx, BASE, cz, 0x7cc46a, { shadow: false });
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const tx = p.x0 + 0.5 + r() * (p.x1 - p.x0 - 1), tz = p.z0 + 0.5 + r() * (p.z1 - p.z0 - 1);
      if (!spots.every(s => Math.hypot(s.x - tx, s.z - tz) > CLEAR_R + 0.2)) continue;
      const th = 0.4 + r() * 0.6;
      b.cyl(0.04, 0.06, th, tx, BASE, tz, 0x6d4c41, { seg: 6 });
      if (r() < 0.5) b.sphere(0.3 + r() * 0.2, tx, BASE + th + 0.2, tz, pick(r, [0x4caf50, 0x66bb6a, 0x7cb342]), { mat: 'leaf', seg: 8 });
      else b.cone(0.3, 0.8, tx, BASE + th * 0.6, tz, 0x2e7d32, { mat: 'leaf', seg: 8 });
      col.circle(tx, tz, 0.08, { yMax: BASE + th });
    }
    for (let k = 0; k < 4; k++) b.sphere(0.06, p.x0 + 0.3 + r() * (p.x1 - p.x0 - 0.6), BASE + 0.06, p.z0 + 0.3 + r() * (p.z1 - p.z0 - 0.6), pick(r, [0xff80ab, 0xfff176, 0xffffff, 0xba68c8]), { seg: 6 });
  }

  // ---------- 微缩路灯（0.7m，沿道路人行道） ----------
  const lamp = (x, z) => {
    if (!spots.every(s => Math.hypot(s.x - x, s.z - z) > 0.6)) return;
    b.cyl(0.02, 0.025, 0.7, x, BASE + 0.04, z, 0x37474f, { mat: 'metal', seg: 6 });
    b.sphere(0.06, x, BASE + 0.78, z, 0xfff1c1, { mat: 'glow', seg: 6 });
  };
  for (const R of VROADS) for (let t = IN0 + 1.5; t < IN1; t += 4.5) {
    if (t > SQ.z0 - 0.5 && t < SQ.z1 + 0.5) continue;
    lamp(R.c - R.w / 2 - 0.25, t); lamp(R.c + R.w / 2 + 0.25, t + 2.2);
  }
  for (const R of HROADS) for (let t = IN0 + 3.5; t < IN1; t += 4.5) {
    if (t > SQ.x0 - 0.5 && t < SQ.x1 + 0.5) continue;
    lamp(t, R.c - R.w / 2 - 0.25);
  }
  for (let t = SQ.x0; t <= SQ.x1; t += 3.5) { lamp(t, SQ.z0 + 0.2); lamp(t, SQ.z1 - 0.2); }

  // ---------- 微缩汽车 ----------
  const carColors = [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047, 0xffffff, 0xff7043, 0x8e24aa, 0x00acc1];
  // 静态停放车：只在宽 2m 的支路边
  const staticCar = (x, z, ry, c) => {
    b.box(0.5, 0.12, 0.26, x, BASE + 0.03, z, c, { mat: 'shiny', ry });
    b.box(0.28, 0.1, 0.22, x, BASE + 0.15, z, 0x9fd3f5, { mat: 'glass', ry });
  };
  for (const R of VROADS) if (R.w < 2.5) for (let t = IN0 + 2; t < IN1 - 1; t += 3 + r() * 3) {
    if (r() < 0.5) staticCar(R.c + 0.65, t, Math.PI / 2, pick(r, carColors));
  }
  for (const R of HROADS) if (R.w < 2.5) for (let t = IN0 + 2; t < IN1 - 1; t += 3 + r() * 3) {
    if (r() < 0.5) staticCar(t, R.c + 0.65, 0, pick(r, carColors));
  }
  // 动态车：在道路上往返的小车（独立 Mesh，共享几何体/材质）
  const carGeo = new THREE.BoxGeometry(0.5, 0.13, 0.26).translate(0, 0.095, 0);
  const cabGeo = new THREE.BoxGeometry(0.28, 0.1, 0.22).translate(-0.02, 0.2, 0);
  const cabMat = new THREE.MeshStandardMaterial({ color: 0x9fd3f5, roughness: 0.1, metalness: 0.6 });
  const movers = [];
  const routes = [];
  for (const R of VROADS) routes.push({ v: true, c: R.c, a0: R.c === 244 ? IN0 : IN0, a1: R.c === 244 ? SQ.z0 - 0.5 : IN1 });
  for (const R of HROADS) routes.push({ v: false, c: R.c, a0: IN0, a1: R.c === 244 ? SQ.x0 - 0.5 : IN1 });
  routes.push({ v: true, c: 244, a0: SQ.z1 + 0.5, a1: IN1 }, { v: false, c: 244, a0: SQ.x1 + 0.5, a1: IN1 });
  routes.forEach((rt, k) => {
    for (const dir of [1, -1]) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(carGeo, new THREE.MeshStandardMaterial({ color: carColors[(k * 2 + (dir > 0 ? 0 : 1)) % carColors.length], roughness: 0.35 }));
      const cab = new THREE.Mesh(cabGeo, cabMat);
      body.castShadow = true;
      g.add(body, cab);
      scene.add(g);
      movers.push({ g, rt, dir, t: r(), speed: 0.9 + r() * 0.6 });
    }
  });
  // ---------- 仓鼠管道（西墙、北墙内侧，透明管 + 滚动仓鼠球） ----------
  const tubeY = BASE + 1.75, tubeR = 0.32;
  const tubeMat = new THREE.MeshStandardMaterial({ color: 0xcfefff, transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false });
  const tubes = [
    { a: new THREE.Vector3(W0 + 0.7, tubeY, 214), b: new THREE.Vector3(W0 + 0.7, tubeY, 274) },
    { a: new THREE.Vector3(213, tubeY, W0 + 0.7), b: new THREE.Vector3(238, tubeY, W0 + 0.7) },
    { a: new THREE.Vector3(250, tubeY, W0 + 0.7), b: new THREE.Vector3(275, tubeY, W0 + 0.7) },
  ];
  for (const tb of tubes) {
    const len = tb.a.distanceTo(tb.b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(tubeR, tubeR, len, 12, 1, true), tubeMat);
    m.position.copy(tb.a).add(tb.b).multiplyScalar(0.5);
    if (Math.abs(tb.a.z - tb.b.z) > 0.1) m.rotation.x = Math.PI / 2; else m.rotation.z = Math.PI / 2;
    scene.add(m);
    // 管道支架（细柱，带碰撞体）与彩色接头环
    for (let t = 0; t <= 1.001; t += 1 / Math.round(len / 6)) {
      const p = tb.a.clone().lerp(tb.b, t);
      b.cyl(0.05, 0.05, tubeY - BASE - tubeR, p.x, BASE, p.z, 0x90a4ae, { mat: 'metal', seg: 6 });
      b.cyl(tubeR + 0.04, tubeR + 0.04, 0.12, p.x, tubeY - 0.06, p.z, 0xf28bb5, { mat: 'shiny', seg: 10, rx: Math.abs(tb.a.z - tb.b.z) > 0.1 ? Math.PI / 2 : 0, rz: Math.abs(tb.a.z - tb.b.z) > 0.1 ? 0 : Math.PI / 2 });
      col.circle(p.x, p.z, 0.08, { yMax: tubeY });
    }
    col.box(m.position.x, m.position.z, Math.abs(tb.a.x - tb.b.x) + tubeR * 2, Math.abs(tb.a.z - tb.b.z) + tubeR * 2, { yMin: tubeY - tubeR, yMax: tubeY + tubeR });
  }
  const ballGeo = new THREE.SphereGeometry(0.24, 12, 8);
  const balls = [];
  tubes.forEach((tb, k) => {
    for (let n = 0; n < 2; n++) {
      const ball = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ color: [0x9be7ff, 0xffd1e8, 0xfff59d][k], transparent: true, opacity: 0.75, roughness: 0.1 }));
      const ham = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd9a066 }));
      ham.position.y = -0.08; ham.scale.set(1.2, 0.9, 1);
      const g = new THREE.Group(); g.add(ball, ham); scene.add(g);
      balls.push({ g, ball, tb, t: n * 0.5, len: tb.a.distanceTo(tb.b) });
    }
  });

  // ---------- 动画 ----------
  const tmp = new THREE.Vector3();
  ctx.animate((dt, t) => {
    jet.scale.y = 1 + Math.sin(t * 6) * 0.12;
    for (const m of movers) {
      const L = m.rt.a1 - m.rt.a0;
      m.t = (m.t + dt * m.speed / L) % 2;
      const u = m.t < 1 ? m.t : 2 - m.t;          // 往返
      const goingPos = (m.t < 1) === (m.dir > 0);
      const along = m.dir > 0 ? m.rt.a0 + u * L : m.rt.a1 - u * L;
      const lane = goingPos ? 0.4 : -0.4;
      if (m.rt.v) { m.g.position.set(m.rt.c - lane, BASE + 0.014, along); m.g.rotation.y = goingPos ? -Math.PI / 2 : Math.PI / 2; }
      else { m.g.position.set(along, BASE + 0.014, m.rt.c + lane); m.g.rotation.y = goingPos ? 0 : Math.PI; }
    }
    for (const bl of balls) {
      bl.t = (bl.t + dt * 1.6 / bl.len) % 2;
      const u = bl.t < 1 ? bl.t : 2 - bl.t;
      tmp.copy(bl.tb.a).lerp(bl.tb.b, u);
      bl.g.position.set(tmp.x, tmp.y - tubeR + 0.25, tmp.z);
      bl.ball.rotation.x += dt * 6; bl.ball.rotation.z += dt * 3;
    }
  });

  ctx.addLabel(244, 4, 244, '小型啮齿镇', '#f28bb5');
  ctx.addLabel(S.gate.x, 3, S.gate.z, '啮齿镇北门', '#f28bb5');
  return { houses, parks: parks.length, animated: 1 + movers.length + balls.length };
}
