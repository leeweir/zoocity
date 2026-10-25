// 外环辅路：环城高架下方的地面道路，把撒瓦纳路网、各气候墙门洞与高架匝道全部连通，消除断头路。
// 路面略高于原道路（y=0.03），交叉处直接覆盖；建造期间让沿线零碎道具让路（见 main.js 的 reject）。
import { FRONTAGE, ROAD_W } from './layout.js';

const TOP = 0.03;

function segRect(c, pad) {
  const w = (c.w || ROAD_W) / 2 + pad;
  return [Math.min(c.x1, c.x2) - w, Math.min(c.z1, c.z2) - w, Math.max(c.x1, c.x2) + w, Math.max(c.z1, c.z2) + w];
}

// 建造期间：压在辅路上的物体丢弃（地面层的路面/草地这类 <0.32m 的保留）
export function frontageReject(x0, z0, x1, z1, top) {
  if (top <= 0.32) return false;
  for (const c of FRONTAGE) {
    const [a, b, d, e] = segRect(c, 1.2);
    if (x1 > a && x0 < d && z1 > b && z0 < e) return true;
  }
  return false;
}

export function buildFrontage(ctx) {
  const { b } = ctx;
  for (const c of FRONTAGE) {
    const w = c.w || ROAD_W;
    const len = Math.hypot(c.x2 - c.x1, c.z2 - c.z1);
    if (len < 1) continue;
    const mx = (c.x1 + c.x2) / 2, mz = (c.z1 + c.z2) / 2;
    const ry = Math.atan2(c.x2 - c.x1, c.z2 - c.z1);
    b.box(w + 2, 0.02, len + w, mx, 0, mz, 0x8f8a7c, { ry, shadow: false, keep: true });
    b.box(w, 0.03, len + w * 0.6, mx, 0.005, mz, 0x3f4248, { ry, shadow: false, keep: true });
    if (c.name) {
      // 主辅路：黄中线 + 路边白线
      for (let s = -len / 2 + 4; s < len / 2 - 4; s += 9) {
        const px = mx + Math.sin(ry) * s, pz = mz + Math.cos(ry) * s;
        b.box(0.22, 0.01, 4, px, TOP + 0.005, pz, 0xf2c94c, { ry, shadow: false, keep: true });
      }
      const nx = Math.cos(ry), nz = -Math.sin(ry);
      for (const sg of [-1, 1]) b.box(0.18, 0.01, len, mx + nx * sg * (w / 2 - 0.6), TOP + 0.005, mz + nz * sg * (w / 2 - 0.6), 0xeeeeee, { ry, shadow: false, keep: true });
    }
  }
}
