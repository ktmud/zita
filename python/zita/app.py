import uvicorn

from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware

from zita.serve.schema import asgi_app
from zita.settings import CORS, HOST, PORT, DEBUG


def create_app():
    app = Starlette(debug=DEBUG)
    if CORS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[CORS],
            allow_headers=["X-Requested-With", "Content-Type"],
        )
    # Expose only a GraphQL API
    app.mount("/", asgi_app)
    return app


app = create_app()


if __name__ == "__main__":
    uvicorn.run(app='zita.app:app', host=HOST, port=PORT, reload=DEBUG)
