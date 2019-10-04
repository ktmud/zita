from graphql.error import GraphQLError
from ariadne import QueryType, ObjectType, convert_kwargs_to_snake_case

from zita.data import get_true_labels
from zita.serve.predict import predict, batch_predict

query = QueryType()
Prediction = ObjectType("Prediction")


@Prediction.field("truth")
def truth_labels(obj, info, photo_id) -> [str]:
    return get_true_labels(photo_id)


def get_pred(model, photo_id):
    try:
        return predict(model, photo_id)
    except ValueError as e:
        raise GraphQLError(*e.args)


def get_batch_pred(model, photo_ids):
    try:
        return batch_predict(model, photo_ids)
    except ValueError as e:
        raise GraphQLError(*e.args)


@query.field("prediction")
@convert_kwargs_to_snake_case
def predict_one(obj, info, photo_id) -> dict:
    return get_pred(info.context.model, photo_id)


@query.field("predictions")
@convert_kwargs_to_snake_case
def predict_many(obj, info, photo_ids):
    return get_batch_pred(info.context.model, photo_ids)
