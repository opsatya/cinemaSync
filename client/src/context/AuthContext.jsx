import { createContext, useContext } from 'react';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  // Use our custom Firebase auth hook
  const {
    currentUser,
    loading,
    error,
    register,
    login,
    loginWithGoogle,
    logout
  } = useFirebaseAuth();

  const value = {
    currentUser,
    register,
    login,
    loginWithGoogle,
    logout,
    loading,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
