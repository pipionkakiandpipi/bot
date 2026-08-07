require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  guildId: process.env.GUILD_ID,

  roleNonVerifie: process.env.ROLE_NON_VERIFIE,
  roleMembre: process.env.ROLE_MEMBRE,
  roleStaff: process.env.ROLE_STAFF,
  roleAdmin: process.env.ROLE_ADMIN,
  roleOwner: process.env.ROLE_OWNER,

  salonVerification: process.env.SALON_VERIFICATION,
  salonAccueil: process.env.SALON_ACCUEIL,

  salonCatalogue: process.env.SALON_CATALOGUE,
  salonHistorique: process.env.SALON_HISTORIQUE,
  salonCommande: process.env.SALON_COMMANDE,
  salonSuiviCommande: process.env.SALON_SUIVI_COMMANDE,
  salonPaiement: process.env.SALON_PAIEMENT,

  categorieTickets: process.env.CATEGORIE_TICKETS,
  salonTableauClients: process.env.SALON_TABLEAU_CLIENTS,
};
