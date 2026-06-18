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
  clearLog();
  addLog(`战斗开始 — 难度：${Difficulty.get().name}`);
}

function startDemo() {
  demo = new DemoMode(input, addLog);
  demo.playerConfig = { weapon: "greatsword", spells: [], combatArts: [] };
  demo.playerHp = 100;
  demo.playerMaxHp = 100;
  demo.enemyHp = 200;
  demo.enemyMaxHp = 200;
  battle = null;
  appState = "demo";
  mainMenu.style.display = "none";
  uiLayer.style.display = "block";
  battleLog.classList.add("visible");
  clearLog();
  addLog("进入效果演示模式");
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

    const weapon = battle.playerConfig.weapon ? WeaponDatabase[battle.playerConfig.weapon] : null;
    if (weapon) {
      weaponInfo.textContent = `当前武器：${weapon.name} [${weapon.key}]`;
    } else {
      weaponInfo.textContent = "当前武器：未选择";
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
    turnIndicator.textContent = "效果演示";
    weaponInfo.textContent = "当前武器：演示用大剑";
    chainInfo.textContent = demo.state === "qte" && demo.qteRunner ? demo.qteRunner.chain.name : "—";
    messageText.textContent = demo.message;
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
