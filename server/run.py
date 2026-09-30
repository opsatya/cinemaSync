# eventlet.monkey_patch() MUST run before anything else is imported —
# including Flask, pymongo, etc. Patching after those modules have already
# bound their own references to stdlib socket/threading/ssl leaves them
# half-patched, which throws "exception was thrown while monkey_patching"
# at runtime instead of actually enabling cooperative I/O.
try:
    import eventlet
    eventlet.monkey_patch()
    USING_EVENTLET = True
except Exception:
    USING_EVENTLET = False

from app import create_app
from app.socket_manager import socketio

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
