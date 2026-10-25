// 性能管理：
//  · 分块距离剔除：合并网格按包围球大小决定可见距离（小物件近处才画，高楼远处也画），超出则隐藏；
//    小物件在中距离不再投射阴影。
//  · 自适应分辨率：帧率持续偏低时自动降低像素比，帧率富余时逐步恢复。
//  · 画质档位：低 / 中 / 高（可在菜单切换，保存到本地）。
import * as THREE from 'three';

export const QUALITY = {
  low: { pixel: 0.75, shadow: 1024, shadows: true, view: 0.55, crowd: 0.5, traffic: 0.5, lamps: 3 },
  mid: { pixel: 1.0, shadow: 1536, shadows: true, view: 0.8, crowd: 0.8, traffic: 0.8, lamps: 6 },
  high: { pixel: 1.75, shadow: 2048, shadows: true, view: 1.0, crowd: 1, traffic: 1, lamps: 8 },
};

export class Perf {
  constructor(renderer, camera, { touch = false } = {}) {
    this.renderer = renderer; this.camera = camera;
    let q = null; try { q = localStorage.getItem('zoo-quality'); } catch { /* */ }
    this.level = QUALITY[q] ? q : touch ? 'mid' : 'high';
    this.maxPixel = Math.min(devicePixelRatio, QUALITY[this.level].pixel);
    this.pixel = this.maxPixel;
    this.items = [];
    this.fpsAvg = 60; this.t = 0; this.cullT = 0;
    this.apply();
  }
  get q() { return QUALITY[this.level]; }
  setLevel(l) {
    if (!QUALITY[l]) return;
    this.level = l; try { localStorage.setItem('zoo-quality', l); } catch { /* */ }
    this.maxPixel = Math.min(devicePixelRatio, this.q.pixel); this.pixel = this.maxPixel; this.apply();
  }
  apply() {
    this.renderer.setPixelRatio(this.pixel);
    this.onChange?.(this.q);
  }
  // 登记合并网格：半径决定可见距离
  register(meshes) {
    for (const m of meshes) {
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      const bs = m.geometry.boundingSphere;
      const r = bs.radius;
      // 网格的“细节尺度”：三角形密度高、尺寸小的网格（街道家具、植物）近处才画
      const tris = (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
      const density = tris / Math.max(1, r * r);
      const big = m.geometry.boundingBox ? (m.geometry.computeBoundingBox(), m.geometry.boundingBox.max.y) : 30;
      // 高楼（max.y 大）远处可见；矮小密集的物体 250–450m
      const far = big > 25 ? 2600 : big > 8 ? 900 : density > 6 ? 330 : 520;
      this.items.push({ m, c: bs.center.clone(), r, far, shadowFar: big > 25 ? 260 : 140, castShadow: m.castShadow });
    }
  }
  update(dt, focus) {
    // 帧率统计
    const fps = 1 / Math.max(1e-3, dt);
    this.fpsAvg += (fps - this.fpsAvg) * Math.min(1, dt * 1.5);
    this.t += dt;
    if (this.t > 2.5) {
      this.t = 0;
      if (this.fpsAvg < 40 && this.pixel > 0.6) { this.pixel = Math.max(0.6, this.pixel - 0.15); this.renderer.setPixelRatio(this.pixel); }
      else if (this.fpsAvg > 56 && this.pixel < this.maxPixel) { this.pixel = Math.min(this.maxPixel, this.pixel + 0.1); this.renderer.setPixelRatio(this.pixel); }
    }
    // 距离剔除（每 0.25s 一次）
    this.cullT -= dt;
    if (this.cullT > 0) return;
    this.cullT = 0.25;
    const k = this.q.view;
    for (const it of this.items) {
      const d = Math.hypot(it.c.x - focus.x, it.c.z - focus.z) - it.r;
      it.m.visible = d < it.far * k;
      if (it.castShadow) it.m.castShadow = d < it.shadowFar;
    }
  }
}
