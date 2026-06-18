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
      maxTime: type === "status" ? 1.2 : 0.9,
      vy: type === "crit" ? -90 : -60,
      vx: (Math.random() - 0.5) * 30,
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
    }
    this.texts = this.texts.filter(t => t.time < t.maxTime);
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
