// ✅ Import Firebase Modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Your Firebase Config (consistent with index.js)
const firebaseConfig = {
  apiKey: "AIzaSyA21O-Ap2T4SFXVUZBz_nUsQ5gv00f-TJY",
  authDomain: "waste-wise-78541.firebaseapp.com",
  projectId: "waste-wise-78541",
  storageBucket: "waste-wise-78541.appspot.com",
  messagingSenderId: "366633893436",
  appId: "1:366633893436:web:86f84ded105c403e0a0d39",
  measurementId: "G-EXXS4696Q6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// NOTE: Supabase anon key was previously used in the client. For security,
// all DB queries should go through the server API endpoints (e.g. /bins,
// /nearby-bins). This client no longer creates a Supabase client.

// ✅ Custom Message Box / Modal Functions (consistent with other files)
const messageBox = document.getElementById("messageBox");
const overlay = document.getElementById("overlay");
const messageBoxTitle = document.getElementById("messageBoxTitle");
const messageBoxContent = document.getElementById("messageBoxContent");
const messageBoxConfirmBtn = document.getElementById("messageBoxConfirmBtn");
const messageBoxCancelBtn = document.getElementById("messageBoxCancelBtn");

/**
 * Displays a custom message box (modal).
 * @param {string} title - The title of the message box.
 * @param {string} content - The main message content.
 * @param {boolean} [isConfirm=false] - If true, displays OK and Cancel buttons. Otherwise, only OK.
 * @returns {Promise<boolean>} Resolves to true for OK, false for Cancel (if isConfirm is true).
 */
function showMessageBox(title, content, isConfirm = false) {
    return new Promise((resolve) => {
        if (!messageBox || !overlay || !messageBoxTitle || !messageBoxContent || !messageBoxConfirmBtn || !messageBoxCancelBtn) {
            console.error("❌ Message box HTML elements not found. Please ensure the modal HTML is included in your page.");
            // Fallback to console.log (no alert allowed)
            console.warn(`[Fallback Message] ${title}: ${content}`);
            resolve(isConfirm ? false : true); 
            return;
        }

        messageBoxTitle.textContent = title;
        messageBoxContent.textContent = content;

        messageBoxCancelBtn.classList.toggle("hidden", !isConfirm);
        messageBoxConfirmBtn.textContent = isConfirm ? "Confirm" : "OK";

        messageBox.classList.add("show");
        overlay.classList.add("show");

        const handleConfirm = () => {
            messageBox.classList.remove("show");
            overlay.classList.remove("show");
            messageBoxConfirmBtn.removeEventListener("click", handleConfirm);
            messageBoxCancelBtn.removeEventListener("click", handleCancel);
            resolve(true);
        };

        const handleCancel = () => {
            messageBox.classList.remove("show");
            overlay.classList.remove("show");
            messageBoxConfirmBtn.removeEventListener("click", handleConfirm);
            messageBoxCancelBtn.removeEventListener("click", handleCancel);
            resolve(false);
        };

        messageBoxConfirmBtn.addEventListener("click", handleConfirm);
        messageBoxCancelBtn.addEventListener("click", handleCancel);

        if (!isConfirm) {
            overlay.addEventListener("click", handleConfirm, { once: true });
        }
    });
}

// ✅ Helper Functions for getting elements and displaying status messages
function getElement(id) {
    return document.getElementById(id);
}

// Cookie helpers: set and get simple cookies
function setCookie(name, value, days) {
    let expires = "";
    if (typeof days === 'number') {
        const d = new Date();
        d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + d.toUTCString();
    }
    document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/";
}

function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
}

function showLoader(message = "Loading dashboard...") {
    const loader = getElement("loader");
    if (loader) {
        loader.textContent = message;
        loader.style.display = "block";
    }
}

function hideLoader() {
    const loader = getElement("loader");
    if (loader) {
        loader.style.display = "none";
        loader.textContent = "";
    }
}

function displayError(errorMsg) {
    const errorContainer = getElement("errorContainer");
    if (errorContainer) {
        errorContainer.textContent = "Error: " + errorMsg;
        errorContainer.style.display = "block";
    }
    console.error(errorMsg);
}

function hideError() {
    const errorContainer = getElement("errorContainer");
    if (errorContainer) {
        errorContainer.style.display = "none";
        errorContainer.textContent = "";
    }
}


/* ===========================================================================
   Load Bin List (Driver View)
   =========================================================================== */
async function loadBins() {
    showLoader("Loading bin data...");
    hideError();
    const binTableBody = getElement("binTableBody");
    const noBinMessage = getElement("noBinMessage");

    if (!binTableBody || !noBinMessage) {
        displayError("Critical: Bin table or no-bin message element not found.");
        hideLoader();
        return;
    }

    binTableBody.innerHTML = `<tr><td colspan="3">Fetching bins...</td></tr>`;
    noBinMessage.style.display = 'none';

    try {
    // Use server API to fetch bins so client does not need DB keys
    const resp = await fetch(`${API_BASE}/bins`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const body = await resp.json();
        const bins = Array.isArray(body) ? body : (body.bins || []);

        if (!bins || bins.length === 0) {
            binTableBody.innerHTML = `<tr><td colspan="3">No bins available in your area.</td></tr>`;
            noBinMessage.style.display = 'block';
        } else {
            noBinMessage.style.display = 'none';
            binTableBody.innerHTML = ""; // Clear existing rows
            bins.forEach((bin) => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${bin.id}</td>
                    <td>${bin.location || (bin.lat && bin.lng ? `${bin.lat}, ${bin.lng}` : 'N/A')}</td>
                    <td>${bin.fullness || 0}%</td>
                `;

                // Redirect to bin-status.html with bin ID on row click
                row.addEventListener("click", () => {
                    window.location.href = `binStatus.html?binId=${encodeURIComponent(bin.id)}`;
                });

                binTableBody.appendChild(row);
            });
        }
    } catch (err) {
        console.error('loadBins fetch error', err);
        displayError("Error loading bins: " + (err.message || err));
        binTableBody.innerHTML = `<tr><td colspan="3">Failed to load bins.</td></tr>`;
        try { showMessageBox('Bin Load Error', 'Failed to fetch bins from server. Check server is running and CORS/Network settings.', false); } catch (e) {}
    } finally {
        hideLoader();
        try{ updateBadges(); }catch(e){}
    }
}


/* ===========================================================================
   Firebase Authentication — DEMO MODE (login disabled for tasting)
   Set REQUIRE_AUTH=true to re-enable forced login.
   =========================================================================== */
const REQUIRE_AUTH = false; // <- login stopped — driver opens directly
let isAuthCheckComplete = false;
onAuthStateChanged(auth, async (user) => {
    hideLoader();
    const welcomeElem = getElement("welcomeMessage");
    if (!user) {
        if (REQUIRE_AUTH) {
            if (!isAuthCheckComplete) {
                await showMessageBox("Authentication Required", "Please log in to access the dashboard.", false);
                window.location.href = "login.html";
            } else {
                await showMessageBox("Session Expired", "Your session has expired. Please log in again.", false);
                window.location.href = "login.html";
            }
        } else {
            // Demo / tasting: allow guest driver without login
            if (welcomeElem) welcomeElem.textContent = `Driver · demo · driver-123`;
            // Ensure a demo driverId exists for socket & route fetch
            if (!localStorage.getItem('driverId')) localStorage.setItem('driverId','driver-123');
            if (!getCookie('driverId')) setCookie('driverId','driver-123',1);
            loadBins();
        }
    } else {
        if (welcomeElem) welcomeElem.textContent = `Welcome, ${user.email} (Driver)`;
        loadBins();
    }
    isAuthCheckComplete = true;
});

// ✅ Placeholder for Supabase Realtime Subscription (Future Implementation)
// function setupRealtimeSubscription() {
//     // Example: subscribe only to changes in bins relevant to this driver
//     // Requires driver's assigned bins or location filtering.
//     // supabase.channel('driver_bins_channel')
//     //     .on('postgres_changes', { event: '*', schema: 'public', table: 'bins', filter: 'driver_id=eq.' + userId }, payload => {
//     //             console.log('Realtime change for driver bin received!', payload);
//     //             loadBins(); // Reload relevant bins
//     //     })
//     //     .subscribe();
// }


/* ===========================================================================
   Logout Function — respects demo mode
   =========================================================================== */
async function logout() {
    const confirmed = await showMessageBox("Confirm Logout", "Are you sure you want to log out?", true);
    if (!confirmed) return;
    try { await signOut(auth); } catch (e) { console.warn('signOut ignored in demo', e.message); }
    console.log("✅ Logged out (demo mode keeps dashboard accessible).");
    if (REQUIRE_AUTH) {
        await showMessageBox("Logged Out", "You have been successfully logged out.", false);
        window.location.href = "login.html";
    } else {
        // In demo, just clear demo identity and stay on dashboard for tasting
        localStorage.removeItem('driverId'); setCookie('driverId','',-1);
        await showMessageBox("Demo Logout", "Demo identity cleared. You stay on driver — refresh to re-enter as driver-123.", false);
        localStorage.setItem('driverId','driver-123'); setCookie('driverId','driver-123',1);
        window.location.reload();
    }
}
// Make logout function globally accessible for onclick attribute in HTML
window.logout = logout; // Assign to window object so it can be called from HTML onclick
// Attach to logout button if present
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('logoutButton');
  if (btn) btn.addEventListener('click', logout);
});

/* ===========================================================================
   LLM Integration: Smart Route Optimization
   =========================================================================== */
// optimizeRoute removed — Smart Route is map-focused and shows either assigned route or nearby bins

/* ===========================================================================
   Smart Route Client Integration (Driver)
   - Fetch assigned route from server
   - Render on Leaflet map
   - Start/Stop route (periodic location pings)
   - Confirm collection for a bin (calls /route/:routeId/collect)
   =========================================================================== */

let routeState = {
    route: null,
    driverId: null,
    trackingIntervalId: null,
    map: null,
    polyline: null,
    roadLines: [],
    markers: [],
    driverMarker: null
};

// API base will be detected at runtime. We prefer same-origin when Node serves frontend.
let API_BASE = '';

// Try same-origin health; if it fails, fall back to localhost:5000
async function detectApiBase() {
    try {
        // If opened from file://, immediately use localhost:5000
        if (window.location && window.location.protocol === 'file:') {
            API_BASE = 'http://localhost:5000';
            return API_BASE;
        }

        const candidate = window.location.origin;
        const ctrl = new AbortController();
        const id = setTimeout(() => ctrl.abort(), 1500);
        try {
            const resp = await fetch(candidate + '/health', { signal: ctrl.signal });
            clearTimeout(id);
            if (resp.ok) {
                API_BASE = candidate;
                return API_BASE;
            }
        } catch (e) {
            // ignore and fallback
        }

        // Fallback to localhost:5000
        API_BASE = 'http://localhost:5000';
        return API_BASE;
    } catch (e) {
        API_BASE = 'http://localhost:5000';
        return API_BASE;
    }
}

// --- Socket.IO realtime client ---
let socket = null;
function initSocket() {
    if (socket) return socket;
    try {
        socket = io(API_BASE);
    } catch (e) {
        console.warn('Socket.IO init failed:', e);
        return null;
    }

    // Subscribe to driver room using stored driverId from cookie, fallback to localStorage or default
    const driverId = getCookie('driverId') || localStorage.getItem('driverId') || 'driver-123';
    socket.on('connect', () => {
        console.log('Socket connected', socket.id);
        socket.emit('subscribeDriver', driverId);
        socket.emit('subscribeRoutes');
    });

    socket.on('routeAssigned', async (payload) => {
        console.log('routeAssigned', payload);
        // Show a popup/toast and refresh assigned route
        await showMessageBox('New Route Assigned', 'A new route has been assigned to you. Open Smart Route to view details.', false);
        refreshAssignedRoute();
        addAlert(`New route assigned: ${payload.route && payload.route.id ? payload.route.id : 'unknown'}`);
    });

    socket.on('binCollected', (payload) => {
        console.log('binCollected', payload);
        addAlert(`Bin collected: ${payload.binId} by ${payload.driverId}`);
        refreshAssignedRoute();
    });

    socket.on('binUpdate', (payload) => {
        // optional: update bin list if visible
        console.log('binUpdate', payload);
        addAlert(`Bin update: ${payload.id} fullness ${payload.fullness}`);
        // reload bins if area-bin section is visible
        const areaVisible = document.getElementById('area-bin').style.display !== 'none';
        if (areaVisible) loadBins();
    });

    socket.on('driverLocation', (payload) => {
        // payload: { driverId, lat, lng }
        try {
            if (!payload) return;
            const currentDriverId = routeState.driverId || localStorage.getItem('driverId');
            if (payload.driverId && currentDriverId && payload.driverId !== currentDriverId) return; // ignore other drivers
            if (typeof payload.lat === 'number' && typeof payload.lng === 'number') {
                showDriverMarker(payload.lat, payload.lng);
            }
        } catch (e) {
            console.warn('driverLocation handler error', e);
        }
    });

    // alert: weighted fullness (heavy bin that needs driver attention)
    socket.on('weightedFullnessAlert', async (payload) => {
        try {
            console.log('weightedFullnessAlert', payload);
            const bin = payload.bin || payload;
            const txt = `Heavy bin alert: ${bin.id} is ${bin.fullness}% full and weight ${payload.weight}kg`;
            addAlert(txt);
            showMessageBox('Heavy Bin Alert', txt, false);
            tryShowNotification('Heavy Bin Alert', { body: txt });
        } catch (e) { console.warn('weightedFullnessAlert handler', e); }
    });

    // hazard alert: fire or chemical
    socket.on('hazardAlert', async (payload) => {
        try {
            console.log('hazardAlert', payload);
            const bin = payload.bin || payload;
            const txt = `Hazard detected at ${bin.id} (${payload.reason || 'unknown'}).`;
            addAlert(txt);
            await showMessageBox('Hazard Alert', txt, false);
            tryShowNotification('Hazard Alert', { body: txt });
        } catch (e) { console.warn('hazardAlert handler', e); }
    });

    // event-driven reroute suggestion (triggered when any bin crosses fullness threshold)
    socket.on('rerouteSuggestion', async (payload) => {
        try {
            console.log('rerouteSuggestion', payload);
            const bin = payload.bin || payload;
            const txt = `Reroute suggested: Bin ${bin.id} needs urgent collection (${payload.priority || 'medium'} priority).`;
            addAlert(txt);
            tryShowNotification('Reroute Suggestion', { body: txt });
            // Optionally auto-refresh smart route UI if visible
            const srVisible = document.getElementById('smart-route') && document.getElementById('smart-route').style.display !== 'none';
            if (srVisible) { try { await loadSmartRouteUI(); } catch(e){} }
        } catch (e) { console.warn('rerouteSuggestion handler', e); }
    });
    socket.on('fullnessAlert', async (payload) => {
        try {
            console.log('fullnessAlert', payload);
            const bin = payload.bin || payload;
            const txt = `Bin ${bin.id || bin.binId} is ${bin.fullness||''}% full - needs attention`;
            addAlert(txt);
            tryShowNotification('Bin Full Alert', { body: txt });
        } catch (e) { console.warn('fullnessAlert handler', e); }
    });

    return socket;
}

// Small helper to add alerts to Alerts section + update badges
function updateBadges() {
    try {
        const bc = document.getElementById('binCountBadge');
        const ac = document.getElementById('alertBadge');
        const top = document.getElementById('alertCountTop');
        const bins = document.querySelectorAll('#binTableBody tr').length;
        const alerts = document.querySelectorAll('#alertsList li').length;
        if (bc) bc.textContent = isNaN(bins) ? '—' : bins;
        if (ac) ac.textContent = alerts;
        if (top) top.textContent = alerts + ' alerts';
    } catch(e){}
}
function addAlert(text) {
    const alertsList = getElement('alertsList');
    const noAlerts = getElement('noAlertsMessage');
    if (!alertsList) return;
    const li = document.createElement('li');
    li.textContent = `${new Date().toLocaleTimeString()}: ${text}`;
    alertsList.insertBefore(li, alertsList.firstChild);
    if (noAlerts) noAlerts.style.display = 'none';
    updateBadges();
}

// Load historical alerts from server and populate alertsList
async function loadAlerts() {
    const list = getElement('alertsList');
    const noAlerts = getElement('noAlertsMessage');
    if (!list) return;
    try {
        const resp = await fetch(`${API_BASE}/alerts`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const body = await resp.json();
        const alerts = body.alerts || [];
        list.innerHTML = '';
        if (!alerts.length) {
            if (noAlerts) noAlerts.style.display = 'block';
            return;
        }
        alerts.forEach(a => {
            const li = document.createElement('li');
            li.textContent = `${new Date(a.createdAt || Date.now()).toLocaleString()}: ${a.type || 'alert'} - ${a.message || (a.bin && a.bin.id ? 'Bin ' + a.bin.id : '')}`;
            list.appendChild(li);
        });
        if (noAlerts) noAlerts.style.display = 'none';
        updateBadges();
    } catch (e) {
        console.warn('loadAlerts failed', e);
    }
}

// Test helper: fetch bins and show quick result (callable from console)
window.testFetchBins = async function() {
    try {
        console.log('Testing fetch to', API_BASE + '/bins');
        const resp = await fetch(`${API_BASE}/bins`);
        if (!resp.ok) {
            console.error('testFetchBins HTTP error', resp.status);
            await showMessageBox('Test Fetch Bins', `HTTP ${resp.status}`, false);
            return;
        }
        const body = await resp.json();
        console.log('testFetchBins result', body);
        await showMessageBox('Test Fetch Bins', `Success: ${Array.isArray(body.bins) ? body.bins.length + ' bins' : JSON.stringify(body)}`, false);
    } catch (e) {
        console.error('testFetchBins failed', e);
        try { await showMessageBox('Test Fetch Bins', 'Fetch failed: ' + (e.message || e), false); } catch (err) {}
    }
};

// Notification helpers
async function ensureNotificationPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
        const perm = await Notification.requestPermission();
        return perm === 'granted';
    } catch (e) {
        return false;
    }
}

async function tryShowNotification(title, options) {
    try {
        const ok = await ensureNotificationPermission();
        if (!ok) return;
        new Notification(title, options);
    } catch (e) {
        console.warn('Notification failed', e);
    }
}

async function fetchAssignedRoute(driverId) {
    try {
        const resp = await fetch(`${API_BASE}/driver/${encodeURIComponent(driverId)}/route`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const body = await resp.json();
        return body.route;
    } catch (err) {
        // Try to include server response body for debugging
        try {
            if (err && err.message && err.message.indexOf('HTTP 500') !== -1) {
                const text = await (await fetch(`${API_BASE}/driver/${encodeURIComponent(driverId)}/route`)).text();
                console.error('Server response for 500:', text);
            }
        } catch (e) {
            // ignore
        }
        console.error('Error fetching assigned route:', err);
        return null;
    }
}

function initRouteMap() {
    if (routeState.map) return routeState.map;
    const map = L.map('routeMap', { zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
    }).addTo(map);
    routeState.map = map;
    // Prefer cookie-stored driver location to avoid extra geolocation prompt
    const cookieLat = parseFloat(getCookie('driverLat'));
    const cookieLng = parseFloat(getCookie('driverLng'));
    if (!isNaN(cookieLat) && !isNaN(cookieLng)) {
        try { showDriverMarker(cookieLat, cookieLng); } catch (e) { console.warn('showDriverMarker cookie init failed', e); }
    } else {
        // fallback to browser geolocation (non-blocking)
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                try {
                    showDriverMarker(pos.coords.latitude, pos.coords.longitude);
                } catch (e) {
                    console.warn('showDriverMarker failed on init', e);
                }
            }, () => { /* ignore geolocation errors */ }, { enableHighAccuracy: true, maximumAge: 10000 });
        }
    }

    return map;
}

function clearRouteMap() {
    if (!routeState.map) return;
    routeState.markers.forEach(m => routeState.map.removeLayer(m));
    routeState.markers = [];
    if (routeState.polyline) {
        try { routeState.map.removeLayer(routeState.polyline); } catch(e){}
        routeState.polyline = null;
    }
    // also clear any road polylines stored as array
    if (routeState.roadLines) {
        routeState.roadLines.forEach(l=>{ try{ routeState.map.removeLayer(l);}catch(e){} });
        routeState.roadLines = [];
    }
    if (routeState.driverMarker) {
        try { routeState.map.removeLayer(routeState.driverMarker); } catch (e) {}
        routeState.driverMarker = null;
    }
}

// --- Road routing via OSRM (free, no key) ---
async function fetchRoadGeometry(points) {
    // points: [[lat,lng], ...]
    if (!points || points.length < 2) return null;
    try {
        const coordStr = points.map(p => `${p[1]},${p[0]}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`OSRM ${resp.status}`);
        const data = await resp.json();
        if (!data.routes || !data.routes[0] || !data.routes[0].geometry) throw new Error('no route');
        const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]); // to [lat,lng]
        const dist = Math.round(data.routes[0].distance); // meters road
        return { coords, distance: dist };
    } catch (e) {
        console.warn('OSRM route failed, fallback to straight', e.message);
        return null;
    }
}

function showDriverMarker(lat, lng) {
    if (!routeState.map) initRouteMap();
    try {
        const emoji = '🚚'; // driver emoji
        const div = L.divIcon({
            html: `<div style="font-size:24px;line-height:24px;">${emoji}</div>`,
            className: 'emoji-marker',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });
        if (routeState.driverMarker) {
            routeState.driverMarker.setLatLng([lat, lng]);
            routeState.driverMarker.setIcon(div);
        } else {
            routeState.driverMarker = L.marker([lat, lng], { title: 'You (Driver)', icon: div }).addTo(routeState.map);
        }
        // if there's no active route polyline, center map on driver
        if (!routeState.polyline) {
            routeState.map.setView([lat, lng], 14);
        }
    } catch (e) {
        console.warn('Error placing driver marker', e);
    }
}

async function fetchNearbyBins(lat, lng, radiusMeters = 3000) {
    try {
        // Call server endpoint which performs DB query (avoids exposing keys client-side)
        const resp = await fetch(`${API_BASE}/nearby-bins?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&r=${encodeURIComponent(radiusMeters)}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const body = await resp.json();
        const bins = Array.isArray(body) ? body : (body.bins || []);
        return bins;
    } catch (err) {
        console.error('fetchNearbyBins error', err);
        return [];
    }
}

async function showNearbyBinsOnMap(centerLat, centerLng) {
    try {
        const map = initRouteMap();
        clearRouteMap();
        showDriverMarker(centerLat, centerLng);

        const bins = await fetchNearbyBins(centerLat, centerLng, 5000);
        if (!bins || bins.length === 0) {
            addAlert('No nearby bins found within 5km.');
            return;
        }

        bins.forEach((b) => {
            if (!b || typeof b.lat !== 'number' || typeof b.lng !== 'number') return;
            let iconUrl = 'https://maps.gstatic.com/mapfiles/ms2/micons/green-dot.png';
            const temp = b.temperature ?? b.temp ?? null;
            const fullness = typeof b.fullness === 'number' ? b.fullness : (b.fullness ? Number(b.fullness) : null);
            const isTempHazard = temp !== null && Number(temp) >= 60; // 60°C threshold for fire/hazard
            const isStatusHazard = b.status && (b.status === 'on_fire' || b.status === 'hazard' || b.status === 'chemical');
            if (isTempHazard || isStatusHazard) {
                iconUrl = 'https://maps.gstatic.com/mapfiles/ms2/micons/red-dot.png';
                addAlert(`Hazard reported at bin ${b.id}`);
            } else if (fullness !== null && fullness >= 80) {
                iconUrl = 'https://maps.gstatic.com/mapfiles/ms2/micons/orange-dot.png';
                addAlert(`Bin ${b.id} is ${fullness}% full`);
            } else if (fullness !== null && fullness >= 50) {
                iconUrl = 'https://maps.gstatic.com/mapfiles/ms2/micons/yellow-dot.png';
            }

            // choose emoji for marker
            let emoji = '🗑️';
            if (isTempHazard || isStatusHazard) emoji = '🔥';
            else if (fullness !== null && fullness >= 80) emoji = '🛑';
            else if (fullness !== null && fullness >= 50) emoji = '⚠️';

            const div = L.divIcon({ html: `<div style="font-size:22px;line-height:22px;">${emoji}</div>`, className: 'emoji-marker', iconSize: [28,28], iconAnchor: [14,14] });
            const m = L.marker([b.lat, b.lng], { title: `Bin ${b.id} - ${fullness ?? 'N/A'}%`, icon: div }).addTo(map);
            const hazardEmoji = (isTempHazard || isStatusHazard) ? ' 🔥' : '';
            const popupContent = `<div><strong>Bin ${b.id}${hazardEmoji}</strong><br/>Fullness: ${fullness ?? 'N/A'}%<br/>Status: ${b.status ?? 'OK'}<br/>Temp: ${temp ?? 'N/A'}°C<br/><button data-bin="${b.id}" class="collectBtn">Confirm Collected</button></div>`;
            m.bindPopup(popupContent);
            routeState.markers.push(m);
        });

        const group = new L.featureGroup(routeState.markers.concat(routeState.driverMarker || []));
        if (group.getLayers().length > 0) {
            map.fitBounds(group.getBounds(), { padding: [40, 40] });
        }

        document.querySelectorAll('.collectBtn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const binId = e.target.dataset.bin;
                await confirmCollect(routeState.route ? routeState.route.id : 'no-route', binId);
            });
        });
    } catch (err) {
        console.error('showNearbyBinsOnMap error', err);
    }
}

// Load Smart Route UI: populate bins list and wire controls
async function loadSmartRouteUI() {
    try {
        const listEl = getElement('srBinsList');
        const summaryEl = getElement('srSummary');
        if (!listEl) return;
        listEl.innerHTML = '<div style="padding:12px;color:#666;">Loading nearby bins...</div>';

        // get center location
        let lat = parseFloat(getCookie('driverLat'));
        let lng = parseFloat(getCookie('driverLng'));
        if (isNaN(lat) || isNaN(lng)) {
            if (navigator.geolocation) {
                const pos = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true }));
                lat = pos.coords.latitude; lng = pos.coords.longitude;
            } else {
                listEl.innerHTML = '<div style="padding:12px;color:#c00;">Location unavailable.</div>';
                return;
            }
        }

        const bins = await fetchNearbyBins(lat, lng, 5000);
        // keep last fetched bins for later use
        window.srLastBins = bins;
        if (!bins || bins.length === 0) {
            listEl.innerHTML = '<div style="padding:12px;color:#666;">No nearby bins found.</div>';
            summaryEl.textContent = 'Selected: 0 bins · Estimated vehicles: 0';
            return;
        }

        listEl.innerHTML = '';
        bins.forEach((b, idx) => {
            const div = document.createElement('div');
            div.className = 'sr-bin-item';
            const idTxt = `<div><input type="checkbox" data-idx="${idx}" class="sr-bin-checkbox" /> <strong>Bin ${b.id || idx}</strong> <div class="meta">${(b.fullness!=null?('Fullness: '+b.fullness+'%'):'')} ${b.temperature?(' · T:'+b.temperature+'°C'):''}</div></div>`;
            const coordsTxt = `<div style="font-size:12px;color:#444">${Number(b.lat).toFixed(5)}, ${Number(b.lng).toFixed(5)}</div>`;
            div.innerHTML = idTxt + coordsTxt;
            listEl.appendChild(div);
        });

        // attach events
        document.querySelectorAll('.sr-bin-checkbox').forEach(cb => cb.addEventListener('change', updateSrSummary));

        // wire buttons
        getElement('srUseMyLocation').addEventListener('click', async () => {
            if (!navigator.geolocation) return;
            const pos = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true }));
            setCookie('driverLat', pos.coords.latitude, 1); setCookie('driverLng', pos.coords.longitude, 1);
            await loadSmartRouteUI();
        });

        getElement('computeSmartRouteBtn').addEventListener('click', computeSmartRoute);
        getElement('assignRouteBtn').addEventListener('click', assignComputedRoute);
        getElement('clearSelectionBtn').addEventListener('click', () => { document.querySelectorAll('.sr-bin-checkbox').forEach(cb => cb.checked = false); updateSrSummary(); });

        updateSrSummary();

        // helper to update summary
        function updateSrSummary() {
            const checked = Array.from(document.querySelectorAll('.sr-bin-checkbox')).filter(c => c.checked).length;
            const vehicles = parseInt(getElement('srVehicleCount').value || '1', 10);
            summaryEl.textContent = `Selected: ${checked} bins · Vehicles: ${vehicles}`;
        }

    } catch (err) {
        console.error('loadSmartRouteUI error', err);
    }
}

async function renderRouteOnMap(route) {
    const map = initRouteMap();
    clearRouteMap();
    if (!route || !route.bins) return;
    const points = [];
    if (route.startLocation) {
        points.push([route.startLocation.lat, route.startLocation.lng]);
        const startIcon = L.divIcon({ html: `<div style="font-size:20px;">📍</div>`, className: 'emoji-marker', iconSize: [24,24], iconAnchor: [12,12] });
        const m = L.marker([route.startLocation.lat, route.startLocation.lng], { title: 'Start', icon: startIcon }).addTo(map);
        routeState.markers.push(m);
    }
    route.bins.forEach((b, idx) => {
        points.push([b.lat, b.lng]);
        const temp = b.temperature ?? b.temp ?? null;
        const fullness = typeof b.fullness === 'number' ? b.fullness : (b.fullness ? Number(b.fullness) : null);
        const isHazard = (temp !== null && Number(temp) >= 60) || (b.status && (b.status === 'on_fire' || b.status === 'hazard' || b.status === 'chemical'));
        const hazardEmoji = isHazard ? ' 🔥' : '';
        let emoji = '🗑️';
        if (isHazard) emoji = '🔥';
        else if (fullness !== null && fullness >= 80) emoji = '🛑';
        else if (fullness !== null && fullness >= 50) emoji = '⚠️';
        const binIcon = L.divIcon({ html: `<div style="font-size:20px;">${emoji}</div>`, className: 'emoji-marker', iconSize: [24,24], iconAnchor: [12,12] });
        const m = L.marker([b.lat, b.lng], { title: `Bin ${b.id} - ${fullness ?? 'N/A'}%`, icon: binIcon }).addTo(map);
        m.bindPopup(`<div>Bin: ${b.id}${hazardEmoji}<br/>Fullness: ${fullness ?? 'N/A'}%<br/>Temp: ${temp ?? 'N/A'}°C<br/><button data-bin="${b.id}" class="collectBtn">Confirm Collected</button></div>`);
        routeState.markers.push(m);
    });
    if (route.dumpyard) {
        points.push([route.dumpyard.lat, route.dumpyard.lng]);
        const dumpIcon = L.divIcon({ html: `<div style="font-size:20px;">🏁</div>`, className: 'emoji-marker', iconSize: [24,24], iconAnchor: [12,12] });
        const m = L.marker([route.dumpyard.lat, route.dumpyard.lng], { title: 'Dumpyard', icon: dumpIcon }).addTo(map);
        routeState.markers.push(m);
    }
    if (points.length > 0) {
        // Try road-following geometry via OSRM (true road KM)
        const road = await fetchRoadGeometry(points);
        if (road && road.coords && road.coords.length > 1) {
            // draw road line (bold ink) + faint shadow
            const shadow = L.polyline(road.coords, { color: '#ffffff', weight: 8, opacity: 0.9 }).addTo(map);
            const line = L.polyline(road.coords, { color: '#0f1110', weight: 4, opacity: 0.95 }).addTo(map);
            routeState.roadLines = [shadow, line];
            routeState.polyline = line;
            // update header with true road distance
            const meta = document.getElementById('routeResult');
            if (meta) {
                const km = (road.distance/1000).toFixed(1);
                meta.textContent = `${route.bins.length} stops · ${km} km road · ${route.status}`;
                meta.title = `Road distance ${km} km via OSRM (was ${route.distance? (route.distance/1000).toFixed(1)+' km straight':''})`;
            }
            // update details card distance if present
            const details = document.getElementById('routeDetailsContent');
            if (details && route.bins) {
                // patch the KM display inside details card without full re-render
                setTimeout(()=> renderRouteDetails({...route, distance: road.distance}), 100);
            }
            map.fitBounds(line.getBounds(), { padding: [40,40] });
        } else {
            // fallback straight line (Haversine)
            routeState.polyline = L.polyline(points, { color: '#0f1110', weight: 3, opacity: 0.6, dashArray: '6 6' }).addTo(map);
            map.fitBounds(routeState.polyline.getBounds(), { padding: [40,40] });
        }
    }
    // Attach click handler to collect buttons inside popups
    document.querySelectorAll('.collectBtn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const binId = e.target.dataset.bin;
            await confirmCollect(route.id, binId);
        });
    });
}

async function confirmCollect(routeId, binId) {
    try {
        const driverId = routeState.driverId || 'driver-unknown';
        const payload = { binId, driverId, timestamp: new Date().toISOString() };
    const resp = await fetch(`${API_BASE}/route/${encodeURIComponent(routeId)}/collect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const body = await resp.json();
        await showMessageBox('Collected', `Bin ${binId} marked as collected.`, false);
        // Refresh route state
        await refreshAssignedRoute();
    } catch (err) {
        console.error('Confirm collect error:', err);
        showMessageBox('Error', 'Failed to confirm collection. Try again.', false);
    }
}

function renderRouteDetails(route) {
    const card = getElement('routeDetailsCard');
    const content = getElement('routeDetailsContent');
    const idLabel = getElement('routeIdLabel');
    const nextBtn = getElement('navNextBtn');
    const collectBtn = getElement('markCollectedBtn');
    if (!card || !content) return;
    if (!route || !route.bins) { card.style.display='none'; return; }
    const stops = route.bins.length;
    const collected = (route.collectedBins && route.collectedBins.length) || 0;
    const remaining = stops - collected;
    const progress = stops ? Math.round((collected/stops)*100) : 0;
    const distKm = route.distance ? (route.distance/1000).toFixed(1) : (route.bins.reduce((a,b)=>a+1,0)*0.6).toFixed(1);
    // find next uncollected bin
    let nextBin = null;
    if (route.bins) {
        const collectedIds = new Set((route.collectedBins||[]).map(c=>c.binId));
        nextBin = route.bins.find(b=>!collectedIds.has(b.id)) || route.bins[0];
    }
    if (idLabel) idLabel.textContent = route.id ? `· ${route.id.slice(0,8)}` : '';
    content.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:10px">
        <div><div style="color:#888">STOPS</div><b>${stops}</b></div>
        <div><div style="color:#888">REMAINING</div><b>${remaining}</b></div>
        <div><div style="color:#888">DISTANCE</div><b>${distKm} km</b></div>
      </div>
      <div style="background:#f0f0eb; border-radius:8px; height:8px; overflow:hidden; margin-bottom:10px"><div style="width:${progress}%; height:100%; background:var(--acid); border:1px solid var(--ink)"></div></div>
      <div style="color:#444">${collected}/${stops} collected · ${progress}%</div>
      ${nextBin ? `<div style="margin-top:10px; padding:10px; background:#fbfbf8; border:1px solid #ecebe6; border-radius:8px">NEXT: <b>${nextBin.id}</b> · ${nextBin.location || nextBin.lat.toFixed(4)+','+nextBin.lng.toFixed(4)} · ${nextBin.fullness!=null?nextBin.fullness+'%':''} <a href="https://www.google.com/maps/dir/?api=1&destination=${nextBin.lat},${nextBin.lng}" target="_blank" style="margin-left:8px; color:var(--ink); text-decoration:underline">Navigate ↗</a></div>` : ''}
    `;
    card.style.display='block';
    if (nextBtn && nextBin) {
        nextBtn.style.display='inline-flex';
        nextBtn.onclick = ()=> window.open(`https://www.google.com/maps/dir/?api=1&destination=${nextBin.lat},${nextBin.lng}`,'_blank');
    }
    if (collectBtn && nextBin) {
        collectBtn.style.display='inline-flex';
        collectBtn.onclick = ()=> confirmCollect(route.id, nextBin.id);
    }
}
async function refreshAssignedRoute() {
    const driverId = routeState.driverId || localStorage.getItem('driverId') || 'driver-123';
    const route = await fetchAssignedRoute(driverId);
    routeState.route = route;
    const routeResult = getElement('routeResult');
    const card = getElement('routeDetailsCard');
    if (!route) {
        if (routeResult) routeResult.textContent = 'No assigned route — showing nearby bins';
        if (card) card.style.display='none';
        try {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(async (pos) => {
                    await showNearbyBinsOnMap(pos.coords.latitude, pos.coords.longitude);
                }, async () => { clearRouteMap(); }, { enableHighAccuracy: true });
            } else { clearRouteMap(); }
        } catch (e) { clearRouteMap(); }
        return;
    }
    if (routeResult) {
        const km = route.distance ? (route.distance/1000).toFixed(1) : '?';
        routeResult.textContent = `${route.bins.length} stops · ${km} km · ${route.status}`;
    }
    renderRouteDetails(route);
    renderRouteOnMap(route);
}

async function startRouteTracking() {
    const driverId = routeState.driverId || localStorage.getItem('driverId') || 'driver-123';
    routeState.driverId = driverId;
    if (routeState.trackingIntervalId) return; // already started

    // Send location every 8 seconds
    routeState.trackingIntervalId = setInterval(async () => {
        try {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                // update local map marker for driver
                try { showDriverMarker(lat, lng); } catch (e) {}
                // store last known location in cookie for map usage without API
                try { setCookie('driverLat', lat, 1); setCookie('driverLng', lng, 1); } catch (e) {}
                await fetch(`${API_BASE}/driver/${encodeURIComponent(driverId)}/location`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat, lng, bearing: pos.coords.heading }) });
            });
        } catch (err) {
            console.error('Error sending location ping:', err);
        }
    }, 8000);
}

function stopRouteTracking() {
    if (routeState.trackingIntervalId) {
        clearInterval(routeState.trackingIntervalId);
        routeState.trackingIntervalId = null;
    }
    try { getElement('startRouteBtn').style.display = 'inline-block'; } catch (e) {}
    try { getElement('stopRouteBtn').style.display = 'none'; } catch (e) {}
}
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'startRouteBtn') {
        startRouteTracking();
    }
    if (e.target && e.target.id === 'stopRouteBtn') {
        stopRouteTracking();
    }
    if (e.target && e.target.id === 'refreshRouteBtn') {
        refreshAssignedRoute();
    }
    if (e.target && e.target.id === 'computeRouteBtn') {
        computeSmartRoute();
    }
});

// Compute Smart Route using backend CVRP solver
async function computeSmartRoute() {
    try {
        const routeResult = getElement('routeResult');
        routeResult.textContent = 'Computing optimized route...';
        let lat = null, lng = null;
        // prefer last known cookie location
        const cookieLat = parseFloat(getCookie('driverLat'));
        const cookieLng = parseFloat(getCookie('driverLng'));
        if (!isNaN(cookieLat) && !isNaN(cookieLng)) {
            lat = cookieLat; lng = cookieLng;
        } else if (navigator.geolocation) {
            const pos = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true }));
            lat = pos.coords.latitude; lng = pos.coords.longitude;
        } else {
            routeResult.textContent = 'Driver location unavailable.';
            return;
        }

        // If user has the bin list loaded, prefer selected bins; otherwise fetch nearby
        let bins = window.srLastBins || [];
        const checkboxes = Array.from(document.querySelectorAll('.sr-bin-checkbox'));
        let selectedBins = [];
        if (checkboxes && checkboxes.length > 0) {
            const checked = checkboxes.filter(c => c.checked).map(c => parseInt(c.dataset.idx, 10));
            if (checked.length > 0) {
                selectedBins = checked.map(i => (window.srLastBins && window.srLastBins[i]) ? window.srLastBins[i] : null).filter(Boolean);
            }
        }
        if (selectedBins.length === 0) {
            if (!bins || bins.length === 0) {
                bins = await fetchNearbyBins(lat, lng, 5000);
                window.srLastBins = bins;
            }
            selectedBins = bins.slice(0, 20); // limit to 20 to keep problem small
        }

        if (!selectedBins || selectedBins.length === 0) {
            routeResult.textContent = 'No bins selected or found for optimization.';
            return;
        }

        if (!selectedBins || selectedBins.length === 0) {
            routeResult.textContent = 'No bins selected or found for optimization.';
            return;
        }

        // Persist selection and depot so assignment can map solver indices back to bins
        window.srSelectedBins = selectedBins;
        window.srDepotLocation = { lat, lng };

        // Build CVRP payload: first node is depot (driver start)
        const locations = [{ lat, lng }];
        const demands = [0];
        const binMap = {};
        selectedBins.forEach((b, i) => {
            locations.push({ lat: b.lat, lng: b.lng });
            const d = (typeof b.fullness === 'number') ? Math.max(1, Math.round(b.fullness / 50)) : 1;
            demands.push(d);
            binMap[i + 1] = b;
        });
        // Save mapping from solver node index -> bin object for later assignment
        window.srBinMap = binMap;

        const vehicleCount = Math.max(1, parseInt(getElement('srVehicleCount').value || '2', 10));
        const vehicleCap = Math.max(1, parseInt(getElement('srVehicleCap').value || '10', 10));
        const caps = Array.from({ length: vehicleCount }).map(() => vehicleCap);
        const payload = { locations, demands, vehicle_capacities: caps, num_vehicles: vehicleCount, depot: 0 };
        const resp = await fetch(`${API_BASE}/api/cvrp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const body = await resp.json();
        if (body.error) {
            routeResult.textContent = 'Solver error: ' + body.error;
            return;
        }

        // Store computed routes for assign action and pick first route for display
        if (!body.routes || body.routes.length === 0) {
            routeResult.textContent = 'No routes returned by solver.';
            return;
        }
        window.srComputed = body.routes || [];
        // Build a route object compatible with renderRouteOnMap
        const first = window.srComputed[0];
        const routeObj = { id: 'cvrp-0', bins: [], startLocation: { lat, lng }, dumpyard: null };
        for (const node of first.nodes) {
            // node may be {index, lat, lng} or raw index
            const idx = (typeof node === 'object' && node.index !== undefined) ? node.index : node;
            if (idx === 0) continue; // skip depot
            const b = binMap[idx];
            if (b) routeObj.bins.push({ id: b.id || `bin-${idx}`, lat: b.lat, lng: b.lng, fullness: b.fullness });
        }

        routeResult.textContent = JSON.stringify(first, null, 2);
        renderRouteOnMap(routeObj);
    } catch (err) {
        console.error('computeSmartRoute error', err);
        try { getElement('routeResult').textContent = 'Compute error: ' + (err.message || err); } catch (e) {}
    }
}

// Assign the last computed route(s) to a driver and persist via /assign-route
async function assignComputedRoute() {
    try {
        if (!window.srComputed || window.srComputed.length === 0) {
            await showMessageBox('No route', 'Please compute a route first.', false);
            return;
        }
        const driverId = routeState.driverId || localStorage.getItem('driverId') || 'driver-123';
        const created = [];
        for (let i = 0; i < window.srComputed.length; i++) {
            const r = window.srComputed[i];
            // Build bins list: map solver node indices back to the same selected bins
            const bins = [];
            const binMap = window.srBinMap || {};
            for (const node of r.nodes) {
                const idx = (typeof node === 'object' && node.index !== undefined) ? node.index : node;
                if (idx === 0) continue; // depot
                const b = binMap[idx] || (window.srSelectedBins && window.srSelectedBins[idx - 1] ? window.srSelectedBins[idx - 1] : null);
                if (b) bins.push({ id: b.id || (`bin-${idx}`), lat: b.lat, lng: b.lng });
            }
            const depot = window.srDepotLocation || { lat: parseFloat(getCookie('driverLat')||0), lng: parseFloat(getCookie('driverLng')||0) };
            const payload = { driverId, bins, startLocation: depot, dumpyard: null };
            const resp = await fetch(`${API_BASE}/assign-route`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!resp.ok) throw new Error(`Assign failed HTTP ${resp.status}`);
            const body = await resp.json();
            created.push(body.route || body);
        }
        await showMessageBox('Assigned', `Assigned ${created.length} route(s) to driver.`, false);
        // refresh assigned route view
        refreshAssignedRoute();
    } catch (err) {
        console.error('assignComputedRoute error', err);
        await showMessageBox('Assign Error', 'Failed to assign routes: ' + (err.message || err), false);
    }
}

// When Smart Route section becomes visible, auto-refresh assigned route
const smartRouteNav = document.querySelector('a[data-section="smart-route"]');
if (smartRouteNav) {
    smartRouteNav.addEventListener('click', () => {
        setTimeout(() => { refreshAssignedRoute(); loadSmartRouteUI(); }, 300); // allow section to render
    });
}


/* ===========================================================================
   DOM Ready - Event Listeners & Initial Setup
   =========================================================================== */
document.addEventListener("DOMContentLoaded", async () => {
    console.log("Driver Dashboard initialized.");
    showLoader("Checking authentication..."); // Show loader on page load

    // Detect API base (same-origin vs localhost) before initializing features
    try {
        await detectApiBase();
        console.log('API_BASE set to', API_BASE);
    } catch (e) {
        console.warn('detectApiBase failed, using fallback', e);
        API_BASE = API_BASE || 'http://localhost:5000';
    }

    // Initialize Socket.IO connection for realtime alerts
    try {
        initSocket();
    } catch (e) {
        console.warn('Failed to init socket at DOMContentLoaded:', e);
    }

    // Load historical alerts to populate Alerts section
    try { await loadAlerts(); } catch (e) { /* ignore */ }

    // Route tab is visible by default (map is home) — so load its data on boot,
    // not only after a tab click. Without this a fresh load never fetches the
    // assigned route and #routeDetailsCard stays hidden forever.
    try { await refreshAssignedRoute(); } catch (e) { /* ignore */ }
    try { await loadSmartRouteUI(); } catch (e) { /* ignore */ }

    // Section Switching Logic — supports both legacy .nav-links and new .tab sheet
    const sections = document.querySelectorAll(".sheet .section");
    const legacyNavLinks = document.querySelectorAll(".nav-links a");
    const tabLinks = document.querySelectorAll(".tab[data-section]");
    const allLinks = [...legacyNavLinks, ...tabLinks];
    function activateTab(sectionId, clickedEl) {
        sections.forEach(section => section.style.display = "none");
        const targetSection = document.getElementById(sectionId);
        if (targetSection) targetSection.style.display = "block";
        if (clickedEl && clickedEl.classList.contains('tab')) {
            document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
            clickedEl.classList.add('active');
            // keep map visible - ensure map invalidates size after tab switch
            setTimeout(()=>{ if(routeState.map) routeState.map.invalidateSize(); }, 150);
        }
        if (sectionId === "area-bin") loadBins();
        if (sectionId === "alerts") loadAlerts();
        if (sectionId === "smart-route") { refreshAssignedRoute(); loadSmartRouteUI(); }
    }
    allLinks.forEach(link => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            const sectionId = link.getAttribute("data-section");
            activateTab(sectionId, link);
        });
    });

    // Smart Route controls are handled elsewhere (start/stop/refresh bindings)

});
