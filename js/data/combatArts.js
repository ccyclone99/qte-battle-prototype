const CombatArtDatabase = {
  desslo: {
    id: "desslo",
    number: "001",
    name: "德斯洛大陆剑术",
    description: "使你可以随时发动攻击，当攻击时机正确时，必然暴击。同时，你可以看穿敌人的攻击：使在施法时，可以进行闪避；使你在持盾招架时，仍然可以进行左右方向的闪避。",
    icon: "德",
    color: "#3498db",
    attackAnytime: true
  },

  eastern: {
    id: "eastern",
    number: "008",
    name: "东方诸国剑术",
    description: "使你在持盾招架时，可以进行全方位的闪避。连续闪避后，必定暴击。更容易格挡敌人的攻击，同时，你出剑之后的格挡，一定时间内会化解敌人的所有攻击。",
    icon: "东",
    color: "#2ecc71",
    consecutiveDodgeCrit: 2,
    guardWindowBonus: 0.06,
    attackGuardNeutralize: 1.5,
    attackGuardMessage: "化解！"
  },

  desolo: {
    id: "desolo",
    number: "097",
    name: "荒芜之地的剑术",
    description: "使你可以随时发动攻击，在攻击后，还可以进行一次追加攻击，如果你的追加攻击化解了敌人的任何进攻，必然暴击，并且打断敌人的进攻。同时，你在施法时，还可以附带招架、咒还。",
    icon: "荒",
    color: "#f1c40f",
    attackAnytime: true,
    followUpMessage: "追加攻击化解并打断！",
    // 追加攻击链映射：所有武器的追加链
    followUpChains: {
      greatsword: "followup_greatsword",
      dualBlades: "followup_dualblades",
      staff: "followup_staff"
    }
  }
};
