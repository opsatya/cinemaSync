def test_health_check(client):
    resp = client.get('/health')
    assert resp.status_code == 200
    assert resp.get_json()['success'] is True


def test_create_room_requires_auth(client):
    resp = client.post('/api/rooms/', json={'name': 'Room', 'movie_source': {'type': 'direct_link', 'value': 'x'}})
    assert resp.status_code == 401
