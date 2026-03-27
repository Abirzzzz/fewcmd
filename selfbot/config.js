require("dotenv").config();

module.exports = {
  // Set DISCORD_TOKEN as an environment variable (in .env locally, or in Coolify dashboard)
  token: process.env.DISCORD_TOKEN || "",

  // Set ALLOWED_USERS as a comma-separated list of Discord user IDs in your env
  // Example: ALLOWED_USERS=123456789012345678,987654321098765432
  allowedUsers: process.env.ALLOWED_USERS
    ? process.env.ALLOWED_USERS.split(",").map((id) => id.trim()).filter(Boolean)
    : [],

  // Max deleted/edited messages stored per channel (snipe = 5, snipe all = this number)
  snipeMax: 10,
};
