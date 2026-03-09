require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const commands = [];

function collectCommands(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectCommands(full);
    else if (entry.name.endsWith('.js')) {
      const exported = require(full);
      const cmds = Array.isArray(exported) ? exported : [exported];
      for (const cmd of cmds) {
        if (cmd?.data) commands.push(cmd.data.toJSON());
      }
    }
  }
}

collectCommands(path.join(__dirname, 'src', 'commands'));

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Deploying ${commands.length} slash commands...`);
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );
    console.log('✅ All commands deployed globally.');
  } catch (err) {
    console.error(err);
  }
})();
