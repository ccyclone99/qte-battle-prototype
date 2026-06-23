const Difficulty = {
  presets: {
    easy: {
      name: "简单",
      qteDurationMul: 4.0,
      qteWindowMul: 1.6,
      enemyWindupMul: 1.6,
      enemyResponseMul: 2.0,
      pointerSpeedMul: 0.45,
      enemyDamageMul: 0.5
    },
    normal: {
      name: "普通",
      qteDurationMul: 1.8,
      qteWindowMul: 1.3,
      enemyWindupMul: 1.35,
      enemyResponseMul: 1.5,
      pointerSpeedMul: 0.7,
      enemyDamageMul: 0.75
    },
    hard: {
      name: "困难",
      qteDurationMul: 1.4,
      qteWindowMul: 1.0,
      enemyWindupMul: 1.0,
      enemyResponseMul: 1.0,
      pointerSpeedMul: 1.0,
      enemyDamageMul: 0.95
    },
    extreme: {
      name: "极难",
      qteDurationMul: 1.0,
      qteWindowMul: 0.8,
      enemyWindupMul: 0.85,
      enemyResponseMul: 0.85,
      pointerSpeedMul: 1.25,
      enemyDamageMul: 1.15
    }
  },

  current: "easy",

  set(id) {
    if (this.presets[id]) this.current = id;
  },

  get() {
    return this.presets[this.current];
  },

  // 深拷贝并按难度缩放一条 QTE 链（支持链对象或 ChainDatabase ID）
  scaleChain(chain) {
    const cfg = this.get();
    const source = typeof chain === "string" ? ChainDatabase[chain] : chain;
    if (!source) return { name: "未知链", nodes: [] };
    const clone = JSON.parse(JSON.stringify(source));
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
    if (cfg.enemyDamageMul !== undefined && clone.damage !== undefined) {
      clone.damage = Math.max(1, Math.floor(clone.damage * cfg.enemyDamageMul));
    }
    return clone;
  },

  // 计算敌人回合的反应窗口时长
  responseDuration(base = 2.0) {
    return base * this.get().enemyResponseMul;
  }
};
