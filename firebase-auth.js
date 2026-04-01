// ✅ Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { firebaseConfig } from "./firebase-Config.js"; // Ensure this file exists

// ✅ Initialize Firebase (Fixing the No Firebase App Error)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ✅ Check if the user is logged in
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("✅ User is logged in:", user.email);
    } else {
        console.log("❌ No user logged in. Redirecting to login...");
        alert("Please log in first!");
        window.location.href = "login.html"; // Redirect to login page
    }
});

// ✅ Logout function
document.getElementById("logoutButton").addEventListener("click", () => {
    signOut(auth)
        .then(() => {
            console.log("✅ User logged out.");
            window.location.href = "login.html"; // Redirect to login after logout
        })
        .catch((error) => {
            console.error("❌ Logout error:", error);
        });
});
