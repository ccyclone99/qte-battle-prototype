const CombatArtDatabase = {
  desslo: {
    id: "desslo",
    number: "001",
    name: "德斯洛大陆剑术",
    description: "使你可以随时发动攻击，当攻击时机正确时，必然暴击。同时，你可以看穿敌人的攻击：使在施法时，可以进行闪避；使你在持盾招架时，仍然可以进行左右方向的闪避。",
    icon: "德",
    color: "#3498db",
    attackAnytime: true,
    perfectCrit: true,
    dodgeWhileCasting: true,
    dodgeWhileGuarding: true
  },

  eastern: {
    id: "eastern",
    number: "008",
    name: "东方诸国剑术",
    description: "使你在持盾招架时，可以进行全方位的闪避。连续闪避后，必定暴击。更容易格挡敌人的攻击，同时，你出剑之后的格挡，一定时间内会化解敌人的所有攻击。",
    icon: "东",
    color: "#2ecc71",
    dodgeWhileGuarding: true,
    omnidirectionalDodge: true,
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
    followUpAttack: true,
    followUpInterrupt: true,
    followUpMessage: "追加攻击化解并打断！",
    parryWhileCasting: true,
    absorbWhileCasting: true,
    // 追加攻击链覆盖：所有武器的 A 链追加
    chainOverrides: {
      greatsword: {
        followUp: {
          name: "荒芜追击",
          description: "追加攻击，化解敌人进攻则暴击打断",
          color: "#f1c40f",
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
        }
      },
      dualBlades: {
        followUp: {
          name: "荒芜追击",
          description: "追加攻击，化解敌人进攻则暴击打断",
          color: "#f1c40f",
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
        }
      },
      staff: {
        followUp: {
          name: "荒芜法术追击",
          description: "追加法术攻击",
          color: "#f1c40f",
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
        }
      }
    }
  }
};
