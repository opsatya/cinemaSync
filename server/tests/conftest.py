import os
from datetime import datetime, timedelta

os.environ.setdefault('JWT_SECRET', 'test-secret-for-pytest')
os.environ.setdefault('FLASK_ENV', 'testing')

import jwt as pyjwt
import mongomock
import pytest

import app as app_package
import app.models as models_module


@pytest.fixture
def mongo_db(monkeypatch):
    """Patch app.models to use an in-memory mongomock database instead of real MongoDB."""
    mongo_client = mongomock.MongoClient()
    db = mongo_client['cinemasync_test']

    def fake_init_db():
        models_module.client = mongo_client
        models_module.db = db
        return True

    # create_app() in app/__init__.py did `from app.models import init_db`,
    # so it calls its own module-level name, not app.models.init_db directly.
    # Both bindings must be patched or create_app() still hits real MongoDB.
    monkeypatch.setattr(models_module, 'init_db', fake_init_db)
    monkeypatch.setattr(app_package, 'init_db', fake_init_db)
    fake_init_db()
    return db


@pytest.fixture
def app(mongo_db):
    from app import create_app
    flask_app = create_app()
    flask_app.config.update(TESTING=True)
    yield flask_app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def make_jwt():
    def _make(user_id='user-1', name='Test User', email='test@example.com', expires_minutes=60):
        payload = {
            'user_id': user_id,
            'name': name,
            'email': email,
            'exp': datetime.utcnow() + timedelta(minutes=expires_minutes),
        }
        return pyjwt.encode(payload, os.environ['JWT_SECRET'], algorithm='HS256')

    return _make


@pytest.fixture
def auth_headers(make_jwt):
    def _headers(**kwargs):
        return {'Authorization': f'Bearer {make_jwt(**kwargs)}'}

    return _headers
