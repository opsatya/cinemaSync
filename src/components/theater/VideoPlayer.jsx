import { useRef, useEffect } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';

const VideoPlayer = ({ isPlaying, isMuted, src = null }) => {
  const videoRef = useRef(null);
  
  // Effect to handle play/pause
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(err => {
          console.error('Error playing video:', err);
        });
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);
  
  // Effect to handle mute/unmute
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Film reel animation for loading state
  const FilmReelLoading = () => (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <CircularProgress color="secondary" size={60} thickness={4} />
      <Typography variant="body1" sx={{ mt: 2, color: 'text.secondary' }}>
        Loading video...
      </Typography>
    </motion.div>
  );

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '8px',
        bgcolor: '#000',
      }}
    >
      {src ? (
        <video
          ref={videoRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
          controls={false}
          playsInline
        >
          <source src={src} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
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
          <FilmReelLoading />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <Typography variant="h6" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
              Waiting for video...<br />
              <Typography variant="body2" sx={{ mt: 1 }}>
                Add a movie from Google Drive to get started
              </Typography>
            </Typography>
          </motion.div>
        </Box>
      )}
      
      {/* Virtual theater environment overlay */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '15%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      
      {/* Seats visualization at the bottom */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '40px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: 1,
          pb: 1,
          zIndex: 2,
        }}
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index, duration: 0.3 }}
          >
            <Box
              sx={{
                width: '20px',
                height: '8px',
                backgroundColor: index === 2 ? 'primary.main' : 'rgba(255,255,255,0.3)',
                borderTopLeftRadius: '3px',
                borderTopRightRadius: '3px',
              }}
            />
          </motion.div>
        ))}
      </Box>
    </Box>
  );
};

export default VideoPlayer;
