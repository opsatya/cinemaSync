from app.room_routes import _verify_drive_access


class _FakeFilesOk:
    def get(self, fileId, fields=None):
        class _Exec:
            def execute(self_inner):
                return {'id': fileId}
        return _Exec()


class _FakeFilesFail:
    def get(self, fileId, fields=None):
        class _Exec:
            def execute(self_inner):
                raise Exception('not found')
        return _Exec()


class _FakeUserService:
    def __init__(self, files_impl):
        self._files_impl = files_impl

    def files(self):
        return self._files_impl


def test_verify_drive_access_true_when_file_reachable(monkeypatch):
    from app.routes import drive_service

    monkeypatch.setattr(drive_service, 'user_service', lambda user_id: _FakeUserService(_FakeFilesOk()))

    assert _verify_drive_access('user-1', 'FILE1') is True


def test_verify_drive_access_false_when_file_unreachable(monkeypatch):
    from app.routes import drive_service

    monkeypatch.setattr(drive_service, 'user_service', lambda user_id: _FakeUserService(_FakeFilesFail()))

    assert _verify_drive_access('user-1', 'FILE1') is False
