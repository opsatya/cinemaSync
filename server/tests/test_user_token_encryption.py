import os

from app.models import UserToken


def test_save_tokens_refuses_plaintext_in_production(mongo_db, monkeypatch):
    """Without TOKENS_ENC_KEY configured, storing OAuth tokens in production
    must not silently fall back to plaintext — that's a real secrets leak
    risk for the default deployment."""
    monkeypatch.delenv('TOKENS_ENC_KEY', raising=False)
    monkeypatch.setenv('FLASK_ENV', 'production')

    saved = UserToken.save_tokens('user-1', 'google', {
        'access_token': 'super-secret-access-token',
        'refresh_token': 'super-secret-refresh-token',
        'token_type': 'Bearer',
        'scope': 'drive.readonly',
        'expiry': None,
    })

    assert saved is False
    stored = mongo_db['user_tokens'].find_one({'user_id': 'user-1', 'provider': 'google'})
    assert stored is None
