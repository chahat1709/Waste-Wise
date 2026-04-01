// Import the functions you need from the Firebase CDN (browser-compatible ES modules)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";

// Import Firebase Authentication SDKs from CDN
import {
    getAuth,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    setPersistence,
    browserLocalPersistence,
    onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

let firebaseConfig = {};
let app;
let analytics;
let auth;
let googleProvider;
let API_BASE = '';

// Function to fetch Firebase config and initialize Firebase
async function initializeFirebase() {
  try {
        // detect API base (same-origin when Node serves frontend, otherwise fallback to localhost:5000)
        try {
            if (!API_BASE) {
                // if opened from file://, use localhost
                if (window.location && window.location.protocol === 'file:') {
                    API_BASE = 'http://localhost:5000';
                } else {
                    const candidate = window.location.origin;
                    const ctrl = new AbortController();
                    const id = setTimeout(() => ctrl.abort(), 1200);
                    try {
                        const probe = await fetch(candidate + '/health', { signal: ctrl.signal });
                        clearTimeout(id);
                        // If the origin answers with a successful health check, use it;
                        // otherwise fall back to the local backend on port 5000.
                        if (probe && probe.ok) {
                            API_BASE = candidate;
                        } else {
                            API_BASE = 'http://localhost:5000';
                        }
                    } catch (e) {
                        API_BASE = 'http://localhost:5000';
                    }
                }
            }
        } catch (e) {
            API_BASE = 'http://localhost:5000';
        }

        const response = await fetch(`${API_BASE}/api/config`);
    if (!response.ok) {
      throw new Error('Failed to fetch Firebase configuration');
    }
    const config = await response.json();
    firebaseConfig = config.firebaseConfig;

    // Initialize Firebase
        app = initializeApp(firebaseConfig);
        analytics = getAnalytics(app);
        auth = getAuth(app);
        // Prefer local persistence so users stay signed in across sessions
        try {
                await setPersistence(auth, browserLocalPersistence);
        } catch (e) {
                console.warn('Failed to set local persistence for Firebase Auth', e);
        }
        googleProvider = new GoogleAuthProvider();
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    // Handle the error appropriately, e.g., show a message to the user
  }
}

// Call the function to initialize Firebase and expose a promise we can await
const initPromise = initializeFirebase();

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
        // Ensure elements exist before trying to access properties
        if (!messageBox || !overlay || !messageBoxTitle || !messageBoxContent || !messageBoxConfirmBtn || !messageBoxCancelBtn) {
            console.error("❌ Message box HTML elements not found. Please ensure the modal HTML is included in your page.");
            // Fallback to console.log if modal elements are missing (no alert allowed)
            console.warn(`[Fallback Message] ${title}: ${content}`);
            resolve(isConfirm ? false : true); // Assume cancellation for confirm if modal isn't there
            return;
        }

        messageBoxTitle.textContent = title;
        messageBoxContent.textContent = content;

        messageBoxCancelBtn.classList.toggle("hidden", !isConfirm); // Hide/show Cancel button
        messageBoxConfirmBtn.textContent = isConfirm ? "Confirm" : "OK"; // Change text for OK button

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

        // Optional: Close modal on overlay click if it's not a confirmation
        if (!isConfirm) {
            overlay.addEventListener("click", handleConfirm, { once: true }); // Only once
        }
    });
}

// Send ID token to server to create HTTP-only session cookie
async function sendIdTokenToServer(idToken) {
    if (!idToken) throw new Error('idToken required');
    try {
        const resp = await fetch(`${API_BASE}/sessionLogin`, {
            method: 'POST',
            credentials: 'include', // important so cookie is set
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        });
        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`sessionLogin failed: ${resp.status} ${txt}`);
        }
        return await resp.json();
    } catch (e) {
        console.warn('sendIdTokenToServer error', e);
        throw e;
    }
}

// Sign-out helper: clears firebase auth, informs server to clear session cookie, and removes ww_uid
async function handleSignOut() {
    try {
        // Sign out from Firebase client
        if (auth) {
            try { await signOut(auth); } catch (e) { console.warn('Firebase signOut failed', e); }
        }
        // Ask server to clear HTTP-only cookie
        try {
            await fetch(`${API_BASE}/sessionLogout`, { method: 'GET', credentials: 'include' });
        } catch (e) { console.warn('sessionLogout request failed', e); }
        // Remove ww_uid cookie (client-visible) by setting expiry
        try { document.cookie = 'ww_uid=; max-age=0; path=/'; } catch (e) {}
        // Optionally redirect to login
        if (window.location && !window.location.pathname.endsWith('login.html')) {
            window.location.href = 'login.html';
        }
    } catch (e) {
        console.error('handleSignOut error', e);
        throw e;
    }
}


// Wait for the DOM to load before attaching event listeners
document.addEventListener("DOMContentLoaded", async () => {
    // Wait for Firebase initialization to finish (succeeds or fails)
    try {
        await initPromise;
    } catch (e) {
        console.warn('Firebase initialization failed or timed out:', e);
    }

    // Get the login form and the Google login button
    const loginForm = document.getElementById("login-form");
    const googleLoginBtn = document.getElementById("google-login");

    // Redirect to dashboard automatically if user is already signed-in
    try {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // user is signed in; set a small non-sensitive cookie for convenience
                try {
                    const maxAge = 7 * 24 * 60 * 60; // 7 days
                    document.cookie = `ww_uid=${user.uid}; max-age=${maxAge}; path=/`;
                } catch (e) { /* ignore */ }
                // Avoid redirecting if we're already on dashboard or the action is within an iframe
                if (window.location && !window.location.pathname.endsWith('dashboard.html')) {
                    window.location.href = 'dashboard.html';
                }
            }
        });
    } catch (e) {
        // onAuthStateChanged may fail if auth not initialized yet; ignore
    }

    // Disable login controls if Firebase auth isn't available
    if (googleLoginBtn && (!auth || !googleProvider)) {
        try { googleLoginBtn.disabled = true; } catch (e) {}
        googleLoginBtn.title = 'Authentication not initialized. Please wait or start the backend server.';
    }

    // Check that the login form exists
    if (loginForm) {
        // If auth not ready, disable submit until it's ready
        const submitBtn = loginForm.querySelector('[type=submit]');
        if ((!auth) && submitBtn) {
            try { submitBtn.disabled = true; } catch (e) {}
        }
        // Login with Email & Password
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const emailElem = document.getElementById("login-email");
            const passwordElem = document.getElementById("login-password");

            if (!emailElem || !passwordElem) {
                console.error("Email or Password input not found.");
                showMessageBox("Error", "Login form inputs are missing. Please check the page structure.", false);
                return;
            }

            const email = emailElem.value;
            const password = passwordElem.value;
            console.log("Attempting login with email:", email);
            try {
                // Ensure auth is initialized before using it
                if (!auth) {
                    console.error('Auth not initialized. Cannot sign in.');
                    await showMessageBox('Error', 'Authentication not initialized. Please make sure the backend is running and reload the page.', false);
                    return;
                }
                // Using signInWithEmailAndPassword from Firebase Auth
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                console.log("Login successful. User:", userCredential.user.email);
                // Exchange ID token with server to create HTTP-only session cookie
                try {
                    const idToken = await userCredential.user.getIdToken();
                    await sendIdTokenToServer(idToken);
                } catch (e) {
                    console.warn('Failed to create server session cookie', e);
                }
                await showMessageBox("Login Successful!", "You have successfully logged in.", false);
                window.location.href = "dashboard.html"; // Redirect to dashboard after login
            } catch (error) {
                console.error("Login Error:", error);
                let errorMessage = "An unknown error occurred during login.";
                switch (error.code) {
                    case 'auth/invalid-email':
                        errorMessage = "Invalid email format.";
                        break;
                    case 'auth/user-disabled':
                        errorMessage = "Your account has been disabled.";
                        break;
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        errorMessage = "Invalid email or password.";
                        break;
                    case 'auth/api-key-not-valid': // Explicitly catch this
                        errorMessage = "Firebase API key is not valid or restricted. Please check your Firebase console.";
                        break;
                    default:
                        errorMessage = error.message; // Use Firebase's error message as a fallback
                }
                showMessageBox("Login Failed", errorMessage, false);
            }
        });
    } else {
        console.error("Login form with ID 'login-form' not found on the page.");
    }

    // Check that the Google login button exists
    if (googleLoginBtn) {
        // Login with Google
        googleLoginBtn.addEventListener("click", async () => {
            try {
                // Ensure auth/provider are ready
                if (!auth || !googleProvider) {
                    console.error('Auth/provider not initialized. Cannot open Google popup.');
                    await showMessageBox('Error', 'Authentication not initialized. Please make sure the backend is running and reload the page.', false);
                    return;
                }
                // Using signInWithPopup from Firebase Auth
                const result = await signInWithPopup(auth, googleProvider);
                console.log("Google Login Successful. User:", result.user.email);
                await showMessageBox("Google Login Successful!", "You have successfully logged in with Google.", false);
                window.location.href = "dashboard.html"; // Redirect to dashboard after login
            } catch (error) {
                console.error("Google Login Error:", error);
                let errorMessage = "An unknown error occurred during Google login.";
                switch (error.code) {
                    case 'auth/popup-closed-by-user':
                        errorMessage = "Google login popup was closed.";
                        break;
                    case 'auth/cancelled-popup-request':
                        errorMessage = "Login attempt cancelled. Please try again.";
                        break;
                    case 'auth/api-key-not-valid': // Explicitly catch this
                        errorMessage = "Firebase API key is not valid or restricted. Please check your Firebase console.";
                        break;
                    default:
                        errorMessage = error.message || String(error);
                }
                showMessageBox("Google Login Failed", errorMessage, false);
            }
        });
    } else {
        console.error("Google login button with ID 'google-login' not found on the page.");
    }

    // Wire sign-out button if present (dashboard or other pages should include #signout-btn)
    const signoutBtn = document.getElementById('signout-btn');
    if (signoutBtn) {
        signoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await handleSignOut();
            } catch (err) {
                console.warn('Sign-out failed', err);
            }
        });
    }

    // Start the live clock in the login page
    try {
        startClock();
    } catch (e) {
        // ignore if element not present
    }
});

// Live clock helper: updates #clock every second
function startClock() {
    const el = document.getElementById('clock');
    if (!el) return;
    function pad(n){return n.toString().padStart(2,'0');}
    function tick(){
        const now = new Date();
        const hh = pad(now.getHours());
        const mm = pad(now.getMinutes());
        const ss = pad(now.getSeconds());
        // show local time and small date below
        el.textContent = `${hh}:${mm}:${ss}`;
        el.title = now.toLocaleString();
    }
    tick();
    setInterval(tick, 1000);
}

// ----------------------
// Interactive bins: cursor-follow and rock-paper-scissors play
// ----------------------
(() => {
    const large = document.getElementById('bin-large');
    const med = document.getElementById('bin-medium');
    if (!large || !med) return;

    const bins = [ {el: large, speed: 0.12, offsetX: 40}, {el: med, speed: 0.08, offsetX: -40} ];
    let pointer = {x: window.innerWidth/2, y: window.innerHeight/2};
    let rafId = null;

    // Lerp helper
    function lerp(a,b,t){return a + (b-a)*t}

    // Smooth follow loop
    function frame(){
        for (const b of bins){
            const rect = b.el.getBoundingClientRect();
            // target positions relative to center stage
            const stageX = (pointer.x - window.innerWidth/2) * 0.08 + b.offsetX;
            const stageY = Math.max(-12, (pointer.y - (window.innerHeight*0.6)) * 0.02);
            const cur = b.el._tx || 0;
            const curY = b.el._ty || 0;
            const nextX = lerp(cur, stageX, b.speed);
            const nextY = lerp(curY, stageY, b.speed);
            b.el._tx = nextX; b.el._ty = nextY;
            b.el.style.transform = `translate(${nextX}px, ${nextY}px)`;
        }
        rafId = requestAnimationFrame(frame);
    }

    // start RAF
    frame();

    // update pointer from mouse/touch
    function updatePointer(e){
        if (e.touches && e.touches[0]){
            pointer.x = e.touches[0].clientX; pointer.y = e.touches[0].clientY;
        } else {
            pointer.x = e.clientX; pointer.y = e.clientY;
        }
    }
    window.addEventListener('pointermove', updatePointer, {passive:true});
    window.addEventListener('touchmove', updatePointer, {passive:true});

    // Rock-Paper-Scissors logic
    const choices = ['rock','paper','scissors'];
    function makeIcon(choice){
        const wrapper = document.createElement('div');
        wrapper.className = `rps-${choice}`;
        wrapper.innerHTML = choice === 'rock' ? '✊' : choice === 'paper' ? '✋' : '✌️';
        return wrapper;
    }

    function playRPS(binEl){
        // now make both bins play against each other and talk
        const otherId = (binEl.id === 'bin-large') ? 'bin-medium' : 'bin-large';
        const a = binEl;
        const b = document.getElementById(otherId);
        if (!a || !b) return;

        // helper to show speech
        function say(el, text, speak=false){
            try {
                const sp = el.querySelector('.speech');
                if (sp){ sp.querySelector('.speech-text').textContent = text; el.classList.add('talking'); }
                if (speak && 'speechSynthesis' in window){
                    const ut = new SpeechSynthesisUtterance(text);
                    ut.rate = 1.05; ut.pitch = 0.8;
                    window.speechSynthesis.cancel(); window.speechSynthesis.speak(ut);
                }
            } catch (e){}
        }

        // clear speech
        function hush(el){ if (!el) return; el.classList.remove('talking'); const sp = el.querySelector('.speech'); if (sp) sp.querySelector('.speech-text').textContent=''; }

        // show cycling overlays for both
        a.classList.add('show-rps'); b.classList.add('show-rps');
        const overA = a.querySelector('.rps-overlay'); const overB = b.querySelector('.rps-overlay');
        let idx = 0; const cycles = 9; const interval = setInterval(()=>{
            const pickA = choices[idx % choices.length]; const pickB = choices[(idx+1) % choices.length];
            overA.innerHTML = ''; overB.innerHTML = '';
            overA.appendChild(makeIcon(pickA)); overB.appendChild(makeIcon(pickB));
            idx++;
        }, 140);

        // talk lines
        say(a, 'Hey! Ready to play?', true);
        setTimeout(()=> say(b, 'Bring it on, tiny bin!', true), 700);

        // finish cycles and compute result
        setTimeout(()=>{
            clearInterval(interval);
            const pickA = choices[Math.floor(Math.random()*choices.length)];
            const pickB = choices[Math.floor(Math.random()*choices.length)];
            overA.innerHTML = ''; overB.innerHTML = '';
            overA.appendChild(makeIcon(pickA)); overB.appendChild(makeIcon(pickB));

            // determine winner
            const result = (x,y)=>{ if (x===y) return 'draw'; if ((x==='rock'&&y==='scissors')||(x==='paper'&&y==='rock')||(x==='scissors'&&y==='paper')) return 'a'; return 'b'; };
            const r = result(pickA,pickB);
            if (r==='draw'){
                say(a,'Oh snap — a draw!'); say(b,'Tie! Rematch?');
                a.classList.remove('win','lose'); b.classList.remove('win','lose');
            } else if (r==='a'){
                say(a,'Ha! I win!'); say(b,'Noooo!');
                a.classList.add('win'); b.classList.add('lose');
            } else {
                say(b,'Victory is mine!'); say(a,'You got lucky...');
                b.classList.add('win'); a.classList.add('lose');
            }

            // cleanup visuals after short delay
            setTimeout(()=>{
                a.classList.remove('show-rps'); b.classList.remove('show-rps');
                hush(a); hush(b);
                a.classList.remove('win','lose'); b.classList.remove('win','lose');
                overA.innerHTML = ''; overB.innerHTML = '';
            }, 1600);
        }, cycles * 140 + 400);
    }

    // pointerdown on bin to play
    function onPointerDown(e){
        const target = e.target.closest && e.target.closest('.bin');
        if (target){
            playRPS(target);
        } else {
            // if clicked elsewhere: give a small nudge to bins toward pointer
            updatePointer(e);
            for (const b of bins){ b.el.style.transform = `translate(${(pointer.x - window.innerWidth/2)*0.06 + b.offsetX}px, ${(pointer.y - (window.innerHeight*0.6))*0.03}px)`; }
        }
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('touchstart', onPointerDown);

    // cleanup: use pagehide/visibilitychange instead of unload (unload may be restricted)
    function cleanupAll(){
        try { if (rafId) cancelAnimationFrame(rafId); } catch (e) {}
        try { window.removeEventListener('pointermove', updatePointer); } catch (e) {}
        try { window.removeEventListener('pointerdown', onPointerDown); } catch (e) {}
    }
    // pagehide fires when navigating away / unloading in modern browsers and respects policies
    window.addEventListener('pagehide', cleanupAll, { passive: true });
    // fallback: when visibility changes to hidden, also cleanup (covers some mobile browsers)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') cleanupAll(); }, { passive: true });
})();