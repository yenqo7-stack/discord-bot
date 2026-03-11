const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;
const SERVER_NAME = process.env.SERVER_NAME || 'Dein Server';

// Dein Banner-Link hier eintragen (direkt-link zu deinem Bild, z.B. von Imgur oder Discord CDN)
const BANNER_URL = process.env.BANNER_URL || 'https://i.imgur.com/DEIN_BANNER.png';

const WELCOME_FARBE = '#9B59B6'; // Lila passend zum Studio-Style

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const commands = [
  {
    name: 'testw',
    description: 'Zeigt eine Vorschau der Willkommensnachricht'
  }
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommands() {
  try {
    console.log('Slash Commands werden registriert...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Slash Commands registriert!');
  } catch (error) {
    console.error('Fehler:', error);
  }
}

function erstelleWillkommensEmbed(user) {
  return new EmbedBuilder()
    .setColor(WELCOME_FARBE)
    .setImage(BANNER_URL)
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setTitle(`Willkommen auf ${SERVER_NAME}`)
    .setDescription(
      `**${user}** ist dem Server beigetreten.\n\n` +
      `Schau dir die Regeln durch und genieß deinen Aufenthalt.`
    )
    .addFields(
      { name: 'Regeln', value: 'Lies die Serverregeln durch', inline: true },
      { name: 'Support', value: 'Offne ein Ticket bei Fragen', inline: true }
    )
    .setFooter({
      text: `${SERVER_NAME} • Mitglied #${user.client.guilds.cache.first()?.memberCount ?? '?'}`,
      iconURL: user.displayAvatarURL({ dynamic: true })
    })
    .setTimestamp();
}

client.on('guildMemberAdd', async (member) => {
  const channel = client.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return;
  channel.send({ embeds: [erstelleWillkommensEmbed(member)] });
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'testw') {
    const embed = erstelleWillkommensEmbed(interaction.user);
    await interaction.reply({
      content: '**Vorschau der Willkommensnachricht:**',
      embeds: [embed],
      ephemeral: true
    });
  }
});

client.once('ready', async () => {
  console.log(`Bot ist online als ${client.user.tag}`);
  await registerCommands();
});

client.login(TOKEN);