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
      { label: "main menu visible", ok: await evaluate(cdp, `document.getElementById("main-menu").style.display !== "none"`) }
    ]);

    await navigate(cdp, appUrl, desktop);
    await clickId(cdp, "btn-demo");
    await closeTutorial(cdp);
    await captureScenario(cdp, "demo-menu-showcase", [
      { label: "showcase category visible", ok: await evaluate(cdp, `document.body.textContent.includes("亮点演示")`) },
      { label: "demo detail visible", ok: await evaluate(cdp, `!document.getElementById("demo-detail-drawer").classList.contains("hidden")`) }
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
      { label: "difficulty badge visible", ok: await evaluate(cdp, `document.getElementById("difficulty-badge").textContent.length > 0`) }
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
      { label: "style 7 mirror text visible", ok: await evaluate(cdp, `document.body.textContent.includes("镜") || document.body.textContent.includes("咒还")`) }
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
      { label: "replay hint visible", ok: await evaluate(cdp, `document.body.textContent.includes("R") && document.body.textContent.includes("重播")`) }
    ]);
    await pressKey(cdp, "R");
    await waitForEvaluate(cdp, `document.getElementById("turn-indicator").textContent.includes("QTE")`, 4000, "demo replay qte");
    await wait(500);
    await captureScenario(cdp, "demo-result-replay-qte", [
      { label: "demo replay entered qte", ok: await evaluate(cdp, `document.getElementById("turn-indicator").textContent.includes("QTE")`) },
      { label: "replayed item remains flame blade", ok: await evaluate(cdp, `document.body.textContent.includes("焰刃") || document.body.textContent.includes("熔甲")`) }
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
