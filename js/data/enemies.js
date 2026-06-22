const EnemyDatabase = {
  base: {
    name: "魔像士兵",
    maxHp: 200,
    color: "#c0392b",
    attacks: ["thrust", "slash", "heavySmash", "spellCast"]
  },

  attacks: {
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
    }
  }
};
