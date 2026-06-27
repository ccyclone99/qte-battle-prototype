# QTE Battle Prototype Complete Spec

## 1. Purpose

This project is a tactical QTE duel prototype. The core experience is not "press random keys fast"; it is reading enemy intent, choosing a chain, executing timing inputs, and seeing clear rule outcomes through readable effects.

The prototype should become a content-extensible combat sandbox:

- Designers can add weapons, spells, combat arts, enemy attacks, and demo entries through data.
- Players can understand timing, branches, resources, and status effects from the screen without reading debug logs.
- Developers can validate chain data automatically and extend effects without mixing visual code into combat rules.

## 2. Current State

### Implemented

- Main menu HUD bleed fixed.
- QTE and demo layout moved into safer screen zones.
- Demo playback speed and node pauses tuned.
- Difficulty timing now keeps QTE speed close to base data and widens/narrows windows around the intended timing point.
- Staff chant, Fire charge, and Absorb siphon timings tuned to avoid stalled charge/rhythm playback.
- R7 feedback pass added audio cues for charge peaks, resource changes, status application, enemy windows, and transition impacts.
- Demo mode now opens with a Showcase category for high-signal staged examples.
- Enemy attack bars now show attack type, danger level, recommended response keys, and response-window countdowns.
- Fireball charge particles moved out of renderer-side draw calls.
- QTE handfeel padding added for press, hold-release, rhythm, and timeout grace.
- Chain metadata added to all current chains:
  - `family`
  - `role`
  - `visual`
  - `tags`
- Data validator added:
  - `node scripts/validate-data.js`
- Staff + Fire vertical slice implemented:
  - `fireball_evolution_v2` on staff `A`
  - kindle -> charge -> release
  - spark and overheat fallback branches
- Absorb active chain implemented:
  - `absorb_siphon` on staff `S`
  - sigil -> rhythm siphon -> release
  - spell energy gain and absorb-ready state
- Demo mode includes Fire v2 and Absorb active-chain entries.
- Effect event queue implemented:
  - shared visual event routing for battle and demo
  - named anchors for player, enemy, QTE, and HUD positions
  - weapon, spell, status, resource, and charge event helpers
- Status system implemented:
  - registered `burn`, `armorBreak`, `absorbReady`, `shieldEnchant`, `overload`, and `stun`
  - burn turn tick
  - armor-break damage multiplier
  - player absorb/shield flags synchronized through statuses
- Resource system implemented:
  - spell energy gain/spend/overflow
  - heat gain/spend loop for Fire
  - overload warning status from spell energy overcap or high heat
- Effect registry implemented:
  - `js/data/effects.js`
  - validator checks registered `visualEvent` names
- Chain effect helper implemented:
  - shared resource application
  - shared status application
  - shared demo result and chain-effect descriptions
- QTE debug drawer implemented:
  - node id, timer, input window, perfect point, last input, outcome, and handfeel values
- Greatsword V2 implemented:
  - `greatsword_a_v2`
  - `greatsword_s_v2`
  - `greatsword_d_v2`
  - default Greatsword A/S/D mapping uses V2 chains
- Dual Blades V2 implemented:
  - `dualblades_a_v2`
  - `dualblades_s_v2`
  - `dualblades_d_v2`
  - default Dual Blades A/S/D mapping uses V2 chains
- Data validator checks registered status ids.
- Fire R3 implemented:
  - `flame_blade`
  - `shield_flare`
  - heat damage loop and HUD heat display
- Absorb R3 implemented:
  - `mirror_guard`
  - `overflow_burst`
  - spell-energy spender cost gate
- Composite styles implemented:
  - `flameforge`
  - `mirrorblade`
- Enemy archetype initial pass implemented:
  - caster
  - armored
  - swift
  - shielded

### Still Needed

- Demo timeline and replay inspector.
- Balance pass for damage, timing windows, recovery, and resource loops.
- Shared render helpers for QTE, demo, and effects.
- Balance/simulation scripts for chain outputs and enemy pressure.

## 3. Design Pillars

### Readability First

- The player should know what is happening before they are asked to react.
- Timing windows, charge state, enemy attack phase, and branch results must be visible.
- Effects should clarify state and impact before adding spectacle.

### Fail Forward

- Early, late, and failed inputs should not always hard-stop a chain.
- Bad inputs should often produce weaker branches, self-stun, resource leak, or fallback attacks.
- Perfect should feel meaningfully different, not only numerically stronger.

### Data-Driven Content

- Weapons, spells, combat arts, enemy attacks, statuses, and demo entries should move toward data definitions.
- Runtime code should interpret data consistently rather than hardcoding every chain.

### Rule/Visual Separation

- Combat systems decide outcomes.
- Effect systems visualize outcomes.
- Renderer should draw state, not create gameplay or particle side effects.

## 4. Non-Goals For This Prototype

- No full RPG inventory system yet.
- No permanent character progression yet.
- No network or save system.
- No production-grade animation framework until the combat loop is stable.
- No large engine migration unless vanilla Canvas becomes the actual blocker.

## 5. Core Gameplay Loop

1. Player selects a combat style.
2. Player turn begins.
3. Action bar fills or player chooses `A/S/D`.
4. QTE chain starts.
5. Each node resolves to `perfect`, `success`, `early`, `late`, `fail`, or `timeout`.
6. Chain transitions accumulate:
   - damage
   - stun
   - self-stun
   - resources
   - statuses
   - visual events
   - follow-up windows
7. Enemy turn begins unless the player earns an extra turn, stun, interrupt, or follow-up.
8. Enemy windup creates a response window.
9. Player chooses dodge, parry, guard, or special reaction.
10. Result feeds back into the next player turn.

### Hit Confirm And Collision Layer

The combat loop should move from "result immediately applies damage" toward "result creates an authored hit, and the hit applies damage only when it overlaps a target hurtbox." This should make attacks feel more physical without turning the prototype into a full physics game.

This layer is needed because the project now has readable attack, windup, hit, and recoil animation. Damage should line up with those visuals:

- A sword chain should deal damage when its slash arc reaches the enemy hurtbox.
- A spell should deal damage when its beam/projectile/pulse reaches the enemy hurtbox.
- An enemy attack should damage the player only when the enemy hitbox overlaps the player hurtbox.
- Defense, dodge, parry, guard, absorb, and iframe outcomes should still modify or cancel the hit before HP changes.

Non-goals:

- No free-movement physics.
- No rigid-body simulation.
- No continuous collision between every visual particle and every actor.
- No engine migration for collision alone.

Runtime model:

- `hurtbox`: persistent logical body volume for player and enemy.
- `hitbox`: short-lived authored volume created by an attack node, enemy attack, normal attack, or defense counter.
- `hitToken`: unique id for one damaging swing/projectile/pulse, used to prevent repeated HP loss from the same hitbox.
- `damageIntent`: the pending damage/effects produced by QTE outcome or enemy attack rules before HP is changed.
- `hitConfirm`: overlap result that converts `damageIntent` into `applyDamage()`.

Recommended logical coordinate model:

- Use the existing battle-space anchors as the source of truth:
  - `playerCore`
  - `playerHand`
  - `playerShield`
  - `enemyCore`
  - `enemyChest`
- Hurtboxes can start as simple rectangles or capsules:
  - player: center around `playerCore`, approximately `70w x 110h`
  - enemy: center around `enemyCore`, approximately `90w x 130h`
- Reactions/pose offsets may later influence hurtboxes, but phase 1 can use stable anchors to avoid visual jitter changing gameplay.

Suggested data shape:

```js
{
  id: "greatsword_s_v2.cleave.perfect",
  source: "player",
  target: "enemy",
  token: "chainId/nodeId/outcome/runId",
  shape: "arc", // rect | circle | capsule | beam | arc
  anchor: "playerHand",
  toAnchor: "enemyCore",
  startTime: 0.12,
  activeTime: 0.18,
  damage: 42,
  effects: {
    stunEnemy: 0.2,
    resource: { heat: 6 },
    statuses: []
  },
  visualEvent: "greatswordCleavePerfect"
}
```

Resolution rules:

- QTE node resolution creates one or more `damageIntent` records instead of applying HP damage immediately.
- A hitbox is active only during its authored active window.
- A hitbox can hit each target at most once per `hitToken`.
- If a hitbox overlaps the target hurtbox:
  - apply encounter modifiers
  - apply armor/status modifiers
  - call `applyDamage()`
  - emit impact spark, actor reaction, floating damage, and registered visual event
- If no overlap occurs:
  - emit a clear whiff/miss visual
  - do not apply HP damage
  - optionally preserve non-damage resource costs if the chain data says the resource was spent on cast, not on impact
- Defense QTE outcomes must be resolved before enemy hitboxes apply damage:
  - dodge/iframe: hitbox can overlap, but HP damage is canceled
  - guard: overlap applies reduced damage and guard reaction
  - parry/absorb: enemy damage is canceled or reflected according to current rules

Phase 1 implementation scope:

- Add `HitConfirmSystem`.
- Add static hurtboxes for player/enemy.
- Add hitbox creation for:
  - player normal attack
  - player QTE damage transitions
  - enemy attacks
  - defense counter damage
- Keep existing QTE branch math and resources intact.
- Convert `applyDamage()` calls behind player/enemy attacks to go through hit confirm.
- Keep status/resource side effects that are explicitly pre-impact safe, but gate damage and impact feedback on confirmed overlap.

Phase 2 implementation scope:

- Implement authored trail/capsule hitboxes from current weapon, visual event, chain family, and enemy attack id.
- Record startup/active/recovery windows per hit so debug output can show the timing contract.
- Pass impact direction/force/distance into actor reactions so hit-confirmed damage creates readable knockback.
- Add a short-lived renderer overlay for confirmed/missed trails and the relevant hurtbox.
- Keep chain/enemy data compatible with the existing schema; explicit per-node `hitbox` metadata can still be added later where authored exceptions are needed.

Phase 3 implementation scope:

- Add whiff branches where useful.
- Add multi-hit token groups for Dual Blades and damage-over-time pulses.
- Let armor/shield systems read hit location or hit type.
- Add optional per-node hitbox overrides for attacks whose visual arc should differ from the derived profile.

Debug requirements:

- QTE debug drawer should show:
  - active hurtboxes
  - active hitboxes
  - hit token
  - source/target
  - overlap yes/no
  - confirmed damage
- Optional renderer overlay should draw:
  - hurtboxes in blue/red translucent outlines
  - active hitboxes in yellow/purple
  - last confirmed hit as a short flash

Acceptance criteria:

- A normal player attack applies damage only after a player hitbox overlaps the enemy hurtbox.
- A player QTE damaging transition applies damage only through hit confirm.
- An enemy attack applies player damage only through hit confirm unless canceled by dodge/parry/guard/absorb.
- A hit token cannot damage the same actor twice unless explicitly marked multi-hit.
- Existing tests still pass:

```powershell
node scripts\verify.js
```

- Add new flow smoke coverage for:
  - player hit confirms
  - enemy hit confirms
  - guarded/absorbed hit canceling damage
  - no double damage from one token

## 6. Controls

### Global

- `ESC`: back/menu
- `H`: help
- `L`: log
- `M`: demo manual/auto toggle

### Combat

- `1-8`: select combat style
- `A/S/D`: weapon or spell chains
- `SPACE`: dodge/parry where allowed
- `F`: guard

### Demo

- `1-5`: choose category
- number keys: choose demo item
- `A` / left arrow: previous page
- `D` / right arrow: next page
- `W`: cycle style
- `6`: cycle difficulty

## 7. Handfeel Spec

### Timing Defaults

The current runner supports configurable handfeel:

- `windowPad`: `0.08`
- `holdWindowPad`: `0.10`
- `perfectTolerance`: `0.07`
- `rhythmPad`: `0.07`
- `timeoutGrace`: `0.22`

These values should remain globally tunable and later exposed in a debug panel.

### Difficulty Timing Policy

- Difficulty must not make chains feel slow by multiplying node duration aggressively.
- Easy and Normal should mainly widen timing windows and enemy response windows.
- Hard and Extreme may compress QTE duration slightly, but must keep first inputs readable.
- Timing windows should scale around the Perfect point or window center, not shift later in the node.
- Hold-release Perfect timing should stay within readable charge windows instead of waiting through long empty bar time.

Current difficulty timing targets are enforced by:

```powershell
node scripts\check-timing.js
```

### Press Nodes

- Press nodes should feel precise but not brittle.
- Near-window inputs should resolve predictably.
- Perfect should require intentional timing and should not be automatic on every success.

### Hold-Release Nodes

- Charge state must be visually readable.
- Release timing should map clearly:
  - before window: early branch
  - inside window: success
  - near perfect marker: perfect
  - after window: late or overcharge branch
- Overcharge should be useful for risk/reward, not only punishment.

### Rhythm Nodes

- Beats should be visible before the hit moment.
- Wrong keys should count as misses but should not skip the current beat immediately.
- Perfect rhythm should require all beats; success can allow partial hits.

### Enemy Response

- Enemy windup should show a clear pre-response phase.
- Green response window must appear before input is expected.
- Hit moment should have strong but brief freeze/impact.

### Feedback Durations

- Perfect hit-stop: short, readable, does not block next chain input.
- Success feedback: lighter hit-stop and combo pulse.
- Failure feedback: explain early, late, wrong, timeout, or chain break.

## 8. Combat State Spec

### Player State

Required fields:

- `currentState`: `idle`, `swordAttack`, `casting`, `charge`, `shield`
- `spellEnergy`
- `maxSpellEnergy`
- `absorbReady`
- `shieldEnchanted`
- `consecutiveDodges`
- `lastAttackTime`

Future fields:

- `heat`
- `overloadTimer`
- `activeStatuses`
- `followWindow`
- `lastChainFamily`

### Enemy State

Required fields:

- HP
- active attack
- attack phase
- stun timer
- active statuses

Future fields:

- armor
- poise
- shield
- elemental weakness/resistance
- current archetype

### Resource Rules

#### Spell Energy

- Absorb chains and spell absorption generate spell energy.
- Staff + Absorb can exceed normal max up to overflow cap.
- Overcap should create visible instability and optional HP drain.
- Future overflow spenders should convert excess energy into high-risk burst attacks.

#### Heat

Fire should eventually gain a heat loop:

- Fire hits add heat.
- Heat increases fire impact and burn chance.
- High heat increases recovery or overheat risk.
- Overheat branch can become a strong but dangerous payoff.

## 9. Status System Spec

Statuses should become first-class data instead of ad hoc flags.

### Status Shape

```js
{
  id: "burn",
  target: "enemy",
  stacks: 1,
  duration: 2,
  source: "fireball_evolution_v2",
  data: {}
}
```

### Required Statuses

- `burn`
  - Target: enemy
  - Effect: damage over time or next fire impact bonus
  - Visual: ember ticks and orange outline
- `armorBreak`
  - Target: enemy
  - Effect: increased incoming damage
  - Visual: red crack marks
- `absorbReady`
  - Target: player
  - Effect: next incoming spell can be absorbed/reflected
  - Visual: purple glyph near player
- `shieldEnchant`
  - Target: player
  - Effect: guard/parry reflects spell damage
  - Visual: shield rune flash
- `overload`
  - Target: player
  - Effect: overcap spell energy instability and HP drain
  - Visual: purple warning pulse
- `stun`
  - Target: enemy or player
  - Effect: skip or delay action
  - Visual: white/yellow stars or broken posture mark

### Status Application Timing

- Apply status effects after QTE chain completion unless a node explicitly marks `immediate: true`.
- Tick enemy statuses at enemy turn start.
- Tick player statuses at player turn start.
- Visual events should fire both on application and on tick.

## 10. Chain Data Spec

### Chain Shape

```js
{
  key: "A",
  name: "火球术·三段进化",
  description: "Readable player-facing summary.",
  color: "#e74c3c",
  family: "fire",
  role: "fusion",
  visual: "emberProjectile",
  tags: ["fire", "charge", "projectile"],
  nodes: []
}
```

### Node Shape

```js
{
  id: "charge",
  name: "聚焰蓄热",
  duration: 1.8,
  input: { type: "hold_release", key: "A" },
  window: { start: 0.70, end: 1.55 },
  perfect: 1.18,
  onPerfect: {},
  onSuccess: {},
  onEarly: {},
  onLate: {},
  onFail: {}
}
```

### Transition Shape

```js
{
  next: "release",
  effect: "fire_charge_perfect",
  damage: 0,
  chargeMul: 1.55,
  selfStun: 0,
  stunEnemy: 0,
  iframe: 0,
  damageMul: 1,
  staminaCost: 0,
  resource: { spellEnergy: 18 },
  status: { target: "enemy", type: "burn", turns: 2 },
  visualEvent: "fireChargePeak",
  absorbReady: true,
  openPlayerTurn: false,
  followWindow: "fire_finisher",
  message: "聚焰临界"
}
```

### Metadata Requirements

Every chain must include:

- `key`
- `name`
- `description`
- `color`
- `family`
- `role`
- `visual`
- `tags`
- non-empty `nodes`

Every node must include:

- unique `id`
- `name`
- positive `duration`
- valid `input`
- at least one transition

Every transition with `next` must point to an existing node in the same chain.

## 11. Weapon Chain Spec

### Common Roles

- `A`: reliable opener
- `S`: signature challenge
- `D`: control, utility, or risky payoff

Every weapon should have:

- one short chain
- one technical chain
- one payoff/control chain
- at least one fail-forward branch
- at least one Perfect branch that changes behavior, not just damage

### Greatsword

Identity:

- commitment
- stance
- heavy payoff
- armor break

Current V2 chains:

- `greatsword_a_v2`
  - raise -> cut -> optional cleave
  - Perfect raise opens stronger cleave
  - fail becomes weak but usable cut
- `greatsword_s_v2`
  - staged charge
  - early: low damage
  - success: heavy slash
  - perfect: ground shock
  - late: overcharge self-stun, partial impact
- `greatsword_d_v2`
  - guard-break/control
  - Perfect opens extra player turn
  - success stuns and applies short armor break

Visual language:

- wide arcs
- red weight trails
- ground shock lines
- chunkier hit sparks
- heavier camera punch on Perfect

### Dual Blades

Identity:

- speed
- rhythm
- branching combo
- sustained pressure

Current V2 chains:

- `dualblades_a_v2`
  - multi-key combo
  - Perfect streak unlocks alternate finisher
  - failures fallback to short cut instead of full stop
- `dualblades_s_v2`
  - precision thrust
  - narrow Perfect payoff
  - strong crit branch
- `dualblades_d_v2`
  - spin/rhythm hybrid
  - builds combo count
  - Perfect grants dodge-cancel-style iframe pressure

Visual language:

- afterimages
- thin repeated slashes
- green combo streaks
- lower screen shake
- fast hit sparks

### Staff

Identity:

- preparation
- glyphs
- rhythm casting
- projectile release
- status control

Current chains:

- `staff_a`
- `staff_s`
- `staff_d`
- `fireball_evolution_v2`
- `absorb_siphon`

Planned chains:

- `staff_s_v2`
  - stronger rhythm chant with visible glyph steps
  - branches based on hit count
- `staff_d_v2`
  - status/control spell with enemy-turn manipulation
  - low damage, stronger stun or slow

Visual language:

- glyph rings
- mana threads
- projectile travel
- elemental impact bloom
- less physical shake than weapons

## 12. Spell Chain Spec

### Common Spell Requirements

Every spell should provide:

- one active chain alteration
- one defensive reaction
- one resource or state loop
- demo entries for active, defensive, and resource behavior

### Fire: `fire`

Identity:

- heat
- burn
- charge
- armor cracks
- explosive payoff

Current:

- Active chain: `fireball_evolution_v2` replaces staff `A`.
- Sword interaction: sword hits can build toward armor break.
- `flame_blade`
  - replaces sword `A` for Fire weapon styles.
  - adds heat, burn, and armor break.
- `shield_flare`
  - replaces guard defense for Fire styles.
  - creates a shield flame counter.
- `heat` resource loop
  - Fire hits add heat.
  - heat increases Fire chain damage.
  - high heat applies overload warning.
- Composite style: `flameforge`.

### Absorb: `absorb`

Identity:

- spell reversal
- siphon
- stored energy
- reflect
- overload

Current:

- Active chain: `absorb_siphon` replaces staff `S`.
- Sword interaction: sword attack can prepare `absorbReady`.
- Resource loop: spell energy can overflow.
- `mirror_guard`
  - replaces guard/parry defense for Absorb styles.
  - stores or reflects spell damage.
- `overflow_burst`
  - consumes spell energy for high damage.
  - includes emergency vent fallback.
- Composite style: `mirrorblade`.

### Future Spell Candidates

These are not committed for the next pass, but they fit the system:

- Frost
  - slow, bind, turn delay, brittle shatter.
- Lightning
  - narrow Perfect, chain jumps, interrupt windows.
- Blood
  - HP conversion, lifesteal, risk/reward.
- Stone
  - armor, guard stability, heavy stagger.
- Wind
  - dodge-cancel, reposition, extra action speed.

## 13. Combat Art Spec

Combat arts should be rule modifiers, not just stat buffs.

### Existing Directions

- Desslo
  - attack-anytime
  - Perfect crit
  - dodge during casting
- Eastern
  - guard/dodge flexibility
  - consecutive dodge crit
  - post-attack guard neutralize
- Desolo
  - follow-up attack
  - interrupt on follow-up
  - casting can carry parry/absorb behavior

### Future Requirements

- Combat arts should declare:
  - passive flags
  - follow-up chains
  - reaction permissions
  - demo explanation entries
- Validator should verify follow-up chain references.
- Demo should label combat-art exceptions clearly.

## 14. Enemy Spec

Enemy design should force the player to value different chains.

### Current State

The battle setup now picks a named encounter from the selected style unless the player explicitly chooses a specific encounter or legacy enemy archetype test from the main menu. Encounters wrap an enemy archetype with terrain text, a fixed or curated attack pattern, opening resource modifiers, and rule modifiers that make weapon/spell decisions matter inside the matchup.

### Enemy Archetypes

- Caster
  - frequent `spellCast`
  - makes Absorb valuable
  - has slow but high-threat magic windup
- Armored
  - higher HP and heavy pressure
  - rewards Greatsword and Fire armor break
  - has heavy guard-break attacks
- Swift
  - short windups
  - rewards Dual Blades, dodge, and fast openers
  - lower HP, higher pressure
- Shielded
  - mixes shield pressure and projectile pressure
  - rewards control chains, parry, and status
- Berserker
  - not implemented yet
  - predictable but high damage
  - rewards stun, guard, and interrupt timing

### Named Encounters

Implemented encounter data lives in `EncounterDatabase.encounters`.

- `ember_bulwark`
  - armored enemy with higher HP and a shield/heavy-smash pattern
  - starts Fire builds with heat
  - rewards Fire, armor break, and Greatsword pressure
- `arcane_conduit`
  - caster enemy with repeated spell pressure
  - starts Absorb builds with spell energy
  - rewards Absorb, reflection, and overflow routing
- `knife_rain`
  - swift enemy with short windups and repeated quick stabs
  - rewards weapon-chain tempo, dodge, parry, and fast openers
- `shield_rite`
  - shielded enemy that mixes shield bash and arcane attacks
  - rewards hybrid Fire/Absorb defensive decisions

Encounter modifiers may adjust:

- enemy max HP
- enemy attack pattern
- enemy damage and windup
- enemy response-window duration
- opening heat or spell energy
- Fire, Absorb, sword-chain, normal-attack, and armor-break damage multipliers
- Absorb energy and reflection multipliers

### Enemy Attack Data

Enemy attacks should expose:

- `id`
- `name`
- `damage`
- `windup`
- `hitTime`
- `allowedResponses`
- `type`: physical, spell, heavy, projectile
- `visual`
- `status`
- `followUp`

## 15. Visual Spec

### Composition

- Top 52px belongs to DOM HUD.
- Bottom 90px belongs to QTE/action bars and compact hints.
- QTE bar is primary during QTE.
- Key prompt is secondary during QTE.
- Demo mode uses a darker stage and lower background contrast.

### Effect Families

- Slash
  - weapon arcs, sparks, hit trails
- Projectile
  - travel line, charge core, impact bloom
- Glyph
  - rings, sigils, rhythm pulses
- Shield
  - radial guard flash, metallic sparks
- Status
  - burn ticks, armor cracks, stun marks
- Resource
  - spell energy pulse, overload warning

### Effect Event Shape

```js
{
  type: "projectile",
  preset: "emberProjectile",
  source: "player",
  target: "enemy",
  anchor: "enemyChest",
  intensity: 1.5,
  outcome: "perfect",
  color: "#e74c3c",
  duration: 0.45
}
```

### Required Effect Queue Behavior

- Combat and demo call `emitEffect`.
- The effect queue resolves named anchors.
- Renderer draws effects from queue state.
- Particle spawning is capped per effect type.
- Pure draw functions never emit new particles.

### Named Anchors

- `playerCore`
- `playerHand`
- `playerShield`
- `enemyCore`
- `enemyChest`
- `midpoint`
- `qteBar`
- `hudEnergy`

## 16. Demo Mode Spec

Demo mode is both a showcase and a debugging tool.

### Categories

- Style chains
- Spells
- Combat arts
- Defense/counter

### Required Demo Features

- Showcase category
  - Fireball branch comparison
  - Absorb siphon into overflow burst
  - Flame blade armor-break/burn chain
  - Enemy-turn defense/counter readout
- Auto playback
- Manual playback
- Difficulty toggle
- Current style toggle
- Result panel
- Chain input flow
- Reference damage
- Status/resource results
- Console-error-free playback

### Planned Demo Features

- Timeline panel
  - nodes as steps
  - outcome per node
  - branch path
  - damage/resource/status per step
- Replay button
- Slow-motion slider
- Frame-step for QTE nodes
- Visual event list
- Data validation badge

## 17. Debug And Tuning Spec

### Handfeel Debug Panel

Should display:

- current node id
- timer
- expected input time
- window start/end
- perfect point
- last input time
- input delta
- resolved outcome
- current difficulty scale
- handfeel padding values

### Balance Debug Panel

Should display:

- total chain damage by outcome
- current combo multiplier
- active statuses
- resource gain/spend
- enemy stun/self-stun
- turn result prediction

### Data Debug Tools

Existing:

- `node scripts/validate-data.js`
- `node scripts/check-timing.js`

Future:

- `node scripts/print-chain.js fireball_evolution_v2`
- `node scripts/sim-chain.js absorb_siphon perfect`
- `node scripts/check-balance.js`

## 18. Data Validation Spec

The validator must check:

- chain metadata
- node ids
- duplicate node ids
- valid input types
- rhythm beats inside node duration
- valid windows
- transition numeric fields
- transition `next` references
- transition `resource` values
- registered transition `resource` ids
- transition `status` shape
- registered transition `status.type`
- transition `visualEvent`
- registered transition `visualEvent`
- chain `cost` resource ids
- weapon chain references
- spell chainMap references
- combat art follow-up references
- defense chain references
- enemy archetype attack references
- style weapon/spell/combat-art references
- style preferred enemy references

Future validator checks:

- damage ranges fit balance bands
- no unreachable nodes
- no accidental infinite loops unless explicitly allowed

## 19. Architecture And Refactor Plan

### Current Hotspots

- `js/battle.js`
  - combat rules, state, effects, QTE completion
- `js/demo-mode.js`
  - demo state, playback, demo effects, result panels
- `js/renderer.js`
  - stage, UI, demo drawing, QTE bars

### Target Modules

- `js/systems/effects.js`
  - effect queue
  - named anchors
  - event normalization
- `js/systems/statuses.js`
  - apply/tick/remove statuses
  - status visual hooks
- `js/systems/resources.js`
  - spell energy, heat, overload
- `js/systems/chain-effects.js`
  - convert QTE transition output into combat effects
- `js/render/qte-view.js`
  - shared QTE drawing
- `js/render/demo-view.js`
  - demo menu/list/timeline/result drawing
- `js/render/effect-renderers.js`
  - slash/projectile/glyph/shield/status rendering
- `js/data/statuses.js`
  - status definitions
- `js/data/effects.js`
  - effect preset definitions

### Refactor Rules

- Do not rewrite everything at once.
- Extract only around active change areas.
- Preserve current game behavior while moving code.
- Add validation before adding larger content sets.
- Keep data shape stable once demo entries depend on it.

## 20. Roadmap

### R0 - Foundation, Completed

- Layout cleanup.
- Handfeel padding.
- Fire charge update-side particles.
- Chain metadata.
- Data validator.
- Fire v2 and Absorb active slice.

### R1 - Systems Foundation, Completed

- Add effect event queue.
- Add status registry and status tick/apply flow.
- Add resource registry for spell energy and heat.
- Move visual event routing out of `battle.js` and `demo-mode.js`.
- Add debug panel for QTE timing.

Implemented files:

- `js/systems/effects.js`
- `js/systems/statuses.js`
- `js/systems/resources.js`
- `js/systems/qte-debug.js`

Remaining cleanup after R1:

- Move more one-off demo action effects into `EffectEventQueue`.
- Move the remaining raw particle helper calls into named event definitions.

### R2 - Weapon V2, Completed

- Implemented Greatsword v2 chains.
- Implemented Dual Blades v2 chains.
- Replaced default Greatsword and Dual Blades A/S/D mappings with V2 chains.
- Added weapon-specific visual events through `EffectEventQueue`.
- Connected `armorBreak` status to incoming damage calculation.
- Connected `openPlayerTurn` transition results to turn flow.
- Exposed V2 chains in style-chain demo through the active style mapping.
- Added validator check for registered status ids.

Implemented files:

- `js/data/chains.js`
- `js/data/weapons.js`
- `js/battle.js`
- `js/demo-mode.js`
- `js/systems/effects.js`
- `scripts/validate-data.js`

Remaining cleanup after R2:

- Run a balance pass after R3 and enemy archetypes.

### R3 - Spell V2, Completed

- Added Fire heat loop.
- Added `flame_blade`.
- Added `shield_flare`.
- Added `mirror_guard`.
- Added `overflow_burst`.
- Added overload warning and vent behavior.
- Added composite Fire/Absorb styles for battle access.
- Added demo entries for R3 spell chains and defensive reactions.

Implemented files:

- `js/data/chains.js`
- `js/data/spells.js`
- `js/data/styles.js`
- `js/data/effects.js`
- `js/systems/resources.js`
- `js/systems/chain-effects.js`
- `js/battle.js`
- `js/demo-mode.js`
- `js/renderer.js`
- `scripts/validate-data.js`

Remaining cleanup after R3:

- Tune heat gain, heat damage bonus, and overflow costs.
- Add balance script output for all chain outcomes.
- Improve visual renderer fidelity for fire/glyph/shield events.

### R4 - Enemy Archetypes, Initial Pass Completed

- Added caster enemy.
- Added armored enemy.
- Added swift enemy.
- Added shielded enemy.
- Added style-driven enemy selection in battle setup.

Remaining cleanup after R4:

- Add explicit enemy selection UI if manual matchup testing becomes necessary.
- Add berserker archetype.
- Add armor/shield mechanics beyond HP and attack-pool pressure.

### R5 - Demo And Tooling, Completed

- Added projected demo timeline rows for chain node, outcome, input, damage, resource, status, stun, iframe, extra-turn, and visual event data.
- Added actual QTE timeline rows that persist into the result preview after the runner is cleared.
- Added result-preview replay: press `R` to replay the current demo item, any other key returns to list.
- Added demo reset cleanup so replay/list transitions clear heat and stale timeline/result rows.
- Added non-demo empty state for the demo-detail drawer when entering menu or battle.
- Added `scripts/lib/load-data.js` for shared script-side data loading.
- Added `scripts/sim-chain.js` for Perfect/Success/Early/Late/Fail chain simulation.
- Added `scripts/check-balance.js` for advisory damage, stun, self-stun, resource, and status-duration outlier checks.
- Added `scripts/smoke-checklist.js` for static smoke coverage of script ordering, required chains, spell mappings, styles, and enemy archetypes.
- Current balance baseline: 28 chains, 140 simulated outcomes, no advisory warnings.

Remaining cleanup after R5:

- Add Playwright/browser-driven screenshot automation if this project later needs CI-grade visual regression checks.
- Tune thresholds in `scripts/check-balance.js` after more enemies, status DOT, and armor mechanics land.

### R6 - Polish

### R6-A - FX Renderers And Hit Feedback, Completed

- Added `EffectBurstSystem` for reusable event-driven burst primitives: ring, pulse, glyph, slash, beam, and shield.
- Added `ActorReactionSystem` for player/enemy hit, crit, guard, dodge, stagger, and cast reactions.
- Extended `EffectEventDefinitions` with reusable burst renderer data for Fire, Absorb, Greatsword, and Dual Blades events.
- Extended `EffectEventQueue` to emit burst and actor-reaction events from data definitions and transition outcomes.
- Added status burst feedback for burn, overload, absorb-ready/shield-enchant, and generic status applications.
- Added renderer support for reaction-driven actor offset, scale, flash, and ring overlays.

Remaining cleanup after R6-A:

- Add audio pass for hit confirmation, charge peaks, resource gain, and branch failure.
- Add mobile/touch layout polish.
- Add final balance pass after visuals and audio settle.

### R6-B - Actor Silhouettes And Node-Timed Motion, Completed

- Replaced circular player/enemy placeholders with composed canvas silhouettes: head, torso, limbs, weapon, shield, and casting focus.
- Added player pose variants for idle, sword attack, shield/guard, casting, and charge states.
- Added enemy archetype silhouettes for caster, armored, swift, shielded, and base enemies.
- Updated weapon trails to use QTE node progress when available instead of only looping on wall-clock time.
- Added distinct visual trails for greatsword weight and dual-blade flurries.
- Preserved actor reaction overlays from R6-A on top of the new silhouettes.

Remaining cleanup after R6-B:

- Add per-node pose tags if future chain nodes need exact bespoke animation poses.
- Add automated screenshot smoke once silhouette and audio pass settle.
- Add mobile/touch layout polish.

### R7 - Feedback And Showcase, Completed

- Added named audio cues for charge peaks, resource gain/spend, status application, burn, overload, enemy response windows, threat warnings, and showcase starts.
- Routed transition, resource, and status results into audio feedback for battle and demo flows.
- Added the `亮点演示` demo category with four staged entries:
  - Fireball Early/Success/Perfect branch comparison.
  - Absorb siphon into overload and overflow burst.
  - Flame blade heat, armor-break, and burn chain.
  - Enemy-turn warning, green window, and mirror-guard counter.
- Added stage captions and per-phase key prompts to action-sequence demos.
- Upgraded enemy attack bars with attack type, danger level, recommended keys, response-window countdown, and green-window pulse.
- Updated static and flow smoke coverage for Showcase, enemy readouts, and R7 audio methods.

### R8 - Visual Regression And Layout Polish, Completed

- Added `scripts/visual-smoke.js`, a dependency-free Chrome/Edge CDP screenshot smoke runner.
- Screenshot smoke now covers:
  - Main menu desktop.
  - Demo menu with Showcase visible.
  - Showcase Fire branch playback.
  - Showcase enemy readout playback.
  - Battle style `6` QTE entry.
  - Demo menu mobile landscape layout.
- The screenshot runner starts its own local server on a free port, captures PNG artifacts under `tmp/visual-smoke/<timestamp>/`, writes a manifest, checks canvas non-blankness, asserts key DOM readouts, and fails on browser errors.
- Added responsive game-container scaling so the 16:9 stage fits both desktop and mobile landscape viewports without clipping.
- Tightened small-screen demo and touch-control layout: compact top bar, drawers, overlay typography, tutorial card, numeric/action button rows, and demo detail drawer sizing.
- Updated static smoke coverage for screenshot automation, responsive scaling, mobile compact rules, and visual-smoke documentation.

Remaining cleanup after R8:

- Add CI integration for screenshot smoke if this project starts using hosted checks.

### R9 - Targeted Playtest Polish, Completed

- Added main-menu enemy matchup selection:
  - `自动匹配` keeps the style-driven preferred enemy.
  - Manual choices can force base, caster, armored, swift, or shielded enemy archetypes for battle and practice.
- Battle setup now carries an `enemyOverrideId`, logs whether the enemy is recommended or manual, and exposes `getEnemySelectionLabel()` for setup-screen confirmation.
- The style selection canvas now displays the current enemy matchup mode before the player commits to a battle style.
- Extended flow smoke to prove manual enemy override can force a non-default archetype without changing the selected style.
- Tuned synthesized placeholder audio mix:
  - Reduced master volume from `0.35` to `0.30`.
  - Lowered repeated impact, slash, guard, Perfect, Success, Fail, charge, enemy warning, response-window, overload, and Showcase peaks.
  - Kept resource gain/spend and response-window cues distinct but less fatiguing during repeated demo playback.
- Extended screenshot smoke to include battle style `7`, a demo result preview frame, and the `R` replay path returning into QTE playback.
- Updated static smoke coverage for enemy selection, R9 audio mix baseline, style `7` screenshots, and replay screenshots.

Remaining cleanup after R9:

- Add CI integration for screenshot smoke if this project starts using hosted checks.
- Add stronger audio tooling only if synthesized placeholders remain too limited after more playtests.

### R10 - Node Pose Specificity, Completed

- Added optional per-node `pose` data with `state` and `motion` fields.
- Added pose tags to the chains that were visually too generic:
  - `greatsword_s_v2`: draw, charge, cleave, earthsplit, overcharge.
  - `dualblades_a_v2`: dash, flurry, finisher, retreat.
  - `fireball_evolution_v2`: kindle, charge, release, spark, overheat.
  - `absorb_siphon`: sigil, siphon, release, leak.
  - `flame_blade`: ignite, cut, burst, ember.
  - `mirror_guard`: mirror shield.
  - `overflow_burst`: compress, burst, vent.
- Renderer now uses `getCurrentPose()` to prefer node pose tags while keeping old current-state inference as a fallback.
- Player silhouette now varies arm placement, weapon angle, stance offset, and trail shape by motion tag.
- QTE debug drawer now shows the active node pose as `state / motion`.
- Data validation now checks pose state and registered motion names.
- Static smoke coverage now verifies pose data, renderer support, and QTE debug pose output.

Remaining cleanup after R10:

- Add CI integration for screenshot smoke if this project starts using hosted checks.
- Add pose tags to lower-priority legacy chains only if playtesting shows they still read too generically.
- Consider a stronger animation layer only if Canvas 2D pose tags stop being enough.

### R11 - Delivery Hardening, Completed

- Added `scripts/verify.js` as the single local verification entry point.
- Local `verify` runs data validation, timing audit, strict balance audit, static smoke, flow smoke, JS syntax checks, and visual screenshot smoke by default.
- CI mode runs deterministic checks with `node scripts/verify.js --ci --skip-visual`.
- Added GitHub Actions workflow `.github/workflows/ci.yml` for `main` pushes, pull requests, and manual dispatch.
- Added `docs/manual-playtest-checklist.md` for handfeel, visual readability, demo direction, audio, and debug checks that automation cannot judge.
- Updated README verification instructions to prefer the one-command path.

Remaining cleanup after R11:

- Add hosted screenshot smoke only if CI browser availability is worth the runtime cost.
- Expand CI to artifact upload if screenshot smoke starts running on hosted checks.
- Add release/deploy protection only if main-branch pushes start needing manual gates.

### R12 - Handfeel And Demo Direction, Completed

- Added chain-family handfeel profiles through `Utils.getChainHandfeel()`:
  - Dual Blades stay tight and fast.
  - Greatsword keeps heavier hold-release forgiveness.
  - Staff rhythm chains get wider rhythm forgiveness.
  - Fire charge chains get earlier release windows.
  - Absorb and overflow chains get stronger hold/rhythm grace.
- Added `Utils.getDemoPacing()` so demo playback has per-chain time scale, node pause, and result freeze instead of one global slow-motion value.
- Battle, counter, follow-up, defense, and demo QTE runners now all receive chain-specific handfeel.
- Tuned slow-feeling core timings:
  - `staff_s` rhythm chant shortened from 2.0s to 1.6s with earlier beats.
  - `staff_d` chant shortened from 1.5s to 1.28s.
  - legacy `fireball_evolution` charge shortened from 1.6s to 1.25s.
  - `fireball_evolution_v2` charge shortened from 1.55s to 1.35s.
  - `greatsword_s_v2` hold shortened from 2.0s to 1.82s.
  - `absorb_siphon` rhythm shortened from 1.55s to 1.42s.
  - `overflow_burst` compression shortened from 0.65s to 0.58s.
- Added demo director focus lines for key weapon/spell/defense entries.
- Demo QTE playback now shows an on-canvas focus panel with current node and viewing priority.
- Demo result preview now shows a compact on-canvas summary: focus, result lines, and actual timeline rows.
- Demo inspector now exposes playback pacing and handfeel values.
- Flame Blade's armor-cut node now lightly amplifies the following burst, making the weapon-plus-fire chain read as a real combo.
- Battle now surfaces armor-break amplification with floating feedback and explicit weapon/spell synergy logs.
- Static smoke now protects R12 handfeel, demo focus, and timing changes.

Remaining cleanup after R12:

- Run a longer manual playtest pass on hard/extreme to decide whether tight Dual Blades windows need difficulty-specific relief.
- Decide whether the next animation step should remain pose-tag Canvas 2D or move toward a stronger animation layer.

### R16 - Active Attack Resolution, Completed

Goal: QTE completion should create an authored attack, not immediately settle combat. HP, enemy statuses, hit reactions, guard, dodge, absorb, and reflect are resolved only when the active attack reaches its impact frame or collision moment.

Implemented direction:

- Added `ActiveAttackSystem`.
  - Tracks active attacks through `startup`, `reaction`, `impact`, `recovery`, and `canceled`.
  - Supports melee, projectile, beam, and pulse profiles.
  - Opens defender reaction windows from the attack timeline.
  - Calls Battle only at impact or completion; QTE runner does not own hit timing.
- QTE completion now creates a `playerQTE` active attack.
  - QTE input decides branch, damage candidate, resources, statuses, and visual tags.
  - The active attack handles travel/active timing.
  - `resolvePlayerQTEImpact()` applies damage and enemy-facing effects only at impact.
- Enemy attacks now create `enemyAttack` active attacks.
  - The old `enemyAttackTimer` and `enemyAttackPhase` remain as UI-facing state.
  - They are synchronized from active attack progress.
  - The defense window opens close to the incoming impact.
- Defense QTEs now pause/cancel the incoming active attack.
  - Dodge/parry/guard still use the existing defense chain data.
  - Counter, shield flare, and mirror/reflect outputs create outgoing active attacks.
- Normal attacks also commit an active melee attack before damage.
- Renderer now draws active projectiles, beams, pulses, melee trails, and an active attack progress prompt.
- QTE debug now includes `活动攻击` lines.
- Active attack timelines freeze during hit-stop, so impact pause does not secretly advance projectiles or recovery.
- Enemy reaction windows are anchored near the real impact time (`windup + hitTime`) instead of the older windup marker.
- Active attacks emit their own reaction-window and impact visuals, so defense timing and hit moments are visible even before HP text appears.
- Smoke coverage now verifies:
  - QTE completion creates an active attack.
  - HP stays unchanged during travel.
  - HP changes only after impact.
  - Enemy active attacks reach a reaction phase before hit.
  - Enemy reaction windows stay close to impact.
  - Active attacks freeze during hit-stop.
  - Every current damaging QTE chain resolves to a valid active attack profile.

QTE chain extensibility contract:

- QTE chains remain data-driven.
- `QTEChainRunner` must only output:
  - result log
  - accumulated damage/resource/status candidates
  - branch outcome
  - `chainId`, `chainFamily`, `tags`, `visualEvent`, and optional `attackProfile`
- QTE runner must not know:
  - projectile travel
  - melee hit arcs
  - enemy reaction AI
  - collision details
  - final HP mutation
- New chains should be added by data first:
  - define nodes and transitions in `ChainDatabase`
  - provide `family`, `tags`, and `visualEvent`
  - optionally provide `attackProfile` only for unusual behavior
- `ActiveAttackSystem.resolveProfile()` maps chain metadata into:
  - `melee`
  - `projectile`
  - `beam`
  - `pulse`
- `HitConfirmSystem` remains the final collision and no-double-hit layer.

Design note:

- R15's delayed settlement prototype has been replaced and removed from runtime.
- The intended model is:

```text
QTE result -> active attack -> defender reaction -> hit confirm -> damage/status/turn flow
```

### R17 - Result Readability And Battle HUD Noise, Completed

Goal: keep the player focused on the current timing/action beat, and make demo result screens readable after the impact flash has done its job.

Implemented direction:

- Demo result preview no longer draws residual screen flash.
  - Impact flash stays on the hit moment.
  - The result-reading phase uses a stable dark overlay instead of inheriting the previous impact color.
- Demo result preview now uses a tighter summary panel and a dedicated replay hint lane.
  - `R` replay / return hint stays inside a readable bottom pill.
  - Long summary rows are clipped to the visible stage lane.
- Battle resource HUD is quieter during action-focused states.
  - QTE, active attack, and enemy-turn states hide the equipped spell/art list.
  - Fire styles no longer show an empty spell-energy meter unless Absorb is equipped or energy exists.
  - Resource bars are compact meters with darker backing so the player stage remains primary.
- Static and visual smoke now protect:
  - action-state HUD equipment suppression
  - demo result residual-flash suppression

### R18 - Encounter Phase And Pressure Tuning, Completed

Goal: named encounters should feel authored across the whole fight, and high-difficulty enemy pressure should be fast without becoming repeated unreadable spikes.

Implemented direction:

- Named encounters now support data-driven low-HP phases through `phases`.
  - Each phase can define `id`, `name`, `hpBelow`, `attackPattern`, rule lines, and optional modifiers.
  - `BattleSystem` selects the current phase from enemy HP ratio.
  - Entering a new encounter phase resets that phase's attack cursor, logs the transition, and shows a floating phase callout.
- All four named encounters now have a half-HP phase:
  - `熔炉守门人`: `熔心压迫`
  - `秘术回廊`: `过载法阵`
  - `雨巷迅刺`: `贴身追刺`
  - `折盾仪式`: `折盾誓约`
- `雨巷迅刺` no longer opens with two consecutive `quickStab` attacks.
  - Opening pattern changed from repeated quick stab pressure to quick stab -> slash -> quick stab -> thrust.
  - The encounter still feels fast, but gives the player a broader rhythm before the next quick stab.
  - Hard/Extreme quick-stab impact timing now stays above the strict pressure floor.
- Balance audit now prints the tightest hard/extreme encounter enemy timings.
- Strict balance now warns on:
  - hard enemy impact below `0.90s`
  - extreme enemy impact below `0.80s`
  - response windows below `0.48s`
  - consecutive hard/extreme fast-pressure attacks below `1.00s`
- Flow smoke now proves:
  - `雨巷迅刺` opening avoids double quick stab
  - half-HP phase activation happens
  - phase attack cursor resets into the new phase pattern

### R19 - Battle Result Summary, Completed

Goal: entering and finishing a battle should feel like a complete loop, not just a hard stop after the final hit.

Implemented direction:

- `BattleSystem.getBattleResultLines()` now exposes a compact result summary:
  - encounter name
  - reached phase
  - total damage dealt
  - QTE accuracy
  - Perfect count
  - max combo
  - hits taken
  - final player/enemy HP
- Game-over rendering now shows a `战斗摘要` panel under the win/loss result.
- Flow smoke protects phase and accuracy lines in the result summary.

### R20 - Enemy-Turn Counter Plan, Enemy Attack Chains, And Coverage Frames

Goal: support a single counter-focused combat plan where the meaningful decision often happens inside the enemy turn. The old public 1-8 style layer is currently removed from the playable surface.

Player-facing model:

- Enemy turns may contain an `attackChain`, not only one attack.
  - Example: `法术 -> 快刺 -> 快刺`.
  - Every node is still an authored active attack with windup, response window, impact, and hit confirm.
- Player counter actions are coverage frames, not instant HP settlement.
  - Attack during an incoming enemy attack can create a clash.
  - Shield/guard can cover the currently targeted node.
  - Dodge can clear or iframe a node while preserving charge when the style allows it.
  - Attack during an incoming enemy spell interrupts casting; it does not enter a style-specific counterspell QTE chain.
- Own-turn compression is part of the current plan.
  - The current plan has a shorter player action bar.
  - If the player does nothing, automatic attack happens with no style bonus.
  - If the player manually starts a weapon QTE chain on own turn, the plan can grant its manual-QTE crit bonus.

Weapon distinction:

- Single heavy sword coverage target:
  - `coverageCount = 1`.
  - The player is expected to combine attack, shield, dodge, and parry across multiple enemy nodes.
- Dual blades coverage target:
  - `coverageCount = 2-3` depending on style data.
  - A well-timed attack can clash through rapid enemy follow-up hits because the weapon emits faster consecutive coverage frames.
  - Multi-node clash must be shown as consecutive melee hit segments, not as one remote-looking settlement.
- Staff coverage target:
  - `coverageCount = 1`.
  - Its enemy-turn advantage should come mainly from prepared casting, absorb, and counterspell chains.
  - The current pass does not expose staff/counterspell as a player-facing style package.

Combat art clarification:

- `001 · 德斯洛大陆剑术`
  - Enemy attack incoming: attack into it to clash, reduce/negate damage, and deal counter damage.
  - Own turn: manual weapon QTE can replace automatic attack and crit when the style enables that rule.
  - Enemy casting: attack can interrupt the cast.
- `008 · 东方诸国剑术`
  - Shield parry supports directional dodge.
  - Consecutive dodge enables crit.
  - After sword attack, guard within its short window neutralizes enemy attacks.
- `097 · 荒芜之地的剑术`
  - Attack anytime.
  - Follow-up attack can neutralize an enemy attack, crit, and interrupt.
  - While casting, parry/absorb remains available where the chain allows it.

Data contract:

```js
EnemyDatabase.attackChains = {
  spellDoubleCut: {
    nodes: [
      { id: "cast", attackId: "arcaneBolt", offset: 0 },
      { id: "firstCut", attackId: "quickStab", offset: 1.02 },
      { id: "secondCut", attackId: "quickStab", offset: 1.38 }
    ]
  }
}
```

- `attackPattern` entries may reference either `EnemyDatabase.attacks` or `EnemyDatabase.attackChains`.
- Chain node offsets are seconds from enemy-turn start.
- Runtime expands a chain into multiple active enemy attacks.
- The current incoming node is the earliest non-canceled enemy active attack by impact time.

Current acceptance criteria:

- Starting battle selects the single current plan and enters `逆势试炼`.
- The main menu does not expose 1-8 style selection.
- The demo entry is hidden/disabled for this pass and is not part of active verification.
- `逆势试炼` can start an enemy turn with a multi-node enemy attack chain.
- Pressing an attack key during the response window can clash and cancel only the covered enemy attack nodes.
- Dual blades can cover multiple rapid enemy nodes with consecutive hit segments; single heavy sword coverage remains one node by default.
- Pressing an attack key during opening spell pressure interrupts the spell without entering a counterspell QTE.
- Interrupt/clash completion creates an active attack; damage resolves at hit impact, not at keypress.
- Automatic attack on the compressed own turn does not receive the manual-QTE crit bonus.
- Data validation, flow smoke, and static smoke cover the current plan, encounter, attack-chain references, clash, and spell-interrupt flow.

### R50 - Counterflow Scope Correction, Superseded By R51

Goal: restore style `8` to the original counterflow plan instead of letting it behave like a composite of `咒还` and `德斯洛大陆剑术`.

Current status:

- Superseded by R51. The public style layer is removed for now, so style `8` is no longer a playable/menu concept.
- The previous `counterspell_reversal` style-chain direction is no longer part of the active combat plan.

Correct scope:

- Style `8 · 逆势双刃` uses `dualBlades` as its weapon.
- It does not grant the full `absorb` spell loadout.
- It does not grant the `desslo` combat art package.
- Own-turn `S` and `D` stay on the dual-blade base chains, not `absorb_siphon` or `overflow_burst`.
- Enemy-turn spell response is now an attack interrupt, not `counterspell_reversal`.
- Enemy-turn melee response uses `counterCoverage`, so dual blades can cover rapid follow-up nodes without needing generic attack-anytime rules.
- `逆势试炼` no longer grants opening spell energy or absorb multipliers; it tests timing, coverage, and the style-specific counterspell chain.

Acceptance criteria:

- Flow smoke asserts style `8` has no `spells` and no `combatArts`.
- Flow smoke asserts style `8` starts `dualblades_s_v2` on own-turn `S`.
- Static smoke asserts `逆势试炼` has no absorb resource or absorb damage modifiers.
- Existing enemy-turn clash and spell-interrupt active-attack flows still pass.

### R51 - Single Counter Plan And Demo Freeze, Completed

Goal: remove all public combat styles for now and keep only the current enemy-turn counter plan.

Implemented direction:

- `StyleDatabase` now contains only `current`, an internal default plan used to reuse the existing battle configuration path.
- The main menu no longer exposes the style dropdown or style cards.
- Starting battle/practice directly applies `current` and starts the enemy turn, so the first playable decision is a counter/defense response rather than a normal player opener.
- Demo entry is hidden and disabled. Demo code remains in the repository but is frozen and not updated for this pass.
- Touch controls no longer expose numeric style buttons.
- The current plan uses Dual Blades, no spells, no combat arts, no style-specific counterspell chain.
- Enemy-turn attack input now does two things:
  - melee incoming attack: clash/coverage counter
  - spell incoming attack: weapon interrupt, canceling covered enemy nodes without entering QTE
- Manual weapon QTE is no longer available from a free own-turn opener. It only appears inside the follow-up window created by a successful enemy-turn response; automatic attack remains no-bonus if the follow-up window times out.

Acceptance criteria:

- Static smoke asserts only `StyleDatabase.current` remains.
- Static smoke asserts the menu has no `style-select` or `style-choice-grid`.
- Static smoke asserts the demo button is hidden/disabled.
- Flow smoke asserts the default plan enters `counter_dojo`.
- Flow smoke asserts the default plan opens on enemy turn with the physical `bladeRushTriple` pressure chain.
- Flow smoke asserts the counter trial rotates `bladeRushTriple`, `spellDoubleCut`, `shieldSpellRush`, `knifeFlurry`, `feintCrush`, and `curseNeedle` instead of relying on a single enemy pattern.
- The asset cache key is bumped to `r53a` so browser refreshes pick up the follow-up turn gating and expanded enemy pressure data.
- Flow smoke asserts a normal recovery/player turn blocks manual weapon QTE and that successful counter/interrupt responses open `followup_turn`.
- Flow smoke asserts enemy spell pressure is interrupted by weapon attack and does not start `counterspell_reversal`.
- Flow smoke asserts enemy multi-node pressure can be canceled by attack coverage and still resolves damage at active-attack impact.
- `node scripts\verify.js --skip-visual` passes; visual smoke remains frozen until the demo/browser coverage is re-scoped.

### R15 - Delayed Settlement Prototype, Superseded By R16

Goal: prove that QTE input completion should not immediately settle combat. The player needs a visible attack, guard, or cast follow-through before HP, resources, statuses, and turn flow resolve.

What it proved:

- Final QTE input should only finish command entry.
- HP, status, and resource effects should wait until the authored hit moment.
- Greatsword/earth/armor hits need a longer follow-through than Dual Blades.
- Staff, fire, and absorb chains need a clearer cast/release beat.
- Turn flow should not advance while the authored action is still visually unresolved.

Current status:

- The old timer-only settlement phase has been removed from runtime.
- R16 `ActiveAttackSystem` is now authoritative for travel, reaction windows, impact, and recovery.
- `HitConfirmSystem` remains the layer that converts an authored hit into HP damage.
- Smoke coverage now protects that QTE completion creates an active attack and that HP does not change until impact.

Design note:

- The rule is not “slow all turns down.” It is “input completes, action breathes, then combat resolves.”
- Keep the authored attack timing short enough that controls still feel responsive: target range `0.28s - 0.68s` for most non-boss player follow-throughs.
- Avoid applying damage at final keypress time unless a future node explicitly opts into an immediate-hit rule.

### R14 - Accessible QTE Timing, Completed

Goal: make QTE chains approachable for ordinary players without solving difficulty only by widening judgment ranges.

Implemented direction:

- Added `Utils.getBattleQTEPacing()` for real battle QTE playback.
  - It slows the runner timer and adds short post-node pauses.
  - It does not increase `windowPad`, `holdWindowPad`, `rhythmPad`, or Perfect tolerance.
- Battle QTE runners now apply battle pacing for:
  - player attack chains
  - counter chains
  - follow-up chains
  - defense chains
- QTE debug now shows `实战节奏` so playtesters can distinguish timer pacing from judgment width.
- Reduced input density on the hardest rhythm chain:
  - `staff_s` chant is now 3 beats instead of 4 beats.
  - beat spacing is wider and easier to read.
- Shortened long-feeling charge nodes:
  - legacy `fireball_evolution` charge peak arrives earlier.
  - `fireball_evolution_v2` charge peak arrives earlier.
  - total charge duration is shorter, so staff/fire charge feels less like waiting.
- Static and flow smoke now protect battle QTE pacing.

Design note:

- For accessibility, prefer:
  - slower runner time scale
  - more readable node pauses
  - fewer rhythm beats
  - earlier charge peaks
- Avoid defaulting to:
  - wider global judgment windows
  - larger Perfect tolerances
  - larger rhythm tolerance pads

### R13 - Encounter Depth, First Pass Completed

- Added `EncounterDatabase` with four named encounters:
  - `ember_bulwark` for armored Fire/Greatsword pressure.
  - `arcane_conduit` for Absorb, reflection, and overflow routing.
  - `knife_rain` for fast Dual Blades, dodge, and parry pressure.
  - `shield_rite` for mixed shield and spell defense pressure.
- Main menu encounter selection now supports:
  - automatic style-recommended encounters
  - explicit named encounter selection
  - legacy enemy archetype testing
- Each style now declares a `preferredEncounter`, so selecting a style gives a more authored matchup than a raw enemy archetype.
- Battle setup applies encounter max HP, opening heat/spell energy, terrain/rule logs, and QTE debug encounter lines.
- Enemy turns use encounter attack patterns before falling back to random archetype attacks.
- Encounter modifiers can tune enemy damage, windup, response window, Fire damage, Absorb damage, sword-chain damage, normal attack damage, armor-break damage, Absorb energy, and reflection damage.
- Absorb now treats interruptible arcane/curse attacks as spell attacks, not only the legacy `spellCast` id.
- Flow smoke now proves:
  - style `6` enters `ember_bulwark`
  - style `7` enters `arcane_conduit`
  - manual enemy testing still bypasses named encounters
  - explicit encounter override applies HP, starting resources, and attack pattern order
- Static smoke and data validation now protect encounter loading, references, style preferences, and debug surfacing.

Remaining cleanup after R13 first pass:

- Run hard/extreme manual playtests against all four encounters and tune outlier response windows.
- Add second-phase or threshold rules once HP-only victory starts feeling too flat.
- Decide whether armor/shield should gain explicit armor stats instead of only status and encounter multipliers.
- Decide whether the next animation step should remain pose-tag Canvas 2D or move toward a stronger animation layer.

## 21. Acceptance Criteria

### General

- Main menu opens without battle HUD bleed.
- Battle, practice, and demo modes can be entered and exited.
- No console errors during normal smoke path.
- All JS files pass syntax check.
- Data validator passes.
- `node scripts/verify.js` provides a single local pre-push verification command.
- GitHub Actions runs the deterministic verification set on main pushes and pull requests.

### Handfeel

- Press, hold-release, and rhythm QTEs are readable.
- Perfect is achievable but not automatic.
- Early/late/fail feedback is visible.
- Demo playback does not feel stalled by excessive pauses.
- Staff and fire hold-release chains expose useful release windows before the bar feels full.
- Chain-specific handfeel values are visible in QTE debug/inspector output.

### Visual

- QTE bars are not clipped.
- Demo panels do not overlap key content.
- Effects are event-driven, not spawned from pure draw calls.
- Fire and Absorb have distinct visual identity.
- Major visual events use reusable burst primitives instead of one-off canvas code.
- Player and enemy react visibly to hit, crit, guard, dodge, stagger, and cast events.
- Player/enemy stage silhouettes communicate weapon, guard, cast, and enemy archetype without relying only on text.
- Key QTE nodes can specify pose tags so weapon and spell chains do not all share the same generic silhouette motion.
- Battle action states keep secondary loadout text out of the timing area.
- Demo result preview does not inherit residual impact screen flash.

### Combat

- Weapon chains resolve damage and branch outcomes.
- Fire v2 applies damage, branch feedback, and burn/status presentation.
- Absorb active chain grants spell energy and absorb-ready state.
- Defense QTEs still resolve dodge, parry, and guard.
- Style selection applies a preferred named encounter unless an explicit menu selection overrides it.
- Named encounters can alter enemy HP, attack order, response windows, opening resources, and matchup-specific weapon/spell rewards.
- Named encounters can change attack patterns at low HP.
- Manual enemy archetype testing remains available and does not silently apply named encounter rules.
- Game-over screen shows a battle result summary.

### Demo

- Fire v2 demo entries show branch path and result lines.
- Absorb active-chain demo entries show spell energy and absorb-ready result.
- Demo detail panel shows chain input flow, reference damage, projected timeline, actual timeline, and result summary.
- Demo result preview supports replaying the current item with `R`.
- Demo includes Showcase entries that play staged Fire, Absorb, Flame Blade, and enemy-turn examples without needing list paging.
- Demo QTE playback shows the current director focus on the main canvas.
- Demo result preview shows focus, result summary, and actual timeline without requiring the detail drawer.
- Demo result preview keeps the replay hint readable on the main canvas.
- Enemy-turn demos show attack type, danger level, recommended key, and window countdown in the detail panel and attack bar.
- Key combat events have distinct audio feedback.
- Main menu can force named encounters or raw enemy archetypes for matchup testing without changing style loadouts.
- Screenshot smoke covers main menu, Showcase, enemy readouts, battle style `6`, battle style `7`, result preview replay, and mobile landscape demo layout.
- Mobile landscape keeps the 16:9 game container inside the viewport without clipping the demo category controls.

### R21 - Visual Experience Pass: Stage, Models, And Readability

Goal: make the current Canvas 2D presentation read more like an authored battle scene without replacing the combat engine or requiring external art assets.

Scope:

- Battle stage:
  - Draw a perspective floor with encounter-colored lane light.
  - Use a subtle response-window floor pulse during enemy reactions.
  - Keep the stage full-screen and behind actors; it must not compete with QTE bars.
- Player model:
  - Draw weapon-dependent back gear, armor accents, headgear, and spell core.
  - Greatsword, dual blades, and staff should have visibly different silhouettes even while idle.
  - Fire and absorb spell loadouts should add a readable chest/core accent.
- Enemy models:
  - Enemy archetypes define a `model` data object.
  - Renderer should prefer `model.type` over icon-only branching.
  - Golem, caster, armored, swift, and shielded enemies should have distinct body shapes, gear, headgear, and accent layers.
- Combat UI:
  - Add compact actor nameplates near the combatants.
  - Nameplates show player style/weapon and enemy name/model or encounter phase.
  - Nameplates are canvas overlays and must not replace DOM HP bars or debug drawers.

Acceptance criteria:

- `EnemyDatabase` archetypes include `model` metadata.
- `CanvasRenderer` contains battle-stage, actor-ground-sigil, actor-nameplate, player-gear, enemy-model-accent, and enemy-headgear helpers.
- Static smoke protects the presence of these visual helpers and enemy model metadata.
- Visual smoke still passes on desktop and mobile screenshots.

### R21.1 - Menu Style Entry, Completed

Goal: make newly added combat styles visible from the first online screen, not only through the pre-battle canvas keyboard selector.

Implemented direction:

- Main menu now includes a `战斗风格` dropdown.
- The dropdown is synchronized from `StyleDatabase` at startup, with HTML options kept as a first-paint fallback.
- The default remains `进战斗后手动选择`, preserving the existing `1-8` canvas selection flow.
- Selecting a concrete style from the menu creates the battle, applies that style, and immediately enters the player turn.
- `023 · 逆势双刃 [8]` is explicitly listed in the menu and still maps to `逆势试炼` through style data.
- Resource query version was bumped so GitHub Pages clients pull the updated menu and startup script.

Acceptance criteria:

- Online menu visibly exposes `023 · 逆势双刃 [8]`.
- Starting battle or practice with that menu option enters style `counterflow` without needing to press `8`.
- Static smoke protects the style dropdown, the counterflow option, and the menu-start style application hook.

### R22 - Enemy Telegraph And Action Cinematics, Completed

Goal: enemy attacks should no longer read as the same generic remote swing. The visual layer must communicate the attack family before impact and make the enemy body posture match that family.

Implemented direction:

- `EnemyDatabase.attacks` now declares a `telegraph` object per attack:
  - `type`: player-facing attack family such as `stab`, `slash`, `smash`, `bolt`, `burst`, or `bash`
  - `shape`: warning geometry such as `line`, `arc`, `circle`, `cone`, or `glyph`
  - `pose`: enemy body posture such as `lunge`, `sweep`, `overhead`, `cast`, or `bash`
  - `width`: rough visual width/intensity for the warning and hit overlay
- `CanvasRenderer.getEnemyTelegraph()` provides a fallback mapper for older attack definitions.
- Enemy windup/response now draws type-specific warning shapes:
  - stab/bolt: narrow lane
  - slash: crescent arc near the player
  - smash/burst: circular ground marker
  - shield bash: cone pressure from enemy to player
  - spell cast: caster glyph plus path preview
- Enemy hit frames now draw type-specific impact shapes instead of one shared curve.
- Enemy silhouettes now receive a pose overlay, so casting, lunging, sweeping, overhead windup, and shield bash read from the model itself.
- Enemy readout labels use the same attack-family vocabulary as the telegraph.
- During active enemy attacks, the old central floating message is suppressed so it does not compete with the enemy attack bar and telegraph.

Acceptance criteria:

- Every enemy attack declares `telegraph.type`, `telegraph.shape`, `telegraph.pose`, and `telegraph.width`.
- Renderer contains `getEnemyTelegraph`, `drawEnemyTelegraphLane`, `drawEnemyTelegraphHit`, and `drawEnemyAttackPoseOverlay`.
- Static smoke protects the telegraph data contract and renderer helper surface.
- Static smoke protects suppression of duplicate enemy-attack floating messages.
- Visual smoke captures a dedicated `battle-enemy-telegraph` scenario and still passes on desktop and mobile screenshots.

### R23 - Player Active Attack Cinematics, Completed

Goal: player attacks should read differently after QTE completion, during the authored active-attack travel/impact window. Weapon chains and spell chains should not share one generic arc or beam.

Implemented direction:

- `CanvasRenderer.getPlayerActiveAttackDescriptor()` classifies active player attacks by chain family, weapon, visual event, motion, hit index, and element.
- Player active attack rendering now has specialized helpers for:
  - melee chains: `drawPlayerMeleeActiveAttack`
  - projectiles: `drawPlayerProjectileActiveAttack`
  - beam/spell chains: `drawPlayerSpellActiveAttack`
  - pulse/burst chains: `drawPlayerPulseActiveAttack`
- Dual blades now render paired crossing trails, afterimages, and hit-index variation for segmented hits.
- Greatsword and fire blade attacks now render heavier sweeping arcs, larger span, and flame tongues on fire chains.
- Absorb/counterspell style attacks now render caster sigils and braided beam lines instead of a flat generic beam.
- Generic enemy projectile/beam/pulse rendering remains available through `drawGeneric*ActiveAttack` helpers.
- Top HUD now labels `attack_active` as `攻击演出` instead of leaving the turn pill blank during authored hit travel.

Acceptance criteria:

- Renderer exposes player active attack descriptor and specialized player active attack helpers.
- Visual smoke captures `battle-player-active-attack` for fire/greatsword active attacks.
- Visual smoke captures `battle-player-spell-active` for absorb beam active attacks.
- Static smoke protects the helper surface and visual smoke coverage.
- Static smoke protects the `attack_active` top HUD label.

### R23b Main Menu Style Visibility, Completed

Problem found after online review: style `8` existed in data and the native dropdown, but the collapsed main-menu select only showed `进战斗后手动选择`, making the live entry look absent.

Changes:

- Main menu now renders visible style choice buttons from `StyleDatabase`.
- `[8] 逆势双刃` is visible on the first screen instead of hidden inside the native select.
- The existing `style-select` remains the state source, so start battle/practice still uses the same style application path.
- Static smoke protects `style-choice-grid`, the button sync logic, and the counterflow option.
- Visual smoke now asserts the `counterflow` style button is visible in the rendered desktop main menu.

### R24 Actor Status Auras, Completed

Goal: important combat states should attach to the actor models instead of only appearing as side icons or floating text.

Implemented direction:

- `CanvasRenderer.getActorStatusVisuals()` summarizes player/enemy status and resource state for drawing only.
- Player heat now creates fire rings and flame wisps around the model.
- Player spell energy now creates orbiting absorb/counterspell particles.
- `absorbReady`, `shieldEnchant`, and `overload` now add visible body/ward overlays to the player model.
- Enemy `burn`, `armorBreak`, and stun now draw directly on the enemy model with flames, crack overlays, and star-orbit stun cues.
- The old enemy stun text above the model is removed in favor of the model-attached cue, while the compact status icon list remains available.

Acceptance criteria:

- Renderer exposes actor status visual helper methods.
- Visual smoke forces heat, burn, armor break, stun, absorb, shield enchant, and overload states in screenshot scenarios.
- Static smoke protects the helper surface and screenshot coverage.

### R25 Encounter Stage Identity, Completed

Goal: named encounters should read as authored places, not only as text labels over the same generic floor.

Implemented direction:

- `CanvasRenderer.getEncounterStageTheme()` maps encounter ID/name/terrain to stage themes.
- `drawBattleStage()` now renders encounter-specific backdrop and floor details:
  - `ember_bulwark`: forge furnaces, molten glow, and floor heat cracks.
  - `arcane_conduit`: arcane pillars, rotating glyphs, and floor circles.
  - `knife_rain`: rain alley silhouettes, rain streaks, and puddles.
  - `shield_rite`: ritual hall arches, shield emblems, and floor rings.
  - `counter_dojo`: training posts, timing stripes, and crossed practice blades.
- The theme layer is render-only and does not alter combat rules.

Acceptance criteria:

- Renderer exposes encounter stage theme/backdrop/floor helper methods.
- Visual smoke verifies style `6` resolves to forge theme, style `7` to arcane theme, and style `8` to dojo theme.
- Static smoke protects the helper surface and visual-smoke coverage.

### R26 Cinematic Combat Focus, Completed

Goal: active attacks and enemy response windows should visually guide the player's eye without changing combat timing or QTE rules.

Implemented direction:

- Main-menu style cards show the style number, style name, and shortcut separately, so `008 · 东方诸国剑术` is visible in the same control the player actually clicks.
- `CanvasRenderer.getCinematicFocus()` derives a render-only focus target from active attacks, enemy response windows, or QTE state.
- `drawCinematicFocus()` adds subtle letterbox bars, attack-lane light, speed streaks, and focus reticles during key combat moments.
- Player active attacks focus along the player-to-enemy path and track the moving active attack position.
- Enemy response windows focus from enemy to player so defensive timing reads as incoming pressure.
- QTE running state gets a lower-intensity timing focus that does not compete with the QTE bar.

Acceptance criteria:

- Visual smoke verifies `008` and key-8 style entries are both visible in the main-menu style grid.
- Renderer exposes cinematic focus helper methods.
- Visual smoke verifies player active attacks produce `activeAttack` focus and enemy response windows produce `enemyResponse` focus.
- Static smoke protects helper coverage and visual-smoke assertions.

### R27 Actor Performance Layer, Completed

Goal: attacks should read through the character bodies, not only through external trails, bars, or floating effects.

Implemented direction:

- `CanvasRenderer.getActorPerformance()` converts actor reactions, active attacks, and enemy telegraph phases into render-only body-performance values.
- Player silhouettes now use active attack state for forward pressure, weapon reach, casting lift, guard bracing, hit squash, and motion afterimages.
- Enemy silhouettes now map telegraph poses (`lunge`, `sweep`, `overhead`, `cast`, `bash`) into body, arm, weapon, shield, and casting positions.
- The afterimage layer is actor-attached, so fast melee and enemy response windows read as body motion instead of disconnected lane effects.
- This layer does not change timing, hit confirm, damage, QTE windows, or enemy AI decisions.

Acceptance criteria:

- Renderer exposes actor performance and afterimage helpers.
- Visual smoke verifies player active attacks produce attack/reach/afterimage performance values.
- Visual smoke verifies enemy response windows produce telegraph-pose performance values.
- Static smoke protects helper coverage.

### R28 Model Identity Detail Pass, Completed

Goal: player loadouts and enemy archetypes should be readable from the bodies themselves, not only from labels, HP bars, or QTE text.

Implemented direction:

- `CanvasRenderer.getPlayerModelProfile()` resolves weapon, style color, spell tags, armor class, and gear from the active player config.
- `drawPlayerLoadoutDetails()` adds body-attached heavy armor, light gear, caster mantles, fire vents, absorb orbits, and staff glyph details.
- `CanvasRenderer.getEnemyModelProfile()` resolves enemy `model.type`, `build`, `gear`, and `armor` from enemy data instead of relying only on icons.
- Enemy model rendering now draws material and gear layers for stone, robe, plate, cloak, ward, hammer, focus, greatsword, dual blades, and shield identities.
- This is render-only and does not change enemy stats, encounter logic, QTE timing, hit confirm, or damage.

Acceptance criteria:

- Renderer exposes player/enemy model profile and detail helper methods.
- Visual smoke verifies Fire Greatsword player profile, armored enemy gear profile, and caster enemy gear profile.
- Static smoke protects model helper coverage.

### R29 Timing Readability HUD, Completed

Goal: QTE and enemy response timing should be readable as a focused timing surface instead of scattered floating labels.

Implemented direction:

- `CanvasRenderer.getQTEReadabilityMetrics()` derives current node, stage title, chain name, state, time remaining, window ratios, and Perfect position from the existing QTE runner.
- QTE bars now sit inside a subtle timing panel with state chips, node progress, judgement-window labels, remaining-time text, and the original chain/stage/hint hierarchy.
- Demo QTE bars reuse the same readability panel so demo and battle timing presentation stay consistent.
- `CanvasRenderer.getEnemyTimingMetrics()` derives enemy state, response-window ratio, time-to-window, and time-to-hit from the existing enemy active attack/timer.
- Enemy attack bars now use the same panel language with `预警中` / `窗口开启` / `命中` chips and clearer defense-window/impact labels.
- This pass is render-only and does not change QTE judgement windows, enemy timing, hit confirm, damage, or input handling.

Acceptance criteria:

- Renderer exposes QTE and enemy timing readability helpers.
- Visual smoke verifies QTE readability metrics are active during battle QTE.
- Visual smoke verifies enemy timing metrics are active during response windows.
- Static smoke protects helper coverage.

### R30 Style 8 Menu Clarity, Completed

Goal: the online first screen should make style `8` unambiguous, while still preserving lore numbers like `008`.

Implemented direction:

- Main-menu style cards now show the selection key as `风格 N` instead of the looser `按 N`.
- `023 · 逆势双刃` is explicitly marked as `风格 8` and gets a stronger card outline.
- `008 · 东方诸国剑术` keeps its lore number and is explicitly marked as `风格 4`, so `008` is no longer confused with the eighth selectable style.
- The hidden native select still remains the state source, so battle/practice startup behavior is unchanged.
- Native select labels also use `风格 N · 编号 · 名称`, so fallback/dropdown views expose the same style-key wording as the visible cards.

Acceptance criteria:

- Static smoke protects the split between style numbers and style keys.
- Visual smoke verifies `023 · 逆势双刃 / 风格 8` and `008 · 东方诸国剑术 / 风格 4` are both visible in the main-menu grid.
- Visual smoke also verifies the native style select labels include `风格 8 · 023 · 逆势双刃` and `风格 4 · 008 · 东方诸国剑术`.

### R31 Combat Contact Performance Layer, Completed

Goal: confirmed hits should read as contact on the body and floor, not only as hitbox debug shapes, floating numbers, or generic flashes.

Implemented direction:

- `CanvasRenderer.getCombatContactEvents()` converts active hit-confirm records into render-friendly contact events with target, direction, body point, floor point, force, radius, and contact kind.
- `drawCombatContactLayer()` renders those events as body-attached impact blooms, directional streaks, ground impulse ellipses, heavy-hit cracks, and whiff rings.
- The layer supports melee arcs, beams/spells, heavy hits, duplicate/miss records, and both player-to-enemy and enemy-to-player directions through the same hit-confirm data.
- The existing hitbox/hurtbox debug overlay remains available behind the QTE debug drawer instead of always drawing over the player-facing combat view.
- This pass is render-only and does not change collision, damage, hit timing, QTE windows, active attacks, or enemy AI.

Acceptance criteria:

- Renderer exposes combat contact event and drawing helpers.
- Visual smoke injects a confirmed hit record and verifies a combat contact event is active during the player active-attack screenshot.
- Static smoke protects helper coverage, the debug-gated hitbox overlay, and the visual-smoke assertion.

### R32 Enemy Rig Silhouette Pass, Completed

Goal: enemy archetypes should be readable from body shape and stance before the player looks at text labels.

Implemented direction:

- `CanvasRenderer.getEnemyRigProfile()` maps enemy model/build data into render rig values: silhouette family, scale, torso size, head radius, limb width, stance, and shadow scale.
- Enemy rendering now uses the rig profile for body proportions instead of relying only on inline type checks.
- `drawEnemyRigBackDetails()` adds silhouette-specific back layers:
  - caster: long ritual robe and arcane halo rings
  - armored: heavy shoulder plates and plate skirt
  - swift: low cloak tail and fast scarf sweep
  - shielded: broad ward silhouette behind the body
  - golem: offset stone shoulder and hip blocks
- Enemy shadows now scale with the rig profile so heavy and light archetypes read differently on the floor.
- This pass is render-only and does not change enemy stats, timing, hit confirm, QTE windows, or encounter logic.

Acceptance criteria:

- Renderer exposes enemy rig profile and back-detail helpers.
- Static smoke protects all five rig silhouette families.
- Visual smoke verifies armored and caster enemy rig profiles during existing battle screenshots.

### R33 Player Rig Silhouette Pass, Completed

Goal: player weapon styles should read from body proportions, stance, and back silhouette before the player looks at UI labels or weapon trails.

Implemented direction:

- `CanvasRenderer.getPlayerRigProfile()` maps player weapon/style data into render rig values: silhouette family, scale, torso size, head radius, limb width, stance, and shadow scale.
- Player rendering now uses the rig profile for shadow weight, body proportions, leg stance, limb width, and head size.
- `drawPlayerRigBackDetails()` adds style-readable back layers:
  - greatsword/heavy styles: `vanguard-plate` shoulder bulk, plate skirt, and fire vents when fire is equipped
  - normal dual-blade styles: `agile-duelist` sash motion and slim stance
  - style 8: `counter-duelist` wider footwork, counter arc, and crossed guard lines
  - staff/caster styles: `arcane-mantle` robe panels, halo, and glyph
- This pass is render-only and does not change player stats, QTE timing, hit confirm, damage, movement, or input handling.

Acceptance criteria:

- Renderer exposes player rig profile and back-detail helpers.
- Static smoke protects player rig silhouette families.
- Visual smoke verifies greatsword, dual-blade, and style 8 counter player rig profiles during existing battle screenshots.

### R34 Stage Camera Comfort Pass, Completed

Goal: hit impact should still have camera force, but HUD, QTE timing bars, and input prompts must remain readable during screen shake or camera zoom.

Implemented direction:

- `CanvasRenderer.getRenderCamera()` converts existing `screenShake` and `cameraZoom` state into a smooth render-only camera impulse with deterministic offsets.
- `applyWorldCamera()` now affects only the world scene: stage, actors, active attacks, hit-confirm overlays, contact impacts, burst effects, and cinematic focus.
- `drawWorldScene()` keeps the combat world as a single camera-controlled layer.
- HUD, QTE bars, enemy timing bars, big key prompts, floating messages, turn banners, combo UI, and demo overlays draw after the world camera is restored, so readability no longer degrades during impact.
- This pass does not change hit-stop, screen-shake timers, camera zoom timers, QTE windows, damage, collision, or input handling.

Acceptance criteria:

- Renderer exposes stage-only camera helpers.
- Static smoke protects the stable-UI camera helper surface.
- Visual smoke forces an impact camera impulse during a player active-attack screenshot and verifies the camera reports `uiStable`.

### R35 Actor Damage State Pass, Completed

Goal: player and enemy health state should be readable on the bodies themselves, not only through HP bars or floating numbers.

Implemented direction:

- `CanvasRenderer.getActorDamageVisuals()` derives render-only wound state from current HP/max HP, critical health, defeated state, and recent hit reactions.
- `drawActorDamageMarks()` adds model-attached scratches, cracks, low-health pulse rings, and defeated ground stains.
- Player and enemy damage marks draw after the base silhouette and before status overlays, so burn, stun, shield, and absorb effects can still sit above them.
- The effect is non-textual and persistent across frames, reducing reliance on floating damage feedback.
- This pass does not change HP values, damage, hit confirm, status rules, QTE timing, enemy AI, or input handling.

Acceptance criteria:

- Renderer exposes actor damage visual helpers.
- Static smoke protects the helper surface.
- Visual smoke forces wounded player and critical enemy states during an existing active-attack screenshot and verifies the derived damage visuals.

### R36 Encounter Phase Model Pass, Completed

Goal: named encounter phases should change the enemy's on-body presentation, not only the attack pattern, log, or result summary.

Implemented direction:

- `CanvasRenderer.getEncounterPhaseInfo()` resolves the current phase from `getCurrentEncounterPhase()` or the active phase id.
- `getEncounterPhaseLabel()` now feeds actor nameplates with the phase name, so the enemy label shows `熔心压迫` instead of an internal id such as `molten_core`.
- `getEnemyEncounterPhaseVisuals()` maps the active encounter phase into a render-only visual profile based on the encounter stage theme.
- `drawEnemyEncounterPhaseOverlay()` adds phase-specific enemy-model overlays:
  - forge: molten vent lines and heat ring
  - arcane: orbiting matrix rings and glyph
  - rain: rain-slice pressure lines and fast arc
  - rite: ward/shield sigil frame
  - dojo: counter-footwork arcs and stance lines
- This pass is render-only and does not change phase activation, HP thresholds, attack patterns, damage, QTE timing, hit confirm, or enemy AI.

Acceptance criteria:

- Renderer exposes encounter phase model helpers.
- Static smoke protects the helper surface.
- Visual smoke forces `熔心压迫` during an active-attack screenshot and verifies both the phase visual profile and phase nameplate label.

### R37 Active Attack Contact Guide Pass, Completed

Goal: active attacks should read as actor-to-target contact, not detached lane effects. Melee attacks in particular need a visible connection from the attacker's body/weapon hand to the target's hit zone.

Implemented direction:

- `CanvasRenderer.getActiveAttackContactGuide()` derives a render-only contact guide from each active attack, including source, target, phase, attack type, hand anchor, contact point, target bracket, radius, heavy/dual-hit context, and hit count.
- `drawActiveAttackContactGuide()` draws the guide before the attack-specific projectile, beam, pulse, or melee renderer so the existing spectacle stays on top.
- `drawActiveAttackTargetBracket()` adds a target-attached bracket and ground contact ellipse during reaction/impact phases.
- Player melee attacks now show a curved hand-to-contact line and target bracket, making greatsword/fire and dual-blade hits feel attached to the character body rather than like a remote slash.
- Projectile and beam attacks keep lighter source-to-contact lanes, so spells still show travel direction without becoming noisy.
- This pass is render-only and does not change damage, collision, active attack timing, hit confirm, QTE judgement, enemy AI, or turn flow.

Acceptance criteria:

- Renderer exposes active attack contact guide helpers.
- Static smoke protects the helper surface.
- Visual smoke verifies the existing fire/greatsword active attack produces a player-to-enemy melee contact guide anchored near the enemy body.

### R38 Player Defense Intent Pose Pass, Completed

Goal: enemy-turn defense should read from the player's body and immediate space, not only from the enemy timing bar or large key prompt.

Implemented direction:

- `CanvasRenderer.getPlayerDefenseIntentVisuals()` converts the current enemy attack, response phase, allowed responses, telegraph type, and player absorb/shield state into render-only defense cues.
- `drawPlayerDefenseIntentOverlay()` attaches those cues to the player model during enemy windup/response/hit phases.
- Dodge-allowed attacks draw green evasive footwork marks around the player.
- Parry-allowed attacks draw a forward parry arc and spark points.
- Guard-allowed attacks draw a shield plane in front of the player.
- Spell-like threats, absorb readiness, and shield enchant draw a mirror/glyph readiness layer.
- This pass is render-only and does not change defense input, response windows, hit confirm, damage, enemy timing, enemy AI, or turn flow.

Acceptance criteria:

- Renderer exposes player defense intent visual helpers.
- Static smoke protects the helper surface.
- Visual smoke verifies the `curseBurst` enemy response window produces active player defense intent visuals for parry, guard, and spell-like pressure.

### R39 Combat Phase Lighting Pass, Completed

Goal: current combat phase should read from the stage lighting, not only from the top turn pill, QTE bar, or key prompt.

Implemented direction:

- `CanvasRenderer.getCombatPhaseLighting()` derives a render-only lighting profile from turn state, active attacks, QTE progress, enemy response windows, style color, and enemy attack color.
- `drawCombatPhaseLighting()` draws low-noise ground glows, lane streaks, moving floor ticks, and response-window emphasis after the stage and before actors.
- Player turn highlights the player side and forward lane.
- QTE highlights the player and center timing lane without touching judgement windows.
- Active attacks use the active attack source, progress, color, and direction.
- Enemy response windows highlight both enemy pressure and the player's response space.
- This pass is render-only and does not change QTE timing, action bars, active attacks, hit confirm, damage, enemy AI, or UI layout.

Acceptance criteria:

- Renderer exposes combat phase lighting helpers.
- Static smoke protects the helper surface.
- Visual smoke verifies QTE phase lighting and enemy-response phase lighting through existing battle screenshots.

### R40 Actor Impact Reaction Pass, Completed

Goal: a confirmed hit should read from the struck character's body, not only from floating damage text, screen shake, or a detached impact effect.

Implemented direction:

- `CanvasRenderer.getActorImpactReactionVisuals()` derives a short-lived impact profile from the actor reaction, current performance squash, and incoming active-attack profile.
- `drawActorImpactReactionLayer()` attaches the impact flash, directional shard burst, critical break lines, and ground skid to the player or enemy model.
- The layer draws after the actor silhouette and before persistent damage/status overlays, so it reads as body contact without hiding UI or long-term status cues.
- Critical hits receive a stronger gold break line; ordinary hits stay lower noise.
- `ActorReactionSystem.get()` now exposes reaction direction and intensity to renderers as metadata.
- This pass is render-only and does not change QTE timing, active attack timing, hit confirm overlap, damage, AI, or input windows.

Acceptance criteria:

- Renderer exposes actor impact reaction helpers.
- Static smoke protects the helper surface.
- Visual smoke verifies a critical enemy impact reaction profile in an active-attack battle screenshot.

### R41 Enemy Chain Intent Pass, Completed

Goal: enemy multi-hit chains should read as a sequence of incoming attacks, not as a single current telegraph plus combat log text.

Implemented direction:

- `CanvasRenderer.getEnemyChainIntentVisuals()` derives a render-only chain profile from `enemyAttackChain` and staged enemy active attacks.
- `drawEnemyChainIntentLayer()` draws a low-text stage layer behind actors:
  - chain badge near the enemy side
  - one pip per incoming chain node
  - glowing current node
  - dim resolved/canceled nodes
  - faint route curves for pending attacks
- The layer helps rapid enemy chains such as `spellDoubleCut` and `knifeFlurry` show remaining pressure without adding another text panel.
- This pass is render-only and does not change enemy attack timing, response windows, active attack staging, hit confirm, damage, enemy AI, or input handling.

Acceptance criteria:

- Renderer exposes enemy chain intent helpers.
- Static smoke protects the helper surface.
- Visual smoke verifies `spellDoubleCut` produces a three-node chain intent layer with current/pending pressure and follow-up nodes.

### R42 Player QTE Chain Intent Pass, Completed

Goal: player QTE chains should read from the character-side stage picture, not only from the bottom timing bar and large key prompt.

Implemented direction:

- `CanvasRenderer.getPlayerQTEChainIntentVisuals()` derives a render-only profile from the active `qteRunner`, current node, result log, input type, branch metadata, and chain family.
- `drawPlayerQTEChainIntentLayer()` draws a low-text player-side node chain:
  - completed nodes show success/perfect/fail marks
  - current node pulses and has a progress ring
  - future nodes stay dim
  - branch-capable nodes show a small fork cue
  - weapon/spell chain badge sits near the player side
- The layer complements the precise QTE bar without adding a new timing panel.
- This pass is render-only and does not change QTE timing, judgement windows, chain branching, damage, active attacks, hit confirm, or input handling.

Acceptance criteria:

- Renderer exposes player QTE chain intent helpers.
- Static smoke protects the helper surface.
- Visual smoke verifies battle style `6` / `flame_blade` QTE exposes a multi-node player chain layer with current and future nodes.

### R43 Counterflow Showcase Direction Pass, Completed

Goal: style `8` should be visible in the demo experience as an authored combat sequence, not only as a menu option or a normal battle loadout.

Implemented direction:

- `DemoMode.getShowcaseItems()` now includes `Showcase · 逆势双刃三节点反击`.
- The sequence shows the intended style `8` fantasy in one readable playback:
  - enemy-turn pressure begins as spell -> quick stab -> follow-up stab
  - the player catches the spell while holding counterspell charge
  - the player dodges during that charge instead of splitting the action into another turn
  - dual blades produce two fast clash beats to cover and interrupt the remaining physical pressure
  - counterspell release resolves only after the return projectile hits
- `CanvasRenderer.drawDemoCounterflowTrack()` adds a compact two-lane demo panel:
  - upper lane: enemy attack nodes
  - lower lane: player response nodes
  - current node pulses
  - completed/future nodes stay visually distinct
  - route links show catch, slip, clash, follow-up, and return paths
- `EffectEventDefinitions` now includes counterflow-specific catch/slip/clash bursts so the showcase is not just text.
- This pass is presentation-only. It does not change battle timing, QTE judgement, counterflow data, active attack resolution, hit confirm, or damage rules.

Acceptance criteria:

- Demo showcase category includes a style `8` authored sequence.
- Renderer exposes the counterflow demo track helpers.
- Static smoke protects the new showcase, renderer helper, and effect events.
- Visual smoke opens demo showcase item `5` and verifies the counterflow track is active in-browser.

### R44 Resource Pulse Feedback Pass, Completed

Goal: resource gains and spends should be visible as immediate combat feedback, not only as static HUD number changes, logs, or floating text.

Style 8 online-entry hardening:

- The main menu now ships with static style-choice cards in `index.html`, including `风格 8 · 023 · 逆势双刃`.
- `main.js` still replaces/syncs those cards from `StyleDatabase` after scripts load, so data remains the source of truth.
- This protects the live first screen if a browser sees HTML before JS has finished initializing or has stale script cache.
- The asset cache key is bumped to `r44b`.

Implemented direction:

- `ResourceSystem` now records short-lived visual pulses whenever `spellEnergy` or `heat` changes.
- `CanvasRenderer.getResourcePulseVisuals()` reads those pulses and maps them to the current HUD resource lane.
- `drawResourcePulseLayer()` draws low-noise feedback:
  - a short curved trail between the player and the resource meter
  - a brief meter halo
  - a compact `+/- amount` tag near the meter
- Gain pulses move from the player model toward the HUD resource lane; spend pulses can travel the reverse direction.
- The pulse layer is UI-stable and does not follow stage camera shake, so resource feedback remains readable during impact frames.
- This pass does not alter resource totals, caps, cost checks, QTE results, damage, status, or timing.

Acceptance criteria:

- ResourceSystem exposes visual pulse records for resource changes.
- Renderer exposes resource pulse helpers.
- Static smoke protects the helper surface.
- Static smoke protects the static style `8` menu card.
- Visual smoke verifies heat and spell-energy pulse visuals in browser-rendered battle scenes.

### R45 Actor Footwork Weight Pass, Completed

Goal: player and enemy actions should read from the body and ground contact, not only from weapon trails, floating labels, or HUD state.

Implemented direction:

- `CanvasRenderer.getActorFootworkVisuals()` derives actor foot placement from:
  - attack / windup / brace / cast / hit squash
  - stride and action progress
  - player stance/motion or enemy pose intensity
  - rig stance and torso width
- `drawActorFootworkLayer()` draws low-layer ground-contact feedback:
  - two foot pressure pads
  - short front-foot drag echoes during lunges/dashes
  - a faint center-of-weight ellipse
  - a forward pressure stroke during committed actions
- The layer renders after shadow/sigil and before the actor model, so it supports animation readability without becoming HUD noise.
- Player and enemy calls use their existing rig/profile/performance data, so greatsword, dual-blade, counter, caster, armored, swift, and shielded silhouettes inherit different footing naturally.
- This pass is render-only. It does not change hitboxes, damage, QTE timing, AI, active attack travel, resources, or status behavior.
- The asset cache key is bumped to `r45a`.

Acceptance criteria:

- Renderer exposes actor footwork visual helpers.
- Static smoke protects the helper surface.
- Visual smoke verifies player and enemy footwork visuals inside existing battle screenshots.

### R46 Weapon Silhouette Material Pass, Completed

Goal: weapon identity should read from the weapon silhouette itself, not only from body stance, text labels, or large attack trails.

Implemented direction:

- `CanvasRenderer.getWeaponSilhouetteProfile()` now gives each weapon family explicit visual proportions:
  - greatsword: heavy blade, broad core, guard, grip, and tip geometry
  - dual blades: twin curved blades, thinner edges, paired tips, and small grips
  - staff: long focus staff, shaft highlight, band wraps, focus orb, and ring radius
- `drawWeaponSilhouette()` now renders material detail for all existing player/enemy weapon calls:
  - white edge highlights
  - darker grip cores
  - colored guard/band accents
  - staff focus ring
- `drawWeaponGrip()` centralizes grip rendering so blade weapons do not read as plain colored lines.
- This pass is render-only. It does not change active attack ranges, hitboxes, damage, QTE timing, animation timing, or enemy behavior.
- The asset cache key is bumped to `r46a`.

Acceptance criteria:

- Renderer exposes weapon silhouette profile/material helpers.
- Static smoke protects heavy blade, twin blade, and focus staff profiles.
- Visual smoke verifies the three profile families are distinct during browser-rendered battle checks.

### R47 Actor Intent Badge Pass, Completed

Goal: current combat intent should be readable from the actor model area itself, not only from the HUD, QTE bar, logs, or enemy attack text.

Implemented direction:

- `CanvasRenderer.getActorIntentBadgeVisuals()` derives a compact model-attached intent badge from:
  - active player/enemy attacks
  - enemy windup / response / hit windows
  - player defense response windows
  - player casting / charge / QTE states
  - short hit reactions
- `drawActorIntentBadgeLayer()` draws a small badge near the actor shoulder/head:
  - circular shell and progress arc
  - attack/cast rays
  - defense diamond
  - hit cross
  - a subtle connector line to keep the badge attached to the model
- Player and enemy calls are rendered after persistent model/status overlays and before the old reaction debug overlay, so they read as model-state hints rather than standalone HUD widgets.
- Main-menu style cards now use `风格 N` as the primary visual label and move lore numbers like `023` / `008` into secondary `编号 NNN` text.
- `风格 8 · 023 · 逆势双刃` is promoted into a full-row counter style card with `反制流派` text, so the online first screen no longer depends on players noticing a small shortcut label.
- This pass is render-only. It does not change QTE timing, input windows, active attack travel, hit confirm, AI, damage, resources, status duration, or layout.
- The asset cache key is bumped to `r47a`.

Acceptance criteria:

- Renderer exposes actor intent badge helper methods.
- Static smoke protects enemy-window and defense-window intent branches.
- Visual smoke verifies player attack, enemy response, and player defense badges in browser-rendered battle scenes.
- Visual smoke verifies the style 8 card has `风格 8` as its primary label and is inside the desktop first viewport.

### R48 Enemy Action Personality Pass, Completed

Goal: enemy type should remain readable while the enemy is attacking, casting, guarding, or bracing, instead of relying on the nameplate or QTE text.

Implemented direction:

- `CanvasRenderer.getEnemyActionPersonalityVisuals()` derives a render-only action personality layer from:
  - enemy model type
  - current enemy attack telegraph
  - enemy attack phase
  - actor performance values such as cast, brace, stride, and pose intensity
- `drawEnemyActionPersonalityLayer()` draws foreground model-following cues:
  - caster: orbiting ritual focus and tethered glyph
  - armored: heavy plate breaker arc and overhead weight cue
  - swift: knife-speed afterimages and slash lanes
  - shielded: forward ward plane and bash wedge
  - golem/base: stone breaker weight cracks and heavy swing cue
- The layer is drawn inside the enemy model transform after the generic attack-pose overlay, so it follows lean, squash, scale, and attack staging.
- This pass is render-only. It does not change enemy AI, attack timing, QTE windows, collision, damage, resources, or encounter selection.
- The asset cache key is bumped to `r48a`.

Acceptance criteria:

- Renderer exposes enemy action personality helper methods.
- Static smoke protects all five action personality kinds.
- Visual smoke verifies the live caster response layer and all five archetype personality branches.

### R49 Player Weapon Action Personality Pass, Completed

Goal: player weapon styles should remain readable from the player model during startup, release, and active-attack playback, not only from weapon trails or HUD labels.

Implemented direction:

- `CanvasRenderer.getPlayerWeaponActionVisuals()` derives a model-attached weapon action layer from:
  - current player weapon and style key
  - player motion tags
  - actor performance values
  - active attack descriptor data
  - fire / absorb / counter style flags
- `drawPlayerWeaponActionLayer()` draws foreground body-following cues:
  - greatsword: heavy blade pressure arc, ground cracks, and fire embers
  - dual blades: crossing lane arcs, blade afterimages, and counter guard cross
  - staff: focus sigil, orbiting motes, and cast tether line
- The layer is drawn inside the player model transform after arms and weapon silhouettes, so it follows lean, hit squash, actor scale, and current QTE motion.
- This pass is render-only. It does not change QTE timing, enemy AI, active attack travel, hit confirm, damage, resources, or input windows.
- The asset cache key is bumped to `r51a`.

Acceptance criteria:

- Renderer exposes player weapon action helper methods.
- Static smoke protects greatsword, dual-blade, counter-blade, and staff action kinds.
- Visual smoke verifies the live greatsword attack branch and synthetic dual-blade / staff branches.

## 22. Verification Commands

```powershell
node scripts\verify.js
```

CI / quick deterministic verification:

```powershell
node scripts\verify.js --skip-visual
```

Individual commands:

```powershell
node scripts\validate-data.js
node scripts\sim-chain.js flame_blade perfect
node scripts\sim-chain.js overflow_burst perfect
node scripts\check-timing.js
node scripts\check-balance.js
node scripts\smoke-checklist.js
node scripts\flow-smoke.js
node scripts\visual-smoke.js
Get-ChildItem -Path .\js,.\scripts -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
node --check .\server.js
node --check .\save_screenshot.js
```

Automated browser screenshot smoke:

- Run `node scripts\verify.js` for the full local gate, or:
- Run `node scripts\visual-smoke.js`.
- Confirm it reports `Visual smoke passed`.
- Inspect generated PNGs under `tmp/visual-smoke/<timestamp>/` if a visual change needs manual review.

Manual playtest checklist:

- Use `docs/manual-playtest-checklist.md` after timing, visual, audio, or demo changes.

Manual browser smoke test:

- Open `http://localhost:8765/`.
- Confirm main menu HUD is hidden.
- In the main menu, leave `遭遇` on auto for one run, then repeat once with a named encounter override.
- Enter demo mode.
- Open Showcase and run Fire branch comparison.
- Run enemy-turn Showcase and confirm type/danger/recommended key/countdown are visible.
- Run Counterflow Showcase and confirm the two-lane enemy/player node track is visible.
- Open spell demos.
- Run Fire v2 entry.
- Press `R` on the result preview and confirm the same Fire v2 entry replays.
- Run Absorb active-chain entry.
- Run `flow-smoke.js` to cover battle style `6`, battle style `7`, Fire v2 demo playback, spell-list paging, and `overflow_burst` end to end.
- Run `visual-smoke.js` to cover main menu, Showcase, enemy readout, battle style `6`, battle style `7`, result replay, and mobile landscape screenshots.
- Cycle demo style to Dual Blades and run a V2 weapon chain.
- Cycle demo style to Greatsword and run a V2 weapon chain.
- In battle, select a Greatsword style and confirm the QTE debug drawer shows V2 chain data.
- In battle, select style `6` on auto encounter and confirm the selection screen/log shows `熔炉守门人`.
- In battle, select style `7` on auto encounter and confirm the QTE debug drawer shows `秘术回廊`.
- Open QTE debug during a tagged chain and confirm `姿态：state / motion` is visible.
- In battle, select `6` Fire Greatsword and run `flame_blade`.
- In battle, select `7` Mirror Blades, gain energy with `S`, then run `overflow_burst`.
- Confirm no console errors.

## 23. Open Questions

- Should burn deal turn-start DOT or amplify the next fire hit?
- Should Fire heat gain decay over time, at turn boundaries, or only through overheat branches?
- Should Absorb overflow cost scale with stored energy or remain fixed per chain?
- Should armor break later become both a status multiplier and an enemy armor-stat reducer?
- Should Dual Blades Perfect streak be global combo-based or chain-local?
- Should named encounters get explicit phase changes at HP thresholds or stay as modifier-driven matchups?
- Should future visuals remain Canvas 2D or introduce a stronger animation layer first?
- Should hit confirm become mandatory for all damage immediately, or should phase 1 keep a fallback guaranteed-hit mode for existing content until chain hitbox metadata is complete?
- Should whiffs consume full resource costs, partial costs, or only animation time?

## 24. Immediate Next Task Recommendation

The active-attack and hit-confirm layer is now in place. The next bottleneck is depth and tuning, not another timing-system rewrite:

1. Run manual hard/extreme playtests against all four named encounters and tune subjective outliers that automated pressure floors cannot judge.
2. Decide whether armor/shield should gain explicit armor stats instead of only status and encounter multipliers.
3. Add explicit armor/shield stats only if manual playtesting shows status-only armor does not create enough decision pressure.
4. Keep hit-confirm overlays available for debugging, but avoid turning them into always-on visual noise.
5. Revisit the animation layer only if pose-tag Canvas 2D can no longer express attack/defense readability.
