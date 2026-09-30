from app.models import Room, UserToken


def _create_room(host_id='host-1', password=None, **overrides):
    data = {
        'host_id': host_id,
        'name': 'Test Room',
        'movie_source': {'type': 'direct_link', 'value': 'http://example.com/x.mp4'},
    }
    if password is not None:
        data['password'] = password
    data.update(overrides)
    return Room.create_room(data)


def test_debug_user_rooms_endpoint_is_gone(client):
    """The unauthenticated debug endpoint used to dump every room (incl. password_hash)
    for anyone who called it. It must no longer exist."""
    room = _create_room(password='secret123')

    resp = client.get(f"/api/rooms/debug/user/{room['host_id']}")

    assert resp.status_code == 404


def test_patch_room_without_password_key_preserves_existing_password(client, auth_headers):
    """Regression lock for the 'editing a room silently strips its password' bug.
    The actual bug was in the frontend always sending password: null; this test
    documents the backend contract the fix now relies on: omitting 'password'
    entirely from the PATCH payload must never touch password_hash."""
    room = _create_room(host_id='host-1', password='secret123')
    original_hash = Room.find_by_id(room['room_id'])['password_hash']

    resp = client.patch(
        f"/api/rooms/{room['room_id']}",
        json={'name': 'Renamed Room'},
        headers=auth_headers(user_id='host-1'),
    )

    assert resp.status_code == 200
    updated = Room.find_by_id(room['room_id'])
    assert updated['name'] == 'Renamed Room'
    assert updated['password_hash'] == original_hash
