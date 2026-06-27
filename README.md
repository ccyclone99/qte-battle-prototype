# QTE 战斗系统原型

一个基于 HTML5 Canvas 的回合制 QTE 战斗原型，核心机制是「主行动条 + 插入式子 QTE 链 + Build 配置」。

## 在线试玩

**https://ccyclone99.github.io/qte-battle-prototype/**

## 本地运行

直接用浏览器打开 `index.html` 即可，无需构建工具。

或者使用本地服务器：

```bash
node server.js
# 然后访问 http://localhost:8765
```

## 本地验证

```powershell
node scripts/verify.js --skip-visual
```

当前演示系统冻结，常规验收先跑数据、时机、平衡、静态 smoke、流程 smoke 和 JS 语法检查。

常用变体：

```powershell
node scripts/verify.js --skip-visual
node scripts/verify.js --visual
```

`visual-smoke.js` 仍保留在仓库中，但 demo 入口冻结期间不作为默认验收目标。人工体验检查见 `docs/manual-playtest-checklist.md`。

## 开局配置

主菜单先选择：

1. **难度**：简单 / 普通 / 困难 / 极难
2. **遭遇**：默认进入反制试炼，也可以指定命名遭遇或固定敌人原型用于测试

当前版本移除公开的 `1-8` 战斗风格选择，只保留一个敌方回合反制方案。开始战斗后会直接进入敌方回合，第一手就是反制/防御判断。

## 操作说明

| 阶段 | 按键 |
|---|---|
| 敌方回合 | 敌人攻击窗口内 `A/S/D` 拼刀；敌人施法窗口内 `A/S/D` 打断施法 |
| 追击窗口 | 敌方回合应对成功后，`A/S/D` 触发武器 QTE；不输入则自动攻击 |
| 防御 | `SPACE` 闪避/弹反，`F` 格挡 |

## 已实现特性

- [x] 主行动条 + 暂停/插入式子 QTE 条
- [x] 三把武器，每把 3 条独立 QTE 链
- [x] 多段攻击、蓄力、节奏吟唱、终结技
- [x] 敌方回合预警与响应窗口
- [x] 手动敌人匹配选择（基础 / 咏唱 / 重甲 / 迅捷 / 持盾）
- [x] 闪避、格挡、弹反及后续反击/眩晕 QTE 链
- [x] 公开风格系统暂时移除，仅保留敌方回合反制方案
- [x] 敌方攻击窗口内出刀拼刀，敌方施法窗口内出刀打断
- [x] 逆势试炼会轮换物理三连、法术双斩、盾压咒击、虚刺重砸和咒爆追刺
- [x] 双持反制覆盖多段敌方动作；武器 QTE 只在应对成功后的追击窗口触发
- [x] 法术能量、破甲、连续闪避等状态显示
- [x] 伤害数字、屏幕震动、命中停顿
- [x] 关键 QTE 节点数据化姿态标签（武器链 / 咒术链动作差异）
- [x] 一键本地验收和 GitHub Actions 基础 CI
- [x] R12 手感标定和武器/咒术协同反馈
- [x] R13 命名遭遇和遭遇规则修正
- [x] R51 单一反制方案、敌方多段攻势、双持覆盖帧、演示入口冻结

## 文件结构

```
.
├── index.html
├── style.css
├── server.js          // 本地 HTTP 服务器（可选）
└── js/
    ├── main.js          // 游戏循环与入口
    ├── battle.js        // 战斗状态机
    ├── qte-runner.js    // QTE 链执行器
    ├── input.js         // 输入缓冲
    ├── renderer.js      // Canvas 渲染
    ├── utils.js         // 工具函数
    └── data/
        ├── weapons.js   // 武器 QTE 链配置
        ├── spells.js    // 咒术配置
        ├── combatArts.js// 战技配置
        ├── defenses.js  // 防御 QTE 链配置
        ├── enemies.js   // 敌人攻击配置
        └── encounters.js// 命名遭遇配置
```
