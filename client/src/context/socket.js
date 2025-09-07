import { io } from 'socket.io-client';

// Resolve socket URL: prefer explicit VITE_SOCKET_URL; else derive from API base URL; else fallback
let SOCKET_URL = import.meta.env.VITE_SOCKET_URL;
if (!SOCKET_URL) {
  const apiBase = import.meta.env.VITE_API_BASE_URL;
  try {
    if (apiBase) {
      const origin = new URL(apiBase).origin;
      SOCKET_URL = origin;
    }
  } catch (_) {}
}
if (!SOCKET_URL) SOCKET_URL = 'http://127.0.0.1:5000';

// DEBUG: show socket URL and options
console.log(' SOCKET_URL:', SOCKET_URL);

export const socket = io(SOCKET_URL, {
  autoConnect: false, // Don't connect automatically
  // Force HTTP long-polling to avoid WebSocket upgrade errors when the
  // backend server isn't running a WebSocket-capable worker.
  transports: ['polling'],
  upgrade: false,
  path: '/socket.io',
  timeout: 20000,
  withCredentials: false,
});