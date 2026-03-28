const https = require("https");
const http = require("http");
const config = require("./config");

// ── Levenshtein distance ───────────────────────────────────────────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
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

// ── Stage 1: pure Levenshtein fuzzy match ─────────────────────────────────
// Works well for typos and a few wrong letters. Threshold: distance ≤ 40% of
// the longer string's length (so "groor cry" matches "groot cry" easily).
function levenshteinMatch(query, gifs) {
  const q = query.toLowerCase().trim();
  let best = null, bestDist = Infinity;

  for (const gif of gifs) {
    const candidates = [];
    if (gif.name) candidates.push(gif.name.toLowerCase());
    candidates.push(gif.id.toLowerCase());

    for (const c of candidates) {
      const dist = levenshtein(q, c);
      if (dist < bestDist) { bestDist = dist; best = gif; }
    }
  }

  const maxLen = Math.max(query.length, best ? (best.name || best.id).length : 1);
  const threshold = Math.max(2, Math.floor(maxLen * 0.45));

  return bestDist <= threshold ? best : null;
}

// ── Stage 2: AI match via OpenRouter ──────────────────────────────────────
// Much more aggressive — always returns the closest match, only NONE if empty.
async function aiMatch(query, gifs) {
  const cfg = getOpenRouterConfig();
  if (!cfg || gifs.length === 0) return null;

  const list = gifs
    .map((g) => `${g.id} | ${g.name || "(no name)"}`)
    .join("\n");

  const prompt =
    `You match typo-filled queries to a gif library. The query will have typos, ` +
    `wrong letters, scrambled characters, or missing letters.\n\n` +
    `Gif library (ID | name):\n${list}\n\n` +
    `Query: "${query}"\n\n` +
    `Rules:\n` +
    `- Always pick the single closest match from the library above.\n` +
    `- Treat each word in the query independently — match sounds, shapes of words, partial spelling.\n` +
    `- Only reply "NONE" if the library is completely empty.\n` +
    `- Reply with the ID only. Absolutely nothing else.`;

  try {
    const json = await httpsPost(
      `${cfg.baseUrl}/chat/completions`,
      {
        model: "openai/gpt-oss-20b:free",
        max_tokens: 20,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      },
      { Authorization: `Bearer ${cfg.apiKey}` }
    );

    const raw = (json.choices?.[0]?.message?.content || "").trim();
    if (!raw || raw === "NONE") return null;

    // Extract the first token that looks like one of the actual IDs
    const ids = new Set(gifs.map((g) => g.id));
    const words = raw.split(/\s+/);
    for (const w of words) {
      const clean = w.replace(/[^a-z0-9]/gi, "");
      if (ids.has(clean)) return gifs.find((g) => g.id === clean) || null;
    }

    // Fallback: if the AI returned something close to an ID via Levenshtein
    for (const w of words) {
      const clean = w.replace(/[^a-z0-9]/gi, "");
      if (clean.length >= 4) {
        for (const gif of gifs) {
          if (levenshtein(clean, gif.id) <= 1) return gif;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ── Main export ────────────────────────────────────────────────────────────
// Returns the matched gif object (not just the ID) or null.
async function fuzzyMatchGif(query, gifs) {
  if (gifs.length === 0) return null;

  // Stage 1: fast Levenshtein — no network, handles simple typos
  const lev = levenshteinMatch(query, gifs);
  if (lev) return lev;

  // Stage 2: AI — handles scrambled words, phonetic, creative mangling
  const ai = await aiMatch(query, gifs);
  return ai;
}

module.exports = { fuzzyMatchGif };
