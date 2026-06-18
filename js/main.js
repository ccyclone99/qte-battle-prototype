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

function showMenu() {
  appState = "menu";
  mainMenu.style.display = "flex";
  uiLayer.style.display = "none";
  battleLog.classList.remove("visible");
  setHelpPanel(battleHelpHtml);
  input.clear();
}

function startBattle() {
  Difficulty.set(difficultySelect.value);
  battle = new BattleSystem(input);
  battle.onLog = addLog;
  demo = null;
  appState = "battle";
  mainMenu.style.display = "none";
  uiLayer.style.display = "block";
  battleLog.classList.add("visible");
  setHelpPanel(battleHelpHtml);
  clearLog();
  addLog(`战斗开始 — 难度：${Difficulty.get().name}`);
}

function startDemo() {
  demo = new DemoMode(input, addLog);
  battle = null;
  appState = "demo";
  mainMenu.style.display = "none";
  uiLayer.style.display = "block";
  battleLog.classList.add("visible");
  clearLog();
  addLog("进入效果演示模式 — 按 W 切换武器，1-4 选择分类");
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
