# Helion Daily Fleet Report Portal

Standalone app for the **Daily Fleet Monitoring Report** — separate process and URL from the main Helion fleet middleware (`helion-middleware` on port 3000).

## Login (default)

| Field | Value |
|-------|--------|
| Username | `Helion` |
| Password | `report@2026` |

Override in `server/.env` via `REPORT_PORTAL_USERNAME` and `REPORT_PORTAL_PASSWORD`.

## Architecture

```
Browser → Nginx (report.heliontracking.com) → report-portal :3002
                                              ↳ reuses middleware/src/services (CMS + daily-log)
                                              ↳ data/daily-log.json (shared with main app)
```

Main fleet UI and APIs are **not** required for this portal to run.

## Local development

```bash
# Terminal 1 — API (port 3002)
cd report-portal/server
copy .env.example .env
# Edit .env: CMSV6_* same as middleware/.env
npm install
npm start

# Terminal 2 — UI (port 5174, proxies /api → 3002)
cd report-portal/web
npm install
npm run dev
```

Open http://localhost:5174/login

## Production build (VPS)

```bash
cd report-portal/web
npm install
npm run build

cd ../server
npm install
# .env on VPS with PORT=3002, CMS credentials, REPORT_JWT_SECRET
npm start
```

Or PM2:

```bash
cd C:\helion\report-portal\server
pm2 start src/index.js --name helion-report-portal
pm2 save
```

Copy repo to e.g. `C:\helion\report-portal` on the VPS (same parent as `middleware` and `data`).

## Nginx

See `deploy/nginx-report-portal.conf`. Example URL:

- `https://report.heliontracking.com` → `http://127.0.0.1:3002`

Add DNS **A** record `report` → VPS IP, then include the server block and reload Nginx.

## API (all require Bearer token except login)

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/daily-log/report?date=`
- `GET /api/daily-log/report/export?date=`
- `PATCH /api/daily-log/report/:id?date=`
- `GET /api/vehicles`
