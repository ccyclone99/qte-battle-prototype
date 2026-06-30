const WeaponDatabase = {
  greatsword: {
    key: "A",
    name: "大剑",
    description: "高伤害，重蓄力",
    color: "#e74c3c",
    normalAttack: 18,
    icon: "大",
    counterProfile: {
      recovery: 0.48,
      startup: 0.16,
      travel: 0.08,
      activeDuration: 0.18,
      whiffVulnerability: 1.25,
      postureDamage: 18,
      hpDamage: 5,
      finisherPostureDamage: 28,
      allowedCounterTypes: ["heavy_melee", "finisher", "spell_cast"]
    },
    guardProfile: {
      maxStability: 72,
      sustainDrain: 4.8,
      blockCostMul: 1.05,
      damageMul: 0.42,
      heavyDamageMul: 0.68,
      breakDamageMul: 0.82,
      counterDamage: 2,
      canGuardTypes: ["melee", "heavy_melee", "finisher"]
    },
    chains: {
      A: "greatsword_a_v2",
      S: "greatsword_s_v2",
      D: "greatsword_d_v2"
    }
  },

  staff: {
    key: "S",
    name: "法杖",
    description: "法术多变，节奏吟唱",
    color: "#9b59b6",
    normalAttack: 14,
    icon: "法",
    counterProfile: {
      recovery: 0.38,
      startup: 0.18,
      travel: 0.10,
      activeDuration: 0.13,
      whiffVulnerability: 1.18,
      postureDamage: 10,
      hpDamage: 3,
      finisherPostureDamage: 18,
      allowedCounterTypes: ["spell_cast", "projectile"]
    },
    guardProfile: {
      maxStability: 62,
      sustainDrain: 3.8,
      blockCostMul: 1.10,
      damageMul: 0.55,
      spellDamageMul: 0.45,
      breakDamageMul: 0.88,
      canGuardSpell: true,
      counterDamage: 0,
      canGuardTypes: ["spell_cast", "projectile"]
    },
    chains: {
      A: "staff_a",
      S: "staff_s",
      D: "staff_d"
    }
  },

  dualBlades: {
    key: "D",
    name: "双刀",
    description: "高速连击，节奏紧凑",
    color: "#2ecc71",
    normalAttack: 12,
    icon: "双",
    counterProfile: {
      recovery: 0.18,
      startup: 0.07,
      travel: 0.05,
      activeDuration: 0.13,
      whiffVulnerability: 1.08,
      postureDamage: 14,
      hpDamage: 4,
      finisherPostureDamage: 22,
      allowedCounterTypes: ["quick_melee", "melee", "finisher", "spell_cast"]
    },
    guardProfile: {
      maxStability: 48,
      sustainDrain: 6.0,
      blockCostMul: 1.25,
      damageMul: 0.68,
      heavyDamageMul: 0.92,
      breakDamageMul: 1.0,
      counterDamage: 1,
      canGuardTypes: ["quick_melee"]
    },
    chains: {
      A: "dualblades_a_v2",
      S: "dualblades_s_v2",
      D: "dualblades_d_v2"
    }
  },

  swordShield: {
    key: "F",
    name: "单手剑盾",
    description: "持盾稳定，举盾与闪避联动",
    color: "#5dade2",
    normalAttack: 14,
    icon: "盾",
    counterProfile: {
      recovery: 0.30,
      startup: 0.11,
      travel: 0.06,
      activeDuration: 0.15,
      whiffVulnerability: 1.10,
      postureDamage: 12,
      hpDamage: 3,
      finisherPostureDamage: 20,
      allowedCounterTypes: ["quick_melee", "melee", "bash", "finisher"]
    },
    guardProfile: {
      maxStability: 118,
      sustainDrain: 2.2,
      blockCostMul: 0.72,
      damageMul: 0.12,
      heavyDamageMul: 0.38,
      bashDamageMul: 0.48,
      breakDamageMul: 0.70,
      counterDamage: 4,
      shieldDodge: true,
      canGuardTypes: ["quick_melee", "melee", "heavy_melee", "bash", "finisher"]
    },
    chains: {
      A: "greatsword_a_v2",
      S: "parry",
      D: "guard"
    }
  }
};
