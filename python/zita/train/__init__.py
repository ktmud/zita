#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Training image classifier for production
"""
# import imagehash
import logging
import numpy as np

from itertools import combinations
from collections import defaultdict
from fastai.vision import pd

from zita.settings import LABELS_CSV

logger = logging.getLogger(__name__)


def get_labels(src=LABELS_CSV, dedup=True):
    """Load image tags as DFs

    Parameters
    -------------
        src: the source url/path of the photo tags CSV file
    """
    df = pd.read_csv(src, names=['name', 'label'])
    df['name'] = df['name'].str.replace(' ~ ', '/')
    # Remove empty tags
    df = df[~df['label'].isna() & ~(df['label'] == '')]
    # Order the tags
    df['label'] = (df['label'].str.replace('\|\|', ',')
                   .astype('str')
                   .apply(lambda x: ','.join(sorted(x.split(',')))))
    logger.debug('Loaded tags for %s photos', df.shape[0])
    return df


def sigs2dists(sigs, comp=lambda x, y: np.count_nonzero(y.hash != x.hash)):
    dists = []
    for a, b in combinations(range(len(sigs)), 2):
        dist = comp(sigs[a], sigs[b])
        dists.append([a, b, dist])
    dists = np.array(dists)
    return dists


def dists2dups(dists, max_thresh=10, min_thresh=0):
    d = dists[:, 2]
    dups = dists[(d <= max_thresh) & (d >= min_thresh)].astype(int)
    dedup = defaultdict(set)
    for a, b in zip(dups[:, 0], dups[:, 1]):
        dedup[a].add(b)
    # the items to remove
    dups = reduce(lambda a, b: a | b, dedup.values())
    return dedup, dups
