const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, modifyEmeralds } = require('../../db');
const { COLORS, errEmbed } = require('../../utils/helpers');

const REELS   = ['💎', '⭐', '🍒', '🍋', '🔔', '🍇'];
const PAYOUTS = { '💎': 5, '⭐': 3, '🍒': 2.5, '🍋': 2, '🔔': 1.5, '🍇': 1.2 };

function spin() {
  // Weighted: better symbols appear less often
  const weights = [5, 10, 15, 20, 25, 25];
  const pool = [];
  REELS.forEach((r, i) => { for (let j = 0; j < weights[i]; j++) pool.push(r); });
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Spin the slots and bet Emeralds!')
    .addIntegerOption(o => o.setName('amount').setDescription('Bet amount (5–500)').setRequired(true).setMinValue(5).setMaxValue(500)),

  async execute(interaction) {
    if (interaction.channel.name !== 'gambling') {
      return interaction.reply({ embeds: [errEmbed('Gambling commands can only be used in **#gambling**.')], ephemeral: true });
    }

    const user = await getUser(interaction.user.id);
    if (!user?.verified) return interaction.reply({ embeds: [errEmbed('You must `/verify` first.')], ephemeral: true });

    const amount = interaction.options.getInteger('amount');
    if (user.emeralds < amount) {
      return interaction.reply({ embeds: [errEmbed(`You only have **${user.emeralds} Emeralds**.`)], ephemeral: true });
    }

    const r1 = spin(), r2 = spin(), r3 = spin();
    let multiplier = 0;
    let resultText = 'No match — better luck next time!';

    if (r1 === r2 && r2 === r3) {
      multiplier = PAYOUTS[r1];
      resultText = r1 === '💎' ? '🎰 JACKPOT!! Triple Diamonds!' : `Triple ${r1}! ×${multiplier}`;
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      multiplier = 0.5;
      resultText = 'Two of a kind — small win!';
    }

    const winnings = Math.floor(amount * multiplier);
    const delta    = winnings > 0 ? winnings - amount : -amount;
    const newBal   = await modifyEmeralds(interaction.user.id, delta, 'gambling', `Slots: ×${multiplier}`);

    const won = delta > 0;
    const embed = new EmbedBuilder()
      .setColor(won ? COLORS.gold : COLORS.red)
      .setTitle('🎰 Slot Machine')
      .setDescription(`# ${r1}  ${r2}  ${r3}`)
      .addFields(
        { name: 'Result',      value: resultText,                       inline: false },
        { name: 'Multiplier',  value: multiplier > 0 ? `×${multiplier}` : '❌', inline: true },
        { name: won ? 'Profit' : 'Lost', value: `💎 ${delta > 0 ? '+' : ''}${delta}`, inline: true },
        { name: 'New Balance', value: `${newBal} Emeralds`,             inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
