const fs = require("fs");
const path = require("path");
const { Aki } = require("aki-api");

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

// ── Session management ─────────────────────────────────────────────────────

function getSession(channelId) { return sessions.get(channelId); }
function clearSession(channelId) { sessions.delete(channelId); }

async function startSession(channelId, hostUserId, targetUserId) {
  const game = new Aki({ region: "en", childMode: false });
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
