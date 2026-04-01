/**
 * routes/admin-users.js — user management (admin only)
 * Mounted at /api/admin/users
 */

const express = require('express');
const router = express.Router();
const users = require('../services/users.service');
const requireUser = require('../utils/require-user');
const { normalizeFeatureArray, intersectFeatures } = require('../utils/permissions');

const ok  = (res, data, meta = {}) => res.json({ success: true, ...meta, data });
const err = (res, msg, status = 400) => res.status(status).json({ success: false, message: msg });

router.use(requireUser);

function isAdmin(req) {
  return req.user?.role === 'superadmin' || req.user?.role === 'admin';
}

function enforceCompanyScope(req, requestedCompanyIds) {
  if (req.user?.role === 'superadmin') return Array.isArray(requestedCompanyIds) ? requestedCompanyIds : [];
  const allowed = new Set(req.user?.companyIds || []);
  const reqIds = Array.isArray(requestedCompanyIds) ? requestedCompanyIds : [];
  for (const id of reqIds) {
    if (!allowed.has(id)) throw new Error('Cannot assign companies outside your access');
  }
  return reqIds;
}

router.get('/', (req, res) => {
  if (!isAdmin(req)) return err(res, 'Forbidden', 403);
  ok(res, users.listUsers());
});

/**
 * Superadmin only: set any user's password (including self) without current password.
 * Fixed path avoids proxy/router edge cases with `/:id/password`.
 */
router.post('/set-password', (req, res) => {
  if (req.user?.role !== 'superadmin') return err(res, 'Forbidden', 403);
  const { userId, newPassword } = req.body || {};
  const targetId = String(userId || '').trim();
  if (!targetId) return err(res, 'userId is required', 400);
  const target = users.findById(targetId);
  if (!target) return err(res, 'User not found', 404);
  try {
    users.setPassword(targetId, newPassword);
    ok(res, { id: target.id, username: target.username, message: 'Password updated' });
  } catch (e) {
    err(res, e.message);
  }
});

router.post('/', (req, res) => {
  if (!isAdmin(req)) return err(res, 'Forbidden', 403);
  try {
    const { username, password, role, companyIds, features } = req.body || {};
    // Superadmin can create admin/viewer with any features.
    // Admin can only create viewer, and only grant subset of their own features + companies.
    const creatorRole = req.user?.role;
    if (creatorRole === 'admin' && String(role).toLowerCase() !== 'viewer' && String(role).toLowerCase() !== 'user') {
      return err(res, 'Admin can only create viewer users', 403);
    }

    const scopedCompanyIds = enforceCompanyScope(req, companyIds);

    let finalFeatures = features || {};
    if (creatorRole === 'admin') {
      // viewer features must be subset of admin effective features
      const requested = normalizeFeatureArray(finalFeatures);
      const allowed = normalizeFeatureArray(req.user?.features);
      const safe = intersectFeatures(requested, allowed);
      finalFeatures = safe.includes('*') ? { all: true } : { allow: safe };
    }

    ok(res, users.createUser({ username, password, role, companyIds: scopedCompanyIds, features: finalFeatures }));
  } catch (e) {
    err(res, e.message);
  }
});

module.exports = router;

