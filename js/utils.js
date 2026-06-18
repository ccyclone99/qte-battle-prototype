const Utils = {
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },

  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  now() {
    return performance.now() / 1000;
  },

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  findNodeIndex(chain, nodeId) {
    return chain.nodes.findIndex(n => n.id === nodeId);
  },

  inputMatches(config, event, heldKeys) {
    if (!config || !event) return false;

    if (config.type === "press") {
      return event.type === "press" && event.key.toUpperCase() === config.key.toUpperCase();
    }

    if (config.type === "hold_release") {
      return event.type === "release" && event.key.toUpperCase() === config.key.toUpperCase();
    }

    if (config.type === "rhythm") {
      return event.type === "press" && event.key.toUpperCase() === config.key.toUpperCase();
    }

    return false;
  },

  formatTime(seconds) {
    return seconds.toFixed(2) + "s";
  }
};
