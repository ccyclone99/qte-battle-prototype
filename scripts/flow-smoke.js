#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { performance } = require("perf_hooks");

const root = path.resolve(__dirname, "..");
const noop = () => {};

const context = vm.createContext({
  console,
  performance,
  setTimeout,
  clearTimeout,
  window: { addEventListener: noop },
  SFX: new Proxy({}, { get: () => noop })
});

function load(relPath, exportNames = []) {
  const code = fs.readFileSync(path.join(root, relPath), "utf8");
  const exports = exportNames.map(name => `globalThis.${name} = ${name};`).join("\n");
  vm.runInContext(`${code}\n${exports}`, context, { filename: relPath });
}

[
  ["js/utils.js", ["Utils"]],
  ["js/difficulty.js", ["Difficulty"]],
  ["js/fx.js", ["ParticleSystem", "EffectBurstSystem", "ActorReactionSystem", "FloatingTextManager"]],
  ["js/input.js", ["InputBuffer"]],
  ["js/data/chains.js", ["ChainDatabase"]],
  ["js/data/weapons.js", ["WeaponDatabase"]],
  ["js/data/spells.js", ["SpellDatabase"]],
  ["js/data/combatArts.js", ["CombatArtDatabase"]],
  ["js/data/defenses.js", ["DefenseDatabase"]],
  ["js/data/enemies.js", ["EnemyDatabase"]],
  ["js/data/encounters.js", ["EncounterDatabase"]],
  ["js/data/styles.js", ["StyleDatabase"]],
  ["js/data/effects.js", ["EffectEventDefinitions"]],
  ["js/systems/statuses.js", ["StatusDefinitions", "StatusSystem"]],
  ["js/systems/resources.js", ["ResourceDefinitions", "ResourceSystem"]],
  ["js/systems/hit-confirm.js", ["HitConfirmSystem"]],
  ["js/systems/active-attacks.js", ["ActiveAttackSystem"]],
  ["js/systems/effects.js", ["EffectEventQueue"]],
  ["js/systems/chain-effects.js", ["ChainEffectSystem"]],
  ["js/qte-runner.js", ["QTEChainRunner"]],
  ["js/battle.js", ["BattleSystem"]]
].forEach(([relPath, exportNames]) => load(relPath, exportNames));

const {
  BattleSystem,
  Difficulty,
  InputBuffer,
  ChainDatabase,
  Utils,
  ActiveAttackSystem
} = context;

const results = [];

function check(label, condition, details = "") {
  results.push({ label, ok: !!condition, details });
}

function assert(label, condition, details = "") {
  check(label, condition, details);
  if (!condition) throw new Error(`${label}${details ? `: ${details}` : ""}`);
}

function tick(owner, seconds = 0.016, dt = 1 / 60) {
  let elapsed = 0;
  while (elapsed < seconds) {
    owner.update(Math.min(dt, seconds - elapsed));
    elapsed += dt;
  }
}

function tap(input, owner, key) {
  input.injectKey(key, "release");
  input.injectKey(key, "press");
  tick(owner, 0.08);
  input.injectKey(key, "release");
  tick(owner, 0.08);
}

function runUntil(owner, predicate, timeout = 12) {
  let elapsed = 0;
  while (elapsed < timeout) {
    if (predicate()) return true;
    tick(owner);
    elapsed += 1 / 60;
  }
  return predicate();
}

function verifyInputResetReleasesHeldKeys() {
  const input = new InputBuffer();
  input.injectKey("6", "press");
  input.clear();
  assert("input clear preserves held keys", input.isHeld("6"), "clear should not release active QTE holds");
  input.reset();
  assert("input reset releases held keys", !input.isHeld("6"), "reset should clear stale virtual key holds");
  input.injectKey("6", "press");
  assert("input reset allows fresh press", input.peek() && input.peek().key === "6", JSON.stringify(input.peek()));

  const stuck = new InputBuffer();
  stuck.injectKey("A", "press");
  stuck.clear();
  stuck.injectKey("A", "press");
  assert("input stale held blocks duplicate press", !stuck.peek(), JSON.stringify(stuck.peek()));
  stuck.injectKey("A", "press", { fresh: true });
  assert("input fresh press recovers stale held key", stuck.peek() && stuck.peek().key === "A", JSON.stringify(stuck.peek()));
}

function createBattle(options = {}) {
  const input = new InputBuffer();
  const logs = [];
  Difficulty.set("easy");
  const battle = new BattleSystem(input, { practiceMode: false, ...options });
  battle.onLog = msg => logs.unshift(String(msg));
  tick(battle);
  return { input, battle, logs };
}

function applyDefaultPlan(battle) {
  battle.applyStyle("current");
  battle.startEnemyTurn();
}

function createDefaultBattle(options = {}) {
  const setup = createBattle(options);
  applyDefaultPlan(setup.battle);
  return setup;
}

function setupSingleEnemyAttack(attackId, options = {}) {
  const setup = createBattle(options);
  const { battle } = setup;
  battle.applyStyle("current");
  if (options.weapon) battle.playerConfig.weapon = options.weapon;
  battle.setTurnState("enemy_turn");
  battle.activeAttackSystem.clear();
  battle.enemyAttackChain = null;
  battle.enemyCounterState = null;
  battle.enemyAttack = battle.buildEnemyAttack(attackId);
  battle.enemyAttackTimer = 0;
  battle.enemyAttackPhase = "windup";
  battle.commitEnemyActiveAttack(battle.enemyAttack);
  return setup;
}

function verifyDefaultCombatPlan() {
  const { input, battle, logs } = createBattle();
  applyDefaultPlan(battle);
  assert("default plan enters enemy turn", battle.turnState === "enemy_turn", battle.turnState);
  assert("default plan id", battle.playerConfig.style === "current", battle.playerConfig.style);
  assert("default plan enemy hp", battle.enemyMaxHp === 180, String(battle.enemyMaxHp));
  assert("default plan encounter", battle.activeEncounterId === "counter_tutorial", battle.activeEncounterId || "none");
  assert("default plan opens with beginner clash", battle.enemyAttackChain && battle.enemyAttackChain.id === "tutorialSingleClash", battle.enemyAttackChain?.id || "none");

  battle.startFollowupTurn({ source: "smoke" });
  tap(input, battle, "S");
  assert("default plan starts weapon QTE", battle.turnState === "qte_running", battle.turnState);
  assert("default plan S chain", battle.qteRunner && battle.qteRunner.context.chainId === "dualblades_s_v2", battle.qteRunner?.context?.chainId || "none");
  assert("default plan log has plan", logs.some(line => line.includes("战斗方案")), logs.join(" | "));
}

function verifyNoFreePlayerQte() {
  const { input, battle } = createBattle();
  battle.applyStyle("current");
  battle.startPlayerTurn();
  tap(input, battle, "A");
  assert("recovery turn blocks manual qte", battle.turnState === "player_turn" && !battle.qteRunner, battle.turnState);
  assert("recovery turn has no pending qte", !battle.qteRunner, "runner exists");
}

function verifyDefaultCounterPressureRotation() {
  const { battle } = createDefaultBattle();
  assert("beginner pressure first chain", battle.enemyAttackChain && battle.enemyAttackChain.id === "tutorialSingleClash", battle.enemyAttackChain?.id || "none");
  assert("beginner pressure first has one node", battle.enemyAttackChain.nodes.length === 1, String(battle.enemyAttackChain.nodes.length));

  battle.startFollowupTurn({ source: "smoke" });
  battle.startEnemyTurn();
  assert("beginner pressure second chain", battle.enemyAttackChain && battle.enemyAttackChain.id === "tutorialTwoHitRead", battle.enemyAttackChain?.id || "none");

  battle.startFollowupTurn({ source: "smoke" });
  battle.startEnemyTurn();
  assert("beginner pressure third chain", battle.enemyAttackChain && battle.enemyAttackChain.id === "tutorialGuardContact", battle.enemyAttackChain?.id || "none");

  battle.startFollowupTurn({ source: "smoke" });
  battle.startEnemyTurn();
  assert("beginner pressure fourth chain teaches spell", battle.enemyAttackChain && battle.enemyAttackChain.id === "tutorialSpellInterrupt", battle.enemyAttackChain?.id || "none");

  const pattern = context.EncounterDatabase.encounters.counter_dojo.attackPattern || [];
  for (const id of ["bladeRushTriple", "spellDoubleCut", "shieldSpellRush", "knifeFlurry", "feintCrush", "curseNeedle"]) {
    assert(`counter pressure pattern includes ${id}`, pattern.includes(id), pattern.join(","));
  }
  const tutorialPattern = context.EncounterDatabase.encounters.counter_tutorial.attackPattern || [];
  for (const id of ["tutorialSingleClash", "tutorialTwoHitRead", "tutorialGuardContact", "tutorialSpellInterrupt", "tutorialFollowupCheck"]) {
    assert(`beginner pattern includes ${id}`, tutorialPattern.includes(id), tutorialPattern.join(","));
  }
}

function verifyDefaultPlanScope() {
  const { input, battle } = createBattle();
  applyDefaultPlan(battle);
  const style = battle.getCurrentStyle();
  const chains = battle.getEffectiveChains();
  const encounter = context.EncounterDatabase.encounters.counter_tutorial;
  const modifiers = encounter.modifiers || {};

  assert("default plan keeps current id", battle.playerConfig.style === "current", battle.playerConfig.style);
  assert("default plan has no spell loadout", battle.playerConfig.spells.length === 0, battle.playerConfig.spells.join(","));
  assert("default plan has no borrowed combat arts", battle.playerConfig.combatArts.length === 0, battle.playerConfig.combatArts.join(","));
  assert("default plan S remains dual blade", chains.S === "dualblades_s_v2", chains.S || "none");
  assert("default plan D remains dual blade", chains.D === "dualblades_d_v2", chains.D || "none");
  assert("default plan has no counterspell chain", !style.counterChain, style.counterChain || "none");
  assert("default plan uses sequential counter flow", style.counterFlow && style.counterFlow.enabled && battle.getWeaponCounterProfile().recovery <= 0.2, JSON.stringify(style.counterFlow || {}));
  assert("beginner route gives no spell energy", !("startSpellEnergy" in modifiers), String(modifiers.startSpellEnergy));
  assert("beginner route gives no absorb boost", !("absorbEnergyMul" in modifiers) && !("absorbDamageMul" in modifiers), JSON.stringify(modifiers));
}

function verifyManualEnemyOverride() {
  const { battle, logs } = createBattle({ enemyId: "swift" });
  assert("manual enemy label visible", battle.getEnemySelectionLabel().includes("迅捷刺客"), battle.getEnemySelectionLabel());
  applyDefaultPlan(battle);
  assert("manual enemy keeps default plan", battle.playerConfig.style === "current", battle.playerConfig.style);
  assert("manual enemy overrides style default", battle.enemyId === "swift", battle.enemyId);
  assert("manual enemy hp applied", battle.enemyMaxHp === 160, String(battle.enemyMaxHp));
  assert("manual enemy does not apply encounter", battle.activeEncounterId === null, battle.activeEncounterId || "none");
  assert("manual enemy log mentions manual mode", logs.some(line => line.includes("手动敌人") && line.includes("迅捷刺客")), logs.join(" | "));
}

function verifyEncounterOverride() {
  const { battle, logs } = createBattle({ enemyId: "encounter:arcane_conduit" });
  assert("encounter label visible", battle.getEnemySelectionLabel().includes("秘术回廊"), battle.getEnemySelectionLabel());
  applyDefaultPlan(battle);
  assert("encounter override active", battle.activeEncounterId === "arcane_conduit", battle.activeEncounterId || "none");
  assert("encounter override enemy applied", battle.enemyId === "caster", battle.enemyId);
  assert("encounter override hp applied", battle.enemyMaxHp === 190, String(battle.enemyMaxHp));
  assert("encounter start spell energy", battle.playerState.spellEnergy >= 36, String(battle.playerState.spellEnergy));
  assert("encounter attack pattern first", battle.enemyAttack && battle.enemyAttack.id === "spellCast", battle.enemyAttack?.id || "none");
  battle.startPlayerTurn();
  battle.startEnemyTurn();
  assert("encounter attack pattern second", battle.enemyAttack && battle.enemyAttack.id === "arcaneBolt", battle.enemyAttack?.id || "none");
  assert("encounter log mentions named encounter", logs.some(line => line.includes("指定遭遇") && line.includes("秘术回廊")), logs.join(" | "));
}

function verifyEncounterEnemyTurnFlow() {
  const { input, battle } = createDefaultBattle({ enemyId: "encounter:arcane_conduit" });
  assert("encounter enemy turn starts", battle.turnState === "enemy_turn", battle.turnState);
  assert("encounter enemy first attack", battle.enemyAttack && battle.enemyAttack.id === "spellCast", battle.enemyAttack?.id || "none");
  assert("encounter response duration adjusted", battle.enemyAttack.responseDuration < Difficulty.responseDuration(), String(battle.enemyAttack.responseDuration));

  assert("encounter enemy reaches response", runUntil(battle, () => battle.enemyAttackPhase === "response", 4), battle.enemyAttackPhase);
  input.injectKey("SPACE", "press");
  tick(battle, 1 / 120, 1 / 120);
  assert("encounter defense qte starts", battle.turnState === "qte_running", battle.turnState);
  assert("encounter defense qte source", battle.qteRunner && battle.qteRunner.context.source === "enemy", battle.qteRunner?.context?.source || "none");
  input.injectKey("SPACE", "release");
  tick(battle, 0.08);
  assert("encounter defense qte resolves to followup", runUntil(battle, () => battle.turnState === "followup_turn", 6), battle.turnState);
  assert("encounter defense keeps player alive", battle.playerHp > 0, String(battle.playerHp));
}

function verifyEncounterPhasePatterns() {
  const { battle, logs } = createDefaultBattle({ enemyId: "encounter:knife_rain" });
  assert("phase test encounter active", battle.activeEncounterId === "knife_rain", battle.activeEncounterId || "none");

  assert("knife rain opens with quick stab", battle.enemyAttack && battle.enemyAttack.id === "quickStab", battle.enemyAttack?.id || "none");
  battle.startFollowupTurn({ source: "smoke" });
  battle.startEnemyTurn();
  assert("knife rain avoids double quick stab", battle.enemyAttack && battle.enemyAttack.id === "slash", battle.enemyAttack?.id || "none");

  battle.startFollowupTurn({ source: "smoke" });
  battle.enemyHp = Math.floor(battle.enemyMaxHp * 0.45);
  battle.startEnemyTurn();
  assert("knife rain phase activates", battle.activeEncounterPhaseId === "close_quarters", battle.activeEncounterPhaseId || "none");
  assert("knife rain phase pattern resets", battle.enemyAttack && battle.enemyAttack.id === "quickStab", battle.enemyAttack?.id || "none");
  assert("knife rain phase logged", logs.some(line => line.includes("贴身追刺")), logs.join(" | "));
  battle.startFollowupTurn({ source: "smoke" });
  battle.startEnemyTurn();
  assert("knife rain phase second attack", battle.enemyAttack && battle.enemyAttack.id === "thrust", battle.enemyAttack?.id || "none");
}

function verifyBattleResultSummary() {
  const { battle } = createDefaultBattle({ enemyId: "encounter:knife_rain" });
  battle.enemyHp = Math.floor(battle.enemyMaxHp * 0.45);
  battle.activeEncounterPhaseId = "close_quarters";
  battle.battleStats.damageDealt = 88;
  battle.battleStats.hits = 4;
  battle.battleStats.attempts = 5;
  battle.battleStats.perfectCount = 2;
  battle.battleStats.maxCombo = 3;
  battle.battleStats.hitsTaken = 1;
  const lines = battle.getBattleResultLines();
  assert("battle result summary has phase", lines.some(line => line.includes("阶段") && line.includes("贴身追刺")), lines.join(" | "));
  assert("battle result summary has accuracy", lines.some(line => line.includes("命中率：80%")), lines.join(" | "));
  assert("battle result summary has hp", lines.some(line => line.includes("剩余 HP")), lines.join(" | "));
}

function verifyQteStartKeySuppression() {
  const { input, battle } = createDefaultBattle({ enemyId: "encounter:arcane_conduit" });

  battle.startFollowupTurn({ source: "smoke" });
  input.injectKey("A", "press");
  tick(battle, 0.04);
  assert("qte start suppression enters qte", battle.turnState === "qte_running", battle.turnState);
  assert("qte start suppression chain", battle.qteRunner && battle.qteRunner.context.chainId === "dualblades_a_v2", battle.qteRunner?.context?.chainId || "none");

  input.injectKey("A", "release");
  tick(battle, 0.12);
  assert("qte start release ignored", battle.qteRunner.resultLog.length === 0, JSON.stringify(battle.qteRunner.resultLog));
  assert("qte start stays on first node", battle.qteRunner.currentNode().id === "dash", battle.qteRunner.currentNode().id);

  input.injectKey("A", "press");
  tick(battle, 0.18);
  input.injectKey("A", "release");
  tick(battle, 0.04);
  assert("qte fresh release advances", battle.qteRunner.resultLog.length === 1, JSON.stringify(battle.qteRunner.resultLog));
  assert("qte fresh press leaves opening node", battle.qteRunner.currentNode().id !== "dash", battle.qteRunner.currentNode().id);
}

function verifyCombatPacing() {
  const { input, battle } = createDefaultBattle({ enemyId: "encounter:arcane_conduit" });
  assert("combat pacing action bar compressed", battle.actionBarMax <= 3.5, String(battle.actionBarMax));
  assert("combat pacing resolve breathes", battle.resolveDuration >= 0.6, String(battle.resolveDuration));

  battle.startFollowupTurn({ source: "smoke" });
  tap(input, battle, "S");
  assert("combat pacing qte starts", battle.turnState === "qte_running" && battle.qteRunner, battle.turnState);
  assert("combat pacing qte time slows instead of widening", battle.qteRunner.timeScale <= 0.82, String(battle.qteRunner.timeScale));
  assert("combat pacing qte node pause breathes", battle.qteRunner.postNodePause >= 0.10, String(battle.qteRunner.postNodePause));
  assert("combat pacing qte handfeel unchanged", Utils.getChainHandfeel(ChainDatabase.dualblades_s_v2, { chainId: "dualblades_s_v2", source: "player" }).windowPad === battle.qteRunner.handfeel.windowPad, JSON.stringify(battle.qteRunner.handfeel));

  battle.startEnemyTurn();
  assert("combat pacing enemy windup readable", battle.enemyAttack.windup >= 1.8, String(battle.enemyAttack.windup));
  assert("combat pacing turn banner readable", battle.turnBanner && battle.turnBanner.maxTime >= 1.4, String(battle.turnBanner?.maxTime || 0));
}

function verifyActiveAttackQteResolution() {
  const { input, battle } = createDefaultBattle();
  const enemyStart = battle.enemyHp;

  battle.startFollowupTurn({ source: "smoke" });
  tap(input, battle, "A");
  assert("active attack qte starts qte", battle.turnState === "qte_running" && battle.qteRunner, battle.turnState);
  battle.qteRunner.forceOutcome("success");

  assert("active attack qte creates attack", runUntil(battle, () => battle.turnState === "attack_active" && battle.activeAttackSystem.active.length > 0, 8), battle.turnState);
  const qteAttacks = battle.activeAttackSystem.active.filter(attack => attack.intent.kind === "playerQTE");
  assert("active attack qte splits melee hits", qteAttacks.length >= 2 && qteAttacks.some(attack => attack.intent.suppressFlowComplete), `${qteAttacks.length} hits`);
  assert("active attack qte clears runner", !battle.qteRunner, "runner still set");
  assert("active attack qte keeps hp before travel", battle.enemyHp === enemyStart, `${battle.enemyHp}/${enemyStart}`);

  const active = qteAttacks[0];
  tick(battle, Math.max(0.05, active.profile.impactTime * 0.5));
  assert("active attack qte holds damage before impact", battle.enemyHp === enemyStart, `${battle.enemyHp}/${enemyStart}`);
  assert("active attack qte eventually applies damage", runUntil(battle, () => battle.enemyHp < enemyStart, 8), `${battle.enemyHp}/${enemyStart}`);
  assert("active attack qte records active attack", battle.activeAttackSystem.recent.some(attack => attack.intent.kind === "playerQTE"), "no playerQTE recent");
}

function verifyEnemyActiveAttackTiming() {
  const { battle } = createDefaultBattle({ enemyId: "encounter:arcane_conduit" });
  const playerStart = battle.playerHp;
  assert("enemy active attack starts", battle.activeAttackSystem.active.some(attack => attack.intent.kind === "enemyAttack"), "no enemy active");
  const active = battle.activeAttackSystem.active.find(attack => attack.intent.kind === "enemyAttack");
  const reactionLead = active.profile.impactTime - active.profile.reactionStart;
  assert("enemy active reaction close to impact", reactionLead <= 0.36 && reactionLead >= 0.16, String(reactionLead));
  tick(battle, 0.4);
  assert("enemy active attack no early damage", battle.playerHp === playerStart, `${battle.playerHp}/${playerStart}`);
  assert("enemy active attack reaches reaction", runUntil(battle, () => battle.enemyAttackPhase === "response", 4), battle.enemyAttackPhase);
}

function verifyDefaultEnemyAttackChain() {
  const { input, battle } = createDefaultBattle({ enemyId: "encounter:counter_dojo" });
  assert("default plan selected", battle.playerConfig.style === "current", battle.playerConfig.style);
  assert("default encounter active", battle.activeEncounterId === "counter_dojo", battle.activeEncounterId || "none");

  assert("default enemy chain active", battle.enemyAttackChain && battle.enemyAttackChain.id === "bladeRushTriple", battle.enemyAttackChain?.id || "none");
  assert("default commits multi enemy attacks", battle.activeAttackSystem.active.filter(attack => attack.intent.kind === "enemyAttack").length >= 3, String(battle.activeAttackSystem.active.length));
  const firstMelee = battle.activeAttackSystem.active.find(attack => attack.intent.kind === "enemyAttack" && attack.intent.chainIndex === 0);
  assert("default melee node carries contact timeline", !!(firstMelee && firstMelee.profile.meleeTimeline && firstMelee.profile.meleeTimeline.contactFrame > 0), firstMelee ? firstMelee.intent.attackId : "none");
  assert("default melee impact uses contact frame", Math.abs(firstMelee.profile.impactTime - firstMelee.profile.meleeTimeline.contactFrame) < 0.001, `${firstMelee.profile.impactTime}/${firstMelee.profile.meleeTimeline.contactFrame}`);
  tick(battle, 0.26);
  const stagedEnemy = battle.getActorMeleeOffset("enemy");
  assert("default melee staging advances enemy", stagedEnemy.x < -45 && stagedEnemy.intensity > 0.2, `${Math.round(stagedEnemy.x)}/${stagedEnemy.intensity.toFixed(2)}`);
  assert("default reaches response", runUntil(battle, () => battle.enemyAttackPhase === "response", 4), battle.enemyAttackPhase);

  const enemyStart = battle.enemyHp;
  const canceledByClash = () => battle.activeAttackSystem.recent.filter(attack => attack.intent.kind === "enemyAttack" && attack.canceled && attack.defenderResponse === "clash").length;
  const currentNodeIndex = () => {
    const incoming = battle.getIncomingActiveAttack();
    return incoming && incoming.intent ? incoming.intent.chainIndex : -1;
  };

  assert("default first counter node is first chain node", currentNodeIndex() === 0, String(currentNodeIndex()));
  tap(input, battle, "A");
  assert("default first node creates one melee counter", battle.activeAttackSystem.recent.some(attack => attack.intent.kind === "defenseCounter" && attack.intent.counterNodeTargetId), battle.turnState);
  assert("default first node cancels only one enemy node", runUntil(battle, () => canceledByClash() === 1, 4), String(canceledByClash()));
  assert("default first node does not open followup", battle.turnState !== "followup_turn", battle.turnState);
  assert("default second counter window opens", runUntil(battle, () => battle.enemyAttackPhase === "response" && currentNodeIndex() === 1, 5), `${battle.enemyAttackPhase}/${currentNodeIndex()}`);

  tap(input, battle, "A");
  assert("default second node cancels exactly two total nodes", runUntil(battle, () => canceledByClash() === 2, 4), String(canceledByClash()));
  assert("default third counter window opens", runUntil(battle, () => battle.enemyAttackPhase === "response" && currentNodeIndex() === 2, 5), `${battle.enemyAttackPhase}/${currentNodeIndex()}`);

  tap(input, battle, "A");
  assert("default third node cancels all three nodes", runUntil(battle, () => canceledByClash() === 3, 4), String(canceledByClash()));
  assert("default sequential counters damage enemy", runUntil(battle, () => battle.enemyHp < enemyStart, 8), `${battle.enemyHp}/${enemyStart}`);
  assert("default sequential counters open followup turn", runUntil(battle, () => battle.turnState === "followup_turn", 8), battle.turnState);
}

function verifyEarlyCounterWhiffPunish() {
  const { input, battle } = createDefaultBattle({ enemyId: "encounter:counter_dojo" });
  const playerStart = battle.playerHp;
  assert("early counter setup enemy chain", battle.enemyAttackChain && battle.enemyAttackChain.id === "bladeRushTriple", battle.enemyAttackChain?.id || "none");

  tap(input, battle, "A");
  const earlyCounter = battle.activeAttackSystem.recent.find(attack => attack.intent.kind === "defenseCounter" && attack.intent.motion === "whiff");
  assert("early counter creates whiff attack", !!earlyCounter && earlyCounter.intent.label === "counterEarlyWhiff", earlyCounter ? earlyCounter.intent.label : "none");
  assert("early counter does not cancel enemy node immediately", !battle.activeAttackSystem.recent.some(attack => attack.intent.kind === "enemyAttack" && attack.canceled && attack.defenderResponse === "clash"), "unexpected clash cancel");
  assert("early counter locks defense until impact", battle.defenseTriggered && battle.defenseMode === "failedCounter", `${battle.defenseTriggered}/${battle.defenseMode}`);
  assert("early counter whiff is punished by hit", runUntil(battle, () => battle.playerHp < playerStart, 5), `${battle.playerHp}/${playerStart}`);
}

function verifySpellInterruptEnemyTurn() {
  const { input, battle } = createDefaultBattle({ enemyId: "encounter:counter_dojo" });
  let followupOpened = false;
  let counterCompleted = false;
  const originalStartFollowupTurn = battle.startFollowupTurn.bind(battle);
  const originalOnActiveAttackComplete = battle.onActiveAttackComplete.bind(battle);
  battle.startFollowupTurn = (context = {}) => {
    followupOpened = true;
    return originalStartFollowupTurn(context);
  };
  battle.onActiveAttackComplete = (attack) => {
    if (attack && attack.intent && attack.intent.kind === "defenseCounter") counterCompleted = true;
    return originalOnActiveAttackComplete(attack);
  };

  battle.startFollowupTurn({ source: "smoke" });
  battle.startEnemyTurn();
  followupOpened = false;
  assert("spell interrupt uses spell chain", battle.enemyAttackChain && battle.enemyAttackChain.id === "spellDoubleCut", battle.enemyAttackChain?.id || "none");
  assert("spell interrupt setup reaches spell response", runUntil(battle, () => {
    const incoming = battle.getIncomingActiveAttack();
    return incoming
      && incoming.phase === "reaction"
      && incoming.intent
      && incoming.intent.attackId === "arcaneBolt";
  }, 4), battle.enemyAttackPhase);

  const enemyStart = battle.enemyHp;
  input.injectKey("A", "press", { fresh: true });
  tick(battle, 0.08);
  assert("spell interrupt holds hp before impact", battle.enemyHp === enemyStart, `${battle.enemyHp}/${enemyStart}`);
  input.injectKey("A", "release");
  tick(battle, 0.08);
  assert("spell interrupt does not start qte", battle.turnState !== "qte_running" && !battle.qteRunner, battle.turnState);
  assert("spell interrupt cancels enemy chain nodes", runUntil(battle, () => battle.activeAttackSystem.recent.filter(attack => attack.intent.kind === "enemyAttack" && attack.canceled && attack.defenderResponse === "interrupt").length >= 2, 4), String(battle.activeAttackSystem.recent.length));
  const spellInterruptCounter = battle.activeAttackSystem.recent.find(attack => attack.intent.kind === "defenseCounter" && attack.intent.interruptTargetIds);
  assert("spell interrupt creates counter attack", !!spellInterruptCounter, battle.turnState);
  assert("spell interrupt counter carries followup", !!(spellInterruptCounter.intent && spellInterruptCounter.intent.interruptContext), JSON.stringify(spellInterruptCounter.intent && spellInterruptCounter.intent.interruptContext));
  assert("spell interrupt eventually damages enemy", runUntil(battle, () => battle.enemyHp < enemyStart, 8), `${battle.enemyHp}/${enemyStart}`);
  assert("spell interrupt counter completes", counterCompleted || runUntil(battle, () => counterCompleted, 8), battle.turnState);
  assert("spell interrupt opens followup turn", followupOpened || runUntil(battle, () => battle.turnState === "followup_turn", 8), battle.turnState);
}

function verifyPersistentGuardStance() {
  const { input, battle } = setupSingleEnemyAttack("slash", { weapon: "swordShield" });
  const playerStart = battle.playerHp;
  input.injectKey("F", "press");
  tick(battle, 0.12);
  assert("persistent guard enters stance", battle.guardStance.active && battle.playerState.currentState === "shield", JSON.stringify(battle.getGuardStanceView()));
  assert("persistent guard waits for contact", battle.playerHp === playerStart, `${battle.playerHp}/${playerStart}`);
  assert("persistent guard blocks at contact", runUntil(battle, () => (battle.combatTelemetry.counters.guardBlocks || 0) >= 1, 3), battle.getCombatTelemetryLines(3).join(" | "));
  assert("persistent guard reduces contact damage", battle.playerHp > playerStart - 12, `${battle.playerHp}/${playerStart}`);
  assert("persistent guard telemetry export includes guard", battle.getCombatTelemetryExport().guard.lastResult === "blocked", JSON.stringify(battle.getCombatTelemetryExport().guard));

  const release = setupSingleEnemyAttack("slash", { weapon: "swordShield" });
  release.input.injectKey("F", "press");
  tick(release.battle, 0.10);
  release.input.injectKey("F", "release");
  tick(release.battle, 0.12);
  const releaseStart = release.battle.playerHp;
  assert("persistent guard release exits stance", !release.battle.guardStance.active, JSON.stringify(release.battle.getGuardStanceView()));
  assert("released guard does not block contact", runUntil(release.battle, () => release.battle.playerHp < releaseStart, 3), `${release.battle.playerHp}/${releaseStart}`);
  assert("released guard has no block count", (release.battle.combatTelemetry.counters.guardBlocks || 0) === 0, JSON.stringify(release.battle.combatTelemetry.counters));

  const broken = setupSingleEnemyAttack("heavySmash", { weapon: "swordShield" });
  broken.input.injectKey("F", "press");
  tick(broken.battle, 0.10);
  broken.battle.guardStance.stability = 4;
  assert("low stability guard breaks on heavy contact", runUntil(broken.battle, () => (broken.battle.combatTelemetry.counters.guardBreaks || 0) >= 1, 4), broken.battle.getCombatTelemetryLines(4).join(" | "));
}

function verifyWeaponDifferentiationAndTelemetryExport() {
  const weapons = context.WeaponDatabase;
  assert("weapon profile adds sword shield", !!weapons.swordShield && weapons.swordShield.guardProfile.maxStability > weapons.dualBlades.guardProfile.maxStability, JSON.stringify(Object.keys(weapons)));
  assert("dual blades recover faster than greatsword", weapons.dualBlades.counterProfile.recovery < weapons.greatsword.counterProfile.recovery, `${weapons.dualBlades.counterProfile.recovery}/${weapons.greatsword.counterProfile.recovery}`);
  assert("greatsword has stronger finisher posture", weapons.greatsword.counterProfile.finisherPostureDamage > weapons.dualBlades.counterProfile.postureDamage, `${weapons.greatsword.counterProfile.finisherPostureDamage}/${weapons.dualBlades.counterProfile.postureDamage}`);

  const { battle } = createDefaultBattle();
  const payload = battle.getCombatTelemetryExport();
  assert("telemetry export schema", payload.schema === "qte-counterflow-telemetry/v1" && payload.localOnly === true, JSON.stringify(payload));
  assert("telemetry export includes weapon encounter difficulty", !!payload.weapon && !!payload.encounter && !!payload.difficulty, JSON.stringify(payload));
  assert("damage path audit classifies public damage", battle.getDamagePathAudit().some(item => item.category === "enemy_active_attack" && item.route === "hit-confirmed"), JSON.stringify(battle.getDamagePathAudit()));
}

function verifyWeaponOverrideAssistDirectorAndAnimationEvents() {
  const override = createBattle({ weaponId: "greatsword" });
  applyDefaultPlan(override.battle);
  assert("weapon override applies greatsword", override.battle.playerConfig.weapon === "greatsword", override.battle.playerConfig.weapon || "none");
  assert("weapon override maps QTE chains", override.battle.getEffectiveChains().A === "greatsword_a_v2", override.battle.getEffectiveChains().A || "none");
  assert("weapon override identity exports", override.battle.getCombatTelemetryExport().weaponIdentity.id === "greatsword", JSON.stringify(override.battle.getCombatTelemetryExport().weaponIdentity));

  const assist = createDefaultBattle();
  const assistProfile = assist.battle.getDifficultyAssistProfile();
  assert("difficulty assist profile uses time pacing", assistProfile.chainOffsetMul > 1 && assistProfile.qteWindowMul <= 1, JSON.stringify(assistProfile));
  assist.battle.startFollowupTurn({ source: "smoke" });
  assist.battle.startEnemyTurn();
  const secondNode = assist.battle.activeAttackSystem.active.find(attack => attack.intent.kind === "enemyAttack" && attack.intent.chainIndex === 1);
  assert("difficulty assist spaces later chain nodes", !!secondNode && secondNode.intent.timelineOffset > 1.02, secondNode ? String(secondNode.intent.timelineOffset) : "none");
  const animationEvents = assist.battle.getActiveAnimationEvents();
  assert("animation events expose active attack contract", animationEvents.length > 0 && animationEvents[0].phase && animationEvents[0].contactFrame !== null && animationEvents[0].activeStart !== null, JSON.stringify(animationEvents));

  assist.battle.combatTelemetry.counters.earlyCounters = 6;
  assist.battle.startFollowupTurn({ source: "smoke" });
  assist.battle.startEnemyTurn();
  assert("enemy director does not alter beginner route", assist.battle.activeEncounterId === "counter_tutorial" && assist.battle.enemyDirector.lastPick === "", JSON.stringify(assist.battle.getEnemyDirectorView()));

  const advanced = createDefaultBattle({ enemyId: "encounter:counter_dojo" });
  advanced.battle.combatTelemetry.counters.earlyCounters = 4;
  advanced.battle.startFollowupTurn({ source: "smoke" });
  advanced.battle.startEnemyTurn();
  assert("enemy director can select delayed pressure in dojo", advanced.battle.enemyAttackChain && advanced.battle.enemyAttackChain.id === "delayedCleaveMix", advanced.battle.enemyAttackChain ? advanced.battle.enemyAttackChain.id : "none");
  const directorView = advanced.battle.getEnemyDirectorView();
  assert("enemy director telemetry records reason", directorView.enabled && directorView.lastPick === "delayedCleaveMix" && directorView.lastReason === "earlyCounter", JSON.stringify(directorView));
}

function verifyArmorShieldDefenseStats() {
  const { battle } = createBattle();
  battle.applyStyle("current");
  battle.applyEnemyArchetype("shielded");
  const enemyStart = battle.enemyHp;
  const result = battle.confirmDamage({
    source: "player",
    target: "enemy",
    token: "smoke:shielded:defense",
    shape: "arc",
    anchor: "playerHand",
    toAnchor: "enemyCore",
    damage: 20,
    label: "shieldedDefenseSmoke",
    weapon: "dualBlades"
  });
  assert("shielded enemy hit confirms", result.confirmed === true, JSON.stringify(result));
  assert("shielded enemy mitigates melee damage", battle.enemyHp > enemyStart - 20 && battle.enemyHp < enemyStart, `${battle.enemyHp}/${enemyStart}`);
  assert("shield mitigation telemetry recorded", (battle.combatTelemetry.counters.shieldMitigations || 0) >= 1, JSON.stringify(battle.combatTelemetry.counters));
  assert("battle summary explains shield mitigation", battle.getBattleResultLines().some(line => line.includes("防护") && line.includes("盾牌减伤")), battle.getBattleResultLines().join(" | "));
}

function verifyResourcePolicyClosure() {
  const heatSetup = createBattle({ enemyId: "encounter:ember_bulwark" });
  heatSetup.battle.applyStyle("current");
  assert("opening heat applied", heatSetup.battle.resourceSystem.heat === 12, String(heatSetup.battle.resourceSystem.heat));
  heatSetup.battle.startEnemyTurn();
  assert("opening heat survives first enemy turn", heatSetup.battle.resourceSystem.heat === 12, String(heatSetup.battle.resourceSystem.heat));
  heatSetup.battle.startFollowupTurn({ source: "smoke" });
  heatSetup.battle.startEnemyTurn();
  assert("heat decays on later enemy boundary", heatSetup.battle.resourceSystem.heat === 4, String(heatSetup.battle.resourceSystem.heat));
  assert("heat decay telemetry recorded", heatSetup.battle.combatTelemetry.events.some(event => event.type === "heatDecay"), JSON.stringify(heatSetup.battle.combatTelemetry.events));

  const burnSetup = createBattle();
  burnSetup.battle.applyStyle("current");
  burnSetup.battle.statusSystem.apply({ target: "enemy", type: "burn", turns: 1 }, { source: "smoke" });
  const burnEnemyStart = burnSetup.battle.enemyHp;
  burnSetup.battle.startEnemyTurn();
  assert("burn ticks at enemy turn start", burnSetup.battle.enemyHp === burnEnemyStart - 4, `${burnSetup.battle.enemyHp}/${burnEnemyStart}`);

  const whiffSetup = createBattle();
  whiffSetup.battle.applyStyle("current");
  const heatBeforeWhiff = whiffSetup.battle.resourceSystem.heat;
  const whiffResult = whiffSetup.battle.resolvePlayerQTEImpact({
    intent: {
      damageIntent: {
        source: "player",
        target: "enemy",
        token: "smoke-qte-whiff-resource",
        rect: { x: 4, y: 4, w: 8, h: 8 },
        damage: 9,
        label: "resourceWhiff"
      },
      effects: {
        resources: { heat: 12 },
        statuses: [{ target: "enemy", type: "burn", turns: 1 }]
      },
      context: { chainFamily: "fire" }
    }
  });
  assert("qte whiff blocks impact resources", whiffResult.confirmed === false && whiffSetup.battle.resourceSystem.heat === heatBeforeWhiff, JSON.stringify(whiffResult));
  assert("qte whiff blocks impact statuses", !whiffSetup.battle.statusSystem.has("burn", "enemy"), whiffSetup.battle.statusSystem.getDebugLines().join(" | "));

  const split = whiffSetup.battle.splitQTEEffectsForActiveAttack({
    resources: { spellEnergy: -60, heat: 12 },
    statuses: [{ target: "enemy", type: "burn", turns: 1 }],
    absorbReady: true
  });
  assert("negative resource cost stays commit-side", split.commit.resources.spellEnergy === -60 && split.impact.resources.spellEnergy === undefined, JSON.stringify(split));
  assert("positive resource gain waits for impact", split.impact.resources.heat === 12 && split.commit.resources.heat === undefined, JSON.stringify(split));
  assert("resource policy telemetry exports", whiffSetup.battle.getCombatTelemetryExport().resourcePolicy.whiff.positiveResourcesRequireConfirmedImpact === true, JSON.stringify(whiffSetup.battle.getCombatTelemetryExport().resourcePolicy));
  assert("absorb overflow cost policy fixed", context.SpellDatabase.absorb.overflowCostPolicy === "fixed" && ChainDatabase.overflow_burst.cost.spellEnergy === 60, JSON.stringify(context.SpellDatabase.absorb));
}

function verifyLearningFeedbackAndWeaponIdentity() {
  const { input, battle } = createDefaultBattle();
  const openingObjective = battle.getLearningObjectiveView();
  assert("learning objective opens on beginner first clash", openingObjective && openingObjective.id === "first-clash", JSON.stringify(openingObjective));
  assert("learning objective warns against early input", openingObjective.lines.some(line => line.includes("早按")), openingObjective.lines.join(" | "));

  battle.startFollowupTurn({ source: "smoke" });
  battle.startEnemyTurn();
  const multiObjective = battle.getLearningObjectiveView();
  assert("learning objective explains per-node response", multiObjective && multiObjective.id === "multi-node" && multiObjective.lines.some(line => line.includes("不能一次输入覆盖")), JSON.stringify(multiObjective));

  const guardSetup = setupSingleEnemyAttack("guardCrush", { weapon: "swordShield" });
  const guardObjective = guardSetup.battle.getLearningObjectiveView();
  assert("learning objective explains guard contact frame", guardObjective && guardObjective.id === "guard-contact" && guardObjective.lines.some(line => line.includes("接触帧")), JSON.stringify(guardObjective));

  const spellSetup = setupSingleEnemyAttack("arcaneBolt");
  const spellObjective = spellSetup.battle.getLearningObjectiveView();
  assert("learning objective explains spell interrupt", spellObjective && spellObjective.id === "spell-interrupt" && spellObjective.lines.some(line => line.includes("打断")), JSON.stringify(spellObjective));

  battle.startFollowupTurn({ source: "smoke" });
  const followupObjective = battle.getLearningObjectiveView();
  assert("learning objective explains followup qte gate", followupObjective && followupObjective.id === "followup" && followupObjective.lines.some(line => line.includes("现在才允许")), JSON.stringify(followupObjective));

  tap(input, battle, "A");
  const qteObjective = battle.getLearningObjectiveView();
  assert("learning objective explains weapon qte state", qteObjective && qteObjective.id === "weapon-qte" && qteObjective.lines.some(line => line.includes("命中帧")), JSON.stringify(qteObjective));

  const early = createDefaultBattle();
  tap(early.input, early.battle, "A");
  const feedback = early.battle.getPlayerFeedbackView();
  assert("feedback view explains early counter", feedback && feedback.tone === "warning" && feedback.line.includes("过早"), JSON.stringify(feedback));

  const identity = battle.getWeaponIdentityView();
  assert("weapon identity payload describes dual blades", identity && identity.id === "dualBlades" && identity.role.includes("连续") && identity.publicTip.includes("逐段"), JSON.stringify(identity));

  const exportPayload = battle.getCombatTelemetryExport();
  assert("telemetry export includes learning objective", !!exportPayload.learningObjective && !!exportPayload.feedback && !!exportPayload.weaponIdentity, JSON.stringify(exportPayload));
  assert("telemetry export includes assist and animation events", !!exportPayload.difficultyAssist && Array.isArray(exportPayload.animationEvents) && !!exportPayload.enemyDirector, JSON.stringify(exportPayload));
}

function verifyExpandedEnemyPressureLibrary() {
  const { battle } = createDefaultBattle({ enemyId: "encounter:counter_dojo" });
  const pattern = context.EncounterDatabase.encounters.counter_dojo.attackPattern || [];
  for (const id of ["rapidTriple", "delayedCleaveMix", "spellBladeTrap", "shieldCrushCombo"]) {
    assert(`counter pressure pattern includes ${id}`, pattern.includes(id), pattern.join(","));
    assert(`enemy attack chain exists ${id}`, !!context.EnemyDatabase.attackChains[id], id);
  }
  assert("delayed cleave has authored melee timeline", !!context.EnemyDatabase.attacks.delayedCleave.meleeTimeline && context.EnemyDatabase.attacks.delayedCleave.counter.type === "heavy_melee", JSON.stringify(context.EnemyDatabase.attacks.delayedCleave));
  assert("guard crush is not clashable", context.EnemyDatabase.attacks.guardCrush.counter.canClash === false && context.EnemyDatabase.attacks.guardCrush.counter.canGuard === true, JSON.stringify(context.EnemyDatabase.attacks.guardCrush.counter));

  while (battle.enemyAttackChain && battle.enemyAttackChain.id !== "rapidTriple") {
    battle.startFollowupTurn({ source: "smoke" });
    battle.startEnemyTurn();
  }
  assert("expanded rapid triple can rotate in default dojo", battle.enemyAttackChain && battle.enemyAttackChain.id === "rapidTriple", battle.enemyAttackChain ? battle.enemyAttackChain.id : "none");
  assert("rapid triple has three nodes", battle.enemyAttackChain.nodes.length === 3, String(battle.enemyAttackChain.nodes.length));
}

function verifyActiveAttackHitStopFreeze() {
  const { input, battle } = createDefaultBattle();
  battle.startFollowupTurn({ source: "smoke" });
  tap(input, battle, "A");
  battle.qteRunner.forceOutcome("success");
  assert("active hitstop setup creates attack", runUntil(battle, () => battle.activeAttackSystem.active.length > 0, 8), battle.turnState);
  const active = battle.activeAttackSystem.active[0];
  const before = active.elapsed;
  battle.hitStop = 0.25;
  tick(battle, 0.12);
  assert("active attack freezes during hitstop", active.elapsed === before, `${active.elapsed}/${before}`);
}

function verifyAllDamageChainsResolveActiveProfiles() {
  for (const [chainId, chain] of Object.entries(ChainDatabase)) {
    const sim = context.ChainEffectSystem.simulateChain(chain, "success");
    if (!sim.effects || sim.effects.damage <= 0) continue;
    const profile = ActiveAttackSystem.resolveProfile({
      source: "player",
      target: "enemy",
      chainId,
      chainFamily: chain.family,
      visualEvents: sim.effects.visualEvents || [],
      damage: sim.effects.damage,
      weapon: chain.family === "dualBlades" ? "dualBlades" : (chain.family === "greatsword" ? "greatsword" : "staff")
    });
  assert(`active profile ${chainId}`, !!profile.type && profile.impactTime > 0 && profile.total > profile.impactTime, JSON.stringify(profile));
    assert(`active frame profile ${chainId}`, profile.activeStart !== undefined && profile.activeDuration > 0 && profile.activeEnd > profile.activeStart, JSON.stringify(profile));
  }
}

function verifyHitConfirmSystem() {
  const { input, battle } = createBattle();
  tap(input, battle, "1");
  const enemyStart = battle.enemyHp;
  const first = battle.confirmDamage({
    source: "player",
    target: "enemy",
    token: "smoke-player-hit",
    shape: "arc",
    anchor: "playerHand",
    toAnchor: "enemyCore",
    damage: 11,
    label: "smoke",
    weapon: "greatsword",
    visualEvent: "greatswordCleavePerfect",
    outcomes: ["perfect"]
  });
  assert("hit confirm player hit confirms", first.confirmed === true, JSON.stringify(first));
  assert("hit confirm enemy hp reduced", battle.enemyHp === enemyStart - 11, `${battle.enemyHp}/${enemyStart}`);
  assert("hit confirm uses dynamic trail hitbox", first.record.hitbox.shape === "trail" && first.record.hitbox.points.length >= 2, JSON.stringify(first.record.hitbox));
  assert("hit confirm records active window", first.record.window && first.record.window.startup > 0 && first.record.window.active > 0, JSON.stringify(first.record.window));

  const duplicate = battle.confirmDamage({
    source: "player",
    target: "enemy",
    token: "smoke-player-hit",
    shape: "arc",
    anchor: "playerHand",
    toAnchor: "enemyCore",
    damage: 11,
    label: "smoke"
  });
  assert("hit confirm duplicate blocked", duplicate.confirmed === false && duplicate.duplicate === true, JSON.stringify(duplicate));
  assert("hit confirm duplicate no double damage", battle.enemyHp === enemyStart - 11, `${battle.enemyHp}/${enemyStart}`);

  const miss = battle.confirmDamage({
    source: "player",
    target: "enemy",
    token: "smoke-player-miss",
    rect: { x: 10, y: 10, w: 20, h: 20 },
    damage: 9,
    label: "smoke-miss"
  });
  assert("hit confirm miss blocks damage", miss.confirmed === false && miss.overlap === false, JSON.stringify(miss));
  assert("hit confirm miss no damage", battle.enemyHp === enemyStart - 11, `${battle.enemyHp}/${enemyStart}`);

  const playerStart = battle.playerHp;
  const enemyHit = battle.confirmDamage({
    source: "enemy",
    target: "player",
    token: "smoke-enemy-hit",
    shape: "beam",
    anchor: "enemyCore",
    toAnchor: "playerCore",
    damage: 7,
    label: "smoke",
    attackId: "heavy_smash",
    visualEvent: "heavy_smash"
  });
  assert("hit confirm enemy hit confirms", enemyHit.confirmed === true, JSON.stringify(enemyHit));
  assert("hit confirm player hp reduced", battle.playerHp === playerStart - 7, `${battle.playerHp}/${playerStart}`);
  assert("hit confirm produces impact response", enemyHit.record.profile.impactForce >= 1, JSON.stringify(enemyHit.record.profile));
  assert("hit confirm debug visible", battle.hitConfirmSystem.getDebugLines(3).some(line => line.includes("命中确认")), battle.hitConfirmSystem.getDebugLines(3).join(" | "));
}

try {
  verifyInputResetReleasesHeldKeys();
  verifyDefaultCombatPlan();
  verifyNoFreePlayerQte();
  verifyDefaultCounterPressureRotation();
  verifyDefaultPlanScope();
  verifyManualEnemyOverride();
  verifyEncounterOverride();
  verifyEncounterEnemyTurnFlow();
  verifyEncounterPhasePatterns();
  verifyBattleResultSummary();
  verifyQteStartKeySuppression();
  verifyCombatPacing();
  verifyActiveAttackQteResolution();
  verifyEnemyActiveAttackTiming();
  verifyDefaultEnemyAttackChain();
  verifyEarlyCounterWhiffPunish();
  verifySpellInterruptEnemyTurn();
  verifyPersistentGuardStance();
  verifyWeaponDifferentiationAndTelemetryExport();
  verifyWeaponOverrideAssistDirectorAndAnimationEvents();
  verifyArmorShieldDefenseStats();
  verifyResourcePolicyClosure();
  verifyLearningFeedbackAndWeaponIdentity();
  verifyExpandedEnemyPressureLibrary();
  verifyActiveAttackHitStopFreeze();
  verifyAllDamageChainsResolveActiveProfiles();
  verifyHitConfirmSystem();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}

console.log("Flow smoke:");
for (const item of results) {
  console.log(`  ${item.ok ? "[OK]" : "[FAIL]"} ${item.label}${item.ok || !item.details ? "" : ` (${item.details})`}`);
}

if (process.exitCode) {
  console.error("Flow smoke failed.");
} else {
  console.log("Flow smoke passed.");
}
