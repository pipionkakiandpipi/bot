const { startReminderInterval } = require('../utils/reminders');

module.exports = {
  name: 'clientReady',
  once: true,
  execute(client) {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);
    startReminderInterval(client);
  },
};
