from app.models import Room


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


def test_room_join_is_rate_limited(client, auth_headers):
    """A password-protected room's join endpoint must not accept unlimited
    guesses from the same client — otherwise its password is brute-forceable."""
    room = _create_room(host_id='host-1', password='correct-horse')
    headers = auth_headers(user_id='attacker-1')

    statuses = []
    for _ in range(25):
        resp = client.post(
            f"/api/rooms/{room['room_id']}/join",
            json={'password': 'wrong-guess'},
            headers=headers,
        )
        statuses.append(resp.status_code)

    assert 429 in statuses
