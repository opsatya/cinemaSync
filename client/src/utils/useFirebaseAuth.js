import { useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  updateProfile
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { exchangeToken, testBackendConnectivity } from '../utils/api';

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
    try {
      if (!firebaseUser) {
        setBackendToken(null);
        localStorage.removeItem('backendToken');
        return;
      }

      // Test backend connectivity first
      const isBackendReachable = await testBackendConnectivity();
      if (!isBackendReachable) {
        throw new Error('Backend is not reachable. Please check if the server is running.');
      }

      // Get Firebase ID token and prepare identity
      const idToken = await firebaseUser.getIdToken(true);
      const identity = {
        user_id: firebaseUser.uid,
        name: firebaseUser.displayName || '',
        email: firebaseUser.email || '',
      };

      // Exchange token with backend
      const token = await exchangeToken(identity, idToken);

      // Save backend token
      setBackendToken(token);
      localStorage.setItem('backendToken', token);

    } catch (err) {
      console.error('Failed to exchange token:', err);
      setError('Failed to authenticate with backend: ' + err.message);
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
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      const result = await signInWithPopup(auth, provider);
      
      return result.user;
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

  // Main initialization effect
  useEffect(() => {
    let isMounted = true;
    let unsubscribe = null;
    
    const initializeAuth = async () => {
      try {
        // Preload any existing backend token from localStorage
        const existing = localStorage.getItem('backendToken');
        if (existing && isMounted) {
          setBackendToken(existing);
        }

        // Check for any pending redirect results
        const result = await getRedirectResult(auth);
        
        // Set up auth state listener
        if (isMounted) {
          unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!isMounted) return;
            
            setCurrentUser(user);

            if (user) {
              // Check if we already have a valid backend token for this user
              const existingToken = localStorage.getItem('backendToken');
              
              if (existingToken) {
                setBackendToken(existingToken);
              } else {
                await exchangeForBackendToken(user);
              }
            } else {
              // User signed out
              setBackendToken(null);
              localStorage.removeItem('backendToken');
            }

            setLoading(false);
          });
        }
      } catch (error) {
        if (isMounted) {
          setError('Authentication initialization failed: ' + error.message);
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Cleanup function
    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
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
    refreshBackendToken,
  };
};
