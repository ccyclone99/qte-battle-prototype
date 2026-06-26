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
    this.activeEncounterPhaseId = "base";
    this.enemyAttackCursor = 0;

    // 回合/阶段状态
    this._turnState = "select_weapon"; // select_weapon | player_turn | enemy_turn | qte_running | attack_active | resolving | game_over
    this.actionBarMax = 6.8;
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
    this.enemyAttackChain = null;
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
    this.compressedPlayerTurn = false;

    // 结算
    this.resolveTimer = 0;
    this.resolveDuration = 0.68;

    // 消息
    this.message = `按 1-8 选择战斗风格｜遭遇：${this.getEnemySelectionLabel()}`;
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
    this.hitConfirmSystem = new HitConfirmSystem(this);
    this.activeAttackSystem = new ActiveAttackSystem(this);
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

    if (this.activeAttackSystem) this.activeAttackSystem.update(dt);
    if (this.hitConfirmSystem) this.hitConfirmSystem.update(dt);

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
      case "attack_active":
        this.updateAttackActive(dt);
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
    this.actionBarMax = style.actionBarMax || 6.8;
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
    this.enemyAttackChain = null;
    this.enemyAttackPhase = "none";
    this.enemyStunTimer = 0;
    this.enemyAttackCursor = 0;
    if (!options.fromEncounter) {
      this.activeEncounterId = null;
      this.encounterConfig = null;
    }
    this.activeEncounterPhaseId = "base";
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
    const base = (this.encounterConfig && this.encounterConfig.modifiers) || {};
    const phase = this.getCurrentEncounterPhase();
    if (!phase || !phase.modifiers) return base;
    return { ...base, ...phase.modifiers };
  }

  getCurrentEncounterPhase() {
    if (!this.encounterConfig || !Array.isArray(this.encounterConfig.phases) || this.enemyMaxHp <= 0) return null;
    const hpRatio = this.enemyHp / this.enemyMaxHp;
    return this.encounterConfig.phases.find(phase => {
      return phase && typeof phase.hpBelow === "number" && hpRatio <= phase.hpBelow;
    }) || null;
  }

  getEncounterAttackPattern() {
    const phase = this.getCurrentEncounterPhase();
    if (phase && Array.isArray(phase.attackPattern) && phase.attackPattern.length > 0) {
      return phase.attackPattern;
    }
    return this.encounterConfig && this.encounterConfig.attackPattern;
  }

  maybeEnterEncounterPhase() {
    if (!this.encounterConfig) return null;
    const phase = this.getCurrentEncounterPhase();
    const phaseId = phase ? phase.id : "base";
    if (phaseId === this.activeEncounterPhaseId) return phase;

    this.activeEncounterPhaseId = phaseId;
    this.enemyAttackCursor = 0;
    if (phase) {
      this.log(`${this.encounterConfig.name}进入阶段：${phase.name}`);
      this.spawnFloatingText(phase.name, 740, 170, "status");
      this.flashScreen(this.enemyConfig.color || "#e74c3c", 0.12);
    }
    return phase;
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
    const phase = this.getCurrentEncounterPhase();
    return [
      `遭遇：${this.encounterConfig.name}`,
      `地形：${this.encounterConfig.terrain}`,
      phase ? `阶段：${phase.name}` : "阶段：常态",
      ...((this.encounterConfig.ruleLines || []).slice(0, Math.max(0, limit - 2)))
    ].slice(0, limit);
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

    if (labels.length > 0 && nextDamage > damage) this.log(`${this.encounterConfig.name}规则触发：${labels.join(" / ")}`);
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
      this.performNormalAttack({ automatic: true });
    }
  }

  // ========== 敌方回合 ==========

  updateEnemyTurn(dt) {
    if (!this.enemyAttack && this.getActiveEnemyAttacks().length === 0) return;

    const active = this.getIncomingActiveAttack();
    if (active) {
      this.enemyAttack = active.intent.attack || this.enemyAttack;
      this.enemyAttackTimer = active.elapsed;
      if (active.phase === "reaction" && !this.defenseTriggered) {
        this.enemyAttackPhase = "response";
      } else if (active.phase === "impact" || active.phase === "recovery") {
        this.enemyAttackPhase = "hit";
      } else if (active.phase === "canceled") {
        this.enemyAttackPhase = "canceled";
      } else {
        this.enemyAttackPhase = "windup";
      }
    }

    if (this.enemyAttackPhase === "response" && active && !active.paused) {
      this.consumeEnemyResponseInputs();
      if (this.turnState !== "enemy_turn") return;
    }
  }

  updateAttackActive(dt) {
    if (this.activeAttackSystem && this.activeAttackSystem.hasActive()) return;
    if (this.turnState === "attack_active") {
      this.startResolving(() => this.startEnemyTurn());
    }
  }

  commitEnemyActiveAttack(attack, options = {}) {
    if (!attack || !this.activeAttackSystem) return null;
    const offset = Math.max(0, options.timelineOffset || attack.offset || 0);
    const timing = this.getEnemyActiveAttackTiming(attack, offset);
    return this.activeAttackSystem.commit({
      kind: "enemyAttack",
      source: "enemy",
      target: "player",
      attackId: attack.id,
      label: attack.name || attack.id,
      visualEvent: attack.id,
      attackType: this.isIncomingSpellAttack(attack) ? "projectile" : "melee",
      isSpell: this.isIncomingSpellAttack(attack),
      damage: attack.damage,
      color: attack.color || "#e74c3c",
      fromAnchor: "enemyCore",
      toAnchor: "playerCore",
      timeline: {
        startup: offset + attack.windup,
        travel: Math.max(0.001, attack.hitTime),
        reactionStart: timing.responseStart,
        reactionDuration: timing.responseDuration,
        impactTime: timing.impactTime,
        recovery: 0.32
      },
      chainId: attack.chainId,
      chainIndex: attack.chainIndex,
      chainCount: attack.chainCount,
      chainNodeId: attack.chainNodeId,
      attack
    });
  }

  getEnemyActiveAttackTiming(attack, offset = 0) {
    const impactTime = offset + (attack ? attack.windup : 0) + (attack ? attack.hitTime : 0);
    const readableCap = Utils.clamp((attack ? attack.hitTime : 0.2) + 0.28, 0.48, 0.92);
    const responseDuration = Math.min(attack && attack.responseDuration ? attack.responseDuration : Difficulty.responseDuration(), readableCap);
    const responseStart = Math.max(0, impactTime - responseDuration);
    return { impactTime, responseStart, responseDuration };
  }

  commitActiveAttack(intent = {}) {
    if (!this.activeAttackSystem) {
      if (intent.kind === "playerQTE") {
        return this.resolvePlayerQTEImpact({ intent });
      }
      return null;
    }
    this.setTurnState("attack_active");
    return this.activeAttackSystem.commit(intent);
  }

  getActiveEnemyAttacks(options = {}) {
    if (!this.activeAttackSystem || !Array.isArray(this.activeAttackSystem.active)) return [];
    return this.activeAttackSystem.active
      .filter(attack => {
        if (!attack || attack.completed) return false;
        if (attack.source !== "enemy" || attack.target !== "player") return false;
        if (!options.includeCanceled && attack.canceled) return false;
        if (!options.includeResolved && attack.resolved) return false;
        return true;
      })
      .sort((a, b) => {
        const ai = a.profile && Number.isFinite(a.profile.impactTime) ? a.profile.impactTime : Infinity;
        const bi = b.profile && Number.isFinite(b.profile.impactTime) ? b.profile.impactTime : Infinity;
        if (ai !== bi) return ai - bi;
        return a.id.localeCompare(b.id);
      });
  }

  getIncomingActiveAttack() {
    const active = this.getActiveEnemyAttacks();
    if (active.length === 0) return null;
    const reaction = active.find(attack => attack.phase === "reaction");
    return reaction || active[0];
  }

  hasPendingEnemyActiveAttacks(exceptAttack = null) {
    return this.getActiveEnemyAttacks({ includeResolved: true }).some(attack => attack !== exceptAttack);
  }

  getPlayerActiveAttack() {
    return this.activeAttackSystem
      ? this.activeAttackSystem.getPrimary({ source: "player", target: "enemy" })
      : null;
  }

  onActiveAttackReactionWindow(attack) {
    if (!attack || attack.completed) return;
    if (attack.source === "enemy" && attack.target === "player") {
      const sourceAttack = attack.intent.attack || this.enemyAttack;
      this.enemyAttack = sourceAttack || this.enemyAttack;
      this.enemyAttackPhase = "response";
      this.enemyAttackTimer = attack.elapsed;
      this.input.clear();
      const chainText = sourceAttack && sourceAttack.chainCount > 1
        ? ` ${sourceAttack.chainIndex + 1}/${sourceAttack.chainCount}`
        : "";
      this.setMessage(`敌方攻势${chainText}：命中前窗口按 SPACE/F，或用战技反制`);
      this.triggerActorReaction("enemy", "windup", 1.0, {
        color: attack.profile.color || "#e74c3c",
        duration: Math.min(0.42, Math.max(0.24, attack.profile.reactionDuration || 0.3))
      });
      SFX.sfxWindup();
      if (SFX.sfxWindowOpen) SFX.sfxWindowOpen();
      return;
    }

    if (attack.source === "player" && attack.target === "enemy") {
      this.resolveEnemyActiveDefense(attack);
    }
  }

  resolveEnemyActiveDefense(attack) {
    if (!attack || attack.defenderResponse) return;
    const decision = this.getEnemyReactionDecision(attack);
    if (!decision || decision.type === "none") return;

    attack.defenderResponse = decision.type;
    if (decision.type === "dodge") {
      this.triggerActorReaction("enemy", "dodge", 0.9, {
        color: "#2ecc71",
        direction: 1,
        distance: 34,
        lift: 3,
        duration: 0.28
      });
      this.spawnFloatingText("闪避", 740, 300, "status");
      this.setMessage("敌人闪避攻击");
      this.activeAttackSystem.cancel(attack, "dodge");
      return;
    }

    if (decision.type === "guard") {
      this.triggerActorReaction("enemy", "guard", 0.9, {
        color: "#2ecc71",
        direction: 1,
        distance: 14,
        lift: 2,
        duration: 0.28
      });
      this.spawnFloatingText("防御", 740, 300, "status");
      this.setMessage("敌人架起防御");
      attack.intent.guardMul = decision.damageMul || 0.45;
      return;
    }

    if (decision.type === "reflect") {
      this.triggerActorReaction("enemy", "guard", 1.0, {
        color: "#9b59b6",
        direction: 1,
        distance: 18,
        lift: 3,
        duration: 0.30
      });
      this.spawnFloatingText("反射", 740, 300, "status");
      this.setMessage("敌人反射法术");
      this.activeAttackSystem.cancel(attack, "reflect");
      this.commitActiveAttack({
        kind: "enemyAttack",
        source: "enemy",
        target: "player",
        attackId: "enemyReflect",
        label: "enemyReflect",
        visualEvent: "enemyReflect",
        attackType: "projectile",
        isSpell: true,
        damage: Math.max(1, Math.floor((attack.intent.damage || 0) * 0.35)),
        color: "#9b59b6",
        fromAnchor: "enemyCore",
        toAnchor: "playerCore"
      });
    }
  }

  getEnemyReactionDecision(attack) {
    if (this.enemyReactionOverride) return { type: this.enemyReactionOverride, damageMul: 0.45 };
    const enemyId = this.enemyId || "";
    const type = attack.profile.type;
    const text = [
      enemyId,
      attack.intent.chainFamily,
      attack.intent.chainId,
      attack.intent.visualEvent,
      attack.intent.attackType,
      type
    ].filter(Boolean).join(" ").toLowerCase();
    const seed = (this.battleStats.attempts + this.enemyAttackCursor + attack.id.length) % 10;

    if (enemyId === "swift" && (type === "projectile" || text.includes("heavy")) && seed <= 2) {
      return { type: "dodge" };
    }
    if ((enemyId === "armored" || enemyId === "shielded") && type === "melee" && seed <= 2) {
      return { type: "guard", damageMul: enemyId === "armored" ? 0.55 : 0.40 };
    }
    if (enemyId === "caster" && type !== "melee" && seed === 0) {
      return { type: "reflect" };
    }
    return { type: "none" };
  }

  resolveActiveAttack(attack) {
    if (!attack || attack.canceled) return null;
    const kind = attack.intent.kind;
    if (kind === "playerQTE") return this.resolvePlayerQTEImpact(attack);
    if (kind === "normalAttack") return this.resolveNormalAttackImpact(attack);
    if (kind === "enemyAttack") return this.resolveEnemyActiveAttackImpact(attack);
    if (kind === "defenseCounter" || kind === "shieldThorn" || kind === "reflect") {
      return this.resolveAuxiliaryPlayerAttackImpact(attack);
    }
    return null;
  }

  onActiveAttackComplete(attack) {
    if (!attack || this.turnState === "game_over") return;
    if (attack.intent.kind === "playerQTE") {
      if (attack.intent.suppressFlowComplete) return;
      if (attack.canceled && !attack.result) {
        this.finishPlayerQTEFlow(attack.intent.flowEffects || attack.intent.effects || {}, attack.intent.context || {}, { confirmed: false });
      } else {
        this.finishPlayerQTEFlow(attack.intent.flowEffects || attack.intent.effects || {}, attack.intent.context || {}, attack.result || {});
      }
      return;
    }
    if (attack.intent.kind === "normalAttack") {
      if (this.checkEnemyDefeated()) return;
      this.startResolving(() => this.startEnemyTurn());
      return;
    }
    if (attack.intent.kind === "enemyAttack") {
      if (this.playerHp <= 0 || this.turnState === "game_over") return;
      if (this.hasPendingEnemyActiveAttacks(attack)) return;
      if (attack.canceled || (attack.result && attack.result.defended)) return;
      if (attack.result && attack.result.absorbed) return;
      this.startResolving(() => this.startPlayerTurn());
      return;
    }
    if (typeof attack.intent.onComplete === "function") {
      attack.intent.onComplete(attack);
    }
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
      this.input.clear();
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

      if (this.handleEnemyTurnCounterInput(key)) {
        this.input.consume();
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

  handleEnemyTurnCounterInput(key) {
    const incoming = this.getIncomingActiveAttack();
    const attack = incoming && incoming.intent ? incoming.intent.attack : this.enemyAttack;
    if (!incoming || !attack) return false;

    const style = this.getCurrentStyle();
    const counterChainId = style && style.counterChain;
    const counterChain = counterChainId ? ChainDatabase[counterChainId] : null;
    if (counterChain && counterChain.key === key && this.isIncomingSpellAttack(attack)) {
      this.triggerCounterSpellQTE(counterChainId);
      return true;
    }

    if (!this.hasAttackAnytime() && !(style && style.counterCoverage)) return false;
    const chains = this.getEffectiveChains();
    if (!chains[key]) return false;
    this.triggerClashCounter(key);
    return true;
  }

  consumeQTECombatArtInputs() {
    if (!this.qteRunner) return;
    if (this.qteRunner.context && this.qteRunner.context.counterSpell) return;

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
    this.input.ignoreHeldUntilRelease(chainKey);
    this.triggerActorReaction("player", chainState === "swordAttack" ? "attack" : "cast", 0.9, {
      color: chainConfig.color || "#f1c40f",
      duration: chainState === "swordAttack" ? 0.32 : 0.26
    });
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
    this.applyQTEPacing(chainConfig, chainId, { source: "player" });

    this.setMessage(this.getQTEStageMessage(chainConfig));
  }

  getCounterCoverageCount() {
    const style = this.getCurrentStyle();
    const weapon = this.playerConfig.weapon || "";
    const coverage = style && style.counterCoverage;
    if (coverage) {
      return coverage[weapon] || coverage.default || 1;
    }
    if (weapon === "dualBlades") return 2;
    return 1;
  }

  getCounterCoverageTargets() {
    const incoming = this.getIncomingActiveAttack();
    if (!incoming) return [];
    const count = Math.max(1, this.getCounterCoverageCount());
    const attacks = this.getActiveEnemyAttacks()
      .filter(attack => !attack.canceled && !attack.resolved);
    return attacks.slice(0, count);
  }

  cancelEnemyAttacks(attacks, reason = "clash") {
    if (!this.activeAttackSystem) return [];
    const canceled = [];
    for (const attack of attacks || []) {
      if (!attack || attack.canceled || attack.completed) continue;
      this.activeAttackSystem.cancel(attack, reason);
      canceled.push(attack);
    }
    return canceled;
  }

  triggerClashCounter(chainKey) {
    const targets = this.getCounterCoverageTargets();
    if (targets.length === 0) return;

    this.defenseTriggered = true;
    this.playerState.currentState = "swordAttack";
    this.input.clear();
    this.cancelEnemyAttacks(targets, "clash");

    const weapon = WeaponDatabase[this.playerConfig.weapon] || {};
    const coveredSpell = targets.some(attack => this.isIncomingSpellAttack(attack.intent && attack.intent.attack));
    const damage = Math.max(8, Math.floor((weapon.normalAttack || 10) + targets.length * 5 + (coveredSpell ? 4 : 0)));
    const isCrit = this.hasCombatArt("desslo") || (this.getCurrentStyle() && this.getCurrentStyle().manualQteCrit);
    const label = `clash:${chainKey}:${targets.map(attack => attack.intent.attackId || attack.id).join("+")}`;
    const finishClash = () => {
      if (this.checkEnemyDefeated()) return;
      this.startResolving(() => this.startPlayerTurn());
    };

    SFX.sfxCounter();
    this.triggerActorReaction("player", "attack", targets.length > 1 ? 1.18 : 1.0, {
      color: weapon.color || "#2ecc71",
      duration: targets.length > 1 ? 0.42 : 0.30
    });
    this.spawnFloatingText(`拼刀 x${targets.length}`, 220, 300, "status");
    this.log(`拼刀覆盖 ${targets.length} 段敌方攻势`);

    const token = `${label}:${this.enemyAttackCursor}:${Math.round(performance.now() * 1000)}`;
    const segments = this.buildClashCounterSegments(targets, damage);
    if (segments.length > 1) {
      this.commitClashCounterSegments({
        segments,
        token,
        label,
        weapon,
        isCrit,
        finishClash
      });
      this.setMessage(`拼刀覆盖 ${targets.length} 段 · 双刃连续反击`);
      return;
    }

    this.commitActiveAttack({
      kind: "defenseCounter",
      source: "player",
      target: "enemy",
      token,
      attackType: "melee",
      shape: "arc",
      fromAnchor: "playerHand",
      anchor: "playerHand",
      toAnchor: "enemyCore",
      damage,
      label,
      visualEvent: label,
      motion: targets.length > 1 ? "dualClash" : "clash",
      chainFamily: "counter",
      weapon: this.playerConfig.weapon,
      color: weapon.color || "#2ecc71",
      onComplete: finishClash,
      damageIntent: {
        source: "player",
        target: "enemy",
        token,
        shape: "arc",
        anchor: "playerHand",
        toAnchor: "enemyCore",
        damage,
        label,
        visualEvent: label,
        motion: targets.length > 1 ? "dualClash" : "clash",
        chainFamily: "counter",
        weapon: this.playerConfig.weapon,
        options: { isCrit }
      }
    });
    this.setMessage(`拼刀覆盖 ${targets.length} 段 · 反击推进中`);
  }

  getClashCounterHitCount(targets) {
    if (!Array.isArray(targets) || targets.length <= 1) return 1;
    if (this.playerConfig.weapon === "dualBlades") return Math.min(2, targets.length);
    return 1;
  }

  buildClashCounterSegments(targets = [], totalDamage = 0) {
    const hitCount = this.getClashCounterHitCount(targets);
    if (hitCount <= 1) return [];

    const base = Math.floor(totalDamage / hitCount);
    let remainder = totalDamage - base * hitCount;
    return Array.from({ length: hitCount }, (_, index) => {
      const damage = base + (remainder > 0 ? 1 : 0);
      remainder -= remainder > 0 ? 1 : 0;
      const startup = 0.06 + index * 0.13;
      const travel = 0.10;
      const impactTime = startup + travel;
      return {
        damage,
        hitIndex: index + 1,
        hitCount,
        motion: index === 0 ? "dualClashLead" : "dualClashFollow",
        timeline: {
          startup,
          travel,
          impactTime,
          reactionStart: Math.max(0, impactTime - 0.08),
          reactionDuration: 0.08,
          recovery: index === hitCount - 1 ? 0.24 : 0.12
        }
      };
    });
  }

  commitClashCounterSegments({ segments = [], token, label, weapon = {}, isCrit = false, finishClash }) {
    segments.forEach((segment, index) => {
      const isFinalHit = index === segments.length - 1;
      const segmentToken = `${token}:hit${segment.hitIndex}`;
      const segmentLabel = `${label}:hit${segment.hitIndex}`;
      const segmentMeta = {
        attackType: "melee",
        shape: "arc",
        motion: segment.motion,
        chainFamily: "counter",
        weapon: this.playerConfig.weapon,
        color: weapon.color || "#2ecc71",
        hitIndex: segment.hitIndex,
        hitCount: segment.hitCount,
        strikeCount: 1
      };

      this.commitActiveAttack({
        kind: "defenseCounter",
        source: "player",
        target: "enemy",
        token: segmentToken,
        fromAnchor: "playerHand",
        anchor: "playerHand",
        toAnchor: "enemyCore",
        damage: segment.damage,
        label: segmentLabel,
        visualEvent: segmentLabel,
        ...segmentMeta,
        timeline: segment.timeline,
        onComplete: isFinalHit ? finishClash : undefined,
        damageIntent: {
          source: "player",
          target: "enemy",
          token: segmentToken,
          anchor: "playerHand",
          toAnchor: "enemyCore",
          damage: segment.damage,
          label: segmentLabel,
          visualEvent: segmentLabel,
          ...segmentMeta,
          options: { isCrit: isFinalHit && isCrit }
        }
      });
    });
  }

  triggerCounterSpellQTE(chainId) {
    const chainConfig = ChainDatabase[chainId];
    if (!chainConfig) return;
    if (!this.canPayChainCost(chainConfig)) return;

    const targets = this.getActiveEnemyAttacks({ includeResolved: true }).filter(attack => !attack.canceled);
    const covered = this.cancelEnemyAttacks(targets, "counterspell");
    this.defenseTriggered = true;
    this.playerState.currentState = "casting";
    SFX.sfxMagic();
    this.setTurnState("qte_running");
    this.input.clear();
    this.input.ignoreHeldUntilRelease(chainConfig.key || "S");
    this.triggerActorReaction("player", "cast", 1.0, {
      color: chainConfig.color || "#16a085",
      duration: 0.32
    });
    this.log(`反咒接管 ${covered.length} 段敌方攻势`);
    this.qteRunner = new QTEChainRunner(Difficulty.scaleChain(chainId), {
      source: "player",
      chainId,
      chainFamily: chainConfig.family,
      counterSpell: true,
      coveredEnemyAttacks: covered.map(attack => attack.intent.attackId || attack.id),
      isSwordChain: false,
      handfeel: Utils.getChainHandfeel(chainConfig, { chainId, source: "player", counterSpell: true }),
      onNodeEffect: (node, outcome, transition) => {
        if (node.input.type === "hold_release" || node.id === "slip") {
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
    this.applyQTEPacing(chainConfig, chainId, { source: "player", counterSpell: true });
    this.setMessage(`反咒反制 · ${this.getQTEStageMessage(chainConfig)}`);
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
    this.input.ignoreHeldUntilRelease(chainKey);
    this.triggerActorReaction("player", this.playerState.currentState === "swordAttack" ? "attack" : "cast", 1.0, {
      color: chainConfig.color || "#f1c40f",
      duration: 0.30
    });
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
    this.applyQTEPacing(chainConfig, chainId, { source: "player", counterAttack: true });

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
    this.input.ignoreHeldUntilRelease("A");
    this.triggerActorReaction("player", "attack", 1.15, {
      color: chainConfig ? chainConfig.color : "#f1c40f",
      duration: 0.30
    });
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
        this.emitTransitionVisual(transition);
      }
    });
    this.applyQTEPacing(chainConfig, chainId, { source: "player", followUp: true });

    this.setMessage(`追加攻击 · ${chainConfig ? this.getQTEStageMessage(chainConfig) : "精准按键"}`);
  }

  applyQTEPacing(chainConfig, chainId, options = {}) {
    if (!this.qteRunner || !Utils.getBattleQTEPacing) return;
    const pacing = Utils.getBattleQTEPacing(chainConfig, {
      chainId,
      difficultyId: Difficulty.current,
      ...options
    });
    this.qteRunner.timeScale = pacing.timeScale;
    this.qteRunner.postNodePause = pacing.postNodePause;
  }

  // ========== 战技中断类 ==========

  interruptCastingAndDodge() {
    this.qteRunner = null;
    this.playerState.currentState = "idle";
    this.defenseTriggered = true;
    this.input.clear();
    SFX.sfxDodge();
    this.triggerActorReaction("player", "dodge", 1.0, { color: "#2ecc71" });
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
    this.triggerActorReaction("player", "dodge", 1.0, { color: "#2ecc71" });
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
    this.cancelEnemyAttacks(this.getActiveEnemyAttacks(), "guard");
    this.triggerActorReaction("player", "guard", 1.0, { color: "#2ecc71" });
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
    const context = runner.context;
    const source = context.source;

    if (source === "player") {
      this.resolvePlayerQTE(effects, context);
    } else {
      this.resolveDefenseQTE(effects);
    }
  }

  getQTEAttackColor(context) {
    if (context.chainFamily === "fire") return "#e67e22";
    if (context.chainFamily === "absorb") return "#9b59b6";
    if (context.chainFamily === "dualBlades") return "#2ecc71";
    if (context.chainFamily === "greatsword") return "#f1c40f";
    return "#ffffff";
  }

  shouldManualQTECrit(context = {}, resultLog = [], effects = {}) {
    const style = this.getCurrentStyle();
    if (!style || !style.manualQteCrit) return false;
    if (!context || context.source !== "player") return false;
    if (context.counterAttack || context.counterSpell || context.followUp) return false;
    if (!context.isSwordChain) return false;
    if ((effects.damage || 0) <= 0) return false;
    return resultLog.some(entry => entry.outcome === "perfect" || entry.outcome === "success");
  }

  resolvePlayerQTE(effects, context) {
    // 计算最终伤害
    let damage = effects.damage;
    const resultLog = this.qteRunner && Array.isArray(this.qteRunner.resultLog)
      ? this.qteRunner.resultLog.map(entry => ({ ...entry }))
      : [];
    const manualQteCrit = this.shouldManualQTECrit(context || {}, resultLog, effects || {});

    // 连击增伤
    if (damage > 0) {
      const comboMul = this.getComboDamageMultiplier();
      if (comboMul > 1) {
        damage = Math.floor(damage * comboMul);
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
        if (context && (context.chainFamily === "fire" || context.chainFamily === "absorb")) {
          this.log(`破甲协同触发：${context.chainFamily === "fire" ? "火焰" : "咒还"}链获得增伤`);
        }
      }
    }

    // 烈火重重：剑对防御敌人增伤
    if (this.hasSpell("fire") && context && context.isSwordChain) {
      damage = Math.floor(damage * 1.5);
    }

    // 手动 QTE / 德斯洛：暴击
    if (manualQteCrit) {
      damage = Math.floor(damage * 1.5);
    } else if (this.hasCombatArt("desslo") && effects.perfectHit) {
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
      }
    }

    damage = this.applyEncounterDamageModifiers(damage, context || {});

    // 是否暴击
    const isCrit = manualQteCrit || (this.hasCombatArt("desslo") && effects.perfectHit) || easternCrit;
    const qteHitMeta = this.buildQTEHitMeta(effects, context || {});

    const tokenSuffix = resultLog.length > 0
      ? resultLog.map(entry => `${entry.nodeId}:${entry.outcome}`).join("|")
      : String(this.battleStats.attempts);
    const split = this.splitQTEEffectsForActiveAttack(effects);
    const qteColor = this.getQTEAttackColor(context || {});
    const hitSegments = this.buildQTEHitSegments(effects, context || {}, resultLog, damage, qteHitMeta);

    this.applyQTECommitEffects(split.commit, context);
    this.applyPlayerQTECommitSideEffects(effects, context);

    this.qteRunner = null;
    this.input.clear();

    if (damage > 0) {
      this.triggerActorReaction("player", qteHitMeta.shape === "arc" ? "attack" : "cast", hitSegments.length > 1 ? 1.08 : 0.96, {
        color: qteColor,
        duration: hitSegments.length > 1 ? 0.46 : 0.34
      });

      if (hitSegments.length > 1) {
        this.commitSegmentedQTEActiveAttacks({
          context,
          effects,
          split,
          qteHitMeta,
          hitSegments,
          tokenBase: `qte:${context && context.chainId ? context.chainId : "chain"}:${tokenSuffix}`,
          color: qteColor,
          isCrit
        });
        this.setMessage(`${effects.messages && effects.messages.length ? effects.messages[effects.messages.length - 1] : "连击成型"} · 逐段命中中`);
        return;
      }

      this.commitActiveAttack({
        kind: "playerQTE",
        source: "player",
        target: "enemy",
        token: `qte:${context && context.chainId ? context.chainId : "chain"}:${tokenSuffix}`,
        shape: qteHitMeta.shape,
        fromAnchor: context && context.chainFamily === "absorb" ? "playerHand" : "playerHand",
        anchor: context && context.chainFamily === "absorb" ? "playerHand" : "playerHand",
        toAnchor: "enemyCore",
        damage,
        label: context && context.chainId ? context.chainId : "qte",
        context: { ...(context || {}) },
        effects: split.impact,
        flowEffects: effects,
        resultLog,
        ...qteHitMeta,
        color: qteColor,
        options: { isCrit },
        damageIntent: {
          source: "player",
          target: "enemy",
          token: `qte:${context && context.chainId ? context.chainId : "chain"}:${tokenSuffix}`,
          shape: qteHitMeta.shape,
          anchor: context && context.chainFamily === "absorb" ? "playerHand" : "playerHand",
          toAnchor: "enemyCore",
          damage,
          label: context && context.chainId ? context.chainId : "qte",
          ...qteHitMeta,
          color: qteColor,
          options: { isCrit }
        }
      });
      this.setMessage(`${effects.messages && effects.messages.length ? effects.messages[effects.messages.length - 1] : "招式成型"} · 攻击推进中`);
      return;
    }

    this.applyQTEImpactEffects(split.impact, context, { confirmed: true });
    this.applyPlayerQTEImpactSideEffects(effects, context, { confirmed: true });
    this.finishPlayerQTEFlow(effects, context, { confirmed: true });
  }

  createQTEEffectShell(effects = {}) {
    return {
      damage: 0,
      chargeMul: effects.chargeMul || 1,
      selfStun: 0,
      stunEnemy: 0,
      iframe: 0,
      damageMul: 1,
      staminaCost: 0,
      openPlayerTurn: false,
      resources: {},
      spellEnergy: 0,
      absorbReady: false,
      statuses: [],
      visualEvents: [...(effects.visualEvents || [])],
      messages: [...(effects.messages || [])],
      perfectHit: !!effects.perfectHit
    };
  }

  splitQTEEffectsForActiveAttack(effects = {}) {
    const commit = this.createQTEEffectShell(effects);
    const impact = this.createQTEEffectShell(effects);
    impact.damage = effects.damage || 0;
    impact.selfStun = effects.selfStun || 0;
    impact.stunEnemy = effects.stunEnemy || 0;
    impact.iframe = effects.iframe || 0;
    impact.damageMul = effects.damageMul === undefined ? 1 : effects.damageMul;
    impact.staminaCost = effects.staminaCost || 0;
    impact.openPlayerTurn = !!effects.openPlayerTurn;

    const resources = ChainEffectSystem.collectResources(effects);
    for (const [type, amount] of Object.entries(resources)) {
      if (amount < 0) commit.resources[type] = amount;
      else if (amount > 0) impact.resources[type] = amount;
    }
    commit.spellEnergy = commit.resources.spellEnergy || 0;
    impact.spellEnergy = impact.resources.spellEnergy || 0;

    for (const status of effects.statuses || []) {
      const target = status.target || "enemy";
      if (target === "player") commit.statuses.push(status);
      else impact.statuses.push(status);
    }
    commit.absorbReady = !!effects.absorbReady;
    return { commit, impact };
  }

  shouldSplitQTEIntoMeleeHits(context = {}, qteHitMeta = {}, resultLog = []) {
    const damagingCount = resultLog.filter(entry => entry.transition && entry.transition.damage > 0).length;
    if (damagingCount <= 1) return false;

    const text = [
      context.chainId,
      context.chainFamily,
      context.isSwordChain ? "sword" : "",
      qteHitMeta.shape,
      qteHitMeta.visualEvent,
      qteHitMeta.motion,
      ...(qteHitMeta.visualEvents || [])
    ].filter(Boolean).join(" ").toLowerCase();

    if (qteHitMeta.shape === "beam" || qteHitMeta.shape === "circle") return false;
    if (["absorb", "staff"].includes(context.chainFamily)) return false;
    if (["fireball", "overflow", "spell", "arcane", "curse", "siphon", "release"].some(key => text.includes(key))) {
      return false;
    }

    return !!(
      context.isSwordChain
      || context.chainFamily === "greatsword"
      || context.chainFamily === "dualBlades"
      || ["slash", "blade", "cleave", "cut", "dash", "flurry", "finisher"].some(key => text.includes(key))
    );
  }

  buildQTEHitSegments(effects = {}, context = {}, resultLog = [], totalDamage = 0, qteHitMeta = {}) {
    if (totalDamage <= 0 || !this.shouldSplitQTEIntoMeleeHits(context, qteHitMeta, resultLog)) return [];

    let currentMul = 1;
    const rows = [];
    for (const entry of resultLog) {
      const transition = entry.transition || {};
      if (transition.chargeMul !== undefined) currentMul *= transition.chargeMul;
      if (transition.damage === undefined || transition.damage <= 0) continue;
      const rawDamage = Math.floor(transition.damage * currentMul);
      if (rawDamage <= 0) continue;
      rows.push({
        entry: { ...entry, transition: { ...transition } },
        rawDamage,
        nodeId: entry.nodeId,
        outcome: entry.outcome,
        visualEvent: transition.visualEvent || qteHitMeta.visualEvent || "",
        message: transition.message || ""
      });
    }

    if (rows.length <= 1) return [];
    const rawTotal = rows.reduce((sum, row) => sum + row.rawDamage, 0);
    if (rawTotal <= 0) return [];

    const allocations = rows.map((row, index) => {
      const exact = totalDamage * row.rawDamage / rawTotal;
      const damage = Math.floor(exact);
      return { ...row, index, damage, fraction: exact - damage };
    });

    let remaining = totalDamage - allocations.reduce((sum, row) => sum + row.damage, 0);
    [...allocations]
      .sort((a, b) => b.fraction - a.fraction)
      .forEach(row => {
        if (remaining <= 0) return;
        row.damage += 1;
        remaining -= 1;
      });

    const hits = allocations.filter(row => row.damage > 0);
    if (hits.length <= 1) return [];

    const isDual = context.chainFamily === "dualBlades";
    const isHeavy = context.chainFamily === "greatsword" || this.playerConfig.weapon === "greatsword";
    const step = isDual ? 0.15 : (isHeavy ? 0.23 : 0.18);
    const travel = isDual ? 0.10 : (isHeavy ? 0.16 : 0.12);

    return hits.map((row, index) => {
      const startup = 0.08 + index * step;
      const impactTime = startup + travel;
      return {
        ...row,
        hitIndex: index + 1,
        hitCount: hits.length,
        timeline: {
          startup,
          travel,
          impactTime,
          reactionStart: Math.max(0, impactTime - (isDual ? 0.12 : 0.14)),
          reactionDuration: isDual ? 0.12 : 0.14,
          recovery: index === hits.length - 1 ? (isHeavy ? 0.34 : 0.26) : 0.16
        }
      };
    });
  }

  commitSegmentedQTEActiveAttacks({ context = {}, effects = {}, split, qteHitMeta = {}, hitSegments = [], tokenBase, color, isCrit }) {
    hitSegments.forEach((segment, index) => {
      const isFinalHit = index === hitSegments.length - 1;
      const token = `${tokenBase}:hit${index + 1}`;
      const segmentEvents = segment.visualEvent ? [segment.visualEvent] : (qteHitMeta.visualEvents || []);
      const segmentMeta = {
        ...qteHitMeta,
        shape: "arc",
        attackType: "melee",
        visualEvent: segment.visualEvent || qteHitMeta.visualEvent,
        visualEvents: segmentEvents,
        motion: segment.nodeId || qteHitMeta.motion,
        outcomes: [segment.outcome].filter(Boolean),
        strikeCount: 1,
        hitIndex: segment.hitIndex,
        hitCount: segment.hitCount
      };

      this.commitActiveAttack({
        kind: "playerQTE",
        source: "player",
        target: "enemy",
        token,
        attackType: "melee",
        shape: "arc",
        fromAnchor: "playerHand",
        anchor: "playerHand",
        toAnchor: "enemyCore",
        damage: segment.damage,
        label: `${context && context.chainId ? context.chainId : "qte"}:${segment.nodeId || segment.hitIndex}`,
        context: { ...(context || {}) },
        effects: isFinalHit ? split.impact : this.createQTEEffectShell(effects),
        flowEffects: isFinalHit ? effects : this.createQTEEffectShell(effects),
        suppressFlowComplete: !isFinalHit,
        suppressImpactSideEffects: !isFinalHit,
        resultLog: [segment.entry],
        ...segmentMeta,
        color,
        timeline: segment.timeline,
        options: { isCrit: isFinalHit && isCrit },
        damageIntent: {
          source: "player",
          target: "enemy",
          token,
          shape: "arc",
          attackType: "melee",
          anchor: "playerHand",
          toAnchor: "enemyCore",
          damage: segment.damage,
          label: `${context && context.chainId ? context.chainId : "qte"}:${segment.nodeId || segment.hitIndex}`,
          ...segmentMeta,
          color,
          options: { isCrit: isFinalHit && isCrit }
        }
      });
    });
  }

  applyQTECommitEffects(effects, context = {}) {
    ChainEffectSystem.applyResources(this, effects, { playerY: 300 });
    ChainEffectSystem.applyStatuses(this, effects, { source: "qte-commit", playerY: 260, enemyY: 280 });
  }

  applyQTEImpactEffects(effects, context = {}, result = {}) {
    if (result.confirmed === false) return;
    ChainEffectSystem.applyResources(this, effects, { playerY: 300 });
    ChainEffectSystem.applyStatuses(this, effects, { source: "qte-impact", playerY: 260, enemyY: 280 });
  }

  applyPlayerQTECommitSideEffects(effects, context) {
    if (this.hasCombatArt("eastern") && context && context.isSwordChain) {
      this.playerState.lastAttackTime = performance.now() / 1000;
    }
  }

  applyPlayerQTEImpactSideEffects(effects, context, result = {}) {
    if (result.confirmed === false) return;

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

    if (context && context.followUp && context.interruptEnemy) {
      this.enemyStunTimer = Math.max(this.enemyStunTimer, 1.5);
      this.setMessage(CombatArtDatabase.desolo.followUpMessage);
    }

    if (this.hasSpell("absorb") && context && context.isSwordChain) {
      this.applyStatusResults([this.statusSystem.apply({ target: "player", type: "absorbReady", turns: 1 }, { source: "absorb" })].filter(Boolean));
    }
  }

  resolvePlayerQTEImpact(attack) {
    const intent = attack.intent;
    const damageIntent = { ...(intent.damageIntent || intent) };
    if (intent.guardMul) {
      damageIntent.damage = Math.max(1, Math.floor((damageIntent.damage || 0) * intent.guardMul));
      damageIntent.label = `${damageIntent.label || "qte"}:guarded`;
    }
    const result = this.confirmDamage(damageIntent);
    if (result.confirmed) {
      if (damageIntent.options && damageIntent.options.isCrit) this.flashScreen("#f1c40f", 0.18);
      this.applyQTEImpactEffects(intent.effects || {}, intent.context || {}, result);
      if (!intent.suppressImpactSideEffects) {
        this.applyPlayerQTEImpactSideEffects(intent.flowEffects || intent.effects || {}, intent.context || {}, result);
      }
      if (intent.guardMul) this.setMessage("敌人防御，伤害降低");
    } else if (attack.defenderResponse === "dodge") {
      this.setMessage("敌人闪避，攻击落空");
    }
    return result;
  }

  resolveNormalAttackImpact(attack) {
    const intent = attack.intent;
    return this.confirmDamage(intent.damageIntent || intent);
  }

  resolveAuxiliaryPlayerAttackImpact(attack) {
    const intent = attack.intent;
    const result = this.confirmDamage(intent.damageIntent || intent);
    if (result.confirmed && intent.effects) {
      ChainEffectSystem.applyResources(this, intent.effects, { playerY: 300 });
      ChainEffectSystem.applyStatuses(this, intent.effects, { source: intent.kind || "active", playerY: 260, enemyY: 280 });
    }
    return result;
  }

  resolveEnemyActiveAttackImpact(attack) {
    const sourceAttack = attack.intent.attack || this.enemyAttack;
    if (attack.canceled || (!attack.intent.chainId && this.defenseTriggered)) {
      return { confirmed: false, defended: true };
    }
    if (sourceAttack && this.tryAbsorbIncomingSpell(sourceAttack)) {
      return { confirmed: false, absorbed: true };
    }

    this.enemyAttackPhase = "hit";
    if (sourceAttack) {
      this.triggerActorReaction("enemy", "attack", sourceAttack.damage >= 25 ? 1.35 : 1.05, {
        color: sourceAttack.color || "#e74c3c",
        duration: 0.28
      });
      this.emitEnemyAttackVisual(sourceAttack);
    }

    if (this.hasSpell("fire")) {
      this.commitActiveAttack({
        kind: "shieldThorn",
        source: "player",
        target: "enemy",
        token: `shieldThorn:${this.enemyAttackCursor}:${Math.round(attack.elapsed * 1000)}`,
        attackType: "pulse",
        shape: "beam",
        fromAnchor: "playerShield",
        anchor: "playerShield",
        toAnchor: "enemyCore",
        damage: SpellDatabase.fire.shieldThornDamage,
        label: "shieldThorn",
        visualEvent: "shieldThorn",
        chainFamily: "fire",
        weapon: this.playerConfig.weapon,
        damageIntent: {
          source: "player",
          target: "enemy",
          token: `shieldThorn:${this.enemyAttackCursor}:${Math.round(attack.elapsed * 1000)}`,
          shape: "beam",
          anchor: "playerShield",
          toAnchor: "enemyCore",
          damage: SpellDatabase.fire.shieldThornDamage,
          label: "shieldThorn",
          visualEvent: "shieldThorn",
          chainFamily: "fire",
          weapon: this.playerConfig.weapon
        }
      });
      this.setMessage(SpellDatabase.fire.shieldThornMessage);
    }

    const damage = attack.intent.damage || (sourceAttack ? sourceAttack.damage : 0);
    const result = this.confirmDamage({
      source: "enemy",
      target: "player",
      token: `enemy:${sourceAttack && sourceAttack.id ? sourceAttack.id : attack.id}:${this.enemyAttackCursor}:${Math.round(attack.elapsed * 1000)}`,
      shape: this.isIncomingSpellAttack(sourceAttack) ? "beam" : "arc",
      anchor: "enemyCore",
      toAnchor: "playerCore",
      damage,
      label: sourceAttack && sourceAttack.name ? sourceAttack.name : (sourceAttack && sourceAttack.id ? sourceAttack.id : "enemyAttack"),
      attackId: sourceAttack && sourceAttack.id ? sourceAttack.id : attack.intent.attackId,
      visualEvent: sourceAttack && sourceAttack.id ? sourceAttack.id : attack.intent.visualEvent,
      isEnemyAttack: true,
      isSpell: this.isIncomingSpellAttack(sourceAttack),
      options: { attackId: sourceAttack && sourceAttack.id ? sourceAttack.id : attack.intent.attackId }
    });
    if (!result.died) this.setMessage("被击中");
    return result;
  }

  finishPlayerQTEFlow(effects, context, result = {}) {
    const confirmed = result.confirmed !== false;
    if (confirmed && this.checkEnemyDefeated()) return;

    if (confirmed && effects.selfStun > 0) {
      this.startResolving(() => this.startEnemyTurn());
      return;
    }

    if (confirmed && effects.stunEnemy > 0) {
      this.enemyStunTimer = effects.stunEnemy;
    }

    if (confirmed && effects.openPlayerTurn) {
      this.setMessage("破绽打开 · 额外回合");
      this.startResolving(() => this.startPlayerTurn());
      return;
    }

    if (confirmed && effects.stunEnemy > 0) {
      this.setMessage("敌人眩晕 · 额外回合");
      this.startResolving(() => this.startPlayerTurn());
      return;
    }

    if (confirmed && this.hasCombatArt("desolo") && context && context.isSwordChain && !context.followUp) {
      this.pendingFollowUp = true;
      this.actionBar = 0;
      this.setMessage("按 A 追加");
      this.setTurnState("player_turn");
      this.qteRunner = null;
      return;
    }

    this.startResolving(() => this.startEnemyTurn());
  }

  finishEnemyResponseOrPlayerTurn() {
    if (this.checkEnemyDefeated()) return;
    if (this.hasPendingEnemyActiveAttacks()) {
      this.defenseTriggered = false;
      this.qteRunner = null;
      this.playerState.currentState = "idle";
      this.setTurnState("enemy_turn");
      this.setMessage("敌方连段继续");
      return;
    }
    this.startResolving(() => this.startPlayerTurn());
  }

  resolveDefenseQTE(effects) {
    const attack = this.enemyAttack;
    const incoming = this.getIncomingActiveAttack();
    if (incoming) this.activeAttackSystem.cancel(incoming, "defense");
    let delayedByCounter = false;
    const finishDefenseAfterCounter = () => {
      this.finishEnemyResponseOrPlayerTurn();
    };
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
      const result = this.confirmDamage({
        source: "enemy",
        target: "player",
        token: `defense-leak:${attack.id}:${this.enemyAttackCursor}:${Math.round(this.enemyAttackTimer * 1000)}`,
        shape: this.isIncomingSpellAttack(attack) ? "beam" : "arc",
        anchor: "enemyCore",
        toAnchor: "playerCore",
        damage: finalDamage,
        label: `${attack.id}:leak`,
        attackId: attack.id,
        visualEvent: `${attack.id}:leak`,
        isEnemyAttack: true,
        isSpell: this.isIncomingSpellAttack(attack)
      });
      const died = result.died;
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
      delayedByCounter = true;
      this.commitActiveAttack({
        kind: "defenseCounter",
        source: "player",
        target: "enemy",
        token: `defense-counter:${attack.id}:${this.enemyAttackCursor}:${Math.round(this.enemyAttackTimer * 1000)}`,
        attackType: this.hasSpell("fire") || this.hasSpell("absorb") ? "pulse" : "melee",
        shape: "beam",
        fromAnchor: "playerShield",
        anchor: "playerShield",
        toAnchor: "enemyCore",
        damage: Math.floor(counterDamage),
        label: `${attack.id}:counter`,
        visualEvent: `${attack.id}:counter`,
        chainFamily: this.hasSpell("absorb") ? "absorb" : (this.hasSpell("fire") ? "fire" : "defense"),
        weapon: this.playerConfig.weapon,
        color: this.hasSpell("absorb") ? "#9b59b6" : (this.hasSpell("fire") ? "#e67e22" : "#2ecc71"),
        onComplete: finishDefenseAfterCounter,
        damageIntent: {
          source: "player",
          target: "enemy",
          token: `defense-counter:${attack.id}:${this.enemyAttackCursor}:${Math.round(this.enemyAttackTimer * 1000)}`,
          shape: "beam",
          anchor: "playerShield",
          toAnchor: "enemyCore",
          damage: Math.floor(counterDamage),
          label: `${attack.id}:counter`,
          visualEvent: `${attack.id}:counter`,
          chainFamily: this.hasSpell("absorb") ? "absorb" : (this.hasSpell("fire") ? "fire" : "defense"),
          weapon: this.playerConfig.weapon
        }
      });
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
          delayedByCounter = true;
          this.commitActiveAttack({
            kind: "reflect",
            source: "player",
            target: "enemy",
            token: `absorb-reflect:${attack.id}:${this.enemyAttackCursor}:${Math.round(this.enemyAttackTimer * 1000)}`,
            attackType: "projectile",
            shape: "beam",
            fromAnchor: "playerShield",
            anchor: "playerShield",
            toAnchor: "enemyCore",
            damage: reflect,
            label: `${attack.id}:reflect`,
            visualEvent: `${attack.id}:reflect`,
            chainFamily: "absorb",
            weapon: this.playerConfig.weapon,
            color: "#9b59b6",
            onComplete: finishDefenseAfterCounter,
            damageIntent: {
              source: "player",
              target: "enemy",
              token: `absorb-reflect:${attack.id}:${this.enemyAttackCursor}:${Math.round(this.enemyAttackTimer * 1000)}`,
              shape: "beam",
              anchor: "playerShield",
              toAnchor: "enemyCore",
              damage: reflect,
              label: `${attack.id}:reflect`,
              visualEvent: `${attack.id}:reflect`,
              chainFamily: "absorb",
              weapon: this.playerConfig.weapon
            }
          });
          this.setMessage("咒还反射");
        }
        this.playerState.shieldEnchanted = true;
      }
    }

    if (delayedByCounter) return;

    if (this.checkEnemyDefeated()) return;

    if (effects.stunEnemy > 0) {
      this.cancelEnemyAttacks(this.getActiveEnemyAttacks(), "stun");
      this.enemyStunTimer = effects.stunEnemy;
      this.startResolving(() => this.startPlayerTurn());
      return;
    }

    this.finishEnemyResponseOrPlayerTurn();
  }

  // ========== 普通攻击与回合切换 ==========

  performNormalAttack(options = {}) {
    const weapon = WeaponDatabase[this.playerConfig.weapon];
    if (!weapon) return;

    let damage = weapon.normalAttack || 10;
    const style = this.getCurrentStyle();
    const automaticNoBonus = !!(options.automatic && style && style.autoAttackNoBonus);

    // 连击增伤
    const comboMul = automaticNoBonus ? 1 : this.getComboDamageMultiplier();
    if (comboMul > 1) {
      damage = Math.floor(damage * comboMul);
    }

    // 护甲破坏增伤
    const armorBreakStatus = this.statusSystem && this.statusSystem.has("armorBreak", "enemy");
    if (!automaticNoBonus && (this.armorBreakActive || armorBreakStatus)) {
      const statusMul = this.statusSystem
        ? (this.statusSystem.getDefinition("armorBreak").damageTakenMul || 1 + SpellDatabase.fire.armorBreakDamageBonus)
        : (1 + SpellDatabase.fire.armorBreakDamageBonus);
      damage = Math.floor(damage * statusMul);
    }

    // 东方：连续闪避后暴击
    if (!automaticNoBonus && this.hasCombatArt("eastern") && this.playerState.consecutiveDodges >= CombatArtDatabase.eastern.consecutiveDodgeCrit) {
      damage = Math.floor(damage * 1.5);
      this.playerState.consecutiveDodges = 0;
    }

    if (!automaticNoBonus) {
      damage = this.applyEncounterDamageModifiers(damage, { normalAttack: true, isSwordChain: true });
    }

    this.triggerActorReaction("player", "attack", 0.95, {
      color: weapon.color || "#f1c40f",
      duration: 0.28
    });
    if (this.effectQueue) {
      this.effectQueue.emit({
        type: "burst",
        kind: "slash",
        anchor: "enemyCore",
        color: weapon.color || "#f1c40f",
        secondaryColor: "#ffffff",
        length: 96,
        width: 5,
        angle: -0.35,
        duration: 0.22,
        label: "normalAttack"
      });
    }
    const token = `normal:${this.playerConfig.weapon}:${Math.round(performance.now() * 1000)}`;
    this.commitActiveAttack({
      kind: "normalAttack",
      source: "player",
      target: "enemy",
      token,
      attackType: "melee",
      shape: "arc",
      fromAnchor: "playerHand",
      anchor: "playerHand",
      toAnchor: "enemyCore",
      damage,
      label: "normalAttack",
      visualEvent: "normalAttack",
      motion: "normalAttack",
      weapon: this.playerConfig.weapon,
      chainFamily: "normal",
      color: weapon.color || "#f1c40f",
      damageIntent: {
        source: "player",
        target: "enemy",
        token,
        shape: "arc",
        anchor: "playerHand",
        toAnchor: "enemyCore",
        damage,
        label: "normalAttack",
        visualEvent: "normalAttack",
        motion: "normalAttack",
        weapon: this.playerConfig.weapon,
        chainFamily: "normal"
      }
    });
    this.setMessage(automaticNoBonus ? "自动攻击" : "普通攻击");
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
    this.enemyAttackChain = null;
    this.playerState.currentState = "idle";
    this.input.clear();

    // 护甲破坏回合衰减
    if (this.armorBreakActive) {
      this.armorBreakTurns--;
      if (this.armorBreakTurns <= 0) {
        this.armorBreakActive = false;
      }
    }

    this.maybeEnterEncounterPhase();
    const attackId = this.pickEnemyAttackId();
    if (this.isEnemyAttackChainId(attackId)) {
      this.startEnemyAttackChain(attackId);
      return;
    }

    this.enemyAttack = this.buildEnemyAttack(attackId);
    this.decorateEnemyAttackResponse(this.enemyAttack);
    this.enemyAttackTimer = 0;
    this.enemyAttackPhase = "windup";
    this.commitEnemyActiveAttack(this.enemyAttack);

    this.setMessage(`敌方回合：绿色窗口出现按 SPACE/F 防御`);
  }

  pickEnemyAttackId() {
    const encounterPattern = this.getEncounterAttackPattern();
    if (Array.isArray(encounterPattern) && encounterPattern.length > 0) {
      const attackId = encounterPattern[this.enemyAttackCursor % encounterPattern.length];
      this.enemyAttackCursor++;
      if (EnemyDatabase.attacks[attackId] || this.isEnemyAttackChainId(attackId)) return attackId;
    }

    const attackIds = (this.enemyConfig && this.enemyConfig.attacks) || EnemyDatabase.base.attacks;
    return attackIds[Math.floor(Math.random() * attackIds.length)];
  }

  isEnemyAttackChainId(id) {
    return !!(EnemyDatabase.attackChains && EnemyDatabase.attackChains[id]);
  }

  getEnemyAttackChain(chainId) {
    return (EnemyDatabase.attackChains && EnemyDatabase.attackChains[chainId]) || null;
  }

  startEnemyAttackChain(chainId) {
    const chain = this.getEnemyAttackChain(chainId);
    if (!chain || !Array.isArray(chain.nodes) || chain.nodes.length === 0) {
      this.enemyAttack = this.buildEnemyAttack("thrust");
      this.decorateEnemyAttackResponse(this.enemyAttack);
      this.commitEnemyActiveAttack(this.enemyAttack);
      this.setMessage("敌方回合：绿色窗口出现按 SPACE/F 防御");
      return;
    }

    this.enemyAttackChain = { id: chainId, ...chain };
    const attacks = chain.nodes
      .map((node, index) => this.buildEnemyAttackChainNode(chainId, chain, node, index))
      .filter(Boolean);
    this.enemyAttack = attacks[0] || null;
    this.enemyAttackTimer = 0;
    this.enemyAttackPhase = "windup";
    for (const attack of attacks) {
      this.commitEnemyActiveAttack(attack, { timelineOffset: attack.offset || 0 });
    }
    this.setMessage(`敌方连段：${chain.name} · ${attacks.length} 段攻势`);
  }

  buildEnemyAttackChainNode(chainId, chain, node, index) {
    if (!node || !EnemyDatabase.attacks[node.attackId]) return null;
    const attack = this.buildEnemyAttack(node.attackId);
    attack.chainId = chainId;
    attack.chainName = chain.name || chainId;
    attack.chainIcon = chain.icon || attack.icon;
    attack.chainNodeId = node.id || `${index + 1}`;
    attack.chainIndex = index;
    attack.chainCount = chain.nodes.length;
    attack.offset = Math.max(0, node.offset || 0);
    attack.name = `${attack.chainIndex + 1}/${attack.chainCount} ${attack.name}`;
    this.decorateEnemyAttackResponse(attack);
    return attack;
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
    this.decorateEnemyAttackResponse(attack);
    return attack;
  }

  decorateEnemyAttackResponse(attack) {
    if (!attack) return attack;
    const allowed = attack.allowedResponses || [];
    const keys = [];
    if (allowed.includes("dodge") || allowed.includes("parry")) keys.push("SPACE");
    if (allowed.includes("guard")) keys.push("F");
    attack.responseKey = keys.join(" / ") || "SPACE";
    return attack;
  }

  startPlayerTurn() {
    this.setTurnState("player_turn");
    this.showTurnBanner("玩家回合", "#3498db");
    this.tickStatuses("player");
    if (this.playerHp <= 0 || this.turnState === "game_over") return;

    this.actionBar = 0;
    const style = this.getCurrentStyle();
    this.compressedPlayerTurn = !!(style && style.actionBarMax && style.actionBarMax < 6.8);
    // 连击由超时或受击重置，额外回合保留
    this.enemyAttack = null;
    this.enemyAttackChain = null;
    this.enemyAttackPhase = "none";
    this.defenseTriggered = false;
    this.qteRunner = null;
    this.pendingFollowUp = false;
    this.playerState.currentState = "idle";
    this.input.clear();

    this.setMessage(this.compressedPlayerTurn
      ? "压缩己方回合：A/S/D 手动追击，否则自动攻击"
      : "玩家回合：按 A/S/D 选择攻击链");
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
      this.confirmDamage({
        source: "player",
        target: "enemy",
        token: `absorb-auto:${attack.id}:${this.enemyAttackCursor}:${Math.round(this.enemyAttackTimer * 1000)}`,
        shape: "beam",
        anchor: "playerShield",
        toAnchor: "enemyCore",
        damage: reflect,
        label: `${attack.id}:autoAbsorb`,
        visualEvent: `${attack.id}:autoAbsorb`,
        chainFamily: "absorb",
        weapon: this.playerConfig.weapon
      });
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

  emitEnemyAttackVisual(attack) {
    if (!this.effectQueue || !attack) return;
    const id = attack.id || "";
    const color = attack.color || "#e74c3c";
    const isSpell = this.isIncomingSpellAttack(attack);
    const isHeavy = attack.damage >= 25 || id.includes("heavy") || id.includes("smash");
    if (isSpell) {
      this.effectQueue.emit({
        type: "burst",
        kind: "beam",
        anchor: "enemyCore",
        toAnchor: "playerCore",
        color,
        width: isHeavy ? 8 : 5,
        duration: 0.28,
        label: `enemy:${id}`
      });
      this.effectQueue.emit({
        type: "particles",
        preset: "magic",
        anchor: "playerCore",
        intensity: isHeavy ? 1.3 : 0.85,
        label: `enemy:${id}`
      });
      return;
    }
    this.effectQueue.emit({
      type: "burst",
      kind: "slash",
      anchor: "playerCore",
      color,
      secondaryColor: "#ffffff",
      length: isHeavy ? 154 : 112,
      width: isHeavy ? 10 : 6,
      angle: isHeavy ? 0.95 : 0.25,
      duration: 0.26,
      label: `enemy:${id}`
    });
  }

  buildQTEHitMeta(effects = {}, context = {}) {
    const resultLog = this.qteRunner && Array.isArray(this.qteRunner.resultLog)
      ? this.qteRunner.resultLog
      : [];
    const damagingEntries = resultLog.filter(entry => entry.transition && entry.transition.damage > 0);
    const lastDamageEntry = damagingEntries[damagingEntries.length - 1] || resultLog[resultLog.length - 1] || null;
    const visualEvents = effects.visualEvents && effects.visualEvents.length > 0
      ? effects.visualEvents
      : resultLog.map(entry => entry.transition && entry.transition.visualEvent).filter(Boolean);
    const text = [
      context.chainId,
      context.chainFamily,
      context.isSwordChain ? "sword" : "",
      lastDamageEntry && lastDamageEntry.nodeId,
      lastDamageEntry && lastDamageEntry.outcome,
      lastDamageEntry && lastDamageEntry.transition && lastDamageEntry.transition.visualEvent,
      ...visualEvents
    ].filter(Boolean).join(" ").toLowerCase();
    const isSpellImpact = context.chainFamily === "absorb"
      || text.includes("fireball")
      || text.includes("overflow")
      || text.includes("absorb")
      || text.includes("spell");

    return {
      shape: isSpellImpact ? "beam" : "arc",
      weapon: this.playerConfig.weapon,
      chainId: context.chainId,
      chainFamily: context.chainFamily,
      visualEvent: lastDamageEntry && lastDamageEntry.transition ? lastDamageEntry.transition.visualEvent : visualEvents[visualEvents.length - 1],
      visualEvents,
      motion: lastDamageEntry ? lastDamageEntry.nodeId : "",
      outcomes: resultLog.map(entry => entry.outcome).filter(Boolean),
      strikeCount: damagingEntries.length || (effects.damage > 0 ? 1 : 0)
    };
  }

  confirmDamage(intent = {}) {
    if (this.hitConfirmSystem) {
      return this.hitConfirmSystem.confirm(intent);
    }
    const target = intent.target || (intent.source === "enemy" ? "player" : "enemy");
    const died = intent.damage > 0 ? this.applyDamage(target, intent.damage, intent.options || {}) : false;
    return {
      confirmed: true,
      duplicate: false,
      overlap: true,
      damage: Math.max(0, Math.floor(intent.damage || 0)),
      died
    };
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
    const impact = options.impact || null;

    if (target === "player") {
      const force = impact ? impact.force : 1.1;
      this.playerHp = Math.max(0, this.playerHp - amount);
      this.screenShake = Math.max(0.18, 0.18 + force * 0.06);
      this.hitStop = Math.max(0.10, 0.08 + force * 0.03);
      this.floatingTexts.add(`-${amount}`, px, py - 40, "damage");
      this.spawnParticles("hit", px, py, 1);
      if (this.effectQueue) {
        this.effectQueue.emit({
          type: "burst",
          kind: "spark",
          anchor: "playerCore",
          color: "#e74c3c",
          coreColor: "#ffffff",
          radius: 46,
          width: 4,
          duration: 0.24,
          label: "playerHit"
        });
      }
      this.triggerActorReaction("player", "hit", force, {
        color: "#e74c3c",
        direction: impact ? impact.direction : -1,
        distance: impact ? impact.distance : 28,
        lift: impact ? impact.lift : 6,
        duration: impact ? Math.max(0.24, 0.18 + force * 0.08) : undefined
      });
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
      const force = impact ? impact.force : (options.isCrit ? 1.35 : 1);
      this.enemyHp = Math.max(0, this.enemyHp - amount);
      this.battleStats.damageDealt += amount;
      this.screenShake = options.isCrit ? Math.max(0.25, 0.18 + force * 0.06) : Math.max(0.14, 0.10 + force * 0.05);
      this.hitStop = options.isCrit ? Math.max(0.12, 0.08 + force * 0.035) : Math.max(0.07, 0.055 + force * 0.025);
      const textType = options.isCrit ? "crit" : "damage";
      this.floatingTexts.add(`-${amount}`, ex, ey - 40, textType);
      this.spawnParticles(options.isCrit ? "slash" : "hit", ex, ey, options.isCrit ? 1.5 : 1);
      if (this.effectQueue) {
        this.effectQueue.emit({
          type: "burst",
          kind: "spark",
          anchor: "enemyCore",
          color: options.isCrit ? "#f1c40f" : "#ffffff",
          coreColor: options.isCrit ? "#ffffff" : "#f5c6c6",
          radius: options.isCrit ? 66 : 48,
          width: options.isCrit ? 6 : 4,
          duration: options.isCrit ? 0.30 : 0.22,
          label: options.isCrit ? "enemyCrit" : "enemyHit"
        });
      }
      this.triggerActorReaction("enemy", options.isCrit ? "crit" : "hit", force, {
        color: options.isCrit ? "#f1c40f" : "#ffffff",
        direction: impact ? impact.direction : 1,
        distance: impact ? impact.distance : (options.isCrit ? 42 : 26),
        lift: impact ? impact.lift : (options.isCrit ? 8 : 5),
        duration: impact ? Math.max(options.isCrit ? 0.30 : 0.23, 0.17 + force * 0.08) : undefined
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

  getCurrentStyle() {
    return this.playerConfig.style ? StyleDatabase[this.playerConfig.style] : null;
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
    const incoming = this.getIncomingActiveAttack();
    if (incoming) this.activeAttackSystem.pause(incoming, defenseId);
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
    this.applyQTEPacing(chain, chainId, { source: "enemy", defense: true });

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

    const timing = this.getEnemyActiveAttackTiming(attack, attack.offset || 0);
    const responseStart = timing.responseStart;
    const remaining = timing.impactTime - triggerTime;

    // 按得太急（刚进入反应窗口就按）=> 过早，会落入 onFail
    if (triggerTime < responseStart + 0.08) return "early";
    // 按得太晚（攻击已命中）=> 过晚，会落入 onFail
    if (remaining < 0) return "late";
    // 在命中前 0.18 秒内按下 => 完美
    if (remaining <= Math.min(0.18, timing.responseDuration * 0.35)) return "perfect";
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

    // 统计
    this.battleStats.attempts++;
    if (outcome === "perfect" || outcome === "success") {
      this.battleStats.hits++;
    } else {
      this.battleStats.misses++;
    }
    if (outcome === "perfect") this.battleStats.perfectCount++;

    if (outcome !== "success") this.spawnFloatingText(label, x, y, "popup");

    if (outcome === "perfect") {
      SFX.sfxPerfect();
      this.hitStop = 0.16;
      this.timeScale = 0.25;
      this.timeScaleTimer = 0.38;
      this.addCombo();
      this.setCameraZoom(1.12, 0.25);
      this.triggerImpactFrames(1);
    } else if (outcome === "success") {
      SFX.sfxSuccess();
      this.hitStop = 0.11;
      this.addCombo();
    } else if (outcome === "early" || outcome === "late") {
      SFX.sfxFail();
      this.resetCombo();
    } else {
      SFX.sfxFail();
      this.hitStop = 0.07;
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
    this.turnBanner = { text, color, timer: 1.45, maxTime: 1.45 };
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

  getBattleResultLines() {
    const stats = this.getBattleStats();
    const encounterName = this.encounterConfig ? this.encounterConfig.name : (this.enemyConfig && this.enemyConfig.name ? this.enemyConfig.name : "训练目标");
    const phase = this.getCurrentEncounterPhase()
      || (this.encounterConfig && Array.isArray(this.encounterConfig.phases)
        ? this.encounterConfig.phases.find(item => item.id === this.activeEncounterPhaseId)
        : null);
    const phaseName = phase ? phase.name : "常态";
    return [
      `遭遇：${encounterName} / 阶段：${phaseName}`,
      `输出：${stats.damageDealt}  命中率：${stats.accuracy}%  Perfect：${stats.perfectCount}`,
      `最大连击：${stats.maxCombo}  受击：${stats.hitsTaken}`,
      `剩余 HP：${this.playerHp}/${this.playerMaxHp}  敌方：${this.enemyHp}/${this.enemyMaxHp}`
    ];
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
