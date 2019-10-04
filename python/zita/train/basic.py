#!/usr/bin/env python3
"""
Train basic classification model with Resnet50
"""
import logging
import click
import numpy as np
import torch
import fastai.distributed

from pathlib import Path
from functools import partial
from logging.handlers import RotatingFileHandler

from fastai.vision import models, cnn_learner
from fastai.metrics import accuracy_thresh, fbeta

from zita.data import load_dataset
from zita.settings import ALBUMS_ROOT, MODELS_ROOT

logger = logging.getLogger('zita.train')
MAX_LOG_FILE_SIZE = 1048576  # 1MB


def setup_logger(outfile='train.log'):
    """Set up a file output"""
    fh = RotatingFileHandler(outfile, maxBytes=1)
    fmt = logging.Formatter('%(asctime)-15s\t[%(levelname)-5s]\t%(message)s')
    fh.setFormatter(fmt)
    logger.addHandler(fh)


def train(name, data, model='resnet50', thresh=0.5,
          output_dir=MODELS_ROOT, return_learner=True,
          train_stage1=True, train_stage2=True,
          stage1_cycles=6,
          stage2_cycles=4,
          stage1_max_lr=slice(6e-3, 6e-2),
          stage2_max_lr=slice(1e-5, 1e-4)):
    metrics = [partial(accuracy_thresh, thresh=thresh),
               partial(fbeta, thresh=thresh)]
    model = getattr(models, model)
    learn = cnn_learner(data, model, metrics=metrics)

    # Enable parallel if there are more than one GPU
    if torch.cuda.device_count() > 1:
        learn = learn.to_parallel()

    if train_stage1:
        logger.info(f"Training Stage 1 for [{name}]...")
        learn.fit_one_cycle(stage1_cycles, stage1_max_lr)
        # learn.recorder.plot_losses()
        # plt.title(f'Losses for {name} - Stage 1')
        # plt.show()

        pth = learn.save(f'{name}-stage1', return_path=True)
        logger.info(f"Saved Stage 1 to {pth}.")
        learn.export(Path(output_dir) /
                     f'{name}-stage1.pkl', destroy=False)

    if train_stage2:
        learn.load(f'{name}-stage1')
        learn.unfreeze()

        logger.info(f"Training Stage 2 for [{name}]...")
        learn.fit_one_cycle(stage2_cycles, max_lr=stage2_max_lr)
        # learn.recorder.plot_losses()
        # plt.title(f'Losses for {name} - Stage 2')
        # plt.show()

        pth = learn.save(f'{name}-stage2', return_path=True)
        logger.info(f"Saved Stage 2 to {pth}.")
        learn.export(Path(output_dir) /
                     f'{name}-stage2.pkl', destroy=not return_learner)

    return learn if return_learner else None


def train_multi_thresh(data, model, thresh_range=(0.2, 0.8),
                       name_prefix='', name_suffix='', **kwargs):
    start, end = thresh_range
    for thresh in np.linspace(start, end, (end - start) * 10 + 1):
        thresh = round(thresh, 1)
        name = f'{name_prefix}{model}-thresh{thresh:.1f}{name_suffix}'
        train(name, data, thresh=thresh, **kwargs)


@click.command()
@click.option("--model", default="resnet50",
              type=click.Choice([
                  x for x in dir(models)
                  if x.islower() and not x.startswith('__')
              ]),
              help="Predefined PyTorch model to use.")
@click.option("--input-dir", default=ALBUMS_ROOT, type=Path,
              help="Input directory where the photos are located.")
@click.option("--output-dir", default=MODELS_ROOT, type=Path,
              help="Output directory where to save the models.")
@click.option("--labels", type=Path,
              help="Where to find the CSV labels. Defaults to"
                   " INPUT_DIR/tags.csv.")
@click.option("--min-thresh", default=0.2,
              help="Min thresh for accuracy_thresh.")
@click.option("--max-thresh", default=0.8,
              help="Max thresh for accuracy_thresh.")
@click.option("--transform", default=True,
              help="Whether to transform the data.")
@click.option("--batch-size", default=256, help="ImageDataBunch batch size.")
@click.option("--image-size", default=234, help="Transformed image size.")
@click.option("--log", default="train.log", help="log output file.")
def basic_train(model, input_dir, output_dir, labels, transform,
                min_thresh, max_thresh, batch_size,
                image_size, log):
    setup_logger(log)
    if not labels:
        labels = input_dir/'tags.csv'
    if transform:
        tfms = dict(
            flip_vert=False, max_lighting=0.1, max_zoom=1.2, max_rotate=0,
            p_affine=0.3, p_lighting=0.6, max_warp=0.)
    else:
        tfms = None
    data = load_dataset(
        path=input_dir,
        labels_csv=labels,
        tfms=tfms,
        normalize=True,
        size=image_size,
        bs=batch_size
    )
    train_multi_thresh(data, model, (min_thresh, max_thresh),
                       output_dir=output_dir)


if __name__ == "__main__":
    basic_train()
