const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLeaderboard } = require('../../db');
const { COLORS } = require('../../utils/helpers');

const MEDALS = ['🥇','🥈','🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('See the top Emerald holders'),

  async execute(interaction) {
    const rows = await getLeaderboard(10);

    const lines = rows.map((r, i) => {
      const medal = MEDALS[i] || `**${i+1}.**`;
      return `${medal} **${r.username}** — 💎 ${r.emeralds.toLocaleString()}`;
    });

    const embed = new EmbedBuilder()
      .setColor(COLORS.gold)
      .setTitle('💎 Emerald Leaderboard')
      .setDescription(lines.length ? lines.join('\n') : 'No verified users yet!')
      .setFooter({ text: 'Earn more by claiming /daily, gambling, or spending on mods!' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
