const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, modifyEmeralds, ensureUser } = require('../../db');
const { COLORS, errEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('Send Emeralds to another user')
    .addUserOption(o => o.setName('user').setDescription('Who to send to').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('How many emeralds (5–500)').setRequired(true).setMinValue(5).setMaxValue(500)),

  async execute(interaction) {
    const sender = await getUser(interaction.user.id);
    if (!sender?.verified) {
      return interaction.reply({ embeds: [errEmbed('You must `/verify` first.')], ephemeral: true });
    }

    const targetUser = interaction.options.getUser('user');
    const amount     = interaction.options.getInteger('amount');

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ embeds: [errEmbed('You cannot transfer to yourself.')], ephemeral: true });
    }
    if (targetUser.bot) {
      return interaction.reply({ embeds: [errEmbed('You cannot transfer to a bot.')], ephemeral: true });
    }
    if (sender.emeralds < amount) {
      return interaction.reply({
        embeds: [errEmbed(`You only have **${sender.emeralds} Emeralds**. You can't send ${amount}.`)],
        ephemeral: true,
      });
    }

    await ensureUser(targetUser.id, targetUser.username);
    const receiver = await getUser(targetUser.id);
    if (!receiver?.verified) {
      return interaction.reply({ embeds: [errEmbed('That user has not verified yet.')], ephemeral: true });
    }

    await modifyEmeralds(interaction.user.id, -amount, 'transfer', `Sent to ${targetUser.username}`);
    const receiverBalance = await modifyEmeralds(targetUser.id, amount, 'transfer', `Received from ${interaction.user.username}`);
    const senderBalance = (await getUser(interaction.user.id)).emeralds;

    const embed = new EmbedBuilder()
      .setColor(COLORS.blue)
      .setTitle('💸 Transfer Successful')
      .addFields(
        { name: 'Sent To',           value: targetUser.username,      inline: true },
        { name: 'Amount',            value: `💎 ${amount} Emeralds`,  inline: true },
        { name: 'Your New Balance',  value: `${senderBalance} Emeralds`, inline: false },
      )
      .setTimestamp();

    // Notify receiver
    try {
      await targetUser.send({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.emerald)
            .setTitle('💎 You Received Emeralds!')
            .setDescription(`**${interaction.user.username}** sent you **${amount} Emeralds**!`)
            .addFields({ name: 'Your New Balance', value: `${receiverBalance} Emeralds` }),
        ],
      });
    } catch { /* DMs disabled */ }

    return interaction.reply({ embeds: [embed] });
  },
};
