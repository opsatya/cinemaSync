import jwt
import os
from functools import wraps
from flask import request, jsonify, g

JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({
                'success': False,
                'message': 'Token is missing'
            }), 401
        
        try:
            # Decode the token
            data = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            g.current_user_id = data['user_id']
            g.current_user_name = data.get('name')
            g.current_user_email = data.get('email')
        except jwt.ExpiredSignatureError:
            return jsonify({
                'success': False,
                'message': 'Token has expired'
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                'success': False,
                'message': 'Token is invalid'
            }), 401
        
        return f(*args, **kwargs)
    return decorated
