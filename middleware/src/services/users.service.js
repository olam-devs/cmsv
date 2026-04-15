/**
 * users.service.js — local user store (step 3)
 * Persists to data/users.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const FILE = path.join(__dirname, '../../../data/users.json');

let store = { users: [] };

function nowIso() { return new Date().toISOString(); }
function newId() { return `usr_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`; }

function load() {
  try {
    if (fs.existsSync(FILE)) store = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (_) {}
  store.users = store.users || [];
}

function save() {
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
    fs.renameSync(tmp, FILE);
  } catch (_) {}
}

load();

function normalizeUsername(u) {
  return String(u || '').trim().toLowerCase();
}

function listUsers() {
  return store.users.map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    companyIds: u.companyIds || [],
    features: u.features || {},
    active: u.active !== false,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt || null,
  }));
}

function findByUsername(username) {
  const un = normalizeUsername(username);
  return store.users.find(u => u.username === un) || null;
}

function findById(id) {
  return store.users.find(u => u.id === id) || null;
}

function normalizeRole(role) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'superadmin' || r === 'admin' || r === 'viewer') return r;
  if (r === 'user') return 'viewer'; // backward-compat for earlier UI
  return 'viewer';
}

function createUser({ username, password, role = 'viewer', companyIds = [], features = {} }) {
  const un = normalizeUsername(username);
  if (!un) throw new Error('username is required');
  if (!password || String(password).length < 6) throw new Error('password must be at least 6 characters');
  if (findByUsername(un)) throw new Error('username already exists');

  const hash = bcrypt.hashSync(String(password), 10);
  const finalRole = normalizeRole(role);
  let finalFeatures = features || {};
  const emptyFeatures =
    !finalFeatures ||
    (typeof finalFeatures === 'object' && !Array.isArray(finalFeatures) && Object.keys(finalFeatures).length === 0);
  if (emptyFeatures) {
    if (finalRole === 'superadmin') finalFeatures = { all: true };
    else if (finalRole === 'admin') finalFeatures = { allow: ['erp.read', 'erp.org.write', 'erp.assign.write', 'fleet.view', 'fleet.dashboard', 'fleet.vehicles', 'fleet.map', 'fleet.alarms', 'fleet.notifications', 'fleet.fuel', 'fleet.reports', 'fleet.routes', 'fleet.chat', 'users.manage'] };
    else finalFeatures = { allow: ['erp.read', 'fleet.view', 'fleet.dashboard', 'fleet.vehicles', 'fleet.map'] };
  }

  const user = {
    id: newId(),
    username: un,
    passwordHash: hash,
    role: finalRole, // 'superadmin' | 'admin' | 'viewer'
    companyIds: Array.isArray(companyIds) ? companyIds : [],
    features: finalFeatures,
    active: true,
    createdAt: nowIso(),
    lastLoginAt: null,
  };
  store.users.push(user);
  save();
  return { id: user.id, username: user.username, role: user.role, companyIds: user.companyIds, features: user.features };
}

function setLastLogin(userId) {
  const u = findById(userId);
  if (!u) return;
  u.lastLoginAt = nowIso();
  save();
}

function verifyPassword(user, password) {
  if (!user || !user.passwordHash) return false;
  return bcrypt.compareSync(String(password || ''), user.passwordHash);
}

function ensureDefaultAdmin() {
  if (store.users.length) return null;
  const username = normalizeUsername(process.env.DEFAULT_ADMIN_USERNAME || 'Admin');
  const password = String(process.env.DEFAULT_ADMIN_PASSWORD || 'Helion@2026');
  const created = createUser({ username, password, role: 'superadmin', companyIds: [], features: { all: true } });
  return { ...created, password };
}

/** Persist a new bcrypt hash for an existing user (min 6 chars). */
function setPassword(userId, newPassword) {
  const u = findById(userId);
  if (!u) throw new Error('User not found');
  if (!newPassword || String(newPassword).length < 6) throw new Error('password must be at least 6 characters');
  u.passwordHash = bcrypt.hashSync(String(newPassword), 10);
  save();
  return { id: u.id, username: u.username };
}

module.exports = {
  listUsers,
  findByUsername,
  findById,
  createUser,
  setLastLogin,
  verifyPassword,
  ensureDefaultAdmin,
  setPassword,
};

