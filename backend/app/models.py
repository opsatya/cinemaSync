from pymongo import MongoClient
import os
import uuid
from datetime import datetime

# MongoDB connection
client = None
db = None

def init_db():
    """Initialize MongoDB connection"""
    global client, db
    mongo_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
    db_name = os.getenv('MONGODB_DB_NAME', 'CinemaSync')
    
    try:
        client = MongoClient(mongo_uri)
        db = client[db_name]
        print(f"Connected to MongoDB: {db_name}")
        return True
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        return False

# Movie metadata model
class MovieMetadata:
    """Helper class for movie metadata operations"""
    collection_name = 'movie_metadata'
    
    @staticmethod
    def get_collection():
        """Get the MongoDB collection"""
        if db is None:
            init_db()
        return db[MovieMetadata.collection_name]
    
    @staticmethod
    def find_by_file_id(file_id):
        """Find movie metadata by Google Drive file ID"""
        collection = MovieMetadata.get_collection()
        return collection.find_one({'file_id': file_id})
    
    @staticmethod
    def find_by_parent_folder(folder_id, limit=100, skip=0):
        """Find all movie metadata in a specific folder"""
        collection = MovieMetadata.get_collection()
        cursor = collection.find({'parent_folder_id': folder_id}).skip(skip).limit(limit)
        return list(cursor)
    
    @staticmethod
    def search_movies(query, limit=20):
        """Search for movies by name"""
        if not query:
            return []
            
        collection = MovieMetadata.get_collection()
        # Create a text index if it doesn't exist
        try:
            collection.create_index([('name', 'text')])
        except Exception as e:
            print(f"Error creating text index: {e}")
            
        # Perform text search
        cursor = collection.find(
            {'$text': {'$search': query}},
            {'score': {'$meta': 'textScore'}}
        ).sort([('score', {'$meta': 'textScore'})]).limit(limit)
        
        return list(cursor)
    
    @staticmethod
    def save_metadata(metadata):
        """Save or update movie metadata"""
        collection = MovieMetadata.get_collection()
        
        # Ensure required fields
        if 'id' in metadata and 'file_id' not in metadata:
            metadata['file_id'] = metadata['id']
            
        if 'file_id' not in metadata:
            raise ValueError("file_id is required")
        
        # Add timestamps
        metadata['updated_at'] = datetime.utcnow()
        
        # Check if document already exists
        existing = collection.find_one({'file_id': metadata['file_id']})
        
        if existing:
            # Update existing document
            collection.update_one(
                {'file_id': metadata['file_id']},
                {'$set': metadata}
            )
            return metadata['file_id']
        else:
            # Add created_at for new documents
            metadata['created_at'] = datetime.utcnow()
            
            # Insert new document
            result = collection.insert_one(metadata)
            return result.inserted_id
    
    @staticmethod
    def delete_metadata(file_id):
        """Delete movie metadata"""
        collection = MovieMetadata.get_collection()
        result = collection.delete_one({'file_id': file_id})
        return result.deleted_count > 0
        
    @staticmethod
    def get_recent_movies(limit=20):
        """Get recently accessed movies"""
        collection = MovieMetadata.get_collection()
        cursor = collection.find({'type': 'video'}).sort('updated_at', -1).limit(limit)
        return list(cursor)

# OAuth tokens per user for Google Drive access
class UserToken:
    """Store OAuth credentials (access + refresh tokens) per user"""
    collection_name = 'user_tokens'

    @staticmethod
    def get_collection():
        """Get the MongoDB collection for user tokens"""
        if db is None:
            init_db()
        return db[UserToken.collection_name]

    @staticmethod
    def save_tokens(user_id, provider, token_data):
        """Insert or update tokens for a user/provider"""
        collection = UserToken.get_collection()
        token_record = {
            'user_id': user_id,
            'provider': provider,
            'access_token': token_data.get('access_token'),
            'refresh_token': token_data.get('refresh_token'),
            'token_type': token_data.get('token_type'),
            'scope': token_data.get('scope'),
            'expiry': token_data.get('expiry'),
            'updated_at': datetime.utcnow()
        }
        # Upsert on user_id + provider
        collection.update_one(
            {'user_id': user_id, 'provider': provider},
            {'$set': token_record, '$setOnInsert': {'created_at': datetime.utcnow()}},
            upsert=True
        )
        return True

    @staticmethod
    def get_tokens(user_id, provider):
        """Fetch tokens for a user/provider"""
        collection = UserToken.get_collection()
        return collection.find_one({'user_id': user_id, 'provider': provider})

    @staticmethod
    def delete_tokens(user_id, provider):
        collection = UserToken.get_collection()
        result = collection.delete_one({'user_id': user_id, 'provider': provider})
        return result.deleted_count > 0

# Room model for movie watching sessions
class Room:
    """Helper class for room operations"""
    collection_name = 'rooms'
    
    @staticmethod
    def get_collection():
        """Get the MongoDB collection"""
        if db is None:
            init_db()
        return db[Room.collection_name]
    
    @staticmethod
    def create_room(data):
        """Create a new room"""
        collection = Room.get_collection()
        
        # Generate a unique room ID
        room_id = str(uuid.uuid4())[:8].upper()
        
        # Ensure required fields
        if 'host_id' not in data:
            raise ValueError("host_id is required")
        if 'movie_source' not in data:
            raise ValueError("movie_source is required")
            
        # Create room document
        room_data = {
            'room_id': room_id,
            'host_id': data['host_id'],
            'name': data.get('name', f"Room {room_id}"),
            'description': data.get('description', ''),
            'movie_source': data['movie_source'],
            'password': data.get('password', None),
            'is_private': data.get('is_private', True),
            'enable_chat': data.get('enable_chat', True),
            'enable_reactions': data.get('enable_reactions', True),
            'max_participants': data.get('max_participants', 10),
            'participants': [{
                'user_id': data['host_id'],
                'is_host': True,
                'joined_at': datetime.utcnow()
            }],
            'playback_state': {
                'is_playing': False,
                'current_time': 0,
                'last_updated': datetime.utcnow()
            },
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'is_active': True
        }
        
        # Insert room document
        result = collection.insert_one(room_data)
        
        if result.inserted_id:
            return room_data
        else:
            raise Exception("Failed to create room")
    
    @staticmethod
    def find_by_id(room_id):
        """Find room by ID"""
        collection = Room.get_collection()
        return collection.find_one({'room_id': room_id})
    
    @staticmethod
    def find_by_user_id(user_id):
        """Find all active rooms a user is a participant in."""
        collection = Room.get_collection()
        cursor = collection.find({
            'participants.user_id': user_id,
            'is_active': True
        }).sort('updated_at', -1)
        return list(cursor)
    
    @staticmethod
    def add_participant(room_id, user_id):
        """Add a participant to a room"""
        collection = Room.get_collection()
        room = Room.find_by_id(room_id)
        
        if not room:
            raise ValueError("Room not found")
            
        # Check if user is already in the room
        for participant in room['participants']:
            if participant['user_id'] == user_id:
                return room
                
        # Check if room is full
        if len(room['participants']) >= room['max_participants']:
            raise ValueError("Room is full")
            
        # Add participant
        collection.update_one(
            {'room_id': room_id},
            {'$push': {'participants': {
                'user_id': user_id,
                'is_host': False,
                'joined_at': datetime.utcnow()
            }}}
        )
        
        return Room.find_by_id(room_id)
    
    @staticmethod
    def remove_participant(room_id, user_id):
        """Remove a participant from a room"""
        collection = Room.get_collection()
        room = Room.find_by_id(room_id)
        
        if not room:
            raise ValueError("Room not found")
            
        # Remove participant
        collection.update_one(
            {'room_id': room_id},
            {'$pull': {'participants': {'user_id': user_id}}}
        )
        
        # If room is empty, deactivate it
        updated_room = Room.find_by_id(room_id)
        if len(updated_room['participants']) == 0:
            Room.deactivate_room(room_id)
            
        return updated_room
    
    @staticmethod
    def update_playback_state(room_id, playback_state):
        """Update room playback state"""
        collection = Room.get_collection()
        room = Room.find_by_id(room_id)
        
        if not room:
            raise ValueError("Room not found")
            
        # Update playback state
        playback_state['last_updated'] = datetime.utcnow()
        
        collection.update_one(
            {'room_id': room_id},
            {'$set': {
                'playback_state': playback_state,
                'updated_at': datetime.utcnow()
            }}
        )
        
        return Room.find_by_id(room_id)
    
    @staticmethod
    def deactivate_room(room_id):
        """Deactivate a room"""
        collection = Room.get_collection()
        room = Room.find_by_id(room_id)
        
        if not room:
            raise ValueError("Room not found")
            
        collection.update_one(
            {'room_id': room_id},
            {'$set': {
                'is_active': False,
                'updated_at': datetime.utcnow()
            }}
        )
        
        return Room.find_by_id(room_id)
        
    @staticmethod
    def get_active_rooms(limit=20, skip=0):
        """Get list of active rooms"""
        collection = Room.get_collection()
        cursor = collection.find({'is_active': True, 'is_private': False})
        
        # Sort by creation date (newest first) and apply pagination
        cursor = cursor.sort('created_at', -1).skip(skip).limit(limit)
        
        return list(cursor)
