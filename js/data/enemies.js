const EnemyDatabase = {
  base: {
    name: "魔像士兵",
    maxHp: 200,
    color: "#c0392b",
    icon: "敌",
    attacks: ["thrust", "slash", "heavySmash", "spellCast"]
  },

  archetypes: {
    base: {
      name: "魔像士兵",
      maxHp: 200,
      color: "#c0392b",
      icon: "敌",
      attacks: ["thrust", "slash", "heavySmash", "spellCast"]
    },
    caster: {
      name: "秘术咏唱者",
      maxHp: 170,
      color: "#8e44ad",
      icon: "术",
      attacks: ["spellCast", "arcaneBolt", "curseBurst"]
    },
    armored: {
      name: "重甲守卫",
      maxHp: 260,
      color: "#922b21",
      icon: "甲",
      attacks: ["heavySmash", "shieldBash", "slash"]
    },
    swift: {
      name: "迅捷刺客",
      maxHp: 160,
      color: "#27ae60",
      icon: "迅",
      attacks: ["quickStab", "thrust", "slash"]
    },
    shielded: {
      name: "持盾术卫",
      maxHp: 220,
      color: "#d4ac0d",
      icon: "盾",
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
      hint: "可闪避 [SPACE] / 格挡 [F]"
    }
  }
};
