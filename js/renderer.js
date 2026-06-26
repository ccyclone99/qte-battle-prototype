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
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = 1280;
    const displayHeight = 720;
    canvas.width = Math.floor(displayWidth * dpr);
    canvas.height = Math.floor(displayHeight * dpr);
    const scaleX = canvas.width / this.width;
    const scaleY = canvas.height / this.height;
    this.ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
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
    const ctx = this.ctx;
    const now = performance.now();
    const t = now / 1000;

    ctx.save();

    // 屏幕震动
    if (scene.screenShake > 0) {
      const shake = scene.screenShake * 20;
      const dx = (Math.random() - 0.5) * shake;
      const dy = (Math.random() - 0.5) * shake;
      ctx.translate(dx, dy);
    }

    // 镜头缩放（特写）
    if (scene.cameraZoom && scene.cameraZoom !== 1) {
      const cx = this.width / 2;
      const cy = this.height / 2;
      ctx.translate(cx, cy);
      ctx.scale(scene.cameraZoom, scene.cameraZoom);
      ctx.translate(-cx, -cy);
    }

    this.drawBackground(ctx);
    this.drawCharacters(scene, t);
    this.drawAttackEffects(scene, t);
    this.drawHitConfirmOverlays(scene);
    if (scene.effectBursts) scene.effectBursts.render(ctx);

    if (scene.turnState.startsWith("demo_")) {
      this.drawDemo(scene, t);
    } else if (scene.turnState === "select_weapon") {
      this.drawWeaponSelection(scene);
    } else if (scene.turnState === "select_spells") {
      this.drawSpellSelection(scene);
    } else if (scene.turnState === "select_arts") {
      this.drawArtSelection(scene);
    } else if (scene.turnState === "player_turn") {
      this.drawPlayerState(scene);
      this.drawStatusIcons(scene);
      this.drawActionBar(scene);
      this.drawChainHints(scene);
    } else if (scene.turnState === "enemy_turn") {
      this.drawPlayerState(scene);
      this.drawStatusIcons(scene);
      this.drawEnemyAttackBar(scene);
      if (scene.enemyAttack) {
        this.drawBigKeyPrompt(scene, scene.enemyAttack.responseKey, scene.enemyAttack.hint, 300, t);
      }
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

  shouldDrawFloatingMessage(scene) {
    if (!scene || !scene.turnState) return false;
    if (scene.turnState.startsWith("demo_")) return false;
    if (scene.turnState.startsWith("select_")) return false;
    if (scene.turnState === "game_over") return false;
    return scene.turnState !== "qte_running" && scene.turnState !== "attack_active";
  }

  shouldDrawTurnBanner(scene) {
    if (!scene || !scene.turnBanner) return false;
    return scene.turnState !== "qte_running" && scene.turnState !== "attack_active";
  }

  shouldDrawScreenFlash(scene) {
    if (!scene || !scene.turnState) return false;
    return scene.turnState !== "demo_preview";
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
    const px = 220;
    const py = this.height - 190;
    const ex = this.width - 220;
    const ey = this.height - 190;
    const pose = this.getCurrentPose(scene);
    const pState = pose.state;

    // 剑攻击轨迹
    if (pState === "swordAttack") {
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
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + Math.sin(t * 5) * 0.2;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 10;
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
      ctx.globalAlpha = 0.6 + Math.sin(t * 15) * 0.3;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + t * 4;
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
      ctx.fillStyle = "rgba(231, 76, 60, 0.25)";
      ctx.beginPath();
      ctx.arc(0, 0, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (scene.enemyAttack && (scene.turnState === "enemy_turn" || scene.enemyAttackPhase === "hit")) {
      this.drawEnemyAttackMotion(ctx, scene, px, py, ex, ey, t);
    }

    this.drawActiveAttacks(scene, t);
  }

  drawActiveAttacks(scene, t) {
    const system = scene.activeAttackSystem;
    if (!system || !Array.isArray(system.active) || system.active.length === 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const attack of system.active) {
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

      if (profile.type === "projectile") {
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
      } else if (profile.type === "beam") {
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
      } else if (profile.type === "pulse") {
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
      } else {
        this.drawMeleeActiveAttack(ctx, attack, from, to, color, progress, t);
      }

      if (attack.phase === "reaction") {
        ctx.strokeStyle = "rgba(46, 204, 113, 0.65)";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(to.x, to.y, (profile.radius || 46) + 18 + Math.sin(t * 8) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
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
    const span = (heavy ? 124 : 92) + Math.min(18, hitCount * 4);
    const center = {
      x: to.x - approach * (heavy ? 34 : 28) + approach * swing * 8,
      y: to.y - (heavy ? 10 : 18) + alternate * (hitCount > 1 ? 7 : 0)
    };

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (attack.phase === "startup") {
      const glow = 10 + Math.sin(t * 14 + hitIndex) * 3;
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = color;
      ctx.lineWidth = heavy ? 6 : 4;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(from.x - approach * 14, from.y - 34 * alternate);
      ctx.quadraticCurveTo(from.x + approach * 20, from.y - 18 * alternate, from.x + approach * 38, from.y + 18 * alternate);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(from.x + approach * 30, from.y - 10 * alternate, glow, 0, Math.PI * 2);
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
    ctx.beginPath();
    ctx.moveTo(center.x - approach * span * 0.38, center.y - alternate * 48);
    ctx.quadraticCurveTo(
      center.x + approach * span * 0.05,
      center.y - alternate * 8 - swing * 16,
      center.x + approach * span * 0.48,
      center.y + alternate * 40
    );
    ctx.stroke();

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
    const isSpell = this.isSpellLikeAttack(attack);
    const totalTime = Math.max(0.1, attack.windup + attack.hitTime);
    const progress = Utils.clamp(scene.enemyAttackTimer / totalTime, 0, 1);
    const pulse = 0.65 + Math.sin(t * 10) * 0.18;

    if (phase === "windup" || phase === "response") {
      const alpha = phase === "response" ? 0.42 : 0.22;
      ctx.save();
      ctx.globalAlpha = alpha * pulse;
      ctx.strokeStyle = color;
      ctx.lineWidth = phase === "response" ? 4 : 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = phase === "response" ? 18 : 10;
      ctx.setLineDash(phase === "response" ? [14, 8] : [6, 10]);
      ctx.beginPath();
      ctx.moveTo(ex - 40, ey - 24);
      ctx.quadraticCurveTo((px + ex) / 2, ey - 95 + Math.sin(t * 4) * 8, px + 42, py - 18);
      ctx.stroke();
      ctx.setLineDash([]);
      if (isSpell) {
        ctx.globalAlpha *= 0.85;
        ctx.beginPath();
        ctx.arc(ex - 62, ey - 34, 20 + Math.sin(t * 7) * 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    if (phase === "hit") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = color;
      ctx.lineWidth = isSpell ? 8 : 7;
      ctx.lineCap = "round";
      ctx.globalAlpha = Math.max(0.25, 1 - progress * 0.65);
      ctx.shadowColor = color;
      ctx.shadowBlur = 22;
      ctx.beginPath();
      if (isSpell) {
        ctx.moveTo(ex - 55, ey - 34);
        ctx.lineTo(px + 35, py - 18);
      } else {
        ctx.moveTo(ex - 25, ey - 44);
        ctx.quadraticCurveTo((px + ex) / 2, ey - 55, px + 40, py + 18);
      }
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.globalAlpha *= 0.55;
      ctx.stroke();
      ctx.restore();
    }
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

    // 玩家
    const basePx = 220;
    const basePy = this.height - 190;
    const weaponId = scene.playerConfig ? scene.playerConfig.weapon : null;
    const weapon = weaponId ? WeaponDatabase[weaponId] : null;
    const playerReaction = this.getActorReaction(scene, "player");
    const style = scene.playerConfig && scene.playerConfig.style ? StyleDatabase[scene.playerConfig.style] : null;
    const styleColor = style ? style.color : (weapon ? weapon.color : "#3498db");
    const actionTiming = this.getActionTiming(scene, t);
    const pose = this.getCurrentPose(scene);

    // 待机呼吸
    let bob = Math.sin(t * 2) * 2;
    let px = basePx + playerReaction.offsetX;
    let py = basePy + bob + playerReaction.offsetY;

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
    px += stanceOffset;

    this.drawActorShadow(ctx, basePx + stanceOffset + playerReaction.offsetX * 0.35, basePy + 45, 42, "rgba(52, 152, 219, 0.3)");
    this.drawActorGroundSigil(ctx, basePx + stanceOffset, basePy + 45, 50, styleColor, "player", t);
    this.drawActorMotionLines(ctx, px, py, playerReaction, "player", styleColor);
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
      t
    });
    this.drawActorReactionOverlay(px, py, 35, playerReaction);

    // 敌人
    const baseEx = this.width - 220;
    const baseEy = this.height - 190;
    const eBob = Math.sin(t * 2 + 1) * 2;
    const enemyReaction = this.getActorReaction(scene, "enemy");
    let ex = baseEx + enemyReaction.offsetX;
    let ey = baseEy + eBob + enemyReaction.offsetY;

    // 敌方蓄力前冲
    let enemyForward = 0;
    if (scene.enemyAttackPhase === "response") enemyForward = -25;
    else if (scene.enemyAttackPhase === "hit") enemyForward = -40;
    ex += enemyForward;

    const enemyConfig = scene.enemyConfig || EnemyDatabase.base;
    this.drawActorShadow(ctx, baseEx + enemyForward + enemyReaction.offsetX * 0.25, baseEy + 55, 58, "rgba(192, 57, 43, 0.3)");
    this.drawActorGroundSigil(ctx, baseEx + enemyForward, baseEy + 55, 62, enemyConfig.color || "#e74c3c", "enemy", t);
    this.drawActorMotionLines(ctx, ex, ey, enemyReaction, "enemy", enemyConfig.color || "#e74c3c");
    this.drawEnemySilhouette(ctx, scene, {
      x: ex,
      y: ey,
      config: enemyConfig,
      reaction: enemyReaction,
      t
    });
    this.drawActorReactionOverlay(ex, ey, 50, enemyReaction);

    // 敌人眩晕提示
    if (scene.enemyStunTimer > 0) {
      ctx.fillStyle = "#f1c40f";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(`眩晕 ${scene.enemyStunTimer.toFixed(1)}s`, ex, ey - 70);
    }

    // 敌方攻击意图图标
    if (scene.enemyAttack && scene.enemyAttack.icon) {
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
    const terrain = scene.encounterConfig && scene.encounterConfig.terrain ? scene.encounterConfig.terrain : "";
    const isArcane = /回廊|错拍|仪式/.test(terrain);
    const isForge = /熔炉|火|炉/.test(terrain);
    const isRain = /雨|巷/.test(terrain);
    const accent = isForge ? "#e67e22" : (isRain ? "#27ae60" : (isArcane ? "#9b59b6" : "#3498db"));

    ctx.save();
    const sky = ctx.createLinearGradient(0, floorY - 170, 0, this.height);
    sky.addColorStop(0, "rgba(12, 14, 24, 0.0)");
    sky.addColorStop(1, "rgba(6, 8, 14, 0.42)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, floorY - 170, this.width, 170);

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

    if (scene.turnState === "enemy_turn" && scene.enemyAttackPhase === "response") {
      ctx.fillStyle = this.hexToRgba("#2ecc71", 0.08 + Math.sin(t * 12) * 0.03);
      ctx.fillRect(0, floorY - 5, this.width, 8);
    }
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
    const pulse = 0.55 + Math.sin(t * 4 + (actor === "enemy" ? 1.4 : 0)) * 0.08;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = this.hexToRgba(color || "#ffffff", actor === "enemy" ? 0.28 : 0.34);
    ctx.lineWidth = 2;
    ctx.shadowColor = color || "#ffffff";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * (1 + pulse * 0.04), radius * 0.24, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.22;
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

    const phase = scene.activeEncounterPhaseId && scene.activeEncounterPhaseId !== "base" ? `阶段 ${scene.activeEncounterPhaseId}` : (enemy.model && enemy.model.type ? enemy.model.type : "enemy");
    this.drawActorNameplate(ctx, {
      x: anchors.enemy.x,
      y: anchors.enemy.y + 66,
      color: anchors.enemy.color,
      title: enemy.name || "敌人",
      subtitle: phase
    });
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
    const type = reaction.type;
    const progress = reaction.progress || 0;
    const fade = Math.max(0, 1 - progress);
    const forward = actor === "enemy" ? -1 : 1;
    const away = actor === "enemy" ? 1 : -1;
    const lineColor = reaction.color || color || "#ffffff";

    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 14;
    ctx.lineCap = "round";

    if (type === "attack" || type === "dodge") {
      ctx.globalAlpha = 0.45 * fade;
      ctx.lineWidth = type === "attack" ? 4 : 3;
      for (let i = 0; i < 3; i++) {
        const yy = y - 34 + i * 22;
        const tail = x - forward * (70 + i * 10);
        const head = x - forward * (18 + i * 4);
        ctx.beginPath();
        ctx.moveTo(tail, yy + Math.sin(progress * Math.PI + i) * 5);
        ctx.lineTo(head, yy - forward * 2);
        ctx.stroke();
      }
    } else if (type === "windup" || type === "cast") {
      ctx.globalAlpha = (type === "windup" ? 0.38 : 0.28) * fade;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + forward * 18, y - 12, 48 + Math.sin(progress * Math.PI) * 8, -0.7, 0.9);
      ctx.stroke();
    } else if (type === "hit" || type === "crit" || type === "stagger") {
      ctx.globalAlpha = (type === "crit" ? 0.65 : 0.42) * fade;
      ctx.lineWidth = type === "crit" ? 5 : 3;
      for (let i = 0; i < 4; i++) {
        const spread = (i - 1.5) * 16;
        ctx.beginPath();
        ctx.moveTo(x - away * 8, y - 30 + spread);
        ctx.lineTo(x + away * (42 + i * 6), y - 40 + spread * 0.75);
        ctx.stroke();
      }
    }

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
      t
    } = options;
    const scale = reaction.scale || 1;
    const motion = pose ? pose.motion : state;
    const isAttack = state === "swordAttack";
    const isShield = state === "shield";
    const isCast = state === "casting" || state === "charge";
    const attackEase = this.easeOutCubic(progress || 0);
    let lean = isAttack ? -0.14 + attackEase * 0.22 : (isShield ? -0.10 : (isCast ? -0.06 : 0));
    if (motion === "dualDash") lean = -0.24 + attackEase * 0.15;
    if (motion === "dualRetreat") lean = 0.08 - attackEase * 0.18;
    if (motion === "greatswordEarthsplit" || motion === "flameBladeBurst") lean = -0.24 + attackEase * 0.34;
    if (motion === "greatswordCharge" || motion === "overflowCompress") lean = -0.14;
    const bodyColor = weaponId === "greatsword" ? "#33506f" : (weaponId === "dualBlades" ? "#255f69" : "#2f5b8f");
    const trimColor = styleColor || (weapon ? weapon.color : "#3498db");
    const hasFire = scene.playerConfig && Array.isArray(scene.playerConfig.spells) && scene.playerConfig.spells.includes("fire");
    const hasAbsorb = scene.playerConfig && Array.isArray(scene.playerConfig.spells) && scene.playerConfig.spells.includes("absorb");

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(lean + (reaction.rotation || 0));

    this.drawPlayerBackGear(ctx, weaponId, trimColor, motion, attackEase);

    // legs
    this.drawLimb(ctx, -12, 22, -22, 50, "#24364d", 9);
    this.drawLimb(ctx, 10, 22, 20, 50, "#24364d", 9);

    // torso
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = trimColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = trimColor;
    ctx.shadowBlur = isCast ? 14 : 0;
    ctx.beginPath();
    ctx.roundRect(-22, -24, 44, 56, 10);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    this.drawPlayerArmorAccents(ctx, weaponId, trimColor, hasFire, hasAbsorb, t);

    // head
    ctx.fillStyle = "#d7e7ff";
    ctx.beginPath();
    ctx.arc(0, -48, 15, 0, Math.PI * 2);
    ctx.fill();
    this.drawPlayerHeadgear(ctx, weaponId, trimColor);

    // accent chest mark
    ctx.fillStyle = trimColor;
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(weapon ? (weapon.icon || weapon.name[0]) : "?", 0, 1);

    if (isShield) {
      const shieldX = motion === "mirrorGuard" ? 58 : 50;
      this.drawLimb(ctx, 18, -10, shieldX - 8, -6, "#d7e7ff", 7);
      this.drawShieldSilhouette(ctx, shieldX, -4, trimColor, t);
      if (motion === "mirrorGuard") this.drawCastFocus(ctx, shieldX + 6, -4, trimColor, t);
      this.drawLimb(ctx, -16, -8, -34, 10, "#d7e7ff", 7);
    } else if (isCast) {
      if (motion === "overflowCompress") {
        this.drawLimb(ctx, 16, -10, 34, -5, "#d7e7ff", 7);
        this.drawLimb(ctx, -16, -8, -34, -5, "#d7e7ff", 7);
        this.drawCastFocus(ctx, 0, -18, trimColor, t);
      } else if (motion === "absorbSiphon" || motion === "absorbRelease" || motion === "overflowBurst") {
        this.drawLimb(ctx, 16, -10, 52 + attackEase * 10, -18, "#d7e7ff", 7);
        this.drawCastFocus(ctx, 62 + attackEase * 10, -20, trimColor, t);
        this.drawLimb(ctx, -16, -8, -46, -18, "#d7e7ff", 7);
        this.drawCastFocus(ctx, -54, -20, trimColor, t);
      } else {
        this.drawLimb(ctx, 16, -10, 43, -30, "#d7e7ff", 7);
        this.drawCastFocus(ctx, 52, -35, trimColor, t);
        this.drawLimb(ctx, -16, -8, -38, -22, "#d7e7ff", 7);
      }
      if (weaponId === "staff") {
        const staffAngle = motion === "fireRelease" ? -0.48 : -0.22;
        this.drawWeaponSilhouette(ctx, weaponId, -30, 7, trimColor, staffAngle, 0.9);
      }
    } else if (isAttack) {
      if (weaponId === "dualBlades") {
        const retreat = motion === "dualRetreat";
        const finisher = motion === "dualFinisher";
        this.drawLimb(ctx, 16, -10, 42 + attackEase * (retreat ? -16 : 28), -18 + attackEase * (finisher ? -8 : 12), "#d7e7ff", 7);
        this.drawLimb(ctx, -16, -8, -38 + attackEase * (retreat ? -18 : 16), -4 + attackEase * 8, "#d7e7ff", 7);
        this.drawWeaponSilhouette(ctx, weaponId, 48 + attackEase * (retreat ? -16 : 28), -18 + attackEase * (finisher ? -8 : 12), trimColor, -0.55 + attackEase * 0.9, finisher ? 1.1 : 0.95);
        this.drawWeaponSilhouette(ctx, weaponId, -44 + attackEase * (retreat ? -18 : 16), -4 + attackEase * 8, trimColor, Math.PI - 0.35 - attackEase * 0.65, finisher ? 1.0 : 0.85);
      } else {
        let weaponX = 48 + attackEase * 18;
        let weaponY = -18 + attackEase * 12;
        let angle = -0.22 + attackEase * 0.55;
        let weaponScale = 1;
        if (motion === "greatswordDraw") {
          weaponX = 16 + attackEase * 34;
          weaponY = 22 - attackEase * 34;
          angle = -1.15 + attackEase * 0.72;
        } else if (motion === "greatswordEarthsplit" || motion === "flameBladeBurst" || motion === "greatswordOvercharge") {
          weaponX = 34 + attackEase * 28;
          weaponY = -36 + attackEase * 42;
          angle = -1.05 + attackEase * 1.2;
          weaponScale = 1.15;
        }
        this.drawLimb(ctx, 16, -10, weaponX - 6, weaponY + 4, "#d7e7ff", 7);
        this.drawLimb(ctx, -16, -8, -32 + attackEase * 10, 2, "#d7e7ff", 7);
        this.drawWeaponSilhouette(ctx, weaponId, weaponX, weaponY, trimColor, angle, weaponScale);
      }
    } else {
      this.drawLimb(ctx, 16, -8, 36, 7, "#d7e7ff", 7);
      this.drawLimb(ctx, -16, -8, -36, 10, "#d7e7ff", 7);
      this.drawWeaponSilhouette(ctx, weaponId, 38, 10, trimColor, 0.25, 0.78);
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
    const { x, y, config, reaction, t } = options;
    const scale = reaction.scale || 1;
    const color = scene.enemyStunTimer > 0 ? "#f1c40f" : (config.color || EnemyDatabase.base.color);
    const icon = config.icon || "敌";
    const model = config.model || {};
    const modelType = model.type || (icon === "术" ? "caster" : (icon === "甲" ? "armored" : (icon === "迅" ? "swift" : (icon === "盾" ? "shielded" : "golem"))));
    const isCaster = modelType === "caster";
    const isArmored = modelType === "armored";
    const isSwift = modelType === "swift";
    const isShielded = modelType === "shielded";
    const isGolem = modelType === "golem";
    const reactionType = reaction.type || "";
    const reactionPulse = Math.sin((reaction.progress || 0) * Math.PI);
    const attackReach = reactionType === "attack" ? (isSwift ? 34 : 26) * reactionPulse : 0;
    const windupPull = reactionType === "windup" ? 12 * reactionPulse : 0;
    const lean = (isSwift ? -0.16 : (isArmored ? -0.04 : (scene.enemyAttackPhase === "response" ? -0.16 : 0))) + (reaction.rotation || 0);
    const torsoW = isArmored ? 72 : (isSwift ? 48 : (isCaster ? 54 : 60));
    const torsoH = isArmored ? 72 : (isSwift ? 64 : 66);
    const limbColor = isGolem ? "#8b4a3c" : (isCaster ? "#dec7ff" : "#f3d4d4");

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * (isArmored ? 1.08 : 1), scale * (isSwift ? 0.96 : 1));
    ctx.rotate(lean);

    // legs
    this.drawLimb(ctx, -14, 28, -28 - (isSwift ? 7 : 0), 58, "#3a2028", isArmored ? 12 : (isSwift ? 7 : 9));
    this.drawLimb(ctx, 12, 28, 22 + (isSwift ? 10 : 0), 58, "#3a2028", isArmored ? 12 : (isSwift ? 7 : 9));

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
    this.drawEnemyModelAccents(ctx, modelType, color, icon, t);

    // head
    ctx.fillStyle = isCaster ? "#dec7ff" : (isGolem ? "#b86b57" : "#f3d4d4");
    ctx.beginPath();
    if (isGolem) {
      ctx.roundRect(-18, -72, 36, 30, 7);
    } else {
      ctx.arc(0, -58, isArmored ? 19 : (isSwift ? 14 : 16), 0, Math.PI * 2);
    }
    ctx.fill();
    this.drawEnemyHeadgear(ctx, modelType, color, t);

    // arms and archetype gear
    if (isCaster) {
      this.drawLimb(ctx, -24, -10, -54 - attackReach + windupPull, -24, limbColor, 7);
      this.drawCastFocus(ctx, -66 - attackReach + windupPull, -28, color, t);
      this.drawLimb(ctx, 24, -8, 45, 2, limbColor, 7);
    } else if (isShielded) {
      this.drawLimb(ctx, -26, -6, -52 - attackReach + windupPull, -2, limbColor, 8);
      this.drawShieldSilhouette(ctx, -62 - attackReach + windupPull, -2, color, t);
      this.drawLimb(ctx, 24, -8, 48 - attackReach * 0.35, 10, limbColor, 8);
      this.drawWeaponSilhouette(ctx, "greatsword", 48 - attackReach * 0.35, 10, color, -0.15, 0.46);
    } else if (isSwift) {
      this.drawLimb(ctx, -22, -10, -54 - attackReach, 0, limbColor, 6);
      this.drawLimb(ctx, 22, -8, 54 - attackReach * 0.4, -12, limbColor, 6);
      this.drawWeaponSilhouette(ctx, "dualBlades", -56 - attackReach, 0, color, Math.PI * 0.9, 0.55);
      this.drawWeaponSilhouette(ctx, "dualBlades", 54, -12, color, -Math.PI * 0.25, 0.55);
    } else {
      this.drawLimb(ctx, -26, -8, -50 - attackReach + windupPull, 8, limbColor, isGolem ? 10 : 8);
      this.drawLimb(ctx, 26, -8, 54 - attackReach * 0.3, 0, limbColor, isGolem ? 10 : 8);
      if (isArmored || isGolem) this.drawWeaponSilhouette(ctx, "greatsword", -54 - attackReach + windupPull, 8, color, Math.PI * 0.95, isArmored ? 0.7 : 0.55);
    }

    ctx.restore();
  }

  drawEnemyModelAccents(ctx, modelType, color, icon, t) {
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
    } else if (modelType === "caster") {
      ctx.strokeStyle = this.hexToRgba(color, 0.78);
      ctx.beginPath();
      ctx.arc(0, -4, 17, 0, Math.PI * 2);
      ctx.moveTo(-10, 10);
      ctx.lineTo(10, -18);
      ctx.moveTo(10, 10);
      ctx.lineTo(-10, -18);
      ctx.stroke();
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
    } else if (modelType === "shielded") {
      ctx.strokeStyle = this.hexToRgba(color, 0.72);
      ctx.beginPath();
      ctx.roundRect(-20, -18, 40, 36, 5);
      ctx.stroke();
      ctx.fillStyle = this.hexToRgba(color, 0.20);
      ctx.fillRect(-17, -2, 34, 6);
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 19px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = color || "#ffffff";
    ctx.shadowBlur = 8;
    ctx.fillText(icon || "敌", 0, 2);
    ctx.restore();
  }

  drawEnemyHeadgear(ctx, modelType, color, t) {
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

  drawWeaponSilhouette(ctx, weaponId, x, y, color, angle, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    ctx.scale(scale, scale);
    ctx.strokeStyle = color || "#f1c40f";
    ctx.fillStyle = color || "#f1c40f";
    ctx.shadowColor = color || "#f1c40f";
    ctx.shadowBlur = 10;
    ctx.lineCap = "round";

    if (weaponId === "greatsword") {
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(52, 0);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.75;
      ctx.fillRect(12, -2, 34, 4);
      ctx.globalAlpha = 1;
    } else if (weaponId === "dualBlades") {
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(34, -14);
      ctx.moveTo(0, 6);
      ctx.lineTo(34, 14);
      ctx.stroke();
    } else if (weaponId === "staff") {
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-8, 34);
      ctx.lineTo(14, -42);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(16, -46, 8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(40, 0);
      ctx.stroke();
    }

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

    const impactTime = active ? active.profile.impactTime : attack.windup + attack.hitTime;
    const totalTime = Math.max(0.001, impactTime);
    const currentTime = active ? active.elapsed : scene.enemyAttackTimer;
    const progress = Utils.clamp(currentTime / totalTime, 0, 1);

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
    ctx.fillText("绿色窗口 = 可防御时机  红线 = 命中时刻", this.width / 2, y - 42);

    this.drawEnemyAttackReadout(scene, attack, x, y, barW, totalTime);
  }

  getEnemyAttackMeta(attack) {
    const id = attack.id || "";
    const isSpell = attack.interruptible || id.includes("spell") || id.includes("arcane") || id.includes("curse");
    const type = isSpell ? "法术" : (id.includes("heavy") || id.includes("shield") ? "重击" : "物理");
    const isHighThreat = attack.damage >= 30 || attack.stunOnHit || id.includes("heavy") || id.includes("curse");
    const threat = isHighThreat ? "高危" : (attack.windup <= 0.75 ? "快攻" : "中危");
    const threatColor = threat === "高危" ? "#e74c3c" : (threat === "快攻" ? "#2ecc71" : "#f1c40f");
    const responseKeys = [...new Set((attack.allowedResponses || []).map(id => id === "guard" ? "F" : "SPACE"))].join(" / ") || "?";
    return { type, threat, threatColor, responseKeys };
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
    ctx.font = "bold 13px sans-serif";
    ctx.fillStyle = meta.threatColor;
    ctx.fillText(`${meta.type} · ${meta.threat} · 推荐 ${meta.responseKeys}`, x + barW / 2, y - 62);

    ctx.font = "12px sans-serif";
    ctx.fillStyle = inResponse ? "#2ecc71" : "#dddddd";
    const timing = inResponse
      ? `窗口开启 · ${timeToHit.toFixed(1)}s 后命中`
      : `预警中 · ${timeToWindow.toFixed(1)}s 后开窗`;
    ctx.fillText(timing, x + barW / 2, y + 50);

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
    const stageTitle = this.getNodeStageTitle(node);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(stageTitle, this.width / 2, y - 46);

    // 链标题
    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(runner.chain.name || "QTE", this.width / 2, y - 26);

    // 输入提示
    const hint = this.getNodeInputHint(node);
    if (hint) {
      ctx.fillStyle = "#dddddd";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(hint, this.width / 2, y + barH + 10);
    }
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
    const stageTitle = this.getNodeStageTitle(node);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(stageTitle, stage.centerX, y - 46);

    // 链标题
    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(this.truncateText(ctx, runner.chain.name || "QTE", barW - 40), stage.centerX, y - 26);

    // 输入提示
    const hint = this.getNodeInputHint(node);
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

    if (scene.armorBreakActive) icons.push({ icon: "破", color: "#e74c3c", count: scene.armorBreakTurns });
    if (scene.playerState) {
      const ps = scene.playerState;
      if (ps.consecutiveDodges > 0) icons.push({ icon: "闪", color: "#2ecc71", count: ps.consecutiveDodges });
      if (ps.shieldEnchanted) icons.push({ icon: "咒", color: "#9b59b6" });
      if (ps.absorbReady) icons.push({ icon: "吸", color: "#5dade2" });
      if (ps.spellEnergy > ps.maxSpellEnergy) icons.push({ icon: "溢", color: "#f39c12" });
    }
    if (scene.enemyStunTimer > 0) icons.push({ icon: "晕", color: "#f1c40f", count: Math.ceil(scene.enemyStunTimer * 10) / 10 });
    if (scene.statusSystem) {
      for (const status of scene.statusSystem.list().slice(0, 6)) {
        const def = scene.statusSystem.getDefinition(status.id);
        icons.push({
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
    const alpha = (f.timer / f.maxTime) * 0.45;
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
    const actionKeyPromptY = 365;

    // 当前阶段大字说明
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.truncateText(ctx, phase.label || "", stage.w), stage.centerX, this.height / 2 - 30);

    if (phase.detail) {
      ctx.fillStyle = "#d8d8e8";
      ctx.font = "15px sans-serif";
      ctx.textBaseline = "top";
      ctx.fillText(this.truncateText(ctx, phase.detail, stage.w), stage.centerX, this.height / 2 + 2);
    }

    // 阶段进度点
    const dotY = this.height / 2 + 30;
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
