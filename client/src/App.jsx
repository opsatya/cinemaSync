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

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  
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
  
  if (!currentUser) {
    return <Navigate to="/login" />;
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
  const { currentUser, loading } = useAuth();
  
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
        {/* Public routes with AuthLayout - accessible to everyone */}
        <Route element={<AuthLayout />}>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={currentUser ? <Navigate to="/" /> : <Login />} />
        </Route>
        
        {/* Protected routes with MainLayout */}
        <Route element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }>
          <Route path="/" element={<Home />} />
          <Route path="/theater/:roomId" element={<Theater />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/create-room" element={<CreateRoom />} />
          <Route path="/my-rooms" element={<MyRooms />} />
        </Route>
        
        {/* Default route - redirect to register if not authenticated, otherwise to home */}
        <Route path="*" element={currentUser ? <Navigate to="/" /> : <Navigate to="/register" />} />
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