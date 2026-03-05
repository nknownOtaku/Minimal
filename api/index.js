require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

// =======================
// Initialize Bot
// =======================
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

// =======================
// Config
// =======================
const API_URL = process.env.API_URL || "https://anime-api-seven-wheat.vercel.app/api";
const WEBAPP_URL = process.env.WEBAPP_URL || "https://your-webapp.com";
const BANNER_API = "https://banner-gene.onrender.com/api/create";
const SCHEDULE_IMAGE = "https://i.ibb.co/JW58ghkb/x.jpg";

// =======================
// Fetch latest episodes
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
// Build caption for latest
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
// Send latest episode
// =======================
async function sendLatest(chatId) {
  const episodes = await fetchLatestEpisodes();
  if (!episodes.length) return bot.sendMessage(chatId, "❌ No latest episodes found.");

  // Pick the first non-adult episode
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
// Build schedule caption
// =======================
function buildScheduleCaption(schedule) {
  if (!schedule.length) return "❌ No episodes scheduled for today.";

  return schedule
    .map(item => {
      const ep = item.episode_no ? `(Ep. ${item.episode_no})` : "(New)";
      return `<b><blockquote>⬡ ${item.title} ${ep}</blockquote></b>\n‣ Time: ${item.time}`;
    })
    .join("\n\n"); // separate each item with a blank line
}

// =======================
// Send schedule
// =======================
async function sendSchedule(chatId) {
  const schedule = await fetchTodaySchedule();
  const caption = buildScheduleCaption(schedule);

  await bot.sendPhoto(chatId, SCHEDULE_IMAGE, {
    caption,
    parse_mode: "HTML"
  });
}

// =======================
// Serverless handler
// =======================
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const update = req.body;

  if (update.message?.text === "/latest") {
    await sendLatest(update.message.chat.id);
  }

  if (update.message?.text === "/schedule") {
    await sendSchedule(update.message.chat.id);
  }

  return res.status(200).json({ ok: true });
};
