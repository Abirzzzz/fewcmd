require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const { Client } = require("discord.js-selfbot-v13");
const config = require("./config");

if (!config.token) {
  console.error("ERROR: DISCORD_TOKEN is not set. Create a .env file with DISCORD_TOKEN=your_token");
  process.exit(1);
}

const client = new Client({ checkUpdate: false });

// Snipe store: { channelId: [ ...entries ] }
const snipeStore = new Map();

// Active spam flags: channelId -> true/false
const activeSpam = new Map();

function addSnipe(channelId, entry) {
  if (!snipeStore.has(channelId)) {
    snipeStore.set(channelId, []);
  }
  const arr = snipeStore.get(channelId);
  arr.unshift(entry);
  if (arr.length > config.snipeMax) {
    arr.splice(config.snipeMax);
  }
}

function getDisplayName(member, user) {
  if (member && member.displayName) return member.displayName;
  return user.username;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Track deleted messages
client.on("messageDelete", (message) => {
  if (!message.content) return;
  if (message.author && message.author.bot) return;

  const displayName = getDisplayName(message.member, message.author);

  addSnipe(message.channel.id, {
    type: "deleted",
    authorTag: message.author.tag,
    authorDisplayName: displayName,
    content: message.content,
    oldContent: null,
    timestamp: Date.now(),
  });
});

// Track edited messages
client.on("messageUpdate", (oldMessage, newMessage) => {
  if (!oldMessage.content || !newMessage.content) return;
  if (oldMessage.content === newMessage.content) return;
  if (oldMessage.author && oldMessage.author.bot) return;

  const displayName = getDisplayName(oldMessage.member, oldMessage.author);

  addSnipe(oldMessage.channel.id, {
    type: "edited",
    authorTag: oldMessage.author.tag,
    authorDisplayName: displayName,
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
  if (activeSpam.get(channelId)) {
    activeSpam.set(channelId, false);
  }
});

client.on("messageCreate", async (message) => {
  if (!config.allowedUsers.includes(message.author.id)) return;

  const content = message.content.trim();

  // ── SPAM COMMAND ──────────────────────────────────────────────────────────
  // Format: <message> spam <times>
  const spamMatch = content.match(/^(.+?)\s+spam\s+(\d+)$/i);
  if (spamMatch) {
    const spamText = spamMatch[1].trim();
    const times = Math.min(parseInt(spamMatch[2], 10), 200);

    if (times < 1) return;

    const channelId = message.channel.id;
    activeSpam.set(channelId, true);

    for (let i = 0; i < times; i++) {
      if (!activeSpam.get(channelId)) break;
      try {
        await message.channel.send(spamText);
      } catch (_) {}
      await sleep(300);
    }

    activeSpam.set(channelId, false);
    return;
  }

  // ── DELETE COMMAND ────────────────────────────────────────────────────────
  // "delete <n>" — delete last n of your messages in this channel
  // "delete all" — delete all of your messages in this channel
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
      try {
        fetched = await message.channel.messages.fetch({ limit: 100 });
      } catch (_) {
        break;
      }

      if (!fetched || fetched.size === 0) break;

      const mine = fetched.filter((m) => m.author.id === client.user.id);

      if (mine.size === 0) break;

      for (const [, msg] of mine) {
        if (!deleteAll && deleted >= limit) {
          keepGoing = false;
          break;
        }
        try {
          await msg.delete();
          deleted++;
        } catch (_) {}
        await sleep(500);
      }

      if (!deleteAll) keepGoing = false;
    }

    return;
  }

  // ── SNIPE COMMAND ─────────────────────────────────────────────────────────
  if (/^snipe(\s+all)?$/i.test(content)) {
    const showAll = /snipe\s+all/i.test(content);
    const limit = showAll ? config.snipeMax : 5;

    const entries = snipeStore.get(message.channel.id) || [];
    const toShow = entries.slice(0, limit);

    if (toShow.length === 0) return;

    const lines = toShow.map((entry) => {
      if (entry.type === "deleted") {
        return `**${entry.authorDisplayName}**\ndel = ${entry.content}`;
      } else {
        return `**${entry.authorDisplayName}**\nedited: ${entry.content}\nnow: ${entry.newContent}`;
      }
    });

    const output = lines.join("\n\n");

    try {
      await message.channel.send(output);
    } catch (_) {}
    return;
  }
});

client.on("ready", () => {
  console.log(`Selfbot ready — logged in as ${client.user.tag}`);
});

client.login(config.token);
