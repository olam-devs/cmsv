/**
 * routes/auth.js — login + me
 * Mounted at /api/auth
 */

const express = require('express');
const router = express.Router();
const users = require('../services/users.service');
const { signUser } = require('../services/auth-jwt.service');
const requireUser = require('../utils/require-user');

const ok  = (res, data, meta = {}) => res.json({ success: true, ...meta, data });
const err = (res, msg, status = 400) => res.status(status).json({ success: false, message: msg });

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = users.findByUsername(username);
  if (!u || u.active === false) return err(res, 'Invalid username or password', 401);
  if (!users.verifyPassword(u, password)) return err(res, 'Invalid username or password', 401);
  const token = signUser(u);
  users.setLastLogin(u.id);
  ok(res, {
    token,
    user: {
      id: u.id,
      username: u.username,
      role: u.role,
      companyIds: u.companyIds || [],
      features: u.features || {},
    },
  });
});

router.get('/me', requireUser, (req, res) => ok(res, req.user));

/** Any logged-in user: set own password (requires current password). */
router.post('/change-password', requireUser, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const u = users.findById(req.user.id);
  if (!u) return err(res, 'Invalid user', 401);
  if (!users.verifyPassword(u, currentPassword)) return err(res, 'Current password is incorrect', 400);
  try {
    users.setPassword(u.id, newPassword);
    ok(res, { message: 'Password updated' });
  } catch (e) {
    err(res, e.message);
  }
});

/**
 * Superadmin: set any user's password (no current password).
 * Mounted at /api/auth/... so proxies that only forward /api/auth reliably still work.
 */
router.post('/superadmin/set-password', requireUser, (req, res) => {
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

module.exports = router;

