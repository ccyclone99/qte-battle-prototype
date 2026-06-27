#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(root, "tmp", "visual-smoke", stamp);
const artifacts = [];

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function httpText(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`${url} -> ${res.statusCode}: ${data.slice(0, 160)}`));
          return;
        }
        resolve(data);
      });
    });
    req.on("error", reject);
  });
}

async function waitForHttp(url, timeoutMs = 10000) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeoutMs) {
    try {
      return await httpText(url);
    } catch (err) {
      lastError = err;
      await wait(120);
    }
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

async function httpJson(url) {
  return JSON.parse(await httpText(url));
}

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge"
  ].filter(Boolean);
  return candidates.find(file => fs.existsSync(file));
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.buffer = Buffer.alloc(0);
    socket.on("data", chunk => this.onData(chunk));
    socket.on("error", err => {
      for (const { reject } of this.pending.values()) reject(err);
      this.pending.clear();
    });
  }

  static connect(wsUrl) {
    return new Promise((resolve, reject) => {
      const url = new URL(wsUrl);
      const socket = net.connect(Number(url.port), url.hostname);
      const key = crypto.randomBytes(16).toString("base64");
      let handshake = Buffer.alloc(0);

      const onData = chunk => {
        handshake = Buffer.concat([handshake, chunk]);
        const idx = handshake.indexOf("\r\n\r\n");
        if (idx < 0) return;
        const header = handshake.slice(0, idx).toString("utf8");
        if (!header.includes(" 101 ")) {
          reject(new Error(`WebSocket handshake failed: ${header.split("\r\n")[0]}`));
          socket.destroy();
          return;
        }
        socket.off("data", onData);
        const client = new CdpClient(socket);
        const rest = handshake.slice(idx + 4);
        if (rest.length > 0) client.onData(rest);
        resolve(client);
      };

      socket.once("error", reject);
      socket.once("connect", () => {
        const request = [
          `GET ${url.pathname}${url.search} HTTP/1.1`,
          `Host: ${url.host}`,
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Key: ${key}`,
          "Sec-WebSocket-Version: 13",
          "",
          ""
        ].join("\r\n");
        socket.write(request);
      });
      socket.on("data", onData);
    });
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      const opcode = first & 0x0f;
      const masked = (second & 0x80) !== 0;
      let length = second & 0x7f;
      let offset = 2;

      if (length === 126) {
        if (this.buffer.length < offset + 2) return;
        length = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (length === 127) {
        if (this.buffer.length < offset + 8) return;
        length = Number(this.buffer.readBigUInt64BE(offset));
        offset += 8;
      }

      const maskOffset = offset;
      if (masked) offset += 4;
      if (this.buffer.length < offset + length) return;

      let payload = this.buffer.slice(offset, offset + length);
      if (masked) {
        const mask = this.buffer.slice(maskOffset, maskOffset + 4);
        payload = Buffer.from(payload.map((byte, idx) => byte ^ mask[idx % 4]));
      }
      this.buffer = this.buffer.slice(offset + length);

      if (opcode === 1) this.handleMessage(payload.toString("utf8"));
      if (opcode === 8) this.socket.end();
      if (opcode === 9) this.sendFrame(payload, 10);
    }
  }

  handleMessage(text) {
    let msg;
    try {
      msg = JSON.parse(text);
    } catch (err) {
      this.events.push({ method: "invalid-json", params: { text } });
      return;
    }

    if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message}: ${msg.error.data || ""}`));
      else resolve(msg.result || {});
      return;
    }

    this.events.push(msg);
  }

  sendFrame(payload, opcode = 1) {
    const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    let headerLength = 2;
    if (data.length >= 126 && data.length <= 65535) headerLength += 2;
    else if (data.length > 65535) headerLength += 8;

    const mask = crypto.randomBytes(4);
    const frame = Buffer.alloc(headerLength + 4 + data.length);
    frame[0] = 0x80 | opcode;
    let offset = 2;
    if (data.length < 126) {
      frame[1] = 0x80 | data.length;
    } else if (data.length <= 65535) {
      frame[1] = 0x80 | 126;
      frame.writeUInt16BE(data.length, offset);
      offset += 2;
    } else {
      frame[1] = 0x80 | 127;
      frame.writeBigUInt64BE(BigInt(data.length), offset);
      offset += 8;
    }
    mask.copy(frame, offset);
    offset += 4;
    for (let i = 0; i < data.length; i++) frame[offset + i] = data[i] ^ mask[i % 4];
    this.socket.write(frame);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const message = JSON.stringify({ id, method, params });
    this.sendFrame(message);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 15000);
    });
  }

  close() {
    this.socket.end();
  }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  });
  if (result.exceptionDetails) {
    throw new Error(`Evaluation failed: ${result.exceptionDetails.text || JSON.stringify(result.exceptionDetails)}`);
  }
  return result.result ? result.result.value : undefined;
}

async function pressKey(cdp, key) {
  const serialized = JSON.stringify(key);
  await evaluate(cdp, `window.dispatchEvent(new KeyboardEvent("keydown", { key: ${serialized}, bubbles: true, cancelable: true }))`);
  await wait(80);
  await evaluate(cdp, `window.dispatchEvent(new KeyboardEvent("keyup", { key: ${serialized}, bubbles: true, cancelable: true }))`);
  await wait(140);
}

async function clickId(cdp, id) {
  await evaluate(cdp, `(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) throw new Error("missing #${id}"); el.click(); })()`);
  await wait(160);
}

async function clickVirtualKey(cdp, key) {
  const serialized = JSON.stringify(String(key).toUpperCase());
  await evaluate(cdp, `(() => {
    const key = ${serialized};
    const el = document.querySelector('#touch-controls button[data-key="' + key + '"]');
    if (!el) throw new Error("missing virtual key " + key);
    el.click();
  })()`);
  await wait(180);
}

async function closeTutorial(cdp) {
  await evaluate(cdp, `(() => {
    const overlay = document.getElementById("tutorial-overlay");
    const btn = document.getElementById("btn-tutorial-ok");
    if (overlay && btn && overlay.style.display !== "none") btn.click();
  })()`);
  await wait(160);
}

async function waitReady(cdp) {
  for (let i = 0; i < 80; i++) {
    const ready = await evaluate(cdp, "document.readyState");
    if (ready === "complete") return;
    await wait(100);
  }
  throw new Error("Page did not finish loading");
}

async function waitForEvaluate(cdp, expression, timeoutMs = 6000, label = expression) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(cdp, expression)) return;
    await wait(120);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function pageErrorEvents(cdp) {
  return cdp.events.filter(event => {
    if (event.method === "Runtime.exceptionThrown") return true;
    if (event.method === "Log.entryAdded" && event.params && event.params.entry && event.params.entry.level === "error") {
      const text = event.params.entry.text || "";
      if (text.includes("favicon.ico")) return false;
      if (text.includes("Failed to load resource") && text.includes("404")) return false;
      return true;
    }
    if (event.method === "Runtime.consoleAPICalled" && event.params && event.params.type === "error") return true;
    return false;
  });
}

async function captureScenario(cdp, name, checks = []) {
  const canvasStats = await evaluate(cdp, `(() => {
    const canvas = document.getElementById("game-canvas");
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    let bright = 0;
    let samples = 0;
    const colors = new Set();
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 16; x++) {
        const px = Math.floor((x + 0.5) * w / 16);
        const py = Math.floor((y + 0.5) * h / 9);
        const data = ctx.getImageData(px, py, 1, 1).data;
        const key = [data[0] >> 4, data[1] >> 4, data[2] >> 4].join(",");
        colors.add(key);
        if (data[0] + data[1] + data[2] > 48) bright++;
        samples++;
      }
    }
    const container = document.getElementById("game-container").getBoundingClientRect();
    return {
      canvasWidth: w,
      canvasHeight: h,
      bright,
      samples,
      uniqueColors: colors.size,
      container: { left: container.left, top: container.top, width: container.width, height: container.height },
      viewport: { width: innerWidth, height: innerHeight }
    };
  })()`);

  if (canvasStats.uniqueColors < 2 || canvasStats.bright < 8) {
    throw new Error(`${name}: canvas appears blank (${JSON.stringify(canvasStats)})`);
  }

  for (const check of checks) {
    if (!check.ok) throw new Error(`${name}: ${check.label}`);
  }

  const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const file = path.join(outDir, `${String(artifacts.length + 1).padStart(2, "0")}-${name}.png`);
  fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  const stat = fs.statSync(file);
  if (stat.size < 5000) throw new Error(`${name}: screenshot too small (${stat.size} bytes)`);

  artifacts.push({
    name,
    file: path.relative(root, file),
    bytes: stat.size,
    canvasStats,
    checks: checks.map(check => check.label)
  });
}

async function navigate(cdp, appUrl, viewport) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: !!viewport.mobile
  });
  await cdp.send("Page.navigate", { url: appUrl });
  await waitReady(cdp);
  await wait(260);
}

async function runVisualSmoke() {
  fs.mkdirSync(outDir, { recursive: true });

  const appPort = await getFreePort();
  const cdpPort = await getFreePort();
  const appUrl = `http://127.0.0.1:${appPort}/`;
  const browserPath = findBrowserExecutable();
  if (!browserPath) throw new Error("Could not find Chrome or Edge. Set CHROME_PATH or EDGE_PATH.");

  const server = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: { ...process.env, PORT: String(appPort) },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const userDataDir = path.join(outDir, "chrome-profile");
  const browser = spawn(browserPath, [
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-component-extensions-with-background-pages",
    "--disable-background-networking",
    "--hide-scrollbars",
    "--mute-audio",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${cdpPort}`,
    "about:blank"
  ], { stdio: ["ignore", "ignore", "pipe"] });

  let cdp = null;
  try {
    await waitForHttp(appUrl, 10000);
    await waitForHttp(`http://127.0.0.1:${cdpPort}/json/version`, 10000);
    const pages = await httpJson(`http://127.0.0.1:${cdpPort}/json/list`);
    const page = pages.find(item => item.type === "page") || pages[0];
    if (!page || !page.webSocketDebuggerUrl) throw new Error("No CDP page target found");

    cdp = await CdpClient.connect(page.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");

    const desktop = { width: 1280, height: 720 };
    const mobileLandscape = { width: 896, height: 414, mobile: true };

    await navigate(cdp, appUrl, desktop);
    await captureScenario(cdp, "main-menu-desktop", [
      { label: "main menu visible", ok: await evaluate(cdp, `document.getElementById("main-menu").style.display !== "none"`) },
      { label: "style 8 visible in menu grid", ok: await evaluate(cdp, `(() => {
        const btn = document.querySelector('#style-choice-grid button[data-style-id="counterflow"]');
        if (!btn) return false;
        const rect = btn.getBoundingClientRect();
        const style = getComputedStyle(btn);
        return btn.textContent.includes("023") && btn.textContent.includes("逆势双刃") && btn.textContent.includes("风格 8") && btn.dataset.styleKey === "8" && rect.width > 40 && rect.height > 20 && style.display !== "none" && style.visibility !== "hidden";
      })()`) },
      { label: "style 008 visible in menu grid", ok: await evaluate(cdp, `(() => {
        const btn = document.querySelector('#style-choice-grid button[data-style-id="eastern"]');
        if (!btn) return false;
        const rect = btn.getBoundingClientRect();
        const style = getComputedStyle(btn);
        return btn.textContent.includes("008") && btn.textContent.includes("东方诸国剑术") && btn.textContent.includes("风格 4") && btn.dataset.styleKey === "4" && rect.width > 40 && rect.height > 20 && style.display !== "none" && style.visibility !== "hidden";
      })()`) },
      { label: "native style select labels style 8", ok: await evaluate(cdp, `(() => {
        const select = document.getElementById("style-select");
        if (!select) return false;
        const text = Array.from(select.options).map(option => option.textContent).join("\\n");
        return text.includes("风格 8 · 023 · 逆势双刃") && text.includes("风格 4 · 008 · 东方诸国剑术");
      })()`) },
      { label: "encounter select visible", ok: await evaluate(cdp, `document.body.textContent.includes("自动推荐") && document.body.textContent.includes("熔炉守门人")`) }
    ]);

    await navigate(cdp, appUrl, desktop);
    await clickId(cdp, "btn-demo");
    await closeTutorial(cdp);
    await captureScenario(cdp, "demo-menu-showcase", [
      { label: "showcase category visible", ok: await evaluate(cdp, `document.body.textContent.includes("亮点演示")`) },
      { label: "demo detail visible", ok: await evaluate(cdp, `!document.getElementById("demo-detail-drawer").classList.contains("hidden")`) },
      { label: "demo stage avoids detail drawer", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || !r.getDemoStageBounds) return false;
        const stage = r.getDemoStageBounds();
        if (stage.compact) return true;
        const drawer = document.getElementById("demo-detail-drawer").getBoundingClientRect();
        const canvas = document.getElementById("game-canvas").getBoundingClientRect();
        const scaleX = canvas.width / 960;
        const stageRight = canvas.left + (stage.x + stage.w) * scaleX;
        return stageRight <= drawer.left - 8;
      })()`) }
    ]);

    await navigate(cdp, appUrl, desktop);
    await clickId(cdp, "btn-demo");
    await closeTutorial(cdp);
    await pressKey(cdp, "1");
    await pressKey(cdp, "1");
    await wait(900);
    await captureScenario(cdp, "showcase-fire-branch", [
      { label: "fire showcase active", ok: await evaluate(cdp, `document.body.textContent.includes("Showcase · 火球三分支对比")`) },
      { label: "showcase phase detail active", ok: await evaluate(cdp, `document.body.textContent.includes("当前演示")`) }
    ]);

    await navigate(cdp, appUrl, desktop);
    await clickId(cdp, "btn-demo");
    await closeTutorial(cdp);
    await pressKey(cdp, "1");
    await pressKey(cdp, "4");
    await wait(900);
    await captureScenario(cdp, "showcase-enemy-readout", [
      { label: "enemy threat visible", ok: await evaluate(cdp, `document.body.textContent.includes("类型/危险")`) },
      { label: "enemy recommendation visible", ok: await evaluate(cdp, `document.body.textContent.includes("推荐应对")`) },
      { label: "enemy window visible", ok: await evaluate(cdp, `document.body.textContent.includes("窗口状态")`) }
    ]);

    await navigate(cdp, appUrl, desktop);
    await clickId(cdp, "btn-start");
    await closeTutorial(cdp);
    await pressKey(cdp, "6");
    await wait(240);
    await pressKey(cdp, "A");
    await wait(320);
    await captureScenario(cdp, "battle-style6-qte", [
      { label: "battle entered qte", ok: await evaluate(cdp, `document.getElementById("turn-indicator").textContent.includes("QTE")`) },
      { label: "style 6 encounter visible", ok: await evaluate(cdp, `document.body.textContent.includes("熔炉守门人")`) },
      { label: "style 6 forge stage theme", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        return !!(r && typeof battle !== "undefined" && r.getEncounterStageTheme(battle).key === "forge");
      })()`) },
      { label: "difficulty badge visible", ok: await evaluate(cdp, `document.getElementById("difficulty-badge").textContent.length > 0`) },
      { label: "qte readability metrics active", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getQTEReadabilityMetrics) return false;
        const m = r.getQTEReadabilityMetrics(battle);
        return !!(m && m.stageTitle && m.chainName && m.windowEndRatio > m.windowStartRatio && m.timeLeft >= 0 && m.stateLabel);
      })()`) },
      { label: "combat phase lighting qte active", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getCombatPhaseLighting) return false;
        const light = r.getCombatPhaseLighting(battle);
        return !!(light && light.active && light.mode === "qte" && light.playerHot && light.centerHot && light.intensity >= 0.4);
      })()`) },
      { label: "battle qte suppresses stale overlays", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        const scene = typeof battle !== "undefined" ? battle : null;
        return !!(r && scene && !r.shouldDrawFloatingMessage(scene) && !r.shouldDrawTurnBanner(scene));
      })()`) }
    ]);

    await navigate(cdp, appUrl, desktop);
    await clickId(cdp, "btn-start");
    await closeTutorial(cdp);
    await clickId(cdp, "touch-toggle");
    await wait(120);
    await clickVirtualKey(cdp, "6");
    await wait(320);
    await clickVirtualKey(cdp, "A");
    await wait(420);
    await captureScenario(cdp, "battle-virtual-controls-qte", [
      { label: "virtual controls visible", ok: await evaluate(cdp, `!document.getElementById("touch-controls").classList.contains("hidden") && document.getElementById("touch-controls").getAttribute("aria-hidden") === "false"`) },
      { label: "virtual controls avoid qte bar", ok: await evaluate(cdp, `document.getElementById("touch-controls").getBoundingClientRect().bottom < 590`) },
      { label: "virtual style 6 entered qte", ok: await evaluate(cdp, `document.getElementById("turn-indicator").textContent.includes("QTE")`) },
      { label: "virtual style encounter visible", ok: await evaluate(cdp, `document.body.textContent.includes("熔炉守门人")`) }
    ]);

    await navigate(cdp, appUrl, desktop);
    await clickId(cdp, "btn-start");
    await closeTutorial(cdp);
    await pressKey(cdp, "7");
    await wait(240);
    await pressKey(cdp, "S");
    await wait(320);
    await captureScenario(cdp, "battle-style7-qte", [
      { label: "battle style 7 entered qte", ok: await evaluate(cdp, `document.getElementById("turn-indicator").textContent.includes("QTE")`) },
      { label: "style 7 encounter visible", ok: await evaluate(cdp, `document.body.textContent.includes("秘术回廊")`) },
      { label: "style 7 arcane stage theme", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        return !!(r && typeof battle !== "undefined" && r.getEncounterStageTheme(battle).key === "arcane");
      })()`) },
      { label: "style 7 mirror text visible", ok: await evaluate(cdp, `document.body.textContent.includes("镜") || document.body.textContent.includes("咒还")`) }
    ]);

    await navigate(cdp, appUrl, desktop);
    await clickId(cdp, "btn-start");
    await closeTutorial(cdp);
    await pressKey(cdp, "6");
    await wait(240);
    await evaluate(cdp, `(() => {
      if (typeof battle === "undefined") throw new Error("battle missing");
      battle.activeAttackSystem.clear();
      battle.playerHp = 38;
      battle.enemyHp = Math.max(1, Math.floor(battle.enemyMaxHp * 0.30));
      battle.activeEncounterPhaseId = "molten_core";
      battle.resourceSystem.add("heat", 88);
      battle.statusSystem.apply({ target: "enemy", type: "burn", turns: 2 }, { source: "visual-smoke" });
      battle.statusSystem.apply({ target: "enemy", type: "armorBreak", turns: 2 }, { source: "visual-smoke" });
      battle.armorBreakActive = true;
      battle.armorBreakTurns = 2;
      battle.enemyStunTimer = 0.9;
      const attack = battle.commitActiveAttack({
        kind: "playerQTE",
        source: "player",
        target: "enemy",
        attackType: "melee",
        chainFamily: "fire",
        weapon: "greatsword",
        visualEvent: "flameBladeBurst",
        motion: "flameBladeBurst",
        color: "#e67e22",
        damage: 1,
        timeline: { startup: 0.10, travel: 1.10, impactTime: 1.20, reactionStart: 0.70, reactionDuration: 0.28, recovery: 1.20 },
        damageIntent: { source: "player", target: "enemy", damage: 1, token: "visual-fire", label: "visual-fire", shape: "arc" }
      });
      attack.elapsed = 0.86;
      battle.activeAttackSystem.updateAttackState(attack);
      attack.paused = true;
      battle.hitConfirmSystem.confirm({
        source: "player",
        target: "enemy",
        damage: 0,
        token: "visual-contact-layer",
        label: "visual-contact-layer",
        shape: "arc",
        weapon: "greatsword",
        color: "#f1c40f",
        debugLife: 1.4
      });
      battle.triggerActorReaction("enemy", "crit", 1.25, {
        color: "#f1c40f",
        direction: 1,
        distance: 44,
        lift: 8,
        duration: 0.80
      });
      battle.screenShake = 0.8;
      battle.cameraZoom = 1.06;
      battle.cameraZoomTimer = 1.2;
      battle.turnBanner = null;
      battle.flashMessage = null;
      battle.messageTimer = 0;
    })()`);
    await wait(220);
    await captureScenario(cdp, "battle-player-active-attack", [
      { label: "active attack turn label visible", ok: await evaluate(cdp, `document.getElementById("turn-indicator").textContent.includes("攻击演出")`) },
      { label: "player active attack exists", ok: await evaluate(cdp, `typeof battle !== "undefined" && battle.activeAttackSystem.active.some(a => a.source === "player")`) },
      { label: "player attack cinematic focus", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        const f = r && typeof battle !== "undefined" ? r.getCinematicFocus(battle) : null;
        return !!(f && f.kind === "activeAttack" && f.source === "player" && f.intensity > 0.4);
      })()`) },
      { label: "stage-only camera impulse active", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getRenderCamera) return false;
        const camera = r.getRenderCamera(battle, 1.37);
        return !!(camera && camera.uiStable && camera.active && camera.shake > 0.1 && camera.zoom > 1.01 && Math.abs(camera.dx) + Math.abs(camera.dy) > 0.1);
      })()`) },
      { label: "player actor performance pose", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getActorPerformance) return false;
        const p = r.getActorPerformance(battle, "player", battle.actorReactions.get("player"), r.getCurrentPose(battle));
        return !!(p && p.attack > 0.45 && p.armReach > 16 && p.afterimageAlpha > 0.08);
      })()`) },
      { label: "player fire attack descriptor", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        const a = battle.activeAttackSystem.active.find(item => item.source === "player");
        const d = r && a ? r.getPlayerActiveAttackDescriptor(a) : null;
        return !!(d && d.isFire && d.isGreatsword);
      })()`) },
      { label: "active attack contact guide anchored", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        const a = typeof battle !== "undefined" ? battle.activeAttackSystem.active.find(item => item.source === "player") : null;
        if (!r || !a || !r.getActiveAttackContactGuide || !r.getBattleAnchor) return false;
        const from = r.getBattleAnchor(a.intent.fromAnchor || a.intent.anchor || (a.source === "enemy" ? "enemyCore" : "playerHand"));
        const to = r.getBattleAnchor(a.intent.toAnchor || (a.target === "player" ? "playerCore" : "enemyCore"));
        const pos = a.position || { x: from.x + (to.x - from.x) * (a.progress || 0), y: from.y + (to.y - from.y) * (a.progress || 0) };
        const descriptor = r.getPlayerActiveAttackDescriptor(a);
        const guide = r.getActiveAttackContactGuide(a, from, to, pos, a.profile.color, a.progress, descriptor);
        return !!(guide && guide.active && guide.isMelee && guide.source === "player" && guide.target === "enemy" && guide.hand.x < guide.contact.x && guide.contact.x > to.x - 90 && guide.radius >= 44);
      })()`) },
      { label: "contact impact events active", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getCombatContactEvents) return false;
        const events = r.getCombatContactEvents(battle);
        return events.some(item => item.confirmed && item.target === "enemy" && item.impact && item.ground && item.radius > 20 && item.ground.y > item.body.y);
      })()`) },
      { label: "actor damage visuals active", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getActorDamageVisuals) return false;
        const player = r.getActorDamageVisuals(battle, "player");
        const enemy = r.getActorDamageVisuals(battle, "enemy");
        return !!(player && enemy && player.wounded > 0.5 && !player.defeated && enemy.critical && enemy.tier >= 3);
      })()`) },
      { label: "actor impact reaction visuals active", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getActorImpactReactionVisuals || !r.getActorPerformance) return false;
        const reaction = battle.actorReactions.get("enemy");
        const impact = r.getActorImpactReactionVisuals(battle, "enemy", reaction, r.getActorPerformance(battle, "enemy", reaction));
        return !!(impact && impact.active && impact.type === "crit" && impact.critical && impact.direction === 1 && impact.radius >= 50 && impact.alpha > 0.2);
      })()`) },
      { label: "player model profile reads fire greatsword", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getPlayerModelProfile) return false;
        const p = r.getPlayerModelProfile(battle);
        return !!(p && p.weaponId === "greatsword" && p.armor === "heavy" && p.hasFire);
      })()`) },
      { label: "greatsword player rig silhouette", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getPlayerRigProfile) return false;
        const rig = r.getPlayerRigProfile(r.getPlayerModelProfile(battle));
        return !!(rig && rig.silhouette === "vanguard-plate" && rig.torsoW >= 50 && rig.shadowScale > 1.05 && rig.legWidth >= 10);
      })()`) },
      { label: "enemy encounter phase visuals active", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getEnemyEncounterPhaseVisuals) return false;
        const phase = r.getEnemyEncounterPhaseVisuals(battle);
        return !!(phase && phase.active && phase.key === "forge" && phase.phaseName === "熔心压迫" && phase.intensity > 0.6);
      })()`) },
      { label: "enemy phase nameplate uses phase name", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getEncounterPhaseLabel) return false;
        return r.getEncounterPhaseLabel(battle, battle.enemyConfig) === "熔心压迫";
      })()`) },
      { label: "enemy model profile reads armored gear", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getEnemyModelProfile) return false;
        const p = r.getEnemyModelProfile(battle.enemyConfig);
        return !!(p && p.modelType === "armored" && p.gear === "greatsword" && p.armor === "plate");
      })()`) },
      { label: "armored enemy rig silhouette", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getEnemyRigProfile) return false;
        const rig = r.getEnemyRigProfile(r.getEnemyModelProfile(battle.enemyConfig));
        return !!(rig && rig.silhouette === "heavy-plate" && rig.torsoW >= 72 && rig.shadowScale > 1.1 && rig.armWidth >= 10);
      })()`) },
      { label: "actor status visuals active", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || !r.getActorStatusVisuals) return false;
        const enemy = r.getActorStatusVisuals(battle, "enemy");
        const player = r.getActorStatusVisuals(battle, "player");
        return enemy.burn && enemy.armorBreak && enemy.stun && player.heatRatio > 0.7;
      })()`) }
    ]);

    await navigate(cdp, appUrl, desktop);
    await clickId(cdp, "btn-start");
    await closeTutorial(cdp);
    await pressKey(cdp, "7");
    await wait(240);
    await evaluate(cdp, `(() => {
      if (typeof battle === "undefined") throw new Error("battle missing");
      battle.activeAttackSystem.clear();
      battle.resourceSystem.add("spellEnergy", 140);
      battle.playerState.absorbReady = true;
      battle.playerState.shieldEnchanted = true;
      battle.statusSystem.apply({ target: "player", type: "absorbReady", turns: 1 }, { source: "visual-smoke" });
      battle.statusSystem.apply({ target: "player", type: "shieldEnchant", turns: 1 }, { source: "visual-smoke" });
      battle.statusSystem.apply({ target: "player", type: "overload", turns: 1 }, { source: "visual-smoke" });
      const attack = battle.commitActiveAttack({
        kind: "playerQTE",
        source: "player",
        target: "enemy",
        attackType: "beam",
        chainFamily: "absorb",
        weapon: "dualBlades",
        visualEvent: "absorbSiphon",
        motion: "absorbRelease",
        color: "#9b59b6",
        damage: 1,
        timeline: { startup: 0.10, travel: 0.95, impactTime: 1.05, reactionStart: 0.70, reactionDuration: 0.24, recovery: 1.10 },
        damageIntent: { source: "player", target: "enemy", damage: 1, token: "visual-absorb", label: "visual-absorb", shape: "beam" }
      });
      attack.elapsed = 0.74;
      battle.activeAttackSystem.updateAttackState(attack);
      attack.paused = true;
      battle.turnBanner = null;
      battle.flashMessage = null;
      battle.messageTimer = 0;
    })()`);
    await wait(220);
    await captureScenario(cdp, "battle-player-spell-active", [
      { label: "spell active attack turn label visible", ok: await evaluate(cdp, `document.getElementById("turn-indicator").textContent.includes("攻击演出")`) },
      { label: "player spell active attack exists", ok: await evaluate(cdp, `typeof battle !== "undefined" && battle.activeAttackSystem.active.some(a => a.source === "player" && a.profile.type === "beam")`) },
      { label: "player absorb descriptor", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        const a = battle.activeAttackSystem.active.find(item => item.source === "player");
        const d = r && a ? r.getPlayerActiveAttackDescriptor(a) : null;
        return !!(d && d.isAbsorb);
      })()`) },
      { label: "player status visuals active", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || !r.getActorStatusVisuals) return false;
        const player = r.getActorStatusVisuals(battle, "player");
        return player.spellRatio > 0.9 && player.absorbReady && player.shieldEnchant && player.overload;
      })()`) },
      { label: "dual blades player rig silhouette", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getPlayerRigProfile) return false;
        const rig = r.getPlayerRigProfile(r.getPlayerModelProfile(battle));
        return !!(rig && rig.silhouette === "agile-duelist" && rig.scaleX < 1 && rig.stance > 1.15 && rig.armWidth <= 6);
      })()`) }
    ]);

    await navigate(cdp, appUrl, desktop);
    await clickId(cdp, "btn-start");
    await closeTutorial(cdp);
    await pressKey(cdp, "8");
    await wait(240);
    await evaluate(cdp, `(() => {
      if (typeof battle === "undefined") throw new Error("battle missing");
      battle.setTurnState("enemy_turn");
      battle.enemyAttack = battle.buildEnemyAttack("curseBurst");
      battle.enemyAttackTimer = Math.max(0.2, battle.enemyAttack.windup * 0.72);
      battle.enemyAttackPhase = "response";
      battle.activeAttackSystem.active = [];
      battle.setMessage("敌方预警检查：咒爆");
      battle.messageTimer = 0;
      battle.turnBanner = null;
      battle.flashMessage = null;
    })()`);
    await wait(320);
    await captureScenario(cdp, "battle-enemy-telegraph", [
      { label: "enemy telegraph turn active", ok: await evaluate(cdp, `typeof battle !== "undefined" && battle.turnState === "enemy_turn"`) },
      { label: "enemy telegraph attack active", ok: await evaluate(cdp, `battle.enemyAttack && battle.enemyAttack.id === "curseBurst" && battle.enemyAttackPhase === "response"`) },
      { label: "style 8 dojo stage theme", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        return !!(r && typeof battle !== "undefined" && r.getEncounterStageTheme(battle).key === "dojo");
      })()`) },
      { label: "style 8 player counter rig", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getPlayerRigProfile) return false;
        const rig = r.getPlayerRigProfile(r.getPlayerModelProfile(battle));
        return !!(rig && rig.silhouette === "counter-duelist" && rig.stance > 1.25 && rig.scaleX < 0.95 && rig.shadowScale < 1);
      })()`) },
      { label: "enemy response cinematic focus", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        const f = r && typeof battle !== "undefined" ? r.getCinematicFocus(battle) : null;
        return !!(f && f.kind === "enemyResponse" && f.phase === "response" && f.intensity > 0.5);
      })()`) },
      { label: "enemy actor performance pose", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getActorPerformance) return false;
        const p = r.getActorPerformance(battle, "enemy", battle.actorReactions.get("enemy"));
        return !!(p && p.enemyPose === "cast" && p.poseIntensity > 0.6 && p.armReach > 20);
      })()`) },
      { label: "player defense intent visuals active", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getPlayerDefenseIntentVisuals || !r.getActorStatusVisuals) return false;
        const visuals = r.getPlayerDefenseIntentVisuals(battle, r.getActorStatusVisuals(battle, "player"));
        return !!(visuals && visuals.active && visuals.inResponse && visuals.parry && visuals.guard && visuals.spellLike && visuals.type === "burst" && visuals.intensity >= 1);
      })()`) },
      { label: "combat phase lighting enemy response", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getCombatPhaseLighting) return false;
        const light = r.getCombatPhaseLighting(battle);
        return !!(light && light.active && light.mode === "enemy" && light.response && light.enemyHot && light.playerHot && light.laneDirection === -1);
      })()`) },
      { label: "enemy timing metrics active", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getEnemyTimingMetrics) return false;
        const m = r.getEnemyTimingMetrics(battle, battle.enemyAttack);
        return !!(m && m.stateLabel === "窗口开启" && m.inResponse && m.responseStartRatio >= 0 && m.timeToHit >= 0);
      })()`) },
      { label: "enemy model profile reads caster gear", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getEnemyModelProfile) return false;
        const p = r.getEnemyModelProfile(battle.enemyConfig);
        return !!(p && p.modelType === "caster" && p.gear === "focus" && p.armor === "robe");
      })()`) },
      { label: "caster enemy rig silhouette", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getEnemyRigProfile) return false;
        const rig = r.getEnemyRigProfile(r.getEnemyModelProfile(battle.enemyConfig));
        return !!(rig && rig.silhouette === "ritual-caster" && rig.scaleY > 1 && rig.shadowScale < 1 && rig.torsoH >= 74);
      })()`) },
      { label: "renderer telegraph reads curse burst", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        return !!(r && battle.enemyAttack && r.getEnemyTelegraph(battle.enemyAttack).shape === "circle" && r.getEnemyAttackMeta(battle.enemyAttack).type === "咒爆");
      })()`) }
    ]);

    await navigate(cdp, appUrl, desktop);
    await clickId(cdp, "btn-start");
    await closeTutorial(cdp);
    await pressKey(cdp, "8");
    await wait(240);
    await evaluate(cdp, `(() => {
      if (typeof battle === "undefined") throw new Error("battle missing");
      battle.setTurnState("enemy_turn");
      battle.activeAttackSystem.clear();
      battle.startEnemyAttackChain("spellDoubleCut");
      for (const attack of battle.activeAttackSystem.active) {
        attack.elapsed = 1.10;
        battle.activeAttackSystem.updateAttackState(attack);
        attack.paused = true;
      }
      const current = battle.activeAttackSystem.active.find(attack => attack.intent.chainIndex === 0);
      if (current) {
        battle.enemyAttack = current.intent.attack;
        battle.enemyAttackTimer = current.elapsed;
      }
      battle.enemyAttackPhase = "response";
      battle.turnBanner = null;
      battle.flashMessage = null;
      battle.messageTimer = 0;
    })()`);
    await wait(260);
    await captureScenario(cdp, "battle-enemy-chain-intent", [
      { label: "enemy chain active", ok: await evaluate(cdp, `typeof battle !== "undefined" && battle.enemyAttackChain && battle.enemyAttackChain.id === "spellDoubleCut"`) },
      { label: "enemy chain commits staged attacks", ok: await evaluate(cdp, `battle.activeAttackSystem.active.filter(a => a.source === "enemy" && a.intent.chainId === "spellDoubleCut").length === 3`) },
      { label: "enemy chain intent visuals active", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || typeof battle === "undefined" || !r.getEnemyChainIntentVisuals) return false;
        const chain = r.getEnemyChainIntentVisuals(battle);
        return !!(chain && chain.active && chain.chainId === "spellDoubleCut" && chain.count === 3 && chain.rows.length === 3 && chain.rows.some(row => row.hot || row.pending) && chain.rows.filter(row => !row.resolved).length >= 2 && chain.nextCount >= 1);
      })()`) },
      { label: "enemy chain uses mixed telegraph shapes", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        const chain = r && typeof battle !== "undefined" ? r.getEnemyChainIntentVisuals(battle) : null;
        return !!(chain && chain.rows.some(row => row.shape === "line") && chain.rows.some(row => row.attackId === "quickStab"));
      })()`) }
    ]);

    await navigate(cdp, appUrl, desktop);
    await clickId(cdp, "btn-start");
    await closeTutorial(cdp);
    await pressKey(cdp, "6");
    await wait(240);
    await evaluate(cdp, `(() => {
      if (typeof battle === "undefined") throw new Error("battle missing");
      battle.enemyHp = 0;
      battle.activeEncounterPhaseId = "molten_core";
      battle.battleStats.damageDealt = 132;
      battle.battleStats.hits = 5;
      battle.battleStats.attempts = 6;
      battle.battleStats.perfectCount = 3;
      battle.battleStats.maxCombo = 4;
      battle.battleStats.hitsTaken = 1;
      battle.setTurnState("game_over");
      battle.setMessage("胜利！");
    })()`);
    await wait(320);
    await captureScenario(cdp, "battle-result-summary", [
      { label: "battle result state", ok: await evaluate(cdp, `typeof battle !== "undefined" && battle.turnState === "game_over"`) },
      { label: "battle result has phase summary", ok: await evaluate(cdp, `battle.getBattleResultLines().some(line => line.includes("熔心压迫"))`) },
      { label: "battle result has accuracy summary", ok: await evaluate(cdp, `battle.getBattleResultLines().some(line => line.includes("命中率：83%"))`) },
      { label: "html result summary visible", ok: await evaluate(cdp, `document.getElementById("game-over").textContent.includes("战斗摘要") && document.getElementById("game-over").textContent.includes("熔心压迫")`) }
    ]);

    await navigate(cdp, appUrl, desktop);
    await clickId(cdp, "btn-demo");
    await closeTutorial(cdp);
    await pressKey(cdp, "3");
    await pressKey(cdp, "6");
    await waitForEvaluate(
      cdp,
      `document.getElementById("turn-indicator").textContent.includes("结算") && document.body.textContent.includes("R")`,
      14000,
      "demo result preview"
    );
    await captureScenario(cdp, "demo-result-preview", [
      { label: "demo result preview visible", ok: await evaluate(cdp, `document.getElementById("turn-indicator").textContent.includes("结算")`) },
      { label: "replay hint visible", ok: await evaluate(cdp, `document.body.textContent.includes("R") && document.body.textContent.includes("重播")`) },
      { label: "demo result suppresses residual flash", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        const scene = typeof demo !== "undefined" ? demo : null;
        return !!(r && scene && scene.turnState === "demo_preview" && !r.shouldDrawScreenFlash(scene));
      })()`) }
    ]);
    await pressKey(cdp, "R");
    await waitForEvaluate(cdp, `document.getElementById("turn-indicator").textContent.includes("QTE")`, 4000, "demo replay qte");
    await wait(500);
    await captureScenario(cdp, "demo-result-replay-qte", [
      { label: "demo replay entered qte", ok: await evaluate(cdp, `document.getElementById("turn-indicator").textContent.includes("QTE")`) },
      { label: "replayed item remains flame blade", ok: await evaluate(cdp, `document.body.textContent.includes("焰刃") || document.body.textContent.includes("熔甲")`) },
      { label: "demo qte bar avoids detail drawer", ok: await evaluate(cdp, `(() => {
        const r = typeof renderer !== "undefined" ? renderer : null;
        if (!r || !r.getDemoStageBounds) return false;
        const stage = r.getDemoStageBounds();
        if (stage.compact) return true;
        const drawer = document.getElementById("demo-detail-drawer").getBoundingClientRect();
        const canvas = document.getElementById("game-canvas").getBoundingClientRect();
        const scaleX = canvas.width / 960;
        const barW = Math.min(760, Math.max(520, stage.w - 36));
        const barRight = canvas.left + (stage.centerX + barW / 2) * scaleX;
        return barRight <= drawer.left - 8;
      })()`) }
    ]);

    await navigate(cdp, appUrl, mobileLandscape);
    await clickId(cdp, "btn-demo");
    await closeTutorial(cdp);
    await wait(260);
    await captureScenario(cdp, "demo-menu-mobile-landscape", [
      { label: "container fits viewport", ok: await evaluate(cdp, `(() => {
        const r = document.getElementById("game-container").getBoundingClientRect();
        return r.width <= innerWidth + 1 && r.height <= innerHeight + 1 && r.left >= -1 && r.top >= -1;
      })()`) },
      { label: "mobile showcase visible", ok: await evaluate(cdp, `document.body.textContent.includes("亮点演示")`) }
    ]);

    const errors = pageErrorEvents(cdp);
    if (errors.length > 0) {
      throw new Error(`Browser errors detected: ${errors.map(event => {
        if (event.method === "Log.entryAdded") return event.params.entry.text;
        if (event.method === "Runtime.exceptionThrown") return event.params.exceptionDetails.text;
        if (event.method === "Runtime.consoleAPICalled") return event.params.args.map(arg => arg.value || arg.description || "").join(" ");
        return event.method;
      }).join(" | ")}`);
    }

    const manifest = {
      appUrl,
      browser: browserPath,
      generatedAt: new Date().toISOString(),
      artifacts
    };
    const manifestPath = path.join(outDir, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    console.log("Visual smoke passed.");
    console.log(`Artifacts: ${path.relative(root, outDir)}`);
    for (const item of artifacts) {
      console.log(`  [OK] ${item.name} -> ${item.file}`);
    }
  } finally {
    if (cdp) cdp.close();
    browser.kill();
    server.kill();
    await wait(200);
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (err) {
      console.warn(`Could not remove temporary browser profile: ${err.message}`);
    }
  }
}

runVisualSmoke().catch(err => {
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
