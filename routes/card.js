// routes/card.js — Consultation de la carte et verrouillage/déverrouillage.
const express = require('express');
const db = require('../db');
const { getTier } = require('../tiers');

const router = express.Router();

function maskCardNumber(num) {
  return `•••• •••• •••• ${num.slice(-4)}`;
}

router.get('/', (req, res) => {
  const card = db.prepare('SELECT * FROM cards WHERE user_id = ?').get(req.user.id);
  if (!card) return res.status(404).json({ error: 'Carte introuvable.' });

  res.json({
    cardNumberMasked: maskCardNumber(card.card_number),
    balance: card.balance,
    locked: !!card.locked,
    tier: getTier(card.balance),
  });
});

router.post('/lock', (req, res) => {
  const { locked } = req.body || {};
  if (typeof locked !== 'boolean') {
    return res.status(400).json({ error: 'Le champ "locked" doit être un booléen.' });
  }

  const result = db
    .prepare('UPDATE cards SET locked = ? WHERE user_id = ?')
    .run(locked ? 1 : 0, req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Carte introuvable.' });
  }

  res.json({ locked });
});

module.exports = router;
