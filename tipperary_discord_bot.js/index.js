import { Client, GatewayIntentBits, ActivityType } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setActivity("It's A Long Way To Tipperary", { type: ActivityType.Playing });
});

client.login(process.env.TOKEN);
