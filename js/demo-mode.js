class DemoMode {
  constructor(input, onLog) {
    this.input = input;
    this.onLog = onLog || (() => {});

    this.state = "main"; // main | list | qte | preview
    this.category = null;
    this.qteRunner = null;

    this.message = "效果演示模式 — 选择分类查看每一种实现效果";
    this.previewText = "";
    this.previewTitle = "";

    this.particles = new ParticleSystem();
    this.floatingTexts = new FloatingTextManager();

    this.screenShake = 0;
    this.hitStop = 0;
    this.turnBanner = null;
    this.screenFlash = null;

    this.logs = [];
    this.returnToMenu = false;

    this.playerConfig = { weapon: null, spells: [], combatArts: [] };
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

    this.categories = [
      { key: "weapons", name: "武器链", icon: "⚔" },
      { key: "spells", name: "咒术", icon: "🔥" },
      { key: "arts", name: "战技", icon: "🗡" },
      { key: "defenses", name: "防御反击", icon: "🛡" }
    ];
  }

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

    if (this.state === "qte") {
      this.updateQTE(dt);
    } else {
      this.consumeMenuInputs();
    }
  }

  // ========== 输入处理 ==========

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
          this.state = "main";
          this.message = "效果演示模式 — 选择分类查看每一种实现效果";
        }
        return;
      }

      if (this.state === "main") {
        const idx = parseInt(ev.key);
        if (idx >= 1 && idx <= this.categories.length) {
          this.input.consume();
          this.category = this.categories[idx - 1].key;
          this.state = "list";
          this.message = `${this.categories[idx - 1].name} — 按数字选择效果，ESC 返回`;
          return;
        }
      } else if (this.state === "list") {
        const items = this.getItems(this.category);
        const idx = parseInt(ev.key);
        if (idx >= 1 && idx <= items.length) {
          this.input.consume();
          this.playItem(items[idx - 1]);
          return;
        }
      } else if (this.state === "preview") {
        this.input.consume();
        this.state = "list";
        this.message = `${this.getCategoryName()} — 按数字选择效果，ESC 返回`;
        return;
      }

      this.input.consume();
    }
  }

  getCategoryName() {
    const cat = this.categories.find(c => c.key === this.category);
    return cat ? cat.name : "";
  }

  // ========== 演示项构造 ==========

  getItems(category) {
    const items = [];

    if (category === "weapons") {
      for (const [weaponId, weapon] of Object.entries(WeaponDatabase)) {
        for (const [chainKey, chain] of Object.entries(weapon.chains)) {
          items.push({
            name: `${weapon.name} · ${chain.name}`,
            description: chain.description,
            chain,
            source: "player",
            preview: `${weapon.name} ${chain.name} 自动 Perfect 演示`
          });
        }
      }
    }

    if (category === "spells") {
      const fireChain = SpellDatabase.fire.chainOverrides.staff.A;
      items.push(
        {
          name: "烈火重重 · 小火球",
          description: "蓄力过早，火球微弱",
          chain: fireChain,
          source: "player",
          forceOutcome: "early",
          preview: "蓄力过早 → 小火球"
        },
        {
          name: "烈火重重 · 火球",
          description: "正常蓄力释放标准火球",
          chain: fireChain,
          source: "player",
          forceOutcome: "success",
          preview: "正常蓄力 → 火球"
        },
        {
          name: "烈火重重 · 大火球",
          description: "完美蓄力，火球进化到最大",
          chain: fireChain,
          source: "player",
          forceOutcome: "perfect",
          preview: "完美蓄力 → 大火球"
        },
        {
          name: "咒还 · 吸收法术",
          description: "吸收敌人法术并转化为能量",
          action: () => {
            const amount = 40;
            this.spawnFloatingText(`+${amount} 能量`, 220, 240, "status");
            this.spawnParticles("magic", 220, 260, 1.2);
            this.flashScreen("#9b59b6", 0.25);
            return `咒还吸收：获得 ${amount} 法术能量`;
          }
        },
        {
          name: "咒还 · 盾附魔反射",
          description: "盾牌附魔，完美格挡时反射魔法",
          action: () => {
            this.spawnFloatingText("盾牌附魔", 220, 240, "status");
            this.spawnParticles("guard", 220, 300, 1.5);
            this.flashScreen("#9b59b6", 0.2);
            return "咒还：盾牌已附魔，可反射魔法";
          }
        }
      );
    }

    if (category === "arts") {
      const gs = WeaponDatabase.greatsword.chains.A;
      const db = WeaponDatabase.dualBlades.chains.A;
      items.push(
        {
          name: "德斯洛 · 随时发动攻击",
          description: "敌方回合也能发动攻击",
          chain: gs,
          source: "player",
          context: { counterAttack: true },
          preview: "敌方回合中发动大剑重斩"
        },
        {
          name: "德斯洛 · Perfect 暴击",
          description: "时机正确时攻击必然暴击",
          chain: db,
          source: "player",
          forceOutcome: "perfect",
          context: { perfectCrit: true },
          preview: "Perfect 触发暴击伤害"
        },
        {
          name: "德斯洛 · 施法中闪避",
          description: "咏唱时按 SPACE 中断并闪避",
          action: () => {
            this.spawnFloatingText("施法中闪避！", 220, 240, "status");
            this.spawnParticles("magic", 220, 280, 1);
            this.shakeScreen(0.15);
            return "德斯洛：施法过程中成功闪避";
          }
        },
        {
          name: "德斯洛 · 持盾中闪避",
          description: "格挡架势中按 SPACE 闪避",
          action: () => {
            this.spawnFloatingText("格挡中闪避！", 220, 240, "status");
            this.spawnParticles("guard", 220, 300, 1);
            this.shakeScreen(0.1);
            return "德斯洛：持盾时成功闪避";
          }
        },
        {
          name: "东方 · 格挡中全方位闪避",
          description: "持盾时可进行全方位闪避",
          action: () => {
            this.spawnFloatingText("全方位闪避", 220, 240, "status");
            this.spawnParticles("guard", 220, 300, 1);
            return "东方诸国剑术：格挡中全方位闪避";
          }
        },
        {
          name: "东方 · 连续闪避后必暴",
          description: "连续闪避 2 次后下一次攻击暴击",
          chain: db,
          source: "player",
          context: { consecutiveCrit: true },
          preview: "连续闪避后暴击"
        },
        {
          name: "东方 · 出剑后化解",
          description: "出剑后短时间内格挡化解一切攻击",
          action: () => {
            this.spawnFloatingText("化解！", 220, 240, "status");
            this.spawnParticles("guard", 220, 300, 1.5);
            this.flashScreen("#2ecc71", 0.2);
            return "东方：出剑后格挡化解敌人攻击";
          }
        },
        {
          name: "荒芜之地 · 追加攻击",
          description: "攻击后追加一次追击",
          chain: CombatArtDatabase.desolo.chainOverrides.greatsword.followUp,
          source: "player",
          context: { followUp: true },
          preview: "大剑追加荒芜追击"
        },
        {
          name: "荒芜之地 · 打断敌人",
          description: "追加攻击化解敌人进攻并眩晕",
          action: () => {
            this.spawnFloatingText("打断 + 眩晕", 740, 200, "status");
            this.spawnParticles("hit", 740, 260, 1.5);
            this.shakeScreen(0.25);
            return "荒芜之地：追加攻击打断并眩晕敌人";
          }
        },
        {
          name: "荒芜之地 · 施法时招架/咒还",
          description: "咏唱中按 F 进行招架或咒还",
          action: () => {
            this.spawnFloatingText("施法招架", 220, 240, "status");
            this.spawnParticles("magic", 220, 280, 1);
            this.spawnParticles("guard", 220, 300, 0.8);
            return "荒芜之地：施法时成功招架/咒还";
          }
        }
      );
    }

    if (category === "defenses") {
      for (const [id, defense] of Object.entries(DefenseDatabase)) {
        items.push({
          name: defense.name,
          description: `${defense.name} 自动 Perfect 演示`,
          chain: defense,
          source: "enemy",
          preview: `完美执行 ${defense.name}`
        });
      }
    }

    return items;
  }

  // ========== 执行演示 ==========

  playItem(item) {
    this.previewTitle = item.name;
    this.previewText = item.preview || item.description;
    this.log(`演示：${item.name}`);

    if (item.action) {
      const msg = item.action();
      if (msg) this.log(msg);
      this.state = "preview";
      this.message = `${item.name} — 按任意键返回`;
      return;
    }

    if (item.chain) {
      this.startQTE(item);
    }
  }

  startQTE(item) {
    this.state = "qte";
    const scaled = Difficulty.scaleChain(item.chain);
    this.qteRunner = new QTEChainRunner(scaled, {
      source: item.source || "player",
      ...(item.context || {}),
      onNodeEffect: (node, outcome, transition) => {
        if (transition.message) this.log(transition.message);
      },
      onRhythmHit: (idx) => {
        this.log(`节拍 ${idx + 1} 命中`);
      }
    });
    if (item.forceOutcome) {
      this.qteRunner.forceOutcome(item.forceOutcome);
    } else {
      this.qteRunner.forceOutcome("perfect");
    }
    this.message = `${item.name} — 自动演示中`;
  }

  updateQTE(dt) {
    if (!this.qteRunner) {
      this.state = "preview";
      this.message = `${this.previewTitle} — 按任意键返回`;
      return;
    }

    this.qteRunner.update(dt);

    // 自动输入：由 runner 的 forceOutcome 自动推进
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

    // 伤害数字（演示中统一打向敌人）
    if (effects.damage > 0) {
      const isCrit = ctx.perfectCrit || ctx.consecutiveCrit;
      this.spawnFloatingText(`-${effects.damage}`, ex, ey - 40, isCrit ? "crit" : "damage");
      this.spawnParticles(isCrit ? "slash" : "hit", ex, ey, isCrit ? 1.5 : 1);
      this.shakeScreen(isCrit ? 0.25 : 0.15);
      this.log(`${isCrit ? "暴击" : "造成"} ${effects.damage} 伤害`);
    }

    if (effects.stunEnemy > 0) {
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
      this.spawnFloatingText("反击！", ex, ey - 60, "status");
      this.log("敌方回合发动反击");
    }

    this.qteRunner = null;
    this.state = "preview";
    this.message = `${this.previewTitle} — 按任意键返回`;
  }

  // ========== 工具方法 ==========

  log(msg) {
    this.logs.unshift({ text: msg, time: performance.now() });
    if (this.logs.length > 30) this.logs.pop();
    this.onLog(msg);
  }

  spawnFloatingText(text, x, y, type) {
    this.floatingTexts.add(text, x, y, type);
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

  getCurrentItems() {
    return this.state === "list" ? this.getItems(this.category) : [];
  }

  get turnState() {
    return "demo_" + this.state;
  }
}
