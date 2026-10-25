// 车辆：ZPD 警车（可驾驶）与沿道路行驶的城市车流（不同体型动物的车）
import * as THREE from 'three';
import { allRoads, ROAD_W, districtAt } from '../world/layout.js';

const matCache = new Map();
function mat(color, rough = 0.4, metal = 0.2, emissive) {
  const k = `${color}|${rough}|${metal}|${emissive}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive: emissive || 0x000000, emissiveIntensity: emissive ? 1.5 : 0 }));
  return matCache.get(k);
}
const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; return o; };

// 车模型：车头朝 +z。scale=1 时适合中型动物（长约 4.6m）
export function createCarModel({ body = 0x3a7bd5, scale = 1, police = false, kind = 'sedan' } = {}) {
  const g = new THREE.Group();
  const s = new THREE.Group(); s.scale.setScalar(scale); g.add(s);
  const bm = mat(body, 0.28, 0.35);
  const dark = mat(0x1b1d22, 0.6, 0.1);
  const glass = mat(0x223344, 0.05, 0.9);
  const chrome = mat(0xcfd5dc, 0.2, 1);
  // 车身（下 + 上）
  const L = kind === 'van' ? 5 : kind === 'compact' ? 3.6 : 4.6, W = 2.0;
  s.add(box(W, 0.7, L, bm, 0, 0.75, 0));
  // 前后保险杠
  s.add(box(W + 0.05, 0.25, 0.2, dark, 0, 0.5, L / 2));
  s.add(box(W + 0.05, 0.25, 0.2, dark, 0, 0.5, -L / 2));
  if (kind === 'van') {
    s.add(box(W - 0.05, 1.2, L * 0.75, bm, 0, 1.7, -L * 0.1));
    s.add(box(W - 0.1, 0.7, 0.05, glass, 0, 1.75, L * 0.28));
  } else {
    const cab = box(W - 0.15, 0.62, L * 0.48, glass, 0, 1.4, -L * 0.05);
    s.add(cab);
    s.add(box(W - 0.2, 0.08, L * 0.46, bm, 0, 1.73, -L * 0.05)); // 车顶
  }
  if (police) {
    // 白色车门 + ZPD 黑白配色
    s.add(box(W + 0.02, 0.5, L * 0.42, mat(0xf4f4f4, 0.3, 0.2), 0, 0.82, 0));
    const red = mat(0xff2a2a, 0.3, 0, 0xff2020), blue = mat(0x2a6bff, 0.3, 0, 0x2050ff);
    const lb = new THREE.Group(); lb.position.set(0, 1.8, -L * 0.05);
    const r = box(0.6, 0.18, 0.3, red, -0.35, 0, 0), b = box(0.6, 0.18, 0.3, blue, 0.35, 0, 0);
    lb.add(r, b); s.add(lb);
    g.userData.siren = { r, b, red, blue, off: mat(0x552222, 0.3, 0), offB: mat(0x222255, 0.3, 0) };
    // ZPD 标识
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas'); c.width = 256; c.height = 96;
      const x = c.getContext('2d'); x.fillStyle = '#f4f4f4'; x.fillRect(0, 0, 256, 96);
      x.fillStyle = '#1f2a44'; x.font = 'bold 64px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ZPD', 128, 50);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.MeshBasicMaterial({ map: t });
      for (const sx of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.4), m);
        p.position.set(sx * (W / 2 + 0.02), 0.85, 0); p.rotation.y = sx * Math.PI / 2; s.add(p);
      }
    }
  }
  // 车灯
  const hl = mat(0xfff6d0, 0.2, 0, 0xfff0c0), tl = mat(0xff3030, 0.3, 0, 0xaa0000);
  for (const sx of [-0.7, 0.7]) { s.add(box(0.4, 0.15, 0.05, hl, sx, 0.88, L / 2 + 0.01)); s.add(box(0.35, 0.15, 0.05, tl, sx, 0.88, -L / 2 - 0.01)); }
  s.add(box(0.9, 0.18, 0.05, chrome, 0, 0.7, L / 2 + 0.02)); // 进气格栅
  // 轮子
  const wg = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14).rotateZ(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(0.22, 0.22, 0.32, 10).rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [x, z] of [[-0.95, L * 0.32], [0.95, L * 0.32], [-0.95, -L * 0.32], [0.95, -L * 0.32]]) {
    const w = new THREE.Group(); w.position.set(x, 0.42, z);
    const t = new THREE.Mesh(wg, dark); t.castShadow = true; w.add(t); w.add(new THREE.Mesh(hub, chrome));
    s.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.length = L * scale;
  return g;
}

// 可驾驶车辆
export class Vehicle {
  constructor(scene, model, x, z, yaw) {
    this.model = model; this.pos = new THREE.Vector3(x, 0, z); this.yaw = yaw; this.speed = 0;
    this.siren = false; this.t = 0;
    scene.add(model);
    this.update(0, 0);
  }
  update(dt, steer) {
    this.t += dt;
    this.model.position.copy(this.pos);
    this.model.rotation.y = this.yaw;
    const w = this.model.userData.wheels;
    for (let i = 0; i < w.length; i++) {
      w[i].children[0].rotation.x += this.speed * dt / 0.42;
      if (i < 2) w[i].rotation.y = steer * 0.4;
    }
    const s = this.model.userData.siren;
    if (s) {
      const on = this.siren && (Math.floor(this.t * 6) % 2 === 0);
      s.r.material = this.siren ? (on ? s.red : s.off) : s.off;
      s.b.material = this.siren ? (!on ? s.blue : s.offB) : s.offB;
    }
  }
}

// —— 城市车流 ——
// 车辆沿道路的右侧车道行驶，到达道路端点或随机路口时掉头/转向。简化：每辆车绑定一条道路往返。
export class Traffic {
  constructor(scene, count = 70, rand = Math.random) {
    this.scene = scene;
    this.cars = [];
    const roads = allRoads().filter(r => r.district !== 'connector' && r.district !== 'bunnyburrow');
    const colors = [0xe94f37, 0x3a7bd5, 0xf6c445, 0x2fb67c, 0xffffff, 0x2c2c34, 0x9b5de5, 0xf08a5d, 0x6bc4d4, 0xb08968];
    for (let i = 0; i < count; i++) {
      const r = roads[Math.floor(rand() * roads.length)];
      const kinds = ['sedan', 'compact', 'van'];
      const big = rand();
      const scale = big < 0.12 ? 1.6 : big < 0.22 ? 0.75 : 1; // 大象车 / 小动物车
      const model = createCarModel({ body: colors[i % colors.length], scale, kind: kinds[i % 3] });
      scene.add(model);
      const len = Math.hypot(r.x2 - r.x1, r.z2 - r.z1);
      this.cars.push({ model, road: r, len, s: rand() * len, dir: rand() < 0.5 ? 1 : -1, speed: 9 + rand() * 7, cur: 0, scale });
    }
  }
  update(dt, player, focus) {
    for (const c of this.cars) {
      const r = c.road;
      const dx = (r.x2 - r.x1) / c.len, dz = (r.z2 - r.z1) / c.len;
      // 在前方有玩家则刹车
      const px = r.x1 + dx * c.s, pz = r.z1 + dz * c.s;
      const lane = ROAD_W * 0.22 * c.dir;
      const x = px - dz * lane, z = pz + dx * lane;
      const fx = dx * c.dir, fz = dz * c.dir;
      const tx = player.x - x, tz = player.z - z;
      const ahead = tx * fx + tz * fz, side = Math.abs(-tx * fz + tz * fx);
      const blocked = ahead > 0 && ahead < 9 * c.scale && side < 1.8 * c.scale;
      const target = blocked ? 0 : c.speed;
      c.cur += (target - c.cur) * Math.min(1, dt * (blocked ? 6 : 1.2));
      c.s += c.cur * c.dir * dt;
      if (c.s > c.len - 4) { c.s = c.len - 4; c.dir = -1; }
      if (c.s < 4) { c.s = 4; c.dir = 1; }
      c.model.position.set(x, 0, z);
      const yaw = Math.atan2(fx, fz);
      let d = yaw - c.model.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      c.model.rotation.y += d * Math.min(1, dt * 5);
      // 远处的车隐藏以节省性能
      const far = (x - focus.x) ** 2 + (z - focus.z) ** 2 > 350 * 350;
      c.model.visible = !far;
      if (!far) for (const w of c.model.userData.wheels) w.children[0].rotation.x += c.cur * dt / 0.42;
    }
  }
  // 给玩家的“被车挡住”碰撞：返回需要把点推开的位置
  pushOut(pos, r) {
    for (const c of this.cars) {
      if (!c.model.visible) continue;
      const m = c.model.position;
      const dx = pos.x - m.x, dz = pos.z - m.z;
      if (dx * dx + dz * dz > 30) continue;
      const yaw = c.model.rotation.y, cos = Math.cos(yaw), sin = Math.sin(yaw);
      const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
      const hw = 1.0 * c.scale + r, hl = c.model.userData.length / 2 + r;
      if (Math.abs(lx) < hw && Math.abs(lz) < hl && pos.y < 1.6 * c.scale) {
        const px = hw - Math.abs(lx), pz = hl - Math.abs(lz);
        let nlx = lx, nlz = lz;
        if (px < pz) nlx = Math.sign(lx || 1) * hw; else nlz = Math.sign(lz || 1) * hl;
        pos.x = m.x + nlx * cos + nlz * sin; pos.z = m.z - nlx * sin + nlz * cos;
      }
    }
  }
}
export { districtAt };
