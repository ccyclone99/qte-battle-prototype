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
  }
};
