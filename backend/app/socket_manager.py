from flask_socketio import SocketIO, emit, join_room, leave_room
from app.models import Room
from datetime import datetime
import os

# Initialize SocketIO
socketio = SocketIO()

# Utility: recursively convert datetime objects to ISO strings so
# payloads are JSON serializable for Socket.IO
def _to_json_safe(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _to_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_json_safe(v) for v in obj]
    return obj

def init_socketio(app):
    """Initialize SocketIO with the Flask app"""
    socketio.init_app(app, cors_allowed_origins="*")
    register_handlers()
    return socketio

def register_handlers():
    """Register all socket event handlers"""
    
    @socketio.on('connect')
    def handle_connect():
        """Handle client connection"""
        emit('connection_response', {'status': 'connected'})
    
    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection"""
        # Client disconnection is handled by the leave_room event
        pass
    
    @socketio.on('join_room')
    def handle_join_room(data):
        """Handle client joining a room"""
        try:
            # Validate required data
            if 'room_id' not in data:
                emit('error', {'message': 'Room ID is required'})
                return
            
            if 'user_id' not in data:
                emit('error', {'message': 'User ID is required'})
                return
            
            room_id = data['room_id']
            user_id = data['user_id']
            
            # Check if room exists
            room_data = Room.find_by_id(room_id)
            if not room_data:
                emit('error', {'message': 'Room not found'})
                return
            
            # Check if room is password protected
            if room_data.get('password') and data.get('password') != room_data['password']:
                emit('error', {'message': 'Invalid password'})
                return
            
            # Add user to room
            try:
                room_data = Room.add_participant(room_id, user_id)
            except ValueError as e:
                emit('error', {'message': str(e)})
                return
            
            # Join the socket.io room
            join_room(room_id)
            
            # Notify all users in the room
            safe_room = _to_json_safe(room_data)
            emit('user_joined', {
                'user_id': user_id,
                'room_id': room_id,
                'participants': safe_room['participants']
            }, to=room_id)
            
            # Send room data to the client
            emit('room_joined', {
                'room': {
                    'room_id': safe_room['room_id'],
                    'name': safe_room['name'],
                    'description': safe_room['description'],
                    'movie_source': safe_room['movie_source'],
                    'enable_chat': safe_room['enable_chat'],
                    'enable_reactions': safe_room['enable_reactions'],
                    'participants': safe_room['participants'],
                    'playback_state': safe_room['playback_state'],
                    'host_id': safe_room['host_id']
                }
            })
            
        except Exception as e:
            emit('error', {'message': f'Failed to join room: {str(e)}'})
    
    @socketio.on('leave_room')
    def handle_leave_room(data):
        """Handle client leaving a room"""
        try:
            # Validate required data
            if 'room_id' not in data:
                emit('error', {'message': 'Room ID is required'})
                return
            
            if 'user_id' not in data:
                emit('error', {'message': 'User ID is required'})
                return
            
            room_id = data['room_id']
            user_id = data['user_id']
            
            # Remove user from room
            try:
                room_data = Room.remove_participant(room_id, user_id)
            except ValueError as e:
                emit('error', {'message': str(e)})
                return
            
            # Leave the socket.io room
            leave_room(room_id)
            
            # Notify all users in the room
            emit('user_left', {
                'user_id': user_id,
                'room_id': room_id,
                'participants': room_data['participants']
            }, to=room_id)
            
            # Send confirmation to the client
            emit('room_left', {
                'room_id': room_id
            })
            
        except Exception as e:
            emit('error', {'message': f'Failed to leave room: {str(e)}'})
    
    @socketio.on('update_playback')
    def handle_update_playback(data):
        """Handle playback state update"""
        try:
            # Validate required data
            if 'room_id' not in data:
                emit('error', {'message': 'Room ID is required'})
                return
            
            if 'user_id' not in data:
                emit('error', {'message': 'User ID is required'})
                return
            
            if 'playback_state' not in data:
                emit('error', {'message': 'Playback state is required'})
                return
            
            room_id = data['room_id']
            user_id = data['user_id']
            playback_state = data['playback_state']
            
            # Check if room exists
            room_data = Room.find_by_id(room_id)
            if not room_data:
                emit('error', {'message': 'Room not found'})
                return
            
            # Check if user is in the room
            user_in_room = False
            is_host = False
            for participant in room_data['participants']:
                if participant['user_id'] == user_id:
                    user_in_room = True
                    is_host = participant.get('is_host', False)
                    break
            
            if not user_in_room:
                emit('error', {'message': 'User not in room'})
                return
            
            # Only host can update playback state (unless specified otherwise)
            if not is_host and room_data.get('host_only_controls', True):
                emit('error', {'message': 'Only host can control playback'})
                return
            
            # Update playback state
            room_data = Room.update_playback_state(room_id, playback_state)
            
            # Broadcast to all users in the room
            emit('playback_updated', {
                'room_id': room_id,
                'playback_state': playback_state,
                'updated_by': user_id
            }, to=room_id)
            
        except Exception as e:
            emit('error', {'message': f'Failed to update playback: {str(e)}'})
    
    @socketio.on('chat_message')
    def handle_chat_message(data):
        """Handle chat message"""
        try:
            # Validate required data
            if 'room_id' not in data:
                emit('error', {'message': 'Room ID is required'})
                return
            
            if 'user_id' not in data:
                emit('error', {'message': 'User ID is required'})
                return
            
            if 'message' not in data:
                emit('error', {'message': 'Message is required'})
                return
            
            room_id = data['room_id']
            user_id = data['user_id']
            message = data['message']
            
            # Check if room exists
            room_data = Room.find_by_id(room_id)
            if not room_data:
                emit('error', {'message': 'Room not found'})
                return
            
            # Check if chat is enabled
            if not room_data.get('enable_chat', True):
                emit('error', {'message': 'Chat is disabled in this room'})
                return
            
            # Check if user is in the room
            user_in_room = False
            for participant in room_data['participants']:
                if participant['user_id'] == user_id:
                    user_in_room = True
                    break
            
            if not user_in_room:
                emit('error', {'message': 'User not in room'})
                return
            
            # Broadcast message to all users in the room
            emit('new_chat_message', {
                'room_id': room_id,
                'user_id': user_id,
                'message': message,
                'timestamp': str(datetime.utcnow())
            }, to=room_id)
            
        except Exception as e:
            emit('error', {'message': f'Failed to send message: {str(e)}'})
    
    @socketio.on('reaction')
    def handle_reaction(data):
        """Handle user reaction"""
        try:
            # Validate required data
            if 'room_id' not in data:
                emit('error', {'message': 'Room ID is required'})
                return
            
            if 'user_id' not in data:
                emit('error', {'message': 'User ID is required'})
                return
            
            if 'reaction' not in data:
                emit('error', {'message': 'Reaction is required'})
                return
            
            room_id = data['room_id']
            user_id = data['user_id']
            reaction = data['reaction']
            
            # Check if room exists
            room_data = Room.find_by_id(room_id)
            if not room_data:
                emit('error', {'message': 'Room not found'})
                return
            
            # Check if reactions are enabled
            if not room_data.get('enable_reactions', True):
                emit('error', {'message': 'Reactions are disabled in this room'})
                return
            
            # Check if user is in the room
            user_in_room = False
            for participant in room_data['participants']:
                if participant['user_id'] == user_id:
                    user_in_room = True
                    break
            
            if not user_in_room:
                emit('error', {'message': 'User not in room'})
                return
            
            # Broadcast reaction to all users in the room
            emit('new_reaction', {
                'room_id': room_id,
                'user_id': user_id,
                'reaction': reaction
            }, to=room_id)
            
        except Exception as e:
            emit('error', {'message': f'Failed to send reaction: {str(e)}'})
