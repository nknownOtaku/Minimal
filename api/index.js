require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

// Initialize bot without polling (webhook mode)
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

const BASE_API = "https://anime-api-seven-wheat.vercel.app/api";

// =============================
// Helper Functions
// =============================

async function getLatestAnimeSlug() {
    try {
        const res = await axios.get(`${BASE_API}/`);
        if (!res.data.latestEpisode || res.data.latestEpisode.length === 0) {
            throw new Error("No latest episode found");
        }
        const latest = res.data.latestEpisode[0];
        if (!latest.id) throw new Error("No slug/id found in latest episode");
        return latest.id;
    } catch (err) {
        console.error("❌ getLatestAnimeSlug error:", err.message);
        throw err;
    }
}

async function getLatestEpisode(slug) {
    try {
        const res = await axios.get(`${BASE_API}/episodes/${slug}`);
        const episodes = res.data.results?.episodes;
        if (!episodes || episodes.length === 0) {
            throw new Error(`No episodes found for ${slug}`);
        }
        return episodes[episodes.length - 1]; // last episode
    } catch (err) {
        console.error("❌ getLatestEpisode error:", err.message);
        throw err;
    }
}

async function getAvailableTypes(epId) {
    try {
        const res = await axios.get(`${BASE_API}/servers/${epId}`);
        const servers = res.data.results;
        if (!servers || servers.length === 0) return [];
        return [...new Set(servers.map(s => s.type))];
    } catch (err) {
        console.error("❌ getAvailableTypes error:", err.message);
        return [];
    }
}

// =============================
// Handle /latest
// =============================

async function handleLatest(chatId) {
    try {
        await bot.sendMessage(chatId, "🔎 Fetching latest release...");

        const slug = await getLatestAnimeSlug();
        const episode = await getLatestEpisode(slug);
        const types = await getAvailableTypes(episode.id);

        if (types.length === 0) {
            return bot.sendMessage(chatId, "❌ No servers available for latest episode.");
        }

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
        console.error("❌ handleLatest error:", err.message);
        bot.sendMessage(chatId, "❌ Failed to fetch latest release.");
    }
}

// =============================
// Serverless Handler
// =============================

module.exports = async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("Method not allowed");

    const update = req.body;

    if (update.message?.text === "/latest") {
        await handleLatest(update.message.chat.id);
    }

    return res.status(200).json({ ok: true });
};

console.log("🤖 Serverless Latest Bot ready!");
