const { Client } = require("discord.js-selfbot-v13");
const config = require("./config");

const client = new Client({ checkUpdate: false });

// Snipe store: { channelId: [ ...entries ] }
// Each entry: { type: "deleted"|"edited", authorTag, authorDisplayName, content, oldContent, timestamp }
const snipeStore = new Map();

function addSnipe(channelId, entry) {
  if (!snipeStore.has(channelId)) {
    snipeStore.set(channelId, []);
  }
  const arr = snipeStore.get(channelId);
  arr.unshift(entry); // newest first
  if (arr.length > config.snipeMax) {
    arr.splice(config.snipeMax);
  }
}

function getDisplayName(member, user) {
  if (member && member.displayName) return member.displayName;
  return user.username;
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

client.on("messageCreate", async (message) => {
  // Only respond to allowed users
  if (!config.allowedUsers.includes(message.author.id)) return;

  const content = message.content;

  // ── SPAM COMMAND ──────────────────────────────────────────────────────────
  // Format: <message> spam <times>
  // e.g. "hello world spam 5"
  const spamMatch = content.match(/^(.+?)\s+spam\s+(\d+)$/i);
  if (spamMatch) {
    const spamText = spamMatch[1].trim();
    const times = parseInt(spamMatch[2], 10);

    if (times < 1 || times > 200) return;

    // Delete the trigger message first
    try {
      await message.delete();
    } catch (_) {}

    for (let i = 0; i < times; i++) {
      try {
        await message.channel.send(spamText);
      } catch (_) {}
    }
    return;
  }

  // ── SNIPE COMMAND ─────────────────────────────────────────────────────────
  // "snipe" = show last 5
  // "snipe all" = show last 10
  if (/^snipe(\s+all)?$/i.test(content.trim())) {
    const showAll = /snipe\s+all/i.test(content.trim());
    const limit = showAll ? config.snipeMax : 5;

    const entries = snipeStore.get(message.channel.id) || [];
    const toShow = entries.slice(0, limit);

    if (toShow.length === 0) {
      // Silently do nothing — no messages to snipe
      return;
    }

    // Delete the trigger message
    try {
      await message.delete();
    } catch (_) {}

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
