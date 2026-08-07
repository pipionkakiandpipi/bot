const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      // Donne le rôle "non vérifié" dès l'arrivée
      if (config.roleNonVerifie) {
        await member.roles.add(config.roleNonVerifie).catch(() => {});
      }

      if (config.salonVerification) {
        const channel = await member.guild.channels
          .fetch(config.salonVerification)
          .catch(() => null);

        if (channel) {
          const embed = new EmbedBuilder()
            .setTitle('👋 Bienvenue !')
            .setDescription(
              `Bienvenue ${member} !\nPour accéder au serveur, clique sur le bouton **"Je ne suis pas un robot"** ci-dessous et réponds à la petite question qui s'affichera.`,
            )
            .setColor(0x5865f2);

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('captcha_start')
              .setLabel('Je ne suis pas un robot')
              .setStyle(ButtonStyle.Success)
              .setEmoji('✅'),
          );

          await channel.send({ content: `${member}`, embeds: [embed], components: [row] }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Erreur guildMemberAdd:', err);
    }
  },
};
