import { useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithRedirect,
  updateProfile
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { exchangeToken } from '../utils/api';

/**
 * Custom hook for Firebase authentication with backend token exchange
 * Provides methods for authentication and user state management
 */
export const useFirebaseAuth = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [backendToken, setBackendToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Exchange Firebase ID token for backend JWT
  const exchangeForBackendToken = async (firebaseUser) => {
    // DEBUG: Checkpoint 1 - Entry log
    console.log('🔁 [exchangeForBackendToken] called with user:', firebaseUser ? { uid: firebaseUser.uid, email: firebaseUser.email } : null);
    try {
      if (!firebaseUser) {
        console.warn('⚠️ [exchangeForBackendToken] No firebaseUser provided. Clearing backend token.');
        setBackendToken(null);
        return;
      }

      // Get Firebase ID token
      const idToken = await firebaseUser.getIdToken(true);
      console.log('🪪 [exchangeForBackendToken] Retrieved Firebase ID token. length =', idToken ? idToken.length : 0);

      // Prepare identity payload
      const identity = {
        user_id: firebaseUser.uid,
        name: firebaseUser.displayName || '',
        email: firebaseUser.email || '',
      };

      console.log('📤 [exchangeForBackendToken] Sending identity to backend for exchange:', identity);

      // Send identity + Firebase token to backend
      const token = await exchangeToken(identity, idToken);

      // Save backend token in state + localStorage
      setBackendToken(token);
      localStorage.setItem('backendToken', token);
      console.log('✅ [exchangeForBackendToken] Backend token stored. length =', token ? token.length : 0);

    } catch (err) {
      console.error('❌ [exchangeForBackendToken] Failed to exchange token:', err);
      setError('Failed to authenticate with backend');
      setBackendToken(null);
      localStorage.removeItem('backendToken');
    }
  };


  // Register with email and password
  const register = async (email, password, displayName) => {
    try {
      setError(null);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update profile with display name if provided
      if (displayName) {
        await updateProfile(userCredential.user, { displayName });
      }
      
      // Exchange for backend token
      await exchangeForBackendToken(userCredential.user);
      
      return userCredential.user;
    } catch (err) {
      setError(err.message || 'Registration failed');
      throw err;
    }
  };

  // Login with email and password
  const login = async (email, password) => {
    try {
      setError(null);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Exchange for backend token
      await exchangeForBackendToken(userCredential.user);
      
      return userCredential.user;
    } catch (err) {
      setError(err.message || 'Login failed');
      throw err;
    }
  };

  // Login with Google
  const loginWithGoogle = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithRedirect(auth, provider);
      
      // Exchange for backend token
      await exchangeForBackendToken(userCredential.user);
      
      return userCredential.user;
    } catch (err) {
      setError(err.message || 'Google login failed');
      throw err;
    }
  };

  // Logout
  const logout = async () => {
    try {
      setError(null);
      await signOut(auth);
      setBackendToken(null);
      localStorage.removeItem('backendToken');
    } catch (err) {
      setError(err.message || 'Logout failed');
      throw err;
    }
  };

  // Refresh backend token manually
  const refreshBackendToken = async () => {
    if (currentUser) {
      await exchangeForBackendToken(currentUser);
    }
  };

  // Preload any existing backend token from localStorage (mitigate initial timing)
  useEffect(() => {
    const existing = localStorage.getItem('backendToken');
    if (existing) {
      console.log('🗃️ [useFirebaseAuth] Preloaded backendToken from localStorage. length =', existing.length);
      setBackendToken(existing);
    }
  }, []);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        // Always refresh backend token when user signs in
        await exchangeForBackendToken(user);
      } else {
        // User signed out
        setBackendToken(null);
        localStorage.removeItem('backendToken');
      }

      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  return {
    currentUser,
    backendToken,
    loading,
    error,
    register,
    login,
    loginWithGoogle,
    logout,
    refreshBackendToken, // expose manual refresh
  };
};
