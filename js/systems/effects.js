class EffectEventQueue {
  constructor(owner, options = {}) {
    this.owner = owner;
    this.mode = options.mode || "battle";
    this.pending = [];
    this.recent = [];
    this.maxRecent = 16;
  }

  emit(event) {
    if (!event || !event.type) return;
    const normalized = {
      source: "system",
      target: null,
      intensity: 1,
      duration: 0,
      ...event,
      createdAt: performance.now()
    };
    this.pending.push(normalized);
    this.recent.unshift(normalized);
    if (this.recent.length > this.maxRecent) this.recent.pop();
  }

  update(dt) {
    if (this.pending.length === 0) return;
    const events = this.pending.splice(0, this.pending.length);
    for (const event of events) {
      this.apply(event, dt);
    }
  }

  clear() {
    this.pending = [];
    this.recent = [];
  }

  apply(event) {
    if (!this.owner) return;

    if (event.type === "particles") {
      const pos = this.resolveAnchor(event.anchor || event.target || event.source);
      if (this.owner.particles) {
        this.owner.particles.emit(event.preset || "status", pos.x, pos.y, event.intensity || 1);
      }
      return;
    }

    if (event.type === "burst") {
      const pos = this.resolveAnchor(event.anchor || event.target || event.source);
      const target = event.toAnchor ? this.resolveAnchor(event.toAnchor) : null;
      if (this.owner.effectBursts) {
        this.owner.effectBursts.emit(event, pos, target);
      }
      return;
    }

    if (event.type === "actorReaction") {
      const target = event.target || "enemy";
      const reaction = event.reaction || event.reactionType || event.kind || "hit";
      if (this.owner.triggerActorReaction) {
        this.owner.triggerActorReaction(target, reaction, event.intensity || 1, event);
      } else if (this.owner.actorReactions) {
        this.owner.actorReactions.trigger(target, reaction, event.intensity || 1, event);
      }
      return;
    }

    if (event.type === "floatingText") {
      const pos = this.resolveAnchor(event.anchor || event.target || event.source);
      if (this.owner.floatingTexts) {
        this.owner.floatingTexts.add(event.text || "", event.x ?? pos.x, event.y ?? pos.y, event.textType || "status");
      }
      return;
    }

    if (event.type === "screenFlash") {
      this.owner.screenFlash = {
        color: event.color || "#ffffff",
        timer: event.duration || 0.15,
        maxTime: event.duration || 0.15
      };
      return;
    }

    if (event.type === "screenShake") {
      this.owner.screenShake = Math.max(this.owner.screenShake || 0, event.amount || event.intensity || 0.1);
      return;
    }

    if (event.type === "cameraZoom" && this.owner.setCameraZoom) {
      this.owner.setCameraZoom(event.zoom || 1.1, event.duration || 0.25);
      return;
    }

    if (event.type === "impact" && this.owner.triggerImpactFrames) {
      this.owner.triggerImpactFrames(event.count || 1);
    }
  }

  emitTransition(transition) {
    if (!transition) return;
    const eventName = transition.visualEvent || transition.effect || "";
    if (!eventName) {
      this.emitTransitionReaction(transition, "");
      return;
    }

    if (this.emitRegisteredTransition(eventName)) {
      this.emitTransitionReaction(transition, eventName);
      return;
    }

    this.emitTransitionReaction(transition, eventName);

    const lower = eventName.toLowerCase();
    if (lower.includes("fire")) {
      const isImpact = lower.includes("fireball") || lower.includes("sparkhit") || lower.includes("overheat");
      let intensity = 1.0;
      if (lower.includes("big") || lower.includes("peak")) intensity = 2.3;
      else if (lower.includes("small") || lower.includes("spark") || lower.includes("fizzle")) intensity = 0.8;

      this.emit({
        type: "particles",
        preset: "fireball",
        anchor: isImpact ? "enemyCore" : "playerHand",
        intensity,
        source: "transition",
        label: eventName
      });

      if (lower.includes("backlash") || lower.includes("overheat")) {
        this.emit({ type: "screenFlash", color: "#e67e22", duration: 0.15, label: eventName });
        this.emit({ type: "screenShake", amount: 0.12, label: eventName });
      }
      return;
    }

    if (lower.includes("absorb")) {
      const isRelease = lower.includes("release");
      const isBacklash = lower.includes("backlash");
      let intensity = 1.0;
      if (lower.includes("peak")) intensity = 2.0;
      else if (lower.includes("leak") || lower.includes("flicker")) intensity = 0.75;

      this.emit({
        type: "particles",
        preset: "magic",
        anchor: isRelease ? "enemyCore" : "playerHand",
        intensity,
        source: "transition",
        label: eventName
      });

      if (isRelease) {
        this.emit({ type: "particles", preset: "guard", anchor: "playerCore", intensity: 0.8, label: eventName });
      }
      if (isBacklash) {
        this.emit({ type: "screenFlash", color: "#9b59b6", duration: 0.16, label: eventName });
        this.emit({ type: "screenShake", amount: 0.1, label: eventName });
      }
      return;
    }

    if (lower.includes("greatsword")) {
      const isImpact = lower.includes("hit")
        || lower.includes("cleave")
        || lower.includes("break")
        || lower.includes("earth")
        || lower.includes("overchargehit");
      let intensity = 1.1;
      if (lower.includes("perfect") || lower.includes("earth") || lower.includes("peak")) intensity = 2.0;
      else if (lower.includes("light") || lower.includes("recover")) intensity = 0.75;

      this.emit({
        type: "particles",
        preset: lower.includes("break") ? "status" : "slash",
        anchor: isImpact ? "enemyCore" : "playerHand",
        intensity,
        source: "transition",
        label: eventName
      });

      if (isImpact) {
        this.emit({ type: "screenShake", amount: lower.includes("earth") ? 0.22 : 0.14, label: eventName });
      }
      if (lower.includes("perfect") || lower.includes("earth")) {
        this.emit({ type: "impact", count: 1, label: eventName });
      }
      return;
    }

    if (lower.includes("dual")) {
      const isImpact = lower.includes("slash")
        || lower.includes("finisher")
        || lower.includes("pierce")
        || lower.includes("whirl")
        || lower.includes("recoverhit");
      let intensity = 0.9;
      if (lower.includes("perfect") || lower.includes("shadow")) intensity = 1.6;
      else if (lower.includes("recover")) intensity = 0.65;

      this.emit({
        type: "particles",
        preset: "slash",
        anchor: isImpact ? "enemyCore" : "playerHand",
        intensity,
        source: "transition",
        label: eventName
      });

      if (lower.includes("perfect") || lower.includes("shadow")) {
        this.emit({ type: "cameraZoom", zoom: 1.08, duration: 0.18, label: eventName });
      }
    }
  }

  emitTransitionReaction(transition, eventName) {
    if (!transition) return;
    const lower = String(eventName || "").toLowerCase();

    if (transition.damage > 0) {
      const reaction = lower.includes("perfect") || lower.includes("burst") || lower.includes("peak") ? "crit" : "hit";
      this.emit({
        type: "actorReaction",
        target: "player",
        reaction: "attack",
        intensity: Math.min(1.8, 0.75 + transition.damage / 80),
        color: reaction === "crit" ? "#f1c40f" : "#ffffff",
        duration: reaction === "crit" ? 0.34 : 0.26,
        label: eventName
      });
      this.emit({
        type: "actorReaction",
        target: "enemy",
        reaction,
        intensity: Math.min(2.2, 0.65 + transition.damage / 50),
        color: reaction === "crit" ? "#f1c40f" : "#ffffff",
        label: eventName
      });
    }

    if (transition.stunEnemy > 0 && !transition.damage) {
      this.emit({
        type: "actorReaction",
        target: "enemy",
        reaction: "stagger",
        intensity: Math.min(1.8, 0.8 + transition.stunEnemy),
        label: eventName
      });
    }

    if (transition.iframe > 0 || transition.damageMul === 0) {
      const isGuard = lower.includes("guard") || lower.includes("shield") || lower.includes("mirror") || lower.includes("parry");
      this.emit({
        type: "actorReaction",
        target: "player",
        reaction: isGuard ? "guard" : "dodge",
        intensity: 1,
        label: eventName
      });
    }

    if (transition.selfStun > 0) {
      this.emit({
        type: "actorReaction",
        target: "player",
        reaction: "stagger",
        intensity: Math.min(1.5, 0.7 + transition.selfStun),
        color: "#e67e22",
        label: eventName
      });
    }

    if (transition.resource && (transition.resource.spellEnergy > 0 || transition.resource.heat > 0)) {
      this.emit({
        type: "actorReaction",
        target: "player",
        reaction: "cast",
        intensity: 0.75,
        label: eventName
      });
    }
  }

  emitRegisteredTransition(eventName) {
    if (typeof EffectEventDefinitions === "undefined") return false;
    const definition = EffectEventDefinitions[eventName];
    if (!definition) return false;

    const particles = Array.isArray(definition.particles)
      ? definition.particles
      : (definition.particles ? [definition.particles] : []);
    for (const particle of particles) {
      this.emit({
        type: "particles",
        source: "transition",
        label: eventName,
        ...particle
      });
    }

    const bursts = Array.isArray(definition.bursts)
      ? definition.bursts
      : (definition.burst ? [definition.burst] : []);
    for (const burst of bursts) {
      this.emit({
        type: "burst",
        source: "transition",
        label: eventName,
        ...burst
      });
    }

    const actorReactions = Array.isArray(definition.actorReactions)
      ? definition.actorReactions
      : (definition.actorReaction ? [definition.actorReaction] : []);
    for (const reaction of actorReactions) {
      this.emit({
        type: "actorReaction",
        source: "transition",
        label: eventName,
        ...reaction
      });
    }

    if (definition.screenFlash) {
      this.emit({ type: "screenFlash", label: eventName, ...definition.screenFlash });
    }
    if (definition.screenShake) {
      this.emit({ type: "screenShake", amount: definition.screenShake, label: eventName });
    }
    if (definition.cameraZoom) {
      this.emit({ type: "cameraZoom", label: eventName, ...definition.cameraZoom });
    }
    if (definition.impact) {
      this.emit({ type: "impact", count: definition.impact, label: eventName });
    }

    return true;
  }

  emitCharge(family, ratio) {
    const clamped = Utils.clamp(ratio || 0, 0, 1);
    if (family === "fire") {
      this.emit({
        type: "particles",
        preset: "fireball",
        anchor: "playerHand",
        intensity: 0.25 + clamped * 0.75,
        label: "fireCharge"
      });
      return;
    }

    if (family === "absorb") {
      this.emit({
        type: "particles",
        preset: "magic",
        anchor: "playerHand",
        intensity: 0.25 + clamped * 0.55,
        label: "absorbSiphon"
      });
      return;
    }

    if (family === "greatsword") {
      this.emit({
        type: "particles",
        preset: "slash",
        anchor: "playerHand",
        intensity: 0.25 + clamped * 0.5,
        label: "greatswordCharge"
      });
    }
  }

  emitStatus(status, phase = "apply") {
    if (!status) return;
    const target = status.target || "enemy";
    const id = status.id || status.type;
    const anchor = target === "player" ? "playerCore" : "enemyCore";

    if (id === "burn") {
      this.emit({ type: "particles", preset: "fireball", anchor, intensity: phase === "tick" ? 0.7 : 1.0, label: `${id}:${phase}` });
      this.emit({ type: "burst", kind: "pulse", anchor, color: "#e67e22", coreColor: "#f1c40f", radius: phase === "tick" ? 34 : 48, duration: 0.34, label: `${id}:${phase}` });
      return;
    }

    if (id === "absorbReady" || id === "shieldEnchant" || id === "overload") {
      this.emit({ type: "particles", preset: "magic", anchor, intensity: id === "overload" ? 1.2 : 0.9, label: `${id}:${phase}` });
      this.emit({ type: "burst", kind: "glyph", anchor, color: id === "overload" ? "#e74c3c" : "#9b59b6", radius: id === "overload" ? 48 : 36, duration: 0.42, label: `${id}:${phase}` });
      if (id === "overload") {
        this.emit({ type: "screenFlash", color: "#9b59b6", duration: 0.12, label: "overload" });
      }
      return;
    }

    this.emit({ type: "particles", preset: "status", anchor, intensity: 0.8, label: `${id}:${phase}` });
    this.emit({ type: "burst", kind: "ring", anchor, color: "#f1c40f", radius: 42, width: 4, duration: 0.36, label: `${id}:${phase}` });
  }

  resolveAnchor(anchor) {
    const isDemo = this.mode === "demo" || (this.owner && String(this.owner.turnState || "").startsWith("demo_"));
    const playerY = isDemo ? 280 : 360;
    const enemyY = isDemo ? 260 : 380;

    const anchors = {
      playerCore: { x: 220, y: playerY },
      playerHand: { x: 270, y: isDemo ? 280 : 320 },
      playerShield: { x: 220, y: playerY + 20 },
      enemyCore: { x: 740, y: enemyY },
      enemyChest: { x: 740, y: enemyY - 30 },
      midpoint: { x: 480, y: (playerY + enemyY) / 2 },
      qteBar: { x: 480, y: 456 },
      hudEnergy: { x: 220, y: 120 },
      player: { x: 220, y: playerY },
      enemy: { x: 740, y: enemyY }
    };

    return anchors[anchor] || anchors.midpoint;
  }

  getDebugLines(limit = 5) {
    if (this.recent.length === 0) return ["效果队列：暂无事件"];
    return this.recent.slice(0, limit).map((event) => {
      const label = event.label ? ` ${event.label}` : "";
      const preset = event.preset ? `/${event.preset}` : "";
      return `效果：${event.type}${preset}${label} x${Number(event.intensity || 1).toFixed(2)}`;
    });
  }
}
