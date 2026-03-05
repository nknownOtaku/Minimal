require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

// Initialize bot WITHOUT polling (webhook mode)
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

const BASE_API = "https://anime-api-seven-wheat.vercel.app/api";

// =============================
// Helper Functions
// =============================

async function getLatestAnimeSlug() {
    const res = await axios.get(`${BASE_API}/`);
    return res.data.latestEpisode[0].id;
}

async function getLatestEpisode(slug) {
    const res = await axios.get(`${BASE_API}/episodes/${slug}`);
    const episodes = res.data.results.episodes;
    return episodes[episodes.length - 1];
}

async function getAvailableTypes(epId) {
    const res = await axios.get(`${BASE_API}/servers/${epId}`);
    const servers = res.data.results;
    return [...new Set(servers.map(s => s.type))];
}

// =============================
// /latest Command
// =============================

async function handleLatest(chatId) {
    try {
        await bot.sendMessage(chatId, "🔎 Fetching latest release...");

        const slug = await getLatestAnimeSlug();
        const episode = await getLatestEpisode(slug);
        const types = await getAvailableTypes(episode.id);

        const cleanTitle = slug
            .replace(/-\d+$/, "")
            .replace(/-/g, " ")
            .replace(/\b\w/g, l => l.toUpperCase());

        const seasonMatch = slug.match(/season-(\d+)/i);
        const season = seasonMatch ? seasonMatch[1] : "01";
        const bannerUrl =
            `https://banner-gene.onrender.com/api/create?title=${encodeURIComponent(cleanTitle)}`;

        for (const type of types) {
            const audioText =
                type === "dub"
                    ? "English Dub"
                    : "Japanese [Eng Sub]";

            const caption = `
<b><blockquote>⬡ ${cleanTitle}</blockquote>
╭━━━━━━━━━━━━━━━━━━━━━
‣ Season : ${season.padStart(2, "0")}
‣ Episode : ${String(episode.episode_no).padStart(2, "0")}
‣ Quality : Multi
‣ Audio : ${audioText}
╰━━━━━━━━━━━━━━━━━━━━━
<blockquote>⬡ Powered By : @Otaku_Syndicate</blockquote></b>
`;

            await bot.sendPhoto(chatId, bannerUrl, {
                caption,
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "🎬 Watch Now",
                                web_app: {
                                    url: `${process.env.WEBAPP_URL}/?stream=${episode.id}&type=${type}`
                                }
                            }
                        ]
                    ]
                }
            });
        }
    } catch (err) {
        console.error(err.message);
        bot.sendMessage(chatId, "❌ Failed to fetch latest release.");
    }
}

// =============================
// Vercel Serverless Handler
// =============================

module.exports = async (req, res) => {
    // Only accept POST from Telegram
    if (req.method !== "POST") {        return res.status(405).send("Method not allowed");
    }

    const update = req.body;

    // Handle /latest command
    if (update.message?.text === "/latest") {
        await handleLatest(update.message.chat.id);
    }

    // Always respond OK to Telegram
    return res.status(200).json({ ok: true });
};
