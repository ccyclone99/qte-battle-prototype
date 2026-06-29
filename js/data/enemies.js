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
    bladeRushTriple: {
      name: "压步三连",
      icon: "三",
      description: "纯物理三段压迫；用于测试敌方回合内逐节点拼刀，而不是一次输入覆盖多段。",
      nodes: [
        { id: "jab", attackId: "quickStab", offset: 0, role: "opener", counterNode: "clash_light" },
        { id: "sweep", attackId: "slash", offset: 0.56, role: "pressure", counterNode: "clash_or_guard" },
        { id: "lunge", attackId: "thrust", offset: 1.12, role: "finisher", counterNode: "clash_finisher", opensFollowupOnSuccess: true }
      ]
    },

    spellDoubleCut: {
      name: "秘术双斩压制",
      icon: "連",
      description: "法术起手压反应，接两段近身快攻；用于测试施法打断、逐节点拼刀和双持连续攻击。",
      nodes: [
        { id: "cast", attackId: "arcaneBolt", offset: 0, role: "spell", counterNode: "spell_interrupt", opensFollowupOnSuccess: true },
        { id: "firstCut", attackId: "quickStab", offset: 1.08, role: "pressure", counterNode: "clash_light" },
        { id: "secondCut", attackId: "quickStab", offset: 1.52, role: "finisher", counterNode: "clash_finisher", opensFollowupOnSuccess: true }
      ]
    },

    shieldSpellRush: {
      name: "盾压咒击",
      icon: "盾",
      description: "盾击压近身距离，随后接法术飞弹与横扫；用于测试格挡、拼刀和施法打断的选择差异。",
      nodes: [
        { id: "bash", attackId: "shieldBash", offset: 0, role: "opener", counterNode: "guard_or_dodge" },
        { id: "bolt", attackId: "arcaneBolt", offset: 0.9, role: "spell", counterNode: "spell_interrupt", opensFollowupOnSuccess: true },
        { id: "sweep", attackId: "slash", offset: 1.34, role: "finisher", counterNode: "clash_or_guard", opensFollowupOnSuccess: true }
      ]
    },

    feintCrush: {
      name: "虚刺重砸",
      icon: "重",
      description: "短刺骗反应后接重砸；用于测试不能只按同一节奏处理所有敌方回合。",
      nodes: [
        { id: "feint", attackId: "quickStab", offset: 0, role: "feint", counterNode: "clash_light" },
        { id: "crush", attackId: "heavySmash", offset: 0.86, role: "finisher", counterNode: "heavy_clash", opensFollowupOnSuccess: true }
      ]
    },

    curseNeedle: {
      name: "咒爆追刺",
      icon: "咒",
      description: "慢速咒爆接近身追刺，再补一枚飞弹；用于测试法术打断与后续追击覆盖。",
      nodes: [
        { id: "curse", attackId: "curseBurst", offset: 0, role: "spell", counterNode: "spell_interrupt", opensFollowupOnSuccess: true },
        { id: "needle", attackId: "quickStab", offset: 1.14, role: "pressure", counterNode: "clash_light" },
        { id: "bolt", attackId: "arcaneBolt", offset: 1.72, role: "finisher", counterNode: "spell_interrupt", opensFollowupOnSuccess: true }
      ]
    },

    knifeFlurry: {
      name: "连环快斩",
      icon: "双",
      description: "短间隔双物理攻击；单手需要防御组合，双持可用连续拼刀逐段处理。",
      nodes: [
        { id: "left", attackId: "quickStab", offset: 0, role: "opener", counterNode: "clash_light" },
        { id: "right", attackId: "slash", offset: 0.5, role: "finisher", counterNode: "clash_or_guard", opensFollowupOnSuccess: true }
      ]
    }
  }
};
