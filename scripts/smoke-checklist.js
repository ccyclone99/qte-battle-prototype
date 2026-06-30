#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { root, loadDataContext } = require("./lib/load-data");

const context = loadDataContext();
const {
  ChainDatabase,
  SpellDatabase,
  StyleDatabase,
  WeaponDatabase,
  EnemyDatabase,
  EncounterDatabase,
  EffectEventDefinitions
} = context;

const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const utilsJs = fs.readFileSync(path.join(root, "js/utils.js"), "utf8");
const difficultyJs = fs.readFileSync(path.join(root, "js/difficulty.js"), "utf8");
const mainJs = fs.readFileSync(path.join(root, "js/main.js"), "utf8");
const demoModeJs = fs.readFileSync(path.join(root, "js/demo-mode.js"), "utf8");
const qteRunnerJs = fs.readFileSync(path.join(root, "js/qte-runner.js"), "utf8");
const battleJs = fs.readFileSync(path.join(root, "js/battle.js"), "utf8");
const inputJs = fs.readFileSync(path.join(root, "js/input.js"), "utf8");
const rendererJs = fs.readFileSync(path.join(root, "js/renderer.js"), "utf8");
const fxJs = fs.readFileSync(path.join(root, "js/fx.js"), "utf8");
const audioJs = fs.readFileSync(path.join(root, "js/audio.js"), "utf8");
const chainsJs = fs.readFileSync(path.join(root, "js/data/chains.js"), "utf8");
const weaponsJs = fs.readFileSync(path.join(root, "js/data/weapons.js"), "utf8");
const enemiesJs = fs.readFileSync(path.join(root, "js/data/enemies.js"), "utf8");
const renderStateJs = fs.readFileSync(path.join(root, "js/systems/render-state.js"), "utf8");
const qteDebugJs = fs.readFileSync(path.join(root, "js/systems/qte-debug.js"), "utf8");
const hitConfirmJs = fs.readFileSync(path.join(root, "js/systems/hit-confirm.js"), "utf8");
const activeAttacksJs = fs.readFileSync(path.join(root, "js/systems/active-attacks.js"), "utf8");
const effectsJs = fs.readFileSync(path.join(root, "js/systems/effects.js"), "utf8");
const resourcesJs = fs.readFileSync(path.join(root, "js/systems/resources.js"), "utf8");
const styleCss = fs.readFileSync(path.join(root, "style.css"), "utf8");
const readmeMd = fs.readFileSync(path.join(root, "README.md"), "utf8");
const specMd = fs.readFileSync(path.join(root, "SPEC.md"), "utf8");
const flowSmokeJs = fs.readFileSync(path.join(root, "scripts/flow-smoke.js"), "utf8");
const checkBalanceJs = fs.readFileSync(path.join(root, "scripts/check-balance.js"), "utf8");
const visualSmokePath = path.join(root, "scripts/visual-smoke.js");
const visualSmokeJs = fs.existsSync(visualSmokePath) ? fs.readFileSync(visualSmokePath, "utf8") : "";
const verifyPath = path.join(root, "scripts/verify.js");
const verifyJs = fs.existsSync(verifyPath) ? fs.readFileSync(verifyPath, "utf8") : "";
const ciPath = path.join(root, ".github/workflows/ci.yml");
const ciYml = fs.existsSync(ciPath) ? fs.readFileSync(ciPath, "utf8") : "";
const manualChecklistPath = path.join(root, "docs/manual-playtest-checklist.md");
const manualChecklistMd = fs.existsSync(manualChecklistPath) ? fs.readFileSync(manualChecklistPath, "utf8") : "";
const qtePrototypePath = path.join(root, "docs/qte-prototype-reference.md");
const qtePrototypeMd = fs.existsSync(qtePrototypePath) ? fs.readFileSync(qtePrototypePath, "utf8") : "";
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
check("index loads render state helper before renderer", scriptIndex("js/systems/render-state.js") >= 0 && scriptIndex("js/systems/render-state.js") < scriptIndex("js/renderer.js"));
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

for (const id of ["greatsword_a_v2", "dualblades_a_v2", "flame_blade", "mirror_guard", "overflow_burst"]) {
  check(`required chain exists: ${id}`, hasChain(id));
}

check("fire spell maps greatsword A to flame_blade", SpellDatabase.fire.chainMap.greatsword.A === "flame_blade");
check("fire spell maps dual blades A to flame_blade", SpellDatabase.fire.chainMap.dualBlades.A === "flame_blade");
check("absorb spell maps staff S to absorb_siphon", SpellDatabase.absorb.chainMap.staff.S === "absorb_siphon");
check("absorb spell maps staff D to overflow_burst", SpellDatabase.absorb.chainMap.staff.D === "overflow_burst");
check("absorb spell maps greatsword D to overflow_burst", SpellDatabase.absorb.chainMap.greatsword.D === "overflow_burst");

check("only default combat plan remains", Object.keys(StyleDatabase).length === 1 && !!StyleDatabase.current);
check("default plan uses beginner counter tutorial", StyleDatabase.current.preferredEncounter === "counter_tutorial");
check("default plan is not a spell or style-chain bundle", StyleDatabase.current.spells.length === 0 && StyleDatabase.current.combatArts.length === 0 && !StyleDatabase.current.counterChain && StyleDatabase.current.counterFlow && StyleDatabase.current.counterFlow.enabled);
check("beginner route is not an absorb resource dojo", !("startSpellEnergy" in EncounterDatabase.encounters.counter_tutorial.modifiers) && !("absorbEnergyMul" in EncounterDatabase.encounters.counter_tutorial.modifiers) && !("absorbDamageMul" in EncounterDatabase.encounters.counter_tutorial.modifiers));
check("counter dojo is not an absorb resource dojo", !("startSpellEnergy" in EncounterDatabase.encounters.counter_dojo.modifiers) && !("absorbEnergyMul" in EncounterDatabase.encounters.counter_dojo.modifiers) && !("absorbDamageMul" in EncounterDatabase.encounters.counter_dojo.modifiers));
check("main menu removes style select", !indexHtml.includes('id="style-select"') && !indexHtml.includes('id="style-choice-grid"'));
check("main menu exposes weapon-only select", indexHtml.includes('id="weapon-select"') && indexHtml.includes('value="dualBlades"') && indexHtml.includes('value="swordShield"') && mainJs.includes("selectedWeaponId") && mainJs.includes("setWeaponOverride"));
check("main menu disables demo entry", indexHtml.includes('id="btn-demo" hidden disabled'));
check("main menu starts default combat plan on enemy turn", mainJs.includes("DEFAULT_COMBAT_PLAN_ID = \"current\"") && mainJs.includes("applyDefaultCombatPlan()") && mainJs.includes("battle.applyStyle(DEFAULT_COMBAT_PLAN_ID)") && mainJs.includes("battle.startEnemyTurn()"));
check("main menu labels current plan", indexHtml.includes("敌方回合反制") && styleCss.includes(".menu-static-value"));
check("tutorial explains sequential counter flow", indexHtml.includes("反制入门") && indexHtml.includes("逐节点拼刀") && indexHtml.includes("不能一次按键自动覆盖整条连段") && !indexHtml.includes("我方回合：按 <b>A / S / D</b> 发动对应 QTE 链"));
check("blocking overlays pause combat updates", mainJs.includes("function isBlockingOverlayVisible()") && mainJs.includes("const pausedByOverlay = isBlockingOverlayVisible()") && mainJs.includes("!pausedByOverlay && appState === \"battle\""));
check("enemy attack chains exist", EnemyDatabase.attackChains && EnemyDatabase.attackChains.bladeRushTriple && EnemyDatabase.attackChains.spellDoubleCut && EnemyDatabase.attackChains.shieldSpellRush && EnemyDatabase.attackChains.feintCrush && EnemyDatabase.attackChains.curseNeedle && EnemyDatabase.attackChains.knifeFlurry);
check("beginner tutorial chains exist", ["tutorialSingleClash", "tutorialTwoHitRead", "tutorialGuardContact", "tutorialSpellInterrupt", "tutorialFollowupCheck"].every(id => EnemyDatabase.attackChains && EnemyDatabase.attackChains[id] && EncounterDatabase.encounters.counter_tutorial.attackPattern.includes(id)));
check("counter dojo rotates varied pressure chains", ["bladeRushTriple", "spellDoubleCut", "shieldSpellRush", "knifeFlurry", "feintCrush", "curseNeedle"].every(id => EncounterDatabase.encounters.counter_dojo.attackPattern.includes(id)));
check("enemy attacks declare telegraphs", Object.values(EnemyDatabase.attacks || {}).every(attack => attack.telegraph && attack.telegraph.type && attack.telegraph.shape && attack.telegraph.pose && attack.telegraph.width));
check("enemy attacks declare counter tags", Object.values(EnemyDatabase.attacks || {}).every(attack => attack.counter && attack.counter.type && attack.counter.hint));
const meleeAttackIds = ["quickStab", "thrust", "slash", "heavySmash", "shieldBash", "delayedCleave", "guardCrush"];
check("enemy melee attacks define contact timelines", meleeAttackIds.every(id => EnemyDatabase.attacks[id] && EnemyDatabase.attacks[id].meleeTimeline && EnemyDatabase.attacks[id].meleeTimeline.contactFrame > 0));
check("enemy melee timelines define active windows and root motion", meleeAttackIds.every(id => {
  const timeline = EnemyDatabase.attacks[id] && EnemyDatabase.attacks[id].meleeTimeline;
  return timeline
    && timeline.activeStart < timeline.contactFrame
    && timeline.contactFrame < timeline.activeEnd
    && timeline.rootMotion
    && Array.isArray(timeline.rootMotion.source)
    && timeline.rootMotion.source.length >= 3;
}));
check("close melee chains carry staging offsets", ["bladeRushTriple", "knifeFlurry", "spellDoubleCut", "rapidTriple", "delayedCleaveMix", "shieldCrushCombo"].every(id => {
  const chain = EnemyDatabase.attackChains && EnemyDatabase.attackChains[id];
  return chain && chain.nodes.some(node => Number.isFinite(node.meleeStart) || EnemyDatabase.attacks[node.attackId]?.meleeTimeline);
}));
check(
  "expanded enemy pressure library exists",
  ["delayedCleave", "guardCrush"].every(id => !!(EnemyDatabase.attacks && EnemyDatabase.attacks[id]))
    && ["rapidTriple", "delayedCleaveMix", "spellBladeTrap", "shieldCrushCombo"].every(id => !!(EnemyDatabase.attackChains && EnemyDatabase.attackChains[id]))
    && ["rapidTriple", "delayedCleaveMix", "spellBladeTrap", "shieldCrushCombo"].every(id => EncounterDatabase.encounters.counter_dojo.attackPattern.includes(id))
);

for (const id of ["caster", "armored", "swift", "shielded"]) {
  check(`enemy archetype exists: ${id}`, !!(EnemyDatabase.archetypes && EnemyDatabase.archetypes[id]));
  check(`enemy archetype has model: ${id}`, !!(EnemyDatabase.archetypes && EnemyDatabase.archetypes[id] && EnemyDatabase.archetypes[id].model && EnemyDatabase.archetypes[id].model.type));
}

for (const id of ["ember_bulwark", "arcane_conduit", "knife_rain", "shield_rite", "counter_tutorial", "counter_dojo"]) {
  check(`encounter exists: ${id}`, !!(EncounterDatabase.encounters && EncounterDatabase.encounters[id]));
}
check("encounters include low-hp phases", Object.values(EncounterDatabase.encounters || {}).every(encounter => Array.isArray(encounter.phases) && encounter.phases.length > 0));
check("knife rain avoids opening double quick stab", EncounterDatabase.encounters.knife_rain.attackPattern.slice(0, 2).join(",") !== "quickStab,quickStab");

check("fireBladeBurst has burst renderer data", !!(EffectEventDefinitions.fireBladeBurst && EffectEventDefinitions.fireBladeBurst.bursts));
check("overflowBurst has burst renderer data", !!(EffectEventDefinitions.overflowBurst && EffectEventDefinitions.overflowBurst.bursts));
check("greatswordCleavePerfect has burst renderer data", !!(EffectEventDefinitions.greatswordCleavePerfect && EffectEventDefinitions.greatswordCleavePerfect.bursts));
check("counter clash effect data remains available", !!(EffectEventDefinitions.counterflowClashLead && EffectEventDefinitions.counterflowClashFollow && EffectEventDefinitions.counterflowClashFollow.bursts));
check(
  "qte prototype reference system is retained",
  ["fireball_evolution", "counterspell_reversal", "followup_dualblades", "flame_blade", "overflow_burst"].every(id => chainsJs.includes(id))
    && demoModeJs.includes("class DemoMode")
    && qteRunnerJs.includes("class QTEChainRunner")
    && fs.existsSync(path.join(root, "scripts/sim-chain.js"))
    && fs.existsSync(path.join(root, "scripts/check-timing.js"))
    && fs.existsSync(path.join(root, "scripts/check-balance.js"))
    && fs.existsSync(path.join(root, "scripts/validate-data.js"))
);
check(
  "qte prototype reference doc exists",
  qtePrototypeMd.includes("QTE Prototype Reference")
    && qtePrototypeMd.includes("Retention Contract")
    && qtePrototypeMd.includes("QTEChainRunner")
    && qtePrototypeMd.includes("DemoMode")
    && qtePrototypeMd.includes("flame_blade")
    && qtePrototypeMd.includes("overflow_burst")
    && qtePrototypeMd.includes("Public Freeze Notes")
    && qtePrototypeMd.includes("Formal Transfer Contract")
    && qtePrototypeMd.includes("Animation Event")
    && qtePrototypeMd.includes("Learning Objective")
    && qtePrototypeMd.includes("Telemetry Export")
);
check(
  "public demo entry hidden while prototype code remains",
  indexHtml.includes('id="btn-demo" hidden disabled')
    && demoModeJs.includes("class DemoMode")
    && qteRunnerJs.includes("class QTEChainRunner")
);
check("renderer has player silhouette helper", rendererJs.includes("drawPlayerSilhouette"));
check("renderer has enemy silhouette helper", rendererJs.includes("drawEnemySilhouette"));
check("renderer has stage and nameplate helpers", rendererJs.includes("drawBattleStage") && rendererJs.includes("drawActorGroundSigil") && rendererJs.includes("drawCombatNameplates"));
check("renderer has encounter stage theme helpers", rendererJs.includes("getEncounterStageTheme") && rendererJs.includes("drawEncounterBackdrop") && rendererJs.includes("drawEncounterFloorDetails") && rendererJs.includes("drawStageGlyph"));
check("renderer has encounter phase model helpers", rendererJs.includes("getEncounterPhaseInfo") && rendererJs.includes("getEncounterPhaseLabel") && rendererJs.includes("getEnemyEncounterPhaseVisuals") && rendererJs.includes("drawEnemyEncounterPhaseOverlay"));
check("renderer has combat phase lighting helpers", rendererJs.includes("getCombatPhaseLighting") && rendererJs.includes("drawCombatPhaseLighting") && rendererJs.includes("playerHot") && rendererJs.includes("enemyHot"));
check("renderer has cinematic focus helpers", rendererJs.includes("getCinematicFocus") && rendererJs.includes("drawCinematicFocus") && rendererJs.includes("drawCinematicLane") && rendererJs.includes("drawCinematicReticle"));
check("renderer has stage-only camera helpers", rendererJs.includes("getRenderCamera") && rendererJs.includes("applyWorldCamera") && rendererJs.includes("drawWorldScene") && rendererJs.includes("uiStable: true"));
check("renderer has actor performance helpers", rendererJs.includes("getActorPerformance") && rendererJs.includes("getActorActiveAttack") && rendererJs.includes("drawActorPerformanceAfterimage"));
check("renderer has actor footwork helpers", rendererJs.includes("getActorFootworkVisuals") && rendererJs.includes("drawActorFootworkLayer") && rendererJs.includes("trailCount"));
check("renderer has actor intent badge helpers", rendererJs.includes("getActorIntentBadgeVisuals") && rendererJs.includes("drawActorIntentBadgeLayer") && rendererJs.includes("enemy-window") && rendererJs.includes("defense-window"));
check("renderer has actor damage visual helpers", rendererJs.includes("getActorDamageVisuals") && rendererJs.includes("drawActorDamageMarks") && rendererJs.includes("critical") && rendererJs.includes("defeated"));
check("renderer has actor impact reaction helpers", rendererJs.includes("getActorImpactReactionVisuals") && rendererJs.includes("drawActorImpactReactionLayer") && rendererJs.includes("slashLike") && rendererJs.includes("spellLike"));
check("renderer has timing readability helpers", rendererJs.includes("getQTEReadabilityMetrics") && rendererJs.includes("drawQTEReadabilityPanel") && rendererJs.includes("getEnemyTimingMetrics") && rendererJs.includes("drawEnemyTimingPanel"));
check("renderer has combat contact performance helpers", rendererJs.includes("getCombatContactEvents") && rendererJs.includes("drawCombatContactLayer") && rendererJs.includes("drawContactBodyImpact") && rendererJs.includes("drawContactGroundImpulse"));
check("renderer has active attack contact guide helpers", rendererJs.includes("getActiveAttackContactGuide") && rendererJs.includes("drawActiveAttackContactGuide") && rendererJs.includes("drawActiveAttackTargetBracket") && rendererJs.includes('const guideScale = this.visualScale("impact")'));
check("renderer has player defense intent helpers", rendererJs.includes("getPlayerDefenseIntentVisuals") && rendererJs.includes("drawPlayerDefenseIntentOverlay") && rendererJs.includes("drawDefenseDodgeFootwork") && rendererJs.includes("drawDefenseGuardPlane") && rendererJs.includes("drawDefenseMirrorReadiness"));
check("renderer has player equipment model helpers", rendererJs.includes("getPlayerModelProfile") && rendererJs.includes("drawPlayerBackGear") && rendererJs.includes("drawPlayerArmorAccents") && rendererJs.includes("drawPlayerLoadoutDetails") && rendererJs.includes("drawPlayerHeadgear"));
check("renderer has weapon silhouette material helpers", rendererJs.includes("getWeaponSilhouetteProfile") && rendererJs.includes("drawWeaponGrip") && rendererJs.includes('family: "heavy-blade"') && rendererJs.includes('family: "twin-blade"') && rendererJs.includes('family: "focus-staff"'));
check("renderer has player rig silhouette helpers", rendererJs.includes("getPlayerRigProfile") && rendererJs.includes("drawPlayerRigBackDetails") && rendererJs.includes("vanguard-plate") && rendererJs.includes("agile-duelist") && rendererJs.includes("counter-duelist") && rendererJs.includes("arcane-mantle"));
check("renderer has player weapon action helpers", rendererJs.includes("getPlayerWeaponActionVisuals") && rendererJs.includes("drawPlayerWeaponActionLayer") && rendererJs.includes("heavy-blade-pressure") && rendererJs.includes("twin-blade-flow") && rendererJs.includes("counter-blade-flow") && rendererJs.includes("focus-staff-channel"));
check("renderer has compact learning objective panel", rendererJs.includes("drawLearningObjectivePanel") && rendererJs.includes("getLearningObjectiveView") && rendererJs.includes("getPlayerFeedbackView"));
check("renderer has enemy model accent helpers", rendererJs.includes("getEnemyModelProfile") && rendererJs.includes("drawEnemyModelAccents") && rendererJs.includes("drawEnemyMaterialDetails") && rendererJs.includes("drawEnemyGearDetails") && rendererJs.includes("drawEnemyHeadgear") && rendererJs.includes("model.type"));
check("renderer has enemy rig silhouette helpers", rendererJs.includes("getEnemyRigProfile") && rendererJs.includes("drawEnemyRigBackDetails") && rendererJs.includes("ritual-caster") && rendererJs.includes("heavy-plate") && rendererJs.includes("low-cloak") && rendererJs.includes("ward-guard") && rendererJs.includes("stone-golem"));
check("renderer has enemy action personality helpers", rendererJs.includes("getEnemyActionPersonalityVisuals") && rendererJs.includes("drawEnemyActionPersonalityLayer") && rendererJs.includes("ritual-focus") && rendererJs.includes("plate-breaker") && rendererJs.includes("knife-speed") && rendererJs.includes("ward-brace") && rendererJs.includes("stone-breaker"));
check("renderer has enemy telegraph helpers", rendererJs.includes("getEnemyTelegraph") && rendererJs.includes("drawEnemyTelegraphLane") && rendererJs.includes("drawEnemyTelegraphHit") && rendererJs.includes("drawEnemyAttackPoseOverlay"));
check("renderer has enemy chain intent helpers", rendererJs.includes("getEnemyChainIntentVisuals") && rendererJs.includes("drawEnemyChainIntentLayer") && rendererJs.includes("currentIndex") && rendererJs.includes("nextCount"));
check("renderer has player qte chain intent helpers", rendererJs.includes("getPlayerQTEChainIntentVisuals") && rendererJs.includes("drawPlayerQTEChainIntentLayer") && rendererJs.includes("completedCount") && rendererJs.includes("hasBranch"));
check("renderer suppresses enemy attack floating message", rendererJs.includes('scene.turnState === "enemy_turn"') && rendererJs.includes("scene.enemyAttackPhase !== \"none\""));
check("renderer has compact counterflow presentation", rendererJs.includes("drawCounterFlowHud") && rendererJs.includes("drawCounterFocusLayer") && rendererJs.includes('scene.turnState === "player_turn" || scene.turnState === "followup_turn"') && rendererJs.includes("showStageLane"));
check("renderer skips legacy enemy motion when active attack exists", rendererJs.includes("hasEnemyActiveAttack") && rendererJs.includes("!hasEnemyActiveAttack") && rendererJs.includes("drawEnemyAttackMotion"));
check("renderer has player active attack helpers", rendererJs.includes("getPlayerActiveAttackDescriptor") && rendererJs.includes("drawPlayerMeleeActiveAttack") && rendererJs.includes("drawPlayerProjectileActiveAttack") && rendererJs.includes("drawPlayerSpellActiveAttack") && rendererJs.includes("drawPlayerPulseActiveAttack"));
check("renderer has actor status visual helpers", rendererJs.includes("getActorStatusVisuals") && rendererJs.includes("drawPlayerStatusAuras") && rendererJs.includes("drawEnemyStatusOverlays") && rendererJs.includes("drawStatusFlame"));
check("renderer has resource pulse helpers", rendererJs.includes("getResourcePulseVisuals") && rendererJs.includes("drawResourcePulseLayer") && rendererJs.includes("quadraticPoint"));
check("renderer has visual noise budget", rendererJs.includes("this.visualBudget") && rendererJs.includes("visualScale(kind") && rendererJs.includes('this.visualScale("resourcePulse")') && rendererJs.includes('this.visualScale("afterimage")') && rendererJs.includes('this.visualScale("motionLines")') && rendererJs.includes('this.visualScale("ornament")') && rendererJs.includes('this.visualScale("screenFlash")') && rendererJs.includes('this.visualScale("cameraShake")'));
check("renderer has visual diet policy", rendererJs.includes("this.visualPolicy") && rendererJs.includes("visualLayerEnabled(scene, layer)") && rendererJs.includes("actorGroundSigils: false") && rendererJs.includes("activeAttackContactGuides: false") && rendererJs.includes("counterFocusLayer: false") && rendererJs.includes("contactGroundImpulses: false") && rendererJs.includes("activeMeleeAttackTrails: false") && rendererJs.includes("combatPhaseLightingOrnaments: false") && rendererJs.includes("enemyChainIntentLayer: false") && rendererJs.includes("playerQTEChainIntentLayer: false") && rendererJs.includes("legacyPlayerAttackTrail: false") && rendererJs.includes("actorMotionLines: false") && rendererJs.includes("actorDamageMarks: false") && rendererJs.includes("actorModelDecorations: false") && rendererJs.includes("playerWeaponActionLayer: false") && rendererJs.includes("enemyAttackIcon: false") && rendererJs.includes("enemyActionPersonalityLayer: false"));
check("renderer gates noisy player-facing layers", rendererJs.includes('this.visualLayerEnabled(scene, "actorGroundSigils")') && rendererJs.includes('this.visualLayerEnabled(scene, "actorAfterimages")') && rendererJs.includes('this.visualLayerEnabled(scene, "actorStatusAuras")') && rendererJs.includes('this.visualLayerEnabled(scene, "defenseIntentOverlay")') && rendererJs.includes('this.visualLayerEnabled(scene, "activeAttackContactGuides")') && rendererJs.includes('this.visualLayerEnabled(scene, "activeMeleeAttackTrails")') && rendererJs.includes('this.visualLayerEnabled(scene, "combatPhaseLightingOrnaments")') && rendererJs.includes('this.visualLayerEnabled(scene, "enemyChainIntentLayer")') && rendererJs.includes('this.visualLayerEnabled(scene, "playerQTEChainIntentLayer")') && rendererJs.includes('this.visualLayerEnabled(scene, "legacyPlayerAttackTrail")') && rendererJs.includes('this.visualLayerEnabled(scene, "actorMotionLines")') && rendererJs.includes('this.visualLayerEnabled(scene, "actorDamageMarks")') && rendererJs.includes('this.visualLayerEnabled(scene, "actorModelDecorations")') && rendererJs.includes('this.visualLayerEnabled(scene, "playerWeaponActionLayer")') && rendererJs.includes('this.visualLayerEnabled(scene, "enemyAttackIcon")') && rendererJs.includes('this.visualLayerEnabled(scene, "enemyAttackPoseOverlay")') && rendererJs.includes('this.visualLayerEnabled(scene, "enemyActionPersonalityLayer")'));
check("renderer gates player back gear as model decoration", rendererJs.includes('this.visualLayerEnabled(scene, "actorModelDecorations")') && rendererJs.includes("this.drawPlayerRigBackDetails") && rendererJs.includes("this.drawPlayerBackGear"));
check("renderer samples authored melee body poses", rendererJs.includes("sampleActiveMeleePose(attack") && rendererJs.includes("phase: local < activeStart ? \"windup\"") && rendererJs.includes("meleePose.load") && rendererJs.includes("meleePose.strike") && rendererJs.includes("meleePose.recover") && rendererJs.includes("performance.meleePose = meleePose"));
check("renderer prioritizes active melee over caster idle poses", rendererJs.includes("if (isCaster && !meleePose)") && rendererJs.includes('rawPose === "slash"') && rendererJs.includes('rawPose === "smash"') && rendererJs.includes('enemyWeaponId') && rendererJs.includes('"sword"'));
check("renderer keeps melee contact impact compact", rendererJs.includes("if (!isBeam)") && rendererJs.includes("compactAlpha") && rendererJs.includes("Utils.clamp(contact.radius * 0.10") && rendererJs.includes("ctx.restore();\n      return;"));
check("renderer hides melee hit telegraph unless debug lane is enabled", rendererJs.includes('this.isMeleeTelegraph(telegraph) && !this.visualLayerEnabled(scene, "enemyTelegraphLane")') && rendererJs.includes("drawEnemyTelegraphHit"));
check("renderer draws each dual blade as one hand-held short blade", rendererJs.includes('profile.family === "twin-blade"') && rendererJs.includes("ctx.lineTo(len, -2)") && rendererJs.includes("ctx.lineTo(len - profile.tipLength, -4)"));
check("main decouples hit-confirm overlay from qte text drawer", mainJs.includes("window.__SHOW_HIT_CONFIRM_OVERLAY === true") && !mainJs.includes("scene.showHitConfirmOverlay = !qteDebugDrawer.classList.contains(\"hidden\")"));
check("particles use reduced density budget", fxJs.includes("this.density = 0.28") && fxJs.includes("this.alphaScale = 0.38") && fxJs.includes("actualCount") && fxJs.includes("glowScale"));
check("effect queue scales visual noise", effectsJs.includes("noiseBudget") && effectsJs.includes("scaleBurstEvent") && effectsJs.includes("screenFlash: 0.34") && effectsJs.includes("screenShake: 0.48"));
check("renderer dedupes status icons", rendererJs.includes("const seen = new Set()") && rendererJs.includes("addIcon(`${status.target}:${status.id}`"));
check("renderer has node-timed action helper", rendererJs.includes("getActionTiming"));
check("renderer supports node pose tags", rendererJs.includes("getCurrentPose") && rendererJs.includes("node.pose"));
check("chains include R10 pose tags", chainsJs.includes('motion: "flameBladeCut"') && chainsJs.includes('motion: "overflowBurst"') && chainsJs.includes('motion: "greatswordEarthsplit"'));
check("qte debug shows active pose", qteDebugJs.includes("姿态："));

check("touch controls no longer expose style numbers", !indexHtml.includes("touch-row-numeric") && !indexHtml.includes('data-key="8"'));
check("touch controls include click fallback", mainJs.includes('addEventListener("click"') && mainJs.includes("suppressTouchClick"));
check("touch controls include mouse fallback", mainJs.includes('addEventListener("mousedown"') && mainJs.includes("pressVirtualKey"));
check("touch controls use delegated hit mapping", mainJs.includes("getVirtualKeyFromEvent") && mainJs.includes("nearestDistance"));
check("touch controls handle virtual ESC", mainJs.includes("handleVirtualSystemKey") && mainJs.includes('appState === "battle"'));
check("hidden touch controls are inaccessible", indexHtml.includes('aria-hidden="true"') && styleCss.includes("visibility: hidden") && mainJs.includes("setTouchControlsVisible") && mainJs.includes('setAttribute("aria-hidden"'));
check("hidden drawers are visually inaccessible", styleCss.includes(".drawer:not(.hidden)") && styleCss.includes("visibility: hidden") && styleCss.includes("visibility: visible"));
check("demo system is not reachable from menu", indexHtml.includes('id="btn-demo" hidden disabled') && mainJs.includes("function startDemo()") && mainJs.includes("return;"));
check("enemy readout renderer exists", rendererJs.includes("drawEnemyAttackReadout") && rendererJs.includes("推荐"));
check("audio has R7 feedback cues", audioJs.includes("sfxWindowOpen") && audioJs.includes("sfxResourceGain") && audioJs.includes("sfxTransition"));
check("audio has layered counterflow cues", audioJs.includes("sfxClash") && audioJs.includes("sfxWhiff") && audioJs.includes("sfxGuardBreak") && audioJs.includes("sfxFollowupOpen") && audioJs.includes("sfxSpellInterrupt") && battleJs.includes("sfxClash") && battleJs.includes("sfxWhiff"));
check("audio has R9 quieter mix baseline", audioJs.includes("masterVolume: 0.30") && audioJs.includes("sfxChargePeak") && audioJs.includes("volume: 0.42"));
check("keyboard input includes combat action keys", inputJs.includes('"A"') && inputJs.includes('"S"') && inputJs.includes('"D"') && inputJs.includes('"SPACE"') && inputJs.includes('"F"'));
check("timing audit script exists", fs.existsSync(path.join(root, "scripts/check-timing.js")));
check("visual smoke script exists", !!visualSmokeJs);
check("visual smoke uses screenshot capture", visualSmokeJs.includes("Page.captureScreenshot"));
check("visual smoke script exists but demo coverage is frozen", !!visualSmokeJs);
check("visual smoke still covers combat screenshots", visualSmokeJs.includes("battle-player-active-attack") && visualSmokeJs.includes("battle-enemy-telegraph"));
check("visual smoke covers encounter phase model visuals", visualSmokeJs.includes("enemy encounter phase visuals active") && visualSmokeJs.includes("enemy phase nameplate uses phase name"));
check("visual smoke covers combat phase lighting", visualSmokeJs.includes("combat phase lighting qte active") && visualSmokeJs.includes("combat phase lighting enemy response"));
check("visual smoke covers cinematic focus", visualSmokeJs.includes("player attack cinematic focus") && visualSmokeJs.includes("enemy response cinematic focus"));
check("visual smoke covers stage-only camera impulse", visualSmokeJs.includes("stage-only camera impulse active") && visualSmokeJs.includes("getRenderCamera"));
check("visual smoke covers battle result summary", visualSmokeJs.includes("battle-result-summary") && visualSmokeJs.includes("getBattleResultLines"));
check("visual smoke covers enemy telegraph", visualSmokeJs.includes("battle-enemy-telegraph") && visualSmokeJs.includes("getEnemyTelegraph"));
check("visual smoke covers enemy chain intent", visualSmokeJs.includes("battle-enemy-chain-intent") && visualSmokeJs.includes("getEnemyChainIntentVisuals"));
check("visual smoke covers player qte chain intent", visualSmokeJs.includes("player qte chain intent active") && visualSmokeJs.includes("getPlayerQTEChainIntentVisuals"));
check("visual smoke covers player defense intent", visualSmokeJs.includes("player defense intent visuals active") && visualSmokeJs.includes("getPlayerDefenseIntentVisuals"));
check("visual smoke covers player active attacks", visualSmokeJs.includes("battle-player-active-attack") && visualSmokeJs.includes("battle-player-spell-active") && visualSmokeJs.includes("getPlayerActiveAttackDescriptor"));
check("visual smoke covers active attack contact guides", visualSmokeJs.includes("active attack contact guide anchored") && visualSmokeJs.includes("getActiveAttackContactGuide"));
check("visual smoke covers player rig silhouettes", visualSmokeJs.includes("greatsword player rig silhouette") && visualSmokeJs.includes("dual blades player rig silhouette"));
check("visual smoke covers player weapon action personalities", visualSmokeJs.includes("player weapon action greatsword") && visualSmokeJs.includes("player weapon action branches") && visualSmokeJs.includes("getPlayerWeaponActionVisuals"));
check("visual smoke covers enemy rig silhouettes", visualSmokeJs.includes("armored enemy rig silhouette") && visualSmokeJs.includes("caster enemy rig silhouette") && visualSmokeJs.includes("getEnemyRigProfile"));
check("visual smoke covers enemy action personalities", visualSmokeJs.includes("enemy action personality live caster") && visualSmokeJs.includes("enemy action personality visuals cover archetypes") && visualSmokeJs.includes("getEnemyActionPersonalityVisuals"));
check("visual smoke covers actor damage visuals", visualSmokeJs.includes("actor damage visuals active") && visualSmokeJs.includes("getActorDamageVisuals"));
check("visual smoke covers actor impact reactions", visualSmokeJs.includes("actor impact reaction visuals active") && visualSmokeJs.includes("getActorImpactReactionVisuals"));
check("visual smoke covers actor status visuals", visualSmokeJs.includes("actor status visuals active") && visualSmokeJs.includes("player status visuals active"));
check("visual smoke covers actor footwork visuals", visualSmokeJs.includes("player footwork visuals active") && visualSmokeJs.includes("enemy footwork visuals active"));
check("visual smoke covers actor intent badges", visualSmokeJs.includes("player intent badge active") && visualSmokeJs.includes("enemy intent badge active") && visualSmokeJs.includes("player defense intent badge active"));
check("visual smoke covers weapon silhouette profiles", visualSmokeJs.includes("weapon silhouette profiles distinct") && visualSmokeJs.includes("getWeaponSilhouetteProfile"));
check("visual smoke covers resource pulse visuals", visualSmokeJs.includes("resource pulse visuals active") && visualSmokeJs.includes("spell resource pulse active"));
check("visual smoke covers virtual controls", visualSmokeJs.includes("battle-virtual-controls-qte") && visualSmokeJs.includes("clickVirtualKey"));
check("visual smoke keeps combat layout coverage", visualSmokeJs.includes("battle-player-active-attack") && visualSmokeJs.includes("battle-enemy-telegraph"));
check("game container uses responsive 16:9 scaling", styleCss.includes("calc(100vh * 16 / 9)") && styleCss.includes("calc(100vw * 9 / 16)"));
check("small viewport compact rules exist", styleCss.includes("@media (max-width: 900px), (max-height: 520px)") && styleCss.includes(".drawer-content"));
check("main menu includes encounter select", indexHtml.includes('id="enemy-select"') && indexHtml.includes('value="encounter:counter_tutorial"') && indexHtml.includes('value="encounter:arcane_conduit"') && indexHtml.includes('value="encounter:counter_dojo"') && indexHtml.includes('value="swift"'));
check("result screen can copy telemetry", indexHtml.includes('id="btn-copy-telemetry"') && mainJs.includes("copyCombatTelemetry") && mainJs.includes("navigator.clipboard") && mainJs.includes("fallbackCopyText") && styleCss.includes(".telemetry-copy-status"));
check("battle supports encounter selection", battleJs.includes("encounterOverrideId") && battleJs.includes("applyEncounter") && battleJs.includes("pickEnemyAttackId"));
check("battle supports encounter phases", battleJs.includes("getCurrentEncounterPhase") && battleJs.includes("maybeEnterEncounterPhase") && battleJs.includes("getEncounterAttackPattern"));
check("battle supports difficulty assist profile", difficultyJs.includes("getAssistProfile") && difficultyJs.includes("chainOffsetMul") && difficultyJs.includes("qteWindowMul: 1.0") && battleJs.includes("getDifficultyAssistProfile") && battleJs.includes("chainOffsetMul"));
check("battle supports enemy pressure director", battleJs.includes("pickDirectedEnemyAttack") && battleJs.includes("getEnemyDirectorView") && battleJs.includes("directorPick") && battleJs.includes('this.activeEncounterId !== "counter_dojo"'));
check("battle exposes active animation event contract", battleJs.includes("getActiveAnimationEvents") && battleJs.includes("contactFrame") && battleJs.includes("activeStart") && battleJs.includes("animationEvents") && qteDebugJs.includes("动画事件："));
check("battle result summary exists", battleJs.includes("getBattleResultLines") && rendererJs.includes("战斗摘要") && mainJs.includes("getBattleResultLines") && styleCss.includes("game-over-stats-title"));
check("qte debug shows encounter rules", qteDebugJs.includes("getEncounterDebugLines"));
check("qte debug shows combat telemetry", qteDebugJs.includes("getCombatTelemetryLines"));
check("battle records combat comprehension events", battleJs.includes("recordCombatEvent(type") && battleJs.includes("getCombatTelemetryLines") && battleJs.includes("getCombatAdviceLine") && battleJs.includes("earlyCounters") && battleJs.includes("lateCounters") && battleJs.includes("invalidCounters") && battleJs.includes("followupsOpened") && battleJs.includes("早按会露破绽"));
check(
  "battle exposes learning objective and feedback views",
  battleJs.includes("getLearningObjectiveView")
    && battleJs.includes("getPlayerFeedbackView")
    && battleJs.includes("getWeaponIdentityView")
    && battleJs.includes("learningObjective")
    && battleJs.includes("weaponIdentity")
    && mainJs.includes("weaponIdentity")
    && qteDebugJs.includes("学习目标")
);
check(
  "persistent guard stance is implemented",
  battleJs.includes("updatePersistentGuard(dt)")
    && battleJs.includes("resolvePersistentGuardImpact")
    && battleJs.includes("getGuardStanceView")
    && battleJs.includes("guardBlocks")
    && mainJs.includes("按住 F 举盾到接触帧")
    && indexHtml.includes("命中接触帧才结算")
);
check(
  "weapon differentiation profiles exist",
  !!(WeaponDatabase.swordShield && WeaponDatabase.swordShield.guardProfile)
    && WeaponDatabase.swordShield.guardProfile.maxStability > WeaponDatabase.dualBlades.guardProfile.maxStability
    && WeaponDatabase.dualBlades.counterProfile.recovery < WeaponDatabase.greatsword.counterProfile.recovery
    && Object.values(WeaponDatabase).every(weapon => weapon.identity && weapon.identity.role && weapon.identity.publicTip)
    && weaponsJs.includes("swordShield")
    && checkBalanceJs.includes("Counter pressure by weapon")
    && checkBalanceJs.includes("Named encounter phase coverage")
);
check(
  "follow-up presentation is source-aware",
  battleJs.includes("追击窗口 ·")
    && battleJs.includes("举盾化解成功")
    && battleJs.includes("持盾闪避成功")
    && battleJs.includes("lastPlayerFeedback")
);
check(
  "combat telemetry export is local-only",
  battleJs.includes("getCombatTelemetryExport")
    && battleJs.includes('schema: "qte-counterflow-telemetry/v1"')
    && battleJs.includes("localOnly: true")
    && battleJs.includes("difficultyAssist")
    && battleJs.includes("enemyDirector")
    && battleJs.includes("resourcePolicy")
    && battleJs.includes("animationEvents")
    && mainJs.includes("window.exportCombatTelemetry")
    && qteDebugJs.includes("遥测导出")
);
check(
  "renderer boundary helper extraction exists",
  renderStateJs.includes("const RenderStateHelpers")
    && renderStateJs.includes("shouldShowPlayerStageLane")
    && renderStateJs.includes("getGuardStance")
    && rendererJs.includes("RenderStateHelpers.shouldShowPlayerStageLane")
    && rendererJs.includes("RenderStateHelpers.getGuardStance")
);
check(
  "armor and shield defense stats are explicit",
  enemiesJs.includes("defenseStats")
    && enemiesJs.includes("armorDamageMul")
    && enemiesJs.includes("shieldDamageMul")
    && battleJs.includes("applyEnemyDefenseStats")
    && battleJs.includes("armorMitigation")
    && battleJs.includes("shieldMitigation")
    && battleJs.includes("防护：护甲减伤")
);
check(
  "damage path audit exists",
  battleJs.includes("getDamagePathAudit")
    && battleJs.includes("persistent_guard_leak")
    && battleJs.includes("intentional-direct")
    && qteDebugJs.includes("getDamagePathAuditLines")
);
check(
  "flow smoke covers R63-R71 implementation",
  flowSmokeJs.includes("verifyPersistentGuardStance")
    && flowSmokeJs.includes("verifyWeaponDifferentiationAndTelemetryExport")
    && flowSmokeJs.includes("verifyArmorShieldDefenseStats")
    && flowSmokeJs.includes("damage path audit classifies public damage")
);
check("SPEC includes visual smoke command", specMd.includes("node scripts\\visual-smoke.js"));
check("SPEC protects QTE chain prototype system", specMd.includes("QTE Chain Prototype System") && specMd.includes("reference-critical") && specMd.includes("prototype reference"));
check(
  "SPEC includes completion roadmap specs",
  [
    "R63 Persistent Guard Stance Spec",
    "R64 Weapon Differentiation Spec",
    "R65 Follow-Up Turn Presentation Spec",
    "R66 Player-Facing Feedback And Tutorial Spec",
    "R67 Combat Telemetry Export Spec",
    "R68 Visual And Manual Test Sync Spec",
    "R69 Renderer Boundary Extraction Spec",
    "R70 Armor And Shield Depth Spec",
    "R71 Hit Confirm Completion Audit Spec",
    "R72 First-Run Counterflow Onboarding Spec",
    "R73 Enemy Attack Library Expansion Spec",
    "R74 Counter Feedback Clarity Spec",
    "R75 Weapon Identity And Handfeel Spec",
    "R76 Formal Prototype Transfer Contract Spec",
    "R77 Playtest Telemetry Copy Spec",
    "R78 Beginner Training Route Spec",
    "R79 Animation Contact Event Contract Spec",
    "R80 Layered Audio Feedback Spec",
    "R81 Time-Based Difficulty Assistance Spec",
    "R82 Enemy Phase Director Spec",
    "R83 Public Weapon Choice Spec",
    "R84 Resource Policy Closure Spec",
    "R85 Encounter Hard Extreme Coverage Spec",
    "R86 Debug Overlay And Hit Confirm Closure Spec"
  ].every(text => specMd.includes(text))
);
check("SPEC syntax check targets source directories", specMd.includes("Get-ChildItem -Path .\\js,.\\scripts"));
check("verify script exists", !!verifyJs);
check("verify script runs core gates", verifyJs.includes("scripts/validate-data.js") && verifyJs.includes("scripts/check-timing.js") && verifyJs.includes("scripts/check-balance.js") && verifyJs.includes("scripts/flow-smoke.js"));
check("verify script supports visual toggle", verifyJs.includes("--skip-visual") && verifyJs.includes("--visual") && verifyJs.includes("scripts/visual-smoke.js"));
check("CI workflow runs verify", ciYml.includes("node scripts/verify.js --ci --skip-visual"));
check("manual playtest checklist exists", manualChecklistMd.includes("Battle Feel") && manualChecklistMd.includes("QTE Prototype Reference") && manualChecklistMd.includes("learning objective") && manualChecklistMd.includes("formal transfer contract") && manualChecklistMd.includes("Audio") && !manualChecklistMd.includes("battle style `6`"));
check("README documents verify command", readmeMd.includes("node scripts/verify.js") && readmeMd.includes("--skip-visual"));
check("input reset protects virtual controls", inputJs.includes("reset()") && inputJs.includes("heldKeys.clear()") && inputJs.includes("options.fresh") && mainJs.includes("input.reset()") && mainJs.includes("pressVirtualKey(key)") && mainJs.includes("fresh: true") && mainJs.includes("tutorialOverlay.style.display !== \"none\""));
check("R12 handfeel profiles exist", utilsJs.includes("getChainHandfeel") && utilsJs.includes("getDemoPacing") && utilsJs.includes("overflow_burst"));
check("R14 battle qte pacing exists", utilsJs.includes("getBattleQTEPacing") && battleJs.includes("applyQTEPacing") && qteDebugJs.includes("实战节奏"));
check("qte impact legacy path removed", !battleJs.includes("qteImpact") && !rendererJs.includes("drawQTEImpactPrompt") && !qteDebugJs.includes("动画结算"));
check("enemy legacy hit resolver removed", !battleJs.includes("resolveEnemyHit"));
check("active attack system exists", activeAttacksJs.includes("class ActiveAttackSystem") && activeAttacksJs.includes("resolveProfile") && activeAttacksJs.includes("reactionStart"));
check("resource system tracks visual pulses", resourcesJs.includes("getVisualPulses") && resourcesJs.includes("recordVisualPulse"));
check(
  "resource policy closure is protected",
  SpellDatabase.fire.burnPolicy === "turnStartDot"
    && SpellDatabase.fire.heatTurnDecay > 0
    && SpellDatabase.absorb.overflowCostPolicy === "fixed"
    && resourcesJs.includes("decayHeatForTurn")
    && battleJs.includes("enemyTurnsStarted")
    && battleJs.includes("applyTurnBoundaryResourceRules")
    && battleJs.includes("splitQTEEffectsForActiveAttack")
    && flowSmokeJs.includes("verifyResourcePolicyClosure")
);
check("active attack emits reaction and impact visuals", activeAttacksJs.includes("emitReactionVisual") && activeAttacksJs.includes("emitImpactVisual"));
check("battle commits qte active attacks", battleJs.includes('kind: "playerQTE"') && battleJs.includes("resolvePlayerQTEImpact") && battleJs.includes("finishPlayerQTEFlow"));
check("battle commits enemy active attacks", battleJs.includes("commitEnemyActiveAttack") && battleJs.includes('kind: "enemyAttack"') && battleJs.includes("onActiveAttackReactionWindow"));
check("battle supports enemy attack chains", battleJs.includes("startEnemyAttackChain") && battleJs.includes("EnemyDatabase.attackChains") && battleJs.includes("triggerClashCounter"));
check("battle resolves counter nodes sequentially", battleJs.includes("counterNodeTargetId") && battleJs.includes("finishCounterNodeAttack") && battleJs.includes("shouldCounterNodeOpenFollowup"));
check("battle resolves counters by active-frame overlap", battleJs.includes("playerActiveStart") && battleJs.includes("enemyActiveStart") && battleJs.includes("overlapStart") && battleJs.includes("getCounterPerfectWindow"));
check("battle punishes early counter whiffs", battleJs.includes("triggerEarlyCounterAttempt") && battleJs.includes("counterEarlyWhiff") && battleJs.includes('defenseMode = "failedCounter"') && flowSmokeJs.includes("early counter whiff is punished by hit"));
check("battle suppresses small counter node damage noise", battleJs.includes("suppressFloatingText: true") && battleJs.includes("suppressLog: true") && battleJs.includes("resolveCounterNodeImpact") && battleJs.includes("resolveSpellInterruptImpact"));
check("active attack profiles expose active frames", activeAttacksJs.includes("activeStart") && activeAttacksJs.includes("activeDuration") && activeAttacksJs.includes("activeEnd"));
check("active attack system samples melee root motion", activeAttacksJs.includes("getActorMeleeOffset") && activeAttacksJs.includes("getMeleeOffsetForAttack") && activeAttacksJs.includes("resolveMeleeTimeline") && activeAttacksJs.includes("cloneRootMotion"));
check("active attack system suppresses melee reaction rings", activeAttacksJs.includes('attack.profile && attack.profile.type === "melee"') && activeAttacksJs.includes("emitReactionVisual(attack)") && activeAttacksJs.includes("emitCancelVisual(attack, response)"));
check("active attack melee impact emits no burst geometry", activeAttacksJs.includes("Do not emit burst geometry here") && !activeAttacksJs.includes('label: `active:${attack.id}:meleeImpact`'));
check("battle suppresses legacy melee slash bursts", battleJs.includes("Melee attacks are now expressed by actor root motion and weapon poses") && !battleJs.includes('kind: "slash",\n        anchor: "playerCore"') && !battleJs.includes('kind: "slash",\n        anchor: "enemyCore",\n        color: weapon.color'));
check("weapon counter profiles include active and whiff tuning", weaponsJs.includes("activeDuration") && weaponsJs.includes("whiffVulnerability"));
check("renderer draws target-anchored melee active attacks", rendererJs.includes("drawActiveAttacks") && rendererJs.includes("drawMeleeActiveAttack") && !rendererJs.includes("drawActiveAttackPrompt") && !rendererJs.includes("攻击实体推进中"));
check("battle exposes dynamic melee anchors", battleJs.includes("getActorMeleeOffset(actor)") && battleJs.includes("resolveBattleAnchor(anchor)") && battleJs.includes("buildCounterMeleeTimeline") && battleJs.includes("activeAttackSystem.clear()"));
check("renderer applies melee staging to actors", rendererJs.includes("playerStage") && rendererJs.includes("enemyStage") && rendererJs.includes("resolveCinematicAnchor(anchor)") && rendererJs.includes("resolveBattleAnchor(anchor)"));
check("renderer suppresses projectile-like enemy melee lines", rendererJs.includes("meleeEnemyPressure") && rendererJs.includes("const melee = attack.profile && attack.profile.type === \"melee\"") && rendererJs.includes('meleeType === "stab"') && rendererJs.includes('meleeType === "smash"'));
check("battle splits melee qte hits", battleJs.includes("buildQTEHitSegments") && battleJs.includes("commitSegmentedQTEActiveAttacks") && battleJs.includes("suppressFlowComplete") && battleJs.includes("suppressImpactSideEffects"));
check("battle trims qte floating text noise", battleJs.includes('if (outcome !== "success")') && !battleJs.includes("% 连击`, 740, 300"));
check("renderer suppresses qte stale overlays", rendererJs.includes("shouldDrawFloatingMessage") && rendererJs.includes("shouldDrawTurnBanner") && rendererJs.includes('scene.turnState !== "qte_running"') && visualSmokeJs.includes("battle qte suppresses stale overlays"));
check("main ui labels active attacks", mainJs.includes('battle.turnState === "attack_active"') && mainJs.includes("攻击演出"));
check("qte debug shows active attacks", qteDebugJs.includes("activeAttackSystem.getDebugLines"));
check("battle applies chain handfeel", battleJs.includes("Utils.getChainHandfeel(chainConfig") && battleJs.includes("Utils.getChainHandfeel(chain, { chainId, source: \"enemy\" })"));
check("battle applies qte pacing", battleJs.includes("Utils.getBattleQTEPacing") && battleJs.includes("qteRunner.timeScale") && battleJs.includes("qteRunner.postNodePause"));
check("demo code remains frozen but not menu-driven", demoModeJs.includes("class DemoMode") && indexHtml.includes('id="btn-demo" hidden disabled'));
check("manual qte is gated behind followup turn", battleJs.includes('case "followup_turn"') && battleJs.includes("updateFollowupTurn") && mainJs.includes("追击窗口") && flowSmokeJs.includes("recovery turn blocks manual qte"));
check("battle action HUD hides equipment noise", rendererJs.includes("isActionFocusedState") && rendererJs.includes("drawEquipmentChips") && rendererJs.includes('scene.turnState === "attack_active"'));
check("R14 accessible qte timings", chainsJs.includes("beats: [0.38, 0.82, 1.24]") && chainsJs.includes("duration: 1.18") && chainsJs.includes("perfect: 0.72") && chainsJs.includes("chargeMul: 1.08"));
check("single default plan preferred encounter exists", StyleDatabase.current.preferredEncounter === "counter_tutorial");
check("actor reactions include stronger hit feel", fxJs.includes("hit: 0.30") && fxJs.includes("crit: 0.42") && fxJs.includes("attack: 0.32") && fxJs.includes("stagger: 0.40") && fxJs.includes("recoil"));
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
console.log("  1. Main menu shows one current plan label and no style cards/dropdown.");
console.log("  2. Start battle and confirm it enters enemy turn without pressing 1-8.");
console.log("  3. Enemy turn -> spell node can be interrupted by A/S/D without starting counterspell QTE.");
console.log("  4. Start battle from main menu and confirm it directly enters the default counter plan.");
console.log("  5. Enemy turn -> press A/S/D inside an attack window and confirm clash/interruption feedback.");
console.log("  6. Demo button should stay hidden/disabled while this combat-plan pass is active.");

if (failures > 0) {
  console.error(`Smoke checklist failed: ${failures}`);
  process.exitCode = 1;
} else {
  console.log("Smoke checklist passed.");
}
