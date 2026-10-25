// 疯狂动物城 · 侦探档案 —— 主程序
import * as THREE from 'three';
import { Builder, SharedUniforms, rng } from './core/builder.js';
import { Colliders } from './core/collision.js';
import * as tex from './core/tex.js';
import { Input, IS_TOUCH } from './core/input.js';
import * as layout from './world/layout.js';
import { createEnvironment } from './world/environment.js';
import { buildHighway } from './world/highway.js';
import { buildCurves, shouldReject } from './world/curves.js';
import { buildFrontage, frontageReject } from './world/frontage.js';
import { Player, ThirdPersonCamera } from './game/player.js';
import { Vehicle, Traffic, createCarModel } from './game/vehicles.js';
import { Crowd, ambientLine, iconOf } from './game/npcs.js';
import { Interactions } from './game/interact.js';
import { Detective } from './game/detective.js';
import { TrafficCop } from './game/traffic_cop.js';
import { UI, esc } from './ui/ui.js';
import { Minimap } from './ui/minimap.js';
import { createJudy, createNick } from './chars/heroes.js';

const { DISTRICTS, LANDMARKS, districtAt, SPAWN } = layout;
const districtModules = import.meta.glob('./world/districts/*.js');

// —— 渲染器 ——
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
// 触屏设备（iPad/手机）GPU 较弱且像素密度高：降低渲染分辨率、关软阴影
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.25 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = IS_TOUCH ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, IS_TOUCH ? 2200 : 6000);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

const ui = new UI();
const input = new Input(canvas);
ui.bindTouch(input);
const col = new Colliders();
const interact = new Interactions();
const animators = [];
const labels = [];

// —— 标题画面 ——
const title = document.createElement('div');
title.id = 'title';
title.innerHTML = `
  <h1>疯狂动物城</h1>
  <div class="sub">ZOOTOPIA · 侦探档案</div>
  <div class="pick hidden">
    <div class="heroCard" data-h="judy"><div class="face">🐰</div><h3>朱迪·霍普斯</h3><p>跑得快、跳得高<br>敏锐听觉：线索探测范围更大<br>擅长正面询问、讲道理</p></div>
    <div class="heroCard" data-h="nick"><div class="face">🦊</div><h3>尼克·王尔德</h3><p>老江湖、人脉广<br>能撬开“道上”朋友的嘴<br>识破骗局、套话专家</p></div>
  </div>
  <div class="loading">正在建造动物城…</div>
  <div class="bar"><i></i></div>
  <div class="keys">${IS_TOUCH ? '左手拖动摇杆移动（推到底奔跑），右手滑动转视角，双指捏合缩放。<br>两位警官会一起行动，点击左上角头像切换操控。' : '两位警官会一起行动，随时按 <kbd>Tab</kbd> 切换操控。<br>不同的角色能发现不同的线索、问出不同的证词。'}</div>`;
document.body.appendChild(title);
const setLoad = (t, p) => { title.querySelector('.loading').textContent = t; title.querySelector('.bar i').style.width = (p * 100) + '%'; };

// —— 世界建造 ——
const b = new Builder(scene);
const env = createEnvironment(scene, renderer, b);
const ctx = {
  THREE, scene, b, col, layout, rng, tex, interact,
  animate: fn => animators.push(fn),
  addLabel: (x, y, z, text, color) => labels.push({ x, y, z, text, color }),
};
const POIS = {};

async function buildWorld() {
  const keys = Object.keys(districtModules).sort();
  let i = 0;
  // 弧形大道走廊：各地区建造时，压在走廊上的楼房/道具自动让路
  const reject = (x0, z0, x1, z1, top) => shouldReject(x0, z0, x1, z1, top) || frontageReject(x0, z0, x1, z1, top);
  b.reject = reject; col.reject = reject;
  for (const k of keys) {
    const name = k.split('/').pop().replace('.js', '');
    setLoad(`正在建造 ${DISTRICTS[name]?.name || name}…`, (i + 0.2) / (keys.length + 1));
    await new Promise(r => setTimeout(r, 16));
    try {
      const mod = await districtModules[k]();
      const t0 = performance.now();
      mod.build(ctx);
      Object.assign(POIS, mod.POI || {});
      console.log(`[world] ${name} built in ${(performance.now() - t0).toFixed(0)}ms`);
    } catch (e) {
      console.error(`[world] 地区 ${name} 建造失败`, e);
    }
    i++;
  }
  b.reject = null; col.reject = null;
  setLoad('正在铺设弧形大道…', keys.length / (keys.length + 1.4));
  try { buildCurves(ctx); } catch (e) { console.error('[world] 弧形大道建造失败', e); }
  try { buildFrontage(ctx); } catch (e) { console.error('[world] 辅路建造失败', e); }
  setLoad('正在架设环城高架…', keys.length / (keys.length + 1.4));
  try { buildHighway(ctx); } catch (e) { console.error('[world] 高架建造失败', e); }
  setLoad('正在合并网格…', (keys.length + 0.6) / (keys.length + 1.4));
  await new Promise(r => setTimeout(r, 16));
  b.flush();
  let tris = 0; scene.traverse(o => { if (o.isMesh && o.geometry.index) tris += o.geometry.index.count / 3; });
  console.log(`[world] meshes: ${b.meshes.length}, triangles ≈ ${(tris / 1e6).toFixed(2)}M`);
}

// —— 游戏对象 ——
let player, cam, detective, traffic, crowd, minimap, cop, cruisers = [];
let started = false, paused = false;
let lastDistrict = null;

function makeCruisers() {
  // 停在 ZPD 门前路边（玩家出生点旁）
  const spots = [
    { x: LANDMARKS.zpd.front.x + 12, z: -42.5, yaw: Math.PI / 2 },
  ];
  for (const s of spots) {
    const v = new Vehicle(scene, createCarModel({ body: 0x1b1d22, police: true }), s.x, s.z, s.yaw);
    v.pos.y = col.groundAt(s.x, s.z, 5);
    cruisers.push(v);
  }
}

function nearestCruiser(pos, maxD = 4) {
  let best = null, bd = maxD * maxD;
  for (const v of cruisers) { const d = v.pos.distanceToSquared(pos); if (d < bd) { bd = d; best = v; } }
  return best;
}

function travelTo(L) {
  const p = L.front || { x: L.x, z: L.z + L.d / 2 + 6 };
  if (player.vehicle) {
    const v = player.vehicle;
    v.pos.set(p.x, col.groundAt(p.x, p.z, 50), p.z + 10); v.speed = 0;
  } else player.setPosition(p.x, col.groundAt(p.x, p.z, 50), p.z + 3, Math.PI);
  cam.focus.copy(player.pos);
  cam.yaw = player.yaw + Math.PI;
  ui.toast(`🚓 已抵达：<b>${esc(L.name)}</b>`);
}

async function start(heroKey) {
  title.querySelector('.pick').classList.add('hidden');
  ui.show('hud');
  title.style.transition = 'opacity .8s'; title.style.opacity = 0;
  setTimeout(() => title.remove(), 800);
  if (player.current !== heroKey) player.switchHero();
  ui.setHero(player.current);
  started = true;
  detective.restore();
  if (!detective.active && !detective.solved.donut) {
    setTimeout(() => ui.dialog([
      ['旁白', '动物城，一个“一切皆有可能”的城市。从冰川镇到撒哈拉广场，从雨林区到小型啮齿镇，不同体型、不同习性的动物在这里共同生活。'],
      ['judy', '早上好，搭档！今天又是美好的一天！'],
      ['nick', '早上好，胡萝卜。我有种预感，今天的“美好”会来得特别快。'],
      ['旁白', '去 ZPD 第一分局门口找牛局长（黄色标记），领取今天的第一个案件。'],
    ], w => detective.speaker(w)), 900);
  }
}

async function init() {
  await buildWorld();
  setLoad('正在唤醒朱迪和尼克…', 0.97);
  await new Promise(r => setTimeout(r, 16));
  player = new Player(scene, col, { judy: createJudy(), nick: createNick() });
  const sy = col.groundAt(SPAWN.x, SPAWN.z, 50);
  player.setPosition(SPAWN.x, sy, SPAWN.z, SPAWN.ry);
  cam = new ThirdPersonCamera(camera, col);
  cam.focus.copy(player.pos);
  cam.yaw = player.yaw + Math.PI;
  makeCruisers();
  traffic = new Traffic(scene, IS_TOUCH ? 40 : 80);
  traffic.addLoopCars(IS_TOUCH ? 14 : 26);
  traffic.addCurveCars(IS_TOUCH ? 2 : 4);
  crowd = new Crowd(scene, col, IS_TOUCH ? 28 : 55);
  detective = new Detective({ scene, col, ui, player, interact });
  cop = new TrafficCop({ scene, ui, traffic, player, crowd });
  detective.onTrafficDuty = () => cop.start();
  // 上升气流：撒哈拉排气塔、冰川造雪塔、雨林喷淋塔附近能爬升
  player.updraft = p => (p.x > 325 && p.x < 350) || (p.z > -350 && p.z < -325 && p.x > -700 && p.x < 300) || (Math.hypot(p.x + 660, p.z + 80) < 30);
  minimap = new Minimap(ui, travelTo);
  setLoad('选择你的角色', 1);
  const pick = title.querySelector('.pick');
  pick.classList.remove('hidden');
  title.querySelector('.bar').style.display = 'none';
  pick.querySelectorAll('.heroCard').forEach(c => c.onclick = () => start(c.dataset.h));
  requestAnimationFrame(loop);
}

// —— 暂停菜单 ——
function openPause() {
  paused = true; input.unlock();
  const m = ui.modal(`<div class="sheet" id="pauseMenu"><button class="close">×</button>
    <h2>⏸ 暂停</h2>
    <div class="meta">声望 ⭐ ${detective.rep}（${detective.rank}） · 已破案 ${Object.keys(detective.solved).length} 件</div>
    <div class="row">
      <button class="btn" data-a="resume">继续</button>
      <button class="btn ghost" data-a="time">${env.state.time > 6 && env.state.time < 18 ? '🌙 跳到夜晚' : '☀️ 跳到白天'}</button>
      <button class="btn ghost" data-a="zpd">🚓 回到 ZPD</button>
      <button class="btn ghost" data-a="cop">${cop.active ? '🕵️ 切回侦探模式' : '🚔 交警值班（T）'}</button>
      <button class="btn ghost" data-a="reset">🗑 重置存档</button>
    </div>
    <p style="font-size:13px;opacity:.7;margin-top:18px;line-height:1.8">${IS_TOUCH ? '左侧拖动摇杆移动 · 右侧滑动转视角 · 双指缩放<br>右下按钮：互动 / 跳跃 / 警车 / 侦探感知 / 切换角色<br>右上按钮：档案 · 地图 · 警笛 · 菜单' : ''}</p><p style="font-size:13px;opacity:.7;line-height:1.8" class="${IS_TOUCH ? 'hidden' : ''}">鼠标：点击画面锁定视角，或按住右键拖动 · 滚轮缩放<br>WASD 移动 · Shift 奔跑 · Space 跳跃 · E 互动 · Q 侦探感知<br>Tab 切换朱迪/尼克 · F 上下警车 · H 警笛 · J 档案 · M 地图<br>空中再按 Space 展开滑翔伞 · T 交警值班模式</p>
  </div>`, { onClose: () => { paused = false; } });
  m.querySelector('[data-a=resume]').onclick = () => ui.closeModal();
  m.querySelector('[data-a=time]').onclick = () => { env.state.time = env.state.time > 6 && env.state.time < 18 ? 20.5 : 9; ui.closeModal(); };
  m.querySelector('[data-a=cop]').onclick = () => { ui.closeModal(); cop.active ? cop.stop('提前下班') : cop.start(); };
  m.querySelector('[data-a=zpd]').onclick = () => { ui.closeModal(); if (player.vehicle) player.exitVehicle(); travelTo(LANDMARKS.zpd); };
  m.querySelector('[data-a=reset]').onclick = () => { if (confirm('确定要清除所有进度吗？')) detective.resetSave(); };
}

// —— 主循环 ——
const clock = new THREE.Clock();
let fpsAcc = 0, fpsN = 0, ambientT = 0;
const tmpV = new THREE.Vector3();

function handleInput(dt) {
  const busy = ui.inDialog || ui.modalOpen || minimap.big;
  input.enabled = !busy;
  if (busy) {
    if (minimap.big && (input.pressed.has('KeyM') || input.pressed.has('Escape'))) minimap.closeBig();
    else if (ui.modalOpen && (input.pressed.has('Escape') || input.pressed.has('KeyJ'))) ui.closeModal();
    return;
  }
  if (input.hit('Escape')) return openPause();
  if (input.hit('Tab')) {
    if (player.switchHero()) { ui.setHero(player.current); ui.toast(player.current === 'judy' ? '🐰 切换为朱迪' : '🦊 切换为尼克', 1500); }
    else ui.toast('驾驶中无法切换', 1500);
  }
  if (input.hit('KeyJ')) { input.unlock(); detective.openCasebook(); }
  if (input.hit('KeyM')) { input.unlock(); minimap.openBig(player.pos, detective.targetPos(player.pos)); }
  if (input.hit('KeyQ')) {
    detective.sense = player.current === 'judy' ? 6 : 3.5;
    ui.toast(player.current === 'judy' ? '👂 敏锐听觉：附近的线索会更明显' : '😏 老江湖直觉：注意周围的可疑之处', 1800);
  }
  if (input.hit('KeyF')) {
    if (player.vehicle) player.exitVehicle();
    else { const v = nearestCruiser(player.pos); if (v) player.enterVehicle(v); }
  }
  if (input.hit('KeyH') && player.vehicle) player.vehicle.siren = !player.vehicle.siren;
  if (input.hit('KeyT')) { if (cop.active) cop.stop('提前下班'); else cop.start(); }
  if (input.hit('KeyE') && cop.tryTicket()) return;
  if (input.hit('KeyE') && !player.vehicle) {
    const it = interact.nearest(player.pos);
    if (it) { input.unlock(); it.onInteract(player); }
    else {
      const n = crowd.nearest(player.pos);
      if (n) {
        n.pause = 4; n.lineT = 4;
        const yaw = Math.atan2(player.pos.x - n.x, player.pos.z - n.z);
        n.g.rotation.y = yaw;
        n.line = ambientLine(lastDistrict);
      }
    }
  }
}

function updateMarkers() {
  const list = [];
  const W = innerWidth, H = innerHeight;
  const proj = (x, y, z) => { tmpV.set(x, y, z).project(camera); return tmpV.z < 1 ? { x: (tmpV.x + 1) / 2 * W, y: (1 - tmpV.y) / 2 * H } : null; };
  // 剧情 NPC 名牌
  const tgt = cop.active ? cop.nearestOffender() : detective.targetPos(player.pos);
  for (const [k, n] of detective.npcs) {
    const d2 = n.pos.distanceToSquared(player.pos);
    if (d2 > 45 * 45) continue;
    const p = proj(n.pos.x, n.pos.y + n.height + 0.35, n.pos.z);
    if (!p) continue;
    const def = k === 'bogo' ? n.def : detective.active?.def.npcs[k];
    const isTarget = tgt && Math.abs(tgt.x - n.pos.x) < 0.01 && Math.abs(tgt.z - n.pos.z) < 0.01;
    list.push({ x: p.x, y: p.y, cls: 'nameTag' + (isTarget ? ' obj' : ''), html: `${isTarget ? '❗ ' : ''}<b>${esc(def?.name || '')}</b> ${iconOf(def?.species)}`, alpha: d2 > 30 * 30 ? 0.6 : 1 });
  }
  // 路人对话气泡
  for (const n of crowd.list) {
    if (n.lineT <= 0) continue;
    const p = proj(n.x, (n.g.userData.height || 1.5) + 0.4, n.z);
    if (p) list.push({ x: p.x, y: p.y, cls: 'nameTag', html: esc(n.line) });
  }
  // 目标指示
  if (tgt) {
    const d = Math.hypot(tgt.x - player.pos.x, tgt.z - player.pos.z);
    const y = col.groundAt(tgt.x, tgt.z, 60) + 2.6;
    const p = proj(tgt.x, y, tgt.z);
    const npcShown = [...detective.npcs.values()].some(n => Math.abs(tgt.x - n.pos.x) < 0.01 && Math.abs(tgt.z - n.pos.z) < 0.01) && d < 45;
    if (p && d > 6 && !npcShown) list.push({ x: Math.min(W - 40, Math.max(40, p.x)), y: Math.min(H - 60, Math.max(60, p.y)), cls: 'marker', html: `${tgt.icon || '⭐'}<small>${esc(tgt.label)} · ${Math.round(d)}m</small>` });
    const o = detective.objective;
    ui.setObjective(cop.active ? { ...cop.hud(), dist: d } : detective.active ? { ...o, dist: d } : { caseTitle: '待命中', text: '去 ZPD 门口找牛局长领取案件 · 或按 T 开始交警值班', dist: d });
  }
  // 侦探感知：显示附近线索
  if (detective.sense > 0) {
    const R = player.current === 'judy' ? 60 : 35;
    for (const [k, c] of detective.clueMeshes) {
      if (!c.g.visible) continue;
      const d = Math.hypot(c.x - player.pos.x, c.z - player.pos.z);
      if (d > R) continue;
      const p = proj(c.x, c.y + 1.2, c.z);
      if (p) list.push({ x: p.x, y: p.y, cls: 'marker', html: `🔍<small>${Math.round(d)}m</small>` });
    }
  }
  ui.markers(list);
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  SharedUniforms.uTime.value = t;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 1) { ui.setFps(`${Math.round(fpsN / fpsAcc)} fps · ${renderer.info.render.calls} calls · ${(renderer.info.render.triangles / 1e6).toFixed(2)}M tris`); fpsAcc = 0; fpsN = 0; }

  if (started && !paused) {
    handleInput(dt);
    player.update(dt, input, cam.yaw);
    if (!player.vehicle) traffic.pushOut(player.pos, player.stats.radius);
    cam.update(dt, input, player);
    const dk = districtAt(player.pos.x, player.pos.z);
    if (dk !== lastDistrict) {
      const D = DISTRICTS[dk];
      if (D && lastDistrict !== null) ui.districtBanner(D.name, D.en.toUpperCase());
      lastDistrict = dk;
    }
    traffic.update(dt, player.pos, player.pos);
    crowd.update(dt, player.pos, dk, player.pos);
    detective.update(dt, t, player.pos);
    cop.update(dt, t);
    for (const v of cruisers) if (v !== player.vehicle) v.update(dt, 0);
    env.update(dt, player.pos, dk);
    for (const f of animators) f(dt, t, player.pos);

    // 提示
    let prompt = null, act = null, car = false;
    if (!ui.inDialog && !ui.modalOpen) {
      const offV = player.vehicle && cop.nearest();
      if (offV) { prompt = `<kbd>E</kbd> 拦停开罚单：${offV.offense.icon} ${offV.offense.name}`; act = '罚单'; }
      else if (player.vehicle) prompt = IS_TOUCH ? '摇杆驾驶 · 🚨 警笛' : `<kbd>F</kbd> 下车 · <kbd>H</kbd> 警笛 · <kbd>Shift</kbd> 加速`;
      else if (player.gliding) prompt = IS_TOUCH ? '🪂 滑翔中 · 再按「跳」收伞' : '🪂 滑翔中 · <kbd>Space</kbd> 收伞 · <kbd>Shift</kbd> 俯冲';
      else {
        const it = interact.nearest(player.pos);
        car = !!nearestCruiser(player.pos);
        const off = cop.nearest();
        if (off) { prompt = `<kbd>E</kbd> 开罚单：${off.offense.icon} ${off.offense.name}`; act = '罚单'; }
        else if (it) { prompt = `<kbd>E</kbd> ${esc(it.label)}`; act = it.label.startsWith('调查') ? '调查' : '对话'; }
        else if (car) prompt = `<kbd>F</kbd> 驾驶 ZPD 警车`;
        else if (crowd.nearest(player.pos)) { prompt = `<kbd>E</kbd> 打个招呼`; act = '招呼'; }
      }
    }
    if (IS_TOUCH && prompt) prompt = prompt.replace(/<kbd>[EF]<\/kbd> /, '');
    ui.prompt(prompt);
    if (IS_TOUCH) ui.touchState({ act, car, driving: !!player.vehicle, hero: player.current });
    ui.setStamina(player.stamina);
    ui.setClock(env.state.time);
    ui.setRep(detective.rep, detective.rank);
    const D = DISTRICTS[dk];
    minimap.update(player.pos, player.yaw, cam.yaw, cop.active ? cop.nearestOffender() : detective.targetPos(player.pos), D ? D.name : dk === 'canal' ? '运河' : '郊外', [...cruisers.map(v => ({ x: v.pos.x, z: v.pos.z, color: '#4aa3ff', r: 5 })), ...cop.mapDots()]);
    updateMarkers();
  } else if (!started) {
    // 标题画面：环绕镜头
    const a = t * 0.05;
    camera.position.set(Math.cos(a) * 160, 70, Math.sin(a) * 160);
    camera.lookAt(0, 20, 0);
    env.update(dt * 0, new THREE.Vector3(0, 0, 0), 'savanna');
    for (const f of animators) f(dt, t, camera.position);
  }
  input.endFrame();
  renderer.render(scene, camera);
}

// 标题画面先渲染一帧环境（世界在建造中）
init().catch(e => { console.error(e); setLoad('加载失败：' + e.message, 1); });

// 调试接口
window.__zoo = { get cop() { return cop; }, get player() { return player; }, get detective() { return detective; }, get cam() { return cam; }, get traffic() { return traffic; }, get crowd() { return crowd; }, env, scene, col, renderer, travelTo, LANDMARKS };
