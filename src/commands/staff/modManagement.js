const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getRequest, updateRequestStatus, getUser, modifyEmeralds, pool } = require('../../db');
const { requirePerm, COLORS, errEmbed, successEmbed } = require('../../utils/helpers');

// ── Helper: log to emerald-logs ───────────────────────────────────────────────
async function logEmeralds(guild, message) {
  const ch = guild.channels.cache.find(c => c.name === 'emerald-logs');
  if (ch) await ch.send({ content: `📋 ${message}` }).catch(() => {});
}

// ── /price-mod ────────────────────────────────────────────────────────────────
const priceModCmd = {
  data: new SlashCommandBuilder()
    .setName('price-mod')
    .setDescription('Assign an emerald price to a mod request')
    .addStringOption(o => o.setName('request-id').setDescription('Request ID').setRequired(true))
    .addIntegerOption(o => o.setName('price').setDescription('Price in Emeralds').setRequired(true).setMinValue(1))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    if (!requirePerm(2)(interaction)) return;

    const requestId = interaction.options.getString('request-id').toUpperCase();
    const price     = interaction.options.getInteger('price');
    const req       = await getRequest(requestId);

    if (!req) return interaction.reply({ embeds: [errEmbed(`Request **${requestId}** not found.`)], ephemeral: true });
    if (req.status !== 'pending') return interaction.reply({ embeds: [errEmbed(`Request is already **${req.status}**.`)], ephemeral: true });

    await updateRequestStatus(requestId, 'priced', { price });

    // Notify the user via DM
    try {
      const discordUser = await interaction.client.users.fetch(req.user_id);
      await discordUser.send({
        embeds: [
          new EmbedBuilder().setColor(COLORS.gold).setTitle('💰 Your Mod Has Been Priced!')
            .addFields(
              { name: 'Mod',        value: req.mod_name,              inline: true },
              { name: 'Request ID', value: requestId,                 inline: true },
              { name: 'Price',      value: `💎 ${price} Emeralds`,    inline: true },
              { name: 'Next Step',  value: `Run \`/approve-mod ${requestId}\` to pay and confirm.`, inline: false },
            ).setTimestamp(),
        ],
      });
    } catch { /* DMs off */ }

    // Update embed in the request channel
    const reqChannel = interaction.guild.channels.cache.get(req.channel_id);
    if (reqChannel) {
      await reqChannel.send({
        embeds: [
          new EmbedBuilder().setColor(COLORS.gold).setTitle('💰 Price Assigned')
            .setDescription(`This mod has been priced at **💎 ${price} Emeralds** by staff.\n\nRun \`/approve-mod ${requestId}\` to confirm your order.`)
            .setTimestamp(),
        ],
      }).catch(() => {});
    }

    return interaction.reply({
      embeds: [successEmbed('💰 Price Set', [
        { name: 'Request', value: requestId, inline: true },
        { name: 'Price',   value: `💎 ${price}`, inline: true },
      ])],
      ephemeral: true,
    });
  },
};

// ── /approve-mod ──────────────────────────────────────────────────────────────
const approveModCmd = {
  data: new SlashCommandBuilder()
    .setName('approve-mod')
    .setDescription('Approve a priced mod — deducts emeralds from the user')
    .addStringOption(o => o.setName('request-id').setDescription('Request ID').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    if (!requirePerm(2)(interaction)) return;

    const requestId = interaction.options.getString('request-id').toUpperCase();
    const req = await getRequest(requestId);

    if (!req) return interaction.reply({ embeds: [errEmbed(`Request **${requestId}** not found.`)], ephemeral: true });
    if (req.status !== 'priced') return interaction.reply({ embeds: [errEmbed(`Request must be in **priced** status first.`)], ephemeral: true });

    const user = await getUser(req.user_id);
    if (!user || user.emeralds < req.price) {
      // Notify user
      try {
        const du = await interaction.client.users.fetch(req.user_id);
        await du.send({ embeds: [errEmbed(`You don't have enough emeralds for **${req.mod_name}** (needs 💎 ${req.price}).`)] });
      } catch {}
      return interaction.reply({ embeds: [errEmbed(`User doesn't have enough emeralds (needs ${req.price}, has ${user?.emeralds ?? 0}).`)], ephemeral: true });
    }

    const newBal = await modifyEmeralds(req.user_id, -req.price, 'mod_purchase', `Mod: ${req.mod_name} (${requestId})`);
    await pool.query('UPDATE users SET total_spent = total_spent + $1 WHERE user_id = $2', [req.price, req.user_id]);
    await updateRequestStatus(requestId, 'in_progress');

    // Check milestone roles
    await checkMilestoneRoles(interaction.guild, req.user_id);

    await logEmeralds(interaction.guild, `${user.username} paid 💎 ${req.price} for mod **${req.mod_name}** (${requestId}) → Balance: ${newBal}`);

    const reqChannel = interaction.guild.channels.cache.get(req.channel_id);
    if (reqChannel) {
      await reqChannel.send({
        embeds: [
          new EmbedBuilder().setColor(COLORS.emerald).setTitle('✅ Payment Received — Mod In Progress!')
            .addFields(
              { name: 'Paid',    value: `💎 ${req.price} Emeralds`, inline: true },
              { name: 'Balance', value: `${newBal} Emeralds`,       inline: true },
            ).setTimestamp(),
        ],
      }).catch(() => {});
    }

    return interaction.reply({
      embeds: [successEmbed('✅ Mod Approved', [
        { name: 'Request',   value: requestId,       inline: true },
        { name: 'Deducted',  value: `💎 ${req.price}`, inline: true },
      ])],
      ephemeral: true,
    });
  },
};

// ── /deny-mod ─────────────────────────────────────────────────────────────────
const denyModCmd = {
  data: new SlashCommandBuilder()
    .setName('deny-mod')
    .setDescription('Deny a mod request with a reason')
    .addStringOption(o => o.setName('request-id').setDescription('Request ID').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for denial').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    if (!requirePerm(2)(interaction)) return;

    const requestId = interaction.options.getString('request-id').toUpperCase();
    const reason    = interaction.options.getString('reason');
    const req = await getRequest(requestId);

    if (!req) return interaction.reply({ embeds: [errEmbed(`Request **${requestId}** not found.`)], ephemeral: true });

    // Refund if already paid
    if (req.status === 'in_progress' || req.status === 'approved') {
      await modifyEmeralds(req.user_id, req.price, 'refund', `Refund for denied mod: ${req.mod_name}`);
    }

    await updateRequestStatus(requestId, 'denied');

    try {
      const du = await interaction.client.users.fetch(req.user_id);
      await du.send({
        embeds: [
          new EmbedBuilder().setColor(COLORS.red).setTitle('❌ Mod Request Denied')
            .addFields(
              { name: 'Mod',    value: req.mod_name, inline: true },
              { name: 'Reason', value: reason,        inline: false },
              { name: 'Refund', value: req.price ? `💎 ${req.price} Emeralds returned` : 'N/A', inline: true },
            ).setTimestamp(),
        ],
      });
    } catch {}

    const reqChannel = interaction.guild.channels.cache.get(req.channel_id);
    if (reqChannel) {
      await reqChannel.send({
        embeds: [
          new EmbedBuilder().setColor(COLORS.red).setTitle('❌ Request Denied')
            .addFields({ name: 'Reason', value: reason })
            .setTimestamp(),
        ],
      }).catch(() => {});
    }

    return interaction.reply({ embeds: [successEmbed('Mod Denied', [{ name: 'ID', value: requestId }])], ephemeral: true });
  },
};

// ── /complete-mod ─────────────────────────────────────────────────────────────
const completeModCmd = {
  data: new SlashCommandBuilder()
    .setName('complete-mod')
    .setDescription('Mark a mod as completed and archive the channel')
    .addStringOption(o => o.setName('request-id').setDescription('Request ID').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    if (!requirePerm(2)(interaction)) return;

    const requestId = interaction.options.getString('request-id').toUpperCase();
    const req = await getRequest(requestId);

    if (!req) return interaction.reply({ embeds: [errEmbed(`Request **${requestId}** not found.`)], ephemeral: true });
    if (!['approved','in_progress'].includes(req.status)) {
      return interaction.reply({ embeds: [errEmbed('Mod must be approved/in-progress to complete.')], ephemeral: true });
    }

    await updateRequestStatus(requestId, 'completed');

    // Give Customer role
    const guild = interaction.guild;
    const member = await guild.members.fetch(req.user_id).catch(() => null);
    const customerRole = guild.roles.cache.find(r => r.name === 'Customer');
    if (member && customerRole) await member.roles.add(customerRole).catch(() => {});

    // Move channel to completed category
    const completedCat = guild.channels.cache.find(
      c => c.type === 4 && c.name.toLowerCase().includes('mod requests')
    );
    const reqChannel = guild.channels.cache.get(req.channel_id);
    if (reqChannel) {
      await reqChannel.send({
        embeds: [
          new EmbedBuilder().setColor(COLORS.purple).setTitle('📦 Mod Completed!')
            .setDescription('Your mod has been completed! Check the files above. Thank you for using Minecraft Mod Makerz! 💎')
            .setTimestamp(),
        ],
      }).catch(() => {});
    }

    try {
      const du = await interaction.client.users.fetch(req.user_id);
      await du.send({
        embeds: [
          new EmbedBuilder().setColor(COLORS.emerald).setTitle('📦 Your Mod is Ready!')
            .setDescription(`**${req.mod_name}** has been completed! Check your request channel for the download.`)
            .setTimestamp(),
        ],
      });
    } catch {}

    return interaction.reply({ embeds: [successEmbed('📦 Mod Completed!', [{ name: 'Request', value: requestId }])], ephemeral: true });
  },
};

// ── /close-request ────────────────────────────────────────────────────────────
const closeRequestCmd = {
  data: new SlashCommandBuilder()
    .setName('close-request')
    .setDescription('Lock and close a mod request channel')
    .addStringOption(o => o.setName('request-id').setDescription('Request ID').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    if (!requirePerm(2)(interaction)) return;
    const requestId = interaction.options.getString('request-id').toUpperCase();
    const req = await getRequest(requestId);
    if (!req) return interaction.reply({ embeds: [errEmbed(`Request **${requestId}** not found.`)], ephemeral: true });

    const ch = interaction.guild.channels.cache.get(req.channel_id);
    if (ch) {
      await ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false }).catch(() => {});
      await ch.send({ embeds: [new EmbedBuilder().setColor(COLORS.red).setDescription('🔒 This request channel has been closed.')] }).catch(() => {});
    }
    return interaction.reply({ content: `🔒 Request **${requestId}** closed.`, ephemeral: true });
  },
};

// ── /warn ─────────────────────────────────────────────────────────────────────
const warnCmd = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a warning to a user')
    .addUserOption(o => o.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    if (!requirePerm(2)(interaction)) return;

    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    await pool.query(
      'INSERT INTO warnings (user_id, staff_id, reason) VALUES ($1, $2, $3)',
      [target.id, interaction.user.id, reason]
    );
    await pool.query('UPDATE users SET warnings = warnings + 1 WHERE user_id = $1', [target.id]);
    const userData = await pool.query('SELECT warnings FROM users WHERE user_id = $1', [target.id]);
    const warnCount = userData.rows[0]?.warnings ?? 1;

    try {
      await target.send({
        embeds: [
          new EmbedBuilder().setColor(COLORS.orange).setTitle('⚠️ You Have Been Warned')
            .addFields(
              { name: 'Server', value: interaction.guild.name, inline: true },
              { name: 'Reason', value: reason, inline: false },
              { name: 'Total Warnings', value: String(warnCount), inline: true },
            ).setTimestamp(),
        ],
      });
    } catch {}

    const logCh = interaction.guild.channels.cache.find(c => c.name === 'staff-logs');
    if (logCh) {
      await logCh.send({
        embeds: [
          new EmbedBuilder().setColor(COLORS.orange).setTitle('⚠️ Warning Issued')
            .addFields(
              { name: 'User',    value: `${target.tag} (${target.id})`, inline: true },
              { name: 'Staff',   value: `${interaction.user.tag}`,      inline: true },
              { name: 'Reason',  value: reason,                         inline: false },
              { name: 'Total',   value: String(warnCount),              inline: true },
            ).setTimestamp(),
        ],
      }).catch(() => {});
    }

    return interaction.reply({
      embeds: [successEmbed(`⚠️ Warning Issued to ${target.username}`, [
        { name: 'Reason', value: reason },
        { name: 'Total Warnings', value: String(warnCount) },
      ])],
      ephemeral: true,
    });
  },
};

// ── /lock-channel & /unlock-channel ──────────────────────────────────────────
const lockChannelCmd = {
  data: new SlashCommandBuilder()
    .setName('lock-channel')
    .setDescription('Lock the current channel for regular users')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!requirePerm(2)(interaction)) return;
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.red).setDescription('🔒 Channel locked.')] });
  },
};

const unlockChannelCmd = {
  data: new SlashCommandBuilder()
    .setName('unlock-channel')
    .setDescription('Unlock the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!requirePerm(2)(interaction)) return;
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.emerald).setDescription('🔓 Channel unlocked.')] });
  },
};

// ── Milestone helper ──────────────────────────────────────────────────────────
async function checkMilestoneRoles(guild, userId) {
  const res = await pool.query('SELECT total_spent FROM users WHERE user_id = $1', [userId]);
  const spent = res.rows[0]?.total_spent ?? 0;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  const milestones = [
    { threshold: 5000, role: 'Mod Legend' },
    { threshold: 2000, role: 'Mod Investor' },
    { threshold: 500,  role: 'Mod Supporter' },
  ];

  for (const m of milestones) {
    if (spent >= m.threshold) {
      const role = guild.roles.cache.find(r => r.name === m.role);
      if (role && !member.roles.cache.has(role.id)) {
        await member.roles.add(role).catch(() => {});
      }
    }
  }
}

module.exports = [priceModCmd, approveModCmd, denyModCmd, completeModCmd, closeRequestCmd, warnCmd, lockChannelCmd, unlockChannelCmd];
