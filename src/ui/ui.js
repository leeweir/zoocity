// UI：HUD、对话框（打字机效果 + 选项）、提示、模态窗
const $ = (sel, root = document) => root.querySelector(sel);
export const el = (tag, attrs = {}, html = '') => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  if (html) e.innerHTML = html;
  return e;
};
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
  constructor() {
    this.root = $('#ui');
    this.root.innerHTML = `
      <div id="hud" class="hidden">
        <div id="hud-top">
          <div class="chip" id="heroChip"><span class="face">🐰</span><div><b class="nm">朱迪</b><small>Tab 切换</small><div id="stamina"><i></i></div></div></div>
          <div class="chip" id="clock">09:00</div>
          <div class="chip" id="rep">⭐ 0</div>
        </div>
        <div class="chip hidden" id="objective"></div>
        <div id="minimap"><canvas width="420" height="420"></canvas><div class="n"></div></div>
        <div class="chip hidden" id="prompt"></div>
        <div id="help">
          <kbd>WASD</kbd> 移动 · <kbd>Shift</kbd> 奔跑 · <kbd>Space</kbd> 跳跃 · <kbd>E</kbd> 互动<br>
          <kbd>Q</kbd> 侦探感知 · <kbd>Tab</kbd> 切换角色 · <kbd>F</kbd> 上/下警车 · <kbd>H</kbd> 警笛<br>
          <kbd>J</kbd> 侦探档案 · <kbd>M</kbd> 地图/快速出行 · <kbd>Esc</kbd> 菜单<br>
          空中 <kbd>Space</kbd> 滑翔伞 · <kbd>T</kbd> 交警模式
        </div>
        <div id="fps"></div>
        <div id="touchBtns">
          <button class="tb big" id="tbAct" data-k="KeyE">E</button>
          <button class="tb" data-k="Space" data-hold="1">跳</button>
          <button class="tb" data-k="KeyF" id="tbCar">🚓</button>
          <button class="tb" data-k="KeyQ">🔍</button>
          <button class="tb" data-k="Tab" id="tbSwap">🦊</button>
        </div>
        <div id="touchTop">
          <button class="tb sm" data-k="KeyJ">📒</button>
          <button class="tb sm" data-k="KeyM">🗺️</button>
          <button class="tb sm" data-k="KeyH" id="tbSiren">🚨</button>
          <button class="tb sm" data-k="KeyT" id="tbCop">🚔</button>
          <button class="tb sm" data-k="Escape">⏸</button>
        </div>
      </div>
      <div id="district"><div class="n"></div><div class="e"></div></div>
      <div id="toast"></div>
      <div id="markers"></div>
      <div id="dialog" class="hidden"><div class="box"><div class="who"></div><div class="text"></div><div class="choices"></div><div class="next">点击继续 ▼</div></div></div>
      <div id="modal" class="modal hidden"></div>
    `;
    this.dialogEl = $('#dialog');
    this.modalEl = $('#modal');
    this.markersEl = $('#markers');
    this._markerPool = [];
    this._dlg = null;
    this.dialogEl.addEventListener('click', e => { if (!e.target.closest('button')) this.advance(); });
    addEventListener('keydown', e => {
      if (!this._dlg) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') { e.preventDefault(); this.advance(); }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9 && this._dlg.choiceBtns) this._dlg.choiceBtns[n - 1]?.click();
    });
  }

  // 触屏按钮 → 虚拟按键
  bindTouch(input) {
    document.body.classList.toggle('touch', input.touch);
    if (!input.touch) return;
    $('#heroChip small').textContent = '点击切换';
    $('#heroChip').addEventListener('click', () => input.tap('Tab'));
    for (const b of this.root.querySelectorAll('.tb')) {
      const k = b.dataset.k;
      b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); b.classList.add('down'); input.press(k); }, { passive: false });
      const up = e => { e.preventDefault(); b.classList.remove('down'); input.release(k); };
      b.addEventListener('touchend', up); b.addEventListener('touchcancel', up);
    }
  }
  // 根据上下文更新触屏按钮：act = 主互动按钮文字（null 隐藏），car = 是否显示上/下车，driving
  touchState({ act, car, driving, hero }) {
    const a = $('#tbAct');
    if (!a) return;
    a.style.display = act ? '' : 'none';
    if (act && a._t !== act) { a.textContent = act; a._t = act; }
    $('#tbCar').style.display = car || driving ? '' : 'none';
    $('#tbCar').textContent = driving ? '下车' : '🚓';
    $('#tbSiren').style.display = driving ? '' : 'none';
    $('#tbSwap').textContent = hero === 'judy' ? '🦊' : '🐰';
  }

  show(id, on = true) { $('#' + id).classList.toggle('hidden', !on); }

  setHero(key) {
    $('#heroChip .face').textContent = key === 'judy' ? '🐰' : '🦊';
    $('#heroChip .nm').textContent = key === 'judy' ? '朱迪·霍普斯' : '尼克·王尔德';
  }
  setStamina(v) { $('#stamina i').style.width = (v * 100).toFixed(0) + '%'; }
  setClock(h) {
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    const icon = h > 6 && h < 18.5 ? '☀️' : '🌙';
    $('#clock').textContent = `${icon} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  setRep(v, rank) { $('#rep').textContent = `⭐ ${v} · ${rank}`; }
  setFps(t) { $('#fps').textContent = t; }

  setObjective(o) {
    const e = $('#objective');
    if (!o) { e.classList.add('hidden'); return; }
    e.classList.remove('hidden');
    e.innerHTML = `<div class="case">📁 ${esc(o.caseTitle)}</div><div class="txt">${esc(o.text)}</div>` +
      (o.items?.length ? `<ul>${o.items.map(i => `<li class="${i.done ? 'done' : ''}">${esc(i.text)}</li>`).join('')}</ul>` : '') +
      (o.dist != null ? `<div class="dist">📍 ${o.dist < 1000 ? Math.round(o.dist) + ' m' : (o.dist / 1000).toFixed(1) + ' km'}</div>` : '');
  }

  prompt(text) {
    const e = $('#prompt');
    if (!text) { e.classList.add('hidden'); return; }
    e.classList.remove('hidden');
    if (e._t !== text) { e.innerHTML = text; e._t = text; }
  }

  toast(html, ms = 3200) {
    const t = el('div', { class: 'toast' }, html);
    $('#toast').appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = 0; setTimeout(() => t.remove(), 400); }, ms);
  }

  districtBanner(name, en) {
    const d = $('#district');
    $('.n', d).textContent = name; $('.e', d).textContent = en;
    d.style.opacity = 1;
    clearTimeout(this._db);
    this._db = setTimeout(() => d.style.opacity = 0, 2600);
  }

  stamp(text, color = '#e5534b') {
    const s = el('div', { class: 'stamp' }, esc(text));
    s.style.color = color; s.style.borderColor = color;
    document.body.appendChild(s);
    setTimeout(() => { s.style.transition = 'opacity .6s'; s.style.opacity = 0; setTimeout(() => s.remove(), 600); }, 1800);
  }

  // —— 对话 ——
  // lines: [[speakerKey, text] | {choices}], resolveSpeaker(key) -> {name, cls, sub}
  // onChoice(choice) 返回 { lines?, good } —— 由调用方处理
  dialog(lines, resolveSpeaker, { onChoice, onEnd } = {}) {
    this.dialogEl.classList.remove('hidden');
    this._dlg = { queue: [...lines], resolveSpeaker, onChoice, onEnd, typing: null };
    this._nextLine();
  }
  get inDialog() { return !!this._dlg; }
  _nextLine() {
    const d = this._dlg;
    const box = $('.box', this.dialogEl);
    const choicesEl = $('.choices', box);
    choicesEl.innerHTML = ''; d.choiceBtns = null;
    $('.next', box).style.display = '';
    if (!d.queue.length) return this._end(false);
    const item = d.queue.shift();
    if (item.choices) {
      $('.next', box).style.display = 'none';
      const avail = item.choices;
      d.pendingChoice = item;
      d.choiceBtns = [];
      avail.forEach((c, i) => {
        const r = d.onChoice ? d.onChoice(c, true) : { ok: true };
        const b = el('button', { class: (c._used ? 'used ' : '') + (r.locked ? 'locked' : '') }, `${i + 1}. ${esc(c.text)}${r.locked ? ` <small>（${esc(r.locked)}）</small>` : ''}`);
        b.onclick = () => {
          if (r.locked) return;
          c._used = true;
          const res = d.onChoice ? d.onChoice(c, false) : { lines: c.reply, good: true };
          const after = [...(res.lines || [])];
          if (!res.good) after.push(item); // 回到选项
          d.queue.unshift(...after);
          this._nextLine();
        };
        choicesEl.appendChild(b); d.choiceBtns.push(b);
      });
      const leave = el('button', { class: 'used' }, `${avail.length + 1}. ↩ 先离开（稍后再谈）`);
      leave.onclick = () => this._end(true);
      choicesEl.appendChild(leave); d.choiceBtns.push(leave);
      return;
    }
    const [who, text] = item;
    const sp = d.resolveSpeaker(who);
    const whoEl = $('.who', box);
    whoEl.className = 'who ' + (sp.cls || '');
    whoEl.innerHTML = `${esc(sp.name)}${sp.sub ? `<small>${esc(sp.sub)}</small>` : ''}`;
    whoEl.style.display = sp.name ? '' : 'none';
    const tEl = $('.text', box);
    tEl.className = 'text ' + (sp.cls === 'narr' ? 'narr' : '');
    // 打字机
    let i = 0;
    clearInterval(d.typing);
    tEl.textContent = '';
    d.full = text; d.tEl = tEl;
    d.typing = setInterval(() => {
      i += 2; tEl.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(d.typing); d.typing = null; }
    }, 22);
    d.onLine?.(who);
    this.onSpeak?.(who);
  }
  _end(aborted) {
    const d = this._dlg;
    clearInterval(d.typing);
    this.dialogEl.classList.add('hidden'); this._dlg = null; d.onEnd?.(aborted);
  }
  advance() {
    const d = this._dlg; if (!d) return;
    if (d.choiceBtns) return;
    if (d.typing) { clearInterval(d.typing); d.typing = null; d.tEl.textContent = d.full; return; }
    this._nextLine();
  }

  // —— 模态 ——
  modal(html, { onClose } = {}) {
    this.modalEl.innerHTML = html;
    this.modalEl.classList.remove('hidden');
    this._modalClose = onClose;
    const c = this.modalEl.querySelector('.close');
    if (c) c.onclick = () => this.closeModal();
    return this.modalEl;
  }
  get modalOpen() { return !this.modalEl.classList.contains('hidden'); }
  closeModal() {
    if (!this.modalOpen) return;
    this.modalEl.classList.add('hidden'); this.modalEl.innerHTML = '';
    const f = this._modalClose; this._modalClose = null; f?.();
  }

  // —— 屏幕标记（名字牌 / 目标图标） ——
  markers(list) {
    // list: [{ x, y, text, cls }] 屏幕坐标
    while (this._markerPool.length < list.length) {
      const m = el('div'); this.markersEl.appendChild(m); this._markerPool.push(m);
    }
    this._markerPool.forEach((m, i) => {
      const it = list[i];
      if (!it) { m.style.display = 'none'; return; }
      m.style.display = '';
      m.className = it.cls;
      if (m._h !== it.html) { m.innerHTML = it.html; m._h = it.html; }
      m.style.left = it.x + 'px'; m.style.top = it.y + 'px';
      m.style.opacity = it.alpha ?? 1;
    });
  }
}
