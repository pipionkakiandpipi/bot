const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const { getOrder, updateOrder } = require('../utils/db');
const { buildTrackingEmbed, CARRIER_LABELS } = require('../utils/boards');
const { refreshClientsBoard } = require('../utils/refreshBoard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('expedier')
    .setDescription('(Staff) Marque une commande comme expédiée')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt.setName('numero').setDescription('Numéro de commande, ex: 0041').setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('transporteur')
        .setDescription('Transporteur')
        .setRequired(true)
        .addChoices({ name: 'Colissimo', value: 'colissimo' }, { name: 'Chronopost', value: 'chronopost' }),
    )
    .addStringOption((opt) =>
      opt.setName('suivi').setDescription('Numéro de suivi du colis').setRequired(true),
    ),

  async execute(interaction) {
    const numero = interaction.options.getString('numero').trim();
    const transporteur = interaction.options.getString('transporteur');
    const suivi = interaction.options.getString('suivi').trim();

    const existing = getOrder(numero);
    if (!existing) {
      await interaction.reply({ content: `❌ Commande #${numero} introuvable.`, ephemeral: true });
      return;
    }

    if (existing.statut === 'en_attente') {
      await interaction.reply({ content: `❌ Cette commande n'a pas encore été validée par le staff. Valide-la d'abord.`, ephemeral: true });
      return;
    }

    if (existing.statut === 'refuse') {
      await interaction.reply({ content: `❌ Cette commande a été refusée, elle ne peut pas être expédiée.`, ephemeral: true });
      return;
    }

    const order = updateOrder(numero, { expedie: true, transporteur, numeroSuivi: suivi });

    // Met à jour l'embed dans le salon "suivi de commande"
    if (config.salonSuiviCommande && order.trackingMessageId) {
      const channel = await interaction.guild.channels.fetch(config.salonSuiviCommande).catch(() => null);
      if (channel) {
        const msg = await channel.messages.fetch(order.trackingMessageId).catch(() => null);
        if (msg) await msg.edit({ embeds: [buildTrackingEmbed(order)] }).catch(() => {});
      }
    }

    // Prévient dans le ticket du client s'il existe encore (en pingant le client)
    if (order.ticketChannelId) {
      const ticketChannel = await interaction.guild.channels.fetch(order.ticketChannelId).catch(() => null);
      if (ticketChannel) {
        const carrierLabel = CARRIER_LABELS[transporteur] || transporteur;
        await ticketChannel
          .send({
            content: `<@${order.userId}> 📦 Ta commande **#${numero}** vient d'être expédiée via **${carrierLabel}**.\nNuméro de suivi : \`${suivi}\``,
            allowedMentions: { users: order.userId ? [order.userId] : [] },
          })
          .catch(() => {});
      }
    }

    await refreshClientsBoard(interaction.guild);

    const carrierLabel = CARRIER_LABELS[transporteur] || transporteur;
    await interaction.reply({
      content: `🟢 Commande #${numero} marquée comme **expédiée** (${carrierLabel}, suivi: ${suivi}).`,
      ephemeral: true,
    });
  },
};
