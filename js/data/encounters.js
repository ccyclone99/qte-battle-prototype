const EncounterDatabase = {
  encounters: {
    ember_bulwark: {
      name: "熔炉守门人",
      enemyId: "armored",
      maxHp: 280,
      terrain: "熔炉窄桥",
      intent: "厚甲压迫，适合用火焰、破甲和大剑链打开缺口。",
      recommendedStyles: ["current"],
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
      recommendedStyles: ["current"],
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
      recommendedStyles: ["current"],
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
      recommendedStyles: ["current"],
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
    },

    counter_tutorial: {
      name: "反制入门",
      enemyId: "caster",
      maxHp: 180,
      terrain: "训练中庭",
      intent: "分层训练敌方回合反制：先看一刀接触，再处理二连、举盾、施法打断和追击转换。",
      recommendedStyles: ["current"],
      attackPattern: [
        "tutorialSingleClash",
        "tutorialTwoHitRead",
        "tutorialGuardContact",
        "tutorialSpellInterrupt",
        "tutorialFollowupCheck",
        "bladeRushTriple"
      ],
      phases: [
        {
          id: "mixed_exam",
          name: "入门综合",
          hpBelow: 0.48,
          attackPattern: [
            "tutorialTwoHitRead",
            "tutorialGuardContact",
            "tutorialSpellInterrupt",
            "bladeRushTriple",
            "delayedCleaveMix"
          ],
          ruleLines: [
            "半血后进入入门综合：二连、盾压、咏唱和三连会交替出现。"
          ]
        }
      ],
      modifiers: {
        enemyDamageMul: 0.72,
        enemyWindupMul: 1.14,
        responseWindowMul: 1.0,
        normalDamageMul: 1.0,
        swordDamageMul: 1.0
      },
      ruleLines: [
        "自动推荐默认进入此训练路线，按一刀、二连、举盾、咏唱、追击逐步加压。",
        "判定窗口保持来自敌方动作接触帧；简单/普通只放慢节奏和提示密度。",
        "熟悉后可在遭遇中切换到逆势试炼测试完整压力库。"
      ]
    },

    counter_dojo: {
      name: "逆势试炼",
      enemyId: "caster",
      maxHp: 210,
      terrain: "错拍训练场",
      intent: "敌人会轮换物理连斩、法术起手、盾压、重击、迟滞斩和咒爆追击，适合测试逐节点拼刀、施法打断和双持多段应对。",
      recommendedStyles: ["current"],
      attackPattern: [
        "bladeRushTriple",
        "spellDoubleCut",
        "shieldSpellRush",
        "knifeFlurry",
        "feintCrush",
        "curseNeedle",
        "rapidTriple",
        "delayedCleaveMix",
        "spellBladeTrap",
        "shieldCrushCombo"
      ],
      phases: [
        {
          id: "tight_loop",
          name: "贴身错拍",
          hpBelow: 0.5,
          attackPattern: [
            "rapidTriple",
            "knifeFlurry",
            "bladeRushTriple",
            "delayedCleaveMix",
            "spellDoubleCut",
            "shieldCrushCombo",
            "spellBladeTrap",
            "curseNeedle"
          ],
          ruleLines: [
            "半血后进入贴身错拍：物理连段、迟滞斩和盾压更频繁，反制覆盖价值上升。"
          ]
        }
      ],
      modifiers: {
        enemyDamageMul: 0.92,
        enemyWindupMul: 1.06,
        responseWindowMul: 1.0,
        normalDamageMul: 1.0,
        swordDamageMul: 1.03
      },
      ruleLines: [
        "不开局赠送法术能量；法术处理来自敌方回合的出刀打断。",
        "敌人同一回合会轮换多段物理、法术+近身、盾压、迟滞斩和重击错拍。",
        "当前方案使用双持逐段应对多段攻势；只有应对成功后的追击窗口可手动触发武器 QTE。"
      ]
    }
  }
};
