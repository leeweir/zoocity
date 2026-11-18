// 车辆：ZPD 警车（可驾驶）与沿道路行驶的城市车流（不同体型动物的车）
import * as THREE from 'three';
import { allRoads, ROAD_W, districtAt } from '../world/layout.js';
import { sampleLoop, loopLength, DECK_W } from '../world/highway.js';
import { CURVES, sampleCurve } from '../world/curves.js';

import { createCarModel } from './car-model.js';
export { createCarModel };

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
  // 环线高架车流：沿环线按里程行驶，双向各占一条车道
  addLoopCars(n = 24, rand = Math.random) {
    const colors = [0xe94f37, 0x3a7bd5, 0xf6c445, 0xffffff, 0x2c2c34, 0x9b5de5, 0x6bc4d4];
    const L = loopLength(), lane = DECK_W * 0.22;
    for (let i = 0; i < n; i++) {
      const scale = rand() < 0.15 ? 1.6 : rand() < 0.3 ? 0.78 : 1;
      const model = createCarModel({ body: colors[i % colors.length], scale, kind: ['sedan', 'van', 'compact'][i % 3] });
      this.scene.add(model);
      this.cars.push({ model, loop: true, s: rand() * L, dir: rand() < 0.5 ? 1 : -1, speed: 18 + rand() * 10, cur: 0, scale, lane: lane });
    }
  }
  // 弧形大道车流：沿曲线往返
  addCurveCars(perCurve = 4, rand = Math.random) {
    const colors = [0xf6c445, 0x2fb67c, 0xe94f37, 0x3a7bd5, 0xffffff, 0xb08968];
    let i = 0;
    for (const cv of CURVES) for (let k = 0; k < perCurve; k++) {
      const model = createCarModel({ body: colors[i++ % colors.length], scale: rand() < 0.15 ? 1.5 : 1, kind: ['sedan', 'compact', 'van'][i % 3] });
      this.scene.add(model);
      this.cars.push({ model, curve: cv, s: rand() * cv.length, dir: rand() < 0.5 ? 1 : -1, speed: 9 + rand() * 6, cur: 0, scale: 1 });
    }
  }
  update(dt, player, focus) {
    const L = loopLength();
    for (const c of this.cars) {
      if (c.curve) {
        const cv = c.curve;
        const ahead = sampleCurve(cv, c.s + 8 * c.dir);
        const blocked = (player.x - ahead.x) ** 2 + (player.z - ahead.z) ** 2 < 16;
        c.cur += ((blocked ? 0 : c.speed) - c.cur) * Math.min(1, dt * (blocked ? 6 : 1.2));
        c.s += c.cur * c.dir * dt;
        if (c.s > cv.length - 5) { c.s = cv.length - 5; c.dir = -1; }
        if (c.s < 5) { c.s = 5; c.dir = 1; }
        const p = sampleCurve(cv, c.s);
        const lane = 4 * c.dir;
        c.model.position.set(p.x + p.nx * lane, p.y, p.z + p.nz * lane);
        const yaw = Math.atan2(p.tanx * c.dir, p.tanz * c.dir);
        let d = yaw - c.model.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        c.model.rotation.y += d * Math.min(1, dt * 5);
        const far = (p.x - focus.x) ** 2 + (p.z - focus.z) ** 2 > 350 * 350;
        c.model.visible = !far;
        if (!far) for (const w of c.model.userData.wheels) w.children[0].rotation.x += c.cur * dt / 0.42;
        continue;
      }
      if (c.loop) {
        const blocked = false;
        c.cur += ((blocked ? 0 : c.speed) - c.cur) * Math.min(1, dt * 1.5);
        c.s += c.cur * c.dir * dt;
        const p = sampleLoop(c.s);
        const lane = (DECK_W * 0.22) * c.dir;
        c.model.position.set(p.x - p.nx * lane, p.y + 0.02, p.z - p.nz * lane);
        const yaw = Math.atan2(p.tanx * c.dir, p.tanz * c.dir);
        let d = yaw - c.model.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        c.model.rotation.y += d * Math.min(1, dt * 6);
        const far = (c.model.position.x - focus.x) ** 2 + (c.model.position.z - focus.z) ** 2 > 420 * 420;
        c.model.visible = !far;
        if (!far) for (const w of c.model.userData.wheels) w.children[0].rotation.x += c.cur * dt / 0.42;
        continue;
      }
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
