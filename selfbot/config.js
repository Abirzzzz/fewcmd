module.exports = {
  // Your Discord account token (keep this secret!)
  token: process.env.DISCORD_TOKEN || "YOUR_TOKEN_HERE",

  // User IDs allowed to use commands — add your own Discord user ID here
  allowedUsers: [
    "YOUR_USER_ID_HERE",
    // Add more IDs as needed:
    // "ANOTHER_USER_ID",
  ],

  // Max messages snipe stores (snipe = 5 latest, snipe all = up to this number)
  snipeMax: 10,
};
