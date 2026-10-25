// 玩家控制：第三人称移动、跳跃、冲刺、角色切换（朱迪 / 尼克）、驾驶警车
import * as THREE from 'three';

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
    this.gliding = false;
    this.glider = makeGlider();
    this.glider.visible = false;
    this.root.add(this.glider);
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
      // 滑翔时摇杆/方向键只负责转向，速度由滑翔物理决定
      if (!this.gliding) {
        const accel = this.onGround ? 14 : 4;
        this.vel.x += (wx * speed - this.vel.x) * Math.min(1, dt * accel);
        this.vel.z += (wz * speed - this.vel.z) * Math.min(1, dt * accel);
      } else this.yaw -= d * Math.min(1, dt * 12) * 0.55;   // 伞转向比走路慢一些
    } else if (!this.gliding) {
      const damp = this.onGround ? 12 : 1;
      this.vel.x -= this.vel.x * Math.min(1, dt * damp);
      this.vel.z -= this.vel.z * Math.min(1, dt * damp);
    }
    if (!sprint || !moving) this.stamina = Math.min(1, this.stamina + dt * 0.18);

    if (input.hit('Space') && !this.frozen) {
      if (this.onGround) { this.vel.y = S.jump; this.onGround = false; }
      // 空中再按跳跃：展开 / 收起滑翔伞（离地 > 2m 才能展开）
      else if (this.gliding) this.gliding = false;
      else if (this.pos.y - this.col.groundAt(this.pos.x, this.pos.z, this.pos.y) > 2) this.gliding = true;
    }
    if (this.gliding) {
      // 滑翔：缓慢下沉、前向速度更快、可转向；按住冲刺键俯冲加速
      const dive = sprint;
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      const fwd = dive ? 19 : 12.5;
      const k = Math.min(1, dt * 1.6);
      this.vel.x += (fx * fwd - this.vel.x) * k;
      this.vel.z += (fz * fwd - this.vel.z) * k;
      const sink = dive ? -6 : -1.6;
      this.vel.y += (sink - this.vel.y) * Math.min(1, dt * 3);
      // 上升气流：气候墙排气塔 / 雨林雾塔附近可以爬升
      if (this.updraft?.(this.pos)) this.vel.y += (4 - this.vel.y) * Math.min(1, dt * 2);
    } else this.vel.y -= 22 * dt;
    this.pos.addScaledVector(this.vel, dt);
    const g = this.col.resolve(this.pos, S.radius, S.height, 0.6);
    if (this.pos.y <= g + 0.001) {
      if (this.pos.y < g - 0.0) this.pos.y = this.onGround ? g : Math.max(this.pos.y, g); // 上台阶
      this.pos.y = g; this.vel.y = Math.max(0, this.vel.y); this.onGround = true;
      this.gliding = false;
    } else if (this.onGround && this.pos.y - g < 0.45 && this.vel.y <= 0) {
      this.pos.y = g; // 贴地下台阶
    } else this.onGround = false;
    if (this.pos.y < -20) { this.pos.y = 5; }

    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    // 滑翔伞外观：伞翼随转向倾斜
    this.glider.visible = this.gliding;
    if (this.gliding) {
      this._bank = (this._bank || 0) + (((this._lastYaw ?? this.yaw) - this.yaw) / Math.max(dt, 1e-3) * 0.12 - (this._bank || 0)) * Math.min(1, dt * 4);
      this.glider.rotation.z = THREE.MathUtils.clamp(this._bank, -0.5, 0.5);
      this.root.rotation.z = this.glider.rotation.z * 0.3;
    } else this.root.rotation.z = 0;
    this._lastYaw = this.yaw;
    const ud = this.model.userData;
    ud.setPose?.(this.gliding ? 'sit' : !this.onGround ? 'jump' : hs > 0.2 ? (hs > 5 ? 'run' : 'walk') : (this.talking ? 'talk' : 'idle'));
    ud.update?.(dt, this.onGround ? hs : 0);
    this._updateBuddy(dt);
    return hs;
  }

  _updateBuddy(dt) {
    // 伙伴站在侧后方（不挡住身后的相机）
    const target = new THREE.Vector3(this.pos.x - Math.sin(this.yaw) * 0.5 + Math.cos(this.yaw) * 1.3, this.pos.y, this.pos.z - Math.cos(this.yaw) * 0.5 - Math.sin(this.yaw) * 1.3);
    const d = target.clone().sub(this.buddyPos); d.y = 0;
    const dist = d.length();
    let sp = 0;
    if (dist > 25) { this.buddyPos.copy(target); }
    else if (dist > 0.4) {
      sp = Math.min(dist * 2.4, 9);
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
    this.buddyPos.y += (g - this.buddyPos.y) * Math.min(1, dt * 10);
    this.buddy.position.copy(this.buddyPos);
    this.buddy.rotation.y = this.buddyYaw;
    this.buddy.visible = !this.vehicle;
    const m = this.models[this.buddyKey].userData;
    m.setPose?.(sp > 0.2 ? (sp > 5 ? 'run' : 'walk') : (this.talking ? 'talk' : 'idle'));
    m.update?.(dt, sp);
  }

  // —— 驾驶 ——
  enterVehicle(v) {
    this.vehicle = v; v.driver = this;
    this.root.visible = false; this.buddy.visible = false;
    v.speed = 0;
  }
  exitVehicle() {
    const v = this.vehicle; if (!v) return;
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
    const maxF = 26 * boost, maxB = -8;
    if (th > 0) v.speed += (v.speed < 0 ? 30 : 12) * dt;
    else if (th < 0) v.speed -= (v.speed > 0 ? 30 : 8) * dt;
    else v.speed -= v.speed * Math.min(1, dt * 0.9);
    if (input.down('Space')) v.speed -= v.speed * Math.min(1, dt * 4);
    v.speed = Math.max(maxB, Math.min(maxF, v.speed));
    const turn = st * Math.min(1, Math.abs(v.speed) / 4) * 1.6 * Math.sign(v.speed || 1);
    v.yaw += turn * dt;
    v.pos.x += Math.sin(v.yaw) * v.speed * dt;
    v.pos.z += Math.cos(v.yaw) * v.speed * dt;
    const before = v.pos.clone();
    const g = this.col.resolve(v.pos, 1.3, 1.4, 0.7);
    if (before.distanceToSquared(v.pos) > 1e-4) v.speed *= 0.6; // 撞墙减速
    v.pos.y += (g - v.pos.y) * Math.min(1, dt * 12);
    v.update(dt, st);
    this.pos.copy(v.pos);
    this.yaw = v.yaw;
    return Math.abs(v.speed);
  }
}

// 滑翔伞：拱形伞翼（ZPD 蓝 + 胡萝卜橙条纹） + 伞绳，挂在角色头顶上方
function makeGlider() {
  const g = new THREE.Group();
  const span = 5.2, chord = 1.6, H = 3.2;
  const cells = 9;
  for (let i = 0; i < cells; i++) {
    const a0 = -0.95 + (i / cells) * 1.9, a1 = -0.95 + ((i + 1) / cells) * 1.9;
    const am = (a0 + a1) / 2;
    const x = Math.sin(am) * span / 2, y = H + Math.cos(am) * 0.9;
    const cellW = span / cells * 1.08;
    const m = new THREE.Mesh(new THREE.BoxGeometry(cellW, 0.16, chord), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x1f3b73 : 0xf08a24, roughness: 0.6, side: THREE.DoubleSide }));
    m.position.set(x, y, 0.1);
    m.rotation.z = -am;
    m.castShadow = true;
    g.add(m);
  }
  // 伞绳
  const lineMat = new THREE.LineBasicMaterial({ color: 0xdddddd });
  const pts = [];
  for (let i = 0; i <= cells; i += 3) {
    const a = -0.95 + (i / cells) * 1.9;
    const tip = new THREE.Vector3(Math.sin(a) * span / 2, H + Math.cos(a) * 0.9 - 0.1, 0.1);
    for (const sx of [-0.18, 0.18]) pts.push(new THREE.Vector3(sx, 1.05, 0), tip);
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
  // ZPD 标志
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), new THREE.MeshBasicMaterial({ color: 0xf2c14e, side: THREE.DoubleSide }));
  badge.position.set(0, H + 0.99, 0.1); badge.rotation.x = -Math.PI / 2; g.add(badge);
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
    const base = v ? 9 : player.gliding ? 8 : player.stats.camDist;
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
