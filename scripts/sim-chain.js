#!/usr/bin/env node

const { loadDataContext } = require("./lib/load-data");

const chainId = process.argv[2];
const outcome = process.argv[3] || "perfect";
const validOutcomes = new Set(["perfect", "success", "early", "late", "fail"]);

function usage(chainIds) {
  console.log("Usage: node scripts/sim-chain.js <chainId> [perfect|success|early|late|fail]");
  console.log("Examples:");
  console.log("  node scripts/sim-chain.js flame_blade perfect");
  console.log("  node scripts/sim-chain.js overflow_burst success");
  if (chainIds && chainIds.length > 0) {
    console.log(`Available chains (${chainIds.length}): ${chainIds.join(", ")}`);
  }
}

function formatResources(resources) {
  const entries = Object.entries(resources || {}).filter(([, value]) => value !== 0);
  if (entries.length === 0) return "none";
  return entries.map(([key, value]) => `${key} ${value > 0 ? "+" : ""}${value}`).join(", ");
}

function formatStatuses(statuses) {
  if (!statuses || statuses.length === 0) return "none";
  return statuses.map(status => status.type || status.id || "unknown").join(", ");
}

const context = loadDataContext();
const { ChainDatabase, ChainEffectSystem } = context;
const chainIds = Object.keys(ChainDatabase).sort();

if (!chainId) {
  usage(chainIds);
  process.exit(1);
}

if (!validOutcomes.has(outcome)) {
  console.error(`Invalid outcome: ${outcome}`);
  usage(chainIds);
  process.exit(1);
}

const chain = ChainDatabase[chainId];
if (!chain) {
  console.error(`Unknown chain: ${chainId}`);
  usage(chainIds);
  process.exit(1);
}

const result = ChainEffectSystem.simulateChain(chain, outcome);

console.log(`Chain: ${chainId} - ${chain.name}`);
console.log(`Family: ${chain.family || "unknown"}`);
console.log(`Outcome: ${ChainEffectSystem.formatOutcome(outcome)}`);
console.log(`Terminated: ${result.terminatedBy}`);
console.log(`Damage: ${result.effects.damage}`);
console.log(`Resources: ${formatResources(result.effects.resources)}`);
console.log(`Statuses: ${formatStatuses(result.effects.statuses)}`);
if (result.effects.stunEnemy) console.log(`Stun enemy: ${result.effects.stunEnemy}s`);
if (result.effects.selfStun) console.log(`Self stun: ${result.effects.selfStun}s`);
if (result.effects.iframe) console.log(`I-frame: ${result.effects.iframe}s`);
if (result.effects.openPlayerTurn) console.log("Opens player turn: yes");
console.log("");

for (const line of ChainEffectSystem.timelineLinesFromRows(result.rows)) {
  console.log(line);
}
