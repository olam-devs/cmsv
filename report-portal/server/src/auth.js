const jwt = require('jsonwebtoken');
const users = require('./users-store');

function getSecret() {
  const s =
    process.env.REPORT_JWT_SECRET ||
    process.env.JWT_SECRET ||
    'helion_report_portal_change_me_in_production_32';
  return s;
}

function portalCredentials() {
  return {
    username: String(process.env.REPORT_PORTAL_USERNAME || 'Helion').trim(),
    password: String(process.env.REPORT_PORTAL_PASSWORD || 'report@2026'),
  };
}

function verifyLogin(username, password) {
  const un = String(username || '').trim();
  const pw = String(password || '');
  const { username: adminU, password: adminP } = portalCredentials();
  if (un === adminU && pw === adminP) return { ok: true, username: un, role: 'admin' };
  const hit = users.findUser(un);
  if (!hit) return { ok: false };
  if (!users.verifyPassword(pw, hit.passwordHash)) return { ok: false };
  return { ok: true, username: hit.username, role: hit.role === 'admin' ? 'admin' : 'user' };
}

function signReportUser({ username, role }) {
  return jwt.sign(
    { sub: 'report-portal', username, role: role === 'admin' ? 'admin' : 'user', kind: 'report' },
    getSecret(),
    { expiresIn: process.env.REPORT_JWT_EXPIRES_IN || '12h' },
  );
}

function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

module.exports = { verifyLogin, signReportUser, verifyToken, portalCredentials };
