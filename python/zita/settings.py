#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Global App Settings
"""
import os
import sys
import logging

from pathlib import Path
from starlette.config import Config
# from starlette.datastructures import URL

config = Config(".env")

ENV = config("ZT_ENV", default=None) or config("ENV", default="dev")
DEBUG = ENV != "prod"
LOG_LEVEL = logging.DEBUG if DEBUG else logging.INFO
HOST = config("ZT_HOST", default="0.0.0.0")
PORT = config("ZT_PY_PORT", cast=int, default=3001)
RPC_PORT = config("ZT_RPC_PORT", cast=int, default=3002)
CORS = config("ZT_PY_CORS", default="*")
CLIENT_API_ROOT = config("ZT_API_ROOT", default="http://localhost:3000/api")
ALBUM_DELIM = config("ZT_ALBUM_DELIM", default=" ~ ")
ALBUMS_ROOT = Path(config("ZT_ALBUMS_ROOT", default="../example/data"))
LABELS_CSV = config("ZT_LABELS_CSV", default=f"{ALBUMS_ROOT}/tags.csv")
MODELS_ROOT = Path(config("ZT_MODELS_ROOT", default="notebooks/models"))
DEFAULT_MODEL = config("ZT_DEFAULT_MODEL", default="default")

REDIS_URL = config("ZT_REDIS_URL", default=config(
    "REDIS_URL", default="redis://localhost:6379"))
CELERY_BROKER_URL = config("ZT_CELERY_BROKER_URL", default=f'{REDIS_URL}/1')

# number of parallel workers to run batch predictions
NUM_PRED_WORKERS = config("ZT_NUM_PRED_WORKERS",
                          cast=int, default=os.cpu_count())
# seconds before predictions expire (default: 2h)
PRED_EXPIRE_SEC = config("ZT_PRED_EXPIRE_SEC", cast=int, default=7200)


def setup_loggers():
    stdoutHandler = logging.StreamHandler(sys.stdout)
    humanFormatter = logging.Formatter(
        '[%(levelname)-5s] %(name)-10s - %(message)s')
    stdoutHandler.setFormatter(humanFormatter)
    for name in ['serve', 'redis', 'rpc', 'train', 'data']:
        logger = logging.getLogger(f'zita.{name}')
        logger.setLevel(LOG_LEVEL)
        logger.addHandler(stdoutHandler)


setup_loggers()
