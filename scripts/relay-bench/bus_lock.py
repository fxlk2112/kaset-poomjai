"""Serialize gateway connections across the read-only observer and sole writer."""
from contextlib import contextmanager
from pathlib import Path

@contextmanager
def serialized_bus():
    import fcntl
    with Path('/var/lib/sucha-relay-bus/access.lock').open('r+') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock,fcntl.LOCK_UN)
