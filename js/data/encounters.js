const EncounterDatabase = {
  encounters: {
    ember_bulwark: {
      name: "熔炉守门人",
      enemyId: "armored",
      maxHp: 280,
      terrain: "熔炉窄桥",
      intent: "厚甲压迫，适合用火焰、破甲和大剑链打开缺口。",
      recommendedStyles: ["flameforge", "fire", "eastern", "desolo"],
      attackPattern: ["shieldBash", "heavySmash", "slash", "shieldBash"],
      modifiers: {
        startHeat: 12,
        enemyDamageMul: 1.05,
        enemyWindupMul: 0.96,
        responseWindowMul: 0.95,
        fireDamageMul: 1.06,
        armorBreakDamageMul: 1.08
      },
      ruleLines: [
        "开局热量 +12，鼓励先压火焰链。",
        "火焰链伤害 +6%；破甲后额外 +8%。",
        "敌人重击更疼，防御窗口略紧。"
      ]
    },

    arcane_conduit: {
      name: "秘术回廊",
      enemyId: "caster",
      maxHp: 190,
      terrain: "回声法阵",
      intent: "高频法术压迫，适合咒还吸收、镜咒反射和溢流爆发。",
      recommendedStyles: ["mirrorblade", "absorb"],
      attackPattern: ["spellCast", "arcaneBolt", "curseBurst", "arcaneBolt"],
      modifiers: {
        startSpellEnergy: 36,
        enemyWindupMul: 0.94,
        responseWindowMul: 0.92,
        absorbEnergyMul: 1.25,
        absorbDamageMul: 1.08,
        absorbReflectMul: 1.12
      },
      ruleLines: [
        "开局法术能量 +36，允许更早进入溢流计划。",
        "咒还吸收能量 +25%，反射伤害 +12%。",
        "法术窗口略紧，读条必须更早准备。"
      ]
    },

    knife_rain: {
      name: "雨巷迅刺",
      enemyId: "swift",
      maxHp: 175,
      terrain: "湿滑巷道",
      intent: "短预警多段快攻，适合双刃、闪避暴击和追加攻击练习。",
      recommendedStyles: ["desslo", "mirrorblade"],
      attackPattern: ["quickStab", "quickStab", "slash", "thrust"],
      modifiers: {
        enemyDamageMul: 0.92,
        enemyWindupMul: 0.88,
        responseWindowMul: 0.90,
        normalDamageMul: 1.04,
        swordDamageMul: 1.04
      },
      ruleLines: [
        "敌人出手更快但单次伤害略低。",
        "武器链与普通攻击伤害 +4%，鼓励主动抢节奏。",
        "连续快刺适合测试闪避、弹反和反击窗口。"
      ]
    },

    shield_rite: {
      name: "折盾仪式",
      enemyId: "shielded",
      maxHp: 235,
      terrain: "仪式圆厅",
      intent: "盾击与秘术混合，适合火盾反伤、格挡和咒还弹反。",
      recommendedStyles: ["fire", "flameforge", "absorb"],
      attackPattern: ["shieldBash", "arcaneBolt", "slash", "curseBurst"],
      modifiers: {
        startHeat: 6,
        startSpellEnergy: 18,
        enemyDamageMul: 1.0,
        responseWindowMul: 0.96,
        fireDamageMul: 1.04,
        absorbEnergyMul: 1.15,
        absorbReflectMul: 1.08
      },
      ruleLines: [
        "开局热量 +6、法术能量 +18，方便测试混合防御。",
        "火焰链伤害 +4%，咒还吸收能量 +15%。",
        "敌人会在盾击与法术之间切换。"
      ]
    }
  }
};
