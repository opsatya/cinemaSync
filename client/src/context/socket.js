import { io } from 'socket.io-client';

// Resolve socket URL: prefer explicit VITE_SOCKET_URL; else backend API origin; else same-origin; else fallback
const envSocket = import.meta.env.VITE_SOCKET_URL;
const apiBase = import.meta.env.VITE_API_BASE_URL;
let apiOrigin = null;
try {
  if (apiBase) apiOrigin = new URL(apiBase).origin;
} catch (_) {}
let SOCKET_URL = envSocket || apiOrigin || (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : null) || 'http://localhost:5000';

if (import.meta.env.VITE_DEBUG_LOGS === 'true') {
  // eslint-disable-next-line no-console
  console.log('[Socket] Resolved SOCKET_URL =', SOCKET_URL);
}


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