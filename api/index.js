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
// Build caption with audio type
// =======================
function buildCaption(anime, audioType = "sub") {
  const episodeNum = audioType === "sub" 
    ? anime.tvInfo?.sub || "-" 
    : anime.tvInfo?.dub || "-";
    
  const quality = anime.tvInfo?.quality || "HD";
  const audioLabel = audioType === "sub" 
    ? "Japanese [Eng Sub]" 
    : "English Dub";
  
  return `<b><blockquote>⬡ ${anime.title}</blockquote>
╭━━━━━━━━━━━━━━━━━━━━━
‣ Japanese : ${anime.japanese_title || "-"}
‣ Episode : ${episodeNum}
‣ Quality : ${quality}
‣ Audio : ${audioLabel}
╰━━━━━━━━━━━━━━━━━━━━━
<blockquote>⬡ Powered By : @Otaku_Syndicate</blockquote></b>`;
}

// =======================
// Helper: Send single episode message
// =======================
async function sendEpisodeMessage(chatId, anime, audioType) {
  const caption = buildCaption(anime, audioType);
  const bannerUrl = `${BANNER_API}?title=${anime.title}`;
  const streamUrl = `${WEBAPP_URL}/?stream=${encodeURIComponent(anime.id)}&audio=${audioType}`;

  await bot.sendPhoto(chatId, bannerUrl, {
    caption,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: audioType === "sub" ? "🎬 Watch Sub" : "🎬 Watch Dub",
            web_app: { url: streamUrl }
          }
        ]
      ]
    }
  });
}

// =======================
// Send latest episode(s) - Sub AND/OR Dub
// =======================
async function sendLatest(chatId) {
  const episodes = await fetchLatestEpisodes();
  if (!episodes.length) return bot.sendMessage(chatId, "❌ No latest episodes found.");

  const anime = episodes.find(ep => !ep.adultContent);
  if (!anime) return bot.sendMessage(chatId, "❌ No suitable episodes found (all filtered).");

  const hasSub = anime.tvInfo?.sub && anime.tvInfo.sub !== "";
  const hasDub = anime.tvInfo?.dub && anime.tvInfo.dub !== "";

  if (hasSub) {
    await sendEpisodeMessage(chatId, anime, "sub");
  }

  if (hasDub) {
    await new Promise(resolve => setTimeout(resolve, 800)); // Avoid rate limit
    await sendEpisodeMessage(chatId, anime, "dub");
  }

  if (!hasSub && !hasDub) {
    await sendEpisodeMessage(chatId, anime, "sub");
  }
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
    .join("\n\n");
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