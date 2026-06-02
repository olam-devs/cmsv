const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '../../data/report-users.json');

function load() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const json = JSON.parse(raw);
    if (json && Array.isArray(json.users)) return json;
  } catch (_) {}
  return { users: [] };
}

function save(store) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
    fs.renameSync(tmp, FILE);
  } catch (_) {}
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(12).toString('hex');
  const hash = crypto.pbkdf2Sync(String(pw), salt, 150000, 32, 'sha256').toString('hex');
  return `pbkdf2$sha256$150000$${salt}$${hash}`;
}

function verifyPassword(pw, stored) {
  const s = String(stored || '');
  if (!s.startsWith('pbkdf2$sha256$')) return false;
  const parts = s.split('$');
  const iter = parseInt(parts[3], 10);
  const salt = parts[4];
  const hash = parts[5];
  if (!iter || !salt || !hash) return false;
  const cand = crypto.pbkdf2Sync(String(pw), salt, iter, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(cand, 'hex'));
}

function listUsers() {
  const st = load();
  return (st.users || []).map((u) => ({ username: u.username, role: u.role || 'user', createdAt: u.createdAt }));
}

function findUser(username) {
  const st = load();
  return (st.users || []).find((u) => String(u.username).toLowerCase() === String(username).toLowerCase()) || null;
}

function upsertUser({ username, password, role = 'user' }) {
  const u = String(username || '').trim();
  if (!u) throw new Error('username required');
  const pw = String(password || '');
  if (pw.length < 4) throw new Error('password too short');
  const st = load();
  const now = new Date().toISOString();
  const existing = (st.users || []).find((x) => String(x.username).toLowerCase() === u.toLowerCase());
  const rec = {
    username: u,
    role: role === 'admin' ? 'admin' : 'user',
    passwordHash: hashPassword(pw),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  st.users = (st.users || []).filter((x) => String(x.username).toLowerCase() !== u.toLowerCase());
  st.users.push(rec);
  st.users.sort((a, b) => a.username.localeCompare(b.username));
  save(st);
  return { username: rec.username, role: rec.role, createdAt: rec.createdAt, updatedAt: rec.updatedAt };
}

function deleteUser(username) {
  const u = String(username || '').trim().toLowerCase();
  const st = load();
  const before = st.users?.length || 0;
  st.users = (st.users || []).filter((x) => String(x.username).toLowerCase() !== u);
  save(st);
  return (st.users?.length || 0) !== before;
}

module.exports = { listUsers, findUser, verifyPassword, upsertUser, deleteUser };

