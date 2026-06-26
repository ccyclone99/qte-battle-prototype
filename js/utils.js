const Utils = {
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },

  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  now() {
    return performance.now() / 1000;
  },

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  findNodeIndex(chain, nodeId) {
    return chain.nodes.findIndex(n => n.id === nodeId);
  },

  inputMatches(config, event, heldKeys) {
    if (!config || !event) return false;

    if (config.type === "press") {
      return event.type === "press" && event.key.toUpperCase() === config.key.toUpperCase();
    }

    if (config.type === "hold_release") {
      return event.type === "release" && event.key.toUpperCase() === config.key.toUpperCase();
    }

    if (config.type === "rhythm") {
      return event.type === "press" && event.key.toUpperCase() === config.key.toUpperCase();
    }

    return false;
  },

  formatTime(seconds) {
    return seconds.toFixed(2) + "s";
  },

  // 根据当前配置计算实际生效的链 ID 映射（含咒术覆盖与战技追加链）
  getEffectiveChains(config) {
    const chains = {};
    if (!config || !config.weapon) return chains;

    const weapon = WeaponDatabase[config.weapon];
    if (!weapon) return chains;

    // 复制武器基础链
    if (weapon.chains) {
      for (const [key, chainId] of Object.entries(weapon.chains)) {
        chains[key] = chainId;
      }
    }

    // 咒术 chainMap 覆盖
    for (const spellId of config.spells || []) {
      const spell = SpellDatabase[spellId];
      if (spell && spell.chainMap && spell.chainMap[config.weapon]) {
        for (const [key, chainId] of Object.entries(spell.chainMap[config.weapon])) {
          chains[key] = chainId;
        }
      }
    }

    // 战技追加链
    for (const artId of config.combatArts || []) {
      const art = CombatArtDatabase[artId];
      if (art && art.followUpChains && art.followUpChains[config.weapon]) {
        chains.followUp = art.followUpChains[config.weapon];
      }
    }

    return chains;
  },

  getChainHandfeel(chain, options = {}) {
    const profile = {
      windowPad: 0.08,
      holdWindowPad: 0.10,
      perfectTolerance: 0.07,
      rhythmPad: 0.07,
      timeoutGrace: 0.22
    };
    if (!chain) return profile;

    const tags = new Set(chain.tags || []);
    const id = options.chainId || "";
    const family = chain.family || "";
    const role = chain.role || "";
    const apply = values => Object.assign(profile, values);

    if (family === "dualBlades") {
      apply({ windowPad: 0.065, perfectTolerance: 0.055, timeoutGrace: 0.18 });
    }
    if (family === "greatsword") {
      apply({ windowPad: 0.09, holdWindowPad: 0.15, perfectTolerance: 0.08, timeoutGrace: 0.28 });
    }
    if (family === "staff") {
      apply({ windowPad: 0.10, rhythmPad: 0.10, perfectTolerance: 0.085, timeoutGrace: 0.26 });
    }
    if (family === "fire") {
      apply({ windowPad: 0.09, holdWindowPad: 0.15, perfectTolerance: 0.08, timeoutGrace: 0.26 });
    }
    if (family === "absorb") {
      apply({ windowPad: 0.09, holdWindowPad: 0.14, rhythmPad: 0.10, perfectTolerance: 0.08, timeoutGrace: 0.28 });
    }
    if (tags.has("charge")) {
      profile.holdWindowPad = Math.max(profile.holdWindowPad, 0.15);
      profile.timeoutGrace = Math.max(profile.timeoutGrace, 0.26);
    }
    if (tags.has("defense") || role === "defense" || options.source === "enemy") {
      apply({ windowPad: 0.10, holdWindowPad: 0.12, perfectTolerance: 0.09, rhythmPad: 0.08, timeoutGrace: 0.22 });
    }

    const focusedProfiles = {
      staff_s: { rhythmPad: 0.12, timeoutGrace: 0.30 },
      staff_d: { rhythmPad: 0.11, timeoutGrace: 0.28 },
      fireball_evolution: { holdWindowPad: 0.18, perfectTolerance: 0.09, timeoutGrace: 0.30 },
      fireball_evolution_v2: { holdWindowPad: 0.17, perfectTolerance: 0.09, timeoutGrace: 0.30 },
      absorb_siphon: { rhythmPad: 0.12, perfectTolerance: 0.085, timeoutGrace: 0.30 },
      flame_blade: { windowPad: 0.085, perfectTolerance: 0.075, timeoutGrace: 0.22 },
      overflow_burst: { holdWindowPad: 0.18, windowPad: 0.10, perfectTolerance: 0.09, timeoutGrace: 0.30 },
      greatsword_s_v2: { holdWindowPad: 0.16, perfectTolerance: 0.085, timeoutGrace: 0.30 },
      dualblades_a_v2: { windowPad: 0.07, perfectTolerance: 0.06, timeoutGrace: 0.18 }
    };

    if (focusedProfiles[id]) apply(focusedProfiles[id]);
    if (options.handfeel) apply(options.handfeel);
    return profile;
  },

  getBattleQTEPacing(chain, options = {}) {
    const pacing = {
      timeScale: 0.90,
      postNodePause: 0.10
    };
    if (!chain) return pacing;

    const id = options.chainId || "";
    const family = chain.family || "";
    const role = chain.role || "";
    const tags = new Set(chain.tags || []);
    const difficultyId = options.difficultyId || (typeof Difficulty !== "undefined" ? Difficulty.current : "normal");
    const apply = values => Object.assign(pacing, values);

    const difficultyPacing = {
      easy: { timeScale: 0.86, postNodePause: 0.14 },
      normal: { timeScale: 0.92, postNodePause: 0.10 },
      hard: { timeScale: 0.98, postNodePause: 0.07 },
      extreme: { timeScale: 1.04, postNodePause: 0.04 }
    };
    if (difficultyPacing[difficultyId]) apply(difficultyPacing[difficultyId]);

    if (family === "dualBlades") {
      apply({ timeScale: pacing.timeScale * 0.92, postNodePause: Math.max(pacing.postNodePause, 0.10) });
    }
    if (family === "greatsword") {
      apply({ timeScale: pacing.timeScale * 0.95, postNodePause: Math.max(pacing.postNodePause, 0.13) });
    }
    if (family === "staff") {
      apply({ timeScale: pacing.timeScale * 0.90, postNodePause: Math.max(pacing.postNodePause, 0.14) });
    }
    if (family === "fire") {
      apply({ timeScale: pacing.timeScale * 0.94, postNodePause: Math.max(pacing.postNodePause, 0.12) });
    }
    if (family === "absorb") {
      apply({ timeScale: pacing.timeScale * 0.92, postNodePause: Math.max(pacing.postNodePause, 0.14) });
    }
    if (tags.has("rhythm")) {
      apply({ timeScale: pacing.timeScale * 0.94, postNodePause: Math.max(pacing.postNodePause, 0.14) });
    }
    if (tags.has("charge")) {
      apply({ timeScale: Math.max(0.84, pacing.timeScale), postNodePause: Math.max(pacing.postNodePause, 0.12) });
    }
    if (tags.has("defense") || role === "defense" || options.source === "enemy") {
      apply({ timeScale: pacing.timeScale * 0.88, postNodePause: Math.max(pacing.postNodePause, 0.08) });
    }

    const focusedPacing = {
      staff_s: { timeScale: Math.min(pacing.timeScale, 0.74), postNodePause: 0.18 },
      staff_d: { timeScale: Math.min(pacing.timeScale, 0.80), postNodePause: 0.16 },
      absorb_siphon: { timeScale: Math.min(pacing.timeScale, 0.78), postNodePause: 0.18 },
      dualblades_a_v2: { timeScale: Math.min(pacing.timeScale, 0.78), postNodePause: 0.12 },
      dualblades_s_v2: { timeScale: Math.min(pacing.timeScale, 0.80), postNodePause: 0.12 },
      dualblades_d_v2: { timeScale: Math.min(pacing.timeScale, 0.80), postNodePause: 0.14 },
      fireball_evolution_v2: { timeScale: Math.max(0.84, pacing.timeScale), postNodePause: 0.12 },
      overflow_burst: { timeScale: Math.min(pacing.timeScale, 0.82), postNodePause: 0.16 },
      mirror_guard: { timeScale: Math.min(pacing.timeScale, 0.78), postNodePause: 0.08 },
      shield_flare: { timeScale: Math.min(pacing.timeScale, 0.80), postNodePause: 0.08 }
    };

    if (focusedPacing[id]) apply(focusedPacing[id]);
    if (options.pacing) apply(options.pacing);
    pacing.timeScale = this.clamp(pacing.timeScale, 0.68, 1.08);
    pacing.postNodePause = this.clamp(pacing.postNodePause, 0, 0.22);
    return pacing;
  },

  getDemoPacing(chain, item = {}) {
    const pacing = {
      timeScale: 0.94,
      postNodePause: 0.14,
      resultFreeze: 0.65
    };
    if (!chain) return pacing;

    const id = item.chainId || item.id || "";
    const family = chain.family || "";
    const tags = new Set(chain.tags || []);
    const apply = values => Object.assign(pacing, values);

    if (family === "dualBlades") apply({ timeScale: 0.98, postNodePause: 0.10, resultFreeze: 0.48 });
    if (family === "greatsword") apply({ timeScale: 0.88, postNodePause: 0.18, resultFreeze: 0.72 });
    if (family === "staff") apply({ timeScale: 1.04, postNodePause: 0.10, resultFreeze: 0.58 });
    if (family === "fire") apply({ timeScale: 1.00, postNodePause: 0.12, resultFreeze: 0.60 });
    if (family === "absorb") apply({ timeScale: 0.98, postNodePause: 0.14, resultFreeze: 0.62 });
    if (tags.has("spender")) apply({ timeScale: 0.86, postNodePause: 0.24, resultFreeze: 0.78 });
    if (item.source === "enemy" || tags.has("defense")) apply({ timeScale: 0.68, postNodePause: 0.32, resultFreeze: 0.72 });

    const focusedPacing = {
      fireball_evolution: { timeScale: 1.08, postNodePause: 0.08, resultFreeze: 0.56 },
      fireball_evolution_v2: { timeScale: 1.04, postNodePause: 0.10, resultFreeze: 0.60 },
      absorb_siphon: { timeScale: 1.02, postNodePause: 0.10, resultFreeze: 0.60 },
      flame_blade: { timeScale: 0.96, postNodePause: 0.14, resultFreeze: 0.68 },
      overflow_burst: { timeScale: 0.82, postNodePause: 0.26, resultFreeze: 0.82 },
      greatsword_s_v2: { timeScale: 0.88, postNodePause: 0.20, resultFreeze: 0.74 },
      dualblades_a_v2: { timeScale: 1.02, postNodePause: 0.08, resultFreeze: 0.50 }
    };

    const chainId = item.chainId || id;
    if (focusedPacing[chainId]) apply(focusedPacing[chainId]);
    if (item.pacing) apply(item.pacing);
    return pacing;
  }
};
