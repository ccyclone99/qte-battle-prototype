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
  }

  reset() {
    this.heat = 0;
    if (this.owner && this.owner.statusSystem) {
      this.owner.statusSystem.remove("overload", "player");
    }
  }

  add(type, amount) {
    if (!Number.isFinite(amount) || amount === 0) {
      return { type, requested: amount || 0, applied: 0 };
    }

    if (type === "spellEnergy") {
      return this.addSpellEnergy(amount);
    }

    if (type === "heat") {
      return this.addHeat(amount);
    }

    return { type, requested: amount, applied: 0 };
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
}
