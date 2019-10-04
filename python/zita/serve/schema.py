"""
GraphQL Schema
"""
import os
from pathlib import Path
from collections import namedtuple

from starlette.requests import Request
from ariadne import gql, make_executable_schema
from ariadne.asgi import GraphQL
from zita.settings import DEBUG, DEFAULT_MODEL

from .resolver import query

# header key
ZT_MODEL = "ZT_M"

with (Path(os.path.dirname(__file__)) / "typedef.gql").open() as f:
    typedef = gql(f.read())

schema = make_executable_schema(typedef, query)
Context = namedtuple("Context", ["model"])


async def context_value(req: Request):
    model = req.headers.get(f"X-{ZT_MODEL}") or req.cookies.get(ZT_MODEL)
    return Context(model=model or DEFAULT_MODEL)


asgi_app = GraphQL(schema, context_value=context_value, debug=DEBUG)
