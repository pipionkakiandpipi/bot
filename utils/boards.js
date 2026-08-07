const { EmbedBuilder } = require('discord.js');
const { getAllOrders } = require('./db');

const CARRIER_LABELS = {
  colissimo: 'Colissimo',
  chronopost: 'Chronopost',
};

const STATUT_INFO = {
  en_attente: { label: '🔵 En attente de validation', color: 0x3b82f6, order: 0 },
  valide: { label: '🟡 Validé — en préparation', color: 0xeab308, order: 1 },
  expedie: { label: '🟢 Expédié', color: 0x22c55e, order: 2 },
  refuse: { label: '⚫ Refusée', color: 0x6b7280, order: 3 },
};

function getStatutInfo(order) {
  if (order.expedie) return STATUT_INFO.expedie;
  return STATUT_INFO[order.statut] || STATUT_INFO.en_attente;
}

// Construit l'embed "tableau clients" : toutes les commandes à traiter (non expédiées d'abord)
function buildClientsBoardEmbed() {
  const orders = getAllOrders().sort((a, b) => {
    const sa = getStatutInfo(a).order;
    const sb = getStatutInfo(b).order;
    return sa - sb;
  });

  const embed = new EmbedBuilder()
    .setTitle('📋 Tableau des clients — Commandes à traiter')
    .setColor(0x2b2d31)
    .setTimestamp();

  if (orders.length === 0) {
    embed.setDescription('Aucune commande enregistrée pour le moment.');
    return embed;
  }

  const lignes = orders.map((o) => {
    const statut = getStatutInfo(o).label;
    return (
      `**#${o.numero}** — ${o.prenom} ${o.nom}\n` +
      `> Marque : ${o.marque} | Taille : ${o.taille} | Qté : ${o.quantite}\n` +
      `> Statut : ${statut}`
    );
  });

  // Discord limite un embed à 4096 caractères en description, on découpe en fields si besoin
  embed.setDescription(lignes.join('\n\n').slice(0, 4090));
  return embed;
}

// Construit l'embed "suivi de commande" pour UNE commande précise
function buildTrackingEmbed(order) {
  const info = getStatutInfo(order);
  const statutCouleur = info.color;
  const statutTexte = info.label;

  const embed = new EmbedBuilder()
    .setTitle(`📦 Commande #${order.numero}`)
    .setColor(statutCouleur)
    .addFields(
      { name: 'Client', value: `${order.prenom} ${order.nom}`, inline: true },
      { name: 'Statut', value: statutTexte, inline: true },
      {
        name: 'Article',
        value: `${order.article} — ${order.marque} (taille ${order.taille}) x${order.quantite}`,
        inline: false,
      },
    )
    .setTimestamp();

  if (order.expedie) {
    embed.addFields(
      { name: 'Transporteur', value: CARRIER_LABELS[order.transporteur] || order.transporteur || '—', inline: true },
      { name: 'Numéro de suivi', value: order.numeroSuivi || '—', inline: true },
    );
  }

  return embed;
}

module.exports = { buildClientsBoardEmbed, buildTrackingEmbed, CARRIER_LABELS, STATUT_INFO, getStatutInfo };
