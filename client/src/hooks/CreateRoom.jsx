import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  useTheme,
  Chip,
  Alert,
} from '@mui/material';
import { Add, Movie, Link as LinkIcon, Public, Lock } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { createRoom as apiCreateRoom } from '../utils/api';

const CreateRoom = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { backendToken } = useAuth();
  // DEBUG: Checkpoint 3 - Log the backendToken value from context
  console.log('🔑 [CreateRoom] Backend token from context:', backendToken);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [roomData, setRoomData] = useState({
    name: '',
    description: '',
    privacy: 'private',
    allowChat: true,
    allowReactions: true,
    password: '',
    movieSource: 'googleDrive',
    movieLink: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setRoomData({ ...roomData, [name]: value });
  };

  const handleSwitchChange = (e) => {
    const { name, checked } = e.target;
    setRoomData({ ...roomData, [name]: checked });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!backendToken) {
      setError("You are not authenticated. Please log in again.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        name: roomData.name,
        description: roomData.description,
        is_private: roomData.privacy === 'private',
        password: roomData.password || null,
        enable_chat: roomData.allowChat,
        enable_reactions: roomData.allowReactions,
        movie_source: {
          type: roomData.movieSource,
          value: roomData.movieLink || null,
        },
      };

      const newRoom = await apiCreateRoom(payload, backendToken);
      navigate(`/theater/${newRoom.room_id}`);
    } catch (err) {
      setError(err.message || 'Failed to create room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ mt: 4, mb: 6 }}>
          <Typography 
            variant="h3" 
            component="h1" 
            gutterBottom 
            align="center"
            sx={{
              fontWeight: 700,
              background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 4,
            }}
          >
            Create a Movie Room
          </Typography>
          
          <Paper
            elevation={6}
            component="form"
            onSubmit={handleSubmit}
            sx={{
              p: 4,
              borderRadius: '16px',
              background: 'rgba(30, 41, 59, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {error && (
              <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
                {error}
              </Alert>
            )}
            <Grid container spacing={3}>
              {/* Room Details Section */}
              <Grid item xs={12}>
                <Typography variant="h5" component="h2" gutterBottom>
                  Room Details
                </Typography>
                <Divider sx={{ mb: 3 }} />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  required
                  fullWidth
                  label="Room Name"
                  name="name"
                  value={roomData.name}
                  onChange={handleChange}
                  variant="outlined"
                  placeholder="Movie Night with Friends"
                  InputProps={{
                    sx: {
                      borderRadius: '8px',
                    },
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="privacy-label">Privacy Setting</InputLabel>
                  <Select
                    labelId="privacy-label"
                    id="privacy"
                    name="privacy"
                    value={roomData.privacy}
                    label="Privacy Setting"
                    onChange={handleChange}
                    sx={{ borderRadius: '8px' }}
                  >
                    <MenuItem value="public">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Public sx={{ mr: 1, color: theme.palette.success.main }} />
                        Public (Anyone with the link)
                      </Box>
                    </MenuItem>
                    <MenuItem value="private">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Lock sx={{ mr: 1, color: theme.palette.primary.main }} />
                        Private (Invite only)
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Room Description"
                  name="description"
                  value={roomData.description}
                  onChange={handleChange}
                  variant="outlined"
                  multiline
                  rows={3}
                  placeholder="Tell your friends what you're watching"
                  InputProps={{
                    sx: {
                      borderRadius: '8px',
                    },
                  }}
                />
              </Grid>
              
              {roomData.privacy === 'private' && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Room Password (Optional)"
                    name="password"
                    type="password"
                    value={roomData.password}
                    onChange={handleChange}
                    variant="outlined"
                    placeholder="Leave empty for no password"
                    InputProps={{
                      sx: {
                        borderRadius: '8px',
                      },
                    }}
                  />
                </Grid>
              )}
              
              <Grid item xs={12} md={roomData.privacy === 'private' ? 6 : 12}>
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={roomData.allowChat}
                        onChange={handleSwitchChange}
                        name="allowChat"
                        color="primary"
                      />
                    }
                    label="Enable Chat"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={roomData.allowReactions}
                        onChange={handleSwitchChange}
                        name="allowReactions"
                        color="primary"
                      />
                    }
                    label="Enable Reactions"
                  />
                </Box>
              </Grid>
              
              {/* Movie Source Section */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="h5" component="h2" gutterBottom>
                  Movie Source
                </Typography>
                <Divider sx={{ mb: 3 }} />
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel id="movie-source-label">Movie Source</InputLabel>
                  <Select
                    labelId="movie-source-label"
                    id="movieSource"
                    name="movieSource"
                    value={roomData.movieSource}
                    label="Movie Source"
                    onChange={handleChange}
                    sx={{ borderRadius: '8px' }}
                  >
                    <MenuItem value="googleDrive">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <img 
                          src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Google_Drive_icon_%282020%29.svg/512px-Google_Drive_icon_%282020%29.svg.png" 
                          alt="Google Drive" 
                          style={{ width: 24, height: 24, marginRight: 8 }}
                        />
                        Google Drive
                      </Box>
                    </MenuItem>
                    <MenuItem value="directLink">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <LinkIcon sx={{ mr: 1 }} />
                        Direct Video Link
                      </Box>
                    </MenuItem>
                    <MenuItem value="uploadLater">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Movie sx={{ mr: 1 }} />
                        Add Movie Later
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              {roomData.movieSource !== 'uploadLater' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={roomData.movieSource === 'googleDrive' ? 'Google Drive Link' : 'Direct Video URL'}
                    name="movieLink"
                    value={roomData.movieLink}
                    onChange={handleChange}
                    variant="outlined"
                    placeholder={roomData.movieSource === 'googleDrive' ? 'https://drive.google.com/file/d/...' : 'https://example.com/video.mp4'}
                    InputProps={{
                      sx: {
                        borderRadius: '8px',
                      },
                      startAdornment: (
                        <LinkIcon sx={{ color: 'text.secondary', mr: 1 }} />
                      ),
                    }}
                  />
                </Grid>
              )}
              
              {/* Create Room Button */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={loading}
                    startIcon={<Add />}
                    sx={{ 
                      py: 1.5,
                      borderRadius: '8px',
                      background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                      '&:hover': {
                        background: `linear-gradient(90deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
                      }
                    }}
                  >
                    {loading ? 'Creating...' : 'Create Room'}
                  </Button>
                </motion.div>
              </Grid>
            </Grid>
          </Paper>
          
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              By creating a room, you agree to our Terms of Service and Community Guidelines
            </Typography>
          </Box>
        </Box>
      </motion.div>
    </Container>
  );
};

export default CreateRoom;
