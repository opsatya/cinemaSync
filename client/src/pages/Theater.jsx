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
  Snackbar,
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
  Share as ShareIcon,
  Fullscreen,
  Settings,
  Close,
  Movie,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../context/AuthContext';
import { socket } from '../context/socket';
import { getRoomDetails, getUserDriveStreamUrl, setRoomVideo } from '../utils/api';
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
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  
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
  const joinTimeoutRef = useRef(null);
  
  // Movie selection state
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [showMovieBrowser, setShowMovieBrowser] = useState(false);
  const videoRef = useRef(null);

  // Derive presets from room.movie_source to avoid showing Browse UI when a video is already set
  const sourceType = String(room?.movie_source?.type || '').toLowerCase();
  const hasPresetDrive =
    (sourceType === 'google_drive' || sourceType === 'googledrive') &&
    Boolean(room?.movie_source?.video_id || room?.movie_source?.value);
  const hasPresetDirect =
    sourceType === 'directlink' && Boolean(room?.movie_source?.value);


  // FIXED: Helper to check if user can control playback (now includes host check)
  const canControlPlayback = useCallback(() => {
    return roomJoinStatus === 'joined' && currentUser && selectedMovie && isHost;
  }, [roomJoinStatus, currentUser, selectedMovie, isHost]);

  // Gate all emits until joined; optional ack callback
  const emitSafe = useCallback((event, payload, ack) => {
    if (roomJoinStatus !== 'joined') {
      console.warn('[Socket] Blocked emit until joined:', event);
      return;
    }
    try {
      if (typeof ack === 'function') {
        socket.emit(event, payload, ack);
      } else {
        socket.emit(event, payload);
      }
    } catch (e) {
      console.warn('[Socket] emit failed:', event, e);
    }
  }, [roomJoinStatus]);

  // FIXED: Helper to check if user is host (normalized string compare)
  const checkIfHost = useCallback((roomData, userId) => {
    if (!roomData || !userId) return false;
    return String(roomData.host_id) === String(userId);
  }, []);
  
  // Share room link helper using Web Share API with clipboard fallback
  const shareRoomLink = useCallback(async () => {
    try {
      const url = `${window.location.origin}/theater/${roomId}`;
      const title = room?.name || 'CinemaSync Room';
      const text = 'Join my CinemaSync room';
      if (navigator.share) {
        await navigator.share({ title, text, url });
        setShareMsg('Share dialog opened');
      } else {
        await navigator.clipboard.writeText(url);
        setShareMsg('Link copied to clipboard');
      }
      setShareOpen(true);
    } catch (e) {
      try {
        const fallbackUrl = `${window.location.origin}/theater/${roomId}`;
        await navigator.clipboard.writeText(fallbackUrl);
        setShareMsg('Link copied to clipboard');
        setShareOpen(true);
      } catch {
        setError('Failed to share/copy room link');
      }
    }
  }, [room?.name, roomId]);
  
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
        
        // CRITICAL FIX: Initialize selectedMovie from room.movie_source for Drive or Direct Link
        if (roomDetails.movie_source) {
          const ms = roomDetails.movie_source || {};
          const type = String(ms.type || '').toLowerCase();
          const fileId = ms.video_id || ms.value || null;
          const hasDirectUrl = typeof ms.value === 'string' && /^https?:\/\//i.test(ms.value || '');

          console.log('🧩 [Theater] movie_source from room:', {
            type,
            valuePreview: typeof ms.value === 'string' ? ms.value.slice(0, 64) : ms.value,
            video_id: ms.video_id,
            video_name: ms.video_name,
          });

          if (type === 'googledrive' || type === 'google_drive') {
            if (fileId) {
              setSelectedMovie({
                kind: 'drive',
                id: fileId,
                name: ms.video_name || 'Google Drive Video'
              });
              console.log('✅ [Theater] Initialized selectedMovie from Drive id/value.');
            } else {
              console.warn('⚠️ [Theater] Drive source provided but missing video_id/value.');
            }
          } else if (type === 'directlink') {
            if (hasDirectUrl) {
              setSelectedMovie({
                kind: 'direct',
                url: ms.value,
                name: 'Direct Video'
              });
              console.log('✅ [Theater] Initialized selectedMovie from Direct Link.');
            } else {
              console.warn('⚠️ [Theater] Direct link source missing a valid URL.');
            }
          }
          // For 'uploadlater' or unknown types, selectedMovie remains null (correct)
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
    socket.emit('join_room', payload, (resp) => {
      // Prefer ack to avoid generic 'error' event spam
      if (resp && resp.error) {
        setJoinError(resp.error);
        setShowPasswordDialog(true);
        setRoomJoinStatus('failed');
        joinInProgress.current = false;
      }
    });
    // Safety timeout to prevent getting stuck in "joining"
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
    }
    joinTimeoutRef.current = setTimeout(() => {
      if (joinInProgress.current) {
        console.warn('⏱️ [Theater] Join timed out; resetting state');
        setRoomJoinStatus('failed');
        joinInProgress.current = false;
        setError('Joining the room timed out. Please retry or check the password/network.');
      }
      joinTimeoutRef.current = null;
    }, 10000);
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

      // Initialize selectedMovie from room data if available (covers Drive and Direct Link)
      try {
        const ms = data.room?.movie_source;
        const t = String(ms?.type || '').toLowerCase();
        const fileId = ms?.video_id || ms?.value || null;
        const directUrl = typeof ms?.value === 'string' ? ms.value : null;

        if (t === 'googledrive' || t === 'google_drive') {
          if (fileId) {
            setSelectedMovie({
              kind: 'drive',
              id: fileId,
              name: ms?.video_name || 'Google Drive Video'
            });
            console.log('✅ [Theater] onRoomJoined initialized selectedMovie from Drive.');
          } else {
            console.warn('⚠️ [Theater] onRoomJoined Drive source present but missing file id.');
          }
        } else if (t === 'directlink') {
          if (directUrl) {
            setSelectedMovie({
              kind: 'direct',
              url: directUrl,
              name: 'Direct Video'
            });
            console.log('✅ [Theater] onRoomJoined initialized selectedMovie from Direct Link.');
          } else {
            console.warn('⚠️ [Theater] onRoomJoined Direct Link source missing URL.');
          }
        }
      } catch (e) {
        console.warn('⚠️ [Theater] Failed to initialize selectedMovie on room_joined:', e);
      }
      
      // FIXED: Update join status
      setRoomJoinStatus('joined');
      joinInProgress.current = false;
      // Clear any pending join timeout
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
      
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

    // When host changes the movie, sync all participants
    const onVideoChanged = (payload) => {
      try {
        const ms = payload?.movie_source || {};
        const t = String(ms?.type || '').toLowerCase();
        if (t === 'googledrive' || t === 'google_drive') {
          if (ms.video_id) {
            setSelectedMovie({ kind: 'drive', id: ms.video_id, name: ms.video_name || 'Google Drive Video' });
          }
        } else if (t === 'directlink' && ms.value) {
          setSelectedMovie({ kind: 'direct', url: ms.value, name: 'Direct Video' });
        }
        setRoom((prev) => ({ ...(prev || {}), movie_source: ms }));
        console.log('🔄 [Theater] Applied video_changed:', ms);
      } catch (e) {
        console.warn('⚠️ [Theater] Failed to apply video_changed:', e);
      }
    };

    // FIXED: Enhanced error handling
    const onServerError = (err) => {
      const msg = err?.message || 'Unknown server error';
      console.error('❌ [Socket] Server error:', msg);
      // Clear any pending join timeout on server error
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
      
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
    socket.on('video_changed', onVideoChanged);
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
      socket.off('video_changed', onVideoChanged);
      socket.off('error', onServerError);
      socket.off('connect_error', onConnectError);
      
      if (connectErrorTimer.current) {
        clearTimeout(connectErrorTimer.current);
        connectErrorTimer.current = null;
      }
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
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

  // Sync selectedMovie whenever room.movie_source changes (covers navigation from My Rooms)
  useEffect(() => {
    try {
      const ms = room?.movie_source;
      if (!ms) return;
      const t = String(ms.type || '').toLowerCase();
      if (t === 'googledrive' || t === 'google_drive') {
        const id = ms.video_id || ms.value;
        if (id && (!selectedMovie || selectedMovie.kind !== 'drive' || selectedMovie.id !== id)) {
          setSelectedMovie({
            kind: 'drive',
            id,
            name: ms.video_name || 'Google Drive Video'
          });
        }
      } else if (t === 'directlink') {
        const url = ms.value;
        if (url && (!selectedMovie || selectedMovie.kind !== 'direct' || selectedMovie.url !== url)) {
          setSelectedMovie({
            kind: 'direct',
            url,
            name: 'Direct Video'
          });
        }
      }
    } catch (e) {
      // no-op
    }
  }, [room?.movie_source]);

  // Keyboard shortcuts: Space toggles play/pause when joined and a movie is selected
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      const isTyping = tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable);
      if (isTyping) return;

      if (e.code === 'Space' || e.key === ' ') {
        if (roomJoinStatus === 'joined' && selectedMovie) {
          e.preventDefault();
          if (!canControlPlayback()) return;
          const newPlayState = !isPlaying;
          setIsPlaying(newPlayState);
          const payload = {
            room_id: roomId,
            user_id: currentUser?.uid,
            playback_state: {
              is_playing: !isPlaying,
              current_time: currentTime
            },
          };
          emitSafe('update_playback', payload, (resp) => {
            if (resp && resp.error) {
              console.warn('Playback failed:', resp.error);
              setError(resp.error);
            }
          });
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [roomJoinStatus, selectedMovie, canControlPlayback, isPlaying, currentTime, roomId, currentUser?.uid, emitSafe]);

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
    const payload = {
      room_id: roomId,
      user_id: currentUser.uid,
      playback_state: { is_playing: !isPlaying, current_time: currentTime }
    };
    console.log('[DEBUG] Emitting update_playback:', { ...payload, isHost });
    emitSafe('update_playback', payload, (resp) => {
      if (resp && resp.error) {
        console.warn('Playback failed:', resp.error);
        setError(resp.error);
      }
    });
  };
  
  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };
  
  // Handle movie selection (host triggers backend update so everyone syncs)
  const handleMovieSelect = async (movie) => {
    try {
      if (!isHost) {
        setError('Only the host can change the movie.');
        return;
      }
      console.log('🎬 [Theater] Movie selected:', movie);
      // Expecting Google Drive movie from MovieBrowser: { id, name, ... }
      if (!movie?.id) {
        setError('Invalid movie selection.');
        return;
      }
      // Update backend, which will broadcast to all via socket and return updated room
      const updatedRoom = await setRoomVideo(roomId, { video_id: movie.id, video_name: movie.name || '' }, backendToken);
      setRoom(updatedRoom || room);
      setSelectedMovie({ kind: 'drive', id: movie.id, name: movie.name || 'Google Drive Video' });
      setShowMovieBrowser(false);
      // Reset playback state locally
      setIsPlaying(false);
      setCurrentTime(0);
    } catch (e) {
      console.error('❌ [Theater] Failed to set room video:', e);
      setError(e.message || 'Failed to set room video');
    }
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
                  <Tooltip title="Share room link">
                    <IconButton color="primary" onClick={shareRoomLink}>
                      <ShareIcon />
                    </IconButton>
                  </Tooltip>
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
                    ref={videoRef}
                    isPlaying={isPlaying}
                    isMuted={isMuted}
                    fileId={
                      selectedMovie?.kind
                        ? (selectedMovie.kind === 'drive' ? selectedMovie.id : null)
                        : (selectedMovie?.id || null)
                    }
                    src={
                      selectedMovie?.kind
                        ? (selectedMovie.kind === 'drive'
                            ? getUserDriveStreamUrl(selectedMovie.id, currentUser?.uid)
                            : selectedMovie.kind === 'youtube'
                              ? `https://www.youtube.com/embed/${selectedMovie.id}`
                              : selectedMovie.url)
                        : (selectedMovie?.id
                            ? getUserDriveStreamUrl(selectedMovie.id, currentUser?.uid)
                            : null)
                    }
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
                    {isHost && !hasPresetDrive && !hasPresetDirect && (
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => setShowMovieBrowser(true)}
                        disabled={roomJoinStatus !== 'joined'}
                      >
                        Browse Movies
                      </Button>
                    )}
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
                  {isHost && !(selectedMovie?.kind === 'direct' || String(room?.movie_source?.type || '').toLowerCase() === 'directlink') && (
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
                  )}
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
                      <IconButton
                        color="primary"
                        disabled={!selectedMovie}
                        onClick={() => {
                          try {
                            const api = videoRef?.current;
                            if (!api) return;
                            if (api.isFullscreen()) {
                              api.exitFullscreen();
                            } else {
                              api.enterFullscreen();
                            }
                          } catch (e) {
                            console.warn('Fullscreen toggle failed:', e);
                          }
                        }}
                      >
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
      <Snackbar
        open={shareOpen}
        autoHideDuration={2000}
        onClose={() => setShareOpen(false)}
        message={shareMsg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </motion.div>
  );
};

export default Theater;
