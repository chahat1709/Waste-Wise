// Import Firebase modules from the CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* 
  1. Define your Firebase config 
     (Replace with actual values from your Firebase console)
*/
const firebaseConfig = {
    apiKey: "AIzaSyA21O-Ap2T4SFXVUZBz_nUsQ5gv00f-TJY",
    authDomain: "waste-wise-78541.firebaseapp.com",
    projectId: "waste-wise-78541",
    storageBucket: "waste-wise-78541.firebasestorage.app",
    messagingSenderId: "366633893436",
    appId: "1:366633893436:web:86f84ded105c403e0a0d39"
};

// 2. Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

/* 
  3. Email/Password Signup 
  Listens for a click on #signup-btn 
*/
document.getElementById("signup-btn").addEventListener("click", async () => {
  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value.trim();

  // Basic validation
  if (!name || !email || !password) {
    alert("Please fill in all fields!");
    return;
  }

  try {
    // Create user with Email & Password
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Store user data in Firestore
    await setDoc(doc(db, "users", user.uid), {
      name: name,
      email: user.email,
      createdAt: serverTimestamp()
    });

    alert("Signup successful! Redirecting to login...");
    window.location.href = "login.html"; // Redirect to login or dashboard
  } catch (error) {
    alert("Error: " + error.message);
  }
});

/* 
  4. Google Signup 
  Listens for a click on #google-signup 
*/
document.getElementById("google-signup").addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Save user data if not already present
    await setDoc(doc(db, "users", user.uid), {
      name: user.displayName || "No Name",
      email: user.email,
      createdAt: serverTimestamp()
    }, { merge: true });

    alert("Google Signup successful! Redirecting...");
    window.location.href = "dashboard.html"; // Or wherever you want
  } catch (error) {
    alert("Error: " + error.message);
  }
});
