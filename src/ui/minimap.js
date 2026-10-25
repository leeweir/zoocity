// 小地图 + 全屏地图（点击地标快速出行）
import { DISTRICTS, LANDMARKS, WATER, BRIDGE, ROAD_W, CONNECTORS, WORLD_SIZE } from '../world/layout.js';

const HALF = WORLD_SIZE / 2;

function drawWorld(g, size) {
  const k = size / WORLD_SIZE;
  const X = x => (x + HALF) * k, Z = z => (z + HALF) * k;
  g.fillStyle = '#5d7d4a'; g.fillRect(0, 0, size, size);
  g.fillStyle = '#2f7fa0'; g.fillRect(0, Z(WATER.z0), size, (WATER.z1 - WATER.z0) * k);
  for (const [key, D] of Object.entries(DISTRICTS)) {
    const r = D.rect;
    g.fillStyle = D.color; g.globalAlpha = key === 'rodentia' ? 0.9 : 0.55;
    g.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * k, (r.z1 - r.z0) * k);
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(40,40,40,.85)'; g.lineWidth = Math.max(1, ROAD_W * k);
    g.beginPath();
    for (const x of D.roadsX) { g.moveTo(X(x), Z(r.z0)); g.lineTo(X(x), Z(r.z1)); }
    for (const z of D.roadsZ) { g.moveTo(X(r.x0), Z(z)); g.lineTo(X(r.x1), Z(z)); }
    g.stroke();
  }
  g.beginPath();
  for (const c of CONNECTORS) { g.moveTo(X(c.x1), Z(c.z1)); g.lineTo(X(c.x2), Z(c.z2)); }
  g.strokeStyle = '#d9c27a'; g.lineWidth = Math.max(1.5, ROAD_W * k); g.stroke();
  g.fillStyle = '#a89f8f'; g.fillRect(X(BRIDGE.x - BRIDGE.w / 2), Z(BRIDGE.z0), BRIDGE.w * k, (BRIDGE.z1 - BRIDGE.z0) * k);
}

export class Minimap {
  constructor(ui, onTravel) {
    this.cv = document.querySelector('#minimap canvas');
    this.g = this.cv.getContext('2d');
    this.nameEl = document.querySelector('#minimap .n');
    this.base = document.createElement('canvas');
    this.base.width = this.base.height = 2048;
    drawWorld(this.base.getContext('2d'), 2048);
    this.onTravel = onTravel;
    this.big = null;
  }
  update(pos, yaw, camYaw, target, districtName, extra = []) {
    const g = this.g, S = this.cv.width;
    const scale = 2048 / WORLD_SIZE; // 基图像素/米
    const view = 260; // 小地图显示半径（米）
    g.save();
    g.clearRect(0, 0, S, S);
    g.translate(S / 2, S / 2);
    g.rotate(camYaw);
    const z = S / (view * 2);
    g.scale(z, z);
    g.drawImage(this.base, -(pos.x + HALF) , -(pos.z + HALF), WORLD_SIZE, WORLD_SIZE);
    // 地标
    for (const L of Object.values(LANDMARKS)) {
      const dx = L.x - pos.x, dz = L.z - pos.z;
      if (Math.abs(dx) > view * 1.5 || Math.abs(dz) > view * 1.5) continue;
      g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(dx, dz, 5, 0, 7); g.fill();
    }
    for (const e of extra) {
      g.fillStyle = e.color; g.beginPath(); g.arc(e.x - pos.x, e.z - pos.z, e.r || 6, 0, 7); g.fill();
    }
    if (target) {
      let dx = target.x - pos.x, dz = target.z - pos.z;
      const d = Math.hypot(dx, dz), lim = view * 0.92;
      if (d > lim) { dx *= lim / d; dz *= lim / d; }
      g.fillStyle = '#ffd34d'; g.strokeStyle = '#000'; g.lineWidth = 3;
      g.beginPath(); g.arc(dx, dz, 11, 0, 7); g.fill(); g.stroke();
    }
    g.restore();
    // 玩家箭头（屏幕中心，按相对相机朝向旋转）
    g.save(); g.translate(S / 2, S / 2); g.rotate(camYaw + Math.PI - yaw);
    g.fillStyle = '#fff'; g.strokeStyle = '#1f2a44'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, -16); g.lineTo(11, 12); g.lineTo(0, 6); g.lineTo(-11, 12); g.closePath(); g.fill(); g.stroke();
    g.restore();
    // 北方标记
    g.save(); g.translate(S / 2, S / 2); g.rotate(camYaw);
    g.fillStyle = '#e5534b'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', 0, -S / 2 + 22); g.restore();
    if (this.nameEl._t !== districtName) { this.nameEl.textContent = districtName; this.nameEl._t = districtName; }
  }

  openBig(pos, target) {
    const wrap = document.createElement('div'); wrap.id = 'bigmap';
    const cv = document.createElement('canvas'); cv.width = cv.height = 1400;
    wrap.appendChild(cv);
    const tip = document.createElement('div'); tip.className = 'tip'; tip.textContent = '点击地标快速出行 · M / Esc 关闭'; wrap.appendChild(tip);
    document.body.appendChild(wrap);
    const g = cv.getContext('2d'); const S = 1400, k = S / WORLD_SIZE;
    g.drawImage(this.base, 0, 0, S, S);
    const P = (x, z) => [(x + HALF) * k, (z + HALF) * k];
    g.textAlign = 'center';
    for (const D of Object.values(DISTRICTS)) {
      if (D.name === '小型啮齿镇') continue;
      const [x, z] = P((D.rect.x0 + D.rect.x1) / 2, D.rect.z0 + 26);
      g.font = 'bold 30px "PingFang SC",sans-serif'; g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 6;
      g.strokeText(D.name, x, z); g.fillText(D.name, x, z);
    }
    const spots = [];
    for (const [key, L] of Object.entries(LANDMARKS)) {
      const [x, z] = P(L.x, L.z);
      g.fillStyle = '#fff'; g.strokeStyle = '#1f2a44'; g.lineWidth = 3;
      g.beginPath(); g.arc(x, z, 9, 0, 7); g.fill(); g.stroke();
      g.font = '18px "PingFang SC",sans-serif'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.7)';
      g.strokeText(L.name, x, z - 16); g.fillStyle = '#fff'; g.fillText(L.name, x, z - 16);
      spots.push({ key, x, z, L });
    }
    if (target) { const [x, z] = P(target.x, target.z); g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(x, z, 13, 0, 7); g.fill(); g.stroke(); }
    { const [x, z] = P(pos.x, pos.z); g.fillStyle = '#e5534b'; g.beginPath(); g.arc(x, z, 12, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.stroke(); }
    cv.onclick = e => {
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * S, z = (e.clientY - r.top) / r.height * S;
      let best = null, bd = 40 * 40;
      for (const s of spots) { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; best = s; } }
      if (best) { this.closeBig(); this.onTravel(best.L); }
    };
    this.big = wrap;
  }
  closeBig() { this.big?.remove(); this.big = null; }
}
