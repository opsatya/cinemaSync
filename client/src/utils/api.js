// API service for CinemaSync
const API_BASE_URL = (() => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string') return envUrl;
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    // Fallback to same-origin /api to avoid 127.0.0.1 vs localhost mismatch
    return `${window.location.origin.replace(/\/$/, '')}/api`;
  }
  // Final fallback
  return 'http://localhost:5000/api';
})();
const DEBUG = import.meta.env.VITE_DEBUG_LOGS === 'true';

// Helper to create authenticated headers
const getAuthHeaders = (token) => {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
};

/**
 * Fetch movies list from Google Drive
 * @param {string} folderId - Optional folder ID to list
 * @param {boolean} recursive - Whether to fetch recursively
 * @param {number} maxDepth m depth for recursive fetching
 * @returns {Promise} - Promise with movies data
 */
export const fetchMoviesList = async (folderId = null, recursive = false, maxDepth = 2) => {
  try {
    let url = `${API_BASE_URL}/movies/list`;
    const params = new URLSearchParams();
    
    if (folderId) {
      params.append('folder_id', folderId);
    }
    
    if (recursive) {
      params.append('recursive', 'true');
      params.append('max_depth', maxDepth.toString());
    }
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch movies list');
    }
    
    return data;
  } catch (error) {
    const msg = error?.message || String(error);
    if (/google drive credentials file not found/i.test(msg)) {
      // Avoid noisy errors for expected missing Drive creds in dev
      if (DEBUG) console.warn('Drive not configured (movies list):', msg);
    } else {
      if (DEBUG) console.error('Error fetching movies list:', error);
    }
    throw error;
  }
};

// Google OAuth helpers (per-user Drive)
export const getGoogleHealth = async () => {
  const res = await fetch(`${API_BASE_URL.replace(/\/api$/, '')}/api/google/health`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Health check failed');
  return data;
};

export const getGoogleAuthUrl = async (token) => {
  const res = await fetch(`${API_BASE_URL.replace(/\/api$/, '')}/api/google/auth/url`, {
    headers: token ? getAuthHeaders(token) : undefined,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to get Google auth URL');
  return data.auth_url;
};

export const getGoogleTokensStatus = async (token) => {
  const res = await fetch(`${API_BASE_URL.replace(/\/api$/, '')}/api/google/tokens/status`, {
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to get tokens status');
  return data.connected;
};

// List user's Drive videos (after OAuth connection)
export const fetchDriveVideos = async (token) => {
  const res = await fetch(`${API_BASE_URL}/rooms/videos/drive`, {
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to fetch Drive videos');
  // Expecting data.videos to be an array of { id, name, mimeType, ... }
  return data.videos || [];
};

// Set selected video for a room
export const setRoomVideo = async (roomId, payload, token) => {
  const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/video`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to set room video');
  return data.room;
};

// Update room (host only). Supports partial updates like { name, description, is_private, password, enable_chat, enable_reactions }
export const updateRoom = async (roomId, payload, token) => {
  const res = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to update room');
  return data.room;
};

// Delete/deactivate room (host only)
export const deleteRoom = async (roomId, token) => {
  const res = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to delete room');
  return true;
};

/**
 * Get streaming link for a movie
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise} - Promise with streaming URL
 */
export const getStreamLink = async (fileId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/movies/stream/${fileId}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to get streaming link');
    }
    
    return data.stream_url;
  } catch (error) {
    console.error('Error getting stream link:', error);
    throw error;
  }
};

/**
 * Get movie metadata
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise} - Promise with movie metadata
 */
export const getMovieMetadata = async (fileId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/movies/metadata/${fileId}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to get movie metadata');
    }
    
    return data.metadata;
  } catch (error) {
    if (DEBUG) console.error('Error getting movie metadata:', error);
    throw error;
  }
};

/**
 * Search for movies by name
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results
 * @returns {Promise} - Promise with search results
 */
export const searchMovies = async (query, limit = 20) => {
  try {
    const params = new URLSearchParams({
      q: query,
      limit: limit.toString()
    });
    
    const response = await fetch(`${API_BASE_URL}/movies/search?${params.toString()}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to search movies');
    }
    
    return data.results;
  } catch (error) {
    if (DEBUG) console.error('Error searching movies:', error);
    throw error;
  }
};

/**
 * Get recently accessed movies
 * @param {number} limit - Maximum number of results
 * @returns {Promise} - Promise with recent movies
 */
export const getRecentMovies = async (limit = 20) => {
  try {
    const params = new URLSearchParams({
      limit: limit.toString()
    });
    
    const response = await fetch(`${API_BASE_URL}/movies/recent?${params.toString()}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to get recent movies');
    }
    
    return data.movies;
  } catch (error) {
    const msg = error?.message || String(error);
    if (/google drive credentials file not found/i.test(msg)) {
      if (DEBUG) console.warn('Drive not configured (recent movies):', msg);
    } else {
      if (DEBUG) console.error('Error getting recent movies:', error);
    }
    throw error;
  }
};

/**
 * Direct streaming URL (for use in video player)
 * @param {string} fileId - Google Drive file ID
 * @returns {string} - Direct streaming URL
 */
export const getDirectStreamUrl = (fileId) => {
  return `${API_BASE_URL}/stream/${fileId}`;
};

/**
 * User-owned Google Drive streaming URL.
 * Uses per-user OAuth by passing owner=user and the user's id in query.
 * Note: This avoids needing Authorization headers on video tag requests.
 * @param {string} fileId
 * @param {string} userId
 * @returns {string}
 */
export const getUserDriveStreamUrl = (fileId, userId) => {
  const uid = encodeURIComponent(userId || '');
  return `${API_BASE_URL}/stream/${fileId}?owner=user&user_id=${uid}`;
};

/**
 * Test network connectivity to the backend
 * @returns {Promise<boolean>} - Whether the backend is reachable
 */
export const testBackendConnectivity = async () => {
  try {
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return response.ok;
  } catch (error) {
    if (DEBUG) console.error('Backend connectivity test failed:', error);
    return false;
  }
};

/**
 * Exchange a user identity for a backend JWT.
 * @param {object} identity - User identity object { user_id, name, email }
 * @param {string} idToken - Firebase ID token
 * @returns {Promise<string>} - The backend JWT.
 */
export const exchangeToken = async (identity, idToken) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(identity),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to exchange token: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();

    if (!data.token) {
      throw new Error(data.message || 'Backend did not return a token');
    }

    return data.token;
  } catch (error) {
    if (DEBUG) console.error('Error exchanging token:', error);
    throw error;
  }
};


/**
 * Fetch rooms the current user is a part of.
 * @param {string} token - The user's backend JWT
 * @returns {Promise<Array>}
 */
export const fetchMyRooms = async (token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/rooms/my-rooms`, {
      headers: getAuthHeaders(token),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch rooms');
    }
    return data.rooms;
  } catch (error) {
    if (DEBUG) console.error('Error fetching my rooms:', error);
    throw error;
  }
};

/**
 * Create a new room
 * @param {object} roomData - The data for the new room
 * @param {string} token - The user's backend JWT
 * @returns {Promise<object>}
 */
export const createRoom = async (roomData, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/rooms/`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(roomData),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to create room');
    }
    return data.room;
  } catch (error) {
    if (DEBUG) console.error('Error creating room:', error);
    throw error;
  }
};

/**
 * Get details for a specific room
 * @param {string} roomId
 * @returns {Promise<object>}
 */
export const getRoomDetails = async (roomId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/rooms/${roomId}`);
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Room not found');
    }
    return data.room;
  } catch (error) {
    if (DEBUG) console.error('Error getting room details:', error);
    throw error;
  }
};

export default {
  fetchMoviesList,
  getStreamLink,
  getMovieMetadata,
  searchMovies,
  getRecentMovies,
  getDirectStreamUrl,
  getUserDriveStreamUrl,
  exchangeToken,
  fetchMyRooms,
  createRoom,
  getRoomDetails,
  getGoogleAuthUrl,
  getGoogleTokensStatus,
  fetchDriveVideos,
  setRoomVideo,
  updateRoom,
  deleteRoom,
};
