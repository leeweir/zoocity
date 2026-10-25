// 2D 碰撞（XZ 平面）+ 高度：空间哈希网格。
// 盒子：轴对齐或带旋转；圆：柱体。每个碰撞体有 yMin/yMax，玩家可以跳上低矮物体（台阶/平台）。
//
// colliders.box(cx, cz, w, d, { ry=0, yMin=0, yMax=10, walkable=false })
//    walkable=true 表示顶面可以站立（平台、台阶、屋顶），否则只是阻挡。
// colliders.circle(cx, cz, r, { yMin=0, yMax=10, walkable=false })
// colliders.ramp(x0, z0, x1, z1, h0, h1, axis='z')  斜坡/楼梯：在矩形内地面高度从 h0 线性变到 h1
// colliders.resolve(pos, radius, height)  -> 把 pos(Vector3) 推出碰撞体；返回 { ground } 当前位置可站立高度
// colliders.groundAt(x, z, y, stepUp)    -> 在 (x,z) 处、不高于 y+stepUp 的最高可站立面

const CELL = 16;

export class Colliders {
  constructor() {
    this.grid = new Map();
    this.list = [];
  }

  _insert(c, x0, z0, x1, z1) {
    const i0 = Math.floor(x0 / CELL), i1 = Math.floor(x1 / CELL);
    const j0 = Math.floor(z0 / CELL), j1 = Math.floor(z1 / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = i * 100003 + j;
      let a = this.grid.get(k);
      if (!a) { a = []; this.grid.set(k, a); }
      a.push(c);
    }
    this.list.push(c);
    return c;
  }

  box(cx, cz, w, d, { ry = 0, yMin = 0, yMax = 10, walkable = false } = {}) {
    const cos = Math.cos(ry), sin = Math.sin(ry);
    const c = { type: 'box', cx, cz, hw: w / 2, hd: d / 2, cos, sin, yMin, yMax, walkable };
    const ex = Math.abs(cos) * c.hw + Math.abs(sin) * c.hd;
    const ez = Math.abs(sin) * c.hw + Math.abs(cos) * c.hd;
    return this._insert(c, cx - ex, cz - ez, cx + ex, cz + ez);
  }

  circle(cx, cz, r, { yMin = 0, yMax = 10, walkable = false } = {}) {
    const c = { type: 'circle', cx, cz, r, yMin, yMax, walkable };
    return this._insert(c, cx - r, cz - r, cx + r, cz + r);
  }

  ramp(x0, z0, x1, z1, h0, h1, axis = 'z') {
    const c = { type: 'ramp', x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), h0, h1, axis, rx0: x0, rz0: z0, rx1: x1, rz1: z1 };
    return this._insert(c, c.x0, c.z0, c.x1, c.z1);
  }

  _near(x, z) {
    const k = Math.floor(x / CELL) * 100003 + Math.floor(z / CELL);
    return this.grid.get(k) || [];
  }

  _rampH(c, x, z) {
    if (x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1) return null;
    const t = c.axis === 'z' ? (z - c.rz0) / (c.rz1 - c.rz0) : (x - c.rx0) / (c.rx1 - c.rx0);
    return c.h0 + (c.h1 - c.h0) * Math.min(1, Math.max(0, t));
  }

  groundAt(x, z, y = 1e9, stepUp = 0.6) {
    let g = 0;
    const lim = y + stepUp;
    for (const c of this._near(x, z)) {
      let top = null;
      if (c.type === 'ramp') top = this._rampH(c, x, z);
      else if (c.walkable) {
        if (c.type === 'box') {
          const dx = x - c.cx, dz = z - c.cz;
          const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
          if (Math.abs(lx) <= c.hw && Math.abs(lz) <= c.hd) top = c.yMax;
        } else if ((x - c.cx) ** 2 + (z - c.cz) ** 2 <= c.r * c.r) top = c.yMax;
      }
      if (top !== null && top <= lim && top > g) g = top;
    }
    return g;
  }

  // pos: {x,y,z}，就地修改。返回地面高度。
  resolve(pos, radius = 0.4, height = 1.2, stepUp = 0.6) {
    const seen = new Set();
    for (let iter = 0; iter < 2; iter++) {
      for (const [ox, oz] of [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]]) {
        for (const c of this._near(pos.x + ox, pos.z + oz)) {
          if (c.type === 'ramp' || (iter === 0 && seen.has(c))) continue;
          seen.add(c);
          // 高度不重叠则忽略（在上面或下面）
          if (pos.y + height < c.yMin || pos.y >= c.yMax - (c.walkable ? stepUp : 0.001)) continue;
          if (c.type === 'circle') {
            const dx = pos.x - c.cx, dz = pos.z - c.cz;
            const d2 = dx * dx + dz * dz, rr = c.r + radius;
            if (d2 < rr * rr) {
              const d = Math.sqrt(d2) || 1e-4;
              pos.x = c.cx + dx / d * rr; pos.z = c.cz + dz / d * rr;
            }
          } else {
            const dx = pos.x - c.cx, dz = pos.z - c.cz;
            let lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
            const px = c.hw + radius - Math.abs(lx), pz = c.hd + radius - Math.abs(lz);
            if (px > 0 && pz > 0) {
              if (px < pz) lx += Math.sign(lx || 1) * px; else lz += Math.sign(lz || 1) * pz;
              pos.x = c.cx + lx * c.cos + lz * c.sin;
              pos.z = c.cz - lx * c.sin + lz * c.cos;
            }
          }
        }
      }
    }
    return this.groundAt(pos.x, pos.z, pos.y, stepUp);
  }

  // 点 (x,y,z) 是否在某个实体内部（相机防穿墙用）
  pointInside(x, y, z) {
    for (const c of this._near(x, z)) {
      if (c.type === 'ramp' || y < c.yMin || y > c.yMax) continue;
      if (c.type === 'circle') { if ((x - c.cx) ** 2 + (z - c.cz) ** 2 < c.r * c.r) return true; }
      else {
        const dx = x - c.cx, dz = z - c.cz;
        const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
        if (Math.abs(lx) < c.hw && Math.abs(lz) < c.hd) return true;
      }
    }
    return false;
  }

  // 判断一个点（半径 r）是否被占据——用于把 NPC/线索点推到空地
  blocked(x, z, r = 0.5) {
    // 以该点地面高度为准，可跨上的台阶/人行道不算阻挡
    const p = { x, y: this.groundAt(x, z, 0.6, 0), z };
    this.resolve(p, r, 1.2, 0.6);
    return Math.abs(p.x - x) > 1e-3 || Math.abs(p.z - z) > 1e-3;
  }
}
