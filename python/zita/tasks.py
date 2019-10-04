from .celery import app
from zita.serve import predict, batch_predict


@app.task
def predict_one(model, photo_id):
    pass
    return predict(model, photo_id)


@app.task
def batch_predict(model, photo_ids):
    pass
    # return predict(model, photo_id)
