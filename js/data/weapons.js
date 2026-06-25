const WeaponDatabase = {
  greatsword: {
    key: "A",
    name: "大剑",
    description: "高伤害，重蓄力",
    color: "#e74c3c",
    normalAttack: 18,
    icon: "大",
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
    chains: {
      A: "dualblades_a_v2",
      S: "dualblades_s_v2",
      D: "dualblades_d_v2"
    }
  }
};
