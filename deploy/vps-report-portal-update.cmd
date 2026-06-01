@echo off
REM Helion VPS — sync report portal + middleware deps (run as Admin from any folder)
set REPO=C:\helion\_repo
set HELION=C:\helion

if not exist "%REPO%\report-portal\server\src\index.js" (
  echo ERROR: Repo not found at %REPO%
  exit /b 1
)

echo === Sync middleware files required by daily-log.service ===
set MU=%HELION%\middleware\src\utils
copy /Y "%REPO%\middleware\src\utils\camera-manual.js" "%MU%\"
copy /Y "%REPO%\middleware\src\utils\daily-report-sort.js" "%MU%\"
copy /Y "%REPO%\middleware\src\utils\report-time.js" "%MU%\"
copy /Y "%REPO%\middleware\src\utils\geocode-cache.js" "%MU%\"
copy /Y "%REPO%\middleware\src\utils\report-monitor-fields.js" "%MU%\"
copy /Y "%REPO%\middleware\src\utils\fuel-analyze.js" "%MU%\"
copy /Y "%REPO%\middleware\src\utils\daily-inspection.js" "%MU%\"
copy /Y "%REPO%\middleware\src\services\daily-log.service.js" "%HELION%\middleware\src\services\"
copy /Y "%REPO%\middleware\src\services\uptime-analytics.service.js" "%HELION%\middleware\src\services\"

echo === Sync report-portal (incl. AnalyticsPanel, date range UI) ===
xcopy /Y /E /I "%REPO%\report-portal" "%HELION%\report-portal\"

echo === npm install + build ===
cd /d "%HELION%\report-portal\server"
call npm install
cd /d "%HELION%\report-portal\web"
call npm install
call npm run build

echo === PM2 restart ===
pm2 restart helion-middleware
pm2 restart helion-report-portal
pm2 status

echo === Test (should print JSON with status ok) ===
curl -s http://127.0.0.1:3002/health
echo.
