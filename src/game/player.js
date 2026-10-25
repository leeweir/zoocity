// 玩家控制：第三人称移动、跳跃、冲刺、竹蜻蜓飞行、角色切换（朱迪 / 尼克）、驾驶警车
import * as THREE from 'three';
import { inCanal, WATER_Y } from '../world/layout.js';

const HEROES = {
  judy: { name: '朱迪·霍普斯', walk: 3.2, run: 8.5, jump: 7.2, radius: 0.32, height: 1.3, camDist: 4.2 },
  nick: { name: '尼克·王尔德', walk: 3.0, run: 7.2, jump: 5.4, radius: 0.36, height: 1.3, camDist: 4.6 },
};

export class Player {
  constructor(scene, col, models) {
    this.scene = scene; this.col = col; this.models = models; // { judy: Group, nick: Group }
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;          // 角色朝向
    this.onGround = true;
    this.current = 'judy';
    this.root = new THREE.Group();
    scene.add(this.root);
    for (const k of Object.keys(models)) { this.root.add(models[k]); models[k].visible = k === this.current; }
    // 跟随伙伴（未操控的那位跟在身后）
    this.buddyPos = new THREE.Vector3();
    this.buddyYaw = 0;
    this.buddy = new THREE.Group(); scene.add(this.buddy);
    this.vehicle = null;
    this.stamina = 1;
    this.frozen = false;
    this.flying = false;
    this.copter = makeCopter();       // 竹蜻蜓：戴在头顶
    this.copter.visible = false;
    this.root.add(this.copter);
    this._swapBuddy();
  }

  get stats() { return HEROES[this.current]; }
  get model() { return this.models[this.current]; }
  get buddyKey() { return this.current === 'judy' ? 'nick' : 'judy'; }

  _swapBuddy() {
    for (const k of Object.keys(this.models)) {
      const m = this.models[k];
      if (k === this.current) { this.root.add(m); } else { this.buddy.add(m); }
      m.visible = true;
      m.position.set(0, 0, 0); m.rotation.set(0, 0, 0);
    }
  }

  setPosition(x, y, z, yaw = 0) {
    this.pos.set(x, y, z); this.yaw = yaw; this.vel.set(0, 0, 0);
    this.buddyPos.set(x - Math.sin(yaw) * 1.6 + 1, y, z - Math.cos(yaw) * 1.6);
  }

  switchHero() {
    if (this.vehicle) return false;
    const p = this.pos.clone(), bp = this.buddyPos.clone(), by = this.buddyYaw;
    this.current = this.buddyKey;
    this._swapBuddy();
    this.buddyPos.copy(p); this.buddyYaw = this.yaw;
    this.pos.copy(bp); this.yaw = by;
    return true;
  }

  update(dt, input, camYaw) {
    if (this.vehicle) return this._updateVehicle(dt, input, camYaw);
    const S = this.stats;
    const mv = this.frozen ? { x: 0, y: 0, mag: 0 } : input.move();
    let mx = mv.x, mz = mv.y;
    const moving = mv.mag > 0.12;
    // 摇杆推到底自动奔跑；轻推慢走
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight') || mv.mag > 0.92 && input.touch;
    let speed = 0;
    if (moving) {
      const l = Math.hypot(mx, mz); mx /= l; mz /= l;
      // 相机坐标 → 世界坐标
      const s = Math.sin(camYaw), c = Math.cos(camYaw);
      const wx = mx * c + mz * s, wz = -mx * s + mz * c;
      const canRun = sprint && this.stamina > 0.05;
      speed = canRun ? S.run : S.walk * (input.touch ? Math.min(1, 0.35 + mv.mag) : 1);
      if (canRun) this.stamina = Math.max(0, this.stamina - dt * 0.12);
      const targetYaw = Math.atan2(wx, wz);
      let d = targetYaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 12);
      if (this.flying) speed = sprint ? 30 : 14;      // 竹蜻蜓：水平飞行速度
      else if (this.swimming) speed = sprint ? 3.6 : 2.2;   // 游泳
      const accel = this.flying ? 3.5 : this.onGround ? 14 : 4;
      this.vel.x += (wx * speed - this.vel.x) * Math.min(1, dt * accel);
      this.vel.z += (wz * speed - this.vel.z) * Math.min(1, dt * accel);
    } else {
      const damp = this.flying ? 2.5 : this.onGround ? 12 : 1;
      this.vel.x -= this.vel.x * Math.min(1, dt * damp);
      this.vel.z -= this.vel.z * Math.min(1, dt * damp);
    }
    if (!sprint || !moving) this.stamina = Math.min(1, this.stamina + dt * 0.18);

    // 竹蜻蜓：G 键（或触屏🚁按钮）开 / 关；也可在空中连按两次跳跃起飞
    if (!this.frozen && input.hit('KeyG')) this.setFlying(!this.flying);
    if (input.hit('Space') && !this.frozen && !this.flying && this.swimming) { this.vel.y = 3.2; }   // 水里按跳：扑腾一下
    else if (input.hit('Space') && !this.frozen && !this.flying) {
      if (this.onGround) { this.vel.y = S.jump; this.onGround = false; this._airJumpT = 0.45; }
      else if (this._airJumpT > 0) this.setFlying(true);
    }
    if (this._airJumpT > 0) this._airJumpT -= dt;
    if (this.flying) {
      // 自由飞行：Space 上升、C/Ctrl 下降，不按则悬停；限高 220m
      let vy = 0;
      if (input.down('Space')) vy += 1;
      if (input.down('KeyC') || input.down('ControlLeft')) vy -= 1;
      const climb = sprint ? 16 : 9;
      this.vel.y += (vy * climb - this.vel.y) * Math.min(1, dt * (vy ? 4 : 9));
      if (this.pos.y > 220 && this.vel.y > 0) this.vel.y = 0;
    } else if (this.swimming) {
      // 浮力：把身体拉回水面（头和肩露出水面）
      const target = WATER_Y - (this.stats.height * 0.55);
      this.vel.y += ((target - this.pos.y) * 6 - this.vel.y * 2.5) * dt * 2 - 4 * dt;
    } else this.vel.y -= 22 * dt;
    this.pos.addScaledVector(this.vel, dt);
    const g = this.col.resolve(this.pos, S.radius, S.height, 0.6);
    if (this.pos.y <= g + 0.001) {
      if (this.pos.y < g - 0.0) this.pos.y = this.onGround ? g : Math.max(this.pos.y, g); // 上台阶
      this.pos.y = g; this.vel.y = Math.max(0, this.vel.y); this.onGround = true;
      // 飞行中向下落到地面时自动收起竹蜻蜓
      if (this.flying && this._landT > 0.25) this.setFlying(false);
      this._landT = (this._landT || 0) + dt;
    } else if (this.onGround && !this.flying && this.pos.y - g < 0.45 && this.vel.y <= 0) {
      this.pos.y = g; // 贴地下台阶
    } else { this.onGround = false; this._landT = 0; }
    if (this.pos.y < -20) { this.pos.y = 5; }
    // 进入运河：水面以下就是游泳；飞行时不算
    const wasSwim = this.swimming;
    this.swimming = !this.flying && !this.vehicle && inCanal(this.pos.x, this.pos.z) && this.pos.y < WATER_Y + 0.2;
    if (this.swimming) { this.onGround = false; this.stamina = Math.min(1, this.stamina); }
    if (this.swimming !== wasSwim) this.onSwimChange?.(this.swimming);

    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    // 竹蜻蜓外观：桨叶旋转，飞行时身体随速度前倾、转向侧倾
    const cop = this.copter;
    cop.visible = this.flying || this._spin > 0.05;
    this._spin = THREE.MathUtils.lerp(this._spin || 0, this.flying ? 1 : 0, Math.min(1, dt * 3));
    cop.userData.blades.rotation.y += dt * 38 * this._spin;
    cop.position.y = (this.model.userData.totalHeight || this.model.userData.height || 1.3) + 0.06;
    if (this.flying) {
      const turn = THREE.MathUtils.clamp(((this._lastYaw ?? this.yaw) - this.yaw) / Math.max(dt, 1e-3) * 0.08, -0.35, 0.35);
      this._bank = THREE.MathUtils.lerp(this._bank || 0, turn, Math.min(1, dt * 4));
      this._pitch = THREE.MathUtils.lerp(this._pitch || 0, Math.min(0.32, hs / 30 * 0.32), Math.min(1, dt * 4));
      this.model.rotation.set(this._pitch, 0, this._bank);
      this.model.position.y = Math.sin(performance.now() * 0.004) * 0.06;   // 悬停轻微上下浮动
    } else { this.model.rotation.set(0, 0, 0); this.model.position.y = 0; }
    this._lastYaw = this.yaw;
    const ud = this.model.userData;
    ud.setPose?.(this.swimming ? 'swim' : this.flying ? 'jump' : !this.onGround ? 'jump' : hs > 0.2 ? (hs > 5 ? 'run' : 'walk') : (this.talking ? 'talk' : 'idle'));
    ud.update?.(dt, this.onGround && !this.flying ? hs : 0);
    this._updateBuddy(dt);
    return hs;
  }

  setFlying(on) {
    if (this.vehicle) return;
    this.flying = on;
    if (on) { this.onGround = false; this.vel.y = Math.max(this.vel.y, 5); this._landT = 0; }
    this.onFlyChange?.(on);
  }

  _updateBuddy(dt) {
    // 伙伴站在侧后方（不挡住身后的相机）
    const flyOff = this.flying ? 2.2 : 0;
    const target = new THREE.Vector3(this.pos.x - Math.sin(this.yaw) * (0.5 + flyOff) + Math.cos(this.yaw) * (1.3 + flyOff * 0.5), this.pos.y, this.pos.z - Math.cos(this.yaw) * (0.5 + flyOff) - Math.sin(this.yaw) * (1.3 + flyOff * 0.5));
    const d = target.clone().sub(this.buddyPos); d.y = 0;
    const dist = d.length();
    let sp = 0;
    if (dist > 25) { this.buddyPos.copy(target); if (this.flying) this.buddyPos.y = this.pos.y; }
    else if (dist > 0.4) {
      sp = Math.min(dist * 2.4, this.flying ? 34 : 9);
      this.buddyPos.addScaledVector(d.normalize(), sp * dt);
      const ty = Math.atan2(d.x, d.z);
      let a = ty - this.buddyYaw; a = Math.atan2(Math.sin(a), Math.cos(a));
      this.buddyYaw += a * Math.min(1, dt * 8);
    } else {
      let a = this.yaw - this.buddyYaw; a = Math.atan2(Math.sin(a), Math.cos(a));
      this.buddyYaw += a * Math.min(1, dt * 2);
    }
    const p = { x: this.buddyPos.x, y: this.buddyPos.y, z: this.buddyPos.z };
    const g = this.col.resolve(p, 0.3, 1.2, 0.8);
    this.buddyPos.x = p.x; this.buddyPos.z = p.z;
    // 飞行时伙伴高度跟随玩家（不低于地面），否则落地
    const bSwim = !this.flying && inCanal(this.buddyPos.x, this.buddyPos.z) && g < WATER_Y;
    const ty = this.flying ? Math.max(g, this.pos.y + 0.8) : bSwim ? WATER_Y - 0.7 : g;
    this.buddyPos.y += (ty - this.buddyPos.y) * Math.min(1, dt * (this.flying ? 3 : 10));
    this.buddy.position.copy(this.buddyPos);
    if (!this.buddyCopter) { this.buddyCopter = makeCopter(); this.buddy.add(this.buddyCopter); }
    this.buddyCopter.visible = this.flying;
    this.buddyCopter.position.y = (this.models[this.buddyKey].userData.totalHeight || this.models[this.buddyKey].userData.height || 1.3) + 0.06;
    this.buddyCopter.userData.blades.rotation.y += dt * 38;
    this.buddy.rotation.y = this.buddyYaw;
    this.buddy.visible = !this.vehicle || this.onTwoWheels;
    const m = this.models[this.buddyKey].userData;
    m.setPose?.(bSwim ? 'swim' : this.flying ? 'jump' : sp > 0.2 ? (sp > 5 ? 'run' : 'walk') : (this.talking ? 'talk' : 'idle'));
    m.update?.(dt, this.flying ? 0 : sp);
  }

  // —— 驾驶 ——
  get onTwoWheels() { return this.vehicle && (this.vehicle.kind === 'bike' || this.vehicle.kind === 'scooter'); }

  enterVehicle(v) {
    if (this.flying) this.setFlying(false);
    this.vehicle = v; v.driver = this;
    v.speed = 0; v.parked = false;
    if (v.kind === 'bike' || v.kind === 'scooter') {
      // 两轮车：角色骑在车上（伙伴跑步跟随）
      this.root.visible = false;
      v.mount(this.model);
      this.model.visible = true;
    } else { this.root.visible = false; this.buddy.visible = false; }
  }
  exitVehicle() {
    const v = this.vehicle; if (!v) return;
    if (v.unmount) { const m = v.unmount(); this.root.add(m); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); }
    this.vehicle = null; v.driver = null;
    const side = new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw)).multiplyScalar(-2.2);
    this.pos.copy(v.pos).add(side); this.pos.y = this.col.groundAt(this.pos.x, this.pos.z, 50);
    this.yaw = v.yaw; this.vel.set(0, 0, 0);
    this.buddyPos.copy(v.pos).sub(side); this.buddyPos.y = this.pos.y;
    this.root.visible = true; this.buddy.visible = true;
    v.speed = 0;
  }
  _updateVehicle(dt, input, camYaw) {
    const v = this.vehicle;
    let th = 0, st = 0;
    if (!this.frozen) {
      const mv = input.move();
      if (Math.abs(mv.y) > 0.2) th = -Math.sign(mv.y);
      if (Math.abs(mv.x) > 0.15) st = -Math.max(-1, Math.min(1, mv.x));
    }
    const boost = input.down('ShiftLeft') ? 1.5 : 1;
    const two = v.cfg;                          // 两轮车参数 { max, accel }
    const maxF = (two ? two.max : 26) * boost, maxB = two ? -2.5 : -8;
    const acc = two ? two.accel : 12;
    if (th > 0) v.speed += (v.speed < 0 ? 30 : acc) * dt;
    else if (th < 0) v.speed -= (v.speed > 0 ? 30 : 8) * dt;
    else v.speed -= v.speed * Math.min(1, dt * 0.9);
    if (input.down('Space')) v.speed -= v.speed * Math.min(1, dt * 4);
    v.speed = Math.max(maxB, Math.min(maxF, v.speed));
    const grip = 1 - (this.wet || 0) * 0.35;      // 雨雪天转向更飘
    const turn = st * Math.min(1, Math.abs(v.speed) / (two ? 1.5 : 4)) * (two ? 2.3 : 1.6) * grip * Math.sign(v.speed || 1);
    v.yaw += turn * dt;
    v.pos.x += Math.sin(v.yaw) * v.speed * dt;
    v.pos.z += Math.cos(v.yaw) * v.speed * dt;
    const before = v.pos.clone();
    const g = this.col.resolve(v.pos, two ? 0.45 : 1.3, 1.4, 0.7);
    if (before.distanceToSquared(v.pos) > 1e-4) v.speed *= 0.6; // 撞墙减速
    v.pos.y += (g - v.pos.y) * Math.min(1, dt * 12);
    v.update(dt, st);
    this.pos.copy(v.pos);
    this.yaw = v.yaw;
    if (two) {
      // 骑车姿势：自行车蹬踏（双腿交替）；伙伴跑步跟随
      const ud = this.model.userData;
      ud.setPose?.('sit'); ud.update?.(dt, 0);
      if (v.kind === 'bike' && ud.bones?.legs) {
        const ph = (this._pedal = (this._pedal || 0) + v.speed * dt * 2.2);
        for (const L of ud.bones.legs) { L.thigh.rotation.x = -1.2 + Math.sin(ph + (L.side > 0 ? 0 : Math.PI)) * 0.45; L.shin.rotation.x = 1.0 + Math.cos(ph + (L.side > 0 ? 0 : Math.PI)) * 0.4; }
      }
      if (ud.bones?.arms) for (const A of ud.bones.arms) { A.upper.rotation.x = -0.9; A.upper.rotation.z = A.side * 0.15; A.lower.rotation.x = -0.4; }
      this._updateBuddy(dt);
    }
    return Math.abs(v.speed);
  }
}

// 竹蜻蜓：竹柄 + 两片桨叶（黄色桨叶，头顶小底座）
function makeCopter() {
  const g = new THREE.Group();
  const bamboo = new THREE.MeshStandardMaterial({ color: 0xc8a25a, roughness: 0.6 });
  const blade = new THREE.MeshStandardMaterial({ color: 0xf4c430, roughness: 0.45, side: THREE.DoubleSide });
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), bamboo);
  g.add(base);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.26, 8), bamboo);
  stick.position.y = 0.13; g.add(stick);
  // 竹节
  for (const y of [0.07, 0.17]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.012, 8), bamboo); r.position.y = y; g.add(r); }
  const blades = new THREE.Group(); blades.position.y = 0.27; g.add(blades);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), bamboo); blades.add(hub);
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.035); shape.quadraticCurveTo(0.25, -0.06, 0.42, -0.03); shape.quadraticCurveTo(0.46, 0, 0.42, 0.03); shape.quadraticCurveTo(0.25, 0.06, 0, 0.035); shape.closePath();
  const bg = new THREE.ShapeGeometry(shape, 8).rotateX(-Math.PI / 2);
  for (const sgn of [1, -1]) { const m = new THREE.Mesh(bg, blade); m.rotation.y = sgn > 0 ? 0 : Math.PI; m.rotation.x = 0.12 * sgn; m.castShadow = true; blades.add(m); }
  g.userData.blades = blades;
  return g;
}

// 第三人称相机：鼠标环绕、滚轮缩放、防穿墙
export class ThirdPersonCamera {
  constructor(camera, col) {
    this.cam = camera; this.col = col;
    this.yaw = Math.PI; this.pitch = 0.28; this.dist = 4.5; this.targetDist = 4.5;
    this.focus = new THREE.Vector3();
    this.shake = 0;
  }
  update(dt, input, player) {
    const sens = 0.0026;
    this.yaw -= input.mouseDX * sens;
    this.pitch = Math.min(1.25, Math.max(-0.35, this.pitch + input.mouseDY * sens));
    const v = player.vehicle;
    const base = v ? 9 : player.flying ? 7.5 : player.stats.camDist;
    if (input.wheel) this.zoom = Math.min(3.0, Math.max(0.4, (this.zoom || 1) + input.wheel * 0.12));
    this.targetDist = base * (this.zoom || 1);
    if (v && !input.locked && Math.abs(v.speed) > 2) {
      // 驾驶时相机自动回到车后
      let d = (v.yaw + Math.PI) - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 1.5);
    }
    const fy = v ? 1.8 : 1.15;
    const tgt = new THREE.Vector3(player.pos.x, player.pos.y + fy, player.pos.z);
    this.focus.lerp(tgt, Math.min(1, dt * 14));
    if (this.focus.distanceTo(tgt) > 15) this.focus.copy(tgt);
    // 防穿墙：沿射线步进
    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    let maxD = this.targetDist;
    for (let d = 0.4; d <= this.targetDist; d += 0.25) {
      const px = this.focus.x + dir.x * d, py = this.focus.y + dir.y * d, pz = this.focus.z + dir.z * d;
      if (this.col.pointInside(px, py, pz)) { maxD = Math.max(0.6, d - 0.35); break; }
    }
    this.dist += ((Math.min(maxD, this.targetDist)) - this.dist) * Math.min(1, dt * (maxD < this.dist ? 20 : 4));
    this.cam.position.copy(this.focus).addScaledVector(dir, this.dist);
    const gy = this.col.groundAt(this.cam.position.x, this.cam.position.z, this.cam.position.y) + 0.25;
    if (this.cam.position.y < gy) this.cam.position.y = gy;
    if (this.shake > 0) { this.shake -= dt; this.cam.position.x += (Math.random() - .5) * .05; this.cam.position.y += (Math.random() - .5) * .05; }
    this.cam.lookAt(this.focus);
  }
}
