// 键鼠 + 触屏输入
// 触屏：左半屏虚拟摇杆（模拟量，推到底自动奔跑），右半屏滑动转视角，双指捏合缩放，
// 屏幕按钮通过 virtual 键码（与键盘 code 相同）驱动 down()/hit()，游戏逻辑无需区分输入来源。
export const IS_TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches;

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();   // 本帧刚按下
    this.mouseDX = 0; this.mouseDY = 0; this.wheel = 0;
    this.locked = false;
    this.enabled = true;
    this.touch = IS_TOUCH;
    this.axis = { x: 0, y: 0 };   // 摇杆：x 右为正，y 下（后退）为正，长度 0..1
    addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.axis.x = this.axis.y = 0; });
    canvas.addEventListener('click', () => { if (!this.touch && this.enabled && !this.locked) canvas.requestPointerLock?.(); });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    addEventListener('mousemove', e => { if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; } });
    addEventListener('wheel', e => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    // 未锁定时也允许右键拖动旋转视角
    let drag = false;
    canvas.addEventListener('mousedown', e => { if (e.button === 2) drag = true; });
    addEventListener('mouseup', () => drag = false);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousemove', e => { if (drag && !this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; } });
    this._initTouch(canvas);
  }

  // 屏幕按钮按下 / 抬起（code 与键盘一致，如 'KeyE'）
  press(code) { if (!this.keys.has(code)) this.pressed.add(code); this.keys.add(code); }
  release(code) { this.keys.delete(code); }
  tap(code) { this.pressed.add(code); }

  _initTouch(canvas) {
    const stick = document.createElement('div');
    stick.id = 'stick';
    stick.innerHTML = '<i></i>';
    document.body.appendChild(stick);
    const knob = stick.firstChild;
    const R = 56;
    let stickId = null, sx = 0, sy = 0;
    const looks = new Map(); // 视角触点 id -> {x,y}
    let pinch = 0;

    const setStick = (dx, dy) => {
      const l = Math.hypot(dx, dy), k = l > R ? R / l : 1;
      dx *= k; dy *= k;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.axis.x = dx / R; this.axis.y = dy / R;
    };
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (stickId === null && t.clientX < innerWidth * 0.42) {
          stickId = t.identifier; sx = t.clientX; sy = t.clientY;
          stick.style.left = sx + 'px'; stick.style.top = sy + 'px';
          stick.classList.add('on'); setStick(0, 0);
        } else looks.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      if (looks.size === 2) { const [a, b] = [...looks.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) setStick(t.clientX - sx, t.clientY - sy);
        else if (looks.has(t.identifier)) {
          const p = looks.get(t.identifier);
          if (looks.size === 1) { this.mouseDX += (t.clientX - p.x) * 1.6; this.mouseDY += (t.clientY - p.y) * 1.6; }
          p.x = t.clientX; p.y = t.clientY;
        }
      }
      if (looks.size === 2) {
        const [a, b] = [...looks.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch && Math.abs(d - pinch) > 18) { this.wheel += d < pinch ? 1 : -1; pinch = d; }
      }
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) { stickId = null; stick.classList.remove('on'); setStick(0, 0); }
        looks.delete(t.identifier);
      }
      pinch = 0;
    };
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', end);
  }

  // 移动向量（键盘 WASD 与摇杆合并），返回 {x, y, mag}
  move() {
    if (!this.enabled) return { x: 0, y: 0, mag: 0 };
    let x = this.axis.x, y = this.axis.y;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    const mag = Math.min(1, Math.hypot(x, y));
    return { x, y, mag };
  }
  down(c) { return this.enabled && this.keys.has(c); }
  hit(c) { return this.enabled && this.pressed.has(c); }
  endFrame() { this.pressed.clear(); this.mouseDX = this.mouseDY = 0; this.wheel = 0; }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
}
