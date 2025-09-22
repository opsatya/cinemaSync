# CinemaSync Frontend (React + Vite)

React + Vite SPA for creating and joining watch-together rooms, synchronized playback, chat, reactions, and Google Drive movie browsing.

Backend counterpart
- API + Socket.IO server lives at [backend/](../backend/) (start it before the frontend)
- Main Entry: [python.socketio.run()](../backend/run.py:6)
- App Factory: [python.create_app()](../backend/app/__init__.py:28)

Key frontend files
- App Shell: [javascript.function App](./src/App.jsx)
- Theater Page (core experience): [javascript.function Theater](./src/pages/Theater.jsx)
- Create Room Page: [javascript.function CreateRoom](./src/pages/CreateRoom.jsx)
- My Rooms: [javascript.function MyRooms](./src/pages/MyRooms.jsx)
- Movie Browser (Drive UI): [javascript.function MovieBrowser](./src/components/movies/MovieBrowser.jsx)
- Video Player: [javascript.function VideoPlayer](./src/components/theater/VideoPlayer.jsx)
- API layer: [javascript.object default](./src/utils/api.js)
- Auth provider: [javascript.function AuthProvider](./src/context/AuthContext.jsx)
- Socket client: [javascript.const socket](./src/context/socket.js)

Features
- Create private or public movie rooms (with optional password)
- Choose video source:
  - Google Drive (user OAuth, lists own videos)
  - Direct link (e.g., mp4/webm)
  - Add Later (host can set movie in Theater)
- Synchronized playback (host-only control)
- In-room chat and emoji reactions
- Drive browser with folders, recent, and Root (shows your own Drive videos when connected)
- Host-only Change Movie for Drive rooms (hidden for Direct Link rooms)
- Keyboard shortcut: Space toggles play/pause (host-only control enforced)

Prerequisites
- Node.js 18+ and npm
- Backend running at http://127.0.0.1:5000 (default); see [backend/README.md](../backend/README.md)
- For Google Drive browsing:
  - Connect Drive via OAuth from the UI (Create Room → Google Drive → Connect, or Movie Browser → Connect)

Environment variables (client/.env)
- VITE_API_BASE_URL — REST base. Example:
  - VITE_API_BASE_URL=http://127.0.0.1:5000/api
- VITE_DEBUG_LOGS — optional; when true enables additional console logging.

Setup & run
1) Install dependencies:
   - npm install

2) Create env file:
   - cp .env.example .env
   - Edit VITE_API_BASE_URL to match your backend (e.g., http://127.0.0.1:5000/api)

3) Start dev server:
   - npm run dev
   - Opens http://localhost:5173

Production build
- npm run build
- npm run preview (to test the production build locally)

How it works (high level)
- Theater room load:
  1) App fetches room details: [javascript.function getRoomDetails](./src/utils/api.js:343)
  2) If room.movie_source indicates Drive or DirectLink, the video is initialized immediately
  3) Client connects Socket.IO with JWT (when available): [javascript.const socket](./src/context/socket.js)
  4) Join flow (with password if required) via socket 'join_room'; UI shows a password dialog for private rooms
  5) On success, room_joined event updates participants and playback state

- Playback sync (host-only):
  - Host toggles play/pause in [javascript.function Theater](./src/pages/Theater.jsx)
  - Emits 'update_playback' with { is_playing, current_time }
  - Server validates host and broadcasts 'playback_updated'

- Change movie (Drive only, host):
  - Host opens [javascript.function MovieBrowser](./src/components/movies/MovieBrowser.jsx) and selects a movie
  - Client POSTs room video via [javascript.function setRoomVideo](./src/utils/api.js:104)
  - Server updates room.movie_source and sends 'video_changed' socket event to sync all participants

- Google Drive browsing:
  - If user connected Drive (OAuth flow handled by backend), Root lists user videos via [javascript.function fetchDriveVideos](./src/utils/api.js:94)
  - Folders/search use server-side endpoints /api/movies/list and /api/movies/search
  - Recent movies reads Mongo-backed metadata with fallback to Drive root

UX rules (consistency)
- When a room has a preset video (Drive or Direct Link):
  - Theater loads player immediately, no “Browse Movies” button
  - Direct Link rooms do not show “Change Movie”
- Add Later rooms show “Browse Movies” to the host only
- Host-only control is enforced on client and server

Keyboard shortcuts
- Space: toggle play/pause (host-only, while joined and a video is selected)

Common issues & tips
- “Joining…” hangs:
  - The client includes a 10s join-timeout to reset the UI. Ensure the backend is running and reachable at VITE_API_BASE_URL origin.
- “Invalid password” on correct input:
  - Backend normalizes password strings (trim). Restart backend after changes to .env or code.
- Drive Root shows empty:
  - Connect Drive via OAuth from the UI; then the Root view lists your own video files
- CORS/base URL:
  - Keep frontend and backend origins consistent with http://127.0.0.1 to avoid localhost vs 127.0.0.1 cookie/socket mismatches

Scripts
- npm run dev — start Vite dev server
- npm run build — build for production
- npm run preview — preview production build

Folder structure (selected)
- src/
  - pages/
    - [javascript.function Theater](./src/pages/Theater.jsx)
    - [javascript.function CreateRoom](./src/pages/CreateRoom.jsx)
    - [javascript.function MyRooms](./src/pages/MyRooms.jsx)
  - components/
    - movies/
      - [javascript.function MovieBrowser](./src/components/movies/MovieBrowser.jsx)
    - theater/
      - [javascript.function VideoPlayer](./src/components/theater/VideoPlayer.jsx)
      - [javascript.function UserList](./src/components/theater/UserList.jsx)
    - chat/
      - [javascript.function ChatPanel](./src/components/chat/ChatPanel.jsx)
  - context/
    - [javascript.function AuthProvider](./src/context/AuthContext.jsx)
    - [javascript.const socket](./src/context/socket.js)
  - utils/
    - [javascript.object default](./src/utils/api.js)

Development notes
- Use the VITE_DEBUG_LOGS=true flag for additional console diagnostics
- Socket events are gated until room join completes; acks are used to surface precise errors rather than generic error events
- The frontend expects a backend JWT for authenticated REST calls (e.g., Drive listing); ensure you are logged in through the app’s auth flow

License
- Add your preferred license notice here.
