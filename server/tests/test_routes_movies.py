import io

from app.routes import drive_service as drive_service_singleton
from app.models import MovieMetadata


def test_movies_list_returns_drive_service_results(client, monkeypatch):
    monkeypatch.setattr(drive_service_singleton, 'list_movies', lambda folder_id=None, recursive=False, max_depth=2: [
        {'id': 'F1', 'name': 'sub', 'type': 'folder'},
        {'id': 'V1', 'name': 'movie.mp4', 'type': 'video'},
    ])

    resp = client.get('/api/movies/list')

    assert resp.status_code == 200
    body = resp.get_json()
    assert body['success'] is True
    assert body['count'] == 2
    assert {item['name'] for item in body['data']} == {'sub', 'movie.mp4'}


def test_movies_metadata_uses_mongo_cache_when_present(client, mongo_db):
    MovieMetadata.save_metadata({'file_id': 'V1', 'name': 'Cached Movie', 'mimeType': 'video/mp4'})

    resp = client.get('/api/movies/metadata/V1')

    assert resp.status_code == 200
    assert resp.get_json()['metadata']['name'] == 'Cached Movie'


def test_movies_metadata_falls_back_to_drive_when_not_cached(client, mongo_db, monkeypatch):
    monkeypatch.setattr(
        drive_service_singleton,
        'get_file_metadata',
        lambda file_id: {'id': file_id, 'name': 'Fresh From Drive', 'mimeType': 'video/mp4'},
    )

    resp = client.get('/api/movies/metadata/V2')

    assert resp.status_code == 200
    assert resp.get_json()['metadata']['name'] == 'Fresh From Drive'
    # Should also have been cached for next time
    assert MovieMetadata.find_by_file_id('V2')['name'] == 'Fresh From Drive'


def test_movies_search_requires_query(client):
    resp = client.get('/api/movies/search')
    assert resp.status_code == 400


def test_movies_search_falls_back_to_drive_when_mongo_has_no_matches(client, mongo_db, monkeypatch):
    monkeypatch.setattr(
        drive_service_singleton,
        'list_movies',
        lambda folder_id=None, recursive=False, max_depth=2: [
            {'id': 'V1', 'name': 'Inception', 'type': 'video'},
            {'id': 'V2', 'name': 'Interstellar', 'type': 'video'},
        ],
    )

    resp = client.get('/api/movies/search?q=incep')

    assert resp.status_code == 200
    body = resp.get_json()
    assert body['count'] == 1
    assert body['results'][0]['name'] == 'Inception'


def test_movies_recent_falls_back_to_drive_when_mongo_empty(client, mongo_db, monkeypatch):
    monkeypatch.setattr(
        drive_service_singleton,
        'list_movies',
        lambda folder_id=None, recursive=False, max_depth=2: [
            {'id': 'V1', 'name': 'Recent Movie', 'type': 'video'},
        ],
    )

    resp = client.get('/api/movies/recent')

    assert resp.status_code == 200
    body = resp.get_json()
    assert body['count'] == 1
    assert body['movies'][0]['name'] == 'Recent Movie'


def test_drive_upload_sanitizes_malicious_filename_end_to_end(client, mongo_db, auth_headers, monkeypatch):
    monkeypatch.setattr(
        drive_service_singleton,
        'upload_user_file',
        lambda user_id, file_path, mime_type=None, folder_id=None, name=None: {
            'id': 'UPLOADED1',
            'name': name,
            'mimeType': mime_type,
            'size': '10',
            'createdTime': None,
            'modifiedTime': None,
            'thumbnailLink': None,
        },
    )

    data = {
        'file': (io.BytesIO(b'fake video bytes'), '../../../../etc/cron.d/evil.mp4'),
    }
    resp = client.post(
        '/api/drive/upload',
        data=data,
        content_type='multipart/form-data',
        headers=auth_headers(user_id='user-1'),
    )

    assert resp.status_code == 201
    assert resp.get_json()['success'] is True
