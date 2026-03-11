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

const BANNER_URL    = process.env.BANNER_URL || 'https://i.imgur.com/DEIN_BANNER.png';
const WELCOME_FARBE = '#9B59B6';

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
  },
  {
    name: 'sendverify',
    description: 'Sendet die Verify-Nachricht mit Button in den Verify-Kanal (Admin)'
  }
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommands() {
  try {
    console.log('Slash Commands werden registriert...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Slash Commands registriert!');
  } catch (error) {
    console.error('Fehler beim Registrieren:', error);
  }
}

// ── Verify-Embed + Button erstellen ───────────────────────────────────────────
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

// ── Verify-Nachricht in den Kanal senden ──────────────────────────────────────
async function sendeVerifyNachricht(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 20 });
    const botMessages = messages.filter(m => m.author.id === client.user.id);
    for (const [, msg] of botMessages) {
      await msg.delete().catch(() => {});
    }
  } catch {}

  await channel.send({
    embeds: [erstelleVerifyEmbed()],
    components: [erstelleVerifyRow()]
  });

  console.log(`✅ Verify-Nachricht gesendet in #${channel.name}`);
}

// ── Alle Member-Rollen zurücksetzen und Unverify vergeben ─────────────────────
async function resetAllMemberRoles(guild) {
  if (!UNVERIFY_ROLE_ID) {
    console.warn('⚠️  UNVERIFY_ROLE_ID ist nicht gesetzt! Überspringe Reset.');
    return;
  }

  const unverifyRole = guild.roles.cache.get(UNVERIFY_ROLE_ID);
  if (!unverifyRole) {
    console.warn('⚠️  Unverify-Rolle nicht gefunden! Überspringe Reset.');
    return;
  }

  await guild.members.fetch();

  let processed = 0;
  let skipped   = 0;

  for (const [, member] of guild.members.cache) {
    if (member.user.bot) { skipped++; continue; }
    if (BOT_ROLE_ID && member.roles.cache.has(BOT_ROLE_ID)) { skipped++; continue; }

    try {
      const rolesToRemove = member.roles.cache.filter(r => r.id !== guild.id);
      if (rolesToRemove.size > 0) {
        await member.roles.remove(rolesToRemove, 'Bot-Update: Rollen zurückgesetzt');
      }
      if (!member.roles.cache.has(UNVERIFY_ROLE_ID)) {
        await member.roles.add(unverifyRole, 'Bot-Update: Unverify vergeben');
      }
      processed++;
      console.log(`🔄 ${member.user.tag} → Rollen entfernt + Unverify vergeben`);
    } catch (err) {
      console.error(`❌ Fehler bei ${member.user.tag}:`, err.message);
    }
  }

  console.log(`\n📊 Reset abgeschlossen: ${processed} bearbeitet, ${skipped} übersprungen (Bots).`);
}

// ─────────────────────────────────────────────────────────────────────────────

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
  // ── Button: Verify ──────────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'verify_button') {
    const member = interaction.member;
    const guild  = interaction.guild;

    try {
      if (UNVERIFY_ROLE_ID && member.roles.cache.has(UNVERIFY_ROLE_ID)) {
        await member.roles.remove(UNVERIFY_ROLE_ID, 'Verifiziert per Button');
      }

      if (BUYER_ROLE_ID) {
        const buyerRole = guild.roles.cache.get(BUYER_ROLE_ID);
        if (buyerRole) {
          await member.roles.add(buyerRole, 'Verifiziert per Button');
        } else {
          console.warn('⚠️  BUYER_ROLE_ID nicht gefunden!');
        }
      }

      await interaction.reply({
        content: '✅ Du wurdest erfolgreich verifiziert!',
        flags: MessageFlags.Ephemeral
      });

      console.log(`✅ ${member.user.tag} verifiziert → Buyer-Rolle vergeben`);
    } catch (err) {
      console.error(`❌ Verify-Fehler bei ${member.user.tag}:`, err.message);
      await interaction.reply({
        content: '❌ Ein Fehler ist aufgetreten. Bitte kontaktiere einen Admin.',
        flags: MessageFlags.Ephemeral
      });
    }
    return;
  }

  // ── Slash Commands ──────────────────────────────────────────────────────────
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'testw') {
    const embed = erstelleWillkommensEmbed(interaction.user);
    await interaction.reply({
      content: '**Vorschau der Willkommensnachricht:**',
      embeds: [embed],
      flags: MessageFlags.Ephemeral
    });
  }

  if (interaction.commandName === 'sendverify') {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({
        content: '❌ Keine Berechtigung.',
        flags: MessageFlags.Ephemeral
      });
    }

    const channelId = VERIFY_CHANNEL_ID || interaction.channelId;
    const channel   = client.channels.cache.get(channelId);

    if (!channel) {
      return interaction.reply({
        content: '❌ Verify-Kanal nicht gefunden. Prüfe VERIFY_CHANNEL_ID.',
        flags: MessageFlags.Ephemeral
      });
    }

    await sendeVerifyNachricht(channel);
    await interaction.reply({
      content: `✅ Verify-Nachricht wurde in <#${channel.id}> gesendet.`,
      flags: MessageFlags.Ephemeral
    });
  }
});

client.once('clientReady', async () => {
  console.log(`\n🤖 Bot ist online als ${client.user.tag}`);
  await registerCommands();

  for (const [, guild] of client.guilds.cache) {
    console.log(`\n🔄 Starte Rollen-Reset auf: ${guild.name}`);
    await resetAllMemberRoles(guild);
  }

  if (VERIFY_CHANNEL_ID) {
    const verifyChannel = client.channels.cache.get(VERIFY_CHANNEL_ID);
    if (verifyChannel) {
      await sendeVerifyNachricht(verifyChannel);
    } else {
      console.warn('⚠️  VERIFY_CHANNEL_ID gesetzt, aber Kanal nicht gefunden!');
    }
  }
});

client.login(TOKEN);