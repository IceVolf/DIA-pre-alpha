Mini Telegram — Backend + Frontend integration (Telegram WebApp)

Overview
- Frontend: index.html (pure HTML/CSS/JS). Uses Telegram WebApp SDK to get initData and user.
- Backend: app.js (Node + Express + Mongoose). Verifies Telegram initData via HMAC (requires TELEGRAM_BOT_TOKEN).
- DB: MongoDB (Atlas recommended). Stores per-user data: photos (base64 or URLs), texts, timestamps.

Environment variables
- TELEGRAM_BOT_TOKEN (required) — your bot token (keep secret)
- MONGODB_URI (required) — MongoDB connection string
- PORT (optional) — default 4000
- CORS_ORIGIN (optional) — frontend origin allowed to call backend (e.g. https://your-frontend.vercel.app). Default '*'.

Setup (local)
1. Backend
   - Install Node >= 16
   - Create .env or set env variables in your shell:
     export TELEGRAM_BOT_TOKEN="xxxx:YYYY"
     export MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/dbname?retryWrites=true&w=majority"
     export CORS_ORIGIN="http://localhost:3000"
   - Install deps:
     npm install
   - Run:
     npm run dev
   - Backend listens on http://localhost:4000

2. Frontend
   - Place index.html on a static server or open in browser (when testing locally you need to set API_BASE in index.html to your backend URL).
   - Important: the Telegram WebApp SDK requires the page to be opened from the Telegram client (Web Apps). For testing you can simulate by setting window.Telegram and window.Telegram.WebApp in dev console, but server-side verification expects a valid initData signature from Telegram.

Deployment
- Frontend: Vercel / Netlify (deploy index.html)
- Backend: Render / Railway / Heroku (set environment variables)
- Ensure CORS_ORIGIN matches where your frontend is hosted.

Security notes
- The backend verifies initData using the bot token (HMAC with sha256) per Telegram docs:
  https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
- The frontend must send the raw `Telegram.WebApp.initData` string in the `X-Init-Data` header on requests.
- In production, do not store raw sensitive images in DB; consider uploading to S3 or Cloud Storage and store secure URLs.
- Always use HTTPS in production.

How it works (summary)
- On load, frontend reads user id from `Telegram.WebApp.initDataUnsafe.user`.
- Frontend sends initData header and GET /api/user-data?userId=...; backend verifies initData HMAC using TELEGRAM_BOT_TOKEN.
- If valid, backend returns stored data for that user (if present).
- When user saves, frontend converts images to base64, posts JSON to /api/save-data with initData header. Backend verifies initData and upserts data into DB.

If you want
- Example server to upload images to S3 (instead of storing base64).
- Server-side sessions and JWT if you want session tokens.
- Support for other DB (SQLite) or file-based storage for smaller scale.
