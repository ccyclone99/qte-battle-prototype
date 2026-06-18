const SpellDatabase = {
  fire: {
    id: "fire",
    number: "001",
    name: "烈火重重",
    description: "使你可以使用火焰法术，在短暂蓄力后，即可释放一枚火球，随着蓄力的时长，可以让火球进化得更加庞大。",
    icon: "火",
    color: "#e74c3c",
    // 剑：对防御状态敌人增伤，累计命中破甲
    swordVsGuardBonus: 0.5,
    armorBreakHits: 3,
    armorBreakDamageBonus: 0.3,
    armorBreakTurns: 3,
    // 盾：敌人命中时受到火焰反伤
    shieldThornDamage: 8,
    shieldThornMessage: "火焰反伤！",
    // 法杖 A 链覆盖为火球进化链
    chainOverrides: {
      staff: {
        A: {
          name: "火球术·进化",
          description: "蓄力越久，火球越大",
          color: "#e74c3c",
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
        }
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
    staffOverflowMessage: "法术能量过载！",
    // 盾：附魔后增加积蓄速度，完美格挡反射魔法
    shieldEnchantSpeed: 0.5,
    shieldReflectMul: 1.0,
    shieldEnchantMessage: "盾牌咒还附魔",
    // 杖基础效果
    staffBaseReflect: true
  }
};
