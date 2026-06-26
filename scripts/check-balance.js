#!/usr/bin/env node

const { loadDataContext } = require("./lib/load-data");

const OUTCOMES = ["perfect", "success", "early", "late", "fail"];
const strict = process.argv.includes("--strict");

const LIMITS = {
  perfectDamage: 95,
  successDamage: 75,
  failDamage: 25,
  stunEnemy: 1.6,
  selfStun: 2.0,
  positiveResource: {
    heat: 45,
    spellEnergy: 70
  },
  statusDuration: 8,
  encounterPerfectDamage: 115,
  encounterSuccessDamage: 90,
  encounterOpeningResource: {
    heat: 35,
    spellEnergy: 60
  }
};

function warn(warnings, chainId, chain, outcome, message) {
  warnings.push({
    chainId,
    chainName: chain.name,
    outcome,
    message
  });
}

function resourceTotal(resources) {
  return Object.values(resources || {}).reduce((sum, value) => sum + Math.max(0, value || 0), 0);
}

function statusDuration(status) {
  if (!status) return 0;
  return status.duration || status.turns || 0;
}

function summarizeResult(chainId, chain, outcome, result) {
  return {
    chainId,
    chainName: chain.name,
    family: chain.family || "unknown",
    outcome,
    damage: result.effects.damage,
    resourceTotal: resourceTotal(result.effects.resources),
    resources: result.effects.resources,
    stunEnemy: result.effects.stunEnemy,
    selfStun: result.effects.selfStun,
    terminatedBy: result.terminatedBy
  };
}

const context = loadDataContext([["js/difficulty.js", "Difficulty"]]);
const { ChainDatabase, ChainEffectSystem, EncounterDatabase, SpellDatabase, StyleDatabase, Utils, Difficulty, EnemyDatabase } = context;
const summaries = [];
const encounterSummaries = [];
const encounterPressure = [];
const warnings = [];

function isSwordChain(style, key) {
  return ["greatsword", "dualBlades"].includes(style.weapon) && ["A", "S", "D"].includes(key);
}

function applyEncounterDamage(baseDamage, chain, result, style, key, encounter) {
  if (baseDamage <= 0 || !encounter) return baseDamage;
  const mods = encounter.modifiers || {};
  let damage = baseDamage;
  const applyMul = mul => {
    if (mul && mul !== 1) damage = Math.floor(damage * mul);
  };

  if (chain.family === "fire") {
    const openingHeat = mods.startHeat || 0;
    const heatBonus = SpellDatabase.fire.heatDamageBonusPerPoint || 0;
    if (openingHeat > 0 && heatBonus > 0) {
      applyMul(1 + openingHeat * heatBonus);
    }
    applyMul(mods.fireDamageMul);
  }
  if (chain.family === "absorb") applyMul(mods.absorbDamageMul);
  if (isSwordChain(style, key)) applyMul(mods.swordDamageMul);

  const appliesArmorBreak = (result.effects.statuses || []).some(status => status.type === "armorBreak");
  if (appliesArmorBreak) applyMul(mods.armorBreakDamageMul);
  return damage;
}

function validateEncounterOpeningResources(encounterId, encounter) {
  const mods = encounter.modifiers || {};
  for (const [resourceKey, limit] of Object.entries(LIMITS.encounterOpeningResource)) {
    const value = mods[`start${resourceKey.charAt(0).toUpperCase()}${resourceKey.slice(1)}`] || 0;
    if (value > limit) {
      warnings.push({
        chainId: `encounter:${encounterId}`,
        chainName: encounter.name,
        outcome: "opening",
        message: `${resourceKey} opening resource ${value} exceeds ${limit}`
      });
    }
  }
}

function getEncounterPatterns(encounter) {
  const patterns = [{ id: "base", name: encounter.name, attackPattern: encounter.attackPattern, modifiers: encounter.modifiers || {} }];
  for (const phase of encounter.phases || []) {
    patterns.push({
      id: phase.id,
      name: phase.name,
      attackPattern: phase.attackPattern,
      modifiers: { ...(encounter.modifiers || {}), ...(phase.modifiers || {}) }
    });
  }
  return patterns;
}

function buildEncounterAttack(attackId, modifiers) {
  const source = EnemyDatabase.attacks[attackId];
  const attack = Difficulty.scaleAttack({ id: attackId, ...source });
  if (modifiers.enemyWindupMul) {
    attack.windup *= modifiers.enemyWindupMul;
    attack.hitTime *= modifiers.enemyWindupMul;
  }
  attack.responseDuration = Difficulty.responseDuration() * (modifiers.responseWindowMul || 1);
  return attack;
}

function getEnemyAttackTiming(attack) {
  const impactTime = attack.windup + attack.hitTime;
  const readableCap = Utils.clamp(attack.hitTime + 0.28, 0.48, 0.92);
  const responseDuration = Math.min(attack.responseDuration || Difficulty.responseDuration(), readableCap);
  return {
    impactTime,
    responseDuration,
    responseStart: Math.max(0, impactTime - responseDuration)
  };
}

function validateEncounterPressure(encounterId, encounter) {
  for (const difficultyId of Object.keys(Difficulty.presets || {})) {
    Difficulty.set(difficultyId);
    for (const pattern of getEncounterPatterns(encounter)) {
      let previousFastAttack = null;
      for (const [idx, attackId] of (pattern.attackPattern || []).entries()) {
        const attack = buildEncounterAttack(attackId, pattern.modifiers || {});
        const timing = getEnemyAttackTiming(attack);
        encounterPressure.push({
          difficultyId,
          encounterId,
          phaseId: pattern.id,
          attackId,
          impactTime: timing.impactTime,
          responseDuration: timing.responseDuration
        });

        if (difficultyId === "hard" && timing.impactTime < 0.9) {
          warnings.push({
            chainId: `encounter:${encounterId}:${pattern.id}`,
            chainName: encounter.name,
            outcome: difficultyId,
            message: `${attackId} impact ${timing.impactTime.toFixed(2)}s is too fast for hard`
          });
        }
        if (difficultyId === "extreme" && timing.impactTime < 0.8) {
          warnings.push({
            chainId: `encounter:${encounterId}:${pattern.id}`,
            chainName: encounter.name,
            outcome: difficultyId,
            message: `${attackId} impact ${timing.impactTime.toFixed(2)}s is too fast for extreme`
          });
        }
        if (["hard", "extreme"].includes(difficultyId) && timing.responseDuration < 0.48) {
          warnings.push({
            chainId: `encounter:${encounterId}:${pattern.id}`,
            chainName: encounter.name,
            outcome: difficultyId,
            message: `${attackId} response window ${timing.responseDuration.toFixed(2)}s is below readable floor`
          });
        }

        const isFast = timing.impactTime < 1.0;
        if (["hard", "extreme"].includes(difficultyId) && isFast && previousFastAttack) {
          warnings.push({
            chainId: `encounter:${encounterId}:${pattern.id}`,
            chainName: encounter.name,
            outcome: difficultyId,
            message: `fast pressure chain ${previousFastAttack.attackId}->${attackId} at slots ${previousFastAttack.index + 1}/${idx + 1}`
          });
        }
        previousFastAttack = isFast ? { attackId, index: idx } : null;
      }
    }
  }
}

for (const [chainId, chain] of Object.entries(ChainDatabase)) {
  const byOutcome = new Map();

  for (const outcome of OUTCOMES) {
    const result = ChainEffectSystem.simulateChain(chain, outcome);
    byOutcome.set(outcome, result);
    summaries.push(summarizeResult(chainId, chain, outcome, result));

    if (result.terminatedBy !== "complete") {
      warn(warnings, chainId, chain, outcome, `simulation terminated by ${result.terminatedBy}`);
    }

    if (outcome === "perfect" && result.effects.damage > LIMITS.perfectDamage) {
      warn(warnings, chainId, chain, outcome, `perfect damage ${result.effects.damage} exceeds ${LIMITS.perfectDamage}`);
    }
    if (outcome === "success" && result.effects.damage > LIMITS.successDamage) {
      warn(warnings, chainId, chain, outcome, `success damage ${result.effects.damage} exceeds ${LIMITS.successDamage}`);
    }
    if (outcome === "fail" && result.effects.damage > LIMITS.failDamage) {
      warn(warnings, chainId, chain, outcome, `fail damage ${result.effects.damage} exceeds ${LIMITS.failDamage}`);
    }
    if (result.effects.stunEnemy > LIMITS.stunEnemy) {
      warn(warnings, chainId, chain, outcome, `enemy stun ${result.effects.stunEnemy}s exceeds ${LIMITS.stunEnemy}s`);
    }
    if (result.effects.selfStun > LIMITS.selfStun) {
      warn(warnings, chainId, chain, outcome, `self stun ${result.effects.selfStun}s exceeds ${LIMITS.selfStun}s`);
    }

    for (const [key, value] of Object.entries(result.effects.resources || {})) {
      const limit = LIMITS.positiveResource[key];
      if (limit !== undefined && value > limit) {
        warn(warnings, chainId, chain, outcome, `${key} gain ${value} exceeds ${limit}`);
      }
    }

    for (const status of result.effects.statuses || []) {
      const duration = statusDuration(status);
      if (duration > LIMITS.statusDuration) {
        warn(warnings, chainId, chain, outcome, `status ${status.type || status.id} duration ${duration} exceeds ${LIMITS.statusDuration}`);
      }
    }
  }

  const perfectDamage = byOutcome.get("perfect").effects.damage;
  const successDamage = byOutcome.get("success").effects.damage;
  const failDamage = byOutcome.get("fail").effects.damage;

  if (successDamage > perfectDamage) {
    warn(warnings, chainId, chain, "success", `success damage ${successDamage} is above perfect damage ${perfectDamage}`);
  }
  if (failDamage > successDamage && successDamage > 0) {
    warn(warnings, chainId, chain, "fail", `fail damage ${failDamage} is above success damage ${successDamage}`);
  }
  if ((chain.tags || []).includes("spender") && !chain.cost) {
    warn(warnings, chainId, chain, "all", "spender chain has no explicit cost");
  }
}

for (const [encounterId, encounter] of Object.entries((EncounterDatabase && EncounterDatabase.encounters) || {})) {
  validateEncounterOpeningResources(encounterId, encounter);
  validateEncounterPressure(encounterId, encounter);
}

for (const [styleId, style] of Object.entries(StyleDatabase || {})) {
  const encounterId = style.preferredEncounter;
  const encounter = encounterId && EncounterDatabase.encounters[encounterId];
  if (!encounter) continue;

  const effectiveChains = Utils.getEffectiveChains(style);
  for (const [key, chainId] of Object.entries(effectiveChains)) {
    if (key === "followUp") continue;
    const chain = ChainDatabase[chainId];
    if (!chain) continue;

    for (const outcome of OUTCOMES) {
      const result = ChainEffectSystem.simulateChain(chain, outcome);
      const adjustedDamage = applyEncounterDamage(result.effects.damage, chain, result, style, key, encounter);
      encounterSummaries.push({
        styleId,
        encounterId,
        encounterName: encounter.name,
        key,
        chainId,
        chainName: chain.name,
        outcome,
        damage: adjustedDamage,
        baseDamage: result.effects.damage
      });

      if (outcome === "perfect" && adjustedDamage > LIMITS.encounterPerfectDamage) {
        warn(warnings, `${styleId}/${encounterId}/${chainId}`, chain, outcome, `encounter perfect damage ${adjustedDamage} exceeds ${LIMITS.encounterPerfectDamage}`);
      }
      if (outcome === "success" && adjustedDamage > LIMITS.encounterSuccessDamage) {
        warn(warnings, `${styleId}/${encounterId}/${chainId}`, chain, outcome, `encounter success damage ${adjustedDamage} exceeds ${LIMITS.encounterSuccessDamage}`);
      }
    }
  }
}

const topDamage = summaries
  .filter(item => item.outcome === "perfect")
  .sort((a, b) => b.damage - a.damage)
  .slice(0, 8);

const topResources = summaries
  .filter(item => item.outcome === "perfect" && item.resourceTotal > 0)
  .sort((a, b) => b.resourceTotal - a.resourceTotal)
  .slice(0, 8);

const topEncounterDamage = encounterSummaries
  .filter(item => item.outcome === "perfect")
  .sort((a, b) => b.damage - a.damage)
  .slice(0, 8);

console.log(`Balance scan: ${Object.keys(ChainDatabase).length} chains, ${summaries.length} simulations`);
console.log("");
console.log("Top perfect damage:");
for (const item of topDamage) {
  console.log(`  ${item.chainId.padEnd(22)} ${String(item.damage).padStart(3)}  ${item.chainName}`);
}

console.log("");
console.log("Top perfect resource gains:");
for (const item of topResources) {
  const resources = Object.entries(item.resources)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key} ${value > 0 ? "+" : ""}${value}`)
    .join(", ");
  console.log(`  ${item.chainId.padEnd(22)} ${resources}`);
}

console.log("");
console.log("Top encounter-adjusted perfect damage:");
for (const item of topEncounterDamage) {
  const delta = item.damage === item.baseDamage ? "" : ` (base ${item.baseDamage})`;
  console.log(`  ${item.styleId.padEnd(11)} ${item.encounterId.padEnd(16)} ${item.chainId.padEnd(22)} ${String(item.damage).padStart(3)}${delta}  ${item.chainName}`);
}

const tightestPressure = encounterPressure
  .filter(item => item.difficultyId === "hard" || item.difficultyId === "extreme")
  .sort((a, b) => a.impactTime - b.impactTime)
  .slice(0, 6);

console.log("");
console.log("Tightest encounter enemy timings:");
for (const item of tightestPressure) {
  console.log(`  ${item.difficultyId.padEnd(7)} ${item.encounterId.padEnd(16)} ${item.phaseId.padEnd(18)} ${item.attackId.padEnd(12)} impact ${item.impactTime.toFixed(2)}s / window ${item.responseDuration.toFixed(2)}s`);
}

console.log("");
if (warnings.length === 0) {
  console.log("Warnings: none");
} else {
  console.log(`Warnings: ${warnings.length}`);
  for (const item of warnings) {
    console.log(`  [${item.chainId}/${item.outcome}] ${item.message}`);
  }
}

if (strict && warnings.length > 0) {
  process.exitCode = 1;
}
