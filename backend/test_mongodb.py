from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get MongoDB connection details from environment variables
mongo_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
db_name = os.getenv('MONGODB_DB_NAME', 'cinemasync')

print(f"Attempting to connect to MongoDB at {mongo_uri}")
print(f"Database name: {db_name}")

try:
    # Connect to MongoDB
    client = MongoClient(mongo_uri)
    
    # Ping the server to verify connection
    client.admin.command('ping')
    
    print("✅ Successfully connected to MongoDB!")
    
    # Get database
    db = client[db_name]
    
    # List collections
    print("\nCollections in database:")
    collections = db.list_collection_names()
    if collections:
        for collection in collections:
            print(f" - {collection}")
    else:
        print(" - No collections found. This is normal for a new database.")
    
    # Create a test document
    print("\nCreating a test document in 'test_connection' collection...")
    result = db.test_connection.insert_one({"test": "MongoDB connection successful", "timestamp": "2025-05-14"})
    print(f"✅ Test document created with ID: {result.inserted_id}")
    
    # Retrieve the test document
    test_doc = db.test_connection.find_one({"test": "MongoDB connection successful"})
    print(f"✅ Retrieved test document: {test_doc}")
    
    # Clean up - remove test document and collection
    db.test_connection.delete_one({"test": "MongoDB connection successful"})
    print("✅ Test document removed")
    
    print("\n✅ MongoDB connection test completed successfully!")
    print(f"Your application is correctly configured to use MongoDB at {mongo_uri}")
    print(f"Database '{db_name}' is ready for use.")
    
except Exception as e:
    print(f"\n❌ Failed to connect to MongoDB: {e}")
    print("Please check:")
    print(" 1. MongoDB is running (mongod service)")
    print(" 2. Connection URI in .env file is correct")
    print(" 3. Network allows connections to MongoDB port (default: 27017)")
    print(" 4. No authentication issues (if using username/password)")

finally:
    # Close the connection
    if 'client' in locals():
        client.close()
