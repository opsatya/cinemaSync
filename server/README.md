# CinemaSync Backend (Flask + Socket.IO)

Service layer for rooms, synchronized playback, Google Drive integration, and authentication. This app exposes REST endpoints under `/api` and a Socket.IO server for realtime events.

Key entry points
- [python.create_app()](backend/app/__init__.py:28) — Flask app factory, CORS, blueprints, Socket.IO init
- [python.socketio.run()](backend/run.py:6) — Development server runner
- [python.register_handlers()](backend/app/socket_manager.py:35) — Socket.IO event handlers
- [python.room_bp](backend/app/room_routes.py:11) — Room REST endpoints
- [python.api_bp](backend/app/routes.py:11) — Movies/search/stream/metadata/health REST endpoints
- [python.google_bp](backend/app/google_oauth_routes.py:90) — Google OAuth flow
- [python.auth_bp](backend/app/auth_routes.py:1) — Identity exchange to backend JWT
- [python.Room](backend/app/models.py:346) — MongoDB Room model
- [python.MovieMetadata](backend/app/models.py:88) — Movie metadata store
- [python.UserToken](backend/app/models.py:216) — Google OAuth tokens per user

Run locally

Prerequisites
- Python 3.10+
- MongoDB instance (local or remote)
- Google Cloud OAuth credentials (Client ID/Secret)
- Firebase Admin service account JSON

Setup
1) Create a virtual environment and install dependencies:
   - python -m venv .venv
   - source .venv/bin/activate  (Windows: .venv\\Scripts\\activate)
   - pip install -r requirements.txt

2) Create `.env`:
   - cp .env.example .env
   - Fill values as described below

3) Start server:
   - python [run.py](backend/run.py:1)
   - Default: http://127.0.0.1:5000 (REST base at /api)

Environment variables (.env)

Required
- JWT_SECRET — Strong random secret for signing backend JWTs
- MONGODB_URI — e.g., mongodb://localhost:27017
- MONGODB_DB_NAME — e.g., cinemasync
- GOOGLE_APPLICATION_CREDENTIALS — Path to a service account JSON for service-account Drive operations
- GOOGLE_CLIENT_ID — Google OAuth Client ID
- GOOGLE_CLIENT_SECRET — Google OAuth Client Secret
- FIREBASE_SERVICE_ACCOUNT_KEY — Path to Firebase service account JSON

Optional
- API_BASE_URL — Public base (default http://localhost:5000). Used by stream link builder.
- FRONTEND_URL — Frontend origin, added to CORS allowlist

Notes
- The app no longer relies on a fixed GOOGLE_DRIVE_FOLDER_ID. Root listing and recent fallbacks use Drive root or user-owned OAuth listing.

Architecture overview

Initialization and configuration
- [python.create_app()](backend/app/__init__.py:28) wires CORS, initializes Mongo ([python.init_db()](backend/app/models.py:65)), Firebase ([python.init_firebase()](backend/app/firebase_admin.py:1)), and registers REST blueprints:
  - [python.api_bp](backend/app/routes.py:11)
  - [python.room_bp](backend/app/room_routes.py:11)
  - [python.auth_bp](backend/app/auth_routes.py:1)
  - [python.google_bp](backend/app/google_oauth_routes.py:90)
- Socket.IO set up at [python.init_socketio()](backend/app/socket_manager.py:20) and handlers at [python.register_handlers()](backend/app/socket_manager.py:35)

Data models (MongoDB)
- [python.MovieMetadata](backend/app/models.py:88) — search and recent indexing for videos
- [python.UserToken](backend/app/models.py:216) — per-user Google OAuth tokens (access/refresh) with upsert
- [python.User](backend/app/models.py:288) — user profile store
- [python.Room](backend/app/models.py:346) — room creation, lookup, participants, playback state, active/inactive

Google Drive integration
- Service account (server-wide browsing/metadata): [python.DriveService.service](backend/app/drive_service.py:90)
- Per-user OAuth (user’s Drive videos): [python.DriveService.user_service()](backend/app/drive_service.py:148), [python.list_user_videos()](backend/app/drive_service.py:299)
- Streaming proxy (chunked): [python.api_bp stream_file](backend/app/routes.py:94)

Realtime (Socket.IO)
Core events (server):
- [python.handle_join_room](backend/app/socket_manager.py:49)
  - Validates room/password, adds participant, joins room, emits room_joined, supports ack ({ok|error})
- [python.handle_leave_room](backend/app/socket_manager.py:112)
  - Removes participant, emits user_left
- [python.on_update_playback](backend/app/socket_manager.py:153)
  - Validates host and membership, updates playback state, emits playback_updated, supports ack
- [python.handle_chat_message](backend/app/socket_manager.py:228)
  - Validates membership and chat enabled, emits new_chat_message
- [python.handle_reaction](backend/app/socket_manager.py:282)
  - Validates membership and reactions enabled, emits new_reaction

REST endpoints (selected)
- Health and movies:
  - [python.api_bp.health](backend/app/routes.py:23)
  - [python.api_bp.get_movies_list](backend/app/routes.py:42)
  - [python.api_bp.get_recent_movies](backend/app/routes.py:238) — fallback uses Drive root
  - [python.api_bp.search_movies](backend/app/routes.py:192)
  - [python.api_bp.stream_file](backend/app/routes.py:94)
- Rooms:
  - [python.room_bp.create_room](backend/app/room_routes.py:63)
  - [python.room_bp.get_room](backend/app/room_routes.py:256)
  - [python.room_bp.get_my_rooms](backend/app/room_routes.py:302)
  - [python.room_bp.join_room](backend/app/room_routes.py:361)
  - [python.room_bp.leave_room](backend/app/room_routes.py:436)
  - [python.room_bp.update_playback_state](backend/app/room_routes.py:484)
  - [python.room_bp.set_room_video](backend/app/room_routes.py:694) — host sets Drive file as room movie
- Google OAuth (per-user Drive):
  - [python.google_bp](backend/app/google_oauth_routes.py:90)

Auth and identity
- Client authenticates with Firebase; frontend exchanges Firebase ID token for backend JWT at [python.auth_bp.exchange](backend/app/auth_routes.py:1)
- Socket.IO attaches JWT via `socket.auth = { token }` (frontend), backend can validate per event if implemented

Common flows

Create room
1) Client POST [python.room_bp.create_room](backend/app/room_routes.py:63) with movie_source type:
   - googleDrive: user selects Drive file later via [python.room_bp.set_room_video](backend/app/room_routes.py:694)
   - directLink: saves URL in movie_source
   - uploadLater: creates room without video
2) Server stores room, host added as first participant

Join private room
1) Client connects to Socket.IO; detects private room and opens password dialog
2) Client emits join_room with password; server normalizes and compares
3) On success, server emits room_joined and ack {'ok': True}

Synchronized playback (host)
1) Host toggles play/pause → emits update_playback with state
2) Server validates host/membership; updates Room playback_state and emits playback_updated to room

Drive streaming
- Frontend uses URLs from:
  - [javascript.getUserDriveStreamUrl()](client/src/utils/api.js:232) for user-owned files (`/api/stream/:fileId?owner=user&user_id=:uid`)
  - [javascript.getDirectStreamUrl()](client/src/utils/api.js:220) for service-account based streaming (`/api/stream/:fileId`)
- Server proxies data chunked in [python.api_bp.stream_file](backend/app/routes.py:94)

Troubleshooting

“Invalid password” on correct input
- Backend compares normalized passwords; ensure you restarted after edits
- Check payload in join events is sent (client password dialog), and verify server logs in [python.handle_join_room](backend/app/socket_manager.py:49)

“Only host can control playback”
- Host is validated by string comparison; ensure IDs are strings, and client uses normalized host check

UI stuck in “joining…”
- Client includes a 10s join timeout. If join takes longer, UI resets; check server console for join failures

CORS / base URL mismatches
- Allowed origins are configured in [python.create_app()](backend/app/__init__.py:31)
- Ensure the frontend uses http://127.0.0.1:5000/api or consistent hostnames

Security notes
- Set a strong JWT_SECRET in production (the app warns if default is used)
- Do not commit secrets (Google/Firebase/service accounts)
- Prefer HTTPS for production deployments

Development tips
- Use MongoDB indexes created in [python.Room.get_collection](backend/app/models.py:351) and [python.MovieMetadata.get_collection](backend/app/models.py:93)
- Toggle additional prints/logging in endpoints and socket handlers while debugging

License
- Add your preferred license here.