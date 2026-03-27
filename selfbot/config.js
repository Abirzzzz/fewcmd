module.exports = {
  // Your Discord account token (keep this secret!)
  token: process.env.DISCORD_TOKEN || "MTA3NDcxOTQyMjkzMTAzMDExNw.GsdGUr.jeXr2xtUHPZy7Q6CgcGNcal5WhN1COqPqn9mdg",

  // User IDs allowed to use commands — add your own Discord user ID here
  allowedUsers: [
    "1074719422931030117",
    // Add more IDs as needed:
    // "ANOTHER_USER_ID",
  ],

  // Max messages snipe stores (snipe = 5 latest, snipe all = up to this number)
  snipeMax: 10,
};
