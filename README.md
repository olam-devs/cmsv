# 🚌 FleetVu Management System
### CMSV6 + AWS Middleware + AI Chatbot — Complete Setup Guide

---

## 📋 System Overview

```
Your Vehicles (GPS + Cameras + Fuel Sensors)
        │
        ▼
┌──────────────────────────────────┐
│   CMSV6 Server on AWS EC2        │  Port 8080 (Web UI)
│   - Gateway (vehicle data)        │  Port 6600 (device connections)
│   - Media Server (cameras)        │  Port 6602 (video streams)
│   - MySQL database                │  Port 6611/6612 (storage)
└────────────────┬─────────────────┘
                 │ HTTP API
                 ▼
┌──────────────────────────────────┐
│   Your Middleware (Node.js)      │  Port 3000
│   - Auth + caching               │
│   - Fleet/GPS/Fuel/Camera APIs   │
│   - AI Chatbot (Claude)          │
└────────────────┬─────────────────┘
                 │ REST API
                 ▼
┌──────────────────────────────────┐
│   Your Dashboard (React)         │  Port 5173 / nginx
│   - Live fleet map               │
│   - Vehicle management           │
│   - Reports & alerts             │
│   - FleetBot AI chatbot          │
└──────────────────────────────────┘
```

---

## 🎨 PART 1: WHITE-LABELING CMSV6 (Add Your Logo)

CMSV6 has a built-in **DIY / Branding** section in the Server Controller.

### Step 1 — In the CMSV6 Server Controller

1. Open the **CMSV6 Server Controller** on your AWS instance (RDP in)
2. Go to **DIY** tab (Section 3.3.3 in the manual)
3. You can change:
   - **Logo** for both the WEB client and PC client
   - **System name** displayed in the header
   - **Feature toggles** — hide features you don't need

### Step 2 — Replacing Web Logo Files

The CMSV6 web interface files are typically in:
```
C:\CMSServer\webapps\ROOT\
  ├── images\
  │     ├── logo.png         ← Replace this with your logo
  │     └── favicon.ico      ← Replace with your icon
  └── css\
        └── style.css        ← Can modify colours here
```

**Replace logos:**
```powershell
# On your AWS Windows Server (via RDP):
# 1. Stop the Web Server service
# 2. Replace the logo files with your branded ones
# 3. Restart the Web Server service

# Example - copy your logo over the existing one:
Copy-Item "C:\YourLogo\logo.png" "C:\CMSServer\webapps\ROOT\images\logo.png" -Force
```

### Step 3 — System Name in CMSV6

In the Server Controller → DIY:
- Set **Company Name**: Your Company Name  
- Set **System Title**: Your Fleet Management System
- Upload your **logo image** (PNG, recommended 200x60px)

### Step 4 — For Full White-Label Control

Since CMSV6's built-in branding is limited, the real white-labeling comes from
**your own dashboard** (the React app in this repo). Your users log into YOUR
branded system, which talks to CMSV6 behind the scenes via the middleware.
Users never need to see or access raw CMSV6.

---

## 🖥️ PART 2: AWS SERVER SETUP (CMSV6)

### AWS EC2 Configuration

**Recommended EC2 instance for 100+ vehicles:**
- Instance type: **t3.xlarge** (4 vCPU, 16 GB RAM) or better
- OS: **Windows Server 2019** (CMSV6 requires Windows)
- Storage: **500 GB gp3 SSD** (for video recordings + DB)
- Elastic IP: Assign a static Elastic IP

### Security Group Rules (AWS Firewall)

```
Inbound Rules:
┌─────────────────────────────────────────────────────────┐
│ Type     │ Port      │ Source      │ Purpose             │
├──────────┼───────────┼─────────────┼─────────────────────┤
│ Custom   │ 8080      │ 0.0.0.0/0   │ CMSV6 Web UI        │
│ Custom   │ 6600      │ 0.0.0.0/0   │ Device Gateway      │
│ Custom   │ 6602      │ 0.0.0.0/0   │ Media Streaming     │
│ Custom   │ 6611-6612 │ 0.0.0.0/0   │ Storage Server      │
│ Custom   │ 3000      │ Your IPs    │ Middleware API       │
│ RDP      │ 3389      │ Your IP     │ Remote management   │
│ Custom   │ 80/443    │ 0.0.0.0/0   │ Your dashboard      │
└──────────┴───────────┴─────────────┴─────────────────────┘
```

### Verify CMSV6 Services Are Running

RDP into your EC2 instance and check:
```
CMSV6 Server Controller → All these should show GREEN:
  ✅ Gateway Server
  ✅ Media Server  
  ✅ User Server
  ✅ Data Processing Server
  ✅ Storage Server
  ✅ WEB Server
  ✅ Database (MySQL)
```

### Test Connectivity from Your Laptop

```bash
# Test web interface
curl http://YOUR_ELASTIC_IP:8080

# Test device gateway
telnet YOUR_ELASTIC_IP 6600

# Test media streaming
telnet YOUR_ELASTIC_IP 6602
```

---

## ⚙️ PART 3: MIDDLEWARE SETUP

### Prerequisites

Install Node.js 20+ on a server (can be same EC2 or a separate Linux server):

```bash
# On Ubuntu/Debian (separate server recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# On Windows Server (same EC2)
# Download Node.js installer from https://nodejs.org
```

### Installation

```bash
git clone <your-repo> fleetvu-middleware
cd fleetvu-middleware
npm install
cp .env.example .env
```

### Configuration (.env)

```env
CMSV6_BASE_URL=http://YOUR_ELASTIC_IP:8080
CMSV6_USERNAME=admin
CMSV6_PASSWORD=your_password

MIDDLEWARE_API_KEY=your_strong_secret_key_here

COMPANY_NAME=Olam Technologies
FLEET_TIMEZONE=Africa/Dar_es_Salaam

# For AI chatbot:
ANTHROPIC_API_KEY=sk-ant-your-key
```

### Start with PM2 (Production)

```bash
npm install -g pm2

# Start
pm2 start src/index.js --name fleetvu-middleware

# Auto-start on server reboot
pm2 startup
pm2 save

# Monitor
pm2 logs fleetvu-middleware
pm2 status
```

### Test All Endpoints

```bash
BASE=http://localhost:3000
KEY="your_api_key"

# Health check
curl $BASE/health

# Fleet snapshot
curl -H "X-API-Key: $KEY" $BASE/api/fleet/snapshot

# All vehicles
curl -H "X-API-Key: $KEY" $BASE/api/fleet/vehicles

# Live GPS all
curl -H "X-API-Key: $KEY" $BASE/api/fleet/live

# Active alarms
curl -H "X-API-Key: $KEY" $BASE/api/fleet/alarms/active

# Specific vehicle GPS
curl -H "X-API-Key: $KEY" $BASE/api/vehicles/DEVICE_ID/gps

# Fuel level
curl -H "X-API-Key: $KEY" $BASE/api/fuel/DEVICE_ID/live

# Camera stream URL
curl -H "X-API-Key: $KEY" $BASE/api/cameras/DEVICE_ID/stream?channel=1

# AI chatbot
curl -X POST -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"message":"Which vehicles are speeding right now?"}' \
  $BASE/api/chat

# Alarms for today
curl -H "X-API-Key: $KEY" "$BASE/api/alarms?date=$(date +%Y-%m-%d)"

# Fuel report (summary)
curl -H "X-API-Key: $KEY" "$BASE/api/fuel/DEVICE_ID/report?date=$(date +%Y-%m-%d)&type=summary"
```

---

## 📡 PART 4: COMPLETE API REFERENCE

### Fleet Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/fleet/snapshot` | Real-time fleet status (online/offline/alarm counts, speeders) |
| GET | `/api/fleet/summary?date=YYYY-MM-DD` | Daily ops summary (alarms by type, top offenders) |
| GET | `/api/fleet/vehicles` | All registered vehicles |
| GET | `/api/fleet/live` | Live GPS positions for all 100+ vehicles |
| GET | `/api/fleet/alarms/active` | Vehicles currently in alarm state |

### Individual Vehicle

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vehicles/:id` | Vehicle profile |
| GET | `/api/vehicles/:id/gps` | Live GPS (lat, lng, speed, direction) |
| GET | `/api/vehicles/:id/track?date=` | Full route history for a date |
| GET | `/api/vehicles/:id/today` | Today's combined report (GPS + mileage + alarms + fuel) |

### Fuel Sensor

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/fuel/fleet` | Fleet-wide fuel status today |
| GET | `/api/fuel/:id/live` | Live fuel level (%) |
| GET | `/api/fuel/:id/report?date=&type=summary\|dynamic\|abnormal` | Fuel consumption, refills, theft detection |

### Cameras

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cameras/:id/stream?channel=1&streamType=sub` | Live stream URL (RTSP/HLS) |
| POST | `/api/cameras/:id/snapshot?channel=1` | Trigger front-end snapshot |
| GET | `/api/cameras/:id/videos?date=&videoType=alarm` | Recorded video list |

### Alarms

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alarms?date=&devIdno=&alarmType=` | Query alarm records |
| GET | `/api/alarms/types` | List all 22 alarm type codes |

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/mileage/:id?date=` | Distance driven |
| GET | `/api/reports/uptime/:id?date=` | Online/offline log |
| GET | `/api/reports/behaviour/:id?date=` | Harsh braking, acceleration, fatigue |

### AI Chatbot

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Body: `{ message, history? }` → AI response with live fleet data |

---

## 🤖 PART 5: AI CHATBOT SETUP

The chatbot uses **Claude (Anthropic)** with your live fleet data as context.
It can answer natural-language questions and pull data using tools.

### Get Anthropic API Key
1. Sign up at https://console.anthropic.com
2. Create an API key
3. Add to `.env`: `ANTHROPIC_API_KEY=sk-ant-your-key`

### Sample Questions the Chatbot Can Answer
- *"Which vehicles are speeding right now?"*
- *"How much fuel did T 001 ABC use this week?"*
- *"Show all alarms from last Monday"*
- *"Which 5 drivers had the most incidents this month?"*
- *"Is vehicle KDA 123 DEF online?"*
- *"Alert me about any fuel theft anomalies today"*
- *"What's the total fleet mileage for October?"*
- *"Which vehicles have been offline for more than 2 hours?"*

### Chatbot API Usage

```javascript
// Simple call
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'X-API-Key': 'your_key', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "Which vehicles are speeding right now?",
    history: [] // Previous messages for conversation context
  })
});

const { reply, toolsUsed, tokensUsed } = await response.json();
```

---

## ⛽ PART 6: FUEL SENSOR DATA

Each vehicle has a fuel sensor connected via RS232 to the MDVR.

### Fuel Report Types

| Type | Description | Use Case |
|------|-------------|----------|
| `summary` | Start/end fuel level, total consumption, mileage | Daily/weekly review |
| `dynamic` | Real-time fuel level synced with GPS timestamps | Plotting fuel curve vs route |
| `abnormal` | Only records where fuel changed abnormally | **Theft detection** |

### Detecting Fuel Theft

Use the `abnormal` report:
```bash
curl "$BASE/api/fuel/VEHICLE_ID/report?date=2026-02-01&type=abnormal"
```

Set the alarm threshold in CMSV6:
- **Settings → Fuel Sensor Settings** → Set alarm threshold (e.g., if fuel drops 10L without engine running)
- Middleware `getAlarms()` with `alarmType=21` returns Fuel Anomaly alarms

### Chatbot Fuel Queries
> *"Show me all vehicles with fuel anomalies this week"*
> *"Which vehicle lost more than 20 litres without driving?"*
> *"Fleet fuel consumption vs mileage for October"*

---

## 🔧 PART 7: NGINX + DOMAIN SETUP (Production)

```nginx
# /etc/nginx/sites-available/fleet.yourcompany.com

# Dashboard
server {
    listen 443 ssl;
    server_name fleet.yourcompany.com;
    
    ssl_certificate /etc/letsencrypt/live/fleet.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fleet.yourcompany.com/privkey.pem;
    
    location / {
        root /var/www/fleet-dashboard/dist;
        try_files $uri /index.html;
    }
}

# Middleware API
server {
    listen 443 ssl;
    server_name api.fleet.yourcompany.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-API-Key $http_x_api_key;
    }
}
```

---

## 📱 PART 8: FUTURE — WHATSAPP/TELEGRAM CHATBOT

The middleware chatbot endpoint can be connected to messaging apps:

```javascript
// WhatsApp (using Twilio or WhatsApp Business API)
app.post('/webhook/whatsapp', async (req, res) => {
  const message = req.body.Body;        // incoming message
  const from    = req.body.From;        // phone number
  
  const { reply } = await chatbot.chat(message);
  
  // Send reply via Twilio
  await twilioClient.messages.create({
    body: reply, from: 'whatsapp:+14155238886', to: from,
  });
});

// Telegram
bot.on('message', async (msg) => {
  const { reply } = await chatbot.chat(msg.text);
  bot.sendMessage(msg.chat.id, reply);
});
```

---

## ⚠️ Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `CMSV6 auth failed` | Wrong credentials or IP | Check `CMSV6_BASE_URL` and creds in `.env` |
| No GPS data | Vehicle offline or no GPS signal | Check vehicle status in CMSV6 web UI directly |
| Camera streams fail | Port 6602 not open | Open port in AWS Security Group |
| No fuel data | Sensor not configured | Configure in CMSV6: Fuel Sensor Settings |
| Session keeps expiring | TTL too high | Set `SESSION_CACHE_TTL=1500` (25 min) |
| Chatbot not responding | No API key | Set `ANTHROPIC_API_KEY` in `.env` |
