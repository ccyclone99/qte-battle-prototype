class DemoMode {
  constructor(input, onLog) {
    this.input = input;
    this.onLog = onLog || (() => {});

    this._state = "main"; // main | list | qte | preview
    this.category = null;
    this.qteRunner = null;

    this.message = "效果演示模式 — 选择分类查看每一种实现效果";
    this.previewText = "";
    this.previewTitle = "";
    this.previewTimer = 0;
    this.detailLines = [];
    this.resultLines = [];
    this.lastTimelineRows = [];
    this.currentItem = null;
    this.activeDemoPacing = null;
    this.currentCategoryName = "";
    this.listPage = 0;
    this.pageSize = 6;

    this.manualMode = false;

    this.particles = new ParticleSystem();
    this.effectBursts = new EffectBurstSystem();
    this.actorReactions = new ActorReactionSystem();
    this.floatingTexts = new FloatingTextManager();
    this.effectQueue = new EffectEventQueue(this, { mode: "demo" });
    this.statusSystem = new StatusSystem(this);
    this.resourceSystem = new ResourceSystem(this);

    this.screenShake = 0;
    this.hitStop = 0;
    this.turnBanner = null;
    this.screenFlash = null;

    this.logs = [];
    this.returnToMenu = false;

    // 可切换的战斗风格
    this.playerConfig = { style: "fire", weapon: "staff", spells: ["fire"], combatArts: [] };
    this.playerHp = 100;
    this.playerMaxHp = 100;
    this.enemyHp = 200;
    this.enemyMaxHp = 200;
    this.playerState = {
      spellEnergy: 0,
      maxSpellEnergy: 100,
      consecutiveDodges: 0,
      lastAttackTime: 0,
      shieldEnchanted: false,
      absorbReady: false,
      currentState: "idle"
    };
    this.armorBreakActive = false;
    this.armorBreakTurns = 0;
    this.enemyStunTimer = 0;
    this.actionBar = 0;
    this.actionBarMax = 5;

    // 演示速度参数
    this.normalDemoTimeScale = 0.90;
    this.normalPostNodePause = 0.18;
    this.defenseTimeScale = 0.68;
    this.defensePostNodePause = 0.32;
    this.windupTimeScale = 0.75;

    // 防御演示专用：模拟敌方回合
    this.enemyAttack = null;
    this.enemyAttackTimer = 0;
    this.enemyAttackPhase = "none";
    this.pendingDefenseItem = null;
    this.demoDefenseKey = null;
    this.freezeTimer = 0;
    this.actionSequence = null;
    this.demoCounterAttack = false;

    // 演出镜头 / 冲击帧 / 过场卡片
    this.cameraZoom = 1;
    this.cameraZoomTimer = 0;
    this.impactFrames = 0;
    this.transition = null;
    this.chargeFxTimer = 0;

    this.categories = [
      { key: "showcases", name: "亮点演示", icon: "★", description: "一键观看火焰、咒还、武器链和防御反击的完整高光片段。" },
      { key: "weapons", name: "风格链", icon: "⚔", description: "展示当前风格武器的 QTE 链、输入节点和伤害分支。" },
      { key: "spells", name: "咒术", icon: "🔥", description: "展示蓄力、反伤、破甲、咒还吸收和能量过载。" },
      { key: "arts", name: "战技", icon: "🗡", description: "展示反击、必暴、闪避取消、追加攻击和打断。" },
      { key: "defenses", name: "防御反击", icon: "🛡", description: "展示闪避、格挡、弹反等敌方回合应对链路。" }
    ];
  }

  // ========== 风格切换 ==========

  get styleList() {
    return Object.entries(StyleDatabase);
  }

  applyStyle(styleId) {
    const style = StyleDatabase[styleId];
    if (!style) return;
    this.playerConfig.style = styleId;
    this.playerConfig.weapon = style.weapon || null;
    this.playerConfig.spells = style.spells ? [...style.spells] : [];
    this.playerConfig.combatArts = style.combatArts ? [...style.combatArts] : [];
  }

  cycleWeapon() {
    const styles = this.styleList;
    const currentIdx = styles.findIndex(([id]) => id === this.playerConfig.style);
    const nextIdx = (currentIdx + 1) % styles.length;
    this.applyStyle(styles[nextIdx][0]);
    this.listPage = 0;
    this.resetHP();
    const style = StyleDatabase[this.playerConfig.style];
    this.message = `已切换风格：${style.name} [${style.key}] — 选择分类查看效果`;
  }

  resetHP() {
    this.playerHp = this.playerMaxHp;
    this.enemyHp = this.enemyMaxHp;
    this.enemyStunTimer = 0;
    this.armorBreakActive = false;
    this.armorBreakTurns = 0;
    this.playerState.spellEnergy = 0;
    this.playerState.consecutiveDodges = 0;
    this.playerState.shieldEnchanted = false;
    this.playerState.absorbReady = false;
    this.playerState.currentState = "idle";
    this.statusSystem.clear();
    this.effectQueue.clear();
    if (this.effectBursts) this.effectBursts.clear();
    if (this.actorReactions) this.actorReactions.clear();
    if (this.resourceSystem) {
      if (typeof this.resourceSystem.reset === "function") {
        this.resourceSystem.reset();
      } else {
        this.resourceSystem.heat = 0;
      }
    }
    this.lastTimelineRows = [];
  }

  // ========== 主更新 ==========

  update(dt) {
    if (this.effectQueue) this.effectQueue.update(dt);

    if (this.hitStop > 0) {
      this.hitStop -= dt;
      if (this.hitStop < 0) this.hitStop = 0;
      return;
    }

    if (this.screenShake > 0) {
      this.screenShake -= dt;
      if (this.screenShake < 0) this.screenShake = 0;
    }

    if (this.freezeTimer > 0) {
      this.freezeTimer -= dt;
      if (this.freezeTimer < 0) this.freezeTimer = 0;
      this.particles.update(dt);
      this.floatingTexts.update(dt);
      return;
    }

    if (this.turnBanner) {
      this.turnBanner.timer -= dt;
      if (this.turnBanner.timer <= 0) this.turnBanner = null;
    }

    if (this.screenFlash) {
      this.screenFlash.timer -= dt;
      if (this.screenFlash.timer <= 0) this.screenFlash = null;
    }

    if (this.cameraZoomTimer > 0) {
      this.cameraZoomTimer -= dt;
      if (this.cameraZoomTimer <= 0) this.cameraZoom = 1;
    }

    if (this.impactFrames > 0) {
      this.impactFrames--;
    }

    if (this.transition) {
      this.transition.timer -= dt;
      if (this.transition.timer <= 0) this.transition = null;
    }

    this.particles.update(dt);
    if (this.effectBursts) this.effectBursts.update(dt);
    if (this.actorReactions) this.actorReactions.update(dt);
    this.floatingTexts.update(dt);

    if (this.state === "qte") {
      this.updateQTE(dt);
    } else if (this.state === "enemy_windup") {
      this.updateEnemyWindup(dt);
    } else if (this.state === "action_sequence") {
      this.updateActionSequence(dt);
    } else if (this.state === "preview") {
      if (this.previewTimer > 0) this.previewTimer -= dt;
      this.consumePreviewInput();
    } else {
      this.consumeMenuInputs();
    }
  }

  // ========== 输入处理 ==========

  consumePreviewInput() {
    while (true) {
      const ev = this.input.peek();
      if (!ev) return;
      if (ev.type !== "press") { this.input.consume(); continue; }

      const key = ev.key.toUpperCase();
      if (key === "ESCAPE") {
        this.input.consume();
        this.setState("list");
        this.resetHP();
        this.input.clear();
        this.message = `${this.getCategoryName()} — 按数字选择效果，ESC 返回`;
        return;
      }
      if (key === "R" && this.currentItem) {
        const item = this.currentItem;
        this.input.consume();
        this.resetHP();
        this.playItem(item);
        this.input.clear();
        return;
      }
      // 任意其他键也返回列表
      this.input.consume();
      this.setState("list");
      this.resetHP();
      this.input.clear();
      this.message = `${this.getCategoryName()} — 按数字选择效果，ESC 返回`;
      return;
    }
  }

  consumeMenuInputs() {
    while (true) {
      const ev = this.input.peek();
      if (!ev) return;

      if (ev.type !== "press") {
        this.input.consume();
        continue;
      }

      const key = ev.key.toUpperCase();

      if (key === "ESCAPE") {
        this.input.consume();
        if (this.state === "main") {
          this.returnToMenu = true;
          return;
        } else {
          this.setState("main");
          this.listPage = 0;
          this.resetHP();
          this.message = "效果演示模式 — 选择分类查看每一种实现效果";
        }
        return;
      }

      if (this.state === "main") {
        const idx = parseInt(ev.key);
        if (idx >= 1 && idx <= this.categories.length) {
          this.input.consume();
          this.category = this.categories[idx - 1].key;
          this.setState("list");
          this.listPage = 0;
          this.resetHP();
          this.message = `${this.categories[idx - 1].name} — 按数字选择效果，ESC 返回`;
          return;
        }
        // W 键切换风格
        if (key === "W") {
          this.input.consume();
          this.cycleWeapon();
          return;
        }
        // M 切换手动/自动
        if (key === "M") {
          this.input.consume();
          this.manualMode = !this.manualMode;
          this.message = `已切换为${this.manualMode ? "手动试玩" : "自动演示"}模式`;
          return;
        }
        // 6 切换难度（仅用于展示缩放参数）
        if (key === "6") {
          this.input.consume();
          const diffs = Object.keys(Difficulty.presets);
          const curIdx = diffs.indexOf(Difficulty.current);
          const next = diffs[(curIdx + 1) % diffs.length];
          Difficulty.set(next);
          this.message = `已切换难度：${Difficulty.get().name}（演示中自动 Perfect，仅影响链参数展示）`;
          return;
        }
      } else if (this.state === "list") {
        const items = this.getCurrentPageItems();
        const totalPages = this.getTotalPages();

        if (key === "M") {
          this.input.consume();
          this.manualMode = !this.manualMode;
          this.message = `已切换为${this.manualMode ? "手动试玩" : "自动演示"}模式`;
          return;
        }

        if (key === "A" || key === "ARROWLEFT") {
          this.input.consume();
          this.listPage = (this.listPage + totalPages - 1) % totalPages;
          this.message = `${this.getCategoryName()} — 第 ${this.listPage + 1}/${totalPages} 页`;
          return;
        }

        if (key === "D" || key === "ARROWRIGHT") {
          this.input.consume();
          this.listPage = (this.listPage + 1) % totalPages;
          this.message = `${this.getCategoryName()} — 第 ${this.listPage + 1}/${totalPages} 页`;
          return;
        }

        const idx = parseInt(ev.key);
        if (idx >= 1 && idx <= items.length) {
          this.input.consume();
          this.playItem(items[idx - 1]);
          return;
        }
      }

      this.input.consume();
    }
  }

  getCategoryName() {
    const cat = this.categories.find(c => c.key === this.category);
    return cat ? cat.name : "";
  }

  getCurrentItems() {
    return this.state === "list" ? this.getItems(this.category) : [];
  }

  getTotalPages(items = this.getItems(this.category)) {
    return Math.max(1, Math.ceil(items.length / this.pageSize));
  }

  getCurrentPageItems() {
    const items = this.getItems(this.category);
    const totalPages = this.getTotalPages(items);
    this.listPage = Utils.clamp(this.listPage, 0, totalPages - 1);
    const start = this.listPage * this.pageSize;
    return items.slice(start, start + this.pageSize);
  }

  currentStyle() {
    return this.playerConfig.style ? StyleDatabase[this.playerConfig.style] : null;
  }

  getChainId(chain) {
    if (!chain) return null;
    for (const [id, item] of Object.entries(ChainDatabase)) {
      if (item === chain) return id;
    }
    return null;
  }

  defaultDirectorLines(chain, chainId = "") {
    if (!chain) return [];
    const tags = new Set(chain.tags || []);
    const lines = [];

    if (chain.family === "greatsword") lines.push("观察重武器起手、蓄力和后摇差异");
    if (chain.family === "dualBlades") lines.push("观察高速连段、分支和收刀补救");
    if (chain.family === "staff") lines.push("观察节奏吟唱与最终释放");
    if (chain.family === "fire") lines.push("观察热量、燃烧和火焰分支");
    if (chain.family === "absorb") lines.push("观察法术能量、吸收和过载风险");
    if (tags.has("armorBreak")) lines.push("看破甲状态何时出现");
    if (tags.has("spender")) lines.push("看资源消耗如何换爆发");
    if (tags.has("defense")) lines.push("看绿色窗口和防御收益");
    if (chainId) lines.push(`调试焦点：${chainId}`);

    return lines.slice(0, 3);
  }

  getDirectorLines(item = this.currentItem, limit = 4) {
    if (!item) return [];
    const chainId = item.chainId || this.getChainId(item.chain);
    const lines = item.director && item.director.length > 0
      ? item.director
      : this.defaultDirectorLines(item.chain, chainId);
    return lines.slice(0, limit);
  }

  getActiveDirectorLines(limit = 4) {
    const lines = [];
    const itemLines = this.getDirectorLines(this.currentItem, 2);
    if (this.qteRunner) {
      const node = this.qteRunner.currentNode();
      if (node) {
        lines.push(`当前节点：${node.name}`);
        if (node.input && node.input.type === "hold_release") lines.push("焦点：松手窗口提前出现，别等满条");
        else if (node.input && node.input.type === "rhythm") lines.push("焦点：按节拍推进，乱按会记 miss");
        else lines.push("焦点：绿色窗内成功，金线附近 Perfect");
      }
    }
    return lines.concat(itemLines).slice(0, limit);
  }

  getPreviewSummaryLines(limit = 7) {
    const lines = [];
    for (const line of this.getDirectorLines(this.currentItem, 2)) {
      lines.push(`看点：${line}`);
    }
    for (const line of (this.resultLines || []).slice(0, 4)) {
      lines.push(line);
    }
    const timeline = this.getActualTimelineLines(4).filter(line => line !== "时间轴" && line !== "时间轴：无");
    for (const line of timeline.slice(0, 3)) {
      lines.push(line);
    }
    return lines.slice(0, limit);
  }

  // ========== 演示项构造 ==========

  getShowcaseItems() {
    const phase = (label, detail, key, effect) => ({ duration: 0.8, label, detail, key, effect });
    const fireShowcase = [
      phase("① 火星弹分支", "过早松手会保留补正，而不是直接断链。", "A", (demo) => {
        demo.spawnFloatingText("Early", 220, 220, "popup");
        demo.spawnFloatingText("火星弹", 740, 210, "status");
        demo.spawnFloatingText("-16", 740, 250, "damage");
        demo.emitTransitionVisual({ visualEvent: "fireSparkHit", damage: 16 });
        demo.log("火球分支：过早聚焰 -> 火星弹补正");
      }),
      phase("② 标准爆燃", "稳定聚焰进入标准火球，获得热量并施加燃烧。", "A", (demo) => {
        demo.spawnFloatingText("Success", 220, 220, "popup");
        demo.spawnFloatingText("-32", 740, 245, "damage");
        demo.resourceSystem.add("heat", 12);
        demo.emitTransitionVisual({ visualEvent: "fireball", damage: 32, resource: { heat: 12 } });
        demo.log("火球分支：标准爆燃命中");
      }),
      phase("③ 临界大火球", "Perfect 聚焰触发大火球、燃烧和短眩晕。", "A", (demo) => {
        demo.spawnFloatingText("PERFECT", 220, 220, "popup");
        demo.spawnFloatingText("-55", 740, 245, "crit");
        demo.enemyHp = Math.max(0, demo.enemyHp - 55);
        demo.enemyStunTimer = 0.4;
        demo.resourceSystem.add("heat", 18);
        demo.applyStatusResults([demo.statusSystem.apply({ target: "enemy", type: "burn", turns: 2 }, { source: "showcase-fire" })].filter(Boolean));
        demo.emitTransitionVisual({ visualEvent: "fireballBig", damage: 55, stunEnemy: 0.4, resource: { heat: 18 } });
        demo.log("火球分支：Perfect 临界大火球");
      }),
      phase("④ 分支对比完成", "Early 有补正，Success 稳定，Perfect 才是爆发和状态收益。", "", (demo) => {
        demo.spawnFloatingText("火焰链路清晰", 480, 230, "status");
        demo.flashScreen("#e67e22", 0.16);
        if (SFX.sfxShowcase) SFX.sfxShowcase();
      })
    ];

    const absorbShowcase = [
      phase("① 刻下咒还印", "先建立吸收结构，准备把外部法术压进能量槽。", "S", (demo) => {
        demo.spawnFloatingText("刻印", 220, 220, "status");
        demo.emitTransitionVisual({ visualEvent: "absorbGlyph" });
        demo.log("咒还：刻下引流印");
      }),
      phase("② 回流节奏", "踩准节奏获得大量法术能量。", "S", (demo) => {
        demo.spawnFloatingText("+60 法术能量", 220, 210, "status");
        demo.resourceSystem.add("spellEnergy", 60);
        demo.emitTransitionVisual({ visualEvent: "absorbSiphonPeak", resource: { spellEnergy: 60 } });
        demo.log("咒还：回流节奏完成");
      }),
      phase("③ 溢流准备", "能量过上限后进入高风险爆发窗口。", "D", (demo) => {
        demo.playerState.spellEnergy = 120;
        demo.spawnFloatingText("溢流 120", 220, 210, "popup");
        demo.applyStatusResults([demo.statusSystem.apply({ target: "player", type: "overload", turns: 1 }, { source: "showcase-absorb" })].filter(Boolean));
        demo.emitTransitionVisual({ visualEvent: "overflowBurst" });
        if (typeof SFX !== "undefined" && SFX.sfxResourceGain) SFX.sfxResourceGain();
        demo.log("咒还：能量进入溢流区");
      }),
      phase("④ 裂隙爆发", "消耗法术能量，换取高伤害和短眩晕。", "D", (demo) => {
        demo.playerState.spellEnergy = 60;
        demo.spawnFloatingText("-60 法术能量", 220, 230, "status");
        demo.spawnFloatingText("-78", 740, 245, "crit");
        demo.enemyHp = Math.max(0, demo.enemyHp - 78);
        demo.enemyStunTimer = 0.45;
        demo.emitTransitionVisual({ visualEvent: "overflowBurstPeak", damage: 78, stunEnemy: 0.45, resource: { spellEnergy: -60 } });
        demo.log("咒还：溢流裂隙爆发");
      })
    ];

    const flameBladeShowcase = [
      phase("① 引火上刃", "武器链开始积累热量。", "A", (demo) => {
        demo.spawnFloatingText("刃上起火", 220, 220, "status");
        demo.resourceSystem.add("heat", 8);
        demo.emitTransitionVisual({ visualEvent: "fireBladeIgnite", resource: { heat: 8 } });
      }),
      phase("② 熔甲压斩", "火焰武器链施加破甲，为终结爆发铺路。", "A", (demo) => {
        demo.spawnFloatingText("破甲", 740, 200, "status");
        demo.spawnFloatingText("-22", 740, 245, "damage");
        demo.resourceSystem.add("heat", 12);
        demo.applyStatusResults([demo.statusSystem.apply({ target: "enemy", type: "armorBreak", turns: 1 }, { source: "showcase-flame-blade" })].filter(Boolean));
        demo.emitTransitionVisual({ visualEvent: "fireBladeSlash", damage: 22, resource: { heat: 12 } });
      }),
      phase("③ 爆燃收束", "终结段把热量、燃烧和控制一次性打出来。", "D", (demo) => {
        demo.spawnFloatingText("-56", 740, 245, "crit");
        demo.enemyHp = Math.max(0, demo.enemyHp - 56);
        demo.enemyStunTimer = 0.35;
        demo.resourceSystem.add("heat", 14);
        demo.applyStatusResults([demo.statusSystem.apply({ target: "enemy", type: "burn", turns: 2 }, { source: "showcase-flame-blade" })].filter(Boolean));
        demo.emitTransitionVisual({ visualEvent: "fireBladeBurst", damage: 56, stunEnemy: 0.35, resource: { heat: 14 } });
      }),
      phase("④ 武器+咒术联动", "风格链现在能同时表达武器身份、咒术资源和状态收益。", "", (demo) => {
        demo.spawnFloatingText("热量 / 破甲 / 燃烧", 480, 230, "status");
        demo.flashScreen("#f39c12", 0.14);
      })
    ];

    const defenseShowcase = [
      phase("① 敌人意图出现", "攻击条显示类型、危险等级和推荐应对。", "", (demo) => {
        demo.enemyAttack = Difficulty.scaleAttack({ id: "curseBurst", ...EnemyDatabase.attacks.curseBurst });
        demo.enemyAttackTimer = 0.35;
        demo.enemyAttackPhase = "windup";
        demo.demoDefenseKey = "SPACE/F";
        demo.showTurnBanner("敌方回合", "#e74c3c");
        demo.log("敌方回合：咒爆开始预警");
        if (SFX.sfxThreat) SFX.sfxThreat();
      }),
      phase("② 绿色窗口打开", "窗口打开后再输入，过早按键会被丢弃。", "SPACE", (demo) => {
        demo.enemyAttackTimer = Math.max(0, demo.enemyAttack.windup - Difficulty.responseDuration() + 0.05);
        demo.enemyAttackPhase = "response";
        demo.spawnFloatingText("可防御", 480, 250, "status");
        if (SFX.sfxWindowOpen) SFX.sfxWindowOpen();
      }),
      phase("③ 镜咒折返", "法术类攻击可以用咒还防御反射。", "F", (demo) => {
        demo.spawnFloatingText("折返！", 220, 220, "popup");
        demo.spawnFloatingText("-24", 740, 245, "crit");
        demo.playerState.spellEnergy = 32;
        demo.resourceSystem.add("spellEnergy", 32);
        demo.emitTransitionVisual({ visualEvent: "mirrorGuardPerfect", damage: 24, resource: { spellEnergy: 32 } });
      }),
      phase("④ 防御反击完成", "敌方回合不只是躲伤害，也能转成资源和反击。", "", (demo) => {
        demo.enemyAttackPhase = "none";
        demo.enemyAttack = null;
        demo.spawnFloatingText("资源反转", 220, 220, "status");
        demo.flashScreen("#9b59b6", 0.14);
      })
    ];

    return [
      {
        name: "Showcase · 火球三分支对比",
        description: "连续展示火星弹、标准爆燃和临界大火球三种结果。",
        actionSequence: fireShowcase,
        setup: (demo) => demo.applyStyle("fire"),
        preview: "Early / Success / Perfect 分支一眼对比",
        details: ["展示重点：分支结果、热量、燃烧、眩晕、爆发差异。"]
      },
      {
        name: "Showcase · 咒还到溢流爆发",
        description: "从咒还引流、能量过载到裂隙爆发的完整资源链。",
        actionSequence: absorbShowcase,
        setup: (demo) => demo.applyStyle("mirrorblade"),
        preview: "引流 -> 溢流 -> 爆发",
        details: ["展示重点：法术能量、过载风险、溢流消耗和爆发收益。"]
      },
      {
        name: "Showcase · 焰刃破甲燃烧",
        description: "展示武器链与火焰咒术融合后的破甲、热量和燃烧收益。",
        actionSequence: flameBladeShowcase,
        setup: (demo) => demo.applyStyle("flameforge"),
        preview: "引火上刃 -> 熔甲压斩 -> 爆燃收束",
        details: ["展示重点：武器链、咒术资源和状态收益同时可见。"]
      },
      {
        name: "Showcase · 敌方回合防反",
        description: "展示敌人意图、绿色反应窗口、推荐按键和防御反击收益。",
        actionSequence: defenseShowcase,
        setup: (demo) => demo.applyStyle("mirrorblade"),
        preview: "敌方预警 -> 绿色窗口 -> 镜咒折返",
        details: ["展示重点：危险等级、输入时机、反击和资源反转。"]
      }
    ];
  }

  getItems(category) {
    const items = [];
    const weaponId = this.playerConfig.weapon;
    const weapon = WeaponDatabase[weaponId];

    if (category === "showcases") {
      return this.getShowcaseItems();
    }

    if (category === "weapons") {
      const style = StyleDatabase[this.playerConfig.style];
      // 当前配置实际生效的链（含咒术覆盖、战技追加）
      const effectiveChains = Utils.getEffectiveChains(this.playerConfig);
      for (const [chainKey, chainId] of Object.entries(effectiveChains)) {
        const chainConfig = ChainDatabase[chainId];
        if (!chainConfig) continue;
        items.push({
          name: `${weapon.name} · ${chainConfig.name} [${chainKey}]`,
          description: chainConfig.description,
          chain: chainConfig,
          chainId,
          source: "player",
          preview: `${style ? style.name : weapon.name} — ${chainConfig.name}`,
          director: this.defaultDirectorLines(chainConfig, chainId)
        });
      }
      // 普通攻击
      if (weapon.normalAttack) {
        items.push({
          name: `${weapon.name} · 普通攻击`,
          description: `行动条满自动触发，伤害 ${weapon.normalAttack}`,
          action: () => {
            const dmg = weapon.normalAttack;
            this.enemyHp = Math.max(0, this.enemyHp - dmg);
            this.spawnFloatingText(`-${dmg}`, 740, 220, "damage");
            this.spawnParticles("hit", 740, 260, 1);
            this.shakeScreen(0.12);
            this.flashScreen("#ffffff", 0.1);
            return `${weapon.name} 普通攻击，造成 ${dmg} 伤害`;
          }
        });
      }
    }

    if (category === "spells") {
      const fireChain = ChainDatabase[SpellDatabase.fire.chainMap.staff.A];
      const absorbChain = ChainDatabase[SpellDatabase.absorb.chainMap.staff.S];
      const flameBladeChain = ChainDatabase.flame_blade;
      const shieldFlareChain = ChainDatabase.shield_flare;
      const mirrorGuardChain = ChainDatabase.mirror_guard;
      const overflowBurstChain = ChainDatabase.overflow_burst;
      items.push(
        {
          name: "烈火重重 · 火星分支",
          description: "聚焰过早会切到火星弹，仍保留一次补正输入。",
          chain: fireChain,
          chainId: "fireball_evolution_v2",
          source: "player",
          forceOutcome: "early",
          preview: "点燃过快 / 聚焰过早 → 火星弹",
          director: ["观察 Early 分支不会断链", "看火星弹作为补正输出", "对比 Perfect 路线的热量收益"]
        },
        {
          name: "烈火重重 · 标准爆燃",
          description: "稳定点燃、正常聚焰后释放标准火球。",
          chain: fireChain,
          chainId: "fireball_evolution_v2",
          source: "player",
          forceOutcome: "success",
          preview: "点燃 → 聚焰 → 标准火球",
          director: ["观察标准火球路线", "看热量中量增长", "作为 Early / Perfect 对照基线"]
        },
        {
          name: "烈火重重 · 临界大火球",
          description: "完美聚焰会放大火球并附加短暂眩晕与燃烧提示。",
          chain: fireChain,
          chainId: "fireball_evolution_v2",
          source: "player",
          forceOutcome: "perfect",
          preview: "完美点燃 → 临界聚焰 → 爆燃火球",
          director: ["看聚焰临界点", "观察爆燃火球与燃烧状态", "对比标准路线的伤害和热量"]
        },
        {
          name: "咒还 · 引流刻印",
          description: "主动刻下咒还印，踩准回流节奏后获得法术能量。",
          chain: absorbChain,
          chainId: "absorb_siphon",
          source: "player",
          forceOutcome: "success",
          preview: "刻印 → 回流节奏 → 反咒命中",
          director: ["观察节奏点逐个推进", "看法术能量回流", "准备后续咒还反击"]
        },
        {
          name: "咒还 · 完美回流",
          description: "完美回流可获得更多法术能量，并准备下一次吸收反击。",
          chain: absorbChain,
          chainId: "absorb_siphon",
          source: "player",
          forceOutcome: "perfect",
          preview: "完美刻印 → 完美回流 → 反咒爆发",
          director: ["看 Perfect 节奏奖励", "观察吸收准备状态", "为溢流爆发积累资源"]
        },
        {
          name: "烈火重重 · 焰刃熔甲",
          description: "火焰与武器融合，命中会积累热量，Perfect 路线附加破甲与燃烧。",
          chain: flameBladeChain,
          chainId: "flame_blade",
          source: "player",
          forceOutcome: "perfect",
          preview: "引火上刃 → 熔甲压斩 → 爆燃收束",
          director: ["先看热量增长", "再看熔甲破甲状态", "最后看爆燃收束附加燃烧"]
        },
        {
          name: "烈火重重 · 盾焰格挡",
          description: "格挡瞬间爆出火环，展示 Fire 的防御反应链。",
          chain: shieldFlareChain,
          chainId: "shield_flare",
          source: "enemy",
          attackId: "slash",
          forceOutcome: "perfect",
          preview: "敌方横扫 → 盾焰反冲 → 返还燃烧",
          director: ["看敌方绿色窗口", "看盾焰反冲减伤", "观察燃烧回敬"]
        },
        {
          name: "咒还 · 镜咒弹反",
          description: "用镜面咒还折返法术，展示 Absorb 的防御反应链。",
          chain: mirrorGuardChain,
          chainId: "mirror_guard",
          source: "enemy",
          attackId: "spellCast",
          forceOutcome: "perfect",
          preview: "敌方法术 → 镜面展开 → 法术折返",
          director: ["看法术被镜面接住", "观察能量获得", "看吸收准备状态"]
        },
        {
          name: "咒还 · 溢流爆发",
          description: "消耗 60 法术能量，将过载压成高伤爆发。",
          chain: overflowBurstChain,
          chainId: "overflow_burst",
          source: "player",
          forceOutcome: "perfect",
          setup: (demo) => {
            demo.playerState.spellEnergy = 120;
            demo.resourceSystem.add("spellEnergy", 0);
          },
          preview: "压缩溢流 → 裂隙爆发",
          director: ["先确认法术能量池", "看压缩溢流的蓄力窗", "最后看裂隙爆发消耗与高伤害"]
        },
        {
          name: "烈火重重 · 盾火反伤",
          description: "受击时对敌人造成火焰反伤 — 伤害 8",
          action: () => {
            this.spawnFloatingText("-8 反伤", 740, 220, "damage");
            this.spawnParticles("fireball", 740, 260, 1);
            this.spawnParticles("guard", 220, 300, 0.8);
            this.flashScreen("#e74c3c", 0.2);
            this.enemyHp = Math.max(0, this.enemyHp - 8);
            return "烈火重重盾反：敌人受到 8 火焰反伤";
          }
        },
        {
          name: "烈火重重 · 破甲机制",
          description: "剑攻击命中 3 次后触发破甲，增伤 30% 持续 3 回合",
          action: () => {
            this.armorBreakActive = true;
            this.armorBreakTurns = 3;
            this.spawnFloatingText("破甲！增伤30%", 740, 200, "status");
            this.spawnParticles("slash", 740, 260, 2);
            this.shakeScreen(0.2);
            this.flashScreen("#e74c3c", 0.3);
            return "烈火重重：敌人装甲被破坏，增伤 30% 3 回合";
          }
        },
        {
          name: "咒还 · 吸收法术",
          description: "吸收敌人法术攻击并转化为法术能量",
          action: () => {
            const amount = 40;
            this.playerState.spellEnergy = Math.min(150, this.playerState.spellEnergy + amount);
            this.spawnFloatingText(`+${amount} 能量`, 220, 220, "status");
            this.spawnParticles("magic", 220, 260, 1.2);
            this.flashScreen("#9b59b6", 0.25);
            return `咒还吸收：获得 ${amount} 法术能量`;
          }
        },
        {
          name: "咒还 · 盾附魔反射",
          description: "完美格挡/弹反时反射魔法伤害",
          action: () => {
            this.playerState.shieldEnchanted = true;
            const reflect = 25;
            this.enemyHp = Math.max(0, this.enemyHp - reflect);
            this.spawnFloatingText("盾附魔", 220, 220, "status");
            this.spawnFloatingText(`-${reflect} 反射`, 740, 200, "crit");
            this.spawnParticles("magic", 740, 260, 1.5);
            this.spawnParticles("guard", 220, 300, 1.2);
            this.flashScreen("#9b59b6", 0.25);
            return `咒还反射：敌人受到 ${reflect} 伤害`;
          }
        },
        {
          name: "咒还 · 能量过载",
          description: "法术能量突破上限后持续消耗 HP",
          action: () => {
            this.playerState.spellEnergy = 160;
            this.playerHp = Math.max(1, this.playerHp - 8);
            this.spawnFloatingText("-8 HP", 220, 200, "damage");
            this.spawnParticles("magic", 220, 260, 1);
            this.flashScreen("#e74c3c", 0.2);
            return "咒还警告：法术能量过载，持续消耗生命";
          }
        }
      );
    }

    if (category === "arts") {
      const effectiveChains = Utils.getEffectiveChains(this.playerConfig);
      const chainA = ChainDatabase[effectiveChains.A];
      const followUpChain = ChainDatabase[effectiveChains.followUp];

      // 即时动作序列：让玩家看清机制触发的完整时机
      const castDodgeSequence = [
        { duration: 0.7, label: "① 施法中…", effect: (demo) => {
          demo.spawnFloatingText("咏唱中…", 220, 220, "status");
          demo.spawnParticles("magic", 220, 280, 0.6);
          demo.playerState.currentState = "casting";
          demo.log("德斯洛开始咏唱");
        } },
        { duration: 0.6, label: "② 敌人攻击来袭", effect: (demo) => {
          demo.spawnFloatingText("敌人火球！", 740, 180, "status");
          demo.spawnParticles("fireball", 740, 260, 1.2);
          demo.enemyAttackPhase = "hit";
          demo.log("敌方攻击来袭");
        } },
        { duration: 0.5, label: "③ 按 SPACE 闪避", effect: (demo) => {
          demo.spawnFloatingText("SPACE", 220, 300, "popup");
          demo.spawnParticles("magic", 220, 280, 0.5);
          SFX.sfxAlert();
        } },
        { duration: 1.0, label: "④ 施法中闪避成功", effect: (demo) => {
          demo.spawnFloatingText("施法中闪避！", 220, 220, "status");
          demo.spawnParticles("magic", 220, 280, 1.5);
          demo.spawnParticles("guard", 220, 300, 0.8);
          demo.shakeScreen(0.2);
          demo.flashScreen("#3498db", 0.25);
          demo.enemyAttackPhase = "none";
          demo.playerState.currentState = "idle";
          demo.log("施法过程中成功闪避");
        } }
      ];

      const guardDodgeSequence = [
        { duration: 0.7, label: "① 持盾架势", effect: (demo) => {
          demo.spawnFloatingText("架盾", 220, 220, "status");
          demo.spawnParticles("guard", 220, 300, 0.8);
          demo.playerState.currentState = "shield";
          demo.log("进入格挡架势");
        } },
        { duration: 0.6, label: "② 敌人重击落下", effect: (demo) => {
          demo.spawnFloatingText("敌人重击！", 740, 180, "status");
          demo.spawnParticles("hit", 740, 260, 1.2);
          demo.enemyAttackPhase = "hit";
          demo.log("敌方重击袭来");
        } },
        { duration: 0.5, label: "③ 按 SPACE 闪避", effect: (demo) => {
          demo.spawnFloatingText("SPACE", 220, 300, "popup");
          demo.spawnParticles("guard", 220, 300, 0.6);
          SFX.sfxAlert();
        } },
        { duration: 1.0, label: "④ 持盾中闪避成功", effect: (demo) => {
          demo.spawnFloatingText("持盾中闪避！", 220, 220, "status");
          demo.spawnParticles("guard", 220, 300, 1.5);
          demo.spawnParticles("magic", 220, 280, 0.6);
          demo.shakeScreen(0.2);
          demo.flashScreen("#f1c40f", 0.2);
          demo.enemyAttackPhase = "none";
          demo.playerState.currentState = "idle";
          demo.log("持盾时成功闪避");
        } }
      ];

      const resolveSequence = [
        { duration: 0.6, label: "① 出剑", effect: (demo) => {
          demo.spawnFloatingText("出剑！", 220, 220, "status");
          demo.spawnParticles("slash", 220, 280, 1);
          demo.playerState.currentState = "swordAttack";
          demo.log("东方出剑");
        } },
        { duration: 0.6, label: "② 敌人反击袭来", effect: (demo) => {
          demo.spawnFloatingText("敌人反击！", 740, 180, "status");
          demo.spawnParticles("slash", 740, 260, 1.2);
          demo.enemyAttackPhase = "hit";
          demo.log("敌方反击来袭");
        } },
        { duration: 0.5, label: "③ 按 F 格挡化解", effect: (demo) => {
          demo.spawnFloatingText("F", 220, 300, "popup");
          demo.spawnParticles("guard", 220, 300, 0.6);
          demo.playerState.currentState = "shield";
          SFX.sfxAlert();
        } },
        { duration: 1.0, label: "④ 化解一切攻击", effect: (demo) => {
          demo.spawnFloatingText("化解！", 220, 220, "status");
          demo.spawnFloatingText("免疫", 220, 260, "popup");
          demo.spawnParticles("guard", 220, 300, 2);
          demo.shakeScreen(0.25);
          demo.flashScreen("#2ecc71", 0.3);
          demo.enemyAttackPhase = "none";
          demo.playerState.currentState = "idle";
          demo.log("出剑后格挡化解敌人攻击");
        } }
      ];

      items.push(
        {
          name: "德斯洛 · 随时发动攻击",
          description: "敌方回合也能发动攻击",
          chain: chainA,
          source: "player",
          context: { counterAttack: true },
          preview: "敌方回合中发动攻击"
        },
        {
          name: "德斯洛 · Perfect 暴击",
          description: "Perfect 判定时攻击必然暴击（1.5x 伤害）",
          chain: chainA,
          source: "player",
          forceOutcome: "perfect",
          context: { perfectCrit: true },
          preview: "Perfect 触发暴击伤害 x1.5"
        },
        {
          name: "德斯洛 · 施法中闪避",
          description: "咏唱时按 SPACE 中断施法并闪避",
          actionSequence: castDodgeSequence,
          preview: "咏唱时按 SPACE 中断施法并闪避"
        },
        {
          name: "德斯洛 · 持盾中闪避",
          description: "格挡架势中按 SPACE 闪避",
          actionSequence: guardDodgeSequence,
          preview: "格挡架势中按 SPACE 闪避"
        },
        {
          name: "东方 · 连续闪避后必暴",
          description: "连续闪避 2 次后下一次攻击必定暴击",
          chain: chainA,
          source: "player",
          context: { consecutiveCrit: true },
          preview: "连续闪避后暴击（1.5x 伤害）"
        },
        {
          name: "东方 · 出剑后化解",
          description: "出剑后短时间内格挡可化解一切攻击",
          actionSequence: resolveSequence,
          preview: "出剑后短时间内格挡可化解一切攻击"
        },
        {
          name: "东方 · 全方位闪避",
          description: "持盾招架时可以进行全方位闪避",
          action: () => {
            this.spawnFloatingText("全方位闪避", 220, 220, "status");
            this.spawnParticles("guard", 220, 300, 1);
            return "东方诸国剑术：格挡中全方位闪避";
          }
        },
        {
          name: "荒芜之地 · 追加攻击",
          description: "攻击后可按 A 发动追加追击",
          chain: followUpChain || chainA,
          source: "player",
          context: { followUp: true },
          preview: "攻击后触发荒芜追击"
        },
        {
          name: "荒芜之地 · 追加打断",
          description: "追加攻击化解敌人进攻 + 眩晕 1.5 秒",
          action: () => {
            this.enemyStunTimer = 1.5;
            this.spawnFloatingText("打断 + 眩晕", 740, 180, "status");
            this.spawnParticles("hit", 740, 260, 1.5);
            this.shakeScreen(0.25);
            this.flashScreen("#f1c40f", 0.2);
            return "荒芜之地：追加攻击打断并眩晕敌人 1.5 秒";
          }
        },
        {
          name: "荒芜之地 · 施法中招架",
          description: "咏唱时按 F 进行招架或咒还",
          action: () => {
            this.spawnFloatingText("施法招架", 220, 220, "status");
            this.spawnParticles("magic", 220, 280, 1);
            this.spawnParticles("guard", 220, 300, 0.8);
            return "荒芜之地：施法时成功招架/咒还";
          }
        }
      );
    }

    if (category === "defenses") {
      for (const [id, defense] of Object.entries(DefenseDatabase)) {
        const chainConfig = ChainDatabase[defense.chainId];
        if (!chainConfig) continue;
        // 完美版
        items.push({
          name: `${defense.name} · Perfect`,
          description: `完美执行 ${defense.name}`,
          chain: chainConfig,
          chainId: defense.chainId,
          source: "enemy",
          preview: `完美 ${defense.name}：完全规避 + 反击`,
          director: ["看敌方读招", "看绿色窗口", "观察防御收益"]
        });
        // 失败版
        items.push({
          name: `${defense.name} · 失败`,
          description: `${defense.name} 失败时的效果`,
          chain: chainConfig,
          chainId: defense.chainId,
          source: "enemy",
          forceOutcome: "fail",
          preview: `${defense.name} 失败：受击减伤/反击失败`,
          director: ["对照失败反馈", "观察承伤/硬直", "确认提示不遮挡按键"]
        });
      }
    }

    return items;
  }

  // ========== 执行演示 ==========

  playItem(item) {
    this.currentItem = item;
    this.currentCategoryName = this.getCategoryName();
    this.previewTitle = item.name;
    this.previewText = item.preview || item.description;
    this.previewTimer = 3.0;
    this.resultLines = [];
    this.lastTimelineRows = [];
    this.log(`演示：${item.name}`);
    this.resetHP();
    if (item.setup) item.setup(this);
    this.detailLines = this.buildItemDetailLines(item);

    if (item.action) {
      const msg = item.action();
      if (msg) this.log(msg);
      this.resultLines = this.buildActionResultLines(item, msg);
      this.input.clear();
      this.setState("preview");
      this.message = `${item.name} — R 重播，任意键返回列表`;
      return;
    }

    if (item.actionSequence) {
      this.startActionSequence(item.actionSequence, item.preview || item.description);
      return;
    }

    if (item.chain && item.source === "enemy") {
      this.startEnemyWindup(item);
    } else if (item.chain) {
      this.startQTE(item);
    }
  }

  // ========== 即时动作序列演示 ==========

  startActionSequence(phases, resultMessage) {
    this.setState("action_sequence");
    this.actionSequence = {
      phases,
      phaseIndex: 0,
      timer: 0,
      resultMessage,
      finished: false
    };
    const first = phases[0];
    this.message = first.label || "";
    if (first.effect) first.effect(this);
  }

  updateActionSequence(dt) {
    // ESC 跳过
    while (true) {
      const ev = this.input.peek();
      if (!ev) break;
      if (ev.type === "press" && ev.key.toUpperCase() === "ESCAPE") {
        this.input.consume();
        this.actionSequence = null;
        this.playerState.currentState = "idle";
        this.enemyAttackPhase = "none";
        this.returnToList();
        return;
      }
      this.input.consume();
    }

    const seq = this.actionSequence;
    if (!seq) return;

    seq.timer += dt;
    const phase = seq.phases[seq.phaseIndex];
    if (seq.timer >= phase.duration) {
      seq.timer -= phase.duration;
      seq.phaseIndex++;
      if (seq.phaseIndex >= seq.phases.length) {
        this.finishActionSequence();
        return;
      }
      const next = seq.phases[seq.phaseIndex];
      this.message = next.label || "";
      if (next.effect) next.effect(this);
    }
  }

  finishActionSequence() {
    const msg = this.actionSequence ? this.actionSequence.resultMessage : "";
    this.actionSequence = null;
    this.playerState.currentState = "idle";
    this.enemyAttackPhase = "none";
    this.resultLines = this.buildActionResultLines(null, msg);
    if (msg) this.log(msg);
    this.freezeTimer = 0.5;
    this.setCameraZoom(1.12, 0.35);
    this.triggerImpactFrames(1);
    this.input.clear();
    this.setState("preview");
    this.previewTimer = 4.0;
    this.message = `${this.previewTitle} — R 重播，任意键返回列表`;
  }

  // ========== 敌方回合防御演示 ==========

  startEnemyWindup(item) {
    this.setState("enemy_windup");
    this.currentItem = item;
    this.pendingDefenseItem = item;
    this.input.clear();
    this.enemyAttackTimer = 0;
    this.enemyAttackPhase = "windup";
    this.defenseTriggered = false;

    const defenseId = this.getDefenseIdFromItem(item);
    const defense = DefenseDatabase[defenseId];
    this.demoDefenseKey = defense ? defense.key : "SPACE";

    const attackId = item.attackId || this.pickAttackForDefense(defenseId);
    const baseAttack = EnemyDatabase.attacks[attackId];
    this.enemyAttack = Difficulty.scaleAttack({ id: attackId, ...baseAttack });

    this.showTurnBanner("敌方回合", "#e74c3c");
    if (typeof SFX !== "undefined" && SFX.sfxThreat) SFX.sfxThreat();
    this.log(`演示：敌人准备 ${this.enemyAttack.name}，${this.enemyAttack.hint}`);
    this.message = `${item.name} — 观察敌人攻击预警，命中后进入 QTE 再按键`;
    this.previewTitle = item.name;
    this.previewText = item.preview || item.description;
    this.detailLines = this.buildItemDetailLines(item);
    this.resultLines = [];
    this.lastTimelineRows = [];
  }

  updateEnemyWindup(dt) {
    // 快捷键：M 切换模式，ESC 返回列表
    while (true) {
      const ev = this.input.peek();
      if (!ev) break;
      if (ev.type !== "press") { this.input.consume(); continue; }
      const key = ev.key.toUpperCase();
      if (key === "ESCAPE") {
        this.input.consume();
        this.returnToList();
        return;
      }
      if (key === "M") {
        this.input.consume();
        this.manualMode = !this.manualMode;
        this.message = `${this.previewTitle} — 已切换为${this.manualMode ? "手动试玩" : "自动演示"}`;
        continue;
      }
      this.input.consume();
    }

    const attack = this.enemyAttack;
    if (!attack) {
      this.startDefenseQTE(this.pendingDefenseItem);
      return;
    }

    this.enemyAttackTimer += dt * this.windupTimeScale;

    const responseDuration = attack.responseDuration || Difficulty.responseDuration();
    const responseStart = Math.max(0, attack.windup - responseDuration);

    if (this.enemyAttackPhase === "windup" && this.enemyAttackTimer >= responseStart) {
      this.enemyAttackPhase = "response";
      this.log(`绿色窗口出现：命中后按 [${this.demoDefenseKey}]`);
      if (typeof SFX !== "undefined" && SFX.sfxWindowOpen) SFX.sfxWindowOpen();
    }

    if (this.enemyAttackTimer >= attack.windup && this.enemyAttackPhase !== "hit") {
      this.enemyAttackPhase = "hit";
      this.freezeTimer = 0.5;
      this.log(`敌人 ${attack.name} 即将命中！`);
      if (typeof SFX !== "undefined" && SFX.sfxAlert) SFX.sfxAlert();
      this.startDefenseQTE(this.pendingDefenseItem);
    }
  }

  startDefenseQTE(item) {
    this.setState("qte");
    this.currentItem = item;
    this.input.clear();

    const scaled = Difficulty.scaleChain(item.chain);
    this.qteRunner = new QTEChainRunner(scaled, {
      source: item.source || "enemy",
      chainId: item.chainId || this.getChainId(item.chain),
      chainFamily: item.chain ? item.chain.family : null,
      handfeel: Utils.getChainHandfeel(item.chain, {
        chainId: item.chainId || this.getChainId(item.chain),
        source: item.source || "enemy"
      }),
      ...(item.context || {}),
      onNodeEffect: (node, outcome, transition) => {
        this.freezeTimer = item.source === "enemy" ? 0.22 : 0.12;
        if (transition.message) this.log(transition.message);
        this.showOutcomeFeedback(outcome);
        this.emitTransitionVisual(transition);
      },
      onRhythmHit: (idx) => {
        this.log(`节拍 ${idx + 1} 命中`);
        SFX.sfxSuccess();
      },
      onRhythmMiss: (idx) => {
        this.log(idx >= 0 ? `节拍 ${idx + 1} 没踩准` : "按错键了");
        SFX.sfxFail();
      }
    });

    this.activeDemoPacing = Utils.getDemoPacing(item.chain, {
      ...item,
      chainId: item.chainId || this.getChainId(item.chain)
    });
    this.qteRunner.timeScale = this.activeDemoPacing.timeScale;
    this.qteRunner.postNodePause = this.activeDemoPacing.postNodePause;

    const forceOutcome = item.forceOutcome || null;
    if (this.manualMode && !forceOutcome) {
      this.qteRunner.forceOutcome(null);
      this.message = `${item.name} — 手动试玩：按提示按键`;
    } else {
      this.qteRunner.forceOutcome(forceOutcome || "perfect");
      this.message = `${item.name} — 自动演示中（${forceOutcome ? this.formatOutcome(forceOutcome) : "Perfect"}）`;
    }
  }

  getDefenseIdFromItem(item) {
    for (const id of Object.keys(DefenseDatabase)) {
      if (item.name.includes(DefenseDatabase[id].name)) return id;
    }
    return "dodge";
  }

  pickAttackForDefense(defenseId) {
    const candidates = Object.entries(EnemyDatabase.attacks)
      .filter(([id, atk]) => (atk.allowedResponses || []).includes(defenseId))
      .map(([id]) => id);
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    return "thrust";
  }

  returnToList() {
    this.setState("list");
    this.qteRunner = null;
    this.enemyAttack = null;
    this.enemyAttackPhase = "none";
    this.pendingDefenseItem = null;
    this.actionSequence = null;
    this.demoCounterAttack = false;
    this.resetHP();
    this.input.clear();
    this.message = `${this.getCategoryName()} — 按数字选择效果，ESC 返回`;
  }

  handleSystemEscape() {
    if (this.state === "main") {
      this.returnToMenu = true;
      this.input.clear();
      return;
    }

    if (this.state === "list" || !this.category) {
      this.setState("main");
      this.listPage = 0;
      this.resetHP();
      this.input.clear();
      this.message = "效果演示模式 — 选择分类查看每一种实现效果";
      return;
    }

    this.returnToList();
  }

  showTurnBanner(text, color) {
    this.turnBanner = { text, color, timer: 1.2, maxTime: 1.2 };
  }

  setCameraZoom(zoom, duration) {
    this.cameraZoom = zoom;
    this.cameraZoomTimer = duration;
  }

  triggerImpactFrames(count) {
    this.impactFrames = count;
  }

  setTransition(label, color = "#f1c40f", duration = 0.4) {
    this.transition = { label, color, timer: duration, maxTime: duration };
  }

  startQTE(item) {
    this.setState("qte");
    this.currentItem = item;
    this.input.clear();
    this.demoCounterAttack = !!(item.context && item.context.counterAttack);
    if (this.demoCounterAttack) {
      this.log("敌方回合中发动反击！");
      this.showTurnBanner("敌方回合", "#e74c3c");
    }
    const scaled = Difficulty.scaleChain(item.chain);
    const chainId = item.chainId || this.getChainId(item.chain);
    const pacing = Utils.getDemoPacing(item.chain, { ...item, chainId });
    this.activeDemoPacing = pacing;
    this.qteRunner = new QTEChainRunner(scaled, {
      source: item.source || "player",
      chainId,
      chainFamily: item.chain ? item.chain.family : null,
      handfeel: Utils.getChainHandfeel(item.chain, { chainId, source: item.source || "player" }),
      ...(item.context || {}),
      onNodeEffect: (node, outcome, transition) => {
        this.freezeTimer = Math.min(0.20, pacing.resultFreeze * 0.25);
        if (transition.message) this.log(transition.message);
        this.showOutcomeFeedback(outcome);
        this.emitTransitionVisual(transition);
      },
      onRhythmHit: (idx) => {
        this.log(`节拍 ${idx + 1} 命中`);
        SFX.sfxSuccess();
      },
      onRhythmMiss: (idx) => {
        this.log(idx >= 0 ? `节拍 ${idx + 1} 没踩准` : "按错键了");
        SFX.sfxFail();
      }
    });

    if (this.manualMode) {
      this.qteRunner.timeScale = 1;
      this.qteRunner.postNodePause = 0;
      this.message = `${item.name} — 手动试玩：请在判定窗口内按键`;
    } else {
      // 自动演示：链路自带 pacing，避免蓄力链拖沓、爆发链又过快。
      this.qteRunner.timeScale = pacing.timeScale;
      this.qteRunner.postNodePause = pacing.postNodePause;
      if (item.forceOutcome) {
        this.qteRunner.forceOutcome(item.forceOutcome);
      } else {
        this.qteRunner.forceOutcome("perfect");
      }
      this.message = `${item.name} — 自动演示中（慢放）`;
    }
  }

  updateQTE(dt) {
    if (!this.qteRunner) {
      this.setState("preview");
      this.previewTimer = 3.0;
      this.message = `${this.previewTitle} — R 重播，任意键返回列表`;
      return;
    }

    while (true) {
      const ev = this.input.peek();
      if (!ev) break;
      if (ev.type === "press" && ev.key.toUpperCase() === "ESCAPE") {
        this.input.consume();
        this.qteRunner = null;
        this.setState("list");
        this.enemyAttack = null;
        this.enemyAttackPhase = "none";
        this.pendingDefenseItem = null;
        this.resetHP();
        this.input.clear();
        this.message = `${this.getCategoryName()} — 按数字选择效果，ESC 返回`;
        return;
      }
      if (ev.type === "press" && ev.key.toUpperCase() === "M") {
        this.input.consume();
        this.manualMode = !this.manualMode;
        if (this.qteRunner) {
          const isDefense = this.currentItem && this.currentItem.source === "enemy";
          if (this.manualMode) {
            this.qteRunner.timeScale = isDefense ? this.defenseTimeScale : 1;
            this.qteRunner.postNodePause = isDefense ? this.defensePostNodePause : 0;
            this.qteRunner.forcedOutcome = null;
            this.message = `${this.previewTitle} — 手动试玩`;
          } else {
            const pacing = this.activeDemoPacing || Utils.getDemoPacing(this.currentItem?.chain, this.currentItem || {});
            this.qteRunner.timeScale = pacing.timeScale;
            this.qteRunner.postNodePause = pacing.postNodePause;
            this.qteRunner.forceOutcome(this.currentItem?.forceOutcome || "perfect");
            this.message = `${this.previewTitle} — 自动演示中`;
          }
        }
        continue;
      }
      this.input.consume();
      if (this.manualMode) {
        this.qteRunner.handleInput(ev, this.input.heldKeys);
      }
    }

    this.qteRunner.update(dt);
    this.updateChargeEffects(dt);

    if (this.qteRunner.isDone()) {
      this.onQTEComplete();
    }
  }

  onQTEComplete() {
    const runner = this.qteRunner;
    if (!runner) return;

    const effects = runner.getAccumulatedEffects();
    const ctx = runner.context;

    const ex = 740;
    const ey = 260;
    const px = 220;
    const py = 260;

    let dealtDamage = 0;
    let isCrit = false;

    // 伤害数字
    if (effects.damage > 0) {
      isCrit = ctx.perfectCrit || ctx.consecutiveCrit;
      dealtDamage = isCrit ? Math.floor(effects.damage * 1.5) : effects.damage;
      this.enemyHp = Math.max(0, this.enemyHp - dealtDamage);
      this.spawnFloatingText(`-${dealtDamage}`, ex, ey - 40, isCrit ? "crit" : "damage");
      this.spawnParticles(isCrit ? "slash" : "hit", ex, ey, isCrit ? 1.5 : 1);
      this.triggerActorReaction("enemy", isCrit ? "crit" : "hit", isCrit ? 1.35 : 1, {
        color: isCrit ? "#f1c40f" : "#ffffff"
      });
      this.shakeScreen(isCrit ? 0.25 : 0.15);
      if (isCrit) this.flashScreen("#f1c40f", 0.18);
      this.log(`${isCrit ? "暴击" : "造成"} ${dealtDamage} 伤害`);
    }

    // 支路节点伤害（如 chargeMul 加成后的实际伤害，这里用 total）
    // damage 已通过 getAccumulatedEffects 累加所有节点

    ChainEffectSystem.applyResources(this, effects, { playerY: py - 60 });
    ChainEffectSystem.applyStatuses(this, effects, { source: "demo-qte", playerY: 200, enemyY: 180 });

    if (effects.stunEnemy > 0) {
      this.enemyStunTimer = effects.stunEnemy;
      this.spawnFloatingText("眩晕！", ex, ey - 80, "status");
      this.spawnParticles("status", ex, ey - 80, 1);
      this.log(`敌人眩晕 ${effects.stunEnemy.toFixed(1)} 秒`);
    }

    if (effects.iframe > 0) {
      this.spawnFloatingText("完全规避", px, py - 80, "status");
      this.spawnParticles("guard", px, py, 1);
      this.log("成功闪避/弹反");
    }

    if (ctx.followUp) {
      this.spawnFloatingText("追加攻击", ex, ey - 60, "status");
      this.spawnParticles("slash", ex, ey, 1.2);
      this.log("荒芜之地追加攻击命中");
    }

    if (ctx.counterAttack) {
      this.spawnFloatingText("敌方回合反击！", ex, ey - 90, "popup");
      this.spawnFloatingText("反击！", ex, ey - 60, "status");
      this.shakeScreen(0.2);
      this.flashScreen("#e74c3c", 0.15);
      this.log("敌方回合发动反击");
    }

    this.resultLines = this.buildQTEResultLines(effects, ctx, dealtDamage, isCrit, runner.resultLog);
    this.lastTimelineRows = this.buildActualTimelineRows(runner.resultLog);
    // 检查敌人是否死亡
    if (this.enemyHp <= 0) {
      this.spawnFloatingText("击败！", ex, ey - 100, "crit");
      this.spawnParticles("fireball", ex, ey, 2);
      this.shakeScreen(0.3);
      this.flashScreen("#f1c40f", 0.3);
      this.log("敌人被击败！");
      this.enemyHp = this.enemyMaxHp; // 演示中自动复活
      this.log("敌人已复活（演示模式）");
    }

    this.freezeTimer = this.activeDemoPacing ? this.activeDemoPacing.resultFreeze : 0.8;
    this.qteRunner = null;
    this.input.clear();
    this.setState("preview");
    this.previewTimer = 4.0;
    this.message = `${this.previewTitle} — R 重播，任意键返回列表`;
  }

  // ========== 工具方法 ==========

  applyStatusResults(results) {
    ChainEffectSystem.applyStatusResults(this, results, { playerY: 200, enemyY: 180 });
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

    this.chargeFxTimer = Math.max(0.06, 0.14 - ratio * 0.06);
    this.effectQueue.emitCharge("fire", ratio);
  }

  log(msg) {
    this.logs.unshift({ text: msg, time: performance.now() });
    if (this.logs.length > 30) this.logs.pop();
    this.onLog(msg);
  }

  spawnFloatingText(text, x, y, type) {
    this.floatingTexts.add(text, x, y, type);
  }

  showOutcomeFeedback(outcome, x = 480, y = 360) {
    const label = (outcome || "fail").toUpperCase();
    this.spawnFloatingText(label, x, y, "popup");
    if (outcome === "perfect") {
      SFX.sfxPerfect();
      this.setCameraZoom(1.12, 0.3);
      this.triggerImpactFrames(1);
    } else if (outcome === "success") {
      SFX.sfxSuccess();
    } else {
      SFX.sfxFail();
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

  get state() {
    return this._state;
  }

  setState(newState) {
    if (this._state === newState) return;
    const oldState = this._state;

    // 进入播放态时显示过场卡片
    const playbackStates = ["qte", "enemy_windup", "action_sequence", "preview"];
    if (oldState === "list" && playbackStates.includes(newState)) {
      this.setTransition(this.previewTitle || "演示开始", "#f1c40f", 0.35);
    } else if (oldState === "main" && newState === "list") {
      this.setTransition(this.getCategoryName() || "效果演示", "#f1c40f", 0.3);
    }

    this.onStateExit(oldState);
    this._state = newState;
    this.onStateEnter(newState);
  }

  onStateExit(state) {
    // 清理旧状态
  }

  onStateEnter(state) {
    // 进入新状态提示音
    if (state === "qte" || state === "enemy_windup") {
      SFX.sfxAlert();
    }
    // 返回菜单/列表时清理残留粒子；预览页保留刚刚演示出的效果。
    if (state === "main" || state === "list") {
      this.particles.clear();
      this.floatingTexts.clear();
      this.chargeFxTimer = 0;
    }
  }

  get turnState() {
    return "demo_" + this._state;
  }

  buildItemDetailLines(item) {
    const lines = [];
    const style = this.currentStyle();

    if (style) {
      const loadout = this.describeLoadout();
      lines.push(`风格：${style.name}${loadout ? `（${loadout}）` : ""}`);
    }

    lines.push(`分类：${this.currentCategoryName || this.getCategoryName() || "未分类"}`);
    lines.push(`模式：${this.manualMode ? "手动试玩" : "自动慢放"}`);

    if (item.description) {
      lines.push(`机制：${item.description}`);
    }

    const directorLines = this.getDirectorLines(item, 4);
    if (directorLines.length > 0) {
      lines.push(`导演焦点：${directorLines.join(" / ")}`);
    }

    if (item.chain) {
      const nodes = item.chain.nodes || [];
      lines.push(`链路：${item.chain.name} / ${nodes.length} 个节点`);
      lines.push(`输入流程：${nodes.map(node => this.describeNodeInput(node)).join(" -> ")}`);

      const successDamage = this.estimateChainDamage(item.chain, "success");
      const perfectDamage = this.estimateChainDamage(item.chain, "perfect");
      if (successDamage > 0 || perfectDamage > 0) {
        lines.push(`参考伤害：Success ${successDamage} / Perfect ${perfectDamage}`);
      }

      if (item.chain.cost) {
        const costs = Object.entries(item.chain.cost)
          .map(([key, amount]) => `${ChainEffectSystem.resourceLabel(key)} ${amount}`)
          .join("，");
        lines.push(`启动消耗：${costs}`);
      }

      const status = this.describeChainStatus(item.chain);
      if (status) {
        lines.push(`附加效果：${status}`);
      }

      lines.push(`演示判定：${this.manualMode ? "由玩家输入决定" : this.formatOutcome(item.forceOutcome || "perfect")}`);
    } else {
      lines.push("演示类型：即时效果预览");
    }

    if (item.context?.counterAttack) lines.push("战斗语境：敌方回合反击，会中断敌人本次攻击。");
    if (item.context?.followUp) lines.push("战斗语境：荒芜之地追加攻击，用于攻击后追击或化解进攻。");
    if (item.details) lines.push(...item.details);

    return lines;
  }

  getProjectedTimelineLines(item = this.currentItem, limit = 8) {
    if (!item || !item.chain) return [];
    const outcome = this.manualMode ? (item.forceOutcome || "success") : (item.forceOutcome || "perfect");
    const simulated = ChainEffectSystem.simulateChain(item.chain, outcome);
    return ChainEffectSystem.timelineLinesFromRows(simulated.rows, { limit });
  }

  getActualTimelineLines(limit = 8) {
    const activeRows = this.qteRunner && this.qteRunner.resultLog && this.qteRunner.resultLog.length > 0
      ? this.buildActualTimelineRows(this.qteRunner.resultLog)
      : this.lastTimelineRows;
    if (!activeRows || activeRows.length === 0) {
      return [];
    }

    return ChainEffectSystem.timelineLinesFromRows(activeRows, { limit });
  }

  buildActualTimelineRows(resultLog = []) {
    let currentMul = 1;
    let cumulativeDamage = 0;
    const resources = {};
    return resultLog.map((entry, idx) => {
      const transition = entry.transition || {};
      const chainNodes = this.currentItem && this.currentItem.chain ? this.currentItem.chain.nodes || [] : [];
      const node = chainNodes.find(item => item.id === entry.nodeId) || {
        id: entry.nodeId,
        name: entry.nodeName,
        duration: 0,
        input: {}
      };
      const row = ChainEffectSystem.buildTimelineRow(idx + 1, node, entry.outcome, transition, currentMul);
      if (transition.chargeMul !== undefined) currentMul *= transition.chargeMul;
      row.chargeMulAfter = currentMul;
      if (transition.damage !== undefined) {
        row.damage = Math.floor(transition.damage * currentMul);
        cumulativeDamage += row.damage;
      }
      if (transition.resource) {
        for (const [key, value] of Object.entries(transition.resource)) {
          resources[key] = (resources[key] || 0) + value;
        }
      }
      row.cumulativeDamage = cumulativeDamage;
      row.cumulativeResources = { ...resources };
      return row;
    });
  }

  buildActionResultLines(item, msg) {
    const lines = [];
    if (msg) lines.push(`执行结果：${msg}`);
    lines.push(`玩家 HP：${this.playerHp}/${this.playerMaxHp}`);
    lines.push(`敌人 HP：${this.enemyHp}/${this.enemyMaxHp}`);
    if (this.playerState.spellEnergy > 0) lines.push(`法术能量：${Math.floor(this.playerState.spellEnergy)}/${this.playerState.maxSpellEnergy}`);
    if (this.enemyStunTimer > 0) lines.push(`敌人眩晕：${this.enemyStunTimer.toFixed(1)} 秒`);
    if (this.armorBreakActive) lines.push(`破甲：剩余 ${this.armorBreakTurns} 回合`);
    if (this.playerState.shieldEnchanted) lines.push("盾牌状态：咒还附魔");
    return lines;
  }

  buildQTEResultLines(effects, ctx, dealtDamage, isCrit, resultLog = []) {
    return ChainEffectSystem.buildQTEResultLines({
      title: this.previewTitle,
      effects,
      context: ctx,
      dealtDamage,
      isCrit,
      resultLog,
      formatOutcome: this.formatOutcome.bind(this)
    });
  }

  describeLoadout() {
    const parts = [];
    if (this.playerConfig.weapon && WeaponDatabase[this.playerConfig.weapon]) {
      parts.push(WeaponDatabase[this.playerConfig.weapon].name);
    }
    for (const id of this.playerConfig.spells || []) {
      if (SpellDatabase[id]) parts.push(SpellDatabase[id].name);
    }
    for (const id of this.playerConfig.combatArts || []) {
      if (CombatArtDatabase[id]) parts.push(CombatArtDatabase[id].name);
    }
    return parts.join(" / ");
  }

  describeNodeInput(node) {
    const input = node.input || {};
    const key = input.key || "?";
    if (input.type === "press") return `${node.name}[按 ${key}]`;
    if (input.type === "hold_release") return `${node.name}[松开 ${key}]`;
    if (input.type === "rhythm") return `${node.name}[节奏 ${key} x${input.beats.length}]`;
    return `${node.name}[${key}]`;
  }

  estimateChainDamage(chain, outcome) {
    const outcomeKey = "on" + Utils.capitalize(outcome);
    let node = chain.nodes[0];
    let total = 0;
    let mul = 1;
    const visited = new Set();

    while (node && !visited.has(node.id)) {
      visited.add(node.id);
      const transition = node[outcomeKey] || node.onSuccess || node.onFail;
      if (!transition) break;
      if (transition.chargeMul !== undefined) mul *= transition.chargeMul;
      if (transition.damage !== undefined) total += Math.floor(transition.damage * mul);
      if (!transition.next) break;
      node = chain.nodes.find(n => n.id === transition.next);
    }

    return total;
  }

  describeChainStatus(chain) {
    return ChainEffectSystem.describeChainStatus(chain);
  }

  formatOutcome(outcome) {
    const labels = {
      perfect: "Perfect",
      success: "Success",
      fail: "Fail",
      early: "Early",
      late: "Late",
      timeout: "Timeout"
    };
    return labels[outcome] || outcome;
  }

  getPhaseTitle() {
    if (this.state === "main") return "选择演示分类";
    if (this.state === "list") return `${this.getCategoryName()} / 第 ${this.listPage + 1}/${this.getTotalPages()} 页`;
    if (this.state === "enemy_windup") return "敌方攻击预警";
    if (this.state === "qte") return "QTE 链播放中";
    if (this.state === "preview") return "演示结算预览";
    return "效果演示";
  }

  getCurrentItemTitle() {
    if (this.state === "main") return "选择分类查看机制";
    if (this.state === "list") return `${this.getCategoryName()} 条目列表`;
    return this.previewTitle || "当前演示项";
  }

  getControlHint() {
    if (this.state === "main") {
      return `1-${this.categories.length} 选择分类 | W 切换风格 | M 自动/手动 | 6 难度 | ESC 返回`;
    }
    if (this.state === "list") {
      const count = this.getCurrentPageItems().length;
      return `1-${count} 播放条目 | A/← 上页 | D/→ 下页 | M 自动/手动 | ESC 返回分类`;
    }
    if (this.state === "enemy_windup") {
      return "看危险等级/推荐按键/绿色窗口 | 命中前会进入 QTE | M 切换自动/手动 | ESC 返回列表";
    }
    if (this.state === "qte") {
      return this.manualMode ? "按 QTE 提示按键输入 | M 切换模式 | ESC 中止" : "自动慢放中：观察判定窗、节点推进和结算记录 | M 切换模式 | ESC 中止";
    }
    if (this.state === "preview") {
      return "任意键返回列表 | ESC 返回列表";
    }
    return "ESC 返回";
  }

  getStatusLines() {
    const lines = [];
    const style = this.currentStyle();

    if (style) {
      lines.push(`当前风格：${style.name} [${style.key}]`);
      const loadout = this.describeLoadout();
      if (loadout) lines.push(`装配：${loadout}`);
    }

    if (this.state === "main") {
      lines.push("选择分类后，会进入条目列表；每个条目会展示机制、输入流程、判定窗和结算。");
      this.categories.forEach((cat, idx) => {
        lines.push(`${idx + 1}. ${cat.name}：${cat.description}`);
      });
      return lines;
    }

    if (this.state === "list") {
      const items = this.getCurrentPageItems();
      const total = this.getItems(this.category).length;
      lines.push(`分类：${this.getCategoryName()} / 共 ${total} 项 / 当前第 ${this.listPage + 1}/${this.getTotalPages()} 页`);
      items.forEach((item, idx) => {
        lines.push(`${idx + 1}. ${item.name}（${item.chain ? "QTE 链" : "即时预览"}）`);
      });
      return lines;
    }

    if (this.state === "enemy_windup") {
      const lines = [this.previewText || "敌方攻击预警"];
      if (this.enemyAttack) {
        lines.push(`敌人攻击：${this.enemyAttack.name}`);
        lines.push(`提示：${this.enemyAttack.hint}`);
        lines.push(`准备按键：[${this.demoDefenseKey || "?"}]`);
        lines.push(...this.getEnemyAttackReadoutLines(this.enemyAttack));
      }
      return lines;
    }

    if (this.state === "action_sequence") {
      const seq = this.actionSequence;
      const phase = seq ? seq.phases[seq.phaseIndex] : null;
      lines.push(this.previewText || "效果演示播放中。");
      if (phase) {
        lines.push(`当前阶段：${phase.label || "演示阶段"}`);
        if (phase.detail) lines.push(`阶段说明：${phase.detail}`);
        if (phase.key) lines.push(`提示按键：[${phase.key}]`);
      }
      if (this.enemyAttack) {
        lines.push(`敌人攻击：${this.enemyAttack.name}`);
        lines.push(...this.getEnemyAttackReadoutLines(this.enemyAttack));
      }
      return lines;
    }

    if (this.state === "qte") {
      return this.getActiveDirectorLines(3).concat(this.getQTEInspectorLines(), this.getActualTimelineLines(6));
    }

    if (this.state === "preview") {
      lines.push(this.previewText || "演示完成。");
      if (this.resultLines.length > 0) lines.push(...this.resultLines);
      const timeline = this.getActualTimelineLines(8);
      if (timeline.length > 0) lines.push(...timeline);
      return lines;
    }

    return lines.length > 0 ? lines : [this.message];
  }

  getPlaybackLines() {
    const lines = [
      `阶段：${this.getPhaseTitle()}`,
      `模式：${this.manualMode ? "手动试玩" : "自动慢放"}`,
      `玩家 HP：${this.playerHp}/${this.playerMaxHp}`,
      `敌人 HP：${this.enemyHp}/${this.enemyMaxHp}`
    ];

    if (this.playerState.spellEnergy > 0) {
      lines.push(`法术能量：${Math.floor(this.playerState.spellEnergy)}/${this.playerState.maxSpellEnergy}`);
    }
    if (this.enemyStunTimer > 0) {
      lines.push(`敌人眩晕：${this.enemyStunTimer.toFixed(1)} 秒`);
    }
    if (this.armorBreakActive) {
      lines.push(`破甲：剩余 ${this.armorBreakTurns} 回合`);
    }
    if (this.playerState.shieldEnchanted) {
      lines.push("盾牌状态：咒还附魔");
    }

    return lines.concat(this.getTimelineLines(4));
  }

  getEnemyAttackReadoutLines(attack = this.enemyAttack) {
    if (!attack) return [];
    const id = attack.id || "";
    const isSpell = attack.interruptible || id.includes("spell") || id.includes("arcane") || id.includes("curse");
    const type = isSpell ? "法术" : (id.includes("heavy") || id.includes("shield") ? "重击" : "物理");
    const isHighThreat = attack.damage >= 30 || attack.stunOnHit || id.includes("heavy") || id.includes("curse");
    const threat = isHighThreat ? "高危" : (attack.windup <= 0.75 ? "快攻" : "中危");
    const responseKeys = [...new Set((attack.allowedResponses || []).map(item => item === "guard" ? "F" : "SPACE"))].join(" / ") || "?";
    const responseDuration = attack.responseDuration || Difficulty.responseDuration();
    const responseStart = Math.max(0, attack.windup - responseDuration);
    const timeToWindow = Math.max(0, responseStart - this.enemyAttackTimer);
    const timeToHit = Math.max(0, attack.windup - this.enemyAttackTimer);
    return [
      `类型/危险：${type} / ${threat}`,
      `推荐应对：${responseKeys}`,
      this.enemyAttackPhase === "response"
        ? `窗口状态：已开启，${timeToHit.toFixed(1)}s 后命中`
        : `窗口状态：预警中，${timeToWindow.toFixed(1)}s 后开窗`
    ];
  }

  getTimelineLines(limit = 8) {
    if (this.logs.length === 0) return ["暂无日志记录。"];
    return this.logs
      .slice(0, limit)
      .map((entry, idx) => `${idx === 0 ? "最新" : "日志"}：${entry.text}`);
  }

  getQTEInspectorLines() {
    if (!this.qteRunner) return this.detailLines;
    const node = this.qteRunner.currentNode();
    if (!node) return this.detailLines;
    const bounds = this.qteRunner.getWindowBounds();
    const forced = this.manualMode ? null : (this.currentItem?.forceOutcome || "perfect");
    const completed = this.qteRunner.resultLog
      .map(entry => `${entry.nodeName}:${this.formatOutcome(entry.outcome)}`)
      .join(" -> ") || "无";
    return [
      `演示项：${this.previewTitle}`,
      `风格：${this.currentStyle()?.name || "无"}`,
      `链路：${this.qteRunner.chain.name}`,
      `节点：${this.qteRunner.nodeIndex + 1}/${this.qteRunner.chain.nodes.length} ${node.name}`,
      `输入：${this.describeNodeInput(node)}`,
      `计时：${Math.max(0, this.qteRunner.nodeTimer).toFixed(2)}s / ${node.duration.toFixed(2)}s`,
      `判定窗：${bounds.start.toFixed(2)}s - ${bounds.end.toFixed(2)}s`,
      `Perfect 点：${bounds.perfect === null || bounds.perfect === undefined ? "无" : bounds.perfect.toFixed(2) + "s"}`,
      `演示节奏：x${this.qteRunner.timeScale.toFixed(2)} / 节点停顿 ${this.qteRunner.postNodePause.toFixed(2)}s`,
      `手感：press +${this.qteRunner.handfeel.windowPad.toFixed(2)} / hold +${this.qteRunner.handfeel.holdWindowPad.toFixed(2)} / rhythm +${this.qteRunner.handfeel.rhythmPad.toFixed(2)}`,
      `判定方式：${forced ? this.formatOutcome(forced) : "手动输入"}`,
      `已完成：${completed}`
    ];
  }

  getQTEDebugLines() {
    return QTEDebugFormatter.getLines(this, { title: "Demo QTE Debug" });
  }
}
