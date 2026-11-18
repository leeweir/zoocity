// A single coachwork design supplies moving traffic, drivable cars and the precinct fleet.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const metal = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.3, roughness: 0.46 });
const lamps = new THREE.MeshBasicMaterial({ vertexColors: true });
const glass = new THREE.MeshStandardMaterial({ color: 0x658b93, metalness: 0.5, roughness: 0.19 });
const wheelMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.18, roughness: 0.66 });
const paints = new Map(),
  catalogue = new Map();
const colors = {
  rubber: 0x30373a,
  trim: 0xc3c3ad,
  ink: 0x344c51,
  lamp: 0xffe3a2,
  stop: 0xde765e,
  police: 0x334b59,
};
function paint(color) {
  if (!paints.has(color))
    paints.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.28 }));
  return paints.get(color);
}

// Each station describes the width, sill and crown at one point along the wheelbase.
function coachwork(length, stations) {
  const positions = [],
    indices = [],
    corners = 10;
  for (const [along, w, low, high] of stations) {
    const h = high - low;
    for (const [x, y] of [
      [-0.83, 0],
      [0.83, 0],
      [1, 0.2],
      [1, 0.67],
      [0.86, 0.92],
      [0.64, 1],
      [-0.64, 1],
      [-0.86, 0.92],
      [-1, 0.67],
      [-1, 0.2],
    ]) {
      positions.push(x * w, low + y * h, along * length);
    }
  }
  for (let j = 1; j < stations.length; j++)
    for (let i = 0; i < corners; i++) {
      const a = (j - 1) * corners + i,
        b = (j - 1) * corners + ((i + 1) % corners);
      indices.push(a, b, a + corners, b, b + corners, a + corners);
    }
  const last = (stations.length - 1) * corners;
  for (let i = 1; i < corners - 1; i++) indices.push(0, i + 1, i, last, last + i, last + i + 1);
  const g = new THREE.BufferGeometry();
  g.setIndex(indices);
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}
const block = new THREE.BoxGeometry(),
  disk = new THREE.CylinderGeometry(1, 1, 1, 14).rotateX(Math.PI / 2);
const wheelDisc = new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2);
function baked(parts) {
  const list = [],
    c = new THREE.Color();
  for (const [source, color, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0] of parts) {
    const g = source.index ? source.toNonIndexed() : new THREE.BufferGeometry().copy(source);
    g.deleteAttribute('uv');
    g.clearGroups();
    g.scale(w, h, d);
    g.rotateX(rx);
    g.rotateY(ry);
    g.rotateZ(rz);
    g.translate(x, y, z);
    const rgb = new Float32Array(g.attributes.position.count * 3);
    c.set(color);
    for (let i = 0; i < rgb.length; i += 3) c.toArray(rgb, i);
    g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    list.push(g);
  }
  const merged = mergeGeometries(list);
  list.forEach((g) => g.dispose());
  return merged;
}
const wheel = baked([
  [wheelDisc, colors.rubber, 0, 0, 0, 0.26, 0.395, 0.395],
  [wheelDisc, 0x64706d, 0, 0, 0, 0.271, 0.252, 0.252],
  [wheelDisc, 0xc7c5ac, 0, 0, 0, 0.284, 0.195, 0.195],
  [wheelDisc, 0x879796, 0, 0, 0, 0.29, 0.107, 0.107],
]);
function shapes(kind, police) {
  const key = kind + (police ? '-patrol' : '');
  if (catalogue.has(key)) return catalogue.get(key);
  const van = kind === 'van',
    L = van ? 5 : kind === 'compact' ? 3.6 : 4.6;
  const lower = coachwork(L, [
    [-0.5, 0.76, 0.48, 0.77],
    [-0.46, 0.94, 0.4, 0.91],
    [-0.32, 1, 0.39, 1.04],
    [0.08, 1, 0.39, 1.08],
    [0.27, 0.98, 0.42, 1.04],
    [0.44, 0.92, 0.46, 0.94],
    [0.5, 0.76, 0.55, 0.83],
  ]);
  const cab = coachwork(
    L,
    van
      ? [
          [-0.44, 0.89, 0.9, 1.93],
          [-0.37, 0.93, 0.93, 2.11],
          [0.13, 0.9, 0.96, 2.1],
          [0.3, 0.86, 0.98, 1.39],
          [0.34, 0.8, 1, 1.06],
        ]
      : [
          [-0.35, 0.8, 0.95, 1.04],
          [-0.23, 0.86, 0.98, 1.51],
          [-0.13, 0.88, 1.0, 1.65],
          [0.075, 0.85, 1.01, 1.65],
          [0.22, 0.84, 1.03, 1.3],
          [0.28, 0.8, 1.04, 1.08],
        ],
  );
  const roof = coachwork(
    L,
    van
      ? [
          [-0.42, 0.75, 1.92, 1.97],
          [-0.36, 0.8, 2.08, 2.17],
          [0.13, 0.74, 2.07, 2.17],
          [0.18, 0.7, 1.91, 1.99],
        ]
      : [
          [-0.233, 0.69, 1.51, 1.55],
          [-0.139, 0.76, 1.6, 1.72],
          [0.071, 0.73, 1.6, 1.72],
          [0.115, 0.67, 1.53, 1.6],
        ],
  );
  const body = mergeGeometries([lower, roof]);
  lower.dispose();
  roof.dispose();
  const detail = [],
    light = [];
  detail.push(
    [block, colors.trim, 0, 0.535, L * 0.495, 1.57, 0.105, 0.118],
    [block, colors.trim, 0, 0.51, -L * 0.493, 1.56, 0.095, 0.12],
  );
  detail.push([block, colors.ink, 0, 0.738, L * 0.496, 0.77, 0.215, 0.081]);
  for (const dy of [-0.062, 0, 0.062])
    detail.push([block, colors.trim, 0, 0.738 + dy, L * 0.507, 0.71, 0.02, 0.039]);
  for (const s of [-1, 1]) {
    detail.push([disk, colors.trim, s * 0.677, 0.801, L * 0.476, 0.156, 0.143, 0.09]);
    light.push([disk, colors.lamp, s * 0.677, 0.803, L * 0.487, 0.123, 0.108, 0.056]);
    light.push([block, colors.stop, s * 0.633, 0.773, -L * 0.499, 0.26, 0.09, 0.044]);
    detail.push([block, colors.trim, s * 0.99, 0.742, L * -0.014, 0.028, 0.038, L * 0.675]);
    detail.push([block, colors.ink, s * 0.884, van ? 1.52 : 1.31, -L * 0.053, 0.043, van ? 0.92 : 0.48, 0.08]);
    detail.push([block, colors.trim, s * 0.977, 0.92, -L * 0.061, 0.04, 0.035, 0.18]);
    if (police) detail.push([block, 0xe6dbbf, s * 0.996, 0.766, -L * 0.013, 0.034, 0.36, L * 0.42]);
  }
  const roofY = van ? 2.19 : 1.75;
  if (police) detail.push([block, colors.ink, 0, roofY, -L * 0.035, 1.03, 0.09, 0.26]);
  const trim = baked(detail),
    lenses = baked(light);
  const wheels = [
    [-0.93, L * 0.315],
    [0.93, L * 0.315],
    [-0.93, -L * 0.315],
    [0.93, -L * 0.315],
  ];
  const model = { L, body, cab, trim, lenses, roofY, wheels };
  catalogue.set(key, model);
  return model;
}
function part(parent, g, mat, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
let insignia;
function doorInsignia() {
  if (insignia || typeof document === 'undefined') return insignia;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 80;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#334c58';
  ctx.font = 'bold 66px Georgia,serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ZPD', 128, 45);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  insignia = new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.6 });
  return insignia;
}
const plate = new THREE.PlaneGeometry(0.77, 0.25),
  beacon = new THREE.BoxGeometry(0.46, 0.155, 0.24);
const red = new THREE.MeshStandardMaterial({ color: 0xe15c49, emissive: 0xff362d, emissiveIntensity: 1.4 });
const blue = new THREE.MeshStandardMaterial({ color: 0x509dcd, emissive: 0x338bff, emissiveIntensity: 1.4 });
export function createCarModel({ body = 0x4c8795, scale = 1, police = false, kind = 'sedan' } = {}) {
  const g = new THREE.Group(),
    s = new THREE.Group();
  s.scale.setScalar(scale);
  g.add(s);
  const c = shapes(kind, police);
  part(s, c.body, paint(police ? colors.police : body));
  part(s, c.cab, glass);
  part(s, c.trim, metal);
  part(s, c.lenses, lamps).castShadow = false;
  g.userData.wheels = c.wheels.map(([x, z]) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.4, z);
    s.add(pivot);
    part(pivot, wheel, wheelMaterial);
    return pivot;
  });
  if (police) {
    const off = paint(0xa34741),
      offB = paint(0x407fa1);
    const r = part(s, beacon, off, -0.25, c.roofY + 0.12, -c.L * 0.035),
      b = part(s, beacon, offB, 0.25, c.roofY + 0.12, -c.L * 0.035);
    g.userData.siren = { r, b, red, blue, off, offB };
    const badge = doorInsignia();
    if (badge)
      for (const side of [-1, 1]) {
        const sign = part(s, plate, badge, side * 1.017, 0.77, -c.L * 0.013);
        sign.rotation.y = (side * Math.PI) / 2;
        sign.castShadow = false;
      }
  }
  g.userData.length = c.L * scale;
  return g;
}

export function parkedCruiser(builder, x, y, z) {
  const c = shapes('sedan', true),
    transform = new THREE.Matrix4();
  const add = (g, color, kind, dx = 0, dy = 0, dz = 0, tinted = false) => {
    transform.makeTranslation(x + dx, y + dy, z + dz);
    builder.add(g, transform, color, { mat: kind, vertexColors: tinted });
  };
  add(c.body, colors.police, 'shiny');
  add(c.cab, 0x658b93, 'glass');
  add(c.trim, 0xffffff, 'shiny', 0, 0, 0, true);
  add(c.lenses, 0xffffff, 'glow', 0, 0, 0, true);
  for (const [dx, dz] of c.wheels) add(wheel, 0xffffff, 'solid', dx, 0.4, dz, true);
  add(beacon, 0xaf554b, 'shiny', -0.25, c.roofY + 0.12, -c.L * 0.035);
  add(beacon, 0x5389a5, 'shiny', 0.25, c.roofY + 0.12, -c.L * 0.035);
}
