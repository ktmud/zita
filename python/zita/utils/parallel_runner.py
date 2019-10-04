"""
Run parallel tasks in ThreadPoolExecutor
"""
from concurrent.futures import ThreadPoolExecutor


class ParallelRunner:
    """Run a function in ThreadPoolExecutor for list of arguments
    and return the results.
    """

    def __init__(self, pool=None, max_workers=None):
        self._executor = pool or ThreadPoolExecutor(max_workers=max_workers)

    def run(self, func, *iterables):
        return [x for x in self.map(func, *iterables)]

    def map(self, func, *iterables):
        return self._executor.map(func, *iterables)

    def __enter__(self):
        return self

    def __exit__(self, exception_type, exception_value, traceback):
        self._executor.__exit__(exception_type, exception_value, traceback)
