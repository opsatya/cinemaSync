import os

from app.routes import _safe_upload_path

TEMP_DIR = '/tmp/cinemasync_uploads'

MALICIOUS_FILENAMES = [
    '../../../../etc/cron.d/evil',
    '/etc/cron.d/evil',
    '../../../home/user/.ssh/authorized_keys',
    '..\\..\\..\\windows\\system32\\evil.exe',
    '....//....//etc/passwd',
]


def test_safe_upload_path_confines_malicious_filenames_to_temp_dir():
    for filename in MALICIOUS_FILENAMES:
        result = _safe_upload_path(TEMP_DIR, filename)
        assert os.path.commonpath([result, TEMP_DIR]) == TEMP_DIR, (
            f'filename {filename!r} escaped temp dir: {result!r}'
        )


def test_safe_upload_path_preserves_a_normal_filename():
    result = _safe_upload_path(TEMP_DIR, 'my movie.mp4')
    assert os.path.dirname(result) == TEMP_DIR
    assert result.endswith('.mp4')


def test_safe_upload_path_never_collides_between_calls():
    a = _safe_upload_path(TEMP_DIR, 'movie.mp4')
    b = _safe_upload_path(TEMP_DIR, 'movie.mp4')
    assert a != b
