const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "gifs.json");
const MAX_GIFS = 150;
const PER_PAGE = 4;

function generateId() {
  return Math.random().toString(36).slice(2, 8);
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveData(data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getUserGifs(userId) {
  const data = loadData();
  return data[userId] || [];
}

function getGifPage(userId, page) {
  const gifs = getUserGifs(userId);
  const totalPages = Math.max(1, Math.ceil(gifs.length / PER_PAGE));
  const p = Math.max(1, Math.min(page, totalPages));
  const slice = gifs.slice((p - 1) * PER_PAGE, p * PER_PAGE);
  return { gifs: slice, page: p, totalPages, total: gifs.length };
}

function addGif(userId, url) {
  const data = loadData();
  if (!data[userId]) data[userId] = [];
  if (data[userId].length >= MAX_GIFS) {
    return { error: "max", max: MAX_GIFS };
  }
  let id;
  do {
    id = generateId();
  } while (data[userId].some((g) => g.id === id));
  data[userId].push({ id, url, name: null, addedAt: Date.now() });
  saveData(data);
  return { id };
}

function removeGif(userId, id) {
  const data = loadData();
  if (!data[userId]) return false;
  const before = data[userId].length;
  data[userId] = data[userId].filter((g) => g.id !== id);
  if (data[userId].length === before) return false;
  saveData(data);
  return true;
}

function nameGif(userId, id, name) {
  const data = loadData();
  if (!data[userId]) return { error: "not_found" };
  const gif = data[userId].find((g) => g.id === id);
  if (!gif) return { error: "not_found" };
  const nameTaken = data[userId].some(
    (g) => g.name && g.name.toLowerCase() === name.toLowerCase() && g.id !== id
  );
  if (nameTaken) return { error: "name_taken" };
  gif.name = name;
  saveData(data);
  return { ok: true };
}

function getGifByIdOrName(userId, query) {
  const gifs = getUserGifs(userId);
  return (
    gifs.find(
      (g) =>
        g.id === query ||
        (g.name && g.name.toLowerCase() === query.toLowerCase())
    ) || null
  );
}

module.exports = {
  getUserGifs,
  getGifPage,
  addGif,
  removeGif,
  nameGif,
  getGifByIdOrName,
  MAX_GIFS,
  PER_PAGE,
};
