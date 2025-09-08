import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Link,
  Paper,
  Avatar,
  useTheme,
  Alert,
} from '@mui/material';
import { LockOutlined, Google } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const theme = useTheme();
  // REMOVED: const navigate = useNavigate(); - No longer needed for manual navigation
  const { login, loginWithGoogle } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // FIXED: Removed manual navigation to prevent redirect loops
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('🔍 Starting Google login...');
      
      await loginWithGoogle();
      
      // REMOVED: navigate('/') - Let PublicRoute component handle the redirect
      // The auth state will change and route guards will redirect automatically
      console.log('✅ Google login successful, waiting for redirect...');
      
    } catch (err) {
      console.error('❌ Google login error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Google sign-in is not enabled in Firebase. Please enable it in Firebase Console > Authentication > Sign-in method.');
      } else {
        setError('Failed to sign in with Google: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Removed manual navigation to prevent redirect loops
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setError('');
      setLoading(true);
      console.log('🔐 Starting email login for:', formData.email);
      
      await login(formData.email, formData.password);
      
      // REMOVED: navigate('/') - Let PublicRoute component handle the redirect
      // The auth state will change and route guards will redirect automatically
      console.log('✅ Email login successful, waiting for redirect...');
      
    } catch (err) {
      console.error('❌ Email login error:', err);
      
      // Handle specific error cases
      if (err.code === 'auth/user-not-found') {
        setError('No account found for this email. Please register to continue.');
        // Keep manual navigation for error case only
        setTimeout(() => {
          window.location.href = '/register';
        }, 2000);
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError('Failed to log in: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      minHeight: '100vh'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
      >
        <Paper
          elevation={6}
          sx={{
            p: 4,
            width: '100%',
            borderRadius: '16px',
            background: 'rgba(30, 41, 59, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <Avatar sx={{ m: 1, bgcolor: theme.palette.primary.main }}>
                <LockOutlined />
              </Avatar>
            </motion.div>
            <Typography component="h1" variant="h5" sx={{ mb: 3 }}>
              Sign in to CinemaSync
            </Typography>
            
            {error && (
              <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
                {error}
              </Alert>
            )}
            
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Google />}
              onClick={handleGoogleLogin}
              disabled={loading}
              sx={{ 
                mb: 2, 
                py: 1.2,
                borderRadius: '8px',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  backgroundColor: 'rgba(109, 40, 217, 0.1)',
                }
              }}
            >
              {loading ? 'Signing in...' : 'Continue with Google'}
            </Button>
            
            <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', my: 2 }}>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
              <Typography variant="body2" sx={{ px: 2, color: 'text.secondary' }}>
                OR
              </Typography>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
            </Box>
            
            <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1, width: '100%' }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
                autoFocus
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.4)',
                    },
                  },
                }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.4)',
                    },
                  },
                }}
              />
              <motion.div
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
              >
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={loading}
                  sx={{ 
                    mt: 3, 
                    mb: 2, 
                    py: 1.2,
                    borderRadius: '8px',
                    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    '&:hover': {
                      background: `linear-gradient(90deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
                    }
                  }}
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </Button>
              </motion.div>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link component={RouterLink} to="/forgot-password" variant="body2" color="primary.light">
                  Forgot password?
                </Link>
                <Link component={RouterLink} to="/register" variant="body2" color="primary.light">
                  Don't have an account? Sign Up
                </Link>
              </Box>
            </Box>
          </Box>
        </Paper>
      </motion.div>
    </Container>
  );
};

export default Login;
