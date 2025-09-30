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

// CONFIG - Locked to specific guild & channel
const GUILD_ID = '868686126561505280';
const CHANNEL_ID = '868686126561505282';
const MASTER_ROLE_ID = '123456789012345678';

let reviewCounts = {};
let lastMentionTracker = {};

// Load existing counts
if (fs.existsSync('reviewCounts.json')) {
    reviewCounts = JSON.parse(fs.readFileSync('reviewCounts.json', 'utf8'));
}

client.once('ready', async () => {
    console.log(`Bot is online as ${client.user.tag}`);

    // List connected guilds and channels for debug
    console.log('Connected guilds and channels:');
    client.guilds.cache.forEach(guild => {
        console.log(`${guild.name} (ID: ${guild.id})`);
        guild.channels.cache.forEach(channel => {
            console.log(`- ${channel.name} (ID: ${channel.id})`);
        });
    });
});

// === AUTO COUNT SA MENTION WITH PER-PAIR COOLDOWN ===
client.on('messageCreate', async message => {
    // Restrict to specific guild
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

// === TEST ANNOUNCEMENT EVERY 1 MINUTE ===
cron.schedule('*/1 * * * *', async () => {
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const channel = guild.channels.cache.get(CHANNEL_ID);
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

        // Reset counts and cooldown
        reviewCounts = {};
        lastMentionTracker = {};
        fs.writeFileSync('reviewCounts.json', JSON.stringify(reviewCounts, null, 2));

    } catch (err) {
        console.error('Error posting announcement:', err);
    }
}, { timezone: "Asia/Manila" });

// Login
client.login(process.env.BOT_TOKEN);
