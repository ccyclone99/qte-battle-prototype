class QTEChainRunner {
  constructor(chainConfig, context) {
    this.chain = chainConfig;
    this.context = context;
    this.nodeIndex = 0;
    this.nodeTimer = 0;
    this.state = "running"; // running | done
    this.resultLog = [];

    // 节奏节点专用
    this.rhythmState = {
      beatIndex: 0,
      hitCount: 0,
      missCount: 0
    };

    // 当前节点是否已经结算过（防止一帧多次判定）
    this.resolvedThisFrame = false;

    // 演示模式强制结果与时间缩放
    this.forcedOutcome = null;
    this.forcedDelay = 0.18;
    this.postNodePause = 0;
    this.timeScale = 1;

    const firstNode = this.currentNode();
    if (firstNode && firstNode.input.type === "rhythm") {
      this.rhythmState.beatIndex = 0;
    }
  }

  currentNode() {
    return this.chain.nodes[this.nodeIndex] || null;
  }

  isRunning() {
    return this.state === "running";
  }

  isDone() {
    return this.state === "done";
  }

  currentNodeName() {
    const node = this.currentNode();
    return node ? node.name : "";
  }

  currentNodeProgress() {
    const node = this.currentNode();
    if (!node) return 1;
    return Utils.clamp(this.nodeTimer / node.duration, 0, 1);
  }

  getEffectiveWindow(node) {
    // 判定窗口基础放宽
    const pad = 0.04;
    return {
      start: Math.max(0, node.window.start - pad),
      end: Math.min(node.duration + 0.3, node.window.end + pad),
      perfect: node.perfect
    };
  }

  getWindowBounds() {
    const node = this.currentNode();
    if (!node) return null;
    const win = this.getEffectiveWindow(node);
    return {
      start: win.start,
      end: win.end,
      perfect: win.perfect,
      duration: node.duration
    };
  }

  update(dt) {
    if (this.state !== "running") return;
    this.resolvedThisFrame = false;

    const node = this.currentNode();
    if (!node) {
      this.state = "done";
      return;
    }

    this.nodeTimer += dt * this.timeScale;

    // 节点间停顿（自动演示用）
    if (this.nodeTimer < 0) {
      this.nodeTimer += dt * this.timeScale;
      if (this.nodeTimer < 0) return;
      this.nodeTimer = 0;
    }

    // 节奏节点需要特殊处理 miss
    if (node.input.type === "rhythm") {
      this.updateRhythm(node);
      return;
    }

    // 普通节点超时判定
    if (this.nodeTimer > node.duration + 0.3) {
      this.resolveNode("timeout");
    }

    // 演示/自动模式：强制结果，按 outcome 选择合适的时间点结算
    if (this.forcedOutcome && this.nodeTimer >= this.computeAutoResolveTime(node)) {
      const outcome = this.forcedOutcome;
      this.forcedOutcome = null;
      this.resolveNode(outcome);
    }
  }

  computeAutoResolveTime(node) {
    const win = this.getEffectiveWindow(node);
    const outcome = this.forcedOutcome;
    if (!outcome) return 0.18;
    if (outcome === "perfect" && win.perfect !== null && win.perfect !== undefined) {
      return Math.min(node.duration - 0.05, win.perfect + 0.08);
    }
    if (outcome === "success") {
      return Math.min(node.duration - 0.05, (win.start + win.end) / 2);
    }
    if (outcome === "early") {
      return Math.max(0.05, win.start - 0.05);
    }
    if (outcome === "fail" || outcome === "late") {
      return Math.min(node.duration + 0.25, node.duration + 0.25);
    }
    return 0.18;
  }

  updateRhythm(node) {
    // 演示/自动模式：强制结果
    if (this.forcedOutcome && this.nodeTimer > 0.18) {
      this.resolveNode(this.forcedOutcome);
      return;
    }

    const beats = node.input.beats;
    const tolerance = (node.rhythmTolerance || 0.15) + 0.04;

    // 检查是否错过当前节拍
    while (this.rhythmState.beatIndex < beats.length) {
      const beatTime = beats[this.rhythmState.beatIndex];
      if (this.nodeTimer > beatTime + tolerance) {
        this.rhythmState.missCount++;
        this.rhythmState.beatIndex++;
      } else {
        break;
      }
    }

    // 所有节拍结束后结算
    if (this.rhythmState.beatIndex >= beats.length) {
      const total = beats.length;
      const hit = this.rhythmState.hitCount;
      const miss = this.rhythmState.missCount;

      if (miss === 0 && hit === total) {
        this.resolveNode("perfect");
      } else if (hit >= total * 0.5) {
        this.resolveNode("success");
      } else {
        this.resolveNode("fail");
      }
    }
  }

  handleInput(event, heldKeys) {
    if (this.state !== "running") return;
    if (this.resolvedThisFrame) return;

    const node = this.currentNode();
    if (!node) return;

    // 演示/自动模式：强制结果
    if (this.forcedOutcome) {
      if (node.input.type === "rhythm" || Utils.inputMatches(node.input, event)) {
        const outcome = this.forcedOutcome;
        this.forcedOutcome = null;
        this.resolveNode(outcome);
      }
      return;
    }

    if (node.input.type === "rhythm") {
      this.handleRhythmInput(node, event);
      return;
    }

    if (!Utils.inputMatches(node.input, event)) return;

    const t = this.nodeTimer;
    const win = this.getEffectiveWindow(node);
    const perfect = node.perfect;

    if (t < win.start) {
      this.resolveNode("early");
    } else if (t > win.end) {
      this.resolveNode("late");
    } else if (perfect !== null && perfect !== undefined && Math.abs(t - perfect) <= 0.06) {
      this.resolveNode("perfect");
    } else {
      this.resolveNode("success");
    }
  }

  handleRhythmInput(node, event) {
    if (event.type !== "press") return;
    if (event.key.toUpperCase() !== node.input.key.toUpperCase()) return;

    const beats = node.input.beats;
    const tolerance = (node.rhythmTolerance || 0.15) + 0.04;
    const idx = this.rhythmState.beatIndex;

    if (idx >= beats.length) return;

    const beatTime = beats[idx];
    const diff = Math.abs(this.nodeTimer - beatTime);

    if (diff <= tolerance) {
      this.rhythmState.hitCount++;
      this.rhythmState.beatIndex++;
      // 节奏节点即时反馈，但不单独结算，等全部节拍完成
      this.context.onRhythmHit && this.context.onRhythmHit(idx, diff);
    } else {
      // 按错拍子算失败
      this.rhythmState.missCount++;
      this.rhythmState.beatIndex++;
    }
  }

  forceOutcome(outcome) {
    this.forcedOutcome = outcome;
  }

  resolveNode(outcome) {
    if (this.resolvedThisFrame) return;
    this.resolvedThisFrame = true;

    const node = this.currentNode();
    if (!node) {
      this.state = "done";
      return;
    }

    const transition = node["on" + Utils.capitalize(outcome)]
      || node.onFail
      || { next: null, effect: "fail", damage: 0 };

    this.resultLog.push({
      nodeId: node.id,
      nodeName: node.name,
      outcome,
      transition
    });

    // 应用当前节点效果
    this.context.onNodeEffect && this.context.onNodeEffect(node, outcome, transition);

    if (transition.next) {
      const nextIndex = Utils.findNodeIndex(this.chain, transition.next);
      if (nextIndex >= 0) {
        this.nodeIndex = nextIndex;
        this.nodeTimer = -this.postNodePause;
        this.rhythmState = { beatIndex: 0, hitCount: 0, missCount: 0 };
        const nextNode = this.currentNode();
        if (nextNode && nextNode.input.type === "rhythm") {
          this.rhythmState.beatIndex = 0;
        }
      } else {
        this.state = "done";
      }
    } else {
      this.state = "done";
    }
  }

  getAccumulatedEffects() {
    const effects = {
      damage: 0,
      chargeMul: 1.0,
      selfStun: 0,
      stunEnemy: 0,
      iframe: 0,
      damageMul: 1.0,
      staminaCost: 0,
      openPlayerTurn: false,
      messages: []
    };

    let currentMul = 1.0;

    for (const entry of this.resultLog) {
      const t = entry.transition;
      if (entry.outcome === "perfect") effects.perfectHit = true;
      if (t.chargeMul !== undefined) currentMul *= t.chargeMul;
      if (t.damage !== undefined) effects.damage += Math.floor(t.damage * currentMul);
      if (t.selfStun !== undefined) effects.selfStun = Math.max(effects.selfStun, t.selfStun);
      if (t.stunEnemy !== undefined) effects.stunEnemy = Math.max(effects.stunEnemy, t.stunEnemy);
      if (t.iframe !== undefined) effects.iframe = Math.max(effects.iframe, t.iframe);
      if (t.damageMul !== undefined) effects.damageMul = t.damageMul;
      if (t.staminaCost !== undefined) effects.staminaCost += t.staminaCost;
      if (t.openPlayerTurn) effects.openPlayerTurn = true;
      if (t.message) effects.messages.push(t.message);
    }

    effects.chargeMul = currentMul;
    return effects;
  }
}
