import time

from app.routes import drive_service as drive_service_singleton


class FakeMediaRequest:
    def __init__(self, content):
        self.content = content
        self.headers = {}

    def execute(self):
        range_header = self.headers.get('Range')
        if not range_header:
            return self.content
        spec = range_header.split('=', 1)[1]
        start_str, _, end_str = spec.partition('-')
        start = int(start_str)
        end = int(end_str) if end_str else len(self.content) - 1
        return self.content[start:end + 1]


class FakeFilesResource:
    def __init__(self, content):
        self._content = content

    def get_media(self, fileId):
        return FakeMediaRequest(self._content)


class FakeDriveService:
    def __init__(self, content):
        self._files = FakeFilesResource(content)

    def files(self):
        return self._files


def _install_fake_drive(monkeypatch, content):
    fake_service = FakeDriveService(content)
    monkeypatch.setattr(drive_service_singleton, '_service', fake_service)
    monkeypatch.setattr(drive_service_singleton, '_token_expiry', time.time() + 3600)
    monkeypatch.setattr(
        drive_service_singleton,
        'get_file_metadata',
        lambda file_id: {
            'id': file_id,
            'name': 'video.mp4',
            'mimeType': 'video/mp4',
            'size': str(len(content)),
        },
    )


def test_stream_honors_range_header(client, monkeypatch):
    content = (b'0123456789' * 100)  # 1000 bytes
    _install_fake_drive(monkeypatch, content)

    resp = client.get('/api/stream/FILE1', headers={'Range': 'bytes=100-199'})

    assert resp.status_code == 206
    assert resp.headers.get('Content-Range') == f'bytes 100-199/{len(content)}'
    assert resp.headers.get('Content-Length') == '100'
    assert resp.data == content[100:200]


def test_stream_honors_open_ended_range_header(client, monkeypatch):
    content = b'0123456789' * 100  # 1000 bytes
    _install_fake_drive(monkeypatch, content)

    resp = client.get('/api/stream/FILE1', headers={'Range': 'bytes=900-'})

    assert resp.status_code == 206
    assert resp.headers.get('Content-Range') == f'bytes 900-999/{len(content)}'
    assert resp.data == content[900:1000]
