from flask import Flask, jsonify, redirect
from flask.json.provider import JSONProvider
from flask_cors import CORS
from dotenv import load_dotenv
import os
from app.models import init_db
from .firebase_admin import init_firebase
from bson import ObjectId
from datetime import datetime

class MongoJSONProvider(JSONProvider):
    """A JSON provider that can handle MongoDB's ObjectId and datetime."""
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime):
            return o.isoformat()
        return super().default(o)

load_dotenv()

def create_app():
    app = Flask(__name__)
    
    # Configure CORS properly with explicit options
    CORS(app, resources={r"/*": {"origins": "*", "supports_credentials": True}})
    
    # Allow both with/without trailing slashes
    app.url_map.strict_slashes = False
    
    # Initialize database connection
    init_db()
    init_firebase()
    
    # Use a custom JSON provider to handle MongoDB ObjectId and datetime
    app.json = MongoJSONProvider(app)
    
    # Do not force Content-Type globally; Flask sets appropriate mimetypes
    
    # Root route for the main application
    @app.route('/')
    def index():
        return jsonify({
            'success': True,
            'message': 'CinemaSync Backend is running',
            'api_endpoint': '/api'
        })
    
    # Redirect /movies/list to /api/movies/list
    @app.route('/movies/list')
    def redirect_movies_list():
        return redirect('/api/movies/list')
    
    # Import and register blueprints
    from app.routes import api_bp
    from app.auth_middleware import token_required
    from app.room_routes import room_bp
    from app.auth_routes import auth_bp
    from app.google_oauth_routes import google_bp
    app.register_blueprint(api_bp)
    app.register_blueprint(room_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(google_bp)
    
    # Initialize SocketIO
    from app.socket_manager import init_socketio
    socketio = init_socketio(app)
    
    return app
