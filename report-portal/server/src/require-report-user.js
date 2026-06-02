const { verifyToken } = require('./auth');

function getBearer(req) {
  const h = req.headers.authorization || '';
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

module.exports = function requireReportUser(req, res, next) {
  try {
    const token = getBearer(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'Missing Authorization: Bearer token' });
    }
    const decoded = verifyToken(token);
    if (decoded.kind !== 'report') {
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }
    req.user = { username: decoded.username || 'Helion', role: decoded.role === 'admin' ? 'admin' : 'user' };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};
