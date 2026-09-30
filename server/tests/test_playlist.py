from app.models import Room


def _create_room(host_id='host-1', **overrides):
    data = {
        'host_id': host_id,
        'name': 'Test Room',
        'movie_source': {'type': 'direct_link', 'value': 'http://example.com/x.mp4'},
    }
    data.update(overrides)
    return Room.create_room(data)


def test_new_room_has_empty_playlist(mongo_db):
    room = _create_room()
    assert room['playlist'] == []


def test_host_can_add_playlist_item(client, auth_headers):
    room = _create_room(host_id='host-1')

    resp = client.post(
        f"/api/rooms/{room['room_id']}/playlist",
        json={'type': 'google_drive', 'video_id': 'DRIVEFILE1', 'video_name': 'Movie One'},
        headers=auth_headers(user_id='host-1'),
    )

    assert resp.status_code == 201
    body = resp.get_json()
    assert len(body['playlist']) == 1
    assert body['playlist'][0]['video_id'] == 'DRIVEFILE1'
    assert body['playlist'][0]['added_by'] == 'host-1'


def test_non_host_cannot_add_playlist_item(client, auth_headers):
    room = _create_room(host_id='host-1')

    resp = client.post(
        f"/api/rooms/{room['room_id']}/playlist",
        json={'type': 'direct_link', 'value': 'http://example.com/y.mp4'},
        headers=auth_headers(user_id='not-the-host'),
    )

    assert resp.status_code == 403


def test_host_can_remove_playlist_item(client, auth_headers):
    room = _create_room(host_id='host-1')
    add_resp = client.post(
        f"/api/rooms/{room['room_id']}/playlist",
        json={'type': 'direct_link', 'value': 'http://example.com/y.mp4'},
        headers=auth_headers(user_id='host-1'),
    )
    item_id = add_resp.get_json()['playlist'][0]['item_id']

    resp = client.delete(
        f"/api/rooms/{room['room_id']}/playlist/{item_id}",
        headers=auth_headers(user_id='host-1'),
    )

    assert resp.status_code == 200
    assert resp.get_json()['playlist'] == []


def test_host_can_play_a_queued_item(client, auth_headers, monkeypatch):
    monkeypatch.setattr('app.room_routes._verify_drive_access', lambda user_id, video_id: True)
    room = _create_room(host_id='host-1')
    add_resp = client.post(
        f"/api/rooms/{room['room_id']}/playlist",
        json={'type': 'google_drive', 'video_id': 'DRIVEFILE1', 'video_name': 'Movie One'},
        headers=auth_headers(user_id='host-1'),
    )
    item_id = add_resp.get_json()['playlist'][0]['item_id']

    resp = client.post(
        f"/api/rooms/{room['room_id']}/playlist/{item_id}/play",
        headers=auth_headers(user_id='host-1'),
    )

    assert resp.status_code == 200
    updated_room = resp.get_json()['room']
    assert updated_room['movie_source'] == {
        'type': 'google_drive',
        'video_id': 'DRIVEFILE1',
        'video_name': 'Movie One',
    }
    # Playing an item leaves it in the queue (host removes manually if desired)
    assert len(updated_room['playlist']) == 1


def test_playing_an_inaccessible_drive_item_is_rejected(client, auth_headers, monkeypatch):
    """If the Drive file was deleted/unshared since being queued, playing it
    must not silently broadcast video_changed to a room full of viewers who
    then all fail to stream — it should fail clearly instead."""
    monkeypatch.setattr('app.room_routes._verify_drive_access', lambda user_id, video_id: False)
    room = _create_room(host_id='host-1')
    add_resp = client.post(
        f"/api/rooms/{room['room_id']}/playlist",
        json={'type': 'google_drive', 'video_id': 'DRIVEFILE1', 'video_name': 'Movie One'},
        headers=auth_headers(user_id='host-1'),
    )
    item_id = add_resp.get_json()['playlist'][0]['item_id']
    original_movie_source = Room.find_by_id(room['room_id'])['movie_source']

    resp = client.post(
        f"/api/rooms/{room['room_id']}/playlist/{item_id}/play",
        headers=auth_headers(user_id='host-1'),
    )

    assert resp.status_code == 409
    assert Room.find_by_id(room['room_id'])['movie_source'] == original_movie_source
