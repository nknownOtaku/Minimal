require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

// Initialize bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

// Hardcoded API URL
const API_URL = "https://anime-api-seven-wheat.vercel.app/api";
const WEBAPP_URL = process.env.WEBAPP_URL || "https://your-webapp.com";
const BANNER_API = "https://banner-gene.onrender.com/api/create";

// =======================
// Fetch the latest anime
// =======================
async function fetchLatestAnime() {
  try {
    const res = await axios.get(API_URL);
    const spotlights = res.data?.results?.spotlights || [];
    return spotlights[0]; // first latest
  } catch (err) {
    console.error("❌ API fetch error:", err.message);
    return null;
  }
}

// =======================
// Build caption
// =======================
function buildCaption(anime, type) {
  const epNo = anime.tvInfo?.episodeInfo?.[type] || "N/A";
  const audio = type === "dub" ? "English Dub" : "Japanese [Eng Sub]";
  return `<b><blockquote>⬡ ${anime.title}</blockquote>
╭━━━━━━━━━━━━━━━━━━━━━
‣ Japanese : ${anime.japanese_title || "-"}
‣ Episode : ${epNo}
‣ Quality : ${anime.tvInfo?.quality || "HD"}
‣ Audio : ${audio}
╰━━━━━━━━━━━━━━━━━━━━━
<blockquote>⬡ Powered By : @Otaku_Syndicate</blockquote></b>`;
}

// =======================
// Send latest to user
// =======================
async function sendLatest(chatId) {
  const anime = await fetchLatestAnime();
  if (!anime) return bot.sendMessage(chatId, "❌ Failed to fetch latest anime.");

  const types = [];
  if (anime.tvInfo?.episodeInfo?.sub) types.push("sub");
  if (anime.tvInfo?.episodeInfo?.dub) types.push("dub");

  for (const type of types) {
    const caption = buildCaption(anime, type);
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
                url: `${WEBAPP_URL}/?stream=${anime.id}&type=${type}`
              }
            }
          ]
        ]
      }
    });
  }
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
