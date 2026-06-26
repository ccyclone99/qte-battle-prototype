class InputBuffer {
  constructor() {
    this.events = [];
    this.heldKeys = new Set();
    this.lastPressed = {};
    this.ignoredUntilRelease = new Set();

    window.addEventListener("keydown", (e) => {
      let key = e.key.toUpperCase();
      if (key === " " || key === "SPACEBAR") key = "SPACE";

      const gameKeys = ["A", "S", "D", "SPACE", "F", "ESCAPE", "H", "L", "I", "W", "M", "1", "2", "3", "4", "5", "6", "7", "ARROWLEFT", "ARROWRIGHT", "ARROWUP", "ARROWDOWN"];
      if (gameKeys.includes(key)) {
        e.preventDefault();
      }
      if (this.heldKeys.has(key)) return;
      if (this.ignoredUntilRelease.has(key)) {
        this.heldKeys.add(key);
        return;
      }
      this.heldKeys.add(key);
      this.lastPressed[key] = Utils.now();
      this.events.push({ type: "press", key, time: Utils.now() });
    });

    window.addEventListener("keyup", (e) => {
      let key = e.key.toUpperCase();
      if (key === " " || key === "SPACEBAR") key = "SPACE";
      this.heldKeys.delete(key);
      if (this.ignoredUntilRelease.delete(key)) return;
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

  reset() {
    this.events = [];
    this.heldKeys.clear();
    this.ignoredUntilRelease.clear();
  }

  ignoreHeldUntilRelease(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    const ignored = new Set();
    for (const key of list) {
      if (!key) continue;
      const k = String(key).toUpperCase();
      if (this.heldKeys.has(k)) {
        this.ignoredUntilRelease.add(k);
        ignored.add(k);
      }
    }
    if (ignored.size > 0) {
      this.events = this.events.filter(event => !ignored.has(String(event.key).toUpperCase()));
    }
  }

  injectKey(key, type = "press", options = {}) {
    const k = key.toUpperCase();
    if (type === "press") {
      if (options.fresh) {
        this.heldKeys.delete(k);
        this.ignoredUntilRelease.delete(k);
      }
      if (this.ignoredUntilRelease.has(k)) return;
      if (!this.heldKeys.has(k)) {
        this.heldKeys.add(k);
        this.lastPressed[k] = Utils.now();
        this.events.push({ type: "press", key: k, time: Utils.now() });
      }
    } else if (type === "release") {
      if (this.heldKeys.has(k)) {
        this.heldKeys.delete(k);
        if (this.ignoredUntilRelease.delete(k)) return;
        this.events.push({ type: "release", key: k, time: Utils.now() });
      } else {
        this.ignoredUntilRelease.delete(k);
      }
    }
  }

  update() {
    // 输入事件自然消耗，外部消费即可
  }
}
