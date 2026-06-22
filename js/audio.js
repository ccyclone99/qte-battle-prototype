// 纯合成音效系统：零外部资源，延迟创建 AudioContext
const SFX = {
  ctx: null,
  enabled: false,
  masterVolume: 0.35,

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
    this.playNoise({ duration: 0.12, release: 0.08, volume: 0.9 });
    this.playTone({ type: "sawtooth", freq: 180, freqEnd: 80, duration: 0.12, attack: 0.005, release: 0.08, volume: 0.5 });
  },

  sfxSlash() {
    this.playNoise({ duration: 0.14, release: 0.08, volume: 0.6 });
    this.playTone({ type: "sawtooth", freq: 600, freqEnd: 200, duration: 0.14, attack: 0.005, release: 0.1, volume: 0.5 });
  },

  sfxGuard() {
    this.playNoise({ duration: 0.15, release: 0.12, volume: 0.5 });
    this.playTone({ type: "square", freq: 320, freqEnd: 320, duration: 0.12, attack: 0.005, release: 0.1, volume: 0.45 });
  },

  sfxMagic() {
    this.playTone({ type: "sine", freq: 440, freqEnd: 880, duration: 0.25, attack: 0.02, release: 0.18, volume: 0.55 });
    this.playTone({ type: "triangle", freq: 220, freqEnd: 660, duration: 0.3, attack: 0.02, release: 0.22, volume: 0.35 });
  },

  sfxPerfect() {
    this.playTone({ type: "sine", freq: 880, freqEnd: 1760, duration: 0.25, attack: 0.005, release: 0.18, volume: 0.7 });
    this.playTone({ type: "sine", freq: 1320, freqEnd: 2640, duration: 0.25, attack: 0.01, release: 0.18, volume: 0.4 });
  },

  sfxSuccess() {
    this.playTone({ type: "sine", freq: 660, freqEnd: 990, duration: 0.18, attack: 0.005, release: 0.12, volume: 0.6 });
  },

  sfxFail() {
    this.playTone({ type: "sawtooth", freq: 200, freqEnd: 100, duration: 0.3, attack: 0.01, release: 0.22, volume: 0.6 });
  },

  sfxWindup() {
    this.playTone({ type: "sine", freq: 120, freqEnd: 240, duration: 0.4, attack: 0.05, release: 0.15, volume: 0.35 });
  },

  sfxDodge() {
    this.playNoise({ duration: 0.1, release: 0.06, volume: 0.3 });
    this.playTone({ type: "sine", freq: 800, freqEnd: 1200, duration: 0.12, attack: 0.005, release: 0.08, volume: 0.35 });
  },

  sfxParry() {
    this.playNoise({ duration: 0.12, release: 0.08, volume: 0.5 });
    this.playTone({ type: "square", freq: 880, freqEnd: 440, duration: 0.15, attack: 0.005, release: 0.1, volume: 0.55 });
  },

  sfxCounter() {
    this.playNoise({ duration: 0.14, release: 0.08, volume: 0.6 });
    this.playTone({ type: "sawtooth", freq: 440, freqEnd: 880, duration: 0.18, attack: 0.005, release: 0.12, volume: 0.6 });
  },

  sfxCharge() {
    this.playTone({ type: "sine", freq: 220, freqEnd: 880, duration: 0.4, attack: 0.05, release: 0.15, volume: 0.4 });
  },

  sfxHeal() {
    this.playTone({ type: "sine", freq: 528, freqEnd: 792, duration: 0.25, attack: 0.02, release: 0.18, volume: 0.5 });
  },

  sfxStatus() {
    this.playTone({ type: "triangle", freq: 330, freqEnd: 660, duration: 0.18, attack: 0.01, release: 0.12, volume: 0.4 });
  },

  sfxAlert() {
    this.playTone({ type: "sawtooth", freq: 310, freqEnd: 310, duration: 0.2, attack: 0.01, release: 0.12, volume: 0.45 });
  }
};
