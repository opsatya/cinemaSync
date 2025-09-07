import { createContext, useContext } from 'react';
import { useFirebaseAuth } from '../utils/useFirebaseAuth';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  // Use our custom Firebase auth hook
  const {
    currentUser,
    backendToken,
    loading,
    error,
    register,
    login,
    loginWithGoogle,
    logout,
    refreshBackendToken,
  } = useFirebaseAuth();

  const value = {
    currentUser,
    backendToken,
    register,
    login,
    loginWithGoogle,
    logout,
    refreshBackendToken,
    loading,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
