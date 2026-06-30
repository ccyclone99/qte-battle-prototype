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

## Runner Lifecycle

1. A chain is selected from loadout, defense response, follow-up window, or test/demo code.
2. `QTEChainRunner` starts at node 0 and reads node timing, input type, and judgement windows.
3. Player input resolves the node as `perfect`, `success`, `early`, `late`, `fail`, or `timeout`.
4. The selected branch may advance to another node, end the chain, or emit transition effects.
5. `resultLog` records node outcomes for debug, active-attack segmentation, and telemetry.
6. Battle integration converts final effects into active attacks, resources, statuses, or turn-flow changes.
7. Damage should resolve at active-attack impact/collision, not immediately on input completion.

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

## Known Gaps Before Formal Game Import

- Persistent held guard is not implemented.
- Weapon-family gameplay differences need stronger public tuning.
- Follow-up turn needs clearer player-facing presentation.
- QTE telemetry is in-memory only.
- Demo/reference material needs a future non-public archive viewer or export path if designers need visual browsing again.
- Renderer boundaries should be split before the prototype becomes a larger production codebase.
