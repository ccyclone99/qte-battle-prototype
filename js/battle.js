class BattleSystem {
  constructor(input) {
    this.input = input;

    // 基础属性
    this.playerMaxHp = 100;
    this.playerHp = this.playerMaxHp;
    this.enemyMaxHp = 200;
    this.enemyHp = this.enemyMaxHp;

    // 回合/阶段状态
    this.turnState = "select_weapon"; // select_weapon | select_spells | select_arts | player_turn | enemy_turn | qte_running | resolving | game_over
    this.actionBarMax = 5.0;
    this.actionBar = 0;

    // 玩家配置（开局选择）
    this.playerConfig = {
      weapon: null,
      spells: [],      // 可多选
      combatArts: []   // 可多选
    };

    // 玩家运行时状态
    this.playerState = {
      spellEnergy: 0,
      maxSpellEnergy: 100,
      consecutiveDodges: 0,
      lastAttackTime: 0,
      shieldEnchanted: false,
      absorbReady: false,
      currentState: "idle" // idle | charge | shield | swordAttack | casting
    };

    // 敌人状态
    this.enemyAttack = null;
    this.enemyAttackTimer = 0;
    this.enemyAttackPhase = "none";
    this.enemyStunTimer = 0;
    this.armorBreakHits = 0;
    this.armorBreakTurns = 0;
    this.armorBreakActive = false;
    this.defenseTriggered = false;

    // QTE
    this.qteRunner = null;
    this.pendingFollowUp = false; // 荒芜之地追加攻击待触发

    // 结算
    this.resolveTimer = 0;
    this.resolveDuration = 0.4;

    // 消息
    this.message = "按 A / S / D 选择武器";
    this.messageTimer = 0;
    this.flashMessage = null;

    // 视觉
    this.screenShake = 0;
    this.hitStop = 0;
    this.lastDamageNumber = null;

    // 特效
    this.particles = new ParticleSystem();
    this.floatingTexts = new FloatingTextManager();
    this.turnBanner = null;
    this.screenFlash = null;

    // 日志
    this.logs = [];
    this.onLog = null;
  }

  // ========== 核心更新 ==========

  update(dt) {
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      if (this.hitStop < 0) this.hitStop = 0;
      return;
    }

    if (this.screenShake > 0) {
      this.screenShake -= dt;
      if (this.screenShake < 0) this.screenShake = 0;
    }

    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0 && this.flashMessage) {
        this.message = this.flashMessage;
        this.flashMessage = null;
      }
    }

    if (this.turnBanner) {
      this.turnBanner.timer -= dt;
      if (this.turnBanner.timer <= 0) this.turnBanner = null;
    }

    if (this.screenFlash) {
      this.screenFlash.timer -= dt;
      if (this.screenFlash.timer <= 0) this.screenFlash = null;
    }

    this.particles.update(dt);
    this.floatingTexts.update(dt);

    switch (this.turnState) {
      case "select_weapon":
        this.updateWeaponSelect();
        break;
      case "select_spells":
        this.updateSpellSelect();
        break;
      case "select_arts":
        this.updateArtSelect();
        break;
      case "player_turn":
        this.updatePlayerTurn(dt);
        break;
      case "enemy_turn":
        this.updateEnemyTurn(dt);
        break;
      case "qte_running":
        this.updateQTE(dt);
        break;
      case "resolving":
        this.updateResolving(dt);
        break;
    }
  }

  // ========== 开局选择阶段 ==========

  updateWeaponSelect() {
    this.consumeSelectionInputs("weapon");
  }

  updateSpellSelect() {
    this.consumeSelectionInputs("spells");
  }

  updateArtSelect() {
    this.consumeSelectionInputs("arts");
  }

  consumeSelectionInputs(phase) {
    while (true) {
      const ev = this.input.peek();
      if (!ev) return;

      if (ev.type !== "press") {
        this.input.consume();
        continue;
      }

      const key = ev.key.toUpperCase();

      // 确认进入下一步
      if (key === "SPACE" || key === "ENTER") {
        this.input.consume();
        if (phase === "spells") {
          this.turnState = "select_arts";
          this.setMessage("按 1 [德斯洛] / 2 [东方] / 3 [荒芜] 选择战技，按空格开始战斗");
        } else if (phase === "arts") {
          this.startPlayerTurn();
          return;
        }
        return;
      }

      if (phase === "weapon") {
        for (const [id, weapon] of Object.entries(WeaponDatabase)) {
          if (weapon.key === key) {
            this.input.consume();
            this.playerConfig.weapon = id;
            this.turnState = "select_spells";
            this.setMessage("按 1 [烈火重重] / 2 [咒还] 切换选择，按空格确认");
            return;
          }
        }
      } else if (phase === "spells") {
        if (key === "1") {
          this.input.consume();
          this.toggleSpell("fire");
        } else if (key === "2") {
          this.input.consume();
          this.toggleSpell("absorb");
        }
      } else if (phase === "arts") {
        if (key === "1") {
          this.input.consume();
          this.toggleCombatArt("desslo");
        } else if (key === "2") {
          this.input.consume();
          this.toggleCombatArt("eastern");
        } else if (key === "3") {
          this.input.consume();
          this.toggleCombatArt("desolo");
        }
      }

      // 未匹配的按键丢弃
      this.input.consume();
    }
  }

  toggleSpell(spellId) {
    const idx = this.playerConfig.spells.indexOf(spellId);
    if (idx >= 0) {
      this.playerConfig.spells.splice(idx, 1);
    } else {
      this.playerConfig.spells.push(spellId);
    }
    this.updateSelectionMessage();
  }

  toggleCombatArt(artId) {
    const idx = this.playerConfig.combatArts.indexOf(artId);
    if (idx >= 0) {
      this.playerConfig.combatArts.splice(idx, 1);
    } else {
      this.playerConfig.combatArts.push(artId);
    }
    this.updateSelectionMessage();
  }

  updateSelectionMessage() {
    if (this.turnState === "select_spells") {
      const selected = this.playerConfig.spells.map(id => SpellDatabase[id].name).join(", ") || "无";
      this.setMessage(`已选咒术：${selected} — 按 1/2 切换，空格确认`);
    } else if (this.turnState === "select_arts") {
      const selected = this.playerConfig.combatArts.map(id => CombatArtDatabase[id].name).join(", ") || "无";
      this.setMessage(`已选战技：${selected} — 按 1/2/3 切换，空格开始战斗`);
    }
  }

  // ========== 玩家回合 ==========

  updatePlayerTurn(dt) {
    // 先读取输入
    this.consumeCombatInputs();
    if (this.turnState !== "player_turn") return;

    // 敌人眩晕处理
    if (this.enemyStunTimer > 0) {
      this.enemyStunTimer -= dt;
      if (this.enemyStunTimer < 0) this.enemyStunTimer = 0;
    }

    // 法术能量过载伤害
    if (this.hasSpell("absorb") && this.playerState.spellEnergy > this.playerState.maxSpellEnergy) {
      this.playerHp = Math.max(0, this.playerHp - SpellDatabase.absorb.staffOverflowDecay * dt);
      if (this.playerHp <= 0) {
        this.turnState = "game_over";
        this.setMessage("法术能量反噬…");
        return;
      }
    }

    this.actionBar += dt;
    if (this.actionBar >= this.actionBarMax) {
      this.actionBar = this.actionBarMax;
      this.performNormalAttack();
    }
  }

  // ========== 敌方回合 ==========

  updateEnemyTurn(dt) {
    if (!this.enemyAttack) return;

    const attack = this.enemyAttack;
    this.enemyAttackTimer += dt;

    const responseDuration = Difficulty.responseDuration();
    const responseStart = Math.max(0, attack.windup - responseDuration);

    if (this.enemyAttackPhase === "windup" && this.enemyAttackTimer >= responseStart) {
      this.enemyAttackPhase = "response";
      this.setMessage(`${attack.name} 来袭！${attack.hint}`);
    }

    if (this.enemyAttackPhase === "response") {
      this.consumeEnemyResponseInputs();
      if (this.turnState !== "enemy_turn") return;
    }

    if (this.enemyAttackTimer >= attack.windup + attack.hitTime && !this.defenseTriggered) {
      this.enemyAttackPhase = "hit";
      this.resolveEnemyHit(attack);
    }
  }

  resolveEnemyHit(attack) {
    if (this.tryAbsorbIncomingSpell(attack)) {
      return;
    }

    let damage = attack.damage;

    // 烈火重重：盾火反
    if (this.hasSpell("fire")) {
      this.applyDamage("enemy", SpellDatabase.fire.shieldThornDamage);
      this.setMessage(`${SpellDatabase.fire.shieldThornMessage} 敌人受到 ${SpellDatabase.fire.shieldThornDamage} 反伤`);
    }

    // 护甲破坏增伤
    if (this.armorBreakActive) {
      damage = Math.floor(damage * (1 + SpellDatabase.fire.armorBreakDamageBonus));
    }

    this.applyDamage("player", damage);
    this.setMessage(`${attack.name} 命中！受到 ${damage} 伤害`);
    this.startResolving(() => this.startPlayerTurn());
  }

  // ========== QTE 运行 ==========

  updateQTE(dt) {
    if (!this.qteRunner) {
      this.turnState = "resolving";
      return;
    }

    // 战技：施法/持盾时闪避
    this.consumeQTECombatArtInputs();

    this.qteRunner.update(dt);

    while (true) {
      const ev = this.input.consume();
      if (!ev) break;
      this.qteRunner.handleInput(ev, this.input.heldKeys);
    }

    if (this.qteRunner.isDone()) {
      this.onQTEComplete();
    }
  }

  // ========== 输入处理 ==========

  consumeCombatInputs() {
    while (true) {
      const ev = this.input.peek();
      if (!ev) return;

      if (ev.type !== "press") {
        this.input.consume();
        continue;
      }

      const key = ev.key.toUpperCase();

      // 荒芜之地：追加攻击
      if (this.pendingFollowUp && key === "A") {
        this.input.consume();
        this.triggerFollowUpQTE();
        return;
      }

      const chains = this.getEffectiveChains();
      const chain = chains[key];

      if (chain) {
        this.input.consume();
        this.triggerWeaponQTE(key);
        return;
      }

      this.input.consume();
    }
  }

  consumeDefenseInputs() {
    if (this.defenseTriggered) return;

    while (true) {
      const ev = this.input.peek();
      if (!ev) return;

      if (ev.type !== "press") {
        this.input.consume();
        continue;
      }

      const key = ev.key.toUpperCase();
      const attack = this.enemyAttack;
      if (!attack) return;

      for (const defenseId of attack.allowedResponses || []) {
        const defense = DefenseDatabase[defenseId];
        if (defense && defense.key === key) {
          this.input.consume();
          this.defenseTriggered = true;
          this.triggerDefenseQTE(defenseId);
          return;
        }
      }

      this.input.consume();
    }
  }

  consumeEnemyResponseInputs() {
    if (this.defenseTriggered) return;

    while (true) {
      const ev = this.input.peek();
      if (!ev) return;

      if (ev.type !== "press") {
        this.input.consume();
        continue;
      }

      const key = ev.key.toUpperCase();
      const attack = this.enemyAttack;
      if (!attack) return;

      if (this.canEasternGuardNeutralize(key)) {
        this.input.consume();
        this.triggerEasternGuardNeutralize();
        return;
      }

      for (const defenseId of attack.allowedResponses || []) {
        const defense = DefenseDatabase[defenseId];
        if (defense && defense.key === key) {
          const pressTime = this.enemyAttackTimer;
          this.input.consume();
          this.defenseTriggered = true;
          this.triggerDefenseQTE(defenseId, pressTime);
          return;
        }
      }

      if (this.hasAttackAnytime()) {
        const chains = this.getEffectiveChains();
        const chain = chains[key];
        if (chain) {
          this.input.consume();
          if (this.hasCombatArt("desolo") && this.pendingFollowUp) {
            this.triggerFollowUpQTE();
          } else {
            this.triggerCounterAttack(key);
          }
          return;
        }
      }

      this.input.consume();
    }
  }

  consumeEnemyTurnAttackInputs() {
    while (true) {
      const ev = this.input.peek();
      if (!ev) return;

      if (ev.type !== "press") {
        this.input.consume();
        continue;
      }

      const key = ev.key.toUpperCase();
      const chains = this.getEffectiveChains();
      const chain = chains[key];

      if (chain) {
        this.input.consume();
        // 荒芜之地：追加攻击在敌方回合触发为化解/打断
        if (this.hasCombatArt("desolo") && this.pendingFollowUp) {
          this.triggerFollowUpQTE();
        } else {
          this.triggerCounterAttack(key);
        }
        return;
      }

      this.input.consume();
    }
  }

  consumeQTECombatArtInputs() {
    if (!this.qteRunner) return;

    const node = this.qteRunner.currentNode();
    if (!node) return;

    const ev = this.input.peek();
    if (!ev || ev.type !== "press") return;

    const key = ev.key.toUpperCase();

    // 施法时闪避（德斯洛 / 荒芜之地）
    if (this.playerState.currentState === "casting") {
      if ((this.hasCombatArt("desslo") || this.hasCombatArt("desolo")) && key === "SPACE") {
        this.input.consume();
        this.interruptCastingAndDodge();
        return;
      }
      // 施法时招架/咒还（荒芜之地）
      if (this.hasCombatArt("desolo") && key === "F") {
        this.input.consume();
        this.interruptCastingAndParry();
        return;
      }
    }

    // 持盾时闪避（德斯洛 / 东方）
    if (this.playerState.currentState === "shield") {
      if ((this.hasCombatArt("desslo") || this.hasCombatArt("eastern")) && key === "SPACE") {
        this.input.consume();
        this.interruptGuardAndDodge();
        return;
      }
    }
  }

  // ========== 动作触发 ==========

  getEffectiveChains() {
    if (!this.playerConfig.weapon) return {};

    const weapon = WeaponDatabase[this.playerConfig.weapon];
    const chains = {};

    // 复制基础链
    for (const [key, chain] of Object.entries(weapon.chains)) {
      chains[key] = chain;
    }

    // 咒术覆盖
    for (const spellId of this.playerConfig.spells) {
      const spell = SpellDatabase[spellId];
      if (spell.chainOverrides && spell.chainOverrides[this.playerConfig.weapon]) {
        for (const [key, chain] of Object.entries(spell.chainOverrides[this.playerConfig.weapon])) {
          chains[key] = chain;
        }
      }
    }

    // 战技追加链
    for (const artId of this.playerConfig.combatArts) {
      const art = CombatArtDatabase[artId];
      if (art.chainOverrides && art.chainOverrides[this.playerConfig.weapon]) {
        for (const [key, chain] of Object.entries(art.chainOverrides[this.playerConfig.weapon])) {
          chains[key] = chain;
        }
      }
    }

    return chains;
  }

  triggerWeaponQTE(chainKey) {
    const chains = this.getEffectiveChains();
    const chain = chains[chainKey];
    if (!chain) return;

    this.playerState.currentState = this.isSwordChain(chainKey) ? "swordAttack" : "idle";
    if (chainKey === "S" && this.playerConfig.weapon === "staff") {
      this.playerState.currentState = "casting";
    }

    this.turnState = "qte_running";
    this.qteRunner = new QTEChainRunner(Difficulty.scaleChain(chain), {
      source: "player",
      context: { isSwordChain: this.isSwordChain(chainKey) },
      onNodeEffect: (node, outcome, transition) => {
        if (node.input.type === "hold_release" || node.input.type === "rhythm") {
          this.playerState.currentState = "charge";
        }
        if (transition.message) this.setMessage(transition.message);
      },
      onRhythmHit: (idx, diff) => {
        this.setMessage(`节拍 ${idx + 1} 命中`);
      }
    });

    this.setMessage(`${chain.name} — ${this.qteRunner.currentNodeName()}`);
  }

  triggerCounterAttack(chainKey) {
    const chains = this.getEffectiveChains();
    const chain = chains[chainKey];
    if (!chain) return;

    this.defenseTriggered = true;
    this.playerState.currentState = "swordAttack";
    this.turnState = "qte_running";
    this.qteRunner = new QTEChainRunner(Difficulty.scaleChain(chain), {
      source: "player",
      context: { counterAttack: true, isSwordChain: true },
      onNodeEffect: (node, outcome, transition) => {
        if (transition.message) this.setMessage(transition.message);
      },
      onRhythmHit: (idx, diff) => {
        this.setMessage(`节拍 ${idx + 1} 命中`);
      }
    });

    this.setMessage(`反击：${chain.name} — ${this.qteRunner.currentNodeName()}`);
  }

  triggerFollowUpQTE() {
    const chains = this.getEffectiveChains();
    const chain = chains["followUp"];
    if (!chain) return;

    this.pendingFollowUp = false;
    this.defenseTriggered = true;
    this.playerState.currentState = "swordAttack";
    this.turnState = "qte_running";
    this.qteRunner = new QTEChainRunner(Difficulty.scaleChain(chain), {
      source: "player",
      context: { followUp: true, interruptEnemy: true, isSwordChain: true },
      onNodeEffect: (node, outcome, transition) => {
        if (transition.message) this.setMessage(transition.message);
      }
    });

    this.setMessage(`追加攻击 — ${this.qteRunner.currentNodeName()}`);
  }

  // ========== 战技中断类 ==========

  interruptCastingAndDodge() {
    this.qteRunner = null;
    this.playerState.currentState = "idle";
    this.defenseTriggered = true;
    this.setMessage("施法中闪避！");
    this.startResolving(() => this.startPlayerTurn());
  }

  interruptCastingAndParry() {
    this.qteRunner = null;
    this.playerState.currentState = "idle";
    if (this.enemyAttack && (this.enemyAttack.allowedResponses || []).includes("parry")) {
      this.triggerDefenseQTE("parry");
    } else {
      this.setMessage("当前攻击无法弹反");
      this.startResolving(() => this.startPlayerTurn());
    }
  }

  interruptGuardAndDodge() {
    this.qteRunner = null;
    this.playerState.currentState = "idle";
    this.defenseTriggered = true;
    this.setMessage("格挡中闪避！");
    this.startResolving(() => this.startPlayerTurn());
  }

  canEasternGuardNeutralize(key) {
    if (key !== "F") return false;
    if (!this.hasCombatArt("eastern")) return false;
    if (!this.playerState.lastAttackTime) return false;

    const elapsed = Utils.now() - this.playerState.lastAttackTime;
    return elapsed >= 0 && elapsed <= CombatArtDatabase.eastern.attackGuardNeutralize;
  }

  triggerEasternGuardNeutralize() {
    const attackName = this.enemyAttack ? this.enemyAttack.name : "攻击";
    this.defenseTriggered = true;
    this.playerState.lastAttackTime = 0;
    this.playerState.currentState = "shield";
    this.spawnFloatingText(CombatArtDatabase.eastern.attackGuardMessage, 220, 300, "status");
    this.spawnParticles("guard", 220, 360, 1.4);
    this.flashScreen("#2ecc71", 0.18);
    this.setMessage(`${CombatArtDatabase.eastern.attackGuardMessage} ${attackName} 被化解`);
    this.log(`东方诸国剑术化解了 ${attackName}`);
    this.startResolving(() => this.startPlayerTurn());
  }

  // ========== QTE 完成结算 ==========

  onQTEComplete() {
    if (this.turnState === "game_over" || this.playerHp <= 0) return;

    const runner = this.qteRunner;
    if (!runner) return;

    const effects = runner.getAccumulatedEffects();
    const source = runner.context.source;

    if (source === "player") {
      this.resolvePlayerQTE(effects, runner.context);
    } else {
      this.resolveDefenseQTE(effects);
    }
  }

  resolvePlayerQTE(effects, context) {
    // 计算最终伤害
    let damage = effects.damage;

    // 护甲破坏增伤
    if (this.armorBreakActive) {
      damage = Math.floor(damage * 1.3);
    }

    // 烈火重重：剑对防御敌人增伤
    if (this.hasSpell("fire") && context && context.isSwordChain) {
      damage = Math.floor(damage * 1.5);
    }

    // 德斯洛：Perfect 暴击
    if (this.hasCombatArt("desslo") && effects.perfectHit) {
      damage = Math.floor(damage * 1.5);
    }

    // 东方：连续闪避后暴击
    const easternCrit = this.hasCombatArt("eastern") && this.playerState.consecutiveDodges >= CombatArtDatabase.eastern.consecutiveDodgeCrit;
    if (easternCrit) {
      damage = Math.floor(damage * 1.5);
      this.playerState.consecutiveDodges = 0;
    }

    // 是否暴击
    const isCrit = (this.hasCombatArt("desslo") && effects.perfectHit) || easternCrit;

    // 应用伤害
    if (damage > 0) {
      this.applyDamage("enemy", damage, { isCrit });
      if (isCrit) this.flashScreen("#f1c40f", 0.18);
    }

    // 烈火重重：累计破甲
    if (this.hasSpell("fire") && context && context.isSwordChain) {
      this.armorBreakHits++;
      if (this.armorBreakHits >= SpellDatabase.fire.armorBreakHits) {
        this.armorBreakHits = 0;
        this.armorBreakTurns = SpellDatabase.fire.armorBreakTurns;
        this.armorBreakActive = true;
        this.setMessage("敌人装甲被破坏！");
      }
    }

    // 荒芜之地：追加攻击打断
    if (context && context.followUp && context.interruptEnemy) {
      this.enemyStunTimer = Math.max(this.enemyStunTimer, 1.5);
      this.setMessage(CombatArtDatabase.desolo.followUpMessage);
    }

    // 咒还：剑攻击时吸收准备
    if (this.hasSpell("absorb") && context && context.isSwordChain) {
      this.playerState.absorbReady = true;
    }

    // 东方：出剑后格挡化解窗口
    if (this.hasCombatArt("eastern") && context && context.isSwordChain) {
      this.playerState.lastAttackTime = performance.now() / 1000;
    }

    if (this.enemyHp <= 0) {
      this.turnState = "game_over";
      this.setMessage("胜利！");
      return;
    }

    if (effects.selfStun > 0) {
      this.startResolving(() => this.startEnemyTurn());
      return;
    }

    if (effects.stunEnemy > 0) {
      this.enemyStunTimer = effects.stunEnemy;
      this.setMessage(`敌人眩晕 ${effects.stunEnemy.toFixed(1)} 秒，额外回合！`);
      this.startResolving(() => this.startPlayerTurn());
      return;
    }

    // 荒芜之地：攻击后触发追加攻击机会
    if (this.hasCombatArt("desolo") && context && context.isSwordChain && !context.followUp) {
      this.pendingFollowUp = true;
      this.setMessage("可追加攻击！按 A 发动");
      this.turnState = "player_turn";
      this.qteRunner = null;
      return;
    }

    this.startResolving(() => this.startEnemyTurn());
  }

  resolveDefenseQTE(effects) {
    const attack = this.enemyAttack;
    let finalDamage = 0;

    if (effects.iframe > 0) {
      finalDamage = 0;
      this.playerState.consecutiveDodges++;
    } else if (effects.damageMul !== undefined) {
      finalDamage = Math.floor(attack.damage * effects.damageMul);
      this.playerState.consecutiveDodges = 0;
    } else {
      this.playerState.consecutiveDodges = 0;
    }

    if (finalDamage > 0) {
      this.applyDamage("player", finalDamage);
      this.setMessage(`未能完全规避，受到 ${finalDamage} 伤害`);
      if (this.playerHp <= 0 || this.turnState === "game_over") return;
    } else if (effects.iframe > 0 || effects.damageMul === 0) {
      this.setMessage("完全规避！");
    }

    // 反击伤害
    if (effects.damage > 0) {
      let counterDamage = effects.damage;
      if (this.hasSpell("fire")) {
        counterDamage += SpellDatabase.fire.shieldThornDamage;
      }
      this.applyDamage("enemy", Math.floor(counterDamage));
    }

    // 咒还：吸收法术攻击
    if (this.hasSpell("absorb") && attack.id === "spellCast") {
      const absorbAmount = attack.damage * 2;
      this.addSpellEnergy(absorbAmount);
      this.setMessage(`咒还吸收！获得 ${Math.floor(absorbAmount)} 法术能量`);

      // 盾：完美格挡/弹反反射魔法
      if (effects.damageMul === 0) {
        const reflect = Math.floor(attack.damage * SpellDatabase.absorb.shieldReflectMul);
        if (reflect > 0) {
          this.applyDamage("enemy", reflect);
          this.setMessage(`咒还反射！敌人受到 ${reflect} 伤害`);
        }
        this.playerState.shieldEnchanted = true;
      }
    }

    if (this.enemyHp <= 0) {
      this.turnState = "game_over";
      this.setMessage("胜利！");
      return;
    }

    if (effects.stunEnemy > 0) {
      this.enemyStunTimer = effects.stunEnemy;
      this.startResolving(() => this.startPlayerTurn());
      return;
    }

    this.startResolving(() => this.startPlayerTurn());
  }

  // ========== 普通攻击与回合切换 ==========

  performNormalAttack() {
    const weapon = WeaponDatabase[this.playerConfig.weapon];
    if (!weapon) return;

    let damage = weapon.normalAttack || 10;

    // 护甲破坏增伤
    if (this.armorBreakActive) {
      damage = Math.floor(damage * 1.3);
    }

    // 东方：连续闪避后暴击
    if (this.hasCombatArt("eastern") && this.playerState.consecutiveDodges >= CombatArtDatabase.eastern.consecutiveDodgeCrit) {
      damage = Math.floor(damage * 1.5);
      this.playerState.consecutiveDodges = 0;
    }

    this.applyDamage("enemy", damage);
    this.setMessage(`${weapon.name} 普通攻击，造成 ${damage} 伤害`);

    if (this.enemyHp <= 0) {
      this.turnState = "game_over";
      this.setMessage("胜利！");
      return;
    }

    this.startResolving(() => this.startEnemyTurn());
  }

  startEnemyTurn() {
    this.turnState = "enemy_turn";
    this.showTurnBanner("敌方回合", "#e74c3c");
    this.actionBar = 0;
    this.defenseTriggered = false;
    this.pendingFollowUp = false;
    this.playerState.currentState = "idle";

    // 护甲破坏回合衰减
    if (this.armorBreakActive) {
      this.armorBreakTurns--;
      if (this.armorBreakTurns <= 0) {
        this.armorBreakActive = false;
      }
    }

    const attackIds = EnemyDatabase.base.attacks;
    const attackId = attackIds[Math.floor(Math.random() * attackIds.length)];
    this.enemyAttack = Difficulty.scaleAttack({ id: attackId, ...EnemyDatabase.attacks[attackId] });
    this.enemyAttackTimer = 0;
    this.enemyAttackPhase = "windup";

    this.setMessage(`敌人准备：${this.enemyAttack.name}`);
  }

  startPlayerTurn() {
    this.turnState = "player_turn";
    this.showTurnBanner("玩家回合", "#3498db");
    this.actionBar = 0;
    this.enemyAttack = null;
    this.enemyAttackPhase = "none";
    this.defenseTriggered = false;
    this.qteRunner = null;
    this.pendingFollowUp = false;
    this.playerState.currentState = "idle";

    const weapon = WeaponDatabase[this.playerConfig.weapon];
    const chains = this.getEffectiveChains();
    const chainNames = Object.entries(chains)
      .map(([key, chain]) => `[${key}]${chain.name}`)
      .join(" ");

    const spellNames = this.playerConfig.spells.map(id => SpellDatabase[id].name).join(",") || "无";
    const artNames = this.playerConfig.combatArts.map(id => CombatArtDatabase[id].name).join(",") || "无";

    this.setMessage(`${weapon.name} 就绪 — ${chainNames} / 咒术:${spellNames} / 战技:${artNames}`);
  }

  startResolving(callback) {
    if (this.turnState === "game_over") {
      return;
    }
    this.turnState = "resolving";
    this.resolveTimer = this.resolveDuration;
    this.resolveCallback = callback;
    this.qteRunner = null;
    this.playerState.currentState = "idle";
  }

  updateResolving(dt) {
    this.resolveTimer -= dt;
    if (this.resolveTimer <= 0) {
      this.resolveTimer = 0;
      if (this.resolveCallback) {
        const cb = this.resolveCallback;
        this.resolveCallback = null;
        cb();
      }
    }
  }

  addSpellEnergy(amount) {
    if (this.hasSpell("absorb")) {
      const maxOverflow = this.playerState.maxSpellEnergy * SpellDatabase.absorb.staffOverflowMul;
      this.playerState.spellEnergy = Math.min(this.playerState.spellEnergy + amount, maxOverflow);
    } else {
      this.playerState.spellEnergy = Math.min(this.playerState.spellEnergy + amount, this.playerState.maxSpellEnergy);
    }
  }

  tryAbsorbIncomingSpell(attack) {
    if (!attack || attack.id !== "spellCast") return false;
    if (!this.hasSpell("absorb")) return false;

    const absorb = SpellDatabase.absorb;
    const absorbStates = absorb.absorbStates || [];
    const stateCanAbsorb = absorbStates.includes(this.playerState.currentState);
    const preparedAbsorb = this.playerState.absorbReady || this.playerState.shieldEnchanted;
    const staffReflect = this.playerConfig.weapon === "staff" && absorb.staffBaseReflect;

    if (!stateCanAbsorb && !preparedAbsorb && !staffReflect) return false;

    const absorbAmount = attack.damage * 2;
    const reflect = Math.floor(attack.damage * absorb.shieldReflectMul);

    this.addSpellEnergy(absorbAmount);
    if (reflect > 0) {
      this.applyDamage("enemy", reflect);
    }

    this.playerState.absorbReady = false;
    this.playerState.shieldEnchanted = false;
    this.defenseTriggered = true;
    this.spawnFloatingText(`+${Math.floor(absorbAmount)} 能量`, 220, 300, "status");
    this.spawnParticles("magic", 220, 360, 1.2);
    this.flashScreen("#9b59b6", 0.2);

    if (this.enemyHp <= 0) {
      this.turnState = "game_over";
      this.setMessage("胜利！");
      return true;
    }

    this.setMessage(`咒还吸收 ${attack.name}，反射 ${reflect} 伤害`);
    this.log(`咒还吸收法术，获得 ${Math.floor(absorbAmount)} 能量`);
    this.startResolving(() => this.startPlayerTurn());
    return true;
  }

  // ========== 伤害与效果 ==========

  applyDamage(target, amount, options = {}) {
    if (amount <= 0) return;

    const px = 220;
    const py = 380;
    const ex = 740;
    const ey = 380;

    if (target === "player") {
      this.playerHp = Math.max(0, this.playerHp - amount);
      this.screenShake = 0.25;
      this.hitStop = 0.12;
      this.floatingTexts.add(`-${amount}`, px, py - 40, "damage");
      this.spawnParticles("hit", px, py, 1);
      this.flashScreen("#e74c3c", 0.15);
      this.log(`玩家受到 ${amount} 伤害`);
      if (this.playerHp <= 0) {
        this.turnState = "game_over";
        this.setMessage("战败…");
      }
    } else {
      this.enemyHp = Math.max(0, this.enemyHp - amount);
      this.screenShake = options.isCrit ? 0.25 : 0.15;
      this.hitStop = options.isCrit ? 0.12 : 0.08;
      const textType = options.isCrit ? "crit" : "damage";
      this.floatingTexts.add(`-${amount}`, ex, ey - 40, textType);
      this.spawnParticles(options.isCrit ? "slash" : "hit", ex, ey, options.isCrit ? 1.5 : 1);
      this.log(`敌人受到 ${amount} ${options.isCrit ? "暴击" : ""}伤害`);
    }
  }

  // ========== 辅助方法 ==========

  hasSpell(id) {
    return this.playerConfig.spells.includes(id);
  }

  hasCombatArt(id) {
    return this.playerConfig.combatArts.includes(id);
  }

  hasAttackAnytime() {
    return this.playerConfig.combatArts.some(id => CombatArtDatabase[id].attackAnytime);
  }

  isSwordChain(chainKey) {
    const weapon = this.playerConfig.weapon;
    if (!weapon) return false;
    // 大剑和双刀的攻击链视为剑攻击
    return (weapon === "greatsword" || weapon === "dualBlades") && ["A", "S", "D"].includes(chainKey);
  }

  triggerDefenseQTE(defenseId, triggerTime) {
    let defense = DefenseDatabase[defenseId];
    if (!defense) return;

    // 东方剑术：格挡窗口额外放宽
    if (this.hasCombatArt("eastern")) {
      defense = JSON.parse(JSON.stringify(defense));
      for (const node of defense.nodes) {
        if (node.window) {
          node.window = {
            start: Math.max(0, node.window.start - CombatArtDatabase.eastern.guardWindowBonus),
            end: node.window.end + CombatArtDatabase.eastern.guardWindowBonus
          };
        }
      }
    }

    this.playerState.currentState = "shield";
    this.turnState = "qte_running";
    this.qteRunner = new QTEChainRunner(Difficulty.scaleChain(defense), {
      source: "enemy",
      onNodeEffect: (node, outcome, transition) => {
        if (transition.message) this.setMessage(transition.message);
      }
    });

    // 修复：按一次按键即可触发 press 型防御（闪避/弹反），并根据按下时机判定结果
    const firstNode = this.qteRunner.currentNode();
    if (firstNode && firstNode.input.type === "press" && triggerTime !== undefined) {
      const outcome = this.computeDefenseOutcome(triggerTime);
      this.qteRunner.resolveNode(outcome);
    } else {
      this.setMessage(`${defense.name} — ${this.qteRunner.currentNodeName()}`);
    }
  }

  computeDefenseOutcome(triggerTime) {
    const attack = this.enemyAttack;
    if (!attack) return "success";

    const responseStart = Math.max(0, attack.windup - Difficulty.responseDuration());
    const hitTime = attack.windup + attack.hitTime;
    const remaining = hitTime - triggerTime;

    // 按得太急（刚进入反应窗口就按）=> 过早，会落入 onFail
    if (triggerTime < responseStart + 0.08) return "early";
    // 按得太晚（攻击已命中）=> 过晚，会落入 onFail
    if (remaining < 0) return "late";
    // 在命中前 0.18 秒内按下 => 完美
    if (remaining <= 0.18) return "perfect";
    // 其他情况 => 成功
    return "success";
  }

  setMessage(text) {
    this.message = text;
    this.messageTimer = 0;
  }

  log(text) {
    this.logs.unshift({ text, time: performance.now() });
    if (this.logs.length > 30) this.logs.pop();
    if (this.onLog) this.onLog(text);
  }

  spawnFloatingText(value, x, y, type) {
    this.floatingTexts.add(value, x, y, type);
  }

  spawnParticles(type, x, y, intensity) {
    this.particles.emit(type, x, y, intensity);
  }

  shakeScreen(amount) {
    this.screenShake = amount;
  }

  flashScreen(color, duration) {
    this.screenFlash = { color, timer: duration, maxTime: duration };
  }

  showTurnBanner(text, color = "#f1c40f") {
    this.turnBanner = { text, color, timer: 1.2, maxTime: 1.2 };
  }
}
