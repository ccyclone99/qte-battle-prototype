class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    // 逻辑分辨率 960×540，按 DPR 放大 canvas 实际像素，CSS 仍显示为 1280×720
    this.width = 960;
    this.height = 540;
    this.layout = {
      qteBarY: 456,
      actionBarY: 484,
      bottomHintY: 492,
      selectionTitleY: 60,
      demoTitleY: 62
    };
    this.visualBudget = {
      cinematic: 0.38,
      counterFocus: 0.32,
      defenseIntent: 0.28,
      motionLines: 0.18,
      afterimage: 0.08,
      statusAura: 0.20,
      resourcePulse: 0.12,
      impact: 0.34,
      ornament: 0.16,
      screenFlash: 0.08,
      cameraShake: 0.50
    };
    this.visualPolicy = {
      actorGroundSigils: false,
      actorFootwork: false,
      actorAfterimages: false,
      actorStatusAuras: false,
      actorStatusOverlays: false,
      actorIntentBadges: false,
      defenseIntentOverlay: false,
      activeAttackContactGuides: false,
      counterFocusLayer: false,
      contactGroundImpulses: false,
      contactWhiffs: false,
      activeMeleeAttackTrails: false,
      combatPhaseLightingOrnaments: false,
      enemyChainIntentLayer: false,
      playerQTEChainIntentLayer: false,
      legacyPlayerAttackTrail: false,
      actorMotionLines: false,
      actorImpactReactions: false,
      actorDamageMarks: false,
      actorReactionOverlay: false,
      actorModelDecorations: false,
      playerWeaponActionLayer: false,
      enemyEncounterPhaseOverlay: false,
      enemyAttackPoseOverlay: false,
      enemyActionPersonalityLayer: false,
      enemyAttackIcon: false,
      enemyTelegraphLane: false
    };
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = 1280;
    const displayHeight = 720;
    canvas.width = Math.floor(displayWidth * dpr);
    canvas.height = Math.floor(displayHeight * dpr);
    const scaleX = canvas.width / this.width;
    const scaleY = canvas.height / this.height;
    this.ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  }

  visualScale(kind = "statusAura") {
    const budget = this.visualBudget || {};
    const value = budget[kind];
    return Number.isFinite(value) ? value : 1;
  }

  visualLayerEnabled(scene, layer) {
    const policy = this.visualPolicy || {};
    if (policy[layer]) return true;
    const debugOnly = layer === "activeAttackContactGuides"
      || layer === "counterFocusLayer"
      || layer === "contactGroundImpulses"
      || layer === "contactWhiffs"
      || layer === "enemyTelegraphLane";
    return !!(debugOnly && scene && scene.showHitConfirmOverlay);
  }

  renderBlank() {
    const ctx = this.ctx;
    ctx.save();
    this.drawBackground(ctx);
    ctx.restore();
  }

  drawBackground(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, "#12121a");
    grad.addColorStop(1, "#1a1a25");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // 远景网格线
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    const horizon = this.height - 150;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(this.width, horizon);
    ctx.stroke();

    for (let x = 0; x <= this.width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, horizon);
      ctx.lineTo(x + (x - this.width / 2) * 0.4, this.height);
      ctx.stroke();
    }
  }

  render(scene) {
    this.currentScene = scene;
    const ctx = this.ctx;
    const now = performance.now();
    const t = now / 1000;
    const camera = this.getRenderCamera(scene, t);

    ctx.save();
    this.drawBackground(ctx);

    ctx.save();
    this.applyWorldCamera(ctx, camera);
    this.drawWorldScene(scene, t);
    ctx.restore();

    if (scene.turnState.startsWith("demo_")) {
      this.drawDemo(scene, t);
    } else if (scene.turnState === "select_weapon") {
      this.drawWeaponSelection(scene);
    } else if (scene.turnState === "select_spells") {
      this.drawSpellSelection(scene);
    } else if (scene.turnState === "select_arts") {
      this.drawArtSelection(scene);
    } else if (scene.turnState === "player_turn" || scene.turnState === "followup_turn") {
      this.drawPlayerState(scene);
      this.drawStatusIcons(scene);
      this.drawActionBar(scene);
      if (scene.turnState === "followup_turn") this.drawChainHints(scene);
    } else if (scene.turnState === "enemy_turn") {
      this.drawPlayerState(scene);
      this.drawStatusIcons(scene);
      this.drawCounterFlowHud(scene, t);
    } else if (scene.turnState === "qte_running" && scene.qteRunner) {
      this.drawPlayerState(scene);
      this.drawStatusIcons(scene);
      this.drawQTEBar(scene);
      const node = scene.qteRunner.currentNode();
      if (node) {
        const key = node.input.type === "hold_release" ? `松开 ${node.input.key}` : node.input.key;
        this.drawBigKeyPrompt(scene, key, node.name, 300, t);
      }
    } else if (scene.turnState === "attack_active") {
      this.drawPlayerState(scene);
      this.drawStatusIcons(scene);
    } else if (scene.turnState === "game_over") {
      this.drawGameOver(scene);
    }

    this.drawLearningObjectivePanel(scene, t);

    this.drawResourcePulseLayer(ctx, this.getResourcePulseVisuals(scene), t);

    // 通用浮层提示（选择/演示/结束界面各自处理）
    if (this.shouldDrawFloatingMessage(scene)) {
      this.drawFloatingMessage(scene);
    }

    // 屏幕闪白/闪红
    if (scene.screenFlash && this.shouldDrawScreenFlash(scene)) {
      this.drawScreenFlash(scene);
    }

    // 粒子与浮动文字
    if (scene.particles) scene.particles.render(ctx);
    if (scene.floatingTexts) scene.floatingTexts.render(ctx);

    // 回合横幅
    if (this.shouldDrawTurnBanner(scene)) {
      this.drawTurnBanner(scene);
    }

    // 暗角：聚焦中央舞台
    this.drawVignette();

    // 冲击帧（高对比闪屏）
    if (scene.impactFrames > 0) {
      this.drawImpactFrames(scene);
    }

    // Demo 过场卡片
    if (scene.transition) {
      this.drawDemoTransition(scene);
    }

    // Battle 连击 UI
    if (scene.comboCount > 0) {
      this.drawComboUI(scene);
    }

    ctx.restore();
  }

  getRenderCamera(scene, t = 0) {
    const shake = Utils.clamp(scene && scene.screenShake ? scene.screenShake : 0, 0, 0.45);
    const zoom = scene && scene.cameraZoom ? scene.cameraZoom : 1;
    const zoomDelta = Math.abs(zoom - 1);
    const active = shake > 0.001 || zoomDelta > 0.001;
    const amp = shake * 18 * this.visualScale("cameraShake");
    const dx = active ? (Math.sin(t * 58.7) * 0.72 + Math.sin(t * 91.3) * 0.28) * amp : 0;
    const dy = active ? (Math.cos(t * 47.9) * 0.66 + Math.sin(t * 77.1) * 0.22) * amp * 0.58 : 0;

    return {
      active,
      shake,
      zoom,
      dx,
      dy,
      uiStable: true
    };
  }

  applyWorldCamera(ctx, camera) {
    if (!camera || !camera.active) return;
    const zoom = camera.zoom || 1;
    if (Math.abs(zoom - 1) > 0.001) {
      const cx = this.width / 2;
      const cy = this.height / 2;
      ctx.translate(cx, cy);
      ctx.scale(zoom, zoom);
      ctx.translate(-cx, -cy);
    }
    if (camera.dx || camera.dy) {
      ctx.translate(camera.dx || 0, camera.dy || 0);
    }
  }

  drawWorldScene(scene, t) {
    this.drawCharacters(scene, t);
    this.drawAttackEffects(scene, t);
    if (this.visualLayerEnabled(scene, "counterFocusLayer")) {
      this.drawCounterFocusLayer(scene, t);
    }
    this.drawHitConfirmOverlays(scene);
    this.drawCombatContactLayer(scene, t);
    if (scene.effectBursts) scene.effectBursts.render(this.ctx);
    this.drawCinematicFocus(scene, t);
  }

  shouldDrawFloatingMessage(scene) {
    if (!scene || !scene.turnState) return false;
    if (scene.turnState.startsWith("demo_")) return false;
    if (scene.turnState.startsWith("select_")) return false;
    if (scene.turnState === "game_over") return false;
    if (scene.turnState === "enemy_turn" && scene.enemyAttack && scene.enemyAttackPhase !== "none") return false;
    return scene.turnState !== "qte_running" && scene.turnState !== "attack_active";
  }

  shouldDrawTurnBanner(scene) {
    if (!scene || !scene.turnBanner) return false;
    if (scene.turnState === "enemy_turn" && scene.enemyAttackChain) return false;
    return scene.turnState !== "qte_running" && scene.turnState !== "attack_active";
  }

  shouldDrawScreenFlash(scene) {
    if (!scene || !scene.turnState) return false;
    return scene.turnState !== "demo_preview";
  }

  getCinematicFocus(scene) {
    if (!scene || !scene.turnState || scene.turnState.startsWith("select_") || scene.turnState.startsWith("demo_") || scene.turnState === "game_over") {
      return null;
    }

    const active = this.getCinematicActiveAttack(scene);
    if (active) {
      const profile = active.profile || {};
      const from = this.resolveCinematicAnchor(active.intent && (active.intent.fromAnchor || active.intent.anchor) || (active.source === "enemy" ? "enemyCore" : "playerHand"));
      const to = this.resolveCinematicAnchor(active.intent && active.intent.toAnchor || (active.target === "player" ? "playerCore" : "enemyCore"));
      const point = active.position || {
        x: from.x + (to.x - from.x) * (active.progress || 0.5),
        y: from.y + (to.y - from.y) * (active.progress || 0.5)
      };
      const meleePressure = profile.type === "melee";
      const phaseBoost = active.phase === "impact" ? 0.92 : (active.phase === "reaction" ? 0.66 : 0.46);
      return {
        kind: "activeAttack",
        source: active.source,
        phase: active.phase,
        color: profile.color || (active.source === "enemy" ? "#e74c3c" : "#f1c40f"),
        type: profile.type || "",
        meleePressure,
        from,
        to,
        point: meleePressure ? to : point,
        progress: active.progress || 0,
        intensity: phaseBoost,
        label: active.intent && (active.intent.visualEvent || active.intent.chainId || active.intent.kind)
      };
    }

    if (scene.turnState === "enemy_turn" && scene.enemyAttack && scene.enemyAttackPhase && scene.enemyAttackPhase !== "none") {
      const response = scene.enemyAttackPhase === "response";
      const hit = scene.enemyAttackPhase === "hit";
      return {
        kind: "enemyResponse",
        phase: scene.enemyAttackPhase,
        color: scene.enemyAttack.color || "#e74c3c",
        from: this.resolveCinematicAnchor("enemyCore"),
        to: this.resolveCinematicAnchor("playerCore"),
        point: response || hit ? this.resolveCinematicAnchor("playerCore") : this.resolveCinematicAnchor("enemyCore"),
        progress: hit ? 1 : (response ? 0.72 : 0.34),
        intensity: hit ? 0.82 : (response ? 0.62 : 0.34),
        label: scene.enemyAttack.name || "enemy"
      };
    }

    if (scene.turnState === "qte_running" && scene.qteRunner) {
      const style = scene.playerConfig && scene.playerConfig.style ? StyleDatabase[scene.playerConfig.style] : null;
      return {
        kind: "qteFocus",
        phase: "input",
        color: style ? style.color : "#f1c40f",
        from: this.resolveCinematicAnchor("playerCore"),
        to: this.resolveCinematicAnchor("enemyCore"),
        point: { x: this.width / 2, y: 336 },
        progress: scene.qteRunner.currentNodeProgress ? scene.qteRunner.currentNodeProgress() : 0.5,
        intensity: 0.26,
        label: "qte"
      };
    }

    return null;
  }

  getCinematicActiveAttack(scene) {
    const system = scene && scene.activeAttackSystem;
    if (!system || !Array.isArray(system.active) || system.active.length === 0) return null;
    const candidates = system.active.filter(attack => !attack.completed && !attack.canceled);
    if (candidates.length === 0) return null;
    const priority = { impact: 0, reaction: 1, startup: 2, recovery: 3 };
    return candidates.slice().sort((a, b) => {
      const ap = priority[a.phase] ?? 4;
      const bp = priority[b.phase] ?? 4;
      if (ap !== bp) return ap - bp;
      const ai = a.profile && Number.isFinite(a.profile.impactTime) ? Math.abs(a.profile.impactTime - a.elapsed) : Infinity;
      const bi = b.profile && Number.isFinite(b.profile.impactTime) ? Math.abs(b.profile.impactTime - b.elapsed) : Infinity;
      return ai - bi;
    })[0];
  }

  getActorPerformance(scene, actor, reaction = null, pose = null) {
    const isPlayer = actor === "player";
    const dir = isPlayer ? 1 : -1;
    const currentReaction = reaction || this.getActorReaction(scene, actor);
    const reactionProgress = currentReaction && Number.isFinite(currentReaction.progress) ? currentReaction.progress : 0;
    const reactionPulse = Math.sin(reactionProgress * Math.PI);
    const performance = {
      actor,
      offsetX: 0,
      offsetY: 0,
      lean: 0,
      scaleX: 1,
      scaleY: 1,
      shadowScale: 1,
      armReach: 0,
      stride: 0,
      attack: 0,
      windup: 0,
      brace: 0,
      cast: 0,
      hitSquash: 0,
      afterimageAlpha: 0,
      afterimageCount: 0,
      actionProgress: 0,
      poseIntensity: 0,
      enemyPose: null,
      motion: pose && pose.motion ? pose.motion : ""
    };

    if (currentReaction && currentReaction.type) {
      if (currentReaction.type === "attack") {
        performance.attack = Math.max(performance.attack, 0.48 + reactionPulse * 0.42);
        performance.armReach += 12 * reactionPulse;
        performance.stride += 10 * reactionPulse;
        performance.lean += dir * 0.05 * reactionPulse;
        performance.afterimageAlpha = Math.max(performance.afterimageAlpha, 0.10 * reactionPulse);
      } else if (currentReaction.type === "windup") {
        performance.windup = Math.max(performance.windup, 0.52 + reactionPulse * 0.36);
        performance.armReach += 6 * reactionPulse;
        performance.lean -= dir * 0.05 * reactionPulse;
      } else if (currentReaction.type === "cast") {
        performance.cast = Math.max(performance.cast, 0.45 + reactionPulse * 0.35);
        performance.offsetY -= 2 * reactionPulse;
        performance.shadowScale += 0.04 * reactionPulse;
      } else if (currentReaction.type === "guard") {
        performance.brace = Math.max(performance.brace, 0.5 + reactionPulse * 0.34);
        performance.scaleX -= 0.03 * reactionPulse;
        performance.scaleY += 0.04 * reactionPulse;
      } else if (currentReaction.type === "dodge") {
        performance.afterimageAlpha = Math.max(performance.afterimageAlpha, 0.26 * reactionPulse);
        performance.afterimageCount = Math.max(performance.afterimageCount, 2);
        performance.lean -= dir * 0.10 * reactionPulse;
        performance.stride += 16 * reactionPulse;
      } else if (currentReaction.type === "hit" || currentReaction.type === "crit" || currentReaction.type === "stagger") {
        const hard = currentReaction.type === "crit" ? 1.25 : 1;
        performance.hitSquash = Math.max(performance.hitSquash, 0.36 * hard * reactionPulse);
        performance.scaleX += 0.06 * hard * reactionPulse;
        performance.scaleY -= 0.05 * hard * reactionPulse;
        performance.lean += dir * 0.08 * hard * reactionPulse;
      }
    }

    const active = this.getActorActiveAttack(scene, actor, "source");
    if (active) {
      const profile = active.profile || {};
      const progress = Utils.clamp(active.progress || 0, 0, 1);
      const activePulse = Math.sin(progress * Math.PI);
      const phasePower = active.phase === "impact"
        ? 1
        : (active.phase === "reaction" ? 0.82 : (active.phase === "startup" ? 0.52 : 0.34));
      const isSpellShape = profile.type === "projectile" || profile.type === "beam" || profile.type === "pulse";
      performance.actionProgress = Math.max(performance.actionProgress, progress);
      performance.motion = active.intent && (active.intent.motion || active.intent.visualEvent || active.intent.chainId) || performance.motion;
      if (isSpellShape) {
        performance.offsetX += dir * 5 * phasePower * Math.max(0.2, activePulse);
        performance.offsetY -= 3 * phasePower * activePulse;
        performance.lean += dir * 0.04 * phasePower;
        performance.stride += 4 * phasePower * activePulse;
        performance.armReach += 8 * phasePower;
        performance.shadowScale += 0.06 * phasePower;
        performance.cast = Math.max(performance.cast, 0.58 + phasePower * 0.30);
      } else {
        const meleePose = this.sampleActiveMeleePose(active, actor);
        if (meleePose) {
          const approach = -10 * meleePose.load
            + 34 * meleePose.strike
            + 18 * meleePose.contact
            + 8 * meleePose.recover;
          performance.meleePose = meleePose;
          performance.actionProgress = Math.max(performance.actionProgress, meleePose.strike * 0.86 + meleePose.contact * 0.14 + meleePose.recover * 0.30);
          performance.offsetX += dir * approach;
          performance.offsetY -= 3 * meleePose.strike + 2 * meleePose.contact;
          performance.lean += dir * (-0.12 * meleePose.load + 0.30 * meleePose.strike + 0.10 * meleePose.contact - 0.10 * meleePose.recover);
          performance.stride += 12 * meleePose.load + 44 * meleePose.strike + 18 * meleePose.contact + 10 * meleePose.recover;
          performance.armReach += 12 * meleePose.load + 58 * meleePose.strike + 30 * meleePose.contact + 12 * meleePose.recover;
          performance.shadowScale += 0.04 + 0.09 * meleePose.strike + 0.05 * meleePose.contact;
          performance.attack = Math.max(performance.attack, 0.36 + meleePose.load * 0.18 + meleePose.strike * 0.46 + meleePose.contact * 0.18);
          performance.windup = Math.max(performance.windup, meleePose.load * 0.46);
          if (!isPlayer) {
            performance.enemyPose = meleePose.poseKind;
            performance.poseIntensity = Math.max(performance.poseIntensity, meleePose.load * 0.44 + meleePose.strike * 0.72 + meleePose.contact * 0.22);
          }
        } else {
          performance.offsetX += dir * 16 * phasePower * Math.max(0.2, activePulse);
          performance.offsetY -= 5 * phasePower * activePulse;
          performance.lean += dir * 0.11 * phasePower;
          performance.stride += 18 * phasePower * activePulse;
          performance.armReach += 30 * phasePower;
          performance.shadowScale += 0.06 * phasePower;
          performance.attack = Math.max(performance.attack, 0.58 + phasePower * 0.34);
        }
        performance.afterimageAlpha = Math.max(performance.afterimageAlpha, 0.08 + phasePower * 0.10);
        performance.afterimageCount = Math.max(performance.afterimageCount, active.intent && active.intent.hitCount > 1 ? 2 : 1);
      }
    }

    const incoming = this.getActorActiveAttack(scene, actor, "target");
    if (incoming && incoming.phase !== "startup") {
      const pressure = incoming.phase === "impact" ? 0.74 : (incoming.phase === "reaction" ? 0.52 : 0.22);
      performance.brace = Math.max(performance.brace, pressure);
      performance.lean -= dir * 0.04 * pressure;
      if (incoming.phase === "impact") {
        performance.hitSquash = Math.max(performance.hitSquash, 0.22);
      }
    }

    if (scene && scene.enemyAttack) {
      const telegraph = this.getEnemyTelegraph(scene.enemyAttack);
      if (!isPlayer && !(active && active.profile && active.profile.type === "melee")) {
        const phase = scene.enemyAttackPhase || "none";
        if (phase !== "none" && phase !== "canceled") {
          const response = phase === "response";
          const hit = phase === "hit";
          const windup = phase === "windup";
          const phaseIntensity = hit ? 1 : (response ? 0.74 : (windup ? 0.42 : 0.22));
          performance.enemyPose = telegraph.pose || "lunge";
          performance.poseIntensity = Math.max(performance.poseIntensity, phaseIntensity);
          performance.armReach = Math.max(performance.armReach, hit ? 44 : (response ? 30 : 12));
          performance.windup = Math.max(performance.windup, windup ? 0.58 : 0);
          performance.offsetX += dir * (hit ? 14 : (response ? 7 : -4)) * phaseIntensity;
          performance.lean += dir * (telegraph.pose === "overhead" ? 0.03 : 0.08) * phaseIntensity;
          performance.stride += (hit ? 20 : 10) * phaseIntensity;
          performance.afterimageAlpha = Math.max(performance.afterimageAlpha, response || hit ? 0.16 * phaseIntensity : 0);
          performance.afterimageCount = Math.max(performance.afterimageCount, response || hit ? 2 : 0);
          if (telegraph.pose === "cast") performance.cast = Math.max(performance.cast, 0.52 + phaseIntensity * 0.34);
          if (telegraph.pose === "bash") performance.brace = Math.max(performance.brace, 0.35 + phaseIntensity * 0.32);
        }
      } else if (scene.turnState === "enemy_turn" && scene.enemyAttackPhase === "response") {
        performance.brace = Math.max(performance.brace, 0.42);
        performance.lean -= dir * 0.035;
      }
    }

    const squash = performance.hitSquash;
    if (squash > 0) {
      performance.scaleX += squash * 0.08;
      performance.scaleY -= squash * 0.07;
      performance.shadowScale += squash * 0.10;
    }
    performance.afterimageAlpha = Utils.clamp(performance.afterimageAlpha, 0, 0.42);
    performance.afterimageCount = Math.max(performance.afterimageAlpha > 0.04 ? 1 : 0, Math.min(3, performance.afterimageCount || 0));
    return performance;
  }

  getActorActiveAttack(scene, actor, role = "source") {
    const system = scene && scene.activeAttackSystem;
    if (!system || !Array.isArray(system.active) || system.active.length === 0) return null;
    const candidates = system.active.filter(attack => {
      if (!attack || attack.completed || attack.canceled) return false;
      return role === "target" ? attack.target === actor : attack.source === actor;
    });
    if (candidates.length === 0) return null;
    const priority = { impact: 0, reaction: 1, startup: 2, recovery: 3 };
    return candidates.slice().sort((a, b) => {
      const ap = priority[a.phase] ?? 4;
      const bp = priority[b.phase] ?? 4;
      if (ap !== bp) return ap - bp;
      return (b.elapsed || 0) - (a.elapsed || 0);
    })[0];
  }

  sampleActiveMeleePose(attack, actor = "player") {
    const profile = attack && attack.profile ? attack.profile : null;
    if (!profile || profile.type !== "melee") return null;
    const timeline = profile.meleeTimeline || {};
    const offset = timeline.offset || 0;
    const total = Math.max(0.24, timeline.total || profile.total || 0.72);
    const local = Utils.clamp((attack.elapsed || 0) - offset, 0, total);
    const contact = Utils.clamp(
      Number.isFinite(timeline.contactFrame) ? timeline.contactFrame : Math.min(total - 0.14, total * 0.62),
      0.05,
      total
    );
    const activeStart = Utils.clamp(
      Number.isFinite(timeline.activeStart) ? timeline.activeStart : Math.max(0, contact - 0.16),
      0,
      contact
    );
    const activeEnd = Utils.clamp(
      Number.isFinite(timeline.activeEnd) ? timeline.activeEnd : Math.min(total, contact + 0.18),
      contact,
      total
    );
    const smooth = value => {
      const t = Utils.clamp(value, 0, 1);
      return t * t * (3 - 2 * t);
    };
    const load = local < activeStart
      ? smooth(local / Math.max(0.001, activeStart))
      : Math.max(0, 1 - smooth((local - activeStart) / Math.max(0.001, contact - activeStart))) * 0.42;
    const strike = local < activeStart
      ? 0
      : (local <= contact
        ? smooth((local - activeStart) / Math.max(0.001, contact - activeStart))
        : Math.max(0, 1 - smooth((local - contact) / Math.max(0.001, activeEnd - contact))) * 0.55);
    const contactPulse = Math.max(0, 1 - Math.abs(local - contact) / Math.max(0.055, total * 0.08));
    const recover = local <= contact ? 0 : smooth((local - contact) / Math.max(0.001, total - contact));
    const intent = attack.intent || {};
    const sourceAttack = intent.attack || {};
    const telegraph = sourceAttack.telegraph || {};
    const weapon = String(intent.weapon || sourceAttack.weapon || "").toLowerCase();
    const text = [
      intent.motion,
      intent.attackId,
      intent.chainId,
      intent.label,
      sourceAttack.id,
      sourceAttack.name,
      telegraph.type,
      telegraph.pose,
      weapon
    ].filter(Boolean).join(" ").toLowerCase();
    const dual = weapon.includes("dual") || text.includes("dual") || text.includes("flurry") || text.includes("quick");
    const heavy = weapon.includes("great") || text.includes("heavy") || text.includes("smash") || text.includes("crush") || text.includes("overhead");
    const rawPose = telegraph.pose || telegraph.type || "";
    const poseKind = rawPose === "stab" || rawPose === "quick_melee"
      ? "lunge"
      : (rawPose === "slash" || rawPose === "melee"
        ? "sweep"
        : (rawPose === "smash" || rawPose === "heavy_melee"
          ? "overhead"
          : (rawPose || (heavy ? "overhead" : (dual ? "sweep" : "lunge")))));
    return {
      active: true,
      actor,
      source: attack.source,
      phase: local < activeStart ? "windup" : (local <= contact ? "strike" : (local <= activeEnd ? "contact" : "recover")),
      local,
      total,
      activeStart,
      contactFrame: contact,
      activeEnd,
      load,
      strike,
      contact: smooth(contactPulse),
      recover,
      dual,
      heavy,
      poseKind
    };
  }

  getPlayerModelProfile(scene) {
    const config = scene && scene.playerConfig ? scene.playerConfig : {};
    const weaponId = config.weapon || "";
    const style = config.style ? StyleDatabase[config.style] : null;
    const spells = Array.isArray(config.spells) ? config.spells : [];
    const weapon = weaponId ? WeaponDatabase[weaponId] : null;
    const armor = weaponId === "greatsword" ? "heavy"
      : (weaponId === "dualBlades" ? "light"
        : (weaponId === "staff" ? "caster" : "standard"));

    return {
      weaponId,
      weapon,
      styleId: config.style || "",
      styleKey: style ? style.key : "",
      styleNumber: style ? style.number : "",
      styleName: style ? style.name : "",
      styleColor: style ? style.color : (weapon ? weapon.color : "#3498db"),
      armor,
      gear: weaponId || "unarmed",
      hasFire: spells.includes("fire"),
      hasAbsorb: spells.includes("absorb")
    };
  }

  getPlayerRigProfile(playerProfile = {}) {
    const profile = playerProfile || {};
    const weaponId = profile.weaponId || profile.weapon || "";
    const armor = profile.armor || "standard";
    const styleKey = profile.styleKey || "";
    const base = {
      weaponId,
      armor,
      silhouette: "standard-adventurer",
      scaleX: 1,
      scaleY: 1,
      torsoW: 44,
      torsoH: 56,
      headRadius: 15,
      legWidth: 9,
      armWidth: 7,
      shadowScale: 1,
      stance: 1
    };

    if (weaponId === "greatsword" || armor === "heavy") {
      return {
        ...base,
        silhouette: "vanguard-plate",
        scaleX: 1.08,
        scaleY: 1.03,
        torsoW: 52,
        torsoH: 60,
        headRadius: 16,
        legWidth: 10,
        armWidth: 8,
        shadowScale: 1.12,
        stance: 1.12
      };
    }

    if (weaponId === "staff" || armor === "caster") {
      return {
        ...base,
        silhouette: "arcane-mantle",
        scaleX: 0.96,
        scaleY: 1.07,
        torsoW: 42,
        torsoH: 64,
        headRadius: 14,
        legWidth: 7,
        armWidth: 6,
        shadowScale: 0.88,
        stance: 0.86
      };
    }

    if (weaponId === "dualBlades") {
      const counter = styleKey === "8";
      return {
        ...base,
        silhouette: counter ? "counter-duelist" : "agile-duelist",
        scaleX: counter ? 0.90 : 0.93,
        scaleY: 0.98,
        torsoW: counter ? 40 : 42,
        torsoH: 54,
        headRadius: 14,
        legWidth: 7,
        armWidth: 6,
        shadowScale: counter ? 0.90 : 0.94,
        stance: counter ? 1.34 : 1.22
      };
    }

    return base;
  }

  getEnemyModelProfile(config = {}) {
    const model = config.model || {};
    const icon = config.icon || "敌";
    const modelType = model.type || (icon === "术" ? "caster"
      : (icon === "甲" ? "armored"
        : (icon === "迅" ? "swift"
          : (icon === "盾" ? "shielded" : "golem"))));

    return {
      model,
      modelType,
      build: model.build || (modelType === "armored" ? "heavy" : (modelType === "swift" ? "lean" : "medium")),
      gear: model.gear || (modelType === "caster" ? "focus" : (modelType === "swift" ? "dualBlades" : "hammer")),
      armor: model.armor || (modelType === "caster" ? "robe" : (modelType === "shielded" ? "ward" : "stone")),
      icon,
      color: config.color || EnemyDatabase.base.color
    };
  }

  getEnemyRigProfile(modelProfile = {}) {
    const profile = typeof modelProfile === "string"
      ? { modelType: modelProfile, build: "" }
      : (modelProfile || {});
    const modelType = profile.modelType || profile.type || "golem";
    const build = profile.build || "medium";
    const base = {
      modelType,
      build,
      silhouette: modelType,
      scaleX: 1,
      scaleY: 1,
      torsoW: 60,
      torsoH: 66,
      headRadius: 16,
      legWidth: 9,
      armWidth: 8,
      shoulderW: 64,
      shoulderY: -26,
      shadowScale: 1,
      stance: 1
    };

    if (modelType === "caster") {
      return {
        ...base,
        silhouette: "ritual-caster",
        scaleX: 0.92,
        scaleY: 1.08,
        torsoW: 52,
        torsoH: 78,
        headRadius: 15,
        legWidth: 7,
        armWidth: 7,
        shoulderW: 58,
        shoulderY: -30,
        shadowScale: 0.86,
        stance: 0.82
      };
    }
    if (modelType === "armored" || build === "heavy") {
      return {
        ...base,
        silhouette: "heavy-plate",
        scaleX: 1.14,
        scaleY: 1.04,
        torsoW: 76,
        torsoH: 74,
        headRadius: 19,
        legWidth: 12,
        armWidth: 10,
        shoulderW: 88,
        shoulderY: -30,
        shadowScale: 1.20,
        stance: 1.12
      };
    }
    if (modelType === "swift" || build === "lean") {
      return {
        ...base,
        silhouette: "low-cloak",
        scaleX: 0.84,
        scaleY: 0.98,
        torsoW: 48,
        torsoH: 62,
        headRadius: 14,
        legWidth: 7,
        armWidth: 6,
        shoulderW: 50,
        shoulderY: -24,
        shadowScale: 0.82,
        stance: 1.24
      };
    }
    if (modelType === "shielded" || build === "guard") {
      return {
        ...base,
        silhouette: "ward-guard",
        scaleX: 1.05,
        scaleY: 1.02,
        torsoW: 64,
        torsoH: 68,
        headRadius: 17,
        legWidth: 10,
        armWidth: 9,
        shoulderW: 74,
        shoulderY: -28,
        shadowScale: 1.08,
        stance: 0.96
      };
    }
    if (modelType === "golem") {
      return {
        ...base,
        silhouette: "stone-golem",
        scaleX: 1.08,
        scaleY: 1.04,
        torsoW: 66,
        torsoH: 70,
        headRadius: 18,
        legWidth: 11,
        armWidth: 10,
        shoulderW: 78,
        shoulderY: -28,
        shadowScale: 1.14,
        stance: 1.04
      };
    }

    return base;
  }

  resolveCinematicAnchor(anchor) {
    if (this.currentScene && this.currentScene.resolveBattleAnchor) {
      return this.currentScene.resolveBattleAnchor(anchor);
    }
    const anchors = {
      playerCore: { x: 220, y: 360 },
      playerHand: { x: 270, y: 320 },
      playerShield: { x: 220, y: 380 },
      enemyCore: { x: 740, y: 380 },
      enemyChest: { x: 740, y: 350 },
      midpoint: { x: 480, y: 370 }
    };
    return anchors[anchor] || anchors.midpoint;
  }

  drawCinematicFocus(scene, t) {
    const focus = this.getCinematicFocus(scene);
    if (!focus) return;
    const ctx = this.ctx;
    const scale = this.visualScale("cinematic");
    const intensity = Utils.clamp((focus.intensity || 0) * scale, 0, 1);
    if (intensity <= 0.02) return;

    this.drawCinematicLetterbox(ctx, intensity, focus.color);
    if (!focus.meleePressure) this.drawCinematicLane(ctx, focus, t);
    this.drawCinematicReticle(ctx, focus, t, intensity);
  }

  drawCinematicLetterbox(ctx, intensity, color) {
    ctx.save();
    const bar = 18 + intensity * 24;
    const alpha = 0.10 + intensity * 0.12;
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, this.width, bar);
    ctx.fillRect(0, this.height - bar, this.width, bar);

    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = this.hexToRgba(color || "#ffffff", 0.05 + intensity * 0.08);
    ctx.fillRect(0, bar - 2, this.width, 2);
    ctx.fillRect(0, this.height - bar, this.width, 2);
    ctx.restore();
  }

  drawCinematicLane(ctx, focus, t) {
    const from = focus.from || this.resolveCinematicAnchor("playerCore");
    const to = focus.to || this.resolveCinematicAnchor("enemyCore");
    const color = focus.color || "#f1c40f";
    const intensity = Utils.clamp((focus.intensity || 0) * this.visualScale("cinematic"), 0, 1);
    const isEnemy = focus.kind === "enemyResponse" || focus.source === "enemy";
    const laneAlpha = focus.kind === "qteFocus" ? 0.05 : 0.08 + intensity * 0.10;
    const shimmer = 0.5 + Math.sin(t * 8) * 0.08;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const grad = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
    grad.addColorStop(0, this.hexToRgba(color, laneAlpha * 0.40));
    grad.addColorStop(0.5, this.hexToRgba(color, laneAlpha * shimmer));
    grad.addColorStop(1, this.hexToRgba(color, laneAlpha * 0.50));
    ctx.strokeStyle = grad;
    ctx.lineWidth = focus.kind === "qteFocus" ? 10 : 14 + intensity * 16;
    ctx.lineCap = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = 5 + intensity * 8;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y - 16);
    ctx.quadraticCurveTo(this.width / 2, 308 - intensity * 16, to.x, to.y - 18);
    ctx.stroke();

    ctx.strokeStyle = this.hexToRgba("#ffffff", 0.04 + intensity * 0.05);
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const offset = ((t * 110 + i * 90) % 520) / 520;
      const x = from.x + (to.x - from.x) * offset;
      const y = from.y + (to.y - from.y) * offset - 24 + Math.sin(offset * Math.PI) * -36;
      ctx.beginPath();
      ctx.moveTo(x - (isEnemy ? -18 : 18), y);
      ctx.lineTo(x + (isEnemy ? -30 : 30), y - 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCinematicReticle(ctx, focus, t, scaledIntensity = null) {
    const point = focus.point || this.resolveCinematicAnchor("midpoint");
    const color = focus.color || "#f1c40f";
    const intensity = scaledIntensity === null
      ? Utils.clamp((focus.intensity || 0) * this.visualScale("cinematic"), 0, 1)
      : scaledIntensity;
    const radius = focus.kind === "qteFocus" ? 26 : 34 + intensity * 12;
    const alpha = focus.kind === "qteFocus" ? 0.10 : 0.12 + intensity * 0.16;
    const spin = t * (focus.source === "enemy" ? -1.2 : 1.2);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(point.x, point.y);
    ctx.rotate(spin);
    ctx.strokeStyle = this.hexToRgba(color, alpha);
    ctx.lineWidth = 1.5 + intensity * 1.2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 5 + intensity * 8;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const x1 = Math.cos(a) * (radius + 8);
      const y1 = Math.sin(a) * (radius + 8);
      const x2 = Math.cos(a) * (radius + 24);
      const y2 = Math.sin(a) * (radius + 24);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    if (focus.phase === "impact") {
      ctx.strokeStyle = this.hexToRgba("#ffffff", 0.26 + intensity * 0.24);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, radius * (0.45 + Math.sin(t * 14) * 0.06), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawVignette() {
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(
      this.width / 2, this.height / 2, this.height * 0.35,
      this.width / 2, this.height / 2, this.height * 0.85
    );
    grad.addColorStop(0, "rgba(0, 0, 0, 0)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0.55)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  drawImpactFrames(scene) {
    const ctx = this.ctx;
    // 极轻微高亮，几乎不察觉
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    ctx.globalCompositeOperation = "screen";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  drawDemoTransition(scene) {
    const ctx = this.ctx;
    const trans = scene.transition;
    if (!trans) return;

    const progress = 1 - trans.timer / trans.maxTime;
    const alpha = Math.sin(progress * Math.PI);
    const y = this.height / 2 - 20 + (1 - alpha) * 30;

    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${0.65 * alpha})`;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = trans.color || "#f1c40f";
    ctx.font = "bold 42px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = trans.color;
    ctx.shadowBlur = 20;
    ctx.fillText(trans.label, this.width / 2, y);
    ctx.restore();
  }

  drawComboUI(scene) {
    const ctx = this.ctx;
    const combo = scene.comboCount || 0;
    if (combo <= 0) return;

    const x = this.width - 90;
    const y = 110;
    const pulse = 1 + Math.sin(performance.now() / 100) * 0.08;
    const color = combo >= 5 ? "#e74c3c" : (combo >= 3 ? "#f39c12" : "#f1c40f");

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = color;
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillText(`×${combo}`, 0, 0);
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("COMBO", 0, 34);
    ctx.restore();
  }

  drawPlayerState(battle) {
    const ctx = this.ctx;
    const x = 20;
    const y = 72;
    const barW = 138;
    const isActionFocused = this.isActionFocusedState(battle);
    let offsetY = y;

    const hasAbsorb = battle.hasSpell && battle.hasSpell("absorb");
    const spellEnergy = battle.playerState.spellEnergy || 0;
    if (hasAbsorb || spellEnergy > 0) {
      offsetY = this.drawResourceMeter(ctx, {
        x,
        y: offsetY,
        w: barW,
        label: "法术能量",
        value: spellEnergy,
        max: battle.playerState.maxSpellEnergy,
        color: "#9b59b6",
        overColor: "#e74c3c"
      }) + 8;
    }

    if (battle.resourceSystem && (battle.hasSpell && battle.hasSpell("fire") || battle.resourceSystem.heat > 0)) {
      const heatRatio = battle.resourceSystem.maxHeat
        ? battle.resourceSystem.heat / battle.resourceSystem.maxHeat
        : 0;
      offsetY = this.drawResourceMeter(ctx, {
        x,
        y: offsetY,
        w: barW,
        label: "热量",
        value: battle.resourceSystem.heat,
        max: battle.resourceSystem.maxHeat,
        color: heatRatio >= 0.85 ? "#e74c3c" : "#e67e22",
        overColor: "#e74c3c"
      }) + 8;
    }

    // 破甲
    if (battle.armorBreakActive) {
      ctx.fillStyle = "#e74c3c";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(`破甲中 ${battle.armorBreakTurns} 回合`, x, offsetY);
      offsetY += 20;
    }

    // 连续闪避
    if (battle.playerState.consecutiveDodges > 0) {
      ctx.fillStyle = "#2ecc71";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(`连续闪避 ${battle.playerState.consecutiveDodges}`, x, offsetY);
      offsetY += 20;
    }

    // 盾附魔
    if (battle.playerState.shieldEnchanted) {
      ctx.fillStyle = "#9b59b6";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("盾牌附魔", x, offsetY);
      offsetY += 20;
    }

    // 当前激活咒术/战技
    if (!isActionFocused && (battle.playerConfig.spells.length > 0 || battle.playerConfig.combatArts.length > 0)) {
      this.drawEquipmentChips(ctx, battle, x, offsetY, 176);
    }
  }

  isActionFocusedState(scene) {
    return scene
      && (scene.turnState === "qte_running" || scene.turnState === "attack_active" || scene.turnState === "enemy_turn");
  }

  drawResourceMeter(ctx, options) {
    const x = options.x;
    const y = options.y;
    const w = options.w || 138;
    const h = 8;
    const value = Math.max(0, options.value || 0);
    const max = Math.max(1, options.max || 1);
    const ratio = Utils.clamp(value / max, 0, 1);
    const over = value > max;
    const label = `${options.label} ${Math.floor(value)}/${options.max || max}`;

    ctx.save();
    ctx.fillStyle = "rgba(5, 7, 12, 0.62)";
    ctx.beginPath();
    ctx.roundRect(x - 4, y - 3, w + 8, 28, 4);
    ctx.fill();

    ctx.fillStyle = "#cfd6e6";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(this.truncateText(ctx, label, w), x, y);

    ctx.fillStyle = "rgba(42, 42, 58, 0.9)";
    ctx.fillRect(x, y + 16, w, h);
    ctx.fillStyle = over ? (options.overColor || "#e74c3c") : (options.color || "#f1c40f");
    ctx.fillRect(x, y + 16, Math.max(value > 0 ? 3 : 0, w * ratio), h);

    if (over) {
      ctx.strokeStyle = options.overColor || "#e74c3c";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 1, y + 15, w + 2, h + 2);
    }
    ctx.restore();
    return y + 25;
  }

  getResourcePulseVisuals(scene) {
    if (!scene || !scene.resourceSystem || !scene.resourceSystem.getVisualPulses) return { active: false, pulses: [] };
    const pulses = scene.resourceSystem.getVisualPulses();
    if (!Array.isArray(pulses) || pulses.length === 0) return { active: false, pulses: [] };

    const hasAbsorb = scene.hasSpell && scene.hasSpell("absorb");
    const hasFire = scene.hasSpell && scene.hasSpell("fire");
    const spellEnergy = scene.playerState ? scene.playerState.spellEnergy || 0 : 0;
    const heat = scene.resourceSystem.heat || 0;
    const spellVisible = hasAbsorb || spellEnergy > 0;
    const heatVisible = hasFire || heat > 0;
    const baseY = 72;
    const meterY = {
      spellEnergy: spellVisible ? baseY : baseY,
      heat: spellVisible && heatVisible ? baseY + 33 : baseY
    };

    return {
      active: true,
      pulses: pulses.map(pulse => ({
        ...pulse,
        meter: {
          x: 20,
          y: meterY[pulse.type] || baseY,
          w: 138
        },
        source: {
          x: 220,
          y: this.height - 205
        }
      }))
    };
  }

  drawResourcePulseLayer(ctx, visuals, t) {
    if (!visuals || !visuals.active || !Array.isArray(visuals.pulses)) return;
    const visualScale = this.visualScale("resourcePulse");
    if (visualScale <= 0.05) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const pulse of visuals.pulses) {
      const progress = Utils.clamp(pulse.progress || 0, 0, 1);
      const alpha = Utils.clamp(pulse.alpha || 0, 0, 1) * visualScale;
      if (alpha <= 0.02) continue;

      const gain = pulse.direction !== "spend";
      const color = pulse.color || (pulse.type === "heat" ? "#e67e22" : "#9b59b6");
      const meter = pulse.meter || { x: 20, y: 72, w: 138 };
      const source = pulse.source || { x: 220, y: this.height - 205 };
      const meterPoint = {
        x: meter.x + meter.w - 6,
        y: meter.y + 20
      };
      const from = gain ? source : meterPoint;
      const to = gain ? meterPoint : source;
      const control = {
        x: (from.x + to.x) / 2,
        y: Math.min(from.y, to.y) - 42 - (pulse.intensity || 1) * 16
      };
      const laneAlpha = alpha * 0.08;

      ctx.strokeStyle = this.hexToRgba(color, laneAlpha);
      ctx.lineWidth = 1.2 + (pulse.intensity || 1) * 0.45;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4 + (pulse.intensity || 1) * 3;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(control.x, control.y, to.x, to.y);
      ctx.stroke();

      for (let i = 0; i < 2; i++) {
        const u = Utils.clamp(progress - i * 0.18, 0, 1);
        const point = this.quadraticPoint(from, control, to, u);
        const dotAlpha = alpha * Math.max(0, 1 - i * 0.25) * (0.34 + Math.sin((u + t) * Math.PI) * 0.08);
        ctx.globalAlpha = dotAlpha;
        ctx.fillStyle = i === 0 ? "#ffffff" : color;
        ctx.beginPath();
        ctx.arc(point.x, point.y, Math.max(2, 4.2 - i * 0.75) * Math.min(1.15, pulse.intensity || 1), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const halo = 1 + Math.sin(t * 12 + pulse.id) * 0.05;
      const haloAlpha = alpha * (gain ? 0.22 : 0.18);
      ctx.strokeStyle = this.hexToRgba(color, haloAlpha);
      ctx.fillStyle = this.hexToRgba(color, haloAlpha * 0.16);
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.roundRect(meter.x - 8, meter.y + 10, meter.w + 18, 20, 5);
      ctx.fill();
      ctx.stroke();

      const amountText = `${gain ? "+" : "-"}${Math.abs(Math.floor(pulse.amount || 0))}`;
      const tagX = meter.x + meter.w + 20;
      const tagY = meter.y + 20 - progress * 10;
      ctx.save();
      ctx.globalAlpha = alpha * 0.72;
      ctx.translate(tagX, tagY);
      ctx.scale(halo, halo);
      ctx.fillStyle = this.hexToRgba("#071018", 0.72);
      ctx.strokeStyle = this.hexToRgba(color, 0.74);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-18, -9, 36, 18, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = gain ? "#ffffff" : "#d9f1ff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(amountText, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  quadraticPoint(from, control, to, t) {
    const inv = 1 - t;
    return {
      x: inv * inv * from.x + 2 * inv * t * control.x + t * t * to.x,
      y: inv * inv * from.y + 2 * inv * t * control.y + t * t * to.y
    };
  }

  drawEquipmentChips(ctx, battle, x, y, maxWidth = 176) {
    const chips = [];
    for (const id of battle.playerConfig.spells) {
      const spell = SpellDatabase[id];
      if (spell) chips.push({ label: spell.name, color: spell.color });
    }
    for (const id of battle.playerConfig.combatArts) {
      const art = CombatArtDatabase[id];
      if (art) chips.push({ label: art.name, color: art.color });
    }
    if (chips.length === 0) return;

    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "bold 11px sans-serif";
    ctx.fillStyle = "#f1c40f";
    ctx.fillText("装备", x, y + 8);

    let cursorX = x;
    let cursorY = y + 24;
    for (const chip of chips) {
      const label = this.truncateText(ctx, chip.label, maxWidth - 16);
      const chipW = Math.min(maxWidth, Math.max(48, ctx.measureText(label).width + 18));
      if (cursorX > x && cursorX + chipW > x + maxWidth) {
        cursorX = x;
        cursorY += 22;
      }
      ctx.fillStyle = "rgba(8, 10, 16, 0.68)";
      ctx.strokeStyle = chip.color || "#f1c40f";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cursorX, cursorY, chipW, 18, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = chip.color || "#ffffff";
      ctx.fillText(label, cursorX + 8, cursorY + 9);
      cursorX += chipW + 6;
    }
    ctx.restore();
  }

  drawAttackEffects(scene, t) {
    const ctx = this.ctx;
    const ornamentScale = this.visualScale("ornament");
    const px = 220;
    const py = this.height - 190;
    const ex = this.width - 220;
    const ey = this.height - 190;
    const pose = this.getCurrentPose(scene);
    const pState = pose.state;

    // 剑攻击轨迹
    if (pState === "swordAttack" && this.visualLayerEnabled(scene, "legacyPlayerAttackTrail")) {
      const weaponId = scene.playerConfig && scene.playerConfig.weapon ? scene.playerConfig.weapon : "";
      const weapon = weaponId ? WeaponDatabase[weaponId] : null;
      const color = weapon ? weapon.color : "#f1c40f";
      const timing = this.getActionTiming(scene, t);
      this.drawWeaponTrail(ctx, px, py, weaponId, weapon, color, timing.progress, timing.active, pose.motion);
    }

    // 火球蓄力特效：蓄力越久，火球越大越烈
    if (scene.qteRunner) {
      const runner = scene.qteRunner;
      const node = runner.currentNode();
      if (node && node.id === "charge" && node.input.type === "hold_release" && runner.chain && runner.chain.name.includes("火球")) {
        const ratio = Utils.clamp(runner.nodeTimer / node.duration, 0, 1);
        this.drawFireballCharge(scene, px + 50, py - 30, ratio, t);
      }
    }

    // 施法/蓄力光环
    if (pState === "casting" || pState === "charge") {
      ctx.save();
      ctx.translate(px, py);
      ctx.strokeStyle = pState === "casting" ? "#9b59b6" : "#f39c12";
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = (0.22 + Math.sin(t * 5) * 0.08) * ornamentScale;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 48 + Math.sin(t * 4) * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 盾反/格挡火花
    if (pState === "shield") {
      ctx.save();
      ctx.translate(px, py);
      ctx.fillStyle = "#f1c40f";
      ctx.globalAlpha = (0.28 + Math.sin(t * 15) * 0.10) * ornamentScale;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + t * 4;
        const r = 42 + Math.sin(t * 10 + i) * 4;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 敌人受击闪烁
    if (scene.enemyAttackPhase === "hit") {
      ctx.save();
      ctx.translate(ex, ey);
      ctx.fillStyle = this.hexToRgba("#e74c3c", 0.08 * this.visualScale("impact"));
      ctx.beginPath();
      ctx.arc(0, 0, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const hasEnemyActiveAttack = scene.activeAttackSystem
      && Array.isArray(scene.activeAttackSystem.active)
      && scene.activeAttackSystem.active.some(attack => attack.source === "enemy" && attack.target === "player");
    if (scene.enemyAttack
      && !hasEnemyActiveAttack
      && (scene.turnState === "enemy_turn" || scene.enemyAttackPhase === "hit")) {
      this.drawEnemyAttackMotion(ctx, scene, px, py, ex, ey, t);
    }

    this.drawActiveAttacks(scene, t);
  }

  drawActiveAttacks(scene, t) {
    const system = scene.activeAttackSystem;
    if (!system || !Array.isArray(system.active) || system.active.length === 0) return;
    const ctx = this.ctx;
    const incomingEnemy = scene && scene.getIncomingActiveAttack ? scene.getIncomingActiveAttack() : null;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const attack of system.active) {
      const enemyPressure = scene
        && scene.turnState === "enemy_turn"
        && attack.source === "enemy"
        && attack.target === "player";
      if (enemyPressure && attack !== incomingEnemy && attack.phase !== "reaction" && attack.phase !== "impact") {
        continue;
      }
      const profile = attack.profile || {};
      const color = profile.color || (attack.source === "enemy" ? "#e74c3c" : "#f1c40f");
      const from = this.getBattleAnchor(attack.intent.fromAnchor || attack.intent.anchor || (attack.source === "enemy" ? "enemyCore" : "playerHand"));
      const to = this.getBattleAnchor(attack.intent.toAnchor || (attack.target === "player" ? "playerCore" : "enemyCore"));
      const pos = attack.position || {
        x: from.x + (to.x - from.x) * (attack.progress || 0),
        y: from.y + (to.y - from.y) * (attack.progress || 0)
      };
      const progress = Utils.clamp(attack.progress || 0, 0, 1);
      const pulse = 1 + Math.sin(t * 10) * 0.08;
      const descriptor = attack.source === "player" ? this.getPlayerActiveAttackDescriptor(attack) : null;
      const contactGuide = this.getActiveAttackContactGuide(attack, from, to, pos, color, progress, descriptor);
      const meleeEnemyPressure = enemyPressure && profile.type === "melee";
      if (this.visualLayerEnabled(scene, "activeAttackContactGuides")
        && !meleeEnemyPressure
        && (!enemyPressure || attack.phase === "reaction" || attack.phase === "impact")) {
        this.drawActiveAttackContactGuide(ctx, contactGuide, t);
      }

      if (attack.source === "player") {
        if (profile.type === "projectile") {
          this.drawPlayerProjectileActiveAttack(ctx, attack, descriptor, from, to, pos, color, progress, pulse, t);
        } else if (profile.type === "beam") {
          this.drawPlayerSpellActiveAttack(ctx, attack, descriptor, from, to, pos, color, progress, pulse, t);
        } else if (profile.type === "pulse") {
          this.drawPlayerPulseActiveAttack(ctx, attack, descriptor, from, to, pos, color, progress, pulse, t);
        } else if (this.visualLayerEnabled(scene, "activeMeleeAttackTrails")) {
          this.drawPlayerMeleeActiveAttack(ctx, attack, descriptor, from, to, color, progress, t);
        }
      } else if (profile.type === "projectile") {
        this.drawGenericProjectileActiveAttack(ctx, attack, from, pos, color, progress, pulse);
      } else if (profile.type === "beam") {
        this.drawGenericBeamActiveAttack(ctx, attack, from, pos, color, t);
      } else if (profile.type === "pulse") {
        this.drawGenericPulseActiveAttack(ctx, attack, pos, color, progress, pulse);
      } else if (this.visualLayerEnabled(scene, "activeMeleeAttackTrails")) {
        this.drawMeleeActiveAttack(ctx, attack, from, to, color, progress, t);
      }

      if (attack.phase === "reaction" && this.visualLayerEnabled(scene, "activeAttackContactGuides")) {
        const reactionScale = this.visualScale("counterFocus");
        ctx.strokeStyle = this.hexToRgba("#2ecc71", 0.38 * reactionScale);
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(to.x, to.y, (profile.radius || 46) + 10 + Math.sin(t * 8) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }

  drawCounterFocusLayer(scene, t) {
    const data = this.getCounterFlowHudData(scene);
    if (!data || !data.active || scene.turnState !== "enemy_turn") return;
    const visualScale = this.visualScale("counterFocus");
    if (visualScale <= 0.05) return;

    const attack = data.active;
    const intent = attack.intent || {};
    const color = data.metrics.inResponse ? "#2ecc71" : (data.color || "#e74c3c");
    const from = attack.position || this.getBattleAnchor(intent.fromAnchor || intent.anchor || "enemyCore");
    const to = this.getBattleAnchor(intent.toAnchor || "playerCore");
    const pulse = 1 + Math.sin(t * 9) * 0.08;
    const responseAlpha = (data.metrics.inResponse ? 0.62 : 0.20) * visualScale;
    const radius = data.metrics.inResponse ? 46 + Math.sin(t * 14) * 3 : 36;
    const ctx = this.ctx;
    const melee = attack.profile && attack.profile.type === "melee";

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (!melee) {
      ctx.strokeStyle = this.hexToRgba(color, responseAlpha);
      ctx.lineWidth = data.metrics.inResponse ? 2.5 : 1.4;
      if (!data.metrics.inResponse) ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const dir = from.x > to.x ? 1 : -1;
      ctx.strokeStyle = this.hexToRgba(color, (data.metrics.inResponse ? 0.42 : 0.14) * visualScale);
      ctx.lineWidth = data.metrics.inResponse ? 2 : 1.2;
      ctx.setLineDash(data.metrics.inResponse ? [] : [6, 9]);
      for (let i = 0; i < 2; i++) {
        const ox = dir * (34 + i * 20);
        const oy = -18 + i * 24;
        ctx.beginPath();
        ctx.moveTo(to.x + ox, to.y + oy);
        ctx.lineTo(to.x + ox - dir * 18, to.y + oy + 6);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    ctx.translate(to.x, to.y);
    ctx.shadowColor = color;
    ctx.shadowBlur = data.metrics.inResponse ? 9 : 4;
    ctx.strokeStyle = this.hexToRgba(color, (data.metrics.inResponse ? 0.64 : 0.24) * visualScale);
    ctx.lineWidth = data.metrics.inResponse ? 3 : 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius * pulse, -Math.PI * 0.82, Math.PI * 0.82);
    ctx.stroke();

    ctx.globalAlpha = (data.metrics.inResponse ? 0.16 : 0.06) * visualScale;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(18, radius * 0.42), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawGenericProjectileActiveAttack(ctx, attack, from, pos, color, progress, pulse) {
    const profile = attack.profile || {};
    const r = (profile.radius || 32) * (0.78 + progress * 0.22) * pulse;
    const grad = ctx.createRadialGradient(pos.x, pos.y, 2, pos.x, pos.y, r);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.28, color);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawGenericBeamActiveAttack(ctx, attack, from, pos, color, t) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 10 + Math.sin(t * 18) * 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.globalAlpha = attack.phase === "reaction" ? 0.55 : 0.85;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  drawGenericPulseActiveAttack(ctx, attack, pos, color, progress, pulse) {
    const profile = attack.profile || {};
    const r = (profile.radius || 72) * Math.max(0.15, progress) * pulse;
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
    ctx.globalAlpha = 0.25 + progress * 0.55;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  getPlayerActiveAttackDescriptor(attack) {
    const intent = attack.intent || {};
    const context = intent.context || {};
    const profile = attack.profile || {};
    const text = [
      context.chainId,
      context.chainFamily,
      intent.chainId,
      intent.chainFamily,
      intent.visualEvent,
      intent.motion,
      intent.label,
      intent.weapon,
      profile.element,
      ...(intent.visualEvents || []),
      ...(intent.outcomes || [])
    ].filter(Boolean).join(" ").toLowerCase();
    const includes = needles => needles.some(needle => text.includes(needle));
    const family = intent.chainFamily || context.chainFamily || profile.element || "";
    const weapon = intent.weapon || context.weapon || "";
    const hitIndex = Math.max(1, intent.hitIndex || 1);
    const hitCount = Math.max(1, intent.hitCount || 1);

    return {
      family,
      weapon,
      hitIndex,
      hitCount,
      isDual: family === "dualBlades" || weapon === "dualBlades" || includes(["dual", "shadow", "flurry", "dash"]),
      isGreatsword: family === "greatsword" || weapon === "greatsword" || includes(["greatsword", "cleave", "earthsplit", "armorbreak"]),
      isFire: family === "fire" || profile.element === "fire" || includes(["fire", "flame", "ember", "burn"]),
      isAbsorb: family === "absorb" || profile.element === "absorb" || includes(["absorb", "siphon", "overflow", "mirror", "counterspell"]),
      isCounter: intent.kind === "defenseCounter" || includes(["counter", "clash", "reflect"]),
      isBurst: profile.type === "pulse" || includes(["burst", "peak", "overload", "overflow"]),
      isFinisher: includes(["finisher", "shadow", "perfect"]),
      text
    };
  }

  getActiveAttackContactGuide(attack, from, to, pos, color, progress, descriptor = null) {
    if (!attack || !from || !to) return { active: false };
    const profile = attack.profile || {};
    const intent = attack.intent || {};
    const type = profile.type || intent.attackType || "melee";
    const isMelee = type === "melee";
    const isBeam = type === "beam";
    const isProjectile = type === "projectile";
    const isPulse = type === "pulse";
    const source = attack.source || "player";
    const target = attack.target || (source === "enemy" ? "player" : "enemy");
    const phase = attack.phase || "startup";
    const hitIndex = Math.max(1, intent.hitIndex || 1);
    const hitCount = Math.max(1, intent.hitCount || 1);
    const approach = Math.sign(to.x - from.x) || (source === "enemy" ? -1 : 1);
    const wind = Utils.clamp(progress || 0, 0, 1);
    const swing = Math.sin(wind * Math.PI);
    const alternate = hitIndex % 2 === 0 ? -1 : 1;
    const heavy = !!(descriptor && (descriptor.isGreatsword || descriptor.isFire))
      || (profile.radius || 0) > 42
      || String(intent.weapon || "").includes("greatsword");
    const alphaByPhase = {
      startup: 0.24,
      reaction: 0.48,
      impact: 0.72,
      recovery: 0.25,
      canceled: 0.18
    };
    const alpha = alphaByPhase[phase] || 0.56;
    const handLift = isMelee ? (heavy ? 30 : 24) : (isBeam ? 18 : 10);
    const hand = {
      x: from.x + approach * (isMelee ? (12 + swing * 16) : 0),
      y: from.y - handLift + alternate * (isMelee && hitCount > 1 ? 5 : 0)
    };
    const contact = isMelee
      ? {
          x: to.x - approach * (heavy ? 34 : 28) + approach * swing * (heavy ? 18 : 12),
          y: to.y - (heavy ? 14 : 20) + alternate * (hitCount > 1 ? 9 : 0)
        }
      : (isPulse ? { x: to.x, y: to.y - 8 } : { x: pos.x, y: pos.y });
    const targetPoint = {
      x: to.x,
      y: to.y - (target === "player" ? 14 : 20)
    };

    return {
      active: true,
      source,
      target,
      phase,
      type,
      isMelee,
      isBeam,
      isProjectile,
      isPulse,
      heavy,
      color,
      progress: wind,
      swing,
      alpha,
      approach,
      hitIndex,
      hitCount,
      hand,
      contact,
      targetPoint,
      radius: Utils.clamp((profile.radius || 42) + (heavy ? 14 : 0) + hitCount * 2, 30, 86),
      width: Utils.clamp(profile.width || (heavy ? 58 : 38), 26, 96),
      counter: !!(descriptor && descriptor.isCounter)
    };
  }

  drawActiveAttackContactGuide(ctx, guide, t) {
    if (!guide || !guide.active) return;
    const guideScale = this.visualScale("impact");
    if (guideScale <= 0.05) return;
    const color = guide.color || (guide.source === "enemy" ? "#e74c3c" : "#f1c40f");
    const alpha = (guide.alpha || 0.5) * guideScale;
    const pulse = 1 + Math.sin(t * 9 + guide.hitIndex) * 0.08;
    const glowScale = Utils.clamp(0.35 + guideScale * 0.65, 0.35, 1);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = (guide.phase === "impact" ? 22 : 12) * glowScale;

    ctx.strokeStyle = this.hexToRgba(color, alpha * 0.34);
    ctx.fillStyle = this.hexToRgba(color, alpha * 0.05);
    ctx.lineWidth = guide.heavy ? 3 : 2;
    ctx.beginPath();
    ctx.arc(guide.hand.x, guide.hand.y, (guide.heavy ? 16 : 12) * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (guide.isMelee) {
      const midX = (guide.hand.x + guide.contact.x) / 2 + guide.approach * (guide.heavy ? 20 : 12);
      const midY = Math.min(guide.hand.y, guide.contact.y) - (guide.heavy ? 42 : 26) * (0.45 + guide.swing * 0.55);
      ctx.strokeStyle = this.hexToRgba(color, alpha * 0.34);
      ctx.lineWidth = guide.heavy ? 3.25 : 2.25;
      if (guide.phase === "startup") ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(guide.hand.x, guide.hand.y);
      ctx.quadraticCurveTo(midX, midY, guide.contact.x, guide.contact.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = this.hexToRgba("#ffffff", alpha * 0.22);
      ctx.lineWidth = guide.heavy ? 2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(guide.hand.x + guide.approach * 8, guide.hand.y + 5);
      ctx.quadraticCurveTo(midX, midY + 10, guide.contact.x - guide.approach * 6, guide.contact.y + 5);
      ctx.stroke();

      this.drawActiveAttackTargetBracket(ctx, guide, color, alpha, t);
    } else {
      const laneAlpha = guide.isBeam ? alpha * 0.26 : alpha * 0.18;
      ctx.strokeStyle = this.hexToRgba(color, laneAlpha);
      ctx.lineWidth = guide.isBeam ? 3 : 2;
      if (guide.isProjectile) ctx.setLineDash([6, 9]);
      ctx.beginPath();
      ctx.moveTo(guide.hand.x, guide.hand.y);
      ctx.quadraticCurveTo((guide.hand.x + guide.targetPoint.x) / 2, guide.hand.y - (guide.isBeam ? 18 : 46), guide.contact.x, guide.contact.y);
      ctx.stroke();
      ctx.setLineDash([]);
      this.drawActiveAttackTargetBracket(ctx, guide, color, alpha * 0.78, t);
    }

    if (guide.hitCount > 1) {
      ctx.strokeStyle = this.hexToRgba(color, alpha * 0.24);
      ctx.lineWidth = 2;
      for (let i = 1; i <= Math.min(3, guide.hitCount - 1); i++) {
        const offset = i * 13;
        ctx.beginPath();
        ctx.arc(guide.contact.x - guide.approach * offset, guide.contact.y + (i % 2 === 0 ? -10 : 10), Math.max(10, guide.radius * 0.22), -0.4, Math.PI * 1.2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  drawActiveAttackTargetBracket(ctx, guide, color, alpha, t) {
    const wobble = Math.sin(t * 8 + guide.hitIndex) * 3;
    const radius = guide.isMelee ? guide.radius * 0.45 : guide.radius * 0.38;
    const x = guide.targetPoint.x - guide.approach * (guide.isMelee ? 18 : 0);
    const y = guide.targetPoint.y + wobble * 0.25;
    const guideScale = this.visualScale("impact");
    const glowScale = Utils.clamp(0.35 + guideScale * 0.65, 0.35, 1);

    ctx.save();
    ctx.strokeStyle = this.hexToRgba(color, alpha * (guide.phase === "impact" ? 0.62 : 0.38));
    ctx.fillStyle = this.hexToRgba(color, alpha * 0.04);
    ctx.lineWidth = guide.phase === "impact" ? 3 : 1.6;
    ctx.shadowColor = color;
    ctx.shadowBlur = (guide.phase === "impact" ? 18 : 8) * glowScale;
    ctx.beginPath();
    ctx.arc(x, y, radius, Math.PI * 0.64, Math.PI * 1.36);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, radius + 12, -Math.PI * 0.36, Math.PI * 0.36);
    ctx.stroke();

    if (guide.phase === "reaction" || guide.phase === "impact") {
      ctx.beginPath();
      ctx.ellipse(x, y + 48, radius * 0.70, 9 + wobble * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  drawPlayerProjectileActiveAttack(ctx, attack, descriptor, from, to, pos, color, progress, pulse, t) {
    const profile = attack.profile || {};
    const fire = descriptor.isFire;
    const absorb = descriptor.isAbsorb;
    const radius = (profile.radius || 32) * (fire ? 1.08 : 0.92) * (0.76 + progress * 0.30) * pulse;
    const trailAlpha = fire ? 0.44 : 0.32;
    const core = fire ? "#fff2b0" : (absorb ? "#f1dcff" : "#ffffff");

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = color;
    ctx.shadowBlur = fire ? 30 : 22;

    ctx.strokeStyle = color;
    ctx.lineWidth = fire ? 5 : 3;
    ctx.globalAlpha = trailAlpha;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo((from.x + to.x) / 2, from.y - (fire ? 72 : 38), pos.x, pos.y);
    ctx.stroke();

    if (fire) {
      for (let i = 0; i < 5; i++) {
        const p = Math.max(0, progress - i * 0.045);
        const x = from.x + (pos.x - from.x) * p;
        const y = from.y + (pos.y - from.y) * p - Math.sin(p * Math.PI) * 46;
        ctx.globalAlpha = Math.max(0.06, 0.24 - i * 0.035);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(3, radius * (0.42 - i * 0.045)), 0, Math.PI * 2);
        ctx.fillStyle = i % 2 === 0 ? "#f39c12" : "#e74c3c";
        ctx.fill();
      }
    } else if (absorb) {
      ctx.globalAlpha = 0.38;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const grad = ctx.createRadialGradient(pos.x, pos.y, 2, pos.x, pos.y, radius);
    grad.addColorStop(0, core);
    grad.addColorStop(0.30, color);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (fire) {
      ctx.strokeStyle = "#fff7d6";
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius * 0.72, -t * 3, Math.PI * 1.4 - t * 3);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawPlayerSpellActiveAttack(ctx, attack, descriptor, from, to, pos, color, progress, pulse, t) {
    const profile = attack.profile || {};
    const absorb = descriptor.isAbsorb;
    const width = descriptor.isCounter ? 11 : (absorb ? 9 : 8);
    const wave = Math.sin(t * 20) * 1.8;
    const alpha = attack.phase === "reaction" ? 0.58 : (attack.phase === "recovery" ? 0.42 : 0.86);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = absorb ? 28 : 20;
    ctx.lineCap = "round";

    if (absorb) {
      const sigilR = 20 + Math.sin(t * 7) * 3;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 3;
      this.drawPlayerCastSigil(ctx, from.x, from.y, sigilR, color, t);
      ctx.globalAlpha = 0.22 + progress * 0.34;
      for (let i = 0; i < 3; i++) {
        const offset = (i - 1) * 9;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y + offset);
        ctx.quadraticCurveTo((from.x + to.x) / 2, from.y - 38 + offset * 0.35, pos.x, pos.y + offset * 0.45);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = alpha;
    ctx.lineWidth = width + wave;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo((from.x + to.x) / 2, from.y - (absorb ? 30 : 10), pos.x, pos.y);
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.globalAlpha = alpha * 0.45;
    ctx.lineWidth = Math.max(2, width * 0.24);
    ctx.stroke();

    if (descriptor.isCounter || absorb) {
      ctx.globalAlpha = 0.62;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, (profile.radius || 36) * (0.34 + progress * 0.18) * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawPlayerPulseActiveAttack(ctx, attack, descriptor, from, to, pos, color, progress, pulse, t) {
    const profile = attack.profile || {};
    const radius = (profile.radius || 72) * Math.max(0.16, progress) * pulse;
    const center = descriptor.isAbsorb ? to : pos;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = descriptor.isFire ? 30 : 28;
    ctx.lineCap = "round";

    ctx.globalAlpha = descriptor.isFire ? 0.20 : 0.16;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.42 + progress * 0.30;
    ctx.lineWidth = descriptor.isFire ? 7 : 5;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = t * (descriptor.isFire ? 1.6 : -1.2) + i * Math.PI / 2;
      const inner = radius * 0.38;
      const outer = radius * 0.82;
      ctx.beginPath();
      ctx.moveTo(center.x + Math.cos(a) * inner, center.y + Math.sin(a) * inner);
      ctx.lineTo(center.x + Math.cos(a) * outer, center.y + Math.sin(a) * outer);
      ctx.stroke();
    }

    if (descriptor.isFire) {
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = "#fff2a6";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius * 0.58, Math.PI * 0.15, Math.PI * 1.1);
      ctx.stroke();
    } else if (descriptor.isAbsorb) {
      this.drawPlayerCastSigil(ctx, center.x, center.y, Math.max(18, radius * 0.28), color, -t);
    }

    ctx.restore();
  }

  drawPlayerMeleeActiveAttack(ctx, attack, descriptor, from, to, color, progress, t) {
    if (descriptor.isDual) {
      this.drawDualBladeActiveAttack(ctx, attack, descriptor, from, to, color, progress, t);
      return;
    }
    if (descriptor.isGreatsword || descriptor.isFire) {
      this.drawHeavyBladeActiveAttack(ctx, attack, descriptor, from, to, color, progress, t);
      return;
    }
    this.drawMeleeActiveAttack(ctx, attack, from, to, color, progress, t);
  }

  drawDualBladeActiveAttack(ctx, attack, descriptor, from, to, color, progress, t) {
    const approach = Math.sign(to.x - from.x) || 1;
    const hitIndex = descriptor.hitIndex;
    const hitCount = descriptor.hitCount;
    const swing = Math.sin(progress * Math.PI);
    const dash = 28 * Utils.clamp(progress, 0, 1);
    const afterAlpha = 0.20 + Math.min(0.22, hitCount * 0.035);
    const center = {
      x: to.x - approach * (30 - dash * 0.25),
      y: to.y - 18 + (hitIndex % 2 === 0 ? 11 : -9)
    };

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = descriptor.isFinisher ? 28 : 18;

    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const phase = (hitIndex + i) % 2 === 0 ? -1 : 1;
      ctx.globalAlpha = attack.phase === "recovery" ? 0.30 : 0.76;
      ctx.strokeStyle = i === 0 ? color : "#ffffff";
      ctx.lineWidth = descriptor.isFinisher ? (i === 0 ? 7 : 3) : (i === 0 ? 5 : 2);
      ctx.beginPath();
      ctx.moveTo(center.x - approach * 54, center.y + side * 34);
      ctx.quadraticCurveTo(
        center.x + approach * (8 + swing * 12),
        center.y + side * phase * 3,
        center.x + approach * 62,
        center.y - side * 34
      );
      ctx.stroke();
    }

    if (hitCount > 1 || descriptor.isFinisher) {
      ctx.globalAlpha = afterAlpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      for (let ghost = 1; ghost <= Math.min(3, hitCount); ghost++) {
        const offset = ghost * 12;
        ctx.beginPath();
        ctx.moveTo(center.x - approach * (58 + offset), center.y - 28 + ghost * 6);
        ctx.quadraticCurveTo(center.x - approach * offset, center.y, center.x + approach * (54 - offset), center.y + 26 - ghost * 5);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawHeavyBladeActiveAttack(ctx, attack, descriptor, from, to, color, progress, t) {
    const approach = Math.sign(to.x - from.x) || 1;
    const profile = attack.profile || {};
    const swing = Math.sin(progress * Math.PI);
    const fire = descriptor.isFire;
    const radiusBoost = descriptor.isFinisher || descriptor.isBurst ? 26 : 0;
    const span = (profile.radius || 42) * 2.6 + radiusBoost;
    const center = {
      x: to.x - approach * 40 + approach * swing * 12,
      y: to.y - 16
    };

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = fire ? 30 : 22;
    ctx.globalAlpha = attack.phase === "recovery" ? 0.42 : 0.88;
    ctx.lineWidth = fire ? 12 : 10;

    ctx.beginPath();
    ctx.moveTo(center.x - approach * span * 0.40, center.y - 58);
    ctx.quadraticCurveTo(center.x + approach * 10, center.y - 12 - swing * 22, center.x + approach * span * 0.52, center.y + 48);
    ctx.stroke();

    if (fire) {
      ctx.strokeStyle = "#fff1a8";
      ctx.globalAlpha = 0.50;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(center.x - approach * span * 0.34, center.y - 50);
      ctx.quadraticCurveTo(center.x + approach * 18, center.y - 6 - swing * 16, center.x + approach * span * 0.45, center.y + 38);
      ctx.stroke();
      ctx.fillStyle = "#e74c3c";
      ctx.globalAlpha = 0.24;
      for (let i = 0; i < 4; i++) {
        const p = i / 3;
        const x = center.x - approach * span * 0.30 + approach * span * 0.72 * p;
        const y = center.y - 44 + 88 * p + Math.sin(t * 8 + i) * 6;
        ctx.beginPath();
        ctx.arc(x, y, 7 - i, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (descriptor.isGreatsword && (descriptor.isFinisher || descriptor.text.includes("earthsplit"))) {
      ctx.strokeStyle = "#f1c40f";
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(to.x - 64, to.y + 26);
      ctx.lineTo(to.x + 64, to.y + 18);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawPlayerCastSigil(ctx, x, y, radius, color, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.72);
    ctx.lineTo(radius * 0.62, radius * 0.36);
    ctx.lineTo(-radius * 0.62, radius * 0.36);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(2, radius * 0.12), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawMeleeActiveAttack(ctx, attack, from, to, color, progress, t) {
    const profile = attack.profile || {};
    const approach = Math.sign(to.x - from.x) || (attack.source === "enemy" ? -1 : 1);
    const hitIndex = Math.max(1, attack.intent.hitIndex || 1);
    const hitCount = Math.max(1, attack.intent.hitCount || 1);
    const alternate = hitIndex % 2 === 0 ? -1 : 1;
    const wind = Utils.clamp(progress, 0, 1);
    const swing = Math.sin(wind * Math.PI);
    const heavy = (profile.radius || 0) > 38 || String(attack.intent.weapon || "").includes("greatsword");
    const sourceAttack = attack.intent && attack.intent.attack ? attack.intent.attack : null;
    const telegraph = sourceAttack && sourceAttack.telegraph ? sourceAttack.telegraph : {};
    const meleeType = telegraph.type || (heavy ? "smash" : "slash");
    const span = (heavy ? 124 : 92) + Math.min(18, hitCount * 4);
    const center = {
      x: to.x - approach * (heavy ? 34 : 28) + approach * swing * 8,
      y: to.y - (heavy ? 10 : 18) + alternate * (hitCount > 1 ? 7 : 0)
    };
    const enemyMelee = attack.source === "enemy";
    const hand = {
      x: from.x + approach * (enemyMelee ? 36 : 28),
      y: from.y - (enemyMelee ? 34 : 40) + alternate * 4
    };

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (attack.phase === "startup") {
      const glow = 10 + Math.sin(t * 14 + hitIndex) * 3;
      ctx.globalAlpha = enemyMelee ? 0.28 : 0.45;
      ctx.strokeStyle = color;
      ctx.lineWidth = enemyMelee ? (heavy ? 4 : 2.5) : (heavy ? 6 : 4);
      ctx.shadowColor = color;
      ctx.shadowBlur = enemyMelee ? 7 : 14;
      ctx.beginPath();
      ctx.moveTo(hand.x - approach * 18, hand.y - 12 * alternate);
      ctx.quadraticCurveTo(hand.x + approach * 12, hand.y - 6 * alternate, hand.x + approach * 34, hand.y + 14 * alternate);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hand.x + approach * 22, hand.y - 4 * alternate, glow * (enemyMelee ? 0.75 : 1), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      return;
    }

    const alpha = attack.phase === "recovery" ? 0.48 : (attack.phase === "reaction" ? 0.72 : 0.92);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = attack.phase === "impact" || attack.resolved ? (heavy ? 10 : 8) : (heavy ? 7 : 5);
    ctx.shadowColor = color;
    ctx.shadowBlur = attack.phase === "impact" || attack.resolved ? 26 : 18;

    if (meleeType === "stab" || meleeType === "bash") {
      const length = meleeType === "bash" ? 74 : 102;
      const y = center.y - (meleeType === "bash" ? 2 : 18);
      const startX = center.x + approach * length * 0.42;
      const endX = center.x - approach * length * 0.45;
      ctx.lineWidth = meleeType === "bash" ? 12 : (attack.phase === "impact" || attack.resolved ? 7 : 5);
      ctx.beginPath();
      ctx.moveTo(startX, y - alternate * 10);
      ctx.lineTo(endX, y + alternate * 6);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.45;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(startX + approach * 10, y - alternate * 14);
      ctx.lineTo(endX - approach * 8, y + alternate * 2);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
    } else if (meleeType === "smash") {
      ctx.beginPath();
      ctx.moveTo(center.x + approach * 42, center.y - 86);
      ctx.quadraticCurveTo(center.x + approach * 10, center.y - 26 - swing * 22, center.x - approach * 30, center.y + 38);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.32;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(center.x - approach * 28, center.y + 56, 42, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = alpha;
    } else {
      ctx.beginPath();
      ctx.moveTo(center.x - approach * span * 0.38, center.y - alternate * 48);
      ctx.quadraticCurveTo(
        center.x + approach * span * 0.05,
        center.y - alternate * 8 - swing * 16,
        center.x + approach * span * 0.48,
        center.y + alternate * 40
      );
      ctx.stroke();
    }

    if (hitCount > 1) {
      ctx.globalAlpha = alpha * 0.38;
      ctx.lineWidth = Math.max(2, ctx.lineWidth - 3);
      ctx.beginPath();
      ctx.moveTo(center.x - approach * span * 0.30, center.y + alternate * 34);
      ctx.quadraticCurveTo(center.x + approach * span * 0.10, center.y + alternate * 2, center.x + approach * span * 0.38, center.y - alternate * 36);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  getBattleAnchor(anchor) {
    if (this.currentScene && this.currentScene.resolveBattleAnchor) {
      return this.currentScene.resolveBattleAnchor(anchor);
    }
    const py = this.height - 190;
    const ey = this.height - 190;
    const anchors = {
      playerCore: { x: 220, y: py },
      playerHand: { x: 270, y: py - 40 },
      playerShield: { x: 222, y: py - 5 },
      enemyCore: { x: this.width - 220, y: ey },
      enemyChest: { x: this.width - 220, y: ey - 34 },
      midpoint: { x: this.width / 2, y: py }
    };
    return anchors[anchor] || anchors.midpoint;
  }

  drawHitConfirmOverlays(scene) {
    if (!scene || !scene.showHitConfirmOverlay) return;
    if (!scene.hitConfirmSystem || !Array.isArray(scene.hitConfirmSystem.active)) return;
    const hits = scene.hitConfirmSystem.active;
    if (hits.length === 0) return;

    const ctx = this.ctx;
    ctx.save();
    for (const hit of hits) {
      const lifeRatio = hit.maxLife ? Utils.clamp(hit.life / hit.maxLife, 0, 1) : 1;
      const phaseMul = hit.phase === "active" ? 1 : (hit.phase === "startup" ? 0.55 : 0.38);
      const alpha = Math.max(0.05, Math.min(0.42, lifeRatio * phaseMul));
      const color = hit.confirmed ? "#2ecc71" : (hit.duplicate ? "#95a5a6" : "#e67e22");

      if (hit.hitbox) {
        this.drawHitboxShape(ctx, hit.hitbox, color, alpha);
      }
      if (hit.hurtbox && hit.phase === "active") {
        this.drawHurtboxShape(ctx, hit.hurtbox, hit.confirmed ? "#ffffff" : color, alpha * 0.65);
      }
    }
    ctx.restore();
  }

  getCombatContactEvents(scene) {
    const system = scene && scene.hitConfirmSystem;
    if (!system || !Array.isArray(system.active)) return [];

    return system.active.map(hit => {
      if (!hit || !hit.hurtbox || !hit.hitbox) return null;
      const maxLife = hit.maxLife || 1;
      const lifeRatio = Utils.clamp((hit.life ?? maxLife) / maxLife, 0, 1);
      if (lifeRatio <= 0.02) return null;

      const hurtbox = hit.hurtbox;
      const center = hurtbox.anchor || {
        x: hurtbox.x + (hurtbox.w || 0) / 2,
        y: hurtbox.y + (hurtbox.h || 0) / 2
      };
      const direction = this.getContactDirection(hit);
      const width = hurtbox.w || (hit.target === "player" ? 70 : 90);
      const height = hurtbox.h || (hit.target === "player" ? 110 : 130);
      const progress = 1 - lifeRatio;
      const confirmed = !!(hit.confirmed && !hit.duplicate && hit.overlap);
      const profile = hit.profile || {};
      const kind = profile.kind || hit.hitbox.kind || hit.shape || "arc";
      const color = profile.color || (confirmed ? "#f1c40f" : "#95a5a6");
      const force = Utils.clamp((profile.impactForce || 1) + (hit.damage || 0) / 120, 0.65, 1.95);
      const radius = Utils.clamp(18 + (profile.width || 42) * 0.32 + (hit.damage || 0) * 0.24, 22, 78);

      return {
        id: hit.id || hit.token || "",
        source: hit.source || "system",
        target: hit.target,
        label: hit.label || "",
        confirmed,
        duplicate: !!hit.duplicate,
        overlap: !!hit.overlap,
        kind,
        color,
        force,
        radius,
        damage: hit.damage || 0,
        direction,
        lifeRatio,
        progress,
        alpha: confirmed ? 0.92 * lifeRatio : 0.42 * lifeRatio,
        impact: {
          x: center.x - direction * width * 0.32,
          y: center.y - height * 0.12 - Math.sin(progress * Math.PI) * 7
        },
        body: {
          x: center.x,
          y: center.y,
          w: width,
          h: height
        },
        ground: {
          x: center.x - direction * 8,
          y: Math.min(this.height - 72, center.y + height * 0.42)
        }
      };
    }).filter(Boolean);
  }

  getContactDirection(hit) {
    const points = hit && hit.hitbox && hit.hitbox.points;
    const start = points && points.length > 0 ? points[0] : (hit.hitbox && hit.hitbox.start);
    const end = points && points.length > 1 ? points[points.length - 1] : (hit.hitbox && hit.hitbox.end);
    if (start && end && Math.abs(end.x - start.x) > 0.01) {
      return Math.sign(end.x - start.x);
    }
    return hit && hit.target === "enemy" ? 1 : -1;
  }

  drawCombatContactLayer(scene, t) {
    const contacts = this.getCombatContactEvents(scene);
    if (contacts.length === 0) return;

    const ctx = this.ctx;
    ctx.save();
    const limit = scene && scene.turnState === "enemy_turn" ? 2 : 5;
    for (const contact of contacts.slice(0, limit).reverse()) {
      if (this.visualLayerEnabled(scene, "contactGroundImpulses")) {
        this.drawContactGroundImpulse(ctx, contact, t);
      }
      if (contact.confirmed) {
        this.drawContactBodyImpact(ctx, contact, t);
      } else if (this.visualLayerEnabled(scene, "contactWhiffs")) {
        this.drawContactWhiff(ctx, contact, t);
      }
    }
    ctx.restore();
  }

  drawContactGroundImpulse(ctx, contact, t) {
    const impactScale = this.visualScale("impact");
    const alpha = contact.alpha * (contact.confirmed ? 0.40 : 0.18) * impactScale;
    if (alpha <= 0.02) return;
    const p = this.easeOutCubic(contact.progress);
    const heavy = contact.force > 1.18 || contact.radius > 52;
    const color = contact.confirmed ? contact.color : "#95a5a6";

    ctx.save();
    ctx.translate(contact.ground.x, contact.ground.y);
    ctx.scale(1 + p * 0.55, 1 + p * 0.18);
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = this.hexToRgba(color, 0.08);
    ctx.strokeStyle = this.hexToRgba(color, 0.38);
    ctx.shadowColor = color;
    ctx.shadowBlur = heavy ? 9 : 5;
    ctx.lineWidth = heavy ? 3 : 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, contact.radius * 1.15, Math.max(7, contact.radius * 0.22), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (contact.confirmed && heavy) {
      ctx.globalAlpha = alpha * 0.52;
      ctx.shadowBlur = 4;
      ctx.lineCap = "round";
      for (let i = 0; i < 3; i++) {
        const side = i - 1;
        const len = contact.radius * (0.42 + i * 0.05);
        const x0 = side * contact.radius * 0.18;
        ctx.beginPath();
        ctx.moveTo(x0, 0);
        ctx.lineTo(x0 + contact.direction * len, 8 + Math.abs(side) * 4);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  drawContactBodyImpact(ctx, contact, t) {
    const impactScale = this.visualScale("impact");
    const alpha = contact.alpha * impactScale;
    if (alpha <= 0.03) return;
    const p = this.easeOutCubic(contact.progress);
    const isBeam = contact.kind === "beam" || contact.kind === "spell" || contact.kind === "projectile";
    const radius = contact.radius * (isBeam ? (0.62 + p * 0.30) : (0.44 + p * 0.22));
    const streak = contact.radius * (isBeam ? 0.85 : 1.05) * (0.82 + contact.force * 0.18);

    ctx.save();
    ctx.translate(contact.impact.x, contact.impact.y);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    ctx.shadowColor = contact.color;
    ctx.shadowBlur = isBeam ? 9 : 6;

    if (!isBeam) {
      const compactAlpha = alpha * 0.58;
      const spark = Utils.clamp(contact.radius * 0.10, 3, 7);
      const slash = Utils.clamp(streak * 0.36, 22, 42);
      ctx.globalAlpha = compactAlpha;
      ctx.shadowBlur = 4;
      ctx.lineCap = "round";

      ctx.strokeStyle = this.hexToRgba("#ffffff", 0.68);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-contact.direction * slash * 0.50, -5);
      ctx.lineTo(contact.direction * slash * 0.44, 5);
      ctx.stroke();

      ctx.strokeStyle = this.hexToRgba(contact.color, 0.42);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-contact.direction * slash * 0.26, 7);
      ctx.lineTo(contact.direction * slash * 0.20, -6);
      ctx.stroke();

      ctx.fillStyle = this.hexToRgba("#ffffff", 0.58);
      ctx.beginPath();
      ctx.arc(0, 0, spark, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, radius);
    grad.addColorStop(0, this.hexToRgba("#ffffff", 0.42));
    grad.addColorStop(0.32, this.hexToRgba(contact.color, isBeam ? 0.22 : 0.16));
    grad.addColorStop(1, this.hexToRgba(contact.color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = "round";
    ctx.strokeStyle = this.hexToRgba("#ffffff", 0.64);
    ctx.lineWidth = isBeam ? 2 : 3;
    ctx.beginPath();
    ctx.moveTo(-contact.direction * streak * 0.48, -8);
    ctx.lineTo(contact.direction * streak * 0.42, 7);
    ctx.stroke();

    ctx.strokeStyle = this.hexToRgba(contact.color, 0.38);
    ctx.lineWidth = isBeam ? 2 : 2.4;
    const spokes = isBeam ? 4 : 3;
    for (let i = 0; i < spokes; i++) {
      const angle = (i / spokes) * Math.PI * 2 + t * 0.25;
      const inner = radius * 0.24;
      const outer = radius * (0.78 + ((i % 3) * 0.09));
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }

    if (isBeam) {
      ctx.strokeStyle = this.hexToRgba(contact.color, 0.34);
      ctx.lineWidth = 2;
      for (let i = 0; i < 1; i++) {
        const r = radius * (0.78 + i * 0.34 + p * 0.22);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  drawContactWhiff(ctx, contact, t) {
    const alpha = contact.alpha * 0.42 * this.visualScale("impact");
    if (alpha <= 0.02) return;
    const p = this.easeOutCubic(contact.progress);

    ctx.save();
    ctx.translate(contact.impact.x, contact.impact.y);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.hexToRgba("#95a5a6", 0.45);
    ctx.shadowColor = "#95a5a6";
    ctx.shadowBlur = 4;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, contact.radius * (0.72 + p * 0.35), -0.6 + t * 0.2, Math.PI * 1.25 + t * 0.2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawHitboxShape(ctx, hitbox, color, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;

    if (hitbox.shape === "trail") {
      const points = hitbox.points || [hitbox.start, hitbox.end].filter(Boolean);
      if (points.length >= 2) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = alpha * 0.26;
        ctx.lineWidth = hitbox.width || 36;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();

        ctx.globalAlpha = alpha * 0.85;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
      }
    } else if (hitbox.shape === "circle") {
      ctx.globalAlpha = alpha * 0.18;
      ctx.beginPath();
      ctx.arc(hitbox.x, hitbox.y, hitbox.r || hitbox.radius || 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha * 0.8;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      const rect = {
        x: hitbox.x,
        y: hitbox.y,
        w: hitbox.w || hitbox.width || 0,
        h: hitbox.h || hitbox.height || 0
      };
      ctx.globalAlpha = alpha * 0.16;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.globalAlpha = alpha * 0.75;
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
  }

  drawHurtboxShape(ctx, hurtbox, color, alpha) {
    if (!hurtbox) return;
    const rect = {
      x: hurtbox.x,
      y: hurtbox.y,
      w: hurtbox.w || hurtbox.width || 0,
      h: hurtbox.h || hurtbox.height || 0
    };
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }

  drawEnemyAttackMotion(ctx, scene, px, py, ex, ey, t) {
    const attack = scene.enemyAttack;
    if (!attack) return;
    const color = attack.color || "#e74c3c";
    const phase = scene.enemyAttackPhase;
    const telegraph = this.getEnemyTelegraph(attack);
    const totalTime = Math.max(0.1, attack.windup + attack.hitTime);
    const progress = Utils.clamp(scene.enemyAttackTimer / totalTime, 0, 1);

    if (phase === "windup" || phase === "response") {
      if (this.visualLayerEnabled(scene, "enemyTelegraphLane")) {
        this.drawEnemyTelegraphLane(ctx, telegraph, phase, color, px, py, ex, ey, progress, t);
      }
      return;
    }

    if (phase === "hit") {
      if (this.isMeleeTelegraph(telegraph) && !this.visualLayerEnabled(scene, "enemyTelegraphLane")) return;
      this.drawEnemyTelegraphHit(ctx, telegraph, color, px, py, ex, ey, progress, t);
    }
  }

  getEnemyTelegraph(attack) {
    if (!attack) {
      return {
        type: "strike",
        shape: "line",
        pose: "lunge",
        width: 30
      };
    }

    if (attack.telegraph) {
      return {
        type: attack.telegraph.type || "strike",
        shape: attack.telegraph.shape || "line",
        pose: attack.telegraph.pose || "lunge",
        width: attack.telegraph.width || 30
      };
    }

    const id = String(attack.id || "").toLowerCase();
    if (id.includes("curse")) return { type: "burst", shape: "circle", pose: "cast", width: 76 };
    if (id.includes("arcane")) return { type: "bolt", shape: "line", pose: "cast", width: 30 };
    if (this.isSpellLikeAttack(attack)) return { type: "spell", shape: "glyph", pose: "cast", width: 44 };
    if (id.includes("shield")) return { type: "bash", shape: "cone", pose: "bash", width: 58 };
    if (id.includes("heavy")) return { type: "smash", shape: "circle", pose: "overhead", width: 68 };
    if (id.includes("slash")) return { type: "slash", shape: "arc", pose: "sweep", width: 42 };
    return { type: "stab", shape: "line", pose: "lunge", width: 24 };
  }

  isMeleeTelegraph(telegraph) {
    return !!(telegraph && ["stab", "slash", "smash", "bash"].includes(telegraph.type));
  }

  getEnemyTelegraphPoints(px, py, ex, ey) {
    return {
      source: { x: ex - 52, y: ey - 34 },
      target: { x: px + 42, y: py - 12 },
      enemyCast: { x: ex - 70, y: ey - 36 },
      playerFoot: { x: px + 34, y: py + 20 }
    };
  }

  drawEnemyTelegraphLane(ctx, telegraph, phase, color, px, py, ex, ey, progress, t) {
    const points = this.getEnemyTelegraphPoints(px, py, ex, ey);
    const { source, target, enemyCast, playerFoot } = points;
    const response = phase === "response";
    const pulse = 0.72 + Math.sin(t * 10) * 0.18;
    const alpha = (response ? 0.46 : 0.24) * pulse;
    const width = telegraph.width || 32;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = response ? 20 : 11;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (this.isMeleeTelegraph(telegraph)) {
      this.drawEnemyMeleeTelegraphLane(ctx, telegraph, color, points, response, alpha, width, pulse, t);
      ctx.restore();
      return;
    }

    if (telegraph.shape === "arc") {
      const r = 54 + width * 0.36;
      ctx.globalAlpha = alpha * 0.70;
      ctx.lineWidth = response ? 8 : 4;
      ctx.setLineDash(response ? [18, 10] : [8, 10]);
      ctx.beginPath();
      ctx.arc(target.x + 2, target.y + 4, r, Math.PI * 0.58, Math.PI * 1.38);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = alpha * 0.30;
      ctx.beginPath();
      ctx.arc(target.x, target.y + 4, r + 18, Math.PI * 0.60, Math.PI * 1.35);
      ctx.stroke();
    } else if (telegraph.shape === "circle") {
      const radius = 34 + width * 0.48 + Math.sin(t * 8) * 3;
      ctx.globalAlpha = alpha * 0.28;
      ctx.beginPath();
      ctx.arc(playerFoot.x, playerFoot.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha * 0.92;
      ctx.lineWidth = response ? 5 : 3;
      ctx.setLineDash(response ? [14, 7] : [6, 9]);
      ctx.beginPath();
      ctx.arc(playerFoot.x, playerFoot.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playerFoot.x - radius * 0.72, playerFoot.y);
      ctx.lineTo(playerFoot.x + radius * 0.72, playerFoot.y);
      ctx.moveTo(playerFoot.x, playerFoot.y - radius * 0.72);
      ctx.lineTo(playerFoot.x, playerFoot.y + radius * 0.72);
      ctx.stroke();
    } else if (telegraph.shape === "cone") {
      const angle = Math.atan2(target.y - source.y, target.x - source.x);
      const length = Math.hypot(target.x - source.x, target.y - source.y);
      const spread = 0.18 + width / 520;
      const left = {
        x: source.x + Math.cos(angle - spread) * length,
        y: source.y + Math.sin(angle - spread) * length
      };
      const right = {
        x: source.x + Math.cos(angle + spread) * length,
        y: source.y + Math.sin(angle + spread) * length
      };
      ctx.globalAlpha = alpha * 0.18;
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = alpha * 0.82;
      ctx.lineWidth = response ? 5 : 3;
      ctx.setLineDash(response ? [18, 8] : [7, 10]);
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(left.x, left.y);
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(right.x, right.y);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (telegraph.shape === "glyph") {
      ctx.globalAlpha = alpha * 0.90;
      ctx.lineWidth = response ? 4 : 2;
      this.drawEnemyGlyph(ctx, enemyCast.x, enemyCast.y, 24 + Math.sin(t * 7) * 4, color, t);
      ctx.globalAlpha = alpha * 0.42;
      ctx.setLineDash(response ? [12, 8] : [4, 10]);
      ctx.beginPath();
      ctx.moveTo(enemyCast.x, enemyCast.y);
      ctx.quadraticCurveTo((enemyCast.x + target.x) / 2, target.y - 92, target.x, target.y);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const isBolt = telegraph.type === "bolt";
      const laneWidth = response ? Math.max(5, width * 0.22) : Math.max(3, width * 0.14);
      ctx.globalAlpha = alpha * 0.30;
      ctx.lineWidth = Math.max(10, width);
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.92;
      ctx.lineWidth = laneWidth;
      ctx.setLineDash(response ? [16, 8] : [6, 10]);
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.setLineDash([]);

      if (isBolt) {
        for (let i = 0; i < 4; i++) {
          const p = (i + 0.25 + (t * 0.42) % 1) / 4;
          const x = source.x + (target.x - source.x) * p;
          const y = source.y + (target.y - source.y) * p + Math.sin(t * 8 + i) * 8;
          ctx.globalAlpha = alpha * 0.75;
          ctx.beginPath();
          ctx.arc(x, y, 4 + response * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  drawEnemyMeleeTelegraphLane(ctx, telegraph, color, points, response, alpha, width, pulse, t) {
    const { source, target, playerFoot } = points;
    const dir = source.x > target.x ? 1 : -1;
    const type = telegraph.type || "stab";
    const laneAlpha = response ? alpha : alpha * 0.86;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = response ? 18 : 8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (type === "stab") {
      const startX = target.x + dir * (76 + width * 0.28);
      const endX = target.x + dir * (18 + width * 0.10);
      const y = target.y - 5;
      ctx.globalAlpha = laneAlpha * 0.18;
      ctx.lineWidth = response ? 14 : 9;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y + Math.sin(t * 8) * 2);
      ctx.stroke();
      ctx.globalAlpha = laneAlpha * 0.86;
      ctx.lineWidth = response ? 4 : 2;
      ctx.setLineDash(response ? [12, 7] : [5, 9]);
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(endX, y, response ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (type === "bash") {
      const originX = target.x + dir * (82 + width * 0.18);
      const originY = target.y + 18;
      const innerX = target.x + dir * 20;
      ctx.globalAlpha = laneAlpha * 0.14;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(innerX, target.y - 20);
      ctx.lineTo(innerX, target.y + 48);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = laneAlpha * 0.78;
      ctx.lineWidth = response ? 5 : 3;
      ctx.setLineDash(response ? [13, 7] : [6, 9]);
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(innerX, target.y - 20);
      ctx.moveTo(originX, originY);
      ctx.lineTo(innerX, target.y + 48);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    if (type === "smash") {
      const radius = 34 + width * 0.42 + Math.sin(t * 8) * 3;
      ctx.globalAlpha = laneAlpha * 0.20;
      ctx.beginPath();
      ctx.arc(playerFoot.x, playerFoot.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = laneAlpha * 0.88;
      ctx.lineWidth = response ? 5 : 3;
      ctx.setLineDash(response ? [12, 7] : [6, 9]);
      ctx.beginPath();
      ctx.arc(playerFoot.x, playerFoot.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    const r = 52 + width * 0.34;
    const cx = target.x + dir * 8;
    const cy = target.y + 5;
    ctx.globalAlpha = laneAlpha * 0.76;
    ctx.lineWidth = response ? 8 : 4;
    ctx.setLineDash(response ? [16, 9] : [7, 10]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.58, Math.PI * 1.38);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = laneAlpha * 0.24;
    ctx.lineWidth = response ? 5 : 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 16 * pulse, Math.PI * 0.60, Math.PI * 1.35);
    ctx.stroke();
  }

  drawEnemyTelegraphHit(ctx, telegraph, color, px, py, ex, ey, progress, t) {
    const points = this.getEnemyTelegraphPoints(px, py, ex, ey);
    const { source, target, enemyCast, playerFoot } = points;
    const alpha = Math.max(0.22, 1 - progress * 0.72);
    const width = telegraph.width || 32;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.globalAlpha = alpha;

    if (this.isMeleeTelegraph(telegraph)) {
      this.drawEnemyMeleeTelegraphHit(ctx, telegraph, color, points, alpha, width, progress, t);
      ctx.restore();
      return;
    }

    if (telegraph.shape === "arc") {
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.arc(target.x + 8, target.y + 4, 58 + width * 0.35, Math.PI * 0.54, Math.PI * 1.34);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.globalAlpha = alpha * 0.58;
      ctx.stroke();
    } else if (telegraph.shape === "circle") {
      const radius = 36 + width * 0.62 + progress * 28;
      ctx.globalAlpha = alpha * 0.20;
      ctx.beginPath();
      ctx.arc(playerFoot.x, playerFoot.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(playerFoot.x, playerFoot.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.globalAlpha = alpha * 0.60;
      ctx.stroke();
    } else if (telegraph.shape === "cone") {
      const angle = Math.atan2(target.y - source.y, target.x - source.x);
      const length = Math.hypot(target.x - source.x, target.y - source.y);
      const spread = 0.20 + width / 480;
      const hit = {
        x: source.x + Math.cos(angle) * length,
        y: source.y + Math.sin(angle) * length
      };
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(hit.x, hit.y);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.34;
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(source.x + Math.cos(angle - spread) * length, source.y + Math.sin(angle - spread) * length);
      ctx.lineTo(source.x + Math.cos(angle + spread) * length, source.y + Math.sin(angle + spread) * length);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.globalAlpha = alpha * 0.56;
      ctx.stroke();
    } else if (telegraph.shape === "glyph" || telegraph.type === "bolt") {
      ctx.lineWidth = telegraph.type === "bolt" ? 8 : 10;
      ctx.beginPath();
      ctx.moveTo(enemyCast.x, enemyCast.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.globalAlpha = alpha * 0.58;
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.84;
      ctx.beginPath();
      ctx.arc(target.x, target.y, telegraph.type === "bolt" ? 16 : 24, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.lineWidth = Math.max(7, width * 0.34);
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.globalAlpha = alpha * 0.58;
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.82;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 12 + Math.sin(t * 20) * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawEnemyMeleeTelegraphHit(ctx, telegraph, color, points, alpha, width, progress, t) {
    const { source, target, playerFoot } = points;
    const dir = source.x > target.x ? 1 : -1;
    const type = telegraph.type || "stab";

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (type === "stab") {
      ctx.lineWidth = Math.max(7, width * 0.30);
      ctx.beginPath();
      ctx.moveTo(target.x + dir * (74 + progress * 10), target.y - 5);
      ctx.lineTo(target.x + dir * 12, target.y - 5);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.globalAlpha = alpha * 0.58;
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.82;
      ctx.beginPath();
      ctx.arc(target.x + dir * 10, target.y - 5, 11 + Math.sin(t * 20) * 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (type === "bash") {
      const originX = target.x + dir * (82 + progress * 16);
      const originY = target.y + 18;
      const innerX = target.x + dir * 14;
      ctx.globalAlpha = alpha * 0.28;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(innerX, target.y - 22);
      ctx.lineTo(innerX, target.y + 50);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(innerX, target.y + 10);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.globalAlpha = alpha * 0.56;
      ctx.stroke();
      return;
    }

    if (type === "smash") {
      const radius = 34 + width * 0.58 + progress * 20;
      ctx.globalAlpha = alpha * 0.18;
      ctx.beginPath();
      ctx.arc(playerFoot.x, playerFoot.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(playerFoot.x, playerFoot.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.globalAlpha = alpha * 0.60;
      ctx.stroke();
      return;
    }

    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.arc(target.x + dir * 8, target.y + 4, 58 + width * 0.32, Math.PI * 0.54, Math.PI * 1.34);
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.globalAlpha = alpha * 0.58;
    ctx.stroke();
  }

  getEnemyChainIntentVisuals(scene) {
    const chain = scene && scene.enemyAttackChain;
    const activeSystem = scene && scene.activeAttackSystem;
    if (!chain || !Array.isArray(chain.nodes) || chain.nodes.length <= 1 || !activeSystem || !Array.isArray(activeSystem.active)) {
      return { active: false };
    }

    const chainId = chain.id || "";
    const chainAttacks = activeSystem.active
      .filter(attack => attack && !attack.completed && attack.source === "enemy" && attack.target === "player" && attack.intent && attack.intent.chainId === chainId)
      .sort((a, b) => {
        const ai = a.intent.chainIndex ?? 999;
        const bi = b.intent.chainIndex ?? 999;
        if (ai !== bi) return ai - bi;
        return (a.profile && a.profile.impactTime || 0) - (b.profile && b.profile.impactTime || 0);
      });
    if (chainAttacks.length === 0) return { active: false };

    const count = Math.max(chain.nodes.length, ...chainAttacks.map(attack => (attack.intent.chainCount || 0)));
    const rows = [];
    for (let i = 0; i < count; i++) {
      const node = chain.nodes[i] || {};
      const attack = chainAttacks.find(item => (item.intent.chainIndex ?? -1) === i) || null;
      const sourceAttack = attack && attack.intent ? (attack.intent.attack || {}) : {};
      const profile = attack && attack.profile ? attack.profile : {};
      const impactTime = Math.max(0.001, profile.impactTime || ((sourceAttack.windup || 0) + (sourceAttack.hitTime || 0.18)));
      const reactionStart = Math.max(0, profile.reactionStart || Math.max(0, impactTime - (sourceAttack.responseDuration || 0.4)));
      const elapsed = attack ? Math.max(0, attack.elapsed || 0) : 0;
      const timeToImpact = impactTime - elapsed;
      const phase = !attack ? "queued" : (attack.canceled ? "canceled" : (attack.resolved ? "resolved" : attack.phase));
      const telegraph = this.getEnemyTelegraph(sourceAttack);
      const hot = phase === "reaction" || phase === "impact";
      const pending = !!attack && !attack.resolved && !attack.canceled && elapsed < impactTime;
      rows.push({
        index: i,
        nodeId: node.id || (sourceAttack.chainNodeId || `${i + 1}`),
        attackId: sourceAttack.id || node.attackId || "",
        phase,
        hot,
        pending,
        resolved: phase === "resolved" || phase === "canceled",
        progress: Utils.clamp(elapsed / impactTime, 0, 1),
        responseProgress: Utils.clamp((elapsed - reactionStart) / Math.max(0.001, impactTime - reactionStart), 0, 1),
        timeToImpact,
        color: sourceAttack.color || (attack && attack.profile && attack.profile.color) || "#e74c3c",
        type: telegraph.type || "strike",
        shape: telegraph.shape || "line",
        pose: telegraph.pose || "lunge",
        width: telegraph.width || 30
      });
    }

    const current = rows.find(row => row.hot)
      || rows.find(row => row.pending)
      || rows.find(row => !row.resolved)
      || rows[rows.length - 1];
    const nextRows = rows.filter(row => !row.resolved && row.index >= (current ? current.index : 0));
    const primaryColor = current && current.color ? current.color : (chainAttacks[0].profile && chainAttacks[0].profile.color) || "#e74c3c";

    return {
      active: true,
      chainId,
      name: chain.name || chainId,
      icon: chain.icon || "連",
      count,
      currentIndex: current ? current.index : 0,
      color: primaryColor,
      rows,
      nextCount: nextRows.length,
      progress: current ? current.progress : 0
    };
  }

  drawEnemyChainIntentLayer(ctx, visuals, t) {
    if (!visuals || !visuals.active || !Array.isArray(visuals.rows) || visuals.rows.length <= 1) return;

    const enemyX = this.width - 220;
    const enemyY = this.height - 190;
    const playerX = 220;
    const playerY = this.height - 190;
    const railX = this.width - 122;
    const centerY = enemyY - 82;
    const spacing = visuals.rows.length <= 2 ? 36 : 30;
    const startY = centerY - (visuals.rows.length - 1) * spacing / 2;
    const primary = visuals.color || "#e74c3c";

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    ctx.strokeStyle = this.hexToRgba(primary, 0.16);
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 9]);
    ctx.beginPath();
    for (let i = 0; i < visuals.rows.length; i++) {
      const y = startY + i * spacing;
      if (i === 0) ctx.moveTo(railX, y);
      else ctx.lineTo(railX, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    for (const row of visuals.rows) {
      const y = startY + row.index * spacing;
      const hot = row.index === visuals.currentIndex || row.hot;
      const resolved = row.resolved;
      const pending = row.pending && !resolved;
      const color = row.color || primary;
      const pulse = hot ? (0.82 + Math.sin(t * 10 + row.index) * 0.18) : 0.68;
      const alpha = resolved ? 0.18 : (hot ? 0.70 * pulse : (pending ? 0.34 : 0.22));
      const radius = hot ? 12 : 8;
      const pipX = railX + (hot ? Math.sin(t * 8) * 2 : 0);

      if (!resolved && !this.isMeleeTelegraph(row)) {
        const routeAlpha = hot ? 0.18 : 0.08;
        ctx.save();
        ctx.globalAlpha = routeAlpha;
        ctx.strokeStyle = this.hexToRgba(color, 0.92);
        ctx.shadowColor = color;
        ctx.shadowBlur = hot ? 18 : 8;
        ctx.lineWidth = hot ? 7 : 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        const midX = enemyX - 132 - row.index * 16;
        const midY = enemyY - 112 + row.index * 16;
        ctx.moveTo(enemyX - 42, enemyY - 38 + (row.index - 1) * 6);
        ctx.quadraticCurveTo(midX, midY, playerX + 42, playerY - 12 + (row.index - 1) * 8);
        ctx.stroke();
        if (hot) {
          const head = Utils.clamp(row.progress || 0, 0, 1);
          const hx = enemyX - 42 + (playerX + 42 - (enemyX - 42)) * head;
          const hy = enemyY - 38 + (playerY - 12 - (enemyY - 38)) * head - Math.sin(head * Math.PI) * (52 - row.index * 5);
          ctx.globalAlpha = 0.48;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(hx, hy, 5 + pulse * 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.save();
      ctx.translate(pipX, y);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = color;
      ctx.shadowBlur = hot ? 18 : 8;
      ctx.strokeStyle = color;
      ctx.fillStyle = this.hexToRgba(color, hot ? 0.22 : 0.10);
      ctx.lineWidth = hot ? 3 : 2;
      ctx.beginPath();
      if (row.shape === "circle") {
        ctx.arc(0, 0, radius + (hot ? Math.sin(t * 8) * 2 : 0), 0, Math.PI * 2);
      } else if (row.shape === "cone") {
        ctx.moveTo(-radius, -radius * 0.72);
        ctx.lineTo(radius * 1.18, 0);
        ctx.lineTo(-radius, radius * 0.72);
        ctx.closePath();
      } else if (row.shape === "arc") {
        ctx.arc(0, 0, radius + 2, Math.PI * 0.22, Math.PI * 1.58);
      } else {
        ctx.moveTo(-radius, 0);
        ctx.lineTo(radius, 0);
      }
      ctx.fill();
      ctx.stroke();

      if (hot) {
        ctx.globalAlpha = Math.min(0.82, alpha + 0.18);
        ctx.strokeStyle = this.hexToRgba("#ffffff", 0.78);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius + 8 + Math.sin(t * 7) * 2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (resolved) {
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-radius, -radius);
        ctx.lineTo(radius, radius);
        ctx.stroke();
      }
      ctx.restore();
    }

    const badgeY = startY - 30;
    ctx.save();
    ctx.translate(railX, badgeY);
    ctx.globalAlpha = 0.34 + Math.sin(t * 5) * 0.06;
    ctx.strokeStyle = this.hexToRgba(primary, 0.72);
    ctx.fillStyle = this.hexToRgba(primary, 0.10);
    ctx.shadowColor = primary;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-18, -14, 36, 28, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = primary;
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(visuals.icon || "連", 0, 0);
    ctx.restore();

    ctx.restore();
  }

  getPlayerQTEChainIntentVisuals(scene) {
    const runner = scene && scene.qteRunner;
    const chain = runner && runner.chain;
    if (!runner || !chain || !Array.isArray(chain.nodes) || chain.nodes.length <= 1 || scene.turnState !== "qte_running") {
      return { active: false };
    }

    const resultLog = Array.isArray(runner.resultLog) ? runner.resultLog : [];
    const resultByNode = new Map(resultLog.map(entry => [entry.nodeId, entry]));
    const currentNode = runner.currentNode ? runner.currentNode() : null;
    const currentIndex = Math.max(0, Math.min(chain.nodes.length - 1, runner.nodeIndex || 0));
    const chainId = runner.context && runner.context.chainId ? runner.context.chainId : (chain.id || chain.name || "qte");
    const family = chain.family || (runner.context && runner.context.chainFamily) || "";
    const color = chain.color
      || (scene.playerConfig && scene.playerConfig.style && StyleDatabase[scene.playerConfig.style] && StyleDatabase[scene.playerConfig.style].color)
      || "#3498db";

    const rows = chain.nodes.map((node, index) => {
      const result = resultByNode.get(node.id) || null;
      const current = currentNode && currentNode.id === node.id;
      const input = node.input || {};
      const nextIds = ["onPerfect", "onSuccess", "onEarly", "onLate", "onFail"]
        .map(key => node[key] && node[key].next)
        .filter(Boolean);
      const outcome = result ? result.outcome : null;
      return {
        index,
        id: node.id,
        name: node.name || node.id,
        key: input.type === "hold_release" ? input.key : (input.key || ""),
        inputType: input.type || "press",
        current,
        completed: !!result,
        outcome,
        failed: outcome === "fail" || outcome === "timeout" || outcome === "early" || outcome === "late",
        perfect: outcome === "perfect",
        success: outcome === "success",
        future: !result && !current,
        progress: current ? (runner.currentNodeProgress ? runner.currentNodeProgress() : Utils.clamp((runner.nodeTimer || 0) / Math.max(0.001, node.duration || 1), 0, 1)) : 0,
        hasBranch: nextIds.length > 1 || new Set(nextIds).size > 1,
        window: node.window || null,
        duration: node.duration || 1
      };
    });

    const completedCount = rows.filter(row => row.completed).length;
    const current = rows.find(row => row.current) || rows[currentIndex] || rows[0];

    return {
      active: true,
      chainId,
      family,
      name: chain.name || chainId,
      color,
      count: rows.length,
      currentIndex: current ? current.index : currentIndex,
      completedCount,
      progress: current ? current.progress : 0,
      rows
    };
  }

  drawPlayerQTEChainIntentLayer(ctx, visuals, t) {
    if (!visuals || !visuals.active || !Array.isArray(visuals.rows) || visuals.rows.length <= 1) return;

    const playerX = 220;
    const playerY = this.height - 190;
    const baseX = 112;
    const baseY = playerY - 92;
    const count = visuals.rows.length;
    const spacing = count <= 3 ? 38 : 31;
    const primary = visuals.color || "#3498db";
    const family = String(visuals.family || "").toLowerCase();
    const isSpell = family === "fire" || family === "absorb" || family === "staff";

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    ctx.strokeStyle = this.hexToRgba(primary, 0.18);
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 9]);
    ctx.beginPath();
    for (const row of visuals.rows) {
      const x = baseX + row.index * spacing;
      const y = baseY - Math.sin(row.index * 0.82) * 12;
      if (row.index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const current = visuals.rows.find(row => row.current) || visuals.rows[visuals.currentIndex] || visuals.rows[0];
    if (current) {
      const cx = baseX + current.index * spacing;
      const cy = baseY - Math.sin(current.index * 0.82) * 12;
      ctx.save();
      ctx.globalAlpha = 0.16 + Math.sin(t * 5) * 0.03;
      ctx.strokeStyle = this.hexToRgba(primary, 0.88);
      ctx.shadowColor = primary;
      ctx.shadowBlur = 16;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(playerX + 18, playerY - 38);
      ctx.quadraticCurveTo(playerX - 36, playerY - 118, cx, cy);
      ctx.stroke();
      ctx.restore();
    }

    for (const row of visuals.rows) {
      const x = baseX + row.index * spacing;
      const y = baseY - Math.sin(row.index * 0.82) * 12;
      const hot = row.current;
      const done = row.completed;
      const failed = row.failed;
      const nodeColor = failed ? "#e74c3c" : (row.perfect ? "#f1c40f" : (done ? "#2ecc71" : primary));
      const pulse = hot ? 0.82 + Math.sin(t * 9 + row.index) * 0.18 : 0.72;
      const alpha = hot ? 0.78 * pulse : (done ? 0.42 : 0.22);
      const radius = hot ? 13 : 9;

      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = nodeColor;
      ctx.shadowBlur = hot ? 18 : 9;
      ctx.strokeStyle = nodeColor;
      ctx.fillStyle = this.hexToRgba(nodeColor, hot ? 0.24 : 0.10);
      ctx.lineWidth = hot ? 3 : 2;

      ctx.beginPath();
      if (row.inputType === "hold_release") {
        ctx.arc(0, 0, radius + 2, 0, Math.PI * 2);
      } else if (row.inputType === "rhythm") {
        ctx.moveTo(0, -radius - 2);
        ctx.lineTo(radius + 2, 0);
        ctx.lineTo(0, radius + 2);
        ctx.lineTo(-radius - 2, 0);
        ctx.closePath();
      } else {
        ctx.roundRect(-radius, -radius, radius * 2, radius * 2, 5);
      }
      ctx.fill();
      ctx.stroke();

      if (hot) {
        const start = -Math.PI / 2;
        const end = start + Math.PI * 2 * Utils.clamp(row.progress || 0, 0, 1);
        ctx.globalAlpha = 0.86;
        ctx.strokeStyle = this.hexToRgba("#ffffff", 0.84);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius + 8, start, end);
        ctx.stroke();
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.arc(0, 0, radius + 12 + Math.sin(t * 7) * 2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (done) {
        ctx.globalAlpha = failed ? 0.46 : 0.62;
        ctx.strokeStyle = failed ? "#ffffff" : this.hexToRgba("#ffffff", 0.82);
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (failed) {
          ctx.moveTo(-radius * 0.52, -radius * 0.52);
          ctx.lineTo(radius * 0.52, radius * 0.52);
          ctx.moveTo(radius * 0.52, -radius * 0.52);
          ctx.lineTo(-radius * 0.52, radius * 0.52);
        } else {
          ctx.moveTo(-radius * 0.58, 0);
          ctx.lineTo(-radius * 0.12, radius * 0.45);
          ctx.lineTo(radius * 0.62, -radius * 0.42);
        }
        ctx.stroke();
      } else if (row.hasBranch) {
        ctx.globalAlpha = 0.34;
        ctx.strokeStyle = this.hexToRgba("#ffffff", 0.65);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-radius * 0.35, radius * 0.62);
        ctx.lineTo(0, radius * 0.18);
        ctx.lineTo(radius * 0.35, radius * 0.62);
        ctx.stroke();
      }

      if (row.key) {
        ctx.globalAlpha = hot ? 0.86 : 0.48;
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(row.key).slice(0, 2).toUpperCase(), 0, 0.5);
      } else if (isSpell) {
        ctx.globalAlpha = 0.44;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(baseX - 34, baseY - 22);
    ctx.globalAlpha = 0.30 + Math.sin(t * 4) * 0.05;
    ctx.strokeStyle = this.hexToRgba(primary, 0.72);
    ctx.fillStyle = this.hexToRgba(primary, 0.08);
    ctx.shadowColor = primary;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = primary;
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(isSpell ? "術" : "技", 0, 0);
    ctx.restore();

    ctx.restore();
  }

  drawEnemyGlyph(ctx, x, y, radius, color, t, alpha = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(t * 0.9);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = i % 2 === 0 ? radius * 0.72 : radius * 0.38;
      const x1 = Math.cos(a) * r;
      const y1 = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x1, y1);
      else ctx.lineTo(x1, y1);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  isSpellLikeAttack(attack) {
    const id = String(attack.id || "").toLowerCase();
    return !!attack.interruptible || id.includes("spell") || id.includes("arcane") || id.includes("curse");
  }

  getActionTiming(scene, t) {
    if (scene.qteRunner) {
      const node = scene.qteRunner.currentNode();
      if (node && node.duration) {
        return {
          active: true,
          progress: Utils.clamp(scene.qteRunner.nodeTimer / node.duration, 0, 1)
        };
      }
    }
    return {
      active: false,
      progress: (t * 6) % 1
    };
  }

  getCurrentPose(scene) {
    const fallbackState = scene.playerState ? scene.playerState.currentState : "idle";
    const pose = {
      state: fallbackState,
      motion: fallbackState,
      source: "fallback"
    };

    if (!scene.qteRunner) return pose;

    const node = scene.qteRunner.currentNode();
    if (!node) return pose;

    if (node.pose) {
      return {
        state: node.pose.state || fallbackState,
        motion: node.pose.motion || node.id || fallbackState,
        source: "node"
      };
    }

    if (node.input && (node.input.type === "hold_release" || node.input.type === "rhythm")) {
      return {
        state: "charge",
        motion: `${scene.qteRunner.chain.family || "qte"}Charge`,
        source: "inferred"
      };
    }

    return pose;
  }

  drawWeaponTrail(ctx, x, y, weaponId, weapon, color, progress, active, motion = "") {
    const eased = this.easeOutCubic(Utils.clamp(progress, 0, 1));
    const alpha = active ? Math.max(0.08, 0.75 * (1 - Math.abs(eased - 0.62))) : 0.45 * (1 - progress);
    const motionName = String(motion);

    if (weaponId === "dualBlades") {
      const isFinisher = motionName === "dualFinisher";
      const isRetreat = motionName === "dualRetreat";
      for (let i = 0; i < 2; i++) {
        const sign = i === 0 ? 1 : -1;
        ctx.save();
        ctx.translate(x + 18 - (isRetreat ? eased * 26 : 0), y - 3 + sign * (isFinisher ? 14 : 10));
        ctx.rotate((isRetreat ? 0.65 : -0.4) + eased * (isFinisher ? 1.9 : 1.35) * sign);
        ctx.strokeStyle = i === 0 ? color : "#ffffff";
        ctx.lineWidth = i === 0 ? 4 : 2;
        ctx.globalAlpha = alpha * (i === 0 ? 0.9 : 0.55);
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, (isFinisher ? 78 : 62) + eased * (isFinisher ? 38 : 28), -0.55, 0.62);
        ctx.stroke();
        ctx.restore();
      }
      return;
    }

    const isGreatsword = weaponId === "greatsword";
    const isEarthsplit = motionName === "greatswordEarthsplit" || motionName === "flameBladeBurst";
    const isDraw = motionName === "greatswordDraw";
    const startAngle = isGreatsword
      ? (isDraw ? -Math.PI * 0.95 : (isEarthsplit ? -Math.PI * 0.9 : -Math.PI * 0.72))
      : -Math.PI * 0.38;
    const endAngle = isGreatsword
      ? (isDraw ? -Math.PI * 0.28 : (isEarthsplit ? Math.PI * 0.36 : Math.PI * 0.28))
      : Math.PI * 0.42;
    const angle = startAngle + (endAngle - startAngle) * eased;
    const radius = isGreatsword ? (isEarthsplit ? 104 : 82) + eased * (isEarthsplit ? 64 : 52) : 58 + eased * 38;

    ctx.save();
    ctx.translate(x + (isGreatsword ? 8 : 0), y);
    ctx.rotate(angle);
    ctx.strokeStyle = color;
    ctx.lineWidth = isGreatsword ? 8 : 4;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = isGreatsword ? 20 : 12;
    ctx.beginPath();
    ctx.arc(0, 0, radius, -0.42, 0.48);
    ctx.stroke();
    if (isGreatsword) {
      ctx.globalAlpha = alpha * 0.45;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius - 10, -0.35, 0.38);
      ctx.stroke();
    }
    ctx.restore();
  }

  easeOutCubic(value) {
    const t = Utils.clamp(value, 0, 1);
    return 1 - Math.pow(1 - t, 3);
  }

  drawFireballCharge(scene, x, y, ratio, t) {
    const ctx = this.ctx;
    const radius = 12 + ratio * 38;
    const glow = radius * (1.7 + Math.sin(t * 10) * 0.15);

    ctx.save();
    ctx.translate(x, y);

    // 外层光晕
    const grad = ctx.createRadialGradient(0, 0, radius * 0.3, 0, 0, glow);
    grad.addColorStop(0, "rgba(241, 196, 15, 0.95)");
    grad.addColorStop(0.45, `rgba(231, 76, 60, ${0.45 + ratio * 0.45})`);
    grad.addColorStop(1, "rgba(231, 76, 60, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, glow, 0, Math.PI * 2);
    ctx.fill();

    // 核心火球
    ctx.fillStyle = ratio > 0.7 ? "#f1c40f" : "#e67e22";
    ctx.shadowColor = "#e74c3c";
    ctx.shadowBlur = 20 + ratio * 25;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // 内核白热点
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(-radius * 0.25, -radius * 0.25, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 火星粒子由战斗/演示 update 阶段发射，保持渲染函数纯绘制。
  }

  drawCharacters(scene, t) {
    const ctx = this.ctx;

    this.drawBattleStage(scene, t);
    if (this.visualLayerEnabled(scene, "combatPhaseLightingOrnaments")) {
      this.drawCombatPhaseLighting(ctx, this.getCombatPhaseLighting(scene), t);
    }
    if (this.visualLayerEnabled(scene, "enemyChainIntentLayer") && !(scene.turnState === "enemy_turn" && scene.enemyAttackChain)) {
      this.drawEnemyChainIntentLayer(ctx, this.getEnemyChainIntentVisuals(scene), t);
    }
    if (this.visualLayerEnabled(scene, "playerQTEChainIntentLayer")) {
      this.drawPlayerQTEChainIntentLayer(ctx, this.getPlayerQTEChainIntentVisuals(scene), t);
    }

    // 玩家
    const basePx = 220;
    const basePy = this.height - 190;
    const playerStage = scene && scene.getActorMeleeOffset ? scene.getActorMeleeOffset("player") : { x: 0, y: 0 };
    const weaponId = scene.playerConfig ? scene.playerConfig.weapon : null;
    const weapon = weaponId ? WeaponDatabase[weaponId] : null;
    const playerReaction = this.getActorReaction(scene, "player");
    const style = scene.playerConfig && scene.playerConfig.style ? StyleDatabase[scene.playerConfig.style] : null;
    const styleColor = style ? style.color : (weapon ? weapon.color : "#3498db");
    const actionTiming = this.getActionTiming(scene, t);
    const pose = this.getCurrentPose(scene);
    const playerPerformance = this.getActorPerformance(scene, "player", playerReaction, pose);
    const playerProfile = this.getPlayerModelProfile(scene);
    const playerRig = this.getPlayerRigProfile(playerProfile);
    const playerImpactVisuals = this.getActorImpactReactionVisuals(scene, "player", playerReaction, playerPerformance);

    // 待机呼吸
    let bob = Math.sin(t * 2) * 2;
    let px = basePx + (playerStage.x || 0) + playerReaction.offsetX;
    let py = basePy + (playerStage.y || 0) + bob + playerReaction.offsetY + playerPerformance.offsetY;

    // 架势位移
    const pState = pose.state;
    const motion = pose.motion || "";
    let stanceOffset = 0;
    if (pState === "swordAttack") {
      const ease = this.easeOutCubic(actionTiming.progress);
      if (motion === "dualDash") stanceOffset = 36 + ease * 34;
      else if (motion === "dualRetreat") stanceOffset = 18 - ease * 24;
      else if (motion === "greatswordDraw") stanceOffset = 10 + ease * 18;
      else stanceOffset = 24 + ease * 28;
    } else if (pState === "casting" || pState === "charge") {
      stanceOffset = motion === "overflowCompress" ? 6 : 14;
    }
    else if (pState === "shield") stanceOffset = 8;
    stanceOffset += playerPerformance.offsetX;
    px += stanceOffset;

    this.drawActorShadow(ctx, basePx + (playerStage.x || 0) + stanceOffset + playerReaction.offsetX * 0.35, basePy + (playerStage.y || 0) + 45, 42 * playerPerformance.shadowScale * playerRig.shadowScale, "rgba(52, 152, 219, 0.3)");
    if (this.visualLayerEnabled(scene, "actorGroundSigils")) {
      this.drawActorGroundSigil(ctx, basePx + (playerStage.x || 0) + stanceOffset, basePy + (playerStage.y || 0) + 45, 50, styleColor, "player", t);
    }
    const playerStatusVisuals = this.getActorStatusVisuals(scene, "player");
    if (this.visualLayerEnabled(scene, "actorFootwork")) {
      this.drawActorFootworkLayer(ctx, this.getActorFootworkVisuals("player", px, basePy + (playerStage.y || 0) + 45, styleColor, playerPerformance, playerRig, {
        reaction: playerReaction,
        state: pState,
        motion,
        stanceOffset,
        t
      }));
    }
    if (this.visualLayerEnabled(scene, "actorAfterimages")) {
      this.drawActorPerformanceAfterimage(ctx, "player", px, py, styleColor, playerPerformance, t);
    }
    if (this.visualLayerEnabled(scene, "actorStatusAuras")) {
      this.drawPlayerStatusAuras(ctx, scene, px, py, styleColor, playerStatusVisuals, t);
    }
    if (this.visualLayerEnabled(scene, "actorMotionLines")) {
      this.drawActorMotionLines(ctx, px, py, playerReaction, "player", styleColor);
    }
    this.drawPlayerSilhouette(ctx, scene, {
      x: px,
      y: py,
      weaponId,
      weapon,
      state: pState,
      styleColor,
      reaction: playerReaction,
      progress: actionTiming.progress,
      pose,
      performance: playerPerformance,
      playerProfile,
      playerRig,
      t
    });
    if (this.visualLayerEnabled(scene, "actorImpactReactions")) {
      this.drawActorImpactReactionLayer(ctx, "player", px, py, playerImpactVisuals, styleColor, t);
    }
    if (this.visualLayerEnabled(scene, "actorDamageMarks")) {
      this.drawActorDamageMarks(ctx, "player", px, py, this.getActorDamageVisuals(scene, "player"), styleColor, t);
    }
    if (this.visualLayerEnabled(scene, "actorStatusOverlays")) {
      this.drawPlayerStatusOverlays(ctx, scene, px, py, styleColor, playerStatusVisuals, t);
    }
    if (this.visualLayerEnabled(scene, "defenseIntentOverlay")) {
      this.drawPlayerDefenseIntentOverlay(ctx, scene, px, py, this.getPlayerDefenseIntentVisuals(scene, playerStatusVisuals), t);
    }
    if (this.visualLayerEnabled(scene, "actorIntentBadges")) {
      this.drawActorIntentBadgeLayer(ctx, px, py, this.getActorIntentBadgeVisuals(scene, "player", playerPerformance, {
        pose,
        color: styleColor
      }), t);
    }
    if (this.visualLayerEnabled(scene, "actorReactionOverlay")) {
      this.drawActorReactionOverlay(px, py, 35, playerReaction);
    }

    // 敌人
    const baseEx = this.width - 220;
    const baseEy = this.height - 190;
    const enemyStage = scene && scene.getActorMeleeOffset ? scene.getActorMeleeOffset("enemy") : { x: 0, y: 0 };
    const eBob = Math.sin(t * 2 + 1) * 2;
    const enemyReaction = this.getActorReaction(scene, "enemy");
    const enemyPerformance = this.getActorPerformance(scene, "enemy", enemyReaction, null);
    const enemyImpactVisuals = this.getActorImpactReactionVisuals(scene, "enemy", enemyReaction, enemyPerformance);
    let ex = baseEx + (enemyStage.x || 0) + enemyReaction.offsetX;
    let ey = baseEy + (enemyStage.y || 0) + eBob + enemyReaction.offsetY + enemyPerformance.offsetY;

    // 敌方蓄力前冲
    let enemyForward = 0;
    if (scene.enemyAttackPhase === "response") enemyForward = -36;
    else if (scene.enemyAttackPhase === "hit") enemyForward = -52;
    enemyForward += enemyPerformance.offsetX;
    ex += enemyForward;

    const enemyConfig = scene.enemyConfig || EnemyDatabase.base;
    const enemyRig = this.getEnemyRigProfile(this.getEnemyModelProfile(enemyConfig));
    const enemyStatusVisuals = this.getActorStatusVisuals(scene, "enemy");
    this.drawActorShadow(ctx, baseEx + (enemyStage.x || 0) + enemyForward + enemyReaction.offsetX * 0.25, baseEy + (enemyStage.y || 0) + 55, 58 * enemyPerformance.shadowScale * enemyRig.shadowScale, "rgba(192, 57, 43, 0.3)");
    if (this.visualLayerEnabled(scene, "actorGroundSigils")) {
      this.drawActorGroundSigil(ctx, baseEx + (enemyStage.x || 0) + enemyForward, baseEy + (enemyStage.y || 0) + 55, 62, enemyConfig.color || "#e74c3c", "enemy", t);
    }
    if (this.visualLayerEnabled(scene, "actorStatusAuras")) {
      this.drawEnemyStatusAuras(ctx, scene, ex, ey, enemyConfig.color || "#e74c3c", enemyStatusVisuals, t);
    }
    if (this.visualLayerEnabled(scene, "actorFootwork")) {
      this.drawActorFootworkLayer(ctx, this.getActorFootworkVisuals("enemy", ex, baseEy + (enemyStage.y || 0) + 55, enemyConfig.color || "#e74c3c", enemyPerformance, enemyRig, {
        reaction: enemyReaction,
        enemyPose: enemyPerformance.enemyPose,
        poseIntensity: enemyPerformance.poseIntensity,
        stanceOffset: enemyForward,
        t
      }));
    }
    if (this.visualLayerEnabled(scene, "actorAfterimages")) {
      this.drawActorPerformanceAfterimage(ctx, "enemy", ex, ey, enemyConfig.color || "#e74c3c", enemyPerformance, t);
    }
    if (this.visualLayerEnabled(scene, "actorMotionLines")) {
      this.drawActorMotionLines(ctx, ex, ey, enemyReaction, "enemy", enemyConfig.color || "#e74c3c");
    }
    this.drawEnemySilhouette(ctx, scene, {
      x: ex,
      y: ey,
      config: enemyConfig,
      reaction: enemyReaction,
      performance: enemyPerformance,
      t
    });
    if (this.visualLayerEnabled(scene, "enemyEncounterPhaseOverlay")) {
      this.drawEnemyEncounterPhaseOverlay(ctx, scene, ex, ey, this.getEnemyEncounterPhaseVisuals(scene), t);
    }
    if (this.visualLayerEnabled(scene, "actorImpactReactions")) {
      this.drawActorImpactReactionLayer(ctx, "enemy", ex, ey, enemyImpactVisuals, enemyConfig.color || "#e74c3c", t);
    }
    if (this.visualLayerEnabled(scene, "actorDamageMarks")) {
      this.drawActorDamageMarks(ctx, "enemy", ex, ey, this.getActorDamageVisuals(scene, "enemy"), enemyConfig.color || "#e74c3c", t);
    }
    if (this.visualLayerEnabled(scene, "actorStatusOverlays")) {
      this.drawEnemyStatusOverlays(ctx, scene, ex, ey, enemyConfig.color || "#e74c3c", enemyStatusVisuals, t);
    }
    if (this.visualLayerEnabled(scene, "actorIntentBadges")) {
      this.drawActorIntentBadgeLayer(ctx, ex, ey, this.getActorIntentBadgeVisuals(scene, "enemy", enemyPerformance, {
        color: enemyConfig.color || "#e74c3c"
      }), t);
    }
    if (this.visualLayerEnabled(scene, "actorReactionOverlay")) {
      this.drawActorReactionOverlay(ex, ey, 50, enemyReaction);
    }

    // 敌方攻击意图图标
    if (this.visualLayerEnabled(scene, "enemyAttackIcon") && scene.enemyAttack && scene.enemyAttack.icon) {
      const iconScale = scene.enemyAttackPhase === "windup"
        ? 0.8 + (scene.enemyAttackTimer / scene.enemyAttack.windup) * 0.4
        : (scene.enemyAttackPhase === "response" ? 1.25 : 1.0);
      ctx.save();
      ctx.translate(ex, ey - 78);
      ctx.scale(iconScale, iconScale);
      ctx.fillStyle = scene.enemyAttack.color || "#e74c3c";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = scene.enemyAttack.color || "#e74c3c";
      ctx.shadowBlur = 12;
      ctx.fillText(scene.enemyAttack.icon, 0, 0);
      ctx.restore();
    }

    this.drawCombatNameplates(scene, {
      player: { x: px, y: py, color: styleColor, weaponId },
      enemy: { x: ex, y: ey, color: enemyConfig.color || "#e74c3c", config: enemyConfig }
    });
  }

  drawBattleStage(scene, t) {
    const ctx = this.ctx;
    const floorY = this.height - 150;
    const theme = this.getEncounterStageTheme(scene);
    const accent = theme.accent;

    ctx.save();
    const sky = ctx.createLinearGradient(0, floorY - 170, 0, this.height);
    sky.addColorStop(0, this.hexToRgba(theme.haze || "#0c0e18", 0.02));
    sky.addColorStop(1, this.hexToRgba(theme.haze || "#06080e", 0.42));
    ctx.fillStyle = sky;
    ctx.fillRect(0, floorY - 170, this.width, 170);
    this.drawEncounterBackdrop(ctx, theme, floorY, t);

    ctx.fillStyle = "#1e1e2a";
    ctx.fillRect(0, floorY, this.width, this.height - floorY);
    const floorGrad = ctx.createLinearGradient(0, floorY, 0, this.height);
    floorGrad.addColorStop(0, "rgba(255,255,255,0.04)");
    floorGrad.addColorStop(1, "rgba(0,0,0,0.24)");
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floorY, this.width, this.height - floorY);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.055)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const y = floorY + 16 + i * 18;
      ctx.beginPath();
      ctx.moveTo(70 + i * 18, y);
      ctx.lineTo(this.width - 70 - i * 18, y);
      ctx.stroke();
    }
    for (let x = 80; x <= this.width - 80; x += 80) {
      ctx.beginPath();
      ctx.moveTo(this.width / 2, floorY + 4);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    this.drawEncounterFloorDetails(ctx, theme, floorY, t);

    const showStageLane = typeof RenderStateHelpers !== "undefined"
      ? RenderStateHelpers.shouldShowPlayerStageLane(scene)
      : (scene.turnState === "player_turn" || scene.turnState === "followup_turn");
    if (showStageLane) {
      const lanePulse = 0.45 + Math.sin(t * 2.2) * 0.08;
      ctx.strokeStyle = this.hexToRgba(accent, lanePulse);
      ctx.lineWidth = 2;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(160, floorY + 4);
      ctx.quadraticCurveTo(this.width / 2, floorY + 34, this.width - 160, floorY + 4);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    if (scene.turnState === "enemy_turn" && scene.enemyAttackPhase === "response") {
      ctx.fillStyle = this.hexToRgba("#2ecc71", 0.08 + Math.sin(t * 12) * 0.03);
      ctx.fillRect(0, floorY - 5, this.width, 8);
    }
    ctx.restore();
  }

  getCombatPhaseLighting(scene) {
    if (!scene || !scene.turnState || scene.turnState.startsWith("select_") || scene.turnState.startsWith("demo_") || scene.turnState === "game_over") {
      return { active: false };
    }

    const style = scene.playerConfig && scene.playerConfig.style ? StyleDatabase[scene.playerConfig.style] : null;
    const weapon = scene.playerConfig && scene.playerConfig.weapon ? WeaponDatabase[scene.playerConfig.weapon] : null;
    const enemy = scene.enemyConfig || EnemyDatabase.base;
    const playerColor = style ? style.color : (weapon ? weapon.color : "#3498db");
    const enemyColor = scene.enemyAttack && scene.enemyAttack.color ? scene.enemyAttack.color : (enemy.color || "#e74c3c");
    const focus = this.getCinematicFocus(scene);
    const floorY = this.height - 150;
    const base = {
      active: true,
      mode: scene.turnState,
      floorY,
      playerX: 220,
      enemyX: this.width - 220,
      playerColor,
      enemyColor,
      color: playerColor,
      secondary: enemyColor,
      intensity: 0.28,
      progress: 0.35,
      playerHot: false,
      enemyHot: false,
      centerHot: false,
      response: false,
      laneDirection: 1
    };

    if (scene.turnState === "player_turn" || scene.turnState === "followup_turn") {
      return {
        ...base,
        mode: scene.turnState === "followup_turn" ? "followup" : "player",
        color: playerColor,
        secondary: "#f1c40f",
        intensity: scene.turnState === "followup_turn" ? 0.42 : 0.28,
        progress: 0.18,
        playerHot: scene.turnState === "followup_turn"
      };
    }

    if (scene.turnState === "qte_running") {
      const runnerProgress = scene.qteRunner && scene.qteRunner.currentNodeProgress ? scene.qteRunner.currentNodeProgress() : 0.5;
      return {
        ...base,
        mode: "qte",
        color: playerColor,
        secondary: "#f1c40f",
        intensity: 0.42,
        progress: Utils.clamp(runnerProgress, 0, 1),
        playerHot: true,
        centerHot: true
      };
    }

    if (scene.turnState === "attack_active" && focus && focus.kind === "activeAttack") {
      const meleePressure = !!focus.meleePressure;
      return {
        ...base,
        mode: "attack",
        color: focus.color || playerColor,
        secondary: focus.source === "enemy" ? playerColor : enemyColor,
        intensity: Utils.clamp(focus.intensity || 0.54, 0.32, 0.92),
        progress: Utils.clamp(focus.progress || 0, 0, 1),
        playerHot: meleePressure || focus.source === "player",
        enemyHot: meleePressure || focus.source === "enemy",
        centerHot: !meleePressure,
        meleePressure,
        laneDirection: focus.source === "enemy" ? -1 : 1
      };
    }

    if (scene.turnState === "enemy_turn") {
      const metrics = scene.enemyAttack ? this.getEnemyTimingMetrics(scene, scene.enemyAttack) : null;
      const response = !!(metrics && metrics.inResponse);
      const telegraph = scene.enemyAttack ? this.getEnemyTelegraph(scene.enemyAttack) : null;
      const meleePressure = this.isMeleeTelegraph(telegraph);
      return {
        ...base,
        mode: "enemy",
        color: enemyColor,
        secondary: response ? "#2ecc71" : "#e74c3c",
        intensity: response ? 0.56 : 0.34,
        progress: metrics ? Utils.clamp(metrics.progress, 0, 1) : 0.28,
        enemyHot: true,
        playerHot: response,
        response,
        meleePressure,
        laneDirection: -1
      };
    }

    if (scene.turnState === "resolving") {
      return {
        ...base,
        mode: "resolve",
        color: "#f1c40f",
        secondary: playerColor,
        intensity: 0.24,
        centerHot: true
      };
    }

    return base;
  }

  drawCombatPhaseLighting(ctx, lighting, t) {
    if (!lighting || !lighting.active) return;
    const ornamentScale = this.visualScale("ornament");
    if (ornamentScale <= 0.05) return;
    const floorY = lighting.floorY || this.height - 150;
    const intensity = Utils.clamp(lighting.intensity || 0.28, 0, 1) * ornamentScale;
    const color = lighting.color || "#3498db";
    const secondary = lighting.secondary || color;
    const pulse = 0.75 + Math.sin(t * (lighting.response ? 9.5 : 4.2)) * 0.10 + intensity * 0.18;
    const y = floorY + 16;
    const playerX = lighting.playerX || 220;
    const enemyX = lighting.enemyX || this.width - 220;
    const progress = Utils.clamp(lighting.progress || 0.35, 0, 1);
    const laneHead = lighting.laneDirection < 0
      ? enemyX + (playerX - enemyX) * progress
      : playerX + (enemyX - playerX) * progress;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const drawFloorGlow = (x, glowColor, alpha, rx, ry) => {
      const grad = ctx.createRadialGradient(x, y + 12, 4, x, y + 12, rx);
      grad.addColorStop(0, this.hexToRgba(glowColor, alpha));
      grad.addColorStop(0.48, this.hexToRgba(glowColor, alpha * 0.26));
      grad.addColorStop(1, this.hexToRgba(glowColor, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x, y + 12, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    };

    const enemyMode = lighting.mode === "enemy";
    if (lighting.playerHot) {
      drawFloorGlow(
        playerX,
        enemyMode ? secondary : color,
        enemyMode ? 0.035 + intensity * 0.045 : 0.12 + intensity * 0.16,
        enemyMode ? 84 + intensity * 18 : 125 + intensity * 45,
        enemyMode ? 24 + intensity * 6 : 42 + intensity * 14
      );
    }
    if (lighting.enemyHot) {
      drawFloorGlow(
        enemyX,
        color,
        enemyMode ? 0.035 + intensity * 0.045 : 0.12 + intensity * 0.16,
        enemyMode ? 88 + intensity * 18 : 135 + intensity * 52,
        enemyMode ? 24 + intensity * 6 : 45 + intensity * 16
      );
    }
    if (lighting.centerHot && !enemyMode) {
      drawFloorGlow(this.width / 2, secondary, 0.06 + intensity * 0.08, 170 + intensity * 70, 38 + intensity * 10);
    }

    if (lighting.mode === "enemy") {
      if (!lighting.meleePressure) {
        ctx.strokeStyle = this.hexToRgba(lighting.response ? secondary : color, (lighting.response ? 0.12 : 0.055) * ornamentScale);
        ctx.lineWidth = lighting.response ? 1.5 : 1;
        ctx.shadowColor = lighting.response ? secondary : color;
        ctx.shadowBlur = lighting.response ? 4 : 2;
        ctx.setLineDash([8, 12]);
        ctx.beginPath();
        ctx.moveTo(enemyX, floorY + 24);
        ctx.quadraticCurveTo(this.width / 2, floorY + 40, playerX, floorY + 24);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (lighting.response) {
        ctx.strokeStyle = this.hexToRgba("#2ecc71", 0.12 + intensity * 0.10);
        ctx.fillStyle = this.hexToRgba("#2ecc71", 0.012 + intensity * 0.018);
        ctx.shadowColor = "#2ecc71";
        ctx.shadowBlur = 5;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(playerX + 18, floorY + 4, 86 * pulse, 16 * pulse, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
      return;
    }

    if (lighting.meleePressure) {
      ctx.restore();
      return;
    }

    ctx.strokeStyle = this.hexToRgba(color, 0.13 + intensity * 0.24);
    ctx.lineWidth = 10 + intensity * 12;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18 + intensity * 16;
    ctx.beginPath();
    ctx.moveTo(playerX, floorY + 8);
    ctx.quadraticCurveTo(this.width / 2, floorY + 34 + Math.sin(t * 2.1) * 4, enemyX, floorY + 8);
    ctx.stroke();

    ctx.strokeStyle = this.hexToRgba(secondary, 0.18 + intensity * 0.26);
    ctx.lineWidth = 3 + intensity * 3;
    ctx.shadowBlur = 10 + intensity * 12;
    ctx.beginPath();
    if (lighting.laneDirection < 0) {
      ctx.moveTo(enemyX, floorY + 8);
      ctx.quadraticCurveTo(this.width / 2, floorY + 32, laneHead, floorY + 18);
    } else {
      ctx.moveTo(playerX, floorY + 8);
      ctx.quadraticCurveTo(this.width / 2, floorY + 32, laneHead, floorY + 18);
    }
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = this.hexToRgba(secondary, 0.16 + intensity * 0.24);
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const offset = i * 54 + (t * (lighting.laneDirection < 0 ? -46 : 46)) % 54;
      const p = ((offset / Math.max(1, enemyX - playerX)) + 1) % 1;
      const x = playerX + (enemyX - playerX) * p;
      const yy = floorY + 14 + Math.sin(t * 2 + i) * 5;
      ctx.beginPath();
      ctx.moveTo(x - 10, yy);
      ctx.lineTo(x + 10, yy - 3);
      ctx.stroke();
    }

    if (lighting.response) {
      ctx.strokeStyle = this.hexToRgba("#2ecc71", 0.30 + intensity * 0.22);
      ctx.fillStyle = this.hexToRgba("#2ecc71", 0.035 + intensity * 0.04);
      ctx.shadowColor = "#2ecc71";
      ctx.shadowBlur = 18;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(playerX + 18, floorY + 4, 92 * pulse, 18 * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  getEncounterStageTheme(scene) {
    const terrain = scene && scene.encounterConfig && scene.encounterConfig.terrain ? scene.encounterConfig.terrain : "";
    const encounterId = scene && scene.activeEncounterId ? scene.activeEncounterId : "";
    const name = scene && scene.encounterConfig && scene.encounterConfig.name ? scene.encounterConfig.name : "";
    const text = `${encounterId} ${name} ${terrain}`;

    if (/ember_bulwark|熔炉|熔心|炉|火/.test(text)) {
      return { key: "forge", accent: "#e67e22", secondary: "#c0392b", haze: "#2b1308" };
    }
    if (/arcane_conduit|秘术|回廊|法阵|咒|过载/.test(text)) {
      return { key: "arcane", accent: "#9b59b6", secondary: "#5dade2", haze: "#1a0f2f" };
    }
    if (/knife_rain|雨|巷|迅刺|贴身/.test(text)) {
      return { key: "rain", accent: "#27ae60", secondary: "#5dade2", haze: "#0d1f24" };
    }
    if (/shield_rite|折盾|仪式|圆厅|誓约/.test(text)) {
      return { key: "rite", accent: "#d4ac0d", secondary: "#9b59b6", haze: "#251f0a" };
    }
    if (/counter_tutorial|反制入门|训练中庭|counter_dojo|逆势|错拍|训练场/.test(text)) {
      return { key: "dojo", accent: "#16a085", secondary: "#f1c40f", haze: "#07251f" };
    }
    return { key: "neutral", accent: "#3498db", secondary: "#95a5a6", haze: "#0c0e18" };
  }

  drawEncounterBackdrop(ctx, theme, floorY, t) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const accent = theme.accent || "#3498db";
    const secondary = theme.secondary || accent;

    if (theme.key === "forge") {
      this.drawForgeBackdrop(ctx, floorY, accent, secondary, t);
    } else if (theme.key === "arcane") {
      this.drawArcaneBackdrop(ctx, floorY, accent, secondary, t);
    } else if (theme.key === "rain") {
      this.drawRainBackdrop(ctx, floorY, accent, secondary, t);
    } else if (theme.key === "rite") {
      this.drawRiteBackdrop(ctx, floorY, accent, secondary, t);
    } else if (theme.key === "dojo") {
      this.drawDojoBackdrop(ctx, floorY, accent, secondary, t);
    } else {
      ctx.strokeStyle = this.hexToRgba(accent, 0.14);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(120, floorY - 86);
      ctx.lineTo(this.width - 120, floorY - 86);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawForgeBackdrop(ctx, floorY, accent, secondary, t) {
    const furnaceXs = [110, this.width - 110];
    for (const x of furnaceXs) {
      ctx.save();
      ctx.translate(x, floorY - 74);
      ctx.fillStyle = "rgba(54, 31, 24, 0.55)";
      ctx.strokeStyle = this.hexToRgba(accent, 0.42);
      ctx.lineWidth = 2;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.roundRect(-38, -74, 76, 102, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = this.hexToRgba(secondary, 0.28 + Math.sin(t * 5 + x) * 0.04);
      ctx.beginPath();
      ctx.roundRect(-24, -24, 48, 38, 8);
      ctx.fill();
      ctx.restore();
    }

    ctx.strokeStyle = this.hexToRgba(accent, 0.18);
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const y = floorY - 140 + i * 20;
      ctx.beginPath();
      ctx.moveTo(170, y);
      ctx.lineTo(260, y - 8);
      ctx.moveTo(this.width - 260, y - 8);
      ctx.lineTo(this.width - 170, y);
      ctx.stroke();
    }
  }

  drawArcaneBackdrop(ctx, floorY, accent, secondary, t) {
    for (const x of [130, 250, this.width - 250, this.width - 130]) {
      ctx.fillStyle = "rgba(48, 32, 70, 0.34)";
      ctx.strokeStyle = this.hexToRgba(accent, 0.34);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - 18, floorY - 150, 36, 142, 10);
      ctx.fill();
      ctx.stroke();
      this.drawStageGlyph(ctx, x, floorY - 166, 18, secondary, t + x * 0.01, 0.22);
    }
    this.drawStageGlyph(ctx, this.width / 2, floorY - 92, 72, accent, t * 0.45, 0.16);
    this.drawStageGlyph(ctx, this.width / 2, floorY - 92, 42, secondary, -t * 0.65, 0.18);
  }

  drawRainBackdrop(ctx, floorY, accent, secondary, t) {
    ctx.fillStyle = "rgba(10, 16, 22, 0.62)";
    ctx.beginPath();
    ctx.moveTo(0, floorY - 150);
    ctx.lineTo(230, floorY - 110);
    ctx.lineTo(190, floorY + 6);
    ctx.lineTo(0, floorY + 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(this.width, floorY - 150);
    ctx.lineTo(this.width - 230, floorY - 110);
    ctx.lineTo(this.width - 190, floorY + 6);
    ctx.lineTo(this.width, floorY + 6);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = this.hexToRgba(secondary, 0.20);
    ctx.lineWidth = 1;
    for (let i = 0; i < 34; i++) {
      const x = (i * 43 + (t * 80 % 43)) % this.width;
      const y = floorY - 170 + (i % 7) * 24;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 12, y + 38);
      ctx.stroke();
    }
  }

  drawRiteBackdrop(ctx, floorY, accent, secondary, t) {
    ctx.strokeStyle = this.hexToRgba(accent, 0.18);
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(this.width / 2, floorY + 14, 230 - i * 42, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    }
    for (const x of [160, this.width - 160]) {
      ctx.fillStyle = "rgba(62, 49, 24, 0.35)";
      ctx.strokeStyle = this.hexToRgba(accent, 0.32);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - 18, floorY - 110, 36, 110, 6);
      ctx.fill();
      ctx.stroke();
      this.drawStageShield(ctx, x, floorY - 62, secondary, 0.22 + Math.sin(t * 4) * 0.04);
    }
  }

  drawDojoBackdrop(ctx, floorY, accent, secondary, t) {
    ctx.strokeStyle = this.hexToRgba(accent, 0.24);
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const x = 190 + i * 96;
      ctx.beginPath();
      ctx.moveTo(x, floorY - 122);
      ctx.lineTo(x, floorY + 4);
      ctx.stroke();
    }
    ctx.fillStyle = this.hexToRgba(secondary, 0.08 + Math.sin(t * 4) * 0.02);
    for (let i = 0; i < 4; i++) {
      const w = 70 + i * 18;
      ctx.fillRect(this.width / 2 - w / 2, floorY - 118 + i * 24, w, 5);
    }
    ctx.strokeStyle = this.hexToRgba(secondary, 0.25);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.width / 2 - 38, floorY - 118);
    ctx.lineTo(this.width / 2 + 34, floorY - 42);
    ctx.moveTo(this.width / 2 + 38, floorY - 118);
    ctx.lineTo(this.width / 2 - 34, floorY - 42);
    ctx.stroke();
  }

  drawEncounterFloorDetails(ctx, theme, floorY, t) {
    const accent = theme.accent || "#3498db";
    const secondary = theme.secondary || accent;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    if (theme.key === "forge") {
      ctx.strokeStyle = this.hexToRgba(accent, 0.34);
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const x = 220 + i * 130;
        ctx.beginPath();
        ctx.moveTo(x, floorY + 12);
        ctx.lineTo(x + 34, floorY + 42 + Math.sin(t * 3 + i) * 2);
        ctx.lineTo(x - 8, floorY + 82);
        ctx.stroke();
      }
    } else if (theme.key === "arcane") {
      this.drawStageGlyph(ctx, this.width / 2, floorY + 42, 112, accent, t * 0.5, 0.18);
      this.drawStageGlyph(ctx, this.width / 2, floorY + 42, 68, secondary, -t * 0.7, 0.16);
    } else if (theme.key === "rain") {
      ctx.strokeStyle = this.hexToRgba(secondary, 0.18);
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const x = 160 + i * 125;
        ctx.beginPath();
        ctx.ellipse(x, floorY + 58 + (i % 2) * 18, 44, 8, -0.08, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (theme.key === "rite") {
      ctx.strokeStyle = this.hexToRgba(accent, 0.25);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(this.width / 2, floorY + 40, 250, 54, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (const x of [280, this.width - 280]) this.drawStageShield(ctx, x, floorY + 28, secondary, 0.18);
    } else if (theme.key === "dojo") {
      ctx.strokeStyle = this.hexToRgba(accent, 0.20);
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const y = floorY + 20 + i * 20;
        ctx.beginPath();
        ctx.moveTo(170 + i * 24, y);
        ctx.lineTo(this.width - 170 - i * 24, y);
        ctx.stroke();
      }
      ctx.fillStyle = this.hexToRgba(secondary, 0.10);
      ctx.fillRect(this.width / 2 - 34, floorY + 18, 68, 76);
    }

    ctx.restore();
  }

  drawStageGlyph(ctx, x, y, radius, color, t, alpha = 0.2) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t);
    ctx.strokeStyle = this.hexToRgba(color || "#9b59b6", alpha);
    ctx.lineWidth = 2;
    ctx.shadowColor = color || "#9b59b6";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const px = Math.cos(a) * radius * 0.78;
      const py = Math.sin(a) * radius * 0.78;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  drawStageShield(ctx, x, y, color, alpha = 0.22) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = this.hexToRgba(color || "#d4ac0d", alpha);
    ctx.strokeStyle = this.hexToRgba(color || "#d4ac0d", alpha + 0.18);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(20, -10);
    ctx.lineTo(15, 18);
    ctx.lineTo(0, 30);
    ctx.lineTo(-15, 18);
    ctx.lineTo(-20, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawActorShadow(ctx, x, y, radius, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, Math.max(8, radius * 0.22), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawActorGroundSigil(ctx, x, y, radius, color, actor, t) {
    const ornamentScale = this.visualScale("ornament");
    if (ornamentScale <= 0.05) return;
    const pulse = 0.55 + Math.sin(t * 4 + (actor === "enemy" ? 1.4 : 0)) * 0.08;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = this.hexToRgba(color || "#ffffff", (actor === "enemy" ? 0.16 : 0.18) * ornamentScale);
    ctx.lineWidth = 1.4;
    ctx.shadowColor = color || "#ffffff";
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * (1 + pulse * 0.04), radius * 0.24, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.10 * ornamentScale;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.72, 0);
    ctx.lineTo(radius * 0.72, 0);
    ctx.moveTo(0, -radius * 0.18);
    ctx.lineTo(0, radius * 0.18);
    ctx.stroke();
    ctx.restore();
  }

  drawCombatNameplates(scene, anchors) {
    const ctx = this.ctx;
    const style = scene.playerConfig && scene.playerConfig.style ? StyleDatabase[scene.playerConfig.style] : null;
    const weapon = scene.playerConfig && scene.playerConfig.weapon ? WeaponDatabase[scene.playerConfig.weapon] : null;
    const enemy = anchors.enemy.config || EnemyDatabase.base;

    this.drawActorNameplate(ctx, {
      x: anchors.player.x,
      y: anchors.player.y + 58,
      color: anchors.player.color,
      title: style ? style.name : "未选择风格",
      subtitle: weapon ? weapon.name : "战斗准备"
    });

    const phase = this.getEncounterPhaseLabel(scene, enemy);
    this.drawActorNameplate(ctx, {
      x: anchors.enemy.x,
      y: anchors.enemy.y + 66,
      color: anchors.enemy.color,
      title: enemy.name || "敌人",
      subtitle: phase
    });
  }

  getEncounterPhaseInfo(scene) {
    if (!scene || !scene.encounterConfig || !Array.isArray(scene.encounterConfig.phases)) return null;
    if (typeof scene.getCurrentEncounterPhase === "function") {
      const current = scene.getCurrentEncounterPhase();
      if (current) return current;
    }
    const activeId = scene.activeEncounterPhaseId;
    if (!activeId || activeId === "base") return null;
    return scene.encounterConfig.phases.find(phase => phase && phase.id === activeId) || {
      id: activeId,
      name: activeId
    };
  }

  getEncounterPhaseLabel(scene, enemy = null) {
    const phase = this.getEncounterPhaseInfo(scene);
    if (phase && phase.name) return phase.name;
    return enemy && enemy.model && enemy.model.type ? enemy.model.type : "enemy";
  }

  getEnemyEncounterPhaseVisuals(scene) {
    const phase = this.getEncounterPhaseInfo(scene);
    if (!phase) return { active: false };
    const theme = this.getEncounterStageTheme(scene);
    const hpRatio = scene && scene.enemyMaxHp > 0 ? Utils.clamp(scene.enemyHp / scene.enemyMaxHp, 0, 1) : 1;
    return {
      active: true,
      key: theme.key || "neutral",
      phaseId: phase.id || "",
      phaseName: phase.name || phase.id || "",
      color: theme.accent || "#e74c3c",
      secondary: theme.secondary || theme.accent || "#ffffff",
      intensity: Utils.clamp(0.46 + (1 - hpRatio) * 0.74, 0.52, 1.0)
    };
  }

  drawEnemyEncounterPhaseOverlay(ctx, scene, x, y, visuals, t) {
    if (!visuals || !visuals.active) return;
    const ornamentScale = this.visualScale("ornament");
    if (ornamentScale <= 0.05) return;
    const color = visuals.color || "#e74c3c";
    const secondary = visuals.secondary || color;
    const intensity = Utils.clamp(visuals.intensity || 0.65, 0, 1) * ornamentScale;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = color;
    ctx.shadowBlur = 3 + intensity * 7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (visuals.key === "forge") {
      ctx.strokeStyle = this.hexToRgba("#ff6b35", 0.10 + intensity * 0.18);
      ctx.fillStyle = this.hexToRgba("#e74c3c", 0.012 + intensity * 0.026);
      ctx.lineWidth = 1.4 + intensity;
      ctx.beginPath();
      ctx.ellipse(x, y + 54, 78 + intensity * 10, 18 + intensity * 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 2; i++) {
        const ox = -22 + i * 44;
        const phase = t * 5 + i * 1.7;
        ctx.beginPath();
        ctx.moveTo(x + ox, y + 38);
        ctx.lineTo(x + ox + Math.sin(phase) * 6, y + 12 - Math.abs(Math.sin(phase)) * 18);
        ctx.stroke();
      }
    } else if (visuals.key === "arcane") {
      ctx.strokeStyle = this.hexToRgba(color, 0.08 + intensity * 0.18);
      ctx.lineWidth = 1.3;
      for (let i = 0; i < 2; i++) {
        const r = 38 + i * 18 + Math.sin(t * 2.4 + i) * 2;
        ctx.beginPath();
        ctx.ellipse(x, y - 12, r, r * 0.34, t * 0.3 + i * 0.4, 0, Math.PI * 2);
        ctx.stroke();
      }
      this.drawStageGlyph(ctx, x, y - 10, 18 + intensity * 6, secondary, t * 0.9, 0.10 + intensity * 0.12);
    } else if (visuals.key === "rain") {
      ctx.strokeStyle = this.hexToRgba("#5dade2", 0.08 + intensity * 0.16);
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        const ox = -34 + i * 34 + Math.sin(t * 3 + i) * 3;
        const top = y - 70 + (i % 3) * 8;
        ctx.beginPath();
        ctx.moveTo(x + ox, top);
        ctx.lineTo(x + ox - 18, top + 72);
        ctx.stroke();
      }
      ctx.strokeStyle = this.hexToRgba(color, 0.10 + intensity * 0.16);
      ctx.beginPath();
      ctx.arc(x - 10, y - 6, 58 + Math.sin(t * 5) * 4, -0.35, Math.PI * 0.86);
      ctx.stroke();
    } else if (visuals.key === "rite") {
      ctx.strokeStyle = this.hexToRgba("#f1c40f", 0.08 + intensity * 0.18);
      ctx.fillStyle = this.hexToRgba(color, 0.015 + intensity * 0.024);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(x - 54, y - 66, 108, 124, 14);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = this.hexToRgba(secondary, 0.08 + intensity * 0.16);
      ctx.beginPath();
      ctx.moveTo(x - 42, y - 18);
      ctx.lineTo(x + 42, y - 18);
      ctx.moveTo(x, y - 56);
      ctx.lineTo(x, y + 44);
      ctx.stroke();
    } else if (visuals.key === "dojo") {
      ctx.strokeStyle = this.hexToRgba("#2fffd1", 0.08 + intensity * 0.18);
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.arc(x, y + 6, 56 + i * 17 + Math.sin(t * 4 + i) * 3, -0.86, Math.PI * 1.06);
        ctx.stroke();
      }
      ctx.strokeStyle = this.hexToRgba(secondary, 0.08 + intensity * 0.14);
      ctx.beginPath();
      ctx.moveTo(x - 56, y + 50);
      ctx.lineTo(x + 56, y + 50);
      ctx.moveTo(x - 36, y + 64);
      ctx.lineTo(x + 36, y + 36);
      ctx.stroke();
    } else {
      ctx.strokeStyle = this.hexToRgba(color, 0.08 + intensity * 0.14);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(x, y - 8, 62, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawActorNameplate(ctx, options) {
    const width = 154;
    const height = 32;
    const x = options.x - width / 2;
    const y = options.y;
    ctx.save();
    ctx.fillStyle = "rgba(6, 8, 14, 0.64)";
    ctx.strokeStyle = this.hexToRgba(options.color || "#ffffff", 0.72);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = options.color || "#ffffff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(this.truncateText(ctx, options.title || "", width - 14), options.x, y + 5);
    ctx.fillStyle = "#aeb7c4";
    ctx.font = "10px sans-serif";
    ctx.fillText(this.truncateText(ctx, options.subtitle || "", width - 14), options.x, y + 18);
    ctx.restore();
  }

  drawActorMotionLines(ctx, x, y, reaction, actor, color) {
    if (!reaction || !reaction.type) return;
    const visualScale = this.visualScale("motionLines");
    if (visualScale <= 0.05) return;
    const type = reaction.type;
    const progress = reaction.progress || 0;
    const fade = Math.max(0, 1 - progress);
    const forward = actor === "enemy" ? -1 : 1;
    const away = actor === "enemy" ? 1 : -1;
    const lineColor = reaction.color || color || "#ffffff";

    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 5;
    ctx.lineCap = "round";

    if (type === "attack" || type === "dodge") {
      ctx.globalAlpha = 0.36 * fade * visualScale;
      ctx.lineWidth = type === "attack" ? 4 : 3;
      for (let i = 0; i < 2; i++) {
        const yy = y - 28 + i * 24;
        const tail = x - forward * (58 + i * 8);
        const head = x - forward * (18 + i * 3);
        ctx.beginPath();
        ctx.moveTo(tail, yy + Math.sin(progress * Math.PI + i) * 5);
        ctx.lineTo(head, yy - forward * 2);
        ctx.stroke();
      }
    } else if (type === "windup" || type === "cast") {
      ctx.globalAlpha = (type === "windup" ? 0.28 : 0.20) * fade * visualScale;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + forward * 18, y - 12, 48 + Math.sin(progress * Math.PI) * 8, -0.7, 0.9);
      ctx.stroke();
    } else if (type === "hit" || type === "crit" || type === "stagger") {
      ctx.globalAlpha = (type === "crit" ? 0.52 : 0.32) * fade * visualScale;
      ctx.lineWidth = type === "crit" ? 5 : 3;
      for (let i = 0; i < 3; i++) {
        const spread = (i - 1) * 18;
        ctx.beginPath();
        ctx.moveTo(x - away * 8, y - 30 + spread);
        ctx.lineTo(x + away * (42 + i * 6), y - 40 + spread * 0.75);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  drawActorPerformanceAfterimage(ctx, actor, x, y, color, performance, t) {
    if (!performance || performance.afterimageAlpha <= 0.02) return;
    const visualScale = this.visualScale("afterimage");
    if (visualScale <= 0.05) return;
    const count = Math.max(1, Math.min(2, performance.afterimageCount || 1));
    const forward = actor === "enemy" ? -1 : 1;
    const alpha = performance.afterimageAlpha * visualScale;
    const width = actor === "enemy" ? 52 : 42;
    const height = actor === "enemy" ? 72 : 58;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = color || "#ffffff";
    ctx.fillStyle = this.hexToRgba(color || "#ffffff", 0.10);
    ctx.shadowColor = color || "#ffffff";
    ctx.shadowBlur = 6;
    for (let i = count; i >= 1; i--) {
      const ratio = i / count;
      const ox = -forward * (16 + i * 13 + (performance.stride || 0) * 0.2);
      const oy = 2 + i * 2 + Math.sin(t * 9 + i) * 1.5;
      ctx.globalAlpha = alpha * (0.38 + (1 - ratio) * 0.24);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x + ox - width / 2, y + oy - height / 2 + 4, width, height, actor === "enemy" ? 12 : 10);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + ox, y + oy - height / 2 - 14, actor === "enemy" ? 14 : 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  getActorFootworkVisuals(actor, x, groundY, color, performance = {}, rig = {}, context = {}) {
    const forward = actor === "enemy" ? -1 : 1;
    const t = context.t || 0;
    const stance = Math.max(0.72, rig.stance || 1);
    const torsoW = rig.torsoW || (actor === "enemy" ? 56 : 44);
    const stride = Math.max(0, performance.stride || 0);
    const attack = Math.max(0, performance.attack || 0);
    const windup = Math.max(0, performance.windup || 0);
    const brace = Math.max(0, performance.brace || 0);
    const cast = Math.max(0, performance.cast || 0);
    const hit = Math.max(0, performance.hitSquash || 0);
    const poseIntensity = Math.max(0, context.poseIntensity || performance.poseIntensity || 0);
    const state = context.state || "";
    const motion = context.motion || performance.motion || context.enemyPose || "";
    const action = Math.max(attack, windup * 0.82, brace * 0.72, cast * 0.68, hit * 0.95, poseIntensity * 0.78);
    const idleBreath = 0.08 + Math.abs(Math.sin(t * 2.3 + (actor === "enemy" ? 0.8 : 0))) * 0.035;
    const active = action > 0.05 || stride > 1 || state === "shield" || state === "casting" || state === "charge";
    const baseAlpha = active ? Utils.clamp(0.18 + action * 0.38, 0.18, 0.66) : idleBreath;
    const stanceWidth = (actor === "enemy" ? 42 : 34) * stance + Math.max(0, torsoW - 44) * 0.18;
    const stepDrive = stride * 0.42 + attack * 18 + poseIntensity * 14;
    const bracePull = brace * 12 + windup * 7 + hit * 10;
    const castLift = cast * 4;
    const jitter = Math.sin(t * 8 + (actor === "enemy" ? 1.4 : 0.2)) * Math.min(2.5, action * 2.8);
    const frontIndex = forward > 0 ? 1 : 0;
    const rearIndex = forward > 0 ? 0 : 1;
    const feet = [
      {
        x: x - stanceWidth * 0.52 + jitter * 0.35,
        y: groundY + 2 + castLift,
        w: actor === "enemy" ? 25 : 20,
        h: 8,
        angle: -0.12,
        alpha: baseAlpha * 0.78
      },
      {
        x: x + stanceWidth * 0.50 - jitter * 0.25,
        y: groundY + 1 - Math.min(5, stride * 0.08),
        w: actor === "enemy" ? 27 : 22,
        h: 8,
        angle: 0.10,
        alpha: baseAlpha
      }
    ];

    feet[frontIndex].x += forward * stepDrive;
    feet[frontIndex].w += Math.min(12, stepDrive * 0.22);
    feet[frontIndex].alpha = Math.min(0.82, feet[frontIndex].alpha + action * 0.18);
    feet[rearIndex].x -= forward * bracePull;
    feet[rearIndex].w += Math.min(9, bracePull * 0.20);
    feet[rearIndex].alpha = Math.min(0.78, feet[rearIndex].alpha + (brace + windup + hit) * 0.15);

    if (motion === "dualRetreat") {
      feet[frontIndex].x -= forward * 20;
      feet[rearIndex].x -= forward * 12;
    } else if (motion === "dualDash" || motion === "flameBladeBurst" || motion === "greatswordEarthsplit") {
      feet[frontIndex].x += forward * 14;
      feet[frontIndex].y -= 2;
    } else if (motion === "overflowCompress" || motion === "cast") {
      feet[0].x -= 3;
      feet[1].x += 3;
      feet[0].alpha += 0.08;
      feet[1].alpha += 0.08;
    }

    const trailCount = Utils.clamp(Math.ceil((stride + action * 22) / 12), 0, 3);
    const trails = [];
    for (let i = 1; i <= trailCount; i++) {
      const ratio = i / Math.max(1, trailCount);
      trails.push({
        x: feet[frontIndex].x - forward * (10 + i * 10 + stride * 0.16),
        y: feet[frontIndex].y + i * 1.5,
        w: feet[frontIndex].w * (1.05 - ratio * 0.20),
        h: Math.max(4, feet[frontIndex].h * (0.82 - ratio * 0.10)),
        alpha: baseAlpha * (0.30 - ratio * 0.08),
        angle: feet[frontIndex].angle
      });
    }

    return {
      active: baseAlpha > 0.05,
      actor,
      color,
      forward,
      pressure: Utils.clamp(baseAlpha + action * 0.22, 0.08, 0.88),
      action,
      feet,
      trails,
      center: {
        x: (feet[0].x + feet[1].x) / 2 + forward * (attack * 10 - brace * 5),
        y: groundY + 8,
        w: Math.abs(feet[1].x - feet[0].x) + 26,
        h: 13
      }
    };
  }

  drawActorFootworkLayer(ctx, visuals) {
    if (!visuals || !visuals.active || !Array.isArray(visuals.feet)) return;
    const color = visuals.color || "#ffffff";

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const center = visuals.center || { x: 0, y: 0, w: 50, h: 12 };
    ctx.fillStyle = this.hexToRgba(color, 0.055 + (visuals.pressure || 0) * 0.10);
    ctx.strokeStyle = this.hexToRgba(color, 0.08 + (visuals.pressure || 0) * 0.18);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, center.w * 0.5, center.h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    for (const trail of visuals.trails || []) {
      ctx.save();
      ctx.globalAlpha = Utils.clamp(trail.alpha || 0, 0, 0.45);
      ctx.translate(trail.x, trail.y);
      ctx.rotate(trail.angle || 0);
      ctx.fillStyle = this.hexToRgba(color, 0.36);
      ctx.beginPath();
      ctx.ellipse(0, 0, trail.w * 0.5, trail.h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const foot of visuals.feet) {
      ctx.save();
      ctx.globalAlpha = Utils.clamp(foot.alpha || 0, 0, 0.85);
      ctx.translate(foot.x, foot.y);
      ctx.rotate(foot.angle || 0);
      ctx.shadowColor = color;
      ctx.shadowBlur = 8 + (visuals.action || 0) * 10;
      ctx.fillStyle = this.hexToRgba(color, 0.34);
      ctx.strokeStyle = this.hexToRgba("#ffffff", 0.18);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, foot.w * 0.5, foot.h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if ((visuals.action || 0) > 0.32) {
      const edge = visuals.forward || 1;
      ctx.strokeStyle = this.hexToRgba(color, Utils.clamp((visuals.action || 0) * 0.26, 0.05, 0.30));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(center.x - edge * center.w * 0.18, center.y - 2);
      ctx.lineTo(center.x + edge * center.w * 0.48, center.y - 7);
      ctx.stroke();
    }

    ctx.restore();
  }

  getActorImpactReactionVisuals(scene, target, reaction = null, performance = null) {
    const currentReaction = reaction || this.getActorReaction(scene, target);
    const type = currentReaction && currentReaction.type;
    const isHit = type === "hit" || type === "crit" || type === "stagger";
    if (!isHit) return { active: false };

    const progress = Utils.clamp(currentReaction.progress || 0, 0, 1);
    const pulse = Math.sin(progress * Math.PI);
    const fade = Math.max(0, 1 - progress);
    const incoming = this.getActorActiveAttack(scene, target, "target");
    const incomingProfile = incoming && incoming.profile ? incoming.profile : {};
    const fallbackDirection = target === "enemy" ? 1 : -1;
    const direction = currentReaction.direction
      || (Math.abs(currentReaction.offsetX || 0) > 0.01 ? Math.sign(currentReaction.offsetX) : fallbackDirection);
    const perf = performance || {};
    const force = Utils.clamp(
      (currentReaction.intensity || 1)
      + Math.max(0, (currentReaction.scale || 1) - 1) * 3.2
      + (perf.hitSquash || 0) * 1.8
      + ((incomingProfile.radius || 0) > 40 ? 0.22 : 0),
      0.55,
      2.05
    );
    const critical = type === "crit";
    const heavy = critical || type === "stagger" || force > 1.22 || (incomingProfile.radius || 0) >= 42;
    const kind = incomingProfile.type || (incoming && incoming.intent && incoming.intent.shape) || "melee";
    const color = currentReaction.color || incomingProfile.color || (critical ? "#f1c40f" : "#ffffff");
    const radius = Utils.clamp((target === "enemy" ? 34 : 28) + force * 16 + (heavy ? 10 : 0), 30, target === "enemy" ? 82 : 66);

    return {
      active: fade > 0.02 && pulse > 0.03,
      target,
      type,
      kind,
      color,
      progress,
      pulse,
      fade,
      alpha: Utils.clamp((critical ? 0.80 : 0.58) * fade + pulse * 0.14, 0, critical ? 0.92 : 0.72),
      direction: direction || fallbackDirection,
      force,
      radius,
      heavy,
      critical,
      slashLike: kind === "melee" || kind === "arc" || kind === "slash",
      spellLike: kind === "beam" || kind === "projectile" || kind === "pulse" || kind === "circle"
    };
  }

  drawActorImpactReactionLayer(ctx, target, x, y, visuals, color, t) {
    if (!visuals || !visuals.active) return;
    const impactScale = this.visualScale("impact");
    if (impactScale <= 0.05) return;

    const enemy = target === "enemy";
    const direction = visuals.direction || (enemy ? 1 : -1);
    const alpha = (visuals.alpha || 0) * impactScale;
    if (alpha <= 0.02) return;

    const p = this.easeOutCubic(visuals.progress || 0);
    const pulse = visuals.pulse || Math.sin((visuals.progress || 0) * Math.PI);
    const impactX = x - direction * (enemy ? 34 : 26);
    const impactY = y - (enemy ? 24 : 20);
    const groundY = y + (enemy ? 56 : 48);
    const radius = visuals.radius || (enemy ? 50 : 42);
    const impactColor = visuals.color || color || "#ffffff";
    const shockAngle = direction > 0 ? -0.22 : Math.PI + 0.22;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    ctx.save();
    ctx.translate(impactX, impactY);
    ctx.rotate(shockAngle);
    ctx.globalAlpha = alpha * 0.62;
    ctx.shadowColor = impactColor;
    ctx.shadowBlur = visuals.critical ? 12 : 8;
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, radius);
    grad.addColorStop(0, this.hexToRgba("#ffffff", visuals.critical ? 0.64 : 0.50));
    grad.addColorStop(0.35, this.hexToRgba(impactColor, visuals.spellLike ? 0.30 : 0.24));
    grad.addColorStop(1, this.hexToRgba(impactColor, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * (1.0 + p * 0.22), radius * (0.58 + pulse * 0.12), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = this.hexToRgba("#ffffff", 0.42 + (visuals.critical ? 0.10 : 0));
    ctx.lineWidth = visuals.heavy ? 3 : 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-radius * 0.62, -7);
    ctx.lineTo(radius * (0.55 + p * 0.18), 9);
    ctx.stroke();

    ctx.strokeStyle = this.hexToRgba(impactColor, visuals.critical ? 0.52 : 0.38);
    ctx.lineWidth = visuals.heavy ? 2 : 1.5;
    const shardCount = visuals.critical ? 5 : (visuals.heavy ? 4 : 3);
    for (let i = 0; i < shardCount; i++) {
      const side = i - (shardCount - 1) / 2;
      const spread = side * 0.23;
      const len = radius * (0.34 + (i % 3) * 0.08 + visuals.force * 0.08);
      const start = radius * 0.18;
      const a = spread + Math.sin(t * 3 + i) * 0.025;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * start, Math.sin(a) * start);
      ctx.lineTo(Math.cos(a) * (start + len), Math.sin(a) * (start + len));
      ctx.stroke();
    }

    if (visuals.critical) {
      ctx.strokeStyle = this.hexToRgba("#f1c40f", 0.42);
      ctx.lineWidth = 1.4;
      ctx.rotate(-shockAngle + t * 0.5);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        ctx.moveTo(Math.cos(a) * radius * 0.34, Math.sin(a) * radius * 0.34);
        ctx.lineTo(Math.cos(a) * radius * 0.62, Math.sin(a) * radius * 0.62);
      }
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(x + direction * 8, groundY);
    ctx.globalAlpha = alpha * (visuals.heavy ? 0.28 : 0.18);
    ctx.fillStyle = this.hexToRgba(impactColor, 0.08);
    ctx.strokeStyle = this.hexToRgba(impactColor, 0.28);
    ctx.shadowColor = impactColor;
    ctx.shadowBlur = visuals.heavy ? 7 : 4;
    ctx.lineWidth = visuals.heavy ? 2 : 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * (0.75 + p * 0.48), Math.max(5, radius * 0.12), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineCap = "round";
    for (let i = 0; i < 2; i++) {
      const yy = -2 + i * 5;
      ctx.beginPath();
      ctx.moveTo(-direction * (radius * 0.08 + i * 4), yy);
      ctx.lineTo(direction * (radius * (0.42 + i * 0.12) + p * 14), yy + 5 + i * 2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }

  getActorIntentBadgeVisuals(scene, actor, performance = null, context = {}) {
    if (!scene) return { active: false };
    const isEnemy = actor === "enemy";
    const baseColor = context.color || (isEnemy ? "#e74c3c" : "#3498db");
    const perf = performance || this.getActorPerformance(scene, actor);
    const active = this.getActorActiveAttack(scene, actor, "source");
    const incoming = this.getActorActiveAttack(scene, actor, "target");
    const pose = context.pose || null;
    let kind = "";
    let icon = "";
    let label = "";
    let phase = "";
    let color = baseColor;
    let secondary = "#ffffff";
    let progress = 0;
    let intensity = 0;
    let side = isEnemy ? -1 : 1;

    if (active) {
      const profile = active.profile || {};
      const spellLike = profile.type === "projectile" || profile.type === "beam" || profile.type === "pulse";
      kind = spellLike ? "cast" : "attack";
      icon = spellLike ? "✦" : "!";
      label = spellLike ? "spell-release" : "weapon-release";
      phase = active.phase || "active";
      color = profile.color || baseColor;
      progress = Utils.clamp(active.progress || 0, 0, 1);
      intensity = Utils.clamp(0.52 + progress * 0.44 + (phase === "impact" ? 0.22 : 0), 0.55, 1.15);
    } else if (isEnemy && scene.enemyAttack && scene.enemyAttackPhase && scene.enemyAttackPhase !== "none" && scene.enemyAttackPhase !== "canceled") {
      const attack = scene.enemyAttack;
      const telegraphType = attack.telegraph && attack.telegraph.type ? attack.telegraph.type : (attack.type || "");
      const spellLike = ["spell", "bolt", "burst"].includes(telegraphType) || !!attack.interruptible;
      const phasePower = scene.enemyAttackPhase === "hit" ? 1 : (scene.enemyAttackPhase === "response" ? 0.82 : 0.48);
      const phaseMax = scene.enemyAttackPhase === "windup"
        ? attack.windup
        : (scene.enemyAttackPhase === "response" ? attack.responseWindow : attack.hitDuration);
      const timer = scene.enemyAttackTimer || 0;
      kind = spellLike ? "cast" : "attack";
      icon = attack.icon || (spellLike ? "✦" : "!");
      label = scene.enemyAttackPhase === "response" ? "enemy-window" : "enemy-intent";
      phase = scene.enemyAttackPhase;
      color = attack.color || baseColor;
      progress = phaseMax ? Utils.clamp(timer / phaseMax, 0, 1) : 0.5;
      intensity = Utils.clamp(0.38 + phasePower * 0.58, 0.42, 1.1);
      side = -1;
    } else if (!isEnemy && incoming && scene.turnState === "enemy_turn") {
      kind = "defense";
      icon = "◇";
      label = "incoming-defense";
      phase = incoming.phase || "incoming";
      color = baseColor;
      progress = Utils.clamp(incoming.progress || 0, 0, 1);
      intensity = Utils.clamp(0.46 + progress * 0.32, 0.46, 0.88);
    } else if (!isEnemy && scene.turnState === "enemy_turn" && scene.enemyAttackPhase === "response") {
      kind = "defense";
      icon = "◇";
      label = "defense-window";
      phase = "response";
      color = baseColor;
      progress = 0.78;
      intensity = 0.82;
    } else if (!isEnemy && pose && (pose.state === "casting" || pose.state === "charge")) {
      kind = "cast";
      icon = "✦";
      label = "player-cast";
      phase = pose.state;
      color = baseColor;
      progress = Utils.clamp(perf.actionProgress || perf.cast || 0.5, 0, 1);
      intensity = Utils.clamp(0.42 + (perf.cast || 0.4) * 0.48, 0.42, 0.95);
    } else if (!isEnemy && scene.turnState === "qte_running" && scene.qteRunner) {
      kind = "qte";
      icon = "Q";
      label = "qte-input";
      phase = "input";
      color = baseColor;
      progress = scene.qteRunner.currentNodeProgress ? scene.qteRunner.currentNodeProgress() : 0.5;
      intensity = 0.58;
    }

    const hitPressure = Math.max(0, perf && perf.hitSquash || 0);
    if (!kind && hitPressure > 0.12) {
      kind = "hit";
      icon = "×";
      label = "hit-react";
      phase = "reaction";
      color = baseColor;
      progress = Utils.clamp(hitPressure, 0, 1);
      intensity = Utils.clamp(0.46 + hitPressure * 0.7, 0.46, 1.0);
    }

    if (!kind || intensity <= 0.05) return { active: false };

    const offsetX = side * (isEnemy ? 54 : 46);
    const offsetY = kind === "defense" ? -42 : (kind === "hit" ? -60 : -70);
    return {
      active: true,
      actor,
      kind,
      icon,
      label,
      phase,
      color,
      secondary,
      intensity: Utils.clamp(intensity, 0, 1.2),
      progress: Utils.clamp(progress, 0, 1),
      x: offsetX,
      y: offsetY,
      radius: kind === "qte" ? 15 : (kind === "hit" ? 13 : 17),
      side
    };
  }

  drawActorIntentBadgeLayer(ctx, x, y, visuals, t) {
    if (!visuals || !visuals.active) return;
    const ornamentScale = this.visualScale("ornament");
    if (ornamentScale <= 0.05) return;
    const color = visuals.color || "#f1c40f";
    const intensity = Utils.clamp(visuals.intensity || 0.5, 0, 1.2) * ornamentScale;
    const progress = Utils.clamp(visuals.progress || 0, 0, 1);
    const pulse = 0.5 + Math.sin(t * 8 + progress * Math.PI) * 0.5;
    const bx = x + (visuals.x || 0);
    const by = y + (visuals.y || -64);
    const radius = visuals.radius || 16;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(bx, by);
    ctx.shadowColor = color;
    ctx.shadowBlur = 3 + intensity * 5;

    ctx.fillStyle = this.hexToRgba("#071018", 0.44 + intensity * 0.08);
    ctx.strokeStyle = this.hexToRgba(color, 0.20 + intensity * 0.18);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, radius + intensity * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const start = -Math.PI * 0.5;
    const end = start + Math.PI * 2 * progress;
    ctx.strokeStyle = this.hexToRgba("#ffffff", 0.36 + intensity * 0.12);
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 4, start, end);
    ctx.stroke();

    if (visuals.kind === "attack" || visuals.kind === "cast") {
      ctx.strokeStyle = this.hexToRgba(color, 0.16 + intensity * 0.12);
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 2; i++) {
        const a = -0.7 + i * 0.7 + pulse * 0.15;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (radius + 7), Math.sin(a) * (radius + 7));
        ctx.lineTo(Math.cos(a) * (radius + 15 + intensity * 4), Math.sin(a) * (radius + 15 + intensity * 4));
        ctx.stroke();
      }
    } else if (visuals.kind === "defense") {
      ctx.strokeStyle = this.hexToRgba(color, 0.26 + intensity * 0.12);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, -radius - 5);
      ctx.lineTo(radius + 6, 0);
      ctx.lineTo(0, radius + 5);
      ctx.lineTo(-radius - 6, 0);
      ctx.closePath();
      ctx.stroke();
    } else if (visuals.kind === "hit") {
      ctx.strokeStyle = this.hexToRgba("#ffffff", 0.42);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.6, -radius * 0.6);
      ctx.lineTo(radius * 0.6, radius * 0.6);
      ctx.moveTo(radius * 0.6, -radius * 0.6);
      ctx.lineTo(-radius * 0.6, radius * 0.6);
      ctx.stroke();
    }

    ctx.fillStyle = visuals.kind === "hit" ? this.hexToRgba("#ffffff", 0.72) : this.hexToRgba("#ffffff", 0.78);
    ctx.font = visuals.kind === "qte" ? "bold 12px sans-serif" : "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(visuals.icon || "!", 0, 1);

    ctx.globalAlpha = 0.20 + intensity * 0.16;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-visuals.side * 8, radius + 5);
    ctx.lineTo(-visuals.side * 22, radius + 18);
    ctx.stroke();
    ctx.restore();
  }

  getActorDamageVisuals(scene, target) {
    const maxHp = target === "player"
      ? Number(scene && scene.playerMaxHp || 100)
      : Number(scene && scene.enemyMaxHp || (scene && scene.enemyConfig && scene.enemyConfig.maxHp) || 100);
    const hp = target === "player"
      ? Number((scene && scene.playerHp) ?? maxHp)
      : Number((scene && scene.enemyHp) ?? maxHp);
    const ratio = maxHp > 0 ? Utils.clamp(hp / maxHp, 0, 1) : 1;
    const wounded = Utils.clamp(1 - ratio, 0, 1);
    const critical = ratio > 0 && ratio <= 0.34;
    const defeated = hp <= 0;
    const reaction = scene && scene.actorReactions && scene.actorReactions.get
      ? scene.actorReactions.get(target)
      : null;
    const recentHit = !!(reaction && (reaction.type === "hit" || reaction.type === "crit" || reaction.type === "stagger"));

    return {
      hp,
      maxHp,
      ratio,
      wounded,
      critical,
      defeated,
      recentHit,
      tier: defeated ? 4 : (critical ? 3 : (wounded >= 0.42 ? 2 : (wounded >= 0.16 ? 1 : 0)))
    };
  }

  drawActorDamageMarks(ctx, target, x, y, visuals, color, t) {
    if (!visuals || visuals.wounded < 0.08) return;

    const enemy = target === "enemy";
    const severity = visuals.tier || 0;
    const wounded = visuals.wounded || 0;
    const pulse = visuals.critical ? 0.55 + Math.sin(t * 7.5) * 0.12 : 0;
    const markColor = visuals.critical ? "#ff5a4f" : (enemy ? "#ff8a5c" : "#ff7b72");
    const count = Math.min(6, 2 + severity + Math.floor(wounded * 3));
    const marks = enemy
      ? [
        [-22, -32, -7, -15, -15, 4],
        [18, -26, 5, -8, 16, 13],
        [-4, -44, 6, -23, -2, -6],
        [28, 4, 13, 18, 24, 33],
        [-30, 8, -16, 24, -28, 38],
        [4, 16, -8, 30, 7, 42]
      ]
      : [
        [-16, -25, -4, -10, -13, 5],
        [18, -18, 6, -3, 15, 14],
        [-2, -36, 5, -20, -2, -4],
        [24, 4, 12, 16, 21, 29],
        [-24, 7, -13, 22, -23, 34],
        [2, 14, -5, 28, 6, 38]
      ];

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    if (visuals.critical) {
      ctx.strokeStyle = this.hexToRgba("#e74c3c", 0.22 + pulse * 0.20);
      ctx.fillStyle = this.hexToRgba("#e74c3c", 0.04 + pulse * 0.06);
      ctx.shadowColor = "#e74c3c";
      ctx.shadowBlur = 16 + pulse * 18;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y - (enemy ? 4 : 0), enemy ? 76 : 58, enemy ? 88 : 72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.strokeStyle = this.hexToRgba(markColor, 0.42 + wounded * 0.36);
    ctx.shadowColor = markColor;
    ctx.shadowBlur = 10 + wounded * 10;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let i = 0; i < count; i++) {
      const mark = marks[i % marks.length];
      const jitter = Math.sin(t * 3.1 + i) * (visuals.recentHit ? 1.8 : 0.6);
      ctx.lineWidth = 2 + Math.min(2, wounded * 2.4);
      ctx.globalAlpha = 0.46 + wounded * 0.30 - i * 0.035;
      ctx.beginPath();
      ctx.moveTo(x + mark[0], y + mark[1] + jitter);
      ctx.lineTo(x + mark[2], y + mark[3] - jitter * 0.4);
      ctx.lineTo(x + mark[4], y + mark[5] + jitter * 0.6);
      ctx.stroke();

      if (severity >= 2 && i < 3) {
        ctx.globalAlpha *= 0.55;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + mark[2], y + mark[3]);
        ctx.lineTo(x + mark[2] + (i % 2 === 0 ? 10 : -10), y + mark[3] + 10 + i * 2);
        ctx.stroke();
      }
    }

    if (visuals.defeated) {
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = "#e74c3c";
      ctx.beginPath();
      ctx.ellipse(x, y + (enemy ? 56 : 48), enemy ? 74 : 56, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  getActorStatusVisuals(scene, target) {
    const statuses = scene && scene.statusSystem && scene.statusSystem.list
      ? scene.statusSystem.list(target)
      : [];
    const has = (id) => statuses.some(status => status.id === id);
    const durationOf = (id) => {
      const status = statuses.find(item => item.id === id);
      return status ? status.duration || 0 : 0;
    };

    if (target === "player") {
      const playerState = scene.playerState || {};
      const resourceSystem = scene.resourceSystem || null;
      const heat = resourceSystem ? Number(resourceSystem.heat || 0) : 0;
      const maxHeat = resourceSystem ? Number(resourceSystem.maxHeat || 100) : 100;
      const spellEnergy = Number(playerState.spellEnergy || 0);
      const spellCap = resourceSystem && resourceSystem.getSpellEnergyCap
        ? Number(resourceSystem.getSpellEnergyCap() || playerState.maxSpellEnergy || 100)
        : Number(playerState.maxSpellEnergy || 100);
      return {
        statuses,
        heat,
        heatRatio: maxHeat > 0 ? Utils.clamp(heat / maxHeat, 0, 1.2) : 0,
        spellEnergy,
        spellRatio: spellCap > 0 ? Utils.clamp(spellEnergy / spellCap, 0, 1.5) : 0,
        absorbReady: !!playerState.absorbReady || has("absorbReady"),
        shieldEnchant: !!playerState.shieldEnchanted || has("shieldEnchant"),
        overload: has("overload") || spellEnergy > spellCap || (maxHeat > 0 && heat / maxHeat >= 0.85),
        overloadDuration: durationOf("overload")
      };
    }

    return {
      statuses,
      burn: has("burn"),
      burnDuration: durationOf("burn"),
      armorBreak: !!(scene && scene.armorBreakActive) || has("armorBreak"),
      armorBreakDuration: scene && scene.armorBreakActive ? scene.armorBreakTurns : durationOf("armorBreak"),
      stun: !!(scene && scene.enemyStunTimer > 0) || has("stun"),
      stunDuration: scene && scene.enemyStunTimer > 0 ? scene.enemyStunTimer : durationOf("stun")
    };
  }

  getPlayerDefenseIntentVisuals(scene, statusVisuals = null) {
    if (!scene || scene.turnState !== "enemy_turn" || !scene.enemyAttack) return { active: false };
    const phase = scene.enemyAttackPhase || "none";
    if (phase !== "windup" && phase !== "response" && phase !== "hit") return { active: false };
    const attack = scene.enemyAttack;
    const allowed = Array.isArray(attack.allowedResponses) ? attack.allowedResponses : [];
    const hasResponse = id => allowed.includes(id);
    const telegraph = this.getEnemyTelegraph(attack);
    const meta = this.getEnemyAttackMeta(attack);
    const metrics = this.getEnemyTimingMetrics(scene, attack);
    const inResponse = phase === "response";
    const spellLike = ["spell", "bolt", "burst"].includes(telegraph.type)
      || attack.interruptible
      || /spell|arcane|curse|咒|术/.test(`${attack.id || ""} ${attack.name || ""}`);
    const playerState = scene.playerState || {};
    const absorbReady = !!playerState.absorbReady || !!(statusVisuals && statusVisuals.absorbReady);
    const shieldEnchant = !!playerState.shieldEnchanted || !!(statusVisuals && statusVisuals.shieldEnchant);
    const guardStance = typeof RenderStateHelpers !== "undefined"
      ? RenderStateHelpers.getGuardStance(scene)
      : (scene.getGuardStanceView ? scene.getGuardStanceView() : { active: false, ratio: 0 });
    const baseIntensity = inResponse ? 1 : (phase === "hit" ? 0.82 : 0.46);

    return {
      active: true,
      phase,
      inResponse,
      spellLike,
      threat: meta.threat,
      type: telegraph.type,
      shape: telegraph.shape,
      color: attack.color || meta.threatColor || "#2ecc71",
      dodge: hasResponse("dodge"),
      parry: hasResponse("parry"),
      guard: hasResponse("guard") || !!guardStance.active,
      guardStance,
      absorbReady,
      shieldEnchant,
      intensity: Utils.clamp(baseIntensity + (metrics && metrics.timeToHit < 0.35 ? 0.12 : 0) + (guardStance.active ? 0.16 : 0), 0.25, 1.1),
      timeRatio: metrics ? Utils.clamp(metrics.progress, 0, 1) : 0
    };
  }

  drawPlayerDefenseIntentOverlay(ctx, scene, x, y, visuals, t) {
    if (!visuals || !visuals.active) return;
    const visualScale = this.visualScale("defenseIntent");
    if (visualScale <= 0.05) return;
    const alpha = (visuals.inResponse ? 0.68 : 0.18) * visualScale;
    const pulse = 0.78 + Math.sin(t * (visuals.inResponse ? 9 : 5)) * 0.10 + visuals.intensity * 0.18;
    const incomingColor = visuals.color || "#2ecc71";

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = this.hexToRgba("#2ecc71", alpha * (visuals.inResponse ? 0.24 : 0.12));
    ctx.fillStyle = this.hexToRgba("#2ecc71", alpha * 0.02);
    ctx.shadowColor = "#2ecc71";
    ctx.shadowBlur = visuals.inResponse ? 8 : 3;
    ctx.lineWidth = visuals.inResponse ? 2 : 1.2;
    if (visuals.inResponse) {
      ctx.beginPath();
      ctx.ellipse(x + 10, y + 45, 52 + pulse * 4, 12 + pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    if (visuals.dodge) {
      this.drawDefenseDodgeFootwork(ctx, x, y, alpha, t, visuals.inResponse);
    }
    if (visuals.parry) {
      this.drawDefenseParryArc(ctx, x, y, incomingColor, alpha, t, visuals.spellLike);
    }
    if (visuals.guard) {
      this.drawDefenseGuardPlane(ctx, x, y, visuals.shieldEnchant ? "#9b59b6" : incomingColor, alpha, t, visuals.inResponse);
    }
    if (visuals.spellLike || visuals.absorbReady || visuals.shieldEnchant) {
      this.drawDefenseMirrorReadiness(ctx, x, y, visuals.absorbReady ? "#5dade2" : "#9b59b6", alpha, t, visuals);
    }

    ctx.restore();
  }

  drawDefenseDodgeFootwork(ctx, x, y, alpha, t, inResponse) {
    ctx.save();
    ctx.strokeStyle = this.hexToRgba("#2ecc71", alpha * (inResponse ? 0.60 : 0.34));
    ctx.fillStyle = this.hexToRgba("#2ecc71", alpha * 0.045);
    ctx.shadowColor = "#2ecc71";
    ctx.shadowBlur = inResponse ? 6 : 2;
    ctx.lineWidth = inResponse ? 2.4 : 1.6;
    for (let i = 0; i < 2; i++) {
      const step = i + 1;
      const offset = step * 22;
      const bob = Math.sin(t * 7 + i) * 2;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(x - 4 - offset, y + 52 + side * (8 + i * 2) + bob);
        ctx.rotate(-0.45 + side * 0.12);
        ctx.beginPath();
        ctx.ellipse(0, 0, 8 - i, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  drawDefenseParryArc(ctx, x, y, color, alpha, t, spellLike) {
    ctx.save();
    const parryColor = spellLike ? "#f1dcff" : "#f1c40f";
    ctx.strokeStyle = this.hexToRgba(parryColor, alpha * 0.60);
    ctx.shadowColor = color || parryColor;
    ctx.shadowBlur = 7;
    ctx.lineWidth = 2.4;
    const cx = x + 44;
    const cy = y - 8;
    ctx.beginPath();
    ctx.arc(cx, cy, 36 + Math.sin(t * 8) * 2, -1.18, 1.10);
    ctx.stroke();
    ctx.strokeStyle = this.hexToRgba("#ffffff", alpha * 0.20);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx + 4, cy, 24, -1.05, 0.96);
    ctx.stroke();
    for (let i = 0; i < 2; i++) {
      const a = -0.95 + i * 0.74 + Math.sin(t * 5 + i) * 0.04;
      const r = 40;
      ctx.fillStyle = this.hexToRgba(parryColor, alpha * 0.46);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawDefenseGuardPlane(ctx, x, y, color, alpha, t, inResponse) {
    ctx.save();
    const guardX = x + 58;
    const guardY = y - 5;
    const wobble = Math.sin(t * 7) * 2;
    ctx.strokeStyle = this.hexToRgba(color || "#5dade2", alpha * 0.58);
    ctx.fillStyle = this.hexToRgba(color || "#5dade2", alpha * 0.055);
    ctx.shadowColor = color || "#5dade2";
    ctx.shadowBlur = inResponse ? 8 : 4;
    ctx.lineWidth = inResponse ? 2.4 : 1.6;
    ctx.beginPath();
    ctx.roundRect(guardX - 16, guardY - 38 + wobble, 34, 76, 11);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = this.hexToRgba("#ffffff", alpha * 0.28);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(guardX, guardY - 30 + wobble);
    ctx.lineTo(guardX, guardY + 30 + wobble);
    ctx.moveTo(guardX - 11, guardY - 2 + wobble);
    ctx.lineTo(guardX + 12, guardY - 2 + wobble);
    ctx.stroke();
    ctx.restore();
  }

  drawDefenseMirrorReadiness(ctx, x, y, color, alpha, t, visuals) {
    ctx.save();
    const cx = x + 34;
    const cy = y - 18;
    const radius = visuals.shieldEnchant ? 48 : 36;
    ctx.strokeStyle = this.hexToRgba(color || "#9b59b6", alpha * 0.34);
    ctx.fillStyle = this.hexToRgba(color || "#9b59b6", alpha * 0.024);
    ctx.shadowColor = color || "#9b59b6";
    ctx.shadowBlur = visuals.inResponse ? 8 : 4;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, radius * 0.48, Math.sin(t * 1.8) * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    this.drawStageGlyph(ctx, cx, cy, 14 + visuals.intensity * 5, color || "#9b59b6", -t * 0.85, alpha * 0.26);
    ctx.restore();
  }

  drawPlayerStatusAuras(ctx, scene, x, y, color, visuals, t) {
    if (!visuals) return;
    const stateDampen = scene && (scene.turnState === "enemy_turn" || scene.turnState === "attack_active") ? 0.72 : 1;
    const visualScale = this.visualScale("statusAura") * stateDampen;
    if (visualScale <= 0.05) return;
    const heatAlpha = Utils.clamp(visuals.heatRatio, 0, 1) * visualScale;
    const spellAlpha = Utils.clamp(visuals.spellRatio, 0, 1) * visualScale;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    if (heatAlpha > 0.04) {
      const flameColor = visuals.heatRatio >= 0.85 ? "#ff4d2e" : "#e67e22";
      ctx.strokeStyle = this.hexToRgba(flameColor, 0.08 + heatAlpha * 0.16);
      ctx.fillStyle = this.hexToRgba(flameColor, 0.035 + heatAlpha * 0.045);
      ctx.shadowColor = flameColor;
      ctx.shadowBlur = 5 + heatAlpha * 6;
      ctx.lineWidth = 1.2 + heatAlpha * 1.4;
      ctx.beginPath();
      ctx.ellipse(x, y + 45, 48 + heatAlpha * 20, 13 + heatAlpha * 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      for (let i = 0; i < 2; i++) {
        const phase = t * (4.6 + i * 0.4) + i * 2.2;
        const fx = x - 19 + i * 38 + Math.sin(phase) * 3;
        const fy = y + 28 - Math.abs(Math.sin(phase * 0.8)) * 12;
        this.drawStatusFlame(ctx, fx, fy, 18 + heatAlpha * 10, flameColor, phase, 0.18 + heatAlpha * 0.24);
      }
    }

    if (spellAlpha > 0.04) {
      const spellColor = visuals.overload ? "#f39c12" : "#9b59b6";
      this.drawStatusOrbit(ctx, x, y - 8, 36 + spellAlpha * 10, spellColor, t, 0.10 + spellAlpha * 0.20, visuals.overload ? 3 : 2);
      if (visuals.spellEnergy > 0) {
        const sparkCount = visuals.overload ? 2 : 1;
        for (let i = 0; i < sparkCount; i++) {
          const phase = t * 1.6 + i * Math.PI * 2 / Math.max(1, sparkCount);
          const ox = x + Math.cos(phase) * (28 + spellAlpha * 18);
          const oy = y - 12 + Math.sin(phase) * 10;
          this.drawStatusSpark(ctx, ox, oy, spellColor, 0.18 + spellAlpha * 0.20, 3 + spellAlpha * 2);
        }
      }
    }

    ctx.restore();
  }

  drawPlayerStatusOverlays(ctx, scene, x, y, color, visuals, t) {
    if (!visuals) return;
    const stateDampen = scene && (scene.turnState === "enemy_turn" || scene.turnState === "attack_active") ? 0.76 : 1;
    const visualScale = this.visualScale("statusAura") * stateDampen;
    if (visualScale <= 0.05) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (visuals.shieldEnchant) {
      const shieldColor = "#9b59b6";
      ctx.strokeStyle = this.hexToRgba(shieldColor, 0.42 * visualScale);
      ctx.fillStyle = this.hexToRgba(shieldColor, 0.04 * visualScale);
      ctx.shadowColor = shieldColor;
      ctx.shadowBlur = 7;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 42, y - 4, 42 + Math.sin(t * 7) * 3, -1.28, 1.18);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 66, y - 28);
      ctx.lineTo(x + 82, y - 4);
      ctx.lineTo(x + 66, y + 22);
      ctx.stroke();
    }

    if (visuals.absorbReady) {
      const absorbColor = "#5dade2";
      this.drawStatusOrbit(ctx, x, y - 18, 24, absorbColor, -t * 1.3, 0.24 * visualScale, 2);
      this.drawStatusSpark(ctx, x, y - 20, absorbColor, 0.38 * visualScale, 5);
    }

    if (visuals.overload) {
      const overloadColor = "#f39c12";
      ctx.strokeStyle = this.hexToRgba(overloadColor, (0.32 + Math.sin(t * 11) * 0.06) * visualScale);
      ctx.shadowColor = overloadColor;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const yy = y - 28 + i * 18;
        ctx.beginPath();
        ctx.moveTo(x - 34 + Math.sin(t * 9 + i) * 4, yy);
        ctx.lineTo(x - 10 + Math.cos(t * 8 + i) * 5, yy + 7);
        ctx.lineTo(x + 14 + Math.sin(t * 7 + i) * 4, yy + 1);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawEnemyStatusAuras(ctx, scene, x, y, color, visuals, t) {
    if (!visuals) return;
    const visualScale = this.visualScale("statusAura");
    if (visualScale <= 0.05) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    if (visuals.burn) {
      const burnColor = "#e74c3c";
      ctx.strokeStyle = this.hexToRgba(burnColor, 0.22 * visualScale);
      ctx.fillStyle = this.hexToRgba("#e67e22", 0.055 * visualScale);
      ctx.shadowColor = burnColor;
      ctx.shadowBlur = 7;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 52, 62, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 2; i++) {
        const phase = t * (5 + i * 0.35) + i * 1.4;
        this.drawStatusFlame(ctx, x - 22 + i * 44 + Math.sin(phase) * 2, y + 38 - Math.abs(Math.sin(phase)) * 10, 22, burnColor, phase, 0.32 * visualScale);
      }
    }

    if (visuals.armorBreak) {
      const crackColor = "#ff6b5f";
      ctx.strokeStyle = this.hexToRgba(crackColor, (0.22 + Math.sin(t * 8) * 0.04) * visualScale);
      ctx.shadowColor = crackColor;
      ctx.shadowBlur = 5;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, y + 54, 70, 19, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (visuals.stun) {
      this.drawStatusOrbit(ctx, x, y - 80, 30, "#f1c40f", t * 2.2, 0.34 * visualScale, 3);
    }

    ctx.restore();
  }

  drawEnemyStatusOverlays(ctx, scene, x, y, color, visuals, t) {
    if (!visuals) return;
    const visualScale = this.visualScale("statusAura");
    if (visualScale <= 0.05) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    if (visuals.armorBreak) {
      const crackColor = "#ff786d";
      ctx.strokeStyle = this.hexToRgba(crackColor, 0.46 * visualScale);
      ctx.shadowColor = crackColor;
      ctx.shadowBlur = 6;
      ctx.lineWidth = 2;
      const cracks = [
        [[x - 18, y - 26], [x - 7, y - 8], [x - 15, y + 12]],
        [[x + 20, y - 18], [x + 6, y - 2], [x + 15, y + 22]],
        [[x - 5, y - 34], [x + 3, y - 16], [x - 4, y + 4]]
      ];
      for (const crack of cracks) {
        ctx.beginPath();
        ctx.moveTo(crack[0][0], crack[0][1]);
        for (let i = 1; i < crack.length; i++) ctx.lineTo(crack[i][0], crack[i][1]);
        ctx.stroke();
      }
    }

    if (visuals.burn) {
      const burnColor = "#ff6b2f";
      for (let i = 0; i < 2; i++) {
        const phase = t * 6 + i * 1.5;
        this.drawStatusFlame(ctx, x - 18 + i * 36, y + 4 - Math.abs(Math.sin(phase)) * 8, 20, burnColor, phase, 0.28 * visualScale);
      }
    }

    if (visuals.stun) {
      const starColor = "#f1c40f";
      for (let i = 0; i < 3; i++) {
        const phase = t * 2.3 + i * Math.PI * 2 / 3;
        const sx = x + Math.cos(phase) * 36;
        const sy = y - 82 + Math.sin(phase) * 9;
        this.drawStatusStar(ctx, sx, sy, 4 + Math.sin(t * 8 + i) * 0.8, starColor, 0.42 * visualScale);
      }
    }

    ctx.restore();
  }

  drawStatusFlame(ctx, x, y, height, color, phase, alpha = 0.5) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = this.hexToRgba(color || "#e67e22", alpha);
    ctx.strokeStyle = this.hexToRgba("#ffd27a", alpha * 0.72);
    ctx.lineWidth = 1.5;
    ctx.shadowColor = color || "#e67e22";
    ctx.shadowBlur = 12;
    const sway = Math.sin(phase) * 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-10, -height * 0.34, -5 + sway, -height * 0.72, sway, -height);
    ctx.bezierCurveTo(8 + sway, -height * 0.62, 12, -height * 0.30, 0, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = this.hexToRgba("#ffd27a", alpha * 0.45);
    ctx.beginPath();
    ctx.moveTo(0, -height * 0.1);
    ctx.bezierCurveTo(-4, -height * 0.35, 0, -height * 0.54, 4 + sway * 0.25, -height * 0.68);
    ctx.bezierCurveTo(5, -height * 0.42, 6, -height * 0.24, 0, -height * 0.1);
    ctx.fill();
    ctx.restore();
  }

  drawStatusOrbit(ctx, x, y, radius, color, t, alpha = 0.45, points = 4) {
    ctx.save();
    ctx.strokeStyle = this.hexToRgba(color || "#ffffff", alpha);
    ctx.shadowColor = color || "#ffffff";
    ctx.shadowBlur = 5;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * 0.32, 0.14, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < points; i++) {
      const phase = t + i * Math.PI * 2 / points;
      const px = x + Math.cos(phase) * radius;
      const py = y + Math.sin(phase) * radius * 0.32;
      this.drawStatusSpark(ctx, px, py, color, alpha + 0.06, 2.8);
    }
    ctx.restore();
  }

  drawStatusSpark(ctx, x, y, color, alpha = 0.6, radius = 5) {
    ctx.save();
    ctx.fillStyle = this.hexToRgba(color || "#ffffff", alpha);
    ctx.shadowColor = color || "#ffffff";
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawStatusStar(ctx, x, y, radius, color, alpha = 0.75) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = this.hexToRgba(color || "#f1c40f", alpha);
    ctx.shadowColor = color || "#f1c40f";
    ctx.shadowBlur = 5;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? radius : radius * 0.45;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawPlayerSilhouette(ctx, scene, options) {
    const {
      x,
      y,
      weaponId,
      weapon,
      state,
      styleColor,
      reaction,
      progress,
      pose,
      performance,
      playerProfile: providedProfile,
      playerRig: providedRig,
      t
    } = options;
    const perf = performance || {};
    const meleePose = perf.meleePose || null;
    const meleeLoad = meleePose ? meleePose.load : 0;
    const meleeStrike = meleePose ? meleePose.strike : 0;
    const meleeContact = meleePose ? meleePose.contact : 0;
    const meleeRecover = meleePose ? meleePose.recover : 0;
    const scale = reaction.scale || 1;
    const motion = perf.motion || (pose ? pose.motion : state);
    const isAttack = state === "swordAttack" || (perf.attack || 0) > 0.35;
    const isShield = state === "shield";
    const isCast = state === "casting" || state === "charge" || (perf.cast || 0) > 0.42;
    const attackEase = meleePose
      ? Utils.clamp(meleeStrike * 0.92 + meleeContact * 0.36 + meleeRecover * 0.18, 0, 1)
      : Math.max(this.easeOutCubic(progress || 0), perf.actionProgress || 0, perf.attack || 0);
    const armReach = perf.armReach || 0;
    const stride = perf.stride || 0;
    const brace = perf.brace || 0;
    const castPower = perf.cast || 0;
    let lean = isAttack
      ? (meleePose ? (-0.18 * meleeLoad + 0.18 * attackEase - 0.06 * meleeRecover) : (-0.14 + attackEase * 0.22))
      : (isShield ? -0.10 : (isCast ? -0.06 : 0));
    if (motion === "dualDash") lean = -0.24 + attackEase * 0.15;
    if (motion === "dualRetreat") lean = 0.08 - attackEase * 0.18;
    if (motion === "greatswordEarthsplit" || motion === "flameBladeBurst") lean = -0.24 + attackEase * 0.34;
    if (motion === "greatswordCharge" || motion === "overflowCompress") lean = -0.14;
    lean += perf.lean || 0;
    const bodyColor = weaponId === "greatsword" ? "#33506f" : (weaponId === "dualBlades" ? "#255f69" : "#2f5b8f");
    const trimColor = styleColor || (weapon ? weapon.color : "#3498db");
    const playerProfile = providedProfile || this.getPlayerModelProfile(scene);
    const rig = providedRig || this.getPlayerRigProfile(playerProfile);
    const hasFire = playerProfile.hasFire;
    const hasAbsorb = playerProfile.hasAbsorb;
    const torsoW = rig.torsoW || 44;
    const torsoH = rig.torsoH || 56;
    const headRadius = rig.headRadius || 15;
    const legWidth = rig.legWidth || 9;
    const armWidth = rig.armWidth || 7;
    const stance = rig.stance || 1;
    const torsoTop = -24;
    const torsoBottom = torsoTop + torsoH;
    const hipY = torsoBottom - 10;
    const footY = torsoBottom + 18;
    const shoulderX = Math.max(14, torsoW * 0.36);
    const shoulderY = torsoTop + 14;
    const headY = torsoTop - headRadius - 9;
    const chestY = torsoTop + torsoH * 0.45;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.scale((perf.scaleX || 1) * (rig.scaleX || 1), (perf.scaleY || 1) * (rig.scaleY || 1));
    ctx.rotate(lean + (reaction.rotation || 0));

    if (this.visualLayerEnabled(scene, "actorModelDecorations")) {
      this.drawPlayerRigBackDetails(ctx, playerProfile, rig, trimColor, motion, attackEase, t);
      this.drawPlayerBackGear(ctx, weaponId, trimColor, motion, attackEase);
    }

    // legs
    this.drawLimb(ctx, -torsoW * 0.24, hipY, -22 * stance - stride * 0.25, footY, "#24364d", legWidth);
    this.drawLimb(ctx, torsoW * 0.22, hipY, 20 * stance + stride * 0.38, footY - Math.min(8, stride * 0.12), "#24364d", legWidth);

    // torso
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = trimColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = trimColor;
    ctx.shadowBlur = isCast ? 14 : 0;
    ctx.beginPath();
    ctx.roundRect(-torsoW / 2, torsoTop, torsoW, torsoH, torsoW > 48 ? 12 : 9);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (this.visualLayerEnabled(scene, "actorModelDecorations")) {
      this.drawPlayerArmorAccents(ctx, weaponId, trimColor, hasFire, hasAbsorb, t);
      this.drawPlayerLoadoutDetails(ctx, playerProfile, trimColor, motion, attackEase, t);
    }

    // head
    ctx.fillStyle = "#d7e7ff";
    ctx.beginPath();
    ctx.arc(0, headY, headRadius, 0, Math.PI * 2);
    ctx.fill();
    if (this.visualLayerEnabled(scene, "actorModelDecorations")) {
      this.drawPlayerHeadgear(ctx, weaponId, trimColor);
    }

    if (this.visualLayerEnabled(scene, "actorModelDecorations")) {
      ctx.fillStyle = trimColor;
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(weapon ? (weapon.icon || weapon.name[0]) : "?", 0, chestY);
    }

    if (isShield) {
      const shieldX = (motion === "mirrorGuard" ? 58 : 50) + brace * 9;
      this.drawLimb(ctx, shoulderX, shoulderY, shieldX - 8, -6, "#d7e7ff", armWidth);
      this.drawShieldSilhouette(ctx, shieldX, -4, trimColor, t);
      if (motion === "mirrorGuard" && this.visualLayerEnabled(scene, "actorModelDecorations")) this.drawCastFocus(ctx, shieldX + 6, -4, trimColor, t);
      this.drawLimb(ctx, -shoulderX, shoulderY + 2, -34, 10, "#d7e7ff", armWidth);
    } else if (isCast) {
      if (motion === "overflowCompress") {
        this.drawLimb(ctx, shoulderX, shoulderY, 34 + castPower * 8, -5 - castPower * 4, "#d7e7ff", armWidth);
        this.drawLimb(ctx, -shoulderX, shoulderY + 2, -34 - castPower * 8, -5 - castPower * 4, "#d7e7ff", armWidth);
        if (this.visualLayerEnabled(scene, "actorModelDecorations")) this.drawCastFocus(ctx, 0, -18 - castPower * 4, trimColor, t);
      } else if (motion === "absorbSiphon" || motion === "absorbRelease" || motion === "overflowBurst") {
        this.drawLimb(ctx, shoulderX, shoulderY, 52 + attackEase * 10 + armReach * 0.2, -18 - castPower * 5, "#d7e7ff", armWidth);
        if (this.visualLayerEnabled(scene, "actorModelDecorations")) this.drawCastFocus(ctx, 62 + attackEase * 10 + armReach * 0.2, -20 - castPower * 5, trimColor, t);
        this.drawLimb(ctx, -shoulderX, shoulderY + 2, -46, -18, "#d7e7ff", armWidth);
        if (this.visualLayerEnabled(scene, "actorModelDecorations")) this.drawCastFocus(ctx, -54, -20, trimColor, t);
      } else {
        this.drawLimb(ctx, shoulderX, shoulderY, 43 + armReach * 0.25, -30 - castPower * 8, "#d7e7ff", armWidth);
        if (this.visualLayerEnabled(scene, "actorModelDecorations")) this.drawCastFocus(ctx, 52 + armReach * 0.25, -35 - castPower * 8, trimColor, t);
        this.drawLimb(ctx, -shoulderX, shoulderY + 2, -38, -22, "#d7e7ff", armWidth);
      }
      if (weaponId === "staff") {
        const staffAngle = motion === "fireRelease" ? -0.48 : -0.22;
        this.drawWeaponSilhouette(ctx, weaponId, -30, 7, trimColor, staffAngle, 0.9);
      }
    } else if (isAttack) {
      if (weaponId === "dualBlades") {
        const retreat = motion === "dualRetreat";
        const finisher = motion === "dualFinisher";
        const drive = attackEase;
        const frontX = 34 - meleeLoad * 26 + drive * (retreat ? -12 : 52) - meleeRecover * 10 + armReach * 0.26;
        const frontY = -18 - meleeLoad * 12 + drive * (finisher ? 2 : 22) - meleeContact * 8;
        const backX = -42 + meleeLoad * 20 + drive * (retreat ? -10 : 24) + armReach * 0.10;
        const backY = -4 + meleeLoad * 14 + drive * 10 + meleeRecover * 4;
        const frontAngle = -0.95 - meleeLoad * 0.46 + drive * 1.34 - meleeRecover * 0.28;
        const backAngle = Math.PI - 0.12 - meleeLoad * 0.34 - drive * 1.02 + meleeRecover * 0.18;
        this.drawLimb(ctx, shoulderX, shoulderY, frontX - 6, frontY + 2, "#d7e7ff", armWidth);
        this.drawLimb(ctx, -shoulderX, shoulderY + 2, backX + 4, backY + 3, "#d7e7ff", armWidth);
        this.drawWeaponSilhouette(ctx, weaponId, frontX, frontY, trimColor, frontAngle, finisher ? 1.05 : 0.88);
        this.drawWeaponSilhouette(ctx, weaponId, backX, backY, trimColor, backAngle, finisher ? 0.96 : 0.82);
      } else {
        let weaponX = 36 - meleeLoad * 18 + attackEase * 44 + armReach * 0.22 - meleeRecover * 10;
        let weaponY = -18 - meleeLoad * 10 + attackEase * 22 + meleeRecover * 6;
        let angle = -0.42 - meleeLoad * 0.26 + attackEase * 0.86 + meleeRecover * 0.18;
        let weaponScale = 1;
        if (motion === "greatswordDraw") {
          weaponX = 16 - meleeLoad * 18 + attackEase * 52 + armReach * 0.20;
          weaponY = 20 - meleeLoad * 52 + attackEase * 40 + meleeRecover * 8;
          angle = -1.18 - meleeLoad * 0.38 + attackEase * 1.26 + meleeRecover * 0.26;
        } else if (motion === "greatswordEarthsplit" || motion === "flameBladeBurst" || motion === "greatswordOvercharge") {
          weaponX = 22 - meleeLoad * 20 + attackEase * 60 + armReach * 0.22 - meleeRecover * 14;
          weaponY = -12 - meleeLoad * 62 + attackEase * 58 + meleeRecover * 10;
          angle = -1.26 - meleeLoad * 0.42 + attackEase * 1.58 + meleeRecover * 0.30;
          weaponScale = 1.15;
        }
        this.drawLimb(ctx, shoulderX, shoulderY, weaponX - 6, weaponY + 4, "#d7e7ff", armWidth);
        this.drawLimb(ctx, -shoulderX, shoulderY + 2, -32 + attackEase * 10, 2, "#d7e7ff", armWidth);
        this.drawWeaponSilhouette(ctx, weaponId, weaponX, weaponY, trimColor, angle, weaponScale);
      }
    } else if (brace > 0.05) {
      const guardX = 36 + brace * 18;
      this.drawLimb(ctx, shoulderX, shoulderY + 2, guardX, -14, "#d7e7ff", armWidth);
      this.drawLimb(ctx, -shoulderX, shoulderY + 2, guardX - 18, 4, "#d7e7ff", armWidth);
      if (this.visualLayerEnabled(scene, "actorModelDecorations")) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.18 + brace * 0.22;
        ctx.strokeStyle = trimColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(guardX + 2, -5, 24 + brace * 6, -0.9, 0.95);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      this.drawLimb(ctx, shoulderX, shoulderY + 2, 36, 7, "#d7e7ff", armWidth);
      this.drawLimb(ctx, -shoulderX, shoulderY + 2, -36, 10, "#d7e7ff", armWidth);
      this.drawWeaponSilhouette(ctx, weaponId, 38, 10, trimColor, 0.25, 0.78);
    }

    if (this.visualLayerEnabled(scene, "playerWeaponActionLayer")) {
      this.drawPlayerWeaponActionLayer(ctx, this.getPlayerWeaponActionVisuals(scene, playerProfile, perf, {
        weaponId,
        motion,
        state,
        color: trimColor,
        progress: attackEase,
        isAttack,
        isCast,
        isShield
      }), t);
    }

    ctx.restore();
  }

  getPlayerWeaponActionVisuals(scene, playerProfile = {}, performance = {}, context = {}) {
    const weaponId = context.weaponId || playerProfile.weaponId || playerProfile.weapon || "";
    if (!weaponId) return { active: false };
    const motion = context.motion || performance.motion || "";
    const activeAttack = this.getActorActiveAttack(scene, "player", "source");
    const descriptor = activeAttack ? this.getPlayerActiveAttackDescriptor(activeAttack) : null;
    const progress = Utils.clamp(
      Number.isFinite(context.progress) ? context.progress
        : (Number.isFinite(performance.actionProgress) ? performance.actionProgress
          : (activeAttack && Number.isFinite(activeAttack.progress) ? activeAttack.progress : 0)),
      0,
      1
    );
    const attack = Math.max(performance.attack || 0, context.isAttack ? 0.55 : 0, activeAttack ? 0.58 : 0);
    const cast = Math.max(performance.cast || 0, context.isCast ? 0.50 : 0);
    const brace = Math.max(performance.brace || 0, context.isShield ? 0.42 : 0);
    const release = activeAttack && (activeAttack.phase === "impact" || activeAttack.phase === "reaction") ? 1 : progress;
    const styleKey = playerProfile.styleKey || "";
    const fire = !!(playerProfile.hasFire || (descriptor && descriptor.isFire) || /flame|fire|burn/i.test(motion));
    const absorb = !!(playerProfile.hasAbsorb || (descriptor && descriptor.isAbsorb) || /absorb|overflow|mirror|counterspell/i.test(motion));
    const counter = styleKey === "8" || !!(descriptor && descriptor.isCounter) || /counter|clash/i.test(motion);
    const color = context.color || playerProfile.styleColor || "#3498db";
    const actionPower = Utils.clamp(Math.max(attack, cast, brace, progress * 0.82, activeAttack ? 0.68 : 0), 0, 1.2);
    if (actionPower <= 0.06) return { active: false };

    if (weaponId === "greatsword") {
      const earthsplit = /earthsplit|burst|overcharge|flame/i.test(motion);
      return {
        active: true,
        kind: "heavy-blade-pressure",
        weaponId,
        motion,
        color,
        progress,
        intensity: actionPower,
        release,
        fire,
        absorb,
        counter,
        heavy: true,
        radius: 58 + actionPower * 36 + (earthsplit ? 18 : 0),
        arcWidth: 7 + actionPower * 5,
        groundCracks: earthsplit || release > 0.62,
        emberCount: fire ? 5 : 0,
        anchor: { x: 46 + performance.armReach * 0.18, y: -24 + release * 18 }
      };
    }

    if (weaponId === "dualBlades") {
      const hitCount = descriptor ? descriptor.hitCount : (counter ? 3 : 2);
      const finisher = !!(descriptor && descriptor.isFinisher) || /finisher|burst/i.test(motion);
      return {
        active: true,
        kind: counter ? "counter-blade-flow" : "twin-blade-flow",
        weaponId,
        motion,
        color,
        progress,
        intensity: actionPower,
        release,
        fire,
        absorb,
        counter,
        finisher,
        laneCount: Math.max(2, Math.min(5, hitCount + (finisher ? 1 : 0))),
        afterimageCount: Math.max(2, Math.min(4, Math.ceil(2 + actionPower * 2))),
        crossGuard: counter || /guard|mirror|clash/i.test(motion),
        radius: 46 + actionPower * 28 + (finisher ? 16 : 0)
      };
    }

    if (weaponId === "staff") {
      const releaseLike = /release|burst|fire|overflow/i.test(motion) || !!activeAttack;
      return {
        active: true,
        kind: "focus-staff-channel",
        weaponId,
        motion,
        color,
        progress,
        intensity: actionPower,
        release,
        fire,
        absorb,
        counter,
        releaseLike,
        orbitCount: releaseLike ? 5 : 4,
        focusRadius: 18 + actionPower * 14,
        laneWidth: 2 + actionPower * 3,
        anchor: { x: 48 + performance.armReach * 0.12, y: -34 - cast * 7 }
      };
    }

    return {
      active: true,
      kind: "simple-weapon-flow",
      weaponId,
      motion,
      color,
      progress,
      intensity: actionPower,
      release,
      fire,
      absorb,
      counter,
      radius: 38 + actionPower * 20
    };
  }

  drawPlayerWeaponActionLayer(ctx, visuals, t) {
    if (!visuals || !visuals.active) return;
    const color = visuals.color || "#3498db";
    const intensity = Utils.clamp(visuals.intensity || 0.2, 0, 1.2);
    const progress = Utils.clamp(visuals.progress || 0, 0, 1);
    const release = Utils.clamp(visuals.release || progress, 0, 1);
    const pulse = 0.5 + Math.sin(t * 8 + progress * Math.PI) * 0.5;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 + intensity * 16;

    if (visuals.kind === "heavy-blade-pressure") {
      const anchor = visuals.anchor || { x: 48, y: -18 };
      ctx.strokeStyle = this.hexToRgba(visuals.fire ? "#ffb347" : color, 0.26 + intensity * 0.34);
      ctx.lineWidth = visuals.arcWidth || 8;
      ctx.beginPath();
      ctx.arc(anchor.x - 16, anchor.y + 22, visuals.radius || 84, -Math.PI * 0.70, Math.PI * (0.18 + release * 0.28));
      ctx.stroke();
      ctx.strokeStyle = this.hexToRgba("#ffffff", 0.18 + intensity * 0.20);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(anchor.x - 16, anchor.y + 22, (visuals.radius || 84) - 13, -Math.PI * 0.62, Math.PI * (0.12 + release * 0.22));
      ctx.stroke();
      if (visuals.groundCracks) {
        ctx.strokeStyle = this.hexToRgba(visuals.fire ? "#f39c12" : color, 0.20 + intensity * 0.22);
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const x = 16 + i * 18;
          ctx.beginPath();
          ctx.moveTo(x, 61 + i % 2 * 4);
          ctx.lineTo(x + 16 + release * 10, 52 - i * 3);
          ctx.lineTo(x + 23 + release * 14, 58 + i * 2);
          ctx.stroke();
        }
      }
      for (let i = 0; i < (visuals.emberCount || 0); i++) {
        const a = -0.8 + i * 0.28 + pulse * 0.12;
        ctx.fillStyle = this.hexToRgba(i % 2 === 0 ? "#ffd27a" : "#ff7a2d", 0.34 + intensity * 0.20);
        ctx.beginPath();
        ctx.arc(anchor.x + Math.cos(a) * (34 + i * 5), anchor.y + Math.sin(a) * 28 + i * 7, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (visuals.kind === "twin-blade-flow" || visuals.kind === "counter-blade-flow") {
      const laneCount = visuals.laneCount || 2;
      ctx.strokeStyle = this.hexToRgba(visuals.counter ? "#2fffd1" : color, 0.22 + intensity * 0.30);
      ctx.lineWidth = visuals.finisher ? 4 : 3;
      for (let i = 0; i < laneCount; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const y = -14 + side * (12 + i * 3);
        const radius = (visuals.radius || 58) + i * 8;
        ctx.globalAlpha = Math.max(0.16, 0.54 - i * 0.07);
        ctx.beginPath();
        ctx.arc(20 + release * 18, y, radius, side > 0 ? -0.88 : 0.18, side > 0 ? 0.32 + release * 0.36 : 1.30 + release * 0.28);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (visuals.crossGuard) {
        ctx.strokeStyle = this.hexToRgba("#ffffff", 0.22 + intensity * 0.22);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-38, -28);
        ctx.lineTo(42 + release * 16, 18);
        ctx.moveTo(-34, 20);
        ctx.lineTo(40 + release * 14, -24);
        ctx.stroke();
      }
      for (let i = 0; i < (visuals.afterimageCount || 0); i++) {
        const ox = -20 - i * 13 - release * 10;
        ctx.strokeStyle = this.hexToRgba(color, 0.14 + intensity * 0.08);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ox, -34 + i * 5);
        ctx.quadraticCurveTo(12 - i * 4, -8, 46 + release * 16, 22 - i * 6);
        ctx.stroke();
      }
    } else if (visuals.kind === "focus-staff-channel") {
      const anchor = visuals.anchor || { x: 52, y: -36 };
      const radius = visuals.focusRadius || 24;
      this.drawPlayerCastSigil(ctx, anchor.x, anchor.y, radius, color, t);
      ctx.strokeStyle = this.hexToRgba(visuals.absorb ? "#e8c7ff" : (visuals.fire ? "#ffd27a" : "#ffffff"), 0.20 + intensity * 0.24);
      ctx.lineWidth = visuals.laneWidth || 3;
      ctx.beginPath();
      ctx.moveTo(-18, -12);
      ctx.quadraticCurveTo(10 + release * 14, -54 - pulse * 10, anchor.x, anchor.y);
      ctx.stroke();
      ctx.fillStyle = this.hexToRgba(color, 0.30 + intensity * 0.18);
      const count = visuals.orbitCount || 4;
      for (let i = 0; i < count; i++) {
        const a = t * (visuals.absorb ? -1.7 : 1.8) + i * Math.PI * 2 / count;
        const ox = anchor.x + Math.cos(a) * (radius + 12 + release * 7);
        const oy = anchor.y + Math.sin(a) * (radius * 0.56 + 5);
        ctx.beginPath();
        ctx.arc(ox, oy, 3.5 + intensity * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (visuals.releaseLike) {
        ctx.strokeStyle = this.hexToRgba(color, 0.24 + intensity * 0.24);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(anchor.x, anchor.y, radius + 23 + pulse * 4, -0.4, Math.PI * 1.35);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = this.hexToRgba(color, 0.22 + intensity * 0.22);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(28, -6, visuals.radius || 44, -0.7, 0.9);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawPlayerRigBackDetails(ctx, profile, rig, color, motion, progress, t) {
    const silhouette = rig.silhouette || "standard-adventurer";
    const torsoW = rig.torsoW || 44;
    const torsoH = rig.torsoH || 56;
    const top = -26;
    const bottom = top + torsoH;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = this.hexToRgba(color || "#3498db", 0.52);
    ctx.fillStyle = this.hexToRgba(color || "#3498db", 0.13);
    ctx.shadowColor = color || "#3498db";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;

    if (silhouette === "vanguard-plate") {
      ctx.beginPath();
      ctx.roundRect(-torsoW * 0.78, top + 8, torsoW * 0.34, 20, 6);
      ctx.roundRect(torsoW * 0.44, top + 8, torsoW * 0.34, 20, 6);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.42;
      ctx.beginPath();
      ctx.moveTo(-torsoW * 0.44, bottom - 4);
      ctx.lineTo(-torsoW * 0.62, bottom + 22);
      ctx.lineTo(torsoW * 0.62, bottom + 20);
      ctx.lineTo(torsoW * 0.44, bottom - 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (profile.hasFire) {
        ctx.strokeStyle = "#e67e22";
        ctx.globalAlpha = 0.58;
        for (let i = 0; i < 3; i++) {
          const x = -16 + i * 16;
          ctx.beginPath();
          ctx.moveTo(x, bottom + 8);
          ctx.lineTo(x + Math.sin(t * 7 + i) * 3, bottom + 25);
          ctx.stroke();
        }
      }
    } else if (silhouette === "counter-duelist" || silhouette === "agile-duelist") {
      const counter = silhouette === "counter-duelist";
      ctx.lineWidth = counter ? 3 : 2;
      ctx.strokeStyle = this.hexToRgba(counter ? "#2fffd1" : (color || "#3498db"), counter ? 0.62 : 0.48);
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const sway = Math.sin(t * 5 + i) * (counter ? 5 : 3);
        ctx.beginPath();
        ctx.moveTo(side * 7, top + 20);
        ctx.bezierCurveTo(side * (28 + progress * 8), top + 38, side * (36 + sway), bottom + 12, side * (22 + sway), bottom + 34);
        ctx.stroke();
      }
      ctx.globalAlpha = counter ? 0.34 : 0.22;
      ctx.beginPath();
      ctx.arc(7, -6, 48 + progress * 10, -0.85, 0.62);
      ctx.stroke();
      if (counter) {
        ctx.beginPath();
        ctx.moveTo(-34, 16);
        ctx.lineTo(34, -16);
        ctx.moveTo(-28, -16);
        ctx.lineTo(30, 16);
        ctx.stroke();
      }
    } else if (silhouette === "arcane-mantle") {
      ctx.beginPath();
      ctx.moveTo(-torsoW * 0.52, top + 10);
      ctx.quadraticCurveTo(-torsoW * 0.72, bottom - 2, -torsoW * 0.42, bottom + 28);
      ctx.lineTo(torsoW * 0.42, bottom + 28);
      ctx.quadraticCurveTo(torsoW * 0.72, bottom - 2, torsoW * 0.52, top + 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.48;
      ctx.beginPath();
      ctx.arc(0, -47, 24 + Math.sin(t * 3.2) * 2, Math.PI * 0.02, Math.PI * 0.98);
      ctx.stroke();
      this.drawStageGlyph(ctx, 0, -10, 13, color, t * 0.7, 0.18);
    } else {
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.moveTo(-torsoW * 0.45, bottom - 2);
      ctx.lineTo(0, bottom + 18);
      ctx.lineTo(torsoW * 0.45, bottom - 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawPlayerBackGear(ctx, weaponId, color, motion, progress) {
    ctx.save();
    ctx.strokeStyle = this.hexToRgba(color || "#3498db", 0.72);
    ctx.fillStyle = this.hexToRgba(color || "#3498db", 0.18);
    ctx.shadowColor = color || "#3498db";
    ctx.shadowBlur = 10;

    if (weaponId === "greatsword") {
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(-30, 30);
      ctx.lineTo(34, -48 - progress * 8);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.moveTo(-18, 18);
      ctx.lineTo(24, -34 - progress * 8);
      ctx.stroke();
    } else if (weaponId === "dualBlades") {
      ctx.lineWidth = 3;
      for (let i = 0; i < 2; i++) {
        const sign = i === 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(-6, 28 + sign * 4);
        ctx.quadraticCurveTo(-38, -2 + sign * 10, -26, -44 + sign * 4);
        ctx.stroke();
      }
    } else if (weaponId === "staff") {
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-30, 42);
      ctx.lineTo(-12, -54);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-10, -58, 10 + Math.sin(progress * Math.PI) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (motion === "dualClashLead" || motion === "dualClashFollow") {
      ctx.strokeStyle = this.hexToRgba("#ffffff", 0.42);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(8, -8, 54 + progress * 12, -0.8, 0.65);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawPlayerArmorAccents(ctx, weaponId, color, hasFire, hasAbsorb, t) {
    ctx.save();
    ctx.strokeStyle = this.hexToRgba(color || "#3498db", 0.82);
    ctx.fillStyle = this.hexToRgba(color || "#3498db", 0.18);
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(-21, -12);
    ctx.lineTo(-34, -2);
    ctx.lineTo(-22, 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(21, -12);
    ctx.lineTo(34, -2);
    ctx.lineTo(22, 8);
    ctx.stroke();

    if (weaponId === "greatsword") {
      ctx.fillRect(-18, 10, 36, 5);
      ctx.fillRect(-16, 20, 32, 4);
    } else if (weaponId === "dualBlades") {
      ctx.beginPath();
      ctx.moveTo(-16, 18);
      ctx.lineTo(0, 28);
      ctx.lineTo(16, 18);
      ctx.stroke();
    } else if (weaponId === "staff") {
      this.drawCastFocus(ctx, 0, 4, color, t);
    }

    if (hasFire || hasAbsorb) {
      const spellColor = hasFire ? "#e67e22" : "#9b59b6";
      ctx.fillStyle = this.hexToRgba(spellColor, 0.32 + Math.sin(t * 6) * 0.06);
      ctx.shadowColor = spellColor;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, -8, 8, 0, Math.PI * 2);
      ctx.fill();
      if (hasFire && hasAbsorb) {
        ctx.strokeStyle = "#9b59b6";
        ctx.beginPath();
        ctx.arc(0, -8, 13, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawPlayerLoadoutDetails(ctx, profile, color, motion, progress, t) {
    const weaponId = profile.weaponId || "";
    const armor = profile.armor || "standard";
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = this.hexToRgba(color || "#3498db", 0.74);
    ctx.fillStyle = this.hexToRgba(color || "#3498db", 0.16);
    ctx.shadowColor = color || "#3498db";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;

    if (armor === "heavy") {
      ctx.beginPath();
      ctx.roundRect(-35, -19, 16, 18, 5);
      ctx.roundRect(19, -19, 16, 18, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = this.hexToRgba(color || "#3498db", 0.20);
      ctx.fillRect(-20, 28, 40, 5);
      ctx.fillRect(-17, 36, 34, 4);
      if (profile.hasFire) {
        ctx.strokeStyle = "#e67e22";
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const x = -14 + i * 14;
          ctx.beginPath();
          ctx.moveTo(x, 30);
          ctx.lineTo(x + Math.sin(t * 6 + i) * 2, 42);
          ctx.stroke();
        }
      }
    } else if (armor === "light") {
      ctx.strokeStyle = this.hexToRgba(color || "#3498db", 0.62);
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(side * 12, 18);
        ctx.quadraticCurveTo(side * (28 + progress * 6), 28, side * 18, 42);
        ctx.stroke();
      }
      ctx.fillStyle = this.hexToRgba("#ffffff", 0.12);
      ctx.beginPath();
      ctx.moveTo(-20, 24);
      ctx.lineTo(0, 34);
      ctx.lineTo(20, 24);
      ctx.lineTo(0, 30);
      ctx.closePath();
      ctx.fill();
    } else if (armor === "caster") {
      ctx.strokeStyle = this.hexToRgba(color || "#3498db", 0.68);
      ctx.beginPath();
      ctx.arc(0, -16, 26 + Math.sin(t * 4) * 2, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
      ctx.globalAlpha = 0.32;
      ctx.beginPath();
      ctx.moveTo(-22, 30);
      ctx.lineTo(-32, 50);
      ctx.moveTo(22, 30);
      ctx.lineTo(32, 50);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (profile.hasAbsorb) {
      ctx.strokeStyle = "#9b59b6";
      ctx.globalAlpha = 0.54;
      ctx.beginPath();
      ctx.ellipse(0, -8, 28, 12, Math.sin(t * 1.7) * 0.18, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const a = t * 1.8 + i * Math.PI * 2 / 3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 26, -8 + Math.sin(a) * 10, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (weaponId === "staff") {
      this.drawStageGlyph(ctx, 0, -3, 15, color, t * 0.8, 0.24);
    }

    ctx.restore();
  }

  drawPlayerHeadgear(ctx, weaponId, color) {
    ctx.save();
    ctx.strokeStyle = this.hexToRgba(color || "#3498db", 0.85);
    ctx.lineWidth = 2;
    if (weaponId === "greatsword") {
      ctx.beginPath();
      ctx.moveTo(-13, -52);
      ctx.lineTo(13, -52);
      ctx.stroke();
    } else if (weaponId === "dualBlades") {
      ctx.beginPath();
      ctx.moveTo(-14, -50);
      ctx.lineTo(-24, -58);
      ctx.moveTo(14, -50);
      ctx.lineTo(24, -58);
      ctx.stroke();
    } else if (weaponId === "staff") {
      ctx.beginPath();
      ctx.arc(0, -48, 20, -0.2, Math.PI + 0.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawEnemySilhouette(ctx, scene, options) {
    const { x, y, config, reaction, performance, t } = options;
    const perf = performance || {};
    const meleePose = perf.meleePose || null;
    const meleeLoad = meleePose ? meleePose.load : 0;
    const meleeStrike = meleePose ? meleePose.strike : 0;
    const meleeContact = meleePose ? meleePose.contact : 0;
    const meleeRecover = meleePose ? meleePose.recover : 0;
    const scale = reaction.scale || 1;
    const color = scene.enemyStunTimer > 0 ? "#f1c40f" : (config.color || EnemyDatabase.base.color);
    const modelProfile = this.getEnemyModelProfile(config);
    const icon = modelProfile.icon;
    const modelType = modelProfile.modelType;
    const isCaster = modelType === "caster";
    const isArmored = modelType === "armored";
    const isSwift = modelType === "swift";
    const isShielded = modelType === "shielded";
    const isGolem = modelType === "golem";
    const rig = this.getEnemyRigProfile(modelProfile);
    const reactionType = reaction.type || "";
    const reactionPulse = Math.sin((reaction.progress || 0) * Math.PI);
    const enemyPose = perf.enemyPose || (scene.enemyAttack ? this.getEnemyTelegraph(scene.enemyAttack).pose : "idle");
    const poseIntensity = perf.poseIntensity || 0;
    const poseLoad = meleePose ? meleeLoad : 0;
    const poseDrive = meleePose ? Utils.clamp(meleeStrike + meleeContact * 0.35, 0, 1) : poseIntensity;
    const poseRecover = meleePose ? meleeRecover : 0;
    const attackReach = Math.max(reactionType === "attack" ? (isSwift ? 34 : 26) * reactionPulse : 0, perf.armReach || 0);
    const windupPull = (reactionType === "windup" ? 12 * reactionPulse : 0) + (perf.windup || 0) * 9 + poseLoad * 12;
    const baseLean = meleePose ? 0 : (isSwift ? -0.16 : (isArmored ? -0.04 : (scene.enemyAttackPhase === "response" ? -0.16 : 0)));
    const lean = baseLean + (reaction.rotation || 0) + (perf.lean || 0);
    const stride = perf.stride || 0;
    const castPower = perf.cast || 0;
    const brace = perf.brace || 0;
    const torsoW = rig.torsoW;
    const torsoH = rig.torsoH;
    const limbColor = isGolem ? "#8b4a3c" : (isCaster ? "#dec7ff" : "#f3d4d4");
    const legWidth = rig.legWidth;
    const armWidth = rig.armWidth;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * rig.scaleX, scale * rig.scaleY);
    ctx.scale(perf.scaleX || 1, perf.scaleY || 1);
    ctx.rotate(lean);

    if (this.visualLayerEnabled(scene, "actorModelDecorations")) {
      this.drawEnemyRigBackDetails(ctx, rig, color, t, poseIntensity, enemyPose);
    }

    // legs
    this.drawLimb(ctx, -14 * rig.stance, 28, -28 * rig.stance - (isSwift ? 7 : 0) - stride * 0.25, 58, "#3a2028", legWidth);
    this.drawLimb(ctx, 12 * rig.stance, 28, 22 * rig.stance + (isSwift ? 10 : 0) + stride * 0.38, 58 - Math.min(9, stride * 0.12), "#3a2028", legWidth);

    if (isCaster || isSwift) {
      ctx.fillStyle = this.hexToRgba(color, isCaster ? 0.22 : 0.18);
      ctx.beginPath();
      ctx.moveTo(-torsoW * 0.52, -26);
      ctx.lineTo(torsoW * 0.52, -22);
      ctx.lineTo(torsoW * 0.66, 42);
      ctx.lineTo(-torsoW * 0.60, 42);
      ctx.closePath();
      ctx.fill();
    }

    // torso
    ctx.fillStyle = color;
    ctx.strokeStyle = isArmored ? "#f5c6c6" : this.hexToRgba("#ffffff", isGolem ? 0.28 : 0.38);
    ctx.lineWidth = isArmored ? 4 : 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = isCaster ? 14 : 0;
    ctx.beginPath();
    if (isSwift) {
      ctx.moveTo(-24, -30);
      ctx.lineTo(24, -20);
      ctx.lineTo(18, 34);
      ctx.lineTo(-18, 34);
      ctx.closePath();
    } else if (isGolem) {
      ctx.moveTo(-torsoW / 2, -30);
      ctx.lineTo(torsoW / 2 - 8, -34);
      ctx.lineTo(torsoW / 2, 28);
      ctx.lineTo(12, 38);
      ctx.lineTo(-torsoW / 2 + 4, 30);
      ctx.closePath();
    } else {
      ctx.roundRect(-torsoW / 2, -32, torsoW, torsoH, isArmored ? 8 : 12);
    }
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (this.visualLayerEnabled(scene, "actorModelDecorations")) {
      this.drawEnemyModelAccents(ctx, modelProfile, color, icon, t, perf);
    }

    // head
    ctx.fillStyle = isCaster ? "#dec7ff" : (isGolem ? "#b86b57" : "#f3d4d4");
    ctx.beginPath();
    if (isGolem) {
      ctx.roundRect(-rig.headRadius, -72, rig.headRadius * 2, 30, 7);
    } else {
      ctx.arc(0, -58, rig.headRadius, 0, Math.PI * 2);
    }
    ctx.fill();
    if (this.visualLayerEnabled(scene, "actorModelDecorations")) {
      this.drawEnemyHeadgear(ctx, modelProfile, color, t);
    }

    // arms and archetype gear
    if (isCaster && !meleePose) {
      this.drawLimb(ctx, -24, -10, -54 - attackReach + windupPull, -24 - castPower * 8, limbColor, armWidth);
      if (this.visualLayerEnabled(scene, "actorModelDecorations")) this.drawCastFocus(ctx, -66 - attackReach + windupPull, -28 - castPower * 8, color, t);
      this.drawLimb(ctx, 24, -8, 45 + castPower * 8, 2 - castPower * 5, limbColor, armWidth);
    } else if (isShielded) {
      const bashPush = enemyPose === "bash" ? 12 * poseLoad + 30 * poseDrive : 0;
      this.drawLimb(ctx, -26, -6, -44 + poseLoad * 18 - attackReach - bashPush + windupPull, -4 - brace * 4 + poseDrive * 5, limbColor, armWidth);
      this.drawShieldSilhouette(ctx, -58 + poseLoad * 12 - attackReach - bashPush + windupPull, -4 - brace * 4 + poseDrive * 5, color, t);
      this.drawLimb(ctx, 24, -8, 40 - poseLoad * 18 - attackReach * 0.35 + poseDrive * 18, 8 - poseLoad * 12 + brace * 3 + poseDrive * 8, limbColor, armWidth);
      this.drawWeaponSilhouette(ctx, "greatsword", 42 - poseLoad * 20 - attackReach * 0.35 + poseDrive * 20, 8 - poseLoad * 12 + brace * 3 + poseDrive * 8, color, -0.28 - poseLoad * 0.32 + poseDrive * 0.58, 0.46);
    } else if (isSwift) {
      const sweep = enemyPose === "sweep" ? poseDrive : 0;
      const lunge = enemyPose === "lunge" || enemyPose === "stab" ? poseDrive : 0;
      const leftX = -44 + poseLoad * 22 - attackReach - lunge * 18 - sweep * 18 + poseRecover * 10;
      const leftY = -2 - poseLoad * 12 + sweep * 18 + lunge * 5 + poseRecover * 6;
      const rightX = 44 - poseLoad * 24 - attackReach * 0.25 - sweep * 24 + lunge * 10;
      const rightY = -16 + poseLoad * 10 - sweep * 12 + lunge * 4;
      this.drawLimb(ctx, -22, -10, leftX + 4, leftY + 2, limbColor, armWidth);
      this.drawLimb(ctx, 22, -8, rightX - 4, rightY + 2, limbColor, armWidth);
      this.drawWeaponSilhouette(ctx, "dualBlades", leftX, leftY, color, Math.PI * (0.82 + poseLoad * 0.16 - sweep * 0.34 - lunge * 0.12 + poseRecover * 0.10), 0.50);
      this.drawWeaponSilhouette(ctx, "dualBlades", rightX, rightY, color, -Math.PI * (0.34 + poseLoad * 0.12 + sweep * 0.28 - poseRecover * 0.10), 0.50);
    } else {
      const enemyWeaponId = isArmored || isGolem || meleePose && meleePose.heavy ? "greatsword" : "sword";
      const enemyWeaponScale = enemyWeaponId === "greatsword" ? (isArmored ? 0.66 : 0.54) : 0.66;
      if (enemyPose === "overhead" && (poseIntensity > 0.12 || meleePose)) {
        const lift = 44 * poseLoad + 52 * poseDrive;
        this.drawLimb(ctx, -26, -8, -30 + poseLoad * 16 - windupPull - poseDrive * 22, -22 - lift + poseRecover * 18, limbColor, armWidth);
        this.drawLimb(ctx, 26, -8, 30 - poseLoad * 14 - attackReach * 0.2 + poseDrive * 18, -4 - poseLoad * 10 + poseDrive * 8, limbColor, armWidth);
        if (isArmored || isGolem || meleePose) this.drawWeaponSilhouette(ctx, enemyWeaponId, -34 + poseLoad * 16 - windupPull - poseDrive * 24, -32 - lift + poseRecover * 18, color, -Math.PI * (0.52 + poseLoad * 0.10 - poseDrive * 0.34 - poseRecover * 0.10), enemyWeaponId === "greatsword" ? (isArmored ? 0.74 : 0.60) : 0.68);
      } else if (enemyPose === "sweep" && (poseIntensity > 0.12 || meleePose)) {
        this.drawLimb(ctx, -26, -8, -48 + poseLoad * 20 - attackReach + windupPull - poseDrive * 24, -2 - poseLoad * 12 + poseDrive * 18, limbColor, armWidth);
        this.drawLimb(ctx, 26, -8, 44 - poseLoad * 16 - attackReach * 0.3 + poseDrive * 10, 2 + poseLoad * 7 - poseDrive * 10, limbColor, armWidth);
        if (isArmored || isGolem || meleePose) this.drawWeaponSilhouette(ctx, enemyWeaponId, -52 + poseLoad * 18 - attackReach + windupPull - poseDrive * 28, 0 - poseLoad * 12 + poseDrive * 18, color, Math.PI * (0.92 + poseLoad * 0.10 - poseDrive * 0.28 + poseRecover * 0.08), enemyWeaponScale);
      } else {
        this.drawLimb(ctx, -26, -8, -46 + poseLoad * 14 - attackReach + windupPull - poseDrive * 18, 6 - poseLoad * 10 + poseDrive * 6, limbColor, armWidth);
        this.drawLimb(ctx, 26, -8, 50 - poseLoad * 10 - attackReach * 0.3 + poseDrive * 12, 0 + poseLoad * 4 + poseDrive * 5, limbColor, armWidth);
        if (isArmored || isGolem || meleePose) this.drawWeaponSilhouette(ctx, enemyWeaponId, -50 + poseLoad * 14 - attackReach + windupPull - poseDrive * 20, 6 - poseLoad * 10 + poseDrive * 6, color, Math.PI * (0.95 - poseDrive * 0.18 + poseRecover * 0.08), enemyWeaponScale);
      }
    }

    if (this.visualLayerEnabled(scene, "enemyAttackPoseOverlay")) {
      this.drawEnemyAttackPoseOverlay(ctx, modelType, scene.enemyAttack, scene.enemyAttackPhase, color, t, reactionPulse);
    }
    if (this.visualLayerEnabled(scene, "enemyActionPersonalityLayer")) {
      this.drawEnemyActionPersonalityLayer(ctx, this.getEnemyActionPersonalityVisuals(scene, modelProfile, perf, {
        color,
        reactionPulse
      }), t);
    }

    ctx.restore();
  }

  drawEnemyRigBackDetails(ctx, rig, color, t, poseIntensity = 0, enemyPose = "idle") {
    const silhouette = rig.silhouette || rig.modelType || "golem";
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (silhouette === "ritual-caster") {
      const sway = Math.sin(t * 2.2) * 4;
      ctx.fillStyle = this.hexToRgba(color || "#9b59b6", 0.16);
      ctx.strokeStyle = this.hexToRgba(color || "#9b59b6", 0.48);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-rig.shoulderW * 0.42, -28);
      ctx.quadraticCurveTo(-rig.shoulderW * 0.62 + sway, 22, -28, 58);
      ctx.lineTo(0, 45);
      ctx.lineTo(28, 58);
      ctx.quadraticCurveTo(rig.shoulderW * 0.62 + sway, 22, rig.shoulderW * 0.42, -28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = this.hexToRgba(color || "#9b59b6", 0.34);
      for (let i = 0; i < 2; i++) {
        const r = 28 + i * 10 + Math.sin(t * 3 + i) * 2;
        ctx.beginPath();
        ctx.arc(0, -56, r, -0.25 + i * 0.2, Math.PI * 1.18 + i * 0.1);
        ctx.stroke();
      }
    } else if (silhouette === "heavy-plate") {
      ctx.fillStyle = this.hexToRgba("#ffffff", 0.13);
      ctx.strokeStyle = this.hexToRgba(color || "#e74c3c", 0.58);
      ctx.lineWidth = 3;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.roundRect(side * 24 - (side < 0 ? 34 : 0), -42, 34, 23, 6);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = this.hexToRgba("#000000", 0.22);
      ctx.beginPath();
      ctx.roundRect(-36, 30, 72, 22, 5);
      ctx.fill();
    } else if (silhouette === "low-cloak") {
      const sweep = enemyPose === "sweep" ? poseIntensity * 18 : 0;
      ctx.fillStyle = this.hexToRgba("#000000", 0.28);
      ctx.strokeStyle = this.hexToRgba(color || "#2ecc71", 0.42);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-26, -24);
      ctx.quadraticCurveTo(-64 - sweep, 8, -34 - sweep * 0.3, 48);
      ctx.lineTo(-3, 34);
      ctx.lineTo(24, 48);
      ctx.quadraticCurveTo(52 - sweep * 0.4, 12, 24, -20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = this.hexToRgba(color || "#2ecc71", 0.38);
      ctx.beginPath();
      ctx.moveTo(-40 - sweep, -6);
      ctx.quadraticCurveTo(-10, 8, 24, -8);
      ctx.stroke();
    } else if (silhouette === "ward-guard") {
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = this.hexToRgba(color || "#d4ac0d", 0.46 + poseIntensity * 0.18);
      ctx.fillStyle = this.hexToRgba(color || "#d4ac0d", 0.07);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-42, -44, 84, 106, 12);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = this.hexToRgba("#ffffff", 0.20);
      ctx.beginPath();
      ctx.moveTo(-30, -16);
      ctx.lineTo(30, -16);
      ctx.moveTo(0, -34);
      ctx.lineTo(0, 48);
      ctx.stroke();
    } else {
      ctx.fillStyle = this.hexToRgba("#000000", 0.22);
      ctx.strokeStyle = this.hexToRgba(color || "#c0392b", 0.48);
      ctx.lineWidth = 2;
      const blocks = [
        [-41, -40, 28, 22],
        [15, -43, 32, 24],
        [-36, 32, 24, 18],
        [14, 34, 27, 17]
      ];
      for (const [x, y, w, h] of blocks) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 5);
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  drawEnemyModelAccents(ctx, modelProfile, color, icon, t, performance = {}) {
    const profile = typeof modelProfile === "string"
      ? { modelType: modelProfile, gear: "", armor: "", build: "" }
      : (modelProfile || {});
    const modelType = profile.modelType || "golem";
    const gear = profile.gear || "";
    const armor = profile.armor || "";
    const poseIntensity = performance.poseIntensity || 0;

    ctx.save();
    ctx.strokeStyle = this.hexToRgba("#ffffff", 0.34);
    ctx.fillStyle = this.hexToRgba("#000000", 0.12);
    ctx.lineWidth = 2;

    if (modelType === "golem") {
      for (let i = 0; i < 3; i++) {
        const yy = -18 + i * 17;
        ctx.beginPath();
        ctx.moveTo(-24 + i * 4, yy);
        ctx.lineTo(24 - i * 3, yy - 3);
        ctx.stroke();
      }
      ctx.fillStyle = this.hexToRgba(color, 0.42 + Math.sin(t * 5) * 0.06);
      ctx.beginPath();
      ctx.arc(0, 2, 9, 0, Math.PI * 2);
      ctx.fill();
      if (armor === "stone") {
        this.drawEnemyMaterialDetails(ctx, profile, color, t);
      }
    } else if (modelType === "caster") {
      ctx.strokeStyle = this.hexToRgba(color, 0.78);
      ctx.beginPath();
      ctx.arc(0, -4, 17, 0, Math.PI * 2);
      ctx.moveTo(-10, 10);
      ctx.lineTo(10, -18);
      ctx.moveTo(10, 10);
      ctx.lineTo(-10, -18);
      ctx.stroke();
      this.drawEnemyMaterialDetails(ctx, profile, color, t);
    } else if (modelType === "armored") {
      ctx.strokeStyle = "rgba(255,255,255,0.38)";
      for (let yy = -18; yy <= 20; yy += 13) {
        ctx.beginPath();
        ctx.moveTo(-30, yy);
        ctx.lineTo(30, yy);
        ctx.stroke();
      }
      ctx.fillStyle = this.hexToRgba("#ffffff", 0.18);
      ctx.fillRect(-23, -27, 46, 8);
      this.drawEnemyMaterialDetails(ctx, profile, color, t);
    } else if (modelType === "swift") {
      ctx.strokeStyle = this.hexToRgba(color, 0.85);
      ctx.beginPath();
      ctx.moveTo(-18, -18);
      ctx.quadraticCurveTo(0, 5, 18, -18);
      ctx.stroke();
      ctx.fillStyle = this.hexToRgba("#000000", 0.18);
      ctx.beginPath();
      ctx.moveTo(-26, 32);
      ctx.lineTo(0, 48);
      ctx.lineTo(24, 32);
      ctx.fill();
      this.drawEnemyMaterialDetails(ctx, profile, color, t);
    } else if (modelType === "shielded") {
      ctx.strokeStyle = this.hexToRgba(color, 0.72);
      ctx.beginPath();
      ctx.roundRect(-20, -18, 40, 36, 5);
      ctx.stroke();
      ctx.fillStyle = this.hexToRgba(color, 0.20);
      ctx.fillRect(-17, -2, 34, 6);
      this.drawEnemyMaterialDetails(ctx, profile, color, t);
    }

    this.drawEnemyGearDetails(ctx, gear, color, t, poseIntensity);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 19px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = color || "#ffffff";
    ctx.shadowBlur = 8;
    ctx.fillText(icon || "敌", 0, 2);
    ctx.restore();
  }

  drawEnemyMaterialDetails(ctx, profile, color, t) {
    const armor = profile.armor || "";
    ctx.save();
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    if (armor === "stone") {
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      for (let i = 0; i < 4; i++) {
        const x = -22 + i * 14;
        ctx.beginPath();
        ctx.moveTo(x, -22 + (i % 2) * 10);
        ctx.lineTo(x + 8, -8 + i * 6);
        ctx.lineTo(x + 2, 4 + i * 4);
        ctx.stroke();
      }
    } else if (armor === "robe") {
      ctx.strokeStyle = this.hexToRgba(color, 0.52);
      for (let i = 0; i < 3; i++) {
        const x = -18 + i * 18;
        ctx.beginPath();
        ctx.moveTo(x, -20);
        ctx.quadraticCurveTo(x + Math.sin(t * 2 + i) * 3, 6, x - 6, 40);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = color;
      ctx.fillRect(-24, 28, 48, 8);
    } else if (armor === "plate") {
      ctx.strokeStyle = "rgba(255,255,255,0.42)";
      ctx.fillStyle = this.hexToRgba("#ffffff", 0.16);
      ctx.beginPath();
      ctx.roundRect(-42, -24, 18, 22, 5);
      ctx.roundRect(24, -24, 18, 22, 5);
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-24, -6 + i * 12);
        ctx.lineTo(24, -8 + i * 12);
        ctx.stroke();
      }
    } else if (armor === "cloak") {
      ctx.fillStyle = this.hexToRgba("#000000", 0.20);
      ctx.beginPath();
      ctx.moveTo(-30, -18);
      ctx.quadraticCurveTo(-48, 18, -18, 48);
      ctx.lineTo(0, 36);
      ctx.lineTo(18, 48);
      ctx.quadraticCurveTo(48, 18, 30, -18);
      ctx.closePath();
      ctx.fill();
    } else if (armor === "ward") {
      ctx.strokeStyle = this.hexToRgba(color, 0.72);
      this.drawStageShield(ctx, 0, -2, color, 0.22 + Math.sin(t * 5) * 0.04);
      ctx.beginPath();
      ctx.arc(0, -2, 27, -0.25, Math.PI * 1.25);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawEnemyGearDetails(ctx, gear, color, t, poseIntensity = 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = this.hexToRgba(color || "#e74c3c", 0.72);
    ctx.fillStyle = this.hexToRgba(color || "#e74c3c", 0.18);
    ctx.shadowColor = color || "#e74c3c";
    ctx.shadowBlur = 9;
    ctx.lineWidth = 2;

    if (gear === "hammer") {
      ctx.beginPath();
      ctx.moveTo(34, 24);
      ctx.lineTo(52, -24 - poseIntensity * 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(42, -34 - poseIntensity * 10, 22, 14, 3);
      ctx.fill();
      ctx.stroke();
    } else if (gear === "focus") {
      for (let i = 0; i < 3; i++) {
        const a = t * 1.4 + i * Math.PI * 2 / 3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 32, -8 + Math.sin(a) * 12, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (gear === "greatsword") {
      ctx.beginPath();
      ctx.moveTo(28, 30);
      ctx.lineTo(62, -36 - poseIntensity * 12);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.38)";
      ctx.beginPath();
      ctx.moveTo(36, 18);
      ctx.lineTo(56, -24 - poseIntensity * 12);
      ctx.stroke();
    } else if (gear === "dualBlades") {
      for (let side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * 19, 30);
        ctx.quadraticCurveTo(side * 38, 10, side * 32, -20);
        ctx.stroke();
      }
    } else if (gear === "shield") {
      this.drawStageShield(ctx, -34 - poseIntensity * 8, 2, color, 0.28);
    }

    ctx.restore();
  }

  drawEnemyHeadgear(ctx, modelProfile, color, t) {
    const profile = typeof modelProfile === "string"
      ? { modelType: modelProfile, armor: "" }
      : (modelProfile || {});
    const modelType = profile.modelType || "golem";
    const armor = profile.armor || "";
    ctx.save();
    ctx.strokeStyle = this.hexToRgba(color || "#e74c3c", 0.85);
    ctx.fillStyle = this.hexToRgba(color || "#e74c3c", 0.20);
    ctx.lineWidth = 2;

    if (modelType === "caster") {
      ctx.beginPath();
      ctx.moveTo(-18, -58);
      ctx.quadraticCurveTo(0, -86, 18, -58);
      ctx.fill();
      ctx.stroke();
      this.drawCastFocus(ctx, 0, -82, color, t);
    } else if (modelType === "armored") {
      ctx.beginPath();
      ctx.moveTo(-21, -61);
      ctx.lineTo(-28, -72);
      ctx.lineTo(0, -80);
      ctx.lineTo(28, -72);
      ctx.lineTo(21, -61);
      ctx.stroke();
    } else if (modelType === "swift") {
      ctx.beginPath();
      ctx.moveTo(-15, -60);
      ctx.lineTo(-34, -68);
      ctx.moveTo(15, -60);
      ctx.lineTo(34, -68);
      ctx.stroke();
    } else if (modelType === "shielded") {
      ctx.beginPath();
      ctx.arc(0, -60, 23, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      ctx.fillRect(-15, -70, 30, 5);
    } else {
      ctx.beginPath();
      ctx.moveTo(-14, -66);
      ctx.lineTo(14, -66);
      ctx.moveTo(-10, -56);
      ctx.lineTo(10, -56);
      ctx.stroke();
    }

    if (armor === "ward") {
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.arc(0, -61, 27, -0.55, Math.PI + 0.55);
      ctx.stroke();
    } else if (armor === "stone") {
      ctx.strokeStyle = "rgba(255,255,255,0.34)";
      ctx.beginPath();
      ctx.moveTo(-14, -72);
      ctx.lineTo(4, -56);
      ctx.moveTo(3, -72);
      ctx.lineTo(17, -60);
      ctx.stroke();
    } else if (armor === "cloak") {
      ctx.fillStyle = this.hexToRgba("#000000", 0.22);
      ctx.beginPath();
      ctx.moveTo(-18, -54);
      ctx.quadraticCurveTo(0, -70, 18, -54);
      ctx.lineTo(12, -44);
      ctx.quadraticCurveTo(0, -50, -12, -44);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  drawEnemyAttackPoseOverlay(ctx, modelType, attack, phase, color, t, reactionPulse = 0) {
    if (!attack || phase === "none" || phase === "canceled") return;
    const telegraph = this.getEnemyTelegraph(attack);
    const pose = telegraph.pose || "lunge";
    const response = phase === "response";
    const hit = phase === "hit";
    const wind = phase === "windup";
    const intensity = hit ? 1 : (response ? 0.72 : 0.42 + reactionPulse * 0.18);
    const pulse = 0.85 + Math.sin(t * 11) * 0.15;
    const reach = hit ? 34 : (response ? 22 : 10);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = hit ? 22 : (response ? 16 : 8);
    ctx.globalAlpha = Math.max(0.12, intensity * pulse);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (pose === "cast") {
      const radius = hit ? 28 : (response ? 23 : 18);
      this.drawEnemyGlyph(ctx, -64 - reach * 0.45, -30, radius, color, t);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-22, -16);
      ctx.lineTo(-55 - reach * 0.45, -30);
      ctx.stroke();
      if (modelType !== "caster") {
        ctx.beginPath();
        ctx.arc(0, -8, 11 + Math.sin(t * 8) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (pose === "overhead") {
      ctx.lineWidth = hit ? 10 : 6;
      ctx.beginPath();
      ctx.moveTo(-18, -18);
      ctx.lineTo(-22, -92 + (wind ? Math.sin(t * 5) * 3 : 0));
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.globalAlpha *= 0.55;
      ctx.beginPath();
      ctx.moveTo(-22, -88);
      ctx.lineTo(-38, -106);
      ctx.moveTo(-22, -88);
      ctx.lineTo(-6, -106);
      ctx.stroke();
    } else if (pose === "sweep") {
      ctx.lineWidth = hit ? 9 : 5;
      ctx.beginPath();
      ctx.arc(-38 - reach * 0.4, -6, 52 + reach * 0.25, Math.PI * 0.70, Math.PI * 1.52);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.globalAlpha *= 0.48;
      ctx.stroke();
    } else if (pose === "bash") {
      const x = -56 - reach * 0.55;
      ctx.globalAlpha *= 0.92;
      ctx.fillStyle = this.hexToRgba(color, 0.22);
      ctx.strokeStyle = color;
      ctx.lineWidth = hit ? 5 : 3;
      ctx.beginPath();
      ctx.roundRect(x - 18, -30, 34, 58, 8);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 28, -20);
      ctx.lineTo(x - 48, 0);
      ctx.lineTo(x - 28, 20);
      ctx.stroke();
    } else {
      ctx.lineWidth = hit ? 8 : 5;
      ctx.beginPath();
      ctx.moveTo(-26, -10);
      ctx.lineTo(-76 - reach, -22);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.globalAlpha *= 0.52;
      ctx.beginPath();
      ctx.moveTo(-78 - reach, -22);
      ctx.lineTo(-98 - reach, -26);
      ctx.stroke();
    }

    ctx.restore();
  }

  getEnemyActionPersonalityVisuals(scene, modelProfile = {}, performance = {}, context = {}) {
    const profile = typeof modelProfile === "string"
      ? { modelType: modelProfile, gear: "", armor: "" }
      : (modelProfile || {});
    const modelType = profile.modelType || "golem";
    const attack = scene && scene.enemyAttack ? scene.enemyAttack : null;
    const phase = scene && scene.enemyAttackPhase ? scene.enemyAttackPhase : "none";
    const telegraph = attack ? this.getEnemyTelegraph(attack) : {};
    const pose = telegraph.pose || performance.enemyPose || "idle";
    const telegraphType = telegraph.type || (attack && attack.type) || "";
    const response = phase === "response";
    const hit = phase === "hit";
    const windup = phase === "windup";
    const spellLike = pose === "cast" || ["spell", "bolt", "burst"].includes(telegraphType) || !!(attack && attack.interruptible);
    const color = context.color || profile.color || (attack && attack.color) || "#e74c3c";
    const actionPower = Math.max(
      performance.poseIntensity || 0,
      performance.attack || 0,
      performance.windup || 0,
      performance.brace || 0,
      performance.cast || 0,
      performance.stride ? Math.min(1, performance.stride / 34) : 0,
      response ? 0.72 : 0,
      hit ? 1 : 0,
      windup ? 0.42 : 0
    );
    const baseIdle = modelType === "caster" || modelType === "shielded" ? 0.18 : 0.10;
    const intensity = Utils.clamp(Math.max(actionPower, baseIdle), 0, 1.15);
    const reach = hit ? 34 : (response ? 24 : (windup ? 12 : 5));
    const reactionPulse = context.reactionPulse || 0;

    const kind = modelType === "caster" ? "ritual-focus"
      : (modelType === "armored" ? "plate-breaker"
        : (modelType === "swift" ? "knife-speed"
          : (modelType === "shielded" ? "ward-brace" : "stone-breaker")));

    return {
      active: intensity > 0.08,
      kind,
      modelType,
      phase,
      pose,
      telegraphType,
      spellLike,
      color,
      intensity,
      response,
      hit,
      windup,
      reach,
      pulse: Utils.clamp(Math.sin((scene && scene.enemyAttackTimer || 0) * 5.2) * 0.5 + 0.5 + reactionPulse * 0.2, 0, 1),
      anchor: {
        x: spellLike ? -68 - reach * 0.35 : -42 - reach * 0.5,
        y: spellLike ? -34 : (pose === "overhead" ? -78 : -10)
      },
      bladeCount: modelType === "swift" ? 2 : (pose === "sweep" ? 1 : 0),
      guardPower: modelType === "shielded" ? Utils.clamp(0.42 + intensity * 0.48, 0.42, 1) : 0,
      weightPower: modelType === "armored" || modelType === "golem" ? Utils.clamp(0.30 + intensity * 0.62, 0.30, 1) : 0,
      orbitCount: modelType === "caster" ? (spellLike ? 4 : 3) : 0,
      afterimageCount: modelType === "swift" ? Math.max(2, Math.ceil(2 + intensity * 2)) : 0
    };
  }

  drawEnemyActionPersonalityLayer(ctx, visuals, t) {
    if (!visuals || !visuals.active) return;
    const ornamentScale = this.visualScale("ornament");
    if (ornamentScale <= 0.05) return;
    const color = visuals.color || "#e74c3c";
    const intensity = Utils.clamp(visuals.intensity || 0.2, 0, 1.15) * ornamentScale;
    const pulse = visuals.pulse || 0;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = 3 + intensity * 5;

    if (visuals.kind === "ritual-focus") {
      const anchor = visuals.anchor || { x: -68, y: -34 };
      const radius = 15 + intensity * 7 + pulse * 1.5;
      this.drawEnemyGlyph(ctx, anchor.x, anchor.y, radius, color, t, 0.34 + intensity * 0.20);
      ctx.strokeStyle = this.hexToRgba(color, 0.08 + intensity * 0.14);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-18, -16);
      ctx.quadraticCurveTo(-38, -42 - pulse * 10, anchor.x, anchor.y);
      ctx.stroke();
      ctx.fillStyle = this.hexToRgba("#ffffff", 0.24 + intensity * 0.10);
      const orbitCount = Math.min(2, visuals.orbitCount || 3);
      for (let i = 0; i < orbitCount; i++) {
        const a = t * (1.7 + intensity * 0.6) + i * Math.PI * 2 / Math.max(1, orbitCount);
        const ox = anchor.x + Math.cos(a) * (radius + 9);
        const oy = anchor.y + Math.sin(a) * (radius * 0.58);
        ctx.beginPath();
        ctx.arc(ox, oy, 2.4 + intensity, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (visuals.kind === "knife-speed") {
      const count = Math.min(2, visuals.afterimageCount || 3);
      ctx.strokeStyle = this.hexToRgba(color, 0.08 + intensity * 0.12);
      ctx.lineWidth = 1.4;
      for (let i = 0; i < count; i++) {
        const shift = i * 13 + intensity * 10;
        ctx.globalAlpha = (0.22 - i * 0.05) * ornamentScale;
        ctx.beginPath();
        ctx.moveTo(18 + shift * 0.2, -36 + i * 8);
        ctx.quadraticCurveTo(-18 - shift, -12 + i * 6, -72 - shift * 0.35, 18 + i * 3);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.38 * ornamentScale;
      ctx.strokeStyle = this.hexToRgba("#ffffff", 0.22 + intensity * 0.12);
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 1; i++) {
        ctx.beginPath();
        ctx.arc(-44 - visuals.reach * 0.45, -4 + i * 18, 38 + i * 12, Math.PI * 0.72, Math.PI * 1.42);
        ctx.stroke();
      }
    } else if (visuals.kind === "ward-brace") {
      const guard = visuals.guardPower || intensity;
      const x = -60 - visuals.reach * 0.45;
      ctx.fillStyle = this.hexToRgba(color, 0.025 + guard * 0.05);
      ctx.strokeStyle = this.hexToRgba(color, 0.14 + guard * 0.16);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(x - 26, -42, 45, 88, 10);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = this.hexToRgba("#ffffff", 0.08 + guard * 0.12);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(x - 18, -14);
      ctx.lineTo(x + 11, -14);
      ctx.moveTo(x - 4, -34);
      ctx.lineTo(x - 4, 32);
      ctx.stroke();
      if (visuals.pose === "bash") {
        ctx.strokeStyle = this.hexToRgba(color, 0.12 + guard * 0.16);
        ctx.beginPath();
        ctx.moveTo(x - 30, -24);
        ctx.lineTo(x - 58, 0);
        ctx.lineTo(x - 30, 24);
        ctx.stroke();
      }
    } else if (visuals.kind === "plate-breaker" || visuals.kind === "stone-breaker") {
      const weight = visuals.weightPower || intensity;
      ctx.strokeStyle = this.hexToRgba(color, 0.08 + weight * 0.14);
      ctx.lineWidth = visuals.kind === "plate-breaker" ? 2.2 : 1.8;
      if (visuals.pose === "overhead") {
        ctx.beginPath();
        ctx.moveTo(-18, -44);
        ctx.lineTo(-28 - visuals.reach * 0.2, -106);
        ctx.stroke();
        ctx.strokeStyle = this.hexToRgba("#ffffff", 0.08 + weight * 0.10);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-42, -96);
        ctx.lineTo(-28, -112);
        ctx.lineTo(-12, -96);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(-44 - visuals.reach * 0.35, 6, 42 + visuals.reach * 0.16, Math.PI * 0.76, Math.PI * 1.28);
        ctx.stroke();
      }
      ctx.strokeStyle = this.hexToRgba(color, 0.06 + weight * 0.10);
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 2; i++) {
        const y = 62 + i * 5;
        ctx.beginPath();
        ctx.moveTo(-50 + i * 18, y);
        ctx.lineTo(-28 + i * 24 + weight * 10, y - 6 - pulse * 4);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  drawLimb(ctx, x1, y1, x2, y2, color, width) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  getWeaponSilhouetteProfile(weaponId) {
    if (weaponId === "greatsword") {
      return {
        family: "heavy-blade",
        bladeLength: 58,
        bladeWidth: 10,
        edgeWidth: 4,
        guardWidth: 18,
        gripLength: 13,
        tipLength: 9,
        glow: 0.34
      };
    }

    if (weaponId === "dualBlades") {
      return {
        family: "twin-blade",
        bladeLength: 38,
        bladeWidth: 4,
        edgeWidth: 2,
        guardWidth: 9,
        gripLength: 8,
        tipLength: 7,
        glow: 0.28
      };
    }

    if (weaponId === "staff") {
      return {
        family: "focus-staff",
        shaftLength: 82,
        shaftWidth: 5,
        focusRadius: 9,
        ringRadius: 16,
        bandCount: 3,
        glow: 0.36
      };
    }

    return {
      family: "simple-blade",
      bladeLength: 42,
      bladeWidth: 5,
      edgeWidth: 2,
      guardWidth: 10,
      gripLength: 8,
      tipLength: 6,
      glow: 0.22
    };
  }

  drawWeaponSilhouette(ctx, weaponId, x, y, color, angle, scale = 1) {
    const profile = this.getWeaponSilhouetteProfile(weaponId);
    const weaponColor = color || "#f1c40f";
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    ctx.scale(scale, scale);
    ctx.strokeStyle = weaponColor;
    ctx.fillStyle = weaponColor;
    ctx.shadowColor = weaponColor;
    ctx.shadowBlur = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (profile.family === "heavy-blade") {
      const len = profile.bladeLength;
      ctx.lineWidth = profile.bladeWidth;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = this.hexToRgba("#ffffff", 0.78);
      ctx.lineWidth = profile.edgeWidth;
      ctx.beginPath();
      ctx.moveTo(12, -2);
      ctx.lineTo(len - profile.tipLength, -2);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.62;
      ctx.beginPath();
      ctx.moveTo(len - profile.tipLength, -5);
      ctx.lineTo(len + 2, 0);
      ctx.lineTo(len - profile.tipLength, 5);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = this.hexToRgba(weaponColor, 0.82);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(5, -profile.guardWidth * 0.45);
      ctx.lineTo(5, profile.guardWidth * 0.45);
      ctx.stroke();
      this.drawWeaponGrip(ctx, -profile.gripLength, 0, profile.gripLength, weaponColor);
    } else if (profile.family === "twin-blade") {
      const len = profile.bladeLength;
      ctx.shadowBlur = 1;
      ctx.lineWidth = profile.bladeWidth;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, -2);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = this.hexToRgba("#ffffff", 0.62);
      ctx.lineWidth = profile.edgeWidth;
      ctx.beginPath();
      ctx.moveTo(8, -3);
      ctx.lineTo(len - profile.tipLength, -4);
      ctx.stroke();

      ctx.fillStyle = this.hexToRgba("#ffffff", 0.52);
      ctx.beginPath();
      ctx.moveTo(len - profile.tipLength, -7);
      ctx.lineTo(len + 4, -2);
      ctx.lineTo(len - profile.tipLength, 3);
      ctx.fill();

      ctx.strokeStyle = this.hexToRgba(weaponColor, 0.74);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(2, -profile.guardWidth * 0.55);
      ctx.lineTo(2, profile.guardWidth * 0.55);
      ctx.stroke();
      this.drawWeaponGrip(ctx, -profile.gripLength, 0, profile.gripLength, weaponColor);
    } else if (profile.family === "focus-staff") {
      ctx.lineWidth = profile.shaftWidth;
      ctx.beginPath();
      ctx.moveTo(-8, 34);
      ctx.lineTo(14, -42);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = this.hexToRgba("#ffffff", 0.34);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-3, 26);
      ctx.lineTo(10, -33);
      ctx.stroke();

      for (let i = 0; i < profile.bandCount; i++) {
        const p = i / Math.max(1, profile.bandCount - 1);
        const bx = -4 + p * 15;
        const by = 21 - p * 52;
        ctx.strokeStyle = this.hexToRgba(weaponColor, 0.72);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bx - 5, by);
        ctx.lineTo(bx + 5, by - 2);
        ctx.stroke();
      }

      ctx.shadowColor = weaponColor;
      ctx.shadowBlur = 5;
      ctx.fillStyle = weaponColor;
      ctx.beginPath();
      ctx.arc(16, -46, profile.focusRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = this.hexToRgba("#ffffff", 0.50);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(16, -46, profile.ringRadius, -0.4, Math.PI * 1.3);
      ctx.stroke();
    } else {
      ctx.lineWidth = profile.bladeWidth;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(profile.bladeLength, 0);
      ctx.stroke();
      this.drawWeaponGrip(ctx, -profile.gripLength, 0, profile.gripLength, weaponColor);
    }

    ctx.restore();
  }

  drawWeaponGrip(ctx, x, y, length, color) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = this.hexToRgba("#091018", 0.90);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length, y);
    ctx.stroke();

    ctx.strokeStyle = this.hexToRgba(color || "#f1c40f", 0.72);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 2, y - 2);
    ctx.lineTo(x + length - 2, y - 2);
    ctx.stroke();
    ctx.restore();
  }

  drawShieldSilhouette(ctx, x, y, color, t) {
    const pulse = 1 + Math.sin(t * 7) * 0.04;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.strokeStyle = color || "#95a5a6";
    ctx.lineWidth = 4;
    ctx.shadowColor = color || "#95a5a6";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(24, -14);
    ctx.lineTo(18, 22);
    ctx.lineTo(0, 34);
    ctx.lineTo(-18, 22);
    ctx.lineTo(-24, -14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawCastFocus(ctx, x, y, color, t) {
    const pulse = 1 + Math.sin(t * 8) * 0.08;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = color || "#9b59b6";
    ctx.fillStyle = color || "#9b59b6";
    ctx.lineWidth = 2;
    ctx.shadowColor = color || "#9b59b6";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  getActorReaction(scene, target) {
    if (scene.actorReactions && scene.actorReactions.get) {
      return scene.actorReactions.get(target);
    }
    return {
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      flashAlpha: 0,
      ringAlpha: 0,
      color: "#ffffff"
    };
  }

  drawActorReactionOverlay(x, y, radius, reaction) {
    const ctx = this.ctx;
    if (!reaction) return;

    if (reaction.flashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = reaction.flashAlpha;
      ctx.fillStyle = reaction.color || "#ffffff";
      ctx.shadowColor = reaction.color || "#ffffff";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const progress = reaction.progress || 0;
      const burstRadius = radius * (1.1 + progress * 0.9);
      ctx.save();
      ctx.globalAlpha = reaction.flashAlpha * 0.65;
      ctx.strokeStyle = reaction.color || "#ffffff";
      ctx.lineWidth = Math.max(2, 6 * (1 - progress));
      ctx.shadowColor = reaction.color || "#ffffff";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(x, y, burstRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (reaction.ringAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = reaction.ringAlpha;
      ctx.strokeStyle = reaction.color || "#ffffff";
      ctx.lineWidth = 4;
      ctx.shadowColor = reaction.color || "#ffffff";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawFloatingMessage(scene, y = 380) {
    const ctx = this.ctx;
    const message = scene.message || "";
    if (!message) return;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 半透背影
    ctx.font = "bold 18px sans-serif";
    const textWidth = Math.min(ctx.measureText(message).width + 40, 760);
    const rx = this.width / 2 - textWidth / 2;
    const ry = y - 18;
    ctx.fillStyle = "rgba(10, 10, 16, 0.55)";
    ctx.beginPath();
    ctx.roundRect(rx, ry, textWidth, 36, 8);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 6;
    ctx.fillText(message, this.width / 2, y);
    ctx.restore();
  }

  drawLearningObjectivePanel(scene, t = performance.now() / 1000) {
    if (!scene || !scene.getLearningObjectiveView) return;
    const objective = scene.getLearningObjectiveView();
    if (!objective || !objective.lines || objective.lines.length === 0) return;
    if (scene.turnState && (scene.turnState.startsWith("select_") || scene.turnState.startsWith("demo_") || scene.turnState === "game_over")) return;

    const feedback = scene.getPlayerFeedbackView ? scene.getPlayerFeedbackView() : null;
    const ctx = this.ctx;
    const w = Math.min(560, this.width - 120);
    const x = this.width / 2 - w / 2;
    const y = 62;
    const lineCount = Math.min(2, objective.lines.length);
    const hasFeedback = !!(feedback && feedback.line && feedback.line !== objective.lines[0]);
    const h = 54 + lineCount * 18 + (hasFeedback ? 22 : 0);
    const colors = {
      active: "#16a085",
      success: "#2ecc71",
      warning: "#f39c12",
      neutral: "#5dade2"
    };
    const accent = colors[objective.tone] || colors.neutral;

    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "rgba(9, 12, 18, 0.66)";
    ctx.strokeStyle = this.hexToRgba(accent, 0.58);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.fillRect(x, y, 4, h);

    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = "#ffffff";
    const title = objective.progress
      ? `${objective.title} · ${objective.progress}`
      : objective.title;
    ctx.fillText(this.truncateText(ctx, title, w - 30), x + 16, y + 10);

    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#d9deea";
    for (let i = 0; i < lineCount; i++) {
      ctx.fillText(this.truncateText(ctx, objective.lines[i], w - 30), x + 16, y + 32 + i * 18);
    }

    if (hasFeedback) {
      const feedbackColor = colors[feedback.tone] || "#b8c3d9";
      ctx.fillStyle = this.hexToRgba(feedbackColor, 0.92);
      ctx.font = "12px sans-serif";
      ctx.fillText(this.truncateText(ctx, feedback.line, w - 30), x + 16, y + 34 + lineCount * 18);
    }

    if (objective.tone === "active") {
      ctx.fillStyle = this.hexToRgba(accent, 0.20 + Math.sin(t * 5) * 0.04);
      ctx.fillRect(x + 4, y, Math.min(w - 4, 74 + Math.sin(t * 2.4) * 10), 2);
    }

    ctx.restore();
  }

  drawExpectedInputMarker(runner, barY, barW = 760, barH = 30, centerX = this.width / 2) {
    const ctx = this.ctx;
    const node = runner.currentNode();
    if (!node) return;
    const t = runner.getExpectedInputTime();
    if (t === null || t === undefined) return;

    const x = centerX - barW / 2 + barW * Utils.clamp(t / node.duration, 0, 1);
    const y = barY + barH + 10;

    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 6, y + 10);
    ctx.lineTo(x + 6, y + 10);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 10);
    ctx.lineTo(x, barY);
    ctx.stroke();
    ctx.restore();
  }

  drawBigKeyPrompt(scene, key, subtext, y = 435, t = performance.now() / 1000, centerX = this.width / 2) {
    const ctx = this.ctx;
    if (!key) return;

    const x = centerX;
    const pulse = 1 + Math.sin(t * 1000 / 120) * 0.12;
    const label = `[${key}]`;
    const fontSize = key.length > 4 ? 34 : (key.length > 2 ? 42 : 48);
    const ringRadius = key.length > 4 ? 62 : 54;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 外发光圆
    ctx.fillStyle = "rgba(241, 196, 64, 0.12)";
    ctx.beginPath();
    ctx.arc(x, y, (ringRadius + 10) * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(241, 196, 64, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 按键文字
    ctx.fillStyle = "#f1c40f";
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.shadowColor = "rgba(241, 196, 64, 0.65)";
    ctx.shadowBlur = 18 * pulse;
    ctx.fillText(label, x, y);
    ctx.shadowBlur = 0;

    // 副标题
    if (subtext) {
      ctx.fillStyle = "#e8e8e8";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(subtext, x, y + 42);
    }

    ctx.restore();
  }

  drawWeaponSelection(battle) {
    const ctx = this.ctx;

    // 暗色遮罩
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, this.width, this.height);

    // 标题
    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 34px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("选择你的战斗风格", this.width / 2, this.layout.selectionTitleY);

    const enemyLabel = battle.getEnemySelectionLabel ? battle.getEnemySelectionLabel() : "自动匹配";
    ctx.fillStyle = "#cfd0df";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(`遭遇匹配：${enemyLabel}`, this.width / 2, this.layout.selectionTitleY + 42);

    const encounterLines = battle.getEncounterSummaryLines ? battle.getEncounterSummaryLines(2) : [];
    ctx.fillStyle = "#aeb7c4";
    ctx.font = "12px sans-serif";
    encounterLines.forEach((line, idx) => {
      ctx.fillText(this.truncateText(ctx, line, 720), this.width / 2, this.layout.selectionTitleY + 62 + idx * 16);
    });

    const styles = Object.entries(StyleDatabase);
    const compact = styles.length > 5;
    const cardW = compact ? 142 : 154;
    const cardH = compact ? 164 : 176;
    const gap = compact ? 16 : 22;

    const row1Count = Math.ceil(styles.length / 2);
    const row2Count = styles.length - row1Count;
    const row1W = cardW * row1Count + gap * (row1Count - 1);
    const row2W = row2Count > 0 ? cardW * row2Count + gap * (row2Count - 1) : 0;
    const row1X = (this.width - row1W) / 2;
    const row2X = (this.width - row2W) / 2;
    const row1Y = compact ? 128 : 134;
    const row2Y = row1Y + cardH + gap;

    styles.forEach(([id, style], idx) => {
      const row = idx < row1Count ? 0 : 1;
      const col = row === 0 ? idx : idx - row1Count;
      const x = row === 0 ? row1X + col * (cardW + gap) : row2X + col * (cardW + gap);
      const y = row === 0 ? row1Y : row2Y;

      // 卡片背景
      ctx.fillStyle = "rgba(30, 30, 40, 0.9)";
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 10);
      ctx.fill();
      ctx.stroke();

      // 编号与按键
      ctx.fillStyle = style.color;
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`${style.number} · [${style.key}]`, x + 10, y + 10);

      // 图标
      ctx.fillStyle = style.color;
      ctx.font = "bold 40px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(style.icon, x + cardW / 2, y + 46);

      // 名称
      ctx.fillStyle = "#ffffff";
      ctx.font = compact ? "bold 15px sans-serif" : "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      this.drawWrappedLine(ctx, style.name, x + cardW / 2, y + 78, cardW - 16, 18, 2);

      // 描述
      ctx.fillStyle = "#aaaaaa";
      ctx.font = compact ? "10px sans-serif" : "11px sans-serif";
      this.drawWrappedLine(ctx, style.description, x + cardW / 2, y + 108, cardW - 14, 14, compact ? 2 : 3);

      // 底层配置提示
      const tags = [];
      if (style.weapon) tags.push(WeaponDatabase[style.weapon].name);
      for (const sid of style.spells || []) tags.push(SpellDatabase[sid].name);
      for (const aid of style.combatArts || []) tags.push(CombatArtDatabase[aid].name);
      ctx.fillStyle = "#9a9aad";
      ctx.font = "10px sans-serif";
      ctx.fillText(this.truncateText(ctx, tags.join(" / "), cardW - 14), x + cardW / 2, y + cardH - 14);
    });
  }

  drawChainHints(scene) {
    const ctx = this.ctx;
    const config = scene.playerConfig;
    if (!config || !config.weapon) return;
    const weapon = WeaponDatabase[config.weapon] || null;

    const effective = Utils.getEffectiveChains(config);
    const entries = Object.entries(effective)
      .filter(([key]) => key !== "followUp")
      .map(([key, chainId]) => ({ key, chain: ChainDatabase[chainId] }))
      .filter(({ chain }) => chain);
    const chains = entries;
    const cardW = chains.length >= 3 ? 240 : 250;
    const cardH = 68;
    const gap = 16;
    const totalW = cardW * chains.length + gap * (chains.length - 1);
    const startX = (this.width - totalW) / 2;
    const y = 430;

    let idx = 0;
    for (const { key, chain } of chains) {
      const x = startX + idx * (cardW + gap);

      ctx.fillStyle = "rgba(20, 20, 30, 0.85)";
      ctx.strokeStyle = chain.color || (weapon ? weapon.color : "#f1c40f");
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = chain.color || (weapon ? weapon.color : "#f1c40f");
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      this.drawWrappedLine(ctx, `[${key}] ${chain.name}`, x + cardW / 2, y + 9, cardW - 18, 18, 1);

      ctx.fillStyle = "#aaaaaa";
      ctx.font = "10.5px sans-serif";
      this.drawWrappedLine(ctx, chain.description, x + cardW / 2, y + 33, cardW - 20, 14, 2);

      idx++;
    }
  }

  drawSpellSelection(battle) {
    this.drawOptionSelection(battle, {
      title: "选择咒术（可多选）",
      options: Object.entries(SpellDatabase).map(([id, spell], idx) => ({
        key: String(idx + 1),
        name: spell.name,
        description: spell.description,
        icon: spell.icon,
        color: spell.color,
        selected: battle.playerConfig.spells.includes(id)
      })),
      confirmHint: "按空格确认"
    });
  }

  drawArtSelection(battle) {
    this.drawOptionSelection(battle, {
      title: "选择战技（可多选）",
      options: Object.entries(CombatArtDatabase).map(([id, art], idx) => ({
        key: String(idx + 1),
        name: art.name,
        description: art.description,
        icon: art.icon,
        color: art.color,
        selected: battle.playerConfig.combatArts.includes(id)
      })),
      confirmHint: "按空格开始战斗"
    });
  }

  drawOptionSelection(battle, config) {
    const ctx = this.ctx;

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(config.title, this.width / 2, 70);

    const cardW = 180;
    const cardH = 270;
    const gap = 20;
    const totalW = cardW * config.options.length + gap * (config.options.length - 1);
    const startX = (this.width - totalW) / 2;
    const y = 150;

    config.options.forEach((opt, idx) => {
      const x = startX + idx * (cardW + gap);

      ctx.fillStyle = opt.selected ? "rgba(40, 40, 55, 0.95)" : "rgba(25, 25, 35, 0.9)";
      ctx.strokeStyle = opt.selected ? opt.color : "#555";
      ctx.lineWidth = opt.selected ? 4 : 2;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = opt.color;
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(`[${opt.key}]`, x + cardW / 2, y + 12);

      ctx.font = "bold 44px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(opt.icon, x + cardW / 2, y + 72);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(opt.name, x + cardW / 2, y + 118);

      ctx.fillStyle = "#aaaaaa";
      ctx.font = "12px sans-serif";
      this.wrapText(ctx, opt.description, x + cardW / 2, y + 150, cardW - 24, 18);

      if (opt.selected) {
        ctx.fillStyle = opt.color;
        ctx.font = "bold 14px sans-serif";
        ctx.fillText("✓ 已选择", x + cardW / 2, y + cardH - 24);
      }
    });

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(config.confirmHint, this.width / 2, y + cardH + 20);
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split("");
    let line = "";
    let lineY = y;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line !== "") {
        ctx.fillText(line, x, lineY);
        line = words[i];
        lineY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, lineY);
  }

  hexToRgba(hex, alpha = 1) {
    const text = String(hex || "#ffffff").trim();
    if (text.startsWith("rgba") || text.startsWith("rgb")) return text;
    const clean = text.replace("#", "");
    if (clean.length !== 3 && clean.length !== 6) return `rgba(255,255,255,${alpha})`;
    const full = clean.length === 3
      ? clean.split("").map(ch => ch + ch).join("")
      : clean;
    const value = parseInt(full, 16);
    if (!Number.isFinite(value)) return `rgba(255,255,255,${alpha})`;
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r},${g},${b},${Utils.clamp(alpha, 0, 1)})`;
  }

  drawWrappedLine(ctx, text, x, y, maxWidth, lineHeight, maxLines = Infinity) {
    const chars = String(text || "").split("");
    let line = "";
    let lineY = y;
    let linesDrawn = 0;

    for (let i = 0; i < chars.length; i++) {
      const testLine = line + chars[i];
      if (ctx.measureText(testLine).width > maxWidth && line !== "") {
        if (linesDrawn >= maxLines - 1) {
          ctx.fillText(this.truncateText(ctx, line + chars.slice(i).join(""), maxWidth), x, lineY);
          return lineY + lineHeight;
        }
        ctx.fillText(line, x, lineY);
        line = chars[i];
        lineY += lineHeight;
        linesDrawn++;
      } else {
        line = testLine;
      }
    }

    if (line && linesDrawn < maxLines) {
      ctx.fillText(line, x, lineY);
      lineY += lineHeight;
    }

    return lineY;
  }

  truncateText(ctx, text, maxWidth) {
    const raw = String(text || "");
    if (ctx.measureText(raw).width <= maxWidth) return raw;

    let output = raw;
    while (output.length > 0 && ctx.measureText(output + "...").width > maxWidth) {
      output = output.slice(0, -1);
    }
    return output + "...";
  }

  drawActionBar(scene) {
    const ctx = this.ctx;
    const barW = 600;
    const barH = 18;
    const x = (this.width - barW) / 2;
    const y = this.layout.actionBarY;
    const pendingFollowUp = scene.pendingFollowUp;

    // 背景
    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(x, y, barW, barH);

    // 填充
    const progress = Utils.clamp(scene.actionBar / scene.actionBarMax, 0, 1);
    const grad = ctx.createLinearGradient(x, y, x + barW * progress, y);
    if (pendingFollowUp) {
      grad.addColorStop(0, "#f39c12");
      grad.addColorStop(1, "#f1c40f");
    } else {
      grad.addColorStop(0, "#2980b9");
      grad.addColorStop(1, "#3498db");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, barW * progress, barH);

    // 发光
    ctx.shadowColor = pendingFollowUp ? "rgba(241, 196, 15, 0.6)" : "rgba(52, 152, 219, 0.5)";
    ctx.shadowBlur = 10;
    ctx.fillRect(x, y, barW * progress, 2);
    ctx.shadowBlur = 0;

    // 边框
    ctx.strokeStyle = pendingFollowUp ? "#f1c40f" : "#5a5a6a";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barW, barH);

    // 文字
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pendingFollowUp ? "追加窗口" : "行动条", x + barW / 2, y + barH / 2);
  }

  getCounterFlowHudData(scene) {
    if (!scene || !scene.enemyAttack) return null;
    const attack = scene.enemyAttack;
    const active = scene.getIncomingActiveAttack
      ? scene.getIncomingActiveAttack()
      : (
        scene.activeAttackSystem && scene.activeAttackSystem.active
          ? scene.activeAttackSystem.active.find(item => item.intent && item.intent.kind === "enemyAttack" && item.target === "player")
          : null
      );
    const metrics = this.getEnemyTimingMetrics(scene, attack, active);
    if (!metrics) return null;

    const chain = this.getEnemyChainIntentVisuals(scene);
    const nodeIndex = attack.chainIndex !== undefined ? attack.chainIndex : (active && active.intent ? active.intent.chainIndex : 0);
    const nodeCount = attack.chainCount || (chain && chain.count) || 1;
    const chainName = attack.chainName || (scene.enemyAttackChain && scene.enemyAttackChain.name) || "敌方攻势";
    const hint = scene.getEnemyCounterHint
      ? scene.getEnemyCounterHint(attack)
      : ((attack.counter && attack.counter.hint) || attack.hint || "观察敌方动作");
    const counter = attack.counter || {};
    const primaryAction = counter.canInterrupt
      ? "打断"
      : (counter.canClash ? "拼刀" : (counter.canGuard ? "格挡" : "闪避"));

    return {
      attack,
      active,
      metrics,
      chain,
      nodeIndex: Math.max(0, nodeIndex || 0),
      nodeCount: Math.max(1, nodeCount || 1),
      chainName,
      hint,
      primaryAction,
      color: attack.color || metrics.stateColor || "#e74c3c"
    };
  }

  drawCounterFlowHud(scene, t) {
    const data = this.getCounterFlowHudData(scene);
    if (!data) return;

    const ctx = this.ctx;
    const panelW = 540;
    const panelH = 70;
    const x = (this.width - panelW) / 2;
    const y = this.layout.qteBarY + 2;
    const color = data.color;
    const metrics = data.metrics;
    const inResponse = metrics.inResponse;

    ctx.save();
    ctx.fillStyle = "rgba(7, 9, 15, 0.50)";
    ctx.strokeStyle = this.hexToRgba(inResponse ? "#2ecc71" : color, inResponse ? 0.42 : 0.22);
    ctx.lineWidth = 1.2;
    ctx.shadowColor = inResponse ? "#2ecc71" : color;
    ctx.shadowBlur = inResponse ? 8 : 0;
    ctx.beginPath();
    ctx.roundRect(x, y, panelW, panelH, 8);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    const attackName = String(data.attack.name || "敌方攻击").replace(/^\d+\/\d+\s*/, "");
    const title = `${data.chainName} · 第 ${data.nodeIndex + 1}/${data.nodeCount} 段`;
    const state = inResponse ? "现在" : "预兆";
    this.drawTimingChip(ctx, x + 14, y + 13, state, inResponse ? "#2ecc71" : color, 54);
    this.drawTimingChip(ctx, x + panelW - 106, y + 13, `距命中 ${metrics.timeToHit.toFixed(1)}s`, "#cfd0df", 92);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 13px sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.fillText(this.truncateText(ctx, `${title} · ${attackName}`, panelW - 210), x + panelW / 2, y + 19);

    const rows = data.chain && data.chain.active && Array.isArray(data.chain.rows)
      ? data.chain.rows
      : Array.from({ length: data.nodeCount }, (_, index) => ({ index, color, resolved: index < data.nodeIndex, hot: index === data.nodeIndex }));
    const pipY = y + 39;
    const pipStart = x + 48;
    const pipEnd = x + panelW - 48;
    const span = Math.max(1, rows.length - 1);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.10)";
    ctx.beginPath();
    ctx.moveTo(pipStart, pipY);
    ctx.lineTo(pipEnd, pipY);
    ctx.stroke();

    for (const row of rows) {
      const px = pipStart + (pipEnd - pipStart) * (row.index || 0) / span;
      const current = (row.index || 0) === data.nodeIndex;
      const resolved = row.resolved && !current;
      const pipColor = current ? (inResponse ? "#2ecc71" : color) : (resolved ? "#7f8c8d" : "#48515f");
      const radius = current ? 8 : 5;

      ctx.save();
      ctx.translate(px, pipY);
      ctx.fillStyle = this.hexToRgba(pipColor, current ? 0.35 : 0.20);
      ctx.strokeStyle = pipColor;
      ctx.shadowColor = pipColor;
      ctx.shadowBlur = current ? 8 : 0;
      ctx.beginPath();
      ctx.arc(0, 0, radius + (current ? Math.sin(t * 8) * 1.5 : 0), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String((row.index || 0) + 1), 0, 0);
      ctx.restore();
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "bold 11px sans-serif";
    ctx.fillStyle = inResponse ? "rgba(46, 204, 113, 0.92)" : "rgba(207, 208, 223, 0.78)";
    ctx.fillText(this.truncateText(ctx, `${data.primaryAction} · ${data.hint}`, panelW - 58), x + panelW / 2, y + 54);
    ctx.restore();
  }

  drawEnemyAttackBar(scene) {
    const ctx = this.ctx;
    if (!scene.enemyAttack) return;

    const attack = scene.enemyAttack;
    const active = scene.getIncomingActiveAttack
      ? scene.getIncomingActiveAttack()
      : (
        scene.activeAttackSystem && scene.activeAttackSystem.active
          ? scene.activeAttackSystem.active.find(item => item.intent && item.intent.kind === "enemyAttack" && item.target === "player")
          : null
      );
    const barW = 760;
    const barH = 30;
    const x = (this.width - barW) / 2;
    const y = this.layout.qteBarY;
    const enemyMetrics = this.getEnemyTimingMetrics(scene, attack, active);

    const impactTime = active ? active.profile.impactTime : attack.windup + attack.hitTime;
    const totalTime = Math.max(0.001, impactTime);
    const currentTime = active ? active.elapsed : scene.enemyAttackTimer;
    const progress = Utils.clamp(currentTime / totalTime, 0, 1);

    this.drawEnemyTimingPanel(ctx, enemyMetrics, x, y, barW, barH);

    // 背景
    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(x, y, barW, barH);

    // 响应窗口区域
    const responseStart = active
      ? active.profile.reactionStart
      : Math.max(0, impactTime - Math.min(attack.responseDuration || Difficulty.responseDuration(), Utils.clamp(attack.hitTime + 0.28, 0.48, 0.92)));
    const responseStartRatio = Utils.clamp(responseStart / totalTime, 0, 1);
    const impactRatio = 1;

    ctx.fillStyle = "rgba(46, 204, 113, 0.25)";
    ctx.fillRect(x + barW * responseStartRatio, y, barW * (impactRatio - responseStartRatio), barH);

    // 进度条
    const grad = ctx.createLinearGradient(x, y, x + barW * progress, y);
    grad.addColorStop(0, attack.color);
    grad.addColorStop(1, "#e74c3c");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, barW * progress, barH);

    // 发光
    ctx.shadowColor = attack.color;
    ctx.shadowBlur = 12;
    ctx.fillRect(x, y, barW * progress, 2);
    ctx.shadowBlur = 0;

    // 命中点标记
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(x + barW * impactRatio - 2, y - 4, 4, barH + 8);

    this.drawEnemyWindowLabels(ctx, enemyMetrics, x, y, barW, barH);

    // 边框
    ctx.strokeStyle = "#5a5a6a";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barW, barH);

    // 文字
    ctx.fillStyle = progress < impactRatio ? "#ffffff" : "#000000";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${attack.name}`, x + barW / 2, y + barH / 2);

    // 敌人意图：图标 + 名称（响应窗口打开时脉冲放大）
    const inResponse = scene.enemyAttackPhase === "response";
    const pulse = inResponse ? 1 + Math.sin(performance.now() / 100) * 0.12 : 1;
    const iconX = x + barW / 2;
    const iconY = y - 28;

    ctx.save();
    ctx.translate(iconX, iconY);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = attack.color;
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = attack.color;
    ctx.shadowBlur = inResponse ? 14 : 0;
    ctx.fillText(attack.icon || "⚔", 0, 0);
    ctx.restore();

    ctx.fillStyle = inResponse ? "#2ecc71" : "#aaaaaa";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(inResponse ? `${attack.name} · 可输入` : attack.name, iconX, iconY + 16);

    // 敌人意图教学提示
    ctx.fillStyle = "#aaaaaa";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("绿色窗口 = 反制时机  红线 = 命中时刻", this.width / 2, y - 42);

    this.drawEnemyAttackReadout(scene, attack, x, y, barW, totalTime);
  }

  getEnemyAttackMeta(attack) {
    const id = attack.id || "";
    const telegraph = this.getEnemyTelegraph(attack);
    const typeNames = {
      stab: "刺击",
      slash: "横扫",
      smash: "重砸",
      spell: "法术",
      bolt: "飞弹",
      burst: "咒爆",
      bash: "盾冲",
      strike: "打击"
    };
    const isSpell = attack.interruptible || id.includes("spell") || id.includes("arcane") || id.includes("curse");
    const type = typeNames[telegraph.type] || (isSpell ? "法术" : (id.includes("heavy") || id.includes("shield") ? "重击" : "物理"));
    const isHighThreat = attack.damage >= 30 || attack.stunOnHit || id.includes("heavy") || id.includes("curse");
    const threat = isHighThreat ? "高危" : (attack.windup <= 0.75 ? "快攻" : "中危");
    const threatColor = threat === "高危" ? "#e74c3c" : (threat === "快攻" ? "#2ecc71" : "#f1c40f");
    const counter = attack.counter || {};
    const attackKeys = counter.canClash || counter.canInterrupt ? ["A/S/D"] : [];
    const defenseKeys = (attack.allowedResponses || []).map(id => id === "guard" ? "F" : "SPACE");
    const responseKeys = [...new Set([...attackKeys, ...defenseKeys])].join(" / ") || "?";
    return { type, threat, threatColor, responseKeys };
  }

  getEnemyTimingMetrics(scene, attack, active = null) {
    if (!scene || !attack) return null;
    const meta = this.getEnemyAttackMeta(attack);
    const incoming = active || (scene.getIncomingActiveAttack
      ? scene.getIncomingActiveAttack()
      : (
        scene.activeAttackSystem && scene.activeAttackSystem.active
          ? scene.activeAttackSystem.active.find(item => item.intent && item.intent.kind === "enemyAttack" && item.target === "player")
          : null
      ));
    const impactTime = incoming ? incoming.profile.impactTime : attack.windup + attack.hitTime;
    const totalTime = Math.max(0.001, impactTime);
    const currentTime = incoming ? incoming.elapsed : scene.enemyAttackTimer;
    const responseStart = incoming
      ? incoming.profile.reactionStart
      : Math.max(0, impactTime - Math.min(attack.responseDuration || Difficulty.responseDuration(), Utils.clamp(attack.hitTime + 0.28, 0.48, 0.92)));
    const progress = Utils.clamp(currentTime / totalTime, 0, 1);
    const responseStartRatio = Utils.clamp(responseStart / totalTime, 0, 1);
    const inResponse = scene.enemyAttackPhase === "response";
    const hit = scene.enemyAttackPhase === "hit";
    const timeToWindow = Math.max(0, responseStart - currentTime);
    const timeToHit = Math.max(0, impactTime - currentTime);
    const stateLabel = hit ? "命中" : (inResponse ? "窗口开启" : "预警中");
    const stateColor = hit ? "#e74c3c" : (inResponse ? "#2ecc71" : meta.threatColor);

    return {
      meta,
      attackName: attack.name || "敌方攻击",
      progress,
      responseStartRatio,
      impactRatio: 1,
      stateLabel,
      stateColor,
      timeToWindow,
      timeToHit,
      inResponse,
      hit
    };
  }

  drawEnemyTimingPanel(ctx, metrics, x, y, barW, barH) {
    if (!metrics) return;
    const panelX = x - 14;
    const panelY = y - 14;
    const panelW = barW + 28;
    const panelH = barH + 68;
    const accent = metrics.stateColor || "#e74c3c";
    const timeText = metrics.inResponse || metrics.hit
      ? `距命中 ${metrics.timeToHit.toFixed(1)}s`
      : `距反制窗 ${metrics.timeToWindow.toFixed(1)}s`;

    ctx.save();
    ctx.fillStyle = "rgba(6, 8, 14, 0.34)";
    ctx.strokeStyle = this.hexToRgba(accent, metrics.inResponse ? 0.54 : 0.28);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.shadowColor = accent;
    ctx.shadowBlur = metrics.inResponse ? 9 : 3;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.hexToRgba(accent, metrics.inResponse ? 0.12 : 0.07);
    ctx.fillRect(panelX + 2, panelY + 2, panelW - 4, 4);

    this.drawTimingChip(ctx, x + 18, y - 58, metrics.stateLabel, metrics.stateColor, 88);
    this.drawTimingChip(ctx, x + barW - 122, y - 58, timeText, "#cfd0df", 124);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "#aeb7c4";
    ctx.fillText(`敌方 ${Math.min(100, Math.round(metrics.progress * 100))}%`, x + barW / 2, y - 69);
    ctx.restore();
  }

  drawEnemyWindowLabels(ctx, metrics, x, y, barW, barH) {
    if (!metrics) return;
    const windowX = x + barW * ((metrics.responseStartRatio + metrics.impactRatio) / 2);
    const hitX = x + barW * metrics.impactRatio;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font = "bold 10px sans-serif";
    ctx.fillStyle = "#2ecc71";
    ctx.fillText("反制窗", windowX, y - 8);
    ctx.fillStyle = "#e74c3c";
    ctx.fillText("命中", hitX - 18, y - 8);
    ctx.restore();
  }

  drawEnemyAttackReadout(scene, attack, x, y, barW, totalTime) {
    const ctx = this.ctx;
    const meta = this.getEnemyAttackMeta(attack);
    const active = scene.getIncomingActiveAttack
      ? scene.getIncomingActiveAttack()
      : (
        scene.activeAttackSystem && scene.activeAttackSystem.active
          ? scene.activeAttackSystem.active.find(item => item.intent && item.intent.kind === "enemyAttack" && item.target === "player")
          : null
      );
    const impactTime = active ? active.profile.impactTime : attack.windup + attack.hitTime;
    const currentTime = active ? active.elapsed : scene.enemyAttackTimer;
    const responseStart = active
      ? active.profile.reactionStart
      : Math.max(0, impactTime - Math.min(attack.responseDuration || Difficulty.responseDuration(), Utils.clamp(attack.hitTime + 0.28, 0.48, 0.92)));
    const timeToWindow = Math.max(0, responseStart - currentTime);
    const timeToHit = Math.max(0, impactTime - currentTime);
    const inResponse = scene.enemyAttackPhase === "response";
    const progress = Utils.clamp(currentTime / Math.max(0.001, impactTime), 0, 1);

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font = "bold 12px sans-serif";
    const timing = inResponse
      ? `窗口开启 · ${timeToHit.toFixed(1)}s 后命中`
      : `预警中 · ${timeToWindow.toFixed(1)}s 后开窗`;
    ctx.fillStyle = inResponse ? "#2ecc71" : meta.threatColor;
    ctx.fillText(this.truncateText(ctx, `${meta.type} · ${meta.threat} · 推荐 ${meta.responseKeys} · ${timing}`, barW - 40), x + barW / 2, y + 58);

    if (inResponse) {
      const pulse = 0.45 + Math.sin(performance.now() / 80) * 0.18;
      ctx.strokeStyle = `rgba(46, 204, 113, ${pulse})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(x - 4, y - 4, barW + 8, 38);
    } else if (progress > 0.65) {
      ctx.strokeStyle = "rgba(231, 76, 60, 0.35)";
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 3, y - 3, barW + 6, 36);
    }
    ctx.restore();
  }

  drawQTEBar(scene) {
    const ctx = this.ctx;
    const runner = scene.qteRunner;
    if (!runner) return;

    const node = runner.currentNode();
    if (!node) return;

    const barW = 760;
    const barH = 30;
    const x = (this.width - barW) / 2;
    const y = this.layout.qteBarY;
    const windowBounds = runner.getWindowBounds();
    const metrics = this.getQTEReadabilityMetrics(scene);

    this.drawQTEReadabilityPanel(ctx, metrics, x, y, barW, barH, this.width / 2);

    // 背景
    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(x, y, barW, barH);

    // 判定窗口
    const winStartX = x + barW * (windowBounds.start / windowBounds.duration);
    const winEndX = x + barW * (windowBounds.end / windowBounds.duration);
    const winGrad = ctx.createLinearGradient(winStartX, y, winEndX, y);
    winGrad.addColorStop(0, "rgba(46, 204, 113, 0.25)");
    winGrad.addColorStop(0.5, "rgba(46, 204, 113, 0.55)");
    winGrad.addColorStop(1, "rgba(46, 204, 113, 0.25)");
    ctx.fillStyle = winGrad;
    ctx.fillRect(winStartX, y, winEndX - winStartX, barH);

    // Perfect 标记脉冲
    if (windowBounds.perfect !== null && windowBounds.perfect !== undefined) {
      const perfectX = x + barW * (windowBounds.perfect / windowBounds.duration);
      const pulse = 1 + Math.sin(performance.now() / 120) * 0.25;
      ctx.strokeStyle = "#f1c40f";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#f1c40f";
      ctx.shadowBlur = 10 * pulse;
      ctx.beginPath();
      ctx.moveTo(perfectX, y - 6);
      ctx.lineTo(perfectX, y + barH + 6);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    this.drawQTEWindowLabels(ctx, metrics, x, y, barW, barH);

    // 节奏节点：拍子标记（下一个拍子高亮脉冲）
    if (node.input.type === "rhythm") {
      const nextIdx = runner.rhythmState ? runner.rhythmState.beatIndex : 0;
      for (let i = 0; i < node.input.beats.length; i++) {
        const beat = node.input.beats[i];
        const beatX = x + barW * (beat / windowBounds.duration);
        const isNext = i === nextIdx;
        ctx.beginPath();
        ctx.arc(beatX, y + barH / 2, isNext ? 10 : 7, 0, Math.PI * 2);
        ctx.fillStyle = isNext ? "#f1c40f" : "rgba(155, 89, 182, 0.7)";
        ctx.fill();
        if (isNext) {
          const pulse = 1 + Math.sin(performance.now() / 100) * 0.3;
          ctx.beginPath();
          ctx.arc(beatX, y + barH / 2, 10 * pulse, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(241, 196, 15, 0.6)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    // 进度指针拖尾
    const progress = runner.currentNodeProgress();
    const pointerX = x + barW * progress;
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(pointerX - 40, y, 40, barH);

    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(255,255,255,0.8)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(pointerX, y - 8);
    ctx.lineTo(pointerX - 8, y - 20);
    ctx.lineTo(pointerX + 8, y - 20);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 边框
    ctx.strokeStyle = "#5a5a6a";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barW, barH);

    // 阶段标题
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(metrics ? metrics.stageTitle : this.getNodeStageTitle(node), this.width / 2, y - 48);

    // 链标题
    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(metrics ? this.truncateText(ctx, metrics.chainName, barW - 220) : (runner.chain.name || "QTE"), this.width / 2, y - 27);

    // 输入提示
    const hint = metrics ? metrics.hint : this.getNodeInputHint(node);
    if (hint) {
      ctx.fillStyle = "#dddddd";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(hint, this.width / 2, y + barH + 10);
    }
  }

  getQTEReadabilityMetrics(scene) {
    const runner = scene && scene.qteRunner;
    if (!runner) return null;
    const node = runner.currentNode ? runner.currentNode() : null;
    if (!node) return null;
    const bounds = runner.getWindowBounds ? runner.getWindowBounds() : null;
    if (!bounds) return null;

    const duration = Math.max(0.001, bounds.duration || node.duration || 1);
    const timer = Math.max(0, runner.nodeTimer || 0);
    const progress = runner.currentNodeProgress ? runner.currentNodeProgress() : Utils.clamp(timer / duration, 0, 1);
    const windowStartRatio = Utils.clamp(bounds.start / duration, 0, 1);
    const windowEndRatio = Utils.clamp(bounds.end / duration, 0, 1);
    const perfectRatio = bounds.perfect === null || bounds.perfect === undefined
      ? null
      : Utils.clamp(bounds.perfect / duration, 0, 1);
    const inWindow = timer >= bounds.start && timer <= bounds.end;
    const stateLabel = inWindow ? "窗口内" : (timer < bounds.start ? "等待窗口" : "窗口已过");
    const stateColor = inWindow ? "#2ecc71" : (timer < bounds.start ? "#f1c40f" : "#e74c3c");
    const nextTime = inWindow ? Math.max(0, duration - timer) : Math.max(0, bounds.start - timer);
    const nextLabel = inWindow ? "距节点结束" : (timer < bounds.start ? "距判定窗" : "距超时");
    const inputKey = node.input && node.input.type === "hold_release"
      ? `松开 ${node.input.key}`
      : (node.input ? node.input.key : "");

    return {
      node,
      chainName: runner.chain && runner.chain.name ? runner.chain.name : "QTE",
      stageTitle: this.getNodeStageTitle(node),
      hint: this.getNodeInputHint(node),
      inputKey,
      duration,
      timer,
      progress,
      timeLeft: Math.max(0, duration - timer),
      nextTime,
      nextLabel,
      windowStartRatio,
      windowEndRatio,
      perfectRatio,
      inWindow,
      stateLabel,
      stateColor
    };
  }

  drawQTEReadabilityPanel(ctx, metrics, x, y, barW, barH, centerX = this.width / 2) {
    if (!metrics) return;
    const panelX = x - 14;
    const panelY = y - 14;
    const panelW = barW + 28;
    const panelH = barH + 68;
    const accent = metrics.stateColor || "#f1c40f";

    ctx.save();
    ctx.fillStyle = "rgba(6, 8, 14, 0.34)";
    ctx.strokeStyle = this.hexToRgba(accent, metrics.inWindow ? 0.54 : 0.28);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.shadowColor = accent;
    ctx.shadowBlur = metrics.inWindow ? 9 : 3;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = this.hexToRgba(accent, metrics.inWindow ? 0.12 : 0.07);
    ctx.fillRect(panelX + 2, panelY + 2, panelW - 4, 4);

    this.drawTimingChip(ctx, x + 18, y - 58, metrics.stateLabel, metrics.stateColor, 82);
    this.drawTimingChip(ctx, x + barW - 116, y - 58, `${metrics.nextLabel} ${metrics.nextTime.toFixed(1)}s`, "#cfd0df", 118);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "#aeb7c4";
    ctx.fillText(`节点 ${Math.min(100, Math.round(metrics.progress * 100))}%`, centerX, y - 69);
    ctx.restore();
  }

  drawTimingChip(ctx, x, y, text, color, width = 92) {
    ctx.save();
    ctx.fillStyle = this.hexToRgba(color || "#ffffff", 0.13);
    ctx.strokeStyle = this.hexToRgba(color || "#ffffff", 0.46);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, width, 22, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color || "#ffffff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.truncateText(ctx, text || "", width - 12), x + width / 2, y + 11);
    ctx.restore();
  }

  drawQTEWindowLabels(ctx, metrics, x, y, barW, barH) {
    if (!metrics) return;
    const windowMid = x + barW * ((metrics.windowStartRatio + metrics.windowEndRatio) / 2);

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font = "bold 10px sans-serif";
    ctx.fillStyle = "#2ecc71";
    ctx.fillText("判定窗", windowMid, y - 8);

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.font = "bold 11px sans-serif";
    ctx.fillStyle = "#cfd0df";
    ctx.fillText(`剩余 ${metrics.timeLeft.toFixed(1)}s`, x + barW - 10, y + barH / 2);
    ctx.restore();
  }

  getNodeStageTitle(node) {
    if (!node || !node.input) return "";
    const type = node.input.type;
    if (type === "press") return "精准按键";
    if (type === "hold_release") return "按住蓄力";
    if (type === "rhythm") return "节奏连击";
    return "";
  }

  getNodeInputHint(node) {
    if (!node || !node.input) return "";
    const input = node.input;
    if (input.type === "press") return `按 ${input.key} · 绿色窗口内判定`;
    if (input.type === "hold_release") return `按住 ${input.key} · 金色 Perfect 点松开`;
    if (input.type === "rhythm") return `按 ${input.key} 踩紫色拍子 · 乱按记 miss`;
    return `按 ${input.key}`;
  }

  drawDemoQTEBar(scene, bounds = null) {
    const ctx = this.ctx;
    const runner = scene.qteRunner;
    const stage = bounds || this.getDemoStageBounds();
    const barW = Math.min(760, Math.max(520, stage.w - 36));
    const barH = 30;
    const x = stage.centerX - barW / 2;
    const y = this.layout.qteBarY;
    const metrics = { x, y, w: barW, h: barH, centerX: stage.centerX };
    if (!runner) return metrics;

    const node = runner.currentNode();
    if (!node) return metrics;

    const windowBounds = runner.getWindowBounds();
    const readability = this.getQTEReadabilityMetrics(scene);

    this.drawQTEReadabilityPanel(ctx, readability, x, y, barW, barH, stage.centerX);

    // 背景
    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(x, y, barW, barH);

    // 判定窗口
    const winStartX = x + barW * (windowBounds.start / windowBounds.duration);
    const winEndX = x + barW * (windowBounds.end / windowBounds.duration);
    const winGrad = ctx.createLinearGradient(winStartX, y, winEndX, y);
    winGrad.addColorStop(0, "rgba(46, 204, 113, 0.25)");
    winGrad.addColorStop(0.5, "rgba(46, 204, 113, 0.55)");
    winGrad.addColorStop(1, "rgba(46, 204, 113, 0.25)");
    ctx.fillStyle = winGrad;
    ctx.fillRect(winStartX, y, winEndX - winStartX, barH);

    // Perfect 标记脉冲
    if (windowBounds.perfect !== null && windowBounds.perfect !== undefined) {
      const perfectX = x + barW * (windowBounds.perfect / windowBounds.duration);
      const pulse = 1 + Math.sin(performance.now() / 120) * 0.25;
      ctx.strokeStyle = "#f1c40f";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#f1c40f";
      ctx.shadowBlur = 14 * pulse;
      ctx.beginPath();
      ctx.moveTo(perfectX, y - 10);
      ctx.lineTo(perfectX, y + barH + 10);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    this.drawQTEWindowLabels(ctx, readability, x, y, barW, barH);

    // 节奏节点：拍子标记（下一个拍子高亮脉冲）
    if (node.input.type === "rhythm") {
      const nextIdx = runner.rhythmState ? runner.rhythmState.beatIndex : 0;
      for (let i = 0; i < node.input.beats.length; i++) {
        const beat = node.input.beats[i];
        const beatX = x + barW * (beat / windowBounds.duration);
        const isNext = i === nextIdx;
        ctx.beginPath();
        ctx.arc(beatX, y + barH / 2, isNext ? 12 : 8, 0, Math.PI * 2);
        ctx.fillStyle = isNext ? "#f1c40f" : "rgba(155, 89, 182, 0.7)";
        ctx.fill();
        if (isNext) {
          const pulse = 1 + Math.sin(performance.now() / 100) * 0.3;
          ctx.beginPath();
          ctx.arc(beatX, y + barH / 2, 12 * pulse, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(241, 196, 15, 0.6)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    // 进度指针拖尾
    const progress = runner.currentNodeProgress();
    const pointerX = x + barW * progress;
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(pointerX - 50, y, 50, barH);

    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(255,255,255,0.8)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(pointerX, y - 8);
    ctx.lineTo(pointerX - 8, y - 20);
    ctx.lineTo(pointerX + 8, y - 20);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 边框
    ctx.strokeStyle = "#5a5a6a";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barW, barH);

    // 阶段标题
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(readability ? readability.stageTitle : this.getNodeStageTitle(node), stage.centerX, y - 48);

    // 链标题
    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(this.truncateText(ctx, readability ? readability.chainName : (runner.chain.name || "QTE"), barW - 220), stage.centerX, y - 27);

    // 输入提示
    const hint = readability ? readability.hint : this.getNodeInputHint(node);
    if (hint) {
      ctx.fillStyle = "#dddddd";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(this.truncateText(ctx, hint, barW - 30), stage.centerX, y + barH + 10);
    }
    return metrics;
  }

  drawStatusIcons(scene) {
    const ctx = this.ctx;
    const icons = [];
    const seen = new Set();
    const addIcon = (key, item) => {
      if (seen.has(key)) return;
      seen.add(key);
      icons.push(item);
    };

    if (scene.armorBreakActive) addIcon("enemy:armorBreak", { icon: "破", color: "#e74c3c", count: scene.armorBreakTurns });
    if (scene.playerState) {
      const ps = scene.playerState;
      if (ps.consecutiveDodges > 0) addIcon("player:dodgeStreak", { icon: "闪", color: "#2ecc71", count: ps.consecutiveDodges });
      if (ps.shieldEnchanted) addIcon("player:shieldEnchant", { icon: "咒", color: "#9b59b6" });
      if (ps.absorbReady) addIcon("player:absorbReady", { icon: "吸", color: "#5dade2" });
      if (ps.spellEnergy > ps.maxSpellEnergy) addIcon("player:overload", { icon: "溢", color: "#f39c12" });
    }
    if (scene.enemyStunTimer > 0) addIcon("enemy:stun", { icon: "晕", color: "#f1c40f", count: Math.ceil(scene.enemyStunTimer * 10) / 10 });
    if (scene.statusSystem) {
      for (const status of scene.statusSystem.list().slice(0, 6)) {
        const def = scene.statusSystem.getDefinition(status.id);
        addIcon(`${status.target}:${status.id}`, {
          icon: def.icon || "态",
          color: def.color || "#ffffff",
          count: status.duration
        });
      }
    }

    if (icons.length === 0) return;

    const startX = 20;
    let y = 280;
    const size = 22;
    const gap = 6;

    for (const item of icons) {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.roundRect(startX, y, size, size, 4);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.icon, startX + size / 2, y + size / 2);

      if (item.count !== undefined) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(String(item.count), startX + size + 4, y + size / 2 + 1);
      }

      y += size + gap;
    }
  }

  drawScreenFlash(scene) {
    const ctx = this.ctx;
    const f = scene.screenFlash;
    const alpha = (f.timer / f.maxTime) * 0.18 * this.visualScale("screenFlash");
    ctx.fillStyle = f.color;
    ctx.globalAlpha = alpha;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalAlpha = 1;
  }

  drawTurnBanner(scene) {
    const ctx = this.ctx;
    const banner = scene.turnBanner;
    const progress = 1 - banner.timer / banner.maxTime;
    const alpha = Math.sin(progress * Math.PI);
    const y = this.height / 2 - 60 + (1 - alpha) * 30;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = banner.color;
    ctx.font = "bold 52px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 12;
    ctx.fillText(banner.text, this.width / 2, y);
    ctx.restore();
  }

  drawDemo(scene, t) {
    const ctx = this.ctx;
    const bounds = this.getDemoStageBounds();

    if (scene.turnState === "demo_main") {
      this.drawDemoMenu(scene, bounds);
    } else if (scene.turnState === "demo_list") {
      this.drawDemoList(scene, bounds);
    } else if (scene.turnState === "demo_preview") {
      this.drawDemoPreview(scene, bounds);
    } else if (scene.turnState === "demo_enemy_windup") {
      this.drawDemoEnemyWindup(scene, t, bounds);
    } else if (scene.turnState === "demo_action_sequence") {
      this.drawDemoActionSequence(scene, t, bounds);
    } else if (scene.turnState === "demo_qte") {
      // 演示 QTE 播放中 — 中央舞台，底部操作区
      const ctx = this.ctx;
      ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = "#f1c40f";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(this.truncateText(ctx, scene.previewTitle, bounds.w), bounds.centerX, this.layout.demoTitleY);

      const modeText = scene.manualMode ? "手动试玩：请在判定窗口内按键" : "自动演示中";
      ctx.fillStyle = "#aaaaaa";
      ctx.font = "14px sans-serif";
      ctx.fillText(modeText, bounds.centerX, 103);

      if (scene.demoCounterAttack) {
        this.drawDemoCounterAttackIndicator(ctx);
      }

      const focusLines = scene.getActiveDirectorLines ? scene.getActiveDirectorLines(4) : [];
      if (focusLines.length > 0) {
        this.drawDemoFocusPanel(ctx, focusLines, 128, Math.min(760, bounds.w), bounds.centerX);
      }

      const qteBar = this.drawDemoQTEBar(scene, bounds);

      const node = scene.qteRunner ? scene.qteRunner.currentNode() : null;
      if (node) {
        const key = node.input.type === "hold_release" ? `松开 ${node.input.key}` : node.input.key;
        this.drawBigKeyPrompt(scene, key, "", 322, t, bounds.centerX);
      }

      if (!scene.manualMode && scene.qteRunner) {
        this.drawExpectedInputMarker(scene.qteRunner, this.layout.qteBarY, qteBar.w, qteBar.h, qteBar.centerX);
      }
    }
  }

  getDemoStageBounds() {
    const compact = typeof window !== "undefined"
      && typeof window.matchMedia === "function"
      && window.matchMedia("(max-width: 900px), (max-height: 520px)").matches;
    if (compact) {
      return {
        x: 40,
        w: this.width - 80,
        centerX: this.width / 2,
        compact: true
      };
    }

    // Desktop demo keeps the explain drawer on the right; keep playable choices in the visible stage lane.
    return {
      x: 34,
      w: 640,
      centerX: 354,
      compact: false
    };
  }

  drawDemoCounterAttackIndicator(ctx) {
    // 敌方回合反击：在顶部显示红色预警和敌人意图
    const cx = this.width / 2;
    const pulse = 1 + Math.sin(performance.now() / 120) * 0.15;

    ctx.save();
    ctx.fillStyle = "#e74c3c";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor = "#e74c3c";
    ctx.shadowBlur = 12 * pulse;
    ctx.fillText("⚠ 敌方回合中发动反击", cx, 115);
    ctx.shadowBlur = 0;

    // 敌方意图图标
    ctx.fillStyle = "rgba(231, 76, 60, 0.2)";
    ctx.beginPath();
    ctx.arc(this.width - 160, 125, 26 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.width - 160, 125, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#e74c3c";
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🗡", this.width - 160, 125);
    ctx.restore();
  }

  drawDemoFocusPanel(ctx, lines, y, maxWidth = 760, centerX = this.width / 2) {
    const cleanLines = (lines || []).filter(Boolean).slice(0, 4);
    if (cleanLines.length === 0) return;

    const lineH = 20;
    const padX = 18;
    const padY = 10;
    const w = maxWidth;
    const h = padY * 2 + cleanLines.length * lineH;
    const x = centerX - w / 2;

    ctx.save();
    ctx.fillStyle = "rgba(10, 12, 18, 0.62)";
    ctx.strokeStyle = "rgba(241, 196, 15, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    cleanLines.forEach((line, idx) => {
      ctx.fillStyle = idx === 0 ? "#f1c40f" : "#d9deea";
      ctx.font = idx === 0 ? "bold 14px sans-serif" : "13px sans-serif";
      ctx.fillText(this.truncateText(ctx, line, w - padX * 2), x + padX, y + padY + idx * lineH);
    });
    ctx.restore();
  }

  drawDemoActionSequence(scene, t, bounds = null) {
    const ctx = this.ctx;
    const stage = bounds || this.getDemoStageBounds();
    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(this.truncateText(ctx, scene.previewTitle, stage.w), stage.centerX, this.layout.demoTitleY);

    const seq = scene.actionSequence;
    if (!seq) return;

    if (scene.enemyAttack) {
      this.drawDemoEnemyAttackBar(scene, stage, { suppressReadout: true });
    }

    const phase = seq.phases[seq.phaseIndex];
    const total = seq.phases.length;
    const completed = seq.phaseIndex;
    const hasSequenceVisual = !!(phase && phase.visual);
    const actionKeyPromptY = hasSequenceVisual ? 408 : 365;

    if (hasSequenceVisual) {
      this.drawDemoActionSequenceVisual(ctx, phase.visual, stage, t);
    }

    // 当前阶段大字说明
    ctx.fillStyle = "#ffffff";
    ctx.font = hasSequenceVisual ? "bold 26px sans-serif" : "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const phaseLabelY = hasSequenceVisual ? 294 : this.height / 2 - 30;
    ctx.fillText(this.truncateText(ctx, phase.label || "", stage.w), stage.centerX, phaseLabelY);

    if (phase.detail) {
      ctx.fillStyle = "#d8d8e8";
      ctx.font = "15px sans-serif";
      ctx.textBaseline = "top";
      ctx.fillText(this.truncateText(ctx, phase.detail, stage.w), stage.centerX, phaseLabelY + 30);
    }

    // 阶段进度点
    const dotY = hasSequenceVisual ? 366 : this.height / 2 + 30;
    const startX = stage.centerX - (total - 1) * 20;
    for (let i = 0; i < total; i++) {
      const x = startX + i * 40;
      ctx.beginPath();
      ctx.arc(x, dotY, 6, 0, Math.PI * 2);
      ctx.fillStyle = i <= completed ? "#f1c40f" : "#5a5a6a";
      ctx.fill();
      if (i === completed) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // 当前按键提示（如果阶段标签包含按键）
    const keyMatch = phase.key ? [null, phase.key] : (phase.label || "").match(/按 ([A-Z]+)/);
    if (keyMatch && keyMatch[1]) {
      this.drawBigKeyPrompt(scene, keyMatch[1], "", actionKeyPromptY, t, stage.centerX);
    }
  }

  drawDemoActionSequenceVisual(ctx, visual, stage, t) {
    if (!visual || visual.scheme !== "counterflow") return;
    this.drawDemoCounterflowTrack(ctx, visual, stage, t);
  }

  drawDemoCounterflowTrack(ctx, visual, stage, t) {
    const track = Array.isArray(visual.track) ? visual.track : [];
    if (track.length === 0) return;

    const panelW = Math.min(700, Math.max(430, stage.w - 34));
    const panelH = 130;
    const x = stage.centerX - panelW / 2;
    const y = 128;
    const active = Math.max(0, visual.active || 0);
    const accent = "#16a085";
    const enemyNodes = track
      .map((node, index) => ({ ...node, index }))
      .filter(node => node.lane === "enemy");
    const playerNodes = track
      .map((node, index) => ({ ...node, index }))
      .filter(node => node.lane !== "enemy");
    const rowY = {
      enemy: y + 42,
      player: y + 92
    };
    const leftPad = 78;
    const rightPad = 36;
    const laneW = panelW - leftPad - rightPad;
    const laneX = x + leftPad;

    ctx.save();
    ctx.fillStyle = "rgba(8, 12, 18, 0.72)";
    ctx.strokeStyle = this.hexToRgba(accent, 0.42);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, panelW, panelH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = this.hexToRgba(accent, 0.10);
    ctx.fillRect(x + 10, rowY.enemy - 16, panelW - 20, 30);
    ctx.fillStyle = "rgba(52, 152, 219, 0.08)";
    ctx.fillRect(x + 10, rowY.player - 16, panelW - 20, 30);

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "#e74c3c";
    ctx.fillText("敌方", x + 22, rowY.enemy);
    ctx.fillStyle = accent;
    ctx.fillText("我方", x + 22, rowY.player);

    const positionNodes = nodes => {
      const count = Math.max(1, nodes.length - 1);
      return nodes.map((node, laneIndex) => ({
        ...node,
        laneIndex,
        x: laneX + (laneIndex / count) * laneW,
        y: rowY[node.lane === "enemy" ? "enemy" : "player"]
      }));
    };
    const positionedEnemy = positionNodes(enemyNodes);
    const positionedPlayer = positionNodes(playerNodes);
    const allNodes = [...positionedEnemy, ...positionedPlayer];
    const byIndex = new Map(allNodes.map(node => [node.index, node]));

    const drawRail = nodes => {
      if (nodes.length <= 1) return;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      nodes.forEach((node, idx) => {
        if (idx === 0) ctx.moveTo(node.x, node.y);
        else ctx.lineTo(node.x, node.y);
      });
      ctx.stroke();
    };
    drawRail(positionedEnemy);
    drawRail(positionedPlayer);

    this.drawDemoCounterflowLinks(ctx, byIndex, active, accent, t);

    for (const node of allNodes) {
      const done = node.index < active;
      const current = node.index === active;
      const future = node.index > active;
      const color = node.lane === "enemy" ? "#e74c3c" : accent;
      const pulse = current ? (1 + Math.sin(t * 10) * 0.10) : 1;
      const radius = (current ? 13 : 10) * pulse;

      ctx.save();
      ctx.translate(node.x, node.y);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = future ? 0.34 : (done ? 0.48 : 0.92);
      ctx.shadowColor = color;
      ctx.shadowBlur = current ? 18 : 8;
      ctx.fillStyle = this.hexToRgba(color, current ? 0.28 : 0.16);
      ctx.strokeStyle = done ? "rgba(255,255,255,0.38)" : color;
      ctx.lineWidth = current ? 3 : 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.globalAlpha = future ? 0.52 : 1;
      ctx.fillStyle = current ? "#ffffff" : "#dfe7ef";
      ctx.font = node.icon.length > 2 ? "bold 9px sans-serif" : "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowBlur = 0;
      ctx.fillText(node.icon || "", 0, 0);

      ctx.font = "11px sans-serif";
      ctx.fillStyle = future ? "rgba(220,226,236,0.55)" : "#dce6ef";
      ctx.textBaseline = "top";
      ctx.fillText(this.truncateText(ctx, node.label || "", 64), 0, 18);
      ctx.restore();
    }

    if (visual.note) {
      ctx.fillStyle = "#cfd8e8";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(this.truncateText(ctx, visual.note, panelW - 32), stage.centerX, y + panelH - 22);
    }
    ctx.restore();
  }

  drawDemoCounterflowLinks(ctx, byIndex, active, accent, t) {
    const linkSets = [
      [0, 3, "#5dade2"],
      [1, 4, accent],
      [2, 5, "#f1c40f"],
      [5, 6, accent],
      [6, 0, "#9b59b6"]
    ];

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (const [fromIndex, toIndex, color] of linkSets) {
      const from = byIndex.get(fromIndex);
      const to = byIndex.get(toIndex);
      if (!from || !to) continue;
      const hot = active === fromIndex || active === toIndex || (active === 5 && fromIndex === 2);
      const alpha = hot ? 0.55 + Math.sin(t * 8) * 0.08 : (active > toIndex ? 0.20 : 0.10);
      ctx.strokeStyle = this.hexToRgba(color, alpha);
      ctx.lineWidth = hot ? 4 : 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = hot ? 16 : 6;
      ctx.beginPath();
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2 - (from.y === to.y ? 18 : 0);
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(midX, midY, to.x, to.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawDemoEnemyWindup(scene, t, bounds = null) {
    const ctx = this.ctx;
    const stage = bounds || this.getDemoStageBounds();
    ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(this.truncateText(ctx, scene.previewTitle, stage.w), stage.centerX, this.layout.demoTitleY);

    const modeText = scene.manualMode ? "手动试玩" : "自动演示";
    ctx.fillStyle = "#aaaaaa";
    ctx.font = "14px sans-serif";
    ctx.fillText(this.truncateText(ctx, `${modeText} — ${scene.message}`, stage.w), stage.centerX, 103);

    this.drawDemoEnemyAttackBar(scene, stage);

    const key = scene.demoDefenseKey || "?";
    this.drawBigKeyPrompt(scene, key, "命中后按", 300, t, stage.centerX);

    // 阶段说明（简洁版，避免遮挡）
    const steps = [
      "1. 红色进度条推进",
      "2. 绿色窗口出现",
      "3. 命中红线 = 进入防御 QTE"
    ];
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#ccccdd";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const stepX = stage.x + 8;
    let stepY = 340;
    for (const step of steps) {
      ctx.fillText(step, stepX, stepY);
      stepY += 20;
    }
  }

  drawDemoEnemyAttackBar(scene, bounds = null, options = {}) {
    const ctx = this.ctx;
    if (!scene.enemyAttack) return;
    const stage = bounds || this.getDemoStageBounds();

    const attack = scene.enemyAttack;
    const barW = Math.min(760, Math.max(520, stage.w - 36));
    const barH = 30;
    const x = stage.centerX - barW / 2;
    const y = this.layout.qteBarY;

    const totalTime = attack.windup + attack.hitTime;
    const progress = Utils.clamp(scene.enemyAttackTimer / totalTime, 0, 1);

    // 背景
    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(x, y, barW, barH);

    // 响应窗口区域
    const responseDuration = attack.responseDuration || Difficulty.responseDuration();
    const responseStartRatio = Utils.clamp(Math.max(0, attack.windup - responseDuration) / totalTime, 0, 1);
    const windupEndRatio = Utils.clamp(attack.windup / totalTime, 0, 1);

    ctx.fillStyle = "rgba(46, 204, 113, 0.25)";
    ctx.fillRect(x + barW * responseStartRatio, y, barW * (windupEndRatio - responseStartRatio), barH);

    // 进度条
    const grad = ctx.createLinearGradient(x, y, x + barW * progress, y);
    grad.addColorStop(0, attack.color);
    grad.addColorStop(1, "#e74c3c");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, barW * progress, barH);

    ctx.shadowColor = attack.color;
    ctx.shadowBlur = 14;
    ctx.fillRect(x, y, barW * progress, 2);
    ctx.shadowBlur = 0;

    // 命中点标记
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(x + barW * windupEndRatio - 2, y - 4, 4, barH + 8);

    // 边框
    ctx.strokeStyle = "#5a5a6a";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barW, barH);

    // 文字
    ctx.fillStyle = progress < windupEndRatio ? "#ffffff" : "#000000";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${attack.name}`, x + barW / 2, y + barH / 2);

    if (!options.suppressReadout) {
      this.drawEnemyAttackReadout(scene, attack, x, y, barW, totalTime);
    }
  }

  drawDemoMenu(scene, bounds = null) {
    const ctx = this.ctx;
    const stage = bounds || this.getDemoStageBounds();
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = "#f1c40f";
    ctx.font = stage.compact ? "bold 40px sans-serif" : "bold 34px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("效果演示模式", stage.centerX, this.layout.demoTitleY);

    const categories = scene.categories;
    const cardW = stage.compact ? 210 : 190;
    const cardH = stage.compact ? 110 : 100;
    const gap = stage.compact ? 24 : 18;
    const row1Count = Math.min(3, categories.length);
    const row2Count = Math.max(0, categories.length - row1Count);
    const row1W = cardW * row1Count + gap * (row1Count - 1);
    const row2W = row2Count > 0 ? cardW * row2Count + gap * (row2Count - 1) : 0;
    const row1X = stage.centerX - row1W / 2;
    const row2X = stage.centerX - row2W / 2;
    const row1Y = 120;
    const row2Y = row1Y + cardH + gap;

    categories.forEach((cat, idx) => {
      const row = idx < row1Count ? 0 : 1;
      const col = row === 0 ? idx : idx - row1Count;
      const x = row === 0 ? row1X + col * (cardW + gap) : row2X + col * (cardW + gap);
      const y = row === 0 ? row1Y : row2Y;

      ctx.fillStyle = "rgba(30, 30, 40, 0.9)";
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = stage.compact ? "bold 34px sans-serif" : "bold 30px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cat.icon, x + cardW / 2, y + (stage.compact ? 36 : 32));

      ctx.font = stage.compact ? "bold 20px sans-serif" : "bold 18px sans-serif";
      ctx.fillText(cat.name, x + cardW / 2, y + (stage.compact ? 76 : 70));

      ctx.fillStyle = "#aaaaaa";
      ctx.font = "12px sans-serif";
      ctx.fillText(`按 ${idx + 1}`, x + cardW / 2, y + cardH - 13);
    });

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    const modeText = scene.manualMode ? "手动试玩" : "自动演示";
    this.drawWrappedLine(
      ctx,
      `当前：${modeText} | 1-${categories.length} 选择分类 | W 切换风格 | M 切换模式 | 6 切换难度 | ESC 返回`,
      stage.centerX,
      this.layout.bottomHintY - (stage.compact ? 0 : 8),
      stage.w,
      18,
      2
    );
  }

  drawDemoList(scene, bounds = null) {
    const ctx = this.ctx;
    const stage = bounds || this.getDemoStageBounds();
    const items = scene.getCurrentPageItems();
    const totalItems = scene.getCurrentItems().length;
    const totalPages = scene.getTotalPages();
    const categoryName = scene.getCategoryName();

    ctx.fillStyle = "rgba(0, 0, 0, 0.76)";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 30px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(this.truncateText(ctx, `${categoryName} — 选择要演示的效果`, stage.w), stage.centerX, this.layout.demoTitleY);

    ctx.fillStyle = "#aaaaaa";
    ctx.font = "14px sans-serif";
    ctx.fillText(`共 ${totalItems} 项  |  第 ${scene.listPage + 1}/${totalPages} 页`, stage.centerX, 105);

    const cols = 2;
    const cardW = stage.compact ? 360 : 300;
    const cardH = stage.compact ? 100 : 102;
    const gapX = stage.compact ? 24 : 18;
    const gapY = 14;
    const totalW = cardW * cols + gapX * (cols - 1);
    const startX = Math.floor(stage.centerX - totalW / 2);
    const startY = 120;

    items.forEach((item, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);

      ctx.fillStyle = "rgba(25, 25, 35, 0.9)";
      ctx.strokeStyle = item.chain ? "#5a5a6a" : "#4a4a5a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(this.truncateText(ctx, `${idx + 1}. ${item.name}`, cardW - 20), x + 12, y + 10);

      ctx.fillStyle = "#aaaaaa";
      ctx.font = "13px sans-serif";
      this.drawWrappedLine(ctx, item.description, x + 12, y + 34, cardW - 24, 18, 3);

      ctx.fillStyle = "#666f85";
      ctx.font = "12px sans-serif";
      ctx.fillText(item.chain ? "QTE 链演示" : "即时效果预览", x + 12, y + cardH - 18);
    });

    const modeText = scene.manualMode ? "手动试玩" : "自动演示";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    this.drawWrappedLine(
      ctx,
      `当前：${modeText} | 1-${items.length} 选择 | A/← 上页 | D/→ 下页 | M 切换模式 | ESC 返回`,
      stage.centerX,
      this.layout.bottomHintY - (stage.compact ? 0 : 8),
      stage.w,
      18,
      2
    );
  }

  drawDemoPreview(scene, bounds = null) {
    const ctx = this.ctx;
    const stage = bounds || this.getDemoStageBounds();
    ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
    ctx.fillRect(0, 0, this.width, this.height);

    const panelW = Math.min(stage.compact ? stage.w : 604, stage.w);
    const panelX = stage.centerX - panelW / 2;
    const panelY = stage.compact ? 150 : 168;
    const panelBottom = stage.compact ? 410 : 428;

    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 30px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(this.truncateText(ctx, scene.previewTitle, stage.w), stage.centerX, this.layout.demoTitleY);

    ctx.fillStyle = "#dfe5f2";
    ctx.font = "bold 17px sans-serif";
    this.drawWrappedLine(ctx, scene.previewText, stage.centerX, 112, stage.w, 24, 2);

    const summaryLines = scene.getPreviewSummaryLines
      ? scene.getPreviewSummaryLines(stage.compact ? 6 : 8)
      : (scene.resultLines || []).slice(0, 6);
    if (summaryLines.length > 0) {
      const lineH = stage.compact ? 19 : 21;
      const panelH = Math.min(panelBottom - panelY, 42 + summaryLines.length * lineH);

      ctx.fillStyle = "rgba(8, 10, 16, 0.84)";
      ctx.strokeStyle = "rgba(241, 196, 15, 0.52)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#f1c40f";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("演示摘要", panelX + 18, panelY + 10);

      ctx.font = stage.compact ? "12px sans-serif" : "13px sans-serif";
      const maxLines = Math.floor((panelH - 42) / lineH);
      summaryLines.slice(0, maxLines).forEach((line, idx) => {
        ctx.fillStyle = line.startsWith("看点：") ? "#f1c40f" : "#d9deea";
        ctx.fillText(this.truncateText(ctx, line, panelW - 36), panelX + 18, panelY + 34 + idx * lineH);
      });
    }

    const hintW = Math.min(stage.w, 360);
    const hintH = 30;
    const hintX = stage.centerX - hintW / 2;
    const hintY = this.height - 58;
    ctx.fillStyle = "rgba(8, 10, 16, 0.82)";
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(hintX, hintY, hintW, hintH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#d8deea";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("R 重播当前演示 / 任意键返回列表", stage.centerX, hintY + hintH / 2);
  }

  drawGameOver(battle) {
    const ctx = this.ctx;

    ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
    ctx.fillRect(0, 0, this.width, this.height);

    const won = battle.enemyHp <= 0;
    ctx.fillStyle = won ? "#2ecc71" : "#e74c3c";
    ctx.font = "bold 56px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(won ? "胜利！" : "战败…", this.width / 2, this.height / 2 - 30);

    ctx.fillStyle = "#ffffff";
    ctx.font = "20px sans-serif";
    ctx.fillText("点击按钮继续", this.width / 2, this.height / 2 + 30);

    const lines = battle.getBattleResultLines ? battle.getBattleResultLines() : [];
    if (lines.length > 0) {
      const panelW = 520;
      const panelX = this.width / 2 - panelW / 2;
      const panelY = this.height / 2 + 70;
      const lineH = 22;
      const panelH = 34 + lines.length * lineH;

      ctx.fillStyle = "rgba(24, 28, 40, 0.92)";
      ctx.strokeStyle = won ? "rgba(46, 204, 113, 0.42)" : "rgba(231, 76, 60, 0.42)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#f1c40f";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("战斗摘要", panelX + 18, panelY + 10);

      ctx.fillStyle = "#dbe2ef";
      ctx.font = "13px sans-serif";
      lines.forEach((line, idx) => {
        ctx.fillText(this.truncateText(ctx, line, panelW - 36), panelX + 18, panelY + 32 + idx * lineH);
      });
    }
  }
}
