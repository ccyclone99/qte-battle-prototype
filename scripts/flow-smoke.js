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
  ["js/demo-mode.js", ["DemoMode"]],
  ["js/battle.js", ["BattleSystem"]]
].forEach(([relPath, exportNames]) => load(relPath, exportNames));

const {
  BattleSystem,
  DemoMode,
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

function verifyBattleStyle(key, expectedStyle, expectedEnemyHp, actionKey, expectedChainId, expectedEncounterId) {
  const { input, battle, logs } = createBattle();
  tap(input, battle, key);
  assert(`style ${key} enters player turn`, battle.turnState === "player_turn", battle.turnState);
  assert(`style ${key} id`, battle.playerConfig.style === expectedStyle, battle.playerConfig.style);
  assert(`style ${key} enemy hp`, battle.enemyMaxHp === expectedEnemyHp, String(battle.enemyMaxHp));
  if (expectedEncounterId) {
    assert(`style ${key} encounter`, battle.activeEncounterId === expectedEncounterId, battle.activeEncounterId || "none");
  }

  tap(input, battle, actionKey);
  assert(`style ${key} starts QTE`, battle.turnState === "qte_running", battle.turnState);
  assert(`style ${key} QTE chain`, battle.qteRunner && battle.qteRunner.context.chainId === expectedChainId, battle.qteRunner?.context?.chainId || "none");
  assert(`style ${key} log has style`, logs.some(line => line.includes("战斗风格")), logs.join(" | "));
}

function verifyManualEnemyOverride() {
  const { input, battle, logs } = createBattle({ enemyId: "swift" });
  assert("manual enemy label visible", battle.getEnemySelectionLabel().includes("迅捷刺客"), battle.getEnemySelectionLabel());
  tap(input, battle, "6");
  assert("manual enemy keeps selected style", battle.playerConfig.style === "flameforge", battle.playerConfig.style);
  assert("manual enemy overrides style default", battle.enemyId === "swift", battle.enemyId);
  assert("manual enemy hp applied", battle.enemyMaxHp === 160, String(battle.enemyMaxHp));
  assert("manual enemy does not apply encounter", battle.activeEncounterId === null, battle.activeEncounterId || "none");
  assert("manual enemy log mentions manual mode", logs.some(line => line.includes("手动敌人") && line.includes("迅捷刺客")), logs.join(" | "));
}

function verifyEncounterOverride() {
  const { input, battle, logs } = createBattle({ enemyId: "encounter:arcane_conduit" });
  assert("encounter label visible", battle.getEnemySelectionLabel().includes("秘术回廊"), battle.getEnemySelectionLabel());
  tap(input, battle, "7");
  assert("encounter override active", battle.activeEncounterId === "arcane_conduit", battle.activeEncounterId || "none");
  assert("encounter override enemy applied", battle.enemyId === "caster", battle.enemyId);
  assert("encounter override hp applied", battle.enemyMaxHp === 190, String(battle.enemyMaxHp));
  assert("encounter start spell energy", battle.playerState.spellEnergy >= 36, String(battle.playerState.spellEnergy));
  battle.startEnemyTurn();
  assert("encounter attack pattern first", battle.enemyAttack && battle.enemyAttack.id === "spellCast", battle.enemyAttack?.id || "none");
  battle.startPlayerTurn();
  battle.startEnemyTurn();
  assert("encounter attack pattern second", battle.enemyAttack && battle.enemyAttack.id === "arcaneBolt", battle.enemyAttack?.id || "none");
  assert("encounter log mentions named encounter", logs.some(line => line.includes("指定遭遇") && line.includes("秘术回廊")), logs.join(" | "));
}

function verifyEncounterEnemyTurnFlow() {
  const { input, battle } = createBattle({ enemyId: "encounter:arcane_conduit" });
  tap(input, battle, "7");
  battle.startEnemyTurn();
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
  assert("encounter defense qte resolves", runUntil(battle, () => battle.turnState === "player_turn", 6), battle.turnState);
  assert("encounter defense keeps player alive", battle.playerHp > 0, String(battle.playerHp));
}

function verifyEncounterPhasePatterns() {
  const { input, battle, logs } = createBattle({ enemyId: "encounter:knife_rain" });
  tap(input, battle, "3");
  assert("phase test encounter active", battle.activeEncounterId === "knife_rain", battle.activeEncounterId || "none");

  battle.startEnemyTurn();
  assert("knife rain opens with quick stab", battle.enemyAttack && battle.enemyAttack.id === "quickStab", battle.enemyAttack?.id || "none");
  battle.startPlayerTurn();
  battle.startEnemyTurn();
  assert("knife rain avoids double quick stab", battle.enemyAttack && battle.enemyAttack.id === "slash", battle.enemyAttack?.id || "none");

  battle.startPlayerTurn();
  battle.enemyHp = Math.floor(battle.enemyMaxHp * 0.45);
  battle.startEnemyTurn();
  assert("knife rain phase activates", battle.activeEncounterPhaseId === "close_quarters", battle.activeEncounterPhaseId || "none");
  assert("knife rain phase pattern resets", battle.enemyAttack && battle.enemyAttack.id === "quickStab", battle.enemyAttack?.id || "none");
  assert("knife rain phase logged", logs.some(line => line.includes("贴身追刺")), logs.join(" | "));
  battle.startPlayerTurn();
  battle.startEnemyTurn();
  assert("knife rain phase second attack", battle.enemyAttack && battle.enemyAttack.id === "thrust", battle.enemyAttack?.id || "none");
}

function verifyBattleResultSummary() {
  const { input, battle } = createBattle({ enemyId: "encounter:knife_rain" });
  tap(input, battle, "3");
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
  const { input, battle } = createBattle({ enemyId: "encounter:arcane_conduit" });
  tap(input, battle, "7");
  battle.playerState.spellEnergy = 80;

  input.injectKey("D", "press");
  tick(battle, 0.04);
  assert("qte start suppression enters qte", battle.turnState === "qte_running", battle.turnState);
  assert("qte start suppression chain", battle.qteRunner && battle.qteRunner.context.chainId === "overflow_burst", battle.qteRunner?.context?.chainId || "none");

  input.injectKey("D", "release");
  tick(battle, 0.12);
  assert("qte start release ignored", battle.qteRunner.resultLog.length === 0, JSON.stringify(battle.qteRunner.resultLog));
  assert("qte start stays on first node", battle.qteRunner.currentNode().id === "compress", battle.qteRunner.currentNode().id);

  input.injectKey("D", "press");
  tick(battle, 0.18);
  input.injectKey("D", "release");
  tick(battle, 0.04);
  assert("qte fresh release advances", battle.qteRunner.resultLog.length === 1, JSON.stringify(battle.qteRunner.resultLog));
  assert("qte fresh release reaches burst", battle.qteRunner.currentNode().id === "burst", battle.qteRunner.currentNode().id);
}

function verifyCombatPacing() {
  const { input, battle } = createBattle({ enemyId: "encounter:arcane_conduit" });
  tap(input, battle, "7");
  assert("combat pacing action bar breathes", battle.actionBarMax >= 6.5, String(battle.actionBarMax));
  assert("combat pacing resolve breathes", battle.resolveDuration >= 0.6, String(battle.resolveDuration));

  tap(input, battle, "S");
  assert("combat pacing qte starts", battle.turnState === "qte_running" && battle.qteRunner, battle.turnState);
  assert("combat pacing qte time slows instead of widening", battle.qteRunner.timeScale <= 0.82, String(battle.qteRunner.timeScale));
  assert("combat pacing qte node pause breathes", battle.qteRunner.postNodePause >= 0.14, String(battle.qteRunner.postNodePause));
  assert("combat pacing qte handfeel unchanged", Utils.getChainHandfeel(ChainDatabase.absorb_siphon, { chainId: "absorb_siphon", source: "player" }).rhythmPad === battle.qteRunner.handfeel.rhythmPad, JSON.stringify(battle.qteRunner.handfeel));

  battle.startEnemyTurn();
  assert("combat pacing enemy windup readable", battle.enemyAttack.windup >= 1.8, String(battle.enemyAttack.windup));
  assert("combat pacing turn banner readable", battle.turnBanner && battle.turnBanner.maxTime >= 1.4, String(battle.turnBanner?.maxTime || 0));
}

function verifyActiveAttackQteResolution() {
  const { input, battle } = createBattle();
  tap(input, battle, "6");
  const enemyStart = battle.enemyHp;

  tap(input, battle, "A");
  assert("active attack qte starts qte", battle.turnState === "qte_running" && battle.qteRunner, battle.turnState);
  battle.qteRunner.forceOutcome("success");

  assert("active attack qte creates attack", runUntil(battle, () => battle.turnState === "attack_active" && battle.activeAttackSystem.active.length > 0, 8), battle.turnState);
  assert("active attack qte clears runner", !battle.qteRunner, "runner still set");
  assert("active attack qte keeps hp before travel", battle.enemyHp === enemyStart, `${battle.enemyHp}/${enemyStart}`);

  const active = battle.activeAttackSystem.active[0];
  tick(battle, Math.max(0.05, active.profile.impactTime * 0.5));
  assert("active attack qte holds damage before impact", battle.enemyHp === enemyStart, `${battle.enemyHp}/${enemyStart}`);
  assert("active attack qte eventually applies damage", runUntil(battle, () => battle.enemyHp < enemyStart, 8), `${battle.enemyHp}/${enemyStart}`);
  assert("active attack qte records active attack", battle.activeAttackSystem.recent.some(attack => attack.intent.kind === "playerQTE"), "no playerQTE recent");
}

function verifyEnemyActiveAttackTiming() {
  const { input, battle } = createBattle({ enemyId: "encounter:arcane_conduit" });
  tap(input, battle, "7");
  battle.startEnemyTurn();
  const playerStart = battle.playerHp;
  assert("enemy active attack starts", battle.activeAttackSystem.active.some(attack => attack.intent.kind === "enemyAttack"), "no enemy active");
  const active = battle.activeAttackSystem.active.find(attack => attack.intent.kind === "enemyAttack");
  const reactionLead = active.profile.impactTime - active.profile.reactionStart;
  assert("enemy active reaction close to impact", reactionLead <= 0.95 && reactionLead >= 0.45, String(reactionLead));
  tick(battle, 0.4);
  assert("enemy active attack no early damage", battle.playerHp === playerStart, `${battle.playerHp}/${playerStart}`);
  assert("enemy active attack reaches reaction", runUntil(battle, () => battle.enemyAttackPhase === "response", 4), battle.enemyAttackPhase);
}

function verifyActiveAttackHitStopFreeze() {
  const { input, battle } = createBattle();
  tap(input, battle, "6");
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

function createDemo() {
  const input = new InputBuffer();
  const logs = [];
  Difficulty.set("easy");
  const demo = new DemoMode(input, msg => logs.unshift(String(msg)));
  tick(demo);
  return { input, demo, logs };
}

function verifyDemoSpellFlows() {
  const { input, demo, logs } = createDemo();
  tap(input, demo, "1");
  assert("demo opens showcase category", demo.state === "list" && demo.category === "showcases", `${demo.state}/${demo.category}`);
  tap(input, demo, "1");
  assert("demo showcase selected", demo.currentItem && /Showcase/.test(demo.currentItem.name), demo.currentItem?.name || "none");
  assert("demo showcase enters sequence", demo.state === "action_sequence", demo.state);
  assert("demo showcase reaches preview", runUntil(demo, () => demo.state === "preview", 8), demo.state);
  assert("demo showcase logs fire branch", logs.some(line => line.includes("火球分支")), logs.slice(0, 10).join(" | "));
  demo.handleSystemEscape();
  tick(demo, 0.5);
  demo.handleSystemEscape();
  tick(demo, 0.2);

  tap(input, demo, "3");
  assert("demo opens spell category", demo.state === "list" && demo.category === "spells", `${demo.state}/${demo.category}`);
  assert("demo starts on page 1", demo.listPage === 0, String(demo.listPage));

  tap(input, demo, "6");
  assert("demo flame blade selected", demo.currentItem && demo.currentItem.chain === ChainDatabase.flame_blade, demo.currentItem?.name || "none");
  assert("demo flame blade enters QTE", demo.state === "qte", demo.state);
  assert("demo flame blade reaches preview", runUntil(demo, () => demo.state === "preview", 16), demo.state);
  assert("demo flame blade gains heat", demo.resourceSystem.heat >= 30, String(demo.resourceSystem.heat));
  assert("demo flame blade records result", demo.resultLines.some(line => line.includes("热量") || line.includes("破甲")), demo.resultLines.join(" | "));

  demo.handleSystemEscape();
  tick(demo, 0.5);
  assert("demo escape returns to spell list", demo.state === "list" && demo.category === "spells", `${demo.state}/${demo.category}`);
  assert("demo ready for list input", runUntil(demo, () => demo.freezeTimer <= 0 && demo.hitStop <= 0, 4), `freeze=${demo.freezeTimer}, hitStop=${demo.hitStop}`);

  tap(input, demo, "D");
  assert(
    "demo advances to spell page 2",
    demo.listPage === 1,
    `page=${demo.listPage}, state=${demo.state}, category=${demo.category}, freeze=${demo.freezeTimer}, hitStop=${demo.hitStop}, events=${JSON.stringify(input.events)}, held=${JSON.stringify(Array.from(input.heldKeys))}, totalPages=${demo.getTotalPages()}, items=${demo.getCurrentPageItems().map(item => item.name).join(" / ")}`
  );
  tap(input, demo, "3");
  assert("demo overflow selected", demo.currentItem && demo.currentItem.chain === ChainDatabase.overflow_burst, demo.currentItem?.name || "none");
  assert("demo overflow starts with spell energy", demo.playerState.spellEnergy >= 100, String(demo.playerState.spellEnergy));
  assert("demo overflow reaches preview", runUntil(demo, () => demo.state === "preview", 16), demo.state);
  assert("demo overflow records burst", demo.resultLines.some(line => /溢流|法术能量|伤害/.test(line)), demo.resultLines.join(" | "));
  assert("demo logs include overflow", logs.some(line => line.includes("溢流")), logs.slice(0, 8).join(" | "));
}

try {
  verifyInputResetReleasesHeldKeys();
  verifyBattleStyle("6", "flameforge", 280, "A", "flame_blade", "ember_bulwark");
  verifyBattleStyle("7", "mirrorblade", 190, "S", "absorb_siphon", "arcane_conduit");
  verifyManualEnemyOverride();
  verifyEncounterOverride();
  verifyEncounterEnemyTurnFlow();
  verifyEncounterPhasePatterns();
  verifyBattleResultSummary();
  verifyQteStartKeySuppression();
  verifyCombatPacing();
  verifyActiveAttackQteResolution();
  verifyEnemyActiveAttackTiming();
  verifyActiveAttackHitStopFreeze();
  verifyAllDamageChainsResolveActiveProfiles();
  verifyHitConfirmSystem();
  verifyDemoSpellFlows();
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
