from flask import Blueprint, request, jsonify, redirect
import os
import jwt
from urllib.parse import urlencode
from google_auth_oauthlib.flow import Flow
from app.models import UserToken
from datetime import datetime

google_bp = Blueprint('google_oauth', __name__, url_prefix='/api/google')

JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key')

GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI')

SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid'
]

def _build_flow():
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET or not GOOGLE_REDIRECT_URI:
        raise RuntimeError('Google OAuth env not set: GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI')
    flow = Flow.from_client_config(
        {
            'web': {
                'client_id': GOOGLE_CLIENT_ID,
                'project_id': 'cinemasync',
                'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
                'token_uri': 'https://oauth2.googleapis.com/token',
                'auth_provider_x509_cert_url': 'https://www.googleapis.com/oauth2/v1/certs',
                'client_secret': GOOGLE_CLIENT_SECRET,
                'redirect_uris': [GOOGLE_REDIRECT_URI]
            }
        },
        scopes=SCOPES
    )
    flow.redirect_uri = GOOGLE_REDIRECT_URI
    return flow

def _extract_user_id_from_state(state_value: str):
    if not state_value:
        return None
    try:
        # State can be a JWT or a URL-encoded query. Try JWT first.
        data = jwt.decode(state_value, JWT_SECRET, algorithms=['HS256'])
        return data.get('user_id')
    except Exception:
        # Fallback: parse as query string like key=value&user_id=...
        try:
            parts = dict(pair.split('=') for pair in state_value.split('&') if '=' in pair)
            return parts.get('user_id')
        except Exception:
            return None

@google_bp.route('/auth/url', methods=['GET'])
def get_auth_url():
    try:
        flow = _build_flow()

        # Optional: pass caller token or user_id into state
        state = request.args.get('state')
        if not state:
            # Try Authorization: Bearer <jwt>
            auth_header = request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                state = auth_header.split(' ')[1]

        authorization_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',
            state=state
        )

        return jsonify({'success': True, 'auth_url': authorization_url})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@google_bp.route('/auth/callback', methods=['GET'])
def auth_callback():
    try:
        code = request.args.get('code')
        state_value = request.args.get('state')
        if not code:
            return jsonify({'success': False, 'message': 'Missing code'}), 400

        flow = _build_flow()
        flow.fetch_token(code=code)
        creds = flow.credentials

        # Determine user
        user_id = _extract_user_id_from_state(state_value)
        if not user_id:
            # As a last resort, allow ?user_id= in callback
            user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'message': 'Unable to associate user for tokens'}), 400

        token_data = {
            'access_token': creds.token,
            'refresh_token': getattr(creds, 'refresh_token', None),
            'token_type': creds.token_uri and 'Bearer',
            'scope': ' '.join(SCOPES),
            'expiry': creds.expiry.isoformat() if getattr(creds, 'expiry', None) else None
        }

        UserToken.save_tokens(user_id, 'google', token_data)

        # You can redirect back to the frontend with a success flag
        frontend_redirect = os.getenv('OAUTH_SUCCESS_REDIRECT')
        if frontend_redirect:
            query = urlencode({'status': 'success'})
            return redirect(f"{frontend_redirect}?{query}")

        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


