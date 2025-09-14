import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, CircularProgress } from '@mui/material';
import theme from './theme';
import { AuthProvider, useAuth } from './context/AuthContext';

// Page imports
import Home from './pages/Home';
import Theater from './pages/Theater';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import CreateRoom from './pages/CreateRoom';
import MyRooms from './pages/MyRooms';

// Layout components
import MainLayout from './components/layout/MainLayout';


// Protected Route component - for authenticated users only
const ProtectedRoute = ({ children }) => {
  const { currentUser, backendToken, loading } = useAuth();
  
  if (loading) {
    return (
      <Box 
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh'
        }}
      >
        <CircularProgress color="primary" />
      </Box>
    );
  }
  
  // More lenient check - allow if either Firebase user OR backend token exists
  if (!currentUser && !backendToken) {
    const from = window.location.pathname + window.location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(from)}`} replace />;
  }
  
  return children;
};

// Public Route component - for unauthenticated users only
const PublicRoute = ({ children }) => {
  const { currentUser, backendToken, loading } = useAuth();
  
  if (loading) {
    return (
      <Box 
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh'
        }}
      >
        <CircularProgress color="primary" />
      </Box>
    );
  }
  
  // If already authenticated, redirect to home instead of showing login/register
  if (currentUser || backendToken) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

// Auth Layout component for authentication pages
const AuthLayout = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
      }}
    >
      <Outlet />
    </Box>
  );
};

function AppContent() {
  const { currentUser, backendToken, loading } = useAuth();
  
  // Show loading indicator while auth state is being determined
  if (loading) {
    return (
      <Box 
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh'
        }}
      >
        <CircularProgress color="primary" />
      </Box>
    );
  }
  
  return (
    <Router>
      <Routes>
        {/* Public routes - redirect authenticated users to home */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        </Route>
        
        {/* Protected routes - require authentication */}
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route path="/" element={<Home />} />
          <Route path="/theater/:roomId" element={<Theater />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/create-room" element={<CreateRoom />} />
          <Route path="/my-rooms" element={<MyRooms />} />
        </Route>
        
        {/* Fallback routes */}
        <Route 
          path="*" 
          element={
            (currentUser || backendToken) 
              ? <Navigate to="/" replace /> 
              : <Navigate to="/login" replace />
          } 
        />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* Normalize CSS */}
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
