module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    client.user.setActivity('💎 Minecraft Mod Makerz', { type: 3 }); // WATCHING
  },
};
