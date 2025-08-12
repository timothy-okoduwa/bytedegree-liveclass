// firebase-config.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your Firebase config - replace with your actual config
const firebaseConfig = {
  apiKey: "AIzaSyA1bXFiAsUqLQaj71m4jT1NOaZNP-cT7qk",
  authDomain: "usersput.firebaseapp.com",
  projectId: "usersput",
  storageBucket: "usersput.firebasestorage.app",
  messagingSenderId: "923146002824",
  appId: "1:923146002824:web:47ec4138f4784f51349a3d",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth (optional)
export const auth = getAuth(app);

export default app;
