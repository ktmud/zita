"""
Helper class for Photo
"""
from zita.settings import DEFAULT_MODEL
from zita.serve import predict


class Photo(object):

    def __init__(self, photo_id):
        self.id = photo_id

    def predTags(self, model=DEFAULT_MODEL):
        return predict(model, self.id)
