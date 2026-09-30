import { Box, List, ListItem, ListItemAvatar, ListItemText, Avatar, Typography, Chip, useTheme } from '@mui/material';
import { motion } from 'framer-motion';

// Participants only ever carry {user_id, is_host, joined_at} — there is no
// display name/avatar/online-status data from the backend. Degrade
// gracefully instead of rendering undefined fields.
const displayName = (userId, currentUserId) =>
  userId === currentUserId ? 'You' : `User ${String(userId).slice(0, 6)}`;

const UserList = ({ users, currentUserId }) => {
  const theme = useTheme();

  return (
    <List sx={{ width: '100%', bgcolor: 'transparent' }}>
      {users.map((user, index) => {
        const name = displayName(user.user_id, currentUserId);
        return (
          <motion.div
            key={user.user_id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <ListItem
              alignItems="center"
              sx={{
                mb: 1,
                borderRadius: '8px',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                },
              }}
            >
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                  {name.charAt(0).toUpperCase()}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={name}
                secondary={
                  <Typography
                    sx={{ display: 'inline' }}
                    component="span"
                    variant="body2"
                    color="text.secondary"
                  >
                    In room
                  </Typography>
                }
              />
              {user.is_host && (
                <Chip
                  label="Host"
                  size="small"
                  sx={{
                    bgcolor: 'rgba(16, 185, 129, 0.2)',
                    color: 'success.light',
                    fontSize: '0.7rem',
                  }}
                />
              )}
            </ListItem>
          </motion.div>
        );
      })}
    </List>
  );
};

export default UserList;
