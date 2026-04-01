// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Firebase configuration (consistent with all files)
const firebaseConfig = {
    apiKey: "AIzaSyA21O-Ap2T4SFXVUZBz_nUsQ5gv00f-TJY",
    authDomain: "waste-wise-78541.firebaseapp.com",
    projectId: "waste-wise-78541",
    storageBucket: "waste-wise-78541.appspot.com",
    messagingSenderId: "366633893436",
    appId: "1:366633893436:web:86f84ded105c403e0a0d39",
    measurementId: "G-EXXS4696Q6"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ✅ Export Firebase Authentication & Google Auth Provider
export { auth, provider };
