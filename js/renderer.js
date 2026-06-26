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
    } else if (scene.turnState === "game_over") {
      this.drawGameOver(scene);
    }

    // 通用浮层提示（选择/演示/结束界面各自处理）
    if (!scene.turnState.startsWith("demo_") && !scene.turnState.startsWith("select_") && scene.turnState !== "game_over") {
      this.drawFloatingMessage(scene);
    }

    // 屏幕闪白/闪红
    if (scene.screenFlash) {
      this.drawScreenFlash(scene);
    }

    // 粒子与浮动文字
    if (scene.particles) scene.particles.render(ctx);
    if (scene.floatingTexts) scene.floatingTexts.render(ctx);

    // 回合横幅
    if (scene.turnBanner) {
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
    const y = 70;
    const barW = 160;
    const barH = 12;

    // 法术能量条
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(x, y, barW, barH + 18);

    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(x, y + 18, barW, barH);

    const energyRatio = Math.min(battle.playerState.spellEnergy / battle.playerState.maxSpellEnergy, 1.5);
    const displayRatio = Math.min(energyRatio, 1);
    ctx.fillStyle = battle.playerState.spellEnergy > battle.playerState.maxSpellEnergy ? "#e74c3c" : "#9b59b6";
    ctx.fillRect(x, y + 18, barW * displayRatio, barH);

    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`法术能量 ${Math.floor(battle.playerState.spellEnergy)}/${battle.playerState.maxSpellEnergy}`, x, y);

    let offsetY = y + 40;

    if (battle.resourceSystem && (battle.hasSpell && battle.hasSpell("fire") || battle.resourceSystem.heat > 0)) {
      const heatY = offsetY;
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(x, heatY, barW, barH + 18);
      ctx.fillStyle = "#2a2a3a";
      ctx.fillRect(x, heatY + 18, barW, barH);
      const heatRatio = Math.min(battle.resourceSystem.heat / battle.resourceSystem.maxHeat, 1);
      ctx.fillStyle = heatRatio >= 0.85 ? "#e74c3c" : "#e67e22";
      ctx.fillRect(x, heatY + 18, barW * heatRatio, barH);
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px sans-serif";
      ctx.fillText(`热量 ${Math.floor(battle.resourceSystem.heat)}/${battle.resourceSystem.maxHeat}`, x, heatY);
      offsetY += 42;
    }

    // 破甲
    if (battle.armorBreakActive) {
      ctx.fillStyle = "#e74c3c";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(`破甲中 ${battle.armorBreakTurns} 回合`, x, offsetY);
      offsetY += 22;
    }

    // 连续闪避
    if (battle.playerState.consecutiveDodges > 0) {
      ctx.fillStyle = "#2ecc71";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(`连续闪避 ${battle.playerState.consecutiveDodges}`, x, offsetY);
      offsetY += 22;
    }

    // 盾附魔
    if (battle.playerState.shieldEnchanted) {
      ctx.fillStyle = "#9b59b6";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("盾牌附魔", x, offsetY);
      offsetY += 22;
    }

    // 当前激活咒术/战技
    if (battle.playerConfig.spells.length > 0 || battle.playerConfig.combatArts.length > 0) {
      ctx.fillStyle = "#f1c40f";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("已装备:", x, offsetY);
      offsetY += 18;

      for (const id of battle.playerConfig.spells) {
        const spell = SpellDatabase[id];
        ctx.fillStyle = spell.color;
        ctx.fillText(`· ${spell.name}`, x + 5, offsetY);
        offsetY += 16;
      }
      for (const id of battle.playerConfig.combatArts) {
        const art = CombatArtDatabase[id];
        ctx.fillStyle = art.color;
        ctx.fillText(`· ${art.name}`, x + 5, offsetY);
        offsetY += 16;
      }
    }
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

    // 地面
    ctx.fillStyle = "#1e1e2a";
    ctx.fillRect(0, this.height - 150, this.width, 150);
    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(0, this.height - 150, this.width, 4);

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
  }

  drawActorShadow(ctx, x, y, radius, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, Math.max(8, radius * 0.22), 0, 0, Math.PI * 2);
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
    const bodyColor = "#2f6fa3";
    const trimColor = styleColor || (weapon ? weapon.color : "#3498db");

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(lean);

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

    // head
    ctx.fillStyle = "#d7e7ff";
    ctx.beginPath();
    ctx.arc(0, -48, 15, 0, Math.PI * 2);
    ctx.fill();

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

  drawEnemySilhouette(ctx, scene, options) {
    const { x, y, config, reaction, t } = options;
    const scale = reaction.scale || 1;
    const color = scene.enemyStunTimer > 0 ? "#f1c40f" : (config.color || EnemyDatabase.base.color);
    const icon = config.icon || "敌";
    const isCaster = icon === "术";
    const isArmored = icon === "甲";
    const isSwift = icon === "迅";
    const isShielded = icon === "盾";
    const lean = isSwift ? -0.12 : (scene.enemyAttackPhase === "response" ? -0.16 : 0);

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(lean);

    // legs
    this.drawLimb(ctx, -14, 28, -28, 58, "#3a2028", isArmored ? 12 : 9);
    this.drawLimb(ctx, 12, 28, 22, 58, "#3a2028", isArmored ? 12 : 9);

    // torso
    ctx.fillStyle = color;
    ctx.strokeStyle = isArmored ? "#f5c6c6" : "rgba(255,255,255,0.35)";
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
    } else {
      ctx.roundRect(isArmored ? -34 : -28, -32, isArmored ? 68 : 56, 66, isArmored ? 8 : 12);
    }
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // head
    ctx.fillStyle = isCaster ? "#dec7ff" : "#f3d4d4";
    ctx.beginPath();
    ctx.arc(0, -58, isArmored ? 19 : 16, 0, Math.PI * 2);
    ctx.fill();

    // arms and archetype gear
    if (isCaster) {
      this.drawLimb(ctx, -24, -10, -54, -24, "#f3d4d4", 7);
      this.drawCastFocus(ctx, -66, -28, color, t);
      this.drawLimb(ctx, 24, -8, 45, 2, "#f3d4d4", 7);
    } else if (isShielded) {
      this.drawLimb(ctx, -26, -6, -52, -2, "#f3d4d4", 8);
      this.drawShieldSilhouette(ctx, -62, -2, color, t);
      this.drawLimb(ctx, 24, -8, 48, 10, "#f3d4d4", 8);
    } else if (isSwift) {
      this.drawLimb(ctx, -22, -10, -54, 0, "#f3d4d4", 6);
      this.drawLimb(ctx, 22, -8, 54, -12, "#f3d4d4", 6);
      this.drawWeaponSilhouette(ctx, "dualBlades", -56, 0, color, Math.PI * 0.9, 0.55);
      this.drawWeaponSilhouette(ctx, "dualBlades", 54, -12, color, -Math.PI * 0.25, 0.55);
    } else {
      this.drawLimb(ctx, -26, -8, -50, 8, "#f3d4d4", 8);
      this.drawLimb(ctx, 26, -8, 54, 0, "#f3d4d4", 8);
      if (isArmored) this.drawWeaponSilhouette(ctx, "greatsword", -54, 8, color, Math.PI * 0.95, 0.7);
    }

    // center icon
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 19px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, 0, 2);

    if (isArmored) {
      ctx.strokeStyle = "rgba(255,255,255,0.32)";
      ctx.lineWidth = 2;
      for (let yy = -16; yy <= 18; yy += 14) {
        ctx.beginPath();
        ctx.moveTo(-26, yy);
        ctx.lineTo(26, yy);
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

  drawExpectedInputMarker(runner, barY, barW = 760, barH = 30) {
    const ctx = this.ctx;
    const node = runner.currentNode();
    if (!node) return;
    const t = runner.getExpectedInputTime();
    if (t === null || t === undefined) return;

    const x = (this.width - barW) / 2 + barW * Utils.clamp(t / node.duration, 0, 1);
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

  drawBigKeyPrompt(scene, key, subtext, y = 435, t = performance.now() / 1000) {
    const ctx = this.ctx;
    if (!key) return;

    const x = this.width / 2;
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
    ctx.fillText(`敌人匹配：${enemyLabel}`, this.width / 2, this.layout.selectionTitleY + 42);

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
    const row1Y = compact ? 106 : 112;
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
    const cardW = 170;
    const cardH = 50;
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
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`[${key}] ${chain.name}`, x + cardW / 2, y + cardH / 2 - 7);

      ctx.fillStyle = "#aaaaaa";
      ctx.font = "11px sans-serif";
      ctx.fillText(chain.description, x + cardW / 2, y + cardH / 2 + 10);

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
    const barW = 760;
    const barH = 30;
    const x = (this.width - barW) / 2;
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

    // 发光
    ctx.shadowColor = attack.color;
    ctx.shadowBlur = 12;
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
    const responseDuration = attack.responseDuration || Difficulty.responseDuration();
    const responseStart = Math.max(0, attack.windup - responseDuration);
    const timeToWindow = Math.max(0, responseStart - scene.enemyAttackTimer);
    const timeToHit = Math.max(0, attack.windup - scene.enemyAttackTimer);
    const inResponse = scene.enemyAttackPhase === "response";
    const progress = Utils.clamp(scene.enemyAttackTimer / totalTime, 0, 1);

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
    const bounds = runner.getWindowBounds();

    // 背景
    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(x, y, barW, barH);

    // 判定窗口
    const winStartX = x + barW * (bounds.start / bounds.duration);
    const winEndX = x + barW * (bounds.end / bounds.duration);
    const winGrad = ctx.createLinearGradient(winStartX, y, winEndX, y);
    winGrad.addColorStop(0, "rgba(46, 204, 113, 0.25)");
    winGrad.addColorStop(0.5, "rgba(46, 204, 113, 0.55)");
    winGrad.addColorStop(1, "rgba(46, 204, 113, 0.25)");
    ctx.fillStyle = winGrad;
    ctx.fillRect(winStartX, y, winEndX - winStartX, barH);

    // Perfect 标记脉冲
    if (bounds.perfect !== null && bounds.perfect !== undefined) {
      const perfectX = x + barW * (bounds.perfect / bounds.duration);
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
        const beatX = x + barW * (beat / bounds.duration);
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

  drawDemoQTEBar(scene) {
    const ctx = this.ctx;
    const runner = scene.qteRunner;
    if (!runner) return;

    const node = runner.currentNode();
    if (!node) return;

    const barW = 760;
    const barH = 30;
    const x = (this.width - barW) / 2;
    const y = this.layout.qteBarY;
    const bounds = runner.getWindowBounds();

    // 背景
    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(x, y, barW, barH);

    // 判定窗口
    const winStartX = x + barW * (bounds.start / bounds.duration);
    const winEndX = x + barW * (bounds.end / bounds.duration);
    const winGrad = ctx.createLinearGradient(winStartX, y, winEndX, y);
    winGrad.addColorStop(0, "rgba(46, 204, 113, 0.25)");
    winGrad.addColorStop(0.5, "rgba(46, 204, 113, 0.55)");
    winGrad.addColorStop(1, "rgba(46, 204, 113, 0.25)");
    ctx.fillStyle = winGrad;
    ctx.fillRect(winStartX, y, winEndX - winStartX, barH);

    // Perfect 标记脉冲
    if (bounds.perfect !== null && bounds.perfect !== undefined) {
      const perfectX = x + barW * (bounds.perfect / bounds.duration);
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
        const beatX = x + barW * (beat / bounds.duration);
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

    if (scene.turnState === "demo_main") {
      this.drawDemoMenu(scene);
    } else if (scene.turnState === "demo_list") {
      this.drawDemoList(scene);
    } else if (scene.turnState === "demo_preview") {
      this.drawDemoPreview(scene);
    } else if (scene.turnState === "demo_enemy_windup") {
      this.drawDemoEnemyWindup(scene);
    } else if (scene.turnState === "demo_action_sequence") {
      this.drawDemoActionSequence(scene, t);
    } else if (scene.turnState === "demo_qte") {
      // 演示 QTE 播放中 — 中央舞台，底部操作区
      const ctx = this.ctx;
      ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = "#f1c40f";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(scene.previewTitle, this.width / 2, this.layout.demoTitleY);

      const modeText = scene.manualMode ? "手动试玩：请在判定窗口内按键" : "自动演示中";
      ctx.fillStyle = "#aaaaaa";
      ctx.font = "14px sans-serif";
      ctx.fillText(modeText, this.width / 2, 103);

      if (scene.demoCounterAttack) {
        this.drawDemoCounterAttackIndicator(ctx);
      }

      const focusLines = scene.getActiveDirectorLines ? scene.getActiveDirectorLines(4) : [];
      if (focusLines.length > 0) {
        this.drawDemoFocusPanel(ctx, focusLines, 128, 760);
      }

      this.drawDemoQTEBar(scene);

      const node = scene.qteRunner ? scene.qteRunner.currentNode() : null;
      if (node) {
        const key = node.input.type === "hold_release" ? `松开 ${node.input.key}` : node.input.key;
        this.drawBigKeyPrompt(scene, key, node.name, 360, t);
      }

      if (!scene.manualMode && scene.qteRunner) {
        this.drawExpectedInputMarker(scene.qteRunner, this.layout.qteBarY);
      }
    }
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

  drawDemoFocusPanel(ctx, lines, y, maxWidth = 760) {
    const cleanLines = (lines || []).filter(Boolean).slice(0, 4);
    if (cleanLines.length === 0) return;

    const lineH = 20;
    const padX = 18;
    const padY = 10;
    const w = maxWidth;
    const h = padY * 2 + cleanLines.length * lineH;
    const x = (this.width - w) / 2;

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

  drawDemoActionSequence(scene, t) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(scene.previewTitle, this.width / 2, this.layout.demoTitleY);

    const seq = scene.actionSequence;
    if (!seq) return;

    if (scene.enemyAttack) {
      this.drawDemoEnemyAttackBar(scene);
    }

    const phase = seq.phases[seq.phaseIndex];
    const total = seq.phases.length;
    const completed = seq.phaseIndex;

    // 当前阶段大字说明
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(phase.label || "", this.width / 2, this.height / 2 - 30);

    if (phase.detail) {
      ctx.fillStyle = "#d8d8e8";
      ctx.font = "15px sans-serif";
      ctx.textBaseline = "top";
      ctx.fillText(phase.detail, this.width / 2, this.height / 2 + 2);
    }

    // 阶段进度点
    const dotY = this.height / 2 + 30;
    const startX = this.width / 2 - (total - 1) * 20;
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
      this.drawBigKeyPrompt(scene, keyMatch[1], "", 300, t);
    }
  }

  drawDemoEnemyWindup(scene) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(scene.previewTitle, this.width / 2, this.layout.demoTitleY);

    const modeText = scene.manualMode ? "手动试玩" : "自动演示";
    ctx.fillStyle = "#aaaaaa";
    ctx.font = "14px sans-serif";
    ctx.fillText(`${modeText} — ${scene.message}`, this.width / 2, 103);

    this.drawDemoEnemyAttackBar(scene);

    const key = scene.demoDefenseKey || "?";
    this.drawBigKeyPrompt(scene, key, "命中后按", 300, t);

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
    const stepX = 40;
    let stepY = 340;
    for (const step of steps) {
      ctx.fillText(step, stepX, stepY);
      stepY += 20;
    }
  }

  drawDemoEnemyAttackBar(scene) {
    const ctx = this.ctx;
    if (!scene.enemyAttack) return;

    const attack = scene.enemyAttack;
    const barW = 760;
    const barH = 30;
    const x = (this.width - barW) / 2;
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

    this.drawEnemyAttackReadout(scene, attack, x, y, barW, totalTime);
  }

  drawDemoMenu(scene) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("效果演示模式", this.width / 2, this.layout.demoTitleY);

    const categories = scene.categories;
    const cardW = 210;
    const cardH = 110;
    const gap = 24;
    const row1Count = Math.min(3, categories.length);
    const row2Count = Math.max(0, categories.length - row1Count);
    const row1W = cardW * row1Count + gap * (row1Count - 1);
    const row2W = row2Count > 0 ? cardW * row2Count + gap * (row2Count - 1) : 0;
    const row1X = (this.width - row1W) / 2;
    const row2X = (this.width - row2W) / 2;
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
      ctx.font = "bold 34px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cat.icon, x + cardW / 2, y + 36);

      ctx.font = "bold 20px sans-serif";
      ctx.fillText(cat.name, x + cardW / 2, y + 76);

      ctx.fillStyle = "#aaaaaa";
      ctx.font = "13px sans-serif";
      ctx.fillText(`按 ${idx + 1}`, x + cardW / 2, y + 100);
    });

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    const modeText = scene.manualMode ? "手动试玩" : "自动演示";
    ctx.fillText(`当前：${modeText} | 1-${categories.length} 选择分类 | W 切换风格 | M 切换模式 | 6 切换难度 | ESC 返回`, this.width / 2, this.layout.bottomHintY);
  }

  drawDemoList(scene) {
    const ctx = this.ctx;
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
    ctx.fillText(`${categoryName} — 选择要演示的效果`, this.width / 2, this.layout.demoTitleY);

    ctx.fillStyle = "#aaaaaa";
    ctx.font = "14px sans-serif";
    ctx.fillText(`共 ${totalItems} 项  |  第 ${scene.listPage + 1}/${totalPages} 页`, this.width / 2, 105);

    const cols = 2;
    const cardW = 360;
    const cardH = 100;
    const gapX = 24;
    const gapY = 14;
    const totalW = cardW * cols + gapX * (cols - 1);
    const startX = Math.floor((this.width - totalW) / 2);
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
    ctx.fillText(`当前：${modeText} | 1-${items.length} 选择 | A/← 上页 | D/→ 下页 | M 切换模式 | ESC 返回`, this.width / 2, this.layout.bottomHintY);
  }

  drawDemoPreview(scene) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fillRect(0, 0, this.width, this.height);

    // 大标题
    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(scene.previewTitle, this.width / 2, this.layout.demoTitleY);

    // 说明
    ctx.fillStyle = "#ffffff";
    ctx.font = "18px sans-serif";
    this.wrapText(ctx, scene.previewText, this.width / 2, 115, 720, 28);

    // 结算/结果摘要
    const summaryLines = scene.getPreviewSummaryLines
      ? scene.getPreviewSummaryLines(8)
      : (scene.resultLines || []).slice(0, 6);
    if (summaryLines.length > 0) {
      const panelW = 860;
      const panelX = (this.width - panelW) / 2;
      const panelY = 205;
      const lineH = 23;
      const panelH = 28 + summaryLines.length * lineH;

      ctx.fillStyle = "rgba(10, 12, 18, 0.68)";
      ctx.strokeStyle = "rgba(241, 196, 15, 0.45)";
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

      ctx.font = "13px sans-serif";
      summaryLines.forEach((line, idx) => {
        ctx.fillStyle = line.startsWith("看点：") ? "#f1c40f" : "#d9deea";
        ctx.fillText(this.truncateText(ctx, line, panelW - 36), panelX + 18, panelY + 34 + idx * lineH);
      });
    }

    ctx.fillStyle = "#b0b8c0";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("R 重播当前演示 / 任意键返回列表", this.width / 2, this.height - 28);
  }

  drawGameOver(battle) {
    const ctx = this.ctx;

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
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
  }
}
