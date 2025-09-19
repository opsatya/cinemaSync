from flask import Blueprint, jsonify, request, g
from app.models import Room, UserToken
from app.auth_middleware import token_required  # IMPORT THE MIDDLEWARE
from app.drive_service import DriveService
import os
import traceback
import sys
from datetime import datetime
import json

room_bp = Blueprint('room', __name__, url_prefix='/api/rooms')

@room_bp.route('/', methods=['GET'])
def get_active_rooms():
    """Get list of active public rooms"""
    try:
        print("🔍 GET ACTIVE ROOMS: Starting request")
        
        # Get pagination parameters with validation
        limit = min(max(int(request.args.get('limit', 20)), 1), 100)
        skip = max(int(request.args.get('skip', 0)), 0)
        
        print(f"   Pagination - limit: {limit}, skip: {skip}")
        
        rooms = Room.get_active_rooms(limit, skip)
        print(f"   Found {len(rooms)} active rooms")
        
        # Remove sensitive data
        for room in rooms:
            if '_id' in room:
                del room['_id']
            if 'password' in room:
                room['password_required'] = room['password'] is not None
                del room['password']
        
        return jsonify({
            'success': True,
            'rooms': rooms,
            'count': len(rooms),
            'pagination': {
                'limit': limit,
                'skip': skip
            }
        }), 200
        
    except ValueError as e:
        error_msg = f'Invalid pagination parameters: {str(e)}'
        print(f"❌ ValueError: {error_msg}")
        return jsonify({
            'success': False,
            'message': error_msg
        }), 400
        
    except Exception as e:
        error_msg = f'Failed to fetch rooms: {str(e)}'
        print(f"❌ Exception: {error_msg}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': error_msg
        }), 500

@room_bp.route('/', methods=['POST'])
@token_required
def create_room():
    """Create a new room with comprehensive error handling"""
    try:
        print("🚀 CREATE ROOM: Starting request processing")
        print(f"   Request headers: {dict(request.headers)}")
        print(f"   Request method: {request.method}")
        print(f"   Request URL: {request.url}")
        print(f"   Content-Type: {request.content_type}")
        
        # Check if we have user data from middleware
        user_id = getattr(g, 'current_user_id', None)
        user_name = getattr(g, 'current_user_name', None)
        user_email = getattr(g, 'current_user_email', None)
        
        print(f"   User ID from middleware: {user_id}")
        print(f"   User name from middleware: {user_name}")
        print(f"   User email from middleware: {user_email}")
        
        if not user_id:
            error_msg = "Authentication failed: No user ID found in token"
            print(f"❌ Auth Error: {error_msg}")
            return jsonify({
                'success': False,
                'message': error_msg
            }), 401
        
        # Get request data (robust JSON parsing with fallbacks)
        data = None
        parse_steps = []
        try:
            data = request.get_json(silent=True)
            parse_steps.append('request.get_json(silent=True)')
        except Exception as json_error:
            parse_steps.append(f'get_json exception: {type(json_error).__name__}: {str(json_error)}')
            data = None

        if data is None:
            # Try parsing raw data
            raw_body = request.get_data(cache=False, as_text=True) or ''
            parse_steps.append(f'raw_body_length={len(raw_body)}')
            if raw_body.strip():
                try:
                    data = json.loads(raw_body)
                    parse_steps.append('json.loads(raw_body) success')
                except json.JSONDecodeError as e:
                    error_msg = (
                        "Invalid JSON in request body. "
                        f"Error at pos {e.pos}: {e.msg}. "
                        f"Received body (truncated 200 chars): {raw_body[:200]}"
                    )
                    print(f"❌ JSON Error: {error_msg}")
                    print(f"   Parse steps: {parse_steps}")
                    return jsonify({
                        'success': False,
                        'message': error_msg
                    }), 400
            elif request.form:
                # Accept form-encoded data as a convenience for curl/tests
                data = request.form.to_dict(flat=True)
                parse_steps.append('parsed request.form')

        print(f"   Parse steps: {parse_steps}")
        print(f"   Raw request data: {data}")
        print(f"   Request data type: {type(data)}")
        
        if not data:
            error_msg = 'Request body is required and must be valid JSON'
            print(f"❌ Error: {error_msg}")
            return jsonify({
                'success': False,
                'message': error_msg
            }), 400
        
        # Normalize alternate field names (camelCase -> snake_case)
        try:
            if 'movieSource' in data and 'movie_source' not in data:
                # Convert movieSource + movieLink to expected structure
                ms_type = data.get('movieSource')
                ms_value = data.get('movieLink')
                data['movie_source'] = {'type': ms_type, 'value': ms_value}
            # Map other common camelCase fields
            if 'isPrivate' in data and 'is_private' not in data:
                data['is_private'] = data['isPrivate']
            if 'enableChat' in data and 'enable_chat' not in data:
                data['enable_chat'] = data['enableChat']
            if 'enableReactions' in data and 'enable_reactions' not in data:
                data['enable_reactions'] = data['enableReactions']
        except Exception as norm_err:
            print(f"⚠️ Normalization warning: {norm_err}")

        # Validate required fields
        required_fields = ['name', 'movie_source']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            error_msg = f'Missing required fields: {", ".join(missing_fields)}'
            print(f"❌ Validation Error: {error_msg}")
            print(f"   Available fields: {list(data.keys()) if data else 'None'}")
            return jsonify({
                'success': False,
                'message': error_msg
            }), 400
        
        # Validate movie_source structure
        movie_source = data.get('movie_source')
        if not isinstance(movie_source, dict) or 'type' not in movie_source:
            error_msg = 'movie_source must be an object with a "type" field'
            print(f"❌ Movie Source Error: {error_msg}")
            print(f"   Received movie_source: {movie_source}")
            return jsonify({
                'success': False,
                'message': error_msg
            }), 400
        
        # Prepare room data
        data['host_id'] = user_id
        print(f"📝 Final room data to create: {data}")
        
        # Test database connection
        print("🔍 Testing database connection...")
        try:
            collection = Room.get_collection()
            print(f"   Database collection: {collection}")
            print(f"   Collection name: {collection.name}")
            
            # Test database connectivity
            test_count = collection.count_documents({})
            print(f"   Current documents in collection: {test_count}")
            
        except Exception as db_error:
            error_msg = f"Database connection failed: {str(db_error)}"
            print(f"❌ Database Error: {error_msg}")
            print(f"   Database error type: {type(db_error).__name__}")
            traceback.print_exc()
            return jsonify({
                'success': False,
                'message': error_msg
            }), 500
        
        # Create the room
        print("🏗️ Creating room...")
        room = Room.create_room(data)
        print(f"✅ Room created successfully: {room}")
        print(f"   Room type: {type(room)}")
        print(f"   Room keys: {list(room.keys()) if isinstance(room, dict) else 'Not a dict'}")
        
        # Clean up response data
        if isinstance(room, dict) and '_id' in room:
            del room['_id']
        
        return jsonify({
            'success': True,
            'room': room,
            'message': 'Room created successfully'
        }), 201
        
    except ValueError as e:
        error_msg = f"Validation error: {str(e)}"
        print(f"❌ ValueError Details:")
        print(f"   Error message: {error_msg}")
        print(f"   Error type: {type(e).__name__}")
        print(f"   Error args: {e.args}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': error_msg
        }), 400
        
    except Exception as e:
        error_msg = f"Server error: {str(e)}"
        print(f"❌ Exception Details:")
        print(f"   Error message: {error_msg}")
        print(f"   Error type: {type(e).__name__}")
        print(f"   Error args: {e.args}")
        print(f"   Full traceback:")
        traceback.print_exc()
        
        # Also print to stderr for better visibility
        print(f"STDERR: {error_msg}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        
        return jsonify({
            'success': False,
            'message': error_msg,
            'error_type': type(e).__name__,
            'debug_info': {
                'error_args': str(e.args),
                'traceback': traceback.format_exc()
            } if os.getenv('FLASK_DEBUG') == 'True' else None
        }), 500

@room_bp.route('/<string:room_id>', methods=['GET'])
def get_room(room_id):
    """Get room details"""
    try:
        print(f"🔍 GET ROOM: {room_id}")
        
        if not room_id or not room_id.strip():
            error_msg = 'Room ID is required'
            print(f"❌ Error: {error_msg}")
            return jsonify({
                'success': False,
                'message': error_msg
            }), 400
        
        room = Room.find_by_id(room_id.strip())
        print(f"   Found room: {bool(room)}")
        
        if not room:
            error_msg = 'Room not found'
            print(f"❌ Error: {error_msg}")
            return jsonify({
                'success': False,
                'message': error_msg
            }), 404
        
        # Remove sensitive data
        if '_id' in room:
            del room['_id']
        if 'password' in room:
            room['password_required'] = room['password'] is not None
            del room['password']
        
        return jsonify({
            'success': True,
            'room': room
        }), 200
        
    except Exception as e:
        error_msg = f'Failed to get room details: {str(e)}'
        print(f"❌ Exception: {error_msg}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': error_msg
        }), 500

@room_bp.route('/my-rooms', methods=['GET'])
@token_required
def get_my_rooms():
    """Get list of rooms the current user is part of - enhanced with debugging."""
    try:
        user_id = g.current_user_id
        print(f"🔍 MY-ROOMS: Starting request")
        print(f"   User ID: {user_id} (type: {type(user_id).__name__})")
        print(f"   User name: {getattr(g, 'current_user_name', 'N/A')}")
        print(f"   User email: {getattr(g, 'current_user_email', 'N/A')}")
        
        # Test database connection
        try:
            collection = Room.get_collection()
            total_rooms = collection.count_documents({})
            print(f"   Total rooms in database: {total_rooms}")
        except Exception as db_error:
            print(f"❌ Database connection error: {str(db_error)}")
            raise db_error
        
        rooms = Room.find_by_user_id(user_id)
        print(f"   Found {len(rooms)} rooms for user")
        
        if len(rooms) == 0:
            print("   No rooms found - checking database directly...")
            # Direct database query for debugging
            all_rooms = list(collection.find({}))
            print(f"   All rooms in DB: {len(all_rooms)}")
            for room in all_rooms[:3]:  # Show first 3 for debugging
                print(f"     Sample room: {room.get('room_id')} - host: {room.get('host_id')}")
        
        # Remove sensitive data
        for room in rooms:
            if '_id' in room:
                del room['_id']
            if 'password' in room:
                room['password_required'] = room['password'] is not None
                del room['password']
        
        return jsonify({
            'success': True,
            'rooms': rooms,
            'count': len(rooms),
            'debug_info': {
                'user_id': user_id,
                'user_id_type': type(user_id).__name__
            }
        }), 200
        
    except Exception as e:
        error_msg = f'Failed to fetch user rooms: {str(e)}'
        print(f"❌ MY-ROOMS Error: {error_msg}")
        print(f"   Error type: {type(e).__name__}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': error_msg
        }), 500

@room_bp.route('/<room_id>/join', methods=['POST'])
@token_required
def join_room(room_id):
    """Join a room"""
    try:
        print(f"🚪 JOIN ROOM: {room_id}")
        print(f"   User: {g.current_user_id}")
        
        if not room_id or not room_id.strip():
            error_msg = 'Room ID is required'
            print(f"❌ Error: {error_msg}")
            return jsonify({
                'success': False,
                'message': error_msg
            }), 400
        
        data = request.get_json() or {}
        room = Room.find_by_id(room_id.strip())
        
        if not room:
            error_msg = 'Room not found'
            print(f"❌ Error: {error_msg}")
            return jsonify({
                'success': False,
                'message': error_msg
            }), 404
        
        if not room.get('is_active', True):
            error_msg = 'Room is no longer active'
            print(f"❌ Error: {error_msg}")
            return jsonify({
                'success': False,
                'message': error_msg
            }), 400
        
        if room.get('password') and data.get('password') != room['password']:
            error_msg = 'Invalid password'
            print(f"❌ Error: {error_msg}")
            return jsonify({
                'success': False,
                'message': error_msg
            }), 401
        
        try:
            room = Room.add_participant(room_id.strip(), g.current_user_id)
            print(f"✅ Successfully joined room")
        except ValueError as e:
            error_msg = str(e)
            print(f"❌ ValueError: {error_msg}")
            return jsonify({
                'success': False,
                'message': error_msg
            }), 400
        
        # Clean up response
        if '_id' in room:
            del room['_id']
        if 'password' in room:
            del room['password']
        
        return jsonify({
            'success': True,
            'room': room,
            'message': 'Successfully joined room'
        }), 200
        
    except Exception as e:
        error_msg = f'Failed to join room: {str(e)}'
        print(f"❌ Exception: {error_msg}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': error_msg
        }), 500

@room_bp.route('/<room_id>/leave', methods=['POST'])
@token_required
def leave_room(room_id):
    """Leave a room"""
    try:
        print(f"🚪 LEAVE ROOM: {room_id}")
        print(f"   User: {g.current_user_id}")
        
        if not room_id or not room_id.strip():
            error_msg = 'Room ID is required'
            print(f"❌ Error: {error_msg}")
            return jsonify({
                'success': False,
                'message': error_msg
            }), 400
        
        try:
            room = Room.remove_participant(room_id.strip(), g.current_user_id)
            print(f"✅ Successfully left room")
        except ValueError as e:
            error_msg = str(e)
            print(f"❌ ValueError: {error_msg}")
            return jsonify({
                'success': False,
                'message': error_msg
            }), 400
        
        # Clean up response
        if room and '_id' in room:
            del room['_id']
        if room and 'password' in room:
            del room['password']
        
        return jsonify({
            'success': True,
            'room': room,
            'message': 'Successfully left room'
        }), 200
        
    except Exception as e:
        error_msg = f'Failed to leave room: {str(e)}'
        print(f"❌ Exception: {error_msg}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': error_msg
        }), 500

@room_bp.route('/<room_id>/playback', methods=['POST'])
@token_required
def update_playback_state(room_id):
    """Update room playback state (only host can do this)"""
    try:
        print(f"⏯️ UPDATE PLAYBACK: {room_id}")
        print(f"   User: {g.current_user_id}")
        
        if not room_id or not room_id.strip():
            error_msg = 'Room ID is required'
            print(f"❌ Error: {error_msg}")
            return jsonify({
                'success': False,
                'message': error_msg
            }), 400
        
        data = request.get_json()
        
        if not data:
            error_msg = 'Playback state data is required'
            print(f"❌ Error: {error_msg}")
            return jsonify({
                'success': False,
                'message': error_msg
            }), 400
        
        room = Room.find_by_id(room_id.strip())
        
        if not room:
            error_msg = 'Room not found'
            print(f"❌ Error: {error_msg}")
            return jsonify({
                'success': False,
                'message': error_msg
            }), 404
        
        if room.get('host_id') != g.current_user_id:
            error_msg = 'Only room host can control playback'
            print(f"❌ Error: {error_msg}")
            print(f"   Room host: {room.get('host_id')}, Current user: {g.current_user_id}")
            return jsonify({
                'success': False,
                'message': error_msg
            }), 403
        
        playback_state = {
            'is_playing': data.get('is_playing', False),
            'current_time': data.get('current_time', 0),
        }
        
        print(f"   Updating playback state: {playback_state}")
        room = Room.update_playback_state(room_id.strip(), playback_state)
        print(f"✅ Playback state updated successfully")
        
        # Clean up response
        if '_id' in room:
            del room['_id']
        if 'password' in room:
            del room['password']
        
        return jsonify({
            'success': True,
            'room': room,
            'message': 'Playback state updated'
        }), 200
        
    except Exception as e:
        error_msg = f'Failed to update playback state: {str(e)}'
        print(f"❌ Exception: {error_msg}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': error_msg
        }), 500

@room_bp.route('/debug/user/<string:user_id>', methods=['GET'])
def debug_user_rooms_detailed(user_id):
    """Enhanced debug endpoint to analyze user room associations"""
    try:
        print(f"🔍 DEBUG ENDPOINT: Analyzing user {user_id}")
        
        from app.models import Room
        collection = Room.get_collection()
        
        # Get ALL rooms for debugging
        all_rooms = list(collection.find({}))
        
        print(f"   Total rooms in database: {len(all_rooms)}")
        
        result = {
            'debug_info': {
                'searched_user_id': user_id,
                'total_rooms_in_db': len(all_rooms),
                'timestamp': datetime.utcnow().isoformat()
            },
            'rooms_analysis': [],
            'matching_rooms': []
        }
        
        for room in all_rooms:
            # Detailed analysis of each room
            analysis = {
                'room_id': room.get('room_id'),
                'name': room.get('name'),
                'host_id': room.get('host_id'),
                'host_id_type': type(room.get('host_id')).__name__,
                'is_active': room.get('is_active'),
                'participants': room.get('participants', []),
                'participants_count': len(room.get('participants', [])),
                'user_matches': {
                    'is_host': str(room.get('host_id')) == str(user_id),
                    'in_participants': False,
                    'participant_details': []
                }
            }
            
            # Check participants
            for p in room.get('participants', []):
                participant_info = {
                    'participant_data': p,
                    'participant_type': type(p).__name__,
                    'matches_user': False
                }
                
                if isinstance(p, dict):
                    p_user_id = p.get('user_id')
                    participant_info['user_id'] = p_user_id
                    participant_info['user_id_type'] = type(p_user_id).__name__
                    participant_info['matches_user'] = str(p_user_id) == str(user_id)
                    if participant_info['matches_user']:
                        analysis['user_matches']['in_participants'] = True
                elif isinstance(p, str):
                    participant_info['matches_user'] = str(p) == str(user_id)
                    if participant_info['matches_user']:
                        analysis['user_matches']['in_participants'] = True
                
                analysis['user_matches']['participant_details'].append(participant_info)
            
            result['rooms_analysis'].append(analysis)
            
            # If user matches, add to matching rooms
            if analysis['user_matches']['is_host'] or analysis['user_matches']['in_participants']:
                result['matching_rooms'].append(room)
        
        print(f"   Found {len(result['matching_rooms'])} matching rooms for user")
        return jsonify(result)
        
    except Exception as e:
        error_msg = f'Debug endpoint error: {str(e)}'
        print(f"❌ Debug Error: {error_msg}")
        traceback.print_exc()
        return jsonify({
            'error': error_msg, 
            'user_id': user_id,
            'error_type': type(e).__name__
        }), 500

@room_bp.route('/videos/drive', methods=['GET'])
@token_required
def get_user_drive_videos():
    """Get user's Google Drive videos"""
    try:
        user_id = g.current_user_id
        
        # Get user's Google Drive tokens
        tokens = UserToken.get_tokens(user_id, 'google')
        
        if not tokens or not tokens.get('access_token'):
            return jsonify({
                'success': False,
                'message': 'Google Drive not connected. Please connect your Google Drive account first.'
            }), 401
        
        # Use DriveService to list user videos
        drive_service = DriveService()
        videos = drive_service.list_user_videos(user_id)
        
        return jsonify({
            'success': True,
            'videos': videos
        }), 200
        
    except Exception as e:
        print(f"❌ Error getting user drive videos: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@room_bp.route('/<room_id>/video', methods=['POST'])
@token_required 
def set_room_video(room_id):
    """Set video for room (only host can do this)"""
    try:
        user_id = g.current_user_id
        data = request.get_json()
        
        if not data or not data.get('video_id'):
            return jsonify({
                'success': False,
                'message': 'Video ID is required'
            }), 400
        
        room = Room.find_by_id(room_id)
        if not room:
            return jsonify({
                'success': False,
                'message': 'Room not found'
            }), 404
            
        if room.get('host_id') != user_id:
            return jsonify({
                'success': False,
                'message': 'Only room host can set video'
            }), 403
        
        # Update room with new video
        collection = Room.get_collection()
        result = collection.update_one(
            {'room_id': room_id},
            {'$set': {
                'movie_source': {
                    'type': 'google_drive',
                    'video_id': data['video_id'],
                    'video_name': data.get('video_name', '')
                },
                'updated_at': datetime.utcnow()
            }}
        )
        
        if result.modified_count > 0:
            return jsonify({
                'success': True,
                'message': 'Video updated successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to update video'
            }), 500
            
    except Exception as e:
        print(f"❌ Error setting room video: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500
