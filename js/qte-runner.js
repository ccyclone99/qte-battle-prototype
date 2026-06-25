class QTEChainRunner {
  constructor(chainConfig, context) {
    this.chain = chainConfig;
    this.context = context || {};
    this.nodeIndex = 0;
    this.nodeTimer = 0;
    this.state = "running"; // running | done
    this.resultLog = [];

    // 节奏节点专用
    this.rhythmState = {
      beatIndex: 0,
      hitCount: 0,
      missCount: 0,
      wrongKeyMissed: false
    };

    // 当前节点是否已经结算过（防止一帧多次判定）
    this.resolvedThisFrame = false;

    // 演示模式强制结果与时间缩放
    this.forcedOutcome = null;
    this.forcedDelay = 0.18;
    this.postNodePause = 0;
    this.timeScale = 1;
    this.handfeel = {
      windowPad: 0.08,
      holdWindowPad: 0.10,
      perfectTolerance: 0.07,
      rhythmPad: 0.07,
      timeoutGrace: 0.22,
      ...(this.context.handfeel || {})
    };
    this.debug = {
      lastInput: null,
      lastOutcome: null
    };

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
    const pad = node.input && node.input.type === "hold_release"
      ? this.handfeel.holdWindowPad
      : this.handfeel.windowPad;
    const source = node.window || { start: 0, end: node.duration };
    return {
      start: Math.max(0, source.start - pad),
      end: Math.min(node.duration + this.handfeel.timeoutGrace, source.end + pad),
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

    // 节点间停顿（自动演示用）
    if (this.nodeTimer < 0) {
      this.nodeTimer += dt * this.timeScale;
      if (this.nodeTimer < 0) return;
      this.nodeTimer = 0;
    } else {
      this.nodeTimer += dt * this.timeScale;
    }

    // 节奏节点需要特殊处理 miss
    if (node.input.type === "rhythm") {
      this.updateRhythm(node);
      return;
    }


    // 普通节点超时判定
    if (this.nodeTimer > node.duration + this.handfeel.timeoutGrace) {
      this.resolveNode("timeout");
    }

    // 演示/自动模式：强制结果，按 outcome 选择合适的时间点结算
    if (this.forcedOutcome && this.nodeTimer >= this.computeAutoResolveTime(node)) {
      this.resolveNode(this.forcedOutcome);
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

  getExpectedInputTime() {
    const node = this.currentNode();
    if (!node) return null;
    if (node.input.type === "rhythm") {
      const beats = node.input.beats;
      const idx = this.rhythmState.beatIndex;
      if (idx < beats.length) return beats[idx];
      return null;
    }
    if (this.forcedOutcome) return this.computeAutoResolveTime(node);
    if (node.perfect !== null && node.perfect !== undefined) return node.perfect;
    const win = this.getEffectiveWindow(node);
    return (win.start + win.end) / 2;
  }

  updateRhythm(node) {
    if (this.forcedOutcome) {
      this.updateForcedRhythm(node);
      return;
    }

    const beats = node.input.beats;
    const tolerance = (node.rhythmTolerance || 0.18) + this.handfeel.rhythmPad;

    // 检查是否错过当前节拍（若已因乱按记过 miss，则只推进不重复计数）
    while (this.rhythmState.beatIndex < beats.length) {
      const beatTime = beats[this.rhythmState.beatIndex];
      if (this.nodeTimer > beatTime + tolerance) {
        if (!this.rhythmState.wrongKeyMissed) {
          this.rhythmState.missCount++;
        }
        this.rhythmState.beatIndex++;
        this.rhythmState.wrongKeyMissed = false;
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

  updateForcedRhythm(node) {
    const beats = node.input.beats;
    const tolerance = (node.rhythmTolerance || 0.18) + this.handfeel.rhythmPad;
    const outcome = this.forcedOutcome;

    if (outcome === "fail" || outcome === "early" || outcome === "late") {
      const firstBeat = beats[0] || 0.2;
      if (this.nodeTimer >= firstBeat + tolerance) {
        this.rhythmState.missCount = beats.length;
        this.rhythmState.beatIndex = beats.length;
        this.resolveNode("fail");
      }
      return;
    }

    while (this.rhythmState.beatIndex < beats.length) {
      const idx = this.rhythmState.beatIndex;
      const beatTime = beats[idx];
      if (this.nodeTimer >= beatTime) {
        this.rhythmState.hitCount++;
        this.rhythmState.beatIndex++;
        this.context.onRhythmHit && this.context.onRhythmHit(idx, 0);
      } else {
        break;
      }
    }

    if (this.rhythmState.beatIndex >= beats.length) {
      this.resolveNode(outcome === "success" ? "success" : "perfect");
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
        this.resolveNode(this.forcedOutcome);
      }
      return;
    }

    if (node.input.type === "rhythm") {
      this.handleRhythmInput(node, event);
      return;
    }

    if (!Utils.inputMatches(node.input, event)) {
      this.recordDebugInput(event, node, false);
      return;
    }

    const t = this.nodeTimer;
    const win = this.getEffectiveWindow(node);
    const perfect = node.perfect;
    this.recordDebugInput(event, node, true);

    if (t < win.start) {
      this.resolveNode("early");
    } else if (t > win.end) {
      this.resolveNode("late");
    } else if (perfect !== null && perfect !== undefined && Math.abs(t - perfect) <= this.handfeel.perfectTolerance) {
      this.resolveNode("perfect");
    } else {
      this.resolveNode("success");
    }
  }

  handleRhythmInput(node, event) {
    if (event.type !== "press") return;

    const beats = node.input.beats;
    const tolerance = (node.rhythmTolerance || 0.18) + this.handfeel.rhythmPad;
    const idx = this.rhythmState.beatIndex;

    if (idx >= beats.length) return;
    this.recordDebugInput(event, node, event.key.toUpperCase() === node.input.key.toUpperCase());

    // 防连打/乱按：按错键只记 miss，不跳过当前拍子，仍可在判定时间内按对
    if (event.key.toUpperCase() !== node.input.key.toUpperCase()) {
      if (!this.rhythmState.wrongKeyMissed) {
        this.rhythmState.missCount++;
        this.rhythmState.wrongKeyMissed = true;
      }
      this.context.onRhythmMiss && this.context.onRhythmMiss(-1);
      return;
    }

    const beatTime = beats[idx];
    const diff = Math.abs(this.nodeTimer - beatTime);

    if (diff <= tolerance) {
      this.rhythmState.hitCount++;
      this.rhythmState.beatIndex++;
      this.rhythmState.wrongKeyMissed = false;
      // 节奏节点即时反馈，但不单独结算，等全部节拍完成
      this.context.onRhythmHit && this.context.onRhythmHit(idx, diff);
    } else {
      // 按错拍子算失败
      this.rhythmState.missCount++;
      this.rhythmState.beatIndex++;
      this.rhythmState.wrongKeyMissed = false;
      this.context.onRhythmMiss && this.context.onRhythmMiss(idx);
    }
  }

  forceOutcome(outcome) {
    this.forcedOutcome = outcome;
  }

  recordDebugInput(event, node, matched) {
    const expected = this.getExpectedInputTime();
    const time = Math.max(0, this.nodeTimer);
    this.debug.lastInput = {
      key: event.key,
      type: event.type,
      nodeId: node.id,
      nodeName: node.name,
      matched,
      time,
      expected,
      delta: expected === null || expected === undefined ? null : time - expected
    };
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
    this.debug.lastOutcome = {
      nodeId: node.id,
      nodeName: node.name,
      outcome,
      time: Math.max(0, this.nodeTimer)
    };

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
        this.rhythmState = { beatIndex: 0, hitCount: 0, missCount: 0, wrongKeyMissed: false };
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
      spellEnergy: 0,
      resources: {},
      absorbReady: false,
      statuses: [],
      visualEvents: [],
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
      if (t.resource) {
        for (const [key, value] of Object.entries(t.resource)) {
          effects.resources[key] = (effects.resources[key] || 0) + value;
          if (key === "spellEnergy") effects.spellEnergy += value;
        }
      }
      if (t.absorbReady) effects.absorbReady = true;
      if (t.status) effects.statuses.push(t.status);
      if (t.visualEvent) effects.visualEvents.push(t.visualEvent);
      if (t.message) effects.messages.push(t.message);
    }

    effects.chargeMul = currentMul;
    return effects;
  }
}
