import { useState, useEffect, useCallback, useRef } from 'react';
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
  TextField,
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
  const { currentUser, backendToken } = useAuth();
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
  
  // FIXED: Better joining state management
  const [roomJoinStatus, setRoomJoinStatus] = useState('initial'); // 'initial', 'joining', 'joined', 'failed'
  const [isHost, setIsHost] = useState(false);
  
  // Private room join state
  const [passwordInput, setPasswordInput] = useState('');
  const passwordRef = useRef('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [joinError, setJoinError] = useState('');
  const connectErrorTimer = useRef(null);
  const reconnectAttempts = useRef(0);
  const joinInProgress = useRef(false);
  
  // Movie selection state
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [showMovieBrowser, setShowMovieBrowser] = useState(false);

  // FIXED: Helper to check if user can control playback (now includes host check)
  const canControlPlayback = useCallback(() => {
    return roomJoinStatus === 'joined' && currentUser && selectedMovie && isHost;
  }, [roomJoinStatus, currentUser, selectedMovie, isHost]);

  // FIXED: Helper to check if user is host
  const checkIfHost = useCallback((roomData, userId) => {
    return roomData?.host_id === userId;
  }, []);
  
  // Fetch room details on mount
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        setLoading(true);
        console.log('🏠 [Theater] Fetching room details for:', roomId);
        
        const roomDetails = await getRoomDetails(roomId);
        console.log('🏠 [Theater] Room details loaded:', roomDetails);
        
        setRoom(roomDetails);
        setUsers(roomDetails.participants || []);
        setIsHost(checkIfHost(roomDetails, currentUser?.uid));

        // Debug log for host detection
        console.log('[DEBUG] currentUser.uid:', currentUser?.uid);
        console.log('[DEBUG] room.host_id:', roomDetails?.host_id);
        console.log('[DEBUG] isHost:', checkIfHost(roomDetails, currentUser?.uid));
        
        if (roomDetails.movie_source && roomDetails.movie_source.type === 'googleDrive' && roomDetails.movie_source.value) {
          setSelectedMovie({ id: roomDetails.movie_source.value, name: 'Movie' });
        }
        
        // Check if room requires password
        if ((roomDetails.is_private || roomDetails.password) && roomJoinStatus !== 'joined') {
          setShowPasswordDialog(true);
        }
      } catch (err) {
        console.error('❌ [Theater] Failed to fetch room details:', err);
        setError(err.message || 'Could not load room.');
      } finally {
        setLoading(false);
      }
    };
    
    if (roomId && currentUser) {
      fetchRoom();
    }
  }, [roomId, currentUser?.uid, checkIfHost]);

  const showReactionBubble = useCallback((emoji) => {
    setReaction(emoji);
    setShowReaction(true);
    setTimeout(() => setShowReaction(false), 2000);
  }, []);

  // FIXED: Better join attempt logic
  const attemptJoin = useCallback(() => {
    if (!socket.connected || !room || !currentUser) {
      console.log('⏸️ [Theater] Cannot join: missing requirements', {
        connected: socket.connected,
        hasRoom: !!room,
        hasUser: !!currentUser
      });
      return;
    }
    
    if (roomJoinStatus === 'joined' || joinInProgress.current) {
      console.log('⏸️ [Theater] Already joined or joining in progress');
      return;
    }

    const payload = { room_id: roomId, user_id: currentUser.uid };
    const enteredPassword = (passwordRef.current || '').trim();
    const requiresPassword = Boolean(room?.is_private) || Boolean(room?.password) || enteredPassword.length > 0;
    
    if (requiresPassword) {
      if (!enteredPassword) {
        console.log('🔒 [Theater] Password required, showing dialog');
        setShowPasswordDialog(true);
        return;
      }
      payload.password = enteredPassword;
    }
    
    console.log('📡 [Theater] Attempting to join room:', { ...payload, password: payload.password ? '***' : undefined });
    setRoomJoinStatus('joining');
    joinInProgress.current = true;
    socket.emit('join_room', payload);
  }, [room, currentUser, roomId]);

  // Socket.IO connection and event handling
  useEffect(() => {
    if (!roomId || !currentUser) return;

    // Attach auth for backend validation if available
    if (backendToken) {
      socket.auth = { token: backendToken };
      console.log('🔐 [Socket] Auth token attached for connection.');
    }

    // FIXED: Enhanced event handlers with better state management
    const onConnect = () => {
      console.log('🔌 [Socket] Connected. Will attempt room join...');
      setError(null);
      if (connectErrorTimer.current) {
        clearTimeout(connectErrorTimer.current);
        connectErrorTimer.current = null;
      }
      attemptJoin();
    };

    const onRoomJoined = (data) => {
      console.log('✅ [Socket] Room joined successfully:', data);
      setJoinError('');
      setShowPasswordDialog(false);
      setRoom(data.room);
      setUsers(data.room.participants);
      setIsPlaying(data.room.playback_state.is_playing);
      setCurrentTime(data.room.playback_state.current_time || 0);
      setIsHost(checkIfHost(data.room, currentUser?.uid));
      
      // FIXED: Update join status
      setRoomJoinStatus('joined');
      joinInProgress.current = false;
      
      console.log('🎭 [Theater] User role:', {
        isHost: checkIfHost(data.room, currentUser?.uid),
        canControl: checkIfHost(data.room, currentUser?.uid)
      });
    };

    const onUserJoined = (data) => {
      console.log('👤 [Socket] User joined:', data);
      setUsers(data.participants);
    };

    const onUserLeft = (data) => {
      console.log('👋 [Socket] User left:', data);
      setUsers(data.participants);
    };

    const onPlaybackUpdated = (data) => {
      console.log('▶️ [Socket] Playback updated:', data.playback_state);
      setIsPlaying(data.playback_state.is_playing);
      setCurrentTime(data.playback_state.current_time || 0);
    };

    const onNewChat = (msg) => {
      console.log('💬 [Socket] New chat message:', msg);
      setMessages((prev) => [...prev, msg]);
    };

    const onNewReaction = (data) => {
      console.log('😀 [Socket] New reaction:', data);
      showReactionBubble(data.reaction);
    };

    // FIXED: Enhanced error handling
    const onServerError = (err) => {
      const msg = err?.message || 'Unknown server error';
      console.error('❌ [Socket] Server error:', msg);
      
      if (/not in room/i.test(msg)) {
        console.warn('🔄 [Socket] User not in room, resetting join status');
        setRoomJoinStatus('failed');
        joinInProgress.current = false;
        setError('You need to join the room first. Please refresh the page.');
      } else if (/invalid password/i.test(msg)) {
        setJoinError('Invalid password. Please try again.');
        setShowPasswordDialog(true);
        setRoomJoinStatus('failed');
        joinInProgress.current = false;
      } else {
        setError(`Server error: ${msg}`);
      }
    };

    const onConnectError = (err) => {
      if (socket.connected) {
        console.debug('Socket connect_error while connected (ignored):', err?.message || err);
        return;
      }
      const msg = (err && (err.message || err.description)) || 'Unknown error';
      if (connectErrorTimer.current) clearTimeout(connectErrorTimer.current);
      connectErrorTimer.current = setTimeout(() => {
        if (!socket.connected && reconnectAttempts.current >= 3) {
          setError(`Socket connect error: ${msg}`);
        }
      }, 4000);
    };

    // Register all socket event listeners
    socket.on('connect', onConnect);
    socket.on('room_joined', onRoomJoined);
    socket.on('user_joined', onUserJoined);
    socket.on('user_left', onUserLeft);
    socket.on('playback_updated', onPlaybackUpdated);
    socket.on('new_chat_message', onNewChat);
    socket.on('new_reaction', onNewReaction);
    socket.on('error', onServerError);
    socket.on('connect_error', onConnectError);

    // Connect if not already connected
    const engine = socket.io?.engine;
    const opening = socket.connected ? false : (engine?.readyState === 'opening');
    if (!socket.connected && !opening) {
      console.log('🔁 [Socket] Initiating connection...');
      socket.connect();
    }

    return () => {
      // Cleanup: leave room and remove listeners
      if (currentUser && roomJoinStatus === 'joined') {
        console.log('🚪 [Socket] Leaving room on cleanup');
        socket.emit('leave_room', { room_id: roomId, user_id: currentUser.uid });
      }
      
      socket.off('connect', onConnect);
      socket.off('room_joined', onRoomJoined);
      socket.off('user_joined', onUserJoined);
      socket.off('user_left', onUserLeft);
      socket.off('playback_updated', onPlaybackUpdated);
      socket.off('new_chat_message', onNewChat);
      socket.off('new_reaction', onNewReaction);
      socket.off('error', onServerError);
      socket.off('connect_error', onConnectError);
      
      if (connectErrorTimer.current) {
        clearTimeout(connectErrorTimer.current);
        connectErrorTimer.current = null;
      }
      reconnectAttempts.current = 0;
      joinInProgress.current = false;
    };
  }, [roomId, currentUser?.uid, backendToken, attemptJoin, showReactionBubble, checkIfHost]);

  // Re-attempt join when conditions are met
  useEffect(() => {
    if (room && roomJoinStatus === 'initial') {
      attemptJoin();
    }
  }, [room, roomJoinStatus, attemptJoin]);

  // FIXED: Enhanced toggle play with proper validation
  const togglePlay = () => {
    if (!canControlPlayback()) {
      console.warn('❌ [Theater] Cannot control playback:', {
        roomJoinStatus,
        hasUser: !!currentUser,
        hasMovie: !!selectedMovie,
        isHost
      });
      
      if (roomJoinStatus !== 'joined') {
        setError('You must join the room first before controlling playback.');
      } else if (!selectedMovie) {
        setError('Please select a movie first.');
      } else if (!isHost) {
        setError('Only the host can control playback.');
      }
      return;
    }

    const newPlayState = !isPlaying;
    console.log('▶️ [Theater] Toggling playback:', { 
      from: isPlaying, 
      to: newPlayState,
      currentTime 
    });

    // Optimistically update UI
    setIsPlaying(newPlayState);
    
    // Send to server
    console.log('[DEBUG] Emitting update_playback:', {
      room_id: roomId,
      user_id: currentUser.uid,
      isHost,
      playback_state: { is_playing: !isPlaying, current_time: currentTime }
    });
    socket.emit('update_playback', {
      room_id: roomId,
      user_id: currentUser.uid,
      playback_state: { 
        is_playing: !isPlaying, 
        current_time: currentTime 
      },
    });
  };
  
  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };
  
  // Handle movie selection
  const handleMovieSelect = (movie) => {
    console.log('🎬 [Theater] Movie selected:', movie);
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

  // Loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '90vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={() => window.location.reload()}>
            Reload
          </Button>
        }>
          {error}
        </Alert>
      </Container>
    );
  }

  // Private room gate - show status plus password dialog when required
  if (room && (room.is_private || room.password) && roomJoinStatus !== 'joined') {
    return (
      <>
        <Container sx={{ mt: 4 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            This room is private. {roomJoinStatus === 'joining' ? 'Joining...' : 'Enter the password to join.'}
          </Alert>
          {roomJoinStatus === 'joining' && (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              <Typography>Joining room...</Typography>
            </Box>
          )}
        </Container>

        {/* Private Room Password Dialog */}
        <Dialog
          open={showPasswordDialog}
          onClose={() => setShowPasswordDialog(false)}
        >
          <DialogTitle>Enter Room Password</DialogTitle>
          <DialogContent>
            {joinError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {joinError}
              </Alert>
            )}
            <TextField
              autoFocus
              margin="dense"
              label="Password"
              type="password"
              fullWidth
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                passwordRef.current = e.target.value;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setJoinError('');
                  attemptJoin();
                }
              }}
              disabled={roomJoinStatus === 'joining'}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowPasswordDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => {
                setJoinError('');
                attemptJoin();
              }}
              disabled={roomJoinStatus === 'joining'}
            >
              {roomJoinStatus === 'joining' ? 'Joining...' : 'Join'}
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  // Main theater interface
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <Container maxWidth="xl" sx={{ height: '100%' }}>
        {/* Room Status Indicator */}
        <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: roomJoinStatus === 'joined' ? 'success.main' : 'warning.main'
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {roomJoinStatus === 'joined' ? 'Connected to room' : 'Connecting...'}
            {isHost && ' • Host'}
          </Typography>
        </Box>

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
                    currentTime={currentTime}
                    onTimeUpdate={setCurrentTime}
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
                      disabled={roomJoinStatus !== 'joined'}
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
                  {/* FIXED: Wrapped disabled button with span for tooltip */}
                  <Tooltip title={canControlPlayback() ? (isPlaying ? 'Pause' : 'Play') : isHost ? 'Select a movie first' : 'Only host can control playback'}>
                    <span>
                      <IconButton 
                        onClick={togglePlay} 
                        color="primary" 
                        disabled={!canControlPlayback()}
                      >
                        {isPlaying ? <Pause /> : <PlayArrow />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={isMuted ? 'Unmute' : 'Mute'}>
                    <span>
                      <IconButton onClick={toggleMute} color="primary" disabled={!selectedMovie}>
                        {isMuted ? <VolumeMute /> : <VolumeUp />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Next">
                    <span>
                      <IconButton color="primary" disabled={!selectedMovie}>
                        <SkipNext />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    startIcon={<Movie />}
                    onClick={() => setShowMovieBrowser(true)}
                    sx={{ ml: 2 }}
                    disabled={roomJoinStatus !== 'joined'}
                  >
                    {selectedMovie ? 'Change Movie' : 'Select Movie'}
                  </Button>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Tooltip title="😀">
                    <span>
                      <IconButton 
                        onClick={() => showReactionBubble('😀')} 
                        size="small"
                        disabled={roomJoinStatus !== 'joined'}
                      >
                        <Typography variant="h6">😀</Typography>
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="👍">
                    <span>
                      <IconButton 
                        onClick={() => showReactionBubble('👍')} 
                        size="small"
                        disabled={roomJoinStatus !== 'joined'}
                      >
                        <Typography variant="h6">👍</Typography>
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="❤️">
                    <span>
                      <IconButton 
                        onClick={() => showReactionBubble('❤️')} 
                        size="small"
                        disabled={roomJoinStatus !== 'joined'}
                      >
                        <Typography variant="h6">❤️</Typography>
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Fullscreen">
                    <span>
                      <IconButton color="primary" disabled={!selectedMovie}>
                        <Fullscreen />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </Box>
            </Paper>
          </Grid>
          
          {/* Chat Panel */}
          {showChat && room && roomJoinStatus === 'joined' && (
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
                  <ChatPanel 
                    users={users} 
                    roomId={roomId} 
                    messages={messages} 
                    setMessages={setMessages} 
                  />
                </Paper>
              </motion.div>
            </Grid>
          )}
        </Grid>
        
        {/* Mobile Chat Toggle Button */}
        {isMobile && roomJoinStatus === 'joined' && (
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

      {/* Private Room Password Dialog */}
      <Dialog
        open={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
      >
        <DialogTitle>Enter Room Password</DialogTitle>
        <DialogContent>
          {joinError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {joinError}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            value={passwordInput}
            onChange={(e) => { 
              setPasswordInput(e.target.value); 
              passwordRef.current = e.target.value; 
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setJoinError('');
                attemptJoin();
              }
            }}
            disabled={roomJoinStatus === 'joining'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPasswordDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              setJoinError('');
              attemptJoin();
            }}
            disabled={roomJoinStatus === 'joining'}
          >
            {roomJoinStatus === 'joining' ? 'Joining...' : 'Join'}
          </Button>
        </DialogActions>
      </Dialog>
    </motion.div>
  );
};

export default Theater;
