const path = require('path');
const fs = require('fs');

// Middleware .env first (CMSV6 login — same as working helion-middleware).
// Report portal .env second so PORT + REPORT_PORTAL_* are not overwritten.
const mwEnv = path.join(__dirname, '../../../middleware/.env');
if (fs.existsSync(mwEnv)) {
  require('dotenv').config({ path: mwEnv });
}
require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });
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
});
