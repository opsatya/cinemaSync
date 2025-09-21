# CinemaSync – Setup, Debugging, and Configuration Guide

This document explains how to configure the client and backend, align authentication origins, set up Firebase and Google OAuth, and run the project in development. It also documents known failure modes and how we addressed them.

WHAT WAS FIXED

Authentication and Origins
- Vite dev host alignment:
  - Vite now binds to localhost instead of 127.0.0.1 to match Firebase’s default authorized domains.
- API/Sockets origin alignment:
  - The client API base URL falls back to same-origin /api to avoid 127.0.0.1 vs localhost mismatches.
  - Socket.IO client prefers same-origin or VITE_SOCKET_URL, avoiding mixed-origin issues.
- Backend CORS:
  - Explicit allowed origins: http://localhost:5173 and http://127.0.0.1:5173 (plus FRONTEND_URL from env).
  - Credentials-friendly CORS headers (Authorization added to allowed/exposed headers).
- Firebase demo config:
  - The client now fails fast if Firebase uses demo project fallback to prevent silent auth/analytics failures.

Rooms REST API
- Correct routes:
  - /api/rooms/ for list, /api/rooms/<room_id> for details, /<room_id>/join, /<room_id>/leave, /<room_id>/playback, /<room_id>/video.
  - No duplicate or double-slash routes.
- “My Rooms” reliability:
  - Normalized host_id and participant user_id to string on create/join/leave/remove, preventing type mismatch queries.
  - Added indexes for performance and query stability (room_id unique, host_id, participants.user_id).
- Video/set playback host checks:
  - Normalized ID types in host validation to avoid false “Only host can control playback”.

Movies and Drive
- User Drive endpoints:
  - 401 for missing tokens is preserved with clear messaging.
  - Movie metadata upsert implemented (MovieMetadata.save_metadata) with unique index on file_id.

Socket.IO
- Server CORS:
  - Aligned with Flask CORS using explicit origins (localhost/127.0.0.1 and FRONTEND_URL).
- Version alignment:
  - socket.io-client ^4.7.5 in the client with Flask-SocketIO 5.3.6.
- Host/type equality:
  - Normalized type equality checks for host and participants.

MongoDB Modeling
- Indexes:
  - Rooms: room_id (unique), host_id, participants.user_id.
  - Users: user_id (unique).
  - User tokens: compound (user_id + provider) unique.
- Type normalization:
  - Stored user IDs are normalized to strings to avoid heterogenous types.

Client Integration
- Favorites stability:
  - MyRooms now uses stable string IDs, persisted in localStorage.
- API base URL:
  - Same-origin /api fallback avoids mismatched hosts during dev.

Security
- JWT secret warning:
  - In production, warns if JWT_SECRET is left as default value.

WHAT STILL REQUIRES ENV/DEPLOY SETUP

- Firebase web app credentials:
  - You must define VITE_FIREBASE_* in client/.env for real authentication.
- Google Drive service account:
  - For service-account-backed endpoints, set GOOGLE_APPLICATION_CREDENTIALS on the backend. Without this, requests that require the service account will fail with “Google Drive credentials file not found” (intended and handled in UI logs).
- Google OAuth (per-user Drive):
  - For user Drive features, set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
- JWT secret:
  - You must set a strong JWT_SECRET in the backend .env for production.

PREREQUISITES

- Node.js (LTS), npm
- Python 3.10+
- MongoDB running locally or a remote cluster
- Firebase project with Web App credentials
- Optional: Google Cloud service account JSON for Drive (for service account mode)
- Optional: Google OAuth client for per-user Drive functionality

ENVIRONMENT VARIABLES

Create backend/.env (see backend/.env.example):
- FLASK_ENV=development
- MONGODB_URI=mongodb://localhost:27017
- MONGODB_DB_NAME=cinemasync
- JWT_SECRET=replace-with-a-strong-secret
- API_BASE_URL=http://localhost:5000/api
- FRONTEND_URL=http://localhost:5173
- GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
- GOOGLE_CLIENT_ID=your-google-oauth-client-id
- GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

Create client/.env (see client/.env.example):
- VITE_FIREBASE_API_KEY=...
- VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
- VITE_FIREBASE_PROJECT_ID=...
- VITE_FIREBASE_STORAGE_BUCKET=...
- VITE_FIREBASE_MESSAGING_SENDER_ID=...
- VITE_FIREBASE_APP_ID=...
- Optional (override if needed):
  - VITE_API_BASE_URL=http://localhost:5000/api
  - VITE_SOCKET_URL=http://localhost:5000
  - VITE_DEBUG_LOGS=true

INSTALL AND RUN

Backend
1) Create and fill backend/.env
2) Install dependencies:
   - python -m venv .venv && source .venv/bin/activate
   - pip install -r backend/requirements.txt
3) Run the app (from repo root):
   - python backend/run.py
   The server runs at http://localhost:5000 with API at /api

Client
1) Create and fill client/.env
2) Install dependencies:
   - cd client && npm install
3) Run dev server:
   - npm run dev
   Vite runs at http://localhost:5173

KEY ENDPOINTS

- Health checks:
  - Backend: GET http://localhost:5000/health
  - API: GET http://localhost:5000/api/health
- Rooms:
  - GET /api/rooms/ (public active rooms)
  - GET /api/rooms/my-rooms (JWT required)
  - GET /api/rooms/<room_id>
  - POST /api/rooms/ (JWT required) – create
  - POST /api/rooms/<room_id>/join (JWT required)
  - POST /api/rooms/<room_id>/leave (JWT required)
  - POST /api/rooms/<room_id>/playback (host only)
  - POST /api/rooms/<room_id>/video (host only)
- Movies / Drive (service account):
  - GET /api/movies/list
  - GET /api/movies/stream/<file_id>
  - GET /api/movies/metadata/<file_id>
  - GET /api/movies/search?q=...
  - GET /api/movies/recent
- User Drive (OAuth):
  - GET /api/rooms/videos/drive (JWT required)
  - GET /api/google/health
  - GET /api/google/auth/url
  - GET /api/google/tokens/status

COMMON PITFALLS AND DIAGNOSIS

- Firebase “unauthorized-domain” error:
  - Ensure Vite dev runs on http://localhost:5173 and add “localhost” to Firebase Authorized domains.
  - Ensure client/.env Firebase values are set; the client now throws a hard error if a demo config is detected.

- CORS with credentials:
  - Backend explicitly allows http://localhost:5173 and http://127.0.0.1:5173 and supports Authorization header.
  - For production, set FRONTEND_URL and ensure it matches the deployed frontend origin exactly.

- Google Drive credentials:
  - If GOOGLE_APPLICATION_CREDENTIALS is missing, service-account endpoints will fail with “Google Drive credentials file not found”.
  - The client reduces noise in logs but you should set credentials for full functionality.

- Socket.IO:
  - Client uses socket.io-client ^4.7.5 and server uses Flask-SocketIO 5.3.6.
  - Client socket defaults to same origin where possible to avoid mixed origins.

- MongoDB:
  - Indexes are created for rooms, users, and tokens. Ensure MongoDB is reachable via MONGODB_URI.

SECURITY NOTES

- Use a strong JWT_SECRET in production.
- Never commit real secrets or Google service account JSON to the repo.
- Restrict CORS in production to your exact frontend origin only.

ARCHITECTURE NOTES

- Backend: Flask (REST) + Flask-SocketIO for realtime events, MongoDB for persistence.
- Client: React + Vite + Firebase Authentication, integrates REST and Socket.IO.
- Drive integration supports both service account (app-owned) and OAuth (user-owned) modes.

CHANGELOG (recent fixes)

- CORS origins enumerated; Authorization header allowed/exposed.
- Firebase config fails hard on demo defaults.
- Vite host bound to localhost.
- Room/user ID normalization to strings; added key indexes.
- Fixed backend route imports and signatures; safer Content-Disposition header quoting.
- Socket.IO CORS allowed origins aligned; host/participant equality normalized.
- API base default: same-origin fallback to avoid host mismatches.
- MyRooms favorites stabilized and persisted to localStorage.
- Implemented MovieMetadata.save_metadata with unique index on file_id.

SUPPORT

If you hit configuration-related errors:
- Confirm client/.env and backend/.env match this README.
- Check server logs for CORS warnings and JWT warnings.
- Validate Firebase authorized domains and web app credentials.
- Ensure MongoDB is running and reachable.
