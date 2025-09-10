import { useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
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
        localStorage.removeItem('backendToken');
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

      // Send identity and Firebase ID token to backend for verification
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
      console.log('📝 [register] Starting registration for:', email);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('✅ [register] Firebase user created:', userCredential.user.uid);
      
      // Update profile with display name if provided
      if (displayName) {
        await updateProfile(userCredential.user, { displayName });
        console.log('✅ [register] Profile updated with displayName:', displayName);
      }
      
      // Note: Don't exchange token here - let onAuthStateChanged handle it
      console.log('✅ [register] Registration complete, waiting for auth state change...');
      
      return userCredential.user;
    } catch (err) {
      console.error('❌ [register] Registration failed:', err);
      setError(err.message || 'Registration failed');
      throw err;
    }
  };

  // Login with email and password
  const login = async (email, password) => {
    try {
      setError(null);
      console.log('🔐 [login] Starting login for:', email);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ [login] Firebase login successful:', userCredential.user.uid);
      
      // Note: Don't exchange token here - let onAuthStateChanged handle it
      console.log('✅ [login] Login complete, waiting for auth state change...');
      
      return userCredential.user;
    } catch (err) {
      console.error('❌ [login] Login failed:', err);
      setError(err.message || 'Login failed');
      throw err;
    }
  };

  // Login with Google - FIXED VERSION
  // Before redirecting to Google, store intended redirect path (default to home)
  const REDIRECT_STORAGE_KEY = 'redirectAfterLogin';
  const loginWithGoogle = async () => {
    // Save the intended redirect path. You could enhance this to read the current
    // location or a query param if you want more granular control.
    sessionStorage.setItem(REDIRECT_STORAGE_KEY, window.location.pathname || '/');
    try {
      setError(null);
      console.log('🔍 [loginWithGoogle] Starting Google authentication...');
      
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      // Use redirect - this will redirect the page
      await signInWithRedirect(auth, provider);
      console.log('🔄 [loginWithGoogle] Redirect initiated...');
      
      // Don't return anything here - the page will redirect
      // The redirect result will be handled in the useEffect below
    } catch (err) {
      console.error('❌ [loginWithGoogle] Google login failed:', err);
      setError(err.message || 'Google login failed');
      throw err;
    }
  };

  // Logout
  const logout = async () => {
    try {
      setError(null);
      console.log('🚪 [logout] Starting logout...');
      
      await signOut(auth);
      setBackendToken(null);
      localStorage.removeItem('backendToken');
      
      console.log('✅ [logout] Logout complete');
    } catch (err) {
      console.error('❌ [logout] Logout failed:', err);
      setError(err.message || 'Logout failed');
      throw err;
    }
  };

  // Refresh backend token manually
  const refreshBackendToken = async () => {
    if (currentUser) {
      console.log('🔄 [refreshBackendToken] Manually refreshing token...');
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

  // Handle Google redirect result - ADDED
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        console.log('🔍 [handleRedirectResult] Checking for redirect result...');
        const result = await getRedirectResult(auth);
        
        if (result && result.user) {
          // Read the path we saved before redirect (defaults to "/")
          const redirectPath = sessionStorage.getItem(REDIRECT_STORAGE_KEY) || '/';
          sessionStorage.removeItem(REDIRECT_STORAGE_KEY);
          // Navigate using full reload to ensure Router picks up new auth state
          window.location.replace(redirectPath);
          console.log('🔄 [handleRedirectResult] Google redirect result received:', result.user.email);
          // The onAuthStateChanged will handle the token exchange automatically
        } else {
          console.log('🔍 [handleRedirectResult] No redirect result found');
        }
      } catch (error) {
        console.error('❌ [handleRedirectResult] Google redirect error:', error);
        setError('Google authentication failed: ' + error.message);
      }
    };

    handleRedirectResult();
  }, []); // Run once on component mount

  // Subscribe to auth state changes
  useEffect(() => {
    console.log('👂 [useFirebaseAuth] Setting up auth state listener...');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔄 [onAuthStateChanged] Auth state changed:', user ? `User: ${user.email} (${user.uid})` : 'No user');
      
      setCurrentUser(user);

      if (user) {
        // Check if we already have a valid backend token for this user
        const existingToken = localStorage.getItem('backendToken');
        
        if (existingToken) {
          console.log('🗃️ [onAuthStateChanged] Using existing backend token');
          setBackendToken(existingToken);
        } else {
          console.log('🔄 [onAuthStateChanged] No existing token, exchanging for new one...');
          await exchangeForBackendToken(user);
        }
      } else {
        // User signed out
        console.log('🚪 [onAuthStateChanged] User signed out, clearing tokens');
        setBackendToken(null);
        localStorage.removeItem('backendToken');
      }

      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => {
      console.log('🧹 [useFirebaseAuth] Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  // Debug logging for state changes
  useEffect(() => {
    console.log('📊 [useFirebaseAuth] State update:', {
      hasCurrentUser: !!currentUser,
      hasBackendToken: !!backendToken,
      loading,
      error: error || 'none'
    });
  }, [currentUser, backendToken, loading, error]);

  return {
    currentUser,
    backendToken,
    loading,
    error,
    register,
    login,
    loginWithGoogle,
    logout,
    refreshBackendToken,
  };
};
