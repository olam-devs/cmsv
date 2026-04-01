const { verifyToken } = require('../services/auth-jwt.service');
const users = require('../services/users.service');
const { normalizeFeatureArray, hasFeature } = require('./permissions');

function getBearer(req) {
  const h = req.headers.authorization || '';
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

module.exports = function requireUser(req, res, next) {
  try {
    const token = getBearer(req);
    if (!token) return res.status(401).json({ success: false, message: 'Missing Authorization: Bearer token' });
    const decoded = verifyToken(token);
    const u = users.findById(decoded.sub);
    if (!u || u.active === false) return res.status(401).json({ success: false, message: 'Invalid user' });
    const safeUser = {
      id: u.id,
      username: u.username,
      role: u.role,
      companyIds: u.companyIds || [],
      features: u.features || {},
    };
    req.user = {
      ...safeUser,
      effectiveFeatures: normalizeFeatureArray(safeUser.features),
      hasFeature: (f) => hasFeature(safeUser, f),
    };
    next();
  } catch (e) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

