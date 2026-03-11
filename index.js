const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;
const SERVER_NAME = process.env.SERVER_NAME || 'Dein Server';
const WELCOME_FARBE = '#5865F2';

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
    console.log('📋 Slash Commands werden registriert...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Slash Commands registriert!');
  } catch (error) {
    console.error('❌ Fehler:', error);
  }
}

function erstelleWillkommensEmbed(user) {
  return new EmbedBuilder()
    .setColor(WELCOME_FARBE)
    .setTitle(`👋 Willkommen auf ${SERVER_NAME}!`)
    .setDescription(`Hey ${user}, schön dass du da bist! 🎉\n\nSchau dich gerne um und hab Spaß!`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '📜 Regeln', value: 'Lies dir bitte die Regeln durch!', inline: true },
      { name: '🎮 Viel Spaß', value: 'Genieße deinen Aufenthalt!', inline: true }
    )
    .setFooter({ text: `Willkommen auf ${SERVER_NAME}!` })
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
      content: '👀 **Vorschau der Willkommensnachricht:**',
      embeds: [embed],
      ephemeral: true
    });
  }
});

client.once('ready', async () => {
  console.log(`✅ Bot ist online als ${client.user.tag}`);
  await registerCommands();
});

client.login(TOKEN);