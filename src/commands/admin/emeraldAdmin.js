const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getUser, modifyEmeralds, setEmeralds, ensureUser } = require('../../db');
const { requirePerm, COLORS, errEmbed, successEmbed } = require('../../utils/helpers');

async function logEmeralds(guild, message) {
  const ch = guild.channels.cache.find(c => c.name === 'emerald-logs');
  if (ch) await ch.send({ content: `📋 ${message}` }).catch(() => {});
}

// ── /add-emeralds ─────────────────────────────────────────────────────────────
const addEmeraldsCmd = {
  data: new SlashCommandBuilder()
    .setName('add-emeralds')
    .setDescription('Add emeralds to a user')
    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Amount to add').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('reason').setDescription('Reason (optional)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!requirePerm(3)(interaction)) return;
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'Admin grant';
    await ensureUser(target.id, target.username);
    const newBal = await modifyEmeralds(target.id, amount, 'admin_add', reason);
    await logEmeralds(interaction.guild, `Admin ${interaction.user.tag} added 💎 ${amount} to ${target.tag} | Reason: ${reason} | Balance: ${newBal}`);
    return interaction.reply({ embeds: [successEmbed(`💎 Added ${amount} Emeralds to ${target.username}`, [
      { name: 'New Balance', value: `${newBal} Emeralds`, inline: true },
      { name: 'Reason', value: reason, inline: true },
    ])], ephemeral: true });
  },
};

// ── /remove-emeralds ──────────────────────────────────────────────────────────
const removeEmeraldsCmd = {
  data: new SlashCommandBuilder()
    .setName('remove-emeralds')
    .setDescription('Remove emeralds from a user')
    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Amount to remove').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('reason').setDescription('Reason (optional)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!requirePerm(3)(interaction)) return;
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'Admin removal';
    await ensureUser(target.id, target.username);
    const newBal = await modifyEmeralds(target.id, -amount, 'admin_remove', reason);
    await logEmeralds(interaction.guild, `Admin ${interaction.user.tag} removed 💎 ${amount} from ${target.tag} | Reason: ${reason} | Balance: ${newBal}`);
    return interaction.reply({ embeds: [successEmbed(`Removed ${amount} Emeralds from ${target.username}`, [
      { name: 'New Balance', value: `${newBal} Emeralds`, inline: true },
      { name: 'Reason', value: reason, inline: true },
    ])], ephemeral: true });
  },
};

// ── /set-emeralds ─────────────────────────────────────────────────────────────
const setEmeraldsCmd = {
  data: new SlashCommandBuilder()
    .setName('set-emeralds')
    .setDescription('Set a user\'s emerald balance to an exact amount')
    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('New balance').setRequired(true).setMinValue(0))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!requirePerm(3)(interaction)) return;
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    await ensureUser(target.id, target.username);
    const newBal = await setEmeralds(target.id, amount, 'Admin set balance');
    await logEmeralds(interaction.guild, `Admin ${interaction.user.tag} SET ${target.tag}'s balance to 💎 ${newBal}`);
    return interaction.reply({ embeds: [successEmbed(`Set ${target.username}'s balance to ${newBal} Emeralds`)], ephemeral: true });
  },
};

// ── /give-role ────────────────────────────────────────────────────────────────
const giveRoleCmd = {
  data: new SlashCommandBuilder()
    .setName('give-role')
    .setDescription('Give a role to a user')
    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Role to give').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    if (!requirePerm(3)(interaction)) return;
    const target = interaction.options.getMember('user');
    const role   = interaction.options.getRole('role');
    await target.roles.add(role);
    return interaction.reply({ embeds: [successEmbed(`Gave ${role.name} to ${target.user.username}`)], ephemeral: true });
  },
};

// ── /remove-role ──────────────────────────────────────────────────────────────
const removeRoleCmd = {
  data: new SlashCommandBuilder()
    .setName('remove-role')
    .setDescription('Remove a role from a user')
    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    if (!requirePerm(3)(interaction)) return;
    const target = interaction.options.getMember('user');
    const role   = interaction.options.getRole('role');
    await target.roles.remove(role);
    return interaction.reply({ embeds: [successEmbed(`Removed ${role.name} from ${target.user.username}`)], ephemeral: true });
  },
};

// ── /announce ─────────────────────────────────────────────────────────────────
const announceCmd = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Post an announcement embed to a channel')
    .addChannelOption(o => o.setName('channel').setDescription('Channel to post in').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Announcement content').setRequired(true))
    .addStringOption(o => o.setName('ping').setDescription('Who to ping (optional)').setRequired(false)
      .addChoices({ name: '@everyone', value: '@everyone' }, { name: 'No ping', value: 'none' }))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!requirePerm(3)(interaction)) return;
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');
    const ping    = interaction.options.getString('ping') || 'none';

    const embed = new EmbedBuilder()
      .setColor(COLORS.emerald)
      .setTitle('📢 Announcement')
      .setDescription(message)
      .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
      .setTimestamp();

    const content = ping === '@everyone' ? '@everyone' : undefined;
    await channel.send({ content, embeds: [embed] });

    return interaction.reply({ content: `✅ Announcement posted in ${channel}`, ephemeral: true });
  },
};

module.exports = [addEmeraldsCmd, removeEmeraldsCmd, setEmeraldsCmd, giveRoleCmd, removeRoleCmd, announceCmd];
