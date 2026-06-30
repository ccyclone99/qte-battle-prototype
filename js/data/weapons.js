const WeaponDatabase = {
  greatsword: {
    key: "A",
    name: "大剑",
    description: "高伤害，重蓄力",
    color: "#e74c3c",
    normalAttack: 18,
    icon: "大",
    identity: {
      role: "重击反制",
      summary: "慢启动，高姿态伤害；专门抓重击、终结段和施法段。",
      strengths: ["重击拼刀", "终结段破姿态", "单次高回报"],
      risks: ["快攻覆盖弱", "早按惩罚重", "收招慢"],
      recommendedPressure: ["heavy_melee", "finisher", "spell_cast"],
      publicTip: "大剑等慢招进身后出手，别抢快刺。"
    },
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
    identity: {
      role: "反咒控场",
      summary: "偏法术应对和蓄力释放；近身拼刀覆盖弱。",
      strengths: ["打断施法", "法术格挡", "资源转化"],
      risks: ["快攻覆盖弱", "近战盾稳一般", "动作需要预读"],
      recommendedPressure: ["spell_cast", "projectile"],
      publicTip: "法杖优先处理施法节点，近身快攻交给闪避或举盾。"
    },
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
    identity: {
      role: "连续拼刀",
      summary: "启动和恢复最快，适合逐段覆盖快攻链；盾稳最低。",
      strengths: ["快攻覆盖", "连续多段", "追击手感"],
      risks: ["重击承受差", "举盾不稳", "失误后容易吃连段"],
      recommendedPressure: ["quick_melee", "melee", "spell_cast"],
      publicTip: "双刀要逐段按 A/S/D，快攻链不要只按一次。"
    },
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
    identity: {
      role: "稳守反击",
      summary: "盾稳最高，能持盾等接触帧并联动闪避；输出较低。",
      strengths: ["接触帧举盾", "盾中闪避", "抗盾压"],
      risks: ["追击输出低", "法术处理一般", "被破盾会丢节奏"],
      recommendedPressure: ["quick_melee", "melee", "bash", "finisher"],
      publicTip: "剑盾提前按住 F 等接触帧，破盾压击别硬拼刀。"
    },
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
