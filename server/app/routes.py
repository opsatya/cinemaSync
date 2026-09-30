from flask import Blueprint, jsonify, request, current_app, redirect, url_for, Response, g
from app.drive_service import DriveService
from app.models import MovieMetadata
from app.auth_middleware import token_required
from werkzeug.utils import secure_filename
import io
import os
import uuid
import jwt
from datetime import datetime
from googleapiclient.http import MediaIoBaseDownload
from google.auth.exceptions import RefreshError

api_bp = Blueprint('api', __name__, url_prefix='/api')
drive_service = DriveService()


def _safe_upload_path(temp_dir, filename):
    """Build a filesystem path for an uploaded file that can never escape
    temp_dir, regardless of what the client sent as the filename (path
    traversal, absolute paths, etc.), and never collides with a concurrent
    upload of the same name."""
    safe_name = secure_filename(filename) or 'upload'
    unique_name = f'{uuid.uuid4().hex}_{safe_name}'
    return os.path.join(temp_dir, unique_name)


def _parse_range_header(range_header, file_size):
    """Parse a single-range 'bytes=start-end' Range header against a known
    file size. Returns (start, end) inclusive, or None if absent/invalid."""
    if not range_header or not range_header.startswith('bytes=') or not file_size:
        return None
    try:
        spec = range_header.split('=', 1)[1]
        start_str, _, end_str = spec.partition('-')
        start = int(start_str) if start_str else 0
        end = int(end_str) if end_str else file_size - 1
        end = min(end, file_size - 1)
        if start < 0 or start > end:
            return None
        return start, end
    except (ValueError, IndexError):
        return None

@api_bp.route('/', methods=['GET'])
def index():
    """Root endpoint to check if API is running"""
    return jsonify({
        'success': True,
        'message': 'CinemaSync API is running',
        'version': '1.0.0'
    })

@api_bp.route('/health', methods=['GET'])
def health():
    """Health check endpoint for debugging connectivity"""
    import json
    from flask import Response
    
    data = {
        'success': True,
        'message': 'Backend is healthy and reachable',
        'status': 'ok',
        'timestamp': str(datetime.utcnow())
    }
    
    return Response(
        json.dumps(data),
        mimetype='application/json',
        status=200
    )

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
            file_metadata = svc.files().get(fileId=file_id, fields='id, name, mimeType, size').execute()
            request_stream = svc.files().get_media(fileId=file_id)
        else:
            # Get file metadata via service account
            file_metadata = drive_service.get_file_metadata(file_id)
            request_stream = drive_service.service.files().get_media(fileId=file_id)

        # Honor Range requests (seeking/scrubbing) by fetching only the
        # requested byte span from Drive and returning 206 Partial Content.
        range_header = request.headers.get('Range')
        file_size = int(file_metadata.get('size') or 0)
        byte_range = _parse_range_header(range_header, file_size)
        if byte_range:
            start, end = byte_range
            request_stream.headers['Range'] = f'bytes={start}-{end}'
            content = request_stream.execute()

            try:
                MovieMetadata.save_metadata(file_metadata)
            except Exception as e:
                print(f"Failed to save metadata to MongoDB: {e}")

            range_response = Response(
                content,
                status=206,
                mimetype=file_metadata.get('mimeType', 'video/mp4'),
            )
            range_response.headers.set('Accept-Ranges', 'bytes')
            range_response.headers.set('Content-Range', f'bytes {start}-{end}/{file_size}')
            range_response.headers.set('Content-Length', str(end - start + 1))
            range_response.headers.set('Content-Disposition', f'inline; filename="{file_metadata.get("name", "video.mp4")}"')
            return range_response

        # No (usable) Range header: stream the file in chunks instead of
        # loading it entirely into memory.
        from flask import stream_with_context

        CHUNK_SIZE = 1024 * 1024  # 1 MB per chunk

        def generate():
            """Generator that yields chunks from Google Drive."""
            buffer = io.BytesIO()
            downloader = MediaIoBaseDownload(buffer, request_stream, chunksize=CHUNK_SIZE)
            done = False
            while not done:
                status, done = downloader.next_chunk()
                buffer.seek(0)
                data = buffer.read()
                if data:
                    yield data
                buffer.seek(0)
                buffer.truncate(0)

        response = Response(
            stream_with_context(generate()),
            mimetype=file_metadata.get('mimeType', 'video/mp4')
        )

        # Indicate support for simple range requests (client can still seek within the video)
        response.headers.set('Accept-Ranges', 'bytes')
        response.headers.set('Content-Disposition', f'inline; filename="{file_metadata.get("name", "video.mp4")}"')
        
        # Save metadata to MongoDB if available
        try:
            MovieMetadata.save_metadata(file_metadata)
        except Exception as e:
            print(f"Failed to save metadata to MongoDB: {e}")
        
        return response
    except RefreshError as e:
        # Invalidate stored tokens and clear cached Drive service for this user
        try:
            if request.args.get('owner') == 'user':
                from app.models import UserToken
                # user_id was computed earlier in the handler (may come from args or JWT)
                if 'user_id' in locals() and user_id:
                    UserToken.invalidate_tokens(user_id, 'google', reason='invalid_grant')
                    try:
                        drive_service._user_services.pop(user_id, None)
                    except Exception:
                        pass
        except Exception:
            pass
        return jsonify({
            'success': False,
            'code': 'reauth_required',
            'message': 'Google authorization expired or revoked. Please reconnect your Google Drive account.'
        }), 401
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
        
        # If no results from MongoDB, list from root (remove dependency on GOOGLE_DRIVE_FOLDER_ID)
        if not recent_movies:
            folder_id = 'root'
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

@api_bp.route('/drive/upload', methods=['POST'])
@token_required
def upload_user_file():
    """Upload a file to the user's Google Drive (expects multipart/form-data)"""
    try:
        user_id = g.current_user_id

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
        temp_path = _safe_upload_path(temp_dir, file_storage.filename)
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
    except RefreshError as e:
        # Invalidate tokens and clear cached service
        try:
            from app.models import UserToken
            UserToken.invalidate_tokens(g.current_user_id, 'google', reason='invalid_grant')
            try:
                drive_service._user_services.pop(g.current_user_id, None)
            except Exception:
                pass
        except Exception:
            pass
        return jsonify({
            'success': False,
            'code': 'reauth_required',
            'message': 'Google authorization expired or revoked. Please reconnect your Google Drive account.'
        }), 401
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
