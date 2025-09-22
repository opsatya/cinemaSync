import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Box, Typography, CircularProgress, Button } from '@mui/material';
import { motion } from 'framer-motion';
import { getDirectStreamUrl } from '../../utils/api';

const VideoPlayer = forwardRef(({ isPlaying, isMuted, fileId = null, src = null, currentTime, onTimeUpdate }, ref) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Prefer an explicit src when provided (e.g., Google Drive per-user URL); otherwise fall back to backend stream by fileId
  const streamUrl = src ? src : (fileId ? getDirectStreamUrl(fileId) : null);
  // Detect YouTube sources to render iframe instead of HTML5 video
  const isYouTubeSrc = typeof streamUrl === 'string' && /(?:youtube\.com|youtu\.be)/i.test(streamUrl);
  // Provide a stable origin for YouTube IFrame API to avoid "origins don't match" errors
  const pageOrigin = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : '';
  const ytSrc = isYouTubeSrc
    ? `${streamUrl}${streamUrl.includes('?') ? '&' : '?'}enablejsapi=1&rel=0${pageOrigin ? `&origin=${encodeURIComponent(pageOrigin)}` : ''}`
    : null;

  // Expose fullscreen controls to parent
  useImperativeHandle(ref, () => ({
    async enterFullscreen() {
      try {
        const el = containerRef.current;
        if (!el) return;
        if (document.fullscreenElement) return;
        if (el.requestFullscreen) await el.requestFullscreen();
      } catch (e) {
        console.warn('enterFullscreen failed:', e);
      }
    },
    async exitFullscreen() {
      try {
        if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
      } catch (e) {
        console.warn('exitFullscreen failed:', e);
      }
    },
    isFullscreen() {
      return Boolean(document.fullscreenElement);
    }
  }), []);

  // Effect to handle play/pause
  useEffect(() => {
    if (videoRef.current && videoRef.current.tagName === 'VIDEO') {
      if (isPlaying) {
        setLoading(true);
        videoRef.current.play().catch(err => {
          console.error('Error playing video:', err);
          setError('Failed to play video. Please try again.');
        }).finally(() => {
          setLoading(false);
        });
      } else {
        videoRef.current.pause();
      }
    }
    // Note: YouTube iframe playback is not controlled via HTML5 video API.
  }, [isPlaying]);

  // Effect to handle mute/unmute
  useEffect(() => {
    if (videoRef.current && videoRef.current.tagName === 'VIDEO') {
      videoRef.current.muted = isMuted;
    }
    // Note: Muting a YouTube iframe requires the YouTube IFrame API; not handled here.
  }, [isMuted]);

  // Keep currentTime in sync when provided
  useEffect(() => {
    try {
      if (videoRef.current && typeof currentTime === 'number' && !Number.isNaN(currentTime)) {
        // Avoid excessive seeks; only set if drift is > 0.5s
        const drift = Math.abs((videoRef.current.currentTime || 0) - currentTime);
        if (drift > 0.5) {
          videoRef.current.currentTime = currentTime;
        }
      }
    } catch (_) {}
  }, [currentTime]);
  
  // Handle video errors
  const handleVideoError = (e) => {
    console.error('Video error:', e);
    setError('Error loading video. Please check if the file is accessible.');
    setLoading(false);
  };

  // Film reel animation for loading state
  const FilmReelLoading = () => (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <CircularProgress color="secondary" size={60} thickness={4} />
    </motion.div>
  );

  return (
    <Box
      ref={containerRef}
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
      {streamUrl ? (
        <>
          {loading && !isYouTubeSrc && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                zIndex: 2,
              }}
            >
              <FilmReelLoading />
            </Box>
          )}
          
          {error && !isYouTubeSrc && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                zIndex: 3,
                p: 3,
              }}
            >
              <Typography variant="h6" color="error" gutterBottom>
                {error}
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  setError(null);
                  if (videoRef.current && videoRef.current.tagName === 'VIDEO') {
                    videoRef.current.load();
                  }
                }}
                sx={{ mt: 2 }}
              >
                Retry
              </Button>
            </Box>
          )}

          {isYouTubeSrc ? (
            <iframe
              title="YouTube Player"
              src={ytSrc}
              style={{ width: '100%', height: '100%', border: 0 }}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              ref={videoRef}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
              controls={false}
              playsInline
              onError={handleVideoError}
              onTimeUpdate={(e) => {
                try {
                  if (typeof onTimeUpdate === 'function') {
                    onTimeUpdate(e.currentTarget.currentTime || 0);
                  }
                } catch (_) {}
              }}
            >
              {/* Let the browser infer MIME type to support various formats */}
              <source src={streamUrl} />
              Your browser does not support the video tag.
            </video>
          )}
        </>
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
});

export default VideoPlayer;
