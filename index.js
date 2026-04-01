// ✅ Firebase Authentication Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// ✅ Supabase Client Imports
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.3/+esm";

// Firebase Configuration - Direct config for Live Server
const firebaseConfig = {
    apiKey: "AIzaSyA21O-Ap2T4SFXVUZBz_nUsQ5gv00f-TJY",
    authDomain: "waste-wise-78541.firebaseapp.com",
    projectId: "waste-wise-78541",
    storageBucket: "waste-wise-78541.appspot.com",
    messagingSenderId: "366633893436",
    appId: "1:366633893436:web:86f84ded105c403e0a0d39",
    measurementId: "G-EXXS4696Q6"
};

// Initialize Firebase directly for Live Server
let app;
let auth;
let googleProvider;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Error initializing Firebase:', error);
}

// ✅ Supabase Configuration (Keep this for when you access Supabase after login)
const SUPABASE_URL = "https://dwskiourizsqowlfjgiu.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3c2tpb3VyaXpzcW93bGZqZ2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0OTYyMjYsImV4cCI6MjA1OTA3MjIyNn0.xpSfb8RhWPSisPqZLUNQ0IN30M-riqPsYuxrsxUjqIM";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Function to display error messages using the custom message box.
// This function will use the page modal if available.
function displayErrorMessage(message) {
  if (typeof showMessageBox !== 'undefined') {
    showMessageBox("Error", message, false);
  } else {
    // Fallback to console if modal not available
    console.error(message);
    alert(message); // Simple fallback
  }
}

// Wait for DOM to load
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM loaded, initializing app...");

    // Role selection buttons
    const roleButtons = document.querySelectorAll(".role-btn");
    const roleSelection = document.getElementById("role-selection");
    const adminLogin = document.getElementById("admin-login");
    const backToRoles = document.getElementById("back-to-roles");
    const adminLoginForm = document.getElementById("admin-login-form");
    const errorMessage = document.getElementById("error-message");

    // Handle role selection
    roleButtons.forEach(button => {
        button.addEventListener("click", () => {
            const role = button.getAttribute("data-role");
            
            if (role === "admin") {
                // Show admin login form
                roleSelection.classList.add("hidden");
                adminLogin.classList.remove("hidden");
                console.log("Showing admin login");
            } else if (role === "driver") {
                // Redirect to driver login
                window.location.href = "login.html";
            }
        });
    });

    // Handle back to roles button
    if (backToRoles) {
        backToRoles.addEventListener("click", () => {
            adminLogin.classList.add("hidden");
            roleSelection.classList.remove("hidden");
            errorMessage.classList.add("hidden");
        });
    }

    // Handle admin login form submission
    if (adminLoginForm) {
        adminLoginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const email = document.getElementById("admin-email").value;
            const password = document.getElementById("admin-password").value;

            if (!auth) {
                displayErrorMessage("Firebase not initialized. Please refresh the page.");
                return;
            }

            try {
                console.log("Attempting admin login...");
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                console.log("Admin login successful:", user.email);
                
                // Store admin session
                localStorage.setItem('adminLoggedIn', 'true');
                localStorage.setItem('adminEmail', user.email);
                
                // Redirect to admin dashboard
                window.location.href = "admindashboard.html";
                
            } catch (error) {
                console.error("Admin login error:", error);
                errorMessage.textContent = "Invalid email or password!";
                errorMessage.classList.remove("hidden");
            }
        });
    }

    // Check if already logged in as admin
    if (localStorage.getItem('adminLoggedIn') === 'true') {
        console.log("Admin already logged in, redirecting...");
        window.location.href = "admindashboard.html";
    }
});

// Logout function
function logout() {
    if (auth) {
        signOut(auth).then(() => {
            localStorage.removeItem('adminLoggedIn');
            localStorage.removeItem('adminEmail');
            window.location.href = "index.html";
        }).catch((error) => {
            console.error("Logout error:", error);
            localStorage.removeItem('adminLoggedIn');
            localStorage.removeItem('adminEmail');
            window.location.href = "index.html";
        });
    } else {
        localStorage.removeItem('adminLoggedIn');
        localStorage.removeItem('adminEmail');
        window.location.href = "index.html";
    }
}

// Make logout available globally
window.logout = logout;