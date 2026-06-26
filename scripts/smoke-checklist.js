#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { root, loadDataContext } = require("./lib/load-data");

const context = loadDataContext();
const {
  ChainDatabase,
  SpellDatabase,
  StyleDatabase,
  EnemyDatabase,
  EffectEventDefinitions
} = context;

const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const mainJs = fs.readFileSync(path.join(root, "js/main.js"), "utf8");
const demoModeJs = fs.readFileSync(path.join(root, "js/demo-mode.js"), "utf8");
const battleJs = fs.readFileSync(path.join(root, "js/battle.js"), "utf8");
const inputJs = fs.readFileSync(path.join(root, "js/input.js"), "utf8");
const rendererJs = fs.readFileSync(path.join(root, "js/renderer.js"), "utf8");
const audioJs = fs.readFileSync(path.join(root, "js/audio.js"), "utf8");
const chainsJs = fs.readFileSync(path.join(root, "js/data/chains.js"), "utf8");
const qteDebugJs = fs.readFileSync(path.join(root, "js/systems/qte-debug.js"), "utf8");
const styleCss = fs.readFileSync(path.join(root, "style.css"), "utf8");
const specMd = fs.readFileSync(path.join(root, "SPEC.md"), "utf8");
const visualSmokePath = path.join(root, "scripts/visual-smoke.js");
const visualSmokeJs = fs.existsSync(visualSmokePath) ? fs.readFileSync(visualSmokePath, "utf8") : "";
const results = [];

function check(label, condition) {
  results.push({ label, ok: !!condition });
}

function scriptIndex(src) {
  return indexHtml.indexOf(src);
}

function hasChain(id) {
  return !!ChainDatabase[id] && Array.isArray(ChainDatabase[id].nodes) && ChainDatabase[id].nodes.length > 0;
}

check("index loads js/data/effects.js", scriptIndex("js/data/effects.js") >= 0);
check("index loads js/fx.js before effect queue", scriptIndex("js/fx.js") >= 0 && scriptIndex("js/fx.js") < scriptIndex("js/systems/effects.js"));
check("index loads js/systems/chain-effects.js", scriptIndex("js/systems/chain-effects.js") >= 0);
check(
  "effect registry loads before effect system",
  scriptIndex("js/data/effects.js") >= 0 && scriptIndex("js/data/effects.js") < scriptIndex("js/systems/effects.js")
);
check(
  "chain helpers load before demo and qte runner",
  scriptIndex("js/systems/chain-effects.js") >= 0
    && scriptIndex("js/systems/chain-effects.js") < scriptIndex("js/demo-mode.js")
    && scriptIndex("js/systems/chain-effects.js") < scriptIndex("js/qte-runner.js")
);

for (const id of ["greatsword_a_v2", "dualblades_a_v2", "flame_blade", "mirror_guard", "overflow_burst"]) {
  check(`required chain exists: ${id}`, hasChain(id));
}

check("fire spell maps greatsword A to flame_blade", SpellDatabase.fire.chainMap.greatsword.A === "flame_blade");
check("fire spell maps dual blades A to flame_blade", SpellDatabase.fire.chainMap.dualBlades.A === "flame_blade");
check("absorb spell maps staff S to absorb_siphon", SpellDatabase.absorb.chainMap.staff.S === "absorb_siphon");
check("absorb spell maps staff D to overflow_burst", SpellDatabase.absorb.chainMap.staff.D === "overflow_burst");
check("absorb spell maps greatsword D to overflow_burst", SpellDatabase.absorb.chainMap.greatsword.D === "overflow_burst");

check("style flameforge exists on key 6", StyleDatabase.flameforge && StyleDatabase.flameforge.key === "6");
check("style mirrorblade exists on key 7", StyleDatabase.mirrorblade && StyleDatabase.mirrorblade.key === "7");

for (const id of ["caster", "armored", "swift", "shielded"]) {
  check(`enemy archetype exists: ${id}`, !!(EnemyDatabase.archetypes && EnemyDatabase.archetypes[id]));
}

check("fireBladeBurst has burst renderer data", !!(EffectEventDefinitions.fireBladeBurst && EffectEventDefinitions.fireBladeBurst.bursts));
check("overflowBurst has burst renderer data", !!(EffectEventDefinitions.overflowBurst && EffectEventDefinitions.overflowBurst.bursts));
check("greatswordCleavePerfect has burst renderer data", !!(EffectEventDefinitions.greatswordCleavePerfect && EffectEventDefinitions.greatswordCleavePerfect.bursts));
check("renderer has player silhouette helper", rendererJs.includes("drawPlayerSilhouette"));
check("renderer has enemy silhouette helper", rendererJs.includes("drawEnemySilhouette"));
check("renderer has node-timed action helper", rendererJs.includes("getActionTiming"));
check("renderer supports node pose tags", rendererJs.includes("getCurrentPose") && rendererJs.includes("node.pose"));
check("chains include R10 pose tags", chainsJs.includes('motion: "flameBladeCut"') && chainsJs.includes('motion: "overflowBurst"') && chainsJs.includes('motion: "greatswordEarthsplit"'));
check("qte debug shows active pose", qteDebugJs.includes("姿态："));

for (const key of ["1", "2", "3", "4", "5", "6", "7"]) {
  check(`touch controls include numeric key ${key}`, indexHtml.includes(`data-key="${key}"`));
}
check("touch controls include click fallback", mainJs.includes('addEventListener("click"') && mainJs.includes("suppressTouchClick"));
check("touch controls include mouse fallback", mainJs.includes('addEventListener("mousedown"') && mainJs.includes("pressVirtualKey"));
check("touch controls use delegated hit mapping", mainJs.includes("getVirtualKeyFromEvent") && mainJs.includes("nearestDistance"));
check("touch controls handle virtual ESC", mainJs.includes("handleVirtualSystemKey") && mainJs.includes('appState === "battle"'));
check("demo mode exposes system escape handler", demoModeJs.includes("handleSystemEscape") && mainJs.includes("demo.handleSystemEscape"));
check("demo detail opens by default", mainJs.includes('demoDetailDrawer.classList.remove("hidden")'));
check("demo detail uses status lines", mainJs.includes("demo.getStatusLines") && mainJs.includes("demo.getControlHint"));
check("demo includes showcase category", demoModeJs.includes('key: "showcases"') && demoModeJs.includes("Showcase · 火球三分支对比"));
check("demo help advertises showcase", mainJs.includes("亮点演示 Showcase") && mainJs.includes("1-5</b> 选择演示分类"));
check("enemy readout renderer exists", rendererJs.includes("drawEnemyAttackReadout") && rendererJs.includes("推荐"));
check("audio has R7 feedback cues", audioJs.includes("sfxWindowOpen") && audioJs.includes("sfxResourceGain") && audioJs.includes("sfxTransition"));
check("audio has R9 quieter mix baseline", audioJs.includes("masterVolume: 0.30") && audioJs.includes("sfxChargePeak") && audioJs.includes("volume: 0.42"));
check("keyboard input includes style key 7", inputJs.includes('"7"'));
check("timing audit script exists", fs.existsSync(path.join(root, "scripts/check-timing.js")));
check("visual smoke script exists", !!visualSmokeJs);
check("visual smoke uses screenshot capture", visualSmokeJs.includes("Page.captureScreenshot"));
check("visual smoke covers style 7 and replay", visualSmokeJs.includes("battle-style7-qte") && visualSmokeJs.includes("demo-result-replay-qte"));
check("game container uses responsive 16:9 scaling", styleCss.includes("calc(100vh * 16 / 9)") && styleCss.includes("calc(100vw * 9 / 16)"));
check("small viewport compact rules exist", styleCss.includes("@media (max-width: 900px), (max-height: 520px)") && styleCss.includes("#demo-detail-drawer"));
check("mobile demo detail uses bottom sheet layout", styleCss.includes("#demo-detail-drawer .drawer-content") && styleCss.includes("bottom: 8px"));
check("main menu includes manual enemy select", indexHtml.includes('id="enemy-select"') && indexHtml.includes('value="swift"'));
check("battle supports manual enemy override", battleJs.includes("enemyOverrideId") && battleJs.includes("getEnemySelectionLabel") && mainJs.includes("selectedEnemyId"));
check("SPEC includes visual smoke command", specMd.includes("node scripts\\visual-smoke.js"));
check("SPEC syntax check targets source directories", specMd.includes("Get-ChildItem -Path .\\js,.\\scripts"));

let failures = 0;
console.log("Smoke checklist:");
for (const item of results) {
  if (!item.ok) failures += 1;
  console.log(`  ${item.ok ? "[OK]" : "[FAIL]"} ${item.label}`);
}

console.log("");
console.log("Manual browser smoke targets:");
console.log("  1. Demo mode -> spell chains -> flame_blade shows timeline, heat gain, burn FX, and no console errors.");
console.log("  2. Demo preview -> press R and confirm the same item replays without stale result rows.");
console.log("  3. Demo mode -> spell chains -> overflow_burst shows spellEnergy cost, overload burst, and no console errors.");
console.log("  4. Battle style 6 and 7 load their preferred enemy archetypes and keep HUD/resources visible.");
console.log("  5. Demo mode -> showcase category -> fire/absorb/defense entries show staged captions and no console errors.");
console.log("  6. Visual smoke -> node scripts\\visual-smoke.js captures desktop and mobile screenshots without browser errors.");

if (failures > 0) {
  console.error(`Smoke checklist failed: ${failures}`);
  process.exitCode = 1;
} else {
  console.log("Smoke checklist passed.");
}
