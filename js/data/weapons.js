const WeaponDatabase = {
  greatsword: {
    key: "A",
    name: "大剑",
    description: "高伤害，重蓄力",
    color: "#e74c3c",
    normalAttack: 18,
    icon: "大",
    chains: {
      A: {
        name: "重斩",
        description: "稳定的高伤害斩击",
        color: "#e74c3c",
        nodes: [
          {
            id: "raise",
            name: "举剑",
            duration: 0.5,
            input: { type: "press", key: "A" },
            window: { start: 0.20, end: 0.40 },
            perfect: 0.30,
            onPerfect: { next: "slash", effect: "raise_perfect", damage: 0, message: "举剑平稳" },
            onSuccess: { next: "slash", effect: "raise", damage: 0, message: "举剑" },
            onFail: { next: "weak_slash", effect: "raise_fail", damage: 0, message: "举剑不稳" }
          },
          {
            id: "slash",
            name: "重斩",
            duration: 0.5,
            input: { type: "press", key: "A" },
            window: { start: 0.20, end: 0.40 },
            perfect: 0.30,
            onPerfect: { next: null, effect: "slash_perfect", damage: 32, message: "重斩命中！" },
            onSuccess: { next: null, effect: "slash", damage: 26, message: "重斩命中" },
            onFail: { next: null, effect: "slash_fail", damage: 10, message: "斩击偏斜" }
          },
          {
            id: "weak_slash",
            name: "仓促斩",
            duration: 0.4,
            input: { type: "press", key: "A" },
            window: { start: 0.15, end: 0.35 },
            perfect: 0.25,
            onPerfect: { next: null, effect: "weak_slash_perfect", damage: 16, message: "仓促但有效" },
            onSuccess: { next: null, effect: "weak_slash", damage: 12, message: "仓促斩" },
            onFail: { next: null, effect: "weak_slash_fail", damage: 4, message: "挥空" }
          }
        ]
      },
      S: {
        name: "蓄力重劈",
        description: "按住蓄力，松手即释放；完美蓄力可造成极高伤害",
        color: "#c0392b",
        nodes: [
          {
            id: "draw",
            name: "拔剑",
            duration: 0.8,
            input: { type: "press", key: "S" },
            window: { start: 0.35, end: 0.65 },
            perfect: 0.50,
            onPerfect: { next: "charge", effect: "draw_perfect", damage: 5, message: "拔剑迅猛" },
            onSuccess: { next: "charge", effect: "draw", damage: 3, message: "拔剑" },
            onFail: { next: null, effect: "draw_fail", damage: 2, message: "拔剑不稳" }
          },
          {
            id: "charge",
            name: "蓄力",
            duration: 2.0,
            input: { type: "hold_release", key: "S" },
            window: { start: 1.2, end: 1.9 },
            perfect: 1.55,
            onPerfect: { next: null, effect: "charge_full", damage: 80, message: "完美蓄力！超重斩！" },
            onSuccess: { next: null, effect: "charge_good", damage: 56, message: "蓄力充足，重斩命中" },
            onEarly: { next: null, effect: "charge_early", damage: 32, message: "蓄力不足，仓促斩" },
            onLate: { next: null, effect: "charge_late", damage: 0, selfStun: 1.0, message: "蓄力过度，失衡！" }
          }
        ]
      },
      D: {
        name: "破甲斩",
        description: "造成伤害并眩晕敌人",
        color: "#922b21",
        nodes: [
          {
            id: "gather",
            name: "蓄势",
            duration: 0.6,
            input: { type: "press", key: "D" },
            window: { start: 0.25, end: 0.45 },
            perfect: 0.35,
            onPerfect: { next: "break", effect: "gather_perfect", damage: 0, message: "蓄势待发" },
            onSuccess: { next: "break", effect: "gather", damage: 0, message: "蓄势" },
            onFail: { next: "weak_break", effect: "gather_fail", damage: 0, message: "蓄势失败" }
          },
          {
            id: "break",
            name: "破甲",
            duration: 0.5,
            input: { type: "press", key: "D" },
            window: { start: 0.20, end: 0.40 },
            perfect: 0.30,
            onPerfect: { next: null, effect: "break_perfect", damage: 18, stunEnemy: 1.2, message: "破甲眩晕！" },
            onSuccess: { next: null, effect: "break", damage: 14, stunEnemy: 0.8, message: "破甲命中" },
            onFail: { next: null, effect: "break_fail", damage: 5, message: "破甲偏斜" }
          },
          {
            id: "weak_break",
            name: "虚弱斩",
            duration: 0.4,
            input: { type: "press", key: "D" },
            window: { start: 0.15, end: 0.35 },
            perfect: 0.25,
            onPerfect: { next: null, effect: "weak_break_perfect", damage: 10, stunEnemy: 0.5, message: "勉强破甲" },
            onSuccess: { next: null, effect: "weak_break", damage: 7, stunEnemy: 0.3, message: "虚弱斩" },
            onFail: { next: null, effect: "weak_break_fail", damage: 2, message: "挥空" }
          }
        ]
      }
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
      A: {
        name: "火球术",
        description: "快速释放的火焰法术",
        color: "#e67e22",
        nodes: [
          {
            id: "raise",
            name: "举杖",
            duration: 0.4,
            input: { type: "press", key: "A" },
            window: { start: 0.15, end: 0.35 },
            perfect: 0.25,
            onPerfect: { next: "cast", effect: "raise_perfect", damage: 0, message: "法杖高举" },
            onSuccess: { next: "cast", effect: "raise", damage: 0, message: "举杖" },
            onFail: { next: null, effect: "raise_fail", damage: 0, message: "施法失败" }
          },
          {
            id: "cast",
            name: "火球",
            duration: 0.4,
            input: { type: "press", key: "A" },
            window: { start: 0.15, end: 0.35 },
            perfect: 0.25,
            onPerfect: { next: null, effect: "fireball_perfect", damage: 24, message: "火球暴击！" },
            onSuccess: { next: null, effect: "fireball", damage: 18, message: "火球命中" },
            onFail: { next: null, effect: "fireball_fail", damage: 6, message: "法术失控" }
          }
        ]
      },
      S: {
        name: "元素爆发",
        description: "节奏吟唱后释放高伤害法术",
        color: "#9b59b6",
        nodes: [
          {
            id: "raise",
            name: "举杖",
            duration: 0.6,
            input: { type: "press", key: "S" },
            window: { start: 0.25, end: 0.50 },
            perfect: 0.38,
            onPerfect: { next: "chant", effect: "raise_perfect", damage: 0, message: "法杖高举" },
            onSuccess: { next: "chant", effect: "raise", damage: 0, message: "举杖" },
            onFail: { next: null, effect: "raise_fail", damage: 0, message: "施法失败" }
          },
          {
            id: "chant",
            name: "吟唱",
            duration: 2.4,
            input: { type: "rhythm", key: "S", beats: [0.5, 1.1, 1.7, 2.1] },
            window: { start: 0, end: 2.4 },
            perfect: null,
            rhythmTolerance: 0.18,
            onPerfect: { next: "cast", effect: "chant_perfect", damage: 0, chargeMul: 2.0, message: "咏唱完美" },
            onSuccess: { next: "cast", effect: "chant_good", damage: 0, chargeMul: 1.3, message: "咏唱完成" },
            onFail: { next: null, effect: "chant_fail", damage: 0, message: "咏唱中断" }
          },
          {
            id: "cast",
            name: "发动",
            duration: 0.5,
            input: { type: "press", key: "S" },
            window: { start: 0.20, end: 0.45 },
            perfect: 0.32,
            onPerfect: { next: null, effect: "cast_perfect", damage: 45, message: "法术暴击！" },
            onSuccess: { next: null, effect: "cast", damage: 32, message: "法术命中" },
            onFail: { next: null, effect: "cast_fail", damage: 10, message: "法术失控" }
          }
        ]
      },
      D: {
        name: "冰霜禁锢",
        description: "低伤害但可眩晕敌人",
        color: "#5dade2",
        nodes: [
          {
            id: "raise",
            name: "举杖",
            duration: 0.5,
            input: { type: "press", key: "D" },
            window: { start: 0.20, end: 0.40 },
            perfect: 0.30,
            onPerfect: { next: "chant", effect: "raise_perfect", damage: 0, message: "法杖高举" },
            onSuccess: { next: "chant", effect: "raise", damage: 0, message: "举杖" },
            onFail: { next: null, effect: "raise_fail", damage: 0, message: "施法失败" }
          },
          {
            id: "chant",
            name: "寒冰吟唱",
            duration: 1.8,
            input: { type: "rhythm", key: "D", beats: [0.5, 1.2] },
            window: { start: 0, end: 1.8 },
            perfect: null,
            rhythmTolerance: 0.20,
            onPerfect: { next: "cast", effect: "chant_perfect", damage: 0, chargeMul: 1.5, message: "寒冰凝聚" },
            onSuccess: { next: "cast", effect: "chant_good", damage: 0, chargeMul: 1.0, message: "冰霜成型" },
            onFail: { next: null, effect: "chant_fail", damage: 0, message: "咏唱中断" }
          },
          {
            id: "cast",
            name: "冰封",
            duration: 0.4,
            input: { type: "press", key: "D" },
            window: { start: 0.15, end: 0.35 },
            perfect: 0.25,
            onPerfect: { next: null, effect: "frost_perfect", damage: 15, stunEnemy: 1.5, message: "冰封！" },
            onSuccess: { next: null, effect: "frost", damage: 12, stunEnemy: 1.0, message: "冰霜禁锢" },
            onFail: { next: null, effect: "frost_fail", damage: 4, message: "法术失控" }
          }
        ]
      }
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
      A: {
        name: "连斩",
        description: "多段连击，总伤害可观",
        color: "#2ecc71",
        nodes: [
          {
            id: "dash",
            name: "突进",
            duration: 0.5,
            input: { type: "press", key: "A" },
            window: { start: 0.20, end: 0.45 },
            perfect: 0.32,
            onPerfect: { next: "slash1", effect: "dash_perfect", damage: 6, message: "突进撕裂" },
            onSuccess: { next: "slash1", effect: "dash", damage: 4, message: "突进" },
            onFail: { next: null, effect: "dash_fail", damage: 1, message: "突进失误" }
          },
          {
            id: "slash1",
            name: "连斩一",
            duration: 0.4,
            input: { type: "press", key: "A" },
            window: { start: 0.15, end: 0.35 },
            perfect: 0.25,
            onPerfect: { next: "slash2", effect: "combo1_perfect", damage: 10, message: "二段连斩" },
            onSuccess: { next: "slash2", effect: "combo1", damage: 7, message: "连斩一" },
            onFail: { next: null, effect: "combo1_fail", damage: 3, message: "连击中断" }
          },
          {
            id: "slash2",
            name: "连斩二",
            duration: 0.35,
            input: { type: "press", key: "S" },
            window: { start: 0.12, end: 0.30 },
            perfect: 0.21,
            onPerfect: { next: "finisher", effect: "combo2_perfect", damage: 14, message: "三段连斩" },
            onSuccess: { next: "finisher", effect: "combo2", damage: 10, message: "连斩二" },
            onFail: { next: null, effect: "combo2_fail", damage: 4, message: "连击中断" }
          },
          {
            id: "finisher",
            name: "终结",
            duration: 0.5,
            input: { type: "press", key: "D" },
            window: { start: 0.18, end: 0.42 },
            perfect: 0.30,
            onPerfect: { next: null, effect: "finisher_perfect", damage: 28, message: "完美终结！" },
            onSuccess: { next: null, effect: "finisher", damage: 20, message: "终结斩" },
            onFail: { next: null, effect: "finisher_fail", damage: 8, message: "终结偏斜" }
          }
        ]
      },
      S: {
        name: "突刺",
        description: "两段高伤害突刺",
        color: "#27ae60",
        nodes: [
          {
            id: "dash",
            name: "突进",
            duration: 0.4,
            input: { type: "press", key: "S" },
            window: { start: 0.15, end: 0.35 },
            perfect: 0.25,
            onPerfect: { next: "thrust", effect: "dash_perfect", damage: 5, message: "突进迅猛" },
            onSuccess: { next: "thrust", effect: "dash", damage: 3, message: "突进" },
            onFail: { next: null, effect: "dash_fail", damage: 1, message: "突进失误" }
          },
          {
            id: "thrust",
            name: "突刺",
            duration: 0.4,
            input: { type: "press", key: "S" },
            window: { start: 0.15, end: 0.35 },
            perfect: 0.25,
            onPerfect: { next: null, effect: "thrust_perfect", damage: 28, message: "突刺暴击！" },
            onSuccess: { next: null, effect: "thrust", damage: 22, message: "突刺命中" },
            onFail: { next: null, effect: "thrust_fail", damage: 6, message: "突刺偏斜" }
          }
        ]
      },
      D: {
        name: "旋风斩",
        description: "造成伤害并小幅眩晕",
        color: "#1e8449",
        nodes: [
          {
            id: "spin",
            name: "旋身",
            duration: 0.4,
            input: { type: "press", key: "D" },
            window: { start: 0.15, end: 0.35 },
            perfect: 0.25,
            onPerfect: { next: "spin2", effect: "spin_perfect", damage: 5, message: "旋身迅猛" },
            onSuccess: { next: "spin2", effect: "spin", damage: 3, message: "旋身" },
            onFail: { next: null, effect: "spin_fail", damage: 1, message: "旋身失误" }
          },
          {
            id: "spin2",
            name: "回旋",
            duration: 0.4,
            input: { type: "press", key: "D" },
            window: { start: 0.15, end: 0.35 },
            perfect: 0.25,
            onPerfect: { next: "finisher", effect: "spin2_perfect", damage: 10, message: "回旋撕裂" },
            onSuccess: { next: "finisher", effect: "spin2", damage: 7, message: "回旋命中" },
            onFail: { next: null, effect: "spin2_fail", damage: 3, message: "回旋中断" }
          },
          {
            id: "finisher",
            name: "终结",
            duration: 0.5,
            input: { type: "press", key: "D" },
            window: { start: 0.18, end: 0.42 },
            perfect: 0.30,
            onPerfect: { next: null, effect: "whirlwind_perfect", damage: 20, stunEnemy: 0.8, message: "旋风眩晕！" },
            onSuccess: { next: null, effect: "whirlwind", damage: 16, stunEnemy: 0.5, message: "旋风斩命中" },
            onFail: { next: null, effect: "whirlwind_fail", damage: 5, message: "终结偏斜" }
          }
        ]
      }
    }
  }
};
