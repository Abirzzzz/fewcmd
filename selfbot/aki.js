const fs = require("fs");
const path = require("path");
const https = require("https");

const USAGE_FILE = path.join(__dirname, "data", "aki_usage.json");
const MAX_USES = 5;
const RESET_MS = 24 * 60 * 60 * 1000;

// channelId -> { game, targetUserId, hostUserId, awaitingAnswer }
const sessions = new Map();

// ── Usage persistence ──────────────────────────────────────────────────────

function loadUsage() {
  try { return JSON.parse(fs.readFileSync(USAGE_FILE, "utf8")); }
  catch { return {}; }
}

function saveUsage(data) {
  fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
  fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2));
}

function canUse(userId) {
  const usage = loadUsage();
  const entry = usage[userId];
  if (!entry) return true;
  if (Date.now() - entry.lastReset >= RESET_MS) return true;
  return entry.count < MAX_USES;
}

function getRemainingUses(userId) {
  const usage = loadUsage();
  const entry = usage[userId];
  if (!entry) return MAX_USES;
  if (Date.now() - entry.lastReset >= RESET_MS) return MAX_USES;
  return Math.max(0, MAX_USES - entry.count);
}

function recordUse(userId) {
  const usage = loadUsage();
  const now = Date.now();
  const entry = usage[userId];
  if (!entry || now - entry.lastReset >= RESET_MS) {
    usage[userId] = { count: 1, lastReset: now };
  } else {
    usage[userId].count++;
  }
  saveUsage(usage);
}

function resetUser(userId) {
  const usage = loadUsage();
  delete usage[userId];
  saveUsage(usage);
}

// ── Custom Akinator client ─────────────────────────────────────────────────

const AKI_HOST = "en.akinator.com";
const SHARED_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Origin": "https://en.akinator.com",
  "Referer": "https://en.akinator.com/",
};

function httpsGet(host, path, cookie) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host, path, method: "GET", rejectUnauthorized: false,
      headers: { ...SHARED_HEADERS, "Accept": "text/html", "Cookie": cookie || "" },
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error("timeout")); });
    req.end();
  });
}

function httpsPost(host, path, cookie, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host, path, method: "POST", rejectUnauthorized: false,
      headers: {
        ...SHARED_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
        "Cookie": cookie || "",
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error("timeout")); });
    req.write(body);
    req.end();
  });
}

class AkinatorGame {
  constructor(cookie) {
    this.cookie = cookie;
    this.session = null;
    this.signature = null;
    this.question = "";
    this.progress = 0;
    this.currentStep = 0;
  }

  async start() {
    const { status, body } = await httpsPost(AKI_HOST, "/game", this.cookie, "sid=1&cm=false");
    if (status !== 200) throw new Error("game start returned " + status);
    const qMatch = body.match(/<p class="question-text" id="question-label">(.+?)<\/p>/);
    const sMatch = body.match(/session: '(.+?)'/);
    const sigMatch = body.match(/signature: '(.+?)'/);
    if (!qMatch || !sMatch || !sigMatch) throw new Error("could not parse game page");
    this.question = qMatch[1];
    this.session = sMatch[1];
    this.signature = sigMatch[1];
    return this;
  }

  async step(answer) {
    const body = [
      "step=" + this.currentStep,
      "progression=" + this.progress,
      "sid=1",
      "cm=false",
      "answer=" + answer,
      "step_last_proposition=",
      "session=" + encodeURIComponent(this.session),
      "signature=" + encodeURIComponent(this.signature),
    ].join("&");
    const { status, body: raw } = await httpsPost(AKI_HOST, "/answer", this.cookie, body);
    if (status !== 200) throw new Error("answer returned " + status);
    const result = JSON.parse(raw);
    if (result.id_base_proposition) return result;
    this.currentStep = parseInt(result.step, 10);
    this.question = result.question;
    this.progress = parseFloat(result.progression);
    return result;
  }
}

// ── Session management ─────────────────────────────────────────────────────

function getSession(channelId) { return sessions.get(channelId); }
function clearSession(channelId) { sessions.delete(channelId); }

async function startSession(channelId, hostUserId, targetUserId) {
  const r = await httpsGet(AKI_HOST, "/", null);
  const cookie = (r.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
  const game = new AkinatorGame(cookie);
  await game.start();
  const session = { game, hostUserId, targetUserId, awaitingAnswer: true };
  sessions.set(channelId, session);
  return session;
}

// ── Answer parser ──────────────────────────────────────────────────────────

const ANSWER_MAP = {
  yes: 0,
  y: 0,
  no: 1,
  n: 1,
  idk: 2,
  "i don't know": 2,
  "i dont know": 2,
  prob: 3,
  probably: 3,
  probn: 4,
  "probably not": 4,
};

function parseAnswer(text) {
  const key = text.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ANSWER_MAP, key)) return ANSWER_MAP[key];
  return null;
}

// ── Guess formatter ────────────────────────────────────────────────────────

function formatGuess(guess) {
  const name = guess.name_proposition || "Unknown";
  const desc = guess.description_proposition || "";
  const img  = guess.absolute_picture_path || guess.photo || null;
  return { name, desc, img };
}

module.exports = {
  MAX_USES,
  canUse,
  getRemainingUses,
  recordUse,
  resetUser,
  getSession,
  clearSession,
  startSession,
  parseAnswer,
  formatGuess,
};
