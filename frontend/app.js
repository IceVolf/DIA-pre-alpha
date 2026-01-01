/**
 * mini-telegram backend (Node + Express + Mongoose)
 *
 * - GET /api/user-data?userId=...
 * - POST /api/save-data
 *
 * Both endpoints require header: X-Init-Data: <raw Telegram initData string>
 * The server verifies the initData signature using TELEGRAM_BOT_TOKEN.
 *
 * Environment:
 * - TELEGRAM_BOT_TOKEN (required)
 * - MONGODB_URI (required) e.g. mongodb+srv://...
 * - PORT (optional, default 4000)
 * - CORS_ORIGIN (optional) - allowed frontend origin (e.g. https://your-frontend.vercel.app)
 *
 * Note: In production, consider storing large images in object storage (S3) and not in DB.
 */

const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

if(!TELEGRAM_BOT_TOKEN){
  console.error('Set TELEGRAM_BOT_TOKEN environment variable');
  process.exit(1);
}
if(!MONGODB_URI){
  console.error('Set MONGODB_URI environment variable');
  process.exit(1);
}

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=> console.log('Mongo connected'))
  .catch(err => { console.error('Mongo connect error', err); process.exit(1); });

const userSchema = new mongoose.Schema({
  userId: { type: Number, unique: true, index: true },
  photos: [String], // base64 dataURLs or image URLs
  texts: { type: mongoose.Schema.Types.Mixed }, // { fullname, dob, passport, qrContent }
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() }
}, { collection: 'user_data' });

const User = mongoose.model('User', userSchema);

const app = express();
app.use(bodyParser.json({limit: '10mb'})); // allow large base64 images
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({ origin: CORS_ORIGIN }));

// Utility: verify Telegram initData (see https://core.telegram.org/bots/webapps#validating-data-receive)
function verifyTelegramInitData(initDataRaw){
  if(!initDataRaw) return { ok: false, reason: 'no initData' };
  // initDataRaw is string like: "key1=value1\nkey2=value2\nhash=xxx" or in URL-encoded form? Telegram.WebApp.initData is a URL-style string "key1=value1&key2=value2"
  // The documentation: initData is "a string with parameters" (URL-encoded). Many examples pass WebApp.initData which is URL query string.
  // We'll parse key=value pairs split by '&' (or spaces). Then compute data_check_string as sorted keys except 'hash' joined by '\n'
  try {
    // ensure it's the raw string as provided by Telegram (WebApp.initData)
    const parts = initDataRaw.split('&').map(p => p.trim()).filter(Boolean);
    const data = {};
    for(const p of parts){
      const [k, ...vs] = p.split('=');
      data[k] = vs.join('=');
    }
    if(!data.hash) return { ok: false, reason: 'no hash' };

    const receivedHash = data.hash;
    // build data_check_string: sort keys (except hash) lexicographically and join "key=value" with '\n'
    const toCheck = [];
    Object.keys(data).filter(k => k !== 'hash').sort().forEach(k => {
      toCheck.push(`${k}=${data[k]}`);
    });
    const data_check_string = toCheck.join('\n');

    // secret_key = sha256(bot_token)
    const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();

    // hmac = hmac_sha256(secret_key, data_check_string)
    const hmac = crypto.createHmac('sha256', secretKey).update(data_check_string).digest('hex');

    // compare using constant-time compare
    const ok = crypto.timingSafeEqual(Buffer.from(hmac,'hex'), Buffer.from(receivedHash,'hex'));
    if(!ok) return { ok: false, reason: 'hash mismatch' };

    // If ok, return parsed object (values are URL-encoded; decode)
    const parsed = {};
    for(const k of Object.keys(data)){
      parsed[k] = decodeURIComponent(data[k]);
    }
    return { ok: true, data: parsed };
  } catch(err){
    return { ok: false, reason: 'exception', detail: err.message };
  }
}

// Middleware: verify header X-Init-Data
function requireTelegramInitData(req, res, next){
  const raw = req.get('X-Init-Data') || req.get('x-init-data') || req.body.initData || req.query.initData;
  const verified = verifyTelegramInitData(raw);
  if(!verified.ok){
    return res.status(401).json({ error: 'InitData verification failed', reason: verified.reason });
  }
  req.telegramInit = verified.data; // parsed fields (including 'user' if provided)
  next();
}

// GET user data
app.get('/api/user-data', requireTelegramInitData, async (req,res) => {
  try {
    const userIdParam = req.query.userId;
    if(!userIdParam) return res.status(400).json({ error: 'userId required' });
    const uid = Number(userIdParam);
    if(isNaN(uid)) return res.status(400).json({ error: 'userId must be numeric' });

    // Optionally verify that uid matches init data's user id if provided (init data includes user info)
    // If init includes user, check
    if(req.telegramInit.user){
      try {
        const initUser = JSON.parse(req.telegramInit.user);
        if(Number(initUser.id) !== uid){
          return res.status(403).json({ error: 'userId mismatch with initData' });
        }
      } catch(e){ /* ignore parse if not JSON */ }
    }

    const doc = await User.findOne({ userId: uid }).lean();
    if(!doc){
      return res.json({ record: null });
    }
    res.json({ record: doc });
  } catch (err){
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// POST save data
app.post('/api/save-data', requireTelegramInitData, async (req,res) => {
  try {
    const { userId, photos, texts } = req.body;
    if(!userId) return res.status(400).json({ error: 'userId required in body' });
    const uid = Number(userId);
    if(isNaN(uid)) return res.status(400).json({ error: 'userId must be numeric' });

    // if initData contains user, match it
    if(req.telegramInit.user){
      try {
        const initUser = JSON.parse(req.telegramInit.user);
        if(Number(initUser.id) !== uid){
          return res.status(403).json({ error: 'userId mismatch with initData' });
        }
      } catch(e){}
    }

    // Basic validation and sanitization
    const safePhotos = Array.isArray(photos) ? photos.slice(0,10).map(String) : [];
    const safeTexts = texts && typeof texts === 'object' ? texts : {};

    const now = new Date();
    const update = {
      photos: safePhotos,
      texts: safeTexts,
      updatedAt: now
    };
    const options = { upsert: true, new: true, setDefaultsOnInsert: true };

    const doc = await User.findOneAndUpdate({ userId: uid }, { $set: update, $setOnInsert: { createdAt: now } }, options).lean();
    res.json({ ok: true, record: doc });
  } catch(err){
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// simple health route
app.get('/_status', (req,res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
