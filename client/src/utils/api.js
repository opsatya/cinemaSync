// API service for CinemaSync
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api';

/**
 * Fetch movies list from Google Drive
 * @param {string} folderId - Optional folder ID to list
 * @param {boolean} recursive - Whether to fetch recursively
 * @param {number} maxDepth - Maximum depth for recursive fetching
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
    console.error('Error fetching movies list:', error);
    throw error;
  }
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
    console.error('Error getting movie metadata:', error);
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
    console.error('Error searching movies:', error);
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
    console.error('Error getting recent movies:', error);
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

export default {
  fetchMoviesList,
  getStreamLink,
  getMovieMetadata,
  searchMovies,
  getRecentMovies,
  getDirectStreamUrl
};
