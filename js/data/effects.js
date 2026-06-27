const EffectEventDefinitions = {};

function defineEffectEvents(names, definition) {
  for (const name of names) {
    EffectEventDefinitions[name] = definition;
  }
}

defineEffectEvents(["fireGlyph"], {
  particles: { preset: "fireball", anchor: "playerHand", intensity: 0.7 },
  burst: { kind: "glyph", anchor: "playerHand", color: "#e67e22", radius: 32, duration: 0.45, spin: 0.45 }
});

defineEffectEvents(["fireSpark"], {
  particles: { preset: "fireball", anchor: "playerHand", intensity: 0.65 }
});

defineEffectEvents(["fireSparkHit"], {
  particles: { preset: "fireball", anchor: "enemyCore", intensity: 0.85 },
  screenShake: 0.08
});

defineEffectEvents(["fireFizzle"], {
  particles: { preset: "status", anchor: "playerHand", intensity: 0.45 }
});

defineEffectEvents(["fireCharge"], {
  particles: { preset: "fireball", anchor: "playerHand", intensity: 0.9 }
});

defineEffectEvents(["fireChargePeak"], {
  particles: { preset: "fireball", anchor: "playerHand", intensity: 1.55 },
  burst: { kind: "pulse", anchor: "playerHand", color: "#e74c3c", coreColor: "#f1c40f", radius: 58, duration: 0.38 },
  cameraZoom: { zoom: 1.08, duration: 0.18 }
});

defineEffectEvents(["fireball"], {
  particles: { preset: "fireball", anchor: "enemyCore", intensity: 1.3 },
  screenShake: 0.1
});

defineEffectEvents(["fireballBig"], {
  particles: { preset: "fireball", anchor: "enemyCore", intensity: 2.2 },
  bursts: [
    { kind: "pulse", anchor: "enemyCore", color: "#e74c3c", coreColor: "#f1c40f", radius: 72, duration: 0.42 },
    { kind: "ring", anchor: "enemyCore", color: "#f39c12", radius: 82, width: 7, duration: 0.5 }
  ],
  screenShake: 0.18,
  impact: 1
});

defineEffectEvents(["fireballSmall"], {
  particles: { preset: "fireball", anchor: "enemyCore", intensity: 0.75 },
  screenShake: 0.06
});

defineEffectEvents(["fireOverheat", "fireOverheatControl"], {
  particles: { preset: "fireball", anchor: "playerHand", intensity: 1.2 },
  screenFlash: { color: "#e67e22", duration: 0.15 },
  screenShake: 0.12
});

defineEffectEvents(["fireBacklash"], {
  particles: { preset: "fireball", anchor: "playerCore", intensity: 0.95 },
  screenFlash: { color: "#e74c3c", duration: 0.16 },
  screenShake: 0.16
});

defineEffectEvents(["fireBladeIgnite"], {
  particles: { preset: "fireball", anchor: "playerHand", intensity: 0.9 }
});

defineEffectEvents(["fireBladeSlash"], {
  particles: { preset: "slash", anchor: "enemyCore", intensity: 1.25 },
  burst: { kind: "slash", anchor: "enemyCore", color: "#e67e22", secondaryColor: "#f1c40f", length: 128, width: 8, angle: -0.35, duration: 0.28 },
  screenShake: 0.1
});

defineEffectEvents(["fireBladeBurst"], {
  particles: { preset: "fireball", anchor: "enemyCore", intensity: 1.75 },
  bursts: [
    { kind: "pulse", anchor: "enemyCore", color: "#e74c3c", coreColor: "#f1c40f", radius: 64, duration: 0.36 },
    { kind: "ring", anchor: "enemyCore", color: "#e67e22", radius: 74, width: 6, duration: 0.45 }
  ],
  screenFlash: { color: "#e67e22", duration: 0.14 },
  screenShake: 0.16,
  impact: 1
});

defineEffectEvents(["shieldFlare", "shieldFlarePerfect"], {
  particles: [
    { preset: "guard", anchor: "playerShield", intensity: 1.0 },
    { preset: "fireball", anchor: "enemyCore", intensity: 1.15 }
  ],
  bursts: [
    { kind: "shield", anchor: "playerShield", color: "#f39c12", radius: 48, duration: 0.38 },
    { kind: "beam", anchor: "playerShield", toAnchor: "enemyCore", color: "#e67e22", width: 5, duration: 0.26 }
  ],
  screenFlash: { color: "#e67e22", duration: 0.12 },
  screenShake: 0.12
});

defineEffectEvents(["absorbGlyph"], {
  particles: { preset: "magic", anchor: "playerHand", intensity: 0.85 },
  burst: { kind: "glyph", anchor: "playerHand", color: "#9b59b6", radius: 34, duration: 0.48, spin: -0.65 }
});

defineEffectEvents(["absorbFlicker"], {
  particles: { preset: "magic", anchor: "playerHand", intensity: 0.55 }
});

defineEffectEvents(["absorbSiphon"], {
  particles: { preset: "magic", anchor: "playerHand", intensity: 0.9 }
});

defineEffectEvents(["absorbSiphonPeak"], {
  particles: { preset: "magic", anchor: "playerHand", intensity: 1.55 },
  bursts: [
    { kind: "glyph", anchor: "playerHand", color: "#5dade2", radius: 42, duration: 0.42, spin: -0.8 },
    { kind: "pulse", anchor: "playerCore", color: "#9b59b6", radius: 54, duration: 0.38 }
  ],
  cameraZoom: { zoom: 1.06, duration: 0.18 }
});

defineEffectEvents(["absorbLeak"], {
  particles: { preset: "magic", anchor: "playerCore", intensity: 0.7 }
});

defineEffectEvents(["absorbRelease"], {
  particles: [
    { preset: "magic", anchor: "enemyCore", intensity: 1.25 },
    { preset: "guard", anchor: "playerCore", intensity: 0.75 }
  ],
  screenShake: 0.08
});

defineEffectEvents(["absorbReleasePeak"], {
  particles: [
    { preset: "magic", anchor: "enemyCore", intensity: 1.85 },
    { preset: "guard", anchor: "playerCore", intensity: 0.95 }
  ],
  bursts: [
    { kind: "beam", anchor: "playerHand", toAnchor: "enemyCore", color: "#9b59b6", width: 6, duration: 0.28 },
    { kind: "ring", anchor: "enemyCore", color: "#5dade2", radius: 64, width: 5, duration: 0.42 }
  ],
  cameraZoom: { zoom: 1.08, duration: 0.2 },
  impact: 1
});

defineEffectEvents(["counterflowCatch"], {
  particles: [
    { preset: "magic", anchor: "playerHand", intensity: 1.05 },
    { preset: "guard", anchor: "playerCore", intensity: 0.65 }
  ],
  bursts: [
    { kind: "glyph", anchor: "playerHand", color: "#16a085", radius: 38, duration: 0.42, spin: -0.8 },
    { kind: "beam", anchor: "enemyCore", toAnchor: "playerHand", color: "#5dade2", width: 4, duration: 0.26 }
  ],
  cameraZoom: { zoom: 1.04, duration: 0.16 }
});

defineEffectEvents(["counterflowSlip"], {
  particles: [
    { preset: "magic", anchor: "playerCore", intensity: 0.95 },
    { preset: "slash", anchor: "playerHand", intensity: 0.55 }
  ],
  bursts: [
    { kind: "ring", anchor: "playerCore", color: "#16a085", radius: 48, width: 4, duration: 0.28 },
    { kind: "slash", anchor: "playerHand", color: "#5dade2", secondaryColor: "#ffffff", length: 86, width: 4, angle: -0.20, duration: 0.22 }
  ]
});

defineEffectEvents(["counterflowClashLead"], {
  particles: [
    { preset: "slash", anchor: "enemyCore", intensity: 1.15 },
    { preset: "guard", anchor: "playerShield", intensity: 0.75 }
  ],
  bursts: [
    { kind: "slash", anchor: "enemyCore", color: "#16a085", secondaryColor: "#ffffff", length: 112, width: 6, angle: 0.48, duration: 0.24 },
    { kind: "ring", anchor: "playerShield", color: "#5dade2", radius: 42, width: 4, duration: 0.28 }
  ],
  screenShake: 0.12
});

defineEffectEvents(["counterflowClashFollow"], {
  particles: [
    { preset: "slash", anchor: "enemyCore", intensity: 1.25 },
    { preset: "guard", anchor: "playerShield", intensity: 0.8 }
  ],
  bursts: [
    { kind: "slash", anchor: "enemyCore", color: "#5dade2", secondaryColor: "#16a085", length: 118, width: 6, angle: -0.56, duration: 0.24 },
    { kind: "slash", anchor: "enemyCore", color: "#ffffff", secondaryColor: "#16a085", length: 92, width: 4, angle: 0.64, duration: 0.20 }
  ],
  screenShake: 0.14,
  impact: 1
});

defineEffectEvents(["absorbBacklash"], {
  particles: { preset: "magic", anchor: "playerCore", intensity: 1.0 },
  screenFlash: { color: "#9b59b6", duration: 0.16 },
  screenShake: 0.12
});

defineEffectEvents(["mirrorGuard", "mirrorGuardPerfect"], {
  particles: [
    { preset: "guard", anchor: "playerShield", intensity: 1.0 },
    { preset: "magic", anchor: "enemyCore", intensity: 1.15 }
  ],
  bursts: [
    { kind: "shield", anchor: "playerShield", color: "#8e44ad", radius: 50, duration: 0.4 },
    { kind: "beam", anchor: "enemyCore", toAnchor: "playerShield", color: "#5dade2", width: 4, duration: 0.22 }
  ],
  screenFlash: { color: "#9b59b6", duration: 0.12 },
  screenShake: 0.1
});

defineEffectEvents(["overflowBurst", "overflowBurstPeak"], {
  particles: { preset: "magic", anchor: "enemyCore", intensity: 1.85 },
  bursts: [
    { kind: "pulse", anchor: "enemyCore", color: "#8e44ad", coreColor: "#5dade2", radius: 82, duration: 0.45 },
    { kind: "ring", anchor: "enemyCore", color: "#9b59b6", radius: 92, width: 8, duration: 0.52 }
  ],
  screenFlash: { color: "#9b59b6", duration: 0.16 },
  screenShake: 0.18,
  impact: 1
});

defineEffectEvents(["overflowVent"], {
  particles: { preset: "magic", anchor: "playerCore", intensity: 0.9 },
  screenFlash: { color: "#f39c12", duration: 0.12 }
});

defineEffectEvents(["greatswordStance", "greatswordDraw", "greatswordCharge"], {
  particles: { preset: "slash", anchor: "playerHand", intensity: 0.75 }
});

defineEffectEvents(["greatswordChargePeak"], {
  particles: { preset: "slash", anchor: "playerHand", intensity: 1.25 },
  cameraZoom: { zoom: 1.06, duration: 0.16 }
});

defineEffectEvents(["greatswordHeavyHit", "greatswordCleave"], {
  particles: { preset: "slash", anchor: "enemyCore", intensity: 1.25 },
  burst: { kind: "slash", anchor: "enemyCore", color: "#f1c40f", secondaryColor: "#ffffff", length: 142, width: 9, angle: -0.55, duration: 0.3 },
  screenShake: 0.12
});

defineEffectEvents(["greatswordCleavePerfect", "greatswordEarthsplit"], {
  particles: { preset: "slash", anchor: "enemyCore", intensity: 1.8 },
  bursts: [
    { kind: "slash", anchor: "enemyCore", color: "#f1c40f", secondaryColor: "#ffffff", length: 166, width: 11, angle: -0.5, duration: 0.34 },
    { kind: "ring", anchor: "enemyCore", color: "#f39c12", radius: 76, width: 6, duration: 0.42 }
  ],
  screenShake: 0.2,
  impact: 1
});

defineEffectEvents(["greatswordLightHit"], {
  particles: { preset: "slash", anchor: "enemyCore", intensity: 0.8 },
  screenShake: 0.06
});

defineEffectEvents(["greatswordRecover"], {
  particles: { preset: "slash", anchor: "playerHand", intensity: 0.55 }
});

defineEffectEvents(["greatswordOvercharge"], {
  particles: { preset: "slash", anchor: "playerHand", intensity: 1.1 },
  screenShake: 0.1
});

defineEffectEvents(["greatswordOverchargeHit"], {
  particles: { preset: "slash", anchor: "enemyCore", intensity: 1.45 },
  screenShake: 0.16
});

defineEffectEvents(["greatswordArmorRead"], {
  particles: { preset: "status", anchor: "enemyChest", intensity: 0.65 }
});

defineEffectEvents(["greatswordArmorBreak"], {
  particles: { preset: "status", anchor: "enemyCore", intensity: 1.15 },
  screenShake: 0.16,
  impact: 1
});

defineEffectEvents(["dualDash", "dualFocus"], {
  particles: { preset: "slash", anchor: "playerHand", intensity: 0.7 }
});

defineEffectEvents(["dualSlash", "dualFinisher", "dualPierce", "dualWhirl"], {
  particles: { preset: "slash", anchor: "enemyCore", intensity: 1.0 },
  burst: { kind: "slash", anchor: "enemyCore", color: "#5dade2", secondaryColor: "#ffffff", length: 104, width: 5, angle: 0.45, duration: 0.24 },
  screenShake: 0.06
});

defineEffectEvents(["dualAfterimage", "dualShadowFinisher", "dualPiercePerfect", "dualWhirlPerfect", "dualWhirlFinisher"], {
  particles: { preset: "slash", anchor: "enemyCore", intensity: 1.45 },
  bursts: [
    { kind: "slash", anchor: "enemyCore", color: "#8e44ad", secondaryColor: "#5dade2", length: 118, width: 6, angle: 0.45, duration: 0.25 },
    { kind: "slash", anchor: "enemyCore", color: "#5dade2", secondaryColor: "#ffffff", length: 108, width: 5, angle: -0.55, duration: 0.25 }
  ],
  cameraZoom: { zoom: 1.08, duration: 0.16 },
  screenShake: 0.08
});

defineEffectEvents(["dualRecover"], {
  particles: { preset: "slash", anchor: "playerHand", intensity: 0.55 }
});

defineEffectEvents(["dualRecoverHit"], {
  particles: { preset: "slash", anchor: "enemyCore", intensity: 0.8 },
  screenShake: 0.05
});
