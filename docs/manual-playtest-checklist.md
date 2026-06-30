# Manual Playtest Checklist

Use this after `node scripts/verify.js` passes when a change affects timing, visuals, audio, public combat flow, or QTE prototype reference material.

## Entry Flow

- Main menu loads without HUD clutter.
- Difficulty and enemy matchup controls are readable.
- `开始战斗` and `练习模式` enter the current counter-flow plan.
- `效果演示` remains hidden/disabled while the public demo entry is frozen.
- `ESC` returns to the previous menu without stale QTE/debug/result text.

## Battle Feel

- The default public plan enters enemy turn without pressing `1-8`.
- Enemy physical chains ask for sequential node responses instead of one input covering the whole chain.
- Enemy spell nodes can be interrupted by `A/S/D` without starting a counterspell QTE.
- Holding `F` before contact keeps a guard stance; releasing `F` before contact removes protection.
- Low guard stability can break on heavy attacks, and the result summary/debug lines show guard block/break counts.
- Successful enemy-turn response opens the follow-up window.
- During follow-up, `A/S/D` starts a weapon QTE; no input falls back to automatic attack.
- Follow-up banner explains whether it came from clash, spell interrupt, guard, dodge, or stun.
- Green windows are readable before they become actionable.
- Failed, Success, and Perfect results feel distinct without long lockouts.
- Hit stop confirms impact without making short chains feel sticky.
- Shielded/armored enemies visibly reduce eligible melee damage without changing default training-target math.
- `雨巷迅刺` feels fast without opening on two identical quick-stab checks.
- Named encounters visibly shift attack rhythm after the enemy drops below half HP.
- Win/loss screen shows encounter, phase reached, accuracy, Perfect count, max combo, damage, and hits taken.

## Visual Readability

- Greatsword, Dual Blades, Staff, shield, and casting poses are distinguishable without reading text.
- Flame blade cut/burst and overflow compress/burst do not share the same silhouette.
- Enemy archetypes are identifiable from stance and equipment.
- Floating text and QTE prompts do not overlap the action bar on desktop or mobile landscape.
- Screen shake and burst FX do not hide the current key prompt.

## QTE Prototype Reference

- `docs/qte-prototype-reference.md` lists retained chains, runner files, data files, and validation commands.
- `DemoMode` and `QTEChainRunner` remain in the repo even while the public demo entry is hidden.
- `node scripts/sim-chain.js flame_blade perfect` still runs.
- `node scripts/sim-chain.js overflow_burst perfect` still runs.
- Public tests do not require style `6`, style `7`, or style `8` menu entry points.

## Audio

- Perfect, Success, Fail, guard, dodge, burn, overload, and resource cues are distinct.
- Repeated demo playback is not fatiguing at normal system volume.
- Enemy warning and response-window cues are audible but not louder than hit confirmation.

## Debug/Observability

- `T` opens QTE debug in battle.
- Active tagged chains show `姿态：state / motion`.
- QTE debug shows `实战记录` and one `建议：...` line.
- QTE debug shows guard stance state, local telemetry export hint, and damage path audit lines.
- No console errors appear during the default counter-flow battle, follow-up QTE, visual smoke, or replay-free public flow.
