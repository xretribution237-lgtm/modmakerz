const { ensureUser } = require('../db');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // Auto-register user in DB on any interaction
    if (interaction.member) {
      await ensureUser(interaction.user.id, interaction.user.username).catch(() => {});
    }

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(`Error in /${interaction.commandName}:`, err);
        const msg = { content: '❌ An error occurred running this command.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg).catch(() => {});
        } else {
          await interaction.reply(msg).catch(() => {});
        }
      }
    }

    if (interaction.isModalSubmit()) {
      const command = client.commands.get(interaction.customId.split(':')[0]);
      if (command?.handleModal) {
        try {
          await command.handleModal(interaction);
        } catch (err) {
          console.error('Modal error:', err);
        }
      }
    }
  },
};
