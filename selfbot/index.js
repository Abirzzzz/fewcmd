require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const https = require("https");
const { Client } = require("discord.js-selfbot-v13");
const config = require("./config");
const store = require("./store");
const { fuzzyMatchGif } = require("./matcher");

if (!config.token) {
  console.error("ERROR: DISCORD_TOKEN is not set. Add it to selfbot/.env");
  process.exit(1);
}

const client = new Client({ checkUpdate: false });

// ── Snipe store: channelId -> [ ...entries ] ───────────────────────────────
const snipeStore = new Map();

// ── Active spam flags: channelId -> bool ──────────────────────────────────
const activeSpam = new Map();

// ── Helpers ────────────────────────────────────────────────────────────────

function addSnipe(channelId, entry) {
  if (!snipeStore.has(channelId)) snipeStore.set(channelId, []);
  const arr = snipeStore.get(channelId);
  arr.unshift(entry);
  if (arr.length > config.snipeMax) arr.splice(config.snipeMax);
}

function getDisplayName(member, user) {
  return (member && member.displayName) ? member.displayName : user.username;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "selfbot/1.0" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

async function giphySearch(query, page) {
  const key = config.giphyApiKey;
  if (!key) return { error: "no_key" };
  const limit = 4;
  const offset = (page - 1) * limit;
  const url =
    `https://api.giphy.com/v1/gifs/search` +
    `?api_key=${encodeURIComponent(key)}` +
    `&q=${encodeURIComponent(query)}` +
    `&limit=${limit}&offset=${offset}&rating=g&lang=en`;
  try {
    const json = await httpsGet(url);
    if (!json.data) return { error: "api_error" };
    const gifs = json.data.map((g) => ({
      url: `https://media.giphy.com/media/${g.id}/giphy.gif`,
      title: g.title || "",
    }));
    const total = json.pagination ? json.pagination.total_count : 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return { gifs, page, totalPages, total };
  } catch {
    return { error: "fetch_error" };
  }
}

// ── Event listeners ────────────────────────────────────────────────────────

client.on("messageDelete", (message) => {
  if (!message.content) return;
  if (message.author && message.author.bot) return;
  addSnipe(message.channel.id, {
    type: "deleted",
    authorTag: message.author.tag,
    authorDisplayName: getDisplayName(message.member, message.author),
    content: message.content,
    timestamp: Date.now(),
  });
});

client.on("messageUpdate", (oldMessage, newMessage) => {
  if (!oldMessage.content || !newMessage.content) return;
  if (oldMessage.content === newMessage.content) return;
  if (oldMessage.author && oldMessage.author.bot) return;
  addSnipe(oldMessage.channel.id, {
    type: "edited",
    authorTag: oldMessage.author.tag,
    authorDisplayName: getDisplayName(oldMessage.member, oldMessage.author),
    content: oldMessage.content,
    newContent: newMessage.content,
    timestamp: Date.now(),
  });
});

// Stop spam when you react to any message
client.on("messageReactionAdd", (reaction, user) => {
  if (!client.user) return;
  if (user.id !== client.user.id) return;
  const channelId = reaction.message.channel.id;
  if (activeSpam.get(channelId)) activeSpam.set(channelId, false);
});

client.on("messageCreate", async (message) => {
  if (!config.allowedUsers.includes(message.author.id)) return;

  const content = message.content.trim();
  const userId = message.author.id;

  // ── SPAM ────────────────────────────────────────────────────────────────
  // <text> spam <n>
  const spamMatch = content.match(/^(.+?)\s+spam\s+(\d+)$/i);
  if (spamMatch) {
    const spamText = spamMatch[1].trim();
    const times = Math.min(parseInt(spamMatch[2], 10), 200);
    if (times < 1) return;
    const channelId = message.channel.id;
    activeSpam.set(channelId, true);
    for (let i = 0; i < times; i++) {
      if (!activeSpam.get(channelId)) break;
      try { await message.channel.send(spamText); } catch (_) {}
      await sleep(300);
    }
    activeSpam.set(channelId, false);
    return;
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  // delete <n> | delete all
  const deleteMatch = content.match(/^delete\s+(\d+|all)$/i);
  if (deleteMatch) {
    const arg = deleteMatch[1].toLowerCase();
    const deleteAll = arg === "all";
    const limit = deleteAll ? Infinity : parseInt(arg, 10);
    if (!deleteAll && limit < 1) return;
    let deleted = 0;
    let keepGoing = true;
    while (keepGoing) {
      let fetched;
      try { fetched = await message.channel.messages.fetch({ limit: 100 }); }
      catch (_) { break; }
      if (!fetched || fetched.size === 0) break;
      const mine = fetched.filter((m) => m.author.id === client.user.id);
      if (mine.size === 0) break;
      for (const [, msg] of mine) {
        if (!deleteAll && deleted >= limit) { keepGoing = false; break; }
        try { await msg.delete(); deleted++; } catch (_) {}
        await sleep(500);
      }
      if (!deleteAll) keepGoing = false;
    }
    return;
  }

  // ── SNIPE ───────────────────────────────────────────────────────────────
  // snipe | snipe all
  if (/^snipe(\s+all)?$/i.test(content)) {
    const showAll = /snipe\s+all/i.test(content);
    const limit = showAll ? config.snipeMax : 5;
    const entries = snipeStore.get(message.channel.id) || [];
    const toShow = entries.slice(0, limit);
    if (toShow.length === 0) return;
    const lines = toShow.map((entry) =>
      entry.type === "deleted"
        ? `**${entry.authorDisplayName}**\ndel = ${entry.content}`
        : `**${entry.authorDisplayName}**\nedited: ${entry.content}\nnow: ${entry.newContent}`
    );
    try { await message.channel.send(lines.join("\n\n")); } catch (_) {}
    return;
  }

  // ── GIPHY ───────────────────────────────────────────────────────────────
  // giphy <query> [page]
  const giphyMatch = content.match(/^giphy\s+(.+?)(?:\s+(\d+))?$/i);
  if (giphyMatch) {
    const query = giphyMatch[1].trim();
    const page = giphyMatch[2] ? parseInt(giphyMatch[2], 10) : 1;
    const result = await giphySearch(query, page);
    if (result.error === "no_key") {
      try { await message.channel.send("no api giphy key"); } catch (_) {}
      return;
    }
    if (result.error || result.gifs.length === 0) {
      try { await message.channel.send(`no results for **${query}** you nigger`); } catch (_) {}
      return;
    }
    const header = `**giphy: "${query}"** — page ${result.page}/${result.totalPages} (${result.total} results)`;
    const urls = result.gifs.map((g) => g.url).join("\n");
    try { await message.channel.send(`${header}\n${urls}`); } catch (_) {}
    return;
  }

  // ── GGIF ────────────────────────────────────────────────────────────────

  // ggif add <url>
  const ggifAddMatch = content.match(/^ggif\s+add\s+(\S+)$/i);
  if (ggifAddMatch) {
    const url = ggifAddMatch[1];
    const result = store.addGif(userId, url);
    if (result.error === "max") {
      try { await message.channel.send(`yoive hit the ${store.MAX_GIFS} gif limit greedy asshole`); } catch (_) {}
      return;
    }
    try { await message.channel.send(`saved — id: \`${result.id}\``); } catch (_) {}
    return;
  }

  // ggif remove <id>
  const ggifRemoveMatch = content.match(/^ggif\s+remove\s+(\S+)$/i);
  if (ggifRemoveMatch) {
    const id = ggifRemoveMatch[1];
    const removed = store.removeGif(userId, id);
    if (!removed) {
      try { await message.channel.send(`no gif with this id niga \`${id}\``); } catch (_) {}
      return;
    }
    try { await message.channel.send(`removed \`${id}\``); } catch (_) {}
    return;
  }

  // ggif name <id> <name>
  const ggifNameMatch = content.match(/^ggif\s+name\s+(\S+)\s+(.+)$/i);
  if (ggifNameMatch) {
    const id = ggifNameMatch[1];
    const name = ggifNameMatch[2].trim();
    const result = store.nameGif(userId, id, name);
    if (result.error === "not_found") {
      try { await message.channel.send(`no gif with ts id \`${id}\``); } catch (_) {}
      return;
    }
    if (result.error === "name_taken") {
      try { await message.channel.send(`you already HAVE a gif named **${name}** dumb figga`); } catch (_) {}
      return;
    }
    try { await message.channel.send(`named \`${id}\` → **${name}**`); } catch (_) {}
    return;
  }

  // ggif [page]  — list saved gifs
  const ggifListMatch = content.match(/^ggif(?:\s+(\d+))?$/i);
  if (ggifListMatch) {
    const page = ggifListMatch[1] ? parseInt(ggifListMatch[1], 10) : 1;
    const result = store.getGifPage(userId, page);
    if (result.total === 0) {
      try { await message.channel.send("you have no saved gifs brochacho💔🫩🤞"); } catch (_) {}
      return;
    }
    const lines = result.gifs.map((g) => {
      const label = g.name ? `**${g.name}**` : "unnamed";
      return `\`${g.id}\` ${label} — ${g.url}`;
    });
    const header = `**your gifs**  page ${result.page}/${result.totalPages} (${result.total} total)`;
    try { await message.channel.send(`${header}\n${lines.join("\n")}`); } catch (_) {}
    return;
  }

  // ── POST ────────────────────────────────────────────────────────────────
  // post <id or name> — exact match first, then AI fuzzy match
  const postMatch = content.match(/^post\s+(.+)$/i);
  if (postMatch) {
    const query = postMatch[1].trim();

    // 1. Try exact match by ID or name
    let gif = store.getGifByIdOrName(userId, query);

    // 2. No exact match — ask AI to figure it out
    if (!gif) {
      const userGifs = store.getUserGifs(userId);
      const matchedId = await fuzzyMatchGif(query, userGifs);
      if (matchedId) {
        gif = store.getGifByIdOrName(userId, matchedId);
      }
    }

    if (!gif) {
      try { await message.channel.send("the actual fuck you mean"); } catch (_) {}
      return;
    }

    try { await message.delete(); } catch (_) {}
    try { await message.channel.send(gif.url); } catch (_) {}
    return;
  }
});

client.on("ready", () => {
  console.log(`Selfbot ready — logged in as ${client.user.tag}`);
});

client.login(config.token);
