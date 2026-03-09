require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');
const { initDB } = require('./db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// ── Load all commands recursively ─────────────────────────────────────────────
function loadCommands(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadCommands(full);
    } else if (entry.name.endsWith('.js')) {
      const exported = require(full);
      // Support both single command export and array of commands
      const cmds = Array.isArray(exported) ? exported : [exported];
      for (const cmd of cmds) {
        if (cmd?.data?.name) {
          client.commands.set(cmd.data.name, cmd);
          console.log(`  Loaded command: /${cmd.data.name}`);
        }
      }
    }
  }
}

loadCommands(path.join(__dirname, 'commands'));

// ── Load all events ───────────────────────────────────────────────────────────
const eventsDir = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsDir).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsDir, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
(async () => {
  await initDB();
  await client.login(process.env.DISCORD_TOKEN);
})();
