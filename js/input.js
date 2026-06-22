class InputBuffer {
  constructor() {
    this.events = [];
    this.heldKeys = new Set();
    this.lastPressed = {};

    window.addEventListener("keydown", (e) => {
      let key = e.key.toUpperCase();
      if (key === " " || key === "SPACEBAR") key = "SPACE";

      const gameKeys = ["A", "S", "D", "SPACE", "F", "ESCAPE", "H", "L", "I", "W", "M", "1", "2", "3", "4", "5", "6", "ARROWLEFT", "ARROWRIGHT", "ARROWUP", "ARROWDOWN"];
      if (gameKeys.includes(key)) {
        e.preventDefault();
      }
      if (this.heldKeys.has(key)) return;
      this.heldKeys.add(key);
      this.lastPressed[key] = Utils.now();
      this.events.push({ type: "press", key, time: Utils.now() });
    });

    window.addEventListener("keyup", (e) => {
      let key = e.key.toUpperCase();
      if (key === " " || key === "SPACEBAR") key = "SPACE";
      this.heldKeys.delete(key);
      this.events.push({ type: "release", key, time: Utils.now() });
    });
  }

  isHeld(key) {
    return this.heldKeys.has(key.toUpperCase());
  }

  consume() {
    return this.events.shift();
  }

  peek() {
    return this.events[0] || null;
  }

  clear() {
    this.events = [];
  }

  injectKey(key, type = "press") {
    const k = key.toUpperCase();
    if (type === "press") {
      if (!this.heldKeys.has(k)) {
        this.heldKeys.add(k);
        this.lastPressed[k] = Utils.now();
        this.events.push({ type: "press", key: k, time: Utils.now() });
      }
    } else if (type === "release") {
      if (this.heldKeys.has(k)) {
        this.heldKeys.delete(k);
        this.events.push({ type: "release", key: k, time: Utils.now() });
      }
    }
  }

  update() {
    // 输入事件自然消耗，外部消费即可
  }
}
