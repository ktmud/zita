import threading
import itertools
import os
import logging
import pandas as pd
import numpy as np

from zita.data import get_labels
from zita.utils.parallel_runner import ParallelRunner
from zita.serve.predict import list_learners, get_learner
from zita.serve.predict import predict, batch_predict
from tqdm import tqdm_notebook

from zita.settings import ALBUMS_ROOT, MODELS_ROOT

logger = logging.getLogger('zita.serve')


def predict_all(model, photo_ids):
    """Predict a list of photo IDs, with progress.
    For a non-progress version, just use `batch_predict`."""
    total = len(photo_ids)
    progress = tqdm_notebook(total=total, desc=model)
    results = [None for _ in photo_ids]
    truth = get_labels(asdict=True, dup_range=None)
    with ParallelRunner(max_workers=os.cpu_count()) as runner:
        iterator = runner.map(predict, itertools.repeat(model), photo_ids)
        for i, pred in enumerate(iterator):
            progress.update(1)
            results[i] = pred
    return pd.DataFrame(results)


def predict_all_ds(model, ds):
    """Predict a preloaded ImageList"""
    total = len(ds)
    progress = tqdm_notebook(total=total, desc=model)
    results = [None for _ in ds]

    def learn_predict(arg, name):
        learn = get_learner(model, cache_id=threading.get_ident())
        if len(arg) > 1:
            image, y = arg
        else:
            image = arg[0]
        y_pred, preds, probs = learn.predict(image)
        return {
            "id": name,
            "model": model,
            "truth": y and y.obj,
            "tags": y_pred.obj,
            "preds": preds.to(int).tolist(),
            "probs": probs.tolist()
        }

    with ParallelRunner(max_workers=os.cpu_count()) as runner:
        iterator = runner.map(learn_predict, ds, ds.photo_ids)
        for i, pred in enumerate(iterator):
            progress.update(1)
            results[i] = pred
    return pd.DataFrame(results)


def predict_all_models(items, models=list_learners(), skip_stage1=True):
    """Predict a batch of items with all available learners"""
    results = {}
    pred = predict_all
    for i, model in enumerate(models):
        if skip_stage1 and model.endswith('stage1'):
            continue
        try:
            results[model] = pred(model, items)
        except Exception as err:
            logger.error(err, exc_info=True)
    return results


def find_best_model(results, ds):
    highest_oacc = 0
    best_model = None
    folder = str(ALBUMS_ROOT)

    for model, df in results.items():
        df['truth'] = df['truth'].apply(lambda x: ' '.join(sorted(x.split(','))))
        df = df.merge(pd.DataFrame({
            'id': [x.replace(folder + '/', '') for x in ds.photo_ids],
            'y': ds.y.photo_ids
        }), on='id')

        # accurately predict all tags for each photo
        acc = (df['tags'] == df['truth']).mean()

        # overall accuracy
        preds = df['preds'].str.split(' ')
        preds = np.array(preds.tolist()).astype(int)
        truth = np.zeros_like(preds)

        for i, x in enumerate(df['y']):
            truth[i, x] = 1
        oacc = (truth == preds).mean()

        print(f'{model:s} - {acc:.4f} - {oacc:.4f}')
        if oacc > highest_oacc:
            highest_oacc = oacc
            best_model = model

    print(f'[Best: {highest_oacc:.6f}] {best_model}')
    return best_model


def save_preds(dat_valid, dat_train=None, suffix="-preds"):
    for model, df_valid in dat_valid.photo_ids():
        if dat_train:
            df_train = dat_train[model]
            df_valid['is_valid'] = True
            df_train['is_valid'] = False
            df = pd.concat([df_train, df_valid], axis=0, ignore_index=True)
        else:
            df = df_valid
        outfile = str(MODELS_ROOT/f'{model}{suffix}.csv')
        df.to_csv(outfile, index=False)


def load_preds(path=MODELS_ROOT, suffix="-preds", skip_stage1=True):
    dat = {}
    for model in list_learners():
        if skip_stage1 and model.endswith('stage1'):
            continue
        try:
            dat[model] = pd.read_csv(path/f'{model}{suffix}.csv')
        except Exception as e:
            logger.error(e, exc_info=True)
            pass
    return dat
