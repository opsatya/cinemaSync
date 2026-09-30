import { useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  IconButton,
  Typography,
  Paper,
  ButtonBase,
  useTheme,
} from '@mui/material';
import { PlayArrow, Delete, Movie as MovieIcon, Add } from '@mui/icons-material';
import { motion } from 'framer-motion';

const itemLabel = (item) => {
  if (item.video_name) return item.video_name;
  return item.type === 'direct_link' ? 'Direct link video' : 'Untitled video';
};

const PlaylistPanel = ({ playlist, isHost, onAdd, onPlay, onRemove }) => {
  const theme = useTheme();
  const [hoveredItem, setHoveredItem] = useState(null);

  return (
    <Box sx={{ width: '100%' }}>
      {playlist.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No videos queued yet.
        </Typography>
      )}
      <List sx={{ width: '100%', bgcolor: 'transparent', p: 0 }}>
        {playlist.map((item, index) => (
          <motion.div
            key={item.item_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
          >
            <Paper
              elevation={0}
              sx={{
                mb: 1,
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  borderColor: theme.palette.primary.main,
                },
              }}
              onMouseEnter={() => setHoveredItem(item.item_id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <ListItem
                secondaryAction={
                  isHost && (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <IconButton
                        edge="end"
                        aria-label="play"
                        sx={{ color: theme.palette.primary.main }}
                        onClick={() => onPlay(item.item_id)}
                      >
                        <PlayArrow />
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="remove"
                        sx={{ color: theme.palette.error.main }}
                        onClick={() => onRemove(item.item_id)}
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                  )
                }
              >
                <ListItemAvatar sx={{ minWidth: '40px' }}>
                  <MovieIcon sx={{ color: 'text.secondary' }} />
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                      {itemLabel(item)}
                    </Typography>
                  }
                />
              </ListItem>
            </Paper>
          </motion.div>
        ))}
      </List>

      {isHost && (
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ButtonBase
            onClick={onAdd}
            aria-label="Add from Google Drive"
            sx={{
              width: '100%',
              mt: 2,
              p: 1,
              borderRadius: '8px',
              border: '1px dashed rgba(255, 255, 255, 0.2)',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              '&:hover': {
                borderColor: theme.palette.primary.main,
                backgroundColor: 'rgba(109, 40, 217, 0.1)',
              },
            }}
          >
            <Add sx={{ mr: 1, color: theme.palette.primary.main }} />
            <Typography variant="body2" color="primary.main">
              Add from Google Drive
            </Typography>
          </ButtonBase>
        </motion.div>
      )}
    </Box>
  );
};

export default PlaylistPanel;
