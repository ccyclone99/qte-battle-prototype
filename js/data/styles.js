// 当前仅保留一个不可见的默认战斗方案；用户侧不再暴露 1-8 风格选择。
const StyleDatabase = {
  current: {
    key: "",
    number: "",
    name: "反制战斗方案",
    description: "敌方回合内逐节点拼刀或打断施法；双持依靠更短恢复连续应对快攻链，应对关键节点成功后进入追击窗口，才可触发武器 QTE 暴击。",
    icon: "反",
    color: "#16a085",
    weapon: "dualBlades",
    spells: [],
    combatArts: [],
    preferredEnemy: "caster",
    preferredEncounter: "counter_tutorial",
    actionBarMax: 3.35,
    manualQteCrit: true,
    counterCrit: true,
    autoAttackNoBonus: true,
    counterFlow: {
      enabled: true,
      postureToFollowup: 36,
      allowWeaponKeys: true,
      openFollowupOnSpellInterrupt: true
    }
  }
};
