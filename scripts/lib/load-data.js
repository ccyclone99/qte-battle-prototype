const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..", "..");

const defaultDataFiles = [
  ["js/utils.js", "Utils"],
  ["js/data/chains.js", "ChainDatabase"],
  ["js/data/weapons.js", "WeaponDatabase"],
  ["js/data/spells.js", "SpellDatabase"],
  ["js/data/combatArts.js", "CombatArtDatabase"],
  ["js/data/defenses.js", "DefenseDatabase"],
  ["js/data/enemies.js", "EnemyDatabase"],
  ["js/data/encounters.js", "EncounterDatabase"],
  ["js/data/styles.js", "StyleDatabase"],
  ["js/data/effects.js", "EffectEventDefinitions"],
  ["js/systems/statuses.js", "StatusDefinitions"],
  ["js/systems/resources.js", "ResourceDefinitions"],
  ["js/systems/chain-effects.js", "ChainEffectSystem"]
];

function loadFile(context, relPath, exportName) {
  const fullPath = path.join(root, relPath);
  const code = fs.readFileSync(fullPath, "utf8");
  vm.runInContext(`${code}\nglobalThis.${exportName} = ${exportName};`, context, { filename: relPath });
}

function loadDataContext(extraFiles = []) {
  const context = vm.createContext({ console });
  for (const [relPath, exportName] of [...defaultDataFiles, ...extraFiles]) {
    loadFile(context, relPath, exportName);
  }
  return context;
}

module.exports = {
  root,
  defaultDataFiles,
  loadDataContext
};
