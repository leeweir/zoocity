// 可骑 / 可开的交通工具（除警车外）：
//  · 自行车：角色真的骑在上面蹬车，慢但灵活，按 Space 打铃
//  · 小摩托（Vespa 风格）：更快，角色坐在上面
//  · 路边停放的各色民用车（「模特车」）：轿车、跑车、甲壳虫、皮卡、冰淇淋车……，上去就能开
// 统一接口与警车 Vehicle 相同：{ pos, yaw, speed, model, update(dt, steer), kind, rider }
import * as THREE from 'three';
import { createCarModel, Vehicle } from './vehicles.js';

const M = new Map();
const mat = (c, r = 0.45, m = 0.2) => { const k = `${c}|${r}|${m}`; if (!M.has(k)) M.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m })); return M.get(k); };
const tube = (a, b, r, material) => {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), material);
  m.position.copy(A.add(B).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.castShadow = true;
  return m;
};
function wheel(R, w, rimCol) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(R, w, 8, 22), mat(0x1c1c1f, 0.8, 0)); tire.rotation.y = Math.PI / 2; tire.castShadow = true; g.add(tire);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.12, R * 0.12, w * 2.4, 10), mat(0xcfd5dc, 0.25, 1)); hub.rotation.z = Math.PI / 2; g.add(hub);
  for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.012, R * 1.9, 0.012), mat(rimCol, 0.3, 0.8)); s.rotation.x = i / 8 * Math.PI; g.add(s); }
  return g;
}

// 自行车：车头朝 +z，座高约 0.62m（适合朱迪/尼克身材）
export function createBikeModel(color = 0xf08a24) {
  const g = new THREE.Group(); const fr = mat(color, 0.35, 0.4), mt = mat(0x9aa3ad, 0.3, 0.9);
  const R = 0.3, wb = 0.95;
  const wf = wheel(R, 0.03, 0xdddddd), wr = wheel(R, 0.03, 0xdddddd);
  wf.position.set(0, R, wb / 2); wr.position.set(0, R, -wb / 2); g.add(wf, wr);
  const crank = [0, 0.32, -0.05], seat = [0, 0.66, -0.22], head = [0, 0.7, 0.33];
  g.add(tube([0, R, -wb / 2], crank, 0.022, fr), tube(crank, seat, 0.024, fr), tube(seat, head, 0.024, fr), tube(crank, head, 0.026, fr));
  g.add(tube([0, R, -wb / 2], seat, 0.018, fr));
  g.add(tube(head, [0, R, wb / 2], 0.02, mt));
  g.add(tube([0, 0.7, 0.33], [0, 0.86, 0.3], 0.018, mt));
  const bar = tube([-0.24, 0.86, 0.3], [0.24, 0.86, 0.3], 0.016, mt); g.add(bar);
  for (const sx of [-0.24, 0.24]) { const gr = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 8), mat(0x222222, 0.8, 0)); gr.rotation.z = Math.PI / 2; gr.position.set(sx, 0.86, 0.3); g.add(gr); }
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.24), mat(0x2a2a2a, 0.7, 0)); saddle.position.set(0, 0.69, -0.24); g.add(saddle);
  // 车筐
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.22), mat(0xc8a25a, 0.8, 0)); basket.position.set(0, 0.86, 0.48); g.add(basket);
  // 脚踏（转动）
  const ped = new THREE.Group(); ped.position.set(0, 0.32, -0.05);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.02), mt); arm.position.set(s * 0.08, s * 0.08, 0); ped.add(arm); const p = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.05), mat(0x222222)); p.position.set(s * 0.12, s * 0.16, 0); ped.add(p); }
  g.add(ped);
  g.userData = { wheels: [wf, wr], pedals: ped, steer: [bar], R, seatY: 0.62, seatZ: -0.24, length: 1.6, kind: 'bike' };
  return g;
}

// 小摩托：Vespa 风格
export function createScooterModel(color = 0x6bc4d4) {
  const g = new THREE.Group(); const body = mat(color, 0.25, 0.3), cr = mat(0xcfd5dc, 0.2, 1);
  const R = 0.26;
  const wf = wheel(R, 0.06, 0x888888), wr = wheel(R, 0.06, 0x888888);
  wf.position.set(0, R, 0.62); wr.position.set(0, R, -0.52); g.add(wf, wr);
  const rear = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), body); rear.scale.set(0.9, 0.75, 1.3); rear.position.set(0, 0.52, -0.42); rear.castShadow = true; g.add(rear);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.6), mat(0x333333, 0.8, 0)); floor.position.set(0, 0.3, 0.12); g.add(floor);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.7, 0.1), body); shield.position.set(0, 0.62, 0.5); shield.rotation.x = -0.2; shield.castShadow = true; g.add(shield);
  const fend = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), body); fend.scale.set(1, 0.6, 1.3); fend.position.set(0, 0.5, 0.62); g.add(fend);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.55), mat(0x5a3a24, 0.7, 0)); seat.position.set(0, 0.8, -0.3); g.add(seat);
  g.add(tube([0, 0.9, 0.5], [0, 1.08, 0.46], 0.025, cr));
  const bar = tube([-0.3, 1.08, 0.46], [0.3, 1.08, 0.46], 0.02, cr); g.add(bar);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xfff0c0, emissiveIntensity: 1.5 })); lamp.position.set(0, 1.0, 0.56); g.add(lamp);
  for (const sx of [-0.3, 0.3]) { const mir = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), cr); mir.position.set(sx * 0.9, 1.25, 0.44); g.add(mir); g.add(tube([sx, 1.08, 0.46], [sx * 0.9, 1.22, 0.44], 0.008, cr)); }
  g.userData = { wheels: [wf, wr], steer: [bar], R, seatY: 0.84, seatZ: -0.32, length: 1.6, kind: 'scooter' };
  return g;
}

// 两轮车：车身随转向侧倾，角色骑在上面（骑车姿势 + 脚蹬）
export class TwoWheeler {
  constructor(scene, model, x, z, yaw, cfg) {
    Object.assign(this, { model, pos: new THREE.Vector3(x, 0, z), yaw, speed: 0, lean: 0, kind: model.userData.kind, cfg });
    this.tilt = new THREE.Group(); this.tilt.add(model);
    this.root = new THREE.Group(); this.root.add(this.tilt); scene.add(this.root);
    this.parkLean = 0.12; // 停放时斜靠脚撑
    this.update(0, 0);
  }
  get name() { return this.kind === 'bike' ? '自行车' : '小摩托'; }
  update(dt, steer) {
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
    const target = this.rider ? THREE.MathUtils.clamp(-steer * Math.min(1, Math.abs(this.speed) / 6) * 0.42, -0.42, 0.42) : this.parkLean;
    this.lean += (target - this.lean) * Math.min(1, dt * 5);
    this.tilt.rotation.z = this.lean;
    const ud = this.model.userData;
    for (const w of ud.wheels) w.rotation.x += this.speed * dt / ud.R;
    if (ud.pedals) ud.pedals.rotation.x += this.speed * dt / ud.R * 0.45;
    for (const s of ud.steer) s.rotation.y = steer * 0.35;
  }
  // 把骑手模型挂到车上
  mount(heroModel) {
    this.rider = heroModel; this.tilt.add(heroModel);
    const ud = this.model.userData;
    // 坐姿时胯部高度 = sitHipY；让胯部正好落在车座上
    heroModel.position.set(0, ud.seatY - (heroModel.userData.sitHipY ?? 0.25), ud.seatZ + 0.05);
    heroModel.rotation.set(0, 0, 0);
    heroModel.userData.setPose?.('sit');
  }
  unmount() { const m = this.rider; this.rider = null; return m; }
}

// 民用车配色/款式（路边停放，可上车开）
const CIVIL = [
  { body: 0xe94f37, kind: 'sedan', name: '红色轿车' },
  { body: 0xf6c445, kind: 'compact', name: '黄色甲壳虫' },
  { body: 0x2fb67c, kind: 'van', name: '绿色面包车' },
  { body: 0x9b5de5, kind: 'sedan', name: '紫色轿车' },
  { body: 0x3a7bd5, kind: 'compact', name: '蓝色小车' },
  { body: 0xffffff, kind: 'van', name: '冰淇淋车' },
  { body: 0xf08a5d, kind: 'sedan', name: '橙色跑车', scale: 0.95 },
  { body: 0x2c2c34, kind: 'sedan', name: '黑色豪车', scale: 1.1 },
  { body: 0x6bc4d4, kind: 'compact', name: '薄荷色小车' },
  { body: 0xb08968, kind: 'van', name: '复古旅行车' },
];

// 在主要街道两旁铺设可用交通工具
export function spawnRides(scene, col, layout, rand = Math.random) {
  const { DISTRICTS, ROAD_W, LANDMARKS } = layout;
  const out = [];
  const curb = ROAD_W / 2 - 1.3;   // 停在最外侧车道
  const ok = (x, z, r) => !col.blocked(x, z, r);
  const add = (v, label) => { v.label = label; out.push(v); };
  // 1) ZPD 门口：一辆自行车 + 一辆小摩托，方便新手
  const zf = LANDMARKS.zpd.front;
  add(new TwoWheeler(scene, createBikeModel(0xf08a24), zf.x - 10, -45.5, Math.PI / 2, { max: 9, accel: 5 }), '自行车');
  add(new TwoWheeler(scene, createScooterModel(0x6bc4d4), zf.x - 14, -45.5, Math.PI / 2, { max: 17, accel: 7 }), '小摩托');
  // 2) 各区沿路停放：每条路若干辆
  const bikeCols = [0xf08a24, 0x2fb67c, 0xe94f37, 0x3a7bd5, 0xf6c445, 0xff88c8];
  for (const [key, D] of Object.entries(DISTRICTS)) {
    if (key === 'rodentia') continue;
    const r = D.rect;
    const roads = [...D.roadsX.map(v => ({ ax: 'x', v, a: r.z0, b: r.z1 })), ...D.roadsZ.map(v => ({ ax: 'z', v, a: r.x0, b: r.x1 }))];
    for (const rd of roads) {
      const len = rd.b - rd.a;
      const n = Math.max(1, Math.round(len / (key === 'savanna' ? 90 : 160)));
      for (let i = 0; i < n; i++) {
        const t = rd.a + (i + 0.3 + rand() * 0.4) * len / n;
        const side = rand() < 0.5 ? -1 : 1;
        const x = rd.ax === 'x' ? rd.v + side * curb : t, z = rd.ax === 'x' ? t : rd.v + side * curb;
        // 避开路口
        if ((rd.ax === 'x' ? D.roadsZ : D.roadsX).some(c => Math.abs((rd.ax === 'x' ? z : x) - c) < ROAD_W + 4)) continue;
        if (!ok(x, z, 1.4)) continue;
        const yaw = rd.ax === 'x' ? (side > 0 ? 0 : Math.PI) : (side > 0 ? -Math.PI / 2 : Math.PI / 2);
        const k = rand();
        if (k < 0.35) add(new TwoWheeler(scene, createBikeModel(bikeCols[Math.floor(rand() * bikeCols.length)]), x, z, yaw, { max: 9, accel: 5 }), '自行车');
        else if (k < 0.55) add(new TwoWheeler(scene, createScooterModel(bikeCols[Math.floor(rand() * bikeCols.length)]), x, z, yaw, { max: 17, accel: 7 }), '小摩托');
        else {
          const c = CIVIL[Math.floor(rand() * CIVIL.length)];
          const v = new Vehicle(scene, createCarModel({ body: c.body, kind: c.kind, scale: c.scale || 1 }), x, z, yaw);
          v.kind = 'car'; v.parked = true;
          add(v, c.name);
        }
      }
    }
  }
  for (const v of out) v.pos.y = col.groundAt(v.pos.x, v.pos.z, 3);
  return out;
}
