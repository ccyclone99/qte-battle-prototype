// 当前仅保留一个不可见的默认战斗方案；用户侧不再暴露 1-8 风格选择。
const StyleDatabase = {
  current: {
    key: "",
    number: "",
    name: "反制战斗方案",
    description: "敌方回合内出刀拼刀或打断施法；双持用连续判定覆盖多段，应对成功后进入追击窗口，才可触发武器 QTE 暴击。",
    icon: "反",
    color: "#16a085",
    weapon: "dualBlades",
    spells: [],
    combatArts: [],
    preferredEnemy: "caster",
    preferredEncounter: "counter_dojo",
    actionBarMax: 3.35,
    manualQteCrit: true,
    counterCrit: true,
    autoAttackNoBonus: true,
    counterCoverage: {
      dualBlades: 3,
      greatsword: 1,
      staff: 1,
      default: 1
    }
  }
};
