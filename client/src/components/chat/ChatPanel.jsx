import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Avatar,
  Paper,
  Divider,
  useTheme,
} from '@mui/material';
import { Send, SentimentSatisfiedAlt } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { socket } from '../../context/socket';

const ChatPanel = ({ users, roomId, messages, setMessages }) => {
  const theme = useTheme();
  const messagesEndRef = useRef(null);
  const [message, setMessage] = useState('');
  const { currentUser } = useAuth();

  const userMap = useMemo(() => {
    const map = {};
    users.forEach(user => {
      const participant = user.user_id ? user : user.participants[0];
      if (participant) {
        map[participant.user_id] = participant;
      }
    });
    return map;
  }, [users]);

  // Scroll to bottom of messages when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = () => {
    if (message.trim() && currentUser) {
      const messageData = {
        room_id: roomId,
        user_id: currentUser.uid,
        message: message,
      };
      socket.emit('chat_message', messageData);
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Format timestamp to show only time
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSenderInfo = (userId) => {
    if (userId === currentUser?.uid) {
      return { name: 'You', avatar: currentUser.displayName?.charAt(0) || 'Y' };
    }
    const user = Object.values(userMap).find(u => u.user_id === userId);
    return {
      name: user?.name || userId.substring(0, 6),
      avatar: user?.name?.charAt(0) || '?'
    };
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Chat Header */}
      <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Typography variant="h6">Chat Room</Typography>
        <Typography variant="body2" color="text.secondary">
          {users.length} online
        </Typography>
      </Box>

      {/* Messages Area */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(0,0,0,0.1)',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '4px',
          },
        }}
      >
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div_
              key={msg.timestamp || msg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {msg.isSystem ? (
                <Box
                  sx={{
                    textAlign: 'center',
                    my: 1,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      px: 2,
                      py: 0.5,
                    }}
                  >
                    {msg.text}
                  </Typography>
                </Box>
              ) : (
                <Box_
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    mb: 1,
                  }}
                >
                  _
                  <Avatar
                    sx={{
                      bgcolor: msg.user_id === currentUser?.uid ? theme.palette.primary.main : theme.palette.secondary.main,
                      width: 32,
                      height: 32,
                      fontSize: '0.875rem',
                    }}
                  >
                    {getSenderInfo(msg.user_id).avatar}
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {getSenderInfo(msg.user_id).name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(msg.timestamp)}
                      </Typography>
                    </Box>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.5,
                        borderRadius: '12px',
                        backgroundColor: msg.user_id === currentUser?.uid ? 'rgba(109, 40, 217, 0.2)' : 'rgba(30, 41, 59, 0.7)',
                        maxWidth: '100%',
                        wordBreak: 'break-word',
                      }}
                    >
                      <Typography variant="body2">{msg.text}</Typography>
                    </Paper>
                  </Box>
                </Box_>
              )}
            </motion.div_>
          ))}
          <div ref={messagesEndRef} />
        </AnimatePresence>
      </Box>

      {/* Message Input */}
      <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Type a message..."
            size="small"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            InputProps={{
              sx: {
                borderRadius: '20px',
                backgroundColor: 'rgba(255,255,255,0.05)',
              },
            }}
          />
          <IconButton color="primary" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
            <SentimentSatisfiedAlt />
          </IconButton>
          <IconButton
            color="primary"
            onClick={handleSendMessage}
            disabled={!message.trim()}
            sx={{
              bgcolor: message.trim() ? theme.palette.primary.main : 'rgba(255,255,255,0.05)',
              color: message.trim() ? 'white' : 'inherit',
              '&:hover': {
                bgcolor: message.trim() ? theme.palette.primary.dark : 'rgba(255,255,255,0.1)',
              },
            }}
          >
            <Send />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

export default ChatPanel;
