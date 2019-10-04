"""
Remove duplicate images
"""
import os
import logging
import numpy as np
import time

from imagehash import dhash, Image
from itertools import combinations
from collections import defaultdict
from functools import reduce
from matplotlib import pyplot as plt

from zita.utils.parallel_runner import ParallelRunner
from zita.settings import ALBUMS_ROOT

logger = logging.getLogger('zita.data')

DEFAULT_DUP_RANGE = (0, 4)


def compare_hash(x, y):
    return np.count_nonzero(y.hash != x.hash)


def sigs2dists(sigs, comp=compare_hash):
    """Image signatures to distances. Run in parallel mode
    when pool is not None. Normally you don't need this."""
    dists = [(a, b, comp(sigs[a], sigs[b]))
             for a, b in combinations(range(len(sigs)), 2)]
    dists = np.array(dists)
    return dists


def dists2dups(dists, min_thresh=0, max_thresh=4):
    """Distances to duplicate list"""
    d = dists[:, 2]
    dups = dists[(d <= max_thresh) & (d >= min_thresh)].astype(int)
    dedup = defaultdict(set)

    for a, b in zip(dups[:, 0], dups[:, 1]):
        dedup[a].add(b)

    if dedup:
        # the items to remove
        dups = reduce(lambda a, b: a | b, dedup.values())
    else:
        dups = set()

    return dedup, dups


def plot_dups(data, dedup, limit=5):
    for i, (k, vals) in enumerate(dedup.items()):
        if i >= limit:
            break
        fig, axes = plt.subplots(ncols=len(vals) + 1, figsize=(6, 2))
        data.train_ds.x[k].show(ax=axes[0])
        for j, p in enumerate(vals):
            data.train_ds.x[p].show(ax=axes[j + 1])


def get_image_sigs(imgs, path=ALBUMS_ROOT, hashfunc=dhash, max_workers=None):
    """Get image signatures"""
    t = time.time()

    prunner = ParallelRunner(max_workers=max_workers or os.cpu_count())
    logger.info('Computing image signatures in %d threads...',
                prunner._executor._max_workers)

    # image loading is an I/O bound task, so it helps (a lot) to
    # run hashing in parallel
    sigs = prunner.run(lambda x: hashfunc(Image.open(path/x)), imgs)

    delta = time.time() - t
    logger.info('Computing image signatures done in %.3f secs', delta)

    return sigs


def dedup_df(df, path=ALBUMS_ROOT, dup_range=DEFAULT_DUP_RANGE, hashfunc=dhash):
    """Remove duplicate image items in a DF"""
    min_thresh, max_thresh = dup_range

    sigs = get_image_sigs(df['name'], path=path, hashfunc=hashfunc)

    logger.info('Calculate image distances...')
    t = time.time()
    dists = sigs2dists(sigs)
    delta = time.time() - t
    logger.info('Calculate image distances done in %.3f secs', delta)

    dedup, dups = dists2dups(dists, min_thresh=min_thresh,
                             max_thresh=max_thresh)

    logger.info(
        f'Found {len(dups)} duplicate photos with '
        f'{min_thresh} <= thresh <= {max_thresh}')
    return df[~df.index.isin(dups)]
