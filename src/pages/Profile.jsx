import { useState } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Avatar,
  Button,
  TextField,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Chip,
  IconButton,
  useTheme,
  Tab,
  Tabs,
} from '@mui/material';
import {
  Edit,
  Save,
  MovieFilter,
  History,
  Favorite,
  Settings,
  Notifications,
  CloudUpload,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

const Profile = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [profileData, setProfileData] = useState({
    name: 'Alex Johnson',
    email: 'alex@example.com',
    bio: 'Movie enthusiast and popcorn connoisseur. I love sci-fi and adventure films!',
    avatar: 'A',
  });

  // Mock data
  const recentRooms = [
    { id: 1, name: 'Friday Movie Night', date: '2025-03-25', participants: 4 },
    { id: 2, name: 'Sci-Fi Marathon', date: '2025-03-20', participants: 3 },
    { id: 3, name: 'Classic Films', date: '2025-03-15', participants: 2 },
  ];

  const favoriteMovies = [
    { id: 1, title: 'Inception', genre: 'Sci-Fi' },
    { id: 2, title: 'The Matrix', genre: 'Sci-Fi' },
    { id: 3, title: 'Interstellar', genre: 'Sci-Fi' },
  ];

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleEditToggle = () => {
    setEditMode(!editMode);
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData({ ...profileData, [name]: value });
  };

  const handleSaveProfile = () => {
    // In a real app, this would save to the backend
    setEditMode(false);
  };

  return (
    <Container maxWidth="lg">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Grid container spacing={4}>
          {/* Profile Info */}
          <Grid item xs={12} md={4}>
            <Paper
              elevation={6}
              sx={{
                p: 3,
                borderRadius: '16px',
                background: 'rgba(30, 41, 59, 0.8)',
                backdropFilter: 'blur(10px)',
                height: '100%',
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <Avatar
                    sx={{
                      width: 120,
                      height: 120,
                      bgcolor: theme.palette.primary.main,
                      fontSize: '3rem',
                      mb: 2,
                    }}
                  >
                    {profileData.avatar}
                  </Avatar>
                </motion.div>

                {editMode ? (
                  <Box sx={{ width: '100%', mb: 2 }}>
                    <TextField
                      fullWidth
                      margin="normal"
                      label="Name"
                      name="name"
                      value={profileData.name}
                      onChange={handleProfileChange}
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      fullWidth
                      margin="normal"
                      label="Email"
                      name="email"
                      value={profileData.email}
                      onChange={handleProfileChange}
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      fullWidth
                      margin="normal"
                      label="Bio"
                      name="bio"
                      multiline
                      rows={4}
                      value={profileData.bio}
                      onChange={handleProfileChange}
                    />
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<CloudUpload />}
                      sx={{ mt: 2 }}
                    >
                      Upload Avatar
                    </Button>
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', mb: 2 }}>
                    <Typography variant="h5" gutterBottom>
                      {profileData.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {profileData.email}
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 2 }}>
                      {profileData.bio}
                    </Typography>
                  </Box>
                )}

                <Button
                  variant={editMode ? 'contained' : 'outlined'}
                  color={editMode ? 'success' : 'primary'}
                  startIcon={editMode ? <Save /> : <Edit />}
                  onClick={editMode ? handleSaveProfile : handleEditToggle}
                  sx={{ mt: 2 }}
                >
                  {editMode ? 'Save Profile' : 'Edit Profile'}
                </Button>

                <Box sx={{ width: '100%', mt: 4 }}>
                  <Typography variant="h6" gutterBottom>
                    Account Statistics
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          textAlign: 'center',
                          backgroundColor: 'rgba(109, 40, 217, 0.2)',
                          borderRadius: '12px',
                        }}
                      >
                        <Typography variant="h4">12</Typography>
                        <Typography variant="body2">Rooms Created</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          textAlign: 'center',
                          backgroundColor: 'rgba(236, 72, 153, 0.2)',
                          borderRadius: '12px',
                        }}
                      >
                        <Typography variant="h4">36</Typography>
                        <Typography variant="body2">Movies Watched</Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>
              </Box>
            </Paper>
          </Grid>

          {/* Tabs and Content */}
          <Grid item xs={12} md={8}>
            <Paper
              elevation={6}
              sx={{
                borderRadius: '16px',
                background: 'rgba(30, 41, 59, 0.8)',
                backdropFilter: 'blur(10px)',
                overflow: 'hidden',
              }}
            >
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                variant="fullWidth"
                sx={{
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  '& .MuiTab-root': {
                    py: 2,
                  },
                }}
              >
                <Tab icon={<History />} label="Recent Rooms" />
                <Tab icon={<Favorite />} label="Favorites" />
                <Tab icon={<Settings />} label="Settings" />
              </Tabs>

              {/* Recent Rooms Tab */}
              {tabValue === 0 && (
                <Box sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Your Recent Movie Rooms
                  </Typography>
                  <List sx={{ width: '100%' }}>
                    {recentRooms.map((room) => (
                      <motion.div
                        key={room.id}
                        whileHover={{ scale: 1.02 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                      >
                        <Paper
                          elevation={0}
                          sx={{
                            mb: 2,
                            borderRadius: '12px',
                            overflow: 'hidden',
                            backgroundColor: 'rgba(30, 41, 59, 0.5)',
                            '&:hover': {
                              backgroundColor: 'rgba(30, 41, 59, 0.8)',
                            },
                          }}
                        >
                          <ListItem
                            secondaryAction={
                              <Button
                                variant="contained"
                                size="small"
                                sx={{ borderRadius: '20px' }}
                              >
                                Rejoin
                              </Button>
                            }
                          >
                            <ListItemAvatar>
                              <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                                <MovieFilter />
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={room.name}
                              secondary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    {room.date}
                                  </Typography>
                                  <Chip
                                    label={`${room.participants} viewers`}
                                    size="small"
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                  />
                                </Box>
                              }
                            />
                          </ListItem>
                        </Paper>
                      </motion.div>
                    ))}
                  </List>
                </Box>
              )}

              {/* Favorites Tab */}
              {tabValue === 1 && (
                <Box sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Your Favorite Movies
                  </Typography>
                  <List sx={{ width: '100%' }}>
                    {favoriteMovies.map((movie) => (
                      <motion.div
                        key={movie.id}
                        whileHover={{ scale: 1.02 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                      >
                        <Paper
                          elevation={0}
                          sx={{
                            mb: 2,
                            borderRadius: '12px',
                            overflow: 'hidden',
                            backgroundColor: 'rgba(30, 41, 59, 0.5)',
                            '&:hover': {
                              backgroundColor: 'rgba(30, 41, 59, 0.8)',
                            },
                          }}
                        >
                          <ListItem
                            secondaryAction={
                              <IconButton edge="end" aria-label="delete" color="error">
                                <Favorite />
                              </IconButton>
                            }
                          >
                            <ListItemAvatar>
                              <Avatar sx={{ bgcolor: theme.palette.secondary.main }}>
                                {movie.title.charAt(0)}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={movie.title}
                              secondary={
                                <Chip
                                  label={movie.genre}
                                  size="small"
                                  sx={{ height: 20, fontSize: '0.7rem', mt: 0.5 }}
                                />
                              }
                            />
                          </ListItem>
                        </Paper>
                      </motion.div>
                    ))}
                  </List>
                </Box>
              )}

              {/* Settings Tab */}
              {tabValue === 2 && (
                <Box sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Account Settings
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                          <Notifications />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary="Notification Settings"
                        secondary="Manage how you receive notifications"
                      />
                      <Button variant="outlined" size="small">
                        Configure
                      </Button>
                    </ListItem>
                    <Divider variant="inset" component="li" />
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                          <Settings />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary="Privacy Settings"
                        secondary="Control who can see your activity"
                      />
                      <Button variant="outlined" size="small">
                        Configure
                      </Button>
                    </ListItem>
                    <Divider variant="inset" component="li" />
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: theme.palette.error.main }}>
                          <Settings />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary="Delete Account"
                        secondary="Permanently remove your account and all data"
                      />
                      <Button variant="outlined" color="error" size="small">
                        Delete
                      </Button>
                    </ListItem>
                  </List>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </motion.div>
    </Container>
  );
};

export default Profile;
