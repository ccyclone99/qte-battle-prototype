class ActiveAttackSystem {
  constructor(owner) {
    this.owner = owner;
    this.active = [];
    this.recent = [];
    this.nextId = 1;
    this.maxRecent = 10;
  }

  commit(intent = {}) {
    const profile = ActiveAttackSystem.resolveProfile(intent, this.owner);
    const id = intent.id || `aa:${this.nextId++}`;
    const attack = {
      id,
      intent: { ...intent, profile },
      source: intent.source || "player",
      target: intent.target || (intent.source === "enemy" ? "player" : "enemy"),
      profile,
      elapsed: 0,
      phase: "startup",
      reactionOpened: false,
      resolved: false,
      completed: false,
      canceled: false,
      paused: false,
      defenderResponse: null,
      result: null,
      position: null,
      progress: 0,
      lifeAfterResolve: profile.recovery
    };

    this.updateAttackState(attack);
    this.active.push(attack);
    this.recent.unshift(attack);
    if (this.recent.length > this.maxRecent) this.recent.pop();
    this.emitStartVisual(attack);
    return attack;
  }

  update(dt) {
    for (const attack of this.active) {
      if (attack.paused || attack.completed) continue;
      attack.elapsed += dt;
      this.updateAttackState(attack);

      if (!attack.reactionOpened && attack.elapsed >= attack.profile.reactionStart) {
        attack.reactionOpened = true;
        this.emitReactionVisual(attack);
        if (this.owner && this.owner.onActiveAttackReactionWindow) {
          this.owner.onActiveAttackReactionWindow(attack);
        }
      }

      if (!attack.resolved && !attack.canceled && attack.elapsed >= attack.profile.impactTime) {
        attack.resolved = true;
        attack.phase = "impact";
        this.emitImpactVisual(attack);
        if (this.owner && this.owner.resolveActiveAttack) {
          attack.result = this.owner.resolveActiveAttack(attack) || null;
        }
      }

      if ((attack.resolved || attack.canceled) && attack.elapsed >= attack.profile.total) {
        attack.completed = true;
        if (this.owner && this.owner.onActiveAttackComplete) {
          this.owner.onActiveAttackComplete(attack);
        }
      }
    }

    this.active = this.active.filter(attack => !attack.completed);
  }

  updateAttackState(attack) {
    const p = attack.profile;
    if (attack.canceled) attack.phase = "canceled";
    else if (attack.elapsed < p.reactionStart) attack.phase = "startup";
    else if (attack.elapsed < p.impactTime) attack.phase = "reaction";
    else if (!attack.resolved) attack.phase = "impact";
    else attack.phase = "recovery";

    const travelStart = Math.max(0, p.travelStart);
    const travelSpan = Math.max(0.001, p.impactTime - travelStart);
    attack.progress = this.clamp((attack.elapsed - travelStart) / travelSpan, 0, 1);
    attack.position = this.resolvePosition(attack);
  }

  cancel(attack, response = "canceled") {
    if (!attack || attack.completed) return null;
    attack.canceled = true;
    attack.resolved = true;
    attack.defenderResponse = response;
    attack.phase = "canceled";
    attack.profile.total = Math.max(attack.profile.total, attack.elapsed + Math.max(0.18, attack.profile.recovery * 0.75));
    this.emitCancelVisual(attack, response);
    return attack;
  }

  pause(attack, response = "defending") {
    if (!attack || attack.completed) return null;
    attack.paused = true;
    attack.defenderResponse = response;
    return attack;
  }

  resume(attack) {
    if (!attack || attack.completed) return null;
    attack.paused = false;
    return attack;
  }

  clear() {
    this.active = [];
  }

  hasActive() {
    return this.active.some(attack => !attack.completed);
  }

  getPrimary(filter = {}) {
    return this.active.find(attack => {
      if (filter.source && attack.source !== filter.source) return false;
      if (filter.target && attack.target !== filter.target) return false;
      if (filter.kind && attack.intent.kind !== filter.kind) return false;
      return !attack.completed;
    }) || null;
  }

  resolvePosition(attack) {
    const from = this.resolveAnchor(attack.intent.fromAnchor || attack.intent.anchor || (attack.source === "enemy" ? "enemyCore" : "playerHand"));
    const to = this.resolveAnchor(attack.intent.toAnchor || (attack.target === "player" ? "playerCore" : "enemyCore"));
    const t = attack.progress || 0;
    const bend = attack.profile.bend || { x: 0, y: 0 };
    const arc = Math.sin(Math.PI * t);
    return {
      x: from.x + (to.x - from.x) * t + bend.x * arc,
      y: from.y + (to.y - from.y) * t + bend.y * arc
    };
  }

  getActorMeleeOffset(actor) {
    const total = { x: 0, y: 0, intensity: 0, source: null };
    for (const attack of this.active) {
      if (!attack || attack.completed) continue;
      const offset = this.getMeleeOffsetForAttack(attack, actor);
      if (!offset || offset.intensity <= 0) continue;
      if (!total.source || Math.abs(offset.x) > Math.abs(total.x)) {
        total.x = offset.x;
        total.y = offset.y;
        total.source = attack;
      }
      total.intensity = Math.max(total.intensity, offset.intensity);
    }
    total.x = this.clamp(total.x, -340, 340);
    total.y = this.clamp(total.y, -36, 36);
    return total;
  }

  getMeleeOffsetForAttack(attack, actor) {
    const timeline = attack && attack.profile ? attack.profile.meleeTimeline : null;
    if (!timeline || !timeline.rootMotion) return null;
    if (attack.profile.type !== "melee") return null;

    const localTime = attack.elapsed - (timeline.offset || 0);
    if (localTime < 0 || localTime > timeline.total + 0.18) return null;

    const actorIsSource = attack.source === actor;
    const actorIsTarget = attack.target === actor;
    if (!actorIsSource && !actorIsTarget) return null;

    const points = actorIsSource ? timeline.rootMotion.source : timeline.rootMotion.target;
    if (!Array.isArray(points) || points.length === 0) return null;

    const sourceAnchor = this.resolveAnchorStatic(attack.intent.fromAnchor || attack.intent.anchor || (attack.source === "enemy" ? "enemyCore" : "playerHand"));
    const targetAnchor = this.resolveAnchorStatic(attack.intent.toAnchor || (attack.target === "player" ? "playerCore" : "enemyCore"));
    const dir = Math.sign(targetAnchor.x - sourceAnchor.x) || (attack.source === "enemy" ? -1 : 1);
    const sampled = this.sampleMotion(points, localTime);
    const phaseMul = attack.canceled ? 0.72 : 1;
    return {
      x: dir * (sampled.x || 0) * phaseMul,
      y: sampled.y || 0,
      intensity: this.clamp(Math.abs(sampled.x || 0) / 150, 0, 1),
      localTime,
      contactFrame: timeline.contactFrame || 0
    };
  }

  sampleMotion(points, localTime) {
    if (!Array.isArray(points) || points.length === 0) return { x: 0, y: 0 };
    if (localTime <= points[0].at) return { x: points[0].x || 0, y: points[0].y || 0 };
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (localTime > b.at) continue;
      const span = Math.max(0.001, b.at - a.at);
      const ratio = this.easeInOut(this.clamp((localTime - a.at) / span, 0, 1));
      return {
        x: (a.x || 0) + ((b.x || 0) - (a.x || 0)) * ratio,
        y: (a.y || 0) + ((b.y || 0) - (a.y || 0)) * ratio
      };
    }
    const last = points[points.length - 1];
    return { x: last.x || 0, y: last.y || 0 };
  }

  easeInOut(value) {
    const t = this.clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  resolveAnchor(anchor) {
    if (this.owner && this.owner.effectQueue && this.owner.effectQueue.resolveAnchor) {
      return this.owner.effectQueue.resolveAnchor(anchor);
    }
    return this.resolveAnchorStatic(anchor);
  }

  resolveAnchorStatic(anchor) {
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

  emitStartVisual(attack) {
    const queue = this.owner && this.owner.effectQueue;
    if (!queue) return;
    const p = attack.profile;
    if (p.type === "projectile" || p.type === "beam" || p.type === "pulse") {
      queue.emit({
        type: "particles",
        preset: p.element === "fire" ? "fireball" : "magic",
        anchor: attack.intent.fromAnchor || attack.intent.anchor || (attack.source === "enemy" ? "enemyCore" : "playerHand"),
        intensity: p.type === "pulse" ? 1.25 : 0.9,
        label: `active:${attack.id}:start`
      });
    }
  }

  emitReactionVisual(attack) {
    const queue = this.owner && this.owner.effectQueue;
    if (!queue) return;
    if (attack.profile && attack.profile.type === "melee") return;
    queue.emit({
      type: "burst",
      kind: "ring",
      anchor: attack.target === "player" ? "playerCore" : "enemyCore",
      color: attack.target === "player" ? "#2ecc71" : "#f1c40f",
      radius: Math.max(42, (attack.profile.radius || 34) + 18),
      width: 2,
      duration: Math.max(0.18, Math.min(0.34, attack.profile.reactionDuration || 0.24)),
      label: `active:${attack.id}:reaction`
    });
  }

  emitImpactVisual(attack) {
    const queue = this.owner && this.owner.effectQueue;
    if (!queue) return;
    const p = attack.profile;
    const targetAnchor = attack.target === "player" ? "playerCore" : "enemyCore";
    const color = p.color || "#ffffff";

    if (p.type === "projectile" || p.type === "pulse") {
      queue.emit({
        type: "burst",
        kind: "ring",
        anchor: targetAnchor,
        color,
        coreColor: "#ffffff",
        radius: p.type === "pulse" ? Math.max(72, p.radius || 72) : Math.max(52, (p.radius || 32) + 20),
        width: p.type === "pulse" ? 6 : 4,
        duration: p.type === "pulse" ? 0.34 : 0.28,
        label: `active:${attack.id}:impact`
      });
      queue.emit({
        type: "particles",
        preset: p.element === "fire" ? "fireball" : "magic",
        anchor: targetAnchor,
        intensity: p.type === "pulse" ? 1.45 : 1.1,
        label: `active:${attack.id}:impactParticles`
      });
      return;
    }

    if (p.type === "beam") {
      queue.emit({
        type: "burst",
        kind: "beam",
        anchor: attack.intent.fromAnchor || attack.intent.anchor || (attack.source === "enemy" ? "enemyCore" : "playerHand"),
        toAnchor: targetAnchor,
        color,
        width: 8,
        duration: 0.20,
        label: `active:${attack.id}:beamImpact`
      });
      return;
    }

    // Melee contact is rendered by the actor pose and compact contact layer.
    // Do not emit burst geometry here; large arcs make melee read like ranged VFX.
  }

  emitCancelVisual(attack, response) {
    const queue = this.owner && this.owner.effectQueue;
    if (!queue) return;
    if (attack.profile && attack.profile.type === "melee") return;
    const color = response === "guard"
      ? "#2ecc71"
      : (response === "clash" ? "#f1c40f" : (response === "interrupt" ? "#9b59b6" : "#95a5a6"));
    queue.emit({
      type: "burst",
      kind: "ring",
      anchor: attack.target === "player" ? "playerCore" : "enemyCore",
      color,
      coreColor: response === "clash" ? "#ffffff" : color,
      radius: response === "guard" ? 54 : (response === "clash" ? 62 : 46),
      width: response === "clash" ? 4 : 3,
      duration: 0.24,
      label: `active:${attack.id}:${response}`
    });
  }

  getDebugLines(limit = 4) {
    const rows = this.active.length > 0 ? this.active : this.recent;
    if (!rows || rows.length === 0) return ["活动攻击：暂无"];
    return rows.slice(0, limit).map(attack => {
      const pct = Math.round((attack.progress || 0) * 100);
      const response = attack.defenderResponse ? ` ${attack.defenderResponse}` : "";
      return `活动攻击：${attack.phase}${response} ${attack.source}->${attack.target} ${attack.profile.type} ${pct}%`;
    });
  }

  includesAny(text, needles) {
    return needles.some(needle => text.includes(needle));
  }

  clamp(value, min, max) {
    if (typeof Utils !== "undefined" && Utils.clamp) return Utils.clamp(value, min, max);
    return Math.max(min, Math.min(max, value));
  }

  static resolveProfile(intent = {}, owner = null) {
    const text = [
      intent.attackProfile,
      intent.attackType,
      intent.label,
      intent.reason,
      intent.visualEvent,
      intent.motion,
      intent.attackId,
      intent.chainId,
      intent.chainFamily,
      intent.weapon,
      ...(intent.visualEvents || []),
      ...(intent.outcomes || [])
    ].filter(Boolean).join(" ").toLowerCase();
    const includes = needles => needles.some(needle => text.includes(needle));
    const source = intent.source || "player";
    const isEnemy = source === "enemy";
    const isSpell = intent.isSpell || includes(["fireball", "spell", "arcane", "curse", "absorb", "overflow", "bolt"]);
    const family = intent.chainFamily || "";
    const weapon = intent.weapon || (owner && owner.playerConfig && owner.playerConfig.weapon) || "";

    let type = intent.attackType || "melee";
    if (!intent.attackType) {
      if (includes(["fireball", "bolt"])) type = "projectile";
      else if (includes(["overflow", "burst", "flare", "pulse"])) type = "pulse";
      else if (includes(["beam", "absorb", "release", "arcane", "curse"]) || (family === "staff" && isSpell)) type = "beam";
      else if (isSpell && isEnemy) type = "projectile";
      else type = "melee";
    }
    if (!intent.attackType && includes(["fireblade", "flame_blade", "slash", "cleave", "cut"]) && !includes(["fireball"])) {
      type = includes(["burst"]) ? "pulse" : "melee";
    }

    const profile = {
      type,
      element: includes(["fire", "flame", "ember"]) || family === "fire" ? "fire" : (family === "absorb" ? "absorb" : "physical"),
      color: intent.color || (family === "fire" ? "#e67e22" : (family === "absorb" ? "#9b59b6" : (isEnemy ? "#e74c3c" : "#ffffff"))),
      shape: type === "melee" ? "arc" : (type === "pulse" ? "circle" : "beam"),
      startup: isEnemy ? 0.28 : 0.18,
      travel: type === "melee" ? 0.20 : 0.46,
      active: type === "melee" ? 0.12 : 0.18,
      recovery: isEnemy ? 0.30 : 0.32,
      reactionLead: type === "melee" ? 0.22 : 0.34,
      reactionDuration: type === "melee" ? 0.24 : 0.32,
      bend: type === "projectile" ? { x: 0, y: -18 } : { x: 0, y: 0 },
      radius: type === "pulse" ? 74 : 28,
      canDodge: true,
      canGuard: type !== "beam",
      canParry: type === "melee",
      canAbsorb: type !== "melee",
      canReflect: type !== "melee"
    };

    if (weapon === "greatsword" || includes(["greatsword", "earthsplit", "heavy", "smash", "armorbreak"])) {
      profile.startup = isEnemy ? 0.38 : 0.24;
      profile.travel = 0.24;
      profile.reactionLead = 0.24;
      profile.reactionDuration = 0.24;
      profile.recovery = 0.42;
      profile.radius = 42;
    }
    if (weapon === "dualBlades" || includes(["dual", "whirl", "dash", "flurry", "quick"])) {
      profile.startup = isEnemy ? 0.20 : 0.12;
      profile.travel = 0.16;
      profile.reactionLead = 0.18;
      profile.reactionDuration = 0.20;
      profile.recovery = 0.22;
      profile.radius = 30;
    }
    if (type === "projectile") {
      profile.startup = isEnemy ? 0.34 : 0.24;
      profile.travel = includes(["big", "peak", "overflow"]) ? 0.58 : 0.48;
      profile.reactionLead = 0.34;
      profile.reactionDuration = 0.32;
      profile.recovery = 0.30;
      profile.radius = includes(["big", "peak"]) ? 44 : 32;
    }
    if (type === "beam") {
      profile.startup = isEnemy ? 0.30 : 0.20;
      profile.travel = 0.28;
      profile.reactionLead = 0.26;
      profile.reactionDuration = 0.26;
      profile.recovery = 0.26;
      profile.radius = includes(["overflow", "peak"]) ? 50 : 36;
      profile.bend = { x: 0, y: 0 };
    }
    if (type === "pulse") {
      profile.startup = isEnemy ? 0.30 : 0.22;
      profile.travel = 0.26;
      profile.reactionLead = 0.26;
      profile.reactionDuration = 0.26;
      profile.recovery = 0.32;
      profile.radius = includes(["overflow", "burst", "perfect"]) ? 92 : 70;
      profile.bend = { x: 0, y: 0 };
    }

    if (intent.timeline) {
      const tl = intent.timeline;
      profile.startup = tl.startup ?? profile.startup;
      profile.travel = tl.travel ?? profile.travel;
      profile.reactionStart = tl.reactionStart;
      profile.reactionDuration = tl.reactionDuration ?? profile.reactionDuration;
      profile.activeStart = tl.activeStart;
      profile.activeDuration = tl.activeDuration ?? profile.activeDuration;
      profile.impactTime = tl.impactTime;
      profile.recovery = tl.recovery ?? profile.recovery;
    }

    const meleeTimeline = ActiveAttackSystem.resolveMeleeTimeline(intent, profile);
    if (meleeTimeline && type === "melee") {
      const offset = meleeTimeline.offset || 0;
      const authoredReactionStart = profile.reactionStart;
      profile.meleeTimeline = meleeTimeline;
      profile.travelStart = offset;
      profile.impactTime = offset + meleeTimeline.contactFrame;
      profile.reactionStart = authoredReactionStart ?? Math.max(0, offset + meleeTimeline.activeStart - profile.reactionLead);
      profile.activeStart = offset + meleeTimeline.activeStart;
      profile.activeDuration = Math.max(0.05, meleeTimeline.activeEnd - meleeTimeline.activeStart);
      profile.reactionDuration = Math.max(0.05, offset + meleeTimeline.activeEnd - profile.reactionStart);
      profile.recovery = Math.max(0.18, meleeTimeline.total - meleeTimeline.contactFrame);
      profile.radius = Math.max(profile.radius || 28, meleeTimeline.sweep && meleeTimeline.sweep.width ? meleeTimeline.sweep.width : 28);
    }

    profile.travelStart = profile.travelStart ?? profile.startup;
    profile.impactTime = profile.impactTime ?? (profile.startup + profile.travel);
    profile.reactionStart = profile.reactionStart ?? Math.max(0, profile.impactTime - profile.reactionLead);
    profile.activeDuration = profile.activeDuration ?? profile.active;
    profile.activeStart = profile.activeStart ?? profile.reactionStart;
    profile.activeEnd = profile.activeStart + profile.activeDuration;
    profile.reactionEnd = Math.min(profile.impactTime, profile.reactionStart + profile.reactionDuration);
    profile.total = Math.max(profile.impactTime + profile.recovery, profile.reactionEnd + profile.recovery, profile.activeEnd + profile.recovery);
    if (profile.meleeTimeline) {
      profile.total = Math.max(profile.total, (profile.meleeTimeline.offset || 0) + profile.meleeTimeline.total);
    }
    return profile;
  }

  static resolveMeleeTimeline(intent = {}, profile = {}) {
    const raw = intent.meleeTimeline || (intent.attack && intent.attack.meleeTimeline);
    if (!raw) return null;
    const total = Math.max(0.3, raw.total || raw.duration || (raw.contactFrame || 0.7) + 0.34);
    const contactFrame = this.numberOr(raw.contactFrame, Math.min(total - 0.18, 0.7));
    const activeStart = this.numberOr(raw.activeStart, Math.max(0, contactFrame - 0.11));
    const activeEnd = this.numberOr(raw.activeEnd, Math.min(total, contactFrame + 0.12));
    const startX = Number.isFinite(intent.meleeStart) ? intent.meleeStart : null;
    const rootMotion = this.cloneRootMotion(raw.rootMotion || {}, startX);
    return {
      total,
      contactFrame: this.clampStatic(contactFrame, 0.05, total),
      activeStart: this.clampStatic(activeStart, 0, total),
      activeEnd: this.clampStatic(Math.max(activeEnd, activeStart + 0.05), 0.05, total),
      offset: Math.max(0, intent.timelineOffset || raw.offset || 0),
      sweep: { ...(raw.sweep || {}) },
      rootMotion
    };
  }

  static cloneRootMotion(rootMotion, startX = null) {
    const clone = {};
    for (const key of ["source", "target"]) {
      const points = Array.isArray(rootMotion[key]) ? rootMotion[key] : [{ at: 0, x: 0 }, { at: 1, x: 0 }];
      clone[key] = points.map((point, index) => ({
        at: Number.isFinite(point.at) ? point.at : index,
        x: Number.isFinite(point.x) ? point.x : 0,
        y: Number.isFinite(point.y) ? point.y : 0
      }));
    }
    if (Number.isFinite(startX) && clone.source.length > 0) {
      const delta = startX - (clone.source[0].x || 0);
      clone.source = clone.source.map(point => ({ ...point, x: point.x + delta }));
    }
    return clone;
  }

  static numberOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  static clampStatic(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}
