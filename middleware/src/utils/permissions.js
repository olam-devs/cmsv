const FEATURE_LIST = [
  // ERP
  'erp.read',
  'erp.org.write',
  'erp.assign.write',

  // Users
  'users.manage',

  // Fleet (high-level gating; UI maps to views)
  'fleet.view',
  'fleet.dashboard',
  'fleet.vehicles',
  'fleet.map',
  'fleet.cameras',
  'fleet.alarms',
  'fleet.notifications',
  'fleet.fuel',
  'fleet.reports',
  'fleet.routes',
  'fleet.chat',
];

function normalizeFeatureArray(features) {
  if (!features) return [];
  if (Array.isArray(features)) return features.map(String).map(s => s.trim()).filter(Boolean);
  if (features === '*' || features.all === true) return ['*'];
  if (Array.isArray(features.allow)) return features.allow.map(String).map(s => s.trim()).filter(Boolean);
  return [];
}

function hasFeature(user, feature) {
  const arr = normalizeFeatureArray(user?.features);
  if (arr.includes('*')) return true;
  return arr.includes(feature);
}

function intersectFeatures(a, b) {
  const A = new Set(normalizeFeatureArray(a));
  const B = new Set(normalizeFeatureArray(b));
  if (A.has('*') && B.has('*')) return ['*'];
  if (A.has('*')) return [...B];
  if (B.has('*')) return [...A];
  return [...A].filter(x => B.has(x));
}

module.exports = {
  FEATURE_LIST,
  normalizeFeatureArray,
  hasFeature,
  intersectFeatures,
};

