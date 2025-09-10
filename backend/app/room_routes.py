from flask import Blueprint, jsonify, request, g
from app.models import Room
from app.auth_middleware import token_required  # IMPORT THE MIDDLEWARE
import os

room_bp = Blueprint('room', __name__, url_prefix='/api/rooms')

# Remove the duplicate token_required decorator - use the imported one instead

@room_bp.route('/', methods=['GET'])
def get_active_rooms():
    """Get list of active public rooms"""
    try:
        # Get pagination parameters with validation
        limit = min(max(int(request.args.get('limit', 20)), 1), 100)
        skip = max(int(request.args.get('skip', 0)), 0)
        
        rooms = Room.get_active_rooms(limit, skip)
        
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
        return jsonify({
            'success': False,
            'message': f'Invalid pagination parameters: {str(e)}'
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to fetch rooms: {str(e)}'
        }), 500

@room_bp.route('/', methods=['POST'])
@token_required  # USE THE IMPORTED MIDDLEWARE
def create_room():
    """Create a new room"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': 'Request body is required'
            }), 400
        
        # Validate required fields
        required_fields = ['name', 'movie_source']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'message': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Use the user_id from g object (set by middleware)
        data['host_id'] = g.current_user_id
        
        room = Room.create_room(data)
        
        if '_id' in room:
            del room['_id']
        
        return jsonify({
            'success': True,
            'room': room,
            'message': 'Room created successfully'
        }), 201
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to create room: {str(e)}'
        }), 500

@room_bp.route('/<room_id>', methods=['GET'])
def get_room(room_id):
    """Get room details"""
    try:
        if not room_id or not room_id.strip():
            return jsonify({
                'success': False,
                'message': 'Room ID is required'
            }), 400
        
        room = Room.find_by_id(room_id.strip())
        
        if not room:
            return jsonify({
                'success': False,
                'message': 'Room not found'
            }), 404
        
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
        return jsonify({
            'success': False,
            'message': f'Failed to get room details: {str(e)}'
        }), 500

@room_bp.route('/my-rooms', methods=['GET'])
@token_required
def get_my_rooms():
    """Get list of rooms the current user is part of."""
    try:
        user_id = g.current_user_id
        
        rooms = Room.find_by_user_id(user_id)
        
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
            'count': len(rooms)
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to fetch user rooms: {str(e)}'
        }), 500

@room_bp.route('/<room_id>/join', methods=['POST'])
@token_required  # USE THE IMPORTED MIDDLEWARE
def join_room(room_id):
    """Join a room"""
    try:
        if not room_id or not room_id.strip():
            return jsonify({
                'success': False,
                'message': 'Room ID is required'
            }), 400
        
        data = request.get_json() or {}
        room = Room.find_by_id(room_id.strip())
        
        if not room:
            return jsonify({
                'success': False,
                'message': 'Room not found'
            }), 404
        
        if not room.get('is_active', True):
            return jsonify({
                'success': False,
                'message': 'Room is no longer active'
            }), 400
        
        if room.get('password') and data.get('password') != room['password']:
            return jsonify({
                'success': False,
                'message': 'Invalid password'
            }), 401
        
        try:
            room = Room.add_participant(room_id.strip(), g.current_user_id)
        except ValueError as e:
            return jsonify({
                'success': False,
                'message': str(e)
            }), 400
        
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
        return jsonify({
            'success': False,
            'message': f'Failed to join room: {str(e)}'
        }), 500

@room_bp.route('/<room_id>/leave', methods=['POST'])
@token_required  # USE THE IMPORTED MIDDLEWARE
def leave_room(room_id):
    """Leave a room"""
    try:
        if not room_id or not room_id.strip():
            return jsonify({
                'success': False,
                'message': 'Room ID is required'
            }), 400
        
        try:
            room = Room.remove_participant(room_id.strip(), g.current_user_id)
        except ValueError as e:
            return jsonify({
                'success': False,
                'message': str(e)
            }), 400
        
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
        return jsonify({
            'success': False,
            'message': f'Failed to leave room: {str(e)}'
        }), 500

@room_bp.route('/<room_id>/playback', methods=['POST'])
@token_required  # USE THE IMPORTED MIDDLEWARE
def update_playback_state(room_id):
    """Update room playback state (only host can do this)"""
    try:
        if not room_id or not room_id.strip():
            return jsonify({
                'success': False,
                'message': 'Room ID is required'
            }), 400
        
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': 'Playback state data is required'
            }), 400
        
        room = Room.find_by_id(room_id.strip())
        
        if not room:
            return jsonify({
                'success': False,
                'message': 'Room not found'
            }), 404
        
        if room.get('host_id') != g.current_user_id:
            return jsonify({
                'success': False,
                'message': 'Only room host can control playback'
            }), 403
        
        playback_state = {
            'is_playing': data.get('is_playing', False),
            'current_time': data.get('current_time', 0),
        }
        
        room = Room.update_playback_state(room_id.strip(), playback_state)
        
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
        return jsonify({
            'success': False,
            'message': f'Failed to update playback state: {str(e)}'
        }), 500
