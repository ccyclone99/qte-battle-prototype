// 战斗风格（替代旧武器选择，每个风格对应一套底层武器+咒术+战技组合）
const StyleDatabase = {
  fire: {
    key: "1",
    number: "001",
    name: "烈火重重",
    description: "使你可以使用火焰法术，在短暂蓄力后即可释放火球；蓄力越久，火球越庞大。",
    icon: "火",
    color: "#e74c3c",
    weapon: "staff",
    spells: ["fire"],
    combatArts: [],
    preferredEnemy: "shielded"
  },

  absorb: {
    key: "2",
    number: "002",
    name: "咒还",
    description: "使你在蓄力、持盾、用剑攻击时可以吸收敌人的法术攻击并还击；使用法杖时更能急速积蓄法术能量。",
    icon: "咒",
    color: "#9b59b6",
    weapon: "staff",
    spells: ["absorb"],
    combatArts: [],
    preferredEnemy: "caster"
  },

  desslo: {
    key: "3",
    number: "001",
    name: "德斯洛大陆剑术",
    description: "使你可以随时发动攻击，时机正确时必然暴击；能看穿敌人攻击，在施法或持盾招架时仍可闪避。",
    icon: "德",
    color: "#3498db",
    weapon: "dualBlades",
    spells: [],
    combatArts: ["desslo"],
    preferredEnemy: "swift"
  },

  eastern: {
    key: "4",
    number: "008",
    name: "东方诸国剑术",
    description: "持盾招架时可全方位闪避，连续闪避后必定暴击；出剑之后的格挡可在短时间内化解敌人的所有攻击。",
    icon: "东",
    color: "#2ecc71",
    weapon: "greatsword",
    spells: [],
    combatArts: ["eastern"],
    preferredEnemy: "armored"
  },

  desolo: {
    key: "5",
    number: "097",
    name: "荒芜之地的剑术",
    description: "使你可以随时发动攻击，攻击后还能追加攻击；追加攻击化解敌人进攻时会暴击并打断，施法时也可招架、咒还。",
    icon: "荒",
    color: "#f1c40f",
    weapon: "greatsword",
    spells: [],
    combatArts: ["desolo"],
    preferredEnemy: "armored"
  },

  flameforge: {
    key: "6",
    number: "021",
    name: "火铸大剑",
    description: "以大剑承载烈火重重，A 进入焰刃熔甲链，格挡可触发盾焰反冲；热量越高，火系爆发越强。",
    icon: "熔",
    color: "#e67e22",
    weapon: "greatsword",
    spells: ["fire"],
    combatArts: [],
    preferredEnemy: "armored"
  },

  mirrorblade: {
    key: "7",
    number: "022",
    name: "镜咒双刃",
    description: "以双刀接入咒还，S 主动引流，D 消耗法术能量打出溢流爆发；防御时可展开镜咒折返。",
    icon: "镜",
    color: "#8e44ad",
    weapon: "dualBlades",
    spells: ["absorb"],
    combatArts: [],
    preferredEnemy: "caster"
  }
};
