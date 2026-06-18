class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = canvas.width;
    this.height = canvas.height;
  }

  renderBlank() {
    const ctx = this.ctx;
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, "#12121a");
    grad.addColorStop(1, "#1a1a25");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  render(scene) {
    const ctx = this.ctx;

    ctx.save();

    // 屏幕震动
    if (scene.screenShake > 0) {
      const shake = scene.screenShake * 20;
      const dx = (Math.random() - 0.5) * shake;
      const dy = (Math.random() - 0.5) * shake;
      ctx.translate(dx, dy);
    }

    // 背景
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, "#12121a");
    grad.addColorStop(1, "#1a1a25");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // 地面
    ctx.fillStyle = "#232330";
    ctx.fillRect(0, this.height - 80, this.width, 80);

    this.drawCharacters(scene);
    this.drawHUD(scene);

    if (scene.turnState.startsWith("demo_")) {
      this.drawDemo(scene);
    } else if (scene.turnState === "select_weapon") {
      this.drawWeaponSelection(scene);
    } else if (scene.turnState === "select_spells") {
      this.drawSpellSelection(scene);
    } else if (scene.turnState === "select_arts") {
      this.drawArtSelection(scene);
    } else if (scene.turnState === "player_turn") {
      this.drawActionBar(scene);
      this.drawChainHints(scene);
      this.drawPlayerState(scene);
      this.drawStatusIcons(scene);
    } else if (scene.turnState === "enemy_turn") {
      this.drawEnemyAttackBar(scene);
      this.drawPlayerState(scene);
      this.drawStatusIcons(scene);
    } else if (scene.turnState === "qte_running" && scene.qteRunner) {
      this.drawQTEBar(scene);
      this.drawPlayerState(scene);
      this.drawStatusIcons(scene);
    }

    if (scene.turnState === "game_over") {
      this.drawGameOver(scene);
    }

    // 屏幕闪白/闪红
    if (scene.screenFlash) {
      this.drawScreenFlash(scene);
    }

    // 粒子与浮动文字
    if (scene.particles) scene.particles.render(ctx);
    if (scene.floatingTexts) scene.floatingTexts.render(ctx);
    else this.drawDamageNumbers(scene);

    // 回合横幅
    if (scene.turnBanner) {
      this.drawTurnBanner(scene);
    }

    ctx.restore();
  }

  drawPlayerState(battle) {
    const ctx = this.ctx;
    const x = 20;
    const y = 160;
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

  drawCharacters(scene) {
    const ctx = this.ctx;

    // 玩家
    const px = 220;
    const py = this.height - 160;
    const weaponId = scene.playerConfig ? scene.playerConfig.weapon : null;
    const weapon = weaponId ? WeaponDatabase[weaponId] : null;

    // 玩家身体
    ctx.fillStyle = "#3498db";
    ctx.beginPath();
    ctx.arc(px, py, 35, 0, Math.PI * 2);
    ctx.fill();

    // 武器图标
    if (weapon) {
      ctx.fillStyle = weapon.color;
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(weapon.icon || weapon.name[0], px, py);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", px, py);
    }

    // 玩家脚下标识
    ctx.fillStyle = "rgba(52, 152, 219, 0.3)";
    ctx.beginPath();
    ctx.ellipse(px, py + 45, 40, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // 敌人
    const ex = this.width - 220;
    const ey = this.height - 160;

    ctx.fillStyle = scene.enemyStunTimer > 0 ? "#f1c40f" : EnemyDatabase.base.color;
    ctx.beginPath();
    ctx.arc(ex, ey, 50, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("敌", ex, ey);

    ctx.fillStyle = "rgba(192, 57, 43, 0.3)";
    ctx.beginPath();
    ctx.ellipse(ex, ey + 55, 55, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // 敌人眩晕提示
    if (scene.enemyStunTimer > 0) {
      ctx.fillStyle = "#f1c40f";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(`眩晕 ${scene.enemyStunTimer.toFixed(1)}s`, ex, ey - 70);
    }
  }

  drawHUD(scene) {
    const ctx = this.ctx;

    // 当前状态提示（大字体，选择界面由选择画面自己渲染）
    if (!scene.turnState.startsWith("select_")) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(scene.message, this.width / 2, 70);
    }

    // 武器选择提示（仅在非选择界面显示）
    if (!scene.turnState.startsWith("select_")) {
      const weaponY = 110;
      ctx.font = "16px sans-serif";
      let xOffset = this.width / 2 - 180;
      const selectedWeaponId = scene.playerConfig ? scene.playerConfig.weapon : null;
      for (const [id, weapon] of Object.entries(WeaponDatabase)) {
        const isSelected = id === selectedWeaponId;
        ctx.fillStyle = isSelected ? weapon.color : "#666";
        ctx.fillText(`${isSelected ? "▶ " : ""}[${weapon.key}] ${weapon.name}`, xOffset, weaponY);
        xOffset += 140;
      }
    }
  }

  drawWeaponSelection(battle) {
    const ctx = this.ctx;

    // 暗色遮罩
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, this.width, this.height);

    // 标题
    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("选择你的武器", this.width / 2, 80);

    const cardW = 200;
    const cardH = 250;
    const gap = 30;
    const totalW = cardW * 3 + gap * 2;
    const startX = (this.width - totalW) / 2;
    const y = 150;

    let idx = 0;
    for (const [id, weapon] of Object.entries(WeaponDatabase)) {
      const x = startX + idx * (cardW + gap);
      const isHovered = false; // 后续可扩展鼠标悬停

      // 卡片背景
      ctx.fillStyle = "rgba(30, 30, 40, 0.9)";
      ctx.strokeStyle = weapon.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 12);
      ctx.fill();
      ctx.stroke();

      // 按键提示
      ctx.fillStyle = weapon.color;
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(`[${weapon.key}]`, x + cardW / 2, y + 16);

      // 图标
      ctx.fillStyle = weapon.color;
      ctx.font = "bold 56px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(weapon.icon || weapon.name[0], x + cardW / 2, y + 78);

      // 武器名
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(weapon.name, x + cardW / 2, y + 130);

      // 描述
      ctx.fillStyle = "#aaaaaa";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const words = weapon.description || "";
      ctx.fillText(words, x + cardW / 2, y + 160);

      // 链列表
      ctx.fillStyle = "#cccccc";
      ctx.font = "12px sans-serif";
      let chainY = y + 188;
      for (const [ckey, chain] of Object.entries(weapon.chains)) {
        ctx.fillText(`${ckey}: ${chain.name}`, x + cardW / 2, chainY);
        chainY += 20;
      }

      idx++;
    }
  }

  drawChainHints(scene) {
    const ctx = this.ctx;
    const weaponId = scene.playerConfig ? scene.playerConfig.weapon : null;
    if (!weaponId) return;

    const weapon = WeaponDatabase[weaponId];
    const chains = Object.entries(weapon.chains);
    const cardW = 180;
    const cardH = 60;
    const gap = 20;
    const totalW = cardW * chains.length + gap * (chains.length - 1);
    const startX = (this.width - totalW) / 2;
    const y = this.height - 210;

    let idx = 0;
    for (const [key, chain] of chains) {
      const x = startX + idx * (cardW + gap);

      ctx.fillStyle = "rgba(20, 20, 30, 0.85)";
      ctx.strokeStyle = chain.color || weapon.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = chain.color || weapon.color;
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`[${key}] ${chain.name}`, x + cardW / 2, y + cardH / 2 - 8);

      ctx.fillStyle = "#aaaaaa";
      ctx.font = "11px sans-serif";
      ctx.fillText(chain.description, x + cardW / 2, y + cardH / 2 + 12);

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

    const cardW = 260;
    const cardH = 320;
    const gap = 30;
    const totalW = cardW * config.options.length + gap * (config.options.length - 1);
    const startX = (this.width - totalW) / 2;
    const y = 140;

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
      ctx.fillText(`[${opt.key}]`, x + cardW / 2, y + 15);

      ctx.font = "bold 56px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(opt.icon, x + cardW / 2, y + 90);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(opt.name, x + cardW / 2, y + 145);

      ctx.fillStyle = "#aaaaaa";
      ctx.font = "13px sans-serif";
      this.wrapText(ctx, opt.description, x + cardW / 2, y + 185, cardW - 30, 20);

      if (opt.selected) {
        ctx.fillStyle = opt.color;
        ctx.font = "bold 16px sans-serif";
        ctx.fillText("✓ 已选择", x + cardW / 2, y + cardH - 30);
      }
    });

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(config.confirmHint, this.width / 2, y + cardH + 25);
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
    const barH = 28;
    const x = (this.width - barW) / 2;
    const y = this.height - 130;

    // 背景
    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(x, y, barW, barH);

    // 填充
    const progress = Utils.clamp(scene.actionBar / scene.actionBarMax, 0, 1);
    const grad = ctx.createLinearGradient(x, y, x + barW * progress, y);
    grad.addColorStop(0, "#2980b9");
    grad.addColorStop(1, "#3498db");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, barW * progress, barH);

    // 发光
    ctx.shadowColor = "rgba(52, 152, 219, 0.5)";
    ctx.shadowBlur = 10;
    ctx.fillRect(x, y, barW * progress, 2);
    ctx.shadowBlur = 0;

    // 边框
    ctx.strokeStyle = "#5a5a6a";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barW, barH);

    // 文字
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("行动条", x + barW / 2, y + barH / 2);
  }

  drawEnemyAttackBar(scene) {
    const ctx = this.ctx;
    if (!scene.enemyAttack) return;

    const attack = scene.enemyAttack;
    const barW = 600;
    const barH = 28;
    const x = (this.width - barW) / 2;
    const y = this.height - 130;

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
    ctx.fillText(`${attack.name} 预警`, x + barW / 2, y + barH / 2);

    // 提示
    ctx.fillStyle = "#f1c40f";
    ctx.font = "14px sans-serif";
    ctx.fillText(attack.hint, this.width / 2, y - 25);
  }

  drawQTEBar(scene) {
    const ctx = this.ctx;
    const runner = scene.qteRunner;
    if (!runner) return;

    const node = runner.currentNode();
    if (!node) return;

    const barW = 600;
    const barH = 36;
    const x = (this.width - barW) / 2;
    const y = this.height - 145;
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
      ctx.moveTo(perfectX, y - 8);
      ctx.lineTo(perfectX, y + barH + 8);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 节奏节点：拍子标记
    if (node.input.type === "rhythm") {
      ctx.fillStyle = "rgba(155, 89, 182, 0.7)";
      for (const beat of node.input.beats) {
        const beatX = x + barW * (beat / bounds.duration);
        ctx.beginPath();
        ctx.arc(beatX, y + barH / 2, 9, 0, Math.PI * 2);
        ctx.fill();
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
    ctx.moveTo(pointerX, y - 10);
    ctx.lineTo(pointerX - 9, y - 22);
    ctx.lineTo(pointerX + 9, y - 22);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 边框
    ctx.strokeStyle = "#5a5a6a";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barW, barH);

    // 节点名称与按键提示
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let inputHint = "";
    if (node.input.type === "press") inputHint = `按 [${node.input.key}]`;
    else if (node.input.type === "hold_release") inputHint = `松开 [${node.input.key}]`;
    else if (node.input.type === "rhythm") inputHint = `跟随节奏按 [${node.input.key}]`;

    ctx.fillText(`${node.name} — ${inputHint}`, x + barW / 2, y + barH / 2);

    // 链标题
    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(runner.chain.name || "QTE", this.width / 2, y - 35);
  }

  drawDamageNumbers(battle) {
    if (!battle.lastDamageNumber) return;

    const dn = battle.lastDamageNumber;
    dn.time -= 0.016;
    if (dn.time <= 0) {
      battle.lastDamageNumber = null;
      return;
    }

    const ctx = this.ctx;
    const x = dn.target === "enemy" ? this.width - 220 : 220;
    const y = this.height - 220 - (1 - dn.time) * 40;

    ctx.save();
    ctx.fillStyle = dn.target === "enemy" ? "#e74c3c" : "#e74c3c";
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 6;
    ctx.fillText(`-${dn.value}`, x, y);
    ctx.restore();
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

    if (icons.length === 0) return;

    const startX = 20;
    let y = 100;
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

  drawDemo(scene) {
    const ctx = this.ctx;

    if (scene.turnState === "demo_main") {
      this.drawDemoMenu(scene);
    } else if (scene.turnState === "demo_list") {
      this.drawDemoList(scene);
    } else if (scene.turnState === "demo_preview") {
      this.drawDemoPreview(scene);
    } else if (scene.turnState === "demo_qte") {
      // 演示 QTE 播放中 — 显示标题横幅
      const ctx = this.ctx;
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fillRect(0, 0, this.width, 70);
      ctx.fillStyle = "#f1c40f";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`演示: ${scene.previewTitle}`, this.width / 2, 35);

      this.drawDemoInspector(scene);
      this.drawQTEBar(scene);
      this.drawPlayerState(scene);
    }
  }

  drawDemoMenu(scene) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("效果演示模式", this.width / 2, 55);

    // 当前武器与难度信息
    const weapon = scene.playerConfig.weapon ? WeaponDatabase[scene.playerConfig.weapon] : null;
    ctx.fillStyle = "#ffffff";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "left";
    let infoX = 40;
    const infoY = 110;
    if (weapon) {
      ctx.fillStyle = weapon.color;
      ctx.fillText(`当前武器: ${weapon.name} [${weapon.key}]  |  按 W 切换武器`, infoX, infoY);
    }
    ctx.fillStyle = "#aaaaaa";
    ctx.fillText(`难度: ${Difficulty.get().name}  |  按 6 切换（演示中自动 Perfect，仅影响参数展示）`, infoX, infoY + 22);
    ctx.fillText(`敌人 HP: ${scene.enemyHp}/${scene.enemyMaxHp}  |  效果会实时扣减 HP 条`, infoX, infoY + 44);

    const categories = scene.categories;
    const cardW = 200;
    const cardH = 130;
    const gap = 30;
    const totalW = cardW * categories.length + gap * (categories.length - 1);
    const startX = (this.width - totalW) / 2;
    const y = 195;

    categories.forEach((cat, idx) => {
      const x = startX + idx * (cardW + gap);
      ctx.fillStyle = "rgba(30, 30, 40, 0.9)";
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cat.icon, x + cardW / 2, y + 40);

      ctx.font = "bold 20px sans-serif";
      ctx.fillText(cat.name, x + cardW / 2, y + 85);

      ctx.fillStyle = "#aaaaaa";
      ctx.font = "13px sans-serif";
      ctx.fillText(`按 ${idx + 1}`, x + cardW / 2, y + 112);
    });

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("按 1-4 选择分类 | W 切换武器 | 6 切换难度 | ESC 返回主菜单", this.width / 2, y + cardH + 30);
  }

  drawDemoList(scene) {
    const ctx = this.ctx;
    const items = scene.getCurrentPageItems();
    const totalItems = scene.getCurrentItems().length;
    const totalPages = scene.getTotalPages();
    const categoryName = scene.getCategoryName();

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${categoryName} — 选择要演示的效果`, this.width / 2, 50);

    // 当前武器提示
    const weapon = scene.playerConfig.weapon ? WeaponDatabase[scene.playerConfig.weapon] : null;
    ctx.fillStyle = "#aaaaaa";
    ctx.font = "14px sans-serif";
    ctx.fillText(`当前武器: ${weapon ? weapon.name : "无"}  |  共 ${totalItems} 项效果  |  第 ${scene.listPage + 1}/${totalPages} 页`, this.width / 2, 90);

    const cols = 3;
    const cardW = 280;
    const cardH = 88;
    const gapX = 20;
    const gapY = 12;
    const totalW = cardW * cols + gapX * (cols - 1);
    const startX = Math.floor((this.width - totalW) / 2);
    const startY = 120;

    items.forEach((item, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);

      ctx.fillStyle = "rgba(25, 25, 35, 0.9)";
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(this.truncateText(ctx, `${idx + 1}. ${item.name}`, cardW - 16), x + 8, y + 8);

      ctx.fillStyle = "#aaaaaa";
      ctx.font = "11px sans-serif";
      this.drawWrappedLine(ctx, item.description, x + 8, y + 30, cardW - 16, 16, 2);

      ctx.fillStyle = "#666f85";
      ctx.font = "10px sans-serif";
      ctx.fillText(item.chain ? "QTE 链演示" : "即时效果预览", x + 8, y + cardH - 18);
    });

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`按 1-${items.length} 选择 | A/← 上页 | D/→ 下页 | ESC 返回`, this.width / 2, this.height - 54);
  }

  drawDemoPreview(scene) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(scene.previewTitle, this.width / 2, 80);

    ctx.fillStyle = "#ffffff";
    ctx.font = "18px sans-serif";
    this.wrapText(ctx, scene.previewText, this.width / 2, 130, 600, 28);

    // 显示当前 HP 状态
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "left";
    const infoX = 80;
    const infoY = 220;
    ctx.fillStyle = "#3498db";
    ctx.fillText(`玩家 HP: ${scene.playerHp}/${scene.playerMaxHp}`, infoX, infoY);
    ctx.fillStyle = "#c0392b";
    ctx.fillText(`敌人 HP: ${scene.enemyHp}/${scene.enemyMaxHp}`, infoX, infoY + 28);
    if (scene.enemyStunTimer > 0) {
      ctx.fillStyle = "#f1c40f";
      ctx.fillText(`敌人眩晕: ${scene.enemyStunTimer.toFixed(1)}s`, infoX, infoY + 56);
    }
    if (scene.armorBreakActive) {
      ctx.fillStyle = "#e74c3c";
      ctx.fillText(`破甲生效中: ${scene.armorBreakTurns} 回合`, infoX, infoY + 84);
    }

    // 特效状态指示器
    let fxY = infoY;
    ctx.textAlign = "right";
    const fxX = this.width - 80;
    if (scene.playerState.shieldEnchanted) {
      ctx.fillStyle = "#9b59b6";
      ctx.fillText("盾牌附魔", fxX, fxY);
      fxY += 24;
    }
    if (scene.playerState.spellEnergy > 100) {
      ctx.fillStyle = "#e74c3c";
      ctx.fillText(`能量过载: ${Math.floor(scene.playerState.spellEnergy)}`, fxX, fxY);
      fxY += 24;
    } else if (scene.playerState.spellEnergy > 0) {
      ctx.fillStyle = "#9b59b6";
      ctx.fillText(`法术能量: ${Math.floor(scene.playerState.spellEnergy)}`, fxX, fxY);
      fxY += 24;
    }

    this.drawDemoDetails(scene, 80, 305, this.width - 160, 145);

    ctx.textAlign = "center";
    ctx.fillStyle = "#aaaaaa";
    ctx.font = "bold 16px sans-serif";
    const pulse = 1 + Math.sin(performance.now() / 500) * 0.3;
    ctx.globalAlpha = 0.6 + pulse * 0.4;
    ctx.fillText("按任意键继续", this.width / 2, this.height - 50);
    ctx.globalAlpha = 1;
  }

  drawDemoInspector(scene) {
    const ctx = this.ctx;
    const lines = scene.getQTEInspectorLines();
    const x = 40;
    const y = 84;
    const w = 360;
    const h = 170;

    ctx.save();
    ctx.fillStyle = "rgba(10, 10, 16, 0.88)";
    ctx.strokeStyle = "#4a4a5a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("当前演示", x + 14, y + 12);

    let lineY = y + 38;
    ctx.fillStyle = "#d8d8e8";
    ctx.font = "12px sans-serif";
    for (const line of lines.slice(0, 7)) {
      ctx.fillText(this.truncateText(ctx, line, w - 28), x + 14, lineY);
      lineY += 18;
    }
    ctx.restore();
  }

  drawDemoDetails(scene, x, y, w, h) {
    const ctx = this.ctx;
    const detailLines = scene.detailLines || [];
    const resultLines = scene.resultLines || [];
    const lines = [...detailLines, ...resultLines];
    if (lines.length === 0) return;

    ctx.save();
    ctx.fillStyle = "rgba(10, 10, 16, 0.82)";
    ctx.strokeStyle = "#4a4a5a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("具体情况", x + 14, y + 12);

    let lineY = y + 36;
    const maxY = y + h - 12;
    ctx.font = "12px sans-serif";
    for (const line of lines) {
      if (lineY >= maxY) break;
      ctx.fillStyle = resultLines.includes(line) ? "#ffffff" : "#c8c8d8";
      lineY = this.drawWrappedLine(ctx, line, x + 14, lineY, w - 28, 17, 2);
    }
    ctx.restore();
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
    ctx.fillText("刷新页面重新开始", this.width / 2, this.height / 2 + 30);
  }
}
