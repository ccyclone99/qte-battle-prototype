const Difficulty = {
  presets: {
    easy: {
      name: "简单",
      qteDurationMul: 1.32,
      qteWindowMul: 1.0,
      enemyWindupMul: 1.62,
      enemyResponseMul: 1.65,
      pointerSpeedMul: 0.65,
      enemyDamageMul: 0.5,
      assist: {
        chainOffsetMul: 1.22,
        learningDetail: "full",
        directorAggression: 0.62
      }
    },
    normal: {
      name: "普通",
      qteDurationMul: 1.08,
      qteWindowMul: 1.0,
      enemyWindupMul: 1.34,
      enemyResponseMul: 1.25,
      pointerSpeedMul: 0.9,
      enemyDamageMul: 0.75,
      assist: {
        chainOffsetMul: 1.08,
        learningDetail: "full",
        directorAggression: 0.82
      }
    },
    hard: {
      name: "困难",
      qteDurationMul: 0.98,
      qteWindowMul: 0.95,
      enemyWindupMul: 1.10,
      enemyResponseMul: 1.0,
      pointerSpeedMul: 1.05,
      enemyDamageMul: 0.95,
      assist: {
        chainOffsetMul: 1.0,
        learningDetail: "compact",
        directorAggression: 1.0
      }
    },
    extreme: {
      name: "极难",
      qteDurationMul: 0.88,
      qteWindowMul: 0.88,
      enemyWindupMul: 0.96,
      enemyResponseMul: 0.85,
      pointerSpeedMul: 1.2,
      enemyDamageMul: 1.15,
      assist: {
        chainOffsetMul: 0.96,
        learningDetail: "minimal",
        directorAggression: 1.18
      }
    }
  },

  current: "easy",

  set(id) {
    if (this.presets[id]) this.current = id;
  },

  get() {
    return this.presets[this.current];
  },

  getAssistProfile() {
    const cfg = this.get() || {};
    const assist = cfg.assist || {};
    return {
      difficulty: this.current || "normal",
      chainOffsetMul: assist.chainOffsetMul || 1,
      learningDetail: assist.learningDetail || "full",
      directorAggression: assist.directorAggression || 1,
      qteWindowMul: cfg.qteWindowMul || 1,
      qteDurationMul: cfg.qteDurationMul || 1,
      pointerSpeedMul: cfg.pointerSpeedMul || 1
    };
  },

  // 深拷贝并按难度缩放一条 QTE 链（支持链对象或 ChainDatabase ID）
  scaleChain(chain) {
    const cfg = this.get();
    const source = typeof chain === "string" ? ChainDatabase[chain] : chain;
    if (!source) return { name: "未知链", nodes: [] };
    const clone = JSON.parse(JSON.stringify(source));
    for (const node of clone.nodes) {
      const durationMul = cfg.qteDurationMul;
      const windowMul = cfg.qteWindowMul;
      const baseDuration = node.duration;
      node.duration = this.roundTime(baseDuration * durationMul);

      if (node.window) {
        const baseStart = node.window.start * durationMul;
        const baseEnd = node.window.end * durationMul;
        const perfect = node.perfect !== null && node.perfect !== undefined
          ? node.perfect * durationMul
          : null;
        const center = perfect !== null && perfect !== undefined
          ? perfect
          : (baseStart + baseEnd) / 2;
        const baseWidth = Math.max(0.05, baseEnd - baseStart);
        const maxEnd = node.duration + 0.18;
        const scaledWidth = Math.min(maxEnd, Math.max(0.05, baseWidth * windowMul));
        let start = center - scaledWidth / 2;
        let end = center + scaledWidth / 2;

        if (start < 0) {
          end -= start;
          start = 0;
        }
        if (end > maxEnd) {
          const overflow = end - maxEnd;
          start = Math.max(0, start - overflow);
          end = maxEnd;
        }

        node.window.start = this.roundTime(start);
        node.window.end = this.roundTime(end);
      }
      if (node.perfect !== null && node.perfect !== undefined) {
        node.perfect = this.roundTime(node.perfect * cfg.qteDurationMul);
      }
      if (node.input && node.input.type === "rhythm" && node.input.beats) {
        node.input.beats = node.input.beats.map(t => this.roundTime(t * cfg.qteDurationMul));
        if (node.rhythmTolerance) node.rhythmTolerance *= cfg.qteWindowMul;
      }
    }
    return clone;
  },

  roundTime(value) {
    return Math.round(value * 1000) / 1000;
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
