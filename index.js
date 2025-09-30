import { Client, GatewayIntentBits, Partials } from 'discord.js';
import fs from 'fs';
import cron from 'node-cron';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel]
});

// CONFIG
const CHANNEL_ID = '1399357204330451045'; // Announcement channel
const MASTER_ROLE_ID = '1421545043214340166'; // Master role ID
let reviewCounts = {};
let lastMentionTracker = {}; // Track last user who mentioned each target

// Load existing counts from file
if (fs.existsSync('reviewCounts.json')) {
    reviewCounts = JSON.parse(fs.readFileSync('reviewCounts.json', 'utf8'));
}

client.once('ready', () => {
    console.log(`Bot is online as ${client.user.tag}`);
});

// === AUTO COUNT SA MENTION SA SPECIFIC CHANNEL LANG WITH PER-PAIR COOLDOWN ===
client.on('messageCreate', async message => {
    if (!message.guild || message.author.bot) return;

    // Only count mentions in the announcement channel
    if (message.channel.id !== CHANNEL_ID) return;

    if (message.mentions.members.size > 0) {
        message.mentions.members.forEach(member => {
            const targetId = member.id;
            const mentionerId = message.author.id;

            // Check per-pair cooldown
            if (lastMentionTracker[targetId] === mentionerId) return;

            // Update tracker
            lastMentionTracker[targetId] = mentionerId;

            // Add review count
            if (!reviewCounts[targetId]) reviewCounts[targetId] = 0;
            reviewCounts[targetId] += 1;

            console.log(`${message.author.username} mentioned ${member.user.username} → counted`);
        });

        // Save counts
        fs.writeFileSync('reviewCounts.json', JSON.stringify(reviewCounts, null, 2));
    }
});

// === ANNOUNCEMENT EVERY 2 MINUTES (FOR TEST, PWEDE ICHANGE SA DAILY) ===
cron.schedule('*/2 * * * *', async () => {
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (!channel) return console.error('Channel not found!');

        console.log('Posting announcement...');

        const sorted = Object.entries(reviewCounts).sort((a, b) => b[1] - a[1]);
        const top5 = sorted.slice(0, 5);

        let msg = '**🏆 Top Reviewed Today 🏆**\n\n';
        const medals = ['🥇', '🥈', '🥉'];

        // Top 5 section
        for (let i = 0; i < top5.length; i++) {
            const [userId, count] = top5[i];
            const medal = medals[i] || '🔹';
            msg += `${medal} <@${userId}> — ${count} reviews\n`;
        }

        // Full list (Who Reviewed Today)
        if (sorted.length > 0) {
            msg += '\n**📝 Who Reviewed Today 📝**\n';
            for (const [userId, count] of sorted) {
                msg += `<@${userId}> — ${count} reviews\n`;
            }
        }

        msg += '\n📌 *Note:* Reviews are the basis for promotion, so keep it up by assisting with tickets and helping others.';
        msg += `\n<@&${MASTER_ROLE_ID}>`;

        await channel.send({ content: msg });

        // Reset counts and cooldown tracker after announcement
        reviewCounts = {};
        lastMentionTracker = {};
        fs.writeFileSync('reviewCounts.json', JSON.stringify(reviewCounts, null, 2));

    } catch (err) {
        console.error('Error posting announcement:', err);
    }
}, { timezone: "Asia/Manila" });

// Login using BOT_TOKEN from environment variable
client.login(process.env.BOT_TOKEN);
