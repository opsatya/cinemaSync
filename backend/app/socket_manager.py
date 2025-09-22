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
    # Align socket CORS with Flask CORS to avoid origin mismatches
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    frontend_url = os.getenv("FRONTEND_URL")
    if frontend_url:
        allowed_origins.append(frontend_url.rstrip("/"))

    socketio.init_app(app, cors_allowed_origins=allowed_origins)
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
    def on_update_playback(data):
        """Handle playback control - FIXED VERSION"""
        try:
            print(f"🎮 update_playback event: {data}")
            
            room_id = data.get('room_id')
            user_id = data.get('user_id') 
            playback_state = data.get('playback_state')
            
            if not all([room_id, user_id, playback_state]):
                emit('error', {'message': 'Missing required playback data'})
                return
            
            # Get fresh room data from database
            room = Room.find_by_id(room_id)
            if not room:
                emit('error', {'message': 'Room not found'})
                return
            
            # Check if user is in the room participants
            participants = room.get('participants', [])
            user_in_room = False
            for participant in participants:
                if isinstance(participant, dict) and str(participant.get('user_id')) == str(user_id):
                    user_in_room = True
                    break
                elif isinstance(participant, str) and str(participant) == str(user_id):
                    user_in_room = True
                    break
            
            if not user_in_room:
                print(f"❌ User {user_id} not found in room participants: {participants}")
                emit('error', {'message': 'User not in room'})
                return
            
            # Proper host verification
            room_host_id = room.get('host_id')
            is_user_host = (str(room_host_id) == str(user_id))
            
            print(f"🔍 Host verification: room_host_id={room_host_id}, user_id={user_id}, is_host={is_user_host}")
            
            if not is_user_host:
                print(f"❌ User {user_id} is not the host (host is {room_host_id})")
                emit('error', {'message': 'Only host can control playback'})
                return
            
            # FIXED: Update room playback state
            try:
                updated_room = Room.update_playback_state(room_id, playback_state)
                
                # FIXED: Create a clean playback_state for broadcasting (no datetime objects)
                broadcast_state = {
                    'is_playing': playback_state.get('is_playing', False),
                    'current_time': playback_state.get('current_time', 0),
                    'last_updated': datetime.utcnow().isoformat()  # Convert to ISO string immediately
                }
                
                print(f"✅ Playback updated: {broadcast_state}")
                
                # Broadcast to all users in the room with clean data
                emit('playback_updated', {
                    'playback_state': broadcast_state,  # Use clean state instead of original
                    'updated_by': user_id
                }, room=room_id)
                
            except Exception as e:
                print(f"❌ Failed to update playback state: {e}")
                emit('error', {'message': f'Failed to update playback: {str(e)}'})
                return
                
        except Exception as e:
            print(f"❌ update_playback error: {e}")
            emit('error', {'message': f'Playback update failed: {str(e)}'})
    
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
                if str(participant.get('user_id')) == str(user_id):
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
                if str(participant.get('user_id')) == str(user_id):
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
