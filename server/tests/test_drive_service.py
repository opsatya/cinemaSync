import time

from app.drive_service import DriveService


class FakeExec:
    def __init__(self, files):
        self._files = files

    def execute(self):
        return {'files': self._files}


class FakeFilesResource:
    def __init__(self, tree):
        self.tree = tree

    def list(self, q, fields, pageSize):
        folder_id = q.split("'")[1]
        return FakeExec(self.tree.get(folder_id, []))


class FakeDriveApi:
    def __init__(self, tree):
        self._files = FakeFilesResource(tree)

    def files(self):
        return self._files


def _make_drive_service(monkeypatch, tree):
    ds = DriveService()
    monkeypatch.setattr(ds, '_service', FakeDriveApi(tree))
    monkeypatch.setattr(ds, '_token_expiry', time.time() + 3600)
    return ds


# root -> sub1 -> sub2 -> deep.mp4 : a video only visible at max_depth >= 3
TREE = {
    'root': [{'id': 'F1', 'name': 'sub1', 'mimeType': 'application/vnd.google-apps.folder'}],
    'F1': [{'id': 'F2', 'name': 'sub2', 'mimeType': 'application/vnd.google-apps.folder'}],
    'F2': [{'id': 'V1', 'name': 'deep.mp4', 'mimeType': 'video/mp4', 'size': '10'}],
}


def test_list_movies_cache_key_includes_max_depth(monkeypatch, mongo_db):
    ds = _make_drive_service(monkeypatch, TREE)

    shallow = ds.list_movies(None, recursive=True, max_depth=1)
    deep = ds.list_movies(None, recursive=True, max_depth=3)

    shallow_names = {item['name'] for item in shallow}
    deep_names = {item['name'] for item in deep}

    assert 'deep.mp4' not in shallow_names
    assert 'deep.mp4' in deep_names


def test_list_movies_does_not_double_fetch_each_subfolder(monkeypatch, mongo_db):
    """Each folder (root, F1, F2) should be queried from Drive exactly once,
    not once non-recursively (for item_count) and again recursively."""
    ds = _make_drive_service(monkeypatch, TREE)
    fake_files = ds._service.files()
    call_count = {'n': 0}
    original_list = fake_files.list

    def counting_list(*args, **kwargs):
        call_count['n'] += 1
        return original_list(*args, **kwargs)

    fake_files.list = counting_list

    results = ds.list_movies(None, recursive=True, max_depth=3)

    assert call_count['n'] == 3  # one .list() call per folder in the tree: root, F1, F2

    sub1 = next(item for item in results if item['name'] == 'sub1')
    assert sub1['item_count'] == 1  # only its direct child (sub2), not the nested video
    assert sub1['has_videos'] is False
