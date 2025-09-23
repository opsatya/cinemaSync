import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
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
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
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
import { fetchMyRooms, updateRoom, deleteRoom } from '../utils/api';

const MyRooms = () => {
  const { backendToken } = useAuth();
  const theme = useTheme();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Persist favorites in localStorage using stable string room IDs
  const getInitialFavorites = () => {
    try {
      const raw = localStorage.getItem('favoriteRooms');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const [favoriteRooms, setFavoriteRooms] = useState(getInitialFavorites()); // string room IDs

  // Edit Room dialog state
  const [editingRoom, setEditingRoom] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    privacy: 'private',
    password: '',
    allowChat: true,
    allowReactions: true,
  });
  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    const loadRooms = async () => {
      if (!backendToken) {
        setError('You must be logged in to see your rooms.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const myRooms = await fetchMyRooms(backendToken);
        setRooms(myRooms);
      } catch (err) {
        setError(err.message || 'Could not fetch rooms.');
      } finally {
        setLoading(false);
      }
    };
    loadRooms();
  }, [backendToken]);
  
  // Persist favorites whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('favoriteRooms', JSON.stringify(favoriteRooms));
    } catch {}
  }, [favoriteRooms]);

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
    const key = String(roomId || '');
    if (!key) return;
    if (favoriteRooms.includes(key)) {
      setFavoriteRooms(favoriteRooms.filter(id => id !== key));
    } else {
      setFavoriteRooms([...favoriteRooms, key]);
    }
  };

  const openEdit = (room) => {
    const isPrivate = room.is_private ?? room.isPrivate ?? true;
    setEditingRoom(room);
    setEditForm({
      name: room.name || '',
      description: room.description || '',
      privacy: isPrivate ? 'private' : 'public',
      password: room.password || '',
      allowChat: room.enable_chat ?? true,
      allowReactions: room.enable_reactions ?? true,
    });
  };

  const handleEditChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveEdit = async () => {
    if (!editingRoom) return;
    try {
      setSavingEdit(true);
      const payload = {
        name: editForm.name,
        description: editForm.description,
        is_private: editForm.privacy === 'private',
        password: editForm.privacy === 'private' ? (editForm.password || null) : null,
        enable_chat: !!editForm.allowChat,
        enable_reactions: !!editForm.allowReactions,
      };
      const updated = await updateRoom(String(editingRoom.room_id || editingRoom.id), payload, backendToken);
      // Replace in local state
      setRooms((prev) =>
        prev.map((r) =>
          String(r.room_id || r.id) === String(editingRoom.room_id || editingRoom.id) ? updated : r
        )
      );
      setEditingRoom(null);
    } catch (e) {
      setError(e.message || 'Failed to update room');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleShare = (room) => {
    try {
      const roomId = String(room.room_id || room.id);
      const url = `${window.location.origin}/theater/${roomId}`;
      setShareLink(url);
      setShareCopied(false);
      setShareDialogOpen(true);
    } catch (e) {
      console.warn('Share failed:', e);
    }
  };

  const handleDelete = async (room) => {
    try {
      const roomId = String(room.room_id || room.id);
      if (!roomId) return;
      const confirmDelete = window.confirm('Are you sure you want to delete this room?');
      if (!confirmDelete) return;
      await deleteRoom(roomId, backendToken);
      setRooms((prev) => prev.filter((r) => String(r.room_id || r.id) !== roomId));
      // Remove from favorites if present
      setFavoriteRooms((prev) => prev.filter((id) => id !== roomId));
    } catch (e) {
      setError(e.message || 'Failed to delete room');
    }
  };

  // Filter rooms based on search query and active tab
  const filteredRooms = rooms
    .filter(room => {
      const matchesSearch = room.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          room.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (tabValue === 0) return matchesSearch; // All rooms
      if (tabValue === 1) return matchesSearch && favoriteRooms.includes(String(room.room_id || room.id)); // Favorites
      if (tabValue === 2) return matchesSearch && new Date(room.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Recent (last 7 days)
      
      return matchesSearch;
    });

  return (
    <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ mt: 4, mb: 6 }}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between', 
            alignItems: { xs: 'stretch', sm: 'center' }, 
            gap: 2,
            mb: 4 
          }}>
            <Typography 
              variant="h3" 
              component="h1"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
                textAlign: { xs: 'center', sm: 'left' },
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
                  width: { xs: '100%', sm: 'auto' },
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
              p: { xs: 2, sm: 3 },
              borderRadius: '16px',
              background: 'rgba(30, 41, 59, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              mb: 4,
              width: '100%',
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
            
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                <CircularProgress />
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
            )}

            {!loading && !error && (
              filteredRooms.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 5 }}>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    {tabValue === 0 ? 'You have not joined any rooms yet.' : 'No rooms found in this category.'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {searchQuery ? 'Try a different search term.' : 'Why not create a new room?'}
                  </Typography>
                </Box>
              ) : (
                <Grid container spacing={{ xs: 2, sm: 3 }}>
                  {filteredRooms.map((room) => {
                    // Create a unique key using room_id, id, or fallback to index
                    const roomKey = String(room.room_id || room.id || `room-${Math.random()}`);
                    const roomId = String(room.room_id || room.id || '');
                    
                    return (
                      <Grid item xs={12} sm={6} lg={4} key={roomKey}>
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
                                  {room.name?.charAt(0) || 'R'}
                                </Avatar>
                                <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                                  {room.name || 'Unnamed Room'}
                                </Typography>
                              </Box>
                              <IconButton 
                                size="small" 
                                onClick={() => toggleFavorite(roomId)}
                                color={favoriteRooms.includes(roomId) ? 'secondary' : 'default'}
                              >
                                {favoriteRooms.includes(roomId) ? <Favorite /> : <FavoriteBorder />}
                              </IconButton>
                            </Box>
                            
                            <CardContent sx={{ flexGrow: 1, pt: 2 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {room.description || 'No description available'}
                              </Typography>
                              
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <MovieFilter fontSize="small" color="primary" />
                                <Typography variant="body2" noWrap>
                                  {room.movie_source?.value || room.movie_source?.type || 'Movie not set'}
                                </Typography>
                              </Box>
                              
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <People fontSize="small" color="primary" />
                                <Typography variant="body2">
                                  {room.participants?.length || 0} participants
                                </Typography>
                              </Box>
                              
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <AccessTime fontSize="small" color="primary" />
                                <Typography variant="body2">
                                  Created: {room.created_at ? new Date(room.created_at).toLocaleDateString() : 'Unknown'}
                                </Typography>
                              </Box>
                            </CardContent>
                            
                            <Box sx={{ display: 'flex', p: 1, pt: 0 }}>
                              <Chip
                                label={room.is_private || room.isPrivate ? 'Private' : 'Public'}
                                size="small"
                                color={room.is_private || room.isPrivate ? 'primary' : 'success'}
                                variant="outlined"
                                sx={{ borderRadius: '4px', height: 24 }}
                              />
                            </Box>
                            
                            <CardActions sx={{ p: 2, pt: 0, justifyContent: 'space-between' }}>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <IconButton size="small" color="primary" onClick={() => openEdit(room)}>
                                  <Edit fontSize="small" />
                                </IconButton>
                                <IconButton size="small" color="primary" onClick={() => handleShare(room)}>
                                  <Share fontSize="small" />
                                </IconButton>
                                <IconButton size="small" color="error" onClick={() => handleDelete(room)}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Box>
                              
                              <Button
                                variant="contained"
                                size="small"
                                onClick={() => handleJoinRoom(roomId)}
                                sx={{
                                  borderRadius: '8px',
                                  bgcolor: theme.palette.primary.main,
                                }}
                                disabled={!roomId}
                              >
                                Join Room
                              </Button>
                            </CardActions>
                          </Card>
                        </motion.div>
                      </Grid>
                    );
                  })}
                </Grid>
              )
            )}
          </Paper>
          {/* Edit Room Dialog */}
          <Dialog open={Boolean(editingRoom)} onClose={() => setEditingRoom(null)} fullWidth maxWidth="sm">
            <DialogTitle>Edit Room</DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                <TextField
                  label="Room Name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  fullWidth
                />
                <TextField
                  label="Description"
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  fullWidth
                  multiline
                  rows={3}
                />
                <FormControl fullWidth>
                  <InputLabel id="privacy-select-label">Privacy</InputLabel>
                  <Select
                    labelId="privacy-select-label"
                    label="Privacy"
                    value={editForm.privacy}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, privacy: e.target.value }))}
                  >
                    <MenuItem value="public">Public</MenuItem>
                    <MenuItem value="private">Private</MenuItem>
                  </Select>
                </FormControl>
                {editForm.privacy === 'private' && (
                  <TextField
                    label="Password (optional)"
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, password: e.target.value }))}
                    fullWidth
                    placeholder="Leave empty for no password"
                  />
                )}
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!editForm.allowChat}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, allowChat: e.target.checked }))}
                      color="primary"
                    />
                  }
                  label="Enable Chat"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!editForm.allowReactions}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, allowReactions: e.target.checked }))}
                      color="primary"
                    />
                  }
                  label="Enable Reactions"
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditingRoom(null)}>Cancel</Button>
              <Button variant="contained" onClick={handleSaveEdit} disabled={savingEdit}>
                {savingEdit ? 'Saving...' : 'Save'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Share Link Dialog */}
          <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>Share Room Link</DialogTitle>
            <DialogContent dividers>
              <TextField
                fullWidth
                label="Room link"
                value={shareLink}
                InputProps={{ readOnly: true }}
                onFocus={(e) => e.target.select()}
                sx={{ mt: 1 }}
              />
              {shareCopied && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Link copied to clipboard
                </Alert>
              )}
            </DialogContent>
            <DialogActions>
              {typeof navigator !== 'undefined' && navigator.share ? (
                <Button
                  onClick={async () => {
                    try {
                      await navigator.share({
                        title: 'Join my CinemaSync room',
                        url: shareLink,
                      });
                    } catch (e) {
                      // ignore canceled share
                    }
                  }}
                >
                  Share
                </Button>
              ) : null}
              <Button
                variant="contained"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareLink);
                    setShareCopied(true);
                  } catch (e) {
                    setError('Failed to copy link');
                  }
                }}
              >
                Copy link
              </Button>
              <Button onClick={() => setShareDialogOpen(false)}>Close</Button>
            </DialogActions>
          </Dialog>
        </Box>
      </motion.div>
    </Container>
  );
};

export default MyRooms;
