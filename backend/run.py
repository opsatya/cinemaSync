from app import create_app
from app.socket_manager import socketio

# Prefer eventlet (or gevent) to support WebSocket transport in dev and prod.
# When eventlet is installed, Flask-SocketIO will automatically use it if available.
try:
    import eventlet  # noqa: F401
    # eventlet.monkey_patch()  # Uncomment if you hit blocking issues with stdlib sockets
    USING_EVENTLET = True
except Exception:
    USING_EVENTLET = False

app = create_app()

if __name__ == '__main__':
    # Do NOT pass allow_unsafe_werkzeug; that forces Werkzeug dev server which does not support WebSocket.
    # With eventlet installed, this will run an eventlet WSGI server that supports WebSocket.
    socketio.run(
        app,
        host='127.0.0.1',
        port=5000,
        debug=True
    )
