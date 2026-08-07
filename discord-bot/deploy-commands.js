const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const config = require('./config');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  commands.push(command.data.toJSON());
}

const rest = new REST().setToken(config.token);

(async () => {
  try {
    console.log(`Déploiement de ${commands.length} commande(s) slash...`);

    const clientId = process.env.CLIENT_ID;
    if (!clientId) {
      console.error("❌ Ajoute CLIENT_ID dans ton .env (Application ID du bot, dans le Developer Portal).");
      process.exit(1);
    }

    if (config.guildId) {
      // Déploiement instantané sur un seul serveur (recommandé en dev)
      await rest.put(Routes.applicationGuildCommands(clientId, config.guildId), { body: commands });
      console.log('✅ Commandes déployées sur le serveur (GUILD_ID).');
    } else {
      // Déploiement global (peut prendre jusqu'à 1h à apparaître)
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('✅ Commandes déployées globalement.');
    }
  } catch (err) {
    console.error(err);
  }
})();
