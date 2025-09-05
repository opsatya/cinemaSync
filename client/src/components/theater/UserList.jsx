import { Box, List, ListItem, ListItemAvatar, ListItemText, Avatar, Typography, Chip, useTheme } from '@mui/material';
import { motion } from 'framer-motion';

const UserList = ({ users }) => {
  const theme = useTheme();

  return (
    <List sx={{ width: '100%', bgcolor: 'transparent' }}>
      {users.map((user, index) => (
        <motion.div
          key={user.id}
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
              <Avatar
                sx={{
                  bgcolor: user.online ? theme.palette.primary.main : 'grey.700',
                  position: 'relative',
                }}
              >
                {user.avatar}
                {user.online && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: 'success.main',
                      border: `2px solid ${theme.palette.background.paper}`,
                    }}
                  />
                )}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={user.name}
              secondary={
                <Typography
                  sx={{ display: 'inline' }}
                  component="span"
                  variant="body2"
                  color="text.secondary"
                >
                  {user.online ? 'Online' : 'Offline'}
                </Typography>
              }
            />
            {user.online && (
              <Chip
                label="Watching"
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
      ))}
    </List>
  );
};

export default UserList;
