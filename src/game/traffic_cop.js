// 交警模式：致敬电影里朱迪「中午前开 200 张罚单」。
// 和侦探模式互相切换（牛局长处 / 暂停菜单 / 按 T）。交警值班期间：
//  · 街上会随机出现违章车辆（超速 / 违停 / 闯红灯 / 逆行），头顶有红色标记，小地图有红点；
//  · 靠近违停车按 E 贴罚单；对行驶中的违章车：开警车靠近（≤8m）按 E 鸣笛拦停，或步行追上；
//  · 计时 3 分钟一轮，连击加分；超过 200 分解锁成就；失误（给守规矩的车开单）会扣分。
import * as THREE from 'three';
import { esc } from '../ui/ui.js';

const OFFENSES = [
  { key: 'speed', name: '超速', icon: '💨', pts: 15, desc: '在撒瓦纳市区以 2 倍限速飞驰' },
  { key: 'park', name: '违章停车', icon: '🅿️', pts: 8, desc: '停在消防栓前 / 双黄线上' },
  { key: 'redlight', name: '闯红灯', icon: '🚦', pts: 12, desc: '路口不减速直接冲过去' },
  { key: 'wrong', name: '逆行', icon: '↩️', pts: 18, desc: '在单向车道上逆行' },
];
const EXCUSES = [
  ['我、我赶着去车管所！', 'nick', '车管所？那你可以慢慢开。'],
  ['我是送冰棍的，再晚就化了！', 'judy', '融化的冰棍和交通事故，你选哪个？'],
  ['警官，我只停了一分钟……', 'judy', '一分钟也是违停。罚单拿好。'],
  ['你知道我是谁吗？我认识大先生！', 'nick', '巧了，我也认识。他最讨厌不守规矩的人。'],
  ['我的GPS说可以走这里！', 'judy', 'GPS 可不是交通法规。'],
  ['今天是我生日！', 'nick', '生日快乐。这是你的生日罚单。'],
];
const ROUND = 180;      // 秒
const SAVE = 'zootopia-traffic-cop-v1';

export class TrafficCop {
  constructor({ scene, ui, traffic, player, crowd }) {
    Object.assign(this, { scene, ui, traffic, player, crowd });
    this.active = false;
    this.score = 0; this.tickets = 0; this.combo = 0; this.time = 0;
    this.best = 0;
    try { this.best = +localStorage.getItem(SAVE) || 0; } catch { /* 无痕 */ }
    this.offenders = new Set();
    this.markerGeo = new THREE.ConeGeometry(0.45, 0.9, 4).rotateX(Math.PI);
    this.markerMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b, toneMapped: false });
    this.spawnT = 0;
  }

  get rank() {
    const s = this.score;
    return s >= 200 ? '🏆 传奇交警' : s >= 120 ? '🥇 金牌交警' : s >= 60 ? '🥈 银牌交警' : '🥉 见习交警';
  }

  start() {
    if (this.active) return;
    this.active = true; this.score = 0; this.tickets = 0; this.combo = 0; this.time = ROUND; this.spawnT = 0;
    this.ui.stamp('交警值班开始', '#2a6fb5');
    this.ui.toast('🚔 交警模式：找到头顶有 <b style="color:#ff6b6b">红色标记</b> 的违章车辆，靠近按 <kbd>E</kbd> 开罚单！<br>行驶中的违章车：开警车追上去更快。目标：3 分钟 200 分', 6500);
    for (let i = 0; i < 5; i++) this._spawn(true);
  }

  stop(reason = '下班') {
    if (!this.active) return;
    this.active = false;
    for (const c of [...this.offenders]) this._clear(c);
    if (this.score > this.best) { this.best = this.score; try { localStorage.setItem(SAVE, String(this.best)); } catch { /* */ } }
    this.ui.modal(`<div class="sheet" style="max-width:520px;text-align:center"><button class="close">×</button>
      <h2>🚔 交警值班结束 · ${esc(reason)}</h2>
      <div style="font-size:54px;margin:10px 0">${this.score >= 200 ? '🏆' : '📋'}</div>
      <p style="font-size:18px">开出罚单 <b>${this.tickets}</b> 张 · 得分 <b>${this.score}</b></p>
      <p>${this.rank} · 历史最佳 ${this.best}</p>
      ${this.score >= 200 ? '<p style="color:#3bb273"><b>“中午之前 200 张罚单？我做到了！”</b> —— 朱迪</p>' : '<p style="opacity:.7">提示：开警车追行驶中的违章车更快；连续开单有连击加成。</p>'}
      <div style="margin-top:14px;display:flex;gap:10px;justify-content:center"><button class="btn" data-a="again">再来一轮</button><button class="btn ghost" data-a="close">回到侦探模式</button></div>
    </div>`);
    const m = this.ui.modalEl;
    m.querySelector('[data-a=again]').onclick = () => { this.ui.closeModal(); this.start(); };
    m.querySelector('[data-a=close]').onclick = () => this.ui.closeModal();
  }

  _spawn(far = false) {
    const pool = this.traffic.cars.filter(c => !c.offense && !c.loop && c.model.visible !== false && c.road && c.road.district !== 'bunnyburrow');
    if (!pool.length) return;
    const p = this.player.pos;
    // 选玩家附近 40–220m 的车
    pool.sort(() => Math.random() - 0.5);
    const c = pool.find(c => { const d = c.model.position.distanceTo(p); return d > (far ? 30 : 40) && d < 220; }) || pool[0];
    const off = OFFENSES[Math.floor(Math.random() * OFFENSES.length)];
    c.offense = off;
    c.baseSpeed = c.speed;
    if (off.key === 'speed') c.speed = c.baseSpeed * 2.1;
    if (off.key === 'park') { c.speed = 0; c.cur = 0; }
    if (off.key === 'wrong') c.dir = -c.dir;
    const mk = new THREE.Mesh(this.markerGeo, this.markerMat);
    mk.position.y = 2.6 * (c.scale || 1) + 0.6;
    c.model.add(mk); c.marker = mk;
    this.offenders.add(c);
  }

  _clear(c) {
    if (c.marker) c.model.remove(c.marker);
    c.marker = null; c.offense = null;
    if (c.baseSpeed != null) c.speed = c.baseSpeed;
    this.offenders.delete(c);
  }

  // 返回最近的可执法违章车（供提示与 E 键）
  nearest() {
    if (!this.active) return null;
    const p = this.player.pos;
    const range = this.player.vehicle ? 9 : 3.6;
    let best = null, bd = range * range;
    for (const c of this.offenders) {
      const d = c.model.position.distanceToSquared(p);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // 尝试开罚单；返回是否处理了 E 键
  tryTicket() {
    if (!this.active) return false;
    const c = this.nearest();
    if (!c) return false;
    const off = c.offense;
    const moving = Math.abs(c.cur || 0) > 1.5;
    if (moving && !this.player.vehicle) {
      // 步行追行驶车：需要跑到车头前方拦车（成功率与距离相关）
      const fwd = new THREE.Vector3(Math.sin(c.model.rotation.y), 0, Math.cos(c.model.rotation.y));
      const rel = this.player.pos.clone().sub(c.model.position);
      if (rel.dot(fwd) < 0) { this.ui.toast('🏃 跑到车头前面才能拦下它！（或者开警车追）', 1800); return true; }
    }
    this.combo++;
    const bonus = Math.min(10, (this.combo - 1) * 2);
    const gain = off.pts + bonus;
    this.score += gain; this.tickets++;
    const [exc, who, reply] = EXCUSES[Math.floor(Math.random() * EXCUSES.length)];
    const hero = this.player.current;
    this.ui.toast(`${off.icon} <b>${off.name}</b> 罚单 +${gain}${bonus ? ` <span style="color:#ffd34d">（连击 ×${this.combo}）</span>` : ''}<br><span style="opacity:.8">司机：“${esc(exc)}”</span><br>${hero === who ? (hero === 'judy' ? '朱迪' : '尼克') + '：' + esc(reply) : ''}`, 3200);
    // 被拦下的车停 2 秒再开走
    c.speed = 0; c.cur = 0;
    const car = c;
    setTimeout(() => { if (car.baseSpeed != null) car.speed = car.baseSpeed; }, 2200);
    this._clear(c);
    this._comboT = 6;
    if (this.score >= 200 && !this._done200) { this._done200 = true; this.ui.stamp('200 分！', '#3bb273'); }
    return true;
  }

  // 给守规矩的车开单（失误）
  wrongTicket() {
    this.score = Math.max(0, this.score - 5); this.combo = 0;
    this.ui.toast('😬 这辆车没有违章！冤枉好人 -5', 1800);
  }

  update(dt, t) {
    if (!this.active) return;
    this.time -= dt;
    if (this._comboT > 0) { this._comboT -= dt; if (this._comboT <= 0) this.combo = 0; }
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.offenders.size < 6) { this._spawn(); this.spawnT = 6 + Math.random() * 5; }
    for (const c of this.offenders) if (c.marker) { c.marker.rotation.y += dt * 3; c.marker.position.y = 2.6 * (c.scale || 1) + 0.6 + Math.sin(t * 4) * 0.2; c.model.visible = true; }
    if (this.time <= 0) this.stop('时间到');
  }

  hud() {
    if (!this.active) return null;
    const m = Math.max(0, Math.floor(this.time / 60)), s = Math.max(0, Math.floor(this.time % 60));
    return { caseTitle: '🚔 交警值班中', text: `得分 ${this.score} / 200 · 罚单 ${this.tickets} 张${this.combo > 1 ? ` · 连击 ×${this.combo}` : ''}`, items: [{ text: `剩余时间 ${m}:${String(s).padStart(2, '0')}` }, { text: `${this.rank}` }] };
  }

  mapDots() { return [...this.offenders].map(c => ({ x: c.model.position.x, z: c.model.position.z, color: '#ff3b3b', r: 6 })); }

  nearestOffender() {
    let best = null, bd = Infinity; const p = this.player.pos;
    for (const c of this.offenders) { const d = c.model.position.distanceToSquared(p); if (d < bd) { bd = d; best = c; } }
    return best && { x: best.model.position.x, z: best.model.position.z, label: best.offense.name, icon: best.offense.icon };
  }
}
