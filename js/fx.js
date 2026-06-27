class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  clear() {
    this.particles = [];
  }

  update(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.gravity) p.vy += p.gravity * dt;
      if (p.drag) {
        p.vx *= 1 - p.drag * dt;
        p.vy *= 1 - p.drag * dt;
      }
      if (p.shrink) p.size = Math.max(0, p.size - p.shrink * dt);
    }
    this.particles = this.particles.filter(p => p.life > 0 && p.size > 0);
  }

  spawn(count, x, y, config) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.random() * Math.PI * 2);
      const speed = config.speedMin + Math.random() * (config.speedMax - config.speedMin);
      this.particles.push({
        x: x + (Math.random() - 0.5) * (config.spread || 0),
        y: y + (Math.random() - 0.5) * (config.spread || 0),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: config.lifeMin + Math.random() * (config.lifeMax - config.lifeMin),
        maxLife: config.lifeMin + Math.random() * (config.lifeMax - config.lifeMin),
        size: config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin),
        color: Array.isArray(config.colors) ? config.colors[Math.floor(Math.random() * config.colors.length)] : config.color,
        gravity: config.gravity || 0,
        drag: config.drag || 0,
        shrink: config.shrink || 0,
        shape: config.shape || "circle",
        blend: config.blend || "source-over"
      });
    }
  }

  emit(type, x, y, intensity = 1) {
    switch (type) {
      case "hit":
        this.spawn(8 * intensity, x, y, {
          speedMin: 30, speedMax: 120, spread: 10,
          lifeMin: 0.2, lifeMax: 0.45,
          sizeMin: 2, sizeMax: 5,
          colors: ["#ffffff", "#ffcccc", "#e74c3c"],
          gravity: 120, drag: 1.5
        });
        break;
      case "slash":
        this.spawn(10 * intensity, x, y, {
          speedMin: 40, speedMax: 180, spread: 4,
          lifeMin: 0.15, lifeMax: 0.35,
          sizeMin: 1, sizeMax: 4,
          colors: ["#ffffff", "#f1c40f", "#e74c3c"],
          gravity: 0, drag: 2
        });
        break;
      case "fireball":
        this.spawn(12 * intensity, x, y, {
          speedMin: 30, speedMax: 100, spread: 16,
          lifeMin: 0.25, lifeMax: 0.6,
          sizeMin: 3, sizeMax: 8,
          colors: ["#f1c40f", "#e67e22", "#e74c3c", "#922b21"],
          gravity: -30, drag: 1
        });
        break;
      case "magic":
        this.spawn(10 * intensity, x, y, {
          speedMin: 20, speedMax: 90, spread: 14,
          lifeMin: 0.3, lifeMax: 0.7,
          sizeMin: 2, sizeMax: 6,
          colors: ["#9b59b6", "#8e44ad", "#5dade2"],
          gravity: -20, drag: 0.8
        });
        break;
      case "guard":
        this.spawn(8 * intensity, x, y, {
          speedMin: 20, speedMax: 70, spread: 8,
          lifeMin: 0.2, lifeMax: 0.45,
          sizeMin: 2, sizeMax: 6,
          colors: ["#95a5a6", "#ffffff", "#3498db"],
          gravity: 0, drag: 2
        });
        break;
      case "status":
        this.spawn(6 * intensity, x, y, {
          speedMin: 10, speedMax: 50, spread: 6,
          lifeMin: 0.4, lifeMax: 0.8,
          sizeMin: 2, sizeMax: 5,
          colors: ["#2ecc71", "#f1c40f", "#e74c3c"],
          gravity: -40, drag: 0.5
        });
        break;
    }
  }

  render(ctx) {
    ctx.save();
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.shape === "circle") {
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.fill();
    }
    ctx.restore();
  }
}

class EffectBurstSystem {
  constructor() {
    this.bursts = [];
  }

  clear() {
    this.bursts = [];
  }

  emit(config, origin, target = null) {
    if (!config || !origin) return;
    const duration = config.duration || config.life || 0.35;
    const angle = config.angle !== undefined
      ? config.angle
      : (target ? Math.atan2(target.y - origin.y, target.x - origin.x) : 0);
    this.bursts.push({
      ...config,
      x: origin.x,
      y: origin.y,
      x2: target ? target.x : config.x2,
      y2: target ? target.y : config.y2,
      angle,
      time: 0,
      duration
    });
  }

  update(dt) {
    for (const burst of this.bursts) {
      burst.time += dt;
    }
    this.bursts = this.bursts.filter(burst => burst.time < burst.duration);
  }

  render(ctx) {
    if (this.bursts.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const burst of this.bursts) {
      const progress = Math.min(1, burst.time / burst.duration);
      const alpha = Math.max(0, 1 - progress);
      const kind = burst.kind || "ring";
      if (kind === "glyph") this.drawGlyph(ctx, burst, progress, alpha);
      else if (kind === "slash") this.drawSlash(ctx, burst, progress, alpha);
      else if (kind === "beam") this.drawBeam(ctx, burst, progress, alpha);
      else if (kind === "shield") this.drawShield(ctx, burst, progress, alpha);
      else if (kind === "pulse") this.drawPulse(ctx, burst, progress, alpha);
      else if (kind === "spark") this.drawSpark(ctx, burst, progress, alpha);
      else this.drawRing(ctx, burst, progress, alpha);
    }
    ctx.restore();
  }

  drawRing(ctx, burst, progress, alpha) {
    const radius = (burst.radius || 46) * (0.45 + progress * 0.85);
    ctx.save();
    ctx.translate(burst.x, burst.y);
    ctx.globalAlpha = alpha * (burst.alpha || 0.85);
    ctx.strokeStyle = burst.color || "#ffffff";
    ctx.lineWidth = (burst.width || 5) * (1 - progress * 0.55);
    ctx.shadowColor = burst.color || "#ffffff";
    ctx.shadowBlur = burst.glow || 16;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawPulse(ctx, burst, progress, alpha) {
    const radius = (burst.radius || 56) * (0.35 + progress);
    const grad = ctx.createRadialGradient(burst.x, burst.y, 0, burst.x, burst.y, radius);
    grad.addColorStop(0, this.withAlpha(burst.coreColor || burst.color || "#ffffff", alpha * 0.7));
    grad.addColorStop(0.45, this.withAlpha(burst.color || "#ffffff", alpha * 0.35));
    grad.addColorStop(1, this.withAlpha(burst.edgeColor || burst.color || "#ffffff", 0));
    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawGlyph(ctx, burst, progress, alpha) {
    const radius = burst.radius || 36;
    const spin = (burst.spin || 1) * progress * Math.PI * 2;
    ctx.save();
    ctx.translate(burst.x, burst.y);
    ctx.rotate(spin);
    ctx.globalAlpha = alpha * (burst.alpha || 0.9);
    ctx.strokeStyle = burst.color || "#9b59b6";
    ctx.lineWidth = burst.width || 2;
    ctx.shadowColor = burst.color || "#9b59b6";
    ctx.shadowBlur = burst.glow || 14;

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.62, 0, Math.PI * 2);
    ctx.stroke();

    const ticks = burst.ticks || 6;
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * radius * 0.78, Math.sin(a) * radius * 0.78);
      ctx.lineTo(Math.cos(a) * radius * 1.12, Math.sin(a) * radius * 1.12);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawSlash(ctx, burst, progress, alpha) {
    const length = burst.length || 110;
    const width = burst.width || 7;
    const sweep = burst.sweep || 0.85;
    const radius = length * (0.45 + progress * 0.2);
    ctx.save();
    ctx.translate(burst.x, burst.y);
    ctx.rotate(burst.angle || 0);
    ctx.globalAlpha = alpha * (burst.alpha || 0.9);
    ctx.strokeStyle = burst.color || "#f1c40f";
    ctx.lineWidth = width * (1 - progress * 0.4);
    ctx.lineCap = "round";
    ctx.shadowColor = burst.color || "#f1c40f";
    ctx.shadowBlur = burst.glow || 16;
    ctx.beginPath();
    ctx.arc(0, 0, radius, -sweep, sweep);
    ctx.stroke();
    if (burst.secondaryColor) {
      ctx.globalAlpha *= 0.55;
      ctx.strokeStyle = burst.secondaryColor;
      ctx.lineWidth = Math.max(1, width * 0.4);
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.78, -sweep * 0.7, sweep * 0.7);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBeam(ctx, burst, progress, alpha) {
    const x2 = burst.x2 ?? (burst.x + Math.cos(burst.angle || 0) * (burst.length || 180));
    const y2 = burst.y2 ?? (burst.y + Math.sin(burst.angle || 0) * (burst.length || 0));
    const eased = Math.sin(progress * Math.PI * 0.5);
    const endX = burst.x + (x2 - burst.x) * eased;
    const endY = burst.y + (y2 - burst.y) * eased;
    ctx.save();
    ctx.globalAlpha = alpha * (burst.alpha || 0.75);
    ctx.strokeStyle = burst.color || "#5dade2";
    ctx.lineWidth = burst.width || 5;
    ctx.lineCap = "round";
    ctx.shadowColor = burst.color || "#5dade2";
    ctx.shadowBlur = burst.glow || 18;
    ctx.beginPath();
    ctx.moveTo(burst.x, burst.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.restore();
  }

  drawShield(ctx, burst, progress, alpha) {
    const radius = (burst.radius || 48) * (1 + progress * 0.12);
    const sides = burst.sides || 6;
    ctx.save();
    ctx.translate(burst.x, burst.y);
    ctx.rotate(Math.PI / 6 + progress * 0.35);
    ctx.globalAlpha = alpha * (burst.alpha || 0.9);
    ctx.strokeStyle = burst.color || "#95a5a6";
    ctx.lineWidth = burst.width || 4;
    ctx.shadowColor = burst.color || "#95a5a6";
    ctx.shadowBlur = burst.glow || 18;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawSpark(ctx, burst, progress, alpha) {
    const radius = burst.radius || 44;
    const rays = burst.rays || 9;
    const core = (burst.core || 10) * (1 - progress * 0.45);
    ctx.save();
    ctx.translate(burst.x, burst.y);
    ctx.rotate((burst.angle || 0) + progress * 0.22);
    ctx.globalAlpha = alpha * (burst.alpha || 0.95);
    ctx.strokeStyle = burst.color || "#ffffff";
    ctx.lineWidth = (burst.width || 4) * (1 - progress * 0.55);
    ctx.lineCap = "round";
    ctx.shadowColor = burst.color || "#ffffff";
    ctx.shadowBlur = burst.glow || 18;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2;
      const start = core + radius * 0.12 * progress;
      const end = radius * (0.45 + progress * 0.55) * (0.75 + (i % 3) * 0.12);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * start, Math.sin(a) * start);
      ctx.lineTo(Math.cos(a) * end, Math.sin(a) * end);
      ctx.stroke();
    }
    ctx.fillStyle = burst.coreColor || "#ffffff";
    ctx.globalAlpha *= 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, core), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  withAlpha(color, alpha) {
    if (!color || color[0] !== "#") return color || `rgba(255,255,255,${alpha})`;
    const hex = color.slice(1);
    const full = hex.length === 3
      ? hex.split("").map(ch => ch + ch).join("")
      : hex;
    const num = parseInt(full, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
}

class ActorReactionSystem {
  constructor() {
    this.reactions = {
      player: null,
      enemy: null
    };
  }

  clear() {
    this.reactions.player = null;
    this.reactions.enemy = null;
  }

  trigger(target, type = "hit", intensity = 1, options = {}) {
    if (!Object.prototype.hasOwnProperty.call(this.reactions, target)) return;
    const durationByType = {
      hit: 0.24,
      crit: 0.34,
      attack: 0.28,
      windup: 0.32,
      guard: 0.28,
      dodge: 0.26,
      stagger: 0.32,
      cast: 0.24
    };
    this.reactions[target] = {
      target,
      type,
      intensity,
      duration: options.duration || durationByType[type] || 0.25,
      time: 0,
      color: options.color || this.colorFor(type),
      direction: options.direction,
      distance: options.distance,
      lift: options.lift
    };
  }

  update(dt) {
    for (const target of Object.keys(this.reactions)) {
      const reaction = this.reactions[target];
      if (!reaction) continue;
      reaction.time += dt;
      if (reaction.time >= reaction.duration) {
        this.reactions[target] = null;
      }
    }
  }

  get(target) {
    const reaction = this.reactions[target];
    if (!reaction) return {
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      rotation: 0,
      flashAlpha: 0,
      ringAlpha: 0,
      progress: 0,
      type: null,
      color: "#ffffff",
      direction: target === "enemy" ? 1 : -1,
      intensity: 0
    };

    const progress = Math.min(1, reaction.time / reaction.duration);
    const punch = Math.sin(progress * Math.PI);
    const fade = 1 - progress;
    const away = reaction.direction || (target === "enemy" ? 1 : -1);
    const forward = target === "enemy" ? -1 : 1;
    const intensity = reaction.intensity || 1;

    let offsetX = 0;
    let offsetY = 0;
    let scale = 1;
    let rotation = 0;
    let flashAlpha = 0;
    let ringAlpha = 0;

    if (reaction.type === "hit" || reaction.type === "crit" || reaction.type === "stagger") {
      const strength = reaction.distance || (reaction.type === "crit" ? 44 : (reaction.type === "stagger" ? 30 : 24));
      const lift = reaction.lift ?? (reaction.type === "crit" ? 8 : 5);
      offsetX = away * strength * intensity * punch;
      offsetY = -lift * intensity * punch;
      scale = 1 + (reaction.type === "crit" ? 0.12 : 0.06) * punch;
      rotation = away * (reaction.type === "crit" ? 0.16 : 0.09) * punch;
      flashAlpha = (reaction.type === "crit" ? 0.55 : 0.38) * fade;
    } else if (reaction.type === "attack") {
      offsetX = forward * 32 * intensity * punch;
      offsetY = -3 * intensity * punch;
      scale = 1 + 0.05 * punch;
      rotation = forward * 0.10 * punch;
      ringAlpha = 0.20 * fade;
    } else if (reaction.type === "windup") {
      offsetX = -forward * 14 * intensity * punch;
      offsetY = -4 * intensity * punch;
      scale = 1 + 0.035 * punch;
      rotation = -forward * 0.06 * punch;
      ringAlpha = 0.28 * fade;
    } else if (reaction.type === "guard") {
      offsetX = away * 8 * intensity * punch;
      scale = 1 + 0.05 * punch;
      ringAlpha = 0.55 * fade;
    } else if (reaction.type === "dodge") {
      offsetX = -38 * intensity * punch;
      offsetY = -4 * punch;
      scale = 0.98 + 0.04 * punch;
      ringAlpha = 0.35 * fade;
    } else if (reaction.type === "cast") {
      scale = 1 + 0.05 * punch;
      ringAlpha = 0.35 * fade;
    }

    return {
      offsetX,
      offsetY,
      scale,
      rotation,
      flashAlpha,
      ringAlpha,
      progress,
      type: reaction.type,
      color: reaction.color,
      direction: away,
      intensity
    };
  }

  colorFor(type) {
    if (type === "crit") return "#f1c40f";
    if (type === "guard") return "#5dade2";
    if (type === "dodge") return "#2ecc71";
    if (type === "cast") return "#9b59b6";
    if (type === "stagger") return "#e67e22";
    return "#ffffff";
  }
}

class FloatingTextManager {
  constructor() {
    this.texts = [];
  }

  clear() {
    this.texts = [];
  }

  add(value, targetX, targetY, type = "damage") {
    const text = {
      value,
      x: targetX,
      y: targetY - 30,
      type,
      time: 0,
      maxTime: type === "status" ? 1.2 : (type === "popup" ? 0.7 : (type === "qteResult" ? 0.55 : 0.9)),
      vy: type === "crit" ? -90 : (type === "popup" || type === "qteResult" ? -30 : -60),
      vx: type === "popup" || type === "qteResult" ? 0 : (Math.random() - 0.5) * 30,
      scale: type === "crit" ? 1.4 : 1.0
    };
    this.texts.push(text);
  }

  update(dt) {
    for (const t of this.texts) {
      t.time += dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.vy += 80 * dt; // gravity
      if (t.type === "crit") t.scale = 1.4 + Math.sin(t.time * 10) * 0.15;
      if (t.type === "popup" || t.type === "qteResult") {
        const popupProgress = t.time / t.maxTime;
        const popScale = t.type === "qteResult" ? 0.18 : 0.45;
        t.scale = 1 + Math.sin(popupProgress * Math.PI) * popScale;
      }
    }
    this.texts = this.texts.filter(t => t.time < t.maxTime);
  }

  removeByType(type) {
    this.texts = this.texts.filter(t => t.type !== type);
  }

  render(ctx) {
    ctx.save();
    for (const t of this.texts) {
      const progress = t.time / t.maxTime;
      const alpha = 1 - progress;
      const yOffset = Math.sin(progress * Math.PI) * 10;

      ctx.globalAlpha = alpha;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      let color = "#e74c3c";
      let font = "bold 26px sans-serif";
      let shadow = "rgba(0,0,0,0.8)";

      if (t.type === "crit") {
        color = "#f1c40f";
        font = "bold 38px sans-serif";
        shadow = "rgba(231, 76, 60, 0.8)";
      } else if (t.type === "heal") {
        color = "#2ecc71";
        font = "bold 26px sans-serif";
      } else if (t.type === "status") {
        color = "#ffffff";
        font = "bold 18px sans-serif";
        shadow = "rgba(0,0,0,0.6)";
      } else if (t.type === "popup" || t.type === "qteResult") {
        const val = String(t.value).toUpperCase();
        if (val.startsWith("PERFECT")) color = "#f1c40f";
        else if (val.startsWith("SUCCESS")) color = "#2ecc71";
        else if (val.startsWith("EARLY") || val.startsWith("LATE")) color = "#e67e22";
        else color = "#e74c3c"; // FAIL / TIMEOUT
        font = t.type === "qteResult" ? "bold 28px sans-serif" : "bold 42px sans-serif";
        shadow = color;
      }

      ctx.save();
      ctx.translate(t.x, t.y + yOffset);
      ctx.scale(t.scale, t.scale);
      ctx.fillStyle = color;
      ctx.font = font;
      ctx.shadowColor = shadow;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 3;
      const txt = String(t.value);
      ctx.strokeText(txt, 0, 0);
      ctx.fillText(txt, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }
}
