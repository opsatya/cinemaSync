import { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  CardMedia, 
  IconButton, 
  TextField,
  InputAdornment,
  Button,
  Breadcrumbs,
  CircularProgress,
  Divider,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { 
  Folder, 
  Movie, 
  Search, 
  ArrowBack, 
  PlayArrow, 
  Info,
  NavigateNext,
  History,
  Refresh,
  Link as LinkIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { fetchMoviesList, searchMovies, getRecentMovies, getStreamLink } from '../../utils/api';

const MovieBrowser = ({ onSelectMovie, roomId }) => {
  const [movies, setMovies] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [driveAvailable, setDriveAvailable] = useState(true);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderHistory, setFolderHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recentMovies, setRecentMovies] = useState([]);
  const [showRecent, setShowRecent] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [streamLinkDialog, setStreamLinkDialog] = useState(false);
  const [streamLink, setStreamLink] = useState('');
  const [streamLinkLoading, setStreamLinkLoading] = useState(false);

  // Load initial movies from root folder
  useEffect(() => {
    loadMovies();
  }, []);

  // Load recent movies
  useEffect(() => {
    if (driveAvailable) {
      loadRecentMovies();
    }
  }, [driveAvailable]);

  // Load movies from a specific folder
  const loadMovies = async (folderId = null) => {
    setLoading(true);
    setError(null);
    setSearchResults([]);
    setSearchQuery('');
    setShowRecent(false);
    
    try {
      const response = await fetchMoviesList(folderId);
      
      // Separate folders and movies
      const folderItems = response.data.filter(item => item.type === 'folder');
      const movieItems = response.data.filter(item => item.type === 'video');
      
      setFolders(folderItems);
      setMovies(movieItems);
      
      // Update current folder
      setCurrentFolder(response.current_folder || null);
      
      // Update folder history
      if (folderId && !folderHistory.includes(folderId)) {
        setFolderHistory(prev => [...prev, folderId]);
      }
    } catch (error) {
      const msg = error?.message || String(error);
      // Detect missing Google Drive credentials and provide user guidance
      if (/google drive credentials file not found/i.test(msg)) {
        setDriveAvailable(false);
        setFolders([]);
        setMovies([]);
        setError('Google Drive is not configured on the server. You can still paste a direct video link when creating a room, or ask the admin to configure Drive credentials.');
      } else {
        console.error('Error loading movies:', error);
        setError('Failed to load movies. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Load recent movies
  const loadRecentMovies = async () => {
    try {
      const recentMovies = await getRecentMovies();
      setRecentMovies(recentMovies);
    } catch (error) {
      const msg = error?.message || String(error);
      if (/google drive credentials file not found/i.test(msg)) {
        setDriveAvailable(false);
        setRecentMovies([]);
        // Don't spam error UI here if loadMovies already presented it
        if (!error) {
          setError('Google Drive is not configured on the server. Recent movies are unavailable.');
        }
      } else {
        console.error('Error loading recent movies:', error);
      }
    }
  };

  // Handle folder click
  const handleFolderClick = (folder) => {
    loadMovies(folder.id);
  };

  // Handle back button click
  const handleBackClick = () => {
    if (folderHistory.length > 0) {
      // Remove current folder from history
      const newHistory = [...folderHistory];
      newHistory.pop();
      setFolderHistory(newHistory);
      
      // Load parent folder or root
      const parentId = newHistory.length > 0 ? newHistory[newHistory.length - 1] : null;
      loadMovies(parentId);
    }
  };

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setError(null);
    setShowRecent(false);
    
    try {
      const results = await searchMovies(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching movies:', error);
      setError('Failed to search movies. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle movie selection
  const handleMovieSelect = (movie) => {
    setSelectedMovie(movie);
    if (onSelectMovie) {
      onSelectMovie(movie);
    }
  };

  // Get streaming link for a movie
  const handleGetStreamLink = async (movie) => {
    setSelectedMovie(movie);
    setStreamLinkDialog(true);
    setStreamLinkLoading(true);
    
    try {
      const link = await getStreamLink(movie.id);
      setStreamLink(link);
    } catch (error) {
      console.error('Error getting stream link:', error);
      setStreamLink('Failed to get streaming link');
    } finally {
      setStreamLinkLoading(false);
    }
  };

  // Copy stream link to clipboard
  const handleCopyLink = () => {
    navigator.clipboard.writeText(streamLink);
  };

  // Render movie card
  const renderMovieCard = (movie) => (
    <Card 
      key={movie.id} 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        transition: 'transform 0.2s',
        '&:hover': {
          transform: 'scale(1.03)',
          boxShadow: 6
        }
      }}
    >
      <CardMedia
        component="div"
        sx={{
          height: 140,
          bgcolor: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {movie.thumbnailLink ? (
          <img 
            src={movie.thumbnailLink} 
            alt={movie.name} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        ) : (
          <Movie sx={{ fontSize: 60, opacity: 0.6 }} />
        )}
      </CardMedia>
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Typography variant="subtitle1" component="h3" noWrap title={movie.name}>
          {movie.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {movie.size ? `${Math.round(movie.size / 1024 / 1024)} MB` : ''}
        </Typography>
      </CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1, pt: 0 }}>
        <Tooltip title="Play in theater">
          <IconButton 
            color="primary" 
            onClick={() => handleMovieSelect(movie)}
            size="small"
          >
            <PlayArrow />
          </IconButton>
        </Tooltip>
        <Tooltip title="Get stream link">
          <IconButton 
            color="secondary" 
            onClick={() => handleGetStreamLink(movie)}
            size="small"
          >
            <LinkIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Card>
  );

  // Render folder card
  const renderFolderCard = (folder) => (
    <Card 
      key={folder.id} 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'transform 0.2s',
        '&:hover': {
          transform: 'scale(1.03)',
          boxShadow: 6
        }
      }}
      onClick={() => handleFolderClick(folder)}
    >
      <CardMedia
        component="div"
        sx={{
          height: 140,
          bgcolor: 'rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Folder sx={{ fontSize: 80, color: 'primary.main', opacity: 0.8 }} />
      </CardMedia>
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="subtitle1" component="h3" noWrap title={folder.name}>
          {folder.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {folder.item_count !== undefined ? `${folder.item_count} items` : 'Folder'}
        </Typography>
      </CardContent>
    </Card>
  );

  // Render breadcrumbs
  const renderBreadcrumbs = () => (
    <Breadcrumbs 
      separator={<NavigateNext fontSize="small" />} 
      aria-label="folder navigation"
      sx={{ mb: 2 }}
    >
      <Button 
        component={Link} 
        variant="text" 
        color="inherit" 
        onClick={() => loadMovies(null)}
        startIcon={<Folder fontSize="small" />}
      >
        Root
      </Button>
      
      {currentFolder && (
        <Typography color="text.primary">
          {currentFolder.name}
        </Typography>
      )}
    </Breadcrumbs>
  );

  return (
    <Box sx={{ width: '100%' }}>
      {/* Search and navigation */}
      <Box sx={{ mb: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <TextField
          placeholder="Search movies..."
          variant="outlined"
          fullWidth
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={handleSearch}
                  disabled={!searchQuery.trim()}
                >
                  Search
                </Button>
              </InputAdornment>
            )
          }}
        />
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            variant="outlined" 
            startIcon={<History />}
            onClick={() => setShowRecent(!showRecent)}
          >
            Recent
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<Refresh />}
            onClick={() => loadMovies(currentFolder?.id || null)}
          >
            Refresh
          </Button>
        </Box>
      </Box>
      
      {/* Navigation breadcrumbs */}
      {!searchResults.length && !showRecent && renderBreadcrumbs()}
      
      {/* Back button */}
      {folderHistory.length > 0 && !searchResults.length && !showRecent && (
        <Button 
          variant="outlined" 
          startIcon={<ArrowBack />} 
          onClick={handleBackClick}
          sx={{ mb: 2 }}
        >
          Back
        </Button>
      )}
      
      {/* Search results title */}
      {searchResults.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" component="h2">
            Search Results for "{searchQuery}"
          </Typography>
          <Button 
            variant="text" 
            startIcon={<ArrowBack />} 
            onClick={() => {
              setSearchResults([]);
              setSearchQuery('');
              loadMovies(currentFolder?.id || null);
            }}
          >
            Back to browsing
          </Button>
        </Box>
      )}
      
      {/* Recent movies title */}
      {showRecent && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" component="h2">
            Recently Accessed Movies
          </Typography>
          <Button 
            variant="text" 
            startIcon={<ArrowBack />} 
            onClick={() => {
              setShowRecent(false);
              loadMovies(currentFolder?.id || null);
            }}
          >
            Back to browsing
          </Button>
        </Box>
      )}
      
      {/* Loading indicator */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}
      
      {/* Error message */}
      {error && (
        <Box sx={{ my: 2, p: 2, bgcolor: 'error.main', color: 'white', borderRadius: 1 }}>
          <Typography>{error}</Typography>
        </Box>
      )}
      
      {/* Movie grid */}
      <Grid container spacing={2}>
        {/* Show search results */}
        {searchResults.length > 0 && !loading && (
          searchResults.map(movie => (
            <Grid item xs={6} sm={4} md={3} lg={2} key={movie.id}>
              {renderMovieCard(movie)}
            </Grid>
          ))
        )}
        
        {/* Show recent movies */}
        {showRecent && recentMovies.length > 0 && !loading && (
          recentMovies.map(movie => (
            <Grid item xs={6} sm={4} md={3} lg={2} key={movie.id || movie.file_id}>
              {renderMovieCard(movie)}
            </Grid>
          ))
        )}
        
        {/* Show folders and movies when not searching or showing recent */}
        {!searchResults.length && !showRecent && !loading && (
          <>
            {/* Folders */}
            {folders.map(folder => (
              <Grid item xs={6} sm={4} md={3} lg={2} key={folder.id}>
                {renderFolderCard(folder)}
              </Grid>
            ))}
            
            {/* Movies */}
            {movies.map(movie => (
              <Grid item xs={6} sm={4} md={3} lg={2} key={movie.id}>
                {renderMovieCard(movie)}
              </Grid>
            ))}
            
            {/* No results message */}
            {folders.length === 0 && movies.length === 0 && (
              <Grid item xs={12}>
                <Box sx={{ textAlign: 'center', my: 4 }}>
                  <Typography variant="h6" color="text.secondary">
                    No movies or folders found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    This folder is empty or you don't have access to its contents
                  </Typography>
                </Box>
              </Grid>
            )}
          </>
        )}
        
        {/* No search results message */}
        {searchQuery && searchResults.length === 0 && !loading && (
          <Grid item xs={12}>
            <Box sx={{ textAlign: 'center', my: 4 }}>
              <Typography variant="h6" color="text.secondary">
                No results found for "{searchQuery}"
              </Typography>
            </Box>
          </Grid>
        )}
        
        {/* No recent movies message */}
        {showRecent && recentMovies.length === 0 && !loading && (
          <Grid item xs={12}>
            <Box sx={{ textAlign: 'center', my: 4 }}>
              <Typography variant="h6" color="text.secondary">
                No recent movies found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Start watching movies to see them here
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>
      
      {/* Stream link dialog */}
      <Dialog open={streamLinkDialog} onClose={() => setStreamLinkDialog(false)}>
        <DialogTitle>
          Stream Link for {selectedMovie?.name}
        </DialogTitle>
        <DialogContent>
          {streamLinkLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TextField
              fullWidth
              value={streamLink}
              InputProps={{
                readOnly: true,
              }}
              variant="outlined"
              sx={{ mt: 1 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStreamLinkDialog(false)}>
            Close
          </Button>
          <Button 
            onClick={handleCopyLink} 
            color="primary" 
            disabled={streamLinkLoading}
          >
            Copy Link
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MovieBrowser;
