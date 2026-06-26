#!/usr/bin/env node

const { loadDataContext } = require("./lib/load-data");

const context = loadDataContext([["js/difficulty.js", "Difficulty"]]);
const { ChainDatabase, Difficulty } = context;

const outcomes = ["perfect", "success", "early", "late", "fail"];
const difficultyIds = ["easy", "normal", "hard", "extreme"];
const budgets = {
  easy: { path: 5.2, node: 3.0, holdPerfect: 2.1, firstInput: 0.85 },
  normal: { path: 3.8, node: 2.2, holdPerfect: 1.7, firstInput: 0.70 },
  hard: { path: 3.5, node: 2.05, holdPerfect: 1.55, firstInput: 0.65 },
  extreme: { path: 3.2, node: 1.9, holdPerfect: 1.4, firstInput: 0.60 }
};

function cap(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function getTransition(node, outcome) {
  return node["on" + cap(outcome)] || node.onFail || node.onSuccess || node.onPerfect || { next: null };
}

function expectedResolveTime(node, outcome) {
  const duration = node.duration || 0;
  const input = node.input || {};
  const win = node.window || { start: 0, end: duration };

  if (input.type === "rhythm") {
    const beats = input.beats || [];
    const tolerance = node.rhythmTolerance || 0.18;
    if (beats.length === 0) return duration;
    if (outcome === "fail" || outcome === "early" || outcome === "late") {
      return Math.min(duration + 0.25, beats[0] + tolerance);
    }
    return beats[beats.length - 1];
  }

  if (outcome === "perfect" && node.perfect !== null && node.perfect !== undefined) {
    return Math.max(0.05, Math.min(duration - 0.05, node.perfect + 0.08));
  }
  if (outcome === "success") {
    return Math.max(0.05, Math.min(duration, (win.start + win.end) / 2));
  }
  if (outcome === "early") {
    return Math.max(0.05, win.start - 0.05);
  }
  return duration + 0.25;
}

function analyzePath(chain, outcome) {
  const nodesById = new Map((chain.nodes || []).map(node => [node.id, node]));
  let node = chain.nodes && chain.nodes[0];
  let expected = 0;
  let duration = 0;
  const route = [];
  const visited = new Set();

  while (node && !visited.has(node.id)) {
    visited.add(node.id);
    route.push(node.name || node.id);
    expected += expectedResolveTime(node, outcome);
    duration += node.duration || 0;
    const transition = getTransition(node, outcome);
    node = transition.next ? nodesById.get(transition.next) : null;
  }

  return {
    outcome,
    expected,
    duration,
    nodes: route.length,
    route: route.join(" -> ")
  };
}

function firstInputTime(chain) {
  const first = chain.nodes && chain.nodes[0];
  if (!first) return 0;
  if (first.input && first.input.type === "rhythm" && first.input.beats && first.input.beats.length > 0) {
    return first.input.beats[0];
  }
  return expectedResolveTime(first, "perfect");
}

function maxNodeDuration(chain) {
  return Math.max(...(chain.nodes || []).map(node => node.duration || 0), 0);
}

function maxHoldPerfect(chain) {
  return Math.max(...(chain.nodes || [])
    .filter(node => node.input && node.input.type === "hold_release")
    .map(node => node.perfect !== null && node.perfect !== undefined
      ? node.perfect
      : expectedResolveTime(node, "success")), 0);
}

function printRows(rows) {
  for (const row of rows) {
    console.log(
      `  ${row.diff.padEnd(7)} ${row.id.padEnd(24)} ${row.outcome.padEnd(7)} ` +
      `expected ${round(row.expected).toFixed(2)}s / duration ${round(row.duration).toFixed(2)}s | ${row.route}`
    );
  }
}

const rows = [];
const issues = [];

for (const diff of difficultyIds) {
  Difficulty.set(diff);
  const budget = budgets[diff];

  for (const [id, sourceChain] of Object.entries(ChainDatabase)) {
    const chain = Difficulty.scaleChain(sourceChain);
    const paths = outcomes.map(outcome => analyzePath(chain, outcome));
    const slowest = paths.reduce((best, item) => item.expected > best.expected ? item : best, paths[0]);
    const first = firstInputTime(chain);
    const nodeDuration = maxNodeDuration(chain);
    const holdPerfect = maxHoldPerfect(chain);

    rows.push({ diff, id, ...slowest });

    if (slowest.expected > budget.path) {
      issues.push(`${diff}/${id}: expected path ${round(slowest.expected)}s > ${budget.path}s (${slowest.outcome})`);
    }
    if (nodeDuration > budget.node) {
      issues.push(`${diff}/${id}: max node duration ${round(nodeDuration)}s > ${budget.node}s`);
    }
    if (holdPerfect > budget.holdPerfect) {
      issues.push(`${diff}/${id}: hold perfect ${round(holdPerfect)}s > ${budget.holdPerfect}s`);
    }
    if (first > budget.firstInput) {
      issues.push(`${diff}/${id}: first expected input ${round(first)}s > ${budget.firstInput}s`);
    }
  }
}

console.log("Timing audit: slowest playable paths");
printRows(rows
  .sort((a, b) => b.expected - a.expected)
  .slice(0, 16));

console.log("");
if (issues.length > 0) {
  console.error("Timing audit failed:");
  for (const issue of issues) console.error(`  [FAIL] ${issue}`);
  process.exitCode = 1;
} else {
  console.log("Timing audit passed.");
}
