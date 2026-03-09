const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getRequest } = require('../../db');
const { COLORS, errEmbed } = require('../../utils/helpers');

const STATUS_LABELS = {
  pending:     '⏳ Pending Review',
  priced:      '💰 Priced — awaiting your approval',
  approved:    '✅ Approved — payment received',
  in_progress: '🔨 In Progress',
  completed:   '📦 Completed',
  denied:      '❌ Denied',
};

const STATUS_COLORS = {
  pending:     COLORS.orange,
  priced:      COLORS.gold,
  approved:    COLORS.emerald,
  in_progress: COLORS.blue,
  completed:   COLORS.purple,
  denied:      COLORS.red,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('check-status')
    .setDescription('Check the status of a mod request')
    .addStringOption(o => o.setName('request-id').setDescription('Request ID (e.g. REQ-0001)').setRequired(true)),

  async execute(interaction) {
    const requestId = interaction.options.getString('request-id').toUpperCase();
    const req = await getRequest(requestId);

    if (!req) {
      return interaction.reply({ embeds: [errEmbed(`No request found with ID **${requestId}**.`)], ephemeral: true });
    }

    // Only owner, staff, or the requester can check
    const isOwner   = req.user_id === interaction.user.id;
    const isStaff   = interaction.member.roles.cache.some(r => ['Staff','Admin'].includes(r.name));
    const isServerOwner = interaction.user.id === process.env.OWNER_ID;

    if (!isOwner && !isStaff && !isServerOwner) {
      return interaction.reply({ embeds: [errEmbed('You can only check your own requests.')], ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(STATUS_COLORS[req.status] || COLORS.blue)
      .setTitle('📋 Mod Request Status')
      .addFields(
        { name: 'Request ID',  value: req.request_id,          inline: true },
        { name: 'Mod Name',    value: req.mod_name,            inline: true },
        { name: 'Status',      value: STATUS_LABELS[req.status] || req.status, inline: true },
        { name: 'MC Version',  value: req.mc_version,          inline: true },
        { name: 'Modloader',   value: req.modloader,           inline: true },
        { name: 'Price',       value: req.price ? `💎 ${req.price} Emeralds` : 'Not yet priced', inline: true },
        { name: 'Submitted',   value: `<t:${Math.floor(new Date(req.created_at).getTime()/1000)}:R>`, inline: true },
      );

    if (req.status === 'priced') {
      embed.addFields({ name: '⚡ Action Required', value: 'Run `/approve-mod ' + requestId + '` to pay and confirm your order.', inline: false });
    }
    if (req.completed_at) {
      embed.addFields({ name: 'Completed', value: `<t:${Math.floor(new Date(req.completed_at).getTime()/1000)}:R>`, inline: true });
    }

    embed.setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
