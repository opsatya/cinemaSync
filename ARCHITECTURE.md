# CinemaSync — Architecture & Current State

This document describes what the code **actually does today**, verified by reading every backend and frontend file. It's been kept up to date through a full pass of bug fixes, three new features (playlist, real Profile data, WebSocket transport), and a follow-up hardening pass (path traversal fix, join-room rate limiting, eventlet monkey-patching, accessibility fixes, JWT expiry handling). Test suite: 30 backend (pytest + mongomock) + 21 frontend (Vitest + RTL) tests, all green.

## 0. Stack

- **Backend**: Flask + Flask-SocketIO + PyMongo (Python), `server/app/`, entry `server/run.py`
- **Frontend**: Vite + React + MUI, `client/src/`
- **DB**: MongoDB (no ODM — `models.py` is hand-rolled dict shaping, no schema validation)
- **Auth identity**: Firebase Authentication (client-side) bridged to a backend-minted JWT
- **Realtime**: Socket.IO over **eventlet**, with real WebSocket upgrade support (verified live at the protocol level — raw Engine.IO ping/pong probe → upgrade completes successfully), falling back to long-polling only when a WS upgrade isn't possible

## 1. Auth flow

```
Browser (Firebase SDK) --ID token--> POST /api/auth/exchange --> backend JWT --> localStorage['backendToken']
                                                                        |
                                                    used as Authorization: Bearer <jwt>
                                                    on every REST call and as socket.auth.token
```

- `client/src/firebase/config.js` initializes Firebase Auth. It throws at module load if Firebase env vars are missing — a misconfigured `.env` takes down the entire app, not just login.
- `client/src/utils/useFirebaseAuth.js`: on any Firebase auth state change, grabs a Firebase ID token and calls `POST /api/auth/exchange`. A cached `backendToken` from `localStorage` is now checked for expiry (`utils/jwt.js`'s `isJwtExpired`) before being trusted — an expired cached token triggers a fresh exchange instead of being used as-is. A background timer (every 5 min) also proactively refreshes the token before it expires, so a long-lived open tab doesn't silently go stale.
- `server/app/auth_routes.py` (`/api/auth/exchange`, rate-limited 20/min): verifies the Firebase ID token via `firebase_admin.auth.verify_id_token`, upserts a `User` document, and mints the app's own JWT (HS256, `JWT_SECRET`, ~3-day expiry).
- Every REST call and every Socket.IO connection uses only the backend JWT from then on. `auth_middleware.py`'s `token_required` decorator verifies it on protected REST routes; `socket_manager.py`'s `connect` handler verifies the same JWT and stores `user_id` in the Socket.IO session — all socket handlers trust that session value, never anything the client sends in the event payload.

## 2. Room lifecycle

- **Create**: `pages/CreateRoom.jsx` → `POST /api/rooms/` (JWT-protected). Backend generates an 8-char uppercase room ID, hashes the password with werkzeug if one was set, seeds `participants: [{host}]`, `playback_state`, and an empty `playlist: []`.
- **Fetch details**: `GET /api/rooms/:id` — public/no-auth (the password itself is the gate).
- **Join is Socket.IO-only in practice.** `POST /api/rooms/:id/join` and `POST /api/rooms/:id/leave` exist server-side and are fully implemented but never called by the frontend — real join/leave goes through the `join_room`/`leave_room` socket events. The REST versions are effectively dead code from the client's perspective (harmless — kept in case a future non-browser client wants a REST path).
- **Join (socket)**: `Theater.jsx` connects, emits `join_room {room_id, user_id, password?}`. Backend rate-limits this per authenticated user (20 attempts/min — this is the actual password-guessing surface, not the REST endpoint), validates room existence → password (hash, or legacy plaintext fallback) → `Room.add_participant` → `flask_socketio.join_room()` → emits `user_joined` to the room and a `room_joined` snapshot to the joiner.
- **Host detection**: `String(room.host_id) === String(user.uid)`, computed client-side for UI gating and re-checked server-side on every host-only action (`update_playback`, `set_room_video`, `update_room`, `delete_room`, playlist add/remove/play).
- **Leave / disconnect**: explicit `leave_room` works, and the socket `disconnect` handler now also removes the participant (mirroring `leave_room`'s logic via a `room_id` tracked in the socket session) — closing a tab, crashing, or losing network correctly cleans up, so `Room.remove_participant`'s "deactivate when empty" logic fires reliably instead of leaving ghost participants.
- **Delete**: `DELETE /api/rooms/:id` is a soft-deactivate (`is_active=False`), not a real delete — the row persists in Mongo. `MyRooms.jsx`'s delete confirmation now accurately describes this ("deactivate... won't be permanently erased") instead of implying real deletion.
- **Playlist** (new): `Room.playlist` is an array of `{item_id, type, video_id|value, video_name, added_by, added_at}`. Host-only endpoints under `/api/rooms/:id/playlist` — `POST` (add), `DELETE /:item_id` (remove), `POST /:item_id/play` (jump-to, sets `movie_source` and broadcasts `video_changed`; verifies the Drive file is still accessible first via `_verify_drive_access`, returning 409 instead of a false-success broadcast if it's gone). Adds/removes broadcast `playlist_updated` to the room.

## 3. Google Drive integration

Two separate code paths:

- **Service-account path** (`DriveService.service`) — backs the unauthenticated `GET /api/movies/list|search|recent|metadata/:id`. Only sees files explicitly shared with the service account. Used by `MovieBrowser.jsx`'s general folder browsing.
- **Per-user OAuth path** (`DriveService.user_service(user_id)`) — backs `google_oauth_routes.py`'s consent flow and `GET /api/rooms/videos/drive`. Powers the "Root" view (your own Drive videos) and video selection in `CreateRoom.jsx` / playlist add.
- **OAuth state handling**: `/api/google/auth/url` requires auth and always mints `state` from the caller's own verified backend JWT (never a client-supplied value); `_extract_user_id_from_state` only accepts a validly-signed JWT, with no unsigned-parsing fallback — closes the account-hijack path that used to exist here.
- **Streaming**: `GET /api/stream/:file_id` now parses incoming `Range` headers and returns real `206 Partial Content` (fetching just the requested byte span via the Drive API request's `Range` header), falling back to the original full-file chunked stream when no Range header is present. Seeking/scrubbing works.
- **Upload** (`POST /api/drive/upload`): filenames are sanitized via `werkzeug.utils.secure_filename` plus a uuid prefix (`_safe_upload_path`) before touching the filesystem — no path traversal / arbitrary file write.
- Token storage encryption (`TOKENS_ENC_KEY`) is opt-in in development, but `UserToken.save_tokens` now refuses to store tokens in plaintext when `FLASK_ENV=production` and no key is configured (returns `False`; the OAuth callback reports this as a real error instead of a false "connected" response).
- `list_movies()`'s cache key now includes `max_depth`, and each subfolder is queried from Drive exactly once (previously queried twice — once non-recursively just for `item_count`, once recursively for contents).

## 4. Realtime sync (Socket.IO)

Server (`socket_manager.py`, `async_mode='eventlet'`, `allow_upgrades=True`, `transports=['websocket', 'polling']`) registers: `connect` (JWT-gated), `disconnect` (cleans up the participant), `join_room` (rate-limited), `leave_room`, `update_playback`, `chat_message`, `reaction`. `video_changed` and `playlist_updated` are emitted from REST routes in `room_routes.py` using the shared `socketio` instance, not registered as socket event handlers themselves.

Frontend (`Theater.jsx`, `context/socket.js` — `transports: ['polling', 'websocket']`) listens for: `connect`, `room_joined`, `user_joined`, `user_left`, `playback_updated`, `new_chat_message`, `new_reaction`, `video_changed`, `playlist_updated`, `error`, `connect_error`.

`run.py` calls `eventlet.monkey_patch()` **before any other import** (this ordering matters — patching after Flask/pymongo/etc. are already imported leaves them half-patched and throws at runtime instead of actually enabling cooperative I/O). `requirements.txt` pins `eventlet==0.41.2` (the previous `0.33.3` pin predates Python 3.12 support and fails to import at all on this stack — worth knowing eventlet itself is now upstream-deprecated/bugfix-only, so a future migration to gevent or an ASGI server is worth considering once Docker/deploy work starts).

## 5. Data models (`server/app/models.py`)

No ODM/schema validation — plain dict shaping via static methods:

- **Room**: `room_id, host_id, name, description, movie_source{type, value|video_id, video_name}, password_hash, is_private, enable_chat, enable_reactions, max_participants, participants[{user_id, is_host, joined_at}], playback_state{is_playing, current_time, last_updated}, playlist[{item_id, type, video_id|value, video_name, added_by, added_at}], created_at, updated_at, is_active`. A legacy plaintext `password` field is still checked as a fallback alongside `password_hash` in every password comparison — vestigial migration path, left as-is (not a live bug, just hygiene debt).
- **MovieMetadata**: `file_id, id, name, mimeType, size, thumbnailLink, type, updated_at` — a text-indexed cache in front of Drive API results.
- **UserToken**: `user_id, provider, token_type, scope, expiry, access_token(_enc), refresh_token(_enc), created_at, updated_at, invalidated_at, invalid_reason`.
- **User**: `user_id, name, email, created_at, updated_at, last_login` — minimal, no bio/avatar/role fields. `Profile.jsx` no longer implies these exist — its stats/lists are derived entirely from `Room` documents via the existing `fetchMyRooms` call (rooms-created count, distinct-movies-watched count, recently-watched list), not from any nonexistent `User` fields.

## 6. Frontend structure

- **Routing** (`App.jsx`, react-router-dom v6): `/login`, `/register` (public-only); `/`, `/theater/:roomId`, `/profile`, `/create-room`, `/my-rooms` (protected, under `MainLayout`).
- **State**: no Redux/React Query. Plain Context (`AuthContext` wraps `useFirebaseAuth`) plus per-component local state — `Theater.jsx` alone has 15+ `useState` calls.
- **API client** (`utils/api.js`): fetch-based, no interceptor layer — every function hand-repeats header construction and error unwrapping.
- **Socket URL** (`context/socket.js`), API base URL (`utils/api.js`), and the dev proxy (`vite.config.js`) each resolve "where's the backend" independently — three separate algorithms, still a footgun for prod config drift (not changed this pass; flagged for whenever the Docker/deploy work happens).
- `UserList.jsx` and `PlaylistPanel.jsx` render real participant/playlist data (previously read nonexistent fields / had no interactivity respectively); `MovieBrowser.jsx` accepts a `mode` prop (`'change'` vs `'addToPlaylist'`) so its dialog title and per-item action label correctly reflect whether picking a video changes what's playing now or just queues it.

## 7. Config / env

Backend reads (via `os.getenv`): `FLASK_ENV, SECRET_KEY, GOOGLE_APPLICATION_CREDENTIALS, API_BASE_URL, JWT_SECRET, JWT_EXPIRES_MIN, MONGODB_URI, MONGODB_DB_NAME, FIREBASE_SERVICE_ACCOUNT_KEY, FRONTEND_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_PROJECT_ID, GOOGLE_REDIRECT_URI, OAUTH_SUCCESS_REDIRECT, TOKENS_ENC_KEY, FLASK_DEBUG`.

Frontend reads: `VITE_API_BASE_URL, VITE_SOCKET_URL, VITE_DEBUG_LOGS`, plus 6 `VITE_FIREBASE_*` keys.

## 8. Known remaining rough edges (not bugs, just debt)

- REST `join`/`leave` room endpoints are fully implemented but unused by the current frontend (harmless — could serve a future non-browser client).
- Legacy plaintext `password` fallback in `Room` password checks is dead-but-harmless migration debt.
- Frontend has three independent "where's the backend" URL-resolution algorithms (§6) — fine for dev, worth consolidating before a real multi-environment deploy.
- Production JS bundle is a single ~950KB chunk — no code-splitting yet (`vite build`'s own warning); worth revisiting once the app has more routes worth lazy-loading.
- `eventlet` is upstream-deprecated (bugfix-mode only) — fine for now, worth reconsidering (gevent, or an ASGI server) when the Docker/EC2 deployment work starts.
