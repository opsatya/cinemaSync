import { useState, useEffect, useCallback } from 'react';
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
import { exchangeToken } from './api';

/**
 * Custom hook for Firebase authentication
 * Provides methods for authentication and user state management
 */
export const useFirebaseAuth = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [backendToken, setBackendToken] = useState(localStorage.getItem('backendToken'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getBackendToken = useCallback(async (user) => {
    if (!user) {
      localStorage.removeItem('backendToken');
      setBackendToken(null);
      return;
    }
    try {
      const token = await exchangeToken({
        user_id: user.uid,
        name: user.displayName,
        email: user.email,
      });
      localStorage.setItem('backendToken', token);
      setBackendToken(token);
    } catch (e) {
      console.error("Failed to get backend token", e);
      setError("Could not authenticate with the server. Please try again.");
      await signOut(auth);
    }
  }, []);

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
      setError(err.message);
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
      setError(err.message);
      throw err;
    }
  };

  // Login with Google
  const loginWithGoogle = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      return userCredential.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Logout
  const logout = async () => {
    try {
      setError(null);
      await signOut(auth);
      localStorage.removeItem('backendToken');
      setBackendToken(null);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await getBackendToken(user);
      } else {
        localStorage.removeItem('backendToken');
        setBackendToken(null);
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [getBackendToken]);

  return {
    currentUser,
    backendToken,
    loading,
    error,
    register,
    login,
    loginWithGoogle,
    logout
  };
};
