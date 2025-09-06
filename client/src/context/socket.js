import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://127.0.0.1:5000';

export const socket = io(SOCKET_URL, {
  autoConnect: false, // Don't connect automatically
});