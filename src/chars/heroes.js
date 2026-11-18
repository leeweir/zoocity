// Playable officers. Feet are at the origin, the face looks toward local +Z.
import * as THREE from 'three';
import { makeRigAnimator } from './animals.js';
import { loft, bend, batchRigidParts } from './sculpt.js';

const sphere = new THREE.SphereGeometry(1, 20, 14);
const box = new THREE.BoxGeometry();
const matte = 0.86,
  metal = 0.36;
const materials = new Map();
function material(color, roughness = matte, metalness = 0) {
  const key = [color, roughness, metalness].join('/');
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  return materials.get(key);
}
const painted = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: matte });
const swatches = new Map();
function ink(hex) {
  if (!swatches.has(hex)) swatches.set(hex, new THREE.Color(hex));
  return swatches.get(hex);
}
const smooth = THREE.MathUtils.smoothstep;
function pivot(parent, name, pos, rot = [0, 0, 0]) {
  const g = new THREE.Group();
  g.name = name;
  parent.add(g);
  g.position.set(...pos);
  g.rotation.set(...rot);
  return g;
}
function mesh(parent, geometry, mat, p = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(...p);
  m.scale.set(...scale);
  m.rotation.set(...rotation);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const oval = (parent, c, p, s, r) => mesh(parent, sphere, material(c), p, s, r);
const panel = (parent, c, p, s, r) => mesh(parent, box, material(c), p, s, r);

function stroke(parent, color, points, radius) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const segments = 12,
    sides = 6;
  const g = new THREE.TubeGeometry(curve, segments, radius, sides, false);
  const pos = g.attributes.position,
    v = new THREE.Vector3();
  for (let row = 0; row <= segments; row++) {
    const center = curve.getPointAt(row / segments);
    const width = 0.17 + 0.83 * Math.sin((Math.PI * row) / segments) ** 0.55;
    for (let j = 0; j <= sides; j++) {
      const i = row * (sides + 1) + j;
      v.fromBufferAttribute(pos, i).sub(center).multiplyScalar(width).add(center);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  mesh(parent, g, material(color));
}

const eyeShape = new THREE.SphereGeometry(1, 24, 14);
{
  const p = eyeShape.attributes.position,
    uv = eyeShape.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i);
    uv.setXY(i, (x + 1) / 2, (y + 1) / 2);
    p.setY(i, y * (1 - 0.29 * x * x));
  }
  eyeShape.computeVertexNormals();
}
const eyeshades = new Map();
function eyeMaterial(fox, side) {
  const key = (fox ? 'hazel' : 'violet') + side;
  if (eyeshades.has(key)) return eyeshades.get(key);
  const size = 128,
    data = new Uint8Array(size * size * 4);
  const light = ink(fox ? '#a9c663' : '#cda5e9'),
    dark = ink(fox ? '#365743' : '#5a477e');
  const c = new THREE.Color();
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const x = (2 * (i + 0.5)) / size - 1,
        y = (2 * (j + 0.5)) / size - 1;
      const dx = (x + side * 0.17) * (fox ? 1.3 : 1.05),
        dy = y + 0.04,
        d = Math.hypot(dx, dy);
      c.copy(ink('#fff3de')).lerp(ink('#c4b6af'), smooth(y, 0.12, 1) * 0.55);
      if (d < 0.85) {
        const rays = Math.cos(Math.atan2(dy, dx) * 31) * 0.035;
        c.copy(dark).lerp(light, Math.max(0, 0.52 - dy * 0.8 + rays));
        c.lerp(ink('#302737'), smooth(d, 0.72, 0.85));
        c.lerp(ink('#1a1925'), 1 - smooth(d, 0.37, 0.42));
      }
      const rim = Math.sqrt(Math.max(0, 1 - x * x));
      c.lerp(ink('#38303b'), smooth(y, rim * 0.82, rim * 0.94 + 0.008));
      if (Math.hypot(dx + 0.22, dy - 0.3) < 0.145 || Math.hypot(dx - 0.21, dy + 0.24) < 0.065)
        c.copy(ink('#fffaf0'));
      c.convertLinearToSRGB();
      const k = (i + j * size) * 4;
      data[k] = c.r * 255;
      data[k + 1] = c.g * 255;
      data[k + 2] = c.b * 255;
      data[k + 3] = 255;
    }
  const map = new THREE.DataTexture(data, size, size);
  map.colorSpace = THREE.SRGBColorSpace;
  map.generateMipmaps = true;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.42 });
  eyeshades.set(key, m);
  return m;
}

function eyes(head, fox) {
  const list = [];
  for (const side of [-1, 1]) {
    const x = fox ? 0.07 : 0.071,
      y = fox ? 0.163 : 0.173;
    const eye = pivot(
      head,
      'eye',
      [side * x, y, fox ? 0.097 : 0.107],
      [-0.07, side * 0.44, side * (fox ? 0.1 : 0.06)],
    );
    mesh(eye, eyeShape, eyeMaterial(fox, side), [0, 0, 0.002], [fox ? 0.052 : 0.048, fox ? 0.029 : 0.044, 0.019]);
    list.push(eye);
    const brow = fox ? '#754237' : '#554d60';
    const raise = fox && side > 0 ? 0.007 : 0,
      arch = fox ? 0.038 : 0.05;
    stroke(
      head,
      brow,
      [
        [side * 0.031, y + 0.03 + raise, 0.115],
        [side * 0.072, y + arch + raise, 0.104],
        [side * 0.118, y + 0.031, 0.075],
      ],
      fox ? 0.009 : 0.0065,
    );
  }
  return list;
}

function headSculpt(head, fox) {
  const sections = fox
    ? [
        [0, 0.022, 0.028, 0.022],
        [0.013, 0.068, 0.058, 0.026],
        [0.032, 0.108, 0.078, 0.021],
        [0.06, 0.146, 0.096, 0.01],
        [0.077, 0.162, 0.105, 0.002],
        [0.091, 0.171, 0.11, -0.002],
        [0.105, 0.174, 0.117, -0.006],
        [0.119, 0.173, 0.121, -0.008],
        [0.136, 0.168, 0.125, -0.01],
        [0.156, 0.159, 0.126, -0.011],
        [0.193, 0.143, 0.117, -0.014],
        [0.223, 0.119, 0.098, -0.018],
        [0.246, 0.087, 0.072, -0.018],
        [0.262, 0.048, 0.04, -0.02],
        [0.269, 0.002, 0.003, -0.02],
      ]
    : [
        [0, 0.021, 0.025, 0.023],
        [0.013, 0.067, 0.055, 0.024],
        [0.03, 0.101, 0.08, 0.019],
        [0.056, 0.138, 0.102, 0.01],
        [0.088, 0.161, 0.12, 0.002],
        [0.119, 0.169, 0.131, -0.003],
        [0.154, 0.166, 0.135, -0.006],
        [0.19, 0.157, 0.132, -0.009],
        [0.222, 0.139, 0.118, -0.011],
        [0.247, 0.112, 0.098, -0.013],
        [0.267, 0.073, 0.067, -0.014],
        [0.279, 0.033, 0.033, -0.014],
        [0.283, 0.002, 0.002, -0.014],
      ];
  const skull = loft(sections, 48, (c, v, x, z) => {
    c.copy(ink(fox ? '#ae4f34' : '#777384')).lerp(ink(fox ? '#ed914a' : '#aaa6b0'), smooth(v, 0.2, 0.88));
    const mask = (fox ? 0.44 : 0.33) + 0.16 * Math.abs(x) - 0.075 * z + 0.022 * Math.cos(9 * x);
    c.lerp(ink(fox ? '#f6d9ae' : '#dad3d1'), (1 - smooth(v, mask - 0.05, mask + 0.07)) * smooth(z, -0.72, 0.36));
  });
  if (fox) {
    // Pull the front rings of the skull into the muzzle. The smile follows this same
    // surface all the way around the cheeks, so it sits against the fur in profile.
    const bridge = (y, front) => 0.1 * Math.exp(-(((y - 0.105) / 0.038) ** 2)) * Math.max(0, front) ** 8;
    const pos = skull.attributes.position;
    sections.forEach(([y, , depth, cz = 0], row) => {
      for (let i = 0; i <= 48; i++) {
        const k = row * 49 + i,
          z = pos.getZ(k);
        pos.setZ(k, z + bridge(y, (z - cz) / depth));
      }
    });
    skull.computeVertexNormals();
    const cheekPoint = (x, y) => {
      const i = sections.findIndex((row) => row[0] >= y);
      const [low, high] = [sections[i - 1], sections[i]];
      const t = (y - low[0]) / (high[0] - low[0]);
      const at = (k) => THREE.MathUtils.lerp(low[k] || 0, high[k] || 0, t);
      const front = Math.sqrt(1 - (x / at(1)) ** 2);
      return [x, y, at(3) + at(2) * front + bridge(y, front) + 0.0016];
    };
    mesh(
      head,
      loft(
        [
          [-0.017, 0.004, 0.007],
          [-0.011, 0.018, 0.013],
          [0.001, 0.027, 0.017],
          [0.011, 0.025, 0.013],
          [0.016, 0.01, 0.008],
        ],
        24,
      ),
      material('#32292c', 0.49),
      [0, 0.118, 0.204],
    );
    for (const s of [-1, 1]) {
      stroke(
        head,
        '#795347',
        [
          [0, 0.082],
          [s * 0.028, 0.078],
          [s * 0.06, 0.079],
          [s * 0.087, 0.089],
          [s * 0.102, s > 0 ? 0.103 : 0.096],
        ].map(([x, y]) => cheekPoint(x, y)),
        0.0032,
      );
      for (const [x, y] of [
        [0.058, 0.102],
        [0.072, 0.099],
        [0.079, 0.108],
      ])
        oval(head, '#ab795d', cheekPoint(s * x, y), [0.0027, 0.0022, 0.002]);
      const tuft = loft(
        [
          [0, 0.022, 0.027],
          [0.018, 0.028, 0.03],
          [0.044, 0.018, 0.02, -0.006],
          [0.062, 0.002, 0.002, -0.016],
        ],
        16,
      );
      mesh(head, tuft, material('#dfba91'), [s * 0.142, 0.098, 0.007], [1, 1, 1], [-0.23, 0, -s * 1.93]);
    }
  } else {
    const forelock = loft(
      [
        [0, 0.019, 0.012],
        [0.014, 0.023, 0.012],
        [0.027, 0.015, 0.008],
        [0.043, 0.002, 0.002],
      ],
      16,
    );
    mesh(head, forelock, material('#9b95a1'), [-0.025, 0.257, 0.017], [1, 1, 1], [-0.25, 0, -0.95]);
    oval(head, '#eee2de', [0, 0.064, 0.112], [0.051, 0.032, 0.029]);
    stroke(
      head,
      '#725761',
      [
        [-0.05, 0.084, 0.133],
        [-0.025, 0.074, 0.145],
        [0, 0.072, 0.149],
        [0.025, 0.075, 0.145],
        [0.05, 0.085, 0.133],
      ],
      0.0051,
    );
    panel(head, '#f9efe2', [0, 0.066, 0.144], [0.021, 0.014, 0.007]);
    for (const s of [-1, 1]) {
      oval(head, '#e8dedc', [s * 0.032, 0.099, 0.116], [0.045, 0.034, 0.042], [0, s * 0.15, -s * 0.1]);
      for (const [x, y, z] of [
        [0.033, 0.101, 0.157],
        [0.043, 0.094, 0.154],
        [0.052, 0.105, 0.151],
      ])
        oval(head, '#a68f91', [s * x, y, z], [0.0024, 0.0024, 0.0015]);
    }
    mesh(
      head,
      loft(
        [
          [-0.013, 0.002, 0.004],
          [-0.008, 0.012, 0.008],
          [0, 0.021, 0.011],
          [0.008, 0.019, 0.01],
          [0.012, 0.008, 0.005],
        ],
        24,
      ),
      material('#ad6576', 0.58),
      [0, 0.119, 0.154],
    );
  }
  mesh(head, skull, painted);
}

function ears(head, fox) {
  const list = [];
  for (const side of [-1, 1]) {
    const ear = pivot(
      head,
      'ear mount',
      [side * (fox ? 0.089 : 0.064), fox ? 0.203 : 0.244, fox ? -0.025 : -0.014],
      [-0.12, side * (fox ? 0.18 : 0.12), -side * (fox ? 0.37 : side > 0 ? 0.16 : 0.095)],
    );
    const sections = fox
      ? [
          [0, 0.041, 0.032],
          [0.023, 0.065, 0.04],
          [0.051, 0.067, 0.039],
          [0.081, 0.058, 0.035, -0.003],
          [0.108, 0.045, 0.028, -0.007],
          [0.137, 0.032, 0.021, -0.012],
          [0.162, 0.018, 0.014, -0.017],
          [0.182, 0.008, 0.007, -0.019],
          [0.188, 0.001, 0.002, -0.021],
        ]
      : [
          [0, 0.028, 0.021],
          [0.032, 0.038, 0.029],
          [0.075, 0.043, 0.031],
          [0.126, 0.05, 0.03, -0.002],
          [0.177, 0.055, 0.029, -0.006],
          [0.225, 0.056, 0.028, -0.014],
          [0.271, 0.051, 0.025, -0.022],
          [0.306, 0.041, 0.021, -0.029],
          [0.332, 0.03, 0.017, -0.035],
          [0.349, 0.016, 0.01, -0.04],
          [0.357, 0.002, 0.002, -0.043],
        ];
    const geometry = loft(sections, 32, (c, v, x, z) => {
      c.copy(ink(fox ? '#db7d43' : '#aaa3af')).lerp(ink(fox ? '#694139' : '#716978'), smooth(-z, 0, 1) * 0.58);
      c.lerp(ink(fox ? '#493238' : '#5e5769'), smooth(v, fox ? 0.66 : 0.76, 0.97));
      const edge = (fox ? 0.79 : 0.7) * Math.max(0, Math.sin(Math.PI * v)) ** 0.62;
      const inside =
        smooth(z, 0.38, 0.69) *
        (1 - smooth(Math.abs(x), edge - 0.08, edge + 0.08)) *
        smooth(v, 0.08, 0.21) *
        (1 - smooth(v, 0.81, 0.95));
      const earColor = ink(fox ? '#f2cb9d' : '#d998a0');
      c.lerp(earColor, inside);
    });
    const [base, tip] = bend(ear, geometry, painted, [[fox ? 0.108 : 0.183, fox ? 0.045 : 0.073]]);
    list.push({ base, tip, side });
  }
  return list;
}

let shirt, patch;
function canvasMap(w, h, draw) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function summerShirt() {
  if (shirt) return shirt;
  const map = canvasMap(256, 256, (ctx) => {
    ctx.fillStyle = '#9eb66d';
    ctx.fillRect(0, 0, 256, 256);
    for (const [cx, cy, rotation] of [
      [42, 73, -0.68],
      [167, 33, 0.53],
      [179, 171, -0.56],
      [44, 209, 1.32],
    ]) {
      for (const dx of [-256, 0, 256])
        for (const dy of [-256, 0, 256]) {
          ctx.save();
          ctx.translate(cx + dx, cy + dy);
          ctx.rotate(rotation);
          ctx.fillStyle = '#65875e';
          ctx.strokeStyle = '#698759';
          ctx.lineWidth = 2.1;
          ctx.beginPath();
          ctx.moveTo(0, 29);
          ctx.quadraticCurveTo(5, -5, 0, -36);
          ctx.stroke();
          for (let i = 0; i < 5; i++)
            for (const side of [-1, 1]) {
              const y = 18 - i * 9,
                len = 23 - i * 2;
              ctx.beginPath();
              ctx.moveTo(2, y);
              ctx.quadraticCurveTo(side * len, y - 2, side * (len + 2), y - 20);
              ctx.quadraticCurveTo(side * 8, y - 19, 2, y);
              ctx.fill();
            }
          ctx.restore();
        }
    }
  });
  if (map) {
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(1.75, 1);
  }
  shirt = new THREE.MeshStandardMaterial({ color: map ? 0xffffff : 0x9eb66d, map, roughness: 0.89 });
  return shirt;
}
function backPatch(torso) {
  if (!patch) {
    const map = canvasMap(256, 96, (ctx) => {
      ctx.fillStyle = '#27425a';
      ctx.fillRect(0, 0, 256, 96);
      ctx.strokeStyle = '#baaa74';
      ctx.lineWidth = 3;
      ctx.strokeRect(5, 5, 246, 86);
      ctx.fillStyle = '#f5dc93';
      ctx.font = 'bold 66px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ZPD', 128, 53);
    });
    if (!map) return;
    patch = new THREE.MeshStandardMaterial({ map, roughness: matte });
  }
  const label = new THREE.PlaneGeometry(0.147, 0.052, 10, 3);
  const positions = label.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const depth = (0.116 - 0.15 * Math.abs(y)) * Math.sqrt(1 - (x / 0.145) ** 2);
    positions.setZ(i, depth);
  }
  label.computeVertexNormals();
  mesh(torso, label, patch, [0, 0.203, 0], [1, 1, 1], [0, Math.PI, 0]);
}

const navy = '#263b50',
  blues = '#4d7290',
  trouser = '#34465e',
  leather = '#34404c',
  brass = '#e0bb75';
function makeTorso(hips, fox) {
  const torso = pivot(hips, 'torso', [0, 0.012, 0]);
  const uniform = fox ? summerShirt() : material(blues);
  const profile = fox
    ? [
        [-0.06, 0.084, 0.069],
        [-0.054, 0.117, 0.086],
        [-0.043, 0.13, 0.099],
        [-0.023, 0.131, 0.101],
        [0.042, 0.125, 0.1],
        [0.127, 0.127, 0.099],
        [0.213, 0.141, 0.099],
        [0.269, 0.15, 0.096],
        [0.298, 0.135, 0.085],
        [0.326, 0.076, 0.055],
        [0.339, 0.048, 0.044],
      ]
    : [
        [-0.025, 0.096, 0.08],
        [-0.01, 0.12, 0.094],
        [0.052, 0.116, 0.092],
        [0.112, 0.114, 0.095],
        [0.185, 0.134, 0.1],
        [0.238, 0.146, 0.095],
        [0.263, 0.133, 0.087],
        [0.289, 0.06, 0.052],
      ];
  mesh(torso, loft(profile), uniform);
  if (fox) {
    const knot = material('#675878');
    mesh(
      torso,
      loft(
        [
          [-0.012, 0.009, 0.009],
          [-0.005, 0.019, 0.011],
          [0.014, 0.023, 0.013],
          [0.021, 0.014, 0.012],
        ],
        16,
      ),
      knot,
      [0, 0.283, 0.104],
    );
    const stripeRows = [];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      const width = t < 0.1 ? 0.004 + (0.023 * t) / 0.1 : 0.027 - (0.017 * (t - 0.1)) / 0.9;
      stripeRows.push([-0.006 + t * 0.278, width, 0.0045, 0.113 - 0.006 * t * t, 0.012 * (1 - t)]);
    }
    mesh(
      torso,
      loft(stripeRows, 20, (c, v, x) => {
        const band = (((v * 4.4 + x * 0.1) % 1) + 1) % 1;
        c.copy(ink(band < 0.18 ? '#8299ab' : band < 0.26 ? '#ae9baf' : '#625371'));
      }),
      painted,
    );
    for (const s of [-1, 1])
      mesh(
        torso,
        loft(
          [
            [0, 0.003, 0.004],
            [0.025, 0.02, 0.008],
            [0.056, 0.038, 0.011],
            [0.068, 0.023, 0.009],
          ],
          16,
        ),
        material('#bcc98b'),
        [s * 0.044, 0.248, 0.098],
        [1, 1, 1],
        [-0.21, s * 0.4, -s * 0.32],
      );
  } else {
    mesh(
      torso,
      loft([
        [0.025, 0.105, 0.089],
        [0.036, 0.12, 0.101],
        [0.08, 0.125, 0.104],
        [0.162, 0.136, 0.106],
        [0.205, 0.145, 0.11],
        [0.239, 0.139, 0.102],
        [0.253, 0.115, 0.085],
        [0.263, 0.075, 0.065],
      ]),
      material(navy),
    );
    mesh(
      torso,
      loft([
        [-0.015, 0.107, 0.087],
        [-0.011, 0.127, 0.1],
        [0.02, 0.128, 0.101],
        [0.024, 0.115, 0.09],
      ]),
      material(leather),
    );
    for (const s of [-1, 1]) {
      mesh(
        torso,
        loft(
          [
            [0, 0.009, 0.009],
            [0.004, 0.027, 0.018],
            [0.044, 0.027, 0.018],
            [0.052, 0.023, 0.016],
          ],
          12,
        ),
        material('#435060'),
        [s * 0.11, -0.026, 0.034],
      );
      oval(torso, blues, [s * 0.063, 0.246, 0.069], [0.05, 0.014, 0.029], [0.2, s * 0.4, s * 0.32]);
      panel(torso, '#a7afb0', [s * 0.087, 0.25, -0.076], [0.023, 0.012, 0.024], [0, s * 0.4, 0]);
      panel(torso, '#52657a', [s * 0.067, 0.106, 0.098], [0.064, 0.008, 0.009], [0, s * 0.36, 0]);
    }
    const badge = loft(
      [
        [-0.023, 0.002, 0.003],
        [-0.013, 0.014, 0.005],
        [0.009, 0.022, 0.006],
        [0.017, 0.02, 0.006],
        [0.024, 0.007, 0.004],
      ],
      16,
    );
    mesh(torso, badge, material(brass, metal, 0.46), [0.062, 0.191, 0.101], [1, 1, 1], [0, 0.35, 0]);
    oval(torso, '#e99048', [-0.067, 0.191, 0.098], [0.006, 0.026, 0.006], [0, 0, -0.13]);
    panel(torso, '#7da567', [-0.071, 0.215, 0.097], [0.008, 0.01, 0.008]);
    panel(torso, brass, [0, 0.005, 0.104], [0.038, 0.024, 0.007]);
    backPatch(torso);
  }
  return torso;
}

function makeArms(torso, fox) {
  const list = [];
  const sleeve = fox ? summerShirt() : material(blues);
  for (const side of [-1, 1]) {
    const upper = pivot(
      torso,
      'upperArm',
      [side * (fox ? 0.135 : 0.134), fox ? 0.268 : 0.238, 0],
      [0.04, 0, side * 0.075],
    );
    const len = fox ? 0.151 : 0.126;
    mesh(
      upper,
      loft(
        [
          [-len - 0.014, 0.027, 0.029],
          [-len + 0.017, 0.034, 0.034],
          [-0.065, 0.039, 0.041],
          [-0.029, 0.043, 0.044],
          [0.006, 0.038, 0.04],
          [0.025, 0.022, 0.024],
          [0.031, 0.003, 0.004],
        ],
        20,
      ),
      fox ? material('#cf7949') : sleeve,
    );
    if (fox)
      mesh(
        upper,
        loft(
          [
            [-0.091, 0.045, 0.046],
            [-0.084, 0.048, 0.047],
            [-0.05, 0.049, 0.049],
            [-0.008, 0.05, 0.049],
            [0.017, 0.039, 0.04],
            [0.026, 0.016, 0.019],
          ],
          20,
        ),
        sleeve,
      );
    else {
      oval(upper, navy, [side * 0.01, 0.004, 0], [0.043, 0.032, 0.052]);
      panel(upper, brass, [side * 0.041, -0.029, 0], [0.006, 0.009, 0.043], [0, 0, side * 0.14]);
    }
    const lower = pivot(upper, 'lowerArm', [0, -len, 0], [-0.13, 0, 0]);
    const fore = fox ? 0.13 : 0.107;
    mesh(
      lower,
      loft(
        [
          [-fore - 0.004, 0.022, 0.023],
          [-fore + 0.013, 0.027, 0.026],
          [-fore * 0.56, 0.033, 0.034],
          [-0.012, 0.033, 0.032],
          [0.016, 0.025, 0.026],
          [0.022, 0.007, 0.01],
        ],
        18,
      ),
      fox ? material('#bf6b42') : sleeve,
    );
    if (!fox)
      mesh(
        lower,
        loft(
          [
            [-fore - 0.003, 0.028, 0.027],
            [-fore + 0.004, 0.031, 0.03],
            [-fore + 0.031, 0.032, 0.031],
          ],
          16,
        ),
        material(navy),
      );
    const hand = pivot(lower, 'hand', [0, -fore, 0.003]);
    oval(hand, fox ? '#764839' : '#98929e', [0, -0.022, 0.003], [0.031, 0.045, 0.025]);
    oval(
      hand,
      fox ? '#83513d' : '#aaa3ad',
      [-side * 0.018, -0.018, 0.018],
      [0.014, 0.023, 0.013],
      [-0.36, 0, side * 0.35],
    );
    list.push({ upper, lower, hand, side });
  }
  return list;
}

function makeLegs(hips, fox) {
  const list = [],
    upperLen = fox ? 0.218 : 0.163,
    lowerLen = fox ? 0.211 : 0.161;
  const cloth = material(fox ? '#9c9277' : trouser);
  for (const side of [-1, 1]) {
    const thigh = pivot(hips, 'thigh', [side * (fox ? 0.066 : 0.067), -0.014, 0]);
    mesh(
      thigh,
      loft(
        [
          [-upperLen - 0.021, 0.032, 0.037, 0.007],
          [-upperLen + 0.008, 0.045, 0.045, 0.008],
          [-upperLen * 0.62, 0.054, 0.056, 0.002],
          [-0.046, 0.064, 0.065, -0.004],
          [0.012, 0.06, 0.055],
          [0.032, 0.037, 0.038],
        ],
        20,
      ),
      cloth,
    );
    const shin = pivot(thigh, 'shin', [0, -upperLen, 0]);
    mesh(
      shin,
      loft(
        [
          [-lowerLen + 0.006, 0.036, 0.041],
          [-lowerLen + 0.024, 0.041, 0.043],
          [-lowerLen * 0.58, 0.044, 0.049, -0.007],
          [-0.027, 0.046, 0.049],
          [0.011, 0.044, 0.044, 0.006],
          [0.026, 0.029, 0.029, 0.007],
        ],
        18,
      ),
      cloth,
    );
    const cuff = fox ? '#b8ac8b' : navy;
    mesh(
      shin,
      loft(
        [
          [-lowerLen + 0.003, 0.038, 0.04],
          [-lowerLen + 0.007, 0.043, 0.046],
          [-lowerLen + 0.032, 0.044, 0.045],
        ],
        16,
      ),
      material(cuff),
    );
    const foot = pivot(shin, 'foot', [0, -lowerLen, 0]);
    const c = fox ? '#684436' : '#9995a1';
    oval(
      foot,
      c,
      [0, -0.013, fox ? 0.04 : 0.056],
      [fox ? 0.044 : 0.052, 0.036, fox ? 0.08 : 0.101],
      [-0.07, 0, 0],
    );
    for (const toe of [-1, 0, 1])
      oval(foot, fox ? '#775041' : '#b0a9b3', [toe * 0.019, -0.02, fox ? 0.098 : 0.132], [0.019, 0.018, 0.027]);
    list.push({ thigh, shin, foot, side });
  }
  return list;
}

function makeTail(hips, fox) {
  const mount = pivot(hips, 'tail mount', [0, 0.019, -0.084], [fox ? -1.96 : -1.24, 0, 0]);
  if (!fox) {
    mesh(
      mount,
      loft(
        [
          [0, 0.027, 0.035],
          [0.02, 0.053, 0.048],
          [0.047, 0.062, 0.057],
          [0.071, 0.056, 0.049],
          [0.091, 0.039, 0.036],
          [0.106, 0.015, 0.018],
          [0.11, 0.002, 0.003],
        ],
        22,
        (c, v) => c.copy(ink('#aaa3b0')).lerp(ink('#f3eae3'), smooth(v, 0, 0.75)),
      ),
      painted,
    );
    return [mount];
  }
  const geometry = loft(
    [
      [0, 0.035, 0.039],
      [0.04, 0.046, 0.047],
      [0.088, 0.062, 0.061, 0.002, 0.004],
      [0.145, 0.083, 0.08, 0.006, 0.014],
      [0.208, 0.099, 0.092, 0.014, 0.033],
      [0.27, 0.104, 0.095, 0.018, 0.057],
      [0.333, 0.1, 0.089, 0.02, 0.081],
      [0.387, 0.084, 0.076, 0.015, 0.099],
      [0.432, 0.063, 0.058, 0.005, 0.112],
      [0.47, 0.041, 0.04, -0.01, 0.12],
      [0.5, 0.022, 0.024, -0.023, 0.124],
      [0.523, 0.003, 0.003, -0.037, 0.129],
    ],
    30,
    (c, v, x, z) => {
      c.copy(ink('#a65037')).lerp(ink('#e99550'), 0.26 + v * 0.43 + z * 0.22);
      c.lerp(
        ink('#f6deb3'),
        smooth(v, 0.67 + 0.047 * Math.cos(x * 9) + z * 0.04, 0.74 + 0.047 * Math.cos(x * 9) + z * 0.04),
      );
    },
  );
  return bend(mount, geometry, painted, [
    [0.142, 0.06],
    [0.321, 0.07],
  ]);
}

function officer(fox) {
  const root = new THREE.Group();
  root.name = fox ? 'Nick' : 'Judy';
  const body = pivot(root, 'body', [0, 0, 0]);
  const scale = fox ? 1.04 : 1;
  body.scale.setScalar(scale);
  const hipY = fox ? 0.494 : 0.39,
    sitY = fox ? 0.275 : 0.2;
  const hips = pivot(body, 'hips', [0, hipY, 0]);
  oval(hips, fox ? '#9c9277' : trouser, [0, -0.013, -0.006], [0.127, 0.089, 0.1]);
  const torso = makeTorso(hips, fox);
  const neck = pivot(torso, 'neck', [0, fox ? 0.31 : 0.271, 0]);
  oval(neck, fox ? '#e4ab77' : '#aaa4af', [0, 0.03, 0], [0.061, 0.067, 0.05]);
  const head = pivot(neck, 'head', [0, 0.035, 0]);
  headSculpt(head, fox);
  const eyeBones = eyes(head, fox),
    earBones = ears(head, fox);
  const arms = makeArms(torso, fox),
    legs = makeLegs(hips, fox),
    tail = makeTail(hips, fox);
  let shades;
  if (fox) {
    shades = pivot(head, 'sunglasses', [0, 0.162, 0.117]);
    for (const s of [-1, 1]) {
      mesh(
        shades,
        sphere,
        material('#314b50', 0.25, 0.28),
        [s * 0.064, 0, 0],
        [0.051, 0.03, 0.012],
        [0, s * 0.35, 0],
      );
      stroke(
        shades,
        '#725743',
        [
          [s * 0.105, 0.008, -0.013],
          [s * 0.138, 0.011, -0.047],
          [s * 0.141, 0, -0.112],
        ],
        0.0045,
      );
    }
    stroke(
      shades,
      '#725743',
      [
        [-0.023, 0.005, 0.006],
        [0, 0.012, 0.016],
        [0.023, 0.005, 0.006],
      ],
      0.005,
    );
    shades.visible = false;
  }
  batchRigidParts(root);
  const rig = { root, hips, torso, head, arms, legs, ears: earBones, tail, eyes: eyeBones };
  const anim = makeRigAnimator(rig, {
    hipY,
    legLen: hipY,
    scale,
    sitY,
    earFlop: fox ? 0.63 : 1.12,
    tailSway: fox ? 0.92 : 0.6,
    armOut: 0.05,
  });
  root.userData = {
    name: fox ? 'Nick Wilde' : 'Judy Hopps',
    height: fox ? 1.17 : 1.0,
    totalHeight: fox ? 1.25 : 1.35,
    sitHipY: sitY * scale,
    bones: { hips, torso, neck, head, arms, legs, ears: earBones, tail },
    update: anim.update,
    setPose: anim.setPose,
    getPose: anim.getPose,
  };
  if (fox)
    root.userData.setSunglasses = (on) => {
      shades.visible = !!on;
    };
  anim.update(0.016, 0);
  return root;
}

export function createJudy() {
  return officer(false);
}
export function createNick() {
  return officer(true);
}
