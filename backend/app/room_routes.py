from flask import Blueprint, jsonify, request, current_app
from app.models import Room
import jwt
import os
from functools import wraps

room_bp = Blueprint('room', __name__, url_prefix='/api/rooms')

# JWT Secret key
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key')

# Authentication decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check if token is in headers
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        # Check if token is in cookies
        if not token and 'token' in request.cookies:
            token = request.cookies['token']
            
        # Check if token is in query parameters
        if not token and 'token' in request.args:
            token = request.args.get('token')
            
        if not token:
            return jsonify({
                'success': False,
                'message': 'Authentication token is missing'
            }), 401
            
        try:
            # Verify token
            data = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            user_id = data['user_id']
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'Invalid token: {str(e)}'
            }), 401
            
        return f(user_id, *args, **kwargs)
    
    return decorated

@room_bp.route('/', methods=['GET'])
def get_active_rooms():
    """Get list of active public rooms"""
    try:
        # Get pagination parameters
        limit = int(request.args.get('limit', 20))
        skip = int(request.args.get('skip', 0))
        
        # Get active rooms
        rooms = Room.get_active_rooms(limit, skip)
        
        # Remove sensitive data
        for room in rooms:
            if '_id' in room:
                del room['_id']
            if 'password' in room:
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
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@room_bp.route('/', methods=['POST'])
@token_required
def create_room(user_id):
    """Create a new room"""
    try:
        # Get request data
        data = request.get_json()
        
        # Add user_id as host_id
        data['host_id'] = user_id
        
        # Create room
        room = Room.create_room(data)
        
        # Remove sensitive data
        if '_id' in room:
            del room['_id']
        
        return jsonify({
            'success': True,
            'room': room
        }), 201
    except ValueError as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@room_bp.route('/<room_id>', methods=['GET'])
def get_room(room_id):
    """Get room details"""
    try:
        # Get room
        room = Room.find_by_id(room_id)
        
        if not room:
            return jsonify({
                'success': False,
                'message': 'Room not found'
            }), 404
        
        # Remove sensitive data
        if '_id' in room:
            del room['_id']
        if 'password' in room:
            # Only indicate if password is required
            room['password_required'] = room['password'] is not None
            del room['password']
        
        return jsonify({
            'success': True,
            'room': room
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@room_bp.route('/<room_id>/join', methods=['POST'])
@token_required
def join_room(user_id, room_id):
    """Join a room"""
    try:
        # Get request data
        data = request.get_json() or {}
        
        # Get room
        room = Room.find_by_id(room_id)
        
        if not room:
            return jsonify({
                'success': False,
                'message': 'Room not found'
            }), 404
        
        # Check if room is active
        if not room.get('is_active', True):
            return jsonify({
                'success': False,
                'message': 'Room is no longer active'
            }), 400
        
        # Check if room is password protected
        if room.get('password') and data.get('password') != room['password']:
            return jsonify({
                'success': False,
                'message': 'Invalid password'
            }), 401
        
        # Add user to room
        try:
            room = Room.add_participant(room_id, user_id)
        except ValueError as e:
            return jsonify({
                'success': False,
                'message': str(e)
            }), 400
        
        # Remove sensitive data
        if '_id' in room:
            del room['_id']
        if 'password' in room:
            del room['password']
        
        return jsonify({
            'success': True,
            'room': room
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@room_bp.route('/<room_id>/leave', methods=['POST'])
@token_required
def leave_room(user_id, room_id):
    """Leave a room"""
    try:
        # Remove user from room
        try:
            room = Room.remove_participant(room_id, user_id)
        except ValueError as e:
            return jsonify({
                'success': False,
                'message': str(e)
            }), 400
        
        # Remove sensitive data
        if '_id' in room:
            del room['_id']
        if 'password' in room:
            del room['password']
        
        return jsonify({
            'success': True,
            'room': room
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500
