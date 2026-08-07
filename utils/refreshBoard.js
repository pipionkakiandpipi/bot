const config = require('../config');
const { getBoardMessageId, setBoardMessageId } = require('./db');
const { buildClientsBoardEmbed } = require('./boards');

async function refreshClientsBoard(guild) {
  if (!config.salonTableauClients) return;
  const channel = await guild.channels.fetch(config.salonTableauClients).catch(() => null);
  if (!channel) return;

  const embed = buildClientsBoardEmbed();
  const existingId = getBoardMessageId();

  if (existingId) {
    const existingMsg = await channel.messages.fetch(existingId).catch(() => null);
    if (existingMsg) {
      await existingMsg.edit({ embeds: [embed] }).catch(() => {});
      return;
    }
  }

  const msg = await channel.send({ embeds: [embed] });
  setBoardMessageId(msg.id);
}

module.exports = { refreshClientsBoard };
