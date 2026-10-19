// ✅ Self-contained Firebase init (single SDK version, no cross-file import —
// forgot-password.html loads only this module, so it must not depend on
// firebase-Config.js which would double-initialize the app).
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyA21O-Ap2T4SFXVUZBz_nUsQ5gv00f-TJY",
    authDomain: "waste-wise-78541.firebaseapp.com",
    projectId: "waste-wise-78541",
    storageBucket: "waste-wise-78541.appspot.com",
    messagingSenderId: "366633893436",
    appId: "1:366633893436:web:86f84ded105c403e0a0d39",
    measurementId: "G-EXXS4696Q6"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

// ✅ Function to Reset Password
function resetPassword() {
    const email = document.getElementById("resetEmail").value;

    if (!email) {
        alert("⚠️ Please enter your email to reset the password.");
        return;
    }

    sendPasswordResetEmail(auth, email)
        .then(() => {
            alert("✅ Password reset link sent! Check your email.");
            window.location.href = "login.html"; // Redirect to login page
        })
        .catch((error) => {
            console.error("Error:", error);
            alert("❌ Error: " + error.message);
        });
}

// ✅ Wait for DOM to be ready before adding event listener
document.addEventListener("DOMContentLoaded", function () {
    const resetButton = document.getElementById("resetButton");
    
    if (resetButton) {
        resetButton.addEventListener("click", resetPassword);
    } else {
        alert("⚠️ Reset button is missing. Please check your HTML file.");
        console.error("❌ Reset button not found in the document.");
    }
});
