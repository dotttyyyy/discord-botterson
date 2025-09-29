const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Configuration
const OWNER_ID = '1017206528928923648';
const ANNOUNCEMENT_CHANNEL_ID = '1414421793393082461';
const DEV_LOG_CHANNEL_ID = '1414044553312468992';

// Store announcements with message IDs as keys
const announcementsByMessageId = new Map();

// Register slash command (simplified - just opens modal)
const commands = [
    new SlashCommandBuilder()
        .setName('announcement')
        .setDescription('Create a multilingual announcement (Owner Only)')
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
    try {
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log('Announcement command registered successfully');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

// Bot ready event
client.once('ready', () => {
    console.log(`Announcement Bot is ready!`);
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setPresence({
        activities: [{ name: 'Managing Announcements', type: 4 }],
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
                .setLabel('Confirm & Send')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId(`cancel_${announcementId}`)
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌')
        );
}

// Log announcements to dev channel
async function logAnnouncement(user, action) {
    const devChannel = client.channels.cache.get(DEV_LOG_CHANNEL_ID);
    if (devChannel) {
        const logEmbed = new EmbedBuilder()
            .setColor(action === 'created' ? '#4ECDC4' : action === 'sent' ? '#00FF00' : '#FF0000')
            .setTitle(`Announcement ${action.charAt(0).toUpperCase() + action.slice(1)}`)
            .addFields(
                { name: 'User', value: user.username, inline: true },
                { name: 'Action', value: action, inline: true }
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
            .setTitle('Translation Sent')
            .addFields(
                { name: 'User', value: user.username, inline: true },
                { name: 'Language', value: language === 'en' ? 'English' : language === 'de' ? 'German' : 'French', inline: true }
            )
            .setTimestamp();
        
        devChannel.send({ embeds: [logEmbed] }).catch(() => {});
    }
}

// Handle interactions
client.on('interactionCreate', async (interaction) => {
    // Handle slash command - show modal
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'announcement') {
            // Check if user is owner
            if (interaction.user.id !== OWNER_ID) {
                await interaction.reply({ 
                    content: 'You do not have permission to use this command.', 
                    ephemeral: true 
                }).catch(() => {});
                return;
            }

            // Create modal with text inputs that preserve formatting
            const modal = new ModalBuilder()
                .setCustomId('announcement_modal')
                .setTitle('Create Announcement');

            const englishInput = new TextInputBuilder()
                .setCustomId('description_en')
                .setLabel('English Announcement')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Paste your formatted announcement here...')
                .setRequired(true);

            const germanInput = new TextInputBuilder()
                .setCustomId('description_de')
                .setLabel('German Announcement')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Paste German version here...')
                .setRequired(true);

            const frenchInput = new TextInputBuilder()
                .setCustomId('description_fr')
                .setLabel('French Announcement')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Paste French version here...')
                .setRequired(true);

            const pingInput = new TextInputBuilder()
                .setCustomId('ping_type')
                .setLabel('Ping Type')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Type: everyone, here, or none')
                .setRequired(true)
                .setMaxLength(10);

            const row1 = new ActionRowBuilder().addComponents(englishInput);
            const row2 = new ActionRowBuilder().addComponents(germanInput);
            const row3 = new ActionRowBuilder().addComponents(frenchInput);
            const row4 = new ActionRowBuilder().addComponents(pingInput);

            modal.addComponents(row1, row2, row3, row4);

            await interaction.showModal(modal);
        }
    }

    // Handle modal submission
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'announcement_modal') {
            // Get the formatted text (preserves line breaks)
            const announcementData = {
                description_en: interaction.fields.getTextInputValue('description_en'),
                description_de: interaction.fields.getTextInputValue('description_de'),
                description_fr: interaction.fields.getTextInputValue('description_fr'),
                ping_type: interaction.fields.getTextInputValue('ping_type').toLowerCase().trim()
            };

            // Validate ping type
            if (!['everyone', 'here', 'none'].includes(announcementData.ping_type)) {
                await interaction.reply({
                    content: 'Invalid ping type. Use: everyone, here, or none',
                    ephemeral: true
                }).catch(() => {});
                return;
            }

            // Generate unique ID
            const announcementId = Date.now().toString();

            const translationButtons = createTranslationButtons();
            const confirmButtons = createConfirmationButtons(announcementId);

            // Show ping in preview
            let pingText = '';
            if (announcementData.ping_type === 'everyone') {
                pingText = '\n\n||@everyone||';
            } else if (announcementData.ping_type === 'here') {
                pingText = '\n\n||@here||';
            }

            // Send preview
            const previewMessage = await interaction.reply({
                content: `**Announcement Preview:**\n\n${announcementData.description_en}${pingText}`,
                components: [translationButtons, confirmButtons],
                fetchReply: true
            }).catch(() => {});

            // Store with message ID
            if (previewMessage) {
                announcementsByMessageId.set(previewMessage.id, {
                    ...announcementData,
                    id: announcementId
                });
            }

            logAnnouncement(interaction.user, 'created');
        }
    }

    // Handle button interactions
    if (interaction.isButton()) {
        // Translation buttons
        if (interaction.customId.startsWith('translate_')) {
            const language = interaction.customId.split('_')[1];
            
            const messageId = interaction.message.id;
            const announcementData = announcementsByMessageId.get(messageId);

            if (!announcementData) {
                await interaction.reply({ 
                    content: 'Could not find announcement data.', 
                    ephemeral: true 
                }).catch(() => {});
                return;
            }

            await interaction.reply({ 
                content: 'Check your DMs!', 
                ephemeral: true 
            }).catch(() => {});

            // Get correct translation
            let translationText = '';
            if (language === 'en') {
                translationText = announcementData.description_en;
            } else if (language === 'de') {
                translationText = announcementData.description_de;
            } else if (language === 'fr') {
                translationText = announcementData.description_fr;
            }

            // Send as plain text
            if (translationText) {
                try {
                    await interaction.user.send(translationText);
                    logTranslation(interaction.user, language);
                } catch (error) {
                    console.log('Could not send DM');
                }
            }
        }

        // Confirm button
        if (interaction.customId.startsWith('confirm_')) {
            if (interaction.user.id !== OWNER_ID) {
                await interaction.reply({ 
                    content: 'Only owner can confirm.', 
                    ephemeral: true 
                }).catch(() => {});
                return;
            }

            const previewMessageId = interaction.message.id;
            const announcementData = announcementsByMessageId.get(previewMessageId);
            
            if (announcementData) {
                const announcementChannel = client.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
                
                if (announcementChannel) {
                    const translationButtons = createTranslationButtons();
                    
                    // Build final content
                    let finalContent = announcementData.description_en;
                    
                    if (announcementData.ping_type === 'everyone') {
                        finalContent += '\n\n||@everyone||';
                    } else if (announcementData.ping_type === 'here') {
                        finalContent += '\n\n||@here||';
                    }
                    
                    // Send announcement
                    const sentMessage = await announcementChannel.send({
                        content: finalContent,
                        components: [translationButtons]
                    }).catch(console.error);
                    
                    // Store sent announcement
                    if (sentMessage) {
                        announcementsByMessageId.set(sentMessage.id, announcementData);
                    }
                    
                    await interaction.update({
                        content: 'Announcement sent!',
                        components: []
                    }).catch(() => {});
                    
                    logAnnouncement(interaction.user, 'sent');
                    announcementsByMessageId.delete(previewMessageId);
                }
            }
        }

        // Cancel button
        if (interaction.customId.startsWith('cancel_')) {
            if (interaction.user.id !== OWNER_ID) {
                await interaction.reply({ 
                    content: 'Only owner can cancel.', 
                    ephemeral: true 
                }).catch(() => {});
                return;
            }

            const previewMessageId = interaction.message.id;
            announcementsByMessageId.delete(previewMessageId);
            
            await interaction.update({
                content: 'Cancelled.',
                components: []
            }).catch(() => {});

            logAnnouncement(interaction.user, 'cancelled');
        }
    }
});

// Register commands and login
registerCommands().then(() => {
    client.login(process.env.DISCORD_TOKEN);
}).catch(console.error);
