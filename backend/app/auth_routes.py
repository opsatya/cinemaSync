from flask import Blueprint, request, jsonify
import os
import jwt
from datetime import datetime, timedelta

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key')
JWT_EXPIRES_MIN = int(os.getenv('JWT_EXPIRES_MIN', '4320'))  # default 3 days

@auth_bp.route('/exchange', methods=['POST'])
def exchange_token():
    """
    Issue a backend JWT for the provided user identity. In production, verify
    a real identity token (e.g., Firebase ID token) before issuing.
    Expected JSON: { "user_id": "<uid>", "name": "optional", "email": "optional" }
    """
    try:
        data = request.get_json() or {}
        user_id = data.get('user_id')

        if not user_id:
            return jsonify({
                'success': False,
                'message': 'user_id is required'
            }), 400

        now = datetime.utcnow()
        payload = {
            'user_id': user_id,
            'name': data.get('name'),
            'email': data.get('email'),
            'iat': now,
            'exp': now + timedelta(minutes=JWT_EXPIRES_MIN)
        }

        token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')

        return jsonify({
            'success': True,
            'token': token
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


