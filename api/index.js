require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

// Initialize bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

// API URLs
const API_URL = process.env.API_URL || "https://anime-api-seven-wheat.vercel.app/api";
const WEBAPP_URL = process.env.WEBAPP_URL || "https://your-webapp.com";
const BANNER_API = "https://banner-gene.onrender.com/api/create";

// =======================
// Fetch the latest episodes
// =======================
async function fetchLatestEpisodes() {
  try {
    const res = await axios.get(API_URL);
    return res.data?.results?.latestEpisode || [];
  } catch (err) {
    console.error("❌ API fetch error:", err.message);
    return [];
  }
}

// =======================
// Build caption
// =======================
function buildCaption(anime) {
  const episodeNum = anime.tvInfo?.sub || anime.tvInfo?.dub || "-";
  const quality = anime.tvInfo?.quality || "HD";
  const showType = anime.tvInfo?.showType || "TV/ONA";
  
  return `<b><blockquote>⬡ ${anime.title}</blockquote>
╭━━━━━━━━━━━━━━━━━━━━━
‣ Episode : ${episodeNum}
‣ Quality : ${quality}
‣ Type : ${showType}
╰━━━━━━━━━━━━━━━━━━━━━
<blockquote>⬡ Powered By : @Otaku_Syndicate</blockquote></b>`;
}

// =======================
// Send latest to user
// =======================
async function sendLatest(chatId) {
  const episodes = await fetchLatestEpisodes();
  if (!episodes.length) return bot.sendMessage(chatId, "❌ No latest episodes found.");

  const anime = episodes.find(ep => !ep.adultContent);
  if (!anime) return bot.sendMessage(chatId, "❌ No suitable episodes found (all filtered).");

  const caption = buildCaption(anime);
  const bannerUrl = `${BANNER_API}?title=${encodeURIComponent(anime.title)}`;

  await bot.sendPhoto(chatId, bannerUrl, {
    caption,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🎬 Watch Now",
            web_app: { url: `${WEBAPP_URL}/?stream=${anime.id}` }
          }
        ]
      ]
    }
  });
}

// =======================
// Fetch today's schedule
// =======================
async function fetchTodaySchedule() {
  try {
    const res = await axios.get(API_URL);
    return res.data?.results?.today?.schedule || [];
  } catch (err) {
    console.error("❌ Schedule fetch error:", err.message);
    return [];
  }
}

// =======================
// Send schedule (styled)
// =======================
async function sendSchedule(chatId) {
  const schedule = await fetchTodaySchedule();
  
  if (!schedule.length) {
    return bot.sendMessage(chatId, "❌ No episodes scheduled for today.");
  }

  const message = schedule
    .map(item => `<b><blockquote>⬡ ${item.title}</blockquote></b>\n‣ Time: ${item.time}\n‣ Episode: ${item.episode || "-"}`)
    .join("\n\n");

  await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
}

// =======================
// Serverless handler
// =======================
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const update = req.body;
  const text = update.message?.text;
  const chatId = update.message?.chat.id;

  if (!chatId) return res.status(400).send("No chat ID");

  if (text === "/latest") {
    await sendLatest(chatId);
  } else if (text === "/schedule") {
    await sendSchedule(chatId);
  }

  return res.status(200).json({ ok: true });
};
