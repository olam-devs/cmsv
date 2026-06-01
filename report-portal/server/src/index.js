const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// CMS credentials always come from middleware/.env (same as helion-middleware).
// report-portal/.env only sets PORT + REPORT_PORTAL_* — never override CMS password.
const mwEnv = path.join(__dirname, '../../../middleware/.env');
const reportEnv = path.join(__dirname, '../.env');
const CMS_FROM_MIDDLEWARE = [
  'CMSV6_BASE_URL',
  'CMSV6_USERNAME',
  'CMSV6_PASSWORD',
  'FLEET_TIMEZONE',
  'DAILY_REPORT_CONCURRENCY',
  'DAILY_REPORT_CACHE_MS',
  'SESSION_CACHE_TTL',
  'GPS_CACHE_TTL',
  'FUEL_CACHE_TTL',
  'REPORT_CACHE_TTL',
  'VEHICLE_LIST_CACHE_TTL',
];

let mwParsed = {};
if (fs.existsSync(mwEnv)) {
  mwParsed = dotenv.parse(fs.readFileSync(mwEnv));
  dotenv.config({ path: mwEnv });
}

if (fs.existsSync(reportEnv)) {
  const reportParsed = dotenv.parse(fs.readFileSync(reportEnv));
  for (const [key, val] of Object.entries(reportParsed)) {
    if (!CMS_FROM_MIDDLEWARE.includes(key)) {
      process.env[key] = val;
    }
  }
}

for (const key of CMS_FROM_MIDDLEWARE) {
  if (mwParsed[key] != null && String(mwParsed[key]).trim() !== '') {
    process.env[key] = mwParsed[key];
  }
}

require('express-async-errors');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');

const PORT = parseInt(process.env.PORT || '3002', 10);
const distPath = path.join(__dirname, '../../web/dist');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('combined'));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Helion Report Portal',
    port: PORT,
    cmsv6: process.env.CMSV6_BASE_URL,
    cmsUser: process.env.CMSV6_USERNAME,
  });
});

app.use('/api', routes);

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use((e, req, res, _next) => {
  res.status(e.status || 500).json({
    success: false,
    message: e.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Helion Report Portal listening on http://127.0.0.1:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`CMS: ${process.env.CMSV6_BASE_URL} user=${process.env.CMSV6_USERNAME}`);
});
