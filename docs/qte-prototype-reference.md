# QTE Prototype Reference

This document is the permanent reference index for the QTE chain prototype. The public build may expose only the current counter-flow combat plan, but the broader QTE chain system remains reference-critical for the formal game.

## Retention Contract

- Keep `js/data/chains.js`, `js/qte-runner.js`, `js/demo-mode.js`, `js/systems/chain-effects.js`, QTE-related data files, validation scripts, simulation scripts, timing scripts, balance scripts, visual smoke, and this document unless an equivalent replacement is committed in the same change.
- Hidden public UI is not removal. `btn-demo` can stay hidden/disabled while the counter-flow public prototype is active.
- Chain data and runner behavior should remain executable through scripts and tests even when public demo entry points are frozen.
- Do not merge QTE prototype cleanup with combat tuning unless both sides have explicit acceptance checks.

## Current Public Surface

- Public battle starts directly into the default counter-flow plan.
- Public style selection is removed.
- Public demo entry is hidden and disabled.
- Manual weapon QTE chains are gated behind `followup_turn`, which opens only after successful enemy-turn response.

## Prototype Assets

Core runtime:

- `js/qte-runner.js`: chain node timing, input handling, branch resolution, result log.
- `js/systems/chain-effects.js`: transition effect normalization and resource/status collection.
- `js/systems/qte-debug.js`: runtime debug lines for current node, timing window, handfeel, hit confirm, telemetry.
- `js/battle.js`: public battle integration, active-attack commit, follow-up gating, defense QTE resolution.
- `js/demo-mode.js`: frozen public entry, retained `DemoMode` class and authored-chain presentation reference.

Data:

- `js/data/chains.js`: all QTE chain definitions.
- `js/data/weapons.js`: weapon-to-chain mapping and counter profile tuning.
- `js/data/spells.js`: spell chain mapping and resource rules.
- `js/data/combatArts.js`: combat-art chain mapping and legacy style references.
- `js/data/defenses.js`: dodge, parry, guard defense chain mapping.
- `js/data/effects.js`: visual event definitions consumed by battle/demo effects.

Verification:

- `node scripts/validate-data.js`
- `node scripts/sim-chain.js <chainId> <perfect|success|early|late|fail>`
- `node scripts/check-timing.js`
- `node scripts/check-balance.js`
- `node scripts/flow-smoke.js`
- `node scripts/visual-smoke.js`
- `node scripts/verify.js --skip-visual`
- `node scripts/verify.js --visual`

## Chain Catalog

Weapon chains:

- Greatsword: `greatsword_a`, `greatsword_s`, `greatsword_d`, `greatsword_a_v2`, `greatsword_s_v2`, `greatsword_d_v2`
- Dual Blades: `dualblades_a`, `dualblades_s`, `dualblades_d`, `dualblades_a_v2`, `dualblades_s_v2`, `dualblades_d_v2`
- Staff: `staff_a`, `staff_s`, `staff_d`

Spell and fusion chains:

- Fire: `fireball_evolution`, `fireball_evolution_v2`, `flame_blade`, `shield_flare`
- Absorb / counterspell: `absorb_siphon`, `counterspell_reversal`, `mirror_guard`, `overflow_burst`

Follow-up chains:

- `followup_greatsword`
- `followup_dualblades`
- `followup_staff`

Defense chains:

- `dodge`
- `parry`
- `guard`

## Chain Data Contract

Each chain should keep these fields meaningful:

- `id`: stable key used by maps, scripts, smoke, and docs.
- `name`: player/debug-facing label.
- `family`: broad mechanic group such as `greatsword`, `dualBlades`, `fire`, `absorb`, `defense`, or `combatArt`.
- `role`: opener, signature, control, fusion, defense, follow-up, or spender role.
- `tags`: machine-readable tags for validation, rendering, and future formal-game import.
- `nodes`: ordered timing and branch units.

Each node should keep these fields meaningful:

- `id` and `name`: stable debug and result identifiers.
- `duration`: authored node duration before pacing scale.
- `input`: press, hold-release, or rhythm definition.
- `window`: success timing window where applicable.
- `perfect`: perfect timing point or tolerance.
- `pose`: optional authored state/motion hint for battle and renderer.
- `branches`: outcome transitions and side effects.

Branch side effects should stay data-driven:

- `damage`
- `damageMul`
- `stunEnemy`
- `selfStun`
- `iframe`
- `openPlayerTurn`
- `resource`
- `status`
- `absorbReady`
- `visualEvent`
- `message`

## Resource And Status Policy

Current prototype decisions:

- Burn is enemy turn-start DOT. It does not amplify the next Fire hit.
- Fire heat boosts Fire chain damage, protects opening encounter heat once, then decays by `SpellDatabase.fire.heatTurnDecay` at later enemy-turn boundaries.
- Absorb overflow uses fixed chain costs. Overcap pressure is represented by the spell-energy cap multiplier, overcap backlash, and spender timing.
- Positive resources and enemy statuses are impact-side rewards. They require confirmed hit overlap.
- Negative resource costs are commit-side costs. A spender can consume resources even if the authored hit later whiffs.
- Defensive whiffs consume animation/time and expose the player, but do not spend spell/heat resources unless a chain explicitly commits a cost.

## Runner Lifecycle

1. A chain is selected from loadout, defense response, follow-up window, or test/demo code.
2. `QTEChainRunner` starts at node 0 and reads node timing, input type, and judgement windows.
3. Player input resolves the node as `perfect`, `success`, `early`, `late`, `fail`, or `timeout`.
4. The selected branch may advance to another node, end the chain, or emit transition effects.
5. `resultLog` records node outcomes for debug, active-attack segmentation, and telemetry.
6. Battle integration converts final effects into active attacks, resources, statuses, or turn-flow changes.
7. Damage should resolve at active-attack impact/collision, not immediately on input completion.
8. Impact-side resource gains and statuses resolve only after hit confirm.

## Extension Checklist

When adding or changing a chain:

1. Add or edit the chain in `js/data/chains.js`.
2. Map it from the correct weapon/spell/combat-art/defense data file.
3. Give every authored node a `pose` when the animation should communicate a distinct motion.
4. Prefer data-driven `visualEvent` names over battle-specific branches.
5. Run `node scripts/validate-data.js`.
6. Run at least one `node scripts/sim-chain.js <chainId> perfect`.
7. Run `node scripts/check-timing.js` and `node scripts/check-balance.js`.
8. If the chain affects public combat, add or update `flow-smoke.js`.
9. If the chain affects visual readability, add or update `visual-smoke.js`.
10. Update this document when the chain becomes part of the formal reference set.

## Public Freeze Notes

- Demo code is retained but not menu-driven.
- Style `6`, style `7`, and style `8` public entry paths are obsolete in the current public build.
- Historical demo/showcase behavior should be treated as reference material, not current public acceptance.
- Current public acceptance is the default counter-flow plan, enemy-turn response, follow-up QTE gating, active-attack impact, and readable low-noise combat visuals.

## Formal Transfer Contract

The formal game should treat these shapes as the stable prototype contract. Field names may change during production, but the meaning should remain portable.

### Input Event

```js
{
  type: "press" | "release",
  key: "A" | "S" | "D" | "SPACE" | "F",
  time: 12345
}
```

Rules:

- `clear()` may remove pending events, but it must not release held keys.
- `reset()` releases held keys and is reserved for hard state transitions.
- `F` can be held before enemy contact; settlement happens at the active attack contact frame.

### QTE Chain

```js
{
  id: "dualblades_a_v2",
  family: "dualBlades",
  role: "signature",
  tags: ["weapon", "melee"],
  nodes: [
    {
      id: "dash",
      duration: 0.8,
      input: { type: "press", key: "A" },
      window: { start: 0.35, end: 0.68 },
      perfect: 0.52,
      pose: { state: "attack", motion: "dash" },
      branches: { perfect: {}, success: {}, fail: {} }
    }
  ]
}
```

Rules:

- Input completion starts authored action; damage waits for active attack impact.
- Node-level pose tags are presentation hints, not damage authority.
- Branch side effects should remain data-driven where possible.

### Enemy Attack

```js
{
  id: "delayedCleave",
  windup: 1.55,
  hitTime: 0.34,
  damage: 24,
  allowedResponses: ["dodge", "guard"],
  telegraph: { type: "delay", pose: "drawback", width: 64 },
  meleeTimeline: {
    total: 1.74,
    contactFrame: 1.18,
    activeStart: 1.02,
    activeEnd: 1.34,
    rootMotion: { source: [], target: [] }
  },
  counter: {
    type: "heavy_melee",
    canClash: true,
    canGuard: true,
    canDodge: true,
    recommended: ["A", "F", "SPACE"]
  }
}
```

Rules:

- `contactFrame` is the damage authority for melee attacks.
- `activeStart` / `activeEnd` define the clash/guard/dodge readability window.
- `counter.type` defines the player decision category.

### Enemy Attack Chain

```js
{
  id: "rapidTriple",
  nodes: [
    { id: "left", attackId: "quickStab", offset: 0, counterNode: "clash_light" },
    { id: "right", attackId: "quickStab", offset: 0.58, counterNode: "clash_light" },
    { id: "cut", attackId: "slash", offset: 1.16, opensFollowupOnSuccess: true }
  ]
}
```

Rules:

- Each node resolves separately; one player input cannot automatically cover the full chain.
- Follow-up windows should open only after authored success conditions.
- Offsets should preserve readable anticipation and avoid impossible overlap.

### Active Attack And Hit Confirm

```js
{
  source: "player" | "enemy",
  target: "enemy" | "player",
  timeline: {
    startup: 0.12,
    reactionStart: 0.64,
    reactionDuration: 0.24,
    impactTime: 0.88,
    recovery: 0.32
  },
  damageIntent: {
    token: "unique-hit-token",
    shape: "arc" | "beam" | "trail",
    anchor: "playerHand",
    toAnchor: "enemyCore",
    damage: 20
  }
}
```

Rules:

- Player QTE, enemy active attacks, counters, normal attacks, and guard leak damage route through hit confirm.
- Status DOT and resource backlash are intentional direct-damage exceptions.
- Duplicate hit tokens must not apply duplicate damage.

### Animation Event

```js
{
  id: "aa:12",
  kind: "enemyAttack",
  source: "enemy",
  target: "player",
  phase: "reaction",
  type: "melee",
  motion: "slash",
  contactFrame: 1.18,
  activeStart: 1.02,
  activeEnd: 1.34,
  chainId: "tutorialTwoHitRead",
  chainIndex: 1,
  chainCount: 2,
  canceled: false,
  defenderResponse: ""
}
```

Rules:

- Animation events are read-only descriptors derived from active attacks.
- `contactFrame` and `activeStart` / `activeEnd` are the timing bridge between authored animation and damage/counter settlement.
- Production animation can rename fields, but must preserve phase, source/target, contact frame, active window, and cancel/response state.

### Learning Objective

```js
{
  id: "multi-node",
  tone: "active",
  title: "目标：逐段拼刀",
  progress: "压步三连 2/3",
  lines: ["当前段提示", "每段只结算自己的攻击"]
}
```

Rules:

- Learning objective is renderer-read-only.
- It should describe the immediate player task, not the whole ruleset.
- It must remain optional for production UI.

### Telemetry Export

```js
{
  schema: "qte-counterflow-telemetry/v1",
  localOnly: true,
  weaponIdentity: {},
  learningObjective: {},
  feedback: {},
  difficultyAssist: {},
  enemyDirector: {},
  animationEvents: [],
  counters: {},
  events: []
}
```

Rules:

- Export is local/manual only; it must not transmit player data.
- It should include enough combat context to tune timing, feedback, weapon identity, difficulty assistance, enemy pressure selection, and animation/contact timing.

### Renderer Boundary

- Renderer reads `getLearningObjectiveView()`, `getPlayerFeedbackView()`, `getWeaponIdentityView()`, `getGuardStanceView()`, `getActiveAnimationEvents()`, and `RenderStateHelpers`.
- Renderer must not mutate combat timing, HP, QTE state, hit confirm state, or input state.
- New visual layers should be smoke-tested if they affect the public combat surface.

## Known Gaps Before Formal Game Import

- Persistent held guard exists in prototype form, but production needs animation-authored shield poses and stamina/poise integration.
- Weapon-family identity exists as metadata and tuning, but formal balance still needs manual playtest telemetry across all encounters.
- Current public weapon choice is weapon-only; production can later add broader builds if they do not reintroduce ambiguous style-chain behavior.
- Follow-up turn presentation is source-aware, but production should add authored animation transitions per weapon.
- QTE telemetry is local/manual only; production can add an opt-in telemetry pipeline later.
- Enemy director is intentionally small and limited to advanced pressure routes; production should keep beginner training deterministic.
- Demo/reference material needs a future non-public archive viewer or export path if designers need visual browsing again.
- Renderer boundaries have started with pure helpers, but large production UI should split combat HUD, actor rig, and debug overlays further.
