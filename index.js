const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');

const TOKEN              = process.env.TOKEN;
const CLIENT_ID          = process.env.CLIENT_ID;
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;
const VERIFY_CHANNEL_ID  = process.env.VERIFY_CHANNEL_ID;
const SERVER_NAME        = process.env.SERVER_NAME || 'Dein Server';
const UNVERIFY_ROLE_ID   = process.env.UNVERIFY_ROLE_ID;
const BUYER_ROLE_ID      = process.env.BUYER_ROLE_ID;
const BOT_ROLE_ID        = process.env.BOT_ROLE_ID;
const BANNER_URL         = process.env.BANNER_URL || 'https://i.imgur.com/DEIN_BANNER.png';
const WELCOME_FARBE      = '#9B59B6';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const rest = new REST({ version: '10' }).setToken(TOKEN);

const commands = [
  { name: 'testw',      description: 'Zeigt eine Vorschau der Willkommensnachricht' },
  { name: 'sendverify', description: 'Sendet die Verify-Nachricht in den Verify-Kanal (Admin)' }
];

async function registerCommands() {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Slash Commands registriert!');
  } catch (err) {
    console.error('❌ Fehler beim Registrieren:', err);
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
      { name: 'Regeln',  value: 'Lies die Serverregeln durch', inline: true },
      { name: 'Support', value: 'Öffne ein Ticket bei Fragen', inline: true }
    )
    .setFooter({
      text: `${SERVER_NAME} • Mitglied #${user.client.guilds.cache.first()?.memberCount ?? '?'}`,
      iconURL: user.displayAvatarURL({ dynamic: true })
    })
    .setTimestamp();
}

function erstelleVerifyEmbed() {
  return new EmbedBuilder()
    .setColor(WELCOME_FARBE)
    .setTitle('✅ Verifizierung')
    .setDescription(
      `Willkommen auf **${SERVER_NAME}**!\n\n` +
      `Klicke auf den Button unten, um dich zu verifizieren und Zugang zum Server zu erhalten.`
    )
    .setFooter({ text: `${SERVER_NAME} • Verifizierung` })
    .setTimestamp();
}

function erstelleVerifyRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_button')
      .setLabel('✅ Verify')
      .setStyle(ButtonStyle.Success)
  );
}

async function sendeVerifyNachricht(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 20 });
    const botMsgs  = messages.filter(m => m.author.id === client.user.id);
    for (const [, msg] of botMsgs) await msg.delete().catch(() => {});
  } catch {}

  await channel.send({
    embeds: [erstelleVerifyEmbed()],
    components: [erstelleVerifyRow()]
  });
  console.log(`✅ Verify-Nachricht gesendet in #${channel.name}`);
}

async function resetAllMemberRoles(guild) {
  if (!UNVERIFY_ROLE_ID) return console.warn('⚠️  UNVERIFY_ROLE_ID fehlt!');

  const unverifyRole = guild.roles.cache.get(UNVERIFY_ROLE_ID);
  if (!unverifyRole) return console.warn('⚠️  Unverify-Rolle nicht gefunden!');

  await guild.members.fetch();

  let processed = 0, skipped = 0;

  for (const [, member] of guild.members.cache) {
    if (member.user.bot) { skipped++; continue; }
    if (BOT_ROLE_ID && member.roles.cache.has(BOT_ROLE_ID)) { skipped++; continue; }

    try {
      const zuEntfernen = member.roles.cache.filter(r => r.id !== guild.id);
      if (zuEntfernen.size > 0) {
        await member.roles.remove(zuEntfernen, 'Bot-Update: Reset');
      }
      if (!member.roles.cache.has(UNVERIFY_ROLE_ID)) {
        await member.roles.add(unverifyRole, 'Bot-Update: Unverify');
      }
      processed++;
      console.log(`🔄 ${member.user.tag} → Reset + Unverify`);
    } catch (err) {
      console.error(`❌ ${member.user.tag}:`, err.message);
    }
  }

  console.log(`📊 Reset fertig: ${processed} bearbeitet, ${skipped} übersprungen.`);
}

// ── Events ────────────────────────────────────────────────────────────────────

client.on('guildMemberAdd', async (member) => {
  const channel = client.channels.cache.get(WELCOME_CHANNEL_ID);
  if (channel) channel.send({ embeds: [erstelleWillkommensEmbed(member)] });
});

client.on('interactionCreate', async (interaction) => {

  // Verify Button
  if (interaction.isButton() && interaction.customId === 'verify_button') {
    const { member, guild } = interaction;
    try {
      if (UNVERIFY_ROLE_ID && member.roles.cache.has(UNVERIFY_ROLE_ID)) {
        await member.roles.remove(UNVERIFY_ROLE_ID, 'Verifiziert');
      }
      if (BUYER_ROLE_ID) {
        const buyerRole = guild.roles.cache.get(BUYER_ROLE_ID);
        if (buyerRole) await member.roles.add(buyerRole, 'Verifiziert');
      }
      await interaction.reply({
        content: '✅ Du wurdest erfolgreich verifiziert!',
        flags: MessageFlags.Ephemeral
      });
      console.log(`✅ ${member.user.tag} verifiziert`);
    } catch (err) {
      console.error(`❌ Verify-Fehler:`, err.message);
      await interaction.reply({
        content: '❌ Fehler aufgetreten. Bitte einen Admin kontaktieren.',
        flags: MessageFlags.Ephemeral
      });
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  // /testw
  if (interaction.commandName === 'testw') {
    await interaction.reply({
      content: '**Vorschau der Willkommensnachricht:**',
      embeds: [erstelleWillkommensEmbed(interaction.user)],
      flags: MessageFlags.Ephemeral
    });
  }

  // /sendverify
  if (interaction.commandName === 'sendverify') {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ Keine Berechtigung.', flags: MessageFlags.Ephemeral });
    }
    const channel = client.channels.cache.get(VERIFY_CHANNEL_ID || interaction.channelId);
    if (!channel) {
      return interaction.reply({ content: '❌ Kanal nicht gefunden. Prüfe VERIFY_CHANNEL_ID.', flags: MessageFlags.Ephemeral });
    }
    await sendeVerifyNachricht(channel);
    await interaction.reply({ content: `✅ Verify-Nachricht in <#${channel.id}> gesendet.`, flags: MessageFlags.Ephemeral });
  }
});

client.once('clientReady', async () => {
  console.log(`\n🤖 Bot online: ${client.user.tag}`);
  await registerCommands();

  for (const [, guild] of client.guilds.cache) {
    console.log(`\n🔄 Rollen-Reset: ${guild.name}`);
    await resetAllMemberRoles(guild);
  }

  if (VERIFY_CHANNEL_ID) {
    const ch = client.channels.cache.get(VERIFY_CHANNEL_ID);
    if (ch) await sendeVerifyNachricht(ch);
    else console.warn('⚠️  VERIFY_CHANNEL_ID gesetzt, Kanal nicht gefunden!');
  }
});

client.login(TOKEN);