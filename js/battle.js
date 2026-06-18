class BattleSystem {
  constructor(input) {
    this.input = input;

    this.playerMaxHp = 100;
    this.playerHp = this.playerMaxHp;
    this.enemyMaxHp = 200;
    this.enemyHp = this.enemyMaxHp;

    this.turnState = "weapon_select"; // weapon_select | player_turn | enemy_turn | qte_running | resolving | game_over
    this.actionBarMax = 5.0;
    this.actionBar = 0;
    this.currentWeapon = null; // 开局选择后固定

    this.enemyAttack = null;
    this.enemyAttackTimer = 0;
    this.enemyAttackPhase = "none"; // none | windup | response | hit
    this.enemyStunTimer = 0;
    this.defenseTriggered = false;

    this.qteRunner = null;
    this.resolveTimer = 0;
    this.resolveDuration = 0.4;

    this.message = "按 A / S / D 选择武器";
    this.weaponSelectMessage = "按 A / S / D 选择武器";
    this.messageTimer = 0;
    this.flashMessage = null;

    this.screenShake = 0;
    this.hitStop = 0;

    this.lastDamageNumber = null;
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

    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0 && this.flashMessage) {
        this.message = this.flashMessage;
        this.flashMessage = null;
      }
    }

    switch (this.turnState) {
      case "weapon_select":
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

  updateWeaponSelect() {
    this.consumeBufferedInputs();
  }

  updatePlayerTurn(dt) {
    // 先读取输入，允许玩家在行动条满前最后一刻触发 QTE
    this.consumeBufferedInputs();
    if (this.turnState !== "player_turn") return;

    // 敌人眩晕会冻结/恢复玩家行动条
    if (this.enemyStunTimer > 0) {
      this.enemyStunTimer -= dt;
      if (this.enemyStunTimer < 0) this.enemyStunTimer = 0;
    }

    this.actionBar += dt;
    if (this.actionBar >= this.actionBarMax) {
      this.actionBar = this.actionBarMax;
      this.performNormalAttack();
    }
  }

  updateEnemyTurn(dt) {
    if (!this.enemyAttack) return;

    const attack = this.enemyAttack;
    this.enemyAttackTimer += dt;

    const responseDuration = 1.6;
    const responseStart = Math.max(0, attack.windup - responseDuration);

    if (this.enemyAttackPhase === "windup" && this.enemyAttackTimer >= responseStart) {
      this.enemyAttackPhase = "response";
      this.setMessage(`${attack.name} 来袭！${attack.hint}`);
    }

    if (this.enemyAttackPhase === "response") {
      this.consumeDefenseInputs();
    }

    if (this.enemyAttackTimer >= attack.windup + attack.hitTime && !this.defenseTriggered) {
      this.enemyAttackPhase = "hit";
      this.applyDamage("player", attack.damage);
      this.setMessage(`${attack.name} 命中！受到 ${attack.damage} 伤害`);
      if (attack.stunOnHit) {
        // 玩家被眩晕？可以扩展
      }
      this.startResolving(() => this.startPlayerTurn());
    }
  }

  updateQTE(dt) {
    if (!this.qteRunner) {
      this.turnState = "resolving";
      return;
    }

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

  consumeBufferedInputs() {
    while (true) {
      const ev = this.input.peek();
      if (!ev) return;

      if (ev.type !== "press") {
        this.input.consume(); // 清掉非按下事件
        continue;
      }

      const key = ev.key.toUpperCase();

      // 开局选择武器
      if (this.turnState === "weapon_select") {
        for (const [id, weapon] of Object.entries(WeaponDatabase)) {
          if (weapon.key === key) {
            this.input.consume();
            this.currentWeapon = id;
            this.startPlayerTurn();
            return;
          }
        }
        this.input.consume(); // 无效选择丢弃
        continue;
      }

      // 战斗中触发当前武器的 QTE 链
      if (this.turnState === "player_turn" && this.currentWeapon) {
        const weapon = WeaponDatabase[this.currentWeapon];
        const chain = weapon.chains[key];
        if (chain) {
          this.input.consume();
          this.triggerWeaponQTE(key);
          return;
        }
      }

      // 非当前可用按键直接丢弃
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

      for (const defenseId of attack.allowedResponses) {
        const defense = DefenseDatabase[defenseId];
        if (defense && defense.key === key) {
          this.input.consume();
          this.defenseTriggered = true;
          this.triggerDefenseQTE(defenseId);
          return;
        }
      }

      // 非当前可响应按键直接丢弃
      this.input.consume();
    }
  }

  triggerWeaponQTE(chainKey) {
    const weapon = WeaponDatabase[this.currentWeapon];
    const chain = weapon.chains[chainKey];
    if (!chain) return;

    this.turnState = "qte_running";
    this.qteRunner = new QTEChainRunner(chain, {
      source: "player",
      onNodeEffect: (node, outcome, transition) => {
        if (transition.message) this.setMessage(transition.message);
      },
      onRhythmHit: (idx, diff) => {
        this.setMessage(`节拍 ${idx + 1} 命中`);
      }
    });

    this.setMessage(`${chain.name} — ${this.qteRunner.currentNodeName()}`);
  }

  triggerDefenseQTE(defenseId) {
    const defense = DefenseDatabase[defenseId];
    if (!defense) return;

    this.turnState = "qte_running";
    this.qteRunner = new QTEChainRunner(defense, {
      source: "enemy",
      onNodeEffect: (node, outcome, transition) => {
        if (transition.message) this.setMessage(transition.message);
      }
    });

    this.setMessage(`${defense.name} — ${this.qteRunner.currentNodeName()}`);
  }

  onQTEComplete() {
    if (this.turnState === "game_over" || this.playerHp <= 0) return;

    const runner = this.qteRunner;
    if (!runner) return;

    const effects = runner.getAccumulatedEffects();
    const source = runner.context.source;

    if (source === "player") {
      // 武器 QTE：伤害敌人
      if (effects.damage > 0) {
        const actualDamage = Math.floor(effects.damage);
        this.applyDamage("enemy", actualDamage);
        this.lastDamageNumber = { value: actualDamage, target: "enemy", time: 1.0 };
      }

      if (this.enemyHp <= 0) {
        this.turnState = "game_over";
        this.setMessage("胜利！");
        return;
      }

      // 玩家失衡，直接结束回合
      if (effects.selfStun > 0) {
        this.startResolving(() => this.startEnemyTurn());
        return;
      }

      // 把敌人打眩晕 → 获得额外回合
      if (effects.stunEnemy > 0) {
        this.enemyStunTimer = effects.stunEnemy;
        this.setMessage(`敌人眩晕 ${effects.stunEnemy.toFixed(1)} 秒，额外回合！`);
        this.startResolving(() => this.startPlayerTurn());
        return;
      }

      // 否则正常结束玩家回合
      this.startResolving(() => this.startEnemyTurn());
    } else {
      // 防御 QTE：根据效果处理
      const attack = this.enemyAttack;
      let finalDamage = 0;

      if (effects.iframe > 0) {
        finalDamage = 0;
      } else if (effects.damageMul !== undefined) {
        finalDamage = Math.floor(attack.damage * effects.damageMul);
      }

      if (finalDamage > 0) {
        this.applyDamage("player", finalDamage);
        this.setMessage(`未能完全规避，受到 ${finalDamage} 伤害`);
      } else if (effects.iframe > 0 || effects.damageMul === 0) {
        this.setMessage("完全规避！");
      }

      if (effects.damage > 0) {
        const counterDamage = Math.floor(effects.damage);
        this.applyDamage("enemy", counterDamage);
        this.lastDamageNumber = { value: counterDamage, target: "enemy", time: 1.0 };
      }

      if (effects.stunEnemy > 0) {
        this.enemyStunTimer = effects.stunEnemy;
        this.startResolving(() => this.startPlayerTurn());
        return;
      }

      if (this.enemyHp <= 0) {
        this.turnState = "game_over";
        this.setMessage("胜利！");
        return;
      }

      this.startResolving(() => this.startPlayerTurn());
    }
  }

  applyDamage(target, amount) {
    if (amount <= 0) return;

    if (target === "player") {
      this.playerHp = Math.max(0, this.playerHp - amount);
      this.screenShake = 0.25;
      this.hitStop = 0.12;
      if (this.playerHp <= 0) {
        this.turnState = "game_over";
        this.setMessage("战败…");
      }
    } else {
      this.enemyHp = Math.max(0, this.enemyHp - amount);
      this.screenShake = 0.15;
      this.hitStop = 0.08;
    }
  }

  performNormalAttack() {
    const weapon = WeaponDatabase[this.currentWeapon];
    if (!weapon) return;

    const damage = weapon.normalAttack || 10;
    this.applyDamage("enemy", damage);
    this.lastDamageNumber = { value: damage, target: "enemy", time: 1.0 };
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
    this.actionBar = 0;
    this.defenseTriggered = false;

    const attackIds = EnemyDatabase.base.attacks;
    const attackId = attackIds[Math.floor(Math.random() * attackIds.length)];
    this.enemyAttack = { id: attackId, ...EnemyDatabase.attacks[attackId] };
    this.enemyAttackTimer = 0;
    this.enemyAttackPhase = "windup";

    this.setMessage(`敌人准备：${this.enemyAttack.name}`);
  }

  startPlayerTurn() {
    this.turnState = "player_turn";
    this.actionBar = 0;
    this.enemyAttack = null;
    this.enemyAttackPhase = "none";
    this.defenseTriggered = false;
    this.qteRunner = null;

    const weapon = WeaponDatabase[this.currentWeapon];
    if (weapon) {
      const chainNames = Object.entries(weapon.chains)
        .map(([key, chain]) => `[${key}]${chain.name}`)
        .join(" ");
      this.setMessage(`${weapon.name} 就绪 — ${chainNames} / 等待普通攻击`);
    } else {
      this.setMessage("玩家回合");
    }
  }

  startResolving(callback) {
    if (this.turnState === "game_over") {
      if (callback) callback();
      return;
    }
    this.turnState = "resolving";
    this.resolveTimer = this.resolveDuration;
    this.resolveCallback = callback;
    this.qteRunner = null;
  }

  setMessage(text) {
    this.message = text;
    this.messageTimer = 0;
  }

  flashMessage(text, duration = 1.5) {
    this.flashMessage = text;
    this.messageTimer = duration;
    this.message = text;
  }

  getCurrentWeaponName() {
    return WeaponDatabase[this.currentWeapon]?.name || "";
  }

  getCurrentWeaponKey() {
    return WeaponDatabase[this.currentWeapon]?.key || "";
  }
}
