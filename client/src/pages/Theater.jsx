import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Grid,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Drawer,
  useTheme,
  useMediaQuery,
  Fab,
  Zoom,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  VolumeUp,
  VolumeMute,
  SkipNext,
  Chat as ChatIcon,
  PeopleAlt,
  Fullscreen,
  Settings,
  Close,
  Movie,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../context/AuthContext';
import { socket } from '../context/socket';
import { getRoomDetails } from '../utils/api';
// Import components
import VideoPlayer from '../components/theater/VideoPlayer';
import ChatPanel from '../components/chat/ChatPanel';
import UserList from '../components/theater/UserList';
import PlaylistPanel from '../components/playlist/PlaylistPanel';
import MovieBrowser from '../components/movies/MovieBrowser';

const Theater = () => {
  const { roomId } = useParams();
  const theme = useTheme();
  const { currentUser } = useAuth();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // State for the theater
  const [room, setRoom] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showChat, setShowChat] = useState(!isMobile);
  const [showUserList, setShowUserList] = useState(false);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [showReaction, setShowReaction] = useState(false);
  const [reaction, setReaction] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Movie selection state
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [showMovieBrowser, setShowMovieBrowser] = useState(false);
  
  // Fetch room details on mount
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        setLoading(true);
        const roomDetails = await getRoomDetails(roomId);
        setRoom(roomDetails);
        setUsers(roomDetails.participants || []);
        if (roomDetails.movie_source && roomDetails.movie_source.type === 'googleDrive' && roomDetails.movie_source.value) {
          setSelectedMovie({ id: roomDetails.movie_source.value, name: 'Movie' });
        }
      } catch (err) {
        setError(err.message || 'Could not load room.');
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();
  }, [roomId]);

  const showReactionBubble = useCallback((emoji) => {
    setReaction(emoji);
    setShowReaction(true);
    setTimeout(() => setShowReaction(false), 2000);
  }, []);

  // Socket.IO connection and event handling
useEffect(() => {
  if (!roomId || !currentUser) return;

  socket.connect();

  socket.on('connect', () => {
    console.log('Socket connected, joining room...');
    socket.emit('join_room', { room_id: roomId, user_id: currentUser.uid });
  });

  socket.on('user_joined', (data) => setUsers(data.participants));
  socket.on('user_left', (data) => setUsers(data.participants));
  socket.on('room_joined', (data) => {
    setRoom(data.room);
    setUsers(data.room.participants);
    setIsPlaying(data.room.playback_state.is_playing);
  });
  socket.on('playback_updated', (data) => setIsPlaying(data.playback_state.is_playing));
  socket.on('new_chat_message', (msg) => setMessages((prev) => [...prev, msg]));
  socket.on('new_reaction', (data) => showReactionBubble(data.reaction));
  socket.on('error', (err) => {
    console.error('Socket Error:', err.message);
    setError(`Socket error: ${err.message}`);
  });

  return () => {
    socket.emit('leave_room', { room_id: roomId, user_id: currentUser.uid });
    socket.removeAllListeners(); // 🔑 safer than disconnecting every time
    socket.disconnect();         // only when unmounting
  };
}, [roomId, currentUser, showReactionBubble]);


  // Toggle play/pause
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    socket.emit('update_playback', { room_id: roomId, user_id: currentUser.uid, playback_state: { is_playing: !isPlaying, current_time: currentTime } });
  };
  
  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };
  
  // Handle movie selection
  const handleMovieSelect = (movie) => {
    setSelectedMovie(movie);
    setShowMovieBrowser(false);
    // Reset playback state
    setIsPlaying(false);
    setCurrentTime(0);
  };
  
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5 } },
    exit: { opacity: 0, transition: { duration: 0.3 } },
  };
  
  const reactionVariants = {
    hidden: { opacity: 0, scale: 0, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 15 } },
    exit: { opacity: 0, scale: 0, transition: { duration: 0.2 } },
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '90vh' }}><CircularProgress /></Box>;
  }

  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <Container maxWidth="xl" sx={{ height: '100%' }}>
        <Grid container spacing={2} sx={{ height: '100%' }}>
          {/* Main Theater Area */}
          <Grid item xs={12} md={showChat ? 8 : 12} lg={showChat ? 9 : 12}>
            <Paper 
              elevation={6} 
              sx={{ 
                height: '100%',
                overflow: 'hidden',
                borderRadius: '12px',
                position: 'relative',
                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                transition: theme.transitions.create(['width'], {
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.leavingScreen,
                }),
              }}
            >
              {/* Theater Header */}
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h5" component="h1" noWrap>
                  {room?.name || `Room: ${roomId}`}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Tooltip title="Users">
                    <IconButton color="primary" onClick={() => setShowUserList(!showUserList)}>
                      <PeopleAlt />
                    </IconButton>
                  </Tooltip>
                  {isMobile && (
                    <Tooltip title="Chat">
                      <IconButton color="primary" onClick={() => setShowChat(!showChat)}>
                        <ChatIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Settings">
                    <IconButton color="primary">
                      <Settings />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              
              {/* Video Player */}
              <Box 
                sx={{ 
                  position: 'relative',
                  width: '100%',
                  height: 'calc(100% - 130px)',
                  backgroundColor: '#000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {selectedMovie ? (
                  <VideoPlayer 
                    isPlaying={isPlaying} 
                    isMuted={isMuted} 
                    fileId={selectedMovie.id} 
                  />
                ) : (
                  <Box 
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      width: '100%',
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    }}
                  >
                    <Movie sx={{ fontSize: 80, opacity: 0.3, mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                      No movie selected
                    </Typography>
                    <Button 
                      variant="contained" 
                      color="primary"
                      onClick={() => setShowMovieBrowser(true)}
                    >
                      Browse Movies
                    </Button>
                  </Box>
                )}
                
                {/* Floating Reaction */}
                <AnimatePresence>
                  {showReaction && (
                    <motion.div
                      variants={reactionVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      style={{
                        position: 'absolute',
                        fontSize: '4rem',
                        zIndex: 10,
                      }}
                    >
                      {reaction}
                    </motion.div>
                  )}
                </AnimatePresence>
              </Box>
              
              {/* Video Controls */}
              <Box 
                sx={{ 
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton onClick={togglePlay} color="primary" disabled={!selectedMovie}>
                    {isPlaying ? <Pause /> : <PlayArrow />}
                  </IconButton>
                  <IconButton onClick={toggleMute} color="primary" disabled={!selectedMovie}>
                    {isMuted ? <VolumeMute /> : <VolumeUp />}
                  </IconButton>
                  <IconButton color="primary" disabled={!selectedMovie}>
                    <SkipNext />
                  </IconButton>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    startIcon={<Movie />}
                    onClick={() => setShowMovieBrowser(true)}
                    sx={{ ml: 2 }}
                  >
                    {selectedMovie ? 'Change Movie' : 'Select Movie'}
                  </Button>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Tooltip title="😀">
                    <IconButton onClick={() => showReactionBubble('😀')} size="small">
                      <Typography variant="h6">😀</Typography>
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="👍">
                    <IconButton onClick={() => showReactionBubble('👍')} size="small">
                      <Typography variant="h6">👍</Typography>
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="❤️">
                    <IconButton onClick={() => showReactionBubble('❤️')} size="small">
                      <Typography variant="h6">❤️</Typography>
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Fullscreen">
                    <IconButton color="primary">
                      <Fullscreen />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </Paper>
          </Grid>
          
          {/* Chat Panel */}
          {showChat && room && (
            <Grid item xs={12} md={4} lg={3}>
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.3 }}
              >
                <Paper 
                  elevation={6} 
                  sx={{ 
                    height: '100%', 
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: 'rgba(30, 41, 59, 0.8)',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <ChatPanel users={users} roomId={roomId} messages={messages} setMessages={setMessages} />
                </Paper>
              </motion.div>
            </Grid>
          )}
        </Grid>
        
        {/* Mobile Chat Toggle Button */}
        {isMobile && (
          <Zoom in={!showChat}>
            <Fab 
              color="primary" 
              aria-label="chat"
              onClick={() => setShowChat(true)}
              sx={{ position: 'fixed', bottom: 16, right: 16 }}
            >
              <ChatIcon />
            </Fab>
          </Zoom>
        )}
      </Container>
      
      {/* Users drawer */}
      <Drawer
        anchor="right"
        open={showUserList}
        onClose={() => setShowUserList(false)}
        PaperProps={{
          sx: {
            width: 300,
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            p: 2,
          }
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Viewers ({users.length})</Typography>
          <IconButton onClick={() => setShowUserList(false)}>
            <Close />
          </IconButton>
        </Box>
        <UserList users={users} />
        
        <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>Playlist</Typography>
        <PlaylistPanel playlist={room?.playlist || []} />
      </Drawer>
      
      {/* Movie Browser Dialog */}
      <Dialog 
        open={showMovieBrowser} 
        onClose={() => setShowMovieBrowser(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Select a Movie</Typography>
            <IconButton onClick={() => setShowMovieBrowser(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <MovieBrowser onSelectMovie={handleMovieSelect} roomId={roomId} />
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default Theater;