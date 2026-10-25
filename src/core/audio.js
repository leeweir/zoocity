// 音频：全部用 Web Audio 实时合成（无音频文件）。
//  · 背景音乐：每个地区一套调式/配器的生成式循环（撒瓦纳轻快流行、冰川镇八音盒、撒哈拉阿拉伯音阶、雨林马林巴、兔窝镇乡村、夜晚变柔）
//  · 环境声：城市底噪 + 车流、雨声、风雪、河水；随地区淡入淡出
//  · 音效：脚步、跳跃、对话打字、线索、罚单、结案、警笛（循环）、引擎（随车速变调）、竹蜻蜓旋翼
// 浏览器要求用户手势后才能出声：首次点击/按键时 audio.unlock()。
export class Audio {
  constructor() {
    this.ctx = null; this.enabled = true; this.musicOn = true;
    this.vol = { master: 0.8, music: 0.38, sfx: 0.7, amb: 0.5 };
    try { const s = JSON.parse(localStorage.getItem('zoo-audio') || 'null'); if (s) Object.assign(this, { musicOn: s.musicOn ?? true, enabled: s.enabled ?? true }), Object.assign(this.vol, s.vol || {}); } catch { /* */ }
    this.district = 'savanna'; this.night = 0; this.inside = null;
    this._step = 0; this._nextNote = 0; this._bar = 0;
  }
  save() { try { localStorage.setItem('zoo-audio', JSON.stringify({ musicOn: this.musicOn, enabled: this.enabled, vol: this.vol })); } catch { /* */ } }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.enabled ? this.vol.master : 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    this.master.connect(comp).connect(c.destination);
    this.musicBus = c.createGain(); this.musicBus.gain.value = this.musicOn ? this.vol.music : 0; this.musicBus.connect(this.master);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.vol.sfx; this.sfxBus.connect(this.master);
    this.ambBus = c.createGain(); this.ambBus.gain.value = this.vol.amb; this.ambBus.connect(this.master);
    // 简易混响（给音乐）
    const conv = c.createConvolver(); conv.buffer = this._impulse(2.2); const wet = c.createGain(); wet.gain.value = 0.28;
    this.musicVerb = c.createGain(); this.musicVerb.connect(conv).connect(wet).connect(this.musicBus);
    this.noise = this._noiseBuf();
    this._initAmbience();
    this._nextNote = c.currentTime + 0.1;
  }

  setEnabled(on) { this.enabled = on; if (this.master) this.master.gain.setTargetAtTime(on ? this.vol.master : 0, this.ctx.currentTime, 0.1); this.save(); }
  setMusic(on) { this.musicOn = on; if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? this.vol.music : 0, this.ctx.currentTime, 0.3); this.save(); }

  _impulse(sec) {
    const c = this.ctx, n = c.sampleRate * sec, b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
    return b;
  }
  _noiseBuf() {
    const c = this.ctx, n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.5 + last * 3; }
    return b;
  }
  _noiseSrc(loop = true) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = loop; return s; }

  // ───── 环境声 ─────
  _initAmbience() {
    const c = this.ctx;
    const mk = (type, freq, q) => {
      const src = this._noiseSrc(); const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
      const g = c.createGain(); g.gain.value = 0; src.connect(f).connect(g).connect(this.ambBus); src.start();
      return { g, f };
    };
    this.amb = {
      city: mk('lowpass', 420),        // 城市低频车流嗡嗡声
      rain: mk('highpass', 2600),      // 雨
      wind: mk('bandpass', 500, 0.5),  // 风雪 / 沙漠风
      water: mk('bandpass', 900, 0.4), // 运河水声
      birds: null,
    };
  }
  _ambTarget() {
    const d = this.district, n = this.night, inside = this.inside;
    const T = { city: 0, rain: 0, wind: 0, water: 0 };
    if (inside) { T.city = 0.05; return T; }
    if (d === 'savanna' || d === 'rodentia' || d === 'frontage') T.city = 0.22 * (1 - n * 0.5);
    if (d === 'tundra') { T.wind = 0.22; T.city = 0.08; }
    if (d === 'sahara') { T.wind = 0.1; T.city = 0.12; }
    if (d === 'rainforest') { T.rain = 0.32; T.city = 0.05; }
    if (d === 'bunnyburrow') T.city = 0.02;
    if (d === 'canal') T.water = 0.25;
    if (this.weather === 'rain' && d !== 'rainforest' && d !== 'tundra') T.rain = 0.22;
    if (this.weather === 'snow') T.wind = Math.max(T.wind, 0.28);
    return T;
  }

  // ───── 背景音乐（生成式） ─────
  _scale() {
    // 半音偏移；根音 MIDI
    const S = {
      savanna: { root: 60, mode: [0, 2, 4, 7, 9, 12, 14], bpm: 112, lead: 'square', pad: 'sawtooth', bass: 'triangle', chords: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]] },
      tundra: { root: 64, mode: [0, 2, 3, 7, 8, 12, 14], bpm: 84, lead: 'sine', pad: 'triangle', bass: 'sine', chords: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [7, 10, 14]], bell: true },
      sahara: { root: 62, mode: [0, 1, 4, 5, 7, 8, 11, 12], bpm: 96, lead: 'sawtooth', pad: 'triangle', bass: 'triangle', chords: [[0, 4, 7], [1, 5, 8], [0, 4, 7], [-1, 5, 8]], drone: true },
      rainforest: { root: 57, mode: [0, 2, 4, 7, 9, 12], bpm: 100, lead: 'sine', pad: 'triangle', bass: 'sine', chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], marimba: true },
      bunnyburrow: { root: 67, mode: [0, 2, 4, 5, 7, 9, 12], bpm: 104, lead: 'triangle', pad: 'triangle', bass: 'triangle', chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]] },
      inside: { root: 60, mode: [0, 2, 4, 7, 9], bpm: 76, lead: 'sine', pad: 'sine', bass: 'sine', chords: [[0, 4, 7, 11], [5, 9, 12, 16], [2, 5, 9, 12], [7, 11, 14, 17]] },
      cop: { root: 62, mode: [0, 3, 5, 7, 10, 12], bpm: 138, lead: 'square', pad: 'sawtooth', bass: 'square', chords: [[0, 3, 7], [5, 8, 12], [3, 7, 10], [7, 10, 14]] },
    };
    if (this.copMode) return S.cop;
    if (this.inside) return S.inside;
    return S[this.district] || S.savanna;
  }
  _note(midi, t, dur, type, gain, dest, opts = {}) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    if (opts.detune) o.detune.value = opts.detune;
    const a = opts.attack ?? 0.01, r = opts.release ?? dur * 0.8;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + r);
    let node = o;
    if (opts.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; o.connect(f); node = f; }
    node.connect(g).connect(dest); if (opts.verb) g.connect(this.musicVerb);
    o.start(t); o.stop(t + a + r + 0.05);
  }
  _drum(kind, t, gain) {
    const c = this.ctx;
    if (kind === 'kick') {
      const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g).connect(this.musicBus); o.start(t); o.stop(t + 0.3);
    } else {
      const s = this._noiseSrc(false), f = c.createBiquadFilter(), g = c.createGain();
      f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'hat' ? 0.05 : 0.16));
      s.connect(f).connect(g).connect(this.musicBus); s.start(t, Math.random()); s.stop(t + 0.2);
    }
  }
  _scheduleMusic() {
    const c = this.ctx, sc = this._scale();
    const spb = 60 / (sc.bpm * (1 - this.night * 0.18)), step = spb / 2;  // 八分音符
    while (this._nextNote < c.currentTime + 0.25) {
      const t = this._nextNote, i = this._step % 32, bar = Math.floor(this._step / 8) % 4;
      const ch = sc.chords[bar], r = sc.root, calm = this.night > 0.5 || this.inside;
      // 和弦铺底（每小节）
      if (i % 8 === 0) for (const n of ch) this._note(r - 12 + n, t, spb * 4, sc.pad, 0.035, this.musicBus, { attack: 0.3, release: spb * 4, lp: 1400, verb: true, detune: (Math.random() - 0.5) * 8 });
      // 低音
      if (i % 4 === 0 || (!calm && i % 8 === 6)) this._note(r - 24 + ch[0], t, spb, sc.bass, 0.12, this.musicBus, { release: spb * 0.9, lp: 600 });
      // 旋律：随机游走，偏向和弦音
      if (Math.random() < (calm ? 0.35 : 0.62) && i % 2 === 0 || i % 8 === 0) {
        this._mel = this._mel ?? 3;
        this._mel = Math.max(0, Math.min(sc.mode.length - 1, this._mel + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
        const m = r + sc.mode[this._mel] + (Math.random() < 0.15 ? 12 : 0);
        const g = sc.bell ? 0.06 : sc.marimba ? 0.08 : 0.045;
        this._note(m, t, step * 2, sc.lead, g, this.musicBus, { attack: sc.bell || sc.marimba ? 0.002 : 0.02, release: sc.bell ? 1.2 : sc.marimba ? 0.3 : step * 1.6, lp: sc.lead === 'square' || sc.lead === 'sawtooth' ? 2200 : 6000, verb: true });
        if (sc.bell) this._note(m + 12, t, 0.5, 'sine', 0.02, this.musicBus, { attack: 0.001, release: 0.9, verb: true });
      }
      if (sc.drone && i % 16 === 0) this._note(r - 12, t, spb * 8, 'sawtooth', 0.02, this.musicBus, { attack: 0.5, release: spb * 8, lp: 500 });
      // 鼓（夜晚 / 室内 / 冰川镇更轻）
      if (!calm && !sc.bell) {
        if (i % 4 === 0) this._drum('kick', t, 0.32);
        if (i % 8 === 4) this._drum('snare', t, 0.12);
        if (i % 2 === 1) this._drum('hat', t, 0.04);
      }
      this._nextNote += step; this._step++;
    }
  }

  // ───── 音效 ─────
  _env(g, t, a, peak, r) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + r); }
  sfx(name, opt = {}) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime, out = this.sfxBus;
    const tone = (f0, f1, dur, type = 'sine', gain = 0.2, delay = 0) => {
      const o = c.createOscillator(), g = c.createGain(); o.type = type;
      o.frequency.setValueAtTime(f0, t + delay); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + delay + dur);
      this._env(g, t + delay, 0.005, gain, dur); o.connect(g).connect(out); o.start(t + delay); o.stop(t + delay + dur + 0.05);
    };
    const noise = (freq, dur, gain, type = 'bandpass', q = 1) => {
      const s = this._noiseSrc(false), f = c.createBiquadFilter(), g = c.createGain(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      this._env(g, t, 0.003, gain, dur); s.connect(f).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    };
    switch (name) {
      case 'step': noise(opt.surface === 'snow' ? 1200 : opt.surface === 'sand' ? 900 : opt.surface === 'grass' ? 700 : 2200, 0.06, 0.06 * (opt.gain ?? 1), 'bandpass', 1.2); break;
      case 'jump': tone(300, 620, 0.14, 'triangle', 0.12); break;
      case 'land': noise(300, 0.12, 0.16, 'lowpass'); break;
      case 'type': tone(900 + Math.random() * 200, null, 0.025, 'square', 0.025); break;
      case 'clue': [0, 4, 7, 12].forEach((n, i) => tone(660 * Math.pow(2, n / 12), null, 0.25, 'triangle', 0.12, i * 0.07)); break;
      case 'evidence': tone(880, 1320, 0.18, 'sine', 0.12); tone(1320, null, 0.25, 'sine', 0.08, 0.1); break;
      case 'ticket': noise(4000, 0.05, 0.2, 'highpass'); tone(1200, 1800, 0.08, 'square', 0.06, 0.04); tone(1800, null, 0.15, 'triangle', 0.1, 0.12); break;
      case 'solve': [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone(523 * Math.pow(2, n / 12), null, 0.5, 'triangle', 0.12, i * 0.09)); break;
      case 'fail': tone(300, 150, 0.5, 'sawtooth', 0.08); break;
      case 'ui': tone(1000, null, 0.04, 'sine', 0.06); break;
      case 'door': noise(500, 0.25, 0.18, 'lowpass'); tone(180, 120, 0.2, 'triangle', 0.1, 0.05); break;
      case 'splash': noise(900, 0.5, 0.25, 'lowpass'); noise(3000, 0.3, 0.12, 'highpass'); break;
      case 'stroke': noise(700, 0.18, 0.07, 'bandpass', 0.8); break;
      case 'bell': tone(2400, null, 0.12, 'triangle', 0.08); tone(2400, null, 0.14, 'triangle', 0.06, 0.16); break;
      case 'honk': tone(392, null, 0.35, 'square', 0.08); tone(494, null, 0.35, 'square', 0.06); break;
    }
  }
  // 引擎：持续音，随速度变调
  engine(on, speed = 0) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (on && !this._eng) {
      const o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 600; g.gain.value = 0;
      o.connect(f); o2.connect(f); f.connect(g).connect(this.sfxBus); o.start(); o2.start();
      this._eng = { o, o2, f, g };
    }
    if (this._eng) {
      const e = this._eng, t = c.currentTime, s = Math.abs(speed);
      e.o.frequency.setTargetAtTime(42 + s * 3.2, t, 0.1); e.o2.frequency.setTargetAtTime(21 + s * 1.6, t, 0.1);
      e.f.frequency.setTargetAtTime(400 + s * 40, t, 0.1);
      e.g.gain.setTargetAtTime(on ? 0.05 + Math.min(0.06, s / 400) : 0, t, 0.15);
    }
  }
  siren(on) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (on && !this._siren) {
      const o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
      o.type = 'square'; o.frequency.value = 750; lfo.frequency.value = 0.9; lg.gain.value = 280;
      lfo.connect(lg).connect(o.frequency); g.gain.value = 0; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
      o.connect(f).connect(g).connect(this.sfxBus); o.start(); lfo.start(); g.gain.setTargetAtTime(0.05, c.currentTime, 0.05);
      this._siren = { o, lfo, g };
    } else if (!on && this._siren) {
      const s = this._siren; s.g.gain.setTargetAtTime(0, c.currentTime, 0.05); setTimeout(() => { s.o.stop(); s.lfo.stop(); }, 300); this._siren = null;
    }
  }
  copter(on) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (on && !this._cop) {
      const s = this._noiseSrc(), f = c.createBiquadFilter(), g = c.createGain(), am = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      f.type = 'bandpass'; f.frequency.value = 380; f.Q.value = 2; lfo.frequency.value = 22; lg.gain.value = 0.5; am.gain.value = 0.5;
      lfo.connect(lg).connect(am.gain); s.connect(f).connect(am).connect(g).connect(this.sfxBus); g.gain.value = 0; s.start(); lfo.start();
      g.gain.setTargetAtTime(0.22, c.currentTime, 0.2);
      this._cop = { s, g, lfo };
    } else if (!on && this._cop) {
      const k = this._cop; k.g.gain.setTargetAtTime(0, c.currentTime, 0.2); setTimeout(() => { k.s.stop(); k.lfo.stop(); }, 800); this._cop = null;
    }
  }

  update(dt, { district, night, inside, weather, copMode }) {
    if (!this.ctx) return;
    if (district && district !== 'outskirts') this.district = district;
    this.night = night; this.inside = inside; this.weather = weather; this.copMode = copMode;
    const T = this._ambTarget(), t = this.ctx.currentTime;
    for (const k of Object.keys(T)) this.amb[k]?.g.gain.setTargetAtTime(T[k], t, 1.2);
    if (this.musicOn && this.enabled) this._scheduleMusic(); else this._nextNote = this.ctx.currentTime + 0.1;
  }
}
