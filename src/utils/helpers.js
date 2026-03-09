const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// ── Colours ───────────────────────────────────────────────────────────────────
const COLORS = {
  emerald:  0x50fa7b,
  gold:     0xf1fa8c,
  red:      0xff5555,
  blue:     0x8be9fd,
  purple:   0xbd93f9,
  orange:   0xffb86c,
};

// ── Permission level check ────────────────────────────────────────────────────
// L4 = Owner, L3 = Admin role, L2 = Staff role, L1 = Verified role
function getPermLevel(member, guild) {
  if (member.id === process.env.OWNER_ID) return 4;

  const roles = member.roles.cache;
  const find = (name) => guild.roles.cache.find(r => r.name === name);

  if (roles.has(find('Admin')?.id))  return 3;
  if (roles.has(find('Staff')?.id))  return 2;
  if (roles.has(find('Verified')?.id)) return 1;
  return 0;
}

function requirePerm(level) {
  const labels = { 4: 'Server Owner', 3: 'Admin', 2: 'Staff', 1: 'Verified' };
  return (interaction) => {
    const perm = getPermLevel(interaction.member, interaction.guild);
    if (perm < level) {
      interaction.reply({
        embeds: [errEmbed(`🔒 You need the **${labels[level]}** role to use this command.`)],
        ephemeral: true,
      });
      return false;
    }
    return true;
  };
}

// ── Standard embeds ───────────────────────────────────────────────────────────
function successEmbed(title, fields = [], description = null) {
  const e = new EmbedBuilder().setColor(COLORS.emerald).setTitle(title);
  if (description) e.setDescription(description);
  if (fields.length) e.addFields(fields);
  e.setTimestamp();
  return e;
}

function errEmbed(message) {
  return new EmbedBuilder()
    .setColor(COLORS.red)
    .setTitle('❌ Error')
    .setDescription(message)
    .setTimestamp();
}

function infoEmbed(title, fields = [], color = COLORS.blue) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .addFields(fields)
    .setTimestamp();
}

module.exports = { COLORS, getPermLevel, requirePerm, successEmbed, errEmbed, infoEmbed };
