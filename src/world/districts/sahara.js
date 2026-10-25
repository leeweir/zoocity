// 撒哈拉广场 Sahara Square —— 沙漠奢华风（拉斯维加斯 × 阿拉伯）
//
// 地区 rect：x 330..950, z -450..280；道路 roadsX [420,560,700,840], roadsZ [-360,-200,0,150]
//
// 主要地标：
//   棕榈宫殿酒店 palmHotel  中心 (630,-110)，金色玻璃"棕榈树"塔 ~150m，门廊朝南，front (630,-15)
//                            前庭两座喷泉 (600,-32) (660,-32)，塔身 y≈125 处旋转招牌，后侧泳池 z≈-172
//   绿洲沙浴水疗 oasisSpa   区块 x 707..833, z 7..143，大门 (770,22)，front (770,15)
//                            泻湖 (770,62)，沙浴池一排 z=104，凉亭 x=722/818，主楼 z 118..134
//   沙丘集市 bazaar         区块 x 427..553, z 7..143，大门 (490,22)，front (490,15)
//                            条纹棚摊位网格，中央喷泉广场 (490,82)
//   日落广场 sunsetPlaza    (630,-280)：喷泉 + 四座宣礼塔 + 遮阳帆
//   气候墙 climate wall      x 330..345，高 34m，热排气塔 ×10（顶部旋转风扇），z -10..10 为连接道路门洞
//   沙丘：北缘 z<-414、东缘 x>912、南缘 z>252
//
// 给案件系统的 POI 见下方 export const POI（所有点周围 3m 无碰撞体，y 为地面高度）。

import * as THREE from 'three';

export const POI = {
  palmHotelFront:   { x: 630, y: 0, z: -15,  label: '棕榈宫殿酒店 · 正门广场' },
  palmHotelCourt:   { x: 630, y: 0, z: -38,  label: '棕榈宫殿酒店 · 喷泉前庭' },
  palmHotelPool:    { x: 627, y: 0, z: -154.5, label: '棕榈宫殿酒店 · 后院泳池边' },
  oasisSpaFront:    { x: 770, y: 0, z: 15,   label: '绿洲沙浴水疗 · 大门' },
  oasisSandPits:    { x: 770, y: 0, z: 92,   label: '绿洲水疗 · 沙浴池' },
  oasisPoolside:    { x: 770, y: 0, z: 36,   label: '绿洲水疗 · 泻湖边' },
  bazaarFront:      { x: 490, y: 0, z: 15,   label: '沙丘集市 · 入口' },
  bazaarFountain:   { x: 490, y: 0, z: 66,   label: '沙丘集市 · 喷泉广场' },
  bazaarAisle:      { x: 452, y: 0, z: 43,   label: '沙丘集市 · 香料摊通道' },
  sunsetPlaza:      { x: 630, y: 0, z: -262, label: '日落广场' },
  climateGate:      { x: 356, y: 0, z: 0,    label: '气候墙 · 撒哈拉门' },
};

export function build(ctx) {
  const { scene, b, col, layout, tex } = ctx;
  const { DISTRICTS, ROAD_W, SIDEWALK_W, LANDMARKS, blocksOf } = layout;
  const D = DISTRICTS.sahara;
  const rect = D.rect;
  const R = ctx.rng(20240917);
  const HW = ROAD_W / 2;
  const PI = Math.PI;
  const rr = (a, c) => a + (c - a) * R();
  const pick = (arr) => arr[Math.floor(R() * arr.length) % arr.length];

  // ---------- 预留点（地标 front + POI），任何道具都不能靠近 ----------
  const reserved = [];
  for (const k of ['palmHotel', 'oasisSpa', 'bazaar']) if (LANDMARKS[k].front) reserved.push(LANDMARKS[k].front);
  for (const p of Object.values(POI)) reserved.push(p);
  const free = (x, z, rad = 1) => reserved.every(p => (p.x - x) ** 2 + (p.z - z) ** 2 > (rad + 3.3) ** 2);

  // ---------- 动画 / 招牌计数 ----------
  let animCount = 0, signCount = 0;
  const anims = [];
  const addAnim = (fn) => { if (animCount >= 38) return false; animCount++; anims.push(fn); return true; };
  ctx.animate((dt, t) => { for (const f of anims) f(dt, t); });
  function addSign(text, width, x, y, z, ry, opts = {}) {
    if (signCount >= 28) return null;
    const m = tex.signMesh(text, width, opts);
    m.position.set(x, y, z); m.rotation.y = ry;
    scene.add(m); signCount++;
    return m;
  }
  const waterMat = new THREE.MeshStandardMaterial({ color: 0xa8ecff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.72 });
  const jetGeo = new THREE.CylinderGeometry(0.12, 0.55, 1, 8, 1, true).translate(0, 0.5, 0);
  const sprayGeo = new THREE.SphereGeometry(1, 8, 6);
  function waterJet(x, y, z, h, spread = 1.4) {
    const g = new THREE.Group();
    const jet = new THREE.Mesh(jetGeo, waterMat); jet.scale.set(1, h, 1);
    const spray = new THREE.Mesh(sprayGeo, waterMat); spray.scale.set(spread, 0.5, spread); spray.position.y = h;
    g.add(jet, spray); g.position.set(x, y, z);
    if (!addAnim((dt, t) => {
      const k = 1 + 0.12 * Math.sin(t * 3.1 + x);
      jet.scale.y = h * k; spray.position.y = h * k;
      spray.scale.set(spread * (1 + 0.1 * Math.sin(t * 5 + z)), 0.5, spread * (1 + 0.1 * Math.cos(t * 5 + z)));
    })) return;
    scene.add(g);
  }

  // ---------- 调色板 ----------
  const SAND = [0xe0b77a, 0xd9a066, 0xe8c995, 0xf0d6a8, 0xcf9a5e, 0xdcb48a, 0xc98a4b];
  const TERRA = [0xb8743f, 0xc0794a, 0xa8603a, 0xd08a5a];
  const DOME = [0xd4a537, 0x3aa7a3, 0xf3ead8, 0xc0794a, 0x2f8f9d, 0xe0b040];
  const AWN = [0xc8372d, 0x2a7f8f, 0xe8a23a, 0x7a3b8f, 0x2f6fb5, 0xd9573a];
  const NEON = [0xff3fa4, 0x3ff0ff, 0xffa63f, 0xb36bff, 0x6bff9a, 0xffe14f];
  const DARK = 0x3a2414, GOLD = 0xd9a93a, METALC = 0x6a5844;

  // ---------- 地面 ----------
  b.box(rect.x1 - rect.x0, 0.05, rect.z1 - rect.z0, (rect.x0 + rect.x1) / 2, -0.04, (rect.z0 + rect.z1) / 2, D.ground, { shadow: false });

  // ---------- 道路 / 车道线 / 斑马线 ----------
  const RX = [...D.roadsX], RZ = [...D.roadsZ];
  const nearRX = (x, m) => RX.some(r => Math.abs(x - r) < m);
  const nearRZ = (z, m) => RZ.some(r => Math.abs(z - r) < m);
  const ASPH = 0x5a524a, YEL = 0xf2c230, WHT = 0xf4f0e6;
  for (const x of RX) {
    b.box(ROAD_W, 0.02, rect.z1 - rect.z0, x, 0, (rect.z0 + rect.z1) / 2, ASPH, { shadow: false });
    for (let z = rect.z0 + 3; z < rect.z1 - 3; z += 6) {
      if (nearRZ(z, HW + 5.5)) continue;
      b.box(0.25, 0.01, 3, x, 0.02, z, YEL, { shadow: false });
      b.box(0.15, 0.01, 2, x - 3.5, 0.02, z, WHT, { shadow: false });
      b.box(0.15, 0.01, 2, x + 3.5, 0.02, z, WHT, { shadow: false });
    }
  }
  for (const z of RZ) {
    b.box(rect.x1 - rect.x0, 0.02, ROAD_W, (rect.x0 + rect.x1) / 2, 0, z, ASPH, { shadow: false });
    for (let x = rect.x0 + 3; x < rect.x1 - 3; x += 6) {
      if (nearRX(x, HW + 5.5)) continue;
      b.box(3, 0.01, 0.25, x, 0.02, z, YEL, { shadow: false });
      b.box(2, 0.01, 0.15, x, 0.02, z - 3.5, WHT, { shadow: false });
      b.box(2, 0.01, 0.15, x, 0.02, z + 3.5, WHT, { shadow: false });
    }
  }
  for (const x of RX) for (const z of RZ) {
    for (const s of [-1, 1]) {
      for (let k = -HW + 0.9; k < HW - 0.5; k += 1.3) {
        b.box(3, 0.01, 0.6, x + s * (HW + 2.2), 0.02, z + k, WHT, { shadow: false }); // 横穿东西向道路
        b.box(0.6, 0.01, 3, x + k, 0.02, z + s * (HW + 2.2), WHT, { shadow: false }); // 横穿南北向道路
      }
    }
  }

  // ---------- 人行道 ----------
  const PAVE = 0xd8c3a0, CURB = 0xb9a582;
  const blocks = blocksOf('sahara');
  for (const bl of blocks) {
    const roadW = bl.x0 > rect.x0, roadE = bl.x1 < rect.x1, roadN = bl.z0 > rect.z0, roadS = bl.z1 < rect.z1;
    const xa = bl.x0 === rect.x0 ? 345 : bl.x0;
    const W = bl.x1 - xa, cx = (xa + bl.x1) / 2;
    const S = SIDEWALK_W;
    if (roadN) { b.box(W, 0.15, S, cx, 0, bl.z0 + S / 2, PAVE, { shadow: false }); b.box(W, 0.16, 0.3, cx, 0, bl.z0 + 0.15, CURB, { shadow: false }); }
    if (roadS) { b.box(W, 0.15, S, cx, 0, bl.z1 - S / 2, PAVE, { shadow: false }); b.box(W, 0.16, 0.3, cx, 0, bl.z1 - 0.15, CURB, { shadow: false }); }
    if (roadW) { b.box(S, 0.15, bl.d, bl.x0 + S / 2, 0, bl.cz, PAVE, { shadow: false }); b.box(0.3, 0.16, bl.d, bl.x0 + 0.15, 0, bl.cz, CURB, { shadow: false }); }
    if (roadE) { b.box(S, 0.15, bl.d, bl.x1 - S / 2, 0, bl.cz, PAVE, { shadow: false }); b.box(0.3, 0.16, bl.d, bl.x1 - 0.15, 0, bl.cz, CURB, { shadow: false }); }
  }

  // ---------- 路灯 ----------
  function lamp(x, z) {
    if (!free(x, z, 0.3)) return;
    b.cyl(0.1, 0.16, 6, x, 0, z, 0x4a3a2a, { mat: 'metal', seg: 8 });
    b.box(0.6, 0.8, 0.6, x, 6, z, 0xffd27a, { mat: 'glow' });
    b.cone(0.5, 0.6, x, 6.8, z, 0x4a3a2a, { seg: 8, mat: 'metal' });
    b.sphere(0.12, x, 7.45, z, GOLD, { seg: 8, mat: 'metal' });
    col.circle(x, z, 0.22, { yMax: 7 });
  }
  for (const x of RX) for (let z = rect.z0 + 8; z < rect.z1 - 4; z += 32) {
    if (nearRZ(z, HW + 7)) continue;
    lamp(x - HW - 2, z); lamp(x + HW + 2, z);
  }
  for (const z of RZ) for (let x = 356; x < rect.x1 - 4; x += 32) {
    if (nearRX(x, HW + 7)) continue;
    lamp(x, z - HW - 2); lamp(x, z + HW + 2);
  }

  // ---------- 通用道具 ----------
  function palm(x, z, h = rr(7, 12), o = {}) {
    const y0 = o.y || 0;
    const yaw = R() * PI * 2, n = 6, L = h / n;
    let px = x, py = y0, pz = z, tilt = 0.04 + R() * 0.12;
    const curve = 0.03 + R() * 0.05;
    for (let i = 0; i < n; i++) {
      const r0 = Math.max(0.2, 0.42 - i * 0.035) * (h / 10);
      b.cyl(r0 * 0.88, r0, L * 1.04, px, py, pz, i % 2 ? 0x8b6b46 : 0x76583a, { seg: 8, rx: tilt, ry: yaw });
      px += Math.sin(yaw) * Math.sin(tilt) * L; py += Math.cos(tilt) * L; pz += Math.cos(yaw) * Math.sin(tilt) * L;
      tilt += curve;
    }
    const s = h / 10;
    b.sphere(0.45 * s, px, py, pz, 0x6b5030, { seg: 8 });
    const nf = 7;
    for (let k = 0; k < nf; k++) {
      const th = k * PI * 2 / nf + R() * 0.4;
      let sx = px, sy = py + 0.1, sz = pz;
      const green = pick([0x3f8a3a, 0x4d9a40, 0x377a34, 0x5aa648]);
      const segs = [[-0.3, 1.7, 0.9], [0.3, 1.7, 0.8], [0.85, 1.4, 0.5]];
      for (const [a, len0, w0] of segs) {
        const len = len0 * s * 1.25, w = w0 * s * 1.3;
        const dx = Math.sin(th) * Math.cos(a), dy = -Math.sin(a), dz = Math.cos(th) * Math.cos(a);
        b.box(w, 0.08, len, sx + dx * len / 2, sy + dy * len / 2 - 0.04, sz + dz * len / 2, green, { mat: 'leaf', rx: a, ry: th });
        sx += dx * len; sy += dy * len; sz += dz * len;
      }
    }
    b.sphere(0.22 * s, px + 0.3 * s, py - 0.3 * s, pz, 0x5a3f22, { seg: 8 });
    if (!o.noCol) col.circle(x, z, 0.5 * s + 0.1, { yMin: y0, yMax: y0 + h });
  }

  function umbrella(x, z, color, r = 2) {
    b.cyl(0.05, 0.05, 2.6, x, 0, z, 0xeeeeee, { seg: 8, mat: 'metal' });
    b.cone(r, 0.7, x, 2.3, z, color, { seg: 8, mat: 'shiny' });
  }
  function lounger(x, z, ry) {
    b.box(0.8, 0.35, 2, x, 0, z, 0xf4ece0, { ry });
    b.box(0.8, 0.12, 0.8, x - Math.sin(ry) * 0.7, 0.35, z - Math.cos(ry) * 0.7, 0xf4ece0, { ry, rx: -0.6 });
  }

  // 遮阳帆：几根高杆 + 倾斜帆布
  function sunShade(x, z, w, d, h, color, ry = 0) {
    const c = Math.cos(ry), s = Math.sin(ry);
    for (const [ax, az] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
      const px = x + ax * c + az * s, pz = z - ax * s + az * c;
      if (!free(px, pz, 0.3)) continue;
      b.cyl(0.15, 0.2, h + (az > 0 ? 1.5 : 0), px, 0, pz, 0xe9e2d6, { seg: 8, mat: 'metal' });
      col.circle(px, pz, 0.25, { yMax: h + 1.5 });
    }
    b.box(w, 0.08, d, x, h + 0.75, z, color, { ry, rx: -0.12, shadow: true });
  }

  function minaret(x, z, h, color, domeC) {
    b.box(4.4, 3, 4.4, x, 0, z, color);
    b.cyl(1.5, 1.8, h * 0.62, x, 3, z, color, { seg: 10 });
    const y1 = 3 + h * 0.62;
    b.cyl(2.5, 2.0, 0.8, x, y1, z, 0xf0e2c4, { seg: 10 });
    b.cyl(2.5, 2.5, 1.0, x, y1 + 0.8, z, 0xd8c09a, { seg: 10 });
    b.cyl(2.52, 2.52, 0.25, x, y1 + 1.2, z, pick(NEON), { seg: 10, mat: 'glow' });
    b.cyl(1.2, 1.4, h * 0.22, x, y1 + 1.8, z, color, { seg: 10 });
    const y2 = y1 + 1.8 + h * 0.22;
    b.sphere(1.45, x, y2, z, domeC, { seg: 10, sy: 1.25, mat: 'shiny' });
    b.cone(0.3, 2.4, x, y2 + 1.4, z, GOLD, { seg: 8, mat: 'metal' });
    b.sphere(0.3, x, y2 + 3.9, z, GOLD, { seg: 8, mat: 'metal' });
    col.box(x, z, 4.4, 4.4, { yMax: y2 + 4 });
  }

  function fountain(x, z, r, opts = {}) {
    b.cyl(r, r + 0.2, 0.8, x, 0, z, opts.rim || 0xe8d2a6, { seg: 12 });
    b.cyl(r - 0.4, r - 0.4, 0.05, x, 0.68, z, 0x3fb7cf, { seg: 12, mat: 'water' });
    b.cyl(0.6, 0.9, 2.2, x, 0.6, z, 0xd8c09a, { seg: 10 });
    b.cyl(r * 0.45, r * 0.25, 0.5, x, 2.8, z, 0xd8c09a, { seg: 12 });
    b.cyl(r * 0.4, r * 0.4, 0.05, x, 3.25, z, 0x3fb7cf, { seg: 12, mat: 'water' });
    b.cyl(0.3, 0.45, 1.4, x, 3.3, z, GOLD, { seg: 8, mat: 'metal' });
    col.circle(x, z, r + 0.25, { yMax: 1.2 });
    waterJet(x, 4.6, z, opts.jet || 3, r * 0.3);
  }

  // ---------- 建筑立面辅助 ----------
  // side: 'N'|'S'|'E'|'W'；along：沿立面偏移
  function faceInfo(side, cx, cz, w, d) {
    switch (side) {
      case 'N': return { nx: 0, nz: -1, fx: cx, fz: cz - d / 2, len: w, ry: PI };
      case 'S': return { nx: 0, nz: 1, fx: cx, fz: cz + d / 2, len: w, ry: 0 };
      case 'E': return { nx: 1, nz: 0, fx: cx + w / 2, fz: cz, len: d, ry: PI / 2 };
      default:  return { nx: -1, nz: 0, fx: cx - w / 2, fz: cz, len: d, ry: -PI / 2 };
    }
  }
  function faceBox(F, along, out, bw, bh, bd, y, color, o = {}) {
    const tx = -F.nz, tz = F.nx; // 切线
    const x = F.fx + tx * along + F.nx * out, z = F.fz + tz * along + F.nz * out;
    if (F.nz !== 0) b.box(bw, bh, bd, x, y, z, color, o);
    else b.box(bd, bh, bw, x, y, z, color, o);
  }
  // 拱门：深色矩形 + 半圆顶
  function archAt(F, along, w, h, depth, color, y = 0) {
    faceBox(F, along, depth / 2 - 0.1, w, h, depth, y, color);
    const tx = -F.nz, tz = F.nx;
    const x = F.fx + tx * along, z = F.fz + tz * along;
    const off = depth / 2 - 0.1;
    if (F.nz !== 0) b.cyl(w / 2, w / 2, depth, x, y + h, z + F.nz * off - depth / 2, color, { rx: PI / 2, seg: 10 });
    else b.cyl(w / 2, w / 2, depth, x + F.nx * off + depth / 2, y + h, z, color, { rz: PI / 2, seg: 10 });
  }

  const SHOPS = ['骆驼咖啡 CAMEL CAFE', '沙漠之星 DESERT STAR', '仙人掌果汁', '狐獴电玩城', '金沙剧院 GOLDEN SANDS',
    '香料铺 SPICES', '地毯之家 RUGS', '沙丘旅舍 DUNE INN', '日落酒吧 SUNSET BAR', '耳廓狐冰沙', '骆驼快递', '绿洲影院 OASIS'];
  let shopIdx = 0;

  function building(cx, cz, w, d, h, doorSide) {
    const color = R() < 0.72 ? pick(SAND) : pick(TERRA);
    const s = R();
    const darker = new THREE.Color(color).multiplyScalar(0.78).getHex();
    let topH = h;
    // 基座 + 主体
    b.box(w + 0.5, 1.3, d + 0.5, cx, 0, cz, darker);
    if (h > 40 && s < 0.45) {
      // 阶梯塔楼
      const h1 = h * 0.55, h2 = h * 0.28, h3 = h - h1 - h2;
      b.box(w, h1, d, cx, 0, cz, color, { mat: 'facade' });
      b.box(w * 0.74, h2, d * 0.74, cx, h1, cz, color, { mat: 'facade' });
      b.box(w * 0.5, h3, d * 0.5, cx, h1 + h2, cz, color, { mat: 'facade' });
      for (const [k, yy] of [[1, h1], [0.74, h1 + h2]]) {
        b.box(w * k + 0.8, 0.6, d * k + 0.8, cx, yy - 0.6, cz, 0xf3e6c8);
        // 平台栏杆
        b.box(w * k, 1.0, 0.3, cx, yy, cz - d * k / 2 + 0.15, 0xf3e6c8);
        b.box(w * k, 1.0, 0.3, cx, yy, cz + d * k / 2 - 0.15, 0xf3e6c8);
      }
      const dr = Math.min(w, d) * 0.22;
      b.cyl(dr * 1.05, dr * 1.05, 2, cx, h, cz, 0xf3e6c8, { seg: 12 });
      b.sphere(dr, cx, h + 2, cz, pick(DOME), { seg: 12, sy: 1.1, mat: 'shiny' });
      b.cone(0.4, 4, cx, h + 2 + dr * 1.05, cz, GOLD, { seg: 8, mat: 'metal' });
      topH = h + 6 + dr;
    } else if (h < 24 && s < 0.5) {
      // 圆顶建筑
      b.box(w, h, d, cx, 0, cz, color, { mat: 'facade' });
      b.box(w + 0.8, 0.7, d + 0.8, cx, h - 0.7, cz, 0xf3e6c8);
      const dr = Math.min(Math.min(w, d) * 0.32, 13);
      const dc = pick(DOME);
      b.cyl(dr * 1.05, dr * 1.08, 2.2, cx, h, cz, 0xf3e6c8, { seg: 12 });
      b.cyl(dr * 1.06, dr * 1.06, 0.3, cx, h + 1.2, cz, pick(NEON), { seg: 12, mat: 'glow' });
      b.sphere(dr, cx, h + 2.2, cz, dc, { seg: 12, sy: 1.05, mat: 'shiny' });
      b.cone(0.35, 3, cx, h + 2.1 + dr * 1.05, cz, GOLD, { seg: 8, mat: 'metal' });
      const sm = Math.min(w, d) * 0.08 + 0.6;
      for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const px = cx + ax * (w / 2 - sm - 0.4), pz = cz + az * (d / 2 - sm - 0.4);
        b.cyl(sm, sm, 1.6, px, h, pz, 0xf3e6c8, { seg: 8 });
        b.sphere(sm, px, h + 1.6, pz, dc, { seg: 8, mat: 'shiny' });
      }
      topH = h + 3 + dr;
    } else {
      // 平顶 + 屋顶露台
      b.box(w, h, d, cx, 0, cz, color, { mat: 'facade' });
      b.box(w + 0.8, 0.7, d + 0.8, cx, h - 0.7, cz, 0xf3e6c8);
      b.box(w, 1.1, 0.3, cx, h, cz - d / 2 + 0.15, color);
      b.box(w, 1.1, 0.3, cx, h, cz + d / 2 - 0.15, color);
      b.box(0.3, 1.1, d, cx - w / 2 + 0.15, h, cz, color);
      b.box(0.3, 1.1, d, cx + w / 2 - 0.15, h, cz, color);
      // 齿状女儿墙
      for (let a = -w / 2 + 1; a < w / 2 - 0.5; a += 2.4) {
        b.box(1, 0.8, 0.35, cx + a, h + 1.1, cz - d / 2 + 0.17, color);
        b.box(1, 0.8, 0.35, cx + a, h + 1.1, cz + d / 2 - 0.17, color);
      }
      const t = R();
      if (t < 0.45 && w > 10 && d > 10) {
        // 凉棚 + 遮阳伞
        const pw = w * 0.5, pd = d * 0.4;
        for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(0.3, 2.6, 0.3, cx + ax * pw / 2, h, cz + az * pd / 2, 0x8b6b46);
        for (let a = -pw / 2; a <= pw / 2; a += 1.0) b.box(0.18, 0.18, pd + 0.6, cx + a, h + 2.6, cz, 0x8b6b46);
        b.box(1.2, 0.5, 1.2, cx - w * 0.3, h, cz + d * 0.3, 0xb8743f);
        b.sphere(0.9, cx - w * 0.3, h + 1.1, cz + d * 0.3, 0x4d9a40, { seg: 8, mat: 'leaf' });
        b.cyl(0.04, 0.04, 2.4, cx + w * 0.3, h, cz - d * 0.3, 0xffffff, { seg: 8 });
        b.cone(1.6, 0.6, cx + w * 0.3, h + 2.1, cz - d * 0.3, pick(AWN), { seg: 8, mat: 'shiny' });
      } else if (t < 0.75 && w > 8 && d > 8) {
        // 小圆顶亭
        const kr = Math.min(w, d) * 0.18;
        b.cyl(kr, kr, 3, cx + w * 0.15, h, cz - d * 0.1, 0xf3e6c8, { seg: 10 });
        b.sphere(kr, cx + w * 0.15, h + 3, cz - d * 0.1, pick(DOME), { seg: 10, mat: 'shiny' });
        topH = h + 3 + kr;
      } else {
        // 水箱 / 空调
        b.cyl(1.2, 1.2, 2.2, cx - w * 0.25, h, cz, 0xc9c2b4, { seg: 10, mat: 'metal' });
        b.box(2, 1.2, 1.4, cx + w * 0.2, h, cz + d * 0.2, 0xb0aaa0, { mat: 'metal' });
      }
    }
    col.box(cx, cz, w + 0.5, d + 0.5, { yMax: topH });

    if (!doorSide) return;
    const F = faceInfo(doorSide, cx, cz, w, d);
    // 骆驼尺度大门（宽 3.6，高 4.4 + 拱）
    faceBox(F, 0, 0.15, 5.2, 7.2, 0.3, 0, 0xf3e6c8);
    archAt(F, 0, 3.6, 4.4, 0.5, DARK);
    // 一楼拱廊
    if (R() < 0.5 && F.len > 14) {
      for (let a = -F.len / 2 + 3.5; a < F.len / 2 - 3; a += 5) {
        if (Math.abs(a) < 4) continue;
        archAt(F, a, 2.6, 2.6, 0.35, 0x5a3a22);
      }
    }
    // 雨棚
    const awn = pick(AWN);
    const awnW = Math.min(F.len - 1, 6 + R() * 6);
    const tx = -F.nz, tz = F.nx;
    const ax = F.fx + F.nx * 1.3, az = F.fz + F.nz * 1.3;
    if (F.nz !== 0) b.box(awnW, 0.15, 2.6, ax, 7.3, az, awn, { rx: F.nz * 0.28 });
    else b.box(2.6, 0.15, awnW, ax, 7.3, az, awn, { rz: -F.nx * 0.28 });
    for (const sgn of [-1, 1]) faceBox(F, sgn * (awnW / 2 - 0.2), 2.4, 0.12, 7.0, 0.12, 0, 0x6a5844, { mat: 'metal' });
    // 霓虹
    if (R() < 0.45) {
      const nc = pick(NEON);
      faceBox(F, 0, 0.08, F.len * 0.9, 0.3, 0.12, Math.min(h - 1.5, 9.5), nc, { mat: 'glow' });
      if (h > 16) faceBox(F, F.len * 0.38, 0.15, 0.35, Math.min(h - 6, 20), 0.25, 9, nc, { mat: 'glow' });
    }
    if (h > 12 && R() < 0.4 && shopIdx < SHOPS.length) {
      const txt = SHOPS[shopIdx++];
      const sw = Math.min(F.len * 0.7, 12);
      const sx = F.fx + F.nx * 0.4, sz = F.fz + F.nz * 0.4;
      const m = addSign(txt, sw, sx, 8.8, sz, F.ry, { bg: pick(['#3a1840', '#14303a', '#4a1e10', '#1d1d40']), fg: pick(['#ffd36b', '#7ff6ff', '#ff8fd0']), border: '#ffd36b' });
      void m; void tx; void tz;
    }
  }

  // ---------- 通用街区 ----------
  function innerOf(bl) {
    return {
      x0: bl.x0 === rect.x0 ? 349 : bl.x0 + SIDEWALK_W + 1.5,
      x1: bl.x1 === rect.x1 ? rect.x1 - 40 : bl.x1 - SIDEWALK_W - 1.5,
      z0: bl.z0 === rect.z0 ? rect.z0 + 38 : bl.z0 + SIDEWALK_W + 1.5,
      z1: bl.z1 === rect.z1 ? rect.z1 - 30 : bl.z1 - SIDEWALK_W - 1.5,
    };
  }
  function courtyard(x0, x1, z0, z1) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    b.box(w - 1, 0.06, d - 1, cx, 0, cz, 0xe9d5ae, { shadow: false });
    // 地砖花纹
    b.box(w * 0.6, 0.07, 1.2, cx, 0, cz, 0xc98a4b, { shadow: false });
    b.box(1.2, 0.07, d * 0.6, cx, 0, cz, 0xc98a4b, { shadow: false });
    if (R() < 0.5 && Math.min(w, d) > 18 && free(cx, cz, 5)) fountain(cx, cz, 3.5, { jet: 2 });
    else if (Math.min(w, d) > 16) sunShade(cx, cz, Math.min(w * 0.55, 16), Math.min(d * 0.4, 10), 4.5, pick([0xf5ede0, 0xe8a23a, 0x2a7f8f]), R() < 0.5 ? 0 : PI / 2);
    for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const px = cx + ax * (w / 2 - 3), pz = cz + az * (d / 2 - 3);
      if (free(px, pz, 1)) palm(px, pz);
    }
  }

  function genericBlock(bl, excl) {
    const I = innerOf(bl);
    const W = I.x1 - I.x0, Dd = I.z1 - I.z0;
    if (W < 8 || Dd < 8) return;
    const nx = Math.max(1, Math.round(W / 30)), nz = Math.max(1, Math.round(Dd / 30));
    const lw = W / nx, ld = Dd / nz;
    const roadW = bl.x0 > rect.x0, roadE = bl.x1 < rect.x1, roadN = bl.z0 > rect.z0, roadS = bl.z1 < rect.z1;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x0 = I.x0 + i * lw, x1 = x0 + lw, z0 = I.z0 + j * ld, z1 = z0 + ld;
      if (excl && x1 > excl.x0 && x0 < excl.x1 && z1 > excl.z0 && z0 < excl.z1) continue;
      const sides = [];
      if (j === 0 && roadN) sides.push('N');
      if (j === nz - 1 && roadS) sides.push('S');
      if (i === 0 && roadW) sides.push('W');
      if (i === nx - 1 && roadE) sides.push('E');
      const edge = i === 0 || j === 0 || i === nx - 1 || j === nz - 1;
      if (!edge && R() < 0.6) { courtyard(x0, x1, z0, z1); continue; }
      if (edge && sides.length && R() < 0.08) { courtyard(x0, x1, z0, z1); continue; }
      const g = 1.2 + R() * 2.2;
      const w = lw - 2 * g, d = ld - 2 * g;
      const h = 7 + 34 * Math.pow(R(), 2.6);   // 低矮沙岩建筑为主，偶有高塔（参考电影：撒哈拉以圆顶、拱廊为主）
      building((x0 + x1) / 2, (z0 + z1) / 2, w, d, h, sides.length ? pick(sides) : null);
      // 路边棕榈
      for (const sd of sides) {
        if (R() < 0.5) continue;
        const F = faceInfo(sd, (x0 + x1) / 2, (z0 + z1) / 2, lw, ld);
        const tx = -F.nz, tz = F.nx;
        for (const a of [-F.len / 2 + 1.5, F.len / 2 - 1.5]) {
          const px = F.fx + tx * a + F.nx * 1.0, pz = F.fz + tz * a + F.nz * 1.0;
          if (free(px, pz, 1)) palm(px, pz, rr(6, 9));
        }
      }
    }
  }

  // ---------- 沙丘 ----------
  function duneStrip(x0, x1, z0, z1, n, axis) {
    let placed = 0, tries = 0;
    while (placed < n && tries++ < n * 6) {
      const x = rr(x0, x1), z = rr(z0, z1);
      const sx = axis === 'x' ? rr(10, 22) : rr(6, (x1 - x0) * 0.5);
      const sz = axis === 'x' ? rr(6, Math.min(16, (z1 - z0) * 0.6)) : rr(10, 22);
      const sy = rr(2.5, 7);
      if (axis === 'x' && nearRX(x, HW + SIDEWALK_W + sx)) continue;
      if (axis === 'z' && nearRZ(z, HW + SIDEWALK_W + sz)) continue;
      b.sphere(1, x, 0, z, pick([0xe8c890, 0xdfba7c, 0xedd3a0, 0xd9b072]), { seg: 12, sx, sy, sz });
      // 沙丘是可以爬上去的平缓沙堆：中心区域用可站立碰撞体，外沿低矮
      col.circle(x, z, Math.min(sx, sz) * 0.55, { yMax: sy * 0.8, walkable: true });
      placed++;
    }
  }
  duneStrip(349, rect.x1, rect.z0, rect.z0 + 22, 26, 'x');
  duneStrip(rect.x1 - 36, rect.x1, rect.z0, rect.z1, 26, 'z');
  duneStrip(349, rect.x1 - 30, rect.z1 - 26, rect.z1, 20, 'x');
  // 沙丘间散落的仙人掌
  for (let k = 0; k < 40; k++) {
    const onNorth = k % 2 === 0;
    const x = onNorth ? rr(360, 940) : rr(915, 945), z = onNorth ? rr(rect.z0 + 2, rect.z0 + 30) : rr(rect.z0, rect.z1);
    if (nearRX(x, HW + SIDEWALK_W + 2) || nearRZ(z, HW + SIDEWALK_W + 2)) continue;
    const h = rr(1.5, 3.5);
    b.cyl(0.3, 0.35, h, x, 0, z, 0x5f8f4a, { seg: 8, mat: 'leaf' });
    b.cyl(0.2, 0.2, h * 0.35, x + 0.5, h * 0.4, z, 0x5f8f4a, { seg: 8, mat: 'leaf' });
    col.circle(x, z, 0.5, { yMax: h });
  }

  // ---------- 气候墙（西边界） ----------
  {
    const WX = 337.5, WW = 15, WH = 34;
    const WALLC = 0xc7a77a, BAND = 0x8d7a62;
    // 每条东西向道路都在墙上开门洞（不再有断头路）
    const GATES = [0, ...D.roadsZ.filter(z => z !== 0)].sort((a, b2) => a - b2);
    const segs = [];
    let zz = rect.z0;
    for (const g of GATES) { if (g - 10 > zz) segs.push([zz, g - 10]); zz = g + 10; }
    if (rect.z1 > zz) segs.push([zz, rect.z1]);
    for (const [z0, z1] of segs) {
      const zc = (z0 + z1) / 2, L = z1 - z0;
      if (L < 2) continue;
      b.box(WW, WH, L, WX, 0, zc, WALLC);
      for (const y of [8, 18, 28]) b.box(WW + 0.8, 0.8, L, WX, y, zc, BAND, { mat: 'metal' });
      for (let z = z0 + 3; z < z1 - 2; z += 6) {
        b.box(2.2, 1.6, 3, WX - WW / 2 + 1.1, WH, z, WALLC);
        b.box(2.2, 1.6, 3, WX + WW / 2 - 1.1, WH, z, WALLC);
      }
      for (let z = z0 + 12; z < z1 - 8; z += 20) {
        b.box(0.3, 1.4, 5, WX + WW / 2 + 0.15, 4, z, 0xff7a2a, { mat: 'glow' });
        b.box(0.3, 1.4, 5, WX - WW / 2 - 0.15, 4, z, 0xff7a2a, { mat: 'glow' });
        b.box(0.5, 2.4, 6, WX + WW / 2 + 0.2, 3.5, z, 0x5a4a3a, { mat: 'metal' });
      }
      col.box(WX, zc, WW, L, { yMax: WH + 2 });
    }
    // 门洞：两侧门柱饰带 + 顶梁
    for (const gz of GATES) {
      for (const s of [-1, 1]) {
        b.box(WW + 2, WH + 6, 4, WX, 0, gz + s * 12, 0xb8926a);
        b.box(0.3, 12, 0.3, WX + WW / 2 + 1.15, 0.5, gz + s * 10.3, 0xffb347, { mat: 'glow' });
        b.box(0.3, 12, 0.3, WX - WW / 2 - 1.15, 0.5, gz + s * 10.3, 0xffb347, { mat: 'glow' });
        col.box(WX, gz + s * 12, WW + 2, 4, { yMax: WH + 6 });
      }
      b.box(WW + 2, 6, 20, WX, 14, gz, 0xb8926a);
      b.box(WW + 2.4, 0.4, 20.4, WX, 14, gz, 0xffb347, { mat: 'glow' });
      col.box(WX, gz, WW + 2, 20, { yMin: 14, yMax: 20 });
    }
    addSign('撒哈拉广场  SAHARA SQUARE', 18, WX + WW / 2 + 1.1, 17, 0, PI / 2, { bg: '#5a2a10', fg: '#ffd36b', border: '#ffb347', w: 1024, h: 160 });
    addSign('撒哈拉广场  SAHARA SQUARE', 18, WX - WW / 2 - 1.1, 17, 0, -PI / 2, { bg: '#5a2a10', fg: '#ffd36b', border: '#ffb347', w: 1024, h: 160 });

    // 热排气塔
    const fanGeo = new THREE.BoxGeometry(5.6, 0.25, 1.2).translate(2.8, 0, 0);
    const hubGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.8, 10);
    const fanMat = new THREE.MeshStandardMaterial({ color: 0x5a4c3e, metalness: 0.8, roughness: 0.35 });
    for (const tz of [-420, -330, -240, -150, -75, -24, 24, 90, 170, 245]) {
      const r = 6.5, H = 58;
      b.cyl(r, r + 0.6, H, WX, 0, tz, 0xb08d62, { seg: 12, mat: 'metal' });
      b.cyl(r + 0.8, r + 0.8, 1.5, WX, 0, tz, 0x8d7a62, { seg: 12 });
      for (const y of [20, 32, 44]) {
        b.cyl(r + 0.25, r + 0.25, 0.9, WX, y, tz, 0xff7a2a, { seg: 12, mat: 'glow' });
        b.cyl(r + 0.4, r + 0.4, 0.3, WX, y + 1.1, tz, 0x6a5844, { seg: 12, mat: 'metal' });
      }
      b.cyl(r + 1.2, r, 3, WX, H, tz, 0x8d7a62, { seg: 12, mat: 'metal' });
      b.cyl(r, r, 0.2, WX, H + 0.4, tz, 0xff5a1a, { seg: 12, mat: 'glow' });
      col.circle(WX, tz, r + 0.6, { yMax: H + 3 });
      const fan = new THREE.Group();
      for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(fanGeo, fanMat); m.rotation.y = k * PI / 2; m.rotation.x = 0.25; fan.add(m); }
      fan.add(new THREE.Mesh(hubGeo, fanMat));
      fan.position.set(WX, H + 2, tz);
      const sp = 1.5 + R();
      if (addAnim((dt) => { fan.rotation.y += dt * sp; })) scene.add(fan);
    }
    ctx.addLabel(WX, 40, 0, '气候墙 · 撒哈拉门', D.color);
  }

  // ---------- 棕榈宫殿酒店 ----------
  {
    const L = LANDMARKS.palmHotel; // 区块 x 567..693, z -193..-7
    const HX = 630, HZ = -110;
    // 前庭铺装
    b.box(110, 0.05, 40, HX, 0, -31, 0xf1e2c2, { shadow: false });
    b.box(6, 0.07, 44, HX, 0, -36, 0xa8242a, { shadow: false }); // 红毯
    for (let z = -55; z <= -16; z += 6) {
      b.box(110, 0.06, 0.4, HX, 0, z, 0xd9b072, { shadow: false });
    }
    // 裙楼
    const PW = 90, PD = 88, PH = 14, PZ = -106; // z -150..-62
    b.box(PW, PH, PD, HX, 0, PZ, 0xe6c27a, { mat: 'facadeBig' });
    b.box(PW + 1.2, 1, PD + 1.2, HX, PH - 1, PZ, GOLD, { mat: 'metal' });
    b.box(PW + 0.6, 1.2, PD + 0.6, HX, 0, PZ, 0xb8926a);
    col.box(HX, PZ, PW + 0.6, PD + 0.6, { yMax: PH });
    // 裙楼屋顶两座圆顶亭
    for (const s of [-1, 1]) {
      const px = HX + s * 34, pz = -76;
      b.cyl(6, 6, 4, px, PH, pz, 0xf3e6c8, { seg: 12 });
      b.sphere(6, px, PH + 4, pz, GOLD, { seg: 12, sy: 1.1, mat: 'metal' });
      b.cone(0.4, 4, px, PH + 10.4, pz, GOLD, { seg: 8, mat: 'metal' });
    }
    // 门廊（可站立平台 + 金柱 + 顶板）
    b.box(48, 0.4, 13, HX, 0, -56.5, 0xf3e6c8);
    col.box(HX, -56.5, 48, 13, { yMax: 0.4, walkable: true });
    for (let k = 0; k < 6; k++) {
      const x = HX - 21 + k * 8.4;
      b.cyl(1.0, 1.2, 11.6, x, 0.4, -51.5, GOLD, { seg: 10, mat: 'metal' });
      b.box(2.8, 0.8, 2.8, x, 0.4, -51.5, 0xf3e6c8);
      col.circle(x, -51.5, 1.3, { yMax: 12 });
    }
    b.box(50, 1.6, 15, HX, 12, -56.5, 0xf3e6c8);
    b.box(50.4, 0.35, 15.4, HX, 13.6, -56.5, 0xffcf6b, { mat: 'glow' });
    // 金色玻璃大门
    b.box(16, 9, 0.6, HX, 0.4, -62, 0xe0b040, { mat: 'glass' });
    b.box(3.6, 9, 0.8, HX, 0.4, -62, 0x4a2a10);
    addSign('棕榈宫殿酒店  PALM HOTEL', 30, HX, 16.2, -49.6, 0, { bg: '#2a1406', fg: '#ffd36b', border: '#ffcf6b', w: 1024, h: 128 });

    // 主塔（"树干"）
    const TB = PH, TH = 130, TR0 = 13, TR1 = 9.5;
    b.cyl(TR1, TR0, TH, HX, TB, HZ, 0xd9a93a, { seg: 12, mat: 'glass' });
    for (let y = 16; y < TH; y += 16) {
      const rr0 = TR0 - (TR0 - TR1) * (y / TH) + 0.25;
      b.cyl(rr0, rr0, 0.6, HX, TB + y, HZ, 0xffcf6b, { seg: 12, mat: 'glow' });
    }
    // 竖向金色肋
    for (let k = 0; k < 6; k++) {
      const a = k * PI / 3;
      const r = (TR0 + TR1) / 2 + 0.3;
      b.box(0.8, TH, 0.8, HX + Math.cos(a) * r, TB, HZ + Math.sin(a) * r, GOLD, { mat: 'metal', ry: -a, rz: 0 });
    }
    // 树冠：椰子簇 + 扇形玻璃叶片
    const CY = TB + TH;
    b.cyl(TR1 + 1.5, TR1, 4, HX, CY, HZ, GOLD, { seg: 12, mat: 'metal' });
    for (let k = 0; k < 5; k++) {
      const a = k * PI * 2 / 5;
      b.sphere(3.2, HX + Math.cos(a) * 4.5, CY + 3, HZ + Math.sin(a) * 4.5, 0xc08a20, { seg: 10, mat: 'metal' });
    }
    const NB = 11;
    for (let k = 0; k < NB; k++) {
      const th = k * PI * 2 / NB;
      let sx = HX + Math.sin(th) * 3, sy = CY + 5, sz = HZ + Math.cos(th) * 3;
      const segs = [[-0.75, 12, 6], [-0.25, 12, 7], [0.25, 11, 6], [0.75, 9, 4]];
      for (const [a, len, w] of segs) {
        const dx = Math.sin(th) * Math.cos(a), dy = -Math.sin(a), dz = Math.cos(th) * Math.cos(a);
        b.box(w, 0.9, len, sx + dx * len / 2, sy + dy * len / 2, sz + dz * len / 2, 0xe6b84a, { mat: 'glass', rx: a, ry: th });
        b.box(0.4, 1.0, len, sx + dx * len / 2, sy + dy * len / 2 + 0.05, sz + dz * len / 2, 0xffcf6b, { mat: 'glow', rx: a, ry: th });
        sx += dx * len; sy += dy * len; sz += dz * len;
      }
    }
    b.cone(1.2, 16, HX, CY + 8, HZ, GOLD, { seg: 10, mat: 'metal' });
    b.sphere(0.9, HX, CY + 24.5, HZ, 0xff4040, { seg: 8, mat: 'glow' });

    // 旋转招牌
    {
      const g = new THREE.Group();
      g.position.set(HX, TB + 112, HZ);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(11.4, 11.4, 4.6, 16, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x3a2008, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }));
      g.add(ring);
      const opts = { bg: '#2a1406', fg: '#ffd36b', border: '#ffcf6b', w: 512, h: 128 };
      for (const [z, ry] of [[11.6, 0], [-11.6, PI]]) {
        if (signCount >= 28) break;
        const m = tex.signMesh('PALM HOTEL', 15, opts);
        m.position.set(0, 0, z); m.rotation.y = ry; g.add(m); signCount++;
      }
      if (addAnim((dt) => { g.rotation.y += dt * 0.35; })) scene.add(g);
    }

    // 前庭喷泉
    for (const s of [-1, 1]) {
      const fx = HX + s * 30, fz = -32;
      b.cyl(6, 6.3, 0.9, fx, 0, fz, 0xf3e6c8, { seg: 12 });
      b.cyl(5.6, 5.6, 0.05, fx, 0.8, fz, 0x3fb7cf, { seg: 12, mat: 'water' });
      b.cyl(1, 1.4, 2.6, fx, 0.6, fz, GOLD, { seg: 10, mat: 'metal' });
      b.cyl(2.8, 1.2, 0.6, fx, 3.2, fz, GOLD, { seg: 12, mat: 'metal' });
      b.cyl(2.5, 2.5, 0.05, fx, 3.75, fz, 0x3fb7cf, { seg: 12, mat: 'water' });
      for (let k = 0; k < 8; k++) {
        const a = k * PI / 4;
        b.sphere(0.25, fx + Math.cos(a) * 6.1, 1.0, fz + Math.sin(a) * 6.1, 0xffd36b, { seg: 8, mat: 'glow' });
      }
      col.circle(fx, fz, 6.4, { yMax: 1.3 });
      waterJet(fx, 3.8, fz, 5, 2.2);
    }
    // 棕榈大道
    for (let z = -58; z >= -186; z -= 14) { palm(578, z, rr(10, 13)); palm(682, z, rr(10, 13)); }
    for (const x of [580, 597, 663, 680]) palm(x, -48, rr(10, 13));
    // 后院泳池
    const pz = -172;
    b.box(64, 0.5, 18, HX, 0, pz, 0xf3e6c8);
    b.box(60, 0.05, 14, HX, 0.45, pz, 0x2fb8d8, { mat: 'water' });
    col.box(HX, pz, 64, 18, { yMax: 0.6 });
    for (let x = HX - 26; x <= HX + 26; x += 6.5) {
      lounger(x, -158, 0);
      if (Math.round((x - HX) / 6.5) % 2 === 0) umbrella(x + 2.5, -158.5, pick(AWN), 1.8);
    }
    ctx.addLabel(HX, CY + 30, HZ, L.name, D.color);
  }

  // ---------- 绿洲沙浴水疗 ----------
  {
    const L = LANDMARKS.oasisSpa; // 区块 x 707..833, z 7..143
    const SX = 770;
    const WALLC = 0xe0b77a;
    // 地面铺装
    b.box(116, 0.05, 116, SX, 0, 78, 0xefdcb4, { shadow: false });
    // 围墙（大门处留口 758..782）
    const wall = (x0, z0, x1, z1) => {
      const w = Math.max(0.8, x1 - x0), d = Math.max(0.8, z1 - z0);
      b.box(w, 2.6, d, (x0 + x1) / 2, 0, (z0 + z1) / 2, WALLC);
      b.box(w + 0.3, 0.3, d + 0.3, (x0 + x1) / 2, 2.6, (z0 + z1) / 2, 0xf3e6c8);
      col.box((x0 + x1) / 2, (z0 + z1) / 2, w, d, { yMax: 2.9 });
    };
    wall(712, 19.6, 758, 20.4); wall(782, 19.6, 828, 20.4);
    wall(711.6, 20, 712.4, 137); wall(827.6, 20, 828.4, 137);
    wall(712, 136.6, 828, 137.4);
    // 大门
    for (const s of [-1, 1]) {
      const px = SX + s * 10;
      b.box(4, 10, 4, px, 0, 21, 0xd9a066);
      b.sphere(2.2, px, 10, 21, 0x3aa7a3, { seg: 10, mat: 'shiny' });
      b.cone(0.3, 2, px, 12, 21, GOLD, { seg: 8, mat: 'metal' });
      col.box(px, 21, 4, 4, { yMax: 12 });
    }
    b.box(24, 2.2, 3, SX, 8.2, 21, 0xd9a066);
    b.box(24.4, 0.3, 3.4, SX, 10.4, 21, 0x3ff0ff, { mat: 'glow' });
    col.box(SX, 21, 16, 3, { yMin: 8, yMax: 10.5 });
    addSign('绿洲沙浴水疗  OASIS SPA', 14, SX, 9.3, 19.4, PI, { bg: '#0f4a52', fg: '#fff2c8', border: '#3ff0ff', w: 1024, h: 160 });
    addSign('绿洲沙浴水疗  OASIS SPA', 14, SX, 9.3, 22.6, 0, { bg: '#0f4a52', fg: '#fff2c8', border: '#3ff0ff', w: 1024, h: 160 });

    // 泻湖
    const LZ = 62;
    b.cyl(17, 17.6, 0.45, SX, 0, LZ, 0xd8c09a, { seg: 12, sx: 1.6, sz: 1 });
    b.cyl(16, 16, 0.05, SX, 0.42, LZ, 0x2fc7d6, { seg: 12, mat: 'water', sx: 1.6, sz: 1 });
    col.circle(SX - 12, LZ, 15, { yMax: 0.6 });
    col.circle(SX + 12, LZ, 15, { yMax: 0.6 });
    // 湖心岩石 + 瀑布喷泉
    b.sphere(3, SX, 0, LZ, 0xb8926a, { seg: 10, sy: 0.8 });
    b.sphere(1.8, SX + 1.5, 1.5, LZ - 1, 0xa8805a, { seg: 10 });
    palm(SX - 1.5, LZ + 1, 9, { noCol: true });
    waterJet(SX + 1.5, 3.2, LZ - 1, 3.5, 1.6);
    // 泳池边躺椅与遮阳伞
    for (let x = 744; x <= 796; x += 8.6) {
      lounger(x, 42, PI);
      if (free(x, 42, 1)) umbrella(x + 3, 41.5, pick(AWN), 1.8);
      lounger(x, 82, 0);
    }
    // 凉亭（cabanas）
    for (const cx of [722, 818]) for (const cz of [48, 74]) {
      for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.cyl(0.15, 0.15, 3.2, cx + ax * 2.7, 0, cz + az * 2.7, 0xf3e6c8, { seg: 8 });
      b.box(5.6, 0.5, 5.6, cx, 0, cz, 0xf3e6c8);
      b.box(4.6, 0.4, 3, cx, 0.5, cz, 0xffffff);
      b.cone(4.4, 2.2, cx, 3.2, cz, pick([0xc8372d, 0x2a7f8f, 0xe8a23a]), { seg: 4, ry: PI / 4, mat: 'shiny' });
      const back = cx < SX ? -1 : 1;
      b.box(0.1, 3, 5.4, cx + back * 2.75, 0.2, cz, 0xfdf6ea);
      b.box(5.4, 3, 0.1, cx, 0.2, cz - 2.75, 0xfdf6ea);
      col.box(cx, cz, 5.8, 5.8, { yMax: 4 });
    }
    // 沙浴池
    for (const px of [740, 755, 770, 785, 800]) {
      const pz = 104;
      b.cyl(3.2, 3.3, 0.6, px, 0, pz, 0xb8743f, { seg: 12 });
      b.cyl(2.8, 2.8, 0.05, px, 0.5, pz, 0xc8a066, { seg: 12 });
      b.sphere(1.4, px, 0.5, pz, 0xd2aa6e, { seg: 8, sy: 0.4 });
      b.cyl(0.04, 0.04, 2.6, px + 2.4, 0, pz - 2.4, 0xffffff, { seg: 8 });
      b.cone(1.8, 0.6, px + 2.4, 2.3, pz - 2.4, pick(AWN), { seg: 8, mat: 'shiny' });
      col.circle(px, pz, 3.4, { yMax: 0.8 });
    }
    // 温泉池
    for (const px of [722, 818]) {
      b.cyl(4, 4.2, 0.7, px, 0, 104, 0xf3e6c8, { seg: 12 });
      b.cyl(3.6, 3.6, 0.05, px, 0.62, 104, 0x6fe0e6, { seg: 12, mat: 'water' });
      col.circle(px, 104, 4.3, { yMax: 0.9 });
    }
    // 主楼
    const BZ = 126, BW = 70, BD = 16, BH = 10;
    b.box(BW, BH, BD, SX, 0, BZ, 0xf0d6a8, { mat: 'facade' });
    b.box(BW + 1, 0.7, BD + 1, SX, BH - 0.7, BZ, 0xffffff);
    col.box(SX, BZ, BW, BD, { yMax: BH + 12 });
    const F = faceInfo('N', SX, BZ, BW, BD);
    for (let a = -BW / 2 + 4; a < BW / 2 - 3; a += 6) archAt(F, a, 3.2, 4.2, 0.5, a > -3 && a < 3 ? DARK : 0x5a7a7a);
    for (const [dx, dr, c] of [[0, 8, 0x3aa7a3], [-22, 5, 0xf3ead8], [22, 5, 0xf3ead8]]) {
      b.cyl(dr * 1.05, dr * 1.05, 2, SX + dx, BH, BZ, 0xffffff, { seg: 12 });
      b.sphere(dr, SX + dx, BH + 2, BZ, c, { seg: 12, mat: 'shiny' });
      b.cone(0.3, 2.5, SX + dx, BH + 2 + dr * 0.98, BZ, GOLD, { seg: 8, mat: 'metal' });
    }
    // 棕榈
    for (const [x, z] of [[716, 28], [824, 28], [716, 130], [824, 130], [740, 92], [800, 92], [733, 30], [807, 30], [716, 90], [824, 90]]) if (free(x, z, 1)) palm(x, z);
    ctx.addLabel(SX, 18, 75, L.name, D.color);
  }

  // ---------- 沙丘集市 ----------
  {
    const L = LANDMARKS.bazaar; // 区块 x 427..553, z 7..143
    const BX = 490, PZ = 82;
    b.box(116, 0.05, 124, BX, 0, 76, 0xd9b98a, { shadow: false });
    // 大门
    for (const s of [-1, 1]) {
      const px = BX + s * 10;
      b.box(4, 11, 4, px, 0, 22, 0xc98a4b);
      b.cyl(1.6, 1.6, 3, px, 11, 22, 0xe8c995, { seg: 10 });
      b.sphere(1.6, px, 14, 22, 0xd4a537, { seg: 10, sy: 1.3, mat: 'metal' });
      col.box(px, 22, 4, 4, { yMax: 16 });
    }
    b.box(24, 2.4, 3, BX, 8.6, 22, 0xc98a4b);
    b.box(24.4, 0.3, 3.4, BX, 11, 22, 0xff3fa4, { mat: 'glow' });
    col.box(BX, 22, 16, 3, { yMin: 8.5, yMax: 11 });
    addSign('沙丘集市  DUNE BAZAAR', 14, BX, 9.8, 20.4, PI, { bg: '#5a1a30', fg: '#ffe08a', border: '#ff3fa4', w: 1024, h: 160 });
    // 后侧拱廊商楼
    {
      const bz = 134, bw = 112, bd = 8, bh = 9;
      b.box(bw, bh, bd, BX, 0, bz, 0xd9a066, { mat: 'facade' });
      b.box(bw + 0.8, 0.6, bd + 0.8, BX, bh - 0.6, bz, 0xf3e6c8);
      col.box(BX, bz, bw, bd, { yMax: bh + 6 });
      const F = faceInfo('N', BX, bz, bw, bd);
      for (let a = -bw / 2 + 3; a < bw / 2 - 2; a += 5) archAt(F, a, 3, 3.6, 0.5, DARK);
      for (const dx of [-40, 0, 40]) {
        b.sphere(4, BX + dx, bh, bz, pick(DOME), { seg: 12, mat: 'shiny' });
        b.cone(0.3, 2, BX + dx, bh + 3.9, bz, GOLD, { seg: 8, mat: 'metal' });
      }
    }
    // 摊位
    const STRIPES = [[0xc8372d, 0xf8efe0], [0x2a7f8f, 0xf2e2c0], [0xe8a23a, 0x7a3b8f], [0x2f6fb5, 0xf8efe0], [0x3f8a3a, 0xf2d06b], [0xd9573a, 0xf8efe0]];
    const RUGS = [0xa8242a, 0x2a4f8f, 0x7a3b8f, 0xd98a2a, 0x1f6f5f];
    const xs = [440, 452, 464, 476, 504, 516, 528, 540];
    let row = 0;
    for (let z = 36; z <= 120; z += 14, row++) {
      const facing = row % 2 === 0 ? 1 : -1; // 柜台朝向
      for (const x of xs) {
        if (Math.abs(z - PZ) < 14 && Math.abs(x - BX) < 30) continue;
        const [c1, c2] = pick(STRIPES);
        for (const [ax, az] of [[-2.9, -2.4], [2.9, -2.4], [-2.9, 2.4], [2.9, 2.4]]) b.cyl(0.08, 0.08, 3.2, x + ax, 0, z + az, 0x6a4a2a, { seg: 8 });
        for (let k = 0; k < 5; k++) b.box(1.28, 0.06, 5.6, x - 2.56 + k * 1.28, 3.15, z, k % 2 ? c2 : c1, { rx: facing * 0.12 });
        b.box(6.4, 0.25, 0.2, x, 2.8, z + facing * 2.85, c1); // 垂边
        b.box(5.4, 1.0, 1.2, x, 0, z + facing * 1.8, 0x8b6b46);
        b.box(5.6, 0.1, 1.4, x, 1.0, z + facing * 1.8, 0xa8805a);
        // 货物：陶罐 / 水果 / 香料
        const kind = R();
        for (let k = 0; k < 3; k++) {
          const gx = x - 1.8 + k * 1.8, gz = z + facing * 1.8;
          if (kind < 0.35) { b.sphere(0.4, gx, 1.45, gz, pick([0xb8743f, 0xa8603a, 0x3aa7a3]), { seg: 8, sy: 1.1 }); b.cyl(0.15, 0.2, 0.3, gx, 1.85, gz, 0xa8603a, { seg: 8 }); }
          else if (kind < 0.7) b.cone(0.45, 0.45, gx, 1.1, gz, pick([0xd9573a, 0xf2c230, 0x8a3a20, 0x6b8f2a]), { seg: 8 });
          else for (let q = 0; q < 3; q++) b.sphere(0.18, gx - 0.3 + q * 0.3, 1.25, gz, pick([0xff8a2a, 0xe03030, 0x9acd32]), { seg: 8 });
        }
        // 背后挂毯
        b.box(2.2, 2.4, 0.06, x - 1.4, 0.4, z - facing * 2.3, pick(RUGS));
        b.box(2.2, 2.4, 0.06, x + 1.4, 0.4, z - facing * 2.3, pick(RUGS));
        // 地毯
        if (R() < 0.5) b.box(3, 0.03, 2, x, 0.05, z + facing * 4, pick(RUGS), { shadow: false });
        // 灯笼
        b.cyl(0.01, 0.01, 0.4, x, 2.55, z + facing * 2.8, 0x333333, { seg: 8 });
        b.sphere(0.3, x, 2.3, z + facing * 2.8, pick([0xffb347, 0xff6a3a, 0xffd36b]), { seg: 8, mat: 'glow', sy: 1.3 });
        col.box(x, z, 6, 5, { yMax: 3.3 });
      }
    }
    // 中央通道灯笼串
    for (let z = 34; z <= 124; z += 14) {
      if (Math.abs(z - PZ) < 10) continue;
      for (const px of [481.5, 498.5]) {
        b.cyl(0.1, 0.12, 6, px, 0, z, 0x5a3a22, { seg: 8 });
        col.circle(px, z, 0.2, { yMax: 6 });
      }
      for (let k = 0; k < 7; k++) {
        const t = k / 6, x = 481.5 + t * 17;
        const y = 5.6 - Math.sin(t * PI) * 0.8;
        b.sphere(0.28, x, y, z, NEON[(k + z) % NEON.length], { seg: 8, mat: 'glow', sy: 1.3 });
      }
      b.box(17, 0.04, 0.04, BX, 5.6, z, 0x333333);
    }
    // 中央广场：喷泉 + 遮阳帆 + 棕榈
    b.box(56, 0.06, 26, BX, 0, PZ, 0xe9d5ae, { shadow: false });
    fountain(BX, PZ, 5.5, { jet: 3, rim: 0x3aa7a3 });
    sunShade(BX - 18, PZ, 10, 8, 5, 0xe8a23a, 0.2);
    sunShade(BX + 18, PZ, 10, 8, 5, 0xc8372d, -0.2);
    for (const [x, z] of [[BX - 26, PZ - 9], [BX + 26, PZ - 9], [BX - 26, PZ + 9], [BX + 26, PZ + 9], [436, 28], [544, 28]]) if (free(x, z, 1)) palm(x, z);
    ctx.addLabel(BX, 16, 75, L.name, D.color);
  }

  // ---------- 普通街区（含日落广场） ----------
  const SUNSET = { x0: 598, x1: 662, z0: -312, z1: -248 };
  for (const bl of blocks) {
    if (bl.landmark) continue;
    const isSunset = bl.cx > SUNSET.x0 && bl.cx < SUNSET.x1 && bl.cz > SUNSET.z0 - 40 && bl.cz < SUNSET.z1 + 40;
    genericBlock(bl, isSunset ? SUNSET : null);
  }
  {
    const cx = 630, cz = -280;
    b.box(116, 0.05, 82, cx, 0, cz, 0xe3cfa4, { shadow: false });
    b.box(64, 0.06, 64, cx, 0, cz, 0xead6ae, { shadow: false });
    for (const z of [-312, -296, -264, -248]) for (const x of [580, 680]) if (free(x, z, 1)) palm(x, z, rr(9, 12));
    for (let k = -28; k <= 28; k += 8) {
      b.box(64, 0.07, 0.5, cx, 0, cz + k, 0xc98a4b, { shadow: false });
      b.box(0.5, 0.07, 64, cx + k, 0, cz, 0xc98a4b, { shadow: false });
    }
    fountain(cx, cz, 6, { jet: 4, rim: 0xe8d2a6 });
    for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) minaret(cx + ax * 28, cz + az * 28, 34, 0xf0d6a8, pick([0x3aa7a3, GOLD]));
    sunShade(cx - 16, cz - 14, 12, 8, 5, 0xf5ede0, 0.3);
    sunShade(cx + 16, cz + 14, 12, 8, 5, 0xe8a23a, 0.3);
    for (const [ax, az] of [[-14, 0], [14, 0], [0, 14], [0, -14]]) {
      const x = cx + ax, z = cz + az;
      if (free(x, z, 1)) palm(x, z, 10);
    }
    // 长椅
    for (const [x, z, ry] of [[cx - 10, cz + 10, 0.8], [cx + 10, cz - 10, 0.8]]) {
      if (!free(x, z, 1.5)) continue;
      b.box(2.4, 0.5, 0.7, x, 0, z, 0x8b6b46, { ry });
      col.box(x, z, 2.4, 0.7, { ry, yMax: 0.9 });
    }
    addSign('日落广场 SUNSET PLAZA', 10, cx, 3.2, cz - 31.6, PI, { bg: '#4a1e10', fg: '#ffd36b', border: '#ffa63f' });
    b.box(10.6, 3, 0.3, cx, 1.6, cz - 31.2, 0xc98a4b);
    col.box(cx, cz - 31.2, 10.6, 0.4, { yMax: 4.6 });
    ctx.addLabel(cx, 40, cz, '日落广场', D.color);
  }

  ctx.addLabel((rect.x0 + rect.x1) / 2, 60, (rect.z0 + rect.z1) / 2, D.name, D.color);
}
