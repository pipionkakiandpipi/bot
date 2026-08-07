const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  PermissionsBitField,
} = require('discord.js');
const config = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-commande')
    .setDescription('(Staff) Poste le message pour permettre aux clients de passer commande')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const targetChannel = config.salonCommande
      ? await interaction.guild.channels.fetch(config.salonCommande).catch(() => null)
      : interaction.channel;

    if (!targetChannel) {
      await interaction.reply({
        content: "❌ Je ne trouve pas le salon de commande configuré. Vérifie `SALON_COMMANDE` dans ton `.env`.",
        ephemeral: true,
      });
      return;
    }

    const me = interaction.guild.members.me ?? (await interaction.guild.members.fetchMe().catch(() => null));
    const permissions = targetChannel.permissionsFor(me);
    if (!permissions?.has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages])) {
      await interaction.reply({
        content: `❌ Je n'ai pas accès au salon ${targetChannel}. Donne-moi au minimum les permissions "Voir le salon" et "Envoyer des messages".`,
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🧾 Passer une commande')
      .setColor(0x5865f2)
      .setDescription(
        "Clique sur le bouton ci-dessous pour ouvrir un ticket privé et remplir le formulaire de commande (informations personnelles puis article souhaité).",
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('commande_start')
        .setLabel('Passer une commande')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🛒'),
    );

    await targetChannel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Message posté.', ephemeral: true });
  },
};
