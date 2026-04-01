/**
 * auth-jwt.service.js — JWT issuing + verification
 */

const jwt = require('jsonwebtoken');

function getJwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    // Keep explicit error: production must set this.
    throw new Error('JWT_SECRET is not set or too short (min 16 chars)');
  }
  return s;
}

function signUser(user) {
  const secret = getJwtSecret();
  const payload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    companyIds: user.companyIds || [],
    features: user.features || {},
  };
  const expiresIn = process.env.JWT_EXPIRES_IN || '12h';
  return jwt.sign(payload, secret, { expiresIn });
}

function verifyToken(token) {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
}

module.exports = { signUser, verifyToken };

