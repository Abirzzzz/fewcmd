require("dotenv").config({ path: require("path").join(__dirname, ".env") });

module.exports = {
  token: process.env.DISCORD_TOKEN,

  allowedUsers: [
    "1074719422931030117",
  ],

  snipeMax: 10,
};
