const Difficulty = {
  presets: {
    easy: {
      name: "简单",
      qteDurationMul: 1.25,
      qteWindowMul: 1.2,
      enemyWindupMul: 1.3,
      enemyResponseMul: 1.4,
      pointerSpeedMul: 0.75
    },
    normal: {
      name: "普通",
      qteDurationMul: 1.0,
      qteWindowMul: 1.0,
      enemyWindupMul: 1.0,
      enemyResponseMul: 1.0,
      pointerSpeedMul: 1.0
    },
    hard: {
      name: "困难",
      qteDurationMul: 0.75,
      qteWindowMul: 0.85,
      enemyWindupMul: 0.85,
      enemyResponseMul: 0.85,
      pointerSpeedMul: 1.25
    },
    extreme: {
      name: "极难",
      qteDurationMul: 0.6,
      qteWindowMul: 0.7,
      enemyWindupMul: 0.7,
      enemyResponseMul: 0.7,
      pointerSpeedMul: 1.5
    }
  },

  current: "normal",

  set(id) {
    if (this.presets[id]) this.current = id;
  },

  get() {
    return this.presets[this.current];
  },

  // 深拷贝并按难度缩放一条 QTE 链
  scaleChain(chain) {
    const cfg = this.get();
    const clone = JSON.parse(JSON.stringify(chain));
    for (const node of clone.nodes) {
      node.duration *= cfg.qteDurationMul;
      if (node.window) {
        node.window.start *= cfg.qteWindowMul;
        node.window.end = Math.min(node.duration + 0.3, node.window.end * cfg.qteWindowMul);
      }
      if (node.perfect !== null && node.perfect !== undefined) {
        node.perfect *= cfg.qteWindowMul;
      }
      if (node.input && node.input.type === "rhythm" && node.input.beats) {
        node.input.beats = node.input.beats.map(t => t * cfg.qteDurationMul);
        if (node.rhythmTolerance) node.rhythmTolerance *= cfg.qteWindowMul;
      }
    }
    return clone;
  },

  // 缩放敌人攻击数据（深拷贝）
  scaleAttack(attack) {
    const cfg = this.get();
    const clone = JSON.parse(JSON.stringify(attack));
    clone.windup *= cfg.enemyWindupMul;
    clone.hitTime *= cfg.enemyWindupMul;
    return clone;
  },

  // 计算敌人回合的反应窗口时长
  responseDuration(base = 1.6) {
    return base * this.get().enemyResponseMul;
  }
};
