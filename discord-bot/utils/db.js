const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function ensureDBFile() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const initial = { orders: {}, captchas: {}, nextOrderNumber: 1, boardMessageId: null };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
  }
}

function loadDB() {
  ensureDBFile();
  if (!fs.existsSync(DB_PATH)) {
    const initial = { orders: {}, captchas: {}, nextOrderNumber: 1, boardMessageId: null };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// Génère un numéro de commande du type 0041
function getNextOrderNumber() {
  const db = loadDB();
  const num = db.nextOrderNumber;
  db.nextOrderNumber += 1;
  saveDB(db);
  return String(num).padStart(4, '0');
}

function createOrder(order) {
  const db = loadDB();
  db.orders[order.numero] = order;
  saveDB(db);
  return order;
}

function updateOrder(numero, patch) {
  const db = loadDB();
  if (!db.orders[numero]) return null;
  db.orders[numero] = { ...db.orders[numero], ...patch };
  saveDB(db);
  return db.orders[numero];
}

function getOrder(numero) {
  const db = loadDB();
  return db.orders[numero] || null;
}

function getAllOrders() {
  const db = loadDB();
  return Object.values(db.orders);
}

function getOrdersToRemind() {
  const db = loadDB();
  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  return Object.values(db.orders).filter(
    (o) =>
      o.statut === 'valide' &&
      !o.expedie &&
      !o.rappelEnvoye &&
      o.dateValidation &&
      now - o.dateValidation >= SEVEN_DAYS,
  );
}

function getBoardMessageId() {
  const db = loadDB();
  return db.boardMessageId;
}

function setBoardMessageId(id) {
  const db = loadDB();
  db.boardMessageId = id;
  saveDB(db);
}

module.exports = {
  loadDB,
  saveDB,
  getNextOrderNumber,
  createOrder,
  updateOrder,
  getOrder,
  getAllOrders,
  getOrdersToRemind,
  getBoardMessageId,
  setBoardMessageId,
};
