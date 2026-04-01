// Use server API (same-origin) instead of direct Supabase access from the browser.
// This avoids exposing DB keys and handles CORS/origin issues.
let API_BASE = '';

async function detectApiBase() {
    try {
        if (window.location && window.location.protocol === 'file:') return 'http://localhost:5000';
        const candidate = window.location.origin;
        const ctrl = new AbortController();
        const id = setTimeout(() => ctrl.abort(), 1200);
        try {
            const probe = await fetch(candidate + '/health', { signal: ctrl.signal });
            clearTimeout(id);
            if (probe && probe.ok) return candidate;
        } catch (e) {
            // ignore
        }
        return 'http://localhost:5000';
    } catch (e) {
        return 'http://localhost:5000';
    }
}

// ✅ Track Active Chart Instances for gauges
const charts = {};

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

// ✅ Function to Destroy an Existing Chart (Gauge)
function destroyChartIfExists(canvasId) {
  if (charts[canvasId]) {
    try {
      charts[canvasId].destroy();
      delete charts[canvasId];
      console.log(`✅ Destroyed chart on canvas: ${canvasId}`);
    } catch (error) {
      console.error(`❌ Error destroying chart on canvas: ${canvasId}`, error);
    }
  }
}

// ✅ Function to Create or Update a Gauge
function updateGauge(canvasId, value, label, min, max, colors) {
  const canvasElement = document.getElementById(canvasId);
  if (!canvasElement) {
    console.warn(`⚠️ Canvas element with ID "${canvasId}" not found for gauge.`);
    return;
  }

  const ctx = canvasElement.getContext("2d");
  if (!ctx) {
    console.error(`⚠️ Unable to get 2D context for canvas "${canvasId}".`);
    return;
  }

  destroyChartIfExists(canvasId); // Destroy existing chart instance

  // Determine the gauge color based on value thresholds
  const color =
    value <= min + (max - min) * 0.5
      ? colors[0]
      : value <= min + (max - min) * 0.8
      ? colors[1]
      : colors[2];

  charts[canvasId] = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: [label],
      datasets: [
        {
          data: [value, max - value],
          backgroundColor: [color, "#ddd"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      cutout: "75%",
      circumference: 180,
      rotation: -90,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      animation: {
        duration: 0 // Disable animation for instant updates
      }
    },
  });
}

// Ensure on-page socket status / last-update indicators exist
function ensureStatusElements() {
    let status = document.getElementById('socketStatus');
    let last = document.getElementById('lastUpdate');
    if (!status) {
        status = document.createElement('div');
        status.id = 'socketStatus';
        status.style.position = 'fixed';
        status.style.right = '12px';
        status.style.bottom = '12px';
        status.style.padding = '8px 10px';
        status.style.background = '#222';
        status.style.color = '#fff';
        status.style.borderRadius = '6px';
        status.style.fontSize = '12px';
        status.style.zIndex = 9999;
        status.textContent = 'Socket: disconnected';
        document.body.appendChild(status);
    }
    if (!last) {
        last = document.createElement('div');
        last.id = 'lastUpdate';
        last.style.position = 'fixed';
        last.style.right = '12px';
        last.style.bottom = '44px';
        last.style.padding = '6px 8px';
        last.style.background = '#fff';
        last.style.color = '#222';
        last.style.borderRadius = '6px';
        last.style.fontSize = '12px';
        last.style.zIndex = 9999;
        last.textContent = 'Last update: never';
        document.body.appendChild(last);
    }
    return { status, last };
}

// Fetch Live Data for a Specific Bin using server API and Socket.IO
async function fetchBinDataFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const binId = urlParams.get('binId');

    const currentBinIdSpan = document.getElementById("currentBinId");
    if (!binId) {
        if(currentBinIdSpan) currentBinIdSpan.textContent = "Error: Bin ID missing!";
        showMessageBox("Error", "Bin ID is missing from the URL. Please go back to the dashboard.", false);
        return;
    }
    if(currentBinIdSpan) currentBinIdSpan.textContent = binId;

    try {
        console.log(`Fetching data for Bin ID: ${binId}`);

        // Determine API base and initialize socket
        API_BASE = await detectApiBase();
        console.log('API_BASE resolved to', API_BASE);

        // Setup Socket.IO client and subscribe to bin updates
        if (typeof io === 'function') {
            try {
                const socket = io(API_BASE);
                socket.on('connect', () => {
                    console.log('Socket connected for bin status', socket.id);
                    // update status UI
                    try { const s = ensureStatusElements(); s.status.textContent = 'Socket: connected'; s.status.style.background = '#2e7d32'; } catch (e) {}
                    socket.emit('subscribeBin', binId);
                });
                socket.on('binData', (data) => {
                    if (!data) return;
                    if (data.id && data.id !== binId) return; // ignore other bins
                    console.log('binData via socket:', data);
                    applyBinDataToUI(data);
                    try { const s = ensureStatusElements(); s.last.textContent = 'Last update: ' + new Date().toLocaleString(); } catch (e) {}
                });
            } catch (err) {
                console.warn('Socket.IO client init failed', err);
            }
        }

        // Fetch initial data from server API
        try {
            const resp = await fetch(`${API_BASE}/bins/${encodeURIComponent(binId)}`);
            if (!resp.ok) {
                // For server errors, don't block the UI: rely on Socket.IO real-time updates.
                console.warn('Server returned', resp.status, 'for /bins/:id; will rely on realtime socket updates.');
            } else {
                const body = await resp.json().catch(() => null);
                const data = body ? (body.bin || body) : null;
                if (data) {
                    console.log('Initial bin data from API:', data);
                    applyBinDataToUI(data);
                } else {
                    console.warn(`No initial data found for bin ID "${binId}" from API; waiting for realtime updates.`);
                }
            }
        } catch (err) {
            console.warn('Fetch to /bins/:id failed, will rely on realtime socket updates.', err);
        }
    } catch (err) {
        console.error("❌ Error in fetchBinDataFromUrl function:", err);
        showMessageBox("Error", "An unexpected error occurred while loading bin data.", false);
    }
}

// Helper to apply bin data to UI and update gauges
function applyBinDataToUI(data) {
    try {
        console.log('applyBinDataToUI called with', data);
        document.getElementById("binLocation").textContent = data.location || (data.lat && data.lng ? `${data.lat}, ${data.lng}` : 'Unknown Location');
        document.getElementById("binFullness").textContent = data.fullness ?? "--";
        document.getElementById("binWeight").textContent = data.weight ?? "--";
        document.getElementById("binHumidity").textContent = data.humidity ?? "--";
        document.getElementById("binTemperature").textContent = data.temperature ?? "--";
        try {
            updateGauge("fullnessGauge", Number(data.fullness) || 0, "Fullness (%)", 0, 100, ["green", "orange", "red"]);
        } catch (eg) { console.error('fullness gauge update failed', eg); }
        try {
            updateGauge("weightGauge", Number(data.weight) || 0, "Weight (kg)", 0, 20, ["blue", "yellow", "red"]);
        } catch (eg) { console.error('weight gauge update failed', eg); }
        try {
            updateGauge("humidityGauge", Number(data.humidity) || 0, "Humidity (%)", 0, 100, ["cyan", "purple", "red"]);
        } catch (eg) { console.error('humidity gauge update failed', eg); }
        try {
            updateGauge("temperatureGauge", Number(data.temperature) || 0, "Temp (°C)", 0, 50, ["blue", "yellow", "red"]);
        } catch (eg) { console.error('temperature gauge update failed', eg); }
        try { const s = ensureStatusElements(); s.last.textContent = 'Last update: ' + new Date().toLocaleString(); } catch (e) {}
    } catch (e) {
        console.error('applyBinDataToUI failed', e);
    }
}

// Set up real-time updates using Supabase
async function setupRealtimeSubscription(binId) {
    // Deprecated: Supabase realtime subscription removed in favor of Socket.IO in fetchBinDataFromUrl()
    console.warn('setupRealtimeSubscription is deprecated; real-time handled via Socket.IO in this client.');
    return null;
}


// Main entry point
document.addEventListener("DOMContentLoaded", async () => {
    console.log("Bin Status Page initialized.");

    // Detect backend API and verify health before continuing
    API_BASE = await detectApiBase();
    try {
        const h = await fetch(`${API_BASE}/health`);
        if (!h.ok) {
            await showMessageBox("Error", `Backend not healthy (HTTP ${h.status}).`, false);
            return;
        }
    } catch (e) {
        console.error('Backend health check failed', e);
        await showMessageBox("Error", "Could not contact backend server. Please ensure the server is running.", false);
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const binId = urlParams.get('binId');

    if (binId) {
        try {
            await fetchBinDataFromUrl();
        } catch (error) {
            console.error('Error fetching bin data:', error);
            await showMessageBox("Error", "Failed to load bin data. Please try again.", false);
        }
    } else {
        await showMessageBox("Error", "No Bin ID found in URL. Redirecting to dashboard...", false);
        window.location.href = "dashboard.html";
    }

    // Back to Dashboard button
    const backButton = document.getElementById("backToDashboard");
    if (backButton) {
        backButton.addEventListener("click", () => {
            window.location.href = "dashboard.html";
        });
    } else {
        console.error("Back to Dashboard button not found.");
    }
});
