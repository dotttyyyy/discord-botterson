// ===== tipperary-bot/index.js =====
import { Client, GatewayIntentBits, ActivityType } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setActivity("It's A Long Way To Tipperary", { type: ActivityType.Playing });
});

client.login(process.env.TOKEN);


// ===== tipperary-bot/package.json =====
{
  "name": "tipperary-bot",
  "version": "1.0.0",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "discord.js": "^14.15.1"
  }
}

// No .env file needed; use Railway Environment Variables
