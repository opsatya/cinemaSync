from flask import Blueprint, jsonify, request, current_app, redirect, url_for, Response
from app.drive_service import DriveService
from app.models import MovieMetadata
from app.room_routes import token_required
import io
import os
from googleapiclient.http import MediaIoBaseDownload

api_bp = Blueprint('api', __name__, url_prefix='/api')
drive_service = DriveService()

@api_bp.route('/', methods=['GET'])
def index():
    """Root endpoint to check if API is running"""
    return jsonify({
        'success': True,
        'message': 'CinemaSync API is running',
        'version': '1.0.0'
    })

@api_bp.route('/movies/list', methods=['GET'])
def get_movies_list():
    """Fetch list of movies from Google Drive"""
    try:
        print("Fetching movies list...")
        folder_id = request.args.get('folder_id', None)
        recursive = request.args.get('recursive', 'false').lower() == 'true'
        max_depth = int(request.args.get('max_depth', 2))
        
        # Limit max_depth to prevent excessive recursion
        if max_depth > 3:
            max_depth = 3
            
        print(f"Fetching movies with params: folder_id={folder_id}, recursive={recursive}, max_depth={max_depth}")
        movies = drive_service.list_movies(folder_id, recursive=recursive, max_depth=max_depth)
        
        # Get current folder info if it's not the root
        current_folder = None
        if folder_id and folder_id != 'root':
            try:
                current_folder = drive_service.get_file_metadata(folder_id)
            except Exception as e:
                print(f"Error getting current folder info: {e}")
        
        return jsonify({
            'success': True,
            'data': movies,
            'current_folder': current_folder,
            'count': len(movies)
        }), 200
    except Exception as e:
        print(f"Error in get_movies_list: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@api_bp.route('/movies/stream/<file_id>', methods=['GET'])
def get_stream_link(file_id):
    """Get direct streamable link for a file"""
    try:
        stream_link = drive_service.get_stream_link(file_id)
        return jsonify({
            'success': True,
            'stream_url': stream_link
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@api_bp.route('/stream/<file_id>', methods=['GET'])
def stream_file(file_id):
    """Stream a file directly from Google Drive"""
    try:
        # Support user-owned files via ?owner=user&user_id=... (or Authorization token)
        owner = request.args.get('owner')
        user_id = request.args.get('user_id')
        file_metadata = None
        if owner == 'user':
            # Try Authorization to derive user if not provided
            if not user_id and 'Authorization' in request.headers:
                auth_header = request.headers.get('Authorization', '')
                if auth_header.startswith('Bearer '):
                    token = auth_header.split(' ')[1]
                    try:
                        data = jwt.decode(token, os.getenv('JWT_SECRET', 'your-secret-key'), algorithms=['HS256'])
                        user_id = data.get('user_id')
                    except Exception:
                        pass
            if not user_id:
                return jsonify({'success': False, 'message': 'user_id required for user-owned files'}), 400
            # Metadata via user service
            svc = drive_service.user_service(user_id)
            file_metadata = svc.files().get(fileId=file_id, fields='id, name, mimeType').execute()
            request_stream = svc.files().get_media(fileId=file_id)
        else:
            # Get file metadata via service account
            file_metadata = drive_service.get_file_metadata(file_id)
            request_stream = drive_service.service.files().get_media(fileId=file_id)
        
        # Create a request to download the file
        request = request_stream
        
        # Create a BytesIO object to store the file content
        file_content = io.BytesIO()
        downloader = MediaIoBaseDownload(file_content, request)
        
        # Download the file
        done = False
        while not done:
            status, done = downloader.next_chunk()
        
        # Reset the file pointer to the beginning
        file_content.seek(0)
        
        # Create a response with the file content
        response = Response(
            file_content.read(),
            mimetype=file_metadata.get('mimeType', 'video/mp4')
        )
        
        # Set headers for streaming
        response.headers.set('Content-Disposition', f'inline; filename="{file_metadata.get("name", "video.mp4")}"')
        response.headers.set('Accept-Ranges', 'bytes')
        
        # Save metadata to MongoDB if available
        try:
            MovieMetadata.save_metadata(file_metadata)
        except Exception as e:
            print(f"Failed to save metadata to MongoDB: {e}")
        
        return response
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@api_bp.route('/movies/metadata/<file_id>', methods=['GET'])
def get_movie_metadata(file_id):
    """Fetch movie metadata"""
    try:
        # Try to get metadata from MongoDB first
        metadata = MovieMetadata.find_by_file_id(file_id)
        
        # If not found in MongoDB, get from Google Drive
        if not metadata:
            metadata = drive_service.get_file_metadata(file_id)
            
            # Save to MongoDB for future use
            try:
                MovieMetadata.save_metadata(metadata)
            except Exception as e:
                print(f"Failed to save metadata to MongoDB: {e}")
        
        return jsonify({
            'success': True,
            'metadata': metadata
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@api_bp.route('/movies/search', methods=['GET'])
def search_movies():
    """Search for movies by name"""
    try:
        query = request.args.get('q', '')
        limit = int(request.args.get('limit', 20))
        
        if not query:
            return jsonify({
                'success': False,
                'message': 'Search query is required'
            }), 400
        
        # Try to search in MongoDB first
        results = MovieMetadata.search_movies(query, limit)
        
        # If no results from MongoDB, search in Google Drive
        if not results:
            # This is a simplified search - in a real app, you'd want to implement
            # a more sophisticated search using Google Drive API's search capabilities
            try:
                # Get all movies from the root folder and filter by name
                all_movies = drive_service.list_movies(recursive=True, max_depth=2)
                results = [movie for movie in all_movies if query.lower() in movie['name'].lower()]
                results = results[:limit]  # Limit results
                
                # Save results to MongoDB for future searches
                for movie in results:
                    try:
                        MovieMetadata.save_metadata(movie)
                    except Exception as e:
                        print(f"Failed to save search result to MongoDB: {e}")
            except Exception as e:
                print(f"Failed to search in Google Drive: {e}")
        
        return jsonify({
            'success': True,
            'results': results,
            'count': len(results)
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@api_bp.route('/movies/recent', methods=['GET'])
def get_recent_movies():
    """Get recently accessed movies"""
    try:
        limit = int(request.args.get('limit', 20))
        
        # Get recent movies from MongoDB
        recent_movies = MovieMetadata.get_recent_movies(limit)
        
        # If no results from MongoDB, get from default folder
        if not recent_movies:
            folder_id = os.getenv('GOOGLE_DRIVE_FOLDER_ID', 'root')
            recent_movies = drive_service.list_movies(folder_id)
            recent_movies = recent_movies[:limit]  # Limit results
        
        return jsonify({
            'success': True,
            'movies': recent_movies,
            'count': len(recent_movies)
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

# ---------- User Drive Endpoints ----------

@api_bp.route('/drive/files', methods=['GET'])
@token_required
def list_user_files(user_id):
    """List user-owned video files accessible to the app"""
    try:
        files = drive_service.list_user_videos(user_id)
        return jsonify({'success': True, 'files': files, 'count': len(files)}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@api_bp.route('/drive/upload', methods=['POST'])
@token_required
def upload_user_file(user_id):
    """Upload a file to the user's Google Drive (expects multipart/form-data)"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': 'No file uploaded'}), 400
        file_storage = request.files['file']
        if file_storage.filename == '':
            return jsonify({'success': False, 'message': 'Empty filename'}), 400

        folder_id = request.form.get('folder_id')
        mime_type = file_storage.mimetype

        # Save to a temp file path
        temp_dir = os.path.join('/tmp', 'cinemasync_uploads')
        os.makedirs(temp_dir, exist_ok=True)
        temp_path = os.path.join(temp_dir, file_storage.filename)
        file_storage.save(temp_path)

        try:
            result = drive_service.upload_user_file(
                user_id=user_id,
                file_path=temp_path,
                mime_type=mime_type,
                folder_id=folder_id,
                name=file_storage.filename
            )
        finally:
            try:
                os.remove(temp_path)
            except Exception:
                pass

        # Persist metadata to Mongo for search/recent
        try:
            MovieMetadata.save_metadata({
                'file_id': result.get('id'),
                'id': result.get('id'),
                'name': result.get('name'),
                'mimeType': result.get('mimeType'),
                'size': result.get('size'),
                'createdTime': result.get('createdTime'),
                'modifiedTime': result.get('modifiedTime'),
                'thumbnailLink': result.get('thumbnailLink'),
                'type': 'video'
            })
        except Exception as e:
            print(f"Failed to save uploaded metadata: {e}")

        return jsonify({'success': True, 'file': result}), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
