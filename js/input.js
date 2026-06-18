class InputBuffer {
  constructor() {
    this.events = [];
    this.heldKeys = new Set();
    this.lastPressed = {};

    window.addEventListener("keydown", (e) => {
      let key = e.key.toUpperCase();
      if (key === " " || key === "SPACEBAR") key = "SPACE";

      const gameKeys = ["A", "S", "D", "SPACE", "F"];
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

  update() {
    // 输入事件自然消耗，外部消费即可
  }
}
