from app.google_oauth_routes import _extract_user_id_from_state


def test_extract_user_id_from_state_rejects_unsigned_payload():
    """An attacker-controlled, unsigned state like 'user_id=<victim>' must never
    resolve to that victim's user_id — state must be a validly signed JWT."""
    forged_state = 'user_id=victim-123'

    assert _extract_user_id_from_state(forged_state) is None


def test_auth_url_requires_authentication(client):
    resp = client.get('/api/google/auth/url')
    assert resp.status_code == 401
