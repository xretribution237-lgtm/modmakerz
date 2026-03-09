const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../utils/helpers');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    // DM the new member
    try {
      const embed = new EmbedBuilder()
        .setColor(COLORS.emerald)
        .setTitle('💎 Welcome to Minecraft Mod Makerz!')
        .setDescription(
          `Hey **${member.user.username}**, welcome to the server!\n\n` +
          `Here's how to get started:`
        )
        .addFields(
          { name: '1️⃣ Verify', value: 'Go to #verify and run `/verify` to get **50 free emeralds**.' },
          { name: '2️⃣ Request a Mod', value: 'Use `/request-mod` in #request-a-mod to submit your mod idea.' },
          { name: '3️⃣ Earn More Emeralds', value: 'Claim `/daily` every 24h, or gamble in #gambling.' },
          { name: '💰 Emerald Prices', value: 'Check #emerald-prices to see what mods cost.' }
        )
        .setFooter({ text: 'Minecraft Mod Makerz • Good luck!' })
        .setTimestamp();

      await member.send({ embeds: [embed] });
    } catch {
      // User has DMs disabled — that's fine
    }

    // Post in #general
    const general = member.guild.channels.cache.find(c => c.name === 'general');
    if (general) {
      const embed = new EmbedBuilder()
        .setColor(COLORS.emerald)
        .setDescription(`👋 Welcome to **Minecraft Mod Makerz**, ${member}! Run \`/verify\` to claim your **50 free emeralds**. 💎`);
      await general.send({ embeds: [embed] }).catch(() => {});
    }
  },
};
