const jwt = require('jsonwebtoken');

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
  const { username: u, password: p } = portalCredentials();
  return String(username || '').trim() === u && String(password || '') === p;
}

function signReportUser() {
  const { username } = portalCredentials();
  return jwt.sign(
    { sub: 'report-portal', username, kind: 'report' },
    getSecret(),
    { expiresIn: process.env.REPORT_JWT_EXPIRES_IN || '12h' },
  );
}

function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

module.exports = { verifyLogin, signReportUser, verifyToken, portalCredentials };
