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
  ["js/data/styles.js", ["StyleDatabase"]],
  ["js/data/effects.js", ["EffectEventDefinitions"]],
  ["js/systems/statuses.js", ["StatusDefinitions", "StatusSystem"]],
  ["js/systems/resources.js", ["ResourceDefinitions", "ResourceSystem"]],
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
  ChainDatabase
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

function createBattle() {
  const input = new InputBuffer();
  const logs = [];
  Difficulty.set("easy");
  const battle = new BattleSystem(input, { practiceMode: false });
  battle.onLog = msg => logs.unshift(String(msg));
  tick(battle);
  return { input, battle, logs };
}

function verifyBattleStyle(key, expectedStyle, expectedEnemyHp, actionKey, expectedChainId) {
  const { input, battle, logs } = createBattle();
  tap(input, battle, key);
  assert(`style ${key} enters player turn`, battle.turnState === "player_turn", battle.turnState);
  assert(`style ${key} id`, battle.playerConfig.style === expectedStyle, battle.playerConfig.style);
  assert(`style ${key} enemy hp`, battle.enemyMaxHp === expectedEnemyHp, String(battle.enemyMaxHp));

  tap(input, battle, actionKey);
  assert(`style ${key} starts QTE`, battle.turnState === "qte_running", battle.turnState);
  assert(`style ${key} QTE chain`, battle.qteRunner && battle.qteRunner.context.chainId === expectedChainId, battle.qteRunner?.context?.chainId || "none");
  assert(`style ${key} log has style`, logs.some(line => line.includes("战斗风格")), logs.join(" | "));
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
  tap(input, demo, "2");
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
  verifyBattleStyle("6", "flameforge", 260, "A", "flame_blade");
  verifyBattleStyle("7", "mirrorblade", 170, "S", "absorb_siphon");
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
