import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBSP2xZxfIQgX_BuCAdtfvYrAXKNbLz9SA",
  authDomain: "flashcard-app-4e292.firebaseapp.com",
  projectId: "flashcard-app-4e292",
  storageBucket: "flashcard-app-4e292.firebasestorage.app",
  messagingSenderId: "993355877742",
  appId: "1:993355877742:web:51d77a44df024b1988c57f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Login failed", error);
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed", error);
  }
};
