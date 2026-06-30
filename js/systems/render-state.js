const RenderStateHelpers = {
  getTurnMode(scene) {
    if (!scene || !scene.turnState) return "none";
    if (scene.turnState === "followup_turn") return "followup";
    if (scene.turnState === "player_turn") return "player";
    if (scene.turnState === "enemy_turn") return "enemy";
    if (scene.turnState === "qte_running") return "qte";
    if (scene.turnState === "attack_active") return "attack";
    if (scene.turnState === "resolving") return "resolving";
    if (scene.turnState === "game_over") return "game_over";
    if (scene.turnState.startsWith && scene.turnState.startsWith("select_")) return "select";
    return scene.turnState;
  },

  shouldShowPlayerStageLane(scene) {
    const mode = this.getTurnMode(scene);
    return mode === "player" || mode === "followup";
  },

  getGuardStance(scene) {
    if (!scene) return { active: false, ratio: 0, stability: 0, maxStability: 0 };
    if (scene.getGuardStanceView) return scene.getGuardStanceView();
    const guard = scene.guardStance || {};
    const max = guard.maxStability || 0;
    return {
      active: !!guard.active,
      ratio: max > 0 ? Math.max(0, Math.min(1, (guard.stability || 0) / max)) : 0,
      stability: Math.round(guard.stability || 0),
      maxStability: Math.round(max),
      lastResult: guard.lastResult || "none"
    };
  }
};
