import { Client, GatewayIntentBits, Partials } from "discord.js";
import fs from "fs";
import cron from "node-cron";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// Config
const CHANNEL_ID = "1399357204330451045"; // Announcement channel
const MASTER_ROLE_ID = "1421545043214340166"; // Master role ID
let mentionCounts = {};

// Load data kung meron
if (fs.existsSync("reviewCounts.json")) {
  mentionCounts = JSON.parse(fs.readFileSync("reviewCounts.json", "utf8"));
}

// Prefix
const PREFIX = "!";

// Ready event
client.once("ready", () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
});

// Detect mentions
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  // kapag may na-mention
  if (message.mentions.users.size > 0) {
    message.mentions.users.forEach((user) => {
      if (!mentionCounts[user.id]) mentionCounts[user.id] = 0;
      mentionCounts[user.id] += 1;
    });

    fs.writeFileSync("reviewCounts.json", JSON.stringify(mentionCounts, null, 2));
  }

  // commands
  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // !mentions
  if (command === "mentions") {
    if (args[0]) {
      const member = message.mentions.users.first();
      if (!member) return message.reply("⚠️ Please mention a user.");
      const count = mentionCounts[member.id] || 0;
      return message.reply(`📊 ${member.username} has **${count}** mentions.`);
    } else {
      // show all
      if (Object.keys(mentionCounts).length === 0)
        return message.reply("ℹ️ No mentions recorded yet.");

      let msg = "📊 **Current Mention Counts** 📊\n\n";
      for (const [userId, count] of Object.entries(mentionCounts)) {
        const user = await client.users.fetch(userId);
        msg += `👤 ${user.username} — ${count} mentions\n`;
      }
      return message.reply(msg);
    }
  }
});

// Leaderboard every 5 minutes (test mode)
cron.schedule(
  "*/5 * * * *",
  async () => {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) return console.error("Channel not found!");

    if (Object.keys(mentionCounts).length === 0) {
      await channel.send("ℹ️ No mentions recorded in this round.");
      return;
    }

    const sorted = Object.entries(mentionCounts).sort((a, b) => b[1] - a[1]);
    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5);

    let msg = "🏆 **Top Mentioned Users (Last 5 mins)** 🏆\n\n";
    const medals = ["🥇", "🥈", "🥉"];

    for (let i = 0; i < top5.length; i++) {
      const [userId, count] = top5[i];
      const user = await client.users.fetch(userId);
      const medal = medals[i] || "🔹";
      msg += `${medal} ${user.username} — ${count} mentions\n`;
    }

    if (others.length > 0) {
      msg += "\n📝 **Others** 📝\n";
      for (const [userId, count] of others) {
        const user = await client.users.fetch(userId);
        msg += `${user.username} — ${count} mentions\n`;
      }
    }

    msg += `\n📌 *Mentions are tracked automatically. Keep being active!* <@&${MASTER_ROLE_ID}>`;

    await channel.send(msg);

    // Reset counts after report
    mentionCounts = {};
    fs.writeFileSync("reviewCounts.json", JSON.stringify(mentionCounts, null, 2));
  },
  { timezone: "Asia/Manila" }
);

// Run bot
client.login(process.env.BOT_TOKEN);
