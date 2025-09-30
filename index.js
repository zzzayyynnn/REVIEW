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

// CONFIG - Locked sa iyong server
const GUILD_ID = '1397616661024211085';       // Guild ID
const CHANNEL_ID = '1399357204330451045';     // Announcement channel
const MASTER_ROLE_ID = '1421545043214340166'; // Master role na ma-ping

let reviewCounts = {};
let lastMentionTracker = {};

// Load existing counts
if (fs.existsSync('reviewCounts.json')) {
    reviewCounts = JSON.parse(fs.readFileSync('reviewCounts.json', 'utf8'));
}

client.once('ready', () => {
    console.log(`Bot is online as ${client.user.tag}`);
});

// === AUTO COUNT SA MENTION WITH PER-PAIR COOLDOWN ===
client.on('messageCreate', async message => {
    if (!message.guild || message.guild.id !== GUILD_ID) return;
    if (message.author.bot) return;

    if (message.mentions.members.size > 0) {
        message.mentions.members.forEach(member => {
            const targetId = member.id;
            const mentionerId = message.author.id;

            // Per-pair cooldown
            if (lastMentionTracker[targetId] === mentionerId) return;

            lastMentionTracker[targetId] = mentionerId;

            if (!reviewCounts[targetId]) reviewCounts[targetId] = 0;
            reviewCounts[targetId] += 1;

            console.log(`${message.author.username} mentioned ${member.user.username} → counted`);
        });

        fs.writeFileSync('reviewCounts.json', JSON.stringify(reviewCounts, null, 2));
    }
});

// === TEST ANNOUNCEMENT EVERY 2 MINUTES ===
cron.schedule('*/2 * * * *', async () => {
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const channel = await guild.channels.fetch(CHANNEL_ID);
        if (!channel) return console.error('Channel not found in guild!');

        console.log('Posting announcement...');

        const sorted = Object.entries(reviewCounts).sort((a, b) => b[1] - a[1]);
        const top5 = sorted.slice(0, 5);

        let msg = '🏆 *Top Reviewed Today* 🏆\n\n';
        const medals = ['🥇', '🥈', '🥉'];

        for (let i = 0; i < top5.length; i++) {
            const [userId, count] = top5[i];
            const medal = medals[i] || '🔹';
            msg += `${medal} <@${userId}> — ${count} reviews\n`;
        }

        if (sorted.length > 0) {
            msg += '\n📝 *Who Reviewed Today* 📝\n';
            for (const [userId, count] of sorted) {
                msg += `<@${userId}> — ${count} reviews\n`;
            }
        }

        msg += `\n📌 *Note:* Reviews are the basis for promotion, keep helping others.`;
        msg += `\n<@&${MASTER_ROLE_ID}>`;

        await channel.send({ content: msg });

        // Reset counts & cooldown
        reviewCounts = {};
        lastMentionTracker = {};
        fs.writeFileSync('reviewCounts.json', JSON.stringify(reviewCounts, null, 2));

    } catch (err) {
        console.error('Error posting announcement:', err);
    }
}, { timezone: "Asia/Manila" });

// LOGIN
client.login(process.env.BOT_TOKEN);
