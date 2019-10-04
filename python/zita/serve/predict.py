#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serve the Image Classifier
"""
import logging
import time
import threading
import itertools
import os
import pandas as pd

from functools import lru_cache
from fastai.basic_train import load_learner
from fastai.vision import ImageList, DatasetType

from zita.data import get_image, get_labels, src_from_photo_ids
from zita.settings import MODELS_ROOT, NUM_PRED_WORKERS, PRED_EXPIRE_SEC
from zita.serve.redis import store
from zita.utils.parallel_runner import ParallelRunner

logger = logging.getLogger('zita.serve')
prunner = ParallelRunner(max_workers=NUM_PRED_WORKERS)
CACHE_KEY_PREFIX = "zita.pred"

# cache two models in memory for each worker
@lru_cache(maxsize=NUM_PRED_WORKERS * 2)
def get_learner(model, cache_id=1):
    filename = f"{model}.pkl"
    fullpath = MODELS_ROOT/filename
    if not fullpath.exists():
        # logger.error('Learner does not exist: %s', fullpath)
        raise ValueError(f"No such learner: {model}")
    learn = load_learner(MODELS_ROOT, filename)
    # if hasattr(learn.model, 'module'):
    #     learn.model = learn.model.module
    return learn


# List all trained learners under MODELS_ROOT
def list_learners(root=MODELS_ROOT):
    return sorted([p.name.replace(p.suffix, '')
                   for p in root.iterdir()
                   if p.suffix == '.pkl'])


@store.cache(expire=PRED_EXPIRE_SEC, key=CACHE_KEY_PREFIX)
def predict(model, photo_id):
    """Predict labels for one photo"""
    # each thread uses a different learner cache
    learn = get_learner(model, cache_id=threading.get_ident())
    image = get_image(photo_id)
    y, preds, probs = learn.predict(image)
    return {
        "id": photo_id,
        "model": model,
        "classes": learn.data.classes,
        "tags": y.obj,
        "preds": preds.to(int).tolist(),
        "probs": probs.tolist()
    }


@store.mcache(expire=PRED_EXPIRE_SEC, mini_batch_size=100,
              key=CACHE_KEY_PREFIX, autocache=False, cache_first=True)
def batch_predict(model, photo_ids):
    """Run predictions in parallel"""

    logger.debug('Predicting %d photos..', len(photo_ids))
    t = time.time()
    # run in multithread mode
    logger.debug('Run predictions in %d worker threads..',
                 prunner._executor._max_workers)
    results = prunner.run(predict, itertools.repeat(model), photo_ids)
    tt = time.time()
    logger.debug('Prediction finished in %.3f seconds', tt - t)

    return results


@store.mcache(expire=PRED_EXPIRE_SEC, mini_batch_size=1280,
              key=CACHE_KEY_PREFIX, cache_first=False)
def native_batch_predict(model, photo_ids):
    """Predict in native fastai batches. Useful
    when you want to run predictions on a very large set of data

    Args:
        ds : an ImageList dataset
        photo_ids : Photo Ids (dir/name.jpg) we use to find photos
                    in ALBUMS_ROOT.

    Returns:
        Prediction results as a list of dictionaries
    """
    learn = get_learner(model)
    ds = src_from_photo_ids(photo_ids)
    # Run batch tests in fastai
    learn.data.add_test(ds)
    classes = learn.data.classes
    ds = learn.data.single_ds

    logger.info('Predicting %d photos with native batch..', len(photo_ids))

    all_probs, _ = learn.get_preds(DatasetType.Test)
    results = []
    for photo_id, probs in zip(photo_ids, all_probs):
        preds = ds.y.analyze_pred(probs)
        results.append({
            'id': photo_id,
            'model': model,
            'classes': classes,
            'tags': ds.y.reconstruct(preds).obj,
            'preds': preds.tolist(),
            'probs': probs.tolist(),
        })
    return results

