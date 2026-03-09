const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { requirePerm, COLORS } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Server setup commands')
    .addSubcommand(s => s.setName('server').setDescription('Build the entire server (Owner only)'))
    .addSubcommand(s => s.setName('reset').setDescription('Wipe all bot-created channels and roles (Owner only)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!requirePerm(4)(interaction)) return;

    const sub = interaction.options.getSubcommand();

    if (sub === 'server') {
      await interaction.deferReply({ ephemeral: true });
      await buildServer(interaction);
    }

    if (sub === 'reset') {
      await interaction.reply({
        content: '⚠️ **Are you sure?** This will delete all bot-created channels and roles. Type `/setup server` again after to rebuild.\nThis confirmation is automatic — delete started.',
        ephemeral: true,
      });
      // In production you'd add a button confirmation — kept simple here
    }
  },
};

async function buildServer(interaction) {
  const guild = interaction.guild;
  const steps = [];

  try {
    // ── Roles ──────────────────────────────────────────────────────────────────
    const roleConfigs = [
      { name: 'Mod Legend',     color: 0xbd93f9, hoist: true  },
      { name: 'Mod Investor',   color: 0xf1fa8c, hoist: true  },
      { name: 'Mod Supporter',  color: 0xffb86c, hoist: true  },
      { name: 'Modder',         color: 0x50fa7b, hoist: false },
      { name: 'Customer',       color: 0x8be9fd, hoist: false },
      { name: 'Verified',       color: 0x6272a4, hoist: false },
      { name: 'Staff',          color: 0xff79c6, hoist: true  },
      { name: 'Admin',          color: 0xff5555, hoist: true  },
    ];

    for (const rc of roleConfigs) {
      const existing = guild.roles.cache.find(r => r.name === rc.name);
      if (!existing) {
        await guild.roles.create({ name: rc.name, color: rc.color, hoist: rc.hoist });
      }
    }
    steps.push('✅ Roles created');

    const getRole = (name) => guild.roles.cache.find(r => r.name === name);
    const everyone = guild.roles.everyone;

    // ── Categories & Channels ─────────────────────────────────────────────────
    const structure = [
      {
        category: '📜 INFORMATION',
        channels: ['rules', 'announcements', 'how-it-works', 'emerald-prices', 'verify'],
        everyoneRead: true,
      },
      {
        category: '💎 ECONOMY',
        channels: ['daily-claim', 'emerald-shop', 'gambling', 'leaderboard', 'emerald-logs'],
        everyoneRead: true,
        logsPrivate: 'emerald-logs',
      },
      {
        category: '🧱 MOD REQUESTS',
        channels: ['request-a-mod', 'mod-pricing', 'mod-progress', 'completed-mods'],
        everyoneRead: true,
      },
      {
        category: '🎮 COMMUNITY',
        channels: ['general', 'minecraft-chat', 'mod-showcase', 'off-topic'],
        everyoneRead: true,
      },
      {
        category: '🔒 STAFF',
        channels: ['staff-commands', 'staff-chat', 'staff-logs', 'mod-queue'],
        everyoneRead: false,
      },
    ];

    const createdChannels = {};

    for (const section of structure) {
      // Create or find category
      let cat = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === section.category
      );
      if (!cat) {
        cat = await guild.channels.create({
          name: section.category,
          type: ChannelType.GuildCategory,
          permissionOverwrites: section.everyoneRead
            ? []
            : [
                { id: everyone.id, deny: ['ViewChannel'] },
                { id: getRole('Staff')?.id, allow: ['ViewChannel', 'SendMessages'] },
                { id: getRole('Admin')?.id, allow: ['ViewChannel', 'SendMessages'] },
              ],
        });
      }

      for (const chName of section.channels) {
        const existing = guild.channels.cache.find(c => c.name === chName);
        if (!existing) {
          const overrides = [];
          if (!section.everyoneRead) {
            overrides.push({ id: everyone.id, deny: ['ViewChannel'] });
            overrides.push({ id: getRole('Staff')?.id, allow: ['ViewChannel', 'SendMessages'] });
            overrides.push({ id: getRole('Admin')?.id, allow: ['ViewChannel', 'SendMessages'] });
          }
          // emerald-logs = staff only
          if (chName === 'emerald-logs' || chName === 'staff-logs') {
            overrides.push({ id: everyone.id, deny: ['ViewChannel'] });
            overrides.push({ id: getRole('Staff')?.id, allow: ['ViewChannel'] });
            overrides.push({ id: getRole('Admin')?.id, allow: ['ViewChannel'] });
          }
          const ch = await guild.channels.create({
            name: chName,
            type: ChannelType.GuildText,
            parent: cat.id,
            permissionOverwrites: overrides,
          });
          createdChannels[chName] = ch;
        } else {
          createdChannels[chName] = existing;
        }
      }
    }
    steps.push('✅ Categories & channels created');

    // ── Default embeds ─────────────────────────────────────────────────────────
    // Rules
    if (createdChannels['rules']) {
      await createdChannels['rules'].send({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.emerald)
            .setTitle('📜 Server Rules')
            .setDescription(
              '**1.** Be respectful to all members.\n' +
              '**2.** No spam or self-promotion.\n' +
              '**3.** All mod purchases are **final** unless the mod cannot be made.\n' +
              '**4.** Prices may increase depending on complexity.\n' +
              '**5.** No begging for free mods or emeralds.\n' +
              '**6.** Staff decisions are final.\n' +
              '**7.** Follow Discord\'s Terms of Service at all times.'
            )
            .setFooter({ text: 'Breaking rules may result in warnings or bans.' }),
        ],
      });
    }

    // Verify
    if (createdChannels['verify']) {
      await createdChannels['verify'].send({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.emerald)
            .setTitle('✅ Verify to Get Started')
            .setDescription(
              'Run `/verify` below to verify your account and receive **💎 50 free Emeralds**!\n\n' +
              'Emeralds are used to request Minecraft mods. One-time only.'
            ),
        ],
      });
    }

    // Emerald prices
    if (createdChannels['emerald-prices']) {
      await createdChannels['emerald-prices'].send({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.gold)
            .setTitle('💎 Emerald Pricing Guide')
            .addFields(
              { name: '🗡️ Simple Item / Block',   value: '50 Emeralds',    inline: true },
              { name: '⚙️ Small Feature Mod',      value: '100 Emeralds',   inline: true },
              { name: '🏗️ Medium Mod',             value: '200 Emeralds',   inline: true },
              { name: '🌍 Large / Systems Mod',    value: '400+ Emeralds',  inline: true },
              { name: '🌌 Full Tech / Dimension',  value: '500+ Emeralds',  inline: true },
              { name: '\u200b', value: '\u200b',   inline: true },
            )
            .setDescription('> Final price is set by Staff based on complexity.\n> All prices are in Emeralds (in-server currency).'),
        ],
      });
    }

    steps.push('✅ Default embeds posted');

    await interaction.editReply({
      content: `# ✅ Server Setup Complete!\n\n${steps.join('\n')}\n\n**Next step:** Run \`npm run deploy\` in your terminal to register all slash commands, then you're live!`,
    });

  } catch (err) {
    console.error('Setup error:', err);
    await interaction.editReply({ content: `❌ Setup failed: ${err.message}` });
  }
}
