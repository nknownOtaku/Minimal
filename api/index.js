require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

// =======================
// Initialize Bot
// =======================
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

// =======================
// Config (✅ Trimmed trailing spaces!)
// =======================
const API_URL = (process.env.API_URL || "https://anime-api-seven-wheat.vercel.app/api").trim();
const WEBAPP_URL = (process.env.WEBAPP_URL || "https://your-webapp.com").trim();
const BANNER_API = "https://banner-gene.onrender.com/api/create".trim();
const SCHEDULE_IMAGE = "https://i.ibb.co/JW58ghkb/x.jpg".trim();

// ✅ REMOVED the broken top-level await code

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
  
  // ✅ Replaced unsupported <blockquote> with simple formatting
  return `<b>⬡ ${anime.title}
━━━━━━━━━━━━━━━━━━━━━
‣ Japanese : ${anime.japanese_title || "-"}
‣ Episode : ${episodeNum}
‣ Quality : ${quality}
‣ Audio : ${audioLabel}
━━━━━━━━━━━━━━━━━━━━━
⬡ Powered By : @Otaku_Syndicate</b>`;
}

// =======================
// Helper: Send single episode message
// =======================
async function sendEpisodeMessage(chatId, anime, audioType) {
  try {
    const caption = buildCaption(anime, audioType);
    const bannerUrl = `${BANNER_API}?title=${encodeURIComponent(anime.title)}`;
    const streamUrl = `${WEBAPP_URL}/?stream=${encodeURIComponent(anime.id)}&audio=${audioType}`;

    // ✅ Fetch banner dynamically per message (inside async function)
    const bannerRes = await axios.get(bannerUrl, {
      responseType: "arraybuffer",
      timeout: 10000 // 10s timeout
    });

    await bot.sendPhoto(
      chatId,
      {
        source: Buffer.from(bannerRes.data),
        filename: "banner.png"
      },
      {
        caption,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: audioType === "sub" ? "🎬 Watch Sub" : "🎬 Watch Dub",
                web_app: { url: streamUrl } // ✅ Fixed: was 'webAppUrl'
              }
            ]
          ]
        }
      }
    );
  } catch (err) {
    console.error("❌ sendEpisodeMessage error:", err.message);
    // ✅ Fallback: send text-only if image fails
    await bot.sendMessage(chatId, `⚠️ Failed to load banner for ${anime.title}\n\n${buildCaption(anime, audioType)}`, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: audioType === "sub" ? "🎬 Watch Sub" : "🎬 Watch Dub",
              web_app: { url: `${WEBAPP_URL}/?stream=${encodeURIComponent(anime.id)}&audio=${audioType}` }
            }
          ]
        ]
      }
    });
  }
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
      // ✅ Replaced <blockquote> with simple formatting
      return `<b>⬡ ${item.title} ${ep}</b>\n‣ Time: ${item.time}`;
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
// Serverless handler (Vercel)
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