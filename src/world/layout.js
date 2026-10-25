// 动物城世界布局：所有地区、道路、地标坐标的唯一来源。
// 坐标系：x 向东，z 向南（-z 为北），y 向上。单位：米。朱迪身高约 1m。

export const WORLD_SIZE = 2000; // -1000..1000
export const ROAD_W = 14;        // 普通道路宽度（含两侧车道，不含人行道）
export const SIDEWALK_W = 4;     // 人行道宽度（在道路两侧，属于街区内）

export const DISTRICTS = {
  savanna: {
    name: '撒瓦纳中央区', en: 'Savanna Central',
    rect: { x0: -280, x1: 280, z0: -280, z1: 280 },
    roadsX: [-200, -120, -40, 40, 120, 200],
    roadsZ: [-200, -120, -40, 40, 120, 200],
    ground: 0xb9b2a2, fog: 0xcfe3f0, color: '#e8c872',
  },
  tundra: {
    name: '冰川镇', en: 'Tundratown',
    rect: { x0: -700, x1: 300, z0: -950, z1: -330 },
    roadsX: [-600, -420, -210, 0, 200],
    roadsZ: [-420, -580, -740, -880],
    ground: 0xeef4fa, fog: 0xdde9f5, color: '#9fd3f5',
  },
  sahara: {
    name: '撒哈拉广场', en: 'Sahara Square',
    rect: { x0: 330, x1: 950, z0: -450, z1: 280 },
    roadsX: [420, 560, 700, 840],
    roadsZ: [-360, -200, 0, 150],
    ground: 0xe3c48d, fog: 0xf3dfb8, color: '#f0a64a',
  },
  rainforest: {
    name: '雨林区', en: 'Rainforest District',
    rect: { x0: -950, x1: -330, z0: -400, z1: 280 },
    roadsX: [-880, -740, -580, -420],
    roadsZ: [-300, -140, 0, 140],
    ground: 0x4f7a3a, fog: 0xa9c9a4, color: '#5fbf6a',
  },
  rodentia: {
    name: '小型啮齿镇', en: 'Little Rodentia',
    rect: { x0: 207, x1: 280, z0: 207, z1: 280 },
    roadsX: [], roadsZ: [],
    ground: 0x9ccf7a, fog: 0xcfe3f0, color: '#f28bb5',
  },
  bunnyburrow: {
    name: '兔窝镇', en: 'Bunnyburrow',
    rect: { x0: -500, x1: 500, z0: 420, z1: 950 },
    roadsX: [0], roadsZ: [600, 820],
    ground: 0x86b55a, fog: 0xe2eedb, color: '#c7e07a',
  },
};

// 运河：撒瓦纳中央区与兔窝镇之间的水域
export const WATER = { z0: 292, z1: 408 };
// 跨河大桥沿 x=0
export const BRIDGE = { x: 0, z0: 280, z1: 420, w: 18 };

// 区域之间的连接公路（跨越隔离带 / 气候墙）
export const CONNECTORS = [
  { x1: 0, z1: -280, x2: 0, z2: -330, w: ROAD_W },          // 撒瓦纳 → 冰川镇
  { x1: 280, z1: 0, x2: 330, z2: 0, w: ROAD_W },            // 撒瓦纳 → 撒哈拉
  { x1: -280, z1: 0, x2: -330, z2: 0, w: ROAD_W },          // 撒瓦纳 → 雨林
  { x1: 0, z1: 280, x2: 0, z2: 420, w: ROAD_W, bridge: true }, // 撒瓦纳 → 兔窝镇（桥）
];

// 外环辅路（地面层）：沿撒瓦纳中央区外圈、环城高架内侧，把各区路网首尾连起来，消除断头路。
// 每条撒瓦纳道路、每个气候墙门洞、每条弧形大道端点都有支路接入；冰川镇/撒哈拉/雨林各加一圈区内环路。
export const FRONT = 307;   // = 高架中线 322 - 出口坡道横向偏移 15
export const FRONTAGE = (() => {
  const F = FRONT, w = ROAD_W, out = [];
  const seg = (x1, z1, x2, z2, name, ww = w) => out.push({ x1, z1, x2, z2, w: ww, name });
  // 城市外环
  seg(-F, -F, F, -F, '北辅路'); seg(F, -F, F, 286, '东辅路'); seg(-F, -F, -F, 286, '西辅路'); seg(-F, 286, F, 286, '滨河路', 10);
  const sv = [-200, -120, -40, 40, 120, 200];
  for (const x of sv) { seg(x, -280, x, -F); seg(x, 280, x, 286); }
  for (const z of sv) { seg(-280, z, -F, z); seg(280, z, F, z); }
  // 气候墙门洞 → 外环
  for (const z of [-200, 150]) seg(F, z, 330, z);                 // 撒哈拉（z=-360 在角外，单独接）
  seg(F, -F, F, -360); seg(F, -360, 330, -360);
  for (const z of [-140, 140]) seg(-F, z, -330, z);               // 雨林
  for (const x of [-210, 200]) seg(x, -F, x, -330);               // 冰川镇
  // 弧形大道端点 → 外环
  seg(-112, -280, -112, -F); seg(-280, -112, -F, -112);
  seg(-280, 80, -F, 80); seg(-80, 280, -80, 286); seg(80, 280, 80, 286); seg(280, 80, F, 80);
  // 冰川镇区内环路（北缘 + 东缘，与 z=-420 相接）
  seg(-690, -935, 290, -935, '冰川北环路'); seg(290, -935, 290, -420, '冰川东环路'); seg(-690, -935, -690, -420, '冰川西环路');
  // 撒哈拉区内环路
  seg(420, -440, 940, -440, '沙丘北环路'); seg(940, -440, 940, 270, '沙丘东环路'); seg(420, 270, 940, 270, '沙丘南环路');
  // 雨林区内环路
  seg(-940, -140, -940, 270, '雨林西环路'); seg(-940, 270, -420, 270, '雨林南环路');
  return out;
})();

// 地标：每个地标占据一个完整街区（或街区中的一块地）。
// 地区建造者必须在 rect 内建造对应地标，并保证 spots 中的点可步行、周围 3m 无碰撞体。
// front：地标朝向道路一侧的入口广场中心。
export const LANDMARKS = {
  // —— 撒瓦纳中央区 ——
  plaza:     { district: 'savanna', name: '撒瓦纳中央广场', x: 0, z: 0, w: 66, d: 66 },
  zpd:       { district: 'savanna', name: 'ZPD 第一分局', x: 80, z: -80, w: 66, d: 66, front: { x: 80, z: -52 } },
  station:   { district: 'savanna', name: '动物城中央车站', x: -80, z: -80, w: 66, d: 66, front: { x: -80, z: -52 } },
  cityHall:  { district: 'savanna', name: '市政厅', x: -80, z: 80, w: 66, d: 66, front: { x: -80, z: 52 } },
  museum:    { district: 'savanna', name: '自然历史博物馆', x: 80, z: 80, w: 66, d: 66, front: { x: 80, z: 52 } },
  jumbeaux:  { district: 'savanna', name: '大象冰淇淋店', x: 160, z: -80, w: 66, d: 66, front: { x: 160, z: -52 } },
  dmv:       { district: 'savanna', name: '车管所 (DMV)', x: -160, z: -80, w: 66, d: 66, front: { x: -160, z: -52 } },
  // —— 小型啮齿镇（整个街区，微缩尺度：建筑 0.6–3m 高） ——
  rodentia:  { district: 'rodentia', name: '小型啮齿镇', x: 244, z: 244, w: 66, d: 66,
    spots: { jeweler: { x: 228, z: 262 }, fruFru: { x: 262, z: 228 }, square: { x: 244, z: 244 }, gate: { x: 244, z: 212 } } },
  // —— 冰川镇 ——
  iceFactory: { district: 'tundra', name: '冰川镇冰棍工厂', x: 100, z: -500, w: 186, d: 146, front: { x: 100, z: -435 } },
  mrBig:      { district: 'tundra', name: '大先生庄园', x: -315, z: -810, w: 196, d: 126, front: { x: -315, z: -755 } },
  iceLake:    { district: 'tundra', name: '冰湖', x: -105, z: -660, w: 196, d: 146 },
  tundraPlaza:{ district: 'tundra', name: '冰川镇广场', x: -105, z: -500, w: 196, d: 146, front: { x: -105, z: -435 } },
  // —— 雨林区 ——
  climateTower: { district: 'rainforest', name: '雨林气候控制塔', x: -660, z: -70, w: 146, d: 126, front: { x: -660, z: -15 } },
  canopyMarket: { district: 'rainforest', name: '树冠集市', x: -500, z: 70, w: 146, d: 126, front: { x: -500, z: 15 } },
  // —— 撒哈拉广场 ——
  palmHotel: { district: 'sahara', name: '棕榈宫殿酒店', x: 630, z: -100, w: 126, d: 186, front: { x: 630, z: -15 } },
  oasisSpa:  { district: 'sahara', name: '绿洲沙浴水疗', x: 770, z: 75, w: 126, d: 136, front: { x: 770, z: 15 } },
  bazaar:    { district: 'sahara', name: '沙丘集市', x: 490, z: 75, w: 126, d: 136, front: { x: 490, z: 15 } },
  // —— 兔窝镇 ——
  hoppsFarm:   { district: 'bunnyburrow', name: '霍普斯家族农场', x: -180, z: 700, w: 200, d: 160, front: { x: -30, z: 700 } },
  gideonBakery:{ district: 'bunnyburrow', name: '吉迪恩的派店', x: 120, z: 700, w: 120, d: 120, front: { x: 30, z: 700 } },
  cropField:   { district: 'bunnyburrow', name: '东边胡萝卜田', x: 280, z: 880, w: 200, d: 100 },
};

export function districtAt(x, z) {
  // 小型啮齿镇优先（它嵌在撒瓦纳内部）
  for (const key of ['rodentia', 'savanna', 'tundra', 'sahara', 'rainforest', 'bunnyburrow']) {
    const r = DISTRICTS[key].rect;
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return key;
  }
  if (z > WATER.z0 && z < WATER.z1) return 'canal';
  return 'outskirts';
}

// 返回地区中所有道路之间的街区矩形（已扣除道路宽度的一半）。
// 每个街区：{ x0,x1,z0,z1, cx,cz, w,d, landmark: key|null }
export function blocksOf(districtKey) {
  const D = DISTRICTS[districtKey];
  const r = D.rect;
  const xs = [r.x0, ...[...D.roadsX].sort((a, b) => a - b), r.x1];
  const zs = [r.z0, ...[...D.roadsZ].sort((a, b) => a - b), r.z1];
  const hw = ROAD_W / 2;
  const out = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const x0 = xs[i] + (i === 0 ? 0 : hw), x1 = xs[i + 1] - (i === xs.length - 2 ? 0 : hw);
      const z0 = zs[j] + (j === 0 ? 0 : hw), z1 = zs[j + 1] - (j === zs.length - 2 ? 0 : hw);
      if (x1 - x0 < 8 || z1 - z0 < 8) continue;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      let landmark = null;
      for (const [k, L] of Object.entries(LANDMARKS)) {
        if (L.x > x0 && L.x < x1 && L.z > z0 && L.z < z1) { landmark = k; break; }
      }
      out.push({ x0, x1, z0, z1, cx, cz, w: x1 - x0, d: z1 - z0, landmark });
    }
  }
  return out;
}

// 所有道路线段（用于绘制道路、车辆导航、NPC 行走）
export function allRoads() {
  const roads = [];
  for (const [key, D] of Object.entries(DISTRICTS)) {
    const r = D.rect;
    // 雨林区东北角与冰川镇重叠：那里的南北路从 z=-330 起
    for (const x of D.roadsX) roads.push({ x1: x, z1: key === 'rainforest' && x > -700 ? -330 : r.z0, x2: x, z2: r.z1, w: ROAD_W, district: key });
    for (const z of D.roadsZ) roads.push({ x1: r.x0, z1: z, x2: r.x1, z2: z, w: ROAD_W, district: key });
  }
  for (const c of CONNECTORS) roads.push({ ...c, district: 'connector' });
  for (const c of FRONTAGE) roads.push({ ...c, district: 'frontage' });
  return roads;
}

// 玩家 / 案件系统会用到的出生点
export const SPAWN = { x: 80, z: -38, ry: Math.PI }; // 面朝北边的 ZPD
