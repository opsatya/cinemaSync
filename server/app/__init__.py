from flask import Flask, jsonify, redirect
from flask.json.provider import JSONProvider
from flask_cors import CORS
from dotenv import load_dotenv
import os
from app.models import init_db
from .firebase_admin import init_firebase
from bson import ObjectId
from datetime import datetime
from app.config import get_config

class MongoJSONProvider(JSONProvider):
    """A JSON provider that can handle MongoDB's ObjectId and datetime."""
    def dumps(self, obj, **kwargs):
        """Serialize data as JSON."""
        import json
        return json.dumps(obj, default=self._json_serializer, **kwargs)

    def loads(self, s, **kwargs):
        """Deserialize data from JSON (required for request.get_json)."""
        import json
        return json.loads(s, **kwargs)
    
    def _json_serializer(self, o):
        """Custom JSON serializer for MongoDB types."""
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime):
            return o.isoformat()
        raise TypeError(f"Object of type {type(o)} is not JSON serializable")

load_dotenv()

def create_app():
    app = Flask(__name__)
    # Load environment-specific configuration (sets SECRET_KEY, etc.)
    try:
        app.config.from_object(get_config())
    except Exception:
        # Fallback to a minimal secret for sessions if config missing (dev only)
        app.config['SECRET_KEY'] = app.config.get('SECRET_KEY') or os.getenv('SECRET_KEY', 'dev-key-for-development-only')
    
    # Configure CORS with explicit origins and headers for credentials
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    # Optionally include a frontend URL from environment (e.g., production)
    frontend_url = os.getenv("FRONTEND_URL")
    if frontend_url:
        allowed_origins.append(frontend_url.rstrip("/"))

    CORS(
        app,
        resources={r"/*": {"origins": allowed_origins}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Content-Type", "Authorization"],
    )

    # Security checks: warn if default JWT secret is used in production
    if os.getenv("FLASK_ENV") == "production" and os.getenv("JWT_SECRET", "your-secret-key") == "your-secret-key":
        print("WARNING: JWT_SECRET is using the default value in production. Set a strong JWT_SECRET in environment variables.")

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

    # Health check endpoint for frontend connectivity tests
    @app.route('/health')
    def health():
        """Simple health check returning 200 OK"""
        return jsonify({'success': True, 'message': 'OK'}), 200
    
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
