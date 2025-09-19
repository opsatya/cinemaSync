from flask import Blueprint, request, jsonify
import os
import jwt
from datetime import datetime, timedelta
from .firebase_admin import verify_firebase_token

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key')
JWT_EXPIRES_MIN = int(os.getenv('JWT_EXPIRES_MIN', '4320'))  # default 3 days

@auth_bp.route('/exchange', methods=['POST'])
def exchange_token():
    """
    Issue a backend JWT for a verified Firebase user.
    The Firebase ID token must be passed in the Authorization header.
    """
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'success': False, 'message': 'Firebase ID token is missing or invalid'}), 401
        
        id_token = auth_header.split(' ')[1]
        decoded_token = verify_firebase_token(id_token)

        if not decoded_token:
            return jsonify({'success': False, 'message': 'Invalid Firebase ID token'}), 401

        user_id = decoded_token.get('uid')
        if not user_id:
            return jsonify({'success': False, 'message': 'Token is invalid (missing uid)'}), 401

        # Store/update user data for persistence
        from .models import User
        user_data = {
            'user_id': user_id,
            'name': decoded_token.get('name'),
            'email': decoded_token.get('email')
        }
        User.upsert_user(user_data)

        now = datetime.utcnow()
        payload = {
            'user_id': user_id,
            'name': decoded_token.get('name'),
            'email': decoded_token.get('email'),
            'iat': now,
            'exp': now + timedelta(minutes=JWT_EXPIRES_MIN)
        }

        token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')

        return jsonify({
            'success': True,
            'token': token,
            'user': user_data
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500
