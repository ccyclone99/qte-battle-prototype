// 纯合成音效系统：零外部资源，延迟创建 AudioContext
const SFX = {
  ctx: null,
  enabled: false,
  masterVolume: 0.30,

  enable() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    this.enabled = true;
  },

  _now() {
    return this.ctx ? this.ctx.currentTime : 0;
  },

  _masterGain() {
    const g = this.ctx.createGain();
    g.gain.value = this.masterVolume;
    g.connect(this.ctx.destination);
    return g;
  },

  playTone({ type = "sine", freq = 440, freqEnd = null, duration = 0.15, attack = 0.01, release = 0.12, volume = 1 } = {}) {
    if (!this.ctx || !this.enabled) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const master = this._masterGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t + duration);
    }

    const peak = Math.max(0.0001, volume);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, t + attack + release);

    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  },

  playNoise({ duration = 0.1, attack = 0.005, release = 0.08, volume = 1 } = {}) {
    if (!this.ctx || !this.enabled) return;
    const t = this._now();
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    const master = this._masterGain();
    const peak = Math.max(0.0001, volume);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, t + attack + release);
    noise.connect(gain).connect(master);
    noise.start(t);
  },

  // ===== 命名音效 =====
  sfxHit() {
    this.playNoise({ duration: 0.12, release: 0.08, volume: 0.72 });
    this.playTone({ type: "sawtooth", freq: 180, freqEnd: 80, duration: 0.12, attack: 0.005, release: 0.08, volume: 0.38 });
  },

  sfxSlash() {
    this.playNoise({ duration: 0.14, release: 0.08, volume: 0.48 });
    this.playTone({ type: "sawtooth", freq: 600, freqEnd: 200, duration: 0.14, attack: 0.005, release: 0.1, volume: 0.36 });
  },

  sfxGuard() {
    this.playNoise({ duration: 0.15, release: 0.12, volume: 0.42 });
    this.playTone({ type: "square", freq: 320, freqEnd: 320, duration: 0.12, attack: 0.005, release: 0.1, volume: 0.34 });
  },

  sfxClash() {
    this.playNoise({ duration: 0.09, release: 0.06, volume: 0.54 });
    this.playTone({ type: "square", freq: 520, freqEnd: 260, duration: 0.10, attack: 0.003, release: 0.06, volume: 0.42 });
    this.playTone({ type: "sine", freq: 920, freqEnd: 620, duration: 0.08, attack: 0.003, release: 0.05, volume: 0.18 });
  },

  sfxWhiff() {
    this.playNoise({ duration: 0.08, release: 0.05, volume: 0.22 });
    this.playTone({ type: "sawtooth", freq: 360, freqEnd: 180, duration: 0.11, attack: 0.005, release: 0.07, volume: 0.18 });
  },

  sfxGuardBreak() {
    this.playNoise({ duration: 0.16, release: 0.11, volume: 0.62 });
    this.playTone({ type: "sawtooth", freq: 180, freqEnd: 70, duration: 0.20, attack: 0.004, release: 0.12, volume: 0.45 });
    this.playTone({ type: "square", freq: 280, freqEnd: 120, duration: 0.14, attack: 0.004, release: 0.10, volume: 0.22 });
  },

  sfxFollowupOpen() {
    this.playTone({ type: "triangle", freq: 520, freqEnd: 780, duration: 0.13, attack: 0.006, release: 0.09, volume: 0.32 });
    this.playTone({ type: "sine", freq: 780, freqEnd: 1170, duration: 0.12, attack: 0.006, release: 0.08, volume: 0.22 });
  },

  sfxSpellInterrupt() {
    this.playTone({ type: "triangle", freq: 720, freqEnd: 360, duration: 0.16, attack: 0.005, release: 0.11, volume: 0.38 });
    this.playNoise({ duration: 0.10, release: 0.08, volume: 0.24 });
  },

  sfxMagic() {
    this.playTone({ type: "sine", freq: 440, freqEnd: 880, duration: 0.25, attack: 0.02, release: 0.18, volume: 0.44 });
    this.playTone({ type: "triangle", freq: 220, freqEnd: 660, duration: 0.3, attack: 0.02, release: 0.22, volume: 0.28 });
  },

  sfxPerfect() {
    this.playTone({ type: "sine", freq: 880, freqEnd: 1760, duration: 0.25, attack: 0.005, release: 0.18, volume: 0.56 });
    this.playTone({ type: "sine", freq: 1320, freqEnd: 2640, duration: 0.25, attack: 0.01, release: 0.18, volume: 0.3 });
  },

  sfxSuccess() {
    this.playTone({ type: "sine", freq: 660, freqEnd: 990, duration: 0.18, attack: 0.005, release: 0.12, volume: 0.44 });
  },

  sfxFail() {
    this.playTone({ type: "sawtooth", freq: 200, freqEnd: 100, duration: 0.26, attack: 0.01, release: 0.18, volume: 0.42 });
  },

  sfxWindup() {
    this.playTone({ type: "sine", freq: 120, freqEnd: 240, duration: 0.34, attack: 0.05, release: 0.13, volume: 0.25 });
  },

  sfxDodge() {
    this.playNoise({ duration: 0.1, release: 0.06, volume: 0.3 });
    this.playTone({ type: "sine", freq: 800, freqEnd: 1200, duration: 0.12, attack: 0.005, release: 0.08, volume: 0.35 });
  },

  sfxParry() {
    this.playNoise({ duration: 0.12, release: 0.08, volume: 0.42 });
    this.playTone({ type: "square", freq: 880, freqEnd: 440, duration: 0.15, attack: 0.005, release: 0.1, volume: 0.42 });
  },

  sfxCounter() {
    this.playNoise({ duration: 0.14, release: 0.08, volume: 0.48 });
    this.playTone({ type: "sawtooth", freq: 440, freqEnd: 880, duration: 0.18, attack: 0.005, release: 0.12, volume: 0.44 });
  },

  sfxCharge() {
    this.playTone({ type: "sine", freq: 220, freqEnd: 880, duration: 0.34, attack: 0.05, release: 0.13, volume: 0.3 });
  },

  sfxChargePeak() {
    this.playTone({ type: "sine", freq: 440, freqEnd: 1320, duration: 0.22, attack: 0.01, release: 0.12, volume: 0.42 });
    this.playTone({ type: "triangle", freq: 880, freqEnd: 1760, duration: 0.2, attack: 0.01, release: 0.1, volume: 0.24 });
  },

  sfxResourceGain() {
    this.playTone({ type: "triangle", freq: 392, freqEnd: 784, duration: 0.18, attack: 0.01, release: 0.12, volume: 0.34 });
    this.playTone({ type: "sine", freq: 523, freqEnd: 1046, duration: 0.16, attack: 0.01, release: 0.1, volume: 0.22 });
  },

  sfxResourceSpend() {
    this.playTone({ type: "sine", freq: 520, freqEnd: 260, duration: 0.2, attack: 0.01, release: 0.13, volume: 0.28 });
  },

  sfxHeal() {
    this.playTone({ type: "sine", freq: 528, freqEnd: 792, duration: 0.25, attack: 0.02, release: 0.18, volume: 0.5 });
  },

  sfxStatus() {
    this.playTone({ type: "triangle", freq: 330, freqEnd: 660, duration: 0.16, attack: 0.01, release: 0.1, volume: 0.28 });
  },

  sfxBurn() {
    this.playNoise({ duration: 0.12, release: 0.1, volume: 0.22 });
    this.playTone({ type: "sawtooth", freq: 260, freqEnd: 520, duration: 0.16, attack: 0.01, release: 0.1, volume: 0.28 });
  },

  sfxOverload() {
    this.playTone({ type: "sawtooth", freq: 160, freqEnd: 90, duration: 0.26, attack: 0.01, release: 0.18, volume: 0.34 });
    this.playTone({ type: "square", freq: 440, freqEnd: 220, duration: 0.2, attack: 0.01, release: 0.12, volume: 0.16 });
  },

  sfxAlert() {
    this.playTone({ type: "sawtooth", freq: 310, freqEnd: 310, duration: 0.16, attack: 0.01, release: 0.1, volume: 0.28 });
  },

  sfxWindowOpen() {
    this.playTone({ type: "square", freq: 740, freqEnd: 740, duration: 0.07, attack: 0.005, release: 0.05, volume: 0.24 });
    this.playTone({ type: "sine", freq: 980, freqEnd: 1280, duration: 0.1, attack: 0.005, release: 0.07, volume: 0.2 });
  },

  sfxThreat() {
    this.playTone({ type: "sawtooth", freq: 180, freqEnd: 260, duration: 0.16, attack: 0.01, release: 0.1, volume: 0.26 });
  },

  sfxShowcase() {
    this.playTone({ type: "sine", freq: 523, freqEnd: 784, duration: 0.14, attack: 0.01, release: 0.09, volume: 0.24 });
    this.playTone({ type: "sine", freq: 784, freqEnd: 1175, duration: 0.18, attack: 0.02, release: 0.1, volume: 0.18 });
  },

  sfxTransition(transition) {
    if (!transition) return;
    const eventName = String(transition.visualEvent || transition.effect || "").toLowerCase();
    if (eventName.includes("peak") || eventName.includes("charge") || eventName.includes("compress")) {
      this.sfxChargePeak();
      return;
    }
    if (eventName.includes("burst") || eventName.includes("earthsplit") || eventName.includes("big")) {
      this.sfxHit();
      return;
    }
    if (eventName.includes("guard") || eventName.includes("shield") || eventName.includes("parry")) {
      this.sfxGuard();
      return;
    }
    if (eventName.includes("fire")) {
      this.sfxMagic();
      return;
    }
    if (eventName.includes("absorb") || eventName.includes("mirror") || eventName.includes("overflow")) {
      this.sfxMagic();
      return;
    }
    if (transition.damage > 0) {
      this.sfxHit();
    }
  }
};
