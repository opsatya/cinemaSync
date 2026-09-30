import os
import re
import time
from functools import wraps
from flask import request, jsonify

# Cache utility
class SimpleCache:
    """A simple in-memory cache utility"""
    def __init__(self, default_ttl=300):
        self.cache = {}
        self.expiry = {}
        self.default_ttl = default_ttl  # Default TTL in seconds
    
    def get(self, key):
        """Get a value from cache if it exists and is not expired"""
        if key in self.cache and time.time() < self.expiry.get(key, 0):
            return self.cache[key]
        return None
    
    def set(self, key, value, ttl=None):
        """Set a value in the cache with a TTL"""
        if ttl is None:
            ttl = self.default_ttl
        
        self.cache[key] = value
        self.expiry[key] = time.time() + ttl
    
    def delete(self, key):
        """Remove a key from the cache"""
        if key in self.cache:
            del self.cache[key]
        if key in self.expiry:
            del self.expiry[key]
    
    def clear(self):
        """Clear all cache entries"""
        self.cache = {}
        self.expiry = {}

# File utilities
def get_file_extension(filename):
    """Extract file extension from filename"""
    if not filename:
        return None
    return os.path.splitext(filename)[1].lower()

def is_video_file(filename):
    """Check if a file is a video based on its extension"""
    video_extensions = [
        '.mp4', '.mkv', '.mov', '.avi', '.wmv', '.webm', '.flv', '.m4v'
    ]
    ext = get_file_extension(filename)
    return ext in video_extensions

# API utilities
def api_response(data=None, message=None, success=True, status_code=200):
    """Standardized API response format"""
    response = {
        'success': success
    }
    
    if data is not None:
        response['data'] = data
    
    if message is not None:
        response['message'] = message
    
    return jsonify(response), status_code

# Decorator for API rate limiting (simple implementation)
def rate_limit(limit=100, per=60):
    """Simple rate limiting decorator"""
    def decorator(f):
        # Store IP -> list of request timestamps
        requests = {}
        
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip = request.remote_addr
            now = time.time()
            
            # Initialize if IP not seen before
            if ip not in requests:
                requests[ip] = []
            
            # Clean old requests
            requests[ip] = [t for t in requests[ip] if now - t < per]
            
            # Check if rate limit exceeded
            if len(requests[ip]) >= limit:
                return api_response(
                    message="Rate limit exceeded",
                    success=False,
                    status_code=429
                )
            
            # Add current request timestamp
            requests[ip].append(now)
            
            return f(*args, **kwargs)
        return wrapped
    return decorator
