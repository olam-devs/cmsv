/**
 * System-defined roles and marker icons for Route Tracker locations.
 * Extend ROLES / ICONS here; frontend loads via GET /api/routemgr/location-presets
 */

/** Default radius (m) for new circles — template and server enforce at least this minimum. */
const DEFAULT_MIN_RADIUS = 200;

const ROLES = [
  'Distributor',
  'Industry / plant',
  'Warehouse',
  'Retail outlet',
  'Office',
  'Depot / yard',
  'User site',
  'Service / workshop',
  'Logistics hub',
  'Other',
];

/** id = stable key stored on each location; emoji = map marker (DivIcon) */
const ICONS = [
  { id: 'pin', label: 'Default pin', emoji: '📍' },
  { id: 'user', label: 'User / person', emoji: '👤' },
  { id: 'users', label: 'Users / team', emoji: '👥' },
  { id: 'distributor', label: 'Distributor', emoji: '🚚' },
  { id: 'industry', label: 'Industry / factory', emoji: '🏭' },
  { id: 'warehouse', label: 'Warehouse', emoji: '📦' },
  { id: 'retail', label: 'Retail / shop', emoji: '🏪' },
  { id: 'office', label: 'Office', emoji: '🏢' },
  { id: 'depot', label: 'Depot / yard', emoji: '🅿️' },
  { id: 'fuel', label: 'Fuel / energy', emoji: '⛽' },
  { id: 'construction', label: 'Construction', emoji: '🏗️' },
  { id: 'farm', label: 'Agriculture', emoji: '🌾' },
  { id: 'port', label: 'Port / shipping', emoji: '⚓' },
  { id: 'airport', label: 'Air / cargo', emoji: '✈️' },
  { id: 'hospital', label: 'Medical', emoji: '🏥' },
  { id: 'school', label: 'Education', emoji: '🏫' },
  { id: 'security', label: 'Security / gate', emoji: '🛡️' },
  { id: 'flag', label: 'Checkpoint', emoji: '🚩' },
  { id: 'star', label: 'Priority', emoji: '⭐' },
];

function getIconEmoji(iconKey) {
  const k = String(iconKey || 'pin').trim();
  const f = ICONS.find((x) => x.id === k);
  return f ? f.emoji : '📍';
}

module.exports = {
  DEFAULT_MIN_RADIUS,
  ROLES,
  ICONS,
  getIconEmoji,
};
