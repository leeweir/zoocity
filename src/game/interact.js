// 交互点注册：靠近显示「E · label」
export class Interactions {
  constructor() { this.items = new Map(); }
  add(item) { this.items.set(item.id, item); return item; }
  remove(id) { this.items.delete(id); }
  nearest(pos) {
    let best = null, bd = Infinity;
    for (const it of this.items.values()) {
      if (it.enabled && !it.enabled()) continue;
      const d = (it.x - pos.x) ** 2 + (it.z - pos.z) ** 2;
      const r = it.radius || 2;
      if (d < r * r && d < bd && Math.abs((it.yBase ?? pos.y) - pos.y) < 4) { bd = d; best = it; }
    }
    return best;
  }
}
