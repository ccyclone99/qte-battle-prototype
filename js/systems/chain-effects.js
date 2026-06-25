const ChainEffectSystem = {
  resourceLabel(type) {
    const definition = typeof ResourceDefinitions !== "undefined" ? ResourceDefinitions[type] : null;
    return definition ? definition.label : type;
  },

  statusLabel(id) {
    const definition = typeof StatusDefinitions !== "undefined" ? StatusDefinitions[id] : null;
    return definition ? definition.label : id;
  },

  formatOutcome(outcome) {
    const labels = {
      perfect: "Perfect",
      success: "Success",
      early: "Early",
      late: "Late",
      fail: "Fail",
      timeout: "Timeout"
    };
    return labels[outcome] || outcome;
  },

  collectResources(effects) {
    const resources = { ...(effects.resources || {}) };
    if (effects.spellEnergy && resources.spellEnergy === undefined) {
      resources.spellEnergy = effects.spellEnergy;
    }
    return resources;
  },

  applyResources(scene, effects, options = {}) {
    if (!scene || !scene.resourceSystem) return [];
    const resources = this.collectResources(effects);
    const results = [];
    const y = options.playerY || 300;

    for (const [type, amount] of Object.entries(resources)) {
      if (!Number.isFinite(amount) || amount === 0) continue;
      const result = scene.resourceSystem.add(type, amount);
      results.push(result);

      const applied = Math.floor(result.applied || 0);
      if (applied === 0) continue;

      const label = this.resourceLabel(type);
      const sign = applied > 0 ? "+" : "-";
      const text = `${sign}${Math.abs(applied)} ${label}`;
      if (scene.spawnFloatingText) {
        scene.spawnFloatingText(text, 220, y, "status");
      }

      if (scene.effectQueue) {
        const preset = type === "heat" ? "fireball" : "magic";
        scene.effectQueue.emit({
          type: "particles",
          preset,
          anchor: type === "heat" ? "playerHand" : "playerCore",
          intensity: Math.min(1.6, 0.8 + Math.abs(applied) / 80),
          label: `${type}:${applied > 0 ? "gain" : "spend"}`
        });
      }

      if (scene.log) {
        scene.log(`${applied > 0 ? "获得" : "消耗"} ${Math.abs(applied)} ${label}`);
      }
    }

    return results;
  },

  applyStatuses(scene, effects, options = {}) {
    if (!scene || !scene.statusSystem) return [];
    const source = options.source || "qte";
    const statuses = effects.statuses || [];
    const results = scene.statusSystem.applyMany(statuses, { source });
    const hasAbsorbReadyStatus = statuses.some(status => {
      const id = status.id || status.type;
      const target = status.target || "enemy";
      return id === "absorbReady" && target === "player";
    });

    if (effects.absorbReady && !hasAbsorbReadyStatus) {
      const applied = scene.statusSystem.apply({ target: "player", type: "absorbReady", turns: 1 }, { source });
      if (applied) results.push(applied);
    }

    this.applyStatusResults(scene, results, options);
    return results;
  },

  applyStatusResults(scene, results, options = {}) {
    if (!scene || !scene.statusSystem) return;
    const playerY = options.playerY || 260;
    const enemyY = options.enemyY || 280;

    for (const result of results || []) {
      if (!result || !result.status) continue;
      const status = result.status;
      const definition = result.definition || scene.statusSystem.getDefinition(status.id);
      const label = definition.label || status.id;
      const x = status.target === "player" ? 220 : 740;
      const y = status.target === "player" ? playerY : enemyY;

      if (scene.spawnFloatingText) {
        scene.spawnFloatingText(`${label}${status.duration ? ` ${status.duration}` : ""}`, x, y, "status");
      }
      if (scene.effectQueue) {
        scene.effectQueue.emitStatus(status, result.type);
      }
      if (scene.log) {
        scene.log(`${status.target === "player" ? "玩家" : "敌人"}获得状态：${label}`);
      }
    }
  },

  applyResourceUpdateResults(scene, results) {
    for (const result of results || []) {
      if (result.type === "damage" && result.target === "player") {
        scene.playerHp = Math.max(0, scene.playerHp - result.amount);
        if (scene.playerHp <= 0) {
          scene.setTurnState && scene.setTurnState("game_over");
          scene.setMessage && scene.setMessage(result.message || "资源反噬");
        }
      }
    }
  },

  tickStatuses(scene, target) {
    if (!scene || !scene.statusSystem) return;
    const results = scene.statusSystem.tick(target);
    for (const result of results) {
      if (result.type === "damage") {
        if (scene.effectQueue) scene.effectQueue.emitStatus(result.status, "tick");
        const amount = Math.floor(result.amount);
        if (amount > 0 && scene.applyDamage) {
          scene.applyDamage(result.target, amount, { status: true });
          scene.log && scene.log(result.message);
        }
      } else if (result.type === "expire") {
        const definition = result.definition || scene.statusSystem.getDefinition(result.status.id);
        scene.log && scene.log(`${definition.label || result.status.id}结束`);
      }
    }
  },

  capitalize(value) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  },

  nodeInputLabel(node) {
    const input = node.input || {};
    const key = input.key || "?";
    if (input.type === "press") return `按 ${key}`;
    if (input.type === "hold_release") return `松开 ${key}`;
    if (input.type === "rhythm") return `节奏 ${key} x${(input.beats || []).length}`;
    return key;
  },

  transitionForOutcome(node, outcome) {
    return node[`on${this.capitalize(outcome)}`] || node.onFail || node.onSuccess || node.onPerfect || null;
  },

  simulateChain(chain, outcome = "perfect", options = {}) {
    const rows = [];
    const effects = {
      damage: 0,
      chargeMul: 1,
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
      visualEvents: [],
      messages: [],
      perfectHit: false
    };

    if (!chain || !Array.isArray(chain.nodes) || chain.nodes.length === 0) {
      return { rows, effects, terminatedBy: "missing-chain" };
    }

    let node = chain.nodes[0];
    let currentMul = 1;
    const visited = new Set();
    const maxSteps = options.maxSteps || 20;
    let terminatedBy = "complete";

    while (node && rows.length < maxSteps) {
      if (visited.has(node.id)) {
        terminatedBy = "loop";
        break;
      }
      visited.add(node.id);

      const transition = this.transitionForOutcome(node, outcome);
      if (!transition) {
        terminatedBy = "missing-transition";
        break;
      }

      const row = this.buildTimelineRow(rows.length + 1, node, outcome, transition, currentMul);
      rows.push(row);

      if (outcome === "perfect") effects.perfectHit = true;
      if (transition.chargeMul !== undefined) currentMul *= transition.chargeMul;
      row.chargeMulAfter = currentMul;
      if (transition.damage !== undefined) {
        const damage = Math.floor(transition.damage * currentMul);
        row.damage = damage;
        effects.damage += damage;
      }
      if (transition.selfStun !== undefined) effects.selfStun = Math.max(effects.selfStun, transition.selfStun);
      if (transition.stunEnemy !== undefined) effects.stunEnemy = Math.max(effects.stunEnemy, transition.stunEnemy);
      if (transition.iframe !== undefined) effects.iframe = Math.max(effects.iframe, transition.iframe);
      if (transition.damageMul !== undefined) effects.damageMul = transition.damageMul;
      if (transition.staminaCost !== undefined) effects.staminaCost += transition.staminaCost;
      if (transition.openPlayerTurn) effects.openPlayerTurn = true;
      if (transition.resource) {
        for (const [key, value] of Object.entries(transition.resource)) {
          effects.resources[key] = (effects.resources[key] || 0) + value;
          if (key === "spellEnergy") effects.spellEnergy += value;
        }
      }
      if (transition.absorbReady) effects.absorbReady = true;
      if (transition.status) effects.statuses.push(transition.status);
      if (transition.visualEvent) effects.visualEvents.push(transition.visualEvent);
      if (transition.message) effects.messages.push(transition.message);

      row.cumulativeDamage = effects.damage;
      row.cumulativeResources = { ...effects.resources };

      if (!transition.next) break;
      node = chain.nodes.find(item => item.id === transition.next);
      if (!node) {
        terminatedBy = "missing-next";
        break;
      }
    }

    if (rows.length >= maxSteps) terminatedBy = "max-steps";
    effects.chargeMul = currentMul;
    return { rows, effects, terminatedBy };
  },

  buildTimelineRow(step, node, outcome, transition, currentMul) {
    return {
      step,
      nodeId: node.id,
      nodeName: node.name,
      input: this.nodeInputLabel(node),
      duration: node.duration,
      window: node.window || null,
      perfect: node.perfect,
      outcome,
      transition,
      next: transition.next || null,
      message: transition.message || "",
      visualEvent: transition.visualEvent || "",
      baseDamage: transition.damage || 0,
      damage: transition.damage !== undefined ? Math.floor(transition.damage * currentMul) : 0,
      chargeMulBefore: currentMul,
      chargeMulAfter: currentMul,
      resources: transition.resource ? { ...transition.resource } : {},
      status: transition.status || null,
      stunEnemy: transition.stunEnemy || 0,
      selfStun: transition.selfStun || 0,
      iframe: transition.iframe || 0,
      openPlayerTurn: !!transition.openPlayerTurn,
      cumulativeDamage: 0,
      cumulativeResources: {}
    };
  },

  timelineLinesFromRows(rows, options = {}) {
    if (!rows || rows.length === 0) return ["时间轴：无"];
    const limit = options.limit || rows.length;
    const lines = ["时间轴"];
    for (const row of rows.slice(0, limit)) {
      const parts = [
        `${row.step}. ${row.nodeName}`,
        this.formatOutcome(row.outcome),
        row.input
      ];
      if (row.damage) parts.push(`伤害 ${row.damage}`);
      for (const [key, value] of Object.entries(row.resources || {})) {
        if (value) parts.push(`${this.resourceLabel(key)} ${value > 0 ? "+" : ""}${value}`);
      }
      if (row.status) parts.push(`状态 ${this.statusLabel(row.status.type || row.status.id)}`);
      if (row.stunEnemy) parts.push(`眩晕 ${row.stunEnemy}s`);
      if (row.selfStun) parts.push(`硬直 ${row.selfStun}s`);
      if (row.iframe) parts.push(`规避 ${row.iframe}s`);
      if (row.openPlayerTurn) parts.push("额外回合");
      if (row.visualEvent) parts.push(`FX ${row.visualEvent}`);
      if (row.next) parts.push(`-> ${row.next}`);
      lines.push(parts.join(" | "));
    }
    return lines;
  },

  buildQTEResultLines({ title, effects, context, dealtDamage, isCrit, resultLog, formatOutcome }) {
    const lines = [];
    const fmt = formatOutcome || this.formatOutcome;
    lines.push(`本次结果：${title}`);
    lines.push(`伤害：${dealtDamage}${isCrit ? "（暴击）" : ""}`);
    if (effects.stunEnemy > 0) lines.push(`敌人眩晕：${effects.stunEnemy.toFixed(1)} 秒`);
    if (effects.iframe > 0) lines.push(`无敌/规避窗口：${effects.iframe.toFixed(2)} 秒`);
    if (effects.damageMul !== 1.0) lines.push(`玩家承伤倍率：${effects.damageMul}`);
    if (effects.selfStun > 0) lines.push(`自身硬直：${effects.selfStun.toFixed(1)} 秒`);
    if (effects.openPlayerTurn) lines.push("回合结果：打开破绽，获得额外玩家回合。");

    const resources = this.collectResources(effects);
    for (const [type, amount] of Object.entries(resources)) {
      if (!amount) continue;
      lines.push(`${amount > 0 ? "获得" : "消耗"}${this.resourceLabel(type)}：${Math.abs(Math.floor(amount))}`);
    }

    if (effects.absorbReady) lines.push("咒还状态：下一次可吸收/反射法术。");
    for (const status of effects.statuses || []) {
      const id = status.id || status.type;
      lines.push(`附加状态：${this.statusLabel(id)} ${status.turns || status.duration || 1} 回合`);
    }
    if (context && context.counterAttack) lines.push("敌方回合反击：敌人攻击被打断。");
    if (context && context.followUp) lines.push("追加攻击：用于追击，成功时可衔接打断效果。");
    if (effects.messages && effects.messages.length > 0) {
      lines.push(`关键反馈：${effects.messages.slice(-2).join(" / ")}`);
    }
    if (resultLog && resultLog.length > 0) {
      lines.push(`判定记录：${resultLog.map(entry => `${entry.nodeName}:${fmt(entry.outcome)}`).join(" -> ")}`);
    }
    return lines;
  },

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
        if (value.openPlayerTurn) effects.add("额外玩家回合");
        if (value.status) {
          const statusId = value.status.id || value.status.type;
          effects.add(`状态：${this.statusLabel(statusId)}`);
        }
        if (value.resource) {
          for (const [key, amount] of Object.entries(value.resource)) {
            effects.add(`${this.resourceLabel(key)} ${amount >= 0 ? "+" : ""}${amount}`);
          }
        }
      }
    }
    return Array.from(effects).join("，");
  }
};
