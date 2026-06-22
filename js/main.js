const canvas = document.getElementById("game-canvas");
const input = new InputBuffer();
const renderer = new CanvasRenderer(canvas);

const topBar = document.getElementById("top-bar");
const playerHpFill = document.getElementById("player-hp-fill");
const playerHpText = document.getElementById("player-hp-text");
const enemyHpFill = document.getElementById("enemy-hp-fill");
const enemyHpText = document.getElementById("enemy-hp-text");
const turnIndicator = document.getElementById("turn-indicator");
const difficultyBadge = document.getElementById("difficulty-badge");

const mainMenu = document.getElementById("main-menu");
const btnStart = document.getElementById("btn-start");
const btnPractice = document.getElementById("btn-practice");
const btnDemo = document.getElementById("btn-demo");
const btnMenu = document.getElementById("btn-menu");
const difficultySelect = document.getElementById("difficulty-select");

const gameOverOverlay = document.getElementById("game-over");
const gameOverTitle = document.getElementById("game-over-title");
const gameOverSubtitle = document.getElementById("game-over-subtitle");
const btnRestart = document.getElementById("btn-restart");
const btnBackMenu = document.getElementById("btn-back-menu");

const helpDrawer = document.getElementById("help-drawer");
const logDrawer = document.getElementById("log-drawer");
const demoDetailDrawer = document.getElementById("demo-detail-drawer");
const helpContent = document.getElementById("help-content");
const logContent = document.getElementById("log-content");
const demoDetailContent = document.getElementById("demo-detail-content");
const touchControls = document.getElementById("touch-controls");
const touchToggle = document.getElementById("touch-toggle");

const battleHelpHtml = `
  <div><b>开局</b>：按 1-5 选择战斗风格</div>
  <div><b>我方回合</b>：按 A/S/D 触发对应 QTE 链</div>
  <div><b>敌方回合</b>：按 SPACE 闪避/弹反，F 格挡</div>
  <div><b>通用</b>：H 帮助，L 日志，ESC 返回菜单</div>
`;

const demoHelpMain = `
  <div><b>1-4</b> 选择演示分类</div>
  <div><b>W / 5</b> 切换战斗风格</div>
  <div><b>M</b> 切换手动/自动</div>
  <div><b>6</b> 切换难度</div>
  <div><b>ESC</b> 返回主菜单</div>
`;

const demoHelpList = `
  <div><b>数字</b> 选择条目</div>
  <div><b>A / ←</b> 上一页</div>
  <div><b>D / →</b> 下一页</div>
  <div><b>M</b> 切换手动/自动</div>
  <div><b>ESC</b> 返回分类</div>
`;

const demoHelpEnemyWindup = `
  <div>观察敌人攻击条推进</div>
  <div>绿色窗口 = 可输入时机</div>
  <div>命中后进入 QTE 再按键</div>
  <div><b>M</b> 切换手动/自动</div>
  <div><b>ESC</b> 返回列表</div>
`;

const demoHelpQTE = `
  <div>按 QTE 提示按键</div>
  <div>绿色窗口内判定有效</div>
  <div>金色竖线 = Perfect 点</div>
  <div><b>M</b> 切换手动/自动</div>
  <div><b>ESC</b> 返回列表</div>
`;

const demoHelpPreview = `
  <div>查看特效与结算</div>
  <div><b>任意键</b> 返回列表</div>
  <div><b>ESC</b> 返回列表</div>
`;

let appState = "menu";
let battle = null;
let demo = null;
let lastTime = performance.now();

function logClassFor(msg) {
  const text = String(msg);
  if (text.includes("胜利")) return "log-victory";
  if (text.includes("战败") || text.includes("失败")) return "log-defeat";
  if (text.includes("玩家受到") || text.includes("被击中")) return "log-damage";
  if (text.includes("敌人受到") || text.includes("击败")) return "log-damage-enemy";
  if (text.includes("能量") || text.includes("治疗") || text.includes("恢复")) return "log-heal";
  if (text.includes("眩晕") || text.includes("破甲") || text.includes("附魔") || text.includes("闪避") || text.includes("弹反") || text.includes("格挡")) return "log-status";
  if (text.includes("开始") || text.includes("进入") || text.includes("返回")) return "log-system";
  return "";
}

// DOM 更新缓存：只在上次值变化时写入
const uiCache = {
  playerHp: -1,
  playerMaxHp: -1,
  enemyHp: -1,
  enemyMaxHp: -1,
  turnText: "",
  turnClass: "",
  difficulty: "",
  helpHtml: "",
  demoDetailHtml: ""
};

function addLog(msg) {
  const entry = document.createElement("div");
  const cls = logClassFor(msg);
  entry.className = `log-entry log-latest ${cls}`;
  entry.textContent = msg;

  for (const child of logContent.children) {
    child.classList.remove("log-latest");
  }

  logContent.prepend(entry);
  while (logContent.children.length > 20) {
    logContent.removeChild(logContent.lastChild);
  }
}

function clearLog() {
  logContent.innerHTML = "";
}

function setHpUI(fillEl, textEl, hp, maxHp, cachePrefix) {
  const hpKey = `${cachePrefix}Hp`;
  const maxKey = `${cachePrefix}MaxHp`;
  if (uiCache[hpKey] === hp && uiCache[maxKey] === maxHp) return;
  fillEl.style.width = `${(hp / maxHp) * 100}%`;
  textEl.textContent = `${hp}/${maxHp}`;
  uiCache[hpKey] = hp;
  uiCache[maxKey] = maxHp;
}

function setTurnIndicator(text, cls) {
  if (uiCache.turnText !== text) {
    turnIndicator.textContent = text;
    uiCache.turnText = text;
  }
  const fullClass = "turn-pill " + cls;
  if (uiCache.turnClass !== fullClass) {
    turnIndicator.className = fullClass;
    uiCache.turnClass = fullClass;
  }
}

function setDifficultyBadge(name) {
  if (uiCache.difficulty === name) return;
  difficultyBadge.textContent = name;
  uiCache.difficulty = name;
}

function setHelpContent(html) {
  if (uiCache.helpHtml === html) return;
  helpContent.innerHTML = html;
  uiCache.helpHtml = html;
}

function setDemoDetailHtml(html) {
  if (uiCache.demoDetailHtml === html) return;
  demoDetailContent.innerHTML = html;
  uiCache.demoDetailHtml = html;
}

function resetUICache() {
  uiCache.playerHp = -1;
  uiCache.playerMaxHp = -1;
  uiCache.enemyHp = -1;
  uiCache.enemyMaxHp = -1;
  uiCache.turnText = "";
  uiCache.turnClass = "";
  uiCache.difficulty = "";
  uiCache.helpHtml = "";
  uiCache.demoDetailHtml = "";
}

function setTopBarVisible(visible) {
  topBar.style.display = visible ? "flex" : "none";
}

function hideAllDrawers() {
  helpDrawer.classList.add("hidden");
  logDrawer.classList.add("hidden");
  demoDetailDrawer.classList.add("hidden");
}

function toggleDrawer(drawer) {
  drawer.classList.toggle("hidden");
}

function showMenu() {
  appState = "menu";
  mainMenu.style.display = "flex";
  gameOverOverlay.style.display = "none";
  setTopBarVisible(false);
  hideAllDrawers();
  input.clear();
  resetUICache();
}

function startBattle() {
  SFX.enable();
  input.clear();
  Difficulty.set(difficultySelect.value);
  battle = new BattleSystem(input, { practiceMode: false });
  battle.onLog = addLog;
  demo = null;
  appState = "battle";
  mainMenu.style.display = "none";
  gameOverOverlay.style.display = "none";
  setTopBarVisible(true);
  hideAllDrawers();
  clearLog();
  resetUICache();
  addLog(`战斗开始 — 难度：${Difficulty.get().name}`);
  setHelpContent(battleHelpHtml);
}

function startPractice() {
  SFX.enable();
  input.clear();
  Difficulty.set(difficultySelect.value);
  battle = new BattleSystem(input, { practiceMode: true });
  battle.onLog = addLog;
  demo = null;
  appState = "battle";
  mainMenu.style.display = "none";
  gameOverOverlay.style.display = "none";
  setTopBarVisible(true);
  hideAllDrawers();
  clearLog();
  resetUICache();
  addLog(`练习模式开始 — 敌人无限血量`);
  setHelpContent(battleHelpHtml);
}

function showGameOver(won, isPractice) {
  gameOverTitle.textContent = isPractice ? "练习结束" : (won ? "胜利" : "战败");
  gameOverSubtitle.textContent = isPractice
    ? "敌人无限血量，继续挑战或返回菜单"
    : (won ? "敌人已被击败" : "玩家生命值耗尽");
  btnRestart.textContent = isPractice ? "继续练习" : "再来一局";
  gameOverOverlay.style.display = "flex";
}

function hideGameOver() {
  gameOverOverlay.style.display = "none";
}

function restartCurrentMode() {
  if (battle && battle.practiceMode) {
    startPractice();
  } else {
    startBattle();
  }
}

function startDemo() {
  SFX.enable();
  input.clear();
  demo = new DemoMode(input, addLog);
  battle = null;
  appState = "demo";
  mainMenu.style.display = "none";
  gameOverOverlay.style.display = "none";
  setTopBarVisible(true);
  hideAllDrawers();
  clearLog();
  resetUICache();
  addLog("进入效果演示模式 — 按 W 切换风格，1-4 选择分类");
  setHelpContent(demoHelpMain);
}

function updateBattleUI() {
  if (!battle) return;

  setHpUI(playerHpFill, playerHpText, battle.playerHp, battle.playerMaxHp, "player");
  setHpUI(enemyHpFill, enemyHpText, battle.enemyHp, battle.enemyMaxHp, "enemy");

  let turnText = "";
  let turnClass = "";
  let helpHtml = "";
  if (battle.turnState.startsWith("select_")) {
    turnText = "战前准备";
    turnClass = "prep";
    helpHtml = battleHelpHtml;
  } else if (battle.turnState === "player_turn") {
    turnText = "玩家回合";
    turnClass = "player";
    helpHtml = `<div><b>A/S/D</b> 触发对应 QTE 链</div><div><b>H</b> 帮助 <b>L</b> 日志</div>`;
  } else if (battle.turnState === "enemy_turn") {
    turnText = "敌方回合";
    turnClass = "enemy";
    helpHtml = `<div><b>SPACE</b> 闪避/弹反</div><div><b>F</b> 格挡</div><div><b>H</b> 帮助</div>`;
  } else if (battle.turnState === "qte_running") {
    turnText = "QTE";
    turnClass = "qte";
    helpHtml = `<div>在判定窗口内按下对应按键</div><div><b>H</b> 帮助</div>`;
  } else if (battle.turnState === "resolving") {
    turnText = "结算中";
    turnClass = "prep";
  } else if (battle.turnState === "game_over") {
    turnText = "战斗结束";
    turnClass = "prep";
  }

  setTurnIndicator(turnText, turnClass);
  setDifficultyBadge(`${Difficulty.get().name}${battle.practiceMode ? " · 练习" : ""}`);
  if (helpHtml) setHelpContent(helpHtml);

  if (battle.turnState === "game_over") {
    const won = battle.enemyHp <= 0;
    showGameOver(won, battle.practiceMode);
  }
}

function updateDemoUI() {
  if (!demo) return;

  setHpUI(playerHpFill, playerHpText, demo.playerHp, demo.playerMaxHp, "player");
  setHpUI(enemyHpFill, enemyHpText, demo.enemyHp, demo.enemyMaxHp, "enemy");

  let turnText = "演示";
  let helpHtml = demoHelpMain;
  if (demo.state === "main") {
    turnText = "演示 - 主菜单";
    helpHtml = demoHelpMain;
  } else if (demo.state === "list") {
    turnText = `演示 - ${demo.getCategoryName()}`;
    helpHtml = demoHelpList;
  } else if (demo.state === "enemy_windup") {
    turnText = "演示 - 敌方预警";
    helpHtml = demoHelpEnemyWindup;
  } else if (demo.state === "qte") {
    turnText = "演示 - QTE";
    helpHtml = demoHelpQTE;
  } else if (demo.state === "preview") {
    turnText = "演示 - 结算";
    helpHtml = demoHelpPreview;
  }

  setTurnIndicator(turnText, "demo");
  setDifficultyBadge(Difficulty.get().name);
  setHelpContent(helpHtml);

  // 演示详情内容
  const parts = [];
  if (demo.previewTitle) {
    parts.push(`<div style="color:#fff;font-weight:700;margin-bottom:6px">${demo.previewTitle}</div>`);
  }
  if (demo.detailLines && demo.detailLines.length > 0) {
    for (const line of demo.detailLines.slice(0, 10)) {
      parts.push(`<div>${line}</div>`);
    }
  }
  if (demo.state === "qte" && demo.getQTEInspectorLines) {
    parts.push(`<div style="color:#f1c40f;margin-top:8px;font-weight:700">播放状态</div>`);
    for (const line of demo.getQTEInspectorLines().slice(0, 8)) {
      parts.push(`<div>${line}</div>`);
    }
  }
  if (demo.resultLines && demo.resultLines.length > 0) {
    parts.push(`<div style="color:#f1c40f;margin-top:8px;font-weight:700">结算</div>`);
    for (const line of demo.resultLines.slice(0, 8)) {
      parts.push(`<div>${line}</div>`);
    }
  }
  if (demo.state === "main" || demo.state === "list") {
    parts.push(`<div style="color:#f1c40f;margin-top:8px;font-weight:700">当前风格</div>`);
    const style = demo.currentStyle ? demo.currentStyle() : null;
    parts.push(`<div>${style ? style.name : "无"}</div>`);
    parts.push(`<div>模式：${demo.manualMode ? "手动试玩" : "自动慢放"}</div>`);
  }

  setDemoDetailHtml(parts.join(""));
}

function updateUI() {
  if (appState === "battle" && battle) {
    updateBattleUI();
  } else if (appState === "demo" && demo) {
    updateDemoUI();
  } else if (appState === "menu") {
    setHpUI(playerHpFill, playerHpText, 100, 100, "player");
    setHpUI(enemyHpFill, enemyHpText, 200, 200, "enemy");
    setTurnIndicator("主菜单", "prep");
    setDifficultyBadge(Difficulty.get().name);
  }
}

function currentScene() {
  if (appState === "battle") return battle;
  if (appState === "demo") return demo;
  return null;
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (appState === "battle" && battle) {
    battle.update(dt);
  } else if (appState === "demo" && demo) {
    demo.update(dt);
    if (demo.returnToMenu) {
      demo.returnToMenu = false;
      showMenu();
    }
  }

  const scene = currentScene();
  if (scene) {
    renderer.render(scene);
  } else {
    renderer.renderBlank();
  }

  updateUI();

  requestAnimationFrame(loop);
}

btnStart.addEventListener("click", startBattle);
btnPractice.addEventListener("click", startPractice);
btnDemo.addEventListener("click", startDemo);
btnMenu.addEventListener("click", showMenu);
btnRestart.addEventListener("click", restartCurrentMode);
btnBackMenu.addEventListener("click", showMenu);
difficultySelect.addEventListener("change", () => {
  Difficulty.set(difficultySelect.value);
});

function toggleTouchControls() {
  touchControls.classList.toggle("hidden");
}

window.addEventListener("keydown", (e) => {
  SFX.enable();
  const key = e.key.toUpperCase();
  if (key === "ESCAPE") {
    e.preventDefault();
    if (appState === "battle") showMenu();
    return;
  }
  if (key === "H") {
    e.preventDefault();
    toggleDrawer(helpDrawer);
    return;
  }
  if (key === "L") {
    e.preventDefault();
    toggleDrawer(logDrawer);
    return;
  }
  if (key === "I" && appState === "demo") {
    e.preventDefault();
    toggleDrawer(demoDetailDrawer);
    return;
  }
  if (key === "V") {
    e.preventDefault();
    toggleTouchControls();
    return;
  }
});

touchToggle.addEventListener("click", () => {
  SFX.enable();
  toggleTouchControls();
});

for (const btn of touchControls.querySelectorAll("button[data-key]")) {
  const key = btn.dataset.key;
  btn.addEventListener("pointerdown", () => {
    SFX.enable();
    input.injectKey(key, "press");
  });
  btn.addEventListener("pointerup", () => input.injectKey(key, "release"));
  btn.addEventListener("pointerleave", () => input.injectKey(key, "release"));
}

requestAnimationFrame(loop);
