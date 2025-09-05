// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA56ZoHXMxV5y0YBUfqLwDr-B2R7WbFUzI",
  authDomain: "cinemasync-2b7ad.firebaseapp.com",
  projectId: "cinemasync-2b7ad",
  storageBucket: "cinemasync-2b7ad.appspot.com",
  messagingSenderId: "115409164911",
  appId: "1:115409164911:web:cfef8673c22f96c12c8b9a",
  measurementId: "G-KSR63TEZ16"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

export { auth, analytics };
