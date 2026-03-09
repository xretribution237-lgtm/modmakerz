const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, modifyEmeralds } = require('../../db');
const { COLORS, errEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Verify your account and receive 50 free Emeralds!'),

  async execute(interaction) {
    const user = await getUser(interaction.user.id);

    if (user?.verified) {
      return interaction.reply({
        embeds: [errEmbed('You are already verified! Check your balance with `/balance`.')],
        ephemeral: true,
      });
    }

    // Grant Verified role
    const verifiedRole = interaction.guild.roles.cache.find(r => r.name === 'Verified');
    if (verifiedRole) {
      await interaction.member.roles.add(verifiedRole).catch(() => {});
    }

    // Mark verified + give 50 emeralds
    const { pool } = require('../../db');
    await pool.query('UPDATE users SET verified = TRUE WHERE user_id = $1', [interaction.user.id]);
    const newBalance = await modifyEmeralds(interaction.user.id, 50, 'verify_bonus', 'New member verification bonus');

    const embed = new EmbedBuilder()
      .setColor(COLORS.emerald)
      .setTitle('✅ Verification Successful!')
      .setDescription(`Welcome to **Minecraft Mod Makerz**, ${interaction.user}!`)
      .addFields(
        { name: '💎 You Received',  value: '50 Emeralds', inline: true },
        { name: '💰 Your Balance',  value: `${newBalance} Emeralds`, inline: true },
        { name: '🚀 Next Step',     value: 'Use `/request-mod` to submit your first mod request!', inline: false },
        { name: '🎁 Daily Reward',  value: 'Claim `/daily` every 24 hours for +10 Emeralds.', inline: false },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
