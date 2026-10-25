// 程序化 canvas 纹理（招牌、海报等）
import * as THREE from 'three';

const cache = new Map();

export function sign(text, { bg = '#1d3b6e', fg = '#ffffff', w = 512, h = 128, font = 'bold 64px "PingFang SC","Microsoft YaHei",sans-serif', border = null } = {}) {
  const key = [text, bg, fg, w, h, font, border].join('|');
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (border) { g.strokeStyle = border; g.lineWidth = Math.max(4, h * 0.06); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth); }
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = String(text).split('\n');
  const lh = h / (lines.length + 0.3);
  lines.forEach((l, i) => g.fillText(l, w / 2, lh * (i + 0.65 + 0.15), w * 0.94));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

// 便捷：创建一块招牌平面 Mesh（双面），宽 width 米，按纹理比例确定高度
export function signMesh(text, width, opts = {}) {
  const t = sign(text, opts);
  const ratio = (opts.h || 128) / (opts.w || 512);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width * ratio), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, toneMapped: false }));
  return m;
}
