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
node scripts/validate-data.js
node scripts/check-timing.js
node scripts/check-balance.js
node scripts/smoke-checklist.js
node scripts/flow-smoke.js
node scripts/visual-smoke.js
Get-ChildItem -Path .\js,.\scripts -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
node --check .\server.js
node --check .\save_screenshot.js
```

`visual-smoke.js` 会自动启动本地服务和 Chrome/Edge，截图产物写入 `tmp/visual-smoke/`。

## 开局配置

进入战斗前需要选择：

1. **武器**：大剑 / 法杖 / 双刀
2. **咒术（可多选）**：烈火重重 / 咒还
3. **战技（可多选）**：德斯洛大陆剑术 / 东方诸国剑术 / 荒芜之地剑术

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
- [x] 闪避、格挡、弹反及后续反击/眩晕 QTE 链
- [x] 咒术：烈火重重（火球进化/剑破甲/盾火反）
- [x] 咒术：咒还（法术吸收/能量溢出/盾附魔反射）
- [x] 战技：德斯洛大陆剑术（随时攻击/Perfect暴击/施法闪避）
- [x] 战技：东方诸国剑术（格挡中闪避/连闪必暴/出剑化解）
- [x] 战技：荒芜之地剑术（追加攻击/打断/施法招架）
- [x] 法术能量、破甲、连续闪避等状态显示
- [x] 伤害数字、屏幕震动、命中停顿

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
