// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef123456",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Check if we have real Firebase config or demo config
const isDemoConfig = firebaseConfig.projectId === "demo-project";
if (isDemoConfig) {
  // Hard fail to avoid silent auth/analytics failures
  const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown-origin';
  const msg = [
    'Firebase is using demo configuration. Set real Firebase environment variables in the client .env:',
    '- VITE_FIREBASE_API_KEY',
    '- VITE_FIREBASE_AUTH_DOMAIN',
    '- VITE_FIREBASE_PROJECT_ID',
    '- VITE_FIREBASE_STORAGE_BUCKET',
    '- VITE_FIREBASE_MESSAGING_SENDER_ID',
    '- VITE_FIREBASE_APP_ID',
    '(optional) VITE_FIREBASE_MEASUREMENT_ID',
    `Current origin: ${origin}`
  ].join('\n');
  throw new Error(msg);
}

// Initialize Firebase
let app;
let analytics;
let auth;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  
  // Only initialize analytics if we have a real project ID and measurement ID
  if (!isDemoConfig && firebaseConfig.measurementId) {
    analytics = getAnalytics(app);
  }
} catch (error) {
  // Ensure the error is visible and actionable during development
  console.error('Failed to initialize Firebase:', error);
  throw error;
}

export { auth, analytics };
