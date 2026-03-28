const https = require("https");
const http = require("http");
const config = require("./config");

function getOpenRouterConfig() {
  // Replit AI Integrations proxy — no personal API key needed
  const replitBase = process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL;
  const replitKey = process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;
  if (replitBase && replitKey) {
    return { baseUrl: replitBase.replace(/\/$/, ""), apiKey: replitKey };
  }
  // Termux / anywhere else — personal OpenRouter API key from config
  if (config.openrouterApiKey) {
    return { baseUrl: "https://openrouter.ai/api/v1", apiKey: config.openrouterApiKey };
  }
  return null;
}

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
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

async function fuzzyMatchGif(query, gifs) {
  const cfg = getOpenRouterConfig();
  if (!cfg || gifs.length === 0) return null;

  const named = gifs.filter((g) => g.name);
  if (named.length === 0) return null;

  const list = named.map((g) => `${g.id} | ${g.name}`).join("\n");

  const prompt =
    `You are a gif finder. The user has this gif library (format: ID | name):\n${list}\n\n` +
    `The user typed: "${query}"\n\n` +
    `Their input may have typos, swapped letters, or scrambled words. ` +
    `Figure out which gif they want. ` +
    `Reply with ONLY the gif ID that best matches, or exactly "NONE" if nothing is close. No other text.`;

  try {
    const json = await httpsPost(
      `${cfg.baseUrl}/chat/completions`,
      {
        model: "openai/gpt-oss-20b:free",
        max_tokens: 20,
        messages: [{ role: "user", content: prompt }],
      },
      { Authorization: `Bearer ${cfg.apiKey}` }
    );

    const text = json.choices?.[0]?.message?.content?.trim() || "NONE";
    if (text === "NONE") return null;
    return text;
  } catch {
    return null;
  }
}

module.exports = { fuzzyMatchGif };
