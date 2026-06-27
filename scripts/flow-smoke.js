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

function verifyDefaultCombatPlan() {
  const { input, battle, logs } = createBattle();
  applyDefaultPlan(battle);
  assert("default plan enters enemy turn", battle.turnState === "enemy_turn", battle.turnState);
  assert("default plan id", battle.playerConfig.style === "current", battle.playerConfig.style);
  assert("default plan enemy hp", battle.enemyMaxHp === 210, String(battle.enemyMaxHp));
  assert("default plan encounter", battle.activeEncounterId === "counter_dojo", battle.activeEncounterId || "none");
  assert("default plan opens with physical pressure", battle.enemyAttackChain && battle.enemyAttackChain.id === "bladeRushTriple", battle.enemyAttackChain?.id || "none");

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
  assert("counter pressure first chain", battle.enemyAttackChain && battle.enemyAttackChain.id === "bladeRushTriple", battle.enemyAttackChain?.id || "none");
  assert("counter pressure first has three nodes", battle.enemyAttackChain.nodes.length === 3, String(battle.enemyAttackChain.nodes.length));

  battle.startFollowupTurn({ source: "smoke" });
  battle.startEnemyTurn();
  assert("counter pressure second chain", battle.enemyAttackChain && battle.enemyAttackChain.id === "spellDoubleCut", battle.enemyAttackChain?.id || "none");

  battle.startFollowupTurn({ source: "smoke" });
  battle.startEnemyTurn();
  assert("counter pressure third chain", battle.enemyAttackChain && battle.enemyAttackChain.id === "shieldSpellRush", battle.enemyAttackChain?.id || "none");

  const pattern = context.EncounterDatabase.encounters.counter_dojo.attackPattern || [];
  for (const id of ["bladeRushTriple", "spellDoubleCut", "shieldSpellRush", "knifeFlurry", "feintCrush", "curseNeedle"]) {
    assert(`counter pressure pattern includes ${id}`, pattern.includes(id), pattern.join(","));
  }
}

function verifyDefaultPlanScope() {
  const { input, battle } = createBattle();
  applyDefaultPlan(battle);
  const style = battle.getCurrentStyle();
  const chains = battle.getEffectiveChains();
  const encounter = context.EncounterDatabase.encounters.counter_dojo;
  const modifiers = encounter.modifiers || {};

  assert("default plan keeps current id", battle.playerConfig.style === "current", battle.playerConfig.style);
  assert("default plan has no spell loadout", battle.playerConfig.spells.length === 0, battle.playerConfig.spells.join(","));
  assert("default plan has no borrowed combat arts", battle.playerConfig.combatArts.length === 0, battle.playerConfig.combatArts.join(","));
  assert("default plan S remains dual blade", chains.S === "dualblades_s_v2", chains.S || "none");
  assert("default plan D remains dual blade", chains.D === "dualblades_d_v2", chains.D || "none");
  assert("default plan has no counterspell chain", !style.counterChain, style.counterChain || "none");
  assert("default plan keeps dual coverage", battle.getCounterCoverageCount() === 3, String(battle.getCounterCoverageCount()));
  assert("counter dojo gives no spell energy", !("startSpellEnergy" in modifiers), String(modifiers.startSpellEnergy));
  assert("counter dojo gives no absorb boost", !("absorbEnergyMul" in modifiers) && !("absorbDamageMul" in modifiers), JSON.stringify(modifiers));
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
  assert("enemy active reaction close to impact", reactionLead <= 0.95 && reactionLead >= 0.45, String(reactionLead));
  tick(battle, 0.4);
  assert("enemy active attack no early damage", battle.playerHp === playerStart, `${battle.playerHp}/${playerStart}`);
  assert("enemy active attack reaches reaction", runUntil(battle, () => battle.enemyAttackPhase === "response", 4), battle.enemyAttackPhase);
}

function verifyDefaultEnemyAttackChain() {
  const { input, battle } = createDefaultBattle();
  assert("default plan selected", battle.playerConfig.style === "current", battle.playerConfig.style);
  assert("default encounter active", battle.activeEncounterId === "counter_dojo", battle.activeEncounterId || "none");

  assert("default enemy chain active", battle.enemyAttackChain && battle.enemyAttackChain.id === "bladeRushTriple", battle.enemyAttackChain?.id || "none");
  assert("default commits multi enemy attacks", battle.activeAttackSystem.active.filter(attack => attack.intent.kind === "enemyAttack").length >= 3, String(battle.activeAttackSystem.active.length));
  assert("default reaches response", runUntil(battle, () => battle.enemyAttackPhase === "response", 4), battle.enemyAttackPhase);

  const enemyStart = battle.enemyHp;
  input.injectKey("A", "press", { fresh: true });
  tick(battle, 0.08);
  input.injectKey("A", "release");
  tick(battle, 0.08);
  const canceledEnemies = battle.activeAttackSystem.active.filter(attack => attack.intent.kind === "enemyAttack" && attack.canceled).length;
  assert("default interrupt cancels covered nodes", canceledEnemies >= 2, String(canceledEnemies));
  assert("default interrupt creates counter attack", battle.activeAttackSystem.active.some(attack => attack.intent.kind === "defenseCounter"), battle.turnState);
  const clashCounters = battle.activeAttackSystem.active.filter(attack => attack.intent.kind === "defenseCounter");
  assert("default interrupt creates melee counter", clashCounters.length >= 1, `${clashCounters.length} hits`);
  assert("default interrupt eventually damages enemy", runUntil(battle, () => battle.enemyHp < enemyStart, 8), `${battle.enemyHp}/${enemyStart}`);
  assert("default interrupt opens followup turn", runUntil(battle, () => battle.turnState === "followup_turn", 8), battle.turnState);
}

function verifySpellInterruptEnemyTurn() {
  const { input, battle } = createDefaultBattle();
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
  input.injectKey("A", "release");
  tick(battle, 0.08);
  assert("spell interrupt does not start qte", battle.turnState === "attack_active" && !battle.qteRunner, battle.turnState);
  assert("spell interrupt cancels enemy chain nodes", battle.activeAttackSystem.active.filter(attack => attack.intent.kind === "enemyAttack" && attack.canceled).length >= 2, String(battle.activeAttackSystem.active.length));
  const spellInterruptCounter = battle.activeAttackSystem.active.find(attack => attack.intent.kind === "defenseCounter");
  assert("spell interrupt creates counter attack", !!spellInterruptCounter, battle.turnState);
  assert("spell interrupt counter carries followup", !!(spellInterruptCounter.intent && spellInterruptCounter.intent.followupContext), JSON.stringify(spellInterruptCounter.intent && spellInterruptCounter.intent.followupContext));
  assert("spell interrupt holds hp before impact", battle.enemyHp === enemyStart, `${battle.enemyHp}/${enemyStart}`);
  assert("spell interrupt eventually damages enemy", runUntil(battle, () => battle.enemyHp < enemyStart, 8), `${battle.enemyHp}/${enemyStart}`);
  assert("spell interrupt counter completes", counterCompleted || runUntil(battle, () => counterCompleted, 8), battle.turnState);
  assert("spell interrupt opens followup turn", followupOpened || runUntil(battle, () => battle.turnState === "followup_turn", 8), battle.turnState);
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
  verifySpellInterruptEnemyTurn();
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
