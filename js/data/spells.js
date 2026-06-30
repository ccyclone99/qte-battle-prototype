const SpellDatabase = {
  fire: {
    id: "fire",
    number: "001",
    name: "烈火重重",
    description: "使你可以使用火焰法术，在短暂蓄力后，即可释放一枚火球，随着蓄力的时长，可以让火球进化得更加庞大。",
    icon: "火",
    color: "#e74c3c",
    // 剑：累计命中破甲
    armorBreakHits: 3,
    armorBreakDamageBonus: 0.3,
    armorBreakTurns: 3,
    heatDamageBonusPerPoint: 0.003,
    overheatThreshold: 85,
    heatTurnDecay: 8,
    heatPolicy: "turnBoundaryDecay",
    burnPolicy: "turnStartDot",
    // 盾：敌人命中时受到火焰反伤
    shieldThornDamage: 8,
    shieldThornMessage: "火焰反伤！",
    // 法杖 A 链映射为火球进化链
    chainMap: {
      staff: {
        A: "fireball_evolution_v2"
      },
      greatsword: {
        A: "flame_blade"
      },
      dualBlades: {
        A: "flame_blade"
      }
    }
  },

  absorb: {
    id: "absorb",
    number: "002",
    name: "咒还",
    description: "使你在蓄力、持盾、使用剑攻击时，可以吸收敌人的法术攻击并且还击。",
    icon: "咒",
    color: "#9b59b6",
    // 可吸收法术的状态
    absorbStates: ["charge", "shield", "swordAttack"],
    // 杖：吸收转化为法术能量，可突破上限
    staffOverflowMul: 1.5,
    staffOverflowDecay: 8,
    overflowCostPolicy: "fixed",
    staffOverflowMessage: "法术能量过载！",
    // 盾：完美格挡/弹反时反射魔法
    shieldReflectMul: 1.0,
    shieldEnchantMessage: "盾牌咒还附魔",
    // 杖基础效果
    staffBaseReflect: true,
    // 法杖 S 链映射为主动引流链
    chainMap: {
      staff: {
        S: "absorb_siphon",
        D: "overflow_burst"
      },
      greatsword: {
        D: "overflow_burst"
      },
      dualBlades: {
        S: "absorb_siphon",
        D: "overflow_burst"
      }
    }
  }
};
