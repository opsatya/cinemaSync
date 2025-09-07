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

/**
 * Provides methods for authentication and user state management.
 * Provides methods for authentication and user state management
 * Provides methods for authentication and user state management.
 */
export const useFirebaseAuth = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  return {
    currentUser,
    loading,
    error,
    register,
    login,
    loginWithGoogle,
    logout
  };
};
