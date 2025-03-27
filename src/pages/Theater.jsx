import { useState, useEffect } from 'react';
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
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

// Import components
import VideoPlayer from '../components/theater/VideoPlayer';
import ChatPanel from '../components/chat/ChatPanel';
import UserList from '../components/theater/UserList';
import PlaylistPanel from '../components/playlist/PlaylistPanel';

const Theater = () => {
  const { roomId } = useParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // State for the theater
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showChat, setShowChat] = useState(!isMobile);
  const [showUserList, setShowUserList] = useState(false);
  const [showReaction, setShowReaction] = useState(false);
  const [reaction, setReaction] = useState('');
  
  // Mock data for demonstration
  const mockUsers = [
    { id: 1, name: 'Alex', avatar: 'A', online: true },
    { id: 2, name: 'Taylor', avatar: 'T', online: true },
    { id: 3, name: 'Jordan', avatar: 'J', online: true },
    { id: 4, name: 'Casey', avatar: 'C', online: false },
  ];
  
  const mockPlaylist = [
    { id: 1, title: 'Inception', duration: '2h 28m', thumbnail: 'inception.jpg' },
    { id: 2, title: 'The Matrix', duration: '2h 16m', thumbnail: 'matrix.jpg' },
    { id: 3, title: 'Interstellar', duration: '2h 49m', thumbnail: 'interstellar.jpg' },
  ];
  
  // Toggle play/pause
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    // In a real app, this would sync with other users
  };
  
  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };
  
  // Show a reaction
  const showReactionBubble = (emoji) => {
    setReaction(emoji);
    setShowReaction(true);
    setTimeout(() => setShowReaction(false), 2000);
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
                <Typography variant="h5" component="h1">
                  Room: {roomId}
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
                <VideoPlayer isPlaying={isPlaying} isMuted={isMuted} />
                
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
                  <IconButton onClick={togglePlay} color="primary">
                    {isPlaying ? <Pause /> : <PlayArrow />}
                  </IconButton>
                  <IconButton onClick={toggleMute} color="primary">
                    {isMuted ? <VolumeMute /> : <VolumeUp />}
                  </IconButton>
                  <IconButton color="primary">
                    <SkipNext />
                  </IconButton>
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
                  <Tooltip title="🔥">
                    <IconButton onClick={() => showReactionBubble('🔥')} size="small">
                      <Typography variant="h6">🔥</Typography>
                    </IconButton>
                  </Tooltip>
                </Box>
                
                <IconButton color="primary">
                  <Fullscreen />
                </IconButton>
              </Box>
            </Paper>
          </Grid>
          
          {/* Chat Panel - Responsive */}
          {(showChat || !isMobile) && (
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
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    background: 'rgba(30, 41, 59, 0.8)',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <ChatPanel users={mockUsers} roomId={roomId} />
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
        
        {/* Users Drawer */}
        <Drawer
          anchor="right"
          open={showUserList}
          onClose={() => setShowUserList(false)}
          PaperProps={{
            sx: {
              width: 280,
              background: theme.palette.background.paper,
              p: 2,
            },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Viewers ({mockUsers.length})</Typography>
            <IconButton onClick={() => setShowUserList(false)}>
              <Close />
            </IconButton>
          </Box>
          <UserList users={mockUsers} />
          
          <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>Playlist</Typography>
          <PlaylistPanel playlist={mockPlaylist} />
        </Drawer>
      </Container>
    </motion.div>
  );
};

export default Theater;
