"""
[WIP] Celery for async prediction tasks
"""
from celery import Celery
from zita.settings import CELERY_BROKER_URL

app = Celery('zita.tasks', broker=CELERY_BROKER_URL, include=['zita.tasks'])

app.conf.update(
    result_expires=3600,
)

if __name__ == '__main__':
    app.start()
