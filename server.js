const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require('cookie-parser');
const { config } = require("./config");
const crypto = require("crypto");
const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');
const { exec } = require('child_process');

const path = require('path');
const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow non-browser requests
    if (process.env.NODE_ENV === 'production') {
      const allowed = ['https://your-domain.com'];
      if (allowed.indexOf(origin) !== -1) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    }
    // Allow localhost origins on any port for development
    try {
      const url = new URL(origin);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return callback(null, true);
    } catch (e) {
      // ignore
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Socket.IO with authentication
// Accept any localhost origin (localhost or 127.0.0.1 on any port) in development
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // allow non-browser or same-origin requests
      if (!origin) return callback(null, true);
      try {
        const u = new URL(origin);
        const host = u.hostname;
        if (host === 'localhost' || host === '127.0.0.1') return callback(null, true);
      } catch (e) {
        // ignore and fall through
      }
      if (process.env.NODE_ENV === 'production') {
        const allowed = ['https://your-domain.com'];
        if (allowed.indexOf(origin) !== -1) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      }
      // Fallback: disallow other origins in dev
      console.warn('Socket.IO CORS reject origin:', origin);
      return callback(null, false);
    },
    credentials: true
  }
});

app.use(express.json());
// parse cookies for session handling
app.use(cookieParser());

// Serve frontend static files from project root so frontend and backend are same-origin in prod
const staticDir = path.join(__dirname);
app.use(express.static(staticDir));

// Endpoint to expose public client-side configuration
app.get('/api/config', (req, res) => {
  const publicConfig = {
    firebaseConfig: {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
      measurementId: process.env.FIREBASE_MEASUREMENT_ID
    }
  };
  res.json(publicConfig);
});

// Health endpoint
app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Session management endpoints (HTTP-only cookies)
// POST /sessionLogin: verify ID token and create session cookie
app.post('/sessionLogin', async (req, res) => {
  const { idToken } = req.body || {};
  if (!idToken) return res.status(400).json({ error: 'idToken required' });

  if (!firebaseAdminInitialized) {
    console.warn('/sessionLogin: Firebase Admin not initialized; cannot verify token');
    return res.status(503).json({ error: 'Service unavailable' });
  }

  try {
    // verify token
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const expiresIn = 14 * 24 * 60 * 60 * 1000; // 14 days
    const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });

    // set secure, httpOnly cookie (secure only in production)
    res.cookie('ww_session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    return res.json({ ok: true, uid, email: decoded.email || null });
  } catch (err) {
    console.error('/sessionLogin error', err && err.message ? err.message : err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// GET /sessionLogout: clear session cookie
app.get('/sessionLogout', (req, res) => {
  res.clearCookie('ww_session', { path: '/' });
  res.json({ ok: true });
});

// Helper middleware to verify session cookie on protected routes
async function verifySessionCookie(req, res, next) {
  const sessionCookie = req.cookies && req.cookies.ww_session;
  if (!sessionCookie) return res.status(401).json({ error: 'Unauthorized: no session' });
  if (!firebaseAdminInitialized) return res.status(503).json({ error: 'Service unavailable' });
  try {
    const claims = await admin.auth().verifySessionCookie(sessionCookie, true);
    req.user = claims;
    return next();
  } catch (err) {
    console.warn('verifySessionCookie failed', err && err.message ? err.message : err);
    res.clearCookie('ww_session', { path: '/' });
    return res.status(401).json({ error: 'Unauthorized: invalid session' });
  }
}
// Global error handlers to avoid silent crash and provide diagnostics
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Initialize Supabase client (server-side)
const SUPABASE_URL = process.env.SUPABASE_URL || (config && config.privateConfig && config.privateConfig.SUPABASE_URL);
const SUPABASE_KEY = process.env.SUPABASE_KEY || (config && config.privateConfig && config.privateConfig.SUPABASE_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const FULLNESS_ALERT_THRESHOLD = parseInt(process.env.FULLNESS_ALERT_THRESHOLD || '80', 10);

let bins = {}; // Store bin data
// Simple in-memory provisioning queue: { binId: { ssid, wifiPassword, location, createdAt } }
let provisionQueue = {};
// In-memory fallback stores for environments where Supabase schema/tables are not available
let _inMemoryRoutes = []; // { id, driverId, bins, startLocation, dumpyard, status, createdAt, collectedBins }
let _inMemoryDriverLocations = {}; // driverId -> { driverId, lat, lng, bearing, updatedAt }
let _inMemoryCollections = []; // collection records
let _inMemoryAlerts = []; // stored alerts for UI fallback
let _inMemoryDeviceTokens = {}; // driverId -> [ { token, platform, createdAt } ]
const FIRE_TEMP_THRESHOLD = parseInt(process.env.FIRE_TEMP_THRESHOLD || '60', 10);

// Admin key for simple protection (replace with env var in production)
const ADMIN_KEY = process.env.ADMIN_KEY || 'dev-default-key';

// Helper: find an assigned route that contains the given binId
async function findAssignedRouteForBin(binId) {
  // Check in-memory first (fast)
  try {
    const mem = _inMemoryRoutes.find(r => Array.isArray(r.bins) && r.bins.find(b => (b.id || b) === binId) && r.status === 'assigned');
    if (mem) return mem;
  } catch (e) { /* ignore */ }

  // Try database: fetch recent assigned routes and look for binId in bins array
  try {
    const { data, error } = await supabase.from('routes').select('*').eq('status', 'assigned').limit(500);
    if (!error && Array.isArray(data)) {
      for (const r of data) {
        try {
          const binsArr = r.bins || [];
          if (Array.isArray(binsArr) && binsArr.find(b => (b.id || b) === binId)) return r;
        } catch (e) { /* ignore */ }
      }
    }
  } catch (e) {
    console.warn('findAssignedRouteForBin DB query failed', e && e.message ? e.message : e);
  }
  return null;
}
// Initialize Firebase Admin SDK when credentials provided via env
let firebaseAdminInitialized = false;
try {
  const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT || null;
  const svcPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || null;
  let cred = null;
  if (svcJson) {
    try { cred = JSON.parse(svcJson); } catch (e) { cred = null; console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON', e); }
  }
  if (!cred && svcPath) {
    try { cred = require(svcPath); } catch (e) { cred = null; console.warn('Failed to require FIREBASE_SERVICE_ACCOUNT_PATH', e); }
  }
  if (cred) {
    admin.initializeApp({ credential: admin.credential.cert(cred) });
    firebaseAdminInitialized = true;
    console.log('Firebase Admin initialized for FCM');
  }
} catch (e) {
  console.warn('Firebase Admin init error', e && e.message ? e.message : e);
}

// Helper: send push notifications to driver tokens. Uses firebase-admin when available, falls back to legacy FCM HTTP if configured.
async function sendPushToDriverForAlert(driverId, alertPayload, broadcast = false) {
  try {
    const tokens = [];
    if (driverId) {
      const arr = _inMemoryDeviceTokens[driverId] || [];
      arr.forEach(i => tokens.push(i.token));
    }
    if (broadcast) {
      Object.values(_inMemoryDeviceTokens).forEach(arr => arr.forEach(i => tokens.push(i.token)));
    }
    const unique = [...new Set(tokens)].filter(Boolean);
    if (unique.length === 0) return;

    const title = alertPayload.type ? `${alertPayload.type} alert` : 'Alert';
    const body = alertPayload.message || (alertPayload.bin && alertPayload.bin.id ? `Bin ${alertPayload.bin.id}` : 'Attention required');

    if (firebaseAdminInitialized) {
      // Use firebase-admin to send multicast
      const message = {
        tokens: unique,
        notification: { title, body },
        data: { alert: JSON.stringify(alertPayload) }
      };
      try {
        const resp = await admin.messaging().sendMulticast(message);
        console.log('FCM multicast result', resp.successCount, 'success,', resp.failureCount, 'failures');
        if (resp.failureCount > 0) {
          resp.responses.forEach((r, idx) => {
            if (!r.success) console.warn('FCM send failed for token', unique[idx], r.error && r.error.message ? r.error.message : r.error);
          });
        }
        return;
      } catch (e) {
        console.warn('firebase-admin sendMulticast failed', e && e.message ? e.message : e);
        // fallback to legacy below if configured
      }
    }

    // Fallback: legacy HTTP endpoint if server key provided
    if (process.env.FCM_SERVER_KEY) {
      const payload = { registration_ids: unique, notification: { title, body }, data: { alert: JSON.stringify(alertPayload) } };
      const f = (typeof fetch === 'function') ? fetch : (globalThis && globalThis.fetch ? globalThis.fetch : null);
      if (!f) return;
      const resp = await f('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: { 'Authorization': `key=${process.env.FCM_SERVER_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const txt = await resp.text();
      console.log('Legacy FCM send response', resp.status, txt);
    }
  } catch (e) {
    console.warn('sendPushToDriverForAlert failed', e && e.message ? e.message : e);
  }
}

// WebSocket connection
io.on("connection", (socket) => {
  console.log("New client connected", socket.id);

  // Subscribe to a specific bin updates
  socket.on("subscribeBin", (binId) => {
    console.log(`Socket ${socket.id} subscribed to Bin ${binId}`);
    socket.join(`bin:${binId}`);
    if (bins[binId]) {
      socket.emit("binData", bins[binId]);
    }
  });

  // Subscribe to driver location updates
  socket.on('subscribeDriver', (driverId) => {
    console.log(`Socket ${socket.id} subscribed to Driver ${driverId}`);
    socket.join(`driver:${driverId}`);
  });

  // Subscribe to route events
  socket.on('subscribeRoutes', () => {
    socket.join('routes');
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected ${socket.id}`);
  });
});

// ESP32 sends data here
app.post("/updateBin", (req, res) => {
  const { id, fullness, weight, temp, humidity, temperature } = req.body;
  const binId = id;
  const binPayload = {
    id: binId,
    bin_name: binId, // default name if not provided
    fullness: typeof fullness !== 'undefined' ? fullness : 0,
    weight: typeof weight !== 'undefined' ? weight : 0,
    temperature: typeof temperature !== 'undefined' ? temperature : temp || null,
    humidity: typeof humidity !== 'undefined' ? humidity : null,
    updated_at: new Date().toISOString(),
    location: req.body.location || null,
    // accept lat/lng if provided (useful for nearby-bins when DB not available)
    lat: (typeof req.body.lat === 'number') ? req.body.lat : (req.body.lat ? Number(req.body.lat) : null),
    lng: (typeof req.body.lng === 'number') ? req.body.lng : (req.body.lng ? Number(req.body.lng) : null)
  };

  // Try to persist to Supabase using upsert to avoid duplicate-pkey errors
  (async () => {
    try {
      const { data, error } = await supabase.from('bins').upsert(binPayload, { onConflict: 'id' }).select().single();
      if (error) throw error;
      const prev = bins[binId] || null;
      bins[binId] = data || binPayload;
      io.to(`bin:${binId}`).emit('binData', bins[binId]);
      io.to('routes').emit('binUpdate', bins[binId]);

      // Emit a fullness alert when the fullness crosses the threshold (e.g., becomes >= 80)
      try {
        const prevFullness = prev && typeof prev.fullness !== 'undefined' ? Number(prev.fullness) : null;
        const newFullness = typeof bins[binId].fullness !== 'undefined' ? Number(bins[binId].fullness) : null;
        const weightVal = typeof bins[binId].weight !== 'undefined' ? Number(bins[binId].weight) : 0;
        const tempVal = typeof bins[binId].temperature !== 'undefined' && bins[binId].temperature !== null ? Number(bins[binId].temperature) : null;
        const status = bins[binId].status || null;

        // Fullness threshold alert (general)
        if (newFullness !== null && newFullness >= FULLNESS_ALERT_THRESHOLD && (prevFullness === null || prevFullness < FULLNESS_ALERT_THRESHOLD)) {
          const alertPayload = { type: 'fullness', bin: bins[binId], threshold: FULLNESS_ALERT_THRESHOLD, createdAt: new Date().toISOString() };
          _inMemoryAlerts.push(alertPayload);
          io.to('routes').emit('fullnessAlert', alertPayload);
          io.emit('fullnessAlert', alertPayload);
          console.log('Emitted fullnessAlert for bin', binId, 'fullness', newFullness);
          try {
            await supabase.from('alerts').insert([{ binId, type: 'fullness', message: `Bin ${binId} reached ${newFullness}%`, createdAt: new Date().toISOString() }]);
          } catch (insertErr) { console.warn('Failed to insert alert record:', insertErr && insertErr.message ? insertErr.message : insertErr); }
        }

        // Weighted fullness alert (assign specifically to driver of route if exists) -- deliver direct popup
        if (newFullness !== null && newFullness >= FULLNESS_ALERT_THRESHOLD && weightVal > 12) {
          const wf = { type: 'weightedFullness', bin: bins[binId], weight: weightVal, threshold: FULLNESS_ALERT_THRESHOLD, createdAt: new Date().toISOString() };
          _inMemoryAlerts.push(wf);
          // Try to find assigned route for this bin and target the driver specifically
          let assigned = null;
          try {
            assigned = await findAssignedRouteForBin(binId);
            if (assigned && assigned.driverId) {
              io.to(`driver:${assigned.driverId}`).emit('weightedFullnessAlert', wf);
            }
          } catch (e) { console.warn('Error targeting weightedFullnessAlert', e); }
          // Also emit to routes room for monitoring dashboards
          io.to('routes').emit('weightedFullnessAlert', wf);
          console.log('Emitted weightedFullnessAlert for bin', binId, 'weight', weightVal);
          try { await supabase.from('alerts').insert([{ binId, type: 'weightedFullness', message: `Bin ${binId} ${newFullness}% and weight ${weightVal}kg`, createdAt: new Date().toISOString() }]); } catch (insertErr) { }
          // Send push notifications to registered device tokens for assigned driver (if available)
          try { await sendPushToDriverForAlert(assigned ? assigned.driverId : null, wf); } catch (e) { console.warn('Push send failed', e); }
        }

        // Hazard detection: high temperature or explicit hazard status
        const isTempHazard = tempVal !== null && tempVal >= FIRE_TEMP_THRESHOLD;
        const isStatusHazard = status && (status === 'on_fire' || status === 'hazard' || status === 'chemical');
        if (isTempHazard || isStatusHazard) {
          const hazard = { type: 'hazard', bin: bins[binId], reason: isTempHazard ? 'high_temperature' : 'status', temp: tempVal, createdAt: new Date().toISOString() };
          _inMemoryAlerts.push(hazard);
          // Target assigned driver if exists, otherwise broadcast to routes and all drivers
          let assigned = null;
          try {
            assigned = await findAssignedRouteForBin(binId);
            if (assigned && assigned.driverId) {
              io.to(`driver:${assigned.driverId}`).emit('hazardAlert', hazard);
            }
          } catch (e) { console.warn('Error targeting hazardAlert', e); }
          io.to('routes').emit('hazardAlert', hazard);
          io.emit('hazardAlert', hazard);
          console.log('Emitted hazardAlert for bin', binId, 'temp/status', tempVal, status);
          try { await supabase.from('alerts').insert([{ binId, type: 'hazard', message: `Hazard at ${binId}`, data: JSON.stringify(hazard), createdAt: new Date().toISOString() }]); } catch (insertErr) { }
          try { await sendPushToDriverForAlert(assigned ? assigned.driverId : null, hazard, true); } catch (e) { console.warn('Push send failed', e); }
        }
      } catch (checkErr) {
        console.warn('Error checking fullness threshold:', checkErr && checkErr.message ? checkErr.message : checkErr);
      }
      return res.json({ ok: true, bin: bins[binId] });
    } catch (err) {
      console.warn('Supabase upsert failed, falling back to in-memory store:', err.message || err);
      // Fallback to in-memory store
      bins[binId] = binPayload;
      io.to(`bin:${binId}`).emit('binData', bins[binId]);
      io.to('routes').emit('binUpdate', bins[binId]);
      return res.status(200).json({ ok: true, bin: bins[binId], warning: 'db-fallback' });
    }
  })();
});

// Upsert a bin (safe insert/update) via API — server-side uses service key
app.post('/bins', async (req, res) => {
  const bin = req.body;
  if (!bin || !bin.id) return res.status(400).json({ error: 'id required' });
  try {
    const { data, error } = await supabase.from('bins').upsert(bin, { onConflict: 'id' }).select().single();
    if (error) throw error;
    // Update in-memory cache and emit
    bins[bin.id] = data;
    io.to(`bin:${bin.id}`).emit('binData', data);
    io.to('routes').emit('binUpdate', data);
    res.json({ ok: true, bin: data });
  } catch (err) {
    console.error('Upsert /bins error:', err.message || err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// Get bin by id
app.get('/bins/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const { data, error } = await supabase.from('bins').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    if (data) return res.json({ bin: data });
    // fallback to in-memory
    if (bins[id]) return res.json({ bin: bins[id], source: 'memory' });
    return res.status(404).json({ error: 'not found' });
  } catch (err) {
    console.error('Get bin error:', err.message || err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// List bins (simple endpoint for clients) - returns all bins or recent ones
app.get('/bins', async (req, res) => {
  try {
    // Try database first
    try {
      const { data, error } = await supabase.from('bins').select('*').order('updated_at', { ascending: false }).limit(500);
      if (error) throw error;
      return res.json({ bins: data });
    } catch (dbErr) {
      // fallback to in-memory cache
      const arr = Object.values(bins || {});
      return res.json({ bins: arr });
    }
  } catch (err) {
    console.error('GET /bins error', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// Nearby bins endpoint: ?lat=..&lng=..&r=meters
app.get('/nearby-bins', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radiusMeters = parseInt(req.query.r || '5000', 10);
  if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'lat and lng required' });
  try {
    const degRadius = radiusMeters / 111000;
    const latMin = lat - degRadius;
    const latMax = lat + degRadius;
    const lngMin = lng - degRadius;
    const lngMax = lng + degRadius;
    try {
      const { data, error } = await supabase.from('bins').select('id, lat, lng, fullness, status, weight, temperature').gte('lat', latMin).lte('lat', latMax).gte('lng', lngMin).lte('lng', lngMax);
      if (error) throw error;
      return res.json({ bins: data || [] });
    } catch (dbErr) {
      // fallback to in-memory filter
      const all = Object.values(bins || {});
      const nearby = all.filter(b => typeof b.lat === 'number' && typeof b.lng === 'number' && b.lat >= latMin && b.lat <= latMax && b.lng >= lngMin && b.lng <= lngMax);
      return res.json({ bins: nearby });
    }
  } catch (err) {
    console.error('nearby-bins error', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// Nearby bins endpoint - server-side query to Supabase (hides anon key)
// Query: /nearby-bins?lat=12.34&lng=56.78&r=3000
app.get('/nearby-bins', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radius = parseFloat(req.query.r) || 5000; // meters
  try {
    // If lat/lng provided, use bounding box approximation
    if (!isNaN(lat) && !isNaN(lng)) {
      const degRadius = radius / 111000;
      const latMin = lat - degRadius;
      const latMax = lat + degRadius;
      const lngMin = lng - degRadius;
      const lngMax = lng + degRadius;
      try {
        const { data, error } = await supabase.from('bins').select('id, lat, lng, fullness, status, temperature, weight').gte('lat', latMin).lte('lat', latMax).gte('lng', lngMin).lte('lng', lngMax);
        if (error) throw error;
        return res.json({ bins: data || [] });
      } catch (dbErr) {
        // fallback to in-memory filter
        const results = Object.values(bins).filter(b => {
          if (typeof b.lat !== 'number' || typeof b.lng !== 'number') return false;
          return b.lat >= latMin && b.lat <= latMax && b.lng >= lngMin && b.lng <= lngMax;
        });
        return res.json({ bins: results });
      }
    }

    // No lat/lng: return a limited set of bins
    try {
      const { data, error } = await supabase.from('bins').select('id, lat, lng, fullness, status, temperature, weight').limit(200);
      if (error) throw error;
      return res.json({ bins: data || [] });
    } catch (dbErr) {
      // fallback to in-memory
      return res.json({ bins: Object.values(bins).slice(0, 200) });
    }
  } catch (err) {
    console.error('nearby-bins error:', err && err.message ? err.message : err);
    res.status(500).json({ error: err && err.message ? err.message : 'Internal error' });
  }
});

// --- Route assignment & tracking endpoints ---

// Assign a route to a driver. Body: { driverId, bins: [{id, lat, lng}], startLocation, dumpyard }
app.post('/assign-route', async (req, res) => {
  const { driverId, bins: assignedBins, startLocation, dumpyard } = req.body;
  if (!driverId || !Array.isArray(assignedBins) || assignedBins.length === 0) {
    return res.status(400).json({ error: 'driverId and bins are required' });
  }

    try {
      const route = {
        id: crypto.randomUUID(),
        driverId,
        bins: assignedBins,
        startLocation: startLocation || null,
        dumpyard: dumpyard || null,
        status: 'assigned',
        createdAt: new Date().toISOString(),
        collectedBins: []
      };
      try {
        const { data, error } = await supabase.from('routes').insert([route]).select().single();
        if (error) throw error;
        _inMemoryRoutes.push(data);
        io.to(`driver:${driverId}`).emit('routeAssigned', { route: data });
        io.to('routes').emit('routeAssigned', { route: data });
        return res.json({ ok: true, route: data });
      } catch (dbErr) {
        // Fallback to in-memory
        _inMemoryRoutes.push(route);
        io.to(`driver:${driverId}`).emit('routeAssigned', { route });
        io.to('routes').emit('routeAssigned', { route });
        return res.json({ ok: true, route });
      }
    } catch (err) {
      console.error('Assign route error:', err.message || err);
      res.status(500).json({ error: err.message || 'Internal error' });
    }
});

// Get active route for a driver
app.get('/driver/:id/route', async (req, res) => {
  const driverId = req.params.id;
  try {
    try {
      const { data, error } = await supabase.from('routes').select('*').eq('driverId', driverId).eq('status', 'assigned').order('createdAt', { ascending: false }).limit(1).single();
      if (error && error.code !== 'PGRST116') throw error;
      return res.json({ route: data || null });
    } catch (dbErr) {
      // Fallback to in-memory
      const r = _inMemoryRoutes.filter(r => r.driverId === driverId && r.status === 'assigned').sort((a,b)=> (b.createdAt||0)-(a.createdAt||0))[0] || null;
      return res.json({ route: r });
    }
  } catch (err) {
    console.error('Get driver route error:', err.message || err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// Driver posts current location for tracking
app.post('/driver/:id/location', async (req, res) => {
  const driverId = req.params.id;
  const { lat, lng, bearing } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

  try {
    const record = { driverId, lat, lng, bearing: bearing || null, updatedAt: new Date().toISOString() };
    try {
      await supabase.from('driver_locations').upsert(record, { onConflict: ['driverId'] });
      _inMemoryDriverLocations[driverId] = record;
    } catch (dbErr) {
      // fallback
      _inMemoryDriverLocations[driverId] = record;
    }
    // Emit realtime location update
    io.emit('driverLocation', record);
    res.json({ ok: true });
  } catch (err) {
    console.error('Driver location error:', err.message || err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// Driver acknowledges collection of a bin
app.post('/route/:routeId/collect', async (req, res) => {
  const routeId = req.params.routeId;
  const { binId, driverId, timestamp } = req.body;
  if (!binId || !driverId) return res.status(400).json({ error: 'binId and driverId required' });

  try {
    const collectedAt = timestamp || new Date().toISOString();
    // Insert into collections table
    try {
      const { data, error } = await supabase.from('collections').insert([{ routeId, binId, driverId, collectedAt }]).select().single();
      if (error) throw error;
      _inMemoryCollections.push(data);
    } catch (dbErr) {
      // fallback to in-memory
      _inMemoryCollections.push({ routeId, binId, driverId, collectedAt });
    }
    // Try to call RPC and fallback to updating in-memory route record
    try {
      await supabase.rpc('mark_bin_collected', { p_route_id: routeId, p_bin_id: binId, p_driver_id: driverId, p_collected_at: collectedAt });
    } catch (rpcErr) {
      console.warn('RPC mark_bin_collected failed, falling back to updating in-memory route record:', rpcErr.message || rpcErr);
      const routeRec = _inMemoryRoutes.find(r => r.id === routeId);
      if (routeRec) {
        routeRec.collectedBins = routeRec.collectedBins || [];
        routeRec.collectedBins.push({ binId, driverId, collectedAt });
      }
    }

    io.to(`route:${routeId}`).emit('binCollected', { routeId, binId, driverId, collectedAt });
    io.to(`driver:${driverId}`).emit('binCollected', { routeId, binId, driverId, collectedAt });
    io.to('routes').emit('binCollected', { routeId, binId, driverId, collectedAt });
    res.json({ ok: true, collection: { routeId, binId, driverId, collectedAt } });
  } catch (err) {
    console.error('Collect bin error:', err.message || err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// Get route history for driver
app.get('/routes/history/:driverId', async (req, res) => {
  const driverId = req.params.driverId;
  try {
    const { data, error } = await supabase.from('routes').select('*').eq('driverId', driverId).order('createdAt', { ascending: false });
    if (error) throw error;
    res.json({ routes: data });
  } catch (err) {
    console.error('Routes history error:', err.message || err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// Admin creates a provisioning entry — ESP32 will poll /provision/:binId to get config
app.post('/provision', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });

  const { binId, ssid, wifiPassword, location } = req.body;
  if (!binId || !ssid) return res.status(400).json({ error: 'binId and ssid are required' });

  provisionQueue[binId] = {
    ssid,
    wifiPassword,
    location: location || null,
    createdAt: Date.now()
  };

  console.log(`Provision queued for bin ${binId}`);
  res.json({ ok: true });
});

// ESP32 polls for provisioning config
app.get('/provision/:binId', (req, res) => {
  const binId = req.params.binId;
  const entry = provisionQueue[binId];
  if (!entry) return res.status(204).send(); // No content — nothing to provision

  // Return the entry but DO NOT delete it yet; require device to ack after successful config
  res.json({ binId, ssid: entry.ssid, wifiPassword: entry.wifiPassword, location: entry.location });
});

// ESP32 acknowledges provisioning — server removes from queue
app.post('/provision/:binId/ack', (req, res) => {
  const binId = req.params.binId;
  // Optionally check a pre-shared device token in headers for more security
  if (provisionQueue[binId]) {
    delete provisionQueue[binId];
    console.log(`Provision acknowledged and removed for bin ${binId}`);
    return res.json({ ok: true });
  }
  return res.status(404).json({ error: 'Not found' });
});

// Register device tokens for push notifications
app.post('/devices/register', async (req, res) => {
  const { driverId, token, platform } = req.body;
  if (!driverId || !token) return res.status(400).json({ error: 'driverId and token required' });
  try {
    // Persist to DB if available
    try {
      await supabase.from('device_tokens').upsert({ driverId, token, platform: platform || null, createdAt: new Date().toISOString() }, { onConflict: ['driverId', 'token'] });
    } catch (dbErr) {
      // ignore DB errors
    }
    _inMemoryDeviceTokens[driverId] = _inMemoryDeviceTokens[driverId] || [];
    // dedupe
    if (!_inMemoryDeviceTokens[driverId].find(d => d.token === token)) {
      _inMemoryDeviceTokens[driverId].push({ token, platform: platform || null, createdAt: new Date().toISOString() });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('devices/register error', err && err.message ? err.message : err);
    res.status(500).json({ error: err && err.message ? err.message : 'Internal error' });
  }
});

// Alerts history endpoint with basic filters: ?type=&driverId=&binId=&since=
app.get('/alerts', async (req, res) => {
  const { type, driverId, binId, since } = req.query;
  try {
    try {
      let q = supabase.from('alerts').select('*').order('createdAt', { ascending: false }).limit(1000);
      const { data, error } = await q;
      if (!error && Array.isArray(data)) {
        let results = data;
        if (type) results = results.filter(r => r.type === type);
        if (driverId) results = results.filter(r => r.driverId === driverId);
        if (binId) results = results.filter(r => r.binId === binId);
        if (since) results = results.filter(r => new Date(r.createdAt) >= new Date(since));
        // If DB returned no alerts but we have in-memory alerts (DB missing), return those instead
        if ((!results || results.length === 0) && _inMemoryAlerts.length > 0) {
          let mem = Array.from(_inMemoryAlerts).reverse();
          if (type) mem = mem.filter(r => r.type === type);
          if (driverId) mem = mem.filter(r => r.driverId === driverId);
          if (binId) mem = mem.filter(r => (r.bin && (r.bin.id === binId || r.binId === binId)) || r.binId === binId);
          if (since) mem = mem.filter(r => new Date(r.createdAt) >= new Date(since));
          return res.json({ alerts: mem });
        }
        return res.json({ alerts: results });
      }
    } catch (dbErr) {
      // fallback to in-memory
    }
    // In-memory fallback
    let results = Array.from(_inMemoryAlerts).reverse();
    if (type) results = results.filter(r => r.type === type);
    if (driverId) results = results.filter(r => r.driverId === driverId);
    if (binId) results = results.filter(r => (r.bin && (r.bin.id === binId || r.binId === binId)) || r.binId === binId);
    if (since) results = results.filter(r => new Date(r.createdAt) >= new Date(since));
    res.json({ alerts: results });
  } catch (err) {
    console.error('GET /alerts error', err && err.message ? err.message : err);
    res.status(500).json({ error: err && err.message ? err.message : 'Internal error' });
  }
});

// Very small heuristic CVRP optimizer: chunk bins into routes of up to capacity and optionally assign to drivers
app.post('/optimize-route', async (req, res) => {
  const { bins: inputBins, drivers, vehicleCapacity } = req.body;
  if (!Array.isArray(inputBins) || inputBins.length === 0) return res.status(400).json({ error: 'bins required' });
  const cap = parseInt(vehicleCapacity || 10, 10) || 10;
  try {
    // Greedy nearest-neighbor with capacity
    const binsCopy = inputBins.map(b => ({ ...b, assigned: false }));
    // Helper: haversine distance in meters
    function haversine(a, b) {
      const R = 6371000; // m
      const toRad = v => (v * Math.PI) / 180;
      const dLat = toRad((b.lat || 0) - (a.lat || 0));
      const dLon = toRad((b.lng || 0) - (a.lng || 0));
      const lat1 = toRad(a.lat || 0);
      const lat2 = toRad(b.lat || 0);
      const sinDlat = Math.sin(dLat / 2);
      const sinDlon = Math.sin(dLon / 2);
      const aa = sinDlat * sinDlat + sinDlon * sinDlon * Math.cos(lat1) * Math.cos(lat2);
      const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
      return R * c;
    }

    const routes = [];
    // Start from optional startLocation if provided per request; otherwise pick centroid
    let start = null;
    if (req.body.startLocation && req.body.startLocation.lat && req.body.startLocation.lng) start = req.body.startLocation;
    if (!start) {
      const avg = binsCopy.reduce((acc, b) => { acc.lat += (b.lat || 0); acc.lng += (b.lng || 0); return acc; }, { lat: 0, lng: 0 });
      start = { lat: avg.lat / binsCopy.length, lng: avg.lng / binsCopy.length };
    }

    while (binsCopy.some(b => !b.assigned)) {
      const routeBins = [];
      let current = start;
      let load = 0;
      while (true) {
        // find nearest unassigned bin
        let nearest = null;
        let nearestDist = Infinity;
        for (const b of binsCopy) {
          if (b.assigned) continue;
          if (typeof b.lat !== 'number' || typeof b.lng !== 'number') continue;
          const d = haversine(current, b);
          if (d < nearestDist) { nearestDist = d; nearest = b; }
        }
        if (!nearest) break;
        // estimate demand: use fullness percent or weight (normalize) as 1 unit per bin if missing
        const demand = (typeof nearest.weight === 'number' && nearest.weight > 0) ? Math.ceil(nearest.weight / 10) : ((typeof nearest.fullness === 'number') ? 1 : 1);
        if (load + demand > cap && routeBins.length > 0) break; // capacity reached for this vehicle
        // assign
        nearest.assigned = true;
        routeBins.push(nearest);
        load += demand;
        current = nearest;
      }
      if (routeBins.length === 0) break;
      const route = { id: crypto.randomUUID(), bins: routeBins, startLocation: start, dumpyard: req.body.dumpyard || null, status: 'assigned', createdAt: new Date().toISOString(), collectedBins: [] };
      routes.push(route);
    }

    // Optionally assign drivers round-robin
    if (Array.isArray(drivers) && drivers.length > 0) {
      for (let i = 0; i < routes.length; i++) {
        routes[i].driverId = drivers[i % drivers.length].id || drivers[i % drivers.length];
      }
    }

    // persist and emit
    for (const r of routes) {
      try {
        const { data, error } = await supabase.from('routes').insert([r]).select().single();
        if (!error && data) {
          _inMemoryRoutes.push(data);
          if (data.driverId) io.to(`driver:${data.driverId}`).emit('routeAssigned', { route: data });
          io.to('routes').emit('routeAssigned', { route: data });
          continue;
        }
      } catch (dbErr) {
        // ignore
      }
      _inMemoryRoutes.push(r);
      if (r.driverId) io.to(`driver:${r.driverId}`).emit('routeAssigned', { route: r });
      io.to('routes').emit('routeAssigned', { route: r });
    }

    res.json({ routes });
  } catch (err) {
    console.error('/optimize-route error', err && err.message ? err.message : err);
    res.status(500).json({ error: err && err.message ? err.message : 'Internal error' });
  }
});

// CVRP API endpoint: accepts POST JSON and returns solver JSON
app.post('/api/cvrp', (req, res) => {
  const inputData = req.body || {};
  // Add Mappls API key to the payload if it exists in the environment
  if (process.env.MAPPLS_API_KEY) {
    inputData.mappls_api_key = process.env.MAPPLS_API_KEY;
  }
  try {
    const PYTHON_CMD = process.env.PYTHON_CMD || 'python';
    const python = require('child_process').spawn(PYTHON_CMD, ['cvrp_solver.py'], { cwd: __dirname });
    const payload = JSON.stringify(inputData);
    let stdout = '';
    let stderr = '';

    // Collect stdout
    python.stdout.on('data', (data) => { stdout += data.toString(); });
    python.stderr.on('data', (data) => { stderr += data.toString(); });

    // On process close, parse JSON and respond; fallback to JS solver on errors
    python.on('close', (code) => {
      if (stderr && stderr.trim().length > 0) {
        console.error('/api/cvrp python stderr:', stderr);
      }
        try {
          const parsed = JSON.parse(stdout);
          // If python returned an error object, treat as failure and fallback
          if (parsed && typeof parsed === 'object' && parsed.error) {
            console.warn('/api/cvrp python solver returned error, falling back to JS solver:', parsed.error);
            const jsResult = jsFallbackCVRPSolve(inputData);
            return res.json(jsResult);
          }
          return res.json(parsed);
        } catch (e) {
          console.warn('/api/cvrp python solver failed or returned non-JSON, falling back to JS solver', e && e.message ? e.message : e);
          try {
            const jsResult = jsFallbackCVRPSolve(inputData);
            return res.json(jsResult);
          } catch (je) {
            console.error('/api/cvrp js fallback also failed', je && je.message ? je.message : je);
            return res.status(500).json({ error: 'Solver error', details: je && je.message ? je.message : je, raw: stdout, stderr });
          }
        }
    });

    // Write payload and close stdin
    python.stdin.write(payload);
    python.stdin.end();

    // Safety timeout: kill python if it runs too long (30s)
    setTimeout(() => {
      try { python.kill('SIGKILL'); } catch (e) {}
    }, 30 * 1000);
  } catch (err) {
    console.error('/api/cvrp spawn error', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Failed to start solver' });
  }
});

// JS fallback CVRP solver: greedy nearest-neighbor that respects capacities
function haversineMeters(a, b) {
  const R = 6371000; // meters
  const toRad = v => (v * Math.PI) / 180;
  const lat1 = toRad(a[0]);
  const lon1 = toRad(a[1]);
  const lat2 = toRad(b[0]);
  const lon2 = toRad(b[1]);
  const dlat = lat2 - lat1;
  const dlon = lon2 - lon1;
  const h = Math.sin(dlat/2) * Math.sin(dlat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon/2) * Math.sin(dlon/2);
  return Math.round(R * 2 * Math.asin(Math.sqrt(h)));
}

function jsFallbackCVRPSolve(payload) {
  // payload: { locations: [{lat,lng}], demands: [..], vehicle_capacities:[..], num_vehicles, depot }
  const locations = (payload.locations || []).map(l => (Array.isArray(l) ? [Number(l[0]), Number(l[1])] : [Number(l.lat), Number(l.lng)]) ).filter(Boolean);
  if (!locations || locations.length === 0) throw new Error('No locations provided');
  const demands = (payload.demands && payload.demands.length === locations.length) ? payload.demands.map(Number) : new Array(locations.length).fill(1);
  const vehicle_capacities = payload.vehicle_capacities && payload.vehicle_capacities.length > 0 ? payload.vehicle_capacities.map(Number) : new Array(Math.max(1, Number(payload.num_vehicles) || 1)).fill(Number(payload.vehicle_capacity || 10));
  const num_vehicles = Number(payload.num_vehicles) || vehicle_capacities.length || 1;
  const depot = Number.isInteger(payload.depot) ? payload.depot : 0;

  // build distance matrix
  const n = locations.length;
  const dist = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i=0;i<n;i++) for (let j=0;j<n;j++) if (i!==j) dist[i][j] = haversineMeters(locations[i], locations[j]);

  // simple greedy: start each vehicle at depot, pick nearest unvisited while capacity allows
  const unvisited = new Set(); for (let i=0;i<n;i++) if (i !== depot) unvisited.add(i);
  const routes = [];
  for (let v=0; v<num_vehicles && unvisited.size>0; v++) {
    let cap = vehicle_capacities[v] || vehicle_capacities[vehicle_capacities.length-1] || 10;
    const routeNodes = [depot];
    let current = depot;
    let routeDist = 0;
    while (true) {
      // find nearest unvisited that fits capacity
      let nearest = -1; let nd = Infinity;
      for (const u of unvisited) {
        const demand = Number(demands[u] || 1);
        if (demand > cap) continue;
        if (dist[current][u] < nd) { nd = dist[current][u]; nearest = u; }
      }
      if (nearest === -1) break;
      // assign
      unvisited.delete(nearest);
      routeNodes.push(nearest);
      cap -= Number(demands[nearest] || 1);
      routeDist += nd;
      current = nearest;
    }
    // return to depot
    routeNodes.push(depot);
    routeDist += dist[current][depot] || 0;
    routes.push({ vehicle_id: v, nodes: routeNodes.slice(), distance: routeDist });
  }

  // If still unvisited remain, create additional routes (overflow)
  while (unvisited.size > 0) {
    const nodes = [depot];
    let cur = depot; let dsum = 0;
    const iter = unvisited.values().next();
    const pick = iter.value;
    if (pick === undefined) break;
    unvisited.delete(pick);
    nodes.push(pick);
    dsum += dist[cur][pick];
    cur = pick;
    nodes.push(depot);
    dsum += dist[cur][depot] || 0;
    routes.push({ vehicle_id: routes.length, nodes, distance: dsum });
  }

  const total_distance = routes.reduce((s,r)=> s + (r.distance||0), 0);
  // enrich nodes with coordinates
  for (const r of routes) {
    r.nodes = r.nodes.map(idx => ({ index: Number(idx), lat: locations[Number(idx)][0], lng: locations[Number(idx)][1] }));
  }
  return { routes, total_distance };
}

server.listen(5000, () => {
  console.log("Server running on port 5000");
});
