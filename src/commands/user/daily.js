const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, modifyEmeralds, pool } = require('../../db');
const { COLORS, errEmbed } = require('../../utils/helpers');

const DAILY_AMOUNT  = 10;
const COOLDOWN_MS   = 24 * 60 * 60 * 1000; // 24 hours

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily 10 Emeralds (24h cooldown)'),

  async execute(interaction) {
    const user = await getUser(interaction.user.id);

    if (!user?.verified) {
      return interaction.reply({
        embeds: [errEmbed('You must `/verify` before claiming daily rewards.')],
        ephemeral: true,
      });
    }

    const now = Date.now();
    const lastClaim = user.daily_last_claim ? new Date(user.daily_last_claim).getTime() : 0;
    const diff = now - lastClaim;

    if (diff < COOLDOWN_MS) {
      const remaining = COOLDOWN_MS - diff;
      const hours   = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.orange)
            .setTitle('⏳ Daily Already Claimed')
            .setDescription(`Come back in **${hours}h ${minutes}m** to claim again.`)
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }

    // Update last_claim timestamp
    await pool.query(
      'UPDATE users SET daily_last_claim = NOW() WHERE user_id = $1',
      [interaction.user.id]
    );

    const newBalance = await modifyEmeralds(interaction.user.id, DAILY_AMOUNT, 'daily', 'Daily reward');

    // Log to emerald-logs channel
    const logChannel = interaction.guild.channels.cache.find(c => c.name === 'emerald-logs');
    if (logChannel) {
      await logChannel.send({
        content: `📋 \`${interaction.user.tag}\` claimed daily reward → +${DAILY_AMOUNT} emeralds → Balance: ${newBalance}`,
      }).catch(() => {});
    }

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.emerald)
          .setTitle('🎁 Daily Reward Claimed!')
          .addFields(
            { name: '💎 Reward',      value: `+${DAILY_AMOUNT} Emeralds`, inline: true },
            { name: '💰 New Balance', value: `${newBalance} Emeralds`,    inline: true },
            { name: '⏰ Next Claim',  value: 'In 24 hours',               inline: true },
          )
          .setTimestamp(),
      ],
    });
  },
};
