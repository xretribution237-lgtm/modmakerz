const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, ensureUser } = require('../../db');
const { COLORS, errEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your Emerald balance')
    .addUserOption(o => o.setName('user').setDescription('Check another user\'s balance').setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const member = interaction.options.getMember('user') || interaction.member;

    await ensureUser(target.id, target.username);
    const data = await getUser(target.id);

    if (!data?.verified && target.id !== interaction.user.id) {
      return interaction.reply({
        embeds: [errEmbed('That user has not verified yet.')],
        ephemeral: true,
      });
    }

    const isSelf = target.id === interaction.user.id;

    const embed = new EmbedBuilder()
      .setColor(COLORS.emerald)
      .setTitle('💎 Emerald Balance')
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: 'User',        value: `${target.username}`,          inline: true },
        { name: 'Balance',     value: `💎 ${data?.emeralds ?? 0} Emeralds`, inline: true },
        { name: 'Total Spent', value: `💸 ${data?.total_spent ?? 0} Emeralds`, inline: true },
      )
      .setTimestamp();

    if (isSelf && !data?.verified) {
      embed.setFooter({ text: 'Run /verify to get 50 free Emeralds!' });
    }

    return interaction.reply({ embeds: [embed], ephemeral: isSelf });
  },
};
