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
const enemySelect = document.getElementById("enemy-select");
const weaponSelect = document.getElementById("weapon-select");

const gameOverOverlay = document.getElementById("game-over");
const gameOverTitle = document.getElementById("game-over-title");
const gameOverSubtitle = document.getElementById("game-over-subtitle");
const gameOverStats = document.getElementById("game-over-stats");
const btnRestart = document.getElementById("btn-restart");
const btnBackMenu = document.getElementById("btn-back-menu");
const btnCopyTelemetry = document.getElementById("btn-copy-telemetry");
const telemetryCopyStatus = document.getElementById("telemetry-copy-status");
const tutorialOverlay = document.getElementById("tutorial-overlay");
const btnTutorialOk = document.getElementById("btn-tutorial-ok");

const helpDrawer = document.getElementById("help-drawer");
const logDrawer = document.getElementById("log-drawer");
const demoDetailDrawer = document.getElementById("demo-detail-drawer");
const qteDebugDrawer = document.getElementById("qte-debug-drawer");
const helpContent = document.getElementById("help-content");
const logContent = document.getElementById("log-content");
const demoDetailContent = document.getElementById("demo-detail-content");
const qteDebugContent = document.getElementById("qte-debug-content");
const touchControls = document.getElementById("touch-controls");
const touchToggle = document.getElementById("touch-toggle");
const DEFAULT_COMBAT_PLAN_ID = "current";

const battleHelpHtml = `
  <div><b>方案</b>：当前只保留敌方回合反制战斗方案</div>
  <div><b>武器</b>：主菜单可只切换武器，不恢复旧风格链</div>
  <div><b>遭遇</b>：自动推荐进入反制入门，逆势试炼是进阶压力测试</div>
  <div><b>追击窗口</b>：敌方回合应对成功后，短时间内按 A/S/D 触发武器 QTE；不输入则自动攻击</div>
  <div><b>敌方回合</b>：敌方攻击窗口内按 A/S/D 出刀拼刀；敌方施法窗口内出刀打断施法</div>
  <div><b>防御</b>：按住 F 举盾到接触帧，松开解除；SPACE 闪避/弹反</div>
  <div><b>连击</b>：每次成功命中增加连击，伤害随连击提升，受击会打断</div>
  <div><b>通用</b>：H 帮助，L 日志，T 调试，ESC 返回菜单</div>
`;

const demoHelpMain = `
  <div>演示系统当前冻结</div>
  <div>本版本只开放敌方回合反制方案</div>
  <div><b>ESC</b> 返回主菜单</div>
`;

const demoHelpList = `
  <div><b>数字</b> 选择条目</div>
  <div><b>A / ←</b> 上一页</div>
  <div><b>D / →</b> 下一页</div>
  <div><b>M</b> 切换手动/自动</div>
  <div><b>T</b> QTE 调试</div>
  <div><b>ESC</b> 返回分类</div>
`;

const demoHelpEnemyWindup = `
  <div>观察敌人攻击条推进</div>
  <div>绿色窗口 = 可输入时机</div>
  <div>命中后进入 QTE 再按键</div>
  <div><b>M</b> 切换手动/自动</div>
  <div><b>T</b> QTE 调试</div>
  <div><b>ESC</b> 返回列表</div>
`;

const demoHelpQTE = `
  <div>按 QTE 提示按键</div>
  <div>绿色窗口内判定有效</div>
  <div>金色竖线 = Perfect 点</div>
  <div><b>M</b> 切换手动/自动</div>
  <div><b>T</b> QTE 调试</div>
  <div><b>ESC</b> 返回列表</div>
`;

const demoHelpPreview = `
  <div>查看特效与结算</div>
  <div><b>R</b> 重播当前演示</div>
  <div><b>任意键</b> 返回列表</div>
  <div><b>ESC</b> 返回列表</div>
`;

let appState = "menu";
let battle = null;
let demo = null;
let lastTime = performance.now();
let tutorialShownThisSession = false;

function selectedEnemyId() {
  if (!enemySelect || enemySelect.value === "auto") return null;
  return enemySelect.value;
}

function selectedWeaponId() {
  if (!weaponSelect || weaponSelect.value === "auto") return null;
  return weaponSelect.value;
}

window.exportCombatTelemetry = function exportCombatTelemetry() {
  return battle && battle.getCombatTelemetryExport
    ? battle.getCombatTelemetryExport()
    : null;
};

function applyDefaultCombatPlan() {
  if (!battle || !StyleDatabase[DEFAULT_COMBAT_PLAN_ID]) return false;

  battle.applyStyle(DEFAULT_COMBAT_PLAN_ID);
  if (selectedWeaponId() && battle.setWeaponOverride) {
    battle.setWeaponOverride(selectedWeaponId());
  }
  battle.startEnemyTurn();
  return true;
}

function showTutorialIfNeeded() {
  if (tutorialShownThisSession) return;
  tutorialShownThisSession = true;
  tutorialOverlay.style.display = "flex";
}

function hideTutorial() {
  tutorialOverlay.style.display = "none";
  input.reset();
}

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
  demoDetailHtml: "",
  qteDebugHtml: ""
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

function setQTEDebugHtml(html) {
  if (uiCache.qteDebugHtml === html) return;
  qteDebugContent.innerHTML = html;
  uiCache.qteDebugHtml = html;
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
  uiCache.qteDebugHtml = "";
}

function setTopBarVisible(visible) {
  topBar.style.display = visible ? "flex" : "none";
}

function hideAllDrawers() {
  helpDrawer.classList.add("hidden");
  logDrawer.classList.add("hidden");
  demoDetailDrawer.classList.add("hidden");
  qteDebugDrawer.classList.add("hidden");
}

function toggleDrawer(drawer) {
  drawer.classList.toggle("hidden");
}

function showMenu() {
  appState = "menu";
  mainMenu.style.display = "flex";
  gameOverOverlay.style.display = "none";
  if (telemetryCopyStatus) telemetryCopyStatus.textContent = "";
  hideTutorial();
  setTopBarVisible(false);
  hideAllDrawers();
  input.reset();
  resetUICache();
  setDemoDetailHtml("<div>当前没有演示详情。</div>");
  setTurnIndicator("主菜单", "prep");
  setDifficultyBadge(Difficulty.get().name);
}

function startBattle() {
  SFX.enable();
  input.reset();
  Difficulty.set(difficultySelect.value);
  battle = new BattleSystem(input, { practiceMode: false, enemyId: selectedEnemyId(), weaponId: selectedWeaponId() });
  battle.onLog = addLog;
  demo = null;
  appState = "battle";
  mainMenu.style.display = "none";
  gameOverOverlay.style.display = "none";
  setTopBarVisible(true);
  hideAllDrawers();
  clearLog();
  resetUICache();
  setDemoDetailHtml("<div>战斗模式无演示详情。</div>");
  setTurnIndicator("战前准备", "prep");
  setDifficultyBadge(Difficulty.get().name);
  addLog(`战斗开始 — 难度：${Difficulty.get().name}`);
  applyDefaultCombatPlan();
  setHelpContent(battleHelpHtml);
  showTutorialIfNeeded();
}

function startPractice() {
  SFX.enable();
  input.reset();
  Difficulty.set(difficultySelect.value);
  battle = new BattleSystem(input, { practiceMode: true, enemyId: selectedEnemyId(), weaponId: selectedWeaponId() });
  battle.onLog = addLog;
  demo = null;
  appState = "battle";
  mainMenu.style.display = "none";
  gameOverOverlay.style.display = "none";
  setTopBarVisible(true);
  hideAllDrawers();
  clearLog();
  resetUICache();
  setDemoDetailHtml("<div>战斗模式无演示详情。</div>");
  setTurnIndicator("战前准备", "prep");
  setDifficultyBadge(`${Difficulty.get().name} · 练习`);
  addLog(`练习模式开始 — 敌人无限血量`);
  applyDefaultCombatPlan();
  setHelpContent(battleHelpHtml);
  showTutorialIfNeeded();
}

function showGameOver(won, isPractice, stats = null, resultLines = null) {
  gameOverTitle.textContent = isPractice ? "练习结束" : (won ? "胜利" : "战败");
  gameOverSubtitle.textContent = isPractice
    ? "敌人无限血量，继续挑战或返回菜单"
    : (won ? "敌人已被击败" : "玩家生命值耗尽");
  btnRestart.textContent = isPractice ? "继续练习" : "再来一局";
  if (telemetryCopyStatus) telemetryCopyStatus.textContent = "";

  if (Array.isArray(resultLines) && resultLines.length > 0) {
    gameOverStats.innerHTML = [
      `<div class="game-over-stats-title">战斗摘要</div>`,
      ...resultLines.map(line => `<div>${line}</div>`)
    ].join("");
    gameOverStats.style.display = "grid";
  } else if (stats) {
    const lines = [
      `输出：${stats.damageDealt}  命中率：${stats.accuracy}%  Perfect：${stats.perfectCount}`,
      `最大连击：×${stats.maxCombo}  受击：${stats.hitsTaken}`
    ];
    gameOverStats.innerHTML = lines.map(line => `<div>${line}</div>`).join("");
    gameOverStats.style.display = "grid";
  } else {
    gameOverStats.innerHTML = "";
    gameOverStats.style.display = "none";
  }

  gameOverOverlay.style.display = "flex";
}

function hideGameOver() {
  gameOverOverlay.style.display = "none";
  if (telemetryCopyStatus) telemetryCopyStatus.textContent = "";
}

function setTelemetryCopyStatus(text) {
  if (telemetryCopyStatus) telemetryCopyStatus.textContent = text || "";
}

function fallbackCopyText(text) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "readonly");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (err) {
    ok = false;
  }
  document.body.removeChild(area);
  return ok;
}

async function copyCombatTelemetry() {
  const payload = window.exportCombatTelemetry ? window.exportCombatTelemetry() : null;
  if (!payload) {
    setTelemetryCopyStatus("当前没有可复制的战斗遥测。");
    return false;
  }
  const text = JSON.stringify(payload, null, 2);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else if (!fallbackCopyText(text)) {
      throw new Error("clipboard unavailable");
    }
    setTelemetryCopyStatus("遥测 JSON 已复制到剪贴板。");
    addLog("已复制本局遥测 JSON");
    return true;
  } catch (err) {
    if (fallbackCopyText(text)) {
      setTelemetryCopyStatus("遥测 JSON 已复制到剪贴板。");
      addLog("已复制本局遥测 JSON");
      return true;
    }
    setTelemetryCopyStatus("复制失败：浏览器拒绝剪贴板访问。");
    addLog("复制遥测失败：剪贴板不可用");
    return false;
  }
}

function restartCurrentMode() {
  if (battle && battle.practiceMode) {
    startPractice();
  } else {
    startBattle();
  }
}

function startDemo() {
  return;
  SFX.enable();
  input.reset();
  setTouchControlsVisible(false);
  demo = new DemoMode(input, addLog);
  battle = null;
  appState = "demo";
  mainMenu.style.display = "none";
  gameOverOverlay.style.display = "none";
  setTopBarVisible(true);
  hideAllDrawers();
  clearLog();
  resetUICache();
  setTurnIndicator("演示 - 主菜单", "demo");
  setDifficultyBadge(Difficulty.get().name);
  addLog("演示系统已冻结，当前只开放敌方回合反制方案");
  setHelpContent(demoHelpMain);
  demoDetailDrawer.classList.remove("hidden");
  showTutorialIfNeeded();
}

function updateBattleUI() {
  if (!battle) return;

  setHpUI(playerHpFill, playerHpText, battle.playerHp, battle.playerMaxHp, "player");
  setHpUI(enemyHpFill, enemyHpText, battle.enemyHp, battle.enemyMaxHp, "enemy");

  let turnText = "";
  let turnClass = "";
  let helpHtml = "";
  const weaponIdentity = battle.getWeaponIdentityView ? battle.getWeaponIdentityView() : null;
  const weaponLine = weaponIdentity
    ? `<div><b>${weaponIdentity.name}</b>：${weaponIdentity.role} · ${weaponIdentity.publicTip || weaponIdentity.summary || ""}</div>`
    : "";
  if (battle.turnState.startsWith("select_")) {
    turnText = "战前准备";
    turnClass = "prep";
    helpHtml = battleHelpHtml;
  } else if (battle.turnState === "player_turn") {
    turnText = "恢复间隙";
    turnClass = "player";
    helpHtml = `${weaponLine}<div>无追击资格，不能手动触发 QTE</div><div><b>H</b> 帮助 <b>L</b> 日志 <b>T</b> 调试</div>`;
  } else if (battle.turnState === "followup_turn") {
    turnText = "追击窗口";
    turnClass = "player";
    helpHtml = `${weaponLine}<div><b>A/S/D</b> 追击武器 QTE；不输入则自动攻击</div><div><b>H</b> 帮助 <b>L</b> 日志 <b>T</b> 调试</div>`;
  } else if (battle.turnState === "enemy_turn") {
    turnText = "敌方回合";
    turnClass = "enemy";
    helpHtml = `${weaponLine}<div><b>A/S/D</b> 逐节点拼刀/打断施法</div><div><b>F</b> 按住举盾到接触帧 <b>SPACE</b> 闪避/弹反</div><div><b>H</b> 帮助 <b>T</b> 调试</div>`;
  } else if (battle.turnState === "qte_running") {
    turnText = "QTE";
    turnClass = "qte";
    helpHtml = `${weaponLine}<div>在判定窗口内按下对应按键</div><div><b>H</b> 帮助 <b>T</b> 调试</div>`;
  } else if (battle.turnState === "attack_active") {
    turnText = "攻击演出";
    turnClass = "qte";
    helpHtml = `${weaponLine}<div>攻击已出手，等待命中结算</div><div><b>H</b> 帮助 <b>T</b> 调试</div>`;
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

  if (battle.turnState === "game_over" && gameOverOverlay.style.display === "none") {
    const won = battle.enemyHp <= 0;
    showGameOver(
      won,
      battle.practiceMode,
      battle.getBattleStats(),
      battle.getBattleResultLines ? battle.getBattleResultLines() : null
    );
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
  if (demo.getCurrentItemTitle) {
    parts.push(`<div style="color:#fff;font-weight:700;margin-bottom:6px">${demo.getCurrentItemTitle()}</div>`);
  } else if (demo.previewTitle) {
    parts.push(`<div style="color:#fff;font-weight:700;margin-bottom:6px">${demo.previewTitle}</div>`);
  }
  if (demo.getPhaseTitle) {
    parts.push(`<div style="color:#9fb7ff;margin-bottom:6px">${demo.getPhaseTitle()}</div>`);
  }
  if (demo.state === "main" || demo.state === "list") {
    const statusLines = demo.getStatusLines ? demo.getStatusLines() : [];
    for (const line of statusLines.slice(0, 16)) {
      parts.push(`<div>${line}</div>`);
    }
    if (demo.getControlHint) {
      parts.push(`<div style="color:#f1c40f;margin-top:8px">${demo.getControlHint()}</div>`);
    }
    setDemoDetailHtml(parts.join(""));
    return;
  }
  if (demo.getPlaybackLines) {
    parts.push(`<div style="color:#f1c40f;margin-top:8px;font-weight:700">状态</div>`);
    for (const line of demo.getPlaybackLines().slice(0, 8)) {
      parts.push(`<div>${line}</div>`);
    }
  }
  if (demo.state === "action_sequence" && demo.getStatusLines) {
    parts.push(`<div style="color:#f1c40f;margin-top:8px;font-weight:700">当前演示</div>`);
    for (const line of demo.getStatusLines().slice(0, 10)) {
      parts.push(`<div>${line}</div>`);
    }
  }
  if (demo.detailLines && demo.detailLines.length > 0) {
    for (const line of demo.detailLines.slice(0, 12)) {
      parts.push(`<div>${line}</div>`);
    }
  }
  if (demo.getProjectedTimelineLines && demo.currentItem && demo.currentItem.chain && demo.state !== "preview") {
    const projected = demo.getProjectedTimelineLines(demo.currentItem, 8);
    if (projected.length > 0) {
      parts.push(`<div style="color:#f1c40f;margin-top:8px;font-weight:700">时间轴</div>`);
      for (const line of projected.slice(1, 9)) {
        parts.push(`<div>${line}</div>`);
      }
    }
  }
  if (demo.state === "qte" && demo.getQTEInspectorLines) {
    parts.push(`<div style="color:#f1c40f;margin-top:8px;font-weight:700">播放状态</div>`);
    for (const line of demo.getQTEInspectorLines().slice(0, 10)) {
      parts.push(`<div>${line}</div>`);
    }
  }
  if (demo.state === "qte" && demo.getActualTimelineLines) {
    const actual = demo.getActualTimelineLines(8);
    if (actual.length > 0) {
      parts.push(`<div style="color:#f1c40f;margin-top:8px;font-weight:700">实际路径</div>`);
      for (const line of actual.slice(1, 9)) {
        parts.push(`<div>${line}</div>`);
      }
    }
  }
  if (demo.resultLines && demo.resultLines.length > 0) {
    parts.push(`<div style="color:#f1c40f;margin-top:8px;font-weight:700">结算</div>`);
    for (const line of demo.resultLines.slice(0, 10)) {
      parts.push(`<div>${line}</div>`);
    }
  }
  if (demo.state === "preview" && demo.getActualTimelineLines) {
    const actual = demo.getActualTimelineLines(8);
    if (actual.length > 0) {
      parts.push(`<div style="color:#f1c40f;margin-top:8px;font-weight:700">实际路径</div>`);
      for (const line of actual.slice(1, 9)) {
        parts.push(`<div>${line}</div>`);
      }
    }
  }
  if (demo.getControlHint) {
    parts.push(`<div style="color:#f1c40f;margin-top:8px">${demo.getControlHint()}</div>`);
  }

  setDemoDetailHtml(parts.join(""));
}

function updateQTEDebugUI() {
  const scene = currentScene();
  if (scene) {
    scene.showHitConfirmOverlay = window.__SHOW_HIT_CONFIRM_OVERLAY === true;
  }
  if (!scene || !scene.getQTEDebugLines) {
    setQTEDebugHtml("<div>当前没有可调试的 QTE 场景。</div>");
    return;
  }

  const lines = scene.getQTEDebugLines();
  setQTEDebugHtml(lines.map(line => `<div>${line}</div>`).join(""));
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
  updateQTEDebugUI();
}

function currentScene() {
  if (appState === "battle") return battle;
  if (appState === "demo") return demo;
  return null;
}

function isBlockingOverlayVisible() {
  return (tutorialOverlay && tutorialOverlay.style.display !== "none")
    || (gameOverOverlay && gameOverOverlay.style.display !== "none");
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  const pausedByOverlay = isBlockingOverlayVisible();

  if (!pausedByOverlay && appState === "battle" && battle) {
    battle.update(dt);
  } else if (!pausedByOverlay && appState === "demo" && demo) {
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
if (btnDemo) btnDemo.addEventListener("click", startDemo);
btnMenu.addEventListener("click", showMenu);
btnRestart.addEventListener("click", restartCurrentMode);
btnBackMenu.addEventListener("click", showMenu);
if (btnCopyTelemetry) btnCopyTelemetry.addEventListener("click", () => {
  copyCombatTelemetry();
});
btnTutorialOk.addEventListener("click", hideTutorial);
tutorialOverlay.addEventListener("click", (e) => {
  if (e.target === tutorialOverlay) hideTutorial();
});
difficultySelect.addEventListener("change", () => {
  Difficulty.set(difficultySelect.value);
});

function setTouchControlsVisible(visible) {
  touchControls.classList.toggle("hidden", !visible);
  touchControls.setAttribute("aria-hidden", visible ? "false" : "true");
}

function toggleTouchControls() {
  setTouchControlsVisible(touchControls.classList.contains("hidden"));
}

function handleVirtualSystemKey(key) {
  if (key !== "ESCAPE") return false;
  if (tutorialOverlay.style.display !== "none") {
    hideTutorial();
    return true;
  }
  if (gameOverOverlay.style.display !== "none") {
    showMenu();
    return true;
  }
  if (appState === "battle") {
    showMenu();
    return true;
  }
  if (appState === "demo" && demo && typeof demo.handleSystemEscape === "function") {
    demo.handleSystemEscape();
    if (demo.returnToMenu) {
      demo.returnToMenu = false;
      showMenu();
    }
    return true;
  }
  return false;
}

function pressVirtualKey(key) {
  SFX.enable();
  if (tutorialOverlay.style.display !== "none") {
    hideTutorial();
    return false;
  }
  if (handleVirtualSystemKey(key)) return false;
  input.injectKey(key, "press", { fresh: true });
  markVirtualPress(key);
  return true;
}

function releaseVirtualKey(key) {
  input.injectKey(key, "release");
}

window.addEventListener("keydown", (e) => {
  SFX.enable();
  if (tutorialOverlay.style.display !== "none") {
    hideTutorial();
    return;
  }
  const key = e.key.toUpperCase();
  if (key === "ESCAPE") {
    e.preventDefault();
    if (gameOverOverlay.style.display !== "none") {
      showMenu();
    } else if (appState === "battle") {
      showMenu();
    }
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
  if (key === "T" && (appState === "battle" || appState === "demo")) {
    e.preventDefault();
    toggleDrawer(qteDebugDrawer);
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

function getVirtualKeyFromEvent(e) {
  const direct = e.target && e.target.closest ? e.target.closest("button[data-key]") : null;
  if (direct && touchControls.contains(direct)) return direct.dataset.key;

  const x = e.clientX;
  const y = e.clientY;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const btn of touchControls.querySelectorAll("button[data-key]")) {
    const rect = btn.getBoundingClientRect();
    const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    if (inside) return btn.dataset.key;
    const dx = x < rect.left ? rect.left - x : (x > rect.right ? x - rect.right : 0);
    const dy = y < rect.top ? rect.top - y : (y > rect.bottom ? y - rect.bottom : 0);
    const distance = Math.hypot(dx, dy);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = btn;
    }
  }
  return nearestDistance <= 12 && nearest ? nearest.dataset.key : null;
}

let activePointerKey = null;
let activeMouseKey = null;
let pointerSequenceActive = false;
let suppressTouchClick = false;
let lastVirtualPressKey = null;
let lastVirtualPressAt = 0;

function markVirtualPress(key) {
  lastVirtualPressKey = key;
  lastVirtualPressAt = performance.now();
}

function shouldSuppressVirtualClick(key) {
  if (!suppressTouchClick) return false;
  const sameRecentKey = lastVirtualPressKey === key && performance.now() - lastVirtualPressAt < 350;
  suppressTouchClick = false;
  return sameRecentKey;
}

function handleVirtualTap(key, e) {
  if (!key) return;
  e.preventDefault();
  e.stopPropagation();
  if (shouldSuppressVirtualClick(key)) return;
  if (!pressVirtualKey(key)) return;
  setTimeout(() => releaseVirtualKey(key), 70);
}

function handleVirtualPointerDown(key, e) {
  if (!key) return;
  e.preventDefault();
  e.stopPropagation();
  pointerSequenceActive = true;
  activePointerKey = key;
  suppressTouchClick = true;
  pressVirtualKey(key);
}

function handleVirtualPointerUp(e) {
  if (!activePointerKey) return;
  e.preventDefault();
  e.stopPropagation();
  releaseVirtualKey(activePointerKey);
  activePointerKey = null;
  setTimeout(() => { pointerSequenceActive = false; }, 0);
}

function handleVirtualMouseDown(key, e) {
  if (pointerSequenceActive || !key) return;
  e.preventDefault();
  e.stopPropagation();
  activeMouseKey = key;
  suppressTouchClick = true;
  pressVirtualKey(key);
}

function handleVirtualMouseUp(e) {
  if (pointerSequenceActive || !activeMouseKey) return;
  e.preventDefault();
  e.stopPropagation();
  releaseVirtualKey(activeMouseKey);
  activeMouseKey = null;
}

touchControls.addEventListener("pointerdown", (e) => {
  handleVirtualPointerDown(getVirtualKeyFromEvent(e), e);
}, true);

touchControls.addEventListener("pointerup", (e) => {
  handleVirtualPointerUp(e);
}, true);

touchControls.addEventListener("pointerleave", () => {
  if (!activePointerKey) return;
  releaseVirtualKey(activePointerKey);
  activePointerKey = null;
});

touchControls.addEventListener("pointercancel", () => {
  if (activePointerKey) releaseVirtualKey(activePointerKey);
  activePointerKey = null;
  pointerSequenceActive = false;
});

touchControls.addEventListener("mousedown", (e) => {
  handleVirtualMouseDown(getVirtualKeyFromEvent(e), e);
}, true);

touchControls.addEventListener("mouseup", (e) => {
  handleVirtualMouseUp(e);
}, true);

touchControls.addEventListener("mouseleave", () => {
  if (!activeMouseKey) return;
  releaseVirtualKey(activeMouseKey);
  activeMouseKey = null;
});

touchControls.addEventListener("click", (e) => {
  const key = getVirtualKeyFromEvent(e);
  handleVirtualTap(key, e);
}, true);

for (const btn of touchControls.querySelectorAll("button[data-key]")) {
  btn.addEventListener("pointerdown", (e) => {
    handleVirtualPointerDown(btn.dataset.key, e);
  }, true);
  btn.addEventListener("pointerup", (e) => {
    handleVirtualPointerUp(e);
  }, true);
  btn.addEventListener("mousedown", (e) => {
    handleVirtualMouseDown(btn.dataset.key, e);
  }, true);
  btn.addEventListener("mouseup", (e) => {
    handleVirtualMouseUp(e);
  }, true);
  btn.addEventListener("click", (e) => {
    const key = btn.dataset.key;
    handleVirtualTap(key, e);
  }, true);
}

requestAnimationFrame(loop);
