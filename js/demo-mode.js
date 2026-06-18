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
    this.previewTimer = 0;
    this.detailLines = [];
    this.resultLines = [];
    this.currentItem = null;
    this.listPage = 0;
    this.pageSize = 9;

    this.particles = new ParticleSystem();
    this.floatingTexts = new FloatingTextManager();

    this.screenShake = 0;
    this.hitStop = 0;
    this.turnBanner = null;
    this.screenFlash = null;

    this.logs = [];
    this.returnToMenu = false;

    // 可切换的武器
    this.playerConfig = { weapon: "greatsword", spells: [], combatArts: [] };
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

  // ========== 武器切换 ==========

  get weaponList() {
    return Object.entries(WeaponDatabase);
  }

  cycleWeapon() {
    const weapons = this.weaponList;
    const currentIdx = weapons.findIndex(([id]) => id === this.playerConfig.weapon);
    const nextIdx = (currentIdx + 1) % weapons.length;
    this.playerConfig.weapon = weapons[nextIdx][0];
    this.listPage = 0;
    this.resetHP();
    const weapon = WeaponDatabase[this.playerConfig.weapon];
    this.message = `已切换武器：${weapon.name} [${weapon.key}] — 选择分类查看效果`;
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
  }

  // ========== 主更新 ==========

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
        this.state = "list";
        this.resetHP();
        this.message = `${this.getCategoryName()} — 按数字选择效果，ESC 返回`;
        return;
      }
      // 任意其他键也返回列表
      this.input.consume();
      this.state = "list";
      this.resetHP();
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
          this.state = "main";
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
          this.state = "list";
          this.listPage = 0;
          this.resetHP();
          this.message = `${this.categories[idx - 1].name} — 按数字选择效果，ESC 返回`;
          return;
        }
        // W 键或 5 切换武器
        if (key === "W" || key === "5") {
          this.input.consume();
          this.cycleWeapon();
          return;
        }
        // D 键或 6 切换难度（仅用于展示缩放参数）
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

  // ========== 演示项构造 ==========

  getItems(category) {
    const items = [];
    const weaponId = this.playerConfig.weapon;
    const weapon = WeaponDatabase[weaponId];

    if (category === "weapons") {
      // 当前装备武器的所有链
      for (const [chainKey, chain] of Object.entries(weapon.chains)) {
        items.push({
          name: `${weapon.name} · ${chain.name} [${chainKey}]`,
          description: chain.description,
          chain,
          source: "player",
          preview: `${weapon.name} ${chain.name} 自动 Perfect 演示`
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
      // 所有武器的链（供对比）
      for (const [wid, w] of Object.entries(WeaponDatabase)) {
        if (wid === weaponId) continue;
        for (const [ckey, chain] of Object.entries(w.chains)) {
          items.push({
            name: `[对比] ${w.name} · ${chain.name}`,
            description: `切换武器查看完整参数 — ${chain.description}`,
            chain,
            source: "player",
            preview: `${w.name} ${chain.name} 跨武器预览`
          });
        }
      }
    }

    if (category === "spells") {
      const fireChain = SpellDatabase.fire.chainOverrides.staff.A;
      items.push(
        {
          name: "烈火重重 · 小火球",
          description: "蓄力过早（Early），火球微弱 — 伤害 10",
          chain: fireChain,
          source: "player",
          forceOutcome: "early",
          preview: "蓄力过早 → 小火球（伤害 10）"
        },
        {
          name: "烈火重重 · 标准火球",
          description: "正常蓄力（Success）释放标准火球 — 伤害 32",
          chain: fireChain,
          source: "player",
          forceOutcome: "success",
          preview: "正常蓄力 → 标准火球（伤害 32）"
        },
        {
          name: "烈火重重 · 大火球",
          description: "完美蓄力（Perfect）火球进化到最大 — 伤害 42",
          chain: fireChain,
          source: "player",
          forceOutcome: "perfect",
          preview: "完美蓄力 → 大火球（伤害 42）"
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
      const weaponChains = weapon.chains;
      const chainA = weaponChains.A;
      const followUpChain = CombatArtDatabase.desolo.chainOverrides[weaponId]?.followUp;
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
          action: () => {
            this.spawnFloatingText("施法中闪避！", 220, 220, "status");
            this.spawnParticles("magic", 220, 280, 1);
            this.shakeScreen(0.15);
            return "德斯洛：施法过程中成功闪避";
          }
        },
        {
          name: "德斯洛 · 持盾中闪避",
          description: "格挡架势中按 SPACE 闪避",
          action: () => {
            this.spawnFloatingText("格挡中闪避！", 220, 220, "status");
            this.spawnParticles("guard", 220, 300, 1);
            this.shakeScreen(0.1);
            return "德斯洛：持盾时成功闪避";
          }
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
          action: () => {
            this.spawnFloatingText("化解！", 220, 220, "status");
            this.spawnParticles("guard", 220, 300, 1.5);
            this.flashScreen("#2ecc71", 0.2);
            return "东方：出剑后格挡化解敌人攻击";
          }
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
        // 完美版
        items.push({
          name: `${defense.name} · Perfect`,
          description: `完美执行 ${defense.name} 全部节点`,
          chain: defense,
          source: "enemy",
          preview: `完美 ${defense.name}：完全规避 + 反击`
        });
        // 失败版
        items.push({
          name: `${defense.name} · 失败`,
          description: `${defense.name} 失败时的效果`,
          chain: defense,
          source: "enemy",
          forceOutcome: "fail",
          preview: `${defense.name} 失败：受击减伤/反击失败`
        });
      }
    }

    return items;
  }

  // ========== 执行演示 ==========

  playItem(item) {
    this.currentItem = item;
    this.previewTitle = item.name;
    this.previewText = item.preview || item.description;
    this.previewTimer = 3.0;
    this.detailLines = this.buildItemDetailLines(item);
    this.resultLines = [];
    this.log(`演示：${item.name}`);

    if (item.action) {
      const msg = item.action();
      if (msg) this.log(msg);
      this.resultLines = this.buildActionResultLines(item, msg);
      this.state = "preview";
      this.message = `${item.name} — 按任意键返回列表`;
      return;
    }

    if (item.chain) {
      this.startQTE(item);
    }
  }

  startQTE(item) {
    this.state = "qte";
    this.currentItem = item;
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
      this.previewTimer = 3.0;
      this.message = `${this.previewTitle} — 按任意键返回列表`;
      return;
    }

    this.qteRunner.update(dt);

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
      this.shakeScreen(isCrit ? 0.25 : 0.15);
      if (isCrit) this.flashScreen("#f1c40f", 0.18);
      this.log(`${isCrit ? "暴击" : "造成"} ${dealtDamage} 伤害`);
    }

    // 支路节点伤害（如 chargeMul 加成后的实际伤害，这里用 total）
    // damage 已通过 getAccumulatedEffects 累加所有节点

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
      this.spawnFloatingText("反击！", ex, ey - 60, "status");
      this.log("敌方回合发动反击");
    }

    this.resultLines = this.buildQTEResultLines(effects, ctx, dealtDamage, isCrit);
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

    this.qteRunner = null;
    this.state = "preview";
    this.previewTimer = 4.0;
    this.message = `${this.previewTitle} — 按任意键返回列表`;
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

  get turnState() {
    return "demo_" + this.state;
  }

  buildItemDetailLines(item) {
    const lines = [];

    if (item.description) {
      lines.push(`说明：${item.description}`);
    }

    if (item.chain) {
      const nodes = item.chain.nodes || [];
      lines.push(`链路：${item.chain.name}，${nodes.length} 个节点`);
      lines.push(`输入：${nodes.map(node => this.describeNodeInput(node)).join(" -> ")}`);

      const successDamage = this.estimateChainDamage(item.chain, "success");
      const perfectDamage = this.estimateChainDamage(item.chain, "perfect");
      if (successDamage > 0 || perfectDamage > 0) {
        lines.push(`参考伤害：Success ${successDamage} / Perfect ${perfectDamage}`);
      }

      const status = this.describeChainStatus(item.chain);
      if (status) {
        lines.push(`附加效果：${status}`);
      }

      lines.push(`本次演示判定：${this.formatOutcome(item.forceOutcome || "perfect")}`);
    }

    if (item.context?.counterAttack) lines.push("战斗语境：敌方回合反击，会中断敌人本次攻击。");
    if (item.context?.followUp) lines.push("战斗语境：荒芜之地追加攻击，用于攻击后追击或化解进攻。");
    if (item.details) lines.push(...item.details);

    return lines;
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

  buildQTEResultLines(effects, ctx, dealtDamage, isCrit) {
    const lines = [];
    lines.push(`本次结果：${this.previewTitle}`);
    lines.push(`伤害：${dealtDamage}${isCrit ? "（暴击）" : ""}`);
    if (effects.stunEnemy > 0) lines.push(`敌人眩晕：${effects.stunEnemy.toFixed(1)} 秒`);
    if (effects.iframe > 0) lines.push(`无敌/规避窗口：${effects.iframe.toFixed(2)} 秒`);
    if (effects.damageMul !== 1.0) lines.push(`玩家承伤倍率：${effects.damageMul}`);
    if (effects.selfStun > 0) lines.push(`自身硬直：${effects.selfStun.toFixed(1)} 秒`);
    if (ctx.counterAttack) lines.push("敌方回合反击：敌人攻击被打断。");
    if (ctx.followUp) lines.push("追加攻击：用于追击，成功时可衔接打断效果。");
    if (effects.messages.length > 0) lines.push(`关键反馈：${effects.messages.slice(-2).join(" / ")}`);
    return lines;
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
    const effects = new Set();
    for (const node of chain.nodes || []) {
      for (const value of Object.values(node)) {
        if (!value || typeof value !== "object") continue;
        if (value.stunEnemy) effects.add(`眩晕 ${value.stunEnemy}s`);
        if (value.iframe) effects.add(`规避 ${value.iframe}s`);
        if (value.damageMul === 0) effects.add("完全减伤");
        else if (value.damageMul !== undefined) effects.add(`承伤 x${value.damageMul}`);
        if (value.selfStun) effects.add(`自身硬直 ${value.selfStun}s`);
        if (value.chargeMul) effects.add(`蓄力倍率 x${value.chargeMul}`);
      }
    }
    return Array.from(effects).join("，");
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

  getQTEInspectorLines() {
    if (!this.qteRunner) return this.detailLines;
    const node = this.qteRunner.currentNode();
    if (!node) return this.detailLines;
    const bounds = this.qteRunner.getWindowBounds();
    const forced = this.currentItem?.forceOutcome || "perfect";
    return [
      `演示项：${this.previewTitle}`,
      `链路：${this.qteRunner.chain.name}`,
      `节点：${this.qteRunner.nodeIndex + 1}/${this.qteRunner.chain.nodes.length} ${node.name}`,
      `输入：${this.describeNodeInput(node)}`,
      `判定窗：${bounds.start.toFixed(2)}s - ${bounds.end.toFixed(2)}s`,
      `Perfect 点：${bounds.perfect === null || bounds.perfect === undefined ? "无" : bounds.perfect.toFixed(2) + "s"}`,
      `自动判定：${this.formatOutcome(forced)}`
    ];
  }
}
