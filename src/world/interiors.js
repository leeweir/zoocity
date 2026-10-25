// 可进入的室内场景：ZPD 第一分局大厅、车管所 DMV、大象冰淇淋店 Jumbeaux's Café、大先生书房。
//
// 室内放在城市之外（x ≥ 3000，地面 y=0），各自有地板/墙/天花板，互不重叠。
// 街上的门口注册交互「进入 …」→ ctx.teleport 到室内出生点；室内门口注册「离开（回到街上）」→ 传送回街上。
//
// 主程序需要提供：
//   ctx.teleport(x, y, z, yaw)      移动玩家 + 伙伴并对齐相机
//   ctx.onEnterInterior(name|null)  进入时传室内名，离开时传 null（用于雾、灯光、音效）
//   ctx.say(speakerName, lines[])   可选：室内 NPC 对话（lines 为字符串数组）
//
// 导出：
//   INTERIORS  [{ key, name, door:{x,z}, exit:{x,z,yaw}, spawn:{x,y,z,yaw}, bounds:{x0,x1,z0,z1} }]
//   interiorAt(x, z) → key | null
//   buildInteriors(ctx) → { interiors: INTERIORS, npcs }
import * as THREE from 'three';
import { createAnimal } from '../chars/animals.js';

const PI = Math.PI;

// ───────── 布局（静态，可在建造前读取） ─────────
// door：街上的交互点（贴近建筑大门，避开案件 NPC）；exit：离开后站的位置（人行道上，背对建筑）
const DEFS = [
  { key: 'zpd', name: 'ZPD 第一分局', ox: 3000, W: 40, D: 34, H: 16, door: { x: 80, z: -70.6 }, exit: { x: 80, z: -66.4, yaw: 0 }, enterLabel: '进入 ZPD 第一分局' },
  { key: 'dmv', name: '车管所 DMV', ox: 3200, W: 36, D: 26, H: 8, door: { x: -160, z: -62.8 }, exit: { x: -160, z: -59.0, yaw: 0 }, enterLabel: '进入 车管所' },
  { key: 'jumbeaux', name: '大象冰淇淋店', ox: 3400, W: 22, D: 16, H: 9, door: { x: 160, z: -59.8 }, exit: { x: 160, z: -56.2, yaw: 0 }, enterLabel: '进入 大象冰淇淋店' },
  { key: 'mrBig', name: '大先生书房', ox: 3600, W: 18, D: 16, H: 7, door: { x: -315, z: -791 }, exit: { x: -315, z: -786.4, yaw: 0 }, enterLabel: '拜访 大先生' },
];

export const INTERIORS = DEFS.map(d => ({
  key: d.key, name: d.name,
  door: { ...d.door }, exit: { ...d.exit },
  spawn: { x: d.ox, y: 0, z: d.D / 2 - 6.5, yaw: PI },            // 面朝北（室内深处）
  inDoor: { x: d.ox, z: d.D / 2 - 1.8 },                            // 室内的出口交互点
  bounds: { x0: d.ox - d.W / 2, x1: d.ox + d.W / 2, z0: -d.D / 2, z1: d.D / 2 },
}));

export function interiorAt(x, z) {
  for (const I of INTERIORS) { const b = I.bounds; if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return I.key; }
  return null;
}

// ───────── 建造 ─────────
export function buildInteriors(ctx) {
  const { b, col, scene, interact } = ctx;
  const tex = ctx.tex;
  const npcs = [];
  const tickers = [];

  const sign = (text, width, opts, x, y, z, ry = 0) => {
    if (!tex?.signMesh) return null;
    const m = tex.signMesh(text, width, opts);
    m.position.set(x, y, z); m.rotation.y = ry;
    scene.add(m);
    return m;
  };
  // 本地偏移按 ry 旋转（与 three 的 rotation.y 一致）
  const rot = (lx, lz, ry) => [lx * Math.cos(ry) + lz * Math.sin(ry), -lx * Math.sin(ry) + lz * Math.cos(ry)];

  // 房间外壳：地板、四面墙（碰撞）、天花板（碰撞，相机不穿顶）、墙裙、踢脚线、灯带、南墙出口门
  function shell(I, def, { floor, wall, wainscot, trim, ceil, lamp = 0xfff6e0, lampStep = 7 }) {
    const { ox, W, D, H } = def;
    const T = 0.6;
    b.box(W + 2 * T, 0.3, D + 2 * T, ox, -0.3, 0, floor, { mat: 'shiny', shadow: false });
    const walls = [
      [ox, -D / 2 - T / 2, W + 2 * T, T], [ox, D / 2 + T / 2, W + 2 * T, T],
      [ox - W / 2 - T / 2, 0, T, D], [ox + W / 2 + T / 2, 0, T, D],
    ];
    for (const [x, z, w, d] of walls) {
      b.box(w, H + 0.5, d, x, -0.1, z, wall, { shadow: false });
      col.box(x, z, w, d, { yMax: H + 1.5 });
    }
    // 墙裙 + 踢脚线 + 顶角线（内侧）
    const inset = 0.06;
    for (const [x, z, w, d] of [[ox, -D / 2 + inset, W, 0.12], [ox, D / 2 - inset, W, 0.12], [ox - W / 2 + inset, 0, 0.12, D], [ox + W / 2 - inset, 0, 0.12, D]]) {
      b.box(w, 1.2, d, x, 0, z, wainscot, { shadow: false });
      b.box(w + 0.02, 0.16, d + 0.04, x, 1.2, z, trim, { shadow: false });
      b.box(w + 0.02, 0.18, d + 0.04, x, 0, z, trim, { shadow: false });
      b.box(w + 0.02, 0.3, d + 0.06, x, H - 0.3, z, trim, { shadow: false });
    }
    // 天花板
    b.box(W + 2 * T, 0.5, D + 2 * T, ox, H, 0, ceil, { shadow: false });
    col.box(ox, 0, W, D, { yMin: H - 0.05, yMax: H + 0.6 });
    // 吸顶灯带
    for (let x = -W / 2 + lampStep / 2; x < W / 2; x += lampStep) for (let z = -D / 2 + lampStep / 2; z < D / 2; z += lampStep) {
      b.box(2.8, 0.08, 0.9, ox + x, H - 0.1, z, lamp, { mat: 'glow', shadow: false });
    }
    // 南墙出口门（视觉）+ EXIT 灯牌
    const dz = D / 2 - 0.08;
    b.box(3.2, 3.6, 0.14, ox, 0, dz, 0x5a3a24, { shadow: false });
    b.box(3.6, 0.3, 0.2, ox, 3.6, dz, trim, { shadow: false });
    b.box(0.08, 0.8, 0.16, ox + 1.2, 1.4, dz - 0.05, 0xd4af37, { mat: 'metal', shadow: false });
    b.box(1.2, 0.4, 0.1, ox, 4.2, dz - 0.05, 0x2fd06a, { mat: 'glow', shadow: false });
    sign('出口 EXIT', 1.1, { bg: '#1f8a4a', fg: '#ffffff', w: 256, h: 96 }, ox, 4.4, dz - 0.12, PI);
    // 出口地垫
    b.box(2.6, 0.02, 1.4, ox, 0, D / 2 - 1.2, 0x7a2e2e, { shadow: false });
  }

  // 家具
  const chair = (x, z, s, color, ry = 0) => {
    b.box(0.52 * s, 0.08 * s, 0.52 * s, x, 0.42 * s, z, color, { ry });
    for (const [lx, lz] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) {
      const [dx, dz] = rot(lx * s, lz * s, ry);
      b.box(0.06 * s, 0.42 * s, 0.06 * s, x + dx, 0, z + dz, 0x3a3f48, { ry, mat: 'metal' });
    }
    const [bx, bz] = rot(0, -0.24 * s, ry);
    b.box(0.52 * s, 0.5 * s, 0.07 * s, x + bx, 0.5 * s, z + bz, color, { ry });
    col.box(x, z, 0.52 * s, 0.52 * s, { ry, yMax: 0.95 * s });
  };
  const table = (x, z, r, h, top, leg) => {
    b.cyl(r, r, 0.08, x, h - 0.08, z, top, { seg: 16, mat: 'shiny' });
    b.cyl(0.08, 0.1, h - 0.08, x, 0, z, leg, { seg: 8, mat: 'metal' });
    b.cyl(r * 0.45, r * 0.5, 0.05, x, 0, z, leg, { seg: 12, mat: 'metal' });
    col.circle(x, z, r, { yMax: h });
  };
  const stool = (x, z, r, h, seat) => {
    b.cyl(r, r, 0.12 * Math.max(0.5, r), x, h - 0.12 * Math.max(0.5, r), z, seat, { seg: 14 });
    b.cyl(r * 0.18, r * 0.18, h, x, 0, z, 0xc9ced4, { seg: 8, mat: 'metal' });
    b.cyl(r * 0.7, r * 0.75, 0.04, x, 0, z, 0xc9ced4, { seg: 12, mat: 'metal' });
    col.circle(x, z, r * 0.9, { yMax: h });
  };
  const bench = (x, z, len, ry, color) => {
    b.box(len, 0.1, 0.55, x, 0.45, z, color, { ry });
    const [bx, bz] = rot(0, -0.26, ry);
    b.box(len, 0.5, 0.08, x + bx, 0.55, z + bz, color, { ry });
    for (const s of [-0.45, 0.45]) { const [dx, dz] = rot(s * len, 0, ry); b.box(0.08, 0.45, 0.5, x + dx, 0, z + dz, 0x3a3f48, { ry, mat: 'metal' }); }
    col.box(x, z, ry ? 0.6 : len, ry ? len : 0.6, { yMax: 1.0 });
  };
  const plant = (x, z, s = 1) => {
    b.cyl(0.32 * s, 0.24 * s, 0.6 * s, x, 0, z, 0xb5653e, { seg: 10 });
    for (let k = 0; k < 4; k++) b.sphere(0.36 * s, x + Math.cos(k * 1.6) * 0.18 * s, 0.85 * s + k * 0.12 * s, z + Math.sin(k * 1.6) * 0.18 * s, 0x3f8a3c, { mat: 'leaf', seg: 7 });
    col.circle(x, z, 0.34 * s, { yMax: 1.4 * s });
  };
  const torus = new THREE.TorusGeometry(1, 0.42, 6, 12);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion().setFromEuler(new THREE.Euler(PI / 2, 0, 0));
  const donut = (x, y, z, r, color) => {
    _m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(r, r, r));
    b.add(torus, _m, 0xd9a15a);
    _m.compose(new THREE.Vector3(x, y + r * 0.22, z), _q, new THREE.Vector3(r * 0.98, r * 0.98, r * 0.7));
    b.add(torus, _m, color);
  };

  // NPC
  const addNPC = (species, x, z, yaw, opts = {}) => {
    const g = createAnimal(species, { detail: 'hi', seed: opts.seed ?? Math.floor(x * 7 + z * 13), outfit: opts.outfit, outfitColor: opts.outfitColor });
    if (opts.scale) g.scale.setScalar(opts.scale);
    const y = opts.y ?? 0;
    g.position.set(x, y, z); g.rotation.y = yaw;
    scene.add(g);
    const n = { g, x, z, y, yaw, pose: opts.pose || 'idle', speed: opts.speed ?? 1, name: opts.name, lookAt: opts.lookAt !== false };
    npcs.push(n);
    const h = (g.userData.height || 1.5) * (opts.scale || 1);
    if (!opts.noCollider) col.circle(x, z, Math.max(0.35, Math.min(1.1, h * 0.22)), { yMin: y, yMax: y + h });
    if (opts.lines) {
      interact.add({
        id: 'interior:' + opts.name, x, z, y: y + h + 0.3, radius: opts.radius ?? Math.max(2.2, h * 0.75), label: `和${opts.name}说话`,
        onInteract: () => {
          const pose0 = n.pose; n.pose = 'talk';
          setTimeout(() => { n.pose = pose0; }, 5000);
          ctx.say?.(opts.name, opts.lines);
        },
      });
    }
    return n;
  };

  // 门：街上进入 + 室内离开
  const doors = (I, def) => {
    const enter = () => {
      ctx.teleport?.(I.spawn.x, I.spawn.y, I.spawn.z, I.spawn.yaw);
      ctx.onEnterInterior?.(def.name);
    };
    const leave = () => {
      const e = def.exit;
      const y = col.groundAt(e.x, e.z, 3);
      ctx.teleport?.(e.x, y, e.z, e.yaw);
      ctx.onEnterInterior?.(null);
    };
    interact.add({ id: 'door:' + def.key, x: def.door.x, z: def.door.z, y: 2.6, radius: 2.0, label: def.enterLabel, onInteract: enter });
    interact.add({ id: 'doorOut:' + def.key, x: I.inDoor.x, z: I.inDoor.z, y: 2.6, radius: 2.2, label: '离开（回到街上）', onInteract: leave });
    // 街上门口：发光地垫，提示可以进门
    const gy = col.groundAt(def.door.x, def.door.z, 3);
    b.box(2.4, 0.02, 1.2, def.door.x, gy + 0.005, def.door.z, 0xffd34d, { mat: 'glow', shadow: false });
  };

  // ═════════════════════ 1. ZPD 第一分局大厅 ═════════════════════
  {
    const def = DEFS[0], I = INTERIORS[0];
    const { ox, W, D, H } = def;
    shell(I, def, { floor: 0xe9e2d0, wall: 0xd9c8a6, wainscot: 0x2c4a8a, trim: 0xf1e6cf, ceil: 0xf4efe4, lampStep: 8 });
    doors(I, def);
    // 地面拼花：环绕前台的蓝色圆环
    b.cyl(7.2, 7.2, 0.012, ox, 0, -2, 0x2c4a8a, { seg: 32, shadow: false });
    b.cyl(6.6, 6.6, 0.016, ox, 0, -2, 0xefe7d6, { seg: 32, shadow: false });
    for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; b.box(0.3, 0.018, 3.4, ox + Math.sin(a) * 9.4, 0, -2 + Math.cos(a) * 9.4, 0x2c4a8a, { ry: a, shadow: false }); }

    // —— 本杰明的圆形前台 ——
    const R = 4, cz = -2, segs = 16;
    for (let i = 0; i < segs; i++) {
      const a = -PI * 0.82 + (i + 0.5) / segs * PI * 1.64;   // 北侧（背后）留出入口
      const x = ox + Math.sin(a) * R, z = cz + Math.cos(a) * R;
      const w = 2 * PI * R / segs * 0.86 * 1.06;
      b.box(w, 1.9, 0.7, x, 0, z, 0xf1e6cf, { ry: a });
      b.box(w * 1.04, 0.12, 1.1, x + Math.sin(a) * 0.12, 1.9, z + Math.cos(a) * 0.12, 0x2c4a8a, { ry: a, mat: 'shiny' });
      b.box(w * 1.01, 0.25, 0.72, x, 0.35, z, 0x2c4a8a, { ry: a });
      col.box(x, z, w, 0.8, { ry: a, yMax: 2.05 });
    }
    sign('ZPD · 前台 RECEPTION', 4.2, { bg: '#2c4a8a', fg: '#ffffff', w: 768, h: 128 }, ox, 1.2, cz + R + 0.37, 0);
    // 甜甜圈盒（粉色）+ 甜甜圈
    b.box(1.1, 0.25, 0.8, ox + 2.2, 2.02, cz + 2.9, 0xf7a8c8, { ry: 0.6 });
    b.box(1.1, 0.04, 0.6, ox + 2.0, 2.4, cz + 2.55, 0xf7a8c8, { ry: 0.6, rx: -0.9 });
    for (const [dx, dz, c] of [[-0.25, -0.12, 0xff8fbf], [0.12, 0.05, 0x7a4a2a], [0.28, -0.2, 0xfff2f6], [-0.1, 0.2, 0xff8fbf]]) donut(ox + 2.2 + dx, 2.3, cz + 2.9 + dz, 0.11, c);
    // 显示器、键盘、电话、ZPD 杯
    for (const s of [-1, 1]) {
      b.box(0.9, 0.6, 0.06, ox + s * 1.3, 2.25, cz + 2.4, 0x1b1f2a, { ry: s * -0.4, mat: 'shiny' });
      b.box(0.86, 0.5, 0.02, ox + s * 1.3, 2.3, cz + 2.44, 0x3f86c6, { ry: s * -0.4, mat: 'glow' });
      b.box(0.1, 0.3, 0.1, ox + s * 1.3, 2.0, cz + 2.35, 0x3a3f48, { mat: 'metal' });
    }
    b.cyl(0.07, 0.07, 0.16, ox - 2.4, 2.02, cz + 2.7, 0xffffff, { seg: 10 });
    // 前台后的大椅子（猎豹尺寸）
    chair(ox, cz + 0.6, 1.7, 0x1f2a44, PI);
    // 前台告示
    sign('本杰明 外出巡逻中\n请勿偷吃甜甜圈', 1.4, { bg: '#fff8ea', fg: '#c0392b', w: 384, h: 192 }, ox - 1.2, 2.25, cz + 3.95, 0);

    // —— 北墙：二层回廊、ZPD 大徽标 ——
    const BZ0 = -D / 2, BZ1 = -D / 2 + 5, BY = 7;
    b.box(W, 0.45, 5, ox, BY - 0.45, (BZ0 + BZ1) / 2, 0xe9e2d0, { mat: 'shiny', shadow: false });
    b.box(W, 0.3, 0.2, ox, BY - 0.75, BZ1, 0x2c4a8a, { shadow: false });
    col.box(ox, (BZ0 + BZ1) / 2, W, 5, { yMin: BY - 0.45, yMax: BY, walkable: true });
    for (let x = -W / 2 + 4; x < W / 2 - 3; x += 8) {
      b.cyl(0.35, 0.4, BY - 0.45, ox + x, 0, BZ1 - 0.4, 0xf1e6cf, { seg: 12 });
      col.circle(ox + x, BZ1 - 0.4, 0.42, { yMax: BY - 0.45 });
    }
    // 楼梯（东墙，南低北高）
    const SX0 = ox + W / 2 - 3.6, SX1 = ox + W / 2 - 0.4, SZ0 = 6, SZ1 = BZ1;
    const steps = 36, run = SZ0 - SZ1;
    for (let k = 0; k < steps; k++) {
      const z0 = SZ0 - k * run / steps, h = (k + 1) * BY / steps;
      b.box(SX1 - SX0, h, run / steps + 0.02, (SX0 + SX1) / 2, 0, z0 - run / steps / 2, k % 2 ? 0xd9cfb8 : 0xe9e2d0, { shadow: false });
    }
    col.ramp(SX0, SZ0, SX1, SZ1, 0, BY, 'z');
    // 楼梯下方：西侧挡板（玩家不能从侧面钻到楼梯底下），坡面本身由 ramp 提供高度
    col.box(SX0 - 0.15, (SZ0 + SZ1) / 2 - 1.5, 0.3, run - 3, { yMax: BY * 0.8 });
    // 楼梯扶手（西侧）
    for (let k = 0; k <= 6; k++) {
      const z = SZ0 - k * run / 6, h = BY * (SZ0 - z) / run;
      b.box(0.08, 1.0, 0.08, SX0 + 0.1, h, z, 0x9aa3ad, { mat: 'metal' });
    }
    {
      const len = Math.hypot(run, BY), mid = [(SX0 + 0.1), BY / 2 + 1.0, (SZ0 + SZ1) / 2];
      b.box(0.1, 0.1, len, mid[0], mid[1], mid[2], 0x9aa3ad, { rx: Math.atan2(BY, run), mat: 'metal' });
    }
    // 回廊栏杆（楼梯口留空）
    const railX1 = SX0 - 0.3;
    b.box(railX1 - (ox - W / 2), 0.12, 0.12, (ox - W / 2 + railX1) / 2, BY + 1.05, BZ1 - 0.1, 0x9aa3ad, { mat: 'metal' });
    b.box(railX1 - (ox - W / 2), 0.9, 0.04, (ox - W / 2 + railX1) / 2, BY + 0.1, BZ1 - 0.1, 0x8fc0dc, { mat: 'glass' });
    col.box((ox - W / 2 + railX1) / 2, BZ1 - 0.1, railX1 - (ox - W / 2), 0.3, { yMin: BY - 0.1, yMax: BY + 1.2 });
    // ZPD 徽标（北墙高处）
    sign('ZPD', 10, { bg: '#2c4a8a', fg: '#ffffff', w: 512, h: 192, font: 'bold 150px "Arial Black",sans-serif' }, ox, BY + 4.6, BZ0 + 0.36, 0);
    b.cyl(1.1, 1.1, 0.2, ox, BY + 7.2, BZ0 + 0.3, 0xf2c14e, { rx: PI / 2, seg: 5, mat: 'glow' });
    sign('动物城警察局 · 第一分局 —— 每一位公民都值得守护', 14, { bg: '#f1e6cf', fg: '#2c4a8a', w: 1536, h: 96 }, ox, BY + 1.8, BZ0 + 0.34, 0);
    // 回廊上：牛局长办公室门
    const bogoX = ox + 6;
    b.box(2.6, 4.2, 0.14, bogoX, BY, BZ0 + 0.1, 0x4a2f1e);
    b.box(3.0, 0.25, 0.2, bogoX, BY + 4.2, BZ0 + 0.12, 0xf1e6cf);
    b.box(0.08, 0.7, 0.16, bogoX + 0.9, BY + 1.6, BZ0 + 0.2, 0xd4af37, { mat: 'metal' });
    sign('局长办公室\nCHIEF BOGO', 1.6, { bg: '#1f2a44', fg: '#f2c14e', w: 384, h: 192 }, bogoX, BY + 3.0, BZ0 + 0.2, 0);
    interact.add({
      id: 'interior:bogoDoor', x: bogoX, z: BZ0 + 1.6, y: BY + 2.5, yBase: BY, radius: 2.0, label: '敲门（局长办公室）',
      onInteract: () => ctx.say?.('牛局长', ['（门后传来低沉的声音）', '“我很忙。没有新案子就别敲我的门。”', '“……还有，谁又把甜甜圈渣掉在我的报告上了？”']),
    });
    // 回廊上的档案柜
    for (let k = 0; k < 4; k++) { b.box(1.0, 1.8, 0.7, ox - 16 + k * 1.1, BY, BZ0 + 0.5, 0x7b828a, { mat: 'metal' }); }
    col.box(ox - 14.35, BZ0 + 0.5, 4.4, 0.8, { yMin: BY - 0.1, yMax: BY + 1.8 });
    // 一层回廊下的门：档案室 / 证物室
    for (const [x, t] of [[ox - 12, '档案室 RECORDS'], [ox - 4, '证物室 EVIDENCE'], [ox + 4, '更衣室 LOCKERS']]) {
      b.box(2.2, 3.2, 0.12, x, 0, BZ0 + 0.08, 0x3a4a6a);
      sign(t, 2.0, { bg: '#f1e6cf', fg: '#2c4a8a', w: 384, h: 80 }, x, 3.55, BZ0 + 0.16, 0);
    }

    // —— 西侧：任务简报区（大象 / 普通 / 迷你椅子） ——
    b.box(1.6, 1.25, 1.0, ox - 17.8, 0, 1, 0x4a2f1e);                     // 讲台
    b.box(1.7, 0.08, 1.1, ox - 17.8, 1.25, 1, 0x2c4a8a, { mat: 'shiny' });
    col.box(ox - 17.8, 1, 1.6, 1.0, { yMax: 1.35 });
    sign('今日任务分配\n· 失踪哺乳动物 14 起\n· 违章停车：200 张罚单\n· 甜甜圈失窃（？）', 6, { bg: '#f8f6ef', fg: '#1f2a44', w: 640, h: 448 }, ox - W / 2 + 0.36, 3.6, 1, PI / 2);
    const rows = [
      [[-14, 1.0], [-14, 2.5], [-14, 1.0]],
      [[-10.5, 2.5], [-10.5, 1.0], [-10.5, 2.5]],
      [[-7, 1.0], [-7, 0.28], [-7, 1.0]],
    ];
    const zs = [-3.5, 1, 5.5];
    rows.forEach(r => r.forEach(([x, s], i) => chair(ox + x, zs[i], s, s > 2 ? 0x6b4f3a : s < 0.5 ? 0xd9534f : 0x2c4a8a, -PI / 2)));

    // —— 南墙：通缉令 / 告示板 ——
    for (const [x, t] of [[-13, '通缉 WANTED\n黄鼠狼公爵\n（盗版碟）'], [-10.4, '寻物启事\n走失的小羊\n名叫“咩咩”'], [10.4, '警员之星\n本月：朱迪·霍普斯'], [13, '安全提示\n过马路请走斑马线\n（斑马说的）']]) {
      b.box(2.4, 2.6, 0.1, ox + x, 2.0, D / 2 - 0.12, 0xb98b5a);
      sign(t, 2.1, { bg: '#f3e6c8', fg: '#5a2a10', w: 320, h: 300 }, ox + x, 3.3, D / 2 - 0.2, PI);
    }
    // 东南：休息区（长椅、自动售货机、饮水机、盆栽）
    bench(ox + 8.5, 9, 4, 0, 0x2c4a8a);
    bench(ox + 8.5, 12.5, 4, PI, 0x2c4a8a);
    b.box(1.4, 2.4, 1.0, ox + 14.5, 0, 14.6, 0xd9534f, { mat: 'shiny' });
    b.box(1.1, 1.4, 0.04, ox + 14.5, 0.7, 14.08, 0xfff1c6, { mat: 'glow' });
    sign('爪爪冰棍 PAWPSICLE', 1.3, { bg: '#d9534f', fg: '#ffffff', w: 384, h: 96 }, ox + 14.5, 2.15, 14.07, PI);
    col.box(ox + 14.5, 14.6, 1.4, 1.0, { yMax: 2.4 });
    b.cyl(0.25, 0.25, 1.0, ox + 12.6, 0, 15.2, 0xe8eef3, { seg: 10 });
    b.cyl(0.2, 0.2, 0.5, ox + 12.6, 1.0, 15.2, 0x8fc0dc, { seg: 10, mat: 'glass' });
    col.circle(ox + 12.6, 15.2, 0.3, { yMax: 1.5 });
    for (const [x, z] of [[-18.5, 15.5], [18.5, 15.5], [-18.5, -10], [-5, 15.5], [5, 15.5]]) plant(ox + x, z, 1.3);
    // 高窗（日光）
    for (let z = -9; z <= 12; z += 7) b.box(0.08, 3.2, 4.4, ox - W / 2 + 0.06, 9.5, z, 0xcfe8ff, { mat: 'glow', shadow: false });

    addNPC('elephant', ox - 16.2, -1.6, PI / 2, { name: '弗朗辛警官', outfit: 'police', pose: 'talk', lines: ['大象从不忘记任何事——包括谁上周拿走了我的花生酱三明治。', '简报会每天早上七点。迟到的话，牛局长会把你分去开罚单。'] });
    addNPC('wolf', ox + 10.5, 10.8, -PI / 2, { name: '狼警官伍尔弗', outfit: 'police', lines: ['嗷——……抱歉，听到售货机的声音就忍不住。', '你知道吗？有人只要嚎一声，全分局的狼都会跟着嚎。千万别试。'] });
  }

  // ═════════════════════ 2. 车管所 DMV ═════════════════════
  {
    const def = DEFS[1], I = INTERIORS[1];
    const { ox, W, D, H } = def;
    shell(I, def, { floor: 0xc9c6bd, wall: 0xd8d4c8, wainscot: 0x8a9a8a, trim: 0xeeeae0, ceil: 0xe6e3da, lamp: 0xf6fff0, lampStep: 6 });
    doors(I, def);
    // 地砖格纹
    for (let x = -W / 2 + 2; x < W / 2; x += 4) b.box(0.06, 0.012, D, ox + x, 0, 0, 0xb5b2a8, { shadow: false });
    // 柜台（北侧，5 个窗口）
    const CZ = -D / 2 + 3.6;
    b.box(30, 1.1, 1.1, ox, 0, CZ, 0x8f8c86, {});
    b.box(30.4, 0.08, 1.4, ox, 1.1, CZ, 0x5f6b6a, { mat: 'shiny' });
    col.box(ox, CZ, 30, 1.2, { yMax: 1.2 });
    b.box(30, 0.08, 0.12, ox, 2.6, CZ + 0.4, 0x5f6b6a);
    for (let k = 0; k < 6; k++) {
      const x = ox - 15 + k * 6;
      b.box(0.1, 1.5, 1.2, x, 1.18, CZ, 0x8fc0dc, { mat: 'glass' });
    }
    const windows = [-12, -6, 0, 6, 12];
    windows.forEach((wx, i) => {
      const open = i >= 1 && i <= 3;
      sign(`窗口 ${i + 1}`, 1.2, { bg: open ? '#2a6fb5' : '#7a7a7a', fg: '#ffffff', w: 256, h: 96 }, ox + wx, 2.95, CZ + 0.47, 0);
      if (!open) sign('暂停服务', 1.0, { bg: '#c0392b', fg: '#ffffff', w: 256, h: 96 }, ox + wx, 1.6, CZ + 0.62, 0);
      // 每个窗口的电脑与盖章
      b.box(0.6, 0.45, 0.05, ox + wx - 0.6, 1.2, CZ - 0.2, 0x1b1f2a, { mat: 'shiny' });
      b.box(0.56, 0.38, 0.02, ox + wx - 0.6, 1.24, CZ - 0.17, 0x6fa86f, { mat: 'glow' });
      b.cyl(0.08, 0.08, 0.15, ox + wx + 0.6, 1.18, CZ + 0.1, 0xc0392b, { seg: 8 });
    });
    // 叫号屏（每 45 秒才跳一个号，非常慢）
    b.box(6.4, 1.4, 0.2, ox, 4.6, -D / 2 + 0.14, 0x111111);
    const numOpts = { bg: '#111111', fg: '#ff4a3a', w: 768, h: 160, font: 'bold 96px "PingFang SC","Microsoft YaHei",monospace' };
    const numSign = sign('当前叫号  A001', 6.0, numOpts, ox, 5.3, -D / 2 + 0.26, 0);
    if (numSign && tex?.sign) {
      let n = 1, acc = 0;
      tickers.push(dt => { acc += dt; if (acc > 45) { acc = 0; n = n % 999 + 1; numSign.material.map = tex.sign(`当前叫号  A${String(n).padStart(3, '0')}`, numOpts); } });
    }
    sign('预计等候时间：∞', 4, { bg: '#eeeae0', fg: '#2a6fb5', w: 640, h: 96 }, ox + 11, 4.8, -D / 2 + 0.2, 0);
    // 挂钟
    b.cyl(0.6, 0.6, 0.1, ox - 11, 4.9, -D / 2 + 0.12, 0xffffff, { rx: PI / 2, seg: 20 });
    b.box(0.05, 0.42, 0.04, ox - 11, 4.9, -D / 2 + 0.2, 0x111111);
    b.box(0.3, 0.05, 0.04, ox - 10.86, 4.9, -D / 2 + 0.2, 0x111111);
    // 树懒职员
    addNPC('sloth', ox - 6, CZ - 1.4, 0, { name: '普莉希拉', outfit: 'suit', outfitColor: 0x8fa9c4, pose: 'talk', speed: 0.22, lines: ['你…………好…………', '…………请…………先…………取…………号…………', '（她慢慢地、慢慢地眨了一下眼睛。）'] });
    addNPC('sloth', ox, CZ - 1.4, 0, { name: '闪电的同事', outfit: 'suit', outfitColor: 0x6a8a9a, pose: 'talk', speed: 0.2, lines: ['…………今天…………的…………号…………', '…………已经…………排到…………', '…………A001…………了…………'] });
    addNPC('sloth', ox + 6, CZ - 1.4, 0, { name: '树懒盖章员', outfit: 'worker', outfitColor: 0x9aa36a, pose: 'idle', speed: 0.18, lines: ['（他举起印章……）', '（…………）', '（……盖了下去。啪。）'] });
    // 排队护栏（蛇形，留通道）
    const QZ = [-5.5, -3.5, -1.5, 0.5];
    QZ.forEach((z, i) => {
      const xa = i % 2 ? -4 : -6, xb = i % 2 ? 10 : 8;
      for (let x = xa; x <= xb; x += 2) b.cyl(0.05, 0.08, 1.0, ox + x, 0, z, 0xc9ced4, { seg: 8, mat: 'metal' });
      b.box(xb - xa, 0.08, 0.04, ox + (xa + xb) / 2, 0.92, z, 0x2a6fb5);
      col.box(ox + (xa + xb) / 2, z, xb - xa, 0.2, { yMax: 1.05 });
    });
    sign('排队请走这边 →', 2.4, { bg: '#2a6fb5', fg: '#ffffff', w: 512, h: 96 }, ox - 7.2, 1.35, 0.56, 0);
    addNPC('camel', ox + 2, -4.5, -PI / 2, { name: '排队的骆驼', outfit: 'casual', lines: ['我已经排了三个小时了。', '我来的时候还是单峰骆驼。'] });
    // 取号机
    b.box(0.7, 1.4, 0.5, ox + 6.5, 0, 9.8, 0x2a6fb5, { mat: 'shiny' });
    b.box(0.4, 0.25, 0.02, ox + 6.5, 1.0, 10.06, 0xfff1c6, { mat: 'glow' });
    sign('取号', 0.6, { bg: '#2a6fb5', fg: '#ffffff', w: 128, h: 64 }, ox + 6.5, 1.55, 10.07, 0);
    col.box(ox + 6.5, 9.8, 0.7, 0.5, { yMax: 1.4 });
    interact.add({ id: 'interior:ticket', x: ox + 6.5, z: 10.9, y: 1.8, radius: 1.4, label: '取号', onInteract: () => ctx.say?.('取号机', ['（吱——）', '您的号码：A847。前面还有 846 位。', '预计等候时间：下个月。']) });
    // 候车椅
    for (let row = 0; row < 3; row++) for (let k = 0; k < 2; k++) bench(ox - 13 + k * 5, 3.5 + row * 2.6, 4, PI, 0x6a8a7a);
    for (const [x, z] of [[-17, 11.8], [17, 11.8], [-17, -6]]) plant(ox + x, z, 1);
    // 宣传海报
    sign('车管所 · 我们的速度\n就是您的耐心', 3.4, { bg: '#f2c230', fg: '#2a2a2a', w: 512, h: 256 }, ox + W / 2 - 0.36, 3.2, 2, -PI / 2);
    for (let z = -8; z <= 8; z += 8) b.box(0.08, 2.4, 3.6, ox - W / 2 + 0.06, 3.2, z, 0xdff3ff, { mat: 'glow', shadow: false });
  }

  // ═════════════════════ 3. 大象冰淇淋店 ═════════════════════
  {
    const def = DEFS[2], I = INTERIORS[2];
    const { ox, W, D, H } = def;
    shell(I, def, { floor: 0xf7e7ef, wall: 0xfde6ee, wainscot: 0xf48fb1, trim: 0xffffff, ceil: 0xfff5f8, lamp: 0xfff6fa, lampStep: 5.5 });
    doors(I, def);
    // 棋盘地砖
    for (let x = -W / 2 + 1; x < W / 2; x += 2) for (let z = -D / 2 + 1; z < D / 2; z += 2) if (((x + z) / 2 | 0) % 2 === 0) b.box(2, 0.01, 2, ox + x, 0, z, 0xffffff, { shadow: false });
    // 柜台（大象尺寸，高 1.6m）+ 玻璃展示柜
    const CZ = -D / 2 + 3.6;
    b.box(15, 1.6, 1.4, ox - 1, 0, CZ, 0xf48fb1);
    b.box(15.4, 0.1, 1.6, ox - 1, 1.6, CZ, 0xffffff, { mat: 'shiny' });
    for (let k = 0; k < 15; k += 1) b.box(0.5, 1.4, 0.04, ox - 8.2 + k, 0.1, CZ + 0.72, k % 2 ? 0xffffff : 0xf8bbd0);
    col.box(ox - 1, CZ, 15, 1.5, { yMax: 1.7 });
    b.box(12, 0.9, 1.0, ox - 1.5, 1.7, CZ + 0.1, 0xdff3ff, { mat: 'glass' });
    const FLAV = [0xfff3c4, 0xf8a5c2, 0x8d5a3b, 0x9be7b0, 0x7ec8f8, 0xffd36b, 0xc39bd3, 0xff8a65, 0xfafafa, 0x6d4c41];
    for (let k = 0; k < 10; k++) {
      const x = ox - 7 + k * 1.2;
      b.cyl(0.45, 0.42, 0.35, x, 1.72, CZ + 0.1, 0xd0d4d8, { seg: 12, mat: 'metal' });
      b.sphere(0.42, x, 2.0, CZ + 0.1, FLAV[k], { seg: 10, sy: 0.5 });
    }
    // 后墙：超大号冰淇淋桶（大象份）
    for (let k = 0; k < 5; k++) {
      const x = ox - 7 + k * 2.6;
      b.cyl(1.0, 0.92, 1.3, x, 0, -D / 2 + 1.1, 0xffffff, { seg: 14 });
      b.cyl(1.02, 1.02, 0.12, x, 0.5, -D / 2 + 1.1, 0xf48fb1, { seg: 14 });
      b.sphere(0.95, x, 1.35, -D / 2 + 1.1, FLAV[(k * 3) % 10], { seg: 12, sy: 0.45 });
      col.circle(x, -D / 2 + 1.1, 1.0, { yMax: 1.8 });
    }
    // 菜单板
    b.box(10, 3.2, 0.12, ox, 4.2, -D / 2 + 0.1, 0x3a2a2a);
    sign('爪爪冰棍 / 大象冰淇淋\n大象份 · 鼩鼱份 · 一切皆有可能', 9.4, { bg: '#3a2a2a', fg: '#ffe0ec', w: 1024, h: 320, font: 'bold 64px "PingFang SC","Microsoft YaHei",sans-serif' }, ox, 5.8, -D / 2 + 0.18, 0);
    sign('本店有权拒绝为任何顾客服务', 3.2, { bg: '#ffffff', fg: '#c0392b', w: 640, h: 80 }, ox + 7.5, 2.4, CZ + 0.76, 0);
    // 收银机
    b.box(0.8, 0.5, 0.6, ox + 5.2, 1.7, CZ, 0x7b828a, { mat: 'metal' });
    b.box(0.5, 0.25, 0.03, ox + 5.2, 2.05, CZ + 0.28, 0x6fe36f, { mat: 'glow' });
    // 大象店员
    addNPC('elephant', ox - 1.5, CZ - 1.6, 0, { name: '大象店员杰瑞', outfit: 'worker', outfitColor: 0xf48fb1, lines: ['你们……要什么口味？', '我们这儿有大象份和鼩鼱份，没有中间尺寸。', '（他用鼻子打了一大勺）上次有只狐狸买了一根超大爪爪冰棍……我到现在都觉得哪里不对。'] });
    // 桌椅：大象凳 / 普通凳 / 迷你凳
    const sets = [[-6.5, 2.5], [5.5, 2.5], [-6.5, -1.2], [5.5, -1.2]];
    sets.forEach(([x, z], i) => {
      table(ox + x, z, 0.85, i % 2 ? 1.1 : 1.6, 0xffffff, 0xf48fb1);
      stool(ox + x - 1.6, z, i % 2 ? 0.35 : 0.85, i % 2 ? 0.7 : 1.3, 0xf8bbd0);
      stool(ox + x + 1.6, z, i === 0 ? 0.12 : 0.35, i === 0 ? 0.22 : 0.7, 0x9be7b0);
    });
    // 角落：巨型甜筒装饰
    b.cone(1.0, 3.4, ox + W / 2 - 1.3, 0, -D / 2 + 1.3, 0xd9a15a, { seg: 12, rx: PI });
    b.cone(1.0, 3.4, ox + W / 2 - 1.3, 3.4, -D / 2 + 1.3, 0xd9a15a, { seg: 12, rx: PI });
    for (const [y, c] of [[3.9, 0xf8a5c2], [4.9, 0xfff3c4], [5.8, 0x8d5a3b]]) b.sphere(1.05, ox + W / 2 - 1.3, y, -D / 2 + 1.3, c, { seg: 12 });
    col.circle(ox + W / 2 - 1.3, -D / 2 + 1.3, 1.1, { yMax: 6.5 });
    // 橱窗（门两侧，外面是"街景"）
    for (const s of [-1, 1]) b.box(5, 3, 0.08, ox + s * 6, 1.2, D / 2 - 0.06, 0xd8f1ff, { mat: 'glow', shadow: false });
    plant(ox - W / 2 + 1, D / 2 - 1.2, 1.1);
  }

  // ═════════════════════ 4. 大先生书房 ═════════════════════
  {
    const def = DEFS[3], I = INTERIORS[3];
    const { ox, W, D, H } = def;
    shell(I, def, { floor: 0x4a2f1e, wall: 0x3a2418, wainscot: 0x24160e, trim: 0xb58a3a, ceil: 0x2a1a12, lamp: 0xffd9a0, lampStep: 6 });
    doors(I, def);
    // 红地毯
    b.box(8, 0.02, 10, ox, 0, -1, 0x8a1a1a, { shadow: false });
    b.box(7.2, 0.025, 9.2, ox, 0, -1, 0xa82424, { shadow: false });
    // 大书桌 + 桌上的迷你扶手椅（大先生的座位）
    const DZ = -3.6, DH = 1.05;
    b.box(4.6, DH, 2.0, ox, 0, DZ, 0x5a3420, {});
    b.box(4.8, 0.08, 2.2, ox, DH, DZ, 0x3a2014, { mat: 'shiny' });
    col.box(ox, DZ, 4.6, 2.0, { yMax: DH + 0.1 });
    // 迷你扶手椅（摆在桌面上）
    b.box(0.2, 0.04, 0.2, ox, DH + 0.08, DZ - 0.1, 0x8a1a1a);
    b.box(0.2, 0.16, 0.03, ox, DH + 0.1, DZ - 0.2, 0x8a1a1a);
    b.cyl(0.12, 0.14, 0.04, ox + 1.4, DH + 0.08, DZ + 0.3, 0xb58a3a, { seg: 10, mat: 'metal' });  // 戒指盒
    b.box(0.5, 0.04, 0.35, ox - 1.3, DH + 0.08, DZ + 0.2, 0xf1e6cf);    // 文件
    // 大先生（鼩鼱，站在桌面上）
    addNPC('shrew', ox, DZ + 0.15, 0, { name: '大先生', outfit: 'suit', outfitColor: 0x1a1a1a, y: DH + 0.08, noCollider: true, radius: 2.4, lines: ['你来我的庄园……却没有带礼物？', '……开玩笑的。你在啮齿镇帮了芙芙，这份情我记着。', '芙芙的婚礼，你们一定要来。迟到的话……我会把你们冰起来。开玩笑的。大概。'] });
    // 北极熊保镖
    addNPC('polarbear', ox + 4.2, DZ - 0.5, -PI / 3, { name: '北极熊保镖雷蒙德', outfit: 'suit', outfitColor: 0x111111, lines: ['……', '（他缓缓地、意味深长地掰了一下指关节。）'] });
    // 壁炉（西墙）+ 跳动的火焰
    const FX = ox - W / 2 + 0.6;
    b.box(1.2, 2.6, 3.2, FX, 0, -1, 0x6a5a4a);
    b.box(1.3, 0.25, 3.6, FX + 0.05, 2.6, -1, 0xb58a3a);
    b.box(0.6, 1.3, 1.8, FX + 0.35, 0.2, -1, 0x111111);
    col.box(FX, -1, 1.2, 3.2, { yMax: 2.9 });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.0, 8), new THREE.MeshBasicMaterial({ color: 0xff8a2a, toneMapped: false }));
    flame.position.set(FX + 0.45, 0.7, -1);
    scene.add(flame);
    tickers.push((dt, t) => { const k = 1 + Math.sin(t * 13) * 0.12 + Math.sin(t * 7.3) * 0.08; flame.scale.set(1, k, 1); });
    b.box(0.08, 1.4, 1.0, FX + 0.08, 3.4, -1, 0xb58a3a);   // 壁炉上方的肖像画框
    sign('芙芙\n（满月照）', 0.9, { bg: '#f3d6e4', fg: '#5a2a10', w: 256, h: 300 }, FX + 0.14, 4.1, -1, PI / 2);
    // 书架（东墙）
    for (let k = 0; k < 3; k++) {
      const z = -5.5 + k * 3.4;
      b.box(0.8, 4.6, 3.0, ox + W / 2 - 0.5, 0, z, 0x3a2014);
      for (let s = 0; s < 5; s++) for (let j = 0; j < 9; j++) b.box(0.5, 0.6 + ((j * 7 + s) % 3) * 0.1, 0.26, ox + W / 2 - 0.7, 0.3 + s * 0.88, z - 1.2 + j * 0.3, [0x8a1a1a, 0x2a4a3a, 0x1f2a44, 0xb58a3a, 0x5a3420][(j + s) % 5]);
      col.box(ox + W / 2 - 0.5, z, 0.8, 3.0, { yMax: 4.6 });
    }
    // 窗外飘雪（北墙）
    for (const s of [-1, 1]) b.box(2.4, 3.2, 0.08, ox + s * 5, 1.6, -D / 2 + 0.06, 0xdfeeff, { mat: 'glow', shadow: false });
    // 吊灯
    b.cyl(0.04, 0.04, 1.2, ox, H - 1.2, -1, 0xb58a3a, { seg: 6 });
    b.sphere(0.7, ox, H - 1.6, -1, 0xffd9a0, { mat: 'glow', seg: 12, sy: 0.6 });
    for (const [x, z] of [[-W / 2 + 1, D / 2 - 1.2], [W / 2 - 1, D / 2 - 1.2]]) plant(ox + x, z, 1.2);
  }

  // 每帧：NPC 动画（玩家在室内附近才更新）、叫号屏、壁炉火焰
  ctx.animate?.((dt, t, pos) => {
    if (pos && pos.x < 2800) return;
    for (const n of npcs) {
      const ud = n.g.userData;
      if (pos && n.lookAt) {
        const dx = pos.x - n.x, dz = pos.z - n.z;
        const yaw = dx * dx + dz * dz < 36 ? Math.atan2(dx, dz) : n.yaw;
        let a = yaw - n.g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
        n.g.rotation.y += a * Math.min(1, dt * 3 * n.speed);
      }
      ud.setPose?.(n.pose);
      ud.update?.(dt * n.speed, 0);
    }
    for (const f of tickers) f(dt, t);
  });

  return { interiors: INTERIORS, npcs };
}
