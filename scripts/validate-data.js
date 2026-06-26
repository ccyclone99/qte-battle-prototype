const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

const dataFiles = [
  ["js/data/chains.js", "ChainDatabase"],
  ["js/data/weapons.js", "WeaponDatabase"],
  ["js/data/spells.js", "SpellDatabase"],
  ["js/data/combatArts.js", "CombatArtDatabase"],
  ["js/data/defenses.js", "DefenseDatabase"],
  ["js/data/enemies.js", "EnemyDatabase"],
  ["js/data/styles.js", "StyleDatabase"],
  ["js/data/effects.js", "EffectEventDefinitions"],
  ["js/systems/statuses.js", "StatusDefinitions"],
  ["js/systems/resources.js", "ResourceDefinitions"]
];

const context = vm.createContext({ console });
const errors = [];

function fail(message) {
  errors.push(message);
}

function loadDataFile(relPath, exportName) {
  const fullPath = path.join(root, relPath);
  const code = fs.readFileSync(fullPath, "utf8");
  vm.runInContext(`${code}\nglobalThis.${exportName} = ${exportName};`, context, { filename: relPath });
}

for (const [relPath, exportName] of dataFiles) {
  loadDataFile(relPath, exportName);
}

const {
  ChainDatabase,
  WeaponDatabase,
  SpellDatabase,
  CombatArtDatabase,
  DefenseDatabase,
  EnemyDatabase,
  StyleDatabase
} = context;
const { EffectEventDefinitions, ResourceDefinitions, StatusDefinitions } = context;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

const allowedPoseStates = new Set(["idle", "swordAttack", "casting", "charge", "shield"]);
const allowedPoseMotions = new Set([
  "greatswordDraw",
  "greatswordCharge",
  "greatswordCleave",
  "greatswordEarthsplit",
  "greatswordOvercharge",
  "dualDash",
  "dualFlurry",
  "dualFinisher",
  "dualRetreat",
  "fireKindle",
  "fireCharge",
  "fireRelease",
  "fireSpark",
  "fireOverheat",
  "absorbSigil",
  "absorbSiphon",
  "absorbRelease",
  "absorbLeak",
  "flameBladeIgnite",
  "flameBladeCut",
  "flameBladeBurst",
  "flameBladeEmber",
  "mirrorGuard",
  "overflowCompress",
  "overflowBurst",
  "overflowVent"
]);

function validateTransition(chainId, node, key, transition, nodeIds) {
  if (!isObject(transition)) {
    fail(`${chainId}.${node.id}.${key}: transition must be an object`);
    return;
  }

  if (transition.next !== null && transition.next !== undefined && !nodeIds.has(transition.next)) {
    fail(`${chainId}.${node.id}.${key}: next references missing node "${transition.next}"`);
  }

  for (const numericField of ["damage", "chargeMul", "selfStun", "stunEnemy", "iframe", "damageMul", "staminaCost"]) {
    if (transition[numericField] !== undefined && !isNumber(transition[numericField])) {
      fail(`${chainId}.${node.id}.${key}: ${numericField} must be a number`);
    }
  }

  if (transition.effect !== undefined && typeof transition.effect !== "string") {
    fail(`${chainId}.${node.id}.${key}: effect must be a string`);
  }

  if (transition.visualEvent !== undefined && typeof transition.visualEvent !== "string") {
    fail(`${chainId}.${node.id}.${key}: visualEvent must be a string`);
  } else if (transition.visualEvent !== undefined && EffectEventDefinitions && !EffectEventDefinitions[transition.visualEvent]) {
    fail(`${chainId}.${node.id}.${key}: visualEvent "${transition.visualEvent}" is not registered`);
  }

  if (transition.resource !== undefined) {
    if (!isObject(transition.resource)) {
      fail(`${chainId}.${node.id}.${key}: resource must be an object`);
    } else {
      for (const [resourceKey, value] of Object.entries(transition.resource)) {
        if (!isNumber(value)) {
          fail(`${chainId}.${node.id}.${key}: resource.${resourceKey} must be a number`);
        } else if (ResourceDefinitions && !ResourceDefinitions[resourceKey]) {
          fail(`${chainId}.${node.id}.${key}: resource.${resourceKey} is not registered`);
        }
      }
    }
  }

  if (transition.status !== undefined) {
    if (!isObject(transition.status)) {
      fail(`${chainId}.${node.id}.${key}: status must be an object`);
    } else {
      if (typeof transition.status.type !== "string") {
        fail(`${chainId}.${node.id}.${key}: status.type must be a string`);
      } else if (StatusDefinitions && !StatusDefinitions[transition.status.type]) {
        fail(`${chainId}.${node.id}.${key}: status.type "${transition.status.type}" is not registered`);
      }
      if (transition.status.target !== undefined && typeof transition.status.target !== "string") {
        fail(`${chainId}.${node.id}.${key}: status.target must be a string`);
      }
      if (transition.status.turns !== undefined && !isNumber(transition.status.turns)) {
        fail(`${chainId}.${node.id}.${key}: status.turns must be a number`);
      }
    }
  }
}

function validateNode(chainId, node, nodeIds) {
  if (typeof node.id !== "string" || !node.id) fail(`${chainId}: node id is required`);
  if (typeof node.name !== "string" || !node.name) fail(`${chainId}.${node.id}: node name is required`);
  if (!isNumber(node.duration) || node.duration <= 0) fail(`${chainId}.${node.id}: duration must be > 0`);

  const input = node.input;
  if (!isObject(input)) {
    fail(`${chainId}.${node.id}: input is required`);
  } else {
    const validTypes = new Set(["press", "hold_release", "rhythm"]);
    if (!validTypes.has(input.type)) fail(`${chainId}.${node.id}: invalid input type "${input.type}"`);
    if (typeof input.key !== "string" || !input.key) fail(`${chainId}.${node.id}: input.key is required`);
    if (input.type === "rhythm") {
      if (!Array.isArray(input.beats) || input.beats.length === 0) {
        fail(`${chainId}.${node.id}: rhythm input requires beats`);
      } else {
        for (const beat of input.beats) {
          if (!isNumber(beat) || beat < 0 || beat > node.duration) {
            fail(`${chainId}.${node.id}: rhythm beat ${beat} is outside node duration`);
          }
        }
      }
    }
  }

  if (node.window !== undefined) {
    if (!isObject(node.window)) {
      fail(`${chainId}.${node.id}: window must be an object`);
    } else if (!isNumber(node.window.start) || !isNumber(node.window.end) || node.window.start < 0 || node.window.end < node.window.start) {
      fail(`${chainId}.${node.id}: invalid window`);
    }
  }

  if (node.perfect !== null && node.perfect !== undefined && !isNumber(node.perfect)) {
    fail(`${chainId}.${node.id}: perfect must be null or number`);
  }

  if (node.pose !== undefined) {
    if (!isObject(node.pose)) {
      fail(`${chainId}.${node.id}: pose must be an object`);
    } else {
      if (typeof node.pose.state !== "string" || !allowedPoseStates.has(node.pose.state)) {
        fail(`${chainId}.${node.id}: pose.state must be one of ${Array.from(allowedPoseStates).join(", ")}`);
      }
      if (typeof node.pose.motion !== "string" || !allowedPoseMotions.has(node.pose.motion)) {
        fail(`${chainId}.${node.id}: pose.motion "${node.pose.motion}" is not registered`);
      }
    }
  }

  const transitionKeys = Object.keys(node).filter(key => /^on[A-Z]/.test(key));
  if (transitionKeys.length === 0) fail(`${chainId}.${node.id}: at least one transition is required`);
  for (const key of transitionKeys) {
    validateTransition(chainId, node, key, node[key], nodeIds);
  }
}

function validateChains() {
  let nodeCount = 0;

  for (const [chainId, chain] of Object.entries(ChainDatabase)) {
    for (const field of ["key", "name", "description", "color", "family", "role", "visual"]) {
      if (typeof chain[field] !== "string" || !chain[field]) {
        fail(`${chainId}: ${field} is required`);
      }
    }
    if (!Array.isArray(chain.tags) || chain.tags.length === 0) {
      fail(`${chainId}: tags must be a non-empty array`);
    }
    if (chain.cost !== undefined) {
      if (!isObject(chain.cost)) {
        fail(`${chainId}: cost must be an object`);
      } else {
        for (const [resourceKey, value] of Object.entries(chain.cost)) {
          if (!isNumber(value) || value <= 0) {
            fail(`${chainId}: cost.${resourceKey} must be a positive number`);
          } else if (ResourceDefinitions && !ResourceDefinitions[resourceKey]) {
            fail(`${chainId}: cost.${resourceKey} is not registered`);
          }
        }
      }
    }
    if (!Array.isArray(chain.nodes) || chain.nodes.length === 0) {
      fail(`${chainId}: nodes must be a non-empty array`);
      continue;
    }

    const nodeIds = new Set();
    for (const node of chain.nodes) {
      if (nodeIds.has(node.id)) fail(`${chainId}: duplicate node id "${node.id}"`);
      nodeIds.add(node.id);
    }

    for (const node of chain.nodes) {
      validateNode(chainId, node, nodeIds);
      nodeCount++;
    }
  }

  return nodeCount;
}

function assertChainExists(owner, chainId) {
  if (!ChainDatabase[chainId]) fail(`${owner}: chain "${chainId}" does not exist`);
}

function validateReferences() {
  for (const [weaponId, weapon] of Object.entries(WeaponDatabase)) {
    for (const [key, chainId] of Object.entries(weapon.chains || {})) {
      assertChainExists(`WeaponDatabase.${weaponId}.chains.${key}`, chainId);
    }
  }

  for (const [spellId, spell] of Object.entries(SpellDatabase)) {
    for (const [weaponId, chains] of Object.entries(spell.chainMap || {})) {
      if (!WeaponDatabase[weaponId]) fail(`SpellDatabase.${spellId}.chainMap: unknown weapon "${weaponId}"`);
      for (const [key, chainId] of Object.entries(chains)) {
        assertChainExists(`SpellDatabase.${spellId}.chainMap.${weaponId}.${key}`, chainId);
      }
    }
  }

  for (const [artId, art] of Object.entries(CombatArtDatabase)) {
    for (const [weaponId, chainId] of Object.entries(art.followUpChains || {})) {
      if (!WeaponDatabase[weaponId]) fail(`CombatArtDatabase.${artId}.followUpChains: unknown weapon "${weaponId}"`);
      assertChainExists(`CombatArtDatabase.${artId}.followUpChains.${weaponId}`, chainId);
    }
  }

  for (const [defenseId, defense] of Object.entries(DefenseDatabase)) {
    assertChainExists(`DefenseDatabase.${defenseId}.chainId`, defense.chainId);
  }

  const validateEnemyAttackList = (owner, enemy) => {
    for (const attackId of enemy.attacks || []) {
      if (!EnemyDatabase.attacks[attackId]) fail(`${owner}: unknown attack "${attackId}"`);
    }
  };
  validateEnemyAttackList("EnemyDatabase.base", EnemyDatabase.base);
  for (const [enemyId, enemy] of Object.entries(EnemyDatabase.archetypes || {})) {
    validateEnemyAttackList(`EnemyDatabase.archetypes.${enemyId}`, enemy);
  }

  for (const [styleId, style] of Object.entries(StyleDatabase)) {
    if (!WeaponDatabase[style.weapon]) fail(`StyleDatabase.${styleId}: unknown weapon "${style.weapon}"`);
    for (const spellId of style.spells || []) {
      if (!SpellDatabase[spellId]) fail(`StyleDatabase.${styleId}: unknown spell "${spellId}"`);
    }
    for (const artId of style.combatArts || []) {
      if (!CombatArtDatabase[artId]) fail(`StyleDatabase.${styleId}: unknown combat art "${artId}"`);
    }
    if (style.preferredEnemy && (!EnemyDatabase.archetypes || !EnemyDatabase.archetypes[style.preferredEnemy])) {
      fail(`StyleDatabase.${styleId}: unknown preferredEnemy "${style.preferredEnemy}"`);
    }
  }
}

const nodeCount = validateChains();
validateReferences();

if (errors.length > 0) {
  console.error(`Data validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Data validation passed: ${Object.keys(ChainDatabase).length} chains, ${nodeCount} nodes.`);
