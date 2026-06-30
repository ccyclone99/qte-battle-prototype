const QTEDebugFormatter = {
  formatOutcome(outcome) {
    const labels = {
      perfect: "Perfect",
      success: "Success",
      fail: "Fail",
      early: "Early",
      late: "Late",
      timeout: "Timeout"
    };
    return labels[outcome] || outcome || "None";
  },

  describeNodeInput(node) {
    if (!node || !node.input) return "无";
    const input = node.input;
    const key = input.key || "?";
    if (input.type === "press") return `${node.name}[按 ${key}]`;
    if (input.type === "hold_release") return `${node.name}[松开 ${key}]`;
    if (input.type === "rhythm") return `${node.name}[节奏 ${key} x${(input.beats || []).length}]`;
    return `${node.name}[${key}]`;
  },

  getLines(scene, options = {}) {
    const lines = [];
    const runner = scene && scene.qteRunner;
    const title = options.title || "QTE 调试";
    lines.push(title);
    lines.push(`阶段：${scene ? scene.turnState : "none"}`);
    if (scene && scene.getEncounterDebugLines) {
      lines.push(...scene.getEncounterDebugLines(4));
    }

    if (!runner) {
      lines.push("Runner：无");
      if (scene && scene.resourceSystem) lines.push(...scene.resourceSystem.getDebugLines());
      if (scene && scene.statusSystem) lines.push(...scene.statusSystem.getDebugLines(4));
      if (scene && scene.getCombatTelemetryLines) lines.push(...scene.getCombatTelemetryLines(4));
      if (scene && scene.getCombatTelemetryExport) lines.push("遥测导出：window.exportCombatTelemetry()");
      if (scene && scene.getDamagePathAuditLines) lines.push(...scene.getDamagePathAuditLines(3));
      if (scene && scene.hitConfirmSystem) lines.push(...scene.hitConfirmSystem.getDebugLines(4));
      if (scene && scene.activeAttackSystem) lines.push(...scene.activeAttackSystem.getDebugLines(4));
      if (scene && scene.effectQueue) lines.push(...scene.effectQueue.getDebugLines(4));
      return lines;
    }

    const node = runner.currentNode();
    const bounds = runner.getWindowBounds();
    const expected = runner.getExpectedInputTime();
    const resultText = runner.resultLog.length > 0
      ? runner.resultLog.map(entry => `${entry.nodeName}:${this.formatOutcome(entry.outcome)}`).join(" -> ")
      : "无";

    lines.push(`链路：${runner.chain.name || "未知"}`);
    if (node) {
      lines.push(`节点：${runner.nodeIndex + 1}/${runner.chain.nodes.length} ${node.name}`);
      lines.push(`输入：${this.describeNodeInput(node)}`);
      if (node.pose) lines.push(`姿态：${node.pose.state} / ${node.pose.motion}`);
      lines.push(`计时：${Math.max(0, runner.nodeTimer).toFixed(2)}s / ${node.duration.toFixed(2)}s`);
      if (bounds) {
        lines.push(`窗口：${bounds.start.toFixed(2)}s - ${bounds.end.toFixed(2)}s`);
        lines.push(`Perfect：${bounds.perfect === null || bounds.perfect === undefined ? "无" : bounds.perfect.toFixed(2) + "s"}`);
      }
      lines.push(`期望：${expected === null || expected === undefined ? "无" : expected.toFixed(2) + "s"}`);
    }

    const forced = runner.forcedOutcome ? this.formatOutcome(runner.forcedOutcome) : "手动";
    lines.push(`判定：${forced}`);
    lines.push(`实战节奏：x${runner.timeScale.toFixed(2)} / 节点停顿 ${runner.postNodePause.toFixed(2)}s`);
    lines.push(`手感：press +${runner.handfeel.windowPad.toFixed(2)} / hold +${runner.handfeel.holdWindowPad.toFixed(2)} / P ±${runner.handfeel.perfectTolerance.toFixed(2)}`);

    if (runner.debug && runner.debug.lastInput) {
      const input = runner.debug.lastInput;
      const delta = input.delta === null || input.delta === undefined ? "无" : `${input.delta >= 0 ? "+" : ""}${input.delta.toFixed(3)}s`;
      lines.push(`上次输入：${input.key} @ ${input.time.toFixed(2)}s delta ${delta}`);
    }

    if (runner.debug && runner.debug.lastOutcome) {
      const outcome = runner.debug.lastOutcome;
      lines.push(`上次结算：${outcome.nodeName} ${this.formatOutcome(outcome.outcome)} @ ${outcome.time.toFixed(2)}s`);
    }

    lines.push(`已完成：${resultText}`);
    if (scene.resourceSystem) lines.push(...scene.resourceSystem.getDebugLines());
    if (scene.statusSystem) lines.push(...scene.statusSystem.getDebugLines(4));
    if (scene.getCombatTelemetryLines) lines.push(...scene.getCombatTelemetryLines(4));
    if (scene.getCombatTelemetryExport) lines.push("遥测导出：window.exportCombatTelemetry()");
    if (scene.getDamagePathAuditLines) lines.push(...scene.getDamagePathAuditLines(3));
    if (scene.hitConfirmSystem) lines.push(...scene.hitConfirmSystem.getDebugLines(4));
    if (scene.activeAttackSystem) lines.push(...scene.activeAttackSystem.getDebugLines(4));
    if (scene.effectQueue) lines.push(...scene.effectQueue.getDebugLines(4));
    return lines;
  }
};
