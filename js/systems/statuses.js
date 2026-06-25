const StatusDefinitions = {
  burn: {
    label: "燃烧",
    icon: "燃",
    color: "#e74c3c",
    tickDamage: 4,
    tickTarget: "enemy",
    tickPhase: "turnStart"
  },
  armorBreak: {
    label: "破甲",
    icon: "破",
    color: "#e74c3c",
    damageTakenMul: 1.3
  },
  absorbReady: {
    label: "咒还准备",
    icon: "吸",
    color: "#5dade2"
  },
  shieldEnchant: {
    label: "咒还附魔",
    icon: "咒",
    color: "#9b59b6"
  },
  overload: {
    label: "能量过载",
    icon: "溢",
    color: "#f39c12"
  },
  stun: {
    label: "眩晕",
    icon: "晕",
    color: "#f1c40f"
  }
};

class StatusSystem {
  constructor(owner) {
    this.owner = owner;
    this.active = [];
  }

  normalize(raw, options = {}) {
    if (!raw) return null;
    const id = raw.id || raw.type;
    if (!id) return null;
    return {
      id,
      target: raw.target || options.target || "enemy",
      stacks: raw.stacks || 1,
      duration: raw.duration ?? raw.turns ?? 1,
      source: raw.source || options.source || "system",
      data: raw.data || {}
    };
  }

  apply(raw, options = {}) {
    const status = this.normalize(raw, options);
    if (!status) return null;

    const existing = this.active.find(item => item.id === status.id && item.target === status.target);
    if (existing) {
      existing.stacks = Math.max(existing.stacks, status.stacks);
      existing.duration = Math.max(existing.duration, status.duration);
      existing.source = status.source;
      existing.data = { ...existing.data, ...status.data };
      this.syncOwnerFlags(existing);
      return { type: "refresh", status: existing, definition: this.getDefinition(existing.id) };
    }

    this.active.push(status);
    this.syncOwnerFlags(status);
    return { type: "apply", status, definition: this.getDefinition(status.id) };
  }

  applyMany(statuses, options = {}) {
    const results = [];
    for (const status of statuses || []) {
      const applied = this.apply(status, options);
      if (applied) results.push(applied);
    }
    return results;
  }

  tick(target) {
    const results = [];
    const remaining = [];
    const expired = [];

    for (const status of this.active) {
      if (status.target !== target) {
        remaining.push(status);
        continue;
      }

      const definition = this.getDefinition(status.id);
      if (definition.tickDamage && (!definition.tickTarget || definition.tickTarget === target)) {
        results.push({
          type: "damage",
          target,
          amount: definition.tickDamage * status.stacks,
          status,
          definition,
          message: `${definition.label}造成 ${definition.tickDamage * status.stacks} 伤害`
        });
      }

      status.duration -= 1;
      if (status.duration > 0) {
        remaining.push(status);
      } else {
        results.push({ type: "expire", target, status, definition });
        expired.push(status);
      }
    }

    this.active = remaining;
    for (const status of expired) {
      this.clearOwnerFlags(status);
    }
    return results;
  }

  remove(id, target) {
    const removed = [];
    this.active = this.active.filter(status => {
      const match = status.id === id && (!target || status.target === target);
      if (match) {
        removed.push(status);
      }
      return !match;
    });
    for (const status of removed) {
      this.clearOwnerFlags(status);
    }
    return removed;
  }

  clear() {
    const removed = this.active;
    this.active = [];
    for (const status of removed) {
      this.clearOwnerFlags(status);
    }
  }

  has(id, target) {
    return this.active.some(status => status.id === id && (!target || status.target === target));
  }

  list(target) {
    return this.active.filter(status => !target || status.target === target);
  }

  getDefinition(id) {
    return StatusDefinitions[id] || { label: id, icon: "态", color: "#ffffff" };
  }

  syncOwnerFlags(status) {
    if (!this.owner || !this.owner.playerState) return;
    if (status.target !== "player") return;
    if (status.id === "absorbReady") this.owner.playerState.absorbReady = true;
    if (status.id === "shieldEnchant") this.owner.playerState.shieldEnchanted = true;
  }

  clearOwnerFlags(status) {
    if (!this.owner || !this.owner.playerState) return;
    if (status.target !== "player") return;
    if (status.id === "absorbReady" && !this.has("absorbReady", "player")) {
      this.owner.playerState.absorbReady = false;
    }
    if (status.id === "shieldEnchant" && !this.has("shieldEnchant", "player")) {
      this.owner.playerState.shieldEnchanted = false;
    }
  }

  getDebugLines(limit = 6) {
    if (this.active.length === 0) return ["状态：无"];
    return this.active.slice(0, limit).map(status => {
      const definition = this.getDefinition(status.id);
      return `状态：${status.target} ${definition.label} x${status.stacks} ${status.duration}t`;
    });
  }
}
