const canvas = document.getElementById("game-canvas");
const input = new InputBuffer();
const renderer = new CanvasRenderer(canvas);

const playerHpFill = document.getElementById("player-hp-fill");
const playerHpText = document.getElementById("player-hp-text");
const enemyHpFill = document.getElementById("enemy-hp-fill");
const enemyHpText = document.getElementById("enemy-hp-text");
const turnIndicator = document.getElementById("turn-indicator");
const weaponInfo = document.getElementById("weapon-info");
const chainInfo = document.getElementById("chain-info");
const messageText = document.getElementById("message-text");

const mainMenu = document.getElementById("main-menu");
const btnStart = document.getElementById("btn-start");
const btnDemo = document.getElementById("btn-demo");
const difficultySelect = document.getElementById("difficulty-select");
const battleLog = document.getElementById("battle-log");
const logContent = document.getElementById("log-content");
const uiLayer = document.getElementById("ui-layer");
const helpPanel = document.getElementById("help-panel");
const demoUiLayer = document.getElementById("demo-ui-layer");
const demoPhaseTitle = document.getElementById("demo-phase-title");
const demoStyleLine = document.getElementById("demo-style-line");
const demoModeLine = document.getElementById("demo-mode-line");
const demoItemTitle = document.getElementById("demo-item-title");
const demoDetailLines = document.getElementById("demo-detail-lines");
const demoInspectorLines = document.getElementById("demo-inspector-lines");
const demoResultLines = document.getElementById("demo-result-lines");
const demoControlsText = document.getElementById("demo-controls-text");

const battleHelpHtml = `<div class="help-title">操作说明</div>
  <div>开局：按 1-5 选择战斗风格</div>
  <div>我方回合：[A/S/D] 触发对应 QTE 链</div>
  <div>敌方回合：[SPACE] 闪避/弹反　[F] 格挡　[A/S/D] 反击</div>`;

function setHelpPanel(html) {
  if (helpPanel) helpPanel.innerHTML = html;
}

let appState = "menu"; // menu | battle | demo
let battle = null;
let demo = null;
let lastTime = performance.now();

function addLog(msg) {
  const entry = document.createElement("div");
  entry.className = "log-entry log-latest";
  entry.textContent = msg;

  // 移除之前的高亮
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

function setDemoUiVisible(visible) {
  if (demoUiLayer) {
    demoUiLayer.style.display = visible ? "block" : "none";
    if (!visible) demoUiLayer.removeAttribute("data-demo-state");
  }
}

function renderDemoLines(container, lines, limit, emptyText) {
  if (!container) return;
  container.innerHTML = "";
  const safeLines = Array.isArray(lines) && lines.length > 0 ? lines : [emptyText || "—"];
  for (const line of safeLines.slice(0, limit)) {
    const row = document.createElement("div");
    row.textContent = line;
    container.appendChild(row);
  }
}

function updateDemoUI() {
  if (!demoUiLayer) return;
  if (appState !== "demo" || !demo) {
    setDemoUiVisible(false);
    return;
  }

  setDemoUiVisible(true);
  demoUiLayer.setAttribute("data-demo-state", demo.state);

  const style = demo.currentStyle ? demo.currentStyle() : null;
  const loadout = demo.describeLoadout ? demo.describeLoadout() : "";
  const modeText = demo.manualMode ? "手动试玩" : "自动慢放";
  const difficulty = Difficulty.get();

  if (demoPhaseTitle) {
    demoPhaseTitle.textContent = demo.getPhaseTitle ? demo.getPhaseTitle() : demo.message;
  }
  if (demoStyleLine) {
    demoStyleLine.textContent = style
      ? `风格：${style.name} [${style.key}]${loadout ? ` / ${loadout}` : ""}`
      : "风格：未选择";
  }
  if (demoModeLine) {
    demoModeLine.textContent = `模式：${modeText} / 难度：${difficulty.name}`;
  }

  if (demoItemTitle) {
    demoItemTitle.textContent = demo.getCurrentItemTitle
      ? demo.getCurrentItemTitle()
      : (demo.previewTitle || "选择演示项");
  }

  const statusLines = demo.getStatusLines ? demo.getStatusLines() : [demo.message];
  const detailLines = demo.detailLines && demo.detailLines.length > 0 ? demo.detailLines : statusLines;
  const inspectorLines = demo.state === "qte" && demo.getQTEInspectorLines
    ? demo.getQTEInspectorLines()
    : (demo.getPlaybackLines ? demo.getPlaybackLines() : statusLines);
  const resultLines = demo.resultLines && demo.resultLines.length > 0
    ? demo.resultLines
    : (demo.getTimelineLines ? demo.getTimelineLines(8) : []);

  renderDemoLines(demoDetailLines, detailLines, 11, "选择一个条目后会显示机制、输入流程和参考结算。");
  renderDemoLines(demoInspectorLines, inspectorLines, 10, "等待选择演示项。");
  renderDemoLines(demoResultLines, resultLines, 6, "尚无结算记录。");

  if (demoControlsText) {
    demoControlsText.textContent = demo.getControlHint ? demo.getControlHint() : "ESC 返回";
  }
}

function showMenu() {
  appState = "menu";
  mainMenu.style.display = "flex";
  uiLayer.style.display = "none";
  setDemoUiVisible(false);
  battleLog.classList.remove("visible");
  setHelpPanel(battleHelpHtml);
  input.clear();
}

function startBattle() {
  input.clear();
  Difficulty.set(difficultySelect.value);
  battle = new BattleSystem(input);
  battle.onLog = addLog;
  demo = null;
  appState = "battle";
  mainMenu.style.display = "none";
  uiLayer.style.display = "block";
  setDemoUiVisible(false);
  battleLog.classList.add("visible");
  setHelpPanel(battleHelpHtml);
  clearLog();
  addLog(`战斗开始 — 难度：${Difficulty.get().name}`);
}

function startDemo() {
  input.clear();
  demo = new DemoMode(input, addLog);
  battle = null;
  appState = "demo";
  mainMenu.style.display = "none";
  uiLayer.style.display = "none";
  setDemoUiVisible(true);
  battleLog.classList.remove("visible");
  clearLog();
  addLog("进入效果演示模式 — 按 W 切换风格，1-4 选择分类");
}

btnStart.addEventListener("click", startBattle);
btnDemo.addEventListener("click", startDemo);
difficultySelect.addEventListener("change", () => {
  Difficulty.set(difficultySelect.value);
});

// 战斗中按 ESC 返回主菜单（演示模式内部自行处理 ESC）
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && appState === "battle") {
    showMenu();
  }
});

function updateUI() {
  if (appState === "battle" && battle) {
    const playerRatio = battle.playerHp / battle.playerMaxHp;
    playerHpFill.style.width = `${playerRatio * 100}%`;
    playerHpText.textContent = `${battle.playerHp}/${battle.playerMaxHp}`;

    const enemyRatio = battle.enemyHp / battle.enemyMaxHp;
    enemyHpFill.style.width = `${enemyRatio * 100}%`;
    enemyHpText.textContent = `${battle.enemyHp}/${battle.enemyMaxHp}`;

    let turnText = "";
    if (battle.turnState.startsWith("select_")) turnText = "战前准备";
    else if (battle.turnState === "player_turn") turnText = "玩家回合";
    else if (battle.turnState === "enemy_turn") turnText = "敌方回合";
    else if (battle.turnState === "qte_running") turnText = "QTE 进行中";
    else if (battle.turnState === "resolving") turnText = "结算中";
    else if (battle.turnState === "game_over") turnText = "战斗结束";
    turnIndicator.textContent = turnText;

    const style = battle.playerConfig.style ? StyleDatabase[battle.playerConfig.style] : null;
    if (style) {
      weaponInfo.textContent = `当前风格：${style.name} [${style.key}]`;
    } else {
      weaponInfo.textContent = "当前风格：未选择";
    }

    if (battle.qteRunner && battle.qteRunner.isRunning()) {
      const nodeName = battle.qteRunner.currentNodeName();
      const chainName = battle.qteRunner.chain.name;
      chainInfo.textContent = `${chainName} — ${nodeName}`;
    } else {
      chainInfo.textContent = "—";
    }

    messageText.textContent = battle.message;
  } else if (appState === "demo" && demo) {
    // HP bars
    const pRatio = demo.playerHp / demo.playerMaxHp;
    playerHpFill.style.width = `${pRatio * 100}%`;
    playerHpText.textContent = `${demo.playerHp}/${demo.playerMaxHp}`;

    const eRatio = demo.enemyHp / demo.enemyMaxHp;
    enemyHpFill.style.width = `${eRatio * 100}%`;
    enemyHpText.textContent = `${demo.enemyHp}/${demo.enemyMaxHp}`;

    // Turn indicator
    if (demo.state === "main") turnIndicator.textContent = "演示 - 主菜单";
    else if (demo.state === "list") turnIndicator.textContent = `演示 - ${demo.getCategoryName()}`;
    else if (demo.state === "qte") turnIndicator.textContent = "演示 - QTE 播放中";
    else if (demo.state === "preview") turnIndicator.textContent = "演示 - 效果预览";

    // Weapon info
    const dWeapon = demo.playerConfig.weapon ? WeaponDatabase[demo.playerConfig.weapon] : null;
    if (dWeapon) {
      weaponInfo.textContent = `当前武器：${dWeapon.name} [${dWeapon.key}]`;
    } else {
      weaponInfo.textContent = "当前武器：未选择";
    }

    // Chain info
    if (demo.state === "qte" && demo.qteRunner && demo.qteRunner.isRunning()) {
      const nodeName = demo.qteRunner.currentNodeName();
      const chainName = demo.qteRunner.chain.name;
      chainInfo.textContent = `${chainName} — ${nodeName}`;
    } else {
      chainInfo.textContent = "—";
    }

    messageText.textContent = demo.message;
    updateDemoUI();

    // 更新帮助面板为演示模式的操作说明
    if (helpPanel) {
      if (demo.state === "main") {
        helpPanel.innerHTML = `<div class="help-title">演示操作</div>
          <div>1-4 选择分类 | W 切换风格 | 6 切换难度</div>
          <div>ESC 返回主菜单</div>`;
      } else if (demo.state === "list") {
        helpPanel.innerHTML = `<div class="help-title">${demo.getCategoryName()} — 演示列表</div>
          <div>1-9 选择效果 | A/D 翻页 | ESC 返回分类</div>`;
      } else if (demo.state === "preview") {
        helpPanel.innerHTML = `<div class="help-title">效果预览</div>
          <div>查看特效与伤害数值</div>
          <div>按任意键返回列表</div>`;
      } else if (demo.state === "qte") {
        helpPanel.innerHTML = `<div class="help-title">QTE 自动演示中</div>
          <div>自动 Perfect 判定，观察 QTE 条变化</div>`;
      }
    }
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
    // 菜单背景保持最后一帧或空画面
    renderer.renderBlank();
  }

  updateUI();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
