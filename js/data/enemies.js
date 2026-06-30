const EnemyDatabase = {
  base: {
    name: "魔像士兵",
    maxHp: 200,
    color: "#c0392b",
    icon: "敌",
    model: {
      type: "golem",
      build: "medium",
      gear: "hammer",
      armor: "stone"
    },
    attacks: ["thrust", "slash", "heavySmash", "spellCast"]
  },

  archetypes: {
    base: {
      name: "魔像士兵",
      maxHp: 200,
      color: "#c0392b",
      icon: "敌",
      model: {
        type: "golem",
        build: "medium",
        gear: "hammer",
        armor: "stone"
      },
      attacks: ["thrust", "slash", "heavySmash", "spellCast"]
    },
    caster: {
      name: "秘术咏唱者",
      maxHp: 170,
      color: "#8e44ad",
      icon: "术",
      model: {
        type: "caster",
        build: "slim",
        gear: "focus",
        armor: "robe"
      },
      attacks: ["spellCast", "arcaneBolt", "curseBurst"]
    },
    armored: {
      name: "重甲守卫",
      maxHp: 260,
      color: "#922b21",
      icon: "甲",
      model: {
        type: "armored",
        build: "heavy",
        gear: "greatsword",
        armor: "plate"
      },
      defenseStats: {
        armor: 3,
        armorDamageMul: 0.92,
        armorBreakFlatMul: 0.35,
        shield: 0,
        posture: 78
      },
      attacks: ["heavySmash", "shieldBash", "slash"]
    },
    swift: {
      name: "迅捷刺客",
      maxHp: 160,
      color: "#27ae60",
      icon: "迅",
      model: {
        type: "swift",
        build: "lean",
        gear: "dualBlades",
        armor: "cloak"
      },
      attacks: ["quickStab", "thrust", "slash"]
    },
    shielded: {
      name: "持盾术卫",
      maxHp: 220,
      color: "#d4ac0d",
      icon: "盾",
      model: {
        type: "shielded",
        build: "guard",
        gear: "shield",
        armor: "ward"
      },
      defenseStats: {
        armor: 1,
        armorDamageMul: 0.96,
        armorBreakFlatMul: 0.5,
        shield: 5,
        shieldDamageMul: 0.82,
        posture: 92
      },
      attacks: ["shieldBash", "slash", "arcaneBolt"]
    }
  },

  attacks: {
    quickStab: {
      name: "急刺",
      icon: "↯",
      windup: 0.65,
      hitTime: 0.18,
      allowedResponses: ["dodge", "parry"],
      damage: 11,
      color: "#2ecc71",
      telegraph: {
        type: "stab",
        shape: "line",
        pose: "lunge",
        width: 18
      },
      meleeTimeline: {
        total: 1.08,
        contactFrame: 0.70,
        activeStart: 0.60,
        activeEnd: 0.82,
        sweep: { kind: "thrust", width: 34, reach: 92, yOffset: -16 },
        rootMotion: {
          source: [
            { at: 0.00, x: 0 },
            { at: 0.24, x: 150 },
            { at: 0.70, x: 278 },
            { at: 1.08, x: 184 }
          ],
          target: [
            { at: 0.00, x: 0 },
            { at: 0.62, x: 0 },
            { at: 0.78, x: 8 },
            { at: 1.08, x: 0 }
          ]
        }
      },
      counter: {
        type: "quick_melee",
        canClash: true,
        canGuard: false,
        canDodge: true,
        recommended: ["A", "SPACE"],
        hint: "A 拼刀 / SPACE 闪避"
      },
      hint: "短预警，可闪避/弹反 [SPACE]"
    },
    thrust: {
      name: "直刺",
      icon: "🡲",
      windup: 1.0,
      hitTime: 0.25,
      allowedResponses: ["dodge", "parry"],
      damage: 15,
      color: "#e74c3c",
      telegraph: {
        type: "stab",
        shape: "line",
        pose: "lunge",
        width: 24
      },
      meleeTimeline: {
        total: 1.32,
        contactFrame: 0.88,
        activeStart: 0.74,
        activeEnd: 1.02,
        sweep: { kind: "thrust", width: 42, reach: 118, yOffset: -14 },
        rootMotion: {
          source: [
            { at: 0.00, x: 0 },
            { at: 0.30, x: 132 },
            { at: 0.88, x: 300 },
            { at: 1.32, x: 196 }
          ],
          target: [
            { at: 0.00, x: 0 },
            { at: 0.78, x: 0 },
            { at: 0.94, x: 12 },
            { at: 1.32, x: 0 }
          ]
        }
      },
      counter: {
        type: "finisher",
        canClash: true,
        canGuard: false,
        canDodge: true,
        recommended: ["A", "SPACE"],
        hint: "A 拼刀打断 / SPACE 闪避"
      },
      hint: "可闪避 [SPACE] / 弹反 [SPACE]"
    },
    slash: {
      name: "横扫",
      icon: "⚔",
      windup: 0.9,
      hitTime: 0.35,
      allowedResponses: ["dodge", "guard"],
      damage: 12,
      color: "#f39c12",
      telegraph: {
        type: "slash",
        shape: "arc",
        pose: "sweep",
        width: 42
      },
      meleeTimeline: {
        total: 1.18,
        contactFrame: 0.76,
        activeStart: 0.64,
        activeEnd: 0.90,
        sweep: { kind: "slash", width: 52, reach: 104, yOffset: -10 },
        rootMotion: {
          source: [
            { at: 0.00, x: 0 },
            { at: 0.22, x: 144 },
            { at: 0.76, x: 265 },
            { at: 1.18, x: 188 }
          ],
          target: [
            { at: 0.00, x: 0 },
            { at: 0.66, x: 0 },
            { at: 0.84, x: 10 },
            { at: 1.18, x: 0 }
          ]
        }
      },
      counter: {
        type: "melee",
        canClash: true,
        canGuard: true,
        canDodge: true,
        recommended: ["A", "F", "SPACE"],
        hint: "A 拼刀 / F 举盾 / SPACE 闪避"
      },
      hint: "可闪避 [SPACE] / 格挡 [F]"
    },
    heavySmash: {
      name: "重砸",
      icon: "⤓",
      windup: 1.5,
      hitTime: 0.5,
      allowedResponses: ["dodge"],
      damage: 30,
      stunOnHit: 1.5,
      color: "#8e44ad",
      telegraph: {
        type: "smash",
        shape: "circle",
        pose: "overhead",
        width: 68
      },
      meleeTimeline: {
        total: 1.62,
        contactFrame: 1.10,
        activeStart: 0.94,
        activeEnd: 1.26,
        sweep: { kind: "smash", width: 76, reach: 92, yOffset: 8 },
        rootMotion: {
          source: [
            { at: 0.00, x: 0 },
            { at: 0.36, x: 118 },
            { at: 1.10, x: 242 },
            { at: 1.62, x: 162 }
          ],
          target: [
            { at: 0.00, x: 0 },
            { at: 1.00, x: 0 },
            { at: 1.18, x: 16 },
            { at: 1.62, x: 0 }
          ]
        }
      },
      counter: {
        type: "heavy_melee",
        canClash: true,
        canGuard: false,
        canDodge: true,
        recommended: ["A", "SPACE"],
        hint: "精准 A 拼重击 / SPACE 闪避"
      },
      hint: "只能闪避 [SPACE]"
    },
    delayedCleave: {
      name: "迟滞斩",
      icon: "遲",
      windup: 1.55,
      hitTime: 0.34,
      allowedResponses: ["dodge", "guard"],
      damage: 24,
      color: "#e67e22",
      telegraph: {
        type: "delay",
        shape: "arc",
        pose: "drawback",
        width: 64
      },
      meleeTimeline: {
        total: 1.74,
        contactFrame: 1.18,
        activeStart: 1.02,
        activeEnd: 1.34,
        sweep: { kind: "slash", width: 72, reach: 110, yOffset: -8 },
        rootMotion: {
          source: [
            { at: 0.00, x: 0 },
            { at: 0.36, x: 90 },
            { at: 0.82, x: 116 },
            { at: 1.18, x: 264 },
            { at: 1.74, x: 170 }
          ],
          target: [
            { at: 0.00, x: 0 },
            { at: 1.06, x: 0 },
            { at: 1.24, x: 13 },
            { at: 1.74, x: 0 }
          ]
        }
      },
      counter: {
        type: "heavy_melee",
        canClash: true,
        canGuard: true,
        canDodge: true,
        recommended: ["A", "F", "SPACE"],
        hint: "慢蓄力；等停顿后 A 拼刀 / F 接触帧举盾"
      },
      hint: "慢蓄力斩，不要被停顿骗早按"
    },
    guardCrush: {
      name: "破盾压击",
      icon: "破",
      windup: 1.25,
      hitTime: 0.24,
      allowedResponses: ["dodge", "guard"],
      damage: 26,
      stunOnHit: 1.0,
      color: "#d35400",
      telegraph: {
        type: "bash",
        shape: "cone",
        pose: "shieldDrive",
        width: 72
      },
      meleeTimeline: {
        total: 1.44,
        contactFrame: 0.96,
        activeStart: 0.80,
        activeEnd: 1.12,
        sweep: { kind: "bash", width: 82, reach: 84, yOffset: -2 },
        rootMotion: {
          source: [
            { at: 0.00, x: 0 },
            { at: 0.28, x: 110 },
            { at: 0.96, x: 270 },
            { at: 1.44, x: 176 }
          ],
          target: [
            { at: 0.00, x: 0 },
            { at: 0.86, x: 0 },
            { at: 1.02, x: 18 },
            { at: 1.44, x: 0 }
          ]
        }
      },
      counter: {
        type: "bash",
        canClash: false,
        canGuard: true,
        canDodge: true,
        recommended: ["F", "SPACE"],
        hint: "破盾压击不能拼刀；F 接触帧举盾或 SPACE 闪避"
      },
      hint: "不能拼刀，考验举盾/闪避"
    },
    spellCast: {
      name: "法术咏唱",
      icon: "✦",
      windup: 1.8,
      hitTime: 0.2,
      allowedResponses: ["parry"],
      damage: 25,
      interruptible: true,
      color: "#9b59b6",
      telegraph: {
        type: "spell",
        shape: "glyph",
        pose: "cast",
        width: 44
      },
      counter: {
        type: "spell_cast",
        canClash: false,
        canInterrupt: true,
        canGuard: false,
        canDodge: true,
        recommended: ["A", "SPACE"],
        hint: "A 出刀打断 / SPACE 咒还"
      },
      hint: "可弹反打断 [SPACE]"
    },
    arcaneBolt: {
      name: "秘术飞弹",
      icon: "✧",
      windup: 1.25,
      hitTime: 0.22,
      allowedResponses: ["parry"],
      damage: 20,
      interruptible: true,
      color: "#5dade2",
      telegraph: {
        type: "bolt",
        shape: "line",
        pose: "cast",
        width: 30
      },
      counter: {
        type: "spell_cast",
        canClash: false,
        canInterrupt: true,
        canGuard: false,
        canDodge: true,
        recommended: ["A", "SPACE"],
        hint: "A 出刀打断 / SPACE 咒还"
      },
      hint: "法术飞弹，可弹反 [SPACE]"
    },
    curseBurst: {
      name: "咒爆",
      icon: "✹",
      windup: 2.0,
      hitTime: 0.35,
      allowedResponses: ["parry", "guard"],
      damage: 32,
      interruptible: true,
      color: "#9b59b6",
      telegraph: {
        type: "burst",
        shape: "circle",
        pose: "cast",
        width: 76
      },
      counter: {
        type: "spell_cast",
        canClash: false,
        canInterrupt: true,
        canGuard: true,
        canDodge: true,
        recommended: ["A", "F", "SPACE"],
        hint: "A 打断 / F 格挡 / SPACE 咒还"
      },
      hint: "高威胁法术，可弹反/格挡"
    },
    shieldBash: {
      name: "盾击",
      icon: "▣",
      windup: 1.15,
      hitTime: 0.32,
      allowedResponses: ["dodge", "guard"],
      damage: 20,
      stunOnHit: 0.8,
      color: "#d4ac0d",
      telegraph: {
        type: "bash",
        shape: "cone",
        pose: "bash",
        width: 58
      },
      meleeTimeline: {
        total: 1.30,
        contactFrame: 0.86,
        activeStart: 0.72,
        activeEnd: 1.00,
        sweep: { kind: "bash", width: 64, reach: 76, yOffset: -2 },
        rootMotion: {
          source: [
            { at: 0.00, x: 0 },
            { at: 0.28, x: 126 },
            { at: 0.86, x: 252 },
            { at: 1.30, x: 176 }
          ],
          target: [
            { at: 0.00, x: 0 },
            { at: 0.76, x: 0 },
            { at: 0.94, x: 14 },
            { at: 1.30, x: 0 }
          ]
        }
      },
      counter: {
        type: "bash",
        canClash: false,
        canGuard: true,
        canDodge: true,
        recommended: ["F", "SPACE"],
        hint: "不能拼刀；F 举盾 / SPACE 闪避"
      },
      hint: "可闪避 [SPACE] / 格挡 [F]"
    }
  },

  attackChains: {
    tutorialSingleClash: {
      name: "入门一刀",
      icon: "一",
      description: "单段快刺；用于第一步训练等接触帧再出刀拼刀。",
      tutorialStep: "single_clash",
      nodes: [
        { id: "stab", attackId: "quickStab", offset: 0, role: "opener", counterNode: "clash_light", opensFollowupOnSuccess: true }
      ]
    },

    tutorialTwoHitRead: {
      name: "入门二连",
      icon: "二",
      description: "两段近身攻击；用于训练每段重新观察，不能一次输入覆盖整条连段。",
      tutorialStep: "two_hit_read",
      nodes: [
        { id: "first", attackId: "thrust", offset: 0, role: "opener", counterNode: "clash_finisher" },
        { id: "second", attackId: "slash", offset: 1.08, role: "finisher", counterNode: "clash_or_guard", opensFollowupOnSuccess: true, meleeStart: 108 }
      ]
    },

    tutorialGuardContact: {
      name: "入门盾压",
      icon: "盾",
      description: "不可拼刀的盾压；用于训练提前举盾并等待接触帧结算。",
      tutorialStep: "guard_contact",
      nodes: [
        { id: "bash", attackId: "shieldBash", offset: 0, role: "guard", counterNode: "guard_or_dodge", opensFollowupOnSuccess: true }
      ]
    },

    tutorialSpellInterrupt: {
      name: "入门咏唱",
      icon: "咒",
      description: "单段法术咏唱；用于训练 A/S/D 出刀打断施法。",
      tutorialStep: "spell_interrupt",
      nodes: [
        { id: "cast", attackId: "arcaneBolt", offset: 0, role: "spell", counterNode: "spell_interrupt", opensFollowupOnSuccess: true }
      ]
    },

    tutorialFollowupCheck: {
      name: "入门破绽",
      icon: "追",
      description: "慢速终结段；用于训练应对成功后把破绽转换成追击 QTE。",
      tutorialStep: "followup_conversion",
      nodes: [
        { id: "draw", attackId: "delayedCleave", offset: 0, role: "finisher", counterNode: "heavy_clash", opensFollowupOnSuccess: true, meleeStart: 76 }
      ]
    },

    bladeRushTriple: {
      name: "压步三连",
      icon: "三",
      description: "纯物理三段压迫；用于测试敌方回合内逐节点拼刀，而不是一次输入覆盖多段。",
      nodes: [
        { id: "jab", attackId: "quickStab", offset: 0, role: "opener", counterNode: "clash_light" },
        { id: "sweep", attackId: "slash", offset: 0.82, role: "pressure", counterNode: "clash_or_guard", meleeStart: 104 },
        { id: "lunge", attackId: "thrust", offset: 1.62, role: "finisher", counterNode: "clash_finisher", opensFollowupOnSuccess: true, meleeStart: 118 }
      ]
    },

    spellDoubleCut: {
      name: "秘术双斩压制",
      icon: "連",
      description: "法术起手压反应，接两段近身快攻；用于测试施法打断、逐节点拼刀和双持连续攻击。",
      nodes: [
        { id: "cast", attackId: "arcaneBolt", offset: 0, role: "spell", counterNode: "spell_interrupt", opensFollowupOnSuccess: true },
        { id: "firstCut", attackId: "quickStab", offset: 1.18, role: "pressure", counterNode: "clash_light" },
        { id: "secondCut", attackId: "quickStab", offset: 1.92, role: "finisher", counterNode: "clash_finisher", opensFollowupOnSuccess: true, meleeStart: 112 }
      ]
    },

    shieldSpellRush: {
      name: "盾压咒击",
      icon: "盾",
      description: "盾击压近身距离，随后接法术飞弹与横扫；用于测试格挡、拼刀和施法打断的选择差异。",
      nodes: [
        { id: "bash", attackId: "shieldBash", offset: 0, role: "opener", counterNode: "guard_or_dodge" },
        { id: "bolt", attackId: "arcaneBolt", offset: 0.9, role: "spell", counterNode: "spell_interrupt", opensFollowupOnSuccess: true },
        { id: "sweep", attackId: "slash", offset: 1.58, role: "finisher", counterNode: "clash_or_guard", opensFollowupOnSuccess: true, meleeStart: 96 }
      ]
    },

    feintCrush: {
      name: "虚刺重砸",
      icon: "重",
      description: "短刺骗反应后接重砸；用于测试不能只按同一节奏处理所有敌方回合。",
      nodes: [
        { id: "feint", attackId: "quickStab", offset: 0, role: "feint", counterNode: "clash_light" },
        { id: "crush", attackId: "heavySmash", offset: 1.06, role: "finisher", counterNode: "heavy_clash", opensFollowupOnSuccess: true, meleeStart: 86 }
      ]
    },

    curseNeedle: {
      name: "咒爆追刺",
      icon: "咒",
      description: "慢速咒爆接近身追刺，再补一枚飞弹；用于测试法术打断与后续追击覆盖。",
      nodes: [
        { id: "curse", attackId: "curseBurst", offset: 0, role: "spell", counterNode: "spell_interrupt", opensFollowupOnSuccess: true },
        { id: "needle", attackId: "quickStab", offset: 1.24, role: "pressure", counterNode: "clash_light" },
        { id: "bolt", attackId: "arcaneBolt", offset: 1.72, role: "finisher", counterNode: "spell_interrupt", opensFollowupOnSuccess: true }
      ]
    },

    knifeFlurry: {
      name: "连环快斩",
      icon: "双",
      description: "短间隔双物理攻击；单手需要防御组合，双持可用连续拼刀逐段处理。",
      nodes: [
        { id: "left", attackId: "quickStab", offset: 0, role: "opener", counterNode: "clash_light" },
        { id: "right", attackId: "slash", offset: 0.72, role: "finisher", counterNode: "clash_or_guard", opensFollowupOnSuccess: true, meleeStart: 118 }
      ]
    },

    rapidTriple: {
      name: "急雨三闪",
      icon: "疾",
      description: "三段短间隔快攻；用于测试玩家是否能逐段重新读动作，双持优势最明显。",
      nodes: [
        { id: "left", attackId: "quickStab", offset: 0, role: "opener", counterNode: "clash_light" },
        { id: "right", attackId: "quickStab", offset: 0.58, role: "pressure", counterNode: "clash_light", meleeStart: 126 },
        { id: "cut", attackId: "slash", offset: 1.16, role: "finisher", counterNode: "clash_or_guard", opensFollowupOnSuccess: true, meleeStart: 124 }
      ]
    },

    delayedCleaveMix: {
      name: "停顿迟斩",
      icon: "停",
      description: "先快刺逼早按，再用迟滞斩拉开节拍；用于训练不要按固定节奏反制。",
      nodes: [
        { id: "probe", attackId: "quickStab", offset: 0, role: "feint", counterNode: "clash_light" },
        { id: "delay", attackId: "delayedCleave", offset: 0.98, role: "finisher", counterNode: "heavy_clash", opensFollowupOnSuccess: true, meleeStart: 76 }
      ]
    },

    spellBladeTrap: {
      name: "咏唱诱斩",
      icon: "诱",
      description: "施法诱导出刀，随后接迟滞近身斩；用于测试打断施法后的后续观察。",
      nodes: [
        { id: "cast", attackId: "arcaneBolt", offset: 0, role: "spell", counterNode: "spell_interrupt", opensFollowupOnSuccess: true },
        { id: "cleave", attackId: "delayedCleave", offset: 1.10, role: "finisher", counterNode: "heavy_clash", opensFollowupOnSuccess: true, meleeStart: 86 }
      ]
    },

    shieldCrushCombo: {
      name: "折盾二压",
      icon: "碎",
      description: "破盾压击接横扫；用于测试不能用攻击键解决所有盾压节点。",
      nodes: [
        { id: "crush", attackId: "guardCrush", offset: 0, role: "opener", counterNode: "guard_or_dodge" },
        { id: "sweep", attackId: "slash", offset: 1.02, role: "finisher", counterNode: "clash_or_guard", opensFollowupOnSuccess: true, meleeStart: 104 }
      ]
    }
  }
};
