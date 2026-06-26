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
node scripts/verify.js
```

`verify.js` 本地默认会运行数据、时机、平衡、静态 smoke、流程 smoke、JS 语法检查和视觉截图 smoke。

常用变体：

```powershell
node scripts/verify.js --skip-visual
node scripts/verify.js --visual
```

`visual-smoke.js` 会自动启动本地服务和 Chrome/Edge，截图产物写入 `tmp/visual-smoke/`。人工体验检查见 `docs/manual-playtest-checklist.md`。

## 开局配置

主菜单先选择：

1. **难度**：简单 / 普通 / 困难 / 极难
2. **敌人匹配**：默认按战斗风格自动匹配，也可以手动固定敌人原型用于测试

进入战斗后按 `1-7` 选择战斗风格。每个风格会绑定一套武器、咒术和战技组合。

## 操作说明

| 阶段 | 按键 |
|---|---|
| 开局选择 | `A/S/D` 选武器，`1/2` 选咒术，`1/2/3` 选战技，空格确认 |
| 我方回合 | `A/S/D` 触发对应 QTE 链 |
| 敌方回合 | `SPACE` 闪避/弹反，`F` 格挡，战技允许时 `A/S/D` 反击 |

## 已实现特性

- [x] 主行动条 + 暂停/插入式子 QTE 条
- [x] 三把武器，每把 3 条独立 QTE 链
- [x] 多段攻击、蓄力、节奏吟唱、终结技
- [x] 敌方回合预警与响应窗口
- [x] 手动敌人匹配选择（基础 / 咏唱 / 重甲 / 迅捷 / 持盾）
- [x] 闪避、格挡、弹反及后续反击/眩晕 QTE 链
- [x] 咒术：烈火重重（火球进化/剑破甲/盾火反）
- [x] 咒术：咒还（法术吸收/能量溢出/盾附魔反射）
- [x] 战技：德斯洛大陆剑术（随时攻击/Perfect暴击/施法闪避）
- [x] 战技：东方诸国剑术（格挡中闪避/连闪必暴/出剑化解）
- [x] 战技：荒芜之地剑术（追加攻击/打断/施法招架）
- [x] 法术能量、破甲、连续闪避等状态显示
- [x] 伤害数字、屏幕震动、命中停顿
- [x] 关键 QTE 节点数据化姿态标签（武器链 / 咒术链动作差异）
- [x] 一键本地验收和 GitHub Actions 基础 CI
- [x] R12 手感标定、演示导演焦点和武器/咒术协同反馈

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
        └── enemies.js   // 敌人攻击配置
```
