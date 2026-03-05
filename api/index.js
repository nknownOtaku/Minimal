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
const ADMIN_IDS = process.env.ADMIN_IDS?.split(",").map(id => parseInt(id.trim())) || [];

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
// Fetch episodes list for an anime
// =======================
async function fetchEpisodesList(animeId) {
  try {
    const res = await axios.get(`${API_URL}/episodes/${animeId}`);
    return res.data?.results?.episodes || [];
  } catch (err) {
    console.error(`❌ Episodes fetch error for ${animeId}:`, err.message);
    return [];
  }
}

// =======================
// Get latest episode object by episode number
// =======================
function getLatestEpisode(episodes) {
  if (!episodes?.length) return null;
  return episodes.reduce((max, ep) => 
    (ep.episode_no > max.episode_no) ? ep : max
  );
}

// =======================
// Build caption with audio type + 18+ badge
// =======================
function buildCaption(anime, audioType = "sub") {
  const episodeNum = audioType === "sub" 
    ? anime.tvInfo?.sub || "-" 
    : anime.tvInfo?.dub || "-";
    
  const quality = anime.tvInfo?.quality || "HD";
  const audioLabel = audioType === "sub" 
    ? "Japanese [Eng Sub]" 
    : "English Dub";
  
  const adultBadge = anime.adultContent ? " 🔞" : "";
  
  return `<b><blockquote>⬡ ${anime.title}${adultBadge}</blockquote>
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
  const bannerUrl = `${BANNER_API}?title=${encodeURIComponent(anime.title)}`;
  
  // ✅ Fetch episodes list to get the FULL episode ID (with ?ep=xxx)
  const episodeList = await fetchEpisodesList(anime.id);
  const latestEp = getLatestEpisode(episodeList);
  
  // ✅ Use the FULL episode ID as the stream param
  // Example: "anime-id?ep=167848"
  const episodeId = latestEp?.id || `${anime.id}?ep=1`;
  
  // ✅ Build WebApp URL: stream param contains the full episode ID (URL-encoded)
  const webAppUrl = `${WEBAPP_URL}/?stream=${encodeURIComponent(episodeId)}`;

  await bot.sendPhoto(chatId, bannerUrl, {
    caption,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: audioType === "sub" ? "🎬 Watch Sub" : "🎬 Watch Dub",
            web_app: { url: webAppUrl }
          }
        ]
      ]
    }
  });
}

// =======================
// Send latest episode(s) - Sub AND/OR Dub (18+ allowed)
// =======================
async function sendLatest(chatId) {
  const episodes = await fetchLatestEpisodes();
  if (!episodes.length) return bot.sendMessage(chatId, "❌ No latest episodes found.");

  // ✅ Pick first episode (adult content allowed)
  const anime = episodes[0];

  const hasSub = anime.tvInfo?.sub && anime.tvInfo.sub !== "";
  const hasDub = anime.tvInfo?.dub && anime.tvInfo.dub !== "";

  if (hasSub) {
    await sendEpisodeMessage(chatId, anime, "sub");
  }

  if (hasDub) {
    // Small delay to avoid Telegram rate limits
    await new Promise(resolve => setTimeout(resolve, 800));
    await sendEpisodeMessage(chatId, anime, "dub");
  }

  // Fallback if neither sub nor dub exists
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
// Build schedule caption (Time + Name + EP)
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
// Serverless handler (Vercel)
// =======================
module.exports = async (req, res) => {
  // Log incoming request for debugging
  console.log("📩 Webhook received:", req.method, req.body?.message?.text);

  if (req.method !== "POST") {
    console.log("❌ Method not allowed:", req.method);
    return res.status(405).send("Method not allowed");
  }

  try {
    const update = req.body;
    const chatId = update.message?.chat.id;
    const text = update.message?.text;
    const userId = update.message?.from?.id;
    const isAdmin = ADMIN_IDS.includes(userId);

    if (!chatId) {
      console.log("⚠️ No chatId in update");
      return res.status(200).json({ ok: true });
    }

    console.log(`👤 User ${chatId} sent: "${text}"`);

    // ✅ Handle /latest command
    if (text === "/latest") {
      console.log("🎬 Processing /latest");
      await sendLatest(chatId);
    }

    // ✅ Optional: Admin-only 18+ override (if you want filtering by default)
    if (text === "/latest18+") {
      if (!isAdmin) {
        return bot.sendMessage(chatId, "🔐 Admins only.");
      }
      console.log("🔞 Processing /latest18+ (admin)");
      await sendLatest(chatId);
    }

    // ✅ Handle /schedule command
    if (text === "/schedule" || text === "/today") {
      console.log("📅 Processing /schedule");
      await sendSchedule(chatId);
    }

    // ✅ Optional: Help command
    if (text === "/start" || text === "/help") {
      await bot.sendMessage(chatId, 
        "🎬 <b>Otaku Syndicate Bot</b>\n\n" +
        "Available commands:\n" +
        "• /latest — Get latest episode(s)\n" +
        "• /schedule — Today's airing schedule\n" +
        "• /latest18+ — Include adult content (admins only)\n\n" +
        "<blockquote>⬡ Powered By : @Otaku_Syndicate</blockquote>",
        { parse_mode: "HTML" }
      );
    }

    return res.status(200).json({ ok: true });
    
  } catch (err) {
    console.error("💥 Handler error:", err.message, err.stack);
    return res.status(500).json({ ok: false, error: err.message });
  }
};