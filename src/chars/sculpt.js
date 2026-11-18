import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Horizontal sections, from feet to crown: [height, half width, half depth, z offset, x offset].
export function loft(sections, sides = 24, paint) {
  const positions = [],
    colors = [],
    uv = [],
    indices = [];
  const first = sections[0][0],
    height = sections.at(-1)[0] - first;
  const color = new THREE.Color();
  for (let row = 0; row < sections.length; row++) {
    const [y, width, depth, cz = 0, cx = 0] = sections[row];
    const v = (y - first) / height;
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI;
      const x = Math.sin(a),
        z = Math.cos(a);
      positions.push(cx + width * x, y, cz + depth * z);
      uv.push(i / sides, v);
      if (paint) {
        paint(color, v, x, z);
        colors.push(color.r, color.g, color.b);
      }
      if (row && i < sides) {
        const lower = (row - 1) * (sides + 1) + i,
          upper = lower + sides + 1;
        indices.push(lower, lower + 1, upper, lower + 1, upper + 1, upper);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(indices);
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (paint) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  // Close the normal seam at the back while keeping two independent texture coordinates.
  const n = g.attributes.normal,
    left = new THREE.Vector3(),
    right = new THREE.Vector3();
  for (let row = 0; row < sections.length; row++) {
    const a = row * (sides + 1),
      b = a + sides;
    left.fromBufferAttribute(n, a).add(right.fromBufferAttribute(n, b)).normalize();
    n.setXYZ(a, left.x, left.y, left.z);
    n.setXYZ(b, left.x, left.y, left.z);
  }
  return g;
}

// A continuous surface bends across joints. The animation system can drive these bones
// exactly like the rigid limb pivots, including while seated or jumping.
export function bend(mount, geometry, material, hinges) {
  const bones = [new THREE.Bone()];
  hinges.forEach(([y], i) => {
    const joint = new THREE.Bone();
    joint.position.y = y - (i ? hinges[i - 1][0] : 0);
    bones[i].add(joint);
    bones.push(joint);
  });
  const indices = [],
    weights = [],
    pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    let joint = 0;
    while (joint < hinges.length && y > hinges[joint][0] + hinges[joint][1]) joint++;
    const next = Math.min(joint + 1, bones.length - 1);
    const f =
      joint < hinges.length
        ? THREE.MathUtils.smoothstep(y, hinges[joint][0] - hinges[joint][1], hinges[joint][0] + hinges[joint][1])
        : 0;
    indices.push(joint, next, 0, 0);
    weights.push(1 - f, f, 0, 0);
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mount.add(mesh);
  mesh.add(bones[0]);
  mesh.updateWorldMatrix(true, true);
  mesh.bind(new THREE.Skeleton(bones));
  // A tail can swing outside its rest bounds. There are only two heroes in the world.
  mesh.frustumCulled = false;
  return bones;
}

const bakedMaterials = new Map();
export function batchRigidParts(root) {
  const pivots = [];
  root.traverse((o) => {
    if (o.children.some((child) => child.isMesh && !child.isSkinnedMesh)) pivots.push(o);
  });
  for (const pivot of pivots) {
    const batches = new Map();
    for (const part of [...pivot.children]) {
      if (!part.isMesh || part.isSkinnedMesh || part.children.length) continue;
      const m = part.material;
      if (!m.isMeshStandardMaterial || m.map || m.transparent) continue;
      const key = m.metalness + '/' + m.roughness;
      let material = bakedMaterials.get(key);
      if (!material) {
        material = new THREE.MeshStandardMaterial({
          vertexColors: true,
          metalness: m.metalness,
          roughness: m.roughness,
        });
        bakedMaterials.set(key, material);
      }
      if (!batches.has(material)) batches.set(material, []);
      const g = new THREE.BufferGeometry().copy(part.geometry);
      part.updateMatrix();
      g.applyMatrix4(part.matrix);
      g.clearGroups();
      g.deleteAttribute('uv');
      const count = g.attributes.position.count;
      if (!g.index) g.setIndex(Array.from({ length: count }, (_, i) => i));
      const col = g.attributes.color;
      if (col) {
        for (let i = 0; i < count; i++)
          col.setXYZ(i, col.getX(i) * m.color.r, col.getY(i) * m.color.g, col.getZ(i) * m.color.b);
      } else {
        const rgb = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) m.color.toArray(rgb, i * 3);
        g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
      }
      batches.get(material).push(g);
      pivot.remove(part);
    }
    for (const [material, pieces] of batches) {
      const g = mergeGeometries(pieces);
      pieces.forEach((piece) => piece.dispose());
      const mesh = new THREE.Mesh(g, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);
    }
  }
}
