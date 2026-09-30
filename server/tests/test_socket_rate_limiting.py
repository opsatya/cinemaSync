from app.models import Room
from app.socket_manager import socketio


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


def test_join_room_password_guessing_is_rate_limited(app, make_jwt):
    """The frontend joins exclusively via the join_room socket event, so this
    (not the unused REST /join endpoint) is the real password brute-force
    target and must be throttled."""
    room = _create_room(host_id='host-1', password='correct-horse')
    client = socketio.test_client(app, auth={'token': make_jwt(user_id='attacker-1')})

    messages = []
    for _ in range(30):
        ack = client.emit('join_room', {'room_id': room['room_id'], 'password': 'wrong-guess'}, callback=True)
        messages.append(ack.get('error') if ack else None)

    assert any('too many' in (m or '').lower() for m in messages)

    client.disconnect()
