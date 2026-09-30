from app.models import Room
from app.socket_manager import socketio


def _create_room(host_id='host-1', **overrides):
    data = {
        'host_id': host_id,
        'name': 'Test Room',
        'movie_source': {'type': 'direct_link', 'value': 'http://example.com/x.mp4'},
    }
    data.update(overrides)
    return Room.create_room(data)


def test_disconnect_removes_participant_from_room(app, make_jwt):
    room = _create_room(host_id='host-1')

    host_client = socketio.test_client(app, auth={'token': make_jwt(user_id='host-1')})
    joiner_client = socketio.test_client(app, auth={'token': make_jwt(user_id='user-2')})

    ack = joiner_client.emit('join_room', {'room_id': room['room_id']}, callback=True)
    assert ack == {'ok': True}

    mid_state = Room.find_by_id(room['room_id'])
    assert len(mid_state['participants']) == 2

    joiner_client.disconnect()

    final_state = Room.find_by_id(room['room_id'])
    remaining_ids = {p['user_id'] for p in final_state['participants']}
    assert remaining_ids == {'host-1'}

    host_client.disconnect()
