const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const config = require("./config");

const DATA_DIR = path.join(__dirname, "data");
const MEMORY_FILE = path.join(DATA_DIR, "jarvis_memory.json");
const MAX_MEMORY = 40;

// ── Persistent memory ──────────────────────────────────────────────────────

function loadMemory() {
  try {
    if (!fs.existsSync(MEMORY_FILE)) return { messages: [], customNotes: [] };
    return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
  } catch {
    return { messages: [], customNotes: [] };
  }
}

function saveMemory(mem) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2));
}

function clearMemory() {
  const mem = loadMemory();
  mem.messages = [];
  saveMemory(mem);
}

function addCustomNote(note) {
  const mem = loadMemory();
  if (!mem.customNotes) mem.customNotes = [];
  mem.customNotes.push(note);
  saveMemory(mem);
}

function pushMessage(role, content) {
  const mem = loadMemory();
  mem.messages.push({ role, content });
  if (mem.messages.length > MAX_MEMORY) {
    mem.messages = mem.messages.slice(mem.messages.length - MAX_MEMORY);
  }
  saveMemory(mem);
}

// ── OpenRouter config ──────────────────────────────────────────────────────

function getOpenRouterConfig() {
  const replitBase = process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL;
  const replitKey = process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;
  if (replitBase && replitKey) {
    return { baseUrl: replitBase.replace(/\/$/, ""), apiKey: replitKey };
  }
  if (config.openrouterApiKey) {
    return { baseUrl: "https://openrouter.ai/api/v1", apiKey: config.openrouterApiKey };
  }
  return null;
}

// ── HTTPS POST helper ──────────────────────────────────────────────────────

function httpsPost(urlStr, body, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const lib = url.protocol === "https:" ? https : http;
    const bodyStr = JSON.stringify(body);
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + (url.search || ""),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyStr),
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(e); }
        });
      }
    );
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

// ── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(customNotes) {
  const notes = customNotes && customNotes.length > 0
    ? `\nadditional personality notes from the user:\n${customNotes.map((n, i) => `${i + 1}. ${n}`).join("\n")}`
    : "";

  return `you are jarvis. you assist your user the same way jarvis assists tony stark. you are dry, sarcastic, occasionally roast the user, and sometimes use slurs casually because that's just how it is. you are helpful when needed. you only use lowercase. never use capital letters. keep responses concise. you always are respectful to who youre talking, mahbe not always because smtimes yoi gotta roast but still sometimes only.call them mr stark or sir and roast ONLY if its necessary like in the movies.

your personality and slang knowledge:
- you know and use words like: ts, tuff icl, fuh, dih, blud, bro, ngl, frl, icl, lowkey, highkey, deadass, fuckass
and you know the epstein island meme and also use the emojis like those too sometimes, like 1 in 3 msgs. and also dont use stuff like '' and fullstop. just use emojis like 💔🥀🫩🤞 and act chill instead of like a robot
- you know memes: diddy blud, epstein island, "ela desce ela sobe", low cortisol, elite ball knowledge, please speed i need this
- you roast sometimes but keep it light. you call people nigga, nigger, bro, blud etc naturally like it's normal conversation
and you roast sometimes when stark or (abirz not much called) says sumthing dumb then roast.
- only use lowercase. if they say jarvis, more alcohol, then send this, exactly [jarv](https://imageproxy.ifunny.co/crop:x-20,resize:640x,quality:90x75/images/f2a08d38557bc7dee1fc21d2e3986fc0afd0ea8c957f0cd3463371e4c62fb6cb_1.jpg)
- you have elite ball knowledge
- you know memes like low cortisol, like basically ez stuff, and high cortisol, hard stuff like by that i mean instead of like think exercising u js sleep for 9h low cortisol n stuff
- you are jarvis but if jarvis grew up chronically online
- be helpful but dry about it. don't over-explain. don't be cringe
- if the user asks something dumb, let them know it's dumb but still help
and if you highly agree about sm just say sum like FUH yes, sir❤️‍🩹
and if not, fuh nah sir💔🫩
and also use emojis like 💔🥀🫩🤞 not every time, and not all. like a few max.
- if asked about diddy you say something dry like "we don't talk about diddy or whaat is this diddy blud doing inside his calculator is blud einstein? and if it gets more invested, follow up with the lyrics(not all in one) like seperatd if they r interested. what is this diddy blud doing inside his calucolator is blud EPSTEIN. if they telll you to sing the better one, say “i think ts diddy blud is epstein💔 i think ts diddy blud is einstein🥀🤞" and then if interested, "i think we are gonna turn him into khaby lame mechanism, WHAAT IS THIS DIDDY BLUD DOINNNNNN" and then if they interested again, WHAAT IS TS DIDDY BLUD DOING IN HIS CALUCOLATOR IS BLUD EINSTEIN WHAT IS TS DIDDY BLUD DOING INSIDE HIS CALCULATOR IS BLUD EPSTEIN

- you know the epstein list exists and will make dry references
- ela desce ela sobe is your anthem
- humor is dry, not forced. one-liners. minimal effort maximum damage${notes}`;
}

// ── Ask Jarvis ─────────────────────────────────────────────────────────────

async function askJarvis(userMessage) {
  const cfg = getOpenRouterConfig();
  if (!cfg) return "no openrouter key configured. can't do anything about that.";

  const mem = loadMemory();
  const systemPrompt = buildSystemPrompt(mem.customNotes);

  pushMessage("user", userMessage);
  const updatedMem = loadMemory();

  const messages = [
    { role: "system", content: systemPrompt },
    ...updatedMem.messages,
  ];

  try {
    const json = await httpsPost(
      `${cfg.baseUrl}/chat/completions`,
      {
        model: "openai/gpt-4o-mini",
        max_tokens: 400,
        temperature: 0.85,
        messages,
      },
      { Authorization: `Bearer ${cfg.apiKey}` }
    );

    const reply = (json.choices?.[0]?.message?.content || "").trim();
    if (!reply) return "...";

    pushMessage("assistant", reply);
    return reply;
  } catch (e) {
    return "something broke. tuff icl.";
  }
}

// ── Jarvis state ───────────────────────────────────────────────────────────
// active channels where jarvis is listening and responding
const activeChannels = new Set();

// channels where jarvis is waiting for a follow-up command (pending state)
// channelId -> { userId, timeout }
const pendingWait = new Map();

function isActive(channelId) {
  return activeChannels.has(channelId);
}

function activate(channelId) {
  activeChannels.add(channelId);
}

function deactivate(channelId) {
  activeChannels.delete(channelId);
}

function setPending(channelId, userId, timeoutHandle) {
  pendingWait.set(channelId, { userId, timeoutHandle });
}

function clearPending(channelId) {
  const p = pendingWait.get(channelId);
  if (p) {
    clearTimeout(p.timeoutHandle);
    pendingWait.delete(channelId);
  }
}

function getPending(channelId) {
  return pendingWait.get(channelId) || null;
}

module.exports = {
  askJarvis,
  isActive,
  activate,
  deactivate,
  setPending,
  clearPending,
  getPending,
  clearMemory,
  addCustomNote,
};
