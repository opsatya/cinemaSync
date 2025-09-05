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
  useTheme,
} from '@mui/material';
import { PlayArrow, Delete, DragIndicator, Add } from '@mui/icons-material';
import { motion } from 'framer-motion';

const PlaylistPanel = ({ playlist }) => {
  const theme = useTheme();
  const [hoveredItem, setHoveredItem] = useState(null);

  return (
    <Box sx={{ width: '100%' }}>
      <List sx={{ width: '100%', bgcolor: 'transparent', p: 0 }}>
        {playlist.map((item, index) => (
          <motion.div
            key={item.id}
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
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <ListItem
                secondaryAction={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <IconButton edge="end" aria-label="play" sx={{ color: theme.palette.primary.main }}>
                      <PlayArrow />
                    </IconButton>
                    <IconButton edge="end" aria-label="delete" sx={{ color: theme.palette.error.main }}>
                      <Delete />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemAvatar sx={{ minWidth: '40px' }}>
                  <DragIndicator sx={{ color: 'text.secondary', cursor: 'grab' }} />
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                      {item.title}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {item.duration}
                    </Typography>
                  }
                />
              </ListItem>
            </Paper>
          </motion.div>
        ))}
      </List>

      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Paper
          elevation={0}
          sx={{
            mt: 2,
            p: 1,
            borderRadius: '8px',
            border: '1px dashed rgba(255, 255, 255, 0.2)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'transparent',
            cursor: 'pointer',
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
        </Paper>
      </motion.div>
    </Box>
  );
};

export default PlaylistPanel;
