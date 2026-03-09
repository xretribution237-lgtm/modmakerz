// Simple in-memory anti-spam: 5 messages in 5 seconds = auto-mute 10 min
const spamMap = new Map(); // userId -> { count, timer }

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    const now = Date.now();

    if (!spamMap.has(userId)) {
      spamMap.set(userId, { count: 1, firstMsg: now });
    } else {
      const data = spamMap.get(userId);
      if (now - data.firstMsg < 5000) {
        data.count++;
        if (data.count >= 5) {
          spamMap.delete(userId);
          const member = message.guild.members.cache.get(userId);
          if (!member) return;

          try {
            // Timeout for 10 minutes
            await member.timeout(10 * 60 * 1000, 'Auto-mute: spam detection');
            await message.channel.send({
              content: `🚫 ${message.author} has been auto-muted for **10 minutes** due to spam.`,
            }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 8000));

            // Log to staff-logs if it exists
            const logChannel = message.guild.channels.cache.find(c => c.name === 'staff-logs');
            if (logChannel) {
              await logChannel.send({
                content: `⚠️ **Auto-mute** | User: ${message.author.tag} (${userId}) | Reason: Spam | Duration: 10 minutes`,
              });
            }
          } catch (err) {
            console.error('Anti-spam mute failed:', err);
          }
          return;
        }
      } else {
        // Reset window
        spamMap.set(userId, { count: 1, firstMsg: now });
      }
    }

    // Clean up map periodically
    if (Math.random() < 0.01) {
      for (const [id, data] of spamMap.entries()) {
        if (now - data.firstMsg > 10000) spamMap.delete(id);
      }
    }
  },
};
