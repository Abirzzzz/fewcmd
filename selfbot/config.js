require("dotenv").config({ path: require("path").join(__dirname, ".env") });

module.exports = {
  token: process.env.DISCORD_TOKEN,

  giphyApiKey: process.env.GIPHY_API_KEY || "Tjp9Nf8nX0l7gYePjX5XT03nyQ2pEDFC",

  allowedUsers: [
    "1074719422931030117",
  ],

  snipeMax: 10,
};
