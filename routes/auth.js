// routes/auth.js — Inscription et connexion.
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const PIN_REGEX = /^\d{4,6}$/;
const PHONE_REGEX = /^\+?[0-9]{8,15}$/;
const LOCK_STEPS_MS = [30_000, 60_000, 120_000, 300_000, 900_000, 3_600_000];

function generateCardNumber() {
  let num;
  let exists;
  do {
    num = Array.from({ length: 4 }, () =>
      String(Math.floor(1000 + Math.random() * 9000))
    ).join('');
    exists = db.prepare('SELECT 1 FROM cards WHERE card_number = ?').get(num);
  } while (exists);
  return num;
}

router.post('/register', async (req, res) => {
  const { phone, name, pin } = req.body || {};

  if (!phone || !PHONE_REGEX.test(phone)) {
    return res.status(400).json({ error: 'Numéro de téléphone invalide.' });
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Nom requis.' });
  }
  if (!pin || !PIN_REGEX.test(pin)) {
    return res.status(400).json({ error: 'Le code PIN doit comporter entre 4 et 6 chiffres.' });
  }

  const existing = db.prepare('SELECT 1 FROM users WHERE phone = ?').get(phone);
  if (existing) {
    return res.status(409).json({ error: 'Un compte existe déjà avec ce numéro.' });
  }

  const pinHash = await bcrypt.hash(pin, 12);

  const insertUser = db.prepare(
    'INSERT INTO users (phone, name, pin_hash) VALUES (?, ?, ?)'
  );
  const insertCard = db.prepare(
    'INSERT INTO cards (user_id, card_number, balance) VALUES (?, ?, 0)'
  );

  const tx = db.transaction(() => {
    const { lastInsertRowid: userId } = insertUser.run(phone, name.trim(), pinHash);
    insertCard.run(userId, generateCardNumber());
    return userId;
  });

  const userId = tx();

  const token = jwt.sign({ sub: userId, phone }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token });
});

router.post('/login', async (req, res) => {
  const { phone, pin } = req.body || {};
  if (!phone || !pin) {
    return res.status(400).json({ error: 'Numéro et code PIN requis.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) {
    return res.status(401).json({ error: 'Numéro ou code PIN incorrect.' });
  }

  const now = Date.now();
  if (user.lock_until > now) {
    const seconds = Math.ceil((user.lock_until - now) / 1000);
    return res.status(423).json({
      error: `Compte temporairement verrouillé. Réessaie dans ${seconds}s.`,
      lockedForSeconds: seconds,
    });
  }

  const valid = await bcrypt.compare(pin, user.pin_hash);

  if (!valid) {
    const attempts = user.failed_attempts + 1;
    const stepIndex = Math.min(attempts - 3, LOCK_STEPS_MS.length - 1);
    const lockUntil = attempts >= 3 ? now + LOCK_STEPS_MS[Math.max(stepIndex, 0)] : 0;

    db.prepare(
      'UPDATE users SET failed_attempts = ?, lock_until = ? WHERE id = ?'
    ).run(attempts, lockUntil, user.id);

    return res.status(401).json({
      error: 'Numéro ou code PIN incorrect.',
      attemptsRemaining: attempts >= 3 ? 0 : 3 - attempts,
    });
  }

  db.prepare('UPDATE users SET failed_attempts = 0, lock_until = 0 WHERE id = ?').run(user.id);

  const token = jwt.sign({ sub: user.id, phone: user.phone }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

module.exports = router;
