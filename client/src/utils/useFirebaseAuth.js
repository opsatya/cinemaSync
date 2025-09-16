import { useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
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

  // Utility: normalize Firebase errors
  const getErrorMessage = (err) => {
    if (!err || !err.code) return err?.message || 'Unknown error';
    switch (err.code) {
      case 'auth/email-already-in-use':
        return 'This email is already registered.';
      case 'auth/invalid-email':
        return 'Invalid email format.';
      case 'auth/wrong-password':
        return 'Incorrect password.';
      case 'auth/user-not-found':
        return 'No account found with this email.';
      case 'auth/popup-closed-by-user':
        return 'Popup was closed before login could complete.';
      default:
        return err.message || 'Authentication failed';
    }
  };

  // Exchange Firebase ID token for backend JWT
  const exchangeForBackendToken = async (firebaseUser) => {
    try {
      if (!firebaseUser) {
        setBackendToken(null);
        localStorage.removeItem('backendToken');
        return;
      }

      // Ensure backend is reachable
      const isBackendReachable = await testBackendConnectivity();
      if (!isBackendReachable) {
        throw new Error('Backend is not reachable. Please check if the server is running.');
      }

      const idToken = await firebaseUser.getIdToken(true);
      const identity = {
        user_id: firebaseUser.uid,
        name: firebaseUser.displayName || '',
        email: firebaseUser.email || '',
      };

      const token = await exchangeToken(identity, idToken);

      setBackendToken(token);
      localStorage.setItem('backendToken', token);
    } catch (err) {
      console.error('Token exchange failed:', err);
      setError(getErrorMessage(err));
      setBackendToken(null);
      localStorage.removeItem('backendToken');
    }
  };

  // Register with email + password
  const register = async (email, password, displayName) => {
    try {
      setError(null);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      if (displayName) {
        await updateProfile(userCredential.user, { displayName });
      }

      await exchangeForBackendToken(userCredential.user);
      return userCredential.user;
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  // Login with email + password
  const login = async (email, password) => {
    try {
      setError(null);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await exchangeForBackendToken(userCredential.user);
      return userCredential.user;
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  // Login with Google (popup only)
  const loginWithGoogle = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await signInWithPopup(auth, provider);
      await exchangeForBackendToken(result.user);
      return result.user;
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      throw new Error(msg);
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
      const msg = getErrorMessage(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  // Refresh backend token manually
  const refreshBackendToken = async () => {
    if (currentUser) {
      await exchangeForBackendToken(currentUser);
    }
  };

  // Main auth listener
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;

      setCurrentUser(user);

      if (user) {
        const existingToken = localStorage.getItem('backendToken');
        if (existingToken) {
          setBackendToken(existingToken);
        } else {
          await exchangeForBackendToken(user);
        }
      } else {
        setBackendToken(null);
        localStorage.removeItem('backendToken');
      }

      setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
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
