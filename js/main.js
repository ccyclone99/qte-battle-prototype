const canvas = document.getElementById("game-canvas");
const input = new InputBuffer();
const battle = new BattleSystem(input);
const renderer = new CanvasRenderer(canvas);

const playerHpFill = document.getElementById("player-hp-fill");
const playerHpText = document.getElementById("player-hp-text");
const enemyHpFill = document.getElementById("enemy-hp-fill");
const enemyHpText = document.getElementById("enemy-hp-text");
const turnIndicator = document.getElementById("turn-indicator");
const weaponInfo = document.getElementById("weapon-info");
const chainInfo = document.getElementById("chain-info");
const messageText = document.getElementById("message-text");

let lastTime = performance.now();

function updateUI() {
  const playerRatio = battle.playerHp / battle.playerMaxHp;
  playerHpFill.style.width = `${playerRatio * 100}%`;
  playerHpText.textContent = `${battle.playerHp}/${battle.playerMaxHp}`;

  const enemyRatio = battle.enemyHp / battle.enemyMaxHp;
  enemyHpFill.style.width = `${enemyRatio * 100}%`;
  enemyHpText.textContent = `${battle.enemyHp}/${battle.enemyMaxHp}`;

  let turnText = "";
  if (battle.turnState === "select_weapon") turnText = "选择武器";
  else if (battle.turnState === "select_spells") turnText = "选择咒术";
  else if (battle.turnState === "select_arts") turnText = "选择战技";
  else if (battle.turnState === "player_turn") turnText = "玩家回合";
  else if (battle.turnState === "enemy_turn") turnText = "敌方回合";
  else if (battle.turnState === "qte_running") turnText = "QTE 进行中";
  else if (battle.turnState === "resolving") turnText = "结算中";
  else if (battle.turnState === "game_over") turnText = "战斗结束";
  turnIndicator.textContent = turnText;

  const weapon = WeaponDatabase[battle.currentWeapon];
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
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  battle.update(dt);
  renderer.render(battle);
  updateUI();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
