import os
import json
import time
import jwt
import requests
from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaFileUpload
from googleapiclient.errors import HttpError
import io
import re

def get_user_videos(access_token):
    """Get user's Google Drive video files"""
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        creds = Credentials(token=access_token)
        drive_service = build('drive', 'v3', credentials=creds)
        
        # Query for video files only
        query = "mimeType contains 'video/' and trashed=false"
        
        results = drive_service.files().list(
            q=query,
            fields="files(id, name, mimeType, size, createdTime)",
            pageSize=50
        ).execute()
        
        videos = results.get('files', [])
        
        return [{
            'id': video['id'],
            'name': video['name'],
            'mimeType': video['mimeType'],
            'size': video.get('size'),
            'createdTime': video.get('createdTime')
        } for video in videos]
        
    except Exception as e:
        print(f"❌ Error getting user videos: {e}")
        return []

def get_video_stream_url(video_id, access_token):
    """Get streamable URL for video"""
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        creds = Credentials(token=access_token)
        drive_service = build('drive', 'v3', credentials=creds)
        
        # Get file metadata and download URL
        file_info = drive_service.files().get(
            fileId=video_id,
            fields="webContentLink, webViewLink"
        ).execute()
        
        return {
            'stream_url': f"https://drive.google.com/file/d/{video_id}/preview",
            'download_url': file_info.get('webContentLink')
        }
        
    except Exception as e:
        print(f"❌ Error getting video stream URL: {e}")
        return None

JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key')
API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:5000/api')

# Enforce a real secret in production to prevent token forgery
if os.getenv('FLASK_ENV') == 'production' and JWT_SECRET == 'your-secret-key':
    raise RuntimeError('JWT_SECRET must be set via environment in production')

def get_google_auth_url(user_id):
    state = jwt.encode({'user_id': user_id}, JWT_SECRET, algorithm='HS256')
    response = requests.get(f"{API_BASE_URL}/google/auth/url", params={'state': state})
    print(response.json()['auth_url'])

class DriveService:
    def __init__(self):
        self._service = None
        self._token_expiry = 0
        self._cache = {}
        self._cache_expiry = {}
        self._cache_duration = 300  # Cache duration in seconds (5 minutes)
        self._user_services = {}
    
    @property
    def service(self):
        """Get or create Google Drive service"""
        current_time = time.time()
        
        # Check if service exists and token is still valid
        if self._service is None or current_time >= self._token_expiry:
            # Load credentials from the service account file
            credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
            
            if not credentials_path or not os.path.exists(credentials_path):
                raise Exception("Google Drive credentials file not found")
            
            credentials = service_account.Credentials.from_service_account_file(
                credentials_path,
                scopes=['https://www.googleapis.com/auth/drive.readonly']
            )
            
            # Build the service
            self._service = build('drive', 'v3', credentials=credentials)
            # Set token expiry (1 hour is typical for Google API tokens)
            self._token_expiry = current_time + 3600
        
        return self._service

    # ---------- Per-user OAuth service ----------
    def _get_user_credentials(self, user_id):
        """Build google.oauth2.credentials.Credentials for a user from stored tokens"""
        from app.models import UserToken
        record = UserToken.get_tokens(user_id, 'google')
        if not record:
            raise Exception('No Google tokens found for user')
        creds = Credentials(
            token=record.get('access_token'),
            refresh_token=record.get('refresh_token'),
            token_uri='https://oauth2.googleapis.com/token',
            client_id=os.getenv('GOOGLE_CLIENT_ID'),
            client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
            scopes=['https://www.googleapis.com/auth/drive.file']
        )
        # Refresh if needed
        if not creds.valid and creds.refresh_token:
            creds.refresh(Request())
            # Persist updated access token/expiry
            updated = {
                'access_token': creds.token,
                'refresh_token': creds.refresh_token,
                'token_type': 'Bearer',
                'scope': 'https://www.googleapis.com/auth/drive.file',
                'expiry': creds.expiry.isoformat() if getattr(creds, 'expiry', None) else None
            }
            UserToken.save_tokens(user_id, 'google', updated)
        return creds

    def user_service(self, user_id):
        """Get a Drive service bound to the user's OAuth credentials"""
        if user_id in self._user_services:
            return self._user_services[user_id]
        creds = self._get_user_credentials(user_id)
        svc = build('drive', 'v3', credentials=creds)
        self._user_services[user_id] = svc
        return svc
    
    def _is_video_file(self, mime_type, file_name):
        """Check if file is a video based on mime type or extension"""
        video_mime_types = [
            'video/mp4', 'video/x-matroska', 'video/quicktime',
            'video/x-msvideo', 'video/x-ms-wmv', 'video/webm', 'video/avi'
        ]
        
        video_extensions = [
            '.mp4', '.mkv', '.mov', '.avi', '.wmv', '.webm', '.flv', '.m4v'
        ]
        
        if mime_type and any(mime_type.startswith(vmt) for vmt in video_mime_types):
            return True
        
        if file_name:
            _, ext = os.path.splitext(file_name.lower())
            return ext in video_extensions
        
        return False
    
    def list_movies(self, folder_id=None, recursive=False, depth=0, max_depth=2):
        """List all movie files in the specified Google Drive folder
        
        Args:
            folder_id (str, optional): ID of the folder to list. Defaults to None (uses root or configured default).
            recursive (bool, optional): Whether to recursively list files in subfolders. Defaults to False.
            depth (int, optional): Current recursion depth. Defaults to 0.
            max_depth (int, optional): Maximum recursion depth. Defaults to 2.
            
        Returns:
            list: List of folders and movie files
        """
        # Check cache first
        cache_key = f"folder_{folder_id or 'root'}_recursive_{recursive}"
        if cache_key in self._cache and time.time() < self._cache_expiry.get(cache_key, 0):
            print(f"Using cached results for {cache_key}")
            return self._cache[cache_key]
        
        try:
            # If no folder_id is provided, use the root folder or the configured default folder
            if not folder_id:
                folder_id = 'root'
            
            # Query parameters
            query = f"'{folder_id}' in parents and trashed = false"
            fields = "files(id, name, mimeType, size, createdTime, modifiedTime, thumbnailLink, webContentLink)"
            
            # Execute the query
            results = self.service.files().list(
                q=query,
                fields=fields,
                pageSize=1000
            ).execute()
            
            items = results.get('files', [])
            
            # Filter for video files and folders
            movies = []
            folders = []
            
            for item in items:
                if item['mimeType'] == 'application/vnd.google-apps.folder':
                    folder_item = {
                        'id': item['id'],
                        'name': item['name'],
                        'type': 'folder',
                        'createdTime': item.get('createdTime'),
                        'modifiedTime': item.get('modifiedTime'),
                        'parent_folder_id': folder_id
                    }
                    
                    # If recursive and not at max depth, get contents of this folder
                    if recursive and depth < max_depth:
                        try:
                            # Get count of items in folder for UI display
                            folder_contents = self.list_movies(item['id'], False, depth + 1, max_depth)
                            folder_item['item_count'] = len(folder_contents)
                            folder_item['has_videos'] = any(content.get('type') == 'video' for content in folder_contents)
                        except Exception as e:
                            print(f"Error getting folder contents: {e}")
                            folder_item['item_count'] = 0
                            folder_item['has_videos'] = False
                    
                    folders.append(folder_item)
                elif self._is_video_file(item.get('mimeType'), item.get('name')):
                    movie_item = {
                        'id': item['id'],
                        'name': item['name'],
                        'type': 'video',
                        'size': item.get('size'),
                        'createdTime': item.get('createdTime'),
                        'modifiedTime': item.get('modifiedTime'),
                        'thumbnailLink': item.get('thumbnailLink'),
                        'webContentLink': item.get('webContentLink'),
                        'parent_folder_id': folder_id
                    }
                    
                    # Try to save metadata to MongoDB
                    try:
                        from app.models import MovieMetadata
                        MovieMetadata.save_metadata(movie_item)
                    except Exception as e:
                        print(f"Failed to save metadata to MongoDB: {e}")
                    
                    movies.append(movie_item)
            
            # Combine folders and movies, with folders first
            result = folders + movies
            
            # If recursive and not at max depth, get contents of all subfolders
            if recursive and depth < max_depth:
                all_results = result.copy()
                for folder in folders:
                    try:
                        folder_contents = self.list_movies(folder['id'], True, depth + 1, max_depth)
                        all_results.extend(folder_contents)
                    except Exception as e:
                        print(f"Error getting recursive folder contents: {e}")
                result = all_results
            
            # Cache the results
            self._cache[cache_key] = result
            self._cache_expiry[cache_key] = time.time() + self._cache_duration
            
            return result
        
        except HttpError as error:
            print(f"An error occurred: {error}")
            raise Exception(f"Failed to list files: {error}")

    # ---------- User-owned files operations ----------
    def list_user_videos(self, user_id):
        """List video files in the user's Drive that the app can access"""
        try:
            svc = self.user_service(user_id)
            query = "trashed = false"
            fields = "files(id, name, mimeType, size, createdTime, modifiedTime, thumbnailLink)"
            items = svc.files().list(q=query, fields=fields, pageSize=1000).execute().get('files', [])
            videos = [
                {
                    'id': it['id'],
                    'name': it['name'],
                    'mimeType': it.get('mimeType'),
                    'size': it.get('size'),
                    'createdTime': it.get('createdTime'),
                    'modifiedTime': it.get('modifiedTime'),
                    'thumbnailLink': it.get('thumbnailLink'),
                    'type': 'video'
                }
                for it in items if self._is_video_file(it.get('mimeType'), it.get('name'))
            ]
            return videos
        except HttpError as error:
            print(f"An error occurred: {error}")
            raise Exception(f"Failed to list user files: {error}")

    def upload_user_file(self, user_id, file_path, mime_type=None, folder_id=None, name=None):
        """Upload a file to the user's Drive and return file metadata"""
        try:
            svc = self.user_service(user_id)
            metadata = {'name': name or os.path.basename(file_path)}
            if folder_id:
                metadata['parents'] = [folder_id]
            media = MediaFileUpload(file_path, mimetype=mime_type, resumable=True)
            request = svc.files().create(body=metadata, media_body=media, fields='id, name, mimeType, size, createdTime, modifiedTime, thumbnailLink')
            response = None
            while response is None:
                status, response = request.next_chunk()
            return response
        except HttpError as error:
            print(f"An error occurred: {error}")
            raise Exception(f"Failed to upload file: {error}")
    
    def get_stream_link(self, file_id):
        """Generate a direct streaming link for a Google Drive file"""
        try:
            # Get file metadata to confirm it exists and is accessible
            file_metadata = self.get_file_metadata(file_id)
            
            # For Google Drive, we can use the files.get media endpoint
            # But for a web application, it's better to proxy the content or use a signed URL
            # Since Google Drive doesn't provide direct streaming URLs that work in browsers,
            # we'll return a URL to our own endpoint that will proxy the content
            
            # This is a simplified approach - in production, you might want to use signed URLs
            # or implement token-based authentication for these streaming links
            base_url = os.getenv('API_BASE_URL', 'http://localhost:5000').rstrip('/')
            
            # If the configured base URL already ends with '/api', avoid adding it twice
            if base_url.endswith('/api'):
                # Generate URL with single '/api'
                stream_url = f"{base_url}/stream/{file_id}"
            else:
                # Append '/api' segment if not present
                stream_url = f"{base_url}/api/stream/{file_id}"
            
            # Save metadata to MongoDB if available
            try:
                from app.models import MovieMetadata
                MovieMetadata.save_metadata(file_metadata)
            except Exception as e:
                print(f"Failed to save metadata to MongoDB: {e}")
            
            return stream_url
        
        except HttpError as error:
            print(f"An error occurred: {error}")
            raise Exception(f"Failed to generate streaming link: {error}")
    
    def get_file_metadata(self, file_id):
        """Get metadata for a specific file"""
        # Check cache first
        cache_key = f"file_{file_id}"   
        if cache_key in self._cache and time.time() < self._cache_expiry.get(cache_key, 0):
            return self._cache[cache_key]
        
        try:
            # Get file metadata
            file = self.service.files().get(
                fileId=file_id,
                fields="id, name, mimeType, size, createdTime, modifiedTime, thumbnailLink"
            ).execute()
            
            # Cache the result
            self._cache[cache_key] = file
            self._cache_expiry[cache_key] = time.time() + self._cache_duration
            
            return file
        
        except HttpError as error:
            print(f"An error occurred: {error}")
            raise Exception(f"Failed to get file metadata: {error}")
