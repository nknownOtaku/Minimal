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
    return res.data?.latestEpisode || [];
  } catch (err) {
    console.error("❌ API fetch error:", err.message);
    return [];
  }
}

// =======================
// Build caption
// =======================
function buildCaption(anime) {
  return `<b><blockquote>⬡ ${anime.title}</blockquote>
╭━━━━━━━━━━━━━━━━━━━━━
‣ Japanese : ${anime.japanese_title || "-"}
‣ Episode : ${anime.tvInfo?.sub || "-"}
‣ Quality : ${anime.tvInfo?.quality || "HD"}
‣ Type : ${anime.tvInfo?.showType || "TV/ONA"}
╰━━━━━━━━━━━━━━━━━━━━━
<blockquote>⬡ Powered By : @Otaku_Syndicate</blockquote></b>`;
}

// =======================
// Send latest to user (first episode only)
// =======================
async function sendLatest(chatId) {
  const episodes = await fetchLatestEpisodes();
  if (!episodes.length) return bot.sendMessage(chatId, "❌ No latest episodes found.");

  // Pick only the first episode
  const anime = episodes[0];

  // Skip adult content
  if (anime.adultContent) return bot.sendMessage(chatId, "❌ Latest episode is adult content.");

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
            web_app: {
              url: `${WEBAPP_URL}/?stream=${anime.id}`
            }
          }
        ]
      ]
    }
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

  return res.status(200).json({ ok: true });
};
