class HitConfirmSystem {
  constructor(owner) {
    this.owner = owner;
    this.active = [];
    this.recent = [];
    this.confirmedTokens = new Set();
    this.maxRecent = 12;
  }

  update(dt) {
    for (const hit of this.active) {
      hit.age += dt;
      hit.life -= dt;
      hit.phase = this.resolvePhase(hit);
    }
    this.active = this.active.filter(hit => hit.life > 0);
  }

  clear() {
    this.active = [];
    this.recent = [];
    this.confirmedTokens.clear();
  }

  confirm(intent = {}) {
    const target = intent.target || (intent.source === "enemy" ? "player" : "enemy");
    const token = intent.token || `${intent.source || "hit"}:${target}:${this.recent.length}`;
    const tokenKey = `${token}:${target}`;
    const damage = Math.max(0, Math.floor(intent.damage || 0));
    const profile = this.resolveStrikeProfile(intent, target);
    const hitbox = this.buildHitbox({ ...intent, profile }, target);
    const hurtbox = this.getHurtbox(target);
    const overlap = this.overlaps(hitbox, hurtbox);
    const duplicate = this.confirmedTokens.has(tokenKey);
    const confirmed = overlap && !duplicate;
    const debugLife = intent.debugLife || Math.max(0.46, profile.window.total + 0.18);

    const record = {
      id: token,
      token,
      source: intent.source || "system",
      target,
      shape: hitbox.shape,
      damage,
      confirmed,
      duplicate,
      overlap,
      hitbox,
      hurtbox,
      profile,
      window: profile.window,
      phase: "active",
      age: profile.window.startup,
      label: intent.label || intent.visualEvent || intent.reason || "hit",
      life: debugLife,
      maxLife: debugLife
    };
    this.remember(record);

    if (!confirmed) {
      if (!duplicate) this.emitWhiff(record);
      return { confirmed: false, duplicate, overlap, damage, died: false, record };
    }

    this.confirmedTokens.add(tokenKey);
    const impact = this.buildImpact(record, intent);
    const died = damage > 0
      ? this.owner.applyDamage(target, damage, { ...(intent.options || {}), hitConfirmed: true, hitToken: token, impact })
      : false;
    return { confirmed: true, duplicate: false, overlap: true, damage, died, record };
  }

  remember(record) {
    this.active.push(record);
    this.recent.unshift(record);
    if (this.recent.length > this.maxRecent) this.recent.pop();
  }

  resolvePhase(hit) {
    const win = hit.window || { startup: 0, active: 0.12, total: 0.3 };
    if (hit.age < win.startup) return "startup";
    if (hit.age <= win.startup + win.active) return "active";
    return "recovery";
  }

  resolveStrikeProfile(intent, target) {
    const source = intent.source || "system";
    const isEnemy = source === "enemy";
    const text = [
      intent.label,
      intent.reason,
      intent.visualEvent,
      intent.motion,
      intent.attackId,
      intent.chainId,
      intent.chainFamily,
      ...(intent.visualEvents || []),
      ...(intent.outcomes || [])
    ].filter(Boolean).join(" ").toLowerCase();
    const weapon = intent.weapon || (this.owner && this.owner.playerConfig && this.owner.playerConfig.weapon) || "";
    const shape = intent.shape || (this.includesAny(text, ["beam", "fireball", "overflow", "absorb", "spell", "arcane", "curse"]) ? "beam" : "arc");
    const damage = Math.max(0, Math.floor(intent.damage || 0));

    const profile = {
      shape: shape === "rect" || shape === "circle" ? shape : "trail",
      kind: shape,
      width: shape === "beam" ? 44 : 46,
      startup: isEnemy ? 0.22 : 0.12,
      active: isEnemy ? 0.18 : 0.15,
      recovery: isEnemy ? 0.24 : 0.22,
      sourceOffset: isEnemy ? 18 : 24,
      followThrough: 28,
      startYOffset: 0,
      targetYOffset: target === "enemy" ? -8 : 0,
      bendY: shape === "beam" ? 0 : -34,
      bendX: 0,
      impactForce: 1,
      color: intent.color || "#ffffff"
    };

    if (shape === "beam") {
      profile.width = 42;
      profile.startup = 0.10;
      profile.active = 0.18;
      profile.recovery = 0.18;
      profile.bendY = 0;
      profile.sourceOffset = 12;
      profile.followThrough = 20;
      profile.impactForce = 0.95;
    }

    if (weapon === "greatsword" || this.includesAny(text, ["greatsword", "cleave", "earthsplit", "overcharge", "heavy", "smash"])) {
      profile.width = 68;
      profile.startup = 0.20;
      profile.active = 0.14;
      profile.recovery = 0.34;
      profile.sourceOffset = 18;
      profile.followThrough = 40;
      profile.bendY = this.includesAny(text, ["earth", "smash", "overcharge"]) ? 28 : -58;
      profile.impactForce = 1.28;
    }

    if (weapon === "dualBlades" || this.includesAny(text, ["dual", "whirl", "dash", "flurry", "shadow"])) {
      profile.width = this.includesAny(text, ["finisher", "whirl"]) ? 50 : 38;
      profile.startup = 0.07;
      profile.active = 0.13;
      profile.recovery = 0.16;
      profile.sourceOffset = 36;
      profile.followThrough = 34;
      profile.bendY = this.includesAny(text, ["retreat", "recover"]) ? 22 : -28;
      profile.impactForce = 0.88;
    }

    if (this.includesAny(text, ["fireball", "overflow", "absorb", "release", "spell", "arcane", "curse"])) {
      profile.width = this.includesAny(text, ["big", "peak", "overflow"]) ? 62 : 48;
      profile.startup = 0.12;
      profile.active = 0.20;
      profile.recovery = 0.22;
      profile.bendY = 0;
      profile.impactForce = this.includesAny(text, ["big", "peak", "overflow"]) ? 1.2 : 1.0;
    }

    if (this.includesAny(text, ["shield", "counter", "reflect", "thorn", "guard"])) {
      profile.width = 54;
      profile.startup = 0.08;
      profile.active = 0.16;
      profile.recovery = 0.20;
      profile.bendY = 0;
      profile.impactForce = 0.92;
    }

    if (isEnemy) {
      profile.width = this.includesAny(text, ["heavy", "smash"]) || damage >= 25 ? 64 : 50;
      profile.startup = this.includesAny(text, ["spell", "arcane", "curse"]) ? 0.16 : 0.24;
      profile.active = 0.16;
      profile.recovery = 0.22;
      profile.sourceOffset = 22;
      profile.followThrough = 32;
      profile.bendY = this.includesAny(text, ["spell", "arcane", "curse"]) ? 0 : -18;
      profile.impactForce = damage >= 25 ? 1.25 : 1.0;
    }

    if (this.includesAny(text, ["late", "fail", "recover"])) {
      profile.width = Math.max(28, profile.width * 0.84);
      profile.active = Math.max(0.09, profile.active * 0.84);
      profile.impactForce *= 0.82;
    }
    if (this.includesAny(text, ["perfect", "crit", "peak"])) {
      profile.width += 8;
      profile.active += 0.03;
      profile.impactForce += 0.18;
    }
    if (damage >= 40) {
      profile.width += 8;
      profile.impactForce += 0.18;
    }

    profile.window = {
      startup: intent.startTime ?? intent.startup ?? profile.startup,
      active: intent.activeTime ?? profile.active,
      recovery: intent.recoveryTime ?? profile.recovery
    };
    profile.window.total = profile.window.startup + profile.window.active + profile.window.recovery;
    profile.window.impact = profile.window.startup + profile.window.active * 0.55;
    profile.width = Math.round(profile.width);
    return profile;
  }

  includesAny(text, needles) {
    return needles.some(needle => text.includes(needle));
  }

  emitWhiff(record) {
    if (!this.owner || !this.owner.spawnFloatingText) return;
    const pos = this.resolveAnchor(record.target === "player" ? "playerCore" : "enemyCore");
    this.owner.spawnFloatingText("MISS", pos.x, pos.y - 58, "status");
    if (this.owner.effectQueue) {
      this.owner.effectQueue.emit({
        type: "burst",
        kind: "ring",
        anchor: record.target === "player" ? "playerCore" : "enemyCore",
        color: "#95a5a6",
        radius: 42,
        width: 3,
        duration: 0.24,
        label: `whiff:${record.label}`
      });
    }
  }

  buildHitbox(intent, target) {
    if (intent.rect) return { shape: "rect", ...this.normalizeRect(intent.rect) };
    if (intent.circle) return { shape: "circle", ...intent.circle };

    const profile = intent.profile || this.resolveStrikeProfile(intent, target);
    const shape = intent.shape || profile.kind || "beam";
    if (shape === "rect" || profile.shape === "rect") {
      const targetAnchor = this.resolveAnchor(target === "player" ? "playerCore" : "enemyCore");
      const width = profile.width || 54;
      return {
        shape: "rect",
        x: targetAnchor.x - width / 2,
        y: targetAnchor.y - width / 2,
        w: width,
        h: width
      };
    }
    if (shape === "circle" || profile.shape === "circle") {
      const targetAnchor = this.resolveAnchor(target === "player" ? "playerCore" : "enemyCore");
      return {
        shape: "circle",
        x: targetAnchor.x,
        y: targetAnchor.y,
        r: profile.width || 42
      };
    }
    return this.buildTrailHitbox(intent, target, profile);
  }

  buildTrailHitbox(intent, target, profile) {
    const sourceAnchor = intent.anchor || (intent.source === "enemy" ? "enemyCore" : "playerHand");
    const targetAnchor = intent.toAnchor || (target === "player" ? "playerCore" : "enemyCore");
    const source = this.resolveAnchor(sourceAnchor);
    const endAnchor = this.resolveAnchor(targetAnchor);
    const dir = this.unitVector(source, endAnchor);
    const start = {
      x: source.x + dir.x * profile.sourceOffset,
      y: source.y + dir.y * profile.sourceOffset + profile.startYOffset
    };
    const end = {
      x: endAnchor.x + dir.x * profile.followThrough,
      y: endAnchor.y + dir.y * profile.followThrough + profile.targetYOffset
    };
    const mid = {
      x: (start.x + end.x) / 2 + (profile.bendX || 0),
      y: (start.y + end.y) / 2 + (profile.bendY || 0)
    };
    const points = Math.abs(profile.bendY || 0) > 1 || Math.abs(profile.bendX || 0) > 1
      ? [start, mid, end]
      : [start, end];

    return {
      shape: "trail",
      kind: profile.kind,
      x: Math.min(...points.map(p => p.x)) - profile.width / 2,
      y: Math.min(...points.map(p => p.y)) - profile.width / 2,
      w: Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)) + profile.width,
      h: Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)) + profile.width,
      start,
      end,
      points,
      width: profile.width,
      padding: profile.width / 2,
      window: profile.window
    };
  }

  getHurtbox(target) {
    const anchor = this.resolveAnchor(target === "player" ? "playerCore" : "enemyCore");
    const size = target === "player"
      ? { w: 70, h: 110 }
      : { w: 90, h: 130 };
    return {
      shape: "rect",
      x: anchor.x - size.w / 2,
      y: anchor.y - size.h / 2,
      w: size.w,
      h: size.h,
      anchor
    };
  }

  buildImpact(record) {
    const points = record.hitbox && record.hitbox.points;
    const start = points && points.length > 0 ? points[0] : (record.hitbox.start || record.hurtbox.anchor);
    const end = points && points.length > 1 ? points[points.length - 1] : (record.hitbox.end || record.hurtbox.anchor);
    const dir = this.unitVector(start, end);
    const force = this.clamp((record.profile.impactForce || 1) + record.damage / 90, 0.75, 1.85);
    return {
      direction: Math.abs(dir.x) > 0.05 ? Math.sign(dir.x) : (record.target === "enemy" ? 1 : -1),
      force,
      distance: this.clamp(18 + record.damage * 0.34 + (record.profile.width || 40) * 0.16, 20, 58),
      lift: record.profile.kind === "beam" ? 3 : this.clamp(4 + record.damage * 0.08, 4, 12),
      window: record.window,
      shape: record.shape
    };
  }

  resolveAnchor(anchor) {
    if (this.owner && this.owner.effectQueue && this.owner.effectQueue.resolveAnchor) {
      return this.owner.effectQueue.resolveAnchor(anchor);
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

  overlaps(hitbox, hurtbox) {
    if (!hitbox || !hurtbox) return false;
    if (hitbox.shape === "circle") return this.circleRect(hitbox, hurtbox);
    if (hitbox.shape === "trail" || hitbox.shape === "capsule" || hitbox.shape === "beam") return this.trailRect(hitbox, hurtbox);
    return this.rectsOverlap(this.normalizeRect(hitbox), this.normalizeRect(hurtbox));
  }

  normalizeRect(rect) {
    return {
      x: rect.x,
      y: rect.y,
      w: rect.w || rect.width || 0,
      h: rect.h || rect.height || 0
    };
  }

  rectsOverlap(a, b) {
    return a.x < b.x + b.w
      && a.x + a.w > b.x
      && a.y < b.y + b.h
      && a.y + a.h > b.y;
  }

  circleRect(circle, rect) {
    const r = circle.r || circle.radius || 0;
    const cx = this.clamp(circle.x, rect.x, rect.x + rect.w);
    const cy = this.clamp(circle.y, rect.y, rect.y + rect.h);
    const dx = circle.x - cx;
    const dy = circle.y - cy;
    return dx * dx + dy * dy <= r * r;
  }

  trailRect(trail, rect) {
    const points = trail.points || [trail.start, trail.end].filter(Boolean);
    if (points.length < 2) return false;
    const radius = (trail.width || trail.padding || 0) / 2;
    const expanded = {
      x: rect.x - radius,
      y: rect.y - radius,
      w: rect.w + radius * 2,
      h: rect.h + radius * 2
    };
    for (let i = 0; i < points.length - 1; i++) {
      if (this.segmentIntersectsRect(points[i], points[i + 1], expanded)) return true;
    }
    return false;
  }

  segmentIntersectsRect(a, b, rect) {
    if (this.pointInRect(a, rect) || this.pointInRect(b, rect)) return true;
    const topLeft = { x: rect.x, y: rect.y };
    const topRight = { x: rect.x + rect.w, y: rect.y };
    const bottomRight = { x: rect.x + rect.w, y: rect.y + rect.h };
    const bottomLeft = { x: rect.x, y: rect.y + rect.h };
    return this.segmentsIntersect(a, b, topLeft, topRight)
      || this.segmentsIntersect(a, b, topRight, bottomRight)
      || this.segmentsIntersect(a, b, bottomRight, bottomLeft)
      || this.segmentsIntersect(a, b, bottomLeft, topLeft);
  }

  pointInRect(point, rect) {
    return point.x >= rect.x
      && point.x <= rect.x + rect.w
      && point.y >= rect.y
      && point.y <= rect.y + rect.h;
  }

  segmentsIntersect(a, b, c, d) {
    const o1 = this.orientation(a, b, c);
    const o2 = this.orientation(a, b, d);
    const o3 = this.orientation(c, d, a);
    const o4 = this.orientation(c, d, b);
    if (o1 !== o2 && o3 !== o4) return true;
    return (o1 === 0 && this.onSegment(a, c, b))
      || (o2 === 0 && this.onSegment(a, d, b))
      || (o3 === 0 && this.onSegment(c, a, d))
      || (o4 === 0 && this.onSegment(c, b, d));
  }

  orientation(a, b, c) {
    const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
    if (Math.abs(value) < 0.0001) return 0;
    return value > 0 ? 1 : 2;
  }

  onSegment(a, b, c) {
    return b.x <= Math.max(a.x, c.x) + 0.0001
      && b.x >= Math.min(a.x, c.x) - 0.0001
      && b.y <= Math.max(a.y, c.y) + 0.0001
      && b.y >= Math.min(a.y, c.y) - 0.0001;
  }

  unitVector(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: dx / length, y: dy / length };
  }

  clamp(value, min, max) {
    if (typeof Utils !== "undefined" && Utils.clamp) return Utils.clamp(value, min, max);
    return Math.max(min, Math.min(max, value));
  }

  getDebugLines(limit = 4) {
    if (this.recent.length === 0) return ["命中确认：暂无"];
    return this.recent.slice(0, limit).map(hit => {
      const status = hit.confirmed ? "命中" : (hit.duplicate ? "重复" : "未命中");
      const win = hit.window
        ? ` 窗口${Math.round(hit.window.startup * 1000)}/${Math.round(hit.window.active * 1000)}ms`
        : "";
      return `命中确认：${status} ${hit.source}->${hit.target} ${hit.shape} ${hit.damage}${win}`;
    });
  }
}
