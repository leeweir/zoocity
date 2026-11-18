// Scenery for Savanna Central. All opaque parts pass through the district's chunk builder.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const brass = 0xd9ac68,
  bronze = 0x967049,
  ivory = 0xefdfbb,
  stone = 0xcab897;
const enamel = 0x265854,
  teal = 0x548b83;
const m = new THREE.Matrix4(),
  q = new THREE.Quaternion(),
  p = new THREE.Vector3(),
  scale = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const branch = new THREE.CylinderGeometry(0.53, 1, 1, 7);
const ring = new THREE.TorusGeometry(1, 0.04, 6, 48).rotateX(-Math.PI / 2);

function place(b, geometry, x, y, z, sx, sy, sz, color, opts = {}) {
  q.setFromAxisAngle(up, opts.ry || 0);
  m.compose(p.set(x, y, z), q, scale.set(sx, sy, sz));
  b.add(geometry, m, color, opts);
}
function limb(b, start, end, radius, color) {
  const dir = new THREE.Vector3().subVectors(end, start);
  q.setFromUnitVectors(up, dir.clone().normalize());
  m.compose(p.copy(start).lerp(end, 0.5), q, scale.set(radius, dir.length(), radius));
  b.add(branch, m, color);
}

function foliage(seed, detailed) {
  const pos = [],
    colors = [],
    indices = [],
    sides = detailed ? 12 : 8;
  const layers = detailed
    ? [
        [-0.49, 0.04],
        [-0.4, 0.53],
        [-0.18, 0.9],
        [0.12, 1],
        [0.4, 0.78],
        [0.58, 0.46],
        [0.65, 0.027],
      ]
    : [
        [-0.49, 0.04],
        [-0.29, 0.8],
        [0.12, 1],
        [0.48, 0.62],
        [0.65, 0.027],
      ];
  const bottom = new THREE.Color(0x2c5e54),
    middle = new THREE.Color(0x52876b),
    top = new THREE.Color(0x9eaf71),
    c = new THREE.Color();
  layers.forEach(([h, r], j) => {
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2,
        edge = 1 + 0.17 * Math.sin(a * 3 + seed) + 0.1 * Math.cos(a * 5 - seed);
      const lift = 0.085 * Math.sin(a * 3 + seed * 0.5) + 0.066 * Math.cos(a * 2 - seed);
      pos.push(Math.cos(a) * r * edge, h + lift * r, Math.sin(a) * r * (1 + 0.12 * Math.sin(a * 4 + seed)));
      const light = THREE.MathUtils.clamp(
        (h + 0.48) * 0.84 + lift * 1.12 + 0.1 * Math.cos(a - 0.4) + 0.075 * Math.sin(i * 5 + j * 2),
        0,
        1,
      );
      c.copy(bottom)
        .lerp(middle, Math.min(1, light * 1.7))
        .lerp(top, Math.max(0, light - 0.41) * 1.38);
      colors.push(c.r, c.g, c.b);
      const k = j * sides + i,
        n = j * sides + ((i + 1) % sides);
      if (j > 0) indices.push(k - sides, k, n - sides, n - sides, k, n);
    }
  });
  // Small groups of folded leaves break the canopy edge and catch the key light.
  for (let i = 0; i < (detailed ? 16 : 0); i++) {
    const sector = (i * 5) % sides, row = 3 + (i % 3);
    const start = 3 * (row * sides + sector), next = 3 * (row * sides + (sector + 1) % sides);
    const x = (pos[start] + pos[next]) * .5, h = (pos[start + 1] + pos[next + 1]) * .5;
    const z = (pos[start + 2] + pos[next + 2]) * .5, a = Math.atan2(z, x);
    for (const hand of [-1, 1]) {
      const dir = a + hand * 0.54,
        dx = Math.cos(dir) * 0.23,
        dz = Math.sin(dir) * 0.23;
      const k = pos.length / 3,
        w = 0.23;
      pos.push(
        x,
        h,
        z,
        x + dx * 0.48 - dz * w,
        h + 0.06,
        z + dz * 0.48 + dx * w,
        x + dx,
        h - 0.052,
        z + dz,
        x + dx * 0.46 + dz * w,
        h + 0.082,
        z + dz * 0.46 - dx * w,
      );
      c.copy(top).lerp(middle, 0.51 + 0.15 * Math.cos(a));
      for (let k = 0; k < 4; k++) colors.push(c.r, c.g, c.b);
      indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(indices);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}
const crowns = [0.7, 2.1, 4.4].map((seed) => foliage(seed, true));
const simpleCrowns = [0.7, 2.1, 4.4].map((seed) => foliage(seed, false));
const canopyTints = [0xfff5dd, 0xe1f1e9, 0xffeed6, 0xe5ead4];

export function streetTree(b, col, x, z, base, planter, h, tint, wide) {
  if (planter) {
    b.box(1.65, 0.34, 1.65, x, base, z, 0x9e9b86);
    b.box(1.72, 0.11, 1.72, x, base + 0.34, z, 0xd1bfa0);
    b.box(1.43, 0.018, 1.43, x, base + 0.45, z, 0x615948, { shadow: false });
    col.box(x, z, 1.65, 1.65, { yMax: base + 0.45, walkable: true });
  }
  const a = (x * 0.93 + z * 0.47) % (Math.PI * 2),
    bark = 0x77614e;
  const foliageSet = Math.hypot(x, z) < 132 ? crowns : simpleCrowns;
  const root = new THREE.Vector3(x, base, z);
  const fork = new THREE.Vector3(x + 0.14 * Math.cos(a), base + h * 0.68, z + 0.14 * Math.sin(a));
  limb(b, root, fork, 0.2, bark);
  col.circle(x, z, 0.22, { yMax: base + h });
  for (let i = 0; i < 3; i++) {
    const angle = a + i * 2.32,
      span = (wide ? 1.19 : 0.82) * (i === 2 ? 0.42 : 1);
    const end = new THREE.Vector3(
      x + Math.cos(angle) * span,
      base + h + (i === 2 ? 0.85 : i * 0.36),
      z + Math.sin(angle) * span,
    );
    limb(b, fork, end, i === 2 ? 0.109 : 0.138, bark);
    place(
      b,
      foliageSet[i],
      end.x,
      end.y + 0.34,
      end.z,
      wide ? 1.66 : 1.29,
      wide ? 1.28 : 1.82,
      wide ? 1.54 : 1.23,
      canopyTints[tint],
      { mat: 'canopy', vertexColors: true, ry: angle },
    );
  }
}

function relief(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.11,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.045,
    bevelSegments: 2,
    curveSegments: 6,
  });
}
const shield = relief([
  [-0.83, 0.77],
  [-0.42, 0.77],
  [0, 0.98],
  [0.42, 0.77],
  [0.83, 0.77],
  [0.77, -0.03],
  [0.58, -0.47],
  [0, -0.91],
  [-0.58, -0.47],
  [-0.77, -0.03],
]);
const archShape = new THREE.Shape();
archShape.moveTo(-0.5, 0);
archShape.lineTo(0.5, 0);
archShape.lineTo(0.5, 0.65);
archShape.bezierCurveTo(0.5, 1.12, -0.5, 1.12, -0.5, 0.65);
archShape.closePath();
const arch = new THREE.ExtrudeGeometry(archShape, { depth: 0.12, bevelEnabled: false, curveSegments: 16 });
function paw(b, x, y, z, size, color) {
  b.sphere(size * 0.29, x, y - size * 0.095, z, color, { sx: 1.14, sy: 0.84, sz: 0.19, seg: 14, mat: 'shiny' });
  for (const [dx, dy, s, tilt] of [
    [-0.3, 0.12, 0.12, 0.48],
    [-0.11, 0.3, 0.134, 0.16],
    [0.11, 0.3, 0.134, -0.16],
    [0.3, 0.12, 0.12, -0.48],
  ]) {
    b.sphere(size * s, x + dx * size, y + dy * size, z, color, {
      sx: 0.82,
      sy: 1.22,
      sz: 0.42,
      rz: tilt,
      seg: 12,
      mat: 'shiny',
    });
  }
}

export function precinctFacade(b, base) {
  const z = -71.5;
  // Arched bronze shop-height windows and ribbed piers define the scale at the street.
  for (const cx of [62, 98]) {
    for (const dx of [-5, 0, 5]) {
      const x = cx + dx;
      place(b, arch, x, base + 0.54, z, 4.12, 5.32, 0.85, stone);
      place(b, arch, x, base + 0.68, z + 0.13, 3.62, 4.88, 1, teal, { mat: 'glass' });
      b.box(0.1, 4.16, 0.19, x, base + 0.68, z + 0.27, brass, { mat: 'shiny' });
      b.box(3.54, 0.13, 0.2, x, base + 3.7, z + 0.27, bronze);
      b.box(4.04, 0.2, 0.45, x, base + 0.42, z + 0.13, ivory);
    }
    for (const dx of [-9.4, -2.5, 2.5, 9.4]) {
      const x = cx + dx;
      b.box(0.66, 21.5, 0.54, x, base + 0.4, z, ivory);
      b.box(0.19, 20.5, 0.14, x, base + 0.9, z + 0.34, stone);
      b.box(0.94, 0.55, 0.86, x, base, z, stone);
    }
    for (const y of [6.2, 20.9, 22.8]) b.box(20.8, 0.21, 1.05, cx, base + y, z - 0.19, brass, { mat: 'shiny' });
    b.box(18, 0.6, 0.3, cx, base + 21.32, z + 0.14, enamel);
    for (let i = -8; i <= 8; i += 2) b.box(0.83, 0.16, 0.16, cx + i, base + 21.53, z + 0.37, brass);
  }
  // Glass ribs follow the semicircle; the lower braces end at the entrance canopy.
  for (let i = -7; i <= 7; i++) {
    const a = (i * Math.PI) / 16,
      sn = Math.sin(a),
      cs = Math.cos(a);
    const x = 80 + 10.07 * sn,
      z = -82 + 10.07 * cs;
    b.box(0.16, 21.4, 0.18, x, base + 8.7, z, 0x9b997f, { ry: a, mat: 'shiny' });
  }
  for (const h of [11.9, 15.0, 23.8, 27.2])
    b.cyl(10.1, 10.1, 0.12, 80, base + h, -82, 0x9aab97, { seg: 32, mat: 'shiny' });
  // The emblem and wings are modeled relief, so their silhouette survives oblique views.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const w = 4.5 - i * 0.92;
      b.box(w, 0.4, 0.46, 80 + side * (2.6 + w * 0.5), base + 18.8 - i * 0.8, -71.54, brass, { mat: 'shiny' });
      b.box(0.31, 10.5 - i * 0.77, 0.45, 80 + side * (3.6 + i * 1.04), base + 18.9, -73.21 - i * 0.45, ivory);
    }
  }
  place(b, shield, 80, base + 18.65, -71.42, 3.48, 3.48, 2.4, brass, { mat: 'shiny' });
  place(b, shield, 80, base + 18.7, -71.05, 3.06, 3.04, 1.5, enamel, { mat: 'shiny' });
  paw(b, 80, base + 18.63, -70.7, 3.59, brass);
  // A stepped crown, lantern and clear entrance canopy echo the same shield outline.
  for (let i = 0; i < 3; i++)
    b.cyl(8.9 - i * 1.36, 9.6 - i * 1.36, 0.74, 80, base + 30.9 + i * 0.74, -82, i === 1 ? enamel : ivory, {
      seg: 32,
    });
  b.cyl(0.24, 0.8, 5.0, 80, base + 33.0, -82, brass, { seg: 12, mat: 'shiny' });
  b.box(15.6, 0.21, 4.9, 80, base + 7.43, -69.75, brass, { mat: 'shiny' });
  b.box(15.2, 1.25, 0.31, 80, base + 7.68, -67.44, enamel);
  b.box(15.6, 0.16, 0.47, 80, base + 8.94, -67.45, brass, { mat: 'shiny' });
  for (const s of [-1, 1]) {
    b.box(3.5, 0.2, 0.29, 80 + s * 5.49, base + 8.19, -67.19, brass);
    for (const dx of [-0.2, 0.2]) b.box(0.13, 7.4, 0.22, 80 + s * 6.5 + dx, base, -68.12, brass, { mat: 'shiny' });
  }
  // Front doors sit just forward of the curved lobby glass.
  for (const dx of [-1.13, 1.13]) {
    b.box(2.15, 5.05, 0.25, 80 + dx, base, -71.48, teal, { mat: 'glass' });
    b.box(0.09, 5.07, 0.18, 80 + dx * 2, base, -71.23, brass);
    b.box(1.98, 0.12, 0.18, 80 + dx, base + 3.83, -71.23, brass);
    b.box(0.1, 0.87, 0.15, 80 + dx * 0.37, base + 1.12, -71.2, brass, { mat: 'shiny' });
  }
}

export function civicFountain(b, col, scene, animate, base) {
  const cy = (rt, rb, h, y, c, opts = {}) => b.cyl(rt, rb, h, 0, base + y, 0, c, { seg: 40, ...opts });
  const rim = (rad, y, c) => place(b, ring, 0, base + y, 0, rad, rad * 0.65, rad, c, { mat: 'shiny' });
  cy(9.55, 9.65, 0.3, 0, stone);
  cy(9.34, 9.5, 0.27, 0.3, ivory);
  cy(9.05, 9.05, 0.045, 0.58, 0x438e88, { mat: 'shiny' });
  cy(8.92, 8.92, 0.035, 0.63, 0x71c8bd, { mat: 'water', shadow: false });
  rim(9.31, 0.63, ivory);
  rim(9.54, 0.32, bronze);
  col.circle(0, 0, 9.65, { yMax: base + 0.66, walkable: true });
  cy(2.34, 2.62, 0.34, 0.65, teal);
  cy(1.12, 1.84, 2.55, 0.98, ivory);
  cy(2.44, 1.1, 0.42, 3.27, bronze);
  cy(4.88, 2.35, 0.68, 3.65, teal);
  cy(4.76, 4.76, 0.032, 4.34, 0x6ac4b6, { mat: 'water', shadow: false });
  rim(4.85, 4.35, brass);
  cy(0.72, 1.23, 2.04, 4.36, ivory);
  cy(1.32, 0.69, 0.28, 6.3, bronze);
  cy(2.63, 1.25, 0.52, 6.56, teal);
  cy(2.52, 2.52, 0.03, 7.095, 0x76c6b6, { mat: 'water', shadow: false });
  rim(2.6, 7.09, brass);
  cy(0.27, 0.67, 0.95, 7.1, ivory);
  b.sphere(0.51, 0, base + 8.34, 0, brass, { mat: 'shiny', seg: 20 });
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      s = Math.sin(a),
      c = Math.cos(a);
    b.cyl(0.087, 0.13, 2.35, s * 1.3, base + 0.99, c * 1.3, brass, { seg: 6, rx: -c * 0.17, rz: s * 0.17 });
    b.sphere(0.2, 8.54 * s, base + 0.72, 8.54 * c, brass, { seg: 8, sy: 0.62, mat: 'shiny' });
  }
  col.circle(0, 0, 1.9, { yMax: base + 8.9 });
  // Slender parabolic jets leave open air between tiers. All streams share one draw.
  const arcs = [];
  const jet = (a, from, fromY, to, toY, peak, r) => {
    const p = (rad) => [Math.sin(a) * rad, Math.cos(a) * rad];
    const pts = Array.from({ length: 9 }, (_, i) => {
      const t = i / 8,
        [x, z] = p(THREE.MathUtils.lerp(from, to, t));
      return new THREE.Vector3(x, base + THREE.MathUtils.lerp(fromY, toY, t) + 4 * t * (1 - t) * peak, z);
    });
    arcs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, r, 5, false));
  };
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    jet(a, 8.54, 0.76, 4.99, 0.7, 2.29, 0.038);
    jet(a + 0.14, 4.8, 4.28, 6.08, 0.7, 0.56, 0.048);
    if (i % 2 === 0) jet(a, 2.56, 7.04, 3.32, 4.38, 0.38, 0.051);
  }
  for (let i = 0; i < 5; i++) jet(i * Math.PI * 0.4, 0.11, 8.73, 1.12, 7.12, 1.25, 0.043);
  const water = new THREE.MeshPhysicalMaterial({
    color: 0xa4ddd4,
    roughness: 0.22,
    metalness: 0.2,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  const streams = new THREE.Mesh(mergeGeometries(arcs), water);
  arcs.forEach((a) => a.dispose());
  scene.add(streams);
  animate((dt, t) => {
    water.opacity = 0.74 + 0.065 * Math.sin(t * 2.4);
  });
  return streams;
}
