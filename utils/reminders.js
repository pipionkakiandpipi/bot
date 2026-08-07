const config = require('../config');
const { getOrdersToRemind, updateOrder } = require('./db');

function startReminderInterval(client) {
  const check = async () => {
    try {
      const orders = getOrdersToRemind();
      for (const order of orders) {
        const guild = client.guilds.cache.first();
        if (!guild) continue;

        if (order.ticketChannelId) {
          const ticketChannel = await guild.channels.fetch(order.ticketChannelId).catch(() => null);
          if (ticketChannel) {
            await ticketChannel
              .send({
                content: `⚠️ ${config.roleStaff ? `<@&${config.roleStaff}> ` : ''}La commande **#${order.numero}** est validée depuis 7 jours mais n'est toujours pas expédiée. N'oublie pas de taper \`/expedier\`.`,
                allowedMentions: { roles: config.roleStaff ? [config.roleStaff] : [] },
              })
              .catch(() => {});
          }
        }

        updateOrder(order.numero, { rappelEnvoye: true });
      }
    } catch (err) {
      console.error('Erreur rappel automatique:', err);
    }
  };

  setInterval(check, 60 * 60 * 1000);
  setTimeout(check, 5000);
}

module.exports = { startReminderInterval };
