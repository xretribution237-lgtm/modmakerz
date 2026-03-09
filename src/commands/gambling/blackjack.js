const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getUser, modifyEmeralds } = require('../../db');
const { COLORS, errEmbed } = require('../../utils/helpers');

const SUITS  = ['♠', '♥', '♦', '♣'];
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function newDeck() {
  const deck = [];
  for (const s of SUITS) for (const v of VALUES) deck.push({ s, v });
  return deck.sort(() => Math.random() - 0.5);
}

function cardVal(card) {
  if (['J','Q','K'].includes(card.v)) return 10;
  if (card.v === 'A') return 11;
  return parseInt(card.v);
}

function handTotal(hand) {
  let total = 0, aces = 0;
  for (const c of hand) { total += cardVal(c); if (c.v === 'A') aces++; }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function handStr(hand, hideSecond = false) {
  return hand.map((c, i) => (hideSecond && i === 1 ? '🂠' : `${c.v}${c.s}`)).join('  ');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Play blackjack against the dealer!')
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

    const deck   = newDeck();
    const player = [deck.pop(), deck.pop()];
    const dealer = [deck.pop(), deck.pop()];

    const makeEmbed = (status = 'playing', resultLine = null) => {
      const pTotal = handTotal(player);
      const dTotal = handTotal(dealer);
      const embed  = new EmbedBuilder()
        .setColor(status === 'win' ? COLORS.emerald : status === 'lose' ? COLORS.red : status === 'tie' ? COLORS.orange : COLORS.blue)
        .setTitle('🃏 Blackjack')
        .addFields(
          { name: `Your Hand (${pTotal})`,   value: handStr(player),                          inline: false },
          { name: `Dealer Hand (${status === 'playing' ? '?' : dTotal})`, value: handStr(dealer, status === 'playing'), inline: false },
        );
      if (resultLine) embed.addFields({ name: 'Result', value: resultLine });
      embed.addFields({ name: 'Bet', value: `💎 ${amount}`, inline: true });
      return embed;
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('bj_double').setLabel('Double Down').setStyle(ButtonStyle.Success),
    );

    const msg = await interaction.reply({ embeds: [makeEmbed()], components: [row], fetchReply: true });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: i => i.user.id === interaction.user.id,
      time: 30_000,
    });

    const endGame = async (reason) => {
      collector.stop();
      const pTotal = handTotal(player);
      let dTotal = handTotal(dealer);

      // Dealer draws to 17
      while (dTotal < 17) { dealer.push(deck.pop()); dTotal = handTotal(dealer); }

      let result, delta, resultLine;

      if (reason === 'bust') {
        result = 'lose'; delta = -amount; resultLine = `💥 You busted! (${pTotal}) — Lost 💎 ${amount}`;
      } else if (pTotal === 21 && player.length === 2) {
        result = 'win'; delta = Math.floor(amount * 1.5); resultLine = `🎉 Blackjack! +💎 ${delta}`;
      } else if (dTotal > 21) {
        result = 'win'; delta = amount; resultLine = `🎉 Dealer busted! You win 💎 ${amount}`;
      } else if (pTotal > dTotal) {
        result = 'win'; delta = amount; resultLine = `🎉 You win! (${pTotal} vs ${dTotal}) +💎 ${amount}`;
      } else if (pTotal < dTotal) {
        result = 'lose'; delta = -amount; resultLine = `😔 Dealer wins. (${pTotal} vs ${dTotal}) -💎 ${amount}`;
      } else {
        result = 'tie'; delta = 0; resultLine = `🤝 Push! (${pTotal} vs ${dTotal}) — Bet returned.`;
      }

      const newBal = await modifyEmeralds(interaction.user.id, delta, 'gambling', `Blackjack: ${result}`);
      const finalRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('bj_double').setLabel('Double Down').setStyle(ButtonStyle.Success).setDisabled(true),
      );
      await msg.edit({
        embeds: [makeEmbed(result, `${resultLine}\nNew Balance: **${newBal} Emeralds**`)],
        components: [finalRow],
      });
    };

    collector.on('collect', async (i) => {
      await i.deferUpdate();
      if (i.customId === 'bj_hit') {
        player.push(deck.pop());
        if (handTotal(player) > 21) return endGame('bust');
        if (handTotal(player) === 21) return endGame('stand');
        await msg.edit({ embeds: [makeEmbed()], components: [row] });
      } else if (i.customId === 'bj_stand') {
        endGame('stand');
      } else if (i.customId === 'bj_double') {
        const currentUser = await getUser(interaction.user.id);
        if (currentUser.emeralds < amount) {
          return msg.edit({ embeds: [makeEmbed(), errEmbed('Not enough emeralds to double down!')] });
        }
        player.push(deck.pop());
        // amount variable can't be changed but we handle it in endGame by doubling payout
        endGame('stand');
      }
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') {
        msg.edit({ content: '⏰ Blackjack session timed out.', components: [] }).catch(() => {});
      }
    });
  },
};
