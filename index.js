import { Client, GatewayIntentBits } from "discord.js";
import cron from "node-cron";
import fs from "fs";

// ===== CONFIG =====
const token = process.env.BOT_TOKEN; // Environment variable sa Render
const serverId = "1397616661024211085"; // Server ID
const channelId = "1399357204330451045"; // Channel ID
const masterRoleId = "1421545043214340166"; // Role ID
const reviewsFile = "reviewcounts.json";

// ===== DISCORD CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Load data file
let reviewData = {};
if (fs.existsSync(reviewsFile)) {
  reviewData = JSON.parse(fs.readFileSync(reviewsFile));
} else {
  reviewData = { reviews: 0 };
  fs.writeFileSync(reviewsFile, JSON.stringify(reviewData, null, 2));
}

// ===== BOT READY =====
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ===== TEST CRON JOB (Every 1 Minute) =====
cron.schedule("* * * * *", async () => {
  try {
    const guild = await client.guilds.fetch(serverId);
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return console.log("❌ Channel not found.");

    // Load review count again
    reviewData = JSON.parse(fs.readFileSync(reviewsFile));

    await channel.send(
      `📢 TEST ANNOUNCEMENT!\nSo far we have **${reviewData.reviews} reviews**.\nRole to mention: <@&${masterRoleId}>`
    );

    console.log("✅ Test announcement sent.");
  } catch (err) {
    console.error("❌ Error in cron job:", err);
  }
});

// ===== BOT LOGIN =====
client.login(token);
