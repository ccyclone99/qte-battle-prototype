# Manual Playtest Checklist

Use this after `node scripts/verify.js` passes when a change affects timing, visuals, audio, or demo flow.

## Entry Flow

- Main menu loads without HUD clutter.
- Difficulty and enemy matchup controls are readable.
- `开始战斗`, `练习模式`, and `效果演示` enter the expected modes.
- `ESC` returns to the previous menu without stale QTE/debug/result text.

## Battle Feel

- Style `6` Fire Greatsword enters `flame_blade` quickly after `A`.
- Style `7` Mirror Blades enters `absorb_siphon` quickly after `S`.
- Staff hold nodes do not feel stalled before the release window.
- Green windows are readable before they become actionable.
- Failed, Success, and Perfect results feel distinct without long lockouts.
- Hit stop confirms impact without making short chains feel sticky.

## Visual Readability

- Greatsword, Dual Blades, Staff, shield, and casting poses are distinguishable without reading text.
- Flame blade cut/burst and overflow compress/burst do not share the same silhouette.
- Enemy archetypes are identifiable from stance and equipment.
- Floating text and QTE prompts do not overlap the action bar on desktop or mobile landscape.
- Screen shake and burst FX do not hide the current key prompt.

## Demo Direction

- Showcase Fire branch clearly communicates Early, Success, and Perfect differences.
- Showcase enemy readout shows type, danger, recommended key, and response window.
- Spell demo `烈火重重 · 焰刃熔甲` shows heat, armor break, and burn progression.
- Spell demo `咒还 · 溢流爆发` shows spell energy cost and overload/burst outcome.
- Result preview records the same item that was played.
- Pressing `R` replays the same item without stale rows.

## Audio

- Perfect, Success, Fail, guard, dodge, burn, overload, and resource cues are distinct.
- Repeated demo playback is not fatiguing at normal system volume.
- Enemy warning and response-window cues are audible but not louder than hit confirmation.

## Debug/Observability

- `T` opens QTE debug in battle and demo.
- Active tagged chains show `姿态：state / motion`.
- No console errors appear during battle style `6`, battle style `7`, Showcase, or replay.
