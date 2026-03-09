const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, modifyEmeralds } = require('../../db');
const { COLORS, errEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Flip a coin and bet Emeralds!')
    .addIntegerOption(o => o.setName('amount').setDescription('Bet amount (5–500)').setRequired(true).setMinValue(5).setMaxValue(500))
    .addStringOption(o => o.setName('choice').setDescription('heads or tails').setRequired(true).addChoices(
      { name: 'Heads', value: 'heads' },
      { name: 'Tails', value: 'tails' },
    )),

  async execute(interaction) {
    if (interaction.channel.name !== 'gambling') {
      return interaction.reply({ embeds: [errEmbed('Gambling commands can only be used in **#gambling**.')], ephemeral: true });
    }

    const user = await getUser(interaction.user.id);
    if (!user?.verified) return interaction.reply({ embeds: [errEmbed('You must `/verify` first.')], ephemeral: true });

    const amount = interaction.options.getInteger('amount');
    const choice = interaction.options.getString('choice');

    if (user.emeralds < amount) {
      return interaction.reply({ embeds: [errEmbed(`You only have **${user.emeralds} Emeralds**.`)], ephemeral: true });
    }

    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const won    = choice === result;
    const delta  = won ? amount : -amount;
    const newBal = await modifyEmeralds(interaction.user.id, delta, 'gambling', `Coinflip: ${won ? 'win' : 'loss'}`);

    const embed = new EmbedBuilder()
      .setColor(won ? COLORS.emerald : COLORS.red)
      .setTitle(`🪙 Coinflip — ${won ? 'YOU WON! 🎉' : 'You Lost 😔'}`)
      .addFields(
        { name: 'Result',      value: result === 'heads' ? '🟡 Heads' : '⚪ Tails', inline: true },
        { name: 'Your Pick',   value: choice  === 'heads' ? '🟡 Heads' : '⚪ Tails', inline: true },
        { name: won ? 'Winnings' : 'Lost', value: `💎 ${won ? '+' : '-'}${amount}`, inline: true },
        { name: 'New Balance', value: `${newBal} Emeralds`, inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
