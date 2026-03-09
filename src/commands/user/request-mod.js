const {
  SlashCommandBuilder, ModalBuilder, TextInputBuilder,
  TextInputStyle, ActionRowBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits,
} = require('discord.js');
const { getUser, createRequest } = require('../../db');
const { COLORS, errEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('request-mod')
    .setDescription('Submit a Minecraft mod request'),

  async execute(interaction) {
    const user = await getUser(interaction.user.id);
    if (!user?.verified) {
      return interaction.reply({ embeds: [errEmbed('You must `/verify` before requesting mods.')], ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('request-mod')
      .setTitle('🧱 Minecraft Mod Request');

    const modName = new TextInputBuilder()
      .setCustomId('mod_name').setLabel('Mod Name').setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. Laser Sword Mod').setRequired(true).setMaxLength(50);

    const mcVersion = new TextInputBuilder()
      .setCustomId('mc_version').setLabel('Minecraft Version').setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. 1.20.1').setRequired(true).setMaxLength(10);

    const modloader = new TextInputBuilder()
      .setCustomId('modloader').setLabel('Modloader (Forge / Fabric / NeoForge)').setStyle(TextInputStyle.Short)
      .setPlaceholder('Forge').setRequired(true).setMaxLength(20);

    const description = new TextInputBuilder()
      .setCustomId('description').setLabel('Describe your mod').setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('What should this mod do?').setRequired(true).setMaxLength(500);

    const features = new TextInputBuilder()
      .setCustomId('features').setLabel('Key Features (optional)').setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('List the main features...').setRequired(false).setMaxLength(300);

    modal.addComponents(
      new ActionRowBuilder().addComponents(modName),
      new ActionRowBuilder().addComponents(mcVersion),
      new ActionRowBuilder().addComponents(modloader),
      new ActionRowBuilder().addComponents(description),
      new ActionRowBuilder().addComponents(features),
    );

    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const modName    = interaction.fields.getTextInputValue('mod_name');
    const mcVersion  = interaction.fields.getTextInputValue('mc_version');
    const modloader  = interaction.fields.getTextInputValue('modloader');
    const description = interaction.fields.getTextInputValue('description');
    const features   = interaction.fields.getTextInputValue('features') || null;

    const guild    = interaction.guild;
    const staffRole = guild.roles.cache.find(r => r.name === 'Staff');
    const adminRole = guild.roles.cache.find(r => r.name === 'Admin');

    // Find or create 🧱 MOD REQUESTS category
    let category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name === '🧱 MOD REQUESTS'
    );

    // Create private channel for this request
    const chName = `mod-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
    const channel = await guild.channels.create({
      name: chName,
      type: ChannelType.GuildText,
      parent: category?.id,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id,     allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ...(staffRole ? [{ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
        ...(adminRole ? [{ id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
      ],
    });

    const requestId = await createRequest({
      userId: interaction.user.id,
      modName, mcVersion, modloader, description, features,
      channelId: channel.id,
    });

    const embed = new EmbedBuilder()
      .setColor(COLORS.emerald)
      .setTitle('🧱 New Mod Request')
      .addFields(
        { name: 'Request ID',  value: requestId,   inline: true },
        { name: 'User',        value: `${interaction.user}`, inline: true },
        { name: 'Status',      value: '⏳ Pending Review', inline: true },
        { name: 'Mod Name',    value: modName,     inline: true },
        { name: 'MC Version',  value: mcVersion,   inline: true },
        { name: 'Modloader',   value: modloader,   inline: true },
        { name: 'Description', value: description, inline: false },
      );

    if (features) embed.addFields({ name: 'Features', value: features, inline: false });
    embed.setTimestamp().setFooter({ text: 'Staff will review and price this request soon.' });

    const pingMsg = staffRole ? `${staffRole} — new mod request!` : '@Staff — new mod request!';
    await channel.send({ content: pingMsg, embeds: [embed] });

    // Log to mod-queue
    const queueCh = guild.channels.cache.find(c => c.name === 'mod-queue');
    if (queueCh) {
      await queueCh.send({
        content: `📥 New request **${requestId}** from ${interaction.user.tag} — \`${modName}\` → ${channel}`,
      }).catch(() => {});
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.emerald)
          .setTitle('✅ Mod Request Submitted!')
          .addFields(
            { name: 'Request ID', value: requestId, inline: true },
            { name: 'Channel',    value: `${channel}`, inline: true },
          )
          .setDescription('Staff will review your request and assign a price shortly. Use `/check-status` to track progress.')
          .setTimestamp(),
      ],
    });
  },
};
