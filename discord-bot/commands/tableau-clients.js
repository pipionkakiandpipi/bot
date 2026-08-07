const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { refreshClientsBoard } = require('../utils/refreshBoard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tableau-clients')
    .setDescription('(Staff) Affiche/rafraîchit le tableau des clients à traiter')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    await refreshClientsBoard(interaction.guild);
    await interaction.editReply('✅ Tableau clients mis à jour.');
  },
};
