from pymongo import MongoClient
import os
import uuid
from datetime import datetime
import json
import traceback
import sys

# MongoDB connection
client = None
db = None

def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

def serialize_document(doc):
    """Convert MongoDB document to JSON-serializable format"""
    if not doc:
        return None
    
    # Create a copy to avoid modifying original data
    serialized = {}
    
    for key, value in doc.items():
        if key == '_id':
            # Skip MongoDB's _id field or convert to string if needed
            continue
        elif isinstance(value, datetime):
            # Convert datetime to ISO string
            serialized[key] = value.isoformat()
        elif isinstance(value, list):
            # Handle lists that might contain datetime objects
            serialized[key] = []
            for item in value:
                if isinstance(item, dict):
                    # Serialize nested dictionaries
                    serialized_item = {}
                    for k, v in item.items():
                        if isinstance(v, datetime):
                            serialized_item[k] = v.isoformat()
                        else:
                            serialized_item[k] = v
                    serialized[key].append(serialized_item)
                elif isinstance(item, datetime):
                    serialized[key].append(item.isoformat())
                else:
                    serialized[key].append(item)
        elif isinstance(value, dict):
            # Handle nested dictionaries
            serialized_dict = {}
            for k, v in value.items():
                if isinstance(v, datetime):
                    serialized_dict[k] = v.isoformat()
                else:
                    serialized_dict[k] = v
            serialized[key] = serialized_dict
        else:
            serialized[key] = value
    
    return serialized

def init_db():
    """Initialize MongoDB connection"""
    global client, db
    mongo_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
    db_name = os.getenv('MONGODB_DB_NAME', 'cinemasync')
    
    try:
        print(f"🔍 Initializing MongoDB connection...")
        print(f"   URI: {mongo_uri}")
        print(f"   Database: {db_name}")
        
        client = MongoClient(mongo_uri)
        db = client[db_name]
        
        # Test connection
        client.admin.command('ping')
        print(f"✅ Connected to MongoDB: {db_name}")
        return True
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        traceback.print_exc()
        return False

# Movie metadata model
class MovieMetadata:
    """Helper class for movie metadata operations"""
    collection_name = 'movie_metadata'
    
    @staticmethod
    def get_collection():
        """Get the MongoDB collection"""
        try:
            if db is None:
                print("🔍 Database not initialized, calling init_db()...")
                init_db()
            collection = db[MovieMetadata.collection_name]
            print(f"🔍 Got MovieMetadata collection: {collection.name}")
            return collection
        except Exception as e:
            print(f"❌ Error getting MovieMetadata collection: {e}")
            raise e
    
    @staticmethod
    def find_by_file_id(file_id):
        """Find movie metadata by Google Drive file ID"""
        try:
            print(f"🔍 Finding movie metadata for file_id: {file_id}")
            collection = MovieMetadata.get_collection()
            doc = collection.find_one({'file_id': file_id})
            result = serialize_document(doc)
            print(f"   Found: {bool(result)}")
            return result
        except Exception as e:
            print(f"❌ Error finding movie metadata: {e}")
            return None
    
    @staticmethod
    def search_movies(query, limit=20):
        """Search for movies by name"""
        if not query:
            return []
            
        try:
            print(f"🔍 Searching movies for query: '{query}', limit: {limit}")
            collection = MovieMetadata.get_collection()
            
            # Create a text index if it doesn't exist
            try:
                collection.create_index([('name', 'text')])
            except Exception as e:
                print(f"   Text index already exists or error: {e}")
                
            # Perform text search
            cursor = collection.find(
                {'$text': {'$search': query}},
                {'score': {'$meta': 'textScore'}}
            ).sort([('score', {'$meta': 'textScore'})]).limit(limit)
            
            results = [serialize_document(doc) for doc in cursor]
            print(f"   Found {len(results)} matching movies")
            return results
        except Exception as e:
            print(f"❌ Error searching movies: {e}")
            return []
    
    @staticmethod
    def get_recent_movies(limit=20):
        """Get recently accessed movies"""
        try:
            print(f"🔍 Getting {limit} recent movies")
            collection = MovieMetadata.get_collection()
            cursor = collection.find({'type': 'video'}).sort('updated_at', -1).limit(limit)
            results = [serialize_document(doc) for doc in cursor]
            print(f"   Found {len(results)} recent movies")
            return results
        except Exception as e:
            print(f"❌ Error getting recent movies: {e}")
            return []

# OAuth tokens per user for Google Drive access
class UserToken:
    """Store OAuth credentials (access + refresh tokens) per user"""
    collection_name = 'user_tokens'

    @staticmethod
    def get_collection():
        """Get the MongoDB collection for user tokens"""
        try:
            if db is None:
                print("🔍 Database not initialized, calling init_db()...")
                init_db()
            collection = db[UserToken.collection_name]
            print(f"🔍 Got UserToken collection: {collection.name}")
            return collection
        except Exception as e:
            print(f"❌ Error getting UserToken collection: {e}")
            raise e

    @staticmethod
    def save_tokens(user_id, provider, token_data):
        """Insert or update tokens for a user/provider"""
        try:
            print(f"🔐 Saving tokens for user: {user_id}, provider: {provider}")
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
            result = collection.update_one(
                {'user_id': user_id, 'provider': provider},
                {'$set': token_record, '$setOnInsert': {'created_at': datetime.utcnow()}},
                upsert=True
            )
            
            print(f"   Tokens saved: matched={result.matched_count}, modified={result.modified_count}, upserted={bool(result.upserted_id)}")
            return True
        except Exception as e:
            print(f"❌ Error saving tokens: {e}")
            return False

    @staticmethod
    def get_tokens(user_id, provider):
        """Fetch tokens for a user/provider"""
        try:
            print(f"🔐 Getting tokens for user: {user_id}, provider: {provider}")
            collection = UserToken.get_collection()
            doc = collection.find_one({'user_id': user_id, 'provider': provider})
            result = serialize_document(doc)
            print(f"   Found tokens: {bool(result)}")
            return result
        except Exception as e:
            print(f"❌ Error getting tokens: {e}")
            return None

# User management model for persistent user data
class User:
    """User management model for persistent user data"""
    collection_name = 'users'
    
    @staticmethod
    def get_collection():
        """Get the MongoDB collection for users"""
        try:
            if db is None:
                init_db()
            collection = db[User.collection_name]
            return collection
        except Exception as e:
            print(f"❌ Error getting User collection: {e}")
            raise e
    
    @staticmethod
    def upsert_user(user_data):
        """Create or update user profile"""
        try:
            collection = User.get_collection()
            
            user_record = {
                'user_id': user_data['user_id'],
                'name': user_data.get('name'),
                'email': user_data.get('email'),
                'updated_at': datetime.utcnow(),
                'last_login': datetime.utcnow()
            }
            
            result = collection.update_one(
                {'user_id': user_data['user_id']},
                {'$set': user_record, '$setOnInsert': {'created_at': datetime.utcnow()}},
                upsert=True
            )
            
            return result.acknowledged
        except Exception as e:
            print(f"❌ Error upserting user: {e}")
            return False
    
    @staticmethod
    def get_user(user_id):
        """Get user by ID"""
        try:
            collection = User.get_collection()
            doc = collection.find_one({'user_id': user_id})
            return serialize_document(doc)
        except Exception as e:
            print(f"❌ Error getting user: {e}")
            return None

# Room model for movie watching sessions
class Room:
    """Helper class for room operations"""
    collection_name = 'rooms'
    
    @staticmethod
    def get_collection():
        """Get the MongoDB collection"""
        try:
            print(f"🏠 Getting Room collection...")
            if db is None:
                print("   Database not initialized, calling init_db()...")
                if not init_db():
                    raise Exception("Failed to initialize database")
            
            collection = db[Room.collection_name]
            print(f"   Got collection: {collection.name}")
            print(f"   Database: {collection.database.name}")
            
            # Test collection access
            count = collection.count_documents({})
            print(f"   Collection has {count} documents")
            
            return collection
        except Exception as e:
            print(f"❌ Error getting Room collection: {e}")
            traceback.print_exc()
            raise e
    
    @staticmethod
    def create_room(data):
        """Create a new room"""
        try:
            print("🏗️ Room.create_room: Starting room creation")
            print(f"   Input data keys: {list(data.keys()) if data else 'None'}")
            print(f"   Host ID: {data.get('host_id', 'MISSING')}")
            print(f"   Movie source: {data.get('movie_source', 'MISSING')}")
            
            # Validate input data
            if not data:
                raise ValueError("Room data is required")
            if 'host_id' not in data:
                raise ValueError("host_id is required")
            if 'movie_source' not in data:
                raise ValueError("movie_source is required")
            
            # Get database collection
            print("   Getting database collection...")
            collection = Room.get_collection()
            
            # Generate a unique room ID
            room_id = str(uuid.uuid4())[:8].upper()
            print(f"   Generated room_id: {room_id}")
            
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
            
            print("   Prepared room data:")
            for key, value in room_data.items():
                if key == 'password':
                    print(f"     {key}: {'***' if value else 'None'}")
                elif key == 'participants':
                    print(f"     {key}: [{len(value)} participants]")
                else:
                    print(f"     {key}: {value}")
            
            # Insert room document
            print("   Inserting room document into MongoDB...")
            result = collection.insert_one(room_data)
            print(f"   Insert result: {result}")
            print(f"   Inserted ID: {result.inserted_id}")
            print(f"   Insert acknowledged: {result.acknowledged}")
            
            if result.inserted_id and result.acknowledged:
                print(f"✅ Room created successfully: {room_id}")
                print(f"   Host {data['host_id']} added as participant")
                
                # Verify the insertion by fetching the document
                try:
                    print("   Verifying insertion by fetching document...")
                    fetched = collection.find_one({'_id': result.inserted_id})
                    if fetched:
                        print("   ✅ Document successfully fetched after insertion")
                        return serialize_document(fetched)
                    else:
                        print("   ⚠️ Warning: Could not fetch document after insertion")
                        return serialize_document(room_data)
                except Exception as fetch_error:
                    print(f"   ⚠️ Warning: Error fetching after insert: {fetch_error}")
                    return serialize_document(room_data)
            else:
                error_msg = f"Failed to insert room: acknowledged={result.acknowledged}, id={result.inserted_id}"
                print(f"❌ {error_msg}")
                raise Exception(error_msg)
                
        except ValueError as ve:
            print(f"❌ Validation error in Room.create_room: {ve}")
            raise ve
        except Exception as e:
            print(f"❌ Exception in Room.create_room: {str(e)}")
            print(f"   Error type: {type(e).__name__}")
            print("   Full traceback:")
            traceback.print_exc()
            raise e
    
    @staticmethod
    def find_by_id(room_id):
        """Find room by ID and return serialized data"""
        try:
            print(f"🔍 Finding room by ID: {room_id}")
            collection = Room.get_collection()
            doc = collection.find_one({'room_id': room_id})
            result = serialize_document(doc)
            print(f"   Found room: {bool(result)}")
            if result:
                print(f"   Room name: {result.get('name', 'N/A')}")
                print(f"   Host: {result.get('host_id', 'N/A')}")
                print(f"   Active: {result.get('is_active', 'N/A')}")
            return result
        except Exception as e:
            print(f"❌ Error finding room {room_id}: {e}")
            traceback.print_exc()
            return None
    
    @staticmethod
    def find_by_user_id(user_id):
        """Find all rooms a user is a participant in OR hosting (active or inactive)."""
        try:
            print(f"🔍 Finding rooms for user_id: {user_id} (type: {type(user_id).__name__})")
            collection = Room.get_collection()
            
            # Convert user_id to string for consistent matching
            user_id_str = str(user_id)
            print(f"   Converted user_id_str: '{user_id_str}'")
            
            # Enhanced query with type handling (no active filter for my-rooms)
            query = {
                '$or': [
                    {'host_id': user_id_str},
                    {'host_id': user_id},
                    {'participants': {'$elemMatch': {'user_id': user_id_str}}},
                    {'participants': {'$elemMatch': {'user_id': user_id}}}
                ]
            }
            
            print(f"   All rooms query: {query}")
            
            cursor = collection.find(query).sort('updated_at', -1)
            rooms = [serialize_document(doc) for doc in cursor]
            
            print(f"   All rooms found (including inactive): {len(rooms)}")
            
            # Diagnostic: Count active only
            host_count_active = collection.count_documents({'host_id': user_id_str, 'is_active': True})
            print(f"   Active host rooms: {host_count_active}")
            
            # Diagnostic: Sample room data if any found
            if rooms:
                sample = rooms[0]
                print(f"   Sample room: room_id={sample.get('room_id')}, is_active={sample.get('is_active')}")
                print(f"   Sample host_id: '{sample.get('host_id')}' (type: {type(sample.get('host_id')).__name__})")
                if sample.get('participants'):
                    sample_part = sample['participants'][0]
                    print(f"   Sample participant user_id: '{sample_part.get('user_id')}' (type: {type(sample_part.get('user_id')).__name__})")
            
            return rooms
            
        except Exception as e:
            print(f"❌ Error finding rooms for user {user_id}: {e}")
            traceback.print_exc()
            return []
    
    @staticmethod
    def add_participant(room_id, user_id):
        """Add a participant to a room"""
        try:
            print(f"👥 Adding participant {user_id} to room {room_id}")
            collection = Room.get_collection()
            room_doc = collection.find_one({'room_id': room_id})
            
            if not room_doc:
                error_msg = f"Room {room_id} not found"
                print(f"❌ {error_msg}")
                raise ValueError(error_msg)
            
            print(f"   Room found: {room_doc.get('name', 'N/A')}")
            print(f"   Current participants: {len(room_doc.get('participants', []))}")
                
            # Check if user is already in the room
            for participant in room_doc.get('participants', []):
                if participant.get('user_id') == user_id:
                    print(f"   User already in room")
                    return serialize_document(room_doc)
                    
            # Check if room is full
            max_participants = room_doc.get('max_participants', 10)
            current_count = len(room_doc.get('participants', []))
            if current_count >= max_participants:
                error_msg = f"Room is full ({current_count}/{max_participants})"
                print(f"❌ {error_msg}")
                raise ValueError(error_msg)
                
            # Add participant
            new_participant = {
                'user_id': user_id,
                'is_host': False,
                'joined_at': datetime.utcnow()
            }
            
            result = collection.update_one(
                {'room_id': room_id},
                {'$push': {'participants': new_participant}}
            )
            
            print(f"   Update result: matched={result.matched_count}, modified={result.modified_count}")
            
            if result.modified_count > 0:
                print(f"✅ Participant added successfully")
                return Room.find_by_id(room_id)
            else:
                raise Exception("Failed to add participant")
                
        except Exception as e:
            print(f"❌ Error adding participant: {e}")
            traceback.print_exc()
            raise e
    
    @staticmethod
    def get_active_rooms(limit=20, skip=0):
        """Get list of active public rooms"""
        try:
            print(f"🏠 Getting active rooms: limit={limit}, skip={skip}")
            collection = Room.get_collection()
            
            query = {'is_active': True, 'is_private': False}
            print(f"   Query: {query}")
            
            cursor = collection.find(query).sort('created_at', -1).skip(skip).limit(limit)
            rooms = [serialize_document(doc) for doc in cursor]
            
            print(f"   Found {len(rooms)} active public rooms")
            return rooms
            
        except Exception as e:
            print(f"❌ Error getting active rooms: {e}")
            traceback.print_exc()
            return []
    
    @staticmethod
    def update_playback_state(room_id, playback_state):
        """Update room playback state"""
        try:
            print(f"⏯️ Updating playback state for room {room_id}")
            print(f"   New state: {playback_state}")
            
            collection = Room.get_collection()
            room_doc = collection.find_one({'room_id': room_id})
            
            if not room_doc:
                error_msg = f"Room {room_id} not found"
                print(f"❌ {error_msg}")
                raise ValueError(error_msg)
                
            # Update playback state with datetime
            playback_state['last_updated'] = datetime.utcnow()
            
            result = collection.update_one(
                {'room_id': room_id},
                {'$set': {
                    'playback_state': playback_state,
                    'updated_at': datetime.utcnow()
                }}
            )
            
            print(f"   Update result: matched={result.matched_count}, modified={result.modified_count}")
            
            if result.modified_count > 0:
                print(f"✅ Playback state updated successfully")
                return Room.find_by_id(room_id)
            else:
                raise Exception("Failed to update playback state")
                
        except Exception as e:
            print(f"❌ Error updating playback state: {e}")
            traceback.print_exc()
            raise e
    
    @staticmethod
    def remove_participant(room_id, user_id):
        """Remove a participant from a room"""
        try:
            print(f"👥 Removing participant {user_id} from room {room_id}")
            collection = Room.get_collection()
            room_doc = collection.find_one({'room_id': room_id})
            
            if not room_doc:
                error_msg = f"Room {room_id} not found"
                print(f"❌ {error_msg}")
                raise ValueError(error_msg)
                
            print(f"   Room found: {room_doc.get('name', 'N/A')}")
            print(f"   Current participants: {len(room_doc.get('participants', []))}")
                
            # Remove participant
            result = collection.update_one(
                {'room_id': room_id},
                {'$pull': {'participants': {'user_id': user_id}}}
            )
            
            print(f"   Remove result: matched={result.matched_count}, modified={result.modified_count}")
            
            # If room is empty, deactivate it
            updated_room_doc = collection.find_one({'room_id': room_id})
            participants_count = len(updated_room_doc.get('participants', []))
            print(f"   Participants remaining: {participants_count}")
            
            if participants_count == 0:
                print("   Room is empty, deactivating...")
                Room.deactivate_room(room_id)
                
            print(f"✅ Participant removed successfully")
            return Room.find_by_id(room_id)
                
        except Exception as e:
            print(f"❌ Error removing participant: {e}")
            traceback.print_exc()
            raise e
    
    @staticmethod
    def deactivate_room(room_id):
        """Deactivate a room"""
        try:
            print(f"🔒 Deactivating room {room_id}")
            collection = Room.get_collection()
            room_doc = collection.find_one({'room_id': room_id})
            
            if not room_doc:
                error_msg = f"Room {room_id} not found"
                print(f"❌ {error_msg}")
                raise ValueError(error_msg)
                
            result = collection.update_one(
                {'room_id': room_id},
                {'$set': {
                    'is_active': False,
                    'updated_at': datetime.utcnow()
                }}
            )
            
            print(f"   Deactivation result: matched={result.matched_count}, modified={result.modified_count}")
            
            if result.modified_count > 0:
                print(f"✅ Room deactivated successfully")
            
            return Room.find_by_id(room_id)
            
        except Exception as e:
            print(f"❌ Error deactivating room: {e}")
            traceback.print_exc()
            raise e
