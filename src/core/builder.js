// Builder：把大量小几何体按「区块 × 材质」合并成少量网格，保证大地图的绘制调用数可控。
// 所有颜色走顶点色，所以同一材质类型下任意颜色的物体都能合并。
//
// 用法：
//   const b = new Builder(scene);
//   b.box(w, h, d, x, y, z, 0xff8800);                  // y 是盒子底部高度（不是中心！）
//   b.box(w, h, d, x, y, z, '#88aacc', { mat: 'facade', ry: 0.3 });
//   b.cyl(rTop, rBot, h, x, y, z, color, { seg: 16 });  // y 为底部
//   b.sphere(r, x, y, z, color, { sx, sy, sz });        // y 为球心
//   b.cone(r, h, x, y, z, color);                        // y 为底部
//   b.add(geometry, matrix4, color, { mat });            // 任意几何体（会被克隆并变换）
//   b.flush();                                            // 最后调用一次，生成网格
//
// 通用选项 opts：{ mat, rx, ry, rz, seg, sx, sy, sz, shadow: true }
// mat 可选：
//   'solid'   普通哑光（默认）    'shiny'  光亮/塑料/漆面      'metal'  金属
//   'facade'  建筑墙面：着色器自动在竖直面上画窗户（3.2m×3.6m 格），夜晚窗户随机亮灯
//   'facadeBig'   大型动物楼宇（5m×6.5m 窗格）   'facadeSmall' 啮齿镇微缩楼（0.28m×0.32m 窗格）
//   'glass'   玻璃幕墙（不透明但高反射），夜晚微微发光
//   'glow'    自发光（招牌、灯、霓虹），不受光照
//   'water'   半透明水面          'ice'  半透明冰
//   'leaf'    植物（平直着色）
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SharedUniforms = {
  uNight: { value: 0 },     // 0 = 白天, 1 = 深夜
  uTime: { value: 0 },
};

const _mats = {};

function facadeMaterial(cellW, cellH, base, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0, ...opts });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = SharedUniforms.uNight;
    sh.uniforms.uCell = { value: new THREE.Vector2(cellW, cellH) };
    sh.uniforms.uBase = { value: base };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNorm;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;\nvWNorm = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWPos; varying vec3 vWNorm;
uniform float uNight; uniform vec2 uCell; uniform float uBase;
float zhash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float wmask = 0.0; float wlit = 0.0;
{
  vec3 n = normalize(vWNorm);
  if (abs(n.y) < 0.3) {
    vec2 t = normalize(vec2(-n.z, n.x));
    float u = dot(vWPos.xz, t) / uCell.x;
    float v = (vWPos.y - uBase) / uCell.y;
    vec2 c = floor(vec2(u, v)); vec2 f = fract(vec2(u, v));
    float plane = floor(dot(vWPos.xz, n.xz) * 0.5);
    float inside = step(0.16, f.x) * step(f.x, 0.84) * step(0.2, f.y) * step(f.y, 0.86) * step(0.0, v);
    // 窗框阴影边
    float frame = inside * (1.0 - step(0.2, f.x) * step(f.x, 0.8) * step(0.25, f.y) * step(f.y, 0.81));
    wmask = inside;
    float h = zhash(c + vec2(plane * 3.7, plane * 1.3));
    wlit = step(0.45, h);
    vec3 sky = mix(vec3(0.16, 0.24, 0.32), vec3(0.55, 0.7, 0.82), clamp(f.y * 1.2 - 0.1 + h * 0.25, 0.0, 1.0));
    vec3 nightc = mix(vec3(0.05, 0.06, 0.09), vec3(1.0, 0.82, 0.5), wlit);
    vec3 wc = mix(sky, nightc * 0.6, uNight);
    wc = mix(wc, diffuseColor.rgb * 0.55, frame);
    diffuseColor.rgb = mix(diffuseColor.rgb, wc, wmask);
    wmask *= (1.0 - frame);
  }
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, wmask);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.6, wmask);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += wmask * wlit * uNight * vec3(1.0, 0.78, 0.45) * 1.4;');
  };
  m.customProgramCacheKey = () => `facade_${cellW}_${cellH}_${base}`;
  return m;
}

export function getMaterial(kind) {
  if (_mats[kind]) return _mats[kind];
  let m;
  switch (kind) {
    case 'shiny': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.15 }); break;
    case 'metal': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.85 }); break;
    case 'facade': m = facadeMaterial(3.2, 3.6, 4.5); break;
    case 'facadeBig': m = facadeMaterial(5.0, 6.5, 7.0); break;
    case 'facadeSmall': m = facadeMaterial(0.28, 0.32, 0.36); break;
    case 'glass': {
      m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.9, emissive: 0xffc070, emissiveIntensity: 0 });
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uNight = SharedUniforms.uNight;
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uNight;')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0,0.8,0.5) * uNight * 0.35;');
      };
      m.customProgramCacheKey = () => 'glassNight';
      break;
    }
    case 'glow': m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); break;
    case 'water': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.82 }); break;
    case 'ice': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.7 }); break;
    case 'leaf': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }); break;
    default: m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0 });
  }
  _mats[kind] = m;
  return m;
}

const _boxG = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const _cylCache = new Map();
const _sphCache = new Map();
const _coneCache = new Map();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _c = new THREE.Color();

function prep(geo) {
  // 统一属性：只保留 position / normal，并保证有索引，便于合并
  // 注意：不能用 geo.clone()——参数化几何体的 clone 会先按默认参数重建一遍，非常慢
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geo.attributes.position.clone());
  if (geo.attributes.normal) g.setAttribute('normal', geo.attributes.normal.clone());
  else g.computeVertexNormals();
  if (geo.index) g.setIndex(geo.index.clone());
  if (!g.index) {
    const n = g.attributes.position.count;
    const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  return g;
}

export class Builder {
  constructor(scene, { chunk = 120, castShadow = true, receiveShadow = true } = {}) {
    this.scene = scene;
    this.chunk = chunk;
    this.castShadow = castShadow;
    this.receiveShadow = receiveShadow;
    this.buckets = new Map();
    this.meshes = [];
    this.lamps = [];
    this.reject = null;   // (x0,z0,x1,z1,top) => bool：为 true 时丢弃该几何体（弧形大道走廊让路）
  }

  _matrix(x, y, z, sx, sy, sz, o) {
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ');
    _q.setFromEuler(_e);
    _p.set(x, y, z); _s.set(sx, sy, sz);
    return _m.compose(_p, _q, _s);
  }

  add(geometry, matrix, color, o = {}) {
    const g = prep(geometry);
    g.applyMatrix4(matrix);
    // 记录路灯灯头：小块自发光几何体（直径 < 1.4m），离地 3.5–9.5m
    if (o.mat === 'glow' && this.lamps) {
      g.computeBoundingBox();
      const bb = g.boundingBox, sx = bb.max.x - bb.min.x, sz = bb.max.z - bb.min.z, sy = bb.max.y - bb.min.y;
      const cy = (bb.min.y + bb.max.y) / 2;
      if (sx < 1.4 && sz < 1.4 && sy < 1.2 && cy > 3.5 && cy < 9.5) this.lamps.push({ x: (bb.min.x + bb.max.x) / 2, y: cy - 0.4, z: (bb.min.z + bb.max.z) / 2 });
    }
    _c.set(color);
    // 轻微随机明暗，避免大面积纯色显得塑料
    const jitter = o.jitter ?? 0;
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const k = 1 + (jitter ? (Math.random() - 0.5) * jitter : 0);
      col[i * 3] = _c.r * k; col[i * 3 + 1] = _c.g * k; col[i * 3 + 2] = _c.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeBoundingBox();
    const bb = g.boundingBox;
    if (this.reject && !o.keep && this.reject(bb.min.x, bb.min.z, bb.max.x, bb.max.z, bb.max.y)) { g.dispose(); return this; }
    const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
    const mat = o.mat || 'solid';
    const shadow = o.shadow === false ? 'n' : 's';
    const key = `${mat}|${shadow}|${Math.floor(cx / this.chunk)},${Math.floor(cz / this.chunk)}`;
    let arr = this.buckets.get(key);
    if (!arr) { arr = []; this.buckets.set(key, arr); }
    arr.push(g);
    if (arr.length >= 3000) this._flushKey(key);
    return this;
  }

  box(w, h, d, x, y, z, color, o = {}) {
    return this.add(_boxG, this._matrix(x, y, z, w, h, d, o), color, o);
  }

  cyl(rTop, rBot, h, x, y, z, color, o = {}) {
    const seg = o.seg || 12;
    const key = `${rTop / rBot}|${seg}`;
    let g = _cylCache.get(key);
    if (!g) { g = new THREE.CylinderGeometry(rTop / rBot, 1, 1, seg).translate(0, 0.5, 0); _cylCache.set(key, g); }
    return this.add(g, this._matrix(x, y, z, rBot * (o.sx || 1), h, rBot * (o.sz || 1), o), color, o);
  }

  sphere(r, x, y, z, color, o = {}) {
    const seg = o.seg || 12;
    let g = _sphCache.get(seg);
    if (!g) { g = new THREE.SphereGeometry(1, seg, Math.max(6, seg * 0.66 | 0)); _sphCache.set(seg, g); }
    return this.add(g, this._matrix(x, y, z, r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1), o), color, o);
  }

  cone(r, h, x, y, z, color, o = {}) {
    const seg = o.seg || 12;
    let g = _coneCache.get(seg);
    if (!g) { g = new THREE.ConeGeometry(1, 1, seg).translate(0, 0.5, 0); _coneCache.set(seg, g); }
    return this.add(g, this._matrix(x, y, z, r * (o.sx || 1), h, r * (o.sz || 1), o), color, o);
  }

  _flushKey(key) {
    const arr = this.buckets.get(key);
    if (!arr || !arr.length) return;
    const [mat, shadow] = key.split('|');
    const merged = mergeGeometries(arr, false);
    arr.forEach(g => g.dispose());
    this.buckets.set(key, []);
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, getMaterial(mat));
    const transparent = mat === 'water' || mat === 'ice' || mat === 'glow';
    mesh.castShadow = this.castShadow && shadow === 's' && !transparent;
    mesh.receiveShadow = this.receiveShadow && mat !== 'glow';
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.scene.add(mesh);
    this.meshes.push(mesh);
  }

  flush() {
    for (const key of [...this.buckets.keys()]) this._flushKey(key);
    this.buckets.clear();
    return this.meshes;
  }
}

// 常用工具：在矩形内按种子生成可复现随机数
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
