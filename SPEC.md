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

## 6. Controls

### Global

- `ESC`: back/menu
- `H`: help
- `L`: log
- `M`: demo manual/auto toggle

### Combat

- `1-7`: select combat style
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

The battle setup now picks a preferred enemy archetype from the selected style. This is an initial pressure model, not a final encounter system.

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
- Add named encounter rules if manual enemy archetypes are no longer enough.
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

### Combat

- Weapon chains resolve damage and branch outcomes.
- Fire v2 applies damage, branch feedback, and burn/status presentation.
- Absorb active chain grants spell energy and absorb-ready state.
- Defense QTEs still resolve dodge, parry, and guard.

### Demo

- Fire v2 demo entries show branch path and result lines.
- Absorb active-chain demo entries show spell energy and absorb-ready result.
- Demo detail panel shows chain input flow, reference damage, projected timeline, actual timeline, and result summary.
- Demo result preview supports replaying the current item with `R`.
- Demo includes Showcase entries that play staged Fire, Absorb, Flame Blade, and enemy-turn examples without needing list paging.
- Demo QTE playback shows the current director focus on the main canvas.
- Demo result preview shows focus, result summary, and actual timeline without requiring the detail drawer.
- Enemy-turn demos show attack type, danger level, recommended key, and window countdown in the detail panel and attack bar.
- Key combat events have distinct audio feedback.
- Main menu can force enemy archetypes for matchup testing without changing style loadouts.
- Screenshot smoke covers main menu, Showcase, enemy readouts, battle style `6`, battle style `7`, result preview replay, and mobile landscape demo layout.
- Mobile landscape keeps the 16:9 game container inside the viewport without clipping the demo category controls.

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
- Enter demo mode.
- Open Showcase and run Fire branch comparison.
- Run enemy-turn Showcase and confirm type/danger/recommended key/countdown are visible.
- Open spell demos.
- Run Fire v2 entry.
- Press `R` on the result preview and confirm the same Fire v2 entry replays.
- Run Absorb active-chain entry.
- Run `flow-smoke.js` to cover battle style `6`, battle style `7`, Fire v2 demo playback, spell-list paging, and `overflow_burst` end to end.
- Run `visual-smoke.js` to cover main menu, Showcase, enemy readout, battle style `6`, battle style `7`, result replay, and mobile landscape screenshots.
- Cycle demo style to Dual Blades and run a V2 weapon chain.
- Cycle demo style to Greatsword and run a V2 weapon chain.
- In battle, select a Greatsword style and confirm the QTE debug drawer shows V2 chain data.
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
- Should manual enemy selection expand into named encounters with terrain or phase rules?
- Should future visuals remain Canvas 2D or introduce a stronger animation layer first?

## 24. Immediate Next Task Recommendation

Move to R13 encounter depth and content integration next:

1. Convert manual enemy archetype selection into named encounters with terrain, phases, or rule modifiers.
2. Add deeper armor/shield mechanics beyond HP and attack-pool pressure.
3. Expand weapon-plus-spell synergy into encounter-facing decisions instead of only chain-local bonuses.
4. Run the manual playtest checklist on normal/hard/extreme and tune any R12 outliers.

R1-R12 now provide content, observability, reusable visual primitives, readable character staging, audio feedback, Showcase demos, clearer enemy intent, automated screenshot smoke, mobile landscape layout protection, manual matchup testing, replay regression coverage, data-driven pose specificity, one-command local verification, core CI, chain-specific handfeel, demo director focus, and clearer weapon/spell synergy feedback. The next bottleneck is encounter depth and content integration rather than core QTE feel.
