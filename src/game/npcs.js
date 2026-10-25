// NPC：案件角色（站定、可对话）+ 城市人群（沿人行道散步的路人，围绕玩家循环生成）
import * as THREE from 'three';
import { createAnimal } from '../chars/animals.js';
import { DISTRICTS, ROAD_W, SIDEWALK_W, districtAt } from '../world/layout.js';

// 各地区常见居民
const DISTRICT_SPECIES = {
  savanna: ['zebra', 'giraffe', 'elephant', 'lion', 'sheep', 'rabbit', 'pig', 'hippo', 'buffalo', 'cheetah', 'fox', 'otter', 'beaver', 'tiger', 'wolf', 'meerkat'],
  tundra: ['polarbear', 'wolf', 'polarbear', 'wolf', 'sheep', 'buffalo', 'fox'],
  sahara: ['camel', 'lion', 'meerkat', 'fox', 'cheetah', 'camel', 'tiger', 'zebra'],
  rainforest: ['sloth', 'koala', 'otter', 'tiger', 'beaver', 'pig', 'sloth'],
  bunnyburrow: ['rabbit', 'rabbit', 'rabbit', 'sheep', 'pig', 'fox', 'rabbit'],
  rodentia: ['mouse', 'shrew', 'mouse'],
};
const SPECIES_ICON = { rabbit: '🐰', fox: '🦊', elephant: '🐘', giraffe: '🦒', polarbear: '🐻‍❄️', lion: '🦁', sheep: '🐑', cheetah: '🐆', sloth: '🦥', mouse: '🐭', shrew: '🐭', otter: '🦦', hippo: '🦛', zebra: '🦓', wolf: '🐺', pig: '🐷', camel: '🐪', tiger: '🐯', buffalo: '🐃', weasel: '🦡', beaver: '🦫', koala: '🐨', meerkat: '🦡' };
export const iconOf = s => SPECIES_ICON[s] || '🐾';

const LINES = {
  any: ['今天天气真不错！', '在动物城，一切皆有可能！', '听说夏奇羊下个月要开演唱会！', '你是那位兔子警官？好酷！', '嘿，狐狸也能当警察了？', '我上班要迟到了！', '你知道车管所今天几点关门吗？哦，反正排不到。', '撒瓦纳中央广场的喷泉晚上会亮灯哦。'],
  tundra: ['冷？这才叫舒服。', '冰湖上可以滑冰，但别招惹大先生的人。', '冰棍工厂的爪爪冰棍是全城最好吃的。'],
  sahara: ['这么热的天，来杯冰沙吗？', '棕榈宫殿酒店的大堂真气派。', '沙浴对毛发特别好！'],
  rainforest: ['小心脚下，路很滑。', '……你……好……（一只树懒慢慢地挥了挥手）', '树冠集市的桉树茶很有名。'],
  bunnyburrow: ['欢迎回家，朱迪！', '今年的胡萝卜大丰收！', '吉迪恩的派店新出了蓝莓派。', '霍普斯家又多了几个小宝宝！'],
  rodentia: ['（尖细的声音）小心！别踩到我！', '巨人！快跑！……哦，是警察啊。', '芙芙小姐要结婚了！'],
};
export function ambientLine(district, rand = Math.random) {
  const pool = [...LINES.any, ...(LINES[district] || []), ...(LINES[district] || [])];
  return pool[Math.floor(rand() * pool.length)];
}

// —— 人行道采样：在玩家附近随机选取一个人行道点 ——
function sidewalkPoint(district, near, rand) {
  const D = DISTRICTS[district];
  if (!D) return null;
  const roads = [];
  for (const x of D.roadsX) roads.push({ axis: 'x', v: x, a: D.rect.z0, b: D.rect.z1 });
  for (const z of D.roadsZ) roads.push({ axis: 'z', v: z, a: D.rect.x0, b: D.rect.x1 });
  if (!roads.length) return null;
  // 优先选择离玩家近的道路
  roads.sort((r1, r2) => Math.abs(r1.v - (r1.axis === 'x' ? near.x : near.z)) - Math.abs(r2.v - (r2.axis === 'x' ? near.x : near.z)));
  const r = roads[Math.floor(Math.pow(rand(), 2) * Math.min(4, roads.length))];
  const side = rand() < 0.5 ? -1 : 1;
  const off = (ROAD_W / 2 + SIDEWALK_W * 0.5) * side;
  const center = r.axis === 'x' ? near.z : near.x;
  const t = Math.max(r.a + 4, Math.min(r.b - 4, center + (rand() - 0.5) * 160));
  return r.axis === 'x' ? { x: r.v + off, z: t, dx: 0, dz: rand() < .5 ? 1 : -1, axis: r } : { x: t, z: r.v + off, dx: rand() < .5 ? 1 : -1, dz: 0, axis: r };
}

export class Crowd {
  constructor(scene, col, count = 70) {
    this.scene = scene; this.col = col; this.count = count;
    this.list = [];
    this.rand = Math.random;
  }
  _spawn(focus, district) {
    const sp = DISTRICT_SPECIES[district];
    if (!sp) return null;
    const p = sidewalkPoint(district === 'rodentia' ? 'savanna' : district, focus, this.rand);
    if (!p) return null;
    const species = sp[Math.floor(this.rand() * sp.length)];
    const outfits = ['casual', 'suit', 'worker', 'dress', 'casual'];
    const g = createAnimal(species, { outfit: outfits[Math.floor(this.rand() * outfits.length)], seed: Math.floor(this.rand() * 1e6) });
    g.position.set(p.x, 0.15, p.z);
    this.scene.add(g);
    const big = g.userData.height || 1.5;
    return { g, species, x: p.x, z: p.z, dx: p.dx, dz: p.dz, speed: 0.9 + this.rand() * 0.8 + big * 0.12, pause: 0, axis: p.axis, district, line: null, lineT: 0, r: Math.max(0.3, big * 0.18) };
  }
  update(dt, focus, district, playerPos) {
    // 回收远处的
    for (let i = this.list.length - 1; i >= 0; i--) {
      const n = this.list[i];
      if ((n.x - focus.x) ** 2 + (n.z - focus.z) ** 2 > 190 * 190) {
        this.scene.remove(n.g); this.list.splice(i, 1);
      }
    }
    // 补充（每帧最多 2 个，避免卡顿）
    const target = district === 'bunnyburrow' ? this.count * 0.4 : district === 'canal' || district === 'outskirts' ? 0 : this.count;
    for (let k = 0; k < 2 && this.list.length < target; k++) {
      const n = this._spawn(focus, district);
      if (!n) break;
      if ((n.x - focus.x) ** 2 + (n.z - focus.z) ** 2 < 30 * 30 && this.list.length > 10) { /* 别在玩家眼前凭空出现 */ }
      this.list.push(n);
    }
    for (const n of this.list) {
      let sp = 0;
      if (n.pause > 0) n.pause -= dt;
      else {
        sp = n.speed;
        // 躲避玩家
        const px = playerPos.x - n.x, pz = playerPos.z - n.z;
        const d2 = px * px + pz * pz;
        if (d2 < 2.2) { sp = 0; n.pause = 0.6; }
        n.x += n.dx * sp * dt; n.z += n.dz * sp * dt;
        const ax = n.axis;
        const t = ax.axis === 'x' ? n.z : n.x;
        if (t < ax.a + 4 || t > ax.b - 4) { n.dx = -n.dx; n.dz = -n.dz; }
        if (this.rand() < dt * 0.04) { n.pause = 2 + this.rand() * 4; }
        if (this.rand() < dt * 0.02) { n.dx = -n.dx; n.dz = -n.dz; }
      }
      const p = { x: n.x, y: 0, z: n.z };
      const g = this.col.resolve(p, n.r, 1.5, 0.3);
      n.x = p.x; n.z = p.z;
      n.g.position.set(n.x, g, n.z);
      const yaw = Math.atan2(n.dx, n.dz);
      let a = yaw - n.g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
      n.g.rotation.y += a * Math.min(1, dt * 6);
      n.g.userData.setPose?.(sp > 0 ? 'walk' : 'idle');
      if ((n.x - focus.x) ** 2 + (n.z - focus.z) ** 2 < 70 * 70) n.g.userData.update?.(dt, sp);
      if (n.lineT > 0) n.lineT -= dt;
    }
  }
  nearest(pos, maxD = 2.5) {
    let best = null, bd = maxD * maxD;
    for (const n of this.list) {
      const d = (n.x - pos.x) ** 2 + (n.z - pos.z) ** 2;
      const lim = Math.max(maxD, (n.g.userData.height || 1) * 0.7);
      if (d < bd && d < lim * lim) { bd = d; best = n; }
    }
    return best;
  }
}

// 站立的剧情 NPC
export class StoryNPC {
  constructor(scene, col, def, pos) {
    this.def = def;
    this.g = createAnimal(def.species, { outfit: def.outfit, outfitColor: def.outfitColor, seed: [...def.name].reduce((a, c) => a + c.charCodeAt(0), 0) });
    if (def.scale) this.g.scale.setScalar(def.scale);
    this.pos = new THREE.Vector3(pos.x, col.groundAt(pos.x, pos.z, 50), pos.z);
    this.g.position.copy(this.pos);
    this.baseYaw = pos.ry ?? 0;
    this.g.rotation.y = this.baseYaw;
    this.talking = false;
    scene.add(this.g);
    this.scene = scene;
  }
  get height() { return (this.g.userData.height || 1.5) * (this.def.scale || 1); }
  update(dt, playerPos) {
    const dx = playerPos.x - this.pos.x, dz = playerPos.z - this.pos.z;
    const close = dx * dx + dz * dz < 64;
    const yaw = close ? Math.atan2(dx, dz) : this.baseYaw;
    let a = yaw - this.g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
    this.g.rotation.y += a * Math.min(1, dt * 4);
    this.g.userData.setPose?.(this.talking ? 'talk' : 'idle');
    if (dx * dx + dz * dz < 120 * 120) this.g.userData.update?.(dt, 0);
  }
  dispose() { this.scene.remove(this.g); }
}

export { districtAt };
