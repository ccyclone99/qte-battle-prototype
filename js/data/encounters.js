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
      phases: [
        {
          id: "molten_core",
          name: "熔心压迫",
          hpBelow: 0.5,
          attackPattern: ["heavySmash", "shieldBash", "heavySmash", "slash"],
          ruleLines: [
            "半血后进入熔心压迫：重击频率上升，但前摇仍然清楚。"
          ]
        }
      ],
      modifiers: {
        startHeat: 12,
        enemyDamageMul: 1.05,
        enemyWindupMul: 1.0,
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
      phases: [
        {
          id: "overloaded_matrix",
          name: "过载法阵",
          hpBelow: 0.5,
          attackPattern: ["curseBurst", "arcaneBolt", "spellCast", "curseBurst"],
          ruleLines: [
            "半血后进入过载法阵：咒爆更频繁，咒还和格挡价值上升。"
          ]
        }
      ],
      modifiers: {
        startSpellEnergy: 36,
        enemyWindupMul: 1.02,
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
      attackPattern: ["quickStab", "slash", "quickStab", "thrust"],
      phases: [
        {
          id: "close_quarters",
          name: "贴身追刺",
          hpBelow: 0.5,
          attackPattern: ["quickStab", "thrust", "quickStab", "slash"],
          ruleLines: [
            "半血后进入贴身追刺：快刺仍然频繁，但不连续压同一节奏。"
          ]
        }
      ],
      modifiers: {
        enemyDamageMul: 0.92,
        enemyWindupMul: 1.04,
        responseWindowMul: 0.94,
        normalDamageMul: 1.04,
        swordDamageMul: 1.04
      },
      ruleLines: [
        "敌人短预警但单次伤害略低。",
        "武器链与普通攻击伤害 +4%，鼓励主动抢节奏。",
        "快刺会穿插横扫/直刺，适合测试闪避、弹反和反击窗口。"
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
      phases: [
        {
          id: "broken_oath",
          name: "折盾誓约",
          hpBelow: 0.5,
          attackPattern: ["curseBurst", "shieldBash", "arcaneBolt", "slash"],
          ruleLines: [
            "半血后进入折盾誓约：盾击和咒爆交替，防御选择更重要。"
          ]
        }
      ],
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
