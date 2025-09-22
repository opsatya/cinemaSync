# CinemaSync

Bringing friends together through movies. This repository contains a full-stack watch‑together experience:
- A Flask backend (REST + Socket.IO) for rooms, playback sync, Google Drive integration, and authentication.
- A Vite/React frontend for creating and joining rooms, synchronized playback, chat, reactions, and Drive browsing.

Repository structure
- backend/ — Flask API, Google Drive and Firebase integrations, Socket.IO server
- client/ — Vite + React application (Material UI), Socket.IO client, Google Drive browser
- backend/.env.example — backend environment template
- client/.env.example — frontend environment template

Key features
- Create private or public rooms, with optional password
- Choose movies from your personal Google Drive or use a direct video link
- Host‑controlled synchronized playback for everyone in the room
- In‑room chat and emoji reactions
- Drive browser with folders, recent items, search, and “Root” showing your own videos when connected
- Robust join flow with password handling, UI guardrails, and socket acks
- Spacebar keyboard shortcut to play/pause (host‑only control enforced)

Technology
- Backend: Flask, Flask-SocketIO, MongoDB (PyMongo), Google APIs, Firebase Admin
- Frontend: React, Vite, Material UI, Socket.IO
- Realtime: Socket.IO events for joining/leaving, playback sync, chat, reactions, movie changes

Quick start

Prerequisites
- Python 3.10+ and pip
- Node.js 18+ and npm
- MongoDB running locally or a hosted MongoDB URI
- Google Cloud OAuth 2.0 credentials (Client ID/Secret)
- Firebase service account (JSON) for user identity bridging

1) Clone
git clone <this-repo>
cd cinemaSync

2) Backend (terminal A)
- Create venv and install dependencies:
  - python -m venv backend/.venv
  - source backend/.venv/bin/activate  (Windows: backend\\.venv\\Scripts\\activate)
  - pip install -r backend/requirements.txt
- Create .env:
  - cp backend/.env.example backend/.env
  - Fill variables (see “Backend environment variables” below)
- Run the backend:
  - python backend/run.py
  - Server at http://127.0.0.1:5000 (REST base: /api)

3) Frontend (terminal B)
- Install deps:
  - cd client
  - npm install
- Create .env:
  - cp .env.example .env
  - Set VITE_API_BASE_URL=http://127.0.0.1:5000/api
- Run:
  - npm run dev
  - App at http://localhost:5173

Backend environment variables
- JWT_SECRET — required; set a strong random string
- MONGODB_URI — e.g., mongodb://localhost:27017
- MONGODB_DB_NAME — default: cinemasync
- GOOGLE_APPLICATION_CREDENTIALS — path to a service account file for server-side Drive features (used by service account operations)
- GOOGLE_CLIENT_ID — OAuth Client ID (for per-user Drive OAuth)
- GOOGLE_CLIENT_SECRET — OAuth Client Secret
- FIREBASE_SERVICE_ACCOUNT_KEY — path to Firebase service account JSON
- API_BASE_URL — public base URL for backend (used by Drive service when generating internal links); default http://localhost:5000

Note: The app no longer relies on a fixed GOOGLE_DRIVE_FOLDER_ID. The Drive “Root” view shows your own Drive videos using your OAuth tokens after connecting Google Drive from the UI.

Frontend environment variables (client/.env)
- VITE_API_BASE_URL — REST base; e.g., http://127.0.0.1:5000/api
- VITE_DEBUG_LOGS — optional; set to true for verbose logs

Common workflows

1) Connect Google Drive
- In the frontend, connect your Drive from Create Room (or the Movie Browser). You will be redirected for OAuth consent. After connecting, the Movie Browser “Root” will list your videos (type=video/*).

2) Create a room
- Select:
  - Google Drive: choose a Drive file to set immediately
  - Direct Link: paste a playable URL (mp4, webm, etc.)
  - Add Movie Later: create the room without a video
- Optionally set Private + Password for the room
- On success you’ll be sent to Theater page, and if a preset video existed (Drive or Direct link) the player will load immediately (no Browse UI)

3) Join a private room
- You’ll be prompted for the password (if set). Correct password is validated after normalization (trimmed). Socket acks and error messages help you fix mistakes without getting stuck in “joining”.

4) Change movie (host only)
- Only for Drive rooms. Host can open Movie Browser and pick a different Drive file. A “video_changed” sync event updates all viewers immediately.

5) Keyboard shortcuts
- Space: toggle play/pause (host-only control enforced; only when joined and a movie is selected)

Project details

Backend (Flask + Socket.IO)
- Launch entry: backend/run.py
- REST routes:
  - backend/app/routes.py — movies list/search/stream/metadata, recent, health
  - backend/app/room_routes.py — rooms CRUD and playback REST endpoints
  - backend/app/google_oauth_routes.py — Google OAuth endpoints
  - backend/app/auth_routes.py — exchange identity for backend JWT
- Socket.IO:
  - backend/app/socket_manager.py — connection, join_room, leave_room, update_playback, chat_message, reaction
  - Acknowledgements (acks) supported for join_room and update_playback; handlers return {'ok': True} or {'error': '...'} for precise errors
- Models (MongoDB):
  - backend/app/models.py — Room, MovieMetadata, User, UserToken; includes indexes and helpers

Frontend (Vite + React + MUI)
- App entry: client/src/main.jsx, client/src/App.jsx
- Pages: client/src/pages
  - Theater.jsx — core page for playback, chat, reactions; handles:
    - Room fetch and join
    - Password dialog
    - Movie preset detection (Drive/DirectLink)
    - Host-only controls (toggle, change movie)
    - “Browse Movies” hidden when a preset video is present
    - Spacebar keyboard shortcut to play/pause
  - CreateRoom.jsx — create room, choose source, connect Drive, set password
  - MyRooms.jsx — view and manage user rooms; edit/share/delete, and join
- Components: client/src/components
  - MovieBrowser.jsx — Drive browsing; Root displays user videos after Drive connection; folders and search supported
  - VideoPlayer.jsx — HTML5 video or YouTube iframe rendering, lightweight errors/loading UI
  - ChatPanel.jsx, PlaylistPanel.jsx, theater/UserList.jsx

Key behaviors to know
- Host-only control: Only host can play/pause or change the movie. The frontend guards these actions and the backend enforces them.
- Preset movie logic:
  - Drive or DirectLink set at room creation or via host “Change Movie”:
    - Theater page loads the video immediately (no Browse button shown by default)
  - “Add Later” rooms show “Browse Movies” only for the host
- Robust joins:
  - Password normalization avoids “Invalid password” false negatives
  - 10-second join timeout prevents the UI getting stuck; if timed out the join resets with an actionable message
  - Socket acks reduce generic “error” spam, surfacing precise error messages on client

API and Socket quick reference

Important REST endpoints (abbreviated)
- GET /api/health — Backend health check
- GET /api/movies/list — List movies (service account; used for folder navigation)
- GET /api/movies/recent — Recent movies (Mongo-first fallback, then root)
- GET /api/movies/search?q=…
- GET /api/movies/stream/:fileId — Generate a stream URL (proxy)
- GET /api/rooms/:id — Room details
- POST /api/rooms/ — Create room
- POST /api/rooms/:id/video — Set Drive video for room (host only)
- POST /api/rooms/:id/playback — Update playback via REST (host only) — note: Socket.IO is preferred for realtime updates

Important Socket.IO events (abbreviated)
- connect, connect_error — connection lifecycle
- join_room (ack) — Join a room (with password if needed)
- room_joined — Room snapshot upon join
- user_joined / user_left — presence updates
- update_playback (ack) — Host updates play/pause/time; backend broadcasts playback_updated
- playback_updated — Sync event for all clients
- video_changed — When host changes the movie
- error — Generic server errors (unexpected); normal flow uses acks for controlled errors

Troubleshooting

- “Invalid password” when joining private room
  - Ensure backend restarted with updated normalization
  - Check you enter the exact password set at room creation
  - Make sure there are no leading/trailing spaces

- UI stays “Joining…”
  - The client includes a 10-second timeout; if join does not complete, it resets
  - Check server logs for room existence and password checks
  - Verify JWT and CORS (see frontend VITE_API_BASE_URL and backend CORS settings)

- Socket connect_error “while connected”
  - Benign if already connected; client ignores this and proceeds
  - Check that your backend is reachable at http://127.0.0.1:5000, and that Socket.IO polling/websocket is not blocked by firewall/VPN

- Drive Root is empty
  - Ensure you connected Google Drive from the UI for your user
  - Confirm tokens exist (backend “tokens/status” route) and Google creds are valid
  - If service account is used, only shared items will appear via service account; use the per-user OAuth path for your own Drive files

- CORS / Base URL mismatch
  - Set client VITE_API_BASE_URL to http://127.0.0.1:5000/api
  - CORS is configured in backend/app/__init__.py; allowed origins include localhost:5173 and 127.0.0.1:5173

Security
- Use a strong JWT_SECRET in production
- Do not commit credentials (service accounts, client secrets, Firebase keys)
- Prefer TLS/HTTPS in production for both backend and frontend

Contributing
- Fork and open pull requests
- Please include clear commit messages and test steps
- For Socket.IO changes, include logs and describe client/ack handling

License
- This project is provided as-is. Add your preferred license here if applicable.

Useful links to files
- Backend entry: backend/run.py
- Flask app: backend/app/__init__.py
- REST routes: backend/app/routes.py, backend/app/room_routes.py
- Socket.IO: backend/app/socket_manager.py
- Models: backend/app/models.py
- Frontend app: client/src/App.jsx
- Theater page: client/src/pages/Theater.jsx
- Movie Browser: client/src/components/movies/MovieBrowser.jsx
- Video Player: client/src/components/theater/VideoPlayer.jsx
