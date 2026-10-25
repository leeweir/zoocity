// 侦探系统：案件进度、线索点、证据档案、推理板
import * as THREE from 'three';
import { CASES, BOGO } from './cases.js';
import { LANDMARKS } from '../world/layout.js';
import { StoryNPC, iconOf } from './npcs.js';
import { esc } from '../ui/ui.js';

const HERO_NAME = { judy: '朱迪', nick: '尼克' };
const RANKS = [[0, '见习警员'], [150, '警员'], [400, '警长'], [800, '探长'], [1300, '传奇侦探']];
const SAVE_KEY = 'zootopia-detective-save-v1';

function resolvePos(at) {
  if (at.at) {
    const L = LANDMARKS[at.at];
    const b = L.front || { x: L.x, z: L.z };
    return { x: b.x + (at.dx || 0), z: b.z + (at.dz || 0) };
  }
  return { x: at.x, z: at.z };
}

export class Detective {
  constructor({ scene, col, ui, player, interact }) {
    Object.assign(this, { scene, col, ui, player, interact });
    this.active = null;        // 当前案件状态
    this.solved = {};          // id -> true
    this.rep = 0;
    this.npcs = new Map();     // key -> StoryNPC
    this.clueMeshes = new Map();
    this.sense = 0;            // 侦探感知剩余时间
    this._load();
    // 牛局长
    this.bogo = this._spawnNPC('bogo', BOGO);
    this.interact.add({ id: 'bogo', get x() { return this.npc.pos.x; }, get z() { return this.npc.pos.z; }, npc: this.bogo, radius: 2.6, y: 2.6, label: '和牛局长谈话（领取案件）', onInteract: () => this.openCaseBoard() });
    // 线索闪光几何体
    this._clueGeo = new THREE.OctahedronGeometry(0.22, 0);
    this._clueMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false });
    this._ringGeo = new THREE.RingGeometry(0.5, 0.62, 32).rotateX(-Math.PI / 2);
    this._ringMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.6, toneMapped: false, side: THREE.DoubleSide, depthWrite: false });
  }

  get rank() { let r = RANKS[0][1]; for (const [v, n] of RANKS) if (this.rep >= v) r = n; return r; }

  _save() {
    try {
      const a = this.active;
      localStorage.setItem(SAVE_KEY, JSON.stringify({ solved: this.solved, rep: this.rep, active: a && { id: a.def.id, step: a.step, done: [...a.done], evidence: [...a.evidence], unlocked: [...a.unlocked] } }));
    } catch { /* 无痕模式 */ }
  }
  _load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!s) return;
      this.solved = s.solved || {}; this.rep = s.rep || 0;
      this._pendingActive = s.active;
    } catch { /* ignore */ }
  }
  restore() {
    const s = this._pendingActive; this._pendingActive = null;
    if (!s) return;
    const def = CASES.find(c => c.id === s.id);
    if (!def) return;
    this.startCase(def, true);
    Object.assign(this.active, { step: s.step, done: new Set(s.done), evidence: new Set(s.evidence), unlocked: new Set(s.unlocked) });
    this._refreshStep();
  }
  resetSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* */ } location.reload(); }

  _spawnNPC(key, def) {
    let p = resolvePos(def.at);
    // 找附近空地
    for (let r = 0; r < 8 && this.col.blocked(p.x, p.z, 0.8); r++) {
      const a = r * 2.1; p = { x: p.x + Math.cos(a) * (1 + r), z: p.z + Math.sin(a) * (1 + r) };
    }
    const n = new StoryNPC(this.scene, this.col, def, { ...p, ry: def.ry ?? 0 });
    this.npcs.set(key, n);
    return n;
  }

  // ───── 案件开始 ─────
  startCase(def, silent = false) {
    this.abandon(true);
    const a = { def, step: 0, done: new Set(), evidence: new Set(), unlocked: new Set(), clueObjs: [] };
    this.active = a;
    for (const [k, nd] of Object.entries(def.npcs)) {
      const n = this._spawnNPC(k, nd);
      this.interact.add({ id: 'npc:' + k, npc: n, get x() { return this.npc.pos.x; }, get z() { return this.npc.pos.z; }, radius: Math.max(2, n.height * 0.8), y: n.height + 0.3, label: `和${nd.name}谈话`, onInteract: () => this.talkTo(k) });
    }
    for (const [k, cd] of Object.entries(def.clues)) {
      let p = resolvePos(cd.at);
      for (let r = 0; r < 8 && this.col.blocked(p.x, p.z, 0.4); r++) p = { x: p.x + (r % 2 ? 1 : -1) * (r + 1), z: p.z + 1 };
      const y = this.col.groundAt(p.x, p.z, 30);
      const g = new THREE.Group();
      const gem = new THREE.Mesh(this._clueGeo, this._clueMat); gem.position.y = 0.6; g.add(gem);
      const ring = new THREE.Mesh(this._ringGeo, this._ringMat); ring.position.y = 0.04; g.add(ring);
      g.position.set(p.x, y, p.z);
      g.visible = false;
      this.scene.add(g);
      this.clueMeshes.set(k, { g, gem, ring, x: p.x, z: p.z, y });
      this.interact.add({ id: 'clue:' + k, x: p.x, z: p.z, y: y + 1, radius: 1.8, label: `调查：${cd.name}`, enabled: () => this._clueActive(k), onInteract: () => this.examine(k) });
    }
    if (!silent) {
      this.ui.toast(`📁 新案件：<b>${esc(def.title)}</b>`);
      this.ui.dialog([['旁白', def.intro]], w => this.speaker(w));
    }
    this._refreshStep();
    this._save();
  }

  abandon(silent) {
    const a = this.active; if (!a) return;
    for (const k of Object.keys(a.def.npcs)) { this.npcs.get(k)?.dispose(); this.npcs.delete(k); this.interact.remove('npc:' + k); }
    for (const k of Object.keys(a.def.clues)) { const c = this.clueMeshes.get(k); if (c) this.scene.remove(c.g); this.clueMeshes.delete(k); this.interact.remove('clue:' + k); }
    this.active = null;
    if (!silent) { this.ui.toast('案件已暂停，可以随时找牛局长重新接手。'); this._save(); }
    this.ui.setObjective(null);
  }

  get stepDef() { const a = this.active; return a && a.def.steps[a.step]; }

  _taskKey(t) { return t.type === 'clue' ? 'clue:' + t.clue : t.type === 'deduce' ? 'deduce:' + t.npc : 'talk:' + t.npc; }
  _clueActive(k) {
    const s = this.stepDef; if (!s) return false;
    return s.tasks.some(t => t.type === 'clue' && t.clue === k) && !this.active.done.has('clue:' + k);
  }

  _refreshStep() {
    const a = this.active; if (!a) return;
    const s = this.stepDef;
    for (const [k, c] of this.clueMeshes) c.g.visible = this._clueActive(k);
    if (!s) return;
    const items = s.tasks.length > 1 ? s.tasks.map(t => ({ text: this._taskText(t), done: a.done.has(this._taskKey(t)) })) : [];
    this.objective = { caseTitle: a.def.title, text: s.objective, items };
  }
  _taskText(t) {
    const a = this.active;
    if (t.type === 'clue') return '调查：' + a.def.clues[t.clue].name;
    if (t.type === 'talk') return '询问：' + a.def.npcs[t.npc].name + (t.hero ? `（${HERO_NAME[t.hero]}更合适）` : '');
    return '推理';
  }

  // 当前目标的位置（用于导航指引）
  targetPos(from) {
    const a = this.active; if (!a) { return { x: this.bogo.pos.x, z: this.bogo.pos.z, label: '牛局长' }; }
    const s = this.stepDef; if (!s) return null;
    let best = null, bd = Infinity;
    for (const t of s.tasks) {
      if (a.done.has(this._taskKey(t))) continue;
      let p;
      if (t.type === 'clue') { const c = this.clueMeshes.get(t.clue); p = { x: c.x, z: c.z, label: a.def.clues[t.clue].name, icon: '🔍' }; }
      else { const n = this.npcs.get(t.npc); p = { x: n.pos.x, z: n.pos.z, label: a.def.npcs[t.npc].name, icon: '❗' }; }
      const d = (p.x - from.x) ** 2 + (p.z - from.z) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  speaker(who, npcKey) {
    const hero = this.player.current, buddy = this.player.buddyKey;
    if (who === 'hero') who = hero;
    if (who === 'buddy') who = buddy;
    if (who === 'judy') return { name: '朱迪', cls: 'judy', sub: 'ZPD 警官' };
    if (who === 'nick') return { name: '尼克', cls: 'nick', sub: 'ZPD 警官' };
    if (who === '旁白') return { name: '旁白', cls: 'narr' };
    if (who === 'npc') {
      const d = npcKey === 'bogo' ? BOGO : this.active?.def.npcs[npcKey];
      return { name: d?.name || '？', sub: d?.title };
    }
    return { name: who };
  }

  _play(lines, npcKey, onEnd) {
    const n = this.npcs.get(npcKey);
    if (n) n.talking = true;
    this.player.talking = true;
    this.inConversation = { npc: n };
    this.ui.dialog(lines, w => this.speaker(w, npcKey), {
      onChoice: (c, peek) => {
        if (peek) return c.hero && c.hero !== this.player.current ? { locked: `需要${HERO_NAME[c.hero]}` } : {};
        return { lines: c.reply || [], good: !!c.good };
      },
      onEnd: aborted => { if (n) n.talking = false; this.player.talking = false; this.inConversation = null; if (!aborted) onEnd?.(); },
    });
  }

  talkTo(key) {
    const a = this.active; if (!a) return;
    const s = this.stepDef;
    const npcDef = a.def.npcs[key];
    const task = s?.tasks.find(t => (t.type === 'talk' || t.type === 'deduce') && t.npc === key && !a.done.has(this._taskKey(t)));
    if (task?.type === 'deduce') {
      if (!s.tasks.every(t => t === task || a.done.has(this._taskKey(t)))) return;
      return this._play([['npc', '警官，有结论了吗？']], key, () => this.openDeduction(key));
    }
    if (!task) {
      // 闲聊 / 提示
      const idle = a.done.has('talk:' + key)
        ? [['npc', '我知道的都告诉你们了。']]
        : [['npc', '嗯？我现在没什么好说的。'], ['旁白', `当前目标：${s?.objective || ''}`]];
      return this._play(idle, key);
    }
    if (task.hero && task.hero !== this.player.current && task.wrongHero) {
      return this._play(task.wrongHero, key);
    }
    this._play(task.lines, key, () => {
      a.done.add('talk:' + key);
      if (task.unlocks) a.unlocked.add(task.unlocks);
      for (const e of task.gives || []) this._addEvidence(e);
      this._afterTask();
    });
  }

  examine(k) {
    const a = this.active; if (!a) return;
    const cd = a.def.clues[k];
    if (cd.locked && !a.unlocked.has(cd.locked)) return this._play([['旁白', cd.lockedText]]);
    if (cd.hero && cd.hero !== this.player.current) return this._play([['旁白', cd.wrongHero], ['旁白', '（按 Tab 切换角色）']]);
    const who = this.player.current;
    this._play([['旁白', `${cd.icon} 发现线索：「${cd.name}」`], [who, cd.desc]], null, () => {
      a.done.add('clue:' + k);
      this._addEvidence(k, true);
      this._afterTask();
    });
  }

  _addEvidence(id, isClue) {
    const a = this.active;
    if (a.evidence.has(id)) return;
    a.evidence.add(id);
    const e = isClue ? a.def.clues[id] : a.def.evidence[id];
    this.ui.toast(`${e.icon} 证据已加入档案：<b>${esc(e.name)}</b> <kbd>J</kbd>`);
  }

  _afterTask() {
    const a = this.active; const s = this.stepDef;
    this._refreshStep();
    if (s && s.tasks.every(t => t.type === 'deduce' || a.done.has(this._taskKey(t))) && !s.tasks.some(t => t.type === 'deduce')) {
      a.step++;
      this._refreshStep();
      const ns = this.stepDef;
      if (ns) this.ui.toast(`🎯 新目标：${esc(ns.objective)}`);
    }
    this._save();
  }

  // ───── 推理板 ─────
  openDeduction(npcKey) {
    const a = this.active; const d = a.def;
    let culprit = null; const chosen = new Set();
    const evList = [...a.evidence].map(id => ({ id, ...(d.clues[id] || d.evidence[id]) }));
    const render = () => {
      const m = this.ui.modal(`<div class="sheet">
        <button class="close">×</button>
        <h2>🧠 推理时间 · ${esc(d.title)}</h2>
        <div class="meta">选出真正的责任人，并出示至少 ${d.solution.need} 件能证明你推理的证据。</div>
        <div class="deduceStep">① 谁是这件事的真相关键？</div>
        <div class="grid">${d.suspects.map(k => { const n = d.npcs[k]; return `<div class="card pick suspect ${culprit === k ? 'sel' : ''}" data-s="${k}"><div class="ic">${iconOf(n.species)}</div><h4>${esc(n.name)}</h4><p>${esc(n.title)}</p></div>`; }).join('')}</div>
        <div class="deduceStep">② 出示证据（已选 ${chosen.size}）</div>
        <div class="grid">${evList.map(e => `<div class="card pick ${chosen.has(e.id) ? 'sel' : ''}" data-e="${e.id}"><div class="ic">${e.icon}</div><h4>${esc(e.name)}</h4><p>${esc(e.desc)}</p></div>`).join('')}</div>
        <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end">
          <button class="btn ghost" data-act="cancel">再想想</button>
          <button class="btn" data-act="go" ${culprit && chosen.size >= d.solution.need ? '' : 'disabled'}>就是这样！</button>
        </div></div>`);
      m.querySelectorAll('[data-s]').forEach(c => c.onclick = () => { culprit = c.dataset.s; render(); });
      m.querySelectorAll('[data-e]').forEach(c => c.onclick = () => { const id = c.dataset.e; chosen.has(id) ? chosen.delete(id) : chosen.add(id); render(); });
      m.querySelector('[data-act=cancel]').onclick = () => this.ui.closeModal();
      m.querySelector('[data-act=go]').onclick = () => { this.ui.closeModal(); this._judge(npcKey, culprit, [...chosen]); };
    };
    render();
  }

  _judge(npcKey, culprit, ev) {
    const d = this.active.def;
    const right = culprit === d.solution.culprit;
    const relevant = ev.filter(e => d.solution.evidence.includes(e)).length;
    if (right && relevant >= d.solution.need) {
      this.ui.stamp('结案！', '#3bb273');
      setTimeout(() => this._play(d.epilogue, npcKey, () => this._complete()), 900);
    } else if (right) {
      this._play([['buddy', '方向是对的，但这些证据还不足以说服别人。再挑挑能直接证明的证据。'], ['npc', '警官，你说的我不太信服……']], npcKey);
    } else {
      this.rep = Math.max(0, this.rep - 10);
      const n = d.npcs[culprit];
      this._play([['buddy', `等等……${n.name}？这些证据说不通。我们是不是漏了什么？`], ['旁白', '推理失败（声望 -10）。回顾档案里的证据，再试一次。']], npcKey);
    }
  }

  _complete() {
    const d = this.active.def;
    this.rep += d.reward;
    this.solved[d.id] = true;
    this.ui.toast(`🏅 案件「${esc(d.title)}」告破！声望 +${d.reward}`, 4500);
    this.abandon(true);
    this._save();
    const next = CASES.find(c => !this.solved[c.id]);
    if (next) setTimeout(() => this.ui.toast('🐃 回 ZPD 找牛局长领取下一个案件。'), 1500);
    else setTimeout(() => this.ui.toast('🎉 你已经破获了所有案件！动物城因你们而更美好。', 6000), 1500);
  }

  // ───── 案件板 / 档案 ─────
  openCaseBoard() {
    const rows = CASES.map((c, i) => {
      const unlocked = i === 0 || this.solved[CASES[i - 1].id] || this.solved[c.id];
      const st = this.solved[c.id] ? '<span class="st ok">✔ 已结案</span>' : this.active?.def.id === c.id ? '<span class="st on">● 进行中</span>' : '';
      const btn = this.active?.def.id === c.id ? '' : unlocked ? `<button data-c="${c.id}">${this.solved[c.id] ? '重温' : '接手'}</button>` : '<span class="st">🔒 先完成上一个案件</span>';
      return `<div class="caseRow"><div style="font-size:28px">${['🍩', '👑', '🧊', '🌧️', '🖼️', '🛸'][i]}</div><div><b>${esc(c.title)}</b><div style="font-size:12px;opacity:.65">${esc(c.district)} · 难度 ${'★'.repeat(c.difficulty)}</div></div>${st}${btn}</div>`;
    }).join('');
    const m = this.ui.modal(`<div class="sheet"><button class="close">×</button>
      <h2>🐃 牛局长的案件板</h2>
      <div class="meta">“霍普斯，王尔德。动物城不缺麻烦，缺的是能解决麻烦的警察。别让我失望。” — 当前声望 ⭐ ${this.rep}（${this.rank}）</div>
      ${rows}
      <div class="caseRow" style="background:#eaf2ff"><div style="font-size:28px">🚔</div><div><b>交警值班 · 200 张罚单挑战</b><div style="font-size:12px;opacity:.65">3 分钟限时 · 开罚单拿分 · 可随时按 T 切换</div></div><button data-cop="1">开始值班</button></div>
      ${this.active ? '<div style="text-align:right;margin-top:10px"><button class="btn ghost" data-ab="1">暂停当前案件</button></div>' : ''}
    </div>`);
    m.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
      const def = CASES.find(c => c.id === b.dataset.c);
      this.ui.closeModal();
      this._play([['npc', ['霍普斯！王尔德！有新案子了。', '又有麻烦了。别站着，去处理。', '这个案子交给你们。记住：证据说话。'][Math.floor(Math.random() * 3)]]], 'bogo', () => this.startCase(def));
    });
    const ab = m.querySelector('[data-ab]'); if (ab) ab.onclick = () => { this.ui.closeModal(); this.abandon(); };
    const cp = m.querySelector('[data-cop]'); if (cp) cp.onclick = () => { this.ui.closeModal(); this._play([['npc', '交通违章是动物城的头号麻烦。霍普斯，你以前能在中午前开出两百张罚单——证明给我看。']], 'bogo', () => this.onTrafficDuty?.()); };
  }

  openCasebook() {
    const a = this.active;
    let tab = 'ev';
    const render = () => {
      let body = '';
      if (!a) body = '<p>当前没有进行中的案件。去 ZPD 第一分局门口找牛局长领取案件吧。</p>';
      else if (tab === 'ev') {
        const ev = [...a.evidence].map(id => a.def.clues[id] || a.def.evidence[id]);
        body = ev.length ? `<div class="grid">${ev.map(e => `<div class="card"><div class="ic">${e.icon}</div><h4>${esc(e.name)}</h4><p>${esc(e.desc)}</p></div>`).join('')}</div>` : '<p>还没有收集到证据。</p>';
      } else if (tab === 'np') {
        body = `<div class="grid">${Object.entries(a.def.npcs).map(([k, n]) => `<div class="card"><div class="ic">${iconOf(n.species)}</div><h4>${esc(n.name)}</h4><p>${esc(n.title)}</p>${a.def.suspects.includes(k) ? '<span class="tag">相关者</span>' : ''}${a.done.has('talk:' + k) ? '<span class="tag" style="top:32px">已询问</span>' : ''}</div>`).join('')}</div>`;
      } else {
        body = `<p style="line-height:1.8">${esc(a.def.intro)}</p><div class="deduceStep">进度</div>` + a.def.steps.map((s, i) => `<div style="padding:4px 0;opacity:${i < a.step ? .5 : 1}">${i < a.step ? '✔' : i === a.step ? '▶' : '○'} ${esc(i <= a.step ? s.objective : '？？？')}</div>`).join('');
      }
      const m = this.ui.modal(`<div class="sheet"><button class="close">×</button>
        <h2>📒 侦探档案${a ? ' · ' + esc(a.def.title) : ''}</h2>
        <div class="meta">${a ? esc(a.def.district) : ''} · 声望 ⭐ ${this.rep}（${this.rank}）</div>
        ${a ? `<div class="tabs"><button data-t="case" class="${tab === 'case' ? 'on' : ''}">案情</button><button data-t="ev" class="${tab === 'ev' ? 'on' : ''}">证据 (${a.evidence.size})</button><button data-t="np" class="${tab === 'np' ? 'on' : ''}">相关人物</button></div>` : ''}
        ${body}</div>`);
      m.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
    };
    render();
  }

  // ───── 每帧 ─────
  update(dt, t, playerPos) {
    for (const n of this.npcs.values()) n.update(dt, playerPos);
    if (this.sense > 0) this.sense -= dt;
    for (const c of this.clueMeshes.values()) {
      if (!c.g.visible) continue;
      c.gem.rotation.y += dt * 2; c.gem.position.y = 0.6 + Math.sin(t * 3) * 0.08;
      const s = 1 + (this.sense > 0 ? 1.5 + Math.sin(t * 6) * 0.4 : Math.sin(t * 2) * 0.1);
      c.ring.scale.setScalar(s);
    }
  }
}
