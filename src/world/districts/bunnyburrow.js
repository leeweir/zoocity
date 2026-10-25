// 兔窝镇 Bunnyburrow —— 朱迪的家乡（乡村田园风）
// 同时负责：跨运河大桥（BRIDGE，x=0, z 280..420）与运河两岸石砌堤岸（z=292 / z=408，x -500..500）及船只。
//
// 主要地标位置：
//   霍普斯家族农场 hoppsFarm   中心 (-180, 700)，入口 front (-30, 700)，农场大门 (-80, 700)
//       农舍 (-140, 668)  红色谷仓 (-200, 735，门朝东)  筒仓 (-215, 752)  风车 (-110, 755)
//       路边农产品摊「霍普斯农产品」 (-40, 712)  胡萝卜地 x -272..-185, z 626..688
//   吉迪恩的派店 gideonBakery  店铺 (110, 700，门朝西)，入口 front (30, 700)，露天餐桌 x 50..95
//   东边胡萝卜田 cropField      x 180..380, z 830..930，稻草人 (280, 880)
//   欢迎牌「欢迎来到兔窝镇 · 人口 81,592,807」 (-22, 437)，面朝北（城市方向），人口计数器会跳动
//   胡萝卜水塔 (130, 455)  村口胡萝卜雕像 (50, 478)  杂货铺 (32, 545)  小教堂 (150, 560)  鸭子池塘 (290, 500)
//   兔子洞屋（嵌在小山里的圆门房子）分布在西北村 / 西南坡 / 东侧
//   兔窝镇大桥：桥面 y≈0.3（两端）→ ≈4m（中段），两座悬索塔 z=315 / z=385，下有钢拱
//   南岸小码头 (-150, 398)
//
// 案件系统可用的有趣地点见下方 POI（全部可步行，周围 ≥3m 无碰撞体）。

import * as THREE from 'three';
import { Builder } from '../../core/builder.js';

export const POI = {
  welcomeSign:   { x: -22, y: 0, z: 444, label: '兔窝镇欢迎牌' },
  bridgeMid:     { x: 0, y: 4.0, z: 350, label: '兔窝镇大桥中央' },
  bridgeNorth:   { x: 0, y: 0.1, z: 276, label: '大桥北桥头' },
  dock:          { x: -150, y: 0.4, z: 400, label: '南岸小码头' },
  promenade:     { x: 110, y: 0, z: 416, label: '运河南岸步道' },
  farmFront:     { x: -30, y: 0, z: 700, label: '霍普斯农场入口' },
  farmStand:     { x: -34, y: 0, z: 704, label: '霍普斯农产品摊' },
  farmGate:      { x: -88, y: 0, z: 700, label: '农场大门' },
  farmhousePorch:{ x: -140, y: 0, z: 682, label: '霍普斯家农舍门廊' },
  barnDoor:      { x: -183, y: 0, z: 735, label: '红色谷仓大门' },
  windmill:      { x: -110, y: 0, z: 766, label: '农场风车下' },
  carrotPatch:   { x: -228, y: 0, z: 657, label: '霍普斯胡萝卜地' },
  bakeryFront:   { x: 30, y: 0, z: 700, label: '吉迪恩派店门口' },
  bakeryPatio:   { x: 68, y: 0, z: 700, label: '派店露天餐区' },
  bakeryBack:    { x: 125, y: 0, z: 730, label: '派店后院（送货车）' },
  scarecrow:     { x: 280, y: 0, z: 886, label: '胡萝卜田稻草人' },
  waterTower:    { x: 130, y: 0, z: 444, label: '胡萝卜水塔下' },
  carrotStatue:  { x: 50, y: 0, z: 466, label: '村口胡萝卜雕像' },
  generalStore:  { x: 20, y: 0, z: 545, label: '兔窝镇杂货铺门口' },
  chapel:        { x: 150, y: 0, z: 574, label: '小教堂门前' },
  duckPond:      { x: 290, y: 0, z: 525, label: '鸭子池塘边' },
  orchard:       { x: -383, y: 0, z: 512, label: '苹果园' },
  burrowNW:      { x: -150, y: 0, z: 530, label: '兔子洞屋（西北村）' },
  burrowSW:      { x: -200, y: 0, z: 862, label: '兔子洞屋（西南坡）' },
  sunflowers:    { x: 265, y: 0, z: 712, label: '向日葵田边' },
  cornMaze:      { x: -380, y: 0, z: 832, label: '玉米地入口' },
};

export function build(ctx) {
  const { b, col, scene, layout } = ctx;
  const { DISTRICTS, LANDMARKS, ROAD_W, WATER, BRIDGE } = layout;
  const D = DISTRICTS.bunnyburrow, R = D.rect;
  const rand = ctx.rng(4207);
  const rr = (a, c) => a + (c - a) * rand();
  const pick = (arr) => arr[(rand() * arr.length) | 0];
  const PI = Math.PI, HALF = PI / 2;
  let animCount = 0, signCount = 0;

  // ---------- 颜色 ----------
  const C = {
    grass: 0x86b55a, grassD: 0x6e9e48, grassL: 0x9cc66a, dirt: 0xa98457, dirtD: 0x8a6942, gravel: 0xbba580,
    soil: 0x6b4a2e, wood: 0x8a5a33, woodL: 0xb98a5a, woodD: 0x5e3d22, white: 0xf4f1e8, cream: 0xf3e3b3,
    red: 0xb3362b, roofBlue: 0x5d6f8f, roofBrown: 0x7b4a2c, stone: 0xb7ad9c, stoneD: 0x8f8677, orange: 0xf07a1e,
    leaf: 0x5c9c3f, carrotLeaf: 0x3f9a2f, hay: 0xe2c35f, metal: 0x9aa3a8, glass: 0x9cc8e6, lamp: 0xffe2a0,
  };

  // ---------- 预留区（避免随机散布物体压到地标 / 道路） ----------
  const resRects = [], resCircles = [];
  const reserve = (x0, z0, x1, z1) => resRects.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  const reserveC = (x, z, r) => resCircles.push({ x, z, r });
  function isFree(x, z, r = 1) {
    if (x < R.x0 + 3 || x > R.x1 - 3 || z < R.z0 + 3 || z > R.z1 - 3) return false;
    const hw = ROAD_W / 2 + 3 + r;
    for (const rx of D.roadsX) if (Math.abs(x - rx) < hw) return false;
    for (const rz of D.roadsZ) if (Math.abs(z - rz) < hw) return false;
    for (const q of resRects) if (x > q.x0 - r && x < q.x1 + r && z > q.z0 - r && z < q.z1 + r) return false;
    for (const c of resCircles) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + r) ** 2) return false;
    return true;
  }
  // POI / front 周围保留 4m
  for (const p of Object.values(POI)) reserveC(p.x, p.z, 4);
  for (const k of ['hoppsFarm', 'gideonBakery']) { const f = LANDMARKS[k].front; reserveC(f.x, f.z, 4); }

  // ---------- 局部坐标系工具（本地 +z 为正面） ----------
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
  function mat(x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
    return _m4.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
  }
  class L {
    constructor(x, z, ry = 0, bb = b) { this.x = x; this.z = z; this.ry = ry; this.c = Math.cos(ry); this.s = Math.sin(ry); this.b = bb; }
    p(lx, lz) { return [this.x + lx * this.c + lz * this.s, this.z - lx * this.s + lz * this.c]; }
    _o(o) { return { ...o, ry: this.ry + (o.ry || 0) }; }
    box(w, h, d, lx, y, lz, c, o = {}) { const [x, z] = this.p(lx, lz); this.b.box(w, h, d, x, y, z, c, this._o(o)); }
    cyl(rt, rb, h, lx, y, lz, c, o = {}) { const [x, z] = this.p(lx, lz); this.b.cyl(rt, rb, h, x, y, z, c, this._o(o)); }
    cone(r, h, lx, y, lz, c, o = {}) { const [x, z] = this.p(lx, lz); this.b.cone(r, h, x, y, z, c, this._o(o)); }
    sphere(r, lx, y, lz, c, o = {}) { const [x, z] = this.p(lx, lz); this.b.sphere(r, x, y, z, c, this._o(o)); }
    geo(g, w, h, d, lx, y, lz, c, o = {}) { const [x, z] = this.p(lx, lz); this.b.add(g, mat(x, y, z, w, h, d, o.rx || 0, this.ry + (o.ry || 0), o.rz || 0), c, o); }
    solid(w, d, lx, lz, yMax, o = {}) { const [x, z] = this.p(lx, lz); col.box(x, z, w, d, { ry: this.ry + (o.ry || 0), yMin: o.yMin || 0, yMax, walkable: !!o.walkable }); }
    circ(r, lx, lz, yMax) { const [x, z] = this.p(lx, lz); col.circle(x, z, r, { yMax }); }
    wheel(r, w, lx, y, lz, c = 0x2b2b2b) { this.cyl(r, r, w, lx + w / 2, y, lz, c, { rz: HALF, seg: 10 }); this.cyl(r * 0.55, r * 0.55, w + 0.04, lx + w / 2 + 0.02, y, lz, 0xc9a33a, { rz: HALF, seg: 8 }); }
  }

  // ---------- 共享几何 ----------
  const shapeGeo = (pts) => {
    const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]); sh.closePath();
    return new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
  };
  const gableZ = shapeGeo([[-0.5, 0], [0.5, 0], [0, 1]]);            // 屋脊沿 z
  const gableX = gableZ.clone().rotateY(HALF);                        // 屋脊沿 x
  const gambrelZ = shapeGeo([[-0.5, 0], [0.5, 0], [0.4, 0.55], [0, 1], [-0.4, 0.55]]);
  const sailTri = shapeGeo([[0, 0], [1, 0], [0, 1]]);
  const torus = new THREE.TorusGeometry(1, 0.12, 5, 12);

  // 两片坡屋顶（屋脊沿本地 x），墙顶 top，屋顶高 h，带山墙三角
  function gableRoof(l, w, d, lx, lz, top, h, wallC, roofC, oh = 0.5) {
    l.geo(gableX, w, h, d, lx, top, lz, wallC);
    const a = Math.atan2(h, d / 2), sl = Math.hypot(d / 2, h) + oh;
    l.box(w + oh * 2, 0.22, sl, lx, top + h / 2 - 0.05, lz + d / 4 + oh * Math.cos(a) / 2, roofC, { rx: a });
    l.box(w + oh * 2, 0.22, sl, lx, top + h / 2 - 0.05, lz - d / 4 - oh * Math.cos(a) / 2, roofC, { rx: -a });
  }
  // 窗户：本地正面 +z，face 为墙面 lz
  function windowAt(l, lx, y, lz, w = 1.2, h = 1.4, frame = C.white, ry = 0) {
    l.box(w + 0.3, h + 0.3, 0.12, lx, y - 0.15, lz, frame, { ry });
    const [ox, oz] = [Math.sin(ry) * 0.05, Math.cos(ry) * 0.05];
    l.box(w, h, 0.12, lx + ox, y, lz + oz, C.glass, { mat: 'glass', ry });
    l.box(w + 0.5, 0.12, 0.35, lx + ox * 2, y - 0.25, lz + oz * 2, frame, { ry });
  }

  // ---------- 招牌 ----------
  function signAt(text, width, x, y, z, ry, opts = {}) {
    const m = ctx.tex.signMesh(text, width, opts);
    m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); signCount++;
    return m;
  }
  // 本地坐标招牌（带木质背板），正面朝本地 +z
  function signL(l, text, width, lx, y, lz, opts = {}, board = C.woodD) {
    const ratio = (opts.h || 128) / (opts.w || 512), hgt = width * ratio;
    l.box(width + 0.4, hgt + 0.4, 0.15, lx, y - hgt / 2 - 0.2, lz - 0.1, board);
    const [x, z] = l.p(lx, lz + 0.02);
    return signAt(text, width, x, y, z, l.ry, opts);
  }

  // ---------- 动画对象 ----------
  function animGroup(x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); animCount++; return g; }
  const localB = (g) => new Builder(g, { chunk: 1e5 });

  // =====================================================================
  // 1. 地面与道路
  // =====================================================================
  const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2, W = R.x1 - R.x0, Dd = R.z1 - R.z0;
  b.box(W, 0.2, Dd, cx, -0.195, cz, D.ground, { shadow: false });
  // 草地色块
  for (let i = 0; i < 70; i++) {
    const x = rr(R.x0 + 20, R.x1 - 20), z = rr(R.z0 + 20, R.z1 - 20);
    if (!isFree(x, z, 8)) continue;
    b.cyl(1, 1, 0.012, x, 0, z, pick([C.grassD, C.grassL, 0x8fbb5c]), { seg: 10, sx: rr(6, 16), sz: rr(6, 16), shadow: false });
  }
  const hw = ROAD_W / 2;
  // 南北路 x=0
  for (const rx of D.roadsX) {
    const len = R.z1 - R.z0;
    b.box(ROAD_W, 0.03, len, rx, 0, cz, C.dirt, { shadow: false });
    for (const s of [-1, 1]) b.box(1.8, 0.02, len, rx + s * (hw + 0.9), 0, cz, C.gravel, { shadow: false });
    // 车辙（路口留空）
    const cuts = [R.z0, ...D.roadsZ.flatMap(z => [z - hw, z + hw]), R.z1].sort((a, c) => a - c);
    for (let i = 0; i < cuts.length; i += 2) {
      const z0 = cuts[i], z1 = cuts[i + 1]; if (z1 - z0 < 2) continue;
      for (const s of [-1, 1]) for (const o of [1.6, 4.6]) b.box(0.9, 0.04, z1 - z0, rx + s * o, 0, (z0 + z1) / 2, C.dirtD, { shadow: false });
      b.box(0.8, 0.036, z1 - z0, rx, 0, (z0 + z1) / 2, 0x9a9a5a, { shadow: false }); // 中间草线
    }
  }
  // 东西路 z=600, 820（与 x 路交叉处断开，避免重叠闪烁）
  for (const rz of D.roadsZ) {
    const xs = [R.x0, ...D.roadsX.flatMap(x => [x - hw, x + hw]), R.x1].sort((a, c) => a - c);
    for (let i = 0; i < xs.length; i += 2) {
      const x0 = xs[i], x1 = xs[i + 1]; if (x1 - x0 < 2) continue;
      const mx = (x0 + x1) / 2, ln = x1 - x0;
      b.box(ln, 0.03, ROAD_W, mx, 0, rz, C.dirt, { shadow: false });
      for (const s of [-1, 1]) b.box(ln, 0.02, 1.8, mx, 0, rz + s * (hw + 0.9), C.gravel, { shadow: false });
      for (const s of [-1, 1]) for (const o of [1.6, 4.6]) b.box(ln, 0.04, 0.9, mx, 0, rz + s * o, C.dirtD, { shadow: false });
      b.box(ln, 0.036, 0.8, mx, 0, rz, 0x9a9a5a, { shadow: false });
    }
  }

  // 乡村路灯：木杆 + 灯笼
  function countryLamp(x, z, faceX, faceZ) {
    b.cyl(0.11, 0.15, 4.4, x, 0, z, C.woodD, { seg: 6 });
    const ax = x + faceX * 0.8, az = z + faceZ * 0.8;
    b.box(Math.abs(faceX) > 0 ? 1.0 : 0.1, 0.1, Math.abs(faceZ) > 0 ? 1.0 : 0.1, x + faceX * 0.45, 4.15, z + faceZ * 0.45, C.woodD);
    b.box(0.42, 0.06, 0.42, ax, 3.55, az, 0x2f2f2f);
    b.box(0.32, 0.45, 0.32, ax, 3.6, az, C.lamp, { mat: 'glow' });
    b.cone(0.32, 0.25, ax, 4.05, az, 0x2f2f2f, { seg: 4, ry: PI / 4 });
    col.circle(x, z, 0.25, { yMax: 4.4 });
  }
  {
    let k = 0;
    for (let z = 432; z < R.z1 - 5; z += 44) {
      if (D.roadsZ.some(rz => Math.abs(z - rz) < 14)) continue;
      const s = (k++ % 2) ? 1 : -1;
      countryLamp(s * (hw + 2.4), z, -s, 0);
    }
    for (const rz of D.roadsZ) {
      k = 0;
      for (let x = R.x0 + 12; x < R.x1 - 5; x += 46) {
        if (Math.abs(x) < 16) continue;
        const s = (k++ % 2) ? 1 : -1;
        countryLamp(x, rz + s * (hw + 2.4), 0, -s);
      }
    }
  }

  // =====================================================================
  // 2. 通用道具
  // =====================================================================
  const greens = [0x5c9c3f, 0x6aab44, 0x4e8a35, 0x74b04a];
  function tree(x, z, s = 1, kind = 'oak', collide = true) {
    if (kind === 'poplar') {
      b.cyl(0.16 * s, 0.24 * s, 2 * s, x, 0, z, 0x7a5232, { seg: 6 });
      b.sphere(1.3 * s, x, 4.3 * s, z, pick(greens), { sy: 2.3, seg: 8, mat: 'leaf' });
    } else {
      b.cyl(0.24 * s, 0.36 * s, 2.7 * s, x, 0, z, 0x7a5232, { seg: 6 });
      const g = pick(greens);
      b.sphere(2.3 * s, x, 4.3 * s, z, g, { seg: 8, mat: 'leaf' });
      b.sphere(1.6 * s, x + 1.3 * s, 3.7 * s, z + 0.6 * s, g, { seg: 8, mat: 'leaf' });
      b.sphere(1.5 * s, x - 1.1 * s, 3.9 * s, z - 0.8 * s, g, { seg: 8, mat: 'leaf' });
      if (kind === 'apple') for (let i = 0; i < 4; i++) {
        const a = rand() * PI * 2, el = rr(-0.3, 0.9);
        b.sphere(0.14 * s, x + Math.cos(a) * Math.cos(el) * 2.3 * s, 4.3 * s + Math.sin(el) * 2.2 * s, z + Math.sin(a) * Math.cos(el) * 2.3 * s, 0xd8322a, { seg: 4, shadow: false });
      }
    }
    if (collide) col.circle(x, z, 0.4 * s, { yMax: 3 * s });
  }
  function fenceLine(x0, z0, x1, z1, color = C.woodL, collide = true, h = 1.1) {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz); if (len < 0.5) return;
    const ry = Math.atan2(-dz, dx), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const n = Math.max(1, Math.round(len / 2.6));
    for (let i = 0; i <= n; i++) { const t = i / n; b.box(0.16, h + 0.1, 0.16, x0 + dx * t, 0, z0 + dz * t, color); }
    b.box(len, 0.12, 0.07, mx, h * 0.45, mz, color, { ry });
    b.box(len, 0.12, 0.07, mx, h * 0.85, mz, color, { ry });
    if (collide) col.box(mx, mz, len, 0.3, { ry, yMax: h + 0.1 });
  }
  // 矩形围栏，gaps: { n|s|e|w: [[a,b],...] }（沿边的坐标区间留空）
  function fenceRect(x0, z0, x1, z1, gaps = {}, color, collide = true) {
    const sides = { n: [x0, x1, z0, 'x'], s: [x0, x1, z1, 'x'], w: [z0, z1, x0, 'z'], e: [z0, z1, x1, 'z'] };
    for (const [k, [a, c, fixed, ax]] of Object.entries(sides)) {
      const gs = (gaps[k] || []).slice().sort((p, q) => p[0] - q[0]);
      let cur = a;
      const segs = [];
      for (const [g0, g1] of gs) { if (g0 > cur) segs.push([cur, g0]); cur = Math.max(cur, g1); }
      if (cur < c) segs.push([cur, c]);
      for (const [s0, s1] of segs) {
        if (ax === 'x') fenceLine(s0, fixed, s1, fixed, color, collide); else fenceLine(fixed, s0, fixed, s1, color, collide);
      }
    }
  }
  function hayBale(x, z, ry = 0) {
    const l = new L(x, z, ry);
    l.cyl(0.85, 0.85, 1.3, 0.65, 0.85, 0, C.hay, { rz: HALF, seg: 10 });
    l.cyl(0.6, 0.6, 1.34, 0.67, 0.85, 0, 0xcfae4c, { rz: HALF, seg: 10 });
    col.circle(x, z, 0.9, { yMax: 1.7, walkable: true });
  }
  function haystack(x, z, s = 1) {
    b.cyl(1.6 * s, 1.8 * s, 1.4 * s, x, 0, z, C.hay, { seg: 10 });
    b.cone(1.75 * s, 2.0 * s, x, 1.4 * s, z, 0xe8cc6a, { seg: 10 });
    col.circle(x, z, 1.7 * s, { yMax: 3.4 * s });
  }
  function flowerBed(x, z, rx, rz, n = 22) {
    b.cyl(1, 1, 0.18, x, 0, z, C.soil, { seg: 12, sx: rx, sz: rz });
    const cols = [0xff6f91, 0xffd23f, 0xf8f8ff, 0xb084f5, 0xff8c42, 0xff4d6d];
    for (let i = 0; i < n; i++) {
      const a = rand() * PI * 2, d = Math.sqrt(rand()) * 0.85;
      const fx = x + Math.cos(a) * d * rx, fz = z + Math.sin(a) * d * rz;
      b.box(0.05, 0.32, 0.05, fx, 0.15, fz, 0x3d8a2f, { shadow: false });
      b.box(0.3, 0.22, 0.3, fx, 0.45, fz, pick(cols), { ry: rand() * 2, shadow: false });
    }
  }
  function bench(x, z, ry) {
    const l = new L(x, z, ry);
    l.box(1.8, 0.08, 0.5, 0, 0.45, 0, C.woodL); l.box(1.8, 0.5, 0.08, 0, 0.55, -0.24, C.woodL, { rx: -0.15 });
    for (const s of [-0.75, 0.75]) l.box(0.08, 0.45, 0.45, s, 0, 0, 0x3a3a3a);
    l.solid(1.8, 0.6, 0, 0, 0.9);
  }
  function mailbox(x, z, ry, c = C.red) {
    const l = new L(x, z, ry);
    l.box(0.12, 1.0, 0.12, 0, 0, 0, C.woodD);
    l.box(0.35, 0.3, 0.55, 0, 1.0, 0, c); l.cyl(0.175, 0.175, 0.55, 0, 1.3, -0.275, c, { rx: HALF, seg: 8 });
    l.box(0.04, 0.25, 0.08, 0.2, 1.3, 0.1, 0xffd23f);
    l.circ(0.25, 0, 0, 1.4);
  }
  function crate(x, z, ry, fill = C.orange) {
    const l = new L(x, z, ry);
    l.box(0.9, 0.5, 0.6, 0, 0, 0, C.woodL);
    for (let i = 0; i < 5; i++) l.sphere(0.12, rr(-0.32, 0.32), 0.5, rr(-0.2, 0.2), fill, { seg: 5, sy: 1.6 });
  }
  function tractor(l0x, l0z, ry, color = 0xd9412b, bb = b, collide = true) {
    const l = new L(l0x, l0z, ry, bb);
    // 车头朝本地 +z
    l.box(1.4, 1.0, 3.0, 0, 0.7, 0.6, color, { mat: 'shiny' });
    l.box(1.1, 0.7, 1.6, 0, 1.7, 1.1, color, { mat: 'shiny' });
    l.box(1.5, 1.5, 1.4, 0, 1.7, -0.7, 0x333333);
    l.box(1.62, 0.12, 1.6, 0, 3.2, -0.7, color, { mat: 'shiny' });
    for (const s of [-0.7, 0.7]) l.box(0.08, 1.5, 0.08, s, 1.7, -0.05, 0x333333);
    l.box(1.3, 1.0, 0.05, 0, 2.0, -0.02, C.glass, { mat: 'glass' });
    l.cyl(0.08, 0.08, 1.3, 0.35, 2.4, 1.6, 0x333333, { seg: 6 });
    l.wheel(1.0, 0.55, -1.0, 1.0, -0.8); l.wheel(1.0, 0.55, 1.0, 1.0, -0.8);
    l.wheel(0.5, 0.35, -0.85, 0.5, 1.6); l.wheel(0.5, 0.35, 0.85, 0.5, 1.6);
    l.box(1.2, 0.3, 0.1, 0, 1.0, 2.12, 0xeeeeee, { mat: 'glow' });
    if (collide) l.solid(2.6, 4.2, 0, 0.3, 3.2);
  }
  // 小山丘：footprint 半径 F，高 H
  function hill(x, z, F, H, color = C.grassD, collide = true) {
    const Rh = F / 0.98, A = 1.25 * H;
    b.sphere(1, x, -0.25 * H, z, color, { sx: Rh, sy: A, sz: Rh, seg: 16, mat: 'leaf' });
    if (collide) col.circle(x, z, F * 0.9, { yMax: H });
    reserveC(x, z, F);
  }

  // 兔子洞屋：嵌在小山里的圆门房子。dirA 为门的朝向角（世界坐标，0 = +z）
  const doorCols = [0x3f7fbf, 0x4f9a4a, 0xd04a3a, 0xf0b93a, 0x8a5ab8, 0x2f8f8f];
  function burrow(x, z, dirA, F = 8.5, H = 4.2) {
    const Rh = F / 0.98, A = 1.25 * H, off = 0.25 * H;
    const rhoAt = (y) => Rh * Math.sqrt(Math.max(0, 1 - ((y + off) / A) ** 2));
    b.sphere(1, x, -off, z, pick([C.grassD, 0x78a84e, 0x6fa046]), { sx: Rh, sy: A, sz: Rh, seg: 12, mat: 'leaf' });
    const l = new L(x, z, dirA);
    const r1 = rhoAt(1.0), t0 = r1 - 2.6, tl = 3.4;
    l.cyl(1.05, 1.05, tl, 0, 1.0, t0, 0xd9c9a3, { rx: HALF, seg: 12 });
    l.cyl(0.85, 0.85, 0.12, 0, 1.0, t0 + tl, pick(doorCols), { rx: HALF, seg: 12 });
    l.geo(torus, 0.9, 0.9, 1.4, 0, 1.0, t0 + tl + 0.05, C.woodD);
    l.sphere(0.08, 0.45, 1.0, t0 + tl + 0.16, 0xffd23f, { seg: 6 });
    // 门上小灯
    l.box(0.22, 0.28, 0.22, 0, 2.15, t0 + tl - 0.1, C.lamp, { mat: 'glow' });
    // 圆窗
    for (const s of [-1, 1]) {
      const wl = new L(x, z, dirA + s * 0.62);
      const r2 = rhoAt(1.5);
      wl.cyl(0.55, 0.55, 1.6, 0, 1.5, r2 - 1.2, 0xd9c9a3, { rx: HALF, seg: 10 });
      wl.cyl(0.42, 0.42, 0.06, 0, 1.5, r2 + 0.42, C.glass, { rx: HALF, seg: 10, mat: 'glass' });
      wl.box(0.84, 0.06, 0.06, 0, 1.47, r2 + 0.47, C.white); wl.box(0.06, 0.84, 0.06, 0, 1.08, r2 + 0.47, C.white);
      wl.box(1.0, 0.2, 0.4, 0, 0.9, r2 + 0.5, C.woodL);
      for (let i = 0; i < 4; i++) wl.sphere(0.12, -0.35 + i * 0.23, 1.15, r2 + 0.5, pick([0xff6f91, 0xffd23f, 0xff4d6d]), { seg: 5 });
    }
    // 烟囱
    const rc = F * 0.35, yc = A * Math.sqrt(1 - (rc / Rh) ** 2) - off;
    l.cyl(0.32, 0.38, 1.6, 0.8, yc - 0.4, -rc, C.stoneD, { seg: 8 });
    // 小路 + 信箱
    l.box(1.4, 0.04, 2.6, 0, 0, t0 + tl + 1.3, C.gravel, { shadow: false });
    const [mx, mz] = l.p(1.8, t0 + tl + 1.6);
    mailbox(mx, mz, dirA, pick(doorCols));
    // 碰撞
    col.circle(x, z, F * 0.92, { yMax: H });
    l.solid(2.3, tl, 0, t0 + tl / 2, 2.2);
    reserveC(x, z, F + 1);
    const [fx, fz] = l.p(0, t0 + tl + 2.5); reserveC(fx, fz, 2.5);
    return { x: fx, z: fz };
  }

  // 作物
  function carrotPlant(x, z, s = 1) {
    b.cone(0.11 * s, 0.14 * s, x, 0.22 * s, z, C.orange, { seg: 3, rx: PI, shadow: false });
    b.cone(0.22 * s, 0.55 * s, x, 0.12 * s, z, C.carrotLeaf, { seg: 3, ry: rand() * 2, mat: 'leaf' });
  }
  function carrotField(x0, z0, x1, z1, rowGap = 2.0, plantGap = 1.25, along = 'z') {
    reserve(x0, z0, x1, z1);
    b.box(x1 - x0, 0.05, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, 0x7a5636, { shadow: false });
    if (along === 'z') {
      for (let x = x0 + rowGap / 2; x < x1; x += rowGap) {
        b.box(0.9, 0.16, z1 - z0 - 1, x, 0, (z0 + z1) / 2, C.soil, { shadow: false });
        for (let z = z0 + 1; z < z1 - 1; z += plantGap) carrotPlant(x + rr(-0.1, 0.1), z + rr(-0.15, 0.15), rr(0.85, 1.2));
      }
    } else {
      for (let z = z0 + rowGap / 2; z < z1; z += rowGap) {
        b.box(x1 - x0 - 1, 0.16, 0.9, (x0 + x1) / 2, 0, z, C.soil, { shadow: false });
        for (let x = x0 + 1; x < x1 - 1; x += plantGap) carrotPlant(x + rr(-0.15, 0.15), z + rr(-0.1, 0.1), rr(0.85, 1.2));
      }
    }
  }
  function wheatField(x0, z0, x1, z1) {
    reserve(x0, z0, x1, z1);
    b.box(x1 - x0, 0.05, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, 0x9c7a44, { shadow: false });
    for (let z = z0 + 0.8; z < z1 - 0.5; z += 1.5) {
      b.box(x1 - x0 - 1, rr(0.75, 0.95), 1.0, (x0 + x1) / 2, 0, z, pick([0xe0b84f, 0xd9ad44, 0xe8c45e]), { mat: 'leaf' });
    }
  }
  function cornField(x0, z0, x1, z1) {
    reserve(x0, z0, x1, z1);
    b.box(x1 - x0, 0.05, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, 0x7a5636, { shadow: false });
    for (let x = x0 + 1; x < x1 - 0.5; x += 2.2) {
      b.box(0.7, rr(2.1, 2.5), z1 - z0 - 2, x, 0, (z0 + z1) / 2, pick([0x5f9a3a, 0x6aa443, 0x58903a]), { mat: 'leaf' });
      b.box(0.3, 0.3, z1 - z0 - 2, x, 2.4, (z0 + z1) / 2, 0xd8c060, { mat: 'leaf' });
    }
  }
  function pumpkinPatch(x0, z0, x1, z1) {
    reserve(x0, z0, x1, z1);
    b.box(x1 - x0, 0.05, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, 0x7a5636, { shadow: false });
    for (let z = z0 + 2; z < z1 - 1; z += 3.5) {
      b.box(x1 - x0 - 2, 0.12, 1.4, (x0 + x1) / 2, 0, z, 0x4f8a35, { mat: 'leaf', shadow: false });
      for (let x = x0 + 2; x < x1 - 2; x += rr(2.2, 3.6)) {
        const r = rr(0.35, 0.65);
        b.sphere(r, x, r * 0.65, z + rr(-0.4, 0.4), pick([0xf28a1f, 0xe8761a, 0xf5a03a]), { seg: 6, sy: 0.72 });
        b.cyl(0.05, 0.06, 0.2, x, r * 1.25, z, 0x4a6b2a, { seg: 4 });
      }
    }
  }
  function cabbagePatch(x0, z0, x1, z1) {
    reserve(x0, z0, x1, z1);
    b.box(x1 - x0, 0.05, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, 0x7a5636, { shadow: false });
    for (let x = x0 + 1.5; x < x1 - 1; x += 3.0) {
      b.box(1.0, 0.14, z1 - z0 - 2, x, 0, (z0 + z1) / 2, C.soil, { shadow: false });
      for (let z = z0 + 1.5; z < z1 - 1.5; z += 2.4) b.sphere(rr(0.4, 0.55), x, 0.3, z, pick([0x9ccf5a, 0x86c04a, 0xb0d870]), { seg: 6, mat: 'leaf', sy: 0.8 });
    }
  }
  function sunflowerField(x0, z0, x1, z1) {
    reserve(x0, z0, x1, z1);
    b.box(x1 - x0, 0.05, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, 0x7a5636, { shadow: false });
    for (let x = x0 + 1.5; x < x1 - 1; x += 3.6) for (let z = z0 + 1.5; z < z1 - 1; z += 3.4) {
      const h = rr(1.9, 2.6), px = x + rr(-0.4, 0.4), pz = z + rr(-0.4, 0.4);
      b.cyl(0.05, 0.07, h, px, 0, pz, 0x4a8a2f, { seg: 4 });
      b.cyl(0.42, 0.42, 0.08, px, h, pz - 0.05, 0xffc61a, { rx: HALF + 0.3, seg: 8 });
      b.cyl(0.2, 0.2, 0.1, px, h + 0.03, pz - 0.02, 0x5a3a1a, { rx: HALF + 0.3, seg: 6 });
    }
  }
  function berryBushes(x0, z0, x1, z1) {
    reserve(x0, z0, x1, z1);
    for (let x = x0 + 2; x < x1 - 1; x += 4.2) for (let z = z0 + 2; z < z1 - 1; z += 3.8) {
      b.sphere(0.9, x, 0.7, z, 0x3f7a35, { seg: 6, mat: 'leaf', sy: 0.8 });
      for (let i = 0; i < 3; i++) b.box(0.2, 0.2, 0.2, x + rr(-0.6, 0.6), rr(0.6, 1.1), z + rr(-0.6, 0.6), 0x3f4fbf, { shadow: false });
    }
  }

  // =====================================================================
  // 3. 运河堤岸 + 码头 + 船
  // =====================================================================
  const WALL_X = 9.1, DOCK_X = -150;
  function bankWall(x0, x1, side) {
    // side = -1 北岸 (z=WATER.z0)，+1 南岸 (z=WATER.z1)
    const zEdge = side < 0 ? WATER.z0 : WATER.z1;
    const zc = zEdge + (side < 0 ? -0.8 : 0.8);
    const len = x1 - x0, mx = (x0 + x1) / 2;
    b.box(len, 3.1, 1.6, mx, -2.5, zc, C.stone, { jitter: 0.08 });
    b.box(len, 0.15, 1.9, mx, 0.6, zc, 0xd5ccbb);
    // 石块缝
    for (let x = x0 + 2; x < x1; x += 4) b.box(0.08, 2.7, 0.04, x, -2.1, zEdge + side * -0.0 - side * 0.02 * -1, C.stoneD);
    // 栏杆
    for (let x = x0 + 0.5; x < x1; x += 3) b.box(0.12, 0.85, 0.12, x, 0.75, zc, 0x3d4a3a, { mat: 'metal' });
    b.box(len, 0.1, 0.12, mx, 1.55, zc, 0x3d4a3a, { mat: 'metal' });
    b.box(len, 0.06, 0.08, mx, 1.1, zc, 0x3d4a3a, { mat: 'metal' });
    col.box(mx, zc, len, 1.6, { yMin: -3, yMax: 1.7 });
  }
  bankWall(R.x0, -WALL_X, -1); bankWall(WALL_X, R.x1, -1);
  bankWall(R.x0, DOCK_X - 2.2, 1); bankWall(DOCK_X + 2.2, -WALL_X, 1); bankWall(WALL_X, R.x1, 1);
  // 岸边步道（北岸 z 281..290，南岸 z 410..419）
  for (const [z0, z1] of [[281, 290.4], [409.6, 419]]) {
    for (const [a, c] of [[R.x0, -WALL_X], [WALL_X, R.x1]]) b.box(c - a, 0.03, z1 - z0, (a + c) / 2, 0, (z0 + z1) / 2, 0xcfc4ae, { shadow: false });
  }
  for (let x = R.x0 + 20; x < R.x1; x += 40) {
    if (Math.abs(x) < 20) continue;
    countryLamp(x, 285.5, 0, 1);
    if (Math.abs(x - DOCK_X) > 8) countryLamp(x, 414.5, 0, -1);
    if (Math.abs(x) > 30 && Math.abs(x - DOCK_X) > 10) { bench(x + 20, 287.5, PI); bench(x + 20, 412.5, 0); }
  }
  // 码头（南岸）
  {
    const z0 = WATER.z1 + 0.2, z1 = WATER.z1 - 14, zm = (z0 + z1) / 2, dl = z0 - z1;
    b.box(4.4, 0.25, dl, DOCK_X, 0.15, zm, C.woodL);
    for (let z = z1 + 0.5; z < z0; z += 3) for (const s of [-2, 2]) b.cyl(0.18, 0.18, 1.6, DOCK_X + s, -1.2, z, C.woodD, { seg: 6 });
    for (const s of [-2.1, 2.1]) {
      for (let z = z1 + 0.3; z < z0; z += 2.5) b.box(0.12, 1.0, 0.12, DOCK_X + s, 0.4, z, C.woodD);
      b.box(0.12, 0.1, dl, DOCK_X + s, 1.35, zm, C.woodD);
      col.box(DOCK_X + s, zm, 0.3, dl, { yMin: -3, yMax: 1.6 });
    }
    b.box(4.4, 0.1, 0.12, DOCK_X, 1.35, z1 + 0.1, C.woodD);
    col.box(DOCK_X, z1, 4.4, 0.3, { yMin: -3, yMax: 1.6 });
    col.box(DOCK_X, zm, 4.0, dl, { yMin: -3, yMax: 0.4, walkable: true });
    b.cyl(0.25, 0.25, 0.6, DOCK_X - 1.5, 0.4, z1 + 1, C.woodD, { seg: 8 });
  }
  // 船
  function makeBoat(type) {
    const g = new THREE.Group();
    const lb = localB(g), l = new L(0, 0, HALF, lb); // 本地 +z → 世界 +x（船头朝 +x）
    if (type === 'row') {
      l.sphere(1, 0, 0.1, 0, pick([0x3f7fbf, 0xd04a3a, 0x4f9a4a]), { sx: 0.75, sy: 0.45, sz: 1.8, seg: 10 });
      l.box(1.2, 0.08, 2.8, 0, 0.42, 0, C.woodL);
      l.box(1.2, 0.08, 0.3, 0, 0.6, 0.2, C.woodD);
      l.cyl(0.04, 0.04, 2.2, 0.6, 0.5, -0.3, C.woodD, { rz: 0.6, seg: 4 });
    } else if (type === 'ferry') {
      l.sphere(1, 0, 0.2, 0, C.white, { sx: 1.9, sy: 0.8, sz: 5.2, seg: 12 });
      l.box(3.2, 0.25, 8.6, 0, 0.75, 0, C.red);
      l.box(2.8, 1.6, 4.5, 0, 0.95, -0.5, 0xfff6e0);
      for (const s of [-1.42, 1.42]) l.box(0.05, 0.7, 3.8, s, 1.6, -0.5, C.glass, { mat: 'glass' });
      l.box(3.2, 0.15, 5.0, 0, 2.55, -0.5, 0x3f7fbf);
      l.cyl(0.35, 0.35, 1.4, 0, 2.6, 0.8, C.orange, { seg: 10 });
      l.cyl(0.37, 0.37, 0.25, 0, 3.6, 0.8, 0x222222, { seg: 10 });
      for (const s of [-1.6, 1.6]) l.cyl(0.3, 0.3, 0.12, s, 1.2, 2, 0xff5050, { rx: 0, rz: HALF, seg: 8 });
    } else if (type === 'sail') {
      l.sphere(1, 0, 0.1, 0, C.white, { sx: 0.9, sy: 0.5, sz: 2.4, seg: 10 });
      l.box(1.5, 0.08, 3.6, 0, 0.45, 0, C.woodL);
      l.cyl(0.06, 0.07, 5, 0, 0.45, 0.3, C.woodD, { seg: 6 });
      l.geo(sailTri, 1, 4.4, 2.3, 0, 0.9, 0.3, 0xfff3d6, { ry: -HALF, sx: 1 });
      l.geo(sailTri, 1, 3.2, 1.5, 0, 0.9, 0.42, 0xff8c42, { ry: HALF });
    } else if (type === 'carrot') {
      l.cone(0.95, 4.2, 0, 0.35, -2.0, C.orange, { rx: HALF, seg: 10 });
      for (let i = 0; i < 3; i++) l.cone(0.35, 1.4, (i - 1) * 0.35, 0.5, -2.0, C.carrotLeaf, { rx: -HALF + (i - 1) * 0.3, seg: 6, mat: 'leaf' });
      l.box(1.0, 0.5, 0.8, 0, 0.9, -0.6, 0xfff3d6);
      l.cyl(0.05, 0.05, 1.5, 0.3, 1.3, -0.6, C.woodD, { seg: 4 });
      l.box(1.4, 0.06, 1.4, 0.3, 2.7, -0.6, 0xff6f91);
    } else { // swan
      l.sphere(1, 0, 0.2, 0, C.white, { sx: 1.0, sy: 0.6, sz: 1.6, seg: 10 });
      l.cyl(0.18, 0.25, 1.8, 0, 0.6, 1.1, C.white, { rx: 0.3, seg: 8 });
      l.sphere(0.32, 0, 2.3, 1.75, C.white, { seg: 8 });
      l.cone(0.12, 0.4, 0, 2.25, 2.0, C.orange, { rx: HALF, seg: 6 });
      l.box(1.0, 0.5, 0.8, 0, 0.6, -0.3, 0xffd23f);
    }
    lb.flush();
    return g;
  }
  const boats = [
    { type: 'ferry', x: -300, z: 340, v: 3.2 }, { type: 'sail', x: 120, z: 360, v: -2.4 },
    { type: 'carrot', x: 260, z: 332, v: 2.0 }, { type: 'row', x: -60, z: 368, v: -1.4 },
    { type: 'swan', x: 380, z: 350, v: -1.1 }, { type: 'row', x: DOCK_X - 4.6, z: 400, v: 0 },
    { type: 'row', x: DOCK_X + 4.6, z: 398, v: 0 },
  ];
  for (const bt of boats) {
    const g = makeBoat(bt.type);
    g.position.set(bt.x, -0.5, bt.z);
    if (bt.v < 0) g.rotation.y = PI;
    if (bt.v === 0) g.rotation.y = HALF + rr(-0.1, 0.1);
    scene.add(g); animCount++;
    const ph = rand() * 10;
    ctx.animate((dt, t) => {
      if (bt.v) { g.position.x += bt.v * dt; if (g.position.x > R.x1 - 15) g.position.x = R.x0 + 15; if (g.position.x < R.x0 + 15) g.position.x = R.x1 - 15; }
      g.position.y = -0.5 + Math.sin(t * 1.3 + ph) * 0.06;
      g.rotation.x = Math.sin(t * 1.1 + ph) * 0.03;
    });
  }

  // =====================================================================
  // 4. 兔窝镇大桥
  // =====================================================================
  {
    const z0 = BRIDGE.z0, z1 = BRIDGE.z1, span = z1 - z0, BH = BRIDGE.w / 2;
    const base = (z) => 0.3 + 3.7 * Math.sin(PI * (z - z0) / span);
    const deckH = (z) => { const d = Math.min(z - z0, z1 - z); return d >= 3 ? base(z) : 0.03 + (base(z) - 0.03) * Math.max(0, d) / 3; };
    const zs = [z0];
    for (let z = z0 + 3; z < z1 - 3 + 1e-6; z += (span - 6) / 30) zs.push(z);
    zs.push(z1);
    const sloped = (w, t, x, za, zb, ha, hb, color, o = {}) => {
      const dz = zb - za, dh = hb - ha, a = Math.atan2(dh, dz), ln = Math.hypot(dz, dh) + 0.06;
      const rx = -a, zm = (za + zb) / 2, hm = (ha + hb) / 2;
      b.box(w, t, ln, x, hm - t * Math.cos(rx), zm - t * Math.sin(rx), color, { ...o, rx });
    };
    const railX = BH - 0.25;
    for (let i = 0; i < zs.length - 1; i++) {
      const za = zs[i], zb = zs[i + 1], ha = deckH(za), hb = deckH(zb), zm = (za + zb) / 2;
      col.ramp(-BH, za, BH, zb, ha, hb, 'z');
      sloped(BH * 2 + 2, 0.8, 0, za, zb, ha, hb, 0x8e8a84);                // 结构板
      sloped(ROAD_W, 0.02, 0, za, zb, ha + 0.02, hb + 0.02, 0x4a4a4e, { shadow: false }); // 沥青
      for (const s of [-1, 1]) {
        sloped(BH - hw - 0.4, 0.02, s * (hw + (BH - hw - 0.4) / 2), za, zb, ha + 0.02, hb + 0.02, 0xc9b9a0, { shadow: false }); // 人行道
        sloped(0.15, 0.02, s * (hw - 0.3), za, zb, ha + 0.035, hb + 0.035, 0xf2f2f2, { shadow: false });
        // 栏杆
        b.box(0.14, 1.15, 0.14, s * railX, Math.min(ha, hb) - 0.05, za, 0x2f4f6f, { mat: 'metal' });
        sloped(0.16, 0.12, s * railX, za, zb, ha + 1.15, hb + 1.15, 0x2f4f6f, { mat: 'metal' });
        sloped(0.06, 0.06, s * railX, za, zb, ha + 0.6, hb + 0.6, 0x2f4f6f, { mat: 'metal' });
        col.box(s * railX, zm, 0.4, zb - za + 0.05, { yMin: -2, yMax: Math.max(ha, hb) + 1.3 });
      }
      // 中线（黄色虚线）
      if (i % 2 === 0 && i > 0 && i < zs.length - 2) sloped(0.18, 0.02, 0, za, zb, ha + 0.04, hb + 0.04, 0xf2c230, { shadow: false });
      // 岸上桥台（填实）
      if (zb <= WATER.z0 + 0.5 || za >= WATER.z1 - 0.5) b.box(BH * 2 + 2, Math.max(0.05, Math.min(ha, hb) - 0.4 + 2.5), zb - za + 0.05, 0, -2.5, zm, C.stone);
    }
    // 桥墩 + 塔
    const towers = [315, 385];
    const towerTop = (z) => deckH(z) + 13;
    for (const tz of towers) {
      const dh = deckH(tz);
      b.box(BH * 2 + 6, dh - 0.8 + 3.5, 5, 0, -3.5, tz, C.stone, { jitter: 0.06 });
      for (const s of [-1, 1]) b.cyl(2.5, 2.5, dh - 0.8 + 3.5, s * (BH + 3), -3.5, tz, C.stone, { seg: 10 });
      for (const s of [-1, 1]) {
        const tx = s * (BH + 1.8);
        b.box(1.3, towerTop(tz) - dh + 1, 1.7, tx, dh - 0.8, tz, 0xe6e0d4);
        b.box(1.6, 0.4, 2.0, tx, towerTop(tz), tz, 0xc9c0b0);
        b.sphere(0.3, tx, towerTop(tz) + 0.65, tz, 0xff4040, { mat: 'glow', seg: 8 });
      }
      for (const yo of [-1.2, -5]) b.box(BH * 2 + 4.9, 0.9, 1.2, 0, towerTop(tz) + yo, tz, 0xe6e0d4);
      b.box(6, 0.12, 1.25, 0, towerTop(tz) - 3.2, tz + 0.01, 0xf07a1e); // 装饰条
    }
    // 主缆 + 吊杆
    const cableX = BH + 0.8;
    const cableY = (z) => {
      const [a, c] = towers;
      if (z <= a) { const t = (z - z0) / (a - z0); return 1.6 + (towerTop(a) - 1.6) * t * t * 0.4 + (towerTop(a) - 1.6) * 0.6 * t; }
      if (z >= c) { const t = (z1 - z) / (z1 - c); return 1.6 + (towerTop(c) - 1.6) * t * t * 0.4 + (towerTop(c) - 1.6) * 0.6 * t; }
      const m = (a + c) / 2, u = (z - m) / ((c - a) / 2), low = deckH(m) + 1.8;
      return low + (towerTop(a) - low) * u * u;
    };
    for (const s of [-1, 1]) {
      const x = s * cableX;
      for (let z = z0 + 1; z < z1 - 1; z += 2.5) {
        const za = z, zb = Math.min(z + 2.5, z1 - 1);
        sloped(0.22, 0.22, x, za, zb, cableY(za), cableY(zb), 0xf07a1e, { mat: 'shiny' });
      }
      for (let z = z0 + 4; z < z1 - 3; z += 3.5) {
        if (towers.some(tz => Math.abs(z - tz) < 1.5)) continue;
        const y0 = deckH(z) - 0.2, y1 = cableY(z);
        if (y1 - y0 > 0.4) b.box(0.07, y1 - y0, 0.07, x, y0, z, 0xdddddd, { mat: 'metal' });
      }
      // 锚墩
      for (const az of [z0 + 0.5, z1 - 0.5]) b.box(1.8, 2.2, 1.8, x + s * 0.3, 0, az, 0xd5ccbb);
    }
    // 钢拱（桥面下）
    const spans = [[WATER.z0, towers[0]], [towers[0], towers[1]], [towers[1], WATER.z1]];
    for (const [sa, sb] of spans) {
      const m = (sa + sb) / 2, half = (sb - sa) / 2;
      const crown = deckH(m) - 1.0, ye = -0.6;
      const ay = (z) => ye + (crown - ye) * (1 - ((z - m) / half) ** 2);
      const n = Math.max(6, Math.round((sb - sa) / 3));
      for (const s of [-1, 1]) {
        for (let i = 0; i < n; i++) {
          const za = sa + (sb - sa) * i / n, zb = sa + (sb - sa) * (i + 1) / n;
          sloped(0.6, 0.7, s * (BH - 1.5), za, zb, ay(za) + 0.7, ay(zb) + 0.7, 0x2f4f6f, { mat: 'metal' });
          const zc = (za + zb) / 2, top = deckH(zc) - 0.8, bot = ay(zc) + 0.5;
          if (i > 0 && top - bot > 0.3) b.box(0.25, top - bot, 0.25, s * (BH - 1.5), bot, zc, 0x2f4f6f, { mat: 'metal' });
        }
      }
    }
    // 桥灯
    for (let z = z0 + 10; z < z1 - 5; z += 20) for (const s of [-1, 1]) {
      const h = deckH(z);
      b.cyl(0.08, 0.1, 4, s * (railX + 0.05), h, z, 0x2f4f6f, { seg: 6, mat: 'metal' });
      b.sphere(0.32, s * (railX + 0.05), h + 4.2, z, C.lamp, { mat: 'glow', seg: 8 });
    }
    // 桥头石柱 + 铭牌
    for (const [pz, txt, ry] of [[z0 - 1.5, '兔窝镇大桥\nBUNNYBURROW BRIDGE', PI], [z1 + 1.5, '动物城 ZOOTOPIA\n← 前方大桥', 0]]) {
      for (const s of [-1, 1]) {
        b.box(1.6, 3.2, 1.6, s * (BH + 1.6), 0, pz, 0xd5ccbb);
        b.cone(1.1, 0.8, s * (BH + 1.6), 3.2, pz, 0xc06030, { seg: 4, ry: PI / 4 });
        col.box(s * (BH + 1.6), pz, 1.6, 1.6, { yMax: 4 });
      }
      const dz = ry === PI ? -0.82 : 0.82;
      signAt(txt, 1.5, BH + 1.6, 2.0, pz + dz, ry, { bg: '#2f4f6f', fg: '#f6efe0', w: 384, h: 256, font: 'bold 44px "PingFang SC","Microsoft YaHei",sans-serif' });
      signAt(txt, 1.5, -(BH + 1.6), 2.0, pz + dz, ry, { bg: '#2f4f6f', fg: '#f6efe0', w: 384, h: 256, font: 'bold 44px "PingFang SC","Microsoft YaHei",sans-serif' });
    }
    ctx.addLabel(0, 8, 350, '兔窝镇大桥', D.color);
  }

  // =====================================================================
  // 5. 欢迎牌（面朝北，人口计数器跳动）
  // =====================================================================
  {
    const x = -22, z = 437, Wd = 13, Hd = Wd * 400 / 1024;
    for (const s of [-1, 1]) { b.box(0.45, 2.4 + Hd, 0.45, x + s * (Wd / 2 - 1), 0, z, C.woodD); col.box(x + s * (Wd / 2 - 1), z, 0.6, 0.6, { yMax: 3 + Hd }); }
    b.box(Wd + 0.6, Hd + 0.6, 0.3, x, 2.1, z, C.woodL);
    b.box(Wd + 1.2, 0.3, 0.6, x, 2.4 + Hd + 0.3, z, C.roofBrown);
    // 牌顶胡萝卜装饰
    b.cone(0.5, 2.4, x + Wd / 2 + 0.2, 2.4 + Hd + 0.6, z, C.orange, { rz: -0.5, seg: 8 });
    b.cone(0.5, 2.4, x - Wd / 2 - 0.2, 2.4 + Hd + 0.6, z, C.orange, { rz: 0.5, seg: 8 });
    flowerBed(x, z - 2.5, 7, 1.3, 30);
    let mesh;
    if (typeof document !== 'undefined' && document.createElement) {
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 400;
      const g = cv.getContext('2d');
      let pop = 81592807;
      const draw = () => {
        if (!g || !g.fillRect) return;
        g.fillStyle = '#3f7d3a'; g.fillRect(0, 0, 1024, 400);
        g.strokeStyle = '#f6e7c1'; g.lineWidth = 14; g.strokeRect(14, 14, 996, 372);
        g.fillStyle = '#fff6dd'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = 'bold 118px "PingFang SC","Microsoft YaHei",sans-serif'; g.fillText('欢迎来到兔窝镇', 512, 112);
        g.font = 'bold 40px sans-serif'; g.fillStyle = '#d8efb0'; g.fillText('WELCOME TO BUNNYBURROW', 512, 196);
        g.fillStyle = '#2a4a26'; g.fillRect(150, 238, 724, 120);
        g.fillStyle = '#ffb347'; g.font = 'bold 76px "PingFang SC","Microsoft YaHei",monospace';
        g.fillText('人口 ' + String(pop).replace(/\B(?=(\d{3})+(?!\d))/g, ','), 512, 300);
      };
      draw();
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(Wd, Hd), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false }));
      let acc = 0;
      ctx.animate((dt) => { acc += dt; if (acc > 1.4) { acc = 0; pop += 1 + ((rand() * 4) | 0); draw(); tx.needsUpdate = true; } });
      signCount++;
      mesh.position.set(x, 2.4 + Hd / 2, z - 0.17); mesh.rotation.y = PI; scene.add(mesh);
    } else {
      signAt('欢迎来到兔窝镇\n人口 81,592,807', Wd, x, 2.4 + Hd / 2, z - 0.17, PI, { bg: '#3f7d3a', fg: '#fff6dd', w: 1024, h: 400, font: 'bold 110px sans-serif' });
    }
    // 背面（朝南）
    signAt('欢迎再来！\n动物城 ↑ 过桥', Wd * 0.7, x, 2.4 + Hd / 2, z + 0.17, 0, { bg: '#8a5a33', fg: '#fff6dd', w: 1024, h: 400, font: 'bold 120px "PingFang SC","Microsoft YaHei",sans-serif' });
    reserve(x - Wd / 2 - 2, z - 5, x + Wd / 2 + 2, z + 2);
    ctx.addLabel(x, 9, z, '兔窝镇欢迎牌', D.color);
  }
  // 路口指路牌
  {
    const x = -10.5, z = 590;
    b.cyl(0.12, 0.14, 3.6, x, 0, z, C.woodD, { seg: 6 }); col.circle(x, z, 0.3, { yMax: 3.6 });
    const s1 = signAt('← 霍普斯农场', 2.4, x - 1.2, 3.0, z, PI, { bg: '#f6e7c1', fg: '#5e3d22', w: 512, h: 128, font: 'bold 60px "PingFang SC","Microsoft YaHei",sans-serif' });
    const s2 = signAt('吉迪恩派店 →', 2.4, x + 1.2, 2.4, z, PI, { bg: '#f6e7c1', fg: '#5e3d22', w: 512, h: 128, font: 'bold 60px "PingFang SC","Microsoft YaHei",sans-serif' });
    s1.rotation.y = PI; s2.rotation.y = PI;
  }

  // =====================================================================
  // 6. 霍普斯家族农场
  // =====================================================================
  {
    const F = LANDMARKS.hoppsFarm, fx0 = F.x - F.w / 2, fx1 = F.x + F.w / 2, fz0 = F.z - F.d / 2, fz1 = F.z + F.d / 2;
    reserve(fx0 - 1, fz0 - 1, fx1 + 1, fz1 + 1);
    // 围栏（东侧留门 z 694..706，北侧留小门）
    fenceRect(fx0, fz0, fx1, fz1, { e: [[693, 707]], n: [[-232, -224]], w: [[650, 656]] }, C.woodL);
    // 大门拱
    const gx = fx1;
    for (const s of [-1, 1]) { b.box(0.6, 5.4, 0.6, gx, 0, F.z + s * 6.6, C.woodD); col.box(gx, F.z + s * 6.6, 0.8, 0.8, { yMax: 5.6 }); }
    b.box(0.5, 0.5, 14.2, gx, 5.4, F.z, C.woodD);
    const gl = new L(gx + 0.3, F.z, HALF);
    signL(gl, '霍普斯家族农场', 9, 0, 5.2, 0, { bg: '#f6e7c1', fg: '#7b4a2c', w: 768, h: 128, font: 'bold 84px "PingFang SC","Microsoft YaHei",sans-serif', border: '#7b4a2c' });
    b.cone(0.4, 1.8, gx, 5.9, F.z - 5.5, C.orange, { rz: 2.5, seg: 8 });
    // 农场小路
    b.box(-7 - (gx - 60), 0.035, 7, (gx - 60 - 7) / 2, 0, F.z, C.dirt, { shadow: false });
    b.box(7, 0.035, 26, -140, 0, 688, C.dirt, { shadow: false });
    b.box(30, 0.035, 7, -175, 0, 712, C.dirt, { shadow: false });
    b.box(7, 0.035, 22, -187, 0, 723, C.dirt, { shadow: false });

    // —— 农舍（朝南） ——
    const hx = -140, hz = 668;
    const h = new L(hx, hz, 0);
    const hw2 = 16, hd2 = 11, wallH = 6.4;
    h.box(hw2 + 0.4, 0.5, hd2 + 0.4, 0, 0, 0, C.stoneD);
    h.box(hw2, wallH, hd2, 0, 0.5, 0, C.cream);
    h.box(hw2 + 0.1, 0.18, hd2 + 0.1, 0, 3.6, 0, C.white);
    gableRoof(h, hw2, hd2, 0, 0, 0.5 + wallH, 3.8, C.cream, C.roofBlue, 0.6);
    // 侧翼
    h.box(7, 4, 7, -10.5, 0, 1.5, 0xead6a0); gableRoof(h, 7, 7, -10.5, 1.5, 4, 2.4, 0xead6a0, C.roofBlue, 0.4);
    // 门廊
    h.box(hw2 - 2, 0.5, 4, 0, 0, hd2 / 2 + 2, C.woodL);
    for (const px of [-6.5, -2.2, 2.2, 6.5]) h.cyl(0.14, 0.14, 2.9, px, 0.5, hd2 / 2 + 3.7, C.white, { seg: 6 });
    h.box(hw2 - 1.4, 0.2, 4.4, 0, 3.4, hd2 / 2 + 2.1, C.roofBlue, { rx: -0.12 });
    for (const px of [-5, 5]) h.box(4.2, 0.7, 0.1, px, 0.5, hd2 / 2 + 3.9, C.white);
    h.box(1.6, 2.4, 0.15, 0, 0.5, hd2 / 2 + 0.02, 0x6a3a22);
    for (const px of [-5, -2.6, 2.6, 5]) windowAt(h, px, 1.6, hd2 / 2 + 0.02);
    for (const px of [-5, -1.6, 1.6, 5]) windowAt(h, px, 4.4, hd2 / 2 + 0.02, 1.1, 1.3);
    h.box(1.1, 2.6, 1.1, 5, 0.5 + wallH + 1, -1.5, 0x9a4a3a);
    // 门廊秋千 + 摇椅
    h.box(1.8, 0.1, 0.6, -4.5, 0.95, hd2 / 2 + 2.5, C.woodL);
    for (const px of [-5.3, -3.7]) h.box(0.04, 2.0, 0.04, px, 1.05, hd2 / 2 + 2.5, 0x555555);
    h.solid(hw2 + 0.4, hd2 + 0.4, 0, 0, 10.7);
    h.solid(7.2, 7.2, -10.5, 1.5, 6.4);
    h.solid(hw2 - 2, 4, 0, hd2 / 2 + 2, 0.5, { walkable: true });
    flowerBed(hx - 6, hz + 12.5, 2.5, 0.8); flowerBed(hx + 6, hz + 12.5, 2.5, 0.8);
    // 白色栅栏小院
    fenceLine(hx - 12, hz + 14.5, hx - 4, hz + 14.5, C.white, true, 0.9);
    fenceLine(hx + 4, hz + 14.5, hx + 12, hz + 14.5, C.white, true, 0.9);
    // 轮胎秋千树
    tree(-115, 655, 1.4);
    b.cyl(0.03, 0.03, 3.2, -113.2, 1.3, 655, 0x555555, { seg: 4 });
    b.add(torus, mat(-113.2, 1.1, 655, 0.6, 0.6, 1.6, HALF, 0, 0), 0x222222);
    // 晾衣绳（动画）
    {
      const lx0 = -160, lz = 650;
      for (const s of [0, 12]) { b.box(0.14, 2.3, 0.14, lx0 + s, 0, lz, C.woodD); col.circle(lx0 + s, lz, 0.25, { yMax: 2.3 }); }
      b.box(12, 0.03, 0.03, lx0 + 6, 2.2, lz, 0xdddddd);
      const g = animGroup(lx0 + 6, 2.2, lz);
      const lb = localB(g);
      const cl = [0xff8fa3, 0x8fc4ff, 0xfff28f, 0xffffff, 0xa3e4a0, 0xffb347];
      for (let i = 0; i < 7; i++) lb.box(rr(0.6, 1.1), rr(0.7, 1.1), 0.04, -5 + i * 1.6, -1.1, 0, cl[i % cl.length]);
      lb.flush();
      g.children.forEach(m => { m.geometry.translate(0, 0, 0); });
      ctx.animate((dt, t) => { g.rotation.x = Math.sin(t * 1.7) * 0.18 + 0.1; });
    }
    // 水井
    {
      const wx = -122, wz = 688;
      b.cyl(1.1, 1.2, 0.9, wx, 0, wz, C.stone, { seg: 10 }); b.cyl(0.85, 0.85, 0.05, wx, 0.85, wz, 0x2a4a6a, { seg: 10 });
      for (const s of [-1, 1]) b.box(0.15, 2.4, 0.15, wx + s * 1.0, 0.9, wz, C.woodD);
      const wl = new L(wx, wz, HALF); gableRoof(wl, 1.2, 2.8, 0, 0, 3.0, 0.9, C.woodD, C.red, 0.15);
      col.circle(wx, wz, 1.25, { yMax: 3 });
    }
    // 菜园
    for (let i = 0; i < 4; i++) {
      const vx = -100, vz = 640 + i * 5;
      b.box(10, 0.35, 2.4, vx, 0, vz, C.woodD); b.box(9.6, 0.38, 2.0, vx, 0, vz, C.soil);
      for (let j = 0; j < 8; j++) b.sphere(0.3, vx - 4.2 + j * 1.2, 0.5, vz, pick([0x86c04a, 0xd8322a, 0x6aab44]), { seg: 5, mat: 'leaf' });
      col.box(vx, vz, 10, 2.4, { yMax: 0.4, walkable: true });
    }
    // 鸡舍
    {
      const c = new L(-96, 772, PI);
      c.box(4, 2, 3, 0, 0.6, 0, 0xd9a05a); gableRoof(c, 4, 3, 0, 0, 2.6, 1.2, 0xd9a05a, C.red, 0.3);
      for (const s of [-1.8, 1.8]) for (const t of [-1.3, 1.3]) c.box(0.15, 0.6, 0.15, s, 0, t, C.woodD);
      c.box(0.8, 0.12, 2.2, 0, 0, 2.4, C.woodL, { rx: 0.25 });
      c.solid(4.2, 3.4, 0, 0, 3.8);
    }
    // —— 红色谷仓（门朝东） ——
    const bx = -200, bz = 735;
    {
      const g = new L(bx, bz, HALF);
      const bw = 16, bd = 22, bh = 6.5, rh = 7;
      g.box(bw, bh, bd, 0, 0, 0, C.red);
      g.geo(gambrelZ, bw + 0.7, rh + 0.3, bd + 0.8, 0, bh - 0.1, 0, 0x5a5550);
      for (const s of [-1, 1]) g.geo(gambrelZ, bw - 0.2, rh - 0.3, 0.12, 0, bh, s * (bd / 2 + 0.42), C.red);
      for (const s of [-1, 1]) g.box(bw + 0.1, 0.25, 0.2, 0, bh - 0.15, s * (bd / 2 + 0.05), C.white);
      // 大门 + 白色 X
      const fz = bd / 2 + 0.06;
      for (const s of [-1, 1]) {
        g.box(3.2, 4.8, 0.15, s * 1.65, 0, fz, 0x9a2a22);
        g.box(3.2, 0.25, 0.1, s * 1.65, 4.6, fz + 0.1, C.white); g.box(3.2, 0.25, 0.1, s * 1.65, 0, fz + 0.1, C.white);
        g.box(0.25, 4.8, 0.1, s * 3.15, 0, fz + 0.1, C.white);
        g.box(0.22, 5.5, 0.08, s * 1.65, -0.1, fz + 0.12, C.white, { rz: 0.58 });
        g.box(0.22, 5.5, 0.08, s * 1.65, -0.1, fz + 0.12, C.white, { rz: -0.58 });
      }
      g.box(2.4, 2.2, 0.15, 0, 7.6, fz + 0.4, 0x9a2a22); g.box(2.7, 0.2, 0.1, 0, 9.8, fz + 0.45, C.white);
      g.box(0.15, 0.15, 3, 0, 10.6, fz - 0.5, C.woodD);
      g.circ(0, 0, 0, 0);
      g.solid(bw + 0.6, bd + 0.6, 0, 0, bh + rh);
      for (const s of [-1, 1]) for (const zz of [-6, 0, 6]) windowAt(g, s * (bw / 2 + 0.02), 2.6, zz, 1.2, 1.2, C.white, s * HALF);
      // 风向标（动画）
      const vane = animGroup(...(() => { const [x, z] = g.p(0, 0); return [x, bh + rh + 0.15, z]; })());
      const vl = localB(vane);
      vl.cyl(0.05, 0.05, 1.6, 0, 0, 0, 0x333333, { seg: 4 });
      vl.box(1.6, 0.06, 0.06, 0, 1.0, 0, 0x333333); vl.box(0.06, 0.06, 1.6, 0, 1.0, 0, 0x333333);
      vl.box(1.4, 0.5, 0.05, 0.2, 1.5, 0, 0x333333, { mat: 'metal' });
      vl.cone(0.15, 0.4, -0.7, 1.75, 0, 0x333333, { rz: HALF, seg: 4 });
      vl.flush();
      ctx.animate((dt, t) => { vane.rotation.y = Math.sin(t * 0.21) * 1.2 + Math.sin(t * 0.73) * 0.3; });
    }
    // 筒仓
    for (const [sx, sz, sr, sh] of [[-215, 754, 4, 17], [-206, 757, 3, 13]]) {
      b.cyl(sr, sr, sh, sx, 0, sz, 0xb8bcc0, { seg: 12, mat: 'metal' });
      for (let y = 2; y < sh; y += 3) b.cyl(sr + 0.05, sr + 0.05, 0.2, sx, y, sz, 0x8a9096, { seg: 12, mat: 'metal' });
      b.sphere(sr, sx, sh, sz, 0x9aa3a8, { seg: 12, sy: 0.6, mat: 'metal' });
      col.circle(sx, sz, sr + 0.1, { yMax: sh + sr * 0.6 });
    }
    // 干草
    for (const [x, z] of [[-182, 752], [-178, 756], [-185, 758], [-176, 762]]) hayBale(x, z, rr(0, PI));
    haystack(-172, 768, 1.2); haystack(-235, 770, 1.0);
    b.box(3, 0.1, 2, -181, 1.7, 755, C.hay);
    // 拖拉机（静）
    tractor(-176, 724, -0.6, 0xd9412b);
    // 风车（朝南），动画风叶
    {
      const wx = -110, wz = 755;
      b.cyl(2.4, 3.8, 12, wx, 0, wz, 0xf1e6cf, { seg: 8 });
      b.cyl(3.9, 3.9, 0.5, wx, 4, wz, C.woodD, { seg: 8 });
      b.cone(2.9, 3.4, wx, 12, wz, C.red, { seg: 8 });
      b.box(1.4, 2.2, 0.2, wx, 0, wz + 3.7, 0x6a3a22, { rx: -0.13 });
      for (const y of [6, 9]) b.box(0.9, 1.1, 0.2, wx, y, wz + 3.2 - (y - 6) * 0.13, C.glass, { mat: 'glass', rx: -0.13 });
      b.cyl(0.5, 0.5, 2.2, wx, 12.6, wz + 1.5, C.woodD, { rx: HALF, seg: 8 });
      col.circle(wx, wz, 3.9, { yMax: 15 });
      const g = animGroup(wx, 12.6, wz + 3.8);
      const hub = new THREE.Group(); g.add(hub);
      const lb = localB(hub);
      lb.sphere(0.6, 0, 0, 0, C.woodD, { seg: 8 });
      for (let i = 0; i < 4; i++) {
        const a = i * HALF;
        const ca = Math.cos(a), sa = Math.sin(a);
        lb.box(0.3, 9, 0.2, 0, 0, 0.1, C.woodD, { rz: a });
        // 帆面
        lb.box(1.8, 3.6, 0.08, -sa * 2.7 + ca * 0.95, ca * 2.7 + sa * 0.95, 0.25, 0xfff3d6, { rz: a });
        void ca; void sa;
      }
      lb.flush();
      // 把帆面整体从中心偏移：用几何平移使其位于叶片一侧
      hub.children.forEach(m => m.geometry.computeBoundingSphere());
      ctx.animate((dt) => { hub.rotation.z -= dt * 0.7; });
    }
    // 胡萝卜地（农场内） + 移动拖拉机通道 x=-228
    carrotField(-272, 626, -231, 688, 2.0, 1.3, 'z');
    carrotField(-225, 626, -185, 688, 2.0, 1.3, 'z');
    reserve(-232, 620, -224, 692);
    {
      const g = animGroup(-228, 0, 640);
      const lb = localB(g);
      tractor(0, 0, 0, 0x3f8a3f, lb, false);
      lb.flush();
      let dir = 1;
      ctx.animate((dt) => {
        g.position.z += dir * dt * 2.2;
        if (g.position.z > 684) { dir = -1; g.rotation.y = PI; }
        if (g.position.z < 632) { dir = 1; g.rotation.y = 0; }
      });
    }
    // 南部牧场：泥坑 + 小猪圈围栏
    b.cyl(1, 1, 0.03, -255, 0, 760, 0x6b4a2e, { seg: 12, sx: 6, sz: 4, shadow: false });
    fenceRect(-266, 752, -244, 770, { n: [[-258, -253]] }, C.woodD);
    // 农场树
    for (const [x, z] of [[-268, 710], [-262, 730], [-250, 700], [-95, 700 + 16], [-95, 684], [-160, 640], [-125, 735]]) tree(x, z, rr(1, 1.3));
    for (const [x, z] of [[-150, 772], [-140, 775], [-130, 772]]) tree(x, z, 1.1, 'apple');

    // 路边农产品摊「霍普斯农产品」（front 附近，朝东）
    {
      const s = new L(-40, 712, HALF);
      s.box(7, 1.0, 1.4, 0, 0, 0, C.woodL);
      s.box(7.2, 0.12, 1.6, 0, 1.0, 0, C.woodD);
      for (const px of [-3.4, 3.4]) for (const pz of [-1.4, 0.6]) s.box(0.16, 2.9, 0.16, px, 0, pz, C.woodD);
      s.box(7.8, 0.15, 3.0, 0, 3.0, -0.4, C.red, { rx: 0.18 });
      for (let i = 0; i < 6; i++) s.box(1.3, 0.04, 3.02, -3.25 + i * 1.3, 3.08, -0.4, i % 2 ? C.white : C.red, { rx: 0.18 });
      for (let i = 0; i < 4; i++) {
        const px = -2.6 + i * 1.75;
        s.box(1.3, 0.35, 0.9, px, 1.12, 0.1, C.woodL);
        const fill = [C.orange, 0x3f4fbf, 0xd8322a, C.orange][i];
        for (let k = 0; k < 6; k++) s.sphere(0.13, px + rr(-0.45, 0.45), 1.5, 0.1 + rr(-0.3, 0.3), fill, { seg: 5, sy: i % 3 === 0 ? 1.8 : 1 });
      }
      signL(s, '霍普斯农产品', 5, 0, 2.75, 0.85, { bg: '#fff6dd', fg: '#c0392b', w: 640, h: 128, font: 'bold 84px "PingFang SC","Microsoft YaHei",sans-serif', border: '#3f9a2f' });
      s.solid(7.4, 1.8, 0, -0.1, 3.2);
      // 价目板
      const [px, pz] = s.p(4.6, 1.2);
      b.box(0.1, 1.0, 0.1, px, 0, pz, C.woodD);
      const pb = signAt('胡萝卜 3根 ¥1\n新鲜蓝莓 ¥5\n自摘自付', 1.1, px, 1.6, pz + 0.06, HALF, { bg: '#2b2b2b', fg: '#ffffff', w: 256, h: 256, font: 'bold 34px "PingFang SC","Microsoft YaHei",sans-serif' });
      pb.position.x += 0.06;
      col.circle(px, pz, 0.3, { yMax: 2.2 });
      crate(-36.5, 716.5, 0.2); crate(-36.5, 707.5, -0.2, 0xd8322a);
      // 南瓜堆
      for (let i = 0; i < 5; i++) b.sphere(rr(0.35, 0.5), -44 + rr(-1, 1), 0.3, 718 + rr(-0.8, 0.8), 0xf28a1f, { seg: 8, sy: 0.72 });
      col.circle(-44, 718, 1.4, { yMax: 0.8 });
    }
    ctx.addLabel(F.x, 18, F.z, F.name, D.color);
  }

  // 农场西侧田地
  wheatField(-470, 615, -392, 805);
  pumpkinPatch(-382, 615, -298, 704);
  cabbagePatch(-382, 714, -298, 805);
  fenceRect(-474, 611, -294, 809, { e: [[700, 718]], n: [[-400, -385]], s: [[-400, -385]] }, C.woodD);
  {
    // 金属风泵（动画）
    const wx = -388, wz = 709;
    const legs = 1.6, H = 11;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const lx = wx + sx * legs, lz = wz + sz * legs;
      b.box(0.12, H + 0.6, 0.12, lx, 0, lz, 0x8a9096, { mat: 'metal', rx: sz * 0.12, rz: -sx * 0.12 });
    }
    for (let y = 2; y < H; y += 2.5) {
      const r = legs * (1 - y / (H + 2));
      b.box(r * 2, 0.06, 0.06, wx, y, wz - r, 0x8a9096, { mat: 'metal' }); b.box(r * 2, 0.06, 0.06, wx, y, wz + r, 0x8a9096, { mat: 'metal' });
      b.box(0.06, 0.06, r * 2, wx - r, y, wz, 0x8a9096, { mat: 'metal' }); b.box(0.06, 0.06, r * 2, wx + r, y, wz, 0x8a9096, { mat: 'metal' });
    }
    b.box(1.4, 0.6, 1.4, wx, H, wz, 0x8a9096, { mat: 'metal' });
    b.box(0.08, 0.6, 3.2, wx, H + 0.5, wz - 2.0, 0x8a9096, { mat: 'metal' });
    b.box(0.06, 1.6, 1.6, wx, H + 0.1, wz - 3.6, 0xd04a3a);
    b.cyl(1.4, 1.6, 1.2, wx + 3, 0, wz, 0x8a9096, { seg: 12, mat: 'metal' }); b.cyl(1.35, 1.35, 0.02, wx + 3, 1.15, wz, 0x2a5a7a, { seg: 12, mat: 'water' });
    col.circle(wx, wz, 2.0, { yMax: H }); col.circle(wx + 3, wz, 1.6, { yMax: 1.2 });
    const g = animGroup(wx, H + 0.8, wz + 0.9);
    const rotor = new THREE.Group(); g.add(rotor);
    const lb = localB(rotor);
    lb.cyl(0.25, 0.25, 0.3, 0, 0, 0, 0x555555, { rx: HALF, seg: 8 });
    for (let i = 0; i < 12; i++) lb.box(0.38, 1.5, 0.04, 0, 0.3, 0.1, 0xd9d9d9, { rz: i * PI / 6, ry: 0.4, mat: 'metal' });
    lb.flush();
    ctx.animate((dt) => { rotor.rotation.z += dt * 2.6; });
  }

  // =====================================================================
  // 7. 吉迪恩的派店
  // =====================================================================
  {
    const B = LANDMARKS.gideonBakery;
    reserve(B.x - B.w / 2, B.z - B.d / 2, B.x + B.w / 2, B.z + B.d / 2);
    reserve(7, 694, 60, 706);
    // 石板小路 + 露台
    b.box(96, 0.035, 6, 7 + 48, 0, 700, 0xcdbfa6, { shadow: false });
    b.box(46, 0.03, 40, 77, 0, 700, 0xd9ccb2, { shadow: false });
    const k = new L(110, 700, -HALF); // 正面朝 -x
    const bw = 22, bd = 14, wh = 5.2;
    k.box(bw, wh, bd, 0, 0, 0, 0xf6e6c8);
    k.box(bw + 0.2, 0.6, bd + 0.2, 0, 0, 0, 0x9a6a46);
    gableRoof(k, bw, bd, 0, 0, wh, 4.2, 0xf6e6c8, 0x8a4a2a, 0.7);
    // 木梁装饰
    for (const lx of [-10.5, -5, 5, 10.5]) k.box(0.3, wh, 0.12, lx, 0, bd / 2 + 0.02, 0x7a4a2a);
    k.box(bw, 0.3, 0.12, 0, wh - 0.3, bd / 2 + 0.02, 0x7a4a2a);
    // 橱窗 + 门
    for (const lx of [-7.5, 7.5]) {
      k.box(4.6, 2.6, 0.15, lx, 0.8, bd / 2 + 0.03, C.glass, { mat: 'glass' });
      k.box(5.0, 0.2, 0.5, lx, 0.65, bd / 2 + 0.2, 0x7a4a2a);
      for (let i = 0; i < 4; i++) { // 橱窗里的派
        k.cyl(0.4, 0.35, 0.15, lx - 1.6 + i * 1.07, 0.86, bd / 2 + 0.25, 0xd9a05a, { seg: 10 });
        k.cyl(0.3, 0.3, 0.02, lx - 1.6 + i * 1.07, 1.0, bd / 2 + 0.25, pick([0x7a2a5a, 0xf07a1e, 0xd8322a]), { seg: 10 });
      }
    }
    k.box(2.2, 3.0, 0.15, 0, 0, bd / 2 + 0.04, 0x6a3a22);
    k.box(0.8, 1.0, 0.05, 0, 1.6, bd / 2 + 0.13, C.glass, { mat: 'glass' });
    // 条纹雨棚
    for (let i = 0; i < 11; i++) k.box(2.0, 0.08, 2.2, -10 + i * 2, 3.45, bd / 2 + 1.0, i % 2 ? C.white : 0xd8505a, { rx: 0.35 });
    signL(k, '吉迪恩派店', 8, 0, 6.6, bd / 2 + 0.5, { bg: '#7a3a1a', fg: '#ffe3a8', w: 640, h: 160, font: 'bold 104px "PingFang SC","Microsoft YaHei",sans-serif', border: '#ffe3a8' });
    // 屋顶巨型派
    k.cyl(2.6, 2.3, 0.7, 0, 8.4, 0.5, 0xd9a05a, { rx: -0.9, seg: 12 });
    k.cyl(2.1, 2.1, 0.12, 0, 8.4 + 0.62 * Math.cos(0.9), 0.5 + 0.62 * Math.sin(0.9), 0x8a2a4a, { rx: -0.9, seg: 12 });
    for (let i = 0; i < 6; i++) { const a = i * PI / 3; k.box(0.25, 0.1, 3.8, Math.cos(a) * 0.1, 8.95, 0.9, 0xe8b870, { rx: -0.9, ry: a }); }
    // 烟囱 + 烟（动画）
    k.box(1.2, 4.0, 1.2, 6.5, wh + 1.5, -2.5, 0x9a4a3a);
    const [chx, chz] = k.p(6.5, -2.5);
    {
      const g = animGroup(chx, wh + 5.6, chz);
      const puffs = [];
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.6, depthWrite: false }));
        g.add(m); puffs.push({ m, o: i / 5 });
      }
      ctx.animate((dt, t) => {
        for (const p of puffs) {
          const u = (t * 0.18 + p.o) % 1;
          p.m.position.set(Math.sin(u * 5 + p.o * 9) * 0.5 + u * 1.5, u * 6, 0);
          p.m.scale.setScalar(0.6 + u * 1.8);
          p.m.material.opacity = 0.55 * (1 - u);
        }
      });
    }
    k.solid(bw + 0.6, bd + 0.6, 0, 0, wh + 4.2);
    // 侧窗
    for (const lz of [-3, 3]) for (const s of [-1, 1]) windowAt(k, s * (bw / 2 + 0.02), 1.6, lz, 1.2, 1.4, C.white, s * HALF);
    // 露天餐桌 + 遮阳伞
    const tabs = [[48, 690], [48, 711], [62, 688], [62, 712], [76, 690], [76, 711], [90, 690], [90, 711], [70, 683], [84, 718]];
    for (const [tx, tz] of tabs) {
      b.cyl(0.08, 0.12, 0.75, tx, 0, tz, 0x444444, { seg: 6 });
      b.cyl(0.7, 0.7, 0.06, tx, 0.75, tz, C.white, { seg: 10 });
      b.cyl(0.035, 0.035, 2.4, tx, 0.8, tz, 0xdddddd, { seg: 4 });
      b.cone(1.5, 0.6, tx, 2.6, tz, pick([0xd8505a, 0x3f9a6a, 0xf0b93a]), { seg: 8 });
      b.cyl(0.18, 0.15, 0.06, tx + 0.2, 0.81, tz, 0xd9a05a, { seg: 8 });
      for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.4; b.box(0.4, 0.45, 0.4, tx + Math.cos(a) * 1.05, 0, tz + Math.sin(a) * 1.05, C.woodL, { ry: -a }); }
      col.circle(tx, tz, 0.75, { yMax: 1.0 });
    }
    // 露台矮栅栏（不挡路）
    fenceLine(54, 680, 100, 680, C.white, true, 0.8); fenceLine(54, 720, 100, 720, C.white, true, 0.8);
    flowerBed(56, 678, 2.5, 0.8); flowerBed(56, 722, 2.5, 0.8);
    // 菜单板（A 字牌）
    {
      const mx = 44, mz = 705;
      b.box(0.9, 1.2, 0.08, mx, 0, mz, 0x2b2b2b, { ry: HALF, rx: 0.15 });
      signAt('今日特供\n蓝莓派 · 胡萝卜蛋糕', 0.85, mx - 0.12, 0.75, mz, -HALF, { bg: '#2b2b2b', fg: '#ffffff', w: 256, h: 320, font: 'bold 30px "PingFang SC","Microsoft YaHei",sans-serif' });
      col.circle(mx, mz, 0.5, { yMax: 1.2 });
    }
    // 派车（送货车，后院）
    {
      const v = new L(126, 724, PI);
      v.box(2.2, 2.2, 3.6, 0, 0.5, -0.6, C.white, { mat: 'shiny' });
      v.box(2.2, 1.3, 1.8, 0, 0.5, 1.9, 0x3f7fbf, { mat: 'shiny' });
      v.box(2.0, 0.6, 0.05, 0, 1.25, 2.82, C.glass, { mat: 'glass' });
      v.cyl(0.9, 0.9, 0.3, 0, 2.7, -0.6, 0xd9a05a, { seg: 10 });
      for (const s of [-1, 1]) { v.wheel(0.45, 0.3, s * 1.1, 0.45, -1.6); v.wheel(0.45, 0.3, s * 1.1, 0.45, 1.8); }
      v.solid(2.4, 5.6, 0, 0.3, 3);
    }
    // 后院：派的冷却架 + 木柴堆 + 浆果丛
    b.box(4, 1.4, 0.8, 128, 0, 690, C.woodL); col.box(128, 690, 4, 0.8, { yMax: 1.4 });
    for (let i = 0; i < 5; i++) b.cyl(0.3, 0.28, 0.1, 126.4 + i * 0.8, 1.4, 690, 0xd9a05a, { seg: 8 });
    b.box(3, 1.2, 1.2, 128, 0, 676, C.woodD); col.box(128, 676, 3, 1.2, { yMax: 1.2 });
    for (const [x, z] of [[150, 660], [160, 745], [170, 670], [72, 655], [72, 745], [150, 735]]) tree(x, z, rr(1.1, 1.4));
    for (let i = 0; i < 6; i++) tree(170, 680 + i * 8, 0.9, 'poplar');
    ctx.addLabel(110, 14, 700, B.name, D.color);
  }

  // 派店以东：向日葵、浆果、工具棚、风泵
  sunflowerField(200, 620, 330, 702);
  berryBushes(200, 722, 330, 805);
  fenceRect(196, 616, 334, 809, { w: [[705, 719]], e: [[705, 719]] }, C.woodL);
  {
    const s = new L(400, 700, -HALF);
    s.box(14, 5, 10, 0, 0, 0, C.red); gableRoof(s, 14, 10, 0, 0, 5, 3, C.red, 0x6a6a6a, 0.5);
    s.box(4.5, 3.8, 0.15, 0, 0, 5.03, 0x7a2a22); s.box(4.6, 0.2, 0.1, 0, 3.8, 5.1, C.white);
    s.solid(14.4, 10.4, 0, 0, 8);
    tractor(388, 712, -1.2, 0x2f8f3f); tractor(386, 688, -1.9, 0xd9412b);
    for (let i = 0; i < 6; i++) hayBale(420 + (i % 3) * 2.2, 725 + ((i / 3) | 0) * 2.2, 0);
    haystack(430, 670, 1.3); haystack(440, 680, 1.0);
    b.cyl(1, 1, 0.025, 450, 0, 760, 0x3a6a8a, { seg: 12, sx: 7, sz: 5, mat: 'water' });
    col.circle(450, 760, 6, { yMax: 1 });
    reserve(375, 670, 460, 772);
  }

  // =====================================================================
  // 8. 东边胡萝卜田 + 稻草人
  // =====================================================================
  {
    const F = LANDMARKS.cropField, x0 = F.x - F.w / 2, x1 = F.x + F.w / 2, z0 = F.z - F.d / 2, z1 = F.z + F.d / 2;
    carrotField(x0 + 2, z0 + 2, F.x - 6, z1 - 2, 2.5, 1.7, 'x');
    carrotField(F.x + 6, z0 + 2, x1 - 2, z1 - 2, 2.5, 1.7, 'x');
    b.box(12, 0.035, z1 - z0 - 4, F.x, 0, F.z, C.dirt, { shadow: false });
    fenceRect(x0, z0, x1, z1, { n: [[F.x - 6, F.x + 6]], s: [[F.x - 6, F.x + 6]] }, C.woodL);
    // 稻草人
    const sx = F.x, sz = F.z;
    b.cyl(0.08, 0.1, 3, sx, 0, sz, C.woodD, { seg: 6 });
    b.box(2.8, 0.12, 0.12, sx, 2.2, sz, C.woodD);
    b.box(0.9, 1.1, 0.5, sx, 1.4, sz, 0x4f6fbf);
    b.box(2.2, 0.35, 0.4, sx, 2.05, sz, 0xd04a3a);
    b.box(0.95, 0.5, 0.52, sx, 1.2, sz, 0x6a4a2a);
    b.sphere(0.42, sx, 2.85, sz, 0xe8d29a, { seg: 8 });
    b.cyl(0.85, 0.85, 0.06, sx, 3.1, sz, C.hay, { seg: 10 });
    b.cone(0.4, 0.55, sx, 3.15, sz, C.hay, { seg: 10 });
    for (const s of [-1, 1]) b.cone(0.18, 0.4, sx + s * 1.35, 1.75, sz, C.hay, { seg: 5 });
    b.sphere(0.06, sx - 0.15, 2.95, sz + 0.38, 0x222222, { seg: 5 }); b.sphere(0.06, sx + 0.15, 2.95, sz + 0.38, 0x222222, { seg: 5 });
    for (const s of [-1.1, 0.9]) { b.sphere(0.16, sx + s, 2.45, sz, 0x222222, { seg: 6, sx: 1.5 }); b.cone(0.05, 0.14, sx + s + 0.2, 2.45, sz, 0xf0b93a, { rz: -HALF, seg: 4 }); }
    col.circle(sx, sz, 0.4, { yMax: 3.2 });
    // 盘旋的乌鸦（动画）
    {
      const g = animGroup(sx, 9, sz);
      const lb = localB(g);
      lb.sphere(0.3, 14, 0, 0, 0x222222, { seg: 6, sz: 1.6 });
      lb.box(1.6, 0.04, 0.4, 14, 0, 0, 0x222222);
      lb.flush();
      ctx.animate((dt, t) => { g.rotation.y = t * 0.25; g.position.y = 9 + Math.sin(t * 0.8) * 1.2; });
    }
    // 田头标牌
    {
      const px = x0 + 14, pz = z0 - 1.6;
      for (const s of [-1.3, 1.3]) b.box(0.15, 2.4, 0.15, px + s, 0, pz, C.woodD);
      const sl = new L(px, pz - 0.05, PI);
      signL(sl, '东边胡萝卜田\n请勿偷吃！', 3.2, 0, 2.6, 0, { bg: '#f6e7c1', fg: '#7b4a2c', w: 512, h: 256, font: 'bold 70px "PingFang SC","Microsoft YaHei",sans-serif' });
      col.box(px, pz, 3, 0.4, { yMax: 2.6 });
    }
    // 篮子 + 手推车
    crate(F.x - 2, F.z - 30, 0.3); crate(F.x + 2.5, F.z + 28, -0.2);
    {
      const w = new L(F.x + 3, F.z - 12, 0.4);
      w.box(1.4, 0.6, 2.0, 0, 0.5, 0, 0x8a3a2a);
      for (let i = 0; i < 8; i++) w.cone(0.1, 0.6, rr(-0.5, 0.5), 1.05, rr(-0.8, 0.8), C.orange, { rx: HALF, ry: rand() * PI, seg: 5 });
      w.wheel(0.4, 0.15, 0, 0.4, 0.9); w.box(0.08, 0.08, 1.6, -0.5, 0.6, -1.6, C.woodD); w.box(0.08, 0.08, 1.6, 0.5, 0.6, -1.6, C.woodD);
      w.solid(1.4, 2.2, 0, 0, 1.2);
    }
    ctx.addLabel(F.x, 8, F.z, F.name, D.color);
  }

  // =====================================================================
  // 9. 东北村：胡萝卜水塔、胡萝卜雕像、杂货铺、小教堂、鸭子池塘
  // =====================================================================
  {
    // 胡萝卜水塔
    const wx = 130, wz = 455;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      b.box(0.35, 10.5, 0.35, wx + sx * 3.2, 0, wz + sz * 3.2, 0x8a6a4a, { rx: sz * 0.05, rz: -sx * 0.05 });
      col.circle(wx + sx * 3.2, wz + sz * 3.2, 0.35, { yMax: 10 });
    }
    for (const y of [3.5, 7]) { b.box(6.6, 0.15, 0.15, wx, y, wz - 3.1, 0x8a6a4a); b.box(6.6, 0.15, 0.15, wx, y, wz + 3.1, 0x8a6a4a); b.box(0.15, 0.15, 6.6, wx - 3.1, y, wz, 0x8a6a4a); b.box(0.15, 0.15, 6.6, wx + 3.1, y, wz, 0x8a6a4a); }
    b.box(8.6, 0.2, 8.6, wx, 10.3, wz, 0x8a6a4a);
    b.cyl(4.6, 3.4, 6, wx, 10.5, wz, C.orange, { seg: 12 });
    b.cone(3.4, 3.2, wx, 7.3, wz, C.orange, { seg: 12, rx: PI, sy: 1 });
    for (let y = 11.5; y < 16; y += 1.4) b.cyl(4.6 - (y - 10.5) * 0, 4.6, 0.12, wx, y, wz, 0xd06010, { seg: 12 });
    for (let i = 0; i < 5; i++) { const a = i * 1.26; b.cone(1.0, 4.2, wx + Math.cos(a) * 1.2, 16.4, wz + Math.sin(a) * 1.2, C.carrotLeaf, { seg: 6, mat: 'leaf', rx: Math.sin(a) * 0.35, rz: -Math.cos(a) * 0.35 }); }
    b.box(0.5, 10.5, 0.1, wx + 3.4, 0, wz - 3.4, 0x666666); // 梯子
    signAt('兔窝镇', 5.0, wx, 13.4, wz - 4.66, PI, { bg: '#f07a1e', fg: '#ffffff', w: 512, h: 160, font: 'bold 110px "PingFang SC","Microsoft YaHei",sans-serif' });
    reserve(wx - 6, wz - 6, wx + 6, wz + 6);
    ctx.addLabel(wx, 22, wz, '胡萝卜水塔', D.color);

    // 村口绿地 + 胡萝卜雕像
    const gx = 50, gz = 478;
    b.cyl(14, 14, 0.04, gx, 0, gz, C.grassL, { seg: 16, shadow: false });
    b.cyl(2.2, 2.6, 1.2, gx, 0, gz, C.stone, { seg: 10 });
    b.cone(1.3, 6.5, gx, 7.6, gz, C.orange, { seg: 10, rx: PI });
    b.sphere(1.3, gx, 7.6, gz, C.orange, { seg: 10, sy: 0.3 });
    for (let i = 0; i < 4; i++) { const a = i * HALF; b.cone(0.45, 2.4, gx + Math.cos(a) * 0.4, 7.7, gz + Math.sin(a) * 0.4, C.carrotLeaf, { seg: 6, mat: 'leaf', rx: Math.sin(a) * 0.3, rz: -Math.cos(a) * 0.3 }); }
    col.circle(gx, gz, 2.7, { yMax: 10 });
    flowerBed(gx, gz, 5, 5, 40);
    col.circle(gx, gz, 0.1, { yMax: 0.1 });
    for (const a of [0.6, 2.2, 3.8, 5.4]) bench(gx + Math.cos(a) * 10, gz + Math.sin(a) * 10, -a - HALF);
    reserve(gx - 15, gz - 15, gx + 15, gz + 15);
    ctx.addLabel(gx, 10, gz, '胡萝卜雕像', D.color);

    // 杂货铺（朝西对着 x=0 路）
    {
      const s = new L(32, 545, -HALF);
      s.box(16, 4.4, 10, 0, 0, 0, 0xd9b48a);
      s.box(16, 2.6, 0.4, 0, 4.4, 4.8, 0xd9b48a); // 假立面
      gableRoof(s, 16, 10, 0, -0.2, 4.4, 2.4, 0xd9b48a, 0x5a6a5a, 0.4);
      s.box(16, 0.4, 4, 0, 0, 7, C.woodL);
      for (const px of [-7.6, -2.5, 2.5, 7.6]) s.box(0.2, 3.2, 0.2, px, 0.4, 8.8, C.woodD);
      s.box(16.4, 0.18, 4.6, 0, 3.6, 7.1, 0x5a6a5a, { rx: -0.1 });
      for (const px of [-5, 5]) { s.box(3.6, 2.2, 0.12, px, 0.9, 5.03, C.glass, { mat: 'glass' }); }
      s.box(1.8, 2.8, 0.12, 0, 0.4, 5.03, 0x5a3a22);
      signL(s, '兔窝镇杂货铺', 9, 0, 6.6, 5.05, { bg: '#2f5a3a', fg: '#ffe3a8', w: 768, h: 128, font: 'bold 84px "PingFang SC","Microsoft YaHei",sans-serif' });
      s.solid(16.4, 10.4, 0, 0, 7.2);
      s.solid(16, 4, 0, 7, 0.4, { walkable: true });
      for (const px of [-6.5, 6.5]) { const [x, z] = s.p(px, 7.8); crate(x, z, -HALF, px > 0 ? 0xd8322a : C.orange); }
      const [bx2, bz2] = s.p(-9.5, 6); hayBale(bx2, bz2, 0);
    }
    // 小教堂（朝南）
    {
      const s = new L(150, 558, 0);
      s.box(10, 6, 16, 0, 0, 0, C.white);
      gableRoof(new L(150, 558, HALF), 16, 10, 0, 0, 6, 4.5, C.white, 0x5d4a6f, 0.5);
      s.box(4, 10, 4, 0, 0, 8.5, C.white);
      s.cone(3.0, 6, 0, 10, 8.5, 0x5d4a6f, { seg: 4, ry: PI / 4 });
      s.box(0.15, 1.6, 0.15, 0, 16, 8.5, 0xd9b030); s.box(0.9, 0.15, 0.15, 0, 16.9, 8.5, 0xd9b030);
      s.box(1.8, 3.0, 0.15, 0, 0, 10.55, 0x7a3a22);
      s.cyl(0.8, 0.8, 0.1, 0, 7.2, 10.5, 0xffd890, { rx: HALF, seg: 12, mat: 'glass' });
      for (const lz of [-5, -1, 3]) for (const sgn of [-1, 1]) windowAt(s, sgn * 5.02, 2.2, lz, 1.0, 2.2, 0xd9b030, sgn * HALF);
      s.solid(10.4, 16.4, 0, 0, 11); s.solid(4.4, 4.4, 0, 8.5, 16);
      flowerBed(146, 572, 1.6, 1.0); flowerBed(154, 572, 1.6, 1.0);
      for (let i = 0; i < 5; i++) b.box(0.5, rr(0.7, 1.0), 0.15, 160 + i * 1.6, 0, 548 + (i % 2) * 2, 0x9a9a9a);
    }
    // 鸭子池塘
    {
      const px = 290, pz = 500, pr = 18;
      b.cyl(pr + 2, pr + 2.4, 0.06, px, 0, pz, 0xd9c99a, { seg: 16, shadow: false });
      b.cyl(pr, pr, 0.08, px, 0, pz, 0x3a7aa0, { seg: 16, mat: 'water' });
      for (let i = 0; i < 30; i++) {
        const a = rand() * PI * 2, d = pr + rr(-0.5, 1.2);
        b.cyl(0.04, 0.05, rr(0.8, 1.5), px + Math.cos(a) * d, 0, pz + Math.sin(a) * d, 0x5a8a3a, { seg: 4 });
      }
      for (let i = 0; i < 5; i++) b.cyl(0.9, 0.9, 0.03, px + rr(-12, 12), 0.08, pz + rr(-12, 12), 0x4f9a3f, { seg: 8 });
      col.circle(px, pz, pr - 0.4, { yMax: 1.0 });
      reserveC(px, pz, pr + 3);
      // 小木栈道（伸进池塘，可站立）
      b.box(2.2, 0.3, 7, px, 0.1, pz + pr - 2.5, C.woodL);
      col.box(px, pz + pr - 2.5, 2.2, 7, { yMax: 0.4, walkable: true, yMin: -1 });
      const g = animGroup(px, 0.1, pz);
      const lb = localB(g);
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05, d = 6 + (i % 3) * 3;
        const dx = Math.cos(a) * d, dz = Math.sin(a) * d;
        const dl = new L(dx, dz, -a, lb); // 绕圈方向
        const c = i === 0 ? 0xf5d020 : (i % 2 ? C.white : 0x8a6a4a);
        dl.sphere(0.35, 0, 0.2, 0, c, { seg: 8, sz: 1.4 });
        dl.sphere(0.2, 0.0, 0.55, 0.4, i % 2 ? C.white : 0x2f6f3f, { seg: 6 });
        dl.cone(0.08, 0.2, 0, 0.5, 0.6, C.orange, { rx: HALF, seg: 4 });
      }
      lb.flush();
      ctx.animate((dt, t) => { g.rotation.y = -t * 0.08; g.position.y = 0.1 + Math.sin(t * 2) * 0.03; });
      for (const [x, z] of [[268, 478], [312, 476], [314, 524], [266, 522]]) tree(x, z, 1.5, 'oak');
      bench(290, 524, 0); bench(266, 500, -HALF);
      ctx.addLabel(px, 6, pz, '鸭子池塘', D.color);
    }
  }

  // =====================================================================
  // 10. 兔子洞屋村落 + 苹果园 + 玉米地 + 小屋
  // =====================================================================
  const burrowSpots = [
    // 西北村
    [-80, 480, 0.3], [-120, 470, -0.2], [-180, 478, 0.4], [-230, 465, 0], [-270, 500, HALF],
    [-90, 545, PI - 0.3], [-150, 555, PI - 0.2], [-205, 560, PI + 0.2], [-250, 545, PI],
    // 西南坡
    [-60, 900, PI - 0.4], [-110, 880, 0.3], [-160, 905, PI], [-200, 850, PI], [-250, 895, PI - 0.3],
    // 东侧
    [400, 450, -0.4], [450, 500, -HALF], [420, 560, PI], [360, 455, 0],
    [60, 880, -0.4], [120, 920, PI - 0.3], [440, 905, -HALF], [420, 850, PI + 0.6],
  ];
  for (const [x, z, a] of burrowSpots) burrow(x, z, a, rr(7.5, 9.5), rr(3.8, 4.6));
  // 西北村：小路、花坛、邮筒、野餐桌
  b.box(200, 0.035, 5, -170, 0, 512, C.dirt, { shadow: false });
  for (const [x, z] of [[-100, 512], [-160, 512], [-220, 512]]) { flowerBed(x, z - 6, 2, 1); }
  {
    const t = new L(-135, 525, 0.2);
    t.box(2.4, 0.1, 1.0, 0, 0.75, 0, C.woodL);
    for (const s of [-1, 1]) { t.box(2.4, 0.08, 0.35, 0, 0.45, s * 0.75, C.woodL); t.box(0.1, 0.75, 1.6, s * 1.0, 0, 0, C.woodD); }
    t.solid(2.4, 2.0, 0, 0, 0.9);
  }
  // 苹果园
  {
    const x0 = -465, x1 = -305, z0 = 440, z1 = 585;
    let i = 0;
    for (let x = x0 + 4; x < x1; x += 13) for (let z = z0 + 4; z < z1; z += 12) {
      if (Math.abs(x - POI.orchard.x) < 5 && Math.abs(z - POI.orchard.z) < 5) continue;
      tree(x + rr(-0.8, 0.8), z + rr(-0.8, 0.8), rr(0.9, 1.1), 'apple'); i++;
    }
    fenceRect(x0 - 3, z0 - 3, x1 + 3, z1 + 3, { e: [[505, 520]], s: [[-390, -375]] }, C.woodD);
    for (const [x, z] of [[-380, 507], [-386, 519]]) crate(x, z, rr(0, 1), 0xd8322a);
    { const l = new L(-378, 516, 0.3); l.box(0.1, 3.2, 0.1, -0.4, 0, 0, C.woodL, { rx: -0.2 }); l.box(0.1, 3.2, 0.1, 0.4, 0, 0, C.woodL, { rx: -0.2 }); for (let k = 0; k < 6; k++) l.box(0.8, 0.06, 0.06, 0, 0.4 + k * 0.5, -0.1 * k, C.woodL); }
    reserve(x0 - 3, z0 - 3, x1 + 3, z1 + 3);
  }
  // 玉米地 + 蜂箱
  cornField(-470, 838, -300, 930);
  fenceRect(-474, 834, -296, 934, { n: [[-386, -374]] }, C.woodD);
  for (let i = 0; i < 6; i++) {
    const x = -285 + (i % 3) * 3, z = 900 + ((i / 3) | 0) * 3;
    b.box(1.0, 0.25, 1.0, x, 0, z, C.woodD); b.box(0.9, 1.0, 0.9, x, 0.25, z, 0xf6e6a8); b.box(1.05, 0.12, 1.05, x, 1.25, z, C.white);
    col.box(x, z, 1.05, 1.05, { yMax: 1.4 });
  }
  reserve(-290, 895, -276, 910);
  // 东南：农舍 + 工具棚
  {
    const h = new L(140, 872, PI);
    h.box(12, 5, 9, 0, 0, 0, 0xc9dbe8); gableRoof(h, 12, 9, 0, 0, 5, 3, 0xc9dbe8, C.roofBrown, 0.5);
    h.box(1.4, 2.4, 0.12, 0, 0, 4.53, 0x3f6fa0);
    for (const px of [-3.5, 3.5]) windowAt(h, px, 1.6, 4.52);
    h.box(12, 0.3, 3, 0, 0, 6, C.woodL);
    h.solid(12.4, 9.4, 0, 0, 8); h.solid(12, 3, 0, 6, 0.3, { walkable: true });
    reserve(132, 862, 148, 882);
    const s = new L(100, 900, HALF);
    s.box(6, 3.4, 5, 0, 0, 0, C.woodL); gableRoof(s, 6, 5, 0, 0, 3.4, 1.6, C.woodL, 0x7a7a7a, 0.3);
    s.box(2.2, 2.6, 0.1, 0, 0, 2.53, C.woodD);
    s.solid(6.2, 5.2, 0, 0, 5);
    reserve(96, 896, 104, 904);
    tractor(110, 888, 2.2, 0xf0b93a);
    reserve(106, 884, 114, 892);
  }

  // =====================================================================
  // 11. 边缘小山丘
  // =====================================================================
  for (let x = -470; x <= 470; x += 62) {
    if (Math.abs(x) < 70) continue;
    hill(x + rr(-10, 10), 995 + rr(-5, 8), rr(52, 62), rr(12, 18));
  }
  for (const s of [-1, 1]) {
    for (const [z, F] of [[505, 42], [705, 50], [890, 42]]) hill(s * 538, z + rr(-8, 8), F, rr(12, 17));
  }
  // 中景低矮土丘（有碰撞，玩家绕行）
  for (const [x, z, F, H] of [[-40, 760, 9, 2.4], [40, 780, 10, 2.6], [-60, 630, 8, 2], [360, 610 + 22, 9, 2.2], [-330, 455 + 0, 0, 0]]) {
    if (F > 0 && isFree(x, z, F)) hill(x, z, F, H, C.grassL);
  }

  // =====================================================================
  // 12. 散布：树、干草堆、花坛、木栅栏
  // =====================================================================
  {
    let placed = 0, tries = 0;
    while (placed < 160 && tries < 6000) {
      tries++;
      const x = rr(R.x0 + 5, R.x1 - 5), z = rr(R.z0 + 8, R.z1 - 5);
      if (!isFree(x, z, 3)) continue;
      const kind = rand() < 0.2 ? 'poplar' : (rand() < 0.15 ? 'apple' : 'oak');
      tree(x, z, rr(0.85, 1.5), kind);
      reserveC(x, z, 3); placed++;
    }
    let hs = 0; tries = 0;
    while (hs < 18 && tries < 2000) {
      tries++;
      const x = rr(R.x0 + 10, R.x1 - 10), z = rr(R.z0 + 20, R.z1 - 10);
      if (!isFree(x, z, 3)) continue;
      if (rand() < 0.5) haystack(x, z, rr(0.8, 1.2)); else { hayBale(x, z, rr(0, PI)); hayBale(x + 2, z + 0.5, rr(0, PI)); }
      reserveC(x, z, 4); hs++;
    }
    let fb = 0; tries = 0;
    while (fb < 26 && tries < 2000) {
      tries++;
      const x = rr(R.x0 + 10, R.x1 - 10), z = rr(R.z0 + 15, R.z1 - 10);
      if (!isFree(x, z, 2.5)) continue;
      flowerBed(x, z, rr(1.2, 2.5), rr(0.8, 1.8), 14); reserveC(x, z, 3); fb++;
    }
    // 路边长栅栏
    for (const [x0, x1, z] of [[-490, -300, 609.5], [30, 190, 609.5], [-280, -40, 811], [30, 330, 811], [-290, -30, 829], [30, 170, 829], [390, 490, 829]]) {
      fenceLine(x0, z, x1, z, C.woodL);
    }
  }

  // =====================================================================
  // 13. 东北/西北零散：野餐区、邮筒、手推车
  // =====================================================================
  mailbox(-11, 470, HALF, 0x3f7fbf);
  mailbox(11, 640, -HALF, C.red);
  for (const [x, z] of [[-12.5, 760], [12.5, 900], [-12.5, 880]]) {
    // 路边小胡萝卜标志桩
    b.cyl(0.1, 0.1, 1.2, x, 0, z, C.white, { seg: 6 });
    b.cone(0.18, 0.5, x, 1.2, z, C.orange, { seg: 6 });
    col.circle(x, z, 0.2, { yMax: 1.6 });
  }

  ctx.addLabel(0, 20, 640, D.name, D.color);
  // 统计信息（调试用）
  return { animCount, signCount };
}
