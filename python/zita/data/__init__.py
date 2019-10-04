"""
Utilities to load dataset
"""
import logging
import pandas as pd

from functools import lru_cache
from fastai.vision import ImageList, ImageDataBunch, get_transforms
from fastai.vision.image import open_image

from zita.data.dedup import dedup_df, DEFAULT_DUP_RANGE
from zita.settings import ALBUMS_ROOT, LABELS_CSV, ALBUM_DELIM

logger = logging.getLogger('zita.data')


@lru_cache(maxsize=3)
def get_labels(pth=str(LABELS_CSV), asdict=False, replace_album_delim=True,
               dup_range=DEFAULT_DUP_RANGE, path=ALBUMS_ROOT):
    """Get truth labels for all photos
    """
    logger.info("Reading labels CSV from %s", pth)
    df = pd.read_csv(pth, names=["name", "label"])
    # Remove empty tags
    df = df[~df["label"].isna() & ~(df["label"] == "")]
    if replace_album_delim:
        df["name"] = df["name"].str.replace(ALBUM_DELIM, "/")
    # Order the tags alpahbetically
    df["label"] = (
        df["label"]
        .str.replace(r"\|\|", ",")
        .astype("str")
        .apply(lambda x: ",".join(sorted(x.split(","))))
    )
    if dup_range:
        df = dedup_df(df, path, dup_range)
    if asdict:
        return dict(zip(df["name"], df["label"]))
    return df


def get_true_labels(photo_id):
    all_labels = get_labels(asdict=True, replace_album_delim=False)
    return all_labels.get(photo_id)


def get_image(photo_id):
    if ALBUM_DELIM in photo_id:
        [album, photo] = photo_id.split(ALBUM_DELIM)
        filepath = ALBUMS_ROOT/album/photo
    else:
        filepath = ALBUMS_ROOT/photo_id
    if not filepath.exists():
        raise ValueError(f"No such file: {filepath}")
    return open_image(filepath)


def src_from_df(df, path=ALBUMS_ROOT, seed=42, valid_pct=0.2,
                valid_album="valid", label_delim=','):
    """Create source item list from DataFrame.
    You can either split by random percent, or make one of your
    albums as the validation set.

    Args:
        dedup : bool
            whether to remove duplicate images
        dedup_thresh : [int, int]
            the min/max thresholds used for detecting duplicate photos.
    """
    logger.info('Creating ImageList of %d items' % df.shape[0])
    itemlist = ImageList.from_df(df, path)
    if valid_pct:
        itemlist = itemlist.split_by_rand_pct(0.2, seed=seed)
    elif valid_album:
        def func(x): return f'/{valid_album}/' in x
        itemlist = itemlist.split_by_valid_func(func)
    return itemlist.label_from_df(label_delim=label_delim)


def src_from_csv(path=ALBUMS_ROOT, labels_csv=LABELS_CSV,
                 dup_range=DEFAULT_DUP_RANGE, **kwargs):
    df = get_labels(labels_csv, dup_range=dup_range)
    logger.info('Loaded labels for %d images' % df.shape[0])
    return src_from_df(df, path=path, **kwargs)


def src_from_photo_ids(photo_ids, path=ALBUMS_ROOT):
    df = pd.DataFrame({
        "name": [x.replace(ALBUM_DELIM, '/') for x in photo_ids],
    })
    return ImageList.from_df(df, path)


def load_dataset(path=ALBUMS_ROOT, labels_csv=LABELS_CSV, normalize=False,
                 tfms=None, size=None, bs=None, **kwargs):
    """Prepare src dataset for training

    Args:
        tfms : dict(str=any)
            kwargs passed to fastai.vision.get_transforms
        size : int or (int, int)
            transform image to specified size, no transformation is None
        bs : int
            batch size for DataBunch, don't create a DataBunch if bs is None
    """
    src = src_from_csv(path, labels_csv, **kwargs)
    if tfms and isinstance(tfms, dict):
        tfms = get_transforms(tfms)
    if size is not None:
        src = src.transform(tfms, size=size)
    if bs is not None:
        src = src.databunch(bs=bs)
        # Normalize can only apply to DataBunch
        if normalize:
            src = src.normalize(None if normalize is True else normalize)
    return src


def image_bunch(df, path=ALBUMS_ROOT, **kwargs):
    args = dict(
        seed=101,
        label_delim=',',
        size=234,
        num_workers=4,
        valid_pct=0.2
    )
    args.update(kwargs)
    return (ImageDataBunch.from_df(path, df, **args)
            .normalize())
