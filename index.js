const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Configuration
const OWNER_ID = '1017206528928923648';
const ANNOUNCEMENT_CHANNEL_ID = '1414421793393082461';
const DEV_LOG_CHANNEL_ID = '1414044553312468992';

// Store pending announcements
const pendingAnnouncements = new Map();

// Register slash command
const commands = [
    new SlashCommandBuilder()
        .setName('announcement')
        .setDescription('Create a multilingual announcement (Owner Only)')
        .addStringOption(option =>
            option.setName('title_en')
                .setDescription('Announcement title in English')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description_en')
                .setDescription('Announcement description in English')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('title_de')
                .setDescription('Announcement title in German')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description_de')
                .setDescription('Announcement description in German')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('title_fr')
                .setDescription('Announcement title in French')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description_fr')
                .setDescription('Announcement description in French')
                .setRequired(true))
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
    try {
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log('✅ Announcement command registered successfully');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
}

// Bot ready event
client.once('ready', () => {
    console.log(`🤖 Announcement Bot is ready!`);
    console.log(`📝 Logged in as ${client.user.tag}`);
    client.user.setPresence({
        activities: [{ name: '📢 Managing Announcements', type: 4 }],
        status: 'online'
    });
});

// Create translation buttons
function createTranslationButtons() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('translate_en')
                .setLabel('English')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🇺🇸'),
            new ButtonBuilder()
                .setCustomId('translate_de')
                .setLabel('Deutsch')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🇩🇪'),
            new ButtonBuilder()
                .setCustomId('translate_fr')
                .setLabel('Français')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🇫🇷')
        );
}

// Create confirmation buttons
function createConfirmationButtons(announcementId) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_${announcementId}`)
                .setLabel('Confirm & Send with @everyone')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId(`cancel_${announcementId}`)
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌')
        );
}

// Create announcement embed
function createAnnouncementEmbed(data, language = 'en') {
    const embed = new EmbedBuilder()
        .set

// Log announcements to dev channel
async function logAnnouncement(user, action, announcementData) {
    const devChannel = client.channels.cache.get(DEV_LOG_CHANNEL_ID);
    if (devChannel) {
        const logEmbed = new EmbedBuilder()
            .setColor(action === 'created' ? '#4ECDC4' : action === 'sent' ? '#00FF00' : '#FF0000')
            .setTitle(`📢 Announcement ${action.charAt(0).toUpperCase() + action.slice(1)}`)
            .addFields(
                { name: '👤 User', value: user.username, inline: true },
                { name: '🔔 Action', value: action, inline: true },
                { name: '📝 Title (EN)', value: announcementData.title_en || 'N/A', inline: false }
            )
            .setTimestamp();
        
        devChannel.send({ embeds: [logEmbed] }).catch(() => {});
    }
}

// Log translation requests
async function logTranslation(user, language) {
    const devChannel = client.channels.cache.get(DEV_LOG_CHANNEL_ID);
    if (devChannel) {
        const logEmbed = new EmbedBuilder()
            .setColor('#FFE66D')
            .setTitle('🌍 Announcement Translation Sent')
            .addFields(
                { name: '👤 User', value: user.username, inline: true },
                { name: '🔤 Language', value: language === 'en' ? 'English' : language === 'de' ? 'German' : 'French', inline: true },
                { name: '📨 Sent To', value: `DM: ${user.username}`, inline: true }
            )
            .setTimestamp();
        
        devChannel.send({ embeds: [logEmbed] }).catch(() => {});
    }
}

// Handle interactions
client.on('interactionCreate', async (interaction) => {
    // Handle slash command
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'announcement') {
            // Check if user is owner
            if (interaction.user.id !== OWNER_ID) {
                await interaction.reply({ 
                    content: '❌ You do not have permission to use this command.', 
                    ephemeral: true 
                }).catch(() => {});
                return;
            }

            // Collect announcement data
            const announcementData = {
                title_en: interaction.options.getString('title_en'),
                description_en: interaction.options.getString('description_en'),
                title_de: interaction.options.getString('title_de'),
                description_de: interaction.options.getString('description_de'),
                title_fr: interaction.options.getString('title_fr'),
                description_fr: interaction.options.getString('description_fr')
            };

            // Generate unique ID for this announcement
            const announcementId = Date.now().toString();
            pendingAnnouncements.set(announcementId, announcementData);

            // Create preview embed
            const previewEmbed = createAnnouncementEmbed(announcementData, 'en');
            const translationButtons = createTranslationButtons();
            const confirmButtons = createConfirmationButtons(announcementId);

            // Send preview with confirmation buttons
            await interaction.reply({
                content: '📋 **Announcement Preview** (No ping yet - click buttons to preview translations)',
                embeds: [previewEmbed],
                components: [translationButtons, confirmButtons]
            }).catch(() => {});

            // Log creation
            logAnnouncement(interaction.user, 'created', announcementData);
        }
    }

    // Handle button interactions
    if (interaction.isButton()) {
        // Translation buttons
        if (interaction.customId.startsWith('translate_')) {
            const language = interaction.customId.split('_')[1];
            
            await interaction.reply({ 
                content: '✅ Check your DMs for the translation!', 
                ephemeral: true 
            }).catch(() => {});

            // Find the announcement data from the message
            let embedToSend;
            for (const [id, data] of pendingAnnouncements.entries()) {
                embedToSend = createAnnouncementEmbed(data, language);
                break;
            }

            // Send translation to user's DM
            if (embedToSend) {
                try {
                    await interaction.user.send({ embeds: [embedToSend] });
                    logTranslation(interaction.user, language);
                } catch (error) {
                    console.log('❌ Could not send DM to user');
                }
            }
        }

        // Confirm button
        if (interaction.customId.startsWith('confirm_')) {
            if (interaction.user.id !== OWNER_ID) {
                await interaction.reply({ 
                    content: '❌ Only the owner can confirm announcements.', 
                    ephemeral: true 
                }).catch(() => {});
                return;
            }

            const announcementId = interaction.customId.split('_')[1];
            const announcementData = pendingAnnouncements.get(announcementId);
            
            if (announcementData) {
                const announcementChannel = client.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
                
                if (announcementChannel) {
                    const translationButtons = createTranslationButtons();
                    
                    // Format the announcement text with spoilered pings at bottom
                    const announcementText = `${announcementData.description_en}\n\n||@everyone||`;
                    
                    // Send announcement with buttons, no embed
                    await announcementChannel.send({
                        content: announcementText,
                        components: [translationButtons],
                        allowedMentions: { parse: ['everyone'] }
                    }).catch(() => {});
                    
                    // Update the preview message
                    await interaction.update({
                        content: '✅ **Announcement sent successfully!**',
                        embeds: [],
                        components: []
                    }).catch(() => {});
                    
                    // Log the sent announcement
                    logAnnouncement(interaction.user, 'sent', announcementData);
                    
                    // Clean up
                    pendingAnnouncements.delete(announcementId);
                }
            }
        }

        // Cancel button
        if (interaction.customId.startsWith('cancel_')) {
            if (interaction.user.id !== OWNER_ID) {
                await interaction.reply({ 
                    content: '❌ Only the owner can cancel announcements.', 
                    ephemeral: true 
                }).catch(() => {});
                return;
            }

            const announcementId = interaction.customId.split('_')[1];
            const announcementData = pendingAnnouncements.get(announcementId);
            pendingAnnouncements.delete(announcementId);
            
            await interaction.update({
                content: '❌ **Announcement cancelled.**',
                embeds: [],
                components: []
            }).catch(() => {});

            // Log cancellation
            if (announcementData) {
                logAnnouncement(interaction.user, 'cancelled', announcementData);
            }
        }
    }
});

// Register commands and login
registerCommands().then(() => {
    client.login(process.env.DISCORD_TOKEN);
}).catch(console.error);
