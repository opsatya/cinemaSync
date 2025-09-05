import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  CardActions,
  Button,
  IconButton,
  Avatar,
  Chip,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  useTheme,
  Divider,
} from '@mui/material';
import {
  Add,
  Search,
  MovieFilter,
  Delete,
  Edit,
  Share,
  People,
  AccessTime,
  Favorite,
  FavoriteBorder,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

const MyRooms = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteRooms, setFavoriteRooms] = useState([1, 3]); // IDs of favorited rooms

  // Mock data for rooms
  const mockRooms = [
    {
      id: 1,
      name: 'Friday Movie Night',
      description: 'Weekly movie night with friends',
      participants: 5,
      lastActive: '2025-03-26',
      isPrivate: true,
      currentMovie: 'Inception',
    },
    {
      id: 2,
      name: 'Sci-Fi Marathon',
      description: 'Watching all the classic sci-fi films',
      participants: 3,
      lastActive: '2025-03-24',
      isPrivate: true,
      currentMovie: 'The Matrix',
    },
    {
      id: 3,
      name: 'Documentary Club',
      description: 'Educational documentaries every Sunday',
      participants: 8,
      lastActive: '2025-03-22',
      isPrivate: false,
      currentMovie: 'Planet Earth',
    },
    {
      id: 4,
      name: 'Horror Movie Night',
      description: 'Not for the faint of heart',
      participants: 4,
      lastActive: '2025-03-20',
      isPrivate: true,
      currentMovie: 'The Shining',
    },
  ];

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleCreateRoom = () => {
    navigate('/create-room');
  };

  const handleJoinRoom = (roomId) => {
    navigate(`/theater/${roomId}`);
  };

  const toggleFavorite = (roomId) => {
    if (favoriteRooms.includes(roomId)) {
      setFavoriteRooms(favoriteRooms.filter(id => id !== roomId));
    } else {
      setFavoriteRooms([...favoriteRooms, roomId]);
    }
  };

  // Filter rooms based on search query and active tab
  const filteredRooms = mockRooms
    .filter(room => {
      const matchesSearch = room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          room.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (tabValue === 0) return matchesSearch; // All rooms
      if (tabValue === 1) return matchesSearch && favoriteRooms.includes(room.id); // Favorites
      if (tabValue === 2) return matchesSearch && new Date(room.lastActive) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Recent (last 7 days)
      
      return matchesSearch;
    });

  return (
    <Container maxWidth="lg">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ mt: 4, mb: 6 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography 
              variant="h3" 
              component="h1"
              sx={{
                fontWeight: 700,
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              My Movie Rooms
            </Typography>
            
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleCreateRoom}
                sx={{ 
                  borderRadius: '8px',
                  py: 1.2,
                  px: 3,
                  background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  '&:hover': {
                    background: `linear-gradient(90deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
                  }
                }}
              >
                Create New Room
              </Button>
            </motion.div>
          </Box>
          
          <Paper
            elevation={6}
            sx={{
              p: 3,
              borderRadius: '16px',
              background: 'rgba(30, 41, 59, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              mb: 4,
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: 'center', mb: 3 }}>
              <TextField
                fullWidth
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={handleSearchChange}
                variant="outlined"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: '8px',
                  },
                }}
              />
              
              <Box sx={{ minWidth: { xs: '100%', sm: 'auto' } }}>
                <Tabs 
                  value={tabValue} 
                  onChange={handleTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    '& .MuiTab-root': {
                      minWidth: 100,
                    },
                  }}
                >
                  <Tab label="All Rooms" />
                  <Tab label="Favorites" />
                  <Tab label="Recent" />
                </Tabs>
              </Box>
            </Box>
            
            <Divider sx={{ mb: 3 }} />
            
            {filteredRooms.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No rooms found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {searchQuery ? 'Try a different search term' : 'Create your first room to get started'}
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={3}>
                {filteredRooms.map((room) => (
                  <Grid item xs={12} sm={6} md={4} key={room.id}>
                    <motion.div
                      whileHover={{ y: -5 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 10 }}
                    >
                      <Card 
                        sx={{ 
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          backgroundColor: 'rgba(30, 41, 59, 0.5)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            borderColor: theme.palette.primary.main,
                            boxShadow: `0 0 20px rgba(${parseInt(theme.palette.primary.main.slice(1, 3), 16)}, ${parseInt(theme.palette.primary.main.slice(3, 5), 16)}, ${parseInt(theme.palette.primary.main.slice(5, 7), 16)}, 0.3)`,
                          },
                        }}
                      >
                        <Box 
                          sx={{ 
                            p: 2, 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar 
                              sx={{ 
                                bgcolor: theme.palette.primary.main,
                                width: 32,
                                height: 32,
                                fontSize: '0.875rem',
                              }}
                            >
                              {room.name.charAt(0)}
                            </Avatar>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                              {room.name}
                            </Typography>
                          </Box>
                          <IconButton 
                            size="small" 
                            onClick={() => toggleFavorite(room.id)}
                            color={favoriteRooms.includes(room.id) ? 'secondary' : 'default'}
                          >
                            {favoriteRooms.includes(room.id) ? <Favorite /> : <FavoriteBorder />}
                          </IconButton>
                        </Box>
                        
                        <CardContent sx={{ flexGrow: 1, pt: 2 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {room.description}
                          </Typography>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <MovieFilter fontSize="small" color="primary" />
                            <Typography variant="body2">
                              {room.currentMovie}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <People fontSize="small" color="primary" />
                            <Typography variant="body2">
                              {room.participants} participants
                            </Typography>
                          </Box>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AccessTime fontSize="small" color="primary" />
                            <Typography variant="body2">
                              Last active: {room.lastActive}
                            </Typography>
                          </Box>
                        </CardContent>
                        
                        <Box sx={{ display: 'flex', p: 1, pt: 0 }}>
                          <Chip 
                            label={room.isPrivate ? 'Private' : 'Public'} 
                            size="small"
                            color={room.isPrivate ? 'primary' : 'success'}
                            variant="outlined"
                            sx={{ borderRadius: '4px', height: 24 }}
                          />
                        </Box>
                        
                        <CardActions sx={{ p: 2, pt: 0, justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton size="small" color="primary">
                              <Edit fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="primary">
                              <Share fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error">
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                          
                          <Button 
                            variant="contained" 
                            size="small"
                            onClick={() => handleJoinRoom(room.id)}
                            sx={{ 
                              borderRadius: '8px',
                              bgcolor: theme.palette.primary.main,
                            }}
                          >
                            Join Room
                          </Button>
                        </CardActions>
                      </Card>
                    </motion.div>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Box>
      </motion.div>
    </Container>
  );
};

export default MyRooms;
