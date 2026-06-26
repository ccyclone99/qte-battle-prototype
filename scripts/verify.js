#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));
const explicitVisual = args.has("--visual");
const explicitSkipVisual = args.has("--skip-visual") || args.has("--quick");
const ciMode = args.has("--ci") || !!process.env.CI;

if (args.has("--help") || args.has("-h")) {
  console.log([
    "Usage: node scripts/verify.js [--skip-visual|--visual] [--ci]",
    "",
    "Default local run includes screenshot visual smoke.",
    "CI mode skips visual smoke unless --visual is passed.",
    "",
    "Options:",
    "  --skip-visual  Run deterministic checks only.",
    "  --quick        Alias for --skip-visual.",
    "  --visual       Force visual smoke, even in CI.",
    "  --ci           Use CI defaults."
  ].join("\n"));
  process.exit(0);
}

if (explicitVisual && explicitSkipVisual) {
  console.error("Use only one of --visual or --skip-visual.");
  process.exit(1);
}

const includeVisual = explicitVisual || (!explicitSkipVisual && !ciMode);
const node = process.execPath;
const startedAt = Date.now();
const results = [];

function rel(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function collectJsFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      out.push(rel(fullPath));
    }
  }

  return out;
}

function run(label, command, commandArgs) {
  const index = results.length + 1;
  const taskStart = Date.now();
  console.log("");
  console.log(`[verify] ${index}. ${label}`);
  console.log(`[verify] $ ${[command, ...commandArgs].join(" ")}`);

  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    windowsHide: true
  });

  const elapsed = ((Date.now() - taskStart) / 1000).toFixed(1);
  if (result.error) {
    console.error(`[verify] ${label} failed to start: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[verify] ${label} failed after ${elapsed}s.`);
    process.exit(result.status || 1);
  }

  results.push({ label, elapsed });
  console.log(`[verify] ${label} passed in ${elapsed}s.`);
}

function runSyntaxChecks() {
  const files = [
    ...collectJsFiles(path.join(root, "js")),
    ...collectJsFiles(path.join(root, "scripts")),
    "server.js",
    "save_screenshot.js"
  ]
    .filter(file => fs.existsSync(path.join(root, file)))
    .sort();

  for (const file of files) {
    run(`syntax ${file}`, node, ["--check", file]);
  }
}

run("data validation", node, ["scripts/validate-data.js"]);
run("timing audit", node, ["scripts/check-timing.js"]);
run("balance audit", node, ["scripts/check-balance.js", "--strict"]);
run("static smoke checklist", node, ["scripts/smoke-checklist.js"]);
run("flow smoke", node, ["scripts/flow-smoke.js"]);
runSyntaxChecks();

if (includeVisual) {
  run("visual smoke", node, ["scripts/visual-smoke.js"]);
} else {
  console.log("");
  console.log("[verify] visual smoke skipped. Run `node scripts/verify.js --visual` to include screenshot checks.");
}

const totalElapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log("");
console.log(`[verify] passed ${results.length} task(s) in ${totalElapsed}s.`);
