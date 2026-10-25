// 键鼠输入
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();   // 本帧刚按下
    this.mouseDX = 0; this.mouseDY = 0; this.wheel = 0;
    this.locked = false;
    this.enabled = true;
    addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('click', () => { if (this.enabled && !this.locked) canvas.requestPointerLock?.(); });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    addEventListener('mousemove', e => { if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; } });
    addEventListener('wheel', e => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    // 未锁定时也允许右键拖动旋转视角
    let drag = false;
    canvas.addEventListener('mousedown', e => { if (e.button === 2) drag = true; });
    addEventListener('mouseup', () => drag = false);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousemove', e => { if (drag && !this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; } });
  }
  down(c) { return this.enabled && this.keys.has(c); }
  hit(c) { return this.enabled && this.pressed.has(c); }
  endFrame() { this.pressed.clear(); this.mouseDX = this.mouseDY = 0; this.wheel = 0; }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
}
