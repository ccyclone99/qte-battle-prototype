class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = canvas.width;
    this.height = canvas.height;
  }

  render(battle) {
    const ctx = this.ctx;

    ctx.save();

    // 屏幕震动
    if (battle.screenShake > 0) {
      const shake = battle.screenShake * 20;
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

    this.drawCharacters(battle);
    this.drawHUD(battle);

    if (battle.turnState === "weapon_select") {
      this.drawWeaponSelection(battle);
    } else if (battle.turnState === "player_turn") {
      this.drawActionBar(battle);
      this.drawChainHints(battle);
    } else if (battle.turnState === "enemy_turn") {
      this.drawEnemyAttackBar(battle);
    } else if (battle.turnState === "qte_running" && battle.qteRunner) {
      this.drawQTEBar(battle);
    }

    if (battle.turnState === "game_over") {
      this.drawGameOver(battle);
    }

    this.drawDamageNumbers(battle);

    ctx.restore();
  }

  drawCharacters(battle) {
    const ctx = this.ctx;

    // 玩家
    const px = 220;
    const py = this.height - 160;
    const weapon = battle.currentWeapon ? WeaponDatabase[battle.currentWeapon] : null;

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

    ctx.fillStyle = battle.enemyStunTimer > 0 ? "#f1c40f" : EnemyDatabase.base.color;
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
    if (battle.enemyStunTimer > 0) {
      ctx.fillStyle = "#f1c40f";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(`眩晕 ${battle.enemyStunTimer.toFixed(1)}s`, ex, ey - 70);
    }
  }

  drawHUD(battle) {
    const ctx = this.ctx;

    // 当前状态提示（大字体）
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(battle.message, this.width / 2, 70);

    // 武器选择提示（仅在非选择界面显示）
    if (battle.turnState !== "weapon_select") {
      const weaponY = 110;
      ctx.font = "16px sans-serif";
      let xOffset = this.width / 2 - 180;
      for (const [id, weapon] of Object.entries(WeaponDatabase)) {
        const isSelected = id === battle.currentWeapon;
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

    const cardW = 220;
    const cardH = 280;
    const gap = 40;
    const totalW = cardW * 3 + gap * 2;
    const startX = (this.width - totalW) / 2;
    const y = 160;

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
      ctx.fillText(`[${weapon.key}]`, x + cardW / 2, y + 18);

      // 图标
      ctx.fillStyle = weapon.color;
      ctx.font = "bold 64px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(weapon.icon || weapon.name[0], x + cardW / 2, y + 90);

      // 武器名
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(weapon.name, x + cardW / 2, y + 145);

      // 描述
      ctx.fillStyle = "#aaaaaa";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const words = weapon.description || "";
      ctx.fillText(words, x + cardW / 2, y + 180);

      // 链列表
      ctx.fillStyle = "#cccccc";
      ctx.font = "13px sans-serif";
      let chainY = y + 215;
      for (const [ckey, chain] of Object.entries(weapon.chains)) {
        ctx.fillText(`${ckey}: ${chain.name}`, x + cardW / 2, chainY);
        chainY += 20;
      }

      idx++;
    }
  }

  drawChainHints(battle) {
    const ctx = this.ctx;
    if (!battle.currentWeapon) return;

    const weapon = WeaponDatabase[battle.currentWeapon];
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

  drawActionBar(battle) {
    const ctx = this.ctx;
    const barW = 600;
    const barH = 28;
    const x = (this.width - barW) / 2;
    const y = this.height - 130;

    // 背景
    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(x, y, barW, barH);

    // 填充
    const progress = Utils.clamp(battle.actionBar / battle.actionBarMax, 0, 1);
    ctx.fillStyle = "#3498db";
    ctx.fillRect(x, y, barW * progress, barH);

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

  drawEnemyAttackBar(battle) {
    const ctx = this.ctx;
    if (!battle.enemyAttack) return;

    const attack = battle.enemyAttack;
    const barW = 600;
    const barH = 28;
    const x = (this.width - barW) / 2;
    const y = this.height - 130;

    const totalTime = attack.windup + attack.hitTime;
    const progress = Utils.clamp(battle.enemyAttackTimer / totalTime, 0, 1);

    // 背景
    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(x, y, barW, barH);

    // 响应窗口区域
    const responseDuration = 1.6;
    const responseStartRatio = Utils.clamp(Math.max(0, attack.windup - responseDuration) / totalTime, 0, 1);
    const windupEndRatio = Utils.clamp(attack.windup / totalTime, 0, 1);

    ctx.fillStyle = "rgba(46, 204, 113, 0.25)";
    ctx.fillRect(x + barW * responseStartRatio, y, barW * (windupEndRatio - responseStartRatio), barH);

    // 进度条
    ctx.fillStyle = attack.color;
    ctx.fillRect(x, y, barW * progress, barH);

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

  drawQTEBar(battle) {
    const ctx = this.ctx;
    const runner = battle.qteRunner;
    if (!runner) return;

    const node = runner.currentNode();
    if (!node) return;

    const barW = 600;
    const barH = 32;
    const x = (this.width - barW) / 2;
    const y = this.height - 140;
    const bounds = runner.getWindowBounds();

    // 背景
    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(x, y, barW, barH);

    // 判定窗口
    const winStartX = x + barW * (bounds.start / bounds.duration);
    const winEndX = x + barW * (bounds.end / bounds.duration);
    ctx.fillStyle = "rgba(46, 204, 113, 0.35)";
    ctx.fillRect(winStartX, y, winEndX - winStartX, barH);

    // Perfect 标记
    if (bounds.perfect !== null && bounds.perfect !== undefined) {
      const perfectX = x + barW * (bounds.perfect / bounds.duration);
      ctx.strokeStyle = "#f1c40f";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(perfectX, y - 6);
      ctx.lineTo(perfectX, y + barH + 6);
      ctx.stroke();
    }

    // 节奏节点：拍子标记
    if (node.input.type === "rhythm") {
      ctx.fillStyle = "rgba(155, 89, 182, 0.6)";
      for (const beat of node.input.beats) {
        const beatX = x + barW * (beat / bounds.duration);
        ctx.beginPath();
        ctx.arc(beatX, y + barH / 2, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 当前进度指针
    const progress = runner.currentNodeProgress();
    const pointerX = x + barW * progress;

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(pointerX, y - 8);
    ctx.lineTo(pointerX - 8, y - 18);
    ctx.lineTo(pointerX + 8, y - 18);
    ctx.fill();

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
    ctx.fillText(runner.chain.name || "QTE", this.width / 2, y - 30);
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
