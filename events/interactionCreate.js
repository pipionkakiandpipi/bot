const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const config = require('../config');
const { generateCaptcha, checkCaptcha } = require('../utils/captcha');
const { draftOrders } = require('../utils/draftOrders');
const { createOrder, getNextOrderNumber, getOrder, updateOrder } = require('../utils/db');
const { buildTrackingEmbed } = require('../utils/boards');
const { refreshClientsBoard } = require('../utils/refreshBoard');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      // ---------- SLASH COMMANDS ----------
      if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction);
        return;
      }

      // ---------- BOUTONS ----------
      if (interaction.isButton()) {
        // Bouton "Je ne suis pas un robot"
        if (interaction.customId === 'captcha_start') {
          const { question } = generateCaptcha(interaction.user.id);
          const modal = new ModalBuilder()
            .setCustomId('captcha_modal')
            .setTitle('Vérification anti-robot');

          const input = new TextInputBuilder()
            .setCustomId('captcha_answer')
            .setLabel(question)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(5);

          modal.addComponents(new ActionRowBuilder().addComponents(input));
          await interaction.showModal(modal);
          return;
        }

        // Bouton "Passer une commande"
        if (interaction.customId === 'commande_start') {
          const modal = buildEtape1Modal();
          await interaction.showModal(modal);
          return;
        }

        // Bouton "Compléter l'article" (dans le ticket, étape 2)
        if (interaction.customId === 'commande_etape2') {
          const draft = draftOrders.get(interaction.user.id);
          if (!draft) {
            await interaction.reply({
              content: "Impossible de retrouver ta commande en cours. Recommence via le salon commande.",
              ephemeral: true,
            });
            return;
          }
          const modal = buildEtape2Modal();
          await interaction.showModal(modal);
          return;
        }

        // Bouton "Fermer le ticket"
        if (interaction.customId === 'ticket_close') {
          if (!isStaffMember(interaction.member)) {
            await interaction.reply({ content: "Seul le staff peut fermer ce ticket.", ephemeral: true });
            return;
          }
          await interaction.reply({ content: '🔒 Ticket fermé, ce salon sera supprimé dans 5 secondes.' });
          setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
          return;
        }

        // Bouton "Valider la commande"
        if (interaction.customId.startsWith('commande_valider_')) {
          if (!isStaffMember(interaction.member)) {
            await interaction.reply({ content: "Seul le staff peut valider une commande.", ephemeral: true });
            return;
          }

          const numero = interaction.customId.replace('commande_valider_', '');
          const existing = getOrder(numero);
          if (!existing) {
            await interaction.reply({ content: `❌ Commande #${numero} introuvable.`, ephemeral: true });
            return;
          }
          if (existing.statut !== 'en_attente') {
            await interaction.reply({ content: `❌ Cette commande a déjà été traitée (statut: ${existing.statut}).`, ephemeral: true });
            return;
          }

          const order = updateOrder(numero, { statut: 'valide', dateValidation: Date.now() });

          // Met à jour l'embed de suivi
          if (config.salonSuiviCommande && order.trackingMessageId) {
            const channel = await interaction.guild.channels.fetch(config.salonSuiviCommande).catch(() => null);
            if (channel) {
              const msg = await channel.messages.fetch(order.trackingMessageId).catch(() => null);
              if (msg) await msg.edit({ embeds: [buildTrackingEmbed(order)] }).catch(() => {});
            }
          }

          // Ping le client dans le ticket
          if (order.ticketChannelId) {
            const ticketChannel = await interaction.guild.channels.fetch(order.ticketChannelId).catch(() => null);
            if (ticketChannel) {
              await ticketChannel.send({
                content: `<@${order.userId}> ✅ Ta commande **#${numero}** a été validée par le staff. Elle est maintenant en préparation.`,
                allowedMentions: { users: order.userId ? [order.userId] : [] },
              }).catch(() => {});
            }
          }

          await refreshClientsBoard(interaction.guild);
          await interaction.reply({ content: `✅ Commande #${numero} validée. Le client a été notifié.`, ephemeral: true });
          return;
        }

        // Bouton "Importer une photo"
        if (interaction.customId.startsWith('commande_photo_')) {
          const numero = interaction.customId.replace('commande_photo_', '');
          const order = getOrder(numero);
          if (!order) {
            await interaction.reply({ content: `❌ Commande #${numero} introuvable.`, ephemeral: true });
            return;
          }
          if (order.userId !== interaction.user.id && !isStaffMember(interaction.member)) {
            await interaction.reply({ content: 'Seul le client ou le staff peut importer une photo.', ephemeral: true });
            return;
          }

          draftOrders.set(`photo_${interaction.user.id}`, { numero, ticketChannelId: interaction.channelId });
          await interaction.reply({
            content: '📸 Envoie maintenant la photo de l\'article dans ce salon. Tu as 60 secondes.',
            ephemeral: true,
          });

          const filter = (m) => m.author.id === interaction.user.id && m.attachments.size > 0;
          try {
            const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
            const msg = collected.first();
            const attachment = msg.attachments.first();
            const photoUrl = attachment.url;
            updateOrder(numero, { photoUrl });

            const photoEmbed = new EmbedBuilder()
              .setTitle(`📸 Photo de l'article — Commande #${numero}`)
              .setColor(0x5865f2)
              .setImage(photoUrl)
              .setFooter({ text: `Ajoutée par ${interaction.user.tag}` });

            await interaction.channel.send({ embeds: [photoEmbed] });
            await msg.delete().catch(() => {});
            draftOrders.delete(`photo_${interaction.user.id}`);
          } catch (err) {
            draftOrders.delete(`photo_${interaction.user.id}`);
            await interaction.followUp({ content: '⏱️ Temps écoulé, aucune photo reçue.', ephemeral: true }).catch(() => {});
          }
          return;
        }

        // Bouton "Refuser la commande"
        if (interaction.customId.startsWith('commande_refuser_')) {
          if (!isStaffMember(interaction.member)) {
            await interaction.reply({ content: "Seul le staff peut refuser une commande.", ephemeral: true });
            return;
          }

          const numero = interaction.customId.replace('commande_refuser_', '');
          const existing = getOrder(numero);
          if (!existing) {
            await interaction.reply({ content: `❌ Commande #${numero} introuvable.`, ephemeral: true });
            return;
          }
          if (existing.statut !== 'en_attente') {
            await interaction.reply({ content: `❌ Cette commande a déjà été traitée (statut: ${existing.statut}).`, ephemeral: true });
            return;
          }

          const modal = new ModalBuilder()
            .setCustomId(`commande_refuser_modal_${numero}`)
            .setTitle(`Refus de la commande #${numero}`);

          const raisonInput = new TextInputBuilder()
            .setCustomId('raison_refus')
            .setLabel('Raison du refus')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(500);

          modal.addComponents(new ActionRowBuilder().addComponents(raisonInput));
          await interaction.showModal(modal);
          return;
        }

        return;
      }

      // ---------- MODALS ----------
      if (interaction.isModalSubmit()) {
        // Réponse au captcha
        if (interaction.customId === 'captcha_modal') {
          const value = interaction.fields.getTextInputValue('captcha_answer');
          const ok = checkCaptcha(interaction.user.id, value);

          if (!ok) {
            await interaction.reply({
              content: '❌ Mauvaise réponse, reclique sur le bouton pour réessayer.',
              ephemeral: true,
            });
            return;
          }

          const member = interaction.member;
          if (config.roleNonVerifie) await member.roles.remove(config.roleNonVerifie).catch(() => {});
          if (config.roleMembre) await member.roles.add(config.roleMembre).catch(() => {});

          const tourEmbed = new EmbedBuilder()
            .setTitle('✅ Vérification réussie — Bienvenue !')
            .setColor(0x22c55e)
            .setDescription(
              [
                'Voici un petit tour des salons importants :',
                config.salonCatalogue ? `🛍️ Catalogue : <#${config.salonCatalogue}>` : null,
                config.salonHistorique ? `🕘 Historique / passé : <#${config.salonHistorique}>` : null,
                config.salonCommande ? `🧾 Commande : <#${config.salonCommande}>` : null,
                config.salonSuiviCommande ? `📦 Suivi de commande : <#${config.salonSuiviCommande}>` : null,
                config.salonPaiement ? `💳 Paiement : <#${config.salonPaiement}>` : null,
              ]
                .filter(Boolean)
                .join('\n'),
            );

          await interaction.reply({ embeds: [tourEmbed], ephemeral: true });
          return;
        }

        // Formulaire de commande - étape 1 (identité + contact)
        if (interaction.customId === 'commande_modal_etape1') {
          const nom = interaction.fields.getTextInputValue('nom');
          const prenom = interaction.fields.getTextInputValue('prenom');
          const adresse = interaction.fields.getTextInputValue('adresse');
          const email = interaction.fields.getTextInputValue('email');
          const telephone = interaction.fields.getTextInputValue('telephone');

          await interaction.deferReply({ ephemeral: true });

          // Crée le salon ticket privé
          const guild = interaction.guild;
          const overwrites = [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
              id: interaction.user.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
            },
          ];
          if (config.roleStaff) {
            overwrites.push({
              id: config.roleStaff,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
            });
          }

          const ticketChannel = await guild.channels.create({
            name: `commande-${interaction.user.username}`.slice(0, 90),
            type: ChannelType.GuildText,
            parent: config.categorieTickets || undefined,
            permissionOverwrites: overwrites,
          });

          draftOrders.set(interaction.user.id, {
            nom,
            prenom,
            adresse,
            email,
            telephone,
            ticketChannelId: ticketChannel.id,
          });

          const recapEmbed = new EmbedBuilder()
            .setTitle('🧾 Nouvelle demande de commande')
            .setColor(0x5865f2)
            .addFields(
              { name: 'Nom', value: nom, inline: true },
              { name: 'Prénom', value: prenom, inline: true },
              { name: 'Adresse postale complète', value: adresse },
              { name: 'Email', value: email, inline: true },
              { name: 'Téléphone', value: telephone, inline: true },
            )
            .setFooter({ text: "Étape 2 : clique sur le bouton ci-dessous pour préciser l'article souhaité." });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('commande_etape2')
              .setLabel("Préciser l'article souhaité")
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🛍️'),
            new ButtonBuilder()
              .setCustomId('ticket_close')
              .setLabel('Fermer le ticket')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('🔒'),
          );

          await ticketChannel.send({
            content: `${interaction.user} ${config.roleStaff ? `<@&${config.roleStaff}>` : ''}`,
            embeds: [recapEmbed],
            components: [row],
          });

          await interaction.editReply({
            content: `✅ Ton ticket a été créé : ${ticketChannel}`,
          });
          return;
        }

        // Formulaire de commande - étape 2 (article)
        if (interaction.customId === 'commande_modal_etape2') {
          const draft = draftOrders.get(interaction.user.id);
          if (!draft) {
            await interaction.reply({
              content: 'Session expirée, recommence la commande depuis le salon commande.',
              ephemeral: true,
            });
            return;
          }

          const article = interaction.fields.getTextInputValue('article');
          const marque = interaction.fields.getTextInputValue('marque');
          const taille = interaction.fields.getTextInputValue('taille');
          const quantite = interaction.fields.getTextInputValue('quantite');

          if (!['1', '2', '3'].includes(quantite.trim())) {
            await interaction.reply({
              content: '❌ La quantité doit être 1, 2 ou 3. Recommence l\'étape 2.',
              ephemeral: true,
            });
            return;
          }

          const numero = getNextOrderNumber();
          const order = {
            numero,
            userId: interaction.user.id,
            nom: draft.nom,
            prenom: draft.prenom,
            adresse: draft.adresse,
            email: draft.email,
            telephone: draft.telephone,
            article,
            marque,
            taille,
            quantite,
            statut: 'en_attente',
            expedie: false,
            transporteur: null,
            numeroSuivi: null,
            ticketChannelId: draft.ticketChannelId,
            trackingMessageId: null,
            dateValidation: null,
            raisonRefus: null,
            rappelEnvoye: false,
          };
          createOrder(order);
          draftOrders.delete(interaction.user.id);

          const finalEmbed = new EmbedBuilder()
            .setTitle(`✅ Commande #${numero} complète`)
            .setColor(0x22c55e)
            .addFields(
              { name: 'Client', value: `${draft.prenom} ${draft.nom}`, inline: true },
              { name: 'Article', value: article, inline: true },
              { name: 'Marque', value: marque, inline: true },
              { name: 'Taille', value: taille, inline: true },
              { name: 'Quantité', value: String(quantite), inline: true },
            )
            .setFooter({ text: 'Le staff va maintenant traiter le paiement et l\'expédition.' });

          await interaction.reply({ embeds: [finalEmbed] });

          // Bouton pour importer une photo de l'article dans le ticket
          const ticketChannelForPhoto = await interaction.guild.channels
            .fetch(draft.ticketChannelId)
            .catch(() => null);
          if (ticketChannelForPhoto) {
            const photoRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`commande_photo_${numero}`)
                .setLabel('Importer une photo de l\'article')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📸'),
            );
            await ticketChannelForPhoto.send({
              content: `${interaction.user} 📸 Tu peux importer une photo de l'article souhaité en cliquant sur le bouton ci-dessous, puis en envoyant l'image dans ce salon.`,
              components: [photoRow],
            }).catch(() => {});
          }

          // Poste le suivi de commande dans le salon dédié
          if (config.salonSuiviCommande) {
            const trackingChannel = await interaction.guild.channels
              .fetch(config.salonSuiviCommande)
              .catch(() => null);
            if (trackingChannel) {
              const msg = await trackingChannel.send({ embeds: [buildTrackingEmbed(order)] });
              updateOrder(numero, { trackingMessageId: msg.id });
            }
          }

          // Poste les boutons de validation dans le ticket pour le staff
          const ticketChannel = await interaction.guild.channels
            .fetch(draft.ticketChannelId)
            .catch(() => null);
          if (ticketChannel) {
            const validationRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`commande_valider_${numero}`)
                .setLabel('Valider la commande')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
              new ButtonBuilder()
                .setCustomId(`commande_refuser_${numero}`)
                .setLabel('Refuser la commande')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌'),
            );
            await ticketChannel.send({
              content: config.roleStaff ? `🔔 <@&${config.roleStaff}> Veuillez valider ou refuser cette commande.` : '🔔 Veuillez valider ou refuser cette commande.',
              components: [validationRow],
            }).catch(() => {});
          }

          await refreshClientsBoard(interaction.guild);
          return;
        }

        // Modal de refus de commande
        if (interaction.customId.startsWith('commande_refuser_modal_')) {
          const numero = interaction.customId.replace('commande_refuser_modal_', '');
          const raison = interaction.fields.getTextInputValue('raison_refus');

          const existing = getOrder(numero);
          if (!existing) {
            await interaction.reply({ content: `❌ Commande #${numero} introuvable.`, ephemeral: true });
            return;
          }

          const order = updateOrder(numero, { statut: 'refuse', raisonRefus: raison });

          // Met à jour l'embed de suivi
          if (config.salonSuiviCommande && order.trackingMessageId) {
            const channel = await interaction.guild.channels.fetch(config.salonSuiviCommande).catch(() => null);
            if (channel) {
              const msg = await channel.messages.fetch(order.trackingMessageId).catch(() => null);
              if (msg) await msg.edit({ embeds: [buildTrackingEmbed(order)] }).catch(() => {});
            }
          }

          // Ping le client dans le ticket avec la raison + bouton fermer
          if (order.ticketChannelId) {
            const ticketChannel = await interaction.guild.channels.fetch(order.ticketChannelId).catch(() => null);
            if (ticketChannel) {
              const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId('ticket_close')
                  .setLabel('Fermer le ticket')
                  .setStyle(ButtonStyle.Danger)
                  .setEmoji('🔒'),
              );
              await ticketChannel.send({
                content: `<@${order.userId}> ❌ Ta commande **#${numero}** a été refusée.\n**Raison :** ${raison}`,
                allowedMentions: { users: order.userId ? [order.userId] : [] },
                components: [closeRow],
              }).catch(() => {});
            }
          }

          await refreshClientsBoard(interaction.guild);
          await interaction.reply({ content: `❌ Commande #${numero} refusée. Le client a été notifié.`, ephemeral: true });
          return;
        }
      }
    } catch (err) {
      console.error('Erreur interactionCreate:', err);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction
          .reply({ content: "❌ Une erreur est survenue, réessaie ou préviens le staff.", ephemeral: true })
          .catch(() => {});
      }
    }
  },
};

function isStaffMember(member) {
  const roles = member.roles.cache;
  return !!(
    (config.roleStaff && roles.has(config.roleStaff)) ||
    (config.roleAdmin && roles.has(config.roleAdmin)) ||
    (config.roleOwner && roles.has(config.roleOwner))
  );
}

function buildEtape1Modal() {
  const modal = new ModalBuilder().setCustomId('commande_modal_etape1').setTitle('Commande — Étape 1/2');
  const nom = new TextInputBuilder().setCustomId('nom').setLabel('Nom').setStyle(TextInputStyle.Short).setRequired(true);
  const prenom = new TextInputBuilder().setCustomId('prenom').setLabel('Prénom').setStyle(TextInputStyle.Short).setRequired(true);
  const adresse = new TextInputBuilder()
    .setCustomId('adresse')
    .setLabel('Adresse postale complète')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);
  const email = new TextInputBuilder().setCustomId('email').setLabel('Adresse e-mail').setStyle(TextInputStyle.Short).setRequired(true);
  const telephone = new TextInputBuilder()
    .setCustomId('telephone')
    .setLabel('Numéro de téléphone')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nom),
    new ActionRowBuilder().addComponents(prenom),
    new ActionRowBuilder().addComponents(adresse),
    new ActionRowBuilder().addComponents(email),
    new ActionRowBuilder().addComponents(telephone),
  );
  return modal;
}

function buildEtape2Modal() {
  const modal = new ModalBuilder().setCustomId('commande_modal_etape2').setTitle('Commande — Étape 2/2');
  const article = new TextInputBuilder().setCustomId('article').setLabel('Article souhaité').setStyle(TextInputStyle.Short).setRequired(true);
  const marque = new TextInputBuilder().setCustomId('marque').setLabel('Marque').setStyle(TextInputStyle.Short).setRequired(true);
  const taille = new TextInputBuilder().setCustomId('taille').setLabel('Taille').setStyle(TextInputStyle.Short).setRequired(true);
  const quantite = new TextInputBuilder()
    .setCustomId('quantite')
    .setLabel('Quantité souhaitée (1, 2 ou 3)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(1);

  modal.addComponents(
    new ActionRowBuilder().addComponents(article),
    new ActionRowBuilder().addComponents(marque),
    new ActionRowBuilder().addComponents(taille),
    new ActionRowBuilder().addComponents(quantite),
  );
  return modal;
}
