const DefenseDatabase = {
  dodge: {
    key: "SPACE",
    name: "闪避",
    color: "#3498db",
    stanceType: "press",
    nodes: [
      {
        id: "dodge",
        name: "闪身",
        duration: 0.6,
        input: { type: "press", key: "SPACE" },
        window: { start: 0.20, end: 0.50 },
        perfect: 0.35,
        onPerfect: { next: "counter", effect: "dodge_perfect", damage: 0, iframe: 0.4, message: "完美闪避！可追击" },
        onSuccess: { next: null, effect: "dodge", damage: 0, iframe: 0.3, message: "闪避成功" },
        onFail: { next: null, effect: "dodge_fail", damage: 0, damageMul: 0.6, message: "翻滚受身" }
      },
      {
        id: "counter",
        name: "追击",
        duration: 0.5,
        input: { type: "press", key: "A" },
        window: { start: 0.18, end: 0.42 },
        perfect: 0.30,
        onPerfect: { next: null, effect: "counter_perfect", damage: 22, stunEnemy: 1.0, message: "闪避反击！敌人眩晕" },
        onSuccess: { next: null, effect: "counter", damage: 15, message: "反击命中" },
        onFail: { next: null, effect: "counter_fail", damage: 0, message: "反击落空" }
      }
    ]
  },

  parry: {
    key: "SPACE",
    name: "弹反",
    color: "#f1c40f",
    stanceType: "press",
    nodes: [
      {
        id: "parry",
        name: "弹反",
        duration: 0.45,
        input: { type: "press", key: "SPACE" },
        window: { start: 0.12, end: 0.30 },
        perfect: 0.21,
        onPerfect: { next: "riposte", effect: "parry_perfect", damage: 0, stunEnemy: 1.5, damageMul: 0, message: "完美弹反！" },
        onSuccess: { next: "riposte", effect: "parry", damage: 0, stunEnemy: 0.8, damageMul: 0, message: "弹反成功" },
        onFail: { next: null, effect: "parry_fail", damage: 0, damageMul: 0.5, message: "弹反失败" }
      },
      {
        id: "riposte",
        name: "追击",
        duration: 0.5,
        input: { type: "press", key: "A" },
        window: { start: 0.18, end: 0.42 },
        perfect: 0.30,
        onPerfect: { next: null, effect: "riposte_perfect", damage: 35, message: "处决一击！" },
        onSuccess: { next: null, effect: "riposte", damage: 24, message: "反击命中" },
        onFail: { next: null, effect: "riposte_fail", damage: 5, message: "追击失误" }
      }
    ]
  },

  guard: {
    key: "F",
    name: "格挡",
    color: "#95a5a6",
    stanceType: "hold",
    nodes: [
      {
        id: "guard",
        name: "架盾",
        duration: 1.0,
        input: { type: "hold_release", key: "F" },
        window: { start: 0.40, end: 0.90 },
        perfect: 0.65,
        onPerfect: { next: "guard_counter", effect: "guard_perfect", damage: 0, staminaCost: 10, message: "完美格挡！" },
        onSuccess: { next: null, effect: "guard", damage: 0, staminaCost: 15, damageMul: 0, message: "格挡成功" },
        onEarly: { next: null, effect: "guard_early", damage: 0, damageMul: 0.3, message: "格挡过早" },
        onLate: { next: null, effect: "guard_late", damage: 0, damageMul: 0.5, message: "格挡过晚" }
      },
      {
        id: "guard_counter",
        name: "盾反",
        duration: 0.5,
        input: { type: "press", key: "A" },
        window: { start: 0.18, end: 0.42 },
        perfect: 0.30,
        onPerfect: { next: null, effect: "shield_bash_perfect", damage: 25, stunEnemy: 1.2, message: "盾反猛击！" },
        onSuccess: { next: null, effect: "shield_bash", damage: 16, message: "盾反命中" },
        onFail: { next: null, effect: "shield_bash_fail", damage: 0, message: "盾反落空" }
      }
    ]
  }
};
