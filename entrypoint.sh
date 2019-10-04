#!/bin/bash
set -e

# Web interface
web() {
  # Node will spawn a Python process for RPC communication if necessary
  npm start
}

worker() {
  cd python
  celery -A zita worker -l info
}

# Python Prediction service GraphQL API
py() {
  cd python
  if [[ ! -z $(which poetry) ]]; then
    poetry run uvicorn zita.app:app --port ${ZT_PY_PORT:-3001}
  else
    uvicorn zita.app:app --port ${ZT_PY_PORT:-3001}
  fi
}

case "$1" in
  web)
    shift
    web
    ;;
  worker)
    shift
    worker
    ;;
  py)
    shift
    py
    ;;
  *)
    exec "$@"
    ;;
esac


