// middleware/auth.js — Vérifie le jeton JWT envoyé dans l'en-tête
// Authorization: Bearer <token> et attache l'utilisateur à req.user.

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET manquant dans les variables d\'environnement (.env)');
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, phone: payload.phone };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session invalide ou expirée, reconnecte-toi.' });
  }
}

module.exports = { requireAuth, JWT_SECRET };
