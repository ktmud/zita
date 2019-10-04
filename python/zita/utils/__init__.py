import threading

from collections import defaultdict
from functools import lru_cache, _make_key


def threadsafe_lru(*w, **kw):
    def wrap(f):
        func = lru_cache(*w, **kw)(f)
        lock_dict = defaultdict(threading.Lock)

        def _thread_lru(*args, **kwargs):
            key = _make_key(args, kwargs, typed=False)
            with lock_dict[key]:
                ret = func(*args, **kwargs)
            return ret

        return _thread_lru

    return wrap

