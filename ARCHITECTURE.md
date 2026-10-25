# 疯狂动物城 · 侦探开放世界 —— 架构约定

技术栈：Vite + three@0.170（ES modules，`import * as THREE from 'three'`）。无外部模型文件，所有建模都是程序化几何体。

## 坐标 & 尺度
- x 向东，z 向南（-z 为北），y 向上；单位米。
- 朱迪身高约 1.0m（含耳朵约 1.35m），尼克约 1.25m，大象约 3.8m，长颈鹿约 5.5m，鼩鼱/老鼠约 0.12–0.2m。
- 世界地图与所有地区/地标坐标在 `src/world/layout.js`，**不要修改它**，只读取。

## 渲染预算（非常重要）
- 地图很大（约 2km × 2km）。所有静态几何体必须用 `Builder`（`src/core/builder.js`）合并，禁止为静态物体 `scene.add(new Mesh)` 成百上千次。
- 需要动画的东西（风车、喷泉水、旋转招牌、缆车）可以单独 Mesh/Group，但每个地区不超过 ~40 个独立动画对象，并通过 `ctx.animate(fn)` 注册更新函数 `fn(dt, t)`。
- 不要创建 THREE.PointLight/SpotLight（性能杀手）。灯光效果用 `mat:'glow'` 的自发光几何体表现；夜晚窗户由 `facade` 材质自动亮灯。
- 每个地区三角形总量目标 ≤ 60 万，球体/圆柱 seg 用 8–16。

## 地区建造模块签名
```js
// src/world/districts/<name>.js
export function build(ctx) { ... }
```
`ctx` 字段：
- `ctx.THREE`
- `ctx.scene`：THREE.Scene
- `ctx.b`：Builder 实例（共享，结束时由主程序 flush）。API 见 builder.js 头部注释。**`box/cyl/cone` 的 y 是底面，sphere 的 y 是球心**。
- `ctx.col`：Colliders 实例（见 collision.js）。每栋建筑/墙/大型道具都要加碰撞体；可以站上去的台阶、平台用 `walkable:true`；楼梯/斜坡用 `col.ramp`。
- `ctx.layout`：layout.js 模块全部导出。
- `ctx.rng(seed)`：可复现随机数。
- `ctx.animate(fn)`：注册每帧回调 `fn(dt, t)`。
- `ctx.addLabel(x, y, z, text, color)`：在地图上标注地点名（用于小地图 / 进入区域提示）。为每个地标调用一次。
- `ctx.tex`：程序化 canvas 纹理工具：`ctx.tex.sign(text, { bg, fg, w, h, font })` 返回 THREE.CanvasTexture，用于招牌（招牌可以是独立 Mesh + MeshBasicMaterial，数量控制在每区 ≤ 30 个）。

地面：主程序已经铺好全局大地面（草/土色）与运河水面。**每个地区负责自己 rect 内的地面、道路、人行道、路灯、街道家具、建筑、植被**（道路坐标从 `DISTRICTS[key].roadsX/roadsZ` 读取，路宽 `ROAD_W`，人行道 `SIDEWALK_W`，人行道高出地面 0.15m）。道路表面高度 y=0.02，带车道线（白/黄虚线，用薄盒子 y=0.03）。路口留空不画线。

## 道路必须保持畅通
道路区域（以及连接线 CONNECTORS、桥）上不能有碰撞体，玩家和车辆在上面行驶。地标的 `front` 点及 `spots` 点周围 3m 必须无碰撞体（案件 NPC 会站在那里）。

## 角色 / 动物模型
`src/chars/animals.js` 导出 `createAnimal(species, opts)` → `THREE.Group`，`group.userData.update(dt, speed)` 驱动走路动画，`group.userData.height` 身高。
`src/chars/heroes.js` 导出 `createJudy()`、`createNick()`，同样接口，外加 `userData.setPose('idle'|'walk'|'run'|'jump'|'talk')`。

## 交互注册（案件系统用）
`ctx.interact.add({ id, x, y, z, radius, label, onInteract(player) })` → 玩家靠近显示「E · label」。

## 招牌
`ctx.tex.sign(...)` 与 `ctx.tex.signMesh(text, widthMeters, opts)`（返回 Mesh，需自己设置 position/rotation 并 `ctx.scene.add`）。来自 `src/core/tex.js`。

## 自测
每个地区模块应能独立通过 `npx vite build` 编译。不要改动其他人的文件。写完后在文件头部用注释列出：主要地标位置、给案件系统用的有趣地点坐标（`export const POI = { name: {x,y,z,label} }`）。
