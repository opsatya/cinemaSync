// movie_source.type has drifted between camelCase (set by CreateRoom.jsx:
// 'directLink'/'googleDrive') and snake_case (set by the backend: set_room_video
// and the playlist endpoints both use 'google_drive'/'direct_link'). Normalize
// once here instead of ad hoc dual-checks scattered across the codebase.
const normalize = (type) => String(type || '').toLowerCase().replace(/_/g, '');

export const isDirectLinkType = (type) => normalize(type) === 'directlink';
export const isGoogleDriveType = (type) => normalize(type) === 'googledrive';
