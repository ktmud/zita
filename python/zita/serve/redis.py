"""
Redis helpers
"""
import orjson
import logging
import asyncio

from threading import Thread
from redis import Redis
from functools import wraps
from zita.settings import REDIS_URL


logger = logging.getLogger('zita.redis')


def isiterable(arg):
    """Check if a variable is iterable and not a string"""
    return hasattr(arg, '__iter__') and not isinstance(arg, str)


def first_list_arg(args):
    """find the first array-like argument from a list of arguments
    Args:
        args: a list of arguments
    Returns:
        args1: arguments before the first array-like argument
        items: the first array-like argument
        args2: arguments after the array-like argument
    """
    items, items_arg_idx = None, None
    for i, arg in enumerate(args):
        if isiterable(arg):
            items = arg
            items_arg_idx = i
            break
    if items_arg_idx is None:
        raise ValueError('Cannot find any list-like argument')
    args1 = args[:items_arg_idx]
    args2 = args[items_arg_idx+1:]
    return args1, items, args2


def gen_minibatch(items, bs):
    """Split big list into minibatches"""
    total = len(items)
    for start in range(0, total, bs):
        end = min(start + bs, total)
        batch = items[start:end]
        yield batch, start, end


class WorkerThread(Thread):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def run(self, func, *args, **kwargs):
        func(*args, **kwargs)


class RedisStore(object):
    """Cache Storage with redis"""

    def __init__(self, client=None,
                 serialize=orjson.dumps,
                 deserialize=orjson.loads,
                 expire=None,
                 allow_async=True):
        self.client = client or Redis.from_url(REDIS_URL)
        self.serialize = serialize
        self.deserialize = deserialize
        self.default_expire = expire  # seconds
        if allow_async:
            loop = self.loop = asyncio.new_event_loop()

            def exit_on_exception(context):
                error = context.get('exception')
                if error:
                    # raise error from background tasks
                    raise error

            def start_worker():
                asyncio.set_event_loop(loop)
                loop.run_forever()

            loop.default_exception_handler = exit_on_exception
            worker = Thread(target=start_worker, name="RedisWorker")
            logger.debug("Starting async worker for Redis cache store...")
            worker.start()
        else:
            self.worker = None

    def serialize_to_str(self, val):
        ret = self.serialize(val)
        if isinstance(ret, bytes):
            ret = ret.decode('utf-8')
        return ret

    def deserialize_multi(self, values):
        vals, na_idxs = [], []
        for i, x in enumerate(values):
            if x:
                vals.append(self.deserialize(x))
            else:
                vals.append(None)
                na_idxs.append(i)
        return vals, na_idxs

    def genkey(self, key):
        if callable(key):
            return key

        def genkey(args=(), kwargs={}):
            all_args = [*args, *kwargs.items()]
            if not all_args:
                return key
            return key + self.serialize_to_str(all_args)

        return genkey

    def get(self, key, raw=False):
        value = self.client.get(key)
        if raw or not value:
            return value
        return self.deserialize(value)

    def set(self, key, value, raw=False, **redis_kw):
        if not raw and value:
            value = self.serialize(value)
        return self.client.set(key, value, **redis_kw)

    def cache(self, key=None, expire=None, **redis_kw):
        """Cache one single key in hashes

        Parameters
        ----------
            prefix:  key prefix of the Redis keys that will save the cached
                     results of the wrapped function. Defaults to the name
                     of the function.

            **redis_kw: All remaining named args are passed to redis.hset(..)
                        E.g. ex={seconds to expire}, px={millisecs to expire}
        """
        expire = expire or self.default_expire

        def decorator(func):
            genkey = self.genkey(key or func.__name__)

            @wraps(func)
            def wrapper(*args, cache_only=False, **kwargs):
                key = genkey(args, kwargs)
                value = self.get(key)
                if cache_only:
                    return value
                if value is None:
                    value = func(*args, **kwargs)
                if value is not None:
                    self.set(key, value, ex=expire, **redis_kw)
                return value

            wrapper.iter_cached = lambda *args, **kwargs: \
                self.client.scan_iter(genkey(args, kwargs) + '*')
            wrapper.nocache = func

            return wrapper

        return decorator

    def update_cache(self, keys, vals, expire=None):
        # save results to redis
        with self.client.pipeline() as pipe:
            pipe.mset({
                key: self.serialize(val)
                if val is not None else val
                for key, val in zip(keys, vals)
            })
            if expire:
                for key in keys:
                    pipe.expire(key, expire)
            pipe.execute()
        return vals

    def mcache(self, key=None, expire=None, mini_batch_size=100,
               cache_first=True, autocache=True):
        """Cache for batch commands. Fetch cache if exists, pass
        the remaining items to the batch function.

        Parameters
        ----------
            mini_batch_size: when cache_first=True, data will be fetched
                             in mini batches.
            manual_cache: if to set results in cache automatically, if False,
                          the executor must manually set per-item cache itself.

        This adds two parameters to the decorated function:
            cache_only:   only return cache
            cache_first:  return cache first, then trigger let the function
                          in another thread
        """
        expire = expire or self.default_expire
        default_mini_bs = mini_batch_size
        default_cache_first = cache_first
        default_autocache = autocache

        def decorator(func):
            genkey = self.genkey(key or func.__name__.replace('batch_', ''))

            @wraps(func)
            def wrapper(*args, cache_only=False,
                        cache_first=default_cache_first,
                        mini_batch_size=default_mini_bs,
                        autocache=default_autocache,
                        return_asyncio_handle=False, **kwargs):
                args1, items, args2 = first_list_arg(args)

                # kwargs will not be part of the cache keys
                keys = [genkey([*args1, x, *args2]) for x in items]
                values, idxs = self.deserialize_multi(self.client.mget(*keys))

                logger.debug("%d of %d items already in cache.",
                             len(values) - len(idxs), len(values))

                # if all items are cached, or requires cache only
                if not idxs or cache_only:
                    return values

                def fetch_more(idxs):
                    more_items = [items[i] for i in idxs]
                    more_keys = [keys[i] for i in idxs]
                    more_values = func(*args1, more_items, *args2, **kwargs)
                    if autocache:
                        self.update_cache(more_keys, more_values, expire)
                    logger.debug('Fetched %s additional results',
                                 len(more_values))
                    return more_values

                def check_and_fetch(nocache_idxs):
                    """Run in small batches and check cache again before each run.
                    This is for allowing parallel requests at the same time.
                    """
                    total = len(nocache_idxs)
                    iterator = gen_minibatch(nocache_idxs, mini_batch_size)
                    for batch, start, end in iterator:
                        logger.debug('Fetching mini batch %2d ~ %2d of %2d',
                                     start, end, total)
                        vals = self.client.mget(*(keys[idx] for idx in batch))
                        still_no_cache = [
                            nocache_idxs[start + i]
                            for i, val in enumerate(vals)
                            if val is None
                        ]
                        if still_no_cache:
                            fetch_more(still_no_cache)

                # if cache first, return the available values +
                # an asyncio.Handle that may be used to cancel
                # future fetch_more action
                if cache_first:
                    handle = self.loop.call_soon_threadsafe(
                        check_and_fetch, idxs)
                    if return_asyncio_handle:
                        return values, handle
                    return values

                # fetch more in small batches and update return values
                for batch, start, end in gen_minibatch(idxs, mini_batch_size):
                    for i, val in zip(batch, fetch_more(batch)):
                        values[i] = val

                return values

            # iter cached results
            wrapper.iter_cache = lambda *args, **kwargs: \
                self.client.scan_iter(genkey(args, kwargs) + '*')

            # no cache
            wrapper.nocache = func

            return wrapper

        return decorator


# Default connection
store = RedisStore()
