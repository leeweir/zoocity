// 环境：天空、太阳、昼夜循环、全局地面、运河水面、远山、连接公路
import * as THREE from 'three';
import { SharedUniforms } from '../core/builder.js';
import { WORLD_SIZE, WATER, CONNECTORS, ROAD_W, DISTRICTS } from './layout.js';

export function createEnvironment(scene, renderer, b) {
  // —— 天空球 ——
  const skyU = {
    uSun: { value: new THREE.Vector3(0, 1, 0) },
    uNight: SharedUniforms.uNight,
    uTime: SharedUniforms.uTime,
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 uSun; uniform float uNight; uniform float uTime;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vDir);
        float y = max(d.y, -0.1);
        vec3 dayTop = vec3(0.30,0.56,0.92), dayHor = vec3(0.78,0.88,0.97);
        vec3 nTop = vec3(0.02,0.03,0.09), nHor = vec3(0.10,0.10,0.22);
        float sunH = uSun.y;
        vec3 duskHor = vec3(1.0,0.55,0.3);
        vec3 top = mix(dayTop, nTop, uNight);
        vec3 hor = mix(dayHor, nHor, uNight);
        float dusk = smoothstep(0.35, 0.0, abs(sunH)) * (1.0 - uNight*0.6);
        hor = mix(hor, duskHor, dusk * 0.8 * smoothstep(-0.2, 1.0, dot(normalize(d.xz+1e-4), normalize(uSun.xz+1e-4))));
        vec3 col = mix(hor, top, pow(clamp(y,0.0,1.0), 0.55));
        float sd = max(dot(d, normalize(uSun)), 0.0);
        col += vec3(1.0,0.9,0.7) * pow(sd, 900.0) * 6.0 * (1.0-uNight);
        col += vec3(1.0,0.75,0.45) * pow(sd, 12.0) * 0.35 * (1.0-uNight);
        // 月亮
        float md = max(dot(d, normalize(-uSun)), 0.0);
        col += vec3(0.9,0.95,1.0) * smoothstep(0.9993, 0.9996, md) * uNight;
        // 星星
        vec3 sp = floor(d * 380.0);
        float st = step(0.9975, h(sp)) * uNight * smoothstep(0.05, 0.3, d.y);
        col += vec3(st) * (0.6 + 0.4*sin(uTime*3.0 + h(sp)*40.0));
        // 云（简单 fbm 带）
        vec2 cp = d.xz / max(d.y, 0.06) * 0.6 + vec2(uTime*0.004, 0.0);
        float c = 0.0, a = 0.5;
        for(int i=0;i<4;i++){ vec2 ip = floor(cp), fp = fract(cp); fp = fp*fp*(3.0-2.0*fp);
          float n = mix(mix(h(vec3(ip,1.)),h(vec3(ip+vec2(1,0),1.)),fp.x), mix(h(vec3(ip+vec2(0,1),1.)),h(vec3(ip+vec2(1,1),1.)),fp.x), fp.y);
          c += n*a; cp *= 2.1; a *= 0.5; }
        c = smoothstep(0.55, 0.85, c) * smoothstep(0.02, 0.25, d.y);
        col = mix(col, mix(vec3(1.0), vec3(0.18,0.2,0.3), uNight) * (0.85 + dusk*0.2), c * 0.75);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);

  // —— 光照 ——
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6b5a40, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const S = 90;
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 900 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);

  scene.fog = new THREE.Fog(0xcfe3f0, 250, 1500);

  // —— 全局地面（大草地 / 郊野） ——
  const groundGeo = new THREE.PlaneGeometry(WORLD_SIZE * 1.6, WORLD_SIZE * 1.6, 64, 64).rotateX(-Math.PI / 2);
  {
    const p = groundGeo.attributes.position;
    const col = new Float32Array(p.count * 3);
    const c1 = new THREE.Color(0x7aa35a), c2 = new THREE.Color(0x9a8a62), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const r = Math.hypot(x, z);
      // 远处升起成为环绕城市的丘陵
      const edge = Math.max(0, r - 1050);
      const hy = edge > 0 ? Math.pow(edge / 300, 1.6) * 60 * (0.7 + 0.3 * Math.sin(x * 0.01) * Math.cos(z * 0.013)) : 0;
      p.setY(i, hy - 0.05);
      c.copy(c1).lerp(c2, 0.5 + 0.5 * Math.sin(x * 0.02 + z * 0.015));
      col.set([c.r, c.g, c.b], i * 3);
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    groundGeo.computeVertexNormals();
  }
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // —— 运河水面（带波纹的着色器） ——
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x2f8fb0, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.9 });
  waterMat.onBeforeCompile = sh => {
    sh.uniforms.uTime = SharedUniforms.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; uniform float uTime;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float t = uTime;
          vec2 g = vec2(cos(vWp.x*0.35+t*1.3)+cos(vWp.x*0.9+vWp.z*0.6-t*1.9)*0.5, cos(vWp.z*0.4-t*1.1)+cos(vWp.z*1.1+vWp.x*0.3+t*1.7)*0.5);
          normal = normalize(normal + (viewMatrix * vec4(g.x*0.08, 0.0, g.y*0.08, 0.0)).xyz); }`);
  };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE * 1.6, WATER.z1 - WATER.z0, 1, 1).rotateX(-Math.PI / 2), waterMat);
  water.position.set(0, -0.5, (WATER.z0 + WATER.z1) / 2);
  scene.add(water);
  // 河床（地面下凹的视觉效果：在水下画深色底）
  b.box(WORLD_SIZE * 1.6, 0.1, WATER.z1 - WATER.z0, 0, -2.2, (WATER.z0 + WATER.z1) / 2, 0x2a4a50, { shadow: false });
  // 河道上方地面要被“挖开”：用两条河岸遮盖全局地面无法实现，这里直接把水面抬高到地面之上一点并让地面在河道处下沉
  {
    const p = groundGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i);
      if (z > WATER.z0 - 2 && z < WATER.z1 + 2) p.setY(i, -3);
    }
    groundGeo.computeVertexNormals();
  }
  // 由于地面网格较粗，河岸处再补一条完整的岸线挡板
  for (const z of [WATER.z0, WATER.z1]) b.box(WORLD_SIZE * 1.6, 3.1, 1.2, 0, -3, z, 0x8f8a7c, { shadow: false });
  water.position.y = -0.6;

  // —— 连接公路 ——
  for (const c of CONNECTORS) {
    if (c.bridge) continue;
    const len = Math.hypot(c.x2 - c.x1, c.z2 - c.z1);
    const ry = Math.atan2(c.x2 - c.x1, c.z2 - c.z1);
    const mx = (c.x1 + c.x2) / 2, mz = (c.z1 + c.z2) / 2;
    b.box(c.w, 0.04, len + 2, mx, 0, mz, 0x3b3d42, { ry, shadow: false });
    for (let s = -len / 2; s < len / 2; s += 6) {
      b.box(0.25, 0.02, 3, mx + Math.sin(ry) * s, 0.04, mz + Math.cos(ry) * s, 0xf2c94c, { ry, shadow: false, mat: 'glow' });
    }
  }

  // —— 远景：城市外围的群山、气候墙之外的极光感 ——
  const mt = new THREE.Group();
  const mtMat = new THREE.MeshStandardMaterial({ color: 0x8aa0b4, roughness: 1, flatShading: true });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 1, flatShading: true });
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2 + Math.sin(i * 7.3) * 0.05;
    const r = 1700 + (i % 3) * 120;
    const h = 160 + ((i * 37) % 9) * 35;
    const m = new THREE.Mesh(new THREE.ConeGeometry(h * 1.4, h, 6), mtMat);
    m.position.set(Math.cos(a) * r, h / 2 - 20, Math.sin(a) * r);
    m.rotation.y = i;
    mt.add(m);
    if (Math.sin(a) < 0) { // 北面（冰川方向）雪顶更多
      const s = new THREE.Mesh(new THREE.ConeGeometry(h * 0.5, h * 0.36, 6), snowMat);
      s.position.set(m.position.x, h - 20 - h * 0.18 + 0.5, m.position.z); s.rotation.y = i;
      mt.add(s);
    }
  }
  scene.add(mt);

  // —— 昼夜循环 ——
  const fogDay = new THREE.Color(0xcfe3f0), fogNight = new THREE.Color(0x1a2036), fogDusk = new THREE.Color(0xe7b38a);
  const tmpC = new THREE.Color();
  const state = { time: 9.5, speed: 24 / (20 * 60), paused: false }; // 20 分钟现实时间 = 1 天
  const sunDir = new THREE.Vector3();
  let districtFog = new THREE.Color(0xcfe3f0);

  function update(dt, focus, districtKey) {
    if (!state.paused) state.time = (state.time + dt * state.speed) % 24;
    const a = (state.time - 6) / 12 * Math.PI; // 6点日出 18点日落
    sunDir.set(Math.cos(a) * 0.8, Math.sin(a), 0.45).normalize();
    skyU.uSun.value.copy(sunDir);
    const day = THREE.MathUtils.smoothstep(sunDir.y, -0.12, 0.18);
    const night = 1 - day;
    SharedUniforms.uNight.value = night;
    const dusk = THREE.MathUtils.smoothstep(0.35 - Math.abs(sunDir.y), 0, 0.35) * day;

    const lightDir = sunDir.y > 0 ? sunDir : tmpV.copy(sunDir).negate(); // 夜里用月光
    sun.position.set(focus.x + lightDir.x * 300, focus.y + Math.abs(lightDir.y) * 300 + 20, focus.z + lightDir.z * 300);
    sun.target.position.copy(focus);
    sun.intensity = 2.8 * day + 0.55 * night;
    sun.color.setRGB(1, 0.92 - dusk * 0.25, 0.82 - dusk * 0.4);
    if (night > 0.5) sun.color.setRGB(0.6, 0.7, 1.0);
    hemi.intensity = 0.8 + 0.4 * day;
    hemi.color.setRGB(0.81 - night * 0.35, 0.9 - night * 0.32, 1.0 - night * 0.1);
    renderer.toneMappingExposure = 1.05;

    const D = DISTRICTS[districtKey];
    if (D) districtFog.lerp(tmpC.set(D.fog), Math.min(1, dt * 0.8));
    scene.fog.color.copy(districtFog).lerp(fogDusk, dusk * 0.4).lerp(fogNight, night * 0.9);
    // 雨林雾更浓
    const nearF = districtKey === 'rainforest' ? 90 : districtKey === 'tundra' ? 160 : 250;
    scene.fog.near += (nearF - scene.fog.near) * Math.min(1, dt);
    scene.fog.far += ((districtKey === 'rainforest' ? 700 : 1500) - scene.fog.far) * Math.min(1, dt);
    sky.position.copy(focus);
  }
  const tmpV = new THREE.Vector3();

  return { update, state, sun, hemi, sky };
}
