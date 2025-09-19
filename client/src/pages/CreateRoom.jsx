import { useEffect, useState } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import { Add, Movie, Link as LinkIcon, Public, Lock } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { 
  createRoom as apiCreateRoom,
  getGoogleAuthUrl,
  getGoogleTokensStatus,
  fetchDriveVideos,
  setRoomVideo,
} from '../utils/api';

const CreateRoom = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { backendToken } = useAuth();
  // DEBUG: Log the backendToken value only when it changes (avoid logging on every render)
  useEffect(() => {
    if (backendToken) {
      console.log('🔑 [CreateRoom] backendToken from context:', `(length=${backendToken.length})`);
    } else {
      console.log('🔑 [CreateRoom] backendToken from context:', backendToken);
    }
  }, [backendToken]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingDrive, setCheckingDrive] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveVideos, setDriveVideos] = useState([]);
  const [selectDialogOpen, setSelectDialogOpen] = useState(false);
  const [selectedDriveVideo, setSelectedDriveVideo] = useState(null); // { id, name }
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
    console.log('📝 [CreateRoom] Submitting form. backendToken present?', !!backendToken);
    if (!backendToken) {
      setError("You are not authenticated. Please log in again.");
      console.warn('🚫 [CreateRoom] Submit blocked. Missing backendToken.');
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
      console.log('📦 [CreateRoom] Payload to createRoom:', payload);
      const newRoom = await apiCreateRoom(payload, backendToken);
      console.log('🎉 [CreateRoom] Room created:', newRoom);

      // If user selected a Drive video, set it for the room now
      if (selectedDriveVideo) {
        try {
          console.log('📤 [CreateRoom] Setting selected Drive video for room:', selectedDriveVideo);
          await setRoomVideo(newRoom.room_id, {
            video_id: selectedDriveVideo.id,
            video_name: selectedDriveVideo.name,
          }, backendToken);
        } catch (setErr) {
          console.error('❌ [CreateRoom] Failed to set room video:', setErr);
          // Continue navigation even if this fails; Theater page can retry
        }
      }

      navigate(`/theater/${newRoom.room_id}`);
    } catch (err) {
      console.error('❌ [CreateRoom] Failed to create room:', err);
      setError(err.message || 'Failed to create room.');
    } finally {
      setLoading(false);
    }
  };

  // Check Drive connection status
  useEffect(() => {
    const checkStatus = async () => {
      if (!backendToken) return;
      try {
        setCheckingDrive(true);
        const connected = await getGoogleTokensStatus(backendToken);
        setDriveConnected(connected);
        if (connected) {
          // Optionally prefetch videos for smoother UX
          try {
            const vids = await fetchDriveVideos(backendToken);
            setDriveVideos(vids);
          } catch (e) {
            console.warn('[CreateRoom] Prefetch Drive videos failed:', e?.message || e);
          }
        }
      } catch (e) {
        console.warn('[CreateRoom] Drive status check failed:', e?.message || e);
        setDriveConnected(false);
      } finally {
        setCheckingDrive(false);
      }
    };
    checkStatus();
  }, [backendToken]);

  const handleConnectDrive = async () => {
    try {
      if (!backendToken) {
        setError('Please log in to connect Google Drive.');
        return;
      }
      const url = await getGoogleAuthUrl(backendToken);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setError(e.message || 'Failed to start Google authorization');
    }
  };

  const openSelectFromDrive = async () => {
    try {
      if (!backendToken) {
        setError('Please log in.');
        return;
      }
      const vids = await fetchDriveVideos(backendToken);
      setDriveVideos(vids);
      setSelectDialogOpen(true);
    } catch (e) {
      setError(e.message || 'Failed to fetch Google Drive videos');
    }
  };

  return (
    <>
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

              {roomData.movieSource === 'directLink' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={'Direct Video URL'}
                    name="movieLink"
                    value={roomData.movieLink}
                    onChange={handleChange}
                    variant="outlined"
                    placeholder={'https://example.com/video.mp4'}
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

              {roomData.movieSource === 'googleDrive' && (
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Button 
                      variant="outlined"
                      onClick={handleConnectDrive}
                      disabled={checkingDrive}
                    >
                      {driveConnected ? 'Reconnect Google Drive' : 'Connect Google Drive'}
                    </Button>
                    <Button 
                      variant="contained"
                      onClick={openSelectFromDrive}
                      disabled={!driveConnected}
                    >
                      Select Video from Drive
                    </Button>
                    {selectedDriveVideo && (
                      <Chip 
                        label={`Selected: ${selectedDriveVideo.name}`}
                        onDelete={() => setSelectedDriveVideo(null)}
                        color="primary"
                      />
                    )}
                  </Box>
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
    {/* Drive Videos Selection Dialog */}
    <Dialog key="drive-select" open={selectDialogOpen} onClose={() => setSelectDialogOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Select a video from your Google Drive</DialogTitle>
      <DialogContent dividers>
        {driveVideos?.length ? (
          <List>
            {driveVideos.map(v => (
              <ListItem key={v.id} disablePadding>
                <ListItemButton
                  onClick={() => {
                    setSelectedDriveVideo({ id: v.id, name: v.name });
                    setSelectDialogOpen(false);
                  }}
                >
                  <ListItemText primary={v.name} secondary={v.mimeType || ''} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body2" color="text.secondary">No videos found in Drive.</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setSelectDialogOpen(false)}>Close</Button>
      </DialogActions>
    </Dialog>
    </>
  );
};

export default CreateRoom;
