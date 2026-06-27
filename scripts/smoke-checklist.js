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
  EncounterDatabase,
  EffectEventDefinitions
} = context;

const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const utilsJs = fs.readFileSync(path.join(root, "js/utils.js"), "utf8");
const mainJs = fs.readFileSync(path.join(root, "js/main.js"), "utf8");
const demoModeJs = fs.readFileSync(path.join(root, "js/demo-mode.js"), "utf8");
const battleJs = fs.readFileSync(path.join(root, "js/battle.js"), "utf8");
const inputJs = fs.readFileSync(path.join(root, "js/input.js"), "utf8");
const rendererJs = fs.readFileSync(path.join(root, "js/renderer.js"), "utf8");
const fxJs = fs.readFileSync(path.join(root, "js/fx.js"), "utf8");
const audioJs = fs.readFileSync(path.join(root, "js/audio.js"), "utf8");
const chainsJs = fs.readFileSync(path.join(root, "js/data/chains.js"), "utf8");
const qteDebugJs = fs.readFileSync(path.join(root, "js/systems/qte-debug.js"), "utf8");
const hitConfirmJs = fs.readFileSync(path.join(root, "js/systems/hit-confirm.js"), "utf8");
const activeAttacksJs = fs.readFileSync(path.join(root, "js/systems/active-attacks.js"), "utf8");
const styleCss = fs.readFileSync(path.join(root, "style.css"), "utf8");
const readmeMd = fs.readFileSync(path.join(root, "README.md"), "utf8");
const specMd = fs.readFileSync(path.join(root, "SPEC.md"), "utf8");
const visualSmokePath = path.join(root, "scripts/visual-smoke.js");
const visualSmokeJs = fs.existsSync(visualSmokePath) ? fs.readFileSync(visualSmokePath, "utf8") : "";
const verifyPath = path.join(root, "scripts/verify.js");
const verifyJs = fs.existsSync(verifyPath) ? fs.readFileSync(verifyPath, "utf8") : "";
const ciPath = path.join(root, ".github/workflows/ci.yml");
const ciYml = fs.existsSync(ciPath) ? fs.readFileSync(ciPath, "utf8") : "";
const manualChecklistPath = path.join(root, "docs/manual-playtest-checklist.md");
const manualChecklistMd = fs.existsSync(manualChecklistPath) ? fs.readFileSync(manualChecklistPath, "utf8") : "";
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
check("index loads js/data/encounters.js", scriptIndex("js/data/encounters.js") >= 0);
check("index loads js/fx.js before effect queue", scriptIndex("js/fx.js") >= 0 && scriptIndex("js/fx.js") < scriptIndex("js/systems/effects.js"));
check("index loads js/systems/chain-effects.js", scriptIndex("js/systems/chain-effects.js") >= 0);
check("index loads hit-confirm before battle", scriptIndex("js/systems/hit-confirm.js") >= 0 && scriptIndex("js/systems/hit-confirm.js") < scriptIndex("js/battle.js"));
check("index loads active-attacks before battle", scriptIndex("js/systems/active-attacks.js") >= 0 && scriptIndex("js/systems/active-attacks.js") < scriptIndex("js/battle.js"));
check(
  "effect registry loads before effect system",
  scriptIndex("js/data/effects.js") >= 0 && scriptIndex("js/data/effects.js") < scriptIndex("js/systems/effects.js")
);
check(
  "encounter data loads before battle",
  scriptIndex("js/data/encounters.js") >= 0 && scriptIndex("js/data/encounters.js") < scriptIndex("js/battle.js")
);
check(
  "chain helpers load before demo and qte runner",
  scriptIndex("js/systems/chain-effects.js") >= 0
    && scriptIndex("js/systems/chain-effects.js") < scriptIndex("js/demo-mode.js")
    && scriptIndex("js/systems/chain-effects.js") < scriptIndex("js/qte-runner.js")
);

for (const id of ["greatsword_a_v2", "dualblades_a_v2", "flame_blade", "mirror_guard", "overflow_burst", "counterspell_reversal"]) {
  check(`required chain exists: ${id}`, hasChain(id));
}

check("fire spell maps greatsword A to flame_blade", SpellDatabase.fire.chainMap.greatsword.A === "flame_blade");
check("fire spell maps dual blades A to flame_blade", SpellDatabase.fire.chainMap.dualBlades.A === "flame_blade");
check("absorb spell maps staff S to absorb_siphon", SpellDatabase.absorb.chainMap.staff.S === "absorb_siphon");
check("absorb spell maps staff D to overflow_burst", SpellDatabase.absorb.chainMap.staff.D === "overflow_burst");
check("absorb spell maps greatsword D to overflow_burst", SpellDatabase.absorb.chainMap.greatsword.D === "overflow_burst");

check("style flameforge exists on key 6", StyleDatabase.flameforge && StyleDatabase.flameforge.key === "6");
check("style mirrorblade exists on key 7", StyleDatabase.mirrorblade && StyleDatabase.mirrorblade.key === "7");
check("style counterflow exists on key 8", StyleDatabase.counterflow && StyleDatabase.counterflow.key === "8");
check("counterflow uses counter dojo", StyleDatabase.counterflow.preferredEncounter === "counter_dojo");
check("main menu exposes style select", indexHtml.includes('id="style-select"') && indexHtml.includes('value="manual"'));
check("main menu exposes counterflow option", indexHtml.includes('value="counterflow"') && indexHtml.includes("风格 8 · 023 · 逆势双刃"));
check("main menu style select starts chosen style", mainJs.includes("selectedStyleId") && mainJs.includes("applyMenuStyleSelection") && mainJs.includes("battle.startPlayerTurn()"));
check("main menu syncs style select from data", mainJs.includes("syncStyleSelectOptions") && mainJs.includes("Object.entries(StyleDatabase)") && mainJs.includes("styleOptionLabel"));
check("main menu shows visible style choices", indexHtml.includes('id="style-choice-grid"') && mainJs.includes("createStyleChoiceButton") && styleCss.includes(".style-choice-grid"));
check("main menu visible choices separate style numbers from style keys", mainJs.includes("style-choice-number") && mainJs.includes("style-choice-shortcut") && mainJs.includes("button.dataset.styleId") && mainJs.includes("button.dataset.styleKey") && mainJs.includes("风格 ${style.key}") && styleCss.includes(".style-choice.key-eight"));
check("native style select separates style numbers from keys", mainJs.includes("风格 ${style.key} · ${style.number} · ${style.name}") && indexHtml.includes("风格 4 · 008 · 东方诸国剑术") && indexHtml.includes("风格 8 · 023 · 逆势双刃"));
check("enemy attack chains exist", EnemyDatabase.attackChains && EnemyDatabase.attackChains.spellDoubleCut && EnemyDatabase.attackChains.knifeFlurry);
check("enemy attacks declare telegraphs", Object.values(EnemyDatabase.attacks || {}).every(attack => attack.telegraph && attack.telegraph.type && attack.telegraph.shape && attack.telegraph.pose && attack.telegraph.width));

for (const id of ["caster", "armored", "swift", "shielded"]) {
  check(`enemy archetype exists: ${id}`, !!(EnemyDatabase.archetypes && EnemyDatabase.archetypes[id]));
  check(`enemy archetype has model: ${id}`, !!(EnemyDatabase.archetypes && EnemyDatabase.archetypes[id] && EnemyDatabase.archetypes[id].model && EnemyDatabase.archetypes[id].model.type));
}

for (const id of ["ember_bulwark", "arcane_conduit", "knife_rain", "shield_rite", "counter_dojo"]) {
  check(`encounter exists: ${id}`, !!(EncounterDatabase.encounters && EncounterDatabase.encounters[id]));
}
check("encounters include low-hp phases", Object.values(EncounterDatabase.encounters || {}).every(encounter => Array.isArray(encounter.phases) && encounter.phases.length > 0));
check("knife rain avoids opening double quick stab", EncounterDatabase.encounters.knife_rain.attackPattern.slice(0, 2).join(",") !== "quickStab,quickStab");

check("fireBladeBurst has burst renderer data", !!(EffectEventDefinitions.fireBladeBurst && EffectEventDefinitions.fireBladeBurst.bursts));
check("overflowBurst has burst renderer data", !!(EffectEventDefinitions.overflowBurst && EffectEventDefinitions.overflowBurst.bursts));
check("greatswordCleavePerfect has burst renderer data", !!(EffectEventDefinitions.greatswordCleavePerfect && EffectEventDefinitions.greatswordCleavePerfect.bursts));
check("renderer has player silhouette helper", rendererJs.includes("drawPlayerSilhouette"));
check("renderer has enemy silhouette helper", rendererJs.includes("drawEnemySilhouette"));
check("renderer has stage and nameplate helpers", rendererJs.includes("drawBattleStage") && rendererJs.includes("drawActorGroundSigil") && rendererJs.includes("drawCombatNameplates"));
check("renderer has encounter stage theme helpers", rendererJs.includes("getEncounterStageTheme") && rendererJs.includes("drawEncounterBackdrop") && rendererJs.includes("drawEncounterFloorDetails") && rendererJs.includes("drawStageGlyph"));
check("renderer has encounter phase model helpers", rendererJs.includes("getEncounterPhaseInfo") && rendererJs.includes("getEncounterPhaseLabel") && rendererJs.includes("getEnemyEncounterPhaseVisuals") && rendererJs.includes("drawEnemyEncounterPhaseOverlay"));
check("renderer has cinematic focus helpers", rendererJs.includes("getCinematicFocus") && rendererJs.includes("drawCinematicFocus") && rendererJs.includes("drawCinematicLane") && rendererJs.includes("drawCinematicReticle"));
check("renderer has stage-only camera helpers", rendererJs.includes("getRenderCamera") && rendererJs.includes("applyWorldCamera") && rendererJs.includes("drawWorldScene") && rendererJs.includes("uiStable: true"));
check("renderer has actor performance helpers", rendererJs.includes("getActorPerformance") && rendererJs.includes("getActorActiveAttack") && rendererJs.includes("drawActorPerformanceAfterimage"));
check("renderer has actor damage visual helpers", rendererJs.includes("getActorDamageVisuals") && rendererJs.includes("drawActorDamageMarks") && rendererJs.includes("critical") && rendererJs.includes("defeated"));
check("renderer has timing readability helpers", rendererJs.includes("getQTEReadabilityMetrics") && rendererJs.includes("drawQTEReadabilityPanel") && rendererJs.includes("getEnemyTimingMetrics") && rendererJs.includes("drawEnemyTimingPanel"));
check("renderer has combat contact performance helpers", rendererJs.includes("getCombatContactEvents") && rendererJs.includes("drawCombatContactLayer") && rendererJs.includes("drawContactBodyImpact") && rendererJs.includes("drawContactGroundImpulse"));
check("renderer has active attack contact guide helpers", rendererJs.includes("getActiveAttackContactGuide") && rendererJs.includes("drawActiveAttackContactGuide") && rendererJs.includes("drawActiveAttackTargetBracket"));
check("renderer has player defense intent helpers", rendererJs.includes("getPlayerDefenseIntentVisuals") && rendererJs.includes("drawPlayerDefenseIntentOverlay") && rendererJs.includes("drawDefenseDodgeFootwork") && rendererJs.includes("drawDefenseGuardPlane") && rendererJs.includes("drawDefenseMirrorReadiness"));
check("renderer has player equipment model helpers", rendererJs.includes("getPlayerModelProfile") && rendererJs.includes("drawPlayerBackGear") && rendererJs.includes("drawPlayerArmorAccents") && rendererJs.includes("drawPlayerLoadoutDetails") && rendererJs.includes("drawPlayerHeadgear"));
check("renderer has player rig silhouette helpers", rendererJs.includes("getPlayerRigProfile") && rendererJs.includes("drawPlayerRigBackDetails") && rendererJs.includes("vanguard-plate") && rendererJs.includes("agile-duelist") && rendererJs.includes("counter-duelist") && rendererJs.includes("arcane-mantle"));
check("renderer has enemy model accent helpers", rendererJs.includes("getEnemyModelProfile") && rendererJs.includes("drawEnemyModelAccents") && rendererJs.includes("drawEnemyMaterialDetails") && rendererJs.includes("drawEnemyGearDetails") && rendererJs.includes("drawEnemyHeadgear") && rendererJs.includes("model.type"));
check("renderer has enemy rig silhouette helpers", rendererJs.includes("getEnemyRigProfile") && rendererJs.includes("drawEnemyRigBackDetails") && rendererJs.includes("ritual-caster") && rendererJs.includes("heavy-plate") && rendererJs.includes("low-cloak") && rendererJs.includes("ward-guard") && rendererJs.includes("stone-golem"));
check("renderer has enemy telegraph helpers", rendererJs.includes("getEnemyTelegraph") && rendererJs.includes("drawEnemyTelegraphLane") && rendererJs.includes("drawEnemyTelegraphHit") && rendererJs.includes("drawEnemyAttackPoseOverlay"));
check("renderer suppresses enemy attack floating message", rendererJs.includes('scene.turnState === "enemy_turn"') && rendererJs.includes("scene.enemyAttackPhase !== \"none\""));
check("renderer has player active attack helpers", rendererJs.includes("getPlayerActiveAttackDescriptor") && rendererJs.includes("drawPlayerMeleeActiveAttack") && rendererJs.includes("drawPlayerProjectileActiveAttack") && rendererJs.includes("drawPlayerSpellActiveAttack") && rendererJs.includes("drawPlayerPulseActiveAttack"));
check("renderer has actor status visual helpers", rendererJs.includes("getActorStatusVisuals") && rendererJs.includes("drawPlayerStatusAuras") && rendererJs.includes("drawEnemyStatusOverlays") && rendererJs.includes("drawStatusFlame"));
check("renderer dedupes status icons", rendererJs.includes("const seen = new Set()") && rendererJs.includes("addIcon(`${status.target}:${status.id}`"));
check("renderer has node-timed action helper", rendererJs.includes("getActionTiming"));
check("renderer supports node pose tags", rendererJs.includes("getCurrentPose") && rendererJs.includes("node.pose"));
check("chains include R10 pose tags", chainsJs.includes('motion: "flameBladeCut"') && chainsJs.includes('motion: "overflowBurst"') && chainsJs.includes('motion: "greatswordEarthsplit"'));
check("qte debug shows active pose", qteDebugJs.includes("姿态："));

for (const key of ["1", "2", "3", "4", "5", "6", "7", "8"]) {
  check(`touch controls include numeric key ${key}`, indexHtml.includes(`data-key="${key}"`));
}
check("touch controls include click fallback", mainJs.includes('addEventListener("click"') && mainJs.includes("suppressTouchClick"));
check("touch controls include mouse fallback", mainJs.includes('addEventListener("mousedown"') && mainJs.includes("pressVirtualKey"));
check("touch controls use delegated hit mapping", mainJs.includes("getVirtualKeyFromEvent") && mainJs.includes("nearestDistance"));
check("touch controls handle virtual ESC", mainJs.includes("handleVirtualSystemKey") && mainJs.includes('appState === "battle"'));
check("hidden touch controls are inaccessible", indexHtml.includes('aria-hidden="true"') && styleCss.includes("visibility: hidden") && mainJs.includes("setTouchControlsVisible") && mainJs.includes('setAttribute("aria-hidden"'));
check("demo mode exposes system escape handler", demoModeJs.includes("handleSystemEscape") && mainJs.includes("demo.handleSystemEscape"));
check("demo detail opens by default", mainJs.includes('demoDetailDrawer.classList.remove("hidden")'));
check("demo detail uses status lines", mainJs.includes("demo.getStatusLines") && mainJs.includes("demo.getControlHint"));
check("demo includes showcase category", demoModeJs.includes('key: "showcases"') && demoModeJs.includes("Showcase · 火球三分支对比"));
check("demo help advertises showcase", mainJs.includes("亮点演示 Showcase") && mainJs.includes("1-5</b> 选择演示分类"));
check("enemy readout renderer exists", rendererJs.includes("drawEnemyAttackReadout") && rendererJs.includes("推荐"));
check("audio has R7 feedback cues", audioJs.includes("sfxWindowOpen") && audioJs.includes("sfxResourceGain") && audioJs.includes("sfxTransition"));
check("audio has R9 quieter mix baseline", audioJs.includes("masterVolume: 0.30") && audioJs.includes("sfxChargePeak") && audioJs.includes("volume: 0.42"));
check("keyboard input includes style key 8", inputJs.includes('"8"'));
check("timing audit script exists", fs.existsSync(path.join(root, "scripts/check-timing.js")));
check("visual smoke script exists", !!visualSmokeJs);
check("visual smoke uses screenshot capture", visualSmokeJs.includes("Page.captureScreenshot"));
check("visual smoke covers style 7 and replay", visualSmokeJs.includes("battle-style7-qte") && visualSmokeJs.includes("demo-result-replay-qte"));
check("visual smoke covers encounter stage themes", visualSmokeJs.includes("style 6 forge stage theme") && visualSmokeJs.includes("style 7 arcane stage theme") && visualSmokeJs.includes("style 8 dojo stage theme"));
check("visual smoke covers encounter phase model visuals", visualSmokeJs.includes("enemy encounter phase visuals active") && visualSmokeJs.includes("enemy phase nameplate uses phase name"));
check("visual smoke covers cinematic focus", visualSmokeJs.includes("player attack cinematic focus") && visualSmokeJs.includes("enemy response cinematic focus"));
check("visual smoke covers stage-only camera impulse", visualSmokeJs.includes("stage-only camera impulse active") && visualSmokeJs.includes("getRenderCamera"));
check("visual smoke covers battle result summary", visualSmokeJs.includes("battle-result-summary") && visualSmokeJs.includes("getBattleResultLines"));
check("visual smoke covers enemy telegraph", visualSmokeJs.includes("battle-enemy-telegraph") && visualSmokeJs.includes("getEnemyTelegraph"));
check("visual smoke covers player defense intent", visualSmokeJs.includes("player defense intent visuals active") && visualSmokeJs.includes("getPlayerDefenseIntentVisuals"));
check("visual smoke covers player active attacks", visualSmokeJs.includes("battle-player-active-attack") && visualSmokeJs.includes("battle-player-spell-active") && visualSmokeJs.includes("getPlayerActiveAttackDescriptor"));
check("visual smoke covers active attack contact guides", visualSmokeJs.includes("active attack contact guide anchored") && visualSmokeJs.includes("getActiveAttackContactGuide"));
check("visual smoke covers player rig silhouettes", visualSmokeJs.includes("greatsword player rig silhouette") && visualSmokeJs.includes("dual blades player rig silhouette") && visualSmokeJs.includes("style 8 player counter rig"));
check("visual smoke covers enemy rig silhouettes", visualSmokeJs.includes("armored enemy rig silhouette") && visualSmokeJs.includes("caster enemy rig silhouette") && visualSmokeJs.includes("getEnemyRigProfile"));
check("visual smoke covers actor damage visuals", visualSmokeJs.includes("actor damage visuals active") && visualSmokeJs.includes("getActorDamageVisuals"));
check("visual smoke covers actor status visuals", visualSmokeJs.includes("actor status visuals active") && visualSmokeJs.includes("player status visuals active"));
check("visual smoke covers virtual controls", visualSmokeJs.includes("battle-virtual-controls-qte") && visualSmokeJs.includes("clickVirtualKey"));
check("visual smoke guards demo stage drawer overlap", visualSmokeJs.includes("demo stage avoids detail drawer") && visualSmokeJs.includes("demo qte bar avoids detail drawer"));
check("game container uses responsive 16:9 scaling", styleCss.includes("calc(100vh * 16 / 9)") && styleCss.includes("calc(100vw * 9 / 16)"));
check("small viewport compact rules exist", styleCss.includes("@media (max-width: 900px), (max-height: 520px)") && styleCss.includes("#demo-detail-drawer"));
check("mobile demo detail uses bottom sheet layout", styleCss.includes("#demo-detail-drawer .drawer-content") && styleCss.includes("bottom: 8px"));
check("main menu includes encounter select", indexHtml.includes('id="enemy-select"') && indexHtml.includes('value="encounter:arcane_conduit"') && indexHtml.includes('value="encounter:counter_dojo"') && indexHtml.includes('value="swift"'));
check("battle supports encounter selection", battleJs.includes("encounterOverrideId") && battleJs.includes("applyEncounter") && battleJs.includes("pickEnemyAttackId"));
check("battle supports encounter phases", battleJs.includes("getCurrentEncounterPhase") && battleJs.includes("maybeEnterEncounterPhase") && battleJs.includes("getEncounterAttackPattern"));
check("battle result summary exists", battleJs.includes("getBattleResultLines") && rendererJs.includes("战斗摘要") && mainJs.includes("getBattleResultLines") && styleCss.includes("game-over-stats-title"));
check("qte debug shows encounter rules", qteDebugJs.includes("getEncounterDebugLines"));
check("SPEC includes visual smoke command", specMd.includes("node scripts\\visual-smoke.js"));
check("SPEC syntax check targets source directories", specMd.includes("Get-ChildItem -Path .\\js,.\\scripts"));
check("verify script exists", !!verifyJs);
check("verify script runs core gates", verifyJs.includes("scripts/validate-data.js") && verifyJs.includes("scripts/check-timing.js") && verifyJs.includes("scripts/check-balance.js") && verifyJs.includes("scripts/flow-smoke.js"));
check("verify script supports visual toggle", verifyJs.includes("--skip-visual") && verifyJs.includes("--visual") && verifyJs.includes("scripts/visual-smoke.js"));
check("CI workflow runs verify", ciYml.includes("node scripts/verify.js --ci --skip-visual"));
check("manual playtest checklist exists", manualChecklistMd.includes("Battle Feel") && manualChecklistMd.includes("Demo Direction") && manualChecklistMd.includes("Audio"));
check("README documents verify command", readmeMd.includes("node scripts/verify.js") && readmeMd.includes("--skip-visual"));
check("input reset protects virtual controls", inputJs.includes("reset()") && inputJs.includes("heldKeys.clear()") && inputJs.includes("options.fresh") && mainJs.includes("input.reset()") && mainJs.includes("pressVirtualKey(key)") && mainJs.includes("fresh: true") && mainJs.includes("tutorialOverlay.style.display !== \"none\""));
check("R12 handfeel profiles exist", utilsJs.includes("getChainHandfeel") && utilsJs.includes("getDemoPacing") && utilsJs.includes("overflow_burst"));
check("R14 battle qte pacing exists", utilsJs.includes("getBattleQTEPacing") && battleJs.includes("applyQTEPacing") && qteDebugJs.includes("实战节奏"));
check("qte impact legacy path removed", !battleJs.includes("qteImpact") && !rendererJs.includes("drawQTEImpactPrompt") && !qteDebugJs.includes("动画结算"));
check("enemy legacy hit resolver removed", !battleJs.includes("resolveEnemyHit"));
check("active attack system exists", activeAttacksJs.includes("class ActiveAttackSystem") && activeAttacksJs.includes("resolveProfile") && activeAttacksJs.includes("reactionStart"));
check("active attack emits reaction and impact visuals", activeAttacksJs.includes("emitReactionVisual") && activeAttacksJs.includes("emitImpactVisual"));
check("battle commits qte active attacks", battleJs.includes('kind: "playerQTE"') && battleJs.includes("resolvePlayerQTEImpact") && battleJs.includes("finishPlayerQTEFlow"));
check("battle commits enemy active attacks", battleJs.includes("commitEnemyActiveAttack") && battleJs.includes('kind: "enemyAttack"') && battleJs.includes("onActiveAttackReactionWindow"));
check("battle supports enemy attack chains", battleJs.includes("startEnemyAttackChain") && battleJs.includes("EnemyDatabase.attackChains") && battleJs.includes("triggerClashCounter"));
check("battle splits dual clash counter hits", battleJs.includes("buildClashCounterSegments") && battleJs.includes("commitClashCounterSegments") && battleJs.includes("dualClashFollow"));
check("renderer draws target-anchored melee active attacks", rendererJs.includes("drawActiveAttacks") && rendererJs.includes("drawMeleeActiveAttack") && !rendererJs.includes("drawActiveAttackPrompt") && !rendererJs.includes("攻击实体推进中"));
check("battle splits melee qte hits", battleJs.includes("buildQTEHitSegments") && battleJs.includes("commitSegmentedQTEActiveAttacks") && battleJs.includes("suppressFlowComplete") && battleJs.includes("suppressImpactSideEffects"));
check("battle trims qte floating text noise", battleJs.includes('if (outcome !== "success")') && !battleJs.includes("% 连击`, 740, 300"));
check("renderer suppresses qte stale overlays", rendererJs.includes("shouldDrawFloatingMessage") && rendererJs.includes("shouldDrawTurnBanner") && rendererJs.includes('scene.turnState !== "qte_running"') && visualSmokeJs.includes("battle qte suppresses stale overlays"));
check("main ui labels active attacks", mainJs.includes('battle.turnState === "attack_active"') && mainJs.includes("攻击演出"));
check("qte debug shows active attacks", qteDebugJs.includes("activeAttackSystem.getDebugLines"));
check("battle applies chain handfeel", battleJs.includes("Utils.getChainHandfeel(chainConfig") && battleJs.includes("Utils.getChainHandfeel(chain, { chainId, source: \"enemy\" })"));
check("battle applies qte pacing", battleJs.includes("Utils.getBattleQTEPacing") && battleJs.includes("qteRunner.timeScale") && battleJs.includes("qteRunner.postNodePause"));
check("demo applies chain pacing", demoModeJs.includes("Utils.getDemoPacing") && demoModeJs.includes("getActiveDirectorLines") && demoModeJs.includes("getPreviewSummaryLines"));
check("renderer shows demo focus panel", rendererJs.includes("drawDemoFocusPanel") && rendererJs.includes("演示摘要"));
check("demo layout avoids detail drawer", rendererJs.includes("getDemoStageBounds") && rendererJs.includes("stage.compact") && rendererJs.includes("drawDemoQTEBar(scene, bounds)"));
check("battle action HUD hides equipment noise", rendererJs.includes("isActionFocusedState") && rendererJs.includes("drawEquipmentChips") && rendererJs.includes('scene.turnState === "attack_active"'));
check("demo result suppresses residual flash", rendererJs.includes("shouldDrawScreenFlash") && rendererJs.includes('scene.turnState !== "demo_preview"') && visualSmokeJs.includes("demo result suppresses residual flash"));
check("demo action key prompt uses lower lane", rendererJs.includes("actionKeyPromptY = 365") && rendererJs.includes("drawBigKeyPrompt(scene, keyMatch[1], \"\", actionKeyPromptY"));
check("demo action suppresses duplicate enemy readout", rendererJs.includes("suppressReadout: true") && rendererJs.includes("!options.suppressReadout"));
check("demo qte uses compact result feedback", demoModeJs.includes('"qteResult"') && fxJs.includes('t.type === "qteResult"'));
check("R14 accessible qte timings", chainsJs.includes("beats: [0.38, 0.82, 1.24]") && chainsJs.includes("duration: 1.18") && chainsJs.includes("perfect: 0.72") && chainsJs.includes("chargeMul: 1.08"));
check("R13 style preferred encounters exist", StyleDatabase.flameforge.preferredEncounter === "ember_bulwark" && StyleDatabase.mirrorblade.preferredEncounter === "arcane_conduit");
check("actor reactions include attack windup", fxJs.includes("attack: 0.28") && fxJs.includes("windup: 0.32") && fxJs.includes("rotation"));
check("renderer draws actor motion lines", rendererJs.includes("drawActorMotionLines") && rendererJs.includes("drawEnemyAttackMotion") && rendererJs.includes("isSpellLikeAttack"));
check("battle emits attack animation hooks", battleJs.includes('triggerActorReaction("player", "attack"') && battleJs.includes('triggerActorReaction("enemy", "attack"') && battleJs.includes("emitEnemyAttackVisual"));
check("impact sparks exist", fxJs.includes("drawSpark") && battleJs.includes('kind: "spark"') && rendererJs.includes("burstRadius"));
check("hit confirm system exists", hitConfirmJs.includes("class HitConfirmSystem") && hitConfirmJs.includes("confirmedTokens") && hitConfirmJs.includes("getHurtbox"));
check("hit confirm supports dynamic trails", hitConfirmJs.includes("buildTrailHitbox") && hitConfirmJs.includes("trailRect") && hitConfirmJs.includes("window.impact"));
check("battle routes damage through hit confirm", battleJs.includes("this.hitConfirmSystem = new HitConfirmSystem(this)") && battleJs.includes("confirmDamage(intent") && battleJs.includes("hitConfirmSystem.confirm"));
check("battle passes qte hit metadata", battleJs.includes("buildQTEHitMeta") && battleJs.includes("visualEvents") && battleJs.includes("outcomes"));
check("renderer draws hit confirm overlay", rendererJs.includes("drawHitConfirmOverlays") && rendererJs.includes("drawHitboxShape") && rendererJs.includes("drawHurtboxShape"));
check("hit confirm overlay is debug-gated", rendererJs.includes("scene.showHitConfirmOverlay") && mainJs.includes("scene.showHitConfirmOverlay"));
check("visual smoke covers combat contact layer", visualSmokeJs.includes("contact impact events active") && visualSmokeJs.includes("getCombatContactEvents"));
check("actor reactions accept impact offsets", fxJs.includes("direction: options.direction") && fxJs.includes("distance: options.distance") && fxJs.includes("reaction.distance"));
check("qte debug shows hit confirm", qteDebugJs.includes("hitConfirmSystem.getDebugLines"));

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
console.log("  4. Battle style 6 and 7 load their preferred named encounters and keep HUD/resources visible.");
console.log("  5. Demo mode -> showcase category -> fire/absorb/defense entries show staged captions and no console errors.");
console.log("  6. Visual smoke -> node scripts\\visual-smoke.js captures desktop and mobile screenshots without browser errors.");

if (failures > 0) {
  console.error(`Smoke checklist failed: ${failures}`);
  process.exitCode = 1;
} else {
  console.log("Smoke checklist passed.");
}
