class BattleSystem {
  constructor(input, options = {}) {
    this.input = input;
    this.practiceMode = options.practiceMode || false;

    // 基础属性
    this.playerMaxHp = 100;
    this.playerHp = this.playerMaxHp;
    this.enemyId = "base";
    this.enemyConfig = EnemyDatabase.base;
    this.enemyMaxHp = this.enemyConfig.maxHp;
    this.enemyHp = this.enemyMaxHp;
    this.encounterSelection = this.resolveEncounterSelection(options.encounterId || options.enemyId);
    this.enemyOverrideId = this.encounterSelection.enemyId;
    this.encounterOverrideId = this.encounterSelection.encounterId;
    this.activeEncounterId = null;
    this.encounterConfig = null;
    this.enemyAttackCursor = 0;

    // 回合/阶段状态
    this._turnState = "select_weapon"; // select_weapon | player_turn | enemy_turn | qte_running | resolving | game_over
    this.actionBarMax = 5.0;
    this.actionBar = 0;

    // 玩家配置（开局选择）
    this.playerConfig = {
      style: null,     // 选择的战斗风格（替代旧武器）
      weapon: null,
      spells: [],
      combatArts: []
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
    this.message = `按 1-7 选择战斗风格｜遭遇：${this.getEnemySelectionLabel()}`;
    this.messageTimer = 0;
    this.flashMessage = null;

    // 视觉
    this.screenShake = 0;
    this.hitStop = 0;
    this.timeScale = 1;
    this.timeScaleTimer = 0;
    this.cameraZoom = 1;
    this.cameraZoomTimer = 0;
    this.impactFrames = 0;
    this.chargeFxTimer = 0;

    // 连击
    this.comboCount = 0;
    this.comboTimer = 0;

    // 战斗统计
    this.battleStats = {
      damageDealt: 0,
      maxCombo: 0,
      perfectCount: 0,
      hitsTaken: 0,
      attempts: 0,
      hits: 0,
      misses: 0
    };

    // 特效
    this.particles = new ParticleSystem();
    this.effectBursts = new EffectBurstSystem();
    this.actorReactions = new ActorReactionSystem();
    this.floatingTexts = new FloatingTextManager();
    this.effectQueue = new EffectEventQueue(this, { mode: "battle" });
    this.statusSystem = new StatusSystem(this);
    this.resourceSystem = new ResourceSystem(this);
    this.turnBanner = null;
    this.screenFlash = null;

    // 日志
    this.logs = [];
    this.onLog = null;
  }

  get turnState() {
    return this._turnState;
  }

  setTurnState(newState) {
    if (this._turnState === newState) return;
    const oldState = this._turnState;
    this.onTurnExit(oldState);
    this._turnState = newState;
    this.onTurnEnter(newState);
  }

  onTurnExit(state) {
    // 未来可在此清理旧状态的动画/音效
  }

  onTurnEnter(state) {
    // 进入新状态时的统一处理
    if (state === "player_turn") {
      SFX.sfxStatus();
    } else if (state === "enemy_turn") {
      SFX.sfxAlert();
    }
  }

  // ========== 核心更新 ==========

  update(dt) {
    if (this.effectQueue) this.effectQueue.update(dt);

    if (this.hitStop > 0) {
      this.hitStop -= dt;
      if (this.hitStop < 0) this.hitStop = 0;
      return;
    }

    if (this.timeScaleTimer > 0) {
      this.timeScaleTimer -= dt;
      if (this.timeScaleTimer <= 0) this.timeScale = 1;
    }

    if (this.cameraZoomTimer > 0) {
      this.cameraZoomTimer -= dt;
      if (this.cameraZoomTimer <= 0) this.cameraZoom = 1;
    }

    if (this.impactFrames > 0) {
      this.impactFrames--;
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.resetCombo();
    }

    dt *= this.timeScale;

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
    if (this.effectBursts) this.effectBursts.update(dt);
    if (this.actorReactions) this.actorReactions.update(dt);
    this.floatingTexts.update(dt);

    switch (this.turnState) {
      case "select_weapon":
        this.updateWeaponSelect();
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
    this.consumeStyleSelectionInputs();
  }

  resolveEncounterSelection(selectionId) {
    const selection = String(selectionId || "auto");
    if (!selection || selection === "auto") {
      return { encounterId: null, enemyId: null };
    }

    const encounterDb = (typeof EncounterDatabase !== "undefined" && EncounterDatabase.encounters)
      ? EncounterDatabase.encounters
      : {};
    if (selection.startsWith("encounter:")) {
      const encounterId = selection.slice("encounter:".length);
      return encounterDb[encounterId]
        ? { encounterId, enemyId: null }
        : { encounterId: null, enemyId: null };
    }
    if (encounterDb[selection]) {
      return { encounterId: selection, enemyId: null };
    }

    const enemyId = selection.startsWith("enemy:")
      ? selection.slice("enemy:".length)
      : selection;
    if (enemyId === "base" || (EnemyDatabase.archetypes && EnemyDatabase.archetypes[enemyId])) {
      return { encounterId: null, enemyId };
    }
    return { encounterId: null, enemyId: null };
  }

  resolveEnemyOverride(enemyId) {
    return this.resolveEncounterSelection(enemyId).enemyId;
  }

  getEnemyArchetype(enemyId) {
    if (enemyId === "base") {
      return (EnemyDatabase.archetypes && EnemyDatabase.archetypes.base) || EnemyDatabase.base;
    }
    return (EnemyDatabase.archetypes && EnemyDatabase.archetypes[enemyId]) || EnemyDatabase.base;
  }

  getEncounter(encounterId) {
    if (typeof EncounterDatabase === "undefined" || !EncounterDatabase.encounters) return null;
    return EncounterDatabase.encounters[encounterId] || null;
  }

  getEnemySelectionLabel() {
    if (this.encounterOverrideId) {
      const encounter = this.getEncounter(this.encounterOverrideId);
      return `遭遇：${encounter ? encounter.name : this.encounterOverrideId}`;
    }
    if (!this.enemyOverrideId) return "自动推荐";
    const enemy = this.getEnemyArchetype(this.enemyOverrideId);
    return `敌人测试：${enemy.name}`;
  }

  consumeStyleSelectionInputs() {
    while (true) {
      const ev = this.input.peek();
      if (!ev) return;

      if (ev.type !== "press") {
        this.input.consume();
        continue;
      }

      const key = ev.key.toUpperCase();

      for (const [id, style] of Object.entries(StyleDatabase)) {
        if (style.key === key) {
          this.input.consume();
          this.applyStyle(id);
          this.startPlayerTurn();
          return;
        }
      }

      // 未匹配的按键丢弃
      this.input.consume();
    }
  }

  applyStyle(styleId) {
    const style = StyleDatabase[styleId];
    if (!style) return;
    this.playerConfig.style = styleId;
    this.playerConfig.weapon = style.weapon || null;
    this.playerConfig.spells = style.spells ? [...style.spells] : [];
    this.playerConfig.combatArts = style.combatArts ? [...style.combatArts] : [];
    const encounterId = this.encounterOverrideId || (!this.enemyOverrideId ? style.preferredEncounter : null);
    if (encounterId && this.applyEncounter(encounterId)) {
      const encounterMode = this.encounterOverrideId ? "指定遭遇" : "推荐遭遇";
      this.log(`战斗风格：${style.name}；${encounterMode}：${this.encounterConfig.name}`);
      this.log(`地形：${this.encounterConfig.terrain}；规则：${(this.encounterConfig.ruleLines || [this.encounterConfig.intent])[0]}`);
      return;
    }

    const enemyId = this.enemyOverrideId || style.preferredEnemy || "base";
    this.applyEnemyArchetype(enemyId);
    const enemyMode = this.enemyOverrideId ? "手动敌人测试" : "推荐敌人";
    this.log(`战斗风格：${style.name}；${enemyMode}：${this.enemyConfig.name}`);
  }

  applyEnemyArchetype(enemyId, options = {}) {
    const enemy = this.getEnemyArchetype(enemyId);
    this.enemyId = enemy === EnemyDatabase.base && enemyId !== "base" ? "base" : enemyId;
    this.enemyConfig = enemy;
    this.enemyMaxHp = enemy.maxHp || EnemyDatabase.base.maxHp;
    this.enemyHp = this.enemyMaxHp;
    this.enemyAttack = null;
    this.enemyAttackPhase = "none";
    this.enemyStunTimer = 0;
    this.enemyAttackCursor = 0;
    if (!options.fromEncounter) {
      this.activeEncounterId = null;
      this.encounterConfig = null;
    }
  }

  applyEncounter(encounterId) {
    const encounter = this.getEncounter(encounterId);
    if (!encounter) return false;

    this.activeEncounterId = encounterId;
    this.encounterConfig = encounter;
    this.applyEnemyArchetype(encounter.enemyId || "base", { fromEncounter: true });

    if (encounter.maxHp) {
      this.enemyMaxHp = encounter.maxHp;
      this.enemyHp = this.enemyMaxHp;
    }

    this.applyEncounterOpeningRules();
    return true;
  }

  getEncounterModifiers() {
    return (this.encounterConfig && this.encounterConfig.modifiers) || {};
  }

  applyEncounterOpeningRules() {
    const mods = this.getEncounterModifiers();
    const results = [];
    if (mods.startSpellEnergy) {
      results.push(this.resourceSystem.add("spellEnergy", mods.startSpellEnergy));
    }
    if (mods.startHeat) {
      results.push(this.resourceSystem.add("heat", mods.startHeat));
    }
    if (results.length > 0) {
      this.applyResourceResults(results);
    }
  }

  getEncounterSummaryLines(limit = 3) {
    const encounter = this.encounterConfig || this.getEncounter(this.encounterOverrideId);
    if (!encounter) {
      return ["自动推荐会按风格匹配命名遭遇。"];
    }
    const lines = [
      `${encounter.name} / ${encounter.terrain}`,
      encounter.intent
    ];
    return lines.concat(encounter.ruleLines || []).slice(0, limit);
  }

  getEncounterDebugLines(limit = 5) {
    if (!this.encounterConfig) return [];
    return [
      `遭遇：${this.encounterConfig.name}`,
      `地形：${this.encounterConfig.terrain}`,
      ...((this.encounterConfig.ruleLines || []).slice(0, Math.max(0, limit - 2)))
    ];
  }

  applyEncounterDamageModifiers(damage, context = {}) {
    if (damage <= 0 || !this.encounterConfig) return damage;
    const mods = this.getEncounterModifiers();
    let nextDamage = damage;
    const labels = [];

    const applyMul = (mul, label) => {
      if (!mul || mul === 1) return;
      nextDamage = Math.floor(nextDamage * mul);
      labels.push(label);
    };

    if (context.chainFamily === "fire") applyMul(mods.fireDamageMul, "遭遇·火焰");
    if (context.chainFamily === "absorb") applyMul(mods.absorbDamageMul, "遭遇·咒还");
    if (context.isSwordChain) applyMul(mods.swordDamageMul, "遭遇·武器链");
    if (context.normalAttack) applyMul(mods.normalDamageMul, "遭遇·普攻");

    const armorBreakStatus = this.statusSystem && this.statusSystem.has("armorBreak", "enemy");
    if (this.armorBreakActive || armorBreakStatus) {
      applyMul(mods.armorBreakDamageMul, "遭遇·破甲");
    }

    if (labels.length > 0 && nextDamage > damage) {
      this.spawnFloatingText(`+${Math.round((nextDamage / damage - 1) * 100)}% ${labels[labels.length - 1]}`, 740, 180, "status");
      this.log(`${this.encounterConfig.name}规则触发：${labels.join(" / ")}`);
    }
    return nextDamage;
  }

  isIncomingSpellAttack(attack) {
    if (!attack) return false;
    const id = attack.id || "";
    return !!attack.interruptible || id.includes("spell") || id.includes("arcane") || id.includes("curse");
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

    this.applyResourceResults(this.resourceSystem.update(dt));
    if (this.playerHp <= 0) {
      this.setTurnState("game_over");
      this.setMessage("法术能量反噬…");
      return;
    }

    this.actionBar += dt;
    if (this.actionBar >= this.actionBarMax) {
      this.actionBar = this.actionBarMax;
      // 追加窗口超时未响应，自动执行普攻并打断连击
      if (this.pendingFollowUp) {
        this.pendingFollowUp = false;
        this.resetCombo();
        this.setMessage("追加机会已错过");
      }
      this.performNormalAttack();
    }
  }

  // ========== 敌方回合 ==========

  updateEnemyTurn(dt) {
    if (!this.enemyAttack) return;

    const attack = this.enemyAttack;
    this.enemyAttackTimer += dt;

    const responseDuration = attack.responseDuration || Difficulty.responseDuration();
    const responseStart = Math.max(0, attack.windup - responseDuration);

    if (this.enemyAttackPhase === "windup" && this.enemyAttackTimer >= responseStart) {
      this.enemyAttackPhase = "response";
      this.input.clear(); // 丢弃窗口期前的过早按键
      this.setMessage("敌方攻击：绿色窗口按 SPACE/F 防御");
      SFX.sfxWindup();
      if (SFX.sfxWindowOpen) SFX.sfxWindowOpen();
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
      if (this.checkEnemyDefeated()) return;
      if (this.turnState === "game_over") return;
      this.setMessage(SpellDatabase.fire.shieldThornMessage);
    }

    const died = this.applyDamage("player", damage);
    if (died || this.turnState === "game_over") return;
    this.setMessage("被击中");
    this.startResolving(() => this.startPlayerTurn());
  }

  // ========== QTE 运行 ==========

  updateQTE(dt) {
    if (!this.qteRunner) {
      this.setTurnState("resolving");
      return;
    }

    // 战技：施法/持盾时闪避，可能直接中断当前 QTE
    this.consumeQTECombatArtInputs();
    if (!this.qteRunner || this.turnState !== "qte_running") {
      return;
    }

    this.qteRunner.update(dt);
    this.updateChargeEffects(dt);

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

      // 荒芜之地：追加攻击窗口独占
      if (this.pendingFollowUp) {
        if (key === "A") {
          this.input.consume();
          this.triggerFollowUpQTE();
          return;
        }
        // 追加窗口期间只响应 A，其他链式按键吞掉并提示
        this.input.consume();
        this.setMessage("按 A 追加");
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
    return Utils.getEffectiveChains(this.playerConfig);
  }

  getQTEStageMessage(chainConfig) {
    const firstNode = chainConfig.nodes && chainConfig.nodes[0];
    const type = firstNode && firstNode.input && firstNode.input.type;
    const stage =
      type === "hold_release" ? "按住蓄力" :
      type === "rhythm" ? "节奏连击" :
      "精准按键";
    return `${chainConfig.name} · ${stage}`;
  }

  triggerWeaponQTE(chainKey) {
    const chains = this.getEffectiveChains();
    const chainId = chains[chainKey];
    if (!chainId) return;
    const chainConfig = ChainDatabase[chainId];
    if (!chainConfig) return;
    if (!this.canPayChainCost(chainConfig)) return;

    const chainState = this.getChainState(chainKey, chainConfig);
    this.playerState.currentState = chainState;
    if (chainState === "casting") {
      SFX.sfxMagic();
    }

    this.setTurnState("qte_running");
    this.input.clear();
    this.qteRunner = new QTEChainRunner(Difficulty.scaleChain(chainId), {
      source: "player",
      chainId,
      chainFamily: chainConfig.family,
      isSwordChain: this.isSwordChain(chainKey),
      handfeel: Utils.getChainHandfeel(chainConfig, { chainId, source: "player" }),
      onNodeEffect: (node, outcome, transition) => {
        if (node.input.type === "hold_release" || node.input.type === "rhythm") {
          this.playerState.currentState = "charge";
          SFX.sfxCharge();
        }
        if (transition.message) this.setMessage(transition.message);
        this.showOutcomeFeedback(outcome);
        this.emitTransitionVisual(transition);
      },
      onRhythmHit: (idx, diff) => {
        this.setMessage(`节拍 ${idx + 1} 命中`);
        SFX.sfxSuccess();
      },
      onRhythmMiss: (idx) => {
        this.setMessage(idx >= 0 ? `节拍 ${idx + 1} 没踩准` : "按错键了");
        SFX.sfxFail();
      }
    });

    this.setMessage(this.getQTEStageMessage(chainConfig));
  }

  triggerCounterAttack(chainKey) {
    const chains = this.getEffectiveChains();
    const chainId = chains[chainKey];
    if (!chainId) return;
    const chainConfig = ChainDatabase[chainId];
    if (!chainConfig) return;
    if (!this.canPayChainCost(chainConfig)) return;

    this.defenseTriggered = true;
    this.playerState.currentState = this.getChainState(chainKey, chainConfig);
    if (this.playerState.currentState === "casting") SFX.sfxMagic();
    else SFX.sfxCounter();
    this.setTurnState("qte_running");
    this.input.clear();
    this.qteRunner = new QTEChainRunner(Difficulty.scaleChain(chainId), {
      source: "player",
      chainId,
      chainFamily: chainConfig.family,
      counterAttack: true,
      isSwordChain: true,
      handfeel: Utils.getChainHandfeel(chainConfig, { chainId, source: "player", counterAttack: true }),
      onNodeEffect: (node, outcome, transition) => {
        if (transition.message) this.setMessage(transition.message);
        this.showOutcomeFeedback(outcome);
      },
      onRhythmHit: (idx, diff) => {
        this.setMessage(`节拍 ${idx + 1} 命中`);
        SFX.sfxSuccess();
      },
      onRhythmMiss: (idx) => {
        this.setMessage(idx >= 0 ? `节拍 ${idx + 1} 没踩准` : "按错键了");
        SFX.sfxFail();
      }
    });

    this.setMessage(`反击 · ${this.getQTEStageMessage(chainConfig)}`);
  }

  triggerFollowUpQTE() {
    const chains = this.getEffectiveChains();
    const chainId = chains["followUp"];
    if (!chainId) return;
    const chainConfig = ChainDatabase[chainId];
    if (chainConfig && !this.canPayChainCost(chainConfig)) return;

    this.pendingFollowUp = false;
    this.defenseTriggered = true;
    this.playerState.currentState = "swordAttack";
    SFX.sfxCounter();
    this.setTurnState("qte_running");
    this.input.clear();
    this.qteRunner = new QTEChainRunner(Difficulty.scaleChain(chainId), {
      source: "player",
      chainId,
      chainFamily: chainConfig ? chainConfig.family : null,
      followUp: true,
      interruptEnemy: true,
      isSwordChain: true,
      handfeel: Utils.getChainHandfeel(chainConfig, { chainId, source: "player", followUp: true }),
      onNodeEffect: (node, outcome, transition) => {
        if (transition.message) this.setMessage(transition.message);
        this.showOutcomeFeedback(outcome);
      }
    });

    this.setMessage(`追加攻击 · ${chainConfig ? this.getQTEStageMessage(chainConfig) : "精准按键"}`);
  }

  // ========== 战技中断类 ==========

  interruptCastingAndDodge() {
    this.qteRunner = null;
    this.playerState.currentState = "idle";
    this.defenseTriggered = true;
    this.input.clear();
    SFX.sfxDodge();
    this.setMessage("施法中闪避！");
    this.startResolving(() => this.startPlayerTurn());
  }

  interruptCastingAndParry() {
    this.qteRunner = null;
    this.playerState.currentState = "idle";
    this.input.clear();
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
    this.input.clear();
    SFX.sfxDodge();
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
    this.setMessage("攻击被化解");
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

    // 连击增伤
    if (damage > 0) {
      const comboMul = this.getComboDamageMultiplier();
      if (comboMul > 1) {
        damage = Math.floor(damage * comboMul);
        this.spawnFloatingText(`+${Math.round((comboMul - 1) * 100)}% 连击`, 740, 300, "status");
      }
    }

    // 护甲破坏增伤
    const armorBreakStatus = this.statusSystem && this.statusSystem.has("armorBreak", "enemy");
    if (this.armorBreakActive || armorBreakStatus) {
      const statusMul = this.statusSystem
        ? (this.statusSystem.getDefinition("armorBreak").damageTakenMul || 1 + SpellDatabase.fire.armorBreakDamageBonus)
        : (1 + SpellDatabase.fire.armorBreakDamageBonus);
      damage = Math.floor(damage * statusMul);
      if (damage > 0) {
        const bonusLabel = `+${Math.round((statusMul - 1) * 100)}% 破甲`;
        this.spawnFloatingText(bonusLabel, 740, 235, "status");
        if (context && (context.chainFamily === "fire" || context.chainFamily === "absorb")) {
          this.spawnFloatingText("武器×咒术协同", 740, 205, "status");
          this.log(`破甲协同触发：${context.chainFamily === "fire" ? "火焰" : "咒还"}链获得增伤`);
        }
      }
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

    if (context && context.chainFamily === "fire" && this.resourceSystem) {
      const heatMul = this.resourceSystem.getHeatDamageMultiplier();
      if (heatMul > 1.01) {
        damage = Math.floor(damage * heatMul);
        this.spawnFloatingText(`+${Math.round((heatMul - 1) * 100)}% 热量`, 740, 260, "status");
      }
    }

    damage = this.applyEncounterDamageModifiers(damage, context || {});

    // 是否暴击
    const isCrit = (this.hasCombatArt("desslo") && effects.perfectHit) || easternCrit;

    // 应用伤害
    if (damage > 0) {
      this.applyDamage("enemy", damage, { isCrit });
      if (isCrit) this.flashScreen("#f1c40f", 0.18);
    }

    ChainEffectSystem.applyResources(this, effects, { playerY: 300 });
    ChainEffectSystem.applyStatuses(this, effects, { source: "qte", playerY: 260, enemyY: 280 });

    // 烈火重重：累计破甲
    if (this.hasSpell("fire") && context && context.isSwordChain) {
      this.armorBreakHits++;
      if (this.armorBreakHits >= SpellDatabase.fire.armorBreakHits) {
        this.armorBreakHits = 0;
        this.armorBreakTurns = SpellDatabase.fire.armorBreakTurns;
        this.armorBreakActive = true;
        this.applyStatusResults([this.statusSystem.apply({ target: "enemy", type: "armorBreak", turns: SpellDatabase.fire.armorBreakTurns }, { source: "fire" })].filter(Boolean));
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
      this.applyStatusResults([this.statusSystem.apply({ target: "player", type: "absorbReady", turns: 1 }, { source: "absorb" })].filter(Boolean));
    }

    // 东方：出剑后格挡化解窗口
    if (this.hasCombatArt("eastern") && context && context.isSwordChain) {
      this.playerState.lastAttackTime = performance.now() / 1000;
    }

    if (this.checkEnemyDefeated()) return;

    if (effects.selfStun > 0) {
      this.startResolving(() => this.startEnemyTurn());
      return;
    }

    if (effects.stunEnemy > 0) {
      this.enemyStunTimer = effects.stunEnemy;
    }

    if (effects.openPlayerTurn) {
      this.setMessage("破绽打开 · 额外回合");
      this.startResolving(() => this.startPlayerTurn());
      return;
    }

    if (effects.stunEnemy > 0) {
      this.setMessage("敌人眩晕 · 额外回合");
      this.startResolving(() => this.startPlayerTurn());
      return;
    }

    // 荒芜之地：攻击后触发追加攻击机会
    if (this.hasCombatArt("desolo") && context && context.isSwordChain && !context.followUp) {
      this.pendingFollowUp = true;
      this.actionBar = 0;
      this.setMessage("按 A 追加");
      this.setTurnState("player_turn");
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
      const died = this.applyDamage("player", finalDamage);
      if (!died) this.setMessage("未完全规避");
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

    ChainEffectSystem.applyResources(this, effects, { playerY: 300 });
    ChainEffectSystem.applyStatuses(this, effects, { source: "defense", playerY: 260, enemyY: 280 });

    // 咒还：吸收法术攻击
    const defenseProvidedEnergy = effects.resources && effects.resources.spellEnergy;
    if (this.hasSpell("absorb") && this.isIncomingSpellAttack(attack) && !defenseProvidedEnergy) {
      const mods = this.getEncounterModifiers();
      const absorbAmount = Math.floor(attack.damage * 2 * (mods.absorbEnergyMul || 1));
      this.addSpellEnergy(absorbAmount);
      this.setMessage("咒还吸收");

      // 盾：完美格挡/弹反反射魔法
      if (effects.damageMul === 0) {
        const reflect = Math.floor(attack.damage * SpellDatabase.absorb.shieldReflectMul * (mods.absorbReflectMul || 1));
        if (reflect > 0) {
          this.applyDamage("enemy", reflect);
          this.setMessage("咒还反射");
        }
        this.playerState.shieldEnchanted = true;
      }
    }

    if (this.checkEnemyDefeated()) return;

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

    // 连击增伤
    const comboMul = this.getComboDamageMultiplier();
    if (comboMul > 1) {
      damage = Math.floor(damage * comboMul);
      this.spawnFloatingText(`+${Math.round((comboMul - 1) * 100)}% 连击`, 740, 300, "status");
    }

    // 护甲破坏增伤
    const armorBreakStatus = this.statusSystem && this.statusSystem.has("armorBreak", "enemy");
    if (this.armorBreakActive || armorBreakStatus) {
      const statusMul = this.statusSystem
        ? (this.statusSystem.getDefinition("armorBreak").damageTakenMul || 1 + SpellDatabase.fire.armorBreakDamageBonus)
        : (1 + SpellDatabase.fire.armorBreakDamageBonus);
      damage = Math.floor(damage * statusMul);
    }

    // 东方：连续闪避后暴击
    if (this.hasCombatArt("eastern") && this.playerState.consecutiveDodges >= CombatArtDatabase.eastern.consecutiveDodgeCrit) {
      damage = Math.floor(damage * 1.5);
      this.playerState.consecutiveDodges = 0;
    }

    damage = this.applyEncounterDamageModifiers(damage, { normalAttack: true, isSwordChain: true });

    this.applyDamage("enemy", damage);
    this.setMessage("普通攻击");

    if (this.checkEnemyDefeated()) return;

    this.startResolving(() => this.startEnemyTurn());
  }

  startEnemyTurn() {
    this.tickStatuses("enemy");
    if (this.checkEnemyDefeated()) return;

    // 眩晕跳过敌方回合
    if (this.enemyStunTimer > 0) {
      this.enemyStunTimer = 0;
      this.showTurnBanner("敌方眩晕 · 跳过回合", "#9b59b6");
      this.setMessage("敌人眩晕，额外回合");
      this.input.clear();
      this.startResolving(() => this.startPlayerTurn());
      return;
    }

    this.setTurnState("enemy_turn");
    this.showTurnBanner("敌方回合", "#e74c3c");
    this.actionBar = 0;
    this.defenseTriggered = false;
    this.resetCombo();
    this.pendingFollowUp = false;
    this.playerState.currentState = "idle";
    this.input.clear();

    // 护甲破坏回合衰减
    if (this.armorBreakActive) {
      this.armorBreakTurns--;
      if (this.armorBreakTurns <= 0) {
        this.armorBreakActive = false;
      }
    }

    const attackId = this.pickEnemyAttackId();
    this.enemyAttack = this.buildEnemyAttack(attackId);
    const allowed = this.enemyAttack.allowedResponses || [];
    const keys = [];
    if (allowed.includes("dodge") || allowed.includes("parry")) keys.push("SPACE");
    if (allowed.includes("guard")) keys.push("F");
    this.enemyAttack.responseKey = keys.join(" / ") || "SPACE";
    this.enemyAttackTimer = 0;
    this.enemyAttackPhase = "windup";

    this.setMessage(`敌方回合：绿色窗口出现按 SPACE/F 防御`);
  }

  pickEnemyAttackId() {
    const encounterPattern = this.encounterConfig && this.encounterConfig.attackPattern;
    if (Array.isArray(encounterPattern) && encounterPattern.length > 0) {
      const attackId = encounterPattern[this.enemyAttackCursor % encounterPattern.length];
      this.enemyAttackCursor++;
      if (EnemyDatabase.attacks[attackId]) return attackId;
    }

    const attackIds = (this.enemyConfig && this.enemyConfig.attacks) || EnemyDatabase.base.attacks;
    return attackIds[Math.floor(Math.random() * attackIds.length)];
  }

  buildEnemyAttack(attackId) {
    const source = EnemyDatabase.attacks[attackId] || EnemyDatabase.attacks.thrust;
    const attack = Difficulty.scaleAttack({ id: attackId, ...source });
    const mods = this.getEncounterModifiers();
    if (mods.enemyDamageMul && attack.damage !== undefined) {
      attack.damage = Math.max(1, Math.floor(attack.damage * mods.enemyDamageMul));
    }
    if (mods.enemyWindupMul) {
      attack.windup *= mods.enemyWindupMul;
      attack.hitTime *= mods.enemyWindupMul;
    }
    attack.responseDuration = Difficulty.responseDuration() * (mods.responseWindowMul || 1);
    return attack;
  }

  startPlayerTurn() {
    this.setTurnState("player_turn");
    this.showTurnBanner("玩家回合", "#3498db");
    this.tickStatuses("player");
    if (this.playerHp <= 0 || this.turnState === "game_over") return;

    this.actionBar = 0;
    // 连击由超时或受击重置，额外回合保留
    this.enemyAttack = null;
    this.enemyAttackPhase = "none";
    this.defenseTriggered = false;
    this.qteRunner = null;
    this.pendingFollowUp = false;
    this.playerState.currentState = "idle";
    this.input.clear();

    const weapon = WeaponDatabase[this.playerConfig.weapon];
    const chains = this.getEffectiveChains();
    const chainNames = Object.entries(chains)
      .filter(([key]) => key !== "followUp")
      .map(([key, chainId]) => `[${key}]${ChainDatabase[chainId].name}`)
      .join(" ");

    this.setMessage(`玩家回合：${chainNames}`);
  }

  startResolving(callback) {
    if (this.turnState === "game_over") {
      return;
    }
    this.setTurnState("resolving");
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
    return this.resourceSystem.add("spellEnergy", amount);
  }

  tryAbsorbIncomingSpell(attack) {
    if (!this.isIncomingSpellAttack(attack)) return false;
    if (!this.hasSpell("absorb")) return false;

    const absorb = SpellDatabase.absorb;
    const absorbStates = absorb.absorbStates || [];
    const stateCanAbsorb = absorbStates.includes(this.playerState.currentState);
    const preparedAbsorb = this.playerState.absorbReady || this.playerState.shieldEnchanted;
    const staffReflect = this.playerConfig.weapon === "staff" && absorb.staffBaseReflect;

    if (!stateCanAbsorb && !preparedAbsorb && !staffReflect) return false;

    const mods = this.getEncounterModifiers();
    const absorbAmount = Math.floor(attack.damage * 2 * (mods.absorbEnergyMul || 1));
    const reflect = Math.floor(attack.damage * absorb.shieldReflectMul * (mods.absorbReflectMul || 1));

    const resourceResult = this.addSpellEnergy(absorbAmount);
    if (reflect > 0) {
      this.applyDamage("enemy", reflect);
    }

    this.playerState.absorbReady = false;
    this.playerState.shieldEnchanted = false;
    this.statusSystem.remove("absorbReady", "player");
    this.statusSystem.remove("shieldEnchant", "player");
    this.defenseTriggered = true;
    this.spawnFloatingText(`+${Math.floor(resourceResult.applied)} 能量`, 220, 300, "status");
    this.effectQueue.emit({ type: "particles", preset: "magic", anchor: "playerCore", intensity: 1.2, label: "absorbSpell" });
    this.flashScreen("#9b59b6", 0.2);
    SFX.sfxMagic();

    if (this.checkEnemyDefeated()) return true;

    this.setMessage("咒还反射");
    this.log(`咒还吸收法术，获得 ${Math.floor(resourceResult.applied)} 能量`);
    this.startResolving(() => this.startPlayerTurn());
    return true;
  }

  // ========== 伤害与效果 ==========

  applyResourceResults(results) {
    ChainEffectSystem.applyResourceUpdateResults(this, results);
  }

  applyStatusResults(results) {
    ChainEffectSystem.applyStatusResults(this, results, { playerY: 260, enemyY: 280 });
  }

  tickStatuses(target) {
    ChainEffectSystem.tickStatuses(this, target);
  }

  emitTransitionVisual(transition) {
    this.effectQueue.emitTransition(transition);
    if (typeof SFX !== "undefined" && SFX.sfxTransition) {
      SFX.sfxTransition(transition);
    }
  }

  updateChargeEffects(dt) {
    if (!this.qteRunner) {
      this.chargeFxTimer = 0;
      return;
    }

    const node = this.qteRunner.currentNode();
    const isFireballCharge = node
      && node.id === "charge"
      && node.input
      && node.input.type === "hold_release"
      && this.qteRunner.chain
      && this.qteRunner.chain.name.includes("火球");

    if (!isFireballCharge) {
      const isGreatswordCharge = node
        && node.input
        && node.input.type === "hold_release"
        && this.qteRunner.chain
        && this.qteRunner.chain.family === "greatsword";

      if (isGreatswordCharge) {
        const ratio = Utils.clamp(this.qteRunner.nodeTimer / node.duration, 0, 1);
        this.chargeFxTimer -= dt;
        if (this.chargeFxTimer > 0) return;

        this.chargeFxTimer = Math.max(0.06, 0.14 - ratio * 0.05);
        this.effectQueue.emitCharge("greatsword", ratio);
        return;
      }

      const isAbsorbFlow = node
        && this.qteRunner.chain
        && this.qteRunner.chain.family === "absorb"
        && (node.id === "siphon" || node.input.type === "rhythm" || node.input.type === "hold_release");

      if (!isAbsorbFlow) {
        this.chargeFxTimer = 0;
        return;
      }

      const ratio = Utils.clamp(this.qteRunner.nodeTimer / node.duration, 0, 1);
      this.chargeFxTimer -= dt;
      if (this.chargeFxTimer > 0) return;

      this.chargeFxTimer = 0.10;
      this.effectQueue.emitCharge("absorb", ratio);
      return;
    }

    const ratio = Utils.clamp(this.qteRunner.nodeTimer / node.duration, 0, 1);
    this.chargeFxTimer -= dt;
    if (this.chargeFxTimer > 0) return;

    this.chargeFxTimer = Math.max(0.05, 0.12 - ratio * 0.05);
    this.effectQueue.emitCharge("fire", ratio);
  }

  applyDamage(target, amount, options = {}) {
    if (amount <= 0) return false;

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
      this.triggerActorReaction("player", "hit", 1.1, { color: "#e74c3c" });
      this.flashScreen("#e74c3c", 0.15);
      SFX.sfxHit();
      this.resetCombo();
      this.battleStats.hitsTaken++;
      this.log(`玩家受到 ${amount} 伤害`);
      if (this.playerHp <= 0) {
        this.setTurnState("game_over");
        this.setMessage("战败…");
        SFX.sfxFail();
        return true;
      }
      return false;
    } else {
      this.enemyHp = Math.max(0, this.enemyHp - amount);
      this.battleStats.damageDealt += amount;
      this.screenShake = options.isCrit ? 0.25 : 0.15;
      this.hitStop = options.isCrit ? 0.12 : 0.08;
      const textType = options.isCrit ? "crit" : "damage";
      this.floatingTexts.add(`-${amount}`, ex, ey - 40, textType);
      this.spawnParticles(options.isCrit ? "slash" : "hit", ex, ey, options.isCrit ? 1.5 : 1);
      this.triggerActorReaction("enemy", options.isCrit ? "crit" : "hit", options.isCrit ? 1.35 : 1, {
        color: options.isCrit ? "#f1c40f" : "#ffffff"
      });
      SFX.sfxSlash();
      if (options.isCrit) {
        this.setCameraZoom(1.15, 0.3);
        this.triggerImpactFrames(1);
      }
      this.log(`敌人受到 ${amount} ${options.isCrit ? "暴击" : ""}伤害`);
      return false;
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

  canPayChainCost(chainConfig) {
    const cost = chainConfig.cost || null;
    if (!cost) return true;

    if (cost.spellEnergy && this.playerState.spellEnergy < cost.spellEnergy) {
      this.setMessage(`需要 ${cost.spellEnergy} 法术能量`);
      SFX.sfxFail();
      return false;
    }

    if (cost.heat && this.resourceSystem && this.resourceSystem.heat < cost.heat) {
      this.setMessage(`需要 ${cost.heat} 热量`);
      SFX.sfxFail();
      return false;
    }

    return true;
  }

  getChainState(chainKey, chainConfig) {
    const tags = chainConfig.tags || [];
    const isWeaponTagged = tags.includes("weapon");
    const isSpellFamily = ["staff", "fire", "absorb"].includes(chainConfig.family);
    if (this.isSwordChain(chainKey) && isWeaponTagged) return "swordAttack";
    if (isSpellFamily) return "casting";
    if (this.isSwordChain(chainKey)) return "swordAttack";
    return "idle";
  }

  isSwordChain(chainKey) {
    const weapon = this.playerConfig.weapon;
    if (!weapon) return false;
    // 大剑和双刀的攻击链视为剑攻击
    return (weapon === "greatsword" || weapon === "dualBlades") && ["A", "S", "D"].includes(chainKey);
  }

  triggerDefenseQTE(defenseId, triggerTime) {
    const defense = DefenseDatabase[defenseId];
    if (!defense) return;

    const chainId = this.getDefenseChainId(defenseId);
    let chain = ChainDatabase[chainId];
    if (!chain) return;

    // 东方剑术：格挡窗口额外放宽
    chain = JSON.parse(JSON.stringify(chain));
    if (this.hasCombatArt("eastern")) {
      for (const node of chain.nodes) {
        if (node.window) {
          node.window = {
            start: Math.max(0, node.window.start - CombatArtDatabase.eastern.guardWindowBonus),
            end: node.window.end + CombatArtDatabase.eastern.guardWindowBonus
          };
        }
      }
    }

    if (defenseId === "dodge") SFX.sfxDodge();
    else if (defenseId === "parry") SFX.sfxParry();
    else if (defenseId === "guard") SFX.sfxGuard();

    this.playerState.currentState = "shield";
    this.setTurnState("qte_running");
    this.input.clear();
    this.qteRunner = new QTEChainRunner(Difficulty.scaleChain(chain), {
      source: "enemy",
      chainId,
      chainFamily: chain.family,
      handfeel: Utils.getChainHandfeel(chain, { chainId, source: "enemy" }),
      onNodeEffect: (node, outcome, transition) => {
        if (transition.message) this.setMessage(transition.message);
        this.showOutcomeFeedback(outcome);
        this.emitTransitionVisual(transition);
      }
    });

    // 防御单节点化：按一次按键即根据时机直接结算
    const firstNode = this.qteRunner.currentNode();
    if (firstNode && firstNode.input.type === "press" && triggerTime !== undefined) {
      const outcome = this.computeDefenseOutcome(triggerTime);
      this.qteRunner.resolveNode(outcome);
    } else {
      this.setMessage(`${defense.name} · ${this.getQTEStageMessage(chain)}`);
    }
  }

  getDefenseChainId(defenseId) {
    if (this.hasSpell("fire") && defenseId === "guard") {
      return "shield_flare";
    }
    if (this.hasSpell("absorb") && (defenseId === "guard" || defenseId === "parry")) {
      return "mirror_guard";
    }
    const defense = DefenseDatabase[defenseId];
    return defense ? defense.chainId : null;
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

  showOutcomeFeedback(outcome, x = 480, y = 360) {
    const label = (outcome || "fail").toUpperCase();
    this.spawnFloatingText(label, x, y, "popup");

    // 统计
    this.battleStats.attempts++;
    if (outcome === "perfect" || outcome === "success") {
      this.battleStats.hits++;
    } else {
      this.battleStats.misses++;
    }
    if (outcome === "perfect") this.battleStats.perfectCount++;

    if (outcome === "perfect") {
      SFX.sfxPerfect();
      this.hitStop = 0.12;
      this.timeScale = 0.25;
      this.timeScaleTimer = 0.3;
      this.addCombo();
      this.setCameraZoom(1.12, 0.25);
      this.triggerImpactFrames(1);
    } else if (outcome === "success") {
      SFX.sfxSuccess();
      this.hitStop = 0.08;
      this.addCombo();
    } else if (outcome === "early" || outcome === "late") {
      SFX.sfxFail();
      this.resetCombo();
    } else {
      SFX.sfxFail();
      this.hitStop = 0.05;
      this.resetCombo();
    }
  }

  spawnParticles(type, x, y, intensity) {
    this.particles.emit(type, x, y, intensity);
  }

  triggerActorReaction(target, type, intensity = 1, options = {}) {
    if (this.actorReactions) {
      this.actorReactions.trigger(target, type, intensity, options);
    }
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

  setCameraZoom(zoom, duration) {
    this.cameraZoom = zoom;
    this.cameraZoomTimer = duration;
  }

  triggerImpactFrames(count) {
    this.impactFrames = count;
  }

  resetCombo() {
    this.comboCount = 0;
    this.comboTimer = 0;
  }

  addCombo() {
    this.comboCount++;
    this.comboTimer = 2.0;
    if (this.comboCount > this.battleStats.maxCombo) {
      this.battleStats.maxCombo = this.comboCount;
    }
  }

  getComboDamageMultiplier() {
    return 1 + Math.min(this.comboCount * 0.05, 0.5);
  }

  getBattleStats() {
    const s = this.battleStats;
    const accuracy = s.attempts > 0 ? Math.round((s.hits / s.attempts) * 100) : 0;
    return { ...s, accuracy };
  }

  getQTEDebugLines() {
    return QTEDebugFormatter.getLines(this, { title: "Battle QTE Debug" });
  }

  checkEnemyDefeated() {
    if (this.enemyHp > 0) return false;
    if (this.practiceMode) {
      this.enemyHp = this.enemyMaxHp;
      this.spawnFloatingText("目标已刷新", 740, 220, "status");
      this.log("练习目标已刷新");
      return false;
    }
    this.setTurnState("game_over");
    this.setMessage("胜利！");
    SFX.sfxPerfect();
    return true;
  }
}
