const ResourceDefinitions = {
  spellEnergy: {
    label: "法术能量",
    icon: "能",
    color: "#9b59b6"
  },
  heat: {
    label: "热量",
    icon: "热",
    color: "#e67e22"
  }
};

class ResourceSystem {
  constructor(owner) {
    this.owner = owner;
    this.heat = 0;
    this.maxHeat = 100;
    this.visualPulses = [];
    this.nextPulseId = 1;
  }

  reset() {
    this.heat = 0;
    this.visualPulses = [];
    if (this.owner && this.owner.statusSystem) {
      this.owner.statusSystem.remove("overload", "player");
    }
  }

  add(type, amount) {
    if (!Number.isFinite(amount) || amount === 0) {
      return { type, requested: amount || 0, applied: 0 };
    }

    let result = null;
    if (type === "spellEnergy") {
      result = this.addSpellEnergy(amount);
    } else if (type === "heat") {
      result = this.addHeat(amount);
    } else {
      result = { type, requested: amount, applied: 0 };
    }

    this.recordVisualPulse(result);
    return result;
  }

  spend(type, amount) {
    return this.add(type, -Math.abs(amount));
  }

  addSpellEnergy(amount) {
    const state = this.owner.playerState;
    const before = state.spellEnergy || 0;
    const cap = this.getSpellEnergyCap();
    state.spellEnergy = Utils.clamp(before + amount, 0, cap);
    const applied = state.spellEnergy - before;

    this.syncOverloadStatus();

    return {
      type: "spellEnergy",
      requested: amount,
      applied,
      total: state.spellEnergy,
      max: state.maxSpellEnergy,
      cap,
      overcap: state.spellEnergy > state.maxSpellEnergy
    };
  }

  addHeat(amount) {
    const before = this.heat;
    this.heat = Utils.clamp(this.heat + amount, 0, this.maxHeat);
    this.syncOverloadStatus();
    return {
      type: "heat",
      requested: amount,
      applied: this.heat - before,
      total: this.heat,
      max: this.maxHeat,
      overcap: false
    };
  }

  update(dt) {
    this.updateVisualPulses();

    const results = [];
    const state = this.owner.playerState;
    if (!state) return results;

    if (this.owner.hasSpell && this.owner.hasSpell("absorb") && state.spellEnergy > state.maxSpellEnergy) {
      const decay = SpellDatabase.absorb.staffOverflowDecay * dt;
      results.push({
        type: "damage",
        target: "player",
        amount: decay,
        message: SpellDatabase.absorb.staffOverflowMessage,
        resource: "spellEnergy"
      });
      if (this.owner.statusSystem) {
        this.owner.statusSystem.apply({ target: "player", type: "overload", turns: 1 }, { source: "resource" });
      }
    }

    return results;
  }

  syncOverloadStatus() {
    if (!this.owner || !this.owner.statusSystem) return;
    const state = this.owner.playerState || {};
    const spellOverload = state.spellEnergy > state.maxSpellEnergy;
    const heatOverload = this.heat >= (SpellDatabase.fire.overheatThreshold || 85);
    if (spellOverload || heatOverload) {
      this.owner.statusSystem.apply({ target: "player", type: "overload", turns: 1 }, { source: "resource" });
    } else {
      this.owner.statusSystem.remove("overload", "player");
    }
  }

  getHeatDamageMultiplier() {
    const bonus = SpellDatabase.fire.heatDamageBonusPerPoint || 0;
    return 1 + Math.min(this.heat, this.maxHeat) * bonus;
  }

  getSpellEnergyCap() {
    const state = this.owner.playerState;
    if (!state) return 100;
    if (this.owner.hasSpell && this.owner.hasSpell("absorb")) {
      return state.maxSpellEnergy * SpellDatabase.absorb.staffOverflowMul;
    }
    return state.maxSpellEnergy;
  }

  getDebugLines() {
    const state = this.owner.playerState || {};
    const spellEnergy = Math.floor(state.spellEnergy || 0);
    const maxSpellEnergy = state.maxSpellEnergy || 100;
    return [
      `资源：法术能量 ${spellEnergy}/${maxSpellEnergy} cap ${Math.floor(this.getSpellEnergyCap())}`,
      `资源：heat ${Math.floor(this.heat)}/${this.maxHeat}`
    ];
  }

  recordVisualPulse(result) {
    if (!result || !Number.isFinite(result.applied) || result.applied === 0) return;
    const definition = ResourceDefinitions[result.type] || {};
    const amount = result.applied;
    const absAmount = Math.abs(amount);
    const duration = amount > 0 ? 980 : 1120;
    const scaleBase = result.type === "heat" ? 34 : 58;
    const now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    this.visualPulses.unshift({
      id: this.nextPulseId++,
      type: result.type,
      label: definition.label || result.type,
      icon: definition.icon || "",
      color: amount > 0 ? (definition.color || "#f1c40f") : "#5dade2",
      amount,
      direction: amount > 0 ? "gain" : "spend",
      total: result.total || 0,
      max: result.max || 1,
      cap: result.cap || result.max || 1,
      overcap: !!result.overcap,
      intensity: Utils.clamp(0.48 + absAmount / scaleBase, 0.55, 1.35),
      createdAt: now,
      duration
    });
    if (this.visualPulses.length > 10) this.visualPulses.length = 10;
  }

  updateVisualPulses(now = null) {
    const clock = now !== null
      ? now
      : (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
    this.visualPulses = this.visualPulses.filter(pulse => clock - pulse.createdAt <= pulse.duration);
  }

  getVisualPulses(now = null) {
    const clock = now !== null
      ? now
      : (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
    this.updateVisualPulses(clock);
    return this.visualPulses.map(pulse => {
      const age = clock - pulse.createdAt;
      const progress = Utils.clamp(age / Math.max(1, pulse.duration), 0, 1);
      return {
        ...pulse,
        age,
        progress,
        alpha: Math.sin((1 - progress) * Math.PI * 0.5)
      };
    });
  }
}
