const ChainDatabase = {
  greatsword_a: {
    key: "A",
    name: "重斩",
    description: "稳定的高伤害斩击",
    color: "#e74c3c",
    family: "greatsword",
    role: "opener",
    visual: "heavySlash",
    tags: ["weapon", "slash", "heavy"],
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

  greatsword_s: {
    key: "S",
    name: "蓄力重劈",
    description: "按住蓄力，松手即释放；完美蓄力可造成极高伤害",
    color: "#c0392b",
    family: "greatsword",
    role: "signature",
    visual: "chargedCleave",
    tags: ["weapon", "charge", "heavy"],
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

  greatsword_d: {
    key: "D",
    name: "破甲斩",
    description: "造成伤害并眩晕敌人",
    color: "#922b21",
    family: "greatsword",
    role: "control",
    visual: "armorBreak",
    tags: ["weapon", "stun", "armorBreak"],
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
  },

  dualblades_a: {
    key: "A",
    name: "连斩",
    description: "多段连击，总伤害可观",
    color: "#2ecc71",
    family: "dualBlades",
    role: "opener",
    visual: "comboSlash",
    tags: ["weapon", "combo", "slash"],
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

  dualblades_s: {
    key: "S",
    name: "突刺",
    description: "两段高伤害突刺",
    color: "#27ae60",
    family: "dualBlades",
    role: "signature",
    visual: "piercingThrust",
    tags: ["weapon", "crit", "pierce"],
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

  dualblades_d: {
    key: "D",
    name: "旋风斩",
    description: "造成伤害并小幅眩晕",
    color: "#1e8449",
    family: "dualBlades",
    role: "control",
    visual: "whirlwind",
    tags: ["weapon", "combo", "stun"],
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
  },

  greatsword_a_v2: {
    key: "A",
    name: "重斩·压步二连",
    description: "可靠开场链。Perfect 压步会追加横扫，失误则落入可用的弱收招。",
    color: "#e74c3c",
    family: "greatsword",
    role: "opener",
    visual: "heavySlashV2",
    tags: ["weapon", "slash", "heavy", "branch"],
    nodes: [
      {
        id: "stance",
        name: "压步",
        duration: 0.55,
        input: { type: "press", key: "A" },
        window: { start: 0.18, end: 0.42 },
        perfect: 0.30,
        onPerfect: { next: "cut", effect: "greatsword_stance_perfect", damage: 0, message: "压步稳住", visualEvent: "greatswordStance" },
        onSuccess: { next: "cut", effect: "greatsword_stance", damage: 0, message: "压步起手", visualEvent: "greatswordStance" },
        onEarly: { next: "cut", effect: "greatsword_stance_early", damage: 0, message: "抢步起手", visualEvent: "greatswordStance" },
        onLate: { next: "weak_cut", effect: "greatsword_stance_late", damage: 0, message: "脚步慢了", visualEvent: "greatswordRecover" },
        onFail: { next: "weak_cut", effect: "greatsword_stance_fail", damage: 0, message: "架势不稳", visualEvent: "greatswordRecover" }
      },
      {
        id: "cut",
        name: "沉肩斩",
        duration: 0.55,
        input: { type: "press", key: "A" },
        window: { start: 0.20, end: 0.43 },
        perfect: 0.31,
        onPerfect: { next: "cleave", effect: "greatsword_cut_perfect", damage: 20, message: "斩入架势", visualEvent: "greatswordHeavyHit" },
        onSuccess: { next: null, effect: "greatsword_cut", damage: 28, message: "重斩命中", visualEvent: "greatswordHeavyHit" },
        onEarly: { next: null, effect: "greatsword_cut_early", damage: 18, message: "斩击偏浅", visualEvent: "greatswordLightHit" },
        onLate: { next: "weak_cut", effect: "greatsword_cut_late", damage: 8, message: "收势不稳", visualEvent: "greatswordRecover" },
        onFail: { next: "weak_cut", effect: "greatsword_cut_fail", damage: 6, message: "斩击被带偏", visualEvent: "greatswordRecover" }
      },
      {
        id: "cleave",
        name: "横扫",
        duration: 0.45,
        input: { type: "press", key: "A" },
        window: { start: 0.16, end: 0.34 },
        perfect: 0.25,
        onPerfect: { next: null, effect: "greatsword_cleave_perfect", damage: 26, stunEnemy: 0.3, message: "横扫压制！", visualEvent: "greatswordCleavePerfect" },
        onSuccess: { next: null, effect: "greatsword_cleave", damage: 18, message: "横扫命中", visualEvent: "greatswordCleave" },
        onEarly: { next: null, effect: "greatsword_cleave_early", damage: 12, message: "横扫提前", visualEvent: "greatswordLightHit" },
        onLate: { next: null, effect: "greatsword_cleave_late", damage: 8, selfStun: 0.15, message: "横扫拖慢", visualEvent: "greatswordRecover" },
        onFail: { next: null, effect: "greatsword_cleave_fail", damage: 6, selfStun: 0.2, message: "横扫落空", visualEvent: "greatswordRecover" }
      },
      {
        id: "weak_cut",
        name: "弱收招",
        duration: 0.4,
        input: { type: "press", key: "A" },
        window: { start: 0.14, end: 0.32 },
        perfect: 0.23,
        onPerfect: { next: null, effect: "greatsword_recover_perfect", damage: 14, message: "弱收招命中", visualEvent: "greatswordLightHit" },
        onSuccess: { next: null, effect: "greatsword_recover", damage: 10, message: "勉强收招", visualEvent: "greatswordLightHit" },
        onEarly: { next: null, effect: "greatsword_recover_early", damage: 6, message: "收招过急", visualEvent: "greatswordRecover" },
        onLate: { next: null, effect: "greatsword_recover_late", damage: 4, selfStun: 0.2, message: "收招过慢", visualEvent: "greatswordRecover" },
        onFail: { next: null, effect: "greatsword_recover_fail", damage: 3, selfStun: 0.25, message: "重心散了", visualEvent: "greatswordRecover" }
      }
    ]
  },

  greatsword_s_v2: {
    key: "S",
    name: "蓄力重劈·三段",
    description: "拔剑、蓄势、释放。Perfect 蓄力进入裂地重劈；过蓄可压回但有硬直风险。",
    color: "#c0392b",
    family: "greatsword",
    role: "signature",
    visual: "chargedCleaveV2",
    tags: ["weapon", "charge", "heavy", "overcharge"],
    nodes: [
      {
        id: "draw",
        name: "拔剑",
        duration: 0.55,
        input: { type: "press", key: "S" },
        window: { start: 0.18, end: 0.42 },
        perfect: 0.30,
        onPerfect: { next: "charge", effect: "greatsword_draw_perfect", damage: 4, message: "拔剑迅猛", visualEvent: "greatswordDraw" },
        onSuccess: { next: "charge", effect: "greatsword_draw", damage: 2, message: "拔剑", visualEvent: "greatswordDraw" },
        onEarly: { next: "charge", effect: "greatsword_draw_early", damage: 1, message: "提前拔剑", visualEvent: "greatswordDraw" },
        onLate: { next: null, effect: "greatsword_draw_late", damage: 4, selfStun: 0.15, message: "拔剑拖慢", visualEvent: "greatswordRecover" },
        onFail: { next: null, effect: "greatsword_draw_fail", damage: 3, selfStun: 0.2, message: "拔剑不稳", visualEvent: "greatswordRecover" }
      },
      {
        id: "charge",
        name: "沉势蓄力",
        duration: 2.0,
        input: { type: "hold_release", key: "S" },
        window: { start: 0.85, end: 1.65 },
        perfect: 1.25,
        onPerfect: { next: "earthsplit", effect: "greatsword_charge_perfect", damage: 0, chargeMul: 1.55, message: "蓄力临界", visualEvent: "greatswordChargePeak" },
        onSuccess: { next: "release", effect: "greatsword_charge", damage: 0, chargeMul: 1.2, message: "蓄力充足", visualEvent: "greatswordCharge" },
        onEarly: { next: "release", effect: "greatsword_charge_early", damage: 10, chargeMul: 0.9, message: "蓄力不足", visualEvent: "greatswordLightHit" },
        onLate: { next: "overcharge", effect: "greatsword_charge_late", damage: 0, selfStun: 0.35, message: "过蓄失衡", visualEvent: "greatswordOvercharge" },
        onFail: { next: "overcharge", effect: "greatsword_charge_fail", damage: 0, selfStun: 0.45, message: "蓄力散掉", visualEvent: "greatswordOvercharge" }
      },
      {
        id: "release",
        name: "重劈释放",
        duration: 0.55,
        input: { type: "press", key: "S" },
        window: { start: 0.18, end: 0.42 },
        perfect: 0.30,
        onPerfect: { next: null, effect: "greatsword_release_perfect", damage: 42, stunEnemy: 0.4, message: "重劈压制！", visualEvent: "greatswordCleavePerfect" },
        onSuccess: { next: null, effect: "greatsword_release", damage: 34, message: "重劈命中", visualEvent: "greatswordCleave" },
        onEarly: { next: null, effect: "greatsword_release_early", damage: 22, message: "释放过急", visualEvent: "greatswordHeavyHit" },
        onLate: { next: null, effect: "greatsword_release_late", damage: 16, selfStun: 0.25, message: "劈空后摇", visualEvent: "greatswordRecover" },
        onFail: { next: null, effect: "greatsword_release_fail", damage: 12, selfStun: 0.35, message: "重劈偏斜", visualEvent: "greatswordRecover" }
      },
      {
        id: "earthsplit",
        name: "裂地重劈",
        duration: 0.65,
        input: { type: "press", key: "S" },
        window: { start: 0.22, end: 0.50 },
        perfect: 0.36,
        onPerfect: { next: null, effect: "greatsword_earthsplit_perfect", damage: 46, stunEnemy: 0.8, message: "裂地重劈！", visualEvent: "greatswordEarthsplit" },
        onSuccess: { next: null, effect: "greatsword_earthsplit", damage: 36, stunEnemy: 0.45, message: "裂地命中", visualEvent: "greatswordEarthsplit" },
        onEarly: { next: null, effect: "greatsword_earthsplit_early", damage: 24, message: "裂地提前", visualEvent: "greatswordCleave" },
        onLate: { next: null, effect: "greatsword_earthsplit_late", damage: 18, selfStun: 0.35, message: "重心过沉", visualEvent: "greatswordRecover" },
        onFail: { next: null, effect: "greatsword_earthsplit_fail", damage: 12, selfStun: 0.45, message: "裂地落空", visualEvent: "greatswordRecover" }
      },
      {
        id: "overcharge",
        name: "过蓄压制",
        duration: 0.5,
        input: { type: "press", key: "S" },
        window: { start: 0.16, end: 0.36 },
        perfect: 0.26,
        onPerfect: { next: null, effect: "greatsword_overcharge_control", damage: 36, selfStun: 0.2, message: "压住过蓄", visualEvent: "greatswordOverchargeHit" },
        onSuccess: { next: null, effect: "greatsword_overcharge", damage: 24, selfStun: 0.5, message: "过蓄释放", visualEvent: "greatswordOverchargeHit" },
        onEarly: { next: null, effect: "greatsword_overcharge_early", damage: 14, selfStun: 0.65, message: "过早压制", visualEvent: "greatswordOvercharge" },
        onLate: { next: null, effect: "greatsword_overcharge_late", damage: 8, selfStun: 1.0, message: "过蓄反噬", visualEvent: "greatswordOvercharge" },
        onFail: { next: null, effect: "greatsword_overcharge_fail", damage: 6, selfStun: 1.0, message: "过蓄失控", visualEvent: "greatswordOvercharge" }
      }
    ]
  },

  greatsword_d_v2: {
    key: "D",
    name: "破甲斩·开门",
    description: "控制链。Perfect 会破甲并打开额外玩家回合，Success 则制造短眩晕和破甲。",
    color: "#922b21",
    family: "greatsword",
    role: "control",
    visual: "armorBreakV2",
    tags: ["weapon", "stun", "armorBreak", "extraTurn"],
    nodes: [
      {
        id: "read",
        name: "读甲缝",
        duration: 0.55,
        input: { type: "press", key: "D" },
        window: { start: 0.18, end: 0.42 },
        perfect: 0.30,
        onPerfect: { next: "break", effect: "greatsword_read_perfect", damage: 0, message: "看见甲缝", visualEvent: "greatswordArmorRead" },
        onSuccess: { next: "break", effect: "greatsword_read", damage: 0, message: "寻找破绽", visualEvent: "greatswordArmorRead" },
        onEarly: { next: "break", effect: "greatsword_read_early", damage: 0, message: "抢读破绽", visualEvent: "greatswordArmorRead" },
        onLate: { next: "weak_break", effect: "greatsword_read_late", damage: 0, message: "破绽消退", visualEvent: "greatswordRecover" },
        onFail: { next: "weak_break", effect: "greatsword_read_fail", damage: 0, message: "没读准甲缝", visualEvent: "greatswordRecover" }
      },
      {
        id: "break",
        name: "开门斩",
        duration: 0.55,
        input: { type: "press", key: "D" },
        window: { start: 0.20, end: 0.42 },
        perfect: 0.31,
        onPerfect: { next: null, effect: "greatsword_break_perfect", damage: 24, stunEnemy: 0.8, openPlayerTurn: true, status: { target: "enemy", type: "armorBreak", turns: 2 }, message: "破甲开门！额外回合", visualEvent: "greatswordArmorBreak" },
        onSuccess: { next: null, effect: "greatsword_break", damage: 18, stunEnemy: 0.5, status: { target: "enemy", type: "armorBreak", turns: 1 }, message: "破甲命中", visualEvent: "greatswordArmorBreak" },
        onEarly: { next: null, effect: "greatsword_break_early", damage: 10, stunEnemy: 0.2, message: "破甲偏浅", visualEvent: "greatswordLightHit" },
        onLate: { next: "weak_break", effect: "greatsword_break_late", damage: 6, message: "斩入迟了", visualEvent: "greatswordRecover" },
        onFail: { next: "weak_break", effect: "greatsword_break_fail", damage: 4, message: "破甲偏斜", visualEvent: "greatswordRecover" }
      },
      {
        id: "weak_break",
        name: "碎步补斩",
        duration: 0.4,
        input: { type: "press", key: "D" },
        window: { start: 0.14, end: 0.32 },
        perfect: 0.23,
        onPerfect: { next: null, effect: "greatsword_weak_break_perfect", damage: 12, stunEnemy: 0.3, message: "补斩压住", visualEvent: "greatswordLightHit" },
        onSuccess: { next: null, effect: "greatsword_weak_break", damage: 8, stunEnemy: 0.15, message: "补斩命中", visualEvent: "greatswordLightHit" },
        onEarly: { next: null, effect: "greatsword_weak_break_early", damage: 5, message: "补斩过早", visualEvent: "greatswordRecover" },
        onLate: { next: null, effect: "greatsword_weak_break_late", damage: 3, selfStun: 0.2, message: "补斩拖慢", visualEvent: "greatswordRecover" },
        onFail: { next: null, effect: "greatsword_weak_break_fail", damage: 2, selfStun: 0.25, message: "补斩落空", visualEvent: "greatswordRecover" }
      }
    ]
  },

  dualblades_a_v2: {
    key: "A",
    name: "连斩·错步四连",
    description: "高速开场链。Perfect 路径进入影袭终结，失败会退入短收刀而不是直接断链。",
    color: "#2ecc71",
    family: "dualBlades",
    role: "opener",
    visual: "comboSlashV2",
    tags: ["weapon", "combo", "slash", "branch"],
    nodes: [
      {
        id: "dash",
        name: "错步",
        duration: 0.42,
        input: { type: "press", key: "A" },
        window: { start: 0.14, end: 0.34 },
        perfect: 0.24,
        onPerfect: { next: "slash1", effect: "dual_dash_perfect", damage: 5, message: "错步切入", visualEvent: "dualDash" },
        onSuccess: { next: "slash1", effect: "dual_dash", damage: 4, message: "错步", visualEvent: "dualDash" },
        onEarly: { next: "slash1", effect: "dual_dash_early", damage: 2, message: "抢步切入", visualEvent: "dualDash" },
        onLate: { next: "retreat_cut", effect: "dual_dash_late", damage: 1, message: "切入慢了", visualEvent: "dualRecover" },
        onFail: { next: "retreat_cut", effect: "dual_dash_fail", damage: 1, message: "错步失误", visualEvent: "dualRecover" }
      },
      {
        id: "slash1",
        name: "一闪",
        duration: 0.36,
        input: { type: "press", key: "A" },
        window: { start: 0.12, end: 0.30 },
        perfect: 0.21,
        onPerfect: { next: "slash2", effect: "dual_slash1_perfect", damage: 8, message: "一闪连上", visualEvent: "dualSlash" },
        onSuccess: { next: "slash2", effect: "dual_slash1", damage: 7, message: "一闪", visualEvent: "dualSlash" },
        onEarly: { next: "slash2", effect: "dual_slash1_early", damage: 4, message: "一闪提前", visualEvent: "dualSlash" },
        onLate: { next: "retreat_cut", effect: "dual_slash1_late", damage: 3, message: "节奏断开", visualEvent: "dualRecover" },
        onFail: { next: "retreat_cut", effect: "dual_slash1_fail", damage: 2, message: "连斩中断", visualEvent: "dualRecover" }
      },
      {
        id: "slash2",
        name: "二闪",
        duration: 0.34,
        input: { type: "press", key: "S" },
        window: { start: 0.11, end: 0.28 },
        perfect: 0.20,
        onPerfect: { next: "shadow_finisher", effect: "dual_slash2_perfect", damage: 12, message: "影袭路线", visualEvent: "dualAfterimage" },
        onSuccess: { next: "finisher", effect: "dual_slash2", damage: 9, message: "二闪", visualEvent: "dualSlash" },
        onEarly: { next: "finisher", effect: "dual_slash2_early", damage: 5, message: "二闪抢拍", visualEvent: "dualSlash" },
        onLate: { next: "retreat_cut", effect: "dual_slash2_late", damage: 4, message: "二闪拖慢", visualEvent: "dualRecover" },
        onFail: { next: "retreat_cut", effect: "dual_slash2_fail", damage: 3, message: "节奏断裂", visualEvent: "dualRecover" }
      },
      {
        id: "finisher",
        name: "收束斩",
        duration: 0.42,
        input: { type: "press", key: "D" },
        window: { start: 0.15, end: 0.35 },
        perfect: 0.25,
        onPerfect: { next: null, effect: "dual_finisher_perfect", damage: 24, stunEnemy: 0.2, message: "收束斩压制", visualEvent: "dualFinisher" },
        onSuccess: { next: null, effect: "dual_finisher", damage: 18, message: "收束斩", visualEvent: "dualFinisher" },
        onEarly: { next: null, effect: "dual_finisher_early", damage: 12, message: "终结提前", visualEvent: "dualSlash" },
        onLate: { next: null, effect: "dual_finisher_late", damage: 7, message: "终结拖慢", visualEvent: "dualRecover" },
        onFail: { next: null, effect: "dual_finisher_fail", damage: 6, message: "终结偏斜", visualEvent: "dualRecover" }
      },
      {
        id: "shadow_finisher",
        name: "影袭终结",
        duration: 0.46,
        input: { type: "press", key: "D" },
        window: { start: 0.16, end: 0.36 },
        perfect: 0.26,
        onPerfect: { next: null, effect: "dual_shadow_perfect", damage: 34, stunEnemy: 0.35, message: "影袭终结！", visualEvent: "dualShadowFinisher" },
        onSuccess: { next: null, effect: "dual_shadow", damage: 26, message: "影袭命中", visualEvent: "dualShadowFinisher" },
        onEarly: { next: null, effect: "dual_shadow_early", damage: 16, message: "影袭提前", visualEvent: "dualFinisher" },
        onLate: { next: null, effect: "dual_shadow_late", damage: 10, message: "影袭拖慢", visualEvent: "dualRecover" },
        onFail: { next: null, effect: "dual_shadow_fail", damage: 8, message: "影袭偏斜", visualEvent: "dualRecover" }
      },
      {
        id: "retreat_cut",
        name: "退步收刀",
        duration: 0.34,
        input: { type: "press", key: "A" },
        window: { start: 0.10, end: 0.28 },
        perfect: 0.19,
        onPerfect: { next: null, effect: "dual_retreat_perfect", damage: 10, iframe: 0.12, message: "退步反割", visualEvent: "dualRecoverHit" },
        onSuccess: { next: null, effect: "dual_retreat", damage: 7, iframe: 0.08, message: "退步收刀", visualEvent: "dualRecoverHit" },
        onEarly: { next: null, effect: "dual_retreat_early", damage: 4, message: "收刀过急", visualEvent: "dualRecover" },
        onLate: { next: null, effect: "dual_retreat_late", damage: 3, message: "收刀过慢", visualEvent: "dualRecover" },
        onFail: { next: null, effect: "dual_retreat_fail", damage: 2, message: "收刀失败", visualEvent: "dualRecover" }
      }
    ]
  },

  dualblades_s_v2: {
    key: "S",
    name: "穿刺·一线",
    description: "窄窗口精准链。两次蓄势都 Perfect 时穿刺会成为高爆发一线突刺。",
    color: "#27ae60",
    family: "dualBlades",
    role: "signature",
    visual: "piercingThrustV2",
    tags: ["weapon", "crit", "pierce", "precision"],
    nodes: [
      {
        id: "step",
        name: "低身步",
        duration: 0.35,
        input: { type: "press", key: "S" },
        window: { start: 0.12, end: 0.30 },
        perfect: 0.21,
        onPerfect: { next: "focus", effect: "dual_step_perfect", damage: 3, chargeMul: 1.15, message: "低身切入", visualEvent: "dualDash" },
        onSuccess: { next: "focus", effect: "dual_step", damage: 2, message: "低身步", visualEvent: "dualDash" },
        onEarly: { next: "quick_thrust", effect: "dual_step_early", damage: 1, message: "步点提前", visualEvent: "dualDash" },
        onLate: { next: "quick_thrust", effect: "dual_step_late", damage: 1, message: "步点拖慢", visualEvent: "dualRecover" },
        onFail: { next: "quick_thrust", effect: "dual_step_fail", damage: 1, message: "切入失败", visualEvent: "dualRecover" }
      },
      {
        id: "focus",
        name: "一线对准",
        duration: 0.45,
        input: { type: "press", key: "S" },
        window: { start: 0.16, end: 0.32 },
        perfect: 0.24,
        onPerfect: { next: "thrust", effect: "dual_focus_perfect", damage: 0, chargeMul: 1.35, message: "一线锁定", visualEvent: "dualFocus" },
        onSuccess: { next: "thrust", effect: "dual_focus", damage: 0, chargeMul: 1.05, message: "锁定目标", visualEvent: "dualFocus" },
        onEarly: { next: "quick_thrust", effect: "dual_focus_early", damage: 0, message: "锁定过早", visualEvent: "dualRecover" },
        onLate: { next: "quick_thrust", effect: "dual_focus_late", damage: 0, message: "锁定过慢", visualEvent: "dualRecover" },
        onFail: { next: "quick_thrust", effect: "dual_focus_fail", damage: 0, message: "锁定失败", visualEvent: "dualRecover" }
      },
      {
        id: "thrust",
        name: "一线突刺",
        duration: 0.36,
        input: { type: "press", key: "S" },
        window: { start: 0.12, end: 0.28 },
        perfect: 0.20,
        onPerfect: { next: null, effect: "dual_thrust_perfect", damage: 34, message: "一线贯穿！", visualEvent: "dualPiercePerfect" },
        onSuccess: { next: null, effect: "dual_thrust", damage: 24, message: "突刺命中", visualEvent: "dualPierce" },
        onEarly: { next: null, effect: "dual_thrust_early", damage: 15, message: "突刺过早", visualEvent: "dualPierce" },
        onLate: { next: null, effect: "dual_thrust_late", damage: 10, message: "突刺过晚", visualEvent: "dualRecover" },
        onFail: { next: null, effect: "dual_thrust_fail", damage: 8, message: "突刺偏斜", visualEvent: "dualRecover" }
      },
      {
        id: "quick_thrust",
        name: "短突",
        duration: 0.34,
        input: { type: "press", key: "S" },
        window: { start: 0.11, end: 0.28 },
        perfect: 0.19,
        onPerfect: { next: null, effect: "dual_quick_thrust_perfect", damage: 14, message: "短突命中弱点", visualEvent: "dualPierce" },
        onSuccess: { next: null, effect: "dual_quick_thrust", damage: 10, message: "短突命中", visualEvent: "dualPierce" },
        onEarly: { next: null, effect: "dual_quick_thrust_early", damage: 6, message: "短突提前", visualEvent: "dualRecover" },
        onLate: { next: null, effect: "dual_quick_thrust_late", damage: 4, message: "短突拖慢", visualEvent: "dualRecover" },
        onFail: { next: null, effect: "dual_quick_thrust_fail", damage: 3, message: "短突落空", visualEvent: "dualRecover" }
      }
    ]
  },

  dualblades_d_v2: {
    key: "D",
    name: "旋舞·疾避",
    description: "旋舞节奏链。Perfect 节奏提供短规避并强化终结，失败也能用回身斩收住。",
    color: "#1e8449",
    family: "dualBlades",
    role: "control",
    visual: "whirlwindV2",
    tags: ["weapon", "combo", "rhythm", "iframe"],
    nodes: [
      {
        id: "spin",
        name: "旋舞节奏",
        duration: 1.4,
        input: { type: "rhythm", key: "D", beats: [0.35, 0.75, 1.15] },
        window: { start: 0, end: 1.4 },
        perfect: null,
        rhythmTolerance: 0.16,
        onPerfect: { next: "finisher", effect: "dual_spin_perfect", damage: 8, chargeMul: 1.4, iframe: 0.25, message: "旋舞无隙", visualEvent: "dualWhirlPerfect" },
        onSuccess: { next: "finisher", effect: "dual_spin", damage: 5, chargeMul: 1.05, iframe: 0.12, message: "旋舞成型", visualEvent: "dualWhirl" },
        onFail: { next: "recover", effect: "dual_spin_fail", damage: 3, message: "旋舞散掉", visualEvent: "dualRecover" }
      },
      {
        id: "finisher",
        name: "疾避终结",
        duration: 0.42,
        input: { type: "press", key: "D" },
        window: { start: 0.14, end: 0.34 },
        perfect: 0.24,
        onPerfect: { next: null, effect: "dual_whirl_finish_perfect", damage: 24, stunEnemy: 0.6, iframe: 0.2, message: "疾避终结！", visualEvent: "dualWhirlFinisher" },
        onSuccess: { next: null, effect: "dual_whirl_finish", damage: 18, stunEnemy: 0.3, iframe: 0.1, message: "旋风终结", visualEvent: "dualWhirlFinisher" },
        onEarly: { next: null, effect: "dual_whirl_finish_early", damage: 12, message: "终结提前", visualEvent: "dualWhirl" },
        onLate: { next: null, effect: "dual_whirl_finish_late", damage: 7, message: "终结拖慢", visualEvent: "dualRecover" },
        onFail: { next: null, effect: "dual_whirl_finish_fail", damage: 6, message: "终结偏斜", visualEvent: "dualRecover" }
      },
      {
        id: "recover",
        name: "回身斩",
        duration: 0.36,
        input: { type: "press", key: "D" },
        window: { start: 0.12, end: 0.30 },
        perfect: 0.21,
        onPerfect: { next: null, effect: "dual_spin_recover_perfect", damage: 10, iframe: 0.1, message: "回身斩命中", visualEvent: "dualRecoverHit" },
        onSuccess: { next: null, effect: "dual_spin_recover", damage: 7, message: "回身收住", visualEvent: "dualRecoverHit" },
        onEarly: { next: null, effect: "dual_spin_recover_early", damage: 4, message: "回身过早", visualEvent: "dualRecover" },
        onLate: { next: null, effect: "dual_spin_recover_late", damage: 3, message: "回身过晚", visualEvent: "dualRecover" },
        onFail: { next: null, effect: "dual_spin_recover_fail", damage: 2, message: "回身失败", visualEvent: "dualRecover" }
      }
    ]
  },

  staff_a: {
    key: "A",
    name: "火球术",
    description: "快速释放的火焰法术",
    color: "#e67e22",
    family: "staff",
    role: "opener",
    visual: "emberProjectile",
    tags: ["weapon", "spell", "projectile"],
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

  staff_s: {
    key: "S",
    name: "元素爆发",
    description: "节奏吟唱后释放高伤害法术",
    color: "#9b59b6",
    family: "staff",
    role: "signature",
    visual: "glyphChant",
    tags: ["weapon", "spell", "rhythm"],
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

  staff_d: {
    key: "D",
    name: "冰霜禁锢",
    description: "低伤害但可眩晕敌人",
    color: "#5dade2",
    family: "staff",
    role: "control",
    visual: "frostGlyph",
    tags: ["weapon", "spell", "stun"],
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
  },

  fireball_evolution: {
    key: "A",
    name: "火球术·进化",
    description: "蓄力越久，火球越大",
    color: "#e74c3c",
    family: "fire",
    role: "fusion",
    visual: "emberProjectile",
    tags: ["fire", "charge", "projectile"],
    nodes: [
      {
        id: "raise",
        name: "举杖",
        duration: 0.5,
        input: { type: "press", key: "A" },
        window: { start: 0.20, end: 0.40 },
        perfect: 0.30,
        onPerfect: { next: "charge", effect: "raise_perfect", damage: 0, message: "法杖高举" },
        onSuccess: { next: "charge", effect: "raise", damage: 0, message: "举杖" },
        onEarly: { next: "charge", effect: "raise", damage: 0, message: "举杖" },
        onLate: { next: "charge", effect: "raise", damage: 0, message: "举杖" },
        onFail: { next: null, effect: "raise_fail", damage: 0, message: "施法失败" }
      },
      {
        id: "charge",
        name: "火焰蓄力",
        duration: 1.6,
        input: { type: "hold_release", key: "A" },
        window: { start: 0.6, end: 1.4 },
        perfect: 1.0,
        onPerfect: { next: null, effect: "fireball_big_perfect", damage: 42, message: "大火球爆裂！" },
        onSuccess: { next: null, effect: "fireball", damage: 32, message: "火球命中" },
        onEarly: { next: null, effect: "fireball_small", damage: 10, message: "小火球命中" },
        onLate: { next: null, effect: "fireball_fail", damage: 5, message: "法术失控" }
      }
    ]
  },

  fireball_evolution_v2: {
    key: "A",
    name: "火球术·三段进化",
    description: "点燃符印、聚焰蓄热、爆燃释放；过早会分支为火星弹，过晚会进入过热压制。",
    color: "#e74c3c",
    family: "fire",
    role: "fusion",
    visual: "emberProjectile",
    tags: ["fire", "charge", "projectile", "burn", "branch"],
    nodes: [
      {
        id: "kindle",
        name: "点燃符印",
        duration: 0.55,
        input: { type: "press", key: "A" },
        window: { start: 0.18, end: 0.42 },
        perfect: 0.30,
        onPerfect: { next: "charge", effect: "fire_kindle_perfect", damage: 0, message: "火焰符印稳定", visualEvent: "fireGlyph" },
        onSuccess: { next: "charge", effect: "fire_kindle", damage: 0, message: "火焰符印点亮", visualEvent: "fireGlyph" },
        onEarly: { next: "charge", effect: "fire_kindle_fast", damage: 0, message: "符印提前点亮", visualEvent: "fireSpark" },
        onLate: { next: "spark", effect: "fire_kindle_late", damage: 0, message: "符印不稳", visualEvent: "fireFizzle" },
        onFail: { next: "spark", effect: "fire_kindle_fail", damage: 0, message: "符印熄灭", visualEvent: "fireFizzle" }
      },
      {
        id: "charge",
        name: "聚焰蓄热",
        duration: 1.8,
        input: { type: "hold_release", key: "A" },
        window: { start: 0.70, end: 1.55 },
        perfect: 1.18,
        onPerfect: { next: "release", effect: "fire_charge_perfect", damage: 0, chargeMul: 1.55, resource: { heat: 8 }, message: "聚焰临界", visualEvent: "fireChargePeak" },
        onSuccess: { next: "release", effect: "fire_charge", damage: 0, chargeMul: 1.15, resource: { heat: 5 }, message: "火焰成型", visualEvent: "fireCharge" },
        onEarly: { next: "spark", effect: "fire_charge_early", damage: 8, resource: { heat: 3 }, message: "火星先溅", visualEvent: "fireSpark" },
        onLate: { next: "overheat", effect: "fire_charge_late", damage: 0, selfStun: 0.4, resource: { heat: 12 }, message: "过热失控", visualEvent: "fireOverheat" },
        onFail: { next: "spark", effect: "fire_charge_fail", damage: 4, message: "聚焰断裂", visualEvent: "fireFizzle" }
      },
      {
        id: "release",
        name: "爆燃释放",
        duration: 0.55,
        input: { type: "press", key: "A" },
        window: { start: 0.18, end: 0.43 },
        perfect: 0.30,
        onPerfect: { next: null, effect: "fireball_big_perfect", damage: 36, stunEnemy: 0.4, resource: { heat: 18 }, message: "爆燃火球！", status: { target: "enemy", type: "burn", turns: 2 }, visualEvent: "fireballBig" },
        onSuccess: { next: null, effect: "fireball", damage: 28, resource: { heat: 12 }, message: "火球命中", status: { target: "enemy", type: "burn", turns: 1 }, visualEvent: "fireball" },
        onEarly: { next: null, effect: "fireball_small", damage: 14, resource: { heat: 6 }, message: "提前释放", visualEvent: "fireballSmall" },
        onLate: { next: null, effect: "fireball_fail", damage: 8, selfStun: 0.2, message: "火球偏散", visualEvent: "fireFizzle" },
        onFail: { next: null, effect: "fireball_fail", damage: 6, message: "火球熄灭", visualEvent: "fireFizzle" }
      },
      {
        id: "spark",
        name: "火星弹",
        duration: 0.4,
        input: { type: "press", key: "A" },
        window: { start: 0.12, end: 0.32 },
        perfect: 0.22,
        onPerfect: { next: null, effect: "fireball_small_perfect", damage: 16, resource: { heat: 8 }, message: "火星命中弱点", visualEvent: "fireSparkHit" },
        onSuccess: { next: null, effect: "fireball_small", damage: 10, resource: { heat: 5 }, message: "小火球命中", visualEvent: "fireSparkHit" },
        onEarly: { next: null, effect: "fire_spark_early", damage: 6, message: "火星提前弹出", visualEvent: "fireSpark" },
        onLate: { next: null, effect: "fire_spark_late", damage: 4, message: "火星消散", visualEvent: "fireFizzle" },
        onFail: { next: null, effect: "fire_spark_fail", damage: 4, message: "火星熄灭", visualEvent: "fireFizzle" }
      },
      {
        id: "overheat",
        name: "过热压制",
        duration: 0.45,
        input: { type: "press", key: "A" },
        window: { start: 0.16, end: 0.34 },
        perfect: 0.25,
        onPerfect: { next: null, effect: "fire_overheat_control", damage: 22, resource: { heat: -18 }, message: "压住过热反噬", visualEvent: "fireOverheatControl" },
        onSuccess: { next: null, effect: "fire_overheat_release", damage: 14, selfStun: 0.2, resource: { heat: -10 }, message: "过热释放", visualEvent: "fireOverheat" },
        onEarly: { next: null, effect: "fire_overheat_early", damage: 8, selfStun: 0.35, message: "压制过早", visualEvent: "fireBacklash" },
        onLate: { next: null, effect: "fire_overheat_late", damage: 6, selfStun: 0.7, message: "火焰反噬", visualEvent: "fireBacklash" },
        onFail: { next: null, effect: "fire_overheat_fail", damage: 6, selfStun: 0.7, message: "火焰反噬", visualEvent: "fireBacklash" }
      }
    ]
  },

  absorb_siphon: {
    key: "S",
    name: "咒还·引流",
    description: "刻下咒还印、踩准回流节奏，将外部法术压入自身能量槽并准备一次吸收反击。",
    color: "#9b59b6",
    family: "absorb",
    role: "fusion",
    visual: "siphonGlyph",
    tags: ["absorb", "siphon", "spellEnergy", "reflect"],
    nodes: [
      {
        id: "sigil",
        name: "刻印",
        duration: 0.55,
        input: { type: "press", key: "S" },
        window: { start: 0.18, end: 0.42 },
        perfect: 0.30,
        onPerfect: { next: "siphon", effect: "absorb_sigil_perfect", damage: 0, message: "咒还印稳定", visualEvent: "absorbGlyph" },
        onSuccess: { next: "siphon", effect: "absorb_sigil", damage: 0, message: "咒还印展开", visualEvent: "absorbGlyph" },
        onEarly: { next: "leak", effect: "absorb_sigil_early", damage: 0, message: "刻印偏浅", visualEvent: "absorbFlicker" },
        onLate: { next: "leak", effect: "absorb_sigil_late", damage: 0, message: "刻印延迟", visualEvent: "absorbFlicker" },
        onFail: { next: "leak", effect: "absorb_sigil_fail", damage: 0, message: "刻印破碎", visualEvent: "absorbFlicker" }
      },
      {
        id: "siphon",
        name: "回流节奏",
        duration: 1.8,
        input: { type: "rhythm", key: "S", beats: [0.45, 0.95, 1.45] },
        window: { start: 0, end: 1.8 },
        perfect: null,
        rhythmTolerance: 0.18,
        onPerfect: { next: "release", effect: "absorb_siphon_perfect", damage: 0, chargeMul: 1.35, resource: { spellEnergy: 42 }, message: "法术回流完美", visualEvent: "absorbSiphonPeak" },
        onSuccess: { next: "release", effect: "absorb_siphon", damage: 0, chargeMul: 1.0, resource: { spellEnergy: 28 }, message: "法术能量回流", visualEvent: "absorbSiphon" },
        onFail: { next: "leak", effect: "absorb_siphon_fail", damage: 0, resource: { spellEnergy: 10 }, message: "回流不稳", visualEvent: "absorbLeak" }
      },
      {
        id: "release",
        name: "反咒释放",
        duration: 0.55,
        input: { type: "press", key: "S" },
        window: { start: 0.18, end: 0.43 },
        perfect: 0.30,
        onPerfect: { next: null, effect: "absorb_release_perfect", damage: 30, resource: { spellEnergy: 18 }, absorbReady: true, message: "反咒爆发！", status: { target: "player", type: "absorbReady", turns: 1 }, visualEvent: "absorbReleasePeak" },
        onSuccess: { next: null, effect: "absorb_release", damage: 22, resource: { spellEnergy: 12 }, absorbReady: true, message: "反咒命中", status: { target: "player", type: "absorbReady", turns: 1 }, visualEvent: "absorbRelease" },
        onEarly: { next: null, effect: "absorb_release_early", damage: 10, resource: { spellEnergy: 6 }, message: "反咒提前释放", visualEvent: "absorbLeak" },
        onLate: { next: null, effect: "absorb_release_late", damage: 8, selfStun: 0.25, resource: { spellEnergy: 6 }, message: "反咒过载", visualEvent: "absorbBacklash" },
        onFail: { next: null, effect: "absorb_release_fail", damage: 4, selfStun: 0.35, message: "反咒泄漏", visualEvent: "absorbBacklash" }
      },
      {
        id: "leak",
        name: "泄流补正",
        duration: 0.45,
        input: { type: "press", key: "S" },
        window: { start: 0.14, end: 0.34 },
        perfect: 0.24,
        onPerfect: { next: null, effect: "absorb_leak_control", damage: 12, resource: { spellEnergy: 16 }, absorbReady: true, message: "泄流被压回", visualEvent: "absorbSiphon" },
        onSuccess: { next: null, effect: "absorb_leak", damage: 6, resource: { spellEnergy: 8 }, message: "回收残余能量", visualEvent: "absorbLeak" },
        onEarly: { next: null, effect: "absorb_leak_early", damage: 3, message: "补正过早", visualEvent: "absorbFlicker" },
        onLate: { next: null, effect: "absorb_leak_late", damage: 2, selfStun: 0.25, message: "泄流灼伤", visualEvent: "absorbBacklash" },
        onFail: { next: null, effect: "absorb_leak_fail", damage: 0, selfStun: 0.4, message: "能量泄漏", visualEvent: "absorbBacklash" }
      }
    ]
  },

  flame_blade: {
    key: "A",
    name: "焰刃·熔甲三连",
    description: "武器与烈火重重融合。点火、压斩、爆燃终结；累积热量并施加燃烧或破甲。",
    color: "#e67e22",
    family: "fire",
    role: "fusion",
    visual: "flameBlade",
    tags: ["fire", "weapon", "slash", "heat", "burn", "armorBreak"],
    nodes: [
      {
        id: "ignite",
        name: "引火上刃",
        duration: 0.5,
        input: { type: "press", key: "A" },
        window: { start: 0.16, end: 0.38 },
        perfect: 0.27,
        onPerfect: { next: "cut", effect: "flame_blade_ignite_perfect", damage: 4, resource: { heat: 8 }, message: "火舌贴刃", visualEvent: "fireBladeIgnite" },
        onSuccess: { next: "cut", effect: "flame_blade_ignite", damage: 2, resource: { heat: 5 }, message: "刃上起火", visualEvent: "fireBladeIgnite" },
        onEarly: { next: "cut", effect: "flame_blade_ignite_early", damage: 1, resource: { heat: 3 }, message: "火势偏浅", visualEvent: "fireSpark" },
        onLate: { next: "ember_cut", effect: "flame_blade_ignite_late", damage: 1, message: "火舌散掉", visualEvent: "fireFizzle" },
        onFail: { next: "ember_cut", effect: "flame_blade_ignite_fail", damage: 0, message: "点火失败", visualEvent: "fireFizzle" }
      },
      {
        id: "cut",
        name: "熔甲压斩",
        duration: 0.55,
        input: { type: "press", key: "A" },
        window: { start: 0.18, end: 0.42 },
        perfect: 0.30,
        onPerfect: { next: "burst", effect: "flame_blade_cut_perfect", damage: 22, resource: { heat: 12 }, message: "熔甲入缝", status: { target: "enemy", type: "armorBreak", turns: 1 }, visualEvent: "fireBladeSlash" },
        onSuccess: { next: "burst", effect: "flame_blade_cut", damage: 16, resource: { heat: 8 }, message: "焰刃压斩", visualEvent: "fireBladeSlash" },
        onEarly: { next: "ember_cut", effect: "flame_blade_cut_early", damage: 9, resource: { heat: 4 }, message: "斩击抢拍", visualEvent: "fireBladeSlash" },
        onLate: { next: "ember_cut", effect: "flame_blade_cut_late", damage: 7, selfStun: 0.15, message: "火势拖慢", visualEvent: "fireFizzle" },
        onFail: { next: "ember_cut", effect: "flame_blade_cut_fail", damage: 4, message: "焰刃偏斜", visualEvent: "fireFizzle" }
      },
      {
        id: "burst",
        name: "爆燃收束",
        duration: 0.5,
        input: { type: "press", key: "D" },
        window: { start: 0.17, end: 0.38 },
        perfect: 0.28,
        onPerfect: { next: null, effect: "flame_blade_burst_perfect", damage: 30, stunEnemy: 0.35, resource: { heat: 14 }, message: "爆燃收束！", status: { target: "enemy", type: "burn", turns: 2 }, visualEvent: "fireBladeBurst" },
        onSuccess: { next: null, effect: "flame_blade_burst", damage: 22, resource: { heat: 9 }, message: "爆燃命中", status: { target: "enemy", type: "burn", turns: 1 }, visualEvent: "fireBladeBurst" },
        onEarly: { next: null, effect: "flame_blade_burst_early", damage: 14, resource: { heat: 5 }, message: "爆燃提前", visualEvent: "fireBladeSlash" },
        onLate: { next: null, effect: "flame_blade_burst_late", damage: 9, selfStun: 0.3, resource: { heat: 5 }, message: "余焰反噬", visualEvent: "fireBacklash" },
        onFail: { next: null, effect: "flame_blade_burst_fail", damage: 6, selfStun: 0.35, message: "火势脱手", visualEvent: "fireBacklash" }
      },
      {
        id: "ember_cut",
        name: "余火补斩",
        duration: 0.4,
        input: { type: "press", key: "A" },
        window: { start: 0.13, end: 0.31 },
        perfect: 0.22,
        onPerfect: { next: null, effect: "flame_blade_ember_perfect", damage: 13, resource: { heat: 6 }, status: { target: "enemy", type: "burn", turns: 1 }, message: "余火咬住", visualEvent: "fireBladeSlash" },
        onSuccess: { next: null, effect: "flame_blade_ember", damage: 9, resource: { heat: 4 }, message: "余火补斩", visualEvent: "fireBladeSlash" },
        onEarly: { next: null, effect: "flame_blade_ember_early", damage: 5, message: "补斩过早", visualEvent: "fireSpark" },
        onLate: { next: null, effect: "flame_blade_ember_late", damage: 4, message: "余火散尽", visualEvent: "fireFizzle" },
        onFail: { next: null, effect: "flame_blade_ember_fail", damage: 2, message: "补斩落空", visualEvent: "fireFizzle" }
      }
    ]
  },

  shield_flare: {
    key: "F",
    name: "盾焰·反冲",
    description: "烈火防御反应。格挡瞬间爆出火环，Perfect 完全减伤并返还燃烧。",
    color: "#e67e22",
    family: "fire",
    role: "defense",
    visual: "shieldFlare",
    tags: ["fire", "defense", "guard", "heat", "counter"],
    nodes: [
      {
        id: "flare",
        name: "盾焰爆开",
        duration: 0.5,
        input: { type: "press", key: "F" },
        window: { start: 0.16, end: 0.38 },
        perfect: 0.27,
        onPerfect: { next: null, effect: "shield_flare_perfect", damage: 18, damageMul: 0, resource: { heat: 10 }, message: "盾焰反冲！", status: { target: "enemy", type: "burn", turns: 1 }, visualEvent: "shieldFlarePerfect" },
        onSuccess: { next: null, effect: "shield_flare", damage: 12, damageMul: 0.25, resource: { heat: 7 }, message: "盾焰格挡", visualEvent: "shieldFlare" },
        onEarly: { next: null, effect: "shield_flare_early", damage: 6, damageMul: 0.55, resource: { heat: 4 }, message: "火环提前", visualEvent: "fireSpark" },
        onLate: { next: null, effect: "shield_flare_late", damage: 4, damageMul: 0.75, selfStun: 0.2, message: "举盾慢了", visualEvent: "fireFizzle" },
        onFail: { next: null, effect: "shield_flare_fail", damage: 0, damageMul: 1, selfStun: 0.3, message: "盾焰未成", visualEvent: "fireFizzle" }
      }
    ]
  },

  mirror_guard: {
    key: "F",
    name: "镜咒·折返",
    description: "咒还防御反应。将敌方法术或重击折入能量槽，Perfect 直接反射。",
    color: "#9b59b6",
    family: "absorb",
    role: "defense",
    visual: "mirrorGuard",
    tags: ["absorb", "defense", "reflect", "spellEnergy"],
    nodes: [
      {
        id: "mirror",
        name: "镜面展开",
        duration: 0.55,
        input: { type: "press", key: "F" },
        window: { start: 0.17, end: 0.40 },
        perfect: 0.29,
        onPerfect: { next: null, effect: "mirror_guard_perfect", damage: 24, damageMul: 0, resource: { spellEnergy: 32 }, absorbReady: true, message: "镜咒折返！", status: { target: "player", type: "absorbReady", turns: 1 }, visualEvent: "mirrorGuardPerfect" },
        onSuccess: { next: null, effect: "mirror_guard", damage: 12, damageMul: 0.2, resource: { spellEnergy: 22 }, absorbReady: true, message: "镜咒吸收", status: { target: "player", type: "absorbReady", turns: 1 }, visualEvent: "mirrorGuard" },
        onEarly: { next: null, effect: "mirror_guard_early", damage: 4, damageMul: 0.55, resource: { spellEnergy: 10 }, message: "镜面偏浅", visualEvent: "absorbFlicker" },
        onLate: { next: null, effect: "mirror_guard_late", damage: 2, damageMul: 0.75, resource: { spellEnergy: 8 }, selfStun: 0.2, message: "镜面迟滞", visualEvent: "absorbLeak" },
        onFail: { next: null, effect: "mirror_guard_fail", damage: 0, damageMul: 1, selfStun: 0.3, message: "镜面破碎", visualEvent: "absorbBacklash" }
      }
    ]
  },

  overflow_burst: {
    key: "D",
    name: "溢流·裂隙爆发",
    description: "消耗大量法术能量，把过载压成高伤爆发；失败会泄流并产生硬直。",
    color: "#8e44ad",
    family: "absorb",
    role: "spender",
    visual: "overflowBurst",
    tags: ["absorb", "spender", "spellEnergy", "overload"],
    cost: { spellEnergy: 60 },
    nodes: [
      {
        id: "compress",
        name: "压缩溢流",
        duration: 0.65,
        input: { type: "hold_release", key: "D" },
        window: { start: 0.24, end: 0.55 },
        perfect: 0.40,
        onPerfect: { next: "burst", effect: "overflow_compress_perfect", damage: 0, chargeMul: 1.45, message: "溢流被压实", visualEvent: "overflowBurstPeak" },
        onSuccess: { next: "burst", effect: "overflow_compress", damage: 0, chargeMul: 1.15, message: "溢流成型", visualEvent: "overflowBurst" },
        onEarly: { next: "vent", effect: "overflow_compress_early", damage: 0, message: "压缩不足", visualEvent: "overflowVent" },
        onLate: { next: "vent", effect: "overflow_compress_late", damage: 0, selfStun: 0.25, message: "溢流不稳", visualEvent: "absorbBacklash" },
        onFail: { next: "vent", effect: "overflow_compress_fail", damage: 0, selfStun: 0.35, message: "压缩失败", visualEvent: "absorbBacklash" }
      },
      {
        id: "burst",
        name: "裂隙爆发",
        duration: 0.55,
        input: { type: "press", key: "D" },
        window: { start: 0.18, end: 0.42 },
        perfect: 0.30,
        onPerfect: { next: null, effect: "overflow_burst_perfect", damage: 54, resource: { spellEnergy: -60 }, stunEnemy: 0.45, message: "裂隙爆发！", visualEvent: "overflowBurstPeak" },
        onSuccess: { next: null, effect: "overflow_burst", damage: 40, resource: { spellEnergy: -60 }, message: "溢流爆发", visualEvent: "overflowBurst" },
        onEarly: { next: null, effect: "overflow_burst_early", damage: 24, resource: { spellEnergy: -60 }, message: "爆发提前", visualEvent: "overflowBurst" },
        onLate: { next: null, effect: "overflow_burst_late", damage: 18, resource: { spellEnergy: -60 }, selfStun: 0.35, message: "爆发拖慢", visualEvent: "absorbBacklash" },
        onFail: { next: null, effect: "overflow_burst_fail", damage: 10, resource: { spellEnergy: -40 }, selfStun: 0.45, message: "溢流反噬", visualEvent: "absorbBacklash" }
      },
      {
        id: "vent",
        name: "泄压",
        duration: 0.45,
        input: { type: "press", key: "D" },
        window: { start: 0.14, end: 0.34 },
        perfect: 0.24,
        onPerfect: { next: null, effect: "overflow_vent_perfect", damage: 16, resource: { spellEnergy: -25 }, message: "泄压反击", visualEvent: "overflowVent" },
        onSuccess: { next: null, effect: "overflow_vent", damage: 8, resource: { spellEnergy: -20 }, message: "安全泄压", visualEvent: "overflowVent" },
        onEarly: { next: null, effect: "overflow_vent_early", damage: 4, selfStun: 0.2, message: "泄压过急", visualEvent: "absorbLeak" },
        onLate: { next: null, effect: "overflow_vent_late", damage: 2, selfStun: 0.35, message: "泄压过慢", visualEvent: "absorbBacklash" },
        onFail: { next: null, effect: "overflow_vent_fail", damage: 0, selfStun: 0.45, message: "溢流失控", visualEvent: "absorbBacklash" }
      }
    ]
  },

  followup_greatsword: {
    key: "A",
    name: "荒芜追击",
    description: "追加攻击，化解敌人进攻则暴击打断",
    color: "#f1c40f",
    family: "combatArt",
    role: "followUp",
    visual: "followUpSlash",
    tags: ["followUp", "interrupt", "slash"],
    nodes: [
      {
        id: "followup",
        name: "追击",
        duration: 0.5,
        input: { type: "press", key: "A" },
        window: { start: 0.18, end: 0.42 },
        perfect: 0.30,
        onPerfect: { next: null, effect: "followup_perfect", damage: 28, stunEnemy: 1.0, message: "荒芜追击！打断敌人" },
        onSuccess: { next: null, effect: "followup", damage: 18, message: "追击命中" },
        onFail: { next: null, effect: "followup_fail", damage: 5, message: "追击落空" }
      }
    ]
  },

  followup_dualblades: {
    key: "A",
    name: "荒芜追击",
    description: "追加攻击，化解敌人进攻则暴击打断",
    color: "#f1c40f",
    family: "combatArt",
    role: "followUp",
    visual: "followUpSlash",
    tags: ["followUp", "interrupt", "combo"],
    nodes: [
      {
        id: "followup",
        name: "追击",
        duration: 0.4,
        input: { type: "press", key: "A" },
        window: { start: 0.15, end: 0.35 },
        perfect: 0.25,
        onPerfect: { next: null, effect: "followup_perfect", damage: 24, stunEnemy: 1.0, message: "荒芜追击！打断敌人" },
        onSuccess: { next: null, effect: "followup", damage: 15, message: "追击命中" },
        onFail: { next: null, effect: "followup_fail", damage: 4, message: "追击落空" }
      }
    ]
  },

  followup_staff: {
    key: "A",
    name: "荒芜法术追击",
    description: "追加法术攻击",
    color: "#f1c40f",
    family: "combatArt",
    role: "followUp",
    visual: "followUpCast",
    tags: ["followUp", "interrupt", "spell"],
    nodes: [
      {
        id: "followup_cast",
        name: "法弹",
        duration: 0.4,
        input: { type: "press", key: "A" },
        window: { start: 0.15, end: 0.35 },
        perfect: 0.25,
        onPerfect: { next: null, effect: "followup_cast_perfect", damage: 22, stunEnemy: 1.0, message: "法术追击！打断敌人" },
        onSuccess: { next: null, effect: "followup_cast", damage: 14, message: "法术追击命中" },
        onFail: { next: null, effect: "followup_cast_fail", damage: 3, message: "法术追击失败" }
      }
    ]
  },

  dodge: {
    key: "SPACE",
    name: "闪避",
    description: "闪身躲避并触发反击",
    color: "#3498db",
    family: "defense",
    role: "evade",
    visual: "evadeStep",
    tags: ["defense", "iframe", "counter"],
    nodes: [
      {
        id: "dodge",
        name: "闪身",
        duration: 0.6,
        input: { type: "press", key: "SPACE" },
        window: { start: 0.20, end: 0.50 },
        perfect: 0.35,
        onPerfect: { next: null, effect: "dodge_perfect", damage: 22, iframe: 0.4, stunEnemy: 1.0, message: "完美闪避！可追击" },
        onSuccess: { next: null, effect: "dodge", damage: 0, iframe: 0.3, message: "闪避成功" },
        onFail: { next: null, effect: "dodge_fail", damage: 0, damageMul: 0.6, message: "翻滚受身" }
      }
    ]
  },

  parry: {
    key: "SPACE",
    name: "弹反",
    description: "弹反敌人攻击并触发处决",
    color: "#f1c40f",
    family: "defense",
    role: "counter",
    visual: "parrySpark",
    tags: ["defense", "parry", "counter"],
    nodes: [
      {
        id: "parry",
        name: "弹反",
        duration: 0.45,
        input: { type: "press", key: "SPACE" },
        window: { start: 0.12, end: 0.30 },
        perfect: 0.21,
        onPerfect: { next: null, effect: "parry_perfect", damage: 35, stunEnemy: 1.5, damageMul: 0, message: "完美弹反！" },
        onSuccess: { next: null, effect: "parry", damage: 24, stunEnemy: 0.8, damageMul: 0, message: "弹反成功" },
        onFail: { next: null, effect: "parry_fail", damage: 0, damageMul: 0.5, message: "弹反失败" }
      }
    ]
  },

  guard: {
    key: "F",
    name: "格挡",
    description: "举盾格挡并发动盾反",
    color: "#95a5a6",
    family: "defense",
    role: "guard",
    visual: "guardImpact",
    tags: ["defense", "shield", "counter"],
    nodes: [
      {
        id: "guard",
        name: "架盾",
        duration: 0.8,
        input: { type: "press", key: "F" },
        window: { start: 0.30, end: 0.70 },
        perfect: 0.50,
        onPerfect: { next: null, effect: "guard_perfect", damage: 25, staminaCost: 10, damageMul: 0, stunEnemy: 1.2, message: "完美格挡！" },
        onSuccess: { next: null, effect: "guard", damage: 0, staminaCost: 15, damageMul: 0, message: "格挡成功" },
        onEarly: { next: null, effect: "guard_early", damage: 0, damageMul: 0.3, message: "格挡过早" },
        onLate: { next: null, effect: "guard_late", damage: 0, damageMul: 0.5, message: "格挡过晚" }
      }
    ]
  }
};
