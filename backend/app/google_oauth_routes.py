from flask import Blueprint, request, jsonify, redirect, g
import os
import jwt
from urllib.parse import urlencode
from google_auth_oauthlib.flow import Flow
from app.models import UserToken
from app.auth_middleware import token_required
from datetime import datetime

google_bp = Blueprint('google_oauth', __name__, url_prefix='/api/google')

JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key')

GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
GOOGLE_PROJECT_ID = os.getenv('GOOGLE_PROJECT_ID') # e.g., 'cinemasync'
GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI')

# Use standard OpenID Connect scopes for email and profile, plus the Drive scope.
# This is a more modern and less ambiguous way to request user information.
SCOPES = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email', 
    'https://www.googleapis.com/auth/drive.file',
    'openid'
]

def _build_flow():
    required_vars = {
        'GOOGLE_CLIENT_ID': GOOGLE_CLIENT_ID,
        'GOOGLE_CLIENT_SECRET': GOOGLE_CLIENT_SECRET,
        'GOOGLE_PROJECT_ID': GOOGLE_PROJECT_ID,
        'GOOGLE_REDIRECT_URI': GOOGLE_REDIRECT_URI
    }
    missing_vars = [key for key, value in required_vars.items() if not value]
    if missing_vars:
        raise RuntimeError(f"Missing Google OAuth env vars: {', '.join(missing_vars)}")

    flow = Flow.from_client_config(
        {
            'web': {
                'client_id': GOOGLE_CLIENT_ID,
                'project_id': GOOGLE_PROJECT_ID,
                'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
                'token_uri': 'https://oauth2.googleapis.com/token',
                'client_secret': GOOGLE_CLIENT_SECRET,
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

@google_bp.route('/tokens/status', methods=['GET'])
@token_required
def tokens_status():
    """Returns whether the current user has stored Google tokens."""
    try:
        user_id = getattr(g, 'current_user_id', None)
        if not user_id:
            return jsonify({'success': False, 'message': 'Missing user id'}), 401
        tokens = UserToken.get_tokens(user_id, 'google') or {}
        has_tokens = bool(tokens.get('access_token') or tokens.get('refresh_token'))
        return jsonify({'success': True, 'connected': has_tokens})
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

@google_bp.route('/health', methods=['GET'])
def health():
    """Lightweight health endpoint for Google OAuth configuration.
    Does NOT expose secrets. Intended for frontend to decide whether to show
    'Connect Google Drive' or Drive UI elements.
    """
    try:
        # Check for OAuth client config (for user connections)
        oauth_vars = {
            'GOOGLE_CLIENT_ID': bool(GOOGLE_CLIENT_ID),
            'GOOGLE_CLIENT_SECRET': bool(GOOGLE_CLIENT_SECRET),
            'GOOGLE_PROJECT_ID': bool(GOOGLE_PROJECT_ID),
            'GOOGLE_REDIRECT_URI': bool(GOOGLE_REDIRECT_URI),
        }

        # Check for Service Account config (for browsing shared content)
        service_account_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        service_account_vars = {
            'GOOGLE_APPLICATION_CREDENTIALS': bool(service_account_path and os.path.exists(service_account_path))
        }

        required_vars = {**oauth_vars, **service_account_vars}

        env_ok = all(required_vars.values())
        return jsonify({
            'success': True,
            'env_ok': env_ok,
            'missing': [k for k, v in required_vars.items() if not v],
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
