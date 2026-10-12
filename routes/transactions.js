// routes/transactions.js — Création et historique des transactions.
const express = require('express');
const db = require('../db');
const { getTier } = require('../tiers');

const router = express.Router();

const TYPES = ['payment_online', 'payment_phone', 'topup'];

router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const rows = db
    .prepare(
      'SELECT id, type, merchant, amount, balance_after, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?'
    )
    .all(req.user.id, limit);
  res.json({ transactions: rows });
});

router.post('/', (req, res) => {
  const { type, merchant, amount } = req.body || {};

  if (!TYPES.includes(type)) {
    return res.status(400).json({ error: 'Type de transaction invalide.' });
  }
  const amt = Number(amount);
  if (!Number.isInteger(amt) || amt <= 0) {
    return res.status(400).json({ error: 'Montant invalide.' });
  }
  if (merchant !== undefined && merchant !== null && typeof merchant !== 'string') {
    return res.status(400).json({ error: 'Marchand invalide.' });
  }
  const merchantClean = (merchant || '').toString().trim().slice(0, 80) || null;

  const card = db.prepare('SELECT * FROM cards WHERE user_id = ?').get(req.user.id);
  if (!card) return res.status(404).json({ error: 'Carte introuvable.' });

  const isPayment = type === 'payment_online' || type === 'payment_phone';

  if (isPayment) {
    if (card.locked) {
      return res.status(423).json({ error: 'La carte est verrouillée.' });
    }
    if (card.balance < amt) {
      return res.status(402).json({ error: 'Solde insuffisant.' });
    }
  }

  const delta = isPayment ? -amt : amt;
  const newBalance = card.balance + delta;

  const tx = db.transaction(() => {
    db.prepare('UPDATE cards SET balance = ? WHERE user_id = ?').run(newBalance, req.user.id);
    const info = db
      .prepare(
        'INSERT INTO transactions (user_id, type, merchant, amount, balance_after) VALUES (?, ?, ?, ?, ?)'
      )
      .run(req.user.id, type, merchantClean, amt, newBalance);
    return info.lastInsertRowid;
  });

  const txId = tx();

  res.status(201).json({
    id: txId,
    balance: newBalance,
    tier: getTier(newBalance),
  });
});

module.exports = router;
