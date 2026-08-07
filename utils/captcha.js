// Stock en mémoire des captchas en attente : userId -> réponse attendue
const pendingCaptchas = new Map();

function generateCaptcha(userId) {
  const a = Math.floor(Math.random() * 8) + 1;
  const b = Math.floor(Math.random() * 8) + 1;
  const answer = a + b;
  pendingCaptchas.set(userId, answer);
  return { question: `Combien font ${a} + ${b} ?`, answer };
}

function checkCaptcha(userId, value) {
  const expected = pendingCaptchas.get(userId);
  if (expected === undefined) return false;
  const ok = Number(value.trim()) === expected;
  if (ok) pendingCaptchas.delete(userId);
  return ok;
}

module.exports = { generateCaptcha, checkCaptcha, pendingCaptchas };
