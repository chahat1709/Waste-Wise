// ✅ Import Firebase Authentication
import { getAuth, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth } from "./firebase-Config.js"; // Make sure firebase-Config.js exists

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
