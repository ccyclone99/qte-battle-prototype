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
  statusDuration: 8
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

const context = loadDataContext();
const { ChainDatabase, ChainEffectSystem } = context;
const summaries = [];
const warnings = [];

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

const topDamage = summaries
  .filter(item => item.outcome === "perfect")
  .sort((a, b) => b.damage - a.damage)
  .slice(0, 8);

const topResources = summaries
  .filter(item => item.outcome === "perfect" && item.resourceTotal > 0)
  .sort((a, b) => b.resourceTotal - a.resourceTotal)
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
