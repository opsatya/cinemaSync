import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  CardMedia,
  TextField,
  useTheme,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import { PlayArrow, Add, Group, Movie } from '@mui/icons-material';
import { motion } from 'framer-motion';

const Home = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');

  const handleJoinRoom = () => {
    if (roomCode.trim()) {
      navigate(`/theater/${roomCode}`);
    }
  };

  const handleCreateRoom = () => {
    // In a real app, this would create a room and then navigate
    navigate('/create-room');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
    },
  };

  const features = [
    {
      icon: <Group fontSize="large" />,
      title: 'Watch Together',
      description: 'Enjoy movies in perfect sync with friends, no matter where they are.',
    },
    {
      icon: <Movie fontSize="large" />,
      title: 'Share Movies',
      description: 'Easily share movies from Google Drive with your watching party.',
    },
    {
      icon: <PlayArrow fontSize="large" />,
      title: 'Real-time Sync',
      description: 'Playback controls are synchronized across all viewers in real-time.',
    },
  ];

  return (
    <Box sx={{ width: '100%', overflow: 'hidden' }}>
      {/* Hero Section */}
      <Box
        sx={{
          height: { xs: 'auto', md: '70vh' },
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 8,
          mt: { xs: 0, md: -4 },
        }}
      >
        <Box sx={{ width: { xs: '100%', md: '50%' }, mb: { xs: 4, md: 0 } }}>
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Typography
              variant="h2"
              component="h1"
              gutterBottom
              sx={{
                fontWeight: 800,
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Watch Movies Together, Anywhere
            </Typography>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <Typography variant="h6" color="textSecondary" paragraph sx={{ mb: 4 }}>
              CinemaSync brings the movie theater experience to you and your friends,
              synchronizing playback so everyone watches together in perfect harmony.
            </Typography>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Enter room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                InputProps={{
                  sx: {
                    borderRadius: '50px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  },
                }}
              />
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={handleJoinRoom}
                sx={{
                  borderRadius: '50px',
                  px: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                Join Room
              </Button>
            </Box>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Button
              variant="outlined"
              color="secondary"
              size="large"
              startIcon={<Add />}
              onClick={handleCreateRoom}
              sx={{ mt: 2, borderRadius: '50px', px: 4 }}
            >
              Create New Room
            </Button>
          </motion.div>
        </Box>

        <Box
          sx={{
            width: { xs: '100%', md: '45%' },
            position: 'relative',
            height: { xs: '300px', md: '400px' },
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 20px 80px rgba(0, 0, 0, 0.5)',
            }}
          >
            <Box
              sx={{
                width: '100%',
                height: '100%',
                backgroundColor: theme.palette.background.paper,
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              }}
            >
              <Typography variant="h4" sx={{ color: 'rgba(255,255,255,0.1)' }}>
                Theater Preview
              </Typography>
              {/* In a real app, this would be a preview of the theater UI */}
            </Box>
          </motion.div>
        </Box>
      </Box>

      {/* Features Section */}
      <Typography
        variant="h3"
        component="h2"
        align="center"
        gutterBottom
        sx={{ mb: 6 }}
      >
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          The Ultimate Movie Night
        </motion.span>
      </Typography>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid xs={12} md={4} key={index}>
              <motion.div variants={itemVariants}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'rgba(30, 41, 59, 0.7)',
                    backdropFilter: 'blur(10px)',
                    transition: 'transform 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-10px)',
                    },
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        mb: 2,
                        color: theme.palette.primary.main,
                      }}
                    >
                      {feature.icon}
                    </Box>
                    <Typography gutterBottom variant="h5" component="h3">
                      {feature.title}
                    </Typography>
                    <Typography color="textSecondary">{feature.description}</Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </motion.div>

      {/* CTA Section */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }}
      >
        <Box
          sx={{
            mt: 8,
            mb: 4,
            py: 6,
            px: 4,
            borderRadius: '20px',
            textAlign: 'center',
            background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
          }}
        >
          <Typography variant="h4" component="h2" gutterBottom color="white">
            Ready for Movie Night?
          </Typography>
          <Typography variant="body1" paragraph color="white" sx={{ maxWidth: '600px', mx: 'auto', mb: 4 }}>
            Create your first room now and invite your friends for an unforgettable movie experience.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={handleCreateRoom}
            sx={{
              backgroundColor: 'white',
              color: theme.palette.primary.dark,
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
              },
              borderRadius: '50px',
              px: 4,
            }}
          >
            Get Started
          </Button>
        </Box>
      </motion.div>
    </Box>
  );
};

export default Home;
