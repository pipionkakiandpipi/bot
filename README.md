# Bot Discord — Boutique

Bot Discord complet pour gérer une boutique : vérification anti-robot à l'arrivée, tickets de commande privés, suivi de commande en temps réel, et tableau de bord pour le staff.

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Prérequis](#prérequis)
3. [Installation](#installation)
4. [Configuration du `.env`](#configuration-du-env)
5. [Configuration des rôles et salons sur Discord](#configuration-des-rôles-et-salons-sur-discord)
6. [Démarrage](#démarrage)
7. [Commandes slash](#commandes-slash)
8. [Guide d'utilisation pas à pas](#guide-dutilisation-pas-à-pas)
9. [Hébergement 24/7](#hébergement-247)
10. [Notes techniques](#notes-techniques)

---

## Fonctionnalités

- **Vérification captcha** : chaque nouveau membre doit résoudre une petite question mathématique avant d'accéder au serveur.
- **Tickets de commande privés** : un salon privé est créé automatiquement pour chaque commande (visible uniquement par le client et le staff).
- **Formulaire en 2 étapes** : informations personnelles (nom, prénom, adresse, email, téléphone) puis article souhaité (article, marque, taille, quantité).
- **Suivi de commande** : chaque commande est affichée dans un salon dédié avec un statut visuel (🔴 Non expédié → 🟢 Expédié).
- **Expédition avec ping** : quand le staff marque une commande comme expédiée, le client reçoit un ping dans son ticket avec le transporteur et le numéro de suivi.
- **Tableau de bord** : un embed récapitulatif liste toutes les commandes, mis à jour automatiquement.

---

## Prérequis

- **Node.js 18+** installé sur ta machine ([télécharger ici](https://nodejs.org/))
- Un serveur Discord où tu as les droits administrateur
- Le **Mode développeur** activé sur Discord (Paramètres → Avancés → Mode développeur)

---

## Installation

```bash
# 1. Installe les dépendances
npm install

# 2. Copie le fichier d'exemple de configuration
cp .env.example .env
```

> **Windows (PowerShell)** : `Copy-Item .env.example .env`

---

## Configuration du `.env`

Ouvre le fichier `.env` et remplis chaque valeur. Voici à quoi correspond chaque variable :

### Bot

| Variable | Description | Où la trouver |
|---|---|---|
| `DISCORD_TOKEN` | Token secret du bot | [Developer Portal](https://discord.com/developers/applications) → ton app → **Bot** → **Reset Token** |
| `CLIENT_ID` | ID de l'application | Developer Portal → ton app → **General Information** → **Application ID** |
| `GUILD_ID` | ID de ton serveur | Clic droit sur ton serveur → **Copier l'identifiant** |

### Rôles (à créer sur ton serveur d'abord)

| Variable | Description |
|---|---|
| `ROLE_NON_VERIFIE` | Rôle donné automatiquement aux nouveaux membres (accès limité) |
| `ROLE_MEMBRE` | Rôle donné après réussite du captcha (accès complet) |
| `ROLE_STAFF` | Rôle du staff qui peut gérer les commandes et tickets |

### Salons (à créer sur ton serveur d'abord)

| Variable | Description |
|---|---|
| `SALON_VERIFICATION` | Salon où le captcha est posté (visible par tout le monde) |
| `SALON_ACCUEIL` | Salon d'accueil (non utilisé activement par le bot mais référencé) |
| `SALON_CATALOGUE` | Salon du catalogue (référencé dans le tour du serveur) |
| `SALON_HISTORIQUE` | Salon de l'historique (référencé dans le tour) |
| `SALON_COMMANDE` | Salon où le bouton "Passer une commande" est posté |
| `SALON_SUIVI_COMMANDE` | Salon où les embeds de suivi sont postés |
| `SALON_PAIEMENT` | Salon de paiement (référencé dans le tour) |
| `SALON_TABLEAU_CLIENTS` | Salon où le tableau de bord est posté |
| `CATEGORIE_TICKETS` | Catégorie Discord où les tickets de commande seront créés |

---

## Configuration des rôles et salons sur Discord

### Étape 1 — Créer les 3 rôles

Sur ton serveur : **Paramètres du serveur → Rôles → Nouveau rôle**

1. **Non vérifié** — couleur grise, aucune permission spéciale
2. **Membre** — accès aux salons de la boutique
3. **Staff** — accès aux tickets + permissions de gestion

### Étape 2 — Créer les salons

Crée les salons suivants et récupère leurs IDs (clic droit → Copier l'identifiant) :

- `#vérification` — visible par @everyone
- `#catalogue` — visible par le rôle Membre
- `#historique` — visible par le rôle Membre
- `#commande` — visible par le rôle Membre
- `#suivi-de-commande` — visible par le rôle Membre
- `#paiement` — visible par le rôle Membre
- `#tableau-clients` — visible par le rôle Staff
- Catégorie `Tickets` — pour les tickets de commande

### Étape 3 — Configurer les permissions

- **Rôle @everyone** : peut voir `#vérification` uniquement
- **Rôle Non vérifié** : peut voir `#vérification` uniquement
- **Rôle Membre** : peut voir tous les salons sauf `#tableau-clients` (staff only)
- **Rôle Staff** : peut voir tous les salons + les tickets

### Étape 4 — Inviter le bot

1. Va sur le [Developer Portal](https://discord.com/developers/applications) → ton app → **OAuth2 → URL Generator**
2. Coche : `bot` et `applications.commands`
3. Permissions du bot : `Manage Roles`, `Manage Channels`, `Send Messages`, `Manage Messages`, `Embed Links`, `Read Message History`
4. Ouvre l'URL générée et ajoute le bot à ton serveur

### Étape 5 — Activer les intents

Developer Portal → ton app → **Bot** → active :
- ✅ **Server Members Intent**
- ✅ **Message Content Intent**

---

## Démarrage

```bash
# 1. Déploie les commandes slash sur ton serveur
node deploy-commands.js

# 2. Lance le bot
npm start
```

Tu devrais voir : `✅ Connecté en tant que TonBot#1234`

### Mise en place initiale dans les salons

Une fois le bot en ligne :

1. Dans le salon `#commande`, tape `/setup-commande` → le bot poste le bouton "Passer une commande"
2. Dans le salon `#tableau-clients`, tape `/tableau-clients` → le tableau de bord est créé (il se mettra à jour tout seul ensuite)

---

## Commandes slash

| Commande | Description | Permission |
|---|---|---|
| `/setup-commande` | Poste le bouton "Passer une commande" dans le salon configuré | Gérer le serveur |
| `/expedier` `numero` `transporteur` `suivi` | Marque une commande comme expédiée + ping le client dans son ticket | Gérer le serveur |
| `/tableau-clients` | Affiche ou rafraîchit le tableau de bord des commandes | Gérer le serveur |

### Détail de `/expedier`

- **numero** : numéro de commande (ex: `0041`)
- **transporteur** : `Colissimo` ou `Chronopost`
- **suivi** : numéro de suivi du colis

Effets :
1. Le statut de la commande passe à 🟢 Expédié
2. L'embed dans `#suivi-de-commande` est mis à jour
3. Le client reçoit un **ping** dans son ticket avec le transporteur et le numéro de suivi
4. Le tableau de bord est rafraîchi

---

## Guide d'utilisation pas à pas

### Côté client

1. **Arrivée sur le serveur** → le membre reçoit le rôle "Non vérifié"
2. **Captcha** → il clique sur "Je ne suis pas un robot" et répond à la question
3. **Vérification réussie** → il reçoit le rôle "Membre" + un message avec les liens des salons
4. **Commande** → il va dans `#commande` et clique sur "Passer une commande"
5. **Étape 1** → il remplit : Nom, Prénom, Adresse, Email, Téléphone → un ticket privé est créé
6. **Étape 2** → dans le ticket, il clique sur "Préciser l'article" et remplit : Article, Marque, Taille, Quantité
7. **Confirmation** → un numéro de commande est généré (ex: `#0041`) et l'embed de suivi est posté
8. **Expédition** → il reçoit un ping dans son ticket quand le staff expédie la commande

### Côté staff

1. **Setup initial** → `/setup-commande` dans `#commande` + `/tableau-clients` dans `#tableau-clients`
2. **Réception d'une commande** → le staff est ping dans le ticket, il voit toutes les infos client
3. **Traitement** → le staff gère le paiement avec le client dans le ticket
4. **Expédition** → le staff tape `/expedier` avec le numéro, le transporteur et le suivi
5. **Fermeture du ticket** → le staff clique sur "Fermer le ticket" → le salon est supprimé après 5 secondes

---

## Hébergement 24/7

Le bot doit tourner en continu. Options recommandées :

- **Railway** ([railway.app](https://railway.app)) — gratuit pour petits projets, déploiement Git
- **Render** ([render.com](https://render.com)) — plan gratuit avec limitation
- **VPS** (OVH, Hetzner, etc.) — le plus fiable, utilise `pm2` pour gérer le processus :
  ```bash
  npm install -g pm2
  pm2 start index.js --name discord-bot
  pm2 save
  pm2 startup
  ```

---

## Notes techniques

- **Stockage** : les données sont dans `data/db.json` (commandes, numéros, captchas en mémoire). Fais des sauvegardes régulières.
- **Sécurité** : ne partage **jamais** ton token Discord. Ne le mets pas dans un fichier public (git, README, etc.). Le fichier `.env` doit être dans `.gitignore`.
- **Limite Discord** : les formulaires (modals) sont limités à 5 champs, d'où la division en 2 étapes (9 champs au total).
- **Numérotation** : les commandes sont numérotées séquentiellement à partir de `0001`, formaté sur 4 chiffres.
